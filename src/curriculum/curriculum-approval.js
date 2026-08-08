/**
 * Agent shortlist approval required before persisting a curriculum proposal.
 */

import {
  findOmnibusTopics,
  isTopicCorroborated,
  requiresCorroboration,
} from "./curriculum-policy.js";
import { inspectTitleSet } from "./title-review.js";

const PURPOSE_STATUSES = new Set(["accepted", "unresolved"]);

function normalizeReason(value) {
  return typeof value === "string" ? value.trim() : "";
}

function applyTopicDecisions(curriculum, approval) {
  const topics = (curriculum.topics ?? []).map((topic) => ({
    ...topic,
    evidencePaths: [...(topic.evidencePaths ?? [])],
    importanceReasons: [...(topic.importanceReasons ?? [])],
  }));
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  const decisions = approval.topicDecisions ?? {};
  const removed = new Set(approval.demotedTopicIds ?? []);
  const warnings = [];

  for (const id of removed) {
    if (!byId.has(id)) throw new Error(`Legacy demoted topic ${id} does not exist`);
    if (!decisions[id]) {
      warnings.push(
        `Legacy demotion ${id} has no reason; migrate it to agentApproval.topicDecisions.`,
      );
    }
  }

  for (const [id, decision] of Object.entries(decisions)) {
    if (!byId.has(id)) throw new Error(`Topic decision ${id} does not match a curriculum topic`);
    if (!decision || !["demote", "fold"].includes(decision.action)) {
      throw new Error(`Topic decision ${id} action must be demote or fold`);
    }
    if (!normalizeReason(decision.reason)) {
      throw new Error(`Topic decision reason is required for ${id}`);
    }
    if (decision.action === "fold") {
      const target = byId.get(decision.intoTopicId);
      if (!target)
        throw new Error(`Fold target ${decision.intoTopicId ?? "(missing)"} does not exist`);
      if (decision.intoTopicId === id) throw new Error(`Topic ${id} cannot fold into itself`);
      if (decisions[decision.intoTopicId] || removed.has(decision.intoTopicId)) {
        throw new Error(`Fold target ${decision.intoTopicId} must be a kept topic`);
      }
    }
  }

  for (const [id, decision] of Object.entries(decisions)) {
    removed.add(id);
    if (decision.action !== "fold") continue;
    const source = byId.get(id);
    const target = byId.get(decision.intoTopicId);
    target.evidencePaths = [
      ...new Set([...(target.evidencePaths ?? []), ...(source.evidencePaths ?? [])]),
    ];
    target.importanceReasons = [
      ...new Set([
        ...(target.importanceReasons ?? []),
        `Folded ${id}: ${normalizeReason(decision.reason)}`,
      ]),
    ];
  }

  return {
    topics: topics.filter((topic) => !removed.has(topic.id)),
    warnings,
  };
}

export function validateAgentApproval(curriculum) {
  const approval = curriculum?.agentApproval;
  if (!approval || typeof approval !== "object") {
    return {
      ok: false,
      error:
        "Curriculum is a proposal until agentApproval is set. Approve/demote/add subjects, corroborate naming-heuristic topics, then save.",
    };
  }
  if (!approval.approvedAt || typeof approval.approvedAt !== "string") {
    return {
      ok: false,
      error: "agentApproval.approvedAt (ISO timestamp) is required",
    };
  }
  if (!PURPOSE_STATUSES.has(approval.purposeStatus)) {
    return {
      ok: false,
      error:
        "agentApproval.purposeStatus must be 'accepted' or 'unresolved' (B0 purpose checkpoint).",
    };
  }
  if (
    typeof approval.titleReview?.reviewedAt !== "string" ||
    approval.titleReview?.scope !== "complete-curriculum"
  ) {
    return {
      ok: false,
      error:
        "agentApproval.titleReview must record { reviewedAt, scope: 'complete-curriculum' } after the agent compares every title with the existing workbook.",
    };
  }
  const coverage = curriculum.coverage ?? {};
  const partial =
    coverage.truncated === true ||
    coverage.status === "partial" ||
    coverage.status === "scoped-analysis";
  if (partial && !approval.acceptedPartialScope) {
    return {
      ok: false,
      error:
        "Partial/scoped coverage requires agentApproval.acceptedPartialScope (reason string or true) before save.",
    };
  }

  let decisionResult;
  try {
    decisionResult = applyTopicDecisions(curriculum, approval);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  const topics = decisionResult.topics;
  const titleDiagnostics = inspectTitleSet(topics);
  if (titleDiagnostics.exactDuplicates.length > 0) {
    return {
      ok: false,
      error: `Curriculum titles must be unique: ${titleDiagnostics.exactDuplicates
        .slice(0, 4)
        .map((item) => item.titles.join(" = "))
        .join("; ")}`,
    };
  }
  const omnibus = findOmnibusTopics(topics);
  if (omnibus.length > 0) {
    return {
      ok: false,
      error: `Omnibus topics must be split or demoted before save: ${omnibus
        .slice(0, 6)
        .map((topic) => `${topic.id} (${topic.title ?? topic.focus})`)
        .join("; ")}. One subject / outcome per topic (B4a).`,
    };
  }
  const uncorroborated = topics.filter((topic) => !isTopicCorroborated(topic, approval));
  if (uncorroborated.length > 0) {
    const needs = uncorroborated.filter(requiresCorroboration);
    return {
      ok: false,
      error: `Topics need structured corroboration before save: ${needs
        .slice(0, 8)
        .map((topic) => topic.id)
        .join(
          ", ",
        )}${needs.length > 8 ? "…" : ""}. Set agentApproval.corroboration[topicId] = { corroborated: true, reason, evidence } or add the id to corroboratedTopicIds.`,
    };
  }

  const retainedSimilarities = Array.isArray(approval.titleReview.retainedSimilarities)
    ? approval.titleReview.retainedSimilarities
    : [];
  const retainedReasons = new Map(
    retainedSimilarities
      .filter(
        (item) =>
          Array.isArray(item?.topicIds) &&
          item.topicIds.length === 2 &&
          typeof item.reason === "string" &&
          item.reason.trim(),
      )
      .map((item) => [[...item.topicIds].sort().join("\0"), item.reason.trim()]),
  );
  const unresolvedSimilarities = titleDiagnostics.similarPairs.filter(
    (item) => !retainedReasons.has([...item.topicIds].sort().join("\0")),
  );
  if (unresolvedSimilarities.length > 0) {
    return {
      ok: false,
      error: `Agent title review must rewrite or explain potentially repetitive titles: ${unresolvedSimilarities
        .slice(0, 4)
        .map((item) => item.titles.map((title) => `“${title}”`).join(" and "))
        .join(
          "; ",
        )}. To retain a pair, add { topicIds, reason } to agentApproval.titleReview.retainedSimilarities.`,
    };
  }
  const similarityWarnings = titleDiagnostics.similarPairs.map((item) => {
    const reason = retainedReasons.get([...item.topicIds].sort().join("\0"));
    return `Agent retained similar titles ${item.titles.map((title) => `“${title}”`).join(" and ")}: ${reason}`;
  });
  return {
    ok: true,
    topics,
    approval,
    titleDiagnostics,
    warnings: [...decisionResult.warnings, ...similarityWarnings],
  };
}

/** Apply demotions and stamp approval metadata onto a curriculum object (mutates). */
export function applyAgentApproval(curriculum, approval) {
  const purposeStatus = PURPOSE_STATUSES.has(approval.purposeStatus)
    ? approval.purposeStatus
    : "unresolved";
  curriculum.agentApproval = {
    approvedAt: approval.approvedAt ?? new Date().toISOString(),
    purposeStatus,
    note: approval.note ?? null,
    demotedTopicIds: approval.demotedTopicIds ?? [],
    topicDecisions: approval.topicDecisions ?? {},
    placeholderReasons: approval.placeholderReasons ?? {},
    corroboratedTopicIds: approval.corroboratedTopicIds ?? [],
    corroboration: approval.corroboration ?? {},
    addedTopicIds: approval.addedTopicIds ?? [],
    acceptedPartialScope: approval.acceptedPartialScope ?? null,
    titleReview: approval.titleReview ?? null,
  };
  const demoted = new Set([
    ...curriculum.agentApproval.demotedTopicIds,
    ...Object.keys(curriculum.agentApproval.topicDecisions),
  ]);
  if (demoted.size > 0) {
    for (const topic of curriculum.topics) {
      if (demoted.has(topic.id)) topic.status = "demoted";
    }
  }
  const corroborated = new Set(curriculum.agentApproval.corroboratedTopicIds);
  for (const topic of curriculum.topics) {
    if (corroborated.has(topic.id)) topic.corroborated = true;
  }
  let rank = 1;
  curriculum.topics.forEach((topic) => {
    if (topic.status !== "demoted") {
      topic.rank = rank++;
    } else {
      delete topic.rank;
    }
  });
  curriculum.scale = {
    ...curriculum.scale,
    selectedTopics: curriculum.topics.filter((t) => t.status !== "demoted").length,
  };
  if (curriculum.delivery) {
    const keptIds = curriculum.topics
      .filter((topic) => topic.status !== "demoted")
      .map((topic) => topic.id);
    const kept = new Set(keptIds);
    curriculum.delivery = {
      ...curriculum.delivery,
      learningPathTopics: keptIds,
      sessionBatch: (curriculum.delivery.sessionBatch ?? []).filter((id) => kept.has(id)),
    };
  }
  return curriculum;
}
