/**
 * Shared script → agent handoff fields for repay-techdebt dialogue turns.
 * Scripts propose; agents take nextAsks. See references/script-agent-dialogue.md
 * + references/agent-machine-contract.md (closed `do` vocabulary).
 */

const ROLES = new Set(["gate", "inventory", "retrieve", "propose", "check"]);

/**
 * Closed nextAsks[].do vocabulary. Agents map these only - no free invention.
 * Keep in sync with references/agent-machine-contract.md.
 * `graphify-or-serena-retrieve` is emitted from plan-analysis-core toolChain.
 */
export const CLOSED_NEXT_ASK_DOS = Object.freeze([
  "confirm-purpose",
  "plan-analysis",
  "pick-retrieve-questions",
  "approve-curriculum-shortlist",
  "accept-partial-scope-or-narrow",
  "graphify-or-serena-retrieve",
  "verify-selected-leads-in-source",
  "check-evidence-anchors",
  "review-claim-semantics",
  "fix-citations-or-rewrite",
  "rewrite-unsupported-claims",
  "review-behavior-report-then-save",
  "fix-floor-errors",
  "unsupported-shrink-or-refuse",
]);

const CLOSED_NEXT_ASK_DO_SET = new Set(CLOSED_NEXT_ASK_DOS);

/** Validate direct script handoffs that do not need a full dialogue envelope. */
export function assertClosedNextAsks(nextAsks) {
  for (const item of nextAsks ?? []) {
    if (!item || !CLOSED_NEXT_ASK_DO_SET.has(item.do)) {
      throw new Error(
        `nextAsks.do "${item?.do ?? "missing"}" not in CLOSED_NEXT_ASK_DOS. Update the contract and constant first`,
      );
    }
  }
  return nextAsks;
}

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

/** Build a dialogue envelope for script→agent handoff.
 * @param {object} [opts]
 * @param {string} [opts.role] required; throws if missing
 * @param {object} [opts.coverage]
 * @param {string[]} [opts.unresolved]
 * @param {string[]} [opts.extraBlindSpots]
 * @param {string[]} [opts.extraMustNotClaim]
 * @param {object[]} [opts.extraNextAsks]
 * @param {string} [opts.mode]
 * @param {string} [opts.flowState]
 */
export function buildDialogueEnvelope({
  role,
  coverage = null,
  unresolved = [],
  extraBlindSpots = [],
  extraMustNotClaim = [],
  extraNextAsks = [],
  mode = null,
  flowState = "setup",
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

  // Hard overclaim rule: always on default path - no soft “continue weaker?”.
  mustNotClaim.push("soft-escape-continue-weaker");
  nextAsks.push({
    who: "agent",
    do: "unsupported-shrink-or-refuse",
    why: "hard-overclaim",
  });

  const closedNextAsks = dedupe(nextAsks, (item) => `${item.who}:${item.do}:${item.why ?? ""}`);
  assertClosedNextAsks(closedNextAsks);

  return {
    role,
    flowState,
    coverageStatus: coverageStatus(coverage),
    blindSpots: dedupe(blindSpots, (item) => item),
    mustNotClaim: dedupe(mustNotClaim, (item) => item),
    nextAsks: closedNextAsks,
    overclaimPolicy: "unsupported-shrink-or-refuse",
  };
}

/** Mark curriculum topic provenance for agent shortlist turns.
 * @param {object} opts
 * @param {string} [opts.kind]
 * @param {number} [opts.relationCount]
 * @param {string[]} [opts.reasons]
 */
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
