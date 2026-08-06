// @category C9
// Public API smoke. Dynamic-imports each category barrel and asserts the
// documented public exports resolve. After a folder move, a barrel that forgets to
// re-export (or points at a renamed module) fails here before behavior tests run.
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { test } from "vite-plus/test";

const here = dirname(fileURLToPath(import.meta.url));
const absoluteBarrel = (file) => resolve(here, file);

const BARRELS = [
  {
    name: "foundations",
    file: "../../src/foundations/index.js",
    keys: [
      "skillRoot",
      "TargetRootError",
      "resolveTargetRoot",
      "formatTargetError",
      "isSameOrInside",
      "memoryPaths",
      "resolveMemoryPaths",
      "locateProjectMemory",
      "projectStoragePaths",
    ],
  },
  {
    name: "program",
    file: "../../src/program/index.js",
    keys: [
      "buildProgramModel",
      "loadPackRegistry",
      "buildCoverage",
      "normalizeScope",
      "classifyFile",
      "discoverTargetFiles",
      "programModelSchema",
      "analysisPlanSchema",
      "MODEL_VERSION",
      "parseManifest",
      "extractRelationships",
      "discoverWorkflows",
      "buildWorkflowGraph",
      "planAnalysis",
      "summarizeModel",
    ],
  },
  {
    name: "dialogue",
    file: "../../src/dialogue/index.js",
    keys: [
      "buildDialogueEnvelope",
      "topicSignalClass",
      "validateTrajectory",
      "stubWorkbookTrajectory",
      "WORKBOOK_TRAJECTORY",
      "FOCUSED_TRAJECTORY",
      "PR_TRAJECTORY",
    ],
  },
  {
    name: "curriculum",
    file: "../../src/curriculum/index.js",
    keys: [
      "validateCurriculum",
      "approveCurriculum",
      "isOmnibusTopic",
      "findOmnibusTopics",
      "validateAgentApproval",
      "applyAgentApproval",
      "planCurriculum",
      "renderCurriculumMarkdown",
      "rankCandidate",
      "buildStudyOrder",
      "applyLearnerProfile",
      "deduplicateAndSplitTopics",
      "runTopicWorkflow",
      "buildTeachingCurriculum",
      "TEACHING_CHAPTER",
    ],
  },
  {
    name: "viewer",
    file: "../../src/viewer/index.js",
    keys: [
      "resolveWorkbook",
      "readProgress",
      "setCompletion",
      "renderMarkdown",
      "buildSidebar",
      "createViewerServer",
      "renderLesson",
    ],
  },
  {
    name: "lessons",
    file: "../../src/lessons/index.js",
    keys: [
      "evaluateLessonForSave",
      "runTeachFloors",
      "inspectLesson",
      "evaluateSpecification",
      "extractLessonCitations",
      "verifyLessonCitations",
      "parseClaimsBlock",
      "assessClaimFaithfulness",
      "reverifyLessonClaims",
      "reverifyWorkbookClaims",
      "displayLessonPath",
      "checkPrPrimaryPaths",
      "planLesson",
      "composeMermaidBlock",
      "lessonPlanSchema",
      "buildEvidencePacket",
      "buildLessonSpecification",
      "selectDiagramType",
    ],
  },
  {
    name: "tools",
    file: "../../src/tools/index.js",
    keys: [
      "createAnalyzerResult",
      "ANALYZER_STATUSES",
      "assertSafeAnalyzerOutputDirectory",
      "capabilitySchema",
      "capabilityReportSchema",
      "sanitizeDiagnostic",
      "runCommand",
      "probeCommand",
      "formatCapabilityTable",
      "collectRuntimeEvidence",
      "AnalysisCache",
      "checkBudget",
    ],
  },
];

test.each(BARRELS)(
  "barrel $name is importable and exposes its public API",
  async ({ file, keys }) => {
    const mod = await import(file);
    const present = Object.keys(mod);
    assert.ok(present.length >= keys.length, `${file} re-exports only ${present.length} names`);
    const missing = keys.filter((key) => mod[key] === undefined);
    assert.deepEqual(
      missing,
      [],
      `${file} is missing public exports (renamed source module or forgotten re-export?): ${missing.join(", ")}`,
    );
  },
);

test("every barrel exposes a named anchor export", async () => {
  // These four are the cross-category public contract anchors.
  const anchors = {
    program: ["buildProgramModel", "../../src/program/index.js"],
    curriculum: ["validateCurriculum", "../../src/curriculum/index.js"],
    lessons: ["evaluateLessonForSave", "../../src/lessons/index.js"],
    tools: ["createAnalyzerResult", "../../src/tools/index.js"],
  };
  for (const [category, [key, file]] of Object.entries(anchors)) {
    const mod = await import(file);
    assert.equal(
      typeof mod[key],
      "function",
      `${category} barrel anchor ${key} must be a function`,
    );
  }
});

test.each(BARRELS)(
  "barrel $name links cleanly under native node (no stale bindings)",
  async ({ file, name }) => {
    // Vitest (esbuild) is lenient about re-exporting a binding the source no longer exports.
    // Native node ESM linking is strict, so spawning `node -e "import(...)"` catches a barrel
    // that references a renamed/removed source export — the exact regression a folder move risks.
    const abs = absoluteBarrel(file);
    const result = await execa(
      process.execPath,
      ["--input-type=module", "-e", `await import(${JSON.stringify(abs)})`],
      { reject: false },
    );
    assert.equal(
      result.exitCode,
      0,
      `${name} barrel failed to link under native node:\n${(result.stderr || "").trim()}`,
    );
  },
);
