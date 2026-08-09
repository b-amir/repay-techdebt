<p align="center">
  <img src="https://raw.githubusercontent.com/b-amir/repay-techdebt/main/assets/readme/hero.svg" width="100%" alt="Repay Tech Debt turns target code into an evidence-qualified program model and clear engineering lessons">
</p>

<p align="center">
  <a href="https://skills.sh/b-amir/repay-techdebt"><img src="https://img.shields.io/badge/skills.sh-repay--techdebt-000000" alt="Install from skills.sh"></a>
  <a href="https://agentskills.io/"><img src="https://img.shields.io/badge/Agent%20Skills-compatible-111111" alt="Agent Skills compatible"></a>
  <a href="https://github.com/b-amir/repay-techdebt/actions/workflows/validate.yml"><img src="https://github.com/b-amir/repay-techdebt/actions/workflows/validate.yml/badge.svg" alt="Validate skill"></a>
  <img src="https://img.shields.io/badge/node.js-22%2B-339933?logo=node.js&logoColor=white" alt="Node.js 22+">
  <a href="https://github.com/b-amir/repay-techdebt/blob/main/LICENSE"><img src="https://img.shields.io/github/license/b-amir/repay-techdebt" alt="MIT license"></a>
</p>

<p align="center">
  <strong>Pay down technical debt of understanding.</strong><br>
  Learn the architecture, flows, syntax, algorithms, risks, and trade-offs already hiding in your codebase.
</p>

```bash
npx skills add b-amir/repay-techdebt
```

Open Agent Skill for code you ship but don’t fully own in your head—AI-generated apps, inherited
systems, dense PRs. Builds an evidence-qualified model of _this_ project and teaches from verified
examples. Analysis-only by default: no silent refactors, no target pollution, no fake confidence.

## One prompt

```text
Use $repay-techdebt to trace authentication from the request boundary to data access.
Teach me what protects the flow, who consumes it, how it fails, and how I can change it safely.
```

Focused run plans subjects from live evidence, then writes lessons with path/line citations and
honest gaps.

## Start

Inside the repo you want to understand:

```bash
repay init --yes
repay plan "Start with the flows I need before changing production code."
repay view --open
repay status   # workbook + config + curriculum summary
```

`init` / `plan` / `view` / `status` run **local** skill scripts (no remote skills CLI).

First run: Fast (recommended defaults) or Control (step through choices). Workbook opens in a
script-owned browser viewer—agents never hand-build HTML.

The local viewer is a complete reading workspace: resume at the last lesson section, use the table
of contents as progress, filter the lesson rail, search lessons with typed match context, fold long
code, inspect quiet numbered source notes, reason through optional answer reveals and self-checks,
follow guided DevTools observations, mark a lesson done and continue, and expand evidence-backed
Mermaid diagrams. Paper, white, and dark themes, proportional text sizes, focus mode, responsive
navigation, and keyboard shortcuts are built in. See the
[viewer guide](docs/manual.md#workbook-viewer).

## Modes

| Mode                   | Best for                                     |
| ---------------------- | -------------------------------------------- |
| **PR Mentor**          | Review a PR, branch, or recent change        |
| **Whole-App Workbook** | Learn an unfamiliar or AI-generated app      |
| **Focused Deep Dive**  | One module, failure, or engineering question |

## How it works

<p align="center">
  <img src="https://raw.githubusercontent.com/b-amir/repay-techdebt/main/assets/readme/workflow.svg" width="100%" alt="Repay Tech Debt resolves the target, models the program, ranks questions, gates enhanced tools, and composes clear lessons">
</p>

Resolve target → load prefs → inventory and rank questions → optional stronger tools → verify live
source → teach with citations and gaps.

Step-by-step control flow: **[docs/how-it-works.md](docs/how-it-works.md)**.

## Docs

| Doc                                          | What’s inside                                           |
| -------------------------------------------- | ------------------------------------------------------- |
| [docs/manual.md](docs/manual.md)             | Flags, CLI, workbook viewer shortcuts                   |
| [docs/how-it-works.md](docs/how-it-works.md) | Control flow, exit codes, turn map                      |
| [docs/concepts.md](docs/concepts.md)         | Evidence states, zoom levels, modes, limits, principles |
| [docs/tools.md](docs/tools.md)               | Optional tools, silent bundled fallbacks                |
| [docs/security.md](docs/security.md)         | Trust boundaries and consent gates                      |
| [docs/develop.md](docs/develop.md)           | Repo map, `vp test`, local install                      |

## Agent notes

Works with Codex, Claude Code, Cursor, OpenCode, Antigravity, and other agents that load
`SKILL.md`. Optional MCP tools are used only when already available; setup always asks first.
Node.js 22+.
