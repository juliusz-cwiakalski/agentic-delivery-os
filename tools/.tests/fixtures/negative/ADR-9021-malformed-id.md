---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/fixtures/negative/ADR-9021-malformed-id.md
id: ADR-99
decision_type: adr
status: Proposed
created: 2026-06-25
decision_date: null
last_updated: 2026-06-25
summary: "Negative fixture: id does not match <TYPE>-<zeroPad4> (coverage enforcement-strength, reviewer iteration-1 #2)."
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

# ADR-99: Malformed Id

`id: ADR-99` violates `^(ADR|PDR|TDR|BDR|ODR)-[0-9]{4}$` (too few digits).
Proves the id-pattern rule is enforced.

## Verification Criteria

- Metric: n/a — Target: n/a
