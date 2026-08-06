#!/usr/bin/env node

/**
 * Score curriculum/lesson fixtures for skill evaluation.
 * Empty-mock curriculum cannot green when must-find topics exist.
 * Fixture trees live under the skill repo; code surfaces are copied to a temp
 * target outside the skill so resolveTargetRoot accepts them.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { evaluateCurriculum } from "../src/evaluation/evaluation.js";
import { validateFixture } from "../src/evaluation/evaluation-schema.js";
import { planCurriculum } from "../src/curriculum/curriculum-planning.js";
import { buildProgramModel } from "../src/program/program-intelligence.js";
import { resolveTargetRoot } from "../src/foundations/targeting.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "..", "test", "fixtures", "evaluation");

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** True if dir has any non-meta content that can model a program. */
async function hasCodeSurface(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "expectations.json" || e.name === "curriculum.json" || e.name === "lesson.md") {
      continue;
    }
    return true;
  }
  return false;
}

async function loadCurriculumForFixture(dirPath) {
  const curriculumPath = path.join(dirPath, "curriculum.json");
  if (await pathExists(curriculumPath)) {
    return {
      source: "curriculum.json",
      curriculum: JSON.parse(await fs.readFile(curriculumPath, "utf-8")),
    };
  }
  if (await hasCodeSurface(dirPath)) {
    // Fixtures live inside skill → copy to temp target outside skill root.
    const tempRoot = await mkdtemp(path.join(tmpdir(), "repay-eval-skill-"));
    try {
      await cp(dirPath, tempRoot, {
        recursive: true,
        filter: (src) => {
          const base = path.basename(src);
          return base !== "expectations.json" && base !== "lesson.md";
        },
      });
      const target = await resolveTargetRoot(tempRoot);
      const model = await buildProgramModel(target);
      return { source: "planCurriculum", curriculum: planCurriculum(model) };
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
  return { source: "empty", curriculum: { topics: [] } };
}

async function main() {
  const args = process.argv.slice(2);
  const format = args.includes("--json") ? "json" : "markdown";
  const allowEmptyMock = args.includes("--allow-empty-mock");

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
    const dirPath = path.join(fixturesDir, dir.name);
    const expectationsPath = path.join(dirPath, "expectations.json");
    let content;
    try {
      content = await fs.readFile(expectationsPath, "utf-8");
    } catch {
      continue;
    }

    let parsed;
    try {
      const json = JSON.parse(content);
      parsed = validateFixture(json);
    } catch (e) {
      results.push({ fixture: dir.name, error: `Invalid fixture JSON: ${e.message}` });
      continue;
    }
    if (!parsed.ok) {
      results.push({ fixture: dir.name, error: "Invalid fixture schema" });
      continue;
    }

    const mustFind = (parsed.data.topics ?? []).filter((t) => t.intent === "must-find");
    let source;
    let curriculum;
    try {
      ({ source, curriculum } = await loadCurriculumForFixture(dirPath));
    } catch (e) {
      results.push({
        fixture: dir.name,
        error: `curriculum-load-failed: ${e.message}`,
        evaluation: {
          ok: false,
          missingMustFind: mustFind,
          presentForbidden: [],
          totalExpected: mustFind.length,
          totalGenerated: 0,
        },
      });
      continue;
    }

    // Kill empty-mock green: non-empty must-find + empty topics is hard fail unless explicit allow.
    if (
      !allowEmptyMock &&
      mustFind.length > 0 &&
      (!curriculum.topics || curriculum.topics.length === 0)
    ) {
      results.push({
        fixture: dir.name,
        source,
        error: "empty-mock-blocked: must-find topics exist but curriculum has zero topics",
        evaluation: {
          ok: false,
          missingMustFind: mustFind,
          presentForbidden: [],
          totalExpected: mustFind.length,
          totalGenerated: 0,
        },
      });
      continue;
    }

    const evaluation = evaluateCurriculum(curriculum, parsed.data);
    results.push({
      fixture: dir.name,
      source,
      topicCount: curriculum.topics?.length ?? 0,
      evaluation,
    });
  }

  if (format === "json") {
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
  } else {
    process.stdout.write("# Evaluation Report\n\n");
    for (const res of results) {
      process.stdout.write(`## Fixture: ${res.fixture}\n`);
      if (res.source) process.stdout.write(`- Curriculum source: ${res.source}\n`);
      if (res.error) {
        process.stdout.write(`- **Error:** ${res.error}\n`);
        if (res.evaluation) {
          process.stdout.write(`- Status: ❌ FAIL\n`);
          process.stdout.write(`- Expected Must-Find: ${res.evaluation.totalExpected}\n`);
          process.stdout.write(`- Total Generated Topics: ${res.evaluation.totalGenerated}\n`);
        }
        process.stdout.write("\n");
        continue;
      }

      const { evaluation } = res;
      process.stdout.write(`- Status: ${evaluation.ok ? "✅ PASS" : "❌ FAIL"}\n`);
      process.stdout.write(`- Expected Must-Find: ${evaluation.totalExpected}\n`);
      process.stdout.write(`- Total Generated Topics: ${evaluation.totalGenerated}\n`);
      if (typeof res.topicCount === "number") {
        process.stdout.write(`- Curriculum topic count: ${res.topicCount}\n`);
      }

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

main().catch((err) => {
  process.stderr.write(`${err.stack || err}\n`);
  process.exit(1);
});
