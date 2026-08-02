import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine } from "@secretlint/node";
import { globby } from "globby";
import pLimit from "p-limit";
import { Piscina } from "piscina";
import { z } from "zod";
import { buildDialogueEnvelope } from "./lib/dialogue-envelope.js";
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
  process.stdout.write(`Usage:
  node find-patterns.js <target-project-directory> --scope <relative-path>
  node find-patterns.js <target-project-directory> --all

Teaching-lead scanner for JS/TS/Python (Acorn, ts-morph, ast-grep). Not a workbook driver.
Requires --scope for a focused gap-fill, or explicit --all for a whole-repo lead pass.
Output is teachingLeads with notExhaustive=true; verify selected leads in live source.
`);
}

function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const positional = [];
  const options = { scope: null, all: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const name = argument.slice(2);
    if (name === "all") options.all = true;
    else if (name === "scope") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --scope");
      options.scope = value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (positional.length !== 1) throw new Error("Expected exactly one target project directory");
  if (!options.all && !options.scope)
    throw new Error(
      "find-patterns requires --scope <relative-path> for gap-fill leads, or --all for an explicit whole-repo teaching-lead pass",
    );
  if (options.all && options.scope)
    throw new Error("Use either --scope or --all, not both");
  return { targetInput: positional[0], options };
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
  const { targetInput, options } = parseArguments(process.argv.slice(2));
  const target = await resolveTargetRoot(targetInput);
  const projectRoot = target.targetRoot;
  projectRootForMessages = projectRoot;
  const scopeIgnore = [...IGNORES, ...(target.relativeSkillRoot ? [`${target.relativeSkillRoot}/**`] : [])];
  const globRoot = options.scope ? resolve(projectRoot, options.scope) : projectRoot;
  const files = await globby(SOURCE_GLOBS, {
    absolute: false,
    cwd: globRoot,
    dot: true,
    followSymbolicLinks: false,
    gitignore: true,
    ignore: scopeIgnore,
    onlyFiles: true,
  });
  const prefixed = options.scope
    ? files.map((file) => `${options.scope}/${file}`.replaceAll("\\", "/"))
    : files.map((file) => file.replaceAll("\\", "/"));
  if (prefixed.length === 0) {
    process.stderr.write(
      `${JSON.stringify({
        type: "tool-failure",
        tool: "bundled-pattern-scanner",
        reason: "no supported JavaScript, TypeScript, or Python files were found in scope",
        fallback: "ask before manually inspecting representative files in the detected languages",
      })}\n`,
    );
    process.exit(2);
  }
  const piscina = new Piscina({
    filename: fileURLToPath(new URL("./pattern-worker.js", import.meta.url)),
    maxThreads: Math.max(1, Math.min(availableParallelism(), prefixed.length, 4)),
  });
  const batches = await Promise.all(
    prefixed
      .sort()
      .map((file) =>
        piscina.run({ absolutePath: resolve(projectRoot, file), file }),
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
  const dialogue = buildDialogueEnvelope({
    role: "retrieve",
    extraBlindSpots: [
      "catalog-is-not-exhaustive",
      "dynamic-and-framework-specific-patterns",
    ],
    extraMustNotClaim: ["complete-teaching-surface", "defect-proof"],
    extraNextAsks: [
      {
        who: "agent",
        do: "verify-selected-leads-in-source",
        why: "teaching-leads-only",
      },
    ],
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        analyzer: "bundled-pattern-scanner",
        status: "succeeded",
        role: dialogue.role,
        notExhaustive: true,
        scope: options.scope ?? ".",
        wholeRepo: Boolean(options.all),
        projectRoot,
        excludedSkillPath: target.relativeSkillRoot,
        scannedFiles: prefixed.length,
        teachingLeads: z.array(findingSchema).parse(safeFindings),
        findings: z.array(findingSchema).parse(safeFindings),
        blindSpots: dialogue.blindSpots,
        mustNotClaim: dialogue.mustNotClaim,
        nextAsks: dialogue.nextAsks,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  process.stderr.write(`${formatTargetError(error) ?? `Pattern scan failed: ${error.message}`}\n`);
  process.exitCode = 1;
}
