# Diagram authoring (mermaid)

> Goal: diagrams that render consistently on **GitHub**. GitHub renders all
> Mermaid families, including C4.

## Supported families

All Mermaid families are allowed — common ones include:

- `flowchart`
- `sequenceDiagram`
- `stateDiagram-v2`
- `classDiagram`

`C4Context`, `C4Container`, and `C4Component` are **also supported**.

## Self-check before marking a doc DoR/DoD-passed

Run `scripts/validate-mermaid.sh` over the changed paths before marking a doc
DoR/DoD-passed — it renders each ` ```mermaid ` block headless via `mmdc` and
reports any parse/render failure.
