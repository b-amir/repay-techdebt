# Viewer Contract

## Ownership and security

- The viewer is rendered exclusively by `src/viewer/` from structured curriculum, progress, and
  lesson Markdown. The agent never generates viewer HTML.
- Lesson Markdown is the only agent-produced viewer input and passes through markdown-it with
  `html: false`. The server remains loopback-only and source/progress paths stay sandboxed.
- Viewer behavior, including home, resume, navigation, search, Copy, completion, diagrams, and live
  updates, belongs in `src/viewer/`, never in improvised lesson markup.

## Responsive and accessible interaction

- Desktop navigation is a persistent, preference-aware rail. At 900px and below it is a
  closed-by-default modal drawer with a scrim, scroll lock, Escape/scrim/link dismissal, initial
  focus, and focus restoration. A desktop open preference must not force the first mobile view
  open.
- Search, settings, shortcuts, and Mermaid expansion provide appropriate dialog/popover semantics,
  contained focus, Escape behavior, and focus restoration. Icon-only controls require accessible
  names. Meaningful dynamic feedback uses status regions.
- Search distinguishes idle suggestions, loading, no matches, and recoverable failure. Completion
  distinguishes pending, success, and recoverable failure while preserving the previous state.
  Slow search responses cannot replace a newer query. Results distinguish titles, sections,
  explanations, symbols, diagrams, claims, and sources. They include compact match context and
  section anchors when available.
- The first lesson section is current at page top. The active TOC state is exposed through
  `aria-current`, has a non-color indicator, and stays visible in long rails. The TOC is the only
  in-lesson progress model: do not add a top line, percentage, ring, or floating progress control.

## Reading system

- Title, section, body, metadata/navigation, and code are separate semantic type roles. The viewer
  uses an offline-safe system stack with no network font request, balanced editorial titles, a
  five-stop 80–120% proportional zoom, a 58–68 character measure, and mono isolation for code and
  paths.
- Mixed-direction prose uses plaintext bidi behavior while code and source paths remain isolated
  left-to-right. Mobile text inputs remain at least 16px and browser pinch zoom is unrestricted.
- Inline code is reserved for actual identifiers and literals. Repository paths belong in
  citations or deliberately path-focused content, not repeated explanatory prose.
- Code blocks over 18 lines use button-based, keyboard-accessible progressive disclosure while preserving
  Copy, syntax highlighting, horizontal scrolling, and complete print output. Short blocks remain
  unadorned.
- Prediction and Think first answers use native `details` interactions generated from documented
  Markdown. They remain understandable without client JavaScript and print exposes the answers.
- Quick checks support two to four radio choices with exactly one predefined answer. The action is
  disabled until a choice is made. Feedback names correctness and explains the mechanism through a
  polite live region. Selection, correct, and incorrect states never rely on color alone. Answers
  are local to the page and are neither scored nor persisted. Without JavaScript, a native Show
  answer disclosure preserves access to the correct choice and explanation.
- See for yourself walkthroughs render as restrained inline labs with ordered DevTools steps, a safe
  execution context and variation, an observable signal, and explicit reset guidance. They never
  depend on special client code.
- Motion communicates only state, focus, and spatial continuity through short opacity/translate
  transitions. Reduced-motion behavior is equivalent. Do not animate lesson prose or scroll
  position.
- Written and planned lesson pages share the same wide-desktop grid, including the reserved right
  TOC track, so navigation does not move the reading column. Mobile and intermediate layouts do not
  reserve that track.
- Modal, palette, and navigation backdrops are neutral to the active theme. They may dim or soften
  the reading surface but must not add a blue or accent-colored cast.

## Citations and diagrams

- The shared citation grammar is `path:line` or `path:start-end`. Typographic dashes normalize to
  ASCII. Pathless ranges fail validation. Valid body citations render as muted numbered references
  and full locations appear only in Sources with editor and backlink behavior. Hover or keyboard
  focus may show a short basename-and-range preview, but touch never depends on hover. Adjacent
  ranges for one file may share a note.
- Mermaid must include `accTitle` and `accDescr`. Flowcharts prefer compact portrait `TD`/`TB`
  layouts. Horizontally essential exceptions stay narrow, and long vertical chains are reduced or
  split. Inline rendering must be readable before expansion.
- The visible diagram action opens the existing SVG without rerendering it. Fit width, Fit height,
  and 100% modes preserve aspect ratio. A render failure provides Retry and an optional source view.
  it never exposes stack traces or filesystem details.

## Continuity and completion

- A stored section belongs to the stored lesson. Changing lessons clears the old section so a
  matching heading id in another lesson cannot trigger a false resume. A restored heading may show
  a brief, non-layout-shifting Resume here marker that disappears after reading continues.
- An incomplete lesson with a next lesson uses one primary Mark done and continue action. Navigation
  occurs only after completion persists. Failure keeps the current page and announces recovery.
- Keyboard shortcuts supplement visible controls: lesson navigation, section navigation, Sources,
  completion, search, focus, and the sidebar all retain an ordinary pointer/touch path.

## Visual boundary

The lesson surface is a reading tool, not a marketing page. Do not add AIDA page structure, bento
spectacle, ornamental imagery, gradients, glassmorphism, parallax, scroll choreography, ambient
animation, or card containers around ordinary prose. Use hierarchy, measure, whitespace, quiet
rules, and one restrained accent.
