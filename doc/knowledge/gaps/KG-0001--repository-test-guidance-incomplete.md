---
id: KG-0001
status: Open
type: drift
area: repository-test-guidance
summary: AGENTS.md does not identify the actual test aggregators or their discovery boundary
owners: [engineering]
created: 2026-09-09T08:17:57Z
updated: 2026-09-09T08:17:57Z
context: A contributor asks how to run all repository tests and follows the Running tests section in AGENTS.md.
diagnosis: The documented wildcard command can pass several matching paths to one Bash invocation, while the repository provides separate scripts/test-all.sh and tools/test-all.sh aggregators that discover only executable test-*.sh files. The extensionless zclaude unit suite is outside that discovery contract.
evidence_checked:
  - source: AGENTS.md#running-tests
    observation: The section states only the test-file pattern and a wildcard Bash command.
  - source: scripts/test-all.sh
    observation: The aggregator scans its default scripts subtree for executable test-*.sh files under .tests or tests directories.
  - source: tools/test-all.sh
    observation: The aggregator independently scans its default tools subtree with the same executable test-*.sh boundary.
  - source: tools/.tests/test-zclaude-unit
    observation: This valid extensionless Bash test is not selected by either test-*.sh aggregator and requires direct invocation.
impact: Contributors can unintentionally run only one matching test script or assume the documented wildcard covers the complete repository test inventory.
occurrence:
  count: 1
  last_observed: 2026-09-09T08:17:57Z
relationships:
  changes: [GH-41]
  decisions: []
  work: [GH-41]
  gaps: []
desired_resolution: Document both repository test aggregators, their executable test-*.sh discovery boundary, focused single-file invocation, and the direct extensionless zclaude unit-test command in AGENTS.md.
resolution: null
disposition: null
history: []
reopening_evidence: null
---

# KG-0001 — Repository test guidance is incomplete

PM routes this small canonical documentation repair through existing work item GH-41.
The record remains Open until a fresh original query verifies the repaired guidance.
