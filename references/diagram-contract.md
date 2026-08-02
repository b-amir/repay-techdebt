# Diagram Contract

Every lesson diagram must adhere to these rules before it is persisted in the repository.

1. **Self-Contained Markdown**: Diagrams must use fenced Mermaid blocks (` ```mermaid `) embedded directly in the `.md` lesson file. No sidecar `.mmd`, SVGs, or external images are allowed.
2. **Accessibility**: Every diagram must declare an `accTitle` and an `accDescr`. A summary text (`What this shows:`) must immediately follow the diagram in the prose.
3. **Strict Security**: Do not use `init` directives, HTML, scripts, or external CSS resources.
4. **Stable Subset Only**: Only use `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`, or `classDiagram`. Experimental formats (e.g., C4, pie, Sankey) are strictly prohibited.
5. **Verified Evidence**: A diagram's nodes and edges must correspond to the evidence packet. Hallucinated relationships are prohibited.
6. **Value over Volume**: A diagram is justified only if it reduces cognitive load and replaces an equivalent prose explanation. Dense diagrams (e.g., >10 nodes, >14 edges) should be split, simplified, or reverted to prose.
