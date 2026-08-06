import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { assessClaimFaithfulness, parseClaimsBlock } from "./claim-faithfulness.js";
import { extractLessonCitations, verifyLessonCitations } from "./lesson-citation-check.js";
import { listLessonMarkdown } from "../viewer/search-lessons.js";

/**
 * Runtime claim re-verify for a saved lesson against live target sources.
 * Fail-closed: missing citations, explicit support:yes mismatches, or stale paths.
 *
 * @param {string} targetRoot
 * @param {string} markdown
 * @param {{ lessonPath?: string, minOverlap?: number }} [options]
 */
export async function reverifyLessonClaims(targetRoot, markdown, options = {}) {
  const faithfulness = await assessClaimFaithfulness(targetRoot, markdown, {
    minOverlap: options.minOverlap,
  });
  const citations = extractLessonCitations(markdown);
  const citationCheck = await verifyLessonCitations(targetRoot, citations);
  const explicit = parseClaimsBlock(markdown);

  const problems = [];
  for (const p of citationCheck.problems ?? []) problems.push(p);
  // Explicit CLAIMS always block; auto mode also blocks on re-verify (stale lesson bar).
  for (const p of faithfulness.problems ?? []) problems.push(p);

  if (explicit.length === 0 && citations.length === 0) {
    problems.push("No CLAIMS block and no path:line citations to re-verify.");
  }

  return {
    ok: problems.length === 0,
    lessonPath: options.lessonPath ?? null,
    mode: faithfulness.mode,
    claimCount: explicit.length || faithfulness.assessments?.length || 0,
    citationCount: citations.length,
    assessments: faithfulness.assessments,
    problems: [...new Set(problems)],
  };
}

/**
 * Re-verify every lesson under a workbook lessons directory.
 *
 * @param {string} targetRoot
 * @param {string} lessonsDir
 * @param {{ minOverlap?: number }} [options]
 */
export async function reverifyWorkbookClaims(targetRoot, lessonsDir, options = {}) {
  const files = await listLessonMarkdown(lessonsDir);
  const lessons = [];
  for (const file of files) {
    let markdown = "";
    try {
      markdown = await readFile(file.path, "utf8");
    } catch {
      lessons.push({
        ok: false,
        lessonPath: file.path,
        mode: "unreadable",
        claimCount: 0,
        citationCount: 0,
        assessments: [],
        problems: [`Cannot read lesson: ${file.path}`],
      });
      continue;
    }
    lessons.push(
      await reverifyLessonClaims(targetRoot, markdown, {
        lessonPath: file.path,
        minOverlap: options.minOverlap,
      }),
    );
  }

  const failed = lessons.filter((l) => !l.ok);
  return {
    ok: failed.length === 0 && lessons.length > 0,
    empty: lessons.length === 0,
    lessonCount: lessons.length,
    failedCount: failed.length,
    lessons,
  };
}

/**
 * Relative path for CLI tables.
 * @param {string} targetRoot
 * @param {string|null} lessonPath
 */
export function displayLessonPath(targetRoot, lessonPath) {
  if (!lessonPath) return "(inline)";
  try {
    return relative(resolve(targetRoot), resolve(lessonPath)) || lessonPath;
  } catch {
    return lessonPath;
  }
}
