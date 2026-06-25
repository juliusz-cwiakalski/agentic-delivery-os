---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/fixtures/negative/ADR-9027-accepted-unclassified-missing-decider.md
id: ADR-9027
decision_type: adr
status: Accepted
created: 2026-06-25
decision_date: 2026-06-25
last_updated: 2026-06-25
summary: "Negative fixture (RT2 m5): un-classified Accepted record missing its decider (R2 default obligation, DM-4)."
owners:
  - "Test Author"
service: delivery-os
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

# ADR-9027: Accepted Unclassified Missing Decider

## Verification Criteria

- Metric: decider set — Target: governance.decider non-null
