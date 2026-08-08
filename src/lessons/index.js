// Lesson floors (C4) public API.
// When you make a function public, add it to this barrel.
export { inspectLesson, evaluateSpecification } from "./lesson-quality.js";

export {
  EVIDENCE_CITATION,
  extractLessonCitations,
  verifyLessonCitations,
} from "./lesson-citation-check.js";

export { parseClaimsBlock, assessClaimFaithfulness } from "./claim-faithfulness.js";
export {
  reverifyLessonClaims,
  reverifyWorkbookClaims,
  displayLessonPath,
} from "./claim-reverify.js";
export {
  indexLessonClaims,
  buildClaimIndex,
  searchClaims,
  searchWorkbookClaims,
} from "./claim-search.js";
export { evaluateLessonForSave, runTeachFloors } from "./save-lesson.js";

export { lessonPlanSchema, planLesson, composeMermaidBlock } from "./lesson-composition.js";

export { buildEvidencePacket } from "./lesson-evidence.js";

export { buildLessonSpecification } from "./lesson-specification.js";

export { selectDiagramType } from "./diagram-selection.js";
export { validateMermaidSyntax } from "./mermaid-validation.js";

export { parseLessonFrontmatter, craftFieldsFromFrontmatter } from "./lesson-frontmatter.js";

export {
  DEFAULT_PATH_SECTIONS,
  MAP_SUBJECTS,
  GOLDEN_LESSON_PATHS,
  GOLDEN_SITTING_SIZE,
  resolveGoldenPaths,
  loadGoldenDraftInput,
  inspectLessonShape,
  checkMapXor,
  listLevelTwoHeadings,
} from "./lesson-shape.js";

export { USEFULNESS_FLOORS, inspectUsefulnessFloors } from "./usefulness-floors.js";

export {
  extractMermaidBlocks,
  extractMermaidBlocksWithLocations,
  extractPathishNodes,
  inventoryPathSet,
  checkDiagramGate,
} from "./diagram-gate.js";

export {
  emitSubjectCandidates,
  resolveSubjectPath,
  checkSubjectPathGate,
  checkAntiClone,
  checkPrPrimaryPaths,
} from "./subject-path-gate.js";

export {
  SUPPORTED_RELATION_LANGUAGES,
  checkPolyglotHonesty,
  checkAbsenceHonesty,
} from "./polyglot-honesty.js";
