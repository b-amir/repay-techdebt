// @category C9
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import { extractLessonCitations } from "../src/lessons/lesson-citation-check.js";
import { inspectLesson } from "../src/lessons/lesson-quality.js";
import { evaluateLessonForSave } from "../src/lessons/save-lesson.js";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const libDir = resolve(root, "scripts/lib");
const srcDir = resolve(root, "src");
const projectMemoryCli = resolve(root, "scripts/project-memory.js");

/** Recursively list `.js` files under a directory. */
async function listJsRecursive(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listJsRecursive(full)));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

/** The "lib layer" that must never reach up into a CLI entrypoint: every category folder
 *  under src/, plus scripts/lib if it still exists (legacy location, tolerated when absent). */
async function listLayerJs() {
  const out = [];
  if (existsSync(libDir)) {
    for (const entry of await readdir(libDir, { withFileTypes: true })) {
      const full = resolve(libDir, entry.name);
      if (entry.isDirectory()) out.push(...(await listJsRecursive(full)));
      else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
    }
  }
  if (existsSync(srcDir)) out.push(...(await listJsRecursive(srcDir)));
  return out;
}

/** Relative import specifiers (static + dynamic) from a source string. */
function relativeSpecs(source) {
  return [...source.matchAll(/(?:from|import)\s*["'](\.\.?\/[^"']+)["']/g)].map((m) => m[1]);
}

test("the lib layer must not import the project-memory CLI facade", async () => {
  // Generalized to path-resolution so it holds for scripts/lib AND src/<cat>/ after a
  // move (a relative import of project-memory.js resolves to the same absolute
  // CLI path regardless of where the importer lives).
  const files = await listLayerJs();
  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const spec of relativeSpecs(source)) {
      if (resolve(dirname(file), spec) === projectMemoryCli) {
        offenders.push(`${relative(root, file)} → ${spec}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `lib→CLI imports: ${offenders.join(", ")}`);
});

test("the lib layer must not import anything under a future cli/ path", async () => {
  // H4 layer rule. Forward-looking: a lib module reaching into a (future) cli/ tree
  // inverts the dependency direction (CLI → lib is the allowed edge). Covers scripts/lib
  // and src/<cat>/ so the rule survives a folder move.
  const files = await listLayerJs();
  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const spec of relativeSpecs(source)) {
      const rel = relative(root, resolve(dirname(file), spec));
      if (rel === "cli" || rel.startsWith(`cli${sep}`)) {
        offenders.push(`${relative(root, file)} → ${spec}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `lib→cli imports invert the layer direction: ${offenders.join(", ")}`,
  );
});

test("claim-faithfulness must not (re-)export an omnibus helper", async () => {
  // Omnibus validation was moved out of claim-faithfulness. Lock the public surface so a
  // regression that re-adds an omnibus export fails CI.
  const mod = await import("../src/lessons/claim-faithfulness.js");
  const exports = Object.keys(mod).sort();
  assert.ok(
    !exports.some((name) => /omnibus/i.test(name)),
    `omnibus leaked back into claim-faithfulness: ${exports.join(", ")}`,
  );
  assert.deepEqual(
    exports,
    ["assessClaimFaithfulness", "parseClaimsBlock"],
    `claim-faithfulness export surface drifted; update the lock if intentional: ${exports.join(", ")}`,
  );
});

test("lesson-quality and citation-check agree on path:line extraction", () => {
  const markdown = "See `billing/capture.js:6` and also billing/settlement.js:3 for the handoff.\n";
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
