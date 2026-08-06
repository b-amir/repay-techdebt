// @category C2
// 0.5: adversarial fixtures fail closed — wrong citation, secret-like, absence/heuristic.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import { evaluateLessonForSave } from "../../../src/lessons/save-lesson.js";
import { buildTrajectoryGate } from "../../../src/dialogue/trajectory.js";
import { isOmnibusTopic } from "../../../src/curriculum/curriculum-policy.js";
import { validateAgentApproval } from "../../../src/curriculum/curriculum-approval.js";
import { recordJudgment } from "../../../src/lessons/lesson-judgment.js";
import { PASSING_JUDGMENT } from "../../helpers/passing-judgment.js";

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fixtures = resolve(root, "test/fixtures/evaluation");

const completeGate = () =>
  buildTrajectoryGate({ mode: "fast", purposeDone: true, verifyDone: null });

test("poisoned citation fixture fails closed (no warn-and-save)", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-adv-cite-"));
  try {
    await mkdir(resolve(directory, "billing"), { recursive: true });
    await writeFile(
      resolve(directory, "billing/capture.js"),
      "export function capturePayment() { return 1; }\n",
    );
    const poisoned = await readFile(resolve(fixtures, "poisoned-citation/lesson.md"), "utf8");
    const padded = `${poisoned}\n\n${"The capture path matters because funds move only after settle. ".repeat(25)}`;
    const draft = resolve(directory, "draft.md");
    await writeFile(draft, padded);
    await recordJudgment(draft, PASSING_JUDGMENT);

    const result = await evaluateLessonForSave(directory, padded, {
      depth: "concise",
      draftPath: draft,
      trajectoryGate: { gate: completeGate() },
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.quality.errors.some((e) => /citation|evidence|resolve|source/i.test(e)),
      `expected citation refuse, got: ${result.quality.errors.join("; ")}`,
    );
    assert.ok(!result.quality.errors.some((e) => /continue weaker/i.test(e)));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("secret-like snippet fails closed via check-snippet-secrets", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-adv-secret-"));
  try {
    const filePath = resolve(directory, "candidate.txt");
    // Same credential shape as c6-cli-integration Secretlint test.
    const candidate = ["ghp", "_", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghij"].join("");
    await writeFile(filePath, candidate);
    await assert.rejects(
      () =>
        execute(
          process.execPath,
          [resolve(root, "scripts/check-snippet-secrets.js"), directory, filePath],
          { cwd: root },
        ),
      (/** @type {any} */ error) => {
        // Non-zero exit = fail closed (refuse save path uses same Secretlint engine).
        return (error.exitCode ?? error.code) === 2;
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("absence/heuristic omnibus curriculum fails closed (approval + omnibus)", async () => {
  const curriculum = JSON.parse(
    await readFile(resolve(fixtures, "omnibus-topic/curriculum.json"), "utf8"),
  );
  assert.equal(
    isOmnibusTopic(curriculum.topics[0]),
    true,
    "fixture topic must be omnibus (whole-application)",
  );
  const check = validateAgentApproval(curriculum);
  assert.equal(check.ok, false);
  assert.match(check.error, /Omnibus/i);

  // Unfaithful absence-style CLAIMS also refuse save.
  const directory = await mkdtemp(resolve(tmpdir(), "repay-adv-absent-"));
  try {
    await mkdir(resolve(directory, "billing"), { recursive: true });
    await writeFile(
      resolve(directory, "billing/capture.js"),
      await readFile(resolve(fixtures, "capture-settle-retrieve/billing/capture.js"), "utf8"),
    );
    const badMd = await readFile(resolve(fixtures, "unfaithful-claims/lesson.md"), "utf8");
    const padded = `${badMd}\n\n${"The capture path matters because funds move only after settle. ".repeat(25)}`;
    const draft = resolve(directory, "draft.md");
    await writeFile(draft, padded);
    await recordJudgment(draft, PASSING_JUDGMENT);
    const result = await evaluateLessonForSave(directory, padded, {
      depth: "concise",
      draftPath: draft,
      trajectoryGate: { gate: completeGate() },
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.quality.errors.some((e) => /support:yes|faithful|claim/i.test(e)),
      `expected faithfulness refuse: ${result.quality.errors.join("; ")}`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
