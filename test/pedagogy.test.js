import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { evaluatePedagogy } from "../scripts/lib/pedagogy.js";

test("evaluatePedagogy requires causal mental models and challenges with rubrics", () => {
  const badLesson = "This is a component. It has code. Challenge: read it.";
  const badResult = evaluatePedagogy(badLesson);
  
  assert.equal(badResult.ok, false);
  assert.ok(badResult.errors.some(e => e.includes("causal")));
  assert.ok(badResult.errors.some(e => e.includes("rubric")));
  
  const goodLesson = `
  Motivation: It's important because it saves time.
  It triggers an event so that the UI updates.
  Warning: A common mistake is forgetting to bind.
  Challenge: Modify the code to add a button.
  Rubric: The button should be green.
  `;
  const goodResult = evaluatePedagogy(goodLesson);
  assert.equal(goodResult.ok, true);
});

test("evaluatePedagogy flags high cognitive load", () => {
  const codeHeavy = "Words.\n```js\nvar a=1;\n```\n```js\nvar b=2;\n```\n```js\nvar c=3;\n```\n```js\nvar d=4;\n```\n```js\nvar e=5;\n```\n```js\nvar f=6;\n```\nChallenge: modify this.\nRubric: check it.\nIt causes things.";
  const result = evaluatePedagogy(codeHeavy);
  
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes("cognitive load")));
});
