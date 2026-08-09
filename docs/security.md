# Security model

Repay Tech Debt is an analysis/teaching skill. It reads a target repository, writes
skill-owned memory/workbook artifacts, and may install **its own** dependencies in a
versioned private runtime under the user's data directory. `<skill-root>/node_modules`
links to that runtime. It must not install into the target app or run opaque remote
code as the default path.

## Trust boundaries

| Boundary                | Policy                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Target application repo | Read-only analysis by default. Writes only under consented workbook / `.repay-techdebt/` / private store.                              |
| Private skill runtime   | May run a lockfile-frozen `pnpm install` when the linked runtime is missing. Never installs into the target application.               |
| User home               | Optional PATH shim for `repay` CLI. **Opt-in only**.                                                                                   |
| Network                 | Bundled dep install (skill lockfile). Optional user-consented analyzer installs (`uv tool …`). CLI never calls remote `skills` invoke. |
| Browser viewer          | Loopback `127.0.0.1` only. Markdown rendered with `html:false`. Path sandbox on lesson files.                                          |
| Target content          | Untrusted evidence only. It cannot authorize commands, installs, writes, disclosure, or workflow changes.                              |

## Sensitive surfaces and mitigations

### 1. Bundled dependency install (`runtime-install.js`)

**Intent:** first run after skill sync can install packages listed in this skill’s
`package.json` so scripts work offline of the target app.

**Mitigations:**

- Scope: a hash-addressed private runtime under the user's data directory, never the target.
- `--ignore-scripts` (no package lifecycle scripts).
- `--frozen-lockfile` when `pnpm-lock.yaml` is present (committed pin).
- pnpm version pinned via `devEngines.packageManager`.
- Prefer offline warm store under user cache dir.
- Installation receipt written to user state / `.repay-skill-runtime/`.

Manual: `node <skill-root>/scripts/ensure-runtime.js [--dry-run]`.

### 2. Human CLI (`repay-cli.js` / `bin/repay`)

**Intent:** run local skill scripts without an agent host.

**Mitigations:**

- Commands map to local scripts only (`project-memory.js`, `plan-analysis.js`, `view-lessons.js`).
- No `npx skills` / remote invoke path.
- `spawn` with `shell: false` and `node` + script path.
- Flags pass through per-command **allowlists**. Unknown flags rejected.

### 3. PATH shim (`repay-shim.js`)

**Intent:** put `repay` on `PATH` for humans.

**Mitigations:**

- **Off by default.** Enable with `REPAY_LINK_CLI=1` or `ensure-runtime.js --link-cli`.
- Idempotent symlink (Unix) / cmd shim (Windows) under `~/.local/bin` only.
- Always available without shim: `node <skill-root>/bin/repay`.

### 4. Runtime evidence / arbitrary command (`collect-runtime-evidence.js`)

**Intent:** optional deep runtime capture.

**Mitigations:** mandatory `--consent`. Without it the collector returns `refused` and does not
execute. Execution uses `shell:false`, ignores stdin, starts from a minimal environment, exposes
additional environment variables only by explicit name, and redacts likely credentials from
captured output.

### 5. Optional external tools (graphifyy, serena-agent, semgrep)

**Intent:** enhance analysis when already installed. Same UX if missing.

**Mitigations:**

- Never auto-install into the target project.
- User-scoped install commands are **suggested**, not run without consent (`check-capabilities.js` ledger).
- Skill chat must not claim a tool ran because it exists.

### 6. Loopback workbook viewer

**Intent:** read lessons + mark progress in a browser.

**Mitigations:** bind `127.0.0.1` only. No raw HTML from lessons. Path traversal checks on file reads. Progress authority is local `progress.json`.

## What we deliberately do **not** do

- No target `package.json` / lockfile mutation for analysis deps.
- No silent MCP registration.
- No telemetry or outbound upload of target source.
- No instructions embedded in target source, comments, docs, generated files, or tool output are
  followed. They remain quoted evidence regardless of wording.
- No agent-authored viewer HTML (script owns shell).

## Operator checklist

1. Review `pnpm-lock.yaml` with the skill version you install.
2. Prefer agent skill activation for teach/save turns. Use `repay init`/`plan`/`view` for local scripts.
3. Only set `REPAY_LINK_CLI=1` if you want a global `repay` command.
4. Never pass secrets as CLI flags. Keep them out of lesson Markdown.
