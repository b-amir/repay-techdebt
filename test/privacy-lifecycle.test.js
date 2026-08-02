import { test, beforeEach, afterEach } from "vite-plus/test";
import * as assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { rm, mkdir, writeFile, readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execa } from "execa";

let TEST_ROOT;
let MEMORY_DIR;
const CLI_PATH = resolve(process.cwd(), "scripts", "project-memory.js");

beforeEach(async () => {
  TEST_ROOT = await mkdtemp(join(tmpdir(), "privacy-test-"));
  MEMORY_DIR = join(TEST_ROOT, ".repay-techdebt");
});

afterEach(async () => {
  if (TEST_ROOT) await rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {});
});

test("Export sanitizes absolute paths and secrets", async () => {
  // 1. Initialize memory
  const initResult = await execa(process.execPath, [CLI_PATH, "init", TEST_ROOT, "--yes"], { cwd: TEST_ROOT });
  const memoryRoot = JSON.parse(initResult.stdout).memoryRoot;

  // 2. Create a fake lesson with absolute paths and secrets
  const config = JSON.parse(await readFile(join(memoryRoot, "config.json"), "utf8"));
  const outputDir = config.output.root;
  const lessonDir = join(outputDir, "lessons");
  await mkdir(lessonDir, { recursive: true });
  
  const { realpath } = await import("node:fs/promises");
  const realTestRoot = await realpath(TEST_ROOT);

  const sensitiveContent = `
# Test Lesson
This file contains an absolute path: ${realTestRoot}/src/file.js
And a secret token: ghp_1234567890abcdefghijklmnopqrstuvwxyz
Also a password: password=SuperSecret123!
`;
  await writeFile(join(lessonDir, "test-lesson.md"), sensitiveContent, "utf8");

  const indexContent = `# Saved Lessons\n- [Test Lesson](./test-lesson.md)`;
  await writeFile(join(outputDir, "INDEX.md"), indexContent, "utf8");

  // 3. Export to a public workbook
  const outputRoot = join(TEST_ROOT, "repay-techdebt");
  const result = await execa(process.execPath, [CLI_PATH, "configure-output", TEST_ROOT, "--yes", "--output-location", "custom", "--output-root", outputRoot], { cwd: TEST_ROOT });
  console.log("STDOUT:", result.stdout);
  console.log("STDERR:", result.stderr);

  // 4. Verify sanitization in the exported workbook
  const exportedLesson = await readFile(join(outputRoot, "lessons", "test-lesson.md"), "utf8");
  
  // The absolute path should be replaced by a dot (relative root)
  assert.match(exportedLesson, /\.\/src\/file\.js/);
  assert.doesNotMatch(exportedLesson, new RegExp(TEST_ROOT));
  
  // Secrets should be redacted
  assert.match(exportedLesson, /\[REDACTED\]/);
  assert.doesNotMatch(exportedLesson, /ghp_1234567890abcdefghijklmnopqrstuvwxyz/);
  assert.doesNotMatch(exportedLesson, /SuperSecret123!/);
});
