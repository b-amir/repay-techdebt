// @category C5
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import {
  ensureWorkbookReadme,
  renderWorkbookReadme,
  WORKBOOK_README_MARKER,
} from "../../../src/memory/workbook-readme.js";

test("renderWorkbookReadme includes offline view instructions and relative target", () => {
  const markdown = renderWorkbookReadme({
    targetRoot: "/work/repos/frontend",
    workbookRoot: "/work/repos/repay-frontend-techdebt",
    projectName: "frontend",
  });
  assert.match(markdown, new RegExp(WORKBOOK_README_MARKER));
  assert.match(markdown, /# frontend workbook/);
  assert.match(markdown, /repay view/);
  assert.doesNotMatch(markdown, /SKILL_ROOT/);
  assert.doesNotMatch(markdown, /npm install -g/);
  assert.match(markdown, /No AI agent needed/);
  assert.match(markdown, /INDEX\.md/);
});

test("ensureWorkbookReadme creates then refreshes marked files, skips custom", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "repay-workbook-readme-"));
  try {
    const meta = { targetRoot: resolve(dir, "..", "app"), projectName: "app" };
    assert.equal(await ensureWorkbookReadme(dir, meta), "created");
    const first = await readFile(resolve(dir, "README.md"), "utf8");
    assert.match(first, /repay view/);

    assert.equal(await ensureWorkbookReadme(dir, meta), "updated");

    await writeFile(resolve(dir, "README.md"), "# Custom notes\n", "utf8");
    assert.equal(await ensureWorkbookReadme(dir, meta), "skipped");
    assert.equal(await readFile(resolve(dir, "README.md"), "utf8"), "# Custom notes\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
