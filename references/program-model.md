# Normalized Program Model

Read this reference when consuming `build-program-model.js`, querying relationships, or combining
Graphify/Serena/runtime evidence with the bundled model.

## Identity and provenance

Every model contains an explicit canonical target root, an analysis `scope`, and an optional
project-relative path for a skill installation nested inside the target. Reject models whose target
does not match the active application. A non-`.` scope is intentionally partial relative to the
whole target even when every file inside it was modeled. Any legacy/opt-in target-local
`.repay-techdebt/` tree,
generated analyzer output, dependencies, secret files, and the nested skill path are excluded.

Schema version 2 uses canonical SHA-256 IDs whose payload includes the entity type. Consumers must
reject unknown versions rather than
guessing. `generatedAt` is the observation time, not proof that every source fact was recently
modified or executed.

## Node types

| Type                                      | Meaning                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `system`                                  | The explicitly resolved application target                             |
| `component`                               | A workspace/manifest-owned program component with its own archetypes   |
| `area`                                    | A layout-derived project region, not automatically a domain boundary   |
| `file`                                    | A modeled file without a stronger structural role                      |
| `entry-point`                             | A conventional startup/invocation filename; verify registration        |
| `test`                                    | A test/spec path inferred from naming                                  |
| `manifest`                                | Build, package, workspace, deployment, or ecosystem metadata           |
| `technology`                              | A detected language/framework pack                                     |
| `dependency`                              | A declared third-party package, separate from authored source modules  |
| `capability`                              | A possible executable role such as server, UI, pipeline, or mobile app |
| `domain`, `flow`, `module`                | Extension nodes supplied by verified architecture/runtime tools        |
| `symbol`, `function`, `expression`        | Progressively narrower executable/source constructs                    |
| `data-store`, `integration`, `deployment` | Operational boundaries and external effects                            |
| `runtime-observation`                     | A sanitized test, trace, profile, metric, or observed execution fact   |

Node IDs are stable within the model algorithm but are not source-code symbol IDs. JavaScript,
TypeScript, and Python import evidence is AST-derived and carries analyzer, operation, and line
provenance. Registered syntax adapters for other languages remain lower-confidence and never claim
language-server completeness.

The profile contains both a compatibility-level repository archetype and a component portfolio.
Prefer per-component archetypes in monorepos. Boundaries combine workspace roots, relationship
hubs, conventional paths, and explicit user hints; inspect `boundaryEvidence` rather than treating
any directory name as proof.

## Edge types

| Type                                           | Meaning and limitation                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `contains`                                     | Layout membership; it does not prove architectural ownership                       |
| `imports`                                      | A statically resolved local source dependency; it does not prove runtime execution |
| `tests`                                        | Direct test imports are observed; naming-only relations remain weak `inferred`     |
| `declares`                                     | The system declares a technology pack                                              |
| `implements`                                   | Detected evidence suggests the system has a capability                             |
| `configures`                                   | Reserved for explicit configuration ownership evidence                             |
| `depends-on`                                   | Reserved for normalized external or runtime dependency evidence                    |
| `calls`, `reads`, `writes`, `emits`, `handles` | Executable relations from language/runtime evidence                                |
| `guards`, `transforms`, `routes-to`            | Control, validation, data, and routing relations                                   |
| `deploys`, `observes`                          | Deployment and telemetry relations                                                 |

Every edge includes confidence and evidence IDs. Do not collapse duplicate semantic relationships
from richer tools merely because a bundled edge already exists. Record source and confidence.

## Coverage

Coverage is part of the result, not a log line. Inspect:

- total discovered and modeled files;
- static-relation files and bytes read;
- languages with and without bundled local relation resolution;
- status (`complete`, `partial`, `unsupported`, or `failed`) and reason codes;
- file, relation, and byte budgets;
- truncation;
- skipped large and unreadable files.
- manifest and relationship parser diagnostics.

When status is `partial`, absence of a node or edge is not evidence of absence. Budgets may come
from schema-v2 project configuration or CLI overrides. Increase them only when the extra evidence
is relevant and affordable; otherwise shard by component or use Graphify, Serena, a language
server, build metadata, or focused direct inspection.

The model, profile, plan, atlas, dependency report, and graph-query CLIs accept `--scope`. The
selected target-relative path is filtered before budgets are applied, so a small budget can cover a
late-sorting component instead of starving it behind unrelated files. `scan-architecture.js` also
supports resumable structural pages with `--scope`, `--max-files`, and
`--resume-after`. The cursor is a target-relative filename from the sorted scoped inventory. Keep
page coverage and reason codes when merging summaries; a scoped or resumed page is intentionally
reported as partial relative to the whole target.

## Dependency intelligence

The `dependencies` collection records declaration scopes, manifest sources, observed source usage,
and evidence IDs. Installed package directories remain excluded from authored-source containment.
Resolve exact/transitive versions, advisories, licenses, maintenance, and update distance through
lockfile or permission-gated ecosystem/network evidence before making dependency-debt conclusions.

## Graph traversal

Use `query-program-model.js <target> <query>` only as an explicitly accepted fallback when the
preferred relationship tool fails. A one-hop query answers immediate consumers and dependencies.
Two or three hops may expose a flow but also increase noise. Verify dynamic registration,
reflection, dependency injection, event routing, framework conventions, generated bindings,
database relations, and network calls separately.

For a selected node, reason through:

```text
configuration/tests -> incoming consumers -> selected node -> outgoing dependencies -> effects
```

The absence of one segment is an evidence gap to resolve, not permission to invent it.

## Merging richer evidence

Graphify, Serena, compilers, language servers, tests, traces, profilers, database schemas, API
specifications, and deployment metadata may add nodes or contradict bundled edges. Keep each claim's
provenance. Prefer direct runtime or authoritative compiler/framework evidence for dynamic behavior;
prefer live source for what the current checkout declares. Mark contradictions instead of silently
choosing the convenient result.
