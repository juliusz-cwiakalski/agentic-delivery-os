---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/fixtures/negative/ADR-9019-malformed-decision-date.md
id: ADR-9019
decision_type: adr
status: Accepted
created: 2026-06-25
decision_date: "2026/06/25"
last_updated: 2026-06-25
summary: "Negative fixture: decision_date violates the YYYY-MM-DD pattern (schema drift fix, reviewer iteration-1 #2)."
owners:
  - "Test Author"
service: delivery-os
classification:
  domains: []
  rigor: R2
governance:
  driver: "@decision-advisor"
  decider: "Tech Lead"
  contributors: []
  reviewers: []
  performers: []
ai_assistance:
  used: false
  roles: []
  external_data_shared: false
  citations_verified: true
  human_decider: "Tech Lead"
  reviewers: []
links:
  related_changes: []
  supersedes: []
  superseded_by: []
  spec: []
---

# ADR-9019: Malformed Decision Date

`decision_date` is non-null but does not match `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`.
Previously only the Accepted non-null check ran; the pattern was not enforced
(schema <-> validator drift). Now `_check_date` rejects it.

## Verification Criteria

- Metric: n/a — Target: n/a
