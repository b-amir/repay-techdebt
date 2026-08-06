import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseClaimsBlock } from "./claim-faithfulness.js";
import { extractLessonCitations } from "./lesson-citation-check.js";
import { parseLessonFrontmatter, craftFieldsFromFrontmatter } from "./lesson-frontmatter.js";
import { listLessonMarkdown } from "../viewer/search-lessons.js";

/**
 * Index one lesson for claim/path search.
 * @param {string} markdown
 * @param {{ path: string, key?: string, name?: string }} file
 */
export function indexLessonClaims(markdown, file) {
  const { frontmatter } = parseLessonFrontmatter(markdown);
  const craft = craftFieldsFromFrontmatter(frontmatter);
  const claims = parseClaimsBlock(markdown);
  const citations = extractLessonCitations(markdown);
  const titleMatch = String(markdown).match(/^#\s+(.+)$/m);
  const title =
    titleMatch?.[1]?.trim() ||
    file.name?.replace(/\.md$/i, "") ||
    basename(file.path).replace(/\.md$/i, "");

  return {
    lessonPath: file.path,
    key: file.key ?? `lessons/${basename(file.path)}`,
    title,
    primaryPaths: craft.primaryPaths ?? [],
    claims: claims.map((c) => ({
      claim: c.claim,
      citation: c.citation,
      support: c.support,
    })),
    citations,
  };
}

/**
 * Build claim index for all lessons under lessonsDir.
 * @param {string} lessonsDir
 */
export async function buildClaimIndex(lessonsDir) {
  const files = await listLessonMarkdown(lessonsDir);
  const lessons = [];
  for (const file of files) {
    let markdown = "";
    try {
      markdown = await readFile(file.path, "utf8");
    } catch {
      continue;
    }
    lessons.push(indexLessonClaims(markdown, file));
  }
  return { lessonsDir, lessonCount: lessons.length, lessons };
}

/**
 * Substring search over claims, citations, primaryPaths, titles.
 * @param {{ lessons: ReturnType<typeof indexLessonClaims>[], lessonCount?: number } | string} indexOrDir
 * @param {string} query
 * @param {{ limit?: number }} [options]
 */
export async function searchClaims(indexOrDir, query, options = {}) {
  const limit = options.limit ?? 20;
  const q = String(query ?? "")
    .trim()
    .toLowerCase();
  if (!q) {
    return { query: "", ok: true, hitCount: 0, hits: [], emptyQuery: true, lessonCount: 0 };
  }

  /** @type {{ lessons: ReturnType<typeof indexLessonClaims>[], lessonCount?: number }} */
  const index = typeof indexOrDir === "string" ? await buildClaimIndex(indexOrDir) : indexOrDir;

  /** @type {Array<{ key: string, title: string, lessonPath: string, match: string, snippet: string }>} */
  const hits = [];

  for (const lesson of index.lessons ?? []) {
    const push = (match, snippet) => {
      hits.push({
        key: lesson.key,
        title: lesson.title,
        lessonPath: lesson.lessonPath,
        match,
        snippet: String(snippet).slice(0, 200),
      });
    };

    if (String(lesson.title).toLowerCase().includes(q)) {
      push("title", lesson.title);
    }
    for (const path of lesson.primaryPaths ?? []) {
      if (String(path).toLowerCase().includes(q)) push("primaryPath", path);
    }
    for (const citation of lesson.citations ?? []) {
      if (String(citation).toLowerCase().includes(q)) push("citation", citation);
    }
    for (const claim of lesson.claims ?? []) {
      const hay = `${claim.claim} ${claim.citation}`.toLowerCase();
      if (hay.includes(q)) push("claim", claim.claim);
    }
  }

  // Dedupe by key+match+snippet; prefer claim > citation > primaryPath > title
  const rank = { claim: 0, citation: 1, primaryPath: 2, title: 3 };
  const seen = new Set();
  const unique = [];
  for (const hit of hits.sort(
    (a, b) => (rank[a.match] ?? 9) - (rank[b.match] ?? 9) || a.title.localeCompare(b.title),
  )) {
    const id = `${hit.key}|${hit.match}|${hit.snippet}`;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(hit);
    if (unique.length >= limit) break;
  }

  return {
    query: String(query ?? "").trim(),
    ok: true,
    hitCount: unique.length,
    hits: unique,
    emptyQuery: false,
    lessonCount: index.lessonCount ?? index.lessons?.length ?? 0,
  };
}

/**
 * Workbook-level search: resolve lessons dir then search.
 * @param {{ lessonsDir?: string, ready?: boolean } | null} workbook
 * @param {string} query
 * @param {{ limit?: number }} [options]
 */
export async function searchWorkbookClaims(workbook, query, options = {}) {
  if (!workbook?.lessonsDir) {
    return {
      query: String(query ?? "").trim(),
      ok: false,
      hitCount: 0,
      hits: [],
      empty: true,
      emptyQuery: false,
      lessonCount: 0,
      problems: ["No workbook lessons directory."],
    };
  }
  if (workbook.ready === false) {
    return {
      query: String(query ?? "").trim(),
      ok: false,
      hitCount: 0,
      hits: [],
      empty: true,
      emptyQuery: false,
      lessonCount: 0,
      problems: ["Project memory not initialized; cannot locate saved lessons."],
    };
  }
  const result = await searchClaims(workbook.lessonsDir, query, options);
  return {
    ...result,
    ok: true,
    empty: (result.lessonCount ?? 0) === 0 && !result.emptyQuery,
    emptyQuery: result.emptyQuery === true,
    lessonCount: result.lessonCount ?? 0,
    problems: [],
  };
}
