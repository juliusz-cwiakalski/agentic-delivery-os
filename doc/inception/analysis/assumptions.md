---
id: TOOLING-INCEPTION-ASSUMPTIONS
status: Draft
created: 2026-10-31
last_updated: 2026-10-31
owners: [bootstrapper]
area: risk
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Four-risk assumptions for the M0 remainder, with proposed validation ownership and evidence requirements."
---

# Assumptions: M0 remainder

Gate 2 draft. Owner approval ratifies direction; it does not demonstrate user
value, production parity, or an outcome improvement. Status describes evidence
available for this draft, not a scheduled experiment already running.

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
| ASM-001 | Replacing repeated probing with status and verify reduces owner attention per accepted change without increasing rework. | value | unvalidated | Compare source-linked pre/post delivery samples, including owner interventions and quality guardrails. | Owner with PM | GH-186 baseline definition, then M0 pilot review | NSM approved at gate 1; no direct attention baseline or outcome series supplied. See XC-009. |
| ASM-002 | The protected M0 subset relieves the most important current delivery pain before broader automation. | value | unvalidated | Review actual pilot usage, manual fallback frequency, and reasons for bypassing each engine. | Owner | M0 exit review | Roadmap prioritization and journeys support intent; story closure is not evidence of relief. |
| ASM-003 | One bounded digest and classified failures let both the operator and agent caller choose the next safe action. | usability | unvalidated | Replay J1 with an operator and an agent caller; record misunderstood, missing, or truncated evidence and required manual probes. | Owner with reviewer | GH-175 acceptance and pilot review | Result contracts exist; no observed end-to-end usability session recorded here. |
| ASM-004 | Callers distinguish ledger completeness from merge readiness and a provider park from a blocked delivery. | usability | unvalidated | Include incomplete ledger, stale CI, unknown comments, and parked-provider tasks in the pilot review. | Reviewer with PM | GH-178 acceptance, before automated gate consumption | Verify and provider specs define the distinctions; definitions and fixtures do not prove caller comprehension. |
| ASM-005 | Merged engines can run beside the authoritative shell with comparable evidence and a usable fallback. | feasibility | testing | Per-engine parity replay followed by source-linked pilot records; compare result tokens rather than bare exits. | Runner with reviewer | Every engine acceptance and M0 two-week review | GH-177 and GH-182 merged; their specs describe offline checks. No two-week pilot evidence established in this draft. |
| ASM-006 | Remaining M0 closeout and conformance can be delivered without pretending read-only clients support writes. | feasibility | unvalidated | Capability-to-flow review for every mutation and sandbox test, with visible unsupported operations. | PM with coder and reviewer | GH-183 and GH-189 readiness | Client-seed spec explicitly gaps writes. Existing dependency lists do not establish a working mutation path. See XC-005. |
| ASM-007 | Parallel delivery updates and inception drafts can be reconciled without semantic loss at shared doc and contract hotspots. | feasibility | testing | Re-read affected specs after each merge; strict frontmatter parsing and combined-content review before each gate. | Bootstrapper with reviewer | Every integration update and inception gate | Local merge contains both new engines; glossary and state-spec metadata already exhibit duplicate-key drift. See XC-011. |
| ASM-008 | A solo operator can sustain the local toolchain and its evidence obligations without a hosted dependency. | viability | unvalidated | Record local setup/maintenance effort and pilot operating friction; check local completeness before release. | Owner | M0 retrospective, then milestone boundaries | Local-only scope is approved; no measured maintenance budget or sustainability result supplied. |
| ASM-009 | Dependency policy remains maintainable as the runtime closure grows. | viability | testing | Re-run license audit and negative controls on dependency changes; obtain explicit policy/verdict reconciliation at GH-187. | Owner with reviewer | GH-187 and every lockfile change | Existing audit and its 13 tests pass locally; that proves current mechanical checks, not continuing policy suitability or owner ratification. |
| ASM-010 | The first pilot supplies enough independent evidence to reject false success rather than merely repeat the same ledger assertion. | feasibility | unvalidated | Compare ledger results with pushed SHA, actual jobs, tracker/PR artifacts, divergence records, and manual incident review. | Runner with reviewer | Pilot protocol approval and M0 exit | GH-177 is deliberately ledger-only. GH-178 and GH-189 remain open; fixtures are not live-provider evidence. |

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
