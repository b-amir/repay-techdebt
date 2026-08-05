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
    process.stderr.write(`Could not read fixtures directory: ${fixturesDir} ${e}\n`);
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
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
  } else {
    process.stdout.write("# Evaluation Report\n\n");
    for (const res of results) {
      process.stdout.write(`## Fixture: ${res.fixture}\n`);
      if (res.error) {
        process.stdout.write(`- **Error:** ${res.error}\n`);
        continue;
      }

      const { evaluation } = res;
      process.stdout.write(`- Status: ${evaluation.ok ? "✅ PASS" : "❌ FAIL"}\n`);
      process.stdout.write(`- Expected Must-Find: ${evaluation.totalExpected}\n`);
      process.stdout.write(`- Total Generated Topics: ${evaluation.totalGenerated}\n`);

      if (evaluation.missingMustFind.length > 0) {
        process.stdout.write(`- Missing Must-Find Topics:\n`);
        for (const t of evaluation.missingMustFind) {
          process.stdout.write(`  - \`${t.id}\`: ${t.description}\n`);
        }
      }

      if (evaluation.presentForbidden.length > 0) {
        process.stdout.write(`- Present Forbidden Topics:\n`);
        for (const t of evaluation.presentForbidden) {
          process.stdout.write(`  - \`${t.id}\`: ${t.description}\n`);
        }
      }
      process.stdout.write("\n");
    }
  }

  const failed = results.some((r) => r.error || (r.evaluation && !r.evaluation.ok));
  process.exit(failed ? 1 : 0);
}

main().catch((err) => process.stderr.write(`${err.stack || err}\n`));
