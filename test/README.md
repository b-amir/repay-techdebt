# Test suite map

Category → file index for the test suite. Every `*.test.js` carries a `// @category CX`
first-line tag; this file is the human-readable companion. Update both together when you add
or move a test.

Production code lives under `src/<category>/` (one folder per category, each with a public
`index.js` barrel); CLI entrypoints live under `scripts/`. See `docs/how-it-works.md` for the
control-flow contracts these tests lock.

## How to run

```bash
pnpm test                 # full suite
pnpm test:hygiene         # restructure safety net (import-graph, cli-load, public-api, layer rules, orphan-files)
pnpm test:unit            # pure unit floors (C0–C4)
pnpm test:integration     # CLI exit matrix + packs + fixture runner (C5–C8)
pnpm test:conformance     # minimal agent-path smoke
```

`vp test <path>` filters (e.g. `vp test test/hygiene`). Vitest discovers `**/*.test.js`
recursively, so category subfolders need no config change.

## Restructure safety net (`test/hygiene/` + `test/architecture-hygiene.test.js`)

This is the net that fails fast when a file move orphans an import or leaves a dead file
behind. Run `pnpm test:hygiene` after every move before touching behavior tests.

| File                                | Catches                                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/hygiene/import-graph.test.js` | a relative import that points at a missing file (the primary "folder move broke something" net); also soft-reports import cycles in `src/`               |
| `test/hygiene/cli-load.test.js`     | a script that no longer parses (`node --check` over `scripts/` + `src/`)                                                                                 |
| `test/hygiene/public-api.test.js`   | a category barrel missing a public export, or a stale re-export binding (native-node strict link, since vitest/esbuild is lenient)                       |
| `test/hygiene/orphan-files.test.js` | a library file that exists but nothing imports (dead module or stale copy left by a move)                                                                |
| `test/architecture-hygiene.test.js` | layer violations: a `src/` module importing a CLI (`scripts/project-memory.js`) or a future `cli/` tree; plus the claim-faithfulness omnibus-export lock |

## Category barrels (`src/<cat>/index.js`)

Each category has a barrel that re-exports its public surface. Callers depend on the barrel,
not individual modules; a folder move updates the barrel, not every call site.

| Barrel                     | Category |
| -------------------------- | -------- |
| `src/foundations/index.js` | C0       |
| `src/program/index.js`     | C1       |
| `src/dialogue/index.js`    | C2       |
| `src/curriculum/index.js`  | C3       |
| `src/lessons/index.js`     | C4       |
| `src/tools/index.js`       | C6       |

**Rule:** when you make a function public, add it to its category barrel. Guarded by
`test/hygiene/public-api.test.js`.

## Unit floors (`test/unit/`)

Pure (or temp-dir) unit tests for the category's core exports. No CLI spawned; no network.

| Folder                      | Covers                                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/unit/c0-foundations/` | `resolveTargetRoot` error codes (TARGET_REQUIRED/NOT_DIRECTORY/UNAVAILABLE/IS_SKILL); competing-storage throw; `--storage` validation                                                     |
| `test/unit/c1-program/`     | `normalizeScope` rejects `..`/absolute/NUL; `evidenceSchema`/`programNodeSchema`/`programEdgeSchema` round-trip; `MODEL_VERSION`; `classifyFile`                                          |
| `test/unit/c2-dialogue/`    | `validateTrajectory` workbook/focused/pr; skipped-with-reason; done-needs-reply; out-of-order                                                                                             |
| `test/unit/c3-curriculum/`  | `isOmnibusTopic`/`findOmnibusTopics`; `validateCurriculum` topic-id shape, dup, focus-uniqueness, anti-compression floor, 150 cap, chapter diversity; naming-heuristic corroboration gate |
| `test/unit/c4-lessons/`     | `extractLessonCitations`/`parseClaimsBlock`; `assessClaimFaithfulness` explicit-claims vs auto-near-citation; `runTeachFloors` shape + missing-citation flip                              |

## Integration (`test/integration/`)

CLI exit-code contracts and fixture matrix per category (temp-dir integration, no network).

| File                                         | Covers                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `test/integration/c5-consent-matrix.test.js` | `project-memory` save-curriculum no-`--yes`→2, save-lesson no-`--yes`→2, save-lesson quality-fail→`lesson-quality-failed` 2      |
| `test/integration/c6-tool-consent.test.js`   | `check-capabilities` exit 0 JSON; `run-graphify extract` no-`--yes`→2 (no network, no target writes)                             |
| `test/integration/c7-packs.test.js`          | every `packs/*.json` parses; program/framework load via pack-registry; `lenses.json` shape; `detectPacks` catalog                |
| `test/integration/c8-fixture-runner.test.js` | loops all `test/fixtures/evaluation/*`; validates expectations; runs `evaluateCurriculum` must-find/forbidden over every fixture |

Exit-code contract: consent=2, quality/secret-fail=2, usage/target=1, success=0.

## Categories

| ID                            | Category                                                             | Test files                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **C0** Foundations            | target roots, skill≠target, private vs local storage, memory layout  | `memory-paths`, `privacy-lifecycle`                                                                                                     |
| **C1** Program model          | discover → cover → profile → model shape                             | `program-coverage`, `program-intelligence`, `symbol-relations`, `workflow-discovery`, `workflow-graph`                                  |
| **C2** Dialogue & checkpoints | envelopes, trajectory order, B0–B6 wiring                            | `bottleneck-checkpoints`, `dialogue-envelope`, `dialogue-phase3`, `phase-c-d-checkpoints`                                               |
| **C3** Curriculum             | propose, rank, order, approve, omnibus                               | `curriculum-graph`, `curriculum-planning`, `curriculum-ranking`, `learner-profile`, `topic-decomposition`, `topic-workflow`             |
| **C4** Lesson floors          | quality, citations, faithfulness, pedagogy, composition              | `diagram-composition`, `diagram-integration`, `diagram-selection`, `lesson-composition`, `lesson-evidence`, `lesson-review`, `pedagogy` |
| **C5** Persistence CLI        | consent `--yes`, save, locks, secrets, INDEX                         | `conformance/conformance` (minimal agent path smoke), `curriculum-refresh`, `curriculum-store`, `learning-progress`, `project-memory`   |
| **C6** Tool adapters          | analyzer shape, Graphify/scan wrappers, capabilities                 | `analysis-cache`, `analyzer-adapter`, `integration` (cross-cutting CLI integration), `pattern-worker`, `runtime-evidence`, `tooling`    |
| **C7** Packs & contracts      | pack JSON schema, lens/program packs, release validation             | `pack-contract`, `release-validation`                                                                                                   |
| **C8** Evaluation matrix      | fixture validity, must-find/forbidden, dialogue gates                | `evaluation-fixtures`, `evaluation-runner`, `evaluation-schema`                                                                         |
| **C9** Import hygiene         | layer rules, public API load, CLI parseable, no orphan imports/files | `architecture-hygiene`, `hygiene/import-graph`, `hygiene/cli-load`, `hygiene/public-api`, `hygiene/orphan-files`                        |

### Notes

- `integration.test.js` (C6) is cross-cutting — it exercises CLI exit codes across C0/C1/C6.
  Tagged C6 because the plurality of cases are capability/analyzer CLIs.
- `conformance/conformance.test.js` (C5) is the minimal agent-path smoke (memory init + trajectory).

## Adding a test

1. Pick exactly one category. Put the file under `test/` (or `test/<cat>/`).
2. First line: `// @category CX`.
3. Add the file to the table above.
4. Prefer pure unit tests (no FS) unless the contract is persistence or discovery.
