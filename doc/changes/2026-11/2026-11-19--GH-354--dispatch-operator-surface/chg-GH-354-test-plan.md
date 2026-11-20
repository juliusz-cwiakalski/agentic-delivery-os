---
id: chg-GH-354-test-plan
status: Updated
created: 2026-11-19
last_updated: 2026-11-20
owners: ["engineering"]
service: "delivery-os dispatch engine"
labels: ["dispatch", "operator-surface", "m4-s12", "status", "log", "is-delivering", "last-message"]
version_impact: minor
summary: "Offline, deterministic battery for the four typed operator queries: 12/12 lifecycle-state combinations through the real composed command path, the repository filter applied before the lane fold and its tri-state probe, the typed lane-store failure on every query that reads it, the bounded reference-scoped artifact tail with its stitched read, torn-tail drop and retention window — including a machine window bounded by bytes only while the human form keeps its 200-line bound, the delivering fold with both forms, the capability-gated transcript read with its redaction order and raw-text seam, the entrypoint-resolved registered credential redacted before the message cut, the per-stream append-only write path, and the read-only and shell-free posture — every one of the 38 acceptance criteria mapped to a named case."
links:
  change_spec: ./chg-GH-354-spec.md
  implementation_plan: ./chg-GH-354-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M4-S12: Dispatch operator surface — status, log, is-delivering, last-message (M4)

## 1. Scope and Objectives

This plan protects the four read contracts the change adds — a `status` fold over the durable `dispatch.lane` record joined with an advisory tri-state owner probe, a bounded and reference-scoped `log` over a new per-ref artifact family, an `is-delivering` fold in two admissible forms, and a capability-gated `last-message` read of the harness's own persisted transcript — together with the two postures that make them safe to run during a delivery: the read path writes nothing, and the read path touches no shell surface.

The integrity risks that shape the plan are: a stale lane reported live (or a live owner reported dead) because the probe is a two-state guess; a "healed" status that rewrites, clears, or repairs the lane and destroys resumability; a `log` that mixes two refs, scans a directory tree, returns a torn write as content, or grows without bound; a `last-message` that composes a sentence, reads the envelope's synthesized `lastMessage`, discloses a credential across the 512-character cut, or starts a session; a sink that changes a delivery's token, exit, record, or evidence when it faults; and a "read-only and shell-free" claim that is only asserted in prose. Every one of those is a case below with a named mutation that must make it fail.

The plan is offline and deterministic: no live opencode, no live Claude Code, no live GitHub, no model call, no real child process, and no live process-table read anywhere in the battery. It extends the delivered dispatch conformance fixtures, the GH-347 production-composition harness, and the delivered opencode store fixture rather than building a second harness; a second harness would prove a second implementation (spec §12, `RSK-11`).

### 1.1 In Scope

- `AC-F1-1`…`AC-F7-4` (38 acceptance criteria) — every one mapped in §3.1 with zero unmapped and zero orphan cases.
- `NFR-1`…`NFR-11`, and the interface/data-model contracts `API-1`…`API-12`, `DM-1`…`DM-7`.
- The four query forms, their grammar and refusal identities, their human and `--json` payloads, and their exit projections in all three lifecycle states — including the repository filter that must precede the per-ref fold, and the store's typed `state.*` failure that each lane-reading query projects at its own row instead of answering `absent` or `false`.
- The per-ref harness-stdout artifact family — its per-stream write points and binding point, the one writer rule, the one tear rule, the per-file cap by segmentation, the cross-boundary continuation, the two-file retention and the 2 × 1 048 576-byte family bound — and its read contract (listed scope, stitched order, torn-tail drop, one truncation fact, and the machine/human bound split: the machine `data` is bounded by bytes only, so a 220-line retained window is returned whole, while the human form keeps its own 200-line bound).
- The injected transcript read seam, its capability gating, its closed absence ladder, its finality rule, its raw-text return under the reader's own read cap, and its `redact → flatten → bound → mark` composition order, which lives in the query rather than in the seam — observed end to end from the registered credential set the CLI entrypoint resolves out of the injected environment to the composed answer.
- The read-only and shell-free posture across all four queries and both `is-delivering` forms, the extension of the no-shell invariant to the new surfaces, and the decoy-artifact and shell-absent observations (ticket ACs: "the log is bounded and reference-scoped", "`last-message` returns the PM's final message rather than a classifier sentence", "no shell script is read or executed").
- The contract-invariance regression: seven operations, four lifecycle capabilities, the gap inventory and every adapter declaration, the error table, the domain kinds, the token/projection/exit matrices, the lane and attempt key sets, the 16-reference evidence budget, and the help-entry count moving five → nine with an unchanged coverage inventory and page set.

### 1.2 Out of Scope & Known Gaps

Not proven by this plan, by design, and acceptable for the reasons given (design provenance: spec §25.3 Appendix C, `RSK-11`, `RSK-15`, `RSK-22`, `RSK-20`):

| Not proven | Why this is acceptable |
|------------|------------------------|
| A *live* opencode or Claude Code persisted-storage layout beyond the two generations the delivered fixture records | `TC-MSG-010` proves the reader against a built store of the recorded `current` and `legacy` generations with recorded statement shapes; a future layout drift degrades to a closed absence (`session-unknown` / `no-message`), never a wrong answer, and is a live observation, not an engineering claim. |
| A *live* Claude Code lane's real `capability-gap` behaviour | The declaration is data (`lifecycleCapabilities` and the gap list in the adapter) and `TC-MSG-005` asserts the answer from that declaration; the adapter is not called at all, which is the property under test. |
| Real kernel process semantics behind the owner probe | The battery injects the three verdicts and the start-instant deltas and asserts the mapping (including 5 000 ms boundary selection). Reading a real process table is an OS property this change does not alter. |
| Real stdout framing across a live session, and a real torn write on a real filesystem | The line channel's contract (LF split plus an unmarked final remnant) is exercised through the scripted streaming starter, and a torn tail is a planted file state. Both are the observable contract; fsync/ENOSPC behaviour is not. |
| Real append interleaving across processes, and real concurrency for one ref | Two streams of one ref are driven through two concurrent scripted streams over one composed program, which is the deterministic form of the property. An arbitrary OS schedule would prove nothing repeatable. |
| Real snapshot timing (a segment switch or an append in flight during a read) | `TC-LOG-011` asserts the declared tolerance: the answer states what was durable and never claims coordination. A racy wall-clock window cannot be reproduced deterministically. |
| Disk-full and real `0600` enforcement | `TC-PERSIST-001`/`TC-PERSIST-008` assert the mode the writer sets and the delivered mode check on read-back; a real permission audit is an OS property not moved by this change. |
| Long-run artifact growth at real session volume | The bounds are asserted structurally (per-file cap, two-file retention, 2 × cap family) rather than by producing gigabytes. |
| A one-shot adapter's invocation | Claude Code yields no stream, so there is no artifact to inspect; `TC-PERSIST-004` proves no directory and no sink for such a lane, which is the whole contract. |

This table documents the boundary; it is not the boundary's source. The permanent source is the fixture constant `OPERATOR_PROOF_BOUNDARY` in `tests/fixtures/dispatch/operator/bounds.ts` (proven and not-proven ids in declared order), asserted by `TC-FIXTURE-002`. Neither this plan nor the change specification is a permanent source, and no permanent suite reads `doc/changes/**`.

Also out of scope (spec §7.2, `NG-1`…`NG-9`): daemon-lane inspection, any change to delivery semantics, per-ref lane history, the top-level `status` digest / `brief` / `board` / `lanes list`, any read or write of `tmp/deliver-ticket/**` or `.ai/local/delivery/**`, shell entry-point changes, new configuration keys, new flags beyond `--tail`, the `loop status`/`loop log` surface (M4-S10), and live-kernel parity claims.

## 2. References

| Reference | Use |
|-----------|-----|
| `./chg-GH-354-spec.md` (v1.4) | Source of the 38 ACs, `F-1`…`F-7`, `API-1`…`API-12`, `DM-1`…`DM-7`, `NFR-1`…`NFR-11`, `RSK-1`…`RSK-23`, Appendix C (answer matrix and proof boundary), Appendix D (fixture- and implementation-decided details) |
| `./chg-GH-354-pm-notes.yaml` | Scope decisions, the two-form `is-delivering` ruling, the marker derivation, the segment-file design supersession, the declared stream divergence, and the `TMPDIR`/`PATH`/`pnpm build` operational prerequisite |
| `doc/decisions/TDR-0058-dispatch-session-output-artifacts-and-transcript-read-seam.md` | Authoritative for the artifact family (DC-1…DC-3), the transcript read seam (DC-4), the composition order and finality rule (DC-5), the privacy boundary (DC-6), and the six plan-pinned obligations and their named tests (`artifact-naming`, `segment-switch`, `torn-line-reader`, `two-segment-tail`, `segment-ordering`, `sink-fault-observational`) |
| `doc/decisions/TDR-0049` | Dispatch-owned durable lane record (kind, field set, advisory owner facts, latest-wins read, no content) |
| `doc/decisions/TDR-0024` | Dispatch attempt read side — the read-only posture and the data-projection precedent this surface follows |
| `doc/decisions/TDR-0051` | The capability-gated, declared-seam pattern reused for a read |
| `.ai/rules/testing-strategy.md` | Layers, module→test mapping, invariant-authoring rules, and `pnpm check` as the aggregate |
| `doc/spec/features/feature-dispatch-engine.md`, `feature-state-layer.md`, `feature-harness-adapters.md`, `feature-autonomous-delivery.md`, `doc/guides/engine-first-operations.md` | Current truth this plan pins; reconciled in the documentation phase (spec Appendix A), not asserted here |
| `doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-test-plan.md`, `chg-GH-347-plan.yaml` | The closest precedent: case-id conventions, coverage-matrix shape, fixture inventory, driver discipline, mutation register, and gate battery this plan extends |
| `packages/core/src/contracts/dispatch.ts`, `packages/core/src/contracts/harness.ts`, `packages/core/src/app/dispatch-ledger.ts`, `packages/core/src/app/dispatch-lane.ts`, `packages/cli/src/commands/dispatch.ts`, `packages/cli/src/projection.ts`, `packages/cli/src/output/serialize.ts`, `packages/cli/src/edge.ts`, `packages/cli/src/production.ts`, `packages/adapters/src/harness/opencode.ts`, `packages/adapters/src/harness/claude.ts`, `packages/adapters/src/harness/sqlite-loader.ts`, `packages/adapters/src/file/ceremony-artifacts.ts` | The delivered surfaces the cases drive; every assertion names the module it observes |
| `tests/fixtures/dispatch/parity/{harness,lane,process-runner,seams,cases,evidence}.ts`, `tests/fixtures/dispatch/{attempts-harness,attempts-production,attempt-records,harness}.ts`, `tests/fixtures/harness/opencode-store/**`, `tests/fixtures/projects/state-scope.ts`, `tests/fixtures/verify-gates/cases/network-guard.ts` | The fixture surface this plan extends rather than duplicates |
| `tests/checks/no-shell-dispatch.test.ts`, `scripts/checks/no-shell-dispatch.ts`, `scripts/checks/exit-code-literals.ts`, `tests/fixtures/help-guide/coverage.json` | The invariant, the exit-literal guard, and the help/guide inventory the change extends |

`./chg-GH-354-plan.yaml` is authored in `delivery_planning` (phase 4) after this plan; this plan is its input and fixes the plan-phase scope items it must carry — the fixture and suite inventory of §7.3, the declared read-side seams of §7.1, and the TDR-0058 plan-pinned obligations restated in §6.2.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

38 acceptance criteria, 38 mapped, 0 unmapped, 0 orphans. Every case named in this column exists in §5.1/§5.2, and every case in §5.1 either appears here or is linked in §3.2/§3.3 to an `API-`/`DM-`/`NFR-` id or a TDR-0058 rule.

| AC | Capability | Case(s) | Status |
|----|-----------|---------|--------|
| `AC-F1-1` | F-1 | `TC-STATUS-001`, `TC-MATRIX-001` | Planned |
| `AC-F1-2` | F-1 | `TC-STATUS-002`, `TC-MATRIX-001` | Planned |
| `AC-F1-3` | F-1 | `TC-STATUS-003`, `TC-MATRIX-001` | Planned |
| `AC-F1-4` | F-1 | `TC-STATUS-004` | Planned |
| `AC-F1-5` | F-1 | `TC-STATUS-005` | Planned |
| `AC-F1-6` | F-1 | `TC-STATUS-006` | Planned |
| `AC-F1-7` | F-1 | `TC-STATUS-007` | Planned |
| `AC-F2-1` | F-2 | `TC-LOG-001`, `TC-LOG-002`, `TC-LOG-009`, `TC-MATRIX-001` | Planned |
| `AC-F2-2` | F-2 | `TC-LOG-003`, `TC-GRAMMAR-003` | Planned |
| `AC-F2-3` | F-2 | `TC-LOG-004`, `TC-LOG-005`, `TC-CONTRACT-003`, `TC-MATRIX-001` | Planned |
| `AC-F2-4` | F-2 | `TC-LOG-006`, `TC-MATRIX-001` | Planned |
| `AC-F2-5` | F-2 | `TC-LOG-007`, `TC-LOG-008`, `TC-LOG-012` | Planned |
| `AC-F2-6` | F-2 | `TC-LOG-002`, `TC-LOG-009`, `TC-PERSIST-005`, `TC-PERSIST-006`, `TC-PERSIST-007` | Planned |
| `AC-F3-1` | F-3 | `TC-ISDEL-001`, `TC-MATRIX-001` | Planned |
| `AC-F3-2` | F-3 | `TC-ISDEL-002`, `TC-MATRIX-001` | Planned |
| `AC-F3-3` | F-3 | `TC-ISDEL-003`, `TC-ISDEL-004`, `TC-ISDEL-007` | Planned |
| `AC-F3-4` | F-3 | `TC-ISDEL-005`, `TC-MATRIX-001` | Planned |
| `AC-F3-5` | F-3 | `TC-ISDEL-006` | Planned |
| `AC-F4-1` | F-4 | `TC-MSG-001`, `TC-MSG-010`, `TC-MSG-011`, `TC-MATRIX-001` | Planned |
| `AC-F4-2` | F-4 | `TC-MSG-002` | Planned |
| `AC-F4-3` | F-4 | `TC-MSG-003`, `TC-MATRIX-001` | Planned |
| `AC-F4-4` | F-4 | `TC-MSG-004`, `TC-MATRIX-001` | Planned |
| `AC-F4-5` | F-4 | `TC-MSG-005`, `TC-MSG-006`, `TC-MSG-009` | Planned |
| `AC-F4-6` | F-4 | `TC-MSG-007`, `TC-MSG-010` | Planned |
| `AC-F4-7` | F-4 | `TC-MSG-008`, `TC-MSG-011` | Planned |
| `AC-F5-1` | F-5 | `TC-GRAMMAR-001`, `TC-MATRIX-001` | Planned |
| `AC-F5-2` | F-5 | `TC-GRAMMAR-002`, `TC-GRAMMAR-003`, `TC-LOG-003` | Planned |
| `AC-F5-3` | F-5 | `TC-GRAMMAR-004` | Planned |
| `AC-F5-4` | F-5 | `TC-GRAMMAR-005`, `TC-CONTRACT-001` | Planned |
| `AC-F6-1` | F-6 | `TC-RO-001`, `TC-PERSIST-011` | Planned |
| `AC-F6-2` | F-6 | `TC-RO-002`, `TC-SHELL-004` | Planned |
| `AC-F6-3` | F-6 | `TC-SHELL-001`, `TC-SHELL-002` | Planned |
| `AC-F6-4` | F-6 | `TC-RO-003`, `TC-SHELL-002` | Planned |
| `AC-F6-5` | F-6 | `TC-SHELL-003` | Planned |
| `AC-F7-1` | F-7 | `TC-PERSIST-001`, `TC-PERSIST-002`, `TC-PERSIST-003`, `TC-PERSIST-004` | Planned |
| `AC-F7-2` | F-7 | `TC-PERSIST-010` | Planned |
| `AC-F7-3` | F-7 | `TC-PERSIST-002`, `TC-PERSIST-005`, `TC-PERSIST-006`, `TC-PERSIST-008`, `TC-PERSIST-009`, `TC-PERSIST-011` | Planned |
| `AC-F7-4` | F-7 | `TC-PERSIST-003`, `TC-PERSIST-007` | Planned |

**Arithmetic.** 7 + 6 + 5 + 7 + 4 + 5 + 4 = 38 acceptance criteria, reconciled against spec §17 (`F-1` 7, `F-2` 6, `F-3` 5, `F-4` 7, `F-5` 4, `F-6` 5, `F-7` 4). 38 of 38 appear above with at least one named case; 0 are marked TODO; 0 carry a case id that has no §5.2 entry.

The matrix carries **86** AC→case links across **61** cases (38 criteria plus 48 extra observations), because the lifecycle-state matrix, the shared refusals, the write path, the bound split, and the credential path each need more than one observation. Extras by criterion: `AC-F1-1` (+1), `AC-F1-2` (+1), `AC-F1-3` (+1), `AC-F2-1` (+3), `AC-F2-2` (+1), `AC-F2-3` (+3), `AC-F2-4` (+1), `AC-F2-5` (+2), `AC-F2-6` (+4), `AC-F3-1` (+1), `AC-F3-2` (+1), `AC-F3-3` (+2), `AC-F3-4` (+1), `AC-F4-1` (+3), `AC-F4-3` (+1), `AC-F4-4` (+1), `AC-F4-5` (+2), `AC-F4-6` (+1), `AC-F4-7` (+1), `AC-F5-1` (+1), `AC-F5-2` (+2), `AC-F5-4` (+1), `AC-F6-1` (+1), `AC-F6-2` (+1), `AC-F6-3` (+1), `AC-F6-4` (+1), `AC-F7-1` (+3), `AC-F7-3` (+5), `AC-F7-4` (+1). `TC-STATUS-008` and the phase labels on `TC-PERSIST-005`/`TC-PERSIST-006`/`TC-PERSIST-011` add no AC link and move no AC between cases. The two remediation cases add three of the links counted above and no criterion: `TC-LOG-012` is `AC-F2-5`'s third observation (the machine window bounded by bytes only) and `TC-MSG-011` is `AC-F4-7`'s second (the credential resolved by the entrypoint) and `AC-F4-1`'s third (the same answer read end to end).

**Ticket-level acceptance criteria (spec Appendix B).** The ticket's own ACs are satisfied by the same cases, so this matrix is the evidence for both vocabularies:

| Ticket AC | Case(s) | Observation |
|-----------|---------|-------------|
| The four queries answer for a **live** dispatch | `TC-MATRIX-001` (live row per query), `TC-STATUS-001`, `TC-LOG-001`, `TC-ISDEL-001`, `TC-MSG-003` | `status` active + live; `log` a produced tail; `is-delivering` exit 0; `last-message` available with `final=false` |
| The four queries answer for a **finished** dispatch | `TC-MATRIX-001` (terminal row per query), `TC-STATUS-002`, `TC-LOG-001`, `TC-ISDEL-002`, `TC-MSG-001` | `status` terminal with token/outcome; `log` the retained tail; `is-delivering` exit 1; `last-message` available with `final=true` |
| The four queries answer for an **absent** ref | `TC-MATRIX-001` (absent row per query), `TC-STATUS-003`, `TC-LOG-004`, `TC-ISDEL-002`, `TC-MSG-004` | `marker=absent` at exit 0; `no-log` at exit 0; exit 1 not-in-progress; `no-lane` at exit 1 |
| The log is **bounded and reference-scoped** | `TC-LOG-001`, `TC-LOG-007`, `TC-LOG-008`, `TC-LOG-010`, `TC-LOG-012`, `TC-PERSIST-005`, `TC-PERSIST-006`, `TC-PERSIST-007` | Default 50 in 1..500, one truncation fact, 0 foreign lines, per-file cap by segmentation, 2 × cap family bound, and the machine/human split: 220 lines returned whole by `--json`, 200 by the human form |
| `last-message` returns the **PM's final message**, not a classifier sentence | `TC-MSG-001`, `TC-MSG-002`, `TC-MSG-008`, `TC-MSG-011`, `TC-NFR-004` | Transcript-sourced, envelope sentence never used, redact → flatten → bound → mark, and the registered credential resolved by the entrypoint never surviving the cut |
| **No shell script is read or executed** | `TC-SHELL-001`, `TC-SHELL-002`, `TC-SHELL-003`, `TC-SHELL-004`, `TC-RO-002`, `TC-STATUS-007` | Extended invariant with planted control, 0 invocations, 4/4 with the shell absent, 0 shell-artifact reads, planted files unchanged |

Case inventory: **74** cases across twelve groups — `STATUS` 8, `LOG` 12, `ISDEL` 7, `MSG` 11, `GRAMMAR` 5, `PERSIST` 11, `RO` 4, `SHELL` 4, `CONTRACT` 3, `NFR` 4, `MATRIX` 2, `FIXTURE` 3. Every case is linked to an `AC-*`, an `NFR-*`, an `API-`/`DM-` id, or a named TDR-0058 rule: **0 orphan cases** (the 13 cases with no `AC-*` link are `TC-STATUS-008`, `TC-LOG-010`, `TC-LOG-011`, `TC-RO-004`, `TC-CONTRACT-002`, `TC-NFR-001`…`004`, `TC-MATRIX-002`, `TC-FIXTURE-001`…`003`, each linked in §3.2/§3.3).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Contract | Case(s) | Note |
|----------|---------|------|
| `API-1` `dispatch status` | `TC-STATUS-001`…`TC-STATUS-008`, `TC-MATRIX-001` | Full payload per state, exit 0 on every successful read, zero appends, and a typed `state.*` refusal (never `marker=absent`) when the lane store cannot be read |
| `API-2` `dispatch log` | `TC-LOG-001`…`TC-LOG-012`, `TC-MATRIX-001` | Stitched read, torn-tail drop, truncation fact, `no-log` 0 / `unreadable` 1, snapshot semantics, machine-byte-only window |
| `API-3` `dispatch is-delivering` | `TC-ISDEL-001`…`TC-ISDEL-007`, `TC-MATRIX-001` | Both forms, boolean in `data` with no error object, exit 0/1, typed store failure |
| `API-4` `dispatch last-message` | `TC-MSG-001`…`TC-MSG-011`, `TC-MATRIX-001` | Transcript source, finality, closed ladder, composition order, exit 0/1, the entrypoint-resolved credential set |
| `API-5` grammar and refusal contract | `TC-GRAMMAR-001`…`TC-GRAMMAR-005`, `TC-LOG-003`, `TC-MATRIX-002` | Canonical ref, one `query` discriminator, refusal identities decided before any runtime call, uncomposed refusal |
| `API-6` lane-view read contract | `TC-STATUS-006`, `TC-STATUS-007`, `TC-STATUS-008`, `TC-ISDEL-006`, `TC-ISDEL-007`, `TC-CONTRACT-003` | One bounded `dispatch.lane` read; the repository filter is applied **before** the newest-per-ref fold (the key `dispatch.lanes:<ref>` carries no repository component); daemon lanes contribute nothing; persistence-disabled identity; unreadable fold is the store's typed failure, never `absent` or an empty answer |
| `API-7` log artifact read contract | `TC-LOG-001`, `TC-LOG-002`, `TC-LOG-008`, `TC-LOG-009`, `TC-LOG-010`, `TC-LOG-011` | Only the ref's directory listed, name-order stitch, torn tail dropped, short-window truncation, no deletion |
| `API-8` per-stream stdout observation seam | `TC-PERSIST-001`…`TC-PERSIST-010` | Binding point per stream, one append per value, segmentation, retention, non-gating fault, one-shot absence |
| `API-9` transcript read seam | `TC-MSG-002`, `TC-MSG-005`, `TC-MSG-006`, `TC-MSG-007`, `TC-MSG-009`, `TC-MSG-010`, `TC-MSG-011` | Capability gating, no session operation, closed absences, no operation/capability/gap addition, raw return composed only by the query |
| `API-10` owner-liveness probe seam | `TC-STATUS-004`, `TC-STATUS-005` | Tri-state, 5 000 ms tolerance, reused-pid rejection, advisory only |
| `API-11` query exit projection | `TC-MATRIX-001`, `TC-ISDEL-002`, `TC-ISDEL-006`, `TC-MSG-006`, `TC-STATUS-008`, `TC-LOG-006`, `TC-MSG-004`, `TC-CONTRACT-001` | `success`→0 / `user-validation`→1 / `platform-provider`→2 through the delivered projection: the closed negative answers and a permission failure are exit 1, while `state.store.torn` is exit 2; no error row is added and no case states a numeric literal |
| `API-12` no-shell and no-script contract (extended) | `TC-SHELL-001`, `TC-SHELL-002`, `TC-SHELL-004` | Extended declared surface, planted reference fails by name, zero shell invocation |
| `DM-1` lane view | `TC-STATUS-001`…`TC-STATUS-007`, `TC-CONTRACT-003` | Derived fold only: newest per ref, `marker` from state, no new field, no rewrite |
| `DM-2` per-ref artifact family | `TC-PERSIST-001`…`TC-PERSIST-011`, `TC-LOG-001` | Outside the record set, one file per stream, `0600`, one writer rule, one tear rule, 2 × cap bound |
| `DM-3` transcript read seam | `TC-MSG-001`, `TC-MSG-005`, `TC-MSG-009`, `TC-MSG-010` | Under the existing capability; Claude Code declares the gap; no operation added |
| `DM-4` owner-liveness probe facts | `TC-STATUS-004`, `TC-STATUS-005` | Closed verdicts, tolerance, advisory only, never persisted |
| `DM-5` query payloads | `TC-GRAMMAR-001`, `TC-STATUS-001`…`003`, `TC-LOG-004`, `TC-ISDEL-003`, `TC-MSG-001` | Four declared key sets, one discriminator each, no `result` token |
| `DM-6` declared bounds and constants | `TC-NFR-002`, `TC-LOG-007`, `TC-LOG-012`, `TC-ISDEL-004`, `TC-MSG-008`, `TC-MSG-011` | Each bound has one home; retained count and family bound are TDR-0058 policy; the machine window's `bound` is the retained line count, not a line bound |
| `DM-7` exit and identity posture | `TC-ISDEL-006`, `TC-MSG-006`, `TC-STATUS-008`, `TC-CONTRACT-001`, `TC-NFR-002` | `unreadable` is a data fact at exit 1, never a new identity; a lane-store failure keeps `state.*` on every query that reads it, at that row's projection |
| Structural obligations (TDR-0058 plan-pinned, spec §25.3) | `TC-FIXTURE-001`, `TC-FIXTURE-002`, `TC-FIXTURE-003` | The six plan-pinned obligations each carry their named test (`artifact-naming`, `segment-switch`, `torn-line-reader`, `two-segment-tail`, `segment-ordering`, `sink-fault-observational`); the proof boundary is a permanent constant; the new suites and fixtures are isolated |
| `EVT-*` | — | No event, message, or telemetry record is added (spec §8.2); nothing to test |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Case(s) | Observation |
|-----|---------|-------------|
| `NFR-1` bounded reads | `TC-STATUS-007`, `TC-RO-004`, `TC-MSG-007`, `TC-LOG-010`, `TC-RO-003` | Exactly 1 lane read (≤ 5 000 records), ≤ 1 two-file join or 1 transcript read, 0 network, 0 session operations, 0 process starts, 0 deletions |
| `NFR-2` read-only posture | `TC-RO-001`, `TC-RO-002`, `TC-STATUS-004`, `TC-GRAMMAR-005` | 0 appends, 0 fences, 0 lane rewrites, 0 identity-marker writes, 0 shell-artifact reads or writes, 0 deletions |
| `NFR-3` log bounds | `TC-LOG-007`, `TC-LOG-008`, `TC-LOG-012`, `TC-PERSIST-005`, `TC-PERSIST-006`, `TC-PERSIST-007`, `TC-NFR-002` | Per-file 1 048 576 by segmentation, continuation rather than drop, newest 2 retained, family ≤ 2 097 152, default 50 in 1..500, 65 536 machine, 200 lines / 32 768 human, one truncation fact per binding bound, and no human line bound applied to the machine answer |
| `NFR-4` reference scoping | `TC-LOG-001`, `TC-LOG-010`, `TC-STATUS-006`, `TC-ISDEL-007` | 0 listings outside the addressed directory, 0 foreign lines, 0 foreign or daemon lanes |
| `NFR-5` contract invariance | `TC-CONTRACT-001`, `TC-CONTRACT-002`, `TC-GRAMMAR-005`, `TC-NFR-002`, `TC-STATUS-008` | 0 new tokens, projections, exits, error rows, domain kinds, attempt/lane fields, configuration keys; `state-unverified` stays 2; a lane-store failure reuses the existing `state.*` row and adds no `absent`-shaped identity |
| `NFR-6` no shell dependency | `TC-SHELL-001`, `TC-SHELL-002`, `TC-SHELL-003`, `TC-SHELL-004` | 0 invocations, 0 script-path literals, 0 shell-owned path reads, 4/4 queries answer with the shell absent |
| `NFR-7` determinism | `TC-NFR-001`, `TC-MATRIX-001`, `TC-FIXTURE-003` | Two consecutive runs identical for all 12 combinations; 0 live network, 0 child starts, 0 live process-table reads; every fixture root from the approved base |
| `NFR-8` message fidelity and bounds | `TC-MSG-001`, `TC-MSG-002`, `TC-MSG-008`, `TC-MSG-011`, `TC-NFR-004` | Transcript-sourced, ≤ 512 characters single line, redact before bound, `truncated` from post-redaction length, the registered set resolved by the entrypoint rather than injected as a fixture constant, no general scrubbing claim |
| `NFR-9` staleness honesty | `TC-STATUS-004`, `TC-STATUS-005`, `TC-ISDEL-005` | Stale only for active ∧ dead; unknown never stale; outside tolerance is dead; 0 unrelated pids reported live |
| `NFR-10` query latency budget | `TC-NFR-003` | p95 ≤ 1 000 ms over the 5 000-record reference store with the declared read counts |
| `NFR-11` privacy of persisted payloads | `TC-PERSIST-011`, `TC-NFR-004` | Only harness stdout at rest (bounded, `0600`, unscrubbed by design) and the never-written final message; 0 prompts, diffs, credentials, tool arguments, or provider payloads added |

**Exit-literal rule.** Every exit literal stated in §5.2 is the delivered projection of the payload's projection class, computed from `packages/cli/src/projection.ts` (`success` → 0, `user-validation` → 1, `platform-provider` → 2). A successful or closed-negative query answer is `success` or `user-validation` (`API-11`); a query whose lane store cannot be read is `platform-provider` when the injected code's row says so (`state.store.torn` → 2) and `user-validation` when it does not (`state.permission.denied` → 1), which is why §5.2 names the injected code instead of naming the kind. No case may state an exit literal the projection does not produce, and `TC-CONTRACT-001` pins the matrix together with `scripts/checks/exit-code-literals.ts` staying green, so a case that contradicts the matrix fails the invariance check instead of silently editing an expectation.

**Declared exit-identity distinctions (asserted, not assumed).** `--tail` with a missing value is consumed by the shared parser (`requiresValue`), which answers `fallback.invocation`; `--tail abc` (a present but invalid value) reaches the handler and is `input.value.rejected`. `dispatch status GH-354 extra` is a handler refusal (`input.value.rejected`), while a fourth positional exceeds the definition's `positionals.max` and is a parser refusal (`fallback.invocation`). `TC-GRAMMAR-002`/`TC-GRAMMAR-003` assert each shape with its real identity and record the distinction; §8.3 carries the AC-F5-2 reading this depends on.

## 4. Test Types and Layers

All cases are automated, offline, and deterministic. Per `.ai/rules/testing-strategy.md`:

| Layer | Runner | Location | Used for |
|-------|--------|----------|----------|
| Conformance (integration) | `bun test` (`bun:test`) | `tests/conformance/dispatch/**` | The operator battery: real composed program, real command definition, real projection, real protocol, real state store, injected I/O edges |
| Behaviour | `bun test` | `tests/behaviour/dispatch-operator-*.test.ts`, plus `dispatch-{additive-stability,privacy}.test.ts` | Read-side arithmetic (stitch/split/tail/bounds), message composition order, the opencode transcript reader over a built store, latency, privacy |
| Structure | `bun test` | `tests/structure/dispatch-{operator-composition,help-inventory,attempts-composition}.test.ts` | Composition wiring and the uncomposed refusal; help-entry inventory; token home |
| Repository invariant | `bun run scripts/checks/*.ts` + `bun test tests/checks/**` | `scripts/checks/`, `tests/checks/` | The extended no-shell invariant, the exit-literal guard, the pinned closed-contract baseline, the seam-identity detector, the permanent proof boundary, and test isolation |
| Static/diff | `git diff --check` | — | Whitespace/conflict-marker guard before every commit |

No end-to-end live layer participates: `tests/conformance/live/**` and the scheduled live workflow are untouched (`NFR-7`). Unit-level assertions are folded into the behaviour cases where they are the same property (e.g. the tail-selection and byte-budget arithmetic inside `TC-LOG-007`/`TC-LOG-008`), so no case exists only to restate a constant.

## 5. Test Scenarios

Three drivers and one seam driver are used, and every one of them is production code:

- **D1 — composed production program.** `createProductionComposer({...injected facts})(brand)` → `runCli([...])`, or — when the run must own a declared credential reference — the production `runEntrypoint(argv, { composeProgram, environment, credentialReferences, … })`. This is the shipped composition; the injected facts are the declared injection points (`harnessSpawnRunner`, `harnessSpawnStarter`, `gitChildRunner`, `githubTransport`, `credentials`, `repositoryFacts`, `processId`, `environment`, `cwd`, `homeDirectory`, `delay`) plus the four operator facts this change requires — the owner-liveness probe, the transcript read, the artifact-family root (with a recording filesystem edge for the listing/read assertions), and the clock — together with the invocation's registered-credential set, which the entrypoint resolves once from the declared references and the injected `environment` and passes into the composed program before the message bound (§6.2, fifth declared composition fact). Pattern: `tests/fixtures/dispatch/parity/harness.ts` extended by `tests/fixtures/dispatch/operator/harness.ts`.
- **D2 — the command definition over an injected runtime.** `createDispatchCommandDefinition(runtime)` driven through `runCli`, used where the point is grammar, refusal identity, the uncomposed refusal, or the projection — never to re-express a read decision.
- **D3 — the read-side production functions directly.** The lane-view fold, the artifact tail selection, the stitching/splitting reader, the delivering fold, and the message composition, reached as the real production exports over seeded files and records. D3 exists for byte and line arithmetic that needs exact inputs (a file of exactly the cap, a continuation, a torn tail); it never re-implements the read.
- **S1 — the real opencode adapter over the scripted streaming starter.** `createOpencodeSession({ starter, ... })` with a scripted `HarnessSpawnStream`, used for the write path (per-stream files, one append per value, segmentation, retention, the binding order) and for the transcript reader over a built store.

`TC-MATRIX-001`, `TC-STATUS-001`…`008`, `TC-LOG-001`…`012`, `TC-ISDEL-001`…`007`, `TC-MSG-001`…`009`, `TC-MSG-011`, `TC-GRAMMAR-001`…`005`, `TC-RO-001`…`004`, `TC-SHELL-002`…`004`, `TC-CONTRACT-002`/`003`, and `TC-NFR-001` run on D1 unless the case says otherwise (`TC-MSG-011` runs D1 through `runEntrypoint`, because the credential it proves must be resolved by the production entrypoint rather than injected). Every `TC-PERSIST-*` case runs on S1 (the real adapter and the real sink) with D1 supplying the composed program for the dispatch it observes, and `TC-MSG-010` runs on S1 over the built store plus one D1 invocation with the real reader mounted.

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC / NFR | New or Extended |
|-------|-------|------|-------|----------|----------|-----------------|
| `TC-MATRIX-001` | All twelve lifecycle-state combinations answer by data and exit, in both output modes | Integration | Conformance | Critical | `AC-F1-1`…`AC-F1-3`, `AC-F2-1`, `AC-F2-3`, `AC-F2-4`, `AC-F3-1`, `AC-F3-2`, `AC-F3-4`, `AC-F4-1`, `AC-F4-3`, `AC-F4-4`, `AC-F5-1`, `API-11` | New |
| `TC-MATRIX-002` | The answer matrix is one declared registry and every operator suite drives its row | Structure | Conformance | Critical | `API-5`, `DM-5` | New |
| `TC-STATUS-001` | A live lane answers delivering, marker, probe, pid, session and the lane facts | Integration | Conformance | Critical | `AC-F1-1`, `API-1`, `DM-1`, `DM-5` | New |
| `TC-STATUS-002` | A terminal lane answers not-delivering with lastToken, lastOutcome and recordedAt; stale stays false | Integration | Conformance | High | `AC-F1-2`, `API-1`, `DM-1` | New |
| `TC-STATUS-003` | An absent ref answers marker=absent with a null lane at exit 0, in both forms | Integration | Conformance | Critical | `AC-F1-3`, `API-1`, `DM-1` | New |
| `TC-STATUS-004` | A confirmed-gone owner is stale, and the read repairs nothing | Integration | Conformance | Critical | `AC-F1-4`, `NFR-2`, `API-10`, `DEC-2` | New |
| `TC-STATUS-005` | The probe is tri-state; unknown never asserts staleness and a reused process id is not live | Integration | Conformance | Critical | `AC-F1-5`, `NFR-9`, `API-10`, `DM-4` | New |
| `TC-STATUS-006` | A newer foreign record never wins: the repository filter precedes the fold, and no daemon lane is reported | Integration | Conformance | Critical | `AC-F1-6`, `NFR-4`, `API-6`, `NG-1` | New |
| `TC-STATUS-007` | Every status answer performs one bounded lane read and no write | Integration | Conformance | Critical | `AC-F1-7`, `NFR-1`, `NFR-2`, `API-6` | New |
| `TC-STATUS-008` | An unreadable lane store keeps its typed `state.*` identity on `status`, never a fabricated `absent` | Integration | Conformance | Critical | `API-6`, `API-11`, `DM-7`, `NFR-5` | New |
| `TC-LOG-001` | Default tail 50 over the newest file then the preceding one, oldest-to-newest, reference-scoped | Integration | Conformance | Critical | `AC-F2-1`, `API-2`, `API-7`, `NFR-4` | New |
| `TC-LOG-002` | A value continued across a segment boundary is reconstructed (stitch before split) | Integration | Conformance | Critical | `AC-F2-1`, `AC-F2-6`, `API-7`, `TDR-0058 two-segment-tail` | New |
| `TC-LOG-003` | Every invalid `--tail` and every undeclared flag is refused before any artifact read | Integration | Conformance | Critical | `AC-F2-2`, `AC-F5-2`, `API-5` | New |
| `TC-LOG-004` | No artifact directory is `no-log` at exit 0, never a fabricated tail | Integration | Conformance | Critical | `AC-F2-3`, `API-2`, `API-7` | New |
| `TC-LOG-005` | A retained file with no complete line is an available, empty answer | Integration | Conformance | High | `AC-F2-3`, `API-7` | New |
| `TC-LOG-006` | An unreadable file is `unreadable` at exit 1 with no content | Integration | Conformance | Critical | `AC-F2-4`, `API-2`, `API-11` | New |
| `TC-LOG-007` | Machine and human bounds bind with exactly one truncation fact naming its scope | Integration | Conformance | Critical | `AC-F2-5`, `NFR-3`, `DM-6` | New |
| `TC-LOG-008` | A short retained window answers with exactly one tail-scope truncation fact | Integration | Conformance | Critical | `AC-F2-5`, `AC-F2-6`, `NFR-3`, `TDR-0058 two-segment-tail` | New |
| `TC-LOG-009` | A torn tail is dropped, never returned as content | Integration | Conformance | Critical | `AC-F2-1`, `AC-F2-6`, `API-7`, `TDR-0058 torn-line-reader` | New |
| `TC-LOG-010` | Only the addressed ref's directory is listed and only its files are read | Integration | Conformance | Critical | `API-7`, `NFR-4`, `NFR-1` | New |
| `TC-LOG-011` | A read is a snapshot of what was durable, with no lock or flush | Integration | Conformance | Important | `API-2`, `API-7`, `RSK-22` | New |
| `TC-LOG-012` | The machine window is byte-bounded only: a 220-line retained window is returned whole with one `tail` fact naming it, while the human form keeps its 200-line bound | Integration | Conformance | Critical | `AC-F2-5`, `API-2`, `DM-6`, `NFR-3` | New |
| `TC-ISDEL-001` | A live lane answers exit 0 with delivering=true and the ref, and no refs list | Integration | Conformance | Critical | `AC-F3-1`, `API-3`, `DM-5` | New |
| `TC-ISDEL-002` | A terminal or absent lane answers exit 1 with the boolean in data and no error object | Integration | Conformance | Critical | `AC-F3-2`, `API-3`, `API-11` | New |
| `TC-ISDEL-003` | The ref-less form answers over the repository, and an empty repository is exit 1 | Integration | Conformance | Critical | `AC-F3-3`, `API-3` | New |
| `TC-ISDEL-004` | Twenty-five delivering refs list twenty with one truncation fact | Integration | Conformance | High | `AC-F3-3`, `DM-6` | New |
| `TC-ISDEL-005` | A stale lane never makes the ref or the repository look busy | Integration | Conformance | Critical | `AC-F3-4`, `NFR-9`, `DEC-2` | New |
| `TC-ISDEL-006` | An unreadable lane store keeps its typed `state.*` identity, never a fabricated false | Integration | Conformance | Critical | `AC-F3-5`, `API-6`, `DM-7` | New |
| `TC-ISDEL-007` | Only the current repository's lanes are counted or listed, and a newer foreign record never decides a local answer | Integration | Conformance | High | `AC-F3-3`, `NFR-4`, `API-6` | New |
| `TC-MSG-001` | A terminal lane answers the transcript's final assistant message with `final=true` | Integration | Conformance | Critical | `AC-F4-1`, `API-4`, `API-9`, `DM-5` | New |
| `TC-MSG-002` | The answer is the assistant text, never the envelope's synthesized lastMessage | Integration | Conformance | Critical | `AC-F4-2`, `NFR-8`, `API-9` | New |
| `TC-MSG-003` | An active lane answers its latest assistant text with `final=false` | Integration | Conformance | Critical | `AC-F4-3`, `API-4`, `DM-5` | New |
| `TC-MSG-004` | No lane answers `no-lane` at exit 1 with a null message | Integration | Conformance | Critical | `AC-F4-4`, `API-4`, `API-11` | New |
| `TC-MSG-005` | The closed ladder answers capability-gap, session-unknown, no-message and unreadable | Integration | Conformance | Critical | `AC-F4-5`, `DM-3`, `DM-7` | New |
| `TC-MSG-006` | An unreadable lane store refuses its typed identity instead of a closed reason | Integration | Conformance | Critical | `AC-F4-5`, `API-6`, `DM-7` | New |
| `TC-MSG-007` | A message read performs zero session operations and starts zero processes | Integration | Conformance | Critical | `AC-F4-6`, `NFR-1`, `API-9` | New |
| `TC-MSG-008` | Composition is redact → flatten → bound → mark, so a straddling credential never survives | Integration | Behaviour | Critical | `AC-F4-7`, `NFR-8`, `DM-6`, `RISK-18` | New |
| `TC-MSG-009` | The ladder is ordered: an earlier rung wins when two conditions hold | Integration | Conformance | Critical | `AC-F4-5`, `DM-3`, `DEC-4` | New |
| `TC-MSG-010` | The opencode reader returns the final assistant message from a built store, read-only | Integration | Behaviour | Critical | `AC-F4-1`, `AC-F4-6`, `API-9`, `DM-3` | New + Extended (`tests/fixtures/harness/opencode-store/**`) |
| `TC-MSG-011` | The entrypoint-resolved credential is redacted before the message cut, in both output modes | Integration | Conformance | Critical | `AC-F4-7`, `AC-F4-1`, `API-4`, `API-9`, `NFR-8` | New |
| `TC-GRAMMAR-001` | Each form carries exactly one `query` discriminator and its declared key set in the standard envelope | Integration | Conformance | Critical | `AC-F5-1`, `API-5`, `DM-5` | New |
| `TC-GRAMMAR-002` | A non-canonical or missing ref and an extra positional are refused before any runtime call | Integration | Conformance | Critical | `AC-F5-2`, `API-5` | New |
| `TC-GRAMMAR-003` | An invalid `--tail` value and an undeclared flag take their distinct refusal identities | Integration | Conformance | Critical | `AC-F5-2`, `AC-F2-2`, `API-5` | New |
| `TC-GRAMMAR-004` | An uncomposed query surface refuses `input.value.rejected`, never crashes | Integration | Structure | Critical | `AC-F5-3`, `API-5`, `DEC-7` | New |
| `TC-GRAMMAR-005` | No query emits a delivery result token or appends a record, and later reads are unchanged | Integration | Conformance | Critical | `AC-F5-4`, `NFR-2`, `NFR-5` | New |
| `TC-PERSIST-001` | Each stream of a streaming adapter gets its own 0600 file, created before its first value | Integration | Conformance | Critical | `AC-F7-1`, `API-8`, `DM-2` | New |
| `TC-PERSIST-002` | Every yielded value is written with exactly one LF, decoded or not, final remnant included | Integration | Conformance | Critical | `AC-F7-1`, `AC-F7-3`, `DM-2` | New |
| `TC-PERSIST-003` | File names sort in creation order across a restart and two concurrent streams | Integration | Conformance | Critical | `AC-F7-1`, `AC-F7-4`, `TDR-0058 artifact-naming` | New |
| `TC-PERSIST-004` | Two refs never share a directory or file, and a one-shot adapter creates none | Integration | Conformance | Critical | `AC-F7-1`, `API-8`, `DM-2` | New |
| `TC-PERSIST-005` | The per-file cap is enforced by segmentation with nothing dropped at a boundary | Integration | Conformance | Critical | `AC-F2-6`, `AC-F7-3`, `NFR-3`, `TDR-0058 segment-switch` | New (phase-3-owned; write half asserted at the phase-3 boundary, read-back half executed at the phase-4 boundary) |
| `TC-PERSIST-006` | A value longer than the cap is split and reconstructed byte-identically | Integration | Conformance | Critical | `AC-F2-6`, `AC-F7-3`, `TDR-0058 segment-switch` | New (phase-3-owned; write half asserted at the phase-3 boundary, read-back half executed at the phase-4 boundary) |
| `TC-PERSIST-007` | Retention keeps the newest two files and removes the oldest only after the new file exists | Integration | Conformance | Critical | `AC-F7-4`, `AC-F2-6`, `NFR-3` | New |
| `TC-PERSIST-008` | A written file is never modified: one append per value, mode and bytes intact | Integration | Conformance | Critical | `AC-F7-3`, `DM-2` | New |
| `TC-PERSIST-009` | A killed writer leaves at most one torn tail and the reader drops only that tail | Integration | Conformance | Critical | `AC-F7-3`, `AC-F2-1`, `TDR-0058 torn-line-reader` | New |
| `TC-PERSIST-010` | A sink fault is observational: token, exit, records and evidence are identical | Integration | Conformance | Critical | `AC-F7-2`, `API-8`, `TDR-0058 sink-fault-observational` | New |
| `TC-PERSIST-011` | The artifact holds only the declared transformation, and no log content reaches any record | Integration | Conformance | Critical | `AC-F7-3`, `AC-F6-1`, `NFR-11` | New (phase-4-owned — the log phase; it needs a `dispatch log` answer, which does not exist at the phase-3 boundary, so phase 3 no longer runs it) |
| `TC-RO-001` | Store bytes, lane records, the identity marker and the artifact file set are unchanged | Integration | Conformance | Critical | `AC-F6-1`, `NFR-2` | New |
| `TC-RO-002` | Planted shell artifacts change no answer and stay byte- and mtime-identical | Integration | Conformance | Critical | `AC-F6-2`, `NFR-2`, `NFR-6` | New |
| `TC-RO-003` | Zero child processes and zero network reads across every query | Integration | Conformance | Critical | `AC-F6-4`, `NFR-1`, `NFR-6` | New |
| `TC-RO-004` | Each query performs exactly the declared read count and no second read | Integration | Conformance | Critical | `NFR-1`, `API-6`, `API-7` | New |
| `TC-SHELL-001` | The extended invariant passes over the declared surface and a planted reference fails by name | Invariant | Checks | Critical | `AC-F6-3`, `API-12`, `NFR-6` | Extended (`scripts/checks/no-shell-dispatch.ts`, `tests/checks/no-shell-dispatch.test.ts`) |
| `TC-SHELL-002` | The whole query battery records zero shell invocations and zero script paths | Integration | Conformance | Critical | `AC-F6-3`, `AC-F6-4`, `API-12` | New |
| `TC-SHELL-003` | A checkout with no shell entry points answers all four queries | Integration | Conformance | Critical | `AC-F6-5`, `NFR-6` | New |
| `TC-SHELL-004` | Planted shell content can never steer a typed answer | Integration | Conformance | Critical | `AC-F6-2`, `AC-F6-3`, `API-12` | New |
| `TC-CONTRACT-001` | The closed contract surface is unchanged against a pinned baseline | Invariant | Checks | Critical | `AC-F5-4`, `NFR-5`, `DM-7` | New (`tests/checks/operator-contract-invariance.test.ts`) |
| `TC-CONTRACT-002` | The delivery path is unchanged and the family's help entries move from five to nine | Integration | Conformance | Critical | `NFR-5`, `RSK-9`, spec §25.1 | Extended (`dispatch-e2e`, parity battery, `dispatch-help-inventory.test.ts`, `dispatch-attempts-composition.test.ts`) |
| `TC-CONTRACT-003` | Pre-change records read unchanged and a pre-change ref answers honestly | Integration | Behaviour | High | `AC-F2-3`, `NFR-5`, spec §8.5/§20 | Extended (`dispatch-additive-stability.test.ts`) |
| `TC-NFR-001` | Two consecutive battery runs are identical with zero live network and zero live processes | Integration | Conformance | Critical | `NFR-7`, `NFR-1` | New |
| `TC-NFR-002` | Every declared bound is a constant with exactly one home and no configuration key | Invariant | Checks | High | `NFR-3`, `NFR-5`, `DM-6`, TDR-0058 `C-1` | New |
| `TC-NFR-003` | Each query answers within 1 000 ms over the 5 000-record reference store | Performance | Behaviour | Medium | `NFR-10`, `NFR-1` | New |
| `TC-NFR-004` | The only persisted and emitted content is the harness stdout and the bounded final message | Integration | Behaviour | Critical | `NFR-11`, `NFR-8`, `AC-F4-7` | Extended (`dispatch-privacy.test.ts`) |
| `TC-FIXTURE-001` | Every case drives a real production seam and a reimplementation is rejected by name | Structure | Checks | Critical | `AC-F5-4`, `NFR-5`, TDR-0058 `DC-3` | New (`tests/checks/operator-seam-identity.test.ts`) |
| `TC-FIXTURE-002` | The proved / not-proved boundary is a permanent constant and is self-consistent | Structure | Checks | High | spec §25.3 Appendix C | New (`tests/checks/operator-proof-boundary.test.ts`) |
| `TC-FIXTURE-003` | Every new suite and fixture is isolated to the approved temp base | Structure | Checks | High | repo convention (`TC-ATTEMPT-036`), `NFR-7` | New (`tests/checks/dispatch-operator-test-isolation.test.ts`) |

Numbering note: every id above is new for this change, so no numbering collision with the delivered `TC-ATTEMPT-*`, `TC-LANE-*`, `TC-ADMIT-*`, `TC-PARITY-*`, or `TC-HELP-001` families is possible. `TC-LOG-*` is not used by any delivered suite (the delivered log-adjacent ids are `TC-ATTEMPT-*`); a collision found during delivery is resolved by appending at the next free sequence number, never by reusing an id.

### 5.2 Scenario Details

#### TC-MATRIX-001 - All twelve lifecycle-state combinations answer by data and exit, in both output modes

**Scenario Type**: Happy Path / Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-2, F-3, F-4, F-5, AC-F1-1, AC-F1-2, AC-F1-3, AC-F2-1, AC-F2-3, AC-F2-4, AC-F3-1, AC-F3-2, AC-F3-4, AC-F4-1, AC-F4-3, AC-F4-4, AC-F5-1, API-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-matrix.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-cmd` — the real command definition, the real projection, and the real composed runtime

**Preconditions**:
- One composed production program (D1) per row over a temp checkout and its derived state root, with a fixed clock, `processId: 4242`, and the injected probe and transcript seam.
- Three seeded lane states for the same ref: `active` with a matching identical owner and probe `live`; `terminal` with `lastToken`/`lastOutcome` and a resolvable transcript; and no lane at all, with no artifact directory.
- Every row is read from `OPERATOR_MATRIX` in `tests/fixtures/dispatch/operator/matrix.ts`; the test body enumerates nothing itself.

**Steps**:
1. For each of the twelve rows (four queries × three states), run the human form and then the `--json` form.
2. Assert the exit, the discriminating payload facts, and the envelope shape; assert the human rendering carries every declared key.
3. Assert the row's declared projection class equals the observed exit through `packages/cli/src/projection.ts`.

**Expected Outcome**:
- 12/12 combinations answered; 0 combinations fail, 0 require a shell script.
- `status`: exit 0 in all three states; `marker` is `active`/`terminal`/`absent`; `probe` is `live`/`live`-or-`dead`/`not-applicable`; `lane` is an object for the first two and `null` for the third.
- `log`: exit 0 for the produced tail and for `no-log`; the retained file is absent for the absent state, so the answer is `available=false`, `reason=no-log`, `lines=[]`.
- `is-delivering <ref>`: exit 0 for the live state, 1 for terminal and absent, `delivering` carrying the boolean in `data` with no `error` object.
- `last-message`: exit 0 for the live and terminal states (`final` false then true), exit 1 with `reason=no-lane` for the absent state.
- Every `--json` answer is the standard envelope whose `data` carries exactly one `query` discriminator; no answer carries a delivery `result` token.
- The human form of every row carries its declared key set (`log` renders the raw tail plus at most one `truncation=` line).

**Notes**: This is the spec Appendix C matrix as one executable row set (`DOD-4`). A row that only passes in `--json` fails: the ticket AC and AC-F1-3 both demand both forms.

#### TC-MATRIX-002 - The answer matrix is one declared registry and every operator suite drives its row

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, API-5, DM-5
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-matrix.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline

**Preconditions**:
- `OPERATOR_MATRIX` exported from `tests/fixtures/dispatch/operator/matrix.ts` with one entry per row: `{ id, group, query, state, mode, precondition, expectedData, expectedExit }`.

**Steps**:
1. Assert the registry contains 12 lifecycle rows (four queries × three states) plus both `is-delivering` forms, the five message-ladder rows, and both output modes are representable per row.
2. Assert every entry id is unique and every entry's `expectedExit` is a projection-derived digit, not a literal.
3. Drive a planted registry copy whose expected payload is not produced by the implementation and assert it fails by row id.
4. Assert each operator suite imports its rows from the registry rather than declaring expectations locally (source scan for a local matrix shape).

**Expected Outcome**:
- The registry declares 12 lifecycle rows, 2 delivering forms, and 5 ladder rows; ids unique; 0 literal exits.
- The planted drift fails naming the offending row id and field.
- No operator suite re-declares a payload expectation outside the registry; the source scan finds 0 local copies.

**Notes**: This is the anti-drift mechanism the delivered parity battery uses (`tests/fixtures/dispatch/parity/cases.ts`); without it the twelve combinations can silently shrink.

#### TC-STATUS-001 - A live lane answers delivering, marker, probe, pid, session and the lane facts

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, API-1, DM-1, DM-5, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-laneview` + `S-probe` — the real lane read and fold, with the injected probe verdict

**Preconditions**:
- D1 over a temp checkout whose origin resolves to `github.com/owner/repo`.
- One `dispatch.lane` record seeded through the delivered `appendDispatchLane`: `state: active`, `owner: { processId: 4242, startedAt: "2026-11-19T00:00:00.000Z" }`, `sessionId: ses-live`, `harnessKind: opencode`, `iterationOrdinal: 2`, `restartsConsumed: 1`.
- Probe verdict `live` for exactly that `{processId, startedAt}`.

**Steps**:
1. Run `dispatch status GH-354` and then `dispatch status GH-354 --json`.
2. Assert the payload keys, each value, and the exit.
3. Assert the store counters recorded by the read.

**Expected Outcome**:
- `delivering=true`, `stale=false`, `marker="active"`, `probe="live"`, `pid=4242`, `sessionId="ses-live"`.
- Lane facts present and exact: `attemptId`, `harness="opencode"`, `iterationOrdinal=2`, `restartsConsumed=1`, `ownerStartedAt`, `recordedAt`; `lastToken`/`lastOutcome` absent.
- `repository="github.com/owner/repo"`; `ref="GH-354"`; exit 0 with no `error` object.
- `readRecords` count is 1 and the same for the human and the `--json` invocation.

#### TC-STATUS-002 - A terminal lane answers not-delivering with lastToken, lastOutcome and recordedAt; stale stays false

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-2, API-1, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-laneview` — the real lane read and fold

**Preconditions**:
- One `terminal` lane record with `lastToken: "pr-open"`, `lastOutcome: "completed"`, and a `recordedAt` from the fixed clock.
- Two probe variants for the same lane: `live` and `dead`.

**Steps**:
1. Run `dispatch status GH-354` once per probe verdict, human and `--json`.
2. Assert the payload in both variants.

**Expected Outcome**:
- `delivering=false`, `marker="terminal"`, `stale=false` in both variants, with `probe` echoing the observation (`live` or `dead`).
- `lastToken="pr-open"`, `lastOutcome="completed"`, `recordedAt` equal to the fixed instant; `pid`/`sessionId` echo the record.
- Exit 0 in both variants: a terminal lane is never stale, whatever the probe says.
- Exactly one lane read per invocation; 0 appends; 0 fences.

#### TC-STATUS-003 - An absent ref answers marker=absent with a null lane at exit 0, in both forms

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-3, API-1, DM-1, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-laneview` — the real repository-scoped fold over a store with unrelated records

**Preconditions**:
- A store holding lane records for other refs and for another repository, but none for `(github.com/owner/repo, GH-354)`.
- An attempt record for `GH-354` seeded through the delivered attempt append (so a fabricated status could be checked against it).

**Steps**:
1. Run `dispatch status GH-354` and `dispatch status GH-354 --json`.
2. Assert the payload, the exit, and that nothing was derived from the attempt record.

**Expected Outcome**:
- `marker="absent"`, `delivering=false`, `stale=false`, `probe="not-applicable"`, `pid=null`, `sessionId=null`, `lane=null`.
- Exit 0 with no `error` object, in both forms.
- 0 `dispatch.lane` records exist for the ref afterwards (nothing fabricated, nothing backfilled from the attempt record).
- Exactly one lane read; the answer is identical with and without the unrelated seeded records.

#### TC-STATUS-004 - A confirmed-gone owner is stale, and the read repairs nothing

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-6, AC-F1-4, NFR-2, API-10, DEC-2, TDR-0049
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-probe` + `S-laneview` — the injected `dead` verdict over the real record, then the real resume resolver

**Preconditions**:
- One `active` lane with a recorded owner; the probe returns `dead`.
- The ledger is snapshotted byte-for-byte before the query (the delivered `snapshotStore` reader).

**Steps**:
1. Run `dispatch status GH-354` (human and `--json`).
2. Re-read the ledger and compare it with the snapshot; read the lane records in append order.
3. Run `dispatch GH-354 --resume-prompt "…"` and assert the resume still resolves the recorded session.

**Expected Outcome**:
- `delivering=false`, `stale=true`, `marker="active"`, `probe="dead"`; exit 0.
- The ledger bytes, the lane record count, and every record's fields are identical to the snapshot: 0 appends, 0 rewrites, 0 clears, 0 repair.
- The follow-up resume performs a `resume` call with the recorded session id and 0 `spawn` calls: a stale lane is still the resumable artifact.
- 0 identity-marker writes and 0 fences across the query.

**Notes**: The shell's PID-file self-healing is deliberately not ported; the mutation `M4` deletes the repair guard and must make this case fail on the byte comparison.

#### TC-STATUS-005 - The probe is tri-state; unknown never asserts staleness and a reused process id is not live

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-5, NFR-9, API-10, DM-4, RSK-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-probe` — the real probe contract over an injected process-table model

**Preconditions**:
- One `active` lane whose recorded `startedAt` is the fixed instant and `processId` is 4242.
- Five process-table models for the same pid: (a) unreadable table; (b) a live process with the recorded start instant; (c) a live process whose observed start instant differs by 4 999 ms; (d) a live process whose observed instant differs by 5 001 ms; (e) a live process reusing pid 4242 with an unrelated start instant plus one matching process that has exited.

**Steps**:
1. Run `dispatch status GH-354` against each model.
2. Assert `probe`, `stale`, `delivering`, and the boundary selection in (c) and (d).

**Expected Outcome**:
- (a) `probe="unknown"`, `stale=false`, `delivering=true` — the durable active state stands and an unreadable table never asserts staleness.
- (b) `probe="live"`, `stale=false`, `delivering=true`.
- (c) 4 999 ms is inside the declared 5 000 ms tolerance: `probe="live"`.
- (d) 5 001 ms is outside it: `probe="dead"`, `stale=true`, `delivering=false` — a reused process id is never reported live.
- (e) `probe="dead"` and `stale=true` for the exit and non-matching start; 0 unrelated pids are ever reported live.
- The probe is asked exactly once per query; its verdict appears only in the answer and is never persisted (0 new records, 0 lane changes).

#### TC-STATUS-006 - A newer foreign record never wins: the repository filter precedes the fold, and no daemon lane is reported

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-6, API-6, NFR-4, NG-1, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-laneview` — the repository-scoped fold over a store seeded through the real appends

**Preconditions**:
- Store A: an `active` lane for `GH-354` under `github.com/other/repo` only (no record for the current repository).
- Store B: an `active` lane for `GH-354` under the current repository plus a `daemon.lane` record for the same ref in `delivering` (seeded through the delivered daemon append).
- Store C (the fold-order case): a `terminal` lane for `GH-354` under the current repository, appended first, and then a **newer** `active` lane for the **same ref** under `github.com/other/repo` with a distinct foreign `sessionId` and `attemptId`. Both records live under the one key `dispatch.lanes:GH-354`, because the lane key carries no repository component (`packages/core/src/contracts/dispatch.ts`), so the foreign record is genuinely the latest record for that key.
- Store D: the mirror of Store C — an `active` lane for `GH-354` under the current repository appended first, then a **newer** `terminal` lane for the same ref under `github.com/other/repo`.

**Steps**:
1. Run `dispatch status GH-354` against store A; assert the answer.
2. Run `dispatch status GH-354` against store B with the probe returning `dead`; assert the answer and the reported `sessionId`/`attemptId` provenance.
3. Run `dispatch status GH-354` in both output modes against store C: assert that the answer is derived from the local `terminal` record — `marker="terminal"`, `delivering=false`, the local `lastToken`/`lastOutcome`/`recordedAt`, and the local `sessionId`/`attemptId` — and that it is never `marker="absent"` and never the foreign `active` facts. Assert the same for store D, where the local record is the `active` one.
4. Assert the daemon lane record count and the dispatch lane record count before and after each query.

**Expected Outcome**:
- Store A: `marker="absent"` with a null lane, exit 0 — a foreign record is never returned.
- Store B: the answer is derived from the dispatch lane only (its `sessionId` and `attemptId`), `stale=true`, `probe="dead"`; the daemon lane's `delivering` state changes nothing.
- Store C: `marker="terminal"`, `delivering=false`, `lane.sessionId`/`lane.attemptId` are the local pair, and the foreign `sessionId` appears nowhere in either the human or the `--json` answer. A fold-then-filter implementation fails here twice over: folding first adopts the newer foreign record and then filters it away, answering `marker="absent"` with a null lane, while a filter-less fold answers the foreign `active` facts.
- Store D: `marker="active"`, `delivering=true` (the probe reports `live` for the local owner), and the local `sessionId`/`attemptId`; the newer foreign `terminal` record neither hides the local lane (`absent`) nor downgrades it to `terminal`.
- Daemon lane records: unchanged count and bytes; the daemon family neither reads nor is read by the query.
- Exactly one lane read per invocation (six invocations across the four stores); 0 appends; 0 lane rewrites.

**Notes**: `AC-F1-6` states the outcome; the **order** is the property this case adds, because a fold over the unfiltered set and a filter over the folded set are observably different only when a newer record for the same ref belongs to another repository. `M3` is the row that must fail.

#### TC-STATUS-007 - Every status answer performs one bounded lane read and no write

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-6, AC-F1-7, NFR-1, NFR-2, API-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-laneview` + the counted store — every port call is recorded by the delivered `countStore` wrapper

**Preconditions**:
- A counted store over the real state store, holding 5 000 lane records for other refs plus one record per lifecycle state for the addressed ref.
- A ledger snapshot and an identity-marker existence probe taken before the run.

**Steps**:
1. Run the three state cases (three separate invocations) and read the counters after each.
2. Assert the retained-window bound actually applied, the append/fence counters, the process-start count, and the marker state.

**Expected Outcome**:
- `readRecords === 1` per query (never 2), and the read is the bounded `dispatch.lane` retained-window read (`max` ≤ 5 000).
- `append === 0`, `acquireFence === 0`, `releaseFence === 0`, `replaceDocument === 0` in all three.
- `guarded.spawns === 0` (no process started), `liveNetworkRequests === 0`.
- No identity marker file is created, rewritten, or re-persisted (the marker reader returns the pre-run state).
- The ledger bytes after all three queries are byte-identical to the snapshot.

#### TC-STATUS-008 - An unreadable lane store keeps its typed `state.*` identity on `status`, never a fabricated `absent`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, API-6, API-11, DM-7, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-laneview` over the read-failure store wrapper — the fold fails, the query does not answer around it

**Preconditions**:
- The store wrapper of §6.2 (the delivered `failAppendFor` pattern, read side) failing only the `dispatch.lane` read with one named injected code per variant: `state.store.torn` (the `platform-provider` row) and `state.permission.denied` (the `user-validation` row). Every other read stays real.
- A probe verdict of `live`, so a fabricated `absent` cannot be excused as "the probe said so".

**Steps**:
1. Run `dispatch status GH-354` and `dispatch status GH-354 --json` against the `state.store.torn` variant.
2. Assert the refused envelope, the identity, and the exit — and that no `marker`, `probe`, `lane`, or `delivering` field was invented to stand in for the unreadable fold.
3. Repeat both forms against the `state.permission.denied` variant and assert its own projection.
4. Assert the exit of each answer through `packages/cli/src/projection.ts` and against the error table's `projectionClass` for the injected code.

**Expected Outcome**:
- `state.store.torn`: the answer carries the store's `state` kind and `state.store.torn` code at that row's projection — exit 2 (`platform-provider`), never `marker="absent"` at exit 0 and never a null-lane success.
- `state.permission.denied`: the same `state` kind and its own code at **its** row's projection — exit 1 (`user-validation`). Naming the code, not the kind, is what keeps the two rows distinguishable; a case asserting only "a `state` kind" would pass with the wrong exit.
- Neither variant emits `data.marker`, `data.probe`, `data.lane`, or `data.delivering`; the envelope carries no `fallback.*` code and no closed `reason`; the `state.*` identity is reused, not supplemented (`DM-7`, `NFR-5`).
- The failure summary is single-line and carries no lane content; 1 attempted lane read per invocation, 0 appends, 0 lane rewrites.

**Notes**: The sibling rows are `TC-ISDEL-006` (both `is-delivering` forms) and `TC-MSG-006` (`last-message`); together they prove "an unreadable fold is the store's typed failure" (`API-6`) on every query that reads the lane, so the three cannot drift apart. `M25` is the mutation row that must fail, and it names this case with `TC-ISDEL-006` — both phase-2 surfaces.

#### TC-LOG-001 - Default tail 50 over the newest file then the preceding one, oldest-to-newest, reference-scoped

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-1, API-2, API-7, NFR-3, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-log.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-tail` — the real listing, stitching, splitting and tail selection

**Preconditions**:
- `dispatch-logs.<workspace>/GH-354/` materialized by `tests/fixtures/dispatch/operator/logs.ts` with two segment files: `A` holding lines 1–40 and `B` holding lines 41–80, each LF-terminated and each under the cap.
- A sibling directory `dispatch-logs.<workspace>/GH-999/` holding distinctively different lines (`GH999-ONLY-<n>`).

**Steps**:
1. Run `dispatch log GH-354` (human) and `dispatch log GH-354 --json`.
2. Assert the returned line list, its order, its length, and the absence of the sibling ref's content.

**Expected Outcome**:
- Exactly 50 lines returned (the declared default), oldest-to-newest: the last 10 lines of `A` (31–40) followed by all 40 of `B` (41–80).
- `available=true`; `tail=50`; no `truncation` object (the window satisfies the request and no bound binds).
- 0 lines match `GH999-ONLY-`; the human form is the raw tail with at most one `truncation=` line and no key=value wrapper.
- Exit 0; exactly one directory listing and two file reads recorded by the fixture filesystem edge.

#### TC-LOG-002 - A value continued across a segment boundary is reconstructed (stitch before split)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-7, AC-F2-1, AC-F2-6, API-7, TDR-0058 `two-segment-tail`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-log.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-tail` — the real stitch-then-split read over a boundary-spanning value

**Preconditions**:
- A fixture family where one logical value of 1 200 000 bytes (longer than the per-file cap) begins 900 000 bytes into segment `A` and continues for the first 300 000 bytes of segment `B`, with its single LF at the end in `B`.
- A following complete line `AFTER-CONTINUATION` in `B`.

**Steps**:
1. Run `dispatch log GH-354 --tail 2 --json`.
2. Compare the returned values with the fixture's declared logical values, byte for byte.
3. Assert the read performed the stitch before splitting (the returned value is one 1 200 000-byte line, not two fragments).

**Expected Outcome**:
- The first returned line equals the 1 200 000-byte logical value exactly (same length, same bytes); it is not two fragments and not a truncated one.
- The second returned line is `AFTER-CONTINUATION`.
- No `truncation` object: the window satisfied the request and neither the value nor the line count bound.
- Exit 0; 0 deletions.

**Notes**: This is TDR-0058's named `two-segment-tail` obligation. A reader that splits each file before stitching returns two fragments and fails on the byte comparison (`M11`).

#### TC-LOG-003 - Every invalid `--tail` and every undeclared flag is refused before any artifact read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-5, AC-F2-2, AC-F5-2, API-2, API-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-log.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-cmd` — the real definition grammar over the real runtime

**Preconditions**:
- A ref with a readable artifact directory, so any refusal that happened after the read would be observable in the read counters.
- The refusal rows: `--tail 0`, `--tail 501`, `--tail 1.5`, `--tail -1`, `--tail 01`, `--tail abc`, `--tail` with no value, and `--verbose-log` (an undeclared flag).

**Steps**:
1. Run each row.
2. Assert the error identity, the exit, and the fixture filesystem edge's record.

**Expected Outcome**:
- `--tail 0`, `501`, `1.5`, `-1`, `01`, `abc`: `input.value.rejected`, exit 1, decided before any runtime call — 0 directory listings, 0 file reads, 0 store reads.
- `--tail` with no value: `fallback.invocation` (the shared parser consumes the value because the flag is declarative), exit 1, 0 reads.
- `--verbose-log`: `fallback.invocation`, exit 1, 0 reads.
- No value is ever clamped: the refused value never appears in an answer, and a subsequent valid request is unaffected (no cached state).
- The refusal summary is single-line and carries no artifact content.

#### TC-LOG-004 - No artifact directory is `no-log` at exit 0, never a fabricated tail

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-7, AC-F2-3, API-2, API-7, RSK-7, RSK-17
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-log.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-tail` — the real listing and the absent-directory branch

**Preconditions**:
- Row (a): a lane for `GH-354` written before this change (no artifact directory exists), with a seeded attempt record whose evidence would look like output if anything were fabricated.
- Row (b): a Claude Code lane (`harnessKind: "claude"`) with a recorded session and no artifact directory.
- Row (c): a ref that never had a lane and has no directory.

**Steps**:
1. Run `dispatch log GH-354` for each row, human and `--json`.
2. Assert the payload, the exit, the read record, and that no file was created.

**Expected Outcome**:
- `available=false`, `reason="no-log"`, `lines=[]`, `tail` echoing the requested or default count, no `truncation` object; exit 0 in all three rows and both forms.
- No content is synthesized from the lane record or the attempt record: the answer carries no token, session, or attempt text.
- The fixture filesystem edge records exactly one attempted listing of the addressed directory and 0 successful file reads; 0 files and 0 directories are created anywhere in the family.
- The three rows produce byte-identical payloads apart from `ref`.

**Notes**: `no-log` means "this adapter streams nothing for `log`", never "the session printed nothing" (`RSK-17`); `TC-LOG-005` is the distinct "no output" answer.

#### TC-LOG-005 - A retained file with no complete line is an available, empty answer

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-3, API-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-log.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-tail` — the real reader over a file holding only a torn tail

**Preconditions**:
- One segment file for the ref whose entire content is a single unterminated value (`TORN-ONLY` with no LF), so it holds zero complete lines.
- A second variant holding one complete line plus an unterminated tail.

**Steps**:
1. Run `dispatch log GH-354` for both variants.
2. Assert `available`, the line list, and the difference from `TC-LOG-004`.

**Expected Outcome**:
- First variant: `available=true`, `lines=[]`, exit 0 — "no capture" (`no-log`) and "no output" are distinct answers.
- Second variant: `available=true` with exactly the one complete line; the torn tail (`TORN-ONLY`) never appears.
- 0 deletions; the file's bytes are unchanged after the read.

#### TC-LOG-006 - An unreadable file is `unreadable` at exit 1 with no content

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-4, API-2, API-11, DEC-5, DM-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-log.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-tail` — the real read over a file whose read raises

**Preconditions**:
- One segment file created with mode `0o000` (or a filesystem edge that raises `EACCES` on that path only), holding content that must not leak.

**Steps**:
1. Run `dispatch log GH-354` (human and `--json`).
2. Assert the payload, the exit, and that no content or partial line list appears.

**Expected Outcome**:
- `available=false`, `reason="unreadable"`, `lines=[]` (or absent), no `truncation` object; exit 1 through `user-validation`.
- No content from the file or from any other file appears in the answer, the envelope, or the diagnostic.
- The error path is a data fact with no new error identity: the envelope's error object is absent or, where the projection surfaces one, it is the delivered `user-validation` shape with no `fallback.*` code.
- 0 deletions; 0 attempts to repair the mode.

#### TC-LOG-007 - Machine and human bounds bind with exactly one truncation fact naming its scope

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-5, NFR-3, DM-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-operator-log-bounds.test.ts` (arithmetic, D3) + `tests/conformance/dispatch/dispatch-operator-log.test.ts` (command projection)
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-tail` — the real tail selection and byte budget

**Preconditions**:
- A machine fixture: a family whose newest two files hold 500 lines of 4 000 bytes each (≈ 2 MB requested), so a `--tail 500` request exceeds the machine byte budget.
- Two human fixtures: (h1) 220 short lines, so the 200-line bound binds before any byte bound; (h2) a tail whose bytes exceed 32 768 while its line count stays below 200, so only the byte bound binds.
- The spec's declared precedence (v1.4, `AC-F2-5`): the byte bound is applied after line selection, so a binding byte bound is `scope: "bytes"`; otherwise a shorter line count is `scope: "tail"`, which is why the human 200-line bound is a `tail`-scope fact.

**Steps**:
1. Run `dispatch log GH-354 --tail 500 --json` and measure `JSON.stringify(data)` bytes.
2. Run the human form for (h1) and (h2) and count lines and bytes of each rendered tail (excluding the truncation line).
3. Assert each truncation object's shape, its `scope`, and that exactly one exists per answer.

**Expected Outcome**:
- Machine `data` ≤ 65 536 bytes; the rendered list is the newest lines that fit, oldest-to-newest, never a partial line.
- Human output ≤ 200 lines and ≤ 32 768 bytes (the log-specific bounds), with the log-specific constants distinct from the attempts constants (`DISPATCH_MAX_HUMAN_LINES = 40`, `DISPATCH_MAX_HUMAN_BYTES = 8192`) which stay unchanged.
- Exactly one `truncation` object per answer, and its `scope` names the bound that actually bound: the machine case is `{ scope: "bytes", bound: 65536, omittedLines: <n> }`; (h2) is `{ scope: "bytes", bound: 32768, omittedLines: <n> }` because the 32 768-byte human bound bound first at fewer than 200 lines; (h1) is `{ scope: "tail", bound: 200, omittedLines: <n> }` because the 200-line bound is a line bound. `omittedLines` equals the difference between the requested and returned counts.
- A byte-bound fixture reported as `scope: "tail"` fails, and so does a line-bound fixture reported as `scope: "bytes"`: the scope is the binding bound, never the output mode.
- Exit 0; no `result` token; 0 deletions.

**Notes**: A second truncation object, a clamp, or a silent short list fails. Adding the log bounds by editing the attempts constants fails `TC-CONTRACT-001`. The two human fixtures exist precisely so the `bytes`/`tail` distinction is asserted in both directions rather than inferred from one fixture.

#### TC-LOG-008 - A short retained window answers with exactly one tail-scope truncation fact

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-5, AC-F2-6, NFR-3, TDR-0058 `two-segment-tail`, RSK-14, RSK-21
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-operator-log-bounds.test.ts` (arithmetic, D3) + `tests/conformance/dispatch/dispatch-operator-log.test.ts` (command projection)
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-tail` — the real window accounting

**Preconditions**:
- Four fixture variants: (a) the retained window holds 20 lines and `--tail 200` is requested; (b) only the stream's first segment is retained (one file) and `--tail 200`; (c) the oldest returned line is a continuation whose beginning retention removed; (d) the oldest returned line begins mid-line because a value longer than the cap started in a removed file.

**Steps**:
1. Run `dispatch log GH-354 --tail 200` for each variant, in both forms.
2. Assert the returned lines, the single truncation object, and the exit.

**Expected Outcome**:
- Every variant returns what the window holds, with exactly one `truncation` object of `scope: "tail"`, the retained-window `bound`, and `omittedLines` naming the shortfall; exit 0 — a short window is a declared fact, never a failure.
- (a) 20 lines returned; (b) the single file's lines returned and the object names the single-retained-file bound; (c) the returned continuation is exactly the bytes the window holds and the object declares the loss; (d) the mid-line start is tolerated (the line is returned as it begins) and declared.
- No variant returns a fragment presented as a whole value without a truncation fact (`RSK-21`).
- 0 deletions; the files are unchanged.

#### TC-LOG-009 - A torn tail is dropped, never returned as content

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-7, AC-F2-1, AC-F2-6, API-7, NFR-3, TDR-0058 `torn-line-reader`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-operator-log-bounds.test.ts` (reader arithmetic, D3) + `tests/conformance/dispatch/dispatch-operator-log.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-tail` — the real unterminated-tail detection

**Preconditions**:
- Variant (a): a file whose last value is unterminated (`TORN-WRITE-PARTIAL`), preceded by three complete lines.
- Variant (b): a file whose every line, including the last, is LF-terminated.
- Variant (c): an older complete file plus a newer file ending mid-line.

**Steps**:
1. Run `dispatch log GH-354 --tail 10` for each variant.
2. Assert the returned lines and the absence of the torn value.

**Expected Outcome**:
- (a) exactly the three complete lines; `TORN-WRITE-PARTIAL` appears nowhere in the answer or the envelope.
- (b) the last line IS returned — a complete file's final line is never dropped (the false-positive direction of the tear rule).
- (c) the older file's lines plus the newer file's complete lines; only the newer file's unterminated tail is dropped.
- The dropped tail is a declared tolerance, not a truncation fact (`truncation` is absent when the line count was satisfied).

**Notes**: TDR-0058's named `torn-line-reader` obligation, asserted in both directions. `M17` makes the reader return the tail and must fail (a) and (c); `M18` makes it drop any last line and must fail (b).

#### TC-LOG-010 - Only the addressed ref's directory is listed and only its files are read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-6, API-7, NFR-4, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-log.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-tail` — the recording filesystem edge around the real read

**Preconditions**:
- A family root holding three refs' directories (`GH-354`, `GH-355`, `GH-999`), each with two segments, plus a decoy file at the family root.
- A recording filesystem edge that records every `readdir`, `stat`, `open` and `read` with its absolute path and refuses any path outside the family root.

**Steps**:
1. Run `dispatch log GH-354 --tail 500`.
2. Assert the recorded operations.

**Expected Outcome**:
- Exactly one directory listing, and its path is `<family>/GH-354` — never the family root, never a glob, never another ref's directory.
- Every `stat`/`open`/`read` path is inside `<family>/GH-354/`; 0 operations on `GH-355`, `GH-999`, the root, or the decoy.
- 0 opens of any path under `tmp/deliver-ticket/`, `.ai/local/delivery/`, `scripts/`, or `tools/`.
- The recorded read count is ≤ 2 (the retained files); the answer contains 0 lines from the other refs.

#### TC-LOG-011 - A read is a snapshot of what was durable, with no lock or flush

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, API-2, API-7, RSK-22
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-log.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-tail` — the real reader with a concurrent writer modelled by the fixture

**Preconditions**:
- A family whose newest file is being appended while the read runs: the fixture filesystem edge returns the file's bytes as of the read's first `open` and then reports a larger size on a later `stat` (an append in flight).
- A second variant where a segment switch happens between the listing and the read (the newest file named in the listing is replaced by a newer one).

**Steps**:
1. Run `dispatch log GH-354 --tail 50` for both variants.
2. Assert the answer equals the durable bytes at read time, and that no coordination occurred.

**Expected Outcome**:
- Both answers state what was durable when the read started: the in-flight append's bytes are simply absent, and the listing's newest file is the one read.
- 0 lock files created, 0 flushes, 0 retries, 0 writes; a second invocation after the writer quiesces returns the complete content.
- No `truncation` object when the durable content satisfied the request; the snapshot is the declared tolerance, not a truncation fact.

#### TC-LOG-012 - The machine window is byte-bounded only: a 220-line retained window is returned whole with one `tail` fact naming it, while the human form keeps its 200-line bound

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-5, API-2, DM-6, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-log.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-tail` — the real tail selection and the two bound families, driven through the real command path

**Preconditions**:
- One retained segment file for the ref holding 220 short numbered lines (`W-1`…`W-220`), so the whole window stays far below the 65 536-byte machine budget while sitting above the 200-line human bound.
- The requested tail (`--tail 500`) exceeds both what the window holds and the human line bound, so each form's answer must state its own shortfall.
- The declared constants are read from the contract module (`DISPATCH_MAX_MACHINE_BYTES`, `DISPATCH_LOG_MAX_HUMAN_LINES`), never re-typed in the case.

**Steps**:
1. Run `dispatch log GH-354 --tail 500 --json` and read `data.lines` and `data.truncation`.
2. Assert the returned line list, its length, its first and last element, and the single truncation object.
3. Run the human form with the same request and assert the rendered body's length, its first and last line, and the `truncation=` line.
4. Assert that the machine fact's `bound` is not the human line bound.

**Expected Outcome**:
- Machine answer: 220 lines returned **whole** — oldest-to-newest, `W-1` first and `W-220` last — at exit 0; the machine `data` is bounded by bytes only, so nothing is dropped by a line count.
- Machine answer carries exactly one `truncation` object: `{ scope: "tail", bound: 220, omittedLines: 280 }` — `tail` because a shorter line count than the request is a line-scope fact, and `220` because the bound that bound is the **retained window**, never a line bound; `bound` is explicitly not `DISPATCH_LOG_MAX_HUMAN_LINES`.
- Human answer: exactly 200 body lines, the newest (`W-21`…`W-220`), plus one `truncation=scope:tail,bound:200,omitted:300` line — the human 200-line bound binds and declares its own shortfall.
- Neither form applies the other's bound: a machine answer capped at 200 (or its fact naming 200) fails, and a human answer that returns 220 lines fails.
- No `result` token, 0 deletions, the file's bytes unchanged by either invocation.

**Notes**: `TC-LOG-007` asserts the machine **byte** bound and both human bounds under load; this case is the complement — a window short of the request in **lines** with bytes to spare, which is the only fixture that separates "the machine window is byte-bounded only" from "the machine window is also line-bounded". Applying the human 200-line bound to the machine answer fails on the returned length, the fact's `bound`, and the `omittedLines` arithmetic (300 vs 280). Owning phase: the log phase, which is where `dispatch log` exists.

#### TC-ISDEL-001 - A live lane answers exit 0 with delivering=true and the ref, and no refs list

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, API-3, DM-5, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-isdel.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-fold` — the real delivering fold over the real lane read

**Preconditions**:
- One `active` lane for `(github.com/owner/repo, GH-354)`; probe `live` for the recorded owner.
- Two unrelated refs' active lanes with probe `dead` (they must not affect the per-ref answer).

**Steps**:
1. Run `dispatch is-delivering GH-354` (human and `--json`).
2. Assert the payload, the exit, and the absence of a `refs` list.

**Expected Outcome**:
- `delivering=true`, `ref="GH-354"`, `repository="github.com/owner/repo"`, `refs` absent; exit 0.
- No `error` object; no `truncation` object.
- Exactly one lane read; 0 appends; 0 fences; 0 process starts.
- The human form prints the boolean fact (key=value), never only an exit code.

#### TC-ISDEL-002 - A terminal or absent lane answers exit 1 with the boolean in data and no error object

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, API-3, API-11, DEC-5, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-isdel.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-fold` — the real fold and the real projection

**Preconditions**:
- Row (a): a `terminal` lane for the ref. Row (b): no lane for the ref.

**Steps**:
1. Run `dispatch is-delivering GH-354` for both rows, human and `--json`.
2. Assert the exit, the payload, and the absence of an error object.

**Expected Outcome**:
- Both rows: exit 1 (the `user-validation` projection of a data-driven negative answer).
- `--json`: `delivering=false` inside `data`, no `error` object at all, no `fallback.*` code, no diagnostic.
- Human: the declared key set states `delivering=false`; a scripted consumer needs no exit-code inference.
- 0 appends; 0 lane rewrites; exactly one lane read per row.

#### TC-ISDEL-003 - The ref-less form answers over the repository, and an empty repository is exit 1

**Scenario Type**: Happy Path / Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-3, API-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-isdel.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-fold` — the repository-wide fold

**Preconditions**:
- Store A: exactly two refs with active non-stale lanes (`GH-354`, `GH-355`) plus one terminal lane and one stale active lane.
- Store B: no active lane at all for the repository (only terminal records).

**Steps**:
1. Run `dispatch is-delivering` against store A, human and `--json`.
2. Run `dispatch is-delivering` against store B, human and `--json`.
3. Assert the multiplicity, ordering determinism (a second run returns the same order), and exits.

**Expected Outcome**:
- Store A: exit 0, `ref=null`, `delivering=true`, `refs` listing exactly `["GH-354","GH-355"]` in a deterministic order; the terminal and stale refs are absent; no `truncation` object.
- Store B: exit 1, `delivering=false`, `refs=[]`, no `error` object.
- Exactly one lane read per invocation; 0 appends.

#### TC-ISDEL-004 - Twenty-five delivering refs list twenty with one truncation fact

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-3, DM-6, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-isdel.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-fold` — the bounded ref list

**Preconditions**:
- 25 refs with active non-stale lanes in the current repository, seeded through the delivered lane append.

**Steps**:
1. Run `dispatch is-delivering --json`.
2. Assert the list length, the declared bound, and the truncation object.

**Expected Outcome**:
- Exit 0; `delivering=true`; `refs.length === 20` (the declared bound).
- Exactly one `truncation` object naming the bound (20) and the omitted count (5); the retained list is the first 20 in the fold's deterministic order and is stable across two runs.
- 0 appends; one lane read.

#### TC-ISDEL-005 - A stale lane never makes the ref or the repository look busy

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-4, NFR-9, DEC-2, RSK-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-isdel.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-fold` + `S-probe` — the delivered divergence from a naive state fold

**Preconditions**:
- Exactly one `active` lane in the repository, whose recorded owner the probe reports `dead`.
- A second variant where the same lane's probe reports `unknown`.

**Steps**:
1. Run `dispatch is-delivering GH-354` and `dispatch is-delivering`, for both probe variants.
2. Assert the answers and the exits.

**Expected Outcome**:
- `dead` variant: both forms exit 1 with `delivering=false`; the per-ref form keeps `ref="GH-354"`; the ref-less form returns an empty `refs`.
- `unknown` variant: both forms answer in progress (`delivering=true`, exit 0) — an unknown probe never asserts staleness, so the durable active state stands. This is the deliberate asymmetry with the `dead` row above, and it matches `AC-F1-5` and `DEC-2`.
- 0 lane rewrites: the stale lane is not cleared to make the answer true.

#### TC-ISDEL-006 - An unreadable lane store keeps its typed `state.*` identity, never a fabricated false

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-5, API-6, API-3, DM-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-isdel.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-fold` over a store wrapper that fails only the lane read

**Preconditions**:
- A store wrapper whose `readRecords` returns the delivered typed failure for the `dispatch.lane` kind only (the delivered `failAppendFor`-style pattern, on the read side), injected as `state.store.torn`.

**Steps**:
1. Run `dispatch is-delivering GH-354` and `dispatch is-delivering`, human and `--json`.
2. Assert the error identity, the exit, and that no `delivering` boolean was invented.
3. Recompute the expected exit from `packages/cli/src/projection.ts` and the error table's `projectionClass` for the injected code.

**Expected Outcome**:
- Every form refuses with the store's typed `state` kind and the injected code `state.store.torn`, at that row's projection: exit 2 (`platform-provider`), never `delivering=false` at exit 1.
- The code is named on purpose, not generalised to "a `state` kind": `state.permission.denied` is also a `state.*` code but projects to `user-validation`, i.e. exit 1, so a case that asserted only the kind would pass while the row's projection was wrong. `TC-STATUS-008` asserts that second row explicitly.
- No `data.delivering` value appears in any answer; the envelope carries no `fallback.*` code.
- The failure summary is single-line and carries no lane content.

#### TC-ISDEL-007 - Only the current repository's lanes are counted or listed, and a newer foreign record never decides a local answer

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-3, NFR-4, API-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-isdel.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-fold` — the repository filter

**Preconditions**:
- 3 active lanes under `github.com/owner/repo` and 4 active lanes under `github.com/other/repo`, all with probe `live`.
- A `daemon.lane` in `delivering` for a fifth ref in the current repository.
- The fold-order fixture: a `terminal` lane for `GH-354` under the current repository appended first, then a **newer** record — `active`, probe `live` — for the **same ref** under `github.com/other/repo`. Both share the key `dispatch.lanes:GH-354`, which carries no repository component, so the foreign record is the latest record under that key.
- The mirrored fixture (row b): an `active` lane for the same ref under the current repository appended first, then a **newer** `terminal` record for that ref under `github.com/other/repo`.

**Steps**:
1. Run `dispatch is-delivering` and `dispatch is-delivering GH-354` over the base fixture; assert the list membership, the count, and the absence of foreign or daemon refs.
2. Run both forms over the fold-order fixture: the per-ref form must answer from the local `terminal` record (exit 1, `delivering=false`, `ref="GH-354"`) rather than from the newer foreign `active` record (which would answer `delivering=true`), and the ref-less form must not count `GH-354` among the delivering refs.
3. Run both forms over the mirrored fixture: the per-ref form must answer `delivering=true` at exit 0 and the ref-less form must list `GH-354`, because the local lane is the `active` one; a fold-then-filter implementation answers the newer foreign `terminal` record and returns exit 1 with an empty list.
4. Assert the lane read count, the appends, and the daemon lane's bytes.

**Expected Outcome**:
- `refs` contains exactly the three current-repository refs; 0 foreign refs and 0 daemon-only refs.
- A per-ref query for a ref that exists only under the foreign repository answers not in progress at exit 1 (never the foreign lane's state).
- Fold-order fixture: exit 1 with `delivering=false` and `ref` echoed; `refs` omits `GH-354` and carries no foreign ref. The foreign record's `sessionId`, `attemptId`, and `active` state appear nowhere, so a fold that reads the latest record for the key without filtering first reports the ref as delivering.
- Mirrored fixture: exit 0 with `delivering=true`; `refs` contains `GH-354`. This row is the one that separates the two implementations that both pass the base fixture: a fold-then-filter adopts the newer foreign `terminal` record and answers not in progress.
- One lane read per invocation; 0 appends; the daemon lane record is unchanged.

**Notes**: `AC-F3-3` owns the list/count clause; the fold **order** is the property this case adds, and it is stated for both forms because only the pair is decisive — the ref-less form catches a missing filter and the mirrored per-ref row catches a filter applied after the fold (`M3`).

#### TC-MSG-001 - A terminal lane answers the transcript's final assistant message with `final=true`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, API-4, API-9, DM-3, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-message.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-transcript` — the injected adapter-owned read beside the real lane read

**Preconditions**:
- A `terminal` lane (`harnessKind: "opencode"`, `sessionId: ses-final`) whose recorded session's transcript ends with the assistant message `I stopped at the merge gate; the PR is open and the gate needs your approval.`
- The transcript seam returns exactly that message; the recording probe counts its calls and their arguments.

**Steps**:
1. Run `dispatch last-message GH-354` (human and `--json`).
2. Assert the payload, the exit, and the seam call.

**Expected Outcome**:
- `available=true`, `final=true`, `message` equal to the transcript's final assistant message, `truncated=false`, `recordedAt` non-null and equal to the transcript's recorded instant; exit 0.
- The seam is called exactly once, with `(harnessKind="opencode", sessionId="ses-final", ref="GH-354")` and no live handle.
- Exactly one lane read; 0 session operations; 0 process starts; 0 writes.
- The human form prints the declared key set (`available`, `final`, `reason` when present, `last_message`).

#### TC-MSG-002 - The answer is the assistant text, never the envelope's synthesized lastMessage

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, NFR-8, API-9, RSK-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-message.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-transcript` — the real query with the derivation poisoned

**Preconditions**:
- A `terminal` lane whose attempt record and derivation carry a synthesized `lastMessage` (`harness evidence unreadable (…)`), distinct from the transcript's assistant text.
- A store wrapper whose attempt-record read throws, so any attempt read is observable as a failure.

**Steps**:
1. Run `dispatch last-message GH-354`.
2. Assert the answer, then verify the read set: only the lane read and the transcript call occurred.
3. Run the same query with the envelope-producing path removed (a runtime that supplies no derivation payload) and assert the same answer.

**Expected Outcome**:
- The answer is the assistant text; the synthesized sentence appears nowhere in the payload, the human output, or the diagnostic.
- `readRecords` is 1 and it read `dispatch.lane` only: 0 attempt-record reads, 0 divergence reads, 0 artifact reads; the poisoned attempt read never fired.
- The answer is identical with and without a derivation payload (provenance, not a value comparison only).

#### TC-MSG-003 - An active lane answers its latest assistant text with `final=false`

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-3, API-4, DM-5, RSK-23
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-message.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-transcript` — a mid-write transcript fixture

**Preconditions**:
- An `active` lane whose transcript's last assistant message is incomplete (`Working through the second phase; the gate`) because the fixture models a mid-write transcript.

**Steps**:
1. Run `dispatch last-message GH-354`, human and `--json`.
2. Assert `final`, the message, and that nothing presents it as a conclusion.

**Expected Outcome**:
- `available=true`, `final=false`, `message` equal to the incomplete text exactly as the transcript held it (no completion, no ellipsis invented, no classifier sentence).
- The human form states the not-final fact in its declared key set, so a partial message cannot be read as a conclusion.
- Exit 0; one lane read; 0 session operations.

#### TC-MSG-004 - No lane answers `no-lane` at exit 1 with a null message

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-4, API-4, API-11, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-message.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-transcript` — the seam must not be called

**Preconditions**:
- No lane for `(github.com/owner/repo, GH-354)`; a lane for the same ref under another repository; a transcript seam that records calls.

**Steps**:
1. Run `dispatch last-message GH-354`, human and `--json`.
2. Assert the payload, the exit, and the seam call count.

**Expected Outcome**:
- `available=false`, `reason="no-lane"`, `message=null`, `final=false`, `truncated=false`, `recordedAt=null`; exit 1 (`user-validation`).
- The transcript seam is called 0 times (the ladder's first rung short-circuits).
- No `error` object; no synthesized message; the foreign repository's lane contributes nothing.

#### TC-MSG-005 - The closed ladder answers capability-gap, session-unknown, no-message and unreadable

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-5, API-4, API-9, DM-3, DM-7, RSK-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-message.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-transcript` — the closed absence ladder

**Preconditions**:
- Four rows on a `terminal` lane: (a) `harnessKind: "claude"` with the delivered gap declaration (`headless-mode-limitation`); (b) `harnessKind: "opencode"` with `sessionId` unknown to the harness storage; (c) an opencode transcript holding tool and user messages but no assistant message; (d) an opencode transcript whose read raises.
- A fifth row: an opencode lane whose transcript is readable (the negative control for `capability-gap`).

**Steps**:
1. Run `dispatch last-message GH-354` for each row, human and `--json`.
2. Assert the reason, the null message, the exit, and the error identity.

**Expected Outcome**:
- (a) `reason="capability-gap"`, `message=null`, `available=false`, exit 1; the seam is called 0 times and no Claude storage is opened; the declared gap reason (`headless-mode-limitation`) is readable from the declaration the answer cites.
- (b) `reason="session-unknown"`, exit 1. (c) `reason="no-message"`, exit 1. (d) `reason="unreadable"`, exit 1.
- No row introduces a new error-table identity: the envelope carries no `error` object and no `fallback.*` code.
- Row five produces `available=true`, so `capability-gap` is never produced for an opencode lane.

#### TC-MSG-006 - An unreadable lane store refuses its typed identity instead of a closed reason

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-5, API-6, DM-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-message.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-transcript` — the lane read fails before the seam

**Preconditions**:
- A store wrapper whose lane read returns the delivered typed `state.*` failure, injected as `state.store.torn`; a transcript seam that records calls.

**Steps**:
1. Run `dispatch last-message GH-354`, human and `--json`.
2. Assert the identity, the exit, and that no closed reason was answer-substituted.
3. Recompute the expected exit from `packages/cli/src/projection.ts` and the injected code's `projectionClass`.

**Expected Outcome**:
- The refusal keeps the store's `state` kind and the injected code `state.store.torn` at that row's projection: exit 2 (`platform-provider`), never `unreadable`, never `no-lane`, and never exit 1.
- The code is named rather than generalised to "a `state` kind" because the projection is a property of the row, not the kind: `state.permission.denied` is `user-validation` and would project to exit 1, so a kind-only assertion cannot tell a correct implementation from one that mis-projects the row (`TC-STATUS-008` asserts that second row).
- No `data` payload with `reason` appears; the seam is called 0 times.
- The failure summary is single-line and carries no transcript or lane content.

#### TC-MSG-007 - A message read performs zero session operations and starts zero processes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, F-6, AC-F4-6, NFR-1, API-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-message.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-transcript` + a recording session port + the guarded runner

**Preconditions**:
- A session port double recording every operation call by name (`spawn`, `deliver`, `resume`, `steer`, `collect`, `session-list`, `terminate`).
- A guarded process runner and a transcript seam that records the absence of a live handle.

**Steps**:
1. Run `dispatch last-message GH-354` for one success row and one closed-absence row.
2. Assert every operation counter and the process-start counter.

**Expected Outcome**:
- Every session operation count is 0 across both rows; `guarded.spawns === 0`; `liveNetworkRequests === 0`.
- The transcript seam is called with no handle and performs no session administration: 0 opens of a live session record, 0 statements that are not reads (asserted where `TC-MSG-010` exercises the real reader; here asserted through the seam's declared input shape).
- 0 writes, 0 deletions, 0 artifact-family changes.

#### TC-MSG-008 - Composition is redact → flatten → bound → mark, so a straddling credential never survives

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-7, NFR-8, DM-6, RSK-18
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-operator-message-composition.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: the delivered composition `composeDispatchMessage` in `packages/core/src/domain/dispatch-message.ts` (redact → flatten → bound → mark), driven through the real query — the case computes its expectation with that same production function and asserts equivalence

**Preconditions**:
- A registered credential value of 40 characters (`ghp_` plus 36) handed to the run as its registered `secrets` — the composition-level supply. The end-to-end resolution of that set from the declared reference and the injected environment is `TC-MSG-011`'s observation; this case does not re-prove the wiring and registers no scrub of its own.
- A transcript whose final assistant message places that credential so it straddles the 512-character cut: 490 characters of prose, then the credential, then 200 more characters, plus embedded line breaks and a tab.
- A second fixture: a message of 600 characters with no credential; a third: a message of 400 characters with a credential entirely inside the bound.

**Steps**:
1. Run `dispatch last-message GH-354` for each fixture, human and `--json`.
2. Assert the message length, the flattening, the `truncated` flag, and the absence of the credential.
3. Compute the expectation with the production `composeDispatchMessage` over the same text and registered set, and assert the answer is **equivalent** to it (`message` and `truncated`).
4. Assert the set dependency by running the same fixture twice — once with the credential registered and once with none registered: only the registered run replaces it.

**Expected Outcome**:
- The straddling fixture: the credential appears nowhere — not as a prefix, not partially, not as `[redacted]` truncated at the boundary; the answer is ≤ 512 characters, single line (no `\n`, no `\t`), and `truncated=true` derived from the post-redaction length.
- The 600-character fixture: `truncated=true`, exactly 512 characters.
- The 400-character fixture: `truncated=false`, the credential replaced by `[redacted]`, prose returned within the bound (no general scrubbing claim is asserted).
- The answer is byte-equal to the production composition's own output for the same input, and both `truncated` values agree: the expectation is the delivered function's, so a divergence is a wiring failure rather than a differing expectation. A bound-before-redact implementation fails on the disclosed prefix (that ordering is the mutation `M33`).
- With no credential registered, the same fixture text is composed but the credential is **not** replaced: the answer is the first 512 characters of the text with `truncated=true` and the credential's leading characters visible inside the bound, which proves the redaction used the registered set rather than a fixture-local pattern.
- Exit 0 in all three; 0 writes.

**Notes**: This case owns the **composition order** (`AC-F4-7`'s order clause) under an explicitly registered set; `TC-MSG-011` owns the production **resolution** of that set (`entrypointSecrets` in the CLI entrypoint, `environment` + declared references), and `TC-MSG-010` owns the layer boundary (the reader returns raw text; the query composes). The expectation is computed by `composeDispatchMessage`, not by re-implementing the four steps in the test, so the case cannot drift into a second implementation (`TC-FIXTURE-001` would reject a local scrub by name). Owning plan phase: 5, the phase that lands the transcript read and `last-message`.

#### TC-MSG-009 - The ladder is ordered: an earlier rung wins when two conditions hold

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-5, DM-3, DEC-4, API-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-message.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-transcript` — the declared rung order

**Preconditions**:
- Row (a): a Claude Code lane whose `sessionId` is also unknown to storage (two conditions hold: `capability-gap` and `session-unknown`).
- Row (b): an opencode lane with no lane record but an artifact file present (two conditions hold: `no-lane` and, hypothetically, a readable transcript).
- Row (c): an opencode lane whose transcript is unreadable and whose session is unknown (two conditions hold: `session-unknown` and `unreadable`).

**Steps**:
1. Run `dispatch last-message GH-354` for each row.
2. Assert which rung answered and that the lower rung was not reached.

**Expected Outcome**:
- (a) `capability-gap` (not `session-unknown`) and the transcript seam is never called for a gapped harness.
- (b) `no-lane` (the lane read is the first rung; no artifact or transcript read occurs).
- (c) `session-unknown` (not `unreadable`): the unreadable read is never attempted for an unknown session.
- The ladder is exactly `no-lane` → `capability-gap` → `session-unknown` → `no-message` → `unreadable`; reordering it is mutation `M31`.

#### TC-MSG-010 - The opencode reader returns the final assistant message from a built store, read-only

**Scenario Type**: Happy Path / Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, AC-F4-6, API-9, DM-3, NFR-1, NFR-8, RSK-15
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-operator-transcript-opencode.test.ts`
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: the real opencode transcript reader over a built store (`tests/fixtures/harness/opencode-store/**`) through the delivered read-only opener (`createBunSqliteStoreOpener`) and its `onStatement` recorder, plus one D1 invocation of the query with that reader mounted

**Preconditions**:
- `buildOpencodeStore({ generation: "current" })` and `{ generation: "legacy" }` extended with seeded assistant text parts: three assistant messages whose last is `FINAL-ASSISTANT-TEXT`, one user message after it, and a tool part.
- A `RAW-SEAM-TEXT` variant whose final assistant text is `RAW-SEAM-LINE-1\nRAW-SEAM-LINE-2\t<registered credential>`: a value carrying line breaks, a tab, and a registered credential, inside the reader's own read cap.
- Variants: `no-assistant-message`, `unknown-session`, and a truncated/corrupt store file.
- A statement recorder (`onStatement`) as the delivered telemetry extractor uses.

**Steps**:
1. Call the real transcript reader with `(harnessKind: "opencode", sessionId: ROOT_SESSION, ref: "GH-354")` over each generation and variant.
2. Assert the returned message, the statement log, and the read-only posture.
3. Call the query surface on D1 with this reader mounted as the transcript seam (`dispatch last-message GH-354`, human and `--json`) over the `FINAL-ASSISTANT-TEXT` store, the `RAW-SEAM-TEXT` store, and a 600-character store.
4. Assert the division of labour: the adapter read returns the stored final text verbatim under its own read cap, and the **query** — not the reader — performs redact → flatten → bound → mark.

**Expected Outcome**:
- Current and legacy generations both return `FINAL-ASSISTANT-TEXT`; a user message's text is never returned as the final assistant message.
- The `RAW-SEAM-TEXT` variant returns `RAW-SEAM-LINE-1\nRAW-SEAM-LINE-2\t<credential>` byte-identically: the line break and tab survive, the credential is **not** replaced by `[redacted]`, no `truncated` flag is produced, and no 512-character cut is applied. The reader returns raw stored text under its own declared read cap (spec Appendix D) and composes nothing. The same credential **is** replaced one layer up, by the query (next bullet), so the difference asserted here is the layer, not the registered set.
- Through the query on the same real stores: the `RAW-SEAM-TEXT` answer is a single line (no `\n`, no `\t`) with the credential replaced by `[redacted]`; the 600-character answer is ≤ 512 characters with `truncated=true` derived from the post-redaction length; the `FINAL-ASSISTANT-TEXT` answer is unchanged by composition. That is redact → flatten → bound → mark performed by the query.
- `statements[0]` contains `PRAGMA query_only`; every statement is a bounded `SELECT` scoped by `session_id = ?` (with `LIMIT`); 0 `INSERT`/`UPDATE`/`DELETE`/`DROP`/`PRAGMA` writes; 0 unbounded scans.
- `no-assistant-message` → the closed `no-message` absence; `unknown-session` → `session-unknown`; the corrupt store → `unreadable`, never a crash and never a partial message.
- The store file's bytes and mtime are unchanged after every read, including the query invocations; 0 files created beside it.

**Notes**: This is the offline half of `RSK-15`: it proves the reader's contract against the two recorded generations, which is more than the seam alone. A *live* layout drift beyond those generations remains in §1.2's not-proven list. The composition clause is `AC-F4-7`'s and is owned by `TC-MSG-008`; this case re-observes it over the real reader (and over the real query) without moving ownership, so it adds no AC link. A reader that flattens, bounds, or redacts fails here even though `TC-MSG-008` would still pass — that is the point of asserting the seam's raw return.

#### TC-MSG-011 - The entrypoint-resolved credential is redacted before the message cut, in both output modes

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-7, AC-F4-1, API-4, API-9, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-message.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: the production entrypoint `runEntrypoint` (whose `entrypointSecrets` resolves the registered set from the declared references and the injected `environment`), the real command definition and projection, and the real composition `composeDispatchMessage` — with the transcript read injected

**Preconditions**:
- A terminal lane (`harnessKind: "opencode"`, `sessionId: "ses-straddle"`) whose transcript ends with a message that straddles the 512-character cut: 490 characters of prose, then a 40-character registered credential (`ghp_` plus 36), then further prose carrying an embedded line break and a tab.
- The credential is seeded **only** as `environment: { GITHUB_TOKEN: <credential> }` together with `credentialReferences: DECLARED_CREDENTIAL_REFERENCES`; no `secrets` and no fixture-local pattern is passed, so the only way the composition can know the value is the entrypoint resolving it.
- Because a declared reference is present, the run goes through the production `runEntrypoint` path rather than a directly composed program, so the registered set travels as the invocation fact production uses (§6.2, fact 5).

**Steps**:
1. Run `dispatch last-message GH-354 --json` and read `data.message` and `data.truncated`.
2. Assert the surrounding prose, the replacement marker, the absolute absence of the credential, the length, and the flag.
3. Assert the control: a naive 512-character cut of the raw transcript text would have disclosed the credential's leading characters, so the absence cannot be an artifact of the cut.
4. Run the human form and assert the same absences and the surviving prose.

**Expected Outcome**:
- The credential appears nowhere in either form — not whole, not partially, not as a prefix: `message` contains no `ghp_…` value and none of its leading characters, and `human.stdout` likewise.
- The surrounding prose survives: the answer begins with the 490 prose characters, carries `[redacted]` where the credential stood, and keeps the words after it (`still`).
- The bound is applied to the **post-redaction** text: `message.length` equals the declared 512-character bound and `truncated=true`, at exit 0 in both forms.
- The control holds: the raw text's first 512 characters include the credential's leading characters, while the answer contains none of them — the difference is redaction before the bound, not a cut that happened to miss the value.
- No record, evidence ref, envelope, or diagnostic gains the credential; 0 writes.

**Notes**: This is the only case in the battery that proves the credential set is what **production** resolves: the value enters through `environment` and `credentialReferences` only, `entrypointSecrets` computes the registered set in the CLI entrypoint, and it reaches the message composition as the invocation's `secrets` fact. `TC-MSG-008` proves the composition order under an explicitly registered set and asserts equivalence with `composeDispatchMessage`; `TC-MSG-010` proves the reader returns raw text and that the query composes; `TC-FIXTURE-001` rejects a fixture-local scrub by name. Together they close the wiring (this case), the order (`TC-MSG-008`), and the layer (`TC-MSG-010`). Owning phase: the message phase — the phase that lands the transcript read and `last-message`.

#### TC-GRAMMAR-001 - Each form carries exactly one `query` discriminator and its declared key set in the standard envelope

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, API-1, API-2, API-3, API-4, API-5, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-grammar.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-cmd` — the real definition payloads and the delivered envelope writer

**Preconditions**:
- One composed program with a live lane, a readable artifact family, and a resolvable transcript, so every form produces its positive answer.

**Steps**:
1. Run each of the four forms with `--json`.
2. Assert the envelope shape (`schemaVersion`, `runId`, `exitCode`, `timing`, `data`), the single `query` value, and the exact key set of `data`.
3. Run each form's human variant and assert its declared key set (or, for `log`, the raw tail).

**Expected Outcome**:
- `data.query` is exactly one of `status`/`log`/`is-delivering`/`last-message`, once per payload, and never a second discriminator key.
- Key sets: `status` = `{query, ref, repository, delivering, stale, marker, probe, pid, sessionId, lane}`; `log` = `{query, ref, available, reason?, tail, lines, truncation?}`; `is-delivering` = `{query, delivering, repository, ref, refs?, truncation?}`; `last-message` = `{query, ref, available, final, reason?, message, truncated, recordedAt}` — 0 extra keys, 0 missing keys.
- `exitCode` in the envelope equals the process exit; `runId` and `timing` are present and non-empty.
- The human `log` output is the raw tail plus at most one `truncation=` line; the other three render key=value with every declared key present.
- No payload carries a delivery `result` token.

#### TC-GRAMMAR-002 - A non-canonical or missing ref and an extra positional are refused before any runtime call

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-2, API-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-grammar.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-cmd` — the real grammar over a runtime whose every read is counted and poisoned

**Preconditions**:
- A runtime whose lane read, artifact listing, and transcript call all raise a distinctive error, so "before any runtime call" is observable as "the error never fired".
- Rows: `dispatch status` (no ref); `dispatch status gh-354`; `dispatch status GH354`; `dispatch status GH-354x`; `dispatch log GH-354 extra`; `dispatch is-delivering GH-354 extra`; `dispatch last-message GH-354 extra`; `dispatch last-message GH-ABC` (canonical letters, no digits).

**Steps**:
1. Run each row, human and `--json`.
2. Assert the refusal identity, the exit, and the zero runtime calls.

**Expected Outcome**:
- Every row refuses `input.value.rejected` at exit 1 with a single-line summary, except the shapes the shared parser answers (a fourth positional) — see the declared distinction in §3.3 and §8.3.
- 0 lane reads, 0 directory listings, 0 artifact reads, 0 transcript calls, 0 session operations for every row.
- The refusal is not `fallback.invocation` for any row that the handler decides, and never `fallback.internal`.
- No partial payload appears: `data` is absent.

**Notes**: This case deliberately asserts the extra-positional shape at the handler level (`GH-354 extra` = two positionals, inside the definition's `positionals.max`). The 4+-positional shape is a parser refusal with a different identity; that divergence is recorded as an open question in §8.3 rather than silently narrowed here.

#### TC-GRAMMAR-003 - An invalid `--tail` value and an undeclared flag take their distinct refusal identities

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, F-2, AC-F5-2, AC-F2-2, API-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-grammar.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-cmd` — the family's delivered unknown-flag guard plus the new value flag

**Preconditions**:
- The poisoned runtime of `TC-GRAMMAR-002`.
- Rows: `dispatch log GH-354 --tail abc`; `dispatch status GH-354 --tail 50` (a value flag on the wrong form); `dispatch status GH-354 --revert`; `dispatch is-delivering --note x`; `dispatch last-message GH-354 --harness opencode`.

**Steps**:
1. Run each row.
2. Assert the identity, the exit, and the zero runtime calls.

**Expected Outcome**:
- `--tail abc`: `input.value.rejected` (a present-but-invalid value reaches the handler), exit 1, 0 artifact reads.
- `--tail 50` on `status`, `--revert` on `status`, `--note x` on `is-delivering`, `--harness opencode` on `last-message`: `fallback.invocation`, exit 1, 0 runtime calls — the delivered guard's identity is preserved, and adding `--tail` to the declarative vocabulary does not change it for any other flag.
- 0 rows produce `fallback.internal` or a crash; 0 rows produce a payload.

#### TC-GRAMMAR-004 - An uncomposed query surface refuses `input.value.rejected`, never crashes

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-3, API-5, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-operator-composition.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-cmd` — the real definition built over a runtime that supplies only `run`

**Preconditions**:
- `createDispatchCommandDefinition({ run })` — no lane view, no artifact tail, no delivering fold, no transcript read — driven through `runCli`.
- The delivered `attempts`/`summary`/`resolve`/`handover` uncomposed behaviour as the control.

**Steps**:
1. Run each of the four forms.
2. Assert the refusal, the exit, and that the process returned an envelope.

**Expected Outcome**:
- Each form refuses `input.value.rejected` at exit 1, with no crash, no `fallback.internal`, and no empty success.
- The delivered uncomposed forms (`attempts`, `dual-run summary`, `handover`) keep their own refusal identities, unchanged.
- The structure suite also asserts the four optional runtime members exist as declared types and that the production composition supplies all four (a source-level assertion over `createDispatchCommandRuntime`/the production gate runtime).

#### TC-GRAMMAR-005 - No query emits a delivery result token or appends a record, and later reads are unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, F-6, AC-F5-4, NFR-2, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-grammar.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-cmd` + the counted store

**Preconditions**:
- A live lane, an artifact family, and a resolvable transcript, plus a seeded attempt history and a baseline envelope from a dispatch.
- Store counters and a ledger snapshot.

**Steps**:
1. Run all four forms (and both `is-delivering` forms).
2. Assert `append === 0` for every record kind, `acquireFence === 0`, and the ledger bytes unchanged.
3. Re-run the dispatch and `dispatch attempts` afterwards and compare with the baseline.

**Expected Outcome**:
- 0 `dispatch.attempt` appends, 0 `dispatch.lane` appends, 0 divergence/handover/queue appends; 0 fences.
- No answer carries `result`, `lastToken` as a top-level `result`, or any delivery-result token; the token set is untouched.
- The later dispatch's envelope and the later `dispatch attempts` answer are identical to the baseline: an inspection never changes what a later read reports.
- 0 identity-marker writes; 0 artifact-family deletions.

#### TC-PERSIST-001 - Each stream of a streaming adapter gets its own 0600 file, created before its first value

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, API-8, DM-2, DEC-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-persist.test.ts`
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: `S-sink` — the real opencode adapter over the scripted streaming starter (S1)

**Preconditions**:
- A scripted streaming starter whose `lines` generator performs an assertion at its FIRST pull: the file for that stream must already exist in `dispatch-logs.<workspace>/GH-354/` (it records the observed directory listing at that instant).
- A dispatch script: spawn stream (five values), then a resume stream (three values), then a deliver stream (two values).
- The fixture filesystem edge records `mode` on creation and every `open`/`write`.

**Steps**:
1. Run the dispatch to completion.
2. Assert the directory, the file count, each file's mode, and the first-pull observation recorded by the starter.

**Expected Outcome**:
- Exactly one directory (`dispatch-logs.<workspace>/GH-354/`) and exactly three files: one per stream (spawn, resume, deliver).
- At the first pull of each stream, that stream's file already existed — the acquisition-settling line and every pre-settle value are captured.
- Every file has mode `0600`; every file's content ends with exactly one LF.
- The sink is bound once per stream, before its first value; 0 files are created for a lane that opens no stream (see `TC-PERSIST-004`).
- 0 shared write targets: no two streams in the same file.

#### TC-PERSIST-002 - Every yielded value is written with exactly one LF, decoded or not, final remnant included

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, AC-F7-3, DM-2, TDR-0058 `DC-2`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-persist.test.ts`
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: `S-sink` — the real adapter's raw line iteration

**Preconditions**:
- A spawn stream yielding: a valid JSON session line; a blank line; a non-JSON line `NOT-JSON-<n>`; a JSON non-object line `[1,2,3]`; and a final unterminated remnant `FINAL-REMNANT` (the host's close behaviour pushes it without a marker).
- A telemetry frame sink recording its own observed frames.

**Steps**:
1. Run the dispatch.
2. Compare the spawn stream's file bytes with the declared transformation of the yielded values.
3. Compare the telemetry sink's frames with the file's content.

**Expected Outcome**:
- The file's bytes are exactly: each yielded value followed by one LF, in order, including the blank value (one LF) and the final remnant (`FINAL-REMNANT` + LF): 6 values → 6 LF-terminated records, and the file ends with LF.
- The undecodable and non-object lines appear in the artifact and never in the telemetry sink (which sees decoded frames only) — the sink is the raw line iteration, not the frame sink.
- Nothing is appended verbatim: an unterminated tail cannot be produced by the writer.
- The dispatch's token, exit, records, and evidence are identical to the run without the fixture's undecodable lines.

#### TC-PERSIST-003 - File names sort in creation order across a restart and two concurrent streams

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, AC-F7-4, DM-2, TDR-0058 `artifact-naming` / `segment-ordering`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-persist.test.ts`
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: `S-sink` — the naming rule under restarts and concurrency

**Preconditions**:
- A dispatch whose first iteration stalls below the bound and whose second iteration resumes (two streams, same ref, ordinals 1 and 2), plus a second segment for the first stream (a value set larger than the cap).
- A two-concurrent-stream fixture: two streams opened for one ref with the same recorded clock instant, differing attempt identity.
- A fixture that sets a deliberately stale mtime on the older file (to prove name order, not mtime, is the ordering source).

**Steps**:
1. Run both fixtures.
2. List each family and sort lexically; compare with the recorded creation order.
3. Assert the tie-break between the two concurrent streams.

**Expected Outcome**:
- Lexical order equals creation order in both fixtures: recorded time, then attempt identity, then iteration ordinal, then segment ordinal, zero-padded so a plain sort is correct.
- Ordinal 2 (the restart) sorts after ordinal 1; segment 2 sorts after segment 1; the concurrent streams' tie is broken by attempt identity deterministically (the same order on a re-run).
- The stale-mtime file does not move: name order wins, so `dispatch log` reads the same files in the same order regardless of mtime.
- 0 shared counters (no sequence number derived from process state): re-running the fixture in a fresh process produces the same names for the same inputs.

**Notes**: TDR-0058's named `artifact-naming` and `segment-ordering` obligations. A counter-derived name fails the fresh-process re-run.

#### TC-PERSIST-004 - Two refs never share a directory or file, and a one-shot adapter creates none

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, API-8, DM-2, RSK-17
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-persist.test.ts`
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: `S-sink` — the family's scope, and the one-shot adapter's absence

**Preconditions**:
- Two dispatches for two refs on the same composed program and state root.
- One dispatch on a Claude Code lane (`harnessKind: "claude"`) with a one-shot runner double and a sink factory that records any call.
- One dispatch refused before any session was opened (an admission refusal).

**Steps**:
1. Run the two ref dispatches and assert the directory set.
2. Run the Claude lane dispatch and assert the directory set and the sink call count.
3. Run the pre-session refusal and assert the directory set.

**Expected Outcome**:
- Two directories exist, one per ref, and no file name is shared between them; each stream's bytes are attributable to exactly one ref.
- The Claude lane creates no `dispatch-logs.<workspace>/GH-354/` directory (or any family directory) and calls the sink factory 0 times: a one-shot adapter opens no stream.
- The pre-session refusal opens no stream, so it also creates no directory.
- `dispatch log` for the Claude lane answers `no-log` (cross-checked with `TC-LOG-004` row (b)).

#### TC-PERSIST-005 - The per-file cap is enforced by segmentation with nothing dropped at a boundary

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Plan Phase(s)**: owned by phase 3 — the phase whose commit lands the case's load-bearing half and makes it gate-green; the write half is asserted at the phase-3 boundary, and the read-back half is executed at the phase-4 boundary (the log phase) as that boundary's cross-control, which is an assertion allocation and never a second owner
**Related IDs**: F-2, F-7, AC-F2-6, AC-F7-3, NFR-3, TDR-0058 `segment-switch`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-operator-artifact-writer.test.ts` (boundary arithmetic) + `tests/conformance/dispatch/dispatch-operator-persist.test.ts` (real adapter)
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: `S-sink` for the write half; `S-tail` for the read-back half — the cap rule including the exactly-filling case

**Preconditions**:
- A scripted stream of many small values totalling > 1 048 576 bytes, arranged so one value would exactly fill the remaining room, one would leave room for itself but not its LF, and one would not fit at all.

**Steps**:

*Write half — runs at the phase-3 boundary, with no query involved.*

1. Run the dispatch.
2. Assert every file's size and the total bytes, and that the concatenation of the files in name order equals the declared transformation of the yielded values.
3. Assert the boundary cases from the file bytes alone: the segment that would leave room for its bytes but not its LF starts the next file whole, and the exactly-filling value neither overflows by an LF nor loses one.

*Read-back half — runs at the phase-4 boundary, once `dispatch log` exists.*

4. Run `dispatch log <ref> --tail 500` over the family the write half produced and assert the reconstructed values are byte-identical to the yielded values.

**Expected Outcome**:
- Every file is ≤ 1 048 576 bytes; no file exceeds the cap even by one LF.
- No byte is dropped or duplicated at a boundary: concatenating the segments in name order reproduces the value stream exactly.
- The value that would leave room for its bytes but not its LF starts the next file whole (a file never ends without its LF, because every record carries one).
- (Read-back half, phase 4) the reconstructed values are byte-identical to the yielded values, and `dispatch log --tail 500` returns them whole.
- 0 deletions during the run (only the retention rule removes, after a new file exists).

**Notes**: TDR-0058's named `segment-switch` obligation. The "exactly filling" boundary is the case that catches an off-by-one in the LF accounting (`M47`). The id is **phase-3-owned**: the write half is what phase 3's commit makes observable and gate-green, and the read-back half is executed at the phase-4 boundary as that boundary's cross-control over the same files (plan `SPLIT CASES`, and its `SHARED-FILE NOTE` 5/6 split of `dispatch-log.ts` / `dispatch-logs.ts`). Phase 4 executes the read-back assertions against this id and does not re-own it. The AC linkage is unchanged — `AC-F2-6` is the same property's read clause and `AC-F7-3` its write clause — and neither half is evidence for the other.

#### TC-PERSIST-006 - A value longer than the cap is split and reconstructed byte-identically

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Plan Phase(s)**: owned by phase 3 — the phase whose commit lands the case's load-bearing half and makes it gate-green; the write half is asserted at the phase-3 boundary, and the read-back half is executed at the phase-4 boundary (the log phase) as that boundary's cross-control, which is an assertion allocation and never a second owner
**Related IDs**: F-2, F-7, AC-F2-6, AC-F7-3, TDR-0058 `segment-switch`, RSK-21
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-operator-artifact-writer.test.ts` + `tests/conformance/dispatch/dispatch-operator-persist.test.ts`
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: `S-sink` for the write half; `S-tail` for the read-back half — the continuation and its reconstruction

**Preconditions**:
- One value of 1 200 000 bytes preceded by a 100-byte value, so the oversize value begins inside the first file and must be split at the cap.

**Steps**:

*Write half — runs at the phase-3 boundary, with no query involved.*

1. Run the dispatch.
2. Assert the first file is exactly 1 048 576 bytes, the second begins with the remainder, and no value was dropped for being large.

*Read-back half — runs at the phase-4 boundary, once `dispatch log` exists.*

3. Run `dispatch log <ref> --tail 2` over the two retained files and assert the value is reconstructed whole.
4. Run it over the family after retention applies (a third file exists) and assert the answer contains what the window holds plus exactly one `tail`-scope truncation fact — never a fragment presented as a whole value.

**Expected Outcome**:
- (Write half, phase 3) file 1 is exactly the cap (filled by the leading bytes); file 2 begins mid-line with the remainder; no value is dropped for being large; 0 in-place modification of any written byte.
- (Read-back half, phase 4) with both files retained, `dispatch log --tail 2` returns the value whole, byte-identical to the input.
- (Read-back half, phase 4) with retention applying (a third file exists), the answer returns what the window holds and carries exactly one `tail`-scope truncation fact — never a fragment presented as a whole value.

**Notes**: The id is **phase-3-owned**: the continuation inside the writer is what phase 3's commit makes observable and gate-green, and the stitched read-back is executed at the phase-4 boundary as that boundary's cross-control over the same files (plan `SPLIT CASES`). Phase 4 executes the read-back assertions against this id and does not re-own it. `AC-F2-6` and `AC-F7-3` keep their existing links to this id; the write half is the `AC-F7-3` observation and the stitched reconstruction is the `AC-F2-6` observation.

#### TC-PERSIST-007 - Retention keeps the newest two files and removes the oldest only after the new file exists

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-4, AC-F2-6, NFR-3, DM-2, RSK-19, RSK-20
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-operator-artifact-writer.test.ts` + `tests/conformance/dispatch/dispatch-operator-persist.test.ts`
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: `S-sink` — retention order and failure tolerance

**Preconditions**:
- A stream requiring three segments; a filesystem edge that records the exact order of `create` and `remove` operations.
- A second variant where the removal fails (`EPERM` on unlink only).
- Two successive dispatches for the same ref (two iterations' streams), inside and beyond a three-file window.

**Steps**:
1. Run the three-segment stream and assert the operation order and the retained set.
2. Run the failing-removal variant and assert the family state and the next append.
3. Run the two-successive-dispatch variant and assert attribution and the family bound.

**Expected Outcome**:
- The new file is created before the oldest is removed (the recorded order); the retained set is the newest two by name; the family is ≤ 2 097 152 bytes after a successful removal.
- Failed removal: three files remain until the next append, the family exceeds the bound only transiently, no error surfaces to the delivery, and the next append retries and succeeds.
- Two dispatches: both deliveries appear as distinct files while inside the window; the family never exceeds 2 × cap; no file is modified to make room; no file of the other ref is touched.
- 0 deletions by any read path (asserted with `TC-RO-001`).

#### TC-PERSIST-008 - A written file is never modified: one append per value, mode and bytes intact

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-3, DM-2, TDR-0058 `DC-2`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-operator-artifact-writer.test.ts` + `tests/conformance/dispatch/dispatch-operator-persist.test.ts`
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: `S-sink` with a write-recording filesystem edge

**Preconditions**:
- A stream of 40 values; a filesystem edge recording every write as `{path, offset, bytes, mode}`.

**Steps**:
1. Run the dispatch.
2. Assert the write count, the open modes, the offsets, and the byte-prefix stability.

**Expected Outcome**:
- Exactly one append per yielded value (40 writes for 40 values, plus 0 rewrite/truncate operations); every write is `O_APPEND`-equivalent (offset equals the prior size) and carries exactly the value plus one LF.
- Every file is opened `0600` and never re-opened for modification; no `truncate`, no `ftruncate`, no `rename`, no `chmod` after creation.
- Each file's byte prefix after write *n* is identical to its prefix after write *n+1* (append-only in the observable sense).
- 0 lock files, 0 coordination files anywhere in the family.

#### TC-PERSIST-009 - A killed writer leaves at most one torn tail and the reader drops only that tail

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, F-2, AC-F7-3, AC-F2-1, DM-2, TDR-0058 `torn-line-reader`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-persist.test.ts`
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: `S-sink` + `S-tail` — a process killed mid-write

**Preconditions**:
- A filesystem edge that, on the Nth write of a stream, writes only the first half of the value and then throws (the process is killed mid-write), so the file ends mid-line.
- The dispatch then terminates with a classified failure.

**Steps**:
1. Run the dispatch and assert the delivery's classification and the file's tail state.
2. Run `dispatch log GH-354` and assert the returned lines.
3. Assert the earlier complete lines are intact.

**Expected Outcome**:
- The file holds the complete lines plus exactly one unterminated tail; at most one such tail exists per file.
- `dispatch log` returns every complete line and never the torn fragment; the earlier lines are byte-intact.
- The delivery's token, exit, records, and evidence are identical to the same failure without the mid-write kill (the sink fault is observational).
- 0 files are repaired, truncated, or deleted by the reader.

**Notes**: Distinct from `TC-LOG-009`: that case proves the reader's contract over planted files; this one proves the writer's crash window leaves exactly one droppable tail.

#### TC-PERSIST-010 - A sink fault is observational: token, exit, records and evidence are identical

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-2, API-8, NFR-5, TDR-0058 `sink-fault-observational`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-persist.test.ts`
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: `S-sink` — an injected sink that fails on create, on append, and on the retention removal

**Preconditions**:
- A baseline dispatch on the same fixture with a healthy sink, producing token `pr-open`, exit 0, one attempt record, and an evidence list.
- Three fault rows: (a) file creation throws; (b) the first append throws; (c) the retention removal throws; each on the spawn stream and (b) also on the resume and deliver streams.

**Steps**:
1. Run the baseline and each fault row.
2. Compare token, exit, envelope (apart from ids/timings), attempt-record count and fields, lane records, and evidence refs.

**Expected Outcome**:
- Token, exit, outcome, attempt-record count, lane record sequence, and the evidence ref list are identical in every row.
- No evidence identifier is added for a sink failure: the evidence list contains no `log:*`, `sink:*`, or equivalent entry, and the 16-reference budget is unaffected.
- The fault is swallowed as observation: no error object, no diagnostic, no changed classification.
- A partially written file may remain (the fault's own artifact); it is never repaired, and the read tolerates it per `TC-PERSIST-009`.

**Notes**: TDR-0058's named `sink-fault-observational` obligation, asserted on all three stream kinds because `deliver` is a distinct construction point.

#### TC-PERSIST-011 - The artifact holds only the declared transformation, and no log content reaches any record

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Plan Phase(s)**: owned by phase 4, the log phase; its central observation needs a `dispatch log` answer, which does not exist at the phase-3 boundary — phase 3 no longer runs it
**Related IDs**: F-7, F-6, AC-F7-3, AC-F6-1, NFR-11, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-persist.test.ts`
**Tags**: @backend, @dispatch, @harness, @offline
**Seam**: `S-sink` + the delivered record readers

**Preconditions**:
- A spawned stream carrying three canaries: `PROMPT-ONLY-CANARY` seeded only in the prompt (never in stdout), `STDOUT-CANARY-<n>` in the stdout values, and a credential value resolved by the credential port (`CREDENTIAL-CANARY-<n>`) which the harness itself prints into stdout.
- The dispatch's envelope, attempt record, lane records, evidence refs, and derived documents captured after the run.

**Steps**:
1. Compare each file's bytes with the declared transformation.
2. Scan every record, evidence ref, derived document, and both envelope forms for the three canaries.
3. Scan the artifact for the prompt canary.
4. Run `dispatch log GH-354 --tail 50` over that family and compare the answer with the file bytes: the answer holds only the requested tail, and the family's file set and bytes are unchanged by the read.

**Expected Outcome**:
- File bytes equal the transformation exactly: nothing added, nothing removed, no header, no scrubbing pass.
- `STDOUT-CANARY` appears verbatim in the artifact (unscrubbed by design) and nowhere in any record, evidence ref, derived document, or envelope beyond the requested tail.
- `CREDENTIAL-CANARY` appears in the artifact only because the harness printed it, and nowhere in any record or envelope.
- `PROMPT-ONLY-CANARY` appears in neither the artifact nor any record.
- The `dispatch log` answer contains only the requested tail — never the whole file — and the artifact family's file set is unchanged by the read.

**Notes**: Owned by **phase 4** (the log phase). Its decisive observation is the `dispatch log` clause above, which has no answer before the log surface exists, so it cannot be green at the phase-3 boundary; phase 3 no longer runs it. The write-path properties it also observes (the declared transformation, the LF rule, the cap by segmentation, retention) stay phase 3's, carried by `TC-PERSIST-002`, `TC-PERSIST-005`, `TC-PERSIST-006`, `TC-PERSIST-007`, and `TC-PERSIST-008`. Moving the id moves no AC link: `AC-F7-3` and `AC-F6-1` keep their existing case sets.

#### TC-RO-001 - Store bytes, lane records, the identity marker and the artifact file set are unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, NFR-2, API-6, API-7, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-posture.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: the counted store + the delivered `snapshotStore`/`evidenceFiles` readers over the real filesystem

**Preconditions**:
- A populated root: a live lane, a terminal lane, an unreadable-file ref, a three-file family (an over-retention state planted deliberately), an identity marker written by a prior dispatch, and a seeded attempt history.
- A full snapshot: every store file's bytes and mode, the identity marker's bytes and mtime, the artifact family's file set with each file's bytes, mode and mtime.

**Steps**:
1. Run all four queries in both forms, plus both `is-delivering` forms, over the same root.
2. Re-take the snapshot and compare it field by field.

**Expected Outcome**:
- Byte-identical store files; identical lane record count and order; identical identity marker bytes and mtime.
- Identical artifact family file set — in particular the deliberately over-retained third file is NOT removed by a read (0 deletions).
- Counters aggregated across all invocations: `append === 0`, `acquireFence === 0`, `releaseFence === 0`, `replaceDocument === 0`.
- No file is created anywhere under the state root.

**Notes**: The planted third file is what makes "0 deletions" non-vacuous: a read that "tidies" the family fails here.

#### TC-RO-002 - Planted shell artifacts change no answer and stay byte- and mtime-identical

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-2, NFR-2, NFR-6, API-12
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-posture.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-cmd` over a root carrying the shell lane's files

**Preconditions**:
- The five shell artifacts planted with distinctive content: `.ai/local/delivery/delivering` (`GH-354`), `.ai/local/delivery/GH-354.pid` (a live-looking pid), `tmp/deliver-ticket/GH-354.pm.out` (`SHELL-PM-OUT-CANARY`), `tmp/deliver-ticket/GH-354.log` (`SHELL-LOG-CANARY`), `.ai/local/delivery/GH-354.last-message` (`SHELL-LAST-MESSAGE-CANARY`).
- The same root without them, as the control.
- A fingerprint of each planted file: bytes, mode, and `mtimeMs`.

**Steps**:
1. Run all four queries and both `is-delivering` forms over the planted root; capture the canonical payloads and exits.
2. Run the same set over the clean root; compare.
3. Re-fingerprint the planted files.

**Expected Outcome**:
- Every payload and exit is identical between the two runs (the planted files change nothing, including `status.marker`, `status.pid`, `is-delivering.delivering`, `log` content, and `last-message.message`).
- No canary appears in any payload, envelope, or diagnostic: `SHELL-LOG-CANARY` never appears in a `log` answer, `SHELL-LAST-MESSAGE-CANARY` never in a `last-message` answer.
- Every planted file is byte-, mode-, and `mtimeMs`-identical afterwards; none is created, truncated, repaired, or deleted (the shell's self-healing is not ported).

#### TC-RO-003 - Zero child processes and zero network reads across every query

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-4, NFR-1, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-posture.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: the guarded runner (`tests/fixtures/dispatch/parity/process-runner.ts`) + the delivered network guard (`tests/fixtures/verify-gates/cases/network-guard.ts`)

**Preconditions**:
- The guarded runner wrapping every injected child seam, with its real-start counter.
- `createNoNetworkGuard()` installed for the duration of the suite, plus `scanForLiveCalls` over the new read modules.

**Steps**:
1. Run the whole operator battery's query set (the registry's rows) with the guard installed.
2. Assert the counters and the static scan.
3. Attempt a live `fetch` inside the guarded window as a control and assert it is refused and recorded.

**Expected Outcome**:
- `guarded.spawns === 0`, `guarded.resumes === 0`, `guarded.violations === []`, `liveNetworkRequests === 0`, `realChildStarts === 0`.
- `scanForLiveCalls` finds 0 direct network call sites in the new read modules and the composition edge they are mounted in.
- The control call is refused with the guard's message and counted, so the zero is a measurement rather than a literal.

#### TC-RO-004 - Each query performs exactly the declared read count and no second read

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-1, API-6, API-7, DOD-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-posture.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: the counted store + the recording filesystem edge + the transcript seam counter

**Preconditions**:
- The counted store, the recording filesystem edge, and a transcript seam that counts calls, all active in one composed program.

**Steps**:
1. Run each query once and read all three counters.
2. Assert the declared budget per query, including the `--json` and human pair (one invocation each).

**Expected Outcome**:
- `status`: 1 lane read; 0 artifact operations; 0 transcript calls.
- `log`: 1 lane read (the repository/ref resolution read is the same single bounded read) and exactly 1 directory listing plus ≤ 2 file reads; 0 transcript calls.
- `is-delivering` (both forms): 1 lane read; 0 artifact operations; 0 transcript calls.
- `last-message`: 1 lane read and exactly 1 transcript call; 0 artifact operations.
- No query performs a second lane read; no query reads the store for any other record kind.

#### TC-SHELL-001 - The extended invariant passes over the declared surface and a planted reference fails by name

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-3, API-12, NFR-6
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/no-shell-dispatch.test.ts` (+ the extended `scripts/checks/no-shell-dispatch.ts`)
**Tags**: @backend, @dispatch, @checks, @offline
**Seam**: the static invariant `DISPATCH_FLOW_SURFACE` and its rule set

**Preconditions**:
- The extended declared surface: every new read/write module is declared, every new `packages/core/src/{app,domain}/dispatch-*.ts` is covered by the glob-coherence assertion, and every new fixed entry is listed in the check's `FIXED_SURFACE` mirror.
- A temp workspace for planted references.

**Steps**:
1. Run the live-tree assertions: surface existence, `scan(ROOT) === []`, empty allowlist, glob coherence (declared = globbed + fixed), reachability from the surface entries.
2. Plant one reference per rule class in the temp workspace and assert each is reported by rule name and `file:line`.
3. Run the false-positive controls, including a `scripts/` mention in a doc, a `.sha` member access, and a port `.spawn(` call.

**Expected Outcome**:
- 0 violations on the live tree; every declared surface file exists and is reachable; the allowlist is empty and the allowlist mechanism still suppresses a declared entry.
- The new modules are all declared: the glob-coherence assertion fails if a new `dispatch-*.ts` is not on the list, and the fixed-entry assertion fails if a new read module is omitted.
- Each planted reference fails by name: a script-path literal, a substituted template path, a `shell: true`, an `execSync` import, and a `spawn` without `shell: false`.
- The controls report nothing.

#### TC-SHELL-002 - The whole query battery records zero shell invocations and zero script paths

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-3, AC-F6-4, API-12, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-posture.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: the guarded injected runner over every query row in the registry

**Preconditions**:
- The registry sweep (`OPERATOR_MATRIX` rows plus the ladder and form rows), with the guarded runner installed.
- A declaration of which registry rows invoke a process at all (expected: none for the read-only queries; the write-path rows go through the scripted starter, not the guarded runner).

**Steps**:
1. Run every registry row.
2. Assert the guard's records and violations for each.
3. Assert the declared invoking-row set equals the observed set.

**Expected Outcome**:
- Every row: `violations === []`, 0 invocations whose executable is a shell, 0 arguments that are script paths (`.sh`, `scripts/`, `tools/`, `deliver-ticket`).
- The observed set of process-invoking rows equals the declared set (empty for reads), so the sweep cannot become vacuous by silently skipping rows.
- A planted shell invocation inside the sweep is reported by name (the control).

#### TC-SHELL-003 - A checkout with no shell entry points answers all four queries

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-5, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-posture.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-cmd` over a checkout root with no `scripts/` and no `tools/`

**Preconditions**:
- A temp checkout whose `scripts/` and `tools/` directories do not exist, and whose `.ai/local/delivery/` does not exist, with a live lane, an artifact family, and a resolvable transcript.
- A control root where those directories exist but are empty.

**Steps**:
1. Run all four queries and both `is-delivering` forms in the shell-absent root.
2. Assert the answers and the absence of any missing-script failure.
3. Repeat in the control root and compare.

**Expected Outcome**:
- 4/4 queries answer successfully (2 successful and 0 failed for `status`; a produced tail for `log`; `delivering=true`; a final message) with their normal exits.
- 0 answers contain a "not found", "ENOENT", or script-path diagnostic; 0 `fallback.internal`.
- The payloads are identical between the two roots apart from paths that are not in any payload.

#### TC-SHELL-004 - Planted shell content can never steer a typed answer

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-2, AC-F6-3, API-12, RSK-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-posture.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: `S-cmd` + the recording filesystem edge — provenance, not only identity

**Preconditions**:
- The same planted shell artifacts as `TC-RO-002`, whose contents are engineered to look like the typed answers: a `<REF>.last-message` holding `SHELL-DECOY-MESSAGE`, a `<REF>.log` holding 50 `SHELL-DECOY-LINE` lines, a `delivering` marker holding `GH-354`, and a `<REF>.pid` holding a pid that matches the lane's owner.
- A typed lane whose real answers are distinct: a transcript message `TYPED-REAL-MESSAGE` and typed artifact lines `TYPED-REAL-LINE-<n>`.

**Steps**:
1. Run the four queries.
2. Assert each answer's content provenance and the filesystem edge's record.
3. Assert that removing the shell artifacts changes nothing.

**Expected Outcome**:
- `last-message` returns `TYPED-REAL-MESSAGE`, never `SHELL-DECOY-MESSAGE`; `log` returns the typed lines, never `SHELL-DECOY-LINE`.
- `status` derives `marker` and `pid` from the lane record, not from the marker file or the pid file (a lane whose recorded pid differs from the planted pid reports the recorded one).
- The filesystem edge records 0 opens/stat/readdir of any path under `tmp/deliver-ticket/` or `.ai/local/delivery/`.
- The answers are byte-identical with the artifacts removed.

#### TC-CONTRACT-001 - The closed contract surface is unchanged against a pinned baseline

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-4, NFR-5, DM-7, API-11
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/operator-contract-invariance.test.ts`
**Tags**: @backend, @dispatch, @checks, @offline
**Seam**: the exported contract constants, the error table, the projection matrix, and the adapter declarations, compared with a pinned baseline fixture

**Preconditions**:
- A pinned baseline fixture (`tests/fixtures/dispatch/operator/contract-baseline.ts`) recording the delivered values before this change: `HARNESS_OPERATIONS` (7), `HARNESS_LIFECYCLE_CAPABILITIES` (4), the gap inventory, both adapters' `lifecycleCapabilities` and gap rows, `HARNESS_KINDS`, the error table's rows with kind/code/projection, `DELIVERY_RESULT_TAXONOMY` (tokens and projection classes), the domain-kind set, the lane record key set, the attempt record key set, `DISPATCH_MAX_EVIDENCE_REFS` (16), `DISPATCH_MAX_HUMAN_LINES`/`BYTES` (40/8192), and the configuration key set.

**Steps**:
1. Re-derive each surface from the live modules and compare with the baseline.
2. Assert the specific additions this change is allowed to make (the four payload shapes, the four query discriminators, the log-specific bounds) are additive and appear nowhere in the baselined lists.
3. Assert `state-unverified` still projects to exit 2, and that the queries' own rows are `success`/`user-validation` for answers and closed negatives while a lane-store failure projects from the existing `state.*` row it reuses (`state.store.torn` → 2, `state.permission.denied` → 1) with no new row.

**Expected Outcome**:
- `HARNESS_OPERATIONS.length === 7` with the same members in the same order; `HARNESS_LIFECYCLE_CAPABILITIES.length === 4` with `session-introspection` present and unchanged; 0 new capability members, 0 new gap reasons.
- opencode still declares `session-introspection` supported; Claude Code still declares it as a gap with reason `headless-mode-limitation`; every other adapter declaration identical.
- 0 new error-table rows and 0 changed projections; 0 new delivery-result tokens; 0 new domain kinds; 0 new attempt-record fields; 0 new `dispatch.lane` fields; 0 new configuration keys.
- `DISPATCH_MAX_EVIDENCE_REFS === 16`; the attempts bounds (40/8192) unchanged; the log bounds are separate constants.
- `state-unverified` → 2; `success` → 0; `user-validation` → 1; `platform-provider` → 2 for the reused `state.store.torn` row; `pnpm run scripts/checks/exit-code-literals.ts` stays green so no call site gained a numeric exit.

#### TC-CONTRACT-002 - The delivery path is unchanged and the family's help entries move from five to nine

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-5, AC-F5-4, RSK-9, spec §25.1, DM-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-matrix.test.ts` (delivery regression) + `tests/structure/dispatch-help-inventory.test.ts` and `tests/structure/dispatch-attempts-composition.test.ts` (extended help assertions)
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: the delivered dispatch conformance battery and the delivered help/guide inventory

**Preconditions**:
- The delivered `dispatch-e2e`, the GH-347 parity battery, and the golden command fixtures, run unchanged.
- The two delivered help-count assertions (currently `5`) and `tests/fixtures/help-guide/coverage.json`.

**Steps**:
1. Run the delivered dispatch conformance and parity suites and compare every envelope, attempt record, lane record, and exit with their baselines.
2. Run the extended help-inventory assertions.
3. Compare `coverage.json` with the baseline.

**Expected Outcome**:
- Every delivered dispatch case produces the same token, exit, envelope shape, attempt record, and lane record sequence as before the change: 0 behaviour change on the write path (`TC-PERSIST-*` covers the additive side effect).
- The family's help entries are exactly 9 (the delivered 5 plus `status`, `log`, `is-delivering`, `last-message`), each pointing at the unchanged reference page `doc/planning/oss-tooling/milestones/m1/commands/dispatch.md`; `dispatch attempts` keeps its own M2 page pointer.
- `coverage.json` is unchanged: the same reference-page list and the same `commands` list — no new page, no removed page.
- The four new entries each declare their usage, the `--tail` option (log only), one example, and the exit convention in their summary or options.

#### TC-CONTRACT-003 - Pre-change records read unchanged and a pre-change ref answers honestly

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-5, AC-F2-3, spec §8.5, §20, DM-1, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-additive-stability.test.ts` (extended)
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: the delivered readers over pre-change fixture records

**Preconditions**:
- A pre-change lane and attempt record fixture (the delivered additive-stability corpus): a lane with exactly the delivered key set and no new field, an attempt record with its delivered key set and its 16-reference budget.
- No artifact directory for that ref.

**Steps**:
1. Read both records through the delivered readers and compare their decoded shapes with the fixture.
2. Run all four queries for that ref.
3. Assert no migration, backfill, or rewrite occurred.

**Expected Outcome**:
- Both records decode with 0 new fields, 0 missing fields, and 0 read errors; the ledger bytes are unchanged.
- `status` answers `marker="terminal"` (or `active`) from the record; `is-delivering` answers per the record; `last-message` resolves through the transcript; `log` answers `no-log` at exit 0 — the classified absence of §20, never a fabricated empty log.
- 0 rewrites, 0 backfills, 0 files created for the pre-change ref.

#### TC-NFR-001 - Two consecutive battery runs are identical with zero live network and zero live processes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-7, NFR-1, DOD-4, API-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-matrix.test.ts`
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: the whole registry through D1, canonicalized by the delivered canonicalizer

**Preconditions**:
- Two isolated roots, one per run, with the same fixed clock, id sequence, registry order, probe sequence, and transcript fixtures.
- Canonicalization that normalizes only the temp root and generated ids.

**Steps**:
1. Run every registry row twice.
2. Compare canonical payloads, exits, and the per-row counters.
3. Assert the live-call counters.

**Expected Outcome**:
- Byte-identical canonical payloads and identical exits for all 12 lifecycle combinations and both forms; per-row read counts identical.
- `liveNetworkRequests === 0`, `realChildStarts === 0`, `liveProcessTableReads === 0` in both runs.
- The injected transport saw every request (so a native `fetch` fallback would have been counted as live).
- No wall-clock assertion anywhere: the only time source is the injected clock and delay recorder, so the suite cannot flake under load.

#### TC-NFR-002 - Every declared bound is a constant with exactly one home and no configuration key

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-3, NFR-5, DM-6, TDR-0058 `C-1`/`DC-7`
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/operator-contract-invariance.test.ts`
**Tags**: @backend, @dispatch, @checks, @offline
**Seam**: the exported constants and the configuration key set

**Preconditions**:
- The declared values: per-file cap 1 048 576; family bound 2 097 152 (newest 2); machine `data` 65 536; human log 200 lines / 32 768 bytes; message 512; delivering-ref list 20; probe tolerance 5 000 ms; lane window 5 000 records; tail default 50 in 1..500.

**Steps**:
1. Assert each value is exported once from a contract module and referenced (not re-typed) by its consumer.
2. Assert the retained-file count and family bound are declared as TDR-0058 policy constants and derived (2 × cap), not duplicated literals.
3. Assert the configuration key set is unchanged and contains no log/probe/tail key.

**Expected Outcome**:
- Each bound resolves to exactly one exported constant; a re-typed literal in a consumer is reported by file and line (source scan) — 0 occurrences.
- `familyBound === 2 * perFileCap`; the retained count is its own constant; changing one in a mutation changes the other's derivation (`M49`), and duplicating a bound as a literal is reported by `M61`.
- 0 new configuration keys; the log bounds are not the attempts bounds (`DISPATCH_MAX_HUMAN_LINES` stays 40, `DISPATCH_MAX_HUMAN_BYTES` stays 8192).
- The message bound reuses `DISPATCH_MAX_LAST_MESSAGE_CHARS` (512) rather than adding a second 512.

#### TC-NFR-003 - Each query answers within 1 000 ms over the 5 000-record reference store

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-10, NFR-1
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-operator-latency.test.ts`
**Tags**: @backend, @dispatch, @operator, @perf, @offline
**Seam**: the read-side production functions over a 5 000-record store and a two-file family

**Preconditions**:
- A store seeded with exactly 5 000 `dispatch.lane` records (the retained-window bound) plus the addressed ref's active record.
- A family whose retained files are each near the cap.
- The measurement convention of the delivered read-side suite: 10 runs per query, p95, `performance.now()`, environment recorded.

**Steps**:
1. Warm up once, then measure 10 runs of each read (lane view, tail selection, delivering fold, message composition over the injected seam).
2. Assert p95 per query and the read counts.

**Expected Outcome**:
- p95 ≤ 1 000 ms for each query over the 5 000-record window.
- Exactly the declared read counts (`NFR-1`) during the measured runs — the budget is met by bounded reads, not by caching.
- No wall-clock dependency: the measurement excludes the injected delay and uses no real I/O beyond the seeded fixture.
- The recorded environment is printed so a slow machine's result is interpretable rather than a flake.

#### TC-NFR-004 - The only persisted and emitted content is the harness stdout and the bounded final message

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-11, NFR-8, AC-F4-7, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-privacy.test.ts` (extended)
**Tags**: @backend, @dispatch, @operator, @offline
**Seam**: the whole battery's canary sweep over outputs and at-rest artifacts

**Preconditions**:
- One canary per declared content class: a prompt canary, a resume-prompt canary, a diff canary (`--- a/x`), a credential canary, a tool-argument canary (`{"path":"/secret"}`), and a provider-payload canary.
- Every case's captured outputs, records, and the state root.

**Steps**:
1. Scan every envelope (human and `--json`), every record, every evidence ref, and every derived document for each canary.
2. Scan the artifact family for the prompt, diff, tool-argument, and provider-payload canaries.
3. Assert the message payload bound and the single-line rule across the battery.

**Expected Outcome**:
- 0 occurrences of the prompt, diff, tool-argument, or provider-payload canaries anywhere.
- The credential canary appears only where the harness itself printed it, and never in a record, evidence ref, or envelope.
- Every `last-message` payload is ≤ 512 characters, single-line, and `truncated` derived from the post-redaction length.
- The artifact family holds only harness stdout (bounded per file and at 2 × cap per ref) — the engine added and removed nothing.

#### TC-FIXTURE-001 - Every case drives a real production seam and a reimplementation is rejected by name

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-4, NFR-5, TDR-0058 `DC-3`/`DC-4`, spec §12
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/operator-seam-identity.test.ts` (new) + the extended `tests/fixtures/dispatch/parity/seams.ts`
**Tags**: @backend, @checks, @dispatch, @offline
**Seam**: import identity, a forbidden-signature scan, and a planted control

**Preconditions**:
- The seam manifest extended with the operator seams: `lane-view` (the fold), `artifact-tail` (the reader), `delivering-fold`, `transcript-read` (the opencode reader), `owner-probe`, and `log-sink` — each naming its production symbol, its production module, and the composition file that mounts it.

**Steps**:
1. Assert every declared symbol is exported by the declared production module and imported by the battery from that module (import identity).
2. Scan the new test surface for a locally re-expressed decision signature (a local stitch/split/tail loop, a local `1_048_576`, a local 512-char bound, a local `probe` verdict table, a local credential-scrub loop).
3. Drive a temp copy with a reimplemented seam and assert it is rejected by name.

**Expected Outcome**:
- Every operator seam resolves to its one production module; 0 suites satisfy themselves with a private copy of the read decision.
- The forbidden-signature scan reports 0 hits on the live tree and reports each planted hit with `file:line` and the seam name.
- The planted control fails by name (`reimplementation of <seam> in <file>`), proving mechanisms 1 and 2 are not vacuous.
- No fixture exposes a writer for a lane, attempt, or artifact record that a case could use to satisfy itself.

#### TC-FIXTURE-002 - The proved / not-proved boundary is a permanent constant and is self-consistent

**Scenario Type**: Structure
**Impact Level**: Important
**Priority**: High
**Related IDs**: spec §25.3 Appendix C, RSK-11
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/operator-proof-boundary.test.ts` (new)
**Tags**: @backend, @checks, @dispatch, @offline
**Seam**: the fixture constant `OPERATOR_PROOF_BOUNDARY`

**Preconditions**:
- `OPERATOR_PROOF_BOUNDARY` in `tests/fixtures/dispatch/operator/bounds.ts`: proven ids (lane-view fold, probe mapping and tolerance, repository scoping, artifact tail and bounds, oversized continuation and reconstruction, retention set and family bound, torn-tail drop, truncation facts, delivering fold, transcript ladder including `capability-gap`, message composition order, exit projections, read-only posture, no-shell invariant) and not-proven ids (live storage layouts, real kernel probe semantics, real stdout framing, real cross-process append interleaving and torn writes, real snapshot timing, real disk-full/`0600` enforcement, long-run growth, a one-shot invocation) in declared order.

**Steps**:
1. Assert the constant's shape, the declared order, and that every id is unique.
2. Assert every registry row's seam is a proven id; assert no row depends on a not-proven surface.
3. Plant an add/drop/reorder mutation and assert each fails by name.

**Expected Outcome**:
- The constant is the only source of the boundary; the counts and order are asserted.
- Every row's declared seam is proven; 0 rows declare a not-proven seam.
- Each planted mutation fails with a message naming the control (`proof boundary drift: <control>`).
- The suite reads no file under `doc/changes/**`; the published page is reconciled in the documentation phase and guarded by the delivered doc checks, not by this case.

#### TC-FIXTURE-003 - Every new suite and fixture is isolated to the approved temp base

**Scenario Type**: Structure
**Impact Level**: Important
**Priority**: High
**Related IDs**: repo convention (`TC-ATTEMPT-036`), NFR-7
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/dispatch-operator-test-isolation.test.ts` (new)
**Tags**: @backend, @checks, @dispatch, @offline
**Seam**: the delivered `tests/fixtures/projects/state-scope.ts` guards (`APPROVED_BASE`, `guardStateFixtureRoot`, `realStateFingerprint`, `realStateDirectory`)

**Preconditions**:
- The declared list of new suites and fixture modules for this change (the §7.3 list).

**Steps**:
1. Assert every declared suite and fixture exists and every new fixture root comes from the repository-local approved base (`tmp/tmpdir`), never `tmpdir()` directly.
2. Assert no suite composes the production program with this repository as its working directory.
3. Take a fingerprint of the operator's real state directory before and after a representative read; compare.
4. Assert no fixture writes outside the approved base and that every created root is disposed in `finally`.

**Expected Outcome**:
- 0 direct `tmpdir()` uses in the new files; every root under `tmp/tmpdir`.
- 0 suites use the repository root as the composed working directory.
- The real state directory fingerprint is identical before and after (no operator state is read or written).
- The declared list matches the on-disk set: a new suite or fixture that is not declared fails by name.

## 6. Environments and Test Data

**Environment.** Local developer workstation and CI, `bun test`, no network. Every run works inside the repository-approved temp root: `tmp/tmpdir` under `$PWD` (the delivered `tests/fixtures/projects/state-scope.ts` precedent), created with `mkdir -p tmp/tmpdir` and disposed in `finally`. `TMPDIR=$PWD/tmp/tmpdir` is exported for every command so `mkdtemp` never escapes the repo. The live state directory, `~/.config`, real provider credentials, a real checkout, and the operator's own `tmp/deliver-ticket/` / `.ai/local/delivery/` are never read; the planted shell artifacts of `TC-RO-002`/`TC-SHELL-004` are created inside the temp checkout only.

**Determinism devices.** Fixed clock instant (`createDispatchClock(DISPATCH_NOW)`); fixed id sequence; fixed probe verdict sequence keyed by `(processId, startedAt)`; fixed transcript fixtures keyed by session id; fixed registry order; the injected `delay(ms, reason)` recorder; a canonicalizer that normalizes only the temp root and generated ids. No wall-clock assertion is used anywhere; the only time sources are the injected clock, the delay recorder, and — for `TC-NFR-003` only — a recorded p95 measurement.

### 6.1 Fixture inventory

**Exists — reuse, do not duplicate.**

| Fixture | What it gives |
|---------|----------------|
| `tests/fixtures/dispatch/parity/harness.ts` | Driver D1: one composed production program per run over a temp checkout and its derived state root, injecting the guarded runner, starter, transport, git runner, credentials, `processId`, clock, id sequence, and `delay`; `run`, `observe()`, `seedRestarts`, `seedLease`, `holdFence`, `dispose` |
| `tests/fixtures/dispatch/parity/lane.ts` | `seedDispatchLane` (active/terminal, owner facts, ordinals), real lane/daemon readers, the store wrapper that fails only `dispatch.lane` appends, the "lane exists before any attempt" probe |
| `tests/fixtures/dispatch/parity/process-runner.ts` | `createGuardedRunner` with `records`, `spawns`, `resumes`, `violations`, and `isScriptPath` — the zero-shell and zero-real-start counters |
| `tests/fixtures/dispatch/parity/seams.ts` | `SEAM_MANIFEST` (import identity) and the reimplementation-signature registry |
| `tests/fixtures/dispatch/parity/evidence.ts` | The canonicalizer used by `TC-NFR-001` and the class fixture table pattern |
| `tests/fixtures/dispatch/attempts-harness.ts` | `countStore` (read/append/fence/replace counters), `storeWithRecords`, `storeWithReadFailure` pattern, the delivered envelope shape reader |
| `tests/fixtures/dispatch/attempts-production.ts` | `snapshotStore`, `evidenceFiles` — the byte/mode snapshot readers used by `TC-RO-001` and `TC-FIXTURE-003` |
| `tests/fixtures/dispatch/attempt-records.ts`, `tests/fixtures/dispatch/ledger.ts` | `ATTEMPTS_REF`, `REPOSITORY`, `ledgerOf`, `maximalEvidenceRefs` (16), divergent-ledger builders |
| `tests/fixtures/dispatch/harness.ts` | `createDispatchClock`, `DISPATCH_NOW`, the scripted session port and its `spawnInputs` recorder, the evidence constants |
| `tests/fixtures/dispatch/golden/harness.ts` | The command-level scenario over the edge runtime, `readsFrom`, `exitOf` (projection-derived exit) |
| `tests/fixtures/harness/opencode-store/{build,current-generation,legacy-generation}.ts` | A real SQLite store in both recorded generations, `ROOT_SESSION`/`CHILD_SESSION`, variants, the `PRIVACY_CANARY` content document |
| `tests/fixtures/harness/harness-io.ts` | `createRecordingRunner`, `streamStarterFromRunner`, and the line-framing helpers the scripted starter extends |
| `tests/fixtures/state/harness.ts` | `openStore`, `makeIdentity`, `withinFence`, `removeRoot` |
| `tests/fixtures/projects/state-scope.ts` | `APPROVED_BASE`, `guardStateFixtureRoot`, `realStateDirectory`, `realStateFingerprint` — the isolation guards |
| `tests/fixtures/verify-gates/cases/network-guard.ts` | `createNoNetworkGuard`, `scanForLiveCalls` — the zero-network observation and its static half |
| `tests/conformance/dispatch/controlled-repo.ts` | The real store plus real command path with its `provenance()` guard and "no ledger writer" surface |
| `scripts/checks/no-shell-dispatch.ts`, `tests/checks/no-shell-dispatch.test.ts` | The declared surface, the four rules, the empty-allowlist mechanism, the planted and false-positive controls |
| `tests/checks/dispatch-attempts-test-isolation.test.ts` | The isolation pattern `TC-FIXTURE-003` follows (declared suite/fixture list, approved base, real-state fingerprint) |

**Must be authored — extension of the above, under `tests/fixtures/dispatch/operator/`.**

| New file | Contents |
|----------|----------|
| `tests/fixtures/dispatch/operator/harness.ts` | Driver D1's operator harness: one composed production program per run over a temp checkout/state, composing `createProductionComposer` with the guarded runner, the scripted starter, the scripted transport, the git runner, the credential port, `processId`, the clock, the id sequence, the injected `delay`, the four operator facts (probe, transcript read, artifact root with the recording filesystem edge, clock), and the optional `environment` plus `credentialReferences`, whose presence routes each run through the production `runEntrypoint` so `entrypointSecrets` resolves the registered set the message runtime redacts with (§6.2, fact 5). Exposes `run`, `observe()` (payloads, store counters, fs records, session-operation counts, guarded invocations, envelopes, the resolved `secrets`), `plant()`, and `dispose()`. |
| `tests/fixtures/dispatch/operator/matrix.ts` | **The one answer-matrix registry**: the 12 lifecycle rows, both `is-delivering` forms, the five message-ladder rows, and both output modes, each `{ id, group, query, state, mode, precondition, expectedData, expectedExit }`; exports `OPERATOR_MATRIX` and `runMatrixCase(entry)`. No suite re-declares an expectation. |
| `tests/fixtures/dispatch/operator/logs.ts` | The artifact-family materializer: build a ref's directory with N segment files of exact byte sizes, a boundary-spanning value, a torn tail, a single-retained-file window, a 220-line short window whose bytes stay under the machine budget (the `TC-LOG-012` fixture), a no-complete-line file, an oversized value, an over-retained third file, an unreadable file (`0o000`), and stale-mtime files; plus the family snapshot reader (path → bytes/mode/mtimeMs) and the reconstruction helper. |
| `tests/fixtures/dispatch/operator/streams.ts` | The scripted streaming starter: per-stream scripts (spawn, resume, deliver), a **first-pull probe** that asserts the stream's file exists at its first value, undecodable and non-object lines, an oversized value, an exactly-filling value, a mid-write kill, two concurrent streams for one ref, a three-segment stream, and a one-shot runner double for a Claude lane. |
| `tests/fixtures/dispatch/operator/transcript.ts` | The transcript read seam double (final message, partial active message, `session-unknown`, `no-message`, `unreadable`) with call recording and a declared-harness stub for the Claude gap; plus the fixture that wires the **real** opencode reader over a built store. |
| `tests/fixtures/dispatch/operator/probe.ts` | The owner-liveness probe double: verdicts `live`/`dead`/`unknown`, a "process table unreadable" mode, start-instant deltas of 0, ±4 999, ±5 000 and ±5 001 ms, and a reused-pid model; records every `{processId, startedAt}` it was asked about. |
| `tests/fixtures/dispatch/operator/decoys.ts` | The planted shell artifacts (delivering marker, `<REF>.pid`, `<REF>.pm.out`, `<REF>.log`, `<REF>.last-message`) with distinctive canaries engineered to look like typed answers, plus byte/mode/mtimeMs fingerprinting and a comparison helper. |
| `tests/fixtures/dispatch/operator/bounds.ts` | The declared-bound mirror (1 048 576, 2 097 152, 65 536, 200, 32 768, 512, 20, 50, 1..500, 5 000, 5 000 ms) with a per-value "one home" map, and the permanent `OPERATOR_PROOF_BOUNDARY` (proven and not-proven ids in declared order). |
| `tests/fixtures/dispatch/operator/contract-baseline.ts` | The pinned closed-contract baseline for `TC-CONTRACT-001`: operations, lifecycle capabilities, gap inventory, both adapters' declarations, harness kinds, error-table rows with kind/code/projection, tokens and projection classes, domain kinds, lane/attempt key sets, the 16-ref budget, the attempts human bounds, and the configuration key set. |

**Extensions to existing files (not new files).**

- `tests/fixtures/dispatch/parity/harness.ts`: accept the four operator facts and expose them on `observe()` together with the resolved `secrets` (and route the run through `runEntrypoint` when `credentialReferences` is present); keep every existing option's default behaviour.
- `tests/fixtures/dispatch/parity/lane.ts`: add a repository-scoped seed (the same ref under another repository) and a daemon-lane seed for the same ref; the repository-scoped seed must be appendable after a local record so the newer-foreign-record order of `TC-STATUS-006`/`TC-ISDEL-007` is expressible.
- `tests/fixtures/dispatch/parity/seams.ts`: six new `SEAM_MANIFEST` entries (`lane-view`, `artifact-tail`, `delivering-fold`, `transcript-read`, `owner-probe`, `log-sink`) with the reimplementation signatures each forbids.
- `tests/fixtures/dispatch/attempts-harness.ts`: a `storeWithReadFailure(store, kind, code)` wrapper so `TC-STATUS-008`, `TC-ISDEL-006`, and `TC-MSG-006` can fail only the lane read and name the injected code (`state.store.torn` by default, with `state.permission.denied` as the second variant).
- `tests/fixtures/harness/opencode-store/build.ts` (+ `current-generation.ts`, `legacy-generation.ts`): seed assistant text parts with distinct texts (last = `FINAL-ASSISTANT-TEXT`), the `RAW-SEAM-TEXT` value that carries a line break, a tab, and a registered credential (for the raw-return assertion of `TC-MSG-010`), a 600-character final text, a user-only transcript, and the `no-assistant-message` / `unknown-session` / `corrupt-store` variants. The delivered `PRIVACY_CANARY` content document stays.
- `scripts/checks/no-shell-dispatch.ts` + `tests/checks/no-shell-dispatch.test.ts`: the new surface entries, the `FIXED_SURFACE` mirror update, and the new planted/false-positive controls.
- `tests/structure/dispatch-help-inventory.test.ts` and `tests/structure/dispatch-attempts-composition.test.ts`: the family help-entry count moves from 5 to 9, with the four new entries' usage/options/examples asserted.
- `tests/behaviour/dispatch-additive-stability.test.ts`: the pre-change lane/attempt corpus and the four-query honesty assertions of `TC-CONTRACT-003`.
- `tests/behaviour/dispatch-privacy.test.ts`: the operator canary sweep of `TC-NFR-004`.

### 6.2 Seams and mechanisms the fixtures must provide

- **The four operator composition facts (declared facts 1–4).** The composition accepts an owner-liveness probe, a transcript read, an artifact-family root (plus its filesystem edge), and the clock — all additive, non-operator, and mounted at the same edge that mounts `claimLease`/`existingLane`/`attempts` today (`packages/cli/src/production.ts` supplies them, `packages/cli/src/edge.ts` builds the runtime). No configuration key is added (`NFR-5`).
- **The registered-credential set (declared composition fact 5).** `AC-F4-7` requires redaction **before** the 512-character bound, which is only observable if the runtime that composes the message holds the set production actually registered. That set is resolved once, in the CLI entrypoint: `entrypointSecrets` (`packages/cli/src/entrypoint.ts`) unions the invocation's `secrets` with the value of every declared `credentialReferences` entry read from the injected `environment`, and `runEntrypoint` passes the result to the composed program as the invocation's `secrets` fact, which the production composition hands to the dispatch command runtime and so to the `last-message` read. `registerEdgeSecrets` in `packages/cli/src/edge.ts` stays where it is and keeps serving the `blockers` and `steer` runtimes; it is **not** the operator path, and the operator path must not be described in its terms. The fixture therefore seeds the credential's declared environment variable through the injected `environment` and supplies `DECLARED_CREDENTIAL_REFERENCES`, and passes no `secrets` of its own, rather than supplying a scrub (`TC-FIXTURE-001` rejects a local credential scrub by name). Owning plan phase: **5**, the phase that lands the transcript read and `last-message`; asserted end to end by `TC-MSG-011`, ordered by `TC-MSG-008`, and swept by the privacy case `TC-NFR-004`. No configuration key is added (`NFR-5`).
- **The recording filesystem edge.** Every listing, stat, open, read, create, append, and remove is recorded with an absolute path; any path outside the family root is refused by name. This is what makes "only the addressed directory is listed" (`TC-LOG-010`), "0 shell-artifact reads" (`TC-SHELL-004`), "0 deletions" (`TC-RO-001`), and "0 in-place modification" (`TC-PERSIST-008`) observable rather than asserted.
- **The first-pull probe.** The scripted starter's `lines` generator, at its first `next()`, records the family listing. Because the adapter binds the sink before it starts draining (`acquireFromStream` is called after the sink is constructed, and the generator is pull-based), the file must already exist at that instant — that is the executable form of "created before the stream's first yielded value" (`AC-F7-1`).
- **Per-stream scripts with the exact boundary shapes.** The starter yields: a valid session line, a blank line, an undecodable line, a non-object JSON line, a value that exactly fills the remaining room, a value that leaves room for its bytes but not its LF, a value longer than the cap, and a final unterminated remnant. One script kills the writer mid-value; another opens two streams for one ref; another needs three segments.
- **The probe model.** A function of `(processId, startedAt)` plus a mode flag for an unreadable table; it returns a verdict and records the query, so `TC-STATUS-005` can assert both the mapping and that the probe is advisory (never consulted by admission: 0 admission calls in every read case).
- **The transcript doubles, two of them.** A seam double for the composition-level cases (counts calls, asserts no handle), and the **real** opencode reader over a built store for `TC-MSG-010` (with the delivered `onStatement` recorder and `createBunSqliteStoreOpener`), including the `RAW-SEAM-TEXT` store that proves the reader returns stored text verbatim. Neither reimplements the composition order: `TC-MSG-008` computes its expectation with the delivered `composeDispatchMessage` and asserts the answer is equivalent to it, while `TC-MSG-010` observes the query applying that composition to the reader's raw return and `TC-MSG-011` observes the registered set arriving from the entrypoint.
- **The decoy planter.** Creates the five shell artifacts inside the temp checkout with canaries that mimic typed answers, fingerprints them, and re-compares after the run (bytes, mode, `mtimeMs`).
- **A read-failure store wrapper.** Fails only the `dispatch.lane` read with a named injected `state.*` code (the delivered `failAppendFor` pattern, read-side), so `TC-STATUS-008`, `TC-ISDEL-006`, and `TC-MSG-006` can prove the typed identity survives a read failure on every query that reads the lane while every other read stays real.
- **The answer-matrix registry.** `OPERATOR_MATRIX` is the single declaration of the twelve combinations and both forms; every operator suite imports its rows, so a suite cannot silently drop a lifecycle state or a mode (`TC-MATRIX-002`).

## 7. Automation Plan and Implementation Mapping

### 7.1 Battery architecture and seam exercise

**Six read/write seams plus two identifiers, each exercised through the function production uses.** The command definition, the CLI runtime, the projection, the state store, the lane ledger, and the opencode adapter are always the production ones.

| Seam | Production identity | Exercised by | What is real |
|------|--------------------|--------------|---------------|
| `S-laneview` | the lane-view fold: the repository filter applied to `readDispatchLanes` **before** `latestDispatchLaneFor`, joined with the probe verdict (mounted as the `status` surface) | `TC-STATUS-001`…`008`, `TC-ISDEL-*`, `TC-CONTRACT-003` | the bounded retained-window read, the filter-then-fold order, the repository filter, the absent answer, the typed read failure |
| `S-tail` | the artifact reader: addressed-directory listing, name-order stitching, torn-tail drop, split, tail selection, byte/line budget, truncation fact (mounted as the `log` surface) | `TC-LOG-001`…`012`, `TC-PERSIST-005`/`006` (read-back half executed at the phase-4 boundary; the ids stay phase 3's), `TC-PERSIST-009`, `TC-PERSIST-011` | the reading, the ordering, the tearing, the bounds, and the machine/human bound split |
| `S-fold` | the delivering fold over the lane view (both forms, mounted as the `is-delivering` surface) | `TC-ISDEL-001`…`007` | the fold, the filter-then-fold order, the stale exclusion, the 20-ref bound, the truncation |
| `S-transcript` | the injected adapter-owned transcript read; opencode's real reader in `packages/adapters/src/harness/**` under `session-introspection`, returning raw stored text under its own read cap | `TC-MSG-001`…`011` | the capability gate, the ladder, the raw return, the composition in the query, the registered set arriving from the entrypoint (`TC-MSG-011`), the reader's statements (via the built store) |
| `S-probe` | the injected advisory owner-liveness probe (`{processId, startedAt}` → `live`/`dead`/`unknown`) mounted at the composition edge | `TC-STATUS-004`, `TC-STATUS-005`, `TC-ISDEL-005` | the probe contract and the delivered mapping; the OS read is injected |
| `S-sink` | the per-stream raw-stdout observer bound beside `telemetrySinkFor` in `packages/adapters/src/harness/opencode.ts`, writing `dispatch-logs.<workspace>/<REF>/` | `TC-PERSIST-001`…`011` (`TC-PERSIST-005`/`006` write half at the phase-3 boundary; `TC-PERSIST-011` at the phase-4 boundary) | the adapter's line iteration, the writer, the segmentation, the retention |
| `S-cmd` | the `dispatch` command definition, its grammar, its `query` payloads, and its `exitProjection` | `TC-GRAMMAR-001`…`005`, `TC-MATRIX-001` | the definition, the projection, the envelope writer |
| `S-exec` | the guarded injected process runner | `TC-RO-003`, `TC-SHELL-002` | the counters and the refusals; 0 real starts |

`TC-MSG-011` additionally enters through the production entrypoint (`runEntrypoint`) instead of a directly composed program, because the credential set it proves is resolved there by `entrypointSecrets`; it is the only case that leaves the composed-program entry form, and it changes no seam identity — the same command definition, projection, and composition run either way.

**One registry, one battery.** `OPERATOR_MATRIX` (`tests/fixtures/dispatch/operator/matrix.ts`) declares the 12 lifecycle rows, both `is-delivering` forms, the five ladder rows, and both modes. `TC-MATRIX-001` drives the 12 lifecycle rows; `TC-NFR-001` and `TC-SHELL-002` drive the whole registry; the dedicated suites import their rows from it rather than re-expressing a scenario.

**Reimplementation detection (three mechanisms, all in `TC-FIXTURE-001`):** import identity through `SEAM_MANIFEST`; a forbidden-signature scan over `tests/conformance/dispatch`, `tests/behaviour/dispatch-operator-*`, and `tests/fixtures/dispatch/operator` for a local read decision (a local stitch/split/tail loop, a local `1_048_576`, a local 512 bound, a local verdict table, a local credential scrub); and a planted control that must be rejected by name. No case may satisfy itself with a fixture-written record: `controlled-repo.ts`'s provenance guard and "no ledger writer" surface stay intact, and the operator harness exposes no lane, attempt, or artifact-record writer.

### 7.2 Read-only and no-shell proof design

**(a) The read-only observation.** The counted store, the recording filesystem edge, and the transcript seam counter together make each declared read count a measurement: 1 lane read per query, ≤ 1 directory listing and ≤ 2 file reads for `log`, 1 transcript call for `last-message`, and 0 of everything else. The byte/mode/mtime snapshot (`snapshotStore`, `evidenceFiles`, `decoys.fingerprint`) makes "unchanged" a measurement rather than a promise; the deliberately over-retained third file makes "0 deletions" non-vacuous.

**(b) The static invariant, extended.** `scripts/checks/no-shell-dispatch.ts` gains the new surfaces:

- **Core modules join automatically by glob.** Every new `packages/core/src/{app,domain}/dispatch-*.ts` (the lane view, the tail reader, the delivering fold, the payload builders, the log bounds) is picked up by the existing glob-coherence assertion, which fails if a file exists but is not declared.
- **Fixed entries join explicitly.** The new adapter/host modules — `packages/adapters/src/file/dispatch-logs.ts` (the family writer/reader) and the opencode transcript reader module (or `packages/adapters/src/harness/opencode.ts` when the reader lives there) — and `packages/cli/src/output/dispatch-text.ts` (the human renderers) are added to both `DISPATCH_FLOW_SURFACE` and the check test's `FIXED_SURFACE` mirror, so a new read module can never be silently unscanned.
- **The rule set is unchanged and sufficient.** `R1` (script-path literals anchored on whole values, including substituted template paths) is exactly what catches a `deliver-ticket` mention creeping into a payload hint or a help string; `R2`/`R3`/`R4` already cover `shell: true`, shell-capable imports, and a `spawn` without `shell: false`.
- **New non-vacuity controls.** A planted script-path literal and a planted substituted template path in one of the newly declared files must be reported by rule and `file:line`; the false-positive controls grow by a payload string that mentions "dispatch" without a path, and by the existing `.sha`/`RegExp.exec`/port-`.spawn` controls which must stay clean.
- **The declaration is verified, not trusted.** `TC-SHELL-001` asserts surface existence, glob coherence, and reachability from the surface entries; `TC-FIXTURE-002` keeps the proof boundary a permanent constant.

**(c) The behavioural complement.** `TC-SHELL-002` sweeps the whole registry through the guarded runner (0 shell invocations, 0 script-path arguments, and a declared invoking-row set that must match the observed set). `TC-SHELL-003` runs every query in a checkout with no `scripts/` or `tools/` at all. `TC-SHELL-004` plants shell content engineered to look like typed answers and asserts the answers' provenance. The permanent source of the boundary is `OPERATOR_PROOF_BOUNDARY`; the published page is reconciled in the documentation phase (spec Appendix A) and guarded by the delivered doc checks, never by a case here.

### 7.3 File mapping (new vs extended)

| TC | Target file | Status |
|----|-------------|--------|
| `TC-MATRIX-001`, `TC-MATRIX-002`, `TC-NFR-001`, `TC-CONTRACT-002` (delivery-regression half) | `tests/conformance/dispatch/dispatch-operator-matrix.test.ts` | To implement (new) |
| `TC-STATUS-001`, `TC-STATUS-002`, `TC-STATUS-003`, `TC-STATUS-004`, `TC-STATUS-005`, `TC-STATUS-006`, `TC-STATUS-007`, `TC-STATUS-008` | `tests/conformance/dispatch/dispatch-operator-status.test.ts` | To implement (new) |
| `TC-LOG-001`, `TC-LOG-002`, `TC-LOG-003`, `TC-LOG-004`, `TC-LOG-005`, `TC-LOG-006`, `TC-LOG-010`, `TC-LOG-011`, `TC-LOG-012` | `tests/conformance/dispatch/dispatch-operator-log.test.ts` | To implement (new) |
| `TC-LOG-007`, `TC-LOG-008`, `TC-LOG-009` | `tests/behaviour/dispatch-operator-log-bounds.test.ts` (arithmetic, D3) + `dispatch-operator-log.test.ts` (command projection) | To implement (new) |
| `TC-ISDEL-001`, `TC-ISDEL-002`, `TC-ISDEL-003`, `TC-ISDEL-004`, `TC-ISDEL-005`, `TC-ISDEL-006`, `TC-ISDEL-007` | `tests/conformance/dispatch/dispatch-operator-isdel.test.ts` | To implement (new) |
| `TC-MSG-001`, `TC-MSG-002`, `TC-MSG-003`, `TC-MSG-004`, `TC-MSG-005`, `TC-MSG-006`, `TC-MSG-007`, `TC-MSG-009`, `TC-MSG-011` | `tests/conformance/dispatch/dispatch-operator-message.test.ts` | To implement (new) |
| `TC-MSG-008` | `tests/behaviour/dispatch-operator-message-composition.test.ts` | To implement (new) |
| `TC-MSG-010` | `tests/behaviour/dispatch-operator-transcript-opencode.test.ts` | To implement (new) |
| `TC-GRAMMAR-001`, `TC-GRAMMAR-002`, `TC-GRAMMAR-003`, `TC-GRAMMAR-005` | `tests/conformance/dispatch/dispatch-operator-grammar.test.ts` | To implement (new) |
| `TC-GRAMMAR-004` | `tests/structure/dispatch-operator-composition.test.ts` | To implement (new) |
| `TC-PERSIST-001`, `TC-PERSIST-002`, `TC-PERSIST-004`, `TC-PERSIST-009`, `TC-PERSIST-010`, `TC-PERSIST-011` | `tests/conformance/dispatch/dispatch-operator-persist.test.ts` (`TC-PERSIST-011` lands at the phase-4 boundary: its `dispatch log` step has no answer before the log surface exists) | To implement (new) |
| `TC-PERSIST-003`, `TC-PERSIST-005`, `TC-PERSIST-006`, `TC-PERSIST-007`, `TC-PERSIST-008` | `tests/behaviour/dispatch-operator-artifact-writer.test.ts` + `dispatch-operator-persist.test.ts` (`TC-PERSIST-005`/`006`: ids owned by phase 3; write half authored in phase 3, read-back half landed with the log suite in phase 4) | To implement (new) |
| `TC-RO-001`, `TC-RO-002`, `TC-RO-003`, `TC-RO-004`, `TC-SHELL-002`, `TC-SHELL-003`, `TC-SHELL-004` | `tests/conformance/dispatch/dispatch-operator-posture.test.ts` | To implement (new) |
| `TC-SHELL-001` | `tests/checks/no-shell-dispatch.test.ts` + `scripts/checks/no-shell-dispatch.ts` | Existing – update |
| `TC-CONTRACT-001`, `TC-NFR-002` | `tests/checks/operator-contract-invariance.test.ts` | To implement (new) |
| `TC-CONTRACT-002` (help half) | `tests/structure/dispatch-help-inventory.test.ts`, `tests/structure/dispatch-attempts-composition.test.ts`, and the delivered `tests/conformance/dispatch/**` battery | Existing – update (help counts 5 → 9) |
| `TC-CONTRACT-003` | `tests/behaviour/dispatch-additive-stability.test.ts` | Existing – update |
| `TC-NFR-003` | `tests/behaviour/dispatch-operator-latency.test.ts` | To implement (new) |
| `TC-NFR-004` | `tests/behaviour/dispatch-privacy.test.ts` | Existing – update |
| `TC-FIXTURE-001` | `tests/checks/operator-seam-identity.test.ts` + `tests/fixtures/dispatch/parity/seams.ts` | To implement (new) + existing – update |
| `TC-FIXTURE-002` | `tests/checks/operator-proof-boundary.test.ts` + `tests/fixtures/dispatch/operator/bounds.ts` | To implement (new) |
| `TC-FIXTURE-003` | `tests/checks/dispatch-operator-test-isolation.test.ts` | To implement (new) |

Split: **8 new conformance suites** (`dispatch-operator-{matrix,status,log,isdel,message,grammar,persist,posture}.test.ts`), **5 new behaviour suites** (`dispatch-operator-{log-bounds,artifact-writer,message-composition,transcript-opencode,latency}.test.ts`), **1 new structure suite** (`dispatch-operator-composition.test.ts`), **4 new checks suites** (`operator-contract-invariance`, `operator-seam-identity`, `operator-proof-boundary`, `dispatch-operator-test-isolation`), **9 new fixture modules** under `tests/fixtures/dispatch/operator/`, **5 extended suites** (`no-shell-dispatch`, `dispatch-help-inventory`, `dispatch-attempts-composition`, `dispatch-additive-stability`, `dispatch-privacy`) plus the delivered conformance battery re-run, **4 extended fixtures** (`parity/harness.ts`, `parity/lane.ts`, `parity/seams.ts`, `attempts-harness.ts`), and **3 extended harness-store files** (`opencode-store/build.ts`, `current-generation.ts`, `legacy-generation.ts`). Case-level split: **74 new cases, 0 superseded cases** — this change adds a surface and changes no delivered assertion except the two help-entry counts, which are updated deliberately and reviewed as part of the change.

**Phase boundaries, the two split cases, and `TC-PERSIST-011`.** Two cases carry an explicit internal split, because a read-back step cannot be green before the surface it reads exists: `TC-PERSIST-005` and `TC-PERSIST-006` run their **write half** at the phase-3 boundary (file sizes, boundary accounting, continuation) and their **read-back half** at the phase-4 boundary, where `dispatch log` exists. Both ids are **phase-3-owned** — the write half is what the phase-3 commit makes observable and gate-green — and the phase-4 execution of the read-back half is that boundary's cross-control, never a second owner. Neither half substitutes for the other's evidence.

`TC-PERSIST-011` is one case with one owner and no split: it is **phase-4-owned**, because its decisive observation is the answer `dispatch log` gives over the family, and that surface does not exist at the phase-3 boundary. **Phase 3 no longer runs it**; the write-path properties it also observes stay phase 3's, carried by `TC-PERSIST-002`/`005`/`006`/`007`/`008`.

Per-phase case counts follow from that allocation and the total is **74**: **phase 3 owns 9** (`TC-PERSIST-001`…`008`, `TC-PERSIST-010`), **phase 4 owns 14** (`TC-LOG-001`…`012`, `TC-PERSIST-009`, `TC-PERSIST-011`), with phase 4 additionally executing the read-back halves of `TC-PERSIST-005`/`006` as cross-controls that own no id, and the message surface is phase 5's (`TC-MSG-001`…`011`, including the credential-wiring case `TC-MSG-011`); the grammar, posture, and contract cases keep the phases their own rows declare. Both remediation cases are owned by the surface phase they exercise — the log phase for `TC-LOG-012`, the message phase for `TC-MSG-011` — and are landed, with their suites, by the review-remediation phase of the implementation plan, which re-runs the owning phase's suites.

### 7.4 Mutation register

Each row is a source mutation applied to the implementation; the named case must fail, with the expected failure-message family. `M` rows are the non-vacuity proof for the load-bearing invariants. The register is executed by the reviewer/fixer, not committed as a permanent suite (a permanent mutation harness belongs to review tooling; the permanent suite is the case list itself).

**Status fold and probe (M1–M10).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M1 | Derive `marker` from a planted marker file (or the shell's) instead of the lane state | `TC-STATUS-001`, `TC-RO-002`, `TC-SHELL-004` | `marker expected "active" from lane state, received "absent"` / `answer differs with the planted marker file` |
| M2 | Derive `marker` from the attempt record rather than the lane record | `TC-STATUS-003` | `marker expected "absent" for a ref with no lane, received "terminal"` |
| M3 | Fold the newest lane by ref first and filter the repository afterwards (or fold without any repository filter) | `TC-STATUS-006`, `TC-ISDEL-007` | `foreign repository record returned for GH-354` / `expected marker "terminal" from the local record, received "absent"` / `expected delivering=true from the local active record, received false` |
| M4 | Repair the stale lane (clear, rewrite, or re-record) before answering | `TC-STATUS-004`, `TC-RO-001` | `lane bytes changed: <n> appends` / `resume expected 1 call, received 0` |
| M5 | Treat `unknown` as `dead` | `TC-STATUS-005`, `TC-ISDEL-005` | `unknown probe expected delivering=true, received false` |
| M6 | Drop the 5 000 ms start-instant tolerance (pid equality only) | `TC-STATUS-005` | `probe expected "dead" for a start delta of 5001 ms, received "live"` |
| M7 | Ignore the observed start instant entirely and trust the pid | `TC-STATUS-005` | `reused pid expected "dead", received "live"` |
| M8 | Set `stale=true` for a terminal lane | `TC-STATUS-002` | `terminal lane expected stale=false, received true` |
| M9 | Adopt a `daemon.lane` as the dispatch lane | `TC-STATUS-006` | `daemon lane must not answer status; received session <id>` |
| M10 | Read the lane per record (unbounded) or issue a second read | `TC-STATUS-007`, `TC-RO-004` | `readRecords expected 1, received <n>` |

**Artifact read (M11–M23).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M11 | Split each file then concatenate the line lists (no stitch before split) | `TC-LOG-002`, `TC-PERSIST-006` | `continued value expected 1200000 bytes, received 2 fragments` |
| M12 | Read the newest file only | `TC-LOG-001`, `TC-LOG-008` | `expected 50 lines, received 40` / `window expected 2 files stitched, received 1` |
| M13 | Order the family by mtime instead of by name | `TC-LOG-001`, `TC-PERSIST-003` | `segment order expected name order, received mtime order` |
| M14 | List the family root (or glob) instead of the addressed directory | `TC-LOG-010`, `TC-LOG-001` | `listing outside <family>/GH-354/ observed: <path>` |
| M15 | Clamp `--tail` instead of refusing (`0` → 50, `501` → 500) | `TC-LOG-003` | `expected input.value.rejected for 0, received exit 0 with 50 lines` |
| M16 | Accept `01`, `1.5`, or `-1` as a canonical decimal | `TC-LOG-003` | `expected input.value.rejected for "01", received a tail` |
| M17 | Return the unterminated tail as content | `TC-LOG-009`, `TC-PERSIST-009` | `torn tail must not be returned: <fragment>` |
| M18 | Drop any file's last line, complete or not | `TC-LOG-009` | `complete file's last line expected present, received dropped` |
| M19 | Answer `no-log` when a file exists but holds no complete line | `TC-LOG-005` | `expected available=true, received reason=no-log` |
| M20 | Map an unreadable file to `no-log` at exit 0 | `TC-LOG-006` | `expected reason=unreadable at exit 1, received no-log at exit 0` |
| M21 | Emit two truncation objects, or omit `omittedLines` | `TC-LOG-007`, `TC-LOG-008`, `TC-LOG-012` | `expected exactly one truncation fact, received <n>` |
| M22 | Present a short retained window as complete, or bound the machine answer by the human line count | `TC-LOG-008`, `TC-LOG-012` | `short window expected one tail truncation fact, received none` / `machine window expected 220 lines, received 200` |
| M23 | Delete a file (or tidy the family) to satisfy the request | `TC-RO-001` | `artifact family deletion observed: <path>` |

**Delivering fold (M24–M28).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M24 | Project a terminal or absent lane to exit 0 | `TC-ISDEL-002`, `TC-MATRIX-001` | `expected exit 1 for a terminal lane, received 0` |
| M25 | Answer around an unreadable lane store — a fabricated `delivering=false` at exit 1, or `marker="absent"` at exit 0 — or project the failure from the `state` kind instead of the row | `TC-ISDEL-006`, `TC-STATUS-008` | `expected kind state.store.torn at exit 2, received a data answer with delivering=false` / `status answered marker=absent for an unreadable store` / `expected exit 1 for state.permission.denied, received 2` |
| M26 | Let a stale lane answer in progress | `TC-ISDEL-005` | `stale lane expected delivering=false, received true` |
| M27 | Attach a `refs` list to the per-ref answer | `TC-ISDEL-001` | `per-ref payload must not carry refs` |
| M28 | List every delivering ref (no 20 bound, no truncation fact) | `TC-ISDEL-004` | `refs expected 20 with one truncation fact, received 25 with none` |

M25 names only the two phase-2 cases (`TC-STATUS-008`, `TC-ISDEL-006`), so its allocation is the phase-2 boundary and nothing here pushes it to a later phase. `TC-MSG-006` proves the same property for `last-message` at its own phase boundary, but this row does not name it and its failure messages do not depend on it.

**Message read (M29–M36).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M29 | Compose the envelope's synthesized `lastMessage` | `TC-MSG-002` | `expected the transcript's assistant text, received the synthesized summary` |
| M30 | Read an attempt record or the derivation payload for the message | `TC-MSG-002` | `unexpected read of dispatch.attempt` / `poisoned attempt read fired` |
| M31 | Reorder the ladder (`session-unknown` before `capability-gap`) | `TC-MSG-009` | `expected capability-gap, received session-unknown` |
| M32 | Call the transcript seam for a gapped harness | `TC-MSG-005`, `TC-MSG-009` | `transcript seam calls expected 0 for a Claude lane, received 1` |
| M33 | Bound before redacting, or compose inside the reader (flatten or bound in the adapter read instead of in the query) | `TC-MSG-008`, `TC-MSG-010`, `TC-MSG-011` | `credential prefix survived the cut: <fragment>` / `seam returned a composed value: expected RAW-SEAM-LINE-1\n…, received a single redacted line` |
| M34 | Set `truncated` from the pre-redaction length | `TC-MSG-008`, `TC-MSG-011` | `truncated expected false, received true` (post-redaction fits) |
| M35 | Set `final=true` on an active lane | `TC-MSG-003` | `active lane expected final=false, received true` |
| M36 | Perform a session operation (`collect`, `session-list`, `resume`) | `TC-MSG-007` | `session operations expected 0, received 1 (<op>)` |

**Grammar and projection (M37–M41).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M37 | Emit a delivery `result` token in a query payload | `TC-GRAMMAR-005`, `TC-GRAMMAR-001` | `payload must not carry result` |
| M38 | Answer an uncomposed surface with an empty success | `TC-GRAMMAR-004` | `expected input.value.rejected, received exit 0` |
| M39 | Introduce a numeric exit literal in the command | `TC-CONTRACT-001` | `exit-code-literals: call-site literal outside the projection module` |
| M40 | Accept a non-canonical ref (`gh-354`, `GH354`) | `TC-GRAMMAR-002` | `expected input.value.rejected for "gh-354", received a payload` |
| M41 | Append a lane or attempt record from a query | `TC-GRAMMAR-005` | `append expected 0, received 1 (<kind>)` |

**Write path (M42–M53).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M42 | Bind the sink after the first value (or only at session acquisition) | `TC-PERSIST-001` | `file absent at the stream's first value` |
| M43 | Create the file lazily at the first append | `TC-PERSIST-001` | `file absent at the stream's first value` |
| M44 | Write values without the trailing LF (append verbatim) | `TC-PERSIST-002` | `file must hold only LF-terminated records` |
| M45 | Route the sink at the decoded-frame seam instead of the raw lines | `TC-PERSIST-002` | `undecodable value missing from the artifact` |
| M46 | Drop a value larger than the cap instead of continuing it | `TC-PERSIST-006` | `reconstructed value expected 1200000 bytes, received <n>` |
| M47 | Off-by-one at the exactly-filling boundary (drop or duplicate a byte) | `TC-PERSIST-005` | `segment concatenation differs at byte <n>` |
| M48 | Modify written bytes to make room (trim, rewrite, truncate) | `TC-PERSIST-008` | `non-append write observed: <op> at offset <n>` |
| M49 | Remove the oldest before the new file exists, or retain one/three files | `TC-PERSIST-007` | `removal before creation observed` / `retained set expected 2, received <n>` |
| M50 | Derive file names from a shared counter or from mtime | `TC-PERSIST-003` | `lexical order differs from creation order` |
| M51 | Share one file between two streams or two refs | `TC-PERSIST-004` | `two refs share <path>` / `two streams share <path>` |
| M52 | Let a sink fault change the token, exit, records, or evidence | `TC-PERSIST-010` | `token expected pr-open, received <token>` / `evidenceRefs gained <ref>` |
| M53 | Bind a sink or create a directory for a one-shot adapter | `TC-PERSIST-004` | `sink bound for a one-shot lane` |

**Read-only and no-shell (M54–M59).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M54 | Create or re-persist the identity marker from a query | `TC-STATUS-007`, `TC-RO-001` | `identity marker written by a read` |
| M55 | Read the shell's `<REF>.last-message` for the message | `TC-RO-002`, `TC-SHELL-004` | `shell artifact read observed: <path>` / `expected TYPED-REAL-MESSAGE, received SHELL-DECOY-MESSAGE` |
| M56 | Read the shell's `<REF>.log` for the tail | `TC-LOG-001`, `TC-RO-002` | `answer contains SHELL-LOG-CANARY` |
| M57 | Plant a script-path literal in a new surface | `TC-SHELL-001` | `no-shell invariant: script-path literal at <file>:<line>` |
| M58 | Invoke a shell from a query | `TC-SHELL-002`, `TC-RO-003` | `shell invocation recorded: <file> <args>` |
| M59 | Perform a live network read | `TC-RO-003`, `TC-NFR-001` | `live transport request observed: <url>` |

**Contract, bounds, and machinery (M60–M68).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M60 | Add a harness operation, lifecycle capability, or gap reason | `TC-CONTRACT-001` | `closed surface changed: HARNESS_OPERATIONS +<member>` |
| M61 | Change a declared bound by editing a duplicated literal or by reusing the attempts human constants | `TC-CONTRACT-001`, `TC-NFR-002` | `bound <name> has <n> homes` / `DISPATCH_MAX_HUMAN_LINES expected 40, received 200` |
| M62 | Add a configuration key for the cap, tail range, or tolerance | `TC-NFR-002`, `TC-CONTRACT-001` | `configuration key set changed: +<key>` |
| M63 | Add a `dispatch.lane` or attempt-record field | `TC-CONTRACT-001`, `TC-CONTRACT-003` | `lane key set changed: +<field>` / `pre-change record failed to decode` |
| M64 | Change a delivered dispatch token or its exit | `TC-CONTRACT-002` | `delivered dispatch token expected <t>, received <t'>` |
| M65 | Drop a help entry, or introduce a fifth reference page | `TC-CONTRACT-002` | `dispatch help entries expected 9, received <n>` / `coverage inventory changed` |
| M66 | Reimplement the tail reader or the fold inside a battery file | `TC-FIXTURE-001` | `reimplementation of <seam> in <file>` |
| M67 | Add, drop, or reorder a proof-boundary id | `TC-FIXTURE-002` | `proof boundary drift: <control>` |
| M68 | Introduce nondeterminism (an ambient clock, a random id, or an unordered ref list) | `TC-NFR-001` | `run 1 and run 2 differ: <field>` |

Total: **68 mutations**, M1–M68 contiguous (10 status + 13 artifact read + 5 delivering + 8 message + 5 grammar + 12 write path + 6 read-only/no-shell + 9 contract/bounds/machinery). Every load-bearing invariant named in §1 has at least one row, and every row names the case that must fail.

### 7.5 Gate battery

Every command runs from the repository root with the ticket's environment prerequisites, because the lifecycle primitives (and the `commit` primitive in particular) probe the bare `commitlint` name and must not write outside the approved temp root, and because the workspace packages are unbuilt until `pnpm build` runs:

```bash
mkdir -p tmp/tmpdir
export TMPDIR=$PWD/tmp/tmpdir
export PATH=$PWD/node_modules/.bin:$PATH
pnpm build
```

**Gates this test plan requires (run during delivery, after the relevant phase):**

```bash
# 1. The operator battery (all new conformance suites, matrix and posture included)
bun test tests/conformance/dispatch

# 2. The targeted behaviour and structure extensions
bun test tests/behaviour/dispatch-operator-log-bounds.test.ts \
         tests/behaviour/dispatch-operator-artifact-writer.test.ts \
         tests/behaviour/dispatch-operator-message-composition.test.ts \
         tests/behaviour/dispatch-operator-transcript-opencode.test.ts \
         tests/behaviour/dispatch-operator-latency.test.ts \
         tests/behaviour/dispatch-additive-stability.test.ts \
         tests/behaviour/dispatch-privacy.test.ts \
         tests/structure/dispatch-operator-composition.test.ts \
         tests/structure/dispatch-help-inventory.test.ts \
         tests/structure/dispatch-attempts-composition.test.ts

# 3. The static invariants, directly (each must exit non-zero and name the rule on a violation)
bun run scripts/checks/no-shell-dispatch.ts
bun run scripts/checks/exit-code-literals.ts

# 4. The invariant, contract, and fixture-integrity suites
bun test tests/checks/no-shell-dispatch.test.ts \
         tests/checks/operator-contract-invariance.test.ts \
         tests/checks/operator-seam-identity.test.ts \
         tests/checks/operator-proof-boundary.test.ts \
         tests/checks/dispatch-operator-test-isolation.test.ts \
         tests/checks/help-guide-coverage.test.ts

# 5. The delivered dispatch parity battery (the write-path regression, TC-CONTRACT-002)
bun test tests/conformance/dispatch/dispatch-e2e.test.ts \
         tests/conformance/dispatch/dispatch-parity-battery.test.ts \
         tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts \
         tests/conformance/dispatch/dispatch-parity-admission.test.ts \
         tests/conformance/dispatch/dispatch-parity-tracker.test.ts \
         tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts \
         tests/conformance/dispatch/dispatch-parity-spawn.test.ts \
         tests/conformance/dispatch/dispatch-parity-no-shell.test.ts

# 6. Hygiene before every commit
git diff --check
```

The determinism gate needs no separate command: `TC-NFR-001` runs the whole registry twice inside the suite and compares canonical output, and `TC-RO-003`/`TC-SHELL-002` assert the zero-live-call counters. Re-running step 1 is the manual cross-run check.

**Gates owned by the lifecycle quality phase (phase 9), not by this plan's delivery-time battery:**

```bash
# The aggregate: lint → format:check → typecheck → test → check:boundaries → check:memory → prompt/help/exports
TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH pnpm check

# The branch-range commit-message gate (needs the branch's own commit range, so it only exists at PR time)
./scripts/lint-commit-range.sh --base origin/main-tools
```

Rationale for the split: `pnpm check` also builds, typechecks, and runs every unrelated suite, so it is the phase-9 aggregate rather than a per-phase loop; the range gate asserts the change branch's own commit messages against `origin/main-tools`, which is a delivery-lifecycle property, not a test-plan property. Both are recorded in the pm-notes (`DOD-2`, `DOD-3`); a `FAIL` is remediated in the mode the gate names and an unresolved `ERROR` is never recorded as a pass. The documentation-phase gates (`bun test tests/checks/doc-conformance.test.ts`, `bun test tests/checks/dispatch-doc-conformance.test.ts`, the stale "the typed path has no status/log surface" scan, and `bash scripts/.tests/test-doc-distribution.sh` when a redistributable page changes) belong to the system-spec-update phase (`DOD-7`).

### 7.6 Non-functional verification

**Offline determinism (`NFR-7`, `DOD-4`).** Two runs of the whole registry in isolated roots with a fixed clock, a fixed id sequence, a fixed probe/transcript sequence, and canonicalization that normalizes only the temp root and generated ids. Assertions: canonical payload JSON byte-identical; identical exits for all 12 combinations; identical per-row read counts; `liveNetworkRequests === 0`; `realChildStarts === 0`; `liveProcessTableReads === 0`; the injected transport saw every request.

**Read budgets (`NFR-1`, `DOD-6`).** `TC-RO-004` asserts the declared counts per query: 1 lane read; ≤ 1 listing and ≤ 2 file reads for `log`; 1 transcript call for `last-message`; 0 of everything else. `TC-STATUS-007` asserts the retained-window bound actually applied over a 5 000-record store.

**Log bounds (`NFR-3`).** Exact assertions: every file ≤ 1 048 576 bytes including its LF; the family ≤ 2 097 152 bytes after a successful removal; `--tail` default 50 and range 1..500 refused-not-clamped; machine `data` ≤ 65 536 bytes **and bounded by bytes only** — a 220-line retained window under that budget is returned whole with one `tail` fact whose `bound` is 220, while the same request in the human form returns 200 lines with its own `tail` fact; human ≤ 200 lines and ≤ 32 768 bytes; exactly one truncation fact per binding bound, with `bound` and `omittedLines`, and a `scope` naming the bound that bound — `bytes` for a byte bound (machine `data`, or the human 32 768-byte bound) and `tail` for a shorter line count, including the human 200-line bound. `TC-NFR-002` asserts each constant has one home and the family bound is derived from the retained count.

**Message fidelity and bounds (`NFR-8`, `DOD-5`-adjacent).** The answer equals the transcript's final assistant message; the adapter read returns the stored text verbatim under its own read cap and the **query** performs redact → flatten → bound → mark (composition order observable: a straddling credential fully removed, `truncated` from the post-redaction length); ≤ 512 characters single line; `capability-gap` exactly for a gapped harness and never for opencode; 0 session operations and 0 process starts. The set redacted with is the invocation's registered credential set — resolved once by `entrypointSecrets` in the CLI entrypoint from the declared references and the injected environment, not injected by the fixture and not the `registerEdgeSecrets` path that serves `blockers`/`steer`.

**Staleness honesty (`NFR-9`).** `stale` only for active ∧ dead; `unknown` never stale; 5 000 ms boundary selection; 0 unrelated pids reported live; 0 lane repairs.

**Reference scoping (`NFR-4`).** 0 listings outside the addressed directory; 0 foreign lines; 0 foreign or daemon lanes in either `is-delivering` form; `absent` rather than a foreign record — and, because the lane key carries no repository component, the filter precedes the fold, so a **newer** foreign record for the same ref neither decides a local answer nor turns one into `absent`.

**Privacy (`NFR-11`).** The two-privacy-assertion split TDR-0058 requires, with separate fixtures: (a) an artifact canary that appears verbatim in the file and nowhere in any record; (b) a credential canary that is `[redacted]` in the message answer; (c) a prompt-only canary that appears in the artifact nowhere. The engine writes no prompt, diff, credential, tool argument, or provider payload; the message is never written by the engine.

**Contract and configuration invariance (`NFR-5`, `DOD-8`).** The pinned baseline comparison of `TC-CONTRACT-001`: 0 new or changed tokens, projections, exits, error rows, domain kinds, attempt/lane fields, schema versions, or configuration keys; 7 operations and 4 lifecycle capabilities unchanged; the attempts human bounds unchanged; the family help entries 5 → 9 with an unchanged coverage inventory.

**Query latency (`NFR-10`).** p95 ≤ 1 000 ms per query over the 5 000-record reference store, measured 10 times per query after a warm-up with the delivered read-side convention, environment recorded.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Mitigation in this plan |
|------|--------|--------------------------|
| The battery proves fixtures, not behaviour (`RSK-11`) | H | Every case names the production seam it exercises; `S-sink` cases run the real opencode adapter over the scripted starter; `TC-MSG-010` runs the real reader over a built store; `TC-FIXTURE-001` rejects a reimplementation by name. |
| A test becomes the second implementation | H | `TC-FIXTURE-001` import identity + forbidden-signature scan + planted control; D3 is limited to byte/line arithmetic over the real exports and never re-expresses a read decision; `TC-MSG-008`'s expectation is computed by the delivered `composeDispatchMessage` and asserted for equivalence, not re-derived in the test. |
| The twelve-combination sweep silently shrinks | H | `OPERATOR_MATRIX` is the only declaration and `TC-MATRIX-002` asserts its completeness, uniqueness, and drift detection; the matrix case enumerates nothing itself. |
| The "file exists before the first value" assertion is vacuous | H | The scripted starter asserts at its **first pull**, and `TC-PERSIST-001` additionally asserts the sink-binding order on all three stream kinds; a sink bound at the first append fails `M42`/`M43`. |
| Timing flakiness | M | No wall-clock assertion except `TC-NFR-003`'s recorded p95; the probe, the clock, and the delay are injected; the concurrent-stream ordering is a fixed name-order property, not a scheduler race. |
| The file-identity assertions flake on a coarse filesystem | M | No read writes anything, so `mtimeMs` cannot change; the comparison asserts equality only (never a delta), and the modes are read back from the same `stat` call used to fingerprint. |
| A log test passes while the real adapter's line iteration differs | H | `TC-PERSIST-002` drives the real adapter (`S1`) and compares the artifact with both the yielded values and the telemetry frame sink, so a sink wired to the decoded frames fails. |
| The human-bound constants are implemented by editing the attempts constants | H | `TC-LOG-007` asserts the log-specific bounds and `TC-CONTRACT-001` pins the attempts bounds (40/8192), so the cheap implementation fails both. |
| The stale-lane answer is "fixed" by porting the shell's self-healing | H | `TC-STATUS-004` compares the ledger byte-for-byte and asserts resumability afterwards; `M4` is the row that must fail. |
| The message test passes on a value comparison while reading the wrong source | H | `TC-MSG-002` poisons the attempt read and removes the derivation payload, so provenance — not only value — is asserted. |
| The repository filter is applied after the fold, so a newer foreign record decides a local answer | H | `TC-STATUS-006` and `TC-ISDEL-007` seed a newer foreign record under the **same** `dispatch.lanes:<ref>` key and assert the local record answers in both directions (`terminal` local under a newer foreign `active`, and `active` local under a newer foreign `terminal`); `M3` is the row that must fail. |
| The composition lives in the wrong layer — the reader flattens/bounds, or the query trusts a fixture-local scrub | H | `TC-MSG-010` asserts the seam's byte-identical raw return and the query's composed answer over the same real stores; `TC-MSG-011` proves the registered set arrives from the production entrypoint (seeded only through `environment` and the declared references) and is redacted before the cut; `TC-MSG-008` asserts the order under an explicitly registered set and fails when it is absent; `TC-FIXTURE-001` rejects a local credential scrub by name. |
| A deliberate delivery-path change is "fixed" by editing a delivered expectation | H | `TC-CONTRACT-002` compares against the delivered baselines; the review checklist requires any changed delivered assertion to cite the spec clause (`§8.5`, `NG-2`, `NG-3`) that authorises it. The two help counts are the only permitted edit and are reviewed as part of the change. |
| The no-shell surface list silently omits a new read module | H | The glob-coherence assertion plus the `FIXED_SURFACE` mirror plus the reachability guard (`TC-SHELL-001`); a new core `dispatch-*.ts` that is not declared fails by name. |
| The decoy fixtures make the shell-independence claim circular | M | `TC-SHELL-004` asserts content provenance (typed canaries vs shell canaries), not only file identity, and the recording filesystem edge reports every attempted path. |

### 8.2 Assumptions

1. The composition accepts four additive, non-operator injection facts: the owner-liveness probe, the transcript read, the artifact-family root with its filesystem edge, and the clock. This is the testability consequence of `API-8`/`API-9`/`API-10` plus `DEC-7` ("the production composition supplies all four"), not a new requirement; it adds no configuration key (`NFR-5`/`M62`).
2. The owner-liveness probe is injected at the composition edge, exactly as the delivered harness/git/provider seams are; the OS process-table read is not exercised (`API-10`).
3. The scripted streaming starter is pull-based, so its generator can observe the family at the instant of the first value. This is the delivered `HarnessSpawnStream.lines` contract (`AsyncIterable<string>`), not a new one.
4. The opencode transcript reader is reachable offline over a built store through the delivered read-only opener and its `onStatement` recorder, as the delivered telemetry extractor already is.
5. `--tail` joins the definition's declarative value vocabulary (`requiresValue`), because the family's delivered unknown-flag guard refuses any flag outside `flags`/`requiresValue`; a missing value is therefore a parser refusal (`fallback.invocation`) while an invalid value is a handler refusal (`input.value.rejected`).
6. The log's human bounds (200 lines / 32 768 bytes) are new, log-specific constants; the attempts bounds (40/8192) stay unchanged (`DM-6`, `NFR-5`).
7. The family's `positionals.max` stays 3, so an extra positional up to that bound is a handler refusal and a fourth positional is a parser refusal (§8.3).
8. `status`'s human key order, the `log` truncation line's exact rendering, and the closed reason summaries' wording are fixture-decided (spec Appendix D) and are asserted only for key **presence**, never for order or wording.
9. The delivered `latestDispatchLaneFor` filters by ref only, so the repository filter is a new assertion in this change (`AC-F1-6`, `NFR-4`), not a delivered behaviour.
10. The change folder's `tmp/` is git-ignored; no fixture writes outside `tmp/tmpdir`, and the operator's real state directory, `tmp/deliver-ticket/`, and `.ai/local/delivery/` are never touched.
11. The registered-credential set is a **delivered** resolution, not a new injection: `entrypointSecrets` in `packages/cli/src/entrypoint.ts` unions the invocation's `secrets` with the value of every declared `credentialReferences` entry read from the injected `environment`, and `runEntrypoint` passes it into the composed program, which hands it to the dispatch command runtime and so to the `last-message` read. `registerEdgeSecrets` stays the `blockers`/`steer` path and is not the operator path. The operator composition consumes the same invocation fact, so `AC-F4-7`'s redaction-before-bound is observable end to end (`TC-MSG-011`) without a fixture-local scrub and without a configuration key (§6.2, fact 5).

### 8.3 Open Questions

1. **`AC-F5-2`'s extra-positional shape versus the delivered parser bound (non-blocking, needs a ruling).** `AC-F5-2` requires "an extra positional" to be `input.value.rejected`. With the family's delivered `positionals: { max: 3 }`, `dispatch status GH-354 extra` (two positionals) is a handler refusal as required, but a fourth positional is refused by the shared parser as `fallback.invocation` before the handler runs. `TC-GRAMMAR-002` asserts the handler-level shape and records this distinction rather than weakening the AC. Resolution needed at the readiness gate: either (a) accept the AC as applying up to the definition bound (the plan's current reading, and the case keeps the stronger observable), or (b) require the definition to refuse an excess positional with the handler identity, which would mean changing the shared parser's refusal for one family — a contract change this change does not make. Owner: `@pm` at the DoR gate; the plan's default is (a) with the divergence recorded here.
2. **`--tail` with a missing value (non-blocking, decided by the parser's contract).** `AC-F2-2` lists invalid values, not missing ones. The delivered parser answers `fallback.invocation` for a missing value because the flag is declarative. `TC-LOG-003` asserts that identity explicitly instead of silently expecting `input.value.rejected`. Owner: `@pm` if the DoR gate prefers the handler to own a missing value too.
3. **Where the transcript reader module lives (implementation-decided, bounded).** Whether the opencode reader is a new adapter module or an addition to `packages/adapters/src/harness/opencode.ts` changes only which fixed entry joins the no-shell surface list (`TC-SHELL-001`) and which module `SEAM_MANIFEST` names (`TC-FIXTURE-001`); it changes no case's assertion. Owner: `@coder`, carried into the implementation plan.
4. **The one-shot lane's `no-log` when a *stale* artifact directory exists from a prior streaming harness.** The spec decides the absent-directory case; a ref delivered by opencode and later dispatched by Claude Code would have a directory but no new stream. No AC covers it, so this plan asserts no behaviour for it: `TC-LOG-004` covers only the absent-directory row, and `TC-LOG-001` asserts the reader contract for whatever family exists. The implementation must record the chosen reading in the plan phase. Owner: `@coder`; not a test-plan gap.
5. **The adapter read cap's size (implementation-decided, bounded, non-blocking).** `TC-MSG-010` asserts the reader returns stored text **verbatim under its own read cap** and that the query composes, but it does not pin the cap's value: spec Appendix D leaves the read cap to the adapter as that read's own storage bound for retrieving the stored text — it is **not** the message bound and must not be a cut below 512 characters, because the 512-character bound and the single-line flattening happen only in the query's composition after redaction. The case's raw-return fixture is sized to fit any declared cap, so whichever value the implementation chooses, the assertion holds. Owner: `@coder`; carried into the implementation plan, not a coverage gap.

The one gap this plan cannot close alone: the five declared composition facts of §6.2 (the four additive operator facts of assumption 1 plus the delivered credential set of assumption 11) and the sink construction points of `API-8` are production-code changes the implementation plan must carry in an early phase, otherwise `TC-PERSIST-*`, `TC-MSG-*`, `TC-STATUS-*`, and `TC-ISDEL-*` have no honest seam to drive. If the implementation plan drops them, this plan's coverage becomes unachievable and must be reopened at the readiness gate rather than downgraded to a fixture-local reimplementation.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-11-19 | @test-plan-writer | Initial test plan for GH-354 against the change specification and TDR-0058: 71 cases in twelve groups (`MATRIX` 2, `STATUS` 7, `LOG` 11, `ISDEL` 7, `MSG` 10, `GRAMMAR` 5, `PERSIST` 11, `RO` 4, `SHELL` 4, `CONTRACT` 3, `NFR` 4, `FIXTURE` 3), 38/38 AC traceability (0 unmapped, 0 orphan, 83 links across 59 cases), the answer-matrix registry and its anti-drift case, the read-side driver discipline (D1 composed program, D2 definition over an injected runtime, D3 read-side production functions, S1 the real opencode adapter), the fixture inventory (9 authored modules, 4 extended fixtures, 3 extended store files, 5 extended suites), the extension of the no-shell invariant to the new surfaces with its planted and decoy controls, the 68-row mutation register (M1–M68), the gate battery with the `TMPDIR`/`PATH`/`pnpm build` conventions, the non-functional verification, the Appendix C proof boundary as a permanent fixture constant, and the three declared testability readings of §8.3. |
| 0.2 | 2026-11-19 | @test-plan-writer | DoR-remediation delta (F1/F3/F5, A4/A5/A6). Added `TC-STATUS-008` (a lane-store failure on `status` keeps its typed `state.*` identity instead of `marker=absent`) — case total 71 → 72, `STATUS` 7 → 8, 38/38 AC traceability unchanged at 83 links across 59 cases. Extended `TC-STATUS-006` and `TC-ISDEL-007` with the fold-order fixture: a newer record for the same ref under another repository shares `dispatch.lanes:<ref>` with an older local record, so both queries must answer from the local record in both directions (per-ref and ref-less forms), never `absent` and never the foreign facts. Named the injected state code in `TC-ISDEL-006`/`TC-MSG-006` (`state.store.torn` → exit 2) and recorded why the code must be named (`state.permission.denied` → exit 1); corrected the §3.3 exit-literal claim accordingly. Declared the registered-credential set as the fifth composition fact in §6.2 with its owning phase (5) and its supply point (`registerEdgeSecrets` in `packages/cli/src/edge.ts` → the composer's `secrets`), asserted by `TC-MSG-008` and assumption 11. Fixed `TC-MSG-010` so the seam returns stored text verbatim under its own read cap and the **query** performs redact → flatten → bound → mark. Split `TC-PERSIST-005`/`006` into an explicit phase-3 write half and a phase-4 read-back half, matching the plan's `SPLIT CASES` allocation, with the ids phase-3-owned and phase 4 executing the read-back assertions. Mutation register stays 68 rows: `M3`, `M25`, and `M33` were widened to name the new observations without moving a row's owning phase. |
| 0.3 | 2026-11-19 | @test-plan-writer | DoR-remediation delta (iteration 2), against spec **v1.4**. **`TC-PERSIST-011` moved off the write phase**: it is now phase-4-owned (the log phase) because its decisive observation is what `dispatch log` answers over the family, and that answer does not exist at the phase-3 boundary; phase 3 no longer runs it. Updated its index row, its `Plan Phase(s)` label, its steps (a fourth step runs `dispatch log --tail 50` over the family), its Notes, the `S-tail`/`S-sink` rows of §7.1, the §7.3 file mapping and phase-boundary paragraph, and the new per-phase counts (phase 3 = 9, phase 4 = 13, plus the two read-back halves executed at phase 4; total unchanged at 72). **One owner for `TC-PERSIST-005`/`006`**: both are **phase-3-owned** everywhere — the write half asserted at the phase-3 boundary, the read-back half executed at the phase-4 boundary as a cross-control that owns no id. Every place that said "phase-4-owned" now says otherwise (§5.1 rows were already correct; the two `Plan Phase(s)` lines, both Notes, §7.1, §7.3, and this log). **`TC-LOG-007` scope declared explicitly**: the 32 768-byte human fixture binds the byte bound, so its truncation fact is `scope: "bytes"` with `bound: 32768`, while the 200-line human bound is a `tail`-scope fact and the fixture that binds it asserts `scope: "tail"` — both directions asserted, per the spec's precedence. **`M25` recorded as naming only the two phase-2 cases** (`TC-STATUS-008`, `TC-ISDEL-006`), leaving its allocation to the phase-2 boundary. **Version references** now cite spec v1.4 in §2. No case id added, renamed, or superseded: 72 cases, 38/38 ACs, 83 links across 59 cases, 0 unmapped, 0 orphan. |
| 0.4 | 2026-11-20 | @test-plan-writer | Review-remediation delta: registers the two cases the shipped suites already carry and reconciles the credential prose. **`TC-LOG-012` added** — a 220-line retained window under `--json --tail 500` is returned whole (220 lines) with exactly one `tail`-scope fact whose `bound` is 220, the retained window, because the machine `data` is bounded by 65 536 bytes only, while the human form still caps at 200 lines with its own `tail` fact; linked to `AC-F2-5`, `API-2`, `DM-6`, `NFR-3` and owned by the log phase. **`TC-MSG-011` added** — the credential is seeded only through `environment: { GITHUB_TOKEN }` plus `credentialReferences: DECLARED_CREDENTIAL_REFERENCES` and routed through the real `runEntrypoint`, so a credential straddling the 512-character cut is absent from both the `--json` and the human answer while the surrounding prose survives with `truncated` at the post-redaction bound; linked to `AC-F4-7`, `AC-F4-1`, `API-4`, `API-9`, `NFR-8` and owned by the message phase. Counts re-derived: cases **72 → 74** (`LOG` 11 → 12, `MSG` 10 → 11), AC→case links **83 → 86** across **61** cases (38 criteria plus 48 extra observations; the two cases add three links, `AC-F2-5` +1, `AC-F4-1` +1, `AC-F4-7` +1), 38/38 ACs, 0 unmapped, 0 orphans, 0 cases without a link. **Stale credential prose reconciled**: §6.2 fact 5, §5's D1 driver, §6.1's harness row, §7.6 and assumption 11 now state that the registered set is resolved once by `entrypointSecrets` in the CLI entrypoint from the declared references and the injected `environment` and travels as an invocation fact into the dispatch runtime, while `registerEdgeSecrets` remains the `blockers`/`steer` path and is not the operator path; `TC-MSG-008`'s block, the §6.2 transcript-doubles bullet, and the §8.1 risk row now record that its expectation is computed with the delivered `composeDispatchMessage` and asserted for equivalence, not with the `redact` chokepoint. Named the two cases in the §3.2/§3.3 coverage rows, the ticket-AC table, §5.1/§5.2, §7.1, §7.3 (file mapping and phase allocation: phase 4 owns 14, the message surface is phase 5's, total 74) and the mutation rows `M21`/`M22`/`M33`/`M34` (register unchanged at 68). **Decision-record renumbering**: every reference to this change's record moves `TDR-0056` → `TDR-0058`, because GH-348's main-tools sync claimed `TDR-0056`/`TDR-0057`; all 36 references in this file meant our record, and no loop-supervision reference exists here. |

## 10. Test Execution Log

Populated during delivery. One row per case group; the battery is run whole before each phase boundary.

| TC ID(s) | Run Date | Result | Notes |
|----------|----------|--------|-------|
| — | — | Not run | Awaiting delivery |
