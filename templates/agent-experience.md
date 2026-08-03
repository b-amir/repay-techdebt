# Agent experience — copy system

Chat UX = **tables + emojis**. Minimal words outside tables. Address the reader as **you**. Never use
checkpoint codes (B0–B6, SHORTLIST, RETRIEVEQs) in user-visible text.

## Hard rules

| Do not | Do |
| ------ | -- |
| Stack tables with no blank line | **One blank line between every table** |
| Empty header cells (`\| \|`) | **Every header cell has a short label** |
| Jump into a choice with no context | **One lead line** (≤12 words) before the ask table |
| “I’ll now…”, filler, script narration | Run work; show tables |
| Repeat table content in prose | Delete the words |
| Bullets for progress | Progress table from `session-status.md` |
| Multiple asks | One ask table + `👉 Reply` |

**Routine turn:** progress table · blank line · optional **≤10 words**.  
**Ask turn:** progress · blank line · **lead line** · ask table · blank line · `👉 Reply`.  
**Words outside tables:** ≤10 routine · ≤40 ask (lead + footer count).

## Exact turn shape

```markdown
**Progress**

| Step | {done}/{total} |
| ---- | -------------- |
| ✅ | … |
| 🔵 | **{current}** |
| ⬜ | … |

{optional lead line naming the choice}

| Mark | … |
| ---- | - |
| … | … |

👉 **Reply:** `…`
```

Always include the separator row so every client renders the same.

## Emoji lexicon

| Emoji | Use |
| ----- | --- |
| 🔵 ✅ ⬜ | Progress only |
| ⚡ 🎛️ | Express / Control |
| 📁 📖 🔒 | Paths / privacy |
| 🛠️ | Skill install |
| 👉 | Reply footer |
| ⚠️ | Blocker |
| 🎯 📋 ✍️ 🌐 | Purpose / list / save / workbook |

## Table design (canonical)

| Rule | Value |
| ---- | ----- |
| Blank line between tables | **Required** |
| Empty headers | **Forbidden** — use `Mark`, `Detail`, `Step`, `Mode`, `Reply`, … |
| Columns | 2–3 |
| Rows per table | ≤7 |
| Separator row | Always present |
| Progress header | `Step` \| `{done}/{total}` (fraction in header, not a data row) |
| Progress col 1 data | Emoji only (✅ 🔵 ⬜) |
| Bold | 🔵 row only |
| Lead line | One sentence before a choice/ask table |
| `👉 Reply` | Last line when user must answer |

### Progress (exact)

```markdown
**Progress**

| Step | 3/6 |
| ---- | --- |
| ✅ | Get ready |
| 🔵 | **Write lessons** — 2/3 |
| ⬜ | Open workbook |
```

### Paths (exact)

```markdown
| Mark | Detail |
| ---- | ------ |
| 📖 | Short lessons from your repo → browser workbook |
| 📁 Project | `path/to/project` |
| 📖 Lessons | `path/to/workbook` _(beside Git)_ |
| 🔒 | Repo untouched |
```

### Setup choice — Express / Control (exact)

```markdown
How much setup do you want?

| Mark | Mode | Reply |
| ---- | ---- | ----- |
| ⚡ | Express — accept defaults, one confirm | `express` |
| 🎛️ | Control — pick notes, depth, saves yourself | `control` |

👉 **Reply:** `express` or `control`
```

### Express confirm (exact)

```markdown
These defaults — reply `yes` to start, or switch to `control`.

| Mark | Setting | Value |
| ---- | ------- | ----- |
| ✅ | Notes | Private |
| ✅ | Lessons | Beside repo |
| ✅ | Depth | Balanced |
| ✅ | Saves | Ask each |
| ✅ | Mode | Ask each run |

👉 **Reply:** `yes`
```

✅ in summary tables = included in the default bundle, **not** step done.

## Mid-session asks (exact)

**Purpose**

```markdown
What should this workbook teach, in one sentence?

| Ask | Reply |
| --- | ----- |
| 🎯 Purpose | one sentence? |

👉 **Reply:** your sentence · `skip`
```

**Study list**

```markdown
Keep these topics for the study list?

| # | Topic |
| - | ----- |
| 1 | … |
| 2 | … |

👉 **Reply:** `yes` · or edits
```

**Save lesson**

```markdown
Save this lesson to the workbook?

| Mark | Detail |
| ---- | ------ |
| ✍️ Save | `lessons/…` |
| 📏 | Balanced · checks OK |

👉 **Reply:** `yes` · `no`
```

**Open workbook**

```markdown
Open the workbook in your browser?

| Mark | Detail |
| ---- | ------ |
| 🌐 Workbook | open in browser |

👉 **Reply:** `view`
```

First-run Message 1 lives in `templates/introduction-wizard.md` — paste that block verbatim.

## Agent checklist

- [ ] Progress table first (`| Step | N/M |` header — no empty headers)
- [ ] Separator on every table
- [ ] One blank line between tables
- [ ] One lead line before every choice/ask
- [ ] One 🔵 in progress
- [ ] `👉 Reply` when user must answer
- [ ] No jargon · no script narration
- [ ] ≤10 / ≤40 words outside tables
