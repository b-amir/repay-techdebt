import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import {
  assessClaimFaithfulness,
  isOmnibusTopic,
  parseClaimsBlock,
} from "../scripts/lib/claim-faithfulness.js";
import { validateAgentApproval } from "../scripts/lib/curriculum-approval.js";
import {
  stubWorkbookTrajectory,
  validateTrajectory,
  WORKBOOK_TRAJECTORY,
} from "../scripts/lib/trajectory.js";
import { planCurriculum } from "../scripts/lib/curriculum-planning.js";
import { evaluateCurriculum } from "../scripts/lib/evaluation.js";
import { validateFixture } from "../scripts/lib/evaluation-schema.js";
import { buildProgramModel } from "../scripts/lib/program-intelligence.js";
import { resolveTargetRoot } from "../scripts/lib/targeting.js";

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = resolve(root, "test/fixtures/evaluation");

test("omnibus topic detection and approval rejection", async () => {
  assert.equal(
    isOmnibusTopic({
      title: "Understand the whole application",
      focus: "src",
      learnerOutcome: "Complete overview of everything about the system",
    }),
    true,
  );
  assert.equal(
    isOmnibusTopic({
      title: "Follow capture into settle",
      focus: "billing/capture.js",
      learnerOutcome: "Explain the capture→settle handoff",
    }),
    false,
  );

  const curriculum = JSON.parse(
    await readFile(resolve(fixtures, "omnibus-topic/curriculum.json"), "utf8"),
  );
  const check = validateAgentApproval(curriculum);
  assert.equal(check.ok, false);
  assert.match(check.error, /Omnibus/);
});

test("claim faithfulness passes golden lesson and fails unfaithful claims", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-faith-"));
  try {
    await mkdir(resolve(directory, "billing"), { recursive: true });
    await writeFile(
      resolve(directory, "billing/capture.js"),
      await readFile(resolve(fixtures, "capture-settle-retrieve/billing/capture.js"), "utf8"),
    );
    await writeFile(
      resolve(directory, "billing/settlement.js"),
      await readFile(resolve(fixtures, "capture-settle-retrieve/billing/settlement.js"), "utf8"),
    );

    const golden = await readFile(resolve(fixtures, "golden-lesson/lesson.md"), "utf8");
    const claims = parseClaimsBlock(golden);
    assert.equal(claims.length, 2);
    const good = await assessClaimFaithfulness(directory, golden);
    assert.equal(good.mode, "explicit-claims");
    assert.equal(good.ok, true, good.problems.join("; "));

    const badMd = await readFile(resolve(fixtures, "unfaithful-claims/lesson.md"), "utf8");
    const bad = await assessClaimFaithfulness(directory, badMd);
    assert.equal(bad.ok, false);
    assert.ok(bad.problems.some((item) => /support:yes/i.test(item)));

    const lessonPath = resolve(directory, "bad.md");
    await writeFile(lessonPath, badMd);
    await assert.rejects(
      () =>
        execute(
          process.execPath,
          [resolve(root, "scripts/check-lesson-faithfulness.js"), directory, lessonPath],
          { cwd: root },
        ),
      (error) => error.exitCode === 2 || error.code === 2,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("workbook trajectory stub validates ask fidelity order", () => {
  const stub = stubWorkbookTrajectory();
  const result = validateTrajectory(stub, { mode: "workbook" });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.deepEqual(result.required, WORKBOOK_TRAJECTORY);

  const missing = stubWorkbookTrajectory({
    steps: stub.steps.filter((step) => step.id !== "B3"),
  });
  const failed = validateTrajectory(missing, { mode: "workbook" });
  assert.equal(failed.ok, false);
  assert.ok(failed.errors.some((item) => /B3/.test(item)));
});

test("check-trajectory CLI accepts stub workbook", async () => {
  const { stdout } = await execute(
    process.execPath,
    [resolve(root, "scripts/check-trajectory.js"), "--stub-workbook"],
    { cwd: root },
  );
  const trajectory = JSON.parse(stdout);
  const directory = await mkdtemp(resolve(tmpdir(), "repay-traj-cli-"));
  try {
    const path = resolve(directory, "t.json");
    await writeFile(path, JSON.stringify(trajectory));
    const check = await execute(
      process.execPath,
      [resolve(root, "scripts/check-trajectory.js"), path, "--mode", "workbook", "--format", "json"],
      { cwd: root },
    );
    assert.equal(JSON.parse(check.stdout).ok, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("capture-settle-retrieve fixture surfaces capture subjects and workflow edge", async () => {
  const expectations = validateFixture(
    JSON.parse(await readFile(resolve(fixtures, "capture-settle-retrieve/expectations.json"), "utf8")),
  );
  assert.ok(expectations.ok);

  const directory = await mkdtemp(resolve(tmpdir(), "repay-retrieve-"));
  try {
    await mkdir(resolve(directory, "billing"), { recursive: true });
    await writeFile(
      resolve(directory, "billing/capture.js"),
      await readFile(resolve(fixtures, "capture-settle-retrieve/billing/capture.js"), "utf8"),
    );
    await writeFile(
      resolve(directory, "billing/settlement.js"),
      await readFile(resolve(fixtures, "capture-settle-retrieve/billing/settlement.js"), "utf8"),
    );
    const curriculum = planCurriculum(
      await buildProgramModel(await resolveTargetRoot(directory)),
    );
    const topicEval = evaluateCurriculum(curriculum, expectations.data);
    assert.equal(topicEval.ok, true, JSON.stringify(topicEval.missingMustFind));
    assert.ok(
      curriculum.topics.some((topic) => /capture|billing|settle/i.test(`${topic.focus} ${topic.title}`)),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("evaluate-lesson reports floors and rubric proxies", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-eval-lesson-"));
  try {
    await mkdir(resolve(directory, "billing"), { recursive: true });
    await writeFile(
      resolve(directory, "billing/capture.js"),
      await readFile(resolve(fixtures, "capture-settle-retrieve/billing/capture.js"), "utf8"),
    );
    await writeFile(
      resolve(directory, "billing/settlement.js"),
      await readFile(resolve(fixtures, "capture-settle-retrieve/billing/settlement.js"), "utf8"),
    );
    // Pad golden lesson to satisfy concise word floor for evaluate-lesson.
    const golden = await readFile(resolve(fixtures, "golden-lesson/lesson.md"), "utf8");
    const padded = `${golden}\n\n${"The capture settle handoff keeps ownership clear for learners studying this payment path. ".repeat(20)}`;
    const lessonPath = resolve(directory, "lesson.md");
    await writeFile(lessonPath, padded);
    const { stdout } = await execute(
      process.execPath,
      [
        resolve(root, "scripts/evaluate-lesson.js"),
        directory,
        lessonPath,
        "--depth",
        "concise",
        "--format",
        "json",
      ],
      { cwd: root },
    );
    const payload = JSON.parse(stdout);
    assert.equal(payload.analyzer, "evaluate-lesson");
    assert.ok(payload.rubric?.dimensions?.correctness);
    assert.equal(payload.faithfulness.ok, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
