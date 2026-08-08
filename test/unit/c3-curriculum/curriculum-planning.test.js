// @category C3
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  curriculumDecisionSummary,
  planCurriculum,
  renderCurriculumMarkdown,
} from "../../../src/curriculum/curriculum-planning.js";
import { inspectLesson } from "../../../src/lessons/lesson-quality.js";

function largeModel() {
  const nodes = [{ id: "system:root", kind: "system", name: "large-app", path: "." }];
  const edges = [];
  for (let index = 0; index < 1200; index += 1) {
    const path = `app/features/feature-${Math.floor(index / 10)}/module-${index}.ts`;
    nodes.push({
      id: `file:${index}`,
      kind: "file",
      name: `module-${index}.ts`,
      path,
    });
    if (index > 0)
      edges.push({
        kind: "imports",
        from: `file:${index}`,
        to: `file:${index - 1}`,
      });
  }
  nodes.push({
    id: "file:test-result",
    kind: "file",
    name: "output.json",
    path: "test-results/run/output.json",
  });
  return {
    generatedAt: "2026-08-01T00:00:00.000Z",
    target: { root: "/tmp/large-app", scope: ".", excludedSkillPath: null },
    coverage: { modeledFiles: 1200 },
    nodes,
    edges,
    dependencies: [
      {
        name: "react",
        manifests: ["package.json"],
        usedBy: ["app/root.tsx", "app/features/feature-1/module-10.ts"],
      },
    ],
    profile: {
      criticalWorkflows: ["customer checkout"],
      entryPoints: ["app/root.tsx"],
      components: [{ root: ".", manifests: ["package.json"], files: 1200 }],
      boundaryEvidence: [
        {
          path: "app/features",
          confidence: 0.9,
          signals: ["relationship-hub"],
        },
      ],
      uncertainties: ["Business priority still needs confirmation."],
    },
  };
}

function mechanismModel() {
  const paths = [
    "app/security/identity.ts",
    "app/security/policy.ts",
    "app/security/access-gate.ts",
    "app/server/request-adapter.server.ts",
    "app/state/request-registry.ts",
    "app/state/workflow-state.ts",
    "app/routes/index.tsx",
    "app/ui/logo.tsx",
    "app/styles.css",
    "app/features/records/list.tsx",
    "app/services/worker.ts",
    "app/data/query.ts",
  ];
  const nodes = [{ id: "system:root", kind: "system", name: "mechanisms", path: "." }];
  const edges = [];
  paths.forEach((path, index) =>
    nodes.push({ id: `file:${index}`, kind: "file", name: path.split("/").at(-1), path }),
  );
  for (let index = 1; index < paths.length; index += 1) {
    edges.push({ kind: "imports", from: `file:${index}`, to: "file:0" });
    if (index > 2) edges.push({ kind: "imports", from: `file:${index}`, to: `file:${index - 1}` });
  }
  return {
    generatedAt: "2026-08-01T00:00:00.000Z",
    target: { root: "/tmp/mechanisms", scope: ".", excludedSkillPath: null },
    coverage: { status: "complete", modeledFiles: paths.length, discoveredFiles: paths.length },
    nodes,
    edges,
    dependencies: [],
    profile: {
      criticalWorkflows: [],
      entryPoints: ["app/routes/index.tsx"],
      components: [],
      boundaryEvidence: [],
      uncertainties: [],
    },
  };
}

test("large repositories receive a complete learning path and a bounded session batch", () => {
  const curriculum = planCurriculum(largeModel());
  assert.equal(curriculum.repositorySize, "large");
  assert.ok(curriculum.topics.length >= 130);
  assert.ok(curriculum.topics.length <= 150);
  assert.equal(curriculum.delivery.sessionBatch.length, 3);
  assert.equal(curriculum.delivery.learningPathTopics.length, curriculum.topics.length);
  assert.ok(curriculum.blueprint.chapters.length >= 2);
  assert.ok(
    curriculum.blueprint.chapters.every(
      (chapter) =>
        chapter.learnerCapability &&
        chapter.whyItMatters &&
        Array.isArray(chapter.prerequisiteChapterIds) &&
        Array.isArray(chapter.coveredWorkflows) &&
        chapter.visualCoverage &&
        Array.isArray(chapter.coverageGaps),
    ),
  );
  assert.equal(curriculum.blueprint.coverage.topicCount, curriculum.topics.length);
  assert.ok(curriculum.candidateSummary.available > curriculum.topics.length);
  assert.equal(curriculum.candidateSummary.filtered, curriculum.candidateSummary.rejected);
  assert.ok(curriculum.candidateSummary.folded >= 0);
  assert.equal(curriculum.topics[0].focus, "customer checkout");
  assert.ok(
    curriculum.topics.every(
      (topic) =>
        topic.learnerOutcome &&
        topic.evidencePaths &&
        topic.applicationCapability &&
        topic.separateLessonReason &&
        ["required", "recommended", "omit"].includes(topic.diagramExpectation?.decision) &&
        Array.isArray(topic.prerequisiteTopicIds),
    ),
  );
  assert.ok(curriculum.topics.every((topic) => topic.kind !== "dependency"));
  assert.ok(curriculum.topics.every((topic) => !/test-results/i.test(topic.focus)));
  assert.ok(curriculum.topics.every((topic) => topic.focus !== "app/features"));
  assert.equal(curriculum.role, "propose");
  assert.ok(curriculum.nextAsks.some((item) => item.do === "approve-curriculum-shortlist"));
  assert.ok(curriculum.topics[0].signalClass === "user");
  assert.ok(
    curriculum.topics.some(
      (topic) => topic.signalClass === "naming-heuristic" || topic.signalClass === "ast",
    ),
  );
  const markdown = renderCurriculumMarkdown(curriculum);
  assert.match(markdown, /focused topics/); // Don't match the exact number, it varies
  assert.match(markdown, /Purpose and critical workflows/);
});

test("explicit curriculum-only batch mode returns exactly the requested lesson batch", () => {
  const curriculum = planCurriculum(largeModel(), { batchOnly: true, batchSize: 3 });
  assert.equal(curriculum.delivery.mode, "batch-only");
  assert.equal(curriculum.topics.length, 3);
  assert.deepEqual(
    curriculum.delivery.sessionBatch,
    curriculum.topics.map((topic) => topic.id),
  );
});

test("batch-only selection keeps three mechanisms visible with bounded alternates", () => {
  const curriculum = planCurriculum(mechanismModel(), { batchOnly: true, batchSize: 3 });
  assert.equal(new Set(curriculum.topics.map((topic) => topic.mechanismFamily)).size, 3);
  assert.ok(curriculum.topics.every((topic) => topic.selection.evidence.length > 0));
  assert.ok(curriculum.proposal.alternates.length >= 6);
  assert.ok(
    curriculum.proposal.alternates.every(
      (topic) =>
        !curriculum.topics.some((selected) => selected.id === topic.id) && topic.demotionReason,
    ),
  );
  assert.ok(
    [...curriculum.topics, ...curriculum.proposal.alternates].some(
      (topic) => topic.mechanismFamily === "state-lifecycle",
    ),
  );
});

test("explicit focus overrides diversification and summary stays decision-sized", () => {
  const curriculum = planCurriculum(mechanismModel(), {
    batchOnly: true,
    batchSize: 3,
    focus: "policy.ts",
  });
  assert.equal(curriculum.topics[0].focus, "app/security/policy.ts");
  assert.equal(curriculum.topics[0].selection.reason, "explicit-focus-override");
  const summary = curriculumDecisionSummary(curriculum);
  assert.equal(summary.coverage.parserDiagnostics, undefined);
  assert.equal(summary.proposal.alternates.length, curriculum.proposal.alternates.length);
  assert.ok(Buffer.byteLength(JSON.stringify(summary)) < 12_000);
});

test("written curriculum topics become lesson links", () => {
  const curriculum = planCurriculum(largeModel());
  curriculum.topics[0].status = "written";
  curriculum.topics[0].lessonPath = "lessons/customer-checkout.md";
  const markdown = renderCurriculumMarkdown(curriculum);
  assert.match(markdown, /\[Customer checkout\]\(lessons\/customer-checkout\.md\)/);
  assert.match(markdown, /1 lesson is written/);
});

test("lesson guardrails reject overloaded and unsupported drafts", () => {
  const result = inspectLesson("## Predict\n\nThis is robust and scalable.\n", {
    depth: "balanced",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => /split this subject|at least 450/.test(item)));
  assert.ok(result.errors.some((item) => /process labels/.test(item)));
  assert.ok(result.errors.some((item) => /two verified/.test(item)));
});
