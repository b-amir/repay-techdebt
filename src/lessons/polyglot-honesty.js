/**
 * Polyglot honesty: deep claims on unsupported relation languages fail or mark unsupported.
 * Cheap gate before full language packs.
 */

/** Languages with bundled local relation resolution (keep in sync with program-intelligence). */
export const SUPPORTED_RELATION_LANGUAGES = Object.freeze([
  "JavaScript",
  "TypeScript",
  "Python",
  "Gleam",
  "Elixir",
]);

const DEEP_CLAIM =
  /\b(?:call(?:s|ed|ers)?|consumer[s]?|import(?:s|ed|ers)?|dependenc(?:y|ies)|invok(?:e|es|ed)|call graph|downstream|upstream|who calls|entry.?to.?effect)\b/i;

/**
 * @param {string} markdown
 * @param {{ relationLanguagesUnsupported?: string[], relationLanguagesSupported?: string[], claimMode?: "deep"|"surface" }} [opts]
 */
export function checkPolyglotHonesty(markdown, opts = {}) {
  const unsupported = opts.relationLanguagesUnsupported ?? [];
  const errors = [];
  const warnings = [];

  if (unsupported.length === 0) {
    return { ok: true, errors, warnings, surfaceOnly: false };
  }

  const text = String(markdown ?? "");
  const marksUnsupported =
    /\bunsupported\b/i.test(text) ||
    /\bsurface[- ]only\b/i.test(text) ||
    /\bwithout (?:a )?(?:language-aware|compiler|LSP)\b/i.test(text) ||
    /\bcannot (?:prove|resolve|trace) (?:call|import|consumer)/i.test(text);

  const makesDeepClaim = DEEP_CLAIM.test(text) && opts.claimMode !== "surface";

  if (makesDeepClaim && !marksUnsupported) {
    errors.push(
      `Deep call/import claims need language-aware evidence; unsupported for: ${unsupported.join(", ")}. Mark surface-only/unsupported or drop the claim.`,
    );
  } else if (makesDeepClaim && marksUnsupported) {
    warnings.push("Deep claim marked unsupported/surface-only — OK for honesty.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    surfaceOnly: marksUnsupported,
    unsupportedLanguages: unsupported,
  };
}

/**
 * Whole-app absence claims forbidden under partial scope without mustNotClaim.
 * @param {string} markdown
 * @param {{ coverageStatus?: string, truncated?: boolean, mustNotClaim?: string[], scoped?: boolean }} [opts]
 */
export function checkAbsenceHonesty(markdown, opts = {}) {
  const errors = [];
  const text = String(markdown ?? "");
  const absence =
    /\bthere is no\b|\bno (?:other )?(?:callers?|consumers?|usages?|references?)\b|\bnever (?:called|used|imported)\b|\bonly (?:file|module) in the (?:app|system|codebase)\b/i;
  if (!absence.test(text)) return { ok: true, errors };

  const partial =
    opts.truncated === true ||
    opts.scoped === true ||
    opts.coverageStatus === "partial" ||
    opts.coverageStatus === "scoped-analysis" ||
    opts.coverageStatus === "truncated";

  const mustNot = new Set(opts.mustNotClaim ?? []);
  const allows =
    mustNot.has("whole-application-absence") ||
    mustNot.has("complete-call-graph") ||
    /\bpartial scope\b|\bwithin this scope\b|\bin the analyzed slice\b|\bnot whole[- ]app\b/i.test(
      text,
    );

  if (partial && !allows) {
    errors.push(
      'Whole-app absence claims need partial-scope wording or mustNotClaim ("whole-application-absence").',
    );
  }
  return { ok: errors.length === 0, errors, partial, allows };
}
