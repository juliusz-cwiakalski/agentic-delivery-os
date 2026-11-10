---
id: chg-GH-279-test-plan
status: Updated
created: 2026-11-10T00:00:00Z
last_updated: 2026-11-10T11:30:00Z
owners: [engineering]
service: delivery-os dispatch engine
labels: [change, dispatch, credentials, diagnostics, reliability]
version_impact: minor
summary: "Traceable verification of the GH-279 dispatch admission preflight, named-source refusals, status-keyed read-outcome classification, local-only typed divergence resolution, deduplicated delivered-evidence divergence recording, status credential prerequisite, and the documentation/conformance pins. Every one of the 30 acceptance criteria maps to at least one of 61 test cases (59 automated, one semi-automated documentation content check, one manual amendment inspection) driven through injected ports and fakes (bun:test) with no real network, harness, keyring, or token; the two delivered composition suites that currently pin spawn-then-state-unverified are inverted to zero-spawn plus a typed pre-session refusal, guarded by a positive control and a no-preflight control that prove the inversion is caused by the preflight and not by the fixture. Three boundary behaviours are proven where they are produced rather than where they are consumed: the received-2xx stamp on a decode failure is driven through the real GitHub client with an injected transport (TC-READMAP-010), the trusted-refusal marker that lets the bounded credential refusal carry prose is proven against the delivered untrusted-config suppression (TC-CREDNAME-007), and the attempt-append-failure orphan direction is proven to stay listed, countable, and locally resolvable (TC-DIVREC-011). Five review questions are resolved in §8.4: the divergence-append-failure contract (TC-DIVREC-008), the guide path, behavior-level diagnostics assertions, a digest-derived status prerequisite section set, and the orphan divergence accepted in the opposite append direction."
links:
  change_spec: ./chg-GH-279-spec.md
  implementation_plan: ./chg-GH-279-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Preflight the truth-read credential before spawn; typed credential and divergence diagnostics

## 1. Scope and Objectives

This plan governs the verification of a refusal, not a feature: a dispatch must refuse **before any dispatch side effect exists** when the truth-read credential is unresolvable or the first bounded truth read fails, must name the exact resolved key and the reference without ever rendering the value, must keep `dispatch dual-run resolve` on local evidence with its real typed state identity, and must leave one open, resolvable, deduplicated divergence when a dispatch delivered evidenced work it could not verify. The two delivered composition suites currently assert the replaced behaviour — a refusing credential port still spawns once and yields `result=state-unverified` with one attempt record — so those assertions are inverted in this change, not deleted, and the plan carries a positive control (credential resolves → verdict other than `state-unverified`) and a no-preflight control (optional port omitted → delivered run order preserved) so the inversion cannot pass vacuously.

Three properties are load-bearing and are tested independently so one cannot pass behind another:

1. **Ordering and side-effect freedom.** Zero spawns, zero resumes, zero lease claims, zero attempt/divergence/handover/authority writes, no branch, no worktree, no session, and fewer than 2 000 ms on the missing-credential path. A successful resolve is proven only with spy ports and a local ledger, never by "it did not fail".
2. **Classification at the production boundary.** Each admission read failure is classified from the failure's optional provider status into identity **and** domain kind **and** projection **and** exit together, because a correct code under the wrong kind silently classifies as `fallback.internal`.
3. **Honest evidence.** A delivered-but-unverifiable attempt opens exactly one open divergence per (repository, work-item reference), evaluated from the shared classifier's `completed` outcome and the readable ledger — never from the persisted attempt outcome `failed` — and that divergence is listed, counted, and resolvable with local evidence alone.

### 1.1 In Scope

- Pre-session preflight ordering, refusal envelope, zero dispatch-ledger side effects, latency bound, read budget, and determinism (F-1, F-2, NFR-1, NFR-3, NFR-4, NFR-6, DEC-1, DEC-11).
- Read-outcome classification at the production boundary for 401, 403, 5xx, other status-bearing non-2xx, 404, status-absent transport throw/timeout, and received-but-malformed 2xx (which carries the received 2xx status), each with identity, kind, projection, and exit, plus the malformed-vs-transport discriminator pair proven at the adapter surface that produces the stamp (F-2.4–F-2.6, NFR-13, DEC-7).
- Named-source diagnostics in machine and human form, full derived key for environment-prefixed references, secret non-disclosure under a planted canary, bounded summaries, the trusted-refusal marker that admits the bounded refusal prose past the delivered untrusted-config suppression, and runtime-edge redaction registration from injected environment facts (F-2.1–F-2.3, F-5.8, NFR-2, NFR-5).
- Type-preserving, local-only divergence resolution: zero credential/transport invocations, `kind: "state"` per store identity, the distinguishable not-found sentinel, note clamping, append-only integrity, and idempotent replay (F-3, DM-5, NFR-7, NFR-11, NFR-14).
- Delivered-evidence divergence recording: the predicate conjuncts, the declared record shape, attempt↔divergence correlation, per-(repository, ref) dedupe, summary listing/counting, resolution decrement, both append-failure directions (a failed divergence append and a failed attempt append that leaves an open orphan divergence), and append-failure observability (F-4, DM-2, DM-3, DM-6).
- Status credential prerequisite as an additive optional section-level field, with unchanged `sources[]` shape/bound, unchanged section/state/finding vocabulary, and no fabricated zero (F-6.1–F-6.4, DM-4, DEC-8).
- Doctor parity only: the existing `tracker.credential-unavailable` hint names the resolved key and doctor stays unshipped (F-6.5, DEC-5).
- Documentation and conformance pins: the new provisioning guide, the dispatch reference page, the distribution-marker drift guard, the help inventory, and the error-table/taxonomy sync (F-5, NFR-8, NFR-9, NFR-10, NFR-12).

### 1.2 Out of Scope & Known Gaps

- **G-1 — no real network, harness, keyring, `gh`, or token.** Every case runs through injected ports and fakes: a recording credential port, a recording transport, a scripted harness session port, and temp state roots. Real-provider read behaviour is represented at two depths: the **real** GitHub client and normalizer are driven with an injected transport by TC-READMAP-010, which is the only way to prove that the received `2xx` status is stamped on a decode failure (a `200` with a malformed body → `provider.payload.invalid` **with** `httpStatus: 200`; a transport throw → the same identity **without** any status; a `404` → `provider.not-found`; another non-2xx keeps its status); every engine-level case then consumes a double that reproduces that documented contract. No test calls GitHub, and the credential value never leaves an injected environment record. The one real credentialed dispatch required by spec §18 is **PR evidence**, recorded as manual verification MV-1/MV-2, not a test case (NG-9, OUT).
- **G-2 — the pre-existing `DIV-GH-275-…` divergence is evidence, not a target.** It stays open and is never resolved, mutated, or used as a test fixture input from the live state directory (NG-7, §19). A local synthetic divergence stands in wherever a resolvable record is needed.
- **G-3 — the invocation audit ledger is not asserted.** A pre-session refusal is neither written to nor read from the invocation audit ledger; the accepted residual is that repeated misconfiguration is invisible after the fact (NFR-3, F-1.6, RSK-12). No TC claims audit observability.
- **G-4 — daemon-driven lane launches are not covered.** The preflight applies to a fresh dispatch and a resume only (F-1.8); daemon lane admission is deferred (NG-8, §7.3).
- **G-5 — historical backfill is not covered.** No divergence is asserted for attempts recorded before this change; only forward recording is tested (§19, NG-7).
- **G-6 — operator shell behaviour is documentation, not enforcement.** Shell-history hygiene, `/proc` exposure of an exported token, and rotation practice are documented claims verified as prose (TC-DOCS-001), never as runtime behaviour (RSK-4, RSK-14).
- **G-7 — diagnostics are asserted behavior-level, not as prose goldens.** The machine envelope summary and the human diagnostic are asserted to contain the resolved key and the reference as substrings, with one remediation, one line, ≤ 240 characters, and the canary value absent from every surface; full prose sentences are never pinned. Byte-level goldens pin the envelope **shape** and the classified fields only (resolved OQ-3, §8.4).
- **Not applicable:** schema migration, telemetry exporters, UI, E2E browser execution, and any new endpoint. One additional bounded read is added against an existing endpoint; `API-*` therefore has no new identifier and is covered through `TC-ADMIT-010` and `TC-READMAP-*`.
- **Not applicable:** resolving the pre-existing divergence, backfilling, shipping `doctor`, changing the bash fallback, or changing the four-condition handover predicate (NG-1, NG-6, NG-7, NG-10). The TDR-0015 amendment is verified as a documentation obligation of the change record (TC-DOCS-004), not re-tested as gate behaviour beyond the amended cases.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-279-spec.md`](./chg-GH-279-spec.md) | Authoritative source: F-1…F-6, AC-F1-1…AC-F6-3 (30 criteria), NFR-1…NFR-14, DM-1…DM-6, DEC-1…DEC-11, Appendix A (admission decision table), Appendix B (divergence shape), Appendix C (refusal diagnostics) |
| [`chg-GH-279-pm-notes.yaml`](./chg-GH-279-pm-notes.yaml) | PM decisions D1–D5 (pre-session refusal, local-only resolve, one open divergence, documentation-only bridge, doctor unshipped) |
| [TDR-0019](../../../decisions/TDR-0019-dispatch-admission-credential-preflight.md) | Admission preflight decision: C-1…C-6, the status-keyed mapping, the stamped-`httpStatus` discriminator, wiring/ordering verification criteria |
| [TDR-0020](../../../decisions/TDR-0020-dispatch-divergence-recording-and-resolution.md) | Divergence recording/resolution decision: delivered-evidence predicate, `divergence-not-found` sentinel, per-work-item dedupe, append-only integrity |
| [TDR-0015](../../../decisions/TDR-0015-dispatch-handover-gate-operational-semantics.md) | Amended gate semantics: the four additive GH-279 notes (not re-tested here beyond the amended cases) |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Test layers, module→test mapping, `pnpm check`, fixture and invariant-test conventions |
| [`packages/core/src/app/dispatch.ts`](../../../../packages/core/src/app/dispatch.ts) | Engine admission order, `DispatchRunResult` error-kind union, divergence append step |
| [`packages/core/src/app/dispatch-gate.ts`](../../../../packages/core/src/app/dispatch-gate.ts) | Resolve path and its current diagnostic collapse — the behaviour TC-RESOLVE-* replaces |
| [`packages/core/src/domain/dispatch-result.ts`](../../../../packages/core/src/domain/dispatch-result.ts) | `DISPATCH_READ_FAILURE_SOURCES` closed set (`ledger`, `tracker`, `artifact`, `state`; no `ci`) |
| [`packages/cli/src/production.ts`](../../../../packages/cli/src/production.ts) | `github-read` / `GITHUB_TOKEN` declaration, process credential port, status-keyed classification boundary |
| [`packages/adapters/src/github/client.ts`](../../../../packages/adapters/src/github/client.ts) + [`normalize.ts`](../../../../packages/adapters/src/github/normalize.ts) | Real adapter read path that must stamp the received `2xx` status onto a decode failure (TC-READMAP-010) |
| [`packages/adapters/src/io/provider-transport.ts`](../../../../packages/adapters/src/io/provider-transport.ts) | Optional `httpStatus` on the adapter read-failure union and the bounded read's failure factory |
| [`packages/cli/src/classify.ts`](../../../../packages/cli/src/classify.ts) | `classifyDomainKind` kind/code exactness and `fallback.internal` containment |
| [`packages/cli/src/index.ts`](../../../../packages/cli/src/index.ts) | `failureOutcome` suppression of summary/remediation on any config-shaped failure — the behaviour the trusted-refusal marker must not reopen (TC-CREDNAME-007) |
| [`packages/core/src/contracts/result.ts`](../../../../packages/core/src/contracts/result.ts) | `CommandResultError` field set (`code`, `category`, `retryable`, `consequence`, `remediationHint`, `summary`) — the envelope bounds TC-DIVREC-008 asserts against |
| [`packages/cli/src/edge.ts`](../../../../packages/cli/src/edge.ts) | `registerEdgeSecrets` registration seam and the gate runtime composition (no credential, no transport) |
| [`tests/structure/dispatch-composition.test.ts`](../../../../tests/structure/dispatch-composition.test.ts) | The two suites this change inverts (`starterInvocations` length 1 + `result=state-unverified`; `credentialMissing` → `state-unverified`) |
| [`tests/behaviour/providers/github-inputs.test.ts`](../../../../tests/behaviour/providers/github-inputs.test.ts) | Real GitHub client over an injected fixture transport — the read-input path where the malformed-`2xx` stamp is proven (TC-READMAP-010) |
| [`tests/behaviour/providers/github-trap.test.ts`](../../../../tests/behaviour/providers/github-trap.test.ts) | The `GH-PAYLOAD-HTTP-STATUS` trap that already pins status-bearing non-2xx, `404`, and status-absent transport failures; extended with the stamped-`2xx` case (TC-READMAP-010) |
| [`tests/behaviour/error-classification.test.ts`](../../../../tests/behaviour/error-classification.test.ts) | Delivered untrusted-config summary/remediation suppression pins the trusted-refusal marker must keep green (TC-CREDNAME-007) |
| [`tests/behaviour/dispatch-divergence.test.ts`](../../../../tests/behaviour/dispatch-divergence.test.ts) | The delivered "not-applicable appends no divergence" assertion this change narrows for delivered evidence |
| [`tests/fixtures/dispatch/`](../../../../tests/fixtures/dispatch) | Dispatch harness, truth builders, ledger builders, goldens |
| [`tests/fixtures/credentials/cases.ts`](../../../../tests/fixtures/credentials/cases.ts) | Canary, literal and environment-prefixed reference fixtures |
| [`tests/fixtures/status/harness.ts`](../../../../tests/fixtures/status/harness.ts) | Status runtime, instance reference (`github-read`/`GITHUB_TOKEN`), credential-unavailable read fixtures |
| [`tests/fixtures/doctor/harness.ts`](../../../../tests/fixtures/doctor/harness.ts) | Doctor `CREDENTIAL_MISSING` fixture carrying `envVar` |
| [`tests/fixtures/ports/v1-contract-inventory.json`](../../../../tests/fixtures/ports/v1-contract-inventory.json) | Exact contract export inventory — must move only for the additive preflight type |
| [`doc/planning/oss-tooling/milestones/m1/commands/dispatch.md`](../../../planning/oss-tooling/milestones/m1/commands/dispatch.md) | Dispatch reference page under conformance pin |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

Every acceptance criterion appears exactly once in the forward table; no criterion is left to inference.

| AC ID | Requirement (condensed) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | Unresolvable credential → `config.credential.missing`, exit 1, summary names key + reference, < 2 000 ms, zero spawns/resumes | TC-ADMIT-001, TC-ADMIT-009 | Covered |
| AC-F1-2 | Zero leases, attempt/divergence/handover records, authority changes; no branch/worktree/session; audit ledger not asserted | TC-ADMIT-002 | Covered |
| AC-F1-3 | Read status 401/403 → `provider.auth.rejected` (provider, user, non-retryable, `not_landed`, user-validation, exit 1); 5xx → `provider.outage` (provider, transient, retryable, `not_landed`, platform-provider, exit 2); zero spawns/attempts | TC-READMAP-001, TC-READMAP-002, TC-ADMIT-006 | Covered |
| AC-F1-4 | Unknown harness / malformed ref → delivered input refusal, preflight never invoked, no session | TC-ADMIT-003 | Covered |
| AC-F1-5 | Credential + read + truth all succeed → verdict ≠ `state-unverified`, exactly one attempt, comparison from readable truth | TC-ADMIT-004 | Covered |
| AC-F1-6 | Read status 404 → `input.value.rejected` (input, user-validation, exit 1), summary names ref and states provider-reported absence, never asserts the ref is wrong, zero spawns/attempts | TC-READMAP-003 | Covered |
| AC-F1-7 | Malformed 2xx carrying the received 2xx status → adapter-local `provider.payload.invalid` (provider, platform-provider), zero spawns/attempts, distinguishable from a status-absent transport failure | TC-READMAP-004, TC-READMAP-007, TC-READMAP-010 | Covered |
| AC-F2-1 | Literal `github-read`/`GITHUB_TOKEN` unset → machine **and** human modes name both plus one remediation, no credential value; the trusted-refusal marker is what lets the bounded refusal prose past the untrusted-config suppression | TC-CREDNAME-001, TC-CREDNAME-005, TC-CREDNAME-007 | Covered |
| AC-F2-2 | Environment-prefixed reference reports the full derived key (prefix + suffix), never the bare suffix | TC-CREDNAME-002 | Covered |
| AC-F2-3 | Registered planted value appears in zero envelopes, human diagnostics, summaries, evidence refs, attempt records, divergence records | TC-CREDNAME-003, TC-CREDNAME-004 | Covered |
| AC-F2-4 | Adapter `provider.payload.invalid` + 401 → `provider.auth.rejected`; 429/other non-2xx → `provider.outage`; 404 → `input.value.rejected`; the adapter identity is never forwarded | TC-READMAP-001, TC-READMAP-002, TC-READMAP-003, TC-READMAP-005, TC-READMAP-008 | Covered |
| AC-F2-5 | Provider identities carry `kind: "provider"`; 404 carries `kind: "input"`; `config.credential.missing` carries `kind: "config"` and classifies to its own row; no `fallback.internal`; the engine result error-kind union admits the existing `provider` and `config` kinds additively; `DOMAIN_KINDS` and error-table row count unchanged; no code under a mismatched kind | TC-READMAP-008, TC-REG-002 | Covered |
| AC-F2-6 | Malformed 2xx → `provider.payload.invalid` **carrying the received 2xx status** (`httpStatus: 200`); a status-absent transport throw → `provider.outage`; the pair stays distinguishable by status presence, proven at the adapter that stamps it | TC-READMAP-004, TC-READMAP-007, TC-READMAP-010 | Covered |
| AC-F3-1 | Resolve succeeds from local evidence with spy credential and transport never invoked | TC-RESOLVE-001 | Covered |
| AC-F3-2 | `state.lock.busy` → `kind: "state"`, own category/retryability/consequence/remediation/exit; never dispatch-kind; never `dispatch.state-unverified` | TC-RESOLVE-002 | Covered |
| AC-F3-3 | `state.store.torn` / `state.write.failed` → exact identity, `kind: "state"`, own projection, no record appended | TC-RESOLVE-003 | Covered |
| AC-F3-4 | > 240-character note clamps, resolution lands, stored note ≤ 240, no `state.write.failed` | TC-RESOLVE-004 | Covered |
| AC-F3-5 | Absent divergence id → `input.value.rejected` with `kind: "input"`, nothing appended, never `state.keys.missing` | TC-RESOLVE-005, TC-RESOLVE-006 | Covered |
| AC-F4-1 | Classifier `completed` + readable progressed/completed ledger + unreadable truth + no open divergence → one open divergence of the declared shape; attempt carries `divergenceRef`; reason ∈ {ledger, tracker, artifact, state} | TC-DIVREC-001, TC-DIVREC-006, TC-DIVREC-007 | Covered |
| AC-F4-2 | Summary exits 0, lists the divergence, counts it unresolved; resolving decrements by exactly one; attempt and both records remain readable | TC-DIVREC-004 | Covered |
| AC-F4-3 | Non-completed outcome, unreadable ledger, or no-progress/incomplete total → zero divergences; persisted `failed` never evidences delivery | TC-DIVREC-002 | Covered |
| AC-F4-4 | Open divergence for the pair exists on a resume → no second append, new attempt references it, unresolved count unchanged | TC-DIVREC-003, TC-DIVREC-009 | Covered |
| AC-F4-5 | After resolution a later delivered-but-unverifiable attempt may open a new one; while open it may not | TC-DIVREC-005 | Covered |
| AC-F5-1 | Guide names `GITHUB_TOKEN`, `github-read`, the explicit `gh` export bridge, no keyring/ambient/fallback, least-privilege and rotation/revocation guidance | TC-DOCS-001 | Covered |
| AC-F5-2 | Reference page documents pre-`claimLease` ordering, named key/reference, status-keyed identity/kind/exit mapping, 404 scope caveat, per-work-item dedupe, resolution path | TC-DOCS-002 | Covered |
| AC-F5-3 | Every changed guides document declares `ados_distribution`; `test-doc-distribution.sh` passes | TC-DOCS-003 | Covered |
| AC-F5-4 | **Split halves.** (a) Redaction/parity half (status phase): truth-read key present in injected environment → value scrubbed by the redaction chokepoint at the runtime edge. (b) Guide-content half (docs phase): the guide records the least-privilege expectation and the registration-by-this-change fact | (a) TC-CREDNAME-006 · (b) TC-DOCS-001 | Covered — (a) Phase 7, (b) Phase 8 |
| AC-F6-1 | Unresolvable credential → credential-dependent sections `unknown`/failed/`credential-unavailable`, evidence carries `credentialPrerequisite {referenceName, sourceKey}`, no `sources[]` entry added, exit 0 with nine sections; absent when readable and on sections unavailable for another reason (set derived from the digest) | TC-STATCRED-001, TC-STATCRED-002 | Covered |
| AC-F6-2 | No section `observed`, no fabricated zero for the unread source, no finding from the failed read, no added section/state/finding code; status contract unchanged | TC-STATCRED-003 | Covered |
| AC-F6-3 | Doctor `tracker.credential-unavailable` hint names the resolved key; prompt-required inventory and help pins unchanged; doctor unshipped | TC-DOCTCRED-001, TC-DOCTCRED-002 | Covered |

Backward/negative traceability (each test case's primary link):

| TC ID | Primary demand | TC ID | Primary demand |
|---|---|---|---|
| TC-ADMIT-001 | AC-F1-1, F-1.3, F-2.1 | TC-DIVREC-001 | AC-F4-1 |
| TC-ADMIT-002 | AC-F1-2, NFR-3 | TC-DIVREC-002 | AC-F4-3 |
| TC-ADMIT-003 | AC-F1-4 | TC-DIVREC-003 | AC-F4-4 |
| TC-ADMIT-004 | AC-F1-5, F-1.7 | TC-DIVREC-004 | AC-F4-2 |
| TC-ADMIT-005 | AC-F1-1, AC-F1-2, NFR-10 | TC-DIVREC-005 | AC-F4-5 |
| TC-ADMIT-006 | AC-F1-3, F-1.6 | TC-DIVREC-006 | F-4.3, NFR-5, NFR-11 |
| TC-ADMIT-007 | F-1.8, NFR-3 | TC-DIVREC-007 | F-4.2, DM-6 |
| TC-ADMIT-008 | F-1.1, DEC-6 | TC-DIVREC-008 | NFR-11, F-4.2, DM-3 |
| TC-ADMIT-009 | NFR-1, NFR-6 | TC-DIVREC-009 | AC-F4-4, DM-6 |
| TC-ADMIT-010 | NFR-6, F-1.5 | TC-DIVREC-010 | F-4.8 |
| TC-READMAP-001 | AC-F1-3, AC-F2-4 | TC-STATCRED-001 | AC-F6-1, DM-4 |
| TC-READMAP-002 | AC-F1-3, AC-F2-4 | TC-STATCRED-002 | AC-F6-1 |
| TC-READMAP-003 | AC-F1-6, RSK-17 | TC-STATCRED-003 | AC-F6-2, F-6.4 |
| TC-READMAP-004 | AC-F1-7, AC-F2-6 (engine half) | TC-STATCRED-004 | F-6.6, NFR-2 |
| TC-READMAP-005 | AC-F2-4 | TC-DOCTCRED-001 | AC-F6-3, A-8 |
| TC-READMAP-006 | AC-F1-7, NFR-13 (status-absent) | TC-DOCTCRED-002 | AC-F6-3, DEC-5 |
| TC-READMAP-007 | AC-F2-6 (discriminator pair) | TC-DOCS-001 | AC-F5-1, AC-F5-4 (b) guide-content half |
| TC-READMAP-008 | AC-F2-5, NFR-8 | TC-DOCS-002 | AC-F5-2 |
| TC-READMAP-009 | F-2.1, F-2.6, NFR-4, NFR-5 | TC-DOCS-003 | AC-F5-3, NFR-12 |
| TC-CREDNAME-001 | AC-F2-1 | TC-DOCS-004 | F-4.9, DEC-3 |
| TC-CREDNAME-002 | AC-F2-2, DM-1 | TC-REG-001 | NFR-4 |
| TC-CREDNAME-003 | AC-F2-3, NFR-2 | TC-REG-002 | NFR-8, F-5.6 |
| TC-CREDNAME-004 | NFR-2 (negative control) | TC-REG-003 | NFR-9 |
| TC-CREDNAME-005 | NFR-5, AC-F2-1 | TC-REG-004 | NFR-8, DEC-6, DEC-11 |
| TC-CREDNAME-006 | AC-F5-4 (a) redaction/parity half, NFR-9 | TC-REG-005 | NFR-10, RSK-8 |
| TC-READMAP-010 | AC-F2-6, AC-F1-7 (adapter-stamping half) | TC-CREDNAME-007 | AC-F2-1, NFR-2 (trusted-marker control) |
| TC-DIVREC-011 | F-4.4, F-4.6 (attempt-append-failure/orphan direction), DM-2, DM-6, NFR-11, DEC-9 | — | — |
| TC-RESOLVE-001 | AC-F3-1, NFR-7 | TC-RESOLVE-005 | AC-F3-5 |
| TC-RESOLVE-002 | AC-F3-2, NFR-14 | TC-RESOLVE-006 | AC-F3-5, DEC-10 |
| TC-RESOLVE-003 | AC-F3-3, NFR-14 | TC-RESOLVE-007 | NFR-14 (negative control) |
| TC-RESOLVE-004 | AC-F3-4, NFR-11 | TC-RESOLVE-008 | F-3.5, F-3.6 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No `API-*` identifier is added: the preflight issues at most one bounded read against the existing delivered GitHub work-item read, through the same instance, reference, transport, and per-request timeout, with no write, no pagination, and no retry (spec §8.1). No `EVT-*` identifier is added (spec §8.2). Data-model elements carry the coverage:

| ID | Element | TC ID(s) | Notes |
|---|---|---|---|
| DM-1 | Preflight refusal facts (resolved key name, reference name, failing read family, work-item ref for 404, identity, domain kind) | TC-READMAP-003, TC-READMAP-008, TC-CREDNAME-001, TC-CREDNAME-002, TC-CREDNAME-007 | Names and closed tokens only; asserted together with kind and projection. TC-CREDNAME-007 proves the name-only prose actually reaches the machine envelope and the human diagnostic instead of being suppressed with the untrusted config text |
| DM-2 | Delivered-evidence divergence record shape | TC-DIVREC-001, TC-DIVREC-006, TC-DIVREC-008, TC-DIVREC-011 | `not-applicable` / `state-unverified` / `comparisonToken: null` / `attempt:<id>` + `truth:unreadable:<reason>`; the failed-append case asserts the attempt's declared evidence references (including `divergence:append-failed`) in place of a divergence record; the orphan direction asserts the record stands alone as a readable, resolvable open divergence when its attempt never landed |
| DM-3 | Attempt↔divergence correlation (`divergenceRef`) | TC-DIVREC-001, TC-DIVREC-003, TC-DIVREC-008, TC-DIVREC-011 | Includes the negative: never a `divergenceRef` to a record that was not written; a failed divergence append is declared by the bounded `divergence:append-failed` evidence reference instead; in the orphan direction no attempt exists to carry a reference, and the later attempt for the same pair references the standing open record by dedupe |
| DM-4 | Status `credentialPrerequisite {referenceName, sourceKey}` | TC-STATCRED-001, TC-STATCRED-002, TC-STATCRED-003 | Sibling of `sources[]`; source-entry shape and six-entry bound unchanged; the affected section set is derived from the digest, never hardcoded |
| DM-5 | Resolve failure diagnostic (`kind: "state"` + own code; not-found → `kind: "input"`) | TC-RESOLVE-002, TC-RESOLVE-003, TC-RESOLVE-005, TC-RESOLVE-006 | Kind assertion is inseparable from identity |
| DM-6 | Delivered-evidence dedupe key (repository, work-item reference) | TC-DIVREC-003, TC-DIVREC-005, TC-DIVREC-007, TC-DIVREC-009, TC-DIVREC-011 | At most one open per pair; new only after resolution; an orphaned open record still satisfies the dedupe predicate and is reused rather than duplicated |
| Port contract | Optional `preflight` port, distinct from `ports.admission`; the engine result error-kind union admits the existing `provider` and `config` kinds additively (`config.credential.missing` is a config-kind row) | TC-REG-004, TC-ADMIT-005, TC-ADMIT-008 | Contract inventory moves by exactly the additive declarations |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Coverage note |
|---|---|---|---|
| NFR-1 | Missing-credential refusal p100 < 2 000 ms, zero network requests | TC-ADMIT-009 | Wall-clock bound **plus** the stronger structural proof: the transport spy records zero requests and the path awaits no timer |
| NFR-2 | Secret non-disclosure; planted-secret canary detects any escape | TC-CREDNAME-003, TC-CREDNAME-004, TC-CREDNAME-006, TC-CREDNAME-007, TC-STATCRED-004 | Canary across envelope, human, digest, records, evidence refs; a negative control proves the scanner fires; TC-CREDNAME-007 keeps the delivered untrusted-config prose suppression intact while admitting only the bounded refusal prose |
| NFR-3 | Zero sessions/resumes/branches/worktrees/leases/attempts/divergences/handover/authority writes on refusal | TC-ADMIT-002, TC-ADMIT-006, TC-ADMIT-007 | Audit ledger explicitly excluded from assertions |
| NFR-4 | Determinism: identical injected inputs → byte-identical envelopes and records | TC-REG-001, TC-ADMIT-009, TC-READMAP-009 | Two runs with the same clock and id factory compared byte-for-byte |
| NFR-5 | Summary ≤ 240 chars single line; `last_message` ≤ 512; note clamped to 240; ≤ 16 evidence refs | TC-CREDNAME-005, TC-RESOLVE-004, TC-DIVREC-006, TC-DIVREC-008 | Bounds asserted on the produced value, not on the fixture; the append-failure case adds an evidence ref and stays within the 16-ref bound |
| NFR-6 | ≤ 1 credential resolution and ≤ 1 bounded work-item read per admission; no pagination/retries/concurrency | TC-ADMIT-010, TC-ADMIT-009 | Transport request log and credential-call counter asserted exactly |
| NFR-7 | Resolve: 0 credential resolutions, 0 network calls, 0 truth reads | TC-RESOLVE-001 | Spy ports composed into the production program |
| NFR-8 | 0 new tokens/DOMAIN_KINDS/error identities/config keys/commands/flags; the existing `provider` and `config` kinds admitted additively to the engine result error-kind union | TC-REG-002, TC-READMAP-008, TC-REG-004 | Error-table sync, taxonomy equality, help inventory, contract inventory |
| NFR-9 | 0 new ambient env reads; secret-read allowlist unchanged; boundary check green | TC-REG-003, TC-CREDNAME-006 | `tests/checks/secret-read-boundary.test.ts` plus the CLI env-read scan |
| NFR-10 | Inverted assertions updated; 0 assertions protecting the replaced behaviour; help/doc pins green | TC-ADMIT-005, TC-REG-005 | The old assertions are **inverted, not deleted**; review checks the diff for deleted assertions (RSK-8) |
| NFR-11 | Every appended record passes the validator on first attempt; no partial/torn record | TC-DIVREC-006, TC-DIVREC-008, TC-DIVREC-011, TC-RESOLVE-004, TC-RESOLVE-008 | Includes both append-failure directions: (a) the attempt lands once, the divergence does not land, the failure is declared via `divergence:append-failed` plus the underlying state identity, and no fabricated reference is produced; (b) the divergence lands, the attempt does not land, and the standing orphan is readable, countable, resolvable, and dedupe-reusable without any fabricated attempt claim |
| NFR-12 | Every changed guides document declares `ados_distribution`; drift guard passes | TC-DOCS-003 | `bash scripts/.tests/test-doc-distribution.sh` |
| NFR-13 | 100% of admission read failures classified from `httpStatus`, never forwarded; distinguishable malformed-vs-transport **with the malformed payload carrying its received status** | TC-READMAP-001 … TC-READMAP-008, TC-READMAP-010 | The full matrix, one assertion set per branch, plus the adapter-level case that proves the `2xx` stamp exists at all rather than being assumed from a double |
| NFR-14 | 100% of genuine store failures carry `kind: "state"`; 0 `fallback.internal`; 0 `dispatch.state-unverified`; not-found is `kind: "input"` and appends nothing | TC-RESOLVE-002, TC-RESOLVE-003, TC-RESOLVE-005, TC-RESOLVE-006, TC-RESOLVE-007 | Includes the classification negative control |

## 4. Test Types and Layers

| Layer | Framework / location | Pattern | Applied to |
|---|---|---|---|
| Unit (domain) | `bun:test`; `tests/behaviour/*.test.ts` or imported directly in structure suites | `*.test.ts` | Resolve identity typing helpers, note clamp, classification kind/code exactness, delivered-evidence predicate conjuncts (TC-RESOLVE-002/003/004/007, TC-DIVREC-002) |
| Adapter contract | `bun:test`; `tests/behaviour/providers/*.test.ts` with `createGitHubClient` over an injected fixture transport | `*.test.ts` | Received-`2xx` stamping, `404` mapping, status preservation, and status-absent transport failures against the real client and normalizer (TC-READMAP-010) |
| Structure / composition | `bun:test`; `tests/structure/*.test.ts` | `*.test.ts` | Production composer wiring, ordering, inversion, port contract, contract inventory, edge secret registration (TC-ADMIT-002/005/008, TC-RESOLVE-001, TC-REG-004) |
| Behaviour (command level) | `bun:test`; `tests/behaviour/*.test.ts` | `*.test.ts` | Refusal envelopes, read-outcome matrix, diagnostics and the trusted-refusal marker path, delivered-evidence divergence, status prerequisite, doctor parity (remaining TCs) |
| Checks / conformance | `bun:test`; `tests/checks/*.test.ts`; `scripts/.tests/*.sh` | `*.test.ts`, `test-*.sh` | Error-table sync, secret-read boundary, doc-conformance, help/reference parity, distribution guard (TC-REG-002/003/005, TC-DOCS-002/003, TC-DOCTCRED-002) |
| Golden | `bun:test` reading committed fixtures; explicit regeneration script | `tests/fixtures/dispatch/golden/**` | Refusal envelope shape goldens and unchanged status digest goldens (TC-READMAP-009, TC-STATCRED-003) |
| Manual | PR description evidence | — | One real credentialed dispatch (verdict ≠ `state-unverified`), one summary before/after resolution including resume reuse (MV-1, MV-2) |

Rules that bind every layer: `bun:test` only (never Jest/Vitest); fixtures never named `*.test.ts`; permanent suites assert current-tree properties, never a diff against a moving base branch; assertions state the value's meaning, not a count that grows; type-checked with `pnpm typecheck` in the aggregate gate.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC / F / NFR |
|---|---|---|---|---|---|
| TC-ADMIT-001 | Missing credential refuses pre-session with a named-key envelope | Negative | Behaviour | High | AC-F1-1 |
| TC-ADMIT-002 | A pre-session refusal leaves zero dispatch side effects | Negative | Structure | High | AC-F1-2, NFR-3 |
| TC-ADMIT-003 | Input refusal precedes the preflight | Edge Case | Behaviour | High | AC-F1-4 |
| TC-ADMIT-004 | Provisioned credential, successful read, readable truth → a real verdict | Happy Path | Structure | High | AC-F1-5, F-1.7 |
| TC-ADMIT-005 | The delivered composition assertions are inverted to zero-spawn | Regression | Structure | High | NFR-10, AC-F1-1/2 |
| TC-ADMIT-006 | A failing admission read refuses with zero sessions and zero records | Negative | Behaviour | High | AC-F1-3, F-1.6 |
| TC-ADMIT-007 | The preflight applies to a resume as well as a fresh dispatch | Edge Case | Behaviour | High | F-1.8, NFR-3 |
| TC-ADMIT-008 | A direct caller without the preflight port keeps the delivered run order | Corner Case | Structure | Medium | F-1.1, DEC-6 |
| TC-ADMIT-009 | Missing-credential refusal latency and request count | Performance | Behaviour | High | NFR-1, NFR-6 |
| TC-ADMIT-010 | Admission read budget: one resolution, one bounded read, no pagination/retry | Performance | Behaviour | High | NFR-6 |
| TC-READMAP-001 | 401/403 classifies `provider.auth.rejected` | Negative | Behaviour | High | AC-F1-3, AC-F2-4 |
| TC-READMAP-002 | 5xx classifies `provider.outage` | Negative | Behaviour | High | AC-F1-3, AC-F2-4 |
| TC-READMAP-003 | 404 classifies `input.value.rejected` and names the ref honestly | Negative | Behaviour | High | AC-F1-6, RSK-17 |
| TC-READMAP-004 | Malformed 2xx classifies `provider.payload.invalid` | Negative | Behaviour | High | AC-F1-7 |
| TC-READMAP-005 | Other status-bearing non-2xx classifies `provider.outage` | Edge Case | Behaviour | High | AC-F2-4 |
| TC-READMAP-006 | Status-absent transport throw/timeout classifies `provider.outage` | Negative | Behaviour | High | NFR-13 |
| TC-READMAP-007 | Malformed 2xx and transport throw stay distinguishable | Corner Case | Behaviour | High | AC-F2-6 |
| TC-READMAP-008 | Every mapped pair carries its own kind; no `fallback.internal` | Edge Case | Behaviour | High | AC-F2-5, AC-F2-4 |
| TC-READMAP-009 | Refusal envelope goldens and bounded single-line shape | Happy Path | Behaviour (Golden) | Medium | F-2.1, F-2.6, F-1.5, NFR-4, NFR-5 |
| TC-READMAP-010 | The real GitHub client stamps the received status onto a decode failure | Edge Case | Adapter Contract | High | AC-F2-6, AC-F1-7, NFR-13 |
| TC-CREDNAME-001 | Machine and human refusals name key and reference with a remediation | Happy Path | Behaviour | High | AC-F2-1 |
| TC-CREDNAME-002 | A prefixed reference reports the full derived key | Edge Case | Behaviour | High | AC-F2-2 |
| TC-CREDNAME-003 | Planted-secret canary never escapes any surface or record | Negative | Behaviour | High | AC-F2-3, NFR-2 |
| TC-CREDNAME-004 | The canary detector fires on a deliberately leaked value | Negative (control) | Behaviour | High | NFR-2 |
| TC-CREDNAME-005 | Refusal summary and `last_message` respect their bounds | Corner Case | Behaviour | Medium | NFR-5 |
| TC-CREDNAME-006 | The resolved truth-read key is registered for redaction from injected facts | Edge Case | Structure | High | AC-F5-4, NFR-9 |
| TC-CREDNAME-007 | The trusted-refusal marker is required for the refusal prose to reach machine and human output | Negative (with control) | Behaviour | High | AC-F2-1, NFR-2 |
| TC-RESOLVE-001 | Resolve succeeds from local evidence with spy credential and transport | Happy Path | Structure | High | AC-F3-1, NFR-7 |
| TC-RESOLVE-002 | `state.lock.busy` surfaces under `kind: "state"` with its own row | Negative | Behaviour | High | AC-F3-2, NFR-14 |
| TC-RESOLVE-003 | `state.store.torn` and `state.write.failed` surface their own identities | Negative | Behaviour | High | AC-F3-3 |
| TC-RESOLVE-004 | A 300-character note clamps to 240 and lands | Corner Case | Behaviour | High | AC-F3-4 |
| TC-RESOLVE-005 | An absent divergence id is a distinguishable not-found | Negative | Behaviour | High | AC-F3-5 |
| TC-RESOLVE-006 | Not-found is not `state.keys.missing`; a genuine key-set failure is | Edge Case | Behaviour | High | AC-F3-5, DEC-10 |
| TC-RESOLVE-007 | A state code under the dispatch kind would fall to `fallback.internal` | Negative (control) | Behaviour | Medium | NFR-14 |
| TC-RESOLVE-008 | Resolution replay is a no-op and the open record is byte-identical | Corner Case | Behaviour | High | F-3.5, NFR-11 |
| TC-DIVREC-001 | A delivered-but-unverifiable attempt opens one declared-shape divergence | Happy Path | Behaviour | High | AC-F4-1 |
| TC-DIVREC-002 | Each delivered-evidence conjunct falsified yields no divergence | Negative | Behaviour | High | AC-F4-3 |
| TC-DIVREC-003 | A resume reuses the open divergence instead of appending | Edge Case | Behaviour | High | AC-F4-4 |
| TC-DIVREC-004 | Summary lists and counts it; resolution decrements by exactly one | Happy Path | Behaviour | High | AC-F4-2 |
| TC-DIVREC-005 | A new divergence opens only after the previous is resolved | Edge Case | Behaviour | High | AC-F4-5 |
| TC-DIVREC-006 | Record bounds, closed read families, and validator-first-pass | Corner Case | Behaviour | High | F-4.3, NFR-11 |
| TC-DIVREC-007 | An unrelated open mismatch divergence does not suppress recording | Corner Case | Behaviour | High | F-4.2, DM-6 |
| TC-DIVREC-008 | A failed divergence append is declared and never referenced | Negative | Behaviour | High | NFR-11, F-4.2 |
| TC-DIVREC-009 | A replayed attempt appends nothing, even after resolution | Corner Case | Behaviour | High | AC-F4-4, DM-6 |
| TC-DIVREC-010 | The attempt keeps the underlying failure identity on `last_message` | Edge Case | Behaviour | Medium | F-4.8 |
| TC-DIVREC-011 | A failed attempt append leaves a standing open divergence that stays resolvable and dedupe-usable | Negative | Behaviour | High | F-4.4, F-4.6, DM-2, DM-6, NFR-11 |
| TC-STATCRED-001 | Affected status sections carry `credentialPrerequisite`, `sources[]` unchanged | Happy Path | Behaviour | High | AC-F6-1, DM-4 |
| TC-STATCRED-002 | Observing and otherwise-unavailable sections carry no prerequisite | Negative | Behaviour | High | AC-F6-1 |
| TC-STATCRED-003 | No observed section, no fabricated zero, no finding, no vocabulary growth | Negative | Behaviour | High | AC-F6-2, F-6.4 |
| TC-STATCRED-004 | The prerequisite carries names only, never a value | Negative | Behaviour | High | F-6.6, NFR-2 |
| TC-DOCTCRED-001 | The doctor hint names the resolved key (literal and derived) | Happy Path | Behaviour | High | AC-F6-3 |
| TC-DOCTCRED-002 | Doctor stays outside the prompt-required inventory | Regression | Checks | High | AC-F6-3, DEC-5 |
| TC-DOCS-001 | The provisioning guide documents the sanctioned bridge | Happy Path | Documentation | High | AC-F5-1, AC-F5-4 |
| TC-DOCS-002 | The reference page documents ordering, mapping, caveat, and resolution | Happy Path | Documentation | High | AC-F5-2 |
| TC-DOCS-003 | Every changed guides document declares its distribution marker | Edge Case | Conformance | High | AC-F5-3, NFR-12 |
| TC-DOCS-004 | The change record carries the four-assertion TDR-0015 amendment pointer | Edge Case | Documentation | Medium | F-4.9, DEC-3 |
| TC-REG-001 | Refusals, resolve envelopes, and divergence records are deterministic | Regression | Behaviour | High | NFR-4 |
| TC-REG-002 | Vocabulary, error table, config, and command surface do not grow | Regression | Checks | High | NFR-8 |
| TC-REG-003 | Secret-read and environment-read boundaries stay narrow | Regression | Checks | High | NFR-9 |
| TC-REG-004 | The preflight port is additive, optional, and distinct from `admission` | Regression | Structure | High | NFR-8, DEC-6, DEC-11 |
| TC-REG-005 | Help and doc-conformance pins stay green with no weakened assertions | Regression | Checks | High | NFR-10, RSK-8 |

### 5.2 Scenario Details

#### TC-ADMIT-001 - Missing credential refuses pre-session with a named-key envelope

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.2, F-1.3, F-2.1, AC-F1-1, NFR-1, NFR-3, DEC-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-preflight.test.ts` (new), over the production composer with an injected refusing credential port and a recording harness starter/runner
**Tags**: @backend, @cli, @security

**Preconditions**:

- A temporary checkout with an injected `origin`, a temp state root, a recording `HarnessSpawnStarter` and `HarnessSpawnRunner`, and a credential port whose `resolve` returns `config.credential.missing`.
- A recording transport that fails the test if called.

**Steps**:

1. Run `dispatch GH-301 --json` through the composed program.
2. Read the exit code and the parsed envelope.
3. Read the harness recordings and the attempt/divergence ledgers.

**Expected Outcome**:

- Exit is `1`; the envelope carries `error.code == "config.credential.missing"` with the delivered row's category/retryable/consequence/projection.
- The bounded single-line summary names `GITHUB_TOKEN` and `github-read`, and one remediation.
- The starter and runner recorded zero spawns and zero resumes; the transport recorded zero requests; the attempt and divergence ledgers are empty.

**Postconditions**: The temp state root is removed.

#### TC-ADMIT-002 - A pre-session refusal leaves zero dispatch side effects

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.6, AC-F1-2, NFR-3, DEC-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-composition.test.ts` (modify), production composer over a real temp store
**Tags**: @backend, @cli, @state

**Preconditions**:

- A recording lease seam whose `claim` records a call, a recording branch seam, and a real state store rooted in a temp directory.
- A refusing credential port.

**Steps**:

1. Run `dispatch GH-301 --json` through the composed program.
2. Inspect the lease recordings, git branch argv, worktree/branch directories, the dispatch attempt ledger, the divergence ledger, the handover ledger, and the authority view.
3. Confirm no checkout mutation occurred.

**Expected Outcome**:

- Zero lease claims and zero releases; zero branch-creating git invocations; no new branch, worktree, or session.
- Zero attempt records, zero divergence records, zero handover records, zero authority-view writes.
- The invocation-audit ledger is **not** asserted (out of scope, RSK-12).

#### TC-ADMIT-003 - Input refusal precedes the preflight

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1.2, AC-F1-4, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-preflight.test.ts` (new)
**Tags**: @backend, @cli

**Preconditions**:

- A preflight spy that records every invocation.
- Scenarios: an unknown harness name, and a malformed work-item reference.

**Steps**:

1. Run each scenario.
2. Assert the delivered input refusal, the exit code, and the preflight spy's call count.
3. Assert the harness recordings.

**Expected Outcome**:

- Each run returns the delivered `input.value.rejected` refusal at exit `1`.
- The preflight spy recorded zero invocations.
- Zero spawns and no session.

#### TC-ADMIT-004 - Provisioned credential, successful read, readable truth → a real verdict

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.5, F-1.7, AC-F1-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-composition.test.ts` (modify — the positive control of the inverted suites)
**Tags**: @backend, @cli

**Preconditions**:

- A resolving credential port, a transport answering the preflight work-item read with a `200`, and injected truth reads that all succeed.
- A recording starter that persists one attempt; a deterministic clock and id factory.

**Steps**:

1. Run `dispatch GH-239 --json`.
2. Read the envelope result, the attempt ledger, and the comparison record.
3. Assert no preflight-specific record exists.

**Expected Outcome**:

- The derived token is **not** `state-unverified`.
- Exactly one attempt record is appended; its comparison is derived from the readable truth (not `not-applicable` for a missing comparison source).
- No extra record is attributable to the preflight; the post-session truth read is unchanged.

**Notes / Clarifications**: This is the control that prevents the inverted suites from passing because everything refuses.

#### TC-ADMIT-005 - The delivered composition assertions are inverted to zero-spawn

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F1-2, NFR-10, RSK-7, RSK-8, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-composition.test.ts` (modify two suites: "the production composer builds a real harness session port" and "the production truth read keeps honest failure classified")
**Tags**: @backend, @cli, @regression

**Preconditions**:

- The two delivered assertions exist today: `expect(starterInvocations).toHaveLength(1)` with `result === "state-unverified"`, and `observeTruth({credentialMissing: true})` → `state-unverified` with one attempt.

**Steps**:

1. Invert the first suite: a refusing credential port yields `error.code === "config.credential.missing"`, exit `1`, `starterInvocations` length `0`, runner invocations length `0`, and zero attempts.
2. Invert the second suite: the missing-credential scenario refuses pre-session (no attempt, no `state-unverified`); keep a post-session `state-unverified` case for the *transport-failure* path, but route it so the admission read succeeds while a **post-session** read fails — a blind `transportFails: true` would now refuse at admission instead (RSK-11).
3. Add the wiring assertion: the production composition supplies a preflight port, and the preflight is ordered after input validation and before `claimLease`/spawn/resume.

**Expected Outcome**:

- Both assertions now demand zero spawns and a typed pre-session refusal.
- The suites are inverted, not deleted: the file still contains one assertion per replaced behaviour, and the positive control (TC-ADMIT-004) and no-preflight control (TC-ADMIT-008) prove causation.
- No assertion remains that a refusing credential port produces `state-unverified`.

#### TC-ADMIT-006 - A failing admission read refuses with zero sessions and zero records

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.6, AC-F1-3, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-read-mapping.test.ts` (new), shared with the mapping matrix
**Tags**: @backend, @cli, @state

**Preconditions**:

- A resolving credential port and a transport returning `401` (case A) and `500` (case B) for the preflight work-item read.
- Recording starter/runner, lease seam, and store inspection.

**Steps**:

1. Run each case through the composed program.
2. Assert the refusal identity and the exit.
3. Assert zero spawns/resumes/lease claims/attempts/divergences.

**Expected Outcome**:

- Pre-session refusal in both cases with the identities from TC-READMAP-001/002.
- Zero sessions, zero attempt records, zero divergence records, zero leases; no branch or worktree.

#### TC-ADMIT-007 - The preflight applies to a resume as well as a fresh dispatch

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1.8, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-preflight.test.ts` (new)
**Tags**: @backend, @cli

**Preconditions**:

- An existing lane handle, a `--resume-prompt` invocation, and a refusing credential port.

**Steps**:

1. Run `dispatch GH-301 --resume-prompt x --json`.
2. Assert the refusal envelope and the harness recordings.

**Expected Outcome**:

- The resume is refused pre-session with `config.credential.missing` at exit `1`.
- Zero resume invocations, zero lease claims, zero attempt records.

#### TC-ADMIT-008 - A direct caller without the preflight port keeps the delivered run order

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1.1, F-1.2, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-preflight.test.ts` (new), engine called directly with `preflight` omitted
**Tags**: @backend, @core

**Preconditions**:

- The command-scenario harness with the `preflight` port omitted (engine-level harness, not the production composer).
- A truth read that fails with an unreadable tracker (the delivered defect path).

**Steps**:

1. Run the dispatch.
2. Assert the spawn count and the derived token.

**Expected Outcome**:

- One spawn and the delivered `state-unverified` outcome — the documented backward-compatible behaviour for a caller that supplies no preflight (spec §8.5).
- This control proves the zero-spawn result in TC-ADMIT-001/005 comes from the preflight, not from the fixture refusing everything.

#### TC-ADMIT-009 - Missing-credential refusal latency and request count

**Scenario Type**: Performance
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, NFR-6, AC-F1-1, NFR-4
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-preflight.test.ts` (new)
**Tags**: @backend, @perf

**Preconditions**:

- A refusing credential port, a transport spy, and a monotonic timer injected into the harness.

**Steps**:

1. Measure handler entry → envelope for the refusal path; repeat the run with identical injected inputs.
2. Assert the transport spy count.
3. Compare the two envelopes byte-for-byte.

**Expected Outcome**:

- p100 elapsed < 2 000 ms on the reference environment, with the measured value recorded in the execution log.
- Zero requests in the refusal path (the stronger, non-flaky proof that no network is involved).
- Byte-identical envelopes across the two runs (determinism shared with TC-REG-001).

**Notes / Clarifications**: The wall-clock assertion is a generous upper bound; the zero-request assertion is the load-bearing one.

#### TC-ADMIT-010 - Admission read budget: one resolution, one bounded read, no pagination/retry

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1.5, NFR-6, §8.1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-read-mapping.test.ts` (new)
**Tags**: @backend, @api

**Preconditions**:

- A credential port with a call counter, and a transport that records every request URL.
- Case A: a successful `200` work-item read. Case B: a `500` work-item read.

**Steps**:

1. Run each case.
2. Count credential resolutions and transport requests attributable to admission.
3. Inspect the recorded preflight request for pagination parameters.

**Expected Outcome**:

- Exactly one credential resolution and exactly one bounded work-item read per admission.
- Zero pagination parameters on the preflight request, zero retries after the `500` (exactly one request), zero concurrent reads.

#### TC-READMAP-001 - 401/403 classifies `provider.auth.rejected`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.5, F-2.4, F-2.5, AC-F1-3, AC-F2-4, NFR-13, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-read-mapping.test.ts` (new)
**Tags**: @backend, @cli, @api

**Preconditions**:

- A resolving credential port; the delivered GitHub read double returns `provider.payload.invalid` with `httpStatus` `401` (case A) and `403` (case B), matching the delivered adapter contract.
- Recording harness and store.

**Steps**:

1. Run each case.
2. Assert identity, kind, category, retryable, consequence, projection, and exit together.
3. Assert the adapter identity is not what surfaced and no `fallback.internal` appears.

**Expected Outcome**:

- Both cases: `provider.auth.rejected`, `kind: "provider"`, user, non-retryable, `not_landed`, `user-validation`, exit `1`.
- The surfaced code is not `provider.payload.invalid`; zero spawns and zero attempt records.

#### TC-READMAP-002 - 5xx classifies `provider.outage`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.4, F-2.5, AC-F1-3, AC-F2-4, NFR-13, RSK-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-read-mapping.test.ts` (new)
**Tags**: @backend, @cli, @api

**Preconditions**:

- A resolving credential port; the read double returns `provider.payload.invalid` with `httpStatus` `500` (case A) and `503` (case B).

**Steps**:

1. Run each case.
2. Assert the full classified tuple.

**Expected Outcome**:

- `provider.outage`, `kind: "provider"`, transient, retryable, `not_landed`, `platform-provider`, exit `2`.
- Zero spawns/resumes, zero attempt records, zero leases.

#### TC-READMAP-003 - 404 classifies `input.value.rejected` and names the ref honestly

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.4, F-2.5, AC-F1-6, AC-F2-4, NFR-13, RSK-17, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-read-mapping.test.ts` (new)
**Tags**: @backend, @cli

**Preconditions**:

- A resolving credential port; the read double consumes the delivered `404 → provider.not-found` mapping.

**Steps**:

1. Run the case with a concrete work-item reference.
2. Assert identity/kind/category/projection/exit and the summary facts.
3. Assert the internal `provider.not-found` marker is not exposed as an error identity.

**Expected Outcome**:

- `input.value.rejected`, `kind: "input"`, user, non-retryable, `not_landed`, `user-validation`, exit `1`.
- The summary names the work-item reference and states the provider reported it absent; it does **not** assert that the reference is wrong, and it names the credential-scope check.
- Zero spawns and zero attempt records.

#### TC-READMAP-004 - Malformed 2xx classifies `provider.payload.invalid` and carries the received status

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.4, F-2.6, AC-F1-7, AC-F2-6 (engine half), NFR-13, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-read-mapping.test.ts` (new), engine boundary over a read double that reproduces the adapter contract
**Tags**: @backend, @cli, @api

**Preconditions**:

- A resolving credential port; the read double returns a failure for a received `200` whose body cannot be normalized, **carrying `httpStatus: 200`** — the status-present state the adapter produces (TDR-0019 decision point 4).
- The double never synthesizes the stamp itself as the thing under test: the production of the stamp is proved separately against the real client by TC-READMAP-010.

**Steps**:

1. Run the case.
2. Assert the classified tuple.
3. Assert that the surfaced failure is not the transport branch: the received status is present on the classified failure as well as on the engine-level refusal inputs.
4. Assert zero spawns/attempts.

**Expected Outcome**:

- `provider.payload.invalid`, `kind: "provider"`, `platform-provider`, exit `2`.
- The failure carries `httpStatus: 200` — the received status is **present**, which is what distinguishes it from the status-absent transport case in TC-READMAP-007.

**Notes / Clarifications**: AC-F2-6 is satisfied by two cases at two depths: this case proves the classify-at-the-boundary half, and TC-READMAP-010 proves that the status this case relies on is actually produced by `client.ts`/`normalize.ts` rather than assumed.

#### TC-READMAP-005 - Other status-bearing non-2xx classifies `provider.outage`

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-4, NFR-13, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-read-mapping.test.ts` (new)
**Tags**: @backend, @api

**Preconditions**:

- A resolving credential port; the read double returns status-bearing failures `429`, `422`, and `400` (one case each).

**Steps**:

1. Run each case.
2. Assert the classified tuple.

**Expected Outcome**:

- All three: `provider.outage`, `kind: "provider"`, `platform-provider`, exit `2` — the provider answered, but the answer is not an admission fact.

#### TC-READMAP-006 - Status-absent transport throw/timeout classifies `provider.outage`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.4, AC-F1-7, AC-F2-6 (transport half), NFR-13
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-read-mapping.test.ts` (new)
**Tags**: @backend, @api

**Preconditions**:

- A resolving credential port; the transport throws (case A) and times out (case B), producing `provider.payload.invalid` **without any** status — the only status-absent admission-read branch.

**Steps**:

1. Run each case.
2. Assert the classified tuple.

**Expected Outcome**:

- `provider.outage`, `kind: "provider"`, transient, retryable, `platform-provider`, exit `2`.
- The adapter identity `provider.payload.invalid` is **not** forwarded (asserted explicitly as an inequality).

#### TC-READMAP-007 - Malformed 2xx (status present) and transport throw (status absent) stay distinguishable

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.4, F-2.6, AC-F1-7, AC-F2-6, NFR-13
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-read-mapping.test.ts` (new)
**Tags**: @backend, @api

**Preconditions**:

- The two failures from TC-READMAP-004 and TC-READMAP-006, driven through the same composed program in one test body: a received-but-malformed `200` (status present) and a thrown/timed-out request (status absent).

**Steps**:

1. Run both cases in one assertion block.
2. Assert the discriminator (`httpStatus: 200` present on the malformed case vs `httpStatus` absent on the transport case) and the two identities.
3. Assert that swapping the two status-presence facts would fail: the assertion compares presence/absence in the same block, not two independent equality checks.

**Expected Outcome**:

- Malformed `2xx` → `provider.payload.invalid` **with `httpStatus: 200`**; transport throw → `provider.outage` with **no** status.
- The pair is asserted together so a later refactor that collapses them, or drops the malformed case's stamp, fails this case, not a different one.

**Notes / Clarifications**: AC-F2-6 describes the pair by status presence, not by a shared status-absent state: only the transport throw is status-absent. The stamp this case consumes is produced and proved at the adapter by TC-READMAP-010.

#### TC-READMAP-008 - Every mapped pair carries its own kind; no `fallback.internal`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.4, F-2.5, AC-F2-4, AC-F2-5, NFR-8, NFR-13, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-read-mapping.test.ts` (new)
**Tags**: @backend, @cli

**Preconditions**:

- All seven admission-read outcomes from TC-READMAP-001…006.
- The `config.credential.missing` refusal produced by the unresolvable-credential path (TC-ADMIT-001).

**Steps**:

1. Run every outcome.
2. Classify each through the delivered classifier and compare with the emitted envelope.
3. Classify the `config.credential.missing` refusal the same way.
4. Assert `DOMAIN_KINDS` membership and the error-table row count are unchanged.

**Expected Outcome**:

- Every provider identity carries `kind: "provider"`; the 404 refusal carries `kind: "input"`; the credential refusal carries `kind: "config"` and classifies to its own row rather than `fallback.internal`.
- Zero cases classify as `fallback.internal`; zero emit `provider.payload.invalid` for 401/5xx/transport.
- The engine result error-kind union admits the existing `provider` and `config` kinds additively; `DOMAIN_KINDS` and the error-table count are unchanged (with TC-REG-002).

#### TC-READMAP-009 - Refusal envelope goldens and bounded single-line shape

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2.1, F-2.6, NFR-4, NFR-5, F-1.5
**Test Type(s)**: Contract, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-read-mapping.test.ts` (new) + `tests/fixtures/dispatch/golden/errors/{config-credential-missing,provider-auth-rejected,provider-outage,provider-payload-invalid,input-value-rejected}.json` (new)
**Tags**: @backend, @cli, @golden

**Preconditions**:

- The five refusal shapes from Appendix C, produced with a fixed clock and a deterministic run id.
- A planted canary in the injected environment.

**Steps**:

1. Run each refusal and serialize the envelope.
2. Compare the envelope **shape** and its classified fields (identity, kind, category, retryable, consequence, projection, exit) with the committed golden.
3. Assert the machine summary and the human diagnostic each contain the resolved key and the reference as substrings, plus one remediation.
4. Assert bounds: summary ≤ 240 characters, single line, no newline; `last_message` ≤ 512.
5. Scan the envelopes, the human diagnostics, and the goldens for the canary.

**Expected Outcome**:

- Each envelope matches its golden on shape and classified fields; the goldens pin no editorial prose, and no assertion compares a full summary or diagnostic sentence.
- Key and reference substrings are present in both the machine summary and the human diagnostic; bounds hold.
- Zero occurrences of the credential value in any envelope, diagnostic, or golden.

**Notes / Clarifications**: Resolved OQ-3: structure is pinned byte-level, wording is asserted behavior-level (key, reference, remediation, bounds, absent value), so an editorial rewording does not fail the suite while a lost fact does.

#### TC-READMAP-010 - The real GitHub client stamps the received status onto a decode failure

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.4, F-2.6, AC-F1-7, AC-F2-6 (adapter half), NFR-13, DEC-7, TDR-0019 decision point 4
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/github-inputs.test.ts` (modify — new received-but-malformed `200` case) and `tests/behaviour/providers/github-trap.test.ts` (modify — extend the delivered `GH-PAYLOAD-HTTP-STATUS` trap), both driving the real `createGitHubClient` over an injected fixture transport and the delivered environment credential port
**Tags**: @adapters, @api, @contract

**Preconditions**:

- The real client and normalizer (`packages/adapters/src/github/client.ts`, `normalize.ts`) composed with an injected transport; `installThrowingFetchGuard` in place so no case can reach a network.
- Four scripted responses for one instance/repository/reference: (a) `200` with a body that cannot be normalized, (b) a transport that throws, (c) `404`, (d) another non-2xx (for example `429` or `503`).

**Steps**:

1. Read the work item through the real client for each case.
2. Assert the returned failure identity and the `httpStatus` fact on every failure.
3. Assert the injected transport recorded exactly one request for each response-bearing case (a), (c), (d), so each outcome is the adapter's own classification of a real response; case (b) uses a transport that throws on send.
4. Assert the four outcomes in one block, comparing status presence/absence rather than two independent equalities.

**Expected Outcome**:

- (a) `provider.payload.invalid` **with `httpStatus: 200`** — the received status stamped onto the decode failure by the bounded read.
- (b) `provider.payload.invalid` **with `httpStatus` absent** — the only status-absent branch.
- (c) `provider.not-found` — the delivered `404` mapping, status preserved.
- (d) `provider.payload.invalid` **with that status preserved**.
- The suite cannot pass if `client.ts`/`normalize.ts` never stamps the status: with the stamp removed, case (a) returns `httpStatus: undefined` and the paired presence/absence assertion fails, because no input hands the client a pre-stamped failure.

**Notes / Clarifications**: This is the only case that exercises the delivered provider read path; the engine-level cases (TC-READMAP-001…009) consume doubles that reproduce the contract this case pins. It belongs to plan Phase 3 — the phase that lands the stamp — and it is what keeps that phase's verification from passing vacuously. The delivered trap already pins status-bearing non-2xx, `404`, and the status-absent transport throw; the malformed-`200` stamp is the added fact.

#### TC-CREDNAME-001 - Machine and human refusals name key and reference with a remediation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.1, F-2.2, AC-F2-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-diagnostics.test.ts` (new)
**Tags**: @backend, @cli

**Preconditions**:

- Literal reference `github-read` over `GITHUB_TOKEN`, unset in the injected environment.

**Steps**:

1. Run `dispatch GH-301 --json` and `dispatch GH-301` (human).
2. Extract the summary/prose and the machine error object.
3. Assert both are behavior-level matches: the resolved key `GITHUB_TOKEN` and the reference `github-read` appear as substrings in the machine summary and in the human diagnostic, exactly one actionable remediation is present, and the planted canary value occurs nowhere.
4. Assert no assertion compares a full prose sentence.

**Expected Outcome**:

- Both modes carry the same bounded facts; the machine consumer reads `error.code` while the summary sits beside the identity, never instead of it.
- The key and reference substrings are present in both; the credential value is absent from both.

**Notes / Clarifications**: Resolved OQ-3: substring presence of the actionable identifiers plus absence of the value, never a pinned sentence.

#### TC-CREDNAME-002 - A prefixed reference reports the full derived key

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2.2, AC-F2-2, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-diagnostics.test.ts` (new)
**Tags**: @backend, @cli

**Preconditions**:

- An environment-prefixed reference whose suffix is `TRACKER_TOKEN`, with the derived key unset.

**Steps**:

1. Run the refusal.
2. Assert the reported key.

**Expected Outcome**:

- The summary names the full derived key (brand prefix + suffix) and never the bare suffix; the literal case still reports its declared name verbatim.

#### TC-CREDNAME-003 - Planted-secret canary never escapes any surface or record

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.3, AC-F2-3, NFR-2, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-diagnostics.test.ts` (new)
**Tags**: @backend, @security

**Preconditions**:

- A planted canary value in the injected environment, registered for redaction; four artefacts produced in one scenario set: a credential refusal, a successful dispatch, a resolve failure, and a delivered-evidence divergence record.

**Steps**:

1. Produce each artefact.
2. Scan every envelope, human diagnostic, summary, evidence reference, attempt record, and divergence record — raw and JSON-escaped forms.

**Expected Outcome**:

- Zero occurrences of the value or any value-derived substring anywhere.

#### TC-CREDNAME-004 - The canary detector fires on a deliberately leaked value

**Scenario Type**: Negative (control)
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-diagnostics.test.ts` (new)
**Tags**: @security

**Preconditions**:

- The same scanner used by TC-CREDNAME-003.

**Steps**:

1. Feed it a synthetic payload that intentionally contains the canary.
2. Assert it reports a hit.

**Expected Outcome**:

- The detector reports a hit, proving TC-CREDNAME-003 is not a vacuous assertion.

#### TC-CREDNAME-005 - Refusal summary and `last_message` respect their bounds

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2.1, AC-F2-1, NFR-5
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-diagnostics.test.ts` (new)
**Tags**: @backend

**Preconditions**:

- A reference and a brand whose names are long enough to stress the summary bound.

**Steps**:

1. Produce the refusal.
2. Assert length, single-line, newline absence, and that the key and reference substrings survive the truncation policy (they are the actionable facts).

**Expected Outcome**:

- Summary ≤ 240 characters, one line, no newline; `last_message` ≤ 512 characters; the key and reference substrings remain present after truncation.
- The bound is asserted on the produced values only; no sentence-shaped expectation is introduced (resolved OQ-3).

#### TC-CREDNAME-006 - The resolved truth-read key is registered for redaction from injected facts

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5.8, AC-F5-4, NFR-2, NFR-9, RSK-14
**Test Type(s)**: Unit, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/cli-edge-seam.test.ts` (modify)
**Tags**: @cli, @security

**Preconditions**:

- An injected environment containing the truth-read key with a planted canary value; the existing CLI environment-read scan.

**Steps**:

1. Compose the runtime edge from injected environment facts and assert the registered secret list includes the canary value.
2. Render a diagnostic containing that value through the serialization chokepoint and assert it is masked.
3. Re-run the CLI env-read scan.

**Expected Outcome**:

- The value is registered from injected facts only; the rendered text is masked; zero new `process.env`/`Bun.env`/`Deno.env` reads appear outside the credential adapter.

#### TC-CREDNAME-007 - The trusted-refusal marker is required for the refusal prose to reach machine and human output

**Scenario Type**: Negative (with positive control)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.1, F-2.6 (delivery choice), AC-F2-1, DM-1, NFR-2, DEC-7
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/error-classification.test.ts` (modify), driving `runCli` with a program handler that returns — and in a second pass throws — the failure, over the delivered classification and envelope path in `packages/cli/src/index.ts`
**Tags**: @cli, @security, @contract

**Preconditions**:

- A `config.credential.missing` failure carrying a bounded identifier-only summary (`GITHUB_TOKEN`, `github-read`, one remediation) and the narrow trusted-refusal marker the engine refusal sets.
- The same failure with the marker removed (the control leg), and a marked failure whose code is a different `config.*` code.
- A planted canary value in the injected environment and in a synthetic config-shaped summary string; the delivered untrusted-config pins present and unmodified in the same suite.

**Steps**:

1. Render the marked failure in machine mode (`--json`) and in human mode; read `error.code`, `error.summary`, `error.remediationHint`, and the human text.
2. Render the unmarked failure and read the same surfaces.
3. Render the marked failure for the other `config.*` code and read the same surfaces.
4. Re-run the delivered untrusted-config pins and scan every captured output for the canary.

**Expected Outcome**:

- Marked `config.credential.missing`: identity is still `error.code`, and the bounded summary plus one remediation appear in **both** the machine envelope (`error.summary`, `error.remediationHint`) and the human diagnostic; the canary value appears nowhere.
- Unmarked config-shaped failure: summary and remediation stay suppressed exactly as delivered — the envelope carries the table row's own prose, never the supplied untrusted text — so the delivered untrusted-config pin stays green.
- A marked failure for any other `config.*` code is still suppressed: the marker is narrow, not a general bypass of the config suppression.
- Removing the marker from the refusal fails step 1; widening it to any other `config.*` code fails step 3; removing the suppression for unmarked config-shaped failures fails step 2.

**Notes / Clarifications**: The change admits one bounded refusal summary through a suppression that exists to keep untrusted config text out of output, so both directions are load-bearing and neither may be traded for the other. Assigned to plan Phase 4, where the engine refusal and the classifier path meet.

#### TC-RESOLVE-001 - Resolve succeeds from local evidence with spy credential and transport

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.1, AC-F3-1, NFR-7, DEC-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-resolve-composition.test.ts` (new), production composer over a seeded local divergence ledger
**Tags**: @backend, @cli, @state

**Preconditions**:

- A temp store seeded with one open divergence through the delivered ledger writer; a spy credential port and a spy transport that fail the test on invocation.

**Steps**:

1. Run `dispatch dual-run resolve <id> --note "..." --json`.
2. Assert exit `0`, the resolved record, and the spy invocation counts.
3. Assert the local ledger alone explains the success.

**Expected Outcome**:

- Both spies recorded zero invocations; zero truth reads.
- One resolved record appended; the open record is unchanged; the reported state and stored note match.

#### TC-RESOLVE-002 - `state.lock.busy` surfaces under `kind: "state"` with its own row

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.2, AC-F3-2, DM-5, NFR-14, DEC-10
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resolve-diagnostics.test.ts` (new), gate runtime over a store double whose verified read fails
**Tags**: @backend, @state

**Preconditions**:

- A store double whose read returns `state.lock.busy`; an empty divergence ledger.

**Steps**:

1. Run the resolve path.
2. Assert error kind, code, category, retryable, consequence, remediation, projection, and exit.
3. Assert no record was appended.

**Expected Outcome**:

- `{ kind: "state", code: "state.lock.busy" }` with the delivered row's fields (transient, retryable, platform-provider, exit `2`) and a remediation about waiting for the writer to release the fence.
- Never kind `dispatch`; never `dispatch.state-unverified`.

#### TC-RESOLVE-003 - `state.store.torn` and `state.write.failed` surface their own identities

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.2, AC-F3-3, DM-5, NFR-14, DEC-10
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resolve-diagnostics.test.ts` (new)
**Tags**: @backend, @state

**Preconditions**:

- Two store doubles: one fails the read with `state.store.torn`, one fails the append with `state.write.failed` (after a successful read).

**Steps**:

1. Run the resolve path for each.
2. Assert exact identity, kind, that row's projection and remediation.
3. Assert no record was appended.

**Expected Outcome**:

- Each surfaces its own identity under `kind: "state"`; neither is `dispatch.state-unverified`; no partial or torn record exists.

#### TC-RESOLVE-004 - A 300-character note clamps to 240 and lands

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.4, AC-F3-4, NFR-5, NFR-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resolve-diagnostics.test.ts` (new)
**Tags**: @backend, @state

**Preconditions**:

- An open local divergence and a 300-character note.

**Steps**:

1. Resolve with the over-long note.
2. Assert the resolution landed, the stored note length, and the absence of `state.write.failed`.
3. Pass the record through the delivered validator.

**Expected Outcome**:

- Resolution lands; stored note ≤ 240 characters; no `state.write.failed`; the record passes the validator on first attempt.

#### TC-RESOLVE-005 - An absent divergence id is a distinguishable not-found

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.3, AC-F3-5, DM-5, NFR-14, DEC-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resolve-diagnostics.test.ts` (new)
**Tags**: @backend, @state

**Preconditions**:

- A readable ledger with no record for the requested id.

**Steps**:

1. Run resolve with an absent id.
2. Assert the internal sentinel, the surfaced identity, and the append count.

**Expected Outcome**:

- The internal reason is the distinguishable `divergence-not-found` sentinel, surfaced as `input.value.rejected` with `kind: "input"` and exit `1`; nothing is appended; the sentinel is never exposed as an error-table identity.

#### TC-RESOLVE-006 - Not-found is not `state.keys.missing`; a genuine key-set failure is

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.3, AC-F3-5, NFR-14, DEC-10
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resolve-diagnostics.test.ts` (new)
**Tags**: @backend, @state

**Preconditions**:

- Case A: an absent id. Case B: a store read failing with `state.keys.missing`.

**Steps**:

1. Run both cases side by side in one assertion block.
2. Assert the two identities differ.
3. Assert both resolve seams (the gate path and the ledger helper) agree on the sentinel.

**Expected Outcome**:

- Absent id → `input.value.rejected`/`kind: "input"`.
- A genuine store key-set failure → `state.keys.missing`/`kind: "state"` with its own projection.
- Neither case reports the other's identity.

**Notes / Clarifications**: Mirrors TDR-0020 decision point 4: the not-found sentinel `divergence-not-found` is a local resolve reason, not an error-table code, and both resolve seams (the gate path and the ledger helper) must agree on it.

#### TC-RESOLVE-007 - A state code under the dispatch kind would fall to `fallback.internal`

**Scenario Type**: Negative (control)
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-14, DEC-10
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resolve-diagnostics.test.ts` (new)
**Tags**: @backend

**Preconditions**:

- The delivered classifier.

**Steps**:

1. Classify `{ kind: "dispatch", code: "state.lock.busy" }`.
2. Classify `{ kind: "state", code: "state.lock.busy" }`.

**Expected Outcome**:

- The mismatched pair yields `fallback.internal`; the matched pair yields `state.lock.busy`.
- This control proves the kind assertion in TC-RESOLVE-002/003 is load-bearing.

#### TC-RESOLVE-008 - Resolution replay is a no-op and the open record is byte-identical

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3.5, F-3.6, NFR-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resolve-diagnostics.test.ts` (new)
**Tags**: @backend, @state

**Preconditions**:

- An open divergence resolved once with a note.

**Steps**:

1. Resolve the same id again with a different note.
2. Compare the serialized original open record to its value before resolution.
3. Assert the reported payload shape.

**Expected Outcome**:

- The replay is a no-op reporting the existing record (no second resolved record, no rewrite of the original).
- The original open record is byte-identical; the success payload, bounds, principal, and timestamps are unchanged.

#### TC-DIVREC-001 - A delivered-but-unverifiable attempt opens one declared-shape divergence

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.1, F-4.2, F-4.3, AC-F4-1, DM-2, DM-3, DEC-9, A-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new), command scenario with `COMPLETED_EVIDENCE`, a readable progressed ledger, and an unreadable tracker read carrying `config.credential.missing`
**Tags**: @backend, @cli, @state

**Preconditions**:

- Shared classifier outcome `completed`; `reads.ledger` readable with `progressed: true`; `reads.tracker` unreadable with identity `config.credential.missing`; no open divergence for the pair.

**Steps**:

1. Run `dispatch GH-301 --json`.
2. Read the attempt and divergence ledgers.
3. Assert the record shape and the correlation.

**Expected Outcome**:

- Exactly one open divergence: `comparisonClass: "not-applicable"`, `engineToken: "state-unverified"`, `comparisonToken: null`, repository/ref/attemptId/`recordedAt` populated, `evidenceRefs` = `["attempt:<attemptId>", "truth:unreadable:tracker"]`.
- The attempt carries that `divergenceRef`; the reason is one of `ledger`/`tracker`/`artifact`/`state` and is never `ci`.

**Notes / Clarifications**: This is an attempt-stage case, so it runs on the engine/command surface with the preflight omitted (as in TC-ADMIT-008). On a production composition the same event is reachable when a provisioned credential stops working between admission and the post-session read; the production-composition variant belongs to TC-ADMIT-005's route separation and is not duplicated here.

#### TC-DIVREC-002 - Each delivered-evidence conjunct falsified yields no divergence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.1, F-4.5, AC-F4-3, A-10, DEC-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new)
**Tags**: @backend, @state

**Preconditions**:

- Four scenarios sharing an unreadable truth read: (a) classifier outcome other than `completed` (e.g. `spawn-refused`/`failed` evidence); (b) unreadable ledger; (c) readable ledger with `progressed: false`, `completed < total`; (d) a control where the persisted attempt outcome is `failed` but delivery evidence is established.

**Steps**:

1. Run each scenario.
2. Read the divergence ledger.

**Expected Outcome**:

- (a), (b), (c): zero divergences; the attempt remains exposure-only.
- (d): one divergence — proving the persisted outcome `failed` is never the evidence input.

#### TC-DIVREC-003 - A resume reuses the open divergence instead of appending

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.6, AC-F4-4, DM-6, DEC-9, RSK-15
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new)
**Tags**: @backend, @state

**Preconditions**:

- A first run that opened one delivered-evidence divergence for `(github.com/owner/repo, GH-301)`; a second unverifiable-but-delivered attempt for the same pair (resume).

**Steps**:

1. Run the first dispatch; capture the divergence id.
2. Run the second dispatch.
3. Read the divergence ledger and the summary.

**Expected Outcome**:

- Exactly one divergence record exists for the pair; the second attempt's `divergenceRef` equals the first divergence id; the unresolved count is unchanged.

#### TC-DIVREC-004 - Summary lists and counts it; resolution decrements by exactly one

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.7, AC-F4-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new)
**Tags**: @backend, @cli

**Preconditions**:

- The divergence from TC-DIVREC-001; a resolvable local ledger.

**Steps**:

1. Run `dispatch dual-run summary --repo ... --json` before resolution.
2. Run `dispatch dual-run resolve <id> --note "..." --json`.
3. Run the summary again.

**Expected Outcome**:

- Before: exit `0`, the id is listed, unresolved count includes it.
- After: unresolved count decreases by exactly one; the attempt and both divergence records remain readable.

#### TC-DIVREC-005 - A new divergence opens only after the previous is resolved

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4.6, AC-F4-5, DM-6, DEC-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new)
**Tags**: @backend, @state

**Preconditions**:

- A pair with one open divergence; then the same pair after that divergence is resolved.

**Steps**:

1. Record an unverifiable-but-delivered attempt while a divergence is open → assert no append.
2. Resolve the open divergence.
3. Record another unverifiable-but-delivered attempt for the same pair.

**Expected Outcome**:

- Step 1: no new record; the attempt references the open one.
- Step 3: a new divergence may open, because none is open.

#### TC-DIVREC-006 - Record bounds, closed read families, and validator-first-pass

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4.3, NFR-5, NFR-11, A-11
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new)
**Tags**: @backend, @state

**Preconditions**:

- Divergences produced from each of the four unreadable read families; a record with the maximum plausible evidence references.

**Steps**:

1. Produce one divergence per read family.
2. Assert the reason vocabulary and the evidence-reference count.
3. Validate each record with the delivered validator on first attempt.

**Expected Outcome**:

- Reasons are drawn only from `ledger`/`tracker`/`artifact`/`state`; no `ci` reason exists or is emitted.
- Evidence references ≤ 16 per record; repository/ref/attemptId/`recordedAt` present; every record passes the validator on first attempt.

#### TC-DIVREC-007 - An unrelated open mismatch divergence does not suppress recording

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4.2, DM-6, DEC-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new)
**Tags**: @backend, @state

**Preconditions**:

- A pre-existing open divergence with `comparisonClass: "verify-change"` (a mismatch) for the same repository, plus an unverifiable-but-delivered attempt for a ref with no delivered-evidence divergence.

**Steps**:

1. Run the dispatch.
2. Read the divergence ledger.

**Expected Outcome**:

- A new delivered-evidence divergence is appended; the unrelated mismatch record does not suppress it and is not reused, because the dedupe predicate is shape-based.

**Notes / Clarifications**: Mirrors TDR-0020 constraint C-4: an unrelated open `mismatch` divergence never suppresses the delivered-evidence record.

#### TC-DIVREC-008 - A failed divergence append is declared and never referenced

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.2, DM-2, DM-3, NFR-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new), a store double that fails only the divergence append
**Tags**: @backend, @state

**Preconditions**:

- A store double whose attempt append succeeds and whose divergence append returns `state.write.failed`.
- A delivered-and-unverifiable attempt (the TC-DIVREC-001 fact set) with no open divergence for the pair; a fixed clock and id factory.

**Steps**:

1. Run the dispatch.
2. Read the attempt ledger and the divergence ledger.
3. Inspect the derived token, the failure envelope's `error` object (the `data.error` surface named by the append-failure contract), the run's `lastMessage`/`last_message`, the exit code, and the attempt's `divergenceRef` and evidence references.
4. Count the attempt appends for the run and classify `{ kind: "state", code: "state.write.failed" }` through the delivered classifier in the same test body.

**Expected Outcome**:

- The attempt is appended **exactly once**; the divergence ledger holds no record for the pair.
- The attempt carries **no** `divergenceRef` — never a fabricated or dangling reference to a record that was not written — and its bounded evidence references include `divergence:append-failed` (still ≤ 16 references, `attempt:<id>` and `truth:unreadable:<reason>` intact).
- The derived token is the unchanged `state-unverified`; the failure envelope's `error.code` (the `data.error.code` value the append-failure contract names) is `state.write.failed`, accompanied only by the fields the envelope already carries: the row's `category`, `retryable`, `consequence`, `remediationHint`, and `summary`. `CommandResultError` has no `kind` and no `projection` field, so neither is read off the envelope.
- Domain kind and projection are asserted where they exist — through the classification path: the same pair `{ kind: "state", code: "state.write.failed" }` classifies to the delivered row with its own kind, projection class, and exit, and the process exit is that row's exit `2`. No `fallback.internal` and no `dispatch.state-unverified` appears in the classified result.
- The run never claims the divergence landed and never reports a divergence id: no silent success and no fabricated record; the text of `lastMessage` names that the divergence append failed.

**Notes / Clarifications**: Resolved OQ-1 (§8.4). The observable surface is fixed: the append is attempted once, the failure is declared by the bounded `divergence:append-failed` evidence reference plus the underlying state identity on the envelope error, the derived token and exit are unchanged, and the attempt is not retried or duplicated. The assertion set deliberately stops at the envelope contract (`packages/core/src/contracts/result.ts`): a test that demanded `kind` or `projection` on `data.error` would require an unplanned contract change to pass.

#### TC-DIVREC-009 - A replayed attempt appends nothing, even after resolution

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F4-4, DM-6, DEC-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new)
**Tags**: @backend, @state

**Preconditions**:

- An already-recorded attempt with its divergence, later resolved; a replay of that same recorded attempt.

**Steps**:

1. Replay the recording of the already-recorded attempt.
2. Read both ledgers.

**Expected Outcome**:

- No second attempt and no second divergence; the replayed recording appends nothing, even though the divergence is resolved.

**Notes / Clarifications**: Mirrors TDR-0020 constraint C-4 (a replay of an already-recorded attempt appends nothing, even after resolution).

#### TC-DIVREC-010 - The attempt keeps the underlying failure identity on `last_message`

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4.8, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new)
**Tags**: @backend, @cli

**Preconditions**:

- The delivered-but-unverifiable attempt from TC-DIVREC-001.

**Steps**:

1. Read the attempt's `last_message` and the envelope's error summary.
2. Assert the identity is present without a credential read.

**Expected Outcome**:

- `last_message` is bounded (≤ 512) and names the underlying unreadable-read identity, so a resolver sees why the attempt was unverifiable without consulting a credential.

#### TC-DIVREC-011 - A failed attempt append leaves a standing open divergence that stays resolvable and dedupe-usable

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.2, F-4.4, F-4.6, F-4.8 (attempt-append-failure/orphan direction), DM-2, DM-6, NFR-11, DEC-3, DEC-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new), a store double whose divergence append succeeds and whose attempt append returns `state.write.failed`, over the delivered ledger reader, `dispatch dual-run summary`, and `dispatch dual-run resolve`
**Tags**: @backend, @state

**Preconditions**:

- A store seam in which the divergence write succeeds and the attempt write fails with `state.write.failed`.
- A delivered-and-unverifiable fact set (the TC-DIVREC-001 fact set) with no open divergence for `(github.com/owner/repo, GH-301)`; a fixed clock and id factory.
- The delivered divergence ledger reader, the summary command, and the resolve path available over the same temp state root.

**Steps**:

1. Run the dispatch and read the failure surface and the exit code.
2. Read both ledgers: count attempt records and open divergences for the pair.
3. Run `dispatch dual-run summary --repo ... --json` and read the listing and the unresolved count.
4. Run a second unverifiable-but-delivered dispatch for the same pair with a healthy attempt store; read the new attempt and both ledgers.
5. Run `dispatch dual-run resolve <id> --note "..." --json` for the standing divergence with spy credential and transport ports, then re-run the summary.

**Expected Outcome**:

- The divergence append lands: exactly one open divergence exists for the pair with the declared delivered-evidence shape (`not-applicable`, `state-unverified`, `comparisonToken: null`, `truth:unreadable:<reason>`), and its `attempt:<id>` evidence reference names the attempt that was never persisted — the accepted residual of the append order, not a claim that the attempt exists.
- Zero attempt records exist for the pair. The failure envelope's `error.code` is `state.write.failed` with exit `2`; no surface claims that an attempt was recorded and no `divergenceRef` is reported for a run that produced no attempt.
- The summary exits `0`, lists the standing divergence identifier, and counts it as unresolved.
- The later attempt for the same pair carries that divergence identifier, appends no second divergence, and leaves the unresolved count unchanged — the orphan still satisfies the per-pair dedupe predicate.
- The divergence resolves from local evidence only (zero credential resolutions, zero transport requests, zero truth reads), the unresolved count decreases by exactly one, and the record stays readable before and after.
- No attempt record is fabricated at any step, and no step reports a divergence id that is not in the ledger.

**Notes / Clarifications**: The delivered order writes the divergence before the attempt in the same step, so this direction is reachable: a failed attempt append leaves an open obligation whose evidence reference cannot be attested. The change accepts and documents that orphan instead of compensating for it — it stays listed, countable, locally resolvable, and reusable by dedupe. The contract lives in F-4.4 (the append order, the accepted orphan, and the returned state identity) and F-4.6 (the per-pair dedupe applies equally to the orphan, so a later attempt references it instead of opening a second divergence), together with DEC-3/DEC-9. This is the mirror of OQ-1/TC-DIVREC-008, and it is assigned to plan Phase 6.

#### TC-STATCRED-001 - Affected status sections carry `credentialPrerequisite`, `sources[]` unchanged

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.1, F-6.2, AC-F6-1, DM-4, DEC-8, RSK-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-credential-prerequisite.test.ts` (new), composed status runtime with credential-unavailable reads
**Tags**: @backend, @cli, @state

**Preconditions**:

- `statusInstance()` declaring `github-read` over `GITHUB_TOKEN`; credential-unavailable tracker, changes, and CI reads; a real temp store.

**Steps**:

1. Run `status --json`.
2. Derive the affected section set **from the digest result itself**: every section whose evidence carries reason `credential-unavailable` and whose failing source is credential-dependent. Do not hardcode a section list.
3. Assert `credentialPrerequisite` on exactly that derived set, and assert its absence on every other section in the same digest.
4. Assert the `sources[]` shape and bound.

**Expected Outcome**:

- Each affected section is `unknown` with failed credential evidence; its evidence record carries `credentialPrerequisite: { referenceName: "github-read", sourceKey: "GITHUB_TOKEN" }`.
- Every section outside the derived set carries no `credentialPrerequisite`.
- A section outside the tracker/changes/CI triple that degrades with a credential failure (for example the changes-and-PR section) is included automatically because it is in the derived set.
- No `sources[]` entry is added; each entry still has only `{ source, outcome, failureCode?, failureClass? }`; the six-entry bound holds.
- Exit `0` with all nine sections.

**Notes / Clarifications**: Resolved OQ-4 (§8.4): the assertion set is computed from the digest, so a hardcoded section list can neither pass vacuously nor miss a newly credential-dependent section.

#### TC-STATCRED-002 - Observing and otherwise-unavailable sections carry no prerequisite

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.1, F-6.2, AC-F6-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-credential-prerequisite.test.ts` (new)
**Tags**: @backend, @cli

**Preconditions**:

- Case A: a resolving credential and readable tracker/changes/CI sources (every section observing).
- Case B: a resolving credential with one source failing for a non-credential reason (`read-failed`).

**Steps**:

1. Run `status --json` for each case.
2. Derive the credential-unavailable section set from the digest result and assert it is empty.
3. Assert `credentialPrerequisite` is absent from every section in the digest — including the observing sections in case A and the `read-failed` section in case B.

**Expected Outcome**:

- No section carries `credentialPrerequisite` when the credential resolves or when a section is unavailable for a non-credential reason; the field appears only on sections whose credential-dependent source failed.
- The absence is asserted across the whole digest, not on a hardcoded list (resolved OQ-4).

#### TC-STATCRED-003 - No observed section, no fabricated zero, no finding, no vocabulary growth

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.1, F-6.2, F-6.4, AC-F6-2, DM-4, RSK-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-credential-prerequisite.test.ts` (new) + unchanged `tests/fixtures/status/golden/**`
**Tags**: @backend, @cli, @contract

**Preconditions**:

- The credential-unavailable fact set; the committed digest goldens (fully observed, credential healthy).

**Steps**:

1. Run the digest.
2. Assert no affected section is `observed`, no count is fabricated as zero for the unread source, and no finding is emitted from the failed read.
3. Assert the digest schema version, section set/order, state values, and finding codes are unchanged; confirm the goldens need no regeneration.
4. Assert the delivered command contract: exit `0`, nine sections, no repair, no extra read (call recorder unchanged).

**Expected Outcome**:

- No observed section; no fabricated zero; no finding from the failed read; unchanged vocabulary and schema; goldens byte-identical.

#### TC-STATCRED-004 - The prerequisite carries names only, never a value

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.6, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-credential-prerequisite.test.ts` (new)
**Tags**: @backend, @security

**Preconditions**:

- The truth-read key present in the injected environment with a planted canary, but the tracker read failing as credential-unavailable.

**Steps**:

1. Run `status --json` and `status`.
2. Scan both outputs for the canary.

**Expected Outcome**:

- The prerequisite is identifier-only; zero occurrences of the value in the digest, human output, or any evidence record.

#### TC-DOCTCRED-001 - The doctor hint names the resolved key (literal and derived)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6.5, AC-F6-3, A-8, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-tracker.test.ts` (modify)
**Tags**: @backend, @cli

**Preconditions**:

- `CREDENTIAL_MISSING` with `envVar: "EXAMPLE_PRODUCT_GITHUB_TOKEN"`; an added derived-prefix case whose resolved key is `EXAMPLE_PRODUCT_TRACKER_TOKEN`.

**Steps**:

1. Run `doctor --json` for each case.
2. Assert the tracker check's verdict, reasons, and fix hint.
3. Assert no value is rendered.

**Expected Outcome**:

- `tracker.credential-unavailable` with `verdict: "fail"`, the same closed reasons, and a fix hint naming the resolved key; counts unchanged; no credential value.

#### TC-DOCTCRED-002 - Doctor stays outside the prompt-required inventory

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.5, AC-F6-3, DEC-5, NFR-10, RSK-10
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/reference-page-parity.test.ts` (modify), with `tests/structure/doctor-contract.test.ts` and `tests/structure/dispatch-help-inventory.test.ts` unchanged as controls
**Tags**: @cli, @regression

**Preconditions**:

- The delivered prompt-required command set and help inventory.

**Steps**:

1. Assert `PROMPT_REQUIRED_COMMANDS` does not contain `doctor`.
2. Assert the help coverage inventory still names exactly the prompt-required set and that `dispatch` has exactly four help entries.
3. Assert `doctor`'s help entry, if any, is not registered as prompt-required.

**Expected Outcome**:

- Doctor is unshipped; the inventory and help pins are unchanged; the only doctor artefact in this change is the parity test.

#### TC-DOCS-001 - The provisioning guide documents the sanctioned bridge

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5.1, F-5.2, F-5.3, F-5.4, AC-F5-1, AC-F5-4, DEC-4, RSK-4, RSK-14
**Test Type(s)**: Manual, Documentation
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/tracker-credential-provisioning.md` (new), asserted by a content test
**Tags**: @docs

**Preconditions**:

- The guide exists with its `ados_distribution` marker.

**Steps**:

1. Read the guide and assert each required fact: the exact key `GITHUB_TOKEN`, the `github-read` reference, the reference-is-declared-data and environment-only-source statements, the explicit export bridge in command-substitution form (`export GITHUB_TOKEN="$(gh auth token)"`), the no-keyring/no-ambient/no-fallback rule, shell-history hygiene, least-privilege/read-scoped guidance, rotation and revocation, the set-but-rejected diagnostic path, and the 404 scope-and-repository-access check.
2. Assert it records that the key is registered for redaction by this change rather than by the config-catalog path.
3. Assert no example value is a real or realistic credential.

**Expected Outcome**:

- Every required fact is present exactly once and no example contains a credential-shaped string.

#### TC-DOCS-002 - The reference page documents ordering, mapping, caveat, and resolution

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5.5, AC-F5-2, NFR-10, RSK-8, RSK-13
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/dispatch-doc-conformance.test.ts` (modify) over `doc/planning/oss-tooling/milestones/m1/commands/dispatch.md`
**Tags**: @docs, @contract

**Preconditions**:

- The page's existing pinned phrases and the two-file allowlist.

**Steps**:

1. Add required phrases covering the pre-`claimLease` ordering, the named key and reference, the five status-keyed mappings with kinds and exits, the 404 scope caveat, the per-work-item dedupe, and the resolution path.
2. Keep the existing evidence-bar phrases and the stale-phrase negative controls.
3. Keep the allowlist at its two declared files.

**Expected Outcome**:

- Every new required phrase is present; no stale phrase reappears; the allowlist assertion still holds; the non-interactive consumer compatibility statement is present.

#### TC-DOCS-003 - Every changed guides document declares its distribution marker

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5.7, AC-F5-3, NFR-12
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh` (no change) plus the guide's front matter
**Tags**: @docs, @ci

**Preconditions**:

- The new/updated guides documents.

**Steps**:

1. Run `bash scripts/.tests/test-doc-distribution.sh`.
2. Assert each changed document under the guides area declares `ados_distribution` with a canonical value.

**Expected Outcome**:

- The drift guard passes; no doc is added or changed without a marker.

#### TC-DOCS-004 - The change record carries the four-assertion TDR-0015 amendment pointer

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4.9, DEC-3
**Test Type(s)**: Manual, Documentation
**Automation Level**: Manual
**Target Layer / Location**: `chg-GH-279-spec.md` §15 DEC-3, TDR-0015's four additive notes, TDR-0020
**Tags**: @docs

**Preconditions**:

- The two Proposed records and the spec.

**Steps**:

1. Confirm TDR-0015 carries an additive GH-279 note on each of the four amended assertions (§1 `Truth(W)`, §1 `Coverage(W)`, §1 record-level degradation, §5).
2. Confirm TDR-0020 is named as the durable home and no supersession is claimed.
3. Confirm the spec's DEC-3 points at TDR-0020 rather than narrowing the scope.

**Expected Outcome**:

- Four notes exist; every other TDR-0015 clause is untouched; no supersession is claimed.

#### TC-REG-001 - Refusals, resolve envelopes, and divergence records are deterministic

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-admission-preflight.test.ts` (new) + `tests/behaviour/dispatch-resolve-diagnostics.test.ts` (new) + `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (new)
**Tags**: @backend, @determinism

**Preconditions**:

- Fixed clock, fixed id factories, identical injected environments, two isolated state roots.

**Steps**:

1. Produce a refusal, a resolve envelope, and a divergence record twice.
2. Compare serialized forms byte-for-byte.

**Expected Outcome**:

- All three are byte-identical across runs.

#### TC-REG-002 - Vocabulary, error table, config, and command surface do not grow

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-8, G-7, F-5.6, AC-F2-5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: existing `tests/checks/error-table-sync.test.ts`, `tests/structure/delivery-result-contract.test.ts`, `tests/structure/dispatch-token-home.test.ts`, `tests/structure/dispatch-help-inventory.test.ts` (all unchanged)
**Tags**: @cli, @contract, @regression

**Preconditions**:

- The current committed counts.

**Steps**:

1. Run the four suites.
2. Assert token set is the eleven-token taxonomy, `DOMAIN_KINDS` membership is unchanged, the machine and documented error tables are in sync at the current count, and no configuration key or command/flag is added.

**Expected Outcome**:

- All suites green with no fixture edits other than the additive preflight port inventory entry (TC-REG-004).

#### TC-REG-003 - Secret-read and environment-read boundaries stay narrow

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-9, F-5.3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/secret-read-boundary.test.ts` (unchanged) + `tests/structure/cli-edge-seam.test.ts` (modify)
**Tags**: @security, @ci

**Preconditions**:

- The credential adapter's allowlist.

**Steps**:

1. Run the secret-read boundary check.
2. Run the CLI env-read scan.
3. Assert the allowlist gained no entry.

**Expected Outcome**:

- Both green; zero new `process.env`/`Bun.env`/`Deno.env` reads outside the credential adapter.

#### TC-REG-004 - The preflight port is additive, optional, and distinct from `admission`

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.1, F-1.2, NFR-8, DEC-6, DEC-11, RSK-7
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-preflight-contract.test.ts` (new) + `tests/fixtures/ports/v1-contract-inventory.json` (deliberate additive update)
**Tags**: @core, @contract

**Preconditions**:

- The delivered contract inventory fixture.

**Steps**:

1. Assert `preflight` is optional on the engine ports type and is a distinct member from `admission`.
2. Assert the preflight precedes `claimLease` and the spawn/resume block in the engine's run order (ordering assertion, distinct from the composition-level one).
3. Diff the contract inventory: exactly the new preflight declarations are added.

**Expected Outcome**:

- The port is optional and distinct; the ordering assertion holds; the inventory delta is additive only; no runtime-neutrality rule is broken (`tests/structure/port-neutrality.test.ts` green).

#### TC-REG-005 - Help and doc-conformance pins stay green with no weakened assertions

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-10, RSK-8
**Test Type(s)**: Conformance
**Automation Level**: Automated + reviewed
**Target Layer / Location**: `tests/structure/dispatch-help-inventory.test.ts`, `tests/checks/dispatch-doc-conformance.test.ts`, `tests/checks/reference-page-parity.test.ts`
**Tags**: @docs, @cli, @regression

**Preconditions**:

- The three suites and the change diff.

**Steps**:

1. Run the three suites.
2. Review the diff of those files: every previously pinned phrase and count is still asserted; new phrases were added, none removed.
3. Confirm the dispatch help entries remain exactly four.

**Expected Outcome**:

- All green; no assertion deleted or weakened; the diff shows additions only (except the explicitly inverted composition assertions of TC-ADMIT-005).

## 6. Environments and Test Data

| Aspect | Decision |
|---|---|
| Runtime | Local developer machine / CI; Bun with `bun:test`; Node standard library only where needed |
| Isolation | Every suite creates its own temp root with `mkdtempSync` under `tmp/tmpdir` (or `TMPDIR`); no test reads or writes `~/.delivery-os-state` or any live checkout |
| Clock and ids | A fixed clock (`2026-11-08T10:00:00.000Z` for dispatch; the status harness's fixed instant) and deterministic id factories; no wall-clock participation in assertions other than the single NFR-1 bound |
| Network | No network at any point: `installThrowingFetchGuard` where a suite could otherwise fetch; transport doubles for provider reads; a transport spy for zero-request assertions |
| Credential material | A planted canary from `tests/fixtures/credentials/cases.ts` supplied through an **injected environment record**, never the host environment; no real or realistic token is written to a fixture (`tests/checks/fixture-privacy.test.ts` scans `tests/fixtures/dispatch`) |
| Credential doubles | Refusing (`config.credential.missing`), resolving, literal `github-read`/`GITHUB_TOKEN`, and environment-prefixed (`<brand prefix>TRACKER_TOKEN`) references |
| Read-outcome doubles (engine boundary) | Status-keyed responders that reproduce the delivered adapter contract exactly: `404 → provider.not-found`; other non-2xx → `provider.payload.invalid` **with** `httpStatus`; a received-but-malformed `2xx` → `provider.payload.invalid` **with the received `2xx` status** (`httpStatus: 200`, the status-present branch); a transport throw or timeout → `provider.payload.invalid` **without any** status (the only status-absent branch). The doubles never decide the discriminator on their own: the stamp they carry is the contract pinned by TC-READMAP-010 |
| Adapter read drives | The real `createGitHubClient` (`client.ts` + `normalize.ts`) over an injected fixture transport, with `installThrowingFetchGuard` in place, for the four-case set (malformed `200`, transport throw, `404`, another non-2xx). No input hands the client a pre-stamped failure, so deleting the stamp fails the case rather than being absorbed by a fixture (TC-READMAP-010) |
| Classifier and envelope drives | `runCli` with a program handler that returns — and separately throws — the failure, so both delivered forwarding paths are exercised; the trusted-refusal marker is present only in the marked leg, leaving the delivered config suppression as the default (TC-CREDNAME-007) |
| **Preflight vs post-session read separation (RSK-11)** | The transport double routes by request shape: the admission work-item read is the single non-paginated issues/`items` request for the reference; the post-session reads keep their own responder keys. A fixture must never fail "all requests" blindly, because that cannot distinguish the two populations |
| Store doubles | Real state stores for success and ledger assertions; narrow store doubles that fail exactly one seam — a read failure, a divergence-append-only failure for TC-DIVREC-008, or an attempt-append-only failure for TC-DIVREC-011 — so the observed outcome can only be attributed to that one seam |
| Harness doubles | The delivered scripted harness session port with real classifier outcomes from `COMPLETED_EVIDENCE`, `SPAWN_REFUSED_EVIDENCE`, `TOOL_FAILURE_EVIDENCE`, `PREMATURE_END_EVIDENCE`, `TIMED_OUT_EVIDENCE` |
| Goldens | `tests/fixtures/dispatch/golden/errors/*.json` created deliberately for the five refusal shapes; `tests/fixtures/status/golden/**` must stay byte-identical (fully observed facts have a healthy credential), and any change is regenerated only by the explicit script |
| Contracts pinned | `tests/fixtures/ports/v1-contract-inventory.json` moves only for the additive preflight declarations; the delta is asserted by TC-REG-004 |
| Cleanup | Every suite removes its temp root in `finally`; no fixture writes into the repository tree |

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file (new = **N**, update = **U**, unchanged = **-** ) | Status | Targeted command |
|---|---|---|---|
| TC-ADMIT-001 | `tests/behaviour/dispatch-admission-preflight.test.ts` (**N**) | To Implement | `bun test tests/behaviour/dispatch-admission-preflight.test.ts` |
| TC-ADMIT-002 | `tests/structure/dispatch-composition.test.ts` (**U**) | Existing – Update | `bun test tests/structure/dispatch-composition.test.ts` |
| TC-ADMIT-003 | `tests/behaviour/dispatch-admission-preflight.test.ts` (**N**) | To Implement | `bun test tests/behaviour/dispatch-admission-preflight.test.ts` |
| TC-ADMIT-004 | `tests/structure/dispatch-composition.test.ts` (**U**) | Existing – Update | `bun test tests/structure/dispatch-composition.test.ts` |
| TC-ADMIT-005 | `tests/structure/dispatch-composition.test.ts` (**U**, invert two suites) | Existing – Update | `bun test tests/structure/dispatch-composition.test.ts` |
| TC-ADMIT-006 | `tests/behaviour/dispatch-admission-read-mapping.test.ts` (**N**) | To Implement | `bun test tests/behaviour/dispatch-admission-read-mapping.test.ts` |
| TC-ADMIT-007 | `tests/behaviour/dispatch-admission-preflight.test.ts` (**N**) | To Implement | `bun test tests/behaviour/dispatch-admission-preflight.test.ts` |
| TC-ADMIT-008 | `tests/behaviour/dispatch-admission-preflight.test.ts` (**N**) | To Implement | `bun test tests/behaviour/dispatch-admission-preflight.test.ts` |
| TC-ADMIT-009 | `tests/behaviour/dispatch-admission-preflight.test.ts` (**N**) | To Implement | `bun test tests/behaviour/dispatch-admission-preflight.test.ts` |
| TC-ADMIT-010 | `tests/behaviour/dispatch-admission-read-mapping.test.ts` (**N**) | To Implement | `bun test tests/behaviour/dispatch-admission-read-mapping.test.ts` |
| TC-READMAP-001 | `tests/behaviour/dispatch-admission-read-mapping.test.ts` (**N**) | To Implement | `bun test tests/behaviour/dispatch-admission-read-mapping.test.ts` |
| TC-READMAP-002 | same (**N**) | To Implement | same |
| TC-READMAP-003 | same (**N**) | To Implement | same |
| TC-READMAP-004 | same (**N**) | To Implement | same |
| TC-READMAP-005 | same (**N**) | To Implement | same |
| TC-READMAP-006 | same (**N**) | To Implement | same |
| TC-READMAP-007 | same (**N**) | To Implement | same |
| TC-READMAP-008 | same (**N**) | To Implement | same |
| TC-READMAP-009 | same (**N**) + `tests/fixtures/dispatch/golden/errors/*.json` (**N**) | To Implement | same |
| TC-READMAP-010 | `tests/behaviour/providers/github-inputs.test.ts` (**U**, new malformed-`200` case) + `tests/behaviour/providers/github-trap.test.ts` (**U**, extend `GH-PAYLOAD-HTTP-STATUS`) | Existing – Update | `bun test tests/behaviour/providers/github-inputs.test.ts tests/behaviour/providers/github-trap.test.ts` |
| TC-CREDNAME-001 | `tests/behaviour/dispatch-admission-diagnostics.test.ts` (**N**) | To Implement | `bun test tests/behaviour/dispatch-admission-diagnostics.test.ts` |
| TC-CREDNAME-002 | same (**N**) | To Implement | same |
| TC-CREDNAME-003 | same (**N**) | To Implement | same |
| TC-CREDNAME-004 | same (**N**) | To Implement | same |
| TC-CREDNAME-005 | same (**N**) | To Implement | same |
| TC-CREDNAME-006 | `tests/structure/cli-edge-seam.test.ts` (**U**) | Existing – Update | `bun test tests/structure/cli-edge-seam.test.ts` |
| TC-CREDNAME-007 | `tests/behaviour/error-classification.test.ts` (**U**, add the marked/unmarked pair beside the delivered untrusted-config pins) | Existing – Update | `bun test tests/behaviour/error-classification.test.ts` |
| TC-RESOLVE-001 | `tests/structure/dispatch-resolve-composition.test.ts` (**N**) | To Implement | `bun test tests/structure/dispatch-resolve-composition.test.ts` |
| TC-RESOLVE-002 | `tests/behaviour/dispatch-resolve-diagnostics.test.ts` (**N**) | To Implement | `bun test tests/behaviour/dispatch-resolve-diagnostics.test.ts` |
| TC-RESOLVE-003 | same (**N**) | To Implement | same |
| TC-RESOLVE-004 | same (**N**) | To Implement | same |
| TC-RESOLVE-005 | same (**N**) | To Implement | same |
| TC-RESOLVE-006 | same (**N**) | To Implement | same |
| TC-RESOLVE-007 | same (**N**) | To Implement | same |
| TC-RESOLVE-008 | same (**N**) | To Implement | same |
| TC-DIVREC-001 | `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` (**N**) | To Implement | `bun test tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` |
| TC-DIVREC-002 | same (**N**) | To Implement | same |
| TC-DIVREC-003 | same (**N**) | To Implement | same |
| TC-DIVREC-004 | same (**N**) | To Implement | same |
| TC-DIVREC-005 | same (**N**) | To Implement | same |
| TC-DIVREC-006 | same (**N**) | To Implement | same |
| TC-DIVREC-007 | same (**N**) | To Implement | same |
| TC-DIVREC-008 | same (**N**) | To Implement | same |
| TC-DIVREC-009 | same (**N**) | To Implement | same |
| TC-DIVREC-010 | same (**N**) | To Implement | same |
| TC-DIVREC-011 | same (**N**, store double failing only the attempt append) | To Implement | same |
| TC-STATCRED-001 | `tests/behaviour/status-credential-prerequisite.test.ts` (**N**) | To Implement | `bun test tests/behaviour/status-credential-prerequisite.test.ts` |
| TC-STATCRED-002 | same (**N**) | To Implement | same |
| TC-STATCRED-003 | same (**N**) + `tests/fixtures/status/golden/**` (**–**, must stay identical) | To Implement | same + `bun test tests/behaviour/status-output.test.ts` |
| TC-STATCRED-004 | same (**N**) | To Implement | same |
| TC-DOCTCRED-001 | `tests/behaviour/doctor-tracker.test.ts` (**U**) | Existing – Update | `bun test tests/behaviour/doctor-tracker.test.ts` |
| TC-DOCTCRED-002 | `tests/checks/reference-page-parity.test.ts` (**U**) | Existing – Update | `bun test tests/checks/reference-page-parity.test.ts` |
| TC-DOCS-001 | `tests/checks/tracker-credential-provisioning-guide.test.ts` (**N**) over `doc/guides/tracker-credential-provisioning.md` | To Implement | `bun test tests/checks/tracker-credential-provisioning-guide.test.ts` |
| TC-DOCS-002 | `tests/checks/dispatch-doc-conformance.test.ts` (**U**) | Existing – Update | `bun test tests/checks/dispatch-doc-conformance.test.ts` |
| TC-DOCS-003 | `scripts/.tests/test-doc-distribution.sh` (**–**, guard unchanged) | Existing – No Change | `bash scripts/.tests/test-doc-distribution.sh` |
| TC-DOCS-004 | manual inspection of the spec + TDRs | Manual Only | see MV-3 |
| TC-REG-001 | the three new behaviour suites (**N**) | To Implement | see their commands |
| TC-REG-002 | `tests/checks/error-table-sync.test.ts`, `tests/structure/delivery-result-contract.test.ts`, `tests/structure/dispatch-token-home.test.ts`, `tests/structure/dispatch-help-inventory.test.ts` (**–**) | Existing – No Change | `bun test tests/checks/error-table-sync.test.ts tests/structure/delivery-result-contract.test.ts tests/structure/dispatch-token-home.test.ts tests/structure/dispatch-help-inventory.test.ts` |
| TC-REG-003 | `tests/checks/secret-read-boundary.test.ts` (**–**) + `tests/structure/cli-edge-seam.test.ts` (**U**) | Existing – Update | `bun test tests/checks/secret-read-boundary.test.ts tests/structure/cli-edge-seam.test.ts` |
| TC-REG-004 | `tests/structure/dispatch-preflight-contract.test.ts` (**N**) + `tests/fixtures/ports/v1-contract-inventory.json` (**U**) | To Implement | `bun test tests/structure/dispatch-preflight-contract.test.ts tests/structure/port-contract-inventory.test.ts` |
| TC-REG-005 | `tests/structure/dispatch-help-inventory.test.ts` (**–**), `tests/checks/dispatch-doc-conformance.test.ts` (**U**), `tests/checks/reference-page-parity.test.ts` (**U**) | Existing – Update | `bun test tests/structure/dispatch-help-inventory.test.ts tests/checks/dispatch-doc-conformance.test.ts tests/checks/reference-page-parity.test.ts` |

**Plan phase mapping**

Every test case has a declared home in a plan phase's `tcCoverage`, so both artifacts can be read against each other without a second derivation. The cases the plan splits by half are shown at each half.

| Plan phase | Test cases |
|---|---|
| Phase 1 — decision and change record | TC-DOCS-004 (manual half) |
| Phase 2 — additive admission contract | TC-REG-004, TC-REG-002 (structure half) |
| Phase 3 — adapter read discriminator (received-`2xx` stamp) | **TC-READMAP-010** (the real-client stamping case), with TC-READMAP-004/006/007 holding the read halves of the contract it pins |
| Phase 4 — preflight, production composition, classification, diagnostics | TC-ADMIT-001…010, TC-READMAP-001…009, TC-CREDNAME-001…005, **TC-CREDNAME-007**, TC-REG-001 (determinism half) |
| Phase 5 — resolve typing and not-found | TC-RESOLVE-001…008 |
| Phase 6 — delivered-evidence divergence recording | TC-DIVREC-001…011, including the attempt-append-failure orphan direction (TC-DIVREC-011) |
| Phase 7 — status prerequisite, doctor parity, redaction | TC-STATCRED-001…004, TC-DOCTCRED-001…002, **TC-CREDNAME-006** (AC-F5-4 redaction/parity half), TC-REG-003 |
| Phase 8 — documentation, conformance, spec reconciliation, release | TC-DOCS-001…003, TC-REG-005, TC-REG-002 (documents half) |

AC-F5-4 is split across phases 7 and 8 by construction: TC-CREDNAME-006 proves the runtime-edge redaction half, and TC-DOCS-001 proves the guide-content half (least-privilege expectation plus the registration-by-this-change fact). Neither half alone satisfies the criterion.

**Fixture work implied by the table**

- `tests/fixtures/dispatch/admission.ts` (**N**): credential-port doubles (refusing/resolving/literal/prefixed), status-keyed transport responders keyed by request role (preflight work-item read vs post-session reads, with the malformed `2xx` responder carrying the received status), the recording transport spy, refusal expectation constants, the marked and unmarked config-failure variants for the trusted-marker pair, and the planted canary.
- `tests/fixtures/providers/github/**` (**U**): a `200` response whose body cannot be normalized, added to the read-failure status fixtures, so the real-client case drives the adapter rather than a double.
- `tests/fixtures/dispatch/ledger.ts` (**U**): add `deliveredEvidenceDivergence()` and a `mismatchDivergence()` builder variant for the shape-based dedupe case, plus the attempt-append-only failing store seam and the orphan ledger reader used by TC-DIVREC-011.
- `tests/fixtures/dispatch/golden/harness.ts` (**U**): add `preflight` (absent for the no-preflight control, supplied otherwise), `preflightRead` (separate from `reads`), and `phaseLedger`/`ledgerFacts` overrides so the delivered-evidence conjuncts can be falsified independently.
- `tests/fixtures/dispatch/truth.ts` (**U**): add a `deliveredButUnreadableReads()` builder (progressed ledger + unreadable tracker carrying `config.credential.missing`) and `noProgressIncompleteReads()`.
- `tests/fixtures/status/harness.ts` (**U**): add a credential-unavailable fact set that exercises all credential-dependent sections at once, and a helper to enumerate sections carrying `credential-unavailable`.
- `tests/fixtures/doctor/harness.ts` (**U**): add the derived-prefix credential-missing case.
- `tests/fixtures/ports/v1-contract-inventory.json` (**U**): exactly the additive preflight declarations.

**Manual verification procedures (not test cases)**

| ID | Procedure | Evidence |
|---|---|---|
| MV-1 | One real credentialed dispatch reaches a verdict other than `state-unverified`, with artifact, tracker, and CI corroboration recorded | Terminal transcript plus the artifact (phases/branch/PR), tracker state, and CI result in the PR description; no token printed, committed, or attached (spec §18) |
| MV-2 | `dispatch dual-run summary` before and after resolving one new delivered-evidence divergence, including a resume that references the existing open divergence instead of appending | Transcript showing the unresolved count moving by one and the reused id (spec §18) |
| MV-3 | The change record carries the four-assertion TDR-0015 amendment and names TDR-0020 as its home | Diff inspection (TC-DOCS-004) |

**Gate commands**

```bash
# targeted while iterating
bun test tests/structure/dispatch-composition.test.ts
bun test tests/behaviour/dispatch-admission-preflight.test.ts
bun test tests/behaviour/dispatch-admission-read-mapping.test.ts
bun test tests/behaviour/providers/github-inputs.test.ts tests/behaviour/providers/github-trap.test.ts
bun test tests/behaviour/dispatch-admission-diagnostics.test.ts
bun test tests/behaviour/error-classification.test.ts
bun test tests/behaviour/dispatch-resolve-diagnostics.test.ts
bun test tests/behaviour/dispatch-delivered-evidence-divergence.test.ts
bun test tests/behaviour/status-credential-prerequisite.test.ts
bun test tests/structure/dispatch-resolve-composition.test.ts
bun test tests/structure/dispatch-preflight-contract.test.ts

# docs and guards
bash scripts/.tests/test-doc-distribution.sh

# aggregate gate (required before completion)
TMPDIR=$PWD/tmp/tmpdir pnpm check

# whitespace/conflict-marker guard
git diff --check
```

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation in this plan |
|---|---|---|---|
| TR-1 | A fixture that fails all transport requests cannot distinguish the preflight read from the post-session truth read (spec RSK-11) | H | Status-keyed, role-routed responders; the plan declares both populations explicitly and TC-ADMIT-004 keeps a fully successful transport |
| TR-2 | The inverted composition suites pass vacuously if everything refuses | H | TC-ADMIT-004 (positive control) and TC-ADMIT-008 (no-preflight control) sit beside the inversion |
| TR-3 | Latency assertion flakes on a loaded CI host | M | The wall-clock bound is generous (2 000 ms for a no-I/O path) and the load-bearing assertion is zero requests; the measured value is recorded |
| TR-4 | A canary scan passes because the scanner is broken | H | TC-CREDNAME-004 feeds the scanner a deliberate leak and must see a hit |
| TR-5 | Tightening the delivered "not-applicable creates no divergence" rule breaks an unrelated gate case | M | TC-DIVREC-002/007 bound the new rule to delivered evidence and keep the admission-refusal not-applicable case divergence-free; the existing `dispatch-divergence.test.ts` case is updated only for the delivered-evidence exception |
| TR-6 | The contract inventory fixture is "fixed" by deleting entries | M | TC-REG-004 asserts an additive delta only; review checks the fixture diff |
| TR-7 | Golden regeneration masks a real status change | M | TC-STATCRED-003 asserts the goldens need no regeneration; any regeneration is an explicit, reviewed command |
| TR-8 | A diagnostics assertion turns into a brittle sentence match | L | Resolved OQ-3: substring assertions on the resolved key and reference, absence of the canary, and shape-only goldens; no full-sentence pins |
| TR-9 | The divergence-append failure test is written to whatever the code happens to do | M | Resolved OQ-1 fixes the observable contract: one attempt append, no `divergenceRef`, `divergence:append-failed` evidence, underlying state identity on the envelope error, derived token and exit unchanged; the mirrored attempt-append failure is fixed by OQ-5 (TC-DIVREC-011) |
| TR-10 | The inversion is "achieved" by deleting assertions | H | TC-REG-005 and the review checklist require additions/inversions, not deletions (RSK-8) |
| TR-11 | The malformed-`2xx`/transport distinction is "proven" against a double that already carries the stamp, so the adapter never implements it and the matrix still passes | H | TC-READMAP-010 drives the real client with an injected transport for all four cases and asserts status presence **and** absence in one block; the fixture hands the client no pre-stamped failure, so a missing stamp fails the case (Phase 3) |
| TR-12 | The trusted-refusal marker reopens untrusted config summary forwarding | H | TC-CREDNAME-007 asserts both directions — the marked refusal carries prose, the unmarked failure stays suppressed — and requires a marked non-credential config code to stay suppressed; the delivered untrusted-config pins remain unmodified in the same suite |
| TR-13 | The accepted orphan divergence is silently treated as a recorded attempt, double-counted, or made unresolvable | M | TC-DIVREC-011 asserts zero attempts, no claimed attempt or `divergenceRef`, one listed and counted open divergence, local resolution, and dedupe reuse of the same identifier |

### 8.2 Assumptions

- The delivered adapter contract holds as documented **and** the received-status stamp is implemented by this change: only `404` → `provider.not-found`; every other non-2xx → `provider.payload.invalid` **with** its `httpStatus`; a received-but-malformed `2xx` → `provider.payload.invalid` **with the received `2xx` status** (`httpStatus: 200`); a thrown or timed-out request → the same identity **without any** status. Status presence is the discriminator, so the malformed payload is status-present and only the transport throw is status-absent (TDR-0019 decision point 4, AC-F2-6). TC-READMAP-010 asserts that at the real client; every engine-level case consumes a double matching it.
- The delivered classification layer suppresses explicit summary and remediation hints on any config-shaped failure to keep untrusted config text out of output; this change adds one narrow trusted-refusal marker honoured only for `config.credential.missing`, so the bounded refusal prose reaches the machine envelope and the human diagnostic while the delivered suppression stays the default for everything unmarked (TC-CREDNAME-007).
- The delivered order writes the delivered-evidence divergence before the attempt in the same step, so an attempt-append failure leaves one open orphan divergence whose `attempt:<id>` evidence reference cannot be attested; the change accepts and documents that orphan rather than compensating for it (TC-DIVREC-011).
- Fixtures can inject the credential port, the transport, the preflight port, the phase ledger, and the clock independently, so no test needs a real keyring, token, harness, or network (spec A-9).
- The status runtime derives the prerequisite names from the declared instance reference plus the brand prefix, so the field is testable without a live credential read.
- The invocation-audit ledger stays out of scope, so its absence is asserted as "not asserted", never as "not written".
- The pre-existing `DIV-GH-275-…` record is never used as a test input from live state.
- The spec leaves both divergence-append-failure directions undefined; the OQ-1 and OQ-5 resolutions in §8.4 are the delivery contract for those cases only and change no successful-record shape.

### 8.3 Open Questions

None. The four questions raised by plan v1.0 were resolved by the PM on 2026-11-10, and the fifth — the append-failure direction the DoR iteration 1 review found uncovered — is resolved in §8.4 as OQ-5. All five are normative for delivery and are folded into the affected scenarios.

### 8.4 Resolved questions

| ID | Resolution | Applied in |
|---|---|---|
| OQ-1 | Divergence-append failure: append the attempt exactly once; never set a fabricated or dangling `divergenceRef`; add the bounded evidence reference `divergence:append-failed`; return the derived token (`state-unverified`) with the failure envelope's `error.code` carrying the underlying state identity (for example `state.write.failed`) plus the row fields `CommandResultError` already carries, and `lastMessage` naming that the divergence append failed; exit remains `2`. The identity's domain kind and projection are asserted through the classification path and the exit, never read off the envelope. No silent success, no fabricated record. | TC-DIVREC-008, DM-3, NFR-11, TR-9 |
| OQ-2 | The new guide path is exactly `doc/guides/tracker-credential-provisioning.md`; the content check lives at `tests/checks/tracker-credential-provisioning-guide.test.ts`. | TC-DOCS-001, TC-DOCS-003, §7 |
| OQ-3 | Diagnostics are asserted behavior-level, not as prose goldens: the resolved key and reference substrings must be present in the machine envelope summary and in the human diagnostic, the canary secret value must be absent everywhere, and no full prose sentence is pinned. Goldens pin envelope shape and classified fields only. | TC-READMAP-009, TC-CREDNAME-001, TC-CREDNAME-005, G-7, TR-8 |
| OQ-4 | `credentialPrerequisite {referenceName, sourceKey}` is asserted on the sections whose credential-dependent source failed and absent on observing sections and on sections unavailable for another reason; the affected section set is derived from the digest result, never a hardcoded list. | TC-STATCRED-001, TC-STATCRED-002, DM-4 |
| OQ-5 | Attempt-append failure (the divergence lands, the attempt does not): the standing open divergence is accepted and documented as a resolvable orphan — no compensation write, no backfill. It remains listed and counted as unresolved, resolves from local evidence, satisfies the per-pair dedupe predicate so a later attempt for the same pair references it instead of appending a second, and no surface claims a recorded attempt or a `divergenceRef`. The command returns the underlying state identity with its exit. | TC-DIVREC-011, DM-2, DM-3, DM-6, NFR-11, TR-13 |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-10 | `@test-plan-writer` | Initial plan for GH-279. 58 test cases trace all 30 acceptance criteria (AC-F1-1…AC-F6-3), DM-1…DM-6, NFR-1…NFR-14; the two delivered composition assertions are inverted with a positive control and a no-preflight control; the read-outcome matrix asserts identity + kind + projection + exit per branch including the malformed-2xx/transport discriminator pair; resolve is verified local-only with spy ports, per-store identity typing, the distinguishable not-found sentinel, note clamping, and replay; the delivered-evidence divergence is verified for the predicate conjuncts, declared shape, per-pair dedupe, summary counting, resolution decrement, and append-failure observability; status prerequisite and doctor parity are pinned; docs/conformance/boundary/regression pins are enumerated. Three manual verification procedures record the PR evidence the fixture suite cannot produce. |
| 1.1 | 2026-11-10 | `@test-plan-writer` | Resolved the four review questions from the PM decision and folded them into the affected cases. OQ-1: TC-DIVREC-008 now pins the append-failure contract (one attempt append, no `divergenceRef`, bounded `divergence:append-failed` evidence reference, underlying state identity on `data.error`, derived token and exit `2` unchanged), with DM-3, NFR-11, and TR-9 aligned. OQ-2: the guide path is `doc/guides/tracker-credential-provisioning.md` with its content check under `tests/checks/`. OQ-3: TC-READMAP-009, TC-CREDNAME-001, and TC-CREDNAME-005 assert key/reference substrings in the machine summary and the human diagnostic plus canary absence, and no longer pin prose sentences; goldens pin shape and classified fields. OQ-4: TC-STATCRED-001/002 derive the prerequisite section set from the digest and assert absence on observing and non-credential-unavailable sections. OQ-1…OQ-4 marked resolved in §8.3/§8.4; every AC, F, NFR, and DM link is unchanged. |
| 1.2 | 2026-11-10 | `@test-plan-writer` | DoR iteration 1 remediation (verdict NOT_READY) plus the AC-F2-6 alignment; 61 test cases. AC-F2-6 is now read as status-present for a malformed `2xx` (`httpStatus: 200`) and status-absent only for a transport throw, and TC-READMAP-004/007, §6, and §8.2 say so. TC-READMAP-010 drives the **real** GitHub client and normalizer over an injected transport and asserts the received-`2xx` stamp, the absent status on a throw, the `404` mapping, and status preservation, so the suite cannot pass if the Phase 3 stamp is never implemented; it is mapped to `tests/behaviour/providers/github-inputs.test.ts` and `tests/behaviour/providers/github-trap.test.ts` (paths corrected) and to plan Phase 3. TC-CREDNAME-007 proves the narrow trusted-refusal marker is required for `config.credential.missing` to carry its bounded summary and one remediation in machine and human output, while an unmarked config-shaped failure keeps the delivered suppression and a marked non-credential config code stays suppressed; mapped to `tests/behaviour/error-classification.test.ts` and Phase 4. TC-DIVREC-008 now asserts only what `CommandResultError` carries (`error.code` plus category/retryable/consequence/remediationHint/summary) and proves domain kind and projection through the classification path and the exit code instead of reading them off the envelope. TC-DIVREC-011 covers the opposite append direction — a standing orphan divergence that stays listed, counted, locally resolvable, and dedupe-reusable after a failed attempt append — resolved as OQ-5 and traced to F-4.4/F-4.6 (the attempt-append-failure behaviour and the orphan's dedupe reuse). AC-F5-4's halves are now traced separately (redaction/parity half TC-CREDNAME-006, Phase 7; guide-content half TC-DOCS-001, Phase 8), a plan-phase mapping table was added to §7, TR-11…TR-13 were added, the front matter points at the delivered plan, and the summary counts were corrected. |
| 1.3 | 2026-11-10 | `@test-plan-writer` | DoR iteration 2 remediation (verdict NOT_READY), test-plan-local fixes; 61 test cases, 30 acceptance criteria (AC-F1-1…AC-F6-3). The unresolvable-repository-target admission branch is dropped with the specification change and is not traced here: it has no criterion row, no scenario, and no mapping, §3.1's "exactly once" claim holds for the 30 surviving criteria, and no scenario asserts that removed behaviour. The engine result error-kind union is now stated as admitting the existing `provider` **and** `config` kinds additively — in §3.2 "Port contract", the §3.3 NFR-8 row, the §3.1 AC-F2-5 row, and TC-READMAP-008 — because `config.credential.missing` is a config-kind row and a provider-only union would classify it as `fallback.internal`; TC-READMAP-008 now classifies that refusal too and asserts `kind: "config"` with its own row. TC-DIVREC-011's demand is re-pointed from a non-existent fourth-capability item to F-4.4 (append order and the accepted orphan) and F-4.6 (the per-pair dedupe applies equally to the orphan) in §3.1, §5.1, the scenario's Related IDs, its Notes, and the 1.2 row above. MV-1 keeps its artifact, tracker, and CI corroboration requirement; no TC, AC mapping, or plan-phase assignment is added or removed. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| — | — | — | Populated during delivery (phase 6) and quality gates (phase 9) |
