// @category C3
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { isWeakCurriculumTitle } from "../../../src/curriculum/title-quality.js";
import { titleFor } from "../../../src/curriculum/curriculum-planning.js";
import { inspectLesson } from "../../../src/lessons/lesson-quality.js";

test("weak curriculum titles include path basenames and planner placeholders", () => {
  const focus = "app/core/query/client.ts";
  assert.equal(isWeakCurriculumTitle("Core Query Client Ts", focus, "entry"), true);
  assert.equal(isWeakCurriculumTitle(titleFor("entry", focus), focus, "entry"), true);
  assert.equal(
    isWeakCurriculumTitle("One QueryClient, Shared Failure Policy", focus, "entry"),
    false,
  );
});

test("freeform Goal/Overview recreation packets fail quality", () => {
  const markdown = `# Lesson: Core Query Client Ts

**Date**: 2026-08-09
**Topic ID**: topic-3fdb02d3ecd7
**Focus**: \`app/core/query/client.ts\`

### Goal
Follow how execution enters through Query Client.

### Overview
This file establishes the core QueryClient.

### Summary
The QueryClient is a trust boundary.
`;
  const quality = inspectLesson(markdown, { depth: "concise" });
  assert.equal(quality.ok, false);
  assert.ok(
    quality.errors.some((error) =>
      /freeform brief|path basename|stamped|sectionRoles/i.test(error),
    ),
  );
});
