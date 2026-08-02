import { basename, resolve } from "node:path";
import { globby } from "globby";
import { isSameOrInside } from "./targeting.js";

export const DEFAULT_MAX_FILES = 30_000;
export const DEFAULT_MAX_MANIFEST_FILES = 1_000;
export const DEFAULT_MAX_RELATION_FILES = 1_500;
export const DEFAULT_READ_BUDGET = 12 * 1024 * 1024;
export const MAX_RELATION_FILE_SIZE = 512 * 1024;

export const IGNORES = [
  "**/.git/**",
  "**/.hg/**",
  "**/.svn/**",
  "**/.repay-techdebt/**",
  "**/.serena/**",
  "**/.venv/**",
  "**/__pycache__/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.svelte-kit/**",
  "**/bower_components/**",
  "**/build/**",
  "**/coverage/**",
  "**/dist/**",
  "**/generated/**",
  "**/graphify-out/**",
  "**/node_modules/**",
  "**/out/**",
  "**/repomix-output.*",
  "**/target/**",
  "**/vendor/**",
  "**/.env",
  "**/.env.*",
  "**/.gitignore",
  "**/.graphifyignore",
  "**/*.{key,pem,p12,pfx,keystore,jks}",
];

export const extensionLanguage = new Map([
  [".js", "JavaScript"],
  [".jsx", "JavaScript"],
  [".mjs", "JavaScript"],
  [".cjs", "JavaScript"],
  [".ts", "TypeScript"],
  [".tsx", "TypeScript"],
  [".mts", "TypeScript"],
  [".cts", "TypeScript"],
  [".py", "Python"],
  [".pyi", "Python"],
  [".go", "Go"],
  [".rs", "Rust"],
  [".java", "Java"],
  [".kt", "Kotlin"],
  [".kts", "Kotlin"],
  [".scala", "Scala"],
  [".cs", "C#"],
  [".fs", "F#"],
  [".vb", "Visual Basic"],
  [".c", "C"],
  [".h", "C/C++"],
  [".cc", "C++"],
  [".cpp", "C++"],
  [".cxx", "C++"],
  [".hpp", "C++"],
  [".swift", "Swift"],
  [".m", "Objective-C/MATLAB"],
  [".mm", "Objective-C++"],
  [".rb", "Ruby"],
  [".php", "PHP"],
  [".ex", "Elixir"],
  [".exs", "Elixir"],
  [".dart", "Dart"],
  [".r", "R"],
  [".R", "R"],
  [".jl", "Julia"],
  [".hs", "Haskell"],
  [".ml", "OCaml"],
  [".mli", "OCaml"],
  [".clj", "Clojure"],
  [".erl", "Erlang"],
  [".gleam", "Gleam"],
  [".sh", "Shell"],
  [".bash", "Shell"],
  [".zsh", "Shell"],
  [".fish", "Shell"],
  [".ps1", "PowerShell"],
  [".sql", "SQL"],
  [".tf", "Terraform"],
  [".hcl", "HCL"],
  [".graphql", "GraphQL"],
  [".proto", "Protocol Buffers"],
  [".sol", "Solidity"],
  [".lua", "Lua"],
  [".ipynb", "Notebook"],
]);

export const manifestNames = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Pipfile",
  "setup.py",
  "go.mod",
  "go.work",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "settings.gradle",
  "settings.gradle.kts",
  "build.sbt",
  "global.json",
  "CMakeLists.txt",
  "Makefile",
  "meson.build",
  "conanfile.txt",
  "vcpkg.json",
  "Package.swift",
  "Podfile",
  "Gemfile",
  "composer.json",
  "mix.exs",
  "pubspec.yaml",
  "DESCRIPTION",
  "Project.toml",
  "renv.lock",
  "poetry.lock",
  "uv.lock",
  "composer.lock",
  "stack.yaml",
  "cabal.project",
  "dune-project",
  "deps.edn",
  "rebar.config",
  "gleam.toml",
  "Chart.yaml",
  "Pulumi.yaml",
  "serverless.yml",
  "serverless.yaml",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "go.sum",
  "Cargo.lock",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
]);

const entryNames =
  /^(?:(?:main|index|app|server|client|cli|worker|application|program|manage|wsgi|asgi)|.+(?:_|-)(?:main|app|server|client|worker))(?:\.[^.]+)+$/i;
const testPattern =
  /(?:^|\/)(?:test|tests|spec|specs|__tests__)(?:\/|$)|(?:\.test|\.spec|_test|test_)\.[^/]+$/i;
export const boundaryPattern =
  /(?:^|\/)(?:api|routes?|controllers?|handlers?|commands?|consumers?|workers?|jobs?|repositories|adapters?|gateways?|ports?|migrations?|schemas?|contracts?|events?)(?:\/|$)/i;
const boundarySegmentPattern =
  /^(?:api|routes?|controllers?|handlers?|commands?|consumers?|workers?|jobs?|repositories|adapters?|gateways?|ports?|migrations?|schemas?|contracts?|events?)$/i;
export const deploymentPattern =
  /(?:^|\/)(?:Dockerfile|(?:docker-)?compose\.ya?ml|k8s|kubernetes|helm|terraform|infra|deploy|\.github\/workflows|\.gitlab-ci|serverless)/i;

export function normalized(path) {
  return path.replaceAll("\\", "/");
}

export function normalizeScope(value) {
  const scope = normalized(String(value ?? "."))
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
  if (scope.startsWith("/") || scope.split("/").includes("..") || scope.includes("\0"))
    throw new Error("scope must be a safe target-relative path");
  return scope || ".";
}

export function conventionalBoundaryRoot(path) {
  const segments = normalized(path).split("/");
  const index = segments.findIndex((segment) => boundarySegmentPattern.test(segment));
  return index < 0 ? null : segments.slice(0, index + 1).join("/");
}

export function wildcardMatches(pattern, filename) {
  if (!pattern.includes("*")) return pattern === filename;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`, "i").test(filename);
}

export function classifyFile(path) {
  const name = basename(path);
  if (deploymentPattern.test(path)) return "deployment";
  if (manifestNames.has(name) || /\.(?:csproj|fsproj|sln|xcodeproj|xcworkspace)$/.test(name))
    return "manifest";
  if (
    /(?:^|\/)config(?:\/|$)|(?:^|\/)\.github\/workflows(?:\/|$)|\.(?:toml|ya?ml|jsonc)$/i.test(path)
  )
    return "configuration";
  if (testPattern.test(path)) return "test";
  if (entryNames.test(name)) return "entry-point";
  return "file";
}

export async function discoverTargetFiles({
  targetRoot,
  relativeSkillRoot,
  scope,
  maxFiles,
  ignoreExtra = [],
}) {
  const normalizedScope = normalizeScope(scope);
  const ignore = [
    ...IGNORES,
    ...(relativeSkillRoot ? [`${relativeSkillRoot}/**`] : []),
    ...ignoreExtra,
  ];
  const discovered = (
    await globby("**/*", {
      cwd: targetRoot,
      absolute: false,
      dot: true,
      followSymbolicLinks: false,
      gitignore: true,
      ignore,
      onlyFiles: true,
    })
  )
    .map(normalized)
    .filter(
      (path) =>
        normalizedScope === "." || path === normalizedScope || path.startsWith(`${normalizedScope}/`),
    )
    .sort();
  const files = discovered.slice(0, maxFiles);
  const absoluteFiles = files.map((path) => resolve(targetRoot, path));
  if (
    relativeSkillRoot &&
    absoluteFiles.some((path) =>
      isSameOrInside(path, resolve(targetRoot, relativeSkillRoot)),
    )
  )
    throw new Error("Internal error: nested skill path entered the program model");
  return { scope: normalizedScope, discovered, files, absoluteFiles, ignore };
}
