---
id: chg-GH-338-test-plan
status: Updated
created: 2026-11-17T23:45:00Z
last_updated: 2026-11-18T18:00:00Z
owners: ["engineering"]
service: "delivery-os provider adapters (GitHub reference adapter)"
labels: ["adapters", "github", "tracker-integration", "m3-s4"]
version_impact: minor
summary: "Prove the GitHub adapter is the complete, capability-honest reference: nine supported operations with zero gaps, a CLI-first transport with a declared API fallback that never leaks a credential or re-issues a write and produces exactly one composition-selection value returned by the resolver and rendered as exactly one diagnostic line (and no value at all when the composition fact is absent), a squash landing that is at-most-once and only trusts provider-asserted merged truth, verbatim job timings and a bounded non-persisted log excerpt, bounded thread-discussion evidence with no write authority, mapped backlog writes with read/write symmetry only where the map admits the write under a mechanism-scoped label rule (label-swap rows only, refusing a write whose current read resolves to done), a workflow-map validator that runs once at construction and is refused by name on the first operation, a two-variant delivery-request content-write input, a reference-behavior document that agrees with the exported declarations, and offline conformance parity with zero network calls and zero live child processes."
links:
  change_spec: ./chg-GH-338-spec.md
  implementation_plan: ./chg-GH-338-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M3-S4: GitHub adapter completion, code host + backlog

## 1. Scope and Objectives

This change turns the GitHub adapter into the complete reference the other adapters are parity-tested against. The verification risk is therefore not "a command is missing" but **a claim that is true in prose and false in behavior**: a capability declaration that says supported while the operation is inert, a CLI transport that quietly leaks credential material or silently falls back mid-write, a squash landing that lands twice or treats a refusal as success, a log excerpt that outlives a request or escapes into state, a thread body that is treated as lifecycle truth, a workflow map whose read and write directions disagree, a reference-behavior document that drifts from the exported declarations, or a parity suite that stays green because the new steps never executed.

Every case below is a comparison over recorded requests, typed results, structured status, byte lengths, payload bytes, skip kinds, and exit codes — never a prose assertion. Absence is proven three ways per house discipline: a paired positive in the same case, an explicit `null`/`undefined`/empty observation read from the result, and a scan or record-count assertion on the source tree or artifact bytes.

The plan is executable inside the delivered gate battery: the offline mock tier (`throwing fetch` plus the new child-process guard), the provider trap replay harness, the structure/contract inventory suites, the repository invariant checks, and `TMPDIR=$PWD/tmp/tmpdir pnpm check`. Nothing here requires a live `gh` binary, a live token, or network access: the three process-edge cases (`TC-CLI-014`, `TC-CLI-015`, `TC-BIN-057`) drive the production child runner — and, in the check tier, the installed launcher — against an offline stub `gh` placed on an **injected** `PATH`, so the real argv/stdin/environment edge is asserted with zero network and zero live binary, and both composition branches run deterministically on any host. This document is a verification map, not an execution claim: at authoring time none of these cases has been run against the new implementation, and every case is authored failing-first against the phase that owns it.

### 1.1 In Scope

- **Capability posture (F-1)**: GitHub 9 supported / 0 gaps with exact set equality; GitLab `adapter-not-implemented` and Jira `provider-unsupported` for `merge-delivery-request` with every other row unchanged; disjointness, closed gap reasons, and no implied parity.
- **CLI-first transport (F-2)**: the declared transport matrix at 100% coverage; golden argv and child environment (the declared `--hostname` host identity — `api.github.com` -> `github.com` and every other host unchanged — an absolute isolated configuration/state/cache base with `HOME` never forwarded, credential as data, prompt suppression, no shell, no pagination); the FIRST `--include` status block authoritative; `--include` final-status parsing for 2xx/404/non-2xx with an unparsable block refused rather than misclassified; cross-transport normalization parity over one route table; oversized output, timeout, non-zero exit, and malformed output; the three closed probe refusal codes, proven composition-only and never in the mock tier; `prefer-cli` versus `api-only`, where composition selection produces exactly one `GithubTransportSelection` (DM-10) value — `policy`, `selected`, `degradation.code` — as the resolver's return value consumed by the launcher, deep-equalled as data, whose only observable surface is exactly one human diagnostic line, which is persisted nowhere and never added as a readable surface on the composed program object; the absent composition fact as a declared third state (no probe, no DM-10 value, the delivered native-`fetch` transport, and the production launcher always supplying the fact); exactly one process per request; and the no-per-request-failover rule (a write is never re-issued on the fallback transport).
- **Provider-side squash landing (F-3)**: the ninth closed operation and its squash-only argument shape; crafted commit title/message carried verbatim; landing identity present only when the provider supplies it; expected-head guard refusal with zero writes; already-merged success only after a read-back that observes provider-asserted merged truth; classified non-2xx and transport failures; zero retries; and no representable force/bypass/auto-merge/queue/rebase/merge-commit strategy.
- **Failure evidence (F-4)**: `startedAt`/`completedAt` copied verbatim from the provider and absent when absent (never a derived duration or zero); the bounded log excerpt with exact cap boundary, faithful byte prefix, truncation flag, and returned byte length; empty/404/non-2xx/malformed distinguishability; one read with no retry or pagination; non-persistence in state and the conformance artifact; and redaction at the single rendering chokepoint; no caller-tunable cap.
- **Threaded discussion evidence (F-5)**: the closed shape with thread identity, resolution, provider comment count, oldest-first bounded comments, and per-body truncation; 50-comment and 4096-byte caps measured on UTF-8 bytes; the exact truncation rule; not-found versus classified failure versus observed-empty; `DeliveryThread` and all capability/operation/conformance surfaces unchanged; the body-cannot-change-a-closeout-decision control; non-persistence and rendering redaction; one read per thread.
- **Backlog completion (F-6)**: the comment write (carrier-free, empty carrier arrays) and the delivery-request content write as exactly two adapter-local input variants (DM-9) — a create carrying source ref, target ref, title, body, and optional draft (both refs and a non-empty title required, never landing, never setting merge state), and an update carrying the delivery-request identity plus optional title/body (never creating) — with required-input omission a named typed refusal carrying zero provider requests; the four-row precedence-ordered seed driving both read normalization and transition writes; the map validator running exactly once per construction on the resolved map, a failure captured rather than thrown, and the first operation returning the named `provider.payload.invalid` refusal naming the failed check and the offending row with zero provider requests (nothing fails at import); the writable set (`done` plus each declared `label-swap` alias) round-tripping through one injected map **on reads that admit the write**; the mechanism-scoped label rule (only a `label-swap` transition changes labels; its one issue `PATCH` carries the computed target set — declared `label-swap` tokens removed, the row token added, every other label of the supplied current read preserved, never a single-token array — and refuses on an unavailable label signal) alongside the unchanged `field-update` `done` write (one state-only `PATCH`, zero label requests, no label-signal refusal); the terminal-read write refusal (a `label-swap` write to an issue whose current read resolves to `done` refuses with zero provider requests regardless of labels, and a labelless fixture is meaningful only when its native state is `open`); the non-terminal `field-update` alias refusal; the typed undeclared-alias refusal with zero provider writes, which is resolved from the map alone and distinct from the terminal-read refusal; the one-refusal-class/four-outcome read rule (exact-case precedence, case collision with a declared `label-swap` token refused, unknown labels/labelless/unavailable signal never refused, native-state fallback); the documented unmapped set; and no configuration schema, key, or file format.
- **Reference behavior (F-7)**: the normative per-operation table, evidence-read table, probe/composition contract, absence semantics, and mapping seed documented in the adapter contract, with a structure test that fails on any divergence from the exported transport matrix, capability declarations, seed, and fixed caps.
- **Conformance parity (F-8)**: registry operation set equal to the nine-operation closed set in both directions; the new flow step executing against the mock tenant; runtime and structural coverage gates non-vacuous; routes and expected projections for the two newly supported writes and the landing operation; the carrier roundtrip degrading to a `capability-absent` skip; zero live network calls and zero live child processes; deterministic replay; the broken-adapter control still firing; and exact structural-surface updates (provider exports, per-file executable inventory, contract inventory).
- **Regression floor**: the delivered GitHub trap catalog (names frozen; the one declared `GH-ISSUE-TO-WORKITEM` outcome sentence amended for label-aware status), closeout, collection, inputs, credential, and conformance suites stay green; the delivered closeout terminal write stays byte-identical (one state-only `PATCH` with body `{"state":"closed"}`, zero label requests, no new refusal path); the delivered `open → ready` / `closed → done` normalization and the GitLab/Jira posture tests keep passing with only the new merge gap added; the secret-read allowlist count is unchanged with exactly one credential-material entry; no new error-table identity is introduced for adapter-local probe codes or the case-collision refusal; the aggregate gate is green.

### 1.2 Out of Scope & Known Gaps

- [OUT] Rewiring the lifecycle merge transaction to the provider-side landing (NG-1). No case drives `packages/core/src/domain/merge-transaction.ts` through the new operation; `TC-FLOOR-007` asserts the merge transaction imports no provider landing member and the delivered local-git merge suites stay green.
- [OUT] Any configuration-file schema, settings type, catalog branch, or new configuration key (NG-2). `TC-BACKLOG-009` and `TC-FLOOR-007` prove the absence; no case authors a config change.
- [OUT] GitLab and Jira capabilities beyond the new operation's declared gap (NG-3). `TC-POSTURE-002` and `TC-FLOOR-002` pin the exact delta.
- [OUT] Any change to `DeliveryThread`, `DeliveryRequest`, or another normalized contract shape (NG-4). `TC-THREAD-009` and `TC-FLOOR-007` prove the field sets stay fixed.
- [OUT] Full log archives, tail-follow, log pagination, or a caller-tunable excerpt bound (NG-5). `TC-CHECK-009` and `TC-CHECK-012` prove the single read and the non-configurable cap.
- [OUT] Thread pagination beyond the declared per-thread caps (NG-6). `TC-THREAD-001`/`TC-THREAD-011` assert one read and the fixed caps.
- [OUT] Force, branch-protection bypass, auto-merge, merge queues, rebase, or merge-commit strategies (NG-8). `TC-LAND-008` is a compile-time probe, not a runtime branch.
- [OUT] The opencode harness, cloud/vendor naming, and any rewrite of the shared import alias (NG-7). No case touches them.
- [OUT] Live-tier behavior changes (spec §7.2). The live tier stays read-only; `TC-FLOOR-003` asserts `LIVE_READ_OPERATIONS` is unchanged, and no case runs `tests/conformance/live/run-live.ts` or requires a token.
- [OUT] A provider-native duration field (spec §7.3). `TC-CHECK-002` asserts the absence of a derived duration rather than a deferred field.
- [GAP-TP-1 — `TO-CONFIRM` provider surfaces are fixture-decided, not test-decided] Spec Appendix D leaves the CLI version window and environment variable set, the status-recovery parsing, the landing response and already-merged variant, the check-run timestamp field names, the log-text surface, the per-thread entry point and ordering, and the exact case-collision refusal detail string to implementation fixtures. Every case below pins the **shape, cap, classification, and absence rule** — which the spec fixes — and reads the chosen surface through one declared fixture. A delivery that picks a different surface updates the fixture and its expected value; a delivery that changes the shape or cap fails the named case, so `TO-CONFIRM` can never silently weaken an assertion. Label-token casing is **not** in this class: exact-case matching, the case-collision refusal, and the non-collision of a `field-update` token are decided by spec §8.4.1 Table E and asserted as behaviour (`TC-BACKLOG-008`), not chosen by a fixture.
- [GAP-TP-2 — the reference-behavior document path is convention, not contract] The spec names the surface but no path. The plan binds `doc/spec/features/feature-adapter-reference-behavior.md` through one declared locator in `tests/fixtures/provider/reference-behavior.ts`. A different but adequate path fails only the locator assertion (naming the missing path), never the agreement obligation; an absent index row fails `TC-REF-001`.
- [GAP-TP-3 — the preferred transport is proven against an INJECTED `PATH`, never a live binary] No case requires `gh` on the ambient `PATH`, and no case spawns a real `gh` or reaches the network. The version window, argv mapping, and status recovery are pinned as data plus recorded-runner observations, and the process edge is additionally proven offline: `TC-CLI-014`/`TC-CLI-015` place an executable stub `gh` on an injected `PATH` and drive the production `execFile` runner (no injected runner) through one read and one write, and `TC-BIN-057` does the same for the installed launcher's two composition branches (stub present; `PATH` empty of `gh`). A live-binary run against a real endpoint remains a live-tier concern and is explicitly out of scope. A case that cannot resolve its injected runner or its stub **fails naming the missing seam**; it never skips.
- [GAP-TP-4 — the ninth operation's production module naming is delivery-decided] Cases assert behavior through the client member named by DM-1 and through `ADAPTER_OPERATIONS`, not through a file path. `TC-PARITY-009` pins whatever new modules and exports the delivery declares, so a rename is a declared structural update rather than a silent drift.
- [GAP-TP-5 — with GitHub at zero gaps, the gap-encounter gate must be satisfied by GitLab and Jira] `TC-PARITY-001`/`TC-PARITY-008` assert that every declared gap of every shipped adapter is encountered with its exact reason and that the gate fails when no gap is encountered. Testing only GitHub would make the gate vacuous; that vacuity is itself a failing mutation control.
- [GAP-TP-6 — adapter-local refusal identities are named data, not error-table rows] The workflow-map undeclared-alias refusal, the non-terminal `field-update` alias refusal, the unavailable-label-signal refusal, the terminal-read write refusal (a `label-swap` write whose current read resolves to `done`), and the three `provider.cli.*` probe codes are adapter-local (spec §10). Refusal *identity* is the existing `provider.payload.invalid` for all of them; the distinctions live in the detail naming the failed check, the alias, or the offending row. `TC-FLOOR-005` asserts they never enter `ERROR_TABLE` or the closed error-code allowlist; the exact spelling of each adapter-local detail is pinned by the implementation and asserted as a member of the adapter's declared refusal set.
- [GAP-TP-7 — no permanent diff-against-a-moving-base assertion] Every case is a tree invariant, a suite assertion, a golden/fixture comparison, or a recorded gate. Branch-diff shape checks belong to review/CI, per `.ai/rules/testing-strategy.md`.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-338-spec.md`](./chg-GH-338-spec.md) v1.2 | Binding source: F-1..F-8, **40 ACs** (`AC-F1-1..3`, `AC-F2-1..5`, `AC-F3-1..5`, `AC-F4-1..4`, `AC-F5-1..6`, `AC-F6-1..6`, `AC-F7-1..5`, `AC-F8-1..6`), API-1..API-7, DM-1..DM-10, NFR-1..NFR-11, §8.4.1 Tables A–E (normative reference behavior, including the mechanism-scoped label rule, the four read outcomes, and the writable set with the write-resolved-against-the-current-read precondition), RSK-1..RSK-11, NG-1..NG-8, §24.3 non-decisions, Appendix D (fixture-decided details). v1.2 adds: DM-6's seven-rule validator rejection set and its construction-time timing; the terminal-read write refusal (AC-F6-4 owns it, AC-F6-3 and AC-F6-5 cross-reference it); DM-10's carrier as the resolver's return value with exactly one rendered line and no new readable surface; and the optional composition fact. |
| [`chg-GH-338-pm-notes.yaml`](./chg-GH-338-pm-notes.yaml) | Delivery state, the four accepted decision records (DEC-1..DEC-4 = TDR-0031..TDR-0034), the current-state facts, and the delivery conventions (gate command prefix `TMPDIR=$PWD/tmp/tmpdir`, PR target `main-tools`). |
| [`chg-GH-338-plan.yaml`](./chg-GH-338-plan.yaml) | The phase plan: phase ownership, the declared scope paths a phase may stage, obligations, and the split-case notes. This plan never binds a case to a target file its owning phase does not declare; §7.5 records the phase/file bindings the plan must carry (including the split cases this revision introduces). |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Layer model, module-to-test mapping (`packages/**` → `bun test tests/structure tests/behaviour` + boundaries + typecheck; `packages/testkit/src/conformance/**` → `tests/structure/conformance-coverage.test.ts` and `bun test tests/conformance`), invariant-test authoring, aggregate gate. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict types, data-only contracts, injected clock/environment, adapters own I/O, injected fakes over `mock.module`. |
| [`feature-adapter-ports.md`](../../../spec/features/feature-adapter-ports.md) | The closed operation set, `PipelineJob`, `WorkflowMap`, the additive-v1 rule, the runtime-API confinement and secret-read boundary wording the change updates. |
| [`feature-provider-client-seeds.md`](../../../spec/features/feature-provider-client-seeds.md) | The GitHub seed's delivered reads/writes, the trap-catalog minima and QA table, the capability table, and the pre-existing surface claim this change corrects. |
| [`feature-adapter-conformance.md`](../../../spec/features/feature-adapter-conformance.md) | The three flows and thirteen steps, granted skips, structural/runtime coverage gates, mock-tenant routes and projections, and the throwing-`fetch` guard. |
| [`feature-merge-verify-deploy.md`](../../../spec/features/feature-merge-verify-deploy.md) | The delivered local-git landing path that stays unchanged, and the coexistence statement the change adds. |
| [TDR-0031](../../../decisions/), [TDR-0032](../../../decisions/), [TDR-0033](../../../decisions/), [TDR-0034](../../../decisions/) | The four accepted choices: CLI-first transport (TDR-0031), landing + timings + excerpt (TDR-0032), body-free thread evidence (TDR-0033), injected workflow map (TDR-0034). TDR-0034 is the **authority** for the map behaviour this plan asserts — §1 (validator rejection set and construction-time timing), §3.1 (four read outcomes), §3.2 (mechanism-scoped write, including the terminal-read refusal and the unchanged delivered `done` write) — and no case in this plan is the authority for a rule the record does not declare. |
| **Delivered suites consumed as anchors** | `tests/structure/{provider-surface,content-inventory,port-contract-inventory,conformance-coverage,error-table,closeout-contract}.test.ts`; `tests/behaviour/providers/{trap-harness,trap-harness.test,github-trap,github-closeout,github-closeout-thread-authorship,github-closeout-thread-privacy,github-collection,github-inputs,provider-capabilities,provider-credentials}.test.ts`; `tests/behaviour/providers/support.ts`; `tests/conformance/{mock-conformance,artifact,broken-adapter-control}.test.ts`; `tests/conformance/support/fixtures.ts`; `tests/boundaries/{boundaries,fixture-coverage}.test.ts`; `tests/boundaries/fixture-registry.json`; `tests/checks/{fixture-sanitization,fixture-privacy,secret-read-boundary,error-table-sync,doc-conformance,conformance-workflow}.test.ts`. |
| **Delivered fixture sets extended** | `tests/fixtures/providers/traps/github.traps.json`; `tests/fixtures/providers/conformance/github/tenant.json`; `tests/fixtures/providers/sanitization/placeholders.json` (read-only contract); `tests/fixtures/ports/capabilities.ts`; `tests/fixtures/ports/v1-contract-inventory.json`; `tests/structure/inventory.json`. |

## 3. Coverage Overview

Evidence classes: **Suite** (a committed assertion that runs in `pnpm check`), **Suite + mutation** (a suite assertion whose detection power is proven by a named in-place mutation or negative control), **Golden** (a committed fixture compared exactly), **Quality gate** (an execution record, not a permanent assertion), **Review-verified** (a diff/content inspection recorded in §10).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abridged) | TC ID(s) | Evidence class | Status |
|-------|----------------------|----------|----------------|--------|
| AC-F1-1 | GitHub declares all nine closed operations supported with zero gaps; supported ∪ gaps = the closed set exactly. | TC-POSTURE-001 | Suite + mutation | Covered |
| AC-F1-2 | GitLab declares `merge-delivery-request` `adapter-not-implemented`; Jira declares it `provider-unsupported`; every other supported/gap posture is unchanged. | TC-POSTURE-002, TC-FLOOR-002 | Suite | Covered |
| AC-F1-3 | No operation is both supported and gap-declared; no gap reason leaves the closed set; no operation's presence implies support. | TC-POSTURE-003 | Suite + mutation | Covered |
| AC-F2-1 | Every closed operation declares `gh` preferred and `api` fallback, 100% coverage. | TC-CLI-001 | Suite + mutation | Covered |
| AC-F2-2 | Absent/out-of-window/capability-poor CLI yields exactly one closed refusal code; under the default policy the API transport serves, exactly one `GithubTransportSelection` (DM-10) with `policy: "prefer-cli"`, `selected: "api"`, and `degradation.code` equal to that code is produced by composition selection as the resolver's return value consumed by the launcher, exactly one diagnostic line naming the code is rendered as its only observable surface, nothing is persisted, no new readable surface exists on the composed program object, and no request is attempted beforehand; under `api-only` no probe runs and no degradation is present; when the composition fact is absent, the delivered native-`fetch` transport serves with no probe and no DM-10 value. | TC-CLI-010, TC-CLI-011 | Suite | Covered |
| AC-F2-3 | No resolved credential in argv; isolated config directory and prompt suppression present; the declared `--hostname` identity is construction data; the child environment is absolute and isolated in every case; no shell or pagination transform; exactly one fixed argv array per request. | TC-CLI-002, TC-CLI-003, TC-CLI-013, TC-CLI-014, TC-CLI-015, TC-FLOOR-004 | Suite + mutation | Covered |
| AC-F2-4 | The same tenant route table replayed through both transports yields identical normalized views, failure identities, structured status, and page counts (404 absence, non-2xx payload failure with status, transport failure without status); the real process edge returns the same parsed `{status, body}` for a read and a write. | TC-CLI-004, TC-CLI-005, TC-CLI-009, TC-CLI-014 | Suite | Covered |
| AC-F2-5 | A mid-run CLI failure is a classified transport failure with no status; nothing is re-issued on the other transport; a write is never landed twice. | TC-CLI-006, TC-CLI-007, TC-CLI-008, TC-CLI-012 | Suite + mutation | Covered |
| AC-F3-1 | The closed set contains `merge-delivery-request` with squash-only arguments and an optional provider-supplied landing identity in the outcome. | TC-LAND-001 | Suite (type probe) | Covered |
| AC-F3-2 | Crafted commit title and message are transmitted verbatim; a landing identity is returned only when the provider supplies it, absent stays absent. | TC-LAND-002 | Suite | Covered |
| AC-F3-3 | An expected head that no longer matches yields a classified refusal, lands nothing, and never overrides the guard. | TC-LAND-003 | Suite + mutation | Covered |
| AC-F3-4 | An already-merged provider response is success only after a read-back that observes provider-asserted merged truth; otherwise the classified failure stands. | TC-LAND-004, TC-LAND-005 | Suite + mutation | Covered |
| AC-F3-5 | No landing is retried; force/bypass/auto-merge/queue/rebase/merge-commit are not representable; the request title/body remain the content-write operation's business. | TC-LAND-006, TC-LAND-007, TC-LAND-008 | Suite + mutation | Covered |
| AC-F4-1 | Provider start/completion timestamps are copied verbatim into the optional job fields; their absence stays absent and no duration is derived. | TC-CHECK-001, TC-CHECK-002 | Suite + mutation | Covered |
| AC-F4-2 | The excerpt carries job identity, a faithful byte prefix, a truncation flag, and the returned byte length; it never exceeds the fixed cap and has no caller override. | TC-CHECK-003, TC-CHECK-004, TC-CHECK-009, TC-CHECK-012 | Suite + mutation | Covered |
| AC-F4-3 | Empty text is observed empty; 404 is the adapter-local not-found result; other non-2xx and transport failures are classified payload failures; malformed 2xx is a classified failure too. | TC-CHECK-005, TC-CHECK-006, TC-CHECK-007, TC-CHECK-008 | Suite | Covered |
| AC-F4-4 | No excerpt appears in persisted state or the conformance artifact; rendered text passes the redaction chokepoint. | TC-CHECK-010, TC-CHECK-011 | Suite + mutation | Covered |
| AC-F5-1 | The closed discussion shape returns identity, resolution, provider count, a comment list, and a truncation flag with ≤50 oldest-first comments and ≤4096 bytes per body. | TC-THREAD-001, TC-THREAD-002, TC-THREAD-011 | Suite + mutation | Covered |
| AC-F5-2 | The truncation flag is true exactly when returned comments are fewer than the provider count or any body is truncated, and false otherwise. | TC-THREAD-003 | Suite + mutation | Covered |
| AC-F5-3 | 404/absent → not-found; other non-2xx/transport/malformed → classified payload failure; a zero-count empty thread is observed empty. | TC-THREAD-004, TC-THREAD-005, TC-THREAD-006, TC-THREAD-007 | Suite | Covered |
| AC-F5-4 | `DeliveryThread`, the closed operation set, capability declarations, and conformance projections are unchanged. | TC-THREAD-009 | Suite + mutation | Covered |
| AC-F5-5 | A body that contradicts the delivered author-kind facts does not change the closeout resolution outcome; no write path consults the discussion surface. | TC-THREAD-008 | Suite + mutation | Covered |
| AC-F5-6 | No body appears in persisted state or the conformance artifact; rendered bodies pass the redaction chokepoint. | TC-THREAD-010 | Suite + mutation | Covered |
| AC-F6-1 | `write-comment` and `write-delivery-request` are supported; the comment write is carrier-free with empty carrier arrays; the content write accepts exactly two adapter-local input variants (DM-9) — a create carrying source ref, target ref, title, body, and optional draft (both refs and a non-empty title required, never lands, never sets merge state), and an update carrying the delivery-request identity plus optional title/body (never creates) — with required-input omission a named typed refusal carrying zero provider requests, a content-write `404` classified as `provider.payload.invalid` with `httpStatus`, success returning the normalized delivery-request view, and no new operation or core contract type. | TC-BACKLOG-001, TC-BACKLOG-002 | Suite + mutation | Covered |
| AC-F6-2 | With no injected map, the four-row precedence-ordered seed drives both read normalization and transition writes; a read resolves by one refusal class and four declared outcomes — `closed` → `done` regardless of labels, then the first declared-precedence row whose token equals a present label exactly, then a case collision with a declared `label-swap` token is a visible `provider.payload.invalid` normalization failure naming label and token with no new error-table row, otherwise the native-state row; an unrecognized label, an issue with no lifecycle label, and an unavailable label signal never refuse a read, and the only read refusal is the absence of a row for the resolved native state. | TC-BACKLOG-003, TC-BACKLOG-008, TC-BACKLOG-011 | Suite + mutation | Covered |
| AC-F6-3 | The map validator runs exactly once on the resolved map (injected or seed) before the first operation and rejects exactly the declared set — bad `systemName`; missing/empty/non-object `states`; a non-string or duplicate `nativeStatus`; an out-of-set `deliveryState`/`transitionMechanism`; two rows for one alias; no `done` row; a `done` row that is not the `field-update` row on native `closed` — with a failure captured (not thrown) at construction and the first operation returning the existing `provider.payload.invalid` refusal naming the failed check and the offending row, zero provider requests, no throw, no new error-table row; on a valid map, a writable alias written on an issue whose current read admits the write and read back through the same map returns the written alias (a `label-swap` write whose current read resolves to `done` is never attempted and refuses per AC-F6-4). | TC-BACKLOG-004, TC-BACKLOG-010 | Suite + mutation | Covered |
| AC-F6-4 | A `label-swap` transition is one issue `PATCH` carrying the computed target set: every present declared label-swap token is removed, the row token is added, and every other label of the supplied current read is preserved (never a single-token array, never an undeclared removal; a label another actor adds between the caller's read and the write is not preserved, a declared limitation), and an unavailable label signal refuses with zero provider requests; a `label-swap` write to an issue whose **current read** resolves to `done` is a named typed refusal with zero provider requests **regardless of labels** (terminal precedence would hide the write) and a labelless fixture exercises the unavailable-signal refusal only when its native state is `open`; a `field-update` transition to `done` issues exactly one state-only `PATCH` with zero label requests and is unaffected by an unavailable label signal; a transition to a declared non-terminal `field-update` alias is a named typed refusal with zero provider requests. | TC-BACKLOG-004, TC-BACKLOG-005, TC-BACKLOG-006, TC-FLOOR-001 | Suite + mutation | Covered |
| AC-F6-5 | An undeclared alias is a named typed refusal with zero provider writes, resolved from the map alone and distinct from AC-F6-4's terminal-read refusal (the only transition refusal that depends on the issue's current read); the declared-unmapped aliases stay documented limitations. | TC-BACKLOG-007 | Suite + mutation | Covered |
| AC-F6-6 | No settings type, catalog branch, configuration key, or file format is added; mapping and transport choices are construction data only. | TC-BACKLOG-009, TC-FLOOR-007 | Suite | Covered |
| AC-F7-1 | The document states, per closed operation, preferred/fallback transport, failure identities and classification, absence semantics, caps and truncation signals, and the GitHub gap posture. | TC-REF-001 | Suite | Covered |
| AC-F7-2 | Every documented value agrees with the exported transport matrix, capability declarations, mapping seed, and fixed bounds; divergence fails the checks. | TC-REF-002, TC-REF-003 | Suite + mutation | Covered |
| AC-F7-3 | The document states that bodies and excerpts are evidence, never lifecycle truth, carry no write authority, and that other adapters take an explicit same-behavior-or-absent position outside the closed set. | TC-REF-004 | Suite | Covered |
| AC-F7-4 | The document states the closed refusal codes, the composition-only probe (never in the mock tier), the absence of per-request failover, and that a fallback carries one composition-edge selection value (DM-10) whose degradation code is the probe refusal code and renders one diagnostic line. | TC-REF-005 | Suite + mutation | Covered |
| AC-F7-5 | The document states the token vocabulary, precedence order, four seed rows and mechanisms, the deliberately unmapped tokens/aliases, and that the mapping is not yet operator-configurable — agreeing with the seed. | TC-REF-006 | Suite + mutation | Covered |
| AC-F8-1 | The registry operation set equals the nine-operation closed set exactly; the landing step executes against the mock tenant; every supported operation executes; every declared gap is encountered with its exact reason. | TC-PARITY-001, TC-PARITY-008, TC-FLOOR-003 | Suite + mutation | Covered |
| AC-F8-2 | The comment-provenance carrier roundtrip records a `capability-absent` skip, not a `declared-gap` skip. | TC-PARITY-002 | Suite + mutation | Covered |
| AC-F8-3 | The mock tier performs zero live network calls and zero live child processes, enforced by a child-process guard beside the network guard. | TC-PARITY-006, TC-FLOOR-003 | Suite + mutation | Covered |
| AC-F8-4 | Each new behavior (landing, timings, log excerpt, thread discussion, comment write, content write, mapped transition) has an offline fixture replayed through the production client with an expected projection. | TC-PARITY-003, TC-PARITY-004, TC-PARITY-005 | Suite | Covered |
| AC-F8-5 | Replaying the same tenant twice yields identical step order, skip reasons, projections, and diagnostics. | TC-PARITY-007 | Suite + mutation | Covered |
| AC-F8-6 | The provider export list and per-file executable-export inventory are updated exactly and the checks are not vacuous. | TC-PARITY-009, TC-PARITY-010, TC-FLOOR-005, TC-FLOOR-006 | Suite + mutation | Covered |

**All 40 acceptance criteria are mapped; none is unmapped, deferred, or case-less.** Capability coverage is transitive and complete: F-1 → POSTURE 001–003; F-2 → CLI 001–013; F-3 → LAND 001–008; F-4 → CHECK 001–012; F-5 → THREAD 001–011; F-6 → BACKLOG 001–011; F-7 → REF 001–006; F-8 → PARITY 001–010 + FLOOR 005.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no `EVT-` identifiers (§8.2: no event, message, or state-schema record). Interfaces under test are the consumed provider surfaces, the adapter-local closed shapes, the declared data tables, the conformance registry, and the reference-behavior document.

| ID | Element | Observable contract | TC ID(s) |
|---|---|---|---|
| API-1 | Delivery-request landing | One squash request with optional crafted title/message and optional expected head; provider-asserted landing identity only when supplied; guard rejection classified. | TC-LAND-001..008, TC-PARITY-004 |
| API-2 | Check-run read | Run identity, job state, and optional provider timestamps copied verbatim. | TC-CHECK-001, TC-CHECK-002 |
| API-3 | Failure log text | One bounded read, faithful byte prefix, cap 8192 bytes, no pagination/retry. | TC-CHECK-003..012 |
| API-4 | Review-thread discussion | One read per thread: resolution, provider count, ≤50 comments, ≤4096 bytes per body. | TC-THREAD-001..011 |
| API-5 | Issue comment write | One carrier-free comment write; no carrier claimed. | TC-BACKLOG-001, TC-PARITY-003 |
| API-6 | Delivery-request content write | Two declared variants (DM-9): create from a source ref + target ref + title + body + optional draft (both refs and a non-empty title required; never lands, never sets merge state) and update by identity with optional title/body (never creates); missing required input is a named typed refusal with zero provider requests; success returns the normalized delivery-request view. | TC-BACKLOG-002, TC-PARITY-003 |
| API-7 | Issue read/update and transition | Issue state/labels; read resolves by the four declared outcomes (exact-case precedence, label-swap case collision refused, otherwise native state); a `label-swap` transition reads/removes/adds labels only and is resolved against the issue's **current read** (a `done`-resolving issue refuses with zero provider requests), a `field-update` transition writes state only and touches no label, a declared non-terminal `field-update` alias and an undeclared alias refuse. | TC-BACKLOG-003..008, TC-FLOOR-002 |
| DM-1 | Ninth closed operation | `merge-delivery-request` in `ADAPTER_OPERATIONS`, `{ deliveryRequest, strategy: "squash", commitTitle?, commitMessage?, expectedHeadSha? }`, optional landing identity. | TC-LAND-001, TC-PARITY-010, TC-POSTURE-001 |
| DM-2 | `PipelineJob` timings | Optional `startedAt`/`completedAt`, provider-native verbatim, absent means unknown, no derived duration. | TC-CHECK-001, TC-CHECK-002, TC-PARITY-010 |
| DM-3 | Thread discussion shape | `{ threadId, resolved, commentCount, comments[], truncated }` with per-comment facts; caps fixed. | TC-THREAD-001..010 |
| DM-4 | Log excerpt shape | `{ jobId, excerpt, truncated, byteLength }`; truncation flag is the authority. | TC-CHECK-003..012 |
| DM-5 | Transport matrix | Declared data: every closed operation with `gh` preferred and `api` fallback. | TC-CLI-001, TC-REF-002 |
| DM-6 | Workflow map seed, token vocabulary, validation, and transition input | `WorkflowMap` as optional injected construction data; four-row precedence-ordered seed; token = native state or lifecycle label; **validator** run exactly once per construction on the resolved map with the seven-rule rejection set, a failure captured (never thrown) and returned as the named `provider.payload.invalid` refusal on the first operation with zero provider requests; writable aliases = `done` plus each declared `label-swap` alias, admitted only where the current read resolves below `done`; non-terminal `field-update` alias read-only; a `label-swap` write whose current read resolves to `done` refuses. | TC-BACKLOG-003..011, TC-REF-006 |
| DM-7 | Probe and refusal result | `{ ok: true, version }` or `{ ok: false, code }` over exactly three closed codes. | TC-CLI-010, TC-CLI-011, TC-REF-005 |
| DM-8 | `DeliveryThread` unchanged | Field set `{ threadId, resolved, commentCount, authorLogin?, authorKind?, authorAssociation? }`; no body, no reply. | TC-THREAD-009, TC-FLOOR-007 |
| DM-9 | Delivery-request content-write input (adapter-local) | `{ kind: "create"; sourceRef; targetRef; title; body; draft? }` or `{ kind: "update"; deliveryRequest: { systemName, entityId }; title?; body? }`; create requires both refs and a non-empty title and never lands; update requires at least one of title/body and never creates; missing required input is a named refusal with zero provider requests; `draft` absent means absent. | TC-BACKLOG-002, TC-PARITY-003 |
| DM-10 | Composition-edge transport selection (`GithubTransportSelection`) | `{ policy: "prefer-cli" \| "api-only", selected: "gh" \| "api", degradation?: { code } }`; the value composition selection produces — returned by the resolver and consumed by the launcher; `degradation` present exactly when the policy is `prefer-cli` and the CLI was not selected; **not** a field on the client, the composed program object, or any normalized view, and no new readable surface exists; its only observable surface is exactly one rendered diagnostic line on fallback; never persisted, never a state/telemetry/error-table/artifact record. When the composition fact is absent, no value exists and the delivered native-`fetch` transport serves with no probe. | TC-CLI-011, TC-REF-005 |
| §8.4.1 | Reference-behavior contract (normative) | Tables A–E documented and checkable against machine declarations. | TC-REF-001..006 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (abridged) | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | 100% transport declaration coverage over the closed set. | TC-CLI-001, TC-REF-002 | Covered |
| NFR-2 | Zero live network and zero live child processes in the mock tier; the check tier exercises both composition branches on an injected `PATH` with no host `gh`; same fixture replayed twice identical. | TC-PARITY-006, TC-PARITY-007, TC-CLI-013, TC-BIN-057 | Covered |
| NFR-3 | Zero credential material in argv/stdout/stderr/diagnostics/failure detail; absolute isolated config/state/cache directories, `HOME` never forwarded, and prompt suppression on every invocation; secret-read allowlist count unchanged with exactly one credential-material entry. | TC-CLI-002, TC-CLI-003, TC-CLI-014, TC-CLI-015, TC-FLOOR-004 | Covered |
| NFR-4 | Reads: 404 → not-found, other non-2xx → payload failure with structured status. Writes: any non-2xx (404 included) → payload failure with structured status. Transport failure → payload failure without status; page counts preserved; identical across transports. | TC-CLI-004, TC-CLI-005, TC-CLI-009, TC-CLI-014, TC-CHECK-001, TC-CHECK-006, TC-CHECK-007, TC-THREAD-004, TC-THREAD-005, TC-BACKLOG-002 | Covered |
| NFR-5 | At most one landing per invocation; 0 retries; 0 re-issues on a second transport; already-merged success only after read-back. | TC-LAND-003, TC-LAND-004, TC-LAND-006, TC-LAND-007, TC-CLI-012 | Covered |
| NFR-6 | Excerpt ≤8192 bytes; ≤50 comments; ≤4096 bytes/body; 0 evidence bytes persisted; 0 evidence in the artifact; 100% rendered evidence redacted. | TC-CHECK-003, TC-CHECK-010, TC-CHECK-011, TC-THREAD-001, TC-THREAD-002, TC-THREAD-010 | Covered |
| NFR-7 | Registry set equality; 100% supported operations execute; 100% gaps encountered with exact reasons; ≥1 offline fixture per new behavior. | TC-PARITY-001, TC-PARITY-003, TC-PARITY-004, TC-PARITY-005, TC-PARITY-008 | Covered |
| NFR-8 | 0 removed/retyped/newly-required contract fields; 0 state migrations; typecheck/lint/build/aggregate green; pinned export and inventory lists exact and non-vacuous. | TC-PARITY-009, TC-PARITY-010, TC-FLOOR-005, TC-FLOOR-006 | Covered |
| NFR-9 | Exactly one process per CLI request; fixed argv; no shell; no pagination/output transform; bounded timeout and output buffer. | TC-CLI-002, TC-CLI-006, TC-CLI-007, TC-CLI-013, TC-CLI-014 | Covered |
| NFR-10 | Exactly one excerpt read and one thread read per invocation; 0 retries; 0 follow-up pagination. | TC-CHECK-009, TC-THREAD-011 | Covered |
| NFR-11 | 100% of writable aliases (`done` plus each declared `label-swap` alias) written on an issue whose current read resolution admits the write read back through the same map as the same alias; 0 unobservable writes, because a `label-swap` write whose current read resolves to `done` refuses with zero provider requests. | TC-BACKLOG-004, TC-BACKLOG-006, TC-BACKLOG-010 | Covered |

### 3.4 Traceability Closure

- **Acceptance criteria**: 40 declared, 40 mapped, 0 unmapped, 0 deferred.
- **Test cases**: 84 declared (`TC-POSTURE-001..003` = 3, `TC-CLI-001..015` = 15, `TC-LAND-001..008` = 8, `TC-CHECK-001..012` = 12, `TC-THREAD-001..011` = 11, `TC-BACKLOG-001..011` = 11, `TC-REF-001..006` = 6, `TC-PARITY-001..010` = 10, `TC-FLOOR-001..007` = 7, `TC-BIN-057` = 1). The review-iteration-1 remediation (version 1.3) adds `TC-CLI-014` (the real process edge), `TC-CLI-015` (the absolute isolated environment and the untouched working directory) and `TC-BIN-057` (the check tier's two injected-`PATH` composition arms), repins `TC-CLI-002`'s golden argv host and `TC-CLI-003`'s golden child environment, extends `TC-CLI-004`'s multi-block status rule and `TC-BACKLOG-002`'s failure classification, and restates `TC-BACKLOG-005`'s wording without changing its assertions — all listed in §9 version 1.3. Every case names at least one AC; the reverse map is the AC Coverage column of §5.1. The DoR-iteration-1 revision adds no case and removes none; it changes eight oracles in place (plus a wording scoping in `TC-BACKLOG-005`, whose assertions are unchanged), declared here so no reader mistakes them for drift: `TC-POSTURE-001` (set equality, not declaration order), `TC-CLI-011` (DM-10 value, one diagnostic line, zero persisted copies), `TC-BACKLOG-002` (DM-9 variants and required-input refusal), `TC-BACKLOG-004` (writable set plus the non-terminal `field-update` refusal), `TC-BACKLOG-006` (mechanism scope plus the `done` paired half), `TC-BACKLOG-008` (four read outcomes, re-pointed to AC-F6-2), `TC-PARITY-003` (one registry step, update proven by the behaviour suite and a direct client call), and `TC-FLOOR-001` (the one declared trap-outcome amendment and the byte-identical closeout write). The DoR-iteration-2 revision likewise adds no case and removes none; it scopes one route table, re-binds five cases to the phase/file that actually declares them, carries the terminal-read write refusal into two write cases, adds one truth-table row, and restates the DM-10 observable and the absent-fact state — all listed in §9 version 1.2 and in §7.5.
- **Orphans**: 0. Every case is either a positive proof of an AC or a negative/mutation control that proves the same AC cannot pass vacuously; no case exists for a behavior outside the spec.
- **No-skip rule**: no `test.skip`, `test.todo`, conditional `if (!seam) return`, or environment-gated pass is permitted in a delivered suite. A case that cannot resolve its seam must throw naming the missing contract (GAP-TP-1/GAP-TP-3). Reviewers treat any silent skip found in the touched suites as a blocking finding.

## 4. Test Types and Layers

| Layer | Type | Location | Pattern / runner | Applies to |
|---|---|---|---|---|
| Structure / contract | Contract, static AST | `tests/structure/**` | `*.test.ts`, `bun test tests/structure` | Provider export surface, per-file executable inventory, contract inventory, conformance registry pins, error table, reference-behavior↔declaration agreement |
| Provider behaviour | Integration (in-process), replay, and one offline process edge | `tests/behaviour/providers/**` | `*.test.ts`, `bun test tests/behaviour/providers` | Transport selection, argv/env, the production `execFile` runner against an injected-`PATH` stub `gh`, normalization, landing, evidence reads, workflow mapping, trap catalog |
| Offline conformance | Contract/E2E-in-process | `tests/conformance/**` | `*.test.ts`, `bun test tests/conformance` | Mock-tenant routes/projections, coverage gates, skip kinds, guards, determinism, broken control |
| Repository invariants | Static/mutation | `tests/checks/**` | `*.test.ts`, `bun test tests/checks` | Secret-read boundary, fixture sanitization/privacy, error-table sync, doc conformance, conformance workflow contract, the installed launcher's two injected-`PATH` composition arms |
| Boundaries | Static/graph | `tests/boundaries/**` | `*.test.ts`, `bun test tests/boundaries` | depcruise rules, runtime-API confinement, fixture-coverage registry |
| Compile-time probes | Type | `tests/types/**` | `pnpm typecheck` (tsc, `tests/types/tsconfig.json`) | Ninth-operation exhaustiveness, optional `PipelineJob` timings, non-representable merge strategies, `DeliveryThread` shape |
| Quality gate | Execution record | repository root | `pnpm check` | Lint, format, typecheck, test, boundaries, memory, prompt/help/exports parity |
| Manual/review | Content review | change folder + diff | `git diff --check`, inspection | Fixture provenance/sanitization, doc index row, scope containment |

Mocking and isolation: every provider request is replayed through an injected `ProviderTransport` or an injected child runner; the mock tier installs both the throwing-`fetch` guard and the child-process guard; time is an injected constant; credentials are non-secret canaries. No test reads the ambient environment, network, or a real `gh`: the three process-edge cases inject `PATH` themselves (a stub `gh`, or a `PATH` built with `gh` excluded) and use `tmp/tmpdir` scratch roots, so the aggregate gate never depends on the host's `gh`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Layer | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-POSTURE-001 | GitHub declares all nine operations with zero gaps | Contract | Structure + behaviour | High | AC-F1-1, AC-F8-1 |
| TC-POSTURE-002 | GitLab/Jira take the new operation's declared gap only | Contract | Behaviour | High | AC-F1-2 |
| TC-POSTURE-003 | Declarations are disjoint, closed, and never imply parity | Negative | Behaviour | High | AC-F1-3 |
| TC-CLI-001 | Transport matrix covers every closed operation | Contract | Structure + behaviour | High | AC-F2-1, NFR-1 |
| TC-CLI-002 | Golden argv carries no credential and no shell | Contract | Behaviour | Critical | AC-F2-3, NFR-3, NFR-9 |
| TC-CLI-003 | Child environment is isolated and credential-bearing | Contract | Behaviour | Critical | AC-F2-3, NFR-3 |
| TC-CLI-004 | `--include` status parsing classifies 2xx/404/non-2xx | Happy/Edge | Behaviour | High | AC-F2-4, NFR-4 |
| TC-CLI-005 | Both transports produce identical views and failures over the supported route table | Contract | Conformance | Critical | AC-F2-4, NFR-4 |
| TC-CLI-006 | Oversized CLI output is refused, never partially parsed | Negative | Behaviour | High | AC-F2-5, NFR-9 |
| TC-CLI-007 | CLI timeout is a classified transport failure with no status | Negative | Behaviour | High | AC-F2-5, NFR-4 |
| TC-CLI-008 | Non-zero CLI exit is classified; stderr prose never becomes detail | Negative | Behaviour | High | AC-F2-5 |
| TC-CLI-009 | Malformed or unparsable status block is refused | Negative | Behaviour | Critical | AC-F2-4, NFR-4 |
| TC-CLI-010 | Probe returns exactly one closed refusal code, composition-only | Contract | Behaviour | Critical | AC-F2-2, DM-7 |
| TC-CLI-011 | `prefer-cli` selects CLI or degrades with one `GithubTransportSelection`; `api-only` and an absent fact never probe | Happy Path | Behaviour | High | AC-F2-2, DM-10 |
| TC-CLI-012 | No per-request failover: a write is never re-issued | Negative | Behaviour | Critical | AC-F2-5, NFR-5 |
| TC-CLI-013 | Exactly one process per request, and none when the runner is unused | Contract | Behaviour | High | AC-F2-3, NFR-9, NFR-2 |
| TC-CLI-014 | The production runner carries a real request through an offline stub `gh` | Contract | Behaviour (offline process edge) | Critical | AC-F2-1, AC-F2-3, AC-F2-4, NFR-3, NFR-9 |
| TC-CLI-015 | The child environment is absolute and leaves the caller's directory untouched | Contract | Behaviour (offline process edge) | Critical | AC-F2-3, NFR-3 |
| TC-LAND-001 | The ninth operation exists with squash-only arguments | Contract | Structure + types | High | AC-F3-1, DM-1 |
| TC-LAND-002 | Crafted title/message are verbatim; landing identity is presence-honest | Happy Path | Behaviour | Critical | AC-F3-2 |
| TC-LAND-003 | Expected-head mismatch refuses and lands nothing | Negative | Behaviour | Critical | AC-F3-3 |
| TC-LAND-004 | Already-merged is success only after merged-truth read-back | Corner Case | Behaviour | Critical | AC-F3-4, NFR-5 |
| TC-LAND-005 | A refusal alone is never success | Negative | Behaviour | Critical | AC-F3-4 |
| TC-LAND-006 | Non-2xx landing is classified and never retried | Negative | Behaviour | Critical | AC-F3-5, NFR-5 |
| TC-LAND-007 | Transport failure is classified, status-absent, and not retried | Negative | Behaviour | Critical | AC-F3-5, NFR-5 |
| TC-LAND-008 | Force/bypass/queue/rebase are not representable; content write never lands | Contract | Types + behaviour | High | AC-F3-5 |
| TC-CHECK-001 | Timings are copied verbatim when the provider supplies them | Happy Path | Behaviour | High | AC-F4-1, DM-2 |
| TC-CHECK-002 | Absent timings stay absent; no duration is derived | Edge Case | Behaviour | High | AC-F4-1, DM-2 |
| TC-CHECK-003 | Excerpt cap boundary is exact on UTF-8 bytes | Corner Case | Behaviour | Critical | AC-F4-2, NFR-6 |
| TC-CHECK-004 | Excerpt is a faithful prefix with identity and truncation authority | Happy Path | Behaviour | High | AC-F4-2, DM-4 |
| TC-CHECK-005 | Empty log text is observed empty, not not-found | Edge Case | Behaviour | High | AC-F4-3 |
| TC-CHECK-006 | 404 is the adapter-local not-found result | Edge Case | Behaviour | High | AC-F4-3, NFR-4 |
| TC-CHECK-007 | Non-2xx and transport failures are classified payload failures | Negative | Behaviour | High | AC-F4-3, NFR-4 |
| TC-CHECK-008 | Malformed 2xx is a classified payload failure | Negative | Behaviour | High | AC-F4-3 |
| TC-CHECK-009 | One read per excerpt: no retry, no pagination | Contract | Behaviour | High | AC-F4-2, NFR-10 |
| TC-CHECK-010 | No excerpt is persisted or captured in the conformance artifact | Regression | Checks | Critical | AC-F4-4, NFR-6 |
| TC-CHECK-011 | Rendered excerpt passes the redaction chokepoint | Regression | Behaviour | Critical | AC-F4-4, NFR-6 |
| TC-CHECK-012 | The excerpt cap is fixed and not caller-tunable | Negative | Types + behaviour | High | AC-F4-2 |
| TC-THREAD-001 | Discussion shape and the 50-comment oldest-first cap | Happy Path | Behaviour | Critical | AC-F5-1, NFR-6 |
| TC-THREAD-002 | Per-body cap is 4096 UTF-8 bytes with a per-body flag | Corner Case | Behaviour | Critical | AC-F5-1, NFR-6 |
| TC-THREAD-003 | The truncation flag follows the exact declared rule | Edge Case | Behaviour | Critical | AC-F5-2 |
| TC-THREAD-004 | 404/absent thread is not-found, never empty success | Edge Case | Behaviour | High | AC-F5-3, NFR-4 |
| TC-THREAD-005 | Non-2xx and transport failures are classified payload failures | Negative | Behaviour | High | AC-F5-3, NFR-4 |
| TC-THREAD-006 | Malformed 2xx is a classified payload failure | Negative | Behaviour | High | AC-F5-3 |
| TC-THREAD-007 | A zero-count thread with an empty list is observed empty | Edge Case | Behaviour | High | AC-F5-3 |
| TC-THREAD-008 | A body never changes a closeout decision | Negative | Behaviour | Critical | AC-F5-5 |
| TC-THREAD-009 | `DeliveryThread`, operations, capabilities, projections unchanged | Regression | Structure + conformance | High | AC-F5-4 |
| TC-THREAD-010 | No body is persisted or artifacted; rendering redacts | Regression | Checks | Critical | AC-F5-6, NFR-6 |
| TC-THREAD-011 | Exactly one read per thread | Contract | Behaviour | High | AC-F5-1, NFR-10 |
| TC-BACKLOG-001 | Comment write is supported and carrier-free | Happy Path | Behaviour + conformance | High | AC-F6-1, API-5 |
| TC-BACKLOG-002 | Content write creates and updates (DM-9), never lands, refuses missing input | Happy Path | Behaviour + conformance | Critical | AC-F6-1, API-6, DM-9 |
| TC-BACKLOG-003 | The declared four-row seed has load-bearing precedence | Contract | Behaviour | Critical | AC-F6-2, DM-6 |
| TC-BACKLOG-004 | The writable set round-trips where admitted; the terminal-read and non-terminal refusals refuse | Contract | Behaviour | Critical | AC-F6-3, AC-F6-4, NFR-11 |
| TC-BACKLOG-005 | Label swap removes declared label-swap tokens only, preserving unrelated labels | Corner Case | Behaviour | Critical | AC-F6-4 |
| TC-BACKLOG-006 | Label-swap refuses on an unavailable signal or a terminal read; the field-update `done` write does not | Negative | Behaviour | High | AC-F6-4, NFR-11 |
| TC-BACKLOG-007 | Undeclared alias is a named typed refusal with zero writes | Negative | Behaviour | High | AC-F6-5 |
| TC-BACKLOG-008 | Read resolution: exact-case precedence, one case-collision refusal, native fallback | Edge Case | Behaviour | High | AC-F6-2 |
| TC-BACKLOG-009 | No configuration surface is added | Contract | Structure + checks | High | AC-F6-6 |
| TC-BACKLOG-010 | Injected map overrides the seed; an invalid map is captured once and refused by name | Contract | Behaviour | High | AC-F6-3 |
| TC-BACKLOG-011 | The seed preserves delivered `open → ready` / `closed → done` | Regression | Behaviour | Critical | AC-F6-2 |
| TC-REF-001 | The reference-behavior surface documents every operation and evidence read | Content | Structure | High | AC-F7-1 |
| TC-REF-002 | Documented transports, caps, and gaps agree with machine declarations | Contract | Structure | Critical | AC-F7-2 |
| TC-REF-003 | Documented absence semantics agree with the code | Contract | Structure | High | AC-F7-2 |
| TC-REF-004 | Evidence and other-adapter positions are stated | Content | Structure | High | AC-F7-3 |
| TC-REF-005 | Probe, refusals, and no-failover are documented and agree | Contract | Structure | High | AC-F7-4 |
| TC-REF-006 | Mapping documentation agrees with the seed and the resolution rules | Contract | Structure | High | AC-F7-5 |
| TC-PARITY-001 | Registry equals the nine-operation closed set; steps execute; gaps encountered | Contract | Structure + conformance | Critical | AC-F8-1, NFR-7 |
| TC-PARITY-002 | Carrier roundtrip is a `capability-absent` skip | Happy Path | Conformance | High | AC-F8-2 |
| TC-PARITY-003 | One `write-delivery-request` step; both content-write variants have routes and projections | Contract | Conformance | Critical | AC-F8-4 |
| TC-PARITY-004 | The landing operation has a route and an expected projection | Contract | Conformance | Critical | AC-F8-4 |
| TC-PARITY-005 | Every new behavior has a trap entry, a resolving fixture, and a projection | Contract | Behaviour + conformance + checks | High | AC-F8-4, NFR-7 |
| TC-PARITY-006 | Zero network and zero child processes, with a firing guard | Negative | Conformance | Critical | AC-F8-3, NFR-2 |
| TC-PARITY-007 | Replay is deterministic across two runs | Contract | Conformance | High | AC-F8-5, NFR-2 |
| TC-PARITY-008 | The broken-adapter control still fires; gates are non-vacuous | Negative | Conformance | Critical | AC-F8-1, NFR-7 |
| TC-PARITY-009 | Pinned structural surfaces update exactly | Contract | Structure | High | AC-F8-6, NFR-8 |
| TC-PARITY-010 | Additive contract probes compile and exhaustiveness fails loudly | Contract | Types | High | AC-F8-6, DM-1, DM-2 |
| TC-FLOOR-001 | Delivered GitHub trap/closeout/collection/inputs/credential suites stay green | Regression | Behaviour | Critical | AC-F8-1, AC-F1-3, AC-F6-4 |
| TC-FLOOR-002 | GitLab/Jira posture changes only by the new merge gap | Regression | Behaviour | High | AC-F1-2 |
| TC-FLOOR-003 | Three-provider conformance and the live read-only set unchanged | Regression | Conformance | Critical | AC-F8-1, AC-F8-3 |
| TC-FLOOR-004 | Secret-read and runtime-confinement boundaries stay exact | Regression | Boundaries + checks | Critical | NFR-3, AC-F2-3 |
| TC-FLOOR-005 | No new error identity or contract export for adapter-local codes | Regression | Structure | High | AC-F8-6, NFR-8 |
| TC-FLOOR-006 | The aggregate gate is green | Quality gate | Repository | High | AC-F8-6, NFR-8 |
| TC-FLOOR-007 | Scope boundaries hold: no merge rewiring, config, or contract reshape | Regression | Structure + types | High | AC-F6-6, AC-F5-4, NFR-8 |
| TC-BIN-057 | The installed launcher exercises both composition branches on an injected `PATH` | Contract | Repository invariants (launcher) | High | AC-F2-1, AC-F2-2, NFR-2 |

### 5.2 Scenario Details

#### TC-POSTURE-001 - GitHub declares all nine operations with zero gaps

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-1, AC-F8-1, DM-1, NFR-7
**Target Layer / Location**: `tests/behaviour/providers/provider-capabilities.test.ts` (extend `TC-CAP-001`); `tests/fixtures/ports/capabilities.ts` (`EXPECTED_SEED_POSTURES.github`) · **Tags**: @provider @capability @contract
**Fixtures**: extended `EXPECTED_SEED_POSTURES` with nine supported operations and an empty `gapReasons`; `ADAPTER_OPERATIONS`.
**Given** the delivered `GITHUB_ADAPTER_CONTRACT`, **When** the closed operation set is enumerated, **Then** `supportedOperations` has nine unique members whose **set** equals `ADAPTER_OPERATIONS` (both directions, no extras, no omissions), `gapOperations` is empty, and `supportedOperations ∪ gapOperations` equals the closed set exactly.
**Pass criterion**: set equality both directions — `supported \ gaps == closed set`, `gaps \ supported == ∅`, and the two lists are disjoint — not a length check. Declaration order is **not** part of the contract (the spec binds presence, not order): the delivered declaration keeps its order and appends the ninth operation, and no case asserts an ordering. A mutation that removes one supported operation fails naming the missing operation; a second mutation that re-adds a `write-comment` gap fails because the operation is both supported and gap-declared; a third mutation that adds an unknown operation to the declaration fails naming it as an extra.

#### TC-POSTURE-002 - GitLab/Jira take the new operation's declared gap only

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-2, DM-1
**Target Layer / Location**: `tests/behaviour/providers/provider-capabilities.test.ts`; `tests/fixtures/ports/capabilities.ts` · **Tags**: @provider @capability
**Fixtures**: extended `EXPECTED_SEED_POSTURES.jira` and `.gitlab`.
**Given** the two other shipped declarations, **When** the ninth operation is introduced, **Then** GitLab lists `merge-delivery-request` with reason `adapter-not-implemented` and Jira with `provider-unsupported`, and every other supported/gap row is byte-identical to the delivered posture.
**Pass criterion**: the diff against the delivered expected postures contains exactly the two added gap rows and nothing else; a mutation that changes another reason fails naming the operation.

#### TC-POSTURE-003 - Declarations are disjoint, closed, and never imply parity

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-3, NFR-7
**Target Layer / Location**: `tests/behaviour/providers/provider-capabilities.test.ts`; `tests/fixtures/ports/capabilities.ts` · **Tags**: @provider @capability @mutation
**Fixtures**: `fullAdapter`, `gappedAdapter`, and the undeclared-operation fixture in `tests/fixtures/ports/capabilities.ts`.
**Given** any shipped declaration, **When** inspected, **Then** no operation appears in both lists, every reason is one of `provider-unsupported | adapter-not-implemented | plan-restriction`, and an operation absent from `supportedOperations` resolves to unsupported even without a gap record.
**Pass criterion**: `resolveOperation`-style resolution returns `unsupported` for an unlisted operation; mutations for overlap, an out-of-set reason, and an unlisted-but-treated-as-supported operation each fail with the offending operation named — the delivered `provider-capabilities` negative controls stay in place and are not weakened.

#### TC-CLI-001 - Transport matrix covers every closed operation

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-1, DM-5, NFR-1
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` (new; declared by phase 2); `tests/structure/reference-behavior.test.ts` — the matrix↔document cross-check half is authored in **phase 6**, which declares that file; phase 2 reads it as a control (declared split, §7.5) · **Tags**: @provider @transport @contract
**Fixtures**: `tests/fixtures/providers/github/cli-argv.json` (matrix section) and the exported matrix constant.
**Given** the declared transport matrix, **When** compared with `ADAPTER_OPERATIONS`, **Then** every operation declares `preferred: "gh"` and `fallback: "api"`, there are no extra keys, and coverage is 9/9.
**Pass criterion**: set equality both directions plus per-row value assertion; a mutation deleting one row or flipping one fallback fails naming the operation.

#### TC-CLI-002 - Golden argv carries no credential and no shell

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-3, NFR-3, NFR-9, DM-7
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` · **Tags**: @provider @cli @secret @contract
**Fixtures**: `tests/fixtures/providers/github/cli-argv.json` (one golden `argv` array per route: read, list, landing, transition, plus **transport-level** rows for the two operations GitHub still declares as gaps in this phase — comment write and content write — and a `hostMapping` block). Each route declares its expected `--hostname` identity, and the `hostMapping` rows are the declared instance-host → CLI-host pairs the transport is constructed from. Those two gap-operation rows are `ProviderRequest` → argv mappings asserted against the transport directly; they require no client member and assert no normalized view, because `writeComment`/`writeDeliveryRequest` must not exist until phase 3 closes those gaps. Their client-level parity half joins `TC-CLI-005`'s route table in phase 3.
**Given** a resolved canary credential, **When** each CLI invocation is recorded through the injected runner, **Then** the emitted argv is exactly the golden array, contains no credential value or credential-shaped substring, passes no shell (`shell: false`), uses no pagination flag or output transform, and carries exactly one argv array per request.
**Pass criterion**: deep equality with the golden argv, zero canary occurrences in argv, `shell` false/absent, and exactly one `spawn` record; the two gap-operation rows assert argv only (no client member, no projection) and a case that requires a `writeComment`/`writeDeliveryRequest` member here fails as out of phase; a mutation that adds `--paginate`, wraps in `sh -c`, or interpolates the token fails the named assertion. **The host identity is pinned by data**: every `hostMapping` row deep-equals `githubCliHostname(instanceHost)`, the row set is asserted before any comparison (so a deleted or vacuous block fails), the cloud row's recorded argv contains `github.com`, and no recorded argv contains `api.github.com` — the assertion the blocker would have failed.

#### TC-CLI-003 - Child environment is isolated and credential-bearing

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-3, NFR-3
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` · **Tags**: @provider @cli @secret
**Fixtures**: `cli-argv.json` environment section (`base`, `configDirectory`, `stateDirectory`, `cacheDirectory`); `createCanaryCredentialPort` from `tests/conformance/support/fixtures.ts`; an injected `TMPDIR` temp base.
**Given** a credential port returning a canary, **When** the child environment is constructed, **Then** `GH_TOKEN` equals the canary, `GH_CONFIG_DIR` and `XDG_CONFIG_HOME` share `<base>/jaiship-gh-config`, `XDG_STATE_HOME` and `XDG_CACHE_HOME` are `<base>/jaiship-gh-state` and `<base>/jaiship-gh-cache`, `HOME` is absent, prompt suppression is set, and no ambient credential is read (the credential port is the only material source).
**Pass criterion**: the exact environment key set is deep-equalled (never a subset, so an unforwarded or newly added variable fails), every path-valued variable is absolute, the config directory is never an operator home path, canary absent from argv/stdout/stderr/diagnostics/failure detail, and a scan proves the CLI module does not perform an ambient environment read outside the injected seam; `TMPDIR=$PWD/tmp/tmpdir bun run scripts/checks/secret-read-boundary.ts` remains green with the same allowlist count.

#### TC-CLI-004 - `--include` status parsing classifies 2xx/404/non-2xx

**Scenario Type**: Happy Path / Edge Case · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-4, NFR-4
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` · **Tags**: @provider @cli @classification
**Fixtures**: `tests/fixtures/providers/github/cli-status-blocks.json` (200, 201, 204, 404, 401, 403, 500, 503; a proxy preamble followed by the real response; two body-bearing blocks; a body containing a line shaped like a status line; an empty body).
**Given** a recorded CLI stdout with an `--include` status block, **When** the transport parses it, **Then** 2xx yields the body, 404 yields `provider.not-found`, any other non-2xx yields `provider.payload.invalid` with the structured status, and the FIRST status block is authoritative: a block whose body region begins with another status line is an intermediate response (a proxy preamble or a bodyless redirect hop) and the scan continues, while a status line inside a body region can never override the real status.
**Pass criterion**: status and identity per case exactly as declared, `httpStatus` present for non-2xx and absent for success; a body bearing a status-shaped line is refused as `not JSON` instead of being reclassified under the injected code, and two body-bearing blocks are refused for the same reason — both assertions fail under a last-status-line parser, which is the mutation control.

#### TC-CLI-005 - Both transports produce identical views and failures over the supported route table

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-4, NFR-4
**Target Layer / Location**: `tests/conformance/github-transport-parity.test.ts` (new; declared by phase 2); shared route table `tests/fixtures/providers/github/transport-parity-routes.json` (declared by phase 2) · **Tags**: @provider @transport @parity
**Fixtures**: `transport-parity-routes.json`, phase-2 route table = exactly the seven operations whose **client members exist after phase 1**: `read-work-item`, `write-work-item`, `transition-work-item`, `read-delivery-request`, `read-pipeline-run` (list page included), `resolve-delivery-thread`, and the phase-1 landing member `merge-delivery-request`; each with an expected normalized view or an expected failure identity. **Not in the phase-2 table**: `write-comment` and `write-delivery-request`, which GitHub still declares as gaps in phase 2 — a gapped operation's write member must not exist (`provider-capabilities` suite), so a client-level parity route for either cannot pass in this phase.
**Given** the phase-2 route table, **When** every route is replayed once through the API transport and once through the CLI transport (stdout status block + body), **Then** the normalized results are deep-equal — identity, fields, `pageItemCount`, failure identity, and `httpStatus` presence — for 2xx, 404, other non-2xx, and transport failure.
**Pass criterion**: per-route deep equality and identical failure classification; a mutation that drops `pageItemCount` on one transport or maps 404 to payload failure fails naming the route. Non-vacuity: the table's operation set equals the seven operations the GitHub declaration reports as supported at this phase boundary (the capability suite's 7-supported/2-gap posture), so a route silently dropped is a failure, not a pass.
**Phase-3 extension (declared split, same case id, same AC)**: when phase 3 closes the two write gaps and creates `writeComment`/`writeDeliveryRequest`, the **same** route table is extended with the comment-write and content-write routes (create and update variants) inside `tests/conformance/github-transport-parity.test.ts`, and this case's assertion runs over the extended table there. Ownership of `TC-CLI-005` stays with phase 2 (its AC-F2-4 verdict is complete over the phase-2 table); the phase-3 rows are additional coverage the same case carries, and the plan's split-case notes must record that binding (§7.5). The phase-2 case does not assert cross-transport parity for either write route, and no statement in this plan claims the phase-2 route table is free of a later extension.

#### TC-CLI-006 - Oversized CLI output is refused, never partially parsed

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-5, NFR-9
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` · **Tags**: @provider @cli @bounds
**Fixtures**: `tests/fixtures/providers/github/cli-failures.json` (`output-over-cap` case, a body one byte over the declared output buffer).
**Given** a CLI invocation whose stdout exceeds the declared output buffer, **When** the request completes, **Then** the result is a classified transport/payload failure with no status and no partially parsed value.
**Pass criterion**: the result is `ok: false` with no normalized payload; the recorded runner shows exactly one spawn and no retry; a mutation that truncates and parses the prefix fails.

#### TC-CLI-007 - CLI timeout is a classified transport failure with no status

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-5, NFR-4
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` · **Tags**: @provider @cli @timeout
**Fixtures**: `cli-failures.json` (`timeout` case bounded by the delivered operation default).
**Given** a runner that never resolves within the declared timeout, **When** the request is issued, **Then** the result is `provider.payload.invalid` without `httpStatus`, exactly one spawn occurred, and no second transport received the request.
**Pass criterion**: failure identity and status absence asserted; timeout is bounded (the test uses the injected short override, never a real long wait).

#### TC-CLI-008 - Non-zero CLI exit is classified; stderr prose never becomes detail

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-5, NFR-3
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` · **Tags**: @provider @cli @secret
**Fixtures**: `cli-failures.json` (`exit-non-zero` case whose stderr contains a canary token-shaped string).
**Given** a runner that exits non-zero with stderr text, **When** the request completes, **Then** the failure is classified with no status, the stderr prose is not copied into the failure detail or diagnostics, and the canary appears nowhere in the result.
**Pass criterion**: `ok: false`, no `httpStatus`, zero canary occurrences in `JSON.stringify(result)`; a mutation that forwards stderr fails.

#### TC-CLI-009 - Malformed or unparsable status block is refused

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-4, NFR-4, RSK-2
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` · **Tags**: @provider @cli @classification
**Fixtures**: `cli-status-blocks.json` (`unparsable-status`, `status-without-code`, `body-without-status`, `two-conflicting-final-blocks`).
**Given** stdout that cannot yield one authoritative status, **When** parsed, **Then** the transport refuses with a classified failure instead of reporting a default or guessed status.
**Pass criterion**: each case is `ok: false` and never `ok: true` with an assumed 200; the failure names the unparsable block in a bounded diagnostic, and a mutation that defaults to 200 fails.

#### TC-CLI-010 - Probe returns exactly one closed refusal code, composition-only

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-2, DM-7, NFR-9
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` (probe section) · **Tags**: @provider @cli @probe
**Fixtures**: `cli-failures.json` probe cases: binary absent (spawn `ENOENT`), version below the window, version above the window, missing required capability (no `--include`/status support).
**Given** each unusable-CLI case, **When** composition runs the probe once, **Then** the result is exactly one of `provider.cli.unavailable`, `provider.cli.version-unsupported`, `provider.cli.capability-unsupported`, the code set is closed, no provider request was attempted, and the probe is invoked once (not at module load, not per request, never in the mock tier).
**Pass criterion**: one refusal code per case, exactly one probe spawn recorded at the composition edge, zero requests; a mutation producing two codes or a fourth code fails naming it; importing the module without composition records zero spawns; the offline conformance replay and every mock-tier suite record **zero** probe spawns, so no case in this change proves the probe through the mock tier.

#### TC-CLI-011 - `prefer-cli` selects CLI or degrades with one `GithubTransportSelection`; `api-only` and an absent fact never probe

**Scenario Type**: Happy Path · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-2, DM-7, DM-10
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` (declared by phase 2); the composition seam it exercises — `resolveGithubTransportSelection` in `packages/cli/src/production.ts` and the launcher `packages/cli/src/bin-launcher.ts` — is declared by phase 2; the delivered `tests/structure/entrypoint-bin.test.ts` single-`createProductionComposer(`-call-site pin is read as a control and is **not** edited · **Tags**: @provider @cli @composition
**Fixtures**: probe success and refusal cases from `cli-failures.json`; a recorded API transport; the composition notice/warnings recorder.
**Given** policy `prefer-cli` with a usable CLI, **When** composition selects, **Then** the CLI transport is used, the API transport records zero requests, and no diagnostic line is rendered. **Given** a probe refusal under `prefer-cli`, **Then** the API transport serves and composition selection produces exactly one `GithubTransportSelection` value `{ policy: "prefer-cli", selected: "api", degradation: { code } }` as the resolver's return value, whose `degradation.code` equals the probe refusal code, and that value's only observable surface is exactly one human diagnostic line naming the code, rendered through the existing composition-notice channel. **Given** `api-only`, **Then** the probe never runs (zero spawns), the API transport serves, and the value carries `policy: "api-only"`, `selected: "api"` with `degradation` **absent** (proved with `Object.hasOwn`). **Given the composition fact is absent** (a composition built without a selection, as delivered composition tests and any embedder do), **Then** no probe runs (zero spawns), no `GithubTransportSelection` value exists at all, and the delivered native-`fetch` transport serves; the production launcher is the only production caller and always supplies the fact, which the delivered single-call-site pin plus this case's absent-fact construction together prove.
**Pass criterion**: the resolver's return value is deep-equal to the expected DM-10 value per case, with `degradation` presence decided by `Object.hasOwn`; the rendered diagnostics contain exactly one line naming the refusal code (count 1, not `>= 1`) and zero lines when the CLI was selected, under `api-only`, and when the fact is absent; **zero persisted copies** — the value and its code appear in no state file, event/capsule record, serialized conformance artifact, and no new schema key exists; **no new readable surface** — the composed program object's key set equals the delivered key set (asserted by key-set equality, with a planted extra key failing) and no client, `GithubClientOptions` member, normalized view, or artifact field carries `policy`/`selected`/`degradation`; probe spawn count 0 under `api-only` and under the absent fact, 1 under `prefer-cli`; the absent-fact case asserts `{probeSpawns: 0, lines: 0, value: none}`. Mutations that probe under `api-only`, that default an absent fact to `prefer-cli`, that emit two diagnostic lines, that persist the value, that attach it to the composed program object, or that omit `degradation.code` on a fallback each fail the named assertion.

#### TC-CLI-012 - No per-request failover: a write is never re-issued

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-5, NFR-5, RSK-4
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` · **Tags**: @provider @cli @write-safety
**Fixtures**: `cli-failures.json` (`mid-run-failure-after-request`); a write route whose member exists in this phase — the phase-1 landing member `merge-delivery-request` or the delivered `write-work-item` — replayed through the CLI transport. No comment or content-write route is used: both operations are still declared gaps here and their client members must not exist until phase 3.
**Given** a CLI write that fails after the request was issued, **When** the failure surfaces, **Then** it is a classified transport failure with no status, the API transport records zero requests, the CLI runner records exactly one spawn, and the write is not landed twice.
**Pass criterion**: request counts `{cli: 1, api: 0}`, result `ok: false`, no second invocation of the writer; a mutation that retries on the fallback fails naming the re-issued request. The same assertions hold for a read, proving the rule is transport-level, not write-only.

#### TC-CLI-013 - Exactly one process per request, and none when the runner is unused

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-3, NFR-9, NFR-2
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` · **Tags**: @provider @cli @process
**Fixtures**: recorded runner; `cli-argv.json`.
**Given** a sequence of three CLI requests, **When** each completes, **Then** exactly three spawn records exist, one per request, each with one argv array; **Given** an API-transport client, **Then** zero spawn records exist for the entire case.
**Pass criterion**: spawn counts equal request counts exactly (not `>=`); a mutation issuing two spawns per request (probe plus request) under composed CLI fails the count.

#### TC-CLI-014 - The production runner carries a real request through an offline stub `gh`

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-1, AC-F2-3, AC-F2-4, NFR-3, NFR-9, DM-7
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` (behaviour tier, where the child-process guard is not installed) · **Tags**: @provider @cli @process @offline
**Fixtures**: `tests/fixtures/providers/github/cli-process-edge.json` (the stub's script body, its canned `--include` blocks for a read and a write, the declared instance-host → CLI-host pair, the scratch layout names, and per-case expected argv, stdin body, and parsed `{status, body}`).
**Given** an executable stub `gh` written into a `tmp/tmpdir` scratch directory and placed on an INJECTED `PATH`, **When** the transport is constructed WITHOUT a runner (so the production `execFile` default is the code under test) and one read and one write are sent, **Then** the binary receives exactly the declared argv (including `--hostname github.com` and never `api.github.com`), exactly one process runs per request, the credential is absent from every argv and present in the child environment, the write body arrives on stdin, and the parsed `{status, body}` equals the canned block for each case.
**Pass criterion**: recorded argv deep-equals the fixture per case; spawn count equals request count (2 total, 1 per request); the credential canary appears in the child environment record and in no argv; the recorded stdin equals the declared body; the parsed status/body deep-equal the fixture; the stub is the only `gh` on the injected `PATH`, so the case never reaches a live binary, the network, or the host's configuration. The adapter's `node:child_process` site count is unchanged (the runner is the delivered site), so `tests/structure/harness-imports.test.ts` is untouched.

#### TC-CLI-015 - The child environment is absolute and leaves the caller's directory untouched

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-3, NFR-3
**Target Layer / Location**: `tests/behaviour/providers/github-cli-transport.test.ts` · **Tags**: @provider @cli @environment @isolation
**Fixtures**: `cli-process-edge.json` (stub script, responses, scratch layout); the recorded-runner arm uses the injected environment objects directly.
**Given** an injected environment with an absolute `TMPDIR` and, separately, one with no `TMPDIR` at all, **When** the child environment is constructed, **Then** every path-valued variable (`GH_CONFIG_DIR`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, `XDG_CACHE_HOME`) is absolute and nested under the isolated base (the injected value when absolute, the operating system's temporary directory otherwise), and `HOME` is absent. **Given** an EMPTY scratch working directory and the real production runner with the stub `gh`, **When** one request completes, **Then** the working directory is still empty and the stub's device id landed under `XDG_STATE_HOME`.
**Pass criterion**: `path.isAbsolute` holds for every constructed path in both arms and `HOME` is not a key; the scratch directory listing is exactly `[]` after the invocation; the recorded state root is `<base>/jaiship-gh-state`. Non-vacuity: the same stub invoked with no `XDG_STATE_HOME` **does** create `.local/state/gh/device-id` in the scratch directory, proving the cleanliness assertion measures the constructed environment rather than the stub being inert.

#### TC-BIN-057 - The installed launcher exercises both composition branches on an injected `PATH`

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-1, AC-F2-2, NFR-2
**Target Layer / Location**: `tests/checks/install-launcher-installer.test.ts` (extend the existing shim factory) · **Tags**: @launcher @composition @offline
**Fixtures**: the suite's installee scratch home/project, its recording `PATH` shim (now carrying a `gh` stub beside the delivered `curl`/`wget`/`git` stubs), and a generated `PATH` directory holding every host tool except `gh`.
**Given** the installed launcher on a `PATH` whose `gh` is the recording stub, **When** a composing invocation runs, **Then** exactly one `gh --version` is recorded, no degradation line is rendered, and the command succeeds; a self-description invocation records no additional probe. **Given** a `PATH` with no `gh` at all, **When** the same composing invocation runs, **Then** zero `gh` spawns occur, exactly one line naming `provider.cli.unavailable` is rendered, and the command still succeeds; a composing invocation that exits non-zero keeps exactly that one line.
**Pass criterion**: `gh` call count per arm asserted exactly (1 per composing invocation, 0 in the absent arm); no ambient `PATH` reaches the launcher on either arm; the absent arm's `PATH` is asserted empty of `gh` before the run; no launcher, composition, or policy source changes — the determinism comes from the injected `PATH` alone, so no configuration surface is invented (NG-2/AC-F6-6).

#### TC-LAND-001 - The ninth operation exists with squash-only arguments

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-1, DM-1
**Target Layer / Location**: `tests/types/merge-delivery-request.type-test.ts` (new); `tests/structure/port-contract-inventory.test.ts` (extend); `tests/behaviour/providers/github-landing.test.ts` (new) · **Tags**: @provider @landing @contract
**Fixtures**: type probe over `ADAPTER_OPERATIONS` and the canonical argument/outcome types.
**Given** the closed operation set, **When** inspected, **Then** `merge-delivery-request` is a member, the argument type requires `deliveryRequest` and `strategy: "squash"`, allows optional `commitTitle`/`commitMessage`/`expectedHeadSha`, and the outcome carries an optional provider-supplied landing identity.
**Pass criterion**: `pnpm typecheck` passes the positive probe and fails (at authoring time, red) any implementation missing the operation; a negative probe asserts `strategy: "merge"` and a `force` property are rejected.

#### TC-LAND-002 - Crafted title/message are verbatim; landing identity is presence-honest

**Scenario Type**: Happy Path · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-2, API-1
**Target Layer / Location**: `tests/behaviour/providers/github-landing.test.ts` · **Tags**: @provider @landing
**Fixtures**: `tests/fixtures/providers/github/landing-responses.json` (`landed-with-sha`, `landed-without-sha`).
**Given** a landing request with crafted commit title and message, **When** replayed against the two success fixtures, **Then** the recorded request body carries both strings byte-identically, the outcome returns the provider `mergeCommitSha` when present, and the field is absent (not `null`-filled, not derived from a branch head) when the provider omits it.
**Pass criterion**: exact body equality; identity presence/absence per fixture; a mutation that rewrites the message or fabricates a SHA fails.

#### TC-LAND-003 - Expected-head mismatch refuses and lands nothing

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-3, API-1, NFR-5
**Target Layer / Location**: `tests/behaviour/providers/github-landing.test.ts` · **Tags**: @provider @landing @guard
**Fixtures**: `landing-responses.json` (`head-mismatch-409`).
**Given** an expected head that no longer matches, **When** the landing is attempted, **Then** the result is a classified refusal, exactly one landing request was sent, no retry occurred, no merge is reported, and the guard is never overridden or dropped.
**Pass criterion**: `ok: false` with the classified refusal identity, request count 1, zero follow-up writes; a mutation that omits `sha` from the request body fails.

#### TC-LAND-004 - Already-merged is success only after merged-truth read-back

**Scenario Type**: Corner Case · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-4, NFR-5
**Target Layer / Location**: `tests/behaviour/providers/github-landing.test.ts` · **Tags**: @provider @landing @read-back
**Fixtures**: `landing-responses.json` (`already-merged-then-merged-true`, `already-merged-then-merged-false`).
**Given** an already-merged provider response, **When** the adapter reads the delivery request back, **Then** it returns success only if the read-back observes provider-asserted merged truth; when the read-back reports merged false (or fails), the original classified failure stands.
**Pass criterion**: success/failure per fixture; exactly one read-back request and zero retries; a mutation that treats the refusal as success without read-back fails.

#### TC-LAND-005 - A refusal alone is never success

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-4
**Target Layer / Location**: `tests/behaviour/providers/github-landing.test.ts` · **Tags**: @provider @landing
**Fixtures**: `landing-responses.json` (`refusal-without-merged-truth`); a recorded read-back that reports an unmerged request.
**Given** a provider refusal that mentions "already merged" in prose but whose read-back does not assert merged truth, **When** handled, **Then** the result is `ok: false` with the classified refusal and no landing identity.
**Pass criterion**: `ok: false`, identity absent; the failure detail excludes provider prose; a mutation that infers merged truth from prose fails.

#### TC-LAND-006 - Non-2xx landing is classified and never retried

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-5, NFR-5
**Target Layer / Location**: `tests/behaviour/providers/github-landing.test.ts` · **Tags**: @provider @landing @classification
**Fixtures**: `landing-responses.json` (`422-unprocessable`, `500-server-error`, `403-forbidden`).
**Given** a non-2xx, non-guard landing response, **When** it completes, **Then** the result is `provider.payload.invalid` with the structured status, exactly one landing request was sent, and no read-back or retry follows.
**Pass criterion**: identity/status per case, request count 1; a mutation adding one retry fails the count.

#### TC-LAND-007 - Transport failure is classified, status-absent, and not retried

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-5, NFR-5
**Target Layer / Location**: `tests/behaviour/providers/github-landing.test.ts` · **Tags**: @provider @landing @transport
**Fixtures**: `landing-responses.json` plus a throwing transport/runner.
**Given** a thrown transport failure during landing, **When** it surfaces, **Then** the result is `provider.payload.invalid` without `httpStatus`, one request was issued, and nothing is re-issued on the other transport.
**Pass criterion**: `ok: false`, no status, request counts `{primary: 1, secondary: 0}`; a mutation that catches and retries fails.

#### TC-LAND-008 - Force/bypass/queue/rebase are not representable; content write never lands

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-5, DM-1
**Target Layer / Location**: `tests/types/merge-delivery-request.type-test.ts`; `tests/behaviour/providers/github-landing.test.ts`; `tests/behaviour/providers/github-collection.test.ts` (content-write half) · **Tags**: @provider @landing @contract
**Fixtures**: type probes; `landing-responses.json`; a landing route registered so any unexpected call would be observed.
**Given** the operation's argument and option types, **When** a caller attempts `force`, `bypassProtection`, `autoMerge`, `mergeQueue`, `rebase`, `mergeCommit` strategy, or a `merge`/`squash-then-merge` strategy, **Then** the type system rejects it; **Given** a `write-delivery-request` invocation, **Then** no landing request is issued and the request stays unlanded.
**Pass criterion**: `@ts-expect-error` probes compile only because each property is absent; content-write cases record zero landing requests; a mutation that adds a `force` flag fails.

#### TC-CHECK-001 - Timings are copied verbatim when the provider supplies them

**Scenario Type**: Happy Path · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-1, DM-2, API-2
**Target Layer / Location**: `tests/behaviour/providers/github-evidence.test.ts` (new; timings section) · **Tags**: @provider @checks @timing
**Fixtures**: `tests/fixtures/providers/github/check-run-timings.json` (`both-present`, `completed-run`, `started-only`).
**Given** a check run whose payload supplies start and completion timestamps, **When** normalized, **Then** `PipelineJob.startedAt` and `completedAt` equal the provider strings byte-for-byte, no normalization or rounding occurs, and no `durationMs` field appears.
**Pass criterion**: exact string equality per job; absence of any derived duration key anywhere in the payload; a mutation that parses/reformats a timestamp fails.

#### TC-CHECK-002 - Absent timings stay absent; no duration is derived

**Scenario Type**: Edge Case · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-1, DM-2
**Target Layer / Location**: `tests/behaviour/providers/github-evidence.test.ts` · **Tags**: @provider @checks @absence
**Fixtures**: `check-run-timings.json` (`none-present`, `incomplete-run-completion-absent`).
**Given** a payload with no timestamps or with only a start, **When** normalized, **Then** the corresponding fields are absent, `completedAt` stays absent for an incomplete run, and no zero/default/computed duration is produced.
**Pass criterion**: `Object.hasOwn` is false for each absent field; a mutation defaulting to `0` or computing a duration fails naming the field.

#### TC-CHECK-003 - Excerpt cap boundary is exact on UTF-8 bytes

**Scenario Type**: Corner Case · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-2, DM-4, NFR-6
**Target Layer / Location**: `tests/behaviour/providers/github-evidence.test.ts` (excerpt section) · **Tags**: @provider @evidence @bounds
**Fixtures**: `tests/fixtures/providers/github/check-run-log-excerpt.json` (`exactly-8192-ascii`, `8193-ascii`, `multibyte-boundary`, `multibyte-split-avoidance`).
**Given** log text around the 8192-byte cap, **When** the excerpt is read, **Then** the returned prefix is ≤8192 bytes, exactly 8192 when the provider holds more, `byteLength` equals the returned bytes, `truncated` is false at 8192 and true above it, and no multi-byte sequence is split.
**Pass criterion**: `Buffer.byteLength(excerpt)` equals `byteLength` and is ≤8192 for every case; truncation flags per fixture; a mutation that measures characters instead of bytes fails the multi-byte case.

#### TC-CHECK-004 - Excerpt is a faithful prefix with identity and truncation authority

**Scenario Type**: Happy Path · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-2, DM-4
**Target Layer / Location**: `tests/behaviour/providers/github-evidence.test.ts` · **Tags**: @provider @evidence
**Fixtures**: `check-run-log-excerpt.json` (`prefix-fidelity`).
**Given** log text with a known byte sequence, **When** the excerpt is read, **Then** `jobId` is the requested job's identity, `excerpt` is a byte prefix of the provider text (not reordered, trimmed of interior whitespace, or re-encoded), and `truncated` is the sole truncation authority.
**Pass criterion**: `providerText.startsWith(excerpt)` byte-wise; the declared shape has exactly the four keys; a mutation that strips a trailing newline or rewrites interior content fails.

#### TC-CHECK-005 - Empty log text is observed empty, not not-found

**Scenario Type**: Edge Case · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-3, DM-4
**Target Layer / Location**: `tests/behaviour/providers/github-evidence.test.ts` · **Tags**: @provider @evidence @absence
**Fixtures**: `check-run-log-excerpt.json` (`empty-200`).
**Given** a successful read with empty text, **When** it completes, **Then** the result is `ok: true` with `excerpt: ""`, `byteLength: 0`, and `truncated: false` — an observed empty, distinct from not-found and failure.
**Pass criterion**: exact empty shape; a mutation that maps empty to not-found or to a payload failure fails.

#### TC-CHECK-006 - 404 is the adapter-local not-found result

**Scenario Type**: Edge Case · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-3, NFR-4
**Target Layer / Location**: `tests/behaviour/providers/github-evidence.test.ts` · **Tags**: @provider @evidence @classification
**Fixtures**: `check-run-log-excerpt.json` (`404`).
**Given** a 404 for the log surface, **When** read, **Then** the result is the adapter-local not-found result (the delivered read-result shape), never an empty success.
**Pass criterion**: not-found identity and no excerpt field; a mutation returning `ok: true` with an empty excerpt fails.

#### TC-CHECK-007 - Non-2xx and transport failures are classified payload failures

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-3, DM-4, NFR-4
**Target Layer / Location**: `tests/behaviour/providers/github-evidence.test.ts` · **Tags**: @provider @evidence @classification
**Fixtures**: `check-run-log-excerpt.json` (`401`, `403`, `500`, `503`, `transport-throw`).
**Given** each non-404 failure, **When** read, **Then** the result is `provider.payload.invalid` with `httpStatus` for non-2xx and without it for a thrown transport.
**Pass criterion**: identity and status presence per case; a mutation mapping 500 to not-found fails.

#### TC-CHECK-008 - Malformed 2xx is a classified payload failure

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-3, DM-4
**Target Layer / Location**: `tests/behaviour/providers/github-evidence.test.ts` · **Tags**: @provider @evidence @malformed
**Fixtures**: `check-run-log-excerpt.json` (`malformed-2xx`: wrong content type shape, non-text body, truncated JSON envelope).
**Given** a 2xx whose body cannot yield log text, **When** read, **Then** the result is a classified payload failure with `httpStatus` 200.
**Pass criterion**: `ok: false`, status 200, no excerpt; a mutation that returns an empty excerpt for malformed input fails.

#### TC-CHECK-009 - One read per excerpt: no retry, no pagination

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-2, NFR-10
**Target Layer / Location**: `tests/behaviour/providers/github-evidence.test.ts` · **Tags**: @provider @evidence @read-cost
**Fixtures**: `check-run-log-excerpt.json` (`large-text`), recorded transport.
**Given** one excerpt read, **When** it completes, **Then** exactly one provider request is recorded, no page/cursor parameter is sent, no retry occurs on failure, and no second request follows.
**Pass criterion**: request count exactly 1 for both success and failure cases; a mutation adding a retry or a page parameter fails.

#### TC-CHECK-010 - No excerpt is persisted or captured in the conformance artifact

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-4, NFR-6
**Target Layer / Location**: `tests/conformance/artifact.test.ts` (extend) + `tests/behaviour/providers/github-evidence.test.ts` (static import scan + recorded write seam) · **Tags**: @evidence @privacy @artifact
**Fixtures**: an evidence canary string (`EVIDENCE-CANARY-7f3a`-shaped example constant) replayed through an excerpt read and a conformance run.
**Given** an excerpt read containing the canary, **When** the invocation and a conformance run complete, **Then** the canary appears in no persisted state file, no event/capsule record, and no serialized conformance artifact, and the artifact's declared schema gains no excerpt field.
**Pass criterion**: zero canary occurrences across every captured write and the serialized artifact; the artifact key allowlist is unchanged; a mutation adding an `excerpt` field to the artifact fails.

#### TC-CHECK-011 - Rendered excerpt passes the redaction chokepoint

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-4, NFR-6
**Target Layer / Location**: `tests/behaviour/providers/github-evidence.test.ts` · **Tags**: @evidence @privacy @render
**Fixtures**: excerpt text containing a token-shaped and a secret-shaped canary; the delivered rendering/redaction seam.
**Given** an excerpt with secret-shaped material, **When** it is rendered through the single redaction chokepoint, **Then** the rendered text contains redaction markers and no canary, and the unredacted text exists only in the in-memory read result.
**Pass criterion**: zero canary occurrences in rendered output; the paired positive shows the same text without the canary renders normally (proving the case is not passing because rendering is empty).

#### TC-CHECK-012 - The excerpt cap is fixed and not caller-tunable

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-2, NFR-6
**Target Layer / Location**: `tests/types/check-log-excerpt.type-test.ts` (new) + `tests/behaviour/providers/github-evidence.test.ts` · **Tags**: @evidence @bounds @contract
**Fixtures**: type probe over the reader's options; runtime attempt to pass `maxBytes`.
**Given** the evidence reader's construction and read options, **When** a caller attempts to pass a byte cap, **Then** the type rejects it and no runtime path reads such an option; the cap is a single declared constant equal to the documented value.
**Pass criterion**: `@ts-expect-error` probe compiles; a runtime options object with an extra key changes nothing; the constant is imported by both the reader and the reference-behavior test, so a cap change cannot agree by accident.

#### TC-THREAD-001 - Discussion shape and the 50-comment oldest-first cap

**Scenario Type**: Happy Path · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-1, DM-3, NFR-6
**Target Layer / Location**: `tests/behaviour/providers/github-thread-discussion.test.ts` (new) · **Tags**: @provider @threads @evidence
**Fixtures**: `tests/fixtures/providers/github/thread-discussion.json` (`fifty-comments`, `fifty-one-comments`).
**Given** a thread with 50 and with 51 comments, **When** read, **Then** the shape is exactly `{ threadId, resolved, commentCount, comments[], truncated }`, the list holds at most 50 entries in provider order (oldest first), each entry is `{ commentId, authorLogin?, authorKind?, authorAssociation?, body, bodyTruncated }`, and `commentCount` carries the provider's total (51 in the second case).
**Pass criterion**: key sets exact, length 50 in both, provider order preserved, `commentCount` 51 not 50; a mutation that returns 51 entries or truncates the count fails.

#### TC-THREAD-002 - Per-body cap is 4096 UTF-8 bytes with a per-body flag

**Scenario Type**: Corner Case · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-1, NFR-6
**Target Layer / Location**: `tests/behaviour/providers/github-thread-discussion.test.ts` · **Tags**: @provider @threads @bounds
**Fixtures**: `thread-discussion.json` (`body-4096`, `body-4097`, `body-multibyte-boundary`, `body-with-combining-marks`).
**Given** comment bodies at and above the cap, **When** read, **Then** each returned body is ≤4096 UTF-8 bytes, a body truncated at the cap sets that comment's `bodyTruncated: true`, an exactly-4096 body sets it false, and no multi-byte sequence is split.
**Pass criterion**: `Buffer.byteLength(body) ≤ 4096` per comment and exact flags; a mutation measuring characters fails the multi-byte case.

#### TC-THREAD-003 - The truncation flag follows the exact declared rule

**Scenario Type**: Edge Case · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-2, DM-3
**Target Layer / Location**: `tests/behaviour/providers/github-thread-discussion.test.ts` · **Tags**: @provider @threads @truncation
**Fixtures**: `thread-discussion.json` (`exact-50-no-body-truncation`, `49-of-50`, `50-of-51`, `any-body-truncated`, `zero-comments`).
**Given** each combination, **When** read, **Then** thread-level `truncated` is true exactly when returned comments are fewer than `commentCount` or any body is truncated, and false in every other case.
**Pass criterion**: a truth table asserted in one case (five rows, both directions); a mutation OR-ing the conditions incorrectly (e.g. true when bodies are truncated only) fails the `49-of-50` row.

#### TC-THREAD-004 - 404/absent thread is not-found, never empty success

**Scenario Type**: Edge Case · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-3, DM-3, NFR-4
**Target Layer / Location**: `tests/behaviour/providers/github-thread-discussion.test.ts` · **Tags**: @provider @threads @classification
**Fixtures**: `thread-discussion.json` (`404`, `provider-absent-thread`).
**Given** an explicit 404 and a provider-asserted absent thread, **When** read, **Then** each yields the adapter-local not-found result, not `ok: true` with zero comments.
**Pass criterion**: not-found identity for both, no comments array; a mutation returning an empty list fails.

#### TC-THREAD-005 - Non-2xx and transport failures are classified payload failures

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-3, DM-3, NFR-4
**Target Layer / Location**: `tests/behaviour/providers/github-thread-discussion.test.ts` · **Tags**: @provider @threads @classification
**Fixtures**: `thread-discussion.json` (`401`, `403`, `500`, `transport-throw`).
**Given** each non-404 failure, **When** read, **Then** it is `provider.payload.invalid` with status for non-2xx and without status for a thrown transport.
**Pass criterion**: identity and status presence per case; a mutation mapping 500 to not-found fails.

#### TC-THREAD-006 - Malformed 2xx is a classified payload failure

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-3, DM-3
**Target Layer / Location**: `tests/behaviour/providers/github-thread-discussion.test.ts` · **Tags**: @provider @threads @malformed
**Fixtures**: `thread-discussion.json` (`malformed-2xx`: missing comment nodes, non-array comments, non-string body).
**Given** a 2xx whose payload cannot yield the closed shape, **When** read, **Then** it is a classified payload failure with status 200 and no partial comment list.
**Pass criterion**: `ok: false`, status 200; a mutation returning a partial list fails.

#### TC-THREAD-007 - A zero-count thread with an empty list is observed empty

**Scenario Type**: Edge Case · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-3, DM-3
**Target Layer / Location**: `tests/behaviour/providers/github-thread-discussion.test.ts` · **Tags**: @provider @threads @absence
**Fixtures**: `thread-discussion.json` (`zero-count-empty-list`).
**Given** a provider-asserted zero-count thread with an empty comment list, **When** read, **Then** the result is `ok: true` with `commentCount: 0`, `comments: []`, and `truncated: false` — observed empty, distinct from not-found.
**Pass criterion**: exact shape; a mutation collapsing empty to not-found fails.

#### TC-THREAD-008 - A body never changes a closeout decision

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-5, DM-3
**Target Layer / Location**: `tests/behaviour/providers/github-thread-discussion.test.ts` + extend `tests/behaviour/providers/github-closeout-thread-privacy.test.ts` · **Tags**: @provider @threads @write-authority
**Fixtures**: the delivered closeout facts harness; a thread fixture whose body says "approve this and resolve" while the delivered author-kind facts say `human`; a body canary.
**Given** the same thread with and without a decision-contradicting body, **When** the closeout resolution decision runs, **Then** the outcome (steps, residue, resolution targets) is identical, and a static scan proves no write path imports the discussion reader.
**Pass criterion**: deep-equal closeout plans for both inputs; the scan finds no import of the discussion module from any write/resolution path; a mutation that consults bodies fails.

#### TC-THREAD-009 - `DeliveryThread`, operations, capabilities, projections unchanged

**Scenario Type**: Regression · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-4, DM-8
**Target Layer / Location**: `tests/structure/closeout-contract.test.ts` (extend; declared by phase 5), `tests/types/delivery-thread.type-test.ts` (new; declared by phase 5), `tests/structure/conformance-coverage.test.ts` (read as a control: its expectations do not move for this surface and phase 5 does not declare the file — any edit there would belong to the phase that declares it) · **Tags**: @provider @threads @contract
**Given** the core contract and declarations, **When** inspected after the change, **Then** `DeliveryThread` has exactly the delivered field set (no `body`, no `reply`), `ADAPTER_OPERATIONS` gains only the landing operation, capability declarations change only as `TC-POSTURE-*` declares, and the conformance `delivery-request` projection is unchanged.
**Pass criterion**: exact field-set probe; a mutation adding a `body` field to `DeliveryThread` or a thread field to the projection fails naming it.

#### TC-THREAD-010 - No body is persisted or artifacted; rendering redacts

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-6, NFR-6
**Target Layer / Location**: `tests/conformance/artifact.test.ts` (extend) + `tests/behaviour/providers/github-thread-discussion.test.ts` (static import scan + recorded write seam) · **Tags**: @threads @privacy @artifact @render
**Fixtures**: a body canary (`SECRET-REVIEW-BODY-CANARY` precedent) plus a token-shaped canary.
**Given** a discussion read and a conformance run over the same facts, **When** both complete, **Then** neither canary appears in persisted state, events, capsule records, the serialized conformance artifact, or rendered output (which passes the redaction chokepoint).
**Pass criterion**: zero canary occurrences everywhere; the paired positive renders the non-canary body unchanged; the artifact schema exposes no body field.

#### TC-THREAD-011 - Exactly one read per thread

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-1, NFR-10
**Target Layer / Location**: `tests/behaviour/providers/github-thread-discussion.test.ts` · **Tags**: @threads @read-cost
**Fixtures**: `thread-discussion.json` (`fifty-one-comments`), recorded transport.
**Given** one thread with more comments than the cap, **When** read, **Then** exactly one provider request is sent, no pagination/cursor is used, and no follow-up request occurs despite the truncation.
**Pass criterion**: request count 1; a mutation adding a second page fails.

#### TC-BACKLOG-001 - Comment write is supported and carrier-free

**Scenario Type**: Happy Path · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-6, AC-F6-1, API-5, DM-1
**Target Layer / Location**: `tests/behaviour/providers/github-collection.test.ts` (extend) + `tests/conformance/mock-conformance.test.ts` (projection) · **Tags**: @backlog @comment @contract
**Fixtures**: `tests/fixtures/providers/github/issue-writes.json` (`comment-created`); `tenant.json` comment route and expected projection.
**Given** the GitHub declaration and a carrier-free comment request, **When** the comment is written, **Then** the operation is supported (not a gap), `writableCarriers`/`readableCarriers` remain empty arrays, the recorded request body carries exactly the human text with no envelope block or metadata carrier, and the provider's comment identity is returned.
**Pass criterion**: declaration and body assertions; zero carrier markers; a mutation that wraps the text in a carrier block or claims a carrier fails.

#### TC-BACKLOG-002 - Content write creates and updates (DM-9), never lands, refuses missing input

**Scenario Type**: Happy Path · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-6, AC-F6-1, API-6, DM-9
**Target Layer / Location**: `tests/behaviour/providers/github-collection.test.ts` (extend) + `tests/conformance/mock-conformance.test.ts` (projection + direct client call) · **Tags**: @backlog @content @landing-safety
**Fixtures**: `issue-writes.json` (`pull-created`, `pull-created-default-draft`, `pull-updated`, `pull-update-not-found`, `pull-create-missing-ref`, `pull-create-empty-title`, `pull-update-empty`); `tenant.json` create/update routes and expected `delivery-request` projections; a registered landing route to observe any unexpected call.
**Given** a **create** variant `{ kind: "create", sourceRef, targetRef, title, body, draft? }`, **When** it completes, **Then** the recorded request carries exactly the source ref, the target ref, the non-empty title and the body verbatim (and the draft flag only when supplied — an absent `draft` is absent, never a fabricated `false`), the normalized delivery-request view's identity is the returned identity, and no landing request is issued and no merge state is set. **Given** an **update** variant `{ kind: "update", deliveryRequest: { systemName, entityId }, title?, body? }`, **When** it completes separately, **Then** the recorded request targets that identity and carries only the supplied title/body, no create request is issued, and `reviewState`/refs are unchanged by the content write. **Given** a create missing a ref or with an empty title, or an update with neither title nor body, **Then** the result is a named typed refusal carried by `provider.payload.invalid` with a detail naming the missing field, and the transport records zero provider requests. **Given** an update whose target answers `404`, **Then** the result is `provider.payload.invalid` with `httpStatus: 404` after exactly one request and no retry — the content write shares the write family's uniform classification, and a `404` is never promoted to `provider.not-found` on a write.
**Pass criterion**: per-variant request method/body and normalized projection asserted separately (create and update are two distinct cases, not one); zero landing requests, zero merge-state writes; refusal detail names the missing field with request count 0; a mutation that derives `draft`, merges on create, creates on update, or issues a request before refusing fails; the `404` case asserts request count 1, `httpStatus: 404`, and the payload-failure identity, so a mutation that maps a write `404` to `provider.not-found` or retries the request fails naming the case.

#### TC-BACKLOG-003 - The declared four-row seed has load-bearing precedence

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-6, AC-F6-2, DM-6
**Target Layer / Location**: `tests/behaviour/providers/github-workflow-map.test.ts` (new) · **Tags**: @backlog @workflow-map @contract
**Fixtures**: `tests/fixtures/providers/github/workflow-map-cases.json` (`seed-rows`: closed→done/field-update, review→in-review/label-swap, in-progress→in-progress/label-swap, open→ready/field-update in that order).
**Given** a client constructed without an injected map, **When** the effective map is inspected, **Then** it is exactly those four rows in that order with those mechanisms and the declared `systemName`, and the order is the precedence used to resolve a payload carrying several tokens.
**Pass criterion**: deep equality including order; a mutation reordering `open` before `closed` changes the resolution of a `closed`+`open` payload and fails; `pnpm typecheck`/runtime validator rejects a duplicate token or an unknown mechanism.

#### TC-BACKLOG-004 - The writable set round-trips where admitted; the terminal-read and non-terminal refusals refuse

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-6, AC-F6-3 (symmetry **where the map admits the write**), AC-F6-4 (owns both write refusals), DM-6, NFR-11
**Target Layer / Location**: `tests/behaviour/providers/github-workflow-map.test.ts` · **Tags**: @backlog @workflow-map @symmetry
**Fixtures**: `workflow-map-cases.json` (`writable-set-roundtrip`: one pair per writable alias — `done` via the `closed` field-update row and `in-review`/`in-progress` via their `label-swap` rows, each pair starting from a **current read that admits the write**; `non-terminal-field-update-write-refusal`: a transition to `ready` through the seed's `open` field-update row; `terminal-read-write-refusal`: a transition to `in-review` on an issue whose **current read resolves to `done`**, in two variants — a `closed` issue carrying no labels and a `closed` issue carrying `in-progress`/`review` labels, so the refusal provably does not depend on labels); the stateful scripted transport helper in `tests/behaviour/providers/support.ts` (the mock tenant is stateless and body-keyed, so read-back is proven there and never by making the tenant stateful).
**Given** each writable alias (`done`, `in-review`, `in-progress`) on an issue whose current read admits that write, **When** the adapter transitions it through one map instance and the issue is read back through the same instance, **Then** the normalized `deliveryState` equals the written alias for every member of the writable set. **Given** a transition to `ready`, **When** requested, **Then** it is a named typed refusal (a declared adapter-local refusal detail naming the alias and its non-terminal `field-update` mechanism, carried by `provider.payload.invalid`) with zero provider requests and zero writes, because the `open` field-update row is readable but read-only in this change. **Given** a `label-swap` transition to `in-review` on an issue whose current read resolves to `done`, **When** requested, **Then** it is the terminal-read refusal — a named typed refusal carried by `provider.payload.invalid` whose detail names the terminal read resolution — with zero provider requests and zero writes, **regardless of the issue's labels**, because terminal precedence would outrank the token the write adds and the write could never be observed (AC-F6-4, TDR-0034 §3.2).
**Pass criterion**: 3/3 writable aliases round-trip on an admitting read (a mutation writing a label but normalizing by field only fails the label rows; a mutation that builds a second map for writes fails the injected-map case in `TC-BACKLOG-010`); `ready` refuses with request count 0 and no label write; **both** `closed` variants refuse with request count 0, zero label reads and zero label writes, and the two refusals are distinguished by their details (the terminal refusal names the `done`-resolving current read, the non-terminal refusal names the alias and mechanism) so a generic "refused" assertion cannot pass; a mutation that writes `ready` as an asymmetric state-only `PATCH`, or that attempts the `label-swap` write on a `done`-resolving issue, fails naming the alias.

#### TC-BACKLOG-005 - Label swap removes declared label-swap tokens only, preserving unrelated labels

**Scenario Type**: Corner Case · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-6, AC-F6-4, API-7
**Target Layer / Location**: `tests/behaviour/providers/github-workflow-map.test.ts` + extend `tests/behaviour/providers/github-closeout.test.ts` (`TC-CLOSE-020/023/027` neighbours) · **Tags**: @backlog @labels @write-safety
**Fixtures**: `workflow-map-cases.json` (`labels-before`/`labels-after`: `change`, `vendor-label`, `in-progress` present; transition to `in-review`).
**Given** an issue carrying declared `label-swap` tokens plus unrelated labels, **When** a `label-swap` transition is applied, **Then** one issue `PATCH` carries the computed target set: every unrelated label of the caller's current read is preserved unchanged, every **declared `label-swap`** token other than the row token is absent, the row token is present, and the array is never a single-token array. The preserved set is the supplied current read, so a label another actor adds between that read and the write is not preserved — the declared read-to-write limitation, asserted as the documented boundary rather than as an unseen guarantee. A `field-update` row's token (`open`, `closed`) is a provider state and is never treated as a label removal, so a present `closed` textual label is left alone by a label-swap sweep.
**Pass criterion**: set equality of the written array with the expected array (assertions unchanged by the wording restatement); a mutation sending only the new token fails; a mutation that removes an unrelated label fails; a mutation that also strips a label matching a `field-update` token fails. Per-label add/remove requests are **not** the mechanism and no case asserts them.

#### TC-BACKLOG-006 - Label-swap refuses on an unavailable signal or a terminal read; the field-update `done` write does not

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-6, AC-F6-4 (owns both write refusals), AC-F6-5 (the map-only refusal is distinct from these), API-7, NFR-11
**Target Layer / Location**: `tests/behaviour/providers/github-workflow-map.test.ts` + `tests/behaviour/providers/github-closeout.test.ts` (the delivered terminal write) · **Tags**: @backlog @labels @refusal
**Fixtures**: `workflow-map-cases.json` (`labelless-open-issue`: the one payload with no `labels` field / no `labels` array **and native state `open`**, so its only possible refusal is the unavailable-signal one; `labelless-closed-issue`: the same absent label container with native state `closed`, whose current read resolves to `done`; and a labelled `closed` variant carrying `in-progress`, to prove label-independence); `issue-writes.json` (`done-write-labelless`: the expected label-free `done` write).
**Given** the labelless **`open`** issue, **When** a **`label-swap`** transition (`in-review` or `in-progress`) is requested, **Then** the adapter refuses with the unavailable-label-signal detail and issues zero provider reads and zero provider writes, because a replacement cannot be computed from an unavailable label signal. **Given** the labelless **`closed`** issue, **When** the same `label-swap` transition is requested, **Then** it refuses for the **terminal** reason — its current read resolves to `done` — with zero provider requests, and the detail names the terminal resolution rather than the missing label container; this is the fixture's only meaningful reading, because a labelless `closed` issue always resolves to `done`. **Given** the same labelless `open` issue, **When** a **`field-update`** transition to `done` is requested, **Then** it succeeds with exactly one request, method `PATCH`, body exactly `{"state":"closed"}`, zero label reads and zero label writes, and it does not refuse because of the unavailable label signal.
**Pass criterion**: the unavailable-signal refusal asserts its own detail plus request count 0; the terminal refusal asserts **its own, different** detail plus request count 0 and is reproduced with and without labels, so label-independence is proven; a criterion that asserts only "refused" without distinguishing the two details fails — the two refusals are separate behaviours with separate causes (AC-F6-4); the paired `done` half asserts request count 1, method `PATCH`, body deep-equal to `{"state":"closed"}`, zero label-shaped requests, and `ok: true` on the same labelless **`open`** fixture (proving the refusal is mechanism-scoped, not label-signal-wide); a mutation treating absent labels as an empty array and applying a single-token write fails the first half; a mutation that lets the terminal case write instead of refusing fails the terminal half; a mutation adding a label read, a label write, or a label-signal refusal to the `field-update` path fails the `done` half.

#### TC-BACKLOG-007 - Undeclared alias is a named typed refusal with zero writes

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-6, AC-F6-5, DM-6
**Target Layer / Location**: `tests/behaviour/providers/github-workflow-map.test.ts` · **Tags**: @backlog @workflow-map @refusal
**Fixtures**: `workflow-map-cases.json` (`unmapped-aliases`: `backlog`, `canceled`; `unmapped-tokens`: `change`, `planning`, `spec-ready`, `readiness-passed`, `delivered`, `blocked`, `backlog-capture`).
**Given** an alias with no declared row, **When** a transition is requested, **Then** the adapter returns a named typed refusal (a declared adapter-local refusal identity, not a generic success or a silent no-op) and the transport records zero writes.
**Pass criterion**: refusal identity for every documented unmapped alias, zero requests; a mutation that falls through to a default row fails.

#### TC-BACKLOG-008 - Read resolution: exact-case precedence, one case-collision refusal, native fallback

**Scenario Type**: Edge Case · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-6, AC-F6-2, DM-6, §8.4.1 Table E
**Target Layer / Location**: `tests/behaviour/providers/github-workflow-map.test.ts` · **Tags**: @backlog @workflow-map @read-resolution
**Fixtures**: `workflow-map-cases.json` (`exact-case-twin`: label `in-progress`; `case-collision-label-swap`: label `In-Progress`; `case-variant-state-label`: label `CLOSED` on a `closed` issue and on an `open` issue; `unknown-labels`: `change`, `bug`, and a vendor label; `labelless-read`: no label container; `native-state-row-missing`: an injected map that omits the row for the resolved native state).
**Given** the seed map, **When** the read-side truth table is replayed, **Then**: (1) a `closed` issue carrying the label `CLOSED` resolves to `done` by native terminal state — it is **not** a refusal, because a case difference on a `field-update` token is not a collision; (2) an `open` issue carrying the label `CLOSED` resolves to `ready` by the native `open` row — native fallback, never a refusal, and never an alias derived from the label; (3) an `open` issue carrying `In-Progress` resolves to a visible normalization failure carried by the existing `provider.payload.invalid` identity, its detail naming `In-Progress` and the declared `in-progress` token it collides with, and no new error-table row exists; (4) the exact-case twin `in-progress` resolves to `in-progress` by the label row; (5) an `open` issue whose only labels are unrecognized (`change`, `bug`, or a vendor label) resolves to `ready` by the native `open` row, with the labels still present in the normalized label array; (6) an `open` issue with no label container at all resolves to `ready` by the native row, never a refusal; (7) only an injected map with no row for the resolved native state refuses, naming the native state.
**Pass criterion**: one truth-table assertion with all **seven** rows and both directions (resolved alias or refusal identity per row), each row also asserting that its label set survives into the normalized view where a label was supplied; the case-collision row names both the label and the declared token and asserts zero error-table rows for it; the anti-vacuity mutation lower-cases both sides (label and token) before comparing and must **fail** the `In-Progress` row by resolving it to `in-progress` instead of refusing — proving the case is not passing because every variant refuses; a second mutation that treats `CLOSED` as a collision fails row (1); a third mutation that lets `CLOSED` on an open issue produce an alias from the label rather than the native row fails row (2).

#### TC-BACKLOG-009 - No configuration surface is added

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-6, AC-F6-6, NG-2
**Target Layer / Location**: `tests/structure/config-contract.test.ts` (extend; declared by phase 3) + `tests/checks/config-default-positions.test.ts` (extend; declared by phase 3) + the repo source scan **inside `tests/structure/config-contract.test.ts`** · **Tags**: @config @scope @contract
**Given** the change's construction inputs, **When** the configuration surfaces are inspected, **Then** no settings type, catalog branch, configuration key, config-file format, or startup validation path is added; the workflow map and transport policy appear only as construction data.
**Pass criterion**: the config contract's declared key inventory is byte-identical to the delivered one; the scan finds no `github`-named config node and no new environment/CLI switch; a mutation adding `github.workflow` to the config contract fails naming the key. Both assertion sites are declared by this case's owning phase, so the commit primitive can stage them; `tests/structure/reference-behavior.test.ts` is **not** used here — phase 3 does not declare it, and that suite belongs to phase 6's document↔declaration drift obligation.

#### TC-BACKLOG-010 - Injected map overrides the seed; an invalid map is captured once and refused by name

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-6, AC-F6-3, DM-6, NFR-11
**Target Layer / Location**: `tests/behaviour/providers/github-workflow-map.test.ts` · **Tags**: @backlog @workflow-map @injection
**Fixtures**: `workflow-map-cases.json` (`injected-map`: one project-specific `label-swap` row, so its alias is writable; `invalid-maps`: one case per declared rejection rule — bad `systemName`; `states` absent, non-array, empty, or containing a non-object row; a non-string `nativeStatus`; a **duplicate token**; an unknown `deliveryState` and an unknown `transitionMechanism`; a **duplicate alias** (two rows declaring the same delivery alias); a row set with **no `done` row**; and a **`done` row that is `label-swap`** rather than the `field-update` row on native state `closed`). The rejection set and its timing are **TDR-0034 §1** and spec DM-6; this case asserts that contract and is never its authority.
**Given** a valid injected map, **When** a writable alias (the injected row's alias) is written on an issue whose current read admits the write and read back through the same map instance, **Then** the injected row is used for both directions and no seed row is consulted. **Given** each invalid map, **When** the client is constructed, **Then** nothing fails at import and nothing throws: the validator runs exactly once on the resolved map at construction, its failure is captured, and the **first** operation returns the existing `provider.payload.invalid` refusal whose detail names the failed check and the offending row, with zero provider requests; a second operation returns the same refusal without re-validating (one validation per construction, never per request). **Given** an injected map that declares a non-terminal `field-update` row, **Then** that alias is readable but refuses on write (`TC-BACKLOG-004`).
**Pass criterion**: injected alias round-trips; a seed alias outside the injected map refuses from the map alone; every declared rejection rule has a row that fails naming the failed check and the offending row, with zero provider requests and no new error-table row; the validator-invocation count is exactly 1 per construction across two operations; construction and module import both succeed (a thrown error, or a refusal raised at import, fails the case); a mutation that validates lazily at the first request, per request, at module load, that skips the `done`-row check, or that accepts a `label-swap` `done` row fails the named row.

#### TC-BACKLOG-011 - The seed preserves delivered `open → ready` / `closed → done`

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-6, AC-F6-2, AC-F1-3
**Target Layer / Location**: `tests/behaviour/providers/github-inputs.test.ts` (extend) + `tests/behaviour/providers/github-collection.test.ts` (extend) · **Tags**: @backlog @regression
**Fixtures**: `tests/fixtures/providers/github/issues.json` and `issues-list-*` (delivered, **read only** — no edit, so no phase declaration is needed); `workflow-map-cases.json` (`seed-read` rows; declared by phase 3).
**Given** an open issue and a closed issue, **When** normalized through the default seed, **Then** their `deliveryState` is `ready` and `done` respectively, exactly as delivered; labelled `in-progress`/`review` issues now normalize to `in-progress`/`in-review` as the one deliberate visible change.
**Pass criterion**: open/closed assertions unchanged from the delivered suite plus the two new label rows; a mutation reverting the label rows to `ready` fails.

#### TC-REF-001 - The reference-behavior surface documents every operation and evidence read

**Scenario Type**: Content · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-7, AC-F7-1, DM-5
**Target Layer / Location**: `tests/structure/reference-behavior.test.ts` (new); document locator in `tests/fixtures/provider/reference-behavior.ts` (new) · **Tags**: @docs @contract
**Fixtures**: `doc/spec/features/feature-adapter-reference-behavior.md` (new; path bound through the locator) and `doc/00-index.md`.
**Given** the completed change, **When** the document is parsed, **Then** it contains one row per closed operation (nine) with preferred/fallback transport, primary failure identities and classification, absence semantics, caps/truncation signals, and the GitHub gap posture, plus a section for each evidence read with shape, caps, classification, secret discipline, and deliberate absences, and the document is linked from the documentation index.
**Pass criterion**: extracted operation rows equal `ADAPTER_OPERATIONS` exactly (nine, no more, no fewer), both evidence reads present, index row resolves; a mutation deleting a row or the index entry fails naming it. A missing document fails the locator assertion rather than skipping.

#### TC-REF-002 - Documented transports, caps, and gaps agree with machine declarations

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-7, AC-F7-2, DM-5, NFR-1
**Target Layer / Location**: `tests/structure/reference-behavior.test.ts` · **Tags**: @docs @drift
**Fixtures**: the parsed document; exported transport matrix, capability declarations, and evidence-cap constants.
**Given** the document and the exported declarations, **When** compared, **Then** every preferred/fallback pair equals the matrix entry, every gap posture equals the three declarations, and every documented cap (`8192`, `50`, `4096`) equals the imported constant.
**Pass criterion**: zero mismatches with mismatches reported as `document row -> documented value != machine value`; non-vacuity asserts the parser extracted exactly 9 rows, 3 adapters, and 3 caps before comparing; a mutation that changes one document digit fails naming the row and both values.

#### TC-REF-003 - Documented absence semantics agree with the code

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-7, AC-F7-2, DM-2, DM-8
**Target Layer / Location**: `tests/structure/reference-behavior.test.ts` · **Tags**: @docs @absence
**Fixtures**: the document's Table-D equivalent; type probes for `PipelineJob`, `DeliveryRequest.headSha`, `DeliveryThread`, `WorkItem.comments/relations/updatedAt`, `pageItemCount`, and the landing identity.
**Given** the absence table, **When** compared with the code, **Then** each documented absence rule matches the field's optionality and the "never" column matches the absence of derivation (`durationMs`, defaulted timestamps, guessed SHAs, inferred author facts, collapsed empty values).
**Pass criterion**: each row binds to a named type property or normalizer; non-vacuity requires all six documented signals; a mutation adding `durationMs` or defaulting a timestamp fails the corresponding row.

#### TC-REF-004 - Evidence and other-adapter positions are stated

**Scenario Type**: Content · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-7, AC-F7-3, F-5, NFR-6
**Target Layer / Location**: `tests/structure/reference-behavior.test.ts` · **Tags**: @docs @evidence @parity
**Fixtures**: the document's evidence-read section and gap-posture table.
**Given** the evidence-read documentation, **When** inspected, **Then** it states that bodies and excerpts are evidence, never lifecycle truth, carry no write authority, are never persisted, and that the other adapters take an explicit same-behavior-or-absent position outside the closed set.
**Pass criterion**: the four statements are present as assertions over parsed sections (not keyword presence in the whole file); the other-adapter position names both GitLab and Jira; a mutation deleting the write-authority sentence fails.

#### TC-REF-005 - Probe, selection value, refusals, and no-failover are documented and agree

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-7, AC-F7-4, DM-7, DM-10
**Target Layer / Location**: `tests/structure/reference-behavior.test.ts` · **Tags**: @docs @probe
**Fixtures**: the document's probe/composition table; exported probe-code constants; the `GithubTransportSelection` type.
**Given** the probe documentation, **When** compared with the code, **Then** it states the three closed refusal codes, that the probe runs only at composition and never at module load, never per request, and **never in the mock tier**, that the policy is `prefer-cli`/`api-only`, that a fallback carries exactly one composition-scoped `GithubTransportSelection` value (`policy`, `selected: "api"`, `degradation.code` equal to the probe refusal code) which is never persisted and renders exactly one diagnostic line naming that code, and that no per-request failover exists; the documented code set equals the exported closed set.
**Pass criterion**: set equality of codes plus the four prose obligations as parsed claims (composition-only, mock-tier-excluded, selection value with one diagnostic line and zero persisted copies, no-failover); a mutation adding a fourth documented code, deleting the no-failover sentence, or describing a persisted/per-request transport declaration fails.

#### TC-REF-006 - Mapping documentation agrees with the seed and states the resolution rules

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-7, AC-F7-5, DM-6
**Target Layer / Location**: `tests/structure/reference-behavior.test.ts`; seed exported from the GitHub adapter · **Tags**: @docs @workflow-map
**Fixtures**: the document's mapping table; `workflow-map-cases.json` seed rows.
**Given** the mapping documentation, **When** compared with the exported seed and the declared rules, **Then** token vocabulary, precedence order, the four rows and their mechanisms, the deliberately unmapped token/alias set, and the "not yet operator-configurable" limitation all agree exactly; the document also states the **mechanism-scoped** write rule (only a `label-swap` transition reads/removes/adds labels and refuses on an unavailable signal; a `field-update` transition writes state only), the writable set (`done` plus each declared `label-swap` alias) with the non-terminal `field-update` alias read-only, the case-collision rule on the write path, and the four read outcomes (exact-case precedence, case collision with a declared `label-swap` token refused through `provider.payload.invalid`, native-state fallback for unknown/labelless, and the sole read refusal being the absence of a native-state row).
**Pass criterion**: table rows equal the seed in order and value; unmapped sets are equal both directions; the four prose rules are present as parsed claims in the mapping section (not keyword presence in the file); a mutation adding `backlog` as a mapped row, dropping a documented unmapped token, describing every transition as label-sweeping, or documenting label casing as case-insensitive fails.

#### TC-PARITY-001 - Registry equals the nine-operation closed set; steps execute; gaps encountered

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-8, AC-F8-1, NFR-7
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts` (extend the per-adapter executed/gap coverage assertions; declared by phase 3). The flow/step pin extension — `tests/structure/conformance-coverage.test.ts`, 3 flows / 13 steps plus the landing step and the nine-operation equality — is authored in **phase 1**, which declares that file and registers the step together with the operation; phase 3 reads it as a control and edits nothing there · **Tags**: @conformance @coverage
**Fixtures**: `CONFORMANCE_FLOWS`; `tenant.json`; recorded reports for all three adapters.
**Given** the registry and the nine-operation closed set, **When** compared, **Then** the operation sets are exactly equal in both directions, the new landing step executes against the GitHub tenant with a projection, every supported operation of every adapter has a non-skipped executed step, and every declared gap is encountered with the exact declared reason.
**Pass criterion**: exact set equality, per-adapter executed/gap coverage tables, zero vacuous rows; a mutation deleting the landing step, adding a tenth operation, or declaring an unencountered gap fails naming it. Both halves are staged by the phase that declares their file (pin in phase 1, coverage assertions in phase 3) and the case's ownership stays with phase 3, the phase whose commit makes the executed/gap tables true.

#### TC-PARITY-002 - Carrier roundtrip is a `capability-absent` skip

**Scenario Type**: Happy Path · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-8, AC-F8-2
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts` (extend; declared by phase 3) + `tests/structure/conformance-coverage.test.ts` (read as a control; declared and extended by phase 1, not edited here) · **Tags**: @conformance @skip-kind
**Fixtures**: `tenant.json`; the GitHub report's `comment-provenance.carrier-roundtrip` step.
**Given** `write-comment` supported and GitHub declaring empty carrier arrays, **When** the comment-provenance flow runs, **Then** the carrier roundtrip records `status: skipped`, `skipKind: capability-absent`, with an empty carrier list, not `declared-gap`.
**Pass criterion**: exact skip kind per provider step; a mutation reclassifying it as `declared-gap` fails; GitLab/Jira (also empty carrier arrays, comment gap) keep their declared-gap or capability-absent posture as their declarations dictate, asserted explicitly.

#### TC-PARITY-003 - One `write-delivery-request` step; both content-write variants have routes and projections

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-8, AC-F8-4, API-5, API-6, DM-9
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts` (extend) + `tests/fixtures/providers/conformance/github/tenant.json` · **Tags**: @conformance @fixtures
**Fixtures**: tenant routes for comment create, content-write **create**, and content-write **update**; expected projections for the `write-comment` step and for the single `write-delivery-request` step. The update route is exercised by a direct client call in this suite, following the `TC-CONF-008` pattern (build the client against the loaded tenant, call the member, assert the projection) — not by a second registry step.
**Given** the extended tenant, **When** the `change-lifecycle` flow runs, **Then** the comment step and the **one** `write-delivery-request` step execute (not skipped) — the registry carries exactly one step for that operation, whose dispatch member is the create variant, and this change adds exactly three dispatch members (`writeComment`, `createDeliveryRequest`, `mergeDeliveryRequest`) with no update member — and their normalized projections equal the declared expectations exactly (comment identity and text echo; delivery-request refs/title/body and unchanged `reviewState`). **Given** the same loaded tenant, **When** the update route is invoked directly through the client member, **Then** it updates the declared identity with the supplied title/body and returns the normalized view, and the update is proven here rather than by inventing a registry step.
**Pass criterion**: one executed step per operation (step count asserted, not `>=`), exact projection per step, the tenant decoder validates (no unknown keys), and the direct update call asserts its own projection; the update is proven by `TC-BACKLOG-002` as well. This case **is** a declared oracle change relative to the pre-revision wording (which spoke of separate create/update steps that the registry does not and must not carry): the step pin and the direct-call shape are stated here so no implementer hunts for a second step. A mutation that changes the expected projection, deletes the create route, or duplicates the step fails naming the step.

#### TC-PARITY-004 - The landing operation has a route and an expected projection

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-8, AC-F8-4, API-1
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts` (extend) + `tenant.json` · **Tags**: @conformance @landing
**Fixtures**: a landing route returning a provider-supplied `mergeCommitSha`; an expected projection carrying that identity and the declared outcome.
**Given** the landing step, **When** executed against the mock tenant, **Then** exactly one landing request is recorded, the projection matches (including identity), and the step is not skipped for GitHub while GitLab/Jira skip with their declared reasons.
**Pass criterion**: request count 1, projection exact, per-adapter skip reason exact; a mutation removing the route makes the step fail (not silently skip) because the operation is declared supported.

#### TC-PARITY-005 - Every new behavior has a trap entry, a resolving fixture, and a projection

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-8, AC-F8-4, NFR-7
**Target Layer / Location**: **Per-entry authoring and assertions** — `tests/fixtures/providers/traps/github.traps.json` and `tests/behaviour/providers/github-trap.test.ts`, both declared by each extending phase (1: landing guard, already-merged read-back; 2: CLI status recovery, CLI credential absence; 3: comment write carrier-free, content write never lands, seed precedence/token removal; 4: check timings, excerpt cap/truncation; 5: thread discussion caps), with the catalog pins in `tests/structure/trap-catalog.test.ts` (declared by phases 1–5). **Phase-7 completion roll-up** — `tests/conformance/mock-conformance.test.ts` (declared by phase 7), which imports the assembled catalog and the fixture registry as data and edits neither · **Tags**: @trap @fixtures
**Fixtures**: new four-field trap entries covering every new behavior — landing guard and already-merged read-back; CLI status recovery and CLI credential absence; check timings and excerpt cap/truncation; thread discussion caps; comment write carrier-free; content write never lands; seed precedence/token removal; `tests/boundaries/fixture-registry.json` (read as data; declared and edited by phase 2, not here); `tenant.json` (declared by the phases that extend it).
**Given** the assembled catalog, **When** the trap suite replays it, **Then** every entry passes, every `fixtureReference` resolves to a committed fixture, and each new entry's assertion fails when its named normalization is mutated (the existing mutation map is extended in the same commit that adds the entry). **Given** the assembled change, **When** the phase-7 roll-up runs, **Then** each of the seven new behaviors has both a catalog entry whose `fixtureReference` resolves and an executed (or declared-skip) conformance step with an expected projection, so neither half can be satisfied alone.
**Pass criterion**: `results.length` equals catalog entries; zero failures; each new entry has a named mutation; every `fixtureReference` resolves; the roll-up's behavior set equals the seven behaviors AC-F8-4 names, both directions; a mutation that drops an assertion, points at a missing fixture, or removes a behavior from either half fails naming it. **Staging**: phase 7 edits no trap file (`github.traps.json`, `github-trap.test.ts`, and `trap-catalog.test.ts` are declared and extended only by phases 1–5); the entry and its mutation land in the phase that owns the behavior, so the case is green at every boundary from the phase its last entry lands in.

#### TC-PARITY-006 - Zero network and zero child processes, with a firing guard

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-8, AC-F8-3, NFR-2, RSK-10
**Target Layer / Location**: `tests/conformance/support/fixtures.ts` (install both guards; declared by phase 2) + `tests/behaviour/providers/support.ts` (guard primitive beside `installThrowingFetchGuard`; declared by phase 2) + `tests/conformance/github-transport-parity.test.ts` (the firing-canary assertion site inside the mock tier; declared by phase 2) · **Tags**: @conformance @containment @guard
**Fixtures**: the guard canaries (`globalThis.fetch` throw precedent; a deliberate `spawn`/`execFile` canary).
**Given** the mock tier, **When** any test runs, **Then** a live network call throws and a live child-process spawn throws, and the suite's recorded counts are `{network: 0, childProcess: 0}`; **Given** a deliberate canary spawn inside a test, **Then** the guard throws naming the attempted command.
**Pass criterion**: both counters zero for the whole mock tier and the canary proves the guard is armed (non-vacuity); a mutation that disables the child-process guard fails the canary case. The guard covers `spawn`, `spawnSync`, `exec`, `execFile`, and `fork`. The shared installer is what arms every mock-tier suite, so no other suite needs editing to inherit the guard; `tests/conformance/mock-conformance.test.ts` is **not** named here because phase 2 does not declare it — any per-suite counter assertion added there belongs to phase 3, which declares it, and must not be required for this case to pass.

#### TC-PARITY-007 - Replay is deterministic across two runs

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-8, AC-F8-5, NFR-2
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts` (extend) · **Tags**: @conformance @determinism
**Fixtures**: `tenant.json`; injected fixed clock `2026-10-31T00:00:00Z`.
**Given** the same tenant replayed twice in one process, **When** the two reports are compared, **Then** flow/step order, statuses, skip kinds and reasons, projections, and bounded diagnostics are identical (timestamps excluded only if the artifact declares them fixed by the clock; otherwise they are identical too).
**Pass criterion**: byte-equal report bodies after removing nothing that carries declared meaning; a mutation introducing map-iteration nondeterminism or a real clock fails.

#### TC-PARITY-008 - The broken-adapter control still fires; gates are non-vacuous

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: F-8, AC-F8-1, NFR-7
**Target Layer / Location**: `tests/conformance/broken-adapter-control.test.ts` (extend for the ninth operation and zero-gap GitHub) + coverage-gate mutation controls in `tests/conformance/mock-conformance.test.ts` · **Tags**: @conformance @mutation @non-vacuity
**Fixtures**: the test-only corrupt registration wrapper.
**Given** the deliberately broken control, **When** the suite runs, **Then** it still fails with a bounded secret-free diagnostic naming the step; and mutations that (a) execute no supported step, (b) never encounter a declared gap, (c) declare a gap whose operation is executable, and (d) mark a supported operation skipped each fail the runtime coverage gate.
**Pass criterion**: control failure identity preserved; four gate mutations fail with the named provider/step; a mutation that makes the gate pass on an empty report fails the non-vacuity assertion.

#### TC-PARITY-009 - Pinned structural surfaces update exactly

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-8, AC-F8-6, NFR-8
**Target Layer / Location**: `tests/structure/provider-surface.test.ts` + `tests/structure/content-inventory.test.ts` + `tests/structure/inventory.json` (all declared by phase 5) · **Tags**: @structure @surface @inventory
**Contract-inventory half (declared split)**: the contract-inventory pair — `tests/structure/port-contract-inventory.test.ts` and `tests/fixtures/ports/v1-contract-inventory.json` — is declared and moved by **phase 1**, which lands the additive contract exports. Phase 5 reads it as a control and edits neither file, so this case's phase-5 slice stages only the three provider/subpath surfaces listed above.
**Fixtures**: `EXPECTED_SURFACE.github`; `EXECUTABLE_ALLOWANCES`; `inventory.json`; `v1-contract-inventory.json`.
**Given** the new exports and modules, **When** the structural suites run, **Then** the GitHub export list contains exactly the new adapter-local reader/constructor names plus their core-built types (no provider-native shape, no parallel view), the per-file executable inventory equals the actual file set with each new executable file allowlisted by name, and the contract inventory equals the contracts' exports exactly.
**Pass criterion**: both directions (missing and extra) fail by name; non-vacuity: the surface list is non-empty and the native-shape/parallel-view regexes are exercised by a planted name; a mutation exporting an unlisted helper or dropping a file from the inventory fails. The contract-inventory equality is asserted where it is staged (phase 1) and re-confirmed here as an unedited control, so a failure names that phase rather than asking phase 5 to edit a file it does not declare.

#### TC-PARITY-010 - Additive contract probes compile and exhaustiveness fails loudly

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-8, AC-F8-6, DM-1, DM-2, NFR-8
**Target Layer / Location**: `tests/types/pipeline-job-timings.type-test.ts` (new) and `tests/types/merge-delivery-request.type-test.ts` (new) — both declared by phase 1 · **Tags**: @types @contract
**No `provider-views` extension is claimed**: no phase declares `tests/types/provider-views.type-test.ts` for this change and that file carries no `PipelineJob` reference that would move, so the case does not name it (the plan's split-case note must drop the same sentence — §7.5).
**Fixtures**: type probes over `PipelineJob`, `ADAPTER_OPERATIONS`, and an exhaustive switch over operations.
**Given** the additive contract change, **When** typecheck runs, **Then** existing object literals without timings still compile (optional fields), the ninth operation is a member of the union, and an exhaustive consumer that omits it fails to compile — proven by an `@ts-expect-error` probe placed on a deliberately non-exhaustive switch.
**Pass criterion**: `TMPDIR=$PWD/tmp/tmpdir pnpm typecheck` green; the `@ts-expect-error` probe is used (a passing switch there fails the suite), proving the union actually grew; no field was retyped or made required.

#### TC-FLOOR-001 - Delivered GitHub trap/closeout/collection/inputs/credential suites stay green

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: AC-F8-1, AC-F1-3, AC-F6-4, NFR-7
**Target Layer / Location**: `tests/behaviour/providers/{github-trap,github-closeout,github-closeout-thread-authorship,github-collection,github-inputs,provider-credentials}.test.ts` — all read as **controls** (delivered suites; each is extended only by the phase that declares it and lands its behaviour) · **Tags**: @regression @provider
**Catalog-diff assertion home**: the "names frozen, exactly one declared outcome-text amendment" diff is authored in **phase 3** in `tests/structure/trap-catalog.test.ts` (declared by phase 3, the phase that makes the one amendment), and phase 7 re-confirms it by running that suite as a control. Phase 7 declares no trap file and edits none.
**Fixtures**: all delivered GitHub fixtures (unchanged byte-for-byte unless a declared additive expectation changes); `tests/fixtures/providers/traps/github.traps.json`.
**Given** the delivered suites, **When** run on the change branch, **Then** every case passes; every delivered trap entry keeps its exact `trapName` and `fixtureReference`; **exactly one** delivered `expectedNormalizedOutcome` is amended — `GH-ISSUE-TO-WORKITEM` gains "labelled `review`/`in-progress` issues resolve to `in-review`/`in-progress` by declared precedence, and an exact-case label equal to a declared `label-swap` token wins" appended to its text, same `trapName`, same four-field shape, owned by **plan phase 3** (the phase that lands the label-aware normalization and extends the catalog) — because leaving it frozen would age the catalog into a false statement. **Given** the delivered closeout transition case (`github-closeout.test.ts`), **When** `transitionWorkItem({ deliveryState: "done" })` runs, **Then** the exact oracle holds: request count 1, method `PATCH`, body exactly `{"state":"closed"}`, zero label requests (no label read and no label write), and success **even when the label signal is unavailable** — the delivered terminal write stays byte-identical and gains no refusal path.
**Pass criterion**: zero failures; the delivered trap-name list is unchanged as a list (names frozen) with exactly one declared outcome-text amendment, asserted by an explicit diff so a second silent amendment fails; the closeout oracle asserted on the recorded request (count, method, body, label-request count 0) rather than on prose; the delivered mutation map still fails on its named mutations; a suite "fixed" by deleting or renaming a delivered assertion, or by dropping the label-aware sentence from `GH-ISSUE-TO-WORKITEM`, is a blocking finding.

#### TC-FLOOR-002 - GitLab/Jira posture changes only by the new merge gap

**Scenario Type**: Regression · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: AC-F1-2, AC-F1-3
**Target Layer / Location**: `tests/behaviour/providers/{gitlab-trap,jira-trap,jira-queries,provider-capabilities}.test.ts`; `tests/fixtures/providers/{gitlab,jira}/**` — read as **controls**. The only posture edits in this change land in the phases that declare `provider-capabilities.test.ts` and `tests/fixtures/ports/capabilities.ts` (phases 1 and 3); phase 7 edits neither · **Tags**: @regression @provider
**Fixtures**: delivered GitLab/Jira fixtures and expected postures.
**Given** the two adapters, **When** their suites run, **Then** they pass with only the added `merge-delivery-request` gap row and no fixture or expectation change elsewhere.
**Pass criterion**: green; the only diff in posture expectations is the declared gap; a mutation adding Jira support or removing a GitLab gap fails.

#### TC-FLOOR-003 - Three-provider conformance and the live read-only set unchanged

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: AC-F8-1, AC-F8-3
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts` and `tests/conformance/artifact.test.ts` (both declared by phase 7) + `tests/checks/conformance-workflow.test.ts` (read as a control; no phase edits it and its contract is unchanged) · **Tags**: @regression @conformance
**Fixtures**: all three tenants; `LIVE_READ_OPERATIONS`.
**Given** the three mock tenants, **When** the suite runs, **Then** all three replay green with the new step handled by declaration, `LIVE_READ_OPERATIONS` still contains exactly the three read operations, and the scheduled live workflow contract is unchanged.
**Pass criterion**: green; live set exact equality; a mutation adding a write to the live set fails `conformance-workflow`.

#### TC-FLOOR-004 - Secret-read and runtime-confinement boundaries stay exact

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: Critical · **Automation Level**: Automated
**Related IDs**: NFR-3, AC-F2-3
**Target Layer / Location**: `tests/checks/secret-read-boundary.test.ts`; `tests/boundaries/boundaries.test.ts` + `tests/boundaries/fixtures/cases.ts` + `.dependency-cruiser.cjs` — all four are **declared and edited by phase 2**, which lands the child-process edge; phase 7 runs them as controls and edits nothing · **Tags**: @security @boundary
**Fixtures**: `SECRET_READ_ALLOWLIST`; runtime-confinement negative fixtures.
**Given** the new child-process edge in the GitHub subpath, **When** the boundary suites run, **Then** the secret-read allowlist is unchanged with exactly one credential-material entry, the runtime-API confinement allowance keeps its exact-path reason-bearing form with the child invocation recorded in its comment, a child-process import outside the allowance fails naming the file, and `packages/core` remains free of `node:child_process`.
**Pass criterion**: allowlist count and entry exact; the planted out-of-allowance probe fails; `bun test tests/boundaries` green including the fixture-coverage meta-check (rule without a failing fixture is a gap).

#### TC-FLOOR-005 - No new error identity or contract export for adapter-local codes

**Scenario Type**: Regression · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: AC-F8-6, NFR-8, GAP-TP-6
**Target Layer / Location**: `tests/structure/error-table.test.ts`; `tests/checks/error-table-sync.test.ts` (both **satisfied as delivered** — no phase declares or edits them, because this change adds no error identity; a case that needed an edit there would be re-planned, not re-scoped) + `tests/structure/content-inventory.test.ts` (read as a control; declared and extended by the phases that add modules) · **Tags**: @error-table @structure
**Fixtures**: `ERROR_TABLE`, the closed error-code allowlist, the contract inventory.
**Given** the adapter-local probe codes and refusals, **When** the error table is inspected, **Then** no row exists for `provider.cli.*` or the workflow-map refusals, the counts (entries, delivered, documented, allowlist) are unchanged, and the contract export inventory gains only the declared additive members.
**Pass criterion**: exact count equality and zero `provider.cli.` rows; a mutation adding one row fails the sync arithmetic; documented behavior states the codes as adapter-local data (also asserted in `TC-REF-005`).

#### TC-FLOOR-006 - The aggregate gate is green

**Scenario Type**: Quality gate · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: NFR-8, AC-F8-6
**Target Layer / Location**: repository root · **Tags**: @gate
**Fixtures**: none.
**Given** the completed change, **When** `TMPDIR=$PWD/tmp/tmpdir pnpm check` runs, **Then** it exits `0` (lint, format:check, typecheck, test, boundaries, memory, prompt conformance, help coverage, exports parity).
**Pass criterion**: exit 0 with the command and result recorded in §10 and in the pm-notes; a narrow-suite pass never substitutes for this gate.

#### TC-FLOOR-007 - Scope boundaries hold: no merge rewiring, config, or contract reshape

**Scenario Type**: Regression · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: AC-F6-6, AC-F5-4, NFR-8, NG-1..NG-8
**Target Layer / Location**: `tests/structure/closeout-contract.test.ts` (extend), `tests/types/delivery-thread.type-test.ts`, `tests/types/status-additive-v1.type-test.ts`, and a source scan in `tests/structure/reference-behavior.test.ts` · **Tags**: @scope @contract
**Fixtures**: `DeliveryThread`/`DeliveryRequest`/`WorkItem` field probes; the merge transaction module's import graph; the config contract inventory.
**Given** the change, **When** the boundaries are inspected, **Then** the merge transaction imports no provider landing member and its behavior is unchanged, `DeliveryThread` and `DeliveryRequest` field sets are unchanged, no persistence schema or state migration exists, and no configuration surface was added.
**Pass criterion**: each invariant asserted by name; a mutation importing the landing member into the merge transaction or adding a `DeliveryThread.body` field fails the named assertion.

## 6. Environments and Test Data

- **Execution environment**: local dev / CI, offline. No `gh` binary, no network, no live token, and no real child process is required or permitted. `PATH` is irrelevant to the suites because every CLI interaction goes through the injected runner.
- **Runner and shell**: `bash`/`zsh` from the repository root; `bun` pinned by `.bun-version`; `pnpm` pinned by `packageManager`. Every gate uses a repository-local temp root via `TMPDIR=$PWD/tmp/tmpdir` (`tmp/` is git-ignored) so no test writes outside the tree.
- **Clock and identifiers**: injected fixed clock (`2026-10-31T00:00:00Z`, matching the delivered conformance suites) for every deterministic assertion; fixed fixture identities; no random UUIDs in expected values.
- **Credentials**: canary values only (`conformance-canary-credential-value` precedent, plus a token-shaped canary for the secret-hygiene cases). Canaries are non-secret strings and must not match the sanitization scanner's token/PII shapes at rest; token-shaped canaries used to prove redaction are constructed at runtime in a temp tree or in a string literal that the fixture audit is expected to allow inside `tests/behaviour/**` (the audit scans `tests/fixtures/providers/**` only).
- **Fixtures**: hand-authored synthetic JSON under `tests/fixtures/providers/**`. Every new or changed JSON fixture carries the provenance marker `"provenance": "hand-authored-synthetic 2026-11-17"` at top level. Only placeholders declared in `tests/fixtures/providers/sanitization/placeholders.json` may identify people or repositories; hosts are example/reserved (`github.example.com`, `api.github.com` only where a public literal is required). No email, avatar URL, private repository reference, bearer header, PEM key, or provider token shape may appear.
- **Fixture-decided surfaces**: where Appendix D leaves a provider detail open, exactly one fixture decides it (CLI stdout shape and version window, landing response, timestamp field names, log surface, thread entry point, the exact case-collision refusal detail string). Label-token casing is not in this list: matching is exact-case by decision, a case collision with a declared `label-swap` token refuses the read, and a case difference on a `field-update` token is not a collision. The fixture is committed, validated by the tenant/trap loaders where applicable, and referenced from the trap entry; the shape/cap/classification assertions never depend on which surface was chosen.
- **Isolation**: each mutation control copies the relevant tree into `mkdtemp` and cleans up; no test mutates a committed file; no module-level mutable state; the mock tier's guards are installed per suite and asserted after the run.
- **Test data authoring for caps**: cap fixtures are generated deliberately at the boundary (8191/8192/8193 bytes; 49/50/51 comments; 4095/4096/4097 bytes) and include at least one multi-byte character spanning the boundary, so a character-count implementation fails.

## 7. Automation Plan and Implementation Mapping

### 7.1 Suite Mapping

| Area | Test file(s) | Status | Cases |
|---|---|---|---|
| Capability posture | `tests/behaviour/providers/provider-capabilities.test.ts`; `tests/fixtures/ports/capabilities.ts` | Existing – Update | TC-POSTURE-001, TC-POSTURE-002, TC-POSTURE-003 |
| CLI transport | `tests/behaviour/providers/github-cli-transport.test.ts` (new); `tests/behaviour/providers/support.ts` (runner seam) | New | TC-CLI-001, TC-CLI-002, TC-CLI-003, TC-CLI-004, TC-CLI-005, TC-CLI-006, TC-CLI-007, TC-CLI-008, TC-CLI-009, TC-CLI-010, TC-CLI-011, TC-CLI-012, TC-CLI-013, TC-CLI-014, TC-CLI-015 (the two process-edge cases build their own `PATH` in `tmp/tmpdir` and need no shared helper) |
| Cross-transport parity | `tests/conformance/github-transport-parity.test.ts` (new) | New | TC-CLI-005 (phase 2 authors the seven-route table over the operations whose members exist after phase 1; phase 3 extends the **same** table with the comment-write and content-write routes — declared split, one case id) |
| Landing | `tests/behaviour/providers/github-landing.test.ts` (new); `tests/types/merge-delivery-request.type-test.ts` (new) | New | TC-LAND-001, TC-LAND-002, TC-LAND-003, TC-LAND-004, TC-LAND-005, TC-LAND-006, TC-LAND-007, TC-LAND-008 |
| Check timings + excerpt | `tests/behaviour/providers/github-evidence.test.ts` (new); `tests/types/check-log-excerpt.type-test.ts` (new); `tests/conformance/artifact.test.ts` (extend) | New + Existing – Update | TC-CHECK-001, TC-CHECK-002, TC-CHECK-003, TC-CHECK-004, TC-CHECK-005, TC-CHECK-006, TC-CHECK-007, TC-CHECK-008, TC-CHECK-009, TC-CHECK-010, TC-CHECK-011, TC-CHECK-012 |
| Thread discussion | `tests/behaviour/providers/github-thread-discussion.test.ts` (new); `tests/behaviour/providers/github-closeout-thread-privacy.test.ts` (extend); `tests/types/delivery-thread.type-test.ts` (new) | New + Existing – Update | TC-THREAD-001, TC-THREAD-002, TC-THREAD-003, TC-THREAD-004, TC-THREAD-005, TC-THREAD-006, TC-THREAD-007, TC-THREAD-008, TC-THREAD-009, TC-THREAD-010, TC-THREAD-011 |
| Backlog writes + mapping | `tests/behaviour/providers/github-workflow-map.test.ts` (new); `tests/behaviour/providers/github-collection.test.ts` (extend); `tests/behaviour/providers/github-inputs.test.ts` (extend); `tests/behaviour/providers/github-closeout.test.ts` (extend: delivered terminal-write oracle); `tests/conformance/mock-conformance.test.ts` (content-write projections + direct update call); `tests/structure/config-contract.test.ts` (extend) | New + Existing – Update | TC-BACKLOG-001, TC-BACKLOG-002, TC-BACKLOG-003, TC-BACKLOG-004, TC-BACKLOG-005, TC-BACKLOG-006, TC-BACKLOG-007, TC-BACKLOG-008, TC-BACKLOG-009, TC-BACKLOG-010, TC-BACKLOG-011 |
| Reference behavior | `tests/structure/reference-behavior.test.ts` (new); `tests/fixtures/provider/reference-behavior.ts` (new locator) | New | TC-REF-001, TC-REF-002, TC-REF-003, TC-REF-004, TC-REF-005, TC-REF-006 |
| Launcher composition (check tier) | `tests/checks/install-launcher-installer.test.ts` (extend: recording `gh` stub in the shim factory, two injected-`PATH` arms) | Existing – Update | TC-BIN-057 |
| Conformance parity | `tests/conformance/mock-conformance.test.ts` (extend; phases 1, 3, 7 as their cases bind); `tests/structure/conformance-coverage.test.ts` (phase 1 stages the flow/step pin and landing-step registration; later phases read it as a control); `tests/conformance/broken-adapter-control.test.ts` (extend; phase 1); `tests/conformance/github-transport-parity.test.ts` (phase 2); `tests/conformance/support/fixtures.ts` (install both guards; phase 2); `tests/behaviour/providers/support.ts` (guard primitive; phase 2) | Existing – Update + New | TC-PARITY-001, TC-PARITY-002, TC-PARITY-003, TC-PARITY-004, TC-PARITY-005, TC-PARITY-006, TC-PARITY-007, TC-PARITY-008, TC-PARITY-009, TC-PARITY-010 |
| Structural surfaces | `tests/structure/provider-surface.test.ts`; `tests/structure/content-inventory.test.ts`; `tests/structure/inventory.json` (phase 5) — contract-inventory pair staged in phase 1: `tests/structure/port-contract-inventory.test.ts`; `tests/fixtures/ports/v1-contract-inventory.json` | Existing – Update | TC-PARITY-009, TC-PARITY-010 |
| Regression floor | `tests/behaviour/providers/{github-trap,github-closeout,github-collection,github-inputs,provider-credentials,gitlab-trap,jira-trap,jira-queries}.test.ts`; `tests/checks/{secret-read-boundary,error-table-sync}.test.ts`; `tests/boundaries/*` | Existing – No Change (must stay green) | TC-FLOOR-001, TC-FLOOR-002, TC-FLOOR-003, TC-FLOOR-004, TC-FLOOR-005, TC-FLOOR-006, TC-FLOOR-007 |
| Trap catalog | `tests/fixtures/providers/traps/github.traps.json` (extend); `tests/behaviour/providers/github-trap.test.ts` (extend assertions); `tests/structure/trap-catalog.test.ts` (extend pins) | Existing – Update | TC-PARITY-005 — entries, assertions, mutations, and the catalog-diff pin are authored by the phase that owns each behaviour (phases 1–5); the phase-7 completion roll-up runs in `tests/conformance/mock-conformance.test.ts` and edits no trap file |

### 7.2 Fixtures to Author

All new fixtures are sanitized, hand-authored synthetic JSON with the provenance marker `"provenance": "hand-authored-synthetic 2026-11-17"`; every `fixtureReference` in the trap catalog must resolve (asserted by `fixtureReferences`/trap validation).

| Path | Purpose | Cases |
|---|---|---|
| `tests/fixtures/providers/github/cli-argv.json` | Golden argv arrays per route (each with its expected `--hostname` identity), the declared `hostMapping` rows (`api.github.com` -> `github.com`; `github.com` and both GHES shapes unchanged), child-environment expectations (`base`, `configDirectory`, `stateDirectory`, `cacheDirectory`), forbidden argv substrings, version window and policy data. The comment-write and content-write rows are **transport-level** `ProviderRequest` → argv rows only (no client member exists for either operation in phase 2). | TC-CLI-001, 002, 003, 013 |
| `tests/fixtures/providers/github/cli-status-blocks.json` | `--include` stdout shapes: 200/201/204, 404, 401/403/500/503, a proxy preamble before the real response, two body-bearing blocks, a body containing a status-shaped line, an unparsable block, an empty body. Each case records why it exists, so the first-block rule is data rather than prose. | TC-CLI-004, 009, 005 |
| `tests/fixtures/providers/github/cli-process-edge.json` | The offline process edge: the stub `gh` script body (records argv, child environment and stdin; models `gh`'s XDG state fallback), its canned `--include` blocks, the declared instance-host → CLI-host pair, the scratch layout names, and per-case expected argv, stdin body and parsed `{status, body}`. | TC-CLI-014, 015 |
| `tests/fixtures/providers/github/cli-failures.json` | Runner failure modes: oversized output, timeout, non-zero exit with stderr canary, spawn `ENOENT`, version refusal, capability refusal, mid-run failure. | TC-CLI-006, 007, 008, 010, 012 |
| `tests/fixtures/providers/github/transport-parity-routes.json` | One declarative route table replayed through both transports. Phase 2 authors exactly the seven routes whose client members exist after phase 1 (`read-work-item`, `write-work-item`, `transition-work-item`, `read-delivery-request`, `read-pipeline-run` + list page, `resolve-delivery-thread`, `merge-delivery-request`); the comment-write and content-write routes (create and update) are appended in phase 3, where their members are created. | TC-CLI-005 |
| `tests/fixtures/providers/github/landing-responses.json` | Landing success with/without SHA, head mismatch 409, already-merged refusal + merged read-back true/false, 422/500/403, transport throw, refusal-without-truth. | TC-LAND-001..008 |
| `tests/fixtures/providers/github/check-run-timings.json` | Runs with both timestamps, completed run, started-only, none, incomplete run. | TC-CHECK-001, 002 |
| `tests/fixtures/providers/github/check-run-log-excerpt.json` | Empty, 8192, 8193, multi-byte boundary, prefix fidelity, 404, 401/403/500/503, thrown transport, malformed 2xx. | TC-CHECK-003..009 |
| `tests/fixtures/providers/github/thread-discussion.json` | 50/51 comments, 4096/4097 body, multi-byte body boundary, exact-50, 49-of-50, 50-of-51, body-truncated, zero-count empty, 404, provider-absent, 401/403/500, thrown transport, malformed 2xx. | TC-THREAD-001..007, 011 |
| `tests/fixtures/providers/github/issue-writes.json` | DM-9 create case (`pull-created`), create with default-absent draft, update case (`pull-updated`), the update-`404` classification case (`pull-update-not-found`: one request, `provider.payload.invalid`, `httpStatus: 404`), the three required-input omission refusals, comment create, the label-free `done` write expectation (`done-write-labelless`: one `PATCH` with body `{"state":"closed"}`, zero label requests, **on the labelless `open` fixture**), label swap before/after preserving unrelated labels, unmapped alias cases, case-collision and native-fallback read cases. | TC-BACKLOG-001, 002, 005, 006, 007 |
| `tests/fixtures/providers/github/workflow-map-cases.json` | Seed rows in precedence order; writable-set round-trip pairs (`done`, `in-review`, `in-progress`) each starting from an admitting read; the non-terminal `field-update` write-refusal case (`ready` via the `open` row); the **terminal-read write refusal** (`terminal-read-write-refusal`: a `label-swap` transition on a `done`-resolving issue, in a labelless and a labelled `closed` variant); the labelless pair (`labelless-open-issue` — meaningful for the unavailable-signal refusal, `labelless-closed-issue` — resolves `done` and refuses terminally); injected map; invalid maps covering every rejection rule (bad `systemName`, non-array/empty/non-object `states`, non-string and duplicate `nativeStatus`, unknown `deliveryState`/`transitionMechanism`, **duplicate alias**, **no `done` row**, **a `done` row that is `label-swap` rather than the `field-update` row on `closed`**); unmapped tokens/aliases; and the seven-row read-resolution truth table (`exact-case-twin` `in-progress`, `case-collision-label-swap` `In-Progress`, `case-variant-state-label` `CLOSED` on a `closed` issue **and on an `open` issue**, `unknown-labels` `change`/`bug`/vendor, `labelless-read`, `native-state-row-missing`). | TC-BACKLOG-003..008, 010, 011 |
| `tests/fixtures/provider/reference-behavior.ts` | The declared document locator and the expected table headers (including the host-mapping table), the documented host-mapping fixture pointer, and the child-environment variable list the drift suite compares with the machine values; one place to update if the doc path is confirmed differently (GAP-TP-2). | TC-REF-001..006 |
| `tests/fixtures/providers/traps/github.traps.json` (extend) | New four-field entries with `fixtureReference` for each new behavior, plus exactly one declared amendment to a delivered entry — `GH-ISSUE-TO-WORKITEM`'s `expectedNormalizedOutcome` gains the label-aware sentence, same `trapName`, same four-field shape, owned by plan phase 3. | TC-PARITY-005, TC-FLOOR-001 |
| `tests/fixtures/providers/conformance/github/tenant.json` (extend) | Routes + `expected` projections for the comment write, both content-write variants (create via the single registry step, update via the direct client call), and landing; existing six routes untouched. | TC-PARITY-001, 003, 004 |
| `tests/fixtures/ports/capabilities.ts` (extend) | `EXPECTED_SEED_POSTURES` with the ninth operation for all three adapters. | TC-POSTURE-001..003 |
| `tests/fixtures/ports/v1-contract-inventory.json` (extend) | New contract exports exactly as declared (only additive members). | TC-PARITY-009, TC-FLOOR-005 |
| `tests/structure/inventory.json` + `EXECUTABLE_ALLOWANCES` (extend) | New modules and their exact executable exports. | TC-PARITY-009 |

### 7.3 Fixture Sets Extended vs Authored

- **Extended**: `github.traps.json` (entries appended; delivered trap **names** and `fixtureReference`s frozen, with exactly one declared outcome-text amendment to `GH-ISSUE-TO-WORKITEM` in plan phase 3), `tests/fixtures/providers/conformance/github/tenant.json` (append-only routes/expected), `tests/fixtures/ports/capabilities.ts`, `tests/fixtures/ports/v1-contract-inventory.json`, `tests/structure/inventory.json`.
- **Unchanged by obligation**: `tests/fixtures/providers/sanitization/placeholders.json`, every other delivered GitHub trap fixture, `tests/fixtures/providers/github/issues.json` and the list fixtures, GitLab/Jira fixtures. A change to a delivered fixture outside the declared additive expectation — including a second unannounced trap-outcome edit — is a review finding.
- **Sanitization obligations for every new fixture**: top-level provenance marker; declared placeholders only; example/reserved hosts only; no bearer header, PEM key, provider token shape, email, avatar URL, or private repository reference; no absolute filesystem path. These are enforced by `tests/checks/fixture-sanitization.test.ts` (scan of `tests/fixtures/providers/**`) and `tests/checks/fixture-privacy.test.ts`; run them in the same gate pass as the new suites.

### 7.4 Gate Commands and Expected Signals

Every command runs from the repository root with the temp root inside the tree.

| # | Command | Expected signal on success | Failing signal |
|---|---|---|---|
| G1 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure` | exit 0; provider surface, inventory, contract inventory, conformance registry pins, error table, and reference-behavior agreement all pass | any named mismatch (`missing operation`, `unknown export`, `document row -> value`, `expected N flows`) |
| G2 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/providers` | exit 0; trap catalog, closeout, collection, inputs, credentials, CLI transport, landing, evidence, thread discussion, workflow mapping all pass | a named trap/case failure including the fixture reference |
| G3 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance` | exit 0; mock tenants, coverage gates, skip kinds, child-process and network guards, determinism, broken-adapter control | a vacuous-coverage or guard message naming the step/command |
| G4 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/checks` | exit 0; secret-read boundary, fixture sanitization/privacy, error-table sync, doc conformance, conformance workflow | a fingerprint with file/line or the offending field |
| G5 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/boundaries` | exit 0; depcruise rules, runtime confinement, fixture-coverage meta-check | the rule name and the violating import/file |
| G6 | `TMPDIR=$PWD/tmp/tmpdir pnpm typecheck` | exit 0; workspace typecheck plus `tests/types` probes (`merge-delivery-request`, pipeline-job timings, delivery-thread shape) | a type error naming the probe file and the missing/excess property |
| G7 | `TMPDIR=$PWD/tmp/tmpdir bun run scripts/checks/secret-read-boundary.ts` | `OK secret-read-boundary`, unchanged allowlist count, exactly one credential-material entry | a planted read or an allowlist drift with the reason missing |
| G8 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/checks/fixture-sanitization.test.ts tests/checks/fixture-privacy.test.ts` | exit 0; no new fixture finding | a fixture path, line, and detail |
| G9 | `TMPDIR=$PWD/tmp/tmpdir git diff --check` | no output, exit 0 | whitespace/conflict-marker finding |
| G10 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | exit 0 for lint → format → typecheck → test → boundaries → memory → prompt/help/exports parity | the first failing stage with its output |

Notes: G1–G9 are the narrow loop; **G10 is the binding completion gate** and is recorded in §10. A narrow-suite pass never substitutes for G10. No command requires network access or a live token; a command that attempts either fails through the guards rather than hanging.

### 7.5 Plan Coordination — Phase/File Bindings the Plan Must Carry

This plan binds every case to a target file its **owning phase declares**, or marks the file explicitly read-only (a control the owning phase does not edit). The following bindings are the ones the plan's scope lists and split-case notes must state; they are listed here so plan and test plan cannot diverge:

| Case | Owning phase | Editable target(s) — must be in that phase's scope | Read-only control(s) | Plan action |
|---|---|---|---|---|
| TC-CLI-005 | 2 | `tests/conformance/github-transport-parity.test.ts`, `tests/fixtures/providers/github/transport-parity-routes.json` | — | Add to the split-case notes: phase 2 authors the **seven-route** table (no comment or content-write route, because those members do not exist yet); phase 3 extends the same table with the comment-write and content-write routes. Ownership stays phase 2. |
| TC-PARITY-001 | 3 | `tests/conformance/mock-conformance.test.ts` | `tests/structure/conformance-coverage.test.ts` (pin and landing-step registration land in **phase 1**) | Record the split: phase 1 moves the flow/step pin, phase 3 makes the executed/gap tables true. |
| TC-PARITY-005 | 7 | `tests/conformance/mock-conformance.test.ts` (completion roll-up) | `github.traps.json`, `github-trap.test.ts`, `trap-catalog.test.ts` (entries/assertions/mutations authored in phases 1–5) | State that phase 7 edits **no** trap file and that each entry lands with the behaviour it covers. |
| TC-PARITY-009 | 5 | `tests/structure/provider-surface.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/inventory.json` | `tests/structure/port-contract-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json` (moved in **phase 1**) | Record the contract-inventory half as phase 1, not phase 5. |
| TC-PARITY-010 | 1 | `tests/types/pipeline-job-timings.type-test.ts`, `tests/types/merge-delivery-request.type-test.ts` | — | **Delete** the split-note sentence "the `provider-views` extension follows normalization in phase 4": no phase declares `tests/types/provider-views.type-test.ts` and the file carries no `PipelineJob` reference. |
| TC-BACKLOG-009 | 3 | `tests/structure/config-contract.test.ts`, `tests/checks/config-default-positions.test.ts` | — | The repo scan lives in `config-contract.test.ts`; it must not be placed in `tests/structure/reference-behavior.test.ts` (phase 6). |
| TC-FLOOR-001 | 7 | — (control runs) | all delivered GitHub suites; the catalog diff is authored in **phase 3** in `tests/structure/trap-catalog.test.ts` | Say that the "names frozen / exactly one amendment" diff is phase 3's assertion and phase 7 re-confirms it. |
| TC-FLOOR-002/003/004/005 | 7 | — (control runs) | GitLab/Jira suites, `conformance-workflow.test.ts`, the boundary and secret-read files (**phase 2**), the error-table suites and `content-inventory.test.ts` | Say which phase authors each control's assertions so no phase-7 edit is implied. |

Phase-3 obligation text must also be re-cited: the map validator's rejection set and its construction-time timing are **TDR-0034 §1 / spec DM-6**, asserted by `TC-BACKLOG-010` — not the other way round, as the current phase-3 goal text ("per TC-BACKLOG-010's invalid-map set") has it. Phase 3 must carry the terminal-read write refusal (spec AC-F6-4, TDR-0034 §3.2) in its transition-write obligation, and its fixture obligation must list the additions of §7.2: the `terminal-read-write-refusal` case, the `labelless-open-issue`/`labelless-closed-issue` pair, the duplicate-alias and `done`-row-shape invalid maps, and the `CLOSED`-on-an-open-issue truth-table row. Phase 2 must not be asked for `writeComment` or `writeDeliveryRequest`: its parity table and its argv rows are transport-level for those two operations only.

Every gate command in this plan carries the `TMPDIR=$PWD/tmp/tmpdir` prefix (G1–G10 and every per-case command in §5/§10); no case introduces a command without it.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk to the test strategy | Impact | Mitigation (how the plan fails visibly) |
|---|---|---|---|
| RSK-TP-1 | Appendix D leaves provider-surface details open; a case could pin a shape the delivery legitimately changes. | M | Every open detail is isolated in exactly one fixture; the shape/cap/classification assertions are independent of it. A different surface updates the fixture and expected value; a shape/cap change fails the named case (GAP-TP-1). |
| RSK-TP-2 | After GitHub's gaps close, the "every declared gap encountered" gate could become vacuous. | H | `TC-PARITY-001`/`TC-PARITY-008` assert per-adapter gap encounter and fail on an empty/never-encountered gap set; GitLab/Jira carry the gaps. A mutation that satisfies the gate with zero encountered gaps fails (GAP-TP-5). |
| RSK-TP-3 | The CLI suite spawns a real process or depends on a local `gh`, making it green on a developer machine and red (or silently skipped) in CI. | H | Every CLI case uses the injected runner; the child-process guard fails the mock tier on any live spawn; a missing runner throws naming the seam (GAP-TP-3). No conditional skip is permitted. |
| RSK-TP-4 | Golden argv is brittle across `gh` versions and gets regenerated blindly. | M | The version window is declared data and the argv mapping is one declared table; a version change updates data plus the fixture in one reviewed change. Regenerating a golden without a failing case is a review finding. |
| RSK-TP-5 | The doc↔declaration test passes vacuously because the parser finds nothing. | H | `TC-REF-002` asserts the parser extracted 9 operation rows, 3 adapter postures, and 3 caps before comparing; a parse yielding fewer fails; a one-digit mutation must fail and is part of the case. |
| RSK-TP-6 | Cap tests use ASCII only, so a character-count implementation passes. | M | Boundary fixtures include multi-byte sequences spanning the boundary; the byte length is measured with `Buffer.byteLength` (TC-CHECK-003, TC-THREAD-002). |
| RSK-TP-7 | Existing pins (3 flows/13 steps, 8-operation set, provider surface) are "updated to pass" without new assertions. | H | Every pin update is paired with a new assertion or mutation control (`TC-PARITY-001`, `TC-PARITY-009`, `TC-POSTURE-001`); a pin updated with no behavioral case is a review finding. |
| RSK-TP-8 | Adding evidence reads forces the provider surface to widen and the surface test is relaxed to accept anything. | M | `TC-PARITY-009` requires exact both-direction equality and keeps the native-shape/parallel-view rejections; a wildcard or prefix allowance in `EXPECTED_SURFACE` fails review. |
| RSK-TP-9 | Label-swap tests assert "unrelated labels survive" but miss the inverse failure (the declared token is not removed, or the array is replaced). | M | `TC-BACKLOG-005` asserts set equality of the whole written array, with mutations for both the omitted-removal and full-replace directions. |
| RSK-TP-10 | Redaction tests pass because rendering is empty rather than because redaction works. | M | Every redaction case has a paired positive rendering the non-canary text; zero-canary and non-empty-output are both asserted. |
| RSK-TP-11 | Adapter-local probe/refusal codes leak into the error table or the contract export surface, expanding the contract silently. | M | `TC-FLOOR-005` pins zero `provider.cli.*` rows and exact counts; the reference-behavior test asserts the codes are documented as adapter-local data. |
| RSK-TP-12 | The new child-process edge weakens runtime confinement without a failing fixture. | M | `TC-FLOOR-004` asserts the exact-path allowance, the recorded meaning, a core-side negative probe, and the fixture-coverage meta-check. |
| RSK-TP-13 | Conformance projection drift is masked by updating `tenant.json` expected values to whatever the client returns. | H | Projections are asserted as declared expected values with a per-step mutation; `TC-PARITY-003`/`004` fail naming the step when the projection differs, and review compares the expected values to the spec's documented faces. |
| RSK-TP-14 | A test reads the ambient environment or the operator's `gh` config and accidentally uses a real credential. | H | Environment is constructed, never inherited for credential material; canaries only; `TC-CLI-003` asserts the isolated config directory; `G7` keeps the secret-read boundary exact. |
| RSK-TP-15 | The declared `GH-ISSUE-TO-WORKITEM` outcome amendment is silently skipped (the catalog ages into a false statement) or silently widened (a second delivered entry edited). | M | `TC-FLOOR-001` asserts the delivered name list is unchanged and exactly one `expectedNormalizedOutcome` moves, by explicit diff; a missing or extra amendment fails. |
| RSK-TP-16 | The decided exact-case rule is relaxed to case-insensitive matching, so `In-Progress` resolves instead of refusing and the visible typo signal disappears. | H | `TC-BACKLOG-008` includes a lower-case-both-sides mutation that must fail the collision row, plus the `CLOSED` row proving the rule is `label-swap`-scoped and an exact-case twin proving the row match is not vacuous. |
| RSK-TP-17 | The rejected "every transition sweeps declared lifecycle tokens" reading returns, silently adding a label read, a label write, and a refusal path to the delivered closeout write. | H | `TC-BACKLOG-006`'s paired half and `TC-FLOOR-001`'s exact closeout oracle (one `PATCH`, body `{"state":"closed"}`, zero label requests, success on an unavailable label signal) fail on any added label access or new refusal. |
| RSK-TP-18 | `GithubTransportSelection` drifts from composition data into a persisted/telemetry/readable surface, renders more than one diagnostic line, or an absent fact silently becomes `prefer-cli`. | M | `TC-CLI-011` asserts the exact DM-10 value per policy, exactly one rendered line naming the code, zero persisted copies, an unchanged composed-object key set, a zero-spawn/zero-line/zero-value absent-fact case, and mutation controls for each; `TC-FLOOR-005`/`TC-BACKLOG-009` keep the error table and configuration surfaces unchanged. |
| RSK-TP-19 | A pass criterion satisfies the terminal-read write refusal with the unavailable-label-signal refusal (or vice versa), so the terminal rule is never actually tested and AC-F6-3/NFR-11's symmetry claim stays false for a closed issue. | H | `TC-BACKLOG-006` pins the labelless fixture's native state to `open` for the signal refusal and asserts the **terminal** refusal's own detail on a `done`-resolving issue both with and without labels; `TC-BACKLOG-004` asserts both refusals from the write side; `TC-FLOOR-001` keeps the `field-update` `done` path refusal-free. A generic "refused" assertion fails these cases by construction. |

### 8.2 Assumptions

- The transport seam remains `ProviderTransport`; the CLI transport is a second implementation, and the client's request shaping/normalization is shared, so parity can be proven by replaying one route table.
- The CLI child runner is injectable at composition, so argv/environment/spawn counts can be asserted without a real process.
- The mock tenant can express the landing route and its expected projection through the existing declarative route/`expected` mechanism.
- The conformance suite can install a child-process guard beside the throwing-`fetch` guard without a new CI job (testing strategy: the mock tier rides `pnpm test`).
- Fixtures can express the boundary sizes (8 KiB text, 50 comments, 4 KiB bodies) as committed examples without becoming a "real" corpus.
- The delivered `tests/types` harness (`tests/types/tsconfig.json`) can host the new compile-time probes.
- Adapter-local refusal codes and evidence caps are exported as data so the reference-behavior test can compare them rather than restating numbers.
- The delivered GitHub trap harness's four-field entry contract and `fixtureReference` resolution are unchanged; entries are appended, and exactly one delivered `expectedNormalizedOutcome` (`GH-ISSUE-TO-WORKITEM`) is amended in place with the same `trapName`.
- The `write-delivery-request` registry entry stays one step (the closed operation set is nine); the create/update pair is proven by the behaviour suite plus a direct client call in the conformance suite, never by a second registry step.
- Composition selects a transport before the client is constructed; the selection is the resolver's return value consumed by the launcher, observable as data at that seam and through exactly one rendered diagnostic line, without widening any normalized view and without adding a readable surface to the composed program object. The fact is optional: when it is absent there is no value, no probe, and the delivered native-`fetch` transport serves, which is why delivered composition tests and embedders stay probe-free.

### 8.3 Open Questions

No blocking question remains. The specification declares no open question; the four decision records settle the contract choices. The items below are non-blocking `TO-CONFIRM` implementation details that the spec explicitly delegates to fixtures (Appendix D), each with a declared owner and a fail-visible resolution.

| ID | Question | Blocking? | Owner | Resolution path |
|---|---|---|---|---|
| OQ-TP-1 | The exact reference-behavior document path (GAP-TP-2). | No | delivery (phase 6) + doc-syncer (phase 7) | One locator constant in `tests/fixtures/provider/reference-behavior.ts`; if the path differs, update the locator and the index row in the same commit; a wrong/absent path fails `TC-REF-001` naming it. |
| OQ-TP-2 | The exact CLI version window, child-environment variable names, and status-block grammar (Appendix D). | No | delivery (phase 2) | Declared data in `cli-argv.json`; `TC-CLI-002/003/004` assert the declared values and the invariants (no secret, isolated dir, final status authoritative). A grammar change is a fixture+data update, not a shape change. |
| OQ-TP-3 | The exact landing response shape, already-merged variant, and check-run timestamp field names (Appendix D). | No | delivery (phases 1 and 4) | `landing-responses.json` and `check-run-timings.json` decide them; `TC-LAND-*`/`TC-CHECK-001/002` assert the spec-fixed semantics (verbatim, presence-honest, guard, read-back). |
| OQ-TP-4 | Which provider surface supplies log text and the per-thread discussion entry point/order (Appendix D). | No | delivery (phases 4 and 5) | `check-run-log-excerpt.json` and `thread-discussion.json` decide them; `TC-CHECK-*`/`TC-THREAD-*` assert bounded shape, caps, classification, and oldest-first order. |
| OQ-TP-5 | The exact wording of the `provider.payload.invalid` detail for a `label-swap` case collision (Appendix D). | No | delivery (phase 3) | The case rule itself is decided (exact-case matching; a case collision with a declared `label-swap` token refuses; a `field-update` token case difference does not), so `TC-BACKLOG-008` asserts the rule and only the detail string is fixture-decided. The detail must name the offending label and the declared token it collides with; a delivery that changes the rule fails the case. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-17 | @test-plan-writer | Initial test plan for GH-338. 81 cases across nine areas covering all 40 acceptance criteria (`AC-F1-1..AC-F8-6`), the seven consumed interfaces, the eight data-model elements, and NFR-1..NFR-11; traceability closed both directions with zero orphans; fixtures-to-author list, gate commands, and TO-CONFIRM handling recorded. |
| 1.1 | 2026-11-18 | @test-plan-writer | DoR iteration 1 remediation against spec v1.1 and TDR-0034 §3.1–§3.2; no case added or removed (81 TCs ↔ 40 ACs, zero gaps both directions). N2: `TC-PARITY-003` re-worded to one `write-delivery-request` registry step with both tenant routes/projections and the update proven by `TC-BACKLOG-002` plus a direct client call (`TC-CONF-008` pattern), and the oracle change declared instead of denied. N3: `TC-POSTURE-001` asserts set equality both directions (supported ∪ gaps == closed set, disjoint, no extras) and never declaration order. N4: the fixture/trap obligations and `TC-FLOOR-001` allow exactly one declared `GH-ISSUE-TO-WORKITEM` outcome-text amendment (four-field entry, same `trapName`) owned by plan phase 3. F4: `TC-BACKLOG-004` round-trips the writable set (`done`, `in-review`, `in-progress`) and adds the non-terminal `field-update` (`ready`) write refusal; `TC-BACKLOG-005` scopes token removal to `label-swap` rows; `TC-BACKLOG-006` scopes the refusal to `label-swap` and adds the `done` paired half (one state-only `PATCH`, zero label requests, no refusal on an unavailable signal). F5: `TC-BACKLOG-008` rewritten as the six-row read-resolution truth table — `CLOSED` is native fallback (not a refusal), only an `In-Progress`-style case collision with a declared `label-swap` token refuses, unknown labels/labelless resolve natively, exact-case twin resolves, anti-vacuity lower-case mutation fails — re-pointed from AC-F6-5 to AC-F6-2, with the §3.1 rows for AC-F6-2/AC-F6-4/AC-F6-5 and the §3.2 API-6/API-7/DM-6 rows corrected. Closeout: `TC-FLOOR-001` carries the exact delivered oracle (request count 1, `PATCH`, body `{"state":"closed"}`, zero label requests, success on an unavailable signal). F1: `TC-BACKLOG-002` asserts the DM-9 create shape and the update variant separately, including the required-field omission refusal with zero provider requests. F6: `TC-CLI-011` asserts DM-10's `policy`/`selected`/`degradation.code`, exactly one rendered diagnostic line, and zero persisted copies. Fixtures: `workflow-map-cases.json` gains the six read-outcome cases plus writable-set pairs and the non-terminal refusal; `issue-writes.json` gains the label-free `done` write expectation and the DM-9 cases. Appendix D alignment: label casing removed from the fixture-decided class and the `TO-CONFIRM` list (only the collision detail string remains). |
| 1.2 | 2026-11-18 | @test-plan-writer | DoR iteration 2 remediation against spec **v1.2** and amended TDR-0034 (§1 rejection set and timing, §3.1 read outcomes, §3.2 mechanism scope including the terminal-read refusal). No case added or removed (81 TCs ↔ 40 ACs, zero gaps both directions). **R2**: `TC-CLI-005`'s route table is narrowed to the seven operations whose client members exist after phase 1 (`read-work-item`, `write-work-item`, `transition-work-item`, `read-delivery-request`, `read-pipeline-run` (list page included), `resolve-delivery-thread`, `merge-delivery-request`); the comment-write and content-write routes are declared a phase-3 extension of the **same** table under the same case id, and the non-vacuity check ties the table to the supported set at that boundary. `TC-CLI-002` marks the two gap-operation argv rows transport-level only; `TC-CLI-012` uses the landing/delivered write instead of a comment route; the claim that nothing blocks phase 2 is gone. **R6**: `TC-PARITY-006`'s assertion site moves to `tests/conformance/github-transport-parity.test.ts` (in phase-2 scope); `tests/conformance/mock-conformance.test.ts` is explicitly excluded and any counter assertion there is phase 3's. **R8** (sweep, 8 cases): `TC-BACKLOG-009`'s scan moves into `tests/structure/config-contract.test.ts` (phase 3); `TC-PARITY-001` and `TC-PARITY-002` re-bind `tests/structure/conformance-coverage.test.ts` to phase 1 as a read-only control; `TC-PARITY-009` re-binds the contract-inventory pair to phase 1; `TC-PARITY-010` drops the undeclared `provider-views` extension; `TC-PARITY-005` re-binds its phase-7 half to `tests/conformance/mock-conformance.test.ts` and declares the trap files phases 1–5 only; `TC-FLOOR-001` moves the catalog diff to phase 3's `trap-catalog.test.ts`; `TC-FLOOR-002/003/004/005` and `TC-THREAD-009` mark every delivered file a read-only control with its authoring phase named. **R11**: `TC-BACKLOG-008` gains the `open` + `CLOSED` → `ready` (native fallback, never a refusal) row, making the truth table seven rows, plus a mutation for it. **TC-BACKLOG-010** restates the real mechanism — validation once at construction on the resolved map, failure captured not thrown, first operation returns `provider.payload.invalid` naming the failed check and offending row with zero provider requests, nothing fails at import — cites TDR-0034 §1 as the authority, and extends `invalid-maps` with a duplicate-alias case and a `done` row that is `label-swap` (not the `field-update` row on `closed`). **R1**: `TC-BACKLOG-004` adds the terminal-read write refusal (a `label-swap` write on a `done`-resolving issue refuses with zero provider requests, labelless and labelled, proving label-independence) and re-states the round-trip as "where the map admits the write"; `TC-BACKLOG-006` pins the labelless fixture to native `open`, adds the labelless `closed` variant, and makes the two refusals distinguishable by their details; AC references corrected so AC-F6-4 owns both refusals and AC-F6-3 is symmetry-where-admitted. **R3/R4**: `TC-CLI-011` states the DM-10 observable exactly as spec v1.2 does (resolver value deep-equalled, exactly one rendered line, zero persisted copies, unchanged composed-object key set, no new readable surface) and adds the absent-fact state (no probe, no value, delivered native-`fetch` transport) with the launcher always supplying the fact; `TC-REF-005`, `§3.1 AC-F2-2`, `§3.2 DM-6/DM-10`, `§3.3 NFR-11`, `§1.1`, `§8.2` and `RSK-TP-18` restated to match. New `§7.5` records the phase/file bindings and the plan edits they require; `RSK-TP-19` added for the two-refusal conflation risk. Gate commands remain `TMPDIR=$PWD/tmp/tmpdir`-prefixed. |
| 1.3 | 2026-11-18 | @coder (delivery remediation) | Review-iteration-1 remediation against the delivered code and spec v1.3. Three cases added (84 total, 40 ACs, zero gaps both directions): `TC-CLI-014` proves the real process edge — the production `execFile` runner drives an offline stub `gh` on an injected `PATH` through one read and one write and asserts recorded argv (including `--hostname github.com`, never `api.github.com`), one spawn per request, the credential absent from argv but present in the child environment, the stdin body, and the parsed `{status, body}`; `TC-CLI-015` proves the child environment absolute with and without an injected `TMPDIR` (`GH_CONFIG_DIR`/`XDG_CONFIG_HOME` sharing one config root, `XDG_STATE_HOME`/`XDG_CACHE_HOME` isolated, `HOME` never forwarded) and proves an empty scratch working directory stays empty, with the XDG-fallback negative control that would have caught the residue; `TC-BIN-057` proves the installed launcher's two composition branches offline on an injected `PATH` (a recording `gh` stub: exactly one probe per composing invocation and no degradation line; no `gh` at all: zero spawns, exactly one `provider.cli.unavailable` line, command still succeeds). Repins with unchanged meaning: `TC-CLI-002`'s golden argv now carries the declared host identity plus the `hostMapping` rows, `TC-CLI-003`'s pinned environment gains the absolute isolated roots and the unforwarded `HOME`, `TC-CLI-004` states the FIRST-status-block rule (a proxy preamble or a bodyless hop is skipped; a status-shaped body line is refused as `not JSON` rather than reclassified) and `TC-BACKLOG-002` gains the content-write `404` classification (one request, no retry, `provider.payload.invalid`, `httpStatus: 404`). `TC-BACKLOG-005` is restated to the delivered preservation semantics (one `PATCH` carrying the computed target set; the read-to-write limitation is declared) with assertions unchanged. §1, §4 and GAP-TP-3 are restated truthfully: nothing in the battery requires the host's `gh`, and the process edge is proven offline on an injected `PATH`. NFR-4 states the write-side `404` classification and NFR-2/NFR-3 name the check-tier arms and the absolute environment. No AC added or removed; no operation, cap, error identity, or configuration surface moves. |

## 10. Test Execution Log

No case has been executed at authoring time: this file was produced in `test_planning` (phase 3), before delivery. Rows are populated during delivery/quality gates with the exact command, exit code, and a one-line result summary; evidence for `G10` is also recorded as a pm-notes `notes:` entry.

| TC ID(s) | Run date | Command | Result | Notes |
|---|---|---|---|---|
| TC-POSTURE-001..003 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/providers/provider-capabilities.test.ts` | Not run | Pending delivery |
| TC-CLI-001..013 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/providers/github-cli-transport.test.ts` | Not run | Pending delivery |
| TC-CLI-005 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance/github-transport-parity.test.ts` | Not run | Pending delivery — phase-2 seven-route table, re-run in phase 3 over the extended table (comment-write and content-write routes) |
| TC-LAND-001..008 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/providers/github-landing.test.ts` | Not run | Pending delivery |
| TC-CHECK-001..012 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/providers/github-evidence.test.ts` | Not run | Pending delivery |
| TC-THREAD-001..011 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/providers/github-thread-discussion.test.ts` | Not run | Pending delivery |
| TC-BACKLOG-001..011 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/providers/github-workflow-map.test.ts` | Not run | Pending delivery |
| TC-REF-001..006 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure/reference-behavior.test.ts` | Not run | Pending delivery |
| TC-PARITY-001..010 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance` | Not run | Pending delivery |
| TC-FLOOR-001..005, 007 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/providers tests/checks tests/boundaries` | Not run | Pending delivery |
| TC-PARITY-010, TC-LAND-001/008, TC-CHECK-012, TC-THREAD-009 | — | `TMPDIR=$PWD/tmp/tmpdir pnpm typecheck` | Not run | Pending delivery |
| TC-FLOOR-006 (all) | — | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | Not run | Binding completion gate |
