# Analysis Lens Contract

Read this reference when interpreting the profiler's priorities or adding a new cross-cutting lens.

A lens is a way to interrogate a verified program flow. It is not a quota, scanner category, or
generic best-practice list. Apply high-ranked lenses first and explain why they matter to this
program.

## Built-in lens families

- behavioral: correctness, reliability, data integrity, offline behavior;
- risk: security, privacy, memory safety, portability;
- resource: performance, cost, operability;
- human: accessibility, user experience;
- change: maintainability, testability, reproducibility, quality.

`packs/lenses.json` provides canonical questions and expected evidence classes. A language or
framework pack raises a lens's relevance; purpose, critical workflows, and observed architecture
must still determine actual priority.

## Applying a lens

1. Select a critical flow or responsibility.
2. Ask the lens questions at relevant zoom levels.
3. Identify the evidence needed to answer them.
4. Use the preferred tool and honor its failure gate.
5. Verify the material control/data/runtime path.
6. Explain consequence, likelihood, confidence, and uncertainty.
7. Convert only the strongest learning opportunity into a lesson.

Do not say “performance problem” from nested syntax without input size and execution context. Do
not say “vulnerability” from a scanner match without reachability, trust boundary, controls, and
impact. Do not say “inaccessible” without evaluating the relevant interaction and user state.

## Adding a lens

A new lens needs:

- a stable lowercase ID;
- two or more questions that change investigation behavior;
- evidence classes that could answer those questions;
- at least two distinct program archetypes where the lens adds value;
- tests showing it can be ranked and composed.

Avoid synonyms for existing lenses. Add specialized packs or investigations when the concern is an
ecosystem-specific instance of an existing lens.
