import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import { applyAgentApproval, validateAgentApproval } from "../scripts/lib/curriculum-approval.js";
import { planCurriculum } from "../scripts/lib/curriculum-planning.js";
import {
  curriculumCoversFocus,
  evaluateCurriculum,
  evaluateDialogueProposal,
  evaluateDialogueProposalAsync,
} from "../scripts/lib/evaluation.js";
import { validateFixture } from "../scripts/lib/evaluation-schema.js";
import { buildProgramModel } from "../scripts/lib/program-intelligence.js";
import { resolveTargetRoot } from "../scripts/lib/targeting.js";
import { rankCandidate } from "../scripts/lib/curriculum-ranking.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const unconventional = resolve(root, "test/fixtures/evaluation/unconventional-layout");

test("naming-heuristic candidates are demoted versus related modules", () => {
  const naming = rankCandidate({ kind: "area", focus: "app/features/widgets", relationCount: 0 });
  const related = rankCandidate({ kind: "module", focus: "billing/capture.ts", relationCount: 6 });
  assert.ok(naming.features.negative.some((item) => item.feature === "naming-heuristic"));
  assert.ok(related.score > naming.score);
});

test("unapproved curriculum fails approve-before-save", () => {
  const check = validateAgentApproval({
    schemaVersion: 1,
    topics: [
      {
        id: "topic-aaaaaaaaaaaa",
        signalClass: "naming-heuristic",
        focus: "app/features",
      },
    ],
    coverage: { modeledFiles: 10 },
  });
  assert.equal(check.ok, false);
  assert.match(check.error, /agentApproval/);
});

test("corroborated naming-heuristic topics can be approved", () => {
  const curriculum = {
    schemaVersion: 1,
    topics: [
      {
        id: "topic-bbbbbbbbbbbb",
        signalClass: "naming-heuristic",
        focus: "bounded-contexts/billing-core",
      },
    ],
    coverage: { status: "partial", truncated: true, modeledFiles: 2 },
  };
  applyAgentApproval(curriculum, {
    approvedAt: "2026-08-02T00:00:00.000Z",
    purposeStatus: "accepted",
    corroboratedTopicIds: ["topic-bbbbbbbbbbbb"],
    acceptedPartialScope: "scoped billing-core study",
  });
  const check = validateAgentApproval(curriculum);
  assert.equal(check.ok, true, check.error);
});

test("purposeStatus is required on agentApproval", () => {
  const check = validateAgentApproval({
    schemaVersion: 1,
    topics: [{ id: "topic-cccccccccccc", signalClass: "ast", focus: "x" }],
    coverage: { modeledFiles: 1 },
    agentApproval: {
      approvedAt: "2026-08-02T00:00:00.000Z",
      corroboratedTopicIds: [],
    },
  });
  assert.equal(check.ok, false);
  assert.match(check.error, /purposeStatus/);
});

test("unconventional-layout fixture plans billing subjects and dialogue envelopes", async () => {
  const expectations = validateFixture(
    JSON.parse(
      await (
        await import("node:fs/promises")
      ).readFile(resolve(unconventional, "expectations.json"), "utf8"),
    ),
  );
  assert.ok(expectations.ok, JSON.stringify(expectations.errors));

  // Copy outside the skill tree — resolveTargetRoot refuses analyzing the skill itself.
  const directory = await mkdtemp(resolve(tmpdir(), "repay-unconventional-"));
  try {
    const billing = resolve(directory, "bounded-contexts/billing-core");
    await mkdir(billing, { recursive: true });
    await writeFile(
      resolve(billing, "capture.js"),
      await (
        await import("node:fs/promises")
      ).readFile(resolve(unconventional, "bounded-contexts/billing-core/capture.js"), "utf8"),
    );
    await writeFile(
      resolve(billing, "settlement.js"),
      await (
        await import("node:fs/promises")
      ).readFile(resolve(unconventional, "bounded-contexts/billing-core/settlement.js"), "utf8"),
    );

    const model = await buildProgramModel(await resolveTargetRoot(directory));
    const curriculum = planCurriculum(model);
    const dialogue = evaluateDialogueProposal(curriculum, expectations.data.dialogue);
    assert.equal(dialogue.ok, true, dialogue.errors.join("; "));

    assert.ok(
      curriculumCoversFocus(curriculum, "billing"),
      "expected billing-core paths in curriculum focuses",
    );
    const topicEval = evaluateCurriculum(curriculum, expectations.data);
    assert.equal(topicEval.ok, true, JSON.stringify(topicEval.missingMustFind));

    const gate = validateAgentApproval(curriculum);
    assert.equal(gate.ok, false, "raw proposal must not be saveable");
    const unapproved = await evaluateDialogueProposalAsync(curriculum, {
      forbidSaveWithoutApproval: true,
    });
    assert.equal(
      unapproved.ok,
      true,
      `gate should reject unapproved curriculum: ${unapproved.errors.join("; ")}`,
    );

    applyAgentApproval(curriculum, {
      approvedAt: new Date().toISOString(),
      purposeStatus: "unresolved",
      corroboratedTopicIds: curriculum.topics
        .filter((topic) => topic.signalClass === "naming-heuristic")
        .map((topic) => topic.id),
      acceptedPartialScope:
        curriculum.coverage?.truncated || curriculum.coverage?.status === "partial"
          ? "fixture scope"
          : null,
    });
    const approved = await evaluateDialogueProposalAsync(curriculum, {
      requireApprovalPasses: true,
    });
    assert.equal(approved.ok, true, approved.errors.join("; "));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("find-patterns refuses whole-repo scan without --all or --scope", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-patterns-"));
  try {
    await writeFile(resolve(directory, "x.js"), "export const n = 1;\n");
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execute = promisify(execFile);
    await assert.rejects(
      () =>
        execute(process.execPath, [resolve(root, "scripts/find-patterns.js"), directory], {
          cwd: root,
        }),
      /--scope|--all/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
