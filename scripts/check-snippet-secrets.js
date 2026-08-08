import { readFile, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { createEngine } from "@secretlint/node";
import {
  formatTargetError,
  isSameOrInside,
  resolveTargetRoot,
  skillRoot,
  TargetRootError,
} from "../src/tools/tooling.js";

function printHelp() {
  process.stdout.write(
    "Usage: node check-snippet-secrets.js <target-project-directory> <application-source-file> [--format json|text]\n\n",
  );
  process.stdout.write(
    "Scan verified application source used by a lesson snippet and mask detected secret values in diagnostics.\n",
  );
}

try {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  let format = "json";
  const formatIndex = args.indexOf("--format");
  if (formatIndex >= 0) {
    format = args[formatIndex + 1];
    args.splice(formatIndex, 2);
  }
  if (!new Set(["json", "text"]).has(format)) throw new Error("--format must be json or text");
  if (args.length > 2)
    throw new Error("Expected a target project directory and exactly one file path");
  const target = await resolveTargetRoot(args[0]);
  if (!args[1]) throw new Error("Expected exactly one snippet file path after the target root");
  const filePath = await realpath(resolve(args[1]));
  const canonicalSkillRoot = await realpath(skillRoot);
  const memoryRoot = resolve(target.targetRoot, ".repay-techdebt");
  if (
    !isSameOrInside(filePath, target.targetRoot) ||
    isSameOrInside(filePath, canonicalSkillRoot) ||
    isSameOrInside(filePath, memoryRoot)
  ) {
    throw new TargetRootError(
      "The snippet must belong to target application source and must not belong to the skill installation or project memory.",
      "SNIPPET_NOT_APPLICATION_SOURCE",
      {
        requestedFile: filePath,
        requestedTarget: target.targetRoot,
        requiredAction:
          "Select a verified application-source file inside the target and outside .repay-techdebt and the skill installation.",
        fallback: "skip the snippet rather than using saved memory as code evidence",
      },
    );
  }
  const content = await readFile(filePath, "utf8");
  const engine = await createEngine({
    color: false,
    configFilePath: resolve(skillRoot, ".secretlintrc.json"),
    cwd: skillRoot,
    formatter: "compact",
    maskSecrets: true,
    terminalLink: false,
  });
  const result = await engine.executeOnContent({ content, filePath });
  const payload = {
    analyzer: "secretlint",
    projectRoot: target.targetRoot,
    file: relative(target.targetRoot, filePath).replaceAll("\\", "/"),
    ok: result.ok,
    diagnostics: result.output.trim(),
  };
  process.stdout.write(
    format === "text"
      ? `${payload.ok ? "PASS" : "FAIL"}: ${payload.file}${payload.diagnostics ? `\n${payload.diagnostics}` : ""}\n`
      : `${JSON.stringify(payload, null, 2)}\n`,
  );
  if (!result.ok) process.exitCode = 2;
} catch (error) {
  process.stderr.write(`${formatTargetError(error) ?? `Secret check failed: ${error.message}`}\n`);
  process.exitCode = 1;
}
