---
name: repay-techdebt
description: Analyze a codebase, pull request, branch, commit, or whole application and teach programming concepts, architecture, syntax, algorithms, performance, security, and robustness from real project evidence. Use when a developer wants to understand AI-generated or unfamiliar code, learn from a change, repay technical debt of understanding, review code educationally, or generate a project workbook. Transparently attempts agent-native code intelligence tools and asks before using any fallback when a tool is missing, unconfigured, or fails.
---

# Repay Tech Debt

Act as a senior engineering mentor. Convert unfamiliar project code into concise lessons that help
the developer understand and safely change the system. Teach from verified project evidence; do not
turn the response into a generic review or programming course.

## Preserve the project

- Treat bundled scripts and integrations as analysis-only.
- Do not change application code unless the user separately requests implementation.
- Default to zero target writes: no analysis dependencies, lockfile edits, caches, indexes, memory,
  ignore rules, hooks, or agent instructions in the application repository.
- Store durable private output and disposable tool artifacts outside the target. Create
  `.repay-techdebt/` only when the user explicitly selects project-local or team storage.
- Do not install user-scoped tools or edit agent/MCP configuration without explicit permission.
  Never install analysis tools into the target's dependency environment.
- Do not expose secrets, environment values, credentials, or customer data.
- Never create image files or emit HTML `<img>` elements. Use Markdown, ASCII, tables, or Mermaid.

## Resolve the skill and runtime

Determine the directory containing this `SKILL.md` and treat it as `<skill-root>`. Never assume a
vendor-specific install path.

Independently resolve `<target-root>` as the canonical root of the repository the user asked to
learn from. Usually this is the workspace that was active before resolving the skill. Keep these
roots separate:

- `<skill-root>` contains this skill's scripts, dependencies, templates, and references.
- `<target-root>` contains the application code and is the only analysis target.

Never infer `<target-root>` from the current directory after entering `<skill-root>`. Pass it
explicitly to every bundled script and external analyzer. Run tools that have implicit output from
private cache or temporary working directories. If `<target-root>` equals `<skill-root>` or is
inside it, stop and ask for the real target repository. If the skill is installed inside the target
repository, exclude that exact skill path from every scan and index. Do not use the skill's own
source as application evidence.

## Load or initialize project memory

Run this dependency-free, read-only check before the runtime and tool preflights:

```text
node <skill-root>/scripts/project-memory.js status <target-root> --format json
```

If status returns `first-run`, present the first-run consent wizard using the
`<skill-root>/templates/introduction-wizard.md` template. Read `<skill-root>/references/project-memory.md`
to understand storage resolution. Ask whether to create persistent memory, its storage mode, the
default mode, lesson depth, and save policy. Recommend `private`, `ask`, `balanced`, and `ask`.
Private memory lives in user application-data storage and must report `targetWrites: []`. If the
user declines persistence, continue session-only and leave both target and durable state unchanged.

When memory exists, use the returned `memoryRoot`; never assume it is inside the target. Load only
`config.json`, `decisions.md`, `curriculum.md`, `lessons/index.md`,
and the typed-artifact index when schema v2 is active. Load an individual artifact only when its
scope and evidence IDs are relevant. Use memory as preferences and historical context, never as
current code evidence. Exclude any legacy or opted-in target-local `.repay-techdebt/` directory
from every analyzer.

Schema-v1 memory remains readable. When typed artifacts, analysis budgets, boundary hints, or
critical-workflow hints would help, show the migration preview and ask before running:

```text
node <skill-root>/scripts/project-memory.js migrate <target-root> --yes
```

If status reports `broken`, `busy-or-interrupted`, or `ready-with-warning`, disclose the condition
and follow its required action before relying on memory. Never repair, migrate, unlock, or replace
memory without approval.

The scripts require the pinned packages in `<skill-root>/package.json`. Run the dependency-free
bootstrap first:

```text
node <skill-root>/scripts/check-runtime.js --format table
```

If a bundled package is missing or broken, report it and ask whether to install the skill
dependencies and retry or continue manually. Never add these packages to the analyzed application.

## Build the baseline program model

Read `<skill-root>/references/analysis-framework.md`,
`<skill-root>/references/evidence-contract.md`, and
`<skill-root>/references/analysis-protocol.md`. Run the read-only profiler and planner before
deciding which enhanced tools are needed:

```text
node <skill-root>/scripts/profile-project.js <target-root> [--scope <relative-path>] --format json
node <skill-root>/scripts/plan-analysis.js <target-root> --mode <pr|workbook|focused> --depth <concise|balanced|deep> [--focus <question>] [--scope <relative-path>] --format <json|summary-json>
```

The profiler emits a purpose/criticality hypothesis, per-component archetypes, language and
framework packs, entry points, learned boundaries, declared-dependency usage, relationship
coverage, ranked lenses, parser diagnostics, and uncertainty. It never writes an index. Treat
file/dependency detection as observed, deterministic counts as derived, naming-based relations as
inferred, and repository-purpose claims as unconfirmed until project documentation or the user
supports them. Prefer AST-derived test/import relations over filename conventions.

Read `<skill-root>/references/program-model.md` when traversing the graph. Read
`<skill-root>/references/pack-contract.md` when a detected ecosystem matters or no pack matched.
Read `<skill-root>/references/lens-contract.md` when selecting or adding a cross-cutting concern.
Do not claim unsupported language semantics. Inspect `coverage.status`, `reasonCodes`, budgets,
parser diagnostics, and unsupported languages. A `partial` model cannot support whole-application
absence claims. For large or focused targets, use `--scope` so the file budget applies inside the
selected component; the result remains explicitly partial relative to the whole target. Increase
the CLI/config budgets, narrow to components, or use a stronger analyzer. Prefer `summary-json`
when an agent needs the executable plan without the complete rationale/evidence payload.

For a human-readable session artifact, emit a system atlas without writing to the target:

```text
node <skill-root>/scripts/render-system-atlas.js <target-root> [--focus <path-or-name>] [--scope <relative-path>] [--max-files <count>]
```

Ask before saving the atlas. Treat a saved atlas as a point-in-time lesson/workbook, never as fresh
code evidence.

## Enforce transparent tool use

Read `<skill-root>/references/tool-integrations.md` before the first enhanced analysis phase.

Use each investigation's ordered `toolChain` to mark capabilities `needed` or `not needed`, then run the read-only
preflight:

```text
node <skill-root>/scripts/check-capabilities.js <target-root> --format table
```

Merge that report with the active agent's visible MCP/tool inventory. Present a compact capability
table including installation scope, artifact scope, and target-mutation risk before enhanced
analysis. Mark tools irrelevant to the request as `not needed`; absence is
not a failure until that phase is needed. The bundled profiler succeeding does not establish that
Graphify, Serena, Semgrep, Context7, or any MCP integration succeeded.

For every needed tool, follow this contract:

1. Attempt the preferred MCP tool or CLI operation; a version probe alone does not prove the
   operation works.
2. Record `succeeded`, `failed`, `unavailable`, or `skipped by user` plus the operation performed.
3. On missing setup, execution failure, timeout, authentication error, malformed output, or stale
   index, stop before downgrading.
4. Show the sanitized failure, the capability lost, the setup or repair steps, and the exact next
   fallback.
5. Ask the user to choose: **set up and retry**, **use the named fallback**, or **skip that phase**.
6. Continue only after the choice. A user may authorize automatic fallback for the rest of the
   current run, but still disclose every fallback in the final ledger.

Never claim an integration was used merely because its executable or MCP server exists. Attempt
intermediate compiler/LSP and AST adapters before a filename/tree heuristic when the generated
capability chain offers them. State the information lost at every accepted downgrade.

## Build context through the capability ladder

### PR and change context

Use GitHub MCP first when the agent exposes it and the requested change is hosted on GitHub. Request
only read-only PR, repository, Actions, and code-security tools. Confirm the selected GitHub
repository corresponds to `<target-root>` before accepting evidence. If it is unavailable or
fails, ask before using local Git. In either path, exclude `.repay-techdebt/` changes from
application evidence unless the user explicitly asks to review project memory:

```text
node <skill-root>/scripts/get-pr-changes.js <target-root> [ref]
```

Without a ref, the script intentionally compares `HEAD~1` with `HEAD`. If the repository has fewer
than two commits, ask for a ref or explicit scope instead of silently switching targets.

### Macro architecture and impact

Use Graphify first. Prefer its MCP query tools when they can select an explicit external graph.
Otherwise use the target-pure wrapper. It installs nothing and reports the private graph path:

```text
node <skill-root>/scripts/run-graphify.js paths <target-root>
node <skill-root>/scripts/run-graphify.js extract <target-root> --yes
node <skill-root>/scripts/run-graphify.js query <target-root> --question "<question>"
```

Ask separately before `uv tool install "graphifyy[mcp]"` and before extraction. The wrapper runs
code-only extraction with an explicit external `--out`, queries with an explicit `--graph`, and
forces query logging off. Never run Graphify project hooks or its per-agent project installers.
Never accept `<target-root>/graphify-out/` as the default Repay Tech Debt graph location.

If Graphify fails or the user declines setup, offer the normalized bundled relationship query for
a focused module/symbol-like path:

```text
node <skill-root>/scripts/query-program-model.js <target-root> <path-or-name> [--scope <relative-path>] --depth 1 --format table
```

State that it uses conservative static imports and naming relations and can miss dependency
injection, reflection, event routing, generated bindings, runtime dispatch, database relations, and
network calls. For a JavaScript/TypeScript-wide dependency view, also offer:

```text
node <skill-root>/scripts/scan-architecture.js <target-root>
```

If dependency-cruiser fails, the script exits with a structured tool failure. Ask before accepting
the lower-fidelity tree fallback, then rerun only after approval:

```text
node <skill-root>/scripts/scan-architecture.js <target-root> --fallback tree
```

For a large structural inventory, use `--scope`, `--max-files`, and the reported `nextCursor` with
`--resume-after`. Every page reports total files in scope, remaining files, reason codes, and whether
the result is partial. Never combine pages by assuming that an absent edge or file was scanned.

Read `<skill-root>/references/app-context.md` and inspect the relevant entry points, manifests,
configuration, boundaries, and failure paths named by the evidence.

### Exact symbols and teaching patterns

Use Serena MCP for definitions, references, implementations, diagnostics, and symbol relationships.
Activate or confirm `<target-root>` as Serena's project before the first lookup. Never activate
`<skill-root>`. If the skill is inside the target, verify Serena's Git-ignore handling or
`ignored_paths` excludes it. Before initialization, require Serena's user configuration to route
`project_serena_folder_location` to the reported private cache; ask before changing user config.
Do not allow target-local `.serena` by default. Also constrain symbol queries to target application
paths and discard any skill or memory-path result. Keep Serena
editing/refactoring tools disabled because this skill is analysis-only. If Serena fails, offer the
bundled ts-morph, ast-grep, and Acorn scan:

```text
node <skill-root>/scripts/find-patterns.js <target-root>
```

Treat all pattern matches as leads. Verify every selected lesson in live source. Candidate snippets
are Secretlint-checked, but run the dedicated check on each final extracted snippet file when
practical:

```text
node <skill-root>/scripts/check-snippet-secrets.js <target-root> <snippet-file>
```

### Duplication and structural debt

Run the bundled token-efficient jscpd analysis when duplication is relevant:

```text
node <skill-root>/scripts/scan-duplication.js <target-root>
```

Use clone results to select teaching examples; do not automatically recommend extracting every
duplicate. Verify whether the duplication represents the same responsibility.

### Third-party dependency debt

Use the model's separate `dependencies` collection and `dependency` nodes to connect declared
packages to observed source usage. Keep installed dependency trees, `node_modules/`, vendored code,
and build caches outside the authored application graph. Resolve exact and transitive versions from
lockfiles or permission-gated ecosystem metadata. When dependency debt matters, assess usage
centrality, critical-flow exposure, update distance, advisories, license, maintenance, bundle,
runtime, and build impact. Ask before network lookups or native metadata commands. Inspect installed
package source only as a targeted, explicitly approved deep dive.

```text
node <skill-root>/scripts/scan-dependencies.js <target-root> [--scope <relative-path>] --format json
```

Treat this static report as the baseline. Follow its capability chain only when current package risk
or exact ecosystem resolution can change the lesson.

### Security verification

Use Semgrep MCP first when exposed. Otherwise use the transparent CLI wrapper:

Constrain MCP scans to application paths and exclude `.repay-techdebt/`, the nested skill path, and
generated analyzer output.

```text
node <skill-root>/scripts/scan-security.js <target-root>
```

If Semgrep fails, ask before using the narrower Secretlint fallback:

```text
node <skill-root>/scripts/scan-security.js <target-root> --fallback secretlint
```

State that Secretlint detects credential exposure, not general vulnerabilities. Manually verify
authentication, authorization, data flow, control flow, and exploitability before teaching a
security finding.

### Current documentation

Use Context7 MCP when exposed. Otherwise use `ctx7 library <name> <query>` and then `ctx7 docs
<library-id> <query>`. If the functional query fails, offer setup/retry or authoritative official
documentation search. Resolve library names and versions from `<target-root>` manifests and imports,
not from the skill's dependencies. Never substitute model memory while claiming the documentation
is current.

### Oversized or remote context

Use Repomix only when the repository is remote, ordinary traversal is too large, or the agent needs
a compressed structural view. Use stdout or an external temporary output; do not create target
output by default. Always pass `<target-root>` as the input and exclude an in-repository `<skill-root>`
plus secret files, generated output, and dependencies. Prefer `repomix "<target-root>" --stdout
--compress --ignore ".repay-techdebt/**,<relative-skill-path>/**,graphify-out/**,.serena/**,repomix-output.*"`,
omitting the skill pattern when it is not nested. If Repomix fails, offer scoped file discovery and
a prioritized module outline. Do not run Repomix and Graphify over the whole repository by default
when one already provides sufficient context.

## Select the operating mode

Execute the ranked plan through the continuous zoom hierarchy: ecosystem, system, domain, flow,
module, symbol, function, and expression. Move outward to learn purpose and consequences; move
inward to verify exact mechanics. Never teach a module without establishing its known consumers,
dependencies, tests, configuration, and effects or naming the missing relationship evidence.

### PR Mentor

1. Gather change context through GitHub MCP or the approved local-Git fallback and exclude memory.
2. Re-rank the baseline plan around changed files, symbols, critical flows, and likely consumers.
3. Query Graphify for incoming/outgoing paths and blast radius; verify definitions and references
   with Serena.
4. Trace each selected change from registration/input to effect/outcome, including failure paths,
   tests, and compatibility constraints.
5. Apply only the highest-relevance security, correctness, performance, reliability, data,
   operability, UX, accessibility, or ecosystem lenses.
6. Inspect live source around each hunk and teach exact syntax/runtime behavior in its system
   context. Use the diff to select evidence, not as the sole description of current behavior.
7. When static evidence cannot answer execution, scale, latency, concurrency, or failure questions,
   read `<skill-root>/references/runtime-evidence.md` and generate a permission-gated runtime plan.

### Whole-App Workbook

1. Confirm or explicitly leave unresolved the program's purpose, users, critical workflows,
   authoritative state, and operational constraints.
2. Select representative critical flows across detected capabilities instead of summarizing every
   directory.
3. Map each flow across entry points, domains, modules, symbols, state, integrations, failure paths,
   tests, deployment, and runtime signals.
4. Apply the ranked lens plan and ecosystem packs. Use jscpd, security analysis, documentation, and
   runtime evidence only where they can change a conclusion or lesson.
5. Use Repomix only if size prevents useful coverage.
6. Organize lessons by dependency of understanding: purpose and flow, ownership and architecture,
   then exact mechanisms, algorithms, syntax, and trade-offs.
7. Generate a system atlas when it materially improves orientation. Keep it on stdout or in an
   agent temporary file unless the user approves persistence.

If the scope is too large for one useful response, provide the prioritized first module and a curriculum outline instead of compressing everything into shallow notes.

## Calibrate and write lessons

Apply the adaptive framework and evidence contract. For every candidate lesson:

1. Verify the pattern in source and distinguish observed facts from inference.
2. Establish known incoming consumers, outgoing dependencies, configuration, tests, and effects for
   the selected module or name the missing evidence.
3. Identify the smallest safe snippet that preserves the teaching point.
4. Explain exact language/runtime mechanics and project consequences within the detected stack,
   version, flow, and constraints.
5. Prefer concepts that improve debugging, extension, review, testing, or operations.
6. Do not assert a vulnerability, complexity class, framework pitfall, performance issue, or
   architecture pattern without checking relevant control flow, input scale, consumers, and context.

Before drafting, create a signal-qualified composition plan:

```text
node <skill-root>/scripts/plan-lesson.js <target-root> [--focus <path-question-or-concept>] [--kind <auto-or-shape>] [--depth concise|balanced|deep] [--scope <relative-path>] --format json
```

Read `<skill-root>/templates/lesson-format.md` and
`<skill-root>/references/lesson-composition.md`. Use the selected shape's required modules and only
the optional modules activated by strong focus-related signals. Inspect signal evidence and
limitations, then verify claims in live source. The planner is a composition aid, not current-code
truth and not proof of a defect. Enhanced tool evidence may strengthen or remove modules after a
successful operation; failed tools still follow the transparent fallback gate.

Keep the visible lesson simple: normally four to eight plain-language sections, no empty
placeholders, score tables, reason codes, or internal selection machinery. Apply PRIMM through the
chosen shape: Predict in the opening, Read and Run verified evidence, Investigate the mechanism,
Modify in the challenge, and Make in the recap. These are teaching moves, not fixed headings.

- Cite snippets with project-relative paths and line numbers.
- Redact sensitive literals and irrelevant business data.
- Include Mermaid, ASCII, or a table when it materially clarifies a relationship or flow.
- Make questions answerable from the lesson and challenges concrete.
- Use Context7 or authoritative official documentation when practical.

For a workbook, begin with a compact contents table and study order. End every mode with:

- a mental-model recap;
- two or three next concepts;
- unresolved evidence gaps;
- a **Tool Use Ledger** listing every attempted tool, operation, outcome, fallback, and limitation.

When initialized memory has `output.savePolicy: automatic` and the user explicitly requested a
lesson, save it as Markdown through `project-memory.js save-lesson`. Otherwise ask before saving.
The helper Secretlint-checks the draft and updates the lesson index. Record only user-confirmed
durable decisions, and update the curriculum with meaningful completed or next topics. Never store
raw analyzer output or unverified findings.

For schema-v2 memory, save a consented atlas, verified normalized snapshot, or sanitized notebook
through `project-memory.js save-artifact`. Snapshots require `--verified`; notebook execution counts
and outputs are removed. Include scope and evidence IDs when available. Markdown lessons remain the
default and typed artifacts remain progressive-disclosure references, not fresh source evidence.
