// @category C4
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  inspectLearningMoments,
  planLearningMoments,
} from "../../../src/lessons/learning-moments.js";

const flowSections = [
  { id: "entry-to-effect" },
  { id: "mechanism" },
  { id: "failure-path" },
  { id: "verification" },
];

const signals = [
  {
    id: "ui",
    strength: "strong",
    focusRelated: true,
    evidenceIds: ["ui-route"],
  },
  {
    id: "relationships",
    strength: "strong",
    focusRelated: true,
    evidenceIds: ["route-to-handler"],
  },
  {
    id: "testing",
    strength: "strong",
    focusRelated: true,
    evidenceIds: ["proxy-test"],
  },
];

test("browser flow plans the strongest misconception and DevTools opportunities", () => {
  const plan = planLearningMoments({
    shapeId: "end-to-end-flow",
    depth: "balanced",
    sections: flowSections,
    signals,
    hasFocusEvidence: true,
    browserCapable: true,
  });

  assert.equal(plan.maximum, 3);
  assert.equal(plan.opportunities.length, 3);
  assert.equal(
    plan.opportunities.find((item) => item.kind === "quick-check").decision,
    "recommended",
  );
  assert.equal(
    plan.opportunities.find((item) => item.kind === "see-for-yourself").decision,
    "recommended",
  );
  assert.equal(
    plan.opportunities.find((item) => item.kind === "think-first").decision,
    "candidate",
  );
});

test("missing focus evidence omits all planned widgets instead of manufacturing exercises", () => {
  const plan = planLearningMoments({
    shapeId: "end-to-end-flow",
    depth: "deep",
    sections: flowSections,
    signals,
    hasFocusEvidence: false,
    browserCapable: true,
  });

  assert.ok(plan.opportunities.every((item) => item.decision === "omit"));
});

test("project-wide browser capability does not recommend DevTools for an unrelated focus", () => {
  const unrelatedSignals = signals.map((signal) =>
    signal.id === "ui" ? { ...signal, focusRelated: false } : signal,
  );
  const plan = planLearningMoments({
    shapeId: "end-to-end-flow",
    depth: "balanced",
    sections: flowSections,
    signals: unrelatedSignals,
    hasFocusEvidence: true,
    browserCapable: true,
  });

  assert.equal(
    plan.opportunities.find((item) => item.kind === "see-for-yourself").decision,
    "omit",
  );
});

const bffStyleLesson = `---
sectionRoles:
  workedPath: Follow the request
  pitfall: What breaks when a feature finds another door
  check: Prove the boundary in the browser
---

# Browser requests use the BFF

## Follow the request

When the browser calls the shared client, the route injects the bearer before the backend request.

> **Prediction:** What happens if the prefix changes?
>
> **Reveal:** The request no longer reaches the bearer-injection route.

## What breaks when a feature finds another door

| Shortcut | Lost contract |
| --- | --- |
| Raw fetch | Cookie-to-bearer handoff |
| Shared client | Nothing; this is the verified path |

## Prove the boundary in the browser

Open the browser Network panel and verify the request URL begins with /bff before adding an endpoint.
`;

test("detects missed Quick check and See for yourself opportunities in a BFF-style lesson", () => {
  const result = inspectLearningMoments(bffStyleLesson, { depth: "balanced" });

  assert.equal(result.opportunities.quickCheck, true);
  assert.equal(result.opportunities.seeForYourself, true);
  assert.equal(result.present.thinkFirst, 1);
  assert.ok(result.warnings.some((warning) => /Quick check opportunity/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /See for yourself opportunity/i.test(warning)));
});

test("durable-save mode requires an explicit decision for every optional learning moment", () => {
  const result = inspectLearningMoments(bffStyleLesson, {
    depth: "balanced",
    requireDecisions: true,
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /Declare learningMoments decisions/i.test(error)));
  assert.equal(result.errors.length, 1);
});

test("decision ledger must match included blocks and use specific reasons", () => {
  const lesson = `---
learningMoments:
  quickCheck: included - distinguish the shared BFF client from a raw browser request
  thinkFirst: omitted - the causal prediction is already resolved by the worked trace
  seeForYourself: included - inspect the safe local request URL and response status
---

> **Quick check:** Which path preserves the boundary?
>
> - [x] The shared client
> - [ ] A raw backend fetch
>
> **Why:** The shared client reaches the server handoff.

> **See for yourself:** Observe the request in local development.
>
> 1. Open Network and load the page.
>
> **Change one thing:** Sign out and reload.
>
> **Look for:** The request returns 401.
>
> **Reset:** Sign in again.
`;
  const result = inspectLearningMoments(lesson, { requireDecisions: true });

  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.present.quickCheck, 1);
  assert.equal(result.present.thinkFirst, 0);
  assert.equal(result.present.seeForYourself, 1);
});

test("declaring an included moment without its block fails consistency", () => {
  const lesson = `---
learningMoments:
  quickCheck: included - distinguish two plausible request boundaries before the explanation
  thinkFirst: omitted - the worked trace already asks and resolves the causal question
  seeForYourself: omitted - this command-line subject has no safe browser observation
---

No interactive block is present.
`;
  const result = inspectLearningMoments(lesson, { requireDecisions: true });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /Quick check block is missing/i.test(error)));
});
