# Tool Integrations and Failure Protocol

Use this reference when an enhanced analysis phase begins or a tool fails.

## Contents

1. Status model
2. Failure prompt
3. Capability chains
4. Setup and functional checks
5. Final ledger

## Root contract

`<skill-root>` is the installation directory containing this reference. `<target-root>` is the
canonical root of the user's application repository. All evidence tools must read or index
`<target-root>`. They must never use `<skill-root>` as their target.

Pass `<target-root>` explicitly even when a tool has a current-directory default. If the roots are
equal or the requested target is inside `<skill-root>`, stop and request the actual repository. If
`<skill-root>` is installed inside `<target-root>`, exclude its exact project-relative path from
Graphify, Serena, Semgrep, Repomix, dependency-cruiser, jscpd, glob scans, and Git diff evidence.
Always exclude legacy/opt-in `<target-root>/.repay-techdebt/` as project memory rather than source.

The default mutation contract is:

| Side effect                                                                      | Default                                               |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Target dependencies, manifests, lockfiles, hooks, instructions, and ignore files | denied                                                |
| Tool executables                                                                 | user-isolated or skill-local. Ask before installation |
| Durable lessons/configuration                                                    | external private state. Ask before creation           |
| Graphs, indexes, packs, and analyzer caches                                      | external private cache or temporary storage           |
| Agent/MCP user configuration                                                     | ask before modification                               |

Run tools with an external working/output directory when they have implicit files. A tool that
cannot redirect writes must run with the target mounted read-only or be skipped in favor of a
target-pure fallback.

## Analyzer result contract

Enhanced-tool wrappers should return a standard `AnalyzerResult` via
`createAnalyzerResult` in `src/tools/analyzer-result.js` (re-exported from
`analyzer-adapter.js` for compatibility). There is no required base class - prefer the shared
factory and status vocabulary. No wrapper may silently install into or write inside the target
repository (`assertSafeAnalyzerOutputDirectory`).

### Status model

Use these exact meanings inside `AnalyzerResult.status`:

| Status         | Meaning                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `successful`   | The phase-specific operation returned usable evidence.                                                         |
| `failed`       | The tool existed but the operation errored, timed out, authenticated incorrectly, or returned unusable output. |
| `unavailable`  | The executable, MCP server, required index, or project initialization is absent.                               |
| `unconfigured` | The current request lacks mandatory context or configuration for this tool.                                    |
| `partial`      | The operation succeeded but missed some scope due to limits or timeouts.                                       |
| `stale`        | The operation used cached data that is older than the current source.                                          |
| `refused`      | The operation was aborted due to safety constraints (e.g. unsafe writes).                                      |

A version command can establish installation, not functional success.
`check-capabilities.js` therefore separates its detailed preflight status from `runtimeOutcome`.
Ready tools remain `not-attempted` until a phase-specific operation succeeds. Missing/setup tools map
to `unavailable`, and broken probes map to `failed`.

## Failure policy (silent bundled fallback)

**Default path:** if the preferred tool is missing, unconfigured, or fails - use the named bundled
fallback immediately. Same user-facing UX. No tool jargon in chat. No confidence inflation. Record
the outcome in the maintainer tool ledger only.

**Ask the user only when:**

1. Install or agent/MCP config change is required, or
2. The phase cannot proceed without a write the user must authorize, or
3. No bundled fallback exists for that phase (then skip the phase honestly).

Do **not** present a three-way menu (setup / fallback / skip) on every failure. That is
ask-before-every-fallback and fights the product.

When install/config consent is needed, use this compact structure and wait:

```text
Optional tool <name> needs setup for a stronger pass.
Reason: <sanitized, actionable failure>
Without setup: continuing with bundled <fallback> (same lesson path; no claim upgrade).
To enable: <commands or configuration steps>

Reply setup to configure, or continue to keep the bundled path.
```

Do not include tokens, credentials, environment values, raw headers, or secret-bearing source lines
in the failure. If the failure suggests credentials are missing, name the variable or authentication
method without printing its value.

**Hard overclaim:** missing evidence → mark `unsupported`, shrink scope, or refuse durable save.
Never “continue weaker?”.

## Capability chains

`plan-analysis.js` emits an ordered `toolChain` for every investigation. Each step names the
operation, availability check, side effects, expected confidence, limitations, and failure gate.
Execute it in order. A failed preferred tool does not justify jumping directly to a filename/tree
heuristic when a compiler, LSP, or AST adapter can retain more semantics.

| Phase                | Preferred                  | CLI alternative            | Explicit fallback                                     |
| -------------------- | -------------------------- | -------------------------- | ----------------------------------------------------- |
| PR and CI            | GitHub MCP read-only tools | none                       | bundled local Git extractor                           |
| Architecture         | Graphify MCP               | Graphify CLI. Compiler/LSP | bundled AST relation query. Scoped tree/search last   |
| Symbols              | Serena MCP                 | compiler/LSP               | bundled ts-morph/ast-grep. Direct source verification |
| Security             | Semgrep MCP                | Semgrep CLI wrapper        | Secretlint + manual verification                      |
| Documentation        | Context7 MCP               | `ctx7` CLI                 | browse official primary docs                          |
| Large/remote context | Repomix MCP                | Repomix CLI                | scoped discovery and module outline                   |
| Duplication          | bundled jscpd              | same bundled CLI           | manual representative search                          |

Do not enable CodeGraph, Codebase Memory, or CodeGraphContext alongside Graphify by default. They
fill the same retrieval layer and can produce competing indexes.

## Setup and functional checks

### Graphify

Install:

```text
uv tool install "graphifyy[mcp]"
```

This is an isolated user-tool installation, not a target dependency. Do not run Graphify's project
hooks or project-specific agent installers. Use the bundled target-pure wrapper:

```text
node <skill-root>/scripts/run-graphify.js paths <target-root>
node <skill-root>/scripts/run-graphify.js extract <target-root> --yes
node <skill-root>/scripts/run-graphify.js query <target-root> --question "<question>"
```

Prefer exact `path` and `explain` operations seeded from verified symbols or project-relative paths.
Free-text `query` defaults to budget 80 and returns bounded output with match count, truncation,
precision, and narrowing seeds. The wrapper makes at most one narrowing retry. Treat `precision:
low` as unusable for teaching until an exact operation or the bundled relation graph confirms the
lead.

The wrapper always uses code-only extraction, explicit external `--out`, explicit `--graph`, and
`GRAPHIFY_QUERY_LOG_DISABLE=1`. Extraction writes only to the reported private cache and requires
consent. Installation is a separate consent decision. If the wrapper reports any target write,
discard the result, disclose the breach, and stop before fallback.

### Serena

Install, then activate or initialize the target project:

```text
uv tool install -p 3.13 serena-agent
```

Confirm Serena's active project is `<target-root>`, not `<skill-root>`, before accepting any result.
Serena is user-isolated, but its default project state is target-local. Before initialization, ask
whether to configure the user-level `project_serena_folder_location` under Repay Tech Debt's private
cache. Do not create target-local `.serena` by default. Confirm the active agent exposes Serena MCP
symbol tools. Constrain symbol tools to target application paths, reject skill/memory/cache paths,
and keep editing, rename, move, and shell tools disabled.

### Semgrep

Install:

```text
uv tool install semgrep
```

Prefer a focused MCP scan. For CLI use, run the bundled wrapper, which masks output and emits a
structured failure gate. `--config auto` may require network access. Treat registry/network failure
as a real failure and ask before fallback. The wrapper must receive `<target-root>` explicitly and
excludes an in-repository skill installation.

### GitHub MCP

Use GitHub's official server. Prefer remote OAuth where the active agent supports it. Enable
read-only mode and only the context, repositories, pull requests, Actions, code-security,
Dependabot, and secret-protection tools needed for the request. A successful PR metadata read is the
functional check only after the owner/repository identity is confirmed to match `<target-root>`.
Exclude `.repay-techdebt/` files from application-change evidence unless project memory itself is
the requested review subject.

### Context7

Install and optionally configure MCP:

```text
npm install -g ctx7@latest
ctx7 setup
```

Functional CLI check:

```text
ctx7 library <name> <query>
ctx7 docs <resolved-library-id> <query>
```

Resolve the package name and installed version from `<target-root>` manifests, lockfiles, or imports.
do not use `<skill-root>/package.json`. Do not call `ctx7 docs` with an unresolved name.
Authentication is optional for many documentation queries but increases limits.

### Repomix

Install:

```text
npm install -g repomix
```

Use compressed output for large repositories. Never write `repomix-output.*` in the target by
default. Pass `<target-root>` explicitly and emit stdout or an external temporary file. Do not pack
an in-repository `<skill-root>`, secrets, generated output, dependencies, or ignored content. A safe
invocation is:

```text
repomix "<target-root>" --stdout --compress --ignore ".repay-techdebt/**,<relative-skill-path>/**,graphify-out/**,.serena/**,repomix-output.*"
```

Omit the skill pattern when the skill is not nested. Keep Repomix's security check enabled. A
successful scoped pack of target application paths is the functional check.

### Bundled runtime

Install dependencies only inside the skill root. Node 22 or newer is accepted. The runtime
preflight verifies that the pinned packages are actually present instead of rejecting odd-numbered
Node releases preemptively.
If a package import, native module, or worker fails, offer dependency installation/repair and retry
before manual analysis. Do not install bundled packages into the analyzed application.

## Final ledger

End with a table like this:

| Tool     | Operation                           | Outcome            | Evidence used                    | Fallback or limitation          |
| -------- | ----------------------------------- | ------------------ | -------------------------------- | ------------------------------- |
| Graphify | queried auth-to-database path       | succeeded          | 7 nodes, verified at cited files | none                            |
| Serena   | find references for `SessionStore`  | failed             | none                             | user accepted ts-morph fallback |
| ts-morph | inspected `SessionStore` references | fallback succeeded | 4 references verified            | TypeScript only                 |

Include tools marked `not needed` only when their omission could otherwise look accidental.
