import { resolve } from "node:path";
import { createEngine } from "@secretlint/node";
import { globby } from "globby";
import { z } from "zod";
import {
  formatTargetError,
  resolveTargetRoot,
  runCommand,
  skillRoot,
} from "../src/tools/tooling.js";

const semgrepSchema = z.object({
  results: z.array(
    z.object({
      check_id: z.string(),
      path: z.string(),
      start: z.object({ line: z.number().int() }),
      extra: z.object({
        message: z.string(),
        severity: z.string().optional(),
      }),
    }),
  ),
  errors: z.array(z.unknown()).optional(),
});

function printHelp() {
  process.stdout.write(
    "Usage: node scan-security.js <target-project-directory> [--fallback secretlint]\n\n",
  );
  process.stdout.write(
    "Try Semgrep first. A failure exits with code 2 unless the user explicitly accepted Secretlint fallback.\n",
  );
}

function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  let fallback = null;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--fallback") {
      fallback = argv[index + 1];
      index += 1;
    } else positional.push(argv[index]);
  }
  if (fallback !== null && fallback !== "secretlint")
    throw new Error("--fallback currently accepts only secretlint");
  if (positional.length > 1) throw new Error("Expected exactly one target project directory");
  return { fallback, targetInput: positional[0] };
}

async function runSemgrep(projectRoot, relativeSkillRoot) {
  const skillExclusion = relativeSkillRoot ? ["--exclude", `${relativeSkillRoot}/**`] : [];
  const result = await runCommand(
    "semgrep",
    [
      "scan",
      "--config",
      "auto",
      "--json",
      "--metrics",
      "off",
      "--exclude",
      "node_modules",
      "--exclude",
      "dist",
      "--exclude",
      "build",
      "--exclude",
      ".repay-techdebt",
      "--exclude",
      "graphify-out",
      "--exclude",
      ".serena",
      "--exclude",
      "repomix-output.*",
      ...skillExclusion,
      projectRoot,
    ],
    { cwd: projectRoot, timeout: 180_000, maxBuffer: 50 * 1024 * 1024 },
  );
  if (!result.ok) return { ok: false, reason: result.reason || "Semgrep failed" };
  try {
    const parsed = semgrepSchema.parse(JSON.parse(result.stdout));
    return {
      ok: true,
      findings: parsed.results.map((finding) => ({
        rule: finding.check_id,
        file: finding.path,
        line: finding.start.line,
        severity: finding.extra.severity ?? "unknown",
        message: finding.extra.message,
      })),
      engineErrors: parsed.errors?.length ?? 0,
    };
  } catch (error) {
    return {
      ok: false,
      reason: `Semgrep returned invalid JSON: ${error.message}`,
    };
  }
}

async function runSecretlint(projectRoot, relativeSkillRoot) {
  const files = await globby(
    ["**/*.{env,ini,json,jsonc,toml,yaml,yml,js,jsx,ts,tsx,py,rb,go,java,kt,rs,php,cs,sh}"],
    {
      absolute: true,
      cwd: projectRoot,
      dot: true,
      followSymbolicLinks: false,
      gitignore: true,
      ignore: [
        "**/.git/**",
        "**/.repay-techdebt/**",
        "**/.serena/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/coverage/**",
        "**/graphify-out/**",
        "**/repomix-output.*",
        ...(relativeSkillRoot ? [`${relativeSkillRoot}/**`] : []),
      ],
      onlyFiles: true,
    },
  );
  const engine = await createEngine({
    color: false,
    configFilePath: resolve(skillRoot, ".secretlintrc.json"),
    cwd: projectRoot,
    formatter: "compact",
    maskSecrets: true,
    terminalLink: false,
  });
  const result = await engine.executeOnFiles({ filePathList: files });
  return {
    ok: result.ok,
    diagnostics: result.output.trim(),
    scannedFiles: files.length,
  };
}

try {
  const options = parseArguments(process.argv.slice(2));
  const target = await resolveTargetRoot(options.targetInput);
  const semgrep = await runSemgrep(target.targetRoot, target.relativeSkillRoot);
  if (!semgrep.ok && options.fallback !== "secretlint") {
    process.stderr.write(
      `${JSON.stringify({
        type: "tool-failure",
        tool: "semgrep",
        reason: semgrep.reason,
        setup: "uv tool install semgrep",
        fallback:
          "rerun with --fallback secretlint only after the user accepts; manually verify security control flow",
      })}\n`,
    );
    process.exit(2);
  }
  if (semgrep.ok) {
    process.stdout.write(
      `${JSON.stringify(
        {
          analyzer: "semgrep",
          status: "succeeded",
          projectRoot: target.targetRoot,
          excludedSkillPath: target.relativeSkillRoot,
          ...semgrep,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    const fallback = await runSecretlint(target.targetRoot, target.relativeSkillRoot);
    process.stdout.write(
      `${JSON.stringify(
        {
          analyzer: "secretlint",
          status: "fallback-succeeded",
          semgrepFailure: semgrep.reason,
          limitations:
            "Secretlint detects credential exposure only; security claims still require manual control-flow verification.",
          projectRoot: target.targetRoot,
          excludedSkillPath: target.relativeSkillRoot,
          ...fallback,
        },
        null,
        2,
      )}\n`,
    );
  }
} catch (error) {
  process.stderr.write(`${formatTargetError(error) ?? `Security scan failed: ${error.message}`}\n`);
  process.exitCode = 1;
}
