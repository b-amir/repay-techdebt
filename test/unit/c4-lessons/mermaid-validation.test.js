// @category C4
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { validateMermaidSyntax } from "../../../src/lessons/index.js";

test("Mermaid validation parses the stable lesson subset with accessibility fields", async () => {
  const result = await validateMermaidSyntax(`
\`\`\`mermaid
flowchart LR
  accTitle: Request authorization path
  accDescr: The route asks the policy before calling the service.
  Route["Admin route"] -->|"checks"| Policy["Permission policy"]
  Policy -->|"allows"| Service["Admin service"]
\`\`\`
`);

  assert.deepEqual(result, { ok: true, blockCount: 1, errors: [] });
});

test("Mermaid validation blocks malformed diagrams before save", async () => {
  const result = await validateMermaidSyntax(`
\`\`\`mermaid
flowchart LR
  A["Route" --> B["Policy"]
\`\`\`
`);

  assert.equal(result.ok, false);
  assert.equal(result.blockCount, 1);
  assert.match(result.errors[0], /invalid syntax/i);
});
