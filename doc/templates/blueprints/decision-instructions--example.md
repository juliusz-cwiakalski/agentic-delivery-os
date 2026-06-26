---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/blueprints/decision-instructions--example.md
ados_distribution: redistributable
---
# Decision Instructions

<!-- Copy this file to `.ai/agent/decision-instructions.md` in your project. -->
<!-- Customize the sections below for your project's tracking conventions and strategic priorities. -->
<!-- `@decision-advisor` and `@decision-critic` read this file to ground recommendations in YOUR context. -->
<!-- This file supplements the generic guides; it does not replace them. -->

## Strategic Context

<!-- Distill what YOUR project cares about so the decision-advisor calibrates recommendations accordingly. -->
<!-- This is a decision-relevant extract, not a duplication of full strategy docs. -->

### Mission

<!-- One to three sentences: what is this project/product, and why does it exist? -->
- [Your mission statement]

### Core priorities (ranked)

<!-- Rank what matters most when making trade-offs. These become default decision drivers. -->
1. [Most important priority]
2. [Second priority]
3. ...

### Decision principles

<!-- Project-specific principles that guide HOW decisions are made. -->
- [e.g., "Reversibility trumps theoretical optimality — ship, measure, adjust."]
- [e.g., "Prefer buy over build for non-core capabilities."]
- [e.g., "Security and privacy are non-negotiable; everything else is a trade-off."]

### Key constraints

<!-- Hard limits that constrain the option space. -->
- [e.g., Budget: <$X/month infrastructure]
- [e.g., Team: N engineers, no dedicated DevOps]
- [e.g., Compliance: GDPR, SOC 2]

## Operational: Decision Tracking

### Tracker

<!-- How are decisions tracked in YOUR project? -->
- **Issue tracker**: [GitHub Issues | Jira | Linear | ...]
- **Decision tracking**: [Sequential files in doc/decisions/ | Tracker tickets with label `decision` | Custom project (e.g., MVDR) | ...]
- **workItemRef prefix**: [GH- | PDEV- | MVDR- | ...]

### Decision identifier scheme

<!-- How are decision records numbered? -->
- **Format**: [<TYPE>-<zeroPad4> | <PROJECT>-<number> | ...]
- **Numbering**: [Sequential per type | Sequential per project | Assigned by tracker]
- **Resolution**: [Scan doc/decisions/ | Query tracker for next number | ...]

### File location and naming

<!-- Where do decision records live and how are they named? -->
```
[doc/decisions/<TYPE>-<zeroPad4>-<slug>.md]
```

### Status lifecycle

<!-- What statuses do decisions go through? Map to your tracker if applicable. -->
```
Proposed → Under Review → Accepted → (Deprecated | Superseded)
```

### Labels and linking

<!-- How are decisions linked to implementation work? -->
- Decision → implementation: [label / link-blocks relationship / ...]
- Decision → affected components: [affects-* labels / ...]

## References

- [Decision-Making Guide](../../doc/guides/decision-making.md) — the decision *process*
- [Decision Records Management Guide](../../doc/guides/decision-records-management.md) — the record *artifact*
- [Decision Record Template](../../doc/templates/decision-record-template.md)
