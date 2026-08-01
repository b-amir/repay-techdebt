# Project Memory Contract

Read this reference when project-memory status is needed, before initialization, or before saving a
lesson, decision, or typed artifact.

## Storage modes

`private` is the default. It stores durable outputs in the operating system's user application-data
directory and tool artifacts in the user cache directory. A SHA-256 identity of the canonical
target root keeps projects separate. `REPAY_TECHDEBT_STATE_DIR` and
`REPAY_TECHDEBT_CACHE_DIR` provide explicit roots for CI, sandboxes, and advanced users.

```text
<private-state>/projects/<project-id>/memory/
├── config.json
├── decisions.md
├── curriculum.md
├── lessons/
│   ├── index.md
│   └── YYYY-MM-DD-lesson-title.md
└── artifacts/
    ├── index.json
    ├── atlases/
    ├── snapshots/
    └── notebooks/

<private-cache>/projects/<project-id>/
├── graphify/
├── serena/
└── other disposable analyzer data
```

The other modes are:

- `session-only`: create no durable memory; use only agent/OS temporary storage.
- `project-local`: create `<target-root>/.repay-techdebt/` and add it to `.gitignore` and
  `.graphifyignore` after explicit consent.
- `team`: create `<target-root>/.repay-techdebt/` for version control after explicit consent.

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
- default mode: `ask`;
- depth: `balanced`;
- save policy: `ask`.

Private initialization must report `targetWrites: []`. It must not create `.repay-techdebt`, edit
ignore files, install target dependencies, add hooks, or add agent instructions.

After approval:

```text
node <skill-root>/scripts/project-memory.js init <target-root> \
  --storage private --mode ask --depth balanced --save-policy ask --yes
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
    "savePolicy": "ask",
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

## Reading and writing

Use the `memoryRoot` returned by status instead of assuming a target-relative path. Load only
`config.json`, `decisions.md`, `curriculum.md`, `lessons/index.md`, and the typed-artifact index.
Load an individual lesson or artifact only when relevant. Treat memory as preferences and history,
not current code evidence.

```text
node <skill-root>/scripts/project-memory.js save-lesson <target-root> \
  --title "Lesson title" --input <temporary-markdown-file> --yes

node <skill-root>/scripts/project-memory.js record-decision <target-root> \
  --scope project --decision "..." --reason "..." --yes

node <skill-root>/scripts/project-memory.js save-artifact <target-root> \
  --type snapshot --title "Verified model" --input <json-file> --verified --yes
```

Lesson and artifact paths are relative to the reported `memoryRoot`. Snapshots require
`--verified`. Notebooks are parsed, Secretlint-checked, and stripped of outputs and execution
counts. Inputs are capped at 10 MiB. Lesson saves use a lock and atomic index replacement.

## Privacy and analysis boundaries

- Never print or store secrets, credentials, environment values, personal data, or customer data.
- Exclude legacy/opt-in target-local `.repay-techdebt/` from every source analyzer.
- Keep tool binaries user-isolated or skill-local; never modify the target's package manifests or
  lockfiles to install analysis tooling.
- Keep disposable graphs, indexes, and packs in private cache or temporary storage.
- If status reports malformed, incomplete, conflicting, or locked memory, report it and ask before
  repair or migration.
