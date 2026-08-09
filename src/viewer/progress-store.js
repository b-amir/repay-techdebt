// progress.json is the single completion source of truth in the workbook output.
// Pure store: atomic writes, sandboxed keys, caller-supplied timestamps (no Date.now
// in data — only in temp filenames, matching scripts/project-memory.js conventions).
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { isSameOrInside } from "../foundations/targeting.js";

export const PROGRESS_SCHEMA_VERSION = 2;

export function emptyProgress() {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    updatedAt: null,
    lastRead: null,
    lastReadAt: null,
    lastScroll: null,
    completed: {},
  };
}

/**
 * Read and validate progress.json; a missing file is an empty store, not an error.
 */
export async function readProgress(progressPath) {
  let content;
  try {
    content = await readFile(progressPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return emptyProgress();
    throw error;
  }
  const data = JSON.parse(content);
  if (data.schemaVersion === 1) {
    data.schemaVersion = 2;
    data.lastRead = null;
    data.lastReadAt = null;
    data.lastScroll = null;
  }
  if (data.schemaVersion !== PROGRESS_SCHEMA_VERSION || data.completed == null) {
    throw new Error("progress.json must be schemaVersion 2 with a completed map");
  }
  if (
    data.completed == null ||
    typeof data.completed !== "object" ||
    Array.isArray(data.completed)
  ) {
    throw new Error("progress.json completed must be an object keyed by lesson path");
  }
  return { ...emptyProgress(), ...data, completed: { ...data.completed } };
}

/**
 * Normalize and sandbox a lesson path to a forward-slash relative key inside the
 * workbook root. Throws on any escape (`..`, absolute, symlink-resolved outside).
 */
export function normalizeLessonKey(lessonPath, workbookRoot) {
  const absolute = isAbsolute(lessonPath) ? lessonPath : resolve(workbookRoot, lessonPath);
  if (!isSameOrInside(absolute, workbookRoot)) {
    throw new Error("lesson path escapes the workbook root");
  }
  const rel = relative(workbookRoot, absolute).replaceAll("\\", "/");
  if (rel.startsWith("../") || isAbsolute(rel)) {
    throw new Error("lesson path escapes the workbook root");
  }
  return rel || ".";
}

/**
 * Toggle (or explicitly set) completion for a lesson path.
 *
 * @param {object} opts
 * @param {string} opts.nowIso  Caller-supplied ISO timestamp for data fields.
 * @param {string} [opts.topicId]
 * @param {boolean} [opts.completed] Explicit state; omit to toggle.
 * @returns {Promise<{ key: string, completed: boolean, progress: object }>}
 */
export async function setCompletion(progressPath, lessonPath, workbookRoot, opts) {
  const { nowIso, topicId, completed: explicit } = opts;
  const key = normalizeLessonKey(lessonPath, workbookRoot);
  const progress = await readProgress(progressPath);
  const desired = explicit === undefined ? !progress.completed[key] : explicit;
  if (desired) {
    progress.completed[key] = {
      completedAt: nowIso,
      ...(topicId ? { topicId } : {}),
    };
  } else {
    delete progress.completed[key];
  }
  progress.updatedAt = nowIso;
  await atomicWrite(progressPath, progress);
  return { key, completed: desired, progress };
}

/**
 * Update the last read lesson and scroll position.
 *
 * @param {object} opts
 * @param {string} opts.nowIso
 * @param {string|number} [opts.lastScroll]
 */
export async function setLastRead(progressPath, lessonPath, workbookRoot, opts) {
  const { nowIso, lastScroll } = opts;
  const key = normalizeLessonKey(lessonPath, workbookRoot);
  const progress = await readProgress(progressPath);
  const lessonChanged = progress.lastRead !== key;
  progress.lastRead = key;
  progress.lastReadAt = nowIso;
  if (lastScroll !== undefined) {
    progress.lastScroll = lastScroll;
  } else if (lessonChanged) {
    progress.lastScroll = null;
  }
  progress.updatedAt = nowIso;
  await atomicWrite(progressPath, progress);
  return progress;
}

async function atomicWrite(path, data) {
  const temporary = `${path}.${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  try {
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
