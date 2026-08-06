# Security model

Repay Tech Debt is an analysis/teaching skill. It reads a target repository, writes
skill-owned memory/workbook artifacts, and may install **its own** dependencies under
`<skill-root>`. It must not install into the target app or run opaque remote code as
the default path.

## Trust boundaries

| Boundary                        | Policy                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target application repo         | Read-only analysis by default. Writes only under consented workbook / `.repay-techdebt/` / private store.                                        |
| Skill root (`SKILL.md` package) | May run `pnpm install` here when `node_modules` is missing.                                                                                      |
| User home                       | Optional PATH shim for `repay` CLI — **opt-in only**.                                                                                            |
| Network                         | Bundled dep install (skill lockfile); optional user-consented analyzer installs (`uv tool …`); pinned `npx skills@…` for CLI `init`/`plan` only. |
| Browser viewer                  | Loopback `127.0.0.1` only; Markdown rendered with `html:false`; path sandbox on lesson files.                                                    |

## Surfaces store scanners flag — and mitigations

### 1. Bundled dependency install (`runtime-install.js`)

**Intent:** first run after skill sync can install packages listed in this skill’s
`package.json` so scripts work offline of the target app.

**Mitigations:**

- Scope: `<skill-root>` only — never the target.
- `--ignore-scripts` (no package lifecycle scripts).
- `--frozen-lockfile` when `pnpm-lock.yaml` is present (committed pin).
- pnpm version pinned via `devEngines.packageManager`.
- Prefer offline warm store under user cache dir.
- Consent record written to user state / `.repay-skill-runtime/`.

Manual: `node <skill-root>/scripts/ensure-runtime.js [--dry-run]`.

### 2. CLI `init` / `plan` → skills invoke (`repay-cli.js`)

**Intent:** thin human convenience wrapper when the agent skill host is unavailable.

**Mitigations:**

- Skill id is a **constant** (`b-amir/repay-techdebt`), never from argv.
- Package pin: `npx --yes skills@1.5.22` (not floating `skills`).
- `spawn` with `shell: false`.
- Trailing args pass through an **allowlist** of known flags; unknown flags rejected.
- Prefer invoking the skill from the agent host (no `npx`) when possible.

`repay view` never calls `npx`; it only spawns local `view-lessons.js` with `node`.

### 3. PATH shim (`repay-shim.js`)

**Intent:** put `repay` on `PATH` for humans.

**Mitigations:**

- **Off by default.** Enable with `REPAY_LINK_CLI=1` or `ensure-runtime.js --link-cli`.
- Idempotent symlink (Unix) / cmd shim (Windows) under `~/.local/bin` only.
- Always available without shim: `node <skill-root>/bin/repay`.

### 4. Runtime evidence / arbitrary command (`collect-runtime-evidence.js`)

**Intent:** optional deep runtime capture.

**Mitigations:** mandatory `--consent`; without it the collector returns `refused` and does not execute.

### 5. Optional external tools (graphifyy, serena-agent, semgrep)

**Intent:** enhance analysis when already installed; same UX if missing.

**Mitigations:**

- Never auto-install into the target project.
- User-scoped install commands are **suggested**, not run without consent (`check-capabilities.js` ledger).
- Skill chat must not claim a tool ran because it exists.

### 6. Loopback workbook viewer

**Intent:** read lessons + mark progress in a browser.

**Mitigations:** bind `127.0.0.1` only; no raw HTML from lessons; path traversal checks on file reads; progress authority is local `progress.json`.

## What we deliberately do **not** do

- No target `package.json` / lockfile mutation for analysis deps.
- No silent MCP registration.
- No telemetry or outbound upload of target source.
- No agent-authored viewer HTML (script owns shell).

## Operator checklist

1. Review `pnpm-lock.yaml` with the skill version you install.
2. Prefer agent skill activation over `repay init`/`plan` when the host supports it.
3. Only set `REPAY_LINK_CLI=1` if you want a global `repay` command.
4. Never pass secrets as CLI flags; keep them out of lesson Markdown.

## Store / scanner notes (skills.sh and similar)

Automated audits report **MEDIUM** for command execution, skill-root dependency install, optional
PATH shim, loopback viewer, and pinned `npx skills@…`. That classifies **capability**, not a missing
gate. This skill keeps those features and documents the gates above.

What remediates without product cuts:

- Trust table in `SKILL.md` + this file (scanner-readable intent).
- Install scoped to skill root with `--ignore-scripts` / frozen lockfile.
- PATH shim off by default; runtime evidence requires `--consent`.
- Consent/manifest recorded under user state or `.repay-skill-runtime/` after bootstrap (including
  when deps were already present so the audit trail is complete).
- No telemetry; no upload of target source.

Residual MEDIUM on dual-use analysis skills is expected. Goal: honest LOW anomaly + explicit
mitigations, not green-by-deleting-features.
