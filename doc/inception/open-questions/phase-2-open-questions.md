---
id: TOOLING-INCEPTION-PHASE-2-QUESTIONS
status: Draft
created: 2026-10-31
last_updated: 2026-11-02
owners: [bootstrapper]
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Gate 2 decisions on M0 evidence, proposed coverage refinements, and deferred permanent graduation."
---

# Phase 2 open questions

IDs continue OPEN-Q1 through OPEN-Q6. Gate 2 was explicitly approved on
2026-11-01 with the documented questions carried forward to later review.
This authorizes Phase 3, not the proposed substantive answers or repair routes.
Evidence reconciled at HEAD `773f2c9`, integrating `main-tools` `3ebc61f`.
The requested end-only review preference does not supply gate 2 approval or
complete later phases. Delivery evidence below resolves factual premises only;
The questions below are DEFERRED, not answered or silently resolved.

## OPEN-Q7: M0 remainder and outcome-validation protocol

**Status:** DEFERRED (owner approved Gate 2 with questions carried forward)

**Evidence resolution:** 18/20 merged story outcomes, including doc/config-only
deliveries, are supported; this is not 18 runnable engines. The tracker also
has 18/20 CLOSED, but the sets differ. GH-177 is implemented and OPEN;
GH-178 is CLOSED with planning/readiness artifacts only, no runnable gate
command. GH-183 is OPEN with unmerged implementation/review evidence and
unfinished final lifecycle fields. See the
[M0 remainder view](../analysis/phase-2-scope-and-coverage.md) for source boundaries.

**Human choices:** approve that view, [assumptions](../analysis/assumptions.md),
and [risks](../analysis/risks.md), including proposed ownership and triggers?
Choose a normal-delivery route for GH-177 tracker reconciliation, GH-178
implementation/status reconciliation and GH-183 completion. No issue-state
change or implementation completion is authorized by this evidence refresh.
Confirm the route for recording human acceptance or adjustment of the existing
Proposed ADR-0008/0009 and ODR-0002/0003; their merge is not that acceptance.

For XC-010, who owns the M0 pilot protocol and its explicit AC: an existing
story amendment or a dedicated follow-up? Per-engine eligible paths, exposure
counts and comparison/log evidence need an operational protocol. The two-week
M0 window and shell authority are already documented; owner decides how failures
affect the observation window. No clean period is claimed here.

### Evidence reconciliation

- **Documented direction:** Accepted [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md)
  C-8/DEC-6/7 fixes parity, clean observation, rollback, owner sign-off and one
  active writer; the [roadmap](../../planning/oss-tooling/roadmap.md) fixes M0's
  two-week dual-run observation. These are not new owner choices.
- **Engineering verification or repair routing:** reconcile GH-177/178/183
  delivery evidence and assemble the per-engine pilot evidence.
- **Human decision:** protocol owner/home, failure-window handling and distinct
  acceptance of Proposed records remain. See the [consolidated reconciliation](../analysis/open-question-reconciliation.md).

### Answer

Pending owner review.

## OPEN-Q8: direct owner-attention measurement

**Status:** DEFERRED (owner approved Gate 2 with questions carried forward)

**Evidence resolution:** GH-186 delivered the
[baseline contract](../../spec/features/feature-measurement-baseline.md) and
[canonical log](../../planning/oss-tooling/measurement-baseline.yaml), overall
`PARTIAL`. The four metrics are duration/cycle proxies, a CI session proxy and
a curated incident count. None directly measures the approved NSM, owner
attention per accepted delivery, or supplies its accepted-delivery denominator.

**Human choices:** approve and route a recommended lightweight manual collection
contract for interventions or attention time, acceptance boundary, missing data,
sampling window and quality/rework guardrails (XC-009)? This is a follow-up
recommendation, not an amendment treating closed GH-186 as pending. No ticket,
threshold, sample size or automated measurement scope is created here.

### Evidence reconciliation

- **Documented direction:** the baseline distinguishes proxies from direct
  owner attention; closed GH-186 need not be reopened to establish that fact.
- **Engineering verification or repair routing:** draft direct collection
  against the [measurement contract](../../spec/features/feature-measurement-baseline.md).
- **Human decision:** collection ownership, accepted-delivery denominator,
  sampling/missing-data protocol and quality/rework guardrails remain.

### Answer

Pending owner review.

## OPEN-Q9: route the concrete coverage gaps

**Status:** DEFERRED (owner approved Gate 2 with questions carried forward)

**Evidence resolutions:**

- XC-005: GH-189 implements capability-gated conformance with explicit gaps.
  Live v1 is read-only; it does not deliver mutations or prove live write parity.
  GH-183 names GitHub/Jira write paths and GitLab gaps in its unmerged work.
- XC-007: GH-175 implements status budgets, counts and visible truncation;
  GH-176 delivers a bounded ready-set. The mechanical output gap is resolved.
  Caller usability/actionability remains unmeasured.
- XC-008: GH-187 implements schema-v3 license policy, deny precedence and
  negative controls. Owner determination is distinct; the registry still
  describes proposed verdicts pending PR-review confirmation.

**Human choices:** route the remaining work through delivery follow-ups or
explicitly defer with rationale:

- XC-005/XC-003: verify GH-183's final merged write capabilities and interrupted
  replay/artifact/unknown-mutation evidence before treating closeout as delivered.
- XC-007: assign an operator/agent pilot walkthrough, rather than reopen the
  fulfilled output-budget question as if GH-175 were still pending.
- XC-008: identify explicit owner determination evidence and any acceptance
  reconciliation needed; do not infer it from GH-187 closure or audit success.
- XC-013: local completeness is already required by M4-S6; choose only whether
  to advance a validation check into M0, not whether local function is complete.

No new AC refinement is presumed for closed GH-175/GH-189/GH-187. No issue,
status, dependency or canonical AC was edited.

### Evidence reconciliation

- **Documented direction:** [M4-S6](../../planning/oss-tooling/backlog.md#m4-s6-extension-hooks-open-source-side)
  already requires complete local function with no remote service configured.
  Existing capability/output/license contracts need no redundant product vote.
- **Engineering verification or repair routing:** verify write/replay evidence,
  caller actionability and explicit determination evidence, without inferring
  live write parity or legal approval from mechanical success.
- **Human decision:** pilot ownership, earlier validation sequencing and actual
  license determination remain; see [residual groups](../analysis/open-question-reconciliation.md#four-residual-human-review-groups).

### Answer

Pending owner review.

## OPEN-Q10: approve deferred tribal-knowledge graduation

**Status:** DEFERRED (owner approved Gate 2 with questions carried forward)

Approve the [13-item audit and proposed destinations](../analysis/tribal-knowledge-graduation.md)?
Proposed route: phase 4 glossary navigation plus thin UL pointing to concept
and spec owners, keeping primitive definitions in the catalogue. TK-09 is
corrected to distinguish profile from profile class. Already housed facts
need no duplicated rules or decisions. TK-05's unsupported shared-hotspot union
convention does not graduate. TK-03 remains owner-facing, run-specific
punctuation direction, not a project-wide writing rule proposal.

**Evidence resolution:** ADR-0008/0009 and ODR-0002/0003 now exist through
GH-186, all `Proposed`, with null decision dates. Reconcile those homes later;
do not create duplicate historical seeds or infer owner acceptance from merge.
GH-204's memory kernel is delivered framework input for phases 4/5, not this
run's completed graduation or framework-integration review.

This approves a later writing plan, not a claim permanent homes were updated.

### Evidence reconciliation

- **Documented direction:** the [primitive catalogue](../../planning/concepts/primitive-catalogue.md)
  owns primitive meaning/inventory; the Draft [model-profile concept](../../planning/concepts/model-profiles.md)
  separates profile from class. Draft [autonomy](../../planning/concepts/software-delivery-autonomy.md)
  distinguishes capability from human-granted authority; none implies new grants.
- **Engineering verification or repair routing:** use the [exact Phase 4 delta](../analysis/phase-4-glossary-graduation.md)
  for thin reader navigation, preserving planned-versus-delivered labels.
- **Human decision:** bounded graduation writes remain Q18; existing Proposed
  decision acceptance remains Q12. No new punctuation or union policy is sought.

### Answer

Pending owner review.

## OPEN-Q11: route observed integration-document defects

**Status:** DEFERRED (owner approved Gate 2 with questions carried forward)

**Evidence resolution (XC-011):** strict frontmatter parse and recursive duplicate-key
checks now pass for the glossary and state spec. `Domain kind` appears once.
Two identical `Empty-but-enforced` rows remain in the glossary (lines 54/194);
the earlier conflicting-row/invalid-frontmatter description is obsolete.

**Human choices:** route the remaining glossary deduplication and stale-analysis
reconciliation through delivery, or explicitly authorize later bounded writes
to those existing homes? Keep combined-content review, without inventing a
global merge-union rule. This refresh authorizes only the named phase 2 drafts.

The original mined record and repo-analysis statements about graduation and
missing license enforcement also need later reconciliation if those analysis
records are maintained; their corrections are documented in the refreshed drafts.
Only the authorized phase 2 drafts are refreshed here; permanent homes remain
outside this write scope.

The forbidden-literal scan still reports 18 unregistered-document membership
failures across inception and the north star, with zero literal violations.
Approve an owner-selected registry/classification update route before claiming
the branch's gates green? The registry is outside this drafting allowlist and
was not edited. This is a membership failure; unregistered docs are not thereby
certified as scanned/clean. No branch-wide green-gate claim is made.

### Evidence reconciliation

- **Documented direction:** these are bounded maintenance defects, not a new
  architecture or global merge convention.
- **Engineering verification or repair routing:** recheck current membership
  counts before repair; the Phase 4 baseline reports a later count than 18.
  Historical counts above are not a fresh gate result.
- **Human decision:** permission for exact existing-home/registry writes or
  their normal-delivery route remains; this reconciliation grants neither.

### Answer

Pending owner review.
