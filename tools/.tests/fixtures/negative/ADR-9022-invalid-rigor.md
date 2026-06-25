---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/fixtures/negative/ADR-9022-invalid-rigor.md
id: ADR-9022
decision_type: adr
status: Proposed
created: 2026-06-25
decision_date: null
last_updated: 2026-06-25
summary: "Negative fixture: classification.rigor is not a valid enum value (coverage enforcement-strength, reviewer iteration-1 #2)."
owners:
  - "Test Author"
service: delivery-os
classification:
  domains: []
  rigor: R9
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

# ADR-9022: Invalid Rigor

`classification.rigor: R9` is not in {R0,R1,R2,R3}. Proves the nested rigor
enum rule is enforced.

## Verification Criteria

- Metric: n/a — Target: n/a
