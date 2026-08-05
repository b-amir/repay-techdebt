// Lesson floors (C4) public API.
// When you make a function public, add it to this barrel.
export { inspectLesson, evaluateSpecification } from "./lesson-quality.js";

export {
  EVIDENCE_CITATION,
  extractLessonCitations,
  verifyLessonCitations,
} from "./lesson-citation-check.js";

export { parseClaimsBlock, assessClaimFaithfulness } from "./claim-faithfulness.js";
export { evaluateLessonForSave, runTeachFloors } from "./save-lesson.js";

export { lessonPlanSchema, planLesson, composeMermaidBlock } from "./lesson-composition.js";

export { buildEvidencePacket } from "./lesson-evidence.js";

export { buildLessonSpecification } from "./lesson-specification.js";

export { selectDiagramType } from "./diagram-selection.js";
