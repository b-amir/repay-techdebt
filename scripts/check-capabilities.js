import {
  capabilityReportSchema,
  capabilitySchema,
  formatTargetError,
  formatCapabilityTable,
  probeCommand,
  resolveTargetRoot,
} from "./lib/tooling.js";
import { projectStoragePaths } from "./lib/private-storage.js";

const DEFINITIONS = [
  {
    id: "graphify",
    label: "Graphify CLI",
    command: "graphify",
    phase: "architecture and impact",
    detail: "",
    setup: [
      'uv tool install "graphifyy[mcp]"',
      "node <skill-root>/scripts/run-graphify.js extract <target-root> --yes",
    ],
    fallback: "bundled normalized relation query; dependency-cruiser for JavaScript/TypeScript",
    installationScope: "user-isolated",
    artifactScope: "private-cache",
    targetMutationRisk: "none",
  },
  {
    id: "serena",
    label: "Serena CLI/MCP",
    command: "serena",
    phase: "symbol verification",
    detail: "",
    setup: [
      "uv tool install -p 3.13 serena-agent",
      "configure user-level project_serena_folder_location under the reported private cache",
      'activate Serena for "<target-root>" without target-local .serena state',
      "configure Serena MCP in the active agent",
    ],
    fallback: "bundled relation query plus ts-morph, ast-grep, and direct source verification",
    installationScope: "user-isolated",
    artifactScope: "private-cache",
    targetMutationRisk: "avoidable",
  },
  {
    id: "semgrep",
    label: "Semgrep CLI/MCP",
    command: "semgrep",
    phase: "security verification",
    detail: "",
    setup: ["uv tool install semgrep", "configure Semgrep MCP in the active agent if desired"],
    fallback: "Secretlint plus manual control-flow verification",
    installationScope: "user-isolated",
    artifactScope: "stdout",
    targetMutationRisk: "none",
  },
  {
    id: "context7",
    label: "Context7 CLI/MCP",
    command: "ctx7",
    phase: "authoritative documentation",
    detail: "",
    setup: ["npm install -g ctx7@latest", "ctx7 setup"],
    fallback: "official documentation search",
    installationScope: "user-isolated",
    artifactScope: "agent-user-config",
    targetMutationRisk: "none",
  },
  {
    id: "repomix",
    label: "Repomix CLI/MCP",
    command: "repomix",
    phase: "large or remote repositories",
    detail: "",
    setup: [
      "npm install -g repomix",
      "configure Repomix MCP only when persistent access is useful",
    ],
    fallback: "scoped file discovery and prioritized modules",
    installationScope: "user-isolated",
    artifactScope: "stdout",
    targetMutationRisk: "none",
  },
];

const MCP_CAPABILITIES = [
  {
    id: "github-mcp",
    label: "GitHub MCP",
    phase: "PR metadata and CI",
    kind: "agent-mcp",
    status: "agent-check-required",
    detail: "local scripts cannot inspect the active agent's MCP tool inventory",
    setup: ["configure GitHub's official MCP server in read-only mode with minimal toolsets"],
    fallback: "local read-only Git analysis",
    installationScope: "agent-user-config",
    artifactScope: "agent-user-config",
    targetMutationRisk: "none",
  },
  {
    id: "agent-mcp-inventory",
    label: "Active agent MCP inventory",
    phase: "all enhanced phases",
    kind: "agent-mcp",
    status: "agent-check-required",
    detail:
      "the executing agent must report whether Graphify, Serena, Semgrep, Context7, Repomix, and GitHub tools are exposed",
    setup: [
      "open the active agent's MCP configuration and enable only the required read-only tools",
    ],
    fallback: "corresponding CLI or bundled analyzer",
    installationScope: "agent-user-config",
    artifactScope: "agent-user-config",
    targetMutationRisk: "none",
  },
];

const FALLBACK_CHAINS = {
  graphify: [
    {
      tool: "Graphify CLI",
      operation: "query an existing target graph",
      limitation: "Requires a current graph in Repay Tech Debt's external private cache.",
      requiresPermission: false,
    },
    {
      tool: "compiler or language server",
      operation: "resolve language-specific symbols and references",
      limitation: "Limited to configured languages and build targets.",
      requiresPermission: false,
    },
    {
      tool: "bundled AST relationship graph",
      operation: "resolve conservative local dependencies",
      limitation:
        "May miss reflection, dependency injection, generated code, events, and remote calls.",
      requiresPermission: true,
    },
    {
      tool: "scoped tree and search",
      operation: "outline candidate modules",
      limitation: "Structural names do not prove executable relationships.",
      requiresPermission: true,
    },
  ],
  serena: [
    {
      tool: "Serena MCP",
      operation: "resolve target-scoped symbols and references",
      limitation: "Requires the correct active target and exclusions.",
      requiresPermission: false,
    },
    {
      tool: "compiler or language server",
      operation: "resolve exact language symbols",
      limitation: "May require complete build metadata.",
      requiresPermission: false,
    },
    {
      tool: "ts-morph or ast-grep",
      operation: "parse registered source languages",
      limitation: "Does not provide complete cross-language runtime dispatch.",
      requiresPermission: true,
    },
  ],
  semgrep: [
    {
      tool: "Semgrep CLI",
      operation: "run a scoped static security scan",
      limitation: "Rules require exploitability and control-flow verification.",
      requiresPermission: false,
    },
    {
      tool: "Secretlint",
      operation: "detect credential exposure",
      limitation: "Credential exposure only; not a general vulnerability scanner.",
      requiresPermission: true,
    },
    {
      tool: "manual control-flow verification",
      operation: "inspect authentication, authorization, validation, and data flow",
      limitation: "Focused and non-exhaustive.",
      requiresPermission: true,
    },
  ],
  context7: [
    {
      tool: "Context7 CLI",
      operation: "resolve version-matched library documentation",
      limitation: "Requires correct package identity and may require network access.",
      requiresPermission: false,
    },
    {
      tool: "official primary documentation",
      operation: "retrieve authoritative version-specific behavior",
      limitation: "Does not explain target-specific integration by itself.",
      requiresPermission: true,
    },
  ],
  repomix: [
    {
      tool: "Repomix CLI",
      operation: "produce compressed target context",
      limitation: "Compression can hide detail and writing output requires consent.",
      requiresPermission: false,
    },
    {
      tool: "scoped discovery",
      operation: "prioritize component files and relationships",
      limitation: "Does not provide a complete remote repository snapshot.",
      requiresPermission: true,
    },
  ],
  "github-mcp": [
    {
      tool: "local read-only Git extractor",
      operation: "collect local change context",
      limitation: "Cannot provide remote review metadata, CI, or code-security state.",
      requiresPermission: true,
    },
  ],
};

function enrich(item) {
  return {
    ...item,
    runtimeOutcome:
      item.runtimeOutcome ??
      (item.status === "missing" || item.status === "needs-setup"
        ? "unavailable"
        : item.status === "broken"
          ? "failed"
          : "not-attempted"),
    operations: [item.phase],
    installationScope: item.installationScope ?? "none",
    artifactScope: item.artifactScope ?? "none",
    targetMutationRisk: item.targetMutationRisk ?? "none",
    fallbackChain: FALLBACK_CHAINS[item.id] ?? [],
  };
}

function printHelp() {
  process.stdout.write(
    "Usage: node check-capabilities.js <target-project-directory> [--format table|json]\n\n",
  );
  process.stdout.write("Probe optional CLIs without installing or modifying anything.\n");
}

function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  let format = "table";
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--format") {
      format = argv[index + 1];
      index += 1;
    } else {
      positional.push(argv[index]);
    }
  }
  if (!new Set(["json", "table"]).has(format)) throw new Error("--format must be table or json");
  if (positional.length > 1) throw new Error("Expected exactly one target project directory");
  return { format, targetInput: positional[0] };
}

try {
  const { format, targetInput } = parseArguments(process.argv.slice(2));
  const { targetRoot: projectRoot } = await resolveTargetRoot(targetInput);
  const privateCacheRoot = projectStoragePaths(projectRoot).cacheRoot;

  const probed = await Promise.all(
    DEFINITIONS.map(async (definition) => enrich(await probeCommand(definition, projectRoot))),
  );
  const report = capabilityReportSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    projectRoot,
    privateCacheRoot,
    capabilities: [
      ...probed,
      ...MCP_CAPABILITIES.map((item) => capabilitySchema.parse(enrich(item))),
    ],
  });
  process.stdout.write(
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatCapabilityTable(report),
  );
} catch (error) {
  const targetError = formatTargetError(error);
  if (targetError) {
    process.stderr.write(`${targetError}\n`);
    process.exitCode = 1;
  } else {
    process.stderr.write(`Capability check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
