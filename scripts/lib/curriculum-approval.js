/**
 * Agent shortlist approval required before persisting a curriculum proposal.
 */

import { findOmnibusTopics } from "./curriculum-policy.js";

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
    return { ok: false, error: "agentApproval.approvedAt (ISO timestamp) is required" };
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
  const corroborated = new Set(approval.corroboratedTopicIds ?? []);
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
  const uncorroborated = topics.filter((topic) => {
    const signal = topic.signalClass ?? "naming-heuristic";
    if (signal !== "naming-heuristic") return false;
    return !corroborated.has(topic.id) && topic.corroborated !== true;
  });
  if (uncorroborated.length > 0) {
    return {
      ok: false,
      error: `Naming-heuristic topics need corroboration before save: ${uncorroborated
        .slice(0, 8)
        .map((topic) => topic.id)
        .join(", ")}${uncorroborated.length > 8 ? "…" : ""}. Add their IDs to agentApproval.corroboratedTopicIds or set topic.corroborated=true after graph/source/docs/user evidence.`,
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
    addedTopicIds: approval.addedTopicIds ?? [],
    acceptedPartialScope: approval.acceptedPartialScope ?? null,
  };
  const demoted = new Set(curriculum.agentApproval.demotedTopicIds);
  if (demoted.size > 0)
    curriculum.topics = curriculum.topics.filter((topic) => !demoted.has(topic.id));
  const corroborated = new Set(curriculum.agentApproval.corroboratedTopicIds);
  for (const topic of curriculum.topics) {
    if (corroborated.has(topic.id)) topic.corroborated = true;
  }
  curriculum.topics.forEach((topic, index) => {
    topic.rank = index + 1;
  });
  curriculum.scale = {
    ...(curriculum.scale ?? {}),
    selectedTopics: curriculum.topics.length,
  };
  return curriculum;
}
