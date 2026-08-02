// @category C6
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import analyzeFile from "../scripts/pattern-worker.js";

test("finds TypeScript teaching patterns with Acorn and ts-morph", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-ts-"));
  const filePath = resolve(directory, "sample.ts");
  try {
    await writeFile(
      filePath,
      [
        "function identity<T>(value: T): T { return value; }",
        "const unsafe = value as any;",
        "await Promise.all(tasks);",
      ].join("\n"),
    );
    const result = await analyzeFile({ absolutePath: filePath, file: "sample.ts" });
    assert.ok(result.findings.some((finding) => finding.pattern === "Generic type parameters"));
    assert.ok(result.findings.some((finding) => finding.pattern === "Type escape: as any"));
    assert.ok(result.findings.some((finding) => finding.pattern === "Promise.all aggregation"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("finds Python teaching patterns through ast-grep", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-py-"));
  const filePath = resolve(directory, "sample.py");
  try {
    await writeFile(
      filePath,
      [
        "@trace",
        "def collect(items=[]):",
        "    try:",
        "        return [item for item in items]",
        "    except:",
        "        return []",
      ].join("\n"),
    );
    const result = await analyzeFile({ absolutePath: filePath, file: "sample.py" });
    assert.ok(result.findings.some((finding) => finding.pattern === "Python decorator"));
    assert.ok(
      result.findings.some((finding) => finding.pattern === "Python mutable default argument"),
    );
    assert.ok(result.findings.some((finding) => finding.pattern === "Python list comprehension"));
    assert.ok(result.findings.some((finding) => finding.pattern === "Python broad except"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
