// @category C2
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  buildDialogueEnvelope,
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
  assert.ok(envelope.nextAsks.some((item) => item.do === "confirm-purpose"));
  assert.ok(envelope.nextAsks.some((item) => item.do === "approve-curriculum-shortlist"));
  assert.ok(envelope.nextAsks.some((item) => item.do === "accept-partial-scope-or-narrow"));
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
