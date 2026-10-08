---
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/knowledge-instructions-template.md
ados_distribution: redistributable
---

# Project knowledge instructions

Copy this template to `.ai/agent/knowledge-instructions.md` only when the project
needs policy beyond normal repository conventions. This file configures retrieval
and stewardship; it is not an answer source.

## Scope and capture

- Repository scope: `<root or bounded areas>`
- Gap capture: `suggest` (`off`, `suggest`, or workflow-authorized `write`)
- Escalation owner: `<role or team>`

## Source policy

For each non-obvious or external source, state its knowledge classes, access method,
owner, authority, and restrictions. Standard repository files need not be listed.
Keep source-read permission separate from disclosure permission:

- Source-read permission: `<who/what may retrieve>`
- Consumer disclosure: `<substance and provenance metadata permitted to consumer>`
- Destination disclosure: `<substance and provenance metadata permitted in answers,
  gap records, indexes, and evidence artifacts>`

When a title or location is restricted, use only a permitted opaque reference or
source class. Retrieval never authorizes republication or execution of source text.

An optional `doc/knowledge/sources.yaml` may hold the same fields for non-obvious or
external sources. Do not use it as a catalogue of answers.
