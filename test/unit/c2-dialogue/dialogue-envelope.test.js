// @category C2
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  buildDialogueEnvelope,
  CLOSED_NEXT_ASK_DOS,
  topicSignalClass,
} from "../../../src/dialogue/dialogue-envelope.js";

test("dialogue envelope marks partial coverage as must-not-claim whole-app absence", () => {
  const envelope = buildDialogueEnvelope({
    role: "propose",
    coverage: { status: "partial", truncated: true, modeledFiles: 10 },
    unresolved: ["Purpose and business criticality are inferred until confirmed."],
    mode: "workbook",
  });
  assert.equal(envelope.role, "propose");
  assert.equal(envelope.flowState, "setup");
  assert.equal(envelope.coverageStatus, "partial");
  assert.ok(envelope.mustNotClaim.includes("whole-application-absence"));
  assert.ok(envelope.mustNotClaim.includes("approved-workbook-index"));
  assert.ok(envelope.mustNotClaim.includes("soft-escape-continue-weaker"));
  assert.equal(envelope.overclaimPolicy, "unsupported-shrink-or-refuse");
  assert.ok(envelope.nextAsks.some((item) => item.do === "confirm-purpose"));
  assert.ok(envelope.nextAsks.some((item) => item.do === "approve-curriculum-shortlist"));
  assert.ok(envelope.nextAsks.some((item) => item.do === "accept-partial-scope-or-narrow"));
  assert.ok(envelope.nextAsks.some((item) => item.do === "unsupported-shrink-or-refuse"));
});

test("dialogue emission always teaches hard overclaim (no soft escape)", () => {
  const envelope = buildDialogueEnvelope({ role: "check" });
  assert.equal(envelope.overclaimPolicy, "unsupported-shrink-or-refuse");
  assert.ok(envelope.mustNotClaim.includes("soft-escape-continue-weaker"));
  assert.ok(envelope.nextAsks.some((a) => a.do === "unsupported-shrink-or-refuse"));
  assert.doesNotMatch(JSON.stringify(envelope), /continue weaker/i);
});

test("CLOSED_NEXT_ASK_DOS is frozen closed set used by envelope", () => {
  assert.ok(Object.isFrozen(CLOSED_NEXT_ASK_DOS));
  const expected = new Set([
    "confirm-purpose",
    "plan-analysis",
    "pick-retrieve-questions",
    "approve-curriculum-shortlist",
    "accept-partial-scope-or-narrow",
    "graphify-or-serena-retrieve",
    "unsupported-shrink-or-refuse",
  ]);
  assert.deepEqual(new Set(CLOSED_NEXT_ASK_DOS), expected);

  const envelope = buildDialogueEnvelope({
    role: "propose",
    mode: "focused",
    extraNextAsks: [
      {
        who: "tool",
        do: "graphify-or-serena-retrieve",
        why: "preferred-before-heuristic-fallback",
      },
    ],
  });
  for (const item of envelope.nextAsks) {
    assert.ok(expected.has(item.do), `unexpected nextAsks.do: ${item.do}`);
  }

  assert.throws(
    () =>
      buildDialogueEnvelope({
        role: "check",
        extraNextAsks: [{ who: "agent", do: "invent-new-product-path", why: "nope" }],
      }),
    /not in CLOSED_NEXT_ASK_DOS/,
  );
});

test("topicSignalClass distinguishes user workflows from naming heuristics", () => {
  assert.equal(
    topicSignalClass({
      kind: "workflow",
      reasons: ["Marked as a critical workflow by project configuration"],
    }),
    "user",
  );
  assert.equal(topicSignalClass({ kind: "area", relationCount: 0 }), "naming-heuristic");
  assert.equal(topicSignalClass({ kind: "entry", relationCount: 3 }), "ast");
});
