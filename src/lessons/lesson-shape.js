/**
 * Default-path lesson shape contract (templates-as-data).
 * Required teaching moves: hook → map|skipReason → worked path → pitfall → check-yourself.
 * Goldens under test/fixtures/golden-lessons are required draft input for the teach handshake.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLessonFrontmatter, craftFieldsFromFrontmatter } from "./lesson-frontmatter.js";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(here, "../..");

/** Fixed default-path section roles (order matters for checks). */
export const DEFAULT_PATH_SECTIONS = Object.freeze([
  {
    id: "hook",
    role: "hook",
    required: true,
    /** First non-empty prose block after title; not a ## heading requirement. */
    detect: "opening-prose",
  },
  {
    id: "map",
    role: "map-or-skip",
    required: true,
    detect: "mapAnswers-xor-skipReasons.map",
  },
  {
    id: "worked-path",
    role: "worked-path",
    required: true,
    headingHints: [
      /walk the path/i,
      /read the whole mechanism/i,
      /entry to effect/i,
      /worked/i,
      /trace/i,
      /in code/i,
      /mechanism/i,
      /how it works/i,
      /step by step/i,
    ],
  },
  {
    id: "pitfall",
    role: "pitfall",
    required: true,
    headingHints: [
      /pitfall/i,
      /trap/i,
      /miss/i,
      /breaks if/i,
      /wrong/i,
      /contrast/i,
      /common mistake/i,
      /simplify/i,
      /what goes wrong/i,
    ],
  },
  {
    id: "check-yourself",
    role: "check-yourself",
    required: true,
    headingHints: [/check yourself/i, /try it/i, /your turn/i, /exercise/i, /challenge/i],
  },
]);

/** Subjects that need mapAnswers xor skipReasons.map (same set as trajectory MAP_REQUIRED). */
export const MAP_SUBJECTS = Object.freeze([
  "architecture",
  "flow",
  "structure",
  "dependency",
  "architecture-orientation",
  "end-to-end-flow",
  "dependency-ecosystem",
]);

/** Paths relative to skill root — teach handshake must load these before draft. */
export const GOLDEN_LESSON_PATHS = Object.freeze({
  pathWithMap: "test/fixtures/golden-lessons/a-path-with-map/lesson.md",
  deepDive: "test/fixtures/golden-lessons/b-deep-dive/lesson.md",
  craftPairs: "test/fixtures/golden-lessons/craft-pairs.md",
  readme: "test/fixtures/golden-lessons/README.md",
  targetRoot: "test/fixtures/golden-lessons/target",
});

/**
 * Sitting-size notes observed from golden A/B only (1.3 floors derive from these).
 * A path+map ~450 body words / 5 H2; B deep-dive ~380 / 4 H2.
 */
export const GOLDEN_SITTING_SIZE = Object.freeze({
  pathWithMap: { approxWords: 450, sections: 5, depth: "balanced", minutes: "6-8" },
  deepDive: { approxWords: 380, sections: 4, depth: "concise", minutes: "4-6" },
  /** Default-path sitting claim. */
  productMinutes: "5-10",
});

/**
 * Absolute paths for golden draft input.
 * @param {string} [root]
 */
export function resolveGoldenPaths(root = skillRoot) {
  return {
    pathWithMap: resolve(root, GOLDEN_LESSON_PATHS.pathWithMap),
    deepDive: resolve(root, GOLDEN_LESSON_PATHS.deepDive),
    craftPairs: resolve(root, GOLDEN_LESSON_PATHS.craftPairs),
    readme: resolve(root, GOLDEN_LESSON_PATHS.readme),
    targetRoot: resolve(root, GOLDEN_LESSON_PATHS.targetRoot),
  };
}

/**
 * Load golden A/B + craft pairs for teach handshake few-shot.
 * @param {string} [root]
 */
export async function loadGoldenDraftInput(root = skillRoot) {
  const paths = resolveGoldenPaths(root);
  const [pathWithMap, deepDive, craftPairs] = await Promise.all([
    readFile(paths.pathWithMap, "utf8"),
    readFile(paths.deepDive, "utf8"),
    readFile(paths.craftPairs, "utf8"),
  ]);
  return {
    paths,
    lessons: {
      pathWithMap,
      deepDive,
    },
    craftPairs,
    sittingSize: GOLDEN_SITTING_SIZE,
    sectionContract: DEFAULT_PATH_SECTIONS,
  };
}

/**
 * Detect H2 headings.
 * @param {string} markdown
 */
export function listLevelTwoHeadings(markdown) {
  return [...String(markdown ?? "").matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
}

/**
 * Check default-path shape: required teaching moves present.
 * Map xor is checked separately via checkMapXor (1.2).
 *
 * @param {string} markdown
 * @param {{ subject?: string, strictMap?: boolean }} [opts]
 */
export function inspectLessonShape(markdown, opts = {}) {
  const { frontmatter, body } = parseLessonFrontmatter(markdown);
  const craft = craftFieldsFromFrontmatter(frontmatter);
  const subject = (opts.subject ?? craft.subject ?? "").toLowerCase();
  const headings = listLevelTwoHeadings(body || markdown);
  const errors = [];
  const warnings = [];

  // Hook: first screenful of prose after optional # title
  const withoutTitle = (body || markdown).replace(/^#\s+.+\n+/, "");
  const firstBlock = withoutTitle
    .split(/\n\s*\n/)
    .find((p) => p.trim() && !p.trim().startsWith("#"));
  if (!firstBlock || firstBlock.trim().split(/\s+/).length < 12) {
    errors.push(
      "Lesson needs a plain-language hook (opening prose stating mechanism + consequence).",
    );
  }

  const mapXor = checkMapXor({
    subject,
    mapAnswers: craft.mapAnswers,
    skipReasons: craft.skipReasons,
    forceMapSubject: opts.strictMap === true,
  });
  if (!mapXor.ok) errors.push(...mapXor.errors);

  const hasHeading = (hints) => headings.some((h) => hints.some((re) => re.test(h)));

  if (!hasHeading(DEFAULT_PATH_SECTIONS.find((s) => s.id === "worked-path").headingHints)) {
    errors.push(
      "Lesson needs a worked-path section (walk the path / mechanism / in code / trace).",
    );
  }
  if (!hasHeading(DEFAULT_PATH_SECTIONS.find((s) => s.id === "pitfall").headingHints)) {
    errors.push("Lesson needs a pitfall/contrast section (what breaks, trap, wrong model).");
  }
  if (!hasHeading(DEFAULT_PATH_SECTIONS.find((s) => s.id === "check-yourself").headingHints)) {
    errors.push("Lesson needs a Check yourself / try-it section that names a real file or symbol.");
  } else {
    // Check-yourself must name a path-like token or known primary path
    const checkSection = extractSection(
      body || markdown,
      /check yourself|try it|your turn|exercise|challenge/i,
    );
    const pathLike =
      /`[^`]+\/[^`]+`|\b[\w.-]+\.(?:js|ts|tsx|jsx|py|go|rs|java|kt|rb|php|cs)\b|\b[\w-]+\/[\w./-]+/i;
    const primaryHit = craft.primaryPaths.some((p) => checkSection.includes(p));
    if (!pathLike.test(checkSection) && !primaryHit) {
      errors.push("Check-yourself must name a real file or symbol from this repo.");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    subject,
    craft,
    headings,
    sectionContract: DEFAULT_PATH_SECTIONS,
  };
}

/**
 * mapAnswers xor skipReasons.map for architecture/flow/structure/dependency subjects.
 * @param {{ subject?: string, mapAnswers?: string | null, skipReasons?: { map?: string }, forceMapSubject?: boolean }} input
 */
export function checkMapXor(input = {}) {
  const subject = String(input.subject ?? "").toLowerCase();
  const needsMap =
    input.forceMapSubject === true ||
    MAP_SUBJECTS.some((s) => subject === s || subject.includes(s));
  if (!needsMap) {
    return { ok: true, errors: [], required: false, hasMapAnswers: false, hasMapSkip: false };
  }
  const hasMapAnswers = typeof input.mapAnswers === "string" && input.mapAnswers.trim().length > 0;
  const hasMapSkip =
    typeof input.skipReasons?.map === "string" && input.skipReasons.map.trim().length > 0;
  if (hasMapAnswers && hasMapSkip) {
    return {
      ok: false,
      errors: ["Provide mapAnswers or skipReasons.map, not both."],
      required: true,
      hasMapAnswers,
      hasMapSkip,
    };
  }
  if (!hasMapAnswers && !hasMapSkip) {
    return {
      ok: false,
      errors: [
        "Architecture/flow/structure subjects need mapAnswers (structure question answered) or skipReasons.map.",
      ],
      required: true,
      hasMapAnswers,
      hasMapSkip,
    };
  }
  return { ok: true, errors: [], required: true, hasMapAnswers, hasMapSkip };
}

/**
 * @param {string} markdown
 * @param {RegExp} headingRe
 */
function extractSection(markdown, headingRe) {
  const parts = String(markdown).split(/^##\s+/m);
  for (const part of parts) {
    const first = part.split("\n")[0] ?? "";
    if (headingRe.test(first)) return part;
  }
  return "";
}
