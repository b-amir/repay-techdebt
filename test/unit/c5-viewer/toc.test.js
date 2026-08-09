import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { renderLesson, renderMarkdown } from "../../../src/viewer/index.js";

test("TOC is generated for every lesson with section headings", async () => {
  const source = `
## Section 1
Content 1
## Section 2
Content 2
### Section 2a
Content 2a
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

  assert.match(html, /<aside class="ds-rail ds-rail-toc"/);
  assert.match(html, /ds-rail-toc-head/);
  assert.ok(
    html.indexOf('<header class="ds-lesson-cover">') <
      html.indexOf('<aside class="ds-rail ds-rail-toc"'),
  );
  assert.match(html, /data-id="section-1" aria-current="location"/);
  assert.match(html, /href="#section-1"/);
  assert.match(html, /href="#section-2"/);
  assert.match(html, /href="#section-2a"/);
  assert.match(html, /href="#section-3"/);
  assert.match(html, /<aside class="ds-toc-mobile"/);
  assert.doesNotMatch(html, /ds-reading-progress/);
});

test("TOC is generated even for a single section", async () => {
  const source = `
## Section 1
Content 1
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
  assert.match(html, /<aside class="ds-toc-mobile"/);
  assert.match(html, /href="#section-1"/);
});

test("TOC is omitted only when a lesson has no section headings", async () => {
  const bodyHtml = renderMarkdown("A lesson without sections.");
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
  assert.doesNotMatch(html, /<aside class="ds-toc-mobile"/);
  assert.match(html, /class="ds-layout ds-layout-toc ds-layout-cover"/);
});
