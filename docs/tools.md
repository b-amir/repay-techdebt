# Transparent tool integration

The bundled model is always the baseline. Optional AI-native and specialized tools add fidelity;
their presence alone is never reported as success.

| Capability                    | Preferred path                               | Explicit fallback                                                              |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| PR and CI context             | GitHub MCP read-only tools                   | Bundled local Git extractor                                                    |
| Architecture and blast radius | Graphify MCP or target-pure Graphify wrapper | Bundled relationship model; scoped dependency-cruiser/tree only after approval |
| Symbols and references        | Serena MCP or a language-aware compiler/LSP  | Bundled ts-morph, ast-grep, Acorn, then direct source verification             |
| Security                      | Semgrep MCP or CLI                           | Secretlint plus manual control/data-flow verification                          |
| Current library documentation | Context7 MCP or CLI                          | Authoritative official documentation search                                    |
| Very large or remote context  | Repomix MCP or CLI                           | Scoped discovery and prioritized module outline                                |
| Duplication                   | Bundled jscpd                                | Manual representative search                                                   |

When a needed tool fails, the skill stops before downgrading and explains:

```text
what failed -> capability lost -> setup or repair -> exact fallback and limitation
```

The user chooses whether to set it up and retry, accept the named fallback, or skip that phase. The
final Tool Use Ledger records every attempted operation and downgrade.

Optional MCP tools are discovered from the active agent at runtime; the skill does not assume every
agent exposes the same integrations.

Control-flow and exit-code detail: [how-it-works.md](how-it-works.md).
