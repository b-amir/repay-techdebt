import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import { extractLessonCitations } from "../scripts/lib/lesson-citation-check.js";
import { inspectLesson } from "../scripts/lib/lesson-quality.js";
import { evaluateLessonForSave } from "../scripts/lib/save-lesson.js";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const libDir = resolve(root, "scripts/lib");

test("scripts/lib must not import the project-memory CLI facade", async () => {
  const entries = await readdir(libDir);
  const offenders = [];
  for (const name of entries) {
    if (!name.endsWith(".js")) continue;
    const source = await readFile(resolve(libDir, name), "utf8");
    if (/from\s+["']\.\.\/project-memory\.js["']/.test(source)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], `lib→CLI imports: ${offenders.join(", ")}`);
});

test("lesson-quality and citation-check agree on path:line extraction", () => {
  const markdown =
    "See `billing/capture.js:6` and also billing/settlement.js:3 for the handoff.\n";
  const fromCheck = extractLessonCitations(markdown);
  const fromQuality = inspectLesson(
    `${"word ".repeat(260)}\n\n## One\n\nx\n\n## Two\n\n${markdown}\n\n## Three\n\nyou learn because settle runs.\n`,
    { depth: "concise" },
  ).citations;
  assert.ok(fromCheck.includes("billing/capture.js:6"));
  assert.ok(fromCheck.includes("billing/settlement.js:3"));
  assert.deepEqual([...fromQuality].sort(), [...fromCheck].sort());
});

test("evaluateLessonForSave blocks explicit unfaithful CLAIMS", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-save-eval-"));
  try {
    await mkdir(resolve(directory, "billing"), { recursive: true });
    await writeFile(
      resolve(directory, "billing/capture.js"),
      "export function capturePayment() { return 1; }\n",
    );
    const content = `# Title

## A
x
## B
y
## C
See billing/capture.js:1

CLAIMS:
1. "The payment gateway queues Kafka events asynchronously" — billing/capture.js:1 — support: yes — state: observed
`;
    const padded = `${content}\n\n${"The capture path matters because funds move only after settle. ".repeat(30)}`;
    const result = await evaluateLessonForSave(directory, padded, { depth: "concise" });
    assert.equal(result.ok, false);
    assert.ok(result.quality.errors.some((item) => /support:yes/i.test(item)));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
