// @category C5
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import http from "node:http";
import { test } from "vite-plus/test";
import { createViewerServer } from "../../../src/viewer/server.js";

async function makeRequest(server, options, postBody = null) {
  return new Promise((resolveResult, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        ...options,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolveResult({ status: res.statusCode, body });
        });
      },
    );
    req.on("error", reject);
    if (postBody) {
      req.write(postBody);
    }
    req.end();
  });
}

test("Path traversal attempts on /lesson/ return 404", async () => {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), "repay-viewer-sandbox-")));
  const lessonsDir = resolve(root, "lessons");
  await mkdir(lessonsDir);
  await writeFile(resolve(lessonsDir, "safe.md"), "# Safe");

  const server = createViewerServer({
    workbook: {
      ready: true,
      workbookRoot: root,
      lessonsDir,
      curriculumPath: resolve(root, "curriculum.json"),
      progressPath: resolve(root, "progress.json"),
      indexPath: resolve(root, "INDEX.md"),
    },
  });

  await new Promise((res) => server.listen(0, "127.0.0.1", () => res()));

  try {
    const tests = [
      "/lesson/../../etc/passwd",
      "/lesson/%2e%2e%2f%2e%2e%2fetc%2fpasswd",
      "/lesson//absolute/path",
      "/lesson/foo%00/bar",
    ];

    for (const path of tests) {
      const { status } = await makeRequest(server, { path, method: "GET" });
      assert.equal(status, 404, `Expected 404 for ${path}`);
    }

    // POST /api/completion with escape
    const { status: postStatus } = await makeRequest(
      server,
      {
        path: "/api/completion",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      JSON.stringify({ path: "../outside", completed: true }),
    );
    assert.equal(postStatus, 400, "Expected 400 for path escaping out on completion");

    // Positive test for HTML sanitization
    await writeFile(resolve(lessonsDir, "script.md"), "# Title\n<script>alert(1)</script>\n");
    const { status: scriptStatus, body } = await makeRequest(server, {
      path: "/lesson/lessons%2Fscript.md",
      method: "GET",
    });

    assert.equal(scriptStatus, 200);
    assert.ok(
      !body.includes("<script>alert(1)</script>"),
      "HTML script tags must not survive rendering",
    );
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});
