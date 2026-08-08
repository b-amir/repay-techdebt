import { resolve } from "node:path";
import { validateAgentApproval } from "./curriculum-approval.js";
import { titleFor, outcomeFor } from "./curriculum-planning.js";
import { inspectTitleSet } from "./title-review.js";

/**
 * Validate a curriculum proposal for persistence (approval + structural floors).
 * Mutates topic status fields like the previous project-memory helper.
 */
export function validateCurriculum(value, targetRoot) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.topics))
    throw new Error("Curriculum input must be a schema-v1 plan with a topics array");
  if (resolve(value.target?.root ?? "") !== targetRoot)
    throw new Error("Curriculum target does not match the requested target root");
  const approvalCheck = validateAgentApproval(value);
  if (!approvalCheck.ok) throw new Error(approvalCheck.error);
  value.topics = approvalCheck.topics;
  const warnings = [...(approvalCheck.warnings ?? [])];
  value.titleDiagnostics = inspectTitleSet(value.topics);
  const ids = new Set();
  const focuses = new Set();
  for (const [index, topic] of value.topics.entries()) {
    if (!/^topic-[a-f0-9]{12}$/.test(topic.id) || ids.has(topic.id))
      throw new Error("Curriculum topic IDs must be unique planner-generated IDs");
    ids.add(topic.id);
    if (
      !topic.title ||
      !topic.focus ||
      !topic.learnerOutcome ||
      !topic.chapter ||
      !Array.isArray(topic.evidencePaths)
    )
      throw new Error(`Curriculum topic ${topic.id} is incomplete`);
    if (focuses.has(topic.focus)) throw new Error(`Curriculum repeats the focus ${topic.focus}`);
    focuses.add(topic.focus);
    topic.rank = index + 1;
    topic.status = "planned";
    topic.lessonPath = null;
    delete topic.writtenAt;
  }
  const deliveryMode = value.delivery?.mode ?? "learning-path";
  if (!new Set(["learning-path", "batch-only"]).has(deliveryMode))
    throw new Error("Curriculum delivery mode must be learning-path or batch-only");
  const suppliedLessonCount = Number(
    value.delivery?.requestedLessonCount ?? Math.min(3, value.topics.length),
  );
  if (!Number.isInteger(suppliedLessonCount) || suppliedLessonCount < 1 || suppliedLessonCount > 5)
    throw new Error("Curriculum requestedLessonCount must be an integer from 1 to 5");
  const requestedLessonCount = suppliedLessonCount;
  const topicIds = new Set(value.topics.map((topic) => topic.id));
  const rawBatch =
    value.delivery?.sessionBatch ??
    value.topics.slice(0, requestedLessonCount).map((topic) => topic.id);
  if (!Array.isArray(rawBatch)) throw new Error("Curriculum sessionBatch must be an array");
  if (deliveryMode === "batch-only" && rawBatch.some((id) => !topicIds.has(id)))
    throw new Error("Batch-only sessionBatch must reference kept topics");
  if (deliveryMode === "batch-only" && value.topics.length !== requestedLessonCount)
    throw new Error(
      `Batch-only curriculum must contain exactly ${requestedLessonCount} topics; received ${value.topics.length}.`,
    );
  const requestedBatch = [...new Set(rawBatch.filter((id) => topicIds.has(id)))];
  for (const topic of value.topics) {
    if (requestedBatch.length >= requestedLessonCount) break;
    if (!requestedBatch.includes(topic.id)) requestedBatch.push(topic.id);
  }
  value.delivery = {
    mode: deliveryMode,
    requestedLessonCount,
    learningPathTopics: value.topics.map((topic) => topic.id),
    sessionBatch: requestedBatch.slice(0, requestedLessonCount),
  };
  const available = Number(value.scale?.availableCandidates ?? value.topics.length);
  const required =
    deliveryMode === "batch-only"
      ? requestedLessonCount
      : Math.max(1, Math.min(3, Number.isFinite(available) ? available : 0));
  if (value.topics.length < required)
    throw new Error(
      `Whole-app curriculum needs at least ${required} kept topics; received ${value.topics.length}.`,
    );
  if (value.topics.length > 150) throw new Error("Curriculum cannot exceed 150 focused topics");
  const modeledFiles = Number(value.coverage?.modeledFiles ?? 0);
  const ratio = available > 0 ? value.topics.length / available : 1;
  if (deliveryMode === "learning-path" && value.topics.length > 40)
    warnings.push(
      `Shortlist keeps ${value.topics.length} topics; review whether it is still curated.`,
    );
  if (deliveryMode === "learning-path" && available > 0 && ratio > 0.8)
    warnings.push(`Shortlist keeps more than 80% of ${available} raw candidates.`);
  if (deliveryMode === "learning-path" && available > 0 && ratio < 0.2)
    warnings.push(`Shortlist collapsed more than 80% of ${available} raw candidates.`);
  if (
    deliveryMode === "learning-path" &&
    modeledFiles >= 1_000 &&
    available >= 60 &&
    new Set(value.topics.map((topic) => topic.chapter)).size < 5
  ) {
    warnings.push(
      "Large-repository shortlist spans fewer than five chapters; confirm purpose is narrow.",
    );
  }

  const placeholderReasons = value.agentApproval?.placeholderReasons ?? {};
  const hasReason = (reason) => typeof reason === "string" && reason.trim().length > 0;
  for (const topic of value.topics) {
    if (!topic.kind || !topic.focus) continue;
    if (
      topic.title === titleFor(topic.kind, topic.focus) &&
      !hasReason(placeholderReasons[topic.id]?.title)
    ) {
      throw new Error(
        `Topic ${topic.id} keeps the planner title placeholder; the agent must author the final title or record a specific placeholderReasons title reason.`,
      );
    }
    if (
      topic.learnerOutcome === outcomeFor(topic.kind, topic.focus) &&
      !hasReason(placeholderReasons[topic.id]?.learnerOutcome)
    ) {
      warnings.push(`Topic ${topic.id} keeps the unchanged planner outcome placeholder.`);
    }
  }
  value.scale = { ...value.scale, selectedTopics: value.topics.length };
  value.approvalWarnings = [...new Set(warnings)];
  return value;
}

/** Approve-and-validate in one step for callers that already stamped agentApproval. */
export function approveCurriculum(value, targetRoot) {
  return validateCurriculum(value, targetRoot);
}
