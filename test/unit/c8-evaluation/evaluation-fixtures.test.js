// @category C8
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import { inspectLessonBehaviors } from "../../../src/evaluation/evaluation.js";
import { validateFixture } from "../../../src/evaluation/evaluation-schema.js";

const fixtures = resolve(import.meta.dirname, "../../fixtures/evaluation");

test("evaluation fixtures exist and are valid", async () => {
  const directories = (await readdir(fixtures, { withFileTypes: true })).filter((entry) =>
    entry.isDirectory(),
  );
  assert.ok(directories.length > 0, "Expected to find some evaluation fixtures");
  for (const directory of directories) {
    const json = JSON.parse(
      await readFile(resolve(fixtures, directory.name, "expectations.json"), "utf8"),
    );
    const result = validateFixture(json);
    assert.ok(result.ok, `Fixture ${directory.name} is invalid: ${JSON.stringify(result.errors)}`);
    assert.equal(result.data.name, directory.name);
  }
});

for (const name of ["ordered-flow", "conditional-consequence", "transfer-task"]) {
  test(`${name} exposes section-scoped trace, contrast, and learner-job evidence`, async () => {
    const markdown = await readFile(resolve(fixtures, name, "lesson.md"), "utf8");
    const report = inspectLessonBehaviors(markdown);
    assert.equal(report.observed.trace, true, JSON.stringify(report, null, 2));
    assert.equal(report.observed.contrast, true, JSON.stringify(report, null, 2));
    assert.equal(report.observed.learnerJob, true, JSON.stringify(report, null, 2));
    assert.ok(report.evidence.trace.length > 20);
    assert.equal(report.confidence.trace, "high");
    assert.notEqual(report.confidence.learnerJob, "not-detected");
  });
}

test("empty role headings and keyword stuffing are reported as not detected", () => {
  const markdown = `---
sectionRoles:
  workedPath: Trace
  pitfall: Pitfall
  check: Check
---
## Trace

Overview.

## Pitfall

If then otherwise contrast.

## Check

Modify test assert verify.`;
  const report = inspectLessonBehaviors(markdown);
  assert.equal(report.observed.trace, false);
  assert.equal(report.observed.contrast, false);
  assert.equal(report.observed.learnerJob, false);
  assert.equal(report.confidence.learnerJob, "not-detected");
});
