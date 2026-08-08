// Curriculum (C3) public API.
// When you make a function public, add it to this barrel.
export { validateCurriculum, approveCurriculum } from "./approve-curriculum.js";

export { isOmnibusTopic, findOmnibusTopics } from "./curriculum-policy.js";

export { validateAgentApproval, applyAgentApproval } from "./curriculum-approval.js";

export {
  planCurriculum,
  renderCurriculumMarkdown,
  curriculumDecisionSummary,
} from "./curriculum-planning.js";

export { rankCandidate } from "./curriculum-ranking.js";

export { buildStudyOrder } from "./curriculum-graph.js";

export { applyLearnerProfile } from "./learner-profile.js";

export { deduplicateAndSplitTopics } from "./topic-decomposition.js";

export { runTopicWorkflow } from "./topic-workflow.js";

export { buildTeachingCurriculum, TEACHING_CHAPTER } from "./mini-curriculum.js";

export { resolveTopicSelector } from "./topic-resolve.js";

export { inspectTitleSet, normalizeTitle } from "./title-review.js";

export {
  emitSubjectCandidates,
  resolveSubjectPath,
  checkSubjectPathGate,
  checkAntiClone,
} from "../lessons/subject-path-gate.js";
