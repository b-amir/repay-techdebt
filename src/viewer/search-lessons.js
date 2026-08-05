import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractTitle } from "./markdown-render.js";

/**
 * @param {string} lessonsDir
 */
export async function listLessonMarkdown(lessonsDir) {
  const { readdir } = await import("node:fs/promises");
  let entries;
  try {
    entries = await readdir(lessonsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith(".md") &&
        !/^index\.md$/i.test(e.name) &&
        !e.name.startsWith("."),
    )
    .map((e) => ({
      name: e.name,
      key: `lessons/${e.name}`,
      path: resolve(lessonsDir, e.name),
    }));
}

/**
 * Simple substring search across lesson titles and bodies.
 *
 * @param {{ lessonsDir: string }} workbook
 * @param {string} query
 * @param {number} [limit]
 */
export async function searchLessons(workbook, query, limit = 20) {
  const q = String(query ?? "")
    .trim()
    .toLowerCase();
  if (!q) return [];

  const files = await listLessonMarkdown(workbook.lessonsDir);
  const results = [];

  for (const file of files) {
    let source = "";
    try {
      source = await readFile(file.path, "utf8");
    } catch {
      continue;
    }
    const title = extractTitle(source) ?? file.name.replace(/\.md$/, "");
    const titleHit = title.toLowerCase().includes(q);
    const bodyHit = source.toLowerCase().includes(q);
    if (!titleHit && !bodyHit) continue;
    results.push({
      key: file.key,
      title,
      match: titleHit ? "title" : "body",
    });
  }

  results.sort((a, b) => {
    if (a.match === b.match) return a.title.localeCompare(b.title);
    return a.match === "title" ? -1 : 1;
  });

  return results.slice(0, limit);
}
