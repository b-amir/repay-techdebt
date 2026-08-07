# Optional tools and fallbacks

Bundled model is always the baseline. Optional AI-native tools add fidelity when already
available. Presence alone is never reported as success.

| Capability                    | Prefer when available                    | Bundled fallback (same UX; silent)                                             |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| PR and CI context             | GitHub MCP read-only tools               | Local Git extractor (`get-pr-changes.js`)                                      |
| Architecture and blast radius | Graphify MCP or target-pure Graphify     | Program model query / scoped architecture scan                                 |
| Symbols and references        | Serena MCP or language-aware LSP         | Bundled AST scanners, then live source verify                                  |
| Security                      | Semgrep MCP or CLI                       | Secretlint + manual control/data-flow verify                                   |
| Current library documentation | Context7 MCP or CLI                      | Authoritative official docs                                                    |
| Very large or remote context  | Repomix MCP or CLI                       | Scoped discovery + prioritized outline                                         |
| Duplication                   | Bundled jscpd                            | Manual representative search                                                   |

## Failure policy

**Default:** preferred tool missing, unconfigured, or fails → run the **named bundled fallback**
immediately. Same user-facing UX. No tool menus. No tool jargon in learner chat. No confidence
inflation.

**Ask the user only when:**

1. Install or agent/MCP config change is required, or
2. The phase needs a write the user must authorize, or
3. No bundled fallback exists for that phase (skip that phase honestly).

Do **not** present setup / fallback / skip on every failure.

Record attempts and downgrades in **maintainer notes only** — not first-run or learner chat.
Never claim a tool ran because it exists. Bundled profiler success does not prove Graphify,
Serena, Semgrep, or Context7 succeeded.

Hard overclaim: missing evidence → mark unsupported, shrink scope, or refuse durable save. Never
“continue weaker?”

Agent-facing chains and status vocabulary: `references/tool-integrations.md`. Control flow and
exit codes: [how-it-works.md](how-it-works.md). Trust surfaces: [security.md](security.md).
