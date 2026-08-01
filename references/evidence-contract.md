# Evidence, Confidence, and Freshness Contract

Read this reference before turning profiler, graph, analyzer, documentation, runtime, or user input
into a lesson claim.

## Evidence states

| State          | Required meaning                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `observed`     | Directly present in current source, configuration, tool output, test output, or runtime evidence |
| `derived`      | Deterministically computed from observed facts, such as counts or containment                    |
| `inferred`     | Best explanation supported by indirect evidence but still requiring verification                 |
| `hypothesis`   | A useful question or prediction with insufficient supporting evidence                            |
| `contradicted` | Credible sources disagree; preserve both and investigate                                         |
| `stale`        | Previously credible evidence is older than a relevant code/config/runtime change                 |

Never use confidence to relabel an inference as observation. A 99% inference remains inferred.

## Claim requirements

Each material claim needs:

- a stable evidence ID;
- one state;
- confidence from 0 to 1;
- a concise claim;
- source paths, analyzer names, operations, and line ranges when available;
- observation time;
- limitations that affect interpretation.

Secrets, credentials, environment values, private customer data, and unnecessary business literals
must not appear in evidence. Cite a sanitized path and behavioral fact instead.

## Confidence calibration

Use confidence to express evidence strength within a state:

- `0.95–1.0`: direct, unambiguous, reproducible current evidence;
- `0.75–0.94`: strong evidence with a known limitation;
- `0.5–0.74`: plausible but meaningfully ambiguous;
- `0.25–0.49`: weak signal useful mainly to select the next check;
- below `0.25`: do not teach as a conclusion.

Multiple correlated tools are not automatically independent corroboration. An index and a static
scanner may both derive from the same import statement.

## Freshness

Source evidence is current for the checkout observed, not necessarily for deployed production.
Documentation must match relevant library/runtime versions. Saved lessons, decisions, old reports,
and indexes are context, not current evidence. Revalidate a claim when its source, dependency,
configuration, build, schema, deployment, or governing requirement changed.

## Promotion and contradiction

Promote a hypothesis or inference only after the verifying operation succeeds. Example:

```text
hypothesis: auth middleware protects every admin route
observed: route table registers middleware on routes A and B
contradicted: route C exposes the same action without that middleware
```

Do not erase the earlier claim. Explain the refined model and its consequence.

## Teaching language

Use explicit qualifiers:

- “The source declares…” for observed static evidence.
- “The graph derives…” for deterministic relations.
- “This likely means…” for inference.
- “We need runtime evidence to know…” for unresolved execution claims.
- “These sources disagree…” for contradiction.

A final lesson must distinguish verified facts from open questions and name the operation that would
reduce each important uncertainty.
