import { refuseSaveIfPathIncomplete } from "../dialogue/trajectory.js";
import { assessClaimFaithfulness } from "./claim-faithfulness.js";
import { verifyLessonCitations } from "./lesson-citation-check.js";
import { inspectLesson } from "./lesson-quality.js";
import { hasPassingJudgment } from "./lesson-judgment.js";

/**
 * Mechanical floors for saving a lesson (trajectory gate + quality + citations + faithfulness).
 * Does not write files or run Secretlint — callers own persistence and secrets.
 * Incomplete path → refuse (ok false); no soft "continue weaker?" escape.
 *
 * @returns {Promise<{ ok: boolean, quality: object, faithfulness: object, trajectory?: object }>}
 */
export async function evaluateLessonForSave(targetRoot, content, options = {}) {
  const quality = inspectLesson(content, {
    depth: options.depth ?? "balanced",
    expectedEvidencePaths: options.expectedEvidencePaths ?? [],
  });

  // Fail-closed trajectory. Require gate input; missing gate = incomplete path.
  const gateInput =
    options.trajectoryGate ?? options.gate ?? options.trajectory ?? null;
  const pathRefuse = refuseSaveIfPathIncomplete(gateInput, {
    subject: options.subject,
    hasMapAnswers: options.hasMapAnswers,
  });
  const trajectory = {
    pathComplete: pathRefuse.check.pathComplete,
    missing: pathRefuse.check.missing,
    refuse: pathRefuse.refuse,
    reason: pathRefuse.reason,
    code: pathRefuse.code,
  };
  if (pathRefuse.refuse) {
    quality.ok = false;
    quality.errors.push(pathRefuse.reason ?? "Learning path incomplete; durable save blocked.");
  }

  quality.evidenceProblems = (await verifyLessonCitations(targetRoot, quality.citations)).problems;
  if (quality.evidenceProblems.length > 0) {
    quality.ok = false;
    quality.errors.push("Every source citation must resolve to a current target file and line.");
  }
  const faithfulness = await assessClaimFaithfulness(targetRoot, content);
  quality.faithfulness = {
    mode: faithfulness.mode,
    ok: faithfulness.ok,
    problems: faithfulness.problems,
  };
  if (faithfulness.mode === "explicit-claims" && faithfulness.problems.length > 0) {
    quality.ok = false;
    quality.errors.push(...faithfulness.problems);
  } else if (faithfulness.problems.length > 0) {
    quality.warnings = [...(quality.warnings ?? []), ...faithfulness.problems];
  }

  if (options.draftPath) {
    const judgment = await hasPassingJudgment(options.draftPath);
    if (!judgment.ok) {
      quality.ok = false;
      quality.errors.push(`AI Judgment missing or failed: ${judgment.reason}`);
    }
  } else {
    quality.ok = false;
    quality.errors.push("AI Judgment missing (no draftPath provided to evaluateLessonForSave).");
  }

  return { ok: quality.ok, quality, faithfulness, trajectory };
}

/**
 * Teach handshake floors for report/CI (quality + citations + faithfulness + pedagogy).
 * Citation/quality failures always fail floorOk (same as evaluate-lesson CLI).
 * Faithfulness only fails floorOk when options.strictFaithfulness is set.
 */
export async function runTeachFloors(targetRoot, markdown, options = {}) {
  const depth = options.depth ?? "balanced";
  const quality = inspectLesson(markdown, {
    depth,
    expectedEvidencePaths: options.expectedEvidencePaths ?? [],
  });
  const citations = await verifyLessonCitations(targetRoot, quality.citations);
  if (citations.problems.length > 0) {
    quality.ok = false;
    quality.errors.push(...citations.problems);
  }
  const faithfulness = await assessClaimFaithfulness(targetRoot, markdown);
  if (options.strictFaithfulness && faithfulness.problems.length > 0) {
    quality.ok = false;
    quality.errors.push(...faithfulness.problems);
  }
  // Optional check, as evaluate-lesson does not enforce AI judgment by itself,
  // but we can surface it if it exists.
  return {
    floorOk: quality.ok,
    quality,
    citations,
    faithfulness,
  };
}
