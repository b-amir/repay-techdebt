#!/usr/bin/env node
import { AnalysisCache, checkBudget } from "../src/tools/analysis-cache.js";
import { resolve } from "node:path";

async function run() {
  const cacheRoot = resolve(process.cwd(), ".cache", "repay-benchmark");
  const cache = new AnalysisCache(cacheRoot);

  const sizes = [
    {
      name: "1k",
      files: Array.from({ length: 1000 }, (_, i) => `src/file_${i}.js`),
      budgetMs: 500,
    },
    {
      name: "10k",
      files: Array.from({ length: 10000 }, (_, i) => `src/file_${i}.js`),
      budgetMs: 2000,
    },
  ];

  for (const size of sizes) {
    console.log(`\nBenchmarking ${size.name} repo...`);

    // Cold start
    const coldStart = Date.now();
    const key = await cache.generateKey("1.0", {}, `repo-${size.name}`, size.files);
    let data = await cache.get(key);

    if (!data) {
      data = { analyzedFiles: size.files.length, time: new Date().toISOString() };
      // Simulate analysis delay
      await new Promise((r) => setTimeout(r, 100));
      await cache.set(key, data);
    }
    const coldDuration = Date.now() - coldStart;
    const coldBudget = checkBudget(coldDuration, size.budgetMs);
    console.log(`  Cold: ${coldBudget.message}`);

    // Warm start
    const warmStart = Date.now();
    const warmKey = await cache.generateKey("1.0", {}, `repo-${size.name}`, size.files);
    const warmData = await cache.get(warmKey);
    const warmDuration = Date.now() - warmStart;
    const warmBudget = checkBudget(warmDuration, size.budgetMs / 4); // warm should be much faster
    console.log(`  Warm: ${warmBudget.message}`);

    if (!warmData) {
      console.error("  Error: Cache failed to retrieve data.");
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
