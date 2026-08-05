/**
 * Scores a curriculum topic candidate using an explainable feature model.
 *
 * Naming-only area/module/boundary candidates are demoted so graph/AST/user
 * signals outrank path-regex familiarity. Agents must corroborate remaining
 * naming-heuristic topics before save-curriculum.
 *
 * @param {Object} candidate The topic candidate.
 * @param {Object} _context Context about the program (e.g. total nodes, workflows).
 * @returns {Object} Score details including total, positive contributions, and negative penalties.
 */
export function rankCandidate(candidate, _context = {}) {
  let score = 50; // Base score
  const positive = [];
  const negative = [];

  // Product criticality
  if (candidate.kind === "workflow") {
    score += 40;
    positive.push({
      feature: "critical-workflow",
      value: 40,
      reason: "Represents an end-to-end user or system workflow.",
    });
  }

  if (candidate.kind === "entry") {
    score += 25;
    positive.push({
      feature: "entry-point",
      value: 25,
      reason: "Execution entry point to the system.",
    });
  }

  if (candidate.kind === "component") {
    score += 20;
    positive.push({
      feature: "architecture-boundary",
      value: 20,
      reason: "Defines an architectural or ownership boundary.",
    });
  }

  // Graph centrality (proxy via relation count if provided)
  if (candidate.relationCount > 0) {
    const centralityBonus = Math.min(20, candidate.relationCount * 2);
    score += centralityBonus;
    positive.push({
      feature: "graph-centrality",
      value: centralityBonus,
      reason: `Highly connected (${candidate.relationCount} relations).`,
    });
  }

  // Trust / Data signals — weaker than before; path tokens are heuristics only
  if (candidate.focus && /auth|permission|session|security/i.test(candidate.focus)) {
    const trustBonus = candidate.relationCount >= 2 ? 12 : 6;
    score += trustBonus;
    positive.push({
      feature: "trust-boundary",
      value: trustBonus,
      reason:
        candidate.relationCount >= 2
          ? "Trust-related focus with relationship evidence."
          : "Trust-related path token (naming heuristic; corroborate before teaching).",
    });
  }

  // Penalties
  if (candidate.focus && /test|mock|fixture/i.test(candidate.focus) && candidate.kind !== "test") {
    score -= 20;
    negative.push({
      feature: "test-plumbing",
      value: -20,
      reason: "Test infrastructure or mocks are usually lower priority than product code.",
    });
  }

  if (candidate.focus && /generated|dist|build|node_modules/i.test(candidate.focus)) {
    score -= 40;
    negative.push({
      feature: "generated-code",
      value: -40,
      reason: "Generated or third-party code.",
    });
  }

  const namingKinds = new Set(["area", "module", "boundary"]);
  if (namingKinds.has(candidate.kind) && !(candidate.relationCount >= 2)) {
    score -= 15;
    negative.push({
      feature: "naming-heuristic",
      value: -15,
      reason:
        "naming-heuristic: ranked mainly from path/convention signals; agent must corroborate or demote before save.",
    });
  }

  const finalScore = Math.max(1, Math.min(100, score));

  return {
    score: finalScore,
    features: { positive, negative },
  };
}
