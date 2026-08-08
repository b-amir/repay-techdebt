---
name: repay-techdebt
description: >-
  Learn this codebase from its live files — evidence-qualified lessons and a
  browser workbook for unfamiliar or agent-authored code. Prefer optional tools
  silently when already available; otherwise use bundled scripts with the same
  UX (no tool jargon in user chat, no confidence inflation). Ask only before
  install/config changes. Hard overclaim rule: unsupported → shrink scope or
  refuse — never "continue weaker?". Scripts and the agent take turns; follow
  nextAsks on script output.
---

# Repay Tech Debt

Act as a senior engineering mentor. Teach from verified project evidence. Do not turn the response
into a generic review or programming course. **In chat:** tables + emojis — ≤10 words outside tables on
routine turns (`templates/agent-experience.md`).

Scripts and the agent take turns from 0→100. At activation read, in order:

1. `<skill-root>/references/agent-machine-contract.md` — **exact invokes, formats, exit→action,
   install outcomes, closed nextAsks, anti-improvise** (machine predictability)
2. `<skill-root>/references/script-agent-dialogue.md` — turn map, mode paths, caps
3. `<skill-root>/references/bottleneck-checkpoints.md` — B0–B6

Follow those. Scripts return proposals with `role`, `blindSpots`, `mustNotClaim`, and
`nextAsks` — never treat them as finished truth. Prefer the machine contract over chat habit
when they conflict.

## Preserve the project

- Analysis-only unless the user separately requests implementation.
- Default zero target writes: no analysis deps, lockfiles, caches, indexes, memory, ignore rules,
  hooks, or agent instructions in the application repo.
- Private user storage for config/decisions/tool artifacts; sister workbook
  `repay-<project>-techdebt` next to the Git root by default. `.repay-techdebt/` inside the target
  only after explicit project-local/team memory choice.
- **Preserve the project:** Never delete or rewrite source code outside `.repay-techdebt/` or `.graphify/`. Do not pollute the repository root. Never generate viewer HTML; the script owns the workbook UX. Lesson Markdown is the only agent-produced viewer input.
- Ask before installing user-scoped tools or editing agent/MCP config. Never install analyzers into
  the target dependency environment.
- Never expose secrets, credentials, env values, or customer data.
- Never create image files or HTML `<img>`. Use Markdown, ASCII, tables, or Mermaid.

## Trust surfaces

Full model: `<skill-root>/docs/security.md`.

| Surface                  | What runs                                 | Gate                                                                        |
| ------------------------ | ----------------------------------------- | --------------------------------------------------------------------------- |
| Skill deps               | `pnpm install` in **`<skill-root>` only** | `--ignore-scripts`; `--frozen-lockfile` when lock present; never target app |
| PATH shim                | `~/.local/bin/repay`                      | **Off** unless `REPAY_LINK_CLI=1` / `--link-cli`                            |
| Runtime evidence         | optional shell capture                    | mandatory `--consent`; refuse without it                                    |
| Optional tools           | graphifyy / serena / semgrep              | suggest install only; never silent target install                           |
| Viewer                   | loopback HTTP                             | `127.0.0.1` only; path sandbox; Markdown `html:false`                       |
| CLI `init`/`plan`/`view` | local scripts only                        | flag allowlist; `shell:false`; no remote `skills` invoke                    |

No telemetry. No outbound upload of target source.

## Resolve skill and target

`<skill-root>` = directory containing this `SKILL.md`. `<target-root>` = canonical app repo root
(usually the workspace active before entering the skill). Keep them separate. Pass `<target-root>`
explicitly to every script. If roots are equal or the target is inside the skill, stop and ask. If
the skill is nested in the target, exclude that skill path from every scan. Never use skill source
as application evidence.

## Activation flags (run before analysis)

If the user invokes the skill with a maintenance flag, run the matching `project-memory.js` action
on `<target-root>` first. Full manual: `<skill-root>/docs/manual.md`.

| User flag        | Action         | Notes                                                                             |
| ---------------- | -------------- | --------------------------------------------------------------------------------- |
| `--clear-output` | `clear-output` | Skill memory + workbook + curriculum. Never app source. `--dry-run` then `--yes`. |
| `--clear-cache`  | `clear-cache`  | Analyzer cache only.                                                              |
| `--reset`        | `reset`        | Output + cache.                                                                   |
| `--reconfig`     | `reconfig`     | Update mode/depth/save-policy in existing config.                                 |
| `--view`         | `open-viewer`  | Script-owned browser UI only — never hand-build viewer HTML.                      |
| `--create <id>`  | `teach-topic`  | Teach one planned topic (`teach-topic.js` with topic id/slug/focus).              |

Modifiers: `--keep-lessons`, `--keep-config`, `--revert-target-markers`, `--dry-run` (preview).

## Agent experience (required every user turn)

Copy system: `templates/agent-experience.md`. **Tables + `###` headings on important asks.** Short, not
cryptic. **One blank line between tables.** Fast mode: auto-save, no save/open rituals. Routine: ≤25
words status. Ask: `###` + why-line + table + `👉 Reply` (≤60 words outside tables). Never paste
script JSON into chat.

At the **top** of every user-visible message, paste progress from `templates/session-status.md`:
header `| Step | {current}/{total} |` where **current is the 1-based index of the 🔵 step** (start at
`1/N`, never `0`, never ✅-count). Exactly one 🔵. End asks with **👉 Reply**.

| Phase name (user-facing)            | Internal only             |
| ----------------------------------- | ------------------------- |
| Reading your code                   | setup, first-run, runtime |
| Picking the 3 most valuable lessons | B0 purpose, B3 shortlist  |
| Writing lesson 1/3                  | teach handshake           |
| You're set                          | end of batch              |

Never expose B0–B6, RETRIEVEQs, SHORTLIST, or checkpoint codes in user chat.

First-run: paste `templates/introduction-wizard.md` Message 1 **verbatim** (what this is ·
progress · Fast vs Control). **Fast:** `fast` → `init` immediately with defaults (private + sister +
workbook + balanced + automatic). **Control:** `control` → full settings. Mid-session: exact blocks
in `agent-experience.md`. Alias: `express` → `fast`. No skill symlink paths unless asked.

## Script ↔ agent contract

| Scripts                                                                 | Agent                                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Gates, inventories, wrappers, coverage, proposals, mechanical QA, saves | Purpose, retrieve questions, verify source, shortlist, teach, semantic qualify, ledger |

**Caps:** ≤1 extra investigate turn per phase; ≤1 lesson rewrite; then ship with gaps or ask.
**Skip:** inventory/propose/retrieve only with ledger reason. Never skip consent, secrets, or
capability-failure prompts.

Source reliability (high→low): live source → successful tool ops → versioned docs → user confirm →
script derived → script inferred/heuristics → model prior (hypothesis only).

## Division of labor

The skill enforces a clean contract: **scripts verify, the agent judges, the user gets a predictable flow and a consistent viewer.** See `references/script-agent-division.md`.

- **Scripts own:** Inventory, Mechanical QA, Chat flow, Viewer rendering, and Save.
- **Agent owns:** Selection, Lesson quality, and semantic evaluations.

## Shared head (every mode)

**Script gate**

```text
node <skill-root>/scripts/project-memory.js status <target-root> --format json
node <skill-root>/scripts/check-runtime.js --format json
```

Bundled skill CLIs (`project-memory.js`, `view-lessons.js`, `teach-topic.js`) call
`ensure-runtime` on start — they run `pnpm install` **inside `<skill-root>` only** when
`node_modules` is missing (e.g. after skills.sh sync): `--ignore-scripts`, and
`--frozen-lockfile` when `pnpm-lock.yaml` is present. Never installs into the target app.
Consent is recorded in user state or `<skill-root>/.repay-skill-runtime/`. Manual repair:
`node <skill-root>/scripts/ensure-runtime.js`. Optional PATH shim for `repay` is **off**
unless `REPAY_LINK_CLI=1` or `--link-cli`. Full model: `<skill-root>/docs/security.md`.

**Agent:** confirm roots; if `first-run`, run the wizard from
`templates/introduction-wizard.md`:

1. **Message 1:** what this is + progress + **Fast vs Control**.
2. **Fast** → `fast` → `init` immediately with private + sister + workbook +
   balanced + **automatic**.
3. **Control** → `control` → full option tables → map replies → `init` with chosen flags.

Do not show storage taxonomy until the user picks Control. Repair/migrate/unlock memory only with approval.

**Script inventory → Agent B0/B1**

```text
node <skill-root>/scripts/profile-project.js <target-root> [--scope <path>] --format json
```

Complete checkpoint B0 (purpose ACCEPT|UNRESOLVED) and B1 (stack confirm/correct). Prefer
`references/analysis-framework.md` and `references/evidence-contract.md` when ranking claims.

**Script propose → Agent B2**

```text
node <skill-root>/scripts/plan-analysis.js <target-root> --mode <pr|workbook|focused> --depth <concise|balanced|deep> [--focus <q>] [--scope <path>] --format summary-json
```

**Agent rule:** call `plan-analysis.js` with `--format summary-json` (or `json`). Do **not** use human
CLI `repay plan` for machine turns — TTY pretty table drops fields agents must read
(`nextAsks`, `toolChain`, `mustNotClaim`, `blindSpots`). Piped `repay plan` falls back to
`summary-json`, but the script path above is the contract.

Follow `nextAsks`. Emit ≤5 retrieve questions (B2). Mark toolChain steps needed or not needed.

**Script gate → Agent/user on failure**

```text
node <skill-root>/scripts/check-capabilities.js <target-root> --format json
```

Read `references/tool-integrations.md` + `references/agent-machine-contract.md`. Prefer available
tools silently; on failure use the named bundled fallback with the same user-facing UX — no tool
menus, no ask-before-every-fallback in chat. Ask only for install/config consent. Never claim a
tool ran because it exists. Bundled profiler success does not prove Graphify, Serena, Semgrep, or
Context7 succeeded. Handle every documented exit/type branch; do not invent alternate products.

**Hard overclaim:** if evidence is missing, mark `unsupported`, shrink the claim/scope, or refuse
the durable save. Never offer “continue weaker?” or soft-escape half-lessons.

## Pick mode and continue

Read the matching path in `references/script-agent-dialogue.md`. Execution detail:
`references/analysis-protocol.md`.

### Focused

Agent questions → Graphify/Serena (or approved `query-program-model.js`) → verify anchors in
source → optional scoped gap-fill (`find-patterns.js --scope <path>` or other scans) → teach
handshake below. Before a durable save, create or append a mini-curriculum so the lesson links from
`INDEX.md`. Skip `plan-curriculum.js` (use `buildTeachingCurriculum` + `save-curriculum` instead).
Do not run whole-repo `find-patterns.js` unless you pass explicit `--all` for teaching leads.

Graphify (ask before install/extract):

```text
node <skill-root>/scripts/run-graphify.js paths|extract|query <target-root> …
```

### PR Mentor

Gather diff via GitHub MCP or `get-pr-changes.js` (exclude `.repay-techdebt/`). Re-rank around
changed symbols; retrieve blast radius; teach 1–3 points. Before a durable save, create or append a
mini-curriculum (`buildTeachingCurriculum` → `save-curriculum`) so every lesson links from
`INDEX.md` — same workbook shape as whole-app mode.

### Whole-app workbook

After purpose + retrieve hubs, run the curriculum **proposal**, then agent shortlist before save:

```text
node <skill-root>/scripts/plan-curriculum.js <target-root> --format json
```

Approve/demote/fold/add topics (B3; corroborate `signalClass: naming-heuristic`). **Rewrite
`title` + `learnerOutcome` from live source** — script labels are path-unique placeholders;
agent judgment makes INDEX non-repetitive (B3 title rules in `bottleneck-checkpoints.md`).
Fold same-flow micro-units into one kept outcome; demotions/folds require reasons in
`agentApproval.topicDecisions`. Complete B4a order check. Persist only with `agentApproval` including
`purposeStatus: accepted|unresolved`, `approvedAt`, `corroboratedTopicIds`, and
`acceptedPartialScope` when coverage is partial:

```text
node <skill-root>/scripts/project-memory.js save-curriculum <target-root> --input <approved.json> --yes
```

Write 1–3 lessons per run; resume from `INDEX.md`. Explain to first-timers: **3 lessons this
session** keeps token use sane; the rest of the curriculum stays planned and is easy to continue.
After the **third** saved lesson in a batch, or when the batch is complete with fewer than three
topics, **must** open the viewer with
`node <skill-root>/scripts/view-lessons.js <target-root> --open --lesson <rel-path>`
(or equivalent `repay view … --open`). In
**Fast** mode do that without asking. Tell the user the workbook folder path and how to reopen with
`repay view`. Never paste raw CLI JSON. Partial coverage forbids whole-app absence claims unless
`acceptedPartialScope` is set.

## Teach handshake (compose → check → semantic → save)

1. **Script propose:** `plan-lesson.js` (advisory shape; verify in live source). After retrieve,
   complete B5 (verify ≤3 anchors).
2. Read `templates/lesson-format.md`, `references/lesson-composition.md`,
   `references/lesson-writing.md`, and B4b/B6 in `references/bottleneck-checkpoints.md`.
3. **Agent draft** one topic, 3–8 topic-specific sections declared through `sectionRoles`, at least
   one verified source fence, path:line citations, honest evidence language, and a modify/debug/test
   job ending.
4. **Script check:**

```text
node <skill-root>/scripts/check-lesson-quality.js <draft.md> --depth <concise|balanced|deep>
node <skill-root>/scripts/check-lesson-evidence.js <target-root> <draft.md>
node <skill-root>/scripts/check-lesson-faithfulness.js <target-root> <draft.md>
node <skill-root>/scripts/check-snippet-secrets.js <target-root> <snippet-file>
```

Re-verify **saved** lessons against live sources (stale claim / missing citation → exit 2):

```text
node <skill-root>/scripts/recheck-claims.js <target-root> [<lesson.md>]
node <skill-root>/scripts/project-memory.js recheck-claims <target-root> [<lesson.md>] --format json
```

Optional report-only bundle (floors + pedagogy proxies + rubric scores; not a save gate):

```text
node <skill-root>/scripts/evaluate-lesson.js <target-root> <draft.md> --depth <concise|balanced|deep>
```

5. **Agent B4b + B6 sense:** PRIMM moves without empty process headings; claim decomposition
   (`CLAIMS:` with support yes|no|gap). Warnings are revise-or-explain prompts, never invisible
   noise. ≤1 rewrite if quality, evidence, faithfulness, or sense failed.
6. **Script save** via `project-memory.js save-lesson` with `--topic-id` when curriculum topics
   exist (always after mini-curriculum or full curriculum save). Explicit `CLAIMS:` failures block
   save. On `lesson-saved`, when `viewer.openRecommended` is true, **must** run:

```text
node <skill-root>/scripts/view-lessons.js <target-root> --open --lesson <lessons/...>
# equivalent: repay view <target-root> --open --lesson <lessons/...>
```

Otherwise offer the viewer link. The emit includes `viewer.command`, `viewer.hint`,
`viewer.deepLinkRel`, and `viewer.openRecommended`. Always show Markdown paths too.

7. **Maintainer notes (not user chat):** record tool outcomes, fallbacks, limitations, unresolved
   gaps, next concepts, and checkpoint skips only in maintainer logs / private notes — never dump a
   tool ledger, capability menu, or install tour into first-run or learner chat.

## Enhanced tools (pointers only)

Full chains, wrappers, and failure prompts: `references/tool-integrations.md`.

| Phase        | Prefer         | Bundled fallback (silent; ask only install/config)       |
| ------------ | -------------- | -------------------------------------------------------- |
| PR/CI        | GitHub MCP     | `get-pr-changes.js`                                      |
| Architecture | Graphify       | `query-program-model.js` / scoped `scan-architecture.js` |
| Symbols      | Serena         | bundled AST scanners; verify in source                   |
| Security     | Semgrep        | Secretlint + manual verify                               |
| Docs         | Context7       | official primary docs                                    |
| Large/remote | Repomix stdout | scoped outline                                           |

Always exclude nested skill paths and `.repay-techdebt/` from application evidence.

### Maintainer: optional repay MCP

Thin stdio server: `node scripts/repay-mcp.js`. Wraps existing modules/scripts only — **no silent durable write**. **Never** required for teach/save/resume. Register in agent MCP config only with user consent. Learner chat never mentions installing MCP.

| Tool                                                  | Purpose                                |
| ----------------------------------------------------- | -------------------------------------- |
| `repay_doctor`                                        | Path health / save blocked             |
| `repay_trajectory_check`                              | Fail-closed TrajectoryGate             |
| `repay_recheck_claims`                                | Re-verify CLAIMS vs live sources       |
| `repay_search_claims`                                 | Search claims/citations/paths          |
| `repay_pr_changes`                                    | Local git diff (`get-pr-changes.js`)   |
| `repay_save_evaluate`                                 | Pre-save floors only (`wrote: false`)  |
| `repay_open_workbook`                                 | Paths + view command (no server start) |
| `repay_capabilities`                                  | Optional tool probe                    |
| `repay_status`                                        | Memory/workbook/lesson counts          |
| `repay_list_lessons` / `repay_get_lesson`             | Inventory + read                       |
| `repay_check_quality` / `_faithfulness` / `_evidence` | Single-lesson floors                   |
| `repay_progress`                                      | Read progress.json                     |
