import { test } from "vite-plus/test";
import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import { loadProgramPacks, loadFrameworkPacks } from "../scripts/lib/pack-registry.js";

const PACKS_DIR = resolve(process.cwd(), "packs");

test("Program packs strictly conform to the language pack schema", async () => {
  const result = await loadProgramPacks(PACKS_DIR);
  assert.equal(result.schemaVersion, 1);
  assert.ok(result.packs.length > 0);

  for (const pack of result.packs) {
    assert.equal(pack.kind, "language");
    assert.ok(pack.id, "Pack must have an id");
    assert.ok(Array.isArray(pack.detect.extensions), "Must declare extensions");
    assert.ok(Array.isArray(pack.capabilities), "Must declare capabilities");
    assert.ok(Array.isArray(pack.investigations), "Must declare investigations");
  }
});

test("Framework packs strictly conform to the framework pack schema", async () => {
  const result = await loadFrameworkPacks(PACKS_DIR);
  assert.equal(result.schemaVersion, 1);
  assert.ok(result.packs.length > 0);

  for (const pack of result.packs) {
    assert.equal(pack.kind, "framework");
    assert.ok(pack.id, "Pack must have an id");
    assert.ok(Array.isArray(pack.packages), "Must declare packages");
    assert.ok(Array.isArray(pack.signals), "Must declare signals");
    assert.ok(Array.isArray(pack.investigations), "Must declare investigations");
  }
});
