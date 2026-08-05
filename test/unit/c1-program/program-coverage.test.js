// @category C1
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { buildCoverage } from "../../../src/program/program-coverage.js";

const baseInput = {
  scope: ".",
  discoveredLength: 10,
  filesLength: 10,
  manifestFilesLength: 2,
  maxManifestFiles: 1_000,
  relationCandidateCount: 5,
  relationFilesRead: 5,
  skippedLargeFiles: 0,
  maxRelationFiles: 1_500,
  relationBytesRead: 1_024,
  maxRelationBytes: 12 * 1024 * 1024,
  unreadableFiles: 0,
  maxFiles: 30_000,
  relationLanguagesSupported: ["TypeScript", "Python"],
  relationLanguagesUnsupported: [],
  parserDiagnostics: [],
  relationshipDiagnostics: [],
};

test("buildCoverage reports complete when no limits or issues apply", () => {
  const coverage = buildCoverage(baseInput);
  assert.equal(coverage.status, "complete");
  assert.equal(coverage.truncated, false);
  assert.deepEqual(coverage.reasonCodes, []);
  assert.equal(coverage.discoveredFiles, 10);
  assert.equal(coverage.modeledFiles, 10);
  assert.equal(coverage.manifestFilesDiscovered, 2);
  assert.equal(coverage.manifestFilesRead, 2);
  assert.equal(coverage.relationFilesRead, 5);
  assert.equal(coverage.relationBytesRead, 1_024);
  assert.equal(coverage.fileLimit, 30_000);
  assert.equal(coverage.manifestFileLimit, 1_000);
  assert.equal(coverage.relationFileLimit, 1_500);
  assert.equal(coverage.relationReadBudget, 12 * 1024 * 1024);
  assert.deepEqual(coverage.relationLanguagesSupported, ["TypeScript", "Python"]);
  assert.deepEqual(coverage.relationLanguagesUnsupported, []);
  assert.deepEqual(coverage.parserDiagnostics, []);
});

test("buildCoverage marks scoped analysis as partial without truncation", () => {
  const coverage = buildCoverage({ ...baseInput, scope: "src" });
  assert.equal(coverage.status, "partial");
  assert.equal(coverage.truncated, false);
  assert.deepEqual(coverage.reasonCodes, ["scoped-analysis"]);
});

test("buildCoverage detects file-limit truncation", () => {
  const coverage = buildCoverage({
    ...baseInput,
    discoveredLength: 100,
    filesLength: 50,
  });
  assert.equal(coverage.truncated, true);
  assert.equal(coverage.status, "partial");
  assert.ok(coverage.reasonCodes.includes("file-limit-reached"));
});

test("buildCoverage aggregates multiple partial reason codes", () => {
  const coverage = buildCoverage({
    ...baseInput,
    scope: "lib",
    discoveredLength: 20,
    filesLength: 10,
    manifestFilesLength: 1_200,
    maxManifestFiles: 1_000,
    relationCandidateCount: 10,
    relationFilesRead: 4,
    skippedLargeFiles: 2,
    relationBytesRead: 12 * 1024 * 1024,
    unreadableFiles: 1,
    relationLanguagesUnsupported: ["Rust"],
    parserDiagnostics: [
      {
        path: "package.json",
        parser: "manifest",
        severity: "error",
        code: "invalid-json",
        message: "parse failed",
      },
    ],
    relationshipDiagnostics: [
      {
        path: "src/a.ts",
        parser: "typescript",
        severity: "error",
        code: "syntax-error",
        message: "unexpected token",
      },
      {
        path: "src/b.ts",
        parser: "typescript",
        severity: "warning",
        code: "computed-module-specifier",
        message: "dynamic import",
      },
    ],
  });

  assert.equal(coverage.truncated, true);
  assert.equal(coverage.status, "partial");
  assert.equal(coverage.manifestFilesRead, 1_000);
  assert.deepEqual(coverage.reasonCodes, [
    "scoped-analysis",
    "file-limit-reached",
    "manifest-file-limit-reached",
    "relation-file-limit-or-budget-reached",
    "relation-byte-budget-reached",
    "oversized-relation-files-skipped",
    "unreadable-files",
    "relationship-parser-errors",
    "computed-module-specifiers-unresolved",
    "manifest-parser-errors",
    "unsupported-relationship-languages",
  ]);
  assert.equal(coverage.parserDiagnostics.length, 3);
  assert.equal(coverage.skippedLargeFiles, 2);
  assert.equal(coverage.unreadableFiles, 1);
});

test("buildCoverage deduplicates reason codes", () => {
  const coverage = buildCoverage({
    ...baseInput,
    discoveredLength: 50,
    filesLength: 10,
    relationCandidateCount: 20,
    relationFilesRead: 0,
    skippedLargeFiles: 0,
    relationBytesRead: 12 * 1024 * 1024,
  });
  assert.equal(new Set(coverage.reasonCodes).size, coverage.reasonCodes.length);
});
