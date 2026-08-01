# Analysis Execution Protocol

Read this reference before executing a generated plan.

## Phase 1: establish scope

Resolve the explicit target and requested scope: PR/change, whole program, or focused question.
Load project memory as preferences only. Confirm product purpose and constraints when they would
materially change priorities. Unanswered questions remain in the evidence ledger.

## Phase 2: build the baseline model

Run:

```text
node <skill-root>/scripts/profile-project.js <target-root> [--scope <relative-path>] --format json
node <skill-root>/scripts/plan-analysis.js <target-root> --mode <pr|workbook|focused> --depth <concise|balanced|deep> [--focus <question>] [--scope <relative-path>] --format <json|summary-json>
```

These bundled operations are read-only and are the baseline, not fallbacks for a failed enhanced
tool. Inspect coverage, packs, entry points, boundaries, top lenses, evidence states, and
uncertainties. If an unknown language dominates, pause ecosystem-specific claims until its tooling
and semantics are established.

Apply `--scope` before increasing budgets when the requested component is known. The model reports
`scoped-analysis` and remains partial relative to the whole target. Use full JSON when provenance
and rationale are needed; use `summary-json` for an execution-oriented plan payload.

## Phase 3: select capabilities

Use the plan to mark enhanced capabilities as needed or not needed. Run the standard capability
preflight, then functionally attempt only needed tools. A missing irrelevant tool is not a failure.
On a needed tool failure, use the failure prompt from `tool-integrations.md` and wait for the user's
choice before using the named fallback.

The bundled relationship query is:

```text
node <skill-root>/scripts/query-program-model.js <target-root> <path-or-name> --depth 1 --format table
```

Use it after approval when Graphify/Serena relationship retrieval fails. Its result is conservative
and incomplete for dynamic behavior.

## Phase 4: trace relationships

For each selected concern:

1. start at a user/system input or a concrete changed symbol;
2. identify registration and configuration;
3. follow incoming consumers;
4. follow outgoing dependencies and side effects;
5. inspect normal, failure, retry, cancellation, concurrency, and rollback paths as applicable;
6. connect tests and runtime signals;
7. return to the user/system outcome.

Record unsupported relation classes. Search results and graph edges are leads until verified in
current source.

## Phase 5: execute lenses

Apply the highest-ranked lens to the critical flow first. Stop when further evidence would not
change the mental model or next safe action. Move to lower-ranked lenses only when the scope and
lesson depth justify it. A whole-app workbook should choose representative flows across major
capabilities; it should not summarize every directory.

## Phase 6: gather runtime evidence

Use existing tests and read-only artifacts first. Ask before starting services, writing profiles,
using credentials, reaching production, replaying data, or running stateful commands. Sanitize tool
output. Static conclusions must not imply observed production behavior.

## Phase 7: teach and report

Build lessons from verified source using the lesson template. Connect at least two adjacent zoom
levels. Include confidence, unresolved evidence, and modification consequences. End with the tool
ledger and the next highest-value investigations.
