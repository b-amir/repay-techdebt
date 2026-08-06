// @category C5
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  renderMarkdown,
  prepareLessonMarkdown,
} from "../../../src/viewer/markdown-render.js";
import { renderLesson } from "../../../src/viewer/shell.js";

test("renderMarkdown renders GFM tables", () => {
  const html = renderMarkdown(
    "| Case | Result |\n| --- | --- |\n| Mutation same-origin | 403 CSRF rejection |\n",
  );
  assert.match(html, /<table/);
  assert.match(html, /<th>Case<\/th>/);
  assert.match(html, /403 CSRF rejection/);
});

test("renderMarkdown highlights fenced code with explicit language", () => {
  const html = renderMarkdown("```typescript\nconst x: number = 1;\n```\n");
  assert.match(html, /ds-codeblock/);
  assert.match(html, /hljs/);
  assert.match(html, /ds-codeblock-lang/);
  assert.match(html, /number/);
});

test("renderMarkdown highlights untagged fences without a language label", () => {
  const html = renderMarkdown(
    "```\nexport function hasPermission(permissions) {\n  return permissions.some((p) => p.module === module);\n}\n```\n",
  );
  assert.match(html, /hljs/);
  assert.match(html, /ds-codeblock-header/);
  assert.doesNotMatch(html, />Code</);
  assert.doesNotMatch(html, /ds-code-plain/);
});

test("renderMarkdown emits mermaid blocks for client rendering", () => {
  const html = renderMarkdown(
    "```mermaid\nflowchart TD\n  accTitle: Test\n  accDescr: Desc\n  A-->B\n```\n",
  );
  assert.match(html, /ds-mermaid-wrap/);
  assert.match(html, /ds-mermaid-expand/);
  assert.match(html, /aria-label="Expand diagram"/);
  assert.match(html, /<pre class="mermaid">/);
  assert.match(html, /flowchart TD/);
  assert.doesNotMatch(html, /ds-codeblock/);
});

test("renderMarkdown turns path:line citations into footnotes when targetRoot is provided", () => {
  const html = renderMarkdown(
    "See (`src/auth.js:42`) for the guard. Also `src/auth.js:42` again and (`app/core/api/http-client.ts:123`).",
    { targetRoot: "/work/app" },
  );
  assert.match(html, /class="ds-fn-ref"/);
  assert.match(html, /class="ds-footnotes"/);
  assert.match(html, /href="#fn-1"/);
  assert.match(html, /id="fn-1"/);
  assert.match(html, /class="ds-citation"/);
  assert.match(html, /vscode:\/\/file\/\/work\/app\/src\/auth.js:42/);
  assert.match(html, /vscode:\/\/file\/\/work\/app\/app\/core\/api\/http-client.ts:123/);
  // body keeps prose free of long path chips and surrounding parens
  assert.doesNotMatch(html, /See <a class="ds-citation"/);
  assert.doesNotMatch(html, /\(<sup class="ds-fn-ref"/);
  assert.doesNotMatch(html, /ds-fn-ref"><a[^>]*>\d+<\/a><\/sup>\)/);
  // duplicate path:line reuses one note
  assert.equal((html.match(/id="fn-\d+"/g) || []).length, 2);
});

test("prepareLessonMarkdown drops craft frontmatter and leading H1", () => {
  const source = `---
id: auth-boundary
title: Auth boundary
subject: map
shape: map
primaryPaths:
  - src/auth.js
mapAnswers: |
  capture tokens at edge
---
# Auth boundary

## Learner outcome

Tokens validated at the edge.
`;
  const prepared = prepareLessonMarkdown(source);
  assert.equal(prepared.title, "Auth boundary");
  assert.doesNotMatch(prepared.body, /^---/m);
  assert.doesNotMatch(prepared.body, /\bid:\s*auth-boundary\b/);
  assert.doesNotMatch(prepared.body, /mapAnswers/);
  assert.doesNotMatch(prepared.body, /primaryPaths/);
  assert.doesNotMatch(prepared.body, /^#\s+Auth boundary/m);
  assert.match(prepared.body, /## Learner outcome/);

  const page = renderLesson({
    workbookTitle: "WB",
    sidebar: {
      chapters: [
        {
          title: "Core",
          items: [{ lessonKey: "lessons/auth.md", title: "Auth boundary" }],
        },
      ],
      counts: { done: 0, written: 1, planned: 0 },
    },
    title: prepared.title,
    bodyHtml: renderMarkdown(prepared.body),
    lessonKey: "lessons/auth.md",
    completed: false,
    progress: {},
    prev: null,
    next: null,
  });
  assert.equal((page.match(/<h1 class="ds-lesson-title">/g) || []).length, 1);
  assert.doesNotMatch(page, /mapAnswers|primaryPaths|subject:|shape:/);
  assert.match(page, /Learner outcome/);
});
