// @category C4
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { buildEvidencePacket } from "../src/lessons/lesson-evidence.js";

test("buildEvidencePacket respects token budget", () => {
  const topic = {
    id: "1",
    title: "Test",
    learnerOutcome: "Learn",
    chapter: "Core",
    evidencePaths: ["a.js", "b.js", "c.js"],
  };

  const model = {
    nodes: [
      { id: "n1", path: "a.js", name: "A" },
      { id: "n2", path: "b.js", name: "B" },
      { id: "n3", path: "c.js", name: "C" },
    ],
    edges: [],
  };

  // Small budget so only first fits
  const packet = buildEvidencePacket(topic, model, { tokenBudget: 5 });

  assert.equal(packet.excerpts.length, 1);
  assert.equal(packet.excerpts[0].path, "a.js");
  assert.ok(packet.excerpts[0].digest);
  assert.ok(packet.gaps.length > 0);
  assert.match(packet.gaps[0], /token budget/);
});

test("buildEvidencePacket extracts callers and dependencies", () => {
  const topic = {
    id: "1",
    title: "Auth",
    learnerOutcome: "Auth",
    chapter: "Security",
    evidencePaths: ["auth.js"],
  };

  const model = {
    nodes: [
      { id: "n1", path: "auth.js", name: "auth" },
      { id: "n2", path: "server.js", name: "server" },
      { id: "n3", path: "db.js", name: "db" },
    ],
    edges: [
      { kind: "calls", from: "n2", to: "n1" },
      { kind: "imports", from: "n1", to: "n3" },
    ],
  };

  const packet = buildEvidencePacket(topic, model);

  assert.deepEqual(packet.callers, ["n2"]);
  assert.deepEqual(packet.dependencies, ["n3"]);
});
