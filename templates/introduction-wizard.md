# First-run wizard

Follow `templates/agent-experience.md`. Paste **exactly** as shown — blank line between every table,
one lead line before each choice. **No empty table headers.** Message 1 = paths + progress + setup
choice only.

---

## Message 1

Paste this block as-is (swap the two paths). Keep the blank lines.

```markdown
| Mark | Detail |
| ---- | ------ |
| 📖 | Short lessons from your repo → browser workbook |
| 📁 Project | `<target-root>` |
| 📖 Lessons | `<suggested-workbook>` _(beside Git)_ |
| 🔒 | Repo untouched |

**Progress**

| Step | 1/6 |
| ---- | --- |
| 🔵 | **Get ready** |
| ⬜ | What matters |
| ⬜ | Study list |
| ⬜ | Write lessons |
| ⬜ | Open workbook |
| ⬜ | Wrap up |

How much setup do you want?

| Mark | Mode | Reply |
| ---- | ---- | ----- |
| ⚡ | Express — accept defaults, one confirm | `express` |
| 🎛️ | Control — pick notes, depth, saves yourself | `control` |

👉 **Reply:** `express` or `control`
```

Do **not** paste Express summary or Control tables until they pick.

---

## Message 2a — Express

```markdown
**Progress**

| Step | 0/6 |
| ---- | --- |
| 🔵 | **Get ready** |
| ⬜ | What matters |
| ⬜ | Study list |
| ⬜ | Write lessons |
| ⬜ | Open workbook |
| ⬜ | Wrap up |

These defaults — reply `yes` to start, or switch to `control`.

| Mark | Setting | Value |
| ---- | ------- | ----- |
| ✅ | Notes | Private |
| ✅ | Lessons | Beside repo |
| ✅ | Depth | Balanced |
| ✅ | Saves | Ask each |
| ✅ | Mode | Ask each run |

| Optional | e.g. `auth, chat` in `yes` reply |
| -------- | -------------------------------- |

👉 **Reply:** `yes`
```

After `yes` → `init` with flags in Agent notes → mark **Get ready** ✅.

---

## Message 2b — Control

```markdown
**Progress**

| Step | 0/6 |
| ---- | --- |
| 🔵 | **Get ready** |
| ⬜ | What matters |
| ⬜ | Study list |
| ⬜ | Write lessons |
| ⬜ | Open workbook |
| ⬜ | Wrap up |

Pick each setting (or `yes` for the defaults column).

| Topic | Options | Default |
| ----- | ------- | ------- |
| Notes | `private` · `session-only` · `project-local` · `team` | `private` |
| Lessons | `sister` · `private` · `custom` | `sister` |
| Depth | `concise` · `balanced` · `deep` | `balanced` |
| Saves | `ask` · `automatic` | `ask` |
| Mode | `ask` · `pr` · `workbook` | `ask` |

| Optional | auth, chat, permissions |
| -------- | ----------------------- |

👉 **Reply:** tuple or `yes` for defaults
```

---

## Skill tools (only if `check-runtime` fails)

```markdown
Skill packages are missing — install inside the skill folder only?

| Mark | Detail |
| ---- | ------ |
| 🛠️ **Skill packages** | Install inside skill folder only |
| 🔒 **Your project** | Not touched |

👉 **Reply:** `yes` to install · `skip` to continue · combine with setup: `yes, install`
```

---

## After setup ✅ (paste once, after init)

```markdown
| Next | You do |
| ---- | ------ |
| 📋 Study list | Approve topics |
| ✍️ Lessons | 1–3 per session |
| 🌐 Workbook | Read in browser |
```

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
