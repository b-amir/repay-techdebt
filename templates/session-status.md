# Session progress table (mandatory)

Paste at the **top** of every user-visible turn. **Markdown table** — never a code block, never bullets.

## Format

```markdown
| | Step |
| **{done}/{total}** | — |
| ✅ | {done step} |
| 🔵 | **{current step}** |
| ⬜ | {future step} |
```

- **Row 1:** `{done}/{total}` only — count of **✅ rows**, not the 🔵 step. Col 2 is `—` (never repeat the current step name).
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
| **0/6** | — |
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
| Write lessons | 🔵 while drafting; sub-count e.g. 2/3 in notes |
| Open workbook | 🔵 → `view-lessons.js --open` |
| Wrap up | Viewer opened or `--view` given |

## Focused / PR template

| | Step |
| **0/5** | — |
| 🔵 | **Get ready** |
| ⬜ | Investigate & teach |
| ⬜ | Save lesson |
| ⬜ | Open workbook |
| ⬜ | Wrap up |

## Example — workbook lesson 2/3

| | Step |
| **3/6** | — |
| ✅ | Get ready |
| ✅ | What matters — chat |
| ✅ | Study list — 12 topics |
| 🔵 | **Write lessons** — 2/3 |
| ⬜ | Open workbook |
| ⬜ | Wrap up |

## Example — opening workbook (4 done, on step 5)

| | Step |
| **4/6** | — |
| ✅ | Get ready |
| ✅ | What matters |
| ✅ | Study list |
| ✅ | Write lessons |
| 🔵 | **Open workbook** |
| ⬜ | Wrap up |

## Example — focused wrap up

| | Step |
| **4/5** | — |
| ✅ | Get ready |
| ✅ | Investigate & teach — Auth Layout |
| ✅ | Save lesson |
| ✅ | Open workbook |
| 🔵 | **Wrap up** |

Routine turn: table only, or table + **≤10 words** after. No prose before the table.

See `templates/agent-experience.md` for ask tables and reply footers.
