import { z } from "zod";
import { bundledBinary, formatTargetError, resolveTargetRoot, runCommand } from "./lib/tooling.js";

const outputSchema = z.object({
  analyzer: z.literal("jscpd"),
  status: z.literal("succeeded"),
  projectRoot: z.string(),
  excludedSkillPath: z.string().optional(),
  report: z.string(),
});

function printHelp() {
  process.stdout.write("Usage: node scan-duplication.js <target-project-directory>\n\n");
  process.stdout.write("Run bundled jscpd with its token-efficient AI reporter.\n");
}

try {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  if (args.length > 1) throw new Error("Expected exactly one target project directory");
  const target = await resolveTargetRoot(args[0]);
  const projectRoot = target.targetRoot;
  const command = bundledBinary("jscpd");
  if (!command)
    throw new Error("bundled jscpd binary is missing; install the skill dependencies and retry");
  const result = await runCommand(
    command,
    [
      "--reporters",
      "ai",
      "--mode",
      "weak",
      "--min-lines",
      "6",
      "--min-tokens",
      "50",
      "--no-colors",
      "--no-tips",
      "--ignore",
      [
        "**/.git/**",
        "**/.repay-techdebt/**",
        "**/.serena/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/graphify-out/**",
        "**/repomix-output.*",
        target.relativeSkillRoot ? `${target.relativeSkillRoot}/**` : null,
      ]
        .filter(Boolean)
        .join(","),
      projectRoot,
    ],
    { cwd: projectRoot, timeout: 120_000, maxBuffer: 20 * 1024 * 1024 },
  );
  if (!result.ok) throw new Error(result.reason || "jscpd failed");
  const output = outputSchema.parse({
    analyzer: "jscpd",
    status: "succeeded",
    projectRoot,
    excludedSkillPath: target.relativeSkillRoot ?? undefined,
    report: result.stdout.trim() || "No duplication reported.",
  });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? `Duplication scan failed: ${error.message}`}\n`,
  );
  process.exitCode = 1;
}
