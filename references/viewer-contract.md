# Viewer Contract

- The viewer is rendered exclusively by `src/viewer/` from structured data (curriculum JSON, progress JSON, lesson Markdown).
- The agent **never** generates HTML for the viewer — not for lessons, not for the home page, not for planned-topic pages, not for "rich" annotations.
- Lesson Markdown is the _only_ agent-produced input to the viewer, and it passes through markdown-it (`html: false`) — no raw HTML survives.
- Any new viewer feature (resume, section jump, code Copy, soft reload, search, …) is implemented in `src/viewer/`, never by agent improvisation.
