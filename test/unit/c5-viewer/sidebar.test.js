// @category C5
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { buildSidebar } from "../../../src/viewer/index.js";

test("buildSidebar marks done, written, and planned rows", () => {
  const curriculum = {
    topics: [
      {
        title: "Done lesson",
        chapter: "Recent teaching",
        lessonPath: "lessons/done.md",
        learnerOutcome: "outcome",
      },
      {
        title: "Open lesson",
        chapter: "Recent teaching",
        lessonPath: "lessons/open.md",
        learnerOutcome: "outcome",
      },
      {
        title: "Planned only",
        id: "topic-planned123",
        chapter: "Architecture",
        lessonPath: null,
        learnerOutcome: "outcome",
      },
    ],
  };
  const progress = {
    completed: { "lessons/done.md": { completedAt: "2026-08-02T12:00:00.000Z" } },
  };
  const sidebar = buildSidebar(curriculum, progress, "lessons/open.md");
  assert.equal(sidebar.counts.done, 1);
  assert.equal(sidebar.counts.written, 1);
  assert.equal(sidebar.counts.planned, 1);
  const open = sidebar.chapters
    .flatMap((c) => c.items)
    .find((item) => item.lessonKey === "lessons/open.md");
  assert.equal(open?.current, true);
  assert.equal(open?.state, "written");
});
