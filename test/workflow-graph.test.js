// @category C1
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { buildWorkflowGraph } from "../src/program/workflow-graph.js";

test("buildWorkflowGraph detects unresolved hops", () => {
  const model = {
    nodes: [{ id: "1", kind: "route", name: "GET /api" }],
    edges: [],
  };

  const graph = buildWorkflowGraph(model, ["1"]);
  assert.equal(graph.isCompleteTrace, false);
  assert.equal(graph.unresolvedHops.length, 1);
  assert.equal(graph.unresolvedHops[0].nodeId, "1");
});

test("buildWorkflowGraph identifies complete end-to-end trace", () => {
  const model = {
    nodes: [
      { id: "1", kind: "route", name: "GET /api" },
      { id: "2", kind: "function", name: "handler" },
      { id: "3", kind: "data-store", name: "db" },
    ],
    edges: [
      { id: "e1", kind: "calls", from: "1", to: "2", confidence: 1 },
      { id: "e2", kind: "writes", from: "2", to: "3", confidence: 1 },
    ],
  };

  const graph = buildWorkflowGraph(model, ["1"]);
  assert.equal(graph.isCompleteTrace, true);
  assert.equal(graph.unresolvedHops.length, 0);
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.edges[0].inferred, false); // Confidence is 1
});

test("buildWorkflowGraph represents cycles", () => {
  const model = {
    nodes: [
      { id: "1", kind: "function", name: "a" },
      { id: "2", kind: "function", name: "b" },
    ],
    edges: [
      { id: "e1", kind: "calls", from: "1", to: "2", confidence: 1 },
      { id: "e2", kind: "calls", from: "2", to: "1", confidence: 1 },
    ],
  };

  const graph = buildWorkflowGraph(model, ["1"]);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 2);
});
