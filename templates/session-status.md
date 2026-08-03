# Session progress (mandatory)

Paste at the **top** of every user-visible turn (after any paths block on first-run).

**Fraction lives in the header** — second column header is `{done}/{total}` (count of ✅ rows only,
not the 🔵 step). **No empty header cells.** Col 1 header is always `Step`; data rows are emoji | name.

Always include the separator row. Leave **one blank line** before any table that follows.

## Format

```markdown
**Progress**

| Step | {done}/{total} |
| ---- | -------------- |
| ✅ | {done step} |
| 🔵 | **{current step}** |
| ⬜ | {future step} |
```

- Header col 2 = fraction only — never a step name, never `—`.
- Data rows: emoji in col 1 · step in col 2. **Bold only the 🔵 row.**
- Notes after em dash, ≤6 words. Exactly one 🔵. Before = ✅. After = ⬜.
- Optional `**Progress**` label above the table is fine; choice tables still get one lead line.

## Emoji

| Emoji | Meaning |
| ----- | ------- |
| 🔵 | Now (one per message) |
| ✅ | Done |
| ⬜ | Later |

## Workbook template

```markdown
**Progress**

| Step | 0/6 |
| ---- | --- |
| 🔵 | **Get ready** |
| ⬜ | What matters |
| ⬜ | Study list |
| ⬜ | Write lessons |
| ⬜ | Open workbook |
| ⬜ | Wrap up |
```

### ✅ when

| Step | ✅ when |
| ---- | ------- |
| Get ready | Memory OK |
| What matters | Purpose recorded or skipped |
| Study list | Curriculum approved |
| Write lessons | 🔵 while drafting; sub-count e.g. 2/3 in notes |
| Open workbook | 🔵 → `view-lessons.js --open` |
| Wrap up | Viewer opened or `--view` given |

## Focused / PR template

```markdown
**Progress**

| Step | 0/5 |
| ---- | --- |
| 🔵 | **Get ready** |
| ⬜ | Investigate & teach |
| ⬜ | Save lesson |
| ⬜ | Open workbook |
| ⬜ | Wrap up |
```

## Example — workbook lesson 2/3

```markdown
**Progress**

| Step | 3/6 |
| ---- | --- |
| ✅ | Get ready |
| ✅ | What matters — chat |
| ✅ | Study list — 12 topics |
| 🔵 | **Write lessons** — 2/3 |
| ⬜ | Open workbook |
| ⬜ | Wrap up |
```

## Example — opening workbook (4 done, on step 5)

```markdown
**Progress**

| Step | 4/6 |
| ---- | --- |
| ✅ | Get ready |
| ✅ | What matters |
| ✅ | Study list |
| ✅ | Write lessons |
| 🔵 | **Open workbook** |
| ⬜ | Wrap up |
```

## Example — focused wrap up

```markdown
**Progress**

| Step | 4/5 |
| ---- | --- |
| ✅ | Get ready |
| ✅ | Investigate & teach — Auth Layout |
| ✅ | Save lesson |
| ✅ | Open workbook |
| 🔵 | **Wrap up** |
```

Routine turn: progress table only, or + **≤10 words** after.

See `templates/agent-experience.md` for ask tables, lead lines, and reply footers.
