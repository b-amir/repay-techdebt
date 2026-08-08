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
      `${index + 1}. "export function helper${index} exists" — src/helper${index}.ts:1 — support: yes`,
  ).join("\n");
  const markdown = `# Helpers

This opening explains the helper surface because callers otherwise change an export without checking the behavior.

## Walk the path in code
Read src/helper0.ts:1 and src/helper1.ts:1 before changing the public surface.

## The pitfall people miss
The wrong model treats an exported name as proof of behavior.

## Check yourself
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
  const markdown = `# Claim

This opening has enough words because a malformed claim must not bypass explicit faithfulness checks.

## Walk the path in code
Read src/a.ts:1 and src/b.ts:1.

## The pitfall people miss
Malformed syntax hides declared support.

## Check yourself
Change src/a.ts and run its test.

CLAIMS:
1. "a exists" - src/a.ts:1 - support: yes
${"Supporting prose explains the consequence because explicit claims are part of the durable evidence contract. ".repeat(30)}`;
  const result = inspectLesson(markdown, { depth: "concise" });
  assert.ok(result.errors.some((error) => /malformed CLAIMS/i.test(error)));
});
