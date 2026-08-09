# Golden lesson fixtures (Phase 0.0)

Human-authored craft anchors for repay-techdebt.  
**Purpose:** few-shot input for the teach handshake (Phase 1.1) and calibration source for sitting-size / usefulness floors (Phase 1.3).  
**Not wired yet:** handshake load and numeric save floors land later - do not invent thresholds here beyond observed notes.

## Index (paths for agents)

| ID              | Role                                      | Path                                                       |
| --------------- | ----------------------------------------- | ---------------------------------------------------------- |
| **A**           | Flow/path lesson **with** structure map   | [`a-path-with-map/lesson.md`](./a-path-with-map/lesson.md) |
| **B**           | Single-file/symbol deep dive. Map skipped | [`b-deep-dive/lesson.md`](./b-deep-dive/lesson.md)         |
| **Craft pairs** | Curriculum + lesson good/bad decisions    | [`craft-pairs.md`](./craft-pairs.md)                       |
| **Target tree** | Citation target for A/B (`billing/*`)     | [`target/billing/`](./target/billing/)                     |

Related eval mini-lesson (CLAIMS block only, **not** a craft golden):
`test/fixtures/evaluation/golden-lesson/lesson.md`

## How to read them

1. Open **A** for path + mermaid map + multi-file check-yourself.
2. Open **B** for deep dive + `skipReasons.map` in frontmatter.
3. Skim **craft-pairs** before shortlisting or drafting a lesson.
4. Resolve citations against **`target/`** as `targetRoot` (paths inside lessons are project-relative: `billing/capture.js`, `billing/settlement.js`).

## Frontmatter slots used (draft contract preview)

| Field             | A                                 | B                |
| ----------------- | --------------------------------- | ---------------- |
| `subject`         | `flow`                            | `code-mechanics` |
| `shape`           | `end-to-end-flow`                 | `code-mechanics` |
| `mapAnswers`      | set (structure question answered) | omitted          |
| `skipReasons.map` | omitted                           | set (why no map) |
| `primaryPaths`    | capture + settlement              | settlement       |
| `sectionRoles`    | topic-specific worked/pitfall/job | same             |

Xor rule (`mapAnswers` **or** `skipReasons.map` on architecture/flow/structure) is enforced in Phase **1.2** - fixtures already model the happy shapes.

## Observed sitting size (from A+B only)

Calibrate later floors from these notes - **do not invent abstract caps in 0.0 code.**

| Fixture     | Approx words (body)                 | Level-2 sections | Sitting feel                |
| ----------- | ----------------------------------- | ---------------- | --------------------------- |
| A path+map  | ~450 body words (`depth: balanced`) | 5                | ~6–8 min scan + 2 min check |
| B deep dive | ~380 body words (`depth: concise`)  | 4                | ~4–6 min scan + 1 min check |

Shared craft density:

- Hook states mechanism + consequence in first screenful.
- One worked path through real paths/lines. Small snippets only.
- H2s are topic-specific (never `The Mechanism` / `Pitfall` / `Try It` / `Invariant`).
- Titles name a mechanism or consequence, not a Title-Cased file path.
- At most one mermaid map (A only), with `accTitle` / `accDescr` and **What this shows:**.
- Ending is a small change/debug/test-prediction job on real files, not symbol recall.
- Takeaway one-liner at end.

Default-path “~5–10 min” product claim matches A. B is the shorter deep-dive sibling.

## Taste bar

A maintainer should say “I’d finish these.” If a rewrite makes them status-log sludge or generic payment textbooks, reject the rewrite - goldens win over abstract rules.

## Out of scope for this folder

- Wiring teach handshake to auto-load these (1.1)
- Numeric save floors / CI gates (1.3, 0.6)
- Trajectory gate / fail-closed save (0.1–0.4)
