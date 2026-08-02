import { lstat, readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { isSameOrInside } from "./targeting.js";

export const EVIDENCE_CITATION =
  /(?:^|[\s`(])([A-Za-z0-9_.@+-]+(?:\/[A-Za-z0-9_.@+()[\]-]+)+\.[A-Za-z0-9]+):([1-9]\d*)(?:-[1-9]\d*)?(?=$|[\s`),.;])/gm;

/** Extract unique path:line citations from lesson markdown. */
export function extractLessonCitations(markdown) {
  return [
    ...new Set(
      [...String(markdown).matchAll(EVIDENCE_CITATION)].map(
        (match) => `${match[1]}:${match[2]}`,
      ),
    ),
  ];
}

/**
 * Verify citations resolve to files inside targetRoot with valid line numbers.
 * @returns {Promise<{ ok: boolean, citations: string[], problems: string[] }>}
 */
export async function verifyLessonCitations(targetRoot, markdownOrCitations) {
  const citations = Array.isArray(markdownOrCitations)
    ? markdownOrCitations
    : extractLessonCitations(markdownOrCitations);
  const problems = [];
  const canonicalRoot = await realpath(targetRoot);
  for (const citation of citations) {
    const match = citation.match(/^(.*):([1-9]\d*)$/);
    if (!match) {
      problems.push(`${citation} is not a path:line citation`);
      continue;
    }
    const requested = resolve(canonicalRoot, match[1]);
    try {
      const canonical = await realpath(requested);
      if (!isSameOrInside(canonical, canonicalRoot)) {
        problems.push(`${citation} resolves outside the target`);
        continue;
      }
      const details = await lstat(canonical);
      if (!details.isFile()) {
        problems.push(`${citation} is not a source file`);
        continue;
      }
      const lineCount = (await readFile(canonical, "utf8")).split(/\r?\n/).length;
      if (Number(match[2]) > lineCount)
        problems.push(`${citation} exceeds the file's ${lineCount} lines`);
    } catch {
      problems.push(`${citation} does not resolve to a current target file`);
    }
  }
  return { ok: problems.length === 0, citations, problems };
}
