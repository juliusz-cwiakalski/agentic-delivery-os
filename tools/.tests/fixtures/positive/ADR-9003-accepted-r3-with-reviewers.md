---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/fixtures/positive/ADR-9003-accepted-r3-with-reviewers.md
id: ADR-9003
decision_type: adr
status: Accepted
created: 2026-06-25
decision_date: 2026-06-25
last_updated: 2026-06-25
summary: "Accepted R3 record with non-empty reviewers (DEC-12 R3 requirement satisfied)."
owners:
  - "Test Author"
service: delivery-os
decision_area: architecture
decision_scope: org
reversibility: hard
review_date: null
classification:
  domains: [architecture]
  archetype: design
  environment: complicated
  rigor: R3
  reversibility: hard
  stakes: high
  urgency: medium
  uncertainty: high
  blast_radius: org
  recurrence: one-off
governance:
  driver: "@decision-advisor"
  decider: "Tech Lead"
  contributors:
    - "Test Author"
  reviewers:
    - "Reviewer One"
    - "Reviewer Two"
  performers:
    - "@coder"
ai_assistance:
  used: false
  roles: []
  external_data_shared: false
  citations_verified: true
  human_decider: "Tech Lead"
  reviewers:
    - "Reviewer One"
    - "Reviewer Two"
links:
  related_changes: []
  supersedes: []
  superseded_by: []
  spec: []
---

# ADR-9003: Accepted R3 With Reviewers

## Verification Criteria

- Metric: error-rate — Target: <1%
