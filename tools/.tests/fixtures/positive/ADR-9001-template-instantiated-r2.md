---
id: ADR-9001
decision_type: adr
status: Proposed
created: 2026-06-25
decision_date: null
last_updated: 2026-06-25
summary: "Template-instantiated Proposed R2 record exercising every classification enum and all top-level enum fields."
owners:
  - "Test Author"
service: delivery-os
decision_area: architecture
decision_scope: org
reversibility: moderate
review_date: 2027-06-25
classification:
  domains: [architecture, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: medium
  blast_radius: org
  recurrence: one-off
governance:
  driver: "@decision-advisor"
  decider: null
  contributors:
    - "Test Author"
  reviewers: []
  performers:
    - "@coder"
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

# ADR-9001: Template Instantiated R2

Exercises all enum fields.

## Verification Criteria

- Metric: throughput — Target: >100 rps
