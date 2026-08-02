#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCurriculum } from "../src/evaluation/evaluation.js";
import { validateFixture } from "../src/evaluation/evaluation-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "..", "test", "fixtures", "evaluation");

async function main() {
  const args = process.argv.slice(2);
  const format = args.includes("--json") ? "json" : "markdown";

  let entries;
  try {
    entries = await fs.readdir(fixturesDir, { withFileTypes: true });
  } catch (e) {
    console.error(`Could not read fixtures directory: ${fixturesDir} ${e}`);
    process.exit(1);
  }

  const directories = entries.filter((e) => e.isDirectory());
  const results = [];

  for (const dir of directories) {
    const expectationsPath = path.join(fixturesDir, dir.name, "expectations.json");
    let content;
    try {
      content = await fs.readFile(expectationsPath, "utf-8");
    } catch {
      continue;
    }

    const json = JSON.parse(content);
    const parsed = validateFixture(json);
    if (!parsed.ok) {
      results.push({ fixture: dir.name, error: "Invalid fixture schema" });
      continue;
    }

    // In a real run, we would generate the curriculum by analyzing the fixture's codebase
    // For now we mock an empty curriculum to test the runner framework
    const mockCurriculum = { topics: [] };
    const evaluation = evaluateCurriculum(mockCurriculum, parsed.data);

    results.push({
      fixture: dir.name,
      evaluation,
    });
  }

  if (format === "json") {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log("# Evaluation Report\n");
    for (const res of results) {
      console.log(`## Fixture: ${res.fixture}`);
      if (res.error) {
        console.log(`- **Error:** ${res.error}`);
        continue;
      }

      const { evaluation } = res;
      console.log(`- Status: ${evaluation.ok ? "✅ PASS" : "❌ FAIL"}`);
      console.log(`- Expected Must-Find: ${evaluation.totalExpected}`);
      console.log(`- Total Generated Topics: ${evaluation.totalGenerated}`);

      if (evaluation.missingMustFind.length > 0) {
        console.log(`- Missing Must-Find Topics:`);
        for (const t of evaluation.missingMustFind) {
          console.log(`  - \`${t.id}\`: ${t.description}`);
        }
      }

      if (evaluation.presentForbidden.length > 0) {
        console.log(`- Present Forbidden Topics:`);
        for (const t of evaluation.presentForbidden) {
          console.log(`  - \`${t.id}\`: ${t.description}`);
        }
      }
      console.log();
    }
  }

  const failed = results.some((r) => r.error || (r.evaluation && !r.evaluation.ok));
  process.exit(failed ? 1 : 0);
}

main().catch(console.error);
