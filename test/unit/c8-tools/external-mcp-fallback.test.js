// @category C8
/**
 * External MCP optional: when GitHub MCP unavailable, bundled get-pr-changes still works.
 * Silent fallback - no install tour required.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import { probeCommand } from "../../../src/tools/tooling.js";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "../../..");

async function git(cwd, args) {
  await execute("git", args, { cwd });
}

test("missing optional CLI probe maps to unavailable runtimeOutcome (silent fallback signal)", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-gh-mcp-"));
  try {
    const result = await probeCommand(
      {
        id: "fake-optional-tool",
        label: "Fake optional tool",
        phase: "PR metadata and CI",
        command: "repay-definitely-not-installed-xyz",
        versionArgs: ["--version"],
        setup: ["not required"],
        fallback: "get-pr-changes.js",
        installationScope: "user-isolated",
        artifactScope: "private-cache",
        targetMutationRisk: "none",
      },
      directory,
    );
    assert.equal(result.status, "missing");
    assert.equal(result.runtimeOutcome, "unavailable");
    assert.equal(result.fallback, "get-pr-changes.js");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("bundled get-pr-changes fallback works without GitHub MCP process", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-pr-fb-"));
  try {
    await git(directory, ["init"]);
    await git(directory, ["config", "user.email", "test@example.com"]);
    await git(directory, ["config", "user.name", "Test"]);
    await writeFile(resolve(directory, "app.js"), "export const a = 1;\n");
    await git(directory, ["add", "app.js"]);
    await git(directory, ["commit", "-m", "init"]);
    await writeFile(resolve(directory, "app.js"), "export const a = 2;\n");
    await git(directory, ["add", "app.js"]);
    await git(directory, ["commit", "-m", "change"]);

    const result = await execute(
      process.execPath,
      [resolve(root, "scripts/get-pr-changes.js"), directory],
      { cwd: root, maxBuffer: 5 * 1024 * 1024 },
    );
    const entries = JSON.parse(result.stdout);
    assert.ok(Array.isArray(entries));
    assert.ok(entries.some((e) => e.file === "app.js" || e.file?.endsWith("app.js")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
