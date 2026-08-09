// @category C5
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { generateCoverArt, renderLesson } from "../../../src/viewer/index.js";

const emptySidebar = {
  chapters: [],
  counts: { written: 0, done: 0, planned: 0 },
};

test("cover art is stable per lesson and varies between lessons", () => {
  const first = generateCoverArt("lessons/request-boundary.md");
  const repeat = generateCoverArt("lessons/request-boundary.md");
  const other = generateCoverArt("lessons/cache-coherence.md");

  assert.equal(first, repeat);
  assert.notEqual(first, other);
  assert.match(first, /viewBox="0 0 1200 248"/);
  assert.match(first, /data-cover-side="right"/);
  assert.match(first, /aria-hidden="true"/);
  assert.doesNotMatch(first, /<text\b/);
});

test("every cover variant stays sparse", () => {
  for (let index = 0; index < 40; index++) {
    const art = generateCoverArt(`lessons/sample-${index}.md`);
    const primitives = art.match(/<(?:path|circle|ellipse|rect)\b/g) || [];
    assert.ok(primitives.length <= 4, `sample ${index} rendered ${primitives.length} primitives`);
    assert.doesNotMatch(art, /ds-cover-fill/);
  }
});

test("lesson cover spans the content region while remaining inside main", () => {
  const html = renderLesson({
    workbookTitle: "Demo workbook",
    sidebar: emptySidebar,
    title: "Navigation Must Mirror Route Reachability",
    bodyHtml: '<h2 id="mechanism">Mechanism</h2><p>Body</p>',
    lessonKey: "lessons/navigation.md",
    completed: false,
    progress: {},
    prev: null,
    next: null,
  });

  const mainStart = html.indexOf('<main class="ds-content">');
  const cover = html.indexOf('<header class="ds-lesson-cover">');
  const article = html.indexOf('<article class="ds-plaque">');
  const mainEnd = html.indexOf("</main>");

  assert.match(html, /class="ds-layout ds-layout-toc ds-layout-cover"/);
  assert.ok(mainStart >= 0 && mainStart < cover);
  assert.ok(cover < article && article < mainEnd);
  assert.match(html, /class="ds-lesson-cover-art" aria-hidden="true"/);
  assert.equal((html.match(/<h1 class="ds-lesson-title">/g) || []).length, 1);
});
