# Lesson composition system

Use this reference after `plan-lesson.js` selects a lesson shape. It is the complete composition
catalog; `templates/lesson-format.md` contains the short execution contract.

## Design rule

Complexity belongs in selection, not presentation. Internally, evaluate signals across the whole
relevant application slice. Externally, use only the smallest set of sections that builds the right
mental model and supports safe action.

The planner's result is advisory. Verify source and successful tool evidence before filling a
module. A required module is required for the chosen lesson shape, but its exact heading and format
remain flexible. An optional module disappears unless it passes the activation gate.

## Primary shape recipes

| Shape                     | Use when                                                      | Required learning modules                                                        |
| ------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Architecture orientation  | The learner needs ownership and system placement              | why; map; responsibilities; relationships; change safely                         |
| End-to-end flow           | Inputs can be traced to an outcome                            | why; entry to effect; mechanism; failure path; change safely                     |
| Code mechanics            | Exact syntax, function, algorithm, or lifecycle is central    | why; verified snippet; mechanism; project consequence; try it                    |
| Change impact             | A PR, refactor, migration, or upgrade is the subject          | intent; before/after; blast radius; risk; verification                           |
| Debugging and failure     | A symptom or incident drives the lesson                       | symptom; execution path; failure path; diagnostic evidence; recovery             |
| Security boundary         | Assets, actors, trust, and controls are central               | asset/actor; trust boundary; control flow; failure/abuse cases; verification     |
| Performance and scale     | Work growth or runtime cost is central                        | workload; candidate hot path; cost model; measurement; safe optimization         |
| Data and state            | Ownership, lifecycle, invariants, or transactions are central | ownership; state lifecycle; invariants; failure path; verification               |
| Dependency and ecosystem  | A library, framework, runtime, or version is central          | role; observed usage; version/contract; failure impact; change safely            |
| Operations and deployment | Startup, configuration, release, or recovery is central       | runtime shape; configuration; startup to service; failure/recovery; verification |
| Testing and verification  | Confidence and behavior proof are central                     | behavior contract; test map; test mechanics; gaps; next test                     |
| UI and interaction        | A user's interaction and represented states are central       | user goal; interaction flow; state ownership; edge states; verification          |

## Required core module inventory

These modules are selected by the shape; they are not all required in every lesson.

### Orientation and purpose

- Learner outcome: what the reader will understand or safely do afterward.
- Why this matters: connection to program purpose, users, or a critical workflow.
- Scope and non-goals: useful when a similarly named area could be confused with the focus.
- Evidence anchor: exact current source, configuration, contract, test, or runtime observation.

### Structure and flow

- System map: smallest useful component/context map.
- Responsibilities and ownership: which layer or component owns each decision.
- Entry-to-effect trace: trigger, transformations, state/effect, result, and feedback.
- Relationships: incoming consumers, outgoing dependencies, contracts, and side effects.
- State lifecycle: creation, mutation, persistence, invalidation, and disposal.

### Exact mechanics

- Verified snippet: minimal source necessary to preserve the teaching point.
- Language/runtime mechanism: evaluation, lifecycle, ownership, scheduling, memory, or typing.
- Algorithm and invariant: steps, constraints, complexity conditions, and edge cases.
- Project consequence: why those mechanics produce this application's behavior.

### Safety and action

- Failure path: error propagation, partial work, recovery, and user/operator outcome.
- Change surface: exact edit boundary and contracts that must stay stable.
- Verification: unit, integration, contract, UI, runtime, or operational proof.
- Recap/challenge: prediction, modification, debugging exercise, or small implementation task.

## Optional module inventory

Select only modules supported by strong, focus-related evidence. Combine closely related modules so
the reader sees a simple lesson rather than a checklist.

### Product and domain context

- Purpose, users, and criticality.
- Domain vocabulary and business invariant.
- Workflow priority and consequence of failure.
- Historical decision, rejected alternative, and current trade-off. Requires confirmed memory,
  authoritative documentation, or user confirmation; age-label historical evidence.

### Architecture and relationships

- Component or layer ownership.
- Consumer/blast-radius map.
- Coupling, cycles, duplication, or boundary drift.
- Public contract and compatibility surface.
- Cross-service, event, generated-code, plugin, or extension relationship.
- Alternative designs and why the current boundary may be deliberate.

### Language, algorithms, and runtime

- Syntax, typing, generics, metaprogramming, or macro expansion.
- Runtime lifecycle, scheduling, event loop, threads, processes, actors, or async cancellation.
- Ownership, allocation, aliasing, resource lifetime, or memory safety.
- Algorithm steps, data structures, complexity variables, and pathological inputs.
- Serialization, parsing, encoding, locale, time, numeric precision, or platform behavior.

### Data and distributed behavior

- Authoritative versus derived state.
- Schema, migration, transaction, constraint, and rollback behavior.
- Cache keys, invalidation, optimistic updates, and consistency.
- Event delivery, idempotency, ordering, deduplication, retries, and poison work.
- Offline state, synchronization, conflict resolution, and stale data.
- Data lineage, retention, privacy, tenant separation, and disclosure.

### Security and trust

- Assets, actors, entry points, and trust boundaries.
- Authentication, authorization, validation, and output handling.
- Secret, credential, cryptographic, dependency, and supply-chain concerns.
- Abuse case and control ordering.
- Privacy purpose, collection, retention, and access.

Security relevance activates investigation; a vulnerability claim additionally requires verified
control/data flow and plausible impact.

### Performance, scale, and cost

- Workload dimension and candidate hot path.
- I/O fan-out, N+1, blocking, allocation, contention, batching, caching, and backpressure.
- Time/space complexity with explicit input variables and bounds.
- Latency budget, throughput, resource ceiling, and cost driver.
- Measurement plan, benchmark validity, profile, and safe optimization.

Static structure may justify this module but not a bottleneck claim. Use runtime evidence for actual
frequency, latency, utilization, and production impact.

### Reliability and operations

- Failure modes, timeout, retry, idempotency, rollback, and graceful degradation.
- Startup, shutdown, readiness, health, and dependency availability.
- Configuration precedence, environment assumptions, and feature flags.
- Build, packaging, deployment, rollout, migration, and rollback.
- Logs, metrics, traces, alerts, runbooks, support signals, and recovery.
- Reproducibility, randomness, external models/data, and artifact provenance.

### Dependencies and ecosystem

- Declared versus observed usage.
- Resolved version, runtime/compiler/framework compatibility, and lock evidence.
- Upgrade distance, deprecation, advisory, maintenance, license, bundle, and build impact.
- Adapter boundary, replaceability, transitive risk, and fallback behavior.
- Official, version-matched documentation and differences from project conventions.

### Tests and quality

- Behavior contract and test seam.
- Test graph, fixture, mock/fake, assertion, and isolation mechanics.
- Boundary, failure, regression, concurrency, and property-based cases.
- Static analysis, types, linters, fuzzers, sanitizers, and model/eval quality.
- Evidence gap and next highest-value check. Absence of an observed test relation is not proof that
  behavior is untested.

### UI and human interaction

- User goal, navigation, state ownership, and feedback loop.
- Loading, empty, error, disabled, submitting, success, forbidden, and partial-success states.
- Keyboard, focus, semantics, screen reader, contrast, motion, touch, and responsive behavior.
- Internationalization, locale, long text, time, formatting, and bidirectionality.
- Analytics, support, and user-experience evidence.

### Learning aids

- Prediction prompt.
- Compact annotated code excerpt.
- Sequence, state, dependency, or data-flow diagram.
- Comparison table or before/after example.
- Debugging playbook or decision tree.
- Modification exercise, test-writing exercise, or “make” challenge.
- Misconception and counterexample.
- Further reading limited to internal authoritative material or official version-relevant docs.

## Clue convergence matrix

| Candidate module        | Strong convergence examples                                                                          | Signals that are insufficient alone                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Consumer impact         | incoming relation + caller source; route registration + handler; event producer + consumer           | similar filenames; directory proximity                                |
| Security/privacy        | entry boundary + control source; auth helper + protected consumer; data sink + validated path        | `auth` directory; framework security reputation; generic scanner lead |
| Performance/cost        | work-path structure + scale input + runtime measurement; query loop + executed query evidence        | loop presence; database package; “hot” filename                       |
| Data integrity          | schema/constraint + write path; transaction + failure path; cache owner + invalidation consumer      | ORM dependency; model filename                                        |
| Reliability/concurrency | producer + consumer + retry/order implementation; timeout + recovery test; runtime incident evidence | queue package; async keyword; worker directory                        |
| Dependency/version      | manifest + lock + observed import; adapter + consumer + official compatible version                  | declaration only; latest-version search result                        |
| Tests                   | verified test import + behavior assertion; route + integration test + expected outcome               | test filename; test framework dependency                              |
| Deployment/operations   | deployment asset + startup path + config branch; health check + runtime topology                     | Dockerfile alone; CI filename                                         |
| UI/accessibility        | interactive source + state branch + browser/semantic evidence                                        | React/Vue package; component filename                                 |
| Historical trade-off    | confirmed decision + current relevant source; dated ADR + implementation evidence                    | stale memory; comment without code support                            |

## Presentation constraints

The internal plan may retain scores, omissions, limitations, and many candidates. The learner-facing
lesson should normally contain four to eight sections with plain headings. Do not expose a rubric,
empty optional headings, or an exhaustive inventory. Put evidence beside claims, label uncertainty,
and give the reader one coherent path through the subject.
