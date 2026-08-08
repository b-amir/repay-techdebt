# Agent machine contract

**Read once at skill activation** (with `script-agent-dialogue.md`).  
Goal: same inputs → same script path → predictable exit + JSON shape.  
If this file and chat habit conflict, **this file wins** for machine turns.

Code source of truth for closed `nextAsks[].do`:
`src/dialogue/dialogue-envelope.js` → `CLOSED_NEXT_ASK_DOS` (enforced at envelope build).

## Absolute rules

1. **Invoke scripts, not human CLI**, for analysis/save/gate turns:
   - ✅ `node <skill-root>/scripts/<name>.js …`
   - ❌ `repay plan|init|status` as the agent machine path (TTY pretty tables drop fields)
   - Exception: after durable save, **open viewer** may use `repay view … --open` _or_
     `node …/view-lessons.js … --open` (same script under the hood). Prefer the `node` form.
2. **Always pass explicit `--format`** on agent turns. Never rely on “default looks fine.”
3. **Always pass `<target-root>`** as an absolute or workspace-resolved path.
4. **Parse stdout JSON** when format is `json` / `summary-json`. Never paste raw JSON into user chat.
5. **Take `nextAsks`** — do not invent a parallel workflow. Unknown `do` → treat as
   `unsupported-shrink-or-refuse` and stay on the mode path in `script-agent-dialogue.md`.
6. **One primary script per turn phase.** No “also try repomix / codegraph / random MCP”
   unless `toolChain` or this contract names it.
7. **Caps:** ≤1 extra investigate turn per phase; ≤1 lesson rewrite; then ship with gaps or ask.
8. **Exit 2 = defined branch**, not failure to switch product. Read `type` / `requiredAction`.

## Exit codes → agent action

| Exit  | Meaning                                                            | Agent action                                                                                                              |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **0** | Success envelope on stdout                                         | `TAKE` fields; continue mode path                                                                                         |
| **1** | Hard failure (bad args, `TargetRootError`, uncaught)               | Stop phase; fix args/roots or report; do not invent alternate tool                                                        |
| **2** | Soft stop: consent, already-exists, not-ready, quality/gate refuse | Read JSON/`requiredAction`; ask user or follow named next step; **do not** re-run with different flags to “force” success |

Never treat exit 2 as “try another product.” It is a **defined branch**.

## Format matrix (agent turns)

| Script                                                 | Agent `--format`    | Script default if omitted                           |
| ------------------------------------------------------ | ------------------- | --------------------------------------------------- |
| `project-memory.js status`                             | `json`              | `table` (CLI `repay status`: TTY table / pipe json) |
| `project-memory.js init` / mutations                   | `json`              | `json`                                              |
| `project-memory.js doctor` / recheck-* / search-claims | `json` when parsing | table-ish for humans                                |
| `check-runtime.js`                                     | `json`              | TTY `table` / non-TTY `json`                        |
| `check-capabilities.js`                                | `json`              | TTY `table` / non-TTY `json`                        |
| `profile-project.js`                                   | `json`              | `json`                                              |
| `plan-analysis.js`                                     | **`summary-json`**  | full `json` if omitted; never table for agents      |
| `plan-curriculum.js`                                   | **`summary-json`**  | `summary-json`                                      |
| `plan-lesson.js`                                       | `json`              | `json`                                              |
| `build-program-model.js` / `query-program-model.js`    | `json`              | `json` (table only human paste)                     |
| `find-patterns.js`                                     | `json`              | json envelope                                       |
| `check-lesson-quality.js`                              | `json`              | `json`                                              |
| `check-lesson-evidence.js` / faithfulness              | `json`              | `json`                                              |
| `evaluate-lesson.js` / `recheck-claims.js`             | `json`              | `json`                                              |
| `ensure-runtime.js`                                    | `json`              | `json`                                              |
| `run-graphify.js` / tool wrappers                      | json envelopes      | consent + AnalyzerResult                            |
| `view-lessons.js`                                      | n/a (server)        | open UI; not a proposal JSON                        |

**Human CLI (`repay …`):** TTY → pretty table; non-TTY pipe → machine format for `plan`/`init`/`status`.  
Still **not** the agent contract path — agents call scripts with explicit `--format`.

`plan-curriculum.js` returns a complete supported learning map plus a bounded writing batch by
default. `--batch-size N` changes only `delivery.sessionBatch`. Pass `--batch-only` as well only
when the user explicitly limits the entire curriculum to exact N—not when they merely ask to write
N lessons. The batch pays a transparent penalty for repeated mechanism/domain families, while
`--focus` pins an explicit user choice. `proposal.alternates`
contains up to nine ranked replacements and never becomes persisted curriculum automatically. Full
candidate catalogs require `--format json --include-catalog --output <outside-target-path>`; they
are never returned in normal stdout. The compact `candidateSummary` reports available, eligible,
filtered/rejected, folded, returned, and selected family coverage.

Before save, the agent invents final titles after reading the complete existing title set and
records `agentApproval.titleReview = { reviewedAt, scope: "complete-curriculum" }`. Scripts may
report exact or near similarity but must never propose, rank, rewrite, or select titles. Each
remaining similar pair needs an agent-authored `{ topicIds, reason }` entry in
`titleReview.retainedSimilarities`; otherwise rewrite it.

## Shared head (copy-paste sequence)

```text
node <skill-root>/scripts/project-memory.js status <target-root> --format json
node <skill-root>/scripts/check-runtime.js --format json
# if first-run → wizard → init (below)
node <skill-root>/scripts/profile-project.js <target-root> --format json
# agent B0/B1
node <skill-root>/scripts/plan-analysis.js <target-root> --mode <pr|workbook|focused> --depth <…> [--focus …] [--scope …] --format summary-json
# agent B2 TAKE nextAsks
node <skill-root>/scripts/check-capabilities.js <target-root> --format json
# tool chain + silent bundled fallback; ask only install/config
```

### Init (after Fast/Control)

```text
node <skill-root>/scripts/project-memory.js init <target-root> \
  [--storage …] [--output-location …] [--mode …] [--depth …] [--save-policy …] \
  --yes --format json
```

Without `--yes` → exit 2 `consent-required` (expected). With existing memory → exit 2
`already-exists` → use `status` / `reconfig`, **not** re-init with different flags.

## Predicted `type` / status outcomes (handle all)

### `project-memory.js status`

| `type` / `status`                               | Exit | Action                                                |
| ----------------------------------------------- | ---- | ----------------------------------------------------- |
| `first-run` / `not-initialized`                 | 0/2  | introduction wizard → init                            |
| `status` / ready-ish + config                   | 0    | continue shared head                                  |
| `incomplete-memory` / `broken`                  | 2    | ask repair/migrate; never silent overwrite            |
| `incomplete-lesson-index`                       | 2    | follow `requiredAction` (repair index)                |
| `lesson-index-locked` / `artifact-index-locked` | 2    | stop; unlock only with approval                       |
| `unsafe-symlink`                                | 2    | stop; ask user                                        |
| competing stores                                | 2    | pass `--storage private\|project-local\|team` or stop |

### `project-memory.js init`

| `type`                                             | Exit | Action                                   |
| -------------------------------------------------- | ---- | ---------------------------------------- |
| `initialized`                                      | 0    | continue                                 |
| `consent-required`                                 | 2    | show writes; get approval; rerun `--yes` |
| `already-exists`                                   | 2    | `status` / `reconfig` — do not re-init   |
| `memory-location-conflict`                         | 2    | pick one store with user                 |
| `team-sharing-unavailable` / `team-memory-ignored` | 2    | follow `requiredAction`                  |
| `unsafe-symlink`                                   | 2    | stop                                     |

### `check-runtime.js`

| Outcome               | Exit | Action                                                                      |
| --------------------- | ---- | --------------------------------------------------------------------------- |
| `status: ready`       | 0    | continue                                                                    |
| not ready (Node/deps) | 2    | run `ensure-runtime.js` in **skill-root only**; never target `pnpm install` |
| throw                 | 1    | fix environment                                                             |

### `ensure-runtime.js` (skill-root only)

| Outcome   | Action                                                     |
| --------- | ---------------------------------------------------------- |
| `ready`   | continue                                                   |
| not ready | report install failure; do **not** install into target app |
| PATH shim | only if user/`REPAY_LINK_CLI` / `--link-cli` — default off |

### `plan-analysis.js`

| Outcome                                                                      | Action                                          |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| summary-json with `investigations`, `nextAsks`, `mustNotClaim`, `blindSpots` | TAKE; ≤5 RETRIEVEQs; mark toolChain need/skip   |
| focused without `--focus`                                                    | exit 1 — add focus, do not switch mode silently |
| planning-failure                                                             | exit 1 — fix target/args                        |

### Tool wrappers (`run-graphify`, etc.)

| AnalyzerResult / type                     | Action                                                            |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `successful`                              | use evidence; still verify live source for claims                 |
| `unavailable` / `failed` / `unconfigured` | **silent** named bundled fallback (tool-integrations.md); same UX |
| `consent-required`                        | exit 2 — ask; rerun `--yes` only after approval                   |
| `refused` / target write detected         | stop; disclose; do not use result                                 |
| `partial` / `stale`                       | use with limitations; no confidence upgrade                       |

Graphify `query` defaults to budget 80, bounds returned text, reports `matchCount`, `truncated`,
`precision`, and `suggestedNarrowingSeeds`, and makes at most one narrowing retry. `precision: low`
means switch to exact `path`/`explain` or the bundled relation graph before teaching.

Install optional tools **only** after user consent; commands from `tool-integrations.md`
(user-isolated `uv tool install …`). Never target dependency install for analyzers.

### Save / quality / curriculum

| `type` / outcome                            | Exit | Action                                    |
| ------------------------------------------- | ---- | ----------------------------------------- |
| `consent-required`                          | 2    | ask; `--yes` after approval               |
| `secret-risk`                               | 2    | redact / rewrite; never save secrets      |
| `workbook-linkage-required`                 | 2    | save-curriculum / mini-curriculum first   |
| quality / faithfulness / evidence refuse    | 2    | fix draft once or refuse save             |
| path/trajectory incomplete                  | 2    | complete B path or refuse                 |
| `lesson-saved`                              | 0    | take warnings; honor viewer; no raw JSON  |
| `curriculum-saved`                          | 0    | revise/explain warnings, then lesson loop |
| `artifact-saved` / `decision-recorded`      | 0    | continue                                  |
| `reconfigured` / `memory-migrated` / clears | 0/2  | follow `requiredAction`                   |
| `target-error`                              | 1    | fix roots                                 |

## Closed `nextAsks[].do` vocabulary

Agents **must** map these to the mode path — not free invention.  
Enforced in code: `CLOSED_NEXT_ASK_DOS` in `dialogue-envelope.js`.

| `do`                               | Who    | Meaning                                     |
| ---------------------------------- | ------ | ------------------------------------------- |
| `confirm-purpose`                  | agent  | B0 ACCEPT \| UNRESOLVED                     |
| `plan-analysis`                    | script | run plan-analysis after purpose             |
| `pick-retrieve-questions`          | agent  | ≤5 specific questions (focused/pr)          |
| `approve-curriculum-shortlist`     | agent  | B3 SHORTLIST + agentApproval                |
| `accept-partial-scope-or-narrow`   | agent  | accept partial or narrow scope              |
| `graphify-or-serena-retrieve`      | tool   | run preferred retrieve chain                |
| `verify-selected-leads-in-source`  | agent  | verify pattern leads in live source         |
| `check-evidence-anchors`           | script | run deterministic claim-anchor coverage     |
| `review-claim-semantics`           | agent  | judge whether cited anchors mean the claim  |
| `fix-citations-or-rewrite`         | agent  | repair unresolved citations or narrow prose |
| `rewrite-unsupported-claims`       | agent  | shrink claims that lack anchor coverage     |
| `review-behavior-report-then-save` | agent  | inspect behavior report before save         |
| `fix-floor-errors`                 | agent  | repair mechanical lesson floors             |
| `unsupported-shrink-or-refuse`     | agent  | hard overclaim — no “continue weaker?”      |

If a new `do` appears in JSON, handle via `requiredAction` / `why` text **inside the same
mode path**. Do not start a second product workflow. Adding a new `do` requires updating
`CLOSED_NEXT_ASK_DOS` + this table + tests in the same change.

## Install / use surfaces (predictable only)

| Surface            | Allowed agent action                                    | Forbidden                                  |
| ------------------ | ------------------------------------------------------- | ------------------------------------------ |
| Skill deps         | `ensure-runtime` / CLIs auto-bootstrap in skill-root    | `pnpm/npm install` in target               |
| Optional analyzers | suggest + user-isolated install per tool-integrations   | silent target install; project hooks       |
| MCP / agent config | ask, then edit only after yes                           | silent config mutation                     |
| Viewer             | `view-lessons.js` / `open-viewer` / `repay view --open` | hand-built HTML                            |
| Memory             | `project-memory.js` actions with consent                | ad-hoc file writes under target            |
| Human CLI          | user terminal; optional after save for view             | substitute for plan/status/init JSON turns |

## Anti-improvise list (common failure modes)

| Impulse                                          | Contract response                                          |
| ------------------------------------------------ | ---------------------------------------------------------- |
| “`repay plan` is easier”                         | use `plan-analysis.js --format summary-json`               |
| “table is readable”                              | agent parse needs json/summary-json; chat gets your tables |
| “Graphify missing → skip teaching”               | silent bundled fallback; teach with limitations            |
| “Graphify missing → install without ask”         | ask install/config only                                    |
| “init failed → delete memory and retry”          | follow `requiredAction`; no silent wipe                    |
| “status first-run → invent config files by hand” | wizard + `init --yes`                                      |
| “save failed quality → save anyway / weaker”     | rewrite once or refuse; hard overclaim                     |
| “try CodeGraph / other indexers”                 | no — Graphify chain only unless user requests              |
| “build viewer HTML so user can read”             | never — script viewer only                                 |
| “install analyzer in app package.json”           | never                                                      |
| “omit `--format` because non-TTY defaults json”  | still pass explicit `--format` on agent turns              |
| “exit 2 → try different script”                  | read `type`; stay on mode path                             |

## Mode paths

Execution order after shared head: **`script-agent-dialogue.md`** (focused / pr / workbook).  
Checkpoints: **`bottleneck-checkpoints.md`**.  
Tools: **`tool-integrations.md`**.  
Evidence language: **`evidence-contract.md`**.

## Verification (agent self-check before user-facing teach)

- [ ] Every script run used `node <skill-root>/scripts/…` with explicit `--format`
- [ ] Exit 2 handled as branch, not as “try something else”
- [ ] `nextAsks` taken or ledger-skipped with reason
- [ ] Tool miss → named bundled fallback (or honest skip if none)
- [ ] No target pollution; no secrets; no hand-built viewer
- [ ] Unsupported claims shrunk or save refused
- [ ] `do` values ⊆ `CLOSED_NEXT_ASK_DOS`
