// Resolve a target's workbook layout for the viewer without importing the CLI's
// private config validator. Mirrors the workbookPaths() derivation in
// scripts/project-memory.js: private output keeps the workbook inside the memory
// root (lessons/index.md); sister/custom output uses a discoverable root (INDEX.md).
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { resolveMemoryPaths } from "../foundations/memory-paths.js";
import { pathExists } from "../foundations/private-storage.js";

function deriveLayout(memory, config) {
  const location = config.output?.location ?? "private";
  const isPrivate = location === "private";
  const root = isPrivate ? memory.root : resolve(config.output.root);
  return {
    location,
    storageMode: memory.location.mode,
    targetRoot: memory.location.projectId ? memory.root : undefined,
    memoryRoot: memory.root,
    workbookRoot: root,
    lessonsDir: resolve(root, "lessons"),
    indexPath: isPrivate ? resolve(root, "lessons", "index.md") : resolve(root, "INDEX.md"),
    progressPath: resolve(root, "progress.json"),
    // curriculum.json is private machine state and always lives in the memory root,
    // even when the visible workbook is the sister directory.
    curriculumPath: memory.curriculumData,
    configPath: memory.config,
  };
}

/**
 * Resolve the workbook surface for a target root.
 *
 * @returns {Promise<{ ready: boolean, targetRoot: string } & Layout>}
 *   `ready` is false when no project memory config exists yet; callers should still
 *   serve an empty shell rather than crash.
 */
export async function resolveWorkbook(targetRoot, options = {}) {
  const memory = await resolveMemoryPaths(targetRoot, options);
  const base = {
    ready: false,
    targetRoot,
    memoryRoot: memory.root,
    location: memory.location.mode,
  };
  if (!(await pathExists(memory.config))) {
    return {
      ...base,
      workbookRoot: memory.root,
      lessonsDir: resolve(memory.root, "lessons"),
      indexPath: resolve(memory.root, "lessons", "index.md"),
      progressPath: resolve(memory.root, "progress.json"),
      curriculumPath: memory.curriculumData,
      configPath: memory.config,
    };
  }
  const config = JSON.parse(await readFile(memory.config, "utf8"));
  return { ready: true, config, ...deriveLayout(memory, config) };
}
