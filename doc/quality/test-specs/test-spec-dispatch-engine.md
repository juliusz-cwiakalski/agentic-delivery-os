---
ados_distribution: internal
id: TEST-SPEC-DISPATCH-ENGINE
status: Current
created: 2026-11-08
last_updated: 2026-11-11
owners: ["engineering"]
service: delivery-os
links:
  related_changes: ["GH-239", "GH-275", "GH-277", "GH-279", "GH-286", "GH-289"]
  feature_spec: doc/spec/features/feature-dispatch-engine.md
---

# Test Specification: Dispatch Engine

## Overview

The dispatch suite protects one property: a delivery verdict is trustworthy only when truth decides it, evidence is durable, and authority moves only through a recorded gate. The suite fails if an exit code alone can produce a success claim; if a dispatch that reaches classification appends no attempt record or appends more than one; if a pre-session refusal records a fake attempt or an admission refusal claims a lease or starts a session; if an admission read outcome is forwarded from the adapter instead of classified from its received status; if an exit-0-with-no-artifact run is counted clean; if a false-success incident is hidden or an incident does not reset the evidence window; if a delivered-evidence divergence duplicates, disappears, or becomes locally unresolvable; if evidence of the wrong class counts toward a production handover; if a handover flips more than one repository, cannot be reverted idempotently, or is lost on replay; if bash needs the typed CLI to decide fallback; if the daemon path and the one-shot path disagree; if a model call or secret enters help, summary, gate, record, or envelope; or if a merge path becomes reachable from dispatch.

## Test Scope

- Components under test: the dispatch contracts (`packages/core/src/contracts/dispatch.ts`), the pure domain (`dispatch-result`, `dispatch-liveness`, `dispatch-comparison`, `dispatch-identity`, `dispatch-authority`, `dispatch-gate`, `dispatch-resume`, `lane-launch-plan`), the app tier (`dispatch`, `dispatch-ledger`, `dispatch-gate`, `daemon-dispatch-result`, `daemon-supervision`), the checkout identity adapters (`packages/adapters/src/file/dispatch-identity.ts`, `packages/adapters/src/repo/index.ts`), the GitHub work-item read and its received-status stamp (`packages/adapters/src/github/client.ts`, `packages/adapters/src/github/normalize.ts`, `packages/adapters/src/io/provider-transport.ts`), the CLI surface (`packages/cli/src/commands/dispatch.ts`, `output/dispatch-text.ts`, `index.ts`, `edge.ts`, `production.ts`, `entrypoint.ts`, `daemon-compose.ts`), the help and prompt-required inventory, the four bash entry points plus `scripts/lib/dispatch-authority.sh`, and the four `dispatch` error rows.
- Contracts under test: the optional `preflight` admission port and its status-keyed refusal identities, the trusted-refusal marker's narrow forwarding rule, the three additive record kinds and the derived authority document, the closed evidence-class and comparison vocabularies, the eleven-token taxonomy with its projection and derivation classes, the pinned failure-token pairs, the delivered-evidence divergence shape and its per-work-item dedupe, the local-only resolve typing, the four-condition handover gate, and the bounded read/output constants.
- Exclusions: no real repository is flipped and no real pilot evidence is accrued; the controlled proof uses the real state store and command path with injected harness, tracker, CI, and VCS ports. No live network, live model, or real merge is exercised. Evidence retention and cross-host authority are out of scope.

## Test Levels

### Unit and pure-domain tests

- `tests/behaviour/dispatch-truth-derivation.test.ts` and `dispatch-state-unverified.test.ts` — artifact-first derivation, exit-0-with-no-artifact, tracker facts, and the unverifiable-truth token.
- `tests/behaviour/dispatch-liveness.test.ts` — progress signals, absent readings, and the two-evaluation stall rule.
- `tests/behaviour/dispatch-comparison.test.ts`, `dispatch-evidence-record.test.ts`, `dispatch-evidence-class.test.ts` — comparison shape invariants, evidence-class declaration and immutability, record completeness, and privacy bounds.
- `tests/behaviour/dispatch-false-success.test.ts`, `dispatch-unevaluable.test.ts` — false-success classification, the unreadable-versus-contradicted corroboration distinction, and record-level versus window-level degradation.
- `tests/behaviour/dispatch-identity.test.ts` and `tests/structure/dispatch-authority-view.test.ts` — repository identity resolution, rename stability, checkout-scoped marker reuse, and the atomic authority view.
- `tests/behaviour/dispatch-dual-run-floor.test.ts`, `dispatch-gate-evidence.test.ts`, `dispatch-gate-window.test.ts`, `dispatch-divergence.test.ts` — floor-only semantics, corroboration, incident-exclusive window, and divergence folding.
- `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` — the delivered-evidence predicate over the classifier outcome and readable ledger, at most one open divergence per (repository, work-item reference), the divergence-before-attempt order, the failed-divergence-append and orphan directions, replay, and summary counting.
- `tests/behaviour/dispatch-resolve-diagnostics.test.ts` — local-only resolve, preserved `state` identities with their own projections, the distinguishable not-found sentinel mapped to `input.value.rejected`, note clamping, and replay idempotency.

### Command and ledger tests

- `tests/behaviour/dispatch-harness-lease.test.ts` — harness resolution, lease claim, pre-session refusals, and spawn-refused recording.
- `tests/behaviour/dispatch-admission-preflight.test.ts`, `dispatch-admission-read-mapping.test.ts`, `dispatch-admission-diagnostics.test.ts` — admission ordering before the lease, zero side effects and zero requests on a credential refusal, the status-keyed read-outcome matrix with identity and kind asserted together, the name-only bounded summary in machine and human output, the trusted-refusal marker, and the admission read budget and latency.
- `tests/behaviour/providers/github-inputs.test.ts`, `github-trap.test.ts` — the real GitHub client and normalizer stamp the received 2xx status onto a decode failure, keep 404 as `provider.not-found`, preserve any other non-2xx status, and leave a thrown transport status-absent.
- `tests/behaviour/dispatch-harness-acquisition.test.ts` — the real opencode adapter over a scripted JSONL stream through the dispatch composition: the handle is returned before the session completes, `collect` stays pending across at least two liveness polls, the recorded call order is spawn → collect → liveness → classify, and a pre-session failure still collapses to `dispatch.session.spawn-failed`.
- `tests/behaviour/dispatch-watch.test.ts` — progress-based watching at the lane cadence, the recorded verdict trail, a transient stall cleared by later progress, and routing of a stall still current when collection resolves through restart admission with no silent second spawn.
- `tests/behaviour/dispatch-envelope.test.ts`, `dispatch-error-envelope.test.ts`, `dispatch-harness-default-detail.test.ts`, `dispatch-harness-default-spawn.test.ts`, `tests/structure/dispatch-envelope-detail.test.ts`, `tests/golden/dispatch-text.test.ts`, `tests/golden/dispatch-errors.test.ts` — machine envelope fields, the data-bearing attempt-stage `data.error`, the additive `DispatchEnvelopeError.detail` on the pre-session spawn path (identified and bounded), the default-allowlist spawn through a synthetic `opencode` on a controlled `PATH`, verbose human detail versus the four-key text, the post-spawn collection failure, four-key text order, and classified failures.
- `tests/behaviour/dispatch-evidence-record.test.ts`, `dispatch-evidence-class.test.ts` — one attempt record per classified dispatch and one per attempt-stage failure.
- `tests/behaviour/dispatch-resume.test.ts`, `dispatch-restart-budget.test.ts`, `dispatch-resume-economics.test.ts` — resume modes, phase-ledger continuity, restart-budget refusal with the terminal exhaustion record, and resume-economics refusal.
- `tests/behaviour/dispatch-dual-run-summary.test.ts`, `dispatch-handover.test.ts`, `tests/golden/dispatch-summary.test.ts` — summary reporting, readable-but-unmet refusal, handover, reversal, and idempotent replay under an advancing clock.
- `tests/behaviour/dispatch-merge-absence.test.ts`, `tests/structure/dispatch-merge-boundary.test.ts`, `dispatch-imports.test.ts`, `dispatch-composition.test.ts`, `dispatch-preflight-contract.test.ts`, `dispatch-resolve-composition.test.ts` — no merge path, composition honesty, the optional-preflight contract, the production preflight wiring and ordering, the production harness composition, and the production-composed gate, handover, resolve, resume-lane, rename-invariant identity, and per-repository identity isolation paths.
- `tests/structure/cli-edge-seam.test.ts`, `entrypoint-bin.test.ts` — the declared truth-read key registered for redaction from injected environment facts (literal and prefixed references) and the entrypoint/bin secret seam.
- `tests/behaviour/dispatch-attempts-ref.test.ts` — `dispatch attempts` reference resolution (explicit flag and the active-change default), the three unresolvable-context cells, the limit grammar (1 and 100 accepted; `0`, `101`, `-1`, `abc`, `07`, `+7`, ` 7`, `001`, and a missing value refused with zero reads), the total order across identical start instants and two insertion orders, and the request-grammar refusals.
- `tests/behaviour/dispatch-attempts-contract.test.ts` — the sixteen-field projection (exact key set, singular `divergenceRef` present or explicit `null`, no undeclared key), `endedAt` and stored instants, the comparison projection with its not-applicable null token, `matched`/`hasMore`, and the no-gate-key cells.
- `tests/behaviour/dispatch-attempts-bounds.test.ts` — the 65,536-byte page declaration, the 5,000-record ledger window with the ledger scope winning, the count-only foreign disclosure over the retained window, exactly one verified store read, and latency at the ledger bound.
- `tests/behaviour/dispatch-attempts-digest.test.ts` — the declared digest with its reviewed three-row and empty goldens, the seven cells, the closed corroboration derivation, the 40-line/8,192-byte human budget with its declared cut, and repeated-run determinism.
- `tests/behaviour/dispatch-attempts-scope.test.ts` — two checkouts on one host root, the migrated root's count-only disclosure independent of `--ref`, the non-checkout refusal, and the read-only-with-respect-to-evidence proof (stable evidence bytes, unchanged record counts, no binding marker).
- `tests/behaviour/dispatch-attempts-refusals.test.ts` — a verified empty history at exit 0, and the torn, unknown, and permission-denied store identities with their delivered projections, never an empty history.
- `tests/behaviour/dispatch-resolve-result.test.ts`, `tests/behaviour/dispatch-divergence-count.test.ts`, `tests/structure/dispatch-attempts-count-rule.test.ts` — the resolve extension (unconditional mode, subject repository, exact counts), replay idempotency, the blank and long note cells, the one deterministic resolve line, the 25-open shared count with 20 identifiers and `idsTruncated`, and the single-computation structural pin with zero list-length derivation.
- `tests/structure/dispatch-attempts-taxonomy.test.ts`, `tests/checks/dispatch-attempts-test-isolation.test.ts`, `tests/structure/dispatch-attempts-composition.test.ts`, `tests/behaviour/dispatch-additive-stability.test.ts` — taxonomy closure over the new surfaces, test isolation, the single pointer route from evidence to the gate, and the delivered shapes with the four delivered-form refusals under `acceptsAnyFlag`.

### Registration, fallback, and daemon tests

- `tests/behaviour/entrypoint-composition.test.ts`, `entrypoint-help-coverage.test.ts`, `dispatch-help-version.test.ts`, `tests/structure/dispatch-help-inventory.test.ts`, `tests/checks/dispatch-doc-conformance.test.ts` — prompt-required registration, help paths, reference-page coverage, and the stale-ring reconciliation.
- `tests/behaviour/error-classification.test.ts` — the trusted-refusal marker is required for the bounded credential refusal, while an unmarked config-shaped failure and a marked failure for any other `config.*` code keep the untrusted-config suppression.
- `scripts/.tests/test-dispatch-bash-fallback.sh` and `tests/structure/dispatch-bash-authority.test.ts` — the twelve-cell fallback matrix (four scripts × dual-run, authoritative, typed-CLI-absent/broken) and the no-typed-CLI source rule.
- `tests/behaviour/dispatch-daemon-planner.test.ts`, `dispatch-daemonless.test.ts`, `tests/conformance/dispatch/dispatch-daemon-lane.test.ts` — planner output, executor composition, the daemon-path attempt record, and the daemon-less one-shot path. The daemon lane seam is factory-proven here; the production composition mounts the daemon family without a lane composition, so supplying it remains resident-daemon production scope (GH-238).

### Conformance and controlled proof

- `tests/conformance/dispatch/dispatch-e2e.test.ts` — real state and command paths under `controlled-proof` evidence: accrual to eligibility, handover, post-handover dispatch, reversal, and bash fallback.
- `tests/conformance/dispatch/dispatch-fixture.test.ts` — provenance guard: evidence comes from real command invocations, no ledger writer is exposed, and no controlled-proof record counts toward a production repository.

## Test Data

Dispatch suites drive `runCli` with an injected command program and injected harness, tracker, CI, VCS, clock, run-id, and fence seams. Fixtures under `tests/fixtures/dispatch/` supply harness evidence, truth reads, ledger records, evidence windows, authority documents, bash authority files, admission doubles (recording credential port and transport), golden refusal envelopes, golden text, and mutation cases. The controlled proof uses a real local state store and real change files with deterministic UTC date advance; only the command path produces its attempt, divergence, and handover records. The production-composition proof seeds attempt records through the delivered ledger append to reach an eligible window, then drives `summary`, `resolve`, `handover`, and resume through the shipped production composer. No fixture fabricates a command outcome.

## Test Scenarios

### Scenario: exit zero with no artifact

- **Given** a spawned session that exits `0` with no branch commit, no PR, and no ledger progress
- **When** the dispatch classifies
- **Then** the result is `failed` at exit `1`, the missing artifact is named, and the attempt record is not success-classified.

### Scenario: open PR with an unresolvable URL

- **Given** a tracker fact that the PR is open but no resolvable URL
- **When** truth is evaluated
- **Then** the result token is `pr-open-unverified`, `urlResolved` is `false`, the independent tracker comparison token is `pr-open` with outcome `match`, and no divergence is opened.

### Scenario: pre-session refusal versus attempt-stage failure

- **Given** an unknown harness, rejected input, an admission preflight refusal, or a conflicting lease before a spawn
- **When** the dispatch refuses
- **Then** it emits the classified top-level error envelope at the mapped exit (`1`, or `2` for a provider outage or malformed payload) and appends no attempt record.
- **And given** a spawn failure, restart-budget refusal, resume-economics refusal, or harness spawn refusal
- **Then** exactly one attempt record is appended with the pinned failure token and outcome.
- **And given** a pre-session spawn failure
- **Then** `data.error` is a `DispatchEnvelopeError` carrying the underlying harness failure `kind` and `code` in the additive `detail`, with `field` present only when the failure carries one; the `dispatch.session.spawn-failed` identity, token, outcome, exit, and last message are unchanged; non-verbose text stays exactly four keys while verbose human output names the detail.
- **And given** a post-spawn `harness.collect` failure
- **Then** exactly one attempt record is appended with token `state-unverified`, outcome `failed`, and exit `2`, and the envelope carries the classified error under `data.error`.

### Scenario: admission preflight and read classification

- **Given** an unresolvable truth-read credential and a harness session port that records every spawn and resume
- **When** dispatch runs
- **Then** it refuses pre-session with `config.credential.missing` (`kind: "config"`, exit `1`) and a bounded summary naming the resolved source key and the reference, issues zero provider requests, and records zero spawns, zero leases, and zero attempt records.
- **And given** a resolvable credential and a bounded work-item read failing with 401 or 403
- **Then** the refusal is `provider.auth.rejected` (`kind: "provider"`, exit `1`); 5xx or any other status-bearing non-2xx and a status-absent transport failure are `provider.outage` (`kind: "provider"`, exit `2`); a malformed 2xx payload carrying its received status is `provider.payload.invalid` (`kind: "provider"`, platform-provider); and a 404 is `input.value.rejected` (`kind: "input"`, exit `1`) naming the reference without asserting it is wrong.
- **And given** an unknown harness or a malformed reference
- **Then** the input refusal precedes the preflight and the preflight port is never invoked.

### Scenario: delivered-evidence divergence

- **Given** a completed classifier outcome, a readable phase ledger with progress or a complete total, and an unreadable truth read
- **When** the dispatch records the attempt
- **Then** one open divergence with `comparisonClass: not-applicable`, `engineToken: state-unverified`, `comparisonToken: null`, `attempt:<id>` and `truth:unreadable:<ledger|tracker|artifact|state>` evidence is appended before the attempt, and the attempt carries its `divergenceRef`.
- **And given** an open delivered-evidence divergence for the same (repository, work-item reference)
- **Then** a resume or another unverifiable-but-delivered attempt reuses and references it without increasing the unresolved count, and a new divergence opens only after the previous one is resolved.
- **And given** the classifier outcome is not completed, the ledger is unreadable, or the ledger shows no progress and an incomplete total
- **Then** no divergence opens.
- **And given** the divergence append fails
- **Then** one attempt lands with no `divergenceRef` and a bounded `divergence:append-failed` reference, and the underlying state identity is returned; when the attempt append fails after the divergence lands, the orphan stays open, counted, and resolvable.

### Scenario: resolve writes from local evidence only

- **Given** a composed resolve runtime with spy credential and transport ports
- **When** `dispatch dual-run resolve <id> --note <text>` runs
- **Then** neither port is invoked and the resolution comes from local state and the divergence ledger.
- **And given** a store fault such as `state.lock.busy`, `state.store.torn`, or `state.write.failed`
- **Then** the failure carries `kind: "state"` with that identity and its own projection, never `dispatch.state-unverified`.
- **And given** an absent divergence identifier
- **Then** it is the app-local `divergence-not-found` sentinel surfaced as `input.value.rejected` with `kind: "input"` and nothing is appended, never `state.keys.missing`.
- **And given** a note longer than 240 characters
- **Then** the resolution lands with the note clamped to at most 240 characters.

### Scenario: unreadable corroboration is unevaluable

- **Given** a success claim whose comparison matches but whose corroboration source cannot be read
- **When** the attempt is classified
- **Then** the source is recorded `unsatisfied`, the claim fails corroboration, no divergence is opened, and no false-success incident is recorded or evidence window reset.
- **And given** a readable source that contradicts the claim
- **Then** the attempt is a false-success incident and the window resets.

### Scenario: resume modes and admissions

- **Given** an existing lane and `--resume-prompt`
- **When** the adapter supports attach-and-continue
- **Then** no restart ordinal is consumed and the recorded mode is `attach-continue`.
- **And when** the adapter lacks resume injection
- **Then** the recorded mode is `resume-prompt-reentry` and the prefill cost is acknowledged.
- **And when** the restart budget is exhausted or the re-entry is uneconomical
- **Then** the attempt refuses at exit `1` with the pinned token and appends exactly one record.

### Scenario: one-shot watch and restart admission

- **Given** a running session whose evidence collection is pending
- **When** the watcher polls at `lane.liveness-interval`
- **Then** an advancing session records `progressing` and never stalls, and the verdict trail is recorded as attempt evidence.
- **And given** a healthy spawn that identifies its session on the first stream line
- **Then** the spawn returns its handle before the session completes, and `collect` remains pending while liveness polls.
- **And given** two consecutive sourced no-advance readings followed by an advancing observation and completed evidence
- **Then** the transient stall clears, both verdicts stay recorded as liveness evidence, and the completed session classifies normally rather than `max-restarts`, even when the restart count has reached the bound.
- **And given** a stall still current when evidence collection resolves
- **Then** at or above the restart bound the attempt is `max-restarts`/`failed` with the terminal exhaustion record and no second spawn, and below the bound the stall is recorded and left to lane supervision.

### Scenario: production composition surfaces

- **Given** the shipped production composer over an injected store, remote, and harness runner
- **When** `dispatch dual-run summary`, `dispatch dual-run resolve`, `dispatch handover`, `dispatch handover --revert`, and `dispatch <ref> --resume-prompt` run
- **Then** each surface runs through the delivered CLI, the resume uses the persisted session, the checkout-scoped first-use identity marker binds the repository, two repositories in one home keep separate bindings, a read-only summary never binds an arbitrary `--repo`, and a renamed remote or changed scheduler key does not re-key history.
- **And given** an unresolvable repository argument
- **Then** the surface refuses cleanly at exit `1`.

### Scenario: incident-exclusive window

- **Given** a false-success incident at time T and sufficient counted dispatches strictly after T
- **When** the summary evaluates
- **Then** `windowStart` is T, `windowStartReason` is `false-success-incident-reset`, and a dispatch recorded exactly at T is excluded.
- **And given** no further incident or unresolved divergence, all eleven classes, the floor, and corroboration
- **Then** eligibility is true.

### Scenario: evidence-class counting

- **Given** a production repository
- **When** the gate counts evidence
- **Then** only `pilot` attempts count; `controlled-proof`, `smoke`, and `fixture` attempts are surfaced as excluded.
- **And given** the controlled repository scope
- **Then** only `controlled-proof` attempts count.

### Scenario: handover and reversal

- **Given** a repository whose evidence bar is readable but unmet
- **When** `dispatch handover <repo>` runs
- **Then** it refuses at exit `1`, names every unmet condition, and changes no authority.
- **And given** a met bar
- **Then** it appends one handover record, flips only that repository, and refreshes the authority view atomically.
- **And when** `--revert` runs
- **Then** a reversal record restores `dual-run` and history remains; a second `--revert` is a noop at exit `0`.

### Scenario: bash fallback

- **Given** any of the four bash entry points
- **When** the authority view is absent, unreadable, malformed, or torn
- **Then** the script runs as `dual-run` with no typed CLI invocation.
- **And when** the repository is authoritative
- **Then** it prints the deprecation pointer and stays executable.

### Scenario: daemon-driven lane

- **Given** a planned lane and the daemon composition
- **When** the daemon starts, observes, collects, and resumes the lane
- **Then** the planner returns the lifecycle prompt and declared variable names, the lane record is written, and one attempt record is appended with the same token and outcome a one-shot dispatch derives from the same evidence.

### Scenario: controlled end-to-end proof

- **Given** a controlled repository running the real state store and command path under `controlled-proof` evidence
- **When** evidence accrues to eligibility, handover runs, a post-handover dispatch runs, and `--revert` runs
- **Then** the full path succeeds, the bash fallback returns to normal, and the provenance guard proves no hand-inserted evidence.

## Performance and Bounds Tests

`tests/behaviour/dispatch-bounds.test.ts` asserts the bounded summary read, the declared truncation above 5,000 records (`bound: 5000` and the omitted count), the 65,536-byte machine cap, the 40-line/8,192-byte human cap, and the p95 summary latency target. `dispatch-determinism.test.ts` asserts byte-identical replay; `dispatch-idempotency.test.ts` asserts no duplicate records, including a handover replay under an advancing clock; `dispatch-privacy.test.ts` and `tests/checks/fixture-privacy.test.ts` assert no secret, prompt, transcript, or raw payload enters output, records, or fixtures.

## CI Gates

The binding checks are `pnpm check:help`, `tests/checks/dispatch-doc-conformance.test.ts`, `scripts/checks/error-table-sync.ts`, `scripts/checks/exit-code-literals.ts`, `scripts/checks/prompt-conformance.ts`, and the aggregate `pnpm check`. The bash fallback matrix runs as `bash scripts/.tests/test-dispatch-bash-fallback.sh` alongside the four retained entry-point suites.
