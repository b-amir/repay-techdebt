// @category C2
// 0.2–0.4: gate check, fail-closed save, plain-language refuse.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import {
  checkTrajectoryGate,
  buildTrajectoryGate,
  formatPathIncompleteReason,
  refuseSaveIfPathIncomplete,
} from "../../../src/dialogue/trajectory.js";
import { evaluateLessonForSave } from "../../../src/lessons/save-lesson.js";
import { recordJudgment } from "../../../src/lessons/lesson-judgment.js";
import { PASSING_JUDGMENT } from "../../helpers/passing-judgment.js";

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const completeGate = () =>
  buildTrajectoryGate({ mode: "fast", purposeDone: true, verifyDone: null });

test("checkTrajectoryGate passes complete path", () => {
  const result = checkTrajectoryGate({ gate: completeGate() });
  assert.equal(result.ok, true);
  assert.equal(result.pathComplete, true);
  assert.deepEqual(result.missing, []);
});

test("checkTrajectoryGate fails missing purpose", () => {
  const result = checkTrajectoryGate({
    gate: buildTrajectoryGate({ mode: "fast", purposeDone: false, verifyDone: null }),
  });
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("purpose"));
});

test("checkTrajectoryGate fails architecture subject without map or skip", () => {
  const result = checkTrajectoryGate(
    { gate: completeGate() },
    { subject: "architecture", hasMapAnswers: false },
  );
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("map"));
});

test("checkTrajectoryGate accepts map skip on flow subject", () => {
  const gate = buildTrajectoryGate({
    mode: "fast",
    purposeDone: true,
    verifyDone: null,
    skipReasons: { map: "single helper; map would not teach" },
  });
  const result = checkTrajectoryGate({ gate }, { subject: "flow" });
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("legacy step list alone is not pathComplete", () => {
  const result = checkTrajectoryGate(["setup", "purpose", "shortlist"]);
  assert.equal(result.pathComplete, false);
  assert.equal(result.legacyFlowOnly, true);
});

test("formatPathIncompleteReason is plain language without field dumps", () => {
  const reason = formatPathIncompleteReason({
    pathComplete: false,
    missing: ["purpose", "verify"],
  });
  assert.match(reason, /Cannot save a durable lesson yet/i);
  assert.match(reason, /why you are studying/i);
  assert.doesNotMatch(reason, /purposeDone|pathComplete|verifyDone/);
});

test("refuseSaveIfPathIncomplete blocks incomplete gate", () => {
  const refused = refuseSaveIfPathIncomplete({
    gate: buildTrajectoryGate({ mode: "control", purposeDone: false, verifyDone: false }),
  });
  assert.equal(refused.refuse, true);
  assert.equal(refused.code, "path-incomplete");
  assert.doesNotMatch(refused.reason, /purposeDone/);
});

test("evaluateLessonForSave blocks incomplete trajectory (no soft escape)", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-save-path-"));
  try {
    await mkdir(resolve(directory, "billing"), { recursive: true });
    await writeFile(
      resolve(directory, "billing/capture.js"),
      "export function capturePayment(order) { return order; }\n",
    );
    await writeFile(
      resolve(directory, "billing/settlement.js"),
      'export function settle(id, amount) { return { id, amount, status: "settled" }; }\n',
    );
    const body = `# Capture path

## Why this matters
You need the handoff because funds move only after settle in billing/capture.js:1.

## Walk the path
Read billing/settlement.js:1 for the status stamp. The capture path matters because funds move only after settle. ${"The capture path matters because funds move only after settle. ".repeat(20)}

## Check yourself
Open billing/capture.js and point at the export.
`;
    const draft = resolve(directory, "draft.md");
    await writeFile(draft, body);
    await recordJudgment(draft, PASSING_JUDGMENT);

    const blocked = await evaluateLessonForSave(directory, body, {
      depth: "concise",
      draftPath: draft,
      trajectoryGate: null,
      skipCraftFloors: true,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.trajectory.refuse, true);
    assert.ok(blocked.quality.errors.some((e) => /Cannot save|incomplete|path/i.test(e)));
    assert.ok(!blocked.quality.errors.some((e) => /continue weaker/i.test(e)));

    const allowed = await evaluateLessonForSave(directory, body, {
      depth: "concise",
      draftPath: draft,
      trajectoryGate: { gate: completeGate() },
      skipCraftFloors: true,
    });
    // Trajectory must not refuse when gate complete (other floors may still fail)
    assert.equal(allowed.trajectory.refuse, false);
    assert.equal(allowed.trajectory.pathComplete, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("check-trajectory CLI fails incomplete gate and passes complete", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-traj-cli-"));
  try {
    const bad = resolve(directory, "bad.json");
    const good = resolve(directory, "good.json");
    await writeFile(
      bad,
      JSON.stringify({
        gate: { mode: "fast", purposeDone: false, verifyDone: null, skipReasons: {} },
      }),
    );
    await writeFile(good, JSON.stringify({ gate: completeGate() }));

    await assert.rejects(
      () =>
        execute(
          process.execPath,
          [resolve(root, "scripts/check-trajectory.js"), bad, "--format", "json"],
          {
            cwd: root,
          },
        ),
      (/** @type {any} */ err) => {
        const out = JSON.parse(err.stdout || "{}");
        assert.equal(out.pathComplete, false);
        assert.ok(out.reason);
        assert.doesNotMatch(out.reason, /purposeDone/);
        return err.exitCode === 2 || err.code === 2;
      },
    );

    const pass = await execute(
      process.execPath,
      [resolve(root, "scripts/check-trajectory.js"), good, "--format", "json"],
      { cwd: root },
    );
    const payload = JSON.parse(pass.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.pathComplete, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("check-trajectory --stub-workbook is legacy flow only (not path complete when checked)", async () => {
  const { stdout } = await execute(
    process.execPath,
    [resolve(root, "scripts/check-trajectory.js"), "--stub-workbook"],
    { cwd: root },
  );
  const trajectory = JSON.parse(stdout);
  assert.ok(Array.isArray(trajectory));
  const check = checkTrajectoryGate(trajectory);
  assert.equal(check.pathComplete, false);
});
