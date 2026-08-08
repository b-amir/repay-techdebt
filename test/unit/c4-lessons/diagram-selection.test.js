// @category C4
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { selectDiagramType } from "../../../src/lessons/diagram-selection.js";

test("selectDiagramType reduces an overly dense graph instead of discarding it", () => {
  const topic = { chapter: "boundaries" };
  const nodes = Array.from({ length: 15 }, (_, index) => ({
    id: `n${index}`,
    path: `src/module-${index}.ts`,
  }));
  const packet = {
    nodes,
    edges: nodes.slice(1).map((node, index) => ({
      from: "n0",
      to: node.id,
      kind: "imports",
      evidenceIds: [`e${index}`],
    })),
    focusNodeIds: ["n0"],
  };

  const intent = selectDiagramType(topic, packet);
  assert.equal(intent.type, "flowchart");
  assert.ok(intent.nodes.length <= 8);
  assert.ok(intent.edges.length <= 10);
  assert.match(intent.reason, /reduced/i);
});

test("selectDiagramType selects sequence diagram for workflows", () => {
  const topic = { chapter: "critical workflows" };
  const packet = { callers: ["a"], dependencies: ["b"], stateEffects: [] };

  const intent = selectDiagramType(topic, packet);
  assert.equal(intent.type, "sequence");
  assert.equal(intent.teachingQuestion, "Who talks to whom, and in what order?");
});

test("selectDiagramType returns none for simple isolated nodes", () => {
  const topic = { chapter: "core" };
  const packet = { callers: [], dependencies: [], stateEffects: [] };

  const intent = selectDiagramType(topic, packet);
  assert.equal(intent.type, "none");
  assert.equal(intent.decision, "omit");
});
