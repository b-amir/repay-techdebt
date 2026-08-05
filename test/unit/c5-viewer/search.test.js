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

  await rm(root, { recursive: true, force: true });
});
