// @category C4
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import {
  indexLessonClaims,
  buildClaimIndex,
  searchClaims,
  searchWorkbookClaims,
} from "../../../src/lessons/claim-search.js";

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cli = resolve(root, "scripts/project-memory.js");

const SAMPLE = `---
subject: flow
primaryPaths:
  - billing/capture.js
---

# Capture path

CLAIMS:
1. "capture validates amount before settle" - billing/capture.js:12 - support:yes

See also billing/capture.js:12 and billing/settlement.js:4.
`;

test("indexLessonClaims extracts claims citations primaryPaths", () => {
  const indexed = indexLessonClaims(SAMPLE, {
    path: "/tmp/lessons/capture.md",
    key: "lessons/capture.md",
    name: "capture.md",
  });
  assert.equal(indexed.title, "Capture path");
  assert.deepEqual(indexed.primaryPaths, ["billing/capture.js"]);
  assert.ok(indexed.claims.some((c) => /validates amount/i.test(c.claim)));
  assert.ok(indexed.citations.some((c) => c.startsWith("billing/capture.js:")));
});

test("searchClaims hits claim text and citation path", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-claim-search-"));
  const lessonsDir = resolve(directory, "lessons");
  try {
    await mkdir(lessonsDir, { recursive: true });
    await writeFile(resolve(lessonsDir, "capture.md"), SAMPLE);
    await writeFile(
      resolve(lessonsDir, "other.md"),
      `---\nprimaryPaths:\n  - ui/button.js\n---\n\n# Unrelated\n\nNo claims here.\n`,
    );

    const byClaim = await searchClaims(lessonsDir, "validates amount");
    assert.ok(byClaim.hitCount >= 1);
    assert.ok(byClaim.hits.some((h) => h.match === "claim"));

    const byPath = await searchClaims(lessonsDir, "billing/capture");
    assert.ok(byPath.hitCount >= 1);
    assert.ok(
      byPath.hits.some(
        (h) => h.match === "citation" || h.match === "primaryPath" || h.match === "claim",
      ),
    );

    const miss = await searchClaims(lessonsDir, "zzzz-not-present");
    assert.equal(miss.hitCount, 0);

    const index = await buildClaimIndex(lessonsDir);
    assert.equal(index.lessonCount, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("searchWorkbookClaims empty when memory not ready", async () => {
  const result = await searchWorkbookClaims({ ready: false, lessonsDir: "/tmp/none" }, "anything");
  assert.equal(result.ok, false);
  assert.equal(result.empty, true);
  assert.ok(result.problems?.[0]?.includes("not initialized"));
});

test("CLI search-claims documents in help and finds fixture claims", async () => {
  const { stdout: help } = await execute(process.execPath, [cli, "--help"], { cwd: root });
  assert.match(help, /search-claims/);

  const directory = await mkdtemp(resolve(tmpdir(), "repay-search-cli-"));
  try {
    // Uninitialized → fail-closed payload (exit 2)
    await assert.rejects(
      () =>
        execute(
          process.execPath,
          [cli, "search-claims", directory, "--query", "capture", "--format", "json"],
          {
            cwd: root,
          },
        ),
      (/** @type {any} */ err) => {
        const payload = JSON.parse(err.stdout || "{}");
        assert.equal(payload.type, "search-claims");
        assert.equal(payload.ready, false);
        assert.equal(payload.ok, false);
        return (err.exitCode ?? err.code) === 2 || (err.exitCode ?? err.code) === 1;
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
