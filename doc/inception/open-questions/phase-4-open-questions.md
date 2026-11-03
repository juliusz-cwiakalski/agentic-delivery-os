---
id: TOOLING-INCEPTION-PHASE-4-QUESTIONS
status: Draft
created: 2026-11-02
last_updated: 2026-11-02
owners: [bootstrapper]
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Deferred Gate 4 questions reconciled with documented setup direction, bounded glossary authority and CI repair routing."
---

# Phase 4 open questions

## Reopening exit, 2026-11-02

OPEN-Q20 authorizes the exact B1/B3/B4 remediation, now written. The glossary
delta is applied; integrated main-tools had already removed the identical duplicate.
The quality baseline records explicit profile exemption and contributor/environment
equivalent homes, without a dotenv loader or mandatory environment example.
All 37 memberships were registered; the guard then exposed 11 literal failures
in six existing documents. RESOLVED: commit `dde826a` completed the
classification (all post-baseline inception records registered) and reworded
the eleven literal sites to seam-derived descriptions without touching guard
pins; the guard reports zero violations and Phase 6 records READY-B1 cleared.
The paragraph above is retained as the historical routing record.
This is carried OPEN-Q11 routing, not a new product decision. Q17..19 remain
DEFERRED for residual subparts; their original Answer sections are preserved.

IDs continue at OPEN-Q17. OPEN-Q7..Q16 remain DEFERRED with their existing
answers pending; no demand to resolve them now is implied. Gate 4 was approved
on 2026-11-02 with OPEN-Q17..19 carried forward as DEFERRED, not answered.
Proceeding to Phase 5 does not authorize substantive decision acceptance or
glossary/registry repairs. See the [evidence reconciliation](../analysis/open-question-reconciliation.md).

## OPEN-Q17: dev-setup and environment-reference applicability

**Status:** DEFERRED (owner approved Gate 4 with questions carried forward)

The [quality baseline](../analysis/phase-4-quality-baseline.md#development-installation-and-environment-baseline)
finds no dedicated dev-setup guide or `.env.example`; existing installation docs
describe the framework, not a mounted typed executable. Inspected config paths
consume environment facts/references without demonstrated dotenv loading.
Recommend a later scoped contributor setup guide plus a value-free environment
reference linked to existing configuration and workflow documentation, without
adding dotenv auto-loading or requiring a `.env.example`. This is a bounded
documentation recommendation, not a ratified new artifact requirement or a
reopening of composition/platform/local-completeness choices in OPEN-Q13/14/16.
No environment values or credential material should be placed in the answer.

### Evidence reconciliation

- **Documented direction:** config consumes injected environment facts and
  credential references; environment-only credentials do not imply dotenv loading.
- **Engineering verification or repair routing:** link existing pins, script
  order, [config contract](../../spec/features/feature-config-layer.md) and
  optional [live workflow](../../../.github/workflows/conformance-live.yml).
  Describe actual composition limits, not a delivered typed executable.
- **Human decision:** authorize that bounded documentation scope if desired;
  shared-guide writes remain outside this reconciliation's authority.

### Answer

Pending owner review.

## OPEN-Q18: disposition of the exact glossary delta

**Status:** DEFERRED (owner approved Gate 4 with questions carried forward)

Unlike OPEN-Q10's broad graduation proposal and OPEN-Q11's repair routing, the
[Phase 4 draft](../analysis/phase-4-glossary-graduation.md) now supplies an exact
bounded delta: seven missing reader-term rows, no ceremony-share rewrite, and
deletion of only the identical Empty-but-enforced row under Acronyms. Should
these exact edits be authorized in a later bounded write, narrowed, or remain
queued under the existing delivery route? This does not authorize wider glossary
cleanup, stale-analysis edits or registry writes. The existing glossary remains
untouched until explicit permission; draft UL navigation is not full graduation.

### Evidence reconciliation

- **Documented direction:** canonical meanings already exist in the catalogue,
  concepts and Accepted ADR-0003; reader navigation is not a new policy.
- **Engineering verification or repair routing:** verify seven additions and
  removal of the identical Acronyms row only, retaining combined content.
- **Human decision:** exact-edit permission remains necessary. Approval to
  proceed does not authorize these edits, wider repairs or registry writes.

### Answer

Pending owner review.

## OPEN-Q19: shell-suite CI failure propagation

**Status:** DEFERRED (owner approved Gate 4 with questions carried forward)

The [new concrete finding](../analysis/phase-4-quality-baseline.md#ci-baseline-and-concrete-failure-propagation-finding)
shows `find -exec` can return zero when a suite child fails, so outer `set -e`
does not enforce the stated fail-fast contract. Route a separately scoped
delivery repair for status aggregation and a synthetic failing-suite control
before relying on that job as evidence. Recommend explicit child-status
aggregation with a negative control, not suppression or a new broad framework.
No actual repository suite failure or workflow modification is claimed here.

### Evidence reconciliation

- **Documented direction:** Accepted [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md)
  C-8 requires binding, non-weakened running gates; failed suites must fail CI.
- **Engineering verification or repair routing:** [CI](../../../.github/workflows/ci.yml)
  still uses `find -exec ... \;`. Fix propagation and verify a synthetic failing
  child through normal delivery. This objective is not a product-policy vote.
- **Human decision:** scheduling/write authorization only, if needed; neither
  this finding nor Gate 4 approval authorizes a workflow edit in this run.

### Answer

Pending owner review.
