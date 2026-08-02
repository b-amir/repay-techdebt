# Session progress table (mandatory)

Paste at the **top** of every user-visible turn. **Markdown table** — never a code block, never bullets.

## Format

```markdown
| | Step |
| **{done}/{total}** | {current step name} |
| ✅ | {done step} |
| 🔵 | **{current step}** |
| ⬜ | {future step} |
```

- **Row 1:** fraction in col 1 · plain current step name in col 2 (no emoji on row 1).
- **Rows 2+:** emoji in col 1 · step in col 2. **Bold only the 🔵 row.**
- Notes after em dash, ≤6 words. Exactly one 🔵. Before = ✅. After = ⬜.
- **No headline above the table.** The table is the progress UI.

## Emoji

| Emoji | Meaning |
| ----- | ------- |
| 🔵 | Now (one per message) |
| ✅ | Done |
| ⬜ | Later |

## Workbook template

| | Step |
| **0/6** | get ready |
| 🔵 | **Get ready** |
| ⬜ | What matters |
| ⬜ | Study list |
| ⬜ | Write lessons |
| ⬜ | Open workbook |
| ⬜ | Wrap up |

### ✅ when

| Step | ✅ when |
| ---- | ------- |
| Get ready | Memory OK |
| What matters | Purpose recorded or skipped |
| Study list | Curriculum approved |
| Write lessons | 🔵 while drafting; count e.g. 2/3 |
| Open workbook | 🔵 → `view-lessons.js --open` |
| Wrap up | Viewer opened or `--view` given |

## Focused / PR template

| | Step |
| **0/5** | get ready |
| 🔵 | **Get ready** |
| ⬜ | Investigate & teach |
| ⬜ | Save lesson |
| ⬜ | Open workbook |
| ⬜ | Wrap up |

## Example — workbook lesson 2/3

| | Step |
| **3/6** | write lessons |
| ✅ | Get ready |
| ✅ | What matters — chat |
| ✅ | Study list — 12 topics |
| 🔵 | **Write lessons** — 2/3 |
| ⬜ | Open workbook |
| ⬜ | Wrap up |

## Example — focused wrap up

| | Step |
| **4/5** | wrap up |
| ✅ | Get ready |
| ✅ | Investigate & teach — Auth Layout |
| ✅ | Save lesson |
| ✅ | Open workbook |
| 🔵 | **Wrap up** |

Routine turn: table only, or table + **≤10 words** after. No prose before the table.

See `templates/agent-experience.md` for ask tables and reply footers.
