# Viewer Contract

## Ownership and security

- The viewer is rendered exclusively by `src/viewer/` from structured curriculum, progress, and
  lesson Markdown. The agent never generates viewer HTML.
- Lesson Markdown is the only agent-produced viewer input and passes through markdown-it with
  `html: false`. The server remains loopback-only and source/progress paths stay sandboxed.
- Viewer behavior—home, resume, navigation, search, Copy, completion, diagrams, and live
  updates—belongs in `src/viewer/`, never in improvised lesson markup.

## Responsive and accessible interaction

- Desktop navigation is a persistent, preference-aware rail. At 900px and below it is a
  closed-by-default modal drawer with a scrim, scroll lock, Escape/scrim/link dismissal, initial
  focus, and focus restoration. A desktop open preference must not force the first mobile view
  open.
- Search, settings, shortcuts, and Mermaid expansion provide appropriate dialog/popover semantics,
  contained focus, Escape behavior, and focus restoration. Icon-only controls require accessible
  names; meaningful dynamic feedback uses status regions.
- Search distinguishes idle suggestions, loading, no matches, and recoverable failure. Completion
  distinguishes pending, success, and recoverable failure while preserving the previous state.
  Slow search responses cannot replace a newer query.
- The first lesson section is current at page top. The active TOC state is exposed through
  `aria-current`, has a non-color indicator, and stays visible in long rails.

## Reading system

- Title, section, body, metadata/navigation, and code are separate semantic type roles. The viewer
  uses an offline-safe system stack with no network font request, balanced editorial titles,
  proportional S/M/L scaling, a 58–68 character measure, and mono isolation for code and paths.
- Mixed-direction prose uses plaintext bidi behavior while code and source paths remain isolated
  left-to-right. Mobile text inputs remain at least 16px and browser pinch zoom is unrestricted.
- Inline code is reserved for actual identifiers and literals. Repository paths belong in
  citations or deliberately path-focused content, not repeated explanatory prose.
- Motion communicates only state, focus, and spatial continuity through short opacity/translate
  transitions. Reduced-motion behavior is equivalent. Do not animate lesson prose or scroll
  position.

## Citations and diagrams

- The shared citation grammar is `path:line` or `path:start-end`. Typographic dashes normalize to
  ASCII; pathless ranges fail validation. Valid body citations render as muted numbered references
  and full locations appear only in Sources with editor and backlink behavior. Adjacent ranges for
  one file may share a note.
- Mermaid must include `accTitle` and `accDescr`. Flowcharts prefer compact portrait `TD`/`TB`
  layouts; horizontally essential exceptions stay narrow, and long vertical chains are reduced or
  split. Inline rendering must be readable before expansion.
- The visible diagram action opens the existing SVG without rerendering it. Fit width, Fit height,
  and 100% modes preserve aspect ratio. A render failure provides Retry and an opt-in source view;
  it never exposes stack traces or filesystem details.

## Visual boundary

The lesson surface is a reading tool, not a marketing page. Do not add AIDA page structure, bento
spectacle, ornamental imagery, gradients, glassmorphism, parallax, scroll choreography, ambient
animation, or card containers around ordinary prose. Use hierarchy, measure, whitespace, quiet
rules, and one restrained accent.
