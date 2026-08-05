// @category C5
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import { resolveWorkbook } from "../../../src/viewer/resolve-workbook.js";
import { projectStoragePaths } from "../../../src/foundations/private-storage.js";

test("resolveWorkbook keeps the repository root as targetRoot in private storage", async () => {
  const repoRoot = await realpath(await mkdtemp(resolve(tmpdir(), "repay-viewer-repo-")));
  const memoryRoot = projectStoragePaths(repoRoot).privateRoot;
  await mkdir(memoryRoot, { recursive: true });

  const config = {
    schemaVersion: 2,
    sharing: "private",
    storage: { mode: "private", projectId: projectStoragePaths(repoRoot).projectId },
    output: { format: "markdown", directory: "lessons", location: "private", savePolicy: "ask" },
    defaults: { mode: "workbook", lessonDepth: "balanced" },
  };
  await writeFile(resolve(memoryRoot, "config.json"), JSON.stringify(config), "utf8");

  const workbook = await resolveWorkbook(repoRoot, { storage: "private" });

  assert.equal(workbook.ready, true);
  assert.equal(workbook.targetRoot, repoRoot);
  assert.notEqual(workbook.targetRoot, memoryRoot);
  assert.equal(workbook.memoryRoot, memoryRoot);
});
