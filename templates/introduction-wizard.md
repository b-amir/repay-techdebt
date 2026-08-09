# First-run wizard

Follow `templates/agent-experience.md`. Keep the copy and choice table exact, but select progress
from `templates/session-status.md` using the user's request. Orient first-timers: what this is, Fast
vs Control. **Message 1 = intro + intent-aware progress + Fast vs Control.**

Fast mode = fewer stops later (auto-save, auto-open viewer). Control = pick settings + confirms.

---

## Message 1

Keep blank lines. The example below is for workbook discovery. For a direct lesson request, replace
only the progress table with that scenario and prepend **Get ready**.

```markdown
### What is this?

I turn your repo into **short lessons** you read in a **browser workbook**. Your app source stays untouched.

**Progress**

| Step | 1/5                                |
| ---- | ---------------------------------- |
| 🔵   | **Get ready**                      |
| ⬜   | Reading your code                  |
| ⬜   | Choosing the most valuable lessons |
| ⬜   | Writing lessons                    |
| ⬜   | You're set                         |

### How much setup do you want?

**Fast** uses sensible defaults and auto-saves lessons. **Control** lets you pick every setting.

| Mark | Mode                                       | Reply     |
| ---- | ------------------------------------------ | --------- |
| ⚡   | Fast: defaults + auto-save, fewer stops    | `fast`    |
| 🎛️   | Control: pick notes, depth, saves yourself | `control` |

👉 **Reply:** `fast` or `control`
```

Do **not** paste Control settings tables unless they reply `control`. If they reply `fast` (alias
`express`. Bare `yes` only when clearly choosing Fast), go to Fast flow.

---

## Message 2a: Fast (internal transition)

After `fast` → `init` with flags in Agent notes → mark **Get ready** ✅.
Do not ask for more setup confirmations. Proceed directly to the purpose / study list steps.

---

## Message 2b: Control

```markdown
**Progress**

| Step | 1/6                                |
| ---- | ---------------------------------- |
| 🔵   | **Get ready**                      |
| ⬜   | Reading your code                  |
| ⬜   | Choosing the most valuable lessons |
| ⬜   | Writing lessons                    |
| ⬜   | Open workbook                      |
| ⬜   | You're set                         |

### Pick your settings

Or reply `yes` to use the Default column as-is.

| Topic   | Options                                               | Default    |
| ------- | ----------------------------------------------------- | ---------- |
| Notes   | `private` · `session-only` · `project-local` · `team` | `private`  |
| Lessons | `sister` · `private` · `custom`                       | `sister`   |
| Depth   | `concise` · `balanced` · `deep`                       | `balanced` |
| Saves   | `ask` · `automatic`                                   | `ask`      |
| Mode    | `ask` · `pr` · `workbook`                             | `workbook` |

| Optional | auth, chat, permissions |
| -------- | ----------------------- |

👉 **Reply:** tuple or `yes` for defaults
```

---

## Skill tools (only if runtime install needed)

```markdown
### Skill packages missing

Install **only inside the skill folder**, never into your app.

| Mark              | Detail                       |
| ----------------- | ---------------------------- |
| 🛠️ Skill packages | Install in skill folder only |
| 🔒 Your project   | Not touched                  |

👉 **Reply:** `yes` to install · `skip` · or `yes, install` with setup
```

---

## Agent notes

Fast `init` after user `fast`. Note **`--save-policy automatic`** and **`--mode workbook`**:

```text
node <skill-root>/scripts/project-memory.js init <target-root> \
  --storage private --output-location sister \
  --mode workbook --depth balanced --save-policy automatic --yes
```

Control uses mapped flags. Default save-policy `ask` unless they chose automatic.

Aliases: `express` → `fast`. Prefer teaching `fast` / `control` on Message 1. Accept bare `yes` only
when it clearly means Fast.

No skill symlink paths unless asked.
