# Agent Portability

This document outlines the standard API boundary and expectations that `repay-techdebt` uses when interfacing with underlying AI agents (e.g. Codex, Claude Code, Cursor, OpenCode, Antigravity).

## Guiding Principle
The `repay-techdebt` workflow must **never** hard-require proprietary agent capabilities (like a specific Model-Context-Protocol hook or a vendor-specific search index) that prevents it from running successfully in a minimal baseline agent.

## The Minimal Agent
A "Minimal Agent" is defined as any AI environment with access to:
1. Standard Unix File System APIs (Read/Write directories and files).
2. The ability to spawn child processes (`scripts/*` and `npx`).
3. Standard context window loading mechanisms (e.g., reading `SKILL.md`).

## Graceful Degradation
When proprietary hooks (like native fast-search or deep vector embeddings) are unavailable, the skill degrades to using standard `ripgrep` or falling back to the explicit structural heuristics defined in the `.json` packs. The outcome might take a few seconds longer, but it will never crash or refuse to operate.

## Conformance Harness
We assert agent portability through `test/conformance/conformance.test.js` and `scripts/run-conformance.js`. These suites explicitly mock a dumb environment and prove that the orchestrator state transitions (missing -> investigating -> drafting) still proceed flawlessly.
