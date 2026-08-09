/**
 * Readable + usefulness floors calibrated from golden A/B only.
 * See test/fixtures/golden-lessons/README.md sitting-size notes.
 */

import { GOLDEN_SITTING_SIZE } from "./lesson-shape.js";
import { parseLessonFrontmatter, craftFieldsFromFrontmatter } from "./lesson-frontmatter.js";
import { extractLessonCitations } from "./lesson-citation-check.js";

/** Broad review bands. Length is advisory and never blocks a save by itself. */
export const USEFULNESS_FLOORS = Object.freeze({
  source: "broad advisory bands informed by test/fixtures/golden-lessons, not save gates",
  wordCountBlocksSave: false,
  minBodyWords: {
    concise: 70,
    balanced: 150,
    deep: 300,
  },
  maxBodyWords: {
    concise: 900,
    balanced: 1800,
    deep: 2600,
  },
  minSections: 3,
  maxSections: 8,
  minLiveCitations: 1,
  forbidHollowOverview: true,
  golden: GOLDEN_SITTING_SIZE,
});

const HOLLOW =
  /\b(?:overview of the system|this lesson (?:will )?(?:explore|cover|discuss)|in this (?:lesson|section) we will|comprehensive overview|high-level overview of the entire)\b/i;

const NEXT_LOOK = /\b(?:next|then|after|open|look at|follow|cross into|start at|when you)\b/i;

function bodyWordCount(markdown) {
  const { body } = parseLessonFrontmatter(markdown);
  return (body || markdown)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`#>*_[\]()|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * @param {string} markdown
 * @param {{ depth?: "concise"|"balanced"|"deep", expectedPaths?: string[] }} [opts]
 */
export function inspectUsefulnessFloors(markdown, opts = {}) {
  const depth = opts.depth ?? "balanced";
  const errors = [];
  const warnings = [];
  const { frontmatter, body } = parseLessonFrontmatter(markdown);
  const craft = craftFieldsFromFrontmatter(frontmatter);
  const text = body || markdown;
  const words = bodyWordCount(markdown);
  const min = USEFULNESS_FLOORS.minBodyWords[depth] ?? USEFULNESS_FLOORS.minBodyWords.balanced;
  const max = USEFULNESS_FLOORS.maxBodyWords[depth] ?? USEFULNESS_FLOORS.maxBodyWords.balanced;
  if (words < min) {
    warnings.push(
      `Visible lesson prose has ${words} words, outside the broad ${depth} review band of ${min}–${max}. Length alone does not block save. Check that the mechanism has enough evidence and explanation.`,
    );
  }
  if (words > max) {
    warnings.push(
      `Visible lesson prose has ${words} words, outside the broad ${depth} review band of ${min}–${max}. Length alone does not block save. Split only when the lesson contains more than one teaching job.`,
    );
  }

  const headings = [...text.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  if (
    headings.length < USEFULNESS_FLOORS.minSections ||
    headings.length > USEFULNESS_FLOORS.maxSections
  ) {
    errors.push(
      `Lesson has ${headings.length} level-two sections; use ${USEFULNESS_FLOORS.minSections}–${USEFULNESS_FLOORS.maxSections}.`,
    );
  }

  // Plain-language open: first paragraph not hollow
  const withoutTitle = text.replace(/^#\s+.+\n+/, "");
  const first = withoutTitle.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("#"));
  if (!first || first.trim().split(/\s+/).length < 12) {
    errors.push("Open with plain-language mechanism + consequence (not a status log).");
  }
  if (HOLLOW.test(text)) {
    errors.push('Refuse hollow overview phrasing (e.g. "overview of the system").');
  }

  const citations = extractLessonCitations(markdown);
  const citedPaths = [
    ...new Set(citations.map((c) => String(c).replace(/:\d+$/, "").replace(/^\.\//, ""))),
  ];
  if (citedPaths.length < USEFULNESS_FLOORS.minLiveCitations) {
    errors.push("Cite at least one live project-relative path with a line number.");
  }

  // Concrete path + next look
  const pathToken =
    /`[^`]*\/[^`]+`|\b[\w.-]+\/[\w./-]+\.(?:js|ts|tsx|jsx|mjs|cjs|py)\b|\b[\w.-]+\.(?:js|ts|tsx|jsx)\b:\d+/;
  if (!pathToken.test(text) && craft.primaryPaths.length === 0) {
    errors.push("Name at least one concrete repo path the learner can open.");
  }
  if (!NEXT_LOOK.test(text)) {
    errors.push('Include a "next look" move (open/follow/then/start at) through real code.');
  }

  // Expected topic paths if provided
  const expected = opts.expectedPaths ?? craft.primaryPaths;
  if (Array.isArray(expected) && expected.length > 0) {
    const hit = expected.some((p) =>
      citedPaths.some((c) => c === p || c.endsWith(p) || p.endsWith(c) || text.includes(p)),
    );
    if (!hit) {
      errors.push("Lesson must touch at least one primary/topic path for this subject.");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    wordCount: words,
    sectionCount: headings.length,
    citedPaths,
    floors: USEFULNESS_FLOORS,
    craft,
  };
}
