---
id: chg-GH-240-test-plan
status: Proposed
version: 1.3
created: 2026-11-07T00:00:00Z
last_updated: 2026-11-07T00:00:00Z
owners: [engineering]
service: delivery-os
labels: [m1, capsule, memory, closeout, judgment-residue, telemetry]
version_impact: minor
summary: "M1-S12 capsule completion and closeout expansion: prove that a change folder becomes a self-contained, append-only episode capsule (contiguous sequences, deterministic event keys, per-capsule lock, terminal close, declared caps, torn-tail refusal), that only phase/commit/verify/closeout write it and their appends are non-gating, that closeout validates the capsule in both modes and refuses damage with no promotion write while completing pre-contract folders, that every candidate gets exactly one evidence-gated promotion decision routed to exactly one home or sanctioned handoff, that the merged-diff sweep, human-thread policy, worktree cleanup, retro-coverage move, and session-compaction checkpoint are idempotent mechanical steps emitting a bounded, ordered, body-free judgment residue, that the M1-S11 telemetry capture now lands in the state-layer log with zero records moved into or duplicated by the capsule stream, and that the contract grows additively so consumers resolve steps by id and a restart re-run converges byte-identically. 61 named TCs cover all 26 ACs, all 11 NFRs, EVT-1..EVT-5, DM-1..DM-10, DEC-1..DEC-16, and 44 named guard mutants; the battery is hermetic (injected providers, stores, clock and ids; temporary local repositories; temporary memory trees; no network, no live credentials)."
links:
  change_spec: ./chg-GH-240-spec.md
  implementation_plan: null   # authored in delivery_planning (phase 4); legacy .md remains readable
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S12: Change capsule completion and closeout expansion

## 1. Scope and Objectives

This plan protects six properties, and each has a failure the story exists to prevent.

**The capsule is an append-only episode, not a folder convention.** The change folder gains `events.jsonl` and `candidates/` in place (DEC-1); every line is one `delivery.capsule.event.v1` envelope with a contiguous per-capsule `sequence`, a deterministic `eventKey`, a closed `kind`/`writer`, an injected timestamp and a bounded payload (DEC-3). Appends are LF-terminated, serialized by one per-capsule lock, deduplicated by event key, and terminal at `capsule.closed`. A torn tail, a duplicate key, a sequence gap, or a line after the close is a refused capsule, never a silent repair or truncation (AC-F1-2, NFR-5). If the tests pass while a torn capsule still appends, the episode stream is corrupt and every later retro read is poisoned.

**Events belong to their owners and never gate the owner.** `phase` appends `phase.transition`, `commit` appends `commit.landed`, `verify` appends `gate.outcome`; closeout ingests `review.verdict` and appends its own lifecycle events; no agent free-text write exists and no command writes another change's capsule in phases 1–10 (DEC-2). An append failure is classified, disclosed, and changes neither the primary outcome nor the durable state record (AC-F1-3). A missing expected event is residue (`capsule-event-gap`), not an invalid capsule — the distinction is what makes the non-gating rule honest (DEC-4).

**Closeout is the consolidation ceremony.** It validates the capsule as a read-only pre-flight in both modes, completes a pre-contract folder with `capsule.opened` + `capsule.backfill-gap`, ingests readable review verdicts, and appends exactly one terminal `capsule.closed`. Every candidate must carry a capture-bar basis and an evidence link, is deduplicated deterministically, and receives exactly one decision — promoted to exactly one canonical home or sanctioned handoff, or rejected with a reason from the closed set (AC-F4-1, AC-F4-2, DEC-5, DEC-6). Damage is `closeout.capsule-invalid` with zero promotion writes; plan mode renders `would-refuse` and writes nothing (AC-F3-2).

**The mechanical sweep is detection plus judgment residue.** The merged-diff sweep reads one bounded added-line diff, records attributed hits as resolved owed-flip evidence, and emits ambiguous hits as residue; the thread policy resolves non-human threads and leaves human and unknown-authorship threads open; worktree cleanup removes only under the full predicate with no force path; retro coverage is a read plus a capsule event; compaction records a pre-compaction checkpoint and declares the absent harness surface. None of these steps may edit source, write a registry, guess an attribution, or remove a worktree it cannot prove safe (AC-F5, AC-F6, AC-F7, AC-F8, AC-F9).

**Two streams keep two owners.** The M1-S11 capture is now injected by the production closeout composer: `harness.telemetry` records land in the state-layer event log that `spend` reads, the capsule receives no statistics, plan mode extracts nothing, and capture stays non-gating and idempotent (AC-F10, NFR-7, DEC-13). The GH-233 review findings F-8 and F-11 are resolved on the now-reachable path and F-9 is explicitly re-deferred with its reason recorded.

**Growth is additive and retries are safe.** The step vocabulary grows from seven to twelve in a binding order, the payload schema stays `delivery.closeout.v1`, consumers resolve by `stepId`, and a restart re-run reuses terminal outcomes with no duplicate capsule event, promotion decision, thread resolution, branch deletion, worktree removal, or telemetry record (AC-F12, DEC-7, DEC-16). Residue is bounded data with an attention exit — `data` plus exit 1 — never an error envelope (DEC-14).

The residual risk this plan cannot remove is that the proofs run over injected and fixture-pinned surfaces: a live GitHub thread signal, a live harness store, and a real developer filesystem are proxied (§1.3 GAP-C1..C17). §4 makes vacuity structural rather than a coverage claim: **44 named mutants**, one per guard, each of which must make a named TC fail.

### 1.1 In Scope

- The capsule artifact contract: established month-scan folder resolution (ascending, first `--<ref>--` match, read-only, no creation), the `delivery.capsule.event.v1` envelope, the closed eleven-kind/four-writer vocabularies, contiguous sequence, deterministic event key, LF framing, per-capsule append lock with bounded retry, append-only discipline, terminal `capsule.closed`, the `candidates/` one-file-per-candidate layout, and the declared caps (F-1; DM-1; AC-F1-1, AC-F1-2; DEC-1, DEC-3; NFR-2, NFR-5, NFR-11).
- Capsule event production in `phase`, `commit`, and `verify`: one event per owned transition/landing/evaluation, deterministic event keys, duplicate-key no-ops, classified non-gating disclosure (a busy lock as the retryable `state.lock.busy`), and the structural absence of cross-change and free-text writes (F-2; AC-F1-3, AC-F2-1, AC-F2-2; DEC-2).
- Capsule validation and the closeout `capsule` step: the validation matrix (valid, pre-contract, malformed, torn, duplicate key, sequence gap, post-close line, duplicate candidate id, unknown status/malformed evidence, zero/multiple decisions), review-verdict ingestion, `capsule.backfill-gap`, the terminal close, `closeout.capsule-invalid` for content damage, and plan-mode zero writes (F-3; AC-F3-1, AC-F3-2; DEC-4).
- The candidate model and promotion ceremony: schema, capture bar, the five evidence-link shapes, the three status values, deterministic normalized-statement dedup, explicit `contradicts`/`supersedes` contradiction (target existence first), the three pre-existing-target outcomes (no overwrite), the closed routing table (lesson/tacit home writes with declared naming and monotonic id allocation plus one index row; fact/decision/norm/workflow handoffs; preference/fleet rejections), realpath-confined writes under the injected memory root (`capsule-invalid` for an id-shape violation, `closeout.step.capsule.failed` for a resolved escape), the two pinned decision shapes (durable event vs applied output projection), one decision per candidate, and re-run stability (F-4; DM-2, DM-3; AC-F4-1..3; DEC-5, DEC-6; NFR-6, NFR-9).
- The merged-diff owed-flip sweep: one bounded added-line read anchored on the verified merge transaction's squash SHA and parent, the closed four-kind marker vocabulary with the four closed action tokens and their fixed 1:1 mapping, attributed-hit resolution only when the declared action matches the kind, ambiguous-hit residue for out-of-vocabulary/kind-mismatched actions, the declared scan caps, and the `merged-diff-unavailable` gap (F-5; DM-6; AC-F5-1, AC-F5-2; DEC-8; NFR-1, NFR-3, NFR-6).
- The human-vs-non-human thread policy: `human`/`non-human`/`unknown` normalization, non-human resolution as delivered, human and unknown threads left open as identity-only `unresolved-human-thread` residue, the 100-thread and 50-item caps with `+N`, and the no-surface/no-signal gap behaviour (F-6; DM-4; AC-F6-1, AC-F6-2; DEC-9; NFR-4, NFR-9).
- Local worktree cleanup: the new fixed-argv, no-shell, no-force, local-only git-seam capability, the full safety predicate (merged evidence, convention match, exact head equality, cleanliness, not-current, not-locked/foreign, successful restore, no earlier non-gap failure), the refusal path (`closeout.branch.unsafe` / `would-refuse`), `worktree-retained` residue, `no-worktree` satisfaction, and ordering before `branch-cleanup` (F-7; DM-7; AC-F7-1, AC-F7-2; DEC-10; NFR-6, NFR-9).
- The retro-coverage move: verified read of the delivered `retro.run` registry at level `change` scoped to the work item, one idempotent `capsule.retro-coverage` event with `collected`/`pending`, zero registry writes, and the unreadable-registry gap/residue (F-8; DM-9; EVT-4; AC-F8-1, AC-F8-2; DEC-11).
- The session-compaction checkpoint: bounded work-item attribution through the delivered read-only session-store seam, one `capsule.compaction-checkpoint` event with bounded identities/count, flushed flags, unresolved-question count and last verified commit, the declared `harness-compaction-unavailable` gap, the no-sessions no-op, the attribution gap, and same-digest re-run idempotency (F-9; DM-8; EVT-3; AC-F9-1, AC-F9-2; DEC-12).
- Production telemetry wiring and two-stream separation: composer injection of the M1-S11 capture, state-log-only landing, zero capsule copies, plan-mode silence, non-gating and idempotent capture, GH-233 review findings F-8/F-11 resolution, and F-9 explicit re-deferral (F-10; EVT-5; AC-F10-1, AC-F10-2; DEC-13; NFR-7).
- The judgment-residue contract and output/exit semantics: closed eight-kind vocabulary, `{item, kind, location}`, 50-item cap with `+N`, kind-then-location order, body-free rendering, the additive `attention` projection class (`data` + exit 1 in apply, exit 0 in plan), the F-11 failure-envelope rule (no structured `residue[]` on a command-level failure; failed-step evidence names the item), and the new error identities (F-11; DM-4, DM-10; AC-F11-1, AC-F11-2; DEC-14, DEC-15; NFR-4, NFR-10).
- Step-vocabulary and contract evolution: the delivered seven ids preserved, the five additive ids, the binding twelve-step order, `delivery.closeout.v1` unchanged, `residue`/`capsule`/optional `detail` additive, consumer resolution by id and tolerance of unknown ids, updated goldens, and no schema-version bump (F-12; DM-5; AC-F12-1, AC-F12-2; DEC-7).
- Non-functional coverage: determinism, capsule bounds, diff-scan budget, output/residue bounds, append-only/self-containment, idempotency/convergence, telemetry preservation, latency on reference fixtures, privacy/security, error-identity stability, and capsule write concurrency (NFR-1..NFR-11).
- Delivery-process evidence: the aggregate gate, error-table sync, doc-distribution check, one lockstep changeset, neighbor documentation reconciliation, and the PR posture (spec §17.1 DoD-17..DoD-20).

Ticket acceptance-criteria traceability: ticket AC 1 (closed capsule with one decision per candidate) → AC-F1-1, AC-F3-1, AC-F4-2 (TC-CAP-001..006, 012..016, 021..023); AC 2 (no candidate skips the bar or the evidence link) → AC-F4-1 (TC-CAP-017..020); AC 3 (full idempotent sweep with bounded residue) → AC-F5-1, AC-F6-1, AC-F7-1, AC-F8-1, AC-F11-1 (TC-CAP-024..035, 036, 040); AC 4 (telemetry stays in the state log) → AC-F10-1, AC-F10-2 (TC-CAP-045..049); AC 5 (restart re-run converges) → AC-F12-2 plus AC-F1-3, AC-F2-1, AC-F4-3, AC-F5-2, AC-F7-1, AC-F9-2 (TC-CAP-005, 007, 023, 027, 038, 043, 055).

### 1.2 Out of Scope & Known Gaps

- [OUT] The typed memory-record store, `preferences/` tree, guild trees, memory lint in quality gates, the memory doctor, and the `ados memory` command family — owned by M2-S8, M3-S8, M3-S9 (NG-1). Reason: no surface exists; this plan asserts the rejection reasons `home-not-implemented` / `owner-approval-required` and the handoff record, never a store write.
- [OUT] A new archive tree, capsule relocation, retention policy, or index rebuild engine — owned by M2-S8 (NG-2, DEC-1). Reason: "archive" is a terminal `capsule.closed` marker plus closed state; TC-CAP-001 asserts no directory move and no month/folder creation.
- [OUT] Harness context-compaction invocation or any compaction adapter API — a declared capability gap (NG-3, DEC-12). Reason: no adapter surface exists; TC-CAP-044 asserts the absence and TC-CAP-042 asserts the declared `harness-compaction-unavailable` gap instead.
- [OUT] Source-code editing, marker removal, feature-flag rewrites, commits, pushes, or history rewrites by closeout — NG-4, DEC-8. Reason: the sweep is detection-only; TC-CAP-026 and TC-CAP-039 assert zero mutation and zero force vocabulary.
- [OUT] Retro collection/report execution, retro evidence writes, coverage-registry redesign, ceremony scheduling, and the retro close stage — owned by M1-S8 (GH-232) and M2-S3 (NG-5, DEC-11). Reason: closeout reads the registry and records coverage in the capsule; TC-CAP-040 asserts the registry file is byte-unchanged.
- [OUT] Posting tracker/PR comments or replies — `write-comment` remains a declared gap; the full adapter is M3-S3 (NG-6). Reason: human threads are reported as residue; no test asserts a prose write.
- [OUT] New CLI command families, new `db` subcommands/fields, and MCP/host surfaces — NG-7. Reason: the change extends `closeout` and its producers; TC-CAP-044 asserts the `db` surface is unchanged.
- [OUT] Cross-repository or multi-change closeout, remote branch/worktree cleanup, containerized execution — NG-8. Reason: only local single-change execution exists; TC-CAP-039 asserts local-only argv.
- [OUT] Telemetry backfill for changes closed before this change and capture points outside closeout — M1-S19 owns the forward stream (NG-9). Reason: no backfill path is built; a pre-change delivery reads as absent telemetry, never as zeros.
- [OUT] Provider write support beyond the delivered GitHub/Jira slices — GitLab stays a read slice with declared gaps (NG-10). Reason: TC-CAP-029 fixtures use the delivered GitHub thread surface; Jira/GitLab keep their delivered gaps.
- [OUT] Dispatch integration, queue/lane scheduling, watchdog economics, and spend aggregation — owned by M1-S9, M1-S15, M1-S17, M1-S19. Reason: the capsule and telemetry streams are proven at their own boundaries (GAP-C7).
- [OUT] A live provider or live-harness conformance tier — GAP-C1, GAP-C2. Reason: the battery is hermetic; no network, no live credentials, no real harness store.
- [OUT] The adoption KPI "closeouts requiring manual re-grep after adoption = 0" (§4.1) — an adoption outcome owned by the M1 rollout, not a CI assertion (GAP-C12). Reason: TC-CAP-061 records the metric table and the proving evidence, and marks adoption rows as manual trial evidence.

### 1.3 Gap register (inherited GAP-C1..GAP-C6, proxy gaps, and closed consistency/spec-resolution records)

The spec hands six proxy proofs to this plan (§17.1 "Proxy and test-plan gap handoffs"). They are inherited verbatim, not weakened; each names what is proven instead and the mechanism that keeps the gap from silently widening. Eleven further rows follow: seven proxy gaps (GAP-C7..GAP-C13) and four closed records whose underlying spec gap was resolved — three consistency fixes (GAP-C14..GAP-C16, spec v1.1) and one under-specification closed by spec v1.3 (GAP-C17). No open gap remains.

| ID | Condition that cannot be proven directly | What is proven instead | TCs | Pinned resolution mechanism |
|----|------------------------------------------|------------------------|-----|-----------------------------|
| GAP-C1 (inherited) | Live GitHub thread authorship (`human`/`non-human`/`unknown`) | Recorded provider-shaped fixtures covering user, bot/app, absent actor type, Mannequin, and unmapped actor; the normalization matrix is the oracle | 029, 031, 048 | A live conformance tier can replay the same matrix later; the fixture header records the provider payload shape and the finding that motivated it. No AC depends on a live read. |
| GAP-C2 (inherited) | Live harness session stores | Injected opencode store (synthetic SQLite in a temp root) and Claude Code session files; attribution through the delivered seam | 042, 043, 047, 048 | Reuse the GH-233 `tests/fixtures/harness/**` builders; a live tier is out of CI by design |
| GAP-C3 (inherited) | Real worktree removal in a developer checkout | Temporary local repositories created by the harness; one removal per fixture tree | 036, 037, 038, 039 | `tests/fixtures/closeout/temp-git.ts` extended with a worktree builder; assert the temp tree's own state, never the live worktree |
| GAP-C4 (inherited) | Promotion home writes into the real `.ai/memory` | A temporary memory tree (`tests/fixtures/memory/tree.ts`) with the real writer; the live `.ai/memory` hash is asserted unchanged | 021, 022 | The real `.ai/memory` tree is snapshotted before/after the suite and asserted byte-identical |
| GAP-C5 (inherited) | Real retro registry and merge-transaction state | Injected state fixtures plus a real temp JSONL state store; `retro.run` records built by the delivered contract types | 024, 027, 040, 041 | `tests/fixtures/state/harness.ts` and `tests/fixtures/retro/harness.ts`; no live store is opened |
| GAP-C6 (inherited) | Repository marker vocabulary and real squash diffs | Fixture-pinned merged diffs (squash SHA vs parent) across the four kinds and their bounds | 024, 025, 026, 028 | Marker patterns are declared contract data with a reviewed-data test (TC-CAP-028); a pattern change is a contract-data change, never a test-only edit |
| GAP-C7 (new) | `spend` reading the log alone (M1-S19 not delivered) | The read path performs zero harness-store calls and every statistic is readable from the state log after the store is denied | 045, 046 | GAP-C7 states the proxy; TC-CAP-045 asserts extractor call count zero on read |
| GAP-C8 (new) | NFR-8 latency budgets as a CI gate | The budgets are measured on reference fixtures and recorded in the execution log; the delivered feature doc declares the apply budget an optional non-CI artifact | 056 | A measurement artifact, not a merge gate; a budget miss is recorded as a gap, never as a green |
| GAP-C9 (new) | Cross-process / cross-machine capsule lock (NFR-11) | In-process concurrent writers plus an exclusive lock observed through the file runtime; the spec's single-user 0700 trust model is the accepted boundary | 004, 057 | The lock is asserted exclusive at the seam; a network-filesystem proof is out of scope by spec §12 |
| GAP-C10 (new) | Real downstream consumers of `delivery.closeout.v1` | A synthetic legacy-consumer fixture that resolves by `stepId`, tolerates an injected unknown step id, and ignores unknown optional fields — paired with MUT-CAP-42 | 051 | The fixture lives in `tests/fixtures/closeout/legacy-consumer.ts`; the mutant proves the fixture is not vacuous |
| GAP-C11 (new) | "Zero source/remote mutations" on a live repository | Temp-repo `git status`/`git diff`/ref-list equality plus an argv scan of the git seam; there is no remote to attempt | 026, 039 | Assert invocation logs and repo state, not intent; a force or `remote` token in the seam rejects the TC |
| GAP-C12 (new) | Adoption metric "0 manual diff re-greps" | The residue contract and its boundedness are proven; adoption is a manual trial outcome | 061 | Recorded in the success-metric table with owner (M1 rollout) and an explicit "manual evidence" verdict |
| GAP-C13 (new) | "Torn tail never repaired" as a direct observation | No repair surface exists; the oracle is file-hash equality plus a refusal | 003 | Hash before/after plus a scan asserting no truncate/repair API on the capsule runtime |
| GAP-C14 (closed — spec v1.1, S-1) | The rejection-reason vocabulary once contained the producer-less `scope-invalid`; **resolved** | The vocabulary is exactly the eight declared reasons; an out-of-set `scope` (or other required-field/closed-vocabulary violation) is a candidate schema failure → `closeout.capsule-invalid`, never a rejection | 017, 018 | Spec v1.1 removed the member and pinned the schema-failure rule (Appendix C, F-3, AC-F3-2). TC-CAP-017 asserts the eight-reason set and the schema-failure path; TC-CAP-018 asserts every emitted reason is from the eight; a ninth reason reappearing fails the contract test |
| GAP-C15 (closed — spec v1.1, S-2) | DEC-4 once implied closeout checked PM-notes completeness; **resolved** | Closeout v1 performs no PM-notes completeness check and fabricates no residue for a missing or incomplete PM-notes file; the delivered PM-notes lint/lifecycle owns it; only an unreadable review artifact yields `review-verdict-unreadable` residue | 035 | Spec v1.1 aligned F-3 and DEC-4 to that rule explicitly. TC-CAP-035 asserts no residue/verdict change for the PM-notes fixture and the review-artifact residue kind |
| GAP-C16 (closed — spec v1.1, retained v1.2, S-3) | A residue item co-occurring with a command-level failure; **resolved** | Exactly one of `data`/`error`; a command-level failure returns the error envelope with **no structured `residue[]`**; the failed step's bounded evidence (classified error summary and human diagnostic) names each refused/preserved item with count and identity; the same residue is assertable in plan mode for the same facts | 005, 034, 037 | Spec v1.1 pinned the rule in F-11 and aligned AC-F7-2, AC-F11-1, NFR-2, DoD-7, DoD-11, RSK-10. TC-CAP-005/034/037 assert evidence-plus-plan-residue and never a `data.residue` beside an `error` |
| GAP-C17 (closed — spec v1.3, R-1) | The spec once left the promotion path-escape identity unnamed; **resolved** | Two exact identities: a candidate-supplied `id`/record-name outside `^[a-z0-9][a-z0-9-]{2,63}$` (separator or `..`) is a candidate schema failure → `closeout.capsule-invalid` **before any write**; a resolved home path that does not stay under the injected memory root after realpath resolution (symlinked parent, absolute path, traversal) is a step failure → `closeout.step.capsule.failed` with zero writes, and plan mode renders `would-refuse`; no new error row | 021, 053 | Spec v1.3 pinned the rule in F-4/AC-F4-1/AC-F4-2/F-11/AC-F11-2/§21/Appendix C/DoD-4. TC-CAP-021 asserts both identities, the zero-write boundary, and the plan `would-refuse`; TC-CAP-053 asserts the family row already exists and no new row is added |

## 2. References

- **Change specification**: [chg-GH-240-spec.md](./chg-GH-240-spec.md) v1.3 — F-1..F-12, AC-F1-1..AC-F12-2 (26), EVT-1..EVT-5, DM-1..DM-10, NFR-1..NFR-11, DEC-1..DEC-16, RSK-1..RSK-11, OQ-1..OQ-5, §6 flows 1–7, §7 scope, §8 interfaces, §9 NFRs, §17.1 DoD-1..DoD-20, §18 delivery order P1..P11, §20 privacy, §21 security, Appendix C pinned vocabularies (eight rejection reasons; four diff actions with the kind→action mapping; three candidate statuses; five evidence shapes; explicit `contradicts`/`supersedes` contradiction; durable event vs applied projection; realpath-confined promotion writes; `state.lock.busy`; S-1..S-3 fixes from v1.1; R-1/R-2 pins from v1.3).
- **PM record**: [chg-GH-240-pm-notes.yaml](./chg-GH-240-pm-notes.yaml) — context only: the five PM scope decisions recorded as DEC-2, DEC-6, DEC-7, DEC-12, DEC-13. The spec is the source of truth.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test` under `tests/**/*.test.ts`, fixtures never named `*.test.ts`, permanent suites assert the current tree, goldens regenerate only by an explicit command, `pnpm check` is the aggregate gate.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, injected time/randomness/environment, the error contract, injected fakes over `mock.module`, no moving-base diff assertions, no runtime API outside the declared locations.
- **Repository rules**: [AGENTS.md](../../../../AGENTS.md) — branch model (`main-tools` integration), delivery lifecycle, memory write ownership and routing, `scripts/`/`tools/` conventions, license-header ownership.
- **Test-plan precedent**: [chg-GH-233-test-plan.md](../2026-11-06--GH-233--harness-adapters/chg-GH-233-test-plan.md) — traceable TCs, binding oracles, named mutants, execution log; [chg-GH-225-test-plan.md](../2026-11-06--GH-225--merge-verify-deploy/chg-GH-225-test-plan.md) — inherited-gap register and pinned-refinement discipline.
- **GH-233 review findings re-assessed here**: `doc/changes/2026-11/2026-11-06--GH-233--harness-adapters/code-review/review-iter-1.yaml` — F-8 (Claude file-read budget), F-9 (host-runner semantics), F-11 (store-wide orphan disclosure), each with the exact suggestion this change resolves or re-defers.
- **Delivered current truth reused, never re-implemented**:
  - Closeout transaction, steps, outcomes, ledger, bounds: [feature-closeout.md](../../../spec/features/feature-closeout.md); contracts `packages/core/src/contracts/closeout.ts`, domain `packages/core/src/domain/closeout.ts`, state `packages/core/src/state/closeout.ts`, git seam `packages/adapters/src/git/index.ts`.
  - Result contract, projection classes, error table, sync invariant, exit-literal guard: [feature-result-contract.md](../../../spec/features/feature-result-contract.md); `packages/core/src/contracts/{result,error-table}.ts`, `scripts/checks/{error-table-sync,exit-code-literals}.ts`.
  - Harness extraction, capture, warnings, store-scoped keys: [feature-harness-adapters.md](../../../spec/features/feature-harness-adapters.md); `packages/core/src/contracts/harness-telemetry.ts`, `packages/core/src/state/harness-telemetry.ts`, `packages/adapters/src/harness/**`.
  - State layer additivity, fences, `phase.transition` records, verified reads: [feature-state-layer.md](../../../spec/features/feature-state-layer.md); `packages/core/src/contracts/registry.ts`, `packages/core/src/contracts/merge.ts`.
  - Retro registry: [feature-retro-pipeline.md](../../../spec/features/feature-retro-pipeline.md); `packages/core/src/contracts/retro.ts` (`retro.run` record, `mode`, `scope`, `counts`).
  - Session administration and read-only store discipline: [feature-session-database-admin.md](../../../spec/features/feature-session-database-admin.md); `packages/core/src/contracts/db.ts`.
  - Merge transaction and squash SHA: [feature-merge-verify-deploy.md](../../../spec/features/feature-merge-verify-deploy.md).
  - Test fixtures and harnesses: `tests/fixtures/closeout/{harness,plan,temp-git,threads,harness-telemetry}.ts`, `tests/fixtures/state/harness.ts`, `tests/fixtures/harness/**`, `tests/fixtures/retro/harness.ts`, `tests/fixtures/session-admin/**`.
  - Existing suites extended, not forked: `tests/behaviour/closeout-*.test.ts`, `tests/structure/{closeout-contract,closeout-imports,error-table,result-contract}.test.ts`, `tests/golden/closeout-{envelope,human}.test.ts`, `tests/checks/{closeout-mutants,error-table-sync,exit-code-literals,fixture-sanitization}.test.ts`, `tests/types/closeout-headsha.type-test.ts`.
- **Command page (design baseline)**: [doc/planning/oss-tooling/milestones/m1/commands/closeout.md](../../../planning/oss-tooling/milestones/m1/commands/closeout.md) — the twelve-step sweep, `data.steps[]`/`residue[]`/`capsule`, exit 0/1/2, and the two error identities. Appendix A of the spec supersedes the example's residue subject text (identity-only) and pins the data-bearing exit.
- **CI**: [.github/workflows/ci.yml](../../../../.github/workflows/ci.yml) — `ts-test`, `ts-boundaries`, `ts-invariants`, `ts-license-audit`, `ts-vuln`, `ts-forbidden-literals`, `ts-aggregate`.
- **Ticket**: GitHub issue `juliusz-cwiakalski/agentic-delivery-os#240` — M1-S12: Change capsule completion and closeout expansion, five acceptance criteria and the telemetry/compaction pins.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC | Criterion (abbreviated) | TC ID(s) | Status |
|----|--------------------------|----------|--------|
| AC-F1-1 | A conventionally located change folder gains `events.jsonl` with the `delivery.capsule.event.v1` envelope (contiguous sequence, deterministic event key, LF lines, closed kind/writer) and `candidates/`; resolution is unique and no archive tree is created | TC-CAP-001, TC-CAP-002, TC-CAP-016 | Covered |
| AC-F1-2 | A torn tail, duplicate event key, non-contiguous sequence, or line after `capsule.closed` makes the capsule invalid; no append compounds the damage; nothing is truncated or repaired | TC-CAP-003, TC-CAP-012 | Covered |
| AC-F1-3 | A failed phase/commit/verify append leaves the primary outcome and state record unchanged, discloses a classified failure (a busy lock as the retryable `state.lock.busy`), and is later reported as `capsule-event-gap` residue | TC-CAP-010, TC-CAP-011 | Covered (cross-check fixture: injected state records) |
| AC-F2-1 | `phase` appends exactly one `phase.transition`, `commit` exactly one `commit.landed`, `verify` exactly one `gate.outcome` per logical occurrence, each payload bounded, and a re-run appends nothing | TC-CAP-007, TC-CAP-008, TC-CAP-009 | Covered |
| AC-F2-2 | Structurally no agent free-text write path exists, no command writes another change's capsule in phases 1–10, and every event carries a closed writer identity | TC-CAP-011, TC-CAP-057 | Covered |
| AC-F3-1 | Apply validates the capsule, ingests readable review verdicts, completes a pre-contract capsule with `capsule.opened` + `capsule.backfill-gap`, records promotion decisions, and appends exactly one terminal `capsule.closed` | TC-CAP-013, TC-CAP-015, TC-CAP-016 | Covered |
| AC-F3-2 | Malformed/torn capsule, invalid candidate (including an out-of-set `scope`, unknown `status`, or malformed evidence shape), duplicate candidate id, or zero/multiple decisions returns `closeout.capsule-invalid` (exit 1) with no promotion write; lock contention is the separate retryable `state.lock.busy`; plan mode renders `would-refuse` with zero writes, appends, and promotions | TC-CAP-012, TC-CAP-014 | Covered |
| AC-F4-1 | Every candidate has a `basis` from the capture-bar set, an `evidence` value matching one of the five declared shapes, and a `status` in `{candidate, authoritative, superseded}`; a missing/empty basis is rejected `capture-bar-unmet`, a missing/empty evidence is rejected `evidence-missing`, and neither is promoted; a duplicate is rejected with the existing id; target existence is checked first (unknown `contradicts`/`supersedes` → `supersedes-unknown`), otherwise `contradicts` without a matching `supersedes` for the same target → `contradiction-requires-supersession`; an id/record-name outside the slug shape (separator or `..`), out-of-set `scope`, unknown `status`, or non-empty malformed evidence is a schema failure (`capsule-invalid`), not a rejection | TC-CAP-017, TC-CAP-018, TC-CAP-019, TC-CAP-020 | Covered |
| AC-F4-2 | An accepted lesson/tacit writes exactly one canonical record file (declared naming, monotonic id unique across lessons+tacit) plus one bounded index row; fact/decision/norm/workflow records a sanctioned handoff without editing the home; preference/fleet is rejected with the declared reason; every candidate has exactly one decision in capsule and output; the durable event payload and the applied output projection are the two pinned shapes; a pre-existing target resolves only as byte-identical no-op, same-identity duplicate, or declared-contradiction (`contradicts` without matching `supersedes`) rejection; an id-shape violation is `capsule-invalid` and a resolved escape is `closeout.step.capsule.failed`, both with zero writes outside the root | TC-CAP-021, TC-CAP-022, TC-CAP-023 | Covered (GAP-C4 temp memory tree; path confinement in TC-CAP-021) |
| AC-F4-3 | A re-run produces no duplicate decision, record file, or index row; a previously promoted candidate is stable; a pre-existing target resolves only as byte-identical `satisfied` no-op, same-identity `duplicate:<existing-id>`, or declared-contradiction (`contradicts` without matching `supersedes`) `contradiction-requires-supersession`; no overwrite ever occurs | TC-CAP-022, TC-CAP-023, TC-CAP-055 | Covered |
| AC-F5-1 | One bounded added-line read detects the closed marker kinds; a marker naming this work item whose declared contract-data action matches its kind (`todo-marker→close-todo`, `when-merges-note→remove-guard`, `feature-flag→retire-flag`, `class-string→rename-class`) is resolved owed-flip evidence (action-less and ordinary-hyphenated-prose lines resolve when the declared action is valid); unattributed, other-ref, owner-less, explicit-out-of-vocabulary-action, and kind-mismatched markers become `ambiguous-flip-hit` residue; no source file, marker, commit, or remote is touched | TC-CAP-024, TC-CAP-025, TC-CAP-026, TC-CAP-028 | Covered (GAP-C6 fixture-pinned diffs) |
| AC-F5-2 | With no merge transaction or no resolvable diff the step is `skipped-gap` with `merged-diff-unavailable`; a re-run appends no duplicate resolved record and re-emits identical residue | TC-CAP-027, TC-CAP-055 | Covered |
| AC-F6-1 | Non-human threads resolve as delivered; human threads stay unresolved as `unresolved-human-thread` residue carrying thread identity, author principal, and bounded location only; unknown authorship is human so no unattributable thread resolves | TC-CAP-029, TC-CAP-031, TC-CAP-052 | Covered (GAP-C1 fixtures) |
| AC-F6-2 | A provider with no thread surface or unavailable signal keeps the declared gap/no-op with no fabricated residue; human threads beyond the residue cap are truncated with `+N` and none beyond the cap resolves | TC-CAP-030, TC-CAP-031 | Covered |
| AC-F7-1 | A worktree satisfying the full predicate is removed locally and recorded; an absent worktree is `satisfied` with `no-worktree` and no mutation; a re-run never removes twice | TC-CAP-036, TC-CAP-038, TC-CAP-039 | Covered (GAP-C3 temp repos) |
| AC-F7-2 | Any failed predicate condition performs no removal; apply returns `closeout.branch.unsafe` with the failed step's bounded evidence naming the retained worktree (count and identity); `worktree-retained` is assertable in plan mode/the human diagnostic and never inside the error envelope; plan renders `would-refuse` | TC-CAP-037, TC-CAP-038, TC-CAP-039 | Covered |
| AC-F8-1 | The step reads verified `retro.run` records at level `change` for the work item, appends exactly one idempotent `capsule.retro-coverage` event as `collected` or `pending`, writes no registry record, and a re-run appends nothing | TC-CAP-040 | Covered (GAP-C5 injected registry) |
| AC-F8-2 | An unreadable registry is a disclosed `skipped-gap` with `retro-registry-unavailable` evidence plus `retro-coverage-unavailable` residue, and the rest of closeout proceeds | TC-CAP-041 | Covered |
| AC-F9-1 | The step appends one `capsule.compaction-checkpoint` event with bounded session identities/count, flushed flags, unresolved-question count, and last verified commit; the harness compaction invocation is a declared gap with no invented API | TC-CAP-042, TC-CAP-044 | Covered (GAP-C2 fixtures) |
| AC-F9-2 | No sessions is `skipped-noop` with `no-sessions` and no zero checkpoint; sessions without attribution is `skipped-gap` with `session-attribution-unavailable` plus `session-attribution-gap` residue; a re-run appends no duplicate for the same digest and commit | TC-CAP-043 | Covered |
| AC-F10-1 | The production composition injects the M1-S11 capture; apply extracts read-only and appends `harness.telemetry` to the state log; the capsule carries no statistics; `spend` reads the log alone; plan mode performs no extraction or append | TC-CAP-045, TC-CAP-046 | Covered (GAP-C7 read-only proxy) |
| AC-F10-2 | GH-233 F-8 (Claude file-read budget) treats a would-exceed file as truncated-with-warning without a full read; F-11 scopes orphan disclosure to the capturing delivery with out-of-port orphans as a store-level warning; F-9 stays explicitly re-deferred with the consumer reason recorded | TC-CAP-047, TC-CAP-048, TC-CAP-049 | Covered |
| AC-F11-1 | Residue is at most 50 items, ordered deterministically by kind then location, `{item, kind, location}` from the closed kind vocabulary, body-free, with `+N` on truncation; a non-failed apply returns `data` and exits 1 with residue; plan renders residue and exits 0 unless a hard plan failure occurs; a command-level failure returns the error envelope with no structured `residue[]`, its failed-step evidence naming the refused/preserved items | TC-CAP-032, TC-CAP-033, TC-CAP-034, TC-CAP-035 | Covered |
| AC-F11-2 | A step failure carries a delivered identity where one exists, or `closeout.capsule-invalid`, or the `closeout.step.<id>.failed` family row with the slot validated against the effective step set, with the category-appropriate exit; no exit literal exists outside the projection | TC-CAP-053, TC-CAP-059 | Covered |
| AC-F12-1 | The delivered seven step ids keep identity, the new ids are additive, existing fields are unchanged, `residue`/`capsule`/`detail` are additive optional fields, consumers resolve by `stepId` and tolerate unknown ids, and no schema-version bump occurs | TC-CAP-050, TC-CAP-051, TC-CAP-052 | Covered (GAP-C10 synthetic consumer) |
| AC-F12-2 | A re-run after restart reuses every terminal outcome, duplicates no capsule event, promotion decision, thread resolution, branch deletion, worktree removal, or telemetry record, and converges with deterministic residue | TC-CAP-055 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 001..006; F-2 → 007..011; F-3 → 012..016; F-4 → 017..023; F-5 → 024..028; F-6 → 029..031; F-7 → 036..039; F-8 → 040, 041; F-9 → 042..044; F-10 → 045..049; F-11 → 032..035, 053; F-12 → 050..052, 055.

**Decision coverage**: DEC-1 → 001, 013; DEC-2 → 007, 008, 009, 011; DEC-3 → 002, 003, 004; DEC-4 → 012, 013, 014, 015; DEC-5 → 017, 018, 019, 020, 023; DEC-6 → 021, 022, 023; DEC-7 → 050, 051, 052; DEC-8 → 024, 025, 026, 027; DEC-9 → 029, 030, 031; DEC-10 → 036, 037, 038, 039; DEC-11 → 040, 041; DEC-12 → 042, 043, 044; DEC-13 → 045, 046, 047, 048, 049; DEC-14 → 032, 034; DEC-15 → 053; DEC-16 → 023, 055.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no REST/HTTP endpoint (API-#): every surface is a local command, a file-based capsule, or a local adapter read/write.

| Element | TC ID(s) | Observable assertion |
|---------|----------|----------------------|
| EVT-1 capsule event (`delivery.capsule.event.v1`) | 002, 003, 007, 008, 009, 016 | Schema id, sequence, event key, work item, run id, closed kind/writer, injected timestamp, bounded payload; append-only, LF-terminated, dedup by key, terminal close |
| EVT-2 promotion decision (`capsule.promotion`) | 016, 023 | Exact durable payload `{id, class, decision, mode?, home?, reason?, supersedes?}`: `mode`/`home` iff promoted, `reason` iff rejected, `supersedes` iff declared; one per candidate, idempotent by candidate id |
| EVT-3 compaction checkpoint | 042, 043 | Work item, bounded identities/count or counted truncation, flushed flags, unresolved count, last verified commit, declared harness gap; idempotent by digest plus commit |
| EVT-4 retro coverage | 040, 041 | Level `change`, state `collected`/`pending`, optional run id; idempotent by work item plus level |
| EVT-5 harness telemetry (`delivery.harness.telemetry.v1`, `.capture.v1`) | 045, 046, 047, 048 | Per-session-group statistics and run capture outcome in the state log; unchanged shape; never in the capsule; idempotent by group and run |
| DM-1 capsule event line | 001, 002, 003, 006, 016 | Envelope shape and file framing (see EVT-1); no state-store kind added |
| DM-2 candidate record | 017, 018, 021 | One YAML file per candidate under `candidates/`, `<id>.yaml` with a slug-safe id, closed class/scope/basis/trust/status vocabularies, mandatory evidence in one of five declared shapes, optional `rationale`/`applies_when`/`supersedes`/`contradicts` |
| DM-3 promotion decision payload | 016, 020, 021, 023 | Durable event `{id, class, decision, mode?, home?, reason?, supersedes?}`; applied output projection `{id, decision, home?, reason?}`; both recorded, distinct |
| DM-4 residue item | 025, 032, 033, 034, 035 | `{item, kind, location}`, closed eight-kind vocabulary, bounded strings, no bodies/credentials, kind-then-location order |
| DM-5 closeout additive fields | 016, 034, 050, 051 | `residue[]`, `capsule {closed, events, candidates[]}` with the projection `{id, decision, home?, reason?}`, optional step `detail`; `delivery.closeout.v1` unchanged |
| DM-6 merged-diff marker and action vocabulary | 024, 025, 028 | Four closed kinds, four closed action tokens (`remove-guard`, `retire-flag`, `rename-class`, `close-todo`), the fixed kind→action mapping, attribution rule, declared bounds; patterns are reviewed contract data |
| DM-7 worktree safety facts | 036, 037, 038, 039 | Merged evidence, convention match, exact head equality, cleanliness, current/locked/foreign checks, earlier-failure gate; no new provider field |
| DM-8 compaction checkpoint payload | 042, 043 | Bounded identities/count, flushed flags, unresolved count, last verified commit, declared gap reason |
| DM-9 retro coverage payload | 040, 041 | Level, state, optional run id; derived from a verified `retro.run` read, never a registry write |
| DM-10 `attention` projection class | 034, 053 | Additive class mapping to exit 1 for a data-bearing outcome; scripted success line unchanged; no error envelope |
| Step vocabulary and order | 050, 051, 052, 053 | Twelve ids in binding order; delivered seven preserved; `worktree-cleanup` before `branch-cleanup`; family slot validated against the effective set |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | Identical injected facts produce byte-identical capsule ordering, promotion decisions, residue, and output; zero run-to-run drift | TC-CAP-019, TC-CAP-024, TC-CAP-032, TC-CAP-054 | Covered |
| NFR-2 | ≤2,000 events and 2 MiB per capsule, ≤4 KiB per event payload, ≤100 candidates at 8 KiB each, memory index ≤200 lines; a breach refuses with a classified disclosure naming the cap and the refused/omitted count (`capsule-cap-reached` follows the F-11 envelope rule), never silent truncation | TC-CAP-005, TC-CAP-022 | Covered |
| NFR-3 | One bounded added-line diff read: ≤1 MiB diff text, ≤500 changed files, ≤200 hits; no full scan, history walk, or pagination | TC-CAP-026 | Covered |
| NFR-4 | Machine `data` ≤65,536 UTF-8 bytes; human text ≤16,384 bytes / 200 lines; residue ≤50 items; each field bounded with `+N` | TC-CAP-030, TC-CAP-032, TC-CAP-033 | Covered |
| NFR-5 | Zero rewrites, truncations, or deletions of capsule lines; zero cross-change writes in phases 1–10; torn tail refused, never repaired; capsule never compacted | TC-CAP-003, TC-CAP-010, TC-CAP-011, TC-CAP-014, TC-CAP-057 | Covered (GAP-C13 hash proxy) |
| NFR-6 | A re-run appends no duplicate event or decision, performs no second thread resolution, branch deletion, or worktree removal, and writes at most one `capsule.closed` | TC-CAP-006, TC-CAP-007, TC-CAP-009, TC-CAP-022, TC-CAP-023, TC-CAP-027, TC-CAP-038, TC-CAP-040, TC-CAP-043, TC-CAP-046, TC-CAP-055 | Covered |
| NFR-7 | Zero `harness.telemetry` records moved into the capsule or duplicated; the state log is the only `spend` source; capture non-gating | TC-CAP-045, TC-CAP-046 | Covered (GAP-C7) |
| NFR-8 | Apply p95 ≤120 s on the reference fixture; capsule validation ≤2 s; diff scan ≤5 s; session attribution ≤5 s; registry read ≤2 s | TC-CAP-056 | Covered (measurement artifact, GAP-C8) |
| NFR-9 | Zero comment bodies, titles, transcripts, diffs, tool output, credentials, or environment values in any capsule event, candidate, residue item, or output; unknown authorship is human; worktree removal satisfies the predicate 100%; promotion writes stay confined to the injected memory root (no traversal, symlink, or absolute escape) | TC-CAP-008, TC-CAP-018, TC-CAP-021, TC-CAP-029, TC-CAP-031, TC-CAP-033, TC-CAP-037, TC-CAP-039 | Covered |
| NFR-10 | Every new code documented and machine-declared in the same change; the family slot validates against the effective step set and rejects empty/malformed/unknown; no exit literal outside the projection | TC-CAP-002, TC-CAP-051, TC-CAP-053, TC-CAP-059 | Covered |
| NFR-11 | One writer per capsule; concurrent appends never interleave or corrupt a line; bounded retry; busy lock disclosed as the retryable `state.lock.busy` identity | TC-CAP-004, TC-CAP-057 | Covered (GAP-C9 boundary) |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs/NFRs**: none. All 26 ACs (AC-F1-1..AC-F12-2) and all 11 NFRs appear in §3.1/§3.3 with at least one TC.
- **Orphan TCs**: none. Every TC names at least one AC or NFR in §5.1 and §5.2; TC-CAP-054, 056, 057, 058, 059, 060, 061 name NFRs or DoD-bound ACs.
- **Partially testable, with the boundary recorded**: live thread authorship (GAP-C1), live harness stores (GAP-C2), adoption KPIs (GAP-C12), cross-process locking (GAP-C9), and the `spend` log-only read (GAP-C7) are proxied; each gap names what is proven instead.
- **Intentional duplicate coverage**: AC-F1-2 spans TC-CAP-003 (reader) and TC-CAP-012 (closeout refusal) because read-time refusal and apply-time refusal fail independently. AC-F4-2 spans 021/022/023 because routing, write idempotency, and the decision record fail independently. AC-F11-1 spans 032/033/034/035 because bounds, privacy, exit projection, and provenance fail independently. AC-F12-1 spans 050/051/052 because vocabulary, consumer tolerance, and goldens fail independently. AC-F7-1/2 span 036/037/038/039 because success, refusal, absence/order, and the no-force seam fail independently.
- **Spec consistency (resolved; retained in v1.3)**: S-1 — the rejection set is exactly eight and an out-of-set `scope` is a schema failure → `closeout.capsule-invalid` (GAP-C14); S-2 — closeout v1 performs no PM-notes completeness check and fabricates no residue for it (GAP-C15); S-3 — a command-level failure returns the error envelope with no structured `residue[]`, and the failed step's bounded evidence plus the human diagnostic name each refused/preserved item (GAP-C16); R-1 — the promotion path boundary is pinned to two exact identities (`capsule-invalid` for an id-shape violation, `closeout.step.capsule.failed` for a resolved escape, plan `would-refuse`, no new row; GAP-C17); R-2 — contradiction is a declared `contradicts`/`supersedes` pair with target-existence-first precedence (OQ-T13). No open inconsistency or under-specification remains.
- **Regression half**: existing `closeout-*`, `harness-*`, `state-*`, `retro-*`, `session-admin-*`, `commit-*`, `verify-*`, `merge-*`, `result-*`, `error-table`, `exit-code-literals`, `tests/boundaries`, and `tests/golden` suites run unchanged and prove the additive change altered no delivered behavior; `tests/golden/closeout-{envelope,human}.test.ts` are the two deliberate golden updates (TC-CAP-052).

## 4. Test Types and Layers

| Level | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Structure | `bun test tests/structure/capsule-contract.test.ts`, `tests/structure/closeout-contract.test.ts` | contracts modules; capsule and closeout contract tests | 001, 002, 006, 011, 017, 028, 032, 039, 044, 050, 053, 057 |
| Behaviour | `bun test tests/behaviour/capsule-*.test.ts`, `tests/behaviour/closeout-capsule-*.test.ts` | `packages/core/src/domain/**`, capsule file runtime, closeout domain | 003..010, 012..016, 018..027, 029..038, 040..043, 045, 046, 052, 055 |
| Provider behaviour | `bun test tests/behaviour/providers/*closeout*.test.ts` | provider adapters over injected transport fixtures | 029, 031, 047, 048 |
| Golden | `bun test tests/golden/closeout-{envelope,human,residue}.test.ts`, `tests/golden/capsule-events.test.ts` | `tests/fixtures/capsule/golden/**`, `tests/fixtures/closeout/golden/**` | 016, 034, 052 |
| Checks | `bun test tests/checks/{capsule,closeout}-mutants.test.ts`, `tests/checks/capsule-determinism.test.ts` | mutant copies; determinism harness | 026, 033, 039, 054, 056, 058, 059 |
| Types | `pnpm typecheck` with `tests/types/{capsule,closeout-attention}.type-test.ts` | contracts type surface | 002, 051 |
| Conformance | `bun test tests/conformance/capsule-events.test.ts`; `bun test tests/structure/conformance-coverage.test.ts` | `packages/testkit/src/conformance/capsule.ts` | 002, 035 |
| Integration | `bun test tests/behaviour/closeout-integration.test.ts`, `tests/behaviour/closeout-convergence.test.ts` | real JSONL state store, temp git repos, temp memory tree, in-process CLI | 010, 013, 014, 021, 036, 037, 038, 040, 042, 045, 046, 055 |
| Manual / content | review; `bash scripts/.tests/test-doc-distribution.sh` if a marker-scoped doc changes | `doc/spec/features/**`, `AGENTS.md`, `.ai/memory/README.md` | 049, 060, 061 |

### 4.1 Test harness contract (binding for every TC)

1. **Hermetic.** Every suite imports production modules and injects fakes. No suite resolves a provider network client, reads the real `process.env`, reads a real `$HOME` harness store, opens a socket, or writes the live worktree or the live `.ai/memory` tree. A suite that cannot resolve an injection seam fails naming the missing contract; it never falls back to a real surface.
2. **One injected clock and id source.** Time, run ids, fence tokens and session ids are injected and constant per case (`CLOSEOUT_NOW_MS`, `fixedRunId`). No `Date.now`, `Math.random`, locale, or timer decides correctness.
3. **Temp roots only.** Every filesystem case uses `mkdtemp` (or `tests/fixtures/closeout/temp-git.ts`) and removes the root in `afterEach`, including on failure. Capsule files are built in a temp change tree; memory homes in a temp `.ai/memory` tree; git worktrees in temp repos configured with fixed `user.name`/`user.email`, `core.autocrlf=false`, and an explicit initial branch.
4. **No moving-base diff.** Every assertion reads the current tree, a committed fixture, a temp copy, or a recorded invocation. No suite asserts `origin/main-tools...HEAD`.
5. **Goldens are read-only.** Golden files are opened read-only, compared after canonicalization, and their `mtimeMs` asserted unchanged. Regeneration is an explicit reviewed command (`bun run tests/fixtures/capsule/golden/regenerate.ts --write`), never a test side effect.
6. **Delivery-bound names.** Module paths, export names, record kind spellings, schema strings, candidate file spellings, marker patterns, cap numbers within declared ranges, and evidence renderings are delivery-bound. The vocabularies, invariants, thresholds, exits, and AC mapping are pinned and may not be rebound. A resolution failure names the missing seam.
7. **No re-implementation.** A test drives the production planner, evaluator, reader, writer, or predicate through its port; it never re-implements the rule under test to assert on itself.
8. **Fixture sanitization.** Fabricated refs, SHAs, session ids, thread ids, PR numbers, principals, and canaries only; no real repository name, person, provider payload, or credential. `tests/checks/fixture-sanitization.test.ts` covers the new fixture roots.

### 4.2 Capsule envelope, append, lock, and close oracle (binding for F-1, F-2, NFR-5, NFR-11)

**Envelope.** One event per line, LF-terminated, parseable by `JSON.parse` with a trailing newline; key set exactly `{schemaId, sequence, eventKey, workItemRef, runId, kind, writer, occurredAt, payload}` (delivery-bound spellings read from the contract, never hardcoded in the test). Assertions:

1. `schemaId === "delivery.capsule.event.v1"`; `kind` ∈ the eleven-kind set; `writer` ∈ `{phase, commit, verify, closeout}`; `workItemRef` equals the folder ref; `runId` is the injected run id; `occurredAt` equals the injected clock in ISO-8601.
2. `sequence` is contiguous from the first event: for N events, the parsed sequence list equals `[1..N]` (no gap, no repeat, no reordering).
3. `eventKey` is non-empty, stable across replay, and unique within the file; the producing run's payload has no field whose value changes between two identical runs.
4. `payload` is a bounded object (`Buffer.byteLength(JSON.stringify(payload)) ≤ 4_096`) with a per-kind declared key set; no payload key is a free-text body field.
5. `capsule.opened` is the first line when present, carries the capsule contract version and the work-item ref, and appears exactly once.
6. `capsule.closed` is the last line and appears at most once; no line follows it.

**Append-only and framing.** The reader opens the file, verifies every line parses, and refuses (never repairs) on: a final line without its terminating LF; a line that fails JSON parsing; a duplicate `eventKey`; a non-contiguous `sequence`; any line after `capsule.closed`. Refusal returns a classified condition (not a throw) and performs **zero** writes; the file's SHA-256 and byte length are identical before and after the read. The file is never rewritten, truncated, compacted, or re-sorted; a line append only ever grows the file by the new line's bytes.

**Duplicate suppression.** An append whose `eventKey` already exists is a no-op: exit outcome unchanged, file byte length unchanged, and the appended count reported as `0`. Dedup is by key, not by line index, payload equality, or timestamp.

**Lock.** The capsule file runtime exposes one exclusive append lock acquire/release pair. The oracle asserts: (a) two concurrent append attempts on the same capsule serialize so every resulting line parses and the sequence set is exactly `[1..N]` with no interleaved bytes; (b) the second attempt retries within the declared bounded retry and then either succeeds or returns `state.lock.busy`; (c) a busy lock is disclosed in output (apply: `state.lock.busy` — transient, retryable, exit 2 — with a busy detail naming the capsule lock; producer: a disclosed non-gating skip); (d) the lock is released on every path, including a failed append. `closeout.capsule-invalid` is reserved for content damage and is never used for lock contention.

**Caps and close.** Caps are read from contract data: 2,000 events, 2 MiB total, 4 KiB per payload, 100 candidates, 8 KiB per candidate, 200 memory-index lines. At cap the append or close is **refused** with the classified condition and a `capsule-cap-reached` residue (or `index-budget-exceeded` rejection at promotion); the file length is unchanged and no partial line exists. A close writes exactly one `capsule.closed` carrying decision counts, event count, and a bounded capsule digest; a re-run appends none.

**Mutant controls**: MUT-CAP-01..06.

### 4.3 Validation matrix oracle (binding for F-3, DEC-4, AC-F3-1, AC-F3-2)

The matrix is a table of fixture folders; every row asserts the same five observables: capsule validity verdict, promotion write count, capsule append count, close event count, and exit/envelope class.

| Row | Fixture | Apply expectation | Plan expectation |
|-----|---------|-------------------|------------------|
| valid | complete valid capsule, 3 candidates, 1 readable review artifact | valid; decisions recorded; exactly one close; exit by residue rule | zero writes; planned decisions rendered; exit 0 |
| pre-contract | change folder, no `events.jsonl`, no `candidates/` | creates both, `capsule.opened` + `capsule.backfill-gap` (naming the pre-contract state), proceeds, closes | no creation; planned backfill disclosed; zero writes |
| malformed line | one non-JSON line in the middle | `closeout.capsule-invalid`, exit 1, zero promotion writes | `capsule` step `would-refuse`, zero writes |
| torn tail | final line without LF / truncated JSON | same as malformed | same as malformed |
| duplicate key | two events share `eventKey` | same | same |
| sequence gap | sequences `1,2,4` | same | same |
| post-close line | an event after `capsule.closed` | same | same |
| duplicate candidate id | two files with the same `id` | same | same |
| zero decisions | candidate present, no `capsule.promotion` after a prior partial run | same | same |
| multiple decisions | candidate with two `capsule.promotion` events | same | same |
| unreadable review artifact | malformed `review-iter-1.yaml` | not invalid; `review-verdict-unreadable` residue; close proceeds | residue rendered; exit 0 |
| missing review artifact | no `code-review/**` | not invalid; no verdict event; no residue (absence is not damage) | same |

**Binding rules.** Validation is read-only and runs in both modes before any mutation; plan mode performs zero writes, appends, promotions, and fence acquisitions. `capsule-invalid` is reserved for damage that makes decisions untrustworthy; a missing mirrored event from the durable records is `capsule-event-gap` residue, not invalid. Review-verdict ingestion reads `code-review/review-iter-*.yaml` as data in deterministic filename order; a readable artifact yields exactly one `review.verdict` event per verdict entry, idempotent by its event key.

**Mutant controls**: MUT-CAP-12..15.

### 4.4 Promotion oracle (binding for F-4, DEC-5, DEC-6, AC-F4-1..3)

**Candidate schema.** One YAML file per candidate, `<id>.yaml`, `id` matching `^[a-z0-9][a-z0-9-]{2,63}$`; required keys `id`, `class`, `scope`, `statement`, `evidence`, `basis`, `source`, `trust`, `status`, `created_by`, `created`; `class` ∈ eight classes; `scope` ∈ `{change, component, repo, fleet}`; `basis` ∈ five bars; `trust` ∈ `{T0..T5}`; `status` ∈ `{candidate, authoritative, superseded}`; `evidence` is exactly one of the five declared link shapes — `review-verdict:<ref>`, `ci-verdict:<ref>`, `human-correction:<ref>`, `merged-pr:<ref>`, `test:<ref>` — with `<ref>` a non-empty bounded reference. Optional `rationale`, `applies_when`, `supersedes`, `contradicts`, promotion hint. A structural violation (required key missing, id/record-name outside the slug shape including a separator or `..`, out-of-set `scope`, unknown `status`, a **non-empty** evidence value outside the five shapes) is `closeout.capsule-invalid` in apply (F-3), not a rejection, and is detected before any write. New promoted records carry `status: candidate`; this change never writes `authoritative`; the only status rewrite it performs is the `superseded` mark on an old lesson/tacit record.

**Evaluation order (declared, single pass).** For each candidate in deterministic id order: schema → capture bar → evidence link → dedup (exact normalized-statement equality) → supersession/contradiction (**target existence first**, then the pairing rule) → target-file handling → path resolution → routing. The first failing rule determines the single decision; later rules are not evaluated. The durable `capsule.promotion` payload carries `id`, `class`, `decision`, `mode`/`home` iff promoted, `reason` iff rejected, and `supersedes` iff declared; the applied `capsule.candidates[]` projection carries only `id`, `decision`, `home?`, `reason?`.

**Reason matrix (asserted exactly).**

| Input condition | Expected decision | Expected reason/mode |
|---|---|---|
| basis absent or outside the five bars | rejected | `capture-bar-unmet` |
| evidence absent or empty string | rejected | `evidence-missing` |
| normalized statement equals an existing lesson/tacit record | rejected | `duplicate:<existing-id>` |
| normalized statement equals another candidate's (first id wins by declared order) | rejected | `duplicate:<first-id>` |
| pre-existing target with the **same identity** (candidate/record id) and different content | rejected | `duplicate:<existing-id>` |
| `contradicts` or `supersedes` names a non-existent lesson/tacit id (target existence checked first) | rejected | `supersedes-unknown` |
| `contradicts: X` without `supersedes`, or `supersedes: Y` where `Y ≠ X` | rejected | `contradiction-requires-supersession` |
| pre-existing target, different identity declaring `contradicts: <existing-id>` without matching `supersedes: <existing-id>` | rejected | `contradiction-requires-supersession` |
| `contradicts: X` with `supersedes: X`, both existing lesson/tacit ids | promoted | supersession write + `supersedes: [X]` link |
| accepted `lesson` | promoted | home-write `.ai/memory/lessons/` + one index row |
| accepted `tacit` | promoted | home-write `.ai/memory/tacit/` + one index row |
| accepted `fact` | promoted | handoff to `doc/spec/**` (recorded, home not edited) |
| accepted `decision` | promoted | handoff to `doc/decisions/**` (recorded, home not edited) |
| accepted `norm` | promoted | handoff to the `AGENTS.md` kernel (recorded, not edited) |
| accepted `workflow` | promoted | handoff to a command/skill/playbook (recorded, not edited) |
| `preference` | rejected | `home-not-implemented` |
| `fleet` | rejected | `owner-approval-required` |
| a would-be promotion that would push the index past 200 lines | rejected | `index-budget-exceeded` |
| required key missing, id/record-name outside the slug shape, out-of-set `scope`, unknown `status`, or non-empty evidence outside the five shapes | capsule-invalid (schema failure), not a rejection | — (F-3/AC-F4-1) |

**Home-write rules.** Exactly one file per decision. Record files follow the existing `lesson-YYYY-NNN-<slug>.md` / `tacit-YYYY-NNN-<slug>.md` naming, the delivered frontmatter, and the monotonic id-allocation rule: the next free `NNN` per family, unique across lessons **and** tacit, never reused (including after supersession). One index row appended per home-written record, keyed by record id, with a bounded row length; a re-run appends none. An accepted superseding record writes the new file and edits the old file's `status: superseded` in a single-file edit; the **durable `capsule.promotion` event** carries the supersession link (`supersedes` list), and the applied `capsule.candidates[]` projection does not. Fact/decision/norm/workflow handoffs are recorded as proposal data in the event and the output; no file under `doc/spec/**`, `doc/decisions/**`, `AGENTS.md`, `.opencode/**` is created, edited, or deleted by closeout.

**Contradiction (explicit, never inferred).** Dedup stays exact normalized-statement equality. A candidate declares `contradicts: <record-id>` and must also declare `supersedes: <record-id>` for the same id. Target existence is checked first: an unknown `contradicts` **or** `supersedes` target is `supersedes-unknown`; otherwise a missing or different `supersedes` for the contradicted id is `contradiction-requires-supersession`. No similarity score, embedding, or model judgment participates.

**Dedup normalization.** `statement.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ")` equality (the exact normalization is declared once in contract data and read by the test). Comparison population: existing lesson/tacit records plus the capsule's own candidates in declared id order. Exact equality only; no similarity score, no model call, no embedding.

**Pre-existing target (three outcomes, no overwrite).** A promotion target that already exists resolves as exactly one of: (a) byte-identical content → `satisfied` no-op, zero writes, no duplicate decision; (b) same identity with different content → rejected `duplicate:<existing-id>`, zero writes; (c) different identity declaring `contradicts: <existing-id>` without a matching `supersedes: <existing-id>` → rejected `contradiction-requires-supersession`, zero writes. There is no overwrite path.

**Path confinement (security boundary, exact identities).** A candidate-supplied `id` or record-name outside `^[a-z0-9][a-z0-9-]{2,63}$` (including any path separator or `..`) is a candidate schema failure → `closeout.capsule-invalid` **before any write**. A resolved home path that does not stay under the injected memory root after realpath resolution (symlinked parent, absolute path, traversal) is a step failure → `closeout.step.capsule.failed` with **zero writes anywhere**, no index row, no promoted decision; plan mode renders `would-refuse`. No new error row is added. A re-run after the root/symlink is fixed converges.

**Mutant controls**: MUT-CAP-16..20.

### 4.5 Diff-sweep oracle (binding for F-5, DEC-8, NFR-1, NFR-3)

**Anchor.** The diff source is the verified `merge.transaction` record's squash SHA and that commit's parent; one invocation shaped `diff <squashSha>^ <squashSha>` (delivery-bound argv). Absent the record, or an unresolvable SHA/parent, the step is `skipped-gap` with `merged-diff-unavailable` evidence and zero diff invocations — the step never falls back to `HEAD`, `main`, or a history walk.

**Marker and action vocabulary (closed).** Four marker kinds: `todo-marker`, `when-merges-note`, `feature-flag`, `class-string`. Four action tokens: `remove-guard`, `retire-flag`, `rename-class`, `close-todo`. Each marker's contract-data entry declares the action token it carries, and the mapping is fixed 1:1 — `todo-marker`→`close-todo`, `when-merges-note`→`remove-guard`, `feature-flag`→`retire-flag`, `class-string`→`rename-class`. Exact patterns are declared contract data (`CLOSEOUT_DIFF_MARKERS`); the oracle asserts the kind set, the action set, the mapping, the attribution predicate, and never hardcodes a pattern.

**Classification table (asserted per hit).**

| Hit shape | Attribution predicate | Expected |
|---|---|---|
| any kind, text names `<workItemRef>`, declared action equals the kind's mapped token | true | resolved: one `closeout.step` owed-flip evidence record keyed by `{filePath, lineContentHash, markerKind, workItemRef}`, reported as resolved in the step detail |
| any kind, text names another ref only | false | `ambiguous-flip-hit` residue |
| any kind, no ref attribution | false | `ambiguous-flip-hit` residue |
| `class-string`, owner not attributable | false | `ambiguous-flip-hit` residue |
| any kind, declared action outside the four tokens | false | `ambiguous-flip-hit` residue |
| any kind, declared action is a valid token but does not match the kind's mapping | false | `ambiguous-flip-hit` residue (never resolved) |
| any kind, line carries no action token, declared action is valid and the text names `<workItemRef>` | true | resolved via the declared contract-data action |

**Bounds.** One read; `Buffer.byteLength(diffText) ≤ 1_048_576`; changed files ≤500; hits ≤200 with an explicit truncation mark and omitted count. Zero `log`, `show`, `rev-list`, `fetch`, `remote`, or pagination invocations. Hits are emitted in deterministic `(filePath, lineNumber)` order.

**No mutation.** After the sweep, the temp repo's `git status --porcelain`, `git diff` bytes, `git diff --cached` bytes, and ref list are identical to the pre-run snapshot; no commit exists; no marker line is removed. The sweep never edits a source file.

**Idempotency.** A second identical run appends zero resolved records (same key) and emits byte-identical residue.

**Mutant controls**: MUT-CAP-21..23.

### 4.6 Thread-authorship oracle (binding for F-6, DEC-9, NFR-4, NFR-9)

**Normalization matrix (provider fixture → `authorKind`).**

| Root-author fixture shape | `authorKind` | Action | Residue |
|---|---|---|---|
| User principal, user actor type | `human` | never resolve | `unresolved-human-thread` |
| Bot/app actor type | `non-human` | resolve (bounded, identity-keyed, idempotent) | none |
| Mannequin (deleted/unavailable human placeholder) | `unknown` | never resolve (fail-closed) | `unresolved-human-thread` |
| Actor type absent, unmapped, or malformed | `unknown` | never resolve (fail-closed) | `unresolved-human-thread` |
| No delivery-request or thread surface (Jira) | n/a | delivered `skipped-gap` with `provider-unsupported` | none |
| Merged request observed, thread read unavailable | n/a | `skipped-noop` with `thread-signal-unavailable` | none |
| No merged request | n/a | `skipped-noop` with `no-delivery-request` | none |

**Residue shape.** Each human/unknown thread yields exactly one item: `kind: "unresolved-human-thread"`, `item` = the bounded identity rendering (thread identity plus author principal; delivery-bound spelling), `location` = the bounded thread location. Assert `item` and `location` contain the thread id and principal; assert no comment body, title, or free-form subject appears (a unique canary is planted in every body and title and must be absent from residue, output, and capsule).

**Caps.** Unresolved threads are read up to 100 per merged request, ordered by thread identity; human residue is capped at the residue cap (50) with an explicit `+N`/omitted-count mark. Every thread beyond the residue cap stays unresolved (assert the resolve log has no such thread id) and is counted in the mark. Non-human resolution is idempotent: a second run resolves zero.

**Mutant controls**: MUT-CAP-24..27.

### 4.7 Worktree predicate oracle (binding for F-7, DEC-10, NFR-6, NFR-9)

The full predicate must hold before one local removal. Each row is a temp-repo fixture; every refusal asserts: zero removal invocations, worktree directory still present, `worktree-retained` residue, and the declared outcome.

| # | Predicate condition | Fixture | Expected |
|---|---|---|---|
| 1 | Delivery observed merged | no merged request / merge transaction absent | refuse (`closeout.branch.unsafe` apply, `would-refuse` plan) |
| 2 | Worktree follows the convention | directory/branch outside `<type>/<ref>/<slug>` | refuse |
| 3 | Branch head equals merged head exactly | local head moved after merge | refuse |
| 4 | Merged head known | `headSha` absent | refuse (unknown never matches) |
| 5 | Clean worktree | one modified file (and one untracked-file case) | refuse |
| 6 | Not the current checkout | cwd inside the worktree | refuse |
| 7 | Not locked | `git worktree lock` | refuse |
| 8 | Not referenced by another worktree | same branch checked out elsewhere | refuse |
| 9 | Checkout restore succeeded when required | injected restore refusal | refuse |
| 10 | No earlier non-gap step failed | injected `failed` step outcome | refuse |
| 11 | Already absent | directory removed before run | `satisfied`, `no-worktree`, zero mutations |
| 12 | All conditions hold | clean delivery worktree at the merged head, not current | exactly one removal, recorded, then `satisfied` |

Also asserted: removal runs **before** `branch-cleanup` in the step array (assert index order, not position-only equality), so the delivery worktree no longer holds the branch when branch cleanup evaluates its own predicate; the delivered foreign-worktree branch refusal remains; and a re-run after row 12 removes nothing (the worktree is absent → row 11).

**No-force guarantee.** The git-seam operation union contains no force variant; the recorded argv for removal contains no `--force`, `-f`, `--force-with-lease`, `push`, `remote`, or shell interpolation token; the seam invokes a fixed argv array (no shell string). A negative control asserts the scanner flags a planted `--force` token and fails the TC.

**Mutant controls**: MUT-CAP-28..31.

### 4.8 Residue and exit oracle (binding for F-11, DEC-14, DEC-15)

**Kind vocabulary and provenance.** Closed eight kinds, each with exactly one producing condition:

| Kind | Producer |
|---|---|
| `unresolved-human-thread` | `comment-resolution` (human/unknown thread) |
| `ambiguous-flip-hit` | `merged-diff-sweep` (unattributed/ambiguous marker) |
| `capsule-event-gap` | capsule cross-check against `phase.transition` / `commit.telemetry` / `merge.gate-verification` state records |
| `review-verdict-unreadable` | review-artifact ingestion |
| `retro-coverage-unavailable` | retro-coverage read failure |
| `worktree-retained` | worktree cleanup refusal |
| `session-attribution-gap` | session attribution unavailable |
| `capsule-cap-reached` | capsule cap refusal at append/close |

No ninth kind, no free-form kind, no kind without a producer (TC-CAP-035 asserts both directions).

**Item contract.** Exactly `{item, kind, location}`; `item` and `location` are bounded strings (declared per-field cap), `kind` is from the closed set, arrays are omitted or empty — never `null` items. No item carries a body, title, transcript, diff, credential, or environment value.

**Order and bound.** Grouped by `kind` in the declared `RESIDUE_KIND_ORDER`, then within a kind by `location` ascending by UTF-8 byte order; total ordering is stable and replay-identical. At most 50 items; beyond the cap the list is truncated to 50 with an explicit omitted count and a rendered `+N`; truncation never drops a kind silently (a kind present beyond the cap is still represented by the mark).

**Exit matrix (asserted end-to-end through `runCli`).**

| Mode | Condition | Envelope | Exit |
|---|---|---|---|
| plan | residue present | success `data` with `residue` and `exitCode`; zero writes | 0 |
| plan | hard plan failure (`closeout.target.unobserved`) | failure `error`; no `data` | 1 |
| plan | invalid capsule | success `data` with `capsule` step `would-refuse`; zero writes | 0 |
| apply | no residue | success `data` | 0 |
| apply | ≥1 residue item | success-class `data` with `residue`; `exitCode` 1; **no** `error` sibling | 1 |
| apply | `closeout.capsule-invalid` | failure `error`; no `data`; `consequence: not_landed` | 1 |
| apply | step failure (family row) | failure `error`; no `data`, no structured `residue[]` | 1 |
| apply | worktree refusal (`closeout.branch.unsafe`) or refused cap | failure `error`; no `data`, no structured `residue[]`; bounded evidence names the retained worktree or the cap with count/identity | 1 |
| apply | provider write failure | failure `error`; no `data` | 2 |
| apply | capsule lock busy | failure `error.code === "state.lock.busy"` (transient, `retryable: true`), busy detail naming the capsule lock; no `data` | 2 |
| scripted | apply with residue | one minified `{"data":…}` line (no `schemaVersion`/`exitCode`/`timing`); process exit 1 | 1 |

No exit literal appears outside the projection module (the `exit-code-literals` invariant plus its mutation suite).

**Residue on a failing run (F-11 rule).** The result contract allows exactly one of `data`/`error`. A command-level failure returns the error envelope with **no structured `residue[]`** for that run: the failed step's bounded evidence (in the classified error summary and the human diagnostic stream) names each refused or preserved item with its count and identity — the retained worktree path/branch for `worktree-retained`, the cap and refused/omitted count for `capsule-cap-reached`. The same residue is asserted in plan mode for the same facts (which renders the item and exits 0). A test that finds `data` (or a `residue[]`) beside an `error`, or a failure envelope whose evidence omits the count and identity, fails.

**Mutant controls**: MUT-CAP-39..41.

### 4.9 Two-stream telemetry oracle (binding for F-10, DEC-13, NFR-7)

1. **Composition.** The production closeout composition (not a test-only composition) constructs and injects the M1-S11 capture capability. Assert the composer's runtime object exposes the capture capability and that apply calls `extract` after the terminal steps and before the applied payload is assembled (recorded call order).
2. **Landing.** After apply, read the state store through its public verified read API: `harness.telemetry` records exist under `harness.telemetry:<workItemRef>` (one per captured group) and one capture-outcome record under `harness-telemetry-capture:<workItemRef>:<runId>`. Assert payload schema ids, count parity with the injected fixture's session groups, and the unchanged delivered shape.
3. **Separation.** The capsule `events.jsonl` contains no telemetry payload: assert no capsule event carries `tokens`, `calls`, `cost`, `tokenSpend`, a `delivery.harness.telemetry.*` schema id, or a telemetry warning vocabulary value; assert the state log contains no capsule-only event kind (`capsule.opened`, `capsule.promotion`, `capsule.retro-coverage`, `capsule.compaction-checkpoint`, `capsule.backfill-gap`, `capsule.closed`). Assert a capture-enabled apply and a capture-disabled apply produce byte-identical `events.jsonl` with the same injected facts (the strongest separation control).
4. **Log-only readback.** Deny the harness store (unlink the temp store; make the extractor throw on any call), then read the statistics from the state log; assert every figure is present and the extractor recorded zero calls (the `spend` proxy, GAP-C7).
5. **Non-gating and plan silence.** A thrown extract, a failed append, and a missing store change no step outcome, summary, or verdict; plan mode records zero extract and zero append calls and performs zero fence acquisitions.
6. **Idempotency.** A re-run appends zero duplicate `harness.telemetry` records; one new session group appends exactly one new record.

**Mutant controls**: MUT-CAP-35..38.

### 4.10 Contract-evolution oracle (binding for F-12, DEC-7, NFR-10)

- `CLOSEOUT_STEP_IDS` is exactly twelve ids in the Appendix C order; all seven delivered ids are present with unchanged spelling; `worktree-cleanup` index < `branch-cleanup` index; `capsule` is last; no duplicate id.
- `CLOSEOUT_SCHEMA_ID` remains `delivery.closeout.v1`; `residue`, `capsule`, and step `detail` are optional additive fields; no delivered field is removed or renamed (compare the delivered `CloseoutData`/`CloseoutStep` key sets against a committed shape fixture updated in this change).
- A synthetic legacy consumer (`tests/fixtures/closeout/legacy-consumer.ts`) imports the payload type, resolves steps by `stepId`, reads an injected unknown step id `future-step` without throwing, and ignores unknown optional fields. MUT-CAP-42 (a positional indexer) must fail this TC.
- Goldens for the closeout envelope and human digest are regenerated for the twelve-step list and the human-thread behavior change only; the diff is reviewed, and any other byte change fails TC-CAP-052.

**Mutant controls**: MUT-CAP-42..44.

### 4.11 Mutant register and non-vacuity contract

**Rules binding every mutant.**

1. Each mutant is a temp copy of the production module with exactly one named guard disabled; the copy is never committed and never imported by production.
2. The mutant's killing suite must **fail**, and the failure message must name the mutant id. A mutant that passes fails the meta-check (TC-CAP-058) — a passing mutant is a test defect, not a code success.
3. Each mutant names the exact assertion it breaks, so a reviewer can confirm the assertion exists and is the one that fired.
4. Every negative, absence, and bound scenario is paired with a live positive control in the same file (a valid capsule beside a torn one, a resolvable evidence link beside a missing one, a removable worktree beside a refused one, a captured record beside a denied store).
5. Case and scan floors: every conformance and matrix suite asserts its case count before iterating; every static scan asserts a non-zero file count.
6. Each golden comparison is paired with a one-field mutation asserting inequality, then restored and asserted equal.

| Mutant | Capability | Mutated rule | Killing TC | Exact assertion broken |
|---|---|---|---|---|
| MUT-CAP-01 | F-1 | Reader dedups by line index instead of `eventKey` | TC-CAP-003 | "the second line with the same `eventKey` is refused; file hash unchanged" |
| MUT-CAP-02 | F-1 | Reader accepts a torn tail (parses the prefix) | TC-CAP-003 | "the reader returns the torn-tail condition naming the final position; zero bytes written" |
| MUT-CAP-03 | F-1 | Sequence check is monotonic-only, not contiguous | TC-CAP-003 | "sequence `[1,2,4]` is refused naming the gap" |
| MUT-CAP-04 | F-1 | Append lock acquire is a no-op | TC-CAP-004 | "two concurrent appends never interleave; every line parses; sequences are exactly `1..N`" |
| MUT-CAP-05 | F-1 | Cap breach truncates instead of refusing | TC-CAP-005 | "the append is refused, file length unchanged, `capsule-cap-reached` residue present" |
| MUT-CAP-06 | F-1 | `capsule.closed` does not block a later append | TC-CAP-006 | "an append after the close is refused; event count stays N; one close only" |
| MUT-CAP-07 | F-2 | `phase` event key omits the commit SHA | TC-CAP-007 | "a completion at a different SHA appends exactly one new event" |
| MUT-CAP-08 | F-2 | `commit` payload carries the message body | TC-CAP-008 | "payload key set is the declared bounded set and the body canary is absent" |
| MUT-CAP-09 | F-2 | `verify` event key omits the head SHA | TC-CAP-009 | "a re-evaluation at a new head appends exactly one new event" |
| MUT-CAP-10 | F-2 | A capsule append failure fails the primary command | TC-CAP-010 | "phase/commit/verify outcome, state record, and exit code are unchanged" |
| MUT-CAP-11 | F-2 | Producer resolves by slug match across all months without stopping | TC-CAP-011 | "exactly one capsule file is written; sibling change folders are byte-unchanged" |
| MUT-CAP-12 | F-3 | Plan mode appends `capsule.opened` | TC-CAP-014 | "zero bytes written under the change tree in plan mode" |
| MUT-CAP-13 | F-3 | Malformed review artifact maps to capsule-invalid | TC-CAP-015 | "the step is not capsule-invalid; residue kind is `review-verdict-unreadable`; close proceeds" |
| MUT-CAP-14 | F-3 | Two promotion events for one candidate accepted | TC-CAP-012 | "two decisions is capsule-invalid; zero promotion writes" |
| MUT-CAP-15 | F-3 | A second `capsule.closed` appended on re-run | TC-CAP-016 | "exactly one `capsule.closed` event; close count is 1" |
| MUT-CAP-16 | F-4 | Missing evidence is promoted when the basis is present | TC-CAP-018 | "decision is rejected `evidence-missing`; zero home writes" |
| MUT-CAP-17 | F-4 | Dedup compares the raw statement (no normalization) | TC-CAP-019 | "a case/whitespace variant is rejected `duplicate:<id>`" |
| MUT-CAP-18 | F-4 | `preference` is home-written | TC-CAP-021 | "`preference` is rejected `home-not-implemented`; no preferences path exists" |
| MUT-CAP-19 | F-4 | Index row is appended on every run | TC-CAP-022 | "a re-run leaves index bytes and line count unchanged" |
| MUT-CAP-20 | F-4 | A `fact` candidate edits `doc/spec/**` | TC-CAP-021 | "no file under `doc/` changed; handoff recorded" |
| MUT-CAP-21 | F-5 | `class-string` without an owner auto-resolves | TC-CAP-025 | "`ambiguous-flip-hit` residue present; resolved count unchanged" |
| MUT-CAP-22 | F-5 | Diff read walks history (`git log -p`) | TC-CAP-026 | "exactly one diff invocation with the squash SHA and parent; zero log/show invocations" |
| MUT-CAP-23 | F-5 | Missing merge transaction falls back to `HEAD~1` | TC-CAP-027 | "step is `skipped-gap` with `merged-diff-unavailable`; zero diff invocations" |
| MUT-CAP-24 | F-6 | `unknown` authorship resolves as non-human | TC-CAP-029 | "the unknown thread is unresolved and appears as residue" |
| MUT-CAP-25 | F-6 | A human thread is resolved by a fallback path | TC-CAP-029 | "the human thread id is absent from the resolve log; residue present" |
| MUT-CAP-26 | F-6 | Residue carries the comment body | TC-CAP-033 | "the body canary is absent from residue, output, and capsule" |
| MUT-CAP-27 | F-6 | Human threads beyond the cap are dropped without a mark | TC-CAP-030 | "omitted count/`+N` present; no beyond-cap thread resolved" |
| MUT-CAP-28 | F-7 | Removal argv includes `--force` | TC-CAP-039 | "argv contains no force token; the seam has no force variant" |
| MUT-CAP-29 | F-7 | Head-equality check removed | TC-CAP-037 | "moved-head fixture retains the worktree and reports `worktree-retained`" |
| MUT-CAP-30 | F-7 | Cleanup runs on the current checkout | TC-CAP-037 | "current-checkout fixture performs zero removals" |
| MUT-CAP-31 | F-7 | Dirty worktree is removed | TC-CAP-037 | "dirty fixture performs zero removals and returns `closeout.branch.unsafe`" |
| MUT-CAP-32 | F-8 | Retro coverage writes a synthetic `retro.run` | TC-CAP-040 | "registry file hash and run count unchanged" |
| MUT-CAP-33 | F-9 | A zero checkpoint is written with no sessions | TC-CAP-043 | "no `capsule.compaction-checkpoint`; outcome `skipped-noop` with `no-sessions`" |
| MUT-CAP-34 | F-9 | Attribution falls back to the most recent session | TC-CAP-043 | "no checkpoint event; `session-attribution-gap` residue present" |
| MUT-CAP-35 | F-10 | Telemetry statistics copied into the capsule | TC-CAP-045 | "no capsule event carries token/call/cost fields; capture-on and capture-off capsule bytes are identical" |
| MUT-CAP-36 | F-10 | Plan mode runs extraction | TC-CAP-046 | "extractor call count is zero in plan mode" |
| MUT-CAP-37 | F-10 | Claude file fully read before the byte cap | TC-CAP-047 | "bytes read ≤ cap; `truncated` warning present; no full-transcript read" |
| MUT-CAP-38 | F-10 | Orphan disclosure is store-wide | TC-CAP-048 | "failed count equals the capturing delivery's own failures only" |
| MUT-CAP-39 | F-11 | Residue ordered by insertion | TC-CAP-032 | "items are grouped by declared kind order and sorted by location within a kind" |
| MUT-CAP-40 | F-11 | Residue emitted as an error envelope | TC-CAP-034 | "exit 1 with `data.residue` present and no `error` sibling" |
| MUT-CAP-41 | F-11 | Family row accepts an undeclared step id | TC-CAP-053 | "empty/malformed/unknown slot rejected; declared id accepted" |
| MUT-CAP-42 | F-12 | Consumer fixture indexes steps positionally | TC-CAP-051 | "the legacy consumer resolves `future-step` by id and completes" |
| MUT-CAP-43 | F-12 | Schema id bumped to `delivery.closeout.v2` | TC-CAP-050 | "`schemaId` is `delivery.closeout.v1`" |
| MUT-CAP-44 | F-12 | Re-run re-executes a terminal operation | TC-CAP-055 | "zero new provider/git mutations on re-run" |

**Case floor**: 44 mutants, at least one per F-1..F-12; a register with a capability uncovered fails TC-CAP-058.

## 5. Test Scenarios

### 5.1 Scenario Index

`TC-CAP` is a new prefix with no prior use in the repository; no existing TC identifier is reused. The plan holds **61 scenarios**, TC-CAP-001..TC-CAP-061, each present in this index, in §5.2, in the §7 automation mapping, and in the §10 execution log. The delivery phase column is the spec §18 delivery-order phase in which the TC is completed.

| TC ID | Title | Level | Impact | Priority | AC / NFR | Phase |
|-------|-------|-------|--------|----------|----------|-------|
| TC-CAP-001 | Capsule location resolution and creation discipline | Structure | Critical | High | AC-F1-1; F-1; DM-1; DEC-1 | P1 |
| TC-CAP-002 | Capsule event envelope and closed vocabularies | Structure, Conformance | Critical | High | AC-F1-1; F-1; DM-1; EVT-1; NFR-10 | P1 |
| TC-CAP-003 | Append-only reader guards: torn tail, duplicate key, sequence gap, post-close line | Behaviour | Critical | High | AC-F1-2; F-1; NFR-5 | P1 |
| TC-CAP-004 | Per-capsule append lock and bounded retry | Behaviour | Critical | High | AC-F1-1; F-1; NFR-5, NFR-11 | P1 |
| TC-CAP-005 | Capsule caps enforced with refusal, never truncation | Behaviour | Critical | High | AC-F1-1; F-1; NFR-2 | P1 |
| TC-CAP-006 | Terminal `capsule.closed` exactly once | Behaviour | Critical | High | AC-F3-1; F-1, F-3; NFR-6 | P1 |
| TC-CAP-007 | `phase` producer: one `phase.transition` per landing, idempotent | Behaviour | Critical | High | AC-F2-1; F-2; DEC-2; NFR-6 | P2 |
| TC-CAP-008 | `commit` producer: one `commit.landed` per landing, body-free | Behaviour | Critical | High | AC-F2-1; F-2; DEC-2; NFR-9 | P2 |
| TC-CAP-009 | `verify` producer: one `gate.outcome` per gate evaluation | Behaviour | Critical | High | AC-F2-1; F-2; DEC-2; NFR-6 | P2 |
| TC-CAP-010 | Non-gating append failure: classified, disclosed, outcome unchanged | Integration | Critical | High | AC-F1-3; F-2; DEC-2; NFR-5 | P2 |
| TC-CAP-011 | Writer ownership, self-containment, and `capsule-event-gap` cross-check | Structure, Integration | Critical | High | AC-F2-2, AC-F1-3; F-1, F-2; DEC-2; NFR-5 | P2 |
| TC-CAP-012 | Capsule validation matrix refuses damage with no promotion | Integration | Critical | High | AC-F3-2, AC-F1-2; F-3; DEC-4 | P3 |
| TC-CAP-013 | Pre-contract capsule completion with backfill gap | Integration | Critical | High | AC-F3-1; F-3; DEC-4 | P3 |
| TC-CAP-014 | Plan-mode zero writes and `would-refuse` rendering | Integration | Critical | High | AC-F3-2, AC-F3-1; F-3; DEC-4; NFR-5 | P3 |
| TC-CAP-015 | Review-verdict ingestion and unreadable-verdict residue | Integration | Important | High | AC-F3-1; F-3; DEC-4 | P3 |
| TC-CAP-016 | Applied capsule payload and decision mirror | Golden, Integration | Critical | High | AC-F3-1, AC-F4-2; F-3; DM-5; DEC-14 | P3 |
| TC-CAP-017 | Candidate schema and closed vocabularies | Structure | Critical | High | AC-F4-1; F-4; DM-2; DEC-5 | P4 |
| TC-CAP-018 | Capture bar and evidence gate: closed rejection reasons, no silent skip | Behaviour | Critical | High | AC-F4-1; F-4; DEC-5; NFR-9 | P4 |
| TC-CAP-019 | Deterministic dedup against memory and sibling candidates | Behaviour | Critical | High | AC-F4-1; F-4; DEC-5; NFR-1 | P4 |
| TC-CAP-020 | Supersession and contradiction handling | Behaviour | Critical | High | AC-F4-1; F-4; DEC-5 | P4 |
| TC-CAP-021 | Promotion routing matrix: home writes and sanctioned handoffs | Integration | Critical | High | AC-F4-2; F-4; DEC-6 | P4 |
| TC-CAP-022 | Home-write and index-row idempotency; index budget | Behaviour | Critical | High | AC-F4-2, AC-F4-3; F-4; DEC-6; NFR-2, NFR-6 | P4 |
| TC-CAP-023 | One promotion decision per candidate, idempotent by candidate id | Integration | Critical | High | AC-F4-2, AC-F4-3; F-4; EVT-2; DEC-5, DEC-16 | P4 |
| TC-CAP-024 | Merged-diff sweep: attributed hits across four marker kinds | Behaviour | Critical | High | AC-F5-1; F-5; DM-6; DEC-8 | P5 |
| TC-CAP-025 | Ambiguous-hit classification and residue | Behaviour | Important | High | AC-F5-1; F-5; DM-4, DM-6; DEC-8 | P5 |
| TC-CAP-026 | Diff-scan budget and zero source/remote mutation | Checks, Integration | Critical | High | AC-F5-1; F-5; NFR-3; DEC-8 | P5 |
| TC-CAP-027 | `merged-diff-unavailable` gap and re-run stability | Behaviour | Important | High | AC-F5-2; F-5; DEC-8; NFR-6 | P5 |
| TC-CAP-028 | Marker vocabulary as declared contract data | Structure | Important | Medium | AC-F5-1; F-5; DM-6; §22 | P5 |
| TC-CAP-029 | Thread authorship policy: human leaves residue, non-human resolves, unknown is human | Provider behaviour | Critical | High | AC-F6-1; F-6; DM-4; DEC-9; NFR-9 | P5 |
| TC-CAP-030 | Thread and residue caps with explicit truncation | Behaviour | Important | High | AC-F6-2; F-6; NFR-4 | P5 |
| TC-CAP-031 | Thread residue is identity-only; no-surface providers fabricate nothing | Provider behaviour, Checks | Critical | High | AC-F6-1, AC-F6-2; F-6; DEC-9; NFR-9 | P5 |
| TC-CAP-032 | Residue item contract: closed kinds, bounds, deterministic order | Structure, Behaviour | Critical | High | AC-F11-1; F-11; DM-4; NFR-1, NFR-4 | P6 |
| TC-CAP-033 | Residue is body-free: privacy canary across every artifact | Checks | Critical | High | AC-F11-1; F-11; NFR-9; §20 | P6 |
| TC-CAP-034 | Attention exit matrix: apply `data` + exit 1, plan exit 0 | Golden, Integration | Critical | High | AC-F11-1; F-11; DM-10; DEC-14 | P6 |
| TC-CAP-035 | Residue provenance completeness: every kind has a producer, none is fabricated | Behaviour, Conformance | Important | High | AC-F11-1; F-11; DEC-14 | P6 |
| TC-CAP-036 | Worktree cleanup success: full predicate, one local removal, no force | Integration | Critical | High | AC-F7-1; F-7; DM-7; DEC-10 | P7 |
| TC-CAP-037 | Worktree refusal matrix preserves the worktree | Integration | Critical | High | AC-F7-2; F-7; DEC-10; NFR-9 | P7 |
| TC-CAP-038 | Absent worktree, re-run no second removal, ordering before branch cleanup | Integration | Critical | High | AC-F7-1, AC-F7-2; F-7; NFR-6 | P7 |
| TC-CAP-039 | Git seam gains one no-force, no-shell, local capability | Structure, Checks | Critical | High | AC-F7-1, AC-F7-2; F-7; DEC-10; NFR-9 | P7 |
| TC-CAP-040 | Retro coverage recorded as collected or pending; no registry write | Integration | Critical | High | AC-F8-1; F-8; DM-9; EVT-4; DEC-11; NFR-6 | P8 |
| TC-CAP-041 | Unreadable retro registry is a declared gap and residue | Behaviour | Important | High | AC-F8-2; F-8; DEC-11 | P8 |
| TC-CAP-042 | Compaction checkpoint content and attribution seam | Integration | Critical | High | AC-F9-1; F-9; DM-8; EVT-3; DEC-12 | P8 |
| TC-CAP-043 | No sessions, attribution unavailable, same-digest re-run, no zero checkpoint | Behaviour | Critical | High | AC-F9-2; F-9; DEC-12; NFR-6 | P8 |
| TC-CAP-044 | No invented harness compaction API; `db` surface unchanged | Structure | Critical | High | AC-F9-1; F-9; DEC-12; NG-3, NG-7 | P8 |
| TC-CAP-045 | Production telemetry wiring: state log receives, capsule does not | Integration | Critical | High | AC-F10-1; F-10; EVT-5; DEC-13; NFR-7 | P9 |
| TC-CAP-046 | Capture is non-gating, plan-mode silent, and idempotent | Integration | Critical | High | AC-F10-1; F-10; DEC-13; NFR-6, NFR-7 | P9 |
| TC-CAP-047 | GH-233 review F-8: Claude file-read budget before the read | Behaviour | Critical | High | AC-F10-2; F-10; DEC-13; RSK-6 | P9 |
| TC-CAP-048 | GH-233 review F-11: orphan disclosure scoped to the capturing delivery | Provider behaviour | Important | High | AC-F10-2; F-10; DEC-13 | P9 |
| TC-CAP-049 | GH-233 review F-9 explicitly re-deferred with the consumer reason recorded | Structure, Manual | Important | Medium | AC-F10-2; F-10; DEC-13 | P9 |
| TC-CAP-050 | Step vocabulary, binding order, and schema identity | Structure | Critical | High | AC-F12-1; F-12; DM-5; DEC-7 | P10 |
| TC-CAP-051 | Additive contract with consumer tolerance for unknown step ids | Types, Structure | Critical | High | AC-F12-1; F-12; DM-5; DEC-7; NFR-10 | P10 |
| TC-CAP-052 | Goldens updated for twelve steps and the human-thread behavior change | Golden | Important | High | AC-F12-1, AC-F6-1; F-12, F-6; DEC-7 | P10 |
| TC-CAP-053 | New error identities: `capsule-invalid` and the step-failure family | Structure, Checks | Critical | High | AC-F11-2; F-11; NFR-10; DEC-15 | P10 |
| TC-CAP-054 | Determinism: byte-identical replay over injected facts | Checks | Critical | High | NFR-1; F-11; DEC-14 | P11 |
| TC-CAP-055 | Full re-run convergence after restart | Integration | Critical | High | AC-F12-2; F-12; NFR-6; DEC-16 | P11 |
| TC-CAP-056 | Latency budgets on reference fixtures | Checks | Important | Medium | NFR-8 | P11 |
| TC-CAP-057 | Self-containment and state additivity: no cross-change writes, no state kind | Structure | Critical | High | AC-F2-2; NFR-5, NFR-11; §8.5, §19 | P11 |
| TC-CAP-058 | Mutant meta-check: every named guard fails by name | Checks | Critical | High | All ACs; NFR-1..NFR-11 | P11 |
| TC-CAP-059 | Quality-gate battery, wiring, inventory, and changeset | Checks | Important | High | NFR-10; DoD-17, DoD-18 | P11 |
| TC-CAP-060 | Documentation reconciliation posture | Manual | Important | Medium | AC-F11-2, AC-F12-1; DoD-19 | P11 |
| TC-CAP-061 | Success-metric evidence table | Manual | Important | High | §4.1 metrics; DoD-16 | P11 |

### 5.2 Scenario Details

#### TC-CAP-001 - Capsule location resolution and creation discipline

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DEC-1
**Level**: structure
**Test Type(s)**: Unit, Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/capsule-contract.test.ts`; the change-folder resolver (the delivered month-scan locator extended for the capsule)
**Tags**: @backend, @contract, @struct
**Delivery phase**: P1

**Preconditions**:

- A temp `doc/changes/` tree with month directories created out of order and two folders inside one month.
- The delivered plan-artifact/pm-notes month-scan locator is available as the reference behaviour.

**Steps**:

1. Resolve a ref whose folder sits in the later of two months; assert the resolver walks months ascending and folder names ascending and returns that folder.
2. Add a second folder containing `--<ref>--` in an earlier month; assert the earlier folder wins (first match, DEC-1) and the returned path is stable across a replay.
3. Assert an exact token match: a folder named with `--<ref>0--` is not selected for `<ref>`.
4. Resolve an absent ref; assert a classified "location unavailable" condition (delivery-bound spelling) with zero creation — no month directory, no change folder, no `events.jsonl`, no `candidates/`.
5. Snapshot the temp tree (paths, byte hashes, mtimes) before and after every resolution; assert unchanged.
6. Resolve through the appenders and closeout; assert the same folder is used (one convention, no second locator).
7. Assert no archive tree is created anywhere after a close: the folder path is unchanged and no `archive/`, `closed/`, or relocation target exists.

**Oracle / binding assertion**:

- The resolver's returned path equals the first folder in `(month ascending, folder name ascending)` whose name contains the exact `--<ref>--` token.
- Resolution performs zero filesystem mutations: the pre/post tree snapshot is byte-identical.
- Creation happens only in the capsule runtime: `events.jsonl` and `candidates/` appear only when an append/write path runs (F-1, F-3), never during resolution.

**Expected Outcome**:

- One deterministic capsule location per ref; resolution is read-only; an absent folder is a classified condition; no archive tree exists.

**Mutant control**: none directly; the resolution order is killed by MUT-CAP-11's sibling-folder assertion and TC-CAP-011.

#### TC-CAP-002 - Capsule event envelope and closed vocabularies

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, EVT-1, NFR-10
**Level**: structure, conformance
**Test Type(s)**: Unit, Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/capsule-contract.test.ts`, `tests/conformance/capsule-events.test.ts`, `tests/types/capsule.type-test.ts`; `packages/testkit/src/conformance/capsule.ts`
**Tags**: @backend, @contract, @conformance
**Delivery phase**: P1

**Preconditions**:

- The capsule contracts module exports the schema id, the kind and writer vocabularies, and the payload types as `as const` data.
- The capsule conformance registry can be built from the production vocabularies.

**Steps**:

1. Assert the schema id is exactly `delivery.capsule.event.v1`.
2. Assert the event-kind set is exactly the eleven declared kinds and the writer set exactly `{phase, commit, verify, closeout}`; assert no duplicates, no wildcard, no `unknown`/`any` member.
3. Assert the required envelope key set is exactly `{schemaId, sequence, eventKey, workItemRef, runId, kind, writer, occurredAt, payload}` via a parse of a written event.
4. Write one event of every kind through the public capsule writer in a lifecycle-valid order (`capsule.opened` first, `capsule.closed` last, the remaining nine between); assert contiguity `1..11`, unique keys, LF termination (every line ends `\n` and no line contains `\r`), and `occurredAt` equal to the injected clock.
5. Assert each payload's serialized size ≤4 KiB and its key set equals the per-kind declared set; assert no payload key is named or shaped like a body/title/transcript field.
6. Conformance: register all eleven kinds with their writer; assert the coverage meta-check fails a registered kind with no producer case and fails a kind missing from the registry; assert the shipped registry covers the vocabulary exactly (bijection).
7. Type test: a literal kind or writer outside the closed set fails `pnpm typecheck`; a widened `string` is not assignable; a payload type cannot carry an extra required field.
8. Static: the contracts module contains no runtime-API import, no I/O, no clock; it imports only `./` contract modules.

**Oracle / binding assertion**:

- `kinds.length === 11`, `writers.length === 4`, both duplicate-free; the registry↔vocabulary bijection holds.
- Every written line parses, ends in exactly one LF, and the parsed envelope key set equals the pinned set (extra or missing key fails).
- Sequence list equals `[1..N]`; event keys are pairwise distinct.

**Expected Outcome**:

- One precise, machine-checkable envelope; the vocabularies are closed and exhaustively registered; the contract tier is data-only.

**Mutant control**: envelope and key-set shape support MUT-CAP-01/03; the registry coverage fails a missing kind.

#### TC-CAP-003 - Append-only reader guards: torn tail, duplicate key, sequence gap, post-close line

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-5, DEC-3
**Level**: behaviour
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/capsule-reader.test.ts`; `tests/fixtures/capsule/events/**`
**Tags**: @backend, @negative, @integrity
**Delivery phase**: P1

**Preconditions**:

- Committed fixture lines and a builder that writes a temp capsule from a line list.
- A valid 5-event capsule as the live positive control in the same file.

**Steps**:

1. Read the valid capsule; assert 5 events parse, sequences `1..5`, and the read reports valid.
2. Torn tail: drop the final LF (and separately truncate mid-JSON); read; assert the capsule is invalid with the final position named; assert the file hash, byte length, and `mtimeMs` are unchanged.
3. Duplicate key: write a sixth line repeating line 3's `eventKey`; assert invalid naming the duplicate key; no bytes written.
4. Sequence gap: sequences `1,2,4`; assert invalid naming the gap position.
5. Sequence repeat/reorder: `1,2,2,3`; assert invalid.
6. Post-close line: append a line after `capsule.closed`; assert invalid naming the position after the terminal event.
7. CRLF framing: rewrite all lines with `\r\n`; assert the declared LF-framing condition fails (a line with a trailing `\r` is a framing violation, not a valid line).
8. Attempt an append through the writer to every invalid fixture; assert refusal with zero bytes written (no compounding damage).
9. Scan the capsule runtime's exported surface for any truncate/repair/rewrite/compact operation; assert none exists (GAP-C13).

**Oracle / binding assertion**:

- Every invalid fixture returns a classified condition (not a throw, not a boolean) and the reader performs zero writes: `sha256(file)` and `stat.size` are identical before and after.
- The valid control still reads as valid after each negative case (the fixture writer is not corrupting shared state).
- No repair API is reachable from the runtime's exports.

**Expected Outcome**:

- Appended-only, framing-strict, fail-closed reads; damage is refused, never silently repaired or truncated.

**Mutant control**: MUT-CAP-01, MUT-CAP-02, MUT-CAP-03.

#### TC-CAP-004 - Per-capsule append lock and bounded retry

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-5, NFR-11
**Level**: behaviour
**Test Type(s)**: Integration, Performance (bounded retry only)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/capsule-lock.test.ts`; the capsule file runtime over a temp directory
**Tags**: @backend, @concurrency, @integrity
**Delivery phase**: P1

**Preconditions**:

- A temp capsule with an empty `events.jsonl`.
- N distinct event keys (N = 8) and one injected slow lock holder.

**Steps**:

1. Start N concurrent appends with the same injected clock and distinct keys; await all; assert every append reported success or a classified busy condition.
2. Re-read the file; assert every line parses, sequences are exactly `1..M` (M = successful appends), and no line is a partial/merged write.
3. Hold the lock with a slow holder (injected delay in the fake timer) and attempt one append; assert retry is bounded (attempt count ≤ declared max, no unbounded wait) and then either succeeds after release or returns the busy condition.
4. Assert a busy lock is disclosed as the retryable `state.lock.busy` identity with a busy detail naming the capsule lock: the producer path emits the classified skip in output; closeout apply returns `state.lock.busy` (transient, `retryable: true`, exit 2) and never `closeout.capsule-invalid`.
5. Force the append to fail after lock acquisition; assert the lock is released (a following append succeeds immediately with a fresh token).
6. Assert the lock is per capsule: concurrent appends to two different capsules proceed without serializing each other.
7. Assert no lock file remains after a clean run; the temp capsule directory contains only the contract artifacts.

**Oracle / binding assertion**:

- The parsed sequence set across concurrent writers is exactly `[1..M]` with no duplicates and no gaps; no line contains two JSON objects.
- The retry attempt count never exceeds the declared bound and the call never sleeps unbounded (injected timer records scheduled waits).
- Lock contention is `state.lock.busy` (transient, retryable, exit 2) with the busy detail; `closeout.capsule-invalid` is never emitted for contention.
- Lock release is observed on both the success and failure paths.

**Expected Outcome**:

- One writer at a time per capsule with bounded retry and explicit busy disclosure; no interleaved or corrupt line.

**Mutant control**: MUT-CAP-04.

#### TC-CAP-005 - Capsule caps enforced with refusal, never truncation

**Scenario Type**: Boundary
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-2, DEC-1
**Level**: behaviour
**Test Type(s)**: Unit, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/capsule-bounds.test.ts`; `tests/fixtures/capsule/caps.ts`
**Tags**: @backend, @bounds
**Delivery phase**: P1

**Preconditions**:

- Contract data exposes the five capsule caps and the index cap (2,000 events, 2 MiB, 4 KiB payload, 100 candidates, 8 KiB candidate, 200 index lines).
- Builders can produce a capsule exactly at and one unit over each cap.

**Steps**:

1. At the event cap: write exactly 2,000 events; append one more; assert the append is refused, `events.jsonl` length is unchanged, and the refusal is a classified condition carrying the cap kind (the `capsule-cap-reached` residue surfacing is asserted at the closeout layer in TC-CAP-035).
2. At the byte cap: build a capsule at ≤2 MiB; append a payload that would exceed it; assert refusal and unchanged bytes.
3. At the payload cap: append a 4,096-byte payload (accepted); append 4,097 bytes (refused, classified, no partial line).
4. At the candidate cap: place 100 candidate files (accepted); add a 101st; assert the 101st is refused and no file is written to a home.
5. At the candidate-size cap: an 8 KiB candidate is valid; 8 KiB + 1 fails the schema/size check and cannot be promoted.
6. Assert no cap breach ever produces a partial line, a truncation, or a close event that claims success: the close either succeeds within the cap or is refused with the classified condition carrying the cap and refused/omitted count (NFR-2 "refuse, never silent truncation"). When the refusal ends the run in a command-level failure, assert the error envelope carries that count in bounded evidence and no structured `residue[]`; the `capsule-cap-reached` residue is asserted in plan mode for the same facts (F-11 rule) and at the closeout layer in TC-CAP-035.
7. Assert the index cap is enforced at promotion (TC-CAP-022 covers the row write) and that no silent truncation of any list occurs.

**Oracle / binding assertion**:

- Among the cases at-cap (accept) and over-cap (refuse), the file length/count differs by exactly the refused unit and the refusal is classified.
- No case truncates existing content; the pre-append bytes remain a prefix of the post-append bytes.

**Expected Outcome**:

- Bounded capsule growth with a visible cap breach; no silent truncation or partial write.

**Mutant control**: MUT-CAP-05.

#### TC-CAP-006 - Terminal `capsule.closed` exactly once

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F3-1, NFR-6
**Level**: behaviour
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/capsule-append.test.ts`, `tests/behaviour/closeout-capsule-close.test.ts`
**Tags**: @backend, @integrity
**Delivery phase**: P1

**Preconditions**:

- A closeable capsule with 3 candidates and one readable review artifact.
- Fixed run id and clock.

**Steps**:

1. Close the capsule; assert `capsule.closed` is the last line and carries decision counts, the event count, and a bounded digest; assert the digest equals a recomputation over the preceding bytes.
2. Attempt one append of each writer kind after the close; assert each is refused and the file is unchanged.
3. Re-run closeout apply; assert zero new `capsule.closed` events and that the event count is unchanged.
4. Assert the closed state is reported as `capsule.closed: true` in the applied payload; assert a plan run on the closed capsule writes nothing and renders the additive `capsule` object absent (F-3 pins it absent in plan mode).
5. Assert the close never reorders or rewrites earlier lines: the pre-close bytes remain an exact prefix of the post-close bytes.

**Oracle / binding assertion**:

- Exactly one event with `kind === "capsule.closed"`, at the final line; `eventsAfterClose.length === 0`.
- The close payload's `eventCount` equals the number of lines before the close; `decisionCounts` equal the per-decision event counts.
- Re-run appends zero bytes.

**Expected Outcome**:

- One terminal close; the capsule is sealed against later writes but remains readable.

**Mutant control**: MUT-CAP-06, MUT-CAP-15.

#### TC-CAP-007 - `phase` producer: one `phase.transition` per landing, idempotent

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DEC-2, NFR-6
**Level**: behaviour
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/capsule-phase-producer.test.ts`, `tests/behaviour/capsule-producer-port.test.ts`; `tests/fixtures/closeout/harness.ts` (state fake) + temp capsule
**Tags**: @backend, @producer
**Delivery phase**: P2

**Preconditions**:

- The delivered `phase` command runtime with an injected state store, clock, run id, and change directory.
- A capsule in the change folder.

**Steps**:

1. Run `phase complete` with commit intent `atomic` and a known commit SHA; assert exactly one new state record and exactly one new capsule event with `kind: "phase.transition"`.
2. Assert the event payload carries phase id, operation `complete`, outcome `landed`, commit intent `atomic`, and the commit SHA; assert the envelope carries the injected timestamp and the payload is bounded.
3. Re-run the identical logical transition; assert the state record behaviour is unchanged and the capsule appends zero events (same `eventKey`).
4. Run `phase complete` with a different commit SHA; assert exactly one new event (key includes the SHA).
5. Run `phase reopen`; assert exactly one event with operation `reopen` and a distinct key; assert no state record is fabricated for a no-op transition.
6. Run a no-op transition (not a landing); assert zero events and zero state records.
7. Run two distinct no-commit transitions of one phase (for example complete, reopen, complete); assert each landing has a distinct `eventKey` derived from its persisted `transitionId`, and a re-run of the same landing appends nothing.
8. Assert the event's writer is exactly `phase` and the event names the work item ref.

**Oracle / binding assertion**:

- Per logical landing: `capsuleEvents(kind=phase.transition) === 1` and re-run delta `=== 0`.
- Event key is a pure function of `(changeRef, phaseId, operation, commitShaOrTransitionId)` (delivery-bound composition): a distinct commit SHA or a distinct no-commit transition identity changes the key; repeating the same landed transition repeats it.
- The capsule append is non-gating by construction, proven by TC-CAP-010.

**Expected Outcome**:

- One event per landed completion/reopen, deduplicated by its deterministic key.

**Mutant control**: MUT-CAP-07.

#### TC-CAP-008 - `commit` producer: one `commit.landed` per landing, body-free

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DEC-2, NFR-9
**Level**: behaviour
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/capsule-commit-producer.test.ts`, `tests/behaviour/capsule-producer-port.test.ts`; `tests/fixtures/commit/harness.ts` + temp capsule
**Tags**: @backend, @producer, @privacy
**Delivery phase**: P2

**Preconditions**:

- The delivered `commit` command runtime with an injected state store and a synthetic commit message containing a unique body canary.
- A capsule in the change folder.

**Steps**:

1. Land a commit; assert one `commit.landed` event and one `commit.telemetry` state record (the delivered record unchanged).
2. Assert the event payload carries the commit SHA, the parent SHA when known, the `messageSource` token (`model` or `template`), and the change ref; assert it is bounded.
3. Assert the payload key set contains no message, body, diff, patch, credential, or environment field; assert the body canary appears nowhere in the event, the capsule file, or the output.
4. Re-run the same landing; assert zero new events (key = SHA).
5. Land a second commit with the same message but a different SHA; assert exactly one new event.
6. Assert the writer is `commit` and the parent SHA is absent (not guessed) when the fixture omits it.
7. Assert the state record shape and count are identical to the delivered behaviour (no regression).

**Oracle / binding assertion**:

- `capsuleEvents(kind=commit.landed) === 1` per SHA; re-run delta `0`.
- Event key equals the SHA; a SHA change yields a new event.
- Canary absent from `events.jsonl`, output, and the state record.

**Expected Outcome**:

- One identity-only commit event per landing; no message content anywhere.

**Mutant control**: MUT-CAP-08.

#### TC-CAP-009 - `verify` producer: one `gate.outcome` per gate evaluation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DEC-2, NFR-6
**Level**: behaviour
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/capsule-verify-producer.test.ts`; `tests/fixtures/verify/**` + temp capsule
**Tags**: @backend, @producer
**Delivery phase**: P2

**Preconditions**:

- The delivered `verify gates` runtime with an injected state store, fixed clock, and a declared gate-set fixture.
- A capsule in the change folder.

**Steps**:

1. Run a full gate evaluation at head SHA H with gate-set identity G; assert one `gate.outcome` event and the delivered `merge.gate-verification` state record.
2. Assert the payload carries the gate-set identity (schema version + ids), the head SHA, and a bounded per-gate verdict/evidence summary; assert no raw command output or log text is present.
3. Re-run the same evaluation; assert zero new events (key = G + H) and the state record behaviour unchanged.
4. Evaluate at a new head H2 with the same gate set; assert exactly one new event.
5. Change the gate-set declaration (different ids) at the same head; assert exactly one new event.
6. Assert the writer is `verify` and the payload contains no free-text field.
7. Assert partial evaluation (a single gate, not a full set) is not recorded as a full `gate.outcome` — the spec says one per full gate evaluation.

**Oracle / binding assertion**:

- `capsuleEvents(kind=gate.outcome) === 1` per `(gateSetIdentity, headSha)`; re-run delta `0`.
- Each of the two key components independently changes the key.
- Payload size ≤4 KiB and key set bounded.

**Expected Outcome**:

- One gate-outcome event per full evaluation, keyed by gate set and head.

**Mutant control**: MUT-CAP-09.

#### TC-CAP-010 - Non-gating append failure: classified, disclosed, outcome unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F1-3, DEC-2, NFR-5
**Level**: integration
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/capsule-producer-nongating.test.ts`; injected failing capsule runtimes
**Tags**: @backend, @negative, @nongating
**Delivery phase**: P2

**Preconditions**:

- A success control run for each of `phase`, `commit`, `verify` with a healthy capsule.
- Four failure injectors: absent folder, busy lock, torn tail, cap reached.

**Steps**:

1. Record the success control: primary outcome, state record identity and count, exit code, and output shape.
2. For each command × injector, run with the failing capsule runtime; assert the primary outcome, state record identity/count, and exit code are identical to the control.
3. Assert a classified disclosure appears (delivery-bound output field or error-stream diagnostic) naming the append failure class — for the busy injector exactly `state.lock.busy` (transient, `retryable: true`) with the busy detail; assert the producer disclosure is not an error envelope and does not change the exit code.
4. Assert the command did not write a partial or fabricated event.
5. Then run closeout over the change and assert the missing expected event is reported as `capsule-event-gap` residue (naming the missing kind/identity), and the capsule is still valid and closes.
6. Assert a torn-tail append failure never repairs the capsule (hash unchanged).
7. Assert the failure is not silently swallowed: the disclosure is present in machine output or the diagnostic stream for every injector.

**Oracle / binding assertion**:

- `control.outcome === injected.outcome`, `control.stateRecordCount === injected.stateRecordCount`, `control.exit === injected.exit` for all 12 combinations.
- Disclosure count `≥1` per failure, with a class from the declared append-failure set; the busy injector discloses `state.lock.busy` (`retryable: true`) and never `closeout.capsule-invalid`.
- Closeout residue contains exactly one `capsule-event-gap` per missing event.

**Expected Outcome**:

- Capsule appends never gate their owner; failure is visible, classified, and later reconciled as residue.

**Mutant control**: MUT-CAP-10.

#### TC-CAP-011 - Writer ownership, self-containment, and `capsule-event-gap` cross-check

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F2-2, AC-F1-3, DEC-2, NFR-5
**Level**: structure, integration
**Test Type(s)**: Static, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/capsule-imports.test.ts`, `tests/behaviour/closeout-capsule-gap.test.ts`; import graph and temp change trees
**Tags**: @backend, @static, @integrity
**Delivery phase**: P2

**Preconditions**:

- Two sibling change folders, each with a capsule and a state record set.
- The capsule writer export and the four command edges exist.

**Steps**:

1. Scan the workspace: assert the capsule writer module is imported only by the `phase`, `commit`, `verify`, and closeout edges (plus contract/type imports and tests); assert no other module imports it. Assert a non-zero file count.
2. Assert no source file outside the capsule runtime contains a write path to `events.jsonl` (literal scan for the filename plus a filesystem-write call); assert the only `fs` write location is the declared capsule runtime.
3. Assert no agent/command prompt file instructs a capsule write (scan `.opencode/agent/*.md` and `.opencode/command/*.md` for the capsule filename combined with a write verb); assert zero violations with a non-zero scanned count.
4. Run `phase`/`commit`/`verify` for change A; assert change A's capsule grew and its `candidates/` directory exists, and every sibling folder is byte-identical (hash set comparison).
5. Create a change with three durable `phase.transition` state records but a capsule missing the middle one; run closeout; assert one `capsule-event-gap` residue naming the missing event, a valid capsule, and a normal close.
6. Assert every event in both capsules carries a writer from the closed set.
7. Assert the capsule contains no event kind written by another change's command (assert `workItemRef` equals the folder ref on every line).

**Oracle / binding assertion**:

- Import graph: the capsule writer has exactly the four production importers; any fifth fails naming file and line.
- Cross-change: `hash(siblingFolder) === preRunHash` for every sibling.
- Residue: exactly one `capsule-event-gap` per synthetic missing event, and the capsule still closes (`closed: true`).

**Expected Outcome**:

- Only the owning commands write a capsule; capsules stay self-contained; missing mirrored evidence is residue, never invalidity.

**Mutant control**: MUT-CAP-11.

#### TC-CAP-012 - Capsule validation matrix refuses damage with no promotion

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, AC-F1-2, DEC-4
**Level**: integration
**Test Type(s)**: Integration, Negative, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capsule-validation.test.ts`; `tests/fixtures/capsule/validation/**`
**Tags**: @backend, @negative, @capsule
**Delivery phase**: P3

**Preconditions**:

- The §4.3 matrix fixtures, each a complete temp change tree plus a temp memory tree and a state fixture.
- A recorded apply baseline for the valid row.

**Steps**:

1. Iterate the matrix rows; for each, run closeout `--apply` through the in-process CLI with injected provider/git/state fakes and assert the five observables (validity verdict, promotion write count, capsule append count, close count, exit/envelope class).
2. For every `capsule-invalid` row, assert the error code is `closeout.capsule-invalid`, category `user`, `retryable: false`, `consequence: not_landed`, exit 1, no `data`, zero home writes, zero promotion events, zero close events.
3. Assert plan mode for the same rows renders the capsule step `would-refuse` and performs zero writes (delegated to TC-CAP-014 for the write count).
4. Assert the unreadable review artifact row is **not** invalid: residue kind `review-verdict-unreadable`, close proceeds.
5. Assert the missing review artifact row produces no residue and no verdict event (absence is not damage).
6. Assert the row order is irrelevant: replay the matrix shuffled; assert identical per-row results.
7. Assert the invalid capsule's file bytes are unchanged by the refused run.

**Oracle / binding assertion**:

- For every invalid row: `error.code === "closeout.capsule-invalid"`, `exit === 1`, `data === undefined`, `homeWrites === 0`, `promotionEvents === 0`, `closeEvents === 0`, `capsuleHash === preRunHash`.
- For every valid row: `close === 1`, `promotionEvents === candidateCount`, `capsuleHash !== preRunHash`.
- The matrix asserts its row floor (12 rows) before iterating.

**Expected Outcome**:

- Damage is refused with no promotion; absence is completed; unreadable evidence is residue.

**Mutant control**: MUT-CAP-14.

#### TC-CAP-013 - Pre-contract capsule completion with backfill gap

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DEC-4
**Level**: integration
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capsule-backfill.test.ts`; a change folder with no capsule
**Tags**: @backend, @capsule
**Delivery phase**: P3

**Preconditions**:

- A temp change folder with spec/plan/pm-notes but no `events.jsonl` and no `candidates/`.
- Durable state records for two phase transitions and one commit.

**Steps**:

1. Run closeout `--apply`; assert `events.jsonl` and `candidates/` are created in the existing folder.
2. Assert the first event is `capsule.opened` with the capsule contract version and the work item ref.
3. Assert the second event is `capsule.backfill-gap` with evidence naming the pre-contract state; assert it does not fabricate historical `phase.transition`/`commit.landed` events.
4. Assert the durable state records are not backfilled into the capsule: the event count is the opened + backfill + closeout-owned events, and no event claims a historical timestamp.
5. Assert the run proceeds: candidate decisions are recorded, review ingestion runs, and exactly one `capsule.closed` is appended.
6. Assert absence is not an error: exit follows the residue rule (0 when no other residue), and the applied payload reports `capsule.closed: true`.
7. Re-run; assert no second `capsule.opened`, no second `capsule.backfill-gap`, and no second close.

**Oracle / binding assertion**:

- Event 1 kind `capsule.opened`; event 2 kind `capsule.backfill-gap`; exactly one of each.
- Zero synthesized historical events: no event's `occurredAt` precedes the run start, and no phase/commit event exists.
- Re-run deltas for both events `=== 0`.

**Expected Outcome**:

- Pre-contract changes close safely with an explicit, honest gap — never a fabricated history.

**Mutant control**: none directly (covered by the close-count controls).

#### TC-CAP-014 - Plan-mode zero writes and `would-refuse` rendering

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, AC-F3-1, DEC-4, NFR-5
**Level**: integration
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capsule-plan.test.ts`, `tests/behaviour/closeout-plan.test.ts` (extend)
**Tags**: @backend, @negative, @readonly
**Delivery phase**: P3

**Preconditions**:

- A valid capsule row and an invalid capsule row.
- A temp tree snapshot helper (paths + hashes + mtimes) and a state fake that records fence acquisitions.

**Steps**:

1. Snapshot the whole temp workspace (change tree, memory tree, state file); run plan on the valid row; assert the post-run snapshot is identical (zero bytes, zero mtimes).
2. Assert zero capsule appends, zero promotions, zero fence acquisitions, zero provider/git mutations, and zero harness extraction calls.
3. Assert the planned payload renders the planned residue and the planned step outcomes with `mode: "plan"` — the step set P3 actually delivers (the seven delivered steps plus `capsule`; the exact twelve-step array is asserted in TC-CAP-050 at P10); assert the additive `capsule` object is absent (F-3 pins it absent in plan mode).
4. Run plan on each invalid row; assert the capsule step outcome is `would-refuse` and the exit is 0 (a hard plan failure is absent); assert zero writes.
5. Assert plan on a closed capsule performs zero writes, renders no `capsule` object, and reports the capsule step outcome without mutating the capsule.
6. Assert plan does **not** append `capsule.opened` to a pre-contract folder and creates neither artifact.
7. Replay plan twice; assert byte-identical machine output.

**Oracle / binding assertion**:

- Workspace snapshot equality: `snapshotBefore === snapshotAfter` for the valid, invalid, and closed rows.
- `fenceAcquisitions === 0`, `promotions === 0`, `capsuleBytesDelta === 0`.
- Invalid rows: capsule step outcome exactly `would-refuse`; exit exactly 0.
- Plan mode never emits the additive `capsule` object (F-3): `payload.capsule === undefined` for valid, invalid, and closed rows.

**Expected Outcome**:

- Plan mode is a true read-only pre-flight that renders refusal before apply.

**Mutant control**: MUT-CAP-12.

#### TC-CAP-015 - Review-verdict ingestion and unreadable-verdict residue

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DEC-4 (Appendix A refinement)
**Level**: integration
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capsule-review-ingest.test.ts`; `tests/fixtures/capsule/review/**`
**Tags**: @backend, @capsule
**Delivery phase**: P3

**Preconditions**:

- `code-review/review-iter-1.yaml` and `review-iter-2.yaml` fixtures with several verdict entries and a unique canary in the prose.
- A malformed artifact fixture and a no-artifact fixture.

**Steps**:

1. Run apply; assert exactly one `review.verdict` event per readable verdict entry, ordered by iteration then entry order.
2. Assert each event carries the iteration identity, the verdict, and an identity reference only; assert no review prose, comment body, or canary appears.
3. Re-run; assert zero new `review.verdict` events (dedup by key).
4. Replace one artifact with malformed YAML; assert a `review-verdict-unreadable` residue with a bounded location, the capsule still valid, close proceeds, and other readable artifacts still ingest.
5. Remove all artifacts; assert no residue and zero verdict events.
6. Assert ingestion is read-only: the artifact hashes and mtimes are unchanged.
7. Assert a duplicate artifact (same iteration written twice) yields one event per verdict identity, not duplicates.

**Oracle / binding assertion**:

- `review.verdict` event count equals the readable verdict-entry count; replay delta `0`.
- Malformed artifact: residue kind exactly `review-verdict-unreadable`; `capsuleInvalid === false`; close count `1`.
- Canary absent from capsule and output; artifact hash unchanged.

**Expected Outcome**:

- Review verdicts become capsule evidence; unreadable evidence is residue, never capsule damage.

**Mutant control**: MUT-CAP-13.

#### TC-CAP-016 - Applied capsule payload and decision mirror

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-1, AC-F4-2, DM-3, DM-5, DEC-14
**Level**: golden, integration
**Test Type(s)**: Contract, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/closeout-envelope.test.ts` (extend), `tests/behaviour/closeout-capsule-payload.test.ts`; `tests/fixtures/closeout/golden/capsule-applied.json`
**Tags**: @backend, @golden, @capsule
**Delivery phase**: P3

**Preconditions**:

- A valid capsule with three candidates whose decisions are promoted, rejected-with-reason, and handoff.
- Fixed facts so the output is canonicalizable.

**Steps**:

1. Run apply; parse `data.capsule`; assert key set exactly `{closed, events, candidates}`.
2. Assert `closed === true`; assert `capsule.events` equals the close event's declared event count and is consistent with the file (`lineCount - 1 ≤ events ≤ lineCount`, the convention identical in both places).
3. Assert `candidates.length === 3`; each entry's key set is exactly `{id, decision}` plus `home` iff promoted and `reason` iff rejected (the applied projection `{id, decision, home?, reason?}`); assert `class`, `mode`, and `supersedes` are absent from every output entry.
4. Assert the per-candidate decisions reconcile one-for-one: same ids in the same order; `decision`, `home`, and `reason` equal between the durable event and the output projection; the output omits the event's `class`, `mode`, and `supersedes`; the decision counts equal the close payload counts.
5. Assert the golden file matches after canonicalization (sorted keys, fixed refs/SHAs, no timestamps).
6. Assert the envelope still carries the delivered keys and that `capsule` is additive: remove it from the golden copy and assert the remaining envelope validates against the delivered contract.
7. Assert no candidate decision is missing and no candidate appears twice.

**Oracle / binding assertion**:

- `capsule.candidates` is a bijection with the `capsule.promotion` events and with the candidate files on disk; each output entry equals the event's `{id, decision, home?, reason?}` projection and carries none of `class`/`mode`/`supersedes`.
- `capsule.events === closePayload.eventCount` and `lineCount - 1 ≤ capsule.events ≤ lineCount`; `capsule.closed === hasTerminalEvent`.
- Golden equality after canonicalization; a one-field mutation fails (golden non-vacuity).

**Expected Outcome**:

- The applied payload mirrors the capsule exactly; the field is additive and bounded.

**Mutant control**: MUT-CAP-15; golden mutation control per §4.11 rule 6.

#### TC-CAP-017 - Candidate schema and closed vocabularies

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-2, DEC-5
**Level**: structure
**Test Type(s)**: Unit, Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/capsule-contract.test.ts`, `tests/behaviour/closeout-capsule-schema.test.ts`
**Tags**: @backend, @contract, @candidate
**Delivery phase**: P4

**Preconditions**:

- The candidate contract module (class, scope, basis, trust, status sets, evidence-shape set, id pattern, required key set).
- A schema validator usable on a parsed candidate.

**Steps**:

1. Assert the class set is exactly `{fact, decision, lesson, tacit, preference, workflow, norm, fleet}`, scope exactly `{change, component, repo, fleet}`, basis exactly the five capture-bar bases, trust exactly `{T0..T5}`, status exactly `{candidate, authoritative, superseded}`; assert each is duplicate-free and closed.
2. Assert the id pattern accepts `abc`, `a-b-c`, `a1-2`, and rejects `AB`, `A-b`, `-ab`, `ab`, `a`, 65+ characters.
3. Assert the required key set is enforced: drop each required key in turn; assert the candidate is rejected as a schema failure (`capsule-invalid` in apply), never silently skipped.
4. Assert the optional keys are exactly `{rationale, applies_when, supersedes, contradicts, hint}` and are accepted when absent and when present; assert `supersedes`/`contradicts` each hold a non-empty record-id string (a path-shaped value is not schema-rejected but resolves through the existence check as `supersedes-unknown`, asserted in TC-CAP-020/021).
5. Assert duplicate candidate ids across files are a schema failure (delegated assertion to TC-CAP-012's row).
6. Assert one file per candidate named `<id>.yaml`; assert a file whose name disagrees with the id inside is a schema failure.
7. Assert the evidence shape set is exactly `{review-verdict:<ref>, ci-verdict:<ref>, human-correction:<ref>, merged-pr:<ref>, test:<ref>}` with `<ref>` non-empty and bounded; accept one candidate per shape; reject a malformed shape prefix, a missing `<ref>`, an absolute/whitespace-only ref, and a free-text sentence.
8. Assert the status semantics: a newly promoted record is written with `status: candidate`; closeout never writes `authoritative`; the only status rewrite is `superseded` on the old record of an accepted supersession; an unknown status value is a schema failure (`capsule-invalid`).
9. Assert the rejection-reason vocabulary is exactly the eight declared reasons and duplicate-free; assert an out-of-set `scope`, an unknown `status`, and a non-empty evidence value outside the five shapes (and separately another required-field/closed-vocabulary violation) are schema failures (`capsule-invalid`), not rejections.

**Oracle / binding assertion**:

- Vocabulary equality (set equality, not containment) for class/scope/basis/trust/status and the five evidence shapes, and rejection reasons exactly the eight declared.
- `missingRequiredKey → capsuleInvalid === true` for every required key (11 cases).
- Positive/negative evidence: each of the five shapes accepted; a malformed prefix, empty ref, or free-text sentence → `capsuleInvalid === true` (never `evidence-missing`, which is reserved for absent/empty evidence).
- Positive/negative status: `candidate` accepted; `authoritative` accepted as a **read** value but never written; `superseded` written only by the supersession rewrite; an unknown value → `capsuleInvalid === true`.
- `scopeOutOfSet → capsuleInvalid === true` and no rejection decision is produced (F-3/AC-F4-1).

**Expected Outcome**:

- A precise candidate contract with the declared status and evidence-shape vocabularies; structural violations are refused, never silently skipped; the rejection set is exactly eight.

**Mutant control**: none directly (schema is exercised by MUT-CAP-16/17).

#### TC-CAP-018 - Capture bar and evidence gate: closed rejection reasons, no silent skip

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DEC-5, NFR-9
**Level**: behaviour
**Test Type(s)**: Unit, Contract, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capsule-promotion.test.ts`; `tests/fixtures/capsule/candidates/**`
**Tags**: @backend, @negative, @promotion
**Delivery phase**: P4

**Preconditions**:

- A candidate matrix covering every capture-bar basis and every evidence link shape, plus the missing/invalid cases.
- A temp memory tree and a fixed decision evaluator.

**Steps**:

1. Promote one candidate per basis; assert each is accepted (promoted or handoff) and the basis is recorded.
2. Remove the basis; assert rejected `capture-bar-unmet`, zero home writes, zero index rows.
3. Replace the basis with a value outside the five; assert rejected `capture-bar-unmet` (not a schema failure — the field is present and typed).
4. Remove the evidence and, separately, set it to the empty string; assert both are rejected `evidence-missing`. A non-empty free-text sentence or a malformed shape prefix is a structural schema failure (`capsule-invalid`), not `evidence-missing`.
5. Assert neither rejection is ever promoted, and neither is silently skipped: the decision list length equals the candidate file count.
6. Assert every rejection reason is from the closed eight-reason set.
7. Assert the evaluation order is declared: a candidate failing both bar and evidence reports `capture-bar-unmet` (first rule), and a candidate with bar + evidence + duplicate reports `duplicate:<id>`.
8. Assert no model call or similarity score occurs (call log empty; deterministic replay).

**Oracle / binding assertion**:

- For every rejection row: `decision === "rejected"`, `reason === expected`, `homeWrites === 0`, `indexRows === 0`; the absent/empty-evidence row is `evidence-missing`, while the non-empty malformed row is `capsuleInvalid === true`.
- `candidateFiles === decisions` for every fixture (no silent skip).
- Replay produces identical decisions in identical order.

**Expected Outcome**:

- No candidate skips the bar or the evidence link; every rejection is explainable from the closed set.

**Mutant control**: MUT-CAP-16.

#### TC-CAP-019 - Deterministic dedup against memory and sibling candidates

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DEC-5, NFR-1
**Level**: behaviour
**Test Type(s)**: Unit, Property (normalization)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capsule-dedup.test.ts`; temp memory tree with existing lesson/tacit records
**Tags**: @backend, @determinism, @promotion
**Delivery phase**: P4

**Preconditions**:

- Existing lesson `L-001` with statement `"Retry storms exhaust the quota window"`.
- Candidates: exact match, case variant, whitespace variant, near-match, and two siblings with the same statement.

**Steps**:

1. Candidate statement `"Retry storms exhaust the quota window"` → rejected `duplicate:L-001`.
2. `"  retry storms   EXHAUST the quota window "` → rejected `duplicate:L-001` (trim + case-fold + collapse).
3. `"Retry storms exhaust the quota window twice"` → not a duplicate (no similarity scoring); assert it is promoted.
4. Two candidates with the same normalized statement → the first by declared id order is promoted, the second rejected `duplicate:<first-id>`.
5. Assert the comparison population includes existing tacit records (repeat with a tacit match) and the capsule's own candidates.
6. Assert normalization is the declared function, not locale-dependent: the same input under two injected locales yields the same decision (the function is locale-pinned, `toLocaleLowerCase("en-US")` or a declared equivalent).
7. Replay; assert identical decisions and order.

**Oracle / binding assertion**:

- `normalize(a) === normalize(b)` ⇔ dedup match for the pairs above; the near-match pair is **not** equal.
- First-wins determinism: the surviving candidate id is the lexicographically smallest id among equals.
- Zero model/embedding calls.

**Expected Outcome**:

- Dedup is deterministic, explainable, and names the existing id; near-duplicates are still promoted for human review.

**Mutant control**: MUT-CAP-17.

#### TC-CAP-020 - Supersession and contradiction handling

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DEC-5
**Level**: behaviour
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capsule-supersession.test.ts`; temp memory tree
**Tags**: @backend, @promotion, @memory
**Delivery phase**: P4

**Preconditions**:

- Existing lesson `L-001` and tacit `T-001`; a candidate declaring `contradicts: L-001` + `supersedes: L-001` (the accepted path).
- Candidates declaring: `supersedes: L-999` (absent); `contradicts: L-001` with no `supersedes`; `contradicts: L-001` + `supersedes: T-001` (different target); `contradicts: L-999` + `supersedes: L-999` (unknown target); `contradicts` naming a `doc/spec` fact.

**Steps**:

1. Promote the declared pair (`contradicts: L-001` + `supersedes: L-001`); assert exactly one new record file, the old `L-001` file edited to `status: superseded`, and every other memory file byte-identical (single-file edit).
2. Assert the durable `capsule.promotion` event carries the supersession link (`supersedes` present iff declared, as a record-id list containing `L-001`) and that the applied output projection does not (it is `{id, decision, home?, reason?}`).
3. Assert **target existence first**: `supersedes: L-999` → `supersedes-unknown`; `contradicts: L-999` + `supersedes: L-999` → also `supersedes-unknown` (existence precedes the pairing check); zero writes for both.
4. Assert `contradicts: L-001` with **no** `supersedes` → `contradiction-requires-supersession`, zero writes.
5. Assert `contradicts: L-001` with `supersedes: T-001` (a different target) → `contradiction-requires-supersession`, zero writes.
6. Assert a supersession naming a record in another class (for example a `doc/spec` fact) is rejected `supersedes-unknown` (only lesson/tacit ids are valid targets).
7. Assert the decision path performs no similarity scoring, embedding, or model call (call log empty; deterministic replay); assert dedup remains exact normalized-statement equality by pairing a near-match statement with no `contradicts` and asserting it is **not** rejected for contradiction.
8. Re-run; assert no duplicate file and no repeated status edit; assert the superseded record is still readable and its id is not reused.

**Oracle / binding assertion**:

- New record count `1`; old record `status === "superseded"`; `changedFiles === {newRecord, oldRecord}` exactly.
- Precedence: unknown `contradicts` or `supersedes` target → `supersedes-unknown`; only then a missing/different `supersedes` for the contradicted id → `contradiction-requires-supersession`; a matching existing pair → promoted supersession.
- `supersedes` appears only in the durable event (list containing the target id), never in the output projection.
- Zero similarity/embedding/model calls; re-run changes zero bytes.

**Expected Outcome**:

- Supersession and contradiction are explicit declarations with deterministic precedence, single-file writes, and idempotent re-runs; nothing is inferred.

**Mutant control**: none directly (supersession is exercised by MUT-CAP-19's re-run assertion).

#### TC-CAP-021 - Promotion routing matrix: home writes and sanctioned handoffs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, AC-F3-2, DEC-6, NFR-9
**Level**: integration
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capsule-routing.test.ts`; `tests/fixtures/memory/tree.ts`; `tests/fixtures/closeout/harness.ts`
**Tags**: @backend, @promotion, @memory
**Delivery phase**: P4

**Preconditions**:

- A temp `.ai/memory` tree with `README.md`, `lessons/`, `tacit/`, `agents/<agent>/`.
- Eight candidates, one per class, each with a valid basis and evidence.
- Snapshots of `doc/spec`, `doc/decisions`, `AGENTS.md`, `.opencode/`, and the live `.ai/memory`.

**Steps**:

1. Run apply; assert `lesson` writes exactly one file under `.ai/memory/lessons/` and `tacit` exactly one under `.ai/memory/tacit/`, each with the delivered record frontmatter, the declared `lesson-YYYY-NNN-<slug>.md`/`tacit-YYYY-NNN-<slug>.md` naming, a monotonically allocated id unique across lessons and tacit (seeded ids are not reused), and one index row.
2. Assert `fact` records a handoff to `doc/spec/**` and creates/edits nothing under `doc/`; `decision` → `doc/decisions/**` handoff, no edit; `norm` → kernel handoff, `AGENTS.md` unchanged; `workflow` → command/skill/playbook handoff, `.opencode/` unchanged.
3. Assert `preference` is rejected `home-not-implemented` and no `preferences/` tree is created.
4. Assert `fleet` is rejected `owner-approval-required` and no fleet/guild tree is created.
5. Assert every candidate has exactly one decision and each decision names exactly one home/mode.
6. Assert the real repository `.ai/memory`, `doc/spec`, `doc/decisions`, `AGENTS.md`, and `.opencode` are byte-identical after the suite (GAP-C4).
7. Assert no push, commit, or remote write occurs (zeros in the git seam and provider write log).
8. **Path escape (spec v1.3 R-1)**: (a) a candidate whose `id` or record-name is outside the slug shape (contains `..`, a path separator, or an absolute component) → candidate schema failure `closeout.capsule-invalid`, detected **before any write**, with zero writes anywhere; (b) a resolved home whose parent is a symlink, absolute path, or traversal that escapes the injected memory root after realpath resolution → zero writes, no promoted decision, no index row, step failure `closeout.step.capsule.failed` carrying the candidate id, rejected path, and root; (c) a handoff/home route value containing `..` → the same step failure; (d) a `supersedes`/`contradicts` value shaped like a path (`../../etc/passwd`) → `supersedes-unknown` with zero writes and no path join attempted; assert plan mode renders `would-refuse`, `realpath` of every written parent stays inside `realpath(memoryRoot)`, and **no new error row** exists for path confinement.

**Oracle / binding assertion**:

- Routing equals Appendix C exactly: `lesson|tacit → home-write`, `fact|decision|norm|workflow → handoff`, `preference|fleet → rejected`, with the declared reasons.
- Naming/allocation: every new record file matches the declared pattern; its id is unique across lessons+tacit and never reuses a seeded or superseded id; a second run allocates no new id.
- Path confinement (exact identities): id/record-name outside the slug shape → `closeout.capsule-invalid` before any write; resolved home outside `realpath(memoryRoot)` (symlink/absolute/traversal) → `closeout.step.capsule.failed` with zero writes and plan `would-refuse`; no new error row. The outside-target snapshot (paths, hashes, mtimes) is byte-identical before/after and zero writes occur outside the root.
- Post-run hashes: only the two temp memory records and the temp index change; every snapshot outside the temp memory tree is identical.
- `homeWrites === 2`, `handoffs === 4`, `rejections === 2`.

**Expected Outcome**:

- One candidate → one action → one home; ids follow the declared monotonic allocation; closeout never writes a home it does not own and never writes outside the injected memory root.

**Mutant control**: MUT-CAP-18, MUT-CAP-20.

#### TC-CAP-022 - Home-write and index-row idempotency; index budget

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, AC-F4-3, DEC-6, NFR-2, NFR-6
**Level**: behaviour
**Test Type(s)**: Integration, Property
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capsule-idempotency.test.ts`; temp memory tree with a 200-line index fixture
**Tags**: @backend, @idempotency, @memory
**Delivery phase**: P4

**Preconditions**:

- A promoted lesson candidate and a temp memory tree.
- An index fixture at 199 lines and one at 200 lines.

**Steps**:

1. Promote; snapshot the record file and index; assert the new record id is the next monotonically allocated id for its family; re-run; assert zero new files, zero index bytes changed, the same decision, and no newly allocated id.
2. Pre-create a **byte-identical** target record; run; assert `satisfied` no-op: zero writes, no duplicate decision, no index row, and the file's bytes/mtime unchanged.
3. Pre-create a target with the **same identity** (same record id) and **different content**; run; assert rejected `duplicate:<existing-id>` with zero writes, no index row, and the target bytes unchanged (never overwritten).
4. Pre-create a **different identity** target whose existing record id is declared by the candidate as `contradicts` but **not** matched by `supersedes`; run; assert rejected `contradiction-requires-supersession` with zero writes and the existing record unchanged.
5. Control: the same pre-existing target, but the candidate now declares `contradicts: <existing-id>` **and** `supersedes: <existing-id>`; run; assert the declared supersession path is accepted (old record `status: superseded`, one new record) — not a contradiction.
6. Assert **target existence first** in the pre-existing branch: a candidate declaring `contradicts`/`supersedes` for an unknown id is `supersedes-unknown` even when the target file exists (the declaration target, not the file, is checked first).
7. Assert no overwrite path exists: the promotion writer exposes create-only/identity-checked writes and no truncate/replace operation for an existing differing target (structural scan plus the three fixtures above).
8. Assert the index row is exactly one line, bounded, and contains the record id.
9. Index at 199 lines: append succeeds, index becomes 200 lines.
10. Index at 200 lines: promotion is rejected `index-budget-exceeded`, no partial row, no record file written, and the candidate is not silently skipped.
11. Assert the index is never rebuilt, reordered, or compacted by closeout (prefix bytes unchanged).
12. Assert the index cap is 200 lines exactly (199 accepted, 200 blocked for a new row).

**Oracle / binding assertion**:

- Re-run: `newFiles === 0`, `indexBytesDelta === 0`, `allocatedIds === 0`.
- Pre-existing target resolves to exactly one of: byte-identical → `satisfied` (zero writes); same identity/different content → `duplicate:<existing-id>`; different identity declaring `contradicts: <existing-id>` without a matching `supersedes: <existing-id>` → `contradiction-requires-supersession`. In all three the target bytes are unchanged and no index row is written; a matching `contradicts`/`supersedes` pair is the accepted supersession path.
- Target existence is checked before the pairing rule (`supersedes-unknown` wins for an unknown declared target).
- Budget: `indexLines === 200` ⇒ rejection reason `index-budget-exceeded`; `199` ⇒ success.
- Index write is append-only: pre-existing bytes are an exact prefix; the writer has no overwrite/truncate operation.

**Expected Outcome**:

- Home writes and index rows are idempotent and bounded; a full index is a declared rejection, not a silent drop.

**Mutant control**: MUT-CAP-19.

#### TC-CAP-023 - One promotion decision per candidate, idempotent by candidate id

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, AC-F4-3, EVT-2, DEC-5, DEC-16
**Level**: integration
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-capsule-decisions.test.ts`
**Tags**: @backend, @capsule, @idempotency
**Delivery phase**: P4

**Preconditions**:

- Five candidates producing two promotions, one handoff, and two rejections.
- A fixed run id and clock.

**Steps**:

1. Run apply; assert exactly five `capsule.promotion` events, one per candidate id, in deterministic candidate-id order.
2. Assert each event payload's key set is exactly `{id, class, decision}` plus `mode` and `home` iff promoted (`mode` ∈ `{home-write, handoff}`), `reason` iff rejected, and `supersedes` iff the candidate declares supersession (a non-empty list of record ids containing the declared target); assert the absence side of every `iff` explicitly.
3. Assert the output `capsule.candidates` is the projection `{id, decision, home?, reason?}` mirroring the events one-for-one, with `class`/`mode`/`supersedes` absent.
4. Re-run; assert zero new `capsule.promotion` events (idempotent by candidate id).
5. Inject a `capsule.promotion` event for an id with no candidate file; assert the capsule is invalid (decision without candidate).
6. Assert a pre-existing target resolves to exactly one of the three pinned outcomes (byte-identical `satisfied` no-op; same-identity different-content `duplicate:<existing-id>`; different-identity declaring `contradicts: <existing-id>` without a matching `supersedes: <existing-id>` → `contradiction-requires-supersession`) and the event records that decision; a matching `contradicts`/`supersedes` pair is the accepted supersession path; no overwrite occurs.
7. Assert a decision never changes on re-run (a previously promoted candidate stays promoted; a previously rejected one is not silently promoted).
8. Assert the decision order is the declared id order regardless of filesystem enumeration order (shuffle the directory creation order; assert identical order).

**Oracle / binding assertion**:

- `promotionEvents === candidateFiles`, ids as a set equal and as a list equal to the declared order.
- Event key set exactly `{id, class, decision, mode?, home?, reason?, supersedes?}` with the `iff` presence rules; output key set exactly `{id, decision, home?, reason?}` (no `class`/`mode`/`supersedes`).
- Re-run delta `0`; a decision-without-candidate is invalid; the three pre-existing-target outcomes are the only resolutions.
- Order equality across shuffled creation orders (no directory-iteration dependence).

**Expected Outcome**:

- Exactly one stable decision per candidate, independent of filesystem order and re-runs.

**Mutant control**: MUT-CAP-14 (multiple decisions) and MUT-CAP-19 (re-run duplicates).

#### TC-CAP-024 - Merged-diff sweep: attributed hits across four marker kinds

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-6, DEC-8
**Level**: behaviour
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-merged-diff.test.ts`; `tests/fixtures/closeout/diff.ts`; `tests/fixtures/closeout/temp-git.ts`
**Tags**: @backend, @diff, @capsule
**Delivery phase**: P5

**Preconditions**:

- A temp repo with a parent commit and a squash commit introducing one hit of each marker kind, each naming the fixture ref and carrying its kind's mapped action token.
- A `merge.transaction` fixture carrying the squash SHA; injected git seam.

**Steps**:

1. Run the sweep; assert exactly one diff invocation with the squash SHA and its parent, and zero `log`/`show`/`rev-list` invocations.
2. Assert four attributed hits produce four resolved `closeout.step` evidence records, each keyed by `{filePath, lineContentHash, markerKind, workItemRef}`.
3. Assert the step detail reports `resolved: 4`, `ambiguous: 0`, and the hit counts.
4. Assert the four records are ordered by `(filePath, lineNumber)` and are byte-stable on replay.
5. Re-run; assert zero new resolved records (same keys) and identical detail/residue.
6. Assert no source file, marker, or commit changed (temp repo state equality).
7. Assert the resolved evidence records are capsule events of kind `closeout.step` written by `closeout`.

**Oracle / binding assertion**:

- `resolvedCount === 4`, one per kind, each with the kind's mapped action token; the key tuple is unique and replay-stable.
- One diff invocation; argv contains the squash SHA and parent; zero history commands.
- Repo state (`status`, `diff`, `diff --cached`, refs) unchanged.

**Expected Outcome**:

- Attributed markers become capsule evidence, not source edits; the read is anchored and bounded.

**Mutant control**: MUT-CAP-22 (read shape) and the re-run assertion.

#### TC-CAP-025 - Ambiguous-hit classification and residue

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-4, DM-6, DEC-8
**Level**: behaviour
**Test Type(s)**: Unit, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-merged-diff-ambiguous.test.ts`; diff fixtures
**Tags**: @backend, @negative, @diff
**Delivery phase**: P5

**Preconditions**:

- A merged diff with: a `todo-marker` with no ref, a `when-merges-note` naming another ref, a `class-string` with no attributable owner, a `feature-flag` carrying an explicit `@action:do-something` token outside the closed vocabulary, a `todo-marker` carrying the valid token `remove-guard` (kind mismatch), and one correctly attributed hit (`todo-marker`→`close-todo`) as the live control.

**Steps**:

1. Run the sweep; assert the correctly attributed hit is resolved (control) and the five ambiguous hits are residue.
2. Assert each residue item has `kind: "ambiguous-flip-hit"` and a bounded location (file path + line).
3. Assert the residue count is 5 and the resolved count is 1; assert the kind-mismatched hit and the explicit out-of-vocabulary token are in the residue, not the resolved set.
4. Assert no ambiguous hit produced a resolved evidence record.
5. Assert the ambiguous item text carries no source line content beyond the bounded location (no code text, no marker text that could leak a body).
6. Re-run; assert identical residue order and content.
7. Assert an ambiguous `class-string` is never attributed by a fuzzy guess (add a near-owner string and assert it stays ambiguous).
8. Assert an action-less line that names this work item and matches a valid declared marker action resolves via the declared action (the contract-data action is authoritative).
9. Assert ordinary hyphenated prose (for example `fix the retry-policy bug`) does not suppress resolution; the hit resolves via the declared action.

**Oracle / binding assertion**:

- `ambiguousResidue.length === 5`; `resolvedRecords === 1`; kinds exact; an explicit unknown `@action:<token>` and a kind-mismatched action are both residue; action-less and ordinary prose lines resolve via the valid declared action.
- No residue item contains a raw source line or diff text.
- Replay byte-identical residue.

**Expected Outcome**:

- Ambiguity becomes operator-visible residue, never a guessed resolution.

**Mutant control**: MUT-CAP-21.

#### TC-CAP-026 - Diff-scan budget and zero source/remote mutation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-3, DEC-8
**Level**: checks, integration
**Test Type(s)**: Integration, Checks, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/capsule-bounds.test.ts`, `tests/behaviour/closeout-merged-diff-bounds.test.ts`
**Tags**: @backend, @bounds, @safety
**Delivery phase**: P5

**Preconditions**:

- A generated merged diff over 1 MiB text / 500+ changed files / 200+ hits.
- A recorded git invocation log and pre/post repo snapshots.

**Steps**:

1. Run the sweep on the oversized diff; assert the read is one invocation and the consumed text is bounded by 1 MiB, files by 500, hits by 200.
2. Assert truncation is explicit (omitted counts/marks) and no cap is silently exceeded.
3. Assert zero `log`, `show`, `rev-list`, `fetch`, `remote`, `push`, or multiple-diff invocations.
4. Snapshot `git status --porcelain`, `git diff`, `git diff --cached`, the ref list, and the HEAD SHA before/after; assert identical.
5. Assert no commit object was created (`git rev-list --count HEAD` unchanged) and no marker line was removed.
6. Assert a second run re-detects the same bounded set and emits identical residue.
7. Negative control: a fixture with a planted `push` invocation fails the TC (the assertion is not vacuous).

**Oracle / binding assertion**:

- `diffInvocations === 1`; `diffBytes ≤ 1_048_576`; `changedFiles ≤ 500`; `hits ≤ 200`; each cap breach carries a mark.
- Repo snapshot equality; `commitCount` unchanged; zero remote commands.
- Replay identical.

**Expected Outcome**:

- One bounded read, zero history walks, zero mutations, deterministic re-runs.

**Mutant control**: MUT-CAP-22.

#### TC-CAP-027 - `merged-diff-unavailable` gap and re-run stability

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DEC-8, NFR-6
**Level**: behaviour
**Test Type(s)**: Unit, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-merged-diff-gap.test.ts`
**Tags**: @backend, @negative, @gap
**Delivery phase**: P5

**Preconditions**:

- Two fixtures: no `merge.transaction` record, and a record whose squash SHA/parent does not resolve locally.

**Steps**:

1. Run the sweep with no merge transaction; assert `skipped-gap` with `merged-diff-unavailable` evidence and zero diff invocations.
2. Run with an unresolvable SHA; assert the same gap and zero invocations.
3. Assert no fallback to `HEAD`, `main-tools`, or a history walk (invocation log empty).
4. Assert the step is not a failure and does not change the exit code.
5. Re-run; assert identical evidence and residue and zero new records.
6. Assert the gap is declared data, not a fabricated empty result (the step detail says unavailable, not "0 hits").

**Oracle / binding assertion**:

- `step.outcome === "skipped-gap"`; evidence contains `merged-diff-unavailable`; `diffInvocations === 0`.
- `hits === undefined` (no fabricated zero); re-run identical.

**Expected Outcome**:

- An unresolvable merged diff is an explicit gap, never a guess.

**Mutant control**: MUT-CAP-23.

#### TC-CAP-028 - Marker vocabulary as declared contract data

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5, AC-F5-1, DM-6, §22
**Level**: structure
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/capsule-contract.test.ts`; the declared `CLOSEOUT_DIFF_MARKERS` data
**Tags**: @backend, @contract, @data
**Delivery phase**: P5

**Preconditions**:

- The marker contract data and the classification domain module.

**Steps**:

1. Assert the kind set is exactly the four kinds (`todo-marker`, `when-merges-note`, `feature-flag`, `class-string`) and duplicate-free.
2. Assert the action set is exactly the four tokens (`remove-guard`, `retire-flag`, `rename-class`, `close-todo`) and duplicate-free; assert the kind→action mapping is exactly `todo-marker→close-todo`, `when-merges-note→remove-guard`, `feature-flag→retire-flag`, `class-string→rename-class` (1:1, total over the kinds, no extra action).
3. Assert every declared pattern compiles and every kind has at least one pattern; assert each pattern entry declares the action token that its kind maps to.
4. Assert no action string appears in the domain module as a literal (patterns and actions are data, the classifier is generic).
5. Assert the domain module contains no marker regex literal: a scan of `packages/core/src/domain/**` finds zero pattern literals for the four kinds.
6. Negative: an out-of-vocabulary action (for example `flip-flag`) and a valid token that does not match the kind's mapping (for example `todo-marker` carrying `remove-guard`) both classify as `ambiguous-flip-hit` residue and never resolve; assert the resolved count is `0` for both.
7. Reviewed-data control: copy the contract data, add a fifth kind or a fifth action, and assert the classifier/registry test fails naming the undeclared member; remove a kind's only pattern and assert the test fails.
8. Assert the attribution predicate is one declared function applied per kind, not a per-kind branch in the domain; assert a pattern change is a data-only diff (copy the module with a changed pattern and re-run the classifier).

**Oracle / binding assertion**:

- `kinds.length === 4`, `actions.length === 4`, mapping total and injective over the four kinds; every kind has ≥1 compiled pattern; zero pattern/action literals in the domain.
- Out-of-vocabulary action → `ambiguous-flip-hit`; valid-token-but-kind-mismatched action → `ambiguous-flip-hit`; neither produces a resolved record.
- The meta-check fails on a fifth kind/action and on an empty kind (non-vacuity).

**Expected Outcome**:

- The marker and action vocabularies are reviewed contract data with a fixed kind→action mapping; an undeclared or mismatched action can never resolve.

**Mutant control**: none directly; the fifth-kind control is the meta-check.

#### TC-CAP-029 - Thread authorship policy: human leaves residue, non-human resolves, unknown is human

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-4, DEC-9, NFR-9
**Level**: provider behaviour
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/github-closeout-thread-authorship.test.ts`; `tests/fixtures/closeout/threads.ts`, `tests/fixtures/providers/github/graphql-review-threads.json`
**Tags**: @backend, @provider, @policy
**Delivery phase**: P5

**Preconditions**:

- Provider fixtures: a user-authored thread, a bot-authored thread, an app/automation thread, a Mannequin-authored thread, a thread with an absent actor type, and one with an unmapped actor type.
- A recording provider fake that logs every `resolve-delivery-thread` id.

**Steps**:

1. Run `comment-resolution`; assert each thread's outcome matches its §4.6 row (resolved or not), using the step's declared authorship evidence where the contract exposes it and the decision/residue behaviour otherwise.
2. Assert the resolve log contains exactly the non-human thread ids and none of the human/unknown ids.
3. Assert the human and unknown threads each produce one `unresolved-human-thread` residue with thread identity, author principal, and bounded location.
4. Assert the step outcome is not `failed`; the presence of human residue is the attention signal, not an error.
5. Assert the unknown-authorship thread is treated exactly like human (fail-closed) in resolution, residue, and privacy.
6. Re-run; assert zero second resolutions and identical residue.
7. Assert no thread is resolved twice even if the provider reports it unresolved after the mutation (classified write failure as delivered).

**Oracle / binding assertion**:

- `resolvedIds === nonHumanIds` (set equality); `humanIds ∩ resolvedIds === ∅`; `unknownIds ∩ resolvedIds === ∅`.
- Residue count equals `human + unknown`; each residue kind exact.
- Re-run resolution count `0`.

**Expected Outcome**:

- Automation resolves only what it can prove is non-human; a human question survives as residue.

**Mutant control**: MUT-CAP-24, MUT-CAP-25.

#### TC-CAP-030 - Thread and residue caps with explicit truncation

**Scenario Type**: Boundary
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-4
**Level**: behaviour
**Test Type(s)**: Unit, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-thread-caps.test.ts`
**Tags**: @backend, @bounds, @policy
**Delivery phase**: P5

**Preconditions**:

- Fixtures: 150 unresolved threads (100 non-human + 50 human), and a second fixture with 60 human threads.
- The delivered 100-thread cap and the 50-item residue cap.

**Steps**:

1. With 150 threads, assert at most 100 are read/processed with an explicit truncation mark and omitted count.
2. Assert every human thread within the read window yields residue; threads beyond the read window remain unresolved and are counted.
3. With 60 human threads, assert exactly 50 residue items, an explicit omitted count of 10, and a rendered `+N`.
4. Assert none of the 60 human threads is resolved (including those beyond the residue cap).
5. Re-run after resolving some non-human threads: assert the remaining set is re-evaluated and progress is made (the cap does not permanently strand threads).
6. Assert the cap is per merged request, not per run lifetime (a new request resets it).
7. Assert the residue cap does not silently drop a kind: the mark is present and names the omitted count.

**Oracle / binding assertion**:

- `readThreads ≤ 100` with a mark when more exist; `residueItems ≤ 50` with `omitted === humanCount - 50`.
- `resolvedHumanIds.length === 0`.
- Re-run progress: `resolvedCount > 0` when non-human threads remain.

**Expected Outcome**:

- Caps are enforced and marked; truncation never resolves a thread it did not read.

**Mutant control**: MUT-CAP-27.

#### TC-CAP-031 - Thread residue is identity-only; no-surface providers fabricate nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F6-2, DEC-9, NFR-9
**Level**: provider behaviour, checks
**Test Type(s)**: Integration, Checks, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/github-closeout-thread-privacy.test.ts`, `tests/checks/capsule-privacy.test.ts`
**Tags**: @backend, @privacy, @provider
**Delivery phase**: P5

**Preconditions**:

- A human thread whose body and title contain unique canaries.
- A Jira fixture (no thread surface) and a GitHub fixture with `signals.threads: unavailable`.

**Steps**:

1. Run `comment-resolution`; assert the residue item is `{item, kind, location}` with the thread id and principal in `item` and the bounded location in `location`.
2. Assert the body canary, the title canary, and any free-form subject text are absent from the residue, the machine output, the human output, and the capsule.
3. Assert the item contains no comment text even when the thread has a long subject (bounded by identity only).
4. Jira: assert `skipped-gap` with `provider-unsupported`, zero residue, zero resolutions.
5. GitHub with an unavailable thread signal: assert `skipped-noop` with `thread-signal-unavailable`, zero residue, zero resolutions.
6. No merged request: assert `skipped-noop` with `no-delivery-request`, zero residue.
7. Assert no fabricated residue for any gap/no-op case (residue total `0`).

**Oracle / binding assertion**:

- Residue key set exactly `{item, kind, location}`; `item` contains the thread id and principal; canaries absent everywhere.
- Gap/no-op rows: `residue.length === 0`, `resolved === 0`, outcome exact.
- Scan scope non-zero (capsule + output + human text).

**Expected Outcome**:

- Human residue identifies a thread without exposing it; absent surfaces never invent attention items.

**Mutant control**: MUT-CAP-26.
#### TC-CAP-032 - Residue item contract: closed kinds, bounds, deterministic order

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DM-4, NFR-1, NFR-4
**Level**: structure, behaviour
**Test Type(s)**: Contract, Unit, Property
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/capsule-contract.test.ts`, `tests/behaviour/closeout-residue.test.ts`
**Tags**: @backend, @contract, @residue
**Delivery phase**: P6

**Preconditions**:

- The residue contract data (kind set, kind order, per-field caps, item cap 50).
- A synthetic input that produces items of all eight kinds with shuffled locations.

**Steps**:

1. Assert the kind set is exactly the eight declared kinds and duplicate-free; assert the declared kind order lists all eight exactly once.
2. Assert each item's key set is exactly `{item, kind, location}`; assert no item is `null`, no array has holes.
3. Assert `item` and `location` lengths are within the declared caps and that an over-cap value is truncated with an explicit mark (not silently cut mid-token without a mark).
4. Build 8 kinds × varying locations; assert the output groups by the declared kind order and sorts locations ascending by UTF-8 bytes inside each group.
5. Assert at most 50 items; with 60 items, assert 50 plus an explicit omitted count and `+N`.
6. Assert truncation preserves at least one item per produced kind (no kind silently disappears) or marks the kind as truncated.
7. Replay with a shuffled input insertion order; assert byte-identical residue.
8. Assert no residue item is produced from a state with no producing condition (empty run → `residue: []`).

**Oracle / binding assertion**:

- Kind set equality; per-item key-set equality; `items.length ≤ 50`.
- Sort key: `(kindOrderIndex, Buffer.from(location))` ascending; replay equality.
- `omitted` equals the dropped count when truncated; empty run yields an empty array, not `undefined`.

**Expected Outcome**:

- One bounded, total, replay-stable residue shape.

**Mutant control**: MUT-CAP-39.

#### TC-CAP-033 - Residue is body-free: privacy canary across every artifact

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, NFR-9, §20
**Level**: checks
**Test Type(s)**: Checks, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/capsule-privacy.test.ts`; `tests/fixtures/closeout/canary.ts`
**Tags**: @backend, @privacy, @canary
**Delivery phase**: P6

**Preconditions**:

- Unique canaries planted in: a thread body, a thread title, a review-verdict prose field, a commit message body, session content, a provider payload, a fabricated credential value, and an environment value.
- A run that produces all eight residue kinds and a full capsule.

**Steps**:

1. Run the full apply; collect every artifact: `events.jsonl`, each candidate file, residue, machine output, human output, and the state records.
2. Assert every canary is absent from every artifact (byte search on canonical serializations).
3. Assert no artifact contains a field named `body`, `title`, `message`, `transcript`, `prompt`, `diff`, `patch`, `toolOutput`, `credential`, or `env`.
4. Assert the residue `item`/`location` strings are within caps and match the declared identity patterns only.
5. Assert the redaction chokepoint covers the new fields: inject a registered secret value into a candidate statement and assert the output redacts it while the capsule file keeps the candidate's declared statement (the file is a reviewed local artifact, not output).
6. Assert the scan scope is non-zero (each artifact exists and has >0 bytes except an intentionally empty residue).
7. Negative control: a fixture that plants a canary in the residue item fails the TC (the scan is not vacuous).

**Oracle / binding assertion**:

- `for each canary, artifact: !artifact.includes(canary)` for all eight × six artifacts.
- Zero forbidden field names in serialized output.
- Redaction applied to output only, with the capsule candidate text unchanged (delivered privacy contract ruling).

**Expected Outcome**:

- Judgment residue identifies work without carrying content; no secret or prose leaks.

**Mutant control**: MUT-CAP-26.

#### TC-CAP-034 - Attention exit matrix: apply `data` + exit 1, plan exit 0

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DM-10, DEC-14
**Level**: golden, integration
**Test Type(s)**: Integration, Golden, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-attention-exit.test.ts`, `tests/golden/closeout-envelope.test.ts` (extend)
**Tags**: @backend, @exit, @golden
**Delivery phase**: P6

**Preconditions**:

- A fixture that produces at least one residue item in apply and in plan.
- A fixture with no residue; a `capsule-invalid` fixture; a step-failure fixture; a provider-write-failure fixture.

**Steps**:

1. Apply with residue: assert the envelope has `data` (with `residue`), no `error`, `exitCode === 1`, and process exit 1; assert the projection class is `attention`.
2. Plan with residue: assert `data.residue` present, `exitCode === 0`, process exit 0.
3. Apply with no residue: assert `exitCode === 0`, exit 0, `residue: []`.
4. `capsule-invalid`: assert `error.code === "closeout.capsule-invalid"`, no `data`, exit 1.
5. Family-row step failure (a non-gap step with no delivered identity): assert `closeout.step.<id>.failed` with the step id in the slot, no `data`, exit 1.
6. Provider write failure: assert `closeout.write.failed`, no `data`, exit 2.
7. Scripted mode with residue: assert one minified `{"data":…}` line (no `schemaVersion`/`exitCode`/`timing`), `assertScriptedProjection` accepts it, and the process exit is 1.
8. Assert the `attention` class is additive: the success class still projects 0, and no table row changed its class.
9. Assert no error envelope ever carries `data` or a structured `residue[]` (attempt each failure fixture; assert `data === undefined`), and assert, for the worktree-refusal and cap-refusal fixtures, that the failed step's bounded evidence names the refused/preserved item with count and identity (F-11 rule).

**Oracle / binding assertion**:

- Exact matrix: `(mode, condition) → (data?, error?, exit)` per §4.8.
- `attention` is the only class producing `data` + exit 1; unknown classes are rejected, never defaulted.
- Scripted line shape validated by `assertScriptedProjection`.

**Expected Outcome**:

- Residue is data with an attention exit, never an error; plan shows it before apply.

**Mutant control**: MUT-CAP-40.

#### TC-CAP-035 - Residue provenance completeness: every kind has a producer, none is fabricated

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DEC-14
**Level**: behaviour, conformance
**Test Type(s)**: Unit, Conformance, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-residue-provenance.test.ts`; a residue conformance registry
**Tags**: @backend, @conformance, @residue
**Delivery phase**: P6

**Preconditions**:

- A producer registry mapping each residue kind to its producing condition and a fixture builder.
- The closeout composition that can enable one producer at a time.

**Steps**:

1. Assert the registry covers all eight kinds exactly (bijection with the vocabulary); a missing kind fails.
2. For each kind, enable only its producer and assert exactly that kind appears with the expected item count; for the two failure-coincident kinds (`worktree-retained`, `capsule-cap-reached`) assert the item in plan mode and the failed-step evidence per the F-11 rule; disable all and assert `residue: []`.
3. Assert no producer emits a kind outside the registry (run each producer and assert its emitted kinds are declared).
4. Assert no kind is emitted without its declared condition (for example no `worktree-retained` when the worktree predicate passes).
5. **S-2 rule (F-3/DEC-4)**: assert closeout v1 performs no PM-notes completeness check — a missing PM-notes file, and separately an incomplete one, changes no verdict, appends no event, and produces zero residue (the delivered PM-notes lint/lifecycle own that check).
6. Assert only an unreadable review artifact produces `review-verdict-unreadable` residue (a readable artifact produces none, and a missing artifact produces none), and that an out-of-set `scope` never produces a residue item or a rejection (schema failure, asserted in TC-CAP-017).
7. Assert a residue item's `item` text names the producer's subject (thread id, path/line, step id, cap) rather than a generic string.

**Oracle / binding assertion**:

- Registry↔vocabulary bijection (8/8).
- Per-kind single-producer fixture emits exactly one kind, count as declared (failure-coincident kinds via the plan-mode surface and failed-step evidence).
- PM-notes (missing and incomplete) fixtures: zero residue, zero verdict change; only the unreadable review artifact yields `review-verdict-unreadable`; zero rejection reasons outside the eight.

**Expected Outcome**:

- Every residue kind is reachable from exactly one mechanical condition; nothing is invented; PM-notes completeness is out of closeout's scope by contract (S-2 rule).

**Mutant control**: none directly (the registry is the control).

#### TC-CAP-036 - Worktree cleanup success: full predicate, one local removal, no force

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-7, DEC-10
**Level**: integration
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-worktree.test.ts`; `tests/fixtures/closeout/temp-git.ts` (extend with a worktree builder)
**Tags**: @backend, @git, @safety
**Delivery phase**: P7

**Preconditions**:

- A temp repo with `main-tools`, a delivery branch at the merged head, and a worktree checked out on that branch; cwd outside the worktree; clean.
- A merged request + merge transaction fixture whose `headSha` equals the local branch head.

**Steps**:

1. Run apply; assert exactly one worktree-removal invocation with a fixed argv array (no shell string, no force token) naming the delivery worktree path.
2. Assert the directory is gone, the worktree list no longer contains it, and the branch ref still exists (removal precedes branch cleanup).
3. Assert the step outcome is `applied`/`satisfied` and the step is recorded; assert no `worktree-retained` residue.
4. Assert `branch-cleanup` then succeeds (the delivery worktree no longer holds the branch) and the branch is deleted under its own predicate.
5. Assert no remote command ran and no push occurred.
6. Assert the operation identity is deterministic and present in the ledger; a replay of the plan computes the same identity.
7. Assert the removal is not attempted twice within the same run.

**Oracle / binding assertion**:

- `removalInvocations === 1`; argv has no `--force`, `-f`, `push`, `remote`, or shell metacharacter; the worktree path and branch match the convention.
- Post-state: worktree absent, branch absent after step 4, remote untouched.
- `residue` contains no `worktree-retained`.

**Expected Outcome**:

- A provably safe worktree is removed locally, once, without force; the branch is then cleanly deletable.

**Mutant control**: none directly (MUT-CAP-28/29/30/31 cover the refusals and argv).

#### TC-CAP-037 - Worktree refusal matrix preserves the worktree

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, DEC-10, NFR-9
**Level**: integration
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-worktree-refusal.test.ts`; temp repos
**Tags**: @backend, @git, @negative
**Delivery phase**: P7

**Preconditions**:

- The ten refusal fixtures from §4.7 rows 1–10, each a temp repo.
- A recording git seam and a provider/state fixture per row.

**Steps**:

1. For each row, run apply; assert zero removal invocations and the worktree directory present with unchanged HEAD and working-tree bytes.
2. Assert apply returns `closeout.branch.unsafe` (user, non-retryable, exit 1) and plans for the same facts render `would-refuse`.
3. Assert the F-11/AC-F7-2 rule: apply returns the error envelope with **no structured `residue[]`** (`data === undefined`); the failed step's bounded evidence names the retained worktree with count and identity; the `worktree-retained` residue is asserted in plan mode for the same facts (one item) and appears in the human diagnostic stream.
4. Assert the branch is not deleted (the earlier failure blocks branch cleanup) and no other destructive action occurred.
5. Assert rows are independent: after the condition is fixed, a re-run removes the worktree (row 12 semantics) and reuses prior terminal outcomes.
6. Assert the dirty row is asserted with both a modified file and an untracked file (two sub-cases).
7. Assert the moved-head row re-checks the head immediately before removal and refuses if it moves between plan and removal (inject a head change).
8. Assert the foreign row keeps the delivered foreign-worktree branch refusal.

**Oracle / binding assertion**:

- `removalInvocations === 0` for all ten rows; worktree directory exists; `git rev-parse HEAD` unchanged.
- `error.code === "closeout.branch.unsafe"` with `data === undefined` and bounded evidence naming the worktree/branch; the plan run has exactly one `worktree-retained` residue item.
- Fixed-after-failure re-run removes exactly once.

**Expected Outcome**:

- Any uncertainty retains the worktree and reports it; no destructive default exists.

**Mutant control**: MUT-CAP-29, MUT-CAP-30, MUT-CAP-31.

#### TC-CAP-038 - Absent worktree, re-run no second removal, ordering before branch cleanup

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, AC-F7-2, NFR-6
**Level**: integration
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-worktree-idempotency.test.ts`
**Tags**: @backend, @git, @idempotency
**Delivery phase**: P7

**Preconditions**:

- A temp repo whose worktree was already removed (row 11) and a repo where row 12 completes.
- The step array payload from a plan.

**Steps**:

1. Run apply with the worktree absent; assert `satisfied` with `no-worktree` evidence and zero mutations.
2. Run the row-12 repo twice; assert the second run removes nothing and reports `no-worktree`.
3. Assert the step array index of `worktree-cleanup` is exactly one less than `branch-cleanup` and both are resolved by id.
4. Assert a foreign worktree holding the branch still blocks branch cleanup after cleanup runs (delivered refusal unchanged).
5. Assert the ledger contains one terminal outcome for the removal identity and the second run reuses it.
6. Assert the output is byte-identical between run 1 and run 2 when the facts are identical.
7. Assert no `worktree-retained` residue on either satisfied path.

**Oracle / binding assertion**:

- `satisfied` + `no-worktree`; zero mutations; one terminal ledger outcome.
- `index(worktree-cleanup) === index(branch-cleanup) - 1`.
- Run-1 and run-2 canonical output equality.

**Expected Outcome**:

- Absence is satisfaction; ordering protects branch deletion; re-runs never remove twice.

**Mutant control**: MUT-CAP-29 (head) and MUT-CAP-44 (terminal reuse).

#### TC-CAP-039 - Git seam gains one no-force, no-shell, local capability

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, AC-F7-2, DEC-10, NFR-9
**Level**: structure, checks
**Test Type(s)**: Static, Contract, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/closeout-contracts-git.test.ts`, `tests/checks/capsule-cli-parity.test.ts`; `packages/adapters/src/git/index.ts`
**Tags**: @backend, @static, @safety
**Delivery phase**: P7

**Preconditions**:

- The git seam's exported operation union and its invocation helper.
- `.dependency-cruiser.cjs` runtime-API allowance for the git subpath.

**Steps**:

1. Assert the seam's operation union contains exactly the delivered read/restore/delete operations plus one worktree-removal operation, and that no force variant exists.
2. Assert the removal invocation is a fixed argv array (`file`, `args[]`) with no shell string and no interpolation.
3. Scan the seam and its callers for `force`, `--force`, `-f`, `push`, `fetch`, `remote`, `--no-verify`; assert zero occurrences with a non-zero scanned file count.
4. Assert the seam rejects a protected ref directly (delivered defense in depth) and that the worktree predicate — including the convention match — is evaluated before any invocation.
5. Assert the removal has a bounded timeout and does not retry unbounded.
6. Assert `node:child_process` appears only at the allowed path; the boundary fixture that proves the rule exists.
7. Negative control: a planted `--force` token in a copied seam fails the TC (the scan is not vacuous).

**Oracle / binding assertion**:

- Operation-union equality with exactly one new capability; zero force/push/remote tokens.
- Fixed argv array; zero shell-string construction.
- Protected-ref rejection reachable at the seam, not only in the planner; the worktree predicate (including the convention match) enforced before invocation.

**Expected Outcome**:

- One new local capability with the same no-force, no-shell, own-path discipline as branch deletion.

**Mutant control**: MUT-CAP-28.

#### TC-CAP-040 - Retro coverage recorded as collected or pending; no registry write

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-9, EVT-4, DEC-11, NFR-6
**Level**: integration
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-retro-coverage.test.ts`; `tests/fixtures/retro/harness.ts`
**Tags**: @backend, @retro, @capsule
**Delivery phase**: P8

**Preconditions**:

- A temp state store with a `retro.run` record at level `change`, scope = the fixture work item, mode `collect`, counts and truth verdict populated.
- A second store with no matching run.

**Steps**:

1. With a matching run: assert one `capsule.retro-coverage` event with `{level: "change", state: "collected", runId}` and the step detail reporting collected.
2. Without a matching run: assert one event with `state: "pending"` and no run id.
3. Assert the registry is read through the verified read surface (a tamper flag would surface as unreadable — TC-CAP-041) and that zero `recordRun` calls occur.
4. Assert the registry file bytes/record count are unchanged.
5. Re-run; assert zero new `capsule.retro-coverage` events for the same `(workItemRef, level)`.
6. Assert no `retro.run` record with a `closeout` mode or a synthetic run id exists (the closed mode vocabulary is unchanged).
7. Assert a run at another level (for example `window`) does not satisfy `change` coverage.

**Oracle / binding assertion**:

- Exactly one event per `(workItemRef, level)`; state ∈ `{collected, pending}`; `runId` present only for collected.
- `registryWrites === 0`, `registryHash` unchanged, `runCount` unchanged.
- Other-level runs do not count.

**Expected Outcome**:

- Coverage is a capsule fact read from the registry, never a synthetic run.

**Mutant control**: MUT-CAP-32.

#### TC-CAP-041 - Unreadable retro registry is a declared gap and residue

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-2, DEC-11
**Level**: behaviour
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-retro-coverage.test.ts`
**Tags**: @backend, @negative, @retro
**Delivery phase**: P8

**Preconditions**:

- An injected registry read that fails with a classified state error (malformed registry / tampered chain).
- A recording registry fake asserting zero write attempts.

**Steps**:

1. Run apply; assert the step is `skipped-gap` with `retro-registry-unavailable` evidence.
2. Assert exactly one `retro-coverage-unavailable` residue with a bounded location.
3. Assert zero `capsule.retro-coverage` events are appended (no fabricated coverage).
4. Assert the rest of closeout proceeds: every other step runs, the capsule closes, and the exit follows the residue rule.
5. Assert zero registry write attempts.
6. Assert a store-level damage (torn registry) and an entry-level malformed record both map to the same declared gap (no new error identity).
7. Re-run; assert identical gap/residue.

**Oracle / binding assertion**:

- `step.outcome === "skipped-gap"`; evidence contains `retro-registry-unavailable`.
- `retroCoverageEvents === 0`; `residue` has exactly one `retro-coverage-unavailable`.
- Other steps' outcomes identical to the healthy control run.

**Expected Outcome**:

- A drifting or damaged registry degrades to a declared gap; the transaction still completes.

**Mutant control**: none directly (MUT-CAP-32 asserts the healthy path).

#### TC-CAP-042 - Compaction checkpoint content and attribution seam

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, DM-8, EVT-3, DEC-12
**Level**: integration
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-compaction.test.ts`; `tests/fixtures/harness/opencode-store/**`, `tests/fixtures/harness/claude-code/**`
**Tags**: @backend, @session, @capsule
**Delivery phase**: P8

**Preconditions**:

- A synthetic opencode store with three sessions attributed to the work item, and a Claude Code session tree mapped to the same work item.
- A fixed session-set digest and last verified commit SHA.

**Steps**:

1. Run apply; assert exactly one `capsule.compaction-checkpoint` event.
2. Assert the payload carries the bounded session identities (or a counted truncation), the work-item ref, `workingStateFlushed`, `eventLogFlushed`, the unresolved-question count, and the last verified commit SHA.
3. Assert the harness compaction invocation is declared as a `skipped-gap` capability with `harness-compaction-unavailable` evidence and that no adapter method was called to compact.
4. Assert attribution came through the session-store seam (read-only, bounded) and not from `db list` (assert zero `db` calls).
5. Assert the checkpoint carries no session content, only identities/counts/flags.
6. Assert the checkpoint event exists **and** the declared gap evidence is present; assert the step outcome is non-failing and non-residue (`skipped-gap` or `satisfied` per OQ-T4), and that the harness half is never reported as invoked.
7. Re-run; assert zero new checkpoint events for the same digest + commit.

**Oracle / binding assertion**:

- One checkpoint event; payload key set exact and bounded; `sessionIds.length ≤ cap` with a mark.
- `dbListCalls === 0`; zero compaction-adapter invocations; `harness-compaction-unavailable` evidence present.
- Re-run delta `0`.

**Expected Outcome**:

- The pre-compaction state is durable in the capsule; the missing harness surface is an honest declared gap.

**Mutant control**: none directly (MUT-CAP-33/34 cover the edges).

#### TC-CAP-043 - No sessions, attribution unavailable, same-digest re-run, no zero checkpoint

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-2, DEC-12, NFR-6
**Level**: behaviour
**Test Type(s)**: Integration, Negative, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-compaction-edges.test.ts`
**Tags**: @backend, @session, @negative
**Delivery phase**: P8

**Preconditions**:

- Three fixtures: empty session store; store with sessions but no work-item attribution; one with a changed digest and a new commit.
- The session-store fake records every query.

**Steps**:

1. No sessions: assert `skipped-noop` with `no-sessions` evidence and **zero** checkpoint events (no zero-valued checkpoint).
2. Attribution unavailable: assert `skipped-gap` with `session-attribution-unavailable` evidence, exactly one `session-attribution-gap` residue, and zero checkpoint events (no guessed checkpoint).
3. Assert no fallback attribution to "most recent session", "the only session", or a `db` field (query log shows no such read).
4. Same digest + commit re-run: assert zero new checkpoint events.
5. Changed digest (new session) or new last verified commit: assert exactly one new checkpoint event.
6. Assert session identification is one bounded read with a declared cap and an explicit truncation mark when exceeded.
7. Assert the three cases are mutually exclusive (a no-session run never also emits an attribution gap).

**Oracle / binding assertion**:

- No sessions: `checkpointEvents === 0`, `outcome === "skipped-noop"`, evidence `no-sessions`.
- Attribution unavailable: `checkpointEvents === 0`, one residue kind `session-attribution-gap`, evidence `session-attribution-unavailable`.
- Re-run same key: delta `0`; changed key: delta `1`.

**Expected Outcome**:

- Absence and ignorance are distinguished; nothing is guessed; re-runs converge on the checkpoint identity.

**Mutant control**: MUT-CAP-33, MUT-CAP-34.

#### TC-CAP-044 - No invented harness compaction API; `db` surface unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, DEC-12, NG-3, NG-7
**Level**: structure
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/closeout-compaction-absence.test.ts`, `tests/structure/session-admin-contract.test.ts` (unchanged)
**Tags**: @backend, @static, @session
**Delivery phase**: P8

**Preconditions**:

- The harness adapter capability declaration and the `db` contract.
- The closeout contracts module.

**Steps**:

1. Assert no adapter capability or operation names a compaction method (`compact`, `summarize-context`, `context-compaction`); assert the harness operation set is unchanged.
2. Assert the closeout contracts declare the gap reason `harness-compaction-unavailable` as data and expose no compaction invocation function.
3. Assert no `db` subcommand, flag, or `list` field was added: the `db` contract vocabulary and list item key set are identical to the delivered fixture.
4. Assert `db list` carries no work-item field (the attribution-seam decision) and that closeout never imports the `db` command runtime.
5. Assert the session-store read is the only attribution path (import graph + query log).
6. Assert no new configuration key exists for compaction.
7. Assert a scan for `invented` surface names is non-vacuous: a fixture adding `compact` fails the TC.

**Oracle / binding assertion**:

- Harness operation set equality with the delivered set; zero compaction symbols; `db` contract key-set equality.
- `dbListCalls === 0` from closeout; zero new config keys.

**Expected Outcome**:

- The declared capability gap is recorded, not implemented; `db` stays a metadata administration surface.

**Mutant control**: none directly (absence scans are the control).

#### TC-CAP-045 - Production telemetry wiring: state log receives, capsule does not

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, EVT-5, DEC-13, NFR-7
**Level**: integration
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-telemetry-production.test.ts`; real temp JSONL state store + injected harness fixture
**Tags**: @backend, @telemetry, @integration
**Delivery phase**: P9

**Preconditions**:

- The production closeout composition (`createCloseoutComposition` + `createCloseoutCommandRuntime`), with a real temp state store and the delivered harness extraction over an injected store.
- A recorded call-order log on the capture fake.

**Steps**:

1. Run apply with a configured harness; assert the production composition supplies the capture capability (no test-only injection needed).
2. Assert capture ran after the terminal steps and before the applied payload was assembled (call order).
3. Read the state store; assert `harness.telemetry` session-group records under `harness.telemetry:<ref>` and one capture outcome under `harness-telemetry-capture:<ref>:<runId>`, with the declared schema ids and count parity.
4. Assert every statistics figure (tokens by class, calls, tool counts, agent/model, cost/null) is readable from the state log.
5. Assert the capsule contains no telemetry statistics: no capsule event payload has a token/call/cost field, a telemetry schema id, or a telemetry warning reason.
6. Assert a capture-enabled and a capture-disabled apply produce byte-identical `events.jsonl` with the same injected facts.
7. Deny the harness store and re-read the state log; assert all statistics persist and the extractor recorded zero calls (GAP-C7).
8. Assert the state schema version and record kinds are unchanged (no bump, no new kind).

**Oracle / binding assertion**:

- `capture.calls.extract === 1`, `capture.calls.append === 1`; state records exist with declared keys.
- `capsuleBytes(captureOn) === capsuleBytes(captureOff)`; zero telemetry fields in the capsule.
- Post-denial read succeeds with zero extractor calls.

**Expected Outcome**:

- Telemetry is reachable in production and stays in the state log; the capsule stream is untouched.

**Mutant control**: MUT-CAP-35.

#### TC-CAP-046 - Capture is non-gating, plan-mode silent, and idempotent

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, DEC-13, NFR-6, NFR-7
**Level**: integration
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-telemetry-nongating.test.ts`, `tests/behaviour/closeout-telemetry-idempotency.test.ts`
**Tags**: @backend, @telemetry, @nongating
**Delivery phase**: P9

**Preconditions**:

- Injected extract that throws, returns a failed result, and returns a partial capture.
- Injected append that fails.
- A fixed run id and a second run with one new session group.

**Steps**:

1. For each failure mode, assert no step outcome, summary count, or command verdict changes versus the healthy control, and the exit follows the residue/attention rule (capture failure alone adds no residue unless the spec declares one — assert none is fabricated).
2. Assert the failure is disclosed in the counts/warning reasons (captured/degraded/failed) and no zero-valued record is written.
3. Assert a failed capture writes no record with zero tokens/calls or a null session id.
4. Plan mode: assert `extract` and `append` call counts are both zero and fence acquisitions are zero.
5. Re-run with the same run id and sessions: assert zero new telemetry records and byte-identical payloads.
6. Re-run with one new session group: assert exactly one new session-group record and no duplicates of the existing ones (delivered identity).
7. Assert the capture disclosure is additive and optional (`telemetryCapture` absent when no capture ran).

**Oracle / binding assertion**:

- Failure modes: `stepOutcomes === control.stepOutcomes`, `summary === control.summary`, `exit === control.exit`.
- Plan: `extractCalls === 0`, `appendCalls === 0`, `fences === 0`.
- Re-run deltas: same facts `0`; one new group `1`.

**Expected Outcome**:

- Capture never gates closeout, never runs in plan mode, and never duplicates records.

**Mutant control**: MUT-CAP-36.

#### TC-CAP-047 - GH-233 review F-8: Claude file-read budget before the read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-2, DEC-13, RSK-6
**Level**: behaviour
**Test Type(s)**: Unit, Integration, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-telemetry-claude-budget.test.ts`; `tests/fixtures/harness/claude-code/**`
**Tags**: @backend, @harness, @budget
**Delivery phase**: P9

**Preconditions**:

- An injected file reader that records the requested byte range and every `read`/`readFileSync` call.
- A file just under the declared byte cap, and one far over it (for example cap + 1 MiB).

**Steps**:

1. Under-cap file: assert the extraction reads at most the cap and produces statistics with zero truncation warning.
2. Over-cap file: assert the reader requests at most the cap (a size check or a bounded read), never the whole file; assert a `truncated` warning naming the file and the cap.
3. Assert the bytes-read total ≤ cap + a declared header allowance; assert no full-file read call appears in the reader log.
4. Assert the byte comparison is by bytes, not UTF-16 code units (a multibyte fixture at the cap boundary is not falsely truncated; one byte over is truncated).
5. Assert capture completes (non-gating) with the truncated file and other files still parse.
6. Assert the file is opened read-only and its hash/mtime are unchanged.
7. Negative control: a reader that calls `readFileSync` on the whole file fails the TC (MUT-CAP-37).

**Oracle / binding assertion**:

- `maxBytesRequested ≤ cap` for the over-cap file; `bytesRead` reported ≤ cap; `truncated` warning present with the cap in evidence.
- No `readFileSync` of the full file in the log; file hash unchanged.
- Multibyte boundary: cap in bytes, not code units.

**Expected Outcome**:

- A pathologically large transcript cannot be fully loaded; the cap governs the read, not only the parse.

**Mutant control**: MUT-CAP-37.

#### TC-CAP-048 - GH-233 review F-11: orphan disclosure scoped to the capturing delivery

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-10, AC-F10-2, DEC-13
**Level**: provider behaviour
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-telemetry-opencode-orphan-scope.test.ts`; synthetic store builder
**Tags**: @backend, @harness, @provider
**Delivery phase**: P9

**Preconditions**:

- A synthetic store containing: two attributed roots for the capturing delivery, one attributed root for a second delivery, and three parentless sessions with no work-item ref (out-of-port orphans).
- The capture outcome record shape with a store-level warning field.

**Steps**:

1. Run capture; assert the capturing delivery's failed count equals only its own unattributable/invalid sessions (zero when its roots are valid).
2. Assert the out-of-port orphans appear as a store-level warning count, not as the delivery's `failed` sessions.
3. Assert the second delivery's session is neither counted nor disclosed as a failure of the capturing delivery.
4. Assert the orphan scan remains bounded (LIMIT maxSessions + 1) and disclosed, never a full store walk.
5. Assert the failure disclosure still names out-of-port orphans so they are not hidden (store-level warning, bounded).
6. Assert a genuinely unattributable session under a capturing root is still a failed session for that delivery (positive control).
7. Re-run; assert idempotent counts and no duplicate warning.

**Oracle / binding assertion**:

- `delivery.failed === ownUnattributableCount` (0 in the main fixture); `storeWarning.outOfPortOrphans === 3`.
- The second delivery's session id is absent from the capturing delivery's records.
- Query count bounded, independent of orphan count beyond the cap.

**Expected Outcome**:

- Orphan disclosure is delivery-scoped; another delivery's sessions no longer inflate the failed count.

**Mutant control**: MUT-CAP-38.

#### TC-CAP-049 - GH-233 review F-9 explicitly re-deferred with the consumer reason recorded

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-10, AC-F10-2, DEC-13
**Level**: structure, manual
**Test Type(s)**: Static, Content
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/structure/harness-review-deferrals.test.ts`; `doc/spec/features/feature-harness-adapters.md`
**Tags**: @backend, @docs, @deferral
**Delivery phase**: P9

**Preconditions**:

- The delivered host-runner module and the GH-233 review finding text.
- The harness-adapters feature doc (updated at phase 7, asserted here).

**Steps**:

1. Assert the feature doc records the F-8 and F-11 resolutions and an explicit F-9 re-deferral naming the reason: the host runner is not on the closeout extraction path and no production consumer exists until dispatch (M1-S9).
2. Assert the doc no longer contains the superseded sentence "no production composer … until GH-240" (or its equivalent), because the composer now injects capture.
3. Pin the delivered (deferred) host-runner semantics as a characterization, unchanged by this change: an external `SIGTERM` still sets `timedOut`, `stderr` truncation still lacks the stdout marker, and the output bound is still measured in UTF-16 units. Assert each current behaviour so a silent "fix" without a spec reopening fails; the doc records these as the deferred defect.
4. Assert no dispatch surface, queue, or spawn-failure row was added (`dispatch.session.spawn-failed` remains undeclared).
5. Assert the deferral carries an owning story and a revisit trigger (dispatch path or a runner consumer).
6. Assert the change record (spec/plan) references the re-deferral, and no test claims the F-9 defect is fixed.

**Oracle / binding assertion**:

- Doc contains the three resolution/deferral statements with the reason string.
- Characterization unchanged: `signal === "SIGTERM"` sets `timedOut`; `stderr` truncation has no marker; the bound is measured in UTF-16 units. A change to any of these without an amended spec fails the TC and reopens the deferral.
- Zero new dispatch symbols; zero `dispatch.*` rows.

**Expected Outcome**:

- The deferral is explicit, reasoned, and testable; the unchanged semantics cannot drift silently.

**Mutant control**: none (behaviour assertions are the control).

#### TC-CAP-050 - Step vocabulary, binding order, and schema identity

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, DM-5, DEC-7
**Level**: structure
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/closeout-contract.test.ts` (extend), `tests/types/closeout.type-test.ts`
**Tags**: @backend, @contract, @struct
**Delivery phase**: P10

**Preconditions**:

- The delivered seven-value step list fixture (`EXPECTED_STEP_IDS`) and the new contract data.

**Steps**:

1. Assert `CLOSEOUT_STEP_IDS` equals exactly the twelve ids in the Appendix C order.
2. Assert all seven delivered ids are present with unchanged spelling; assert none was renamed or removed.
3. Assert the five new ids are present and additive; assert no duplicate.
4. Assert `index("worktree-cleanup") === index("branch-cleanup") - 1` and `last === "capsule"`.
5. Assert `CLOSEOUT_SCHEMA_ID === "delivery.closeout.v1"` and the recorded payload schema ids are unchanged.
6. Assert plan and apply outcome vocabularies are unchanged (no new outcome token).
7. Assert a plan built over the same facts yields the twelve steps in that order, and that the summary counts cover twelve steps.
8. Assert step identity is resolved by id: a lookup helper returns the same step for a shuffled array.

**Oracle / binding assertion**:

- Array equality with the pinned twelve-id order (not a subset assertion).
- Delivered seven ⊆ new twelve; `schemaId` unchanged; outcomes unchanged.
- Plan step count `12` and order exact.

**Expected Outcome**:

- Additive growth with preserved identities and order; the schema id never bumps.

**Mutant control**: MUT-CAP-43.

#### TC-CAP-051 - Additive contract with consumer tolerance for unknown step ids

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, DM-5, DEC-7, NFR-10
**Level**: types, structure
**Test Type(s)**: Contract, Type, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/closeout-additive.test.ts`, `tests/types/closeout-attention.type-test.ts`; `tests/fixtures/closeout/legacy-consumer.ts`
**Tags**: @backend, @contract, @types
**Delivery phase**: P10

**Preconditions**:

- A committed contract-shape fixture of the delivered payload key sets (before this change).
- A synthetic legacy consumer that resolves by `stepId` and ignores unknown fields.

**Steps**:

1. Compare the delivered payload key sets to the shape fixture; assert zero removals and zero renames; assert `residue`, `capsule`, and step `detail` are the only additive keys.
2. Feed the consumer a payload with an injected unknown step id `future-step`; assert it completes and returns the known steps by id.
3. Feed the consumer an unknown optional field; assert it is ignored.
4. Assert the consumer never indexes the array positionally: run it against a reordered array and assert it still resolves each step.
5. Type test: `residue`, `capsule`, `detail` are optional (`prop?:`), not required; a consumer that requires `capsule` fails typecheck against the delivered type.
6. Assert the payload validates against the delivered `delivery.closeout.v1` contract (envelope validators) with the additive fields present and absent.
7. Negative control: the positional consumer mutant (MUT-CAP-42) fails; a required-`capsule` type variant fails typecheck.

**Oracle / binding assertion**:

- Delivered key set ⊆ new key set; new keys == exactly `{residue, capsule, detail}`.
- Unknown step id and unknown field tolerated; reorder tolerated by id.
- Optionality enforced by the type test.

**Expected Outcome**:

- Growth is additive for real consumers; positional assumptions fail loudly, never silently.

**Mutant control**: MUT-CAP-42.

#### TC-CAP-052 - Goldens updated for twelve steps and the human-thread behavior change

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-12, F-6, AC-F12-1, AC-F6-1, DEC-7
**Level**: golden
**Test Type(s)**: Golden, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/closeout-envelope.test.ts`, `tests/golden/closeout-human.test.ts`, `tests/golden/closeout-residue.test.ts`; `tests/fixtures/closeout/golden/**`
**Tags**: @backend, @golden
**Delivery phase**: P10

**Preconditions**:

- Golden fixtures regenerated by the explicit reviewed command.
- A golden inventory listing the expected golden files.

**Steps**:

1. Assert the envelope golden for an apply-with-residue case has twelve steps, `exitCode: 1`, `data.residue` present, and no `error`.
2. Assert the human golden renders twelve step lines and a `JUDGMENT RESIDUE` section with the human-thread item, including the `+N` case.
3. Assert the human-thread behavior change appears: the golden's resolve count excludes human threads and the residue contains them.
4. Assert no other golden byte changed: compare every golden outside the three above to its committed baseline (the inventory lists them).
5. Assert the goldens are read-only in the suite (`mtimeMs` unchanged) and regenerate only via the explicit script.
6. Assert the golden inventory includes the new residue golden and the contract test enforces the inventory (no orphan golden).
7. Mutation control: change one step label and one residue field in a temp copy; assert inequality; restore; assert equality.

**Oracle / binding assertion**:

- Twelve step entries in both envelope and human goldens; attention exit in the envelope golden.
- Only the three declared golden files differ from the delivered baseline.
- Read-only and inventory-complete.

**Expected Outcome**:

- Goldens reflect the additive growth and the one deliberate behavior change; no unrelated drift.

**Mutant control**: per §4.11 rule 6.

#### TC-CAP-053 - New error identities: `capsule-invalid` and the step-failure family

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-2, NFR-10, DEC-15
**Level**: structure, checks
**Test Type(s)**: Contract, Static, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/exit-code-literals.test.ts`, `tests/structure/result-contract.test.ts`
**Tags**: @backend, @contract, @error
**Delivery phase**: P10

**Preconditions**:

- `ERROR_TABLE`, `DOMAIN_KINDS`, `ProjectionClass`, and the documented error table.
- The effective step-id set (twelve).

**Steps**:

1. Assert `closeout.capsule-invalid` exists with category `user`, `retryable: false`, `consequence: not_landed`, projection `user-validation` (exit 1).
2. Assert the family row `closeout.step.<id>.failed` is declared once; the slot validator accepts each of the twelve effective step ids and rejects empty, malformed, dashed-unknown, and undeclared ids.
3. Assert the two new rows do not duplicate or rename the four delivered closeout rows.
4. Assert projection classes are exactly `{success, user-validation, platform-provider, attention}`; `attention` maps to 1; `success` still 0; an unknown class is rejected.
5. Assert the documented table and the machine table agree bidirectionally (the sync check green) and that the doc-distribution check passes if a marker-scoped doc changed.
6. Assert the exit-literal invariant: zero exit literals outside the projection module; the mutation suite proves the rule fires.
7. Assert a step failure uses a delivered identity where one exists (provider write, unsafe branch, state/config/input) and the family row otherwise; assert no new parallel vocabulary.
8. Assert lock contention reuses the delivered `state.lock.busy` row (transient, `retryable: true`, exit 2) and that `closeout.capsule-invalid` is never classified for contention; assert no new lock row exists; assert **no promotion-path-specific error row** exists either (a path escape reuses `closeout.step.capsule.failed`, R-1).
9. Assert the family row is reachable through the closeout classifier for at least one step id and one failure cause.

**Oracle / binding assertion**:

- Row fields exact; slot validation table exact (12 accepted, 4 rejected forms).
- Projection set equality; `attention → 1`; sync check green; zero exit literals.
- `state.lock.busy` reused for contention (retryable, exit 2); `capsule-invalid` reserved for content damage.
- Family row reachable and classified.

**Expected Outcome**:

- Two new identities, one additive class, no parallel error vocabulary, and the doc/table sync holds.

**Mutant control**: MUT-CAP-41.

#### TC-CAP-054 - Determinism: byte-identical replay over injected facts

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, F-11, DEC-14
**Level**: checks
**Test Type(s)**: Property, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/capsule-determinism.test.ts`; `tests/fixtures/closeout/determinism.ts`
**Tags**: @backend, @determinism
**Delivery phase**: P11

**Preconditions**:

- A fact set covering all steps, all residue kinds, three candidates, two sessions, one diff, and one registry state.
- Two independent runtime constructions with the same injected clock/ids.

**Steps**:

1. Run apply twice with fresh fakes and identical facts; canonicalize (sorted keys, no absolute paths/timestamps beyond the injected ones); assert byte-identical capsule, decisions, residue, and output.
2. Shuffle map insertion order, candidate file creation order, directory enumeration order, thread order input, and diff hit input order; assert identical decisions/residue/output.
3. Assert the capsule event order is a declared function of the facts, not of promise scheduling (run with a randomized microtask delay in fakes; assert identical order).
4. Assert residue order is `(kindOrder, location)` regardless of producer completion order.
5. Assert no wall clock, `Math.random`, locale, or ambient environment participates in the domain path (AST/scan plus the `ambient-globals` guard).
6. Assert the human renderer is deterministic (same data → same text) and within the line/byte bounds.
7. Assert the golden replay: the canonical output equals the golden.

**Oracle / binding assertion**:

- `sha256(run1) === sha256(run2)` for capsule, decisions, residue, machine output, human output.
- Byte equality across all shuffles.
- Zero non-injected entropy in the domain path.

**Expected Outcome**:

- Same facts never produce drift; review diffs are meaningful.

**Mutant control**: none directly; the shuffles are the control.

#### TC-CAP-055 - Full re-run convergence after restart

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-2, NFR-6, DEC-16
**Level**: integration
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-convergence.test.ts`; real temp JSONL state store, temp git repo, temp memory tree
**Tags**: @backend, @idempotency, @integration
**Delivery phase**: P11

**Preconditions**:

- A completed apply over a full fixture (all twelve steps, promotions, telemetry, close).
- A "restart" that discards in-memory runtime objects but keeps the durable store, capsule, memory tree, and the same injected run identity and clock (NFR-1 "identical injected facts").

**Steps**:

1. Snapshot post-run-1 state: capsule bytes, ledger records, memory files, index, telemetry records, git refs/worktrees, thread resolutions.
2. Re-run with fresh runtime objects and the same injected facts; assert zero new capsule events, zero duplicate promotion decisions, zero second thread resolution, zero second branch deletion, zero second worktree removal, zero duplicate telemetry records.
3. Assert every terminal operation outcome is reused from the ledger (assert the provider/git call log shows no re-execution of terminal identities).
4. Assert the residue and output are byte-identical to run 1.
5. Assert exactly one `capsule.closed` and one close ledger outcome.
6. Assert a changed fact (a new session group) produces exactly one new telemetry record and no other delta.
7. Assert a failed step from run 1 is retried on re-run while terminal successes are reused (mixed convergence).
8. Assert convergence with a new run id: the transaction converges (no duplicate capsule events/promotions/mutations), and the run-scoped telemetry capture is a new identity rather than a duplicate (recorded reading, OQ-T3).

**Oracle / binding assertion**:

- Deltas: capsule `0`, promotions `0`, resolutions `0`, deletions `0`, removals `0`, telemetry duplicates `0`.
- Output equality run1 vs run2; one close; terminal-outcome reuse evidenced by an empty re-execution log.
- Mixed case: only the failed identity re-executes.

**Expected Outcome**:

- A restart converges by construction; retries are safe.

**Mutant control**: MUT-CAP-44.

#### TC-CAP-056 - Latency budgets on reference fixtures

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-8
**Level**: checks
**Test Type(s)**: Performance, Checks
**Automation Level**: Semi-automated (budget assertions in CI where stable; apply p95 as a recorded artifact)
**Target Layer / Location**: `tests/checks/capsule-latency.test.ts`; `tests/fixtures/closeout/performance.ts`
**Tags**: @backend, @perf
**Delivery phase**: P11

**Preconditions**:

- Reference fixtures sized at the declared caps (2,000 events, 1 MiB diff, cap sessions, full registry).
- An injected monotonic timer (no wall-clock dependence in assertions that can flake).

**Steps**:

1. Measure capsule validation over the at-cap capsule; assert ≤2 s.
2. Measure the diff scan over the 1 MiB fixture; assert ≤5 s.
3. Measure session attribution over the cap session set; assert ≤5 s.
4. Measure the registry read over the full registry; assert ≤2 s.
5. Measure apply p95 over 5 runs of the reference fixture; record the value in the execution log; assert the run does not hang (hard timeout) and record whether p95 ≤120 s.
6. Assert every measurement is bounded (no unbounded wait) and that a budget miss is recorded as a gap, never silently green.
7. Assert no daemon, retry loop, or pagination contributes to the time (invocation counts).

**Oracle / binding assertion**:

- Step budgets asserted directly: `validation ≤ 2000 ms`, `diff ≤ 5000 ms`, `sessions ≤ 5000 ms`, `registry ≤ 2000 ms`.
- Apply p95 recorded (GAP-C8); a miss is a recorded gap with the measured value, not a pass.

**Expected Outcome**:

- Bounded per-step latency; the reference apply budget is measured and recorded.

**Mutant control**: none.

#### TC-CAP-057 - Self-containment and state additivity: no cross-change writes, no state kind

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F2-2, NFR-5, NFR-11, §8.5, §19
**Level**: structure
**Test Type(s)**: Static, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/state-contract.test.ts` (extend), `tests/structure/closeout-imports.test.ts`
**Tags**: @backend, @static, @state
**Delivery phase**: P11

**Preconditions**:

- The delivered state record-kind set and schema version.
- Two change folders with capsules.

**Steps**:

1. Assert the state schema version is unchanged and the record-kind set gains no `capsule.*` kind; assert the capsule is file-based only.
2. Assert no capsule event is written to the state log and no state record is written to the capsule (two-stream assertion at the contract level).
3. Assert the capsule runtime imports no state module and the state modules import no capsule module (layering).
4. Assert `harness.telemetry` record kind, keys, and payload schemas are unchanged.
5. Assert the capsule directory contains only `events.jsonl`, `candidates/`, and the pre-existing planning artifacts; no extra state file, index, or lock file remains.
6. Assert concurrent appends to two different capsules do not serialize (no global lock) and neither file is corrupt (in-process case, GAP-C9 boundary).
7. Assert the state store key prefixes are unchanged (no new prefix).
8. Assert `phase.transition` as a capsule event kind and as a state record kind remain separate artifacts (no shared file, no shared reader).

**Oracle / binding assertion**:

- Record-kind set equality; schema version equality; zero `capsule.*` kinds.
- Layering: zero cross-imports; directory contents exact.
- Two capsules concurrent append both contiguous.

**Expected Outcome**:

- The capsule is a file-based episode stream; the state layer keeps its kinds and version.

**Mutant control**: none directly (MUT-CAP-04's lock is per capsule by construction).

#### TC-CAP-058 - Mutant meta-check: every named guard fails by name

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: All ACs, NFR-1..NFR-11, §4.11
**Level**: checks
**Test Type(s)**: Checks, Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/capsule-mutants.test.ts`, `tests/checks/closeout-mutants.test.ts` (extend); `tests/fixtures/capsule/mutants/**`
**Tags**: @backend, @mutation, @nonvacuity
**Delivery phase**: P11

**Preconditions**:

- The 44 mutant copies and their declared killing TCs.
- The test runner able to execute a suite against a mutated module copy.

**Steps**:

1. Assert the register has ≥44 entries and at least one per F-1..F-12; a capability with no mutant fails the meta-check.
2. For each mutant, run its killing TC against the mutated copy; assert the suite fails and the failure message names the mutant id.
3. Assert a **passing** mutant fails the meta-check (a mutant that does not break the assertion is a test defect).
4. Assert each mutant names the exact broken assertion and that assertion text exists in the killing suite.
5. Assert no mutant copy is imported by production (scan) and all live under `tests/fixtures/capsule/mutants/**`.
6. Assert the positive controls in each mutant file pass against the unmutated module.
7. Assert case floor: 44/44 mutants executed (no skip, no `.only`).

**Oracle / binding assertion**:

- `mutants.length === 44`; `killed === 44`; `skipped === 0`; capability coverage 12/12.
- Each failure message contains the mutant id; each register row's assertion exists in the suite source.
- A deliberately passing mutant fails the meta-check (meta-mutation control).

**Expected Outcome**:

- The battery is proven non-vacuous: every guard is load-bearing.

**Mutant control**: the register itself.

#### TC-CAP-059 - Quality-gate battery, wiring, inventory, and changeset

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-10, DoD-17, DoD-18
**Level**: checks
**Test Type(s)**: Checks, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/inventory.json` (update), `tests/checks/{capsule-ci-parity,error-table-sync,exit-code-literals,fixture-sanitization}.test.ts`, `tests/structure/{content-inventory,subpaths}.test.ts`
**Tags**: @backend, @gates, @ci
**Delivery phase**: P11

**Preconditions**:

- A clean checkout of the branch; the workspace pins (`.bun-version`, `packageManager`).

**Steps**:

1. Run `pnpm check` (lint, format, typecheck, test, boundaries, exports parity) in a clean checkout; assert exit 0.
2. Run the error-table sync, exit-literal, doc-distribution, license-audit, and vulnerability gates; assert all green.
3. Assert the content inventory and subpath inventory include the new contracts/domain/adapter entries and tests.
4. Assert zero new runtime dependencies and no license-registry gap.
5. Assert exactly one lockstep changeset exists and declares the minor version impact; assert no per-package version drift.
6. Assert CI topology/bindingness checks are green for the amended workflow (if any).
7. Assert `git diff --check` reports no whitespace/conflict issues.
8. Assert the aggregate run log is attached to the change record (execution log), not claimed as pass without evidence.

**Oracle / binding assertion**:

- `pnpm check` exit 0; each named check exit 0.
- Inventory contains the new entries; one changeset; dependency count unchanged.
- Evidence attached for every gate.

**Expected Outcome**:

- The delivery is gate-clean and release-ready at the pinned version impact.

**Mutant control**: none.

#### TC-CAP-060 - Documentation reconciliation posture

**Scenario Type**: Manual
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F11-2, AC-F12-1, DoD-19
**Level**: manual
**Test Type(s)**: Manual, Content
**Automation Level**: Manual
**Target Layer / Location**: `doc/spec/features/feature-closeout.md` (primary) and the §18 neighbor list
**Tags**: @docs, @manual
**Delivery phase**: P11

**Preconditions**:

- The completed implementation and the phase-7 doc-sync record.

**Steps**:

1. Verify the closeout feature doc states twelve steps in the binding order, the capsule/residue/capsule output, the `attention` exit, the human-thread behavior change, worktree cleanup, retro coverage, compaction, telemetry wired, and the two new error rows.
2. Verify `feature-result-contract.md` carries the `attention` class, the `closeout.capsule-invalid` row, and the family row; table counts and corpora updated.
3. Verify `feature-harness-adapters.md` states the production composer injects capture and records F-8/F-11 resolution and F-9 re-deferral with the reason; the superseded "no composer until GH-240" sentence is gone.
4. Verify `feature-state-layer.md` confirms the capsule is file-based and no state kind was added, and that `harness.telemetry` is unchanged.
5. Verify `feature-retro-pipeline.md` states closeout reads `retro.run`/`retro.level` read-only with no new kind/mode; `feature-session-database-admin.md` states the compaction consumer uses the harness-store attribution and `db` is unchanged; `feature-merge-verify-deploy.md` states the diff sweep consumes the `merge.transaction` SHA with no contract change.
6. Verify `feature-commit-primitive.md`, `feature-pm-notes-lint-and-phase-transitions.md`, and `feature-verify-gates.md` record the capsule append points beside the delivered state records.
7. Verify `.ai/memory/README.md` states promotion routing is mechanized by closeout with index rows, and `AGENTS.md` kernel memory rules are unchanged (no rule edit).
8. Verify `doc/00-index.md`, the architecture overview, the glossary, and the ubiquitous-language index were updated where needed; run `bash scripts/.tests/test-doc-distribution.sh` for marker-scoped docs.
9. Verify a decision record is proposed (or authored) for the capsule-vs-state stream boundary and the human-thread policy, per §18's recommendation.

**Oracle / binding assertion**:

- Every listed neighbor contains its required statement; a checklist row without evidence fails the doc-sync review.
- `doc-distribution` check green for any marker-scoped doc changed.
- No stale composer/deferral sentence remains.

**Expected Outcome**:

- Current truth matches the delivered behavior; no neighbor doc contradicts the implementation.

**Mutant control**: none (manual review).

#### TC-CAP-061 - Success-metric evidence table

**Scenario Type**: Manual
**Impact Level**: Important
**Priority**: High
**Related IDs**: §4.1 metrics, DoD-16
**Level**: manual
**Test Type(s)**: Manual, Evidence
**Automation Level**: Manual
**Target Layer / Location**: §10 execution log; the DoD-16 evidence table
**Tags**: @docs, @manual, @evidence
**Delivery phase**: P11

**Preconditions**:

- All automated TCs executed and recorded.
- The adoption metric owner (M1 rollout) identified for the manual rows.

**Steps**:

1. For each of the ten §4.1 rows, record the measured value, the evidence pointer (TC id, run command, artifact), and a verdict.
2. Assert "merged changes closed with a capsule and one decision per candidate" = 100% on the fixture set (automated evidence).
3. Assert "candidates promoted without bar/evidence" = 0 (TC-CAP-018 evidence).
4. Assert "human threads auto-resolved" = 0 (TC-CAP-029/030 evidence).
5. Assert "worktree removals outside the predicate" = 0 (TC-CAP-037 evidence).
6. Assert "duplicates on re-run" = 0 across capsule events, promotions, resolutions, deletions, removals, telemetry (TC-CAP-055 evidence).
7. Assert "telemetry moved/duplicated" = 0 and "post-closeout harness re-queries" = 0 (TC-CAP-045 evidence).
8. Assert "residue beyond bound or without kind/location" = 0 (TC-CAP-032 evidence).
9. Assert "closeout source edits/commits/pushes/remote writes" = 0 (TC-CAP-026/039 evidence).
10. Mark "closeouts requiring manual diff re-grep after adoption" = 0 as a manual adoption outcome (GAP-C12), naming the owner and the trial evidence; an unverified row is not marked green.

**Oracle / binding assertion**:

- Every row has a verdict, a measured value, and an evidence pointer; no row is blank.
- Automated rows cite TC ids; manual rows cite the trial/owner and are explicitly marked manual.

**Expected Outcome**:

- DoD-16 is evidenced row by row; adoption claims are honest about their source.

**Mutant control**: none.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Runtime / tool | Invocation | Scope |
|-------------|----------------|------------|-------|
| Local development | Bun (repo pin via `.bun-version`), pnpm (pinned `packageManager`) | `pnpm install --frozen-lockfile`; `bun test tests/{structure,behaviour,checks,golden,conformance}` | All in-process contract, capsule, closeout, provider, telemetry, and convergence suites |
| Local boundaries and invariants | Bun | `pnpm check:boundaries`; `bun run scripts/checks/{error-table-sync,exit-code-literals,forbidden-literals,ambient-globals,workspace-entrypoints}.ts` | Layering, error table, exit literals, literals, import edges |
| CI `ts-test` | Bun (repo pin) | `pnpm test` after `pnpm install --frozen-lockfile` | Every `*.test.ts`, including synthetic SQLite stores and temp git repos |
| CI `ts-boundaries` | Bun | `pnpm build`; `pnpm check:boundaries` | Dependency-cruiser rules and negative fixtures |
| CI `ts-invariants` | Bun | `bun run scripts/checks/*.ts` | Error-table sync, literal scans, entrypoints |
| CI aggregate | Bun | `pnpm check`; `git diff --check` | Lint, format, typecheck, tests, boundaries, exports parity |
| Documentation | bash and manual | `bash scripts/.tests/test-doc-distribution.sh` (only if a marker-scoped doc changes) | Distribution-marker drift |
| Reference latency | Bun, injected monotonic timer | `bun test tests/checks/capsule-latency.test.ts` | Step budgets; apply p95 recorded, non-gating (GAP-C8) |

### 6.2 Test data

- **Fabricated identities only.** Work-item refs, SHAs, run ids, session ids, thread ids, PR numbers, principals, branches, and worktree paths are synthetic. No real repository name, person, provider payload, or credential appears.
- **Canaries.** Every privacy case plants a unique fabricated canary in the source of a leak (thread body/title, commit body, review prose, session content, provider payload, registered secret, environment value). A canary is never a real secret and is never reused outside its fixture.
- **Capsule fixtures.** `tests/fixtures/capsule/` holds line-list fixtures (valid, torn, duplicate, gap, post-close, CRLF), candidate YAML fixtures (one per class and per rejection), review artifacts, and golden event files. Lines are built from the production contract types so a vocabulary change breaks the fixture loudly.
- **Merged-diff fixtures.** `tests/fixtures/closeout/diff.ts` builds (a) a parent commit, (b) one squash-shaped diff introducing the four marker kinds, (c) the ambiguous variants, (d) an oversized diff for the budget case, and (e) the absent-transaction/unresolvable-SHA cases. Marker text contains a work-item ref and, where relevant, a unique canary that must not leak into residue.
- **Memory fixtures.** `tests/fixtures/memory/tree.ts` builds a temp `.ai/memory` with `README.md`, `lessons/`, `tacit/`, `agents/<agent>/`, seeded records for dedup/supersession, and a 199/200-line index. The live tree is snapshotted and asserted unchanged.
- **State and registry fixtures.** `tests/fixtures/state/harness.ts` provides temp JSONL stores and driver parity; `tests/fixtures/retro/harness.ts` builds `retro.run`/`retro.level`/`retro.trigger` records through the delivered contract types.
- **Harness fixtures.** Reuse `tests/fixtures/harness/opencode-store/build.ts` (synthetic SQLite in a temp root) and `tests/fixtures/harness/claude-code/**` (synthetic session files); extend with an over-cap file and out-of-port orphan rows for TC-CAP-047/048.
- **Temp git repos.** `tests/fixtures/closeout/temp-git.ts` is extended with a worktree builder (base branch, delivery branch at merged head, lock/foreign/current/dirty variants). Repos configure fixed identity and line endings; no remote exists.
- **Golden files.** Committed, canonicalized (sorted keys, no absolute paths, no volatile timestamps), regenerated only by an explicit reviewed command.

**Sanitization rule.** Any fixture that could carry personal, customer, credential, or repository-identifying data is fabricated; a fixture whose provenance cannot be stated is rejected in review. `tests/checks/fixture-sanitization.test.ts` covers the new fixture roots, and a planted real-looking secret in a fixture fails the check.

### 6.3 Isolation and cleanup

- Every filesystem case uses `mkdtemp` (or the temp-git helper) and removes the root in `afterEach`, including on failure.
- The live worktree and the live `.ai/memory` are never written. Both are snapshotted (path set + hashes) before and after the capsule/closeout suites and asserted unchanged.
- Synthetic SQLite connections are closed in `finally`; the capsule lock is released in `finally`; temp git worktrees are removed before the repo.
- Goldens and pinned shape fixtures are opened read-only; `mtimeMs` is asserted unchanged.
- Timers are injected; a test that needs ordering uses an injected scheduler, never `sleep`.
- Concurrency cases use deterministic barriers (promise orchestration), not timing races.

### 6.4 Entry and exit criteria

**Entry criteria (per phase P1..P11).**

1. The spec (v1.3) and this plan are the approved baseline; the phase's producing capability from the previous phase is green (for example P2 needs P1's capsule runtime).
2. The relevant delivered seams exist and are injectable (state port, provider transports, git seam, harness store seam, retro read, memory root).
3. Fixtures for the phase are sanitized and committed; the mutant entries for the phase are registered.
4. No live credential, network access, real `$HOME` store, or live worktree mutation is required.
5. The phase's implementation plan tasks are marked ready (delivery plan, authored in phase 4).

**Exit criteria (change-level).**

1. All 61 TCs executed with a recorded verdict; no TC left `Pending` at `dod_check`.
2. All 26 ACs green and all 11 NFRs measured with values in §10; the coverage matrix has no orphan TC and no uncovered AC/NFR.
3. All 44 mutants killed; the meta-check green.
4. `pnpm check` green on a clean checkout, plus error-table sync, exit-literal, doc-distribution, license, and vulnerability gates.
5. One lockstep changeset at the declared minor impact; no new runtime dependencies.
6. Neighbor documentation reconciled (TC-CAP-060) and the success-metric table evidenced (TC-CAP-061).
7. A PR against `main-tools` with required CI green, left open for human review (merge and owner acceptance are external, not claimed here).

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create or update | Execution command | Implementation status |
|-------|-------------------------------|-------------------|-----------------------|
| TC-CAP-001 | `tests/structure/capsule-contract.test.ts`; change-folder resolver | `bun test tests/structure/capsule-contract.test.ts` | To Implement |
| TC-CAP-002 | `tests/structure/capsule-contract.test.ts`, `tests/conformance/capsule-events.test.ts`, `tests/types/capsule.type-test.ts`; `packages/testkit/src/conformance/capsule.ts` | `bun test tests/conformance/capsule-events.test.ts tests/structure/conformance-coverage.test.ts`; `pnpm typecheck` | To Implement |
| TC-CAP-003 | `tests/behaviour/capsule-reader.test.ts`; `tests/fixtures/capsule/events/**` | `bun test tests/behaviour/capsule-reader.test.ts` | To Implement |
| TC-CAP-004 | `tests/behaviour/capsule-lock.test.ts` | `bun test tests/behaviour/capsule-lock.test.ts` | To Implement |
| TC-CAP-005 | `tests/behaviour/capsule-bounds.test.ts`; `tests/fixtures/capsule/caps.ts` | `bun test tests/behaviour/capsule-bounds.test.ts` | To Implement |
| TC-CAP-006 | `tests/behaviour/capsule-append.test.ts`, `tests/behaviour/closeout-capsule-close.test.ts` | `bun test tests/behaviour/capsule-append.test.ts tests/behaviour/closeout-capsule-close.test.ts` | To Implement |
| TC-CAP-007 | `tests/behaviour/capsule-phase-producer.test.ts` | `bun test tests/behaviour/capsule-phase-producer.test.ts` | To Implement |
| TC-CAP-008 | `tests/behaviour/capsule-commit-producer.test.ts` | `bun test tests/behaviour/capsule-commit-producer.test.ts` | To Implement |
| TC-CAP-009 | `tests/behaviour/capsule-verify-producer.test.ts` | `bun test tests/behaviour/capsule-verify-producer.test.ts` | To Implement |
| TC-CAP-010 | `tests/behaviour/capsule-producer-nongating.test.ts` | `bun test tests/behaviour/capsule-producer-nongating.test.ts` | To Implement |
| TC-CAP-011 | `tests/structure/capsule-imports.test.ts`, `tests/behaviour/closeout-capsule-gap.test.ts` | `bun test tests/structure/capsule-imports.test.ts tests/behaviour/closeout-capsule-gap.test.ts` | To Implement |
| TC-CAP-012 | `tests/behaviour/closeout-capsule-validation.test.ts`; `tests/fixtures/capsule/validation/**` | `bun test tests/behaviour/closeout-capsule-validation.test.ts` | To Implement |
| TC-CAP-013 | `tests/behaviour/closeout-capsule-backfill.test.ts` | `bun test tests/behaviour/closeout-capsule-backfill.test.ts` | To Implement |
| TC-CAP-014 | `tests/behaviour/closeout-capsule-plan.test.ts`; `tests/behaviour/closeout-plan.test.ts` (extend) | `bun test tests/behaviour/closeout-capsule-plan.test.ts tests/behaviour/closeout-plan.test.ts` | Existing – Update |
| TC-CAP-015 | `tests/behaviour/closeout-capsule-review-ingest.test.ts`; `tests/fixtures/capsule/review/**` | `bun test tests/behaviour/closeout-capsule-review-ingest.test.ts` | To Implement |
| TC-CAP-016 | `tests/golden/closeout-envelope.test.ts` (extend), `tests/behaviour/closeout-capsule-payload.test.ts`; `tests/fixtures/closeout/golden/capsule-applied.json` | `bun test tests/golden/closeout-envelope.test.ts tests/behaviour/closeout-capsule-payload.test.ts` | Existing – Update |
| TC-CAP-017 | `tests/structure/capsule-contract.test.ts`, `tests/behaviour/closeout-capsule-schema.test.ts` | `bun test tests/structure/capsule-contract.test.ts tests/behaviour/closeout-capsule-schema.test.ts` | To Implement |
| TC-CAP-018 | `tests/behaviour/closeout-capsule-promotion.test.ts`; `tests/fixtures/capsule/candidates/**` | `bun test tests/behaviour/closeout-capsule-promotion.test.ts` | To Implement |
| TC-CAP-019 | `tests/behaviour/closeout-capsule-dedup.test.ts` | `bun test tests/behaviour/closeout-capsule-dedup.test.ts` | To Implement |
| TC-CAP-020 | `tests/behaviour/closeout-capsule-supersession.test.ts` | `bun test tests/behaviour/closeout-capsule-supersession.test.ts` | To Implement |
| TC-CAP-021 | `tests/behaviour/closeout-capsule-routing.test.ts`; `tests/fixtures/memory/tree.ts` | `bun test tests/behaviour/closeout-capsule-routing.test.ts` | To Implement |
| TC-CAP-022 | `tests/behaviour/closeout-capsule-idempotency.test.ts` | `bun test tests/behaviour/closeout-capsule-idempotency.test.ts` | To Implement |
| TC-CAP-023 | `tests/behaviour/closeout-capsule-decisions.test.ts` | `bun test tests/behaviour/closeout-capsule-decisions.test.ts` | To Implement |
| TC-CAP-024 | `tests/behaviour/closeout-merged-diff.test.ts`; `tests/fixtures/closeout/diff.ts` | `bun test tests/behaviour/closeout-merged-diff.test.ts` | To Implement |
| TC-CAP-025 | `tests/behaviour/closeout-merged-diff-ambiguous.test.ts` | `bun test tests/behaviour/closeout-merged-diff-ambiguous.test.ts` | To Implement |
| TC-CAP-026 | `tests/checks/capsule-bounds.test.ts`, `tests/behaviour/closeout-merged-diff-bounds.test.ts` | `bun test tests/checks/capsule-bounds.test.ts tests/behaviour/closeout-merged-diff-bounds.test.ts` | To Implement |
| TC-CAP-027 | `tests/behaviour/closeout-merged-diff-gap.test.ts` | `bun test tests/behaviour/closeout-merged-diff-gap.test.ts` | To Implement |
| TC-CAP-028 | `tests/structure/capsule-contract.test.ts`; marker contract data | `bun test tests/structure/capsule-contract.test.ts` | To Implement |
| TC-CAP-029 | `tests/behaviour/providers/github-closeout-thread-authorship.test.ts`; `tests/fixtures/closeout/threads.ts` | `bun test tests/behaviour/providers/github-closeout-thread-authorship.test.ts` | To Implement |
| TC-CAP-030 | `tests/behaviour/closeout-thread-caps.test.ts` | `bun test tests/behaviour/closeout-thread-caps.test.ts` | To Implement |
| TC-CAP-031 | `tests/behaviour/providers/github-closeout-thread-privacy.test.ts`, `tests/checks/capsule-privacy.test.ts` | `bun test tests/behaviour/providers/github-closeout-thread-privacy.test.ts tests/checks/capsule-privacy.test.ts` | To Implement |
| TC-CAP-032 | `tests/structure/capsule-contract.test.ts`, `tests/behaviour/closeout-residue.test.ts` | `bun test tests/structure/capsule-contract.test.ts tests/behaviour/closeout-residue.test.ts` | To Implement |
| TC-CAP-033 | `tests/checks/capsule-privacy.test.ts`; `tests/fixtures/closeout/canary.ts` (extend) | `bun test tests/checks/capsule-privacy.test.ts` | To Implement |
| TC-CAP-034 | `tests/behaviour/closeout-attention-exit.test.ts`, `tests/golden/closeout-envelope.test.ts` (extend) | `bun test tests/behaviour/closeout-attention-exit.test.ts tests/golden/closeout-envelope.test.ts` | To Implement |
| TC-CAP-035 | `tests/behaviour/closeout-residue-provenance.test.ts` | `bun test tests/behaviour/closeout-residue-provenance.test.ts` | To Implement |
| TC-CAP-036 | `tests/behaviour/closeout-worktree.test.ts`; `tests/fixtures/closeout/temp-git.ts` (extend) | `bun test tests/behaviour/closeout-worktree.test.ts` | To Implement |
| TC-CAP-037 | `tests/behaviour/closeout-worktree-refusal.test.ts` | `bun test tests/behaviour/closeout-worktree-refusal.test.ts` | To Implement |
| TC-CAP-038 | `tests/behaviour/closeout-worktree-idempotency.test.ts` | `bun test tests/behaviour/closeout-worktree-idempotency.test.ts` | To Implement |
| TC-CAP-039 | `tests/structure/closeout-contracts-git.test.ts`, `tests/checks/capsule-cli-parity.test.ts`; `.dependency-cruiser.cjs` (fixture) | `bun test tests/structure/closeout-contracts-git.test.ts tests/checks/capsule-cli-parity.test.ts`; `pnpm check:boundaries` | To Implement |
| TC-CAP-040 | `tests/behaviour/closeout-retro-coverage.test.ts`; `tests/fixtures/retro/harness.ts` | `bun test tests/behaviour/closeout-retro-coverage.test.ts` | To Implement |
| TC-CAP-041 | `tests/behaviour/closeout-retro-coverage.test.ts` | `bun test tests/behaviour/closeout-retro-coverage.test.ts` | To Implement |
| TC-CAP-042 | `tests/behaviour/closeout-compaction.test.ts` | `bun test tests/behaviour/closeout-compaction.test.ts` | To Implement |
| TC-CAP-043 | `tests/behaviour/closeout-compaction-edges.test.ts` | `bun test tests/behaviour/closeout-compaction-edges.test.ts` | To Implement |
| TC-CAP-044 | `tests/structure/closeout-compaction-absence.test.ts`, `tests/structure/session-admin-contract.test.ts` | `bun test tests/structure/closeout-compaction-absence.test.ts tests/structure/session-admin-contract.test.ts` | Existing – No Change (asserted) |
| TC-CAP-045 | `tests/behaviour/closeout-telemetry-production.test.ts`; `tests/fixtures/closeout/harness-telemetry.ts` (extend) | `bun test tests/behaviour/closeout-telemetry-production.test.ts` | Existing – Update |
| TC-CAP-046 | `tests/behaviour/closeout-telemetry-nongating.test.ts`, `tests/behaviour/closeout-telemetry-idempotency.test.ts` | `bun test tests/behaviour/closeout-telemetry-nongating.test.ts tests/behaviour/closeout-telemetry-idempotency.test.ts` | Existing – Update |
| TC-CAP-047 | `tests/behaviour/harness-telemetry-claude-budget.test.ts`; `tests/fixtures/harness/claude-code/**` | `bun test tests/behaviour/harness-telemetry-claude-budget.test.ts` | To Implement |
| TC-CAP-048 | `tests/behaviour/harness-telemetry-opencode-orphan-scope.test.ts`; synthetic store builder | `bun test tests/behaviour/harness-telemetry-opencode-orphan-scope.test.ts` | To Implement |
| TC-CAP-049 | `tests/structure/harness-review-deferrals.test.ts`; `doc/spec/features/feature-harness-adapters.md` | `bun test tests/structure/harness-review-deferrals.test.ts`; phase-7 doc review | Implemented (code + phase-7 doc text) |
| TC-CAP-050 | `tests/structure/closeout-contract.test.ts` (extend), `tests/types/closeout.type-test.ts` | `bun test tests/structure/closeout-contract.test.ts`; `pnpm typecheck` | Existing – Update |
| TC-CAP-051 | `tests/structure/closeout-additive.test.ts`, `tests/types/closeout-attention.type-test.ts`; `tests/fixtures/closeout/legacy-consumer.ts` | `bun test tests/structure/closeout-additive.test.ts`; `pnpm typecheck` | To Implement |
| TC-CAP-052 | `tests/golden/closeout-envelope.test.ts`, `tests/golden/closeout-human.test.ts`, `tests/golden/closeout-residue.test.ts`; `tests/fixtures/closeout/golden/**` | `bun test tests/golden/closeout-envelope.test.ts tests/golden/closeout-human.test.ts tests/golden/closeout-residue.test.ts` | Existing – Update |
| TC-CAP-053 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/exit-code-literals.test.ts`, `tests/structure/result-contract.test.ts` | `bun test tests/structure/error-table.test.ts tests/structure/result-contract.test.ts tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts` | Existing – Update |
| TC-CAP-054 | `tests/checks/capsule-determinism.test.ts`; `tests/fixtures/closeout/determinism.ts` | `bun test tests/checks/capsule-determinism.test.ts` | To Implement |
| TC-CAP-055 | `tests/behaviour/closeout-convergence.test.ts` | `bun test tests/behaviour/closeout-convergence.test.ts` | To Implement |
| TC-CAP-056 | `tests/checks/capsule-latency.test.ts`; `tests/fixtures/closeout/performance.ts` | `bun test tests/checks/capsule-latency.test.ts` | To Implement |
| TC-CAP-057 | `tests/structure/state-contract.test.ts` (extend), `tests/structure/closeout-imports.test.ts` | `bun test tests/structure/state-contract.test.ts tests/structure/closeout-imports.test.ts` | Existing – Update |
| TC-CAP-058 | `tests/checks/capsule-mutants.test.ts`, `tests/checks/closeout-mutants.test.ts` (extend); `tests/fixtures/capsule/mutants/**` | `bun test tests/checks/capsule-mutants.test.ts tests/checks/closeout-mutants.test.ts` | To Implement |
| TC-CAP-059 | `tests/structure/inventory.json` (update), `tests/checks/capsule-ci-parity.test.ts`, `tests/structure/{content-inventory,subpaths}.test.ts` | `pnpm check`; `bun test tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/checks/capsule-ci-parity.test.ts` | Existing – Update |
| TC-CAP-060 | `doc/spec/features/feature-closeout.md` and the §18 neighbor list | Content review; `bash scripts/.tests/test-doc-distribution.sh` if marker-scoped docs change | Complete (phase 7/P11) |
| TC-CAP-061 | §10 execution log and the DoD-16 evidence table | Manual evidence review | Manual Only (P11) |

**Implementation mapping notes.**

- The capsule contracts land in the existing contracts tier beside `closeout.ts` (`as const` data + types only); the file runtime lands beside the existing change-folder locators in the file adapter; the domain evaluation is pure over injected facts. No new package or subpath is expected; if one is added, the subpath/inventory tests and TC-CAP-059 update in the same change.
- The producers extend `phase`, `commit`, and `verify` at their existing edges; they reuse the delivered state record writes and add the capsule append without altering record shapes. TC-CAP-007/008/009/010 assert the no-regression half.
- The closeout step expansion extends the delivered planner (`buildCloseoutPlan`) and the apply orchestrator; the four new mechanical steps are pure evaluators over injected facts, and the `capsule` step owns the promotion ceremony. Existing `closeout-*` suites run unchanged except the two golden updates.
- The git seam extension adds one worktree-removal capability to `packages/adapters/src/git/index.ts`; the dependency-cruiser runtime-API allowance stays one exact path with a reason and its negative fixture.
- The production composition change is in `packages/cli/src/edge.ts` (`createCloseoutComposition`): it constructs the M1-S11 capture from the configured harness and injects it. The test drives the production composition, not a test-only wiring (TC-CAP-045).
- Fixtures are extended, never forked: `tests/fixtures/closeout/harness.ts` gains capsule/state/memory roots; `tests/fixtures/closeout/harness-telemetry.ts` gains the production composition path; `tests/fixtures/state/harness.ts` and `tests/fixtures/retro/harness.ts` are consumed unchanged.
- The mutant copies are generated from production sources at test time (copy to a temp dir, apply one textual guard removal, import the copy); no mutated module is committed.
- The "Implementation status" column is the pre-delivery plan; §10 supersedes it with executed or deferred status.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation |
|----|--------------|------------|
| R-T1 | Provider thread-authorship fixtures encode a shape the live provider does not produce, so the policy passes while a real human thread is resolved (GAP-C1). | The normalization matrix asserts the closed `authorKind` and fail-closed default; unknown is human by construction; the fixture header records the provider shape and the finding; no AC depends on a live read. |
| R-T2 | Capsule tests fork the appenders or re-implement the envelope, so production can drift from the oracle. | Import production modules and drive the production writer/reader; the conformance registry covers the vocabulary; a seam that cannot be resolved fails naming it. |
| R-T3 | Determinism tests accidentally depend on filesystem enumeration or promise scheduling. | Shuffle creation/insertion order, inject deterministic barriers, assert id/canonical ordering; no `sleep`-based ordering. |
| R-T4 | In-process concurrency does not prove a cross-process lock (GAP-C9). | Assert exclusive acquisition and non-interleaving at the seam; record the single-user trust boundary; a cross-host case is out of scope by spec §12. |
| R-T5 | Diff fixtures are hand-built and may not resemble a real squash diff (GAP-C6). | Fixtures are built as real commits in a temp repo and read through the real diff invocation; the marker patterns are declared data with a reviewed-data test. |
| R-T6 | Temp git repos behave differently across git versions or global config. | Fix `user.name`/`user.email`, `core.autocrlf=false`, initial branch, and `commit.gpgsign=false`; assert the repo's own state, never the host's. |
| R-T7 | A promotion test writes the real `.ai/memory` and pollutes the repository. | Inject the memory root; snapshot the live tree and assert it unchanged; a test that resolves the live root fails. |
| R-T8 | The telemetry production test opens the real harness store. | Inject the store/file reader; assert the extractor is only ever the fake; a real-store read fails the hermetic guard. |
| R-T9 | Latency assertions flake on CI and get disabled. | Keep the per-step budgets generous and measured on bounded fixtures; record apply p95 as an artifact (GAP-C8) rather than a hard CI gate. |
| R-T10 | Goldens are regenerated wholesale, hiding a real behavior change. | Explicit reviewed regeneration; the golden inventory; only the three declared files may differ; a mutation control per golden. |
| R-T11 | The synthetic legacy-consumer fixture is written to pass, so tolerance is unproven (GAP-C10). | MUT-CAP-42 is a positional consumer that must fail; the fixture resolves by id and is reordered by the test. |
| R-T12 | `capsule-event-gap` residue is asserted with a synthetic mismatch that production could never create. | The mismatch is created through the delivered state-record writers (three real records, one capsule append suppressed), and the detection is the production cross-check. |
| R-T13 | The attention exit is asserted only at the envelope layer, not the process exit. | Drive `runCli` and assert the returned numeric exit code; assert the scripted line shape; assert no error sibling. |
| R-T14 | The 44-mutant register drifts as code changes and mutants stop compiling. | Mutants are textual guard removals in temp copies with a compile/harness guard; a non-compiling mutant fails the meta-check rather than being skipped. |
| R-T15 | The spec v1.1–v1.3 resolutions drift from the plan/tests (a ninth rejection reason reappears, a PM-notes residue is fabricated, a failure envelope grows a `residue[]`, a path escape writes outside the root or uses a new row, or contradiction is inferred rather than declared). | GAP-C14..GAP-C17 record the pinned rules; TC-CAP-017/018 assert the eight-reason set, TC-CAP-035 the PM-notes rule, TC-CAP-005/034/037 the failure-envelope rule, TC-CAP-021/053 the path identities and no-new-row rule, and TC-CAP-020/022 the `contradicts`/`supersedes` precedence. A drift fails a TC and reopens the spec, never the other way round. |

### 8.2 Assumptions

- The capsule is file-based inside the existing change folder; the change directory is available to `phase`, `commit`, and `verify` through their existing injected edge options (spec §12), so no new configuration key is needed.
- The capsule file runtime exposes an injectable directory root and a lock seam; tests inject a temp root instead of the workspace.
- The delivered `retro.run` record's `scope` field carries the work-item ref at level `change`; the coverage read is the delivered validated boundary.
- The harness-store attribution seam delivers work-item attribution for opencode sessions and a session-tree mapping for Claude Code; no other store is tested.
- The git seam can be extended with one fixed-argv worktree-removal operation without a new runtime-API allowance location.
- The memory home root is injectable; `lessons/` and `tacit/` exist in the temp tree, and `preferences/`/guild trees do not (M2-S8).
- A restart re-run is proven convergence with identical injected facts (including the run identity), because NFR-1 defines determinism over identical injected ids; a new run identity is a new telemetry capture identity, not a duplicate (OQ-T3).
- Bun (and `bun:sqlite`) is available in `bun test`; the synthetic store builder uses the workspace SQLite loader pattern.
- The delivered suites (`closeout-*`, `harness-*`, `state-*`, `retro-*`, `session-admin-*`, `commit-*`, `verify-*`, `merge-*`) run unchanged and are the regression half of this plan.
- Delivery-bound names (module paths, exports, schema strings, candidate spellings, marker patterns, cap numbers within declared ranges, evidence renderings) are chosen by the plan/delivery; the semantics and pinned vocabularies in this plan are not negotiable.

### 8.3 Open Questions

Resolved items are retained as records with their pinned rule, so the plan and the spec cannot drift silently.

| ID | Question | Blocking? | Owner | Resolution path |
|----|----------|-----------|-------|-----------------|
| OQ-T1 (S-1 — resolved in spec v1.1) | The rejection-reason set. | No — resolved | `@spec-writer` | Spec v1.1 removed `scope-invalid`; the set is exactly eight, and an out-of-set `scope` (or other required-field/closed-vocabulary violation) is a candidate schema failure → `closeout.capsule-invalid`. TC-CAP-017/018 assert the eight-reason set and the schema-failure path; no action remains. |
| OQ-T2 (S-2 — resolved in spec v1.1) | Whether closeout checks PM-notes completeness. | No — resolved | `@spec-writer` | Spec v1.1 pins that closeout v1 performs no PM-notes completeness check and fabricates no residue for it (the delivered PM-notes lint/lifecycle own it); only an unreadable review artifact is `review-verdict-unreadable` residue. TC-CAP-035 asserts the resolved rule; no action remains. |
| OQ-T3 | Does a restart re-run reuse the run identity for telemetry idempotency, or is a new run id a new capture identity? | No | `@plan-writer` / `@coder` | Pinned reading: convergence is proven with identical injected facts (NFR-1); the delivered capture identity is run-scoped, so a new run id is a new capture record, not a duplicate. TC-CAP-055 asserts both readings explicitly. If the delivery makes capture delivery-scoped, TC-CAP-055's secondary assertion tightens and the plan updates. |
| OQ-T4 | What is the step outcome token for `session-compaction` when sessions exist (checkpoint written, harness invocation a declared gap)? | No | `@plan-writer` | `skipped-gap` (the invocation gap) or `satisfied` (the checkpoint landed) are both consistent; the TC asserts the checkpoint event, the `harness-compaction-unavailable` evidence, and that the outcome is non-failing and non-residue. The chosen token is read from contract data and pinned in TC-CAP-042. |
| OQ-T5 (resolved in spec v1.1) | Whether plan mode renders the additive `capsule` object. | No — resolved | `@spec-writer` | Spec v1.1 F-3 pins the `capsule` object **absent in plan mode**; TC-CAP-014/006 assert `payload.capsule === undefined` for valid, invalid, and closed plan runs. |
| OQ-T6 | Exact candidate YAML spellings, index row format, capsule digest algorithm/spelling, and marker patterns | No | `@coder` | Delivery-bound; tests read them from contract data and fixtures, and assert semantics (one row, bounded digest, pattern compiles), never a frozen spelling. |
| OQ-T7 | Session identification cap number and the exact truncation mark spelling | No | `@coder` | Declared contract data within the declared bound; TC-CAP-042/043 assert `≤ cap` plus a mark, not a frozen number. |
| OQ-T8 | Where the `capsule` step's decision counts and digest are computed (planner vs apply) | No | `@coder` | The close event payload is the authority (F-3); the test recomputes the digest and counts from the file, independent of where it is computed. |
| OQ-T9 | Is `closeout.step` a per-step capsule event for all steps or only owed-flip evidence? | No | `@plan-writer` | F-1 lists the kind generally and F-5 requires the owed-flip evidence record; the plan asserts the owed-flip record and tolerates additional `closeout.step` events as long as they are keyed and bounded. |
| OQ-T10 | Does the delivered closeout expose the capsule step count (twelve) as a bounded constant consumers can read? | No | `@coder` | TC-CAP-050 reads the step array length and the contract constant; no new field is required. |
| OQ-T11 (S-3 — resolved in spec v1.1) | Where residue is asserted when a run ends in a command-level failure. | No — resolved | `@spec-writer` | Spec v1.1 pins the F-11 rule: exactly one of `data`/`error`; a command-level failure returns the error envelope with no structured `residue[]`; the failed step's bounded evidence (error summary and human diagnostic) names each refused/preserved item with count and identity; the same residue is assertable in plan mode. TC-CAP-005/034/037 and §4.8 assert it; no action remains. |
| OQ-T12 (R-1 — resolved in spec v1.3) | The error identities for a promotion write refused on a path violation. | No — resolved | `@spec-writer` | Spec v1.3 pins: id/record-name outside the slug shape (separator or `..`) → `closeout.capsule-invalid` before any write; a resolved home outside the injected root after realpath (symlink/absolute/traversal) → `closeout.step.capsule.failed` with zero writes and plan `would-refuse`; no new error row. TC-CAP-021/053 and GAP-C17 assert it; no action remains. |
| OQ-T13 (R-2 — resolved in spec v1.3) | How a contradiction is declared and detected. | No — resolved | `@spec-writer` | Spec v1.3 pins an explicit `contradicts: <record-id>` paired with `supersedes: <record-id>` for the same id; target existence first (unknown target → `supersedes-unknown`), otherwise missing/different `supersedes` → `contradiction-requires-supersession`; dedup stays exact normalized-statement equality with no similarity/embedding/model judgment. TC-CAP-020/022 assert it; no action remains. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | @test-plan-writer | Initial test plan for GH-240 (M1-S12: Change capsule completion and closeout expansion), derived from the then-current spec (v1.0). 61 TCs (TC-CAP-001..061) cover all 26 ACs, all 11 NFRs, EVT-1..EVT-5, DM-1..DM-10, and DEC-1..DEC-16, mapped to the spec §18 delivery phases P1..P11. Binding oracles for the capsule envelope/append/lock/close, the validation matrix, promotion routing and idempotency, the merged-diff sweep, thread authorship, the worktree predicate, residue/attention exits, two-stream telemetry, and contract evolution; 44 named guard mutants (at least one per F-1..F-12) with a non-vacuity meta-check; inherited GAP-C1..GAP-C6 plus new GAP-C7..GAP-C16. |
| 1.1 | 2026-11-07 | @test-plan-writer | Aligned to spec v1.1's three consistency fixes, minimally. **S-1:** the rejection-reason assertion is eight (not nine); `scope-invalid` is gone, and an out-of-set `scope`/closed-vocabulary violation is asserted as a candidate schema failure → `closeout.capsule-invalid`. GAP-C14/OQ-T1 closed; TC-CAP-017/018 updated. **S-2:** closeout performs no PM-notes completeness check and fabricates no residue for it; only an unreadable review artifact is `review-verdict-unreadable`. GAP-C15/OQ-T2 closed; TC-CAP-035 updated. **S-3:** a command-level failure returns the error envelope with no structured `residue[]`, and the failed step's bounded evidence plus the human diagnostic name the refused/preserved item; the same residue is asserted in plan mode. GAP-C16/OQ-T11 closed; TC-CAP-005/034/037 and the §4.8 exit matrix updated. Also aligned OQ-T5 and TC-CAP-006/014 to F-3's pinned "capsule object absent in plan mode". TC ids, count (61), and all other oracles unchanged; coverage re-verified 26/26 ACs and 11/11 NFRs. |
| 1.2 | 2026-11-07 | @test-plan-writer | Aligned to spec v1.2 and DoR iteration-1. **Finding 3:** TC-CAP-014 step 3 now asserts the step outcomes P3 delivers (seven + `capsule`), leaving the exact twelve-step array to TC-CAP-050; no oracle weakened. **Finding 4/DM-6:** the four diff action tokens (`remove-guard`, `retire-flag`, `rename-class`, `close-todo`) and the fixed kind→action mapping are asserted in §4.5 and TC-CAP-028, with out-of-vocabulary, kind-mismatched, and action-less hits proven `ambiguous-flip-hit` (TC-CAP-025, TC-CAP-024). **Finding 5:** the durable `capsule.promotion` payload (`{id, class, decision, mode?, home?, reason?, supersedes?}`) and the applied `capsule.candidates[]` projection (`{id, decision, home?, reason?}`) are now asserted as two distinct shapes with absence checks (TC-CAP-016/020/023; EVT-2/DM-3/DM-5). **Finding 6:** pre-existing-target handling is the pinned three-outcome matrix — byte-identical `satisfied` no-op, same-identity `duplicate:<existing-id>`, conflicting-statement `contradiction-requires-supersession`, no overwrite (TC-CAP-022/023; §4.4). **Finding 7:** candidate `status` (`candidate`/`authoritative`/`superseded`) and the five evidence shapes are asserted with positive/negative cases and `capsule-invalid` for structural violations (TC-CAP-017/018; §4.4; AC-F4-1). **Finding 8 (security):** TC-CAP-021 now asserts traversal/absolute/symlink path escape with zero writes outside the injected root and a classified refusal (GAP-C17/OQ-T12). **Busy lock:** contention is the retryable `state.lock.busy` (exit 2), never `closeout.capsule-invalid` (TC-CAP-004/010/053; §4.2/§4.8; AC-F1-3/NFR-11). **Nits:** TC-CAP-050 fixture wording fixed; TC-CAP-005 command no longer names the P5 checks file; TC-CAP-021/022 assert the declared naming and monotonic cross-family id allocation. TC ids and count (61) unchanged (no new TC); 44 mutants unchanged; coverage re-verified 26/26 ACs, 11/11 NFRs, no orphans. |
| 1.3 | 2026-11-07 | @test-plan-writer | Aligned to spec v1.3's two pins; no other oracle moved. **R-1 (path confinement):** GAP-C17 and OQ-T12 converted to resolved with the exact identities — id/record-name outside the slug shape (separator or `..`) → `closeout.capsule-invalid` before any write; a resolved home outside the injected root after realpath (symlink/absolute/traversal) → `closeout.step.capsule.failed` with zero writes and plan `would-refuse`; **no new error row**. TC-CAP-021 step 8/oracle rewritten to assert both identities, the pre-write boundary, the outside-target snapshot, and the no-new-row rule; TC-CAP-053 asserts the family row is reused and no path-specific row exists; §4.4 path paragraph, §3.1 AC-F4-1/AC-F4-2, §3.3 NFR-9 aligned. **R-2 (explicit contradiction):** OQ-T13 converted to resolved; dedup stays exact normalized-statement equality; a candidate declares `contradicts: <record-id>` paired with `supersedes: <record-id>` for the same id; target existence first (`supersedes-unknown`), otherwise missing/different `supersedes` → `contradiction-requires-supersession`; no similarity/embedding/model judgment. TC-CAP-017 adds the `contradicts` optional key and path-shaped-value behaviour; TC-CAP-020 rewritten (accepted pair, existence-first negative, no-supersedes negative, different-target negative, near-match control); TC-CAP-022's differing-target branch and a matching-pair control rewritten; §4.4 reason matrix, contradiction/dedup paragraphs, and the three-outcome target matrix updated; AC-F4-1/AC-F4-3 and DM-2 aligned. TC ids, count (61), phase fields, and 44 mutants unchanged; coverage re-verified 26/26 ACs, 11/11 NFRs, no orphans. |
| 1.4 | 2026-11-07 | @doc-syncer | P12 review remediation alignment, evidence-only. **AC-F5-1/TC-CAP-025:** the declared contract-data marker action is authoritative, so an action-less line naming the work item resolves; TC-CAP-025's stale action-less-ambiguous case is replaced by the positive declared-action control while out-of-vocabulary and kind-mismatched cases remain ambiguous. **TC-CAP-060:** evidence row records the iteration-3 neighbour reconciliation and the F-7/F-14 documentation corrections. No other oracle, TC id, phase, mutant, or coverage count changed. |
| 1.5 | 2026-11-07 | @doc-syncer | Iteration-2 pre-PR fold alignment, evidence-only. **F-16:** TC-CAP-025/AC-F5-1 now assert that an explicit `@action:<unknown>` token is `out-of-vocabulary-action`, while ordinary hyphenated prose and action-less lines resolve via the valid declared action. **F-17:** the normalization matrix names Mannequin as `unknown` (fail-closed human); Bot/App remain `non-human`. **F-18:** TC-CAP-007 asserts distinct no-commit transition keys via the persisted `transitionId` and re-run no-op. **F-19:** TC-CAP-007/008 target layers include `capsule-producer-port.test.ts`. No TC id, oracle count, phase, mutant, or coverage count changed. |

## 10. Test Execution Log

Execution window and runtime are recorded when the coder runs the plan (branch `feat/GH-240/capsule-closeout`). Replace each `Pending` with `PASS`/`FAIL` and the command evidence; record measured NFR values in the Notes column. A TC without a verdict blocks `dod_check`.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-CAP-001 | — | Pending | |
| TC-CAP-002 | — | Pending | |
| TC-CAP-003 | — | Pending | |
| TC-CAP-004 | — | Pending | |
| TC-CAP-005 | — | Pending | |
| TC-CAP-006 | — | Pending | |
| TC-CAP-007 | — | Pending | |
| TC-CAP-008 | — | Pending | |
| TC-CAP-009 | — | Pending | |
| TC-CAP-010 | — | Pending | |
| TC-CAP-011 | — | Pending | |
| TC-CAP-012 | — | Pending | |
| TC-CAP-013 | — | Pending | |
| TC-CAP-014 | — | Pending | |
| TC-CAP-015 | — | Pending | |
| TC-CAP-016 | — | Pending | |
| TC-CAP-017 | — | Pending | |
| TC-CAP-018 | — | Pending | |
| TC-CAP-019 | — | Pending | |
| TC-CAP-020 | — | Pending | |
| TC-CAP-021 | — | Pending | |
| TC-CAP-022 | — | Pending | |
| TC-CAP-023 | — | Pending | |
| TC-CAP-024 | — | Pending | |
| TC-CAP-025 | — | Pending | |
| TC-CAP-026 | — | Pending | |
| TC-CAP-027 | — | Pending | |
| TC-CAP-028 | — | Pending | |
| TC-CAP-029 | — | Pending | |
| TC-CAP-030 | — | Pending | |
| TC-CAP-031 | — | Pending | |
| TC-CAP-032 | — | Pending | |
| TC-CAP-033 | — | Pending | |
| TC-CAP-034 | — | Pending | |
| TC-CAP-035 | — | Pending | |
| TC-CAP-036 | — | Pending | |
| TC-CAP-037 | — | Pending | |
| TC-CAP-038 | — | Pending | |
| TC-CAP-039 | — | Pending | |
| TC-CAP-040 | — | Pending | |
| TC-CAP-041 | — | Pending | |
| TC-CAP-042 | — | Pending | |
| TC-CAP-043 | — | Pending | |
| TC-CAP-044 | — | Pending | |
| TC-CAP-045 | — | Pending | |
| TC-CAP-046 | — | Pending | |
| TC-CAP-047 | — | Pending | |
| TC-CAP-048 | — | Pending | |
| TC-CAP-049 | `tests/structure/harness-review-deferrals.test.ts` green; `feature-harness-adapters.md` records F-8/F-11 resolved and F-9 re-deferred with the M1-S9 reason, and no superseded composer sentence remains | Pass | Phase-7 doc-text half satisfied |
| TC-CAP-050 | — | Pending | |
| TC-CAP-051 | — | Pending | |
| TC-CAP-052 | — | Pending | |
| TC-CAP-053 | — | Pending | |
| TC-CAP-054 | — | Pending | |
| TC-CAP-055 | — | Pending | |
| TC-CAP-056 | — | Pending | |
| TC-CAP-057 | — | Pending | |
| TC-CAP-058 | — | Pending | |
| TC-CAP-059 | — | Pending | |
| TC-CAP-060 | All §18 neighbours reconciled: closeout (root-author thread policy with `User`→human, `Bot`/`App`→non-human, `Mannequin`/absent→unknown; full pre-flight ordering; registry-backed retro coverage; content-hash diff evidence with declared-token/`@action` classification; worktree drift re-check; residue dedupe and the extra `+N` sentinel; human JUDGMENT RESIDUE), capsule (first-event, naming, one-decision, compaction key, declared constants, `transitionId` phase key), result contract, harness adapters, state layer, retro pipeline, session database admin, merge/verify deploy, commit primitive, pm-notes/phase transitions, verify gates, spend read side, `.ai/memory/README.md`, `AGENTS.md`, `00-index.md`, architecture/glossary/ubiquitous language; the inception link anchor repaired, the brand literal removed, error-table sync and doc-distribution green, and the decision-record recommendation remains routed in pm-notes | Pass | Phase-7 doc-sync iteration 4 complete |
| TC-CAP-061 | — | Pending | |
