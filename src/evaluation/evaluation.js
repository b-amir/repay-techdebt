import {
  craftFieldsFromFrontmatter,
  parseLessonFrontmatter,
} from "../lessons/lesson-frontmatter.js";

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

function evidenceSnippet(markdown, pattern) {
  const match = String(markdown).match(pattern);
  if (!match) return null;
  return match[0].replace(/\s+/g, " ").trim().slice(0, 180);
}

function lessonSections(markdown) {
  const { frontmatter, body } = parseLessonFrontmatter(markdown);
  const roles = craftFieldsFromFrontmatter(frontmatter).sectionRoles;
  const matches = [...body.matchAll(/^##\s+(.+)\r?$/gm)];
  const sections = matches.map((match, index) => ({
    title: match[1].trim(),
    body: body
      .slice(match.index + match[0].length, matches[index + 1]?.index ?? body.length)
      .trim(),
  }));
  const findRole = (role, fallback) => {
    const named = roles[role];
    return sections.find((section) =>
      named ? section.title.toLowerCase() === named.toLowerCase() : fallback.test(section.title),
    );
  };
  return {
    sections,
    workedPath: findRole("workedPath", /trace|path|flow|call|mechanism|walk/i),
    pitfall: findRole("pitfall", /pitfall|mistake|boundary|contrast|failure/i),
    check: findRole("check", /check|try|change|exercise|verify|practice/i),
  };
}

function compactExcerpt(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function firstSentence(value, pattern) {
  const sentences = String(value ?? "").split(/(?<=[.!?])\s+|\n+/);
  return sentences.find((sentence) => pattern.test(sentence)) ?? null;
}

/** Detect teaching behaviors rather than rewarding headings or isolated keywords. */
export function inspectLessonBehaviors(markdown) {
  const text = String(markdown);
  const parsed = lessonSections(text);
  const citations = [...text.matchAll(/\b[\w./-]+\.[A-Za-z0-9]+:[1-9]\d*\b/g)].map(
    (match) => match[0],
  );
  const sections = parsed.sections.map((section) => section.title);
  const worked = parsed.workedPath?.body ?? "";
  const pitfall = parsed.pitfall?.body ?? "";
  const check = parsed.check?.body ?? "";
  const numberedTrace = [...worked.matchAll(/^\s*\d+[.)]\s+(.+)$/gm)];
  const numberedTraceEvidence =
    numberedTrace.length >= 2 &&
    /(?:->|→|then|next|after|before|because|returns?|calls?|writes?|reads?)/i.test(worked)
      ? numberedTrace.map((match) => match[0]).join(" ")
      : null;
  const proseTrace = firstSentence(
    worked,
    /(?:start (?:at|with)|then (?:follow|open|trace)|next[, ]|flows? (?:to|through)|calls?|returns?|hands? .+ to)/i,
  );
  const contrastCandidate = firstSentence(
    pitfall,
    /(?:not\s+.{3,80}\s+but|common (?:mistake|assumption)|instead of|difference (?:is|between)|(?:if|when) .{3,120}(?:then|otherwise|means|leads? to|so) )/i,
  );
  const contrastEvidence =
    String(contrastCandidate ?? "")
      .split(/\s+/)
      .filter(Boolean).length >= 10
      ? contrastCandidate
      : null;
  const checkHasAction = /\b(?:modify|change|debug|test|trace|open|add|remove|replace|run)\b/i.test(
    check,
  );
  const checkHasTarget =
    /(?:[\w./-]+\.[A-Za-z0-9]+(?::\d+)?|\b(?:unit|integration|focused|browser) test\b)/i.test(
      check,
    );
  const checkHasExpected =
    /\b(?:assert|expect|verify|observe|should|must|remains?|returns?|throws?|fails?|passes?)\b/i.test(
      check,
    );
  const learnerJobEvidence =
    check.split(/\s+/).length >= 12 && checkHasAction && checkHasTarget && checkHasExpected
      ? check
      : null;
  const decisionRuleCandidate = firstSentence(
    `${pitfall}\n${text}`,
    /(?:if\s+.{3,140}\s+then|when\s+.{3,140}\s+(?:use|prefer|choose|treat)|rule(?: of thumb)?\s*:)/i,
  );
  const decisionRuleEvidence =
    String(decisionRuleCandidate ?? "")
      .split(/\s+/)
      .filter(Boolean).length >= 10
      ? decisionRuleCandidate
      : null;
  const evidence = {
    prediction: evidenceSnippet(
      text,
      /(?:predict|before (?:you )?(?:read|run|continue)|what (?:do you think|happens if))[^\n.!?]*[?.!]/i,
    ),
    trace: compactExcerpt(numberedTraceEvidence ?? proseTrace) || null,
    contrast: compactExcerpt(contrastEvidence) || null,
    decisionRule: compactExcerpt(decisionRuleEvidence) || null,
    learnerJob: compactExcerpt(learnerJobEvidence) || null,
  };
  const confidence = Object.fromEntries(
    Object.entries(evidence).map(([key, value]) => [
      key,
      value ? (key === "trace" && numberedTraceEvidence ? "high" : "medium") : "not-detected",
    ]),
  );
  return {
    evidence,
    confidence,
    observed: Object.fromEntries(Object.entries(evidence).map(([key, value]) => [key, !!value])),
    citationCount: citations.length,
    sectionCount: sections.length,
    inspectedSections: {
      workedPath: parsed.workedPath?.title ?? null,
      pitfall: parsed.pitfall?.title ?? null,
      check: parsed.check?.title ?? null,
    },
  };
}

/** Deterministic, evidence-bearing report; not an independent semantic judge. */
export function evaluateLessonBehaviors(markdown, quality, options = {}) {
  const depth = options.depth ?? "balanced";
  const behavior = inspectLessonBehaviors(markdown);
  const observedCount = Object.values(behavior.observed).filter(Boolean).length;
  const pedagogyNeeded = depth === "concise" ? 2 : depth === "deep" ? 4 : 3;
  const pedagogy = Math.max(1, Math.min(5, 1 + Math.round((observedCount / 5) * 4)));
  const actionSignals = [
    behavior.observed.learnerJob,
    behavior.observed.decisionRule,
    behavior.citationCount >= 2,
  ].filter(Boolean).length;
  const actionability = Math.max(1, Math.min(5, 1 + actionSignals));
  const hasCite = behavior.citationCount >= 2;
  const dimensions = {
    correctness: hasCite && quality.ok ? 5 : hasCite ? 3 : 1,
    importance: behavior.observed.decisionRule || behavior.observed.contrast ? 5 : 3,
    focus:
      behavior.sectionCount >= 3 && behavior.sectionCount <= 8
        ? 5
        : behavior.sectionCount > 0
          ? 3
          : 1,
    clarity: (quality.warnings?.length ?? 0) === 0 ? 5 : 3,
    pedagogy,
    actionability,
  };
  return {
    judge: "deterministic-behavior-report",
    note: "Reports observable teaching behaviors. It does not replace semantic or independent review.",
    depth,
    dimensions,
    behavior,
    calibration: {
      pedagogyNeeded,
      pedagogyObserved: observedCount,
      pedagogyFloorMet: observedCount >= pedagogyNeeded,
      actionabilityFloorMet: actionSignals >= 2,
    },
  };
}
