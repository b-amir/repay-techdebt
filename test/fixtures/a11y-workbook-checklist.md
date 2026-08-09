# Workbook a11y checklist (manual residual)

Automated: shell HTML includes skip link + `main#ds-main-content`; search dialog has `aria-modal`.

Manual residual (no axe in CI):

- [ ] Tab from browser chrome hits skip link, then sidebar links, then main controls
- [ ] `/` opens search; Escape closes; Enter opens first hit
- [ ] `n` / `p` moves between lesson sections; `r` moves to Sources
- [ ] Source-number preview appears on hover and keyboard focus, then dismisses on Escape
- [ ] Long code expands and collapses with Enter/Space; Copy still works in both states
- [ ] Prediction disclosure works with Enter/Space and prints with its answer visible
- [ ] Think first disclosure works with Enter/Space and prints with its answer visible
- [ ] Quick check radios expose one group label, retain visible focus, and announce correct/incorrect explanatory feedback
- [ ] Quick check selection, correct, and incorrect states remain understandable without color
- [ ] See for yourself steps remain readable at 200% zoom and do not require hover or JavaScript
- [ ] Mark done / theme segs operable by keyboard
- [ ] Mark done failure preserves the current lesson and announces recovery text
- [ ] Contrast AA on body text for white / paper / dark themes
- [ ] At 200% zoom and 320px reflow, prose and controls remain available without page overflow
- [ ] Mermaid block has adjacent “What this shows” (craft floor) — not aria-only

Residual risk: third-party Mermaid SVG a11y depends on diagram content.
