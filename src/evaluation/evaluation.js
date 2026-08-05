/**
 * Evaluates a generated curriculum against expected topics.
 *
 * @param {Object} curriculum The generated curriculum containing topics.
 * @param {Object} expectations The expected fixture definitions (EvaluationFixtureSchema).
 * @returns {Object} Report containing missing, extra, and matched topics.
 */
export function evaluateCurriculum(curriculum, expectations) {
  const generatedTopicIds = new Set(
    curriculum.topics.map((t) => t.id || t.title || t.name || t.focus),
  );

  const mustFind = expectations.topics.filter((t) => t.intent === "must-find");
  const forbidden = expectations.topics.filter((t) => t.intent === "forbidden");

  const presentForbidden = forbidden.filter((t) => generatedTopicIds.has(t.id));
  const focusBlob = curriculum.topics.map((t) => `${t.focus ?? ""} ${t.title ?? ""}`).join("\n");
  const missingMustFind = mustFind.filter((t) => {
    if (generatedTopicIds.has(t.id)) return false;
    if (t.matchFocus && new RegExp(t.matchFocus, "i").test(focusBlob)) return false;
    return true;
  });

  const ok = missingMustFind.length === 0 && presentForbidden.length === 0;

  return {
    ok,
    missingMustFind,
    presentForbidden,
    totalExpected: mustFind.length,
    totalGenerated: generatedTopicIds.size,
  };
}

/**
 * Score whether a curriculum proposal is dialogue-shaped (script propose, not silent oracle).
 */
export function evaluateDialogueProposal(curriculum, expectations = {}) {
  const errors = [];
  if (curriculum.role !== "propose")
    errors.push("Curriculum proposal must set role=propose for agent shortlist turns.");
  if (!Array.isArray(curriculum.nextAsks) || curriculum.nextAsks.length === 0)
    errors.push("Curriculum proposal must include nextAsks for the agent.");
  if (!Array.isArray(curriculum.blindSpots))
    errors.push("Curriculum proposal must expose blindSpots.");
  if (!Array.isArray(curriculum.mustNotClaim) || curriculum.mustNotClaim.length === 0)
    errors.push("Curriculum proposal must include mustNotClaim.");

  const naming = (curriculum.topics ?? []).filter(
    (topic) => (topic.signalClass ?? "naming-heuristic") === "naming-heuristic",
  );
  if (expectations.requireNamingHeuristicDemotion) {
    const demotedReasons = naming.filter((topic) =>
      (topic.importanceReasons ?? []).some((reason) => /naming-heuristic/i.test(reason)),
    );
    if (naming.length > 0 && demotedReasons.length === 0)
      errors.push("Expected naming-heuristic topics to carry demotion reasons.");
  }

  return {
    ok: errors.length === 0,
    errors,
    namingHeuristicCount: naming.length,
  };
}

/**
 * Async checks for approve-before-save dialogue contract.
 */
export async function evaluateDialogueProposalAsync(curriculum, expectations = {}) {
  const base = evaluateDialogueProposal(curriculum, expectations);
  const errors = [...base.errors];
  const { validateAgentApproval } = await import("../curriculum/curriculum-approval.js");
  if (expectations.forbidSaveWithoutApproval) {
    const check = validateAgentApproval(curriculum);
    if (check.ok) errors.push("Unapproved curriculum unexpectedly passed approval validation.");
  }
  if (expectations.requireApprovalPasses) {
    const check = validateAgentApproval(curriculum);
    if (!check.ok) errors.push(check.error);
  }
  return {
    ok: errors.length === 0,
    errors,
    namingHeuristicCount: base.namingHeuristicCount,
  };
}

/** Match must-find subjects by focus regex when stable topic IDs are planner hashes. */
export function curriculumCoversFocus(curriculum, matchFocus) {
  const blob = curriculum.topics.map((t) => `${t.focus ?? ""} ${t.title ?? ""}`).join("\n");
  return new RegExp(matchFocus, "i").test(blob);
}
