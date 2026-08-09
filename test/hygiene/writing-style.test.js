// @category C9
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ignoredDirectories = new Set([".git", "node_modules", ".repay-skill-runtime"]);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sh",
  ".txt",
  ".yaml",
  ".yml",
]);
const authoredProseRoots = new Set(["docs", "references", "templates"]);
const cannedWriting =
  /\b(?:delves?|delving|seamless(?:ly)?|game[- ]?changer|revolutionary|transformative|groundbreaking|cutting[- ]edge|crucial|pivotal|paramount|navigate the|highest leverage|it is important to note|it is worth noting|in today.s|at the end of the day|more than just|not (?:just|merely)|comprehensive overview)\b/i;

async function listTextFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listTextFiles(path)));
    else if (textExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function markdownProse(markdown) {
  let inFence = false;
  const prose = [];
  for (const line of markdown.split("\n")) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    prose.push(
      line
        .replace(/`[^`]*`/g, "")
        .replace(/&[#A-Za-z0-9]+;/g, "")
        .replace(/\]\([^)]*\)/g, "]"),
    );
  }
  return prose.join("\n");
}

test("repository text contains no em dashes", async () => {
  const failures = [];
  for (const file of await listTextFiles(root)) {
    const text = await readFile(file, "utf8");
    if (text.includes("\u2014")) failures.push(relative(root, file));
  }
  assert.deepEqual(failures, [], `Remove em dashes from: ${failures.join(", ")}`);
});

test("authored Markdown avoids prose semicolons and canned AI copy", async () => {
  const failures = [];
  for (const file of await listTextFiles(root)) {
    const path = relative(root, file);
    const [top] = path.split("/");
    const isAuthoredProse =
      extname(file) === ".md" &&
      (path === "README.md" || path === "SKILL.md" || authoredProseRoots.has(top));
    if (!isAuthoredProse) continue;

    const prose = markdownProse(await readFile(file, "utf8"));
    if (/;(?=\s|$)/m.test(prose)) failures.push(`${path}: prose semicolon`);
    if (cannedWriting.test(prose)) failures.push(`${path}: canned wording`);
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});
