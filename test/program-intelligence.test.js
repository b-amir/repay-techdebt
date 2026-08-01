import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { test } from "vite-plus/test";
import { createIdentityRegistry, stableId } from "../scripts/lib/identity.js";
import { parseManifest } from "../scripts/lib/manifest-intelligence.js";
import {
  analysisPlanSchema,
  buildProgramModel,
  loadPackRegistry,
  planAnalysis,
  programModelSchema,
  summarizeModel,
} from "../scripts/lib/program-intelligence.js";
import { resolveTargetRoot } from "../scripts/lib/targeting.js";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");

async function fixture() {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-intelligence-"));
  await mkdir(resolve(directory, "src", "auth"), { recursive: true });
  await mkdir(resolve(directory, "src", "routes"), { recursive: true });
  await mkdir(resolve(directory, "tests"), { recursive: true });
  await mkdir(resolve(directory, "worker"), { recursive: true });
  await writeFile(
    resolve(directory, "package.json"),
    `${JSON.stringify({ dependencies: { react: "1.0.0", express: "1.0.0", prisma: "1.0.0" }, devDependencies: { vitest: "1.0.0" } })}\n`,
  );
  await writeFile(resolve(directory, "requirements.txt"), "fastapi==1.0.0\n");
  await writeFile(resolve(directory, "Dockerfile"), "FROM scratch\n");
  await writeFile(
    resolve(directory, "src", "auth", "session.ts"),
    "export const requireSession = () => true;\n",
  );
  await writeFile(
    resolve(directory, "src", "routes", "admin.ts"),
    'import { requireSession } from "../auth/session";\nexport const admin = requireSession();\n',
  );
  await writeFile(resolve(directory, "src", "server.ts"), 'import "./routes/admin";\n');
  await writeFile(
    resolve(directory, "worker.py"),
    "from fastapi import FastAPI\napp = FastAPI()\n",
  );
  await writeFile(
    resolve(directory, "worker", "auth_context.py"),
    "def verify():\n    return True\n",
  );
  await writeFile(
    resolve(directory, "worker", "audit_worker.py"),
    "from auth_context import verify\nresult = verify()\n",
  );
  await writeFile(
    resolve(directory, "tests", "session.test.ts"),
    'import "../src/auth/session";\n',
  );
  return directory;
}

test("builds a polyglot evidence graph with consumers and ranked lenses", async () => {
  const directory = await fixture();
  try {
    const target = await resolveTargetRoot(directory);
    const model = programModelSchema.parse(await buildProgramModel(target));
    assert.deepEqual(
      model.profile.languages.slice(0, 3).map((item) => item.id),
      ["TypeScript", "Python"],
    );
    const packs = new Set(model.packs.map((pack) => pack.id));
    assert.ok(packs.has("javascript-typescript"));
    assert.ok(packs.has("python"));
    assert.ok(packs.has("react-ui"));
    assert.ok(packs.has("node-server"));
    assert.ok(packs.has("database-access"));
    assert.ok(model.profile.priorities.some((item) => item.lens === "security"));
    const importEdges = model.edges.filter((edge) => edge.kind === "imports");
    assert.ok(importEdges.length >= 3);
    const sessionNode = model.nodes.find((node) => node.path === "src/auth/session.ts");
    const adminNode = model.nodes.find((node) => node.path === "src/routes/admin.ts");
    assert.ok(importEdges.some((edge) => edge.from === adminNode.id && edge.to === sessionNode.id));
    const auditNode = model.nodes.find((node) => node.path === "worker/audit_worker.py");
    const authContextNode = model.nodes.find((node) => node.path === "worker/auth_context.py");
    assert.ok(
      importEdges.some((edge) => edge.from === auditNode.id && edge.to === authContextNode.id),
    );
    assert.ok(model.profile.entryPoints.includes("worker/audit_worker.py"));
    assert.ok(model.evidence.every((item) => item.observedAt && item.sources.length > 0));
    assert.match(
      model.nodes.find((node) => node.path === "src/auth/session.ts").id,
      /^file:sha256:[a-f0-9]{64}$/,
    );
    assert.equal(model.coverage.status, "complete");
    assert.ok(model.dependencies.some((item) => item.name === "express"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("focused planning changes relevance without claiming enhanced tools ran", async () => {
  const directory = await fixture();
  try {
    const model = await buildProgramModel(await resolveTargetRoot(directory));
    const plan = analysisPlanSchema.parse(
      planAnalysis(model, { mode: "focused", focus: "security authorization auth" }),
    );
    const security = plan.investigations.find((item) => item.id === "lens-security");
    assert.ok(security.priority >= 90);
    assert.equal(security.gate, "ask-on-failure");
    assert.match(security.preferredTool, /Semgrep/);
    assert.ok(security.toolChain.length >= 3);
    assert.deepEqual(
      security.toolChain.slice(0, 2).map((item) => item.tool),
      ["Semgrep MCP or CLI", "bundled Secretlint"],
    );
    assert.ok(plan.unresolved.some((item) => /purpose/i.test(item)));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("coverage limits and unknown ecosystems remain explicit", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-unknown-"));
  try {
    await writeFile(resolve(directory, "one.xyz"), "one\n");
    await writeFile(resolve(directory, "two.xyz"), "two\n");
    const model = await buildProgramModel(await resolveTargetRoot(directory), {
      maxFiles: 1,
      maxRelationFiles: 1,
    });
    const summary = summarizeModel(model);
    assert.equal(summary.coverage.truncated, true);
    assert.equal(summary.coverage.status, "partial");
    assert.ok(summary.coverage.reasonCodes.includes("file-limit-reached"));
    assert.equal(summary.coverage.modeledFiles, 1);
    assert.equal(summary.packs.length, 0);
    assert.ok(
      summary.profile.uncertainties.some((item) => /No language or framework pack/.test(item)),
    );
    const plan = planAnalysis(model, {
      mode: "focused",
      focus: "whole-app plan without pretending to understand unsupported semantics",
      depth: "deep",
    });
    const blocking = plan.investigations.find((item) => item.id === "blocking-ecosystem-discovery");
    const semantics = plan.investigations.find((item) => item.id === "micro-semantics");
    assert.equal(blocking.priority, 99);
    assert.match(blocking.fallback, /no generic syntax fallback/);
    assert.ok(semantics.priority < 75);
    assert.match(semantics.fallback, /no bundled parser/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("uses canonical cryptographic identities and detects injected collisions", () => {
  assert.equal(stableId("file", "src/app.ts"), stableId("file", "src/app.ts"));
  assert.notEqual(stableId("file", "src/app.ts"), stableId("test", "src/app.ts"));
  const registry = createIdentityRegistry(() => "forced:collision");
  assert.equal(registry.id("file", "a.ts"), "forced:collision");
  assert.throws(() => registry.id("file", "b.ts"), /Identity collision detected/);
});

test("structured manifest adapters preserve scopes, workspaces, and diagnostics", () => {
  const pyproject = parseManifest(
    "pyproject.toml",
    '[project]\ndependencies = ["FastAPI>=1", "pydantic"]\n[project.optional-dependencies]\ntest = ["pytest>=8"]\n[tool.poetry.group.dev.dependencies]\nruff = "*"\n',
  );
  assert.equal(pyproject.parser, "toml");
  assert.deepEqual(
    new Set(pyproject.dependencies.map((item) => `${item.name}:${item.scope}`)),
    new Set(["fastapi:runtime", "pydantic:runtime", "pytest:optional", "ruff:development"]),
  );

  const cargo = parseManifest(
    "Cargo.toml",
    '[workspace]\nmembers = ["crates/*"]\n[workspace.dependencies]\nserde = "1"\n[dev-dependencies]\ninsta = "1"\n',
  );
  assert.deepEqual(cargo.workspaces, ["crates/*"]);
  assert.ok(cargo.dependencies.some((item) => item.name === "serde"));

  const malformed = parseManifest("pubspec.yaml", "dependencies:\n  broken: [\n");
  assert.equal(malformed.dependencies.length, 0);
  assert.ok(malformed.diagnostics.some((item) => item.code === "manifest-parse-failed"));

  const lock = parseManifest(
    "package-lock.json",
    JSON.stringify({
      packages: {
        "": { dependencies: { express: "^5" } },
        "node_modules/express": { version: "5.1.0" },
        "node_modules/express/node_modules/debug": { version: "4.4.0" },
      },
    }),
  );
  assert.ok(lock.dependencies.some((item) => item.name === "express" && item.direct));
  assert.ok(
    lock.dependencies.some(
      (item) => item.name === "debug" && !item.direct && item.version === "4.4.0",
    ),
  );
});

test("discovers monorepo components and AST-observed dynamic and test relationships", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-monorepo-"));
  try {
    await mkdir(resolve(directory, "packages", "api", "src"), { recursive: true });
    await mkdir(resolve(directory, "packages", "ui", "src"), { recursive: true });
    await mkdir(resolve(directory, "packages", "api", "tests"), { recursive: true });
    await writeFile(
      resolve(directory, "package.json"),
      `${JSON.stringify({ workspaces: ["packages/*"] })}\n`,
    );
    await writeFile(
      resolve(directory, "packages", "api", "package.json"),
      `${JSON.stringify({ dependencies: { express: "1" } })}\n`,
    );
    await writeFile(
      resolve(directory, "packages", "ui", "package.json"),
      `${JSON.stringify({ dependencies: { react: "1" } })}\n`,
    );
    await writeFile(
      resolve(directory, "packages", "api", "src", "lazy.ts"),
      "export const lazy = true;\n",
    );
    await writeFile(
      resolve(directory, "packages", "api", "src", "server.ts"),
      'import express from "express";\nexport const lazy = () => import("./lazy");\n',
    );
    await writeFile(
      resolve(directory, "packages", "api", "tests", "behavior.ts"),
      'import "../src/server";\n',
    );
    await writeFile(
      resolve(directory, "packages", "ui", "src", "app.tsx"),
      "export const App = () => null;\n",
    );
    const model = await buildProgramModel(await resolveTargetRoot(directory));
    assert.ok(model.profile.components.some((item) => item.root === "packages/api"));
    assert.ok(model.profile.components.some((item) => item.root === "packages/ui"));
    assert.ok(
      model.profile.components
        .find((item) => item.root === "packages/api")
        .archetypes.some((item) => item.id === "server"),
    );
    const dynamicEvidence = model.evidence.find((item) =>
      item.sources.some((source) => source.operation === "dynamic-import"),
    );
    assert.equal(dynamicEvidence.sources[0].analyzer, "ts-morph");
    assert.ok(model.edges.some((edge) => edge.kind === "tests" && edge.confidence > 0.9));
    const express = model.dependencies.find((item) => item.name === "express");
    assert.deepEqual(express.usedBy, ["packages/api/src/server.ts"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("scoping is applied before tight budgets and remains explicitly partial", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-scoped-"));
  try {
    await mkdir(resolve(directory, "aaa", "src"), { recursive: true });
    await mkdir(resolve(directory, "zzz", "src"), { recursive: true });
    await writeFile(resolve(directory, "aaa", "src", "first.ts"), "export const first = 1;\n");
    await writeFile(
      resolve(directory, "zzz", "gleam.toml"),
      '[package]\nname = "late"\n[dependencies]\nwisp = "~> 1.0"\n',
    );
    await writeFile(resolve(directory, "zzz", "src", "app.gleam"), "pub fn main() { Nil }\n");
    const model = await buildProgramModel(await resolveTargetRoot(directory), {
      scope: "zzz",
      maxFiles: 2,
      maxManifestFiles: 2,
      maxRelationFiles: 2,
    });
    assert.equal(model.target.scope, "zzz");
    assert.equal(model.coverage.discoveredFiles, 2);
    assert.equal(model.coverage.modeledFiles, 2);
    assert.equal(model.coverage.status, "partial");
    assert.ok(model.coverage.reasonCodes.includes("scoped-analysis"));
    assert.ok(model.profile.languages.some((item) => item.id === "Gleam"));
    assert.ok(model.packs.some((item) => item.id === "gleam-beam"));
    assert.ok(model.nodes.every((node) => !node.path?.startsWith("aaa/")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("resolves emitted JavaScript specifiers and records computed-import blind spots", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-imports-"));
  try {
    await mkdir(resolve(directory, "src"));
    await writeFile(resolve(directory, "src", "lazy.ts"), "export const lazy = true;\n");
    await writeFile(
      resolve(directory, "src", "server.ts"),
      'import "./lazy.js";\nconst moduleName = "./lazy";\nexport const deferred = () => import(moduleName);\n',
    );
    const model = await buildProgramModel(await resolveTargetRoot(directory));
    const server = model.nodes.find((node) => node.path === "src/server.ts");
    const lazy = model.nodes.find((node) => node.path === "src/lazy.ts");
    assert.ok(
      model.edges.some(
        (edge) => edge.kind === "imports" && edge.from === server.id && edge.to === lazy.id,
      ),
    );
    assert.equal(model.coverage.status, "partial");
    assert.ok(model.coverage.reasonCodes.includes("computed-module-specifiers-unresolved"));
    assert.ok(
      model.coverage.parserDiagnostics.some(
        (item) => item.code === "computed-module-specifier" && item.path === "src/server.ts",
      ),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("malformed manifests do not activate packs and Python import aliases map to declarations", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-manifest-pack-"));
  try {
    await writeFile(resolve(directory, "package.json"), "{ malformed\n");
    await writeFile(resolve(directory, "requirements.txt"), "PyJWT==2.10.0\n");
    await writeFile(resolve(directory, "auth.py"), "import jwt\n");
    const model = await buildProgramModel(await resolveTargetRoot(directory));
    assert.equal(
      model.packs.some((item) => item.id === "javascript-typescript"),
      false,
    );
    const dependency = model.dependencies.find((item) => item.name === "pyjwt");
    assert.deepEqual(dependency.usedBy, ["auth.py"]);
    assert.ok(model.coverage.reasonCodes.includes("manifest-parser-errors"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("schema-v2 project hints drive budgets, boundaries, aliases, and workflow planning", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-configured-"));
  try {
    await mkdir(resolve(directory, "unusual", "edge"), { recursive: true });
    await writeFile(resolve(directory, "unusual", "edge", "one.ts"), "export const one = 1;\n");
    await writeFile(resolve(directory, "two.ts"), "export const two = 2;\n");
    await execute(
      process.execPath,
      [
        resolve(root, "scripts", "project-memory.js"),
        "init",
        directory,
        "--sharing",
        "local",
        "--boundary-hints",
        "unusual/edge",
        "--critical-workflows",
        "settle customer balance",
        "--max-files",
        "1",
        "--yes",
      ],
      { cwd: root },
    );
    const configPath = resolve(directory, ".repay-techdebt", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.analysis.aliases = { ".": "Debt Lab" };
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const model = await buildProgramModel(await resolveTargetRoot(directory));
    assert.equal(model.coverage.fileLimit, 1);
    assert.equal(model.coverage.status, "partial");
    assert.ok(
      model.profile.boundaryEvidence.some(
        (item) => item.path === "unusual/edge" && item.signals.includes("user-configured-hint"),
      ),
    );
    assert.equal(model.nodes.find((node) => node.kind === "component").name, "Debt Lab");
    const plan = planAnalysis(model);
    assert.ok(
      plan.investigations.some((item) => item.question.includes("settle customer balance")),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("depth changes the executable plan and focus matching uses whole words", async () => {
  const directory = await fixture();
  try {
    const model = await buildProgramModel(await resolveTargetRoot(directory));
    const concise = planAnalysis(model, {
      mode: "workbook",
      focus: "whole-app",
      depth: "concise",
    });
    const deep = planAnalysis(model, { mode: "workbook", focus: "whole-app", depth: "deep" });
    assert.ok(deep.investigations.length > concise.investigations.length);
    assert.equal(concise.request.depth, "concise");
    assert.equal(deep.request.depth, "deep");
    assert.ok(
      concise.investigations
        .filter((item) => item.id.startsWith("lens-"))
        .every((item) => item.priority < 99),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Gleam manifests, entry points, and local imports activate BEAM-aware evidence", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-gleam-"));
  try {
    await mkdir(resolve(directory, "src"));
    await writeFile(
      resolve(directory, "gleam.toml"),
      '[package]\nname = "sample"\n[dependencies]\nwisp = "~> 1.0"\n',
    );
    await writeFile(
      resolve(directory, "src", "app.gleam"),
      "import auth\npub fn main() { auth.ok() }\n",
    );
    await writeFile(resolve(directory, "src", "auth.gleam"), "pub fn ok() { True }\n");
    const model = await buildProgramModel(await resolveTargetRoot(directory));
    assert.ok(model.packs.some((pack) => pack.id === "gleam-beam"));
    assert.ok(model.profile.languages.some((item) => item.id === "Gleam"));
    assert.ok(model.profile.entryPoints.includes("src/app.gleam"));
    assert.ok(model.edges.some((edge) => edge.kind === "imports"));
    assert.equal(model.profile.capabilities.includes("mobile"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Elixir relations, configuration, tests, and runtime candidates remain visible", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "repay-elixir-"));
  try {
    await mkdir(resolve(directory, "lib", "sample", "auth"), { recursive: true });
    await mkdir(resolve(directory, "test", "sample", "auth"), { recursive: true });
    await mkdir(resolve(directory, "config"));
    await writeFile(resolve(directory, "mix.exs"), 'defp deps, do: [{:plug, "~> 1.0"}]\n');
    await writeFile(
      resolve(directory, "lib", "sample", "auth", "session.ex"),
      "defmodule Sample.Auth.Session do\nend\n",
    );
    await writeFile(
      resolve(directory, "lib", "sample", "web.ex"),
      "defmodule Sample.Web do\n  alias Sample.Auth.Session\nend\n",
    );
    await writeFile(
      resolve(directory, "test", "sample", "auth", "session_test.exs"),
      "defmodule Sample.Auth.SessionTest do\n  alias Sample.Auth.Session\nend\n",
    );
    await writeFile(resolve(directory, "config", "config.exs"), "import Config\n");
    await writeFile(resolve(directory, "openapi.yaml"), "openapi: 3.0.0\n");
    const model = await buildProgramModel(await resolveTargetRoot(directory));
    assert.ok(model.packs.some((pack) => pack.id === "elixir-beam"));
    assert.deepEqual(model.coverage.relationLanguagesUnsupported, []);
    assert.ok(model.edges.some((edge) => edge.kind === "imports"));
    assert.ok(model.edges.some((edge) => edge.kind === "tests"));
    assert.ok(
      model.nodes.some(
        (node) => node.path === "config/config.exs" && node.kind === "configuration",
      ),
    );
    assert.ok(
      model.nodes.some((node) => node.path === "openapi.yaml" && node.kind === "configuration"),
    );

    const runtime = await execute(
      process.execPath,
      [resolve(root, "scripts", "plan-runtime-evidence.js"), directory],
      { cwd: root, maxBuffer: 10 * 1024 * 1024, timeout: 120_000 },
    );
    const runtimeReport = JSON.parse(runtime.stdout);
    assert.ok(runtimeReport.operations.some((item) => item.proposedCommand === "mix test"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("pack registry is schema-checked and broad without becoming a defect inventory", async () => {
  const registry = await loadPackRegistry();
  assert.ok(registry.languagePacks.length >= 12);
  assert.ok(registry.frameworkPacks.length >= 8);
  assert.ok(registry.lenses.length >= 15);
  assert.ok(registry.languagePacks.every((pack) => pack.investigations.length > 0));
  assert.ok(registry.lenses.every((lens) => lens.questions.length >= 2));
});

test("query CLI returns an auth consumer neighborhood and writes nothing", async () => {
  const directory = await fixture();
  try {
    const before = (await readdir(directory)).sort();
    const result = await execute(
      process.execPath,
      [resolve(root, "scripts", "query-program-model.js"), directory, "session", "--depth", "1"],
      { cwd: root, maxBuffer: 30 * 1024 * 1024, timeout: 120_000 },
    );
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, "succeeded");
    assert.equal(
      output.target.root,
      await resolveTargetRoot(directory).then((item) => item.targetRoot),
    );
    assert.ok(output.matches.some((node) => node.path === "src/auth/session.ts"));
    assert.ok(output.neighborhood.some((node) => node.path === "src/routes/admin.ts"));
    assert.deepEqual((await readdir(directory)).sort(), before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
