# Bottleneck Checkpoints

Read with `script-agent-dialogue.md`. After each major script/tool turn, complete the matching
checkpoint (or `SKIP … because …` in the ledger). One semantic rewrite max per checkpoint.

Universal stack: **floor (script) → ask (agent) → sense (once) → optional judge later**.

Trajectory (workbook): `B0 → B1 → B2 → B5 → B3 → B4a → B4b+B6`.  
PR/focused may skip B3/B4a with ledger reason.

---

## B0 — Purpose & criticality

**Ask:** `ACCEPT purpose | UNRESOLVED + ≤3 questions.` Cite README/docs or user message. Never invent
users, SLOs, or critical workflows.

**Floor:** profile purpose stays inferred until ACCEPT; curriculum save needs
`agentApproval.purposeStatus: accepted|unresolved`.

**Sense:** ACCEPT has a concrete anchor; else UNRESOLVED.

---

## B1 — Stack & project shape

**Ask:** Confirm or correct `primaryArchetype`, `languages[]`, `frameworks[]`. Flag pack mismatches.

**Floor:** packs ⊆ registry; manifests observed.

**Sense:** ledger records corrections.

---

## B2 — Inventory & coverage

**Ask:** From `coverageStatus` + `blindSpots`, state what we know we don’t know. Emit ≤5 retrieve
questions (symbol/path/workflow).

**Floor:** plan/profile summaries expose `blindSpots`, `mustNotClaim`, `nextAsks`.

**Sense:** questions are specific enough for Graphify/Serena.

---

## B3 — Lesson-worthy topics

**Ask:** `SHORTLIST` keep/demote/add. Each keep: one sentence why it enables a safe change.
Corroborate naming-heuristic IDs or demote.

**Titles (agent judgment):** plan-curriculum `title` / `learnerOutcome` are path-unique
placeholders. Before save-curriculum / teach, rewrite kept rows from live source:

- Name the mechanism or decision (symbol, screen, contract) — not folder genre or chapter.
- Same chapter: do not reuse one sentence stem with only the basename swapped (classic fail:
  `Trace the data lifecycle through X` × N, `Understand the role of X` × N).
- Prefer `How X does Y` / consequence lines when evidence allows. Keep product context on
  generic basenames (`Chat store types`, not `Types`).
- Sense check: skim INDEX — each line stands alone; three shared stems → rewrite.

**Floor:** `agentApproval` + corroboration gate (existing). No hard title regex on save —
taste is the agent's job.

**Sense:** shortlist ≠ scanner top-N; critical flow present when purpose known; INDEX reads
hand-written, not stamped.

---

## B4a — Curriculum design

**Ask:** Is study order purpose → flow → ownership → mechanism? Split/demote omnibus topics.
Re-check title diversity after demotions (B3 title rules).

**Floor:** topic count / chapter diversity on save; omnibus titles (`whole app` / `complete overview`)
rejected by `agentApproval` validation.

**Sense:** each outcome is one skill; INDEX is skimmable without identical sentence stems.

---

## B4b — Lesson craft (PRIMM moves)

**Ask:** Draft one topic. Self-check predict hook, investigate-from-citations, concrete modify
challenge, transfer recap—without empty PRIMM headings.

**Floor:** `check-lesson-quality.js`.

**Sense:** semantic checklist in dialogue ref + PRIMM moves present.

---

## B5 — Relationship retrieval

**Ask:** For topic X: who calls it? what does it call? where registered? how fails? Verify ≤3
returned nodes in live source.

**Floor:** maintainer notes record fallback; user chat stays silent on tool plumbing.

**Sense:** cited consumers/deps exist or gap named.

---

## B6 — Evidence honesty

**Ask:** Decompose ≤5 material claims. Tag `observed|derived|inferred|hypothesis`. Map each to a
citation; mark support `yes|no|gap`. List claims you almost overstated.

**Floor:**

```text
node <skill-root>/scripts/check-lesson-evidence.js <target-root> <lesson.md>
node <skill-root>/scripts/check-lesson-faithfulness.js <target-root> <lesson.md>
```

Every `path:line` must resolve inside the target with a valid line. Prefer an explicit `CLAIMS:`
block; unsupported `support: yes` claims fail the faithfulness check (and block `save-lesson`).

**Sense:** claim-vs-snippet support for those claims; optional report-only `evaluate-lesson.js`
rubric proxies (not a CI gate).

---

## Claim decomposition (B6 sense)

After the evidence floor passes:

```text
CLAIMS:
1. "<claim>" — <path:line> — support: yes|no|gap — state: observed|…
2. …
REWRITE once if any material claim is no without a named gap.
```
