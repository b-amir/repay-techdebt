// @category C4
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { composeMermaidBlock } from "../../../src/lessons/lesson-composition.js";

test("composeMermaidBlock handles none gracefully", () => {
  const result = composeMermaidBlock({ type: "none" });
  assert.equal(result, "");
});

test("composeMermaidBlock generates valid sequence diagram with accessibility tags", () => {
  const intent = {
    type: "sequence",
    teachingQuestion: "Order of ops?",
    reason: "Because async",
    nodes: [
      { id: "user", label: "User" },
      { id: "system", label: "System" },
    ],
    edges: [{ from: "user", to: "system", label: "submits" }],
  };

  const result = composeMermaidBlock(intent);
  assert.match(result, /```mermaid/);
  assert.match(result, /sequenceDiagram/);
  assert.match(result, /accTitle: Order of ops\?/);
  assert.match(result, /accDescr: Because async/);
  assert.match(result, /\*\*What this shows:\*\* Because async/);
});

test("composeMermaidBlock generates valid flowchart with accessibility tags", () => {
  const intent = {
    type: "flowchart",
    teachingQuestion: "Ownership?",
    reason: "Shows trust",
    nodes: [
      { id: "client", label: "Client" },
      { id: "server", label: "Server" },
    ],
    edges: [{ from: "client", to: "server", label: "calls" }],
  };

  const result = composeMermaidBlock(intent);
  assert.match(result, /```mermaid/);
  assert.match(result, /flowchart TD/);
  assert.match(result, /accTitle: Ownership\?/);
  assert.match(result, /accDescr: Shows trust/);
});
