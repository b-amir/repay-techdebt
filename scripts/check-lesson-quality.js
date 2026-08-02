import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspectLesson } from "../src/lessons/lesson-quality.js";

function help() {
  process.stdout.write(`Usage:
  node check-lesson-quality.js <lesson.md> [--depth concise|balanced|deep] [--format json|text]

Check focus, length, section clarity, evidence citations, paragraph size, and writing smells before a
lesson can enter a workbook.
`);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  help();
  process.exit(0);
}
const input = args.find((item) => !item.startsWith("--"));
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : args[index + 1];
};
try {
  if (!input) throw new Error("A lesson Markdown path is required");
  const result = inspectLesson(await readFile(resolve(input), "utf8"), {
    depth: value("depth", "balanced"),
  });
  if (value("format", "json") === "text") {
    process.stdout.write(
      `${result.ok ? "PASS" : "FAIL"}: ${result.wordCount} words, ${result.sectionCount} sections, ${result.evidenceCount} citations\n`,
    );
    for (const item of [...result.errors, ...result.warnings]) process.stdout.write(`- ${item}\n`);
  } else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 2;
} catch (error) {
  process.stderr.write(`Lesson quality check failed: ${error.message}\n`);
  process.exitCode = 1;
}
