// @category C3
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { rankCandidate } from "../../../src/curriculum/curriculum-ranking.js";

test("rankCandidate boosts workflows and entries", () => {
  const candidate = { kind: "workflow", focus: "checkout" };
  const result = rankCandidate(candidate);

  assert.ok(result.score > 50);
  assert.ok(result.features.positive.some((p) => p.feature === "critical-workflow"));
});

test("rankCandidate penalizes generated and test code", () => {
  const candidate = { kind: "file", focus: "generated/api.js" };
  const result = rankCandidate(candidate);

  assert.ok(result.score < 50);
  assert.ok(result.features.negative.some((n) => n.feature === "generated-code"));
});

test("rankCandidate applies centrality and trust bonuses", () => {
  const candidate = { kind: "file", focus: "auth.js", relationCount: 5 };
  const result = rankCandidate(candidate);

  assert.ok(result.score > 50);
  assert.ok(result.features.positive.some((p) => p.feature === "trust-boundary"));
  assert.ok(result.features.positive.some((p) => p.feature === "graph-centrality"));
});

test("rankCandidate bounds scores between 1 and 100", () => {
  const candidate = { kind: "workflow", focus: "auth", relationCount: 100 };
  const result = rankCandidate(candidate);

  assert.equal(result.score, 100);
});

test("rankCandidate makes thin surfaces prove strong relationships", () => {
  const thin = rankCandidate({ kind: "module", focus: "app/ui/logo.tsx", relationCount: 1 });
  const connected = rankCandidate({
    kind: "module",
    focus: "app/ui/logo.tsx",
    relationCount: 5,
  });
  assert.ok(thin.score < connected.score);
  assert.ok(
    thin.features.negative.some((penalty) => penalty.feature === "low-information-surface"),
  );
  assert.equal(
    connected.features.negative.some((penalty) => penalty.feature === "low-information-surface"),
    false,
  );
});
