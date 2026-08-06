// @category C5
// Workbook viewer + always-workbook persistence: mini-curriculum, save-lesson linkage, loopback server.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execa } from "execa";
import { test } from "vite-plus/test";
import { buildTeachingCurriculum } from "../../src/curriculum/index.js";
import { createViewerServer } from "../../src/viewer/index.js";
import { recordJudgment } from "../../src/lessons/lesson-judgment.js";
import { PASSING_JUDGMENT } from "../helpers/passing-judgment.js";
import { completeTrajectoryGatePayload } from "../helpers/complete-trajectory-gate.js";
import { craftCompleteConciseLesson } from "../helpers/craft-complete-lesson.js";

const root = resolve(import.meta.dirname, "..", "..");
const memoryScript = resolve(root, "scripts", "project-memory.js");

async function writeCompleteGate(memoryRoot) {
  await writeFile(
    resolve(memoryRoot, "trajectory-gate.json"),
    `${JSON.stringify(completeTrajectoryGatePayload(), null, 2)}\n`,
  );
}

function validConciseLesson() {
  return craftCompleteConciseLesson();
}

async function writeLessonEvidence(target) {
  await mkdir(resolve(target, "src", "routes"), { recursive: true });
  await mkdir(resolve(target, "src", "auth"), { recursive: true });
  await writeFile(resolve(target, "src", "routes", "admin.ts"), "// route\n".repeat(12));
  await writeFile(resolve(target, "src", "auth", "permission.ts"), "// permission\n".repeat(8));
}

async function runMemory(args, env = {}) {
  const result = await execa(process.execPath, [memoryScript, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    reject: false,
    timeout: 120_000,
  });
  return {
    code: result.exitCode,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

async function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolveListen(port);
    });
    server.once("error", reject);
  });
}

test("save-lesson without curriculum exits workbook-linkage-required", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-c5-linkage-"));
  const draft = resolve(target, "draft.md");
  try {
    await writeLessonEvidence(target);
    const init = await runMemory([
      "init",
      target,
      "--sharing",
      "local",
      "--depth",
      "concise",
      "--yes",
    ]);
    assert.equal(init.code, 0, init.stderr);
    const orphanInit = JSON.parse(init.stdout);
    await writeCompleteGate(orphanInit.memoryRoot);
    await writeFile(draft, validConciseLesson());
    await recordJudgment(draft, PASSING_JUDGMENT);
    const saved = await runMemory([
      "save-lesson",
      target,
      "--title",
      "Orphan attempt",
      "--input",
      draft,
      "--yes",
    ]);
    assert.equal(saved.code, 2);
    assert.equal(JSON.parse(saved.stdout).type, "workbook-linkage-required");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("mini-curriculum save-lesson exposes viewer hint and server lists the lesson", async () => {
  const base = await mkdtemp(resolve(tmpdir(), "repay-c5-viewer-"));
  const target = resolve(base, "app");
  const draft = resolve(base, "lesson.md");
  const environment = { REPAY_TECHDEBT_STATE_DIR: resolve(base, "state") };
  try {
    await writeLessonEvidence(target);
    await writeFile(draft, validConciseLesson());
    await recordJudgment(draft, PASSING_JUDGMENT);

    const init = await runMemory(
      ["init", target, "--output-location", "sister", "--depth", "concise", "--yes"],
      environment,
    );
    assert.equal(init.code, 0, init.stderr);
    const viewerInit = JSON.parse(init.stdout);
    const outputRoot = viewerInit.outputRoot;
    await writeCompleteGate(viewerInit.memoryRoot);

    const canonicalTarget = await realpath(target);
    const curriculum = buildTeachingCurriculum({
      targetRoot: canonicalTarget,
      approvedAt: "2026-08-02T12:00:00.000Z",
      subjects: [
        {
          title: "Request boundary",
          focus: "admin route permission boundary",
          evidencePaths: ["src/routes/admin.ts", "src/auth/permission.ts"],
        },
      ],
    });
    const curriculumPath = resolve(base, "mini.json");
    await writeFile(curriculumPath, JSON.stringify(curriculum, null, 2));
    const savedCurr = await runMemory(
      ["save-curriculum", target, "--input", curriculumPath, "--yes"],
      environment,
    );
    assert.equal(savedCurr.code, 0, savedCurr.stderr);

    const topicId = curriculum.topics[0].id;
    const savedLesson = await runMemory(
      [
        "save-lesson",
        target,
        "--topic-id",
        topicId,
        "--title",
        "Request boundary",
        "--input",
        draft,
        "--yes",
      ],
      environment,
    );
    assert.equal(savedLesson.code, 0, savedLesson.stderr);
    const payload = JSON.parse(savedLesson.stdout);
    assert.equal(payload.type, "lesson-saved");
    assert.equal(payload.viewer.command, "repay view");
    assert.equal(payload.viewer.deepLinkRel, payload.file);
    assert.equal(payload.viewer.openRecommended, true);

    const workbook = {
      ready: true,
      targetRoot: target,
      workbookRoot: outputRoot,
      lessonsDir: resolve(outputRoot, "lessons"),
      indexPath: resolve(outputRoot, "INDEX.md"),
      progressPath: resolve(outputRoot, "progress.json"),
      curriculumPath: resolve(
        environment.REPAY_TECHDEBT_STATE_DIR,
        "projects",
        "*",
        "memory",
        "curriculum.json",
      ),
    };
    // Resolve curriculum path from status
    const status = await runMemory(["status", target, "--format", "json"], environment);
    const memoryRoot = JSON.parse(status.stdout).memoryRoot;
    workbook.curriculumPath = resolve(memoryRoot, "curriculum.json");

    const server = createViewerServer({
      workbook,
      now: () => "2026-08-02T12:00:00.000Z",
    });
    const port = await listen(server);
    const lessonKey = payload.file;
    const lessonRes = await fetch(
      `http://127.0.0.1:${port}/lesson/${encodeURIComponent(lessonKey)}`,
    );
    assert.equal(lessonRes.status, 200);
    const html = await lessonRes.text();
    assert.match(html, /ds-shell/);
    assert.match(html, /Request boundary/);
    assert.match(html, /Mark as done/);
    assert.match(html, /ds-lesson-footer-nav/);
    assert.match(html, /ds-lesson-footer/);

    const completion = await fetch(`http://127.0.0.1:${port}/api/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: lessonKey, completed: true, topicId }),
    });
    assert.equal(completion.status, 200);
    const progress = JSON.parse(await readFile(workbook.progressPath, "utf8"));
    assert.ok(progress.completed[lessonKey]);
    server.close();
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("planned topic page is clickable and shows --create instruction", async () => {
  const base = await mkdtemp(resolve(tmpdir(), "repay-c5-planned-"));
  const target = resolve(base, "app");
  const draft = resolve(base, "lesson.md");
  const environment = { REPAY_TECHDEBT_STATE_DIR: resolve(base, "state") };
  try {
    await writeLessonEvidence(target);
    await writeFile(draft, validConciseLesson());
    await recordJudgment(draft, PASSING_JUDGMENT);

    const init = await runMemory(
      ["init", target, "--output-location", "sister", "--depth", "concise", "--yes"],
      environment,
    );
    assert.equal(init.code, 0, init.stderr);
    const plannedInit = JSON.parse(init.stdout);
    const outputRoot = plannedInit.outputRoot;
    await writeCompleteGate(plannedInit.memoryRoot);
    const canonicalTarget = await realpath(target);

    const curriculum = buildTeachingCurriculum({
      targetRoot: canonicalTarget,
      approvedAt: "2026-08-02T12:00:00.000Z",
      subjects: [
        {
          title: "Written topic",
          focus: "written-boundary",
          evidencePaths: ["src/routes/admin.ts", "src/auth/permission.ts"],
        },
        {
          title: "Planned topic",
          focus: "planned-boundary",
          evidencePaths: ["src/routes/admin.ts"],
        },
      ],
    });
    const curriculumPath = resolve(base, "mini.json");
    await writeFile(curriculumPath, JSON.stringify(curriculum, null, 2));
    await runMemory(["save-curriculum", target, "--input", curriculumPath, "--yes"], environment);

    const writtenTopicId = curriculum.topics[0].id;
    const plannedTopicId = curriculum.topics[1].id;
    await runMemory(
      [
        "save-lesson",
        target,
        "--topic-id",
        writtenTopicId,
        "--title",
        "Written topic",
        "--input",
        draft,
        "--yes",
      ],
      environment,
    );

    const status = await runMemory(["status", target, "--format", "json"], environment);
    const memoryRoot = JSON.parse(status.stdout).memoryRoot;
    const server = createViewerServer({
      workbook: {
        ready: true,
        targetRoot: canonicalTarget,
        workbookRoot: outputRoot,
        lessonsDir: resolve(outputRoot, "lessons"),
        indexPath: resolve(outputRoot, "INDEX.md"),
        progressPath: resolve(outputRoot, "progress.json"),
        curriculumPath: resolve(memoryRoot, "curriculum.json"),
      },
      now: () => "2026-08-02T12:00:00.000Z",
    });
    const port = await listen(server);
    const plannedRes = await fetch(
      `http://127.0.0.1:${port}/planned/${encodeURIComponent(plannedTopicId)}`,
    );
    assert.equal(plannedRes.status, 200);
    const html = await plannedRes.text();
    assert.match(html, /Not written yet/);
    assert.match(html, /Planned topic/);
    assert.match(html, new RegExp(`/repay-techdebt --create ${plannedTopicId}`));
    assert.match(html, /ds-btn-copy/);
    assert.doesNotMatch(html, /teach-topic\.js/);
    assert.doesNotMatch(html, /<skill-root>/);
    server.close();
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
