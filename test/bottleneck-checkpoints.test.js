// @category C2
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import { verifyLessonCitations } from "../src/lessons/lesson-citation-check.js";
import { planCurriculum } from "../src/curriculum/curriculum-planning.js";
import { evaluateCurriculum } from "../src/evaluation/evaluation.js";
import { validateFixture } from "../src/evaluation/evaluation-schema.js";
import { buildProgramModel } from "../src/program/program-intelligence.js";
import { resolveTargetRoot } from "../src/foundations/targeting.js";

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = resolve(root, "test/fixtures/evaluation");

test("check-lesson-evidence fails on poisoned citations", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-poisoned-"));
  try {
    await writeFile(resolve(directory, "real.js"), "export const ok = 1;\n");
    const lesson = await readFile(resolve(fixtures, "poisoned-citation/lesson.md"), "utf8");
    const lessonPath = resolve(directory, "lesson.md");
    await writeFile(lessonPath, lesson);
    const result = await verifyLessonCitations(directory, lesson);
    assert.equal(result.ok, false);
    assert.ok(result.problems.length >= 2);

    await assert.rejects(
      () =>
        execute(
          process.execPath,
          [resolve(root, "scripts/check-lesson-evidence.js"), directory, lessonPath],
          { cwd: root },
        ),
      (error) => error.exitCode === 2 || error.code === 2,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("check-lesson-evidence passes when cites resolve", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-cites-ok-"));
  try {
    await mkdir(resolve(directory, "src"), { recursive: true });
    await writeFile(resolve(directory, "src/a.ts"), "export const a = 1;\n".repeat(20));
    await writeFile(resolve(directory, "src/b.ts"), "export const b = 2;\n".repeat(20));
    const markdown = "See `src/a.ts:3` and `src/b.ts:5` for the boundary and the helper.\n";
    const result = await verifyLessonCitations(directory, markdown);
    assert.equal(result.ok, true, result.problems.join("; "));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("ghost-auth fixture must not invent auth subjects as present ids", async () => {
  const expectations = validateFixture(
    JSON.parse(await readFile(resolve(fixtures, "ghost-auth/expectations.json"), "utf8")),
  );
  assert.ok(expectations.ok);

  const directory = await mkdtemp(resolve(tmpdir(), "repay-ghost-auth-"));
  try {
    await mkdir(resolve(directory, "src"), { recursive: true });
    await writeFile(
      resolve(directory, "src/greet.js"),
      await readFile(resolve(fixtures, "ghost-auth/src/greet.js"), "utf8"),
    );
    const curriculum = planCurriculum(await buildProgramModel(await resolveTargetRoot(directory)));
    const topicEval = evaluateCurriculum(curriculum, expectations.data);
    assert.equal(topicEval.ok, true, JSON.stringify(topicEval));
    assert.ok(
      !curriculum.topics.some((topic) =>
        /auth|session|security/i.test(`${topic.focus} ${topic.title}`),
      ),
      "ghost auth fixture should not surface auth-named topics",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("readme-vs-folders surfaces capture despite widget folder names", async () => {
  const expectations = validateFixture(
    JSON.parse(await readFile(resolve(fixtures, "readme-vs-folders/expectations.json"), "utf8")),
  );
  assert.ok(expectations.ok);

  const directory = await mkdtemp(resolve(tmpdir(), "repay-readme-purpose-"));
  try {
    await mkdir(resolve(directory, "app/features/widgets"), { recursive: true });
    await mkdir(resolve(directory, "src"), { recursive: true });
    await writeFile(
      resolve(directory, "README.md"),
      await readFile(resolve(fixtures, "readme-vs-folders/README.md"), "utf8"),
    );
    await writeFile(
      resolve(directory, "src/capture.js"),
      await readFile(resolve(fixtures, "readme-vs-folders/src/capture.js"), "utf8"),
    );
    await writeFile(
      resolve(directory, "app/features/widgets/README.md"),
      await readFile(resolve(fixtures, "readme-vs-folders/app/features/widgets/README.md"), "utf8"),
    );
    const curriculum = planCurriculum(await buildProgramModel(await resolveTargetRoot(directory)));
    const topicEval = evaluateCurriculum(curriculum, expectations.data);
    assert.equal(topicEval.ok, true, JSON.stringify(topicEval.missingMustFind));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
