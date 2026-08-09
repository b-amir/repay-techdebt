# Analysis Execution Protocol

Read with `script-agent-dialogue.md`. Scripts and the agent alternate. Script JSON is a proposal.

## Phase 1: establish scope (gate → agent)

Resolve target and mode: PR/change, whole program, or focused question. Load project memory as
preferences only. **Agent turn:** confirm or leave unresolved product purpose and constraints.
Unanswered questions stay in the evidence ledger.

## Phase 2: inventory + propose (script → agent)

```text
node <skill-root>/scripts/profile-project.js <target-root> [--scope <relative-path>] --format json
node <skill-root>/scripts/plan-analysis.js <target-root> --mode <pr|workbook|focused> --depth <concise|balanced|deep> [--focus <question>] [--scope <relative-path>] --format summary-json
```

These are read-only baseline inventory/propose turns, not fallbacks for a failed enhanced tool.
Inspect `role`, `coverage` / `coverageStatus`, `blindSpots`, `mustNotClaim`, `nextAsks`, packs,
entry points, lenses, and uncertainties. **Agent turn:** follow `nextAsks` (purpose, retrieve
questions, need/skip tools). Agent turns: always explicit `--format` per
`agent-machine-contract.md` (`summary-json` for plan-analysis. `json` for gates/inventory). Full JSON when provenance is
required.

Apply `--scope` before raising budgets when the component is known. Partial/scoped models remain
partial relative to the whole target - honor `mustNotClaim`.

## Phase 3: capabilities (gate → agent/user)

Mark enhanced capabilities needed or not needed from the plan. Run `check-capabilities.js`, then
functionally attempt only needed tools. On failure, use the prompt in `tool-integrations.md` and
wait for setup / fallback / skip.

Bundled relationship query (after approval when Graphify/Serena fail):

```text
node <skill-root>/scripts/query-program-model.js <target-root> <path-or-name> --depth 1 --format json
```

Conservative and incomplete for dynamic behavior - state that limitation in the ledger.

## Phase 4: retrieve + verify (agent ask → tool/script → agent)

For each selected concern:

1. Agent phrases the question (or starts from a changed symbol / critical workflow).
2. Preferred retrieve tool runs (Graphify, Serena, PR extractor, …).
3. Agent verifies 2–3 anchors in current source.
4. At most one gap-fill script/tool turn if a blind spot blocks teaching.
5. Trace registration → consumers → dependencies/effects → failure paths → tests/runtime as
   applicable.

Search hits and graph edges are leads until verified. Record unsupported relation classes.

## Phase 5: lenses (agent. Script proposals optional)

Apply the highest-ranked relevant lens to the critical flow first. Stop when further evidence would
not change the mental model or next safe action. Workbooks choose representative flows - not every
directory.

## Phase 6: runtime evidence (permission-gated)

Prefer existing tests and read-only artifacts. Ask before mutating target state, using credentials,
reaching production, starting services, writing profiles, or sending network traffic. Static
conclusions must not imply observed production behavior. See `runtime-evidence.md`.

## Phase 7: curriculum approve (workbook only)

```text
node <skill-root>/scripts/plan-curriculum.js <target-root> --format summary-json
```

**Agent turn:** compare the exact batch with bounded `proposal.alternates`, then SHORTLIST
approve/replace/demote/fold/add. Rewrite kept titles/outcomes. Record reasoned
`agentApproval.topicDecisions`. Set `purposeStatus` to `accepted` or `unresolved`.
corroborate `naming-heuristic` topics into `agentApproval.corroboratedTopicIds`. Read every existing
title, invent each final title without a prescribed formula, and record
`agentApproval.titleReview` for the complete curriculum. Set
`acceptedPartialScope` when coverage is partial. Save only with that block present:

```text
node <skill-root>/scripts/project-memory.js save-curriculum <target-root> --input <approved.json> --yes
```

Focused/PR modes skip this phase unless the user asks for a workbook.

## Phase 8: teach handshake (propose → draft → check → semantic → save)

1. `plan-lesson.js` - advisory composition. Complete B5 verify after retrieve.
2. Agent drafts from verified anchors (B4b).
3. `check-lesson-quality.js` + `check-lesson-evidence.js` (+ secrets as needed). Take warnings.
4. Agent B4b/B6 sense (source fence + change/debug ending + claim decomposition). ≤1 rewrite.
5. Save per memory policy. End with maintainer-only notes (gaps, skips, next concepts) - never a first-run tool ledger dump.
