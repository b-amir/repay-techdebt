# Privacy and Retention

This document outlines the data inventory for `repay-techdebt` and its privacy safeguards, ensuring that users maintain control over their data and preventing unintentional leaks of sensitive information via shared workbooks.

## Data Inventory

| Field/File | Purpose | Retention |
|---|---|---|
| `curriculum.json` | Stores lesson plans, completion status, and topic history. | Persistent. Managed by user commands (e.g. `clear`). |
| `INDEX.md` | Provides a human-readable entry point to generated lessons. | Persistent. Rewritten on `status` or lesson creation. |
| `.cache/` | Caches analysis results and ASTs to respect performance budgets. | Ephemeral. Ignored by VC, safe to purge anytime. |
| `lessons/*.md` | The actual AI-generated documentation artifacts. | Persistent. |

## Path Sanctioning

To ensure workbooks remain fully portable across operating systems (macOS, Linux, Windows), and to prevent leaking local developer paths (e.g. `/Users/myname/workspace/...`):
- All memory artifacts (like `INDEX.md` and `lessons/`) will convert absolute paths to relative paths.
- The `--export` capabilities of `project-memory.js` rigorously enforce absolute path scrubbing.

## Secret Redaction

Before any workbook or curriculum is saved or exported, it is scrubbed for common secret patterns (e.g., AWS keys, GitHub PATs, JWTs, etc.). `repay-techdebt` implements basic secret-linting directly during output generation. Any discovered secrets are replaced with `[REDACTED]`.

## Deletion and Transparency

Users always own the `<target-root>/.repay-techdebt` directory. They can `rm -rf` the `.cache` folder at any time without damaging state. They may also delete individual lesson files, which the system will recognize as "missing" upon the next `refresh`.
