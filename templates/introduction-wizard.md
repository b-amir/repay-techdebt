# First-run wizard

Follow `templates/agent-experience.md`. **Message 1 = paths + progress + Express/Control only.**

---

## Message 1

Your code → **short lessons** → **browser workbook**. I read the repo; I don’t change your app.

| 📁 **Project** | `<target-root>` |
| 📖 **Lessons** | `<suggested-workbook>` _(beside Git)_ |
| 🔒 **Your repo** | Untouched — notes live on your machine |

| | Step |
| 🔵 | **Get ready** — pick setup style |
| ⬜ | **What matters** |
| ⬜ | **Study list** |
| ⬜ | **Write lessons** |
| ⬜ | **Open workbook** |
| ⬜ | **Wrap up** |

### Setup

| | Mode | Reply |
| ⚡ | **Express** — recommended defaults, one confirm | `express` |
| 🎛️ | **Control** — choose every setting | `control` |

👉 **Reply:** `express` or `control`

Do **not** paste Express summary or Control tables until they pick.

---

## Message 2a — Express

### Express — confirm & start

| | Setting | Value |
| ✅ | Notes | Private on your machine |
| ✅ | Lessons | Beside repo (path above) |
| ✅ | Depth | Balanced |
| ✅ | Saves | Ask before each lesson |
| ✅ | Mode | Ask each run (workbook / PR / focused) |

Optional: priority areas — e.g. `auth, chat` in your `yes` reply.

👉 **Reply:** `yes` to save settings and start

After `yes` → `init` with flags in Agent notes → mark **Get ready** ✅.

---

## Message 2b — Control

### Control — your settings

| Topic | Pick one | Default |
| ----- | -------- | ------- |
| Notes | `private` · `session-only` · `project-local` · `team` | `private` |
| Lessons | `sister` · `private` · `custom` | `sister` |
| Depth | `concise` · `balanced` · `deep` | `balanced` |
| Saves | `ask` · `automatic` | `ask` |
| Mode | `ask` · `pr` · `workbook` | `ask` |

| Optional | Example |
| -------- | ------- |
| Priority areas | auth, chat, permissions |

👉 **Reply:** e.g. `private, sister, balanced, ask, workbook` or `yes` for all defaults

---

## Skill tools (only if `check-runtime` fails)

| 🛠️ **Skill packages** | Install inside skill folder only |
| 🔒 **Your frontend** | Not touched |

👉 **Reply:** `yes` to install · `skip` to continue · combine with setup: `yes, install`

---

## After setup ✅ (paste once, after init)

| Next | You do |
| ---- | ------ |
| 📋 Study list | Approve topics |
| ✍️ Lessons | 1–3 per session |
| 🌐 Workbook | Read in browser |

---

## Agent notes

Express `init` after user `yes`:

```text
node <skill-root>/scripts/project-memory.js init <target-root> \
  --storage private --output-location sister \
  --mode ask --depth balanced --save-policy ask --yes
```

Use `--mode workbook` / `pr` / `focused` if user already stated intent.

If user says `yes` without picking a mode → Express summary first, then init.

No skill symlink paths unless asked.
