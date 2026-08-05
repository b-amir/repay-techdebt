// @category C5
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { renderPlanned, stripClaimsHtml } from "../../../src/viewer/shell.js";

test("renderPlanned shows learning stage in meta line", () => {
  const html = renderPlanned({
    workbookTitle: "frontend workbook",
    sidebar: { chapters: [], counts: { done: 0, written: 0, planned: 1 } },
    topic: {
      id: "topic-abc",
      title: "Follow permissions",
      learnerOutcome: "You will understand access checks.",
      learningStage: "3. applied",
      evidencePaths: [],
    },
    targetRoot: "/Users/dev/frontend",
  });

  assert.match(html, /ds-planned-meta/);
  assert.match(html, /Not written yet · Applied/);
  assert.doesNotMatch(html, /ds-planned-badge/);
});

test("renderPlanned evidence links resolve against target repo root", () => {
  const html = renderPlanned({
    workbookTitle: "frontend workbook",
    sidebar: { chapters: [], counts: { done: 0, written: 0, planned: 1 } },
    topic: {
      id: "topic-abc",
      title: "Follow permissions",
      evidencePaths: ["app/domains/auth/permission-guard.tsx:1"],
    },
    targetRoot: "/Users/dev/frontend",
  });

  assert.match(
    html,
    /vscode:\/\/file\/\/Users\/dev\/frontend\/app\/domains\/auth\/permission-guard\.tsx:1/,
  );
  assert.doesNotMatch(html, /Application Support\/repay-techdebt/);
});

test("renderPlanned CTA is a simple command row", () => {
  const html = renderPlanned({
    workbookTitle: "frontend workbook",
    sidebar: { chapters: [], counts: { done: 0, written: 0, planned: 1 } },
    topic: { id: "topic-xyz", title: "Topic", evidencePaths: [] },
    targetRoot: "/repo",
  });

  assert.match(html, /ds-planned-cta/);
  assert.match(html, /Ask your agent to write this lesson/);
  assert.match(html, /ds-planned-cmd/);
  assert.match(html, /ds-btn-copy-icon/);
  assert.match(html, /\/repay-techdebt --create topic-xyz/);
});

test("stripClaimsHtml removes CLAIMS blocks from lesson HTML", () => {
  const html = stripClaimsHtml(
    '<p>Intro</p><p>CLAIMS:</p><ol><li>claim</li></ol><p>Outro</p>',
  );
  assert.match(html, /Intro/);
  assert.match(html, /Outro/);
  assert.doesNotMatch(html, /CLAIMS/);
  assert.doesNotMatch(html, /claim/);
});
