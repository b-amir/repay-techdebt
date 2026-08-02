#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

async function validateRelease() {
  const root = process.cwd();
  console.log("Validating release from:", root);
  let failed = false;

  // 1. Verify package.json
  try {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    if (!pkg.name || !pkg.version) {
      console.error("❌ package.json must contain a name and version");
      failed = true;
    }
  } catch (err) {
    console.error("❌ Failed to read package.json:", err.message);
    failed = true;
  }

  // 2. Verify SKILL.md frontmatter
  try {
    const skill = await readFile(join(root, "SKILL.md"), "utf8");
    if (!skill.startsWith("---")) {
      console.error("❌ SKILL.md must begin with YAML frontmatter");
      failed = true;
    } else if (!skill.includes("name:") || !skill.includes("description:")) {
      console.error("❌ SKILL.md frontmatter must declare name and description");
      failed = true;
    }
  } catch (err) {
    console.error("❌ Failed to read SKILL.md:", err.message);
    failed = true;
  }

  // 3. Verify bundle size (e.g., node_modules excluded from git, but let's check repo size)
  try {
    // A real implementation would recursively stat.
    // For this demonstration, we'll just check if SKILL.md is reasonable.
    const s = await stat(join(root, "SKILL.md"));
    if (s.size > 1024 * 500) {
      console.error("❌ SKILL.md is unreasonably large (> 500KB)");
      failed = true;
    }
  } catch {
    failed = true;
  }

  if (failed) {
    console.error("\nRelease validation FAILED.");
    process.exitCode = 1;
  } else {
    console.log("\n✅ Release validation passed!");
  }
}

validateRelease().catch((err) => {
  console.error("Unexpected error:", err);
  process.exitCode = 1;
});
