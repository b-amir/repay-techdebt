// @category C5
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vite-plus/test";
import { searchLessons } from "../../../src/viewer/search-lessons.js";

test("searchLessons matches title before body and caps results", async () => {
  const root = await mkdtemp(join(tmpdir(), "repay-search-"));
  const lessonsDir = join(root, "lessons");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(lessonsDir, { recursive: true });
  await writeFile(join(lessonsDir, "2026-auth.md"), "# Auth boundary\n\nHow tokens are validated.");
  await writeFile(
    join(lessonsDir, "2026-cache.md"),
    "# Cache layer\n\nMentions auth only in passing for auth middleware.",
  );

  const hits = await searchLessons({ lessonsDir }, "auth", 20);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].match, "title");
  assert.equal(hits[0].key, "lessons/2026-auth.md");
  assert.equal(hits[1].match, "explanation");
  assert.match(hits[1].snippet, /auth middleware/);

  await rm(root, { recursive: true, force: true });
});

test("searchLessons distinguishes sections, symbols, diagrams, and sources", async () => {
  const root = await mkdtemp(join(tmpdir(), "repay-search-types-"));
  const lessonsDir = join(root, "lessons");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(lessonsDir, { recursive: true });
  await writeFile(
    join(lessonsDir, "typed.md"),
    `# Boundary\n\n## Reject forbidden requests\n\nThe route stays narrow.\n\n\`guardRequest\`\n\n\`src/auth.ts:42\`\n\n\`\`\`mermaid\nflowchart TD\n  accTitle: Token handoff\n  accDescr: Session reaches guard\n  A --> B\n\`\`\`\n`,
  );

  const section = await searchLessons({ lessonsDir }, "forbidden", 20);
  const symbol = await searchLessons({ lessonsDir }, "guardrequest", 20);
  const diagram = await searchLessons({ lessonsDir }, "handoff", 20);
  const source = await searchLessons({ lessonsDir }, "auth.ts", 20);
  assert.equal(section[0].match, "section");
  assert.equal(section[0].anchor, "reject-forbidden-requests");
  assert.equal(symbol[0].match, "symbol");
  assert.equal(diagram[0].match, "diagram");
  assert.equal(source[0].match, "source");

  await rm(root, { recursive: true, force: true });
});
