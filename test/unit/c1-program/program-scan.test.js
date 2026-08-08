// @category C1
// Pure unit tests for the program-model seams that need no filesystem:
// normalizeScope safety (rejects `..`, absolute, NUL) and schema round-trips.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import {
  normalizeScope,
  classifyFile,
  discoverTargetFiles,
} from "../../../src/program/program-scan.js";
import {
  MODEL_VERSION,
  evidenceSchema,
  programNodeSchema,
  programEdgeSchema,
} from "../../../src/program/program-model-schema.js";

test("normalizeScope trims leading ./ and trailing / and keeps '.' for empty", () => {
  assert.equal(normalizeScope("src/foo"), "src/foo");
  assert.equal(normalizeScope("./src/foo/"), "src/foo");
  assert.equal(normalizeScope("."), ".");
  assert.equal(normalizeScope(""), ".");
  assert.equal(normalizeScope("./"), ".");
  // backslashes are normalized to forward slashes
  assert.equal(normalizeScope(".\\src\\bar"), "src/bar");
});

test("normalizeScope rejects unsafe target-relative paths", () => {
  for (const bad of ["/etc", "../escape", "a/../../b", "ok/\0/bad"]) {
    assert.throws(() => normalizeScope(bad), /safe target-relative path/);
  }
  // a single literal ".." segment anywhere is forbidden, even mid-path
  assert.throws(() => normalizeScope("foo/../bar"), /safe target-relative path/);
});

test("MODEL_VERSION is pinned", () => {
  assert.equal(MODEL_VERSION, 2);
});

test("evidenceSchema round-trips a valid evidence and rejects a bad state", () => {
  const valid = {
    id: "ev-1",
    state: "observed",
    confidence: 0.9,
    claim: "capture calls settle",
    sources: [{ path: "billing/capture.js", line: 4, kind: "file" }],
    observedAt: "2026-01-01T00:00:00Z",
  };
  const parsed = evidenceSchema.parse(valid);
  assert.equal(parsed.id, "ev-1");
  assert.deepEqual(parsed.limitations, []); // default applied

  const bad = evidenceSchema.safeParse({ ...valid, state: "made-up" });
  assert.equal(bad.success, false);
  // confidence out of range also fails
  assert.equal(evidenceSchema.safeParse({ ...valid, confidence: 5 }).success, false);
});

test("programNodeSchema accepts a declared node and rejects an unknown kind", () => {
  const node = { id: "n1", kind: "function", name: "capturePayment" };
  const parsed = programNodeSchema.parse(node);
  assert.deepEqual(parsed.attributes, {});
  assert.deepEqual(parsed.evidenceIds, []);

  const bad = programNodeSchema.safeParse({
    id: "n2",
    kind: "not-a-real-kind",
    name: "x",
  });
  assert.equal(bad.success, false);
});

test("programEdgeSchema enforces confidence bounds and a known edge kind", () => {
  const ok = programEdgeSchema.parse({
    id: "e1",
    kind: "calls",
    from: "n1",
    to: "n2",
    confidence: 0.5,
  });
  assert.equal(ok.kind, "calls");
  assert.equal(
    programEdgeSchema.safeParse({
      id: "e2",
      kind: "calls",
      from: "a",
      to: "b",
      confidence: 2,
    }).success,
    false,
  );
  assert.equal(
    programEdgeSchema.safeParse({
      id: "e3",
      kind: "teleports",
      from: "a",
      to: "b",
      confidence: 0.5,
    }).success,
    false,
  );
});

test("classifyFile labels manifests, tests, deployment, and ordinary files", () => {
  assert.equal(classifyFile("package.json"), "manifest");
  assert.equal(classifyFile("src/foo.test.js"), "test");
  assert.equal(classifyFile("deploy/Dockerfile"), "deployment");
  assert.equal(classifyFile("src/billing/capture.js"), "file");
});

test("discovery excludes framework-generated and browser-test output", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-scan-generated-"));
  try {
    for (const path of [
      "app/core",
      ".react-router/types",
      "storybook-static/assets",
      "playwright-report/data",
      "test-results/run",
    ])
      await mkdir(resolve(directory, path), { recursive: true });
    await writeFile(resolve(directory, "app/core/proxy.ts"), "export const proxy = 1;\n");
    await writeFile(resolve(directory, ".react-router/types/routes.ts"), "export {};\n");
    await writeFile(resolve(directory, "storybook-static/assets/app.js"), "export {};\n");
    await writeFile(resolve(directory, "playwright-report/data/report.json"), "{}\n");
    await writeFile(resolve(directory, "test-results/run/result.json"), "{}\n");
    const result = await discoverTargetFiles({
      targetRoot: directory,
      relativeSkillRoot: null,
      scope: ".",
      maxFiles: 100,
    });
    assert.deepEqual(result.files, ["app/core/proxy.ts"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
