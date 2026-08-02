// Foundations (C0) public API.
// Re-export the category's public surface here so a folder move updates only this file.
// When you make a function public, add it to this barrel.
export {
  skillRoot,
  TargetRootError,
  isSameOrInside,
  resolveTargetRoot,
  formatTargetError,
} from "./targeting.js";

export {
  LOCAL_MEMORY_DIRECTORY,
  projectStorageIdentity,
  projectStoragePaths,
  locateProjectMemory,
} from "./private-storage.js";

export { MEMORY_CONFIG_FILE, memoryPaths, resolveMemoryPaths } from "./memory-paths.js";
