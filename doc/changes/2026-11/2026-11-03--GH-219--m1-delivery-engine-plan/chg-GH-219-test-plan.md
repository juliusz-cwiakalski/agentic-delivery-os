---
id: chg-GH-219-test-plan
status: Proposed
created: 2026-11-03T05:22:17Z
last_updated: 2026-11-03T05:22:17Z
owners: [engineering]
service: delivery-os-planning
labels: [change]
version_impact: none
summary: "Verify six mutually consistent, sanitized M1 delivery-engine planning documents without asserting runtime delivery."
links:
  change_spec: ./chg-GH-219-spec.md
  implementation_plan: null
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Plan milestone M1: delivery engine and autonomous dispatch

## 1. Scope and Objectives

Verify the six planning deliverables, R1-R12, four binding owner decisions, story and ranking consistency, privacy, and accurate current-versus-planned attribution. These are document reviews, not tests of an implemented engine. Protect M0 history, M3/M4 scope, the pending owner gate, and private operator evidence.

### 1.1 In Scope

Roadmap, backlog, backlog ranking, CLI command registry, sanitized operator requirements input, and milestone status under `doc/planning/oss-tooling/`; manual cross-document review, privacy check, Markdown/link review, and static diff checks.

### 1.2 Out of Scope & Known Gaps

No runtime code, daemon, new tickets, pilot handover, decision-record acceptance, or bash removal is delivered or tested here. Follow-up stories must test runtime contracts and determine exact digest latency, economic resume thresholds, and engine evidence criteria beyond the two-clean-weeks gate. There is no implementation plan at authoring time.

## 2. References

- [Change specification](./chg-GH-219-spec.md), especially sections 5, 8, 9, 15, 17 and 20.
- [Repository testing strategy](../../../../.ai/rules/testing-strategy.md) (repository-root path: `.ai/rules/testing-strategy.md`).
- Planning deliverables: `doc/planning/oss-tooling/{roadmap,backlog,backlog-ranking,cli-command-registry,operator-requirements-2026-11,status}.md`.
- Implementation plan: not present at authoring time; reconcile this test plan if one is added.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| Capability | Acceptance criterion | Scenario | Status |
|---|---|---|---|
| F-1 | AC-F1-1 | TC-M1PLAN-001 | Planned |
| F-1, F-10 | AC-F1-2 | TC-M1PLAN-002 | Planned |
| F-2 | AC-F2-1 | TC-M1PLAN-003 | Planned |
| F-3 | AC-F3-1 | TC-M1PLAN-004 | Planned |
| F-4 | AC-F4-1 | TC-M1PLAN-005 | Planned |
| F-5 | AC-F5-1 | TC-M1PLAN-006 | Planned |
| F-5 | AC-F5-2 | TC-M1PLAN-007 | Planned |
| F-5 | AC-F5-3 | TC-M1PLAN-008 | Planned |
| F-6 | AC-F6-1 | TC-M1PLAN-009 | Planned |
| F-7 | AC-F7-1 | TC-M1PLAN-010 | Planned |
| F-7 | AC-F7-2 | TC-M1PLAN-011 | Planned |
| F-8 | AC-F8-1 | TC-M1PLAN-012 | Planned |
| F-9 | AC-F9-1 | TC-M1PLAN-013 | Planned |
| F-10 | AC-F10-1 | TC-M1PLAN-014 | Planned; PR gate needs owner verification |

Operator mapping: R1-R2 → TC-M1PLAN-005; R3 → TC-M1PLAN-006; R4 → TC-M1PLAN-007; R5 → TC-M1PLAN-008; R6, R7, R11 → TC-M1PLAN-009; R8-R10 → TC-M1PLAN-010; R12 → TC-M1PLAN-011. TC-M1PLAN-013 checks preservation of all twelve priorities and evidence in the sanitized input. Owner decisions DEC-1 → TC-M1PLAN-001, TC-M1PLAN-003, TC-M1PLAN-010; DEC-2 → TC-M1PLAN-002; DEC-3 → TC-M1PLAN-001, TC-M1PLAN-004; DEC-4 → TC-M1PLAN-013.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No API or runtime EVT is introduced by this documentation change. Future question and completion records are planned contracts, not events to exercise now.

| Planned data element | Scenario | Status |
|---|---|---|
| DM-1 delivery plan | TC-M1PLAN-007 | Document review |
| DM-2 gate policy | TC-M1PLAN-005 | Document review |
| DM-3 blocker question | TC-M1PLAN-009 | Document review |
| DM-4 spend observation | TC-M1PLAN-008, TC-M1PLAN-010 | Document review |
| DM-5 planning dependency | TC-M1PLAN-003 | Document review |

### 3.3 Non-Functional Coverage (NFR-#)

| Requirement | Scenario | Status |
|---|---|---|
| NFR-1 six-document completeness | TC-M1PLAN-003, TC-M1PLAN-012, TC-M1PLAN-013 | Planned; inventory all six in section 6 |
| NFR-2 privacy | TC-M1PLAN-013 | Planned |
| NFR-3 story and dependency consistency | TC-M1PLAN-003 | Planned |
| NFR-4 R1-R12 and four successors | TC-M1PLAN-004, TC-M1PLAN-005, TC-M1PLAN-006, TC-M1PLAN-007, TC-M1PLAN-008, TC-M1PLAN-009, TC-M1PLAN-010, TC-M1PLAN-011, TC-M1PLAN-013 | Planned |
| NFR-5 boundary integrity | TC-M1PLAN-001, TC-M1PLAN-002, TC-M1PLAN-003, TC-M1PLAN-014 | Planned |
| NFR-6 publication discipline | TC-M1PLAN-013 | Planned |
| NFR-7 handover safety | TC-M1PLAN-001, TC-M1PLAN-004 | Planned |

## 4. Test Types and Layers

`doc/**` maps to static/diff checks and content checks under the repository testing strategy. All scenarios are manual document reviews at `doc/planning/oss-tooling/`, with the existing privacy-literals check and `git diff --check` supplementing TC-M1PLAN-013. Review Markdown rendering, changed paths and links, story dependencies, and the spec-to-document mapping. No unit, integration, contract, E2E, performance, shell or TypeScript tests apply to this docs-only change; automated behavior tests are N/A. Run the applicable existing documentation quality gates rather than creating test files.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|---|---|---|---|---|---|
| TC-M1PLAN-001 | M1 boundary and handover | Happy Path | Critical | High | AC-F1-1 |
| TC-M1PLAN-002 | M0 pending history | Regression | Critical | High | AC-F1-2 |
| TC-M1PLAN-003 | Story structure and ranking | Regression | Critical | High | AC-F2-1 |
| TC-M1PLAN-004 | Four bash successors | Happy Path | Critical | High | AC-F3-1 |
| TC-M1PLAN-005 | Merge and signal truth | Negative | Critical | High | AC-F4-1 |
| TC-M1PLAN-006 | Scheduling and daemon boundary | Edge Case | Critical | High | AC-F5-1 |
| TC-M1PLAN-007 | Plan schema and artifact joins | Happy Path | Important | High | AC-F5-2 |
| TC-M1PLAN-008 | Session economics and liveness | Edge Case | Important | High | AC-F5-3 |
| TC-M1PLAN-009 | Blockers, digest and brief | Happy Path | Important | High | AC-F6-1 |
| TC-M1PLAN-010 | Closeout, spend and M2 seam | Regression | Important | High | AC-F7-1 |
| TC-M1PLAN-011 | Self-describing commands | Happy Path | Important | Medium | AC-F7-2 |
| TC-M1PLAN-012 | Registry and naming lock | Regression | Critical | High | AC-F8-1 |
| TC-M1PLAN-013 | Sanitized dated evidence | Negative | Critical | High | AC-F9-1 |
| TC-M1PLAN-014 | Owner approval gate | Negative | Critical | High | AC-F10-1 |

### 5.2 Scenario Details

#### TC-M1PLAN-001 - M1 boundary and handover

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-5, NFR-7
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/roadmap.md`, `status.md`
**Tags**: @docs

**Preconditions**:
- The revised roadmap and status are available.

**Steps**:
1. Compare milestone boundaries and handover gates with DEC-1 and DEC-3 in the spec.
2. Check truth-before-daemon sequencing, CEO-controlled merge, local-first one-shot fallback, zero resume-loop exit target, and two clean weeks of evidence per engine and repository.
3. Check qualified pilot authority, bash fallback and deprecation pointers, and M4-S5 removal timing.

**Expected Outcome**:
- M1 is the planned delivery-engine milestone; M2 retains deferred scope, M3/M4 remain, and no parallel pilot waives individual engine evidence or claims immediate handover.

#### TC-M1PLAN-002 - M0 pending history

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-10, AC-F1-2, NFR-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/status.md`, `backlog.md`
**Tags**: @docs

**Preconditions**:
- Baseline M0 history and revised status are available.

**Steps**:
1. Compare M0 story history to the baseline and read the M0 exit language in status.
2. Check concurrent pilot wording, pending dual-run evidence, and owner acceptance of all 13 Proposed records.

**Expected Outcome**:
- No M0 historical story changes; M0 remains open and Proposed records are not silently accepted.

#### TC-M1PLAN-003 - Story structure and ranking

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-5, NFR-1, NFR-3, NFR-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, `backlog-ranking.md`, `roadmap.md`
**Tags**: @docs

**Preconditions**:
- Baseline and revised milestone documents are available.

**Steps**:
1. Inventory every revised M1 story; confirm each has Goal, Tasks, AC and Depends on and enough context for a follow-up ticket.
2. Compare every dependency and rebadged reference between backlog and ranking; trace precedence to rule out cycles and dependencies on absent or later stories.
3. Trace the moved M2-S1 queue, lanes and dispatch dependencies and compare retained M2-M4 content to baseline, allowing only explicit moves or rebadging.

**Expected Outcome**:
- Story identities, dependencies and ranked order agree; graph is acyclic, moved references resolve, and downstream milestone scope is retained.

#### TC-M1PLAN-004 - Four bash successors

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-4, NFR-7
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, `roadmap.md`
**Tags**: @docs

**Preconditions**:
- Revised M1 stories and roadmap are available.

**Steps**:
1. Locate explicit M1 successors for `deliver-ticket.sh` per-ticket dispatch/lifecycle, `batch-deliver.sh` queue/dependency batch, `ceo-loop.sh` daemon/CEO coordination, and `pm-liveness.sh` progress-based liveness.
2. Check each mapping names qualified handover evidence and keeps bash fallback through M1; verify removal is M4-S5.

**Expected Outcome**:
- Four of four functions have identifiable successor stories, without a claim that replacement is already delivered.

#### TC-M1PLAN-005 - Merge and signal truth

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-2, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, `roadmap.md`
**Tags**: @docs

**Preconditions**:
- R1/R2-aligned merge and signal stories are available.

**Steps**:
1. Check versioned gate-set data, fresh tracker and CI evidence, owner-gate classification, recorded waivers, actual head-run artifacts, and landing.
2. Check named gate refusal with inline evidence, non-vacuous CI, tri-state artifact-verified signals across acted-on engines including deploy job trace, and CEO's explicit merge action.

**Expected Outcome**:
- Planned gates fail closed; a collector finding alone is not a merge verdict and no existing gate is weakened.

#### TC-M1PLAN-006 - Scheduling and daemon boundary

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, `backlog-ranking.md`
**Tags**: @docs

**Preconditions**:
- R3-aligned scheduling and daemon stories are available.

**Steps**:
1. Check parallel preparation versus leased repository delivery, with per-repository single-flight as the only structural lane cap.
2. Check dependency ordering, closing before opening, build-weight classes, condition-clearing park/resume, singleton crash safety, and dispatcher-not-a-lane.
3. Check daemon follows merge, signal and liveness truth, with CLI one-shot fallback.

**Expected Outcome**:
- Planned scheduling is dependency-safe and resource-aware without implying a running daemon or a global structural lane cap.

#### TC-M1PLAN-007 - Plan schema and artifact joins

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-1, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`
**Tags**: @docs

**Preconditions**:
- R4-aligned schema and readiness stories are available.

**Steps**:
1. Read the planned phase contract for files/packages/folders scope, done-artifacts, leases, weight classes, declared interactions, tier/variant, readiness and overlap.
2. Check that phase joins verify done-artifacts rather than accepting exit status alone.

**Expected Outcome**:
- Machine-readable plan requirements and observable completion are specified without asserting that the schema exists today.

#### TC-M1PLAN-008 - Session economics and liveness

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DM-4, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, `roadmap.md`
**Tags**: @docs

**Preconditions**:
- R5-aligned session stories and M1 exit wording are available.

**Steps**:
1. Check liveness by progress, economically bounded resume or explicit uneconomic refusal, and a visible bounded restart budget.
2. Check the zero resume-amplification incident class is an exit target, not a claim of current results.

**Expected Outcome**:
- Session economics and failure classification are planned and observable; uneconomic resume is not silently repeated.

#### TC-M1PLAN-009 - Blockers, digest and brief

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-3, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, `cli-command-registry.md`
**Tags**: @docs

**Preconditions**:
- R6/R7/R11-aligned stories are available.

**Steps**:
1. Check `decision-needed`, `spec-ambiguity`, `credential-missing` (variable name only) and `external-wait` question categories, with one shared owner-gate/CEO contract and data answers.
2. Check the bounded ranked digest includes lanes, merge-ready actions, parked conditions, gate ages, spend, partial collection and stable finding codes.
3. Check the deterministic brief derives from the same collector state and anchors actions, questions and aging without LLM assembly.

**Expected Outcome**:
- The three attention paths share safe evidence and do not expose credential values or claim implemented behavior.

#### TC-M1PLAN-010 - Closeout, spend and M2 seam

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-4, NFR-4, NFR-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, `roadmap.md`, `backlog-ranking.md`
**Tags**: @docs

**Preconditions**:
- R8/R9/R10-aligned M1 and M2 stories are available.

**Steps**:
1. Check repeatable closeout mechanics return unresolved judgment residue and spend reads per ticket/per phase include resume amplification.
2. Check M1 tier/escalation configuration is a data seam; M2 keeps ceremony runner, board, steer, metrics engine and memory records.
3. Check existing full/lite phase semantics are acknowledged, not overwritten with a universal phase list.

**Expected Outcome**:
- M1 read/contract work and M2 ceremony execution are distinguishable with no premature runtime claims.

#### TC-M1PLAN-011 - Self-describing commands

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-7, AC-F7-2, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, `cli-command-registry.md`
**Tags**: @docs

**Preconditions**:
- R12-aligned command and diagnostic stories are available.

**Steps**:
1. Check planned help, man-page-grade guidance, stable machine summaries, stable exit meanings and doctor diagnostics.

**Expected Outcome**:
- Command self-description and diagnostics are specified as future acceptance, not attributed to undelivered commands.

#### TC-M1PLAN-012 - Registry and naming lock

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/cli-command-registry.md`, `backlog.md`
**Tags**: @docs

**Preconditions**:
- Registry and every proposed M1 command story are available.

**Steps**:
1. Cross-check plan validate/lint, queue, lanes, dispatch, daemon control, commit and phase completion, blockers ask/answer, spend, and status/digest extensions against stories.
2. Distinguish proposed M1 commands from delivered commands and verify existing locked family names are not silently changed.

**Expected Outcome**:
- Every new or extended story family is represented with truthful attribution and naming conflicts surfaced for review.

#### TC-M1PLAN-013 - Sanitized dated evidence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, NFR-1, NFR-2, NFR-4, NFR-6
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: All six `doc/planning/oss-tooling/` deliverables; existing `scripts/checks/privacy-literals.ts`
**Tags**: @docs, @privacy

**Preconditions**:
- The six publishable planning documents are available; private drafts remain ignored and uncommitted.

**Steps**:
1. Inventory all six documents, and compare sanitized R1-R12 priorities, hard constraints, acceptance view, dates and incident-class mechanisms against the spec and authorized private input without copying private literals into review evidence.
2. Run the existing binding privacy-literals check and scan all six documents for contextual private people, repositories, fleet members, credentials and sensitive values that literal matching may miss.
3. Inspect new content for em dashes and review changed-file inventory so ignored drafts are never staged or published.

**Expected Outcome**:
- All six documents are present and consistent; dated incident mechanisms survive sanitization, with zero corpus literals, private identifiers, credential values, or em dashes in new content. Scan success never substitutes for human contextual review.

#### TC-M1PLAN-014 - Owner approval gate

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, NFR-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/status.md`, change PR review
**Tags**: @docs

**Preconditions**:
- Planning set is ready for owner review.

**Steps**:
1. Check milestone status distinguishes planned work, pending M0 pilot evidence and owner decision acceptance.
2. At PR review, verify explicit owner acceptance is required before merge and that follow-up tickets and execution are gated after merge.

**Expected Outcome**:
- Planning approval cannot be mistaken for M0 exit, accepted decision records, permission for premature execution, or runtime delivery.

## 6. Environments and Test Data

Use the local documentation tree and PR diff; no deployed environment, generated fixtures or runtime data is needed. Inventory exactly the roadmap, backlog, backlog ranking, CLI command registry, sanitized operator requirements input, and milestone status under `doc/planning/oss-tooling/`. Compare published documents with the spec and baseline revisions for preservation checks. The ignored private input is review-only: do not stage it, quote its identifiers or include its sensitive values in logs, fixtures, or test evidence. Record dates and incident classes only in sanitized language.

## 7. Automation Plan and Implementation Mapping

| Scenario | Target / implementation status | Execution or review action |
|---|---|---|
| TC-M1PLAN-001 | Roadmap, status; Manual Only | Compare milestone gates and owner decisions against spec. |
| TC-M1PLAN-002 | Status, backlog; Manual Only | Compare M0 history and pending exit to baseline. |
| TC-M1PLAN-003 | Backlog, ranking, roadmap; Manual Only | Audit complete M1 story fields, dependency DAG, precedence and M2-M4 scope. |
| TC-M1PLAN-004 | Backlog, roadmap; Manual Only | Cross-check four bash successor mappings and evidence. |
| TC-M1PLAN-005 | Backlog, roadmap; Manual Only | Review merge and truth story acceptance. |
| TC-M1PLAN-006 | Backlog, ranking; Manual Only | Review scheduling constraints and sequencing. |
| TC-M1PLAN-007 | Backlog; Manual Only | Review DM-1 story and artifact-join acceptance. |
| TC-M1PLAN-008 | Backlog, roadmap; Manual Only | Review progress, resume economics and exit target. |
| TC-M1PLAN-009 | Backlog, registry; Manual Only | Review shared question, digest and brief contracts. |
| TC-M1PLAN-010 | Backlog, roadmap, ranking; Manual Only | Compare M1 spend/closeout with M2 ceremony seam. |
| TC-M1PLAN-011 | Backlog, registry; Manual Only | Review command guidance and diagnostics story. |
| TC-M1PLAN-012 | Registry, backlog; Manual Only | Compare all proposed command families and locked naming. |
| TC-M1PLAN-013 | Six deliverables; Existing - No Change for scanner, manual contextual review | Run `pnpm check:privacy-literals`; inspect sanitization, changed-file list and new content; do not echo sensitive matches. |
| TC-M1PLAN-014 | Status, PR; Manual Only | Check owner acceptance before merge and post-merge tickets. |

For every scenario, check Markdown rendering and changed links/paths; run `git diff --check` and review changed-file paths. Automated docs behavior tests: N/A. No test files or mocking are required. The reviewer records commands run, results and manual evidence in the execution log when execution occurs; this authoring pass does not claim they passed.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- Literal privacy scan may miss contextual disclosure; pair it with manual sanitization of all six outputs and preserve only dates and incident mechanisms.
- Ranking can appear plausible despite cycles or stale moved references; enumerate all edges and check precedence and baseline scope.
- Planned command or engine outcomes can be misread as delivered; check attribution against current behavior and the owner gate.

### 8.2 Assumptions

- The completed change spec and its four owner decisions determine requirements. A future implementation plan can add testing tasks but cannot silently replace spec acceptance criteria.
- The binding existing privacy check is `pnpm check:privacy-literals`; manual contextual review remains necessary.

### 8.3 Open Questions

- None blocks this planning review. Future runtime thresholds for digest latency, economic resume and engine evidence beyond two clean weeks are intentionally deferred to follow-up stories, as stated in the spec.
- If an implementation plan is added, reconcile its testing tasks and constraints before executing the review.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-03T05:22:17Z | Test plan writer | Initial docs-only test design from completed GH-219 specification. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| All scenarios | Not run | Pending | Record manual review and quality-gate evidence during execution; no verification claimed by this plan. |
