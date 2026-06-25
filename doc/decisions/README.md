---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/decisions/README.md
---
# Decision Records

Decision records for all decision types: ADR (Architecture), PDR (Product), TDR (Technical), BDR (Business), and ODR (Operational).

## Purpose

This directory contains the project's decision records — durable artifacts that capture the context, drivers, alternatives, and rationale behind significant decisions. They serve as:

- **Historical reference** — understand why decisions were made
- **Onboarding aid** — new team members learn the reasoning behind the current architecture
- **Change triggers** — when context changes, review existing decisions for relevance

## Naming Convention

```
<TYPE>-<zeroPad4>-<slug>.md
```

Examples:
- `ADR-0001-event-bus-selection.md`
- `PDR-0001-free-tier-scope.md`
- `TDR-0001-state-management-library.md`

## Lifecycle

Proposed → Under Review → Accepted → (Deprecated | Superseded)

## Index and Validation

- **[`00-index.md`](00-index.md)** is a **generated** table of all records plus a Health subsection (flagging missing deciders / missing metrics via `links.metrics`). Do not hand-edit it — regenerate with `tools/generate-decision-index` (or `/decision-index`) after adding or editing a record, and commit the regenerated file. CI detects drift.
- **`tools/validate-decision-record`** checks record front matter against the declarative schema (`schemas/decision-record-frontmatter.schema.json`) — run it locally before committing a record (exit 0 = clean).

## References

- [Decision Records Management Guide](../guides/decision-records-management.md) — full standard including governance, types, and lifecycle
- [Decision Record Template](../templates/decision-record-template.md) — template for authoring new records
- [validate-decision-record](../tools/validate-decision-record.md) — validator user guide
- [generate-decision-index](../tools/generate-decision-index.md) — index generator user guide
- [Documentation Handbook](../documentation-handbook.md) — repository documentation standard
