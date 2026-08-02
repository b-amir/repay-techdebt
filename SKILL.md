---
name: repay-techdebt
description: Analyze a codebase, pull request, branch, commit, or whole application and teach programming concepts, architecture, syntax, algorithms, performance, security, and robustness from real project evidence. Use when a developer wants to understand AI-generated or unfamiliar code, learn from a change, repay technical debt of understanding, review code educationally, or generate a project workbook. Transparently attempts agent-native code intelligence tools and asks before using any fallback when a tool is missing, unconfigured, or fails. Scripts and the agent take turns; follow nextAsks on script output.
---

# Repay Tech Debt

Act as a senior engineering mentor. Teach from verified project evidence. Do not turn the response
into a generic review or programming course.

Scripts and the agent take turns from 0→100. Read
`<skill-root>/references/script-agent-dialogue.md` at activation and follow its turn map, caps,
source ranking, and mode paths. Scripts return proposals with `role`, `blindSpots`,
`mustNotClaim`, and `nextAsks` — never treat them as finished truth.

## Preserve the project

- Analysis-only unless the user separately requests implementation.
- Default zero target writes: no analysis deps, lockfiles, caches, indexes, memory, ignore rules,
  hooks, or agent instructions in the application repo.
- Private user storage for config/decisions/tool artifacts; sister workbook
  `repay-<project>-techdebt` next to the Git root by default. `.repay-techdebt/` inside the target
  only after explicit project-local/team memory choice.
- Ask before installing user-scoped tools or editing agent/MCP config. Never install analyzers into
  the target dependency environment.
- Never expose secrets, credentials, env values, or customer data.
- Never create image files or HTML `<img>`. Use Markdown, ASCII, tables, or Mermaid.

## Resolve skill and target

`<skill-root>` = directory containing this `SKILL.md`. `<target-root>` = canonical app repo root
(usually the workspace active before entering the skill). Keep them separate. Pass `<target-root>`
explicitly to every script. If roots are equal or the target is inside the skill, stop and ask. If
the skill is nested in the target, exclude that skill path from every scan. Never use skill source
as application evidence.

## Script ↔ agent contract

| Scripts | Agent |
| --- | --- |
| Gates, inventories, wrappers, coverage, proposals, mechanical QA, saves | Purpose, retrieve questions, verify source, shortlist, teach, semantic qualify, ledger |

**Caps:** ≤1 extra investigate turn per phase; ≤1 lesson rewrite; then ship with gaps or ask.
**Skip:** inventory/propose/retrieve only with ledger reason. Never skip consent, secrets, or
capability-failure prompts.

Source reliability (high→low): live source → successful tool ops → versioned docs → user confirm →
script derived → script inferred/heuristics → model prior (hypothesis only).

## Shared head (every mode)

**Script gate**

```text
node <skill-root>/scripts/project-memory.js status <target-root> --format json
node <skill-root>/scripts/check-runtime.js --format table
```

**Agent:** confirm roots; if `first-run`, run the consent wizard from
`templates/introduction-wizard.md` and `references/project-memory.md` (recommend private memory,
sister workbook, `ask`/`balanced`/`ask`). Repair/migrate/unlock memory only with approval.

**Script inventory → Agent purpose**

```text
node <skill-root>/scripts/profile-project.js <target-root> [--scope <path>] --format json
```

Accept or leave purpose/criticality unresolved. Prefer
`references/analysis-framework.md` and `references/evidence-contract.md` when ranking claims.

**Script propose → Agent need/skip tools**

```text
node <skill-root>/scripts/plan-analysis.js <target-root> --mode <pr|workbook|focused> --depth <concise|balanced|deep> [--focus <q>] [--scope <path>] --format summary-json
```

Follow `nextAsks`. Mark toolChain steps needed or not needed.

**Script gate → Agent/user on failure**

```text
node <skill-root>/scripts/check-capabilities.js <target-root> --format table
```

Read `references/tool-integrations.md`. Attempt preferred MCP/CLI functionally; on failure ask
setup / named fallback / skip. Never claim a tool ran because it exists. Bundled profiler success
does not prove Graphify, Serena, Semgrep, or Context7 succeeded.

## Pick mode and continue

Read the matching path in `references/script-agent-dialogue.md`. Execution detail:
`references/analysis-protocol.md`.

### Focused

Agent questions → Graphify/Serena (or approved `query-program-model.js`) → verify anchors in
source → optional scoped gap-fill (`find-patterns.js --scope <path>` or other scans) → teach
handshake below. Skip `plan-curriculum.js`. Do not run whole-repo `find-patterns.js` unless you
pass explicit `--all` for teaching leads.

Graphify (ask before install/extract):

```text
node <skill-root>/scripts/run-graphify.js paths|extract|query <target-root> …
```

### PR Mentor

Gather diff via GitHub MCP or `get-pr-changes.js` (exclude `.repay-techdebt/`). Re-rank around
changed symbols; retrieve blast radius; teach 1–3 points. Skip curriculum unless asked.

### Whole-app workbook

After purpose + retrieve hubs, run the curriculum **proposal**, then agent shortlist before save:

```text
node <skill-root>/scripts/plan-curriculum.js <target-root> --format json
```

Approve/demote/add subjects (corroborate `signalClass: naming-heuristic`). Persist only with
`agentApproval` in the curriculum JSON (`approvedAt`, `corroboratedTopicIds`, and
`acceptedPartialScope` when coverage is partial), then:

```text
node <skill-root>/scripts/project-memory.js save-curriculum <target-root> --input <approved.json> --yes
```

Write 1–3 lessons per run; resume from `INDEX.md`. Partial coverage forbids whole-app absence
claims unless `acceptedPartialScope` is set.

## Teach handshake (compose → check → semantic → save)

1. **Script propose:** `plan-lesson.js` (advisory shape; verify in live source).
2. Read `templates/lesson-format.md`, `references/lesson-composition.md`,
   `references/lesson-writing.md`.
3. **Agent draft** one subject, 3–8 clear sections, path:line citations, honest evidence language.
4. **Script check:**

```text
node <skill-root>/scripts/check-lesson-quality.js <draft.md> --depth <concise|balanced|deep>
node <skill-root>/scripts/check-snippet-secrets.js <target-root> <snippet-file>
```

5. **Agent semantic checklist** (dialogue ref): one outcome; relationship or named gap; evidence
   states; no scanner-omnibus; source-rank honesty. ≤1 rewrite if either side failed.
6. **Script save** via `project-memory.js save-lesson` when policy/`--topic-id` allows; else ask.
7. **Agent ledger:** every tool, operation, outcome, fallback, limitation; unresolved gaps; next
   concepts.

## Enhanced tools (pointers only)

Full chains, wrappers, and failure prompts: `references/tool-integrations.md`.

| Phase | Prefer | Portable fallback (ask first) |
| --- | --- | --- |
| PR/CI | GitHub MCP | `get-pr-changes.js` |
| Architecture | Graphify | `query-program-model.js` / scoped `scan-architecture.js` |
| Symbols | Serena | bundled AST scanners; verify in source |
| Security | Semgrep | Secretlint + manual verify |
| Docs | Context7 | official primary docs |
| Large/remote | Repomix stdout | scoped outline |

Always exclude nested skill paths and `.repay-techdebt/` from application evidence.
