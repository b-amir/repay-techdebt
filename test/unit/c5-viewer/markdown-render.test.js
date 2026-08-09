// @category C5
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { test } from "vite-plus/test";
import { renderMarkdown, prepareLessonMarkdown } from "../../../src/viewer/markdown-render.js";
import { renderLesson } from "../../../src/viewer/shell.js";
import { CLIENT_SCRIPT } from "../../../src/viewer/client-script.js";

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

test("renderMarkdown folds only long code blocks", () => {
  const shortHtml = renderMarkdown("```js\nconst value = 1;\n```\n");
  const longCode = Array.from({ length: 19 }, (_, index) => `const line${index} = ${index};`).join(
    "\n",
  );
  const longHtml = renderMarkdown(`\`\`\`js\n${longCode}\n\`\`\`\n`);

  assert.doesNotMatch(shortHtml, /ds-codeblock-collapsible|ds-codeblock-toggle/);
  assert.match(longHtml, /ds-codeblock-collapsible/);
  assert.match(longHtml, /data-lines="19"/);
  assert.match(longHtml, /aria-expanded="false"/);
  assert.match(longHtml, />Show more</);
});

test("renderMarkdown emits mermaid blocks for client rendering", () => {
  const html = renderMarkdown(
    "```mermaid\nflowchart TD\n  accTitle: Test\n  accDescr: Desc\n  A-->B\n```\n",
  );
  assert.match(html, /ds-mermaid-wrap/);
  assert.match(html, /ds-mermaid-expand/);
  assert.match(html, /aria-label="Open larger diagram"/);
  assert.match(html, /<pre class="mermaid">/);
  assert.match(html, /flowchart TD/);
  assert.doesNotMatch(html, /ds-codeblock/);
});

test("renderMarkdown gives captions and callouts quiet semantic hooks", () => {
  const html = renderMarkdown(
    "**What this shows:** Requests cross one boundary.\n\n> **Note:** Tokens stay at the edge.\n",
  );
  assert.match(html, /class="ds-figure-caption"/);
  assert.match(html, /class="ds-callout ds-callout-note"/);
});

test("renderMarkdown turns one prediction and reveal into native disclosure", () => {
  const html = renderMarkdown(
    "> **Prediction:** What happens if the guard is removed?\n>\n> **Reveal:** The mutation runs because nothing rejects the request.\n",
  );
  assert.match(html, /<details class="ds-prediction">/);
  assert.match(html, /<summary>/);
  assert.match(html, /What happens if the guard is removed\?/);
  assert.match(html, /class="ds-prediction-answer"/);
  assert.match(html, /The mutation runs because nothing rejects the request/);
  assert.doesNotMatch(html, /<blockquote>/);
});

test("renderMarkdown turns a reflection question into a native answer disclosure", () => {
  const html = renderMarkdown(
    "> **Think first:** Why does the route guard run before the component?\n>\n> **Answer:** The loader decides whether rendering may begin.\n",
  );
  assert.match(html, /<details class="ds-reflection">/);
  assert.match(html, /<summary>/);
  assert.match(html, /Why does the route guard run before the component\?/);
  assert.match(html, /class="ds-reflection-answer"/);
  assert.match(html, /The loader decides whether rendering may begin/);
});

test("renderMarkdown builds an accessible self-check with one predefined answer", () => {
  const html = renderMarkdown(
    "> **Quick check:** Which boundary rejects direct navigation first?\n>\n> - [ ] The component gate\n> - [x] The route loader\n> - [ ] The API client\n>\n> **Why:** The loader runs before rendering and can redirect immediately.\n",
  );
  assert.match(html, /<form class="ds-quiz" data-quiz>/);
  assert.match(html, /<fieldset>/);
  assert.match(html, /<legend>/);
  assert.equal((html.match(/type="radio"/g) || []).length, 3);
  assert.equal((html.match(/data-correct="true"/g) || []).length, 1);
  assert.doesNotMatch(html, /<input[^>]+aria-describedby/);
  assert.match(html, /class="ds-quiz-submit" disabled>Check answer/);
  assert.match(html, /class="ds-quiz-announcement" role="status" aria-live="polite"/);
  assert.match(html, /<noscript><details class="ds-quiz-fallback"><summary>Show answer/);
  assert.match(html, /The loader runs before rendering/);
  assert.doesNotMatch(html, /<blockquote>/);
});

test("self-check behavior handles wrong, retry, correct, and announced feedback states", () => {
  const quiz = renderMarkdown(
    "> **Quick check:** Which boundary rejects direct navigation first?\n>\n> - [ ] The component gate\n> - [x] The route loader\n>\n> **Why:** The loader can redirect before the component tree exists.\n",
  );
  const dom = new JSDOM(`<!doctype html><body>${quiz}</body>`, {
    runScripts: "outside-only",
    url: "http://127.0.0.1/lesson/test",
  });
  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  const wasLoading = dom.window.document.readyState === "loading";
  dom.window.eval(CLIENT_SCRIPT);
  if (wasLoading) dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));

  const form = dom.window.document.querySelector("[data-quiz]");
  const choices = [...form.querySelectorAll('input[type="radio"]')];
  const submit = form.querySelector(".ds-quiz-submit");
  const feedback = form.querySelector(".ds-quiz-feedback");
  const announcement = form.querySelector(".ds-quiz-announcement");

  choices[0].click();
  assert.equal(submit.disabled, false);
  form.requestSubmit(submit);
  assert.equal(form.getAttribute("data-state"), "incorrect");
  assert.equal(feedback.hidden, false);
  assert.equal(submit.hidden, true);
  assert.match(announcement.textContent, /Not quite.*route loader.*component tree/s);
  assert.equal(
    form.querySelector('[data-result="incorrect"] .ds-quiz-option-status').textContent,
    "Your answer",
  );
  assert.equal(
    form.querySelector('[data-result="correct"] .ds-quiz-option-status').textContent,
    "Correct answer",
  );

  choices[1].click();
  assert.equal(form.hasAttribute("data-state"), false);
  assert.equal(feedback.hidden, true);
  assert.equal(announcement.textContent, "");
  assert.equal(submit.disabled, false);
  assert.equal(submit.hidden, false);
  form.requestSubmit(submit);
  assert.equal(form.getAttribute("data-state"), "correct");
  assert.match(announcement.textContent, /^Correct\..*loader can redirect/s);
  assert.equal(submit.disabled, true);

  dom.window.close();
});

test("renderMarkdown leaves malformed self-checks as ordinary lesson content", () => {
  const html = renderMarkdown(
    "> **Quick check:** Pick every correct answer.\n>\n> - [x] First\n> - [x] Second\n>\n> **Why:** This pattern supports exactly one answer.\n",
  );
  assert.doesNotMatch(html, /data-quiz/);
  assert.match(html, /<blockquote>/);
});

test("renderMarkdown gives See for yourself walkthroughs a dedicated reading surface", () => {
  const html = renderMarkdown(
    "> **See for yourself:** Watch the redirect happen in the browser.\n>\n> 1. Open **Network** and preserve the log.\n> 2. Request the protected route.\n>\n> **Change one thing:** Remove the cookie and repeat.\n>\n> **Look for:** A redirect before protected data loads.\n",
  );
  assert.match(html, /<aside class="ds-devtools-lab" aria-label="See for yourself">/);
  assert.match(html, /class="ds-devtools-lab-header"/);
  assert.match(html, /<ol>/);
  assert.match(html, /Change one thing/);
  assert.match(html, /Look for/);
  assert.doesNotMatch(html, /<blockquote>/);
});

test("renderMarkdown turns path:line citations into footnotes when targetRoot is provided", () => {
  const html = renderMarkdown(
    "See (`src/auth.js:42`) for the guard. Also `src/auth.js:42` again and (`app/core/api/http-client.ts:123`).",
    { targetRoot: "/work/app" },
  );
  assert.match(html, /class="ds-fn-ref"/);
  assert.match(html, /class="ds-footnotes"/);
  assert.match(html, /href="#fn-1"/);
  assert.match(html, /data-source-preview/);
  assert.match(html, /role="tooltip" hidden>auth\.js · line 42</);
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

test("renderMarkdown preserves citation ranges and links to their first line", () => {
  const html = renderMarkdown(
    "See (`src/auth.js:42–47`) and (`src/auth.js:60-62`) for the complete guard.",
    { targetRoot: "/work/app" },
  );

  assert.match(html, /<sup class="ds-fn-ref">/);
  assert.match(html, /src\/auth\.js:42-47/);
  assert.match(html, /42-47, 60-62/);
  assert.match(html, /vscode:\/\/file\/\/work\/app\/src\/auth\.js:42/);
  assert.doesNotMatch(html, /42–47/);
  assert.equal((html.match(/id="fn-\d+"/g) || []).length, 1);
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

test("prepareLessonMarkdown strips HTML comments and bare CLAIMS (agent evidence)", () => {
  const source = `# Cookie door

Remember the hop.

<!-- note: agent only -->

<!-- CLAIMS:
1. "Browser enters via /bff/*" - app/routes.ts:8 - support: yes - state: observed
2. "Origin fail-closed" - app/core/api/bff-proxy/origin.server.ts:7 - support: yes - state: observed
-->

\`\`\`html
<!-- keep this fence comment -->
\`\`\`

CLAIMS:

1. "Bare claim stays agent-only" - billing/capture.js:6 - support: yes - state: observed
`;
  const prepared = prepareLessonMarkdown(source);
  assert.match(prepared.body, /Remember the hop/);
  assert.match(prepared.body, /keep this fence comment/);
  assert.doesNotMatch(prepared.body, /CLAIMS/);
  assert.doesNotMatch(prepared.body, /Browser enters via/);
  assert.doesNotMatch(prepared.body, /agent only/);
  assert.doesNotMatch(prepared.body, /Bare claim stays/);

  const page = renderLesson({
    workbookTitle: "WB",
    sidebar: {
      chapters: [
        {
          title: "Core",
          items: [{ lessonKey: "lessons/cookie.md", title: "Cookie door" }],
        },
      ],
      counts: { done: 0, written: 1, planned: 0 },
    },
    title: prepared.title,
    bodyHtml: renderMarkdown(prepared.body),
    lessonKey: "lessons/cookie.md",
    completed: false,
    progress: {},
    prev: null,
    next: null,
  });
  assert.match(page, /Remember the hop/);
  assert.match(page, /keep this fence comment/);
  assert.doesNotMatch(page, /CLAIMS|Browser enters via|Bare claim stays|agent only/);
  // Fence comments may render as escaped code; agent HTML comments must not.
  assert.doesNotMatch(page, /note: agent only/);
});
