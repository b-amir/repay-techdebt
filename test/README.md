# Test suite map

Category → folder index. Every `*.test.js` carries a `// @category CX` first-line tag.

Production code: `src/<category>/`. CLI entrypoints: `scripts/` (flat — agents reference paths literally in `SKILL.md`).

## How to run

```bash
pnpm test                 # full suite
pnpm test:hygiene         # import graph, CLI parse, public API, orphans, layer rules
pnpm test:unit            # test/unit/**
pnpm test:integration     # test/integration/**
pnpm test:conformance     # minimal agent-path smoke
```

Vitest discovers `**/*.test.js` recursively under `test/`.

## Layout

```
test/
├── conformance/          # C5 agent-path smoke
├── fixtures/evaluation/  # C8 fixture matrix inputs
├── helpers/              # shared test utilities (e.g. passing-judgment)
├── hygiene/              # C9 restructure safety net + architecture-hygiene
├── integration/          # CLI exit-code contracts (C5–C8)
└── unit/
    ├── c0-foundations/
    ├── c1-program/
    ├── c2-dialogue/
    ├── c3-curriculum/
    ├── c4-lessons/
    ├── c5-memory/
    ├── c5-viewer/
    ├── c6-tools/
    └── c8-evaluation/
```

## Hygiene (`test/hygiene/`)

Run `pnpm test:hygiene` after any file move.

| File                           | Catches                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `import-graph.test.js`         | broken relative imports in `src/` and `scripts/`                |
| `cli-load.test.js`             | scripts that fail `node --check`                                |
| `public-api.test.js`           | barrel export drift                                             |
| `orphan-files.test.js`         | dead modules nothing imports                                    |
| `architecture-hygiene.test.js` | layer violations (`src/` → CLI); claim-faithfulness export lock |

## Integration (`test/integration/`)

| File                            | Covers                                    |
| ------------------------------- | ----------------------------------------- |
| `c5-consent-matrix.test.js`     | save consent + quality-fail exit codes    |
| `c5-project-memory.test.js`     | init, save-lesson, locks, workbook export |
| `c5-viewer.test.js`             | viewer server + lesson-saved payload      |
| `c5-maintenance.test.js`        | clear-output, reconfig                    |
| `c3-topic-workflow.test.js`     | teach-topic CLI workflow                  |
| `c6-tool-consent.test.js`       | capabilities + graphify consent           |
| `c6-cli-integration.test.js`    | cross-cutting CLI exit codes              |
| `c7-packs.test.js`              | pack registry                             |
| `c7-pack-contract.test.js`      | pack JSON contracts                       |
| `c7-release-validation.test.js` | release validation script                 |
| `c8-fixture-runner.test.js`     | all evaluation fixtures                   |
| `repay-cli.test.js`             | `repay view --help`, skill locator        |

Exit-code contract: consent=2, quality/secret-fail=2, usage/target=1, success=0.

## Scripts folder

`scripts/` stays **flat** on purpose — `SKILL.md`, agents, and CI invoke `node scripts/<name>.js` by fixed path. Do not nest without updating every reference.

Groups (by prefix, not folder):

| Prefix               | Role                                            |
| -------------------- | ----------------------------------------------- |
| `check-*`            | mechanical lesson/runtime gates                 |
| `scan-*` / `find-*`  | analysis adapters                               |
| `plan-*` / `build-*` | curriculum and model builders                   |
| `project-memory.js`  | persistence CLI (main agent handshake)          |
| `view-lessons.js`    | viewer implementation (`repay view` calls this) |
| `repay-cli.js`       | user-facing `repay` bin router                  |
| `ensure-runtime.js`  | bootstrap deps + PATH shim                      |

## Adding a test

1. Pick one category; place under the matching `test/unit/cX/` or `test/integration/`.
2. First line: `// @category CX`.
3. Import paths: `../../../src/...` from `test/unit/cX/`, `../../src/...` from `test/integration/`.
4. Fixture paths: `../../fixtures/evaluation/...` from unit, `../fixtures/...` from integration.
5. Run `pnpm test:hygiene` after moving files.
