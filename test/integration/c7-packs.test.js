// @category C7
// Pack contract loop: every pack file under packs/ parses, the lens pack (not
// covered by pack-contract.test) has the right shape, and detectPacks loads both
// program + framework collections without throwing.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import {
  loadProgramPacks,
  loadFrameworkPacks,
  detectPacks,
} from "../../src/packs/pack-registry.js";

const root = resolve(import.meta.dirname, "..", "..");
const packsDir = resolve(root, "packs");

test("every file under packs/ parses as JSON", async () => {
  const entries = (await readdir(packsDir)).filter((f) => f.endsWith(".json"));
  assert.ok(entries.length >= 3, `expected pack files, found ${entries.length}`);
  for (const name of entries) {
    const raw = await readFile(resolve(packsDir, name), "utf8");
    assert.doesNotThrow(() => JSON.parse(raw), `${name} is not valid JSON`);
  }
});

test("program + framework packs load through pack-registry", async () => {
  const program = await loadProgramPacks(packsDir);
  const framework = await loadFrameworkPacks(packsDir);
  assert.equal(program.schemaVersion, 1);
  assert.equal(framework.schemaVersion, 1);
  assert.ok(program.packs.length > 0, "program-packs.json has no packs");
  assert.ok(framework.packs.length > 0, "framework-packs.json has no packs");
  assert.ok(program.packs.every((p) => p.kind === "language"));
  assert.ok(framework.packs.every((p) => p.kind === "framework"));
});

test("detectPacks returns the available program + framework catalog", async () => {
  const target = resolve(root, "test/fixtures/evaluation/dummy-library");
  const detected = await detectPacks(target, packsDir);
  assert.deepEqual(detected.matched, []);
  assert.ok(detected.available.program.length > 0);
  assert.ok(detected.available.framework.length > 0);
});

test("lenses.json conforms to the lens pack shape", async () => {
  // lenses.json has no zod loader in lib; assert its structure directly here.
  const lenses = JSON.parse(await readFile(resolve(packsDir, "lenses.json"), "utf8"));
  assert.equal(lenses.schemaVersion, 1);
  assert.ok(Array.isArray(lenses.lenses) && lenses.lenses.length > 0);
  for (const lens of lenses.lenses) {
    assert.ok(
      typeof lens.id === "string" && lens.id.length > 0,
      `lens missing id: ${JSON.stringify(lens)}`,
    );
    assert.ok(Array.isArray(lens.questions), `lens ${lens.id} questions must be an array`);
    assert.ok(Array.isArray(lens.evidence), `lens ${lens.id} evidence must be an array`);
  }
  // lens ids are unique
  const ids = lenses.lenses.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate lens id");
});
