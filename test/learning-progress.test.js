import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { recordExercise, getExercises, deleteExercises, scheduleReview, getPendingReviews } from "../scripts/lib/learning-progress.js";

test("recordExercise stores answers or discards them in sessionOnly mode", () => {
  const resultSession = recordExercise("topic-1", "tracing", "my answer", true);
  assert.equal(resultSession.stored, false);
  assert.equal(getExercises("topic-1").length, 0);
  
  const resultDurable = recordExercise("topic-1", "modification", "new code", false);
  assert.equal(resultDurable.stored, true);
  assert.equal(getExercises("topic-1").length, 1);
  assert.equal(getExercises("topic-1")[0].type, "modification");
});

test("deleteExercises removes private data independently of lessons", () => {
  recordExercise("topic-2", "prediction", "guess", false);
  assert.equal(getExercises("topic-2").length, 1);
  
  deleteExercises("topic-2");
  assert.equal(getExercises("topic-2").length, 0);
});

test("scheduleReview schedules optional review prompts", () => {
  // schedule for -1 days to make it due immediately
  scheduleReview("topic-3", -1); 
  const due = getPendingReviews();
  assert.ok(due.some(r => r.topicId === "topic-3"));
});
