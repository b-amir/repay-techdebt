// @category C5
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import { buildTeachingCurriculum } from "../../src/curriculum/index.js";
import { recordJudgment } from "../../src/lessons/lesson-judgment.js";
import { PASSING_JUDGMENT } from "../helpers/passing-judgment.js";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "../..");
const script = resolve(root, "scripts", "project-memory.js");

function validConciseLesson() {
  return `## What you will learn

You will learn how the request boundary protects a change before data reaches the service. This matters because a caller should not be able to bypass the same rule through a second entry point. The lesson stays focused on one decision and one consequence.

## Follow the request

The route in \`src/routes/admin.ts:12\` receives the input and delegates the access decision. Read that call before reading implementation details, because it establishes the contract the rest of the flow must preserve. The helper in \`src/auth/permission.ts:8\` returns the decision without owning navigation or presentation state.

The separation gives you a useful debugging order. Confirm the route input, confirm the helper result, and only then inspect the data operation. That sequence keeps an authorization symptom from being mistaken for a query or rendering defect.

## Why the boundary matters

The route owns entry behavior, while the helper owns the reusable permission rule. If you place a second copy of the rule in a component, direct navigation can follow a different path. Keeping one rule means each caller receives the same answer and tests can exercise the contract independently.

## Change it safely

When you add an action, identify its route, the permission it requires, and the forbidden result. Update the shared helper only when the underlying policy changes. Then verify an allowed user, a forbidden user, and direct entry. This protects the user-visible flow and the server-side boundary together.

## Check your understanding

Trace one neighboring action from its route to the permission helper. Explain which file owns the policy and which file owns the response. Then predict what would happen if a component hid the button but the route omitted its guard. Your answer should name the bypass path and the test that would expose it.
`;
}

async function writeLessonEvidence(target) {
  await mkdir(resolve(target, "src", "routes"), { recursive: true });
  await mkdir(resolve(target, "src", "auth"), { recursive: true });
  await writeFile(resolve(target, "src", "routes", "admin.ts"), "// route\n".repeat(12));
  await writeFile(resolve(target, "src", "auth", "permission.ts"), "// permission\n".repeat(8));
}

async function run(args, environment = {}) {
  try {
    const result = await execute(process.execPath, [script, ...args], {
      cwd: root,
      env: { ...process.env, ...environment },
      maxBuffer: 20 * 1024 * 1024,
      timeout: 120_000,
    });
    return { code: 0, ...result };
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

async function absent(path) {
  try {
    await access(path);
    return false;
  } catch {
    return true;
  }
}

async function saveTeachingCurriculum(target, subjects, environment = {}) {
  const targetRoot = await realpath(target);
  const curriculum = buildTeachingCurriculum({
    targetRoot,
    approvedAt: "2026-08-02T12:00:00.000Z",
    subjects,
  });
  const curriculumPath = resolve(targetRoot, ".repay-teaching-curriculum.json");
  await writeFile(curriculumPath, `${JSON.stringify(curriculum, null, 2)}\n`);
  const saved = await run(
    ["save-curriculum", target, "--input", curriculumPath, "--yes"],
    environment,
  );
  assert.equal(saved.code, 0, saved.stderr);
  return curriculum;
}

test("first run is read-only and initialization requires explicit consent", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-first-"));
  const memoryRoot = resolve(target, ".repay-techdebt");
  try {
    const status = await run(["status", target, "--format", "json"]);
    assert.equal(status.code, 0);
    assert.equal(JSON.parse(status.stdout).type, "first-run");
    assert.equal(await absent(memoryRoot), true);
    assert.equal(await absent(resolve(target, ".graphifyignore")), true);

    const proposed = await run([
      "init",
      target,
      "--sharing",
      "local",
      "--mode",
      "ask",
      "--depth",
      "balanced",
      "--save-policy",
      "ask",
    ]);
    assert.equal(proposed.code, 2);
    assert.equal(JSON.parse(proposed.stdout).type, "consent-required");
    assert.equal(await absent(memoryRoot), true);
    assert.equal(await absent(resolve(target, ".graphifyignore")), true);
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("default private memory persists externally without changing the target", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-private-target-"));
  const privateBase = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-private-state-"));
  const cacheBase = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-private-cache-"));
  const environment = {
    REPAY_TECHDEBT_STATE_DIR: privateBase,
    REPAY_TECHDEBT_CACHE_DIR: cacheBase,
  };
  let outputRoot;
  try {
    await writeFile(resolve(target, "source.ts"), "export const source = true;\n");
    const before = await readdir(target);
    const initialized = await run(["init", target, "--yes"], environment);
    assert.equal(initialized.code, 0, initialized.stderr);
    const result = JSON.parse(initialized.stdout);
    outputRoot = result.outputRoot;
    assert.equal(result.config.sharing, "private");
    assert.equal(result.config.storage.mode, "private");
    assert.deepEqual(result.targetWrites, []);
    assert.equal(result.memoryRoot.startsWith(privateBase), true);
    assert.match(result.outputRoot, /repay-repay-techdebt-memory-private-target-.*-techdebt$/);
    assert.equal(await absent(resolve(target, ".repay-techdebt")), true);
    assert.equal(await absent(resolve(target, ".gitignore")), true);
    assert.equal(await absent(resolve(target, ".graphifyignore")), true);
    assert.deepEqual((await readdir(target)).sort(), before.sort());

    const status = await run(["status", target, "--format", "json"], environment);
    assert.equal(status.code, 0, status.stderr);
    const report = JSON.parse(status.stdout);
    assert.equal(report.storageMode, "private");
    assert.equal(report.privateCacheRoot.startsWith(cacheBase), true);
    assert.equal(report.memoryRoot, result.memoryRoot);
  } finally {
    await rm(target, { force: true, recursive: true });
    await rm(privateBase, { force: true, recursive: true });
    await rm(cacheBase, { force: true, recursive: true });
    if (outputRoot) await rm(outputRoot, { force: true, recursive: true });
  }
});

test("initializes memory, saves a checked Markdown lesson, and records a decision", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-team-"));
  const draft = resolve(target, "lesson-draft.md");
  try {
    await writeLessonEvidence(target);
    await writeFile(draft, validConciseLesson());
    await recordJudgment(draft, PASSING_JUDGMENT);
    const initialized = await run([
      "init",
      target,
      "--sharing",
      "team",
      "--mode",
      "workbook",
      "--depth",
      "concise",
      "--output-location",
      "private",
      "--save-policy",
      "automatic",
      "--allow-non-git",
      "--yes",
    ]);
    assert.equal(initialized.code, 0, initialized.stderr);
    const initializedResult = JSON.parse(initialized.stdout);
    assert.equal(initializedResult.status, "ready");
    assert.equal(initializedResult.graphifyIgnoreUpdated, true);
    assert.match(await readFile(resolve(target, ".graphifyignore"), "utf8"), /\.repay-techdebt\//);

    const curriculum = await saveTeachingCurriculum(target, [
      {
        title: "Dependency Direction",
        focus: "dependency-direction-boundary",
        evidencePaths: ["src/routes/admin.ts", "src/auth/permission.ts"],
      },
    ]);
    const saved = await run([
      "save-lesson",
      target,
      "--topic-id",
      curriculum.topics[0].id,
      "--title",
      "Dependency Direction",
      "--input",
      draft,
      "--yes",
    ]);
    assert.equal(saved.code, 0, saved.stderr);
    const savedResult = JSON.parse(saved.stdout);
    assert.match(savedResult.file, /^lessons\/\d{4}-\d{2}-\d{2}-/);
    assert.match(
      await readFile(resolve(target, ".repay-techdebt", savedResult.file), "utf8"),
      /^# Dependency Direction/,
    );

    const recorded = await run([
      "record-decision",
      target,
      "--scope",
      "architecture",
      "--decision",
      "Teach domain boundaries first",
      "--reason",
      "They explain most call paths",
      "--yes",
    ]);
    assert.equal(recorded.code, 0, recorded.stderr);

    const status = await run(["status", target, "--format", "json"]);
    assert.equal(status.code, 0);
    const report = JSON.parse(status.stdout);
    assert.equal(report.targetRoot, await realpath(target));
    assert.equal(report.status, "ready-with-warning");
    assert.equal(report.config.sharing, "team");
    assert.equal(report.config.output.savePolicy, "automatic");
    assert.equal(report.lessonCount, 1);
    assert.match(
      await readFile(resolve(target, ".repay-techdebt", "decisions.md"), "utf8"),
      /Teach domain boundaries first/,
    );
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("local memory is added to the target gitignore", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-local-"));
  try {
    await writeFile(resolve(target, ".gitignore"), "node_modules/\n");
    const initialized = await run(["init", target, "--sharing", "local", "--yes"]);
    assert.equal(initialized.code, 0, initialized.stderr);
    const initializedResult = JSON.parse(initialized.stdout);
    assert.equal(initializedResult.gitignoreUpdated, true);
    assert.equal(initializedResult.graphifyIgnoreUpdated, true);
    assert.match(await readFile(resolve(target, ".gitignore"), "utf8"), /\.repay-techdebt\//);
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("schema v2 stores verified typed artifacts and strips notebook outputs", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-artifacts-"));
  try {
    const initialized = await run(["init", target, "--sharing", "local", "--yes"]);
    assert.equal(initialized.code, 0, initialized.stderr);
    assert.equal(JSON.parse(initialized.stdout).config.schemaVersion, 2);

    const snapshot = resolve(target, "snapshot.json");
    await writeFile(snapshot, `${JSON.stringify({ schemaVersion: 2, evidence: ["verified"] })}\n`);
    const refused = await run([
      "save-artifact",
      target,
      "--type",
      "snapshot",
      "--title",
      "Current model",
      "--input",
      snapshot,
      "--yes",
    ]);
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /require --verified/);
    const savedSnapshot = await run([
      "save-artifact",
      target,
      "--type",
      "snapshot",
      "--title",
      "Current model",
      "--input",
      snapshot,
      "--scope",
      "packages/api",
      "--evidence",
      "evidence:a,evidence:b",
      "--verified",
      "--yes",
    ]);
    assert.equal(savedSnapshot.code, 0, savedSnapshot.stderr);

    const notebook = resolve(target, "analysis.ipynb");
    await writeFile(
      notebook,
      `${JSON.stringify({
        nbformat: 4,
        nbformat_minor: 5,
        metadata: {},
        cells: [
          {
            cell_type: "code",
            metadata: {},
            source: ["print('safe')"],
            execution_count: 1,
            outputs: [
              {
                output_type: "stream",
                name: "stdout",
                text: ["runtime output"],
              },
            ],
          },
        ],
      })}\n`,
    );
    const savedNotebook = await run([
      "save-artifact",
      target,
      "--type",
      "notebook",
      "--title",
      "Experiment",
      "--input",
      notebook,
      "--yes",
    ]);
    assert.equal(savedNotebook.code, 0, savedNotebook.stderr);
    const notebookResult = JSON.parse(savedNotebook.stdout);
    const persisted = JSON.parse(
      await readFile(resolve(target, ".repay-techdebt", notebookResult.artifact.path), "utf8"),
    );
    assert.deepEqual(persisted.cells[0].outputs, []);
    assert.equal(persisted.cells[0].execution_count, null);
    assert.deepEqual(notebookResult.artifact.sanitization, {
      removedOutputs: 1,
    });
    assert.equal("content" in notebookResult.artifact.sanitization, false);

    const index = JSON.parse(
      await readFile(resolve(target, ".repay-techdebt", "artifacts", "index.json"), "utf8"),
    );
    assert.equal(index.artifacts.length, 2);
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("schema v1 remains readable and migration is explicit", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-migrate-"));
  try {
    await run(["init", target, "--sharing", "local", "--output-location", "private", "--yes"]);
    const root = resolve(target, ".repay-techdebt");
    const configPath = resolve(root, "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.schemaVersion = 1;
    delete config.analysis;
    delete config.output.artifactTypes;
    delete config.memory.typedArtifacts;
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    await rm(resolve(root, "artifacts"), { recursive: true, force: true });

    const legacy = JSON.parse((await run(["status", target, "--format", "json"])).stdout);
    assert.equal(legacy.status, "ready-with-warning");
    assert.ok(legacy.warnings.some((item) => /schema v1/.test(item)));

    const proposed = await run(["migrate", target]);
    assert.equal(proposed.code, 2);
    assert.equal(JSON.parse(proposed.stdout).type, "consent-required");
    assert.equal(JSON.parse(await readFile(configPath, "utf8")).schemaVersion, 1);

    const migrated = await run(["migrate", target, "--yes"]);
    assert.equal(migrated.code, 0, migrated.stderr);
    assert.equal(JSON.parse(await readFile(configPath, "utf8")).schemaVersion, 2);
    assert.equal((await run(["status", target, "--format", "json"])).code, 0);
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("team sharing is not implied for a non-Git target", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-nongit-"));
  try {
    const initialized = await run(["init", target, "--sharing", "team", "--yes"]);
    assert.equal(initialized.code, 2);
    const output = JSON.parse(initialized.stdout);
    assert.equal(output.type, "team-sharing-unavailable");
    assert.equal(await absent(resolve(target, ".repay-techdebt")), true);
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("status rejects incomplete memory instead of reporting ready", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-incomplete-"));
  try {
    await run(["init", target, "--sharing", "local", "--output-location", "private", "--yes"]);
    await rm(resolve(target, ".repay-techdebt", "decisions.md"));
    const status = await run(["status", target, "--format", "json"]);
    assert.equal(status.code, 1);
    assert.match(status.stderr, /decisions\.md/);
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("status detects saved lessons missing from the index", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-orphan-"));
  try {
    await run(["init", target, "--sharing", "local", "--output-location", "private", "--yes"]);
    await writeFile(
      resolve(target, ".repay-techdebt", "lessons", "2026-08-01-orphan.md"),
      "# Orphan\n",
    );
    const status = await run(["status", target, "--format", "json"]);
    assert.equal(status.code, 2);
    assert.equal(JSON.parse(status.stdout).type, "incomplete-lesson-index");
    const repaired = await run(["repair-index", target, "--yes"]);
    assert.equal(repaired.code, 0, repaired.stderr);
    assert.equal(JSON.parse(repaired.stdout).indexedLessons, 1);
    assert.equal((await run(["status", target, "--format", "json"])).code, 0);
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("status detects index entries whose lesson file is missing", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-dangling-"));
  try {
    await run(["init", target, "--sharing", "local", "--output-location", "private", "--yes"]);
    const index = resolve(target, ".repay-techdebt", "lessons", "index.md");
    await writeFile(
      index,
      `${await readFile(index, "utf8")}| 2026-08-01 | [Missing](./2026-08-01-missing.md) | ask |\n`,
    );
    const status = await run(["status", target, "--format", "json"]);
    assert.equal(status.code, 2);
    const output = JSON.parse(status.stdout);
    assert.equal(output.type, "incomplete-lesson-index");
    assert.deepEqual(output.missingLessons, ["2026-08-01-missing.md"]);
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("legacy schema-v1 memory safely defaults missing save policy to ask", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-legacy-"));
  try {
    await run(["init", target, "--sharing", "local", "--yes"]);
    const configPath = resolve(target, ".repay-techdebt", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    delete config.output.savePolicy;
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const status = await run(["status", target, "--format", "json"]);
    assert.equal(status.code, 0);
    const output = JSON.parse(status.stdout);
    assert.equal(output.config.output.savePolicy, "ask");
    assert.match(output.warnings[0], /safe legacy default/);
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("lesson lock prevents concurrent index rewrites", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-lock-"));
  const draft = resolve(target, "draft.md");
  const lock = resolve(target, ".repay-techdebt", ".lesson-index.lock");
  try {
    await writeLessonEvidence(target);
    await run([
      "init",
      target,
      "--sharing",
      "local",
      "--output-location",
      "private",
      "--depth",
      "concise",
      "--yes",
    ]);
    await writeFile(draft, validConciseLesson());
    await recordJudgment(draft, PASSING_JUDGMENT);
    await mkdir(lock);
    const status = await run(["status", target, "--format", "json"]);
    assert.equal(status.code, 2);
    assert.equal(JSON.parse(status.stdout).type, "lesson-index-locked");
    const saved = await run([
      "save-lesson",
      target,
      "--title",
      "Locked lesson",
      "--input",
      draft,
      "--yes",
    ]);
    assert.equal(saved.code, 1);
    assert.match(saved.stderr, /lesson save is active|stale lock/);
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("memory files are excluded from application pattern evidence", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-exclude-"));
  try {
    await run(["init", target, "--sharing", "team", "--allow-non-git", "--yes"]);
    await writeFile(resolve(target, "app.js"), "export const answer = 42;\n");
    await writeFile(
      resolve(target, ".repay-techdebt", "memory-code.js"),
      "export const hidden = Promise.all([]);\n",
    );
    const patterns = await execute(
      process.execPath,
      [resolve(root, "scripts", "find-patterns.js"), target, "--all"],
      { cwd: root, maxBuffer: 20 * 1024 * 1024, timeout: 120_000 },
    );
    const output = JSON.parse(patterns.stdout);
    assert.equal(output.scannedFiles, 1);
    assert.deepEqual(output.findings, []);
  } finally {
    await rm(target, { force: true, recursive: true });
  }
});

test("project memory refuses to initialize inside the skill repository", async () => {
  const result = await run(["init", root, "--yes"]);
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stderr).code, "TARGET_IS_SKILL");
});

test("discoverable workbook saves a curriculum first and links each lesson from INDEX.md", async () => {
  const base = await mkdtemp(resolve(tmpdir(), "repay-techdebt-workbook-flow-"));
  const target = resolve(base, "sample-app");
  const output = resolve(base, "repay-sample-app-techdebt");
  const state = resolve(base, "state");
  const cache = resolve(base, "cache");
  const environment = {
    REPAY_TECHDEBT_STATE_DIR: state,
    REPAY_TECHDEBT_CACHE_DIR: cache,
  };
  try {
    await mkdir(target);
    await writeLessonEvidence(target);
    await writeFile(resolve(target, "app.ts"), "export const app = true;\n");
    const initialized = await run(
      [
        "init",
        target,
        "--output-location",
        "custom",
        "--output-root",
        output,
        "--mode",
        "workbook",
        "--depth",
        "concise",
        "--yes",
      ],
      environment,
    );
    assert.equal(initialized.code, 0, initialized.stderr);
    assert.equal(JSON.parse(initialized.stdout).outputRoot, output);

    const curriculumPath = resolve(base, "curriculum.json");
    await writeFile(
      curriculumPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: "2026-08-01T00:00:00.000Z",
          target: { root: await realpath(target), scope: "." },
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
              signalClass: "naming-heuristic",
              status: "planned",
              lessonPath: null,
              prerequisites: [],
            },
          ],
          unresolved: [],
          agentApproval: {
            approvedAt: "2026-08-01T00:00:00.000Z",
            purposeStatus: "accepted",
            note: "test shortlist",
            corroboratedTopicIds: ["topic-123456789abc"],
            demotedTopicIds: [],
            acceptedPartialScope: null,
          },
        },
        null,
        2,
      )}\n`,
    );
    const tooSmallPath = resolve(base, "too-small-curriculum.json");
    const tooSmall = JSON.parse(await readFile(curriculumPath, "utf8"));
    tooSmall.coverage.modeledFiles = 1200;
    tooSmall.scale.availableCandidates = 100;
    await writeFile(tooSmallPath, `${JSON.stringify(tooSmall, null, 2)}\n`);
    const refusedCurriculum = await run(
      ["save-curriculum", target, "--input", tooSmallPath, "--yes"],
      environment,
    );
    assert.equal(refusedCurriculum.code, 1);
    assert.match(refusedCurriculum.stderr, /require at least 60/);
    const savedCurriculum = await run(
      ["save-curriculum", target, "--input", curriculumPath, "--yes"],
      environment,
    );
    assert.equal(savedCurriculum.code, 0, savedCurriculum.stderr);
    assert.match(await readFile(resolve(output, "INDEX.md"), "utf8"), /1 focused topic/);

    const draft = resolve(base, "lesson.md");
    await writeFile(draft, validConciseLesson());
    await recordJudgment(draft, PASSING_JUDGMENT);
    const savedLesson = await run(
      [
        "save-lesson",
        target,
        "--topic-id",
        "topic-123456789abc",
        "--title",
        "Follow the request boundary",
        "--input",
        draft,
        "--yes",
      ],
      environment,
    );
    assert.equal(savedLesson.code, 0, savedLesson.stderr);
    const result = JSON.parse(savedLesson.stdout);
    assert.equal(result.outputRoot, output);
    assert.match(
      await readFile(resolve(output, "INDEX.md"), "utf8"),
      /\[Follow the request boundary\]\(lessons\//,
    );
    const status = await run(["status", target, "--format", "json"], environment);
    assert.equal(status.code, 0);
    assert.equal(JSON.parse(status.stdout).curriculumTopicCount, 1);
    assert.equal(JSON.parse(status.stdout).pendingTopicCount, 0);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("existing private lessons can be exported to a visible workbook without deleting the backup", async () => {
  const base = await mkdtemp(resolve(tmpdir(), "repay-techdebt-output-export-"));
  const target = resolve(base, "legacy-app");
  const output = resolve(base, "repay-legacy-app-techdebt");
  const environment = { REPAY_TECHDEBT_STATE_DIR: resolve(base, "state") };
  try {
    await mkdir(target);
    await writeLessonEvidence(target);
    await writeFile(resolve(target, "app.ts"), "export const app = true;\n");
    const initialized = await run(
      ["init", target, "--output-location", "private", "--depth", "concise", "--yes"],
      environment,
    );
    const memoryRoot = JSON.parse(initialized.stdout).memoryRoot;
    const draft = resolve(base, "lesson.md");
    await writeFile(draft, validConciseLesson());
    await recordJudgment(draft, PASSING_JUDGMENT);
    const curriculum = await saveTeachingCurriculum(
      target,
      [
        {
          title: "Request boundary",
          focus: "request-boundary-export",
          evidencePaths: ["src/routes/admin.ts", "src/auth/permission.ts"],
        },
      ],
      environment,
    );
    assert.equal(
      (
        await run(
          [
            "save-lesson",
            target,
            "--topic-id",
            curriculum.topics[0].id,
            "--title",
            "Request boundary",
            "--input",
            draft,
            "--yes",
          ],
          environment,
        )
      ).code,
      0,
    );

    const preview = await run(
      ["configure-output", target, "--output-location", "custom", "--output-root", output],
      environment,
    );
    assert.equal(preview.code, 2);
    assert.equal(JSON.parse(preview.stdout).proposedOutputRoot, output);
    const configured = await run(
      ["configure-output", target, "--output-location", "custom", "--output-root", output, "--yes"],
      environment,
    );
    assert.equal(configured.code, 0, configured.stderr);
    assert.match(await readFile(resolve(output, "INDEX.md"), "utf8"), /\]\(lessons\//);
    assert.equal((await readdir(resolve(output, "lessons"))).length, 1);
    assert.equal(
      (await readdir(resolve(memoryRoot, "lessons"))).filter((name) => name !== "index.md").length,
      1,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
