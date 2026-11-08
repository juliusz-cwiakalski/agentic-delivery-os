---
ados_distribution: internal
id: TEST-SPEC-DISPATCH-ENGINE
status: Current
created: 2026-11-08
last_updated: 2026-11-08
owners: ["engineering"]
service: delivery-os
links:
  related_changes: ["GH-239"]
  feature_spec: doc/spec/features/feature-dispatch-engine.md
---

# Test Specification: Dispatch Engine

## Overview

The dispatch suite protects one property: a delivery verdict is trustworthy only when truth decides it, evidence is durable, and authority moves only through a recorded gate. The suite fails if an exit code alone can produce a success claim; if a dispatch that reaches classification appends no attempt record or appends more than one; if a pre-session refusal records a fake attempt; if an exit-0-with-no-artifact run is counted clean; if a false-success incident is hidden or an incident does not reset the evidence window; if evidence of the wrong class counts toward a production handover; if a handover flips more than one repository, cannot be reverted idempotently, or is lost on replay; if bash needs the typed CLI to decide fallback; if the daemon path and the one-shot path disagree; if a model call or secret enters help, summary, gate, record, or envelope; or if a merge path becomes reachable from dispatch.

## Test Scope

- Components under test: the dispatch contracts (`packages/core/src/contracts/dispatch.ts`), the pure domain (`dispatch-result`, `dispatch-liveness`, `dispatch-comparison`, `dispatch-identity`, `dispatch-authority`, `dispatch-gate`, `dispatch-resume`, `lane-launch-plan`), the app tier (`dispatch`, `dispatch-ledger`, `dispatch-gate`, `daemon-dispatch-result`, `daemon-supervision`), the CLI surface (`packages/cli/src/commands/dispatch.ts`, `output/dispatch-text.ts`, `edge.ts`, `production.ts`, `daemon-compose.ts`), the help and prompt-required inventory, the four bash entry points plus `scripts/lib/dispatch-authority.sh`, and the four `dispatch` error rows.
- Contracts under test: the three additive record kinds and the derived authority document, the closed evidence-class and comparison vocabularies, the eleven-token taxonomy with its projection and derivation classes, the pinned failure-token pairs, the four-condition handover gate, and the bounded read/output constants.
- Exclusions: no real repository is flipped and no real pilot evidence is accrued; the controlled proof uses the real state store and command path with injected harness, tracker, CI, and VCS ports. No live network, live model, or real merge is exercised. Evidence retention and cross-host authority are out of scope.

## Test Levels

### Unit and pure-domain tests

- `tests/behaviour/dispatch-truth-derivation.test.ts` and `dispatch-state-unverified.test.ts` — artifact-first derivation, exit-0-with-no-artifact, tracker facts, and the unverifiable-truth token.
- `tests/behaviour/dispatch-liveness.test.ts` — progress signals, absent readings, and the two-evaluation stall rule.
- `tests/behaviour/dispatch-comparison.test.ts`, `dispatch-evidence-record.test.ts`, `dispatch-evidence-class.test.ts` — comparison shape invariants, evidence-class declaration and immutability, record completeness, and privacy bounds.
- `tests/behaviour/dispatch-false-success.test.ts`, `dispatch-unevaluable.test.ts` — false-success classification and record-level versus window-level degradation.
- `tests/behaviour/dispatch-identity.test.ts` and `tests/structure/dispatch-authority-view.test.ts` — repository identity resolution, rename stability, marker reuse, and the atomic authority view.
- `tests/behaviour/dispatch-dual-run-floor.test.ts`, `dispatch-gate-evidence.test.ts`, `dispatch-gate-window.test.ts`, `dispatch-divergence.test.ts` — floor-only semantics, corroboration, incident-exclusive window, and divergence folding.

### Command and ledger tests

- `tests/behaviour/dispatch-harness-lease.test.ts` — harness resolution, lease claim, pre-session refusals, and spawn-refused recording.
- `tests/behaviour/dispatch-envelope.test.ts`, `dispatch-error-envelope.test.ts`, `tests/golden/dispatch-text.test.ts`, `tests/golden/dispatch-errors.test.ts` — machine envelope fields, four-key text order, and classified failures.
- `tests/behaviour/dispatch-evidence-record.test.ts`, `dispatch-evidence-class.test.ts` — one attempt record per classified dispatch and one per attempt-stage failure.
- `tests/behaviour/dispatch-resume.test.ts`, `dispatch-restart-budget.test.ts`, `dispatch-resume-economics.test.ts` — resume modes, phase-ledger continuity, restart-budget refusal, and resume-economics refusal.
- `tests/behaviour/dispatch-dual-run-summary.test.ts`, `dispatch-handover.test.ts`, `tests/golden/dispatch-summary.test.ts` — summary reporting, readable-but-unmet refusal, handover, reversal, and idempotent replay.
- `tests/behaviour/dispatch-merge-absence.test.ts`, `tests/structure/dispatch-merge-boundary.test.ts`, `dispatch-imports.test.ts`, `dispatch-composition.test.ts` — no merge path, composition honesty, and the production harness composition.

### Registration, fallback, and daemon tests

- `tests/behaviour/entrypoint-composition.test.ts`, `entrypoint-help-coverage.test.ts`, `dispatch-help-version.test.ts`, `tests/structure/dispatch-help-inventory.test.ts`, `tests/checks/dispatch-doc-conformance.test.ts` — prompt-required registration, help paths, reference-page coverage, and the stale-ring reconciliation.
- `scripts/.tests/test-dispatch-bash-fallback.sh` and `tests/structure/dispatch-bash-authority.test.ts` — the twelve-cell fallback matrix (four scripts × dual-run, authoritative, typed-CLI-absent/broken) and the no-typed-CLI source rule.
- `tests/behaviour/dispatch-daemon-planner.test.ts`, `dispatch-daemonless.test.ts`, `tests/conformance/dispatch/dispatch-daemon-lane.test.ts` — planner output, executor composition, the daemon-path attempt record, and the daemon-less one-shot path.

### Conformance and controlled proof

- `tests/conformance/dispatch/dispatch-e2e.test.ts` — real state and command paths under `controlled-proof` evidence: accrual to eligibility, handover, post-handover dispatch, reversal, and bash fallback.
- `tests/conformance/dispatch/dispatch-fixture.test.ts` — provenance guard: evidence comes from real command invocations, no ledger writer is exposed, and no controlled-proof record counts toward a production repository.

## Test Data

Dispatch suites drive `runCli` with an injected command program and injected harness, tracker, CI, VCS, clock, run-id, and fence seams. Fixtures under `tests/fixtures/dispatch/` supply harness evidence, truth reads, ledger records, evidence windows, authority documents, bash authority files, golden text, and mutation cases. The controlled proof uses a real local state store and real change files with deterministic UTC date advance. No fixture writes an attempt, divergence, or handover record directly; the command path produces them.

## Test Scenarios

### Scenario: exit zero with no artifact

- **Given** a spawned session that exits `0` with no branch commit, no PR, and no ledger progress
- **When** the dispatch classifies
- **Then** the result is `failed` at exit `1`, the missing artifact is named, and the attempt record is not success-classified.

### Scenario: open PR with an unresolvable URL

- **Given** a tracker fact that the PR is open but no resolvable URL
- **When** truth is evaluated
- **Then** the token is `pr-open-unverified`, `urlResolved` is `false`, the comparison is a tracker match, and no divergence is opened.

### Scenario: pre-session refusal versus attempt-stage failure

- **Given** an unknown harness, rejected input, or a conflicting lease before a spawn
- **When** the dispatch refuses
- **Then** it emits the classified envelope at exit `1` and appends no attempt record.
- **And given** a spawn failure, restart-budget refusal, resume-economics refusal, or harness spawn refusal
- **Then** exactly one attempt record is appended with the pinned failure token and outcome.

### Scenario: resume modes and admissions

- **Given** an existing lane and `--resume-prompt`
- **When** the adapter supports attach-and-continue
- **Then** no restart ordinal is consumed and the recorded mode is `attach-continue`.
- **And when** the adapter lacks resume injection
- **Then** the recorded mode is `resume-prompt-reentry` and the prefill cost is acknowledged.
- **And when** the restart budget is exhausted or the re-entry is uneconomical
- **Then** the attempt refuses at exit `1` with the pinned token and appends exactly one record.

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

`tests/behaviour/dispatch-bounds.test.ts` asserts the bounded summary read, declared truncation, the 65,536-byte machine cap, the 40-line/8,192-byte human cap, and the p95 summary latency target. `dispatch-determinism.test.ts` asserts byte-identical replay; `dispatch-idempotency.test.ts` asserts no duplicate records; `dispatch-privacy.test.ts` and `tests/checks/fixture-privacy.test.ts` assert no secret, prompt, transcript, or raw payload enters output, records, or fixtures.

## CI Gates

The binding checks are `pnpm check:help`, `tests/checks/dispatch-doc-conformance.test.ts`, `scripts/checks/error-table-sync.ts`, `scripts/checks/exit-code-literals.ts`, `scripts/checks/prompt-conformance.ts`, and the aggregate `pnpm check`. The bash fallback matrix runs as `bash scripts/.tests/test-dispatch-bash-fallback.sh` alongside the four retained entry-point suites.
