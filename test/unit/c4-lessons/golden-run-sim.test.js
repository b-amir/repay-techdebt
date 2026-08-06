// @category C4
/**
 * Golden-run mechanical simulation: real golden lessons pass craft+save floors;
 * adversarial fixtures refuse. No live model, no optional MCP.
 */
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import { evaluateLessonForSave } from "../../../src/lessons/save-lesson.js";
import { buildTrajectoryGate } from "../../../src/dialogue/trajectory.js";
import { recordJudgment } from "../../../src/lessons/lesson-judgment.js";
import { PASSING_JUDGMENT } from "../../helpers/passing-judgment.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const goldens = resolve(root, "test/fixtures/golden-lessons");
const evaluation = resolve(root, "test/fixtures/evaluation");

async function withDraft(markdown, fn) {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-golden-sim-"));
  const draft = resolve(directory, "draft.md");
  try {
    await writeFile(draft, markdown);
    await recordJudgment(draft, PASSING_JUDGMENT);
    return await fn(draft, directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("golden-run sim: path-with-map lesson evaluates ok on golden target", async () => {
  const target = resolve(goldens, "target");
  const md = await readFile(resolve(goldens, "a-path-with-map/lesson.md"), "utf8");
  await withDraft(md, async (draft) => {
    const result = await evaluateLessonForSave(target, md, {
      depth: "balanced",
      draftPath: draft,
      trajectoryGate: {
        gate: buildTrajectoryGate({ mode: "fast", purposeDone: true, verifyDone: null }),
      },
      inventoryPaths: ["billing/capture.js", "billing/settlement.js"],
      expectedEvidencePaths: ["billing/capture.js", "billing/settlement.js"],
    });
    assert.equal(result.trajectory.refuse, false);
    assert.equal(result.ok, true, result.quality.errors.join("; "));
  });
});

test("golden-run sim: deep-dive lesson evaluates craft-ok on golden target", async () => {
  const target = resolve(goldens, "target");
  const md = await readFile(resolve(goldens, "b-deep-dive/lesson.md"), "utf8");
  await withDraft(md, async (draft) => {
    const result = await evaluateLessonForSave(target, md, {
      depth: "concise",
      draftPath: draft,
      trajectoryGate: {
        gate: buildTrajectoryGate({ mode: "fast", purposeDone: true, verifyDone: null }),
      },
      inventoryPaths: ["billing/settlement.js", "billing/capture.js"],
      expectedEvidencePaths: ["billing/settlement.js"],
    });
    assert.equal(result.trajectory.refuse, false);
    assert.equal(result.ok, true, result.quality.errors.join("; "));
  });
});

test("golden-run sim: invented-graph adversarial does not save-ok with tight inventory", async () => {
  const md = await readFile(resolve(evaluation, "invented-graph-node/lesson.md"), "utf8").catch(
    () => null,
  );
  if (!md) return;
  const directory = await mkdtemp(resolve(tmpdir(), "repay-adv-sim-"));
  try {
    const draft = resolve(directory, "draft.md");
    await writeFile(draft, md);
    await recordJudgment(draft, PASSING_JUDGMENT);
    const result = await evaluateLessonForSave(directory, md, {
      depth: "balanced",
      draftPath: draft,
      trajectoryGate: {
        gate: buildTrajectoryGate({ mode: "fast", purposeDone: true, verifyDone: null }),
      },
      inventoryPaths: ["billing/capture.js"],
      expectedEvidencePaths: ["billing/capture.js"],
    });
    // Diagram or usefulness/subject gate must refuse hollow/invented content
    assert.equal(result.ok, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
