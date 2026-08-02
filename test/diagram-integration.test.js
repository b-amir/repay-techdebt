// @category C4
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { inspectLesson } from "../src/lessons/lesson-quality.js";

test("inspectLesson enforces diagram constraints", () => {
  const badPie = `
## Section 1
\`\`\`mermaid
pie title Pets
  "Dogs" : 386
\`\`\`
**What this shows:** A pie.
  `;
  const pieResult = inspectLesson(badPie, { depth: "concise" });
  assert.ok(pieResult.errors.some((e) => e.includes("prohibited experimental Mermaid type")));

  const noAcc = `
## Section 1
\`\`\`mermaid
flowchart TD
  A-->B
\`\`\`
**What this shows:** Something.
  `;
  const noAccResult = inspectLesson(noAcc, { depth: "concise" });
  assert.ok(noAccResult.errors.some((e) => e.includes("missing accTitle")));
  assert.ok(noAccResult.errors.some((e) => e.includes("missing accDescr")));

  const missingTakeaway = `
## Section 1
\`\`\`mermaid
flowchart TD
  accTitle: Title
  accDescr: Descr
  A-->B
\`\`\`
  `;
  const mtResult = inspectLesson(missingTakeaway, { depth: "concise" });
  assert.ok(mtResult.errors.some((e) => e.includes("**What this shows:**")));

  const sidecar = `
## Section 1
![Diagram](./diagram.svg)
  `;
  const sidecarResult = inspectLesson(sidecar, { depth: "concise" });
  assert.ok(sidecarResult.errors.some((e) => e.includes("external image or diagram sidecars")));
});
