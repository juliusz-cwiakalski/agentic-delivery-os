---
id: chg-GH-280-test-plan
status: Updated
created: 2026-11-10T14:30:00Z
last_updated: 2026-11-10T21:40:00Z
owners: [engineering]
service: delivery-os scheduling and pre-iteration hooks
labels: [change, hooks, scheduling, queue, status, doctor, cost-control]
version_impact: minor
summary: "Traceable verification of the GH-280 owner hold: one injected fact resolved from the brand-derived environment variable and the fixed production-store marker, a DM-1 example hook that sleeps indefinitely while held, a global read-only queue gate that suppresses next actions, refuses supplied-ref and no-ref claims and dispatches with queue.precondition.unmet/owner-hold, skips park auto-recovery, and preserves every record for resume, plus the additive providers.evidence.ownerHold member in the `status` digest — with `queue list`, `queue plan`, `lanes`, and `queue watch` reporting the hold on their own production surfaces — and the additive doctor owner-hold annotation reason on an otherwise-ok provider check, exercised at the command-runtime layer over an injected `DoctorComposition` because the production composer supplies none (D20). All 44 acceptance criteria map to 59 test cases (58 automated, one operator-run end-to-end evidence procedure) driven through injected facts, seams, temp HOMEs, and a materialized production-store marker with no real sleep, network, credential, production daemon, or harness session; the plan also pins every closed vocabulary, the lane-masking and queue-ready boundaries, the doctor detail clamp, the park blocking-array rule, and every golden/inventory update the change requires."
links:
  change_spec: ./chg-GH-280-spec.md
  implementation_plan: ./chg-GH-280-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Owner hold that outranks provider windows: pause lanes, not just defer

## 1. Scope and Objectives

This plan protects one operator-intent primitive and the closed vocabularies around it. The primitive is the owner-hold fact: a brand-derived environment variable whose non-empty value is the operator's reason, or a marker file named `owner-hold` at the fixed production store directory (`$HOME/.delivery-os-state` for the current product, whose default working name is `delivery-os`; the normative form is `<home>/<brand.stateDirectoryName>`), resolved with declared precedence, a bounded and sanitized reason, fail-closed marker handling, and no cache. The enforcement is a global read-only gate over that injected fact: while held, one scheduling pass emits no next actions and no preemption proposal, claim and dispatch refuse with the existing `queue.precondition.unmet` identity and the `owner-hold` reason, the mutating park-recovery pass is not invoked, and every record needed to resume is left byte-identical. The visibility is additive: one optional `providers.evidence.ownerHold` member in `status` and one `ok` provider detail plus the single new non-failing doctor annotation reason `owner-hold`, with no new section, no new status reason, no new verdict, no new summary count, no new condition, and no exit change. `status` carries the hold in its digest, and `queue list`, `queue plan`, `lanes`, and `queue watch` report it on their own read-only surfaces in production; the doctor surface reports it only when a `DoctorComposition` is supplied at the command-runtime layer, which the production composer does not supply (D20, GAP-T8).

The plan is shaped by four properties that cannot be allowed to pass behind one another:

1. **Fact integrity.** Two sources resolve to one discriminated fact; environment wins; an empty marker is active without a reason; an unreadable, non-regular, or stat-failing marker is active without a reason; a reason is one line, control-free, and at most 160 characters before any payload, line, or log; resolution reads no credential, writes no state, calls no network, and never caches across passes.
2. **Enforcement ordering and side-effect freedom.** The gate runs before parks, readiness conditions, ref selection for the no-ref claim, and the lease fence; a held pass writes zero entry, dependency, lease, park, incident, daemon-lane, handoff, attempt, divergence, or authority records; a dispatch refused by the hold creates no lease, session, branch, worktree, attempt, divergence, handover, or authority change.
3. **Resume without repair.** Removing the hold mutates nothing. The next pass sees an inactive fact and the delivered selection, claim, recovery, and session-resume paths run unchanged against the state captured at hold entry, so an overdue park recovers through the delivered pass and a recorded session is resumed rather than re-dispatched.
4. **Closed-vocabulary integrity.** Exactly one lane/blocking reason (`owner-hold`) and exactly one doctor evidence reason (`owner-hold`) are added. Nothing else moves: no park cause, condition type, cause-condition pairing, recovery state, state record kind, queue-ready condition, status section, status reason, doctor verdict, doctor summary count, doctor condition, doctor area, or doctor evidence source.

The most dangerous testing mistakes this plan is designed against are: proving the hold with a fact that a composition resolved once and cached; proving the claim gate only through the pre-fence precheck and never through the fenced claim; proving dispatch refusal without asserting the absence of every side effect; proving recovery was skipped by observing no new records while never seeding a park whose window actually expired; proving resume by asserting "no error" instead of comparing the pre-hold and post-resume records; proving status and doctor with hand-built section objects that bypass the runtime readers; and loosening or deleting a closed-set or golden assertion to make the additive change fit.

### 1.1 In Scope

- The owner-hold contract fact, its two sources, precedence, fail-closed marker outcomes, reason bounds and sanitization, per-resolution budget, per-pass re-resolution, the fixed production store directory (`$HOME/.delivery-os-state/owner-hold` for the current product, whose default working name is `delivery-os`; normative form `<home>/<brand.stateDirectoryName>/owner-hold`, no override), and the no-resolvable-home case (F-1, DM-1, DM-2, DM-9, DEC-7, DEC-8, D12; AC-F1-1..AC-F1-9, NFR-1, NFR-5, NFR-10, NFR-11).
- The DM-1 example hook `scripts/hooks/pre-opencode-iteration-owner-hold.sh`: the hold condition, the poll interval and its accepted range, the unbounded MAX driver, the bounded reason line, the pure-gate posture, removal latency, and clock-jump immunity (F-2, DEC-4; AC-F2-1..AC-F2-8, NFR-3, NFR-4, NFR-9).
- Install, uninstall, fixture, and shell-test registration of the new example, and the byte-stability of the SHA-pinned wrappers (F-3; AC-F3-1..AC-F3-4).
- The global queue gate: schedule suppression across ready, held, not-ready, active-park, stuck-park, resumable-park, and delivering-lane states; pre-fence and fenced claim refusal for supplied-ref and no-ref claims; dispatch claim-seam refusal with a bounded summary and a classified user-validation exit; a composed supervision cycle whose next-action seam derives from the held pass, and `queue watch`; park-recovery skip; lane masking; payload presence; bookkeeping; resume; unreadable queue facts (F-4, DM-3..DM-6, DEC-6, DEC-9, D13, D14, D19; AC-F4-1..AC-F4-11, NFR-2, NFR-4, NFR-7).
- The additive status providers **evidence** member (`providers.evidence.ownerHold`) and human suffix, CLI/MCP parity, and the unchanged nine sections / twenty reasons / schema version (F-5, DM-7, D15; AC-F5-1..AC-F5-4, NFR-6, NFR-14).
- The additive doctor `ok` detail and the single new non-failing annotation reason `owner-hold` (no evidence source, fourth and last provider reason), its insertion position, detail clamp, defect precedence, machine-delta-only behaviour, and byte-identical no-hold output, all at the command-runtime layer over an injected `DoctorComposition` (F-6, DM-8, DEC-10, D18, D20; AC-F6-1..AC-F6-4).
- The production CLI and MCP compositions that resolve and supply the fact to queue, lanes, claim, watch, dispatch, status, and the MCP status surface at the fixed production store directory (spec §16, RSK-6, D12, D22). The doctor surface is exercised only at the command-runtime/test-harness layer over an injected `DoctorComposition`; the production composer supplies none, so no production doctor claim is made (D20, GAP-T8).
- Documentation and conformance: the two-semantics distinction, the two-example registration, hook composition by MAX, the affected feature specs and command pages, `ados_distribution`, reference-page/help parity, forbidden literals, and the content/contract inventories (C7, C8, NFR-12, NFR-13; AC-DOC-1..AC-DOC-4).

### 1.2 Out of Scope & Known Gaps

- **[OUT] No kill-switch verification.** A hold never signals, kills, parks, or cleans up a mid-flight session or an already-`delivering` lane (NG-1, RSK-5). TC-HOLDQUEUE-012 asserts the lane stays `delivering` and is not signalled; it does not assert any cancellation behaviour.
- **[OUT] No new queue park, record, or ready condition.** No test defines, seeds, or expects a park cause, park condition type, recovery state, state record kind, or seventh queue-ready condition for the hold (NG-2, NG-3, NG-4, DEC-2). `queue ready` is unchanged and does not report the hold (D17); TC-HOLDQUEUE-009 asserts its payload is unchanged under a hold. TC-HOLDNEG-002 asserts the closed sets are unchanged.
- **[OUT] No new status section or reason.** The hold is an optional evidence-level member (`providers.evidence.ownerHold`) on the existing providers section; the nine sections and the twenty-reason set are pinned unchanged (NG-5, DEC-3, D15).
- **[OUT] No new doctor verdict, summary count, condition, source, or area.** The provider check stays `ok` while held; only the `owner-hold` non-failing annotation reason (no evidence source, fourth and last provider reason) and the appended detail segment are additive (NG-13, DEC-10, D18).
- **[OUT] No wrapper edits.** `scripts/deliver-ticket.sh`, `scripts/ceo-loop.sh`, and `scripts/batch-deliver.sh` are not changed, and `scripts/ceo-loop.sh` plus `scripts/.tests/test-hook-regression.sh` remain byte-identical under the delivered SHA-256 pin (NG-6, DEC-5).
- **[OUT] No real network, sleep, credential read, production daemon, or harness session.** Every automated case injects the clock, sleep, marker-reader, store, credential, transport, and session seams (NG-10). TC-HOLDE2E-001 is the only non-automated evidence and runs with a disposable `HOME`.
- **[GAP-T1 — one operator-run end-to-end proof]** The full "create the private state directory and the marker at the isolated HOME's production store directory → show `status` reporting it → `queue list`/`queue plan`/`lanes` reporting it and a refused no-ref claim → expired park stays parked → remove marker → resume with unchanged records and one session" sequence is TC-HOLDE2E-001, executed manually in a disposable clone/home and recorded in the pull request. It is the only case that exercises a real CLI process end to end; every automated case proves the same facts through the composed program or the delivered seams. The procedure exercises the production status digest and the production queue read surfaces (`queue list`, `queue plan`, `lanes`, and `queue claim` with no ref); production `doctor` is not composed, so the procedure has no doctor step (D20, GAP-T8), and the dispatch leg is conditional on a configured GitHub credential because the automated composition covers dispatch.
- **[GAP-T2 — real permission failures cannot be produced deterministically on every runner]** The real `chmod 000` marker case is skipped when the test process runs as root (root can read a `000` file); the deterministic permission-error case uses an injected filesystem fact that returns `EACCES`. The real non-regular marker case (a directory at the marker path) is always executable.
- **[GAP-T3 — the 4 096-byte read bound is observed at the reader seam]** TC-HOLDFACT-008 asserts the injected reader requests at most 4 096 bytes and performs one existence check and one read; it does not trace syscalls. The real adapter is additionally exercised over a 10 KB temp file to prove the produced reason is bounded and the extra bytes are not surfaced.
- **[GAP-T4 — no MCP queue surface exists]** The MCP server composes `status`, `verify-artifact`, and `gate-report` only. The queue/dispatch composition pin is therefore CLI-only (TC-HOLDEDGE-001); MCP parity covers `status` (TC-HOLDSTATUS-004, TC-HOLDEDGE-002).
- **[GAP-T5 — BSD/macOS portability is proven by construction, not by a runner]** The new shell example uses bash builtins for existence and read checks and no `stat`/`date -d`; the suite and shellcheck prove the construct, but no BSD runner is part of the automated battery.
- **[GAP-T6 — the reason-line grammar is pinned behaviourally]** The grammar is resolved by PM decision D9: `owner-hold (marker)` or `owner-hold (env)`, then `: reason` only when a reason is present, then `; sleeping Ns`. TC-HOLDHOOK-001/009 assert that grammar, the single-line shape, and the bounds; they do not pin a longer editorial sentence.
- **[GAP-T7 — the production resident daemon is not wired]** The production resident-daemon entry (`packages/cli/src/daemon-compose.ts`) defaults its `nextAction` seam to `() => undefined` and its `claim` seam to a permanent refusal; no production composition supplies those seams today. AC-F4-4 is therefore a **conditional** guarantee for a supervision cycle whose next-action seam derives from the held scheduling pass. TC-HOLDQUEUE-005 proves that derivation and its mutation control; TC-HOLDEDGE-001 does not claim production daemon wiring. The production daemon entry remains the resident-daemon spec's documented residual (D14, RSK-13).
- **[GAP-T8 — the production composer does not compose `doctor`]** `createProductionComposer` supplies no `DoctorComposition`, and `createConfigProgram` registers the `doctor` command only when `options.doctor` is defined; the production binary therefore rejects `doctor` as outside the composed prompt-required set. Every doctor case here (TC-HOLDDOCTOR-001..007, and the doctor leg of TC-HOLDQUEUE-013) exercises `createDoctorCommandRuntime` over an injected `DoctorComposition` at the command-runtime/test-harness layer. `status` carries the hold in its digest, and `queue list`, `queue plan`, `lanes`, and `queue watch` report it on their own production surfaces; `doctor` reports it only when a `DoctorComposition` is supplied at the command-runtime layer. Wiring production doctor is a pre-existing residual owned by the doctor feature, not by this change (D20). No case claims a production doctor composition, and TC-HOLDE2E-001 no longer runs `doctor`.
- **[Not applicable]** No schema migration, no telemetry exporter, no UI, no new endpoint, no new command, no new flag, and no new configuration key (NG-8, §19). No store relocation or marker-path override is introduced (D12).

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-280-spec.md`](./chg-GH-280-spec.md) | Authoritative source: F-1..F-6, 44 ACs (`AC-F1-1..AC-F6-4`, `AC-DOC-1..4`), NFR-1..NFR-14, DM-1..DM-9, DEC-1..DEC-10, Appendix A (precedence), Appendix B (queue gate), Appendix C (ticket traceability), Appendix D (doctor delta) |
| [`chg-GH-280-pm-notes.yaml`](./chg-GH-280-pm-notes.yaml) | Binding PM decisions D2–D11 (D1 is superseded by D12 for the marker path and its override clause; D3a is history), the DoR-1 remediation decisions D12–D19, and the review remediation decisions D20–D29 (with D30 adding the review-2 remediation plan phase), folded into DEC-1–DEC-10: two sources at the fixed production store directory, global gate not a park, evidence-level status member, dedicated example hook, no wrapper changes, refuse claims and skip recovery, no-ref claim gating, conditional supervision, exact closed-set pins, `queue ready` unchanged, detail clamp, deferral-vs-refusal semantics, doctor as a command-runtime capability, the temp-HOME production-composition test, and the park blocking-array rule |
| [`chg-GH-280-plan.yaml`](./chg-GH-280-plan.yaml) | The implementation plan exists and validates (`plan validate GH-280` verdict=valid). This plan owns the required test files and assertions; the implementation plan owns sequencing. If the plan places a case in a different phase, the assertion set here is unchanged. |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Layers, module→test mapping, `bun test`/`pnpm check`, fixture and invariant-test conventions, docs content checks |
| [`.ai/rules/bash.md`](../../../../.ai/rules/bash.md) | Strict mode, quoting, `readonly`, shellcheck discipline for the new example and suite |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict typing, injected fakes over module mocks, deterministic tests, no real clock/network/`$HOME`/sleep |
| [`scripts/hooks/pre-opencode-iteration-zai.sh`](../../../../scripts/hooks/pre-opencode-iteration-zai.sh) | The delivered DM-1 condition registry, MAX driver, seams, and loop cap the new example follows and deliberately does not copy |
| [`scripts/.tests/test-hook-zai-example.sh`](../../../../scripts/.tests/test-hook-zai-example.sh) | The delivered hermetic shell harness pattern: source the hook, override `_now_utc_epoch` and `_sleep`, `check`/`_run_capture`, temp dirs, zero real sleeps/network |
| [`scripts/install.sh`](../../../../scripts/install.sh) | `ADOS_HOOK_EXAMPLES` registration and the executable copy loop |
| [`scripts/uninstall.sh`](../../../../scripts/uninstall.sh) | The unconditional delivery-file removal list and the empty-directory cleanup |
| [`scripts/.tests/test-install.sh`](../../../../scripts/.tests/test-install.sh) / [`test-uninstall.sh`](../../../../scripts/.tests/test-uninstall.sh) | The fixtures that currently assume exactly one example hook |
| [`scripts/run-bash-suites.sh`](../../../../scripts/run-bash-suites.sh) | `*/.tests/test-*.sh` discovery that must find the new suite without an edit |
| [`packages/core/src/contracts/queue.ts`](../../../../packages/core/src/contracts/queue.ts) | `QUEUE_LANE_IDLE_REASONS`, `QUEUE_BLOCKING_REASONS`, park vocabularies, `QueueReadData` |
| [`packages/core/src/contracts/queue-ready.ts`](../../../../packages/core/src/contracts/queue-ready.ts) | The six queue-ready condition ids and their fixed order |
| [`packages/core/src/domain/queue-readiness.ts`](../../../../packages/core/src/domain/queue-readiness.ts) | `QueueSchedulerFacts`, the injected fact this change extends |
| [`packages/core/src/domain/queue-precedence.ts`](../../../../packages/core/src/domain/queue-precedence.ts) | The pure scheduling pass that must emit empty next actions and prepend `owner-hold` |
| [`packages/core/src/domain/queue-lease.ts`](../../../../packages/core/src/domain/queue-lease.ts) | `evaluateClaimPreconditions` and `claimQueueLease` — the pre-fence and fenced refusal points |
| [`packages/core/src/app/queue.ts`](../../../../packages/core/src/app/queue.ts) | `recoverQueueParks` (the mutating pass to skip) and the claim composition |
| [`packages/core/src/app/dispatch.ts`](../../../../packages/core/src/app/dispatch.ts) | `DispatchLeaseClaim` and the `kind: "queue"` refusal envelope |
| [`packages/core/src/app/daemon-supervision.ts`](../../../../packages/core/src/app/daemon-supervision.ts) / [`packages/cli/src/daemon-compose.ts`](../../../../packages/cli/src/daemon-compose.ts) | The supervision cycle whose injected `nextAction`/`claim` seams a composition supplies; the production entry defaults to `() => undefined` plus a permanent refusal and is the resident-daemon residual (GAP-T7) |
| [`packages/core/src/contracts/status.ts`](../../../../packages/core/src/contracts/status.ts) / [`packages/core/src/domain/status.ts`](../../../../packages/core/src/domain/status.ts) | `StatusSection`, `StatusEvidence` (the `ownerHold` target), `StatusProviderFacts`, `providersSection`, human rendering |
| [`packages/mcp/src/serve.ts`](../../../../packages/mcp/src/serve.ts) | The MCP status runtime that must compose the same reader as the CLI |
| [`packages/core/src/contracts/doctor.ts`](../../../../packages/core/src/contracts/doctor.ts) / [`packages/core/src/domain/doctor.ts`](../../../../packages/core/src/domain/doctor.ts) | `DOCTOR_EVIDENCE_REASONS`, `DoctorProviderFacts`, `providerCheck` |
| [`packages/cli/src/production.ts`](../../../../packages/cli/src/production.ts) | The production state-directory composition (`${home}/${brand.stateDirectoryName}`) at 281-302 |
| [`packages/cli/src/edge.ts`](../../../../packages/cli/src/edge.ts) | Queue facts, claim, dispatch claim seam, watch, and status composition |
| [`tests/structure/queue-scheduling-contract.test.ts`](../../../../tests/structure/queue-scheduling-contract.test.ts) / [`tests/fixtures/queue/vocabulary/closed-sets.json`](../../../../tests/fixtures/queue/vocabulary/closed-sets.json) | The closed-set equality pins this change updates deliberately |
| [`tests/structure/doctor-contract.test.ts`](../../../../tests/structure/doctor-contract.test.ts) | The exact doctor reason list, verdicts, counts, and catalog pin |
| [`tests/structure/status-contract.test.ts`](../../../../tests/structure/status-contract.test.ts) / [`tests/structure/queue-ready-contract.test.ts`](../../../../tests/structure/queue-ready-contract.test.ts) | The status and queue-ready vocabulary pins that must stay unchanged |
| [`tests/structure/inventory.json`](../../../../tests/structure/inventory.json) / [`tests/fixtures/ports/v1-contract-inventory.json`](../../../../tests/fixtures/ports/v1-contract-inventory.json) / [`tests/structure/content-inventory.test.ts`](../../../../tests/structure/content-inventory.test.ts) | The source-file, contract-export, and executable-declaration inventories that move for the new contract/domain files |
| [`tests/golden/queue-{list,plan,envelope,lease-conflict,rank,ready}.test.ts`](../../../../tests/golden) | Queue payload goldens that must stay byte-identical when the hold is inactive |
| [`tests/golden/status-digest.test.ts`](../../../../tests/golden/status-digest.test.ts) / [`tests/fixtures/status/golden/regenerate.ts`](../../../../tests/fixtures/status/golden/regenerate.ts) | Status goldens and their explicit regeneration command |
| [`tests/fixtures/mcp/parity/cases.ts`](../../../../tests/fixtures/mcp/parity/cases.ts) / [`tests/fixtures/mcp/regenerate.ts`](../../../../tests/fixtures/mcp/regenerate.ts) | MCP parity cases and the explicit golden writer |
| [`tests/golden/doctor-output.test.ts`](../../../../tests/golden/doctor-output.test.ts) / [`tests/fixtures/doctor/`](../../../../tests/fixtures/doctor) | Doctor goldens and fixtures |
| [`tests/structure/provider-surface.test.ts`](../../../../tests/structure/provider-surface.test.ts) | The SHA-256 pin for `scripts/ceo-loop.sh` and the legacy hook regression suite |
| [`doc/guides/delivery-modes.md`](../../../../doc/guides/delivery-modes.md) / [`doc/guides/zai-peak-hours-hook.md`](../../../../doc/guides/zai-peak-hours-hook.md) | The two guides that must state the two-semantics distinction and the MAX composition rule |
| [`doc/spec/features/feature-{autonomous-delivery,scheduling-engine,status-digest,doctor}.md`](../../../../doc/spec/features) | The feature specs reconciled after delivery |
| [`doc/planning/oss-tooling/milestones/m1/commands/{queue,status,doctor}.md`](../../../../doc/planning/oss-tooling/milestones/m1/commands) | The command reference pages under the reference-page/help parity pins |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

Every acceptance criterion appears exactly once in this forward table; no criterion is left to inference. Every test case in §5.1 carries its primary AC/F/NFR in the reverse direction.

| AC ID | Requirement (condensed) | TC ID(s) | Test file(s) | Layer | Automation |
|---|---|---|---|---|---|
| AC-F1-1 | Environment source active, source `env`, reason is the value, variable name is brand-derived prefix plus `_OWNER_HOLD` | TC-HOLDFACT-001, TC-HOLDFACT-011 | `owner-hold-fact.test.ts` | Unit | Automated |
| AC-F1-2 | Marker source active at the fixed production store directory's `owner-hold` (`$HOME/.delivery-os-state/owner-hold` for the current product; normative form `<home>/<brand.stateDirectoryName>/owner-hold`), source `marker`, reason is the first line; no other marker path is read | TC-HOLDFACT-002, TC-HOLDFACT-011 | `owner-hold-fact.test.ts`, `owner-hold-reader.test.ts` | Unit, Adapter | Automated |
| AC-F1-3 | Environment wins when both sources are active; the marker reason is unused | TC-HOLDFACT-003 | `owner-hold-fact.test.ts` | Unit | Automated |
| AC-F1-4 | Empty environment is inactive; whitespace-only environment is active without a reason | TC-HOLDFACT-004 | `owner-hold-fact.test.ts` | Unit | Automated |
| AC-F1-5 | Existing zero-byte marker is active with source `marker` and no reason | TC-HOLDFACT-005 | `owner-hold-fact.test.ts`, `owner-hold-reader.test.ts` | Unit, Adapter | Automated |
| AC-F1-6 | Unreadable, directory-at-path, or stat-failing marker is active with source `marker` and no reason; never inactive | TC-HOLDFACT-006 | `owner-hold-fact.test.ts`, `owner-hold-reader.test.ts` | Unit, Adapter | Automated |
| AC-F1-7 | Newline, tab, ANSI escape, and over-160-character reason become one line, control-free, at most 160 characters | TC-HOLDFACT-007 | `owner-hold-fact.test.ts` | Unit | Automated |
| AC-F1-8 | No resolvable home directory plus empty environment is inactive with no ambient read; a set environment is active despite the missing directory; no store relocation is introduced | TC-HOLDFACT-010 | `owner-hold-fact.test.ts` | Unit | Automated |
| AC-F1-9 | Resolution performs zero network calls, zero credential reads, zero state writes, at most one existence check and one bounded marker read | TC-HOLDFACT-008, TC-HOLDFACT-009 | `owner-hold-fact.test.ts`, `owner-hold-reader.test.ts`, `owner-hold-production-composition.test.ts`, `owner-hold-composition.test.ts` | Unit, Adapter, Structure | Automated |
| AC-F2-1 | Active hold with the default poll echoes `300`, sleeps 300 s, and prints exactly one line naming `owner-hold`, the source, and the reason | TC-HOLDHOOK-001, TC-HOLDHOOK-009 | `test-hook-owner-hold-example.sh` | Shell | Automated |
| AC-F2-2 | No active hold echoes `0`, returns immediately, performs zero sleeps, and prints no deferral line | TC-HOLDHOOK-002 | `test-hook-owner-hold-example.sh` | Shell | Automated |
| AC-F2-3 | A hold persisting across 25 or more polls keeps sleeping and never logs a loop-cap warning | TC-HOLDHOOK-003 | `test-hook-owner-hold-example.sh` | Shell | Automated |
| AC-F2-4 | Poll `600` is accepted; `0`, `-1`, `abc`, `99999` echo `300` with exactly one bounded warning; unset, empty, and whitespace-only use `300` silently | TC-HOLDHOOK-004 | `test-hook-owner-hold-example.sh` | Shell | Automated |
| AC-F2-5 | Removing the marker during the first sleep makes the next evaluation echo `0` and the hook exit without a further sleep | TC-HOLDHOOK-005 | `test-hook-owner-hold-example.sh` | Shell | Automated |
| AC-F2-6 | A time-bounded condition at `3600` and the hold at `300` sleep `3600`; after the window ends the hold keeps sleeping `300` | TC-HOLDHOOK-006 | `test-hook-owner-hold-example.sh` | Shell | Automated |
| AC-F2-7 | The example writes no `ADOS_HOOK_ENV_V1` output, creates no file, and does not signal or kill a session | TC-HOLDHOOK-007 | `test-hook-owner-hold-example.sh` | Shell | Automated |
| AC-F2-8 | A clock jump forward or backward by a day does not change the hold decision or the per-iteration sleep duration | TC-HOLDHOOK-008 | `test-hook-owner-hold-example.sh` | Shell | Automated |
| AC-F3-1 | Local install creates the new example executable and inactive | TC-HOLDREG-001 | `test-install.sh` | Shell | Automated |
| AC-F3-2 | Local uninstall removes the new example and the empty `scripts/hooks/` directory while preserving an operator hook | TC-HOLDREG-002 | `test-uninstall.sh` | Shell | Automated |
| AC-F3-3 | The new hook suite passes with zero real sleeps and zero network calls; shellcheck reports zero findings | TC-HOLDREG-003 | `test-hook-owner-hold-example.sh`, shellcheck | Shell, Conformance | Automated |
| AC-F3-4 | `scripts/ceo-loop.sh` and the legacy hook regression bytes are unchanged under the pin | TC-HOLDREG-004 | `provider-surface.test.ts` | Structure | Automated |
| AC-F4-1 | Held pass: empty `nextActions`, no preemption proposal; `owner-hold` is prepended to every gated entry's ordered `blocking[]` — ready, held, not-ready, resumable, and active/stuck parks (`["owner-hold","parked:<cause>"]` and `["owner-hold","park-condition-stuck"]`) — while an active park stays `parked` with its cause, a stuck park stays `stuck` with `park-condition-stuck`, and the lane surface renders that park reason | TC-HOLDQUEUE-001, TC-HOLDEDGE-001 | `queue-hold-schedule.test.ts`, `owner-hold-composition.test.ts` | Behaviour, Structure | Automated |
| AC-F4-2 | `queue claim` with a supplied ref **or no ref** refuses `queue.precondition.unmet` with the blocking-reason token exactly `owner-hold` **before ref selection (never `no-eligible-action`)** and a bounded detail `owner hold active (source): reason`, exits 1, appends zero records; the fenced path refuses too | TC-HOLDQUEUE-002, TC-HOLDQUEUE-003, TC-HOLDNEG-001, TC-HOLDEDGE-001, TC-HOLDE2E-001 | `queue-hold-claim.test.ts`, `error-table-sync.test.ts`, `owner-hold-composition.test.ts` | Behaviour, Checks, Structure | Automated + Manual (E2E) |
| AC-F4-3 | Dispatch refuses with `queue.precondition.unmet`, a bounded summary naming the hold, and a classified user-validation refusal at exit 1 (wait/do-not-abort for deferral callers); zero leases, sessions, branches, worktrees, attempts, divergences, handover records, and authority changes | TC-HOLDQUEUE-004, TC-HOLDEDGE-001, TC-HOLDE2E-001, TC-HOLDNEG-001 | `queue-hold-dispatch.test.ts`, `owner-hold-composition.test.ts` | Behaviour, Structure | Automated + Manual (E2E) |
| AC-F4-4 | A supervision cycle **whose next-action seam derives from the held scheduling pass** gets no next action and refuses the claim; `queue watch` streams the hold with an empty action list and claims nothing; zero daemon-lane records. The production resident-daemon entry is not claimed as wired (D14/GAP-T7) | TC-HOLDQUEUE-005, TC-HOLDQUEUE-006 | `queue-hold-daemon-watch.test.ts` | Behaviour | Automated |
| AC-F4-5 | A park whose window expired during the hold appends zero `clear-observed`, `recovered`, and incident records; its bytes are unchanged; the entry is not claimed | TC-HOLDQUEUE-007, TC-HOLDE2E-001 | `queue-hold-park-resume.test.ts` | Behaviour | Automated + Manual (E2E) |
| AC-F4-6 | Removing the hold leaves entries, leases, parks, incidents, daemon lanes, handoffs, and lane identities unchanged; the overdue park recovers through the delivered pass; a recorded session resumes with no duplicate | TC-HOLDQUEUE-008, TC-HOLDE2E-001 | `queue-hold-park-resume.test.ts` | Behaviour | Automated + Manual (E2E) |
| AC-F4-7 | Inactive list/plan/read payloads have no `ownerHold` and are byte-identical; active payloads carry source and optional reason. A held `lanes` surface renders `owner-hold` as its single reason for idle lanes (masking the specific `blocking[0]` reason) and the park reason for parked/stuck lanes, `queue list` retains the full ordered `blocking[]` (including `owner-hold` first on active and stuck parks), and `queue ready` is unchanged and carries no hold | TC-HOLDQUEUE-001, TC-HOLDQUEUE-009, TC-HOLDSTATUS-005 | `queue-hold-schedule.test.ts`, `queue-hold-payload.test.ts`, `queue-list.test.ts`, `queue-plan.test.ts` | Golden, Behaviour | Automated |
| AC-F4-8 | `queue add`, `prioritize`, `dep`, and `release` still append their records while held and do not invoke park recovery; claim remains refused | TC-HOLDQUEUE-010 | `queue-hold-claim.test.ts` | Behaviour | Automated |
| AC-F4-9 | Park condition types, causes, pairing, recovery states, record kinds, and the six ready condition ids are unchanged; `owner-hold` is the only added lane/blocking reason, pinned by exact two-way ordered equality of `QUEUE_LANE_IDLE_REASONS` and `QUEUE_BLOCKING_REASONS` against `closed-sets.json` | TC-HOLDQUEUE-011, TC-HOLDNEG-002 | `queue-scheduling-contract.test.ts`, `queue-ready-contract.test.ts` | Structure | Automated |
| AC-F4-10 | A lane already `delivering` stays `delivering`, is not signalled or killed, and no partial-session cleanup is attempted | TC-HOLDQUEUE-012 | `queue-hold-park-resume.test.ts` | Behaviour | Automated |
| AC-F4-11 | An unreadable queue store still returns the delivered state failure at exit 2 with no hold-shaped payload; status and doctor still report the hold | TC-HOLDQUEUE-013 | `queue-hold-claim.test.ts`, `status-owner-hold.test.ts`, `doctor-owner-hold.test.ts` | Behaviour | Automated |
| AC-F5-1 | Active hold: the providers section's **evidence record** carries the additive `ownerHold` member (`providers.evidence.ownerHold`, a sibling of `sources[]`); state, counts, sources, reasons, truncation, and entries are unchanged; exit 0 with nine sections | TC-HOLDSTATUS-001, TC-HOLDSTATUS-002, TC-HOLDEDGE-001, TC-HOLDE2E-001 | `status-owner-hold.test.ts`, `owner-hold-composition.test.ts` | Behaviour, Structure | Automated + Manual (E2E) |
| AC-F5-2 | Human providers line ends with the `owner-hold: reason` token or the bare `owner-hold` token after a pipe separator, read from `providers.evidence.ownerHold`; the existing bounds hold | TC-HOLDSTATUS-003 | `status-owner-hold.test.ts` | Behaviour | Automated |
| AC-F5-3 | CLI and MCP produce the same evidence-level `providers.evidence.ownerHold` member over the same injected facts; the parity fixture matches | TC-HOLDSTATUS-004, TC-HOLDEDGE-002 | `mcp-status-parity.test.ts`, `owner-hold-composition.test.ts` | Behaviour, Structure | Automated |
| AC-F5-4 | Section order, states, evidence reasons, and schema version are unchanged; no section, state, source, reason, or finding code is added | TC-HOLDSTATUS-005, TC-HOLDNEG-002 | `status-contract.test.ts`, `status-digest.test.ts` | Structure, Golden | Automated |
| AC-F6-1 | Healthy provider + hold: `ok` verdict, non-failing `owner-hold` annotation reason (no evidence source, fourth and last provider reason), bounded hold segment appended to the existing detail, no hint, no condition-catalog entry, unchanged verdicts/counts, exit 0; at/near `DOCTOR_MAX_DETAIL_CHARS` the existing detail is truncated and the whole hold segment is kept. Exercised at the command-runtime layer over an injected `DoctorComposition`, never as a production claim (D20) | TC-HOLDDOCTOR-001, TC-HOLDDOCTOR-002, TC-HOLDDOCTOR-006, TC-HOLDDOCTOR-007 | `doctor-owner-hold.test.ts`, `doctor-contract.test.ts` | Behaviour, Structure (command-runtime) | Automated |
| AC-F6-2 | A provider defect keeps its own `fail`/`unreachable` verdict and reason; `owner-hold` is not added; exit 1 unchanged; status still shows the hold | TC-HOLDDOCTOR-003 | `doctor-owner-hold.test.ts` | Behaviour | Automated |
| AC-F6-3 | Held vs no-hold machine report differs only by the additive reason and detail; verdict, counts, evidence, catalog, and exit are identical | TC-HOLDDOCTOR-004 | `doctor-owner-hold.test.ts` | Behaviour | Automated |
| AC-F6-4 | Inactive hold: doctor machine and human output are byte-identical to the delivered behaviour | TC-HOLDDOCTOR-005 | `doctor-output.test.ts` | Golden | Automated |
| AC-DOC-1 | The delivery-modes guide states the two semantics and documents both sources, precedence, removal, fail-closed marker, poll interval, unbounded driver, and the mid-flight limit | TC-HOLDDOCS-001 | `owner-hold-doc.test.ts` | Conformance | Automated |
| AC-DOC-2 | The zai guide's extension section states MAX composition and that the hold keeps sleeping after every time-bounded window ends | TC-HOLDDOCS-002 | `owner-hold-doc.test.ts` | Conformance | Automated |
| AC-DOC-3 | The affected feature specs and command pages describe the gate, additive members, new reason, unchanged doctor surfaces, and explicitly deny a new park cause/record/ready condition/tenth section | TC-HOLDDOCS-003 | `owner-hold-doc.test.ts`, `reference-page-parity.test.ts`, `help-guide-coverage.test.ts` | Conformance | Automated |
| AC-DOC-4 | Every changed guides document declares `ados_distribution` and the drift guard passes | TC-HOLDDOCS-004 | `test-doc-distribution.sh` | Conformance | Automated |

Legend: *Unit* = `bun:test` pure contract/domain; *Adapter* = bounded reader over a real/injected filesystem; *Structure* = composition/closed-set/import pin; *Behaviour* = command/engine surface over injected facts; *Golden* = committed byte/structural fixture; *Shell* = `scripts/.tests/test-*.sh`; *Conformance* = `tests/checks/**` or a drift-guard script; *Manual* = operator-run evidence. Every automated case runs with no real network, sleep, credential, daemon, or harness session.

**Doctor execution scope (D20).** Every doctor case (`TC-HOLDDOCTOR-001..007` and the doctor leg of `TC-HOLDQUEUE-013`) runs `createDoctorCommandRuntime` over an injected `DoctorComposition` at the command-runtime/test-harness layer. The production composer supplies no `DoctorComposition`, so the production binary does not register `doctor`; no row here claims a production doctor composition; `status` carries the hold in its digest, the queue read surfaces report it, and `doctor` reports it only when a `DoctorComposition` is supplied at the command-runtime layer (GAP-T8).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No `API-*` identifier is added: the hold resolution performs no network call and changes no request shape (§8.1). No `EVT-*` identifier is added: no queue notification, capsule event, telemetry event, or hook-return message is introduced (§8.2). The data-model elements carry the coverage:

| ID | Element | TC ID(s) | Notes |
|---|---|---|---|
| DM-1 | `OwnerHoldFact` discriminated union and `OwnerHoldSource` (`env` \| `marker`) | TC-HOLDFACT-001..011 | The inactive arm is asserted to carry no `source` and no `reason`; the active arm always names its source |
| DM-2 | Owner-hold constants (`OWNER_HOLD_ENV_SUFFIX`, `OWNER_HOLD_MARKER_NAME`, `OWNER_HOLD_MAX_REASON_CHARS`, `OWNER_HOLD_DEFAULT_POLL_SECONDS`, `OWNER_HOLD_MAX_POLL_SECONDS`) | TC-HOLDFACT-001, TC-HOLDFACT-007, TC-HOLDHOOK-001, TC-HOLDHOOK-004 | Values read from the delivered contract, not duplicated as literals in tests |
| DM-3 | `QueueSchedulerFacts.ownerHold?` | TC-HOLDQUEUE-001, TC-HOLDEDGE-001 | Absent means inactive; the composition test pins that the production path supplies it |
| DM-4 | `QueueReadData.ownerHold?` (and inherited `QueueListData`/`QueuePlanData`) | TC-HOLDQUEUE-009, TC-HOLDSTATUS-005 | Present only when active; inactive payloads are byte-identical |
| DM-5 | `QUEUE_LANE_IDLE_REASONS` gains `owner-hold`; `QUEUE_BLOCKING_REASONS` inherits it | TC-HOLDQUEUE-001, TC-HOLDQUEUE-011, TC-HOLDNEG-002 | The closed-set fixture and the structural test move together; no park cause or condition exists |
| DM-6 | Claim/dispatch refusal (`queue.precondition.unmet`; blocking-reason token exactly `owner-hold`; bounded detail separately naming the source and reason; bounded dispatch summary) | TC-HOLDQUEUE-002, TC-HOLDQUEUE-003, TC-HOLDQUEUE-004, TC-HOLDNEG-001 | Identity, token, separately-named detail/summary, and zero records are asserted together; the token is never folded into the detail |
| DM-7 | `StatusEvidence.ownerHold?: { source; reason? }` on the providers section's evidence record (`providers.evidence.ownerHold`), and `StatusProviderFacts.ownerHold?` | TC-HOLDSTATUS-001..005 | Evidence-level sibling of `sources[]` (the `credentialPrerequisite` precedent), not a sibling of `chain`/`entries`/`parks`; present only when active; section state is unchanged |
| DM-8 | `DOCTOR_EVIDENCE_REASONS` gains `owner-hold` immediately after `park-credential-cause`; `DoctorProviderFacts.ownerHold?` | TC-HOLDDOCTOR-001..007 | The exact 23-value order is pinned; `owner-hold` has no evidence source, may co-occur with `ok`, and is the fourth and last provider reason; verdicts, counts, catalog, and exit are untouched; the clamp case is TC-HOLDDOCTOR-007. Doctor runs at the command-runtime layer only (D20) |
| DM-9 | Marker path is fixed to the production store directory's `owner-hold` (`$HOME/.delivery-os-state/owner-hold` for the current product; normative form `<home>/<brand.stateDirectoryName>/owner-hold`); the shell example defaults to the current product's names (`DELIVERY_OS_OWNER_HOLD`, `DELIVERY_OS_OWNER_HOLD_POLL_SECONDS`, `$HOME/.delivery-os-state/owner-hold`) and adopters edit those defaults on rename; it accepts no marker-path override or store relocation | TC-HOLDFACT-002, TC-HOLDFACT-008, TC-HOLDFACT-010, TC-HOLDHOOK-001, TC-HOLDEDGE-001, TC-HOLDREG-001, TC-HOLDREG-002 | The engine path is derived from the production home/brand, no caller-supplied path reaches it, and the negative is pinned |
| Ports | No new port member; `readOwnerHold?` readers are optional runtime hooks on status/queue compositions and on `DoctorComposition`/`createDoctorCommandRuntime` when a doctor composition is supplied; the marker read lives in `packages/adapters/src/file/owner-hold-marker.ts` | TC-HOLDEDGE-001, TC-HOLDEDGE-002, TC-HOLDFACT-008 | The port-contract inventory moves only for the new contract module's exports; the adapter module is registered in the source inventory; no production doctor composition is claimed (D20) |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Coverage note |
|---|---|---|---|
| NFR-1 | ≤ 1 existence check and ≤ 1 bounded marker read (≤ 4 096 bytes) per resolution; zero network, credential reads, state writes, process spawns | TC-HOLDFACT-008, TC-HOLDFACT-009 | Reader seam records the requested bound and the call counts; the zero-count recorder drives the real bounded reader over a recording filesystem port and asserts the exact call shape before the zero counts for credentials, transport, store writes, and spawns at the composition-shaped boundary; the real 10 KB file proves the extra bytes are not surfaced |
| NFR-2 | Zero queue entry, dependency, lease, park, incident, daemon-lane, heartbeat, handoff, attempt, divergence, or authority records written **because of hold resolution or gating** while held | TC-HOLDQUEUE-002..008, TC-HOLDFACT-009 | Store write counters are asserted at zero for hold-caused writes; the invocation audit ledger is explicitly not asserted. The composed supervision cycle is conditional (GAP-T7) |
| NFR-3 | A new iteration defers within one poll interval; default 300 s; accepted range 1–3 600 s | TC-HOLDHOOK-001, TC-HOLDHOOK-004 | The condition's echoed seconds are the determinism-safe proxy; no wall-clock wait occurs in tests |
| NFR-4 | After removal, the next pass permits eligible claims and the next hook evaluation returns `0`; no restart | TC-HOLDFACT-011, TC-HOLDHOOK-005, TC-HOLDQUEUE-008 | Re-resolution is proven with the same runtime/store instance |
| NFR-5 | Every rendered/persisted reason is one line, free of C0/C1 and ANSI escapes, and ≤ 160 characters | TC-HOLDFACT-007, TC-HOLDHOOK-009, TC-HOLDSTATUS-003, TC-HOLDDOCTOR-001, TC-HOLDDOCTOR-007 | Assertions run on produced values, not fixture text; no raw newline or terminal sequence reaches a human surface |
| NFR-6 | Identical injected facts and clock produce byte-identical queue payloads, status digests, doctor reports, and hook decisions | TC-HOLDQUEUE-001, TC-HOLDSTATUS-004, TC-HOLDHOOK-008 | Two runs with identical facts are compared byte-for-byte |
| NFR-7 | 100% of hold-refused dispatches carry `queue.precondition.unmet` and a bounded summary naming the hold and sanitized reason; the refusal classifies as user-validation at exit 1; zero new identities/kinds | TC-HOLDQUEUE-004, TC-HOLDNEG-001 | The dispatch envelope's `error.code` and `error.summary` are read together and the delivered classifier row is asserted |
| NFR-8 | Zero new park causes/types/recovery states/record kinds/ready conditions/status sections/status reasons/doctor verdicts; exactly 1 new lane/blocking reason and 1 new doctor evidence reason, pinned by exact two-way ordered equality for `QUEUE_LANE_IDLE_REASONS` and `QUEUE_BLOCKING_REASONS` against `closed-sets.json` | TC-HOLDQUEUE-011, TC-HOLDSTATUS-005, TC-HOLDDOCTOR-006, TC-HOLDNEG-002 | Exact ordered equality for both arrays, with the named additions only; the doctor reason is the one declared insertion |
| NFR-9 | The new example performs zero real sleeps and zero network calls in its test; deterministic under the overridden sleep seam; shellcheck zero findings | TC-HOLDREG-003 | A shadowed `sleep` marker proves no real sleep; a network canary proves no call |
| NFR-10 | 100% of unreadable, non-regular, or stat-failing marker outcomes resolve active with no reason; zero resolve inactive | TC-HOLDFACT-006 | Includes injected `EACCES`, a real directory-at-path, and an injected stat failure |
| NFR-11 | Zero new `process.env`/`Bun.env`/`Deno.env` reads or ambient filesystem reads in core; zero hardcoded brand/product literals; the ambient-globals check stays green | TC-HOLDFACT-010, TC-HOLDNEG-003 | Core receives the environment record, production store directory, and marker outcome as injected inputs |
| NFR-12 | Every changed closed set, payload shape, reason, and golden is updated deliberately; no assertion is deleted or weakened | TC-HOLDQUEUE-009, TC-HOLDSTATUS-005, TC-HOLDDOCTOR-005, §7.3, §7.4 | Mutation evidence in §7.4 proves each pin fires; review checks the diff for deleted assertions |
| NFR-13 | Every changed guides document declares `ados_distribution`; the drift guard passes | TC-HOLDDOCS-004 | `bash scripts/.tests/test-doc-distribution.sh` |
| NFR-14 | Read-only surfaces stay readable while held: `status`, `doctor`, `queue list`, `queue plan`, `lanes`, and `queue watch` report the hold; `queue ready` is unchanged and does not report it; `status` and `doctor` exit 0 and the hold never makes a check or section non-ok | TC-HOLDQUEUE-009, TC-HOLDQUEUE-013, TC-HOLDSTATUS-001, TC-HOLDDOCTOR-001 | Queue reads may exit 0 or the delivered state failure; status/doctor exit 0 with the hold (doctor via the injected command-runtime composition, D20); `queue ready` is byte-identical under a hold |

## 4. Test Types and Layers

| Layer | Framework / location | Pattern | Applied to |
|---|---|---|---|
| Unit (contract/domain) | `bun:test`; `tests/behaviour/owner-hold-fact.test.ts` | `*.test.ts` | Fact resolution, precedence, inactive arm shape, reason sanitizer and 160 bound, fail-closed matrix, no-cache (TC-HOLDFACT-001..011) |
| Adapter/edge contract | `bun:test`; `tests/behaviour/owner-hold-reader.test.ts` | `*.test.ts` | Bounded marker reader (`packages/adapters/src/file/owner-hold-marker.ts`) over a real temp HOME's production store directory, one existence check, one read, permission/stat/directory outcomes, 10 KB input (TC-HOLDFACT-006/008/009/010) |
| Structure / composition | `bun:test`; `tests/behaviour/owner-hold-production-composition.test.ts` (behavior) and `tests/structure/owner-hold-composition.test.ts` (secondary pin) | `*.test.ts` | The production composer over a temp HOME with a materialized `<stateDirectoryName>/owner-hold` marker drives queue list/plan, supplied-ref and no-ref claim, dispatch, and status behavior, with a marker-removal mutation control and environment-source control; the MCP status composition supplies the same fact; doctor is not part of the production program (D20); the composed supervision seam is conditional; ambient-free core; import/inventory pins (TC-HOLDEDGE-001/002, TC-HOLDNEG-003) |
| Behaviour (queue) | `bun:test`; `tests/behaviour/queue-hold-*.test.ts`, with modifications to `queue-lease.test.ts`, `queue-park.test.ts`, `queue-schedule.test.ts` | `*.test.ts` | Schedule suppression, supplied-ref/no-ref claim, fenced claim, dispatch seam, composed supervision/watch, recovery skip, resume, bookkeeping, payload presence, lane masking, `queue ready` unchanged, delivering lane, unreadable facts (TC-HOLDQUEUE-001..013) |
| Behaviour (status/doctor) | `bun:test`; `tests/behaviour/status-owner-hold.test.ts`, `tests/behaviour/doctor-owner-hold.test.ts` | `*.test.ts` | Providers evidence member, human suffix, section-state independence, MCP parity, doctor `ok` detail, defect precedence, machine delta, detail clamp, inactive byte-identity over `createDoctorCommandRuntime` and an injected `DoctorComposition` (TC-HOLDSTATUS-001..005, TC-HOLDDOCTOR-001..007) |
| Golden | `bun:test` reading committed fixtures; explicit regeneration scripts | `tests/fixtures/{queue,status,doctor,mcp}/golden/**` | Queue held payloads, status held corpus case, MCP status parity, doctor held output; inactive goldens stay byte-identical (TC-HOLDQUEUE-009, TC-HOLDSTATUS-004/005, TC-HOLDDOCTOR-004/005) |
| Shell | `bash`; `scripts/.tests/test-hook-owner-hold-example.sh`, `test-install.sh`, `test-uninstall.sh` | `test-*.sh` | Hook condition/driver, hermeticity, install/uninstall registration, fixture extension (TC-HOLDHOOK-001..009, TC-HOLDREG-001..003) |
| Conformance / checks | `bun:test`; `tests/checks/*.test.ts`; `scripts/.tests/test-doc-distribution.sh` | `*.test.ts`, `test-*.sh` | Closed vocabularies, error-table sync, doctor contract, inventories, doc content, forbidden literals, reference-page/help parity, distribution markers (TC-HOLDQUEUE-011, TC-HOLDDOCTOR-006, TC-HOLDNEG-001/002, TC-HOLDDOCS-001..004) |
| Manual | Disposable clone/state root; command transcript in the PR | — | TC-HOLDE2E-001 operator pause/resume evidence through `status` and the queue read surfaces; no production `doctor` |

Rules that bind every layer: `bun:test` only (never Jest/Vitest); fixtures never named `*.test.ts`; permanent suites assert current-tree properties, never a diff against a moving base branch; assertions state the value's meaning, not a count that grows; the aggregate gate is `pnpm check`; bash suites follow strict mode, quoting, `readonly`, and shellcheck.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC / F / NFR |
|---|---|---|---|---|---|
| TC-HOLDFACT-001 | Environment source activates with a derived variable name | Happy Path | Unit | High | AC-F1-1, F-1.1, DM-1, DM-2 |
| TC-HOLDFACT-002 | Marker source activates at the fixed production store path with its first-line reason | Happy Path | Unit | High | AC-F1-2, F-1.2, D12 |
| TC-HOLDFACT-003 | Environment wins when both sources are active | Edge Case | Unit | High | AC-F1-3, DEC-7 |
| TC-HOLDFACT-004 | Empty environment is inactive; whitespace-only is active without a reason | Edge Case | Unit | High | AC-F1-4, DEC-7 |
| TC-HOLDFACT-005 | Empty marker is active without a reason | Edge Case | Unit | High | AC-F1-5, DEC-7 |
| TC-HOLDFACT-006 | Unreadable, non-regular, and stat-failing markers fail closed | Negative | Unit/Adapter | High | AC-F1-6, NFR-10, RSK-1 |
| TC-HOLDFACT-007 | Reason is sanitized to one control-free line of at most 160 characters | Corner Case | Unit | High | AC-F1-7, NFR-5, RSK-8 |
| TC-HOLDFACT-008 | Marker resolution performs one existence check and one 4 096-byte read | Performance | Adapter | High | AC-F1-9, NFR-1 |
| TC-HOLDFACT-009 | Resolution reads no credential, writes no state, and calls no network | Negative | Unit/Structure | High | AC-F1-9, NFR-1, NFR-2, D29 |
| TC-HOLDFACT-010 | No resolvable home directory leaves only the environment source; no store relocation | Edge Case | Unit | High | AC-F1-8, NFR-11, D12 |
| TC-HOLDFACT-011 | The fact is re-resolved on every pass and never cached | Corner Case | Integration | High | AC-F1-1, AC-F1-2, NFR-4 |
| TC-HOLDHOOK-001 | Active hold sleeps the default poll and prints one reason line | Happy Path | Shell | High | AC-F2-1, NFR-3 |
| TC-HOLDHOOK-002 | Inactive hold returns immediately with no sleep and no line | Happy Path | Shell | High | AC-F2-2 |
| TC-HOLDHOOK-003 | The driver never applies a fixed loop cap while held | Corner Case | Shell | High | AC-F2-3, NFR-9, RSK-2 |
| TC-HOLDHOOK-004 | Poll interval accepts 1–3 600, silently defaults unset/empty/whitespace, and emits one warning on invalid | Negative | Shell | High | AC-F2-4, NFR-3 |
| TC-HOLDHOOK-005 | Removing the marker during a sleep ends the hold at the next evaluation | Edge Case | Shell | High | AC-F2-5, NFR-4 |
| TC-HOLDHOOK-006 | Conditions compose by MAX and the hold remains the floor | Corner Case | Shell | High | AC-F2-6, DEC-4 |
| TC-HOLDHOOK-007 | The hook is a pure gate: no env output, no file, no signal | Negative | Shell | High | AC-F2-7, NG-1 |
| TC-HOLDHOOK-008 | A day-long clock jump neither ends nor extends the hold | Edge Case | Shell | High | AC-F2-8, NFR-6 |
| TC-HOLDHOOK-009 | The sleep line is single-line, source-named, and bounded | Corner Case | Shell | High | AC-F2-1, NFR-5 |
| TC-HOLDREG-001 | Install names and installs both examples executable and inactive | Happy Path | Shell | High | AC-F3-1, DEC-4 |
| TC-HOLDREG-002 | Uninstall removes both examples and the empty hooks directory | Happy Path | Shell | High | AC-F3-2 |
| TC-HOLDREG-003 | The new suite is hermetic, auto-discovered, and shellcheck-clean | Regression | Shell/Checks | High | AC-F3-3, NFR-9 |
| TC-HOLDREG-004 | Pinned wrapper and legacy-suite bytes are unchanged | Regression | Structure | High | AC-F3-4, NG-6, DEC-5 |
| TC-HOLDQUEUE-001 | A held pass suppresses every next action, prepends `owner-hold` to every gated entry, and masks the idle-lane reason | Happy Path | Behaviour | High | AC-F4-1, AC-F4-7, DM-3, DM-5, D25 |
| TC-HOLDQUEUE-002 | Supplied-ref and no-ref claim refusals name `owner-hold` and append nothing | Negative | Behaviour | High | AC-F4-2, NFR-2, D13 |
| TC-HOLDQUEUE-003 | The fenced claim refuses before acquiring the fence | Negative | Behaviour | High | AC-F4-2, DM-6 |
| TC-HOLDQUEUE-004 | Dispatch refuses as a classified user-validation refusal with zero side effects | Negative | Behaviour | High | AC-F4-3, NFR-7, DEC-9, D19 |
| TC-HOLDQUEUE-005 | A composed supervision cycle derives no action from the held pass and claims nothing | Negative | Behaviour | High | AC-F4-4, NFR-2, D14 |
| TC-HOLDQUEUE-006 | `queue watch` streams the hold with empty actions and claims nothing | Negative | Behaviour | High | AC-F4-4, NFR-2 |
| TC-HOLDQUEUE-007 | Park auto-recovery is skipped and the park bytes are unchanged | Corner Case | Behaviour | High | AC-F4-5, DEC-6 |
| TC-HOLDQUEUE-008 | Removal resumes preserved state with no duplicate session | Regression | Behaviour | High | AC-F4-6, NFR-4, A-5 |
| TC-HOLDQUEUE-009 | Payload `ownerHold` is present only when active; inactive bytes and `queue ready` are unchanged | Corner Case | Golden | High | AC-F4-7, DM-4, D17 |
| TC-HOLDQUEUE-010 | Bookkeeping still works while held; claim does not | Edge Case | Behaviour | High | AC-F4-8, DEC-6 |
| TC-HOLDQUEUE-011 | Closed queue vocabularies move by exactly one lane reason, pinned by exact two-way equality | Regression | Structure | High | AC-F4-9, NFR-8, DM-5, D16 |
| TC-HOLDQUEUE-012 | A delivering lane is not signalled, killed, or parked | Negative | Behaviour | High | AC-F4-10, NG-1 |
| TC-HOLDQUEUE-013 | Unreadable queue facts still exit 2 with no fabricated hold payload | Negative | Behaviour | High | AC-F4-11, NFR-14 |
| TC-HOLDSTATUS-001 | Active hold adds the providers evidence member without changing the section | Happy Path | Behaviour | High | AC-F5-1, DM-7, D15 |
| TC-HOLDSTATUS-002 | The evidence member is attached across every providers section state | Edge Case | Behaviour | High | AC-F5-1, F-5.2, D15 |
| TC-HOLDSTATUS-003 | Human status appends the bounded owner-hold suffix from the evidence member | Happy Path | Behaviour | High | AC-F5-2, NFR-5, D15 |
| TC-HOLDSTATUS-004 | CLI and MCP status agree on the evidence member with an active hold | Happy Path | Behaviour | High | AC-F5-3, NFR-6, D15 |
| TC-HOLDSTATUS-005 | Status vocabulary is unchanged and no-hold output is byte-identical | Regression | Structure/Checks | High | AC-F5-4, AC-F4-7, NFR-8 |
| TC-HOLDDOCTOR-001 | Healthy provider + hold keeps `ok` and appends reason plus detail | Happy Path | Behaviour | High | AC-F6-1, DM-8 |
| TC-HOLDDOCTOR-002 | Healthy provider + hold without a reason names only the source | Edge Case | Behaviour | High | AC-F6-1 |
| TC-HOLDDOCTOR-003 | An existing provider defect wins and omits `owner-hold` | Negative | Behaviour | High | AC-F6-2, DEC-10 |
| TC-HOLDDOCTOR-004 | Held vs no-hold differs only by the additive reason and detail | Corner Case | Behaviour | High | AC-F6-3, NFR-8 |
| TC-HOLDDOCTOR-005 | Inactive hold output is byte-identical to the delivered goldens | Regression | Golden | High | AC-F6-4, NFR-12 |
| TC-HOLDDOCTOR-006 | The reason set is exactly 23 values; the annotation reason and other surfaces are closed | Regression | Structure | High | AC-F6-1, NFR-8 |
| TC-HOLDDOCTOR-007 | At the detail bound, the existing detail yields and the whole hold segment is kept | Corner Case | Behaviour | High | AC-F6-1, DM-8, D18 |
| TC-HOLDDOCS-001 | The delivery-modes guide states both semantics and the operational rules | Happy Path | Conformance | High | AC-DOC-1 |
| TC-HOLDDOCS-002 | The zai guide states MAX composition and the unbounded floor | Happy Path | Conformance | High | AC-DOC-2 |
| TC-HOLDDOCS-003 | Feature specs and command pages are reconciled and deny the forbidden additions | Happy Path | Conformance | High | AC-DOC-3 |
| TC-HOLDDOCS-004 | Every changed guide declares `ados_distribution`; drift guard passes | Edge Case | Conformance | High | AC-DOC-4, NFR-13 |
| TC-HOLDEDGE-001 | The CLI production composition supplies the hold to every production surface from a temp-HOME marker | Regression | Structure | High | AC-F4-1, AC-F4-2, AC-F4-3, AC-F5-1, RSK-6, D22 |
| TC-HOLDEDGE-002 | The MCP status composition supplies the same fact | Regression | Structure | High | AC-F5-3, DM-7 |
| TC-HOLDNEG-001 | No new error identity or domain kind; remediation prose is updated | Regression | Checks | High | AC-F4-2, AC-F4-3, NFR-7 |
| TC-HOLDNEG-002 | No new park, record, ready, status, or doctor vocabulary | Regression | Checks | High | AC-F4-9, AC-F5-4, AC-F6-1, NFR-8 |
| TC-HOLDNEG-003 | Core stays ambient-free and brand-literal-free | Regression | Checks | High | AC-F1-8, NFR-11 |
| TC-HOLDE2E-001 | Operator pause and resume evidence in a disposable HOME (`status` digest plus `queue list`/`queue plan`/`lanes` and a no-ref claim; dispatch conditional on a credential) | Manual | Manual | High | AC-F4-2, AC-F4-3, AC-F4-5, AC-F4-6, AC-F5-1 |

### 5.2 Scenario Details

#### TC-HOLDFACT-001 - Environment source activates with a derived variable name

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.1, F-1.5, AC-F1-1, DM-1, DM-2, DEC-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` (new) over the pure resolver in `packages/core/src/domain/owner-hold.ts` and the contract in `packages/core/src/contracts/owner-hold.ts`
**Tags**: @core, @unit

**Preconditions**:
- A synthetic brand whose `environmentPrefix` is not a hardcoded product literal.
- An injected environment record containing exactly the derived key (`brand.environmentPrefix` normalized once plus `OWNER_HOLD_ENV_SUFFIX`) set to `peak-hour cost pause`.
- No marker outcome (the marker is absent).

**Steps**:
1. Resolve the fact with the injected environment, production store directory, and absent marker outcome.
2. Read the resolved key name from the environment lookup recorded by the test double.
3. Repeat the resolution with a different synthetic brand prefix.

**Expected Outcome**:
- The fact equals `{ active: true, source: "env", reason: "peak-hour cost pause" }`.
- The looked-up key is exactly the brand-derived prefix plus `_OWNER_HOLD`; it is not a bare `OWNER_HOLD` and not a hardcoded product-name literal in core (the current product yields `DELIVERY_OS_OWNER_HOLD`).
- The second brand produces its own derived key and the same reason.

#### TC-HOLDFACT-002 - Marker source activates with its first-line reason

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.2, AC-F1-2, DM-1, DM-9, D12
**Test Type(s)**: Unit, Adapter
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` and `tests/behaviour/owner-hold-reader.test.ts` (new), the latter over a temp state root
**Tags**: @core, @adapter

**Preconditions**:
- An unset environment source.
- A temporary `HOME` whose production store directory is the brand state directory (`$HOME/.delivery-os-state` for the current product, whose default working name is `delivery-os`; the suite derives the directory from the brand rather than hardcoding it), containing a regular `owner-hold` file whose first line is `peak-hour cost pause` and whose later lines contain other text.
- A second marker file at a non-default path (for example under the temp working directory) with a different reason, as the negative control.

**Steps**:
1. Read the marker through the delivered bounded reader.
2. Resolve the fact from the reader outcome.
3. Assert the fact, the source, and the exact path the reader used.
4. Resolve with the non-default marker only and assert it is ignored.

**Expected Outcome**:
- The fact is `{ active: true, source: "marker", reason: "peak-hour cost pause" }`; later lines never contribute to the reason.
- The reader performed one existence check and one bounded read on exactly the production store directory's `owner-hold` entry; the non-default marker never activates the hold.
- No store-relocation override or marker-path override is consulted (D12).

**Notes / Clarifications**: The marker location is fixed to the production store directory (D12/DEC-7).

#### TC-HOLDFACT-003 - Environment wins when both sources are active

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.1, F-1.3, AC-F1-3, DEC-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` (new)
**Tags**: @core, @unit

**Preconditions**:
- The derived environment key is set to `environment reason`.
- A marker outcome is active with `marker reason`.

**Steps**:
1. Resolve the fact.
2. Swap only the marker reason and resolve again.

**Expected Outcome**:
- Both resolutions are `{ active: true, source: "env", reason: "environment reason" }`.
- The marker reason never appears in the fact; a marker-only variant resolves to the marker reason, proving the fixture is live.

#### TC-HOLDFACT-004 - Empty environment is inactive; whitespace-only is active without a reason

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.2, F-1.3, AC-F1-4, DEC-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` (new)
**Tags**: @core, @unit

**Preconditions**:
- Case A: the derived variable is present with `""`; no marker.
- Case B: the derived variable is present with `"   \t  "`; no marker.
- Case C: the variable is unset; no marker.

**Steps**:
1. Resolve each case.
2. Assert the discriminated arms and the presence of `reason`.

**Expected Outcome**:
- Case A and Case C resolve to `{ active: false }` with no `source` and no `reason` property.
- Case B resolves to `{ active: true, source: "env" }` with no `reason` property (the sanitized value is empty, so the reason is omitted while the hold remains active).

#### TC-HOLDFACT-005 - Empty marker is active without a reason

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.3, AC-F1-5, DEC-7
**Test Type(s)**: Unit, Adapter
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` and `tests/behaviour/owner-hold-reader.test.ts` (new)
**Tags**: @core, @adapter

**Preconditions**:
- The derived variable is unset.
- A zero-byte regular `owner-hold` file exists in the temp HOME's production store directory.

**Steps**:
1. Read the marker through the delivered reader.
2. Resolve the fact.
3. Assert that the active arm omits `reason` rather than carrying `""`.

**Expected Outcome**:
- The fact is `{ active: true, source: "marker" }`; `Object.hasOwn(fact, "reason")` is `false`.
- Presence, not content, is the hold.

#### TC-HOLDFACT-006 - Unreadable, non-regular, and stat-failing markers fail closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.4, AC-F1-6, NFR-10, RSK-1, D12
**Test Type(s)**: Unit, Adapter
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` and `tests/behaviour/owner-hold-reader.test.ts` (new)
**Tags**: @core, @adapter, @security

**Preconditions**:
- Four marker outcomes at the production store directory's `owner-hold` path: (a) an injected `EACCES` on open/read; (b) a real directory at the marker path; (c) an injected stat failure (`EIO`); (d) an injected read failure after a successful stat.
- The environment source unset in every case.
- A real `chmod 000` file case is added and skipped when `process.getuid?.() === 0`.

**Steps**:
1. Resolve each outcome through the pure resolver and the reader.
2. Assert the arm, source, and reason presence.
3. Assert that no outcome resolves inactive.
4. Assert the reader used the fixed production store path in every case.

**Expected Outcome**:
- Every case resolves `{ active: true, source: "marker" }` with no `reason`.
- The result is never `{ active: false }`; the directory case is never treated as absent; the reader does not throw or escape the production store directory.
- The skipped root case is named in the test output, not silently omitted.

**Notes / Clarifications**: The fail-closed cases are evaluated at the fixed marker path (D12).

#### TC-HOLDFACT-007 - Reason is sanitized to one control-free line of at most 160 characters

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.6, AC-F1-7, NFR-5, RSK-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` (new) over the delivered sanitizer
**Tags**: @core, @security

**Preconditions**:
- A reason string containing `\u0000`, `\u0007`, `\u001b[31m`, `\u001b[0m`, `\u0085`, a newline, a tab, repeated spaces, and 300 visible characters.
- A second string of exactly 160 visible characters and a third of 161.
- A third reason containing shell metacharacters and a command substitution payload: `$(touch pwned)`, backticks, `;`, and `|`; a sentinel file path that must not be created.

**Steps**:
1. Sanitize and resolve each source (environment and marker).
2. Assert the produced reason's length, line count, and character classes.
3. Assert that truncated output carries no ellipsis.
4. Render the metacharacter reason through the hook line and the status/doctor human surfaces; assert the sentinel file is not created and the text is rendered literally.

**Expected Outcome**:
- The reason is a single line, contains no C0 (`\u0000`–`\u001f`), DEL, or C1 (`\u007f`–`\u009f`) character, and contains no `\u001b`.
- The mixed input is at most 160 characters; the all-visible 300-character input becomes exactly 160 characters with no appended `...`; the 160-character input is unchanged; the 161-character input becomes 160.
- The bound is applied before any payload, line, or log; the same sanitized value is what status and doctor receive.
- The reason is treated as data only: it is never sourced, evaluated, or used to build a command, and the metacharacter fixture creates no file and runs no command.

#### TC-HOLDFACT-008 - Marker resolution performs one existence check and one 4 096-byte read

**Scenario Type**: Performance
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.7, AC-F1-9, NFR-1, DM-9, D12
**Test Type(s)**: Adapter
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-reader.test.ts` (new) with an injected filesystem fact and a real 10 KB temp file
**Tags**: @adapter, @perf

**Preconditions**:
- A recording filesystem fact that records every existence check, every open/read call, the requested byte limit, and the exact path.
- A real temp `HOME` with a 10 KB `owner-hold` file in the production store directory whose first 160 characters are visible ASCII and whose first line continues beyond 4 096 bytes.

**Steps**:
1. Resolve once with the recording fact.
2. Resolve once with the real file and the real reader.
3. Assert the call counts, the requested limit, the exact path, and the produced reason.

**Expected Outcome**:
- Exactly one existence check and exactly one read per resolution; the read requests at most 4 096 bytes against exactly the production store directory's `owner-hold` entry.
- The real 10 KB file yields a reason of at most 160 characters; bytes beyond 4 096 are not surfaced and no second read occurs.
- Zero process spawns: the reader does not shell out to `stat`, `cat`, `head`, or `wc`.

**Notes / Clarifications**: The reader is the new `packages/adapters/src/file/owner-hold-marker.ts`; D12 fixes the path.

#### TC-HOLDFACT-009 - Resolution reads no credential, writes no state, and calls no network

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.7, AC-F1-9, NFR-1, NFR-2
**Test Type(s)**: Unit, Structure, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` for the numeric zero-count recorder at the injected-reader/composition boundary; `tests/behaviour/owner-hold-reader.test.ts` for the reader call shape and the 4 096-byte bound; `tests/behaviour/owner-hold-production-composition.test.ts` and `tests/structure/owner-hold-composition.test.ts` for the composition supply of the fact (not the zero-count proof)
**Tags**: @core, @cli, @security

**Preconditions**:
- Recording seams, not just canaries: one composition-shaped holder carries a credential port that increments a counter and returns a canary, a transport that increments a request counter and returns a canary, a store wrapper that increments an append/write counter, and a process-spawn recorder, together with a resolution closure that calls the real `readOwnerHoldMarker` over a recording filesystem port. The reader's ports are therefore exercised, and the remaining ports are reachable in the same object.
- The recording filesystem port returns a marker content so the reader outcome is consumed by the resolver, not ignored.
- A planted credential canary value in the injected environment record, separate from the hold value.

**Steps**:
1. Reset every recorder.
2. Resolve twice with the environment source active and once with the environment absent, so the marker source is consumed through the reader; then assert the recorded counts.
3. Assert the reader call shape numerically: one existence check, one regular-file check, and one bounded read per pass, always at the fixed `<storeDirectory>/owner-hold` path and always requesting exactly 4 096 bytes. These counts come from the real reader, so the assertion is not satisfied by construction.
4. Assert the recorded counts for the other ports: credential resolutions, transport requests, store writes, and process spawns are each **exactly `0`** (numeric count assertions, not only a "was not called" canary).
5. Assert the marker content reached the resolved fact on the environment-miss pass (`{ active: true, source: "marker", reason: "peak-hour cost pause" }`).
6. Scan the resolved fact for the canary.

**Expected Outcome**:
- The reader performs exactly the one existence check, one regular-file check, and one bounded read it is allowed, at the fixed production store path and the 4 096-byte bound, on every resolution pass.
- The counters for credential resolutions, transport requests, state writes, and process spawns are exactly zero for either source.
- The marker content is genuinely consumed; the resolver exposes no planted secret.
- The composition suites prove that the produced composer supplies the fact to every surface; they are not cited as the zero-count proof.

**Notes / Clarifications**: The numeric zero-count assertion is placed at the injected-reader/composition boundary (review-2 D29). A recorder around the pure resolver alone would read zero by construction and prove nothing, because the resolver holds no reference to any port; the recorder here calls the real reader over a recording filesystem port, so a positive, exact call shape is asserted before the zero counts. Canaries and the static source checks corroborate the counts but cannot substitute for them (review-1 F-11).

#### TC-HOLDFACT-010 - No resolvable home directory leaves only the environment source; no store relocation

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1.9, AC-F1-8, NFR-11, A-2, D12
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` (new)
**Tags**: @core

**Preconditions**:
- The resolver is called with no home directory and no marker outcome.
- Case A: the environment source is empty/unset. Case B: the environment source is set to `hold reason`.
- A negative control sets an arbitrary store-relocation environment value and a marker at that relocated path.

**Steps**:
1. Resolve both cases.
2. Assert that no path is constructed and no ambient read is attempted.
3. Inspect the recorded inputs for any path fallback.
4. Assert the relocated marker is not read and no relocation setting is consulted.

**Expected Outcome**:
- Case A resolves `{ active: false }`; Case B resolves `{ active: true, source: "env", reason: "hold reason" }`.
- No ambient working directory, `$HOME`, or default path is consulted; the missing directory is not reported by the hold fact (the composition's existing configuration handling owns that).
- No store-relocation override is offered or read; the relocated marker has no effect (D12).

#### TC-HOLDFACT-011 - The fact is re-resolved on every pass and never cached

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.8, AC-F1-1, AC-F1-2, NFR-4, A-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` and `tests/structure/owner-hold-composition.test.ts` (new)
**Tags**: @core, @cli, @state

**Preconditions**:
- One composed status/queue runtime over a temp HOME and its production store directory.
- The marker absent at the first call, created before the second, and removed before the third.

**Steps**:
1. Run the surface (status or a scheduling pass) with no marker.
2. Create the marker and run the same runtime again.
3. Remove the marker and run a third time.
4. Repeat with an injected environment record that changes between calls in a new process-equivalent invocation.

**Expected Outcome**:
- The three results are inactive, active (`marker`), inactive — with no process restart and no cached fact.
- A change to the environment source between invocations is observed on the next resolution; nothing is retained across passes.
- Two identical fact sets produce byte-identical outputs (NFR-6).

#### TC-HOLDHOOK-001 - Active hold sleeps the default poll and prints one reason line

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.1, F-2.2, F-2.6, AC-F2-1, DM-2, NFR-3, PM D8, PM D9
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-owner-hold-example.sh` (new), sourcing `scripts/hooks/pre-opencode-iteration-owner-hold.sh`
**Tags**: @shell, @hook

**Preconditions**:
- The hook sourced in the test shell.
- A temp `HOME` whose production store directory contains `owner-hold` with reason `peak-hour cost pause`; `DELIVERY_OS_OWNER_HOLD_POLL_SECONDS` unset.
- A second marker at a non-default path (for example under the temp working directory) with a different reason, as the negative control.
- `_now_utc_epoch` and `_sleep` overridden; the sleep seam records the requested seconds and removes the marker after the first sleep so the driver terminates.
- A non-zai agent/model pair (`ADOS_HOOK_AGENT=ceo` with a model that is not `zai-coding-plan/*`) and a zai pair, run separately, to prove the example has no provider/model activation gate.

**Steps**:
1. Run `main` in the current shell with stdout/stderr captured.
2. Read the recorded sleep log, the exit code, and the captured line count.
3. Evaluate `howLongToSleepDueToOwnerHold` directly before the run to read the condition value.
4. Repeat with the non-zai pair and assert the same condition value and sleep.
5. Repeat with only the non-default marker present and assert no deferral.

**Expected Outcome**:
- The condition echoes `300`; the driver records exactly one sleep of `300`.
- Exactly one deferral line is printed and it matches the resolved grammar `[INFO] (pre-opencode-iteration-owner-hold) owner-hold (marker): peak-hour cost pause; sleeping 300s` (source token in parentheses, reason segment only when present, poll interval last).
- The line is one line with no control or ANSI sequence; no `[WARN]` is printed.
- The non-zai and zai pairs behave identically: there is no `zai-coding-plan/*` or model activation gate in the dedicated owner-hold example.
- The shell example reads only the temp HOME's `.delivery-os-state/owner-hold`; the non-default marker is ignored and no marker-path override is offered (D12).
- The example ships the current product's names as its defaults (`DELIVERY_OS_OWNER_HOLD`, `DELIVERY_OS_OWNER_HOLD_POLL_SECONDS`, `$HOME/.delivery-os-state/owner-hold`); adopters edit those defaults when they rename the product, and the typed engine derives the same names from the brand rather than from the example.

**Notes / Clarifications**: Resolved by PM decisions D8 (no model gate), D9 (reason-line grammar), and D12 (fixed marker path). The example's defaults are the current product's names (D26); the shell suite sets them explicitly per case so a rename requires one edit in one place.

#### TC-HOLDHOOK-002 - Inactive hold returns immediately with no sleep and no line

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.2, F-2.8, AC-F2-2, PM D8
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-owner-hold-example.sh` (new)
**Tags**: @shell, @hook

**Preconditions**:
- No environment source and no marker.
- A temp `HOME` whose `.delivery-os-state` directory is available for the empty-marker leg.
- A non-zai agent/model pair as well as the zai pair.

**Steps**:
1. Evaluate the condition.
2. Run `main` with the recording seams.
3. Repeat with an empty marker at the temp HOME's `.delivery-os-state/owner-hold` and then with the marker removed.
4. Repeat with the non-zai pair.

**Expected Outcome**:
- The condition echoes `0`; `main` exits `0` with an empty sleep log.
- No `[INFO]`, `[WARN]`, or `owner-hold` line is printed; zero sleeps and zero network calls occur.
- The inactive result is identical for every agent and model; no provider/model gate short-circuits or enables the condition.
- The empty-marker run is covered by TC-HOLDFACT-005 at the fact layer and does not produce a deferral here.

**Notes / Clarifications**: Resolved by PM decision D8 (no model gate).

#### TC-HOLDHOOK-003 - The driver never applies a fixed loop cap while held

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.5, AC-F2-3, NFR-9, RSK-2
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-owner-hold-example.sh` (new)
**Tags**: @shell, @hook

**Preconditions**:
- A temp `HOME` with `owner-hold` at the temp HOME's `.delivery-os-state/owner-hold`.
- `DELIVERY_OS_OWNER_HOLD_POLL_SECONDS=1` for a fast logical run; no real sleep.
- A stepping clock seam; the sleep seam increments the clock and counts calls, and removes the marker on the 26th sleep so the loop terminates.
- `ADOS_ZAI_MAX_SLEEP_LOOPS` set to `1` as a negative control.

**Steps**:
1. Run `main`.
2. Read the sleep count, each recorded duration, and the captured output.
3. Grep the delivered example for any loop-cap setting or cap-warning text.

**Expected Outcome**:
- Exactly 26 sleeps of `1` occur before the marker removal ends the loop; the driver never proceeds after 24 polls and never logs a cap warning.
- `ADOS_ZAI_MAX_SLEEP_LOOPS` has no effect; the example contains no `MAX_SLEEP_LOOPS`-style cap and no "cap reached" warning.
- The test performs zero real sleeps.

#### TC-HOLDHOOK-004 - Poll interval accepts 1–3 600 and falls back to 300 with one warning

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.3, AC-F2-4, NFR-3, DM-2, PM D10
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-owner-hold-example.sh` (new)
**Tags**: @shell, @hook

**Preconditions**:
- A temp `HOME` with an active marker at the temp HOME's `.delivery-os-state/owner-hold`; a recording sleep seam.
- A table of values: `1`, `300`, `600`, `3600` accepted; `0`, `-1`, `abc`, `1.5`, `99999` rejected with one warning; unset, `""`, and whitespace-only `"   "` accepted silently as the default.
- The variable is unset, set to the empty string, and set to whitespace in three separate runs.

**Steps**:
1. For each value, run the condition and `main` with a one-sleep marker-removal seam.
2. Count the `[WARN]` lines and read the recorded sleep.
3. Run the unset, empty, and whitespace-only cases and count the warnings separately.

**Expected Outcome**:
- Accepted values `1`, `300`, `600`, and `3600` echo and sleep exactly that number of seconds; no warning is printed.
- Unset, empty, and whitespace-only values echo and sleep `300` silently, with zero `[WARN]` lines.
- Non-empty invalid values (`0`, `-1`, `abc`, `1.5`, `99999`) echo and sleep `300`, and print exactly one bounded warning; the result is never `0` and never a busy loop.
- The warning is a single line with no unbounded value echo.

**Notes / Clarifications**: Resolved by PM decision D10 (unset/empty/whitespace silent default; non-empty invalid emits one warning).

#### TC-HOLDHOOK-005 - Removing the marker during a sleep ends the hold at the next evaluation

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.8, AC-F2-5, NFR-4
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-owner-hold-example.sh` (new)
**Tags**: @shell, @hook

**Preconditions**:
- A temp `HOME` with an active marker at the temp HOME's `.delivery-os-state/owner-hold`; a sleep seam that removes the marker during the first sleep.
- The condition is evaluated again after the sleep.

**Steps**:
1. Run `main`.
2. Read the sleep log and the exit code.
3. Assert that a second evaluation returns `0`.

**Expected Outcome**:
- Exactly one sleep occurs; the next condition evaluation echoes `0`; `main` exits `0` without a further sleep.
- The resume latency is at most one poll interval plus the hook's own evaluation, matching NFR-4.

#### TC-HOLDHOOK-006 - Conditions compose by MAX and the hold remains the floor

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.4, AC-F2-6, DEC-4
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-owner-hold-example.sh` (new)
**Tags**: @shell, @hook

**Preconditions**:
- The example sourced with its default single-condition registry.
- A second, time-bounded condition function is added through the documented append point. If the delivered registry is `readonly`, the suite generates a temp copy of the example with the registration line appended and sources that copy, following the delivered zai suite's re-source pattern for custom windows.
- The time-bounded condition returns `3600` on the first evaluation and `0` afterwards; the hold returns `300` throughout.

**Steps**:
1. Run `main` with a sleep seam that records each duration and terminates after three sleeps.
2. Assert the sequence of sleeps.
3. Assert that the hold is still evaluated after the time-bounded condition reaches `0`.

**Expected Outcome**:
- The first sleep is `3600` (MAX of `3600` and `300`); subsequent sleeps are `300`.
- The driver never returns `0` while the hold is active, even after the window ends; no loop-cap warning appears.
- The composition rule is documented in the guide (TC-HOLDDOCS-002).

#### TC-HOLDHOOK-007 - The hook is a pure gate: no env output, no file, no signal

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2.9, AC-F2-7, NG-1
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-owner-hold-example.sh` (new)
**Tags**: @shell, @security

**Preconditions**:
- A temp `HOME` with an active marker at the temp HOME's `.delivery-os-state/owner-hold`; the `HOME` and `TMPDIR` trees are snapshotted before the run.
- `kill` and `pkill` shadowed with functions that record any invocation.
- A sentinel `ADOS_HOOK_ENV_OUTPUT` path that does not exist before the run.

**Steps**:
1. Run `main` with the recording seams.
2. Diff the `HOME`/`TMPDIR` file lists before and after.
3. Scan stdout/stderr for `ADOS_HOOK_ENV_V1`.
4. Assert the shadowed signal functions were not called.

**Expected Outcome**:
- No `ADOS_HOOK_ENV_V1` header, record, or output file exists; the sentinel path is untouched.
- No file is created or modified in `HOME` or `TMPDIR`.
- No `kill`, `pkill`, or signal invocation occurs; the hook does not touch a running session.

#### TC-HOLDHOOK-008 - A day-long clock jump neither ends nor extends the hold

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2.8, AC-F2-8, NFR-6
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-owner-hold-example.sh` (new)
**Tags**: @shell, @hook

**Preconditions**:
- A temp `HOME` with an active marker at the temp HOME's `.delivery-os-state/owner-hold`; a clock seam that starts at `T`, jumps forward by `86 400` after the first evaluation, then backward by `86 400` after the second.
- A sleep seam that records durations and terminates after three sleeps.

**Steps**:
1. Run `main`.
2. Assert the condition value and each sleep duration across the jumps.
3. Compare against a no-jump run.

**Expected Outcome**:
- The condition echoes `300` at every evaluation; each sleep is `300`; the exit is `0` after the hold is removed.
- No absolute wake time participates in the decision; a deferral never exceeds one poll interval per iteration; DST or timezone changes cannot end or extend the hold.

#### TC-HOLDHOOK-009 - The sleep line is single-line, source-named, and bounded

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2.6, AC-F2-1, NFR-5, PM D9
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-owner-hold-example.sh` (new)
**Tags**: @shell, @hook

**Preconditions**:
- A temp `HOME` with an active marker at the temp HOME's `.delivery-os-state/owner-hold` whose reason is a 300-character string with an ANSI escape and a newline; a source that is `marker` or `env`.
- A second run with an active environment hold and no reason (whitespace-only variable).
- A sleep seam that removes the marker after one sleep.

**Steps**:
1. Run `main` and capture stderr separately.
2. Count the deferral lines.
3. Assert the line length, line count, and token presence for both the with-reason and no-reason cases.

**Expected Outcome**:
- Exactly one line per sleep and the resolved grammar holds: `owner-hold (marker): peak-hour cost pause; sleeping 300s` when a reason is present, and `owner-hold (env); sleeping 300s` when it is absent.
- The line is at most one physical line, contains no `\u001b`, C0/C1 character, or raw newline; the reason segment is omitted entirely when absent (no dangling colon).
- The reason portion is at most 160 characters; the line remains bounded under the example's declared line bound.

**Notes / Clarifications**: Resolved by PM decision D9 (source token always present; reason segment conditional).

#### TC-HOLDREG-001 - Install names and installs both examples executable and inactive

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.1, F-3.2, AC-F3-1, DEC-4
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install.sh` (modify) and `scripts/install.sh` (`ADOS_HOOK_EXAMPLES`)
**Tags**: @shell, @install

**Preconditions**:
- The mock source fixture creates both `scripts/hooks/pre-opencode-iteration-zai.sh` and `scripts/hooks/pre-opencode-iteration-owner-hold.sh`.
- A sandbox project directory; `install.sh --local` runs against the mock source.

**Steps**:
1. Run the local install.
2. Assert both paths exist and are executable.
3. Assert neither is activated (no `ADOS_PRE_ITERATION_HOOK` or config activation is written).
4. Assert the install output names both examples.

**Expected Outcome**:
- Both example files exist and are executable; the new file is `scripts/hooks/pre-opencode-iteration-owner-hold.sh`.
- Installation does not activate either example; an adopter still selects one explicitly.
- The `ADOS_HOOK_EXAMPLES` array contains exactly the two delivered examples and no third entry.

#### TC-HOLDREG-002 - Uninstall removes both examples and the empty hooks directory

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.3, AC-F3-2
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-uninstall.sh` (modify) and `scripts/uninstall.sh`
**Tags**: @shell, @install

**Preconditions**:
- A sandbox project with both delivered hook examples installed.
- An operator-owned hook at the default or overridden path, outside the delivered file list.

**Steps**:
1. Run the local uninstall.
2. Assert both delivered examples are removed.
3. Assert `scripts/hooks/` is removed only because it is empty.
4. Assert the operator's hook is preserved.
5. Repeat with the operator hook removed to prove the empty-directory branch.

**Expected Outcome**:
- Both delivered examples are removed; `scripts/hooks/` is removed when empty and left in place when it holds an operator file.
- The operator's hook is never removed; the unconditional delivery-file list names exactly the two examples.

#### TC-HOLDREG-003 - The new suite is hermetic, auto-discovered, and shellcheck-clean

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.4, F-3.5, F-3.6, AC-F3-3, NFR-9
**Test Type(s)**: Shell, Conformance
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-hook-owner-hold-example.sh` (new), `scripts/run-bash-suites.sh`, shellcheck
**Tags**: @shell, @conformance

**Preconditions**:
- The new suite shadowing `sleep` with a recording function and providing a network canary (any `curl`/`wget`/`jq` invocation is recorded and fails the case).
- The suite runner's discovery list.

**Steps**:
1. Run `bash scripts/.tests/test-hook-owner-hold-example.sh`; capture the pass/fail count.
2. Assert the suite path is matched by the runner's documented `find . -path '*/.tests/test-*.sh'` discovery pattern and by the `test-*.sh` naming rule, with no edit to the runner.
3. Run `shellcheck scripts/hooks/pre-opencode-iteration-owner-hold.sh` and `shellcheck scripts/.tests/test-hook-owner-hold-example.sh`.
4. Assert the real-sleep and network markers are empty.

**Expected Outcome**:
- The suite exits `0` with all checks passing; the real-sleep marker and network marker are empty.
- The runner discovers the suite through the existing `*/.tests/test-*.sh` rule; no runner edit is needed.
- Shellcheck reports zero findings on both files; strict mode, quoting, and `readonly` conventions hold.

#### TC-HOLDREG-004 - Pinned wrapper and legacy-suite bytes are unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.7, AC-F3-4, NG-6, DEC-5
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-surface.test.ts` (unchanged) and review-time diff for the other wrappers
**Tags**: @structure, @regression

**Preconditions**:
- The delivered SHA-256 map for `scripts/ceo-loop.sh` and `scripts/.tests/test-hook-regression.sh`.

**Steps**:
1. Run `bun test tests/structure/provider-surface.test.ts`.
2. Assert both digests match the delivered constants.
3. At review time, inspect `git diff --name-only` for `scripts/deliver-ticket.sh`, `scripts/ceo-loop.sh`, `scripts/batch-deliver.sh`, and `scripts/.tests/test-hook-regression.sh`.

**Expected Outcome**:
- Both pinned digests match; the pin is unchanged and no assertion is weakened.
- None of the wrapper files appears in the change diff; the new example and its suite are the only `scripts/hooks` and `scripts/.tests` additions.

#### TC-HOLDQUEUE-001 - A held pass suppresses every next action, prepends `owner-hold`, and masks the lane reason

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.1, F-4.2, F-4.7, AC-F4-1, AC-F4-7, DM-3, DM-5, DEC-2, D25
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-schedule.test.ts` (new) over `computeQueueSchedule` and `shapeQueueLanes` with `tests/fixtures/queue/hold/cases.json`
**Tags**: @core, @queue

**Preconditions**:
- One fact set containing: a ready entry; a held entry with its own reason; a not-ready entry with a dependency; an active provider-window park; a stuck park; a park whose `expiresAt` is in the past (`resumable`); and a delivering lane.
- `ownerHold: { active: true, source: "marker", reason: "peak-hour cost pause" }` injected.
- An identical fact set with `ownerHold` absent as the control.

**Steps**:
1. Run the scheduling pass and the lane fold with the hold.
2. Project the entries and lanes.
3. Assert every gated entry's full ordered `blocking[]` — including the active and stuck parks — and each lane's single rendered reason.
4. Pipeline the same held facts through `queue list` and assert the full blocking list is retained for every entry.
5. Run the pass again with identical facts and compare bytes.
6. Run the no-hold control.

**Expected Outcome**:
- `nextActions` is `[]`; no `preemption` proposal exists.
- `owner-hold` is prepended to **every** gated entry's ordered `blocking[]`, including active and stuck parks, while each entry's state and own reason are preserved:
  - ready: `held` / `["owner-hold"]`;
  - held/not-ready: state preserved / `["owner-hold", ...own reasons]` (`["owner-hold","dependency-open"]`, `["owner-hold","tier-unknown"]`);
  - active park: `parked` / `["owner-hold","parked:provider-window"]`, cause preserved;
  - stuck park: `stuck` / `["owner-hold","park-condition-stuck"]`, reason preserved;
  - resumable park: `held` / `["owner-hold"]`;
  - delivering lane entry: `held` / `["owner-hold","lease-held"]`, lane still `delivering`.
- **Lane rendering:** idle lanes render exactly one reason, `owner-hold` (masking `blocking[0]`'s specific `dependency-open`/`tier-unknown` reason, which remains readable on `queue list`), while the parked lane renders its park reason `parked:provider-window` and the stuck lane renders `park-condition-stuck`; the delivering lane renders no reason.
- The held/ready/resumable lanes are `idle-with-reason`/`owner-hold`; the two runs are byte-identical; the no-hold control schedules normally.

**Notes / Clarifications**: The lane surface intentionally masks the specific idle reason; `queue list` is the operator's full-reason surface (F-4.7, RSK-4, AC-F4-7). Active/stuck parks are not "unchanged" on `queue list`: only `owner-hold` is prepended and their state/park reason are preserved (D25, review-1 F-6).

#### TC-HOLDQUEUE-002 - Supplied-ref and no-ref claim refusals name `owner-hold` and append nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.3, AC-F4-2, DM-6, NFR-2, PM D7, D13
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-claim.test.ts` (new) and `tests/behaviour/queue-lease.test.ts` (modify the delivered claim-precondition gate matrix)
**Tags**: @core, @queue, @state

**Preconditions**:
- A ready entry in a real temp store; no active park or lease.
- An active hold with reason `peak-hour cost pause`.
- A store write counter and a lease-record reader.

**Steps**:
1. Run `queue claim GH-XXX --json` (supplied ref) through the composed program.
2. Run `queue claim --json` (no ref) through the same composed program.
3. Read the exit code and each envelope's `error.code` and `error.summary`.
4. Call `evaluateClaimPreconditions` directly with the hold fact and read its `reason` and `detail`.
5. Read the lease/park/incident record counts.

**Expected Outcome**:
- Both supplied-ref and no-ref claims exit `1`; `error.code === "queue.precondition.unmet"`; each summary starts with the blocking-reason token exactly `reason=owner-hold`.
- The no-ref claim is gated **before ref selection**: it never returns `reason=no-eligible-action` and never reaches action selection, even though `nextActions` is empty.
- The domain precondition carries `reason === "owner-hold"` and a `detail` that separately names the source and the sanitized reason: `owner hold active (marker): peak-hour cost pause`.
- The token is never rewritten as `owner-hold: reason` and never conflated with a park cause rendering (the `parked:` cause template).
- Zero lease, park, incident, entry, and dependency records are appended; the store write count is zero.
- The refusal occurs before park, readiness, and selection evaluation, so a more specific readiness reason cannot mask it.

**Notes / Clarifications**: Resolved by PM decisions D7 (token exactly `owner-hold`; detail separately names source and reason) and D13 (the no-ref claim is gated before selection).

#### TC-HOLDQUEUE-003 - The fenced claim refuses before acquiring the fence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.3, AC-F4-2, DM-6, DEC-6, PM D7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-claim.test.ts` (new) over `claimQueueLease` with the fact supplied and the pre-fence precheck omitted
**Tags**: @core, @queue, @state

**Preconditions**:
- A ready entry; an active hold; a fence-acquisition spy that records whether the fence was acquired.
- A caller that bypasses `evaluateClaimPreconditions` and invokes the fenced claim directly.

**Steps**:
1. Call the fenced claim with the hold fact and no precheck.
2. Assert the refusal identity, reason, and detail.
3. Assert the fence spy count and the record counts.

**Expected Outcome**:
- The fenced claim refuses with `queue.precondition.unmet` and the blocking-reason token exactly `owner-hold` before `acquireFence` is called.
- The bounded detail matches the pre-fence grammar: `owner hold active (marker): peak-hour cost pause`, with the source and sanitized reason named separately from the token.
- Zero lease records are written; the fence is never held or released by the refused claim.
- A no-hold control claims normally, proving the refusal is caused by the hold.

**Notes / Clarifications**: Resolved by PM decision D7. The fenced path and the pre-fence path share the token/detail grammar; the no-ref case is covered by TC-HOLDQUEUE-002, because ref selection precedes the fence and the composition gates it there (D13).

#### TC-HOLDQUEUE-004 - Dispatch refuses as a classified user-validation refusal with zero side effects

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.4, AC-F4-3, DM-6, NFR-7, DEC-9, D19
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-dispatch.test.ts` (new) and `tests/structure/owner-hold-composition.test.ts` (production seam)
**Tags**: @core, @cli, @state

**Preconditions**:
- A valid dispatch whose admission preflight succeeds (resolving credential, readable work item).
- The production dispatch claim seam resolves the hold fact and refuses before claiming.
- Recording harness starter/runner, lease seam, branch/worktree seam, attempt/divergence/handover/authority ledgers, and a session registry.

**Steps**:
1. Run `dispatch GH-XXX --json` with an active hold.
2. Read the envelope's `error.code` and `error.summary`.
3. Classify the refusal through the delivered classifier/error-table row.
4. Assert every side-effect recorder and ledger.
5. Run the no-hold control.

**Expected Outcome**:
- Exit is the delivered refusal exit `1`; `error.code === "queue.precondition.unmet"`; the bounded summary names the hold and the sanitized reason.
- The refusal is a **classified user-validation refusal**, not an internal wait: the delivered row is non-retryable, `not_landed`, and exits `1`. A caller that wants deferral semantics must treat the `owner-hold` token as wait/do-not-abort, never as a transient retry (D19).
- Zero leases, sessions, branches, worktrees, attempts, divergences, handover records, and authority changes; zero spawns and zero resumes.
- No new error identity or domain kind; the no-hold control dispatches normally.

**Notes / Clarifications**: Resolved by PM decision D19 (refusal is not a wait; the token carries wait/do-not-abort semantics for callers).

#### TC-HOLDQUEUE-005 - A composed supervision cycle derives no action from the held pass and claims nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.5, AC-F4-4, NFR-2, DEC-6, D14
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-daemon-watch.test.ts` (new) and `tests/behaviour/daemon-lane-supervision.test.ts` (modify)
**Tags**: @core, @daemon

**Preconditions**:
- A held `computeQueueSchedule` result over the held facts.
- A `nextAction` seam built by a real helper (`nextActionFromSchedule(schedule)`) that maps `schedule.nextActions[0]` to a `SupervisionAction`; the helper is wrapped in a recording spy.
- A recording executor, claim seam, and daemon-lane ledger; an available executor to prove the idle path is chosen by the empty action, not by executor unavailability.
- A control where the same helper is fed the no-hold schedule.

**Steps**:
1. Compute the held schedule and assert `nextActions` is empty.
2. Build the `nextAction` seam with the recording helper and run `runSupervisionCycle`.
3. Assert the helper was built from the held schedule, was invoked by the cycle, and returned `undefined`; if the seam is a literal `() => undefined` or the helper is not invoked, fail the case explicitly.
4. Read the result mode, the claim-call count, the executor-start count, and the daemon-lane records.
5. Run the no-hold control through the same helper and assert it derives one action.

**Expected Outcome**:
- The derivation is non-vacuous: the recording helper was built from the held schedule, was invoked by the cycle, observed `nextActions[0] === undefined`, and the cycle mode is `idle` (or `supervise-only` when the executor is unavailable).
- The claim seam is never called with an action; zero daemon-lane records, zero heartbeat records, zero executor starts, zero leases.
- The no-hold control claims and starts exactly one action, proving the helper can derive an action when one exists.
- The case does not claim production resident-daemon wiring; the production entry remains the resident-daemon spec's residual (D14/GAP-T7).

**Notes / Clarifications**: Resolved by PM decision D14. The test fails if the seam is not derived from `computeQueueSchedule`, closing the tautology identified in DoR finding 4.

#### TC-HOLDQUEUE-006 - `queue watch` streams the hold with empty actions and claims nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.5, AC-F4-4, NFR-2, NFR-14
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-daemon-watch.test.ts` (new) and `tests/behaviour/queue-watch.test.ts` (modify the held case)
**Tags**: @cli, @queue

**Preconditions**:
- A composed queue watch stream over an active hold and one ready entry.
- A recording claim seam and a store write counter.

**Steps**:
1. Consume one bounded watch event.
2. Parse the payload.
3. Assert the hold member, the action list, and the side-effect counts.

**Expected Outcome**:
- The event payload carries `ownerHold` with source and optional reason and an empty `nextActions`.
- Watch performs zero claims, zero writes, and exits/streams within its delivered bounds; it never turns the hold into an error.
- Inactive watch payloads remain byte-identical to the delivered shape.

#### TC-HOLDQUEUE-007 - Park auto-recovery is skipped and the park bytes are unchanged

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.6, AC-F4-5, DEC-6, A-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-park-resume.test.ts` (new) and `tests/behaviour/queue-park.test.ts` (modify)
**Tags**: @core, @state

**Preconditions**:
- A durable provider-window park whose `expiresAt` is in the past by more than the recheck interval.
- An active hold; a read-pass evaluation that reports the park `resumable`; a store write counter; a byte snapshot of the park record and its record key.
- A mutating command path (`queue claim` and `queue add` exercised separately) that normally invokes `recoverQueueParks`.

**Steps**:
1. Run the read pass; assert the evaluation is `resumable` but no write occurs.
2. Run each mutating path; assert the recovery pass is not invoked and the record bytes are unchanged.
3. Query the incident ledger and the `clear-observed`/`recovered` records.

**Expected Outcome**:
- Zero `clear-observed` markers, zero `recovered` records, zero `park-auto-recovery` incidents; the park record is byte-identical to the pre-hold snapshot.
- The entry is not claimed; the mutating path either performs its own bookkeeping (TC-HOLDQUEUE-010) or refuses claim (TC-HOLDQUEUE-002).
- The no-hold control appends exactly one marker, one recovered record, and one incident.

#### TC-HOLDQUEUE-008 - Removal resumes preserved state with no duplicate session

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.8, AC-F4-6, NFR-4, A-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-park-resume.test.ts` (new), over a seeded store and a recording harness session port
**Tags**: @core, @cli, @state

**Preconditions**:
- A store seeded before the hold with: one queue entry, one active lease, one overdue park, one daemon lane, one handoff record, and one recorded session handle/lane identity.
- A byte snapshot of every record and of the lane identity.
- An active hold, then removal.

**Steps**:
1. Run a held pass and assert zero writes.
2. Remove the hold; run the next pass and the delivered resume path.
3. Compare every pre-hold record byte-for-byte except the records the delivered recovery/resume path legitimately appends.
4. Assert the session handle and lane identity.

**Expected Outcome**:
- Entries, leases, parks, incidents, daemon lanes, handoffs, and lane identities are unchanged by hold entry or removal.
- After removal, the overdue park recovers through the delivered pass (one marker, one recovered record, one incident) and the recorded session is resumed, not re-dispatched: the session handle and lane identity match the pre-hold values; no new branch or worktree is created; no duplicate session exists.
- The pass performs no "repair" write to clear the hold.

#### TC-HOLDQUEUE-009 - Payload `ownerHold` is present only when active; inactive bytes are identical

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.7, AC-F4-7, DM-4, NFR-12, D17
**Test Type(s)**: Golden, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-payload.test.ts` (new), `tests/golden/queue-list.test.ts` and `tests/golden/queue-plan.test.ts` (modify), plus `tests/fixtures/queue/golden/queue-list-held.json` and `queue-plan-held.json` (new)
**Tags**: @cli, @golden

**Preconditions**:
- The delivered queue list/plan golden facts with the hold inactive.
- The same facts with an active hold carrying source `marker` and reason `peak-hour cost pause`.
- The existing committed goldens for the inactive case.

**Steps**:
1. Run `queue list` and `queue plan` inactive; compare bytes with the existing goldens.
2. Run the same commands with an active hold; compare with the new held goldens.
3. Run `queue ready` with and without the hold and compare bytes.
4. Assert the member shape, the entries' blocking reasons, and the `queue ready` payload.

**Expected Outcome**:
- Inactive list/plan payloads contain no `ownerHold` property and are byte-identical to the delivered goldens; no existing golden file changes.
- Active list/plan payloads contain `ownerHold` with `active: true`, the source, and the optional sanitized reason; `nextActions` is empty and the entry blocking lists start with `owner-hold`.
- `queue ready` is unchanged under a hold: its payload is byte-identical to the no-hold run and carries no `ownerHold` or hold-shaped suppression (D17).
- `QueueLanesData` keeps its delivered shape; no lane payload field is added.

**Notes / Clarifications**: `queue ready` is deliberately outside the hold surfaces; an operator reads `queue list`/`queue plan`/`status` for the hold (D17).

#### TC-HOLDQUEUE-010 - Bookkeeping still works while held; claim does not

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4.10, AC-F4-8, DEC-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-claim.test.ts` (new) and `tests/behaviour/queue-cli.test.ts` (modify)
**Tags**: @cli, @queue, @state

**Preconditions**:
- An active hold; a real temp store; one existing entry and a second observed ref.
- A recovery-pass spy and a store write counter.

**Steps**:
1. Run `queue add`, `queue prioritize`, `queue dep`, and `queue release` while held.
2. Assert each mutation's declared record and result.
3. Assert the recovery-pass spy was not invoked.
4. Run `queue claim` and assert the refusal.

**Expected Outcome**:
- Each bookkeeping command appends its declared entry/dependency/lease-release record and returns its normal result; none invokes park recovery.
- `queue claim` still refuses with `queue.precondition.unmet`/`owner-hold` and appends nothing.
- No hold-shaped special case changes the mutation envelopes.

#### TC-HOLDQUEUE-011 - Closed queue vocabularies move by exactly one lane reason

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.11, AC-F4-9, NFR-8, DM-5, D16, D25
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts` (**extend the structural test**) and `tests/structure/queue-ready-contract.test.ts` (unchanged) plus `tests/fixtures/queue/vocabulary/closed-sets.json` (modify)
**Tags**: @structure, @regression

**Preconditions**:
- The delivered closed sets: 3 park condition types, 3 causes, 3 pairings, 4 recovery states, 5 record kinds, 6 ready condition ids, 6 lane states.
- The updated `closed-sets.json`: a **new 28-entry `laneIdleReasons` array** (the 27 delivered lane reasons plus `owner-hold` appended at the end) and a `blockingReasons` array grown **27 → 34** (`owner-hold` at index 27 — the 28th entry — followed by the six condition ids the contract already composes: `deps-satisfied`, `repo-free`, `tier-known`, `no-owner-gate`, `ci-healthy`, `provider-available`). The six condition ids are existing members of `QUEUE_BLOCKING_REASONS`; the fixture catch-up is part of the same deliberate edit.
- The delivered suite name is `describe("TC-VOCAB-005 closed sets are exact and distinct")`; this case is that suite's two `toEqual` assertions.

**Steps**:
1. Add the exact two-way ordered assertions in `queue-scheduling-contract.test.ts`:
   - `expect([...QUEUE_LANE_IDLE_REASONS]).toEqual(closedSets.laneIdleReasons)` (28 entries)
   - `expect([...QUEUE_BLOCKING_REASONS]).toEqual(closedSets.blockingReasons)` (34 entries)
2. Assert the other closed arrays equal their fixtures exactly, in both directions.
3. Assert `owner-hold` appears exactly once in each array at the declared position (last in `laneIdleReasons`; index 27 — the 28th entry — in `blockingReasons`, immediately before the six condition ids), and that the six condition ids keep their delivered order.
4. Assert the six ready condition ids, their order, tri-state, and evidence vocabulary are unchanged.
5. Run a mutation control that removes or renames `owner-hold` in either contract array, and a second control that drops or reorders a condition id, and assert the named equality fails.

**Expected Outcome**:
- `QUEUE_LANE_IDLE_REASONS` and `QUEUE_BLOCKING_REASONS` are exactly equal to `closed-sets.json` in both directions, including order (28 and 34 entries); the pin is not inferred from a fixture edit.
- Park condition types, causes, pairing, recovery states, record kinds, lane states, and ready condition ids are byte-unchanged.
- `owner-hold` is the only added lane/blocking reason; no duplicate and no other token moves; the six condition ids are pinned deliberately rather than left unpinned in the fixture.
- The structural test fails by name if the fixture and either contract array disagree in either direction (D16).

**Notes / Clarifications**: Test-name traceability (review-1 F-11): TC-HOLDQUEUE-011 ≡ the delivered `TC-VOCAB-005` suite in `tests/structure/queue-scheduling-contract.test.ts`. The 27 → 34 growth and the 28-entry `laneIdleReasons` array are the exact §7.3 fixture target.

#### TC-HOLDQUEUE-012 - A delivering lane is not signalled, killed, or parked

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4.9, AC-F4-10, NG-1, RSK-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-park-resume.test.ts` (new) with the lane fold and a shadowed signal seam
**Tags**: @core, @daemon

**Preconditions**:
- A daemon lane in state `delivering` with a recorded handle and a session id.
- An active hold; a shutdown/kill seam that records every invocation; a lane-record write counter.

**Steps**:
1. Run the held scheduling pass and lane fold.
2. Assert the lane state and the session handle.
3. Assert the signal/kill and cleanup seams.

**Expected Outcome**:
- The lane remains `delivering` with the same session handle and lane identity; it is never signalled, killed, parked, or cleaned up.
- Zero lane records are written; the hold has no cancellation semantics.
- The documented consequence (a mid-flight provider cut-out may still leave a `partial` lane) is not asserted as a new behaviour.

#### TC-HOLDQUEUE-013 - Unreadable queue facts still exit 2 with no fabricated hold payload

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.12, AC-F4-11, NFR-14
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-claim.test.ts` (new) with an injected torn store; `tests/behaviour/status-owner-hold.test.ts` and `tests/behaviour/doctor-owner-hold.test.ts` for the independent surfaces
**Tags**: @cli, @state

**Preconditions**:
- A store whose queue fold read fails with `state.store.torn`; an active hold.
- A status runtime and doctor runtime that do not read the queue store for their hold fact.

**Steps**:
1. Run `queue list` and `queue claim` with the hold.
2. Assert the exit code, the error identity, and the data sibling.
3. Run the status runtime and the `createDoctorCommandRuntime` doctor runtime (with an injected `DoctorComposition`) against the same hold facts.

**Expected Outcome**:
- Both queue commands return the delivered `state.store.torn` failure at exit `2`; no `ownerHold` payload and no hold-shaped success is fabricated.
- `status` and `doctor` still report the hold from their independent injected facts, with the delivered exits.
- The hold never manufactures a queue payload over unreadable state.

#### TC-HOLDSTATUS-001 - Active hold adds the providers evidence member without changing the section

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5.1, F-5.6, AC-F5-1, DM-7, NFR-14, D15
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-owner-hold.test.ts` (new) over the composed status runtime in `tests/fixtures/status/harness.ts` (modify)
**Tags**: @core, @cli, @status

**Preconditions**:
- Healthy provider config and an empty verified park fold.
- An active hold with source `marker` and reason `peak-hour cost pause`.
- A credential-read spy and a store-write counter.

**Steps**:
1. Run `status --json` and `status` (human).
2. Locate the `providers` section and its `evidence` record.
3. Compare the section's state, counts, sources, reasons, truncation, and entries against a no-hold run with the same facts.
4. Assert `providers.evidence.ownerHold` and the absence of an `ownerHold` field on the section object.
5. Assert the exit code and section count.

**Expected Outcome**:
- The providers **evidence** record carries `ownerHold: { source: "marker", reason: "peak-hour cost pause" }` at `providers.evidence.ownerHold`; it is a sibling of `sources[]`, not a sibling of `chain`, `entries`, or `parks`.
- State, counts, sources, reasons, truncation, and entries are identical to the no-hold control; the section is not `unknown` or `degraded` because of the hold.
- Exit `0`; all nine sections are present; zero credential reads and zero state writes occur.

**Notes / Clarifications**: Resolved by PM decision D15 (evidence-level member, the `credentialPrerequisite` precedent).

#### TC-HOLDSTATUS-002 - The evidence member is attached across every providers section state

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5.2, AC-F5-1, D15
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-owner-hold.test.ts` (new)
**Tags**: @core, @status

**Preconditions**:
- Four provider fact sets: `observed` (healthy), `degraded` (park-fold failure), `unknown` (config resolution failure), and `unavailable` (not configured).
- An active hold in each.

**Steps**:
1. Aggregate each digest.
2. Assert the providers section state and `providers.evidence.ownerHold`.
3. Assert the member is absent when the hold is inactive in each of the same four states.

**Expected Outcome**:
- Every held case carries `providers.evidence.ownerHold` regardless of the section state; the section state is exactly the one the delivered facts produce.
- The no-hold cases carry no evidence member; the member does not change counts, reasons, or findings.
- The member is attached to the derived evidence record, not derived from the provider source outcome and not placed on the section object.

#### TC-HOLDSTATUS-003 - Human status appends the bounded owner-hold suffix

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5.4, AC-F5-2, NFR-5, D15
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-owner-hold.test.ts` (new) over `renderStatusHuman`
**Tags**: @core, @status

**Preconditions**:
- A held digest with `providers.evidence.ownerHold.reason = "peak-hour cost pause"`; a second with no reason; a third with a 300-character control-laden reason.
- The delivered line/byte bounds.

**Steps**:
1. Render each human digest.
2. Extract the providers line.
3. Assert the suffix, the line count, and the byte bound.
4. Assert the suffix is read from `providers.evidence.ownerHold`, not a field on the section object.

**Expected Outcome**:
- With a reason, the providers line ends with `| owner-hold: peak-hour cost pause`; without a reason, it ends with `| owner-hold`.
- The reason is sanitized and at most 160 characters; the line contains no control character or raw newline.
- The digest stays within the existing human line and byte bounds.

**Notes / Clarifications**: Resolved by PM decision D15 (human suffix is derived from the evidence member).

#### TC-HOLDSTATUS-004 - CLI and MCP status agree on the evidence member with an active hold

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5.5, AC-F5-3, NFR-6, D15
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-status-parity.test.ts` (modify), `tests/fixtures/mcp/parity/cases.ts` (modify), and `tests/fixtures/mcp/golden/status/status-owner-hold.json` (new, written by `tests/fixtures/mcp/regenerate.ts --write`)
**Tags**: @cli, @mcp, @golden

**Preconditions**:
- One status fact bundle with `providers.evidence.ownerHold` active, shared by the CLI and MCP runtimes.
- A deterministic clock and the same brand.

**Steps**:
1. Run the CLI status oracle and the MCP status tool over the same facts.
2. Canonicalize both data payloads and compare.
3. Compare the canonical payload with the committed parity golden.
4. Replay both surfaces a second time and compare bytes.

**Expected Outcome**:
- Both surfaces carry the same `providers.evidence.ownerHold` value; the canonical payloads are identical and match the golden.
- No adapter- or surface-specific field appears; both runs are deterministic.
- Inactive parity cases stay byte-identical.

**Notes / Clarifications**: Test-name traceability (review-1 F-11): TC-HOLDSTATUS-004 ≡ the delivered `TC-MCP-003 status success parity` suite in `tests/behaviour/mcp-status-parity.test.ts`, which iterates `tests/fixtures/mcp/parity/cases.ts` including the new owner-hold success case; no separate test function carries this TC id.

#### TC-HOLDSTATUS-005 - Status vocabulary is unchanged and no-hold output is byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5.3, F-5.4, AC-F5-4, AC-F4-7, NFR-8, NFR-12
**Test Type(s)**: Structure, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/status-contract.test.ts` (unchanged) and `tests/golden/status-digest.test.ts` (unchanged)
**Tags**: @structure, @golden

**Preconditions**:
- The delivered status contract constants and the committed `tests/fixtures/status/golden/{digest.json,human.txt,reserved-digest.json,reserved-human.txt}`.

**Steps**:
1. Assert the nine section ids and order, the twenty evidence reasons, the states, and the schema version.
2. Run the golden suite with the hold inactive.
3. Assert no `owner-hold` token exists in the status reason set or in the inactive digest.

**Expected Outcome**:
- The section order, states, evidence reasons, and schema version are exactly the delivered values; no tenth section and no twenty-first reason exists.
- The inactive machine and human outputs equal the committed golden bytes; no status golden is regenerated for this change.
- The corpus/golden pins are not loosened; only a new held corpus case is added (TC-HOLDSTATUS-001).

#### TC-HOLDDOCTOR-001 - Healthy provider + hold keeps `ok` and appends reason plus detail

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.1, F-6.2, F-6.6, AC-F6-1, DM-8, DEC-10, PM D11, D18
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-owner-hold.test.ts` (new) over the provider check and `createDoctorCommandRuntime` with an injected `DoctorComposition` from `tests/fixtures/doctor/harness.ts` (modify); the production composer supplies no `DoctorComposition` (D20/GAP-T8)
**Tags**: @core, @cli, @doctor

**Preconditions**:
- A healthy provider configuration, resolving credentials, and an empty verified park fold, so the delivered detail is `provider chain and credentials resolve; no active park`.
- An active hold with source `marker` and reason `peak-hour cost pause`.
- A condition-catalog snapshot and a fix-hint recorder.

**Steps**:
1. Run the doctor command runtime over the injected `DoctorComposition` (`--json` and the human report).
2. Locate the provider check.
3. Assert the verdict, evidence reasons, detail, hint, summary counts, and exit.
4. Compare `DOCTOR_VERDICTS`, `DOCTOR_CONDITION_CATALOG`, and `DoctorSummaryCounts` with the delivered values.
5. Assert the detail starts with the delivered healthy text and then the appended hold segment.

**Expected Outcome**:
- The provider check verdict is `ok`; `evidence.reasons` contains `owner-hold`.
- The detail is exactly `provider chain and credentials resolve; no active park; owner hold active (marker): peak-hour cost pause`; the hold segment is appended, never replacing the healthy text.
- The combined detail is one bounded line, clamped to `DOCTOR_MAX_DETAIL_CHARS`; the near-bound truncation case is TC-HOLDDOCTOR-007 (D18).
- No fix hint is attached; the condition catalog has no `owner.hold` entry; `DOCTOR_VERDICTS` remains the three values and the summary counts are unchanged.
- Exit `0`; the human provider row prints the same combined detail.

**Notes / Clarifications**: Resolved by PM decision D11 (append to the existing bounded detail; never replace).

#### TC-HOLDDOCTOR-002 - Healthy provider + hold without a reason names only the source

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6.2, AC-F6-1, NFR-5, PM D11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-owner-hold.test.ts` (new)
**Tags**: @core, @doctor

**Preconditions**:
- A healthy provider config and an active hold with source `marker` and no reason (empty marker), then a second case with source `env` and no reason (whitespace-only variable).
- The delivered healthy detail `provider chain and credentials resolve; no active park`.

**Steps**:
1. Run the provider check for both cases.
2. Assert the detail and the reason list.
3. Assert the detail contains no dangling separator or empty reason.

**Expected Outcome**:
- The detail is `provider chain and credentials resolve; no active park; owner hold active (marker)` or `...; owner hold active (env)`, with no colon, empty reason, or trailing text after the source.
- The hold segment is appended to the existing detail; the healthy text is retained.
- The reason `owner-hold` is present; the verdict remains `ok`; no hint is attached.
- The detail is one bounded line, clamped to the delivered detail bound.

**Notes / Clarifications**: Resolved by PM decision D11.

#### TC-HOLDDOCTOR-003 - An existing provider defect wins and omits `owner-hold`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.5, AC-F6-2, DEC-10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-owner-hold.test.ts` (new) over the five defect classes
**Tags**: @core, @doctor

**Preconditions**:
- A matrix: (a) invalid provider config; (b) no declared chain; (c) unresolved chain; (d) unresolvable provider credential; (e) credential-caused active park; (f) unreadable park fold.
- An active hold in every case; a healthy control.
- A status runtime over the same hold fact.

**Steps**:
1. Run the provider check for each defect with and without the hold.
2. Assert the verdict, the reason list, the hint, and the exit.
3. Run `status` with the same defect and hold.

**Expected Outcome**:
- Each defect keeps its delivered verdict and reason (`fail` or `unreachable`) and its hint; `owner-hold` is not added to that check; the exit is `1` unchanged.
- The held and no-hold defect reports are byte-identical except where the defect itself differs.
- `status` still shows the hold; the hold is never hidden by a provider defect.

#### TC-HOLDDOCTOR-004 - Held vs no-hold differs only by the additive reason and detail

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.7, AC-F6-3, DM-8, NFR-8, PM D11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-owner-hold.test.ts` (new)
**Tags**: @core, @doctor, @golden

**Preconditions**:
- Identical healthy provider facts, clock, brand, and store; one run with the hold inactive and one with it active.
- A structural JSON diff utility.

**Steps**:
1. Produce both machine reports.
2. Compute the structural difference.
3. Assert the difference set.

**Expected Outcome**:
- The only differences are the added `owner-hold` evidence reason and the appended hold segment on the provider check's existing detail; the delivered healthy prefix is present in both reports.
- Verdict, summary counts, evidence sources and outcomes, condition catalog, and exit are identical.
- No other section, field, or ordering changes.

**Notes / Clarifications**: Resolved by PM decision D11 (append, never replace).

#### TC-HOLDDOCTOR-005 - Inactive hold output is byte-identical to the delivered goldens

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.4, AC-F6-4, NFR-12
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/doctor-output.test.ts` (unchanged) and `tests/fixtures/doctor/golden/{success.json,success-human.txt,mixed-human.txt,summary-1-of-5.txt,summary-2-of-5.txt}` (unchanged)
**Tags**: @golden, @doctor

**Preconditions**:
- The delivered all-ok and mixed-failure facts, with no hold.

**Steps**:
1. Run the doctor command runtime over the delivered facts.
2. Compare bytes with the committed goldens.
3. Assert the summary delta is zero.

**Expected Outcome**:
- Both outputs are byte-identical to the delivered goldens; the provider check's verdict, reason list, detail, evidence, summary counts, and human row are unchanged.
- No golden file is regenerated for the inactive case; the new held golden is a separate file (TC-HOLDDOCTOR-001).

#### TC-HOLDDOCTOR-006 - The reason set is exactly 23 values; the annotation reason and other surfaces are closed

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.4, AC-F6-1, NFR-8, DM-8, DEC-10
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/doctor-contract.test.ts` (modify) and `tests/fixtures/doctor/matrix/cases.ts` (modify)
**Tags**: @structure, @doctor

**Preconditions**:
- The delivered 22-value reason list and the delivered verdict/count/catalog constants.
- The required insertion point: `owner-hold` immediately after `park-credential-cause`.

**Steps**:
1. Update the structure test's expected reason list to 23 values with the insertion.
2. Assert the full ordered list, the three verdicts, the four summary counts, the five areas, the eleven sources, and the condition-catalog length/ids.
3. Assert `owner-hold` has no evidence source, may co-occur with `ok`, and is the fourth and last admissible provider reason (`DOCTOR_MAX_EVIDENCE_REASONS` is four).
4. Assert no `owner.hold` condition, no new evidence source or area, no new hint, and no exit change.

**Expected Outcome**:
- The reason list is exactly 23 values; `owner-hold` is immediately after `park-credential-cause`; every other value keeps its delivered position.
- `owner-hold` is a non-failing annotation reason: no evidence source, admissible on `ok`, and the fourth/last provider reason; it changes no verdict, hint, or exit.
- Verdicts, counts, areas, sources, and catalog are unchanged; the test fails by name under a mutation that adds a verdict, a count, a source, an area, or a condition.
- The change updates the pin deliberately; no assertion is deleted or weakened.

**Notes / Clarifications**: Test-name traceability (review-1 F-11): TC-HOLDDOCTOR-006 ≡ the delivered `TC-DOCTOR-021` contract-vocabulary suite in `tests/structure/doctor-contract.test.ts` (the 23-value ordered reason list and the closed verdict/count/area/source/catalog pins), corroborated by TC-HOLDDOCTOR-007's clamp and co-occurrence assertions in `tests/behaviour/doctor-owner-hold.test.ts`. Both run at the command-runtime/test layer over an injected `DoctorComposition`; no production doctor composition is claimed (D20).

#### TC-HOLDDOCTOR-007 - At the detail bound, the existing detail yields and the whole hold segment is kept

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.2, F-6.6, AC-F6-1, DM-8, DEC-10, D18
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-owner-hold.test.ts` (new) over the provider check and the delivered `DOCTOR_MAX_DETAIL_CHARS` constant
**Tags**: @core, @doctor

**Preconditions**:
- A healthy provider config whose existing detail is at or near `DOCTOR_MAX_DETAIL_CHARS` (for example a bounded neutral-park/announcement detail).
- An active hold with source `marker` and a 160-character sanitized reason; a shorter-reason control.
- The delivered `DOCTOR_MAX_DETAIL_CHARS` value, read from the contract (not hardcoded).

**Steps**:
1. Run the provider check with the long existing detail and the hold.
2. Measure the combined detail length and locate the hold segment.
3. Assert the hold segment is present whole and the existing detail is truncated at a word/character boundary as delivered.
4. Repeat with the shorter-reason control and with no hold.

**Expected Outcome**:
- The combined detail is at most `DOCTOR_MAX_DETAIL_CHARS`.
- The **whole** hold segment (`owner hold active (marker): peak-hour cost pause`) is preserved; it is never cut mid-word and never dropped.
- The existing detail is the part that yields: it is truncated to fit before the hold segment. The no-hold detail remains the delivered unabridged detail.
- The `owner-hold` reason remains present and the verdict stays `ok`; no hint is attached.

**Notes / Clarifications**: Resolved by PM decision D18. The hold segment alone fits within `DOCTOR_MAX_DETAIL_CHARS` at the 160-character reason cap, so it is never unrenderable.

#### TC-HOLDDOCS-001 - The delivery-modes guide states both semantics and the operational rules

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: G-6, AC-DOC-1, F-1, F-2, F-4, D12, D19
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/owner-hold-doc.test.ts` (new) over `doc/guides/delivery-modes.md`, plus a manual read for prose quality
**Tags**: @docs, @conformance

**Preconditions**:
- The updated guide with one subsection covering the hold.

**Steps**:
1. Assert the guide names both example files, `DELIVERY_OS_OWNER_HOLD`, and `DELIVERY_OS_OWNER_HOLD_POLL_SECONDS`.
2. Assert it states the two semantics: provider-window deferral is automatic and time-bounded; an owner hold is manual, indefinite, and outranks windows.
3. Assert it documents environment precedence, marker removal, the fixed default marker path `$HOME/.delivery-os-state/owner-hold` and the absence of a marker-path override, fail-closed unreadable marker, the poll interval, the unbounded driver, the `owner-hold` versus `owner-gate` distinction, and the explicit limit that a mid-flight session is not killed.
4. Assert it states that a held dispatch/claim is a classified refusal at exit `1`, and that a caller wanting deferral semantics treats `owner-hold` as wait/do-not-abort.
5. Assert it states that installation copies both examples inactive and that uninstall removes the delivered examples while preserving an operator hook.
6. Assert it does not claim a new park cause, a state record, or a tenth status section.

**Expected Outcome**:
- Every required token and semantic is present in one place; the denial statements are present.
- A manual read confirms the prose is coherent, links resolve, and no duplicated source of truth is introduced.
- The check is token/semantic-based, not a pinned paragraph, so editorial rewording does not fail it while a lost fact does.

#### TC-HOLDDOCS-002 - The zai guide states MAX composition and the unbounded floor

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: G-6, AC-DOC-2, DEC-4
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/owner-hold-doc.test.ts` (new) over `doc/guides/zai-peak-hours-hook.md` section "Extensibility: condition functions"
**Tags**: @docs, @conformance

**Preconditions**:
- The updated zai guide.

**Steps**:
1. Assert the extension section names the second example and the owner-hold condition.
2. Assert it states that conditions compose by MAX and that the hold keeps sleeping after every time-bounded window ends.
3. Assert it states that a time-bounded condition merged into the owner-hold example inherits the unbounded driver because the hold is the floor.

**Expected Outcome**:
- All three claims are present in the extension section; the existing condition-function contract text remains intact.
- The guide does not imply that the hold expires or that a loop cap applies while held.

#### TC-HOLDDOCS-003 - Feature specs and command pages are reconciled and deny the forbidden additions

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: G-8, AC-DOC-3, NFR-13
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/owner-hold-doc.test.ts` (new), `tests/checks/reference-page-parity.test.ts`, and `tests/checks/help-guide-coverage.test.ts` (unchanged)
**Tags**: @docs, @conformance

**Preconditions**:
- The updated `doc/spec/features/feature-{autonomous-delivery,scheduling-engine,status-digest,doctor}.md` and `doc/planning/oss-tooling/milestones/m1/commands/{queue,status,doctor}.md`.

**Steps**:
1. Assert the scheduling spec describes the global gate, the `owner-hold` blocking/lane reason, the additive payload member, supplied-ref/no-ref claim and dispatch refusal, lane masking (`queue list` retains the full list), the unchanged `queue ready`, and the explicit denials (no park cause, no record kind, no seventh ready condition, no tenth status section).
2. Assert the status spec describes the additive `providers.evidence.ownerHold` member and the unchanged sections/reasons/schema.
3. Assert the doctor spec describes the `owner-hold` non-failing annotation reason (no evidence source, fourth and last provider reason, may co-occur with `ok`), the appended detail and clamp rule, defect precedence, and unchanged verdicts/counts/catalog/exit.
4. Assert the command pages document the new evidence member, the reason/detail, the clamp, the no-ref refusal, the lane masking and `queue list` pointer, and that `queue ready` is unchanged.
5. Run the reference-page/help parity and forbidden-literals checks.

**Expected Outcome**:
- Every affected page describes the declared additions and the denials consistently.
- The reference-page and help-coverage inventories are unchanged because no command or flag is added; the parity checks pass.
- No forbidden brand/product literal is introduced.

#### TC-HOLDDOCS-004 - Every changed guide declares `ados_distribution`; drift guard passes

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-13, AC-DOC-4, ODR-0001
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `bash scripts/.tests/test-doc-distribution.sh`
**Tags**: @docs, @conformance

**Preconditions**:
- Both guides retain the `ados_distribution: redistributable` front-matter marker; no new standalone guide is added.
- A clean sandbox install set.

**Steps**:
1. Run `bash scripts/.tests/test-doc-distribution.sh`.
2. Assert every changed in-scope doc has a valid marker.
3. Assert the derived install set equals the sandbox install set.

**Expected Outcome**:
- The guard exits `0`; both guides are redistributable and installed.
- No missing marker, invalid enum, uninstalled redistributable doc, installed internal doc, or derived-set drift is reported.
- Any new doc would need the marker; this change adds no new guide.

**Notes / Clarifications**: Test-name traceability (review-1 F-11): TC-HOLDDOCS-004 is executed by the drift-guard script `bash scripts/.tests/test-doc-distribution.sh`, which prints per-doc assertions and exits non-zero on drift; it carries no in-test TC id, so the script is the recorded mapping. The `tests/checks/owner-hold-doc.test.ts` suite covers TC-HOLDDOCS-001..003 only.

#### TC-HOLDEDGE-001 - The CLI production composition supplies the hold to every production surface from a temp-HOME marker

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.1, F-4.3, F-4.4, F-5.1, RSK-6, §16, D12, D22
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/owner-hold-composition.test.ts` (new) over `createProductionComposer` in `packages/cli/src/production.ts` with a materialized temp HOME; the queue/claim/dispatch/status composition in `packages/cli/src/edge.ts`
**Tags**: @cli, @structure

**Preconditions**:
- A temp `HOME` created for the test (`mkdtemp`) with a real state directory at `<tempHome>/<brand.stateDirectoryName>` and a marker file `owner-hold` written there containing `peak-hour cost pause` (the production reader closure, not a pre-resolved lambda, performs the read).
- `createProductionComposer` is invoked with `homeDirectory` = the temp HOME and an **injected environment record** (not the ambient process environment); the resulting program drives the surfaces.
- Recording seams supplied through `ProductionCompositionFacts`: a credential port, a GitHub transport, and a harness spawn runner/starter, so a pre-claim refusal proves zero side effects without real credentials or a harness process. The store is the real one created under the temp HOME; record writes by snapshotting the temp state directory before and after each step.
- Controls over the same composer instance: (a) marker deleted; (b) marker restored; (c) marker absent and the brand-derived `<PREFIX>_OWNER_HOLD` set; (d) marker at a non-default path `<tempHome>/other-state/owner-hold` that must not be read.
- No `DoctorComposition` exists in the production program; doctor is exercised only at the command-runtime layer (D20, GAP-T8). No production resident-daemon composition is asserted; the composed supervision seam is conditional (GAP-T7).

**Steps**:
1. Compose the production program over the temp HOME with the marker present. Run `queue plan --json` (and `queue list --json`); assert `ownerHold` is present, `nextActions` is empty, and the first entry's `blocking[0]` is `owner-hold`.
2. Run `queue claim GH-XXX --json` and `queue claim --json` (no ref) through the same program; assert both refusals (`queue.precondition.unmet`, `reason=owner-hold`, no `no-eligible-action`) with zero appended records.
3. Run a dispatch through the same program; assert the pre-claim user-validation refusal at exit `1` with zero leases, sessions, branches, worktrees, attempts, divergences, handovers, and authority changes.
4. Run `status --json`; assert `providers.evidence.ownerHold` carries the marker source and reason, the section state is unchanged, and the exit is `0`.
5. **Mutation control:** delete the marker and re-run steps 1, 2, and 4 through the same composer; assert the hold disappears from queue, claim, and status (no `ownerHold`, no `reason=owner-hold`; the seeded ready entry reaches the delivered non-hold claim path). Restore the marker and assert the held behavior returns (the behavior flips with the marker, proving the closure is wired, not stubbed).
6. Environment control: with no marker, set the brand-derived variable in the injected environment and assert the same queue/claim/status surfaces report source `env`.
7. Non-default-marker control: with the marker only at `<tempHome>/other-state/owner-hold`, assert no surface reports a hold.

**Expected Outcome**:
- Every production surface resolves the same fact from the same fixed production store directory through the composed reader; the tests assert observable queue, claim, dispatch, and status behavior — no source-text grep and no pre-resolved `readOwnerHold` override.
- A wrong state-directory name/prefix, a renamed marker, or a removed dispatch/status hold supply fails at least one behavioral assertion; the marker-removal mutation control proves the wiring is load-bearing.
- The no-ref claim refuses with `owner-hold` before selection, never `no-eligible-action`.
- The no-hold control matches the delivered outputs; the environment source is honoured identically; the non-default marker has no effect (D12).
- Doctor is not part of the production program and is not asserted here (D20); the production resident-daemon entry is not part of this composition pin and is not claimed as wired (D14/GAP-T7).

#### TC-HOLDEDGE-002 - The MCP status composition supplies the same fact

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5.5, AC-F5-3, DM-7, D15
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/owner-hold-composition.test.ts` (new) over `packages/mcp/src/serve.ts`
**Tags**: @mcp, @structure

**Preconditions**:
- A temp home with the marker, and the MCP toolset composed from the same `stateIdentity` directory.
- The CLI status oracle over the same facts.

**Steps**:
1. Invoke the MCP `status` tool.
2. Compare the canonical data with the CLI oracle.
3. Repeat with the environment source.

**Expected Outcome**:
- The MCP status result carries the same `providers.evidence.ownerHold` as the CLI; no MCP-specific reader diverges.
- The environment source is honoured identically.
- No new MCP tool or schema is added.

#### TC-HOLDNEG-001 - No new error identity or domain kind; remediation prose is updated

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, AC-F4-3, NFR-7, DM-6, §8.5, PM D7
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (unchanged) and the error-table/taxonomy review
**Tags**: @core, @conformance

**Preconditions**:
- The delivered error-table row count, identity set, and `DOMAIN_KINDS`.
- The claim refusal and dispatch refusal envelopes from TC-HOLDQUEUE-002/004.

**Steps**:
1. Assert the error-table row count and identity set are unchanged.
2. Assert `DOMAIN_KINDS` is unchanged and no new `kind` discriminant appears.
3. Assert `queue.precondition.unmet` keeps its category, retryability, consequence, projection, and exit; only its remediation prose mentions an operator hold.
4. Classify the refusal row and assert it is user-validation, non-retryable, `not_landed`, and exit `1`.
5. Assert both refusals surface that existing identity.

**Expected Outcome**:
- Zero new error identities and zero new domain kinds.
- The existing row's classification fields are unchanged; its remediation prose names an operator hold as one possible blocking precondition.
- The refusal is a classified user-validation refusal at exit `1` (D19), not an internal wait.
- The refusals carry `queue.precondition.unmet` with the blocking-reason token exactly `owner-hold`; the bounded detail separately names the source and reason, and neither the identity nor the token becomes a new code.

**Notes / Clarifications**: Test-name traceability (review-1 F-11): TC-HOLDNEG-001 ≡ the delivered `TC-VOCAB-002 / TC-VOCAB-003 error identities stay synchronized` suite in `tests/structure/queue-scheduling-contract.test.ts` plus the `TC-SYNC-*` identity-hygiene suite in `tests/checks/error-table-sync.test.ts`, and the `queue.precondition.unmet` remediation-hint expectation in `tests/structure/error-table.test.ts` (the file the identity change updated).

#### TC-HOLDNEG-002 - No new park, record, ready, status, or doctor vocabulary

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-9, AC-F5-4, AC-F6-1, NFR-8, NG-2, NG-3, NG-4, NG-5, NG-13, D16, D17
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts`, `tests/structure/queue-ready-contract.test.ts`, `tests/structure/status-contract.test.ts`, `tests/structure/doctor-contract.test.ts`, and `tests/checks/error-table-sync.test.ts`
**Tags**: @structure, @conformance

**Preconditions**:
- The delivered closed sets and the one declared addition in each of the two allowed vocabularies.

**Steps**:
1. Assert the three park condition types, three causes, three pairings, four recovery states, and five queue record kinds.
2. Assert the six queue-ready condition ids and their order, and assert `QueueReadyPayload` has no `ownerHold` member (D17).
3. Assert the nine status sections, twenty status reasons, and the schema version.
4. Assert the three doctor verdicts, four summary counts, five areas, eleven sources, and exactly twenty-three reasons with the one declared insertion.
5. Assert no new lane state, no new status finding code, and no new doctor condition.

**Expected Outcome**:
- Every set is exactly the delivered set except the two declared additions (`owner-hold` in lane/blocking reasons and `owner-hold` in doctor reasons).
- A mutation that adds any other member fails by name; a mutation that removes a delivered member fails by name.
- No test claims a park, record, ready condition, section, reason, verdict, count, source, area, or condition exists.

**Notes / Clarifications**: Test-name traceability (review-1 F-11): TC-HOLDNEG-002 ≡ the delivered closed-set suites `TC-VOCAB-005` (`tests/structure/queue-scheduling-contract.test.ts`), `TC-DOCTOR-021` (`tests/structure/doctor-contract.test.ts`), the status contract suite (`tests/structure/status-contract.test.ts`), and the queue-ready contract suite (`tests/structure/queue-ready-contract.test.ts`), plus the content/port inventory pins. No separate test function carries this TC id; the mutation controls live in those suites.

#### TC-HOLDNEG-003 - Core stays ambient-free and brand-literal-free

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-8, NFR-11, DEC-8, §21
**Test Type(s)**: Checks, Structure
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/ambient-globals.ts`, `tests/checks/forbidden-literals.test.ts`, `tests/checks/privacy-literals.test.ts`, `tests/structure/owner-hold-composition.test.ts`, and `packages/adapters/src/file/owner-hold-marker.ts`
**Tags**: @core, @security, @conformance

**Preconditions**:
- The new contract/domain files and the edge composition.

**Steps**:
1. Run the ambient-globals AST guard with the new files.
2. Scan core for `process.env`, `Bun.env`, `Deno.env`, `node:fs`, `Date.now`, and ambient path reads.
3. Scan the new files for hardcoded product/brand literals; confirm the environment name is derived from `BrandIdentity.environmentPrefix`.
4. Confirm the marker path is constructed only in `packages/adapters/src/file/owner-hold-marker.ts` from the production home/brand directory, and that no core module reads an ambient path.
5. Confirm no code path reads a store-relocation or marker-path override.

**Expected Outcome**:
- Zero new ambient environment or filesystem reads in core; the guard stays green.
- Zero hardcoded brand/product/binary literals in tooling code; the shell example's two owner-hold settings carry the current product's names (`DELIVERY_OS_OWNER_HOLD`, `DELIVERY_OS_OWNER_HOLD_POLL_SECONDS`) and its hook-protocol variables keep the repository's existing `ADOS_*` convention; adopters edit the example's defaults on rename (D26).
- The marker path is fixed to the production store directory's `owner-hold` in the adapter and accepts no caller-supplied path (D12).

#### TC-HOLDE2E-001 - Operator pause and resume evidence in a disposable HOME

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, AC-F4-3, AC-F4-5, AC-F4-6, AC-F5-1, §18, D12, D13, D19, D20
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: Disposable clone or isolated home under `/tmp/opencode/gh280-e2e`; command transcript recorded in the pull request
**Tags**: @manual, @e2e

**Preconditions**:
- A built/installed CLI in a disposable clone with an isolated `HOME`; no live lease or session is touched.
- The disposable state directory is the current product's brand state directory — `$HOME/.delivery-os-state` for the default `delivery-os` working name (normative form `<home>/<brand.stateDirectoryName>`) — created with mode `0700` (`mkdir -m 700 -p`) before any marker is written. A non-private directory (for example `0775` from a plain `mkdir -p`) is rejected by the state store with `state.permission.denied` at exit `1` before the hold gate, so no queue command ever reports the hold.
- A seeded queue entry and a provider-window park whose `expiresAt` is just in the past.
- A recorded session handle for the resume step. A real resumed session is the only session the evidence capture spawns (§18); if a real resume is unavailable, a synthetic handle that the resume path reuses stands in and the substitution is recorded in the PR.
- Production `doctor` is not composed (D20), so this procedure has no doctor step. The production evidence surfaces used here are the `status` digest, `queue list`, `queue plan`, `lanes`, and `queue claim` with no ref; `dispatch` is conditional and only runs when a GitHub credential is configured (otherwise `dispatch` fails `config.credential.missing` and the automated dispatch cases carry that coverage).

**Steps**:
1. `mkdir -m 700 -p "$HOME/.delivery-os-state"`, then write the `owner-hold` marker there with `peak-hour cost pause`; show `status --json` and `status` reporting `providers.evidence.ownerHold` and the `| owner-hold: peak-hour cost pause` suffix, exit `0`.
2. Run `queue list`, `queue plan`, and `lanes list`; capture `ownerHold` on the list/plan payloads, `owner-hold` as the first `blocking[]` entry, `owner-hold` as the rendered lane reason, and the empty `nextActions` of the held plan. Record the state directory's mode (`0700`) alongside the transcript, and record that a non-private directory would have failed `state.permission.denied` before this point.
3. Run `queue claim` with no ref; capture `queue.precondition.unmet`, `reason=owner-hold` (never `no-eligible-action`), the bounded detail, the zero-record evidence, and the classified user-validation exit `1`; record that a caller must treat `owner-hold` as wait/do-not-abort, never abort as a transient failure.
4. Conditional dispatch leg: only when a GitHub credential is configured, run a dispatch and capture `queue.precondition.unmet` with `reason=owner-hold`, the bounded summary, the zero leases/sessions/branches/worktrees evidence, and exit `1`. Without a credential, record the observed `config.credential.missing` as the unmet prerequisite and note that the automated dispatch cases (TC-HOLDQUEUE-004, TC-HOLDEDGE-001) cover the refusal; do not present the credential failure as hold evidence.
5. Run the read pass and the mutating pass after the park's window has expired; capture the unchanged park record (state `parked` with `parked:<cause>` while `queue list` shows `["owner-hold","parked:<cause>"]`), the absence of `clear-observed`, `recovered`, and incident records, and the empty next actions.
6. Remove the marker; run `status` to show the hold gone; run the next pass and the resume; capture the single recovery triple, the reused session handle/lane identity, and the absence of a new branch/worktree or duplicate session.
7. Record the commands and outputs in the PR; scan for secrets and for live-state paths.

**Expected Outcome**:
- Every step matches the automated assertions: the state directory is `0700` and the hold is visible at `providers.evidence.ownerHold`, on `queue list`/`queue plan`/`lanes`, and at the no-ref claim; the expired park stays parked while held, and removal resumes the preserved state exactly once.
- The transcript records the D19 caller guidance: `owner-hold` means wait/do-not-abort for deferral callers, not a transient retry.
- The transcript contains no doctor step: production does not register `doctor` (GAP-T8). Doctor behavior is proven only by the command-runtime cases.
- The dispatch leg is either absent (no credential) or shows the same hold refusal; the transcript never presents `config.credential.missing` as proof of the hold.
- The evidence contains no secret and no mutation of the live production store directory; the disposable `HOME` is removed afterward.
- The transcript is linked from the PR description; no automated suite depends on this procedure.

## 6. Environments and Test Data

- **Runtimes.** Local development and CI run `bun test` for `tests/**/*.test.ts` and each adjacent `.tests/test-*.sh` suite for shell changes. The aggregate gate is `pnpm check`. No case requires a live provider, credential, daemon, harness CLI, or network.
- **State and facts.** Every TypeScript case builds its facts in memory and injects the environment record, home/production store directory, marker outcome, clock, IDs, store, credential port, transport, and harness session seam. Shell cases source the hook and override `_now_utc_epoch`, `_sleep`, the marker-reader seam, and any condition registry append point; they use `mktemp -d` for the temp HOME, marker, and counter fixtures and trap cleanup.
- **Marker fixtures.** The canonical reason is `peak-hour cost pause`. Every marker fixture lives at the temp HOME's brand state directory plus `owner-hold` (`$HOME/.delivery-os-state/owner-hold` for the current product, whose default working name is `delivery-os`; the suite derives the directory from the brand). Additional fixtures: a zero-byte file; a file whose first line is safe and whose later lines are noise; a 10 KB file; a file with `\u001b[31m`, `\u0007`, `\u0085`, newline, and tab; a directory at the marker path; an injected `EACCES`/`EIO` outcome; a chmod-000 file (skipped as root); a non-default-path marker that must be ignored.
- **Environment fixtures.** A synthetic brand prefix (never a hardcoded product name in core), the derived key set to a reason, set to `""`, set to whitespace only, and unset. The shell suite sets only `DELIVERY_OS_OWNER_HOLD` and `DELIVERY_OS_OWNER_HOLD_POLL_SECONDS` explicitly per case and runs with the temp `HOME`; those are the current product's names, and an adopter who renames the product edits the example's two defaults (D26). No marker-path or store-relocation override exists to set (D12).
- **Queue fixtures.** `tests/fixtures/queue/hold/cases.json` holds the ready/held/not-ready/active-park/stuck-park/resumable/delivering matrix, including the not-ready entry whose `queue list` blocking list is `[owner-hold, dependency-open, ...]` and whose lane renders only `owner-hold`. The store is a real temp JSONL store; record snapshots are taken with a stable key order and compared as bytes. The claim/dispatch cases use recording seams and explicit zero-count assertions; the no-ref claim is a separate leg.
- **Status/doctor fixtures.** `tests/fixtures/status/harness.ts` and `tests/fixtures/doctor/harness.ts` gain a `providers({ ownerHold })` fact helper and a `provider({ ownerHold })` fact helper; the status assertion target is `providers.evidence.ownerHold`. The status corpus gets `tests/fixtures/status/corpus/owner-hold-active/case.json`; the MCP parity gets one success case; the doctor matrix gets hold rows and the near-bound detail row.
- **Isolation.** Every test creates a unique temp directory and never reads the ambient `HOME`, the repository's live production store directory, or a real git remote. The install/uninstall cases run `install.sh --local`/`uninstall.sh --local` against a mock source and a sandbox project under the test temp dir. TC-HOLDE2E-001 runs with a disposable `HOME` outside the worktree.
- **Determinism.** No real sleeps, network calls, `Date.now()` without injection, `Math.random()`, or process spawns. The shell suite shadows `sleep` and any network binary with recording functions and fails if they are invoked.

## 7. Automation Plan and Implementation Mapping

### 7.1 Test files and execution

| Test file / command | Executes | TC IDs | Status |
|---|---|---|---|
| `bun test tests/behaviour/owner-hold-fact.test.ts` | Fact resolution, precedence, inactive shape, sanitizer, fail-closed matrix, no-cache, and the numeric zero-count recorder at the injected-reader/composition boundary (exact reader call shape plus zero credential, transport, store-write, and spawn calls) | TC-HOLDFACT-001, TC-HOLDFACT-002, TC-HOLDFACT-003, TC-HOLDFACT-004, TC-HOLDFACT-005, TC-HOLDFACT-006, TC-HOLDFACT-007, TC-HOLDFACT-009, TC-HOLDFACT-010, TC-HOLDFACT-011 | To implement |
| `bun test tests/behaviour/owner-hold-reader.test.ts` | Bounded real/injected marker reader | TC-HOLDFACT-002, TC-HOLDFACT-005, TC-HOLDFACT-006, TC-HOLDFACT-008, TC-HOLDFACT-009, TC-HOLDFACT-010 | To implement |
| `bash scripts/.tests/test-hook-owner-hold-example.sh` | Condition, driver, poll, removal, MAX, pure-gate, clock, line bounds, hermetic meta | TC-HOLDHOOK-001, TC-HOLDHOOK-002, TC-HOLDHOOK-003, TC-HOLDHOOK-004, TC-HOLDHOOK-005, TC-HOLDHOOK-006, TC-HOLDHOOK-007, TC-HOLDHOOK-008, TC-HOLDHOOK-009 | To implement |
| `bash scripts/run-bash-suites.sh` (discovery) and `shellcheck` | New suite discovery and shellcheck zero findings | TC-HOLDREG-003 | To implement |
| `bash scripts/.tests/test-install.sh` | Install both examples executable and inactive | TC-HOLDREG-001 | Existing — update |
| `bash scripts/.tests/test-uninstall.sh` | Remove both examples and the empty directory, preserve operator hook | TC-HOLDREG-002 | Existing — update |
| `bun test tests/structure/provider-surface.test.ts` | Pinned wrapper/legacy-suite SHA-256 | TC-HOLDREG-004 | Existing — no change |
| `bun test tests/behaviour/queue-hold-schedule.test.ts` | Held pass suppression, lane masking, entry blocking order | TC-HOLDQUEUE-001 | To implement |
| `bun test tests/behaviour/queue-hold-claim.test.ts` | Supplied-ref/no-ref pre-fence claim, fenced claim, bookkeeping, unreadable store | TC-HOLDQUEUE-002, TC-HOLDQUEUE-003, TC-HOLDQUEUE-010, TC-HOLDQUEUE-013 | To implement |
| `bun test tests/behaviour/queue-hold-dispatch.test.ts` | Dispatch claim-seam user-validation refusal and zero side effects | TC-HOLDQUEUE-004 | To implement |
| `bun test tests/behaviour/queue-hold-daemon-watch.test.ts` | Composed supervision derivation and queue watch | TC-HOLDQUEUE-005, TC-HOLDQUEUE-006 | To implement |
| `bun test tests/behaviour/queue-hold-park-resume.test.ts` | Recovery skip, resume, delivering lane | TC-HOLDQUEUE-007, TC-HOLDQUEUE-008, TC-HOLDQUEUE-012 | To implement |
| `bun test tests/behaviour/queue-hold-payload.test.ts` | `ownerHold` presence/absence, payload shape, unchanged `queue ready` | TC-HOLDQUEUE-009 | To implement |
| `bun test tests/behaviour/status-owner-hold.test.ts` | Providers evidence member, section states, human suffix, vocabulary | TC-HOLDSTATUS-001, TC-HOLDSTATUS-002, TC-HOLDSTATUS-003, TC-HOLDSTATUS-005 | To implement |
| `bun test tests/behaviour/mcp-status-parity.test.ts` | CLI/MCP status parity on the evidence member with a hold (delivered suite `TC-MCP-003`) | TC-HOLDSTATUS-004 | Existing — update |
| `bun test tests/behaviour/doctor-owner-hold.test.ts` | `ok` detail, no-reason detail, defect precedence, machine delta, detail clamp | TC-HOLDDOCTOR-001, TC-HOLDDOCTOR-002, TC-HOLDDOCTOR-003, TC-HOLDDOCTOR-004, TC-HOLDDOCTOR-007 | To implement |
| `bun test tests/golden/doctor-output.test.ts` | Inactive doctor bytes and the new held golden | TC-HOLDDOCTOR-005 | Existing — update |
| `bun test tests/structure/doctor-contract.test.ts` | 23-value reason list and closed doctor surfaces (delivered suite `TC-DOCTOR-021`) | TC-HOLDDOCTOR-006 | Existing — update |
| `bun test tests/structure/queue-scheduling-contract.test.ts tests/structure/queue-ready-contract.test.ts` | Closed queue vocabularies; **exact two-way ordered equality** for both lane/blocking arrays (delivered suite `TC-VOCAB-005`) | TC-HOLDQUEUE-011 | Existing — extend the structural test |
| `bun test tests/structure/status-contract.test.ts tests/golden/status-digest.test.ts` | Status vocabulary and golden no-hold bytes | TC-HOLDSTATUS-005 | Existing — no change |
| `bun test tests/behaviour/owner-hold-production-composition.test.ts tests/structure/owner-hold-composition.test.ts` | Production composer (`createProductionComposer`) over a temp HOME with a materialized `<stateDirectoryName>/owner-hold`: queue list/plan, supplied-ref and no-ref claim, dispatch, and status behavior with a marker-removal mutation control and environment-source control (supply proof only; the TC-HOLDFACT-009 zero-count recorder lives in the fact suite at the injected reader boundary); the structure suite keeps the source-text pin as a secondary assertion; MCP status composition supplies the same fact; ambient-free core; no production daemon claim; doctor is not composed (D20) | TC-HOLDEDGE-001, TC-HOLDEDGE-002, TC-HOLDFACT-009, TC-HOLDNEG-003 | To implement |
| `bun test tests/checks/owner-hold-doc.test.ts` | Guide/spec/command-page content and denials | TC-HOLDDOCS-001, TC-HOLDDOCS-002, TC-HOLDDOCS-003 | To implement |
| `bash scripts/.tests/test-doc-distribution.sh` | `ados_distribution` marker and install-set drift (the script is TC-HOLDDOCS-004's mapping; no in-test TC id) | TC-HOLDDOCS-004 | Existing — no change |
| `bun test tests/checks/error-table-sync.test.ts tests/checks/forbidden-literals.test.ts tests/checks/reference-page-parity.test.ts tests/checks/help-guide-coverage.test.ts` | Error identity, literals, reference pages, help coverage (TC-HOLDNEG-001 ≡ `TC-SYNC-*` plus the `queue.precondition.unmet` hint expectation in `tests/structure/error-table.test.ts`) | TC-HOLDNEG-001, TC-HOLDNEG-002, TC-HOLDNEG-003, TC-HOLDDOCS-003 | Existing — no change |
| `bun test tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts` | New file/export/executable inventory pins | TC-HOLDNEG-002, TC-HOLDNEG-003 | Existing — update inventories |
| `pnpm check` | Lint, format, typecheck, full test, boundaries | All automated TCs | Existing — aggregate gate |
| Manual procedure in §5.2 | Operator pause/resume evidence | TC-HOLDE2E-001 | Manual |

### 7.2 New and modified test files

New:

- `tests/behaviour/owner-hold-fact.test.ts`
- `tests/behaviour/owner-hold-reader.test.ts`
- `tests/behaviour/queue-hold-schedule.test.ts`
- `tests/behaviour/queue-hold-claim.test.ts`
- `tests/behaviour/queue-hold-dispatch.test.ts`
- `tests/behaviour/queue-hold-daemon-watch.test.ts`
- `tests/behaviour/queue-hold-park-resume.test.ts`
- `tests/behaviour/queue-hold-payload.test.ts`
- `tests/behaviour/status-owner-hold.test.ts`
- `tests/behaviour/doctor-owner-hold.test.ts`
- `tests/structure/owner-hold-composition.test.ts`
- `tests/checks/owner-hold-doc.test.ts`
- `scripts/.tests/test-hook-owner-hold-example.sh`
- `scripts/hooks/pre-opencode-iteration-owner-hold.sh` (the example under test, not a test file)

Modified:

- `tests/behaviour/queue-lease.test.ts` — extend the delivered claim-precondition matrix with `owner-hold`.
- `tests/behaviour/queue-park.test.ts` — add the held recovery-skip and post-removal recovery pair.
- `tests/behaviour/queue-schedule.test.ts` — add the held lane-masking/entry-projection case.
- `tests/behaviour/queue-watch.test.ts` — add the held watch payload.
- `tests/behaviour/daemon-lane-supervision.test.ts` — add the composed `nextAction` derivation/claim case (conditional guarantee; no production daemon wiring).
- `tests/behaviour/mcp-status-parity.test.ts` — include the owner-hold success case.
- `tests/golden/queue-list.test.ts`, `tests/golden/queue-plan.test.ts` — add the held golden comparison.
- `tests/golden/doctor-output.test.ts` — add the held golden comparison.
- `tests/structure/doctor-contract.test.ts` — deliberate 22→23 reason update plus the annotation-reason assertions.
- `tests/structure/queue-scheduling-contract.test.ts` — **extend the structural test** with exact two-way ordered equality for `QUEUE_LANE_IDLE_REASONS` and `QUEUE_BLOCKING_REASONS` against `closed-sets.json`.
- `tests/fixtures/status/harness.ts` — `providers({ ownerHold })` fact helper (asserted at `providers.evidence.ownerHold`).
- `tests/fixtures/doctor/harness.ts` — `provider({ ownerHold })` helper.
- `tests/fixtures/status/scenarios.ts` — register the `owner-hold-active` corpus scenario.
- `tests/fixtures/mcp/parity/cases.ts` — add the owner-hold success case.
- `tests/fixtures/doctor/matrix/cases.ts` — add the hold rows.
- `scripts/.tests/test-install.sh` — create and assert both example paths.
- `scripts/.tests/test-uninstall.sh` — create and assert both example paths and the preserved operator hook.

### 7.3 Fixture and golden update plan

| File | Change | Reason |
|---|---|---|
| `tests/fixtures/queue/vocabulary/closed-sets.json` | Exact target: add a **new 28-entry `laneIdleReasons` array** (the 27 delivered lane reasons plus `owner-hold` appended) and grow `blockingReasons` **27 → 34** (`owner-hold` at index 27 — the 28th entry — followed by the six condition ids the contract already composes: `deps-satisfied`, `repo-free`, `tier-known`, `no-owner-gate`, `ci-healthy`, `provider-available`). No other array changes. The exact two-way assertions are `expect([...QUEUE_LANE_IDLE_REASONS]).toEqual(closedSets.laneIdleReasons)` (28) and `expect([...QUEUE_BLOCKING_REASONS]).toEqual(closedSets.blockingReasons)` (34); a missing, extra, or reordered member fails by name | DM-5 / AC-F4-9 / D16 / D25 |
| `tests/fixtures/queue/hold/cases.json` | New matrix: ready, held, not-ready, active park, stuck park, resumable park, delivering lane | AC-F4-1, AC-F4-10 |
| `tests/fixtures/queue/golden/queue-list-held.json` | New held list golden | AC-F4-7 |
| `tests/fixtures/queue/golden/queue-plan-held.json` | New held plan golden (empty `nextActions`) | AC-F4-1, AC-F4-7 |
| `tests/fixtures/queue/golden/*` (existing) | **Unchanged**; TC-HOLDQUEUE-009 asserts byte identity | AC-F4-7, NFR-12 |
| `tests/fixtures/status/corpus/owner-hold-active/case.json` | New corpus case with the expected `providers.evidence.ownerHold` member, unchanged section state, and the human suffix | AC-F5-1, AC-F5-2, D15 |
| `tests/fixtures/status/scenarios.ts` | Register the new corpus scenario | AC-F5-1 |
| `tests/fixtures/status/golden/*` (existing) | **Unchanged**; TC-HOLDSTATUS-005 asserts byte identity | AC-F5-4, NFR-12 |
| `tests/fixtures/mcp/parity/cases.ts` | New status success case with `providers.evidence.ownerHold` | AC-F5-3, D15 |
| `tests/fixtures/mcp/golden/status/status-owner-hold.json` | New parity golden, regenerated by `bun run tests/fixtures/mcp/regenerate.ts --write` | AC-F5-3 |
| `tests/fixtures/doctor/golden/owner-hold.json` | New held machine golden with the delivered healthy detail plus the appended hold segment and the `owner-hold` reason | AC-F6-1, PM D11 |
| `tests/fixtures/doctor/golden/owner-hold-human.txt` | New held human golden with the same appended detail | AC-F6-1, AC-F6-3, PM D11 |
| `tests/fixtures/doctor/golden/*` (existing) | **Unchanged**; TC-HOLDDOCTOR-005 asserts byte identity | AC-F6-4 |
| `tests/fixtures/doctor/matrix/cases.ts` | Add the hold rows (ok with reason, ok without reason, each defect + hold, near-bound detail for the clamp) | AC-F6-1, AC-F6-2, D18 |
| `tests/structure/inventory.json` | Register all three new modules: `core` gains `src/contracts/owner-hold.ts` and `src/domain/owner-hold.ts`; `adapters` gains `src/file/owner-hold-marker.ts` (`packages/adapters/src/file/owner-hold-marker.ts`) | NFR-12 |
| `tests/fixtures/ports/v1-contract-inventory.json` | Add the `owner-hold.ts` module exports and the `index.ts` re-exports | NFR-12 |
| `tests/structure/content-inventory.test.ts` | Register the executable allowances for all three modules: `core/src/contracts/owner-hold.ts` (`OWNER_HOLD_*` constants), `core/src/domain/owner-hold.ts` (the resolver), and `adapters/src/file/owner-hold-marker.ts` (the marker reader) | NFR-12 |
| `tests/fixtures/help-guide/coverage.json` | **Unchanged** (no new command or flag) | NG-8 |

Golden regeneration is explicit and reviewed: `bun run tests/fixtures/status/golden/regenerate.ts` only if a status golden must change (it must not for the inactive case), `bun run tests/fixtures/mcp/regenerate.ts --write` for the new parity case, and the doctor held golden is authored from the delivered report and reviewed as a fixture. No blanket rewrite, no assertion deletion, and no loosening from `toEqual`/byte equality to a substring check.

The poll-interval cases are shell-only: accepted, defaulted, and invalid values that emit a warning change no fixture or golden. The doctor held golden is the only new golden whose content depends on the resolved append rule (D11); it must show the delivered healthy prefix followed by the hold segment. The near-bound clamp case (TC-HOLDDOCTOR-007) is behaviour-only and adds no golden.

### 7.4 Non-vacuity and mutation evidence

| Mutation | Expected failing case |
|---|---|
| Remove the `ownerHold` read from the scheduling pass | TC-HOLDQUEUE-001 (next actions reappear) |
| Remove or rename `owner-hold` in `QUEUE_LANE_IDLE_REASONS` | TC-HOLDQUEUE-011: `expect([...QUEUE_LANE_IDLE_REASONS]).toEqual(closedSets.laneIdleReasons)` fails by name |
| Remove or rename `owner-hold` in `QUEUE_BLOCKING_REASONS` | TC-HOLDQUEUE-011: `expect([...QUEUE_BLOCKING_REASONS]).toEqual(closedSets.blockingReasons)` fails by name |
| Remove the hold from `evaluateClaimPreconditions` | TC-HOLDQUEUE-002 (claim succeeds) |
| Gate the no-ref claim after selection | TC-HOLDQUEUE-002 (`no-eligible-action` appears instead of `owner-hold`) |
| Remove the hold from `claimQueueLease` | TC-HOLDQUEUE-003 (fenced claim succeeds) |
| Remove the recovery-pass skip | TC-HOLDQUEUE-007 (a new incident appears) |
| Remove the hold from the production composition (`readOwnerHold` not supplied to queue/status/dispatch) | TC-HOLDEDGE-001 (queue, claim, dispatch, and status all lose the fact under the temp-HOME marker) |
| Remove the materialized marker, or rename the state directory/marker file the production reader uses | TC-HOLDEDGE-001 (the marker-removal mutation control flips queue/claim/status back to unheld; a wrong directory or name is never observed) |
| Replace the evidence member with a field on the section object | TC-HOLDSTATUS-001/002 (evidence assertion fails) |
| Reorder `owner-hold` away from the first blocking position | TC-HOLDQUEUE-001 (blocking[0] and lane masking assertions) |
| Remove the `nextAction` derivation from the held schedule | TC-HOLDQUEUE-005 (derivation spy is not invoked) |
| Remove `owner-hold` from `DOCTOR_EVIDENCE_REASONS` | TC-HOLDDOCTOR-001 / TC-HOLDDOCTOR-006 |
| Drop or truncate the hold segment at the detail bound | TC-HOLDDOCTOR-007 (whole segment assertion) |
| Add a fourth doctor verdict or a fifth count | TC-HOLDDOCTOR-006 fails by name |
| Remove the status evidence attachment | TC-HOLDSTATUS-001 (evidence member absent) |
| Re-add a status reason or a tenth section | TC-HOLDSTATUS-005 / TC-HOLDNEG-002 |
| Add an `ownerHold` member to `queue ready` | TC-HOLDQUEUE-009 (`queue ready` byte identity fails) |
| Remove the reason sanitizer | TC-HOLDFACT-007 (control character or >160) |
| Reinstate a loop cap | TC-HOLDHOOK-003 (cap warning or early return) |
| Accept a non-default marker path or store relocation | TC-HOLDFACT-002/010 and TC-HOLDHOOK-001 (negative controls) |
| Remove the install registration | TC-HOLDREG-001 (missing executable) |
| Add a wrapper edit | TC-HOLDREG-004 (hash mismatch) |
| Add an ambient read in core | TC-HOLDNEG-003 (ambient guard) |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **R-1 — token/detail drift after D7.** The resolved grammar keeps the blocking-reason token exactly `owner-hold` while the bounded detail separately names the source and reason. A later refactor could collapse the two into `owner-hold: reason`, which would satisfy a casual read but break the token contract. Mitigation: TC-HOLDQUEUE-002/003 assert the token and the detail separately, and reject the conflated form explicitly.
- **R-2 — accidental provider gate after D8.** The zai example gates on `zai-coding-plan/*`; a copy-paste of that gate into the owner-hold example would silently disable the pause for non-zai agents. Mitigation: TC-HOLDHOOK-001/002 run both zai and non-zai agent/model pairs and assert identical behaviour.
- **R-3 — root-run permission case.** A `chmod 000` file is readable by root. Mitigation: the deterministic permission case uses an injected `EACCES`; the real chmod case is skipped with a named skip when `getuid() === 0`.
- **R-4 — the 4 096-byte bound is seam-observed.** A reader that reads the whole file and then slices would still pass a naive length assertion. Mitigation: TC-HOLDFACT-008 records the requested read limit and uses a 10 KB file; the mutation evidence requires the limit to be lowered to 1 024 to fail the case.
- **R-5 — no MCP queue surface.** The queue/dispatch composition pin is CLI-only; an MCP queue addition later would need its own pin. Documented in GAP-T4.
- **R-6 — no BSD runner.** Portability is proven by bash builtins and shellcheck, not by an actual macOS run. Documented in GAP-T5.
- **R-7 — golden loosening.** The additive fields tempt a reviewer to regenerate every queue/status/doctor golden. Mitigation: §7.3 marks the inactive goldens unchanged and requires explicit new held goldens; review checks the diff for deleted or weakened assertions.
- **R-8 — mid-flight scope.** The hold is not a kill switch; TC-HOLDQUEUE-012 asserts no signal and no cleanup, not that a session stops. Documented as NG-1.
- **R-9 — production daemon is not wired.** A composed supervision cycle whose `nextAction` seam derives from the held pass is covered; the production resident-daemon entry is not. TC-HOLDQUEUE-005 proves the derivation is non-vacuous, and GAP-T7 records the residual. TC-HOLDE2E-001 is the only real-process evidence.
- **R-10 — status corpus schema.** The corpus `case.json` files have a fixed expected-shape validator; adding `providers.evidence.ownerHold` may require extending that validator rather than only adding a case. The plan assigns that extension to `tests/fixtures/status/corpus`/`tests/behaviour/status-corpus.test.ts` and treats it as a deliberate pin update.
- **R-11 — lane-reason masking.** A lane renders exactly one reason, so `owner-hold` masks a more specific `not-ready` reason on the `lanes` surface. TC-HOLDQUEUE-001 asserts both the lane's single `owner-hold` reason and the full ordered `queue list` blocking list; the guide points operators at `queue list` (F-4.7, RSK-4).
- **R-12 — fixed marker location is an operability constraint.** An operator who relocates the store or expects a custom marker path will see the shell defer while the engine claims. The design intentionally offers no override; TC-HOLDFACT-002/010 and TC-HOLDHOOK-001 assert the negative, and the guide documents the environment source as the relocation-safe alternative (D12, RSK-7).
- **R-13 — doctor is proven only at the command-runtime layer.** The production composer supplies no `DoctorComposition`, so no test can prove an operator-visible doctor hold today and the E2E has no doctor step. Mitigation: every doctor case injects a `DoctorComposition` and asserts the `ok` reason plus the appended segment; GAP-T8 records the residual and `status` (plus the queue read surfaces) carries the production evidence (D20).

### 8.2 Assumptions

- **A-T1 — contract names.** The tests read the delivered `OwnerHoldFact`, `OwnerHoldSource`, `OWNER_HOLD_*`, `QueueSchedulerFacts.ownerHold`, `QueueReadData.ownerHold`, `StatusEvidence.ownerHold` (`providers.evidence.ownerHold`), `DoctorProviderFacts.ownerHold`, `DOCTOR_EVIDENCE_REASONS`, `DOCTOR_MAX_DETAIL_CHARS`, and `DOCTOR_MAX_EVIDENCE_REASONS` from the delivered contracts; the spec's names are the contract, not test-local copies.
- **A-T2 — shell extension points.** The example exposes a marker-read seam and a documented condition-registry append point (or a re-sourceable generated copy) so the MAX case can register a second condition without a real edit. This follows the delivered zai suite's re-source pattern for custom windows.
- **A-T3 — fixed production store directory.** Production always resolves the production home's brand state directory and offers no store relocation or marker-path override; the "no resolvable home directory" case is a pure-resolver case, not a production composition path (D12).
- **A-T4 — no MCP queue tool.** The MCP server's toolset is `status`, `verify-artifact`, and `gate-report`; there is no queue tool to pin.
- **A-T5 — manual evidence is PR-scoped.** TC-HOLDE2E-001 is recorded in the pull request, not in CI, runs with a disposable `HOME`, and may use a synthetic lane fixture for the resume step rather than a live model session.
- **A-T6 — the example is inactive until selected.** Installation copies both examples but never activates either; the shell suites set the hook path explicitly.
- **A-T7 — daemon guarantee is conditional.** Any composed supervision cycle whose `nextAction` seam derives from the held scheduling pass is covered; the production resident-daemon entry is not claimed as wired and remains the resident-daemon spec's residual (D14/GAP-T7).
- **A-T8 — doctor is a command-runtime capability.** All doctor coverage runs `createDoctorCommandRuntime` over an injected `DoctorComposition`; the test plan makes no production doctor claim and the E2E exercises the hold through `status` and the queue read surfaces (D20/GAP-T8).

### 8.3 Open Questions

None. The five planning questions were resolved by the binding PM decisions D7–D11 and are recorded in TC-HOLDQUEUE-002/003 (D7), TC-HOLDHOOK-001/002 (D8), TC-HOLDHOOK-001/009 (D9), TC-HOLDHOOK-004 (D10), and TC-HOLDDOCTOR-001/002/004 (D11). The DoR-1 remediation decisions D12–D19 are binding and are recorded in TC-HOLDFACT-002/010 and TC-HOLDHOOK-001 (D12), TC-HOLDQUEUE-002 (D13), TC-HOLDQUEUE-005 (D14), TC-HOLDSTATUS-001..004 (D15), TC-HOLDQUEUE-011 (D16), TC-HOLDQUEUE-009 (D17), TC-HOLDDOCTOR-007 (D18), and TC-HOLDQUEUE-004/TC-HOLDE2E-001 (D19). The review-iteration decisions D20–D29 are binding and are recorded in TC-HOLDEDGE-001/TC-HOLDDOCTOR-001..007 (D20), TC-HOLDFACT-009 and the composition row in §7.1 (D29 recording placement), TC-HOLDFACT-002/DM-9/TC-HOLDHOOK-001/§6 (D26 current product names), TC-HOLDE2E-001 (D27 executable procedure), the §1/§3.1/§4/§7/§8 surface wording (D28), and TC-HOLDQUEUE-011/§7.3 (D29 fixture position). No open question remains.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-10 | test-plan-writer | Initial plan: 44 ACs mapped to 58 test cases (57 automated, 1 manual); layers, fixtures/goldens, mutation evidence, and five open questions. |
| 1.1 | 2026-11-10 | test-plan-writer | Recorded the binding PM resolutions D7–D11 in the affected cases, removed all five open questions, and corrected the claim token/detail grammar, the no-model-gate assertion, the reason-line grammar, the silent-vs-warning poll fallback, and the doctor appended-detail assertions. TC count and AC coverage are unchanged. |
| 1.2 | 2026-11-10 | test-plan-writer | DoR iteration 1 remediation against spec v1.2: fixed the marker at the production store directory and removed every marker-path/store-relocation reference (D12); gated the no-ref claim before selection (D13); made the supervision guarantee conditional and rewrote the daemon test to prove its derivation (D14, GAP-T7); moved the status member to `providers.evidence.ownerHold` (D15); required exact two-way ordered closed-set equality (D16); narrowed `queue ready` out of the hold surfaces (D17); added the doctor detail-clamp case (D18); recorded the deferral-vs-refusal semantics (D19); corrected the lane-masking, decision-reference, and inventory wording. Added TC-HOLDDOCTOR-007; 59 TCs, 58 automated + 1 manual, 44/44 ACs. |
| 1.3 | 2026-11-10 | test-plan-writer | Review iteration 1 remediation (F-1, F-3, F-6, F-8, F-11; D20, D22, D25). Scoped doctor to the command-runtime layer over an injected `DoctorComposition`, removed the production-doctor claim from AC-F6-1/TC-HOLDEDGE-001, and limited TC-HOLDE2E-001 to the `status` digest plus the queue read surfaces (GAP-T8). Rewrote TC-HOLDEDGE-001 to drive the production reader closure from a temp HOME with a materialized `<stateDirectoryName>/owner-hold` marker through queue/claim/dispatch/status with a marker-removal mutation control. Stated that `owner-hold` is prepended to every gated entry's ordered `blocking[]` including active/stuck parks (TC-HOLDQUEUE-001, AC-F4-1/AC-F4-7). Refreshed §2 (plan exists and validates), §7.3 (`laneIdleReasons` 28 entries; `blockingReasons` 27 → 34 with the six condition ids), and the D1-superseded-by-D12 note. Added explicit test-name mappings for TC-HOLDDOCTOR-006, TC-HOLDQUEUE-011, TC-HOLDSTATUS-004, TC-HOLDNEG-001/002, TC-HOLDDOCS-004 and recording-count assertions for TC-HOLDFACT-009. TC count unchanged at 59 (58 automated + 1 manual); 44/44 ACs. |
| 1.4 | 2026-11-10 | test-plan-writer | Review iteration 2 remediation (F-1, F-2, F-4, F-6, F-7; D26–D29). Aligned every concrete owner-hold name with the current product — `DELIVERY_OS_OWNER_HOLD`, `DELIVERY_OS_OWNER_HOLD_POLL_SECONDS`, `$HOME/.delivery-os-state` — keeping `<PREFIX>`/`<brand.stateDirectoryName>` in normative text and declaring the shell example's defaults as the current names that adopters edit on rename (D26). Made TC-HOLDE2E-001 executable: the state directory is created mode `0700` (a non-private directory fails `state.permission.denied` before the hold gate), the hold is evidenced through the `status` digest, `queue list`/`queue plan`/`lanes`, and a no-ref `queue claim`, and `dispatch` is conditional on a GitHub credential (D27). Removed the remaining claim that `status` alone reported the hold in production, so the production surfaces are the `status` digest plus the queue read surfaces plus the command-runtime doctor capability (D28). Refreshed §10 to 7133 pass / 4 skip / 0 fail across 880 files (7137 tests); moved the TC-HOLDFACT-009 zero-count recorder to the injected-reader/composition boundary (the pure resolver cannot reach those ports) with the real bounded reader driven over a recording filesystem port so the exact per-pass call shape is asserted before the zero credential, transport, store-write, and spawn counters; corrected `owner-hold` to index 27 — the 28th `blockingReasons` entry (D29). TC count unchanged at 59 (58 automated + 1 manual); 44/44 ACs. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| TC-HOLDFACT-001 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-fact.test.ts tests/behaviour/owner-hold-reader.test.ts — fact/reader suite 27/27 |
| TC-HOLDFACT-002 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-fact.test.ts tests/behaviour/owner-hold-reader.test.ts — fact/reader suite 27/27 |
| TC-HOLDFACT-003 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-fact.test.ts tests/behaviour/owner-hold-reader.test.ts — fact/reader suite 27/27 |
| TC-HOLDFACT-004 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-fact.test.ts tests/behaviour/owner-hold-reader.test.ts — fact/reader suite 27/27 |
| TC-HOLDFACT-005 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-fact.test.ts tests/behaviour/owner-hold-reader.test.ts — fact/reader suite 27/27 |
| TC-HOLDFACT-006 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-fact.test.ts tests/behaviour/owner-hold-reader.test.ts — fact/reader suite 27/27 |
| TC-HOLDFACT-007 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-fact.test.ts tests/behaviour/owner-hold-reader.test.ts — fact/reader suite 27/27 |
| TC-HOLDFACT-008 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-fact.test.ts tests/behaviour/owner-hold-reader.test.ts — fact/reader suite 27/27 |
| TC-HOLDFACT-009 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-fact.test.ts tests/behaviour/owner-hold-reader.test.ts — 30/30 (96 expect calls) with the reader-boundary recorder: exact per-pass reader call shape (one existence check, one regular-file check, one 4 096-byte read at the fixed path) and exactly zero credential resolutions, transport requests, store writes, and process spawns; the composition suites 3/3 + 5/5 prove supply |
| TC-HOLDFACT-010 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-fact.test.ts tests/behaviour/owner-hold-reader.test.ts — fact/reader suite 27/27 |
| TC-HOLDFACT-011 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-fact.test.ts tests/behaviour/owner-hold-reader.test.ts — fact/reader suite 27/27 |
| TC-HOLDHOOK-001 | 2026-11-10 | PASS | bash scripts/.tests/test-hook-owner-hold-example.sh — hook suite 13/13 |
| TC-HOLDHOOK-002 | 2026-11-10 | PASS | bash scripts/.tests/test-hook-owner-hold-example.sh — hook suite 13/13 |
| TC-HOLDHOOK-003 | 2026-11-10 | PASS | bash scripts/.tests/test-hook-owner-hold-example.sh — hook suite 13/13 |
| TC-HOLDHOOK-004 | 2026-11-10 | PASS | bash scripts/.tests/test-hook-owner-hold-example.sh — hook suite 13/13 |
| TC-HOLDHOOK-005 | 2026-11-10 | PASS | bash scripts/.tests/test-hook-owner-hold-example.sh — hook suite 13/13 |
| TC-HOLDHOOK-006 | 2026-11-10 | PASS | bash scripts/.tests/test-hook-owner-hold-example.sh — hook suite 13/13 |
| TC-HOLDHOOK-007 | 2026-11-10 | PASS | bash scripts/.tests/test-hook-owner-hold-example.sh — hook suite 13/13 |
| TC-HOLDHOOK-008 | 2026-11-10 | PASS | bash scripts/.tests/test-hook-owner-hold-example.sh — hook suite 13/13 |
| TC-HOLDHOOK-009 | 2026-11-10 | PASS | bash scripts/.tests/test-hook-owner-hold-example.sh — hook suite 13/13 |
| TC-HOLDREG-001 | 2026-11-10 | PASS | bash scripts/.tests/test-install.sh — install 55/55 |
| TC-HOLDREG-002 | 2026-11-10 | PASS | bash scripts/.tests/test-uninstall.sh — uninstall 30/30 |
| TC-HOLDREG-003 | 2026-11-10 | PASS | bash scripts/.tests/test-hook-owner-hold-example.sh && shellcheck — 13/13; shellcheck 0 |
| TC-HOLDREG-004 | 2026-11-10 | PASS | bun test tests/structure/provider-surface.test.ts — 6/6; wrappers byte-unchanged |
| TC-HOLDQUEUE-001 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-schedule.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-002 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-claim.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-003 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-claim.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-004 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-dispatch.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-005 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-daemon-watch.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-006 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-daemon-watch.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-007 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-park-resume.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-008 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-park-resume.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-009 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-payload.test.ts tests/golden/queue-list.test.ts tests/golden/queue-plan.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-010 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-claim.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-011 | 2026-11-10 | PASS | bun test tests/structure/queue-scheduling-contract.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-012 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-park-resume.test.ts — behaviour/structure suite green |
| TC-HOLDQUEUE-013 | 2026-11-10 | PASS | bun test tests/behaviour/queue-hold-claim.test.ts — behaviour/structure suite green |
| TC-HOLDSTATUS-001 | 2026-11-10 | PASS | bun test tests/behaviour/status-owner-hold.test.ts — digest/parity green |
| TC-HOLDSTATUS-002 | 2026-11-10 | PASS | bun test tests/behaviour/status-owner-hold.test.ts — digest/parity green |
| TC-HOLDSTATUS-003 | 2026-11-10 | PASS | bun test tests/behaviour/status-owner-hold.test.ts — digest/parity green |
| TC-HOLDSTATUS-004 | 2026-11-10 | PASS | bun test tests/behaviour/mcp-status-parity.test.ts — digest/parity green |
| TC-HOLDSTATUS-005 | 2026-11-10 | PASS | bun test tests/structure/status-contract.test.ts tests/golden/status-digest.test.ts — digest/parity green |
| TC-HOLDDOCTOR-001 | 2026-11-10 | PASS | bun test tests/behaviour/doctor-owner-hold.test.ts — doctor suite green |
| TC-HOLDDOCTOR-002 | 2026-11-10 | PASS | bun test tests/behaviour/doctor-owner-hold.test.ts — doctor suite green |
| TC-HOLDDOCTOR-003 | 2026-11-10 | PASS | bun test tests/behaviour/doctor-owner-hold.test.ts — doctor suite green |
| TC-HOLDDOCTOR-004 | 2026-11-10 | PASS | bun test tests/behaviour/doctor-owner-hold.test.ts — doctor suite green |
| TC-HOLDDOCTOR-005 | 2026-11-10 | PASS | bun test tests/golden/doctor-output.test.ts — doctor suite green |
| TC-HOLDDOCTOR-006 | 2026-11-10 | PASS | bun test tests/structure/doctor-contract.test.ts — doctor suite green |
| TC-HOLDDOCTOR-007 | 2026-11-10 | PASS | bun test tests/behaviour/doctor-owner-hold.test.ts — doctor suite green |
| TC-HOLDDOCS-001 | 2026-11-10 | PASS | bun test tests/checks/owner-hold-doc.test.ts — 10/10 doc checks; guard no drift |
| TC-HOLDDOCS-002 | 2026-11-10 | PASS | bun test tests/checks/owner-hold-doc.test.ts — 10/10 doc checks; guard no drift |
| TC-HOLDDOCS-003 | 2026-11-10 | PASS | bun test tests/checks/owner-hold-doc.test.ts — 10/10 doc checks; guard no drift |
| TC-HOLDDOCS-004 | 2026-11-10 | PASS | bash scripts/.tests/test-doc-distribution.sh — 10/10 doc checks; guard no drift |
| TC-HOLDEDGE-001 | 2026-11-10 | PASS | bun test tests/behaviour/owner-hold-production-composition.test.ts tests/structure/owner-hold-composition.test.ts — 8/8 (new temp-HOME behavior suite 3/3 plus the 5/5 structure pin); marker removal flips queue/claim/status/dispatch to unheld |
| TC-HOLDEDGE-002 | 2026-11-10 | PASS | bun test tests/behaviour/mcp-status-parity.test.ts tests/behaviour/owner-hold-production-composition.test.ts — 14/14 parity plus the production temp-HOME behavior |
| TC-HOLDNEG-001 | 2026-11-10 | PASS | bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts — identity count unchanged; hint synced |
| TC-HOLDNEG-002 | 2026-11-10 | PASS | bun test tests/structure/queue-scheduling-contract.test.ts tests/structure/status-contract.test.ts tests/structure/doctor-contract.test.ts — closed sets unchanged except the two declared tokens |
| TC-HOLDNEG-003 | 2026-11-10 | PASS | bun run scripts/checks/ambient-globals.ts && bun test tests/structure/owner-hold-composition.test.ts — 173 files clean; core ambient-free |
| TC-HOLDE2E-001 | 2026-11-10 | NOT EXECUTED | manual, disposable HOME at ./tmp/tmpdir/e2e-gh280 (PR-scoped) — Residual; the procedure creates `$HOME/.delivery-os-state` with mode 0700, uses `status` plus the queue read surfaces and a no-ref claim, and keeps `dispatch` conditional on a GitHub credential; recorded in the change record and PR |

Aggregate: `pnpm check` exit 0 (7133 pass, 4 skip, 0 fail; 7137 tests across 880 files); `bash scripts/run-bash-suites.sh` 26/26 suites; `pnpm exec delivery-os plan validate GH-280` verdict=valid; `pnpm build` and `delivery-os --version` 0.0.0; `git diff --check` clean.
