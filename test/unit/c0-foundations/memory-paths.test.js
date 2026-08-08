// @category C0
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import { memoryPaths, resolveMemoryPaths } from "../../../src/foundations/memory-paths.js";
import { validateCurriculum } from "../../../src/curriculum/approve-curriculum.js";
import { applyAgentApproval } from "../../../src/curriculum/curriculum-approval.js";

test("memoryPaths exposes expected layout keys", () => {
  const paths = memoryPaths("/tmp/repay-memory-root");
  assert.equal(paths.root, "/tmp/repay-memory-root");
  assert.equal(paths.config, "/tmp/repay-memory-root/config.json");
  assert.equal(paths.curriculumData, "/tmp/repay-memory-root/curriculum.json");
  assert.equal(paths.lessons, "/tmp/repay-memory-root/lessons");
  assert.ok(paths.artifactIndex.endsWith("artifacts/index.json"));
});

test("resolveMemoryPaths defaults to private layout for a fresh target", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-mem-paths-"));
  try {
    const paths = await resolveMemoryPaths(directory);
    assert.equal(paths.location.mode, "private");
    assert.equal(paths.location.ready, false);
    assert.ok(paths.config.endsWith("config.json"));
    assert.equal(paths.root, paths.location.root);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("validateCurriculum rejects missing approval and accepts corroborated shortlist", () => {
  const directory = "/tmp/fake-target-root";
  const base = {
    schemaVersion: 1,
    target: { root: directory },
    coverage: { modeledFiles: 5, status: "partial", truncated: true },
    scale: { availableCandidates: 1 },
    topics: [
      {
        id: "topic-aaaaaaaaaaaa",
        title: "Follow capture",
        focus: "billing/capture.js",
        learnerOutcome: "Explain capture handoff",
        chapter: "billing",
        evidencePaths: ["billing/capture.js"],
        signalClass: "ast",
        relationCount: 2,
      },
    ],
  };
  assert.throws(() => validateCurriculum(structuredClone(base), directory), /agentApproval/);

  const approved = structuredClone(base);
  applyAgentApproval(approved, {
    approvedAt: "2026-08-02T00:00:00.000Z",
    purposeStatus: "accepted",
    titleReview: {
      reviewedAt: "2026-08-02T00:00:00.000Z",
      scope: "complete-curriculum",
    },
    corroboratedTopicIds: [],
    acceptedPartialScope: "fixture",
  });
  const saved = validateCurriculum(approved, directory);
  assert.equal(saved.topics[0].status, "planned");
  assert.equal(saved.topics[0].lessonPath, null);
});
