// @category C6
import { test, beforeEach, afterEach } from "vite-plus/test";
import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import { rm, writeFile, mkdir } from "node:fs/promises";
import { AnalysisCache, checkBudget } from "../../../src/tools/analysis-cache.js";

const TEST_CACHE_ROOT = resolve(process.cwd(), ".cache", "test-analysis");

beforeEach(async () => {
  await rm(TEST_CACHE_ROOT, { recursive: true, force: true }).catch(() => {});
});

afterEach(async () => {
  await rm(TEST_CACHE_ROOT, { recursive: true, force: true }).catch(() => {});
});

test("AnalysisCache correctly reads and writes JSON data", async () => {
  const cache = new AnalysisCache(TEST_CACHE_ROOT);
  const key = await cache.generateKey("1.0", { debug: true }, "test-repo", ["a.js", "b.js"]);

  await cache.set(key, { result: "success" });

  const data = await cache.get(key);
  assert.equal(data.result, "success");
});

test("AnalysisCache returns null for missing keys", async () => {
  const cache = new AnalysisCache(TEST_CACHE_ROOT);
  const data = await cache.get("non-existent-key");
  assert.equal(data, null);
});

test("AnalysisCache recovers from corrupted JSON without crashing", async () => {
  const cache = new AnalysisCache(TEST_CACHE_ROOT);
  const key = await cache.generateKey("1.0", {}, "test-repo", []);

  await mkdir(TEST_CACHE_ROOT, { recursive: true });
  await writeFile(resolve(TEST_CACHE_ROOT, `${key}.json`), "INVALID JSON {", "utf8");

  const data = await cache.get(key);
  assert.equal(data, null); // Gracefully returns null on parse error
});

test("checkBudget identifies exceeded budgets", () => {
  const safe = checkBudget(100, 500);
  assert.equal(safe.exceeded, false);
  assert.equal(safe.lostCoverage, false);

  const exceeded = checkBudget(600, 500);
  assert.equal(exceeded.exceeded, true);
  assert.equal(exceeded.lostCoverage, true);
  assert.match(exceeded.message, /Analysis budget exceeded/);
});
