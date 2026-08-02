import { test } from "vite-plus/test";
import * as assert from "node:assert/strict";
import { AnalyzerAdapter } from "../scripts/lib/analyzer-adapter.js";

class MockAdapter extends AnalyzerAdapter {
  constructor(options) {
    super(options);
  }

  async analyze(targetRoot, options = {}) {
    if (options.failWith) {
      return this.createResult({
        status: options.failWith,
        targetRoot,
        error: new Error(`Simulated failure: ${options.failWith}`),
      });
    }

    if (options.writeToTarget) {
      // Simulate writing to a target directory, which should fail the assertion
      this.assertSafeOutputDirectory(targetRoot, `${targetRoot}/.cache/analyzer`);
    }

    return this.createResult({
      status: "successful",
      targetRoot,
      scope: ["src/**/*.js"],
      evidence: { issuesFound: 42 },
      limitations: ["Did not parse JSX"],
    });
  }
}

test("AnalyzerAdapter enforces status constraints and returns a uniform shape", async () => {
  const adapter = new MockAdapter({ name: "MockLinter", version: "1.0.0" });
  
  const result = await adapter.analyze("/fake/project");
  
  assert.equal(result.analyzer, "MockLinter");
  assert.equal(result.version, "1.0.0");
  assert.equal(result.status, "successful");
  assert.equal(result.targetRoot, "/fake/project");
  assert.deepEqual(result.scope, ["src/**/*.js"]);
  assert.equal(result.evidence.issuesFound, 42);
  assert.deepEqual(result.limitations, ["Did not parse JSX"]);
  assert.equal(result.error, null);
  assert.ok(result.timestamp);
});

test("AnalyzerAdapter handles expected failure statuses", async () => {
  const adapter = new MockAdapter({ name: "MockLinter", version: "1.0.0" });
  
  const statuses = ["unavailable", "unconfigured", "refused", "failed", "partial", "stale"];
  
  for (const status of statuses) {
    const result = await adapter.analyze("/fake/project", { failWith: status });
    assert.equal(result.status, status);
    assert.match(result.error, new RegExp(status));
  }
});

test("AnalyzerAdapter rejects invalid statuses", () => {
  const adapter = new MockAdapter({ name: "MockLinter", version: "1.0.0" });
  
  assert.throws(() => {
    adapter.createResult({ status: "done", targetRoot: "/fake/project" });
  }, /Invalid analyzer status: done/);
});

test("AnalyzerAdapter prevents writing inside target directory", async () => {
  const adapter = new MockAdapter({ name: "MockLinter", version: "1.0.0" });
  
  await assert.rejects(
    async () => adapter.analyze("/fake/project", { writeToTarget: true }),
    /Security Violation/
  );
  
  // Safe write outside target should not throw
  assert.doesNotThrow(() => {
    adapter.assertSafeOutputDirectory("/fake/project", "/tmp/repay-cache");
  });
});
