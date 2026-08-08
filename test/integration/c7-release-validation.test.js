// @category C7
import { test } from "vite-plus/test";
import * as assert from "node:assert/strict";
import { resolve, join } from "node:path";
import {
  access,
  cp,
  lstat,
  mkdir,
  readdir,
  rm,
  symlink,
  writeFile,
  mkdtemp,
  readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { execa } from "execa";
import { recordJudgment } from "../../src/lessons/lesson-judgment.js";
import { craftCompleteConciseLesson } from "../helpers/craft-complete-lesson.js";
import { completeTrajectoryGatePayload } from "../helpers/complete-trajectory-gate.js";
import { PASSING_JUDGMENT } from "../helpers/passing-judgment.js";
import { selectRuntimeLockDocument } from "../../src/foundations/runtime-lock.js";
import { selectRuntimeManifest } from "../../src/foundations/runtime-manifest.js";
import { getSkillHashes } from "../../src/foundations/runtime-audit.js";

const SCRIPT_PATH = resolve(process.cwd(), "scripts", "validate-release.js");
const PROJECT_MEMORY = resolve(process.cwd(), "scripts", "project-memory.js");
const PLAN_CURRICULUM = resolve(process.cwd(), "scripts", "plan-curriculum.js");
const CURRICULUM_FIXTURE = resolve(
  process.cwd(),
  "test",
  "fixtures",
  "evaluation",
  "curriculum-selection",
);

async function targetSnapshot(directory) {
  const entries = (await readdir(directory, { recursive: true })).sort();
  const files = {};
  for (const entry of entries) {
    try {
      files[entry] = await readFile(resolve(directory, entry), "utf8");
    } catch {
      // Directory entry.
    }
  }
  return files;
}

function lessonForEvidence(paths) {
  const sourcePaths = paths.filter((path) => /\.[A-Za-z0-9]+$/.test(path));
  const first = sourcePaths[0];
  const second = sourcePaths[1] ?? "app/security/policy.ts";
  return craftCompleteConciseLesson()
    .replaceAll("src/routes/admin.ts", first)
    .replaceAll("src/auth/permission.ts", second)
    .replaceAll(":12", ":1")
    .replaceAll(":8", ":1");
}

async function writeValidReleaseShell(directory) {
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({ name: "test", version: "1.0" }),
    "utf8",
  );
  await writeFile(join(directory, "SKILL.md"), "---\nname: test\ndescription: test\n---\n", "utf8");
  await writeFile(join(directory, "pnpm-workspace.yaml"), "packages:\n  - .\noverrides:\n  x: 1\n");
  await writeFile(
    join(directory, "pnpm-lock.yaml"),
    "lockfileVersion: '9.0'\noverrides:\n  x: 1\nimporters:\n  .:\n    dependencies:\n      x:\n        specifier: 1\n        version: 1\n",
  );
}

test("Validation fails when package.json is missing or malformed", async () => {
  const TEST_ROOT = await mkdtemp(join(tmpdir(), "release-test-"));
  try {
    const result = await execa("node", [SCRIPT_PATH], {
      cwd: TEST_ROOT,
      reject: false,
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Failed to read package.json/);
  } finally {
    await rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {});
  }
});

test("Validation fails when SKILL.md is invalid", async () => {
  const TEST_ROOT = await mkdtemp(join(tmpdir(), "release-test-"));
  try {
    await writeFile(
      join(TEST_ROOT, "package.json"),
      JSON.stringify({ name: "test", version: "1.0" }),
      "utf8",
    );
    await writeFile(join(TEST_ROOT, "SKILL.md"), "No frontmatter here!", "utf8");

    const result = await execa("node", [SCRIPT_PATH], {
      cwd: TEST_ROOT,
      reject: false,
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /SKILL.md must begin with YAML frontmatter/);
  } finally {
    await rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {});
  }
});

test("Validation can require independent forward-test review provenance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "release-review-"));
  try {
    const selfReview = join(directory, "self.json");
    const independentReview = join(directory, "independent.json");
    await writeFile(
      selfReview,
      JSON.stringify({ reviewerProvenance: "self", mustFix: [] }),
      "utf8",
    );
    await writeFile(
      independentReview,
      JSON.stringify({ reviewerProvenance: "independent-agent", mustFix: [] }),
      "utf8",
    );

    const rejected = await execa(
      "node",
      [SCRIPT_PATH, "--require-independent-review", selfReview],
      { cwd: process.cwd(), reject: false },
    );
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /not independent/);

    const accepted = await execa(
      "node",
      [SCRIPT_PATH, "--require-independent-review", independentReview],
      { cwd: process.cwd(), reject: false },
    );
    assert.equal(accepted.exitCode, 0);
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
});

test("Validation accepts the repository's distributable lock shape", async () => {
  const result = await execa("node", [SCRIPT_PATH], { cwd: process.cwd(), reject: false });
  assert.equal(result.exitCode, 0, result.stderr);
});

test(
  "the materialized runtime lock passes a real frozen pnpm install check",
  { timeout: 30_000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "repay-runtime-lock-"));
    try {
      const packageText = await readFile(join(process.cwd(), "package.json"), "utf8");
      const manifest = JSON.parse(packageText);
      const lockText = await readFile(join(process.cwd(), "pnpm-lock.yaml"), "utf8");
      await writeFile(
        join(directory, "package.json"),
        `${JSON.stringify(selectRuntimeManifest(manifest), null, 2)}\n`,
        "utf8",
      );
      await cp(join(process.cwd(), "pnpm-workspace.yaml"), join(directory, "pnpm-workspace.yaml"));
      await writeFile(
        join(directory, "pnpm-lock.yaml"),
        selectRuntimeLockDocument(lockText),
        "utf8",
      );

      const version = manifest.devEngines.packageManager.version;
      const result = await execa(
        "corepack",
        [
          `pnpm@${version}`,
          "install",
          "--lockfile-only",
          "--frozen-lockfile",
          "--ignore-scripts",
          "--offline",
        ],
        { cwd: directory, reject: false, env: { ...process.env, CI: "true" } },
      );
      assert.equal(result.exitCode, 0, result.stderr);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test(
  "a copied skill starts project-memory before local node_modules exists",
  { timeout: 30_000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "repay-clean-artifact-"));
    const copiedSkill = join(directory, "skill");
    try {
      await mkdir(copiedSkill, { recursive: true });
      for (const entry of [
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "scripts",
        "src",
      ]) {
        await cp(join(process.cwd(), entry), join(copiedSkill, entry), { recursive: true });
      }
      await assert.rejects(access(join(copiedSkill, "node_modules")));

      const { runtimeHash } = await getSkillHashes(copiedSkill);
      const dataHome = join(directory, "data");
      const linkedRuntime = join(dataHome, "repay-techdebt", "runtime", runtimeHash);
      await mkdir(linkedRuntime, { recursive: true });
      await symlink(join(process.cwd(), "node_modules"), join(linkedRuntime, "node_modules"));

      const result = await execa(
        process.execPath,
        [join(copiedSkill, "scripts", "project-memory.js"), "--help"],
        {
          cwd: copiedSkill,
          reject: false,
          env: {
            ...process.env,
            XDG_DATA_HOME: dataHome,
            XDG_STATE_HOME: join(directory, "state"),
            XDG_CACHE_HOME: join(directory, "cache"),
          },
        },
      );
      assert.equal(result.exitCode, 0, result.stderr);
      assert.match(result.stdout, /Usage:/);
      assert.equal((await lstat(join(copiedSkill, "node_modules"))).isSymbolicLink(), true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test("Validation rejects duplicate project dependency documents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "release-lock-"));
  try {
    await writeValidReleaseShell(directory);
    const lock = await readFile(join(directory, "pnpm-lock.yaml"), "utf8");
    await writeFile(join(directory, "pnpm-lock.yaml"), `${lock}\n---\n${lock}`, "utf8");
    const result = await execa("node", [SCRIPT_PATH], { cwd: directory, reject: false });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /exactly one project dependency document/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Validation rejects workspace override drift", async () => {
  const directory = await mkdtemp(join(tmpdir(), "release-lock-"));
  try {
    await writeValidReleaseShell(directory);
    await writeFile(
      join(directory, "pnpm-workspace.yaml"),
      "packages:\n  - .\noverrides:\n  x: 2\n",
    );
    const result = await execa("node", [SCRIPT_PATH], { cwd: directory, reject: false });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /overrides do not match/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test(
  "isolated curriculum lifecycle recreates a diverse workbook without target writes",
  { timeout: 120_000 },
  async () => {
    const base = await mkdtemp(join(tmpdir(), "repay-curriculum-lifecycle-"));
    const target = join(base, "target");
    const environment = {
      ...process.env,
      REPAY_TECHDEBT_STATE_DIR: join(base, "state"),
      REPAY_TECHDEBT_CACHE_DIR: join(base, "cache"),
    };
    await cp(CURRICULUM_FIXTURE, target, { recursive: true });
    const before = await targetSnapshot(target);

    async function runScenario() {
      const initialized = await execa(
        "node",
        [
          PROJECT_MEMORY,
          "init",
          target,
          "--depth",
          "concise",
          "--save-policy",
          "automatic",
          "--output-location",
          "private",
          "--yes",
        ],
        { env: environment, reject: false },
      );
      assert.equal(initialized.exitCode, 0, initialized.stderr);
      const initializedPayload = JSON.parse(initialized.stdout);
      const planned = await execa(
        "node",
        [PLAN_CURRICULUM, target, "--batch-only", "--batch-size", "3", "--format", "json"],
        { env: environment, reject: false },
      );
      assert.equal(planned.exitCode, 0, planned.stderr);
      const curriculum = JSON.parse(planned.stdout);
      assert.equal(curriculum.topics.length, 3);
      assert.equal(new Set(curriculum.topics.map((topic) => topic.mechanismFamily)).size, 3);
      assert.ok(curriculum.proposal.alternates.length >= 6);
      assert.ok(
        [...curriculum.topics, ...curriculum.proposal.alternates].every(
          (topic) => !/\.react-router|storybook-static/.test(topic.focus),
        ),
      );
      curriculum.topics.forEach((topic, index) => {
        topic.title = `${topic.mechanismFamily} mechanism ${index + 1}`;
        topic.learnerOutcome = `Trace and safely change the ${topic.mechanismFamily} mechanism.`;
      });
      curriculum.agentApproval = {
        approvedAt: "2026-08-08T00:00:00.000Z",
        purposeStatus: "accepted",
        titleReview: {
          reviewedAt: "2026-08-08T00:00:00.000Z",
          scope: "complete-curriculum",
        },
        corroboratedTopicIds: curriculum.topics.map((topic) => topic.id),
        demotedTopicIds: [],
        topicDecisions: {},
        placeholderReasons: {},
        acceptedPartialScope: null,
      };
      const curriculumPath = join(base, "approved-curriculum.json");
      await writeFile(curriculumPath, `${JSON.stringify(curriculum, null, 2)}\n`);
      const savedCurriculum = await execa(
        "node",
        [PROJECT_MEMORY, "save-curriculum", target, "--input", curriculumPath, "--yes"],
        { env: environment, reject: false },
      );
      assert.equal(savedCurriculum.exitCode, 0, savedCurriculum.stderr);
      await mkdir(initializedPayload.memoryRoot, { recursive: true });
      await writeFile(
        join(initializedPayload.memoryRoot, "trajectory-gate.json"),
        `${JSON.stringify(completeTrajectoryGatePayload(), null, 2)}\n`,
      );

      for (const [index, topic] of curriculum.topics.entries()) {
        const draft = join(base, `lesson-${index + 1}.md`);
        await writeFile(draft, lessonForEvidence(topic.evidencePaths));
        await recordJudgment(draft, PASSING_JUDGMENT);
        const savedLesson = await execa(
          "node",
          [
            PROJECT_MEMORY,
            "save-lesson",
            target,
            "--topic-id",
            topic.id,
            "--title",
            topic.title,
            "--input",
            draft,
            "--subject",
            "code-mechanics",
            "--yes",
          ],
          { env: environment, reject: false },
        );
        assert.equal(savedLesson.exitCode, 0, `${savedLesson.stderr}\n${savedLesson.stdout}`);
      }
      const status = await execa("node", [PROJECT_MEMORY, "status", target, "--format", "json"], {
        env: environment,
        reject: false,
      });
      const statusPayload = JSON.parse(status.stdout);
      assert.equal(statusPayload.curriculumTopicCount, 3);
      assert.equal(statusPayload.pendingTopicCount, 0);
      assert.equal(statusPayload.path.pathComplete, true);
      return initializedPayload.outputRoot;
    }

    try {
      const firstOutput = await runScenario();
      const preview = await execa("node", [PROJECT_MEMORY, "clear-output", target, "--dry-run"], {
        env: environment,
        reject: false,
      });
      assert.equal(preview.exitCode, 0, preview.stderr);
      const cleared = await execa("node", [PROJECT_MEMORY, "clear-output", target, "--yes"], {
        env: environment,
        reject: false,
      });
      assert.equal(cleared.exitCode, 0, cleared.stderr);
      await assert.rejects(access(firstOutput));
      await runScenario();
      assert.deepEqual(await targetSnapshot(target), before);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  },
);
