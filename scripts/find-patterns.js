import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine } from "@secretlint/node";
import { globby } from "globby";
import pLimit from "p-limit";
import { Piscina } from "piscina";
import { z } from "zod";
import { formatTargetError, resolveTargetRoot, skillRoot } from "./lib/tooling.js";

const SOURCE_GLOBS = ["**/*.{js,jsx,ts,tsx,py}"];
const IGNORES = [
  "**/.git/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.repay-techdebt/**",
  "**/.svelte-kit/**",
  "**/.serena/**",
  "**/.venv/**",
  "**/__pycache__/**",
  "**/build/**",
  "**/coverage/**",
  "**/dist/**",
  "**/graphify-out/**",
  "**/node_modules/**",
  "**/out/**",
  "**/repomix-output.*",
];
const findingSchema = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  pattern: z.string(),
  snippet: z.string(),
  analyzer: z.enum(["acorn", "ast-grep", "ts-morph"]),
  secretRisk: z.boolean().optional(),
});

function printHelp() {
  process.stdout.write("Usage: node find-patterns.js <target-project-directory>\n\n");
  process.stdout.write(
    "Scan JavaScript, TypeScript, and Python with Acorn, ts-morph, and ast-grep workers.\n",
  );
  process.stdout.write("Candidate snippets are checked with Secretlint before output.\n");
}

function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  if (argv.length > 1) throw new Error("Expected exactly one target project directory");
  return argv[0];
}

async function maskSecretCandidates(findings) {
  const engine = await createEngine({
    color: false,
    configFilePath: resolve(skillRoot, ".secretlintrc.json"),
    cwd: skillRoot,
    formatter: "compact",
    maskSecrets: true,
    terminalLink: false,
  });
  const limit = pLimit(8);
  return Promise.all(
    findings.map((finding) =>
      limit(async () => {
        const checked = await engine.executeOnContent({
          content: finding.snippet,
          filePath: resolve(projectRootForMessages, finding.file),
        });
        return checked.ok
          ? finding
          : {
              ...finding,
              snippet: "[redacted: Secretlint detected a possible secret]",
              secretRisk: true,
            };
      }),
    ),
  );
}

let projectRootForMessages;

try {
  const target = await resolveTargetRoot(parseArguments(process.argv.slice(2)));
  const projectRoot = target.targetRoot;
  projectRootForMessages = projectRoot;
  const files = await globby(SOURCE_GLOBS, {
    absolute: false,
    cwd: projectRoot,
    dot: true,
    followSymbolicLinks: false,
    gitignore: true,
    ignore: [...IGNORES, ...(target.relativeSkillRoot ? [`${target.relativeSkillRoot}/**`] : [])],
    onlyFiles: true,
  });
  if (files.length === 0) {
    process.stderr.write(
      `${JSON.stringify({
        type: "tool-failure",
        tool: "bundled-pattern-scanner",
        reason: "no supported JavaScript, TypeScript, or Python files were found",
        fallback: "ask before manually inspecting representative files in the detected languages",
      })}\n`,
    );
    process.exit(2);
  }
  const piscina = new Piscina({
    filename: fileURLToPath(new URL("./pattern-worker.js", import.meta.url)),
    maxThreads: Math.max(1, Math.min(availableParallelism(), files.length, 4)),
  });
  const batches = await Promise.all(
    files
      .sort()
      .map((file) =>
        piscina.run({ absolutePath: resolve(projectRoot, file), file: file.replaceAll("\\", "/") }),
      ),
  );
  await piscina.close();
  const findings = batches.flatMap((batch) => batch.findings);
  for (const batch of batches) {
    if (batch.warning) process.stderr.write(`${batch.warning}\n`);
  }
  const safeFindings = await maskSecretCandidates(findings);
  safeFindings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.pattern.localeCompare(right.pattern),
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        analyzer: "bundled-pattern-scanner",
        status: "succeeded",
        projectRoot,
        excludedSkillPath: target.relativeSkillRoot,
        scannedFiles: files.length,
        findings: z.array(findingSchema).parse(safeFindings),
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  process.stderr.write(`${formatTargetError(error) ?? `Pattern scan failed: ${error.message}`}\n`);
  process.exitCode = 1;
}
