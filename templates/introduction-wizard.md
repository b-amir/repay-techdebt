# Welcome to Repay Tech Debt

I analyze and teach unfamiliar code without changing the application. By default, private machine
state stays in user storage and the readable workbook gets a clearly named folder outside the
repository.

## Storage choice

Choose one:

- **Private** _(recommended)_: durable external memory and private external tool caches; no target
  files, dependencies, ignore rules, hooks, or agent instructions.
- **Session only**: no durable memory; temporary artifacts are removed after the run.
- **Project local**: create a gitignored `.repay-techdebt/` in the target. This is opt-in.
- **Team**: create version-controlled `.repay-techdebt/` in the target. This is opt-in and requires
  a suitable Git repository.

Optional enhanced CLIs are installed only in isolated user tool environments after separate
approval. Bundled Node packages stay under the skill installation. Neither kind is added to the
target's manifest or lockfile.

## Analysis preferences

1. **Lesson output:** Sister workbook _(recommended)_, private application-data storage, or a custom
   path. Preview the exact proposed path before approval. The sister folder is named
   `repay-<project>-techdebt` and sits beside the Git repository, not inside it.
2. **Mode:** Ask _(recommended)_, PR, or Workbook.
3. **Lesson depth:** Balanced _(recommended)_, Concise, or Deep.
4. **Lesson saving:** Ask _(recommended)_ or Automatic for explicitly requested lessons.
5. **Optional hints:** unusual boundaries, component aliases, and critical workflows.
6. **Optional budgets:** defaults are 30,000 files, 1,000 manifests, 1,500 relationship files, and
   12 MiB of relationship source.

Reply with the memory storage, lesson output, mode, depth, and save policy. “Recommended” means
**Private memory, Sister workbook, Ask, Balanced, Ask**. Nothing is persisted until you approve the
exact paths.
