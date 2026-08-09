import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareLessonMarkdown } from "./markdown-render.js";

const slugify = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");

function plainText(value) {
  return String(value ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_>#|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function snippetAround(value, query, maximum = 150) {
  const text = plainText(value);
  if (!text) return "";
  const index = text.toLowerCase().indexOf(query);
  if (index < 0) return text.slice(0, maximum);
  const start = Math.max(0, index - Math.floor((maximum - query.length) / 2));
  const end = Math.min(text.length, start + maximum);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function bestLessonMatch(body, query) {
  const headings = [...body.matchAll(/^##{1,2}\s+(.+)$/gm)];
  const heading = headings.find((match) => match[1].toLowerCase().includes(query));
  if (heading) {
    return { match: "section", snippet: plainText(heading[1]), anchor: slugify(heading[1]) };
  }

  const prose = body.replace(/```[\s\S]*?```/g, " ");
  const paragraphs = prose
    .split(/\n\s*\n/)
    .filter((part) => !/^\s*#/.test(part) && !/^\s*`[^`]+`[.!?]?\s*$/.test(part));
  const paragraph = paragraphs.find((part) => plainText(part).toLowerCase().includes(query));
  if (paragraph) return { match: "explanation", snippet: snippetAround(paragraph, query) };

  const citations = [...body.matchAll(/`([^`\n]+:\d+(?:[-–]\d+)?)`/g)].map((match) => match[1]);
  const citation = citations.find((value) => value.toLowerCase().includes(query));
  if (citation) return { match: "source", snippet: citation };

  const codeSegments = [
    ...[...body.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]),
    ...[...body.matchAll(/^```(?!mermaid\b)[^\n]*\n([\s\S]*?)^```/gim)].map((match) => match[1]),
  ];
  const code = codeSegments.find((segment) => segment.toLowerCase().includes(query));
  if (code) return { match: "symbol", snippet: snippetAround(code, query) };

  const diagrams = [...body.matchAll(/^```mermaid\n([\s\S]*?)^```/gim)].map((match) => match[1]);
  const diagram = diagrams.find((segment) => segment.toLowerCase().includes(query));
  if (diagram) return { match: "diagram", snippet: snippetAround(diagram, query) };

  return null;
}

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
    const prepared = prepareLessonMarkdown(source);
    const title = prepared.title ?? file.name.replace(/\.md$/, "");
    const titleHit = title.toLowerCase().includes(q);
    // Search reader body only — craft frontmatter (id/shape/mapAnswers) is not content.
    const bodyMatch = titleHit ? null : bestLessonMatch(prepared.body, q);
    if (!titleHit && !bodyMatch) continue;
    results.push({
      key: file.key,
      title,
      match: titleHit ? "title" : bodyMatch.match,
      snippet: titleHit ? "" : bodyMatch.snippet,
      ...(bodyMatch?.anchor ? { anchor: bodyMatch.anchor } : {}),
    });
  }

  results.sort((a, b) => {
    if (a.match === b.match) return a.title.localeCompare(b.title);
    return a.match === "title" ? -1 : 1;
  });

  return results.slice(0, limit);
}
