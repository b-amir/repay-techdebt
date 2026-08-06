// @category C8
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import { listRepayTools, callRepayTool, REPAY_TOOL_NAMES } from "../../../src/tools/repay-tools.js";
import { handle } from "../../../scripts/repay-mcp.js";

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

async function git(cwd, args) {
  await execute("git", args, { cwd });
}

test("listRepayTools exposes full thin surface", () => {
  const tools = listRepayTools();
  assert.ok(tools.length >= 15);
  for (const name of REPAY_TOOL_NAMES) {
    assert.ok(
      tools.some((t) => t.name === name),
      `missing ${name}`,
    );
  }
});

test("repay_doctor reports incomplete path on empty target", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-doc-"));
  try {
    const result = await callRepayTool("repay_doctor", { targetRoot: directory });
    assert.equal(result.ok, true);
    assert.equal(result.pathComplete, false);
    assert.equal(result.saveBlocked, true);
    assert.ok(result.reason);
    assert.doesNotMatch(String(result.reason), /purposeDone|pathComplete/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repay_trajectory_check fail-closed when gate missing", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-traj-"));
  try {
    const result = await callRepayTool("repay_trajectory_check", { targetRoot: directory });
    assert.equal(result.ok, false);
    assert.equal(result.pathComplete, false);
    assert.equal(result.saveBlocked, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repay_search_claims fail-closed when memory not ready", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-search-"));
  try {
    const result = await callRepayTool("repay_search_claims", {
      targetRoot: directory,
      query: "capture",
    });
    assert.equal(result.ok, false);
    assert.equal(result.empty, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repay_recheck_claims missing lesson fails closed", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-recheck-"));
  try {
    const result = await callRepayTool("repay_recheck_claims", {
      targetRoot: directory,
      lessonPath: resolve(directory, "nope.md"),
    });
    assert.equal(result.ok, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repay_status and list_lessons on empty target", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-status-"));
  try {
    const status = await callRepayTool("repay_status", { targetRoot: directory });
    assert.equal(status.ok, true);
    assert.equal(status.ready, false);
    assert.equal(status.lessonCount, 0);

    const list = await callRepayTool("repay_list_lessons", { targetRoot: directory });
    assert.equal(list.ok, true);
    assert.equal(list.count, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repay_open_workbook returns command without starting server", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-open-"));
  try {
    const result = await callRepayTool("repay_open_workbook", {
      targetRoot: directory,
      port: 9876,
      lesson: "lessons/demo.md",
    });
    assert.equal(result.ok, true);
    assert.equal(result.started, false);
    assert.match(result.command, /view-lessons\.js/);
    assert.match(result.suggestedUrl, /127\.0\.0\.1:9876/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repay_check_quality on inline markdown", async () => {
  const result = await callRepayTool("repay_check_quality", {
    markdown: "# Too short\n\nNope.\n",
    depth: "balanced",
  });
  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.errors));
});

test("repay_save_evaluate never writes", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-eval-"));
  try {
    const result = await callRepayTool("repay_save_evaluate", {
      targetRoot: directory,
      markdown: "# Too short\n\nNope.\n",
    });
    assert.equal(result.wrote, false);
    assert.equal(result.ok, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repay_progress returns empty store when missing", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-prog-"));
  try {
    const result = await callRepayTool("repay_progress", { targetRoot: directory });
    assert.equal(result.ok, true);
    assert.equal(result.lastRead, null);
    assert.ok(result.completed);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repay_get_lesson reads by absolute path", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-get-"));
  try {
    const lesson = resolve(directory, "lesson.md");
    await writeFile(lesson, "# Hello path\n\nBody.\n");
    const result = await callRepayTool("repay_get_lesson", {
      targetRoot: directory,
      lessonPath: lesson,
    });
    assert.equal(result.ok, true);
    assert.equal(result.title, "Hello path");
    assert.match(result.markdown, /Hello path/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repay_pr_changes works without GitHub MCP", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-pr-"));
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

    const result = await callRepayTool("repay_pr_changes", { targetRoot: directory });
    assert.equal(result.ok, true);
    assert.ok(result.fileCount >= 1);
    assert.ok(result.entries.some((e) => String(e.file).endsWith("app.js")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repay_check_evidence / faithfulness need lesson content", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-ev-"));
  try {
    const lesson = resolve(directory, "x.md");
    await writeFile(lesson, "# X\n\nSee `missing/file.js:1`.\n");
    const evidence = await callRepayTool("repay_check_evidence", {
      targetRoot: directory,
      lessonPath: lesson,
    });
    assert.equal(evidence.ok, false);

    const faith = await callRepayTool("repay_check_faithfulness", {
      targetRoot: directory,
      lessonPath: lesson,
    });
    assert.equal(typeof faith.ok, "boolean");
    assert.ok(faith.mode);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repay_capabilities returns report or fail-closed", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-cap-"));
  try {
    await writeFile(resolve(directory, "package.json"), "{}\n");
    const result = await callRepayTool("repay_capabilities", { targetRoot: directory });
    // Target may be rejected as non-repo or succeed with capabilities array
    if (result.ok) {
      assert.ok(Array.isArray(result.capabilities));
    } else {
      assert.ok(result.error);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("MCP handle tools/list and tools/call doctor", async () => {
  const chunks = [];
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(String(chunk));
    return true;
  };
  try {
    await handle({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    const listLine = chunks.find((c) => c.includes("repay_doctor"));
    assert.ok(listLine);
    const list = JSON.parse(listLine);
    assert.ok(list.result.tools.length >= 15);

    chunks.length = 0;
    const directory = await mkdtemp(resolve(tmpdir(), "repay-mcp-rpc-"));
    try {
      await handle({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "repay_doctor", arguments: { targetRoot: directory } },
      });
      const callLine = chunks.join("");
      const call = JSON.parse(callLine);
      assert.equal(call.id, 2);
      assert.ok(call.result.content[0].text.includes("saveBlocked"));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  } finally {
    process.stdout.write = orig;
  }
});

test("default path does not require MCP process (tools import pure)", async () => {
  assert.equal(typeof callRepayTool, "function");
  assert.ok(listRepayTools().every((t) => t.inputSchema));
  const pkg = JSON.parse(
    await import("node:fs/promises").then((fs) =>
      fs.readFile(resolve(root, "package.json"), "utf8"),
    ),
  );
  assert.equal(pkg.dependencies?.["@modelcontextprotocol/sdk"], undefined);
});
