// @category C5
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { renderMarkdown } from "../../../src/viewer/markdown-render.js";

test("renderMarkdown renders GFM tables", () => {
  const html = renderMarkdown(
    "| Case | Result |\n| --- | --- |\n| Mutation same-origin | 403 CSRF rejection |\n",
  );
  assert.match(html, /<table/);
  assert.match(html, /<th>Case<\/th>/);
  assert.match(html, /403 CSRF rejection/);
});

test("renderMarkdown highlights fenced code", () => {
  const html = renderMarkdown("```typescript\nconst x: number = 1;\n```\n");
  assert.match(html, /ds-codeblock/);
  assert.match(html, /hljs/);
  assert.match(html, /TypeScript/);
  assert.match(html, /number/);
});

test("renderMarkdown emits mermaid blocks for client rendering", () => {
  const html = renderMarkdown(
    "```mermaid\nflowchart TD\n  accTitle: Test\n  accDescr: Desc\n  A-->B\n```\n",
  );
  assert.match(html, /ds-mermaid-wrap/);
  assert.match(html, /<pre class="mermaid">/);
  assert.match(html, /flowchart TD/);
  assert.doesNotMatch(html, /ds-codeblock/);
});
