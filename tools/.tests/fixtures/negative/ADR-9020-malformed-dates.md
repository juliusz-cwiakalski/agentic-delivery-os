---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/fixtures/negative/ADR-9020-malformed-dates.md
id: ADR-9020
decision_type: adr
status: Proposed
created: "2026/13/01"
decision_date: null
last_updated: "not-a-date"
review_date: "2026/02/02"
summary: "Negative fixture: created/last_updated/review_date violate the YYYY-MM-DD pattern (coverage enforcement-strength, reviewer iteration-1 #2)."
owners:
  - "Test Author"
service: delivery-os
classification:
  domains: []
  rigor: R2
governance:
  driver: "@decision-advisor"
  decider: null
  contributors: []
  reviewers: []
  performers: []
ai_assistance:
  used: false
  roles: []
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
links:
  related_changes: []
  supersedes: []
  superseded_by: []
  spec: []
---

# ADR-9020: Malformed Dates

`created`, `last_updated`, and `review_date` each violate
`^[0-9]{4}-[0-9]{2}-[0-9]{2}$`. Proves `_check_date` rejects malformed values
for every date field (coverage enforcement-strength).

## Verification Criteria

- Metric: n/a — Target: n/a
