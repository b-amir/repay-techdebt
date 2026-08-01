# Lesson writing standard

Read this before drafting or reviewing any learner-facing lesson. The repository analysis may be
complex; the prose must not be.

## The unit of teaching

One lesson teaches one durable mental model, decision, flow, or mechanism. If the title needs “and”
to join two independently useful subjects, split it. Code generation, API ownership, cache
invalidation, and handwritten contract drift are four lessons, not four sections in one chapter.

Default size:

- concise: 250–650 words;
- balanced: 450–950 words;
- deep: 700–1,300 words.

Depth adds evidence or examines a mechanism more closely. It does not add unrelated subjects.

## Choose importance before novelty

A teachable curiosity is not automatically worth a lesson. Rank the subject before drafting it.
Prefer subjects that explain:

1. why the program exists and what a user is trying to accomplish;
2. a critical user, business, security, data, or operational workflow;
3. a highly connected module or contract that many changes depend on;
4. an entrypoint, ownership boundary, state transition, failure path, or trust decision;
5. an exact mechanism that unlocks safe debugging or modification.

Penalize generated code, barrels, formatting, build plumbing, test infrastructure, and analyzer
novelty unless they materially constrain production behavior. Do not let tooling dominate the
opening study path merely because its evidence is easy to collect.

## Build the explanation

Write directly to the reader. State what they will be able to understand or do, then explain why it
matters in this program. Put the claim before its detail. Give each paragraph one job and begin it
with the point the rest of the paragraph supports.

Use active voice, concrete nouns, and the project's own terminology. Explain a term at first use.
Keep the same name for the same concept. Prefer “the route rejects a forbidden request” to “request
rejection is performed.” Prefer the exact consequence to adjectives such as “robust,” “powerful,”
or “scalable.”

Every section must answer a reader question. Good headings name the subject, such as “Where the
permission decision happens” or “Why the cache is invalidated twice.” Do not expose teaching
machinery as headings: `Predict`, `Read`, `Run`, `Investigate`, `Modify`, and `Make` are internal
moves, not an outline. Avoid `Overview`, `Details`, and `Conclusion` when a specific heading exists.

Explain cause and consequence explicitly: because, therefore, which means, or as a result. End a
section on the consequence the reader should remember, not on a stray implementation detail.

## Evidence belongs beside the claim

Use two to four source files in a normal lesson. Cite project-relative paths and line numbers. Show
only the code needed for the mental model. After a snippet, explain what the language/runtime does
and why that behavior matters here. A filename, an analyzer score, or a generic framework rule is
not proof. Before persistence, every citation must resolve to a current file and valid line in the
explicit target, and at least one citation must match the curriculum topic's evidence anchors.

Use at most one diagram or table, and only when it clarifies a relationship prose would obscure.
Put tool attempts, failures, fallbacks, and limitations in the workbook-level Tool Use Ledger; do
not repeat the ledger in every short lesson.

## A flexible visible shape

Use three to eight specific level-two sections. Adapt them to the selected lesson shape, while
covering these reader needs:

- the outcome and project consequence;
- the smallest useful path through the code;
- the mechanism or invariant;
- the safe change or verification boundary;
- one answerable check, prediction, or small challenge.

Do not force these labels verbatim. A security lesson and a UI interaction lesson should not look
like copies of the same form.

## Revision pass

Before saving:

1. Remove every sentence that does not serve the title's single subject.
2. Split paragraphs that make two points.
3. Replace passive constructions and abstract nouns with the actor and action.
4. Remove repetition, throat-clearing, generic best practices, and AI-flavored filler such as
   “delve,” “seamlessly,” or “game-changer.”
5. Check that the opening promises a concrete outcome and every section fulfills it.
6. Check that the ending asks for one useful act of recall, tracing, debugging, or change.
7. Run `check-lesson-quality.js`; fix every error. Treat warnings as revision prompts, not noise.

The automated check is a floor, not proof of an excellent lesson. A passing lesson can still be
unimportant, incorrect, or dull; source verification and editorial judgment remain required.
