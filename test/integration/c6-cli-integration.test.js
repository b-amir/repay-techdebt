// @category C6
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, realpath, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { test } from "vite-plus/test";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "../..");

async function runScript(script, args = [], options = {}) {
  try {
    const result = await execute(process.execPath, [resolve(root, "scripts", script), ...args], {
      cwd: root,
      env: options.env ?? process.env,
      maxBuffer: 30 * 1024 * 1024,
      timeout: 120_000,
    });
    return { code: 0, ...result };
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

test("runtime and capability preflights are machine-readable", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-target-"));
  const runtime = await runScript("check-runtime.js", ["--format", "json"]);
  assert.equal(runtime.code, 0);
  assert.equal(JSON.parse(runtime.stdout).status, "ready");

  try {
    const capabilities = await runScript("check-capabilities.js", [target, "--format", "json"]);
    assert.equal(capabilities.code, 0);
    const report = JSON.parse(capabilities.stdout);
    const ids = report.capabilities.map((item) => item.id);
    assert.ok(ids.includes("graphify"));
    assert.ok(ids.includes("github-mcp"));
    const graphify = report.capabilities.find((item) => item.id === "graphify");
    assert.equal(graphify.installationScope, "user-isolated");
    assert.equal(graphify.artifactScope, "private-cache");
    assert.equal(graphify.targetMutationRisk, "none");
    assert.equal(typeof report.privateCacheRoot, "string");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("Semgrep failure is gated until fallback is explicitly accepted", async () => {
  const environment = { ...process.env, PATH: "" };
  const target = await mkdtemp(resolve(tmpdir(), "repay-techdebt-security-"));
  try {
    await writeFile(resolve(target, "app.js"), "export const answer = 42;\n");
    const gated = await runScript("scan-security.js", [target], {
      env: environment,
    });
    assert.equal(gated.code, 2);
    const failure = JSON.parse(gated.stderr);
    assert.equal(failure.type, "tool-failure");
    assert.equal(failure.tool, "semgrep");

    const fallback = await runScript("scan-security.js", [target, "--fallback", "secretlint"], {
      env: environment,
    });
    assert.equal(fallback.code, 0);
    assert.equal(JSON.parse(fallback.stdout).status, "fallback-succeeded");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("Secretlint masks a credential-shaped candidate", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-secret-"));
  const filePath = resolve(directory, "candidate.txt");
  const candidate = ["ghp", "_", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghij"].join("");
  try {
    await writeFile(filePath, candidate);
    const result = await runScript("check-snippet-secrets.js", [directory, filePath]);
    assert.equal(result.code, 2);
    assert.equal(result.stdout.includes(candidate), false);
    const output = JSON.parse(result.stdout);
    assert.equal(output.projectRoot, await realpath(directory));
    assert.equal(output.file, "candidate.txt");
    assert.equal(output.ok, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("snippet evidence rejects project-memory files", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-memory-snippet-"));
  const memoryDirectory = resolve(directory, ".repay-techdebt");
  const memoryFile = resolve(memoryDirectory, "decisions.md");
  try {
    await mkdir(memoryDirectory);
    await writeFile(memoryFile, "# Saved decisions\n");
    const result = await runScript("check-snippet-secrets.js", [directory, memoryFile]);
    assert.equal(result.code, 1);
    const failure = JSON.parse(result.stderr);
    assert.equal(failure.code, "SNIPPET_NOT_APPLICATION_SOURCE");
    assert.match(failure.requiredAction, /application-source file/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("pattern output records explicit target provenance", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-patterns-"));
  try {
    await writeFile(resolve(directory, "app.js"), "export const values = await Promise.all([]);\n");
    const result = await runScript("find-patterns.js", [directory, "--all"]);
    assert.equal(result.code, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.projectRoot, await realpath(directory));
    assert.equal(output.scannedFiles, 1);
    assert.equal(output.notExhaustive, true);
    assert.equal(output.role, "retrieve");
    assert.ok(output.teachingLeads.length >= 1);
    assert.equal(output.findings[0].pattern, "Promise.all aggregation");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atlas and runtime planning are read-only and runtime operations remain gated", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-atlas-"));
  try {
    await writeFile(
      resolve(directory, "package.json"),
      `${JSON.stringify({ scripts: { test: "dangerous-arbitrary-command", build: "also-arbitrary" } })}\n`,
    );
    await writeFile(resolve(directory, "server.js"), "export const server = true;\n");
    const before = (await readdir(directory)).sort();
    const runtime = await runScript("plan-runtime-evidence.js", [directory, "--format", "json"]);
    assert.equal(runtime.code, 0);
    const report = JSON.parse(runtime.stdout);
    assert.deepEqual(report.executed, []);
    assert.ok(report.operations.every((item) => item.gate === "permission-required"));
    assert.equal(runtime.stdout.includes("dangerous-arbitrary-command"), false);
    const atlas = await runScript("render-system-atlas.js", [directory]);
    assert.equal(atlas.code, 0);
    assert.match(atlas.stdout, /# System Atlas/);
    assert.deepEqual((await readdir(directory)).sort(), before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("dependency intelligence separates direct, locked, and observed usage", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-dependencies-"));
  try {
    await writeFile(
      resolve(directory, "package.json"),
      `${JSON.stringify({ dependencies: { express: "^5.0.0" } })}\n`,
    );
    await writeFile(
      resolve(directory, "package-lock.json"),
      `${JSON.stringify({
        packages: {
          "": { dependencies: { express: "^5.0.0" } },
          "node_modules/express": { version: "5.1.0" },
          "node_modules/debug": { version: "4.4.0" },
        },
      })}\n`,
    );
    await writeFile(resolve(directory, "server.js"), 'import express from "express";\n');
    const scan = await runScript("scan-dependencies.js", [directory]);
    assert.equal(scan.code, 0, scan.stderr);
    const result = JSON.parse(scan.stdout);
    const express = result.dependencies.find((item) => item.name === "express");
    const debug = result.dependencies.find((item) => item.name === "debug");
    assert.equal(express.direct, true);
    assert.ok(express.lockedVersions.includes("5.1.0"));
    assert.deepEqual(express.usedBy, ["server.js"]);
    assert.equal(debug.direct, false);
    assert.deepEqual(debug.lockedVersions, ["4.4.0"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test(
  "model, plan, atlas, query, and dependency CLIs honor target-relative scope",
  { timeout: 120_000 },
  async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-scoped-clis-"));
  try {
    await mkdir(resolve(directory, "selected"));
    await mkdir(resolve(directory, "outside"));
    await writeFile(
      resolve(directory, "selected", "package.json"),
      `${JSON.stringify({ dependencies: { express: "5.1.0" } })}\n`,
    );
    await writeFile(
      resolve(directory, "selected", "server.ts"),
      'import express from "express";\nexport const server = express();\n',
    );
    await writeFile(resolve(directory, "outside", "ignored.ts"), "export const ignored = true;\n");

    const model = await runScript("build-program-model.js", [
      directory,
      "--scope",
      "selected",
      "--max-files",
      "2",
    ]);
    assert.equal(model.code, 0, model.stderr);
    const parsedModel = JSON.parse(model.stdout);
    assert.equal(parsedModel.target.scope, "selected");
    assert.equal(parsedModel.coverage.discoveredFiles, 2);
    assert.ok(parsedModel.nodes.every((node) => !node.path?.startsWith("outside/")));

    const plan = await runScript("plan-analysis.js", [
      directory,
      "--scope",
      "selected",
      "--mode",
      "focused",
      "--focus",
      "server dependencies",
      "--format",
      "summary-json",
    ]);
    assert.equal(plan.code, 0, plan.stderr);
    const parsedPlan = JSON.parse(plan.stdout);
    assert.equal(parsedPlan.target.scope, "selected");
    assert.equal(parsedPlan.coverage.status, "partial");
    assert.ok(parsedPlan.investigations.length > 0);

    const atlas = await runScript("render-system-atlas.js", [
      directory,
      "--scope",
      "selected",
      "--max-files",
      "2",
    ]);
    assert.equal(atlas.code, 0, atlas.stderr);
    assert.match(atlas.stdout, /\*\*Scope:\*\* `selected`/);

    const query = await runScript("query-program-model.js", [
      directory,
      "server",
      "--scope",
      "selected",
    ]);
    assert.equal(query.code, 0, query.stderr);
    assert.equal(JSON.parse(query.stdout).target.scope, "selected");

    const dependencies = await runScript("scan-dependencies.js", [
      directory,
      "--scope",
      "selected",
    ]);
    assert.equal(dependencies.code, 0, dependencies.stderr);
    assert.equal(JSON.parse(dependencies.stdout).target.scope, "selected");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Graphify wrapper keeps installation and artifacts outside the target", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-graphify-target-"));
  const state = await mkdtemp(resolve(tmpdir(), "repay-techdebt-graphify-state-"));
  const cache = await mkdtemp(resolve(tmpdir(), "repay-techdebt-graphify-cache-"));
  const fake = resolve(state, "fake-graphify.mjs");
  try {
    await writeFile(resolve(directory, "app.ts"), "export const app = true;\n");
    await writeFile(
      fake,
      `#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const args = process.argv.slice(2);
if (args[0] === "extract") {
  const out = args[args.indexOf("--out") + 1];
  mkdirSync(resolve(out, "graphify-out"), { recursive: true });
  writeFileSync(resolve(out, "graphify-out", "graph.json"), JSON.stringify({ nodes: [], edges: [] }));
  process.stdout.write("private graph built");
} else process.stdout.write("private graph query");
`,
    );
    await chmod(fake, 0o755);
    const environment = {
      ...process.env,
      REPAY_GRAPHIFY_COMMAND: fake,
      REPAY_TECHDEBT_STATE_DIR: state,
      REPAY_TECHDEBT_CACHE_DIR: cache,
    };
    const before = (await readdir(directory)).sort();
    const proposed = await runScript("run-graphify.js", ["extract", directory], {
      env: environment,
    });
    assert.equal(proposed.code, 2);
    assert.deepEqual(JSON.parse(proposed.stdout).targetWrites, []);
    assert.deepEqual((await readdir(directory)).sort(), before);

    const extracted = await runScript("run-graphify.js", ["extract", directory, "--yes"], {
      env: environment,
    });
    assert.equal(extracted.code, 0, extracted.stderr);
    const result = JSON.parse(extracted.stdout);
    assert.equal(result.status, "succeeded");
    assert.deepEqual(result.targetWrites, []);
    assert.equal(result.graphPath.startsWith(cache), true);
    assert.deepEqual((await readdir(directory)).sort(), before);

    const query = await runScript(
      "run-graphify.js",
      ["query", directory, "--question", "where is app"],
      { env: environment },
    );
    assert.equal(query.code, 0, query.stderr);
    assert.equal(JSON.parse(query.stdout).output, "private graph query");
    assert.deepEqual((await readdir(directory)).sort(), before);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(state, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("baseline analyzers load private external preferences without target memory", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-private-profile-"));
  const state = await mkdtemp(resolve(tmpdir(), "repay-techdebt-private-profile-state-"));
  const cache = await mkdtemp(resolve(tmpdir(), "repay-techdebt-private-profile-cache-"));
  const environment = {
    ...process.env,
    REPAY_TECHDEBT_STATE_DIR: state,
    REPAY_TECHDEBT_CACHE_DIR: cache,
  };
  try {
    await writeFile(resolve(directory, "a.ts"), "export const a = true;\n");
    await writeFile(resolve(directory, "b.ts"), "export const b = true;\n");
    const initialized = await runScript(
      "project-memory.js",
      ["init", directory, "--max-files", "1", "--yes"],
      { env: environment },
    );
    assert.equal(initialized.code, 0, initialized.stderr);
    assert.deepEqual(JSON.parse(initialized.stdout).targetWrites, []);
    assert.equal((await readdir(directory)).includes(".repay-techdebt"), false);

    const profile = await runScript("profile-project.js", [directory], {
      env: environment,
    });
    assert.equal(profile.code, 0, profile.stderr);
    const result = JSON.parse(profile.stdout);
    assert.equal(result.coverage.fileLimit, 1);
    assert.equal(result.coverage.modeledFiles, 1);
    assert.ok(result.coverage.reasonCodes.includes("file-limit-reached"));
    assert.deepEqual((await readdir(directory)).sort(), ["a.ts", "b.ts"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(state, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test(
  "analysis entry points refuse the skill repository as their target",
  { timeout: 60_000 },
  async () => {
    /** @type {[string, string[]][]} */
    const invocations = [
      ["check-capabilities.js", [root, "--format", "json"]],
      ["scan-architecture.js", [root, "--format", "json"]],
      ["find-patterns.js", [root, "--all"]],
      ["scan-duplication.js", [root]],
      ["scan-security.js", [root]],
      ["get-pr-changes.js", [root]],
      ["check-snippet-secrets.js", [root, resolve(root, "SKILL.md")]],
      ["profile-project.js", [root]],
      ["build-program-model.js", [root]],
      ["plan-analysis.js", [root]],
      ["query-program-model.js", [root, "SKILL"]],
      ["render-system-atlas.js", [root]],
      ["run-graphify.js", ["paths", root]],
      ["plan-runtime-evidence.js", [root]],
      ["scan-dependencies.js", [root]],
    ];

    for (const [script, args] of invocations) {
      const result = await runScript(script, args);
      assert.equal(result.code, 1, `${script} should reject the skill root`);
      const failure = JSON.parse(result.stderr);
      assert.equal(failure.type, "target-error", script);
      assert.equal(failure.code, "TARGET_IS_SKILL", script);
    }
  },
);

test("analysis never falls back to the current directory when target is omitted", async () => {
  const result = await runScript("check-capabilities.js", ["--format", "json"]);
  assert.equal(result.code, 1);
  const failure = JSON.parse(result.stderr);
  assert.equal(failure.type, "target-error");
  assert.equal(failure.code, "TARGET_REQUIRED");
});

test("unsupported-language fallbacks are explicit", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-rust-"));
  try {
    await writeFile(resolve(directory, "main.rs"), "fn main() {}\n");
    const patterns = await runScript("find-patterns.js", [directory, "--all"]);
    assert.equal(patterns.code, 2);
    assert.equal(JSON.parse(patterns.stderr).type, "tool-failure");

    const architecture = await runScript("scan-architecture.js", [directory, "--format", "json"]);
    assert.equal(architecture.code, 2);
    assert.equal(JSON.parse(architecture.stderr).tool, "dependency-cruiser");

    const tree = await runScript("scan-architecture.js", [
      directory,
      "--fallback",
      "tree",
      "--format",
      "json",
    ]);
    assert.equal(tree.code, 0);
    assert.equal(JSON.parse(tree.stdout).backend.fallbackUsed, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("architecture inventory exposes a resumable cursor and scoped coverage", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-techdebt-resume-"));
  try {
    await mkdir(resolve(directory, "modulo"));
    await writeFile(resolve(directory, "modulo", "a.rs"), "pub fn a() {}\n");
    await writeFile(resolve(directory, "modulo", "b.rs"), "pub fn b() {}\n");
    await writeFile(resolve(directory, "outside.rs"), "pub fn outside() {}\n");
    const first = await runScript("scan-architecture.js", [
      directory,
      "--fallback",
      "tree",
      "--format",
      "json",
      "--scope",
      "modulo",
      "--max-files",
      "1",
    ]);
    assert.equal(first.code, 0, first.stderr);
    const firstPage = JSON.parse(first.stdout).summary;
    assert.equal(firstPage.status, "partial");
    assert.equal(firstPage.discoveredFiles, 2);
    assert.equal(firstPage.scannedFiles, 1);
    assert.equal(firstPage.nextCursor, "modulo/a.rs");
    assert.ok(firstPage.reasonCodes.includes("scoped-analysis"));

    const second = await runScript("scan-architecture.js", [
      directory,
      "--fallback",
      "tree",
      "--format",
      "json",
      "--scope",
      "modulo",
      "--max-files",
      "1",
      "--resume-after",
      firstPage.nextCursor,
    ]);
    assert.equal(second.code, 0, second.stderr);
    const secondPage = JSON.parse(second.stdout).summary;
    assert.equal(secondPage.scannedFiles, 1);
    assert.equal(secondPage.remainingFiles, 0);
    assert.equal(secondPage.nextCursor, null);
    assert.ok(secondPage.reasonCodes.includes("resumed-page"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
