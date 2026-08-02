# First-run wizard

Follow `templates/agent-experience.md`. **Message 1 = paths + progress + Express/Control only.**

---

## Message 1

| | |
| 📖 | Short lessons from your repo → browser workbook |
| 📁 Project | `<target-root>` |
| 📖 Lessons | `<suggested-workbook>` _(beside Git)_ |
| 🔒 | Repo untouched |

| | Step |
| **0/6** | get ready |
| 🔵 | **Get ready** |
| ⬜ | What matters |
| ⬜ | Study list |
| ⬜ | Write lessons |
| ⬜ | Open workbook |
| ⬜ | Wrap up |

| | Mode | Reply |
| ⚡ | Express — one confirm | `express` |
| 🎛️ | Control — all settings | `control` |

👉 **Reply:** `express` or `control`

Do **not** paste Express summary or Control tables until they pick.

---

## Message 2a — Express

| | Setting | Value |
| ✅ | Notes | Private |
| ✅ | Lessons | Beside repo |
| ✅ | Depth | Balanced |
| ✅ | Saves | Ask each |
| ✅ | Mode | Ask each run |

| Optional | e.g. `auth, chat` in `yes` reply |

👉 **Reply:** `yes`

After `yes` → `init` with flags in Agent notes → mark **Get ready** ✅.

---

## Message 2b — Control

### Control — settings

| Topic | Options | Default |
| Notes | `private` · `session-only` · `project-local` · `team` | `private` |
| Lessons | `sister` · `private` · `custom` | `sister` |
| Depth | `concise` · `balanced` · `deep` | `balanced` |
| Saves | `ask` · `automatic` | `ask` |
| Mode | `ask` · `pr` · `workbook` | `ask` |

| Optional | auth, chat, permissions |

👉 **Reply:** tuple or `yes` for defaults

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
