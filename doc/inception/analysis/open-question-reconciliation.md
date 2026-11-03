---
id: TOOLING-INCEPTION-OPEN-QUESTION-RECONCILIATION
status: Draft
created: 2026-11-02
last_updated: 2026-11-02
owners: [bootstrapper]
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Evidence reconciliation of OPEN-Q7..19: documented direction, engineering routing and residual human decisions."
---

# Open-question reconciliation

## Authority and reading rule

The owner approved proceeding after Gate 4 on 2026-11-02 with unresolved
questions carried forward. OPEN-Q7..19 remain **DEFERRED**, not answered.
This reconciliation preserves the original IDs and human Answer sections.
It authorizes no decision acceptance, glossary, registry, source or framework
repair. Source presence establishes direction, not implementation or approval.
Only public canonical evidence is cited; proposals are not ratified by citation.

## Canonical evidence and status

- [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md) is **Accepted**.
  C-5/C-8 and DEC-6/7 require per-engine parity, a clean observation window,
  rehearsed rollback and owner sign-off. Mutating replacements stay shadow or
  read-only until transfer; a guard disables the inactive writer path. The bash
  body remains a rollback target for two milestones, then rollback is reinstall-only.
  These safeguards need evidence, not another product-direction vote.
- [Roadmap](../../planning/oss-tooling/roadmap.md) defines the M0 dual-run pilot
  and two-week false-success observation, with shell authority retained.
  [M0-S1](../../planning/oss-tooling/backlog.md#m0-s1-monorepo-scaffold-and-toolchain)
  already names one `createRuntime`; its declaration in
  [core](../../../packages/core/src/index.ts) is not an implementation.
  [M4-S6](../../planning/oss-tooling/backlog.md#m4-s6-extension-hooks-open-source-side)
  already requires complete local function without a configured remote service.
  Earlier validation is sequencing, not a reopened local-first choice.
- [Primitive catalogue](../../planning/concepts/primitive-catalogue.md),
  [model profiles](../../planning/concepts/model-profiles.md) and
  [autonomy](../../planning/concepts/software-delivery-autonomy.md) are **Draft
  concepts**. They distinguish primitives from commands, profiles from classes,
  and capability from delegated authority. They do not prove delivered model
  selection, frozen class names or authority grants.
- [Measurement baseline](../../spec/features/feature-measurement-baseline.md)
  documents proxies, not direct owner attention per accepted delivery.
  [Decision reconciliation](phase-3-decision-reconciliation.md) identifies twelve
  Proposed tooling records; merge does not accept them. ADR-0003 C-2/C-11 keep
  human license determination and privacy sign-off distinct from mechanical gates.
- [Privacy guard](../../spec/features/feature-privacy-guard.md#authoring-mode)
  documents local stdin-only authoring, CI refusal, digest-only output and no
  repository writes. Its production hashed classes remain empty. Generic and
  synthetic coverage is not configured private-literal coverage.
  [TDR-0006](../../decisions/TDR-0006-privacy-and-no-cloud-guard-mechanics.md)
  remains **Proposed**, not accepted by this reconciliation.
- [YAML parser](../../../packages/adapters/src/file/yaml-parser.ts) and
  [pm-notes parser](../../../packages/adapters/src/file/pm-notes-parser.ts) compare
  `text.length` against `MAX_SOURCE_BYTES`. Reconcile byte-named limits with
  UTF-8 behavior and multibyte controls; do not silently redefine the contract.
- [CI](../../../.github/workflows/ci.yml) promises failing shell suites fail the
  job, but `find -exec ... \;` does not aggregate child failure. The
  [quality baseline](phase-4-quality-baseline.md#ci-baseline-and-concrete-failure-propagation-finding)
  records the read-only control. Bindingness is already required by ADR-0003
  C-8: status propagation is a technical repair, not a product-policy vote.

## Subpart dispositions by original question

Labels classify subparts, not whole-question completion. Every row retains
DEFERRED status where residual decisions, authorization or verification remain.

| Question | Documented direction | Engineering verification or repair routing | Human decision |
|---|---|---|---|
| OPEN-Q7 | Dual-run, two-week M0 observation, parity, rollback and one active writer already specified. | Verify actual delivery/closeout and tracker evidence for GH-177/178/183; assemble per-engine exposure, divergence and rollback evidence. | Pilot owner, protocol/AC home, failure-window handling; Proposed-record acceptance stays separate. |
| OPEN-Q8 | NSM differs from delivered duration/CI/incident proxies. | Design lightweight direct collection without relabeling GH-186. | Acceptance denominator, sampling/missing-data and quality/rework guardrails, collection ownership. |
| OPEN-Q9 | Capability-qualified conformance, bounded output, license enforcement and M4-S6 local completeness have homes. | Verify merged mutation/replay evidence, caller walkthrough and explicit license determination evidence. | Pilot ownership; whether to advance local-completeness validation; actual license determination, not reapproval of output budgets. |
| OPEN-Q10 | Catalogue, model-profile/class and migration meanings already have canonical homes. | Thin navigation and exact glossary delta are drafted; verify current/planned distinctions. | Bounded graduation authorization with Q18; punctuation remains owner-facing/run-specific, no global rule or union policy proposal. |
| OPEN-Q11 | Duplicate-row and document-membership defects are maintenance, not new architecture. | Recheck current counts, stale analysis and decision navigation before scoped repair. | Exact existing-home/registry write authorization or normal delivery route. |
| OPEN-Q12 | Accepted ADR-0003 and existing Proposed records eliminate redundant foundational seeds. | Verify record metadata/index links; retain existing homes. | Record-specific acceptance and review route; privacy/license approvals remain distinct. |
| OPEN-Q13 | Shared `createRuntime` and thin surfaces are already the accepted design and M0-S1 task. | Reconcile declaration-only scaffold with story scope; route production wiring, executable mounting and artifact-backed host smoke. | Only any actual scope/sequencing change, not reselection of the shared-core design. |
| OPEN-Q14 | Feature budgets, runtime neutrality and platform-qualified permissions are documented requirements. | Real platform/ACL, contention, growing-ledger and full-command evidence remains unverified. | Supported OS/runtime commitments and reference environment, not an invented global SLO. |
| OPEN-Q15 | Guard authoring procedure exists; byte naming does not establish byte enforcement. | UTF-8 boundary repair/controls; public-safe configured-coverage activation evidence. | Private-side coverage ownership/population or explicit gap disposition; registry writes need permission. |
| OPEN-Q16 | Owning feature contracts and M4-S6 remain authoritative. | Route proposed NFR validations to existing contracts; no duplicate ticket or new threshold. | Approve/narrow/defer additional validation scope; pilot and early-check choices remain Q7..9. |
| OPEN-Q17 | Existing config consumes environment facts/references; no demonstrated dotenv auto-loading. | Recommend contributor setup plus a value-free environment reference linked to existing pins/scripts/config/live workflow, not a new loader. | Authorize bounded documentation work if desired; no need to reopen composition or platform choices. |
| OPEN-Q18 | Exact seven additions and one identical-row deletion are drafted; meanings have homes. | Verify exact delta and retain combined content. | Explicit permission for those edits remains necessary; no wider cleanup or registry authority. |
| OPEN-Q19 | Binding shell gates are already required. | Repair child-status propagation and prove it with a synthetic failing-suite control through scoped delivery. | Scheduling/write authorization only; no vote on whether failed suites should fail CI. |

## Four residual human-review groups

1. **Pilot and outcome protocol (Q7/8/9/16):** assign ownership and evidence home;
   settle direct-attention collection, acceptance boundary, guardrails and
   failure-window handling. Existing migration safeguards stay fixed.
2. **Acceptance, privacy and license approvals (Q7/9/12):** select the review
   route and explicitly accept or adjust individual Proposed records; record
   distinct C-11 privacy sign-offs and dependency-license determinations.
3. **Bounded documentation authorization (Q10/11/12/17/18):** authorize exact
   glossary/navigation/setup and separately bounded registry/stale-analysis
   repairs, or retain normal delivery. No global punctuation/union rule follows.
4. **Privacy coverage and support commitments (Q14/15/16):** choose configured
   coverage ownership/gap disposition and support/reference-environment scope.
   Local completeness is already direction; any earlier check is sequencing.

Engineering work can be routed without asking the owner to decide these settled
technical objectives again. This draft creates no ticket, changes no AC or
status, and claims no clean pilot, platform certification or green gate battery.
