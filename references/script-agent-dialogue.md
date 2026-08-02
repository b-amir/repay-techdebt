# Script ↔ agent dialogue

Read this when the skill activates. Scripts and the agent take turns from 0→100. Neither finishes
discovery or teaching alone.

## Contract

| Partner     | Owns                                                                                                               | Must not own                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Scripts** | Consent/runtime/capability gates; inventories; tool wrappers; coverage math; proposal JSON; mechanical QA; saves   | Final “what to teach”; absence claims without verify; lesson taste |
| **Agent**   | Purpose; retrieve questions; live-source verify; shortlist approve/demote; draft lessons; semantic qualify; ledger | Skipping gates; dressing model prior as observed fact              |

**Turn shape:** `ASK → RUN → RETURN → TAKE`

Every major script return includes:

- `role`: `gate` | `inventory` | `retrieve` | `propose` | `check`
- `blindSpots[]`, `mustNotClaim[]`, `nextAsks[]` (`who` + `do` + optional `why`/`when`/`question`)

Prefer `--format summary-json` / compact tables on agent turns.

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

- `ACCEPT purpose | UNRESOLVED purpose + questions` (B0; set `purposeStatus` on approval)
- `NEED tools: […] | SKIP tool X because […]`
- `RETRIEVEQs: […]` (B2; ≤5 specific questions)
- `SHORTLIST: [ids…] + ADDED: […] + DEMOTED: […]` (B3)
- `CLAIMS: […]` with path:line + support yes|no|gap (B6)
- `REWRITE once: address […]`
- `STOP extra loops; ship with gaps: […]`

Checkpoint cards: `bottleneck-checkpoints.md` (B0–B6). Complete them in trajectory order.
Validate ask fidelity with `scripts/check-trajectory.js` (workbook: B0→B1→B2→B5→B3→B4a→B4b→B6).

Omnibus topics (“understand the whole app”) must be split/demoted; save rejects them.

## Shared head (all modes)

```text
Script gate:  project-memory.js status → check-runtime.js
Agent:        confirm skill vs target roots; consent wizard if first-run; pick mode
Script:       profile-project.js … --format json   (inventory)
Agent:        ACCEPT|UNRESOLVED purpose; phrase retrieve questions
Script:       plan-analysis.js … --format summary-json   (propose)
Agent:        mark investigations needed|not-needed; NEED|SKIP tools
Script gate:  check-capabilities.js … --format table
Agent/user:   setup | fallback | skip per tool-integrations.md
```

CLI details: `tool-integrations.md`. Memory: `project-memory.md`.

## Mode: focused

```text
Agent ask → Graphify/Serena (or query-program-model after approval) → Agent verify 2–3 anchors
[optional] Script gap-fill (scoped deps/security/pattern leads) → Agent discard noise
Script: plan-lesson.js … --format json
Agent: draft lesson from verified anchors
Script: check-lesson-quality.js <draft.md>
Agent: semantic checklist; ≤1 rewrite
Script: project-memory.js save-lesson … (per save policy)
Agent: tool ledger + gaps + next concepts
```

Skip whole-repo `find-patterns.js` unless the agent passes explicit `--all` for teaching leads, or
uses `--scope <path>` for a residual gap. Output is `teachingLeads` (`notExhaustive: true`).
Skip `plan-curriculum.js`.

## Mode: PR Mentor

```text
Script/MCP: get-pr-changes / GitHub MCP (exclude .repay-techdebt/)
Agent: re-rank around changed symbols and likely consumers
Retrieve/verify blast radius (Graphify/Serena)
Script: plan-analysis.js --mode pr --format summary-json
Agent: pick 1–3 teaching points (not every hunk)
Compose → check → semantic → save? → ledger
```

Skip `plan-curriculum.js` unless the user asks for a workbook from the PR.

## Mode: whole-app workbook

```text
Script inventory ↔ Agent purpose
Retrieve: graph hubs / critical workflows (agent questions)
Agent: note what naming heuristics miss (DI, events, odd package names)
Script: plan-curriculum.js … --format json   (propose; signalClass on topics)
Agent: SHORTLIST approve/demote/add — stamp agentApproval, corroborate naming-heuristic IDs
Script: project-memory.js save-curriculum … --input <approved.json> --yes
Loop 1–3 lessons/run: plan-lesson ↔ draft ↔ check-lesson-quality ↔ semantic ↔ save-lesson
Agent: index + ledger; stop (resume next session)
```

Naming-heuristic topics need agent corroboration (graph, source, docs, or user) via
`agentApproval.corroboratedTopicIds` (or `topic.corroborated=true`) before save.
Partial coverage requires `agentApproval.acceptedPartialScope`.

## Semantic checklist (agent; after mechanical QA + evidence floor)

- One subject / outcome — not an omnibus of scanner hits.
- At least one consumer↔dependency relationship **or** a named gap.
- Material claims use honest evidence states in prose or ledger.
- Run claim decomposition from `bottleneck-checkpoints.md` (B6).
- Snippets match current lines; memory is not current-code proof.
- Sources listed with reliability rank; model prior not dressed as project fact.
- If Graphify/Serena failed or was skipped, state which relation class is untrusted.
- PRIMM moves present without empty Predict/Run/Investigate/Modify/Make headings.

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
