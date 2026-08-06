# First-run wizard

Follow `templates/agent-experience.md`. Paste **exactly** as shown. Orient first-timers: what this
is, Fast vs Control. **Message 1 = intro + progress + Fast vs Control.**

Fast mode = fewer stops later (auto-save, auto-open viewer). Control = pick settings + confirms.

---

## Message 1

Paste as-is. Keep blank lines.

```markdown
### What is this?

I turn your repo into **short lessons** you read in a **browser workbook**. Your app source stays untouched.

**Progress**

| Step | 1/4                                 |
| ---- | ----------------------------------- |
| 🔵   | **Reading your code**               |
| ⬜   | Picking the 3 most valuable lessons |
| ⬜   | Writing lesson 1/3                  |
| ⬜   | You're set                          |

### How much setup do you want?

**Fast** uses sensible defaults and auto-saves lessons. **Control** lets you pick every setting.

| Mark | Mode                                        | Reply     |
| ---- | ------------------------------------------- | --------- |
| ⚡   | Fast — defaults + auto-save, fewer stops    | `fast`    |
| 🎛️   | Control — pick notes, depth, saves yourself | `control` |

👉 **Reply:** `fast` or `control`
```

Do **not** paste Control settings tables unless they reply `control`. If they reply `fast` (alias
`express`; bare `yes` only when clearly choosing Fast), go to Fast flow.

---

## Message 2a — Fast (internal transition)

After `fast` → `init` with flags in Agent notes → mark **Reading your code** ✅.
Do not ask for more setup confirmations. Proceed directly to the purpose / study list steps.

---

## Message 2b — Control

```markdown
**Progress**

| Step | 1/5                                 |
| ---- | ----------------------------------- |
| 🔵   | **Reading your code**               |
| ⬜   | Picking the 3 most valuable lessons |
| ⬜   | Writing lesson 1/3                  |
| ⬜   | Open workbook                       |
| ⬜   | You're set                          |

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

Install **only inside the skill folder** — not into your app.

| Mark              | Detail                       |
| ----------------- | ---------------------------- |
| 🛠️ Skill packages | Install in skill folder only |
| 🔒 Your project   | Not touched                  |

👉 **Reply:** `yes` to install · `skip` · or `yes, install` with setup
```

---

## Agent notes

Fast `init` after user `fast` — note **`--save-policy automatic`** and **`--mode workbook`**:

```text
node <skill-root>/scripts/project-memory.js init <target-root> \
  --storage private --output-location sister \
  --mode workbook --depth balanced --save-policy automatic --yes
```

Control uses mapped flags; default save-policy `ask` unless they chose automatic.

Aliases: `express` → `fast`. Prefer teaching `fast` / `control` on Message 1; accept bare `yes` only
when it clearly means Fast.

No skill symlink paths unless asked.
