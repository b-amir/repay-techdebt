# Workbook a11y checklist (manual residual)

Automated: shell HTML includes skip link + `main#ds-main-content`; search dialog has `aria-modal`.

Manual residual (no axe in CI):

- [ ] Tab from browser chrome hits skip link, then sidebar links, then main controls
- [ ] `/` opens search; Escape closes; Enter opens first hit
- [ ] Mark done / theme segs operable by keyboard
- [ ] Contrast AA on body text for white / paper / dark themes
- [ ] Mermaid block has adjacent “What this shows” (craft floor) — not aria-only

Residual risk: third-party Mermaid SVG a11y depends on diagram content.
