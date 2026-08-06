// @category C5
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import { renderHome, renderEmpty } from "../../../src/viewer/shell.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("shell HTML has skip link and main landmark id", () => {
  const html = renderEmpty({
    workbookTitle: "Demo workbook",
    reason: "No lessons yet.",
  });
  assert.match(html, /class="ds-skip-link"/);
  assert.match(html, /href="#ds-main-content"/);
  assert.match(html, /id="ds-main-content"/);
  assert.match(html, /lang="en"/);
});

test("home render keeps skip link with covered map", () => {
  const html = renderHome({
    workbookTitle: "Demo workbook",
    sidebar: {
      chapters: [],
      counts: { written: 0, done: 0, planned: 0 },
    },
    progress: null,
  });
  assert.match(html, /ds-skip-link/);
  assert.match(html, /id="ds-main-content"/);
});

test("a11y checklist fixture exists", async () => {
  const md = await readFile(resolve(root, "test/fixtures/a11y-workbook-checklist.md"), "utf8");
  assert.match(md, /skip link/i);
  assert.match(md, /Residual risk/);
});
