import { lstat, readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { isSameOrInside } from "../foundations/targeting.js";
import {
  EVIDENCE_CITATION,
  extractAmbiguousCitationShorthand,
  extractCitationReferences,
  parseCitation,
} from "./citation-model.js";

export { EVIDENCE_CITATION };

/** Extract unique path:line or path:start-end citations from lesson markdown. */
export function extractLessonCitations(markdown) {
  return extractCitationReferences(markdown).map((citation) => citation.label);
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
  if (!Array.isArray(markdownOrCitations)) {
    for (const shorthand of extractAmbiguousCitationShorthand(markdownOrCitations)) {
      problems.push(
        `${shorthand} is ambiguous source shorthand; repeat the project-relative path, for example path/to/file.ts:${shorthand.replace(/[–—]/g, "-")}`,
      );
    }
  }
  const canonicalRoot = await realpath(targetRoot);
  for (const citation of citations) {
    const parsed = parseCitation(citation);
    if (!parsed) {
      problems.push(`${citation} is not a path:line or path:start-end citation`);
      continue;
    }
    const requested = resolve(canonicalRoot, parsed.path);
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
      if (parsed.endLine > lineCount)
        problems.push(`${citation} exceeds the file's ${lineCount} lines`);
    } catch {
      problems.push(`${citation} does not resolve to a current target file`);
    }
  }
  return { ok: problems.length === 0, citations, problems };
}
