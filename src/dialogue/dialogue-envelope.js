/**
 * Shared script → agent handoff fields for repay-techdebt dialogue turns.
 * Scripts propose; agents take nextAsks. See references/script-agent-dialogue.md.
 */

const ROLES = new Set(["gate", "inventory", "retrieve", "propose", "check"]);

function coverageStatus(coverage) {
  if (!coverage) return "unknown";
  if (coverage.status) return coverage.status;
  if (coverage.truncated) return "partial";
  return "complete";
}

function isPartial(coverage) {
  const status = coverageStatus(coverage);
  return coverage?.truncated === true || status === "partial" || status === "scoped-analysis";
}

/**
 * @param {object} options
 * @param {"gate"|"inventory"|"retrieve"|"propose"|"check"} options.role
 * @param {object} [options.coverage]
 * @param {string[]} [options.unresolved]
 * @param {string[]} [options.extraBlindSpots]
 * @param {string[]} [options.extraMustNotClaim]
 * @param {object[]} [options.extraNextAsks]
 * @param {"pr"|"workbook"|"focused"} [options.mode]
 */
export function buildDialogueEnvelope({
  role,
  coverage = null,
  unresolved = [],
  extraBlindSpots = [],
  extraMustNotClaim = [],
  extraNextAsks = [],
  mode = null,
} = {}) {
  if (!ROLES.has(role)) throw new Error(`dialogue role must be one of ${[...ROLES].join("|")}`);

  const blindSpots = [...extraBlindSpots];
  const mustNotClaim = [...extraMustNotClaim];
  const nextAsks = [...extraNextAsks];
  const partial = isPartial(coverage);

  if (partial) {
    blindSpots.push("unmodeled-files-beyond-budget-or-scope");
    mustNotClaim.push("complete-call-graph", "whole-application-absence");
    nextAsks.push({
      who: "agent",
      do: "accept-partial-scope-or-narrow",
      why: "coverage-partial",
    });
  }

  if (unresolved.some((item) => /purpose|criticalit|business/i.test(item))) {
    nextAsks.push({
      who: "agent",
      do: "confirm-purpose",
      why: "purpose-unconfirmed",
    });
  }

  if (role === "propose" && mode === "workbook") {
    nextAsks.push({
      who: "agent",
      do: "approve-curriculum-shortlist",
      why: "curriculum-is-proposal",
    });
    mustNotClaim.push("approved-workbook-index");
  }

  if (role === "propose" && (mode === "focused" || mode === "pr")) {
    nextAsks.push({
      who: "agent",
      do: "pick-retrieve-questions",
      why: "plan-is-proposal",
    });
  }

  if (role === "inventory") {
    nextAsks.push({
      who: "agent",
      do: "confirm-purpose",
      why: "archetype-inferred-only",
    });
    nextAsks.push({
      who: "script",
      do: "plan-analysis",
      when: "after-purpose-turn",
    });
  }

  // Deduplicate by who+do+why
  const dedupe = (items, keyFn) => [...new Map(items.map((item) => [keyFn(item), item])).values()];

  return {
    role,
    coverageStatus: coverageStatus(coverage),
    blindSpots: dedupe(blindSpots, (item) => item),
    mustNotClaim: dedupe(mustNotClaim, (item) => item),
    nextAsks: dedupe(nextAsks, (item) => `${item.who}:${item.do}:${item.why ?? ""}`),
  };
}

/** Mark curriculum topic provenance for agent shortlist turns. */
export function topicSignalClass({ kind, relationCount = 0, reasons = [] } = {}) {
  if (
    kind === "workflow" &&
    reasons.some((item) => /project configuration|critical workflow/i.test(item))
  )
    return "user";
  if (kind === "dependency" && relationCount > 0) return "ast";
  if (relationCount >= 2) return "ast";
  return "naming-heuristic";
}
