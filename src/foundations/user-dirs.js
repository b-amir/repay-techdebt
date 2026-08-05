import os from "node:os";
import path from "node:path";

export function getCacheDir() {
  if (process.env.XDG_CACHE_HOME) {
    return path.join(process.env.XDG_CACHE_HOME, "repay-techdebt", "runtime");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "repay-techdebt", "runtime");
  }
  return path.join(os.homedir(), ".cache", "repay-techdebt", "runtime");
}

export function getStateDir() {
  if (process.env.XDG_STATE_HOME) {
    return path.join(process.env.XDG_STATE_HOME, "repay-techdebt");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "repay-techdebt");
  }
  return path.join(os.homedir(), ".local", "state", "repay-techdebt");
}

export function getDataDir() {
  if (process.env.XDG_DATA_HOME) {
    return path.join(process.env.XDG_DATA_HOME, "repay-techdebt", "runtime");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "repay-techdebt", "runtime");
  }
  return path.join(os.homedir(), ".local", "share", "repay-techdebt", "runtime");
}
