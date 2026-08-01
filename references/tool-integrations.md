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
`<target-root>`; they must never use `<skill-root>` as their target.

Pass `<target-root>` explicitly even when a tool has a current-directory default. If the roots are
equal or the requested target is inside `<skill-root>`, stop and request the actual repository. If
`<skill-root>` is installed inside `<target-root>`, exclude its exact project-relative path from
Graphify, Serena, Semgrep, Repomix, dependency-cruiser, jscpd, glob scans, and Git diff evidence.
Always exclude legacy/opt-in `<target-root>/.repay-techdebt/` as project memory rather than source.

The default mutation contract is:

| Side effect                                                                      | Default                                               |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Target dependencies, manifests, lockfiles, hooks, instructions, and ignore files | denied                                                |
| Tool executables                                                                 | user-isolated or skill-local; ask before installation |
| Durable lessons/configuration                                                    | external private state; ask before creation           |
| Graphs, indexes, packs, and analyzer caches                                      | external private cache or temporary storage           |
| Agent/MCP user configuration                                                     | ask before modification                               |

Run tools with an external working/output directory when they have implicit files. A tool that
cannot redirect writes must run with the target mounted read-only or be skipped in favor of a
target-pure fallback.

## Status model

Use these exact meanings:

| Status               | Meaning                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `succeeded`          | The phase-specific operation returned usable evidence.                                                         |
| `failed`             | The tool existed but the operation errored, timed out, authenticated incorrectly, or returned unusable output. |
| `unavailable`        | The executable, MCP server, required index, or project initialization is absent.                               |
| `not needed`         | The current request does not require this capability.                                                          |
| `skipped by user`    | The user declined setup and fallback for that phase.                                                           |
| `fallback succeeded` | The user explicitly accepted the named fallback and it returned evidence.                                      |

A version command can establish installation, not functional success.
`check-capabilities.js` therefore separates its detailed preflight status from `runtimeOutcome`.
Ready tools remain `not-attempted` until a phase-specific operation succeeds; missing/setup tools map
to `unavailable`, and broken probes map to `failed`.

## Failure prompt

Use this compact structure and wait for the answer:

```text
<Tool> could not complete <operation>.
Reason: <sanitized, actionable failure>
Without it: <capability or confidence lost>
To enable it: <commands or configuration steps>
Fallback: <exact next tool and its limitation>

Would you like me to (1) help set it up and retry, (2) use the fallback, or (3) skip this phase?
```

Do not include tokens, credentials, environment values, raw headers, or secret-bearing source lines
in the failure. If the failure suggests credentials are missing, name the variable or authentication
method without printing its value.

## Capability chains

`plan-analysis.js` emits an ordered `toolChain` for every investigation. Each step names the
operation, availability check, side effects, expected confidence, limitations, and failure gate.
Execute it in order. A failed preferred tool does not justify jumping directly to a filename/tree
heuristic when a compiler, LSP, or AST adapter can retain more semantics.

| Phase                | Preferred                  | CLI alternative            | Explicit fallback                                     |
| -------------------- | -------------------------- | -------------------------- | ----------------------------------------------------- |
| PR and CI            | GitHub MCP read-only tools | none                       | bundled local Git extractor                           |
| Architecture         | Graphify MCP               | Graphify CLI; compiler/LSP | bundled AST relation query; scoped tree/search last   |
| Symbols              | Serena MCP                 | compiler/LSP               | bundled ts-morph/ast-grep; direct source verification |
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
structured failure gate. `--config auto` may require network access; treat registry/network failure
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

Resolve the package name and installed version from `<target-root>` manifests, lockfiles, or imports;
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

Install dependencies only inside the skill root. Node 22 or newer is accepted; the runtime
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
