# Session progress (mandatory)

Paste at the **top** of every user-visible turn (after any intro block on first-run Message 1).

**Fraction lives in the header** — second column is `{current}/{total}` where **current is the 1-based
index of the 🔵 step** (not the count of ✅). Start at **1/N**, never 0. **No empty header cells.**

Always include the separator row. Leave **one blank line** before any table that follows.

## Format

```markdown
**Progress**

| Step | {current}/{total}  |
| ---- | ------------------ |
| ✅   | {done step}        |
| 🔵   | **{current step}** |
| ⬜   | {future step}      |
```

- Header col 2 = `{current}/{total}` only — never a step name, never `—`.
- **current** = position of the 🔵 row (1 = first step, N = last).
- Data rows: emoji in col 1 · step in col 2. **Bold only the 🔵 row.**
- Notes after em dash, ≤6 words. Exactly one 🔵. Before = ✅. After = ⬜.

## Emoji

| Emoji | Meaning               |
| ----- | --------------------- |
| 🔵    | Now (one per message) |
| ✅    | Done                  |
| ⬜    | Later                 |

## Fast mode template (4 steps)

```markdown
**Progress**

| Step | 1/4                                 |
| ---- | ----------------------------------- |
| 🔵   | **Reading your code**               |
| ⬜   | Picking the 3 most valuable lessons |
| ⬜   | Writing lesson 1/3                  |
| ⬜   | You're set                          |
```

### ✅ when (Fast)

| Step                                | ✅ when                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| Reading your code                   | Memory OK                                                                          |
| Picking the 3 most valuable lessons | Curriculum approved                                                                |
| Writing lesson 1/3                  | 🔵 while drafting; sub-count e.g. 2/3; **auto-save**; open viewer when batch ready |
| You're set                          | Viewer opened + paths shown                                                        |

| 🔵 step                             | Header |
| ----------------------------------- | ------ |
| Reading your code                   | 1/4    |
| Picking the 3 most valuable lessons | 2/4    |
| Writing lesson 1/3                  | 3/4    |
| You're set                          | 4/4    |

## Control / ask-save template (5 steps)

```markdown
**Progress**

| Step | 1/5                                 |
| ---- | ----------------------------------- |
| 🔵   | **Reading your code**               |
| ⬜   | Picking the 3 most valuable lessons |
| ⬜   | Writing lesson 1/3                  |
| ⬜   | Open workbook                       |
| ⬜   | You're set                          |
```

### ✅ when (Control)

| Step                                | ✅ when                                        |
| ----------------------------------- | ---------------------------------------------- |
| Reading your code                   | Memory OK                                      |
| Picking the 3 most valuable lessons | Curriculum approved                            |
| Writing lesson 1/3                  | 🔵 while drafting; sub-count e.g. 2/3          |
| Open workbook                       | 🔵 → `repay view --open` (or user said `view`) |
| You're set                          | Viewer opened or `--view` given                |

## Focused / PR (Fast-like, 4 steps)

```markdown
**Progress**

| Step | 1/4                   |
| ---- | --------------------- |
| 🔵   | **Reading your code** |
| ⬜   | Investigate & teach   |
| ⬜   | Save lesson           |
| ⬜   | You're set            |
```

If save-policy is automatic, merge Save + Open into teach/wrap like Fast workbook.

## Example — Fast, writing lesson 2/3

```markdown
**Progress**

| Step | 3/4                                 |
| ---- | ----------------------------------- |
| ✅   | Reading your code                   |
| ✅   | Picking the 3 most valuable lessons |
| 🔵   | **Writing lesson 2/3**              |
| ⬜   | You're set                          |
```

## Example — Fast wrap up

```markdown
**Progress**

| Step | 4/4                                 |
| ---- | ----------------------------------- |
| ✅   | Reading your code                   |
| ✅   | Picking the 3 most valuable lessons |
| ✅   | Writing lesson 3/3                  |
| 🔵   | **You're set**                      |
```

Routine: progress + ≤25 useful words. Asks: `###` heading + why-line — see `agent-experience.md`.
