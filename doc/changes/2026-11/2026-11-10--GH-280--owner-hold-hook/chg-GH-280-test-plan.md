---
id: chg-GH-280-test-plan
status: Proposed
created: 2026-11-10T14:30:00Z
last_updated: 2026-11-10T16:00:00Z
owners: [engineering]
service: delivery-os scheduling and pre-iteration hooks
labels: [change, hooks, scheduling, queue, status, doctor, cost-control]
version_impact: minor
summary: "Traceable verification of the GH-280 owner hold: one injected fact resolved from the brand-derived environment variable and the state-directory marker, a DM-1 example hook that sleeps indefinitely while held, a global read-only queue gate that suppresses next actions, refuses claims and dispatches with queue.precondition.unmet/owner-hold, skips park auto-recovery, and preserves every record for resume, plus the additive status providers sibling and the additive doctor owner-hold reason on an otherwise-ok provider check. All 44 acceptance criteria map to 58 test cases (57 automated, one operator-run end-to-end evidence procedure) driven through injected facts, seams, and temp state roots with no real sleep, network, credential, daemon, or harness session; the plan also pins every closed vocabulary and every golden/inventory update the change requires."
links:
  change_spec: ./chg-GH-280-spec.md
  implementation_plan: ./chg-GH-280-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Owner hold that outranks provider windows: pause lanes, not just defer

## 1. Scope and Objectives

This plan protects one operator-intent primitive and the closed vocabularies around it. The primitive is the owner-hold fact: a brand-derived environment variable whose non-empty value is the operator's reason, or a marker file named `owner-hold` inside the exact state directory the store identity carries, resolved with declared precedence, a bounded and sanitized reason, fail-closed marker handling, and no cache. The enforcement is a global read-only gate over that injected fact: while held, one scheduling pass emits no next actions and no preemption proposal, claim and dispatch refuse with the existing `queue.precondition.unmet` identity and the `owner-hold` reason, the mutating park-recovery pass is not invoked, and every record needed to resume is left byte-identical. The visibility is additive: one optional providers sibling in `status` and one `ok` provider detail plus the single new doctor evidence reason `owner-hold`, with no new section, no new status reason, no new verdict, no new summary count, no new condition, and no exit change.

The plan is shaped by four properties that cannot be allowed to pass behind one another:

1. **Fact integrity.** Two sources resolve to one discriminated fact; environment wins; an empty marker is active without a reason; an unreadable, non-regular, or stat-failing marker is active without a reason; a reason is one line, control-free, and at most 160 characters before any payload, line, or log; resolution reads no credential, writes no state, calls no network, and never caches across passes.
2. **Enforcement ordering and side-effect freedom.** The gate runs before parks, readiness conditions, and the lease fence; a held pass writes zero entry, dependency, lease, park, incident, daemon-lane, handoff, attempt, divergence, or authority records; a dispatch refused by the hold creates no lease, session, branch, worktree, attempt, divergence, handover, or authority change.
3. **Resume without repair.** Removing the hold mutates nothing. The next pass sees an inactive fact and the delivered selection, claim, recovery, and session-resume paths run unchanged against the state captured at hold entry, so an overdue park recovers through the delivered pass and a recorded session is resumed rather than re-dispatched.
4. **Closed-vocabulary integrity.** Exactly one lane/blocking reason (`owner-hold`) and exactly one doctor evidence reason (`owner-hold`) are added. Nothing else moves: no park cause, condition type, cause-condition pairing, recovery state, state record kind, queue-ready condition, status section, status reason, doctor verdict, doctor summary count, doctor condition, doctor area, or doctor evidence source.

The most dangerous testing mistakes this plan is designed against are: proving the hold with a fact that a composition resolved once and cached; proving the claim gate only through the pre-fence precheck and never through the fenced claim; proving dispatch refusal without asserting the absence of every side effect; proving recovery was skipped by observing no new records while never seeding a park whose window actually expired; proving resume by asserting "no error" instead of comparing the pre-hold and post-resume records; proving status and doctor with hand-built section objects that bypass the runtime readers; and loosening or deleting a closed-set or golden assertion to make the additive change fit.

### 1.1 In Scope

- The owner-hold contract fact, its two sources, precedence, fail-closed marker outcomes, reason bounds and sanitization, per-resolution budget, per-pass re-resolution, and the no-state-directory case (F-1, DM-1, DM-2, DEC-7, DEC-8; AC-F1-1..AC-F1-9, NFR-1, NFR-5, NFR-10, NFR-11).
- The DM-1 example hook `scripts/hooks/pre-opencode-iteration-owner-hold.sh`: the hold condition, the poll interval and its accepted range, the unbounded MAX driver, the bounded reason line, the pure-gate posture, removal latency, and clock-jump immunity (F-2, DEC-4; AC-F2-1..AC-F2-8, NFR-3, NFR-4, NFR-9).
- Install, uninstall, fixture, and shell-test registration of the new example, and the byte-stability of the SHA-pinned wrappers (F-3; AC-F3-1..AC-F3-4).
- The global queue gate: schedule suppression across ready, held, not-ready, active-park, stuck-park, resumable-park, and delivering-lane states; pre-fence and fenced claim refusal; dispatch claim-seam refusal with a bounded summary; daemon supervision and `queue watch`; park-recovery skip; payload presence; bookkeeping; resume; unreadable queue facts (F-4, DM-3..DM-6, DEC-6, DEC-9; AC-F4-1..AC-F4-11, NFR-2, NFR-4, NFR-7).
- The additive status providers sibling and human suffix, CLI/MCP parity, and the unchanged nine sections / twenty reasons / schema version (F-5, DM-7; AC-F5-1..AC-F5-4, NFR-6, NFR-14).
- The additive doctor `ok` detail and the single new evidence reason `owner-hold`, its insertion position, defect precedence, machine-delta-only behaviour, and byte-identical no-hold output (F-6, DM-8, DEC-10; AC-F6-1..AC-F6-4).
- The production CLI and MCP compositions that resolve and supply the fact to queue, dispatch, status, and doctor (spec §16, RSK-6).
- Documentation and conformance: the two-semantics distinction, the two-example registration, hook composition by MAX, the affected feature specs and command pages, `ados_distribution`, reference-page/help parity, forbidden literals, and the content/contract inventories (C7, C8, NFR-12, NFR-13; AC-DOC-1..AC-DOC-4).

### 1.2 Out of Scope & Known Gaps

- **[OUT] No kill-switch verification.** A hold never signals, kills, parks, or cleans up a mid-flight session or an already-`delivering` lane (NG-1, RSK-5). TC-HOLDQUEUE-012 asserts the lane stays `delivering` and is not signalled; it does not assert any cancellation behaviour.
- **[OUT] No new queue park, record, or ready condition.** No test defines, seeds, or expects a park cause, park condition type, recovery state, state record kind, or seventh queue-ready condition for the hold (NG-2, NG-3, NG-4, DEC-2). TC-HOLDNEG-002 asserts the closed sets are unchanged.
- **[OUT] No new status section or reason.** The hold is an optional sibling on the existing providers section; the nine sections and the twenty-reason set are pinned unchanged (NG-5, DEC-3).
- **[OUT] No new doctor verdict, summary count, condition, source, or area.** The provider check stays `ok` while held; only the `owner-hold` evidence reason and the detail are additive (NG-13, DEC-10).
- **[OUT] No wrapper edits.** `scripts/deliver-ticket.sh`, `scripts/ceo-loop.sh`, and `scripts/batch-deliver.sh` are not changed, and `scripts/ceo-loop.sh` plus `scripts/.tests/test-hook-regression.sh` remain byte-identical under the delivered SHA-256 pin (NG-6, DEC-5).
- **[OUT] No real network, sleep, credential read, daemon, or harness session.** Every automated case injects the clock, sleep, marker-reader, store, credential, transport, and session seams (NG-10). TC-HOLDE2E-001 is the only non-automated evidence and runs against a disposable state root.
- **[GAP-T1 — one operator-run end-to-end proof]** The full "create marker → refused claim/dispatch → expired park stays parked → remove marker → resume with unchanged records and one session" sequence is TC-HOLDE2E-001, executed manually in a disposable clone/state root and recorded in the pull request. It is the only case that exercises a real CLI process end to end; every automated case proves the same facts through the composed program or the delivered seams.
- **[GAP-T2 — real permission failures cannot be produced deterministically on every runner]** The real `chmod 000` marker case is skipped when the test process runs as root (root can read a `000` file); the deterministic permission-error case uses an injected filesystem fact that returns `EACCES`. The real non-regular marker case (a directory at the marker path) is always executable.
- **[GAP-T3 — the 4 096-byte read bound is observed at the reader seam]** TC-HOLDFACT-008 asserts the injected reader requests at most 4 096 bytes and performs one existence check and one read; it does not trace syscalls. The real adapter is additionally exercised over a 10 KB temp file to prove the produced reason is bounded and the extra bytes are not surfaced.
- **[GAP-T4 — no MCP queue surface exists]** The MCP server composes `status`, `verify-artifact`, and `gate-report` only. The queue/dispatch composition pin is therefore CLI-only (TC-HOLDEDGE-001); MCP parity covers `status` (TC-HOLDSTATUS-004, TC-HOLDEDGE-002).
- **[GAP-T5 — BSD/macOS portability is proven by construction, not by a runner]** The new shell example uses bash builtins for existence and read checks and no `stat`/`date -d`; the suite and shellcheck prove the construct, but no BSD runner is part of the automated battery.
- **[GAP-T6 — the reason-line grammar is pinned behaviourally]** The grammar is resolved by PM decision D9: `owner-hold (marker)` or `owner-hold (env)`, then `: reason` only when a reason is present, then `; sleeping Ns`. TC-HOLDHOOK-001/009 assert that grammar, the single-line shape, and the bounds; they do not pin a longer editorial sentence.
- **[Not applicable]** No schema migration, no telemetry exporter, no UI, no new endpoint, no new command, no new flag, and no new configuration key (NG-8, §19).

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-280-spec.md`](./chg-GH-280-spec.md) | Authoritative source: F-1..F-6, 44 ACs (`AC-F1-1..AC-F6-4`, `AC-DOC-1..4`), NFR-1..NFR-14, DM-1..DM-9, DEC-1..DEC-10, Appendix A (precedence), Appendix B (queue gate), Appendix C (ticket traceability), Appendix D (doctor delta) |
| [`chg-GH-280-pm-notes.yaml`](./chg-GH-280-pm-notes.yaml) | Binding PM decisions D1–D6: two sources, global gate not a park, additive status/doctor surface, dedicated example hook, no wrapper changes, refuse claims and skip recovery |
| Implementation plan `./chg-GH-280-plan.yaml` | Not yet authored at test-planning time (phase 4 follows phase 3). This plan owns the required test files and assertions; the implementation plan owns sequencing. If the plan places a case in a different phase, the assertion set here is unchanged. |
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
| [`packages/core/src/app/daemon-supervision.ts`](../../../../packages/core/src/app/daemon-supervision.ts) / [`packages/cli/src/daemon-compose.ts`](../../../../packages/cli/src/daemon-compose.ts) | The supervision cycle whose injected `nextAction` and `claim` seams inherit the gate |
| [`packages/core/src/contracts/status.ts`](../../../../packages/core/src/contracts/status.ts) / [`packages/core/src/domain/status.ts`](../../../../packages/core/src/domain/status.ts) | `StatusSection` (`chain`, `entries`, `parks`), `StatusProviderFacts`, `providersSection`, human rendering |
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
| AC-F1-2 | Marker source active, source `marker`, reason is the first line | TC-HOLDFACT-002, TC-HOLDFACT-011 | `owner-hold-fact.test.ts`, `owner-hold-reader.test.ts` | Unit, Adapter | Automated |
| AC-F1-3 | Environment wins when both sources are active; the marker reason is unused | TC-HOLDFACT-003 | `owner-hold-fact.test.ts` | Unit | Automated |
| AC-F1-4 | Empty environment is inactive; whitespace-only environment is active without a reason | TC-HOLDFACT-004 | `owner-hold-fact.test.ts` | Unit | Automated |
| AC-F1-5 | Existing zero-byte marker is active with source `marker` and no reason | TC-HOLDFACT-005 | `owner-hold-fact.test.ts`, `owner-hold-reader.test.ts` | Unit, Adapter | Automated |
| AC-F1-6 | Unreadable, directory-at-path, or stat-failing marker is active with source `marker` and no reason; never inactive | TC-HOLDFACT-006 | `owner-hold-fact.test.ts`, `owner-hold-reader.test.ts` | Unit, Adapter | Automated |
| AC-F1-7 | Newline, tab, ANSI escape, and over-160-character reason become one line, control-free, at most 160 characters | TC-HOLDFACT-007 | `owner-hold-fact.test.ts` | Unit | Automated |
| AC-F1-8 | No resolvable state directory plus empty environment is inactive with no ambient read; a set environment is active despite the missing directory | TC-HOLDFACT-010 | `owner-hold-fact.test.ts` | Unit | Automated |
| AC-F1-9 | Resolution performs zero network calls, zero credential reads, zero state writes, at most one existence check and one bounded marker read | TC-HOLDFACT-008, TC-HOLDFACT-009 | `owner-hold-fact.test.ts`, `owner-hold-reader.test.ts`, `owner-hold-composition.test.ts` | Unit, Adapter, Structure | Automated |
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
| AC-F4-1 | Held pass: empty `nextActions`, no preemption proposal, `owner-hold` first on ready/held/not-ready/resumable, active parks keep their `parked:` cause rendering, stuck parks stay `park-condition-stuck` | TC-HOLDQUEUE-001, TC-HOLDEDGE-001 | `queue-hold-schedule.test.ts`, `owner-hold-composition.test.ts` | Behaviour, Structure | Automated |
| AC-F4-2 | `queue claim` refuses `queue.precondition.unmet` with the blocking-reason token exactly `owner-hold` and a bounded detail `owner hold active (source): reason`, exits 1, appends zero records; the fenced path refuses too | TC-HOLDQUEUE-002, TC-HOLDQUEUE-003, TC-HOLDNEG-001, TC-HOLDEDGE-001 | `queue-hold-claim.test.ts`, `error-table-sync.test.ts`, `owner-hold-composition.test.ts` | Behaviour, Checks, Structure | Automated |
| AC-F4-3 | Dispatch refuses with `queue.precondition.unmet` and a bounded summary naming the hold; zero leases, sessions, branches, worktrees, attempts, divergences, handover records, and authority changes | TC-HOLDQUEUE-004, TC-HOLDEDGE-001, TC-HOLDE2E-001, TC-HOLDNEG-001 | `queue-hold-dispatch.test.ts`, `owner-hold-composition.test.ts` | Behaviour, Structure | Automated + Manual (E2E) |
| AC-F4-4 | Daemon supervision gets no next action and refuses the claim; `queue watch` streams the hold with an empty action list and claims nothing; zero daemon-lane records | TC-HOLDQUEUE-005, TC-HOLDQUEUE-006 | `queue-hold-daemon-watch.test.ts` | Behaviour | Automated |
| AC-F4-5 | A park whose window expired during the hold appends zero `clear-observed`, `recovered`, and incident records; its bytes are unchanged; the entry is not claimed | TC-HOLDQUEUE-007, TC-HOLDE2E-001 | `queue-hold-park-resume.test.ts` | Behaviour | Automated + Manual (E2E) |
| AC-F4-6 | Removing the hold leaves entries, leases, parks, incidents, daemon lanes, handoffs, and lane identities unchanged; the overdue park recovers through the delivered pass; a recorded session resumes with no duplicate | TC-HOLDQUEUE-008, TC-HOLDE2E-001 | `queue-hold-park-resume.test.ts` | Behaviour | Automated + Manual (E2E) |
| AC-F4-7 | Inactive list/plan/read payloads have no `ownerHold` and are byte-identical; active payloads carry source and optional reason | TC-HOLDQUEUE-009, TC-HOLDSTATUS-005 | `queue-hold-payload.test.ts`, `queue-list.test.ts`, `queue-plan.test.ts` | Golden, Behaviour | Automated |
| AC-F4-8 | `queue add`, `prioritize`, `dep`, and `release` still append their records while held and do not invoke park recovery; claim remains refused | TC-HOLDQUEUE-010 | `queue-hold-claim.test.ts` | Behaviour | Automated |
| AC-F4-9 | Park condition types, causes, pairing, recovery states, record kinds, and the six ready condition ids are unchanged; `owner-hold` is the only added lane/blocking reason | TC-HOLDQUEUE-011, TC-HOLDNEG-002 | `queue-scheduling-contract.test.ts`, `queue-ready-contract.test.ts` | Structure | Automated |
| AC-F4-10 | A lane already `delivering` stays `delivering`, is not signalled or killed, and no partial-session cleanup is attempted | TC-HOLDQUEUE-012 | `queue-hold-park-resume.test.ts` | Behaviour | Automated |
| AC-F4-11 | An unreadable queue store still returns the delivered state failure at exit 2 with no hold-shaped payload; status and doctor still report the hold | TC-HOLDQUEUE-013 | `queue-hold-claim.test.ts`, `status-owner-hold.test.ts`, `doctor-owner-hold.test.ts` | Behaviour | Automated |
| AC-F5-1 | Active hold: the providers section carries the additive `ownerHold` sibling; state, counts, sources, reasons, truncation, and entries are unchanged; exit 0 with nine sections | TC-HOLDSTATUS-001, TC-HOLDSTATUS-002, TC-HOLDEDGE-001, TC-HOLDE2E-001 | `status-owner-hold.test.ts`, `owner-hold-composition.test.ts` | Behaviour, Structure | Automated + Manual (E2E) |
| AC-F5-2 | Human providers line ends with the `owner-hold: reason` token or the bare `owner-hold` token after a pipe separator; the existing bounds hold | TC-HOLDSTATUS-003 | `status-owner-hold.test.ts` | Behaviour | Automated |
| AC-F5-3 | CLI and MCP produce the same `ownerHold` member over the same injected facts; the parity fixture matches | TC-HOLDSTATUS-004, TC-HOLDEDGE-002 | `mcp-status-parity.test.ts`, `owner-hold-composition.test.ts` | Behaviour, Structure | Automated |
| AC-F5-4 | Section order, states, evidence reasons, and schema version are unchanged; no section, state, source, reason, or finding code is added | TC-HOLDSTATUS-005, TC-HOLDNEG-002 | `status-contract.test.ts`, `status-digest.test.ts` | Structure, Golden | Automated |
| AC-F6-1 | Healthy provider + hold: `ok` verdict, `owner-hold` evidence reason, bounded hold segment appended to the existing detail, no hint, no condition-catalog entry, unchanged verdicts/counts, exit 0 | TC-HOLDDOCTOR-001, TC-HOLDDOCTOR-002, TC-HOLDDOCTOR-006, TC-HOLDEDGE-001, TC-HOLDE2E-001 | `doctor-owner-hold.test.ts`, `doctor-contract.test.ts`, `owner-hold-composition.test.ts` | Behaviour, Structure | Automated + Manual (E2E) |
| AC-F6-2 | A provider defect keeps its own `fail`/`unreachable` verdict and reason; `owner-hold` is not added; exit 1 unchanged; status still shows the hold | TC-HOLDDOCTOR-003 | `doctor-owner-hold.test.ts` | Behaviour | Automated |
| AC-F6-3 | Held vs no-hold machine report differs only by the additive reason and detail; verdict, counts, evidence, catalog, and exit are identical | TC-HOLDDOCTOR-004 | `doctor-owner-hold.test.ts` | Behaviour | Automated |
| AC-F6-4 | Inactive hold: doctor machine and human output are byte-identical to the delivered behaviour | TC-HOLDDOCTOR-005 | `doctor-output.test.ts` | Golden | Automated |
| AC-DOC-1 | The delivery-modes guide states the two semantics and documents both sources, precedence, removal, fail-closed marker, poll interval, unbounded driver, and the mid-flight limit | TC-HOLDDOCS-001 | `owner-hold-doc.test.ts` | Conformance | Automated |
| AC-DOC-2 | The zai guide's extension section states MAX composition and that the hold keeps sleeping after every time-bounded window ends | TC-HOLDDOCS-002 | `owner-hold-doc.test.ts` | Conformance | Automated |
| AC-DOC-3 | The affected feature specs and command pages describe the gate, additive members, new reason, unchanged doctor surfaces, and explicitly deny a new park cause/record/ready condition/tenth section | TC-HOLDDOCS-003 | `owner-hold-doc.test.ts`, `reference-page-parity.test.ts`, `help-guide-coverage.test.ts` | Conformance | Automated |
| AC-DOC-4 | Every changed guides document declares `ados_distribution` and the drift guard passes | TC-HOLDDOCS-004 | `test-doc-distribution.sh` | Conformance | Automated |

Legend: *Unit* = `bun:test` pure contract/domain; *Adapter* = bounded reader over a real/injected filesystem; *Structure* = composition/closed-set/import pin; *Behaviour* = command/engine surface over injected facts; *Golden* = committed byte/structural fixture; *Shell* = `scripts/.tests/test-*.sh`; *Conformance* = `tests/checks/**` or a drift-guard script; *Manual* = operator-run evidence. Every automated case runs with no real network, sleep, credential, daemon, or harness session.

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
| DM-7 | `StatusSection.ownerHold?: { source; reason? }` and `StatusProviderFacts.ownerHold?` | TC-HOLDSTATUS-001..005 | Section-level sibling of `chain`/`entries`/`parks`; present only when active; section state is unchanged |
| DM-8 | `DOCTOR_EVIDENCE_REASONS` gains `owner-hold` immediately after `park-credential-cause`; `DoctorProviderFacts.ownerHold?` | TC-HOLDDOCTOR-001..006 | The exact 23-value order is pinned; verdicts, counts, catalog, and exit are untouched |
| DM-9 | Marker path is the store identity's state directory plus `/owner-hold`; the shell mirrors `${ADOS_OWNER_HOLD_FILE:-${ADOS_STATE_DIR:-${HOME}/.ados-state}/owner-hold}` | TC-HOLDFACT-008, TC-HOLDFACT-010, TC-HOLDEDGE-001, TC-HOLDREG-001, TC-HOLDREG-002 | The engine path is derived from the store identity; no caller-supplied path reaches the engine |
| Ports | No new port member; `readOwnerHold?` readers are optional runtime hooks on status/doctor/queue compositions | TC-HOLDEDGE-001, TC-HOLDEDGE-002 | The port-contract inventory moves only for the new contract module's exports |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Coverage note |
|---|---|---|---|
| NFR-1 | ≤ 1 existence check and ≤ 1 bounded marker read (≤ 4 096 bytes) per resolution; zero network, credential reads, state writes, process spawns | TC-HOLDFACT-008, TC-HOLDFACT-009 | Reader seam records the requested bound and the call counts; the real 10 KB file proves the extra bytes are not surfaced |
| NFR-2 | Zero queue entry, dependency, lease, park, incident, daemon-lane, heartbeat, handoff, attempt, divergence, or authority records while held | TC-HOLDQUEUE-002..008, TC-HOLDFACT-009 | Store write counters are asserted at zero; the invocation audit ledger is explicitly not asserted |
| NFR-3 | A new iteration defers within one poll interval; default 300 s; accepted range 1–3 600 s | TC-HOLDHOOK-001, TC-HOLDHOOK-004 | The condition's echoed seconds are the determinism-safe proxy; no wall-clock wait occurs in tests |
| NFR-4 | After removal, the next pass permits eligible claims and the next hook evaluation returns `0`; no restart | TC-HOLDFACT-011, TC-HOLDHOOK-005, TC-HOLDQUEUE-008 | Re-resolution is proven with the same runtime/store instance |
| NFR-5 | Every rendered/persisted reason is one line, free of C0/C1 and ANSI escapes, and ≤ 160 characters | TC-HOLDFACT-007, TC-HOLDHOOK-009, TC-HOLDSTATUS-003, TC-HOLDDOCTOR-001 | Assertions run on produced values, not fixture text; no raw newline or terminal sequence reaches a human surface |
| NFR-6 | Identical injected facts and clock produce byte-identical queue payloads, status digests, doctor reports, and hook decisions | TC-HOLDQUEUE-001, TC-HOLDSTATUS-004, TC-HOLDHOOK-008 | Two runs with identical facts are compared byte-for-byte |
| NFR-7 | 100% of hold-refused dispatches carry `queue.precondition.unmet` and a bounded summary naming the hold and sanitized reason; zero new identities/kinds | TC-HOLDQUEUE-004, TC-HOLDNEG-001 | The dispatch envelope's `error.code` and `error.summary` are read together |
| NFR-8 | Zero new park causes/types/recovery states/record kinds/ready conditions/status sections/status reasons/doctor verdicts; exactly 1 new lane/blocking reason and 1 new doctor evidence reason | TC-HOLDQUEUE-011, TC-HOLDSTATUS-005, TC-HOLDDOCTOR-006, TC-HOLDNEG-002 | Exact array equality in both directions, with the named additions only |
| NFR-9 | The new example performs zero real sleeps and zero network calls in its test; deterministic under the overridden sleep seam; shellcheck zero findings | TC-HOLDREG-003 | A shadowed `sleep` marker proves no real sleep; a network canary proves no call |
| NFR-10 | 100% of unreadable, non-regular, or stat-failing marker outcomes resolve active with no reason; zero resolve inactive | TC-HOLDFACT-006 | Includes injected `EACCES`, a real directory-at-path, and an injected stat failure |
| NFR-11 | Zero new `process.env`/`Bun.env`/`Deno.env` reads or ambient filesystem reads in core; zero hardcoded brand/product literals; the ambient-globals check stays green | TC-HOLDFACT-010, TC-HOLDNEG-003 | Core receives the environment record, state directory, and marker outcome as injected inputs |
| NFR-12 | Every changed closed set, payload shape, reason, and golden is updated deliberately; no assertion is deleted or weakened | TC-HOLDQUEUE-009, TC-HOLDSTATUS-005, TC-HOLDDOCTOR-005, §7.3, §7.4 | Mutation evidence in §7.4 proves each pin fires; review checks the diff for deleted assertions |
| NFR-13 | Every changed guides document declares `ados_distribution`; the drift guard passes | TC-HOLDDOCS-004 | `bash scripts/.tests/test-doc-distribution.sh` |
| NFR-14 | Read-only surfaces stay readable while held; `status` and `doctor` exit 0; the hold never makes a check or section non-ok | TC-HOLDQUEUE-013, TC-HOLDSTATUS-001, TC-HOLDDOCTOR-001 | Queue reads may exit 0 or the delivered state failure; status/doctor exit 0 with the hold |

## 4. Test Types and Layers

| Layer | Framework / location | Pattern | Applied to |
|---|---|---|---|
| Unit (contract/domain) | `bun:test`; `tests/behaviour/owner-hold-fact.test.ts` | `*.test.ts` | Fact resolution, precedence, inactive arm shape, reason sanitizer and 160 bound, fail-closed matrix, no-cache (TC-HOLDFACT-001..011) |
| Adapter/edge contract | `bun:test`; `tests/behaviour/owner-hold-reader.test.ts` | `*.test.ts` | Bounded marker reader over a real temp state root, one existence check, one read, permission/stat/directory outcomes, 10 KB input (TC-HOLDFACT-006/008/009/010) |
| Structure / composition | `bun:test`; `tests/structure/owner-hold-composition.test.ts` | `*.test.ts` | Production CLI and MCP compositions supply the fact to queue, dispatch, status, and doctor; ambient-free core; import/inventory pins (TC-HOLDEDGE-001/002, TC-HOLDNEG-003) |
| Behaviour (queue) | `bun:test`; `tests/behaviour/queue-hold-*.test.ts`, with modifications to `queue-lease.test.ts`, `queue-park.test.ts`, `queue-schedule.test.ts` | `*.test.ts` | Schedule suppression, claim/fenced claim, dispatch seam, daemon/watch, recovery skip, resume, bookkeeping, payload presence, delivering lane, unreadable facts (TC-HOLDQUEUE-001..013) |
| Behaviour (status/doctor) | `bun:test`; `tests/behaviour/status-owner-hold.test.ts`, `tests/behaviour/doctor-owner-hold.test.ts` | `*.test.ts` | Providers sibling, human suffix, section-state independence, MCP parity, doctor `ok` detail, defect precedence, machine delta, inactive byte-identity (TC-HOLDSTATUS-001..005, TC-HOLDDOCTOR-001..005) |
| Golden | `bun:test` reading committed fixtures; explicit regeneration scripts | `tests/fixtures/{queue,status,doctor,mcp}/golden/**` | Queue held payloads, status held corpus case, MCP status parity, doctor held output; inactive goldens stay byte-identical (TC-HOLDQUEUE-009, TC-HOLDSTATUS-004/005, TC-HOLDDOCTOR-004/005) |
| Shell | `bash`; `scripts/.tests/test-hook-owner-hold-example.sh`, `test-install.sh`, `test-uninstall.sh` | `test-*.sh` | Hook condition/driver, hermeticity, install/uninstall registration, fixture extension (TC-HOLDHOOK-001..009, TC-HOLDREG-001..003) |
| Conformance / checks | `bun:test`; `tests/checks/*.test.ts`; `scripts/.tests/test-doc-distribution.sh` | `*.test.ts`, `test-*.sh` | Closed vocabularies, error-table sync, doctor contract, inventories, doc content, forbidden literals, reference-page/help parity, distribution markers (TC-HOLDQUEUE-011, TC-HOLDDOCTOR-006, TC-HOLDNEG-001/002, TC-HOLDDOCS-001..004) |
| Manual | Disposable clone/state root; command transcript in the PR | — | TC-HOLDE2E-001 operator pause/resume evidence |

Rules that bind every layer: `bun:test` only (never Jest/Vitest); fixtures never named `*.test.ts`; permanent suites assert current-tree properties, never a diff against a moving base branch; assertions state the value's meaning, not a count that grows; the aggregate gate is `pnpm check`; bash suites follow strict mode, quoting, `readonly`, and shellcheck.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC / F / NFR |
|---|---|---|---|---|---|
| TC-HOLDFACT-001 | Environment source activates with a derived variable name | Happy Path | Unit | High | AC-F1-1, F-1.1, DM-1, DM-2 |
| TC-HOLDFACT-002 | Marker source activates with its first-line reason | Happy Path | Unit | High | AC-F1-2, F-1.2 |
| TC-HOLDFACT-003 | Environment wins when both sources are active | Edge Case | Unit | High | AC-F1-3, DEC-7 |
| TC-HOLDFACT-004 | Empty environment is inactive; whitespace-only is active without a reason | Edge Case | Unit | High | AC-F1-4, DEC-7 |
| TC-HOLDFACT-005 | Empty marker is active without a reason | Edge Case | Unit | High | AC-F1-5, DEC-7 |
| TC-HOLDFACT-006 | Unreadable, non-regular, and stat-failing markers fail closed | Negative | Unit/Adapter | High | AC-F1-6, NFR-10, RSK-1 |
| TC-HOLDFACT-007 | Reason is sanitized to one control-free line of at most 160 characters | Corner Case | Unit | High | AC-F1-7, NFR-5, RSK-8 |
| TC-HOLDFACT-008 | Marker resolution performs one existence check and one 4 096-byte read | Performance | Adapter | High | AC-F1-9, NFR-1 |
| TC-HOLDFACT-009 | Resolution reads no credential, writes no state, and calls no network | Negative | Unit/Structure | High | AC-F1-9, NFR-1, NFR-2 |
| TC-HOLDFACT-010 | No resolvable state directory leaves only the environment source | Edge Case | Unit | High | AC-F1-8, NFR-11 |
| TC-HOLDFACT-011 | The fact is re-resolved on every pass and never cached | Corner Case | Integration | High | AC-F1-1, AC-F1-2, NFR-4 |
| TC-HOLDHOOK-001 | Active hold sleeps the default poll and prints one reason line | Happy Path | Shell | High | AC-F2-1, NFR-3 |
| TC-HOLDHOOK-002 | Inactive hold returns immediately with no sleep and no line | Happy Path | Shell | High | AC-F2-2 |
| TC-HOLDHOOK-003 | The driver never applies a fixed loop cap while held | Corner Case | Shell | High | AC-F2-3, NFR-9, RSK-2 |
| TC-HOLDHOOK-004 | Poll interval accepts 1–3 600, silently defaults unset/empty/whitespace, and warns on invalid | Negative | Shell | High | AC-F2-4, NFR-3 |
| TC-HOLDHOOK-005 | Removing the marker during a sleep ends the hold at the next evaluation | Edge Case | Shell | High | AC-F2-5, NFR-4 |
| TC-HOLDHOOK-006 | Conditions compose by MAX and the hold remains the floor | Corner Case | Shell | High | AC-F2-6, DEC-4 |
| TC-HOLDHOOK-007 | The hook is a pure gate: no env output, no file, no signal | Negative | Shell | High | AC-F2-7, NG-1 |
| TC-HOLDHOOK-008 | A day-long clock jump neither ends nor extends the hold | Edge Case | Shell | High | AC-F2-8, NFR-6 |
| TC-HOLDHOOK-009 | The sleep line is single-line, source-named, and bounded | Corner Case | Shell | High | AC-F2-1, NFR-5 |
| TC-HOLDREG-001 | Install names and installs both examples executable and inactive | Happy Path | Shell | High | AC-F3-1, DEC-4 |
| TC-HOLDREG-002 | Uninstall removes both examples and the empty hooks directory | Happy Path | Shell | High | AC-F3-2 |
| TC-HOLDREG-003 | The new suite is hermetic, auto-discovered, and shellcheck-clean | Regression | Shell/Checks | High | AC-F3-3, NFR-9 |
| TC-HOLDREG-004 | Pinned wrapper and legacy-suite bytes are unchanged | Regression | Structure | High | AC-F3-4, NG-6, DEC-5 |
| TC-HOLDQUEUE-001 | A held pass suppresses every next action and prepends `owner-hold` | Happy Path | Behaviour | High | AC-F4-1, DM-3, DM-5 |
| TC-HOLDQUEUE-002 | Pre-fence claim refusal names `owner-hold` and appends nothing | Negative | Behaviour | High | AC-F4-2, NFR-2 |
| TC-HOLDQUEUE-003 | The fenced claim refuses before acquiring the fence | Negative | Behaviour | High | AC-F4-2, DM-6 |
| TC-HOLDQUEUE-004 | Dispatch refuses at the claim seam with zero side effects | Negative | Behaviour | High | AC-F4-3, NFR-7, DEC-9 |
| TC-HOLDQUEUE-005 | Daemon supervision receives no action and claims nothing | Negative | Behaviour | High | AC-F4-4, NFR-2 |
| TC-HOLDQUEUE-006 | `queue watch` streams the hold with empty actions and claims nothing | Negative | Behaviour | High | AC-F4-4, NFR-2 |
| TC-HOLDQUEUE-007 | Park auto-recovery is skipped and the park bytes are unchanged | Corner Case | Behaviour | High | AC-F4-5, DEC-6 |
| TC-HOLDQUEUE-008 | Removal resumes preserved state with no duplicate session | Regression | Behaviour | High | AC-F4-6, NFR-4, A-5 |
| TC-HOLDQUEUE-009 | Payload `ownerHold` is present only when active; inactive bytes are identical | Corner Case | Golden | High | AC-F4-7, DM-4 |
| TC-HOLDQUEUE-010 | Bookkeeping still works while held; claim does not | Edge Case | Behaviour | High | AC-F4-8, DEC-6 |
| TC-HOLDQUEUE-011 | Closed queue vocabularies move by exactly one lane reason | Regression | Structure | High | AC-F4-9, NFR-8, DM-5 |
| TC-HOLDQUEUE-012 | A delivering lane is not signalled, killed, or parked | Negative | Behaviour | High | AC-F4-10, NG-1 |
| TC-HOLDQUEUE-013 | Unreadable queue facts still exit 2 with no fabricated hold payload | Negative | Behaviour | High | AC-F4-11, NFR-14 |
| TC-HOLDSTATUS-001 | Active hold adds the providers sibling without changing the section | Happy Path | Behaviour | High | AC-F5-1, DM-7 |
| TC-HOLDSTATUS-002 | The sibling is attached across every providers section state | Edge Case | Behaviour | High | AC-F5-1, F-5.2 |
| TC-HOLDSTATUS-003 | Human status appends the bounded owner-hold suffix | Happy Path | Behaviour | High | AC-F5-2, NFR-5 |
| TC-HOLDSTATUS-004 | CLI and MCP status agree with an active hold | Happy Path | Behaviour | High | AC-F5-3, NFR-6 |
| TC-HOLDSTATUS-005 | Status vocabulary is unchanged and no-hold output is byte-identical | Regression | Structure/Checks | High | AC-F5-4, AC-F4-7, NFR-8 |
| TC-HOLDDOCTOR-001 | Healthy provider + hold keeps `ok` and appends reason plus detail | Happy Path | Behaviour | High | AC-F6-1, DM-8 |
| TC-HOLDDOCTOR-002 | Healthy provider + hold without a reason names only the source | Edge Case | Behaviour | High | AC-F6-1 |
| TC-HOLDDOCTOR-003 | An existing provider defect wins and omits `owner-hold` | Negative | Behaviour | High | AC-F6-2, DEC-10 |
| TC-HOLDDOCTOR-004 | Held vs no-hold differs only by the additive reason and detail | Corner Case | Behaviour | High | AC-F6-3, NFR-8 |
| TC-HOLDDOCTOR-005 | Inactive hold output is byte-identical to the delivered goldens | Regression | Golden | High | AC-F6-4, NFR-12 |
| TC-HOLDDOCTOR-006 | The reason set is exactly 23 values; other doctor surfaces are closed | Regression | Structure | High | AC-F6-1, NFR-8 |
| TC-HOLDDOCS-001 | The delivery-modes guide states both semantics and the operational rules | Happy Path | Conformance | High | AC-DOC-1 |
| TC-HOLDDOCS-002 | The zai guide states MAX composition and the unbounded floor | Happy Path | Conformance | High | AC-DOC-2 |
| TC-HOLDDOCS-003 | Feature specs and command pages are reconciled and deny the forbidden additions | Happy Path | Conformance | High | AC-DOC-3 |
| TC-HOLDDOCS-004 | Every changed guide declares `ados_distribution`; drift guard passes | Edge Case | Conformance | High | AC-DOC-4, NFR-13 |
| TC-HOLDEDGE-001 | The CLI production composition supplies the hold to all four surfaces | Regression | Structure | High | AC-F4-1, AC-F4-2, AC-F4-3, AC-F5-1, AC-F6-1, RSK-6 |
| TC-HOLDEDGE-002 | The MCP status composition supplies the same fact | Regression | Structure | High | AC-F5-3, DM-7 |
| TC-HOLDNEG-001 | No new error identity or domain kind; remediation prose is updated | Regression | Checks | High | AC-F4-2, AC-F4-3, NFR-7 |
| TC-HOLDNEG-002 | No new park, record, ready, status, or doctor vocabulary | Regression | Checks | High | AC-F4-9, AC-F5-4, AC-F6-1, NFR-8 |
| TC-HOLDNEG-003 | Core stays ambient-free and brand-literal-free | Regression | Checks | High | AC-F1-8, NFR-11 |
| TC-HOLDE2E-001 | Operator pause and resume evidence in a disposable root | Manual | Manual | High | AC-F4-3, AC-F4-5, AC-F4-6, AC-F5-1, AC-F6-1 |

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
1. Resolve the fact with the injected environment, state directory, and absent marker outcome.
2. Read the resolved key name from the environment lookup recorded by the test double.
3. Repeat the resolution with a different synthetic brand prefix.

**Expected Outcome**:
- The fact equals `{ active: true, source: "env", reason: "peak-hour cost pause" }`.
- The looked-up key is exactly the brand-derived prefix plus `_OWNER_HOLD`; it is not a bare `OWNER_HOLD` and not a hardcoded `ADOS_` literal in core.
- The second brand produces its own derived key and the same reason.

#### TC-HOLDFACT-002 - Marker source activates with its first-line reason

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.2, AC-F1-2, DM-1, DM-9
**Test Type(s)**: Unit, Adapter
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` and `tests/behaviour/owner-hold-reader.test.ts` (new), the latter over a temp state root
**Tags**: @core, @adapter

**Preconditions**:
- An unset environment source.
- A temp state directory containing a regular `owner-hold` file whose first line is `peak-hour cost pause` and whose later lines contain other text.

**Steps**:
1. Read the marker through the delivered bounded reader.
2. Resolve the fact from the reader outcome.
3. Assert the fact and the source.

**Expected Outcome**:
- The fact is `{ active: true, source: "marker", reason: "peak-hour cost pause" }`; later lines never contribute to the reason.
- The reader performed one existence check and one bounded read on exactly the state directory's `owner-hold` entry.

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
- A zero-byte regular `owner-hold` file exists in the temp state directory.

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
**Related IDs**: F-1.4, AC-F1-6, NFR-10, RSK-1
**Test Type(s)**: Unit, Adapter
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` and `tests/behaviour/owner-hold-reader.test.ts` (new)
**Tags**: @core, @adapter, @security

**Preconditions**:
- Four marker outcomes: (a) an injected `EACCES` on open/read; (b) a real directory at the state directory's `owner-hold` path; (c) an injected stat failure (`EIO`); (d) an injected read failure after a successful stat.
- The environment source unset in every case.
- A real `chmod 000` file case is added and skipped when `process.getuid?.() === 0`.

**Steps**:
1. Resolve each outcome through the pure resolver and the reader.
2. Assert the arm, source, and reason presence.
3. Assert that no outcome resolves inactive.

**Expected Outcome**:
- Every case resolves `{ active: true, source: "marker" }` with no `reason`.
- The result is never `{ active: false }`; the directory case is never treated as absent; the reader does not throw or escape the state directory.
- The skipped root case is named in the test output, not silently omitted.

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
**Related IDs**: F-1.7, AC-F1-9, NFR-1, DM-9
**Test Type(s)**: Adapter
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-reader.test.ts` (new) with an injected filesystem fact and a real 10 KB temp file
**Tags**: @adapter, @perf

**Preconditions**:
- A recording filesystem fact that records every existence check, every open/read call, and the requested byte limit.
- A real temp state root with a 10 KB `owner-hold` file whose first 160 characters are visible ASCII and whose first line continues beyond 4 096 bytes.

**Steps**:
1. Resolve once with the recording fact.
2. Resolve once with the real file and the real reader.
3. Assert the call counts, the requested limit, and the produced reason.

**Expected Outcome**:
- Exactly one existence check and exactly one read per resolution; the read requests at most 4 096 bytes.
- The real 10 KB file yields a reason of at most 160 characters; bytes beyond 4 096 are not surfaced and no second read occurs.
- Zero process spawns: the reader does not shell out to `stat`, `cat`, `head`, or `wc`.

#### TC-HOLDFACT-009 - Resolution reads no credential, writes no state, and calls no network

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1.7, AC-F1-9, NFR-1, NFR-2
**Test Type(s)**: Unit, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` and `tests/structure/owner-hold-composition.test.ts` (new)
**Tags**: @core, @security

**Preconditions**:
- A credential port, transport, and state-write seam that fail the test if invoked.
- An active marker and an active environment case.
- A planted credential canary value in the injected environment record, separate from the hold value.

**Steps**:
1. Resolve both cases through the composition that supplies the fact.
2. Assert the credential/transport/write invocation counts.
3. Assert the resolver's input surface: environment record, state directory, marker outcome only.
4. Scan the resolved fact, the status digest, the doctor report, and the queue payloads for the canary.

**Expected Outcome**:
- Zero credential resolutions, zero network requests, zero state writes, and zero process spawns for either source.
- The resolver has no ambient access; it cannot read `process.env`, the filesystem, or the clock.
- The credential canary appears nowhere; the hold path reads no secret and exposes no secret.

#### TC-HOLDFACT-010 - No resolvable state directory leaves only the environment source

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1.9, AC-F1-8, NFR-11, A-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/owner-hold-fact.test.ts` (new)
**Tags**: @core

**Preconditions**:
- The resolver is called with no state directory and no marker outcome.
- Case A: the environment source is empty/unset. Case B: the environment source is set to `hold reason`.

**Steps**:
1. Resolve both cases.
2. Assert that no path is constructed and no ambient read is attempted.
3. Inspect the recorded inputs for any path fallback.

**Expected Outcome**:
- Case A resolves `{ active: false }`; Case B resolves `{ active: true, source: "env", reason: "hold reason" }`.
- No ambient working directory, `$HOME`, or default path is consulted; the missing directory is not reported by the hold fact (the composition's existing configuration handling owns that).

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
- One composed status/queue runtime over a temp state directory.
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
- `_now_utc_epoch` and `_sleep` overridden; the sleep seam records the requested seconds and removes the marker after the first sleep so the driver terminates.
- An active marker with reason `peak-hour cost pause`; `ADOS_OWNER_HOLD_POLL_SECONDS` unset.
- A non-zai agent/model pair (`ADOS_HOOK_AGENT=ceo` with a model that is not `zai-coding-plan/*`) and a zai pair, run separately, to prove the example has no provider/model activation gate.

**Steps**:
1. Run `main` in the current shell with stdout/stderr captured.
2. Read the recorded sleep log, the exit code, and the captured line count.
3. Evaluate `howLongToSleepDueToOwnerHold` directly before the run to read the condition value.
4. Repeat with the non-zai pair and assert the same condition value and sleep.

**Expected Outcome**:
- The condition echoes `300`; the driver records exactly one sleep of `300`.
- Exactly one deferral line is printed and it matches the resolved grammar `[INFO] (pre-opencode-iteration-owner-hold) owner-hold (marker): peak-hour cost pause; sleeping 300s` (source token in parentheses, reason segment only when present, poll interval last).
- The line is one line with no control or ANSI sequence; no `[WARN]` is printed.
- The non-zai and zai pairs behave identically: there is no `zai-coding-plan/*` or model activation gate in the dedicated owner-hold example.

**Notes / Clarifications**: Resolved by PM decisions D8 (no model gate) and D9 (reason-line grammar).

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
- A non-zai agent/model pair as well as the zai pair.

**Steps**:
1. Evaluate the condition.
2. Run `main` with the recording seams.
3. Repeat with an empty marker and then with the marker removed.
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
- `ADOS_OWNER_HOLD_POLL_SECONDS=1` for a fast logical run; no real sleep.
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
- An active marker; a recording sleep seam.
- A table of values: `1`, `300`, `3600` accepted; `0`, `-1`, `abc`, `1.5`, `99999` rejected with one warning; unset, `""`, and whitespace-only `"   "` accepted silently as the default.
- The variable is unset, set to the empty string, and set to whitespace in three separate runs.

**Steps**:
1. For each value, run the condition and `main` with a one-sleep marker-removal seam.
2. Count the `[WARN]` lines and read the recorded sleep.
3. Run the unset, empty, and whitespace-only cases and count the warnings separately.

**Expected Outcome**:
- Accepted values `1`, `300`, and `3600` echo and sleep exactly that number of seconds; no warning is printed.
- Unset, empty, and whitespace-only values echo and sleep `300` silently, with zero `[WARN]` lines.
- Non-empty invalid values (`0`, `-1`, `abc`, `1.5`, `99999`) echo and sleep `300`, and print exactly one bounded warning naming the poll-interval setting; the result is never `0` and never a busy loop.
- The warning is a single line with no unbounded value echo.

**Notes / Clarifications**: Resolved by PM decision D10 (unset/empty/whitespace silent default; non-empty invalid warns once).

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
- An active marker; a sleep seam that removes the marker during the first sleep.
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
- An active marker; a temp `HOME` and `TMPDIR` snapshotted before the run.
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
- An active marker; a clock seam that starts at `T`, jumps forward by `86 400` after the first evaluation, then backward by `86 400` after the second.
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
- An active marker whose reason is a 300-character string with an ANSI escape and a newline; a source that is `marker` or `env`.
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

#### TC-HOLDQUEUE-001 - A held pass suppresses every next action and prepends `owner-hold`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.1, F-4.2, AC-F4-1, DM-3, DM-5, DEC-2
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
3. Run the pass again with identical facts and compare bytes.
4. Run the no-hold control.

**Expected Outcome**:
- `nextActions` is `[]`; no `preemption` proposal exists.
- The ready entry is `held` with `blocking[0].reason === "owner-hold"`; the held and not-ready entries keep their state and gain `owner-hold` first, followed by their own reasons; the resumable park is `held` with `owner-hold` first.
- The active park stays `parked` with `parked:provider-window`; the stuck park stays `stuck` with `park-condition-stuck`; the delivering lane stays `delivering`.
- Lane projections match Appendix B: the held/ready/resumable entries are `idle-with-reason`/`owner-hold`; the two runs are byte-identical; the no-hold control schedules normally.

#### TC-HOLDQUEUE-002 - Pre-fence claim refusal names `owner-hold` and appends nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.3, AC-F4-2, DM-6, NFR-2, PM D7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-claim.test.ts` (new) and `tests/behaviour/queue-lease.test.ts` (modify the delivered claim-precondition gate matrix)
**Tags**: @core, @queue, @state

**Preconditions**:
- A ready entry in a real temp store; no active park or lease.
- An active hold with reason `peak-hour cost pause`.
- A store write counter and a lease-record reader.

**Steps**:
1. Run `queue claim GH-XXX --json` through the composed program.
2. Read the exit code and the envelope's `error.code` and `error.summary`.
3. Call `evaluateClaimPreconditions` directly with the hold fact and read its `reason` and `detail`.
4. Read the lease/park/incident record counts.

**Expected Outcome**:
- Exit `1`; `error.code === "queue.precondition.unmet"`; the summary starts with the blocking-reason token exactly `reason=owner-hold`.
- The domain precondition carries `reason === "owner-hold"` and a `detail` that separately names the source and the sanitized reason: `owner hold active (marker): peak-hour cost pause`.
- The token is never rewritten as `owner-hold: reason` and never conflated with a park cause rendering (the `parked:` cause template).
- Zero lease, park, incident, entry, and dependency records are appended; the store write count is zero.
- The refusal occurs before park and readiness evaluation, so a more specific readiness reason cannot mask it.

**Notes / Clarifications**: Resolved by PM decision D7 (token exactly `owner-hold`; detail separately names source and reason).

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

**Notes / Clarifications**: Resolved by PM decision D7. The fenced path and the pre-fence path share the token/detail grammar.

#### TC-HOLDQUEUE-004 - Dispatch refuses at the claim seam with zero side effects

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.4, AC-F4-3, DM-6, NFR-7, DEC-9
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
3. Assert every side-effect recorder and ledger.
4. Run the no-hold control.

**Expected Outcome**:
- Exit is the delivered refusal exit; `error.code === "queue.precondition.unmet"`; the bounded summary names the hold and the sanitized reason.
- Zero leases, sessions, branches, worktrees, attempts, divergences, handover records, and authority changes; zero spawns and zero resumes.
- No new error identity or domain kind; the no-hold control dispatches normally.

#### TC-HOLDQUEUE-005 - Daemon supervision receives no action and claims nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.5, AC-F4-4, NFR-2, DEC-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-hold-daemon-watch.test.ts` (new) and `tests/behaviour/daemon-lane-supervision.test.ts` (modify)
**Tags**: @core, @daemon

**Preconditions**:
- A supervision cycle over the held scheduling pass; a recording executor, next-action seam, claim seam, and daemon-lane ledger.
- An available executor to prove the idle path is chosen by the empty action, not by executor unavailability.

**Steps**:
1. Run `runSupervisionCycle` with the held pass.
2. Read the result mode, the claim-call count, the executor-start count, and the daemon-lane records.
3. Assert the no-hold control starts one action.

**Expected Outcome**:
- `nextAction` returns `undefined`; the cycle mode is `idle` (or `supervise-only` when the executor is unavailable); the claim seam is never called with an action.
- Zero daemon-lane records, zero heartbeat records, zero executor starts, zero leases.
- The no-hold control claims and starts exactly one action.

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
**Related IDs**: F-4.7, AC-F4-7, DM-4, NFR-12
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
3. Assert the member shape and the entries' blocking reasons.

**Expected Outcome**:
- Inactive payloads contain no `ownerHold` property and are byte-identical to the delivered goldens; no existing golden file changes.
- Active payloads contain `ownerHold` with `active: true`, the source, and the optional sanitized reason; `nextActions` is empty and the entry blocking lists start with `owner-hold`.
- `QueueLanesData` keeps its delivered shape; no lane payload field is added.

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
**Related IDs**: F-4.11, AC-F4-9, NFR-8, DM-5
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts` and `tests/structure/queue-ready-contract.test.ts` (unchanged except the fixture) plus `tests/fixtures/queue/vocabulary/closed-sets.json` (modify)
**Tags**: @structure, @regression

**Preconditions**:
- The delivered closed sets: 3 park condition types, 3 causes, 3 pairings, 4 recovery states, 5 record kinds, 6 ready condition ids, 6 lane states.
- The updated `blockingReasons` fixture with exactly one added `owner-hold` token in the declared position.

**Steps**:
1. Assert each closed array equals its fixture exactly, in both directions.
2. Assert `QUEUE_LANE_IDLE_REASONS` gains `owner-hold` and `QUEUE_BLOCKING_REASONS` contains it exactly once.
3. Assert the six ready condition ids, their order, tri-state, and evidence vocabulary are unchanged.

**Expected Outcome**:
- Park condition types, causes, pairing, recovery states, record kinds, lane states, and ready condition ids are byte-unchanged.
- `owner-hold` is the only added lane/blocking reason; no duplicate and no other token moves.
- The structural test fails by name if the fixture and the contract disagree in either direction.

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
1. Run the held scheduling pass, lane fold, and supervision cycle.
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
3. Run `status` and `doctor` against the same hold facts.

**Expected Outcome**:
- Both queue commands return the delivered `state.store.torn` failure at exit `2`; no `ownerHold` payload and no hold-shaped success is fabricated.
- `status` and `doctor` still report the hold from their independent injected facts, with the delivered exits.
- The hold never manufactures a queue payload over unreadable state.

#### TC-HOLDSTATUS-001 - Active hold adds the providers sibling without changing the section

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5.1, F-5.6, AC-F5-1, DM-7, NFR-14
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
2. Locate the `providers` section.
3. Compare the section's state, counts, sources, reasons, truncation, and entries against a no-hold run with the same facts.
4. Assert the exit code and section count.

**Expected Outcome**:
- The providers section carries `ownerHold: { source: "marker", reason: "peak-hour cost pause" }`.
- State, counts, sources, reasons, truncation, and entries are identical to the no-hold control; the section is not `unknown` or `degraded` because of the hold.
- Exit `0`; all nine sections are present; zero credential reads and zero state writes occur.

#### TC-HOLDSTATUS-002 - The sibling is attached across every providers section state

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5.2, AC-F5-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-owner-hold.test.ts` (new)
**Tags**: @core, @status

**Preconditions**:
- Four provider fact sets: `observed` (healthy), `degraded` (park-fold failure), `unknown` (config resolution failure), and `unavailable` (not configured).
- An active hold in each.

**Steps**:
1. Aggregate each digest.
2. Assert the providers section state and the `ownerHold` presence.
3. Assert the sibling is absent when the hold is inactive in each of the same four states.

**Expected Outcome**:
- Every held case carries `ownerHold` regardless of the section state; the section state is exactly the one the delivered facts produce.
- The no-hold cases carry no sibling; the sibling does not change counts, reasons, or findings.
- The sibling is attached after derivation, not derived from the provider source outcome.

#### TC-HOLDSTATUS-003 - Human status appends the bounded owner-hold suffix

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5.4, AC-F5-2, NFR-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-owner-hold.test.ts` (new) over `renderStatusHuman`
**Tags**: @core, @status

**Preconditions**:
- A held digest with reason `peak-hour cost pause`; a second with no reason; a third with a 300-character control-laden reason.
- The delivered line/byte bounds.

**Steps**:
1. Render each human digest.
2. Extract the providers line.
3. Assert the suffix, the line count, and the byte bound.

**Expected Outcome**:
- With a reason, the providers line ends with `| owner-hold: peak-hour cost pause`; without a reason, it ends with `| owner-hold`.
- The reason is sanitized and at most 160 characters; the line contains no control character or raw newline.
- The digest stays within the existing human line and byte bounds.

#### TC-HOLDSTATUS-004 - CLI and MCP status agree with an active hold

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5.5, AC-F5-3, NFR-6
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-status-parity.test.ts` (modify), `tests/fixtures/mcp/parity/cases.ts` (modify), and `tests/fixtures/mcp/golden/status/status-owner-hold.json` (new, written by `tests/fixtures/mcp/regenerate.ts --write`)
**Tags**: @cli, @mcp, @golden

**Preconditions**:
- One status fact bundle with `providers.ownerHold` active, shared by the CLI and MCP runtimes.
- A deterministic clock and the same brand.

**Steps**:
1. Run the CLI status oracle and the MCP status tool over the same facts.
2. Canonicalize both data payloads and compare.
3. Compare the canonical payload with the committed parity golden.
4. Replay both surfaces a second time and compare bytes.

**Expected Outcome**:
- Both surfaces carry the same `providers.ownerHold` value; the canonical payloads are identical and match the golden.
- No adapter- or surface-specific field appears; both runs are deterministic.
- Inactive parity cases stay byte-identical.

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

#### TC-HOLDDOCTOR-001 - Healthy provider + hold keeps `ok` and adds reason plus detail

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.1, F-6.2, F-6.6, AC-F6-1, DM-8, DEC-10, PM D11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-owner-hold.test.ts` (new) over the provider check and the composed doctor command in `tests/fixtures/doctor/harness.ts` (modify)
**Tags**: @core, @cli, @doctor

**Preconditions**:
- A healthy provider configuration, resolving credentials, and an empty verified park fold, so the delivered detail is `provider chain and credentials resolve; no active park`.
- An active hold with source `marker` and reason `peak-hour cost pause`.
- A condition-catalog snapshot and a fix-hint recorder.

**Steps**:
1. Run `doctor --json` and the human report.
2. Locate the provider check.
3. Assert the verdict, evidence reasons, detail, hint, summary counts, and exit.
4. Compare `DOCTOR_VERDICTS`, `DOCTOR_CONDITION_CATALOG`, and `DoctorSummaryCounts` with the delivered values.
5. Assert the detail starts with the delivered healthy text and then the appended hold segment.

**Expected Outcome**:
- The provider check verdict is `ok`; `evidence.reasons` contains `owner-hold`.
- The detail is exactly `provider chain and credentials resolve; no active park; owner hold active (marker): peak-hour cost pause` (subject only to the delivered detail bound clamping); the hold segment is appended, never replacing the healthy text.
- The combined detail is one bounded line, clamped to the delivered detail bound.
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
1. Run `doctor --json` and the human report over the delivered facts.
2. Compare bytes with the committed goldens.
3. Assert the summary delta is zero.

**Expected Outcome**:
- Both outputs are byte-identical to the delivered goldens; the provider check's verdict, reason list, detail, evidence, summary counts, and human row are unchanged.
- No golden file is regenerated for the inactive case; the new held golden is a separate file (TC-HOLDDOCTOR-001).

#### TC-HOLDDOCTOR-006 - The reason set is exactly 23 values; other doctor surfaces are closed

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6.4, AC-F6-1, NFR-8, DM-8
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
3. Assert no `owner.hold` condition and no new evidence source or area.

**Expected Outcome**:
- The reason list is exactly 23 values; `owner-hold` is immediately after `park-credential-cause`; every other value keeps its delivered position.
- Verdicts, counts, areas, sources, and catalog are unchanged; the test fails by name under a mutation that adds a verdict, a count, a source, an area, or a condition.
- The change updates the pin deliberately; no assertion is deleted or weakened.

#### TC-HOLDDOCS-001 - The delivery-modes guide states both semantics and the operational rules

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: G-6, AC-DOC-1, F-1, F-2, F-4
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/owner-hold-doc.test.ts` (new) over `doc/guides/delivery-modes.md`, plus a manual read for prose quality
**Tags**: @docs, @conformance

**Preconditions**:
- The updated guide with one subsection covering the hold.

**Steps**:
1. Assert the guide names both example files, `ADOS_OWNER_HOLD`, `ADOS_OWNER_HOLD_FILE`, and `ADOS_OWNER_HOLD_POLL_SECONDS`.
2. Assert it states the two semantics: provider-window deferral is automatic and time-bounded; an owner hold is manual, indefinite, and outranks windows.
3. Assert it documents environment precedence, marker removal, fail-closed unreadable marker, the poll interval, the unbounded driver, and the explicit limit that a mid-flight session is not killed.
4. Assert it states that installation copies both examples inactive and that uninstall removes the delivered examples while preserving an operator hook.
5. Assert it does not claim a new park cause, a state record, or a tenth status section.

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
1. Assert the scheduling spec describes the global gate, the `owner-hold` blocking/lane reason, the additive payload member, claim/dispatch refusal, and the explicit denials (no park cause, no record kind, no seventh ready condition).
2. Assert the status spec describes the additive sibling and the unchanged sections/reasons/schema.
3. Assert the doctor spec describes the additive reason/detail, defect precedence, and unchanged verdicts/counts/catalog/exit.
4. Assert the command pages document the new member/reason/detail and the refusal reason.
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

#### TC-HOLDEDGE-001 - The CLI production composition supplies the hold to all four surfaces

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4.1, F-4.3, F-4.4, F-5.1, F-6.1, RSK-6, §16
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/owner-hold-composition.test.ts` (new) over the production composer in `packages/cli/src/production.ts` and the queue/status/doctor composition in `packages/cli/src/edge.ts`
**Tags**: @cli, @structure

**Preconditions**:
- A temp home whose brand state-directory `owner-hold` file exists with `peak-hour cost pause`.
- The production composer over an injected environment record, a temp store, and recording credential/transport/harness seams.
- The same home without the marker as the control.

**Steps**:
1. Run a queue read (plan) and assert the payload carries `ownerHold` and an empty action list.
2. Run a queue claim and assert the refusal.
3. Run a dispatch and assert the pre-claim refusal with zero side effects.
4. Run `status --json` and `doctor --json` and assert the providers sibling and the doctor reason plus the appended hold segment on the existing provider detail.
5. Repeat all four without the marker and assert the delivered no-hold outputs.

**Expected Outcome**:
- Every surface resolves the same fact from the same state directory; a composition that omits the fact fails at least one assertion.
- The environment source is also read: setting the brand-derived variable instead of the marker produces the same four surfaces with source `env`.
- The no-hold control is byte-identical to the delivered outputs.

#### TC-HOLDEDGE-002 - The MCP status composition supplies the same fact

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5.5, AC-F5-3, DM-7
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
- The MCP status result carries the same `providers.ownerHold` as the CLI; no MCP-specific reader diverges.
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
4. Assert both refusals surface that existing identity.

**Expected Outcome**:
- Zero new error identities and zero new domain kinds.
- The existing row's classification fields are unchanged; its remediation prose names an operator hold as one possible blocking precondition.
- The refusals carry `queue.precondition.unmet` with the blocking-reason token exactly `owner-hold`; the bounded detail separately names the source and reason, and neither the identity nor the token becomes a new code.

#### TC-HOLDNEG-002 - No new park, record, ready, status, or doctor vocabulary

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-9, AC-F5-4, AC-F6-1, NFR-8, NG-2, NG-3, NG-4, NG-5, NG-13
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts`, `tests/structure/queue-ready-contract.test.ts`, `tests/structure/status-contract.test.ts`, `tests/structure/doctor-contract.test.ts`, and `tests/checks/error-table-sync.test.ts`
**Tags**: @structure, @conformance

**Preconditions**:
- The delivered closed sets and the one declared addition in each of the two allowed vocabularies.

**Steps**:
1. Assert the three park condition types, three causes, three pairings, four recovery states, and five queue record kinds.
2. Assert the six queue-ready condition ids and their order.
3. Assert the nine status sections, twenty status reasons, and the schema version.
4. Assert the three doctor verdicts, four summary counts, five areas, eleven sources, and exactly twenty-three reasons with the one declared insertion.
5. Assert no new lane state, no new status finding code, and no new doctor condition.

**Expected Outcome**:
- Every set is exactly the delivered set except the two declared additions (`owner-hold` in lane/blocking reasons and `owner-hold` in doctor reasons).
- A mutation that adds any other member fails by name; a mutation that removes a delivered member fails by name.
- No test claims a park, record, ready condition, section, reason, verdict, count, source, area, or condition exists.

#### TC-HOLDNEG-003 - Core stays ambient-free and brand-literal-free

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-8, NFR-11, DEC-8, §21
**Test Type(s)**: Checks, Structure
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/ambient-globals.ts`, `tests/checks/forbidden-literals.test.ts`, `tests/checks/privacy-literals.test.ts`, and `tests/structure/owner-hold-composition.test.ts`
**Tags**: @core, @security, @conformance

**Preconditions**:
- The new contract/domain files and the edge composition.

**Steps**:
1. Run the ambient-globals AST guard with the new files.
2. Scan core for `process.env`, `Bun.env`, `Deno.env`, `node:fs`, `Date.now`, and ambient path reads.
3. Scan the new files for hardcoded product/brand literals; confirm the environment name is derived from `BrandIdentity.environmentPrefix`.
4. Confirm the marker path is constructed only in the CLI/MCP composition from the store identity's directory.

**Expected Outcome**:
- Zero new ambient environment or filesystem reads in core; the guard stays green.
- Zero hardcoded brand/product/binary literals in tooling code; the shell example uses the repository's existing `ADOS_*` convention only.
- The engine marker path is fixed to the store identity's directory and accepts no caller-supplied path.

#### TC-HOLDE2E-001 - Operator pause and resume evidence in a disposable root

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-3, AC-F4-5, AC-F4-6, AC-F5-1, AC-F6-1, §18
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: Disposable clone or isolated home under `/tmp/opencode/gh280-e2e`; command transcript recorded in the pull request
**Tags**: @manual, @e2e

**Preconditions**:
- A built/installed CLI in a disposable clone; an isolated `HOME`/state root; no live lease or session is touched.
- A seeded queue entry and a provider-window park whose `expiresAt` is just in the past.
- A recorded session handle for the resume step. A real resumed session is the only session the evidence capture spawns (§18); if a real resume is unavailable, a synthetic handle that the resume path reuses stands in and the substitution is recorded in the PR.

**Steps**:
1. Create the `owner-hold` marker in the disposable state directory with `peak-hour cost pause`; show `status --json` and `status` reporting the providers sibling and the `| owner-hold: peak-hour cost pause` suffix.
2. Show `doctor --json` and `doctor` reporting the `ok` provider check with the `owner-hold` reason and the hold segment appended to the delivered healthy detail, `provider chain and credentials resolve; no active park; owner hold active (marker): peak-hour cost pause`, exit `0`.
3. Run `queue claim` and a dispatch; capture `queue.precondition.unmet`, `reason=owner-hold`, the bounded detail/summary, and the zero-record/zero-session evidence.
4. Run the read pass and the mutating pass after the park's window has expired; capture the unchanged park record and the absence of `clear-observed`, `recovered`, and incident records.
5. Remove the marker; run `status`/`doctor` to show the hold gone; run the next pass and the resume; capture the single recovery triple, the reused session handle/lane identity, and the absence of a new branch/worktree or duplicate session.
6. Record the commands and outputs in the PR; scan for secrets and for live-state paths.

**Expected Outcome**:
- Every step matches the automated assertions: the hold is visible, claims and dispatches refuse with the existing identity, the expired park stays parked while held, and removal resumes the preserved state exactly once.
- The evidence contains no secret and no mutation of the live state root; the disposable root is removed afterward.
- The transcript is linked from the PR description; no automated suite depends on this procedure.

## 6. Environments and Test Data

- **Runtimes.** Local development and CI run `bun test` for `tests/**/*.test.ts` and each adjacent `.tests/test-*.sh` suite for shell changes. The aggregate gate is `pnpm check`. No case requires a live provider, credential, daemon, harness CLI, or network.
- **State and facts.** Every TypeScript case builds its facts in memory and injects the environment record, state directory, marker outcome, clock, IDs, store, credential port, transport, and harness session seam. Shell cases source the hook and override `_now_utc_epoch`, `_sleep`, the marker-reader seam, and any condition registry append point; they use `mktemp -d` for marker and counter fixtures and trap cleanup.
- **Marker fixtures.** The canonical reason is `peak-hour cost pause`. Additional fixtures: a zero-byte file; a file whose first line is safe and whose later lines are noise; a 10 KB file; a file with `\u001b[31m`, `\u0007`, `\u0085`, newline, and tab; a directory at the marker path; an injected `EACCES`/`EIO` outcome; a chmod-000 file (skipped as root).
- **Environment fixtures.** A synthetic brand prefix (never a hardcoded `ADOS_` in core), the derived key set to a reason, set to `""`, set to whitespace only, and unset. The shell suite sets `ADOS_OWNER_HOLD`, `ADOS_OWNER_HOLD_FILE`, and `ADOS_OWNER_HOLD_POLL_SECONDS` explicitly per case.
- **Queue fixtures.** `tests/fixtures/queue/hold/cases.json` holds the ready/held/not-ready/active-park/stuck-park/resumable/delivering matrix. The store is a real temp JSONL store; record snapshots are taken with a stable key order and compared as bytes. The claim/dispatch cases use recording seams and explicit zero-count assertions.
- **Status/doctor fixtures.** `tests/fixtures/status/harness.ts` and `tests/fixtures/doctor/harness.ts` gain a `providers({ ownerHold })` helper and a `provider({ ownerHold })` helper. The status corpus gets `tests/fixtures/status/corpus/owner-hold-active/case.json`; the MCP parity gets one success case; the doctor matrix gets hold rows.
- **Isolation.** Every test creates a unique temp directory and never reads `process.env.HOME`, the repository's live state directory, or a real git remote. The install/uninstall cases run `install.sh --local`/`uninstall.sh --local` against a mock source and a sandbox project under the test temp dir. TC-HOLDE2E-001 runs in a disposable root outside the worktree.
- **Determinism.** No real sleeps, network calls, `Date.now()` without injection, `Math.random()`, or process spawns. The shell suite shadows `sleep` and any network binary with recording functions and fails if they are invoked.

## 7. Automation Plan and Implementation Mapping

### 7.1 Test files and execution

| Test file / command | Executes | TC IDs | Status |
|---|---|---|---|
| `bun test tests/behaviour/owner-hold-fact.test.ts` | Fact resolution, precedence, inactive shape, sanitizer, fail-closed matrix, no-cache | TC-HOLDFACT-001, TC-HOLDFACT-002, TC-HOLDFACT-003, TC-HOLDFACT-004, TC-HOLDFACT-005, TC-HOLDFACT-006, TC-HOLDFACT-007, TC-HOLDFACT-009, TC-HOLDFACT-010, TC-HOLDFACT-011 | To implement |
| `bun test tests/behaviour/owner-hold-reader.test.ts` | Bounded real/injected marker reader | TC-HOLDFACT-002, TC-HOLDFACT-005, TC-HOLDFACT-006, TC-HOLDFACT-008, TC-HOLDFACT-009, TC-HOLDFACT-010 | To implement |
| `bash scripts/.tests/test-hook-owner-hold-example.sh` | Condition, driver, poll, removal, MAX, pure-gate, clock, line bounds, hermetic meta | TC-HOLDHOOK-001, TC-HOLDHOOK-002, TC-HOLDHOOK-003, TC-HOLDHOOK-004, TC-HOLDHOOK-005, TC-HOLDHOOK-006, TC-HOLDHOOK-007, TC-HOLDHOOK-008, TC-HOLDHOOK-009 | To implement |
| `bash scripts/run-bash-suites.sh` (discovery) and `shellcheck` | New suite discovery and shellcheck zero findings | TC-HOLDREG-003 | To implement |
| `bash scripts/.tests/test-install.sh` | Install both examples executable and inactive | TC-HOLDREG-001 | Existing — update |
| `bash scripts/.tests/test-uninstall.sh` | Remove both examples and the empty directory, preserve operator hook | TC-HOLDREG-002 | Existing — update |
| `bun test tests/structure/provider-surface.test.ts` | Pinned wrapper/legacy-suite SHA-256 | TC-HOLDREG-004 | Existing — no change |
| `bun test tests/behaviour/queue-hold-schedule.test.ts` | Held pass suppression across entry/lane states | TC-HOLDQUEUE-001 | To implement |
| `bun test tests/behaviour/queue-hold-claim.test.ts` | Pre-fence/fenced claim, bookkeeping, unreadable store | TC-HOLDQUEUE-002, TC-HOLDQUEUE-003, TC-HOLDQUEUE-010, TC-HOLDQUEUE-013 | To implement |
| `bun test tests/behaviour/queue-hold-dispatch.test.ts` | Dispatch claim-seam refusal and zero side effects | TC-HOLDQUEUE-004 | To implement |
| `bun test tests/behaviour/queue-hold-daemon-watch.test.ts` | Daemon supervision and queue watch | TC-HOLDQUEUE-005, TC-HOLDQUEUE-006 | To implement |
| `bun test tests/behaviour/queue-hold-park-resume.test.ts` | Recovery skip, resume, delivering lane | TC-HOLDQUEUE-007, TC-HOLDQUEUE-008, TC-HOLDQUEUE-012 | To implement |
| `bun test tests/behaviour/queue-hold-payload.test.ts` | `ownerHold` presence/absence and payload shape | TC-HOLDQUEUE-009 | To implement |
| `bun test tests/behaviour/status-owner-hold.test.ts` | Providers sibling, section states, human suffix, vocabulary | TC-HOLDSTATUS-001, TC-HOLDSTATUS-002, TC-HOLDSTATUS-003, TC-HOLDSTATUS-005 | To implement |
| `bun test tests/behaviour/mcp-status-parity.test.ts` | CLI/MCP status parity with a hold | TC-HOLDSTATUS-004 | Existing — update |
| `bun test tests/behaviour/doctor-owner-hold.test.ts` | `ok` detail, no-reason detail, defect precedence, machine delta | TC-HOLDDOCTOR-001, TC-HOLDDOCTOR-002, TC-HOLDDOCTOR-003, TC-HOLDDOCTOR-004 | To implement |
| `bun test tests/golden/doctor-output.test.ts` | Inactive doctor bytes and the new held golden | TC-HOLDDOCTOR-005 | Existing — update |
| `bun test tests/structure/doctor-contract.test.ts` | 23-value reason list and closed doctor surfaces | TC-HOLDDOCTOR-006 | Existing — update |
| `bun test tests/structure/queue-scheduling-contract.test.ts tests/structure/queue-ready-contract.test.ts` | Closed queue vocabularies and the one lane reason | TC-HOLDQUEUE-011 | Existing — update fixture |
| `bun test tests/structure/status-contract.test.ts tests/golden/status-digest.test.ts` | Status vocabulary and golden no-hold bytes | TC-HOLDSTATUS-005 | Existing — no change |
| `bun test tests/structure/owner-hold-composition.test.ts` | Production CLI/MCP composition supplies the fact; ambient-free core | TC-HOLDEDGE-001, TC-HOLDEDGE-002, TC-HOLDNEG-003 | To implement |
| `bun test tests/checks/owner-hold-doc.test.ts` | Guide/spec/command-page content and denials | TC-HOLDDOCS-001, TC-HOLDDOCS-002, TC-HOLDDOCS-003 | To implement |
| `bash scripts/.tests/test-doc-distribution.sh` | `ados_distribution` marker and install-set drift | TC-HOLDDOCS-004 | Existing — no change |
| `bun test tests/checks/error-table-sync.test.ts tests/checks/forbidden-literals.test.ts tests/checks/reference-page-parity.test.ts tests/checks/help-guide-coverage.test.ts` | Error identity, literals, reference pages, help coverage | TC-HOLDNEG-001, TC-HOLDNEG-002, TC-HOLDNEG-003, TC-HOLDDOCS-003 | Existing — no change |
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
- `tests/behaviour/queue-schedule.test.ts` — add the held lane/entry projection case.
- `tests/behaviour/queue-watch.test.ts` — add the held watch payload.
- `tests/behaviour/daemon-lane-supervision.test.ts` — add the held `nextAction`/claim case.
- `tests/behaviour/mcp-status-parity.test.ts` — include the owner-hold success case.
- `tests/golden/queue-list.test.ts`, `tests/golden/queue-plan.test.ts` — add the held golden comparison.
- `tests/golden/doctor-output.test.ts` — add the held golden comparison.
- `tests/structure/doctor-contract.test.ts` — deliberate 22→23 reason update.
- `tests/structure/queue-scheduling-contract.test.ts` — no logic change; the fixture update drives the assertion.
- `tests/fixtures/status/harness.ts` — `providers({ ownerHold })` helper.
- `tests/fixtures/doctor/harness.ts` — `provider({ ownerHold })` helper.
- `tests/fixtures/status/scenarios.ts` — register the `owner-hold-active` corpus scenario.
- `tests/fixtures/mcp/parity/cases.ts` — add the owner-hold success case.
- `tests/fixtures/doctor/matrix/cases.ts` — add the hold rows.
- `scripts/.tests/test-install.sh` — create and assert both example paths.
- `scripts/.tests/test-uninstall.sh` — create and assert both example paths and the preserved operator hook.

### 7.3 Fixture and golden update plan

| File | Change | Reason |
|---|---|---|
| `tests/fixtures/queue/vocabulary/closed-sets.json` | Add exactly one `owner-hold` token to `blockingReasons` at the declared position; no other array changes | DM-5 / AC-F4-9 |
| `tests/fixtures/queue/hold/cases.json` | New matrix: ready, held, not-ready, active park, stuck park, resumable park, delivering lane | AC-F4-1, AC-F4-10 |
| `tests/fixtures/queue/golden/queue-list-held.json` | New held list golden | AC-F4-7 |
| `tests/fixtures/queue/golden/queue-plan-held.json` | New held plan golden (empty `nextActions`) | AC-F4-1, AC-F4-7 |
| `tests/fixtures/queue/golden/*` (existing) | **Unchanged**; TC-HOLDQUEUE-009 asserts byte identity | AC-F4-7, NFR-12 |
| `tests/fixtures/status/corpus/owner-hold-active/case.json` | New corpus case with the expected sibling, unchanged section state, and the human suffix | AC-F5-1, AC-F5-2 |
| `tests/fixtures/status/scenarios.ts` | Register the new corpus scenario | AC-F5-1 |
| `tests/fixtures/status/golden/*` (existing) | **Unchanged**; TC-HOLDSTATUS-005 asserts byte identity | AC-F5-4, NFR-12 |
| `tests/fixtures/mcp/parity/cases.ts` | New status success case with `providers.ownerHold` | AC-F5-3 |
| `tests/fixtures/mcp/golden/status/status-owner-hold.json` | New parity golden, regenerated by `bun run tests/fixtures/mcp/regenerate.ts --write` | AC-F5-3 |
| `tests/fixtures/doctor/golden/owner-hold.json` | New held machine golden with the delivered healthy detail plus the appended hold segment and the `owner-hold` reason | AC-F6-1, PM D11 |
| `tests/fixtures/doctor/golden/owner-hold-human.txt` | New held human golden with the same appended detail | AC-F6-1, AC-F6-3, PM D11 |
| `tests/fixtures/doctor/golden/*` (existing) | **Unchanged**; TC-HOLDDOCTOR-005 asserts byte identity | AC-F6-4 |
| `tests/fixtures/doctor/matrix/cases.ts` | Add the hold rows (ok with reason, ok without reason, each defect + hold) | AC-F6-1, AC-F6-2 |
| `tests/structure/inventory.json` | Add `src/contracts/owner-hold.ts` and `src/domain/owner-hold.ts` (and the edge reader module if separate) | NFR-12 |
| `tests/fixtures/ports/v1-contract-inventory.json` | Add the `owner-hold.ts` module exports and the `index.ts` re-exports | NFR-12 |
| `tests/structure/content-inventory.test.ts` | Register the new executable constants in the `core/src/contracts/owner-hold.ts` allowance | NFR-12 |
| `tests/fixtures/help-guide/coverage.json` | **Unchanged** (no new command or flag) | NG-8 |

Golden regeneration is explicit and reviewed: `bun run tests/fixtures/status/golden/regenerate.ts` only if a status golden must change (it must not for the inactive case), `bun run tests/fixtures/mcp/regenerate.ts --write` for the new parity case, and the doctor held golden is authored from the delivered report and reviewed as a fixture. No blanket rewrite, no assertion deletion, and no loosening from `toEqual`/byte equality to a substring check.

The poll-interval cases are shell-only: successful, defaulted, and warned values change no fixture or golden. The doctor held golden is the only new golden whose content depends on the resolved append rule (D11); it must show the delivered healthy prefix followed by the hold segment.

### 7.4 Non-vacuity and mutation evidence

| Mutation | Expected failing case |
|---|---|
| Remove the `ownerHold` read from the scheduling pass | TC-HOLDQUEUE-001 (next actions reappear) |
| Remove `owner-hold` from `QUEUE_LANE_IDLE_REASONS` | TC-HOLDQUEUE-011 / the closed-set equality fails by name |
| Remove the hold from `evaluateClaimPreconditions` | TC-HOLDQUEUE-002 (claim succeeds) |
| Remove the hold from `claimQueueLease` | TC-HOLDQUEUE-003 (fenced claim succeeds) |
| Remove the recovery-pass skip | TC-HOLDQUEUE-007 (a new incident appears) |
| Remove the hold from the production composition | TC-HOLDEDGE-001 (at least one surface loses the fact) |
| Reorder `owner-hold` away from the first blocking position | TC-HOLDQUEUE-001 (blocking[0] assertion) |
| Remove `owner-hold` from `DOCTOR_EVIDENCE_REASONS` | TC-HOLDDOCTOR-001 / TC-HOLDDOCTOR-006 |
| Add a fourth doctor verdict or a fifth count | TC-HOLDDOCTOR-006 fails by name |
| Remove the status sibling attachment | TC-HOLDSTATUS-001 (sibling absent) |
| Re-add a status reason or a tenth section | TC-HOLDSTATUS-005 / TC-HOLDNEG-002 |
| Remove the reason sanitizer | TC-HOLDFACT-007 (control character or >160) |
| Reinstate a loop cap | TC-HOLDHOOK-003 (cap warning or early return) |
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
- **R-9 — real daemon/session absence.** Daemon supervision and resume are exercised through injected seams; TC-HOLDE2E-001 is the only real-process evidence. Documented in GAP-T1.
- **R-10 — status corpus schema.** The corpus `case.json` files have a fixed expected-shape validator; adding `ownerHold` may require extending that validator rather than only adding a case. The plan assigns that extension to `tests/fixtures/status/corpus`/`tests/behaviour/status-corpus.test.ts` and treats it as a deliberate pin update.

### 8.2 Assumptions

- **A-T1 — contract names.** The tests read the delivered `OwnerHoldFact`, `OwnerHoldSource`, `OWNER_HOLD_*`, `QueueSchedulerFacts.ownerHold`, `QueueReadData.ownerHold`, `StatusSection.ownerHold`, `DoctorProviderFacts.ownerHold`, and `DOCTOR_EVIDENCE_REASONS` from the delivered contracts; the spec's names are the contract, not test-local copies.
- **A-T2 — shell extension points.** The example exposes a marker-read seam and a documented condition-registry append point (or a re-sourceable generated copy) so the MAX case can register a second condition without a real edit. This follows the delivered zai suite's re-source pattern for custom windows.
- **A-T3 — state-directory resolution.** Production always resolves a state directory (the default is `${home}/${brand.stateDirectoryName}`); the "no resolvable state directory" case is a pure-resolver case, not a production composition path.
- **A-T4 — no MCP queue tool.** The MCP server's toolset is `status`, `verify-artifact`, and `gate-report`; there is no queue tool to pin.
- **A-T5 — manual evidence is PR-scoped.** TC-HOLDE2E-001 is recorded in the pull request, not in CI, and may use a synthetic lane fixture for the resume step rather than a live model session.
- **A-T6 — the example is inactive until selected.** Installation copies both examples but never activates either; the shell suites set the hook path explicitly.

### 8.3 Open Questions

None. The five planning questions were resolved by the binding PM decisions D7–D11 and are recorded in TC-HOLDQUEUE-002/003 (D7), TC-HOLDHOOK-001/002 (D8), TC-HOLDHOOK-001/009 (D9), TC-HOLDHOOK-004 (D10), and TC-HOLDDOCTOR-001/002/004 (D11). The corrected spec removes the corresponding ambiguity; no open question remains.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-10 | test-plan-writer | Initial plan: 44 ACs mapped to 58 test cases (57 automated, 1 manual); layers, fixtures/goldens, mutation evidence, and five open questions. |
| 1.1 | 2026-11-10 | test-plan-writer | Recorded the binding PM resolutions D7–D11 in the affected cases, removed all five open questions, and corrected the claim token/detail grammar, the no-model-gate assertion, the reason-line grammar, the silent-vs-warning poll fallback, and the doctor appended-detail assertions. TC count and AC coverage are unchanged. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| — | — | Not executed | Populated during delivery and quality gates; record the command, exit code, and a one-line result for each row. |
