#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

async function validateRelease() {
  const root = process.cwd();
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
