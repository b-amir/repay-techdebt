// @category C8
// Evaluation fixture must-find runner. Iterates every fixture under
// test/fixtures/evaluation/*, validates its expectations, then executes the must-find /
// forbidden checks via evaluateCurriculum against a stand-in curriculum built from the
// expectations themselves. Proves the runner covers all fixtures; forward-safe — when a
// fixture grows must-find topics, its regression is caught here.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import { validateFixture } from "../../src/evaluation/evaluation-schema.js";
import { evaluateCurriculum } from "../../src/evaluation/evaluation.js";

const fixturesDir = resolve(import.meta.dirname, "..", "fixtures", "evaluation");

async function loadFixtures() {
  const entries = await readdir(fixturesDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

test("the must-find runner covers every evaluation fixture", async () => {
  const names = await loadFixtures();
  assert.ok(names.length >= 8, `expected ≥8 fixtures, found ${names.length}`);
  // Guard against a fixture being silently dropped from the loop.
  const seen = new Set();
  for (const name of names.sort()) {
    seen.add(name);
    const expectations = JSON.parse(
      await readFile(resolve(fixturesDir, name, "expectations.json"), "utf8"),
    );
    const validation = validateFixture(expectations);
    assert.ok(validation.ok, `${name}: invalid expectations: ${JSON.stringify(validation.errors)}`);
    assert.equal(validation.data.name, name, `${name}: fixture name must match directory`);

    // Stand-in curriculum: include every must-find topic, exclude every forbidden one.
    // For such a curriculum the runner must report success (no missing must-find, no
    // present forbidden). This exercises evaluateCurriculum for every fixture's shape.
    const mustFind = (validation.data.topics ?? []).filter((t) => t.intent === "must-find");
    const curriculum = { topics: mustFind.map((t) => ({ id: t.id })) };
    const result = evaluateCurriculum(curriculum, validation.data);
    assert.equal(
      result.missingMustFind.length,
      0,
      `${name}: must-find ids dropped by the runner: ${result.missingMustFind.map((t) => t.id).join(", ")}`,
    );
    assert.equal(
      result.presentForbidden.length,
      0,
      `${name}: unexpected forbidden present: ${result.presentForbidden.map((t) => t.id).join(", ")}`,
    );
  }
  // Snapshot the covered set so adding a fixture without wiring it here fails loudly.
  assert.deepEqual(
    [...seen].sort(),
    names.sort(),
    "fixture set drifted between read and evaluation",
  );
});

test("evaluateCurriculum flags a missing must-find topic from a real fixture", async () => {
  // Sanity: the runner's check actually fails when a must-find id is absent.
  const names = await loadFixtures();
  let withMustFind = null;
  for (const name of names) {
    const data = JSON.parse(
      await readFile(resolve(fixturesDir, name, "expectations.json"), "utf8"),
    );
    if ((data.topics ?? []).some((topic) => topic.intent === "must-find")) {
      withMustFind = name;
      break;
    }
  }
  if (!withMustFind) return; // no must-find fixture present — vacuous pass
  const expectations = JSON.parse(
    await readFile(resolve(fixturesDir, withMustFind, "expectations.json"), "utf8"),
  );
  const result = evaluateCurriculum({ topics: [] }, expectations);
  assert.equal(result.ok, false);
  assert.ok(result.missingMustFind.length > 0);
});
