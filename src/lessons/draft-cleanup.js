import { rm } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import { isSameOrInside } from "../foundations/targeting.js";

/**
 * Decide whether a draft input should be removed after a successful save.
 *
 * @param {string} inputPath Absolute path to --input
 * @param {string} [finalPath] Absolute path to the saved lesson (if any)
 * @param {{ cleanupInput?: boolean, lessonsDir?: string }} [opts]
 * @returns {{ cleanup: boolean, reason: string }}
 */
export function shouldCleanupDraftInput(inputPath, finalPath, opts = {}) {
  if (opts.cleanupInput === false) {
    return { cleanup: false, reason: "cleanup-disabled" };
  }
  if (!inputPath || typeof inputPath !== "string") {
    return { cleanup: false, reason: "no-input" };
  }
  const absoluteInput = resolve(inputPath);
  if (finalPath && resolve(finalPath) === absoluteInput) {
    return { cleanup: false, reason: "same-as-output" };
  }

  const name = basename(absoluteInput);
  if (name.includes(".draft-")) {
    return { cleanup: true, reason: "draft-prefix" };
  }

  const tmp = resolve(tmpdir());
  if (isSameOrInside(absoluteInput, tmp)) {
    return { cleanup: true, reason: "temp-dir" };
  }

  if (opts.lessonsDir) {
    const lessonsDir = resolve(opts.lessonsDir);
    if (isSameOrInside(absoluteInput, lessonsDir)) {
      return { cleanup: true, reason: "workbook-lessons-dir" };
    }
  }

  return { cleanup: false, reason: "not-eligible" };
}

/**
 * Remove a draft input after save when eligible.
 *
 * @returns {Promise<{ cleaned: boolean, reason: string }>}
 */
export async function cleanupDraftInput(inputPath, finalPath, opts = {}) {
  const decision = shouldCleanupDraftInput(inputPath, finalPath, opts);
  if (!decision.cleanup) {
    return { cleaned: false, reason: decision.reason };
  }

  try {
    await rm(resolve(inputPath), { force: true });
    return { cleaned: true, reason: decision.reason };
  } catch (error) {
    return { cleaned: false, reason: `cleanup-failed: ${error.message}` };
  }
}

/**
 * @deprecated Use cleanupDraftInput after save.
 */
export async function cleanupDraft(draftPath) {
  const result = await cleanupDraftInput(draftPath, null, { cleanupInput: true });
  return result.cleaned;
}

/**
 * Scans a directory (shallowly) and removes all .draft-* files.
 *
 * @param {string} targetDir Absolute path to the directory to scan.
 */
export async function cleanupAllDrafts(targetDir) {
  if (!targetDir || typeof targetDir !== "string") return;

  try {
    const { readdir } = await import("node:fs/promises");

    const entries = await readdir(targetDir, { withFileTypes: true });
    const draftFiles = entries.filter((e) => e.isFile() && e.name.includes(".draft-"));

    await Promise.all(draftFiles.map((e) => cleanupDraftInput(resolve(targetDir, e.name), null)));
  } catch {
    // Ignore errors reading or cleaning directory
  }
}
