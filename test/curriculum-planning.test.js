import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { planCurriculum, renderCurriculumMarkdown } from "../scripts/lib/curriculum-planning.js";
import { inspectLesson } from "../scripts/lib/lesson-quality.js";

function largeModel() {
  const nodes = [{ id: "system:root", kind: "system", name: "large-app", path: "." }];
  const edges = [];
  for (let index = 0; index < 1200; index += 1) {
    const path = `app/features/feature-${Math.floor(index / 10)}/module-${index}.ts`;
    nodes.push({ id: `file:${index}`, kind: "file", name: `module-${index}.ts`, path });
    if (index > 0) edges.push({ kind: "imports", from: `file:${index}`, to: `file:${index - 1}` });
  }
  return {
    generatedAt: "2026-08-01T00:00:00.000Z",
    target: { root: "/tmp/large-app", scope: ".", excludedSkillPath: null },
    coverage: { modeledFiles: 1200 },
    nodes,
    edges,
    profile: {
      criticalWorkflows: ["customer checkout"],
      entryPoints: ["app/root.tsx"],
      components: [{ root: ".", manifests: ["package.json"], files: 1200 }],
      boundaryEvidence: [{ path: "app/features", confidence: 0.9, signals: ["relationship-hub"] }],
      uncertainties: ["Business priority still needs confirmation."],
    },
  };
}

test("large repositories receive a complete ranked subject inventory without arbitrary limits", () => {
  const curriculum = planCurriculum(largeModel());
  assert.equal(curriculum.repositorySize, "large");
  assert.ok(curriculum.topics.length > 150); // Ceilings are removed, so it can be 305
  assert.equal(curriculum.topics[0].focus, "customer checkout");
  assert.ok(curriculum.topics.every((topic) => topic.learnerOutcome && topic.evidencePaths));
  assert.equal(curriculum.role, "propose");
  assert.ok(curriculum.nextAsks.some((item) => item.do === "approve-curriculum-shortlist"));
  assert.ok(curriculum.topics[0].signalClass === "user");
  assert.ok(curriculum.topics.some((topic) => topic.signalClass === "naming-heuristic" || topic.signalClass === "ast"));
  const markdown = renderCurriculumMarkdown(curriculum);
  assert.match(markdown, /focused subjects/); // Don't match the exact number, it varies
  assert.match(markdown, /Purpose and critical workflows/);
});

test("written curriculum topics become lesson links", () => {
  const curriculum = planCurriculum(largeModel());
  curriculum.topics[0].status = "written";
  curriculum.topics[0].lessonPath = "lessons/customer-checkout.md";
  const markdown = renderCurriculumMarkdown(curriculum);
  assert.match(
    markdown,
    /\[Trace the Customer checkout workflow\]\(lessons\/customer-checkout\.md\)/,
  );
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
