import { craftFieldsFromFrontmatter, parseLessonFrontmatter } from "./lesson-frontmatter.js";

export const LEARNING_MOMENT_KINDS = ["quickCheck", "thinkFirst", "seeForYourself"];

const LABELS = {
  quickCheck: "Quick check",
  thinkFirst: "Think first",
  seeForYourself: "See for yourself",
};

const MARKERS = {
  quickCheck: /\*\*Quick check:\*\*/gi,
  // Prediction/Reveal is the older spelling of the same causal pause.
  thinkFirst: /\*\*(?:Think first|Prediction):\*\*/gi,
  seeForYourself: /\*\*See for yourself:\*\*/gi,
};

const PITFALL_SECTIONS = new Set([
  "failure-path",
  "risk",
  "failure-and-abuse",
  "failure-impact",
  "failure-recovery",
  "coverage-gaps",
  "edge-states",
]);

const CAUSAL_SHAPES = new Set([
  "end-to-end-flow",
  "code-mechanics",
  "debugging-failure",
  "security-boundary",
  "performance-scale",
  "data-state",
  "operations-deployment",
  "ui-interaction",
]);

const VERIFICATION_SECTIONS = new Set([
  "change-safely",
  "try-it",
  "verification",
  "diagnostic-evidence",
  "recovery",
  "measurement",
  "safe-optimization",
  "next-test",
]);

function unique(values, maximum = 16) {
  return [...new Set(values.filter(Boolean))].slice(0, maximum);
}

function evidenceFromSignals(signals, ids) {
  const wanted = new Set(ids);
  return unique(
    signals.filter((signal) => wanted.has(signal.id)).flatMap((signal) => signal.evidenceIds),
  );
}

/**
 * Turn lesson shape and evidence into explicit opportunities. Recommendations are advisory: the
 * author still verifies the opportunity in source and may omit it with a concrete reason.
 */
export function planLearningMoments({
  shapeId,
  depth,
  sections,
  signals,
  hasFocusEvidence,
  browserCapable,
}) {
  const sectionIds = sections.map((section) => section.id);
  const pitfallSection = sectionIds.find((id) => PITFALL_SECTIONS.has(id));
  const causalSection = sectionIds.find((id) =>
    ["entry-to-effect", "mechanism", "execution-path", "control-flow", "state-lifecycle"].includes(
      id,
    ),
  );
  const verificationSection = sectionIds.find((id) => VERIFICATION_SECTIONS.has(id));
  const uiSignal = signals.find((signal) => signal.id === "ui");
  const browserOpportunity =
    hasFocusEvidence &&
    Boolean(verificationSection) &&
    browserCapable &&
    (shapeId === "ui-interaction" ||
      (uiSignal?.focusRelated && ["moderate", "strong"].includes(uiSignal.strength)));

  const candidates = [
    {
      kind: "quick-check",
      available: hasFocusEvidence && Boolean(pitfallSection),
      score: 85,
      afterSectionId: pitfallSection ?? null,
      teachingGoal: "Distinguish the verified path from a plausible shortcut or wrong model.",
      reason: pitfallSection
        ? "The selected shape contains an evidence-backed failure or contrast where plausible alternatives can expose a consequential misconception."
        : "The selected shape has no dedicated failure or contrast section for a meaningful single-answer check.",
      evidenceIds: evidenceFromSignals(signals, [
        "relationships",
        "security",
        "reliability",
        "data",
      ]),
    },
    {
      kind: "think-first",
      available: hasFocusEvidence && CAUSAL_SHAPES.has(shapeId) && Boolean(causalSection),
      score: 78,
      afterSectionId: causalSection ?? null,
      teachingGoal: "Make the learner predict a causal effect before revealing the mechanism.",
      reason:
        CAUSAL_SHAPES.has(shapeId) && causalSection
          ? "The lesson follows an ordered mechanism with a decision, branch, or state change worth reasoning through before explanation."
          : "The selected shape does not expose a strong causal pause beyond the surrounding explanation.",
      evidenceIds: evidenceFromSignals(signals, [
        "relationships",
        "security",
        "reliability",
        "data",
        "performance",
      ]),
    },
    {
      kind: "see-for-yourself",
      available: browserOpportunity,
      score: 92,
      afterSectionId: verificationSection ?? null,
      teachingGoal:
        "Turn a safe browser-observable behavior into a guided DevTools variation with a reset.",
      reason: browserOpportunity
        ? "The focus has browser UI evidence and a verification section, so the author should look for a safe observable request, state, or response boundary."
        : "No focus-related browser capability and verification boundary were strong enough to recommend a DevTools walkthrough.",
      evidenceIds: evidenceFromSignals(signals, ["ui", "relationships", "testing"]),
    },
  ];

  const recommendationLimit = { concise: 1, balanced: 2, deep: 3 }[depth] ?? 2;
  const rankedAvailable = candidates
    .filter((candidate) => candidate.available)
    .sort((left, right) => right.score - left.score);
  const recommendedKinds = new Set(
    rankedAvailable.slice(0, recommendationLimit).map((candidate) => candidate.kind),
  );

  return {
    maximum: 3,
    opportunities: candidates.map(({ available, score: _score, ...candidate }) => ({
      ...candidate,
      decision: available
        ? recommendedKinds.has(candidate.kind)
          ? "recommended"
          : "candidate"
        : "omit",
    })),
  };
}

function countMatches(markdown, pattern) {
  return (String(markdown).match(pattern) ?? []).length;
}

function sectionBody(markdown, heading) {
  if (!heading) return "";
  const matches = [...String(markdown).matchAll(/^##\s+(.+)\r?$/gm)];
  const index = matches.findIndex(
    (match) => match[1].trim().toLowerCase() === String(heading).trim().toLowerCase(),
  );
  if (index < 0) return "";
  return String(markdown).slice(
    matches[index].index + matches[index][0].length,
    matches[index + 1]?.index ?? String(markdown).length,
  );
}

function parseDecision(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const match = raw.trim().match(/^(include(?:d)?|omit(?:ted)?)\b\s*(?:[-—:]\s*)?(.*)$/i);
  if (!match) return { decision: "invalid", reason: "", raw: raw.trim() };
  return {
    decision: match[1].toLowerCase().startsWith("include") ? "include" : "omit",
    reason: match[2].trim(),
    raw: raw.trim(),
  };
}

function isSpecificReason(reason) {
  const normalized = String(reason ?? "").trim();
  if (normalized.length < 18) return false;
  return !/^(?:not needed|none|optional|no opportunity|n\/a|not applicable)\.?$/i.test(normalized);
}

/**
 * Inspect both the visible blocks and the author-only learningMoments frontmatter ledger.
 * Missing ledgers are warnings during drafting and become errors at durable save when requested.
 */
export function inspectLearningMoments(
  markdown,
  { depth = "balanced", requireDecisions = false } = {},
) {
  const { frontmatter } = parseLessonFrontmatter(markdown);
  const craft = craftFieldsFromFrontmatter(frontmatter);
  const rawDecisions = craft.learningMoments;
  const present = Object.fromEntries(
    LEARNING_MOMENT_KINDS.map((kind) => [kind, countMatches(markdown, MARKERS[kind])]),
  );
  const decisions = Object.fromEntries(
    LEARNING_MOMENT_KINDS.map((kind) => [kind, parseDecision(rawDecisions[kind])]),
  );
  const workedPath = sectionBody(markdown, craft.sectionRoles.workedPath);
  const pitfall = sectionBody(markdown, craft.sectionRoles.pitfall);
  const check = sectionBody(markdown, craft.sectionRoles.check);
  const opportunityText = {
    quickCheck: pitfall || markdown,
    thinkFirst: workedPath || markdown,
    seeForYourself: check || "",
  };
  const opportunities = {
    quickCheck:
      /\b(?:common mistake|misconception|shortcut|wrong model|what breaks|pitfall|bypass|another door|lost contract)\b/i.test(
        opportunityText.quickCheck,
      ) ||
      (/^\|.+\|$/m.test(opportunityText.quickCheck) &&
        /\b(?:instead|versus|vs\.?|lost|breaks?|fails?)\b/i.test(opportunityText.quickCheck)),
    thinkFirst:
      /\b(?:if|when|before|after|otherwise)\b/i.test(opportunityText.thinkFirst) &&
      /\b(?:because|therefore|means|so that|as a result|returns?|rejects?|calls?|writes?)\b/i.test(
        opportunityText.thinkFirst,
      ),
    seeForYourself:
      /\b(?:browser|devtools|network (?:panel|tab|request|url)|request url|response status|console|accessibility tree|computed styles?)\b/i.test(
        opportunityText.seeForYourself,
      ) &&
      /\b(?:open|inspect|observe|verify|reload|navigate|request|look for)\b/i.test(
        opportunityText.seeForYourself,
      ),
  };

  const errors = [];
  const warnings = [];
  const hasLedger = LEARNING_MOMENT_KINDS.some((kind) => rawDecisions[kind]);
  if (requireDecisions && !hasLedger) {
    errors.push(
      "Declare learningMoments decisions for quickCheck, thinkFirst, and seeForYourself in lesson frontmatter.",
    );
  } else if (!hasLedger && depth !== "concise" && Object.values(opportunities).some(Boolean)) {
    warnings.push(
      "Record learningMoments include/omit decisions so natural interactive opportunities are reviewed instead of silently skipped.",
    );
  }

  for (const kind of LEARNING_MOMENT_KINDS) {
    const label = LABELS[kind];
    const decision = decisions[kind];
    if (requireDecisions && !decision) {
      if (hasLedger)
        errors.push(`learningMoments.${kind} must declare include or omit with a specific reason.`);
      continue;
    }
    if (!decision) {
      if (opportunities[kind] && present[kind] === 0) {
        warnings.push(
          `${label} opportunity detected but no block or explicit omission reason was recorded.`,
        );
      }
      continue;
    }
    if (decision.decision === "invalid") {
      errors.push(`learningMoments.${kind} must start with include or omit.`);
      continue;
    }
    if (!isSpecificReason(decision.reason)) {
      errors.push(
        `learningMoments.${kind} needs a specific teaching purpose or omission reason (at least 18 characters).`,
      );
    }
    if (decision.decision === "include" && present[kind] === 0) {
      errors.push(`learningMoments.${kind} is included, but the ${label} block is missing.`);
    }
    if (decision.decision === "omit" && present[kind] > 0) {
      errors.push(`learningMoments.${kind} is omitted, but the ${label} block is present.`);
    }
  }

  if (/\*\*Prediction:\*\*/i.test(markdown) && !/\*\*Think first:\*\*/i.test(markdown)) {
    warnings.push(
      "Prediction/Reveal remains supported, but prefer Think first/Answer for one consistent causal-reflection pattern.",
    );
  }

  return {
    ok: errors.length === 0,
    present,
    decisions,
    opportunities,
    errors,
    warnings,
  };
}
