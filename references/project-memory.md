# Project Memory Contract

Read this reference when project-memory status is needed, before initialization, or before saving a
lesson, decision, or typed artifact.

## Storage modes

`private` is the default for configuration, decisions, curriculum state, and typed analysis
artifacts. It stores machine memory in the operating system's user application-data directory and
tool artifacts in the user cache directory. A SHA-256 identity of the canonical
target root keeps projects separate. `REPAY_TECHDEBT_STATE_DIR` and
`REPAY_TECHDEBT_CACHE_DIR` provide explicit roots for CI, sandboxes, and advanced users.

```text
<private-state>/projects/<project-id>/memory/
├── config.json
├── decisions.md
├── curriculum.md
├── curriculum.json
├── lessons/
│   └── index.md                 # legacy/private-output compatibility
└── artifacts/
    ├── index.json
    ├── atlases/
    ├── snapshots/
    └── notebooks/

<private-cache>/projects/<project-id>/
├── graphify/
├── serena/
└── other disposable analyzer data

<parent-of-git-root>/repay-<project>-techdebt/
├── INDEX.md
├── progress.json              # learner completion (viewer + mark-done API)
└── lessons/
    └── YYYY-MM-DD-lesson-title.md
```

The other modes are:

- `session-only`: create no durable memory; use only agent/OS temporary storage.
- `project-local`: create `<target-root>/.repay-techdebt/` and add it to `.gitignore` and
  `.graphifyignore` after explicit consent.
- `team`: create `<target-root>/.repay-techdebt/` for version control after explicit consent.

Memory storage and lesson output are separate choices. The recommended `sister` lesson output is
discoverable and still leaves the target repository untouched. `private` keeps lessons in the old
application-data location. `custom` uses an explicitly approved path. For a target nested inside a
Git worktree, the sister folder is placed next to the Git root, not next to the nested scope.

Legacy schema-v1/v2 target-local memory remains readable. `--sharing local|team` remains a
compatibility alias for `--storage project-local|team`. Never create a second memory location when
both private and target-local stores exist; ask which is authoritative.

Do not store raw tool dumps, source indexes, embeddings, transcripts, credentials, hidden agent
state, or customer data in durable memory.

## First-run wizard

Run the read-only locator first:

```text
node <skill-root>/scripts/project-memory.js status <target-root> --format json
```

When it returns `first-run`, ask whether to persist memory or remain session-only. Recommend:

- storage: `private`;
- lesson output: `sister`, after previewing `suggestedOutputRoot`;
- default mode: `ask`;
- depth: `balanced`;
- save policy: `ask`.

Private initialization must report `targetWrites: []`. It must not create `.repay-techdebt`, edit
ignore files, install target dependencies, add hooks, or add agent instructions.

After approval:

```text
node <skill-root>/scripts/project-memory.js init <target-root> \
  --storage private --output-location sister --mode ask --depth balanced --save-policy ask --yes
```

Use `--storage project-local` or `--storage team` only when explicitly selected. `session-only`
requires no initializer. Humans may use `--interactive`; agents ask in conversation and pass exact
flags.

## Configuration

New schema-v2 configurations include:

```json
{
  "schemaVersion": 2,
  "sharing": "private",
  "storage": { "mode": "private", "projectId": "<sha256>" },
  "defaults": {
    "mode": "ask",
    "lessonDepth": "balanced",
    "fallbackPolicy": "ask"
  },
  "output": {
    "format": "markdown",
    "directory": "lessons",
    "location": "sister",
    "root": "<parent-of-git-root>/repay-<project>-techdebt",
    "savePolicy": "ask",
    "lessonQuality": "strict",
    "artifactTypes": ["atlas", "snapshot", "notebook"]
  },
  "memory": {
    "recordDecisions": true,
    "maintainCurriculum": true,
    "typedArtifacts": true
  },
  "analysis": {
    "budgets": {
      "maxFiles": 30000,
      "maxManifestFiles": 1000,
      "maxRelationFiles": 1500,
      "maxRelationBytes": 12582912
    },
    "boundaryHints": [],
    "criticalWorkflows": [],
    "aliases": {}
  },
  "tooling": {
    "targetMutationPolicy": "deny",
    "installationPolicy": "ask-user-scoped",
    "artifactPolicy": "private-cache"
  }
}
```

Configuration cannot authorize silent fallback, target mutation, global/user tool installation, or
network access. Preview migration without `--yes`; migrate only after approval.

Existing private lesson stores are not moved silently. Preview a discoverable export, then approve
it explicitly:

```text
node <skill-root>/scripts/project-memory.js configure-output <target-root> \
  --output-location sister

node <skill-root>/scripts/project-memory.js configure-output <target-root> \
  --output-location sister --yes
```

The command copies existing lessons, rewrites their index links, changes future output to the new
folder, and preserves the old private files as a backup.

## Reading and writing

Use the `memoryRoot` and `outputRoot` returned by status instead of assuming target-relative paths.
Load only `config.json`, `decisions.md`, `curriculum.json`, workbook `INDEX.md`, and the typed-artifact index.
Load an individual lesson or artifact only when relevant. Treat memory as preferences and history,
not current code evidence.

```text
node <skill-root>/scripts/project-memory.js save-curriculum <target-root> \
  --input <curriculum-json> --yes

node <skill-root>/scripts/project-memory.js save-lesson <target-root> \
  --topic-id <topic-id> --title "Lesson title" --input <temporary-markdown-file> --yes

node <skill-root>/scripts/view-lessons.js <target-root> [--open] [--lesson <lessons/...>]

node <skill-root>/scripts/project-memory.js record-decision <target-root> \
  --scope project --decision "..." --reason "..." --yes

node <skill-root>/scripts/project-memory.js save-artifact <target-root> \
  --type snapshot --title "Verified model" --input <json-file> --verified --yes
```

Lesson paths are relative to `outputRoot`; artifact paths are relative to `memoryRoot`. Curriculum
JSON is canonical private state, while `INDEX.md` is its readable rendering. Saving a lesson marks
its topic written and links it from the index. **Always a workbook:** durable saves require a
curriculum with topics (full workbook or mini-curriculum under **Recent teaching**). Saving
without `--topic-id` when topics exist throws; saving with no curriculum emits
`workbook-linkage-required` (exit 2) after quality checks. A successful save emits `lesson-saved`
with `viewer: { script, deepLinkRel }` for the local browser viewer.

Drafts must pass the configured lesson-quality check
and Secretlint. Snapshots require
`--verified`. Notebooks are parsed, Secretlint-checked, and stripped of outputs and execution
counts. Inputs are capped at 10 MiB. Lesson saves use a lock and atomic index replacement.

## Maintenance and fresh starts

See `<skill-root>/docs/manual.md` for the full command reference.

```text
node <skill-root>/scripts/project-memory.js clear-output <target-root> [--keep-lessons] [--keep-config] [--revert-target-markers] [--dry-run] --yes
node <skill-root>/scripts/project-memory.js clear-cache <target-root> [--dry-run] --yes
node <skill-root>/scripts/project-memory.js reset <target-root> [--dry-run] --yes
node <skill-root>/scripts/project-memory.js reconfig <target-root> [--mode …] [--depth …] [--save-policy …] [--interactive] --yes
node <skill-root>/scripts/project-memory.js open-viewer <target-root>
```

Maintenance deletes only repay-techdebt memory, sister workbook output, disposable cache, and
optional target `.repay-techdebt/` markers — never application source.

## Privacy and analysis boundaries

- Never print or store secrets, credentials, environment values, personal data, or customer data.
- Exclude legacy/opt-in target-local `.repay-techdebt/` from every source analyzer.
- Keep tool binaries user-isolated or skill-local; never modify the target's package manifests or
  lockfiles to install analysis tooling.
- Keep disposable graphs, indexes, and packs in private cache or temporary storage.
- If status reports malformed, incomplete, conflicting, or locked memory, report it and ask before
  repair or migration.
