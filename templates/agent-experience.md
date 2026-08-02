# Agent experience — copy system

Chat UX = **tables + emojis**. Minimal words outside tables. Address the reader as **you**. Never use
checkpoint codes (B0–B6, SHORTLIST, RETRIEVEQs) in user-visible text.

## Do not be verbose (hard rule)

**Tables carry the message.** Scripts, reads, and ledger are silent. The user sees tables and
`👉 Reply` when they must answer — not narration.

| Do not | Do |
| ------ | -- |
| “I’ll now…”, “Let me…”, filler | Run work; show tables |
| Prose before or after a table | Next table or `👉 Reply` |
| Headlines when a table row can label it | Put label in table |
| Repeat table content in words | Delete the words |
| Bullets for progress | Progress **table** from `session-status.md` |
| Multiple asks | One ask table + footer |

**Routine turn:** progress table · optional **≤10 words** after · no other prose.  
**Ask turn:** progress table · ask table · `👉 Reply` · **≤40 words** total outside tables.

## Turn layout

1. **Progress table** — `session-status.md`
2. **More tables** — paths, choices, data, asks (prefer tables over sentences)
3. **`👉 Reply`** — last line when user must answer

```markdown
👉 **Reply:** `yes` · `skip`
```

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

## Table rules

| Rule | Limit |
| ---- | ----- |
| Columns | 2–3 max |
| Rows per table | 7 max |
| Row 1 of progress | `{done}/{total}` · current step name |
| Bold | 🔵 row only in progress |
| Headers | Short — `Step`, `Reply`, or emoji label |
| Empty col 1 header | `·` or blank — never a wordy title |

### Progress table

```markdown
| | Step |
| **4/5** | wrap up |
| ✅ | Get ready |
| 🔵 | **Wrap up** |
```

### Paths (2 col)

| 📁 Project | `path` |

### Choice (3 col)

| | Mode | Reply |
| ⚡ | Express — one confirm | `express` |

### Ask (2 col — label in col 1)

| 🎯 Purpose | one sentence? |

### Summary (Express confirm)

| | Setting | Value |
| ✅ | Notes | Private |

✅ in summary tables = included in bundle, not step done.

## Mid-session ask tables

**Purpose**

| 🎯 Purpose | one sentence? |
👉 **Reply:** your sentence · `skip`

**Study list**

| 📋 Topics | keep? |
| 1 | … |
| 2 | … |
👉 **Reply:** `yes` · or edits

**Save lesson**

| ✍️ Save | `lessons/…` |
| 📏 | Balanced · checks OK |
👉 **Reply:** `yes` · `no`

**Open workbook**

| 🌐 Workbook | open in browser |
👉 **Reply:** `view`

## Length

| | |
| Tables per message | 2–4 OK when each is small |
| Words outside tables | ≤10 routine · ≤40 ask |
| Hook sentences | 0 on routine; 0–1 on ask |

## Agent checklist

- [ ] Progress table first (markdown, not code block)
- [ ] One 🔵 in progress table
- [ ] Prefer tables over prose
- [ ] `👉 Reply` when user must answer
- [ ] No jargon · no script narration
- [ ] ≤10 / ≤40 words outside tables
