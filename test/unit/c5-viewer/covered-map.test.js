// @category C5
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { buildCoveredMapChips, renderHome } from "../../../src/viewer/shell.js";

function sampleSidebar() {
  return {
    counts: { done: 1, written: 2, planned: 1 },
    total: 3,
    chapters: [
      {
        id: "ch1",
        title: "Core",
        items: [
          {
            id: "t1",
            title: "Capture path",
            state: "done",
            lessonKey: "lessons/capture.md",
          },
          {
            id: "t2",
            title: "Settle path",
            state: "written",
            lessonKey: "lessons/settle.md",
            why: "Next handoff after capture",
          },
          {
            id: "refund-edge",
            title: "Refund edge",
            state: "planned",
            learnerOutcome: "Trace refund after settle",
          },
        ],
      },
    ],
  };
}

test("covered-map chips: done / next why / evidence", () => {
  const sidebar = sampleSidebar();
  const items = {
    written: sidebar.chapters[0].items.filter((i) => i.state === "done" || i.state === "written"),
    planned: sidebar.chapters[0].items.filter((i) => i.state === "planned"),
  };
  const chips = buildCoveredMapChips(sidebar, { lastRead: "lessons/settle.md" }, items);
  assert.deepEqual(chips.done, ["Capture path"]);
  assert.equal(chips.nextTitle, "Settle path");
  assert.match(chips.nextWhy, /handoff|Continue/i);
  assert.match(chips.evidenceState, /1\/2/);
});

test("renderHome includes primary continue + compact stats", () => {
  const sidebar = sampleSidebar();
  const html = renderHome({
    workbookTitle: "Demo workbook",
    sidebar,
    progress: { lastRead: "lessons/settle.md", completed: {} },
  });
  assert.match(html, /ds-home-primary/);
  assert.match(html, /ds-home-stats/);
  assert.match(html, /Continue/);
  assert.match(html, /Settle path/);
  assert.doesNotMatch(html, /ds-covered-map|ds-home-continue|ds-home-next|Next why/);
  assert.doesNotMatch(html, /spaced.?repetition|stale-mark|LMS/i);
});
