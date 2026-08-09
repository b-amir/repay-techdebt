// @category C4
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { buildLessonSpecification } from "../../../src/lessons/lesson-specification.js";
import { evaluateSpecification, inspectLesson } from "../../../src/lessons/lesson-quality.js";

test("buildLessonSpecification produces a structured spec", () => {
  const topic = {
    id: "1",
    learnerOutcome: "Learn about DB auth",
    focus: "db.js",
  };
  const packet = {
    callers: ["auth.js"],
    dependencies: ["mysql2"],
  };

  const spec = buildLessonSpecification(topic, packet);
  assert.equal(spec.outcome, "Learn about DB auth");
  assert.ok(spec.requiredClaims.some((c) => c.claim.includes("auth.js")));
  assert.ok(spec.requiredClaims.some((c) => c.claim.includes("mysql2")));
  assert.ok(spec.prohibitedClaims.length > 0);
  assert.ok(spec.challenge);
});

test("evaluateSpecification detects missing required claims", () => {
  const spec = {
    requiredClaims: [{ claim: "Explains dependency on mysql2", expectedAnchor: "mysql2" }],
  };
  const markdown = "This lesson covers the auth module but forgets the DB.";
  const result = evaluateSpecification(markdown, spec);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("Missing required claim")));
});

test("evaluateSpecification passes when claims and challenge are present", () => {
  const spec = {
    requiredClaims: [{ claim: "Explains dependency on mysql2", expectedAnchor: "mysql2" }],
  };
  const markdown = "This lesson explains dependency on mysql2. Now for the challenge: build it.";
  const result = evaluateSpecification(markdown, spec);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test("lesson quality warns on empty-form craft proxies", () => {
  const claims = Array.from(
    { length: 6 },
    (_, index) =>
      `${index + 1}. "export function helper${index} exists" - src/helper${index}.ts:1 - support: yes`,
  ).join("\n");
  const markdown = `---
sectionRoles:
  workedPath: Open the helper surface
  pitfall: Exports are not behavior
  check: Name the exported symbol
---
# Helpers

This opening explains the helper surface because callers otherwise change an export without checking the behavior.

## Open the helper surface
Read src/helper0.ts:1 and src/helper1.ts:1 before changing the public surface.

## Exports are not behavior
The wrong model treats an exported name as proof of behavior.

## Name the exported symbol
In src/helper0.ts, what is the exported symbol called?

CLAIMS:
${claims}
${"Enough concrete explanation keeps length from hiding the craft warnings during this focused assertion. ".repeat(30)}`;
  const result = inspectLesson(markdown, { depth: "concise" });
  assert.ok(result.warnings.some((warning) => /non-Mermaid fenced code/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /recall-only/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /6 parsed CLAIMS/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /existence\/export-shaped/i.test(warning)));
});

test("malformed visible CLAIMS are quality errors instead of auto-mode escape", () => {
  const markdown = `---
sectionRoles:
  workedPath: Read the claim anchors
  pitfall: Malformed claims hide support
  check: Fix the claim line and re-run
---
# Claim

This opening has enough words because a malformed claim must not bypass explicit faithfulness checks.

## Read the claim anchors
Read src/a.ts:1 and src/b.ts:1.

## Malformed claims hide support
Malformed syntax hides declared support.

## Fix the claim line and re-run
Change src/a.ts and run its test.

CLAIMS:
1. "a exists" | src/a.ts:1 | support: yes
${"Supporting prose explains the consequence because explicit claims are part of the durable evidence contract. ".repeat(30)}`;
  const result = inspectLesson(markdown, { depth: "concise" });
  assert.ok(result.errors.some((error) => /malformed CLAIMS/i.test(error)));
});

test("lesson quality rejects generic openings and flags oversized support material", () => {
  const longCode = Array.from({ length: 41 }, (_, index) => `const value${index} = ${index};`).join(
    "\n",
  );
  const markdown = `---
sectionRoles:
  workedPath: Trace the request
  pitfall: What breaks without the guard
  check: Verify the boundary
---
# Guard behavior

In this lesson we will explore the guard and discuss how it works for the application.

## Trace the request
Open src/guard.ts:1 and src/route.ts:1 because the route calls the guard before mutation.

\`\`\`ts
${longCode}
\`\`\`

## What breaks without the guard
Removing the guard lets the mutation run with an unchecked request.

## Verify the boundary
Change src/guard.ts and run the route test to observe the rejected request.

${"Concrete supporting prose keeps the fixture inside the concise depth while preserving one subject. ".repeat(25)}`;
  const result = inspectLesson(markdown, { depth: "concise" });
  assert.ok(result.errors.some((error) => /generic opening/i.test(error)));
  assert.ok(result.warnings.some((warning) => /exceed 40 lines/i.test(warning)));
});

test("lesson quality validates optional interactive learning blocks when authors use them", () => {
  const markdown = `---
sectionRoles:
  workedPath: Trace the request
  pitfall: Inspect it in the browser
  check: Verify the boundary
---
# Guard behavior

You can trace the guard because direct navigation reaches the loader before any protected UI renders.

## Trace the request
Read src/guard.ts:1 and src/route.ts:1 because the route calls the guard before mutation.

> **Quick check:** Which boundary can reject direct navigation first?
>
> - [x] The route loader
> - [x] The component gate

## Inspect it in the browser
> **See for yourself:** Watch the redirect happen.
>
> Open DevTools and request the protected route.
> Disable the auth guard in production and reload.

## Verify the boundary
Change src/guard.ts and run the route test to observe the rejected request.

${"Concrete supporting prose keeps this focused fixture within its depth range because interactive checks supplement the explanation. ".repeat(28)}`;
  const result = inspectLesson(markdown, { depth: "concise" });
  assert.ok(result.errors.some((error) => /exactly one.*correct answer/i.test(error)));
  assert.ok(result.errors.some((error) => /Why\/Explanation/i.test(error)));
  assert.ok(result.warnings.some((warning) => /ordered DevTools steps/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /Change one thing/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /Look for/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /under Reset/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /safe execution context/i.test(warning)));
  assert.ok(result.errors.some((error) => /unsafe action/i.test(error)));
});

test("lesson quality accepts a well-formed optional self-check", () => {
  const markdown = `---
sectionRoles:
  workedPath: Trace the request
  pitfall: Inspect the failure
  check: Verify the boundary
---
# Guard behavior

You can trace the guard because direct navigation reaches the loader before protected UI renders.

## Trace the request
Read src/guard.ts:1 and src/route.ts:1 because the route calls the guard before mutation.

> **Quick check:** Which boundary can reject direct navigation first?
>
> - [x] The route loader
> - [ ] The component gate
>
> **Why:** The loader runs before rendering, so it can redirect before protected UI exists.

## Inspect the failure
Removing the loader guard lets direct navigation reach a protected component.

> **See for yourself:** Observe the loader redirect in local development.
>
> 1. Open Network and load the protected route.
> 2. Inspect the document response status.
>
> **Change one thing:** Clear the local session cookie and reload.
>
> **Look for:** The document redirects before component requests appear.
>
> **Reset:** Sign in again to restore the session.

## Verify the boundary
Change src/guard.ts and run the route test to observe the rejected request.

${"Concrete supporting prose keeps this focused fixture within its depth range because the valid self-check supplements the causal explanation. ".repeat(25)}`;
  const result = inspectLesson(markdown, { depth: "concise" });
  assert.ok(!result.errors.some((error) => /Quick check/i.test(error)));
  assert.ok(!result.errors.some((error) => /See for yourself/i.test(error)));
  assert.ok(!result.warnings.some((warning) => /See for yourself/i.test(warning)));
});
