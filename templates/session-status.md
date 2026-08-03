# Session progress (mandatory)

Paste at the **top** of every user-visible turn (after any intro block on first-run Message 1).

**Fraction lives in the header** — second column is `{current}/{total}` where **current is the 1-based
index of the 🔵 step** (not the count of ✅). Start at **1/N**, never 0. **No empty header cells.**

Always include the separator row. Leave **one blank line** before any table that follows.

## Format

```markdown
**Progress**

| Step | {current}/{total} |
| ---- | ----------------- |
| ✅ | {done step} |
| 🔵 | **{current step}** |
| ⬜ | {future step} |
```

- Header col 2 = `{current}/{total}` only — never a step name, never `—`.
- **current** = position of the 🔵 row (1 = first step, N = last).
- Data rows: emoji in col 1 · step in col 2. **Bold only the 🔵 row.**
- Notes after em dash, ≤6 words. Exactly one 🔵. Before = ✅. After = ⬜.

## Emoji

| Emoji | Meaning |
| ----- | ------- |
| 🔵 | Now (one per message) |
| ✅ | Done |
| ⬜ | Later |

## Fast mode template (5 steps — no separate Open workbook ask)

```markdown
**Progress**

| Step | 1/5 |
| ---- | --- |
| 🔵 | **Get ready** |
| ⬜ | What matters |
| ⬜ | Study list |
| ⬜ | Write lessons |
| ⬜ | Wrap up |
```

### ✅ when (Fast)

| Step | ✅ when |
| ---- | ------- |
| Get ready | Memory OK |
| What matters | Purpose recorded or skipped |
| Study list | Curriculum approved |
| Write lessons | 🔵 while drafting; sub-count e.g. 2/3; **auto-save**; open viewer when batch ready |
| Wrap up | Viewer opened + paths shown |

| 🔵 step | Header |
| ------- | ------ |
| Get ready | 1/5 |
| What matters | 2/5 |
| Study list | 3/5 |
| Write lessons | 4/5 |
| Wrap up | 5/5 |

## Control / ask-save template (6 steps)

```markdown
**Progress**

| Step | 1/6 |
| ---- | --- |
| 🔵 | **Get ready** |
| ⬜ | What matters |
| ⬜ | Study list |
| ⬜ | Write lessons |
| ⬜ | Open workbook |
| ⬜ | Wrap up |
```

### ✅ when (Control)

| Step | ✅ when |
| ---- | ------- |
| Get ready | Memory OK |
| What matters | Purpose recorded or skipped |
| Study list | Curriculum approved |
| Write lessons | 🔵 while drafting; sub-count e.g. 2/3 |
| Open workbook | 🔵 → `view-lessons.js --open` (or user said `view`) |
| Wrap up | Viewer opened or `--view` given |

## Focused / PR (Fast-like, 5 steps)

```markdown
**Progress**

| Step | 1/5 |
| ---- | --- |
| 🔵 | **Get ready** |
| ⬜ | Investigate & teach |
| ⬜ | Save lesson |
| ⬜ | Open workbook |
| ⬜ | Wrap up |
```

If save-policy is automatic, merge Save + Open into teach/wrap like Fast workbook.

## Example — Fast, writing lesson 2/3

```markdown
**Progress**

| Step | 4/5 |
| ---- | --- |
| ✅ | Get ready |
| ✅ | What matters — chat |
| ✅ | Study list — 12 topics |
| 🔵 | **Write lessons** — 2/3 |
| ⬜ | Wrap up |
```

## Example — Fast wrap up

```markdown
**Progress**

| Step | 5/5 |
| ---- | --- |
| ✅ | Get ready |
| ✅ | What matters |
| ✅ | Study list |
| ✅ | Write lessons — 3/3 |
| 🔵 | **Wrap up** |
```

Routine: progress + ≤25 useful words. Asks: `###` heading + why-line — see `agent-experience.md`.
