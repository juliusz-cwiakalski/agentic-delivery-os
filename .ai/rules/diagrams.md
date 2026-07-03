# Diagram authoring (mermaid)

> Goal: diagrams that render consistently on **GitHub**, not only in tooling. Mermaid
> C4 renders in `mmdc`/editors but does **not** render on GitHub — avoid it.

## Prefer: GitHub-render-safe families

Author diagrams using these families — they render on GitHub:

- `flowchart`
- `sequenceDiagram`
- `stateDiagram-v2`
- `classDiagram`

## Avoid: Mermaid C4 (non-render-safe on GitHub)

Do **not** use Mermaid C4 — it renders in tooling but not on GitHub:

- `C4Context`
- `C4Container`
- `C4Component`

**Fallback:** if a C4 view is needed, author an equivalent `flowchart` instead (it
renders everywhere GitHub does).

## Self-check before marking a doc DoR/DoD-passed

Run `scripts/validate-mermaid.sh` over the changed paths — it renders each
` ```mermaid ` block headless via `mmdc` **and** keyword-guards the C4 denylist
above (a block passes only if it renders **and** contains no non-render-safe
keyword).

As a cheap no-`mmdc` proxy, grep the block for the non-render-safe keywords
(`C4Context`, `C4Container`, `C4Component`) — the keyword guard needs no
Chromium and catches the render-divergent class locally.
