// @category C8
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateFixture } from "../src/evaluation/evaluation-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures", "evaluation");

test("evaluation fixtures exist and are valid", async () => {
  const entries = await fs.readdir(fixturesDir, { withFileTypes: true });
  const directories = entries.filter((e) => e.isDirectory());

  assert.ok(directories.length > 0, "Expected to find some evaluation fixtures");

  for (const dir of directories) {
    const expectationsPath = path.join(fixturesDir, dir.name, "expectations.json");
    const content = await fs.readFile(expectationsPath, "utf-8");
    const json = JSON.parse(content);

    const result = validateFixture(json);
    assert.ok(result.ok, `Fixture ${dir.name} is invalid: ${JSON.stringify(result.errors)}`);
    assert.equal(
      result.data.name,
      dir.name,
      `Fixture name should match directory name for ${dir.name}`,
    );
  }
});
