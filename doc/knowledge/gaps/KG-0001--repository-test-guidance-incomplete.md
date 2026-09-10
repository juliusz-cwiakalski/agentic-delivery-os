---
id: KG-0001
status: Resolved
type: drift
area: repository-test-guidance
summary: AGENTS.md does not identify the actual test aggregators or their discovery boundary
owners: [engineering]
created: 2026-09-09T08:17:57Z
updated: 2026-09-09T11:17:46Z
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
  - source: tmp/run-logs-runner/2026-09-09/102929-tc020-close-repair-evidence.txt
    observation: A fresh unchanged original query against repair c9dbde1 found the complete commands and discovery boundary, matched KG-0001 without mutation or duplication, and passed ordinary and HEAD-baseline validation.
  - source: tmp/run-logs-runner/2026-09-09/123113-scripts-test-all-sanitized.log
    observation: Canonical scripts aggregator execution passed 14 of 14 discovered test files.
  - source: tmp/run-logs-runner/2026-09-09/123221-tools-test-all-sanitized.log
    observation: Canonical tools aggregator execution passed 6 of 7 discovered test files; the pre-existing CI-excluded text-to-image performance test failed, so this is not evidence that every legacy test passes.
  - source: tmp/run-logs-runner/2026-09-09/123309-test-zclaude-unit.log
    observation: Direct execution of the extensionless zclaude unit suite passed 19 of 19 tests.
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
resolution:
  canonical_ref: AGENTS.md#running-tests
  verified_at: 2026-09-09T11:17:46Z
  verification_notes: Repair c9dbde1 documents both aggregators, their executable test-*.sh discovery boundary, focused execution, and the direct extensionless zclaude suite. A fresh original-query rerun recognized the complete guidance without duplicating or mutating KG-0001. Actual execution passed scripts 14/14 and zclaude 19/19; tools passed 6/7, with the pre-existing CI-excluded text-to-image performance test failing. Closure establishes command discovery and completeness, not that every legacy test passes.
  related_refs: [GH-41, c9dbde1, tmp/run-logs-runner/2026-09-09/102929-tc020-close-repair-evidence.txt]
disposition: null
history:
  - kind: resolution
    at: 2026-09-09T11:17:46Z
    canonical_ref: AGENTS.md#running-tests
    verification_notes: Fresh original-query verification against c9dbde1 and actual canonical command execution established complete runner discovery; scripts passed 14/14, zclaude passed 19/19, and tools passed 6/7 with the pre-existing CI-excluded performance failure retained.
reopening_evidence: null
---

# KG-0001 — Repository test guidance is incomplete

PM routed this small canonical documentation repair through existing work item GH-41.
The fresh original-query rerun and actual command execution verified the repaired discovery guidance without increasing the occurrence count.
