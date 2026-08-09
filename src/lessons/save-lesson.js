import { refuseSaveIfPathIncomplete } from "../dialogue/trajectory.js";
import { assessClaimFaithfulness } from "./claim-faithfulness.js";
import { verifyLessonCitations } from "./lesson-citation-check.js";
import { inspectLesson } from "./lesson-quality.js";
import { hasPassingJudgment } from "./lesson-judgment.js";
import { parseLessonFrontmatter, craftFieldsFromFrontmatter } from "./lesson-frontmatter.js";
import { checkMapXor } from "./lesson-shape.js";
import { inspectUsefulnessFloors } from "./usefulness-floors.js";
import { checkDiagramGate } from "./diagram-gate.js";
import { checkSubjectPathGate, checkAntiClone, checkPrPrimaryPaths } from "./subject-path-gate.js";
import { checkPolyglotHonesty, checkAbsenceHonesty } from "./polyglot-honesty.js";
import { validateMermaidSyntax } from "./mermaid-validation.js";

/**
 * Mechanical floors for saving a lesson (trajectory + craft + quality + citations + faithfulness).
 * Does not write files or run Secretlint - callers own persistence and secrets.
 * Incomplete path → refuse (ok false); no soft "continue weaker?" escape.
 *
 * @returns {Promise<{ ok: boolean, quality: object, faithfulness: object, trajectory?: object, craft?: object }>}
 */
export async function evaluateLessonForSave(targetRoot, content, options = {}) {
  const { frontmatter } = parseLessonFrontmatter(content);
  const craftFields = craftFieldsFromFrontmatter(frontmatter);
  const subject =
    options.subject ?? craftFields.subject ?? options.topic?.subject ?? options.topic?.kind;
  const visualSubjects = new Set([
    "architecture",
    "architecture-orientation",
    "change-impact",
    "data-state",
    "end-to-end-flow",
    "flow",
    "security-boundary",
    "state-lifecycle",
  ]);
  const quality = inspectLesson(content, {
    depth: options.depth ?? "balanced",
    expectedEvidencePaths: options.expectedEvidencePaths ?? [],
    subject,
    requireLearningMomentDecisions: options.requireLearningMomentDecisions === true,
  });
  const citationVerification = await verifyLessonCitations(targetRoot, quality.citations);
  const verifiedCitationPaths =
    citationVerification.problems.length === 0 ? quality.evidencePaths : [];
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
    gate: pathRefuse.check.gate,
    mapEvidence: hasMapAnswers ? "lesson-frontmatter" : "trajectory-or-skip",
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
    prPaths: null,
    polyglot: null,
    absence: null,
    learningMoments: quality.learningMoments,
  };

  if (options.skipCraftFloors !== true) {
    craft.shape = quality.shape;

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
      expectedPaths:
        craftFields.primaryPaths.length > 0 ? craftFields.primaryPaths : verifiedCitationPaths,
    });
    const qualityHasLengthWarning = quality.warnings.some((warning) =>
      /length alone does not block save/i.test(warning),
    );
    for (const warning of craft.usefulness.warnings) {
      if (qualityHasLengthWarning && /length alone does not block save/i.test(warning)) continue;
      if (!quality.warnings.includes(warning)) quality.warnings.push(warning);
    }
    if (!craft.usefulness.ok) {
      quality.ok = false;
      quality.errors.push(...craft.usefulness.errors);
    }

    const suppliedInventoryPaths =
      options.inventoryPaths ??
      options.inventory?.files?.map((f) => (typeof f === "string" ? f : f.path)) ??
      [];
    const inventoryPaths = [...new Set([...suppliedInventoryPaths, ...verifiedCitationPaths])];
    craft.diagram = checkDiagramGate(content, {
      inventory: inventoryPaths.length > 0 ? inventoryPaths : options.inventory,
      mapAnswers: craftFields.mapAnswers,
    });
    if (!craft.diagram.ok) {
      quality.ok = false;
      quality.errors.push(...craft.diagram.errors);
    }
    craft.diagram.syntax = await validateMermaidSyntax(content);
    if (!craft.diagram.syntax.ok) {
      quality.ok = false;
      quality.errors.push(...craft.diagram.syntax.errors);
    }
    const decision = craftFields.diagramDecision;
    if (visualSubjects.has(String(subject)) && !decision) {
      quality.ok = false;
      quality.errors.push(
        "Visual lesson subjects must declare diagramDecision: required, recommended, or omit from the verified lesson plan.",
      );
    } else if (decision && !["required", "recommended", "omit"].includes(decision)) {
      quality.ok = false;
      quality.errors.push("diagramDecision must be required, recommended, or omit.");
    } else if (decision === "required" && craft.diagram.blockCount === 0) {
      quality.ok = false;
      quality.errors.push("The verified lesson plan requires a diagram, but the draft has none.");
    } else if (decision === "omit" && craft.diagram.blockCount > 0) {
      quality.ok = false;
      quality.errors.push("diagramDecision is omit, but the draft contains a Mermaid diagram.");
    } else if (
      (decision === "omit" || (decision === "recommended" && craft.diagram.blockCount === 0)) &&
      !craftFields.diagramReason
    ) {
      quality.ok = false;
      quality.errors.push("Omitting a planned visual needs a concrete diagramReason.");
    }

    craft.subjectPath = checkSubjectPathGate({
      topicPath: options.topicPath ?? options.topic?.path,
      primaryPaths: craftFields.primaryPaths,
      evidencePaths: verifiedCitationPaths,
      inventoryPaths,
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

    const changedPaths =
      options.changedPaths ?? options.prChangedPaths ?? options.diffPaths ?? null;
    if (Array.isArray(changedPaths) && changedPaths.length > 0) {
      craft.prPaths = checkPrPrimaryPaths(
        {
          primaryPaths: craftFields.primaryPaths,
          citations: quality.citations,
          evidencePaths: verifiedCitationPaths,
        },
        changedPaths,
      );
      if (!craft.prPaths.ok) {
        quality.ok = false;
        quality.errors.push(...craft.prPaths.errors);
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

  quality.evidenceProblems = citationVerification.problems;
  if (quality.evidenceProblems.length > 0) {
    quality.ok = false;
    quality.errors.push("Every source citation must resolve to a current target file and line.");
  }
  const faithfulness = await assessClaimFaithfulness(targetRoot, content);
  quality.faithfulness = {
    mode: faithfulness.mode,
    ok: faithfulness.ok,
    verificationKind: faithfulness.verificationKind,
    semanticReviewRequired: faithfulness.semanticReviewRequired,
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
      quality.errors.push(`Reviewer judgment missing or failed: ${judgment.reason}`);
    }
  } else {
    quality.ok = false;
    quality.errors.push(
      "Reviewer judgment missing (no draftPath provided to evaluateLessonForSave).",
    );
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
    subject: options.subject,
    requireLearningMomentDecisions: options.requireLearningMomentDecisions === true,
  });
  const citations = await verifyLessonCitations(targetRoot, quality.citations);
  if (citations.problems.length > 0) {
    quality.ok = false;
    quality.errors.push(...citations.problems);
  }
  quality.diagramSyntax = await validateMermaidSyntax(markdown);
  if (!quality.diagramSyntax.ok) {
    quality.ok = false;
    quality.errors.push(...quality.diagramSyntax.errors);
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
  const shape = quality.shape;

  return {
    floorOk: quality.ok,
    quality,
    citations,
    faithfulness,
    shape,
    goldenInput,
  };
}
