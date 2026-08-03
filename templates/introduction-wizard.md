# First-run wizard

Follow `templates/agent-experience.md`. Paste **exactly** as shown. Orient first-timers: what this
is, where files go, Fast vs Control. **Message 1 = intro + paths + progress + setup choice.**

Fast mode = fewer stops later (auto-save, auto-open viewer). Control = pick settings + confirms.

---

## Message 1

Paste as-is (swap the two paths). Keep blank lines.

```markdown
### What is this?

I turn your repo into **short lessons** you read in a **browser workbook**. Your app source stays
untouched. Lessons live in a folder beside the repo.

| Mark | Detail |
| ---- | ------ |
| 📁 Project | `<target-root>` |
| 📖 Lessons | `<suggested-workbook>` _(beside Git)_ |
| 🔒 | Repo source never modified |

**Progress**

| Step | 1/5 |
| ---- | --- |
| 🔵 | **Get ready** |
| ⬜ | What matters |
| ⬜ | Study list |
| ⬜ | Write lessons |
| ⬜ | Wrap up |

### How much setup do you want?

**Fast** uses defaults and auto-saves (fewer questions). **Control** lets you pick every setting.

| Mark | Mode | Reply |
| ---- | ---- | ----- |
| ⚡ | Fast — defaults + auto-save | `fast` |
| 🎛️ | Control — choose each setting | `control` |

👉 **Reply:** `fast` or `control`
```

Do **not** paste Fast summary or Control tables until they pick.

---

## Message 2a — Fast

```markdown
**Progress**

| Step | 1/5 |
| ---- | --- |
| 🔵 | **Get ready** |
| ⬜ | What matters |
| ⬜ | Study list |
| ⬜ | Write lessons |
| ⬜ | Wrap up |

### Start with these defaults?

Private notes on this machine. Lessons in the sister folder beside your repo. **Saves are
automatic** — we won’t ask yes/no for each lesson. We’ll write **3 lessons** first (token-friendly);
more later is easy and guided.

| Mark | Setting | Value |
| ---- | ------- | ----- |
| ✅ | Notes | Private (this machine) |
| ✅ | Lessons | Beside repo |
| ✅ | Depth | Balanced |
| ✅ | Saves | Automatic |
| ✅ | Mode | Workbook |

| Optional | Focus areas, e.g. `auth, chat` with your `yes` |
| -------- | ----------------------------------------------- |

👉 **Reply:** `yes`
```

After `yes` → `init` with flags in Agent notes → mark **Get ready** ✅.

---

## Message 2b — Control

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

### Pick your settings

Or reply `yes` to use the Default column as-is.

| Topic | Options | Default |
| ----- | ------- | ------- |
| Notes | `private` · `session-only` · `project-local` · `team` | `private` |
| Lessons | `sister` · `private` · `custom` | `sister` |
| Depth | `concise` · `balanced` · `deep` | `balanced` |
| Saves | `ask` · `automatic` | `ask` |
| Mode | `ask` · `pr` · `workbook` | `workbook` |

| Optional | auth, chat, permissions |
| -------- | ----------------------- |

👉 **Reply:** tuple or `yes` for defaults
```

---

## Skill tools (only if runtime install needed)

```markdown
### Skill packages missing

Install **only inside the skill folder** — not into your app.

| Mark | Detail |
| ---- | ------ |
| 🛠️ Skill packages | Install in skill folder only |
| 🔒 Your project | Not touched |

👉 **Reply:** `yes` to install · `skip` · or `yes, install` with setup
```

---

## After setup ✅ (paste once, after init) — Fast

```markdown
**Progress**

| Step | 2/5 |
| ---- | --- |
| ✅ | Get ready |
| 🔵 | **What matters** |
| ⬜ | Study list |
| ⬜ | Write lessons |
| ⬜ | Wrap up |

### Next

We’ll confirm what to teach, build a study list, then write **3 lessons** and open the workbook
viewer for you.

| Mark | You do |
| ---- | ------ |
| 🎯 Purpose | One sentence |
| 📋 Study list | Keep or edit |
| ✍️ Lessons | We write + auto-save |
| 🌐 Workbook | Opens in browser when ready |
```

---

## Agent notes

Fast `init` after user `yes` — note **`--save-policy automatic`** and **`--mode workbook`**:

```text
node <skill-root>/scripts/project-memory.js init <target-root> \
  --storage private --output-location sister \
  --mode workbook --depth balanced --save-policy automatic --yes
```

Control uses mapped flags; default save-policy `ask` unless they chose automatic.

If user says `yes` without picking a mode → Fast summary first, then init.

Aliases: treat `express` as `fast` if someone types the old name.

No skill symlink paths unless asked.
