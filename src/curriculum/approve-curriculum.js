import { resolve } from "node:path";
import { validateAgentApproval } from "./curriculum-approval.js";

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
  const ids = new Set();
  const focuses = new Set();
  for (const topic of value.topics) {
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
    topic.status = "planned";
    topic.lessonPath = null;
    delete topic.writtenAt;
  }
  const modeledFiles = Number(value.coverage?.modeledFiles ?? 0);
  const expectedMinimum = modeledFiles >= 1000 ? 60 : modeledFiles >= 100 ? 25 : 12;
  const available = Number(value.scale?.availableCandidates ?? value.topics.length);
  const required = Math.min(expectedMinimum, available);
  if (value.topics.length < required)
    throw new Error(
      `Curriculum has ${value.topics.length} topics; ${modeledFiles} modeled files and ${available} candidates require at least ${required}. Do not compress the repository into omnibus lessons.`,
    );
  if (value.topics.length > 150) throw new Error("Curriculum cannot exceed 150 focused topics");
  if (
    modeledFiles >= 1000 &&
    available >= 60 &&
    new Set(value.topics.map((topic) => topic.chapter)).size < 5
  )
    throw new Error(
      "A large-repository curriculum must cover at least five distinct learning chapters",
    );
  return value;
}

/** Approve-and-validate in one step for callers that already stamped agentApproval. */
export function approveCurriculum(value, targetRoot) {
  return validateCurriculum(value, targetRoot);
}
