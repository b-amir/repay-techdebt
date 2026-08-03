# Agent experience — copy system

Chat UX = **tables + light hierarchy**. Short, not cryptic. Address the reader as **you**. Never use
checkpoint codes (B0–B6, SHORTLIST, RETRIEVEQs) in user-visible text. Never paste script JSON,
argv, or raw CLI dumps into chat.

## Voice (Goldilocks)

| Too short | Right | Too long |
| --------- | ----- | -------- |
| “Study list?” | One heading + why it matters + table | Paragraphs restating the table |
| Dumping paths with no “what is this” | 1–2 sentences that orient a first-timer | Narrating every script you ran |

**Routine turn:** progress · blank line · **≤25 words** of useful status (what finished / what’s next).  
**Ask turn:** progress · blank line · **`###` heading** · **1 short why-line** · ask table · `👉 Reply`.  
**Words outside tables:** ≤25 routine · ≤60 ask (heading + why + footer count).

## Hard rules

| Do not | Do |
| ------ | -- |
| Stack tables with no blank line | **One blank line between every table** |
| Empty header cells | **Every header cell has a short label** |
| Important ask with only a tiny lead | **`###` heading** + one why-line |
| Script JSON / `--open` argv in chat | Silent scripts; show human paths + URL only |
| Ask save / open in **Fast** mode | Auto-save + auto-open viewer |
| “I’ll now…”, filler | Run work; show oriented tables |
| Bullets for progress | Progress table from `session-status.md` |

## Modes

| Mode | Reply | Asks | Saves |
| ---- | ----- | ---- | ----- |
| **Fast** | `fast` | Setup confirm · purpose · study list · wrap | **Automatic** — no save yes/no |
| **Control** | `control` | Full settings + save/open confirms when policy is `ask` | As configured |

Fast still teaches and shows progress — it just **doesn’t stop** for save/open rituals.

## Typography hierarchy

| Level | Use |
| ----- | --- |
| `### Heading` | Every important question the user must understand |
| One why-line | Under the heading — plain English, ≤20 words |
| Tables | Facts, choices, paths |
| `👉 Reply` | Last line when they must answer |

```markdown
### Where should we start?

We map the whole app into a study list, then write **3 lessons** this session so your agent
doesn’t burn a huge token budget. Easy to add more later — you’ll be walked through it.

| Ask | Reply |
| --- | ----- |
| 🎯 Purpose | one sentence? |

👉 **Reply:** your sentence · `skip`
```

## Exact turn shape

```markdown
**Progress**

| Step | {current}/{total} |
| ---- | ----------------- |
| ✅ | … |
| 🔵 | **{current}** |
| ⬜ | … |

### {Question in plain words}

{One why-line for a first-timer.}

| Mark | … |
| ---- | - |
| … | … |

👉 **Reply:** `…`
```

## Emoji lexicon

| Emoji | Use |
| ----- | --- |
| 🔵 ✅ ⬜ | Progress only |
| ⚡ 🎛️ | Fast / Control |
| 📁 📖 🔒 | Paths / privacy |
| 🛠️ | Skill install |
| 👉 | Reply footer |
| ⚠️ | Blocker |
| 🎯 📋 ✍️ 🌐 | Purpose / list / save / workbook |

## Table design

| Rule | Value |
| ---- | ----- |
| Blank line between tables | **Required** |
| Empty headers | **Forbidden** |
| Progress header | `Step` \| `{current}/{total}` (1-based index of 🔵 — never 0, never ✅-count) |
| Progress col 1 data | Emoji only |
| Bold | 🔵 row only |

### Progress (exact)

```markdown
**Progress**

| Step | 4/5 |
| ---- | --- |
| ✅ | Get ready |
| 🔵 | **Write lessons** — 2/3 |
| ⬜ | Wrap up |
```

In **Fast**, skip a separate **Open workbook** step — open the viewer when the batch is ready, then
**Wrap up**.

### Paths (exact)

```markdown
| Mark | Detail |
| ---- | ------ |
| 📖 | Short lessons from your repo → a browser workbook |
| 📁 Project | `path/to/project` |
| 📖 Lessons | `path/to/workbook` _(folder beside your Git repo)_ |
| 🔒 | Your app source is never modified |
```

### Setup choice — Fast / Control (exact)

```markdown
### How much setup do you want?

**Fast** uses sensible defaults and auto-saves lessons. **Control** lets you pick every setting.

| Mark | Mode | Reply |
| ---- | ---- | ----- |
| ⚡ | Fast — defaults + auto-save, fewer stops | `fast` |
| 🎛️ | Control — pick notes, depth, saves yourself | `control` |

👉 **Reply:** `fast` or `control`
```

### Fast confirm (exact)

```markdown
### Start with these defaults?

Notes stay private on this machine. Lessons land in the sister workbook folder beside your repo.
Saves are automatic in Fast — we won’t ask yes/no for each lesson.

| Mark | Setting | Value |
| ---- | ------- | ----- |
| ✅ | Notes | Private (this machine) |
| ✅ | Lessons | Beside repo (`repay-…-techdebt`) |
| ✅ | Depth | Balanced |
| ✅ | Saves | Automatic |
| ✅ | Mode | Workbook |

| Optional | Focus areas, e.g. `auth, chat` in your `yes` |
| -------- | --------------------------------------------- |

👉 **Reply:** `yes`
```

## Mid-session asks

### Purpose (both modes)

```markdown
### What should this workbook teach?

One sentence is enough — e.g. “how Arlo auth and chat fit together.” We’ll turn that into a study
list. You can refine later.

| Ask | Reply |
| --- | ----- |
| 🎯 Purpose | one sentence? |

👉 **Reply:** your sentence · `skip`
```

### Study list (both modes) — explain the “only 3” rule

```markdown
### Keep this study list?

We found many topics. This session we’ll **write 3** of the most important ones so we don’t blow
your AI token budget. The rest stay planned — adding more lessons later is a short, guided step.

| # | Topic (first batch) |
| - | ------------------- |
| 1 | … |
| 2 | … |
| 3 | … |

| Mark | Detail |
| ---- | ------ |
| 📋 Planned later | N more topics on the list |

👉 **Reply:** `yes` · or edits
```

Show at most **5** topic rows in the chat table (the three you’ll write now, plus a “+N more” note).
Don’t dump 70 rows.

### Save lesson — **Control only** (when save-policy is `ask`)

```markdown
### Save this lesson?

| Mark | Detail |
| ---- | ------ |
| ✍️ File | `lessons/…` |
| 📏 | Balanced · checks OK |

👉 **Reply:** `yes` · `no`
```

### Open workbook — **Control only** when you need a confirm

```markdown
### Open the workbook in your browser?

| Mark | Detail |
| ---- | ------ |
| 🌐 Viewer | opens on this machine |

👉 **Reply:** `view`
```

### Fast — after a lesson (no ask)

```markdown
**Progress**

| Step | 4/5 |
| ---- | --- |
| ✅ | Get ready |
| ✅ | What matters |
| ✅ | Study list |
| 🔵 | **Write lessons** — 1/3 |
| ⬜ | Wrap up |

Saved `lessons/….md`. Next lesson next.
```

### Fast — wrap up (auto-opened viewer)

```markdown
**Progress**

| Step | 5/5 |
| ---- | --- |
| ✅ | Get ready |
| ✅ | What matters |
| ✅ | Study list |
| ✅ | Write lessons — 3/3 |
| 🔵 | **Wrap up** |

### You’re set

Lessons are in the sister workbook folder. The browser viewer is open — read there, not in chat.
More topics stay planned; say `/repay-techdebt` anytime to write the next batch (you’ll be walked).

| Mark | Detail |
| ---- | ------ |
| ✍️ Lessons | `…/repay-…-techdebt/lessons/` |
| 🌐 Viewer | `http://127.0.0.1:8765` |
| 📋 Still planned | N topics |
| 🔁 Later | `/repay-techdebt --view` or `--create <id>` |
```

First-run Message 1: `templates/introduction-wizard.md` — paste verbatim.

## Agent checklist

- [ ] Progress first (`| Step | N/M |`)
- [ ] `###` on important questions
- [ ] One why-line for first-timers (where / why 3 / what next)
- [ ] Fast: no save/open asks; auto-save + auto-open
- [ ] No script JSON in chat
- [ ] Study list chat table ≤5 topic rows
- [ ] ≤25 / ≤60 words outside tables
