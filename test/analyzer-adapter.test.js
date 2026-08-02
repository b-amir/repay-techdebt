import { test } from "vite-plus/test";
import * as assert from "node:assert/strict";
import {
  assertSafeAnalyzerOutputDirectory,
  createAnalyzerResult,
} from "../scripts/lib/analyzer-result.js";

test("createAnalyzerResult enforces status constraints and returns a uniform shape", () => {
  const result = createAnalyzerResult({
    analyzer: "MockLinter",
    version: "1.0.0",
    status: "successful",
    targetRoot: "/fake/project",
    scope: ["src/**/*.js"],
    evidence: { issuesFound: 42 },
    limitations: ["Did not parse JSX"],
  });

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

test("createAnalyzerResult accepts expected failure statuses", () => {
  const statuses = ["unavailable", "unconfigured", "refused", "failed", "partial", "stale"];
  for (const status of statuses) {
    const result = createAnalyzerResult({
      analyzer: "MockLinter",
      version: "1.0.0",
      status,
      targetRoot: "/fake/project",
      error: new Error(`Simulated failure: ${status}`),
    });
    assert.equal(result.status, status);
    assert.match(result.error, new RegExp(status));
  }
});

test("createAnalyzerResult rejects invalid statuses", () => {
  assert.throws(() => {
    createAnalyzerResult({ status: "done", analyzer: "x", targetRoot: "/fake/project" });
  }, /Invalid analyzer status: done/);
});

test("assertSafeAnalyzerOutputDirectory prevents writing inside target", () => {
  assert.throws(
    () =>
      assertSafeAnalyzerOutputDirectory(
        "MockLinter",
        "/fake/project",
        "/fake/project/.cache/analyzer",
      ),
    /Security Violation/,
  );
  assert.doesNotThrow(() => {
    assertSafeAnalyzerOutputDirectory("MockLinter", "/fake/project", "/tmp/repay-cache");
  });
});
