// Plan and execute deletion of repay-techdebt artifacts for a target. Never touches
// application source, package manifests, or lockfiles — only skill memory, workbook
// output, disposable caches, and optional target ignore markers.
import { execFile } from "node:child_process";
import { lstat, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { isSameOrInside } from "../foundations/targeting.js";
import {
  LOCAL_MEMORY_DIRECTORY,
  pathExists,
  projectStoragePaths,
} from "../foundations/private-storage.js";
import { memoryPaths } from "../foundations/memory-paths.js";

const MEMORY_DIR_MARKER = `${LOCAL_MEMORY_DIRECTORY}/`;
const execute = promisify(execFile);

async function safeRealpathIfExists(path) {
  if (!(await pathExists(path))) return null;
  try {
    const details = await lstat(path);
    if (details.isSymbolicLink()) return null;
    return await realpath(path);
  } catch {
    return null;
  }
}

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean))];
}

async function repositoryRootFor(targetRoot) {
  try {
    const result = await execute("git", ["rev-parse", "--show-toplevel"], {
      cwd: targetRoot,
      timeout: 10_000,
    });
    return await realpath(result.stdout.trim());
  } catch {
    return targetRoot;
  }
}

/**
 * @param {string} targetRoot Canonical target root.
 * @param {object} [options]
 * @param {boolean} [options.keepLessons] Preserve lesson markdown files.
 * @param {boolean} [options.keepConfig] Preserve config.json when clearing memory.
 * @param {boolean} [options.includeCache] Also remove disposable analyzer cache.
 * @param {boolean} [options.revertTargetMarkers] Remove skill lines from .gitignore / .graphifyignore.
 * @param {object|null} [options.config] Loaded config when memory exists.
 * @param {string|null} [options.workbookRoot] Resolved workbook root.
 */
export async function planSkillMaintenance(targetRoot, options = {}) {
  const storage = projectStoragePaths(targetRoot);
  const memoryRoots = uniquePaths([
    await safeRealpathIfExists(storage.privateRoot),
    await safeRealpathIfExists(storage.localRoot),
  ]);
  const cacheRoot = await safeRealpathIfExists(storage.cacheRoot);

  const repositoryRoot = await repositoryRootFor(targetRoot);
  const projectName = basename(targetRoot).replace(/[^A-Za-z0-9._-]+/g, "-");
  const defaultSister = resolve(dirname(repositoryRoot), `repay-${projectName}-techdebt`);
  const configuredWorkbook =
    options.workbookRoot ??
    (options.config?.output?.location && options.config.output.location !== "private"
      ? await safeRealpathIfExists(resolve(options.config.output.root))
      : null);
  const sisterRoot = configuredWorkbook ?? (await safeRealpathIfExists(defaultSister));

  const removeDirectories = [];
  const removeFiles = [];
  const preservePaths = [];

  const keepLessons = options.keepLessons ?? false;
  const keepConfig = options.keepConfig ?? false;
  const includeCache = options.includeCache ?? false;

  if (includeCache && cacheRoot) removeDirectories.push(cacheRoot);

  for (const memoryRoot of memoryRoots) {
    if (!keepLessons && !keepConfig) {
      removeDirectories.push(memoryRoot);
      continue;
    }
    const layout = memoryPaths(memoryRoot);
    if (!keepConfig && (await pathExists(layout.config))) removeFiles.push(layout.config);
    if (await pathExists(layout.curriculumData)) removeFiles.push(layout.curriculumData);
    if (await pathExists(layout.curriculum)) removeFiles.push(layout.curriculum);
    if (await pathExists(layout.decisions)) removeFiles.push(layout.decisions);
    if (await pathExists(layout.lessonLock)) removeFiles.push(layout.lessonLock);
    if (await pathExists(layout.artifactLock)) removeFiles.push(layout.artifactLock);
    if (await pathExists(layout.artifacts)) removeDirectories.push(layout.artifacts);
    if (!keepLessons) {
      if (await pathExists(layout.lessons)) removeDirectories.push(layout.lessons);
    } else {
      preservePaths.push(layout.lessons);
    }
    if (keepConfig) preservePaths.push(layout.config);
  }

  if (sisterRoot && !isSameOrInside(sisterRoot, targetRoot)) {
    if (!keepLessons) {
      removeDirectories.push(sisterRoot);
    } else {
      const progressPath = resolve(sisterRoot, "progress.json");
      const indexPath = resolve(sisterRoot, "INDEX.md");
      if (await pathExists(progressPath)) removeFiles.push(progressPath);
      if (await pathExists(indexPath)) removeFiles.push(indexPath);
      preservePaths.push(resolve(sisterRoot, "lessons"));
    }
  }

  const markerRevert = options.revertTargetMarkers ? [targetRoot] : [];

  const removals = uniquePaths([...removeDirectories, ...removeFiles]);
  const insideTarget = removals.filter((path) => isSameOrInside(path, targetRoot));
  const outsideTarget = removals.filter((path) => !isSameOrInside(path, targetRoot));

  return {
    targetRoot,
    removeDirectories: uniquePaths(removeDirectories),
    removeFiles: uniquePaths(removeFiles),
    preservePaths: uniquePaths(preservePaths),
    markerRevert,
    insideTarget,
    outsideTarget,
    cacheRoot: includeCache ? cacheRoot : null,
    memoryRoots,
    workbookRoot: sisterRoot,
  };
}

async function revertIgnoreMarkers(targetRoot) {
  const updated = [];
  for (const filename of [".gitignore", ".graphifyignore"]) {
    const ignorePath = resolve(targetRoot, filename);
    if (!(await pathExists(ignorePath))) continue;
    const original = await readFile(ignorePath, "utf8");
    const lines = original.split(/\r?\n/);
    const filtered = lines.filter((line) => line.trim() !== MEMORY_DIR_MARKER.trim());
    if (filtered.length !== lines.length) {
      const next = filtered.join("\n").replace(/\n?$/, "\n");
      await writeFile(ignorePath, next.length ? next : "", "utf8");
      updated.push(ignorePath);
    }
  }
  const localMemory = resolve(targetRoot, LOCAL_MEMORY_DIRECTORY);
  if (await pathExists(localMemory)) {
    await rm(localMemory, { recursive: true, force: true });
    updated.push(localMemory);
  }
  return updated;
}

/**
 * @param {object} plan From planSkillMaintenance.
 */
export async function executeSkillMaintenance(plan) {
  const removed = [];
  for (const path of plan.removeFiles) {
    await rm(path, { force: true });
    removed.push(path);
  }
  for (const path of plan.removeDirectories) {
    await rm(path, { recursive: true, force: true });
    removed.push(path);
  }
  let markerUpdates = [];
  if (plan.markerRevert.length > 0) {
    markerUpdates = await revertIgnoreMarkers(plan.targetRoot);
  }
  return { removed, markerUpdates };
}

export async function planSkillCacheClear(targetRoot) {
  const storage = projectStoragePaths(targetRoot);
  const cacheRoot = await safeRealpathIfExists(storage.cacheRoot);
  return {
    targetRoot,
    removeDirectories: cacheRoot ? [cacheRoot] : [],
    removeFiles: [],
    preservePaths: [],
    markerRevert: [],
    insideTarget: [],
    outsideTarget: cacheRoot ? [cacheRoot] : [],
    cacheRoot,
    memoryRoots: [],
    workbookRoot: null,
  };
}
