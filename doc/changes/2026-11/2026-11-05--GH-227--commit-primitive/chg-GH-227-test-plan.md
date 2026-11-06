---
id: chg-GH-227-test-plan
status: Proposed
created: 2026-11-06T01:15:00Z
last_updated: 2026-11-06T02:00:00Z
owners: [engineering]
service: delivery-os CLI and delivery engine
labels: [m1, m1-s14, commit, cli, delivery-engine]
version_impact: minor
summary: "Verify M1-S14: the `commit` primitive (deterministic context/skeleton, exactly one constrained model call, ordered transport seam with marked template fallback, deterministic safety pass, precise staging), default-on atomic record-plus-commit for `phase complete` with `--no-commit` and configuration opt-outs, four-state re-run convergence over durable commit-intent evidence (`commitIntent`/`commitIntentBasis` in the transition record), one non-gating commit telemetry event, six `commit` error rows with documented sync, and SC-M1-12 inherited verbatim, under real temporary git repositories with injected clocks, fakes at every model/transport port, and zero network."
links:
  change_spec: ./chg-GH-227-spec.md
  implementation_plan: null
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S14: Commit primitive and phase-transition commits

## 1. Scope and Objectives

This change moves the commit act from an agent-managed loop into a tool primitive, and makes a phase transition and its commit one atomic act by default. The tests must therefore prove **message provenance** (every verifiable part of the message is computed, never authored, and exactly one constrained model call supplies only the language parts), **safety before exposure** (the deterministic scan on content and filenames runs before transport selection and before anything is staged; suspicion STOPs; scan unavailability fails closed), **staging precision** (untracked strays never stage, tracked scope drift does stage with disclosure, forbidden paths and oversized binaries are excluded), **atomicity and convergence** (ledger record and commit land together or neither on the clean-abort path; a re-run completes exactly the missing side from durable evidence and never creates an empty commit or duplicate record), and **auditability** (exactly one telemetry event per landed commit, machine output that is always one valid envelope, and six classified error identities bound to the documented table).

The proof is built around three mechanisms the specification names: the seeded scenario **SC-M1-12** (inherited verbatim), the **four-state convergence delta** over the transition record and the telemetry event, and the **nine-row idempotency matrix** extended with the commit dimension. Every negative is paired with a restored control, and every atomic assertion checks both durable sides (ledger record count and `git log`) rather than only the returned envelope.

### 1.1 In Scope

- `commit <ref> [--phase <phase>] [--dry-run]`: command surface, ref resolution (branch then change folder), plan-phase context, standalone and phase-centric modes, envelope data per DM-2, exit projection `{0, 1, 2}`.
- Deterministic context collection and skeleton: phase/type table (delivery → feat, review_fix → fix, docs sync → docs, documented defaults), scope = ref, breaking default false, generated-noise stripping, budget caps, last-commit tone.
- Exactly one JSON-schema-constrained model call (`{subject, body?, breaking}`, temperature ≤ 0.1, hard output cap, subject ≤ 72), zero calls for empty/fully-excluded sets, deterministic ref/type validation, one retry with the lint error fed back, deterministic template fallback.
- Transport seam in order: core-owned inference via the provider engine → harness one-shot in a temporary empty project context → marked template fallback; failover classified in the telemetry event.
- Deterministic safety pass: secret-pattern scan on content and filenames with STOP on suspicion, forbidden-path exclusions, binary size guard, fail-closed scan unavailability, and the privacy ordering that no bundle is built before the scan completes.
- `phase complete <ref> <phase>` atomic default: both-or-neither landing, `--no-commit`, `commit.phaseCommit` configuration disable, no-pending-work transition-only with disclosed basis, row-2 no-op with neither record nor commit, clean abort → neither landed → exit 2.
- Durable commit intent on every completion record (`commitIntent` `atomic` | `record-only`, plus `commitIntentBasis` `opt-out-flag` | `config-disabled` | `skipped-no-pending-work` for record-only) landing in the record's own ledger append.
- Four-state re-run convergence (record/commit landed matrix) discriminated by the durable intent, duplicate-record prevention, empty-commit prevention, reconciliation and intentional-no-op disclosure.
- One `delivery.commit.telemetry.v1` event per landed commit, non-gating emission, metadata-only payload, verified reads.
- One new `commit` domain kind with six rows, machine/document sync, and the `{0,1,2}` projection for every outcome.
- Tier/purity/structure discipline for the new contracts, domain, adapter, CLI, and testkit modules; regression of the existing phase command family, plan schema interaction, configuration catalog, and error-table binding.
- SC-M1-12 inherited verbatim as TC-ATOMIC-001/TC-ATOMIC-002.

### 1.2 Out of Scope & Known Gaps

- [OUT] Retiring or re-pointing the `@committer` subagent and any agent prompt adoption (NG-1); the primitive is tested directly.
- [OUT] Spend reporting, dashboards, template-share ceilings, and reads of the telemetry events (M1-S19, NG-2). Only emission and payload shape are tested.
- [OUT] MCP/host-surface exposure, push, PR creation, branch management, any remote operation (NG-3, NG-4).
- [OUT] Local/fine-tuned model lanes, model-profile routing, per-file-summary fan-out (NG-5).
- [OUT] History rewriting, amending commits other than the primitive's own interrupted attempt, interactive message editing (NG-6).
- [OUT] `--dry-run` on `phase complete` (explicitly out of scope, §7.2).

**Notation**: angle-bracket forms (`commit <ref>`, `<type>(<ref>): <summary>`, `<binary>`) reproduce command grammar and the seeded scenario's placeholder wording; they are not unfilled template fields. The injected binary name is supplied by the branding seam in every test.

- [GAP-1 — no implementation plan yet] No `chg-GH-227-plan.yaml`/`.md` exists at authoring time. This plan binds behaviour and assertions; delivery planning maps tasks onto these TCs and must not reshape them. OQ-1 (harness one-shot mechanism) is a delivery-planning decision.
- [GAP-2 — harness transport is faked] The real headless one-shot invocation is not run in this change's tests (no network, no subscription auth in CI). The seam is tested at its port: ordered selection, empty temporary project context, argv/env shape, cleanup, and classified failure. A real-harness conformance probe is deferred to M1-S19 planning.
- [GAP-3 — real provider route is faked] Provider-engine availability (route present, quota park, outage) is injected as facts; no live model call or network is made in any suite.
- [GAP-4 — commitlint binary dependence] Behaviour suites use an injected commitlint port. One adapter test exercises the repository's installed `commitlint` against committed config fixtures; it requires the local dev dependency and fails loudly if absent (as `tests/behaviour/commit-msg-hook.test.ts` does today).
- [GAP-5 — landing-mechanism windows] The clean-abort contract is tested by injecting faults at the ledger-write and commit-object ports. Hard-interruption windows that cannot be produced through a port (process kill between syscalls) are simulated by constructing the durable single-side state directly and re-running; they are not crash-tested. This is recorded in §8.1.
- [GAP-6 — resolved by spec iter 2] The earlier ambiguity between a deliberate opt-out and an interrupted atomic completion is closed by durable commit intent (DEC-7, AC-F7-4); `TC-CONVERGE-007`/`TC-CONVERGE-008` and the post-opt-out assertion in `TC-ATOMIC-002` are now specified. Residual notes are in §8.4.
- [GAP-7 — real git repository required] Unlike most `core` suites, the primitive's core value is real tree state. Behaviour suites therefore spawn `git` inside `mkdtemp` repositories. No other process is licensed, except the single commitlint adapter probe and the existing packed-surface suites.

## 2. References

- **Change specification**: [chg-GH-227-spec.md](./chg-GH-227-spec.md) — AC-F1-1..AC-NFR9-1 (23 ACs, spec iter 2), F-1..F-8, DEC-1..DEC-15 (DEC-7 amended), EVT-1, DM-1..DM-4, NFR-1..NFR-9, §14 OQ-T1 resolution, §20 privacy ordering, Appendix B matrix extension.
- **Seeded scenario**: [test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — SC-M1-12 (line 127), pinned verbatim by AC-F6-1/AC-F6-2.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, layer placement, invariant-test rules, gate battery, `pnpm check`.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, injected time/randomness/environment, runtime-API confinement, bun:test authoring.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope shape, documented error table, classification chain, binding sync.
- **Phase transitions**: [feature-pm-notes-lint-and-phase-transitions.md](../../../spec/features/feature-pm-notes-lint-and-phase-transitions.md) — nine-row matrix, `phase.transition` ledger record, derived projection, evidence vocabulary.
- **Plan schema**: [feature-plan-schema.md](../../../spec/features/feature-plan-schema.md) — per-phase declared scope (`files`/`packages`/`folders`), summaries, plan diff classification.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — append-only records, verified reads, fences, additive record kinds.
- **Provider engine**: [feature-provider-engine.md](../../../spec/features/feature-provider-engine.md) — route availability, quota, parks, announcements.
- **Configuration layer**: [feature-config-layer.md](../../../spec/features/feature-config-layer.md) — typed catalog, defaults, origin reporting.
- **Monorepo tiers**: [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) and `.dependency-cruiser.cjs` — package matrix, core tiers, runtime allowlist, boundary fixtures.
- **Existing suites**: `tests/behaviour/phase-{transitions,idempotency,rejections,envelope,registry}.test.ts`, `tests/behaviour/phase-support.ts`, `tests/fixtures/state/harness.ts`, `tests/golden/{helpers.ts,envelope-*.test.ts}`, `tests/structure/{error-table,content-inventory,port-contract-inventory}.test.ts`, `tests/checks/{error-table-sync,config-default-positions,forbidden-literals}.test.ts`, `tests/boundaries/**`.
- **Ticket**: GH-227 — M1-S14: Commit primitive and phase-transition commits.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | Commit message derives from tree + change context (resolved ref, current phase, plan-phase data), no agent authorship of subject/body/staging set | TC-COMMIT-001, TC-COMMIT-005, TC-COMMIT-006, TC-MSG-001 | Covered |
| AC-F1-2 | `--dry-run` prints message and staging/exclusions and changes nothing (no stage, no commit, no record) | TC-COMMIT-002, TC-COMMIT-003 | Covered |
| AC-F1-3 | Invocation inside a delivery session refuses with `commit.session.context-refused`, exit 1, nothing staged/committed | TC-COMMIT-004, TC-ATOMIC-011 | Covered |
| AC-F3-1 | Exactly one model call, schema `{subject, body?, breaking}`, subject ≤ 72, temperature ≤ 0.1, hard cap; zero calls on empty/fully-excluded set | TC-MSG-002, TC-MSG-003, TC-MSG-004, TC-MSG-010 | Covered |
| AC-F3-2 | Invented ref/off-list type fails deterministic checks, one retry with lint feedback, second failure → template (`messageSource: template`) | TC-MSG-005, TC-MSG-006, TC-MSG-007 | Covered |
| AC-F3-3 | Repository commitlint forbidding the template aborts `commit.commitlint-failed`, exit 1, nothing staged/committed; retry path feeds the lint error back | TC-MSG-006, TC-MSG-008, TC-MSG-009 | Covered |
| AC-F4-1 | Transport seam tries core inference first, harness one-shot second (headless, temporary empty project), template last; event classifies transport and failover | TC-TRANSPORT-001, TC-TRANSPORT-002, TC-TRANSPORT-004 | Covered |
| AC-F4-2 | No transport available → template commit lands (`messageSource: template`), delivery not stalled | TC-TRANSPORT-003, TC-TRANSPORT-005 | Covered |
| AC-F5-1 | Untracked stray outside any declared scope never staged, disclosed; tracked drift and in-scope untracked follow DEC-15 | TC-SAFETY-001, TC-SAFETY-002, TC-SAFETY-003 | Covered |
| AC-F5-2 | Secret-suspicious content/filename STOPs with `commit.safety.secret-suspected`, exit 1, nothing staged/committed, no material leaked; scan runs before transport | TC-SAFETY-004, TC-SAFETY-005, TC-SAFETY-010, TC-TRANSPORT-006 | Covered |
| AC-F5-3 | Forbidden paths/oversized binaries excluded and disclosed; exclusion emptying the set refuses with `commit.staging-blocked-untracked` (exit 1) | TC-SAFETY-006, TC-SAFETY-007, TC-SAFETY-008 | Covered |
| AC-F5-4 | Safety pass cannot execute → `commit.safety.scan-unavailable`, exit 2, fail-closed | TC-SAFETY-009 | Covered |
| AC-F6-1 | SC-M1-12: `phase complete` lands ledger transition (with durable intent `atomic`) AND conventional commit (both or neither); stray remains untracked | TC-ATOMIC-001, TC-ATOMIC-006, TC-ATOMIC-007, TC-ATOMIC-010, TC-ATOMIC-012, TC-COMMIT-005 | Covered |
| AC-F6-2 | SC-M1-12: `phase complete --no-commit` records the transition alone with durable intent `record-only` / basis `opt-out-flag` in the same append; no commit object | TC-ATOMIC-002, TC-ATOMIC-008, TC-ATOMIC-012, TC-CONVERGE-007 | Covered |
| AC-F6-3 | No stageable pending work → transition alone with durable intent `record-only` / basis `skipped-no-pending-work`, disclosed as `commitSkipped: skipped-no-pending-work`; no empty commit | TC-ATOMIC-003, TC-ATOMIC-012, TC-CONVERGE-006, TC-CONVERGE-007 | Covered |
| AC-F6-4 | Project configuration disabling the atomic commit → transition alone with durable basis `config-disabled`, disclosed as `commitSkipped: config-disabled` (origin reported) | TC-ATOMIC-004, TC-ATOMIC-012, TC-CONVERGE-007, TC-REGRESS-006 | Covered |
| AC-F6-5 | Platform fault in the atomic act → both sides restored to neither-landed, `commit.atomic-abort` exit 2, re-run converges | TC-ATOMIC-005, TC-CONVERGE-004 | Covered |
| AC-F7-1 | Record landed with intent `atomic` / commit missing → re-run completes the missing commit, no new record, reconciliation disclosed; opt-out (`record-only`) excluded | TC-CONVERGE-001, TC-CONVERGE-005, TC-CONVERGE-006, TC-CONVERGE-008 | Covered |
| AC-F7-2 | Commit landed / record missing → re-run appends the transition (with intent `atomic`), no re-commit, no empty commit | TC-CONVERGE-002, TC-CONVERGE-005 | Covered |
| AC-F7-3 | Both landed (matrix row 2) → no-op success citing the existing completion, no record, no commit | TC-ATOMIC-009, TC-CONVERGE-003, TC-CONVERGE-005, TC-TELEM-003 | Covered |
| AC-F7-4 | Record landed with intent `record-only` (any stored basis) → intentional no-op convergence citing the stored basis: no commit, no new record, basis disclosed | TC-CONVERGE-007, TC-CONVERGE-008, TC-ATOMIC-002, TC-ATOMIC-003, TC-ATOMIC-004, TC-CONVERGE-006 | Covered |
| AC-F8-1 | Exactly one telemetry event per landed commit (ref, phase, SHA, source, transport, spend, transition identity); emission failure disclosed and non-gating | TC-TELEM-001, TC-TELEM-002, TC-TELEM-003, TC-TELEM-004, TC-ATOMIC-009, TC-ATOMIC-010 | Covered |
| AC-NFR9-1 | Every outcome under `--json` is exactly one valid result envelope with exit in `{0,1,2}` | TC-ENV-001, TC-ENV-002, TC-ENV-003 | Covered |

**Capability coverage** (no capability left unlinked): F-1 → TC-COMMIT-001..006; F-2 → TC-MSG-001, TC-MSG-002, TC-COMMIT-006; F-3 → TC-MSG-003..010; F-4 → TC-TRANSPORT-001..006; F-5 → TC-SAFETY-001..010; F-6 → TC-ATOMIC-001..012; F-7 → TC-ATOMIC-006..009, TC-CONVERGE-001..008; F-8 → TC-TELEM-001..004.

**AC count**: 23 (22 from spec v1.0 plus AC-F7-4 from the iter-2 amendment); every AC row is `Covered`.

**TC → AC traceability**: each scenario's `Related IDs` line carries the reverse direction; §5.1 repeats it per row. Both directions are derived only from the spec.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no REST/HTTP endpoints; the interface surface is the CLI invocation matrix plus one event and four data models.

| Interface / element | Description | TC ID(s) | Status |
|---------------------|-------------|----------|--------|
| `commit <ref>` | Computed commit for stageable pending work; exit 0/1/2 | TC-COMMIT-001, TC-COMMIT-006, TC-ENV-001 | Covered |
| `commit <ref> --phase <phase>` | Same atomic primitive as `phase complete`; `atomic: true` | TC-COMMIT-005, TC-ATOMIC-001 | Covered |
| `commit <ref> --dry-run` | Message + staging/exclusions printed; nothing changes | TC-COMMIT-002, TC-COMMIT-003 | Covered |
| `phase complete` (default) | Atomic transition (durable intent `atomic`) + commit; 0/1/2 | TC-ATOMIC-001, TC-ATOMIC-003, TC-ATOMIC-005, TC-ATOMIC-012 | Covered |
| `phase complete --no-commit` | Transition alone with durable `record-only`/`opt-out-flag`; no commit object; re-run intentional no-op | TC-ATOMIC-002, TC-ATOMIC-008, TC-CONVERGE-007 | Covered |
| EVT-1 | One commit telemetry event per landed commit; non-gating; verified reads | TC-TELEM-001..004 | Covered |
| DM-1 | `delivery.commit.telemetry.v1` payload (ref, phase, SHA, source, transport, spend, landed-at, transition identity) | TC-TELEM-001, TC-TELEM-004 | Covered |
| DM-2 | `commit` success data (`subject`, `body?`, `stagedFiles`, `excluded`, `commitSha`, `messageSource`, `transport`, `atomic`, `ledgerTransition`, `dryRun`) | TC-COMMIT-001, TC-COMMIT-002, TC-ENV-001 | Covered |
| DM-3 | `phase complete` data extension (`commitSkipped` vocabulary `opt-out-flag` \| `config-disabled` \| `skipped-no-pending-work` \| `no-op`, reconciliation / intentional-no-op evidence) | TC-ATOMIC-002, TC-ATOMIC-003, TC-ATOMIC-004, TC-CONVERGE-001..003, TC-CONVERGE-006, TC-CONVERGE-007, TC-ENV-001 | Covered |
| DM-4 | One `commit` domain kind, six rows, documented sync | TC-TABLE-005, TC-TABLE-006, TC-TABLE-007, TC-ENV-002 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Exactly one model call; zero on empty/excluded/template; token spend in band | TC-MSG-003, TC-MSG-004, TC-TRANSPORT-003, TC-TRANSPORT-005 | Covered |
| NFR-2 | Constrained output: schema shape, low temperature, hard cap, subject ≤ 72, body cap | TC-MSG-003, TC-MSG-010 | Covered |
| NFR-3 | Latency: dry-run ≤ 2 s p95; template commit ≤ 5 s p95; model transport ≤ 30 s p95 | TC-REGRESS-008 | Covered (local bound, see §8.1) |
| NFR-4 | Determinism: identical tree/context/injected dependencies → byte-identical dry-run output | TC-COMMIT-003 | Covered |
| NFR-5 | Purity and tiers: contracts data-only, domain runtime-neutral, runtime only at edges | TC-TIER-001, TC-TIER-002, TC-TIER-003 | Covered |
| NFR-6 | No empty commits, no duplicate records; convergence total over four states discriminated by durable intent | TC-ATOMIC-005, TC-ATOMIC-009, TC-ATOMIC-010, TC-ATOMIC-012, TC-CONVERGE-005, TC-CONVERGE-007, TC-CONVERGE-008 | Covered |
| NFR-7 | Fail-closed safety: nothing staged/committed without a completed safety pass | TC-SAFETY-010, TC-TRANSPORT-006, TC-TELEM-004 | Covered |
| NFR-8 | Branding: no hardcoded product/binary name in modules or docs | TC-REGRESS-007 | Covered |
| NFR-9 | Every `--json` outcome is exactly one valid envelope | TC-ENV-001, TC-ENV-002, TC-ENV-003 | Covered |

### 3.4 Regression Coverage (existing behavior that must not change)

| Regression area | Existing suite | TC ID(s) | Status |
|-----------------|----------------|----------|--------|
| Matrix rows 4–9, grammar-before-state, advisories, absent-phase entry creation | `tests/behaviour/phase-transitions.test.ts`, `phase-rejections.test.ts` | TC-REGRESS-004 | Covered |
| Row 2 / row 5 no-op with three-way delta (exit, ledger count, document bytes) | `tests/behaviour/phase-idempotency.test.ts` | TC-ATOMIC-009, TC-REGRESS-004 | Covered |
| `phase list` projection, verified registry reads, read-only path | `tests/behaviour/phase-registry.test.ts`, `phase-envelope.test.ts` | TC-REGRESS-005 | Covered |
| Configuration catalog and shipped defaults | `tests/behaviour/config-schema.test.ts`, `tests/checks/config-default-positions.test.ts` | TC-REGRESS-006 | Covered |
| Branding forbidden literals, privacy guards, doc distribution markers | `tests/checks/forbidden-literals.test.ts`, `privacy-*.test.ts`, `scripts/.tests/test-doc-distribution.sh` | TC-REGRESS-007 | Covered |
| Result-contract envelope/sync after six new rows | `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts` | TC-TABLE-005..007 | Covered |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Structure / contract | `bun test tests/structure` | `tests/structure/commit-contract.test.ts`, `commit-imports.test.ts` (new); `error-table.test.ts`, `content-inventory.test.ts`, `port-contract-inventory.test.ts` (updated) | TC-TIER-001..003, TC-TABLE-005, TC-TABLE-007 |
| Behaviour (in-process CLI + real temp git repo) | `bun test tests/behaviour` | `tests/behaviour/commit-command.test.ts`, `commit-message.test.ts`, `commit-transport.test.ts`, `commit-safety.test.ts`, `commit-convergence.test.ts`, `commit-telemetry.test.ts`, `commit-session-guard.test.ts`, `commit-performance.test.ts` (new); `phase-atomic.test.ts` (new); `phase-idempotency.test.ts`, `phase-transitions.test.ts`, `phase-envelope.test.ts` (updated) | TC-COMMIT-*, TC-MSG-*, TC-TRANSPORT-*, TC-SAFETY-*, TC-ATOMIC-*, TC-CONVERGE-*, TC-TELEM-*, TC-REGRESS-004..006, TC-REGRESS-008 |
| Golden / envelope | `bun test tests/golden` | `tests/golden/commit-envelope.test.ts` (new) + `tests/fixtures/envelope/golden/commit-*.json` | TC-ENV-001..003 |
| Checks / mutation | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks` | `tests/checks/error-table-sync.test.ts` (updated); `forbidden-literals.test.ts` (registry updated); `config-default-positions.test.ts` (updated) | TC-TABLE-006, TC-REGRESS-006, TC-REGRESS-007 |
| Boundary / purity | `pnpm check:boundaries`; `bun test tests/boundaries tests/structure`; `bun run scripts/checks/{ambient-globals,workspace-entrypoints,exports-parity}.ts` | existing boundary harness; new import detectors | TC-TIER-001..003 |
| Performance (local, no network) | `bun test tests/behaviour/commit-performance.test.ts` | real temp repo; fake transports; `performance.now()` sampling | TC-REGRESS-008 |
| Aggregate | `pnpm check` | repo root — lint → format → typecheck → test → boundaries | all |
| Static | `git diff --check`; changed-file review | repo root | all (gate) |

### 4.1 In-Process Command-Harness Contract (binding for all commit/phase behaviour TCs)

Every behaviour test composes the **real command definition** (`createCommitCommandDefinition` / `createPhaseCommandDefinition`) and `runCli` in-process, with these injected dependencies and no child process other than `git` (and the single commitlint adapter probe):

- `brand`: the synthetic `SYNTHETIC_BRAND` from `tests/golden/helpers.ts`; no product literal is asserted.
- `clock`: a mutable deterministic clock (`tests/fixtures/commit/harness.ts`), so `landedAt`, `timing.totalMs`, and envelope timestamps are fixed.
- `newRunId` and `secrets`: deterministic values; the redaction chokepoint stays enabled.
- `repository`: a **real temporary git repository** created under `mkdtemp`, initialized with `init.defaultBranch=main`, local `user.name`/`user.email`, `commit.gpgsign=false`, `core.hooksPath=/dev/null`, and a fixed seed commit. Tests read facts back with `git status --porcelain`, `git rev-list --count HEAD`, `git diff --cached --name-only`, `git log --format=%B`, `git show --stat`.
- `state`: a temp state root built through `tests/fixtures/state/harness.ts` (`makeIdentity`, `openStore`, `ledgerLines`); the live state directory is never touched.
- `transport`: a scripted fake implementing the transport port (ordered attempts, availability states, recorded bundles/calls). Provider-engine availability is injected as a fact.
- `safety`: a deterministic scanner fake (clean, secret-content, secret-filename, forbidden-path, oversized-binary, unavailable) plus a real adapter implementation tested separately; the fake records whether the index was clean when called.
- `commitlint`: an injected port returning `valid` / `invalid(errors)` / `absent`; the adapter probe shells to the repository's installed binary.
- `session`: edge-injected delivery-session facts (present/absent) for the refusal guard.

### 4.2 Non-Vacuity Contract

Every negative, no-op, and STOP scenario pairs its fixture with a restored or valid control and asserts the durable delta, not only the code:

- A refusal asserts exit code **and** `git status --porcelain` unchanged **and** `git rev-list --count HEAD` unchanged **and** ledger line count unchanged.
- A no-op asserts exit 0 **and** zero additional ledger records **and** unchanged `HEAD` **and** no telemetry record.
- An exclusion asserts the excluded path is absent from `git diff --cached --name-only` **and** present in the envelope's `excluded` disclosure **and** the valid work still landed.
- A convergence case asserts the completed side once (count 1) and the other side exactly once, then re-runs to a stable no-op.
- A purity check includes a temp-copy mutation that introduces the forbidden edge and observes the guard name the file.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-COMMIT-001 | Standalone commit derives message from tree and change context | Happy Path | Critical | High | AC-F1-1 |
| TC-COMMIT-002 | `--dry-run` prints message/staging/exclusions and mutates nothing | Happy Path | Critical | High | AC-F1-2 |
| TC-COMMIT-003 | Dry-run determinism: byte-identical output for fixed injected dependencies | Corner Case | Important | High | AC-F1-2, NFR-4 |
| TC-COMMIT-004 | Session-context refusal on the `commit` surface | Negative | Critical | High | AC-F1-3 |
| TC-COMMIT-005 | `commit --phase` exercises the same atomic primitive as `phase complete` | Happy Path | Critical | High | AC-F1-1, AC-F6-1 |
| TC-COMMIT-006 | Ref resolution order and plan-absent scope degradation disclosed | Edge Case | Important | Medium | AC-F1-1 |
| TC-MSG-001 | Deterministic skeleton: type table, scope, breaking default | Happy Path | Critical | High | AC-F1-1 |
| TC-MSG-002 | Generated noise stripped and diff budget capped before the bundle | Edge Case | Critical | High | AC-F3-1 |
| TC-MSG-003 | Exactly one call with constrained schema, temperature, and cap | Happy Path | Critical | High | AC-F3-1, NFR-1, NFR-2 |
| TC-MSG-004 | Zero model calls on empty or fully-excluded staging set | Negative | Critical | High | AC-F3-1, NFR-1 |
| TC-MSG-005 | Invented tracker references never land | Negative | Critical | High | AC-F3-2 |
| TC-MSG-006 | Off-list type/long subject → one retry with the lint error fed back | Negative | Critical | High | AC-F3-2, AC-F3-3 |
| TC-MSG-007 | Second validation failure falls back to the marked template | Corner Case | Critical | High | AC-F3-2 |
| TC-MSG-008 | Template violating repo commitlint aborts `commit.commitlint-failed` | Negative | Critical | High | AC-F3-3 |
| TC-MSG-009 | Commitlint absent degrades to deterministic checks only | Edge Case | Important | Medium | AC-F3-3 |
| TC-MSG-010 | Optional body and breaking default follow the context contract | Edge Case | Important | Medium | AC-F3-1, NFR-2 |
| TC-TRANSPORT-001 | Seam order: core inference, then harness, then template | Happy Path | Critical | High | AC-F4-1 |
| TC-TRANSPORT-002 | Harness one-shot is headless in a temporary empty project context | Happy Path | Critical | High | AC-F4-1 |
| TC-TRANSPORT-003 | No transport → template commit lands, delivery not stalled | Corner Case | Critical | High | AC-F4-2 |
| TC-TRANSPORT-004 | Failover classified in the emitted event | Edge Case | Critical | High | AC-F4-1 |
| TC-TRANSPORT-005 | Provider quota park falls through without waiting | Edge Case | Important | High | AC-F4-2 |
| TC-TRANSPORT-006 | Safety pass precedes transport selection; no bundle on STOP | Negative | Critical | High | AC-F5-2, NFR-7 |
| TC-SAFETY-001 | Untracked stray outside declared scope never staged | Negative | Critical | High | AC-F5-1 |
| TC-SAFETY-002 | Untracked file inside declared scope is staged | Happy Path | Important | High | AC-F5-1 |
| TC-SAFETY-003 | Tracked work outside declared scope staged with drift disclosure | Edge Case | Important | High | AC-F5-1 |
| TC-SAFETY-004 | Secret-suspicious content STOPs with no leak | Negative | Critical | High | AC-F5-2 |
| TC-SAFETY-005 | Secret-suspicious filename STOPs without leaking material | Negative | Critical | High | AC-F5-2 |
| TC-SAFETY-006 | Forbidden paths excluded and disclosed; valid work still commits | Edge Case | Critical | High | AC-F5-3 |
| TC-SAFETY-007 | Oversized binary excluded and disclosed | Edge Case | Important | High | AC-F5-3 |
| TC-SAFETY-008 | Exclusion emptying the set refuses as staging-blocked | Negative | Critical | High | AC-F5-3 |
| TC-SAFETY-009 | Safety pass unavailable fails closed with exit 2 | Negative | Critical | High | AC-F5-4 |
| TC-SAFETY-010 | Safety runs before anything is staged (index untouched) | Corner Case | Critical | High | AC-F5-2, NFR-7 |
| TC-ATOMIC-001 | SC-M1-12: atomic default lands record and commit, stray unstaged | Happy Path | Critical | High | AC-F6-1 |
| TC-ATOMIC-002 | SC-M1-12: `--no-commit` records the transition alone with durable `record-only` intent | Happy Path | Critical | High | AC-F6-2, AC-F7-4 |
| TC-ATOMIC-003 | No stageable pending work → transition alone with durable `skipped-no-pending-work` basis | Edge Case | Critical | High | AC-F6-3, AC-F7-4 |
| TC-ATOMIC-004 | Configuration disable → transition alone with durable `config-disabled` basis | Edge Case | Critical | High | AC-F6-4, AC-F7-4 |
| TC-ATOMIC-005 | Clean abort restores neither side; exit 2; re-run converges | Negative | Critical | High | AC-F6-5 |
| TC-ATOMIC-006 | Matrix row 1: open → complete lands one record and one commit | Happy Path | Critical | High | AC-F6-1, AC-F7-3 |
| TC-ATOMIC-007 | Matrix row 3: reopened → complete lands a new record and commit | Happy Path | Important | High | AC-F6-1 |
| TC-ATOMIC-008 | Reopen path unchanged: no commit object | Regression | Critical | High | AC-F6-2 |
| TC-ATOMIC-009 | Matrix row 2: no-op appends no record and creates no commit | Regression | Critical | High | AC-F7-3, AC-F8-1 |
| TC-ATOMIC-010 | Atomic landing appends exactly one transition record with durable `atomic` intent | Corner Case | Critical | High | AC-F6-1, NFR-6 |
| TC-ATOMIC-011 | Session-context refusal on `phase complete` | Negative | Critical | High | AC-F1-3 |
| TC-ATOMIC-012 | Commit intent lands in the record's own ledger append (no second write) | Corner Case | Critical | High | AC-F6-1, AC-F6-2, AC-F6-3, AC-F6-4, DEC-7 |
| TC-CONVERGE-001 | Record only → complete the missing commit, no new record | Corner Case | Critical | High | AC-F7-1 |
| TC-CONVERGE-002 | Commit only → append the transition, no re-commit | Corner Case | Critical | High | AC-F7-2 |
| TC-CONVERGE-003 | Both landed → no-op citing the existing completion | Regression | Critical | High | AC-F7-3 |
| TC-CONVERGE-004 | Neither landed → normal atomic path | Happy Path | Important | High | AC-F6-5 |
| TC-CONVERGE-005 | Convergence is total over the four durable states and all intents | Corner Case | Critical | High | AC-F7-1..4, NFR-6 |
| TC-CONVERGE-006 | Record only with no pending work: intentional no-op, no empty commit | Edge Case | Important | Medium | AC-F7-4, AC-F6-3 |
| TC-CONVERGE-007 | Intentional record-only re-runs converge to no-op across all three bases | Edge Case | Critical | High | AC-F7-4, AC-F6-2, AC-F6-3, AC-F6-4 |
| TC-CONVERGE-008 | Intent discrimination is evidence-driven, not mode-guessing | Corner Case | Critical | High | AC-F7-1, AC-F7-4, DEC-7 |
| TC-TELEM-001 | Exactly one telemetry event per landed commit with all DM-1 fields | Happy Path | Critical | High | AC-F8-1 |
| TC-TELEM-002 | Emission failure disclosed without failing the commit | Negative | Important | High | AC-F8-1 |
| TC-TELEM-003 | No event on refusal, abort, no-op, or no-pending-work | Negative | Critical | High | AC-F8-1, AC-F7-3 |
| TC-TELEM-004 | Telemetry payload is metadata-only and schema-valid | Corner Case | Critical | High | AC-F8-1, DM-1 |
| TC-ENV-001 | Success envelopes match DM-2/DM-3 and the contract | Happy Path | Critical | High | AC-NFR9-1 |
| TC-ENV-002 | Six commit failures project exactly and validly | Negative | Critical | High | AC-NFR9-1, DM-4 |
| TC-ENV-003 | Containment and broken invocation yield one valid envelope | Negative | Important | High | AC-NFR9-1 |
| TC-TABLE-005 | Machine table declares `commit` kind with six exact rows | Contract | Critical | High | DM-4 |
| TC-TABLE-006 | Documented table and machine table stay in sync | Contract | Critical | High | DM-4 |
| TC-TABLE-007 | Template fallback is success evidence, not a failure row | Contract | Important | Medium | DM-4, AC-F4-2 |
| TC-TIER-001 | New commit contracts are data-only and inventoried | Contract | Critical | High | NFR-5 |
| TC-TIER-002 | Domain purity: contracts-only imports, no ambient reads | Contract | Critical | High | NFR-5 |
| TC-TIER-003 | Runtime only at adapters/CLI edges; entrypoints declared | Contract | Critical | High | NFR-5 |
| TC-REGRESS-004 | Phase family rows 4–9, grammar, and advisories unchanged | Regression | Critical | High | F-7 (regression) |
| TC-REGRESS-005 | `phase list` projection and read path unchanged, no commit | Regression | Critical | High | F-7 (regression) |
| TC-REGRESS-006 | Config catalog gains `commit` branch; provider branch unchanged | Regression | Critical | High | AC-F6-4 |
| TC-REGRESS-007 | Branding/privacy/doc gates stay green with the new docs | Regression | Important | High | NFR-8 |
| TC-REGRESS-008 | Latency bounds on dry-run and template paths | Performance | Important | Medium | NFR-3 |

### 5.2 Scenario Details

#### TC-COMMIT-001 - Standalone commit derives message from tree and change context

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-3, AC-F1-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-command.test.ts`; `tests/behaviour/commit-support.ts`
**Tags**: @backend, @git

**Preconditions**:
- Temporary git repo on a branch carrying `GH-310`; change folder `doc/changes/.../chg-GH-310-plan.yaml` with a `delivery` phase declaring scope, title, and summary; pm-notes has `delivery` open.
- One tracked in-scope modified file and one new in-scope untracked file; no stray.
- Scripted transport returns `{subject, body, breaking}`; injected clock and state root.

**Steps**:
1. Run `commit GH-310` and capture the envelope.
2. Read `git log -1 --format=%B`, `git show --stat --name-only --format=`, and `git status --porcelain`.

**Expected Outcome**:
- Exit 0; `data.subject` is conventional (`feat(GH-310): …` per the phase table), ≤ 72 characters; `data.body` present only when produced.
- `data.commitSha` equals `HEAD`; `data.stagedFiles` equals the computed in-scope set; `data.messageSource === "model"`; `data.transport === "core-inference"`; `data.atomic === false`; `data.dryRun` absent.
- The scripted transport received the computed skeleton (ref/type/scope/plan summary) and no test path allows a caller-supplied subject, body, or staging set to override it (recorder shows no agent/committer invocation).
- `git show --name-only` names only the computed paths.

#### TC-COMMIT-002 - `--dry-run` prints message/staging/exclusions and mutates nothing

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-command.test.ts`
**Tags**: @backend, @git

**Preconditions**:
- Dirty tree: one tracked modification, one in-scope untracked file, one untracked stray outside scope.
- Stable HEAD and ledger baseline recorded before the run.

**Steps**:
1. Capture `git status --porcelain`, `git rev-parse HEAD`, `git diff --cached --name-only`, and ledger line count.
2. Run `commit GH-310 --dry-run`.
3. Re-capture the same facts.

**Expected Outcome**:
- Exit 0; `data.dryRun === true`; the computed subject/body and `stagedFiles` are printed; `data.excluded.untrackedNotStaged` names the stray; other exclusions are disclosed.
- Status bytes, HEAD, index, and ledger count are identical before/after; no commit object and no telemetry record exists.
- Exactly one transport call is recorded (message computation only); nothing is staged.

#### TC-COMMIT-003 - Dry-run determinism for fixed injected dependencies

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-2, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-command.test.ts`
**Tags**: @backend, @determinism

**Preconditions**:
- A fixed tree, fixed skeleton inputs, scripted transport returning the same message, injected clock/runId.

**Steps**:
1. Run `--dry-run` twice with the same injected dependencies; capture stdout bytes.
2. Change exactly one input file's content and run again.

**Expected Outcome**:
- The two runs are byte-identical (identical envelope, message, staging list, exclusion ordering).
- The third run differs only in the fields derived from the changed content; paths remain normalized and sorted.
- No timestamp, absolute path, or random value leaks into the compared payload.

#### TC-COMMIT-004 - Session-context refusal on the `commit` surface

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DM-4, AC-F1-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-session-guard.test.ts`
**Tags**: @backend, @security

**Preconditions**:
- Edge-injected delivery-session facts present (active session id/context).
- Dirty tree and a valid change context; baseline status/HEAD/ledger captured.

**Steps**:
1. Run `commit GH-310`, `commit GH-310 --dry-run`, and `commit GH-310 --phase delivery` with session facts present.
2. Remove the session facts and run `commit GH-310` as the control.

**Expected Outcome**:
- Each session invocation exits 1 with `commit.session.context-refused`, category `user`, retryable `false`, consequence `not_landed`; remediation tells the caller to invoke from outside.
- Status, HEAD, index, ledger, and telemetry are unchanged; no transport or safety port is constructed.
- The control proceeds normally (exit 0), proving the guard is the only difference.

#### TC-COMMIT-005 - `commit --phase` shares the atomic primitive

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-1, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-command.test.ts`
**Tags**: @backend, @git

**Preconditions**:
- Open `delivery` phase with in-scope pending work and a plan declaration; no stray.

**Steps**:
1. Run `commit GH-310 --phase delivery`.
2. Re-run `phase complete GH-310 delivery`.

**Expected Outcome**:
- Exit 0; `data.atomic === true`; `data.ledgerTransition` is present; exactly one `phase.transition` record and one commit land; telemetry carries `phase: delivery`.
- The second invocation is a matrix row-2 no-op: no additional record, no additional commit, and no telemetry.
- Staging/exclusion behavior is identical to TC-ATOMIC-001 for the same tree.

#### TC-COMMIT-006 - Ref resolution order and plan-absent scope degradation

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-F1-1, §12
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-command.test.ts`
**Tags**: @backend

**Preconditions**:
- Case A: branch name carries `GH-310`, change folder also present.
- Case B: branch is generic, exactly one change folder carries `GH-310`.
- Case C: phase-centric mode with no plan artifact; tracked pending work plus an untracked file outside any declared scope.
- Case D: no resolvable ref anywhere.

**Steps**:
1. Run each case and capture the envelope/evidence.
2. In Case C, verify which untracked paths staged.

**Expected Outcome**:
- Case A resolves from the branch first; Case B falls back to the change folder; the resolution source is disclosed.
- Case C stages tracked work, excludes the untracked path outside scope, and discloses the degraded scope source (no plan) in evidence; no invented scope is used.
- Case D lands nothing, stages nothing, and returns exactly one valid classified failure envelope (dedicated identity is a delivery decision, see OQ-T3).

#### TC-MSG-001 - Deterministic skeleton: type table, scope, breaking default

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F1-1, DEC-11
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-message.test.ts`; domain skeleton tests
**Tags**: @backend

**Preconditions**:
- Phase/type table core defaults; one case per canonical phase category and the documented pairs (delivery → feat, review_fix → fix, docs sync → docs).

**Steps**:
1. Compute the skeleton for each phase with a plan summary and without one.
2. Feed a transport response that tries to change type/scope/ref and re-run validation.

**Expected Outcome**:
- Type is from the table (never from the model); scope is the resolved ref; breaking defaults to `false`; plan-phase summary is used for the fallback/template input.
- A response disagreeing with the computed type/ref fails deterministic validation and enters the retry path.
- Unknown phases use a documented default, never an invented type.

#### TC-MSG-002 - Generated noise stripped and diff budget capped before the bundle

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F3-1, DEC-12
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-message.test.ts`
**Tags**: @backend, @privacy

**Preconditions**:
- Tree includes a lockfile, a minified file, a vendored directory, an over-cap large file, and 30 ordinary files.

**Steps**:
1. Run a generation attempt with a recording transport; inspect the captured bundle.
2. Disable one noise rule in a temp copy as the non-vacuity control.

**Expected Outcome**:
- The bundle excludes lockfiles/minified/vendored paths; the over-cap file contributes name-status metadata only; the total input stays within the shipped budget.
- Paths are deterministic and sorted; no secret-suspicious content is present (see TC-TRANSPORT-006).
- The control bundle includes the formerly excluded path, proving the filter is live.

#### TC-MSG-003 - Exactly one call with constrained schema, temperature, and cap

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-1, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-message.test.ts`
**Tags**: @backend

**Preconditions**:
- Stageable pending work; available transport; scripted valid response.

**Steps**:
1. Run the commit and capture transport calls and the landed message.

**Expected Outcome**:
- Exactly one transport call; request carries the `{subject, body?, breaking}` schema, temperature ≤ 0.1, and a hard output cap.
- The response is validated against the schema; the landed subject is ≤ 72 characters; body respects its cap.
- No second call occurs on the happy path; `messageSource === "model"` and token spend is recorded.

#### TC-MSG-004 - Zero model calls on empty or fully-excluded staging set

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-command.test.ts`, `commit-message.test.ts`
**Tags**: @backend

**Preconditions**:
- Case A: clean tree (no pending work).
- Case B: only forbidden-path or stray material (fully excluded staging set).
- Case C: `phase complete` with no stageable pending work.

**Steps**:
1. Run each case with a recording transport.

**Expected Outcome**:
- Zero transport calls in A, B, and C.
- A/B on the `commit` surface return `commit.staging-blocked-untracked`, exit 1, nothing staged/committed.
- C lands the transition alone with a disclosed basis (TC-ATOMIC-003), no commit, no telemetry.

#### TC-MSG-005 - Invented tracker references never land

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DEC-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-message.test.ts`
**Tags**: @backend, @security

**Preconditions**:
- Resolved ref `GH-310`; scripted response subject `feat(GH-999): add thing` and body mentioning `GH-888`.

**Steps**:
1. Run the commit.
2. Read the full landed message (`git log -1 --format=%B`).

**Expected Outcome**:
- No `GH-999`/`GH-888` (or any tracker reference other than the resolved ref) appears in subject or body.
- Fabricated references are removed mechanically; if removal cannot yield a valid message, one retry runs and then the template lands.
- Final `messageSource` is either `model` (cleaned) or `template`; the landed subject still names `GH-310` and satisfies commitlint.

#### TC-MSG-006 - Off-list type/long subject → one retry with lint feedback

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, AC-F3-3, DEC-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-message.test.ts`
**Tags**: @backend

**Preconditions**:
- First response uses type `wip` and a 90-character subject (or a repo-forbidden type).
- Second response is valid.

**Steps**:
1. Run the commit and capture both requests.
2. Read the landed message.

**Expected Outcome**:
- Deterministic validation fails the first response (off-list type and over-length subject); exactly one retry occurs — two calls total, never three.
- The retry request includes the concrete lint/validation error text fed back to the model.
- The landed message is the valid second response with `messageSource: model`; no template is used.

#### TC-MSG-007 - Second validation failure falls back to the marked template

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DEC-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-message.test.ts`
**Tags**: @backend

**Preconditions**:
- Both responses are invalid (off-list type / invented ref / over-length).
- Plan phase summary present, so the template is deterministic.

**Steps**:
1. Run the commit.
2. Read the envelope, the landed message, and the telemetry event.

**Expected Outcome**:
- Exactly two calls; then the deterministic template lands: `<type>(<ref>): <summary>`, subject ≤ 72.
- `data.messageSource === "template"`; telemetry `messageSource: template`; token spend records the two failed calls (or the documented spend shape) while template generation itself costs zero.
- Exit 0 — template fallback is success, not a failure identity.

#### TC-MSG-008 - Template violating repo commitlint aborts `commit.commitlint-failed`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, DM-4, DEC-4, RSK-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-message.test.ts`; commitlint adapter probe
**Tags**: @backend, @lint

**Preconditions**:
- Temp repo commitlint config forbids the template shape (e.g. disallows the `feat` type or the scope form); both model attempts invalid.
- Baseline status/HEAD/ledger captured.

**Steps**:
1. Run the commit.
2. Restore a permissive config and re-run as the control.

**Expected Outcome**:
- Exit 1 with `commit.commitlint-failed`, category `user`, retryable `false`, consequence `not_landed`.
- Nothing staged, no commit object, no ledger record, no telemetry; status and HEAD unchanged.
- Remediation names the reconciliation between the type table and the repository config; the control lands a commit.

#### TC-MSG-009 - Commitlint absent degrades to deterministic checks only

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, AC-F3-3, §8.4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-message.test.ts`
**Tags**: @backend, @lint

**Preconditions**:
- Temp repo with no commitlint config; validation port reports `absent`; a message that passes deterministic checks.

**Steps**:
1. Run the commit and capture the validation evidence.

**Expected Outcome**:
- Exit 0; only deterministic checks (ref match, allowed type, no invented refs) run; the absence is disclosed in evidence.
- The commit lands; no `commit.commitlint-failed` can fire when no config exists.

#### TC-MSG-010 - Optional body and breaking default follow the context contract

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, AC-F3-1, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-message.test.ts`
**Tags**: @backend

**Preconditions**:
- Case A: single-area change whose header explains it; response omits body.
- Case B: auditor-relevant multi-area change (multiple declared phases/areas); response omits body.
- Case C: response carries an over-cap body; breaking flag false.

**Steps**:
1. Run each case and capture validation outcomes and landed messages.

**Expected Outcome**:
- A lands a header-only message with no empty body section.
- B fails validation because a body is required, consumes the one retry, then either lands an in-cap body or the template; the exact "auditor-relevant" criterion is delivery-bound (OQ-T4).
- C's body is capped/rejected per the schema; `breaking` stays `false` unless the computed context says otherwise.

#### TC-TRANSPORT-001 - Seam order: core inference, then harness, then template

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DEC-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-transport.test.ts`
**Tags**: @backend

**Preconditions**:
- Availability matrix injected: core+harness available; core unavailable+harness available; neither.

**Steps**:
1. Run one commit in each availability state with recording transports.
2. Inspect the envelope and telemetry.

**Expected Outcome**:
- Core available → core is called exactly once; harness is never constructed.
- Core unavailable → harness is called exactly once; the template is not used.
- Neither → template lands; zero transport calls.
- Selection follows declared configuration plus capability facts, not a blind retry of every transport.

#### TC-TRANSPORT-002 - Harness one-shot is headless in a temporary empty project context

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, §8.4, OQ-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-transport.test.ts`
**Tags**: @backend, @privacy

**Preconditions**:
- Core unavailable, harness available; harness runner fake captures argv, cwd, env, and filesystem contents.

**Steps**:
1. Run the commit.
2. Inspect the captured harness invocation and the temp context after cleanup.

**Expected Outcome**:
- The harness runs in a fresh temporary directory containing no project files (empty project context); no delivery-session facts, project config, or repository content beyond the bundle are present.
- The invocation carries the same constrained prompt/schema; the response is used.
- The temporary context is removed after the run, including on failure.

#### TC-TRANSPORT-003 - No transport → template commit lands, delivery not stalled

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, G-5, RSK-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-transport.test.ts`
**Tags**: @backend

**Preconditions**:
- No provider route, no harness credentials, no fallback override; pending work.

**Steps**:
1. Run the commit once.
2. Read the envelope, landed message, and telemetry.

**Expected Outcome**:
- Exit 0 on the first invocation; template message lands; `messageSource: template`; `transport: none`; zero token spend.
- No retry loop, sleep, or stall; telemetry records the fallback.
- Delivery is not blocked (no failure identity).

#### TC-TRANSPORT-004 - Failover classified in the emitted event

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, EVT-1, AC-F4-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-transport.test.ts`
**Tags**: @backend

**Preconditions**:
- Case A: core raises a classified provider failure; harness available.
- Case B: core and harness both raise classified failures.

**Steps**:
1. Run each case and read the telemetry payload.

**Expected Outcome**:
- A: commit lands via harness; event transport is `harness-one-shot` with a classified failover reason naming `core-inference`.
- B: template lands; event transport is `none` with the ordered failover chain (`core-inference`, `harness-one-shot`) and classified reasons.
- No raw provider error payload or credential material appears in the event or envelope.

#### TC-TRANSPORT-005 - Provider quota park falls through without waiting

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-2, provider engine
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-transport.test.ts`
**Tags**: @backend

**Preconditions**:
- Provider engine reports a quota park with a resume time in the future; harness unavailable.

**Steps**:
1. Run the commit with an injected clock; assert no time advance is requested.

**Expected Outcome**:
- The commit does not wait for the park window; it falls through to the template and lands.
- Event records the park/fallthrough classification and `messageSource: template`; the injected clock is unchanged.

#### TC-TRANSPORT-006 - Safety pass precedes transport selection; no bundle on STOP

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-7, §20
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-transport.test.ts`
**Tags**: @backend, @security, @privacy

**Preconditions**:
- Candidate staging content contains a secret-suspicious pattern; transport fakes record construction and bundle calls.

**Steps**:
1. Run the commit; assert transport factory and bundle builder were never invoked.
2. Replace the content with clean material as the control.

**Expected Outcome**:
- The STOP returns `commit.safety.secret-suspected` before any transport is selected or bundle is constructed; construction/bundle counters are zero and no harness temp context exists.
- The control constructs exactly one transport and builds exactly one bundle after the scan completes.

#### TC-SAFETY-001 - Untracked stray outside declared scope never staged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DEC-15
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-safety.test.ts`
**Tags**: @backend, @git, @security

**Preconditions**:
- Plan declares scope for the target phase; one in-scope tracked modification; one untracked `stray.txt` outside any declared scope.

**Steps**:
1. Run the commit; inspect the envelope, the index, and the commit contents.

**Expected Outcome**:
- The stray is absent from `git diff --cached --name-only` and from the commit.
- `data.excluded.untrackedNotStaged` names `stray.txt`; `git status --porcelain` still shows `?? stray.txt` after the commit.
- The in-scope change lands; the stray is disclosed, never silently dropped.

#### TC-SAFETY-002 - Untracked file inside declared scope is staged

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DEC-15
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-safety.test.ts`
**Tags**: @backend, @git

**Preconditions**:
- Plan declares `src/new-file.ts`; the file is untracked and exists.

**Steps**:
1. Run the commit; inspect the index and commit.

**Expected Outcome**:
- The in-scope untracked file is staged and committed; it is not listed in `excluded.untrackedNotStaged`.
- An untracked file in the same directory but outside the declared path remains unstaged.

#### TC-SAFETY-003 - Tracked work outside declared scope staged with drift disclosure

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DEC-15
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-safety.test.ts`
**Tags**: @backend, @git

**Preconditions**:
- Plan declares `src/**`; a tracked file under `docs/` is modified; a tracked file under `src/` is modified.

**Steps**:
1. Run the commit; inspect the index, commit, and evidence.

**Expected Outcome**:
- Both tracked modifications are staged (tracked work is never silently dropped).
- The `docs/` path is disclosed as scope drift in evidence (observable via the plan diff surface); the commit lands.
- The untracked-outside-scope rule still applies to untracked files in the same scenario.

#### TC-SAFETY-004 - Secret-suspicious content STOPs with no leak

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-4, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-safety.test.ts`
**Tags**: @backend, @security

**Preconditions**:
- A candidate file containing a committed secret-corpus pattern; baseline status/HEAD/ledger captured; envelope captured with redaction enabled.

**Steps**:
1. Run the commit.
2. Assert no portion of the secret value appears in stdout, stderr, envelope, or telemetry.

**Expected Outcome**:
- Exit 1 with `commit.safety.secret-suspected`, category `user`, retryable `false`, consequence `not_landed`.
- Nothing staged, no commit, no ledger record, no telemetry; status and HEAD unchanged.
- The finding class is named without the material; the value (or any prefix/suffix long enough to identify it) is absent from all outputs.

#### TC-SAFETY-005 - Secret-suspicious filename STOPs without leaking material

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-safety.test.ts`
**Tags**: @backend, @security

**Preconditions**:
- A non-secret-content file whose filename matches a secret-file pattern (e.g. `id_rsa`, `.env.production`).

**Steps**:
1. Run the commit; inspect the failure and outputs.

**Expected Outcome**:
- Same STOP identity/exit/durable state as TC-SAFETY-004.
- The finding reports the filename class, not file content; no content is echoed.

#### TC-SAFETY-006 - Forbidden paths excluded and disclosed; valid work still commits

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-safety.test.ts`
**Tags**: @backend, @git

**Preconditions**:
- Tracked modifications under `tmp/` and `.ai/local/`, plus a valid in-scope source change.

**Steps**:
1. Run the commit; inspect the index, commit, and `excluded` disclosure.

**Expected Outcome**:
- Forbidden paths are absent from the index/commit and disclosed with a forbidden-path class.
- The valid change lands; exit 0; no failure identity is raised for an exclusion.
- Removing the valid change leaves only forbidden paths (then TC-SAFETY-008 applies).

#### TC-SAFETY-007 - Oversized binary excluded and disclosed

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-safety.test.ts`
**Tags**: @backend, @git

**Preconditions**:
- An oversized binary inside declared scope; a valid text change.

**Steps**:
1. Run the commit; inspect the index, commit, and disclosure.

**Expected Outcome**:
- The binary is never staged; it is disclosed with a binary-size exclusion class.
- The text change lands; exit 0; the disclosure is machine-readable.

#### TC-SAFETY-008 - Exclusion emptying the set refuses as staging-blocked

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DM-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-safety.test.ts`
**Tags**: @backend, @git

**Preconditions**:
- The only pending material is a forbidden path or an oversized binary (or a stray); clean baseline captured.

**Steps**:
1. Run the commit.
2. Add a valid in-scope change and re-run as the control.

**Expected Outcome**:
- Exit 1 with `commit.staging-blocked-untracked`, category `user`, retryable `false`, consequence `not_landed`; exclusions disclosed.
- Nothing staged, no commit, no ledger, no telemetry; the control lands normally.

#### TC-SAFETY-009 - Safety pass unavailable fails closed with exit 2

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-4, DM-4, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-safety.test.ts`
**Tags**: @backend, @security

**Preconditions**:
- Safety scanner factory throws / reports unavailable; dirty tree; baseline captured.

**Steps**:
1. Run the commit.
2. Restore the scanner and re-run as the control.

**Expected Outcome**:
- Exit 2 with `commit.safety.scan-unavailable`, category `platform`, retryable `true`, consequence `not_landed`.
- Nothing staged or committed; no transport constructed; no ledger/telemetry writes.
- The control lands normally.

#### TC-SAFETY-010 - Safety runs before anything is staged (index untouched)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-safety.test.ts`
**Tags**: @backend, @git

**Preconditions**:
- A scanner fake records `git diff --cached --name-only` at call time; dirty tree with a secret-suspicious candidate.

**Steps**:
1. Run the commit; assert the recorded index at scan time and after the STOP.

**Expected Outcome**:
- The scanner is invoked exactly once, before any `git add`; the index is empty at scan time and remains empty after the STOP.
- No commit object is created; the ordering is proven by the recorded index snapshot, not by call order alone.

#### TC-ATOMIC-001 - SC-M1-12: atomic default lands record and commit, stray unstaged

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-5, G-2, AC-F6-1, EVT-1
**Test Type(s)**: Integration, Contract, E2E
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-atomic.test.ts`
**Tags**: @backend, @git, @seeded

**Inherited seeded scenario (verbatim, SC-M1-12)**:

> Given: GH-310 phase delivery has pending work; one untracked stray file exists.
> When: `<binary> phase complete GH-310 delivery`
> Then: ledger transition recorded AND conventional commit landed (both or neither); stray file unstaged. `--no-commit` records the transition alone.
> Assert: ledger shows delivery complete; one commit with computed subject; stray file still untracked in git status; with `--no-commit`, no commit object is created.

**Preconditions**:
- Temporary git repo with change `GH-310`, pm-notes `delivery` open, plan declaring the delivery phase scope, one tracked in-scope pending change, and one untracked `stray.txt` outside any declared scope.
- Real state store in a temp root; injected clock, brand, state identity.

**Steps**:
1. Run `phase complete GH-310 delivery`.
2. Read the verified ledger, the pm-notes document, `git log`, `git show --stat`, and `git status --porcelain`.

**Expected Outcome**:
- Exit 0; the verified ledger contains exactly one new `phase.transition` record with phase `delivery`, operation `complete`, and durable `commitIntent: atomic` (no basis); pm-notes shows delivery completed.
- Exactly one new commit exists; its subject is the computed conventional message (`<type>(GH-310): …`, ≤ 72); its paths are exactly the computed staging set.
- `stray.txt` is still `??` in `git status` and absent from the commit.
- Envelope data carries `phase`, `state: completed`, `atomic: true`, `commitSha === HEAD`; one telemetry event exists for that SHA.
- Both-or-neither is additionally proven by TC-ATOMIC-005: with an injected fault, neither side remains.

#### TC-ATOMIC-002 - SC-M1-12: `--no-commit` records the transition alone

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, G-2, AC-F6-2, AC-F7-4, DEC-7
**Test Type(s)**: Integration, Contract, E2E
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-atomic.test.ts`
**Tags**: @backend, @git, @seeded

**Preconditions**:
- The same SC-M1-12 tree as TC-ATOMIC-001, restored to its pre-run state.
- A ledger-write recorder (or line-count probe) proving append count, and a tree that becomes dirty after the opt-out completion.

**Steps**:
1. Capture `git rev-parse HEAD`, `git rev-list --count HEAD`, and the ledger baseline.
2. Run `phase complete GH-310 delivery --no-commit`; decode the new record payload.
3. Make the tree dirty with pending work, then re-run `phase complete GH-310 delivery`; capture the envelope and durable deltas.

**Expected Outcome**:
- First run: exit 0; exactly one ledger line is appended; that same payload carries `commitIntent: record-only` and `commitIntentBasis: opt-out-flag` (no second intent write); pm-notes shows delivery completed.
- HEAD, commit count, and tree are unchanged; no commit object; no telemetry; envelope discloses `commitSkipped: opt-out-flag`; `stray.txt` remains untracked.
- Re-run: exit 0 with an intentional no-op convergence citing the stored basis — zero new ledger records, no commit object created despite the dirty tree, and the envelope discloses `commitSkipped: opt-out-flag` (the stored durable basis, not `no-op`; AC-F7-4).
- The discrimination is read from the record's stored intent, never guessed from the current tree mode.

#### TC-ATOMIC-003 - No stageable pending work → transition alone, disclosed basis

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3, AC-F7-4, DEC-8, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-atomic.test.ts`
**Tags**: @backend, @git

**Preconditions**:
- Open phase, plan present, clean tree (or only excluded/stray material); HEAD baseline recorded.

**Steps**:
1. Run `phase complete`; inspect the envelope, ledger payload, and HEAD.
2. Re-run `phase complete` as the convergence control.

**Expected Outcome**:
- Exit 0; exactly one transition record line carrying `commitIntent: record-only` and `commitIntentBasis: skipped-no-pending-work`; no commit object (HEAD unchanged); no telemetry.
- Envelope discloses `commitSkipped: skipped-no-pending-work`; no empty commit is created.
- No transport is constructed and zero model calls occur.
- Re-run is an intentional no-op convergence citing the stored basis: zero new records, no commit, same disclosure.

#### TC-ATOMIC-004 - Configuration disable → transition alone with origin basis

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-4, AC-F7-4, DEC-13, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-atomic.test.ts`; config fixtures
**Tags**: @backend, @config

**Preconditions**:
- Project config source sets `commit.phaseCommit: false`; open phase with pending work.
- Two controls: config `true` with no flag; config `true` with `--no-commit`.

**Steps**:
1. Run `phase complete` with the config disabled (no flag); decode the record payload.
2. Re-run with the config still disabled to exercise AC-F7-4.
3. Run the controls.

**Expected Outcome**:
- Disabled: exit 0, exactly one record carrying `commitIntent: record-only` / `commitIntentBasis: config-disabled`, no commit, no telemetry, envelope `commitSkipped: config-disabled`, and evidence reports the configuration origin (layer/source).
- Re-run: intentional no-op citing `config-disabled`; zero new record, no commit.
- `true` + no flag: atomic commit lands with record intent `atomic`.
- `true` + `--no-commit`: transition alone with basis `opt-out-flag`.
- No per-call flag force-commits over an explicit project disable (DEC-13).

#### TC-ATOMIC-005 - Clean abort restores neither side; exit 2; re-run converges

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F6-5, DM-4, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-atomic.test.ts`; fault-injecting state/git ports
**Tags**: @backend, @git, @faults

**Preconditions**:
- Open phase with pending work; baseline HEAD/ledger captured.
- Fault A: commit-object creation fails after staging. Fault B: ledger append fails after the commit object exists.

**Steps**:
1. Arm Fault A and run `phase complete`; inspect both durable sides.
2. Disarm, restore the tree to the same start, arm Fault B, and run.
3. Disarm and re-run normally.

**Expected Outcome**:
- Each fault exits 2 with `commit.atomic-abort`, category `platform`, retryable `true`, consequence `not_landed`.
- Fault A: no ledger record, no commit object.
- Fault B: no ledger record and the primitive's own commit object is removed (HEAD returned to baseline); working tree restored to the pre-run pending state.
- The final re-run lands exactly one record and one commit; no duplicate record and no empty commit.

#### TC-ATOMIC-006 - Matrix row 1: open → complete lands one record and one commit

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F6-1, AC-F7-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-idempotency.test.ts` (update), `phase-support.ts`
**Tags**: @backend, @git

**Preconditions**:
- Open phase with stageable pending work; existing phase fixture harness extended with a real temp repo.

**Steps**:
1. Run `complete`; assert the three-way contract plus the commit dimension.

**Expected Outcome**:
- Exit 0; ledger delta exactly +1; the record carries `commitIntent: atomic`; document entry completed; HEAD advanced by exactly one commit; one telemetry event; subject computed.
- No advisory is lost; the existing evidence fields keep their meaning.

#### TC-ATOMIC-007 - Matrix row 3: reopened → complete lands a new record and commit

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, F-7, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-idempotency.test.ts` (update)
**Tags**: @backend, @git

**Preconditions**:
- Phase completed once (record + commit), then reopened with a reason; new pending work exists.

**Steps**:
1. Re-complete the phase; inspect the ledger and log.

**Expected Outcome**:
- Exactly one new transition record (total 2) carrying `commitIntent: atomic`; exactly one new commit; the new commit contains only the new pending work (no empty commit).
- One new telemetry event; the earlier event is unchanged.

#### TC-ATOMIC-008 - Reopen path unchanged: no commit object

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F6-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-transitions.test.ts` (update)
**Tags**: @backend, @git

**Preconditions**:
- Completed phase; dirty tree (reopen must not commit it).

**Steps**:
1. Run `phase reopen GH-310 delivery "reason"`.
2. Inspect ledger, HEAD, telemetry, and evidence.

**Expected Outcome**:
- Exit 0; one new record with the exact reopen reason; HEAD unchanged; no commit object; no telemetry.
- Reopen semantics, advisory vocabulary, and projection fold are unchanged from the phase feature.

#### TC-ATOMIC-009 - Matrix row 2: no-op appends no record and creates no commit

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-3, AC-F8-1, DEC-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-idempotency.test.ts` (update)
**Tags**: @backend, @git

**Preconditions**:
- Phase completed with both record and commit landed; a dirty tree exists (to prove no commit is manufactured).

**Steps**:
1. Run `phase complete` again; capture the three-way delta and transport construction.

**Expected Outcome**:
- Exit 0; `outcome: no-op`, basis `already-completed`, citing the existing completion timestamp/commit; zero ledger records, zero commits, zero telemetry.
- No transport or safety port is constructed; document bytes unchanged.

#### TC-ATOMIC-010 - Atomic landing appends exactly one transition record

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-atomic.test.ts`
**Tags**: @backend, @git

**Preconditions**:
- Open phase with pending work; an injectable failure after the record write but before returning success (to exercise retry/rollback handling).

**Steps**:
1. Run the atomic completion; assert ledger line delta and key uniqueness.
2. Compare the derived projection with the ledger fold.

**Expected Outcome**:
- Exactly one record with one key; no duplicated history entry; the record payload carries `commitIntent: atomic` (no basis) in that same append; projection equals the pure fold of the verified records.
- Exactly one commit and one telemetry event; a second invocation is a row-2 no-op.

#### TC-ATOMIC-011 - Session-context refusal on `phase complete`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-3, DM-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-session-guard.test.ts`
**Tags**: @backend, @security

**Preconditions**:
- Session facts present at the edge; open phase with pending work; baseline captured.

**Steps**:
1. Run `phase complete GH-310 delivery` (with and without `--no-commit`).
2. Remove session facts and run the control.

**Expected Outcome**:
- Both invocations exit 1 with `commit.session.context-refused`; nothing staged/committed; no record; no telemetry; status/HEAD/ledger unchanged.
- The control completes normally.

#### TC-ATOMIC-012 - Commit intent lands in the record's own ledger append (no second write)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F6-1, AC-F6-2, AC-F6-3, AC-F6-4, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-atomic.test.ts`
**Tags**: @backend, @git, @intent

**Preconditions**:
- Four completion modes over equivalent trees: atomic (default), `--no-commit`, config-disabled, no-pending-work.
- A ledger-write recorder that fails on a second append, plus line-count and payload inspection.

**Steps**:
1. Run each mode; decode the single appended record and record the ledger line delta.
2. Assert the envelope `commitSkipped` value (when present) equals the durable `commitIntentBasis` string.
3. Negative control: arm the second-append failure and observe that the landing path never requests it.

**Expected Outcome**:
- Every mode appends exactly **one** ledger line; the same payload carries `commitIntent` and, when record-only, `commitIntentBasis`; no separate intent record/append/key exists.
- Atomic completions carry `commitIntent: atomic` with no basis; record-only completions carry exactly one of `opt-out-flag`, `config-disabled`, `skipped-no-pending-work`.
- The durable basis and the envelope `commitSkipped` vocabulary are identical strings (no drift); `no-op` is envelope-only and never written to a record.
- The second-append control shows the invariant is non-vacuous (a two-line delta would fail the assertion).

#### TC-CONVERGE-001 - Record only with intent `atomic` → complete the missing commit, no new record

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DEC-7, EVT-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-convergence.test.ts`
**Tags**: @backend, @git, @convergence

**Preconditions**:
- Durable state: one `phase.transition` completion record exists carrying `commitIntent: atomic`; no commit for it; no telemetry; phase work is dirty with stageable pending work. Constructed by direct state append (simulated hard interruption).

**Steps**:
1. Run `phase complete GH-310 delivery`.
2. Re-run once more.

**Expected Outcome**:
- The re-run reads the stored intent `atomic`, classifies the state as an interrupted atomic completion, and exits 0.
- Exactly one commit lands for the phase's pending work; ledger record count stays 1 (no new record); telemetry gets one event for the new commit carrying the transition identity.
- Reconciliation evidence discloses the completed commit side; the second run is a stable row-2 no-op (no record, no commit, no telemetry).
- No `record-only` path is taken and the stored `atomic` intent is not overwritten.

#### TC-CONVERGE-002 - Commit only → append the transition, no re-commit

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-convergence.test.ts`
**Tags**: @backend, @git, @convergence

**Preconditions**:
- Durable state: one commit exists with its telemetry event; no `phase.transition` record; tree clean relative to that commit.

**Steps**:
1. Capture HEAD and commit count.
2. Run `phase complete GH-310 delivery`.

**Expected Outcome**:
- Exit 0; exactly one transition record is appended via the existing write path, carrying `commitIntent: atomic` (the commit landed as an atomic completion); HEAD and commit count unchanged (no re-commit, no empty commit).
- Reconciliation evidence names the completed transition side; telemetry count stays 1 (no duplicate event).

#### TC-CONVERGE-003 - Both landed → no-op citing the existing completion

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-3, DEC-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-convergence.test.ts`
**Tags**: @backend, @convergence

**Preconditions**:
- Record and commit both landed; telemetry exists; dirty tree exists as a trap.

**Steps**:
1. Run `phase complete`; capture all deltas.

**Expected Outcome**:
- Exit 0; no-op evidence cites the existing completion (timestamp/commit SHA); zero new records, zero commits, zero telemetry; transport/safety ports untouched.
- The stored intent is `atomic` (both sides landed); `commitSkipped` is `no-op` (envelope-only) and no durable record is appended.

#### TC-CONVERGE-004 - Neither landed → normal atomic path

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F6-5, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-convergence.test.ts`
**Tags**: @backend, @git

**Preconditions**:
- No record, no commit, no telemetry; open/reopened phase with pending work (the state after a clean abort).

**Steps**:
1. Run `phase complete`.

**Expected Outcome**:
- The normal atomic path runs: one record and one commit land, one telemetry event; behavior matches TC-ATOMIC-001/006.
- No reconciliation evidence is claimed (there was no single side to reconcile).

#### TC-CONVERGE-005 - Convergence is total over the four durable states

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1..4, NFR-6, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-convergence.test.ts`
**Tags**: @backend, @convergence

**Preconditions**:
- A table-driven corpus: `(record landed?, commit landed?)` × durable intent (`atomic` | `record-only` × three bases) × matrix rows 1/2/3 × pending-work present/absent, using real temp repos and a temp state root.

**Steps**:
1. For each constructed state, run `phase complete` and assert the invariant set.
2. Re-run once to prove stability.

**Expected Outcome**:
- Every state reaches a stable final state where record count ≤ 1 per completion and commit count matches the intended landing; no empty commit; no duplicate record; telemetry exactly one per landed commit.
- Record-only states never manufacture a commit regardless of the current tree; atomic-intent single-side states converge to the missing commit.
- The second run is a no-op in every case; no case panics or silently drops a side.

#### TC-CONVERGE-006 - Record only with no pending work: no empty commit

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-7, AC-F7-4, AC-F6-3, DEC-8, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-convergence.test.ts`
**Tags**: @backend, @convergence

**Preconditions**:
- Record landed with `commitIntent: record-only` / `commitIntentBasis: skipped-no-pending-work`; commit missing; the phase's pending work is empty/fully excluded (then made dirty as a trap).

**Steps**:
1. Run `phase complete`; capture the envelope and durable deltas.

**Expected Outcome**:
- Exit 0 with an intentional no-op convergence citing the stored basis `skipped-no-pending-work`; no empty commit is created; record count unchanged.
- Envelope discloses `commitSkipped: skipped-no-pending-work` (the stored durable basis); no telemetry for a non-landed commit; the dirty tree does not trigger a commit.
- The scenario is fully specified by AC-F7-4 (OQ-T2 resolved); no evidence-shape assumption remains.

#### TC-CONVERGE-007 - Intentional record-only re-runs converge to no-op across all three bases

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-4, AC-F6-2, AC-F6-3, AC-F6-4, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-convergence.test.ts`
**Tags**: @backend, @git, @convergence

**Preconditions**:
- Three parametrized cases over equivalent trees, each completed once so the durable record carries intent `record-only`:
  - **Case A — `opt-out-flag`**: completed with `phase complete <ref> <phase> --no-commit`.
  - **Case B — `config-disabled`**: completed with `commit.phaseCommit: false` and no flag.
  - **Case C — `skipped-no-pending-work`**: completed with no stageable pending work.
- After each completion, the tree is made dirty with new stageable pending work (trap), and HEAD/commit count/ledger baseline are captured.
- Case D (control): a record with `commitIntent: atomic` and no commit, built directly, proves the two paths are distinguished (cross-checked by TC-CONVERGE-008).

**Steps**:
1. For each case, decode the landing record and assert the durable intent/basis pair.
2. Run `phase complete` again; capture envelope, ledger delta, HEAD, commit count, and telemetry count.
3. Repeat the re-run once more to prove stability.
4. Assert Case D converges to a commit (not a no-op), while A–C do not.

**Expected Outcome**:
- Landing: each record carries `commitIntent: record-only` plus exactly one of `commitIntentBasis: opt-out-flag` / `config-disabled` / `skipped-no-pending-work`, in the same ledger append; the envelope's `commitSkipped` equals that basis; no commit object is created.
- Given re-run: exit 0 with an intentional no-op convergence; **zero** new ledger records, **no** commit object created despite the dirty tree, no telemetry; the stored basis is disclosed in the envelope (`commitSkipped` equal to the stored `commitIntentBasis`).
- A second re-run is identical (stability); the discrimination uses the record's stored intent alone, never the current tree or an unverified byte.
- Case D lands exactly one commit and appends no record — proving the `record-only` no-op path is not a default/guess (AC-F7-1 vs AC-F7-4).

#### TC-CONVERGE-008 - Intent discrimination is evidence-driven, not mode-guessing

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, AC-F7-4, DEC-7, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-convergence.test.ts`
**Tags**: @backend, @git, @convergence

**Preconditions**:
- Two states that are otherwise identical (same change, same phase, same dirty pending work, same commit absence):
  - **State A**: the transition record carries `commitIntent: atomic`.
  - **State B**: the transition record carries `commitIntent: record-only` / `commitIntentBasis: opt-out-flag`.
- A third state **State C**: `commitIntent: atomic` with the commit already present (both landed) as a control.
- The projection/derived document is present and deliberately stale/contradictory as a non-authoritative decoy.

**Steps**:
1. Run `phase complete` against State A; assert a commit is completed and no record is appended.
2. Run `phase complete` against State B; assert intentional no-op, no commit, stored basis disclosed.
3. Run against State C; assert row-2 no-op.
4. Repeat both A and B with the current working mode flipped (flag/config) to prove the invocation mode does not drive the outcome.

**Expected Outcome**:
- A: exactly one new commit, ledger record count unchanged, reconciliation evidence names the completed commit; the stored `atomic` intent is read from the verified record.
- B: zero new records, zero commits, zero telemetry, `commitSkipped: opt-out-flag` from the stored basis; the dirty tree does not cause a commit.
- C: row-2 no-op (no record, no commit); `commitSkipped: no-op` is envelope-only.
- The outcome is identical when the invocation mode is flipped, proving the discrimination is evidence-driven (record intent), not mode-guessing; the stale projection is never consulted.
- State A is never treated as `record-only` merely because a commit is absent; the stored `atomic` marker forces the convergence path.
- Negative control (the other direction): State B is not treated as `atomic` merely because the phase is completed and a commit is missing; only the stored `record-only` intent prevents the commit.

#### TC-TELEM-001 - Exactly one telemetry event per landed commit with all DM-1 fields

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, EVT-1, DM-1, AC-F8-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-telemetry.test.ts`
**Tags**: @backend, @telemetry

**Preconditions**:
- Cases: standalone commit, atomic `phase complete`, converged atomic-interruption re-run; each lands exactly one commit.

**Steps**:
1. Run each case; read the state ledger through the verified port.
2. Decode the `commit.telemetry` payload.

**Expected Outcome**:
- Exactly one event per landed commit (count equals landed commits); payload schema id `delivery.commit.telemetry.v1` and record kind `commit.telemetry`.
- Fields: change ref, phase (when phase-centric), commit SHA (equals HEAD at landing), message source, transport, token spend (input/output; zero on template), landed-at from the injected clock, and transition identity for atomic completions.
- Verified reads return the record; no projection document is required.

#### TC-TELEM-002 - Emission failure disclosed without failing the commit

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DEC-9, §10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-telemetry.test.ts`
**Tags**: @backend, @telemetry

**Preconditions**:
- State port injects a failure on the telemetry append only; the commit itself can land.

**Steps**:
1. Run the commit.
2. Inspect the envelope, commit, and state ledger.

**Expected Outcome**:
- The commit lands and the invocation exits 0; the envelope's evidence/diagnostics disclose the emission failure without an error envelope.
- No rollback of the commit, no `commit.*` failure identity for emission; the failure is non-gating.
- The disclosure contains no secret material; exactly one emission attempt is recorded.

#### TC-TELEM-003 - No event on refusal, abort, no-op, or no-pending-work

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, AC-F7-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-telemetry.test.ts`
**Tags**: @backend, @telemetry

**Preconditions**:
- Baseline telemetry count; cases: session refusal, secret STOP, staging-blocked, scan-unavailable, atomic abort, row-2 no-op, no-pending-work transition, template fallback (positive control).

**Steps**:
1. Run each case; count telemetry records after each.

**Expected Outcome**:
- Every non-landed outcome emits zero events.
- The template fallback emits exactly one event (it is a landed commit); this proves the assertion is not vacuous.

#### TC-TELEM-004 - Telemetry payload is metadata-only and schema-valid

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, DM-1, AC-F8-1, §20
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-telemetry.test.ts`; structure schema test
**Tags**: @backend, @telemetry, @privacy

**Preconditions**:
- A landed commit with a distinctive subject/body and diff content; serialized telemetry captured.

**Steps**:
1. Serialize the telemetry payload and compare its key set to the schema allowlist.
2. Search for the subject, body, file content markers, and seeded secret corpus values.

**Expected Outcome**:
- The payload contains only metadata keys; no message body, diff content, file content, or secret material.
- Required keys are present with the right types; the state layer's verified read validates it; the redaction chokepoint is applied.
- An invalid payload (missing SHA or wrong token shape) is rejected by the payload schema test, proving non-vacuity.

#### TC-ENV-001 - Success envelopes match DM-2/DM-3 and the contract

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-NFR9-1, DM-2, DM-3
**Test Type(s)**: Contract, E2E
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/commit-envelope.test.ts`; `tests/fixtures/envelope/golden/commit-*.json`
**Tags**: @backend, @golden

**Preconditions**:
- Golden cases: `commit` success, `commit --dry-run`, `phase complete` atomic, `phase complete` skipped, template fallback.
- Synthetic brand, injected clock/runId, normalized paths.

**Steps**:
1. Run each case and compare stdout bytes with the committed golden.
2. Validate with `assertEnvelopeContract`.

**Expected Outcome**:
- Every case emits exactly one valid envelope with the projected exit code; success data carries the DM-2/DM-3 fields (`subject`, `body?` only when produced, `stagedFiles`, `excluded`, `commitSha`, `messageSource`, `transport`, `atomic`, `ledgerTransition`, `dryRun`, `commitSkipped`).
- No absolute path, timestamp, product literal, or unstable ordering appears in the golden.
- Adding an expected field is a deliberate fixture update, never a blanket snapshot rewrite.

#### TC-ENV-002 - Six commit failures project exactly and validly

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-4, AC-NFR9-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/commit-envelope.test.ts`, `tests/behaviour/commit-*`
**Tags**: @backend, @golden

**Preconditions**:
- One trigger per code: staging-blocked, commitlint-failed, secret-suspected, scan-unavailable, atomic-abort, session-refused.

**Steps**:
1. Trigger each code; capture the envelope and exit code.
2. Validate each with the conformance validator and compare the error fields with the machine table.

**Expected Outcome**:
- `commit.staging-blocked-untracked` / `commit.commitlint-failed` / `commit.safety.secret-suspected` / `commit.session.context-refused` → exit 1, user, retryable false, not_landed, user-validation.
- `commit.safety.scan-unavailable` / `commit.atomic-abort` → exit 2, platform, retryable true, not_landed, platform-provider.
- Each outcome is exactly one envelope with `error` and no `data`; remediation/summary present.

#### TC-ENV-003 - Containment and broken invocation yield one valid envelope

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-NFR9-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/commit-envelope.test.ts`
**Tags**: @backend, @golden

**Preconditions**:
- Cases: missing ref, unknown flag, unknown command, and a handler that throws an unclassified error.

**Steps**:
1. Run each broken invocation with `--json`.
2. Validate the single output document.

**Expected Outcome**:
- Exactly one valid envelope per run; exit in `{0,1,2}`; unknown invocation → `fallback.invocation`, unclassified throw → `fallback.internal`.
- No stack trace, raw exception, or secret in the machine output; stdout contains exactly one JSON document.

#### TC-TABLE-005 - Machine table declares `commit` kind with six exact rows

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-4, DEC-10
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (update)
**Tags**: @backend, @contract

**Preconditions**:
- The updated `ERROR_TABLE` and `DOMAIN_KINDS`.

**Steps**:
1. Assert `DOMAIN_KINDS` includes `commit` and the filter of `ERROR_TABLE` by that kind.
2. Assert each row's category, retryable, consequence, projection class, and remediation.
3. Mutate one row in a temp copy (remove a field / change the consequence) as the control.

**Expected Outcome**:
- Exactly six rows with the spec's classifications; no `commit.model-unavailable-template-fallback` row.
- All codes match the shape `commit.<reason>.<detail>`; unknown-consequence allowlist is not widened.
- The mutation control fails the row-shape check, proving non-vacuity.

#### TC-TABLE-006 - Documented table and machine table stay in sync

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-4, §22
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (update); `scripts/checks/error-table-sync.ts`
**Tags**: @backend, @sync

**Preconditions**:
- Six rows added to both `packages/core/src/contracts/error-table.ts` and `doc/spec/features/feature-result-contract.md`; commit codes added to `tests/fixtures/result/code-corpora/true-positives.json`.

**Steps**:
1. Run `runSyncCheck({root})` and `bun run scripts/checks/error-table-sync.ts`.
2. Apply the existing mutation controls (remove a doc row, rename a table code) in a temp copy.

**Expected Outcome**:
- Live tree: zero failures, source-entry count equals documented-row count, and the six `commit` codes are classified by `classifyDomainKind`.
- Mutations fail in both directions; no silent extra/missing row.
- The check remains fail-closed and non-vacuous.

#### TC-TABLE-007 - Template fallback is success evidence, not a failure row

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: DM-4, DEC-10, AC-F4-2
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`; `tests/behaviour/commit-transport.test.ts`
**Tags**: @backend, @contract

**Preconditions**:
- The machine table and docs after the change; a template-fallback commit case.

**Steps**:
1. Search the table and docs for a template-fallback failure identity.
2. Run a template-fallback commit and validate the envelope.

**Expected Outcome**:
- No failure row exists for model unavailability/template fallback; the table stays total over failure classes.
- The template outcome is exit 0 with `messageSource: template` in data and telemetry; docs describe it as evidence.

#### TC-TIER-001 - New commit contracts are data-only and inventoried

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-5, §16
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/commit-contract.test.ts`; `tests/structure/inventory.json` (update)
**Tags**: @backend, @tier

**Preconditions**:
- New contracts files (skeleton types, staging-set types, telemetry payload schema, envelope data shapes, error rows) and any new executable constants.

**Steps**:
1. Parse the contracts directory; assert no runtime API imports and no ambient globals.
2. Assert `inventory.json` lists every new file and every executable export is allowlisted.
3. Mutation: insert `Date.now()` / `node:fs` into a temp copy and run the ambient guard.

**Expected Outcome**:
- Contracts contain no runtime behavior; the inventory matches the file set exactly; every executable export is explicitly allowed.
- The mutation is reported naming the file and symbol, proving the guard covers new files.

#### TC-TIER-002 - Domain purity: contracts-only imports, no ambient reads

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-5, ADR-0003
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/commit-imports.test.ts`; `tests/boundaries/**`; `scripts/checks/ambient-globals.ts`
**Tags**: @backend, @tier

**Preconditions**:
- New domain modules: skeleton, staging-set, validation rules, convergence delta classification, transport port.

**Steps**:
1. Assert each domain module imports only `./contracts`/intra-domain and no runtime, adapters, or CLI module.
2. Run `bun test tests/boundaries` and the ambient-globals check.
3. Mutation: add an adapters import to a domain module in a temp copy.

**Expected Outcome**:
- Zero boundary violations; no runtime API or ambient global in domain/contracts; the dependency-cruiser matrix is green.
- The mutation is reported, proving enforcement covers the new modules without a new allowlist edge.

#### TC-TIER-003 - Runtime only at adapters/CLI edges; entrypoints declared

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-5, ADR-0003
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/port-contract-inventory.test.ts` (update); `scripts/checks/workspace-entrypoints.ts`; `exports-parity`
**Tags**: @backend, @tier

**Preconditions**:
- New contracts exports; testkit `./commit` subpath; adapter git/io methods for staging, commit, scan.

**Steps**:
1. Update and run `tests/fixtures/ports/v1-contract-inventory.json`.
2. Run `workspace-entrypoints`, `exports-parity`, `subpaths`, and `depcruise packages`.
3. Assert runtime imports (`node:*`, `process`, child_process) occur only in adapters/CLI/state driver locations.

**Expected Outcome**:
- Every new cross-package edge is declared; no undeclared package-name import; testkit may import core/adapters only.
- Runtime use is confined to the documented edges; no new ambient global or singleton.
- The inventories are in sync; a missing declaration fails the check by name.

#### TC-REGRESS-004 - Phase family rows 4–9, grammar, and advisories unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F6-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-transitions.test.ts`, `phase-rejections.test.ts` (run/update)
**Tags**: @backend, @regression

**Preconditions**:
- Existing phase fixtures `tests/fixtures/phase/**`; no commit-side configuration.

**Steps**:
1. Run the existing matrix rows 4–9 scenarios with the new code.
2. Assert the same codes, evidence, advisory rules, and document edits.

**Expected Outcome**:
- Reopen with exact reason, row-5 no-op, grammar rejections before state inspection, earlier-open/outside-required-set advisories, and absent-phase entry creation are unchanged.
- No commit or telemetry is produced by any reopen/rejection path.

#### TC-REGRESS-005 - `phase list` projection and read path unchanged, no commit

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, §8.2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-registry.test.ts`, `phase-envelope.test.ts` (run/update)
**Tags**: @backend, @regression

**Preconditions**:
- A populated verified ledger; the derived projection document; dirty tree as a trap.

**Steps**:
1. Run `phase list` and compare data with the fold.
2. Assert transport/safety/git-write ports are not constructed.

**Expected Outcome**:
- `phase list` remains read-only; projection content is byte-stable across replays; no commit, no telemetry, no staging.
- Envelope shape and exit projection are unchanged.

#### TC-REGRESS-006 - Config catalog gains `commit` branch; provider branch unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-4, DEC-13, config layer
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-schema.test.ts`, `tests/checks/config-default-positions.test.ts` (update)
**Tags**: @backend, @config

**Preconditions**:
- Production catalog and shipped defaults after adding `commit.phaseCommit`.

**Steps**:
1. Assert the `commit` branch shape, boolean type, default `true`, and origin reporting.
2. Assert the `provider` branch and defaults are byte-identical to the previous artifact.
3. Supply an invalid value as the negative control.

**Expected Outcome**:
- `commit.phaseCommit` resolves from defaults when absent, from a file layer when set, and reports its origin.
- Provider behavior is unchanged; regenerated schema/position artifacts are deterministic.
- Invalid values fail `config.value.invalid` with the layer named.

#### TC-REGRESS-007 - Branding/privacy/doc gates stay green with the new docs

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-8, privacy guard, §22
**Test Type(s)**: Contract, Manual
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/forbidden-literals.test.ts`, `tests/checks/privacy-*.test.ts`, `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @privacy, @docs

**Preconditions**:
- New `doc/spec/features/feature-commit-primitive.md`, refined M1 pack pages, and the six documented rows.

**Steps**:
1. Register the new user-facing doc in `scripts/checks/forbidden-literals.registry.json` and run the scan.
2. Run the branding seam test, privacy literal suites, and the doc-distribution guard.
3. Manual link/traceability review of the new feature spec (per testing strategy content checks).

**Expected Outcome**:
- Forbidden-literal scan green; no unregistered user-facing doc; branding tests green; privacy guards green.
- The doc-distribution marker guard is unaffected (no marker required for `doc/spec/**`); the new spec passes link/path and YAML/frontmatter review.
- No hardcoded product/binary name appears in the new modules or docs.

#### TC-REGRESS-008 - Latency bounds on dry-run and template paths

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-3
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-performance.test.ts`
**Tags**: @backend, @perf

**Preconditions**:
- Real temp repo; fake transport returning instantly; injected clock; 20 samples after one warm-up.

**Steps**:
1. Measure p95 for `--dry-run` (bound ≤ 2 s), template-fallback commit (≤ 5 s), and model-transport commit with a fake 50 ms response (≤ 30 s).
2. Log median/p95 and the runtime versions.

**Expected Outcome**:
- Each p95 is below its bound on the reference environment; no network or sleep is used.
- If a shared CI environment needs a recorded relaxation, it is documented in §10 and never silently deleted.
- A deliberately slow fake transport (e.g. 100 s) fails the model bound, proving the measurement is live.

## 6. Environments and Test Data

### 6.1 Environments

- **Local dev and CI**: Bun (`.bun-version`), pnpm. `bun test` for the TypeScript workspace; `pnpm check` for the aggregate gate.
- **Git**: a local `git` ≥ 2.40 binary available on PATH. No remote, no network, no credentials.
- **Commitlint**: the repository's installed `commitlint` binary is used only by the adapter probe (GAP-4); behaviour tests use the injected port.
- **No other process**: only `git`, the commitlint probe, and the existing packed-surface probes spawn. No provider HTTP, no harness CLI.
- **Platforms**: Linux/macOS in CI; paths are POSIX-relative. Tests must not assume a global git config or a signing key.

### 6.2 Test Data

- **Real temp repositories** (`mkdtemp`) built per case with a seed commit and deterministic identities: branch/change folder variants, tracked/untracked/forbidden/oversized/secret trees, plan scope declarations, and commitlint configs (`conventional`, `forbidding-template`, `absent`).
- **Static fixtures** under `tests/fixtures/commit/`: commitlint configs, plan YAML phase declarations, secret corpus (reusing the existing privacy/secret fixtures), forbidden-path and binary-size cases, scripted transport responses, telemetry payloads, and envelope goldens.
- **State fixtures**: `tests/fixtures/state/harness.ts` for temp store roots, identities, deterministic clocks, and ledger inspection; transition records and telemetry events are constructed through the real state port.
- **Error corpora**: `tests/fixtures/result/code-corpora/**` gains the six commit codes; documented rows mirror the machine rows.
- **No secrets**: only synthetic patterns from committed corpora; the assertion is that they never appear in output or telemetry.

### 6.3 Isolation Strategy

- Every test creates its own `mkdtemp` git repo and state root; the live workspace and the real user state directory are never written.
- Git environment is sanitized: `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_SYSTEM=/dev/null`, `TZ=UTC`, `LC_ALL=C`, local `user.name`/`user.email`, `commit.gpgsign=false`, `core.hooksPath=/dev/null`, `init.defaultBranch=main`.
- Cleanup in `afterEach` removes temp repos and state roots (with force), including on failure.
- Fixtures are never named `*.test.ts`; goldens are normalized (no absolute paths, timestamps, product literals).
- Tests assert shapes/invariants, never a commit SHA literal or a moving base-branch diff.

## 7. Automation Plan and Implementation Mapping

| Test file / helper | TC IDs | Implementation status | Execution |
|--------------------|--------|-----------------------|-----------|
| `packages/testkit/src/commit/transport-fakes.ts` (new; `@delivery-os/testkit/commit`) | all transport/telemetry fakes | To Implement | `bun test` (via consumers) |
| `packages/testkit/src/commit/git-repo.ts` (new; temp repo + status/log/index helpers) | all git-backed cases | To Implement | `bun test` (via consumers) |
| `tests/fixtures/commit/harness.ts` (new; in-process CLI composition, injected clock/session/state) | all behaviour cases | To Implement | `bun test tests/behaviour` |
| `tests/fixtures/commit/**` (new fixtures) | all | To Implement | `bun test` |
| `tests/behaviour/commit-command.test.ts` (new) | TC-COMMIT-001, TC-COMMIT-002, TC-COMMIT-003, TC-COMMIT-005, TC-COMMIT-006, TC-MSG-004 | To Implement | `bun test tests/behaviour/commit-command.test.ts` |
| `tests/behaviour/commit-session-guard.test.ts` (new) | TC-COMMIT-004, TC-ATOMIC-011 | To Implement | `bun test tests/behaviour/commit-session-guard.test.ts` |
| `tests/behaviour/commit-message.test.ts` (new) | TC-MSG-001, TC-MSG-002, TC-MSG-003, TC-MSG-004, TC-MSG-005, TC-MSG-006, TC-MSG-007, TC-MSG-008, TC-MSG-009, TC-MSG-010 | To Implement | `bun test tests/behaviour/commit-message.test.ts` |
| `tests/behaviour/commit-transport.test.ts` (new) | TC-TRANSPORT-001, TC-TRANSPORT-002, TC-TRANSPORT-003, TC-TRANSPORT-004, TC-TRANSPORT-005, TC-TRANSPORT-006 | To Implement | `bun test tests/behaviour/commit-transport.test.ts` |
| `tests/behaviour/commit-safety.test.ts` (new) | TC-SAFETY-001, TC-SAFETY-002, TC-SAFETY-003, TC-SAFETY-004, TC-SAFETY-005, TC-SAFETY-006, TC-SAFETY-007, TC-SAFETY-008, TC-SAFETY-009, TC-SAFETY-010 | To Implement | `bun test tests/behaviour/commit-safety.test.ts` |
| `tests/behaviour/phase-atomic.test.ts` (new) | TC-ATOMIC-001, TC-ATOMIC-002, TC-ATOMIC-003, TC-ATOMIC-004, TC-ATOMIC-005, TC-ATOMIC-010, TC-ATOMIC-012 | To Implement | `bun test tests/behaviour/phase-atomic.test.ts` |
| `tests/behaviour/phase-idempotency.test.ts` (update) | TC-ATOMIC-006, TC-ATOMIC-007, TC-ATOMIC-009, TC-REGRESS-004 | Existing – Update | `bun test tests/behaviour/phase-idempotency.test.ts` |
| `tests/behaviour/phase-transitions.test.ts`, `phase-rejections.test.ts` (run/update) | TC-ATOMIC-008, TC-REGRESS-004 | Existing – Update | `bun test tests/behaviour/phase-transitions.test.ts tests/behaviour/phase-rejections.test.ts` |
| `tests/behaviour/phase-registry.test.ts`, `phase-envelope.test.ts` (run/update) | TC-REGRESS-005 | Existing – No Change / Update | `bun test tests/behaviour/phase-registry.test.ts tests/behaviour/phase-envelope.test.ts` |
| `tests/behaviour/commit-convergence.test.ts` (new) | TC-CONVERGE-001, TC-CONVERGE-002, TC-CONVERGE-003, TC-CONVERGE-004, TC-CONVERGE-005, TC-CONVERGE-006, TC-CONVERGE-007, TC-CONVERGE-008 | To Implement | `bun test tests/behaviour/commit-convergence.test.ts` |
| `tests/behaviour/commit-telemetry.test.ts` (new) | TC-TELEM-001, TC-TELEM-002, TC-TELEM-003, TC-TELEM-004 | To Implement | `bun test tests/behaviour/commit-telemetry.test.ts` |
| `tests/golden/commit-envelope.test.ts` (new) + `tests/fixtures/envelope/golden/commit-*.json` | TC-ENV-001, TC-ENV-002, TC-ENV-003 | To Implement | `bun test tests/golden/commit-envelope.test.ts` |
| `tests/structure/commit-contract.test.ts` (new) | TC-TIER-001 | To Implement | `bun test tests/structure/commit-contract.test.ts` |
| `tests/structure/commit-imports.test.ts` (new) | TC-TIER-002 | To Implement | `bun test tests/structure/commit-imports.test.ts`; `bun test tests/boundaries` |
| `tests/structure/inventory.json` (update) | TC-TIER-001 | Existing – Update | `bun test tests/structure/content-inventory.test.ts` |
| `tests/fixtures/ports/v1-contract-inventory.json` (update) | TC-TIER-003 | Existing – Update | `bun test tests/structure/port-contract-inventory.test.ts` |
| `tests/structure/error-table.test.ts` (update) | TC-TABLE-005, TC-TABLE-007 | Existing – Update | `bun test tests/structure/error-table.test.ts` |
| `tests/checks/error-table-sync.test.ts` (update) | TC-TABLE-006 | Existing – Update | `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` |
| `tests/fixtures/result/code-corpora/**` (update) | TC-TABLE-006 | Existing – Update | `bun test tests/structure/error-table.test.ts` |
| `tests/behaviour/config-schema.test.ts`, `tests/checks/config-default-positions.test.ts` (update) | TC-REGRESS-006 | Existing – Update | `bun test tests/behaviour/config-schema.test.ts tests/checks/config-default-positions.test.ts` |
| `tests/checks/forbidden-literals.test.ts` + `scripts/checks/forbidden-literals.registry.json` (update) | TC-REGRESS-007 | Existing – Update | `bun test tests/checks/forbidden-literals.test.ts`; `bun run scripts/checks/forbidden-literals.ts` |
| `tests/behaviour/commit-performance.test.ts` (new) | TC-REGRESS-008 | To Implement | `bun test tests/behaviour/commit-performance.test.ts` |
| Aggregate | all | — | `pnpm check` |

**Gate mapping**:

| Quality gate | Suites / commands | TC coverage |
|--------------|-------------------|-------------|
| Fast iteration | `bun test tests/behaviour/commit-*`, `bun test tests/behaviour/phase-*` | commit/safety/transport/atomic/convergence/telemetry, including durable-intent and intentional-no-op convergence |
| Structure gate | `bun test tests/structure`, `bun run scripts/checks/{ambient-globals,workspace-entrypoints}.ts` | TC-TIER-001..003, TC-TABLE-005/007 |
| Boundary gate | `pnpm check:boundaries` (`depcruise`, ambient globals, workspace entrypoints) | TC-TIER-002/003 |
| Contract/sync gate | `bun test tests/checks`, `bun run scripts/checks/error-table-sync.ts` | TC-TABLE-006, TC-REGRESS-006/007 |
| Golden gate | `bun test tests/golden` | TC-ENV-001..003 |
| Performance (advisory) | `bun test tests/behaviour/commit-performance.test.ts` | TC-REGRESS-008 |
| Aggregate (required) | `pnpm check` | all |
| CI | `.github/workflows/ci.yml` order: install → typecheck, lint, format, test, boundaries → build → exports/publint/attw → pins, publish guard, license, vulnerability, aggregate, commitlint | all |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Impact | Mitigation |
|----|--------------|--------|------------|
| TR-1 | Real git repos introduce flakes (global config, hooks, signing, default branch, line endings) | High | Sanitize git env in the harness (`GIT_CONFIG_GLOBAL/SYSTEM`, `core.hooksPath`, `commit.gpgsign`, `init.defaultBranch`), fixed identities, POSIX paths; assert shapes/counts, never SHA literals. |
| TR-2 | Commitlint version/binary differences make an adapter test environment-dependent | Medium | Behaviour suites use the injected port; only one adapter probe uses the installed binary, with committed configs and a loud failure if absent (GAP-4). |
| TR-3 | Accidentally reaching a real provider or harness | High | All transports fakes; no network clients constructed; TC-TRANSPORT-006 asserts zero construction on STOP; existing no-live-call checks remain. |
| TR-4 | Timing assertions flake in shared CI | Medium | 20 samples, p95 with generous spec bounds, median logged; recorded relaxations in §10 only. |
| TR-5 | Fault injection does not reproduce every real interruption window | Medium | Inject at the ledger-write and commit-object ports for clean aborts; construct single-side durable states directly for convergence; document that crash-window testing is out of scope (GAP-5). |
| TR-6 | Golden churn from envelope additions | Low | Add committed goldens deliberately; normalize paths/timestamps/brand; regenerate explicitly; review diffs. |
| TR-7 | Inventory/registry updates forgotten (new files, new contracts exports, new doc) | Medium | TC-TIER-001/003 and TC-REGRESS-007 fail by name when a new file/export/doc is unregistered. |
| TR-8 | Security assertion becomes vacuous (pattern not present, redaction disabled) | High | Use the committed secret corpus; assert the pattern matches in a control fixture; assert the material is absent from all outputs; TC-SAFETY-004/005 run with redaction on. |
| TR-9 | Envelope `commitSkipped` vocabulary drifts from the durable `commitIntentBasis` strings | Medium | TC-ATOMIC-012 asserts string equality between the record basis and the envelope value; TC-ENV-001 pins the DM-3 key/vocabulary; `no-op` is asserted to be envelope-only. |

### 8.2 Assumptions

- A plan artifact exists for declared-scope staging in phase-centric mode; when absent, the degraded scope source is disclosed (spec §12).
- Delivery-session facts are injectable at the runtime edge and mechanically detectable (DEC-6).
- Commitlint configuration is discoverable from the temp repo root; absent config degrades to deterministic checks.
- The harness one-shot can run in a temporary empty project context; its exact invocation mechanism is OQ-1 (delivery planning), faked at the port here.
- The provider engine reports availability facts (route, quota, park) to the seam; tests inject them.
- Real `git` is available; commits are local only; no network.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner / resolution |
|----|----------|-----------|--------------------|
| OQ-T3 | Does an unresolvable change ref need a dedicated `commit.*` identity, or does it reuse `input.value.rejected`? | No — TC-COMMIT-006 asserts only a classified failure and no mutation. | Delivery planning; add a row only with the documented sync if chosen. |
| OQ-T4 | What exactly marks a change "auditor-relevant" for the body-required rule? | No — TC-MSG-010 asserts a header-only success and a multi-area retry, not a precise threshold. | Delivery planning; record against F-3. |
| OQ-T5 | Is the harness one-shot a dedicated headless session mode or a CLI invocation? (spec OQ-1) | No — tests fake at the port; both satisfy the contract. | Delivery planning. |
| OQ-T6 | Exact residual DM-2/DM-3 field shapes (`ledgerTransition`, `excluded`, reconciliation evidence) beyond the pinned `commitSkipped` vocabulary. | No — TC-ENV-001 pins the contracted fields from the spec; refinements are recorded goldens. | Delivery planning against the pack pages. |

### 8.4 Resolved Questions Log

| ID | Question (as originally raised) | Resolution | Evidence / tests |
|----|----------------------------------|------------|------------------|
| OQ-T1 | Can a re-run distinguish an interrupted atomic completion from an intentional record-only completion (`--no-commit`, config-disabled, no-pending-work), so convergence never manufactures a commit for an opt-out? | **Resolved by spec amendment iter 2 (2026-11-05).** Every completion record durably carries `commitIntent` (`atomic` \| `record-only`) and, when record-only, `commitIntentBasis`, in the record's own ledger append (DEC-7). AC-F7-1 is narrowed to intent `atomic`; AC-F7-4 adds intentional no-op convergence for `record-only` citing the stored basis. Discrimination is from durable evidence alone, never mode-guessing or the stale projection. | TC-CONVERGE-007 (all three bases), TC-CONVERGE-008 (atomic vs record-only control), TC-ATOMIC-002 (opt-out landing + re-run), TC-ATOMIC-012 (same-append intent). |
| OQ-T2 | What is the `commitSkipped`/reconciliation evidence shape when a record-only convergence finds no pending work? | **Resolved by spec amendment iter 2.** The durable basis `skipped-no-pending-work` and AC-F7-4 define the intentional no-op; the envelope discloses the stored basis from the pinned DM-3 vocabulary. | TC-ATOMIC-003 (landing), TC-CONVERGE-006 (re-run no-op), TC-ATOMIC-012 (vocabulary equality). |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | test-plan-writer | Initial plan: 68 scenarios covering all 22 ACs, SC-M1-12 inherited verbatim, convergence matrix, safety ordering, transport seam, telemetry, error-table sync, tier purity, and phase-family regressions; OQ-T1 flagged as blocking. |
| 1.1 | 2026-11-05 | test-plan-writer | Amendment for spec iter 2 (reason: OQ-T1 resolution). Added durable commit-intent coverage (`commitIntent`/`commitIntentBasis`, same ledger append) via TC-ATOMIC-012; unblocked and fully specified TC-CONVERGE-007 (all three record-only bases) and the TC-ATOMIC-002 re-run assertion; added TC-CONVERGE-008 (atomic-vs-record-only evidence discrimination); added AC-F7-4 to the matrix (23 ACs, 70 scenarios); sharpened AC-F7-1 to atomic intent; moved OQ-T1/OQ-T2 to the resolved log; updated DM-3, NFR-6, index, automation mapping, and risks. No existing test case was renumbered. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Populated during delivery and quality gates. |
