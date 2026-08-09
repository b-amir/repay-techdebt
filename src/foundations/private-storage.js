import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import fs from "node:fs";
import { homedir, tmpdir } from "node:os";
import { resolve } from "node:path";

export const LOCAL_MEMORY_DIRECTORY = ".repay-techdebt";

function ensureWritableSync(targetPath, fallbackPrefix) {
  try {
    fs.mkdirSync(targetPath, { recursive: true });
    fs.accessSync(targetPath, fs.constants.W_OK);
    return targetPath;
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EROFS' || e.code === 'EACCES') {
      const fallback = resolve(tmpdir(), "repay-techdebt-fallback", fallbackPrefix);
      fs.mkdirSync(fallback, { recursive: true });
      return fallback;
    }
    throw e;
  }
}

function defaultStateBase(environment = process.env, platform = process.platform) {
  let p;
  if (environment.REPAY_TECHDEBT_STATE_DIR) p = resolve(environment.REPAY_TECHDEBT_STATE_DIR);
  else if (platform === "darwin") p = resolve(homedir(), "Library", "Application Support", "repay-techdebt");
  else if (platform === "win32") p = resolve(environment.LOCALAPPDATA ?? environment.APPDATA ?? homedir(), "repay-techdebt");
  else p = resolve(environment.XDG_STATE_HOME ?? resolve(homedir(), ".local", "state"), "repay-techdebt");
  return ensureWritableSync(p, "state");
}

function defaultCacheBase(environment = process.env, platform = process.platform) {
  let p;
  if (environment.REPAY_TECHDEBT_CACHE_DIR) p = resolve(environment.REPAY_TECHDEBT_CACHE_DIR);
  else if (platform === "darwin") p = resolve(homedir(), "Library", "Caches", "repay-techdebt");
  else if (platform === "win32") p = resolve(environment.LOCALAPPDATA ?? environment.APPDATA ?? homedir(), "repay-techdebt", "cache");
  else p = resolve(environment.XDG_CACHE_HOME ?? resolve(homedir(), ".cache"), "repay-techdebt");
  return ensureWritableSync(p, "cache");
}

export function projectStorageIdentity(targetRoot) {
  return createHash("sha256")
    .update(`target-root\0${resolve(targetRoot)}`)
    .digest("hex");
}

export function projectStoragePaths(targetRoot, environment = process.env) {
  const projectId = projectStorageIdentity(targetRoot);
  const stateBase = defaultStateBase(environment);
  const cacheBase = defaultCacheBase(environment);
  return {
    projectId,
    stateBase,
    cacheBase,
    privateRoot: resolve(stateBase, "projects", projectId, "memory"),
    cacheRoot: resolve(cacheBase, "projects", projectId),
    localRoot: resolve(targetRoot, LOCAL_MEMORY_DIRECTORY),
  };
}

export async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function locateProjectMemory(targetRoot, requestedStorage) {
  const storage = projectStoragePaths(targetRoot);
  const privateConfig = resolve(storage.privateRoot, "config.json");
  const localConfig = resolve(storage.localRoot, "config.json");
  const [privateReady, localReady, privateRootExists, localRootExists] = await Promise.all([
    pathExists(privateConfig),
    pathExists(localConfig),
    pathExists(storage.privateRoot),
    pathExists(storage.localRoot),
  ]);
  if (requestedStorage) {
    if (!new Set(["private", "project-local", "team"]).has(requestedStorage))
      throw new Error("--storage must be private, project-local, or team");
    const external = requestedStorage === "private";
    return {
      ...storage,
      mode: requestedStorage,
      root: external ? storage.privateRoot : storage.localRoot,
      config: external ? privateConfig : localConfig,
      ready: external ? privateReady : localReady,
      rootExists: external ? privateRootExists : localRootExists,
      competingReady: external ? localReady : privateReady,
    };
  }
  if (privateReady && localReady)
    throw new Error(
      "Both private-external and target-local project memory exist; rerun with --storage private, project-local, or team after choosing the authoritative location.",
    );
  if (privateReady || privateRootExists)
    return {
      ...storage,
      mode: "private",
      root: storage.privateRoot,
      config: privateConfig,
      ready: privateReady,
      rootExists: privateRootExists,
      competingReady: localReady,
    };
  if (localReady || localRootExists)
    return {
      ...storage,
      mode: "project-local",
      root: storage.localRoot,
      config: localConfig,
      ready: localReady,
      rootExists: localRootExists,
      competingReady: privateReady,
    };
  return {
    ...storage,
    mode: "private",
    root: storage.privateRoot,
    config: privateConfig,
    ready: false,
    rootExists: false,
    competingReady: false,
  };
}
