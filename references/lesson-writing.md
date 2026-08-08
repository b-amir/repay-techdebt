# Lesson Writing Standard

Read this before drafting or reviewing any learner-facing lesson. The repository analysis may be
complex; the prose must not be.

## The unit of teaching

One lesson teaches one durable mental model, decision, flow, or mechanism. If the title needs “and”
to join two independently useful topics, split it. Code generation, API ownership, cache
invalidation, and handwritten contract drift are four lessons, not four sections in one chapter.

## Topic titles (INDEX + lesson frontmatter)

Script titles are path placeholders. Agent owns final INDEX + lesson titles:

1. Read the focus path, its anchors, and every title already present in the curriculum.
2. Invent a truthful, memorable title for this lesson's particular mechanism, decision, tension, or
   consequence. No prefix, sentence template, programmed rotation, or preferred grammatical form
   is required.
3. Keep product context on generic basenames (`Chat store types`, not `Types`), but do not simply
   substitute a new basename into an existing title's frame.
4. Compare the candidate against the complete title set. Avoid repeated opening words, rhythms,
   framing devices, and near-synonym rewrites that would make the index feel stamped out.
5. Treat script similarity diagnostics as neutral comparison evidence. The agent—not the script—
   decides whether and how to rewrite.
6. Lesson `title` frontmatter = `H1` = INDEX link text.

Before keeping a topic, ask what the learner can change or debug. Fold wrappers, re-exports,
constant tables, and same-flow helpers into the owning outcome unless they introduce a distinct
failure mode, blast radius, or trust decision. Scanner rows are candidate evidence, not a syllabus.

Default size:

- concise: 250–650 words;
- balanced: 450–950 words;
- deep: 700–1,300 words.

Depth adds evidence or examines a mechanism more closely. It does not add unrelated topics.

## Required anatomy

Every lesson must contain these five elements to ensure it teaches effectively rather than just describing code.

| Element                 | Description                                                                                  | Example                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BLUF**                | Bottom Line Up Front. The core mechanism and consequence in the opening paragraph.           | _When a request hits `/api/order`, the permission check runs **before** the price is computed — so a forbidden request never touches pricing state._ |
| **Tricky-part heading** | A specific section heading calling out the non-obvious part of the mechanism.                | _## Why the cache is invalidated twice_                                                                                                              |
| **Worked-trace**        | An ordered trace through the mechanism or flow.                                              | _1. `POST /order` → 2. `checkPermission` → 3. `computePrice` → 4. `invalidateCache`._                                                                |
| **Contrast**            | A comparison showing what goes wrong if the mechanism is omitted or implemented incorrectly. | _`diff\n- old buggy code\n+ fixed code\n` or a "What goes wrong if you skip X" subsection._                                                          |
| **Takeaway**            | A concluding sentence anchoring the most important insight.                                  | _**If you remember one thing:** the permission decision owns the request — never let pricing or caching run first._                                  |

## Choose importance before novelty

A teachable curiosity is not automatically worth a lesson. Rank the topic before drafting it.
Prefer topics that explain:

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

Every section must answer a reader question. Good headings name the topic, such as “Where the
permission decision happens” or “Why the cache is invalidated twice.” Do not expose teaching
machinery as headings: `Predict`, `Read`, `Run`, `Investigate`, `Modify`, and `Make` are internal
moves, not an outline. Avoid `Overview`, `Details`, and `Conclusion` when a specific heading exists.

Declare the three mechanically required roles in frontmatter so visible headings can stay specific:

```yaml
sectionRoles:
  workedPath: Where the permission decision happens
  pitfall: Why hiding the button is not authorization
  check: Debug a direct-route bypass
```

Explain cause and consequence explicitly: because, therefore, which means, or as a result. End a
section on the consequence the reader should remember, not on a stray implementation detail.

## Evidence belongs beside the claim

Use two to four source files in a normal lesson. Cite project-relative paths and line numbers. Show
at least one small verified fenced snippet from the primary path—not Mermaid alone. After a snippet,
explain what the language/runtime does
and why that behavior matters here. A filename, an analyzer score, or a generic framework rule is
not proof. Before persistence, every citation must resolve to a current file and valid line in the
explicit target, and at least one citation must match the curriculum topic's evidence anchors.

Follow the lesson plan's `diagramIntent`. Use a verified diagram when it materially clarifies a
sequence, state transition, ownership boundary, or multi-part relationship; reduce it to the
smallest useful subgraph. Omit it only with a topic-specific reason. Every Mermaid block must parse
successfully before save.
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

1. Remove every sentence that does not serve the title's single topic.
2. Split paragraphs that make two points.
3. Replace passive constructions and abstract nouns with the actor and action.
4. Remove repetition, throat-clearing, generic best practices, and AI-flavored filler such as
   “delve,” “seamlessly,” or “game-changer.”
5. Check that the opening promises a concrete outcome and every section fulfills it.
6. Check that the ending is a small modify, debug, run/predict, or named-test assertion job. Recall
   alone does not demonstrate transfer. Provide private rubric or answer guidance.
7. Ensure the lesson establishes clear motivation, teaches a causal mental model, anticipates at least one misconception, and manages cognitive load appropriately.
8. Run `check-lesson-quality.js`; fix every error. Treat warnings as revision prompts, not noise.
9. Record reviewer provenance. If the authoring agent also reviews, mark `self`; its score is
   advisory and every `mustFix` still blocks. See `references/lesson-reviewer.md`.

The automated check is a floor, not proof of an excellent lesson. A passing lesson can still be
unimportant, incorrect, or dull; source verification and editorial judgment remain required.
