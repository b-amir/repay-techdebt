import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assessClaimFaithfulness } from "../src/lessons/claim-faithfulness.js";
import { formatTargetError, resolveTargetRoot } from "../src/foundations/targeting.js";
import { assertClosedNextAsks } from "../src/dialogue/dialogue-envelope.js";

function help() {
  process.stdout.write(`Usage:
  node check-lesson-faithfulness.js <target-root> <lesson.md> [--format json|text] [--strict]

Evidence-anchor coverage floor (B6). Prefers an explicit CLAIMS: block; otherwise checks
sentences near citations. This verifies cited windows and identifiers, not semantic meaning.
Explicit CLAIMS with support:yes that lack anchor coverage always exit 2.
Auto mode only exits 2 with --strict.
`);
}

try {
  const raw = process.argv.slice(2);
  if (raw.includes("--help") || raw.includes("-h")) {
    help();
    process.exit(0);
  }
  const args = [];
  let format = "json";
  let strict = false;
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === "--format") {
      format = raw[++i];
      continue;
    }
    if (raw[i] === "--strict") {
      strict = true;
      continue;
    }
    if (raw[i].startsWith("--")) throw new Error(`Unknown option: ${raw[i]}`);
    args.push(raw[i]);
  }
  if (args.length !== 2) throw new Error("Expected <target-root> and <lesson.md>");
  if (!["json", "text"].includes(format)) throw new Error("--format must be json or text");

  const target = await resolveTargetRoot(args[0]);
  const markdown = await readFile(resolve(args[1]), "utf8");
  const result = await assessClaimFaithfulness(target.targetRoot, markdown);
  const blocking =
    result.mode === "explicit-claims" ? result.problems : strict ? result.problems : [];
  const payload = {
    analyzer: "lesson-claim-faithfulness",
    role: "check",
    status: blocking.length === 0 ? "succeeded" : "failed",
    mode: result.mode,
    verificationKind: result.verificationKind,
    semanticReviewRequired: result.semanticReviewRequired,
    strict,
    assessmentCount: result.assessments.length,
    assessments: result.assessments,
    problems: result.problems,
    blocking,
    nextAsks: assertClosedNextAsks(
      blocking.length === 0
        ? [{ who: "agent", do: "review-claim-semantics", why: "faithfulness-ok" }]
        : [
            {
              who: "agent",
              do: "rewrite-unsupported-claims",
              why: "faithfulness-failed",
            },
          ],
    ),
  };
  if (format === "text") {
    process.stdout.write(
      `${payload.status === "succeeded" ? "PASS" : "FAIL"} (${result.mode}): ${result.assessments.length} claims, ${result.problems.length} problems\n`,
    );
    for (const problem of result.problems) process.stdout.write(`- ${problem}\n`);
  } else process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (blocking.length > 0) process.exitCode = 2;
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? `Lesson faithfulness check failed: ${error.message}`}\n`,
  );
  process.exitCode = 1;
}
