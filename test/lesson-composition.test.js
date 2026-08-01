import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import { lessonPlanSchema, planLesson } from "../scripts/lib/lesson-composition.js";
import { buildProgramModel } from "../scripts/lib/program-intelligence.js";
import { resolveTargetRoot } from "../scripts/lib/targeting.js";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts", "plan-lesson.js");

async function richFixture() {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-lesson-rich-"));
  for (const path of ["src/auth", "src/routes", "src/data", "test", ".github/workflows"])
    await mkdir(resolve(directory, path), { recursive: true });
  await writeFile(
    resolve(directory, "package.json"),
    `${JSON.stringify({
      dependencies: { express: "5.1.0", prisma: "6.0.0" },
      devDependencies: { vitest: "3.0.0" },
    })}\n`,
  );
  await writeFile(
    resolve(directory, "package-lock.json"),
    `${JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { dependencies: { express: "5.1.0", prisma: "6.0.0" } },
        "node_modules/express": { version: "5.1.0" },
        "node_modules/prisma": { version: "6.0.0" },
      },
    })}\n`,
  );
  await writeFile(
    resolve(directory, "src", "auth", "permission.ts"),
    "export function canAdmin(role: string) { return role === 'admin'; }\n",
  );
  await writeFile(
    resolve(directory, "src", "auth", "session.ts"),
    'import { canAdmin } from "./permission";\nexport function requireAdmin(role: string) { return canAdmin(role); }\n',
  );
  await writeFile(
    resolve(directory, "src", "data", "user-repository.ts"),
    "export function loadUser(id: string) { return { id }; }\n",
  );
  await writeFile(
    resolve(directory, "src", "routes", "admin.ts"),
    'import { requireAdmin } from "../auth/session";\nimport { loadUser } from "../data/user-repository";\nexport function admin(id: string, role: string) { if (!requireAdmin(role)) throw new Error("forbidden"); return loadUser(id); }\n',
  );
  await writeFile(
    resolve(directory, "test", "admin.test.ts"),
    'import { admin } from "../src/routes/admin";\nexport const allowed = admin("1", "admin");\n',
  );
  await writeFile(
    resolve(directory, "Dockerfile"),
    'FROM node:24\nCMD ["node", "src/routes/admin.ts"]\n',
  );
  await writeFile(
    resolve(directory, ".github", "workflows", "test.yml"),
    "name: test\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n",
  );
  return directory;
}

test("selects a dynamic shape and activates only strong cross-application modules", async () => {
  const directory = await richFixture();
  try {
    const model = await buildProgramModel(await resolveTargetRoot(directory));
    const plan = lessonPlanSchema.parse(
      planLesson(model, { focus: "auth session", kind: "auto", depth: "deep" }),
    );
    assert.equal(plan.lessonShape.id, "security-boundary");
    assert.deepEqual(
      plan.simplePlan.slice(0, 5).map((section) => section.id),
      ["asset-and-actor", "trust-boundary", "control-flow", "failure-and-abuse", "verification"],
    );
    assert.equal(
      plan.activatedOptionalSections.some((section) => section.id === "security-and-privacy"),
      false,
    );
    assert.ok(plan.activatedOptionalSections.length >= 1);
    assert.ok(
      plan.activatedOptionalSections.every(
        (section) => section.evidencePaths.length > 0 && section.strength !== "required",
      ),
    );
    const security = plan.signals.find((signal) => signal.id === "security");
    assert.equal(security.strength, "strong");
    assert.ok(security.independentSources >= 2);
    assert.ok(plan.simplePlan.length <= 9);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("keeps weak clues out of a concise lesson instead of printing empty modules", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-lesson-small-"));
  try {
    await writeFile(resolve(directory, "app.ts"), "export const answer = 42;\n");
    const model = await buildProgramModel(await resolveTargetRoot(directory));
    const plan = planLesson(model, {
      focus: "app",
      kind: "code-mechanics",
      depth: "concise",
    });
    assert.equal(plan.lessonShape.id, "code-mechanics");
    assert.equal(plan.simplePlan.length, 5);
    assert.deepEqual(plan.activatedOptionalSections, []);
    assert.ok(plan.omittedOptionalSections.some((section) => section.reasonCode === "weak-signal"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI Markdown exposes a simple plan while JSON retains selection evidence", async () => {
  const directory = await richFixture();
  try {
    const markdown = await execute(
      process.execPath,
      [script, directory, "--focus", "auth session", "--depth", "balanced", "--format", "markdown"],
      { cwd: root, timeout: 120_000, maxBuffer: 20 * 1024 * 1024 },
    );
    assert.match(markdown.stdout, /^# Lesson Plan/m);
    assert.match(markdown.stdout, /Shape:\*\* Security boundary/);
    assert.doesNotMatch(markdown.stdout, /independentSources|reasonCode|score/);

    const json = await execute(
      process.execPath,
      [script, directory, "--focus", "auth session", "--depth", "balanced", "--format", "json"],
      { cwd: root, timeout: 120_000, maxBuffer: 20 * 1024 * 1024 },
    );
    const plan = lessonPlanSchema.parse(JSON.parse(json.stdout));
    assert.ok(plan.signals.some((signal) => signal.evidenceIds.length > 0));
    assert.ok(plan.omittedOptionalSections.length > 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
