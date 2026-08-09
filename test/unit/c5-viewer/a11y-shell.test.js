// @category C5
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import { renderHome, renderEmpty, renderLesson } from "../../../src/viewer/shell.js";
import { CLIENT_SCRIPT } from "../../../src/viewer/client-script.js";

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
  assert.match(html, /class="ds-sidebar-scrim"/);
  assert.match(html, /aria-label="Close sidebar"/);
});

test("viewer client script remains valid JavaScript", () => {
  assert.doesNotThrow(() => new Function(CLIENT_SCRIPT));
});

test("home render keeps skip link with compact home", () => {
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
  assert.match(html, /ds-home-primary/);
  assert.match(html, /ds-lesson-card/);
  assert.match(html, /data-focus="off"/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  // mermaid only lazy-loads when diagrams exist — no blocking <script src=...>
  assert.doesNotMatch(html, /<script[^>]+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/mermaid/);
  assert.match(html, /Searching…/);
  assert.match(html, /Search unavailable/);
  assert.match(html, /data-diagram-size="width"/);
  assert.match(html, /data-diagram-size="height"/);
  assert.match(html, /data-mermaid-source-toggle/);
});

test("lesson completion exposes pending and announced result states", () => {
  const html = renderLesson({
    workbookTitle: "Demo workbook",
    sidebar: { chapters: [], counts: { written: 0, done: 0, planned: 0 } },
    title: "A lesson",
    bodyHtml: "<p>Body</p>",
    lessonKey: "lessons/a.md",
    completed: false,
    progress: {},
    prev: null,
    next: null,
  });
  assert.match(html, /id="ds-completion-status" role="status" aria-live="polite"/);
  assert.match(html, /aria-describedby="ds-completion-status"/);
  assert.match(html, /Saving…/);
  assert.match(html, /Could not save\. Try again\./);
});

test("incomplete lessons make completion and continuation one primary action", () => {
  const html = renderLesson({
    workbookTitle: "Demo workbook",
    sidebar: { chapters: [], counts: { written: 0, done: 0, planned: 0 } },
    title: "A lesson",
    bodyHtml: "<p>Body</p>",
    lessonKey: "lessons/a.md",
    completed: false,
    progress: {},
    prev: null,
    next: { key: "lessons/b.md", title: "Next lesson" },
  });
  assert.match(html, /data-next="\/lesson\/lessons%2Fb\.md"/);
  assert.match(html, />Mark done and continue</);
});

test("lesson restores scroll only when progress belongs to that lesson", () => {
  const html = renderLesson({
    workbookTitle: "Demo workbook",
    sidebar: { chapters: [], counts: { written: 0, done: 0, planned: 0 } },
    title: "A lesson",
    bodyHtml: "<p>Body</p>",
    lessonKey: "lessons/a.md",
    completed: false,
    progress: { lastRead: "lessons/b.md", lastScroll: "shared-heading" },
    prev: null,
    next: null,
  });
  assert.doesNotMatch(html, /data-last-scroll=/);
  assert.match(html, /ds-resume-marker/);
});

test("a11y checklist fixture exists", async () => {
  const md = await readFile(resolve(root, "test/fixtures/a11y-workbook-checklist.md"), "utf8");
  assert.match(md, /skip link/i);
  assert.match(md, /Residual risk/);
});

test("nav filter CSS forces [hidden] despite display:grid on nav links", async () => {
  const css = await readFile(resolve(root, "src/viewer/static/viewer.css"), "utf8");
  // display:grid on .ds-nav overrides UA [hidden] unless we force display:none
  assert.match(css, /\.ds-nav\[hidden\]/);
  assert.match(css, /\.ds-nav-planned\[hidden\]/);
  assert.match(css, /\.ds-chapter\[hidden\]/);
  assert.match(css, /display:\s*none\s*!important/);
});

test("main column stays measure-limited and centered (no TOC expand, zen hides rails)", async () => {
  const css = await readFile(resolve(root, "src/viewer/static/viewer.css"), "utf8");
  // plaque pages must not blow main-inner to full width when TOC rail exists
  assert.doesNotMatch(
    css,
    /\.ds-layout-toc\s+\.ds-main-inner:has\(\.ds-plaque\)\s*\{\s*max-width:\s*none/,
  );
  assert.match(
    css,
    /\.ds-main-inner:has\(\.ds-plaque\)\s*\{[\s\S]*?max-width:\s*var\(--lesson-measure\)/,
  );
  assert.match(css, /\.ds-main-inner\s*\{[\s\S]*?margin-inline:\s*auto/);
  // zen must remove rails from flow, not only opacity:0
  assert.match(css, /html\[data-focus="on"\]\s+\.ds-rail[\s\S]*?display:\s*none/);
});
