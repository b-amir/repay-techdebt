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
      chapters: [
        {
          title: "Intro",
          items: [
            { title: "Open lesson", lessonKey: "lessons/open.md", state: "written" },
            { title: "Done lesson", lessonKey: "lessons/done.md", state: "done" },
            { title: "Planned topic", id: "topic-planned", state: "planned" },
          ],
        },
      ],
      counts: { written: 2, done: 1, planned: 1 },
      total: 3,
    },
    progress: { lastRead: "lessons/open.md", completed: {} },
  });
  assert.match(html, /ds-skip-link/);
  assert.match(html, /id="ds-main-content"/);
  assert.match(html, /ds-search-trigger/);
  assert.match(html, /data-filter="done"/);
  assert.match(html, /data-filter="written"/);
  assert.match(html, /data-filter="planned"/);
  assert.match(html, /data-filter-clear/);
  assert.match(html, /data-last-read="lessons\/open\.md"/);
  assert.match(html, /data-nav-state="planned"/);
  assert.match(html, /ds-lesson-card-head/);
  assert.match(html, /data-focus="off"/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
});

test("a11y checklist fixture exists", async () => {
  const md = await readFile(resolve(root, "test/fixtures/a11y-workbook-checklist.md"), "utf8");
  assert.match(md, /skip link/i);
  assert.match(md, /Residual risk/);
});
