import { formatTargetError, resolveTargetRoot } from "../src/foundations/targeting.js";
import { buildProgramModel } from "../src/program/program-intelligence.js";

function help() {
  process.stdout.write(`Usage:
  node scan-dependencies.js <target-root> [--scope <relative-path>] [--format json|markdown] [--max-files <count>] [--max-manifest-files <count>] [--max-relation-files <count>] [--max-relation-bytes <count>]

Build a read-only dependency intelligence report from target manifests, lockfiles, and observed
source imports. Installed dependency source remains excluded. Advisory, license, maintenance, and
update checks remain unresolved until a permission-gated current-data operation succeeds.
`);
}

function parse(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const positional = [];
  const options = { format: "json" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) positional.push(argument);
    else {
      const name = argument.slice(2);
      if (
        !new Set([
          "scope",
          "format",
          "max-files",
          "max-manifest-files",
          "max-relation-files",
          "max-relation-bytes",
        ]).has(name)
      )
        throw new Error(`Unknown option: ${argument}`);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      options[name] = value;
      index += 1;
    }
  }
  if (positional.length > 1) throw new Error("Expected exactly one target root");
  if (!new Set(["json", "markdown"]).has(options.format))
    throw new Error("--format must be json or markdown");
  for (const name of [
    "max-files",
    "max-manifest-files",
    "max-relation-files",
    "max-relation-bytes",
  ]) {
    if (options[name] === undefined) continue;
    const value = Number(options[name]);
    const maximum =
      name === "max-relation-bytes"
        ? 2_000_000_000
        : name === "max-manifest-files"
          ? 100_000
          : 1_000_000;
    if (!Number.isInteger(value) || value < 1 || value > maximum)
      throw new Error(`--${name} must be an integer from 1 to ${maximum}`);
    options[name] = value;
  }
  return { targetInput: positional[0], options };
}

function resultFor(model) {
  const direct = model.dependencies.filter((item) => item.direct);
  const transitiveOnly = model.dependencies.filter((item) => !item.direct);
  const used = model.dependencies.filter((item) => item.usedBy.length > 0);
  return {
    schemaVersion: 1,
    generatedAt: model.generatedAt,
    target: model.target,
    status: model.coverage.status,
    coverage: model.coverage,
    summary: {
      declared: model.dependencies.length,
      direct: direct.length,
      transitiveOnly: transitiveOnly.length,
      withObservedSourceUsage: used.length,
      withoutObservedSourceUsage: model.dependencies.length - used.length,
      withLockedVersion: model.dependencies.filter((item) => item.lockedVersions.length > 0).length,
    },
    dependencies: model.dependencies,
    unresolved: [
      "No observed import is not proof of non-use; runtime loading, aliases, generators, plugins, and unsupported languages may hide usage.",
      "Current advisories, licenses, maintenance status, and update distance require permission-gated ecosystem or authoritative network evidence.",
      "Installed dependency source is excluded unless the user approves a targeted deep dive.",
    ],
    nextCapabilityChain: [
      {
        operation: "resolve exact dependency graph",
        preferred: "lockfile adapter",
        fallback: "permission-gated ecosystem-native metadata command",
      },
      {
        operation: "retrieve current risk metadata",
        preferred: "ecosystem advisory and registry APIs",
        fallback: "authoritative package and security documentation",
      },
      {
        operation: "inspect risky implementation details",
        preferred: "targeted installed-package source inspection",
        fallback: "official source repository at the locked version",
      },
    ],
  };
}

function markdown(result) {
  const lines = [
    "# Dependency Intelligence",
    "",
    `Target: \`${result.target.root}\``,
    `Scope: \`${result.target.scope}\``,
    `Coverage: **${result.status}**${result.coverage.reasonCodes.length > 0 ? ` — ${result.coverage.reasonCodes.join(", ")}` : ""}`,
    "",
    `Found ${result.summary.direct} direct and ${result.summary.transitiveOnly} lockfile/transitive-only dependencies; ${result.summary.withObservedSourceUsage} have observed source usage.`,
    "",
    "| Dependency | Direct | Scope | Locked versions | Observed usage files |",
    "| --- | --- | --- | --- | ---: |",
    ...result.dependencies.map(
      (item) =>
        `| ${item.name.replaceAll("|", "\\|")} | ${item.direct ? "yes" : "no"} | ${item.scope} | ${item.lockedVersions.join(", ") || "unresolved"} | ${item.usedBy.length} |`,
    ),
    "",
    "## Unresolved",
    "",
    ...result.unresolved.map((item) => `- ${item}`),
  ];
  return `${lines.join("\n")}\n`;
}

try {
  const { targetInput, options } = parse(process.argv.slice(2));
  const target = await resolveTargetRoot(targetInput);
  const model = await buildProgramModel(target, {
    scope: options.scope,
    maxFiles: options["max-files"],
    maxManifestFiles: options["max-manifest-files"],
    maxRelationFiles: options["max-relation-files"],
    maxRelationBytes: options["max-relation-bytes"],
  });
  const result = resultFor(model);
  process.stdout.write(
    options.format === "json" ? `${JSON.stringify(result, null, 2)}\n` : markdown(result),
  );
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? JSON.stringify({ type: "dependency-scan-failure", reason: error.message })}\n`,
  );
  process.exitCode = 1;
}
