import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { selectDiagramType } from "../scripts/lib/diagram-selection.js";

test("selectDiagramType rejects overly dense diagrams", () => {
  const topic = { chapter: "boundaries" };
  const packet = {
    callers: new Array(15).fill("a"),
    dependencies: new Array(10).fill("b"),
    stateEffects: []
  };

  const intent = selectDiagramType(topic, packet);
  assert.equal(intent.type, "none");
  assert.match(intent.reason, /too dense/i);
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
});
