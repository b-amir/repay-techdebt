// @category C4
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import {
  reverifyLessonClaims,
  reverifyWorkbookClaims,
} from "../../../src/lessons/claim-reverify.js";

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const script = resolve(root, "scripts/recheck-claims.js");

async function liveTree() {
  const dir = await mkdtemp(resolve(tmpdir(), "repay-reverify-"));
  await mkdir(resolve(dir, "billing"), { recursive: true });
  await writeFile(
    resolve(dir, "billing/capture.js"),
    "function capturePayment() { return settle(); }\n",
  );
  return dir;
}

test("reverifyLessonClaims: faithful explicit claim passes", async () => {
  const dir = await liveTree();
  try {
    const md = `# T

CLAIMS:
1. "capturePayment settle function" - billing/capture.js:1 - support: yes - state: observed
`;
    const result = await reverifyLessonClaims(dir, md);
    assert.equal(result.ok, true, result.problems.join("; "));
    assert.equal(result.mode, "explicit-claims");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reverifyLessonClaims: stale support:yes fails closed", async () => {
  const dir = await liveTree();
  try {
    const md = `# T

CLAIMS:
1. "kafka broker topics async" - billing/capture.js:1 - support: yes - state: observed
`;
    const result = await reverifyLessonClaims(dir, md);
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => /support:yes|snippet/i.test(p)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reverifyLessonClaims: missing file citation fails", async () => {
  const dir = await liveTree();
  try {
    const md = `# T

CLAIMS:
1. "capturePayment settle function" - billing/gone.js:1 - support: yes - state: observed
`;
    const result = await reverifyLessonClaims(dir, md);
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => /missing|does not resolve|cites missing/i.test(p)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reverifyWorkbookClaims: one stale lesson fails batch", async () => {
  const dir = await liveTree();
  try {
    const lessons = resolve(dir, "lessons");
    await mkdir(lessons, { recursive: true });
    await writeFile(
      resolve(lessons, "good.md"),
      `# Good

CLAIMS:
1. "capturePayment settle function" - billing/capture.js:1 - support: yes - state: observed
`,
    );
    await writeFile(
      resolve(lessons, "stale.md"),
      `# Stale

CLAIMS:
1. "kafka broker topics async" - billing/capture.js:1 - support: yes - state: observed
`,
    );
    const batch = await reverifyWorkbookClaims(dir, lessons);
    assert.equal(batch.lessonCount, 2);
    assert.equal(batch.failedCount, 1);
    assert.equal(batch.ok, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("recheck-claims CLI fails closed on unfaithful lesson", async () => {
  const dir = await liveTree();
  try {
    const lesson = resolve(dir, "lesson.md");
    await writeFile(
      lesson,
      `# T

CLAIMS:
1. "kafka broker topics async" - billing/capture.js:1 - support: yes - state: observed
`,
    );
    await assert.rejects(
      () =>
        execute(process.execPath, [script, dir, lesson, "--format", "json"], {
          cwd: root,
        }),
      (/** @type {any} */ err) => {
        const out = JSON.parse(err.stdout || "{}");
        assert.equal(out.analyzer, "recheck-claims");
        assert.equal(out.status, "failed");
        assert.equal(out.ok, false);
        return (err.exitCode ?? err.code) === 2;
      },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("recheck-claims CLI passes faithful lesson", async () => {
  const dir = await liveTree();
  try {
    const lesson = resolve(dir, "lesson.md");
    await writeFile(
      lesson,
      `# T

CLAIMS:
1. "capturePayment settle function" - billing/capture.js:1 - support: yes - state: observed
`,
    );
    const { stdout } = await execute(process.execPath, [script, dir, lesson, "--format", "json"], {
      cwd: root,
    });
    const out = JSON.parse(stdout);
    assert.equal(out.status, "succeeded");
    assert.equal(out.ok, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
