# Diagram Contract

Every lesson diagram must adhere to these rules before it is persisted in the repository.

## Rules

1. **Self-Contained Markdown**: Diagrams must use fenced Mermaid blocks (` ```mermaid `) embedded directly in the `.md` lesson file. No sidecar `.mmd`, SVGs, or external images are allowed.
2. **Accessibility**: Every diagram must declare an `accTitle` and an `accDescr`. A summary text (`What this shows:`) must immediately follow the diagram in the prose.
3. **Strict Security**: Do not use `init` directives, HTML, scripts, or external CSS resources.
4. **Stable Subset Only**: Only use `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`, or `classDiagram`. Experimental formats (e.g., C4, pie, Sankey) are strictly prohibited.
5. **Verified Evidence**: Every node and edge must correspond to the evidence packet. Generic filler
   relationships such as “interacts with” and hallucinated connections are prohibited.
6. **Explicit Intent**: The lesson plan records `required`, `recommended`, or `omit`. Required
   visuals must be present. Recommended visuals may be omitted only with a topic-specific reason.
7. **Value over Volume**: Reduce dense evidence to the smallest useful subgraph—normally 3–8 nodes
   and 2–10 edges—instead of discarding the visual merely because the full graph is large.
8. **Compact Portrait Layout**: Prefer a portrait or near-square diagram that reads at the viewer's
   normal width without zooming. Flowcharts default to top-to-bottom (`TD` or `TB`); use `LR` or
   `RL` only when horizontal order is essential and the rendered result still fits comfortably.
   Record why that exception improves the teaching question in the diagram intent.
   Do not trade a wide graph for one long vertical chain: prune secondary nodes, group related
   steps, shorten labels, or move detail into prose. Keep sequence diagrams to few participants.
9. **Parse Before Save**: Validate every Mermaid block with the pinned local parser. Fix syntax
   errors before persistence; never save a diagram on visual inspection alone.
