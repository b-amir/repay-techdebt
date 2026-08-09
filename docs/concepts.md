# Concepts

Why repay-techdebt differs from a generic code explainer, and how lessons stay honest.

## Evidence is a data model, not a writing style

Material claims carry an evidence state, confidence, provenance, observation time, and limitations.
The skill never upgrades an inference into a fact merely because the confidence score is high.

| State          | What it means                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `observed`     | Directly present in current source, configuration, test output, tool output, or runtime evidence |
| `derived`      | Deterministically computed from observed facts, such as containment or counts                    |
| `inferred`     | A supported explanation that still requires verification                                         |
| `hypothesis`   | A useful question or prediction without enough evidence yet                                      |
| `contradicted` | Credible sources disagree. Both are preserved for investigation                                  |
| `stale`        | Previously credible evidence predates a relevant change                                          |

## It moves continuously from system purpose to exact syntax

Analysis is not a directory inventory. Repay Tech Debt traverses eight zoom levels:

```text
ecosystem -> system -> domain -> flow -> module -> symbol -> function -> expression
```

It moves outward to establish purpose, ownership, consumers, dependencies, configuration, tests,
and effects. It moves inward to verify language semantics, control flow, algorithms, invariants,
and the exact lines that create the behavior.

## Lessons assemble themselves from strong signals

The lesson composer supports 12 primary shapes: architecture orientation, end-to-end flow, code
mechanics, change impact, debugging, security, performance, data/state, dependencies, operations,
testing, and UI interaction.

Optional sections appear only when they are relevant to the focus and supported by either two
independent target signals or one authoritative source. A framework package, suggestive filename,
or generic “best practice” is not enough. The internal plan can be complex. The lesson stays clear,
usually one focused subject in three to eight sections with no empty template headings.

## The target application stays clean

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

## Three modes

| Mode                   | Best for                                              | What it emphasizes                                                                            |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **PR Mentor**          | A pull request, branch, commit, or recent change      | Changed symbols, blast radius, compatibility, exact mechanics, and safe review questions      |
| **Whole-App Workbook** | An unfamiliar or AI-generated application             | Critical workflows, architecture, representative flows, progressive lessons, and a curriculum |
| **Focused Deep Dive**  | One module, concept, failure, or engineering question | A scoped evidence graph and the most relevant lesson shape                                    |

**Stored preference vs runtime mode:** `config.choices.mode` is `ask` \| `pr` \| `workbook` only
(`ask` = pick each session). Runtime `plan-analysis` / teach path also accepts `focused` for a
scoped deep dive. Focused is not a durable config enum. Pass `--mode focused` (or agent intent)
per run.

If PR context is requested without a ref, the local Git extractor intentionally compares
`HEAD~1` with `HEAD`. GitHub-hosted work prefers read-only GitHub MCP context when the active agent
exposes it and the repository identity is confirmed.

## What the bundled runtime understands

- Polyglot repository and monorepo profiling with explicit coverage budgets.
- Structured manifest and lockfile intelligence across common ecosystems.
- Relationship extractors for registered languages (deepest for JavaScript/TypeScript/Python.
  import/alias graphs for Gleam and Elixir. Other ecosystems report unsupported rather than guess).
- Components, conventional and learned boundaries, entry points, test relations, dependency use,
  critical-workflow hints, and ranked analysis lenses.
- Pattern discovery, architecture scans, dependency intelligence, duplication, secret scanning,
  PR diffs, system atlases, and permission-gated runtime-evidence plans.
- A ranked, resumable Markdown book index with 12–150 evidence-backed subjects based on repository
  scale. Completed lessons become links without regenerating the plan.
- Dynamic single-subject lessons with evidence-qualified modules, explicit omission reasons, and a
  writing-quality gate for length, headings, citations, paragraph focus, and generic filler.
- Private curriculum state, confirmed decisions, verified snapshots, atlases, and sanitized
  notebooks, plus a separately approved human-facing workbook.

The bundled registry currently includes 16 program/language packs, 10 framework packs, and 17
cross-cutting lenses spanning correctness, security, performance, reliability, data integrity,
privacy, accessibility, cost, reproducibility, memory safety, offline behavior, and quality.

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

## Design principles

1. **Evidence before advice.** Teach what this program actually does.
2. **Relationships before isolated snippets.** A function matters because something calls it and
   something changes afterward.
3. **Complex analysis, simple lessons.** Internal rigor should reduce reader effort.
4. **No silent confidence inflation.** Prefer available tools quietly. On miss, use the named
   bundled fallback with the same UX. Never claim a tool ran because it exists. Ask only before
   install/config or unauthorized writes.
5. **Private and target-pure by default.** Learning the system should not modify the system.
6. **Uncertainty is useful output.** Naming the missing evidence is better than confident fiction.
