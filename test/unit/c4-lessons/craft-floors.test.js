// @category C4
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import {
  checkMapXor,
  inspectLessonShape,
  loadGoldenDraftInput,
  resolveGoldenPaths,
  DEFAULT_PATH_SECTIONS,
} from "../../../src/lessons/lesson-shape.js";
import {
  inspectUsefulnessFloors,
  USEFULNESS_FLOORS,
} from "../../../src/lessons/usefulness-floors.js";
import { checkDiagramGate } from "../../../src/lessons/diagram-gate.js";
import {
  emitSubjectCandidates,
  resolveSubjectPath,
  checkSubjectPathGate,
  checkAntiClone,
} from "../../../src/lessons/subject-path-gate.js";
import {
  checkPolyglotHonesty,
  checkAbsenceHonesty,
} from "../../../src/lessons/polyglot-honesty.js";
import { parseLessonFrontmatter } from "../../../src/lessons/lesson-frontmatter.js";
import { evaluateLessonForSave } from "../../../src/lessons/save-lesson.js";
import { buildTrajectoryGate } from "../../../src/dialogue/trajectory.js";
import { recordJudgment } from "../../../src/lessons/lesson-judgment.js";
import { PASSING_JUDGMENT } from "../../helpers/passing-judgment.js";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const goldens = resolve(root, "test/fixtures/golden-lessons");

test("shape contract is data with required default-path sections", () => {
  assert.ok(DEFAULT_PATH_SECTIONS.length >= 5);
  assert.deepEqual(
    DEFAULT_PATH_SECTIONS.map((s) => s.id),
    ["hook", "map", "worked-path", "pitfall", "check-yourself"],
  );
});

test("teach handshake loads golden A/B + craft pairs", async () => {
  const input = await loadGoldenDraftInput(root);
  assert.ok(input.lessons.pathWithMap.includes("capturePayment"));
  assert.ok(input.lessons.deepDive.includes("settle"));
  assert.ok(input.craftPairs.length > 100);
  const paths = resolveGoldenPaths(root);
  assert.ok(paths.pathWithMap.endsWith("a-path-with-map/lesson.md"));
});

test("mapAnswers xor skipReasons.map enforced", () => {
  assert.equal(checkMapXor({ subject: "flow", mapAnswers: "yes", skipReasons: {} }).ok, true);
  assert.equal(
    checkMapXor({ subject: "flow", mapAnswers: null, skipReasons: { map: "single file" } }).ok,
    true,
  );
  assert.equal(checkMapXor({ subject: "flow", mapAnswers: null, skipReasons: {} }).ok, false);
  assert.equal(
    checkMapXor({
      subject: "flow",
      mapAnswers: "yes",
      skipReasons: { map: "also" },
    }).ok,
    false,
  );
  assert.equal(checkMapXor({ subject: "code-mechanics", mapAnswers: null }).ok, true);
});

test("golden A passes shape + usefulness + map xor + diagram with inventory", async () => {
  const md = await readFile(resolve(goldens, "a-path-with-map/lesson.md"), "utf8");
  const shape = inspectLessonShape(md);
  assert.equal(shape.ok, true, shape.errors.join("; "));
  const useful = inspectUsefulnessFloors(md, { depth: "balanced" });
  assert.equal(useful.ok, true, useful.errors.join("; "));
  const diagram = checkDiagramGate(md, {
    inventory: ["billing/capture.js", "billing/settlement.js"],
    mapAnswers: shape.craft.mapAnswers,
  });
  assert.equal(diagram.ok, true, diagram.errors.join("; "));
  assert.ok(diagram.blockCount === 1);
});

test("golden B passes with map skip", async () => {
  const md = await readFile(resolve(goldens, "b-deep-dive/lesson.md"), "utf8");
  const shape = inspectLessonShape(md);
  assert.equal(shape.ok, true, shape.errors.join("; "));
  assert.ok(shape.craft.skipReasons.map);
  const useful = inspectUsefulnessFloors(md, { depth: "concise" });
  assert.equal(useful.ok, true, useful.errors.join("; "));
  assert.ok(USEFULNESS_FLOORS.source.includes("golden-lessons"));
});

test("default-path missing required section fails shape", () => {
  const md = `---
subject: flow
mapAnswers: something
primaryPaths:
  - src/a.js
---

# Title

Short hook is not enough.

## Only one section
Hi
`;
  const shape = inspectLessonShape(md);
  assert.equal(shape.ok, false);
  assert.ok(shape.errors.some((e) => /worked-path|pitfall|Check yourself|hook/i.test(e)));
});

test("diagram rejects unknown inventory paths", () => {
  const md = `# T

\`\`\`mermaid
flowchart LR
  accTitle: Q
  accDescr: D
  a[totally/invented/module.js] --> b[also/fake/path.ts]
\`\`\`

**What this shows:** nothing real.
`;
  const result = checkDiagramGate(md, {
    inventory: ["billing/capture.js"],
  });
  assert.equal(result.ok, false);
  assert.ok(result.unknownNodes.length > 0);
});

test("subject path gate refuses pathless topics", () => {
  const refused = checkSubjectPathGate({
    inventoryPaths: ["src/a.js"],
    focus: "the payment philosophy of our platform",
  });
  assert.equal(refused.ok, false);

  const pinned = checkSubjectPathGate({
    inventoryPaths: ["src/a.js"],
    pins: ["src/a.js"],
  });
  assert.equal(pinned.ok, true);
  assert.equal(pinned.resolvedPath, "src/a.js");

  assert.equal(resolveSubjectPath("a.js", ["src/lib/a.js"]), "src/lib/a.js");
});

test("emitSubjectCandidates honors pins over rank", () => {
  const model = {
    profile: { entryPoints: [{ path: "src/entry.js" }] },
    nodes: [
      { id: "1", path: "src/entry.js", kind: "entry" },
      { id: "2", path: "src/hot.js", kind: "module" },
    ],
    edges: [
      { from: "1", to: "2" },
      { from: "1", to: "2" },
      { from: "1", to: "2" },
    ],
  };
  const ranked = emitSubjectCandidates(model, { pins: ["src/obscure.js"] });
  assert.equal(ranked[0].path, "src/obscure.js");
  assert.equal(ranked[0].pinned, true);
});

test("monorepo packages boost package-scoped candidates", () => {
  const model = {
    profile: {
      entryPoints: [
        { path: "packages/billing/src/index.js" },
        { path: "packages/ui/src/index.js" },
      ],
      packages: [{ path: "packages/billing" }, { path: "packages/ui" }],
    },
    nodes: [
      { id: "b", path: "packages/billing/src/index.js", kind: "entry" },
      { id: "u", path: "packages/ui/src/index.js", kind: "entry" },
    ],
    edges: [],
  };
  const ranked = emitSubjectCandidates(model);
  assert.ok(ranked.some((r) => r.reasons.includes("monorepo-package-scope")));
});

test("anti-clone flags same primary set; deeper layer allowed", () => {
  const prior = [{ primaryPaths: ["a.js", "b.js"], citations: ["a.js:1", "b.js:2"] }];
  const clone = checkAntiClone({ primaryPaths: ["a.js", "b.js"], citations: ["a.js:1"] }, prior);
  assert.equal(clone.ok, false);
  assert.equal(clone.clone, true);

  const deeper = checkAntiClone(
    {
      primaryPaths: ["a.js", "b.js"],
      citations: ["a.js:1", "a.js:4", "a.js:9", "b.js:2", "b.js:5"],
    },
    prior,
  );
  assert.equal(deeper.ok, true);
  assert.equal(deeper.deeperLayer, true);

  const fresh = checkAntiClone({ primaryPaths: ["c.js"], citations: ["c.js:1"] }, prior);
  assert.equal(fresh.ok, true);
});

test("polyglot honesty blocks deep claims on unsupported languages", () => {
  const bad = checkPolyglotHonesty("The callers of settle import capture from three modules.", {
    relationLanguagesUnsupported: ["Rust"],
  });
  assert.equal(bad.ok, false);

  const ok = checkPolyglotHonesty(
    "Surface-only: call graph unsupported for Rust without a language-aware graph.",
    { relationLanguagesUnsupported: ["Rust"] },
  );
  assert.equal(ok.ok, true);
});

test("absence honesty under partial scope", () => {
  const bad = checkAbsenceHonesty("There is no other caller of settle in the codebase.", {
    truncated: true,
    mustNotClaim: [],
  });
  assert.equal(bad.ok, false);

  const ok = checkAbsenceHonesty("There is no other caller of settle in the analyzed slice.", {
    truncated: true,
    mustNotClaim: ["whole-application-absence"],
  });
  assert.equal(ok.ok, true);
});

test("frontmatter parse mapAnswers and skipReasons.map", () => {
  const a = parseLessonFrontmatter(`---
subject: flow
mapAnswers: >-
  capture validates
primaryPaths:
  - billing/capture.js
---

# Hi
`);
  assert.ok(String(a.frontmatter.mapAnswers).includes("capture"));
  assert.deepEqual(a.frontmatter.primaryPaths, ["billing/capture.js"]);

  const b = parseLessonFrontmatter(`---
skipReasons:
  map: >-
    Single helper
---

# Hi
`);
  assert.ok(/** @type {any} */ (b.frontmatter.skipReasons).map.includes("Single"));
});

test("hollow overview fails usefulness; invented graph fails diagram on save", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-craft-adv-"));
  try {
    await mkdir(resolve(directory, "billing"), { recursive: true });
    await writeFile(
      resolve(directory, "billing/capture.js"),
      "export function capturePayment() { return 1; }\n",
    );
    const hollow = `---
subject: flow
mapAnswers: none really
primaryPaths:
  - billing/capture.js
---

# Overview of the system

In this lesson we will explore a comprehensive overview of the entire system.

## Why this matters
Generic overview of the system without a path.

## Walk the path in code
See the architecture generally.

## The pitfall people miss
Many teams skip maps.

## Check yourself
Think about architecture.
${"Filler words for length so word floors do not dominate the hollow overview refuse path. ".repeat(20)}
`;
    const useful = inspectUsefulnessFloors(hollow, { depth: "balanced" });
    assert.equal(useful.ok, false);
    assert.ok(useful.errors.some((e) => /hollow|overview|cite|path|next look/i.test(e)));

    const invented = await readFile(
      resolve(root, "test/fixtures/evaluation/invented-graph-node/lesson.md"),
      "utf8",
    ).catch(() => null);
    if (invented) {
      const d = checkDiagramGate(invented, { inventory: ["billing/capture.js"] });
      assert.equal(d.ok, false);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("evaluateLessonForSave refuses pathless topic via craft subject gate", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-pathless-"));
  try {
    await mkdir(resolve(directory, "billing"), { recursive: true });
    await writeFile(resolve(directory, "billing/x.js"), "export const x = 1;\n");
    const body = `---
subject: flow
mapAnswers: abstract
---

# Abstract topic

${"The mechanism matters because production fails without the guard in place for real users. ".repeat(15)}

## Why this path exists
Because architecture.

## Walk the path in code
No real file named.

## The pitfall people miss
Guessing.

## Check yourself
Name a feeling.
`;
    const draft = resolve(directory, "draft.md");
    await writeFile(draft, body);
    await recordJudgment(draft, PASSING_JUDGMENT);
    const result = await evaluateLessonForSave(directory, body, {
      depth: "balanced",
      draftPath: draft,
      trajectoryGate: {
        gate: buildTrajectoryGate({ mode: "fast", purposeDone: true, verifyDone: null }),
      },
      inventoryPaths: ["billing/x.js"],
      focus: "payment philosophy",
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.quality.errors.some((e) =>
        /inventory path|resolved|hollow|cite|Check yourself|path/i.test(e),
      ),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("golden A evaluates craft-ok on golden target with complete gate", async () => {
  const target = resolve(goldens, "target");
  const md = await readFile(resolve(goldens, "a-path-with-map/lesson.md"), "utf8");
  // save-lesson prefixes title in CLI; evaluate raw golden content
  const draft = resolve(await mkdtemp(resolve(tmpdir(), "repay-golden-save-")), "draft.md");
  try {
    await writeFile(draft, md);
    await recordJudgment(draft, PASSING_JUDGMENT);
    const result = await evaluateLessonForSave(target, md, {
      depth: "balanced",
      draftPath: draft,
      trajectoryGate: {
        gate: buildTrajectoryGate({ mode: "fast", purposeDone: true, verifyDone: null }),
      },
      inventoryPaths: ["billing/capture.js", "billing/settlement.js"],
      expectedEvidencePaths: ["billing/capture.js", "billing/settlement.js"],
    });
    assert.equal(result.trajectory.refuse, false);
    assert.equal(result.craft?.shape?.ok, true, result.craft?.shape?.errors?.join("; "));
    assert.equal(result.craft?.mapXor?.ok, true);
    assert.equal(result.craft?.diagram?.ok, true, result.craft?.diagram?.errors?.join("; "));
    assert.equal(result.craft?.usefulness?.ok, true, result.craft?.usefulness?.errors?.join("; "));
    // Judgment + citations should allow full ok
    assert.equal(result.ok, true, result.quality.errors.join("; "));
  } finally {
    await rm(dirname(draft), { recursive: true, force: true });
  }
});
