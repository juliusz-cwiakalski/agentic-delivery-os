---
id: TOOLING-INCEPTION-RISKS
status: Draft
created: 2026-10-31
last_updated: 2026-10-31
owners: [bootstrapper]
area: risk
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "M0 four-risk assessment and pre-mortem, with proposed mitigation owners and review triggers."
---

# Risks: M0 remainder

Gate 2 draft. Likelihood, impact, and residual ratings are qualitative judgments,
not incident measurements. Owners are proposed project roles as defined in the
[assumption register](assumptions.md). Mitigations are review proposals unless
the linked current spec or check establishes existing behavior.

## Pre-mortem: six months after a disappointing M0

The packages shipped, but the owner still reread every ticket and pipeline.
Ledger completion was mistaken for merge readiness, and synthetic fixture
success was treated as proof of provider behavior. Closeout stalled on write
capabilities the read slices never promised. The pilot's quiet two weeks were
reported as zero incidents without recording how many paths actually ran.
Meanwhile proxy metrics improved while human interruptions increased. Parallel
doc merges left contradictory definitions that callers silently resolved in
different ways. Local upkeep and expanding evidence chores consumed the relief.

This is a hypothetical failure narrative, not a report of observed incidents.
It challenges the assumption that completing stories automatically achieves the
approved outcome. The mitigations below make the failure modes reviewable.

## Register

| ID | Risk | risk_type | Likelihood | Impact | Mitigation / coverage | Proposed owner | Residual after mitigation |
|---|---|---|---|---|---|---|---|
| RSK-001 | M0 reduces agent ceremony but not owner attention. | value | high | high | Define a direct attention measure and accepted-delivery denominator at GH-186; review bypasses and rework, not only output counts (XC-009). | Owner with PM | medium, outcome still needs pilot evidence |
| RSK-002 | Operator or agent misreads bounded output, parks, or a complete ledger as permission to merge. | usability | medium | high | J1 failure-path review; keep ledger-only and gate verdicts distinct; require cited gate evidence at GH-178 (XC-001, XC-007). | Reviewer with Owner | medium, caller behavior untested |
| RSK-003 | Authority transfers before parity, or an idle pilot is reported as zero false success. | feasibility | medium | high | Keep shell authoritative; define eligible paths, exposure count, divergence log, and two-week window before interpreting M0 exit (XC-010). Compare tokens for GH-177's documented exit divergence. | Runner with reviewer | medium, no pilot window established here |
| RSK-004 | Closeout or conformance needs mutations absent from current seeds. | feasibility | high | high | Resolve write-capability ownership at GH-183/GH-189 readiness; reject implied support, or explicitly approve a dependency/scope change (XC-005). | PM with coder | high until capability plan accepted |
| RSK-005 | A shared metadata/contract merge loses one engine's truth while isolated checks stay green. | feasibility | high | high | Review combined content and strictly parse metadata after integration; propose targeted doc correction with both engines represented (XC-011). | Bootstrapper with reviewer | medium after actual correction and recheck |
| RSK-006 | Private content or secret-bearing evidence enters committed output. | viability | medium | high | Existing credential boundary and output redaction; GH-184 emitter and CI controls; review public-safe evidence before commit (XC-004). | Reviewer with Owner | medium, GH-184 still open |
| RSK-007 | License policy drift or ambiguous owner determination blocks safe dependency growth. | viability | medium | high | Reuse existing fail-closed CI audit; GH-187 reconciles policy, deny cases, scope, and owner review evidence rather than rebuilding it (XC-008). | Owner with reviewer | low to medium after ratification; future drift remains |
| RSK-008 | Local maintenance and evidence chores outweigh relief for one operator. | viability | medium | medium | Capture setup/maintenance friction and cost alongside baseline; retain engine-by-engine fallback; reassess scope at milestone retrospectives. | Owner with PM | medium until sustained use |
| RSK-009 | Broad principles hide missing acceptance criteria, so restart safety or output bounds are assumed rather than verified. | usability | medium | high | Review dedicated AC per concern; flag bounded-digest and multi-step closeout evidence gaps explicitly (XC-003, XC-007). | PM with reviewer | medium pending accepted AC and tests |

## Evidence and review triggers

| Risk IDs | Required validation evidence | Review trigger / decision |
|---|---|---|
| RSK-001, RSK-008 | Source-linked before/after owner interventions or attention time, accepted-change count, rework, costs, maintenance notes; missing data explicit. | GH-186 measurement contract and each milestone retrospective; retain, narrow, or reprioritize scope. |
| RSK-002, RSK-009 | Caller walkthrough records, classified failure cases, bounded-output checks, restart replay with external artifacts. | GH-175/GH-178/GH-183 acceptance; do not treat prose coverage as passed validation. |
| RSK-003 | Two weeks of pilot records with path exposure, token-level comparisons, incidents and divergences, cited SHA/job/tracker facts. | M0 exit; any false success requires remediation and owner review of the evidence window. Window reset policy is proposed, not pre-decided. |
| RSK-004 | Capability matrix naming each closeout mutation and supported implementation; capability-aware conformance plan and sandbox result artifacts. | Before GH-183/GH-189 DoR; unresolved ownership/dependencies return to owner. |
| RSK-005 | Strict metadata parse and a combined spec/glossary diff retaining provider and verify semantics. | Every integration update, gate 2 follow-up, and phase 6 consistency check. |
| RSK-006 | GH-184 merged artifact, firing negative control, emitter scan evidence, credential/redaction controls. | Before claiming privacy coverage delivered; repeat on evidence-schema changes. |
| RSK-007 | Current audit result, negative cases for unregistered/denied licenses, explicit owner determination evidence and documented scope. | GH-187 review and every dependency update. |

## Heat-map priority and assumption links

Highest attention: RSK-001, RSK-004, RSK-005 (high likelihood, high impact).
Other high-impact risks still need evidence before milestone acceptance.

| Risk ID | Assumption IDs | Why linked |
|---|---|---|
| RSK-001 | ASM-001, ASM-002 | Output completion may not buy attention relief. |
| RSK-002 | ASM-003, ASM-004 | Truthful semantics need understandable consumption. |
| RSK-003 | ASM-005, ASM-010 | Parity and independent evidence precede authority. |
| RSK-004 | ASM-006 | Read-only seeds do not imply mutation support. |
| RSK-005 | ASM-007 | Textual merge success does not prove semantic reconciliation. |
| RSK-006 | ASM-008 | Public-safe local operation is part of sustainable OSS use. |
| RSK-007 | ASM-009 | Mechanical enforcement and ratification are different evidence. |
| RSK-008 | ASM-008, ASM-001 | Maintenance can consume the expected relief. |
| RSK-009 | ASM-003, ASM-006 | Cross-cutting promises need explicit testable representation. |

Gate choices and proposed gaps are in [scope and coverage](phase-2-scope-and-coverage.md)
and [open questions](../open-questions/phase-2-open-questions.md).
