import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile, readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { test } from "vite-plus/test";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts", "teach-topic.js");
const memoryScript = resolve(root, "scripts", "project-memory.js");

function validConciseLesson() {
  return `## What you will learn

You will learn how the request boundary protects a change before data reaches the service. This matters because a caller should not be able to bypass the same rule through a second entry point. The lesson stays focused on one decision and one consequence. This is very important for security and reliability. Ensure you always follow these strict guidelines.

## Follow the request

The route in \`src/routes/admin.ts:12\` receives the input and delegates the access decision. Read that call before reading implementation details, because it establishes the contract the rest of the flow must preserve. The helper in \`src/auth/permission.ts:8\` returns the decision without owning navigation or presentation state.

The separation gives you a useful debugging order. Confirm the route input, confirm the helper result, and only then inspect the data operation. That sequence keeps an authorization symptom from being mistaken for a query or rendering defect.

## Why the boundary matters

The route owns entry behavior, while the helper owns the reusable permission rule. If you place a second copy of the rule in a component, direct navigation can follow a different path. Keeping one rule means each caller receives the same answer and tests can exercise the contract independently.

## Apply your learning

Your task is to identify where the database connection is passed into the validator. Predict what happens if it is unavailable, then read the error handler to verify.

Check your understanding by moving the permission check into a test wrapper. Ask yourself how the caller would know the request failed before data access began.
`;
}

async function writeLessonEvidence(target) {
  await mkdir(resolve(target, "src", "routes"), { recursive: true });
  await mkdir(resolve(target, "src", "auth"), { recursive: true });
  await writeFile(resolve(target, "src", "routes", "admin.ts"), "// route\n".repeat(12));
  await writeFile(resolve(target, "src", "auth", "permission.ts"), "// permission\n".repeat(8));
}

test("teach-topic workflow requires target and topic-id or next", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "workflow-"));
  try {
    await assert.rejects(
      execute(process.execPath, [script, directory], { cwd: root }),
      (err) => err.stderr.includes("Must specify --topic-id <id> or --next.")
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("teach-topic handles no curriculum gracefully", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "workflow-"));
  try {
    let stdout;
    try {
      const res = await execute(process.execPath, [script, directory, "--next"], { cwd: root });
      stdout = res.stdout;
    } catch (err) {
      stdout = err.stdout;
      if (!stdout && err.stderr) throw new Error(err.stderr);
    }
    const result = JSON.parse(stdout);
    assert.equal(result.status, "paused");
    assert.equal(result.requiredAction, "plan-curriculum");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("teach-topic runs a topic through investigation, drafting, review, and saving", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "workflow-full-"));
  try {
    // 0. Provide evidence files
    await writeLessonEvidence(directory);

    // 1. Initialize Memory
    await execute(process.execPath, [memoryScript, "init", directory, "--storage", "project-local", "--mode", "workbook", "--depth", "concise", "--yes"], { cwd: root });

    // 2. Generate Curriculum
    const curriculumData = {
      schemaVersion: 1,
      generatedAt: "2026-08-01T00:00:00.000Z",
      target: { root: await realpath(directory), scope: "." },
      repositorySize: "small",
      scale: {
        minimum: 12,
        target: 20,
        maximum: 30,
        availableCandidates: 1,
        selectedTopics: 1,
      },
      coverage: { modeledFiles: 1 },
      topics: [
        {
          id: "topic-123456789abc",
          rank: 1,
          tier: "start-here",
          chapter: "Entrypoints and user journeys",
          title: "Follow the request boundary",
          focus: "app.ts",
          learnerOutcome: "You will trace the request boundary and change it safely.",
          importance: 95,
          importanceReasons: ["Runtime entry"],
          evidencePaths: ["src/routes/admin.ts", "src/auth/permission.ts"],
          relationCount: 0,
          status: "planned",
          lessonPath: null,
          prerequisites: [],
          signals: []
        }
      ],
      unresolved: []
    };
    const inputPath = resolve(directory, "curriculum.json");
    await writeFile(inputPath, JSON.stringify(curriculumData));
    await execute(process.execPath, [memoryScript, "save-curriculum", directory, "--input", inputPath, "--yes"], { cwd: root });

    // 3. teach-topic --next (should pause to draft)
    let stdout;
    try {
      const res = await execute(process.execPath, [script, directory, "--next"], { cwd: root });
      stdout = res.stdout;
    } catch (err) {
      stdout = err.stdout;
      if (!stdout && err.stderr) throw new Error(err.stderr);
    }
    const result = JSON.parse(stdout);
    assert.equal(result.status, "paused");
    assert.equal(result.requiredAction, "draft-lesson");
    assert.equal(result.topicId, "topic-123456789abc");
    assert.ok(result.plan);

    // 4. teach-topic --next --draft <file> (should save)
    const draftPath = resolve(directory, "draft.md");
    await writeFile(draftPath, validConciseLesson());
    
    let stdout2;
    try {
      const res = await execute(process.execPath, [script, directory, "--next", "--draft", draftPath, "--depth", "concise"], { cwd: root });
      stdout2 = res.stdout;
    } catch (err) {
      stdout2 = err.stdout;
      if (!stdout2 && err.stderr) throw new Error(err.stderr);
    }
    const result2 = JSON.parse(stdout2);
    assert.equal(result2.status, "complete", JSON.stringify(result2, null, 2));
    assert.equal(result2.topicId, "topic-123456789abc");

  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
