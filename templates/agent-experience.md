# Agent experience: copy system

Chat UX = **tables + light hierarchy**. Short, not cryptic. Address the reader as **you**. Never use
checkpoint codes (B0–B6, SHORTLIST, RETRIEVEQs) in user-visible text. Never paste script JSON,
argv, or raw CLI dumps into chat.

## Voice (Goldilocks)

| Too short                            | Right                                   | Too long                       |
| ------------------------------------ | --------------------------------------- | ------------------------------ |
| “Study list?”                        | One heading + why it matters + table    | Paragraphs restating the table |
| Dumping paths with no “what is this” | 1–2 sentences that orient a first-timer | Narrating every script you ran |

**Routine turn:** progress · blank line · **≤25 words** of useful status (what finished / what’s next).  
**Ask turn:** progress · blank line · **`###` heading** · **1 short why-line** · ask table · `👉 Reply`.  
**Words outside tables:** ≤25 routine · ≤60 ask (heading + why + footer count).

## Hard rules

| Do not                              | Do                                                 |
| ----------------------------------- | -------------------------------------------------- |
| Stack tables with no blank line     | **One blank line between every table**             |
| Empty header cells                  | **Every header cell has a short label**            |
| Important ask with only a tiny lead | **`###` heading** + one why-line                   |
| Script JSON / `--open` argv in chat | Silent scripts. Show human paths + URL only        |
| Ask save / open in **Fast** mode    | Auto-save + auto-open viewer                       |
| “I’ll now…”, filler                 | Run work. Show oriented tables                     |
| Bullets for progress                | Progress table from `session-status.md`            |
| “Continue weaker?” / soft half-save | Unsupported → shrink scope or refuse               |
| Tool jargon / ask-every-fallback    | Silent bundled fallback. Ask only install          |
| Pause for orphan/index repair       | Self-heal silently. Keep the requested step active |

Routine lesson creation, recreation, updates, deletion, and batches stay user-intent-first. Do not
show `Paused`, index state, orphan terminology, repair commands, or maintenance progress for a
recoverable derived-index issue. Repair it, rerun the check once, and continue the same request.

## Modes

| Mode        | Reply     | Asks                                                     | Saves                         |
| ----------- | --------- | -------------------------------------------------------- | ----------------------------- |
| **Fast**    | `fast`    | Auto-purpose · inline review · auto-save · ask to refine | **Automatic**. No save prompt |
| **Control** | `control` | Full settings + save/open confirms when policy is `ask`  | As configured                 |

Fast teaches and shows progress without stopping for setup or save/open rituals.

## Typography hierarchy

| Level         | Use                                               |
| ------------- | ------------------------------------------------- |
| `### Heading` | Every important question the user must understand |
| One why-line  | Under the heading in plain English, ≤20 words     |
| Tables        | Facts, choices, paths                             |
| `👉 Reply`    | Last line when they must answer                   |

## Exact turn shape

```markdown
**Progress**

| Step | {current}/{total} |
| ---- | ----------------- |
| ✅   | …                 |
| 🔵   | **{current}**     |
| ⬜   | …                 |

### {Question in plain words}

{One why-line for a first-timer.}

| Mark | …   |
| ---- | --- |
| …    | …   |

👉 **Reply:** `…`
```

## Emoji lexicon

| Emoji       | Use                              |
| ----------- | -------------------------------- |
| 🔵 ✅ ⬜    | Progress only                    |
| ⚡ 🎛️       | Fast / Control                   |
| 📁 📖 🔒    | Paths / privacy                  |
| 🛠️          | Skill install                    |
| 👉          | Reply footer                     |
| ⚠️          | Blocker                          |
| 🎯 📋 ✍️ 🌐 | Purpose / list / save / workbook |

## Table design

| Rule                      | Value                                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| Blank line between tables | **Required**                                                             |
| Empty headers             | **Forbidden**                                                            |
| Progress header           | `Step` \| `{current}/{total}` (1-based index of 🔵, never 0 or ✅-count) |
| Progress col 1 data       | Emoji only                                                               |
| Bold                      | 🔵 row only                                                              |

### Progress (exact)

```markdown
**Progress**

| Step | 3/4                              |
| ---- | -------------------------------- |
| ✅   | Reading your code                |
| ✅   | Picking the {N} selected lessons |
| 🔵   | **Writing lesson {i}/{N}**       |
| ⬜   | You're set                       |
```

In **Fast**, skip a separate **Open workbook** step. Open the viewer when the first lesson is ready.
Use this workbook-batch shape only after `N` is known. Direct lesson actions use the matching
scenario in `session-status.md` and omit selection entirely.

### Paths (exact)

```markdown
| Mark       | Detail                                             |
| ---------- | -------------------------------------------------- |
| 📖         | Short lessons from your repo → a browser workbook  |
| 📁 Project | `path/to/project`                                  |
| 📖 Lessons | `path/to/workbook` _(folder beside your Git repo)_ |
| 🔒         | Your app source is never modified                  |
```

### Setup choice: Control (exact)

```markdown
### How much setup do you want?

**Fast** uses sensible defaults and auto-saves lessons. **Control** lets you pick every setting.

| Mark | Mode                                       | Reply     |
| ---- | ------------------------------------------ | --------- |
| ⚡   | Fast: defaults + auto-save, fewer stops    | `fast`    |
| 🎛️   | Control: pick notes, depth, saves yourself | `control` |

👉 **Reply:** `fast` or `control`
```

## Mid-session asks

### Fast Mode Execution (Turn 2)

In Fast mode, Turn 2 operates continuously without stopping:

1. **Auto-derive purpose**: Use the project profile (top workflow + top 2 trust/data signals) to define the purpose silently.
2. **Shortlist**: Select the most central `orient`-stage topic as lesson 1.
3. **Draft & Mechanical**: Draft lesson 1 and run mechanical checks.
4. **Inline Review**: Review semantic support inline. Record `self` provenance when the authoring
   agent performs it. Its score is advisory. If required fixes remain, revise once before save.
5. **Auto-save & Auto-open**: Save the lesson, then immediately open the viewer for the user.

### Refinement / Purpose Ask (Fast Turn 3 / Control Turn 2)

```markdown
**Progress**

| Step | 2/4                                    |
| ---- | -------------------------------------- |
| ✅   | Reading your code                      |
| 🔵   | **Choosing the most valuable lessons** |
| ⬜   | Writing lessons                        |
| ⬜   | You're set                             |

### Was that the right starting point?

Here are some other angles to focus the rest of the study list on. You can pick one or suggest your own. (Optionally, let me know your familiarity with this code so I can adjust depth).

| Ask            | Reply                                  |
| -------------- | -------------------------------------- |
| 🎯 Angle 1     | {Agent sentence 1}                     |
| 🎯 Angle 2     | {Agent sentence 2}                     |
| 🎯 Angle 3     | {Agent sentence 3}                     |
| 🧠 Familiarity | `new` · `dabbled` · `owner` (optional) |

👉 **Reply:** `1`, `2`, `3`, your sentence, or `skip` (and optionally your familiarity)
```

### Study list (Control mode / Refined Fast)

```markdown
### Keep this study list?

In learning-path mode, we found more topics and will write **{N}** now so the session stays focused.
`N` must equal the actual current batch size. Show the real pending count. In batch-only mode, say:
“This workbook will contain exactly the {N} lessons you requested.” Never show a planned-later row
with zero pending topics.

| #   | Topic (first batch) |
| --- | ------------------- |
| 1   | …                   |
| 2   | …                   |
| 3   | …                   |

{If learning-path mode has pending topics:}

| Mark             | Detail                    |
| ---------------- | ------------------------- |
| 📋 Planned later | N more topics on the list |

👉 **Reply:** `yes` · or edits
```

### Save lesson: **Control only** (when save-policy is `ask`)

```markdown
### Save this lesson?

| Mark       | Detail               |
| ---------- | -------------------- |
| ✍️ File    | `lessons/…`          |
| ⚖️ Quality | Balanced · checks OK |

👉 **Reply:** `yes` · `no`
```

### Open workbook: **Control only** when you need a confirm

```markdown
### Open the workbook in your browser?

| Mark      | Detail                |
| --------- | --------------------- |
| 🌐 Viewer | opens on this machine |

👉 **Reply:** `view`
```

### Fast after a lesson (no ask)

```markdown
**Progress**

| Step | 3/4                              |
| ---- | -------------------------------- |
| ✅   | Reading your code                |
| ✅   | Picking the {N} selected lessons |
| 🔵   | **Writing lesson {i}/{N}**       |
| ⬜   | You're set                       |

Saved `lessons/….md`. Next lesson next.
```

### Fast wrap up (auto-opened viewer)

```markdown
**Progress**

| Step | 4/4                              |
| ---- | -------------------------------- |
| ✅   | Reading your code                |
| ✅   | Picking the {N} selected lessons |
| ✅   | Writing lesson {N}/{N}           |
| 🔵   | **You're set**                   |

### You’re set

Lessons are in the sister workbook folder. The browser viewer is open. Read there, not in chat.
{If pending topics exist: More topics stay planned; say `/repay-techdebt` to write the next batch.}
{If batch-only: This workbook contains exactly the requested lesson batch.}

| Mark             | Detail                                      |
| ---------------- | ------------------------------------------- |
| ✍️ Lessons       | `…/repay-…-techdebt/lessons/`               |
| 🌐 Viewer        | `http://127.0.0.1:8765`                     |
| 📋 Still planned | N topics _(omit when zero/batch-only)_      |
| 🔁 Later         | `/repay-techdebt --view` or `--create <id>` |
```

First-run Message 1: paste `templates/introduction-wizard.md` verbatim.

## Agent checklist

- [ ] Progress first (`| Step | N/M |`)
- [ ] `###` on important questions
- [ ] Progress scenario matches the current user request
- [ ] Every displayed lesson count comes from the request or current batch
- [ ] One why-line for first-timers (where / why this count / what next)
- [ ] Fast: no save/open asks. Auto-save + auto-open
- [ ] No script JSON in chat
- [ ] Study list chat table ≤5 topic rows
- [ ] ≤25 / ≤60 words outside tables
