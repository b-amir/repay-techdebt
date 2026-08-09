const CITATION_PATH_SOURCE = "[A-Za-z0-9_.@+-]+(?:\\/[A-Za-z0-9_.@+()\\[\\]-]+)+\\.[A-Za-z0-9]+";
const CITATION_LINE_SOURCE = "[1-9]\\d*";
const CITATION_RANGE_SEPARATOR_SOURCE = "[-–—]";

/** Matches source citations embedded in prose. Capture 1 is the complete citation. */
export const EVIDENCE_CITATION = new RegExp(
  `(?:^|[\\s\`(])(${CITATION_PATH_SOURCE}:${CITATION_LINE_SOURCE}(?:${CITATION_RANGE_SEPARATOR_SOURCE}${CITATION_LINE_SOURCE})?)(?=$|[\\s\`),.;])`,
  "gm",
);

const COMPLETE_CITATION = new RegExp(
  `^(${CITATION_PATH_SOURCE}):(${CITATION_LINE_SOURCE})(?:${CITATION_RANGE_SEPARATOR_SOURCE}(${CITATION_LINE_SOURCE}))?$`,
);

/**
 * Parse and normalize one self-contained path:line or path:start-end citation.
 * Typographic range dashes are accepted as input but serialized as ASCII.
 */
export function parseCitation(raw) {
  const match = String(raw ?? "")
    .trim()
    .match(COMPLETE_CITATION);
  if (!match) return null;
  const startLine = Number(match[2]);
  const endLine = match[3] ? Number(match[3]) : startLine;
  if (endLine < startLine) return null;
  const path = match[1];
  const label = `${path}:${startLine}${endLine === startLine ? "" : `-${endLine}`}`;
  return { path, startLine, endLine, label, key: label };
}

/** Extract unique citations in their normalized, self-contained form. */
export function extractCitationReferences(markdown) {
  const citations = [];
  const seen = new Set();
  for (const match of String(markdown ?? "").matchAll(EVIDENCE_CITATION)) {
    const citation = parseCitation(match[1]);
    if (!citation || seen.has(citation.key)) continue;
    seen.add(citation.key);
    citations.push(citation);
  }
  return citations;
}

/** Find backticked line-range shorthand that omits its source path. */
export function extractAmbiguousCitationShorthand(markdown) {
  const text = String(markdown ?? "");
  const shorthand = [];
  for (const match of text.matchAll(/`([1-9]\d*[-–—][1-9]\d*)`/g)) {
    const before = text.slice(Math.max(0, (match.index ?? 0) - 180), match.index);
    if (!extractCitationReferences(before).length) continue;
    if (!/(?:,|\band|\bthen)\s*$/i.test(before)) continue;
    shorthand.push(match[1]);
  }
  return [...new Set(shorthand)];
}
