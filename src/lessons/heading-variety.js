/**
 * Mechanical anti-stamp gates for lesson titles and H2 headings.
 * Weak agents copy role labels ("The Mechanism", "Pitfall", "Try It") from shape
 * hints and error text. Scripts must reject that outline so every lesson invents
 * topic-specific headings.
 */

/** Exact normalized H2 labels that are teaching-role stamps, not subjects. */
export const STAMPED_HEADINGS = Object.freeze([
  "the mechanism",
  "mechanism",
  "how it works",
  "worked path",
  "walk the path",
  "walk the path in code",
  "read the whole mechanism",
  "entry to effect",
  "step by step",
  "in code",
  "pitfall",
  "the pitfall",
  "pitfalls",
  "the pitfall people miss",
  "trap",
  "the trap",
  "contrast",
  "what goes wrong",
  "what goes wrong if",
  "common mistake",
  "wrong model",
  "try it",
  "try it yourself",
  "check yourself",
  "your turn",
  "exercise",
  "challenge",
  "invariant",
  "the invariant",
  "takeaway",
  "the takeaway",
  "recap",
  "summary",
  "overview",
  "details",
  "introduction",
  "conclusion",
  "tricky part",
  "the tricky part",
  "bluf",
  "why this matters",
  "why it matters",
  "change safely",
  "change it safely",
]);

/** Planner teachingGoal strings that must not be pasted into learningMoments. */
export const PLANNER_BOILERPLATE_REASONS = Object.freeze([
  "distinguish the verified path from a plausible shortcut or wrong model",
  "make the learner predict a causal effect before revealing the mechanism",
  "turn a safe browser-observable behavior into a guided devtools variation with a reset",
]);

const ROLE_ONLY_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "to",
  "for",
  "and",
  "or",
  "if",
  "you",
  "your",
  "this",
  "that",
  "it",
  "its",
  "mechanism",
  "path",
  "worked",
  "walk",
  "read",
  "whole",
  "pitfall",
  "pitfalls",
  "trap",
  "miss",
  "people",
  "wrong",
  "goes",
  "what",
  "try",
  "yourself",
  "check",
  "exercise",
  "challenge",
  "turn",
  "invariant",
  "takeaway",
  "contrast",
  "how",
  "works",
  "step",
  "by",
  "common",
  "mistake",
  "safely",
  "change",
  "overview",
  "summary",
  "details",
  "introduction",
  "conclusion",
  "tricky",
  "part",
  "entry",
  "effect",
  "code",
  "model",
]);

const PATH_STOP = new Set([
  "app",
  "apps",
  "src",
  "lib",
  "libs",
  "core",
  "index",
  "main",
  "pkg",
  "packages",
  "internal",
  "shared",
  "common",
  "utils",
  "util",
  "helpers",
  "types",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rs",
]);

/**
 * @param {string} value
 */
export function normalizeHeading(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} heading
 */
export function isStampedHeading(heading) {
  const normalized = normalizeHeading(heading);
  if (!normalized) return true;
  if (STAMPED_HEADINGS.includes(normalized)) return true;
  // Role label with only filler words left after stripping role vocabulary.
  const tokens = normalized.split(" ").filter(Boolean);
  const content = tokens.filter((token) => !ROLE_ONLY_WORDS.has(token));
  if (tokens.length <= 4 && content.length === 0) return true;
  return false;
}

/**
 * Titles that are just Title Case of a path basename (e.g. "Core Api Http Client Ts").
 * @param {string} title
 * @param {string | null | undefined} focus
 */
export function isPathDerivedTitle(title, focus) {
  const normalizedTitle = normalizeHeading(title);
  if (!normalizedTitle || normalizedTitle.split(" ").length < 2) return false;

  const focusPath = String(focus ?? "")
    .replace(/^\.\//, "")
    .replaceAll("\\", "/");
  if (!focusPath) return false;

  const leaf = focusPath.split("/").pop() ?? "";
  const stem = leaf.replace(/\.[^.]+$/, "");
  const pathTokens = [...focusPath.replace(/\.[^.]+$/, "").split(/[/_.-]+/), ...stem.split(/[-_]/)]
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 1 && !PATH_STOP.has(token));

  if (pathTokens.length < 2) return false;

  const titleTokens = normalizedTitle.split(" ").filter(Boolean);
  const titleMeaningful = titleTokens.filter((token) => !PATH_STOP.has(token));
  if (titleMeaningful.length < 2) return false;

  const matched = titleMeaningful.filter((token) => pathTokens.includes(token));
  // Most non-stop title words come from the path, with almost no independent wording.
  return matched.length >= Math.ceil(titleMeaningful.length * 0.75) && matched.length >= 2;
}

/**
 * @param {string} reason
 */
export function isPlannerBoilerplateReason(reason) {
  const normalized = normalizeHeading(reason);
  if (!normalized) return false;
  return PLANNER_BOILERPLATE_REASONS.some(
    (boilerplate) =>
      normalized === boilerplate ||
      normalized.includes(boilerplate) ||
      boilerplate.includes(normalized),
  );
}

/**
 * @param {string[]} headings
 * @param {{ title?: string | null, focus?: string | null, sectionRoles?: { workedPath?: string, pitfall?: string, check?: string } }} [opts]
 */
export function inspectHeadingVariety(headings, opts = {}) {
  const errors = [];
  const warnings = [];
  const stamped = headings.filter((heading) => isStampedHeading(heading));
  if (stamped.length > 0) {
    errors.push(
      `Replace stamped role-label headings with topic-specific H2s: ${stamped.join(", ")}. Roles live in sectionRoles; visible headings must name this lesson's mechanism, failure, or job.`,
    );
  }

  const roles = opts.sectionRoles ?? {};
  for (const [role, heading] of Object.entries(roles)) {
    if (!heading) continue;
    if (isStampedHeading(heading)) {
      errors.push(
        `sectionRoles.${role} is still a role stamp ("${heading}"). Invent a heading that names this topic's concrete mechanism, failure, or learner job.`,
      );
    }
  }

  const requiredRoles = ["workedPath", "pitfall", "check"];
  const missingRoles = requiredRoles.filter((role) => !String(roles[role] ?? "").trim());
  if (missingRoles.length > 0) {
    errors.push(
      `Declare topic-specific sectionRoles (${missingRoles.join(", ")}) so H2s cannot fall back to generic Mechanism/Pitfall/Try It labels.`,
    );
  }

  if (opts.title && isPathDerivedTitle(opts.title, opts.focus)) {
    errors.push(
      `Title "${opts.title}" is a path basename in Title Case. Name the mechanism, decision, or consequence instead of restating the file path.`,
    );
  }

  // Same four-slot outline across lessons is the boredom failure mode.
  const normalizedSet = new Set(headings.map(normalizeHeading));
  if (
    normalizedSet.has("the mechanism") ||
    (normalizedSet.has("pitfall") && normalizedSet.has("try it")) ||
    (normalizedSet.has("the mechanism") && normalizedSet.has("invariant"))
  ) {
    errors.push(
      "Lesson uses the stamped Mechanism/Pitfall/Try It/Invariant outline. Rewrite every H2 for this topic before save.",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stamped,
  };
}
