// @category C0
// Pure + temp-dir unit tests for foundations: target-root resolution error codes and
// project-memory storage conflict rules. Covers:
// resolveTargetRoot error codes; competing storage throws.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import {
  TargetRootError,
  formatTargetError,
  resolveTargetRoot,
  skillRoot,
} from "../../../src/foundations/targeting.js";
import {
  locateProjectMemory,
  projectStoragePaths,
} from "../../../src/foundations/private-storage.js";

function expectCode(code) {
  // assert.rejects treats a function matcher as "return true → pass". Assert internally
  // for a clear diff, and return true so the matcher itself is satisfied.
  return (error) => {
    assert.ok(error instanceof TargetRootError, `expected TargetRootError, got ${error?.name}`);
    assert.equal(error.code, code);
    return true;
  };
}

test("resolveTargetRoot: missing input → TARGET_REQUIRED", async () => {
  await assert.rejects(() => resolveTargetRoot(""), expectCode("TARGET_REQUIRED"));
  await assert.rejects(() => resolveTargetRoot(undefined), expectCode("TARGET_REQUIRED"));
});

test("resolveTargetRoot: non-existent path → TARGET_UNAVAILABLE", async () => {
  await assert.rejects(
    () => resolveTargetRoot(resolve(tmpdir(), "repay-definitely-missing-" + "x".repeat(8))),
    expectCode("TARGET_UNAVAILABLE"),
  );
});

test("resolveTargetRoot: file (not directory) → TARGET_NOT_DIRECTORY", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "repay-c0-file-"));
  try {
    const filePath = resolve(dir, "not-a-dir");
    await writeFile(filePath, "x");
    await assert.rejects(() => resolveTargetRoot(filePath), expectCode("TARGET_NOT_DIRECTORY"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("resolveTargetRoot: skill root or inside it → TARGET_IS_SKILL", async () => {
  // The skill must never be analyzable as a target.
  await assert.rejects(() => resolveTargetRoot(skillRoot), expectCode("TARGET_IS_SKILL"));
  await assert.rejects(
    () => resolveTargetRoot(resolve(skillRoot, "scripts")),
    expectCode("TARGET_IS_SKILL"),
  );
});

test("resolveTargetRoot: valid external dir returns roots and null relativeSkillRoot", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "repay-c0-ok-"));
  try {
    const { targetRoot, relativeSkillRoot } = await resolveTargetRoot(dir);
    assert.ok(targetRoot);
    assert.equal(relativeSkillRoot, null, "external target must not nest the skill");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("resolveTargetRoot: workspace with nested project requires an explicit target", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-target-workspace-"));
  const previousState = process.env.REPAY_TECHDEBT_STATE_DIR;
  process.env.REPAY_TECHDEBT_STATE_DIR = resolve(directory, "state");
  try {
    const frontend = resolve(directory, "frontend");
    await mkdir(resolve(frontend, ".git"), { recursive: true });
    await writeFile(resolve(frontend, "package.json"), "{}\n");
    const canonicalFrontend = await realpath(frontend);
    await assert.rejects(
      () => resolveTargetRoot(directory),
      (error) => {
        if (!(error instanceof TargetRootError)) return false;
        return (
          error.code === "TARGET_AMBIGUOUS" &&
          error.details?.candidates?.[0]?.path === canonicalFrontend &&
          error.details?.candidates?.[0]?.existingMemory === false
        );
      },
    );
  } finally {
    if (previousState === undefined) delete process.env.REPAY_TECHDEBT_STATE_DIR;
    else process.env.REPAY_TECHDEBT_STATE_DIR = previousState;
    await rm(directory, { recursive: true, force: true });
  }
});

test("resolveTargetRoot: a marked project remains valid when it has nested repositories", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-target-project-"));
  try {
    await writeFile(resolve(directory, "package.json"), "{}\n");
    await mkdir(resolve(directory, "vendor-app", ".git"), { recursive: true });
    await writeFile(resolve(directory, "vendor-app", "package.json"), "{}\n");
    const target = await resolveTargetRoot(directory);
    assert.equal(target.targetRoot, await realpath(directory));
    assert.equal(target.identity.name, directory.split("/").at(-1));
    assert.equal(target.identity.nestedCandidates.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("resolveTargetRoot: workspace ambiguity reports every bounded nested repository", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-target-multi-workspace-"));
  try {
    for (const name of ["frontend", "admin-console"]) {
      await mkdir(resolve(directory, name, ".git"), { recursive: true });
      await writeFile(resolve(directory, name, "package.json"), "{}\n");
    }
    await assert.rejects(
      () => resolveTargetRoot(directory),
      (error) => {
        assert.ok(error instanceof TargetRootError);
        assert.equal(error.code, "TARGET_AMBIGUOUS");
        assert.deepEqual(error.details.candidates.map((candidate) => candidate.name).sort(), [
          "admin-console",
          "frontend",
        ]);
        return true;
      },
    );
    assert.deepEqual((await readdir(directory)).sort(), ["admin-console", "frontend"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("formatTargetError serializes only TargetRootError and echoes the code", async () => {
  try {
    await resolveTargetRoot("");
    assert.fail("should have thrown");
  } catch (error) {
    const formatted = formatTargetError(error);
    assert.ok(formatted);
    const parsed = JSON.parse(formatted);
    assert.equal(parsed.code, "TARGET_REQUIRED");
    assert.equal(parsed.type, "target-error");
    assert.ok(parsed.requiredAction);
    // Non-TargetRootError yields null (no false positive).
    assert.equal(formatTargetError(new Error("ordinary")), null);
  }
});

test("locateProjectMemory: invalid --storage value throws", async () => {
  const targetRoot = await mkdtemp(resolve(tmpdir(), "repay-c0-storage-"));
  try {
    await assert.rejects(
      () => locateProjectMemory(targetRoot, "bogus"),
      /--storage must be private, project-local, or team/,
    );
  } finally {
    await rm(targetRoot, { recursive: true, force: true });
  }
});

test("locateProjectMemory: explicit --storage selects that location even when empty", async () => {
  const targetRoot = await mkdtemp(resolve(tmpdir(), "repay-c0-pick-"));
  try {
    const result = await locateProjectMemory(targetRoot, "project-local");
    assert.equal(result.mode, "project-local");
    assert.equal(result.ready, false);
    assert.equal(result.competingReady, false);
  } finally {
    await rm(targetRoot, { recursive: true, force: true });
  }
});

test("locateProjectMemory: both private and local configs present → competing-storage throw", async () => {
  // Redirect private (external) state dir into a temp root so we never touch the real
  // user Library. locateProjectMemory reads process.env via projectStoragePaths().
  const stateDir = await mkdtemp(resolve(tmpdir(), "repay-c0-state-"));
  const targetRoot = await mkdtemp(resolve(tmpdir(), "repay-c0-compete-"));
  const previous = process.env.REPAY_TECHDEBT_STATE_DIR;
  process.env.REPAY_TECHDEBT_STATE_DIR = stateDir;
  try {
    const storage = projectStoragePaths(targetRoot);
    await mkdir(storage.privateRoot, { recursive: true });
    await writeFile(resolve(storage.privateRoot, "config.json"), "{}");
    await mkdir(storage.localRoot, { recursive: true });
    await writeFile(resolve(storage.localRoot, "config.json"), "{}");

    await assert.rejects(
      () => locateProjectMemory(targetRoot),
      /Both private-external and target-local project memory exist/,
    );
  } finally {
    if (previous === undefined) delete process.env.REPAY_TECHDEBT_STATE_DIR;
    else process.env.REPAY_TECHDEBT_STATE_DIR = previous;
    await rm(stateDir, { recursive: true, force: true });
    await rm(targetRoot, { recursive: true, force: true });
  }
});
