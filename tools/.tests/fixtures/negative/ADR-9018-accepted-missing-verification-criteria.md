---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/fixtures/negative/ADR-9018-accepted-missing-verification-criteria.md
id: ADR-9018
decision_type: adr
status: Accepted
created: 2026-06-25
decision_date: 2026-06-25
last_updated: 2026-06-25
summary: "Negative fixture: Accepted record with no Verification Criteria section (heuristic warning, exit 0)."
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

# ADR-9018: Accepted Missing Verification Criteria

Deliberately omits a Verification Criteria body section to trigger the non-blocking heuristic.
