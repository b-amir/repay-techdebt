# Develop and validate

## Repository map

```text
repay-techdebt/
├── SKILL.md                 # vendor-neutral agent workflow
├── docs/
│   ├── manual.md            # maintenance flags, viewer, CLI quick reference
│   ├── how-it-works.md      # control-flow contracts and exit codes
│   ├── concepts.md          # evidence model, modes, limits, principles
│   ├── tools.md             # optional tools and fallbacks
│   └── develop.md           # this file
├── agents/openai.yaml       # optional product metadata
├── packs/                   # languages, frameworks, capabilities, lenses
├── references/              # evidence, analysis, memory, tools, runtime contracts
├── templates/               # first-run and dynamic lesson composition
├── scripts/
│   ├── lib/                 # program graph, relationships, manifests, storage, tooling
│   └── *.js                 # read-only analyzers, planners, wrappers, memory CLI
└── test/                    # integration and contract tests
```

## Checks

```bash
vp install
vp check
vp test
```

Useful release checks:

```bash
node scripts/check-runtime.js --format table
pnpm dlx skills add . --list
```

The test suite exercises target isolation, project memory consent, polyglot and monorepo modeling,
relationship extraction, evidence identity, manifest adapters, dynamic lesson composition, tool
failure behavior, and CLI integration.

## Install from a local checkout

```bash
pnpm dlx skills add . --skill repay-techdebt
```

Bundled scripts require Node.js 22 or newer. On first use, the agent runs the dependency-free
runtime preflight and must disclose missing packages before asking whether to install or continue
manually.
