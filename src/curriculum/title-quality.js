import { titleFor } from "./curriculum-planning.js";
import { isPathDerivedTitle } from "../lessons/heading-variety.js";

/**
 * Titles that are planner placeholders or Title-Cased path basenames.
 * Recreate/save must rewrite these before learner-facing persistence.
 * @param {string} title
 * @param {string | null | undefined} focus
 * @param {string | null | undefined} [kind]
 */
export function isWeakCurriculumTitle(title, focus, kind = null) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed || !focus) return !trimmed;
  if (kind && trimmed === titleFor(kind, focus)) return true;
  return isPathDerivedTitle(trimmed, focus);
}
