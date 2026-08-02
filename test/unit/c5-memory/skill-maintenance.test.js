// @category C5
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { test } from "vite-plus/test";
import {
  planSkillCacheClear,
  planSkillMaintenance,
} from "../../../src/memory/skill-maintenance.js";
import { projectStoragePaths } from "../../../src/foundations/private-storage.js";

test("planSkillMaintenance lists sister workbook and private memory", async () => {
  const base = await mkdtemp(resolve(tmpdir(), "repay-maint-plan-"));
  const target = resolve(base, "app");
  const stateDir = resolve(base, "state");
  try {
    await mkdir(target);
    process.env.REPAY_TECHDEBT_STATE_DIR = stateDir;
    const storage = projectStoragePaths(target);
    const memoryRoot = storage.privateRoot;
    const workbookRoot = resolve(
      dirname(target),
      `repay-${basename(target).replace(/[^A-Za-z0-9._-]+/g, "-")}-techdebt`,
    );
    await mkdir(resolve(memoryRoot, "lessons"), { recursive: true });
    await writeFile(resolve(memoryRoot, "config.json"), "{}");
    await mkdir(resolve(workbookRoot, "lessons"), { recursive: true });
    await writeFile(resolve(workbookRoot, "INDEX.md"), "# index");
    const plan = await planSkillMaintenance(target, {
      config: { output: { location: "custom", root: workbookRoot } },
      workbookRoot,
    });
    assert.ok(plan.removeDirectories.includes(workbookRoot));
    assert.equal(await realpath(plan.memoryRoots[0]), await realpath(memoryRoot));
    assert.ok(plan.outsideTarget.length > 0);
  } finally {
    delete process.env.REPAY_TECHDEBT_STATE_DIR;
    await rm(base, { recursive: true, force: true });
  }
});

test("planSkillCacheClear targets only cache root", async () => {
  const base = await mkdtemp(resolve(tmpdir(), "repay-maint-cache-"));
  const target = resolve(base, "app");
  try {
    await mkdir(target);
    process.env.REPAY_TECHDEBT_CACHE_DIR = resolve(base, "cache");
    const storage = projectStoragePaths(target);
    await mkdir(storage.cacheRoot, { recursive: true });
    const plan = await planSkillCacheClear(target);
    assert.equal(plan.removeDirectories.length, 1);
    assert.equal(await realpath(plan.removeDirectories[0]), await realpath(storage.cacheRoot));
    assert.equal(plan.removeFiles.length, 0);
  } finally {
    delete process.env.REPAY_TECHDEBT_CACHE_DIR;
    await rm(base, { recursive: true, force: true });
  }
});
