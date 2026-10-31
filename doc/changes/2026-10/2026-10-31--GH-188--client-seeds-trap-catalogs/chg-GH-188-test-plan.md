---
id: chg-GH-188-test-plan
status: Proposed
created: 2026-10-31T12:00:00Z
last_updated: 2026-10-31T14:30:00Z
owners: [engineering]
service: delivery-os provider adapters
labels: [change, planning]
version_impact: minor
summary: "Verify the GitLab, Jira, and GitHub client seeds behind the primitive ports: fixture-based trap catalogs with a firing negative control, the four M0-S6 tracker query families, the GitHub status/verify input set, sanitized fixtures, the additive WorkItem.updatedAt contract extension, capability honesty, credential-port exclusivity at exactly four allowlist entries, and the reviewed runtime-confinement extension, and the ADR-0006 representations (custom-field mapping semantics; optional WorkItem.comments absence semantics)."
links:
  change_spec: ./chg-GH-188-spec.md
  implementation_plan: ./chg-GH-188-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M0-S19: Client seeds with trap catalogs

## 1. Scope and Objectives

Protect the first real provider clients behind the delivered primitive ports: each seed must return normalized primitive views (`WorkItem`, `DeliveryRequest`, `PipelineRun`), declare its capabilities and gaps honestly, and prove every ticket-named provider quirk against committed sanitized fixtures — hand-authored synthetic captures modeled on recorded provider response shapes — with zero live network calls in CI. The highest risks are (a) a provider quirk silently flattened into normalized truth (pipeline multiplicity, asynchronous merge status, label replace, comment omission, custom-field typing), (b) a committed fixture leaking a secret, private identifier, or personal data, (c) the confinement extension eroding the runtime-API allowlist or the secret-read allowlist growing past four entries, and (d) a trap catalog that looks complete but whose assertions do not actually fire when normalization regresses. This plan is a design and implementation map, not an execution claim.

### 1.1 In Scope

- The twelve spec acceptance criteria (AC-F1-1 through AC-F8-1) and their linked F-/DM-/NFR- ids, plus the four ticket ACs traced through them.
- Per-client trap coverage: GitLab ≥3 entries, Jira ≥4 entries, GitHub ≥3 entries (spec NFR-2), each entry carrying exactly the four DM-2 fields and a stable fixture reference.
- The Jira read slice answering the four M0-S6 tracker query families from normalized `WorkItem` data, including the optional `WorkItem.updatedAt` stall signal (ADR-0004) with absent = activity unknown.
- The minimal GitHub read slice providing the PR, pipeline-per-commit, and issue reads that the M0-S6 status collector and M0-S8/M0-S9 verify change consume as inputs (spec DEC-5).
- Hand-authored synthetic provider fixtures (modeled on recorded provider response shapes) under `tests/fixtures/**`, sanitization audit, and a canary-style negative check that proves the audit catches a planted secret-shaped string (RSK-3).
- The additive `WorkItem.updatedAt` contract extension (DM-6, ADR-0004): contract-inventory/field-shape evidence and a type-level probe.
- The ADR-0006 representations: optional `WorkItem.comments` (absent = comment set unknown; present-empty = genuinely none) with contract/type evidence, and the Jira custom-field normalization mapping (mapped fields typed; unmapped visibly unrepresented; no raw key leak) with trap evidence.
- Capability declarations from the closed `ADAPTER_OPERATIONS` set, with read-only/gapped postures per spec DEC-2 and resolved OQ-2.
- Credential resolution exclusively through `CredentialPort`, the classified `config.credential.missing` failure, the secret-read allowlist at exactly four entries, and planted violations firing inside the three new provider subpaths.
- The reviewed runtime-API confinement extension (ADR-0005): positive admission for `github`/`gitlab`/`jira`, negative controls for `registry`/`azure`/`ci`/`io`, and the existing boundary suites staying green.
- CI/gate wiring: which existing jobs run the new suites, and the offline guarantee (no live network; live runs are M0-S20).

### 1.2 Out of Scope & Known Gaps

- No full GitHub adapter, write operations, releases, or full issue lifecycle (spec NG-1, M3-S3); no Jira/GitLab write path or closeout execution (NG-5, M0-S14).
- No adapter conformance suite, mock tenants, or scheduled live runs (NG-2, M0-S20). Live provider fidelity is not provable here and is deferred (RSK-2).
- No status, verify, or gate commands; this plan proves the provider-read input set, not the downstream commands (NG-3, DEC-5).
- No value-level privacy/secret scanning of arbitrary content; M0-S15 owns the durable guard. This plan proves structure, placeholders, and a pattern-based canary, not universal secret absence (see §8.1, §8.3).
- No provider engine routing, new CLI/MCP surface, or bash-stack changes (NG-6, NFR-7).
- The implementation plan is absent at authoring time. When `chg-GH-188-plan.md` lands, reconcile file locations and commands only; every TC ID and AC trace is preserved.
- Resolved 2026-10-31 by ADR-0006: custom fields follow documented mapping semantics (no contract change) and `comments` becomes optional (absent = comment set unknown). TC-JIRA-002 and TC-JIRA-004 are unblocked with concrete assertions; §8.3 OQ-A/OQ-B are resolved.

## 2. References

- [Change specification](./chg-GH-188-spec.md) v1.3, especially §§5 (F-1 to F-8), 8.3 (DM-1 to DM-8), 8.4 (provider surfaces and trapped quirk families), 9 (NFR-1 to NFR-7), 11 (RSK-1 to RSK-6), 14 (OQ-1 to OQ-6), 15 (DEC-1 to DEC-8), 17 (12 ACs), 18 (Definition of Done), and §24 (ticket-AC and M0-S6 query traceability).
- [Ticket GH-188](https://github.com/cwiakalski/agentic-delivery-os/issues/188): four ticket ACs (trap tests pass against recorded fixtures; Jira read slice answers M0-S6 queries; GitHub read slice serves status/verify inputs; no client reads a secret outside the credential port).
- [Repository testing strategy](../../../../.ai/rules/testing-strategy.md); [TypeScript workspace rules](../../../../.ai/rules/typescript.md); [AGENTS.md](../../../../AGENTS.md).
- [Feature: Adapter ports, credential resolution, and embedded metadata](../../../spec/features/feature-adapter-ports.md) — §Security and Boundaries and §Quality Assurance Strategy (structure/behaviour/type-level/checks/boundaries/aggregate).
- Decisions: [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) (package placement and runtime confinement), [ADR-0004](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) (additive optional `WorkItem.updatedAt`), [ADR-0005](../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md) (provider-subpath confinement refinement), [ADR-0006](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) (custom-field mapping semantics; optional `WorkItem.comments`).
- Delivered substrate to extend: `packages/core/src/contracts/ports.ts`, `packages/core/src/contracts/adapter-capabilities.ts`, `packages/adapters/src/credentials/**`, `.dependency-cruiser.cjs` (`runtime-apis-confinement`), `scripts/checks/secret-read-boundary.ts`, `tests/structure/port-contract-inventory.test.ts`, `tests/boundaries/**`.
- House format and gate handoff precedent: [chg-GH-181-test-plan.md](../2026-10-30--GH-181--primitive-ports-credential-metadata/chg-GH-181-test-plan.md); [chg-GH-173-test-plan.md](../2026-10-30--GH-173--config-layer/chg-GH-173-test-plan.md).
- [Dependency license registry](../../../legal/dependency-licenses.yaml) and the fail-closed license audit (`scripts/checks/license-audit.ts`).
- Implementation-basis outcomes recorded in ticket GH-188 (decision comment): GitHub/GitLab direct REST via native `fetch`; Jira custom minimal read-slice client; zero new dependencies.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| Capability | AC | TC(s) | Status |
|---|---|---|---|
| F-1 | AC-F1-1 | TC-CAP-001 | Planned |
| F-1 | AC-F1-2 | TC-SURFACE-001, TC-BOUNDARY-001 | Planned |
| F-2 | AC-F2-1 | TC-GITLAB-001, TC-GITLAB-002, TC-GITLAB-003 | Planned |
| F-3 | AC-F3-1 | TC-JIRA-005, TC-JIRA-006, TC-JIRA-007, TC-JIRA-008, TC-CONTRACT-001 | Planned |
| F-3, F-5 | AC-F3-2 | TC-JIRA-001, TC-JIRA-002, TC-JIRA-003, TC-JIRA-004 | Planned |
| F-4 | AC-F4-1 | TC-GITHUB-001, TC-GITHUB-002, TC-GITHUB-003, TC-GITHUB-004 | Planned |
| F-5 | AC-F5-1 | TC-TRAP-001 | Planned |
| F-5, F-6 | AC-F5-2 | TC-TRAP-002 | Planned |
| F-6 | AC-F6-1 | TC-FIXTURE-001, TC-FIXTURE-002 | Planned |
| F-7 | AC-F7-1 | TC-CRED-001 | Planned |
| F-7 | AC-F7-2 | TC-CRED-002 | Planned |
| F-8 | AC-F8-1 | TC-PLAN-001 | Manual only (process evidence) |
| — (NFR-6) | — | TC-LICENSE-001 | Planned |
| — (NFR-7) | — | TC-GATE-001 | Planned |

All twelve spec ACs have at least one test case. All AC-F3-2 clauses are assertable per ADR-0006 (custom-field mapping semantics; optional `comments` absence semantics). Ticket AC coverage: AC-1 → TC-TRAP-001/002 plus every provider trap case; AC-2 → TC-JIRA-005/006/007/008; AC-3 → TC-GITHUB-001/002/003/004; AC-4 → TC-CRED-001/002, TC-FIXTURE-001/002, TC-BOUNDARY-001.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no API-* endpoints and no EVT-* messages (§8.1, §8.2): consumers see port operations only, and trap catalogs/fixtures are committed test assets, not runtime events.

| Interface | TC IDs | Observable assertion |
|---|---|---|
| DM-1 per-seed capability declarations | TC-CAP-001 | Operations come from the closed `ADAPTER_OPERATIONS` set; every unimplemented operation has a gap record with a valid reason. |
| DM-2 trap-catalog entry | TC-TRAP-001, TC-TRAP-002 | Exactly four fields per entry (trap name, provider behavior, expected normalized outcome, fixture reference); reviewable as data; a regression fails naming the entry. |
| DM-3 recorded sanitized fixture | TC-FIXTURE-001, TC-FIXTURE-002 | Committed fixtures contain no secret/token/private identifier/personal data; placeholders and references are stable. |
| DM-4 Jira `WorkflowMap` | TC-JIRA-003 | Every state mapping names a delivery alias and a transition mechanism from the closed set; transitions are read as data, not executed. |
| DM-5 pipeline-per-commit normalization | TC-GITLAB-002, TC-GITHUB-002 | `read-pipeline-run` for a commit returns the complete truthful pipeline set with job states and trace evidence — never a bare status colour, never a silently picked singleton. |
| DM-6 `WorkItem.updatedAt` (additive) | TC-CONTRACT-001, TC-JIRA-007, TC-GITHUB-003 | Optional ISO-8601 UTC field; provider value normalized without fabrication; absent = activity unknown, distinguishable from no activity. |
| DM-7 `WorkItem.comments` optionality | TC-CONTRACT-001, TC-JIRA-004 | Optional field; absent = comment set unknown, present-empty = genuinely none; omission never collapses into `[]`. |
| DM-8 Jira custom-field mapping | TC-JIRA-002 | Mapped custom fields feed normalized fields as typed data; unmapped fields visibly unrepresented; no raw `customfield_*` key crosses the boundary. |
| `WorkItem` / `DeliveryRequest` / `PipelineRun` views | All provider cases | Only primitive views cross the port surface; no provider-native type is exported to consumers (TC-SURFACE-001). |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | TC IDs | Gate / assertion |
|---|---|---|
| NFR-1 normalized-view boundary purity | TC-SURFACE-001, TC-BOUNDARY-001, TC-CONTRACT-001 | AST export-surface probe, type-level view probe, boundary matrix green. |
| NFR-2 trap-catalog coverage | TC-TRAP-001, all provider trap cases | GitLab ≥3, Jira ≥4, GitHub ≥3; 100% of ticket-named families; four fields + ≥1 fixture per entry. |
| NFR-3 offline determinism | TC-TRAP-002, TC-FIXTURE-001 | Fixture transport only; a throwing `fetch` guard proves zero live calls; identical replay results across two runs. |
| NFR-4 credential centralization | TC-CRED-001, TC-CRED-002, TC-BOUNDARY-001 | Exactly four allowlist entries, zero ambient reads in client code, planted violations fire, failures classified. |
| NFR-5 capability honesty | TC-CAP-001 | Closed operation set; every unsupported operation gapped with a valid reason; no implied parity. |
| NFR-6 license compliance | TC-LICENSE-001 | Zero new dependencies (recorded basis) and the fail-closed registry audit stays green; any new dependency is registered and approved. |
| NFR-7 repository gate integrity | TC-GATE-001, TC-BOUNDARY-001, TC-SURFACE-001 | `pnpm check`, boundary matrix, naming firewall, doc-distribution guard green; bash jobs byte-unchanged. |

## 4. Test Types and Layers

- **Structure (`bun:test` under `tests/structure/**`):** trap-catalog schema/coverage, provider export-surface purity, and the `WorkItem` field-shape probe. Read committed catalog/fixture data through production loaders; no duplicated normalization logic.
- **Behaviour (`bun:test` under `tests/behaviour/**`):** per-client trap replay through the production client seed with an injected `CredentialPort` and an injected fixture transport; the four Jira query families; GitHub input-set completeness; credential classification.
- **Type level (`tests/types/**` through `tests/types/tsconfig.json` in `pnpm typecheck`):** `updatedAt` and `comments` optional/readonly probes, and a `satisfies`-style probe that client return values are assignable to the primitive views without provider-native types.
- **Checks (`tests/checks/**`):** fixture sanitization audit plus its planted-secret canary; existing secret-read boundary mutation tests extended with provider-subpath violations; boundary fixture-coverage meta-check.
- **Boundaries (`tests/boundaries/**`, `depcruise`):** provider-subpath positive admission and non-exempt negative controls in the temp-workspace harness, run against the production `.dependency-cruiser.cjs`.
- **Aggregate:** `pnpm check` is the single entry point (`lint → format:check → typecheck → test → check:boundaries → exports-parity`).
- **Manual / semi-automated:** TC-PLAN-001 verifies the ticket-recorded implementation-basis decision; everything mechanically verifiable is automated.

| Level | Scope | Suites / files | Gate |
|---|---|---|---|
| Structure | Trap-catalog schema and minima; provider export surface; contract field shape | `tests/structure/trap-catalog.test.ts`, `tests/structure/provider-surface.test.ts`, `tests/structure/port-contract-inventory.test.ts` | `bun test tests/structure` (CI `ts-test`) |
| Behaviour | Trap replays, query families, GitHub inputs, capability/gap inspection, credential classification | `tests/behaviour/providers/gitlab-trap.test.ts`, `jira-trap.test.ts`, `github-trap.test.ts`, `jira-queries.test.ts`, `github-inputs.test.ts`, `provider-capabilities.test.ts`, `provider-credentials.test.ts` | `bun test tests/behaviour` (CI `ts-test`) |
| Type level | `updatedAt` and `comments` optionality/readonly; normalized-view assignability | `tests/types/workitem-updated-at.type-test.ts`, `tests/types/workitem-comments.type-test.ts`, `tests/types/provider-views.type-test.ts` | `pnpm typecheck` (CI `ts-typecheck`) |
| Checks | Fixture sanitization audit + canary; secret-read boundary; boundary fixture coverage | `tests/checks/fixture-sanitization.test.ts`, `tests/checks/secret-read-boundary.test.ts`, `tests/boundaries/fixture-coverage.test.ts` | `bun test tests/checks tests/boundaries`; `ts-invariants` secret-read step |
| Boundaries | Confinement admission/negative controls; existing boundary matrix | `tests/boundaries/boundaries.test.ts`, `tests/boundaries/fixtures/cases.ts`, `tests/boundaries/fixture-registry.json` | `bun test tests/boundaries`; `pnpm check:boundaries` (CI `ts-boundaries`) |
| Aggregate | Whole workspace | all of the above | `pnpm check` (CI `ts-aggregate`) |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC |
|---|---|---|---|---|---|
| TC-GITLAB-001 | MR reads normalize to `DeliveryRequest` | Happy Path | Critical | High | AC-F2-1 |
| TC-GITLAB-002 | Pipeline multiplicity per commit is truthful | Edge Case | Critical | High | AC-F2-1 |
| TC-GITLAB-003 | Asynchronous/multi-valued merge status is not flattened | Edge Case | Critical | High | AC-F2-1 |
| TC-JIRA-001 | Label replace semantics reflected on read | Edge Case | Critical | High | AC-F3-2 |
| TC-JIRA-002 | Custom fields normalize to typed data | Edge Case | Critical | High | AC-F3-2 |
| TC-JIRA-003 | Transitions read as data via `WorkflowMap` | Happy Path | Critical | High | AC-F3-2 |
| TC-JIRA-004 | Omitted comments distinguishable from empty | Negative | Critical | High | AC-F3-2 |
| TC-JIRA-005 | Owner hand-backs query family | Happy Path | Critical | High | AC-F3-1 |
| TC-JIRA-006 | Blocked dependencies query family | Happy Path | Critical | High | AC-F3-1 |
| TC-JIRA-007 | Stalls query family via `updatedAt` (absent = unknown) | Edge Case | Critical | High | AC-F3-1, AC-F1-2 |
| TC-JIRA-008 | Ticket hygiene query family | Happy Path | Critical | High | AC-F3-1 |
| TC-GITHUB-001 | PR reads normalize with review-state mapping | Happy Path | Critical | High | AC-F4-1 |
| TC-GITHUB-002 | Check runs per SHA map to `PipelineRun` | Edge Case | Critical | High | AC-F4-1 |
| TC-GITHUB-003 | Issue reads map to `WorkItem` incl. `updatedAt` | Happy Path | Critical | High | AC-F4-1 |
| TC-GITHUB-004 | Complete status/verify input set from fixtures | Happy Path | Critical | High | AC-F4-1 |
| TC-TRAP-001 | Trap catalog schema, coverage, data reviewability | Contract | Critical | High | AC-F5-1 |
| TC-TRAP-002 | Offline trap suite passes and negative control names its entry | Negative | Critical | High | AC-F5-2 |
| TC-FIXTURE-001 | Fixture sanitization audit and stable references | Regression | Critical | High | AC-F6-1 |
| TC-FIXTURE-002 | Sanitization canary catches a planted secret | Negative | Critical | High | AC-F6-1 |
| TC-CONTRACT-001 | Additive `WorkItem` contract extensions (`updatedAt`, optional `comments`) | Contract | Critical | High | AC-F3-1, AC-F1-2 |
| TC-CAP-001 | Capability declarations and declared gaps per client | Contract | Critical | High | AC-F1-1 |
| TC-SURFACE-001 | No provider-native types cross the port surface | Contract | Critical | High | AC-F1-2 |
| TC-BOUNDARY-001 | Runtime confinement admission and negative controls | Contract | Critical | High | AC-F1-2 |
| TC-CRED-001 | Credential-port-exclusive resolution; allowlist stays at four | Negative | Critical | High | AC-F7-1 |
| TC-CRED-002 | Unresolvable credential classified | Negative | Critical | High | AC-F7-2 |
| TC-LICENSE-001 | License registry stays complete under the chosen bases | Regression | Important | High | NFR-6 |
| TC-GATE-001 | Repository gate integrity and bash-stack immutability | Regression | Critical | High | NFR-7 |
| TC-PLAN-001 | Implementation-basis evaluation recorded in the ticket | Manual | Important | Medium | AC-F8-1 |

#### Trap-catalog index (entry → TC → fixture)

Catalog files live under `tests/fixtures/providers/traps/<provider>.traps.json`; each entry has exactly the four DM-2 fields, and the trap name is its stable identifier. Fixture references use `path#/json-pointer` so they survive re-authoring.

| Trap name | Provider | Quirk family | TC | Fixture reference |
|---|---|---|---|---|
| `GL-PIPELINE-MULTIPLICITY` | GitLab | Branch and merge pipelines for one commit | TC-GITLAB-002 | `tests/fixtures/providers/gitlab/pipelines-per-commit.json#/pipelines` |
| `GL-MERGE-STATUS-ASYNC` | GitLab | Merge status resolves asynchronously (`checking`, `unchecked`) | TC-GITLAB-003 | `tests/fixtures/providers/gitlab/merge-status-async.json#/detailed_merge_status` |
| `GL-MERGE-STATUS-MULTIVALUED` | GitLab | Simultaneous/native merge-status values with different meanings | TC-GITLAB-003 | `tests/fixtures/providers/gitlab/merge-status-multivalued.json` |
| `JIRA-LABEL-REPLACE` | Jira | Label updates replace the whole set rather than append | TC-JIRA-001 | `tests/fixtures/providers/jira/labels-replace-before.json`, `labels-replace-after.json` |
| `JIRA-CUSTOM-FIELD-TYPING` | Jira | Provider-specific custom-field typing | TC-JIRA-002 | `tests/fixtures/providers/jira/custom-fields.json` |
| `JIRA-TRANSITIONS-AS-DATA` | Jira | Workflow transitions are data, not a write API | TC-JIRA-003 | `tests/fixtures/providers/jira/transitions.json#/transitions` |
| `JIRA-COMMENT-OMISSION` | Jira | Comments may be omitted for permission/paging reasons | TC-JIRA-004 | `tests/fixtures/providers/jira/comments-omitted.json` |
| `JIRA-UPDATED-ABSENT` | Jira | `updated` absent means activity unknown | TC-JIRA-007 | `tests/fixtures/providers/jira/stalls.json#/issues/1` |
| `GH-REVIEW-STATE` | GitHub | Native review decision/state normalization | TC-GITHUB-001 | `tests/fixtures/providers/github/pr-review-states.json#/pulls` |
| `GH-CHECK-RUNS-PER-SHA` | GitHub | Multiple check runs/check suites per commit SHA | TC-GITHUB-002 | `tests/fixtures/providers/github/check-runs-per-sha.json` |
| `GH-ISSUE-TO-WORKITEM` | GitHub | Issue payload to `WorkItem` mapping | TC-GITHUB-003 | `tests/fixtures/providers/github/issues.json#/issues` |

Coverage minima: GitLab 3 entries, Jira 5 entries, GitHub 3 entries — each meets or exceeds NFR-2. The GitLab count relies on splitting the spec's "asynchronous and multi-valued" merge-status clause into two variant entries per OQ-3's variant-sub-case allowance (flagged in §8.3 OQ-C).

### 5.2 Scenario Details

#### TC-GITLAB-001 - MR reads normalize to `DeliveryRequest`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-3 (view surface), NFR-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/gitlab-trap.test.ts`, `tests/fixtures/providers/gitlab/merge-requests.json`
**Tags**: @backend

**Preconditions**:

- The GitLab seed accepts an injected `CredentialPort` and an injected provider transport.
- A committed synthetic MR fixture (modeled on the provider's documented response shape) covers identity, source/target refs, draft/open state, and review threads.

**Steps**:

1. Replay the MR fixture through the seed's `read-delivery-request`; assert the returned view is a `DeliveryRequest`.
2. Assert identity is provider-qualified (system name + provider entity id), source/target refs map verbatim, and review state is one of the closed `DeliveryRequestReviewState` values.
3. Assert review threads map to `DeliveryThread` with stable thread ids, resolved flags, and comment counts.
4. Assert no provider-native field (raw payload key, provider object type, HTML URL) is present on the returned view.
5. Replay the same fixture twice; assert deep-equal deterministic output.

**Expected Outcome**:

- MR reads return a normalized `DeliveryRequest` with no provider-native leakage and deterministic replay.

#### TC-GITLAB-002 - Pipeline multiplicity per commit is truthful

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-5, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/gitlab-trap.test.ts`, `tests/fixtures/providers/gitlab/pipelines-per-commit.json`
**Tags**: @backend

**Preconditions**:

- The fixture records one commit SHA with both a branch pipeline and a merge-request pipeline, each with distinct jobs and trace references.
- The trap entry `GL-PIPELINE-MULTIPLICITY` references this fixture.

**Steps**:

1. Replay `read-pipeline-run` for the commit; assert the result contains every pipeline present in the fixture for that SHA, not just the newest.
2. Assert each returned `PipelineRun` carries a distinct identity, job states from the closed `PipelineJobState` set, and at least one `TraceEvidenceRef` where the fixture records a trace.
3. Assert ordering/singleton selection is not silently applied: reordering the fixture's pipeline array yields the same set (order-insensitive comparison).
4. Assert no job is represented by a bare status colour; a missing jobs list in the fixture is reported, never invented.
5. In a temp copy of the fixture, remove one pipeline; assert the same assertion fails naming `GL-PIPELINE-MULTIPLICITY` and the fixture reference.

**Expected Outcome**:

- The per-commit pipeline set is complete and truthful under multiplicity; dropping a pipeline is detectable and names the trap entry.

#### TC-GITLAB-003 - Asynchronous/multi-valued merge status is not flattened

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-5, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/gitlab-trap.test.ts`, `tests/fixtures/providers/gitlab/merge-status-async.json`, `merge-status-multivalued.json`
**Tags**: @backend

**Preconditions**:

- Fixtures cover the asynchronous values (`checking`, `unchecked`) and multi-valued payloads where `merge_status` and `detailed_merge_status` disagree.
- The trap entries `GL-MERGE-STATUS-ASYNC` and `GL-MERGE-STATUS-MULTIVALUED` reference the fixtures.

**Steps**:

1. For every native merge-status value present in the fixtures, assert the seed's declared mapping covers it (exhaustive mapping table asserted against the fixture value set; an unmapped value fails).
2. Assert asynchronous states never report a terminal delivery outcome (no `merged`/`closed` while the native status is `checking` or `unchecked`).
3. Assert a multi-valued payload is resolved by the declared rule, not by picking an arbitrary field: if `merge_status` and `detailed_merge_status` disagree and the rule is undefined, the read fails visibly rather than silently flattening.
4. Assert the returned review state is from the closed set and that no native merge-status string is exposed as a delivery state.
5. In a temp copy, map `checking` to a terminal state; assert the trap test fails naming `GL-MERGE-STATUS-ASYNC`.

**Expected Outcome**:

- Merge status is normalized through a declared, exhaustive mapping; asynchronous and multi-valued states are never silently flattened; a corrupt mapping fails by trap name.

**Notes / Clarifications**:

- The spec does not pin the concrete native→delivery mapping table or which field carries mergeability; this case asserts exhaustiveness and non-flattening, and §8.3 OQ-D asks the plan writer to record the table.

#### TC-JIRA-001 - Label replace semantics reflected on read

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/jira-trap.test.ts`, `tests/fixtures/providers/jira/labels-replace-before.json`, `labels-replace-after.json`
**Tags**: @backend

**Preconditions**:

- Two committed synthetic reads of the same issue: before a label replacement (`[x, y]`) and after (`[y, z]`).
- The trap entry `JIRA-LABEL-REPLACE` references both fixtures.

**Steps**:

1. Replay the before fixture; assert `WorkItem.labels` equals the full native set `[x, y]`.
2. Replay the after fixture; assert the labels equal `[y, z]` — the replacement set — never the accumulated `[x, y, z]`.
3. Assert repeated reads do not merge or cache stale labels across responses.
4. Assert label order is not silently used as semantics; compare as sets where the provider order is not meaningful.
5. In a temp copy, make the after fixture's read append the prior set; assert the test fails naming `JIRA-LABEL-REPLACE`.

**Expected Outcome**:

- Reads reflect the provider's replace semantics truthfully; no accumulation across reads; a merge regression names the trap entry.

#### TC-JIRA-002 - Custom fields normalize to typed data

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/jira-trap.test.ts`, `tests/fixtures/providers/jira/custom-fields.json`
**Tags**: @backend

**Preconditions**:

- The fixture records provider-specific custom fields with inconsistent native typing (for example a numeric-as-string field and a select field).
- The trap entry `JIRA-CUSTOM-FIELD-TYPING` references the fixture.

**Steps**:

1. Replay the fixture; for every provider custom field the declared mapping (DM-8 adapter data) feeds into a normalized field, assert the normalized destination carries the value as typed data per the mapping's declared type (e.g., the numeric-as-string field arrives as a number where the mapping declares numeric; the select field as its declared value) — never as an uninterpreted provider blob.
2. Assert no raw `customfield_*` key (and no unmapped custom-field key or value) leaks into the `WorkItem` view.
3. Assert unmapped custom fields are visibly unrepresented: the returned `WorkItem` carries no trace of them, and the trap entry's expected-normalized-outcome field names both the typed mapping and the visible non-representation (reviewable as data, without reading test code).
4. In a temp copy, stringify a mapped typed value and separately leak an unmapped key; assert each mutation fails naming `JIRA-CUSTOM-FIELD-TYPING`.

**Expected Outcome**:

- Custom fields that feed normalized fields are typed at the port boundary; unmapped fields are visibly unrepresented with no raw key leak — full AC-F3-2 evidence per ADR-0006 (no contract change).

#### TC-JIRA-003 - Transitions read as data via `WorkflowMap`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DM-4
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/jira-trap.test.ts`, `tests/fixtures/providers/jira/transitions.json`, `tests/fixtures/providers/jira/workflow-map.json`
**Tags**: @backend

**Preconditions**:

- A committed synthetic workflow fixture (modeled on the provider's documented response shape) lists native statuses and their transition mechanisms.
- The trap entry `JIRA-TRANSITIONS-AS-DATA` references the fixture.

**Steps**:

1. Build the `WorkflowMap` from the fixture; assert every native status has a delivery-state alias from `DeliveryStateAlias` and a mechanism from `WorkflowTransitionMechanism`.
2. Assert the map is closed and exhaustive: every native status observed in the issue fixtures has exactly one mapping; an unmapped status fails.
3. Assert no transition is executed: the client declares `transition-work-item` as a gap (TC-CAP-001) and the read path returns data only.
4. Assert a mechanism is present for every mapping — an alias without a named mechanism fails.
5. In a temp copy, remove a mechanism; assert the map validation fails naming `JIRA-TRANSITIONS-AS-DATA`.

**Expected Outcome**:

- Transitions are represented as closed, mechanism-naming data; no write execution occurs.

#### TC-JIRA-004 - Omitted comments distinguishable from empty

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DM-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/jira-trap.test.ts`, `tests/fixtures/providers/jira/comments-omitted.json`, `comments-empty.json`
**Tags**: @backend

**Preconditions**:

- One fixture omits the comment payload entirely (permission/paging cause); another returns an explicit empty comment list.
- The trap entry `JIRA-COMMENT-OMISSION` references the omitted fixture.
- Representation per ADR-0006: `WorkItem.comments` is optional — absent = comment set unknown; present (including empty) = the provider-asserted set.

**Steps**:

1. Replay the omitted-comment fixture; assert the read succeeds and the returned `WorkItem.comments` is absent (`!("comments" in view)` / `view.comments === undefined`) — the comment set is unknown, never an empty array.
2. Replay the empty-comment fixture; assert the returned `comments` set is explicitly empty.
3. Assert the two results are distinguishable through the port surface: absent vs present-`[]` are observably different representations, and omission never collapses into an empty array.
4. Assert no comment is fabricated and no "no comments" claim is made from an omitted payload.
5. In a temp copy, make the normalizer emit `comments: []` for the omitted fixture; assert the test fails naming `JIRA-COMMENT-OMISSION`.

**Expected Outcome**:

- Absent comments (unknown set) remain distinguishable from a present empty set (genuinely none), with no fabrication — full AC-F3-2 evidence per ADR-0006.

#### TC-JIRA-005 - Owner hand-backs query family

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/jira-queries.test.ts`, `tests/fixtures/providers/jira/tracker-queries.json#/owner-hand-backs`
**Tags**: @backend

**Preconditions**:

- Fixtures include issues where the assignee changed or an ownership label was applied.
- A test-local pure predicate implements the query family over normalized `WorkItem` values (the collector itself is M0-S6).

**Steps**:

1. Read all fixture issues through the slice; assert assignee and ownership-relevant labels are present and normalized.
2. Evaluate the owner-hand-back predicate over the normalized views; assert the expected issues are identified.
3. Assert the predicate uses only normalized `WorkItem` fields (no provider-native payload, no raw `fields` access).
4. Replay in reverse fixture order; assert the same result set.

**Expected Outcome**:

- The owner-hand-back family is answerable from normalized data alone, deterministically.

#### TC-JIRA-006 - Blocked dependencies query family

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-5 (relations), NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/jira-queries.test.ts`, `tests/fixtures/providers/jira/tracker-queries.json#/blocked-dependencies`
**Tags**: @backend

**Preconditions**:

- Fixtures include `blocks` and `blocked-by` relations in both directions, with provider-qualified targets.
- The test-local predicate identifies blocked issues from typed relations.

**Steps**:

1. Read the fixture issues; assert each relation carries a `relationKind` from the closed set and a provider-qualified target.
2. Assert both `blocks` and `blocked-by` directions survive normalization without being merged.
3. Evaluate the blocked-dependency predicate; assert it identifies the blocked issues from relations alone.
4. Assert no issue-key string parsing is required to resolve a relation target.

**Expected Outcome**:

- The blocked-dependency family is answerable from typed relations; directionality is preserved.

#### TC-JIRA-007 - Stalls query family via `updatedAt` (absent = unknown)

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-6, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/jira-queries.test.ts`, `tests/fixtures/providers/jira/stalls.json`
**Tags**: @backend

**Preconditions**:

- Fixtures include: an issue with a native `updated` value; an issue with `updated` absent and comments present; an issue with `updated` absent and no comments; an issue with `updated` present and comments absent.
- The trap entry `JIRA-UPDATED-ABSENT` references the absent-field fixture.

**Steps**:

1. Read the issues; assert `updatedAt` is present and ISO-8601 UTC-parseable where the provider supplies a value.
2. Assert the provider-native value is not derived from comments or ordering: the absent-with-comments issue stays absent.
3. Evaluate the stall predicate (test-local, threshold injected); assert issues with known `updatedAt` are classified active/stalled deterministically.
4. Assert absent-`updatedAt` issues are reported as **activity unknown** — neither active nor stale — and are distinguishable from a fresh/no-activity item.
5. Assert no fabricated timestamp (no `Date.now()`, no comment-derived value) appears.
6. In a temp copy, fabricate an `updatedAt` for the absent issue; assert the test fails naming `JIRA-UPDATED-ABSENT`.

**Expected Outcome**:

- Stalls are answerable from `WorkItem.updatedAt`; absence is represented as unknown, never derived or fabricated; a fabrication regression names the trap entry.

**Notes / Clarifications**:

- Exact string normalization (verbatim provider value versus canonical UTC rendering) is not pinned; see §8.3 OQ-E.

#### TC-JIRA-008 - Ticket hygiene query family

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/jira-queries.test.ts`, `tests/fixtures/providers/jira/tracker-queries.json#/ticket-hygiene`
**Tags**: @backend

**Preconditions**:

- Fixtures include conforming and non-conforming issues (missing labels, status inconsistent with delivery state, missing required fields).
- A test-local hygiene predicate asserts label/status/field conformance over normalized data.

**Steps**:

1. Read the fixture issues; assert native and delivery status are both present and typed.
2. Evaluate the hygiene predicate; assert the expected non-conforming issues are identified.
3. Assert the predicate never needs provider-native payloads, even when a custom field is missing.
4. Assert a removed label is observed as absent on the next read (replace semantics, cross-check with TC-JIRA-001).

**Expected Outcome**:

- The hygiene family is answerable from normalized labels/status/fields; conformance findings are deterministic.

#### TC-GITHUB-001 - PR reads normalize with review-state mapping

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/github-trap.test.ts`, `tests/fixtures/providers/github/pr-review-states.json`
**Tags**: @backend

**Preconditions**:

- Fixtures cover draft, open, changes-requested, approved, merged, and closed PRs, including a `reviewDecision` that differs from the raw `state`.
- The trap entry `GH-REVIEW-STATE` references the fixture.

**Steps**:

1. Replay each PR through `read-delivery-request`; assert the normalized review state is from the closed set and matches the declared mapping.
2. Assert `merged: true` / `state: closed` combinations never report `open`.
3. Assert review threads map to `DeliveryThread` with stable ids and resolved flags.
4. Assert no provider-native payload key or numeric review id leaks into the view.
5. In a temp copy, flatten every review state to `open`; assert the test fails naming `GH-REVIEW-STATE`.

**Expected Outcome**:

- Every PR variable maps to a truthful `DeliveryRequestReviewState`; a flattening regression names the trap entry.

#### TC-GITHUB-002 - Check runs per SHA map to `PipelineRun`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-5, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/github-trap.test.ts`, `tests/fixtures/providers/github/check-runs-per-sha.json`
**Tags**: @backend

**Preconditions**:

- The fixture records multiple check runs (success, failure, queued, skipped) for one SHA, plus a check suite roll-up.
- The trap entry `GH-CHECK-RUNS-PER-SHA` references the fixture.

**Steps**:

1. Replay `read-pipeline-run` for the SHA; assert every check run is represented with a job state from the closed set.
2. Assert the conclusion/status pair maps to one state without dropping a failed job behind a green roll-up.
3. Assert trace-evidence references are present where the fixture records URLs; no bare status colour.
4. Assert two different SHAs in the fixture yield disjoint pipeline sets.
5. In a temp copy, drop the failed check run; assert the test fails naming `GH-CHECK-RUNS-PER-SHA`.

**Expected Outcome**:

- Per-SHA check runs map completely and truthfully; a failed job cannot be hidden by an aggregate status.

#### TC-GITHUB-003 - Issue reads map to `WorkItem` incl. `updatedAt`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-6, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/github-trap.test.ts`, `tests/fixtures/providers/github/issues.json`
**Tags**: @backend

**Preconditions**:

- Fixtures cover labels, assignee present/absent, state open/closed, native `updated_at` present, and an issue with `updated_at` absent (synthetic edge).
- The trap entry `GH-ISSUE-TO-WORKITEM` references the fixture.

**Steps**:

1. Replay each issue through `read-work-item`; assert identity, title, status, labels, and assignee map to normalized fields.
2. Assert `updatedAt` is present where the provider supplies `updated_at` and absent (unknown) where it does not.
3. Assert relations are typed where the fixture records issue links; none are fabricated.
4. Assert no raw GitHub payload key/type leaks into `WorkItem`.
5. In a temp copy, swap the assignee mapping; assert the test fails naming `GH-ISSUE-TO-WORKITEM`.

**Expected Outcome**:

- GitHub issues normalize truthfully into `WorkItem`, including the additive activity signal.

#### TC-GITHUB-004 - Complete status/verify input set from fixtures

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/github-inputs.test.ts`, `tests/fixtures/providers/github/`
**Tags**: @backend

**Preconditions**:

- The GitHub fixtures together represent one delivery scenario: a PR, its commits' check runs, and the linked issue.
- The M0-S6/M0-S8/M0-S9 commands themselves are out of scope (DEC-5).

**Steps**:

1. Resolve the delivery request, the pipeline run(s) for its head SHA, and the linked work item through the slice.
2. Assert the returned set is `DeliveryRequest` + `PipelineRun` + `WorkItem` only, sufficient to answer: is CI green for this commit, what is the review state, and what is the work-item status/owner?
3. Assert no input requires a provider-native payload, a second provider call outside the seed, or a live network request.
4. Assert an unfixtured request fails loudly through the fixture transport rather than reaching the network.

**Expected Outcome**:

- The GitHub read slice supplies the complete normalized input set status and verify change consume; the slice-feeds-commands boundary is evidenced without testing the downstream commands.

#### TC-TRAP-001 - Trap catalog schema, coverage, data reviewability

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-2, NFR-2
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/trap-catalog.test.ts`, `tests/fixtures/providers/traps/*.traps.json`
**Tags**: @backend

**Preconditions**:

- Per-provider catalogs exist as JSON data; the loader derives the provider from the file name.
- A committed list of ticket-named quirk families is available for coverage comparison.

**Steps**:

1. Load every catalog; assert each entry has exactly the four DM-2 keys (trap name, provider behavior, expected normalized outcome, fixture reference) and non-empty values.
2. Assert trap names are unique within and across catalogs and stable (used as test identifiers).
3. Assert every fixture reference resolves to a committed file under `tests/fixtures/providers/**` and that the referenced JSON pointer exists.
4. Assert per-provider minima: GitLab ≥3, Jira ≥4, GitHub ≥3, and that every ticket-named quirk family has at least one entry.
5. Assert the catalogs are data-only (no executable code) so they are reviewable without reading test code.
6. In temp copies, delete an entry, add a fifth field, break a fixture reference, and drop Jira below four; assert each mutation fails by name.

**Expected Outcome**:

- The catalogs meet the four-field schema and NFR-2 minima; coverage and fixture references are mechanically enforced; catalogs are reviewable as data.

#### TC-TRAP-002 - Offline trap suite passes and negative control names its entry

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, AC-F5-2, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/*-trap.test.ts`, `tests/behaviour/providers/trap-harness.ts`, `tests/fixtures/providers/**`
**Tags**: @backend

**Preconditions**:

- The client seeds accept an injected credential port and an injected fixture transport (fetch-shaped) that throws on any request not covered by a fixture.
- A throwing `fetch` guard is installed for the duration of the suite.
- The trap harness exposes the replay result per trap name so failures can name the entry.

**Steps**:

1. Run every catalog entry through its client seed via the fixture transport; assert 100% pass and that each executed assertion is keyed by the trap name.
2. Assert the "provider input" path used by the suite is the fixture transport only: the throwing `fetch` guard records zero calls; any call fails the test.
3. Run the suite twice; assert identical results and no order dependence.
4. Negative control A: in a temp copy, corrupt a normalizer mapping (for example map `checking` to a terminal state); run the suite; assert it fails and the message contains the trap name and fixture reference.
5. Negative control B: request an unfixtured provider path; assert the harness fails loudly instead of falling back to a live call.
6. Assert catalog↔assertion coverage is bidirectional: a catalog entry without an assertion and an assertion without a catalog entry both fail.

**Expected Outcome**:

- 100% of trap tests pass offline with zero live calls; a deliberately corrupted normalization fails naming its trap entry; an unfixtured request cannot reach the network.

#### TC-FIXTURE-001 - Fixture sanitization audit and stable references

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-3, NFR-3
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/fixture-sanitization.test.ts`, `tests/fixtures/providers/**`
**Tags**: @backend

**Preconditions**:

- A declared placeholder registry (for example `<REDACTED_TOKEN>`, `person-1@example.invalid`, `acct-0001`, `owner-placeholder`) is committed.
- The fixture tree contains only sanitized hand-authored synthetic captures and the trap catalogs.

**Steps**:

1. Scan every committed provider fixture for token-shaped strings, bearer/authorization headers, private keys, email addresses, avatar URLs, account identifiers, and private repository references; allow only declared placeholders and documented provider field names.
2. Assert no fixture contains a live host or tenant identifier; hostnames use reserved/example domains.
3. Assert every placeholder used in a fixture is declared in the registry and every declared placeholder is used (no stale vocabulary).
4. Assert fixture references in trap catalogs resolve and that two catalog entries referencing one fixture agree on its identity (stability).
5. In a temp copy, plant a bare token-shaped string and an undeclared email; assert the audit fails naming the file and line/field.

**Expected Outcome**:

- Committed fixtures contain no secrets, credentials, private-corpus identifiers, or personal data under the declared placeholder discipline; references are stable; a planted leak fails.

**Notes / Clarifications**:

- Detection is pattern/placeholder-based and is not proof of universal secret absence; value-level scanning is M0-S15 (§8.1).

#### TC-FIXTURE-002 - Sanitization canary catches a planted secret

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, RSK-3, NFR-3
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/fixture-sanitization.test.ts`, `tests/fixtures/providers/sanitization/cases.ts`
**Tags**: @backend

**Preconditions**:

- A canary case set supplies planted secret-shaped strings in the shapes the audit claims to detect (`Authorization: Bearer …`, `ghp_…`, `glpat-…`, Jira API token form, PEM private key, email, avatar URL).
- The scanner is exported as a pure function so the canary exercises the production logic, not a copy.

**Steps**:

1. Run the scanner over a clean fixture; assert zero findings.
2. For each canary shape, plant it in a temp copy and assert the scanner reports a finding naming the file and the field/line.
3. Assert the canary does not rely on the real fixture tree and writes only to `mkdtemp`.
4. Assert the clean control passes again after removing the canaries.
5. Assert an empty scan scope is reported (non-vacuity), so deleting all fixtures cannot pass silently.

**Expected Outcome**:

- The sanitization audit is proven to fire on every claimed secret shape; a planted secret cannot pass as a sanitized fixture.

#### TC-CONTRACT-001 - Additive `WorkItem` contract extensions (`updatedAt`, optional `comments`)

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-6, DM-7, AC-F1-2, NFR-1
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/port-contract-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json`, `tests/types/workitem-updated-at.type-test.ts`, `tests/types/workitem-comments.type-test.ts`
**Tags**: @backend

**Preconditions**:

- ADR-0004 defines the optional, ISO-8601 UTC `updatedAt` field on the v1 `WorkItem`.
- The existing inventory fixture pins exported names; `tests/types/tsconfig.json` compiles the type probes.

**Steps**:

1. AST/field-shape assertion: `WorkItem` declares exactly the pre-existing fields plus `readonly updatedAt?: string`, with `comments` now `readonly comments?: readonly WorkItemComment[]` (additive relaxation per ADR-0006); no existing field is removed, retyped, or made required (ADR-0004 C-1; ADR-0006 C-1).
2. Assert the export-name inventory is unchanged (the field addition adds no export) and the existing both-direction inventory test passes. Add the field-level shape fixture/probe to the inventory test so the field is mechanically pinned.
3. Type-level: a `WorkItem` literal without `updatedAt` compiles; a non-string `updatedAt` and a reassignment to the readonly field fail; a provider-native timestamp object fails. a `WorkItem` literal without `comments` and one with `comments: []` both compile; a non-array `comments` fails; reassignment to the readonly field fails.
4. Turn on `exactOptionalPropertyTypes` semantics: `updatedAt: undefined` is not silently equivalent to absence in the adapter normalization (asserted at the normalizer level in TC-JIRA-007/TC-GITHUB-003).
5. Negative: remove the field in a temp copy; assert the field-shape probe fails naming `WorkItem.updatedAt`. re-tighten `comments` to required in a temp copy; assert the field-shape probe fails naming `WorkItem.comments`.
6. Run `tests/structure/port-neutrality.test.ts`; assert the contracts tier remains types/`as const` only (no clock, no derivation).

**Expected Outcome**:

- `WorkItem.updatedAt` is additive, optional, readonly, and mechanically pinned; absence is representable; contracts-tier neutrality is unchanged.

**Notes / Clarifications**:

- The spec/ADR says the contract-inventory structure test "pins exact contract shape", but the delivered fixture pins export names, not fields. This plan adds the field-shape probe so the claim is mechanically true; see §8.3 OQ-F.

#### TC-CAP-001 - Capability declarations and declared gaps per client

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-5
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-capabilities.test.ts`, `tests/fixtures/ports/capabilities.ts`
**Tags**: @backend

**Preconditions**:

- Each seed exposes an `AdapterCapabilityDeclaration` (directly or via `AdapterContract`).
- `ADAPTER_OPERATIONS` and `CapabilityGapReason` are the closed sets from GH-181.

**Steps**:

1. For each of the three seeds, assert every `supportedOperations` value is in `ADAPTER_OPERATIONS`, with no duplicates.
2. For every operation in `ADAPTER_OPERATIONS` not supported, assert exactly one gap record with a reason from the closed set; no gap for a supported operation and no duplicate gap.
3. Assert the per-client posture: GitHub supports the read operations and gaps **all** write operations; GitLab supports MR and pipeline reads and gaps its writes; Jira supports `read-work-item` and gaps `write-work-item`, `transition-work-item`, and `write-comment` per resolved OQ-2.
4. Assert no reason implies parity: a gap reason is descriptive, and `supportedOperations` remains authoritative.
5. Assert no declaration admits an operation the client module does not implement (positive/negative pair per client).
6. In a temp declaration, remove a Jira write gap and add a non-operation string; assert each mutation fails.

**Expected Outcome**:

- Capability honesty is mechanically enforced: closed-set operations, complete gap records with valid reasons, and the spec's read-only/gapped postures.

**Notes / Clarifications**:

- The exact reason per operation (`provider-unsupported` vs `adapter-not-implemented` vs `plan-restriction`) is not pinned; §8.3 OQ-G asks delivery to record it. Tests assert validity and gapped-ness now.

#### TC-SURFACE-001 - No provider-native types cross the port surface

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-1
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-surface.test.ts`, `tests/types/provider-views.type-test.ts`
**Tags**: @backend

**Preconditions**:

- The three provider subpaths export their client factories/declarations.
- Provider-native response types are not exported from the subpaths.

**Steps**:

1. Parse each provider subpath's public exports (via source and the built declarations when present); assert exported names are only the client factory/declaration and supported input types built from core contracts.
2. Assert no exported type name matches provider-native shapes (`GitLabMR`, `JiraIssue`, `OctokitResponse`, raw payload types) and no `any`/`unknown`-erasing wrapper is exported as a view.
3. Type-level: assert each client's read return is assignable to `DeliveryRequest`/`PipelineRun`/`WorkItem` and that the primitive view is the declared return type (not a provider type narrowed by assertion).
4. Assert no adapter ships a parallel view type that augments the primitive view for consumers (ADR-0004 C-3).
5. In a temp export, add a provider-native type to a subpath; assert the surface test fails by name.

**Expected Outcome**:

- Provider-native types never cross the port surface; consumers see only primitive views; adding a native export is detectable.

#### TC-BOUNDARY-001 - Runtime confinement admission and negative controls

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, AC-F7-1, NFR-1, NFR-4, NFR-7
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/boundaries.test.ts`, `tests/boundaries/fixtures/cases.ts`, `tests/boundaries/fixture-registry.json`, `.dependency-cruiser.cjs`
**Tags**: @backend

**Preconditions**:

- `.dependency-cruiser.cjs` `runtime-apis-confinement` gains `github|gitlab|jira` in the exact `pathNot` allowance with per-entry reasons (ADR-0005 C-2).
- The boundary harness materializes temp workspaces against the production config.

**Steps**:

1. Positive admission: add clean controls importing a runtime API from each of `packages/adapters/src/{github,gitlab,jira}/probe.ts`; assert the cruise is clean for all three.
2. Negative controls: assert a runtime import in `registry`, `azure`, `ci`, `io`, and core non-runtime tiers still violates `runtime-apis-confinement`; the existing `runtime-node-fs-adapter-registry` and `runtime-node-fs-adapter-io` cases stay violations.
3. Assert the rule's `pathNot` array is exact (no wildcard/prefix) and that `registry` is absent from it; update the literal assertion in `boundaries.test.ts` that currently pins the pre-change array.
4. Assert every configured rule still has a registered failing fixture (fixture-coverage meta-check green) and the new controls are registered.
5. In a temp config copy, widen the allowance to `providers/**` or add `registry`; assert the boundary suite fails.
6. Run the existing boundary suite; assert no pre-existing case regressed.

**Expected Outcome**:

- The three provider subpaths are admitted to runtime I/O with exact, reason-bearing entries; `registry`/`azure`/`ci`/`io` still fail; allowlist widening is detectable; the existing matrix stays green.

#### TC-CRED-001 - Credential-port-exclusive resolution; allowlist stays at four

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-4
**Test Type(s)**: Contract, Integration, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-credentials.test.ts`, `tests/checks/secret-read-boundary.test.ts`, `scripts/checks/secret-read-boundary.ts`, `tests/fixtures/secret-boundary/cases.ts`
**Tags**: @backend

**Preconditions**:

- Each seed resolves credentials through the injected `CredentialPort` using its declared `ExternalSystemInstance` reference.
- The secret-read allowlist has exactly four entries: one `credential-material` directory and three `configuration-environment-source` files.
- Fixture source strings live only in `mkdtemp` workspaces.

**Steps**:

1. Instantiate each seed with a recording `CredentialPort`; assert resolution happens through the port with the declared reference and that the secret is used to build the provider request without being stored on the client instance.
2. Capture diagnostics/logs/errors from a full read; assert a canary secret is absent in raw and JSON-escaped forms.
3. Scan the live tree with `validate(process.cwd())`; assert zero violations, exactly four allowlisted entries, exactly one `credential-material` entry, and the scoped-file count is non-zero.
4. Plant `process.env.SECRET` and a computed-key form inside each of `packages/adapters/src/{github,gitlab,jira}/`; assert the check fails naming rule, file, and line (the provider subpaths are not allowlisted).
5. Run the existing allowlist mutation tests (remove entry, add undeclared path, wildcard, second credential entry); assert they still fail closed.
6. Assert `git status --porcelain` is unchanged before and after the read-only scans.

**Expected Outcome**:

- Each client acquires credentials only through the port; the allowlist stays at exactly four entries; ambient reads inside the new provider subpaths fire; planted violations and allowlist mutations still fail closed.

#### TC-CRED-002 - Unresolvable credential classified

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, NFR-4
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-credentials.test.ts`, `tests/behaviour/credential-port.test.ts`
**Tags**: @backend

**Preconditions**:

- A declared credential reference maps to an absent key and to an empty-string value in an injected environment record.
- The `config.credential.missing` identity is delivered by GH-181.

**Steps**:

1. For each seed, resolve through the real environment-backed port with an absent key; assert the failure carries exactly `config.credential.missing` with domain `config`, category `user`, retryable `false`, consequence `not_landed`, and projection `user-validation`.
2. Assert the provider transport is never called after a credential failure, and no raw provider error or host-environment dump is returned.
3. Repeat with an empty-string value; assert the same identity.
4. Assert no containment to `fallback.internal`/`fallback.invocation` and no silent skip of the operation.
5. Assert the failure payload contains no secret canary and no environment dump.

**Expected Outcome**:

- Every client surfaces unresolvable credentials as the classified `config.credential.missing` failure, never as silence, containment, or a raw provider error.

#### TC-LICENSE-001 - License registry stays complete under the chosen bases

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-6, F-8
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts`, `scripts/checks/license-audit.ts`, `doc/legal/dependency-licenses.yaml`
**Tags**: @backend

**Preconditions**:

- The recorded basis adds zero new dependencies (native `fetch`; custom Jira read slice).
- The registry is fail-closed: every direct and runtime-closure dependency must have an approved verdict.

**Steps**:

1. Run the license audit; assert zero unknown/unregistered dependencies and zero denied verdicts.
2. Diff the manifests/lockfile against the pre-change baseline; assert no new external dependency was introduced by the seeds.
3. If the delivery plan changes the basis and introduces a dependency, assert the same audit fails until a registry row with an approved verdict lands; record the row in this test's notes rather than weakening the gate.
4. Assert provider CLIs are not invoked as a delivery dependency (no subprocess/CLI shell-out in the seeds).

**Expected Outcome**:

- The chosen bases introduce zero unregistered dependencies; the fail-closed registry stays authoritative; a basis change requires a registry update.

#### TC-GATE-001 - Repository gate integrity and bash-stack immutability

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-7, AC-F1-2
**Test Type(s)**: Regression, Contract
**Automation Level**: Automated
**Target Layer / Location**: `package.json`, `.github/workflows/ci.yml`, existing `tests/structure/**`, `tests/checks/**`
**Tags**: @backend

**Preconditions**:

- The aggregate `pnpm check` and the CI job matrix are the binding gates.
- The bash stack is out of scope and must be byte-unchanged.

**Steps**:

1. Run `pnpm check`; assert lint, format, typecheck, tests, boundaries, and exports-parity all pass.
2. Run `bun test tests/structure tests/behaviour tests/checks tests/boundaries`; assert all suites green, including the updated inventory and boundary tests.
3. Run the naming/firewall and doc-distribution guards; assert zero new product tokens and no drift.
4. Assert the bash jobs and `scripts/**` are byte-unchanged for this change (no delivery-stack edits).
5. Confirm the CI wiring: `ts-test` discovers the new suites through `bun test`; `ts-boundaries` runs `pnpm check:boundaries`; `ts-typecheck` compiles `tests/types`; `ts-invariants` runs the secret-read boundary; `ts-license-audit` covers TC-LICENSE-001. Record that no new CI job is required unless delivery adds a new invariant script.

**Expected Outcome**:

- All existing gates stay green, the new suites are covered by existing jobs, and the bash stack is untouched.

#### TC-PLAN-001 - Implementation-basis evaluation recorded in the ticket

**Scenario Type**: Manual
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-8, AC-F8-1, DEC-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: ticket GH-188 decision comment; spec §7.1/F-8 criteria
**Tags**: @process

**Preconditions**:

- The F-8 evaluation criteria are fixed: maintenance burden vs control; offline fixture compatibility; credential-port fit; license registry; pinned-toolchain compatibility.
- The ticket comment recording the outcome exists before custom client code is written.

**Steps**:

1. Read the ticket decision comment; assert each of GitHub, GitLab, and Jira has an explicit basis and an outcome.
2. Assert the comment evaluates the alternatives against the F-8 criteria and states the Jira fallback trigger (jira.js re-evaluation at M0-S14 write ops).
3. Assert the recorded basis matches the implemented code (direct REST for GitHub/GitLab; custom read slice for Jira) or that a deviation is documented.
4. Record the comment id/URL in §10 as the evidence.

**Expected Outcome**:

- The mandated evaluation is recorded in the ticket before custom code, and its outcome matches the delivered basis. This is process evidence and cannot be mechanized; it is the only manual case in this plan.

## 6. Environments and Test Data

- **Runtime:** Bun pinned by `.bun-version`; Node only where packed-import parity requires it. `pnpm install --frozen-lockfile` and `pnpm build` precede dist-dependent and boundary suites.
- **Network:** None in CI. Trap suites use an injected fixture transport and a throwing `fetch` guard; an unfixtured request fails instead of reaching a network. Live provider validation is M0-S20 (spec NG-4, RSK-2).
- **Secrets:** No real secrets. Credentials are unique canary strings supplied through an injected environment record, never the developer's `process.env`. Fixtures contain only declared placeholders; the sanitization audit and its canary run offline.
- **Fixtures:** Hand-authored synthetic captures live under `tests/fixtures/providers/{gitlab,jira,github}/**/*.json`; trap catalogs under `tests/fixtures/providers/traps/<provider>.traps.json`; sanitization placeholders and canary cases under `tests/fixtures/providers/sanitization/`. Fixtures are never named `*.test.ts`, so temp workspaces are not discovered as suites. Fixture references use `path#/json-pointer` and stay stable across re-authoring.
- **Isolation:** Planted violations, corrupted catalogs/normalizers, allowlist mutations, and sanitization canaries live only in `tests/fixtures/**` or `mkdtemp` workspaces. Nothing is written under `packages/**`; `git status --porcelain` is checked before/after read-only scans.
- **Determinism:** Trap predicates use an injected clock/threshold where time is involved (stalls); no sleeps, no real `$HOME`, no order-dependent assertions. Trap replay is deterministic and asserted twice.
- **Test data provenance:** Fixtures are hand-authored synthetic captures modeled on recorded provider response shapes (public API documentation), sanitized per F-6 before commit; none is a copy of a live-tenant response. Their fidelity to live providers is deferred to M0-S20 for revalidation (spec §12, RSK-2).

## 7. Automation Plan and Implementation Mapping

All rows are **To Implement** unless marked otherwise. Paths are proposed under the testing strategy; the implementation plan may adjust locations while preserving every TC ID and AC trace.

### 7.1 Traceability Matrix (TC ↔ AC ↔ Suite/File)

| TC | AC | Suite / file | Execution command | Control / status |
|---|---|---|---|---|
| TC-GITLAB-001 | AC-F2-1 | `tests/behaviour/providers/gitlab-trap.test.ts`, `tests/fixtures/providers/gitlab/merge-requests.json` | `bun test tests/behaviour/providers/gitlab-trap.test.ts` | Normalized MR view plus deterministic replay; To Implement |
| TC-GITLAB-002 | AC-F2-1 | `tests/behaviour/providers/gitlab-trap.test.ts`, `pipelines-per-commit.json` | `bun test tests/behaviour/providers/gitlab-trap.test.ts` | Full per-commit set; removal fails naming `GL-PIPELINE-MULTIPLICITY`; To Implement |
| TC-GITLAB-003 | AC-F2-1 | `tests/behaviour/providers/gitlab-trap.test.ts`, `merge-status-*.json` | `bun test tests/behaviour/providers/gitlab-trap.test.ts` | Exhaustive mapping; terminal-state corruption fails by trap name; To Implement |
| TC-JIRA-001 | AC-F3-2 | `tests/behaviour/providers/jira-trap.test.ts`, `labels-replace-*.json` | `bun test tests/behaviour/providers/jira-trap.test.ts` | Before/after replace; accumulation fails naming `JIRA-LABEL-REPLACE`; To Implement |
| TC-JIRA-002 | AC-F3-2 | `tests/behaviour/providers/jira-trap.test.ts`, `custom-fields.json` | `bun test tests/behaviour/providers/jira-trap.test.ts` | Typed mapping + visible non-representation; raw-key/stringify mutations fail naming JIRA-CUSTOM-FIELD-TYPING (ADR-0006); To Implement |
| TC-JIRA-003 | AC-F3-2 | `tests/behaviour/providers/jira-trap.test.ts`, `transitions.json`, `workflow-map.json` | `bun test tests/behaviour/providers/jira-trap.test.ts` | Closed exhaustive map with mechanisms; To Implement |
| TC-JIRA-004 | AC-F3-2 | `tests/behaviour/providers/jira-trap.test.ts`, `comments-omitted.json`, `comments-empty.json` | `bun test tests/behaviour/providers/jira-trap.test.ts` | Absence ≠ present-empty; collapse-to-[] mutation fails naming JIRA-COMMENT-OMISSION (ADR-0006); To Implement |
| TC-JIRA-005 | AC-F3-1 | `tests/behaviour/providers/jira-queries.test.ts`, `tracker-queries.json` | `bun test tests/behaviour/providers/jira-queries.test.ts` | Owner hand-backs from normalized fields; To Implement |
| TC-JIRA-006 | AC-F3-1 | `tests/behaviour/providers/jira-queries.test.ts`, `tracker-queries.json` | `bun test tests/behaviour/providers/jira-queries.test.ts` | Blocked deps from typed relations; To Implement |
| TC-JIRA-007 | AC-F3-1, AC-F1-2 | `tests/behaviour/providers/jira-queries.test.ts`, `stalls.json` | `bun test tests/behaviour/providers/jira-queries.test.ts` | `updatedAt` present/absent; fabrication fails naming `JIRA-UPDATED-ABSENT`; To Implement |
| TC-JIRA-008 | AC-F3-1 | `tests/behaviour/providers/jira-queries.test.ts`, `tracker-queries.json` | `bun test tests/behaviour/providers/jira-queries.test.ts` | Hygiene from labels/status/fields; To Implement |
| TC-GITHUB-001 | AC-F4-1 | `tests/behaviour/providers/github-trap.test.ts`, `pr-review-states.json` | `bun test tests/behaviour/providers/github-trap.test.ts` | Closed review-state mapping; flattening fails by trap name; To Implement |
| TC-GITHUB-002 | AC-F4-1 | `tests/behaviour/providers/github-trap.test.ts`, `check-runs-per-sha.json` | `bun test tests/behaviour/providers/github-trap.test.ts` | Full per-SHA job set; dropped failure fails by trap name; To Implement |
| TC-GITHUB-003 | AC-F4-1 | `tests/behaviour/providers/github-trap.test.ts`, `issues.json` | `bun test tests/behaviour/providers/github-trap.test.ts` | Issue→`WorkItem` incl. `updatedAt`; To Implement |
| TC-GITHUB-004 | AC-F4-1 | `tests/behaviour/providers/github-inputs.test.ts`, `tests/fixtures/providers/github/` | `bun test tests/behaviour/providers/github-inputs.test.ts` | Complete status/verify input set; unfixtured request fails; To Implement |
| TC-TRAP-001 | AC-F5-1 | `tests/structure/trap-catalog.test.ts`, `traps/*.traps.json` | `bun test tests/structure/trap-catalog.test.ts` | Four-field schema, minima, resolvable refs, data-only; To Implement |
| TC-TRAP-002 | AC-F5-2 | `tests/behaviour/providers/*-trap.test.ts`, `tests/behaviour/providers/trap-harness.ts` | `bun test tests/behaviour/providers` | 100% offline pass; throwing-fetch guard; corrupted normalization fails by trap name; To Implement |
| TC-FIXTURE-001 | AC-F6-1 | `tests/checks/fixture-sanitization.test.ts` | `bun test tests/checks/fixture-sanitization.test.ts` | Secret/PII scan, placeholders, stable refs; To Implement |
| TC-FIXTURE-002 | AC-F6-1 | `tests/checks/fixture-sanitization.test.ts`, `sanitization/cases.ts` | `bun test tests/checks/fixture-sanitization.test.ts` | Canary per secret shape + non-vacuity; To Implement |
| TC-CONTRACT-001 | AC-F3-1, AC-F1-2 | `tests/structure/port-contract-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json`, `tests/types/workitem-updated-at.type-test.ts` | `bun test tests/structure/port-contract-inventory.test.ts`; `pnpm typecheck` | Field-shape probe, optional/readonly, removal fails by field; pins comments optionality (ADR-0006); Existing – Update |
| TC-CAP-001 | AC-F1-1 | `tests/behaviour/provider-capabilities.test.ts`, `tests/fixtures/ports/capabilities.ts` | `bun test tests/behaviour/provider-capabilities.test.ts` | Closed set, complete gaps, per-client posture, mutations; Existing – Update |
| TC-SURFACE-001 | AC-F1-2 | `tests/structure/provider-surface.test.ts`, `tests/types/provider-views.type-test.ts` | `bun test tests/structure/provider-surface.test.ts`; `pnpm typecheck` | Export inventory + assignability; native export fails by name; To Implement |
| TC-BOUNDARY-001 | AC-F1-2, AC-F7-1 | `tests/boundaries/boundaries.test.ts`, `tests/boundaries/fixtures/cases.ts`, `tests/boundaries/fixture-registry.json`, `.dependency-cruiser.cjs` | `bun test tests/boundaries`; `pnpm check:boundaries` | Positive admission + registry/azure/ci/io negative + fixture coverage; Existing – Update |
| TC-CRED-001 | AC-F7-1 | `tests/behaviour/provider-credentials.test.ts`, `tests/checks/secret-read-boundary.test.ts`, `scripts/checks/secret-read-boundary.ts` | `bun test tests/behaviour/provider-credentials.test.ts tests/checks/secret-read-boundary.test.ts`; `bun run scripts/checks/secret-read-boundary.ts` | Four entries, provider-subpath planted reads fire, mutations fail closed; Existing – Update |
| TC-CRED-002 | AC-F7-2 | `tests/behaviour/provider-credentials.test.ts`, `tests/behaviour/credential-port.test.ts` | `bun test tests/behaviour/provider-credentials.test.ts tests/behaviour/credential-port.test.ts` | Absent/empty classified; transport not called; no leak; Existing – Update |
| TC-LICENSE-001 | NFR-6 | `tests/checks/license-audit.test.ts`, `scripts/checks/license-audit.ts`, `doc/legal/dependency-licenses.yaml` | `bun test tests/checks/license-audit.test.ts`; `bun run scripts/checks/license-audit.ts` | Zero new deps; fail-closed registry; Existing – No Change expected |
| TC-GATE-001 | NFR-7 | `package.json`, `.github/workflows/ci.yml`, existing suites | `pnpm check`; `bun test tests/structure tests/behaviour tests/checks tests/boundaries`; `bun run scripts/checks/forbidden-literals.ts`; `bash scripts/.tests/test-doc-distribution.sh` | Aggregate + CI wiring + bash immutability; Existing – No Change expected |
| TC-PLAN-001 | AC-F8-1 | ticket GH-188 decision comment | Manual review (record comment id/URL in §10) | Process evidence only; Manual |

### 7.2 Implementation Notes and Gate Handoff

- **Testability contract for delivery:** each client seed must accept (a) a `CredentialPort` implementation and (b) a fetch-shaped provider transport as explicit construction inputs. Trap tests inject a fixture transport that resolves committed fixture responses and throws on anything unfixtured. This is the mechanism for NFR-3/F-7; it does not change the port surface consumers see.
- **Trap harness:** implement `tests/behaviour/providers/trap-harness.ts` with `runTrapCatalog({ catalogRoot, client, transport })` returning per-entry results keyed by trap name. Every failure message must include the trap name and fixture reference. The catalog root must be a parameter so §5.2 negative controls can point at temp copies.
- **Catalog↔assertion coverage:** keep a per-provider assertion map keyed by trap name; a meta-assertion fails when a catalog entry has no assertion or an assertion has no entry. This prevents a catalog that looks complete but silently skips a quirk.
- **Fixtures:** commit sanitized hand-authored synthetic captures under `tests/fixtures/providers/**`; fixture references are `path#/json-pointer`. Re-authoring keeps the path and pointer stable; if a pointer must move, the catalog update is a reviewed diff (AC-F6-1).
- **Sanitization audit:** implement `scripts`-style purity in `tests/checks/fixture-sanitization.test.ts` with an exported `scan(root)` exercised by the canary cases. Run it from `bun test` (already CI-wired via `pnpm test`); no new CI job is required. Value-level privacy scanning remains M0-S15.
- **Contract inventory:** `tests/fixtures/ports/v1-contract-inventory.json` pins export names, so adding a field does not change it. Extend `port-contract-inventory.test.ts` with a field-shape fixture/probe for `WorkItem` (all fields, optionality, readonly) so ADR-0004 C-1 is mechanically proven. Add `tests/types/workitem-updated-at.type-test.ts` to the `tests/types/tsconfig.json` project.
- **Boundary rules:** update the `runtime-apis-confinement` `pathNot` array to include `github|gitlab|jira` with per-subpath reason comments; update the literal assertion in `tests/boundaries/boundaries.test.ts`; add clean controls (`runtime-control-provider-{github,gitlab,jira}`) to `cases.ts` and register them; keep `runtime-node-fs-adapter-registry`, `runtime-node-fs-adapter-io`, and add `azure`/`ci` negative cases. Do not add `registry` to the allowance.
- **Secret-read boundary:** do not touch `SECRET_READ_ALLOWLIST`; add planted-violation fixtures for the three provider subpaths to `tests/fixtures/secret-boundary/cases.ts` and assert the count stays exactly four. The check remains a binding `ts-invariants` step and `check:boundaries` stage.
- **Capability declarations:** declare gaps for every unsupported operation; record the reason mapping in the plan/fixtures so TC-CAP-001 can assert it without weakening to "any valid reason" after delivery.
- **CI wiring:** `ts-test` runs `pnpm test` (discovers `tests/structure`, `tests/behaviour`, `tests/checks`, `tests/boundaries`); `ts-typecheck` runs `pnpm typecheck` (includes `tests/types/tsconfig.json`); `ts-boundaries` runs `pnpm check:boundaries`; `ts-invariants` runs the static checks incl. `secret-read-boundary.ts`; `ts-license-audit` runs the license audit; `ts-aggregate` runs `pnpm check`. No live-network job exists and none is added.
- **Gate handoff commands to record in §10:** `pnpm install --frozen-lockfile`; `pnpm build`; `bun test tests/structure tests/behaviour tests/checks tests/boundaries`; `bun run scripts/checks/secret-read-boundary.ts`; `bun run scripts/checks/license-audit.ts`; `bun run scripts/checks/forbidden-literals.ts`; `pnpm check:boundaries`; `pnpm typecheck`; `pnpm check`; `git diff --check`.
- **Do not record unrun evidence as passing.** The implementation plan may rename files; preserve TC IDs and update only the location/command columns.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **Catalog completeness can be illusory.** A four-field entry proves documentation, not that the assertion fires. TC-TRAP-002's corrupted-normalization control and the bidirectional catalog↔assertion meta-check are the mitigation; both must be implemented, not stubbed.
- **Offline proof is only as strong as the transport seam.** A client that reaches `fetch` outside the injected transport would pass a naive suite. The throwing-fetch guard and an unfixtured-request failure close this; a future client that caches a module-level transport would need the same seam re-asserted.
- **Fixture fidelity is assumed.** Hand-authored synthetic captures modeled on recorded provider response shapes can drift from live provider behavior (RSK-2); this change cannot detect drift offline. M0-S20's scheduled live runs are the drift detector; fixtures are dated and re-authorable with stable references.
- **Sanitization is pattern-based.** TC-FIXTURE-001/002 prove declared placeholder discipline and canary shapes, not universal secret absence. A novel secret format or a secret in an allowed string field could pass; M0-S15 owns the durable scan (RSK-3 residual risk L).
- **Confinement allowlist erosion.** Exact-path entries plus negative controls (registry/azure/ci/io) and the literal `pathNot` assertion in `boundaries.test.ts` mitigate RSK-4; widening to `providers/**` must fail.
- **Custom-field/comment-omission representations are settled but bounded (ADR-0006).** Residual: hygiene conformance for unmapped tenant custom fields and the *cause* of comment omission are unrepresented until a named consumer justifies a further additive extension; fixtures prove only the committed synthetic shapes they contain (M0-S20 revalidates).
- **Merge-status mapping is under-specified.** The spec says asynchronous/multi-valued native semantics become delivery-meaningful states without silent flattening, but does not pin the native→delivery table or whether mergeability has a dedicated field. TC-GITLAB-003 asserts exhaustiveness/non-flattening; the concrete mapping must be recorded at delivery (§8.3 OQ-D).
- **`updatedAt` string normalization is ambiguous.** ADR-0004/DM-6 say ISO-8601 UTC and "normalized verbatim"; provider values may carry offsets or millisecond precision. Tests assert parseable UTC and non-fabrication, not byte-identical formatting, until the plan records the rule (§8.3 OQ-E).
- **Gap reason taxonomy is not pinned per operation.** TC-CAP-001 asserts closed-set validity and gapped-ness; without a recorded mapping, a delivered reason could be defensible but inconsistent (§8.3 OQ-G).

### 8.2 Assumptions

- The change specification is the single source of truth; no quirk family, fixture, or requirement is invented beyond the spec, ticket, and ADRs.
- The client seeds accept injected credentials and transport, so trap tests are hermetic and deterministic (mechanism for NFR-3/F-7).
- Fixtures are hand-authored synthetic captures modeled on recorded provider response shapes (public API documentation), sanitized per F-6; live-tenant revalidation is M0-S20's concern (RSK-2).
- The Jira slice returns normalized data only; the M0-S6 collector's four predicates are test-local stand-ins in this change, not delivered commands.
- GitHub status/verify consume the slice's input set; the commands are downstream (DEC-5), so TC-GITHUB-004 proves input completeness, not command behavior.
- The implementation basis recorded in the ticket (native `fetch`; custom Jira read slice; zero new dependencies) holds; a basis change is a new change with its own license-registry impact.
- The implementation plan is absent; when it lands, TC IDs and AC coverage are preserved and only locations/commands are reconciled.
- No license headers are added manually in this change; change artifacts are header-free.

### 8.3 Open Questions

| Item | Owner / timing | Blocking? |
|---|---|---|
| OQ-A: **Custom-field destination.** Resolved 2026-10-31 — outcome: ADR-0006. Documented mapping semantics only: mapped custom fields feed normalized fields as typed data; unmapped fields are visibly unrepresented; no v1 contract change. | Spec writer + @decision-advisor before delivery | Resolved — no longer blocking. |
| OQ-B: **Comment-omission representation.** Resolved 2026-10-31 — outcome: ADR-0006. `WorkItem.comments` becomes optional: absent = comment set unknown; present (incl. empty) = the provider-asserted set; pinned by TC-CONTRACT-001. | Spec writer + @decision-advisor before delivery | Resolved — no longer blocking. |
| OQ-C: **GitLab trap minimum vs named families.** The spec names two GitLab quirk clauses (pipeline multiplicity; asynchronous/multi-valued merge status) but NFR-2 requires ≥3 entries. This plan splits merge status into async and multi-valued variant entries per OQ-3's allowance. | PM / spec writer at DoR | Not blocking; confirm the split counts as three entries or let delivery add a third named family. |
| OQ-D: **Merge-status mapping table.** Record the native values and their delivery mapping (and whether mergeability needs a dedicated field) so TC-GITLAB-003 can assert concrete outcomes, not only exhaustiveness/non-flattening. | Plan writer / delivery | Not blocking authoring; needed for exact evidence. |
| OQ-E: **`updatedAt` string policy.** Decide verbatim provider string vs canonical UTC ISO-8601 rendering; align DM-6 wording ("normalized verbatim") with ISO-8601 UTC. | Spec writer / plan writer | Not blocking; tests assert UTC-parseable + non-fabricated now. |
| OQ-F: **Contract-inventory claim.** The spec/ADR say the inventory test pins exact contract shape, but the committed fixture pins export names only. This plan adds a field-shape probe; confirm that satisfies ADR-0004 C-1 or extend the fixture format. | Plan writer / delivery | Not blocking; mechanical consequence documented in TC-CONTRACT-001. |
| OQ-G: **Gap reason per operation.** Record `provider-unsupported` vs `adapter-not-implemented` vs `plan-restriction` for each gapped operation so TC-CAP-001 can assert the mapping after delivery. | Plan writer / delivery | Not blocking; tests assert validity + gapped-ness now. |
| OQ-H: **Fixture provenance.** Resolved 2026-10-31 — fixtures are hand-authored synthetic captures modeled on recorded provider response shapes (public API documentation), sanitized per F-6; none is a live-tenant capture, and live-tenant revalidation is deferred to M0-S20 (RSK-2). Per-fixture authoring dates are recorded in the fixture files themselves as provenance markers (per plan OQ-H) for auditability. | Delivery / M0-S20 | Resolved — no longer blocking. |

No AC is left without a mapped test. Twelve of twelve ACs are traced and fully assertable; OQ-A/OQ-B are resolved by ADR-0006, OQ-H is resolved by the fixture-provenance correction aligned with the spec, and AC-F8-1 is process evidence (manual). The remaining open questions are recorded above rather than hidden.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T12:00:00Z | Change Test Plan Writer | Initial plan: 28 test cases across structure/behaviour/type/checks/boundaries/aggregate, 12/12 spec-AC traceability (two AC-F3-2 clauses TODO and raised as OQ-A/OQ-B), trap-catalog index (GitLab 3, Jira 5, GitHub 3), sanitization audit + canary, four-entry secret-read boundary, ADR-0004 field probe, ADR-0005 boundary controls, capability honesty, license and gate integrity, and the ticket-AC mapping; no execution claimed. |
| 1.1 | 2026-10-31T13:00:00Z | Change Test Plan Writer | Correction pass after ADR-0006: TC-JIRA-002/TC-JIRA-004 unblocked with concrete assertions (custom-field mapping semantics; optional `comments` absence semantics); TODO markers removed from §1.1/§1.2/§3.1/§5.1/§7.1; DM-7/DM-8 coverage rows added; TC-CONTRACT-001 extended to pin `comments` optionality; §8.1 risk and §8.3 OQ-A/OQ-B resolved. |
| 1.2 | 2026-10-31T14:30:00Z | Change Test Plan Writer | DoR remediation: fixture provenance aligned with spec v1.3 — hand-authored synthetic captures modeled on recorded provider response shapes; §2 reference ranges updated to v1.2 numbering. |

## 10. Test Execution Log

Delivery executed phases P1–P7 on `feat/GH-188/client-seeds-trap-catalogs`; the
independent review (`@reviewer`) is a separate lifecycle phase. Gate battery run
at code HEAD `409781d` (docs for this log land after it).

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| TC-CONTRACT-001 | 2026-10-31 | PASS | `port-contract-inventory.test.ts` field-shape probe + `workitem-{updated-at,comments}.type-test.ts`; removal/re-tighten mutations fail by field; `pnpm typecheck` green. |
| TC-BOUNDARY-001 | 2026-10-31 | PASS | `bun test tests/boundaries` (124 pass): provider clean controls, azure/ci/registry/io negatives, exact `pathNot` literal, widening guard. |
| TC-JIRA-001–004 | 2026-10-31 | PASS | `tests/behaviour/providers/jira-trap.test.ts`; 5 entries pass offline; corrupted normalization fails by trap name + fixture. |
| TC-JIRA-005–008 | 2026-10-31 | PASS | `tests/behaviour/providers/jira-queries.test.ts`; four families from normalized `WorkItem`; fabrication fails `JIRA-UPDATED-ABSENT`. |
| TC-GITLAB-001–003 | 2026-10-31 | PASS | `tests/behaviour/providers/gitlab-trap.test.ts`; per-commit set, declared merge-status table, precedence and async non-terminal; mutations fail by name. |
| TC-GITHUB-001–003 | 2026-10-31 | PASS | `tests/behaviour/providers/github-trap.test.ts`; review-state table, per-SHA check runs (failed run not hidden), issue→`WorkItem`. |
| TC-GITHUB-004 | 2026-10-31 | PASS | `tests/behaviour/providers/github-inputs.test.ts`; exactly `DeliveryRequest`+`PipelineRun`+`WorkItem`; unfixtured request fails. |
| TC-TRAP-001 | 2026-10-31 | PASS | `tests/structure/trap-catalog.test.ts`; four-field schema, minima 3/5/3, resolvable pointers, mutations fail by name. |
| TC-TRAP-002 | 2026-10-31 | PASS | `tests/behaviour/providers/trap-harness.test.ts` + per-client suites; throwing-`fetch` guard records 0 calls; double replay identical; bidirectional coverage enforced. |
| TC-FIXTURE-001/002 | 2026-10-31 | PASS | `tests/checks/fixture-sanitization.test.ts`; live tree clean, declared placeholders all used, 10 canary shapes fire with file/line. |
| TC-CAP-001 | 2026-10-31 | PASS | `tests/behaviour/providers/provider-capabilities.test.ts`; exact OQ-G postures; declaration↔implementation pairs; mutations fail. |
| TC-SURFACE-001 | 2026-10-31 | PASS | `tests/structure/provider-surface.test.ts` + `provider-views.type-test.ts`; exact export surfaces; native/parallel-view mutations fail. |
| TC-CRED-001/002 | 2026-10-31 | PASS | `tests/behaviour/providers/provider-credentials.test.ts`, `tests/checks/secret-read-boundary.test.ts`; allowlist exactly 4; planted reads fire in all three subpaths; classified failure exact. |
| TC-LICENSE-001 | 2026-10-31 | PASS | `bun run scripts/checks/license-audit.ts`; manifests/lockfile byte-unchanged vs `origin/main-tools` (zero new dependencies). |
| TC-GATE-001 | 2026-10-31 | PASS | `pnpm install --frozen-lockfile`; `pnpm build`; `bun test tests/structure tests/behaviour tests/checks tests/boundaries` (756 pass); `pnpm check:boundaries`; `pnpm typecheck`; `pnpm check`; `bash scripts/.tests/test-doc-distribution.sh`; `git diff --check`. |
| TC-PLAN-001 | 2026-10-31 | PASS (process evidence) | Implementation basis recorded at ticket comment 6536692124 per plan; delivery did not re-query the ticket. Code matches the recorded basis (direct REST + custom Jira read slice, zero new dependencies). |
| Code HEAD | 2026-10-31 | GREEN | P1 `a335093`, P2 `07a3834`, P3 `10dce1e`, P4 `a11bc53`, P5 `efda29f`, P6 `9a136e3`, P7 `409781d`; `pnpm check` green at every phase commit. |
