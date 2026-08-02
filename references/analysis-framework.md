# Adaptive Program-Intelligence Framework

Use this reference to control analysis depth and lesson selection. The engine is not a checklist and
does not promise equal coverage of every concern. It builds an evidence graph, identifies the
program's purpose and constraints, and spends attention where understanding most changes the
developer's ability to modify the system safely.

## Operating loop

1. **Profile (script inventory):** languages, frameworks, shapes, boundaries, entry points —
   `profile-project.js`. Agent confirms purpose.
2. **Model:** normalized graph via `build-program-model.js` or an accepted richer graph tool.
3. **Plan (script propose):** `plan-analysis.js` / `plan-curriculum.js` emit ranked proposals with
   `nextAsks` — not finished truth.
4. **Investigate (agent ↔ retrieve tools):** Graphify/Serena questions, then verify in source.
5. **Verify:** promote hypotheses with source, test, tool, runtime, or user evidence.
6. **Teach handshake:** advisory `plan-lesson` → draft → mechanical QA → agent semantic pass → save.
7. **Remember:** only approved lessons, decisions, and curriculum progress — never raw indexes or
   unverified findings.

## Continuous zoom hierarchy

Move in either direction. Do not force every lesson through every level.

| Zoom       | Object of study                                         | Questions that justify visiting it                         |
| ---------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| Ecosystem  | users, peer systems, regulations, platforms             | Why does this program exist? Who is harmed by failure?     |
| System     | deployable application or product                       | What enters, what leaves, where is authoritative state?    |
| Domain     | business or technical capability                        | Which invariants and vocabulary organize the behavior?     |
| Flow       | end-to-end request, event, job, render, or computation  | How does one input become effects and outcomes?            |
| Module     | package, service, directory, component, crate, assembly | Who owns this responsibility and who consumes it?          |
| Symbol     | class, type, endpoint, query, command, component        | What contract does it expose and depend on?                |
| Function   | branch, loop, transaction, task, render, algorithm      | What are its inputs, invariants, costs, and failure paths? |
| Expression | syntax, operator, annotation, type, API call            | What does the language/runtime actually do here?           |

Zooming out prevents locally attractive advice from violating system constraints. Zooming in keeps
architecture explanations anchored in executable behavior.

## Relevance function

Rank an investigation using explicit evidence, not intuition alone:

```text
priority = impact × likelihood × change-relevance × learner-value × confidence
           + uncertainty-reduction + graph-centrality
           - acquisition-cost - duplication-with-existing-lessons
```

The formula is ordinal, not financial mathematics. Explain material ranking reasons. Raise priority
for critical user paths, trust boundaries, authoritative state, irreversible side effects, wide
consumer graphs, repeated change hotspots, and questions the learner explicitly asked. Lower it for
dead code, generated code, examples, generic style preferences, and hypotheses with no realistic
verification path.

## Relationship-first rule

Never analyze a selected module as an island. Establish as many of these as the program supports:

- owners and contained symbols;
- incoming callers, imports, event producers, route registration, or dependency injection;
- outgoing calls, imports, data stores, events, side effects, and remote integrations;
- tests, fixtures, schemas, migrations, configuration, deployment, and telemetry;
- dynamic or runtime relations that static imports cannot express.

If the user asks about authentication, map route guards, UI visibility, session creation, token or
cookie validation, authorization checks, persistence, consumers, tests, and failure behavior. If
some relation class is unsupported, state that exact blind spot.

## Purpose and criticality

Repository evidence can suggest an archetype but cannot prove product purpose. Confirm or leave
unresolved:

- users and primary jobs;
- critical workflows and unacceptable failures;
- latency, throughput, scale, availability, cost, and compatibility constraints;
- security, privacy, safety, accessibility, and regulatory obligations;
- authoritative state and recovery requirements;
- expected rate and kind of change.

Use these constraints to weight lenses. A compiler, mobile banking app, game loop, data migration,
embedded controller, CLI, UI library, ML experiment, and background worker should not receive the
same plan merely because they share a language.

## Workflow Discovery

Infer likely user and operator workflows from route registration, navigation, labels, API contracts,
commands, jobs, permissions, documentation, tests, and deployment configuration.
A workflow candidate requires multiple independent signals or one authoritative declaration.
- Navigation-only, filename-only, and framework-default leads are labeled weak.
- Every inferred workflow explains which clues raised or lowered its confidence.
- Consolidate converging clues (e.g., a file named `routes.js` matching a React navigation tree) to form high-confidence workflows.

## Runtime evidence boundary

Static evidence explains possibility and structure. Runtime evidence explains actual execution,
frequency, values, costs, and failure. Ask before commands that can mutate target state, require
credentials, access production, start services, write profiles, or send network traffic. Prefer
existing tests, traces, profiles, telemetry, and reproducible local scenarios. Label production
claims unresolved when production evidence is unavailable.

## Lesson selection

A strong lesson has all of the following:

1. verified project evidence;
2. a relationship to a meaningful flow or consumer;
3. exact language or framework semantics where they matter;
4. a consequence the learner will encounter while debugging, changing, testing, operating, or
   reviewing the program;
5. a concrete prediction or modification exercise;
6. explicit evidence gaps and confidence.

Prefer one deep path over ten disconnected observations. A lesson can start at any zoom, but it
must connect at least one level inward and one level outward.

## Completion criteria

An analysis is complete for its declared scope when:

- purpose and constraints are confirmed or explicitly unresolved;
- critical entry-to-effect paths are represented;
- selected modules include known consumers and dependencies;
- top-ranked lenses were investigated or explicitly skipped;
- facts, derivations, inferences, and hypotheses are distinguishable;
- tool failures and accepted fallbacks appear in the ledger;
- the learner has a mental model, modification challenge, and next investigation—not just findings.
