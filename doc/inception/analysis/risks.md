---
id: TOOLING-INCEPTION-RISKS
status: Draft
created: 2026-10-31
last_updated: 2026-11-01
owners: [bootstrapper]
area: risk
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "M0 four-risk assessment and pre-mortem, with proposed mitigation owners and review triggers."
---

# Risks: M0 remainder

Gate 2 approved on 2026-11-01 with questions carried forward. Proposed
mitigation assignments and evidence requirements remain subject to that review.

Gate 2 draft. Likelihood, impact, and residual ratings are qualitative judgments,
not incident measurements. Owners are proposed project roles as defined in the
[assumption register](assumptions.md). Mitigations are review proposals unless
the linked current spec or check establishes existing behavior.
Evidence basis: HEAD `773f2c9`, integrating `main-tools` `3ebc61f` on
2026-11-01. Ratings remain proposals; merged controls do not establish outcomes.

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
| RSK-001 | M0 reduces agent ceremony but not owner attention. | value | high | high | GH-186's delivered PARTIAL baseline is proxy evidence. Recommend a direct attention/accepted-delivery collection-contract follow-up; review bypasses and rework (XC-009). | Owner with PM | medium, outcome still needs pilot evidence |
| RSK-002 | Operator or agent misreads bounded output, parks, or a complete ledger as permission to merge. | usability | medium | high | Status/ready-set bounds are implemented; perform J1 caller walkthroughs. Keep ledger-only results distinct from merge gates; GH-178 is closed planning-only and needs runnable implementation (XC-001, XC-007). | Reviewer with Owner | medium, caller behavior untested |
| RSK-003 | Authority transfers before parity, or an idle pilot is reported as zero false success. | feasibility | medium | high | Keep shell authoritative; define eligible paths, exposure count, divergence log, and two-week window before interpreting M0 exit (XC-010). Compare tokens for GH-177's documented exit divergence. | Runner with reviewer | medium, no pilot window established here |
| RSK-004 | Closeout or conformance needs mutations absent from current seeds. | feasibility | high | high | GH-189 explicitly skips unsupported operations and keeps live runs read-only. GH-183 names GitHub/Jira writes and GitLab gaps in unmerged work; verify final production composition, restart convergence and artifact evidence before integration claims (XC-005). | PM with coder | high until merged capability evidence is verified |
| RSK-005 | A shared metadata/contract merge loses one engine's truth while isolated checks stay green. | feasibility | high | high | Review combined content and strictly parse metadata after integration; propose targeted doc correction with both engines represented (XC-011). | Bootstrapper with reviewer | medium after actual correction and recheck |
| RSK-006 | Private content or secret-bearing evidence enters committed output. | viability | medium | high | Credential boundary/output redaction and GH-184 merged guard/emitter controls are implemented; review public-safe evidence on schema/content changes (XC-004). | Reviewer with Owner | medium, implemented controls do not eliminate future leakage |
| RSK-007 | License policy drift or ambiguous owner determination blocks safe dependency growth. | viability | medium | high | GH-187 schema-v3 hardening, deny precedence and negative controls are implemented. Reconcile human determination separately from mechanical approval fields and issue closure (XC-008). | Owner with reviewer | low to medium after ratification; future drift remains |
| RSK-008 | Local maintenance and evidence chores outweigh relief for one operator. | viability | medium | medium | Capture setup/maintenance friction and cost alongside baseline; retain engine-by-engine fallback; reassess scope at milestone retrospectives. | Owner with PM | medium until sustained use |
| RSK-009 | Broad principles hide missing acceptance criteria, so restart safety or output bounds are assumed rather than verified. | usability | medium | high | Status output bounds are mechanically established. Review multi-step closeout replay/artifacts and caller actionability separately; neither fixture counts nor closed issues establish those outcomes (XC-003, XC-007). | PM with reviewer | medium pending merged restart evidence and user validation |

## Evidence and review triggers

| Risk IDs | Required validation evidence | Review trigger / decision |
|---|---|---|
| RSK-001, RSK-008 | Source-linked before/after owner interventions or attention time, accepted-change count, rework, costs, maintenance notes; missing data explicit. | Collection-contract follow-up and each milestone retrospective; retain, narrow, or reprioritize scope. |
| RSK-002, RSK-009 | Caller walkthrough records, classified failure cases, implemented gate evidence, restart replay with external artifacts. Status bound checks already have code/fixture support. | Pilot walkthrough, GH-178 implementation reconciliation and GH-183 final acceptance; do not treat prose coverage as passed validation. |
| RSK-003 | Two weeks of pilot records with path exposure, token-level comparisons, incidents and divergences, cited SHA/job/tracker facts. | M0 exit; any false success requires remediation and owner review of the evidence window. Window reset policy is proposed, not pre-decided. |
| RSK-004 | Final merged closeout capability matrix, interrupted-operation replay and sandbox/artifact results. GH-189 already implements explicit capability skips; no live writes are implied. | GH-183 final delivery review; unresolved capability/dependency choices return to owner. |
| RSK-005 | Strict metadata parse now passes for glossary/state; identical Empty-but-enforced duplicate row and 18 doc-membership failures remain. Require combined-content review and bounded repair. | Every integration update, gate 2 routing and later phase 6 consistency check. |
| RSK-006 | GH-184 merged guard/emitter implementation and committed negative controls, plus credential/redaction controls. | Coverage is implemented; recheck on evidence-schema changes rather than treating GH-184 as pending. |
| RSK-007 | Implemented audit/deny-case coverage, explicit owner determination evidence and documented scope. | Human determination reconciliation and every dependency update; closed GH-187 is not itself acceptance evidence. |

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
