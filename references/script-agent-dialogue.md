# Script ↔ Agent Dialogue

Read this when the skill activates (after `agent-machine-contract.md`). Scripts and the agent take
turns from 0→100. Neither finishes discovery or teaching alone.

**Machine predictability:** exact commands, formats, exit codes, install outcomes, and closed
`nextAsks` live in `agent-machine-contract.md`. This file is the turn map and mode paths. If an
agent would “try something else,” stop and re-read the machine contract.

## Contract

| Partner     | Owns                                                                                                               | Must not own                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Scripts** | Consent/runtime/capability gates; inventories; tool wrappers; coverage math; proposal JSON; mechanical QA; saves   | Final “what to teach”; absence claims without verify; lesson taste |
| **Agent**   | Purpose; retrieve questions; live-source verify; shortlist approve/demote; draft lessons; semantic qualify; ledger | Skipping gates; dressing model prior as observed fact              |

**Turn shape:** `ASK → RUN → RETURN → TAKE`

Every major script return includes:

- `role`: `gate` | `inventory` | `retrieve` | `propose` | `check`
- `blindSpots[]`, `mustNotClaim[]`, `nextAsks[]` (`who` + `do` + optional `why`/`when`/`question`)

**Formats:** always explicit on agent turns — see format matrix in `agent-machine-contract.md`
(`plan-analysis` → `summary-json`; gates/inventory/saves → `json`). Compact tables only in
**user chat**, never as the script parse path.

**Human CLI vs agent scripts:** `repay plan|init|status|view` is for terminals. Agent machine
turns call `node <skill-root>/scripts/…` with the matrix formats. Do not rely on `repay plan` for
`nextAsks` / `toolChain` — TTY pretty table drops those fields. Piped `repay plan` falls back to
`summary-json`, but the script path is the contract.

**User chat:** tables over prose. Follow `templates/agent-experience.md` — ≤10 words outside tables on routine turns.

**Caps:** ≤1 extra investigate turn per phase; ≤1 lesson rewrite; then ship with gaps or ask the user.

**Skip:** inventory/propose/retrieve only with ledger reason when stronger evidence exists. Never skip
consent, secrets, or capability-failure prompts.

## Source reliability (high → low)

1. Current target source / config / lockfile / tests
2. Successful enhanced tool ops after functional check
3. Version-matched authoritative docs
4. User confirmation of purpose/criticality
5. Deterministic script _derived_ facts (+ limitations)
6. Script _inferred_ heuristics (paths, pattern catalog, folders)
7. Model prior (hypothesis only)

## Agent reply forms (internal, tiny)

**Never paste these tokens in user-facing chat.** User copy: `templates/agent-experience.md`
(progress table, reply footers, ask tables), `templates/session-status.md`, `templates/introduction-wizard.md`.

- `ACCEPT purpose | UNRESOLVED purpose + questions` (B0; set `purposeStatus` on approval)
- `NEED tools: […] | SKIP tool X because […]`
- `RETRIEVEQs: […]` (B2; ≤5 specific questions)
- `SHORTLIST: [ids…] + ADDED: […] + DEMOTED: […]` (B3)
- `CLAIMS: […]` with path:line + support yes|no|gap (B6)
- `REWRITE once: address […]`
- `STOP extra loops; ship with gaps: […]`

Check the state transitions in `flow-machine.js` (setup → purpose → shortlist → gather → draft → mechanical-check → review → revise → save → next-lesson → wrap).
User-facing progress steps map directly to the flow state.

## User-facing progress table (mandatory)

Every turn: progress from `templates/session-status.md` first — header `| Step | {current}/{total} |`
(**current** = 1-based index of 🔵, never 0, never ✅-count; **no empty headers**). **One blank line
between tables.** Ask turns: `###` heading + why-line + ask table + `👉 Reply`. First-run: paste
`templates/introduction-wizard.md` Message 1 verbatim (only **Get ready** is 🔵 until `init --yes`).
**Fast** mode: 5 steps, auto-save, auto-open viewer — no save/open yes-no.

## Plain-language asks (user chat)

Use the **exact** ask blocks in `templates/agent-experience.md` (`###` + why + table + 👉 Reply).

| Internal                  | Template block          |
| ------------------------- | ----------------------- |
| purpose                   | What matters            |
| shortlist                 | Study list              |
| gather                    | (inline questions, ≤5)  |
| Save policy               | Save lesson             |
| First-run                 | introduction-wizard     |
| mechanical-check / review | Fold into lesson review |
| Open viewer               | Open workbook           |

| User-facing step | Replaces old label               |
| ---------------- | -------------------------------- |
| Get ready        | Setup                            |
| What matters     | Confirm purpose                  |
| Study list       | Pick study plan / shortlist      |
| Write lessons    | Lesson batch (show honest count) |
| Open workbook    | Browser viewer                   |
| Wrap up          | Done                             |

After the requested saved lesson batch completes,
run `node <skill-root>/scripts/view-lessons.js <target-root> --open` (or `repay view --open`).
In **Fast** mode do not ask — open, then **Wrap up**. In Control with save-policy `ask`, you may
confirm open. In learning-path mode, name the real pending count. In batch-only mode, say that the
workbook contains exactly the requested lessons and omit continuation claims.

Omnibus topics (“understand the whole app”) must be split/demoted; save rejects them.

## Shared head (all modes)

```text
Script gate:  project-memory.js status --format json → check-runtime.js --format json
Agent:        confirm skill vs target roots; Fast/Control wizard if first-run; pick mode (Chat flow)
Script:       profile-project.js … --format json (Inventory)
Agent:        ACCEPT|UNRESOLVED purpose; phrase retrieve questions (Purpose / Quality judgment)
Script:       plan-analysis.js … --format summary-json (Inventory / Propose)
Agent:        TAKE nextAsks; mark investigations needed|not-needed; NEED|SKIP tools (Selection)
Script gate:  check-capabilities.js … --format json (Mechanical QA)
Agent:        silent bundled fallback on tool miss; ask only install/config (Selection)
Agent:        hard overclaim — unsupported → shrink or refuse; never “continue weaker?”
```

Outcomes / exits: `agent-machine-contract.md`. Tools: `tool-integrations.md`. Memory: `project-memory.md`.

## Mode: focused

```text
Agent ask → Graphify/Serena (or query-program-model after approval) → Agent verify 2–3 anchors
[optional] Script gap-fill (scoped deps/security/pattern leads) → Agent discard noise
Script: plan-lesson.js … --format json (Inventory / Propose)
Agent: draft lesson from verified anchors (Selection / Lesson Quality)
Script: check-lesson-quality.js <draft.md> (Mechanical QA)
Agent: semantic checklist; ≤1 rewrite (Quality judgment)
Script: project-memory.js save-curriculum … (Save)
Script: project-memory.js save-lesson … --topic-id … (Save)
Script: node …/view-lessons.js <target-root> [--open] [--lesson …] (Viewer; or repay view — same)
Agent: maintainer-only notes (gaps + next concepts; no user-facing tool ledger)
```

Skip whole-repo `find-patterns.js` unless the agent passes explicit `--all` for teaching leads, or
uses `--scope <path>` for a residual gap. Output is `teachingLeads` (`notExhaustive: true`).
Skip `plan-curriculum.js` (use mini-curriculum for durable saves).

## Mode: PR Mentor

```text
Script/MCP: get-pr-changes / GitHub MCP (exclude .repay-techdebt/)
Agent: re-rank around changed symbols and likely consumers
Retrieve/verify blast radius (Graphify/Serena)
Script: plan-analysis.js --mode pr --format summary-json
Agent: pick 1–3 teaching points (not every hunk)
Compose → check → semantic → save? → maintainer notes
```

Create or append a mini-curriculum (`buildTeachingCurriculum` → `save-curriculum`) before any
durable `save-lesson` so lessons always link from `INDEX.md`. A second teach appends new topics
under chapter **Recent teaching**.

## Mode: whole-app workbook

```text
Script inventory ↔ Agent purpose
Retrieve: graph hubs / critical workflows (agent questions)
Agent: note what naming heuristics miss (DI, events, odd package names)
Script: plan-curriculum.js … --format json [--batch-size N] [--batch-only]
        (Inventory / bounded Propose; titles = path placeholders)
Agent: SHORTLIST approve/demote/fold/add + reasons + **rewrite titles/outcomes from source** (Selection / taste)
      — B3 title judgment in bottleneck-checkpoints.md
Agent: stamp agentApproval on the rewritten curriculum JSON
Script: project-memory.js save-curriculum … --input <approved.json> --yes (Save)
Loop 1–3 lessons/run: plan-lesson (Propose) ↔ draft (Quality) ↔ check-lesson-quality (Mechanical QA) ↔ semantic (Quality judgment) ↔ save-lesson (Save)
Agent: index + ledger; stop (resume next session)
```

Naming-heuristic topics need agent corroboration (graph, source, docs, or user) via
`agentApproval.corroboratedTopicIds` (or `topic.corroborated=true`) before save.
Partial coverage requires `agentApproval.acceptedPartialScope`.
Demotions/folds use `agentApproval.topicDecisions`; folds name a kept `intoTopicId`. Treat
save-curriculum placeholder warnings as revise-or-explain prompts. Breadth/compression warnings
apply only to learning-path mode, never an explicit batch-only request.

## Semantic checklist (agent; after mechanical QA + evidence floor)

- One topic / outcome — not an omnibus of scanner hits.
- Can the learner safely change or debug something afterward? If no, `mustFix`.
- At least one consumer↔dependency relationship **or** a named gap.
- Material claims use honest evidence states in prose or ledger.
- Run claim decomposition from `bottleneck-checkpoints.md` (B6). Treat deterministic anchor
  coverage as a lead; the agent owns semantic support.
- Snippets match current lines; memory is not current-code proof.
- Sources listed with reliability rank; model prior not dressed as project fact.
- If Graphify/Serena failed or was skipped, state which relation class is untrusted.
- PRIMM moves present without empty Predict/Run/Investigate/Modify/Make headings.
- A verified source fence appears in the worked path; the ending is a job, not symbol recall.
- Reviewer provenance is explicit. Self-review scores are advisory, not independent certification.

## Script catalog (roles)

| Script                                                                     | Role                                                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `project-memory.js`, `check-runtime.js`, `check-capabilities.js`           | gate                                                                             |
| `profile-project.js`, `build-program-model.js`                             | inventory                                                                        |
| `run-graphify.js`, `get-pr-changes.js`, `query-program-model.js`, `scan-*` | retrieve                                                                         |
| `plan-analysis.js`, `plan-curriculum.js`, `plan-lesson.js`                 | propose                                                                          |
| `check-lesson-quality.js`, `check-snippet-secrets.js`, `review-lesson.js`  | check                                                                            |
| `find-patterns.js`                                                         | retrieve leads only (`--scope` or `--all`; `teachingLeads`; not workbook driver) |

Full flags and failure prompts: `tool-integrations.md`. Evidence language: `evidence-contract.md`.
Lesson shapes: `lesson-composition.md` + `templates/lesson-format.md`.
