# Develop and validate

## Repository map

```text
repay-techdebt/
├── SKILL.md                 # vendor-neutral agent workflow
├── docs/
│   ├── manual.md            # maintenance flags, viewer, CLI quick reference
│   ├── how-it-works.md      # control-flow contracts and exit codes
│   ├── concepts.md          # evidence model, modes, limits, principles
│   ├── tools.md             # optional tools and silent bundled fallbacks
│   ├── security.md          # trust surfaces and consent gates
│   └── develop.md           # this file
├── agents/openai.yaml       # optional product metadata
├── packs/                   # languages, frameworks, capabilities, lenses
├── references/              # agent contracts (not public product docs)
├── templates/               # first-run and dynamic lesson composition
├── scripts/
│   └── *.js                 # analyzers, planners, wrappers, memory + CLI
├── src/                     # shared libraries (memory, program model, viewer, …)
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

Bundled scripts require Node.js 22 or newer. Missing `node_modules` after skill sync: CLIs call
`ensure-runtime` and install **into `<skill-root>` only** (`--ignore-scripts`; `--frozen-lockfile`
when lockfile present). Never installs into the target app. Manual: `node scripts/ensure-runtime.js`.
Trust model: [security.md](security.md).
