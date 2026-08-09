import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { renderLesson, renderMarkdown } from "../../../src/viewer/index.js";

test("TOC jump list is generated when there are 4 or more h2s", async () => {
  const source = `
## Section 1
Content 1
## Section 2
Content 2
### Section 2a
Content 2a
## Section 3
Content 3
## Section 4
Content 4
`;
  const bodyHtml = renderMarkdown(source);
  const html = renderLesson({
    workbookTitle: "Test",
    sidebar: { chapters: [], counts: { done: 0, written: 0, planned: 0 } },
    title: "Lesson Title",
    bodyHtml,
    lessonKey: "lessons/test.md",
    completed: false,
    progress: {},
    prev: null,
    next: null,
  });

  assert.match(html, /<aside class="ds-rail ds-rail-toc"/);
  assert.match(html, /ds-rail-toc-head/);
  assert.match(html, /data-id="section-1" aria-current="location"/);
  assert.match(html, /href="#section-1"/);
  assert.match(html, /href="#section-2"/);
  assert.match(html, /href="#section-2a"/);
  assert.match(html, /href="#section-3"/);
  assert.match(html, /href="#section-4"/);
});

test("TOC jump list is omitted when there are fewer than 4 h2s", async () => {
  const source = `
## Section 1
Content 1
## Section 2
Content 2
## Section 3
Content 3
`;
  const bodyHtml = renderMarkdown(source);
  const html = renderLesson({
    workbookTitle: "Test",
    sidebar: { chapters: [], counts: { done: 0, written: 0, planned: 0 } },
    title: "Lesson Title",
    bodyHtml,
    lessonKey: "lessons/test.md",
    completed: false,
    progress: {},
    prev: null,
    next: null,
  });

  assert.doesNotMatch(html, /<aside class="ds-rail ds-rail-toc"/);
});
