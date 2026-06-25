---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/fixtures/positive/ADR-9005-empty-links-flow-map.md
id: ADR-9005
decision_type: adr
status: Proposed
created: 2026-06-25
decision_date: null
last_updated: 2026-06-25
summary: "Positive fixture: links expressed as a YAML flow map '{}{}'. Regression guard for reviewer iteration-1 #1 (flow-map parsing crash)."
owners:
  - "Test Author"
service: delivery-os
decision_area: architecture
decision_scope: org
reversibility: moderate
review_date: null
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
links: {}
---

# ADR-9005: Empty Links Flow Map

`links` is written as a flow map (`links: {}`) — valid YAML that previously
crashed the stdlib parser (silent string mis-parse -> raw `jq` trace, exit 5).
This fixture asserts it now parses to an empty object and validates clean.

## Verification Criteria

- Metric: n/a — Target: n/a
