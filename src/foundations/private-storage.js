import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

export const LOCAL_MEMORY_DIRECTORY = ".repay-techdebt";

function defaultStateBase(environment = process.env, platform = process.platform) {
  if (environment.REPAY_TECHDEBT_STATE_DIR) return resolve(environment.REPAY_TECHDEBT_STATE_DIR);
  if (platform === "darwin")
    return resolve(homedir(), "Library", "Application Support", "repay-techdebt");
  if (platform === "win32")
    return resolve(environment.LOCALAPPDATA ?? environment.APPDATA ?? homedir(), "repay-techdebt");
  return resolve(
    environment.XDG_STATE_HOME ?? resolve(homedir(), ".local", "state"),
    "repay-techdebt",
  );
}

function defaultCacheBase(environment = process.env, platform = process.platform) {
  if (environment.REPAY_TECHDEBT_CACHE_DIR) return resolve(environment.REPAY_TECHDEBT_CACHE_DIR);
  if (platform === "darwin") return resolve(homedir(), "Library", "Caches", "repay-techdebt");
  if (platform === "win32")
    return resolve(
      environment.LOCALAPPDATA ?? environment.APPDATA ?? homedir(),
      "repay-techdebt",
      "cache",
    );
  return resolve(environment.XDG_CACHE_HOME ?? resolve(homedir(), ".cache"), "repay-techdebt");
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
