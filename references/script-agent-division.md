# Script-Agent Division of Labor

The skill enforces a clean contract: **scripts own what is verifiable and predictable; the agent owns what is judgment and taste.**

## Ownership Domains

| Domain                                                                                        | Owner   | Why                                                        |
| --------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| **Inventory** (files, calls, manifest versions, graph)                                        | Scripts | Verifiable, cacheable, deterministic                       |
| **Mechanical QA** (citation format, `path:line` resolves, word count, secrets, puffer tokens) | Scripts | Verifiable by regex/AST; cheap and correct                 |
| **Selection** (what to teach, what's important, what's the BLUF)                              | Agent   | Judgment, context-dependent, resists encoding              |
| **Lesson quality** (is this insightful, accurate, well-paced)                                 | Agent   | Semantic; the very thing regex fails at                    |
| **Chat flow** (turn order, what's asked when, when to stop)                                   | Scripts | Predictability for the user is the product                 |
| **Viewer rendering** (HTML/CSS, themes, navigation, TOC, search)                              | Scripts | Same UX every time; never delegated to agent improvisation |
| **Save / persist** (atomic write, schema, progress, draft cleanup)                            | Scripts | Atomicity and correctness                                  |

## The Data Contract

Every handoff between scripts and the agent is structured JSON with a defined schema. There is no freeform chat crossing the boundary.

- **Scripts emit:** `{ role, proposals, evidence, limitations, nextAsks }`
- **Agent emits:** `{ judgments, decisions, acceptedIds, claims, ledger }`

## Worked Examples

### 1. Curriculum proposal → Agent shortlist

- **Script (proposes):** Scans the project and emits a JSON list of topics (`proposals`), identifying relationships (`evidence`), and suggesting what to cover (`nextAsks`).
- **Agent (judges):** Evaluates the proposal against the learner's purpose. Emits a structured JSON with `acceptedIds` for the topics to keep and `decisions` for the reasoning.

### 2. Evidence packet → Agent draft

- **Script (gathers):** Resolves the target topic, extracts file contents, dependency graphs, and structural references (`evidence`). Emits JSON.
- **Agent (writes):** Reads the evidence and writes the Markdown draft, leveraging its semantic understanding. The output is the raw markdown content.

### 3. Draft → Agent judgment

- **Script (verifies):** Performs mechanical QA on the draft (word count, citation formats). If it passes, it asks the agent to review.
- **Agent (judges):** Reviews the lesson against the rubric. Emits a JSON containing `judgments` (scores, mustFix notes).
- **Script (saves):** Only persists the draft if the agent's recorded judgment meets the threshold.
