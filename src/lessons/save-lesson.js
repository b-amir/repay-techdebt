import { refuseSaveIfPathIncomplete } from "../dialogue/trajectory.js";
import { assessClaimFaithfulness } from "./claim-faithfulness.js";
import { verifyLessonCitations } from "./lesson-citation-check.js";
import { inspectLesson } from "./lesson-quality.js";
import { hasPassingJudgment } from "./lesson-judgment.js";
import { parseLessonFrontmatter, craftFieldsFromFrontmatter } from "./lesson-frontmatter.js";
import { inspectLessonShape, checkMapXor } from "./lesson-shape.js";
import { inspectUsefulnessFloors } from "./usefulness-floors.js";
import { checkDiagramGate } from "./diagram-gate.js";
import { checkSubjectPathGate, checkAntiClone } from "./subject-path-gate.js";
import { checkPolyglotHonesty, checkAbsenceHonesty } from "./polyglot-honesty.js";

/**
 * Mechanical floors for saving a lesson (trajectory + craft + quality + citations + faithfulness).
 * Does not write files or run Secretlint — callers own persistence and secrets.
 * Incomplete path → refuse (ok false); no soft "continue weaker?" escape.
 *
 * @returns {Promise<{ ok: boolean, quality: object, faithfulness: object, trajectory?: object, craft?: object }>}
 */
export async function evaluateLessonForSave(targetRoot, content, options = {}) {
  const quality = inspectLesson(content, {
    depth: options.depth ?? "balanced",
    expectedEvidencePaths: options.expectedEvidencePaths ?? [],
  });

  const { frontmatter } = parseLessonFrontmatter(content);
  const craftFields = craftFieldsFromFrontmatter(frontmatter);
  const subject =
    options.subject ?? craftFields.subject ?? options.topic?.subject ?? options.topic?.kind;
  const hasMapAnswers =
    options.hasMapAnswers === true ||
    (typeof craftFields.mapAnswers === "string" && craftFields.mapAnswers.trim().length > 0);

  // Fail-closed trajectory. Require gate input; missing gate = incomplete path.
  const gateInput = options.trajectoryGate ?? options.gate ?? options.trajectory ?? null;
  const pathRefuse = refuseSaveIfPathIncomplete(gateInput, {
    subject,
    hasMapAnswers,
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

  // Craft floors (shape, map xor, usefulness, diagram, subject path, anti-clone, honesty)
  const craft = {
    shape: null,
    mapXor: null,
    usefulness: null,
    diagram: null,
    subjectPath: null,
    antiClone: null,
    polyglot: null,
    absence: null,
  };

  if (options.skipCraftFloors !== true) {
    craft.shape = inspectLessonShape(content, { subject });
    if (!craft.shape.ok) {
      quality.ok = false;
      quality.errors.push(...craft.shape.errors);
    }

    craft.mapXor = checkMapXor({
      subject,
      mapAnswers: craftFields.mapAnswers,
      skipReasons: craftFields.skipReasons,
    });
    if (!craft.mapXor.ok) {
      quality.ok = false;
      quality.errors.push(...craft.mapXor.errors);
    }

    craft.usefulness = inspectUsefulnessFloors(content, {
      depth: options.depth ?? "balanced",
      expectedPaths: options.expectedEvidencePaths ?? craftFields.primaryPaths,
    });
    if (!craft.usefulness.ok) {
      quality.ok = false;
      quality.errors.push(...craft.usefulness.errors);
    }

    const inventoryPaths =
      options.inventoryPaths ??
      options.inventory?.files?.map((f) => (typeof f === "string" ? f : f.path)) ??
      null;
    craft.diagram = checkDiagramGate(content, {
      inventory: inventoryPaths ?? options.inventory,
      mapAnswers: craftFields.mapAnswers,
    });
    if (!craft.diagram.ok) {
      quality.ok = false;
      quality.errors.push(...craft.diagram.errors);
    }

    craft.subjectPath = checkSubjectPathGate({
      topicPath: options.topicPath ?? options.topic?.path,
      primaryPaths: craftFields.primaryPaths,
      evidencePaths: options.expectedEvidencePaths ?? options.topic?.evidencePaths,
      inventoryPaths: inventoryPaths ?? [],
      pins: options.pins ?? [],
      focus: options.topic?.focus ?? options.focus,
    });
    if (!craft.subjectPath.ok) {
      quality.ok = false;
      quality.errors.push(...craft.subjectPath.errors);
    }

    if (Array.isArray(options.priorLessons) && options.priorLessons.length > 0) {
      craft.antiClone = checkAntiClone(
        {
          citations: quality.citations,
          primaryPaths: craftFields.primaryPaths,
        },
        options.priorLessons,
      );
      if (!craft.antiClone.ok) {
        quality.ok = false;
        quality.errors.push(...craft.antiClone.errors);
      }
    }

    craft.polyglot = checkPolyglotHonesty(content, {
      relationLanguagesUnsupported: options.relationLanguagesUnsupported ?? [],
      claimMode: options.claimMode,
    });
    if (!craft.polyglot.ok) {
      quality.ok = false;
      quality.errors.push(...craft.polyglot.errors);
    }

    craft.absence = checkAbsenceHonesty(content, {
      coverageStatus: options.coverageStatus,
      truncated: options.truncated,
      scoped: options.scoped,
      mustNotClaim: options.mustNotClaim,
    });
    if (!craft.absence.ok) {
      quality.ok = false;
      quality.errors.push(...craft.absence.errors);
    }
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

  return { ok: quality.ok, quality, faithfulness, trajectory, craft };
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

  let goldenInput = null;
  if (options.loadGoldens) {
    const { loadGoldenDraftInput } = await import("./lesson-shape.js");
    goldenInput = await loadGoldenDraftInput(options.skillRoot);
  }

  // Shape is report-only here; durable save enforces craft via evaluateLessonForSave.
  const shape = inspectLessonShape(markdown, { subject: options.subject });
  if (!shape.ok) {
    quality.warnings = [...(quality.warnings ?? []), ...shape.errors];
  }

  return {
    floorOk: quality.ok,
    quality,
    citations,
    faithfulness,
    shape,
    goldenInput,
  };
}
