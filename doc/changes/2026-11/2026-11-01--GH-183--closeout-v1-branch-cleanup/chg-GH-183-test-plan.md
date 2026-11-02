---
id: chg-GH-183-test-plan
status: Updated
version: 1.3
created: 2026-11-01T04:10:00Z
last_updated: 2026-11-01T10:30:00Z
owners: [engineering]
service: delivery-os closeout transaction
labels: [cli, providers, git, idempotency, state]
version_impact: minor
summary: "Verify M0-S14 closeout v1: one dry-run-by-default, deterministic seven-step transaction (ticket-to-done, lifecycle label sweep, unassign, owed-flip, comment resolution, checkout restore, squash-safe local branch cleanup) whose plan and apply agree byte-for-byte, whose deterministic operation identities and append-only outcome ledger make restart, crash-between-effect-and-record, and failed-outcome retries converge with zero duplicate effects, whose GitHub/Jira writes and GitLab gaps are declared honestly (with every newly supported write executing in mock conformance), whose target reads distinguish explicit not-found, malformed payload, and unavailable surfaces and whose owed-flip runs only on provider-asserted relation evidence, whose branch deletion is permitted only by the full squash-safety predicate (merged-head equality, protected refs, dirty/foreign worktree, ambiguity, unknown head), whose four closeout error identities stay bidirectionally synced and exit-projected only at the CLI edge, and which preserves the read-only zero-write/zero-spawn guarantees of status, queue ready, and verify change. The whole battery is offline: committed sanitized fixtures, injected transports, recording runtimes, temporary local git repositories, and zero live network or credentials."
links:
  change_spec: ./chg-GH-183-spec.md
  implementation_plan: ./chg-GH-183-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S14: closeout v1 with branch cleanup

## 1. Scope and Objectives

`closeout` is the first Deliver-family command that mutates a tracker, a pull-request review surface, a local checkout, and a local branch in one transaction. The tests must prove five things at once: **plan truth** (a deterministic, ordered seven-step plan with canonical operation arguments, identical between dry-run and apply), **convergence** (deterministic operation identities plus an append-only outcome ledger make a restart, a crash between effect and record, and a failed-outcome retry converge with zero duplicate effects), **provider honesty** (GitHub and Jira writes land against sanitized fixtures; every unsupported operation is a declared gap with a valid reason and can never be reported `applied` or `satisfied`), **destructive safety** (checkout restore and local branch deletion happen only under the full squash-safety predicate, with protected refs, dirty/foreign worktrees, ambiguity, and an unknown merged head all refusing with zero destructive action), and **regression protection** (`status`, `queue ready`, and `verify change` keep zero writes and zero process spawns and never import the git cleanup seam or the provider write path).

The plan is built on four binding mechanisms: an **injected provider and git runtime** that records every read and write against committed sanitized fixtures and temporary local repositories; an **injected clock, run id, and recording state port** so determinism and idempotency are asserted, not inferred; a **non-vacuity contract** in which every negative, gap, cap, absence, and refusal is paired with a live control and a deliberately broken mutant that must fail naming its case; and an **offline hermeticity proof** that no suite uses live network, real credentials, or host state. This is a design and verification map, not an execution claim: no builds, tests, or commands were run against the delivered state.

### 1.1 In Scope

- The `closeout <workItemRef> [--apply] [--json]` command surface: one canonical ref, dry-run default, `--apply` as the only mutation switch, `--json` as a rendering-only global, and grammar rejection before any source read (F-1, §8.1, AC-F1-1..AC-F1-3).
- The deterministic seven-step ordered plan and canonical operation expansion; label disposition order, dependents by provider entity identity, threads by thread identity; distinct operation identities (F-2, DM-1, DM-2, AC-F2-1..AC-F2-3).
- Deterministic operation identity derivation (the ADR-0003 inputs plus the additive `capabilityContext` refinement recorded in DEC-7) and terminal-outcome reuse through the additive `closeout.operation` ledger record; restart, crash-between-effect-and-record, and failed-outcome retry convergence (F-3, EVT-1, DM-4, DM-9, AC-F3-1..AC-F3-4, AC-NFR8-1).
- Ticket-to-done through the declared workflow transition, the discriminated target read (explicit not-found versus malformed payload versus unavailable read), already-done convergence, and the missing-mapping gap (F-4, DM-11, AC-F4-1..AC-F4-4).
- Lifecycle label sweep over the declared disposition table, absent-signal skip, idempotent re-run, and the Jira full-array label-replace preservation trap (F-5, DM-6, AC-F5-1..AC-F5-4).
- Explicit unassign that never infers "already unassigned" from absence, plus a capability gap and a re-run-satisfied path (F-6, DM-5, AC-F6-1..AC-F6-4).
- The bounded owed-flip sweep: eligible direct dependents, another open blocker, already-flipped, unknown blocker, provider-asserted versus unavailable/unknown relation signals (signal-level `skipped-noop` with evidence, never a flip), the provider-level missing-reverse-read gap, and the 200 cap with truncation and progress (F-7, DM-11, AC-F7-1..AC-F7-7).
- Review-thread resolution over the merged delivery request through the GitHub GraphQL fixture, already-resolved convergence, the no-surface gap, the no-request skip, and a write-failure retry (F-8, AC-F8-1..AC-F8-4).
- Checkout restore: delivery branch to resolved base, already-on-base, unrelated checkout, detached-at-delivery-head restore, and dirty/missing-base refusal (F-9, DM-7, AC-F9-1..AC-F9-5).
- Squash-safe local branch cleanup: merged-head equality, moved head, protected refs, foreign worktree, already-absent, ambiguity, unknown head, and the provider-failure interaction (F-10, DM-7, DM-8, AC-F10-1..AC-F10-8).
- Honest per-provider capability declarations and declared-gap handling for GitHub, Jira, and GitLab, including the additive `resolve-delivery-thread` operation and the conformance flow-registry obligation from TDR-0008 (F-11, DM-5, AC-F11-1..AC-F11-4).
- Merged-delivery-request lookup by source ref with deterministic highest-entity selection and the integration-base fallback (F-12, DM-8, AC-F12-1..AC-F12-3).
- Bounded machine and human output with no leaked content, plus the four `closeout` error identities, bidirectional documented sync, and CLI-only exit projection (F-13, F-14, DM-10, AC-F13-1, AC-F13-2, AC-F14-1, AC-F14-2).
- Read-only isolation of `status`, `queue ready`, and `verify change`, the dedicated git seam's exact runtime-confinement entry, and the byte-identical plan determinism (F-15, NFR-2, NFR-5, AC-F15-1).
- Offline proof, bounded transaction caps/timeouts, and zero new runtime dependencies (NFR-3, NFR-6, NFR-10, AC-NFR3-1, AC-NFR10-1).

### 1.2 Out of Scope & Known Gaps

- [OUT] Harness session telemetry capture (M1-S11, NG-1); closeout reads no session store.
- [OUT] Remote branch deletion, remote ref cleanup, force push, and history rewrite (NG-2); only a local branch is ever deleted.
- [OUT] GitLab writes and full GitLab closeout parity (NG-3); GitLab writes remain declared gaps.
- [OUT] The full GitHub adapter, full issue lifecycle, releases, and non-closeout operations (NG-4).
- [OUT] Merge execution or merge verification (NG-5); the plan consumes an already-merged delivery request.
- [OUT] Posting a closure comment or arbitrary tracker/PR comment writes (NG-6); `write-comment` stays a gap on every provider.
- [OUT] Cross-repository closeout, global state, or multi-repo fan-out (NG-7).
- [OUT] MCP/OpenCode/Harness closeout surfaces (NG-8), memory capsule work (NG-9), owner-gate SLA mechanics (NG-10), and queue/lane/dispatch/supervision behaviour (NG-11).
- [OUT] Behaviour changes to `status`, `queue ready`, or `verify change` (NG-12); their existing suites run unchanged as the regression half.
- [OUT] A live provider or a real remote git operation anywhere in the gate battery; no test resolves a host, opens a socket, reads a credential, or touches a network.
- [GAP-T1 — implementation-plan mapping is delivery-owned] `chg-GH-183-plan.md` is present (v1.0 at this revision) and is itself under DoR remediation. This plan binds behaviour, identities, assertions, exits, and AC mapping; delivery planning must map its phases/tasks onto these TCs and must not reshape them. Reopen this plan if a later plan changes a pinned behaviour.
- [GAP-T2 — reference-fixture p95 is not a CI latency gate] NFR-6 declares a p95 ≤ 120 s apply budget on the reference fixture. No shared CI runner is the reference host. CI asserts **bounded work** (fixed/invariant call counts, caps, declared timeouts, deterministic ordering); a recorded non-CI reference measurement is optional and never a pass gate. TC-CLOSE-063 states the exact split.
- [GAP-T3 — the no-leak canary is a fixture obligation] NFR-7/NFR-12 require no comment bodies, titles, raw payloads, credentials, or environment values in output or ledger evidence. The proof is a planted-canary control in committed sanitized fixtures; a fixture without the canary would make the assertion vacuous, so TC-CLOSE-059/TC-CLOSE-062 assert presence before absence.
- [GAP-T4 — delivery-bound spellings] Contract export names (beyond spec-pinned `headSha`, `resolve-delivery-thread`, the four error codes, the outcome vocabulary, and `delivery.closeout.v1`), internal helper names, fixture file names, golden file names, and the internal git-seam method names are delivery-bound. The semantics, identities, shapes, exits, and AC mapping are pinned here and may not be rebound.
- [GAP-T5 — no dedicated AC for NFR-6/NFR-12] The cap/timeout and security/privacy NFRs have no single AC of their own; §3.3 maps them to the ACs they qualify (AC-F7-5, AC-F8-1, AC-F13-1, AC-F13-2, AC-F10-1..AC-F10-8). Nothing is tested without an AC or NFR anchor.

## 2. References

- **Change specification**: [chg-GH-183-spec.md](./chg-GH-183-spec.md) — v1.3; F-1..F-15, AC-F1-1..AC-NFR10-1 (61), NFR-1..NFR-13, DM-1..DM-11, EVT-1/EVT-2, DEC-1..DEC-16, RSK-1..RSK-13, §6 flows 1–7, §8 interfaces, Appendix A (ordered plan), B (capability matrix), C (label disposition), D (error rows), E (traceability).
- **Decision record**: [TDR-0008-additive-adapter-contract-extensions-closeout-v1.md](../../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) — additive optional `DeliveryRequest.headSha` and additive `resolve-delivery-thread`; no schema-version bump; Jira/GitLab gaps; the conformance flow registry must gain a step in the same change. TDR-0008 owner acceptance is GH-183. ODR-0003 (command-name lock) is a separate decision whose owner acceptance is GH-186, not GH-183.
- **PM record**: [chg-GH-183-pm-notes.yaml](./chg-GH-183-pm-notes.yaml) — scope decisions 1–8, OQ-1 resolved by TDR-0008, OQ-2 (no closure comment), and the conformance-registry obligation.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries,golden,types}`, `scripts/checks/*.ts` mutation tests, the boundary fixture-coverage meta-check, `pnpm check` as the aggregate gate, permanent suites assert the current tree.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, injected time/randomness/environment, the error contract, fake-based deterministic tests, no moving-base diff assertions.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope, domain kinds, projection classes, documented error table, bidirectional sync, exit literals only in the CLI projection.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — append-only ledger, verified reads, key-set assertions, single-writer fences, torn/malformed classification, additive record kinds, `delivery.state.v1` no schema bump.
- **Adapter ports**: [feature-adapter-ports.md](../../../spec/features/feature-adapter-ports.md) — the closed operation set, capability/gap vocabulary, absence semantics, credential port, additive-within-v1 evolution.
- **Provider client seeds**: [feature-provider-client-seeds.md](../../../spec/features/feature-provider-client-seeds.md) — GitHub/Jira/GitLab read slices, trap catalogs, label-replace and transition traps, injected transports.
- **Read-only commands**: [feature-queue-ready.md](../../../spec/features/feature-queue-ready.md), [feature-verify-change-and-exit-taxonomy.md](../../../spec/features/feature-verify-change-and-exit-taxonomy.md), [feature-status-digest.md](../../../spec/features/feature-status-digest.md) — the zero-write/zero-spawn guarantees this change must not regress.
- **Architecture**: [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) (tiers, runtime confinement), [ADR-0004](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md)/[ADR-0006](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) (absence semantics), [ADR-0005](../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md) (provider-client confinement).
- **Command registry and backlog**: `doc/planning/oss-tooling/cli-command-registry.md` (`ados closeout`, M0-S14; ODR-0003 is the proposed command-name lock, with owner acceptance at GH-186, not GH-183), `doc/planning/oss-tooling/backlog.md` M0-S14.
- **Existing mechanisms reused (never re-implemented)**: `tests/fixtures/status/harness.ts` (runtime fake + envelope + human caps); `tests/golden/helpers.ts` (`SYNTHETIC_BRAND`, fixed run id/clock, buffer streams, mutant-module import) with `runCli` imported directly from `packages/cli/src/index.ts` (the helper module imports it and does not re-export it); `tests/fixtures/state/harness.ts` (temp store, injected edge, fence/fold helpers); `tests/behaviour/providers/support.ts` (`createFixtureTransport`, throwing fetch guard); `tests/behaviour/providers/trap-harness.ts`; `packages/testkit/src/conformance/coverage.ts` (`runtimeCoverageViolations`);
  `packages/testkit/src/result-conformance.ts` (`assertEnvelopeContract`); `tests/structure/{conformance-coverage,error-table,cli-edge-seam,port-neutrality,provider-surface,subpaths}.test.ts`; `tests/checks/{error-table-sync,fixture-sanitization,secret-read-boundary}.test.ts`; `scripts/checks/{error-table-sync,ambient-globals,secret-read-boundary,workspace-entrypoints,exit-code-literals,forbidden-literals,privacy-literals,license-audit,vulnerability-gate}.ts`.
- **Change precedents for shape**: [chg-GH-180-test-plan.md](../../2026-10/2026-10-31--GH-180--db-session-admin-port/chg-GH-180-test-plan.md), [chg-GH-189-test-plan.md](../../2026-10/2026-10-31--GH-189--adapter-conformance-suite/chg-GH-189-test-plan.md), [chg-GH-175-test-plan.md](../../2026-10/2026-10-31--GH-175--status-v1/chg-GH-175-test-plan.md).
- **Ticket**: GH-183 — M0-S14: closeout v1 with branch cleanup.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC | Criterion (abbreviated) | TC ID(s) | Status |
|----|--------------------------|----------|--------|
| AC-F1-1 | `closeout <ref>` without `--apply` returns a deterministic ordered plan and performs zero provider writes, git mutations, state appends, or fence acquisitions | TC-CLOSE-010 | Covered |
| AC-F1-2 | `closeout <ref> --apply` executes the same ordered plan and returns per-operation outcomes | TC-CLOSE-011 | Covered |
| AC-F1-3 | Malformed/missing ref or unknown flag fails as `input.value.rejected`/`fallback.invocation`, exit 1, no source read or mutation | TC-CLOSE-012 | Covered |
| AC-F2-1 | Identical observed state and arguments yield byte-identical steps, canonical arguments, and operation identities | TC-CLOSE-013, TC-CLOSE-014 | Covered |
| AC-F2-2 | Steps appear exactly in the seven declared steps in order | TC-CLOSE-001, TC-CLOSE-010, TC-CLOSE-011 | Covered |
| AC-F2-3 | Multi-operation steps expand deterministically with a distinct identity per operation | TC-CLOSE-014 | Covered |
| AC-F3-1 | A re-run in a fresh process after a completed apply reuses every terminal outcome with zero duplicate mutations and exits 0 | TC-CLOSE-015 | Covered |
| AC-F3-2 | A crash after a provider effect but before the append converges as `satisfied` with no duplicate effect | TC-CLOSE-016 | Covered |
| AC-F3-3 | A persisted `failed` outcome is retained as evidence, re-observed, and retried safely | TC-CLOSE-017, TC-CLOSE-040 | Covered |
| AC-F3-4 | Operation identity is stable for identical inputs and changes when any identity input changes, including the adapter capability context | TC-CLOSE-018 | Covered |
| AC-F4-1 | An open item with a supported done transition is transitioned to done and reports `applied` | TC-CLOSE-020 | Covered |
| AC-F4-2 | An already-done item reports `satisfied` with zero write in plan and apply | TC-CLOSE-021 | Covered |
| AC-F4-3 | No done transition or no adapter mapping is `skipped-gap` with a valid reason and does not fail the transaction | TC-CLOSE-022 | Covered |
| AC-F4-4 | Explicit provider not-found fails `closeout.target.unobserved` exit 1 with no write; malformed/unparsable payload is `provider.payload.invalid` and never remapped; no work-item read is a declared gap | TC-CLOSE-067 | Covered |
| AC-F5-1 | The sweep removes the six lifecycle labels, retains `change` and non-lifecycle labels, and adds `delivered` when absent | TC-CLOSE-023, TC-CLOSE-001 | Covered |
| AC-F5-2 | An already-swept set yields `satisfied` outcomes with zero write | TC-CLOSE-024 | Covered |
| AC-F5-3 | An absent label signal is `skipped-noop` with `label-signal-unavailable` and performs no blind rewrite | TC-CLOSE-025 | Covered |
| AC-F5-4 | Jira's full-array replace preserves every label not named for removal | TC-CLOSE-026 | Covered |
| AC-F6-1 | An assigned item receives an explicit clear and reports `applied` | TC-CLOSE-027 | Covered |
| AC-F6-2 | An absent assignee signal still schedules and issues an explicit clear | TC-CLOSE-028 | Covered |
| AC-F6-3 | A provider without assignee-clear capability reports `skipped-gap` with a valid reason | TC-CLOSE-029 | Covered |
| AC-F6-4 | A prior terminal outcome or provider-confirmed absence after a clear makes a re-run `satisfied` with no duplicate clear | TC-CLOSE-030 | Covered |
| AC-F7-1 | An eligible open direct dependent gains `hand-back`, loses a present `blocked`, and the flip is recorded | TC-CLOSE-031 | Covered |
| AC-F7-2 | A dependent with another open blocker is not flipped and evidence names the open count | TC-CLOSE-032 | Covered |
| AC-F7-3 | Already `hand-back` and not `blocked` is `satisfied`; `hand-back` plus `blocked` gets a removal | TC-CLOSE-033 | Covered |
| AC-F7-4 | An unknown blocker or unavailable relation signal never satisfies and never flips | TC-CLOSE-034 | Covered |
| AC-F7-5 | More than 200 direct dependents processes a deterministic first batch, records `truncated` and the omitted count, and a re-run makes progress | TC-CLOSE-035 | Covered |
| AC-F7-6 | No reverse-read surface is `skipped-gap` with `provider-unsupported`; a supported surface with the current read unavailable is `skipped-noop` with `relation-signal-unavailable` and no flip | TC-CLOSE-036, TC-CLOSE-034 | Covered |
| AC-F7-7 | A provider-asserted empty `blocked-by` set may flip, while an unavailable/unasserted relation signal is skipped with `relation-signal-unavailable` and never flipped; an unasserted `[]` is never "no blockers" | TC-CLOSE-034 | Covered |
| AC-F8-1 | Each unresolved thread on the merged request is resolved once, already-resolved is `satisfied`, outcomes recorded | TC-CLOSE-037 | Covered |
| AC-F8-2 | No delivery-request/thread surface is `skipped-gap` with `provider-unsupported`, exit 0 | TC-CLOSE-038 | Covered |
| AC-F8-3 | No merged delivery request is `skipped-noop` with `no-delivery-request`, not a failure | TC-CLOSE-039 | Covered |
| AC-F8-4 | A thread-resolution write failure returns `closeout.write.failed` exit 2, completed outcomes persist, retry converges | TC-CLOSE-040 | Covered |
| AC-F9-1 | Clean checkout on the delivery branch restores to the resolved base and reports `applied` | TC-CLOSE-041 | Covered |
| AC-F9-2 | Checkout already on the base is `satisfied` with zero switch | TC-CLOSE-042 | Covered |
| AC-F9-3 | An unrelated checkout is `satisfied` with `already-elsewhere` and is not hijacked | TC-CLOSE-043 | Covered |
| AC-F9-4 | A dirty worktree or missing base ref refuses restore, deletes no branch, and returns `closeout.branch.unsafe` exit 1 | TC-CLOSE-044 | Covered |
| AC-F9-5 | A clean detached-at-delivery-head checkout restores to the resolved base; a dirty or missing base refuses with `closeout.branch.unsafe` and no deletion | TC-CLOSE-066 | Covered |
| AC-F10-1 | A squash-merged branch whose merged head equals the local head is deleted once and no remote ref is touched | TC-CLOSE-045 | Covered |
| AC-F10-2 | A moved local head is refused, retained, and returns `closeout.branch.unsafe` exit 1 | TC-CLOSE-046 | Covered |
| AC-F10-3 | A protected ref is never deleted and the protected state is recorded as evidence | TC-CLOSE-047, TC-CLOSE-001 | Covered |
| AC-F10-4 | A branch checked out in another worktree is refused with evidence and zero destructive action | TC-CLOSE-048 | Covered |
| AC-F10-5 | An already-absent local branch is `satisfied` with zero mutation | TC-CLOSE-049 | Covered |
| AC-F10-6 | Multiple matching branches with no unique merged-head match return `closeout.target.ambiguous` exit 1 and delete nothing | TC-CLOSE-050 | Covered |
| AC-F10-7 | An unknown merged head is refused with `closeout.branch.unsafe` and the branch retained | TC-CLOSE-051, TC-CLOSE-006 | Covered |
| AC-F10-8 | A non-gap provider failure earlier still runs a safe restore, skips deletion, retains the branch, and returns `closeout.write.failed` | TC-CLOSE-052 | Covered |
| AC-F11-1 | GitHub supports the documented closeout writes and declares `write-comment`/`write-delivery-request` gaps with reasons | TC-CLOSE-053, TC-CLOSE-002 | Covered |
| AC-F11-2 | Jira supports `write-work-item`/`transition-work-item` and declares the five documented gaps with reasons | TC-CLOSE-054, TC-CLOSE-002 | Covered |
| AC-F11-3 | GitLab declares every write, including `resolve-delivery-thread`, and `read-work-item` as gaps while keeping its reads | TC-CLOSE-055, TC-CLOSE-002 | Covered |
| AC-F11-4 | An unsupported operation is `skipped-gap` with a valid reason, never `applied`/`satisfied`, and does not fail the transaction | TC-CLOSE-056 | Covered |
| AC-F12-1 | With multiple merged requests the highest numeric entity identity is selected deterministically and recorded | TC-CLOSE-057 | Covered |
| AC-F12-2 | Without lookup support the dependent steps skip with evidence and the base falls back to the integration base | TC-CLOSE-058 | Covered |
| AC-F12-3 | `DeliveryRequest.headSha` round-trips when present and remains absent (unknown) when absent | TC-CLOSE-006, TC-CLOSE-002 | Covered |
| AC-F13-1 | Machine output is exactly one bounded `delivery.closeout.v1` envelope with no comment bodies, titles, raw payloads, credentials, or environment values | TC-CLOSE-059 | Covered |
| AC-F13-2 | Identical state and arguments render byte-identical human output within the line and byte bounds | TC-CLOSE-060 | Covered |
| AC-F14-1 | Each new closeout failure identity carries its documented code, category, retryability, consequence, projection class, and exit | TC-CLOSE-003, TC-CLOSE-061 | Covered |
| AC-F14-2 | The documented and machine-readable error tables agree bidirectionally and no exit literal exists outside the CLI projection | TC-CLOSE-004 | Covered |
| AC-F15-1 | `status`, `queue ready`, and `verify change` perform zero writes/zero spawns and do not import the git seam or provider write path | TC-CLOSE-007, TC-CLOSE-008 | Covered |
| AC-NFR3-1 | The closeout battery runs with committed sanitized fixtures, temporary repositories, and injected transports only; no live credentials or network | TC-CLOSE-062 | Covered |
| AC-NFR8-1 | One ledger record per terminal operation, verified read returns them, torn/malformed state is a classified error and never zeros | TC-CLOSE-019 | Covered |
| AC-NFR10-1 | No runtime dependency is added and the fail-closed license gate is green | TC-CLOSE-009 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 010–012; F-2 → 001, 010, 011, 013, 014; F-3 → 015–019; F-4 → 020–022, 067; F-5 → 023–026; F-6 → 027–030; F-7 → 031–036 (034 covers the signal-level skip); F-8 → 037–040; F-9 → 041–044, 066; F-10 → 045–052; F-11 → 002, 053–056, 065; F-12 → 006, 057, 058; F-13 → 059, 060; F-14 → 003, 004, 061, 067; F-15 → 007, 008.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no inbound HTTP/REST endpoint (API-#). The command surface and the data model are the interface.

| Element | TC ID(s) | Observable assertion |
|---------|----------|----------------------|
| Command grammar `<workItemRef> [--apply] [--json]` | TC-CLOSE-010, TC-CLOSE-012 | Exactly one canonical ref; `--apply` is the only mutation switch; `--json` adds no command behaviour |
| DM-1 `CloseoutPlan`/`CloseoutStep` | TC-CLOSE-001, TC-CLOSE-010, TC-CLOSE-014 | Seven ordered steps, expansion rules, no I/O in contract data |
| DM-2 `CloseoutOperation` | TC-CLOSE-001, TC-CLOSE-014, TC-CLOSE-018 | Operation name, engine, provider target, canonical arguments, deterministic identity inputs |
| DM-3 `CloseoutOutcome` vocabulary | TC-CLOSE-001, TC-CLOSE-059, TC-CLOSE-061 | Closed plan/apply outcome sets; gap reasons `provider-unsupported`/`adapter-not-implemented`/`plan-restriction` only |
| DM-4 `closeout.operation` ledger record | TC-CLOSE-019 | Additive `delivery.closeout.operation.v1`; verified read; no schema bump; fenced apply |
| DM-5 Closeout provider operations | TC-CLOSE-001, TC-CLOSE-027, TC-CLOSE-028, TC-CLOSE-053–056 | `write-work-item` flat args (`add?`/`remove?`/`assignee?`, no nested `labels`), `transition-work-item` (`deliveryState`), `resolve-delivery-thread` (`deliveryRequest`/`threadId`); the same flat shape is the identity input |
| DM-6 Lifecycle label disposition | TC-CLOSE-001, TC-CLOSE-023, TC-CLOSE-026 | Keep `change`; remove six lifecycle labels; add `delivered` |
| DM-7 Base and protected-ref contract | TC-CLOSE-001, TC-CLOSE-041, TC-CLOSE-047 | Merged target ref else integration base; protected set always wins |
| DM-8 `DeliveryRequest.headSha` | TC-CLOSE-002, TC-CLOSE-006, TC-CLOSE-051 | Optional, absent means unknown, copied verbatim, never fabricated |
| DM-9 Operation identity | TC-CLOSE-014, TC-CLOSE-018 | Deterministic SHA-256 digest over the ADR-0003 inputs (workspace/ref/engine/operation/canonical arguments/target) **plus the additive `capabilityContext` refinement recorded in DEC-7**; no clock/randomness |
| DM-10 `closeout` kind and rows | TC-CLOSE-003, TC-CLOSE-004, TC-CLOSE-061 | Additive kind; four documented rows; existing projection classes reused |
| DM-11 Read observation discrimination | TC-CLOSE-034, TC-CLOSE-036, TC-CLOSE-067 | `observed`/`not-found`/`unavailable`/`invalid`; not-found → `closeout.target.unobserved`; invalid → `provider.payload.invalid`; unavailable relation → signal-level `skipped-noop`, never an empty blocker set |
| EVT-1 `closeout.operation` (internal record) | TC-CLOSE-019 | One record per terminal outcome, first terminal per `operationId` authoritative |
| EVT-2 Rendered closeout summary (projection, not a ledger event) | TC-CLOSE-059, TC-CLOSE-060 | Summary is a pure projection of verified records plus the current run; no separate summary record |
| TDR-0008 conformance obligation | TC-CLOSE-002, TC-CLOSE-065 | `ADAPTER_OPERATIONS` contains `resolve-delivery-thread`; flow-registry operation set equals it; a new step exists; step/flow counts updated deliberately; every newly supported write executes in mock conformance |
| Runtime-coverage invariant over new supported writes | TC-CLOSE-065 | `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` is empty; each supported `write-work-item`/`transition-work-item`/`resolve-delivery-thread` has an executed step for the provider that declares it |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | 100 % idempotent convergence, including simulated restart and crash-between-effect-and-record | TC-CLOSE-015, TC-CLOSE-016, TC-CLOSE-017 | Covered |
| NFR-2 | 100 % byte-identical plans, arguments, and identities; no wall clock/randomness/map order | TC-CLOSE-013, TC-CLOSE-014, TC-CLOSE-018 | Covered |
| NFR-3 | 100 % offline; 0 live-network tests; injected transports and sanitized fixtures | TC-CLOSE-062 | Covered |
| NFR-4 | Plan mode performs zero writes, git mutations, state appends, and fence acquisitions | TC-CLOSE-010, TC-CLOSE-011 | Covered |
| NFR-5 | Read-only commands perform zero writes/zero spawns and do not import the git seam or write path | TC-CLOSE-007, TC-CLOSE-008 | Covered |
| NFR-6 | Caps 200 dependents / 100 threads, 30 s per operation, p95 ≤ 120 s reference apply, no unbounded wait | TC-CLOSE-035, TC-CLOSE-037, TC-CLOSE-063 | Covered (bounded work in CI; reference latency non-CI per GAP-T2) |
| NFR-7 | Machine ≤ 64 KiB; human ≤ 200 lines and ≤ 16 KiB; deterministic truncation; no forbidden content | TC-CLOSE-059, TC-CLOSE-060 | Covered |
| NFR-8 | One append per terminal operation through the fenced port; verified reads; torn/malformed classified; no schema bump | TC-CLOSE-019 | Covered |
| NFR-9 | 100 % capability honesty; every unsupported operation carries a valid gap; no unsupported success; an unavailable signal is a skip, never success | TC-CLOSE-002, TC-CLOSE-034, TC-CLOSE-053, TC-CLOSE-054, TC-CLOSE-055, TC-CLOSE-056, TC-CLOSE-065 | Covered |
| NFR-10 | 0 new runtime dependencies; license registry unchanged; fail-closed license gate green | TC-CLOSE-009 | Covered |
| NFR-11 | 100 % bidirectional error-table sync; exit literals only in the CLI projection | TC-CLOSE-004, TC-CLOSE-061 | Covered |
| NFR-12 | Write scope limited to the target/dependents/named labels/assignee clear/named threads/matching local branch; no secret or comment-body leakage | TC-CLOSE-026, TC-CLOSE-059, TC-CLOSE-062 | Covered |
| NFR-13 | No branch deletion without the full predicate; protected refs never deleted; unsafe state yields zero destructive action | TC-CLOSE-045, TC-CLOSE-046, TC-CLOSE-047, TC-CLOSE-048, TC-CLOSE-049, TC-CLOSE-050, TC-CLOSE-051, TC-CLOSE-052 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 61 ACs (AC-F1-1 … AC-NFR10-1) appear in §3.1 with at least one TC.
- **Orphan TCs**: none. Each of the 67 TCs names at least one AC in §5.1 and §5.2.
- **Untestable ACs**: none flagged. Two ACs are partially evidenced in-tree, and the partial halves are recorded, not hidden: AC-F14-2's documented table is a repository file (fully in-tree); AC-NFR10-1's license gate is a CI job (runnable locally via the documented command).
- **Intentional duplicate coverage**: AC-F2-2 spans three TCs because the order is asserted as contract data, as dry-run output, and as apply output; AC-F7-6 spans two because the provider-level no-surface gap and the signal-level unavailable-skip are different outcomes with different evidence; AC-F10-3 spans two because the protected set is contract data plus runtime refusal; AC-F12-3 spans two because the type shape and the provider normalization are different failure modes; AC-F14-1 spans two because the table round-trip and the emitted/exit-projected identity are different oracles.
- **Spec-named behaviour bound to an existing AC** (no dedicated AC by design): the runtime-confinement entry (F-15/AC-F15-1, TC-CLOSE-008), the conformance flow-registry obligation (TDR-0008/AC-F11-1..3, TC-CLOSE-002), the ordered expansion keys (F-2/AC-F2-3, TC-CLOSE-014), and the reference latency (NFR-6, TC-CLOSE-063).

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract and vocabulary | `bun test tests/structure/closeout-contract.test.ts`; `pnpm typecheck` | `tests/structure/closeout-contract.test.ts`, `tests/types/closeout-*.type-test.ts` | TC-CLOSE-001, TC-CLOSE-002, TC-CLOSE-006 |
| Error contract and sync | `bun test tests/structure/error-table.test.ts`; `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | existing suites (update) | TC-CLOSE-003, TC-CLOSE-004, TC-CLOSE-005 |
| Boundary, purity, confinement | `bun test tests/structure/closeout-imports.test.ts tests/boundaries`; `pnpm check:boundaries`; static checks | `tests/structure/closeout-imports.test.ts`, `tests/boundaries/**` | TC-CLOSE-007, TC-CLOSE-008, TC-CLOSE-062 |
| Plan and grammar behaviour | `bun test tests/behaviour/closeout-plan.test.ts` | `tests/behaviour/closeout-plan.test.ts` + `tests/fixtures/closeout/**` | TC-CLOSE-010..TC-CLOSE-014 |
| Idempotency and ledger | `bun test tests/behaviour/closeout-idempotency.test.ts` | same + state harness | TC-CLOSE-015..TC-CLOSE-019 |
| Ticket and label behaviour | `bun test tests/behaviour/closeout-ticket-labels.test.ts` | provider fixtures | TC-CLOSE-020..TC-CLOSE-026, TC-CLOSE-067 |
| Unassign behaviour | `bun test tests/behaviour/closeout-unassign.test.ts` | provider fixtures | TC-CLOSE-027..TC-CLOSE-030 |
| Owed-flip behaviour | `bun test tests/behaviour/closeout-owed-flip.test.ts` | dependent/relation fixtures | TC-CLOSE-031..TC-CLOSE-036 |
| Thread resolution | `bun test tests/behaviour/closeout-threads.test.ts` | GitHub GraphQL fixture | TC-CLOSE-037..TC-CLOSE-040 |
| Checkout restore | `bun test tests/behaviour/closeout-checkout.test.ts` | temp local git repos + git fake | TC-CLOSE-041..TC-CLOSE-044, TC-CLOSE-066 |
| Branch cleanup | `bun test tests/behaviour/closeout-branch.test.ts` | temp local git repos + git fake | TC-CLOSE-045..TC-CLOSE-052 |
| Capability parity | `bun test tests/behaviour/closeout-capabilities.test.ts` | capability fixtures | TC-CLOSE-053..TC-CLOSE-056 |
| Merged-request lookup | `bun test tests/behaviour/closeout-request.test.ts` | delivery-request fixtures | TC-CLOSE-057, TC-CLOSE-058 |
| Output and errors | `bun test tests/behaviour/closeout-output.test.ts tests/golden/closeout-*.test.ts` | goldens + envelope harness | TC-CLOSE-059..TC-CLOSE-061 |
| Offline and bounds | `bun test tests/behaviour/closeout-hermetic.test.ts`; `bun test tests/checks/fixture-sanitization.test.ts` | canaries, caps, call-count fixtures | TC-CLOSE-062, TC-CLOSE-063 |
| Non-vacuity meta-check | `bun test tests/checks/closeout-mutants.test.ts` | `tests/fixtures/closeout/mutants/**` | TC-CLOSE-064 |
| Dependencies and license | `bun test tests/checks/license-*.test.ts`; `bun run scripts/checks/license-audit.ts`; `bun run scripts/checks/vulnerability-gate.ts` | existing license suites | TC-CLOSE-009 |
| Conformance registry and runtime coverage | `bun test tests/structure/conformance-coverage.test.ts`; `bun test tests/conformance` | existing conformance suites (update) | TC-CLOSE-002, TC-CLOSE-065 |
| Aggregate and non-regression | `pnpm check` | repo root; unchanged gates | All TCs (regression half) |

### 4.1 In-Process Closeout Harness Contract (binding for every closeout TC)

1. **No live network, credentials, or host state.** Every closeout suite imports production modules and injects fakes. No suite resolves a host, opens a socket, reads a real credential, or spawns a real git process against the live repository. Provider behaviour comes from committed sanitized fixtures via the existing `createFixtureTransport` pattern; GraphQL thread resolution uses a committed `resolveReviewThread` fixture. TC-CLOSE-062 asserts the absence by scan.
2. **One recording provider runtime.** A `CloseoutProviderRuntime` fake implements the closeout-relevant members (`readWorkItem`, `readWorkItemObservation` returning the discriminated `CloseoutReadObservation` — `observed` / `not-found` / `unavailable` / `invalid` — `readDeliveryRequest`, the merged-request source-ref lookup, `listBlockedByDependents`, `writeWorkItem`, `transitionWorkItem`, `resolveDeliveryThread`) and records an ordered call log of `{ kind, target, args }`. It answers from the committed provider fixture corpus and can be scripted per call to fail or return the discriminated observation/signal by name: `fakeFailWrite`, `fakeUnknownHead`, `fakeAbsentLabels`, `fakeNotFound` (explicit `not-found`), `fakeInvalidPayload` (malformed/unparsable `invalid`), `fakeUnavailableSurface` (no read surface), and `fakeUnavailableRelation` / `fakeUnknownRelation` (unavailable/unknown reverse-dependent or `blocked-by` signal). These hooks drive TC-CLOSE-034/TC-CLOSE-036 (relation signal) and TC-CLOSE-067 (not-found/invalid/unavailable); the git fake's `isClean`/`resolveRef` drive the in-process checkout predicate cases while TC-CLOSE-044/TC-CLOSE-066 exercise the same dirty/missing-base facts against a temporary local repository. This keeps the fake synchronized with plan PIN-14/PIN-15/PIN-16 and Phases 3.7/3.8/4.6/5.5/6.6.
3. **One recording git seam.** A `CloseoutGitRuntime` fake implements the bounded plan queries and mutations (`readCheckout`, `readBranch`, `listBranches`, `isCheckedOutElsewhere`, `isClean`, `resolveRef`, `restoreCheckout`, `deleteBranch`) and records every call, keeping it synchronized with plan PIN-16 and Phases 6.6/3.8 (dirty-worktree and base-resolution cases). A separate **temporary local git repository** harness (`mkdtemp` + `git init` + commits/branches/worktrees) exercises the production git seam end to end for TC-CLOSE-041..TC-CLOSE-052 and TC-CLOSE-066. The temp repo is created and removed per test; the live worktree is never mutated.
4. **Injected clock, run id, and brand.** `CLOSEOUT_NOW_MS` is fixed; `newRunId` is a fixed sequence; the brand is `SYNTHETIC_BRAND` from `tests/golden/helpers.ts`. No test reads `Date.now`, `Math.random`, `process.env`, `$HOME`, or a real path for a verdict.
5. **Recording fenced state port.** The state harness records `append`, `fence` acquire/release, and verified reads; it can preload terminal outcomes, a `failed` outcome, a torn tail, or a malformed record by name. Plan-mode tests assert the call log is empty where NFR-4 requires it.
6. **In-process CLI composition.** Grammar, plan, apply, output, and exit projection run through the existing `runCli`/`createProgram` composition with buffer streams, not a spawned binary.
7. **Recorded arguments over inference.** Where an AC concerns what a seam receives (label add/remove set, assignee clear argument, thread id, branch name, base ref), the test asserts the recorded argument, not a guessed side effect. The fake never interprets provider semantics, so provider trap correctness is pinned by both the fixture and the recorded request.
8. **Temp roots only.** Any test needing a real filesystem (git scenarios, goldens, whole-tree scans) uses `mkdtemp` under the OS temp directory or read-only committed fixtures. No closeout test writes the live repository tree.

### 4.2 Non-Vacuity Contract (binding for every negative, gap, cap, refusal, and absence scenario)

1. **A planted positive is asserted present before the absence is asserted.** A lifecycle label, dependent id, thread id, protected ref, canary value, or terminal outcome is asserted to exist in the fixture (or the fake's raw response) before the test asserts it is absent from output, excluded from a write, or refused.
2. **A paired live control runs in the same test.** A refusal runs beside an eligible sibling deletion; a gap runs beside a supported sibling; a cap-truncated sweep runs beside a within-cap sweep; an unknown head runs beside a matching head; a plan-mode zero-call assertion runs beside an apply-mode call assertion.
3. **A deliberately broken expectation must fail the suite, naming the case.** For each guard that could pass vacuously (the label disposition, the unknown-blocker rule, the unavailable-signal-as-empty rule, the merged-head equality, the protected-ref set, the gap honesty rule, the no-leak projection, the terminal-reuse logic, the SHA-256 identity algorithm/omitted capability context, and the detached-at-delivery-head classification), `tests/checks/closeout-mutants.test.ts` imports a temp mutant through a file URL in which the named step is disabled, asserts the mutant produces the prohibited observable, and asserts the failure message names the case. If the real module also produced nothing, the meta-check fails.
4. **No assertion depends on a moving base.** Every assertion reads the current tree, a committed fixture, a temp copy, or a temporary git repository. No `git diff` against `origin/main-tools` appears in the permanent suite.
5. **Caps are asserted at and above the threshold.** The 200-dependent and 100-thread caps are exercised with exactly-at, one-above, and larger fixtures; the truncated marker, the omitted count, and the re-run progress are asserted.
6. **Scan scope is non-empty.** Import, spawn, mutation, secret-read, and no-leak scans assert a positive count of files/entries/calls before asserting zero violations.

### 4.3 Normative Test-Case Table

This table is binding: a TC is complete only when every column is satisfied. `Level` names the layer and the suite. Exit codes are absolute (`0` success, `1` user-validation, `2` platform-provider).

| TC | AC | Level / suite | Fixture / fake | Steps (compact) | Oracle | Non-vacuity control |
|----|----|---------------|----------------|-----------------|--------|---------------------|
| TC-CLOSE-001 | AC-F2-2, AC-F5-1, AC-F10-3, NFR-2, NFR-9 | Contract / contract | `packages/core/src/contracts/closeout.ts`; AST scan | Parse contract data; assert step order, label table, protected set, outcome vocabulary, operation vocabulary; assert data-only | Seven steps exact order; six removals + `change` keep + `delivered` add; protected set exact; closed outcome/gap sets; zero executable statements | Seeded executable statement / wrong disposition in a temp copy each fail |
| TC-CLOSE-002 | AC-F11-1, AC-F11-2, AC-F11-3, AC-F12-3, NFR-9 | Contract / conformance | `ADAPTER_OPERATIONS`; `CONFORMANCE_FLOWS`; `DeliveryRequest` type | Assert `resolve-delivery-thread` is in the closed set; assert flow-registry operation set equals `ADAPTER_OPERATIONS`; assert a `resolve-delivery-thread` step exists; assert GitHub/Jira/GitLab declarations cover the set exactly; assert `headSha?` optional | Exact set equality; new step present; gap sets exact; optional field | Removing the new step or the operation fails naming it; a widened required `headSha` fails typecheck |
| TC-CLOSE-003 | AC-F14-1 | Contract / error table | `ERROR_TABLE`, `DOMAIN_KINDS`; trigger paths | Assert `closeout` in `DOMAIN_KINDS`; assert exactly four rows with every field; drive each through a trigger; compare classifiers | 4/4 exact rows; same entry from both classifiers; no new projection class | Removing a row in a temp copy fails its trigger |
| TC-CLOSE-004 | AC-F14-2, NFR-11 | Contract / sync | `scripts/checks/error-table-sync.ts`; documented table | Run sync green; count rows; mutate machine and doc copies both directions; assert empty/unparseable fails closed; run exit-literal scan | 0 drift; named offender per mutation; 0 exit literals outside the CLI projection | Unchanged control stays green; each drift fails |
| TC-CLOSE-005 | AC-F14-1 | Contract / classification | `classifyDomainKind`, `classifyThrown`; existing kinds | Kind-only `closeout`; wrong code; unknown code; existing kinds | Kind-only throws / contains via `fallback.internal`; exact codes resolve; existing kinds unchanged | First-row-selecting control is caught |
| TC-CLOSE-006 | AC-F12-3, AC-F10-7, DM-8 | Contract + Behaviour / contract, branch | Paired `DeliveryRequest` fixtures (head present / absent); git fake | Normalize both; assert present round-trips verbatim and absent stays absent; run branch cleanup on absent head | Present equals fixture byte-for-byte; absent is `undefined`/absent (not `""`); absent-head cleanup refuses `closeout.branch.unsafe` | A defaulting/deriving mutant fabricates a head and fails |
| TC-CLOSE-007 | AC-F15-1, NFR-5 | Boundary / imports | `closeout-imports.test.ts`; existing read-only suites; AST scan | Assert `status`/`queue ready`/`verify change` import no closeout engine, provider write path, or git seam; assert zero spawn/write members; run their suites | Zero forbidden imports/spawns/writes; existing suites green | A seeded import/spawn in a temp copy fails |
| TC-CLOSE-008 | AC-F15-1, NFR-5, NFR-12 | Static / imports, boundaries | `.dependency-cruiser.cjs`; git seam path; repo reader; secret allowlist | Assert exact runtime-confinement entry for the git seam; assert the read-only repo reader is unchanged and no-spawn; assert allowlist length unchanged; run `depcruise` | Exact allowance entry with reason; repo reader no-spawn; allowlist count unchanged; boundaries green | A widened or missing allowance fails; a planted spawn in the repo reader fails |
| TC-CLOSE-009 | AC-NFR10-1, NFR-10 | Checks / license | `package.json`, lockfile, license registry; license suite | Assert no dependency added; run license audit and vulnerability gate | 0 new deps; registry unchanged; fail-closed gate green | A synthetic added dependency fails the audit |
| TC-CLOSE-010 | AC-F1-1, AC-F2-2, NFR-4 | Behaviour / plan | Provider + git + state fakes | Run `closeout GH-183 --json`; inspect data and call logs | Seven steps in order; plan outcomes; zero writes/git mutations/state appends/fences; exit 0 | Applying the same fixture reaches `applied`; a plan-write mutant fails |
| TC-CLOSE-011 | AC-F1-2, AC-F2-2, NFR-4 | Behaviour / plan | Same fakes | Run `--apply`; compare the plan to dry-run | Same ordered steps/arguments/identities; apply outcomes present; per-op summary | Dry-run then apply diff is empty apart from mode/outcomes |
| TC-CLOSE-012 | AC-F1-3 | Behaviour / plan | Runtime fake; grammar matrix §4.9 | Run malformed/missing/one-extra/two-or-more-extra/unknown-flag/value-bearing cases | Exact `input.value.rejected` (handler) / `fallback.invocation` (parser); exit 1; zero provider/git/state calls | A valid sibling invocation succeeds and calls the runtime |
| TC-CLOSE-013 | AC-F2-1, NFR-2 | Behaviour / plan | Fixed clock/run id; permuted provider arrays | Run the same plan three times; permute provider/thread/dependent order between runs | Byte-identical serialized plan; identical identities; order independent of input order | A `Date.now()`/map-order mutant drifts and fails |
| TC-CLOSE-014 | AC-F2-3, AC-F2-1, AC-F3-4, DM-9 | Behaviour / plan | Multi-label/dependent/thread fixtures | Expand a step; assert order keys and distinct identities; change one identity input | Distinct `operationId`s; disposition/entity/thread order; one changed input changes exactly one identity | Duplicate-identity or unstable-order mutant fails |
| TC-CLOSE-015 | AC-F3-1, NFR-1 | Behaviour / idempotency | Preloaded terminal outcomes; fresh-process composition | Apply, then re-run in a new composition; inspect writes and ledger | Zero duplicate writes/mutations; every terminal outcome reused; exit 0; identical summary | A re-executing mutant duplicates a call and fails |
| TC-CLOSE-016 | AC-F3-2, NFR-1 | Behaviour / idempotency | Effect applied but no ledger record; provider returns satisfied | Re-run; inspect writes | `satisfied` recorded; zero duplicate effect; converged summary | A blind-retry mutant issues a second write and fails |
| TC-CLOSE-017 | AC-F3-3 | Behaviour / idempotency | Preloaded `failed` outcome; provider then succeeds | Re-run; inspect ledger and writes | Failed record retained; operation re-observed/retried; terminal outcome appended; convergence | A "failed is terminal" mutant never retries and fails |
| TC-CLOSE-018 | AC-F3-4, DM-9 | Behaviour / idempotency | Pure identity function; `node:crypto` cross-check | Assert SHA-256 known-answer vectors (`""` → `e3b0c442...`, `"abc"` → `ba7816bf...`); derive a fixed canonical closeout tuple against a committed expected digest; cross-check against test-only `node:crypto`; derive repeatedly; vary workspace/ref/engine/op/args/target; change capability context | 64-lowercase-hex SHA-256; KAT and fixed-tuple digests match; stable for identical inputs; every input change changes it; gap→supported yields a new identity | FNV-1a, omitted-capability-context, clock/random, or omitted-input mutant fails the KAT/fixed-tuple/identity assertion, naming the case |
| TC-CLOSE-019 | AC-NFR8-1, NFR-8, EVT-1 | Behaviour / idempotency | State harness; fenced port; torn/malformed fixtures | Apply; count records; verified read; simulate torn tail/malformed/schema mismatch | One record per terminal op; verified read returns all; classified `state.*` error, never zeros; no schema bump; fence held | A failure-to-zero mutant fails; schema bump fails |
| TC-CLOSE-020 | AC-F4-1 | Behaviour / ticket | GitHub/Jira open-item fixtures | Apply; inspect transition call | Item done; `applied`; provider-specific transition recorded | Already-done sibling does no write (TC-021) |
| TC-CLOSE-021 | AC-F4-2 | Behaviour / ticket | Already-done fixtures | Plan and apply; inspect writes | `satisfied`; zero write; exit 0 | A done-item write mutant fails |
| TC-CLOSE-022 | AC-F4-3, NFR-9 | Behaviour / ticket | No-transition/no-mapping fixture | Plan and apply | `skipped-gap` with valid reason; transaction continues; exit 0 | A supported sibling is `applied` in the same run |
| TC-CLOSE-023 | AC-F5-1, DM-6 | Behaviour / labels | Provider-asserted label sets incl. all six + `change` + vendor label | Apply; inspect recorded add/remove set | Six removed; `change` and vendor label kept; `delivered` added when absent | Swept sibling set is `satisfied` (TC-024); a keep-`change` removal mutant fails |
| TC-CLOSE-024 | AC-F5-2 | Behaviour / labels | Already-swept set | Apply twice; inspect writes | Second run `satisfied`, zero write | First run applies; a repeat-write mutant fails |
| TC-CLOSE-025 | AC-F5-3 | Behaviour / labels | Absent (unknown) label signal | Plan and apply | `skipped-noop` with `label-signal-unavailable`; zero removal/replacement | A present-label sibling writes; a blind-rewrite mutant fails |
| TC-CLOSE-026 | AC-F5-4, NFR-12 | Behaviour / labels | Jira `labels-replace-before/after` trap fixtures | Apply; inspect the full-array replace request | Only named labels removed; `delivered` added; every other label preserved | A whole-array-overwrite mutant drops a vendor label and fails |
| TC-CLOSE-027 | AC-F6-1, DM-5 | Behaviour / unassign | Assigned GitHub/Jira fixtures | Apply; inspect clear call | Explicit clear; `applied`; canonical `{ assignee: "none" }` | An absent-assignee sibling still schedules (TC-028) |
| TC-CLOSE-028 | AC-F6-2 | Behaviour / unassign | Absent assignee signal | Plan and apply | Explicit clear scheduled and issued; never "already unassigned" | A provider-asserted absent-after-clear is `satisfied` (TC-030) |
| TC-CLOSE-029 | AC-F6-3, NFR-9 | Behaviour / unassign | No-clear-capability fixture | Plan and apply | `skipped-gap` valid reason; continues; exit 0 | A supporting sibling applies |
| TC-CLOSE-030 | AC-F6-4 | Behaviour / unassign | Preloaded terminal outcome; provider-asserted absent after clear | Re-run | `satisfied`; zero duplicate clear | A repeat-clear mutant fails |
| TC-CLOSE-031 | AC-F7-1 | Behaviour / owed-flip | Eligible dependent fixture | Apply; inspect write and output | `hand-back` added; `blocked` removed when present; flip recorded | A still-blocked sibling is not flipped (TC-032) |
| TC-CLOSE-032 | AC-F7-2 | Behaviour / owed-flip | Dependent with one open blocker | Apply | No flip; evidence names open count | The eligible sibling flips |
| TC-CLOSE-033 | AC-F7-3 | Behaviour / owed-flip | Already `hand-back` without `blocked`; `hand-back`+`blocked` | Apply | First `satisfied` zero write; second removal operation | Both cases in one fixture |
| TC-CLOSE-034 | AC-F7-4, AC-F7-6, AC-F7-7 | Behaviour / owed-flip | Unavailable/unasserted relation signal; provider-asserted empty `blocked-by`; known-done sibling | Apply each; inspect outcome and evidence | Unavailable → `skipped-noop` with `relation-signal-unavailable`, no flip; asserted empty → eligible; unknown never satisfied | An unasserted-`[]`-as-no-blockers / unavailable-signal-as-empty mutant flips and fails; the known-done sibling flips |
| TC-CLOSE-035 | AC-F7-5, NFR-6 | Behaviour / owed-flip | 200, 201, and larger dependent fixtures | Apply twice; inspect truncation and exclusions | Deterministic first batch; `truncated` + omitted count; re-run excludes flipped and makes progress | At-cap and above-cap fixtures differ; a no-truncation mutant fails |
| TC-CLOSE-036 | AC-F7-6, NFR-9 | Behaviour / owed-flip | Provider runtime with no bounded reverse-read surface (provider-level gap) | Plan and apply | `skipped-gap` with `provider-unsupported`; continues | A capable sibling flips; the existing-surface-but-unavailable case is asserted in TC-CLOSE-034 as `skipped-noop`, not here |
| TC-CLOSE-037 | AC-F8-1, NFR-6 | Behaviour / threads | Merged request with unresolved/partly resolved threads; GraphQL fixture | Apply; inspect `resolve-delivery-thread` calls | One resolution per unresolved thread; already-resolved `satisfied`; cap 100; outcomes recorded | A second run is `satisfied` (TC-015/040 interaction) |
| TC-CLOSE-038 | AC-F8-2, NFR-9 | Behaviour / threads | Jira no-surface fixture | Plan and apply | `skipped-gap` `provider-unsupported`; exit 0 | A GitHub sibling resolves |
| TC-CLOSE-039 | AC-F8-3 | Behaviour / threads | No merged request | Plan and apply | `skipped-noop` `no-delivery-request`; not a failure | A present-request sibling resolves |
| TC-CLOSE-040 | AC-F8-4, AC-F3-3 | Behaviour / threads | One thread write fails | Apply; inspect envelope, ledger, retry | `closeout.write.failed` exit 2; completed outcomes persisted; failed recorded; retry resolves safely | A success-on-partial mutant fails |
| TC-CLOSE-041 | AC-F9-1, DM-7 | Behaviour / checkout | Temp local repo on delivery branch; merged target fixture | Apply; inspect restore call | Restored to merged target ref (else `main-tools`); `applied` | Already-on-base sibling is `satisfied` (TC-042) |
| TC-CLOSE-042 | AC-F9-2 | Behaviour / checkout | Temp repo already on base | Apply | `satisfied`; zero switch | A switch mutant fails |
| TC-CLOSE-043 | AC-F9-3 | Behaviour / checkout | Temp repo on unrelated branch | Apply | `satisfied` `already-elsewhere`; no switch | A hijacking mutant switches and fails |
| TC-CLOSE-044 | AC-F9-4 | Behaviour / checkout | Dirty delivery worktree; missing base ref | Apply | Refuse restore; no deletion; `closeout.branch.unsafe` exit 1 | A clean sibling restores |
| TC-CLOSE-045 | AC-F10-1, NFR-13 | Behaviour / branch | Temp repo; merged head equals local head; no remote | Apply; inspect git calls | One local delete; zero fetch/push/remote delete; `applied` | A moved-head sibling refuses (TC-046) |
| TC-CLOSE-046 | AC-F10-2, NFR-13 | Behaviour / branch | Local head moved after merged head | Apply | Refuse; branch retained; `closeout.branch.unsafe` exit 1 | A matching-head sibling deletes |
| TC-CLOSE-047 | AC-F10-3, DM-7, NFR-13 | Behaviour / branch | Branch names `main`, `main-tools`, the resolved base, and a declared protected ref; `HEAD` asserted via resolved-base/current-checkout contract data | Plan and apply | Never attempted; protected evidence recorded; no delete | A non-protected sibling is eligible; a protected-set-bypass mutant deletes and fails |
| TC-CLOSE-048 | AC-F10-4, NFR-13 | Behaviour / branch | Branch checked out in a second temp worktree | Apply | Refuse with evidence; zero destructive action | After removing the worktree, a re-run may delete |
| TC-CLOSE-049 | AC-F10-5 | Behaviour / branch | No matching branch | Apply | `satisfied`; zero mutation | A present-branch sibling deletes |
| TC-CLOSE-050 | AC-F10-6 | Behaviour / branch | Multiple matching branches; no unique merged-head match | Apply | `closeout.target.ambiguous` exit 1; delete nothing | A unique-head sibling deletes the right branch |
| TC-CLOSE-051 | AC-F10-7, DM-8, NFR-13 | Behaviour / branch | Merged request with absent `headSha` | Apply | `closeout.branch.unsafe`; branch retained | A present-head sibling deletes |
| TC-CLOSE-052 | AC-F10-8, AC-F9-1 | Behaviour / branch | Provider write fails mid-transaction; clean delivery checkout | Apply; inspect order | Restore still runs; deletion skipped; branch retained; `closeout.write.failed` exit 2 | A later re-run after the provider heals deletes |
| TC-CLOSE-053 | AC-F11-1 | Behaviour / capabilities | GitHub declaration fixture | Inspect + apply a planned op | Supported set exact; `write-comment`/`write-delivery-request` gaps with reasons | A claimed-but-unsupported op fails |
| TC-CLOSE-054 | AC-F11-2 | Behaviour / capabilities | Jira declaration fixture | Same | `write-work-item`/`transition-work-item` supported; five gaps exact | A missing gap fails |
| TC-CLOSE-055 | AC-F11-3 | Behaviour / capabilities | GitLab declaration fixture | Same | Every write incl. `resolve-delivery-thread` and `read-work-item` gaps; reads supported | A claimed GitLab write fails |
| TC-CLOSE-056 | AC-F11-4, NFR-9 | Behaviour / capabilities | Plan containing an unsupported op | Render and apply | `skipped-gap` valid reason; never `applied`/`satisfied`; transaction continues | A success-claiming mutant fails |
| TC-CLOSE-057 | AC-F12-1, DM-8 | Behaviour / request | Multiple merged requests, numeric and non-numeric identities | Resolve target; apply | Highest numeric selected; lexical for non-numeric; recorded; ties impossible | A first-return-order mutant fails |
| TC-CLOSE-058 | AC-F12-2 | Behaviour / request | No-lookup fixture | Plan and apply | Dependent steps skip with evidence; base is `main-tools` | A lookup-capable sibling selects the merged target |
| TC-CLOSE-059 | AC-F13-1, NFR-7, NFR-12 | Behaviour / output | Envelope fixture; planted canary/forbidden fields | Run every mode/class; parse envelope; scan bytes | One `delivery.closeout.v1` envelope; ≤ 64 KiB; zero forbidden content; truncation markers deterministic | Presence of the canary is asserted first; a wide-projection mutant leaks and fails |
| TC-CLOSE-060 | AC-F13-2, NFR-7 | Behaviour / output | Human goldens; fixed clock/run id | Render twice; count lines/bytes | Byte-identical; ≤ 200 lines; ≤ 16 KiB; no extra reads | A `Date.now()` renderer drifts and fails |
| TC-CLOSE-061 | AC-F14-1, NFR-11 | Behaviour / output | Four trigger fixtures | Emit each identity; inspect envelope/exit | Documented code/category/retryable/consequence/projection; exit 1/2 by class | A wrong-projection or literal-in-command mutant fails |
| TC-CLOSE-062 | AC-NFR3-1, NFR-3, NFR-12 | Static + Behaviour / hermetic | Fixture sanitization; canaries; path/network/spawn scanners | Scan suites and fixtures; run with network/credential guards | Zero live network/credentials/host-env reads; sanitized fixtures; canary zero occurrences | A planted live fetch/credential/secret-copy fails |
| TC-CLOSE-063 | NFR-6 (AC-F7-5, AC-F8-1) | Behaviour / bounded work | Cap fixtures; call logs; declared timeouts; never-resolving provider transport; non-terminating git child; short injected timeout override; optional reference measurement | Assert invariant call counts and caps; structurally assert `CLOSEOUT_OPERATION_TIMEOUT_MS` is the production default on each I/O class (provider native-fetch and git `execFile`/`spawn`) with a removal control; behaviorally assert a short injected timeout aborts the never-resolving provider and non-terminating git child at the bound; record optional non-CI reference | Counts bounded; production default 30 000 ms structurally referenced; behavioral provider/git abort at the injected bound (no 30 s wall-clock wait); no unbounded wait; reference recorded or "not run" | A per-item-query unbounded mutant fails; the timeout-removal structural control fails on each I/O class; the never-resolving/non-terminating fixtures would hang without the bound |
| TC-CLOSE-064 | §4.2 (all ACs) | Meta-check / mutants | `tests/fixtures/closeout/mutants/**` including the FNV-1a/omitted-capability identity, unavailable-signal-as-empty, and detached-as-unrelated mutants | Run the mutant corpus; assert each broken guard fails naming its case | Every planted mutant fails the intended suite with the case name, including the identity-algorithm, unavailable-signal, and detached-classification mutants | A mutant that passes is the failure |
| TC-CLOSE-065 | AC-F11-1, AC-F11-2, AC-F11-4, NFR-9 | Conformance / runtime coverage | `CONFORMANCE_ADAPTERS`; mock run report; `runtimeCoverageViolations` | Run the mock conformance suite; assert no violations; assert each newly supported `write-work-item`/`transition-work-item`/`resolve-delivery-thread` executed for its declaring provider | `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` is empty; every supported write has an `executed` step | Dropping an executed write step or declaring an unexecuted op supported produces a named violation |
| TC-CLOSE-066 | AC-F9-5, AC-F9-4, AC-F10-8 | Behaviour / checkout | Temp repo detached at the delivery head; clean/open base; dirty and missing-base cases | Apply the clean case; apply the dirty and missing-base cases | Clean → restored to resolved base, `applied`; dirty/missing base → `closeout.branch.unsafe` exit 1, no deletion | Attached-delivery-branch sibling restores; a "detached = unrelated/satisfied" mutant fails |
| TC-CLOSE-067 | AC-F4-4, AC-F4-3, AC-F14-1, DM-11 | Behaviour / ticket | Explicit not-found fixture; malformed/unparsable payload fixture; no-work-item-read fixture | Run plan and apply for each; inspect envelope, exit, and writes | Not-found → `closeout.target.unobserved` exit 1, zero writes; invalid payload → `provider.payload.invalid`, never the not-found code; no read → dependent steps declared gap | A payload-invalid-as-not-found mutant fails; a not-found-as-gap mutant fails; a supported sibling transitions |

### 4.4 Ordered Plan Oracle (binding for AC-F2-2, AC-F2-3)

| Order | Step | Expansion | Deterministic order key |
|---:|---|---|---|
| 1 | ticket-to-done | exactly one transition operation | — |
| 2 | lifecycle label sweep | one removal per present lifecycle label (declared disposition order), one `delivered` add when absent | fixed disposition table order |
| 3 | unassign | one explicit clear operation | canonical argument `{ assignee: "none" }` |
| 4 | owed-flip sweep | one operation per eligible direct dependent | provider entity identity |
| 5 | comment resolution | one operation per unresolved thread on the merged request | thread identity |
| 6 | checkout restore | exactly one operation | resolved base |
| 7 | squash-safe local branch cleanup | exactly one operation | matching branch identity |

No step may be reordered. No expansion may use wall-clock time, randomness, API return order, or hash-map iteration order. Dry-run and apply compute the same plan; only outcomes and execution differ.

### 4.5 Label Disposition and Jira Replace Oracle (binding for AC-F5-1..AC-F5-4)

| Label | Disposition | Idempotent behaviour | Asserted by |
|---|---|---|---|
| `change` | keep | always retained; no write | TC-CLOSE-023 |
| `planning` | remove | absent → `satisfied`; present → remove | TC-CLOSE-023, TC-CLOSE-024 |
| `spec-ready` | remove | same | TC-CLOSE-023, TC-CLOSE-024 |
| `readiness-passed` | remove | same | TC-CLOSE-023, TC-CLOSE-024 |
| `in-progress` | remove | same | TC-CLOSE-023, TC-CLOSE-024 |
| `review` | remove | same | TC-CLOSE-023, TC-CLOSE-024 |
| `blocked` | remove | same | TC-CLOSE-023, TC-CLOSE-024 |
| `delivered` | add when absent | present → `satisfied`; absent → add | TC-CLOSE-023, TC-CLOSE-024 |
| any other label | preserve | no write | TC-CLOSE-023, TC-CLOSE-026 |

Jira oracle: compute the target set from provider-asserted labels at execution time; remove only the named lifecycle labels; add `delivered`; preserve every other label. The `labels-replace-before/after` fixture pair is the proof; a whole-array overwrite drops a vendor label and must fail.

### 4.6 Branch Safety Matrix (binding for AC-F9-4, AC-F9-5, AC-F10-1..AC-F10-8, NFR-13)

| ID | Predicate fact | Expected | Asserted by |
|---|---|---|---|
| BR-01 | merged request observed; local head equals merged head; clean; not protected; not elsewhere | delete once | TC-CLOSE-045 |
| BR-02 | local head moved after merged head | refuse; retain | TC-CLOSE-046 |
| BR-03 | branch name is `main`, `main-tools`, the resolved base, or a declared protected ref; `HEAD` is protected through current-checkout/resolved-base contract data, never constructed as a branch name | never attempt; evidence | TC-CLOSE-047 |
| BR-04 | branch checked out in another worktree | refuse; zero action | TC-CLOSE-048 |
| BR-05 | no matching local branch | `satisfied` | TC-CLOSE-049 |
| BR-06 | >1 matching branch, no unique merged-head match | `closeout.target.ambiguous`; delete none | TC-CLOSE-050 |
| BR-07 | merged head unknown/absent | `closeout.branch.unsafe`; retain | TC-CLOSE-051 |
| BR-08 | a non-gap provider write failed earlier | restore still runs when safe; deletion skipped; retain; `closeout.write.failed` | TC-CLOSE-052 |
| BR-09 | restore refused (dirty worktree/missing base) | no deletion; `closeout.branch.unsafe` | TC-CLOSE-044 |
| BR-10 | unrelated checkout, no restore required | unrelated checkout untouched; deletion of a different branch still allowed | TC-CLOSE-043 + TC-CLOSE-045 |
| BR-11 | declared gap or no-op earlier in the transaction | does not block deletion | TC-CLOSE-045 (with a gap sibling) |
| BR-12 | already-deleted branch | `satisfied`; zero mutation | TC-CLOSE-049 |
| BR-13 | checkout detached at the delivery head, clean, base resolves | restore to resolved base; `applied` | TC-CLOSE-066 |
| BR-14 | checkout detached at the delivery head, dirty or base missing | refuse `closeout.branch.unsafe`; no deletion | TC-CLOSE-066 |

### 4.7 Outcome Vocabulary and Exit Oracle (binding for AC-F13-1, AC-F14-1, AC-F14-2)

| Condition | Identity | Category | Retryable | Consequence | Projection class | Exit | TC |
|---|---|---|---|---|---|---|---|
| Target work item explicitly not found | `closeout.target.unobserved` | user | false | not_landed | user-validation | 1 | TC-CLOSE-061, TC-CLOSE-067 |
| Malformed/unparsable provider payload | `provider.payload.invalid` (adapter-local class) | — | — | — | adapter-local, never a `closeout` row | — | TC-CLOSE-067 |
| More than one target matched | `closeout.target.ambiguous` | user | false | not_landed | user-validation | 1 | TC-CLOSE-050, TC-CLOSE-061 |
| A provider write did not land | `closeout.write.failed` | transient | true | unknown | platform-provider | 2 | TC-CLOSE-040, TC-CLOSE-052, TC-CLOSE-061 |
| Checkout/worktree/protected-ref/merged-head refusal | `closeout.branch.unsafe` | user | false | not_landed | user-validation | 1 | TC-CLOSE-044, TC-CLOSE-046, TC-CLOSE-051, TC-CLOSE-061 |
| Missing/malformed ref, extra positional, unknown flag | `input.value.rejected` / `fallback.invocation` | user | false | unknown | user-validation | 1 | TC-CLOSE-012 |
| Any success, including declared gaps and no-ops | — | — | — | — | success | 0 | TC-CLOSE-010, TC-CLOSE-059 |
| Unclassifiable failure / kind-only `closeout` | `fallback.internal` | platform | false | unknown | platform-provider | 2 | TC-CLOSE-005 |

Plan-mode outcomes: `would-apply`, `satisfied`, `skipped-gap`, `skipped-noop`, `would-refuse`. Apply-mode outcomes: `applied`, `satisfied`, `skipped-gap`, `skipped-noop`, `failed`, `refused`. Declared gaps and no-ops are never failures.

### 4.8 Prohibited Test Dependencies (explicit)

- **No live provider or credential.** No suite resolves a host, opens a socket, or reads a real token; provider behaviour is a committed fixture through an injected transport.
- **No real remote git operation.** The git seam never contacts a remote; the temporary repositories are local only and are removed per test.
- **No live-repository mutation.** Temp roots are the only writable filesystem in the battery; the live worktree, `dist/`, and the user's real state directory are never written.
- **No wall clock or ambient environment for correctness.** Time is `CLOSEOUT_NOW_MS`; ids are a fixed sequence; brand is injected. The optional non-CI reference measurement is recorded, never asserted.
- **No moving-base diff.** Every assertion reads the current tree, a committed fixture, a temp copy, or a temporary repo.
- **No real content in fixtures.** Committed fixtures contain synthetic refs, entity ids, labels, thread ids, outcomes, and small counts only. The single canary is fabricated and exists only to prove the no-leak boundary.

### 4.9 Grammar Rejection Matrix (binding for AC-F1-3)

| ID | Invocation (after `closeout`) | Expected identity | Exit | Source/runtime calls |
|---|---|---|---|---|
| G-01 | *(none)* | `input.value.rejected` | 1 | 0 |
| G-02 | `GH-183 extra` | `input.value.rejected` | 1 | 0 |
| G-03 | `not-a-ref` | `input.value.rejected` | 1 | 0 |
| G-04 | `gh-183` (lowercase prefix) | `input.value.rejected` | 1 | 0 |
| G-05 | `GH-183 --bogus` | `fallback.invocation` | 1 | 0 |
| G-06 | `GH-183 --apply false` (stray value) | `input.value.rejected` | 1 | 0 |
| G-07 | `GH-183 --apply --json` | success path | 0 | ≥ 1 (proves global `--json`) |
| G-08 | `GH-183 --apply --apply` (repeated boolean, last-wins) | success path | 0 | ≥ 1 |
| G-09 | `GH-183 extra1 extra2` (two-or-more extra positionals) | `fallback.invocation` | 1 | 0 |

The exact handler-versus-parser split follows the declared flag set; both classes exit 1 with zero I/O. The ref grammar is case-sensitive and performs no case folding: `gh-183` is rejected rather than canonicalized to `GH-183`. Exactly one extra positional passes the parser (`positionals: { max: 2 }`) and is rejected by the handler as `input.value.rejected`; two or more extra positionals exceed the parser bound and are rejected as `fallback.invocation` before the handler; an unknown flag is `fallback.invocation` before the handler (F-1, §8.1). A valid sibling invocation with no `--apply` must succeed and prove the rejection cases are not passing because the command is inert.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC |
|-------|-------|------|--------|----------|----|
| TC-CLOSE-001 | Contract vocabulary, order, disposition, protected set, data-only | Regression | Critical | High | AC-F2-2, AC-F5-1, AC-F10-3, NFR-2, NFR-9 |
| TC-CLOSE-002 | Additive contract extensions and conformance registry obligation | Contract | Critical | High | AC-F11-1, AC-F11-2, AC-F11-3, AC-F12-3, NFR-9 |
| TC-CLOSE-003 | Four closeout error identities round-trip | Regression | Critical | High | AC-F14-1 |
| TC-CLOSE-004 | Bidirectional documented-table sync and exit-literal invariant | Regression | Critical | High | AC-F14-2, NFR-11 |
| TC-CLOSE-005 | Kind-only containment and existing-kind regression | Regression | Critical | High | AC-F14-1 |
| TC-CLOSE-006 | `headSha` present/absent round-trip and refusal binding | Edge Case | Critical | High | AC-F12-3, AC-F10-7, DM-8 |
| TC-CLOSE-007 | Read-only command isolation: no import, spawn, or write | Regression | Critical | High | AC-F15-1, NFR-5 |
| TC-CLOSE-008 | Tier, purity, runtime confinement, allowlist unchanged | Regression | Critical | High | AC-F15-1, NFR-5, NFR-12 |
| TC-CLOSE-009 | Zero new runtime dependencies and license gate | Regression | Critical | High | AC-NFR10-1, NFR-10 |
| TC-CLOSE-010 | Dry-run plan: seven ordered steps, zero mutation | Happy Path | Critical | High | AC-F1-1, AC-F2-2, NFR-4 |
| TC-CLOSE-011 | Apply executes the same plan with per-operation outcomes | Happy Path | Critical | High | AC-F1-2, AC-F2-2, NFR-4 |
| TC-CLOSE-012 | Grammar rejection before any source read | Negative | Critical | High | AC-F1-3 |
| TC-CLOSE-013 | Byte-identical plan determinism under permuted inputs | Regression | Critical | High | AC-F2-1, NFR-2 |
| TC-CLOSE-014 | Deterministic operation expansion and identity distinctness | Happy Path | Critical | High | AC-F2-3, AC-F2-1, AC-F3-4, DM-9 |
| TC-CLOSE-015 | Re-run after restart reuses terminal outcomes | Regression | Critical | High | AC-F3-1, NFR-1 |
| TC-CLOSE-016 | Crash between effect and record converges as satisfied | Negative | Critical | High | AC-F3-2, NFR-1 |
| TC-CLOSE-017 | Failed outcome is retained and retried safely | Negative | Critical | High | AC-F3-3 |
| TC-CLOSE-018 | Operation identity SHA-256 algorithm, stability, and sensitivity | Contract | Critical | High | AC-F3-4, DM-9 |
| TC-CLOSE-019 | Ledger append/read, torn/malformed, fence, no schema bump | Regression | Critical | High | AC-NFR8-1, NFR-8, EVT-1 |
| TC-CLOSE-020 | Ticket-to-done apply (GitHub/Jira) | Happy Path | Critical | High | AC-F4-1 |
| TC-CLOSE-021 | Already-done ticket satisfied | Edge Case | Critical | High | AC-F4-2 |
| TC-CLOSE-022 | Missing done transition declared gap | Negative | Important | High | AC-F4-3, NFR-9 |
| TC-CLOSE-023 | Lifecycle label sweep applies the disposition table | Happy Path | Critical | High | AC-F5-1, DM-6 |
| TC-CLOSE-024 | Swept label set re-run satisfied | Regression | Critical | High | AC-F5-2 |
| TC-CLOSE-025 | Absent label signal skips without blind rewrite | Edge Case | Critical | High | AC-F5-3 |
| TC-CLOSE-026 | Jira full-array replace preserves unnamed labels | Happy Path | Critical | High | AC-F5-4, NFR-12 |
| TC-CLOSE-027 | Assigned item explicit clear applied | Happy Path | Critical | High | AC-F6-1, DM-5 |
| TC-CLOSE-028 | Absent assignee still schedules explicit clear | Edge Case | Critical | High | AC-F6-2 |
| TC-CLOSE-029 | Missing assignee-clear capability gap | Negative | Important | High | AC-F6-3, NFR-9 |
| TC-CLOSE-030 | Unassign re-run satisfied, no duplicate clear | Regression | Critical | High | AC-F6-4 |
| TC-CLOSE-031 | Eligible direct dependent flipped to hand-back | Happy Path | Critical | High | AC-F7-1 |
| TC-CLOSE-032 | Dependent with another open blocker not flipped | Negative | Critical | High | AC-F7-2 |
| TC-CLOSE-033 | Already hand-back satisfied; blocked removal | Edge Case | Important | High | AC-F7-3 |
| TC-CLOSE-034 | Unavailable relation signal skipped; asserted empty may flip | Negative | Critical | High | AC-F7-4, AC-F7-6, AC-F7-7 |
| TC-CLOSE-035 | Owed-flip cap, truncation, and progress | Edge Case | Critical | High | AC-F7-5, NFR-6 |
| TC-CLOSE-036 | No reverse-read surface is a provider-level gap | Negative | Important | High | AC-F7-6, NFR-9 |
| TC-CLOSE-037 | Unresolved review threads resolved once (GraphQL) | Happy Path | Critical | High | AC-F8-1, NFR-6 |
| TC-CLOSE-038 | No thread-resolution surface declared gap | Negative | Important | High | AC-F8-2, NFR-9 |
| TC-CLOSE-039 | No merged delivery request skipped-noop | Edge Case | Important | High | AC-F8-3 |
| TC-CLOSE-040 | Thread-resolution write failure and retry | Negative | Critical | High | AC-F8-4, AC-F3-3 |
| TC-CLOSE-041 | Checkout restore to resolved base | Happy Path | Critical | High | AC-F9-1, DM-7 |
| TC-CLOSE-042 | Checkout already on base satisfied | Edge Case | Important | High | AC-F9-2 |
| TC-CLOSE-043 | Unrelated checkout not hijacked | Edge Case | Critical | High | AC-F9-3 |
| TC-CLOSE-044 | Dirty worktree or missing base refusal | Negative | Critical | High | AC-F9-4 |
| TC-CLOSE-045 | Squash-safe deletion with matching merged head | Happy Path | Critical | High | AC-F10-1, NFR-13 |
| TC-CLOSE-046 | Moved branch head refused | Negative | Critical | High | AC-F10-2, NFR-13 |
| TC-CLOSE-047 | Protected refs never deleted | Negative | Critical | High | AC-F10-3, DM-7, NFR-13 |
| TC-CLOSE-048 | Foreign worktree refuses deletion | Negative | Critical | High | AC-F10-4, NFR-13 |
| TC-CLOSE-049 | Already-absent branch satisfied | Edge Case | Important | High | AC-F10-5 |
| TC-CLOSE-050 | Ambiguous local branch target | Negative | Critical | High | AC-F10-6 |
| TC-CLOSE-051 | Unknown merged head refuses deletion | Negative | Critical | High | AC-F10-7, DM-8, NFR-13 |
| TC-CLOSE-052 | Provider failure isolates local restore and retains branch | Negative | Critical | High | AC-F10-8, AC-F9-1 |
| TC-CLOSE-053 | GitHub capability declaration | Contract | Critical | High | AC-F11-1 |
| TC-CLOSE-054 | Jira capability declaration | Contract | Critical | High | AC-F11-2 |
| TC-CLOSE-055 | GitLab capability declaration | Contract | Critical | High | AC-F11-3 |
| TC-CLOSE-056 | Unsupported operation never reports success | Negative | Critical | High | AC-F11-4, NFR-9 |
| TC-CLOSE-057 | Merged-request deterministic selection | Edge Case | Critical | High | AC-F12-1, DM-8 |
| TC-CLOSE-058 | No lookup support: skips and integration-base fallback | Edge Case | Important | High | AC-F12-2 |
| TC-CLOSE-059 | Machine output bounded and leak-free | Regression | Critical | High | AC-F13-1, NFR-7, NFR-12 |
| TC-CLOSE-060 | Human output byte-identical and bounded | Regression | Critical | High | AC-F13-2, NFR-7 |
| TC-CLOSE-061 | Four closeout failure identities and exit projection | Regression | Critical | High | AC-F14-1, NFR-11 |
| TC-CLOSE-062 | Offline/hermetic proof and canary sweep | Regression | Critical | High | AC-NFR3-1, NFR-3, NFR-12 |
| TC-CLOSE-063 | Bounded transaction caps, timeouts, reference budget | Performance | Important | Medium | NFR-6 (AC-F7-5, AC-F8-1) |
| TC-CLOSE-064 | Non-vacuity meta-check: broken guards fail naming the case | Regression | Critical | High | §4.2 (all ACs) |
| TC-CLOSE-065 | Mock-conformance runtime coverage of the new supported writes | Regression | Critical | High | AC-F11-1, AC-F11-2, AC-F11-4, NFR-9 |
| TC-CLOSE-066 | Detached-HEAD restore and dirty/missing-base refusal | Edge Case | Critical | High | AC-F9-5, AC-F9-4, AC-F10-8 |
| TC-CLOSE-067 | Target not-found versus malformed-payload discrimination | Negative | Critical | High | AC-F4-4, AC-F4-3, AC-F14-1, DM-11 |

`TC-CLOSE-*` is a new prefix with no prior use in the repository, so no existing TC identifier is reused for a different scenario. TC-CLOSE-065..067 append after the original sequence; no existing ID is reassigned.

### 5.2 Scenario Details

#### TC-CLOSE-001 - Contract vocabulary, order, disposition, protected set, data-only

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, F-10, DM-1, DM-2, DM-3, DM-6, DM-7, AC-F2-2, AC-F5-1, AC-F10-3, NFR-2, NFR-9
**Test Type(s)**: Unit, Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/closeout-contract.test.ts`; `packages/core/src/contracts/closeout.ts`
**Tags**: @backend

**Preconditions**:

- The closeout contracts module exports the plan/step/operation/outcome types, the label disposition data, the protected-ref data, and the base-resolution rule.
- A TypeScript AST parser is available (the `tests/structure/status-contract.test.ts` pattern).

**Steps**:

1. Parse the contracts module and assert every top-level statement is a type alias, interface, `import type`, `export`, or an `as const` declaration; assert zero executable statements, zero calls, zero `new`.
2. Assert the seven step identities and their order exactly as §4.4; assert the plan/apply outcome and gap-reason vocabularies are closed and exact.
3. Assert the label disposition table is exactly §4.5 (six removals, `change` keep, `delivered` add, preserve all others).
4. Assert the protected-ref contract includes the resolved base, the integration base, `main`, `main-tools`, `HEAD`, and the declared protected set, and that the protected set always wins.
5. Assert the base-resolution rule is "merged target ref, else declared integration base (`main-tools`)" and that no clock, randomness, provider import, or I/O exists.
6. Run a temp copy with a seeded executable statement and a wrong disposition; assert each fails.

**Expected Outcome**:

- Contracts are declaration-only with the exact order, disposition, protected set, outcome vocabulary, and base rule.

**Notes / Clarifications**:

- Constant values are spec-fixed and may not be rebound; export names are delivery-bound except where the spec pins them.

#### TC-CLOSE-002 - Additive contract extensions and conformance registry obligation

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, F-12, DM-5, DM-8, AC-F11-1, AC-F11-2, AC-F11-3, AC-F12-3, NFR-9, TDR-0008
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/closeout-contract.test.ts`, `tests/structure/conformance-coverage.test.ts`; `packages/testkit/src/conformance/flows.ts`
**Tags**: @backend

**Preconditions**:

- `ADAPTER_OPERATIONS` is the closed set; `DeliveryRequest` is the primitive port; `CONFORMANCE_FLOWS` is the three-flow registry; the three `*_ADAPTER_CONTRACT` declarations exist.
- TDR-0008 is the recorded decision for both additive extensions.

**Steps**:

1. Assert `resolve-delivery-thread` is a member of `ADAPTER_OPERATIONS`; the set remains closed and duplicate-free.
2. Assert `DeliveryRequest.headSha` is optional (`?: string`); both shapes assign; no other field changed shape.
3. Assert the conformance flow registry's operation set equals `ADAPTER_OPERATIONS` exactly and a `resolve-delivery-thread` step exists.
4. Assert the flow/step-count assertion is updated deliberately; removing the new step fails naming the missing operation.
5. Assert each adapter's supported plus gap operations covers the closed set exactly with no duplicates and no implied parity; assert the GitHub/Jira/GitLab gap sets match spec Appendix B.
6. Assert no schema-version bump or migration is introduced.

**Expected Outcome**:

- Both additive extensions are present and governed; the conformance invariant is green; the capability matrix is exact; no schema bump.

**Notes / Clarifications**:

- This TC is the mechanical proof of TDR-0008's implementation-plan item 3 and the PM-notes obligation: the registry gains a step in the same change.
- TC-CLOSE-002 proves the registry/operation-set declaration; TC-CLOSE-065 proves the complementary runtime obligation that the newly supported writes actually execute in mock conformance.

#### TC-CLOSE-003 - Four closeout error identities round-trip

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, DM-10, AC-F14-1
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (update), `tests/behaviour/closeout-output.test.ts`
**Tags**: @backend

**Preconditions**:

- `DOMAIN_KINDS` includes `closeout`; `ERROR_TABLE` has exactly the four `closeout` rows; the trigger paths exist.

**Steps**:

1. Assert `closeout` is in `DOMAIN_KINDS` and exactly four rows carry it with the exact code, category, retryability, consequence, projection class, summary, and remediation hint from §4.7.
2. Drive each code through its trigger (unobserved target, ambiguous target, failed write, unsafe branch) and assert the classified failure is exactly that entry.
3. Assert `classifyDomainKind("closeout", CODE)` and `classifyThrown({ kind: "closeout", code: CODE })` return the same entry.
4. Assert each code round-trips through the envelope with matching fields and the documented exit.
5. Assert no new projection class was added and `provider` (the AI-model engine kind) was not overloaded.
6. Remove one row in a temp copy; assert its trigger test fails.

**Expected Outcome**:

- 4/4 exact identities, all fields matching, each reachable, no overload.

#### TC-CLOSE-004 - Bidirectional documented-table sync and exit-literal invariant

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, DM-10, AC-F14-2, NFR-11
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (update); `scripts/checks/error-table-sync.ts`; `scripts/checks/exit-code-literals.ts`; `doc/spec/features/feature-result-contract.md`
**Tags**: @backend

**Preconditions**:

- The four `closeout` rows are authored in the same change in the machine table and the documented table.

**Steps**:

1. Run the sync check on the delivered tree; assert green with non-zero source/documented/reference counts.
2. Assert each of the four codes appears exactly once in the documented table with matching fields.
3. Machine-direction mutations in a temp copy (remove a row; remove the kind) fail naming the offender.
4. Documentation-direction mutations (remove, add doc-only, alter a field, duplicate) fail.
5. Assert a missing/empty/unparseable table fails closed; the unchanged control stays green.
6. Run the exit-code-literal scan; assert zero literals outside the CLI projection and that a seeded literal fails.

**Expected Outcome**:

- 4/4 rows synchronize both ways; every drift fails with a named offender; exit literals stay at the CLI edge.

#### TC-CLOSE-005 - Kind-only containment and existing-kind regression

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, DM-10, AC-F14-1
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/error-classification.test.ts` (update), `tests/structure/error-table.test.ts`
**Tags**: @backend

**Preconditions**:

- Four `closeout` rows; existing `config`, `state`, `lint`, `input`, `verify`, `db`, and `provider` rows; a first-row-selecting control.

**Steps**:

1. Assert `classifyDomainKind("closeout")` without a code throws and `classifyThrown({ kind: "closeout" })` returns `fallback.internal`, never the first row.
2. Assert wrong-kind, unknown-code, missing-code, non-string, and mismatched-code cases contain via `fallback.internal`.
3. Assert exact-code lookup returns exactly that row for each of the four.
4. Assert every existing kind behaves unchanged (including `provider` still reserved for the AI-model engine).
5. Run the first-row-selecting control; assert the suite catches it.

**Expected Outcome**:

- Kind-only `closeout` is ambiguous and contained; bad codes contain; exact codes resolve; no existing kind regresses.

#### TC-CLOSE-006 - `headSha` present/absent round-trip and refusal binding

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-12, DM-8, AC-F12-3, AC-F10-7
**Test Type(s)**: Unit, Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/types/closeout-headsha.type-test.ts`, `tests/behaviour/closeout-request.test.ts`, `tests/behaviour/closeout-branch.test.ts`
**Tags**: @backend

**Preconditions**:

- A paired fixture: one merged request with a provider-resolved `headSha`, one without; GitHub/GitLab normalization fixtures; a local branch whose head equals the present value.

**Steps**:

1. Normalize the present fixture; assert `headSha` equals the fixture value verbatim (case and length preserved).
2. Normalize the absent fixture; assert `headSha` is absent/`undefined`, not `""`, `null`, or a derived commit.
3. Assert the type probe compiles both shapes and rejects a required-field assignment.
4. Apply with the present head and assert deletion; apply with the absent head and assert `closeout.branch.unsafe` and retention.
5. Run a temp mutant that derives `headSha` from the local head; assert the absent case fabricates a value and the test fails.

**Expected Outcome**:

- Present round-trips verbatim; absent stays unknown; deletion is bound to present equality.

#### TC-CLOSE-007 - Read-only command isolation: no import, spawn, or write

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-15, NFR-5, AC-F15-1
**Test Type(s)**: Static, Contract, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/closeout-imports.test.ts`, `tests/boundaries/**`; existing `status`, `queue-ready`, `verify` behaviour suites
**Tags**: @backend

**Preconditions**:

- The delivered read-only commands and their suites; the new closeout engine, provider write path, and git seam modules.

**Steps**:

1. Assert `status`, `queue ready`, and `verify change` import no closeout engine, no provider write module, and no git branch/checkout seam.
2. Assert their composition exposes no `spawn`/`execFile`/`child_process` member and their recorded runtime makes zero write/git calls in the existing suites.
3. Run the existing `status-*`, `queue-ready-*`, and `verify-*` suites unchanged; assert green.
4. Assert the boundary fixture-coverage meta-check passes and the new isolation rule has a failing fixture.
5. Plant a forbidden import and a `spawn` in a temp read-only module; assert the scan fails.

**Expected Outcome**:

- Read-only commands stay zero-write/zero-spawn and do not import the new write surfaces.

#### TC-CLOSE-008 - Tier, purity, runtime confinement, allowlist unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-15, NFR-5, NFR-12, AC-F15-1
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/closeout-imports.test.ts`, `tests/boundaries/**`; `.dependency-cruiser.cjs`; `scripts/checks/{ambient-globals,secret-read-boundary,workspace-entrypoints}.ts`
**Tags**: @backend

**Preconditions**:

- The dedicated git seam path and its exact runtime-confinement entry; the read-only repo adapter; the secret-read allowlist.

**Steps**:

1. Assert the git seam is admitted by exactly one exact-path, reason-bearing runtime-confinement entry and no rule admits the read-only repo reader to spawn.
2. Assert the read-only repo adapter is unchanged in its no-spawn/no-network surface and is not imported by the git seam.
3. Assert contracts and domain layers import no runtime API, no adapter, no clock, no `process`, no `fetch`.
4. Assert `SECRET_READ_ALLOWLIST.length` is unchanged; run the secret-read check.
5. Run `depcruise`, `ambient-globals`, and `workspace-entrypoints`; assert green with a non-empty scope.
6. Plant a spawn in the repo reader and a widened allowance; assert each fails.

**Expected Outcome**:

- The new git seam is the only spawn-capable addition; the read-only reader and contracts/domain tiers are unchanged; the allowlist does not grow.

#### TC-CLOSE-009 - Zero new runtime dependencies and license gate

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-10, AC-NFR10-1
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-*.test.ts`; `scripts/checks/license-audit.ts`; `scripts/checks/vulnerability-gate.ts`; root manifests
**Tags**: @backend

**Preconditions**:

- The baseline dependency set and license registry.

**Steps**:

1. Assert no `dependencies`/`devDependencies` entry was added and no new workspace package or subpath appears.
2. Run the license audit; assert the registry is unchanged and the gate is fail-closed.
3. Run the vulnerability gate; assert green.
4. Add a synthetic dependency in a temp copy; assert the audit fails.

**Expected Outcome**:

- 0 new runtime dependencies; registry unchanged; license and vulnerability gates green.

#### TC-CLOSE-010 - Dry-run plan: seven ordered steps, zero mutation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, DM-1, AC-F1-1, AC-F2-2, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-plan.test.ts`; `tests/fixtures/closeout/harness.ts`
**Tags**: @backend

**Preconditions**:

- A complete fixture: open item with lifecycle labels and an assignee; an eligible dependent; a merged request with unresolved threads; a clean delivery checkout; a squash-merged matching local branch.
- Recording provider, git, and state runtimes; fixed clock/run id.

**Steps**:

1. Run `closeout GH-183 --json` through the in-process composition.
2. Assert one success envelope with `data.schemaVersion: "delivery.closeout.v1"`, `mode: "plan"`, and the seven steps in order.
3. Assert plan outcomes come from the plan vocabulary and every operation has canonical arguments and a distinct identity.
4. Assert zero provider writes, zero git mutations, zero state appends, and zero fence acquisitions.
5. Assert the resolved base and selected delivery request are recorded.
6. Run the same fixture with `--apply` and assert it reaches `applied` (proves the dry-run assertions are not vacuous).

**Expected Outcome**:

- A visible, ordered, deterministic plan with zero mutation; apply is the only mutation path.

#### TC-CLOSE-011 - Apply executes the same plan with per-operation outcomes

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-2, AC-F2-2, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-plan.test.ts`
**Tags**: @backend

**Preconditions**:

- The TC-CLOSE-010 fixture and a writable fake provider/git/state.

**Steps**:

1. Run dry-run and capture the normalized plan (steps, arguments, identities, order).
2. Run `--apply` on the same fixture; capture the executed plan and outcomes.
3. Assert the ordered steps, canonical arguments, and identities are identical; only mode and outcomes differ.
4. Assert `mode: "applied"`, every operation has an apply outcome from the closed vocabulary, and the summary counts agree.
5. Assert each write is recorded exactly once and in order.

**Expected Outcome**:

- Apply executes exactly the plan it displayed; the per-operation summary is truthful.

#### TC-CLOSE-012 - Grammar rejection before any source read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-14, AC-F1-3
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-plan.test.ts`; grammar matrix §4.9
**Tags**: @backend

**Preconditions**:

- The composed program with recording runtimes; the grammar matrix.

**Steps**:

1. Run every G-01..G-06 and G-09 rejection case, including the one-extra handler case (G-02) and the two-or-more-extra parser case (G-09).
2. Assert the exact identity (`input.value.rejected` for G-02, `fallback.invocation` for G-05/G-09) and exit 1.
3. Assert zero provider, git, and state calls for every rejection.
4. Assert G-07 (`--apply --json`) and G-08 (`--apply --apply`) succeed and reach the runtime.
5. Run a valid plan-mode sibling and assert it succeeds.

**Expected Outcome**:

- Grammar is validated before I/O; rejection classes are exact at exit 1 with zero I/O; valid forms still work.

#### TC-CLOSE-013 - Byte-identical plan determinism under permuted inputs

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, NFR-2, AC-F2-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-plan.test.ts`
**Tags**: @backend

**Preconditions**:

- Fixed clock/run id; multiple labels, dependents, and threads; a fake whose response order can be permuted.

**Steps**:

1. Run the plan three times; byte-compare the serialized `data`.
2. Between runs, reverse the provider's label, dependent, and thread arrays and the persisted-history order; assert the plan is unchanged.
3. Assert every ordered list is sorted by its declared key (disposition, entity identity, thread identity), not response order.
4. Assert two different observed states produce different plans (non-vacuity).
5. Run a mutant that reads `Date.now()`/`Math.random()` or iterates a map; assert its output drifts and the test fails.

**Expected Outcome**:

- Identical inputs yield byte-identical plans; order is independent of provider response order.

#### TC-CLOSE-014 - Deterministic operation expansion and identity distinctness

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, DM-2, DM-9, AC-F2-3, AC-F2-1, AC-F3-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-plan.test.ts`
**Tags**: @backend

**Preconditions**:

- A step that expands to at least three lifecycle labels, two eligible dependents, and three unresolved threads.

**Steps**:

1. Compute the plan; assert label operations follow the disposition order, dependents by entity identity, threads by thread identity.
2. Assert every operation has a distinct `operationId` and canonical arguments matching its kind.
3. Add one label/dependent/thread; assert only that operation is added and existing identities are unchanged.
4. Vary one identity input (workspace, ref, engine, operation, argument, target); assert exactly that operation's identity changes.
5. Assert two operations differing only in target or arguments never collide.

**Expected Outcome**:

- Deterministic expansion with stable, distinct, input-sensitive identities.

#### TC-CLOSE-015 - Re-run after restart reuses terminal outcomes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, EVT-1, DM-4, AC-F3-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-idempotency.test.ts`; state harness
**Tags**: @backend

**Preconditions**:

- A completed apply with a populated ledger; a fresh composition over the same temp state store.

**Steps**:

1. Apply once; snapshot the fake provider/git call counts and the ledger.
2. Re-run `--apply` in a new composition over the same store.
3. Assert every terminal outcome is reused: zero new provider writes, zero git mutations, zero new terminal records.
4. Assert exit 0 and the summary equals the first run's terminal summary.
5. Run a mutant that ignores persisted outcomes; assert it issues duplicate calls and the test fails.

**Expected Outcome**:

- A restart converges with zero duplicate effects and exits 0.

#### TC-CLOSE-016 - Crash between effect and record converges as satisfied

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-idempotency.test.ts`
**Tags**: @backend

**Preconditions**:

- A fake provider where an effect lands but the ledger append is suppressed; the provider reports the satisfied state on re-read.

**Steps**:

1. Apply with the append suppressed after the effect.
2. Re-run; assert the engine re-observes provider state and records `satisfied`.
3. Assert zero duplicate provider write for the already-landed operation.
4. Assert the ledger now contains the terminal record and the summary reflects convergence.
5. Run a mutant that retries blindly; assert a second write is issued and the test fails.

**Expected Outcome**:

- A crash between effect and record is recoverable as `satisfied`, never a duplicate or a permanent failure.

#### TC-CLOSE-017 - Failed outcome is retained and retried safely

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-14, AC-F3-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-idempotency.test.ts`
**Tags**: @backend

**Preconditions**:

- A ledger with a persisted `failed` outcome; the provider fails the first write and succeeds the retry.

**Steps**:

1. Re-run; assert the failed record remains as evidence and is not terminal.
2. Assert the engine re-observes state and retries the operation.
3. Assert a terminal outcome is appended on success and the summary converges.
4. Assert no already-terminal operation is duplicated.
5. Run a mutant that treats `failed` as terminal; assert it never retries and the test fails.

**Expected Outcome**:

- Failed outcomes are evidence and retryable; the retry is safe and converges.

#### TC-CLOSE-018 - Operation identity SHA-256 algorithm, stability, and sensitivity

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-9, AC-F3-4
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-idempotency.test.ts`; pure identity function (`packages/core/src/domain/sha256.ts`, `deriveCloseoutOperationId`)
**Tags**: @backend

**Preconditions**:

- The pure `sha256Hex` and `deriveCloseoutOperationId` functions; a fixed canonical closeout identity tuple; a committed expected digest.

**Steps**:

1. Assert the SHA-256 known-answer vectors: `sha256Hex("")` is `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` and `sha256Hex("abc")` is `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
2. Derive `deriveCloseoutOperationId` for the fixed canonical closeout identity tuple; assert the committed 64-lowercase-hex expected digest.
3. Cross-check the pure implementation against a test-only `node:crypto` `createHash("sha256")` over parameterized inputs; the production module imports no `node:crypto`/`node:*`/`bun:*`.
4. Derive the identity 1 000 times; assert one value.
5. Change exactly one of workspace, ref, engine, operation, canonical arguments, and provider target per case; assert the identity changes each time.
6. Assert independence from clock, process, host, random, and map iteration order.
7. Assert a capability-context change (gap → supported) yields a new identity for the same operation, and record that this additive `capabilityContext` input is the DEC-7 refinement over the ADR-0003 inputs.
8. Run a FNV-1a mutant and an omitted-capability-context mutant; assert each fails the KAT/fixed-tuple/identity assertion and names the case. Also run a `Date.now()`/omitted-input mutant and assert it drifts or collides and fails.

**Expected Outcome**:

- The identity is a 64-lowercase-hex SHA-256 digest matching the KAT vectors and a fixed canonical closeout tuple; it is stable for identical inputs and sensitive to every declared input, including the capability context; FNV-1a, omitted-capability-context, clock/random, and omitted-input mutants fail.

#### TC-CLOSE-019 - Ledger append/read, torn/malformed, fence, no schema bump

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, EVT-1, DM-4, AC-NFR8-1, NFR-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-idempotency.test.ts`; `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Preconditions**:

- A temp state store; a fenced state port; torn-tail and malformed-record fixtures.

**Steps**:

1. Apply; assert exactly one `closeout.operation` record per terminal operation with the `delivery.closeout.operation.v1` payload keys.
2. Assert a verified read returns every record and the first terminal per `operationId` is authoritative.
3. Assert apply acquired and released the single-writer fence; plan acquired none.
4. Simulate a torn tail and a malformed record; assert a classified `state.*` error (never zeros) and no partial success.
5. Assert `STATE_SCHEMA_VERSION` is unchanged and no migration runs.
6. Run a failure-to-zero and a schema-bump mutant; assert each fails.

**Expected Outcome**:

- One append per terminal operation; verified reads; torn/malformed classified; fence discipline; no schema bump.

#### TC-CLOSE-020 - Ticket-to-done apply (GitHub/Jira)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-ticket-labels.test.ts`
**Tags**: @backend

**Preconditions**:

- An open GitHub item with a close mapping and an open Jira item with a data-driven done transition.

**Steps**:

1. Apply on GitHub; assert one `transition-work-item` call with `{ deliveryState: "done" }` and outcome `applied`.
2. Apply on Jira; assert the data-driven transition is used and outcome `applied`.
3. Assert the recorded request names the correct provider target.
4. Assert the fixture item state is updated.

**Expected Outcome**:

- The primary closeout outcome lands on both write providers.

#### TC-CLOSE-021 - Already-done ticket satisfied

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-ticket-labels.test.ts`
**Tags**: @backend

**Preconditions**:

- Already-done GitHub/Jira fixtures.

**Steps**:

1. Plan; assert the step is `satisfied`.
2. Apply; assert `satisfied`, zero transition call, exit 0.
3. Run a mutant that writes on a done item; assert the suite fails.

**Expected Outcome**:

- Already-done converges with zero write.

#### TC-CLOSE-022 - Missing done transition declared gap

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, F-11, AC-F4-3, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-ticket-labels.test.ts`
**Tags**: @backend

**Preconditions**:

- A provider/adapter with no done mapping or no transition capability.

**Steps**:

1. Plan and apply; assert `skipped-gap` with a valid reason.
2. Assert the remaining steps still run and the transaction exits 0.
3. Assert the gap is never `applied`/`satisfied`.
4. Include a supported sibling that is `applied`.

**Expected Outcome**:

- A missing transition is a first-class gap, not a failure and not a success claim.

#### TC-CLOSE-023 - Lifecycle label sweep applies the disposition table

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-6, AC-F5-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-ticket-labels.test.ts`
**Tags**: @backend

**Preconditions**:

- A provider-asserted label set containing all six lifecycle labels, `change`, `delivered` absent, and a vendor label.

**Steps**:

1. Apply; inspect the recorded label operations and final target set.
2. Assert `planning`, `spec-ready`, `readiness-passed`, `in-progress`, `review`, and `blocked` are removed.
3. Assert `change` and the vendor label are retained; `delivered` is added.
4. Assert operation order follows the disposition table.
5. Run a mutant that removes `change` or preserves a lifecycle label; assert it fails.

**Expected Outcome**:

- The bounded sweep is exact and preserves type/non-lifecycle labels.

#### TC-CLOSE-024 - Swept label set re-run satisfied

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-ticket-labels.test.ts`
**Tags**: @backend

**Preconditions**:

- An already-swept set (`change` + `delivered` + vendor label).

**Steps**:

1. Apply; assert every sweep outcome is `satisfied` and zero label write.
2. Apply again; assert identical zero-write result.
3. Run a mutant that re-adds/removes; assert it fails.

**Expected Outcome**:

- A swept set converges with zero write.

#### TC-CLOSE-025 - Absent label signal skips without blind rewrite

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-6, AC-F5-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-ticket-labels.test.ts`
**Tags**: @backend

**Preconditions**:

- A provider response with no label signal (unknown), plus a present-label sibling.

**Steps**:

1. Plan and apply; assert `skipped-noop` with `label-signal-unavailable`.
2. Assert zero removal or replacement write.
3. Assert the present-label sibling performs the sweep.
4. Run a mutant that treats absence as an empty set and rewrites; assert it fails.

**Expected Outcome**:

- Unknown label state never drives a blind write.

#### TC-CLOSE-026 - Jira full-array replace preserves unnamed labels

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-11, NFR-12, AC-F5-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-ticket-labels.test.ts`; Jira `labels-replace-{before,after}` fixtures
**Tags**: @backend

**Preconditions**:

- The Jira trap fixture pair with lifecycle labels, `change`, and a vendor/custom label.

**Steps**:

1. Apply the sweep on the Jira fixture.
2. Assert the full-array replace request contains exactly the provider-asserted labels minus the six plus `delivered`.
3. Assert `change` and the vendor label are preserved; no unnamed label is dropped.
4. Assert the after-fixture equals the expected target set.
5. Run a mutant that overwrites with only the lifecycle target labels; assert the vendor label disappears and the test fails.

**Expected Outcome**:

- Jira's replace trap preserves every unnamed label.

#### TC-CLOSE-027 - Assigned item explicit clear applied

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, DM-5, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-unassign.test.ts`
**Tags**: @backend

**Preconditions**:

- Assigned GitHub and Jira fixtures.

**Steps**:

1. Apply; assert one explicit clear call with canonical `{ assignee: "none" }`.
2. Assert the outcome is `applied`.
3. Assert the provider-specific clear (GitHub none, Jira cleared) is used.
4. Assert an absent-assignee sibling still schedules a clear (TC-028).

**Expected Outcome**:

- The clear is explicit and applied.

#### TC-CLOSE-028 - Absent assignee still schedules explicit clear

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, DM-5, AC-F6-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-unassign.test.ts`
**Tags**: @backend

**Preconditions**:

- A fixture whose `assignee` is absent (unknown) rather than confirmed empty.

**Steps**:

1. Plan; assert an explicit clear intent is present (never "already unassigned").
2. Apply; assert a clear write is issued.
3. Run a mutant that maps absence to "already unassigned" and issues no write; assert it fails.

**Expected Outcome**:

- Absence is unknown, not empty; the clear is always explicit.

#### TC-CLOSE-029 - Missing assignee-clear capability gap

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, F-11, AC-F6-3, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-unassign.test.ts`
**Tags**: @backend

**Preconditions**:

- A provider without an assignee-clear capability; a supporting sibling.

**Steps**:

1. Plan and apply; assert `skipped-gap` with a valid reason.
2. Assert the transaction continues and exits 0.
3. Assert the supporting sibling applies a clear.

**Expected Outcome**:

- An unsupported clear is a visible gap.

#### TC-CLOSE-030 - Unassign re-run satisfied, no duplicate clear

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-3, AC-F6-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-unassign.test.ts`
**Tags**: @backend

**Preconditions**:

- A prior terminal unassign outcome, and a fixture where the provider asserts the assignee is absent after the clear.

**Steps**:

1. Re-run; assert `satisfied` and zero duplicate clear.
2. Assert the terminal record is reused.
3. Run a mutant that re-clears; assert it fails.

**Expected Outcome**:

- The unassign converges with no duplicate.

#### TC-CLOSE-031 - Eligible direct dependent flipped to hand-back

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-owed-flip.test.ts`
**Tags**: @backend

**Preconditions**:

- An open direct dependent whose `blocked-by` set becomes fully done/canceled by this closeout; it carries `blocked`; a still-blocked sibling exists.

**Steps**:

1. Apply; assert one `write-work-item` call with `{ add: ["hand-back"], remove: ["blocked"] }`.
2. Assert the flip is recorded in the ledger and output.
3. Assert the still-blocked sibling is not flipped.
4. Assert the flip is excluded on the next run.

**Expected Outcome**:

- The eligible dependent learns it owes the next action; the flip is recorded.

#### TC-CLOSE-032 - Dependent with another open blocker not flipped

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-owed-flip.test.ts`
**Tags**: @backend

**Preconditions**:

- A dependent with this item done plus one still-open blocker.

**Steps**:

1. Apply; assert no flip write.
2. Assert the evidence names the open-blocker count.
3. Assert the eligible sibling flips.

**Expected Outcome**:

- A partially unblocked dependent is not flipped, with truthful evidence.

#### TC-CLOSE-033 - Already hand-back satisfied; blocked removal

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-owed-flip.test.ts`
**Tags**: @backend

**Preconditions**:

- Dependent A: `hand-back` present, `blocked` absent. Dependent B: `hand-back` and `blocked` both present.

**Steps**:

1. Apply; assert A is `satisfied` with zero write.
2. Assert B gets a removal operation for `blocked` only (no duplicate `hand-back`).
3. Run a mutant that re-adds `hand-back`; assert it fails.

**Expected Outcome**:

- Already-flipped converges; a lingering `blocked` is removed.

#### TC-CLOSE-034 - Unavailable relation signal skipped; asserted empty may flip

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, DM-11, AC-F7-4, AC-F7-6, AC-F7-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-owed-flip.test.ts`
**Tags**: @backend

**Preconditions**:

- Three candidates in one fixture: (A) relation signal `unavailable`/unknown, (B) relation signal provider-asserted and empty (`observed`, `relations: []`), (C) known-done blocker with a fully satisfied set.
- A fourth case: a provider that supports the reverse-read surface but whose current reverse-dependent read is unavailable.

**Steps**:

1. Apply; assert candidate A is `skipped-noop` with `relation-signal-unavailable` evidence and no `write-work-item` call, not `skipped-gap`.
2. Assert candidate B is evaluated with no blockers and is eligible to flip; assert the empty array was accepted only because its observation is `observed`.
3. Assert candidate C flips (`hand-back` added, `blocked` removed).
4. Apply the supported-surface-but-current-read-unavailable case; assert the owed-flip step is `skipped-noop` with `relation-signal-unavailable` and no flip.
5. Run a mutant that treats an unasserted `[]` as "no blockers" or unknown as done; assert it flips and the test fails.
6. Assert the evidence distinguishes a signal-level skip from a provider-level gap (`skipped-noop` versus `skipped-gap`).

**Expected Outcome**:

- Unknown/unavailable is never satisfied and never flipped; a provider-asserted empty relation is the only "no blockers" reading; the skip is a signal-level no-op with evidence.

#### TC-CLOSE-035 - Owed-flip cap, truncation, and progress

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, NFR-6, DEC-16, AC-F7-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-owed-flip.test.ts`
**Tags**: @backend @perf

**Preconditions**:

- Dependent fixtures with exactly 200, 201, and a larger set; deterministic entity identities.

**Steps**:

1. Apply with 201 dependents; assert exactly 200 are processed in entity-identity order, `truncated: true`, and the omitted count is 1.
2. Apply with exactly 200; assert no truncation.
3. Re-run the 201 fixture after the first batch already carries `hand-back`; assert the remaining eligible set is processed and progress is made.
4. Assert already-flipped candidates are excluded, not re-flipped.
5. Run a mutant that scans unbounded or drops the truncation marker; assert the test fails.

**Expected Outcome**:

- The sweep is bounded, deterministic, truncation-truthful, and convergent across runs.

#### TC-CLOSE-036 - No reverse-read surface is a provider-level gap

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, F-11, AC-F7-6, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-owed-flip.test.ts`
**Tags**: @backend

**Preconditions**:

- A provider runtime with no reverse-dependent read surface (e.g. GitLab with no work-item read, or a provider whose bounded reverse query is not implemented) — the provider-level gap case; a capable sibling with an observed surface.
- GitHub's reverse-dependent query (`listBlockedByDependents` / issue-dependencies) is treated as an **implementation-confirmed assumption** (A-T8), not verified current truth; its exact response shape is fixture-pinned.

**Steps**:

1. Plan and apply; assert `skipped-gap` with `provider-unsupported`.
2. Assert the transaction continues and exits 0.
3. Assert the capable sibling flips an eligible dependent.
4. Assert this case is not conflated with the existing-surface-but-unavailable case: when the surface exists (including GitHub, per A-T8) but the current read is unavailable, the step is `skipped-noop` with `relation-signal-unavailable` and is asserted by TC-CLOSE-034; only an absent surface is the provider-level gap.

**Expected Outcome**:

- A provider with no reverse-read surface is a declared provider-level gap, never a silent no-flip claim and never a signal-level skip; a present-but-unavailable GitHub read remains the signal-level `skipped-noop` case, not a provider-level gap.

#### TC-CLOSE-037 - Unresolved review threads resolved once (GraphQL)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-12, AC-F8-1, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-threads.test.ts`; GitHub `resolveReviewThread` GraphQL fixture
**Tags**: @backend

**Preconditions**:

- A merged request with three unresolved threads and one already-resolved thread; the injected GraphQL fixture; a cap fixture with 100/101 unresolved threads.

**Steps**:

1. Apply; assert one `resolve-delivery-thread` call per unresolved thread with `{ deliveryRequest, threadId }`.
2. Assert the already-resolved thread is `satisfied` with zero write.
3. Assert outcomes and the ledger record each thread.
4. Run a second time; assert all are `satisfied` (no duplicate resolution).
5. Apply the 101-thread fixture; assert the 100 cap, truncation marker, and a re-run progress.

**Expected Outcome**:

- Each unresolved thread is resolved once; already-resolved is satisfied; the cap is honoured.

#### TC-CLOSE-038 - No thread-resolution surface declared gap

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, F-11, AC-F8-2, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-threads.test.ts`
**Tags**: @backend

**Preconditions**:

- A Jira provider fixture with no delivery-request/thread-resolution surface; a GitHub sibling.

**Steps**:

1. Plan and apply; assert `skipped-gap` with `provider-unsupported`.
2. Assert exit 0 and the transaction continues.
3. Assert the GitHub sibling resolves.

**Expected Outcome**:

- A missing thread surface is a declared gap, not a failure or a success claim.

#### TC-CLOSE-039 - No merged delivery request skipped-noop

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-threads.test.ts`
**Tags**: @backend

**Preconditions**:

- No merged delivery request; a present-request sibling.

**Steps**:

1. Plan and apply; assert `skipped-noop` with `no-delivery-request`.
2. Assert it is not an error and exits 0.
3. Assert the present-request sibling resolves threads.

**Expected Outcome**:

- A missing merged request is a no-op with evidence, not a failure.

#### TC-CLOSE-040 - Thread-resolution write failure and retry

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-14, AC-F8-4, AC-F3-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-threads.test.ts`
**Tags**: @backend

**Preconditions**:

- A merged request with three threads; the second resolution fails; completed outcomes persist.

**Steps**:

1. Apply; assert `closeout.write.failed`, transient, retryable, consequence `unknown`, projection `platform-provider`, exit 2.
2. Assert completed resolutions are persisted and the failed operation is recorded.
3. Assert the remaining provider steps stop, local restore still runs, and branch deletion is skipped.
4. Re-run; assert the failed operation is re-observed, retried, and converges; the failed record remains as evidence.
5. Run a success-on-partial mutant; assert it fails.

**Expected Outcome**:

- The failure is classified and truthful; completed work is not lost; the retry converges.

#### TC-CLOSE-041 - Checkout restore to resolved base

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, DM-7, AC-F9-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-checkout.test.ts`; temporary local git repository
**Tags**: @backend

**Preconditions**:

- A temp repo with `main-tools` and the delivery branch checked out; a merged request whose `targetRef` is the base; a clean worktree.

**Steps**:

1. Apply; assert one `restoreCheckout` call to the merged target ref.
2. Assert the checkout is on the base and the outcome is `applied`.
3. Run the same fixture without a merged request; assert the fallback base is `main-tools`.
4. Assert the resolved base is recorded in the plan and output.
5. Run a clean sibling that is already on the base (TC-042) and assert it is `satisfied`.

**Expected Outcome**:

- A clean delivery checkout is restored to the most truthful base.

#### TC-CLOSE-042 - Checkout already on base satisfied

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, AC-F9-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-checkout.test.ts`
**Tags**: @backend

**Preconditions**:

- A temp repo already checked out on the resolved base.

**Steps**:

1. Apply; assert `satisfied` and zero `restoreCheckout` call.
2. Assert the rest of the transaction still runs.
3. Run a switch-anyway mutant; assert it fails.

**Expected Outcome**:

- Already-on-base converges with zero switch.

#### TC-CLOSE-043 - Unrelated checkout not hijacked

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-checkout.test.ts`
**Tags**: @backend

**Preconditions**:

- A temp repo checked out on an unrelated feature branch; a different local delivery branch exists.

**Steps**:

1. Apply; assert `satisfied` with `already-elsewhere`, zero switch.
2. Assert the unrelated checkout is untouched.
3. Assert deletion of the different delivery branch is not blocked by the unrelated checkout.
4. Run a hijacking mutant; assert it switches and the test fails.

**Expected Outcome**:

- Closeout never hijacks an unrelated checkout.

#### TC-CLOSE-044 - Dirty worktree or missing base refusal

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-10, F-14, AC-F9-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-checkout.test.ts`
**Tags**: @backend

**Preconditions**:

- Case A: dirty worktree on the delivery branch. Case B: clean worktree but the base ref does not resolve locally.

**Steps**:

1. Apply each case; assert restore refuses and no switch occurs.
2. Assert no branch is deleted and the branch is retained.
3. Assert `closeout.branch.unsafe`, user, non-retryable, `not_landed`, exit 1.
4. Assert a clean, resolvable-base sibling restores.
5. Clean the worktree and re-run; assert completed outcomes are reused and the restore completes.

**Expected Outcome**:

- Unsafe restore states refuse with zero destructive action and a classified identity.

#### TC-CLOSE-045 - Squash-safe deletion with matching merged head

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, NFR-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-branch.test.ts`; temporary local git repository
**Tags**: @backend

**Preconditions**:

- A temp repo with the local branch `<type>/GH-183/<slug>`; the merged request's `headSha` equals the local head; no remote is configured; checkout restored first.

**Steps**:

1. Apply; assert exactly one local branch deletion of the matching branch.
2. Assert zero fetch, push, remote-branch delete, force-update, or history rewrite.
3. Assert the branch is gone and the outcome is `applied`.
4. Assert a declared-gap sibling and a no-op sibling earlier in the transaction do not block the deletion.
5. Run a moved-head sibling (TC-046) and assert it refuses.

**Expected Outcome**:

- The squash-safe predicate proves the work landed and deletes exactly one local branch.

#### TC-CLOSE-046 - Moved branch head refused

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-14, AC-F10-2, NFR-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-branch.test.ts`
**Tags**: @backend

**Preconditions**:

- A local branch whose head moved after the merged head (new unmerged commit).

**Steps**:

1. Apply; assert deletion is refused and the branch is retained with its head unchanged.
2. Assert `closeout.branch.unsafe`, exit 1.
3. Assert a matching-head sibling deletes.
4. Run a force-delete mutant; assert it deletes the moved branch and the test fails.

**Expected Outcome**:

- A branch with new work is never deleted.

#### TC-CLOSE-047 - Protected refs never deleted

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-7, AC-F10-3, NFR-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-branch.test.ts`
**Tags**: @backend

**Preconditions**:

- A repo where the matching branch name equals each branch-name protected ref in turn (`main`, `main-tools`, the resolved base, a declared protected ref).
- `HEAD` is not constructed as a branch name (impossible in git). Instead, `HEAD` protection is asserted through the resolved-base/current-checkout contract data and the branch-cleanup predicate that refuses to delete the current checkout.

**Steps**:

1. Plan and apply each branch-name case; assert no deletion is attempted.
2. Assert the protected state is recorded as evidence.
3. Assert the contract data marks `HEAD` protected and the cleanup predicate refuses to delete a branch that is the current checkout (or the resolved base) without constructing a branch named `HEAD`.
4. Assert a non-protected sibling branch is eligible and deleted.
5. Run a protected-set-bypass mutant; assert it deletes and the test fails.

**Expected Outcome**:

- The protected set always wins; `HEAD` is protected by checkout/base logic and contract data, not by an impossible branch name; no destructive action occurs.

#### TC-CLOSE-048 - Foreign worktree refuses deletion

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-4, NFR-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-branch.test.ts`; second temp worktree
**Tags**: @backend

**Preconditions**:

- The matching branch is checked out in a second `git worktree` root.

**Steps**:

1. Apply; assert deletion is refused with evidence naming the foreign worktree.
2. Assert zero destructive action and the branch retained.
3. Remove the second worktree and re-run; assert the deletion may now proceed.
4. Run a worktree-blind mutant; assert it deletes and the test fails.

**Expected Outcome**:

- A branch checked out elsewhere is never deleted.

#### TC-CLOSE-049 - Already-absent branch satisfied

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-10, AC-F10-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-branch.test.ts`
**Tags**: @backend

**Preconditions**:

- No matching local branch; a present-branch sibling.

**Steps**:

1. Apply; assert `satisfied` with `no-branch` evidence and zero mutation.
2. Assert the present-branch sibling deletes.
3. Run a mutant that errors on absence; assert it fails.

**Expected Outcome**:

- An already-deleted branch converges with zero mutation.

#### TC-CLOSE-050 - Ambiguous local branch target

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-14, AC-F10-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-branch.test.ts`
**Tags**: @backend

**Preconditions**:

- Two local branches matching the work item; neither head uniquely equals the merged head.

**Steps**:

1. Apply; assert `closeout.target.ambiguous`, user, non-retryable, `not_landed`, exit 1.
2. Assert zero branches are deleted.
3. Add a unique merged-head match; assert exactly the right branch is deleted.
4. Run a first-match mutant; assert it deletes the wrong branch and the test fails.

**Expected Outcome**:

- Ambiguity refuses; a unique match resolves deterministically.

#### TC-CLOSE-051 - Unknown merged head refuses deletion

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-8, AC-F10-7, NFR-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-branch.test.ts`
**Tags**: @backend

**Preconditions**:

- A merged request whose `headSha` is absent (unknown); a present-head sibling.

**Steps**:

1. Apply; assert `closeout.branch.unsafe`, `not_landed`, exit 1, and the branch retained.
2. Assert no ancestry/guess fallback is attempted.
3. Assert the present-head sibling deletes.
4. Run a deriving mutant; assert it fabricates a head and the test fails.

**Expected Outcome**:

- An unknown merged head refuses rather than guesses.

#### TC-CLOSE-052 - Provider failure isolates local restore and retains branch

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-10, F-14, AC-F10-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-branch.test.ts`
**Tags**: @backend

**Preconditions**:

- A clean delivery checkout; a provider write fails after some operations completed; the branch is otherwise eligible.

**Steps**:

1. Apply; assert completed outcomes are persisted and the failed operation is recorded.
2. Assert the local checkout restore still runs when safe.
3. Assert branch deletion is skipped and the branch is retained.
4. Assert `closeout.write.failed`, transient, retryable, exit 2.
5. Heal the provider and re-run; assert completed outcomes are reused and the branch is then deleted.

**Expected Outcome**:

- A provider failure never strands the checkout or deletes the branch; the retry converges.

#### TC-CLOSE-053 - GitHub capability declaration

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, DM-5, AC-F11-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capabilities.test.ts`; `GITHUB_ADAPTER_CONTRACT`
**Tags**: @backend

**Preconditions**:

- The GitHub declaration and a planned closeout operation set.

**Steps**:

1. Assert `supportedOperations` contains `read-work-item`, `read-delivery-request`, `read-pipeline-run`, `write-work-item`, `transition-work-item`, `resolve-delivery-thread`.
2. Assert `write-comment` and `write-delivery-request` are declared gaps with `adapter-not-implemented`.
3. Assert no operation is both supported and gapped; assert the set plus gaps covers the closed set.
4. Apply a planned supported operation and assert it executes; assert a gapped operation is `skipped-gap`.
5. Run a claimed-but-unsupported mutant; assert it fails.

**Expected Outcome**:

- GitHub's declaration is exact and its gaps are honest.

#### TC-CLOSE-054 - Jira capability declaration

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, DM-5, AC-F11-2
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capabilities.test.ts`; `JIRA_ADAPTER_CONTRACT`
**Tags**: @backend

**Preconditions**:

- The Jira declaration and a planned closeout operation set.

**Steps**:

1. Assert `supportedOperations` contains `read-work-item`, `write-work-item`, `transition-work-item`.
2. Assert the five gaps: `write-comment`, `read-delivery-request`, `write-delivery-request`, `read-pipeline-run` (`provider-unsupported`), `resolve-delivery-thread` (`provider-unsupported`).
3. Assert no operation is both supported and gapped; assert full coverage.
4. Apply a supported operation and assert it executes; assert a gap is `skipped-gap`.
5. Run a missing-gap mutant; assert it fails.

**Expected Outcome**:

- Jira's declaration is exact and its gaps are honest.

#### TC-CLOSE-055 - GitLab capability declaration

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capabilities.test.ts`; `GITLAB_ADAPTER_CONTRACT`
**Tags**: @backend

**Preconditions**:

- The GitLab declaration and a planned closeout operation set.

**Steps**:

1. Assert `supportedOperations` is exactly `read-delivery-request` and `read-pipeline-run`.
2. Assert `read-work-item` and every write, including `resolve-delivery-thread`, are declared gaps with `adapter-not-implemented`.
3. Assert full coverage and no implied parity.
4. Apply a GitLab closeout plan; assert the provider steps are `skipped-gap` and only local checkout/branch steps run.
5. Run a claimed-GitLab-write mutant; assert it fails.

**Expected Outcome**:

- GitLab declares no write parity and only its two reads.

#### TC-CLOSE-056 - Unsupported operation never reports success

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, NFR-9, AC-F11-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capabilities.test.ts`
**Tags**: @backend

**Preconditions**:

- A plan containing an unsupported operation; a supported sibling in the same run.

**Steps**:

1. Render the plan; assert the unsupported operation is `skipped-gap` with a valid reason.
2. Apply; assert it is never `applied` or `satisfied`, is present in the gap list, and does not fail the transaction (exit 0).
3. Assert the supported sibling is `applied`.
4. Run a success-claiming mutant; assert it fails.

**Expected Outcome**:

- Gaps are first-class non-success outcomes; the transaction continues.

#### TC-CLOSE-057 - Merged-request deterministic selection

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, DM-8, AC-F12-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-request.test.ts`
**Tags**: @backend

**Preconditions**:

- Two merged requests with numeric identities `42` and `7`; a non-numeric pair; a fake that returns them in shuffled order.

**Steps**:

1. Resolve the target; assert `42` is selected regardless of return order.
2. Assert the selection is recorded in the plan/output.
3. Assert a non-numeric pair compares lexically.
4. Assert the lookup is bounded to merged requests whose source ref follows the branch convention.
5. Run a first-return-order mutant; assert it selects the wrong request and the test fails.

**Expected Outcome**:

- Selection is deterministic by highest numeric entity identity; API order never decides.

#### TC-CLOSE-058 - No lookup support: skips and integration-base fallback

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-12, AC-F12-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-request.test.ts`
**Tags**: @backend

**Preconditions**:

- A provider without merged-request lookup support; a lookup-capable sibling.

**Steps**:

1. Plan and apply; assert delivery-request-dependent steps skip with evidence.
2. Assert the base falls back to `main-tools`.
3. Assert the lookup-capable sibling selects the merged target.
4. Assert no lookup-related failure is raised.

**Expected Outcome**:

- Missing lookup is a safe skip plus integration-base fallback, not a failure.

#### TC-CLOSE-059 - Machine output bounded and leak-free

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, NFR-7, NFR-12, AC-F13-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-output.test.ts`, `tests/golden/closeout-envelope.test.ts`
**Tags**: @backend

**Preconditions**:

- An envelope fixture for every mode/outcome class; a planted canary in forbidden-shaped fixture fields (comment body, title, raw payload, credential, environment value).

**Steps**:

1. Assert the planted canary is present in the fixture input before the run.
2. Run plan and apply; parse exactly one `CommandResult` envelope with `data.schemaVersion: "delivery.closeout.v1"`.
3. Assert the data key set is the documented bounded shape (command, ref, mode, base, delivery-request summary, steps/operations/outcomes, summary counts, gaps, truncation, ledger key).
4. Assert the serialized `data` is ≤ 65 536 bytes and truncation markers are deterministic.
5. Walk stdout, stderr, parsed envelope, and ledger records; assert zero canary/forbidden-field occurrences and no extra keys.
6. Run a wide-projection mutant; assert it leaks and the test fails.

**Expected Outcome**:

- One bounded, deterministic, leak-free machine envelope.

#### TC-CLOSE-060 - Human output byte-identical and bounded

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, NFR-7, AC-F13-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-output.test.ts`, `tests/golden/closeout-human.test.ts` + goldens
**Tags**: @backend

**Preconditions**:

- Fixed clock/run id; committed normalized goldens; a maximal fixture.

**Steps**:

1. Render human output twice; assert byte equality and equality to the golden.
2. Assert ≤ 200 lines and ≤ 16 384 bytes, with deterministic truncation markers.
3. Assert the human digest is rendered from the same data and performs zero extra provider/git reads.
4. Assert no comment body, title, raw payload, credential, environment value, or command argument appears.
5. Run a `Date.now()` renderer and an over-cap renderer; assert each fails.

**Expected Outcome**:

- Human output is deterministic, bounded, and derived from the same data.

#### TC-CLOSE-061 - Four closeout failure identities and exit projection

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, NFR-11, AC-F14-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-output.test.ts`
**Tags**: @backend

**Preconditions**:

- A trigger fixture for each of `closeout.target.unobserved`, `closeout.target.ambiguous`, `closeout.write.failed`, `closeout.branch.unsafe`.

**Steps**:

1. Emit each identity; assert code, category, retryable, consequence, projection class, summary, and remediation hint match the table.
2. Assert `user-validation` exits 1 and `platform-provider` exits 2; success exits 0.
3. Assert the error envelope has no `data` and the success envelope has no `error`.
4. Assert no exit literal appears outside the CLI projection.
5. Run a wrong-projection and a literal-in-command mutant; assert each fails.

**Expected Outcome**:

- Every closeout failure is one classified identity with the documented exit.

#### TC-CLOSE-062 - Offline/hermetic proof and canary sweep

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3, NFR-12, AC-NFR3-1
**Test Type(s)**: Static, Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-hermetic.test.ts`, `tests/checks/fixture-sanitization.test.ts`, `tests/structure/closeout-imports.test.ts`
**Tags**: @backend

**Preconditions**:

- The closeout suites and fixtures; the fixture-sanitization harness; the secret-read allowlist; a network/fetch throwing guard.

**Steps**:

1. Assert the closeout fixtures contain synthetic ids/refs/labels/threads only and are accepted by the sanitization guard.
2. Install a throwing fetch/network guard and run the suites; assert no network call and no credential read.
3. Scan the suites for real-home paths, ambient environment reads, and spawned processes; assert zero and a non-empty scope.
4. Assert the secret-read allowlist is unchanged and the forbidden-literal scanner is green.
5. Plant a live fetch, a credential read, and a real-home path; assert each is caught.

**Expected Outcome**:

- The battery is offline, sanitized, and free of host-state dependence.

#### TC-CLOSE-063 - Bounded transaction caps, timeouts, reference budget

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-6, AC-F7-5, AC-F8-1
**Test Type(s)**: Performance, Contract, Manual (optional reference measurement)
**Automation Level**: Automated (bounded work); Manual (optional non-CI reference)
**Target Layer / Location**: `tests/behaviour/closeout-owed-flip.test.ts`, `tests/behaviour/closeout-threads.test.ts`, `tests/structure/closeout-contract.test.ts`
**Tags**: @backend @perf

**Preconditions**:

- Cap fixtures (200/201 dependents, 100/101 threads); recording call logs; the declared timeout constants.
- A never-resolving provider transport and a non-terminating git child, each driven through the short injected timeout override (`request.timeoutMs` / `GitBranchSeamOptions.timeoutMs`), never the 30 000 ms production default.

**Steps**:

1. Structural: assert `CLOSEOUT_OPERATION_TIMEOUT_MS` (30 000 ms) is the production default referenced on each I/O class — every provider native-fetch default passes `AbortSignal.timeout(request.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS)` and the git seam passes `{ timeout: options.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS, killSignal: "SIGKILL" }` to `execFile`/`spawn` (no literal `30 000` scattered off-constant). Run a structural removal control that deletes the default on each I/O class and assert the assertion fails naming the class.
2. Behavioral provider: inject a short timeout override (tens of milliseconds, not 30 s) with a never-resolving provider transport; assert the request aborts at the bound, surfaces a classified timeout/failure, and blocks the affected mutation rather than hanging.
3. Behavioral git: inject a short `timeoutMs` with a non-terminating git child; assert the child is killed at the bound, a classified failure is surfaced, and branch deletion is blocked.
4. Assert the dependent/thread call counts are bounded by the caps and independent of the larger population.
5. Assert no operation waits unbounded and the plan/apply issues no per-item unbounded query loop.
6. Optionally run the reference-fixture apply three times and record the median as **non-CI reference-only** in §10; a missing measurement is recorded "not run", never as passing.
7. Run a per-item-query unbounded mutant; assert the bound assertion fails.

**Expected Outcome**:

- CI proves bounded work and caps, structurally pins the 30 000 ms production default on each I/O class, and behaviorally aborts a never-resolving provider transport and a non-terminating git child at an injected short bound (no 30 s wall-clock wait); the p95 reference is separately recorded, never a CI gate (GAP-T2).

#### TC-CLOSE-064 - Non-vacuity meta-check: broken guards fail naming the case

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: §4.2 (all ACs)
**Test Type(s)**: Contract, Meta-check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/closeout-mutants.test.ts`; `tests/fixtures/closeout/mutants/**`
**Tags**: @backend

**Preconditions**:

- A mutant corpus covering each guard named in §4.2: label disposition, unknown-blocker rule, unavailable-signal-as-empty, merged-head equality, protected set, gap honesty, no-leak projection, terminal-outcome reuse, plan determinism, SHA-256 identity algorithm/omitted capability context (FNV-1a and omitted-capability-context), detached-as-unrelated, and the read-only isolation scan.

**Steps**:

1. For each mutant, import the temp copy through a file URL and run the intended suite's assertion helper.
2. Assert the mutant produces the prohibited observable while the fixture still contains the trigger.
3. Assert the failure message names the case (e.g. the disposition, the branch, the operation) and not a generic assertion.
4. Assert the unmutated module passes the same helper (so the mutant is the only difference).
5. Fail the meta-check if any mutant passes or if the corpus is empty.

**Expected Outcome**:

- Every guard is proven non-vacuous; a deliberately broken expectation fails naming its case.

#### TC-CLOSE-065 - Mock-conformance runtime coverage of the new supported writes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, AC-F11-2, AC-F11-4, NFR-9, TDR-0008
**Test Type(s)**: Contract, Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts`; `packages/testkit/src/conformance/coverage.ts` (`runtimeCoverageViolations`)
**Tags**: @backend

**Preconditions**:

- The conformance adapter registrations and the three-flow registry are updated so GitHub and Jira declare the newly supported `write-work-item`, `transition-work-item`, and `resolve-delivery-thread` operations.
- The mock conformance run produces an execution report with per-provider, per-operation step status.

**Steps**:

1. Run the mock conformance suite and evaluate `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")`; assert it is empty.
2. Assert every operation that a provider declares in `capabilities.supportedOperations`, including the newly supported writes, has a step with `status: "executed"` for that provider — a supported write may not be satisfied by a deferred or skipped step in mock mode.
3. Assert `resolve-delivery-thread` executes for the provider that declares it supported and that Jira/GitLab declared gaps are encountered as `declared-gap` skips with their reasons.
4. Assert the report is non-vacuous: at least one executed step per provider and a non-empty adapter registration set.
5. Mutation control: remove the executed `write-work-item` step (or mark a previously gapped operation supported without adding an executing step) in a temp copy and assert `runtimeCoverageViolations` returns a message naming the provider and the operation.
6. Mutation control: leave a declared gap unencountered and assert the coverage check names the missing declared-gap step.

**Expected Outcome**:

- The existing runtime-coverage invariant is green over the new supported writes; a supported write that does not execute in mock conformance fails with a provider/operation-named violation.

**Notes / Clarifications**:

- This is the test-plan representation of the discovered obligation that the newly supported `write-work-item`/`transition-work-item`/`resolve-delivery-thread` operations must execute in mock conformance, not merely be declared. It complements TC-CLOSE-002 (registry/operation-set equality) with the runtime execution oracle.

#### TC-CLOSE-066 - Detached-HEAD restore and dirty/missing-base refusal

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-10, F-14, DM-7, AC-F9-5, AC-F9-4, AC-F10-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-checkout.test.ts`; temporary local git repository
**Tags**: @backend

**Preconditions**:

- A temp repo where the current checkout is detached at the delivery head (`git checkout --detach <delivery-head>`), the worktree is clean, and the resolved base (`main-tools`, or the merged target ref) resolves locally.
- Sibling cases: the same detached checkout with a dirty worktree; the same detached checkout with a missing local base ref.
- An attached-on-delivery-branch control.

**Steps**:

1. Apply the clean detached case; assert the checkout is restored to the resolved base and the outcome is `applied`.
2. Assert no remote ref is touched.
3. Apply the dirty-detached case; assert restore refuses, the detached checkout is retained, no branch is deleted, and the command returns `closeout.branch.unsafe` with exit 1.
4. Apply the missing-base detached case; assert the same refusal with `closeout.branch.unsafe` and no deletion.
5. Assert the attached-on-delivery-branch control restores (so the detached handling is not passing by inaction).
6. Run a mutant that classifies a detached-at-delivery-head checkout as unrelated/`already-elsewhere` (`satisfied`); assert it leaves the checkout stranded and the test fails.

**Expected Outcome**:

- A detached-at-delivery-head checkout is restored like the delivery branch when safe; a dirty worktree or missing base refuses with the classified identity and zero destructive action.

#### TC-CLOSE-067 - Target not-found versus malformed-payload discrimination

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-14, DM-11, AC-F4-4, AC-F4-3, AC-F14-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-ticket-labels.test.ts`; `tests/behaviour/closeout-read-observation.test.ts`
**Tags**: @backend

**Preconditions**:

- Case A: the provider explicitly reports that the target work item does not exist (provider not-found observation).
- Case B: the provider returns a malformed/unparsable payload (invalid observation).
- Case C: the provider has no work-item read surface (unavailable observation).
- A supported observed-item control.

**Steps**:

1. Plan and apply Case A; assert `closeout.target.unobserved`, user/non-retryable/`not_landed`/`user-validation`, exit 1, and zero provider or git writes.
2. Plan and apply Case B; assert the failure is the adapter-local `provider.payload.invalid` and is never rendered as `closeout.target.unobserved`; assert zero writes.
3. Plan and apply Case C; assert the ticket-dependent steps are a declared gap (`skipped-gap`) and the transaction continues, not `closeout.target.unobserved`.
4. Assert the observed-item control transitions to done (`applied`), proving the failure cases are not passing because the command is inert.
5. Run a mutant that maps an invalid payload to `closeout.target.unobserved`; assert the test fails naming the identity. Run a mutant that treats not-found as a declared gap; assert it fails too.

**Expected Outcome**:

- Explicit provider not-found, malformed payload, and missing read are three distinct, correctly classified outcomes; a payload failure is never rewritten as a not-found and no write occurs.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version` (1.4.4); pnpm pinned by `packageManager` (10.18.3); `git` available for temporary local repositories; no live provider, credential, or network | All closeout suites are hermetic and in-process except the local temp git scenarios |
| CI (`ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; `pnpm build` before the test job (the `pretest` hook); `fetch-depth: 0` | Authoritative for the suite results, boundary/sync checks, conformance, and the aggregate gate |
| In-process test process | Bun runtime; injected brand, clock, run id, streams, provider fake, git fake, and fenced state fake | No child processes except the temp `git` scenarios; no real provider or credential |
| Temp fixture roots | `mkdtemp` under the OS temp directory | Temporary git repos, goldens, whole-tree scans; removed per test |
| Reference environment (non-CI) | The reference fixture for the optional p95 ≤ 120 s apply measurement | Optional and recorded in §10; a missing measurement is "not run", never a pass (GAP-T2) |

### 6.2 Test Data and Fixtures (all synthetic)

All closeout fixtures live under `tests/fixtures/closeout/` or are generated in a temp directory. No fixture contains a real path, title, comment body, credential, environment value, or command argument.

| Fixture / artefact | Shape | Lifecycle |
|--------------------|-------|-----------|
| `tests/fixtures/closeout/harness.ts` | `CloseoutProviderRuntime` (incl. `listBlockedByDependents` and the `fakeNotFound`/`fakeInvalidPayload`/`fakeUnavailableSurface`/`fakeUnavailableRelation`/`fakeUnknownRelation` hooks), `CloseoutGitRuntime` (incl. `isClean`, `resolveRef`), and the fenced state fake; ordered call recorder; scripted failure/unknown hooks; `runCloseoutCli` | Read-only code; per-test instances |
| `tests/fixtures/closeout/plan.ts` | Plan builders over synthetic refs/labels/dependents/threads; fixed clock/run id | Read-only |
| `tests/fixtures/closeout/labels.ts` | Label sets: all six + `change` + vendor label; already-swept; absent signal; Jira replace-before/after | Read-only |
| `tests/fixtures/closeout/dependents.ts` | Eligible, open-blocker, already-hand-back, hand-back+blocked, unknown-blocker, unavailable-relation, and 200/201/large cap sets | Read-only |
| `tests/fixtures/closeout/threads.ts` | Merged request threads: unresolved, already-resolved, 100/101 cap; GraphQL `resolveReviewThread` fixture | Read-only |
| `tests/fixtures/closeout/request.ts` | Merged requests with numeric/non-numeric identities, present/absent `headSha`, no-lookup case | Read-only |
| `tests/fixtures/closeout/capabilities.ts` | GitHub/Jira/GitLab declaration snapshots and gap matrices; unsupported-op plan | Read-only |
| `tests/fixtures/closeout/branch.ts` | Branch-safety cases BR-01..BR-12 with expected outcomes. BR-13/BR-14 (detached-at-delivery-head clean / dirty-or-missing-base) are owned by TC-CLOSE-066's temporary-repo harness, not this fixture file. | Read-only |
| `tests/fixtures/closeout/canary.ts` | One fabricated canary constant, forbidden-shaped field names, and a fabricated environment value | Read-only; the only canary source |
| `tests/fixtures/closeout/golden/**` | Normalized machine envelopes and human digests for plan/apply outcomes; no absolute paths, host timestamps, or real content | Read-only; regenerated only by an explicit command |
| `tests/fixtures/closeout/mutants/**` | Temp-copied mutants: disposition bypass, unknown-as-done, unavailable-signal-as-empty, missing-head equality, protected-set bypass, worktree-blind delete, detached-as-unrelated, gap-as-success, wide projection, terminal-reuse bypass, `Date.now()` plan, FNV-1a identity, omitted-capability-context identity, read-only import/spawn, success-on-partial | Temp-copied and imported through a file URL; never executed against the live tree |
| `tests/fixtures/providers/{github,jira,gitlab,traps}` | Existing sanitized provider fixtures extended with write/trap cases and the GraphQL thread fixture | Read-only |
| Temp local git repositories | `git init` + commits + branches + `git worktree add`; removed per test | Generated in temp |

**Fixture rules.** Refs are canonical `<PREFIX>-<digits>`; ids are synthetic provider entity ids; labels are the declared lifecycle set plus a synthetic vendor label; thread ids are synthetic; SHAs are 40-character synthetic hashes; timestamps are ISO-8601 UTC derived from `CLOSEOUT_NOW_MS`. Counts are small integers or documented maxima. The canary is a fabricated marker, not a credential.

### 6.3 Determinism Contract

- Time comes only from the injected `CLOSEOUT_NOW_MS`; `newRunId` is a fixed sequence; the brand is `SYNTHETIC_BRAND`. No test reads `Date.now`, `Math.random`, `process.env`, `$HOME`, or a real path for a verdict.
- Every iteration over labels, dependents, threads, operations, and recorded calls has an asserted order; no test depends on file enumeration or object key order.
- Replays use identical inputs and byte-compare stdout; goldens are committed, normalized, and regenerated only by an explicit command.
- No sleep, timer, retry-with-delay, or scheduler is used; crash/effect/record simulations are explicit hook calls between recorded calls.
- No assertion compares against a moving base branch. Tree scans read the current tree; mutation tests read and edit temp copies only.

### 6.4 Isolation Strategy

- Every mutation, golden comparison, and git scenario runs on a fresh temp root or a committed read-only fixture; the live repository tree, `dist/`, and the user's real state directory are never written.
- The provider and git fakes have no live transport, no credential reader, and no remote operation; the only real process is the local `git` invocation inside the temp repository harness.
- The suites are discovered by the root `bun test`; no fixture is named `*.test.ts`.
- Temp copies and temp repositories are deleted at test end; `git status --porcelain` is captured before and after the battery and must be unchanged.

### 6.5 Entry and Exit Criteria for the Phase

**Entry (before execution)**

- The spec is accepted into the change and `.ai/rules/testing-strategy.md` and `.ai/rules/typescript.md` have been read (this plan was authored against them).
- The closeout contracts, domain planner, state record kind, provider writes, git seam, CLI command, and error rows exist; the conformance registry is updated.
- The fixtures, fakes, and temp-git harness above exist.
- No live provider, credential, or populated home directory is required for the CI suites.

**Exit (before the change is proposed)**

- All 61 ACs have passing, traceable evidence recorded in §10 with commands and HEAD; the pushed-HEAD CI result is recorded.
- Every boundary in §4.5, §4.6, and §4.9 has both its positive and negative assertion; every guard has its intentionally broken control (TC-CLOSE-064).
- The four error rows are 4/4 round-trip; the documented sync is green in both directions; the exit-literal invariant is green.
- The conformance flow-registry operation set equals `ADAPTER_OPERATIONS` including `resolve-delivery-thread`, and `runtimeCoverageViolations` is empty over the new supported writes in mock mode.
- No live network/credential/host-state use exists in the battery; `pnpm check` is green in a clean checkout.
- The optional reference measurement is recorded or explicitly "not run"; NFR-6 remains a bounded-work target.
- `git diff --check` is clean and no gate in §7 was skipped.

## 7. Automation Plan and Implementation Mapping

All TCs are automated except the optional reference measurement of TC-CLOSE-063. File names are the suite names above; delivery planning may add helpers but must preserve each TC's behaviour, assertions, and AC mapping.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-CLOSE-001 | `tests/structure/closeout-contract.test.ts`; `tests/types/closeout-*.type-test.ts` | `bun test tests/structure/closeout-contract.test.ts`; `pnpm typecheck` | executable-statement and wrong-disposition mutants | To Implement |
| TC-CLOSE-002 | `tests/structure/closeout-contract.test.ts`; `tests/structure/conformance-coverage.test.ts` | corresponding `bun test` | missing-step/operation mutants; required-field type probe | To Implement |
| TC-CLOSE-003 | `tests/structure/error-table.test.ts`; `tests/behaviour/closeout-output.test.ts` | corresponding `bun test` | row-removal mutant | Existing – Update |
| TC-CLOSE-004 | `tests/checks/error-table-sync.test.ts`; `scripts/checks/{error-table-sync,exit-code-literals}.ts` | `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts`; `bun run scripts/checks/exit-code-literals.ts` | machine/doc drift both directions; empty-table control; seeded literal | Existing – Update |
| TC-CLOSE-005 | `tests/behaviour/error-classification.test.ts`; `tests/structure/error-table.test.ts` | corresponding `bun test` | kind-only, bad-code, first-row control | Existing – Update |
| TC-CLOSE-006 | `tests/types/closeout-headsha.type-test.ts`; `tests/behaviour/closeout-request.test.ts`; `tests/behaviour/closeout-branch.test.ts` | `pnpm typecheck`; corresponding `bun test` | deriving/defaulting mutant | To Implement |
| TC-CLOSE-007 | `tests/structure/closeout-imports.test.ts`; existing read-only suites | `bun test tests/structure/closeout-imports.test.ts`; corresponding `bun test` | seeded import/spawn | To Implement |
| TC-CLOSE-008 | `tests/structure/closeout-imports.test.ts`; `tests/boundaries` | `bun test tests/structure tests/boundaries`; `pnpm check:boundaries` | widened allowance; planted spawn | To Implement |
| TC-CLOSE-009 | `tests/checks/license-*.test.ts`; license scripts | `bun test tests/checks/license-*.test.ts`; `bun run scripts/checks/license-audit.ts`; `bun run scripts/checks/vulnerability-gate.ts` | synthetic dependency | Existing – No Change |
| TC-CLOSE-010 | `tests/behaviour/closeout-plan.test.ts` | `bun test tests/behaviour/closeout-plan.test.ts` | plan-write mutant; apply control | To Implement |
| TC-CLOSE-011 | same | same | dry-run/apply diff | To Implement |
| TC-CLOSE-012 | same | same | grammar matrix; valid sibling | To Implement |
| TC-CLOSE-013 | same | same | `Date.now()`/map-order mutant | To Implement |
| TC-CLOSE-014 | same | same | duplicate-identity/unstable-order mutant | To Implement |
| TC-CLOSE-015 | `tests/behaviour/closeout-idempotency.test.ts` | `bun test tests/behaviour/closeout-idempotency.test.ts` | re-executing mutant | To Implement |
| TC-CLOSE-016 | same | same | blind-retry mutant | To Implement |
| TC-CLOSE-017 | same | same | failed-is-terminal mutant | To Implement |
| TC-CLOSE-018 | same + `packages/core/src/domain/sha256.ts` | `bun test tests/behaviour/closeout-idempotency.test.ts` | SHA-256 KAT + fixed canonical tuple + test-only `node:crypto` cross-check; FNV-1a and omitted-capability-context mutants; clock/random or omitted-input mutant | To Implement |
| TC-CLOSE-019 | same + `tests/fixtures/state/harness.ts` | same | failure-to-zero; schema-bump mutant | To Implement |
| TC-CLOSE-020 | `tests/behaviour/closeout-ticket-labels.test.ts` | `bun test tests/behaviour/closeout-ticket-labels.test.ts` | already-done write mutant | To Implement |
| TC-CLOSE-021 | same | same | done-item write mutant | To Implement |
| TC-CLOSE-022 | same | same | supported sibling control | To Implement |
| TC-CLOSE-023 | same | same | keep-`change` removal mutant | To Implement |
| TC-CLOSE-024 | same | same | repeat-write mutant | To Implement |
| TC-CLOSE-025 | same | same | blind-rewrite mutant | To Implement |
| TC-CLOSE-026 | same + Jira trap fixtures | same | whole-array-overwrite mutant | To Implement |
| TC-CLOSE-027 | `tests/behaviour/closeout-unassign.test.ts` | `bun test tests/behaviour/closeout-unassign.test.ts` | absent-assignee control | To Implement |
| TC-CLOSE-028 | same | same | absence-as-empty mutant | To Implement |
| TC-CLOSE-029 | same | same | supporting sibling control | To Implement |
| TC-CLOSE-030 | same | same | repeat-clear mutant | To Implement |
| TC-CLOSE-031 | `tests/behaviour/closeout-owed-flip.test.ts` | `bun test tests/behaviour/closeout-owed-flip.test.ts` | still-blocked control | To Implement |
| TC-CLOSE-032 | same | same | eligible sibling control | To Implement |
| TC-CLOSE-033 | same | same | re-add `hand-back` mutant | To Implement |
| TC-CLOSE-034 | same | same | unasserted-`[]`-as-no-blockers, unavailable-signal-as-empty, and unknown-as-done mutants; known-done control | To Implement |
| TC-CLOSE-035 | same | same | unbounded/no-truncation mutant | To Implement |
| TC-CLOSE-036 | same | same | capable sibling control; explicit no-surface-versus-unavailable separation | To Implement |
| TC-CLOSE-037 | `tests/behaviour/closeout-threads.test.ts` | `bun test tests/behaviour/closeout-threads.test.ts` | duplicate-resolution mutant; cap pair | To Implement |
| TC-CLOSE-038 | same | same | GitHub sibling control | To Implement |
| TC-CLOSE-039 | same | same | present-request control | To Implement |
| TC-CLOSE-040 | same | same | success-on-partial mutant | To Implement |
| TC-CLOSE-041 | `tests/behaviour/closeout-checkout.test.ts` + temp git harness | `bun test tests/behaviour/closeout-checkout.test.ts` | already-on-base control | To Implement |
| TC-CLOSE-042 | same | same | switch-anyway mutant | To Implement |
| TC-CLOSE-043 | same | same | hijacking mutant | To Implement |
| TC-CLOSE-044 | same | same | clean sibling control | To Implement |
| TC-CLOSE-045 | `tests/behaviour/closeout-branch.test.ts` + temp git harness | `bun test tests/behaviour/closeout-branch.test.ts` | moved-head sibling; gap/no-op sibling | To Implement |
| TC-CLOSE-046 | same | same | force-delete mutant | To Implement |
| TC-CLOSE-047 | same | same | protected-set-bypass mutant; `HEAD` via resolved-base/current-checkout contract data (no branch named `HEAD`) | To Implement |
| TC-CLOSE-048 | same | same | worktree-blind mutant | To Implement |
| TC-CLOSE-049 | same | same | absence-error mutant | To Implement |
| TC-CLOSE-050 | same | same | first-match mutant | To Implement |
| TC-CLOSE-051 | same | same | deriving mutant | To Implement |
| TC-CLOSE-052 | same | same | healed-provider retry control | To Implement |
| TC-CLOSE-053 | `tests/behaviour/closeout-capabilities.test.ts` | `bun test tests/behaviour/closeout-capabilities.test.ts` | claimed-but-unsupported mutant | To Implement |
| TC-CLOSE-054 | same | same | missing-gap mutant | To Implement |
| TC-CLOSE-055 | same | same | claimed-GitLab-write mutant | To Implement |
| TC-CLOSE-056 | same | same | success-claiming mutant | To Implement |
| TC-CLOSE-057 | `tests/behaviour/closeout-request.test.ts` | `bun test tests/behaviour/closeout-request.test.ts` | first-return-order mutant | To Implement |
| TC-CLOSE-058 | same | same | lookup-capable sibling control | To Implement |
| TC-CLOSE-059 | `tests/behaviour/closeout-output.test.ts`; `tests/golden/closeout-envelope.test.ts` | corresponding `bun test` | wide-projection mutant; canary presence control | To Implement |
| TC-CLOSE-060 | `tests/behaviour/closeout-output.test.ts`; `tests/golden/closeout-human.test.ts` | corresponding `bun test` | `Date.now()` and over-cap renderer mutants | To Implement |
| TC-CLOSE-061 | `tests/behaviour/closeout-output.test.ts` | `bun test tests/behaviour/closeout-output.test.ts` | wrong-projection/literal mutant | To Implement |
| TC-CLOSE-062 | `tests/behaviour/closeout-hermetic.test.ts`; `tests/checks/fixture-sanitization.test.ts` | corresponding `bun test` | planted fetch/credential/home path | To Implement |
| TC-CLOSE-063 | owed-flip/threads suites + `tests/structure/closeout-contract.test.ts`; provider transport + git seam fixtures; optional manual reference | corresponding `bun test`; manual reference | per-item-query unbounded mutant; structural timeout-removal control on each I/O class; never-resolving provider / non-terminating git child with short injected timeout | To Implement |
| TC-CLOSE-064 | `tests/checks/closeout-mutants.test.ts` + `tests/fixtures/closeout/mutants/**` | `bun test tests/checks/closeout-mutants.test.ts` | the mutant corpus itself, incl. FNV-1a/omitted-capability identity, unavailable-signal-as-empty, and detached-as-unrelated | To Implement |
| TC-CLOSE-065 | `tests/conformance/mock-conformance.test.ts`; `packages/testkit/src/conformance/coverage.ts` | `bun test tests/conformance` | drop an executed supported-write step; mark a gapped op supported without execution | Existing – Update |
| TC-CLOSE-066 | `tests/behaviour/closeout-checkout.test.ts` + temp git harness | `bun test tests/behaviour/closeout-checkout.test.ts` | detached-as-unrelated mutant; dirty/missing-base refusal controls | To Implement |
| TC-CLOSE-067 | `tests/behaviour/closeout-ticket-labels.test.ts`; `tests/behaviour/closeout-read-observation.test.ts` | corresponding `bun test` | invalid-as-not-found mutant; not-found-as-gap mutant; observed-item control | To Implement |

### 7.1 Execution Order

1. Contracts, extensions, error identities: TC-CLOSE-001, TC-CLOSE-002, TC-CLOSE-003, TC-CLOSE-005.
2. Isolation, confinement, dependencies: TC-CLOSE-007, TC-CLOSE-008, TC-CLOSE-009.
3. Plan and grammar: TC-CLOSE-010, TC-CLOSE-011, TC-CLOSE-012, TC-CLOSE-013, TC-CLOSE-014.
4. Idempotency and ledger: TC-CLOSE-015, TC-CLOSE-016, TC-CLOSE-017, TC-CLOSE-018, TC-CLOSE-019.
5. Ticket, labels, unassign: TC-CLOSE-020..TC-CLOSE-030, TC-CLOSE-067.
6. Owed-flip and threads: TC-CLOSE-031..TC-CLOSE-040.
7. Checkout and branch safety: TC-CLOSE-041..TC-CLOSE-052, TC-CLOSE-066.
8. Capabilities, request lookup, and conformance runtime coverage: TC-CLOSE-053..TC-CLOSE-058, TC-CLOSE-065.
9. Output, errors, hermeticity, bounds: TC-CLOSE-059..TC-CLOSE-063.
10. Sync and non-vacuity meta-check: TC-CLOSE-004, TC-CLOSE-064, `pnpm check`.

### 7.2 CI Mapping

No new CI job is introduced. The existing jobs carry the new suites:

| Suite / check | Discovered by | CI job(s) |
|---------------|---------------|-----------|
| `tests/structure/closeout-contract.test.ts`, `closeout-imports.test.ts`, `conformance-coverage.test.ts` | `bun test` | `ts-test`; boundary/static scans also in `ts-boundaries` and `ts-invariants` |
| `tests/behaviour/closeout-*.test.ts` | `bun test` | `ts-test` |
| `tests/conformance/mock-conformance.test.ts` (runtime-coverage invariant) | `bun test` | `ts-test` |
| `tests/golden/closeout-*.test.ts` | `bun test` | `ts-test` |
| `tests/checks/closeout-mutants.test.ts`, `error-table-sync.test.ts`, `fixture-sanitization.test.ts`, `license-*.test.ts` | `bun test` | `ts-test` |
| `tests/types/closeout-*.type-test.ts` | `pnpm typecheck` (`tsc -p tests/types/tsconfig.json`) | `ts-typecheck` |
| `scripts/checks/{error-table-sync,exit-code-literals,ambient-globals,secret-read-boundary,workspace-entrypoints,license-audit,vulnerability-gate}.ts` | direct invocation | `ts-invariants` / `ts-boundaries` / `ts-license-audit` / `ts-vulnerability-gate` |
| `tests/boundaries` | `bun test tests/boundaries`; `pnpm check:boundaries` | `ts-boundaries` |
| Aggregate | `pnpm check` | `ts-aggregate` and the individual `ts-*` jobs |

**Wiring rules.** The suites are discovered by the root `package.json#scripts.test` (`bun test`), which contains no filter, no `--bail`, no `--passWithNoTests`, and no `|| true`; no job uses `continue-on-error`; no test is skipped by `bunfig.toml` ignore patterns. The change adds no workflow file and no job. The aggregate gate is unchanged.

### 7.3 Evidence Commands

Run and record in §10 (never record an unrun result as passing):

```
pnpm install --frozen-lockfile
pnpm build
bun test tests/structure/closeout-contract.test.ts
bun test tests/structure/closeout-imports.test.ts
bun test tests/structure/conformance-coverage.test.ts
bun test tests/structure/error-table.test.ts
bun test tests/behaviour/error-classification.test.ts
bun test tests/behaviour/closeout-plan.test.ts
bun test tests/behaviour/closeout-idempotency.test.ts
bun test tests/behaviour/closeout-ticket-labels.test.ts
bun test tests/behaviour/closeout-unassign.test.ts
bun test tests/behaviour/closeout-owed-flip.test.ts
bun test tests/behaviour/closeout-threads.test.ts
bun test tests/behaviour/closeout-checkout.test.ts
bun test tests/behaviour/closeout-branch.test.ts
bun test tests/behaviour/closeout-capabilities.test.ts
bun test tests/behaviour/closeout-request.test.ts
bun test tests/behaviour/closeout-output.test.ts
bun test tests/behaviour/closeout-hermetic.test.ts
bun test tests/checks/closeout-mutants.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/checks/fixture-sanitization.test.ts
bun test tests/boundaries
bun test tests/conformance
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/secret-read-boundary.ts
bun run scripts/checks/workspace-entrypoints.ts
bun run scripts/checks/license-audit.ts
bun run scripts/checks/vulnerability-gate.ts
pnpm typecheck
pnpm check
git diff --check
git status --porcelain
```

**Optional non-CI reference measurement (recorded in §10, never a pass gate):**

```
# reference fixture only; median of three apply runs; record environment/date
<binary> closeout GH-183 --apply --json
```

Notes on the battery:

- `pnpm build` is required because the `pretest` hook builds and the boundary/export checks read `dist/`.
- The closeout suites are also exercised in one pass by `bun test` (the CI command); the individual lines localize a failure.
- `git status --porcelain` is captured before and after the battery; the suites must not modify the worktree.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A plan/apply fixture is inert, so zero-mutation and convergence pass without proving the engine ran | H | M | Every plan assertion is paired with an apply control; every terminal-reuse assertion is paired with an execution assertion (TC-CLOSE-010, TC-CLOSE-015) |
| RSK-T2 | A gap or no-op is silently rendered as success | H | M | The closed outcome vocabulary is asserted; a gap can never be `applied`/`satisfied`; a success-claiming mutant must fail (TC-CLOSE-056) |
| RSK-T3 | The fake provider hides a real provider trap (label replace, transition, thread resolution) | H | M | Trap fixtures assert both the request and the after-state; the Jira preservation trap and the GraphQL thread fixture are explicit (TC-CLOSE-026, TC-CLOSE-037) |
| RSK-T4 | Branch deletion loses unmerged work because a safety predicate is skipped | H | L | The full BR matrix is exercised with a positive and negative neighbour per predicate; a force-delete mutant must fail (TC-CLOSE-045..TC-CLOSE-052) |
| RSK-T5 | A crash between effect and record is implemented as a permanent failure or a duplicate effect | H | M | The effect-without-record and failed-outcome paths are explicit; a blind-retry and a failed-is-terminal mutant must fail (TC-CLOSE-016, TC-CLOSE-017) |
| RSK-T6 | The read-only commands accidentally gain the git seam or provider write path | H | L | Import/AST scans, boundary fixtures, and the unchanged read-only suites; seeded violations must fail (TC-CLOSE-007, TC-CLOSE-008) |
| RSK-T7 | Output or ledger evidence leaks a comment body, title, raw payload, credential, or environment value | H | L | A planted canary is asserted present first; a wide-projection mutant must leak and fail (TC-CLOSE-059, TC-CLOSE-062) |
| RSK-T8 | The conformance flow registry is not updated, so the closed-operation invariant fails or is silently weakened | M | M | The operation-set equality and the new step are asserted; removing the step fails naming it (TC-CLOSE-002) |
| RSK-T9 | The NFR-6 p95 is claimed without a measurement | H | M | CI asserts bounded work plus declared timeouts; the reference measurement is explicitly non-CI and recorded or "not run" (TC-CLOSE-063, GAP-T2) |
| RSK-T10 | A shared change (edge, classifier, serializer, provider contract) regresses existing behaviour | M | M | The existing error, conformance, status, queue, verify, and boundary suites run unchanged as the regression half |
| RSK-T11 | The `headSha` absence collapses into a value, making deletion unsafe | H | M | Paired present/absent fixtures plus a deriving mutant; absent must refuse (TC-CLOSE-006, TC-CLOSE-051) |
| RSK-T12 | The label sweep performs a wildcard/whole-array rewrite | H | M | The disposition table and the Jira preservation fixture; a whole-array-overwrite mutant must fail (TC-CLOSE-023, TC-CLOSE-026) |
| RSK-T13 | A newly supported write is declared but never exercised in mock conformance | H | M | The existing `runtimeCoverageViolations` invariant is asserted over the new supported writes; a supported-but-unexecuted op produces a named violation (TC-CLOSE-065) |
| RSK-T14 | A malformed provider payload is misclassified as a not-found target, or not-found is downgraded to a gap | H | M | The three read observations are driven separately and compared; invalid-as-not-found and not-found-as-gap mutants must fail (TC-CLOSE-067) |
| RSK-T15 | An unavailable relation signal is collapsed into an empty blocker set and flips an owed dependent | H | M | Provider-asserted-empty and unavailable/unknown cases are driven in one fixture; an unasserted-`[]` mutant must fail (TC-CLOSE-034) |

### 8.2 Assumptions

- **A-T1 — Behaviour-bound TCs.** Proposed helper names, fixture file contents, golden file names, and internal git-seam method names may change in delivery planning; the behaviour, assertions, identities, shapes, exits, and AC mapping must not. Spec-pinned values (`delivery.closeout.v1`, the four error codes, the seven step order, the disposition table, the protected set, the outcome vocabulary, `headSha`, `resolve-delivery-thread`) may not be rebound.
- **A-T2 — In-process harness plus temp git.** All provider/state/CLI tests are in-process fakes; only the checkout/branch scenarios spawn local `git` inside a temporary repository. No live provider, credential, or network is used (TC-CLOSE-062 asserts the absence).
- **A-T3 — Grammar split.** The shared parser recognizes `--`-prefixed flags; the command declares its flag set and validates missing/extra/malformed refs and stray values in the handler. Ref matching is case-sensitive with no case folding. Both rejection classes exit 1 with zero I/O. Repeated boolean flags are last-wins. §4.9 is the binding oracle.
- **A-T4 — Reference latency is non-CI.** NFR-6's bounded work is the CI oracle; the p95 measurement is optional and recorded, never asserted.
- **A-T5 — Existing suites are extended, not weakened.** `conformance-coverage`, `error-table`, `error-classification`, `error-table-sync`, and the read-only suites keep their assertions and add closeout cases.
- **A-T6 — Plan-relative.** `chg-GH-183-plan.md` is present and under remediation (GAP-T1). Any plan change that alters a TC's behaviour, assertion, or AC mapping must reopen this test plan.
- **A-T7 — Version impact.** `minor` is taken from the spec; this plan introduces no version or release metadata of its own.
- **A-T8 — GitHub reverse-read surface is implementation-confirmed.** The GitHub reverse-dependent read (`listBlockedByDependents`, bounded issue-dependencies) is an implementation-confirmed assumption, not verified current truth; its exact response shape is fixture-pinned (like OQ-T2/OQ-T3). A provider with no surface (e.g. GitLab's declared work-item-read gap) yields the provider-level `skipped-gap`/`provider-unsupported` (TC-CLOSE-036); a present surface whose current read is unavailable is a signal-level `skipped-noop` with `relation-signal-unavailable` and no flip (TC-CLOSE-034). The adapter/runtime must distinguish absent-surface from present-but-unavailable.

### 8.3 Open Questions and Recorded Gaps

| ID | Question / gap | Context | Status | Owner |
|----|----------------|---------|--------|-------|
| OQ-T1 | What are the internal helper, fixture, golden, and git-seam method names? | The spec pins the surface, shapes, identities, and exits; internal spellings are delivery-bound | Open — delivery-bound, non-blocking (A-T1, GAP-T4) | @plan-writer / @coder |
| OQ-T2 | Does the provider lookup expose merged heads on GitLab's read slice? | TDR-0008 records this as an assumption; absent stays truthful and branch cleanup refuses | Open — non-blocking; absent is a valid fixture | @coder |
| OQ-T3 | What exact GitHub GraphQL response shape does `resolveReviewThread` use? | TDR-0008 records this as TO-CONFIRM; the fixture is authored at implementation | Open — non-blocking; degrade to a gap if unavailable | @coder |
| OQ-T4 | Does a `tests/types/` compile-time probe add value beyond the runtime/contract checks? | TC-CLOSE-006/002 assert the type shape; a probe is a second line of defence | Open — optional, non-blocking | @plan-writer |
| OQ-T5 | Does GitHub expose the bounded reverse-dependent (issue-dependencies) surface, and what is its response shape? | Treated as an implementation-confirmed assumption (A-T8); fixtures pin the shape. If absent at implementation, GitHub owed-flip becomes the provider-level gap, not a signal skip | Open — non-blocking; absent is a valid fixture | @coder |
| GAP-T1 | Implementation-plan mapping is delivery-owned | The plan is present (v1.0, under DoR remediation); delivery planning must map phases onto these TCs without reshaping them | Recorded, non-blocking | @plan-writer |
| GAP-T2 | NFR-6 p95 is not a CI gate | Bounded work is the CI oracle; the reference measurement is non-CI | Recorded, non-blocking | @pm / @runner |
| GAP-T3 | The no-leak canary is a fixture obligation | Presence is asserted before absence | Recorded, non-blocking | @coder / @reviewer |
| GAP-T4 | Delivery-bound spellings | Semantics/identities/exits are pinned; names are not | Recorded, non-blocking | @coder |
| GAP-T5 | NFR-6/NFR-12 have no dedicated AC | Mapped to the ACs they qualify in §3.3 | Recorded, non-blocking | @spec-writer |

**No blocking gap was found.** The spec's 61 ACs are each testable with an observable oracle; the plan is offline and fixture-driven; the branch-safety predicate has a positive and negative case for every rule; idempotency has restart, crash, and failed-retry paths; capability honesty is a closed matrix; the read observations distinguish not-found, invalid, and unavailable; and the conformance-registry plus runtime-coverage obligations are explicit. The implementation plan is present (`chg-GH-183-plan.md`) and is being remediated in the same DoR cycle (GAP-T1 mapping remains delivery-owned); no spec, pm-notes, or code file was modified by this author.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.3 | 2026-11-01T10:30:00Z | Change Test Plan Writer | DoR-iteration-4 non-blocking cross-artifact alignment (§4.1 only): the binding `CloseoutProviderRuntime` fake in §4.1 item 2 now names the closeout-specific `readWorkItemObservation` hook returning the discriminated `CloseoutReadObservation` (`observed` / `not-found` / `unavailable` / `invalid`), matching plan v1.3 PIN-14 and Phase 2.7. The rest of the harness contract, all 67 TC IDs, the coverage matrices, and the execution log are unchanged. |
| 1.2 | 2026-11-01T08:30:00Z | Change Test Plan Writer | DoR iteration 2 remediation and spec v1.3 alignment (test-plan-owned findings only): (1) rewrote TC-CLOSE-018 to assert the SHA-256 algorithm — `""`/`"abc"` known-answer vectors, a fixed canonical closeout identity tuple digest, a test-only `node:crypto` cross-check, capability-context sensitivity, and an FNV-1a/omitted-capability-context mutant — and rewrote TC-CLOSE-063 to add the behavioral never-resolving provider transport and non-terminating git child with a short injected timeout override plus the structural `CLOSEOUT_OPERATION_TIMEOUT_MS` removal control on each I/O class; propagated the FNV-1a/omitted-capability identity, unavailable-signal-as-empty, and detached-as-unrelated mutants to §4.2/§4.3/§6.2/§7. (2) completed the §4.1 binding harness contract: `CloseoutProviderRuntime` now includes `listBlockedByDependents` and scripted `not-found`/`invalid`/`unavailable`/unavailable-or-unknown-relation hooks; `CloseoutGitRuntime` now includes `isClean` and `resolveRef`, synchronized with plan PIN-14/PIN-15/PIN-16 and Phases 3.7/3.8/4.6/5.5/6.6. (8) updated the §6.2 fixture table to state that `branch.ts` covers BR-01..BR-12 while TC-CLOSE-066's temporary-repo harness owns BR-13/BR-14. (9) added grammar case G-09 for two-or-more extra positionals (`fallback.invocation` at the parser) distinct from the one-extra handler `input.value.rejected` case, and updated TC-CLOSE-012. Spec v1.3 alignment: ODR-0003 owner acceptance is GH-186 (TDR-0008 is GH-183); operation identity is the ADR-0003 inputs plus the additive `capabilityContext` refinement recorded in DEC-7; the GitHub reverse-read surface is an implementation-confirmed assumption (A-T8, OQ-T5) with absent-surface → provider-level gap and present-but-unavailable → signal-level skip. TC count unchanged at 67; no ID reassigned; no orphan TCs. |
| 1.1 | 2026-11-01T05:00:00Z | Change Test Plan Writer | DoR iteration 1 remediation and spec v1.2 alignment: 67 TCs (appended TC-CLOSE-065..067; no existing ID reassigned); coverage now 61/61 ACs. Added AC-F4-4 (target not-found vs malformed payload vs unavailable read), AC-F7-7 (provider-asserted empty vs unavailable relation signal), and AC-F9-5 (detached-HEAD restore/refusal). Added TC-CLOSE-065 for the existing `runtimeCoverageViolations` mock-conformance invariant over the new supported `write-work-item`/`transition-work-item`/`resolve-delivery-thread` writes; TC-CLOSE-066 for detached-HEAD restore; TC-CLOSE-067 for read-observation discrimination. Scoped TC-CLOSE-036 to the provider-level no-reverse-read gap and moved the signal-level `skipped-noop` case to TC-CLOSE-034. Fixed TC-CLOSE-047 to assert `HEAD` protection via resolved-base/current-checkout contract data rather than an impossible branch named `HEAD`. Corrected the §2 `runCli` reference (imported directly from `packages/cli/src/index.ts`, not re-exported by `tests/golden/helpers.ts`). Reflected the flat `write-work-item` args, case-sensitive no-fold grammar, pinned `main-tools` base, and capability-context identity; added DM-11 and RSK-T13..T15. |
| 1.0 | 2026-11-01T04:10:00Z | Change Test Plan Writer | Initial plan: 64 TCs (`TC-CLOSE-001..TC-CLOSE-064`, a new prefix). All 58 ACs (AC-F1-1..AC-NFR10-1) and all 13 NFRs mapped with no orphan TCs. Covers the seven-step plan and byte-identical determinism; restart, crash-between-effect-and-record, failed-retry, and ledger integrity; ticket-to-done; the label disposition and Jira replace trap; explicit unassign; the bounded owed-flip sweep with the 200 cap; GraphQL thread resolution with the 100 cap; checkout restore refusals; the full squash-safety matrix; GitHub/Jira/GitLab capability parity and declared gaps; the additive `headSha` and `resolve-delivery-thread` plus the conformance flow-registry obligation; bounded machine/human output with a no-leak canary; the four closeout error identities and bidirectional sync; read-only command isolation; offline hermeticity; bounded work/timeouts; zero new dependencies; and a non-vacuity mutant meta-check. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds, tests, or commands and implemented no code. The executor records per-TC evidence, exact commands, HEAD, and the pushed-HEAD CI result for `ts-test`/`ts-typecheck`/`ts-boundaries`/`ts-invariants`/`ts-license-audit`/`ts-vulnerability-gate`/`ts-aggregate`. Unrun evidence must never be recorded as passing. |
| TC-CLOSE-063 — optional reference measurement | — | Optional (non-CI, not a pass gate) | Record environment, date, and median apply time for the reference fixture, or record "not run". NFR-6 remains a bounded-work target. |
| TC-CLOSE-018 — SHA-256 algorithm evidence | — | Planned (automated) | Assert `""`/`"abc"` KAT, the committed canonical-tuple digest, a test-only `node:crypto` cross-check, and capability-context sensitivity; the FNV-1a/omitted-capability-context mutants must fail. |
| TC-CLOSE-063 — structural + behavioral timeout | — | Planned (automated) | Assert the `CLOSEOUT_OPERATION_TIMEOUT_MS` default on each provider/git I/O class with a removal control; assert a short injected timeout aborts the never-resolving provider transport and non-terminating git child at the bound. |
| TC-CLOSE-059/062 — no-leak canary | — | Planned (automated) | Confirm the canary is present in the fixture before asserting zero output/ledger occurrences. |
| TC-CLOSE-002 — conformance registry | — | Planned (automated) | Confirm the flow-registry operation set equals `ADAPTER_OPERATIONS` including `resolve-delivery-thread` and the new step. |
| TC-CLOSE-065 — mock runtime coverage | — | Planned (automated) | Confirm `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` is empty and each new supported write executed. |
| TC-CLOSE-066 — detached-HEAD restore | — | Planned (automated) | Confirm clean detached restore plus dirty/missing-base refusal with no deletion. |
| TC-CLOSE-067 — read-observation discrimination | — | Planned (automated) | Confirm not-found, invalid payload, and unavailable read map to distinct identities with zero writes on failure. |
