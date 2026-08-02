# Session progress stepper (mandatory user-facing UX)

Print or update this line at the **top of every user-visible turn** in workbook, focused, and PR
flows. Use human phase names only — never B0–B6, RETRIEVEQs, SHORTLIST, or checkpoint codes in the
same message.

## Workbook spine (default)

Copy and edit the bracket markers:

```text
Progress: [x] Setup → [x] Confirm what matters → [!] Pick study plan → [ ] Write lessons (0/3) → [ ] Open workbook → [ ] Done
```

| Marker | Meaning       |
| ------ | ------------- |
| `[x]`  | Step complete |
| `[!]`  | Current step  |
| `[ ]`  | Upcoming      |

### Step definitions

1. **Setup** — Memory initialized, runtime preflight done, target roots confirmed.
2. **Confirm what matters** — User agreed what the product is for (or marked unknown gaps).
3. **Pick study plan** — Curriculum proposed; user approved the topic list (shortlist).
4. **Write lessons** — Teaching handshake for this batch. Show honest count, e.g. `(2/3)` for two
   saved of three planned this run. If only one lesson remains in the batch, show `(1/1)`.
5. **Open workbook** — Script viewer opened or user knows how to reopen (`--view`).
6. **Done / next lesson** — Batch complete; offer next session or next topic.

## Focused / PR spine (shorter)

```text
Progress: [x] Setup → [!] Investigate & teach → [ ] Save lesson → [ ] Open workbook → [ ] Done
```

Skip “Pick study plan” when using mini-curriculum only; still show **Write lessons** as one step.

## Rules

- Update the stepper every turn — one line, compact.
- Remaining work must be honest (“2 lessons left in this batch”, not fake totals).
- Internal ledger may still record B0–B6; that stays out of user-facing copy.
- After the **third** saved lesson in a workbook batch, or when the batch is complete with fewer
  than three, move **Open workbook** to `[!]` and run `view-lessons.js --open` (see SKILL.md).

## Example (mid workbook batch)

```text
Progress: [x] Setup → [x] Confirm what matters → [x] Pick study plan → [!] Write lessons (2/3) → [ ] Open workbook → [ ] Done

Next: I’ll draft the third lesson on authentication boundaries, then open the workbook in your browser.
```
