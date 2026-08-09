// @category C4
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  inspectHeadingVariety,
  isPathDerivedTitle,
  isPlannerBoilerplateReason,
  isStampedHeading,
} from "../../../src/lessons/heading-variety.js";
import { inspectLesson } from "../../../src/lessons/lesson-quality.js";
import { inspectLearningMoments } from "../../../src/lessons/learning-moments.js";

test("stamped role-label headings are rejected", () => {
  for (const heading of [
    "The Mechanism",
    "Pitfall",
    "Try It",
    "Invariant",
    "Walk the path in code",
    "Check yourself",
    "Change it safely",
  ]) {
    assert.equal(isStampedHeading(heading), true, heading);
  }
  assert.equal(isStampedHeading("Why the browser never sees Authorization"), false);
  assert.equal(isStampedHeading("Prove the boundary before adding an endpoint"), false);
});

test("path-derived titles are rejected", () => {
  assert.equal(isPathDerivedTitle("Core Api Http Client Ts", "app/core/api/http-client.ts"), true);
  assert.equal(
    isPathDerivedTitle("Instrumentation Server Mjs", "instrumentation-server.mjs"),
    true,
  );
  assert.equal(
    isPathDerivedTitle("Every Browser Request Enters Through /bff", "app/core/api/http-client.ts"),
    false,
  );
});

test("path-derived title with multi-segment focus still fails", () => {
  assert.equal(isPathDerivedTitle("Core Query Client Ts", "app/core/query/query-client.ts"), true);
});

test("planner boilerplate learning-moment reasons are rejected", () => {
  assert.equal(
    isPlannerBoilerplateReason(
      "Distinguish the verified path from a plausible shortcut or wrong model.",
    ),
    true,
  );
  assert.equal(
    isPlannerBoilerplateReason(
      "distinguish the shared BFF client from a raw browser request that skips cookie handoff",
    ),
    false,
  );
});

test("inspectHeadingVariety blocks the Antigravity outline", () => {
  const result = inspectHeadingVariety(["The Mechanism", "Pitfall", "Try It", "Invariant"], {
    title: "Core Api Http Client Ts",
    focus: "app/core/api/http-client.ts",
    sectionRoles: {
      workedPath: "The Mechanism",
      pitfall: "Pitfall",
      check: "Try It",
    },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /stamped role-label/i.test(error)));
  assert.ok(result.errors.some((error) => /path basename/i.test(error)));
});

test("inspectLesson rejects Mechanism/Pitfall/Try It lessons", () => {
  const markdown = `---
title: "Core Api Http Client Ts"
focus: "app/core/api/http-client.ts"
sectionRoles:
  workedPath: The Mechanism
  pitfall: Pitfall
  check: Try It
learningMoments:
  quickCheck: included - Distinguish the verified path from a plausible shortcut or wrong model.
  thinkFirst: omitted - The mechanism is straightforward and does not benefit from a predictive question.
  seeForYourself: included - Turn a safe browser-observable behavior into a guided DevTools variation with a reset.
---

# Core Api Http Client Ts

The HTTP client configures ky for same-origin BFF traffic so the browser never holds tokens.

## The Mechanism

Open \`app/core/api/http-client.ts:10\` and read the prefixUrl. Then open \`app/core/logger.ts:28\`.

\`\`\`ts
const baseConfig = { prefixUrl: "/bff" };
\`\`\`

## Pitfall

A bearer header in the browser is the wrong model because tokens must stay HttpOnly.

## Try It

Modify \`app/core/api/http-client.ts\` and predict the redirect after a 401.

## Invariant

Do not attach bearer tokens in the browser.
`;
  const quality = inspectLesson(markdown, {
    depth: "concise",
    requireLearningMomentDecisions: true,
  });
  assert.equal(quality.ok, false);
  assert.ok(
    quality.errors.some((error) => /stamped role-label|path basename|boilerplate/i.test(error)),
  );

  const moments = inspectLearningMoments(markdown, {
    depth: "concise",
    requireDecisions: true,
  });
  assert.equal(moments.ok, false);
  assert.ok(moments.errors.some((error) => /boilerplate/i.test(error)));
});

test("topic-specific headings still pass", () => {
  const markdown = `---
title: Every Browser Request Enters Through /bff
focus: app/core/api/http-client.ts
subject: code-mechanics
primaryPaths:
  - app/core/api/http-client.ts
  - app/core/logger.ts
sectionRoles:
  workedPath: The prefix decides which server sees the call
  pitfall: What breaks when a feature finds another door
  check: Prove the boundary before adding an endpoint
skipReasons:
  map: Single client boundary; the worked path is enough.
learningMoments:
  quickCheck: omitted - the contrast section already separates the shared client from a raw fetch
  thinkFirst: omitted - the worked path already pauses on the prefix decision
  seeForYourself: omitted - this fixture has no browser runtime
---

# Every Browser Request Enters Through /bff

Browser calls must use the shared client so the Node BFF can swap the cookie for a bearer. If a feature invents another door, auth and logging both drift.

## The prefix decides which server sees the call

Open \`app/core/api/http-client.ts:10\` and follow \`prefixUrl\` into the BFF. Then check \`app/core/logger.ts:28\` for the shared api logger because that is where failed handoffs become visible.

\`\`\`ts
prefixUrl: \`\${window.location.origin}/bff\`
\`\`\`

## What breaks when a feature finds another door

A raw \`/api\` fetch skips cookie-to-bearer conversion, so the backend sees an unauthenticated call while the UI still looks logged in.

## Prove the boundary before adding an endpoint

Modify \`app/core/api/http-client.ts\` on paper to point at \`/api\`, predict the auth failure, and name the network assertion that would catch it.
`;
  const quality = inspectLesson(markdown, {
    depth: "concise",
    requireLearningMomentDecisions: true,
  });
  assert.equal(quality.ok, true, quality.errors.join("; "));
});
