import { resolve } from "node:path";
import { locateProjectMemory } from "./private-storage.js";

export const MEMORY_CONFIG_FILE = "config.json";

/** Path layout for a project-memory root (private or project-local). */
export function memoryPaths(root) {
  return {
    root,
    config: resolve(root, MEMORY_CONFIG_FILE),
    curriculum: resolve(root, "curriculum.md"),
    curriculumData: resolve(root, "curriculum.json"),
    decisions: resolve(root, "decisions.md"),
    lessonIndex: resolve(root, "lessons", "index.md"),
    lessonLock: resolve(root, ".lesson-index.lock"),
    lessons: resolve(root, "lessons"),
    artifacts: resolve(root, "artifacts"),
    artifactIndex: resolve(root, "artifacts", "index.json"),
    artifactLock: resolve(root, ".artifact-index.lock"),
  };
}

/**
 * Resolve memory path map for a target. Lives in lib so callers never import the CLI facade.
 */
export async function resolveMemoryPaths(targetRoot, options = {}) {
  const location = await locateProjectMemory(targetRoot, options.storage);
  return { ...memoryPaths(location.root), location };
}
