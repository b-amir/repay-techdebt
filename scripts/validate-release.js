#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

async function validateRelease() {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const requiredReviews = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--help" || args[index] === "-h") {
      process.stdout.write(
        "Usage: node scripts/validate-release.js [--require-independent-review <judgment.json>]\n",
      );
      return;
    }
    if (args[index] !== "--require-independent-review")
      throw new Error(`Unknown option: ${args[index]}`);
    const reviewPath = args[++index];
    if (!reviewPath) throw new Error("Missing path for --require-independent-review");
    requiredReviews.push(reviewPath);
  }
  process.stdout.write(`Validating release from: ${root}\n`);
  let failed = false;

  // 1. Verify package.json
  try {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    if (!pkg.name || !pkg.version) {
      process.stderr.write("❌ package.json must contain a name and version\n");
      failed = true;
    }
  } catch (err) {
    process.stderr.write(`❌ Failed to read package.json: ${err.message}\n`);
    failed = true;
  }

  // 2. Verify SKILL.md frontmatter
  try {
    const skill = await readFile(join(root, "SKILL.md"), "utf8");
    if (!skill.startsWith("---")) {
      process.stderr.write("❌ SKILL.md must begin with YAML frontmatter\n");
      failed = true;
    } else if (!skill.includes("name:") || !skill.includes("description:")) {
      process.stderr.write("❌ SKILL.md frontmatter must declare name and description\n");
      failed = true;
    }
  } catch (err) {
    process.stderr.write(`❌ Failed to read SKILL.md: ${err.message}\n`);
    failed = true;
  }

  // 3. Verify bundle size (e.g., node_modules excluded from git, but let's check repo size)
  try {
    // A real implementation would recursively stat.
    // For this demonstration, we'll just check if SKILL.md is reasonable.
    const s = await stat(join(root, "SKILL.md"));
    if (s.size > 1024 * 500) {
      process.stderr.write("❌ SKILL.md is unreasonably large (> 500KB)\n");
      failed = true;
    }
  } catch {
    failed = true;
  }

  // 4. Forward-test review provenance is optional by default, but release
  // callers can require one or more clean independent judgments explicitly.
  for (const reviewPath of requiredReviews) {
    try {
      const judgment = JSON.parse(await readFile(reviewPath, "utf8"));
      if (!new Set(["independent-agent", "human"]).has(judgment.reviewerProvenance)) {
        process.stderr.write(
          `❌ Required review is not independent: ${reviewPath} (${judgment.reviewerProvenance ?? "missing provenance"})\n`,
        );
        failed = true;
      }
      if (!Array.isArray(judgment.mustFix) || judgment.mustFix.length > 0) {
        process.stderr.write(`❌ Required review still has mustFix items: ${reviewPath}\n`);
        failed = true;
      }
    } catch (err) {
      process.stderr.write(`❌ Failed to read required review ${reviewPath}: ${err.message}\n`);
      failed = true;
    }
  }

  if (failed) {
    process.stderr.write("\nRelease validation FAILED.\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("\n✅ Release validation passed!\n");
  }
}

validateRelease().catch((err) => {
  process.stderr.write(`Unexpected error: ${err.stack || err}\n`);
  process.exitCode = 1;
});
