// @category C2
// 0.6: evaluate-skill scores real fixtures; empty-mock cannot green.
import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import { evaluateCurriculum } from "../../../src/evaluation/evaluation.js";
import { planCurriculum } from "../../../src/curriculum/curriculum-planning.js";
import { buildProgramModel } from "../../../src/program/program-intelligence.js";
import { resolveTargetRoot } from "../../../src/foundations/targeting.js";

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const captureFixture = resolve(root, "test/fixtures/evaluation/capture-settle-retrieve");

test("empty curriculum fails must-find expectations (no empty-mock green)", () => {
  const expectations = {
    version: 1,
    name: "mock",
    topics: [
      {
        id: "billing-capture",
        intent: "must-find",
        matchFocus: "capture",
        description: "must appear",
      },
    ],
    workflows: [],
    lessons: {},
    allowedSideEffects: [],
  };
  const evaluation = evaluateCurriculum({ topics: [] }, expectations);
  assert.equal(evaluation.ok, false);
  assert.equal(evaluation.totalGenerated, 0);
  assert.ok(evaluation.missingMustFind.length > 0);
});

test("planCurriculum on capture-settle fixture covers must-find capture", async () => {
  // Fixture lives inside skill → copy outside skill root for resolveTargetRoot.
  const tempRoot = await mkdtemp(resolve(tmpdir(), "repay-eval-capture-"));
  try {
    await cp(captureFixture, tempRoot, {
      recursive: true,
      filter: (src) => {
        const base = src.split(/[/\\]/).pop();
        return base !== "expectations.json" && base !== "lesson.md";
      },
    });
    const model = await buildProgramModel(await resolveTargetRoot(tempRoot));
    const curriculum = planCurriculum(model);
    assert.ok(curriculum.topics.length > 0, "expected non-empty planned topics");
    const evaluation = evaluateCurriculum(curriculum, {
      version: 1,
      name: "capture-settle-retrieve",
      topics: [
        {
          id: "billing-capture",
          intent: "must-find",
          matchFocus: "capture",
          description: "Capture entry must appear",
        },
      ],
      workflows: [],
      lessons: {},
      allowedSideEffects: [],
    });
    assert.equal(evaluation.ok, true, JSON.stringify(evaluation.missingMustFind));
    assert.ok(evaluation.totalGenerated > 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("evaluate-skill CLI scores capture fixture from real curriculum (not empty mock)", async () => {
  let stdout = "";
  let code = 0;
  try {
    const result = await execute(
      process.execPath,
      [resolve(root, "scripts/evaluate-skill.js"), "--json"],
      { cwd: root, maxBuffer: 20 * 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch (err) {
    code = err.exitCode ?? err.code ?? 1;
    stdout = err.stdout ?? "";
  }
  assert.ok(stdout.length > 0, `evaluate-skill must emit JSON (code=${code})`);
  const results = JSON.parse(stdout);
  const capture = results.find((r) => r.fixture === "capture-settle-retrieve");
  assert.ok(capture, "capture-settle-retrieve must be scored");
  assert.notEqual(capture.source, "empty");
  assert.ok((capture.topicCount ?? capture.evaluation?.totalGenerated ?? 0) > 0);
  // empty-mock-blocked must appear as fail, never green
  for (const row of results) {
    if (row.error && /empty-mock-blocked/i.test(row.error)) {
      assert.equal(row.evaluation?.ok, false);
    }
  }
  assert.ok(code === 0 || code === 1);
});
