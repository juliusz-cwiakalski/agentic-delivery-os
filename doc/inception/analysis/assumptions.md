---
id: TOOLING-INCEPTION-ASSUMPTIONS
status: Draft
created: 2026-10-31
last_updated: 2026-11-01
owners: [bootstrapper]
area: risk
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Four-risk assumptions for the M0 remainder, with proposed validation ownership and evidence requirements."
---

# Assumptions: M0 remainder

Gate 2 approved on 2026-11-01 with questions carried forward. Approval accepts
this register for continued inception; it does not validate the hypotheses.

Gate 2 draft. Owner approval ratifies direction; it does not demonstrate user
value, production parity, or an outcome improvement. Status describes evidence
available for this draft, not a scheduled experiment already running.
Evidence basis: HEAD `773f2c9`, integrating `main-tools` `3ebc61f` on
2026-11-01. Merged outcomes and fixture coverage do not validate the hypotheses.

The [north star](../../overview/01-north-star.md) fixes the single-user local
scope and the approved North Star Metric (NSM), owner attention per accepted
delivery. These are decisions, not hypotheses to re-vote here. Their expected
benefits remain assumptions below. In particular, the state-file assumption
that the planning corpus remains canonical is ratified governance, not validated
value evidence. This draft proposes that distinction for later reconciliation.

## Assumptions

Role assignments below are proposals for gate 2. Owner means Juliusz
Ćwiąkalski, product owner and first operator; PM means the lifecycle planning
role; runner and reviewer are the verification roles named in the north star.
One person may cover several roles. Due means a review trigger, not a promised
calendar delivery date.

| ID | Assumption | risk_type | validation_status | Validation method | Proposed owner | Due / review trigger | Available evidence and missing evidence |
|---|---|---|---|---|---|---|---|
| ASM-001 | Replacing repeated probing with status and verify reduces owner attention per accepted change without increasing rework. | value | unvalidated | Compare source-linked pre/post delivery samples, including owner interventions and quality guardrails. | Owner with PM | Collection-contract follow-up approval, then M0 pilot review | GH-186 delivered a PARTIAL proxy baseline, not direct attention or an accepted-delivery denominator. NSM approved at gate 1; no attention outcome series established. See XC-009. |
| ASM-002 | The protected M0 subset relieves the most important current delivery pain before broader automation. | value | unvalidated | Review actual pilot usage, manual fallback frequency, and reasons for bypassing each engine. | Owner | M0 exit review | Roadmap prioritization and journeys support intent; story closure is not evidence of relief. |
| ASM-003 | One bounded digest and classified failures let both the operator and agent caller choose the next safe action. | usability | unvalidated | Replay J1 with an operator and an agent caller; record misunderstood, missing, or truncated evidence and required manual probes. | Owner with reviewer | Pilot walkthrough follow-up | GH-175 status bounds/counts/truncation and GH-176 bounded tri-state ready-set are implemented. Mechanical output evidence does not supply an observed caller-usability session. |
| ASM-004 | Callers distinguish ledger completeness from merge readiness and a provider park from a blocked delivery. | usability | unvalidated | Include incomplete ledger, stale CI, unknown comments, and parked-provider tasks in the pilot review. | Reviewer with PM | GH-178 implementation acceptance, before automated gate consumption | Delivered ledger/provider specs and GH-178's planning spec define the distinctions; the gate command is not runnable. Definitions and fixtures do not prove caller comprehension. |
| ASM-005 | Merged engines can run beside the authoritative shell with comparable evidence and a usable fallback. | feasibility | testing | Per-engine parity replay followed by source-linked pilot records; compare result tokens rather than bare exits. | Runner with reviewer | Every engine acceptance and M0 two-week review | 18 merged story outcomes include doc/config work, not 18 runnable engines. GH-178 is planning-only despite closure; GH-183 remains unmerged. No two-week pilot evidence established. |
| ASM-006 | Remaining M0 closeout and conformance can be delivered without pretending read-only clients support writes. | feasibility | unvalidated | Capability-to-flow review for every mutation and sandbox test, with visible unsupported operations. | PM with coder and reviewer | GH-183 final delivery and write-evidence review | GH-189 delivers capability honesty and read-only live infrastructure, not mutations. GH-183 names GitHub/Jira write implementations and GitLab gaps in unmerged code; final merged capability/replay evidence remains required. See XC-005. |
| ASM-007 | Parallel delivery updates and inception drafts can be reconciled without semantic loss at shared doc and contract hotspots. | feasibility | testing | Re-read affected specs after each merge; strict frontmatter parsing and combined-content review before each gate. | Bootstrapper with reviewer | Every integration update and inception gate | Glossary/state frontmatter now passes strict duplicate-key checks; an identical Empty-but-enforced glossary row remains duplicated and 18 doc-membership failures persist. See XC-011/012. |
| ASM-008 | A solo operator can sustain the local toolchain and its evidence obligations without a hosted dependency. | viability | unvalidated | Record local setup/maintenance effort and pilot operating friction; check local completeness before release. | Owner | M0 retrospective, then milestone boundaries | Local-only scope is approved; no measured maintenance budget or sustainability result supplied. |
| ASM-009 | Dependency policy remains maintainable as the runtime closure grows. | viability | testing | Re-run license audit and negative controls on dependency changes; reconcile explicit owner determination evidence. | Owner with reviewer | Owner determination review and every lockfile change | GH-187 hardening is merged: schema v3, deny precedence and negative controls. Mechanical enforcement does not establish continuing policy suitability or human determination; registry wording still distinguishes proposed verdicts from owner confirmation. |
| ASM-010 | The first pilot supplies enough independent evidence to reject false success rather than merely repeat the same ledger assertion. | feasibility | unvalidated | Compare ledger results with pushed SHA, actual jobs, tracker/PR artifacts, divergence records, and manual incident review. | Runner with reviewer | Pilot protocol approval and M0 exit | GH-177 is deliberately ledger-only; GH-178's closed planning-only outcome does not supply runnable gates. GH-189's capability-aware mocks/read-only live tier do not establish a clean pilot or live write parity. |

## Summary by risk type

| risk_type | Count | validated | testing | unvalidated | invalidated |
|---|---|---|---|---|---|
| value | 2 | 0 | 0 | 2 | 0 |
| usability | 2 | 0 | 0 | 2 | 0 |
| feasibility | 4 | 0 | 2 | 2 | 0 |
| viability | 2 | 0 | 1 | 1 | 0 |

## Validate first

1. ASM-006 and ASM-010: an unimplemented write or a ledger-only success can
   invalidate the end-to-end relief promise despite green isolated tests.
2. ASM-001: ceremony time and cycle time are useful proxies but do not directly
   measure owner attention. Approve the measurement contract before collecting
   a baseline that cannot answer the NSM question.
3. ASM-003 and ASM-004: trustworthy output still fails if callers cannot act on it.

Inception captures validation plans and available evidence; it does not claim to
have conducted operator research or a production pilot. See [risks](risks.md),
[coverage](phase-2-scope-and-coverage.md), and
[gate questions](../open-questions/phase-2-open-questions.md).
