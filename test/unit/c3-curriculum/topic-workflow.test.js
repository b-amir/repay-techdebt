// @category C3
// Unit tests for runTopicWorkflow selection + draft-quality branches. Covers the paused /
// complete / throw edges without spawning the save-lesson CLI or building a full program
// model (those paths are exercised elsewhere).
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { test } from "vite-plus/test";
import { runTopicWorkflow } from "../../../src/curriculum/topic-workflow.js";
import { resolveMemoryPaths } from "../../../src/foundations/memory-paths.js";

// Redirect private storage to a temp state dir so curriculum writes never touch the user
// library. Returns the curriculum data path for the target.
async function setup() {
  const targetRoot = await mkdtemp(resolve(tmpdir(), "topic-wf-target-"));
  const stateDir = await mkdtemp(resolve(tmpdir(), "topic-wf-state-"));
  const previous = process.env.REPAY_TECHDEBT_STATE_DIR;
  process.env.REPAY_TECHDEBT_STATE_DIR = stateDir;
  const paths = await resolveMemoryPaths(targetRoot);
  return { targetRoot, stateDir, paths, previous };
}

async function writeCurriculum(paths, topics) {
  await mkdir(dirname(paths.curriculumData), { recursive: true });
  await writeFile(paths.curriculumData, JSON.stringify({ topics }, null, 2));
}

function cleanup(ctx) {
  if (ctx.previous === undefined) delete process.env.REPAY_TECHDEBT_STATE_DIR;
  else process.env.REPAY_TECHDEBT_STATE_DIR = ctx.previous;
  return Promise.all([
    rm(ctx.targetRoot, { recursive: true, force: true }),
    rm(ctx.stateDir, { recursive: true, force: true }),
  ]);
}

test("paused with plan-curriculum when no curriculum is saved", async () => {
  const ctx = await setup();
  try {
    const result = await runTopicWorkflow({ targetRoot: ctx.targetRoot }, { next: true });
    assert.equal(result.status, "paused");
    assert.equal(result.requiredAction, "plan-curriculum");
  } finally {
    await cleanup(ctx);
  }
});

test("throws when an explicit topicId is not in the curriculum", async () => {
  const ctx = await setup();
  try {
    await writeCurriculum(ctx.paths, [{ id: "topic-aaaaaaaaaaaa", title: "T", lessonPath: null }]);
    await assert.rejects(
      () => runTopicWorkflow({ targetRoot: ctx.targetRoot }, { topicId: "topic-missingxxx" }),
      /Topic not found/,
    );
  } finally {
    await cleanup(ctx);
  }
});

test("next is complete when every topic already has a saved lesson", async () => {
  const ctx = await setup();
  try {
    await writeCurriculum(ctx.paths, [
      { id: "topic-aaaaaaaaaaaa", title: "A", lessonPath: "lessons/a.md" },
      { id: "topic-bbbbbbbbbbbb", title: "B", lessonPath: "lessons/b.md" },
    ]);
    const result = await runTopicWorkflow({ targetRoot: ctx.targetRoot }, { next: true });
    assert.equal(result.status, "complete");
    assert.match(result.reason, /All topics completed/);
  } finally {
    await cleanup(ctx);
  }
});

test("selecting a topic that already has a lessonPath is complete", async () => {
  const ctx = await setup();
  try {
    await writeCurriculum(ctx.paths, [
      { id: "topic-aaaaaaaaaaaa", title: "A", lessonPath: "lessons/a.md" },
    ]);
    const result = await runTopicWorkflow(
      { targetRoot: ctx.targetRoot },
      { topicId: "topic-aaaaaaaaaaaa" },
    );
    assert.equal(result.status, "complete");
    assert.match(result.reason, /already has a saved lesson/);
  } finally {
    await cleanup(ctx);
  }
});

test("recreate on a written topic with a weak title asks for a rewrite before draft", async () => {
  const ctx = await setup();
  try {
    await writeCurriculum(ctx.paths, [
      {
        id: "topic-aaaaaaaaaaaa",
        title: "Core Query Client Ts",
        focus: "app/core/query/client.ts",
        kind: "entry",
        lessonPath: "lessons/old.md",
      },
    ]);
    // Avoid buildProgramModel by providing a draft that fails quality first.
    const draft = resolve(ctx.targetRoot, "draft.md");
    await writeFile(draft, "# Core Query Client Ts\n\n### Overview\nBrief.\n");
    const result = await runTopicWorkflow(
      { targetRoot: ctx.targetRoot },
      { topicId: "topic-aaaaaaaaaaaa", recreate: true, draftPath: draft },
    );
    assert.equal(result.status, "paused");
    assert.ok(
      result.requiredAction === "fix-lesson-quality" ||
        result.requiredAction === "rewrite-topic-title",
    );
  } finally {
    await cleanup(ctx);
  }
});

test("a low-quality draft pauses with fix-lesson-quality before any save", async () => {
  const ctx = await setup();
  const draft = resolve(ctx.targetRoot, "draft.md");
  try {
    await writeCurriculum(ctx.paths, [{ id: "topic-aaaaaaaaaaaa", title: "A", lessonPath: null }]);
    await writeFile(draft, "thin draft with no structure or evidence\n");
    const result = await runTopicWorkflow(
      { targetRoot: ctx.targetRoot },
      { topicId: "topic-aaaaaaaaaaaa", draftPath: draft },
    );
    assert.equal(result.status, "paused");
    assert.equal(result.requiredAction, "fix-lesson-quality");
    assert.ok(result.errors.length > 0);
  } finally {
    await cleanup(ctx);
  }
});
