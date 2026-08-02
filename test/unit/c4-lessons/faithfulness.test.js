// @category C4
// Pure + temp-dir unit tests for lesson floors: citation extraction (pure), claim
// faithfulness explicit-vs-auto modes, and the runTeachFloors contract.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import { extractLessonCitations } from "../../../src/lessons/lesson-citation-check.js";
import {
  assessClaimFaithfulness,
  parseClaimsBlock,
} from "../../../src/lessons/claim-faithfulness.js";
import { runTeachFloors } from "../../../src/lessons/save-lesson.js";

test("extractLessonCitations dedupes and keeps path:line only", () => {
  const md = "See billing/capture.js:4 and billing/capture.js:4 again, plus src/a.js:1-3.";
  assert.deepEqual(extractLessonCitations(md), ["billing/capture.js:4", "src/a.js:1"]);
});

test("extractLessonCitations ignores bare words and URLs", () => {
  assert.deepEqual(extractLessonCitations("see line 4 and example.com:80 and http://x/y"), []);
  assert.deepEqual(extractLessonCitations("no citations here"), []);
});

test("parseClaimsBlock reads explicit CLAIMS and tolerates blank input", () => {
  const md = `Body

CLAIMS:
1. "capture calls settle" — billing/capture.js:4 — support: yes — state: observed
2. "queue is async" — billing/queue.js:1 — support: no
`;
  const claims = parseClaimsBlock(md);
  assert.equal(claims.length, 2);
  assert.equal(claims[0].support, "yes");
  assert.equal(claims[0].state, "observed");
  assert.equal(claims[1].state, null);
  assert.deepEqual(parseClaimsBlock("no block"), []);
});

async function fixture() {
  const dir = await mkdtemp(resolve(tmpdir(), "repay-c4-"));
  await mkdir(resolve(dir, "billing"), { recursive: true });
  await writeFile(
    resolve(dir, "billing/capture.js"),
    "function capturePayment() { return settle(); }\n",
  );
  return dir;
}

test("assessClaimFaithfulness: explicit supported claim → ok, explicit-claims mode", async () => {
  const dir = await fixture();
  try {
    const md = `# T

## A
words

CLAIMS:
1. "capturePayment settle function" — billing/capture.js:1 — support: yes — state: observed
`;
    const result = await assessClaimFaithfulness(dir, md);
    assert.equal(result.mode, "explicit-claims");
    assert.equal(result.ok, true, result.problems.join("; "));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("assessClaimFaithfulness: declared support:yes but snippet disagrees → problem", async () => {
  const dir = await fixture();
  try {
    const md = `# T

## A
words

CLAIMS:
1. "kafka broker topics async" — billing/capture.js:1 — support: yes — state: observed
`;
    const result = await assessClaimFaithfulness(dir, md);
    assert.equal(result.mode, "explicit-claims");
    assert.equal(result.ok, false);
    assert.ok(
      result.problems.some((p) => /declared support:yes but snippet does not support/i.test(p)),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("assessClaimFaithfulness: explicit claim citing a missing file → problem", async () => {
  const dir = await fixture();
  try {
    const md = `# T

## A
words

CLAIMS:
1. "capturePayment settle function" — billing/missing.js:1 — support: yes — state: observed
`;
    const result = await assessClaimFaithfulness(dir, md);
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => /cites missing file/i.test(p)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("assessClaimFaithfulness: no CLAIMS block → auto-near-citation mode", async () => {
  const dir = await fixture();
  try {
    // No backticks around the citation: precedingSentence() grabs the text before it as
    // the claim, and a leading backtick would otherwise become the whole "claim".
    const md = "The capturePayment function handles the settle path.\n\nbilling/capture.js:1\n";
    const result = await assessClaimFaithfulness(dir, md);
    assert.equal(result.mode, "auto-near-citation");
    // preceding sentence overlaps the snippet → no problem
    assert.equal(result.ok, true, result.problems.join("; "));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runTeachFloors returns the documented floor shape", async () => {
  const dir = await fixture();
  try {
    const md = "Some lesson body referencing `billing/capture.js:1`.\n";
    const result = await runTeachFloors(dir, md);
    assert.ok(
      ["floorOk", "quality", "citations", "pedagogy", "faithfulness"].every((k) => k in result),
    );
    assert.equal(result.citations.ok, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runTeachFloors: a citation that does not resolve flips floorOk false", async () => {
  const dir = await fixture();
  try {
    const md = "Lesson citing `billing/missing.js:9` here.\n";
    const result = await runTeachFloors(dir, md);
    assert.equal(result.citations.ok, false);
    assert.equal(result.floorOk, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
