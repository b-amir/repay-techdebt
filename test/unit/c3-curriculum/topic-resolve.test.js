// @category C3
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { resolveTopicSelector } from "../../../src/curriculum/topic-resolve.js";

const curriculum = {
  topics: [
    {
      id: "topic-abc123def456",
      title: "Request boundary",
      focus: "admin-route-permission",
      lessonPath: null,
    },
    {
      id: "topic-999888777666",
      title: "State management",
      focus: "redux-store",
      lessonPath: "lessons/state.md",
    },
  ],
};

test("resolveTopicSelector matches exact id", () => {
  const topic = resolveTopicSelector(curriculum, "topic-abc123def456");
  assert.equal(topic?.id, "topic-abc123def456");
});

test("resolveTopicSelector matches title slug", () => {
  const topic = resolveTopicSelector(curriculum, "request-boundary");
  assert.equal(topic?.id, "topic-abc123def456");
});

test("resolveTopicSelector matches focus", () => {
  const topic = resolveTopicSelector(curriculum, "admin-route-permission");
  assert.equal(topic?.id, "topic-abc123def456");
});
