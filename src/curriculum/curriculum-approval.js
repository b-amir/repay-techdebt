/**
 * Agent shortlist approval required before persisting a curriculum proposal.
 */

import {
  findOmnibusTopics,
  isTopicCorroborated,
  requiresCorroboration,
} from "./curriculum-policy.js";

const PURPOSE_STATUSES = new Set(["accepted", "unresolved"]);

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

  const demoted = new Set(approval.demotedTopicIds ?? []);
  const topics = (curriculum.topics ?? []).filter((topic) => !demoted.has(topic.id));
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

  return { ok: true, topics, approval };
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
    corroboratedTopicIds: approval.corroboratedTopicIds ?? [],
    corroboration: approval.corroboration ?? {},
    addedTopicIds: approval.addedTopicIds ?? [],
    acceptedPartialScope: approval.acceptedPartialScope ?? null,
  };
  const demoted = new Set(curriculum.agentApproval.demotedTopicIds);
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
  return curriculum;
}
