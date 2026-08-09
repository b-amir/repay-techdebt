# Dynamic lesson composition contract

This is an agent-facing composition template, not a document to copy verbatim. Build a rich internal
model, then emit a small lesson that feels purpose-built for the selected code and learner.

## Required internal pass

1. Run `plan-lesson.js` for the explicit target, focus, depth, and scope.
2. Read `references/lesson-writing.md` and confirm that the focus is a ranked curriculum topic, not
   merely an interesting analyzer result.
3. Inspect the plan's focus anchors, signal evidence, limitations, coverage, and evidence gaps.
4. Cross-check every selected claim in live source. Tool output and the program model select what to
   inspect; they are not substitutes for source verification.
5. Add enhanced-tool evidence only after the operation succeeded. If it failed, follow the skill's
   transparent fallback gate before continuing.
6. Use confirmed project memory for preferences and historical reasons only. Never use it as proof
   of current behavior.
7. After drafting, run `check-lesson-quality.js`, `check-lesson-evidence.js`, and the deterministic
   anchor-coverage check. Then perform the agent semantic + claim-decomposition steps in
   `references/bottleneck-checkpoints.md` (B4b/B6). At most one rewrite unless the user asks for
   more.

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
- Teach one subject. Normally publish three to eight plainly titled sections and stay within the
  configured depth's word range. Split independently useful ideas into separate curriculum topics.
- Omit inactive modules completely. Never print empty placeholders, signal scores, reason codes, or
  internal confidence machinery.
- Put the learner's goal and the most useful mental model first. Move evidence next to the claim it
  supports rather than adding a giant evidence dump.
- Cite exact project-relative locations only as self-contained `` `path:line` `` or
  `` `path:start-end` `` references. Never use a pathless range. Name the behavior or symbol in
  prose and let the viewer move raw locations into numbered Sources notes. Include only small,
  verified, redacted code excerpts, including at least one fenced source snippet from the primary
  path.
- Follow the plan's `diagramIntent`. A `required` visual must be included; a `recommended` visual
  may be omitted only with a topic-specific `diagramReason`; `omit` must not include Mermaid.
  Diagrams use only verified nodes and edges, stay small, and must parse before save. Prefer a
  compact portrait or near-square layout that reads without zooming: flowcharts default to `TD` or
  `TB`, while `LR`/`RL` need a topic-specific reason. Avoid long single-column chains by pruning,
  grouping, shortening labels, or moving secondary detail into prose.
- Weave PRIMM into the selected shape: invite a prediction, read the evidence, investigate the
  mechanism, propose a modification, and end with a small make-or-verify challenge. These are
  teaching moves, not mandatory headings.
- Interactive learning is optional. Use it only at a natural decision, misconception, or observable
  runtime boundary; never add a widget to satisfy a lesson quota. Prefer no more than three varied
  pauses in one lesson, and keep the surrounding explanation complete without them.
- When prediction materially improves understanding, use one progressive-disclosure block:

  ```markdown
  > **Prediction:** What will the caller observe if this guard is removed?
  >
  > **Reveal:** The request reaches the mutation because the route no longer rejects it first.
  ```

  The prompt must still make sense before it is opened, and the revealed answer must explain the
  mechanism rather than merely mark the guess right or wrong.

- For a question the learner should reason through before reading, use a quieter answer disclosure:

  ```markdown
  > **Think first:** Why does the route loader reject this request before the component renders?
  >
  > **Answer:** Loaders run during route entry, so the component never becomes the security boundary.
  ```

- For one consequential misconception with plausible alternatives, use a single-answer check. Mark
  exactly one choice with `[x]`, provide two to four choices, and explain the mechanism—not just the
  score—in `Why`:

  ```markdown
  > **Quick check:** Which boundary can reject direct navigation before protected UI renders?
  >
  > - [ ] The component permission gate
  > - [x] The route loader
  > - [ ] The API response mapper
  >
  > **Why:** The loader runs during route entry and can redirect before the component tree exists.
  ```

- When behavior is safely reproducible in a browser, offer a guided DevTools observation. Name the
  setup, exact action, expected signal, one safe variation, and how to return to the original state.
  Never ask the learner to expose secrets, mutate production data, or disable a real security
  boundary:

  ```markdown
  > **See for yourself:** Watch the route turn an expired session into a redirect.
  >
  > 1. Open **Network**, enable **Preserve log**, and load the protected route in local development.
  > 2. Select the document request and inspect its status and `Location` response header.
  >
  > **Change one thing:** Clear the local session cookie and reload once.
  >
  > **Look for:** The redirect occurs before protected page data or component requests appear.
  >
  > **Reset:** Sign in again to restore the original session state.
  ```

- Explain jargon at first use. Prefer short causal sentences and concrete names from this program.
- Give topic-specific H2s and map `workedPath`, `pitfall`, and `check` to them with frontmatter
  `sectionRoles`; do not copy the checker’s fallback labels as an outline.
- End with a concrete modify/debug/run-predict/named-test job, not a name-the-symbol quiz. Name the
  invariant to preserve, the affected consumer or boundary, the verification to run, and the signal
  that would reveal a regression. Keep evidence gaps and the Tool Use Ledger at workbook level for a
  multi-lesson workbook instead of repeating administrative detail in every lesson.

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
- `check-lesson-quality.js` passes before the lesson is saved.

### Required Anatomy Checklist

- [ ] **BLUF:** Verify the opening paragraph states the core mechanism and its project consequence.
- [ ] **Tricky-part heading:** Verify there is a specific section calling out a non-obvious part of the mechanism.
- [ ] **Worked-trace:** Verify there is a step-by-step trace of the flow or mechanism.
- [ ] **Contrast:** Verify there is a comparison (e.g., buggy vs fixed code, or consequences of omitting a step).
- [ ] **Takeaway:** Verify the lesson ends with a concluding sentence anchoring the most important insight.
- [ ] **Transfer job:** Verify the learner changes, debugs, runs/predicts, or writes a named-test assertion.
