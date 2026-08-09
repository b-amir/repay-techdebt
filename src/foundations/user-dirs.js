import os from "node:os";
import path from "node:path";
import fs from "node:fs";

function ensureWritable(targetPath, fallbackPrefix) {
  try {
    fs.mkdirSync(targetPath, { recursive: true });
    fs.accessSync(targetPath, fs.constants.W_OK);
    return targetPath;
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EROFS' || e.code === 'EACCES') {
      const fallback = path.join(os.tmpdir(), "repay-techdebt-fallback", fallbackPrefix);
      fs.mkdirSync(fallback, { recursive: true });
      return fallback;
    }
    throw e;
  }
}

export function getCacheDir() {
  let p;
  if (process.env.XDG_CACHE_HOME) p = path.join(process.env.XDG_CACHE_HOME, "repay-techdebt", "runtime");
  else if (process.platform === "darwin") p = path.join(os.homedir(), "Library", "Caches", "repay-techdebt", "runtime");
  else p = path.join(os.homedir(), ".cache", "repay-techdebt", "runtime");
  return ensureWritable(p, "cache-runtime");
}

export function getStateDir() {
  let p;
  if (process.env.XDG_STATE_HOME) p = path.join(process.env.XDG_STATE_HOME, "repay-techdebt");
  else if (process.platform === "darwin") p = path.join(os.homedir(), "Library", "Application Support", "repay-techdebt");
  else p = path.join(os.homedir(), ".local", "state", "repay-techdebt");
  return ensureWritable(p, "state");
}

export function getDataDir() {
  let p;
  if (process.env.XDG_DATA_HOME) p = path.join(process.env.XDG_DATA_HOME, "repay-techdebt", "runtime");
  else if (process.platform === "darwin") p = path.join(os.homedir(), "Library", "Application Support", "repay-techdebt", "runtime");
  else p = path.join(os.homedir(), ".local", "share", "repay-techdebt", "runtime");
  return ensureWritable(p, "data-runtime");
}
