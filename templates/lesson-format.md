# Dynamic lesson composition contract

This is an agent-facing composition template, not a document to copy verbatim. Build a rich internal
model, then emit a small lesson that feels purpose-built for the selected code and learner.

## Required internal pass

1. Run `plan-lesson.js` for the explicit target, focus, depth, and scope.
2. Inspect the plan's focus anchors, signal evidence, limitations, coverage, and evidence gaps.
3. Cross-check every selected claim in live source. Tool output and the program model select what to
   inspect; they are not substitutes for source verification.
4. Add enhanced-tool evidence only after the operation succeeded. If it failed, follow the skill's
   transparent fallback gate before continuing.
5. Use confirmed project memory for preferences and historical reasons only. Never use it as proof
   of current behavior.

## Signal activation gate

An optional lesson module may appear only when it is relevant to the focus and supported by either:

- two independent, mutually reinforcing target signals, such as a route plus an authorization
  helper, an import edge plus a test, or a manifest declaration plus observed source use; or
- one authoritative signal, such as verified source control flow, a successful focused analyzer,
  runtime evidence, official version-matched documentation, or a user-confirmed decision.

A filename alone, a framework's presence, a generic best practice, or a ranked lens alone is not
enough. Prefer signals that connect different parts of the application:

- entry point + module relation + state effect + test;
- route + permission control + data access + forbidden-state handling;
- manifest + lockfile + source import + deployment constraint;
- component + API contract + cache/state owner + interaction states;
- job producer + queue + consumer + retry/idempotency path + observability;
- schema/migration + repository + transaction + downstream reader;
- configuration + startup registration + runtime branch + health/recovery behavior.

If the evidence establishes relevance but not a conclusion, teach the investigation and the
missing measurement. Never turn “performance-relevant” into “slow,” “security-relevant” into
“vulnerable,” or “untested relation” into “uncovered behavior.”

## Choose one primary shape

Use the shape selected by the lesson planner unless verified evidence or the user's intent clearly
requires another. Available shapes are architecture orientation, end-to-end flow, code mechanics,
change impact, debugging/failure, security boundary, performance/scale, data/state,
dependency/ecosystem, operations/deployment, testing/verification, and UI/interaction.

Each shape has its own required modules. Read `references/lesson-composition.md` for the recipes and
the complete required/optional section catalog. Do not force every lesson through one section order.

## Compose the visible lesson

- Use the plan as a compact outline, not as content to print.
- Normally publish four to eight plainly titled sections. A concise lesson can use three; a deep
  lesson can use up to ten when each section earns its place.
- Omit inactive modules completely. Never print empty placeholders, signal scores, reason codes, or
  internal confidence machinery.
- Put the learner's goal and the most useful mental model first. Move evidence next to the claim it
  supports rather than adding a giant evidence dump.
- Cite exact project-relative paths and line numbers. Include only small, verified, redacted code
  excerpts.
- Use one diagram, table, or trace only when it makes a multi-part relationship materially easier
  to understand.
- Weave PRIMM into the selected shape: invite a prediction, read the evidence, investigate the
  mechanism, propose a modification, and end with a small make-or-verify challenge. These are
  teaching moves, not mandatory headings.
- Explain jargon at first use. Prefer short causal sentences and concrete names from this program.
- End with a mental-model recap, a concrete next step or challenge, evidence gaps, and the run's
  Tool Use Ledger. For a workbook, these may live at the workbook level instead of every lesson.

## Final quality check

Before publishing, confirm:

- the title describes the actual learning outcome;
- the lesson connects purpose, relationships, exact mechanics, and consequences at the appropriate
  zoom levels;
- every optional section passed the activation gate;
- facts, derived conclusions, inferences, hypotheses, and historical decisions are distinguishable;
- security, performance, compatibility, and production claims have the required evidence;
- the lesson remains easy to scan despite the richer internal analysis;
- unresolved questions are visible and no tool failure was hidden.
