// @category C0
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import { selectRuntimeLockDocument } from "../../../src/foundations/runtime-lock.js";

test("selectRuntimeLockDocument extracts one pnpm-consumable project lock", async () => {
  const source = await readFile(resolve(process.cwd(), "pnpm-lock.yaml"), "utf8");
  const runtimeLock = selectRuntimeLockDocument(source);

  assert.equal((runtimeLock.match(/^---\s*$/gmu) ?? []).length, 0);
  assert.match(runtimeLock, /^lockfileVersion:/mu);
  assert.match(runtimeLock, /^overrides:/mu);
  assert.match(runtimeLock, /^\s{4}dependencies:/mu);
  assert.doesNotMatch(runtimeLock, /packageManagerDependencies:/u);
});

test("selectRuntimeLockDocument rejects ambiguous project locks", () => {
  const project = `lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      x:\n        specifier: 1\n        version: 1\n`;
  assert.throws(
    () => selectRuntimeLockDocument(`${project}\n---\n${project}`),
    /exactly one project dependency document/u,
  );
});
