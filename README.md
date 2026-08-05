<p align="center">
  <img src="https://raw.githubusercontent.com/b-amir/repay-techdebt/main/assets/readme/hero.svg" width="100%" alt="Repay Tech Debt turns target code into an evidence-qualified program model and clear engineering lessons">
</p>

<p align="center">
  <a href="https://skills.sh/b-amir/repay-techdebt"><img src="https://img.shields.io/badge/skills.sh-repay--techdebt-000000" alt="Install from skills.sh"></a>
  <a href="https://agentskills.io/"><img src="https://img.shields.io/badge/Agent%20Skills-compatible-111111" alt="Agent Skills compatible"></a>
  <a href="https://github.com/b-amir/repay-techdebt/actions/workflows/validate.yml"><img src="https://github.com/b-amir/repay-techdebt/actions/workflows/validate.yml/badge.svg" alt="Validate skill"></a>
  <img src="https://img.shields.io/badge/node.js-22%2B-339933?logo=node.js&logoColor=white" alt="Node.js 22+">
  <a href="https://github.com/b-amir/repay-techdebt/blob/main/LICENSE"><img src="https://img.shields.io/github/license/b-amir/repay-techdebt" alt="MIT license"></a>
</p>

<p align="center">
  <strong>Pay down technical debt of understanding.</strong><br>
  Learn the architecture, flows, syntax, algorithms, risks, and trade-offs already hiding in your codebase.
</p>

```bash
npx skills add b-amir/repay-techdebt
```

`repay-techdebt` is an open Agent Skill for developers who have working code they do not fully
understand—especially AI-generated code, unfamiliar systems, inherited applications, and dense pull
requests. It acts like a senior engineering mentor: it builds an evidence-qualified model of the
actual project, chooses the highest-value questions, and teaches from verified examples instead of
reciting generic best practices.

It is analysis-only by default. It does not refactor the application, install analyzers into the
target, hide a failed tool behind a weaker fallback, or treat an old lesson as proof of current
behavior.

## See the idea in one prompt

```text
Use $repay-techdebt to trace authentication from the request boundary to data access.
Teach me what protects the flow, who consumes it, how it fails, and how I can change it safely.
```

A focused run first builds and qualifies evidence, then produces a compact plan like this:

```text
# Lesson Plan

Shape: Security boundary
Focus: authentication

1. What needs protection
2. Where trust changes
3. How the control works
4. Failure and abuse cases
5. How to prove it

Activated because the evidence is strong:
- Who depends on this
- Tests and confidence

Evidence gaps:
- Runtime traffic and production authorization outcomes are still unknown.
```

The final lesson verifies live source, cites project-relative paths and lines, distinguishes facts
from inference, and ends with unresolved gaps plus a tool-use ledger.

## Why this is different

### Evidence is a data model, not a writing style

Material claims carry an evidence state, confidence, provenance, observation time, and limitations.
The skill never upgrades an inference into a fact merely because the confidence score is high.

| State          | What it means                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `observed`     | Directly present in current source, configuration, test output, tool output, or runtime evidence |
| `derived`      | Deterministically computed from observed facts, such as containment or counts                    |
| `inferred`     | A supported explanation that still requires verification                                         |
| `hypothesis`   | A useful question or prediction without enough evidence yet                                      |
| `contradicted` | Credible sources disagree; both are preserved for investigation                                  |
| `stale`        | Previously credible evidence predates a relevant change                                          |

### It moves continuously from system purpose to exact syntax

Analysis is not a directory inventory. Repay Tech Debt traverses eight zoom levels:

```text
ecosystem -> system -> domain -> flow -> module -> symbol -> function -> expression
```

It moves outward to establish purpose, ownership, consumers, dependencies, configuration, tests,
and effects. It moves inward to verify language semantics, control flow, algorithms, invariants,
and the exact lines that create the behavior.

### Lessons assemble themselves from strong signals

The lesson composer supports 12 primary shapes: architecture orientation, end-to-end flow, code
mechanics, change impact, debugging, security, performance, data/state, dependencies, operations,
testing, and UI interaction.

Optional sections appear only when they are relevant to the focus and supported by either two
independent target signals or one authoritative source. A framework package, suggestive filename,
or generic “best practice” is not enough. The internal plan can be complex; the lesson stays clear,
usually one focused subject in three to eight sections with no empty template headings.

### The target application stays clean

The skill, its runtime, the target repository, persistent memory, and disposable tool caches are
separate concerns. Private external storage is the default.

| Side effect                                                                        | Default                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| Target dependencies, manifests, lockfiles, hooks, agent instructions, ignore files | Denied                                            |
| Graphs, indexes, analyzer caches                                                   | External private cache or temporary storage       |
| Configuration, decisions, curriculum state                                         | External private state, created only with consent |
| Human-facing workbook                                                              | Named sister folder outside the Git repository    |
| User-scoped tools and MCP configuration                                            | Ask before installation or modification           |
| Application code changes                                                           | Out of scope unless separately requested          |

Project-local or team-visible `.repay-techdebt/` memory is available only after an explicit choice.
Session-only operation creates no durable memory.

## How it works

<p align="center">
  <img src="https://raw.githubusercontent.com/b-amir/repay-techdebt/main/assets/readme/workflow.svg" width="100%" alt="Repay Tech Debt resolves the target, models the program, ranks questions, gates enhanced tools, and composes clear lessons">
</p>

1. **Resolve the target.** The skill installation and analyzed application are kept separate. An
   in-repository skill installation is excluded from every scan.
2. **Load preferences safely.** A first-run wizard can create private memory, project-local memory,
   team memory, or nothing at all.
3. **Take turns.** Bundled scripts inventory, gate, and propose (`nextAsks`); the agent confirms
   purpose, retrieves with Graphify/Serena when available, verifies live source, and teaches.
4. **Rank the investigation.** Questions are prioritized by request, focus, program type, graph
   evidence, and impact—not by a universal checklist. Script plans are proposals, not finished truth.
5. **Approve the book index.** A whole-app run proposes a broad subject inventory; the agent
   shortlists before save, then writes 1–3 lessons per run.
6. **Use stronger tools when they matter.** Each phase has an explicit capability ladder and failure
   gate.
7. **Qualify and teach.** Mechanical lesson QA plus one agent semantic pass; cite paths and lines;
   end with gaps and a tool-use ledger.

For maintenance flags (`--clear-output`, `--reset`, `--reconfig`, `--view`), the local workbook
viewer, and CLI examples, see **[docs/manual.md](docs/manual.md)**. Control-flow and exit-code
detail lives in **[docs/how-it-works.md](docs/how-it-works.md)**.

The bundled registry currently includes 16 program/language packs, 10 framework packs, and 17
cross-cutting lenses spanning correctness, security, performance, reliability, data integrity,
privacy, accessibility, cost, reproducibility, memory safety, offline behavior, and quality.

## Three ways to use it

| Mode                   | Best for                                              | What it emphasizes                                                                            |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **PR Mentor**          | A pull request, branch, commit, or recent change      | Changed symbols, blast radius, compatibility, exact mechanics, and safe review questions      |
| **Whole-App Workbook** | An unfamiliar or AI-generated application             | Critical workflows, architecture, representative flows, progressive lessons, and a curriculum |
| **Focused Deep Dive**  | One module, concept, failure, or engineering question | A scoped evidence graph and the most relevant lesson shape                                    |

If PR context is requested without a ref, the local Git extractor intentionally compares
`HEAD~1` with `HEAD`. GitHub-hosted work prefers read-only GitHub MCP context when the active agent
exposes it and the repository identity is confirmed.

## Transparent tool integration

The bundled model is always the baseline. Optional AI-native and specialized tools add fidelity;
their presence alone is never reported as success.

| Capability                    | Preferred path                               | Explicit fallback                                                              |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| PR and CI context             | GitHub MCP read-only tools                   | Bundled local Git extractor                                                    |
| Architecture and blast radius | Graphify MCP or target-pure Graphify wrapper | Bundled relationship model; scoped dependency-cruiser/tree only after approval |
| Symbols and references        | Serena MCP or a language-aware compiler/LSP  | Bundled ts-morph, ast-grep, Acorn, then direct source verification             |
| Security                      | Semgrep MCP or CLI                           | Secretlint plus manual control/data-flow verification                          |
| Current library documentation | Context7 MCP or CLI                          | Authoritative official documentation search                                    |
| Very large or remote context  | Repomix MCP or CLI                           | Scoped discovery and prioritized module outline                                |
| Duplication                   | Bundled jscpd                                | Manual representative search                                                   |

When a needed tool fails, the skill stops before downgrading and explains:

```text
what failed -> capability lost -> setup or repair -> exact fallback and limitation
```

The user chooses whether to set it up and retry, accept the named fallback, or skip that phase. The
final Tool Use Ledger records every attempted operation and downgrade.

## Install

This repository is a standalone Agent Skill. It is designed for agents that load the open
`SKILL.md` format rather than one vendor-specific directory layout.

```bash
npx skills add b-amir/repay-techdebt
```

From a local checkout, use the skills CLI:

```bash
pnpm dlx skills add . --skill repay-techdebt
```

The same repository can be installed from its Git source after publication; skills.sh will display
the exact repository command. The bundled scripts require Node.js 22 or newer. On first use, the
agent runs the dependency-free runtime preflight and must disclose missing packages before asking
whether to install or continue manually.

### Agent compatibility

The workflow is designed to remain portable across Codex, Claude Code, Cursor, OpenCode,
Antigravity, and other agents that support Agent Skills or can load a `SKILL.md`. Optional MCP tools
are discovered from the active agent at runtime; the skill does not assume every agent exposes the
same integrations.

## Start learning

Once installed, you can start the learning flow using the new `repay` CLI from within the repository you want to understand:

```bash
repay init
```

For specific inquiries, you can pass a plan context:

```bash
repay plan "Start with the flows I need to understand before changing production code."
repay plan "Trace each important change to its consumers, tests, failure paths, and deployment consequences."
```

On the first run, the agent asks if you want to use the Fast or Control setup flow. Fast uses recommended defaults: private machine memory, a discoverable `repay-<project>-techdebt` sister workbook, balanced depth, automatic saves, and the whole-app workbook mode.

You can later open the generated lesson workbook using:

```bash
repay view
```

## What the bundled runtime understands

- Polyglot repository and monorepo profiling with explicit coverage budgets.
- Structured manifest and lockfile intelligence across common ecosystems.
- AST-derived JavaScript, TypeScript, Python, Gleam, and Elixir relationships, with unsupported
  relationship languages reported rather than guessed.
- Components, conventional and learned boundaries, entry points, test relations, dependency use,
  critical-workflow hints, and ranked analysis lenses.
- Pattern discovery, architecture scans, dependency intelligence, duplication, secret scanning,
  PR diffs, system atlases, and permission-gated runtime-evidence plans.
- A ranked, resumable Markdown book index with 12–150 evidence-backed subjects based on repository
  scale; completed lessons become links without regenerating the plan.
- Dynamic single-subject lessons with evidence-qualified modules, explicit omission reasons, and a
  writing-quality gate for length, headings, citations, paragraph focus, and generic filler.
- Private curriculum state, confirmed decisions, verified snapshots, atlases, and sanitized
  notebooks, plus a separately approved human-facing workbook.

## Limits are part of the result

- Static evidence cannot prove runtime frequency, latency, production scale, failure rates, or user
  impact. Those claims require permission-gated runtime or operational evidence.
- Static graphs can miss dependency injection, reflection, generated bindings, event routing,
  runtime dispatch, database relationships, and network calls.
- Partial, scoped, truncated, unsupported, and parser-error coverage is reported explicitly. A
  partial model cannot support whole-application absence claims.
- A scanner lead is not automatically a vulnerability, bottleneck, architecture defect, or useful
  abstraction. The agent verifies control flow, context, and consequences first.
- Saved memory is historical context, never fresh code evidence.

## Repository map

```text
repay-techdebt/
├── SKILL.md                 # vendor-neutral agent workflow
├── docs/
│   ├── manual.md            # maintenance flags, viewer, CLI quick reference
│   └── how-it-works.md      # control-flow contracts and exit codes
├── agents/openai.yaml       # optional product metadata
├── packs/                   # languages, frameworks, capabilities, lenses
├── references/              # evidence, analysis, memory, tools, runtime contracts
├── templates/               # first-run and dynamic lesson composition
├── scripts/
│   ├── lib/                 # program graph, relationships, manifests, storage, tooling
│   └── *.js                 # read-only analyzers, planners, wrappers, memory CLI
└── test/                    # integration and contract tests
```

## Develop and validate

```bash
vp install
vp check
vp test
```

Useful release checks:

```bash
node scripts/check-runtime.js --format table
pnpm dlx skills add . --list
```

The test suite exercises target isolation, project memory consent, polyglot and monorepo modeling,
relationship extraction, evidence identity, manifest adapters, dynamic lesson composition, tool
failure behavior, and CLI integration.

## Design principles

1. **Evidence before advice.** Teach what this program actually does.
2. **Relationships before isolated snippets.** A function matters because something calls it and
   something changes afterward.
3. **Complex analysis, simple lessons.** Internal rigor should reduce reader effort.
4. **No silent downgrade.** Missing capability is a user decision, not a hidden implementation
   detail.
5. **Private and target-pure by default.** Learning the system should not modify the system.
6. **Uncertainty is useful output.** Naming the missing evidence is better than confident fiction.
