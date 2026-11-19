---
id: chg-GH-348-test-plan
status: Proposed
created: 2026-11-19
last_updated: 2026-11-19
owners: ["engineering"]
service: "delivery-os supervision engine (CEO outer loop)"
labels: ["loop", "supervision", "parity", "m4-s10", "flip-f3", "ceo", "lifecycle"]
version_impact: minor
summary: "Offline, deterministic battery for the typed CEO outer loop: five verbs with the shell's six status keys, the CEO spawn identity and per-spawn binding, the two-signal stuck verdict with the delivered delivery corroborator, identity-verified termination, the bounded backoff with the delivered per-epoch budget, the durable identity-scoped stop, the bounded log, single instance with session re-find, the pick-deliver-merge cycle, and the permanent nine-proven / six-not-proven boundary with an extended no-shell invariant — 74 cases across 10 groups mapped to all 41 acceptance criteria."
links:
  change_spec: ./chg-GH-348-spec.md
  implementation_plan: ./chg-GH-348-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M4-S10: CEO loop supervision inside jaiship — the `loop` family over the delivered supervision engine (M4)

## 1. Scope and Objectives

This plan protects the contract that makes the outer delivery loop a `jaiship` command rather than a shell script, and it protects the delivered engine it composes. The properties that must not break are: the five shell verb surfaces and their six status keys; a stop that is durable across a restart, a crash, and a fresh process because it names a loop identity rather than a process; a stuck verdict that requires **two** readable signals, so a CEO blocked on a healthy delivery is never killed and an unreadable input is never read as "no progress"; a termination that signals this session's tree or its exact recorded identity and nothing else; a restart policy whose delay and boundary are declared, recorded, and numerically identical to the shell's ten-then-fail behaviour; a log bounded at 1 MiB active plus one generation; a single instance over the delivered lease with a re-find that never spawns a second session beside a live recorded one; and a proof boundary that is machine-checked rather than asserted in prose.

The integrity risks that shape the plan are the ones the spec names: a second kill path (highest-severity surface, `RSK-4`); a stuck predicate that kills a working CEO (`RSK-2`); an unreadable signal laundered into a verdict (`RSK-3`); a duplicated CEO session after an unclean death (`RSK-5`); a durable stop silently forgotten or over-cleared (`RSK-6`); a pinned help inventory weakly relaxed instead of repinned (`RSK-8`); and a battery that proves fixtures rather than the shipped composition (`RSK-9`). Every one of these is a named case below with a planted defect that must make it fail by name (§7.4).

The plan is offline and deterministic: no live opencode, no live provider, no live tracker, no network call, no real child process, and no real wait. It extends the delivered `tests/fixtures/coordinator/` harness family and the GH-347 conformance seam doubles (`process-runner.ts`, `terminate.ts`, `interleave.ts`, `lane.ts`) rather than introducing a second harness; a second harness would prove a second implementation (spec §12, `NG-3`, `DEC-1`).

### 1.1 In Scope

- `AC-F1-1`…`AC-F8-5` (41 acceptance criteria) — every one mapped in §3.1 with zero orphans and zero unmapped.
- `NFR-1`…`NFR-11`, and the interface/data-model contracts `API-1`…`API-7` and `DM-1`…`DM-9`.
- The additive surfaces this change introduces: the `loop.session` record (`DM-1`), the `loop.stop` record (`DM-2`), the additive optional harness `pid` (`DM-3`), the two read-only projections `delivery.loop.v1` / `delivery.loop.log.v1` (`DM-4`), the declared backoff policy data (`DM-5`), the loop's pure verdict fact set (`DM-6`), the log retention bounds (`DM-7`), and the parity coverage matrix (`DM-9`).
- The ten declared divergences from `scripts/ceo-loop.sh` (spec §8.5), each as a positive assertion of intended behaviour (§5.2 `TC-PARITY-001`…`010`).
- The three pinned help-inventory surfaces that are **pin updates, not relaxations** (spec v1.1 §8.5, `DOD-8`, `DEC-7`; pm-notes `BINDING for delivery_planning`): the prompt-required inventory 26 → 27 with `loop` appended last (the install-family comparator's count, missing/undeclared, and tail rules), the metrics-mounting positional/count pins **and its stale-pin scan set, which must gain 26**, and the reference-page-parity duplicated page mapping, **which must learn the M4 root**; all keep their mutation controls.
- The proof boundary as a permanent fixture constant (`LOOP_PARITY_PROOF_BOUNDARY`: nine proven ids, six not-proven ids, declared order) and the extension of the **delivered** no-shell invariant by adding files to its declared surface.

### 1.2 Out of Scope & Known Gaps

Not tested, by design, and acceptable for the reasons given (design provenance: spec §25.3 Appendix C; risk `RSK-9`, `NG-10`):

| Not proven | Why this is acceptable |
|------------|------------------------|
| Live opencode behaviour: a real session's real message traffic, real resume after a real process exit, real stdout framing | The contract being changed is the loop's decision, the adapter's invocation shape, and the delivered totals-reader mapping, all proven at the seam. Live behaviour is a deployment observation. |
| Live provider behaviour: a real profile selection against live quota, balance, or availability | The per-spawn resolution is consumed as delivered and proven by import identity plus the resolved seat reaching argv. Provider behaviour is unchanged by this change (`NG-5`). |
| OS-level termination of a real child and a real escaped runtime | The battery proves the contract, the ordering, the grace, the exact-identity target selection, and the terminal consequence of an unconfirmed termination over the process-tree model; kernel signal delivery is not the property being changed. |
| A real pick-deliver-merge outcome: real tracker, pull request, CI, and merge effects | Effects remain fixtures. The CEO agent's *definition* still names the shell entry points until F5 (GH-351), so a live run's behaviour is not claimed here (`NG-2`). |
| Long-run loop behaviour under a real clock and real multi-minute delays | The battery injects time; the declared bounds are asserted exactly in virtual milliseconds. |
| Cross-process race freedom beyond the state store's fence guarantee | The two-start interleaving is a deterministic latch, not an arbitrary OS schedule; an arbitrary schedule would prove nothing repeatable. |

This table documents the boundary; it is not the boundary's source. The permanent source is the fixture constant `LOOP_PARITY_PROOF_BOUNDARY` in `tests/fixtures/loop/parity/evidence.ts` (nine proven ids, six not-proven ids, declared order), and `TC-BATTLE-007` asserts only that constant. The same boundary is published on `doc/spec/features/feature-loop-supervision.md` and reconciled there in lifecycle phase 7; a page/constant mismatch is a **documentation-phase defect**, verified by the current-truth doc guard in the aggregate (`pnpm check` → `bun test tests/checks/doc-conformance.test.ts`), never by `TC-BATTLE-007`. Neither this plan nor the change specification is a permanent source, and no permanent suite reads `doc/changes/**`.

Also out of scope (spec §7.2, `NG-1`…`NG-11`): retiring, editing, or re-pointing `scripts/ceo-loop.sh` (F6 / GH-352); any agent prompt or definition edit (F5 / GH-351); a second supervision engine, lease, kill path, or budget fold; any change to the coordinator family's grammar, payloads, records, reasons, defaults, behaviour, or identities; declarative provider policy, quota, or cost routing (GH-350); owner escalation on budget exhaustion; merge or closeout repair (GH-349); the shell's pre-iteration hook; a new configuration key, error identity, domain kind, or delivered schema-version bump; and `--max-iterations`, `pause`, `resume`, `attach`, `logs --follow`, or `loop install`.

Two observations this plan deliberately does **not** encode as permanent cases, per `.ai/rules/testing-strategy.md` ("permanent suites assert properties of the current tree or HEAD ... branch-diff shape checks belong to review and CI PR-time gates"):

- **`DOD-7` (shell and prompts untouched).** The shell half is already a permanent tree invariant (`tests/structure/provider-surface.test.ts` sha256-pins `scripts/ceo-loop.sh`, and must stay byte-unchanged and green); the prompt half is a PR-time change-surface review recorded in §10, not a diff assertion. `TC-CONTRACT-001` additionally proves the loop composition imports no agent-file or script writer.
- **`DOD-3` (commit-message gate).** That is the phase-9 branch-range gate, listed in §7.5, not a case.

## 2. References

| Reference | Use |
|-----------|-----|
| `./chg-GH-348-spec.md` (v1.1) | Source of the 41 ACs, `F-1`…`F-8`, `API-1`…`API-7`, `DM-1`…`DM-9`, `NFR-1`…`NFR-11`, `DOD-1`…`DOD-9`, §8.5 (ten divergences and the three pinned surfaces), Appendix C (proof boundary), Appendix F (parity mapping, normative), Appendix G (proof-boundary constant), Appendix D (implementation-decided details), and the v1.1 rulings R1–R4 that close this plan's four prior questions |
| `./chg-GH-348-pm-notes.yaml` | The `BINDING for delivery_planning` note (pinned surfaces are pin updates with mutation controls intact), the `PM rulings on the four open questions` decision entry (R1–R4), the two cross-file pins, the `TMPDIR`/`PATH` operational prerequisite, the declared-divergence note, the TDR-0055/TDR-0056 staging note |
| `.ai/rules/testing-strategy.md` | Layers, module→test mapping, invariant-authoring rules, `pnpm check` as the aggregate |
| `.ai/rules/typescript.md` §9–§10 | `bun:test` authoring rules, determinism, fixtures never named `*.test.ts`, gate commands |
| `doc/quality/test-specs/test-spec-coordinator-supervision.md` | The enduring coverage map this change extends with a loop counterpart (`test-spec-loop-supervision.md`, phase 7) |
| `doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-test-plan.md` | Structural precedent: stable-id groups, AC traceability matrix, mutation register, fixture inventory, gate battery, proof-boundary discipline |
| `tests/fixtures/coordinator/{harness,cycle-driver,process-port,states,evidence,claim-race,lifecycle,blockers}.ts` | The delivered supervision harness family this change extends |
| `tests/fixtures/dispatch/parity/{process-runner,terminate,interleave,lane,evidence}.ts` | The GH-347 seam doubles reused (guarded runner, process-tree model, fence latch, lane seeders, canonicalizer) |
| `tests/conformance/dispatch/dispatch-parity-battery.test.ts`, `tests/structure/provider-surface.test.ts`, `tests/checks/no-shell-dispatch.test.ts`, `scripts/checks/no-shell-dispatch.ts` | The proof-boundary precedent and the static invariant this change extends |
| `tests/checks/install-conformance-mutants.test.ts`, `tests/structure/metrics-mounting.test.ts`, `tests/fixtures/metrics/mounting.ts`, `tests/checks/reference-page-parity.test.ts`, `scripts/checks/help-guide-coverage.ts`, `tests/fixtures/help-guide/coverage.json` | The delivered pinned help-inventory machinery this change repins |
| `packages/core/src/contracts/error-table.ts`, `packages/core/src/config/defaults.ts`, `packages/cli/src/help/prompt-required-commands.ts` | The closed identity/key/inventory surfaces asserted as data, never as literals guessed in a test |

`./chg-GH-348-plan.yaml` is authored in `delivery_planning` (phase 4) after this plan; this plan is its input and fixes the plan-phase scope items it must carry: the staged TDR-0055/TDR-0056 files and their `doc/decisions/00-index.md` rows (pm-notes staging note), the production seam exports of §8.2 assumption 1, the M4 reference page `doc/planning/oss-tooling/milestones/m4/commands/loop.md`, and the `loop` surface extension of §7.2.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

41 acceptance criteria, 41 mapped, 0 unmapped, 0 orphans. Every case in the "Case(s)" column exists in §5.1/§5.2; every case in §5.1 appears here or in §3.3.

| AC | Capability | Case(s) | Status |
|----|-----------|---------|--------|
| `AC-F1-1` | F-1 | `TC-VERB-001`, `TC-VERB-002`, `TC-VERB-005`, `TC-BATTLE-008`, `TC-PARITY-002`, `TC-PARITY-008`, `TC-PARITY-009` | Planned |
| `AC-F1-2` | F-1 | `TC-VERB-003` | Planned |
| `AC-F1-3` | F-1 | `TC-LOG-005`, `TC-VERB-002` | Planned |
| `AC-F1-4` | F-1 | `TC-STOP-001`, `TC-STOP-004` | Planned |
| `AC-F1-5` | F-1 | `TC-VERB-004`, `TC-CONTRACT-003` | Planned |
| `AC-F2-1` | F-2 | `TC-SPAWN-001`, `TC-PARITY-008` | Planned |
| `AC-F2-2` | F-2 | `TC-SPAWN-002`, `TC-SPAWN-005`, `TC-SPAWN-006`, `TC-PARITY-005`, `TC-INSTANCE-006` | Planned |
| `AC-F2-3` | F-2 | `TC-SPAWN-003` | Planned |
| `AC-F2-4` | F-2 | `TC-SPAWN-004` | Planned |
| `AC-F3-1` | F-3 | `TC-BACKOFF-001` | Planned |
| `AC-F3-2` | F-3 | `TC-BACKOFF-002`, `TC-BACKOFF-003`, `TC-PARITY-004` | Planned |
| `AC-F3-3` | F-3 | `TC-BACKOFF-004` | Planned |
| `AC-F3-4` | F-3 | `TC-BACKOFF-005`, `TC-PARITY-003` | Planned |
| `AC-F3-5` | F-3 | `TC-BACKOFF-006` | Planned |
| `AC-F3-6` | F-3 | `TC-BACKOFF-007` | Planned |
| `AC-F4-1` | F-4 | `TC-STOP-001` | Planned |
| `AC-F4-2` | F-4 | `TC-STOP-002`, `TC-STOP-003`, `TC-PARITY-010` | Planned |
| `AC-F4-3` | F-4 | `TC-STOP-004` | Planned |
| `AC-F4-4` | F-4 | `TC-STOP-005`, `TC-PARITY-007` | Planned |
| `AC-F4-5` | F-4 | `TC-STOP-006`, `TC-STOP-007`, `TC-PARITY-010` | Planned |
| `AC-F5-1` | F-5 | `TC-STUCK-001`, `TC-STUCK-011` | Planned |
| `AC-F5-2` | F-5 | `TC-STUCK-002` | Planned |
| `AC-F5-3` | F-5 | `TC-STUCK-003`, `TC-STUCK-010` | Planned |
| `AC-F5-4` | F-5 | `TC-STUCK-004`, `TC-STUCK-005` | Planned |
| `AC-F5-5` | F-5 | `TC-STUCK-006` | Planned |
| `AC-F5-6` | F-5 | `TC-STUCK-007`, `TC-STUCK-008` | Planned |
| `AC-F5-7` | F-5 | `TC-STUCK-009`, `TC-STUCK-010` | Planned |
| `AC-F6-1` | F-6 | `TC-INSTANCE-001`, `TC-INSTANCE-007`, `TC-PARITY-001` | Planned |
| `AC-F6-2` | F-6 | `TC-INSTANCE-002`, `TC-INSTANCE-003` | Planned |
| `AC-F6-3` | F-6 | `TC-INSTANCE-004` | Planned |
| `AC-F6-4` | F-6 | `TC-INSTANCE-005` | Planned |
| `AC-F6-5` | F-6 | `TC-INSTANCE-006` | Planned |
| `AC-F7-1` | F-7 | `TC-LOG-001`, `TC-LOG-002`, `TC-PARITY-006` | Planned |
| `AC-F7-2` | F-7 | `TC-LOG-003`, `TC-LOG-004` | Planned |
| `AC-F7-3` | F-7 | `TC-LOG-005`, `TC-PARITY-006` | Planned |
| `AC-F7-4` | F-7 | `TC-LOG-006`, `TC-LOG-007` | Planned |
| `AC-F8-1` | F-8 | `TC-BATTLE-001`, `TC-BATTLE-002` | Planned |
| `AC-F8-2` | F-8 | `TC-BATTLE-003` | Planned |
| `AC-F8-3` | F-8 | `TC-BATTLE-004`, `TC-BATTLE-005` | Planned |
| `AC-F8-4` | F-8 | `TC-BATTLE-006` | Planned |
| `AC-F8-5` | F-8 | `TC-BATTLE-007` | Planned |

**Arithmetic.** 5 + 4 + 6 + 5 + 7 + 5 + 4 + 5 = 41 acceptance criteria, reconciled against spec §17 (`F-1` 5, `F-2` 4, `F-3` 6, `F-4` 5, `F-5` 7, `F-6` 5, `F-7` 4, `F-8` 5). 41 of 41 appear above with at least one named case; 0 are unmapped and 0 defer an assertion.

The matrix carries **78** AC→case links (41 + 37 extras), because 24 criteria need more than one observation. The extras sum to 37 exactly: `AC-F1-1` (+6), `AC-F1-3` (+1), `AC-F1-4` (+1), `AC-F1-5` (+1), `AC-F2-1` (+1), `AC-F2-2` (+4), `AC-F3-2` (+2), `AC-F3-4` (+1), `AC-F4-2` (+2), `AC-F4-4` (+1), `AC-F4-5` (+2), `AC-F5-1` (+1), `AC-F5-3` (+1), `AC-F5-4` (+1), `AC-F5-6` (+1), `AC-F5-7` (+1), `AC-F6-1` (+2), `AC-F6-2` (+1), `AC-F7-1` (+2), `AC-F7-2` (+1), `AC-F7-3` (+1), `AC-F7-4` (+1), `AC-F8-1` (+1), `AC-F8-3` (+1).

**Deliver-leg level (DoR R-03).** `AC-F8-4`'s deliver primitive is **`dispatch`** — the delivered jaiship replacement for `scripts/deliver-ticket.sh` — and never `phase complete`, which is a PM lifecycle transition and is not a delivery. `TC-BATTLE-006` drives the deliver leg through the real `dispatch` command runtime with its nested PM session doubled by the same scripted harness port, and asserts that envelope; the claim is proven at command-runtime level and no further. The nested PM session's *live* behaviour stays outside the boundary under the existing `live-opencode` not-proven id, so the boundary constant stays nine proven / six not-proven and no seventh id is added.

**Case inventory.** **74** cases across 10 groups. 0 orphan cases: **69** link at least one `AC-*`, and **5** link only the `NFR-*` contract they pin (`TC-CONTRACT-001`, `-002`, `-004`, `-005`, `-006`; see §3.3). `TC-CONTRACT-003` is AC-linked (AC-F1-5) and is not counted as NFR-only; the matrix is the single source of truth for both numbers.

| Group | Prefix | Cases | Capability | One-line purpose |
|-------|--------|-------|-----------|------------------|
| Verbs | `TC-VERB-*` | 5 | F-1 | Grammar, refusals, exits, the six shell status keys, and the read-only projection |
| Spawn | `TC-SPAWN-*` | 6 | F-2 | CEO agent identity, resolved seat model, deterministic title, pre-session refusals, the session record and the additive `pid` |
| Backoff | `TC-BACKOFF-*` | 7 | F-3 | The declared delay schedule, one ordinal per stuck restart, zero for a clean end, the at-bound exit, the evidence |
| Stop | `TC-STOP-*` | 7 | F-4 | The durable identity-scoped stop, `reset`, both modes, the payload shape, cross-process honouring |
| Stuck | `TC-STUCK-*` | 11 | F-5 | The two-signal verdict, the delivery veto, both `unevaluable` paths, the bound, TERM→KILL ordering, the exact target set, corroborator purity |
| Instance | `TC-INSTANCE-*` | 7 | F-6 | Two-start rejection, takeover, re-find, the distinct identity, session uniqueness, the pid-less degradation |
| Log | `TC-LOG-*` | 7 | F-7 | The line contract, rotation and retention, the bounded read, the log location, unreadable and failed-write paths |
| Battery | `TC-BATTLE-*` | 8 | F-8 | Registry completeness and provenance, no-reimplementation, determinism, the three no-shell observations, the pick-deliver-merge cycle, the proof boundary, the pinned inventory |
| Contract | `TC-CONTRACT-*` | 6 | NFRs | Closed-contract invariance, record/log hygiene, read economy, configuration mapping, pure domain tier, engine-reuse boundary |
| Parity | `TC-PARITY-*` | 10 | §8.5 | One case per declared divergence from `scripts/ceo-loop.sh`, phrased as intended behaviour |

**Group vocabulary justification.** `VERB`, `SPAWN`, `BACKOFF`, `STOP`, `STUCK`, `INSTANCE`, `LOG`, `BATTLE`, `CONTRACT` follow the suggested vocabulary. `PARITY` is added because the ten §8.5 rows are neither invariants (`CONTRACT`) nor grammar (`VERB`): each is a *declared, intended difference from a reference implementation*, and grouping them makes the "this is not a defect" reading reviewable in one place — which is exactly the `RSK-8`/`DEC-6` failure mode (a reviewer "fixing" a divergence back to shell behaviour). A `PARITY` case is hosted in the functional suite that owns the behaviour and is cross-referenced from that capability's group, so no behaviour is tested twice.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Contract | Case(s) | Note |
|----------|---------|------|
| `API-1` `loop start` | `TC-VERB-001`, `TC-SPAWN-003`, `TC-INSTANCE-001`, `TC-BACKOFF-004`, `TC-STOP-002`, `TC-STOP-003`, `TC-STUCK-008` | Exit 0 with `state=stopped` on a folded stop (not a refusal); exit 2 for `coordinator.already-running`, `coordinator.process.capability-gap`, `coordinator.session.kill-failed`, `state.*`; exit 1 for the provider/config/harness refusals and the exhaustion; an unconfirmed termination appends exactly one outcome record, releases the lease, and starts no further session; no session record without a session; the held lease always released |
| `API-2` `loop stop` | `TC-STOP-001`, `TC-STOP-005`, `TC-STOP-006`, `TC-PARITY-007`, `TC-PARITY-010` | At most one `requested` per stop episode; `drain` default; never signals; never touches the lease; exit 0 with or without a running loop |
| `API-3` `loop reset` | `TC-STOP-004`, `TC-PARITY-010` | At most one `cleared` when a request is folded; nothing otherwise; exit 0 either way |
| `API-4` `loop status` | `TC-VERB-003`, `TC-VERB-004`, `TC-INSTANCE-006` | `delivery.loop.v1`; the six shell keys in order, then `stop_mode` immediately after `stop_signal`, then the seven remaining additive keys (eight in the additive tail); exactly three booleans; `loop_id=loop-main` always present and never empty; `ceo_pid`/`ceo_session` live-only; every other absent value rendered as the empty string after `=` with no `none` placeholder; the `restarts` bound is composition-supplied and never a handler configuration read; five-value closed degradation list (each value with an owning assertion — `progress-unreadable` in `TC-STUCK-004`); zero appended records; no verdict evaluated |
| `API-5` `loop log` | `TC-LOG-005`, `TC-LOG-006`, `TC-LOG-007`, `TC-VERB-002` | `delivery.loop.log.v1`; `n` 1–100 default 50; line and byte bounds; `truncation` flag; `unreadable` marker never borrows a failure identity; a read creates nothing |
| `API-6` process execution | `TC-SPAWN-001`, `TC-BATTLE-004`, `TC-BATTLE-005`, `TC-STUCK-009`, `TC-PARITY-008` | Fixed argv, no shell, no script path; the supervision flow invokes no script and reads no shell probe; a runner asked for a shell fails by name |
| `API-7` output contract | `TC-VERB-003`, `TC-LOG-005` | ≤ 32 human lines for `start`/`stop`/`status`/`reset`, ≤ 1 + `n` for `log`; machine `data` ≤ 65 536 bytes; 0 ANSI; the declared key order and value vocabulary of ruling R1/R2: exactly three booleans (`loop_running`, `ceo_alive`, `stop_signal`), `stop_mode` next, `<n>/<bound>` for `restarts`, and a bare `key=` for every absent value with no `none` token |
| `DM-1` `loop.session` | `TC-SPAWN-005`, `TC-SPAWN-006`, `TC-INSTANCE-002`, `TC-INSTANCE-006` | The exact field set; `pid`/`processStartTimeMs`/`title` nullable and never fabricated; one append per acquisition and one per state change; loop-owned key; no prompt/transcript/credential/model/seat |
| `DM-2` `loop.stop` | `TC-STOP-001`, `TC-STOP-004`, `TC-STOP-006`, `TC-STOP-007` | `delivery.loop.stop.v1`; identity-scoped; latest-wins; exactly one record per transition; no pid, holder, or instance field |
| `DM-3` additive harness `pid` | `TC-SPAWN-005`, `TC-INSTANCE-006`, `TC-STUCK-008`, `TC-CONTRACT-001` | Optional on the handle and the streaming spawn seam; absent stays absent (never `0`); no capability name added; every existing double stays valid |
| `DM-4` loop observation payloads | `TC-VERB-003`, `TC-LOG-005`, `TC-INSTANCE-006` | `delivery.loop.v1` / `delivery.loop.log.v1`; identifier-only and bounded; the closed five-value degradation vocabulary; neither persisted |
| `DM-5` restart-policy facts | `TC-BACKOFF-001`…`TC-BACKOFF-007`, `TC-STUCK-006` | `restartDelayMs(n) = min(2 000 × 2^(n−1), 300 000)`; the delivered bound; the delivered reason `stuck-artifact-evidence`; no new reason token |
| `DM-6` stuck-predicate facts | `TC-STUCK-001`…`TC-STUCK-011` | The injected fact set; the delivered `progressing`/`stuck`/`unevaluable` vocabulary; the delivered `stuck-artifact-evidence`/`evidence-unevaluable` reasons; no new evidence class |
| `DM-7` log retention bounds | `TC-LOG-001`, `TC-LOG-003`, `TC-LOG-005` | 512 B line, 1 MiB active, one retained generation, 2 MiB total, 100-line/65 536-byte read, default 50 |
| `DM-8` configuration | `TC-CONTRACT-004`, `TC-PARITY-009` | Zero new keys; the six `coordinator.*` keys consumed with shipped defaults; the shell-knob mapping table; no environment contract |
| `DM-9` parity coverage matrix | `TC-BATTLE-001`, `TC-BATTLE-002`, `TC-BATTLE-007` | One registry row per proven surface; every row names its production seam; no row satisfied by a reimplementation; the boundary ids equal the registry groups |
| `EVT-*` | — | No event, message, telemetry record, metric, alert, or rendered-surface row is added (spec §8.2); nothing to test |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Case(s) | Observation |
|-----|---------|-------------|
| `NFR-1` offline determinism | `TC-BATTLE-003`, `TC-BACKOFF-002`, `TC-CONTRACT-005` | Two in-suite runs byte-identical after canonicalization; 0 live network requests; 0 real child starts; 0 real waits; the delay recorder is the only time source |
| `NFR-2` bounded output | `TC-VERB-003`, `TC-LOG-005` | ≤ 32 human lines; ≤ 1 + `n` for `log`; machine `data` ≤ 65 536 bytes; 0 ANSI; the declared key order with `stop_mode` immediately after `stop_signal`, exactly three `yes`/`no` booleans, and a bare `key=` (never `none`) for every absent value |
| `NFR-3` log retention | `TC-LOG-001`…`TC-LOG-007` | Line ≤ 512 B; active ≤ 1 048 576 B; one retained generation; total ≤ 2 097 152 B; oldest dropped; a log fault never changes a verdict, exit, or record |
| `NFR-4` durable stop | `TC-STOP-002`, `TC-STOP-003`, `TC-STOP-004`, `TC-STOP-005`, `TC-PARITY-010` | 100% of folded requests prevent a start (0 lease, 0 session, 0 session record); `drain` at the next boundary; `immediate` ≤ 50 000 virtual ms; ≤ 1 record per repeated verb |
| `NFR-5` stuck-verdict safety | `TC-STUCK-001`…`TC-STUCK-009`, `TC-STUCK-011` | 100% of kills require all four conditions; 0 kills with a healthy delivery; 0 kills on either unreadable input; **0 corroborator start-time or age comparisons**; detection-to-next-session ≤ the formula `stuck-window + collection-interval + kill-grace + first backoff` (652 000 ms at the shipped defaults) on the confirmed path; an unconfirmed termination starts no next session (terminal, exit 2) |
| `NFR-6` single instance and session uniqueness | `TC-INSTANCE-001`…`TC-INSTANCE-005`, `TC-PARITY-001` | Exactly 1 admitted + 1 refused; 0 double claims; 0 second spawns beside a live recorded session; exactly 1 lease record per acquisition or takeover |
| `NFR-7` contract invariance | `TC-CONTRACT-001`, `TC-CONTRACT-004`, `TC-CONTRACT-006`, `TC-SPAWN-003`, `TC-SPAWN-005` | 0 new error identities, 0 domain kinds, 0 config keys, 0 changed coordinator records/payloads/defaults/behaviour, 0 schema bumps; exactly 2 new record kinds; exactly 1 additive optional harness fact |
| `NFR-8` restart accounting | `TC-BACKOFF-001`, `TC-BACKOFF-004`, `TC-BACKOFF-005`, `TC-BACKOFF-006`, `TC-BACKOFF-007` | Exactly 1 `coordinator.restart` per consumed ordinal; 0 for a clean end; the declared delay at every ordinal; 0 restarts above the bound; 1 verdict + 1 outcome per stuck episode |
| `NFR-9` no shell dependency | `TC-BATTLE-004`, `TC-BATTLE-005`, `TC-STUCK-009`, `TC-PARITY-008` | 0 invocations, 0 script-path literals in the declared surface, 0 script paths in the spawn prompt, a planted reference fails by name |
| `NFR-10` record and log hygiene | `TC-CONTRACT-002`, `TC-LOG-002`, `TC-BACKOFF-007` | No prompt/transcript/diff/credential/environment/provider payload/model/seat anywhere; evidence ≤ 512 B; every diagnostic single-line and identifier-only |
| `NFR-11` read economy | `TC-CONTRACT-003`, `TC-CONTRACT-005`, `TC-VERB-004` | One evaluation read per cycle; 0 appends and 0 extra reads for `status`/`log`/`reset`; the pure tier cannot reach the store at all |

**Exit-literal rule (`NFR-7`).** Every exit literal stated in §5.2 is the delivered projection of the identity that produces it, read from `ERROR_TABLE` × the projection map, and asserted through that table rather than as a bare digit: `coordinator.already-running` / `coordinator.process.capability-gap` / `coordinator.session.kill-failed` → `platform-provider` → 2; `coordinator.restart-budget-exhausted` / `fallback.invocation` → `user-validation` → 1; a folded stop's `state=stopped` and a clean end → 0. No case may state an exit literal the delivered matrix does not project, and `TC-CONTRACT-001` pins the matrix (taxonomy, projection map, and every error row's projection class) against the baseline, so a case that contradicts the matrix fails the invariance check rather than silently editing a test expectation.

## 4. Test Types and Layers

All cases are automated, offline, and deterministic. Per `.ai/rules/testing-strategy.md`:

| Layer | Runner | Location | Used for |
|-------|--------|----------|----------|
| Conformance (integration) | `bun test` (`bun:test`) | `tests/conformance/loop/**` | The parity battery, the pick-deliver-merge cycle, the proof boundary |
| Behaviour | `bun test` | `tests/behaviour/loop-*.test.ts` | The real command path and the real supervision cycle over the real composition with injected I/O edges; the pure verdict, backoff, and renderer tables |
| Structure | `bun test` | `tests/structure/loop-*.test.ts` | Composition wiring, tier purity, the production spawn effects |
| Repository invariant | `bun test tests/checks/**` + `bun run scripts/checks/*.ts` | `tests/checks/`, `scripts/checks/` | Closed-contract invariance, hygiene, temp-copy mutants, the extended no-shell surface, the repinned help inventory |
| Static/diff | `git diff --check` | — | Whitespace/conflict-marker guard before every commit |

No live layer participates: `tests/conformance/live/**` and the scheduled live workflow are untouched (`NFR-1`). Unit-level assertions are folded into the behaviour case that owns the same property (e.g. the delay table inside `TC-BACKOFF-002`), so no case exists only to restate a constant.

**Three drivers, all production code:**

- **D1 — composed production program.** `createProductionComposer({...injected facts})(brand)` → `runEntrypoint([...])`, the pattern proven by `tests/structure/coordinator-production-session.test.ts`. Injected facts: `harnessSpawnStarter`, `harnessSpawnRunner`, `processId`, `environment`, `cwd`, `homeDirectory`, `workingName`, `clock`, `newRunId`, `signalHost`, plus the loop's own facts (session profile, progress reader, corroborator read, process port, log sink, injected `delay`).
- **D2 — in-process edge.** A `createTestEdge`-composed edge registering the `loop` command **and the `coordinator` family** (the production composition mounts both, so the identity-isolation case can drive each surface on its declared harness) → `runCli([...])`, the pattern proven by `tests/fixtures/coordinator/harness.ts`. Used for every cycle case; the store, the command definitions, the supervisor cycle, the projections, and the lease/budget/stuck folds are the production ones.
- **D3 — pure domain.** The exported pure verdict, backoff schedule, log-line renderer, and status projection, called directly, for the table cases.

`TC-VERB-001`…`005`, `TC-STOP-*`, `TC-INSTANCE-*`, `TC-LOG-*` default to D2. `TC-SPAWN-001`/`-002` run on both D1 and D2 (the argv is composed at the edge, so both must agree). `TC-BACKOFF-002`, `TC-STUCK-010`, `TC-CONTRACT-005` are D3. `TC-BATTLE-*` run the registry on D2 with D1 for the spawn rows.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC / NFR | New or Extended |
|-------|-------|------|-------|----------|----------|-----------------|
| `TC-VERB-001` | Every verb × declared flag combination performs its effect and returns its payload, and a clean end is the cycle driver's declared end rather than a failure | Integration | Behaviour | Critical | `AC-F1-1` | New |
| `TC-VERB-002` | Every malformed form — including a missing required `--foreground` — is a grammar refusal at exit 1 with zero records, while the global flags are accepted | Integration | Behaviour | Critical | `AC-F1-1`, `AC-F1-3` | New |
| `TC-VERB-003` | The status block follows the status-key source table: six shell keys, then `stop_mode`, then the additive tail, `loop_id=loop-main` always present, live-only `ceo_pid`/`ceo_session`, bare `key=` elsewhere, no `none` placeholder | Integration | Behaviour | Critical | `AC-F1-2` | New |
| `TC-VERB-004` | `status` and `log` append nothing, create nothing, read no configuration in the handler, fall back to the shipped defaults, and effect no session | Integration | Behaviour | Critical | `AC-F1-5` | New |
| `TC-VERB-005` | Every verb's exit is the delivered projection of the identity that produced it | Structure | Behaviour | High | `AC-F1-1` | New |
| `TC-SPAWN-001` | A fresh spawn renders one `--agent ceo`, one resolved `--model`, and a fixed argv | Integration | Behaviour | Critical | `AC-F2-1` | New |
| `TC-SPAWN-002` | Exactly one deterministic `ceo-loop-<stamp>` title on a fresh spawn, none on a resume, and it is the reap identity | Integration | Behaviour | Critical | `AC-F2-2` | New |
| `TC-SPAWN-003` | Each pre-session provider/config/harness refusal is its delivered identity with a released lease and no session record | Integration | Behaviour | Critical | `AC-F2-3` | New |
| `TC-SPAWN-004` | The binding is the delivered per-spawn resolution and nothing else | Structure | Behaviour | Critical | `AC-F2-4` | New |
| `TC-SPAWN-005` | The additive handle `pid` is filled when the starter supplies one and absent otherwise | Structure | Behaviour | Critical | `AC-F2-2` | New |
| `TC-SPAWN-006` | The session record carries the declared facts and is appended per acquisition and per state change only | Integration | Behaviour | Critical | `AC-F2-2` | New |
| `TC-BACKOFF-001` | A below-bound stuck restart appends one restart record, one session record, and one spawn | Integration | Behaviour | Critical | `AC-F3-1` | New |
| `TC-BACKOFF-002` | The declared delay schedule holds at ordinals 1–10, the total is bounded, and no ambient timer exists | Unit + Structure | Behaviour | Critical | `AC-F3-2` | New |
| `TC-BACKOFF-003` | A durable stop or a signal cancels the wait without applying the session effect | Integration | Behaviour | Critical | `AC-F3-2` | New |
| `TC-BACKOFF-004` | At the bound the loop exits 1 on the delivered identity with its own remediation and no new session | Integration | Behaviour | Critical | `AC-F3-3` | New |
| `TC-BACKOFF-005` | `--fresh-budget` opens the next epoch, and the epoch is durable | Integration | Behaviour | Critical | `AC-F3-4` | New |
| `TC-BACKOFF-006` | A self-ended session consumes no ordinal, appends no restart, and waits the collection interval | Integration | Behaviour | Critical | `AC-F3-5` | New |
| `TC-BACKOFF-007` | A stuck restart's evidence names the ordinal, reason, delay, and a bounded identifier-only corpus | Integration | Behaviour | Critical | `AC-F3-6` | New |
| `TC-STOP-001` | A repeated `stop` appends exactly one `requested` and exits 0 twice | Integration | Behaviour | Critical | `AC-F1-4`, `AC-F4-1` | New |
| `TC-STOP-002` | A folded stop prevents a start after a process restart and after a crash | Integration | Behaviour | Critical | `AC-F4-2` | New |
| `TC-STOP-003` | An unreadable or torn stop fold fails closed at exit 2 with zero session effects | Integration | Behaviour | Critical | `AC-F4-2` | New |
| `TC-STOP-004` | `reset` appends one `cleared` when folded and nothing otherwise; the loop then runs | Integration | Behaviour | Critical | `AC-F1-4`, `AC-F4-3` | New |
| `TC-STOP-005` | `drain` never terminates; `immediate` terminates within the bound; an unverifiable identity is never signalled | Integration | Behaviour | Critical | `AC-F4-4` | New |
| `TC-STOP-006` | The stop payload carries the loop identity, action, mode, and timestamps only | Structure | Behaviour | Critical | `AC-F4-5` | New |
| `TC-STOP-007` | A stop recorded by one process is honoured by a rebuilt composition | Integration | Behaviour | Critical | `AC-F4-5` | New |
| `TC-STUCK-001` | All four stuck conditions produce one verdict record with the loop-scoped identity, one termination, one outcome, and a restart | Integration | Behaviour | Critical | `AC-F5-1` | New |
| `TC-STUCK-002` | Sourced positive progress within the bound is `progressing` with zero records and zero terminations | Unit | Behaviour | Critical | `AC-F5-2` | New |
| `TC-STUCK-003` | Zero traffic for twenty virtual minutes with a live delivery in progress is never stuck | Integration | Behaviour | Critical | `AC-F5-3` | New |
| `TC-STUCK-004` | An unreadable progress reading is `unevaluable`: one record, no kill, continued cycling | Integration | Behaviour | Critical | `AC-F5-4` | New |
| `TC-STUCK-005` | An unreadable corroborator is `unevaluable` and never `stuck` | Integration | Behaviour | Critical | `AC-F5-4` | New |
| `TC-STUCK-006` | Detection-to-next-session holds the bound *formula* at two interval settings and the shipped-default 652 000 ms on the confirmed path; an unconfirmed termination has no next session | Integration | Behaviour | Critical | `AC-F5-5` | New |
| `TC-STUCK-007` | TERM precedes KILL, KILL respects the grace and the live tree | Integration | Behaviour | Critical | `AC-F5-6` | New |
| `TC-STUCK-008` | Only this session's tree or its exact identity is signalled, and an unconfirmed termination is terminal: one outcome, lease released, exit 2, zero restarts, zero spawns | Integration | Behaviour | Critical | `AC-F5-6` | New |
| `TC-STUCK-009` | The corroborator reads delivered lane records from the single read, consumes no start-time fact, and writes nothing | Structure | Behaviour | Critical | `AC-F5-7` | New |
| `TC-STUCK-010` | The corroborator is the total 16-row decision: evidence classes D1–D6 and M1–M6, the F0–F3 fold, plus the pid-reuse residual risk | Unit | Behaviour | Critical | `AC-F5-3`, `AC-F5-7` | New |
| `TC-STUCK-011` | A just-started supervisor seeds the progress observation at acquisition, so a restart can only delay a verdict | Integration | Behaviour | Critical | `AC-F5-1` | New |
| `TC-INSTANCE-001` | Two concurrent starts both directions: exactly one admitted, one `coordinator.already-running` | Integration | Behaviour | Critical | `AC-F6-1` | New |
| `TC-INSTANCE-002` | A dead holder with a live recorded session is taken over and joined with zero spawns | Integration | Behaviour | Critical | `AC-F6-2` | New |
| `TC-INSTANCE-003` | A recorded ended session is replaced by exactly one fresh session | Integration | Behaviour | Critical | `AC-F6-2` | New |
| `TC-INSTANCE-004` | The `loop-main` identity and the `coordinator-main` identity do not exclude or read each other | Integration | Behaviour | Critical | `AC-F6-3` | New |
| `TC-INSTANCE-005` | No more than one CEO session exists at any observation point across takeover, restart, stop, and unconfirmed termination | Integration | Behaviour | Critical | `AC-F6-4` | New |
| `TC-INSTANCE-006` | A pid-less `active` session is resumed exactly once with no title and the same session id returned, never killed and never duplicated | Integration | Behaviour | Critical | `AC-F6-5` | New |
| `TC-INSTANCE-007` | An undeclared alive capability is `coordinator.process.capability-gap` before any record | Integration | Behaviour | High | `AC-F6-1` | New |
| `TC-LOG-001` | Every event renders one bounded, ANSI-free, identifier-only line | Unit | Behaviour | Critical | `AC-F7-1` | New |
| `TC-LOG-002` | A full scenario log carries no prompt, transcript, credential, environment value, model, or seat | Integration | Conformance | Critical | `AC-F7-1` | New |
| `TC-LOG-003` | Rotation past the bound keeps the newest data and drops the oldest generation | Unit | Behaviour | Critical | `AC-F7-2` | New |
| `TC-LOG-004` | A failing append or rotation leaves the verdict, exit, and records unchanged | Unit | Behaviour | Critical | `AC-F7-2` | New |
| `TC-LOG-005` | `log --lines` bounds hold in lines and bytes with a correct truncation flag | Integration | Behaviour | Critical | `AC-F1-3`, `AC-F7-3` | New |
| `TC-LOG-006` | The log path is the state directory beside the ledger, per identity, and a read creates nothing | Structure | Behaviour | Critical | `AC-F7-4` | New |
| `TC-LOG-007` | An unreadable log yields zero lines with the marker at exit 0 | Integration | Behaviour | Critical | `AC-F7-4` | New |
| `TC-BATTLE-001` | Every registry row executes, declares one proven seam, and its seam observation is non-empty | Integration | Conformance | Critical | `AC-F8-1` | New |
| `TC-BATTLE-002` | No battery file reimplements a seam, and a planted reimplementation is rejected by name | Structure | Conformance | Critical | `AC-F8-1` | New |
| `TC-BATTLE-003` | Two consecutive runs are identical with zero live network, zero real children, and zero real waits | Integration | Conformance | Critical | `AC-F8-2` | New |
| `TC-BATTLE-004` | The guarded runner records zero shell invocations and the loop prompt carries no script path | Integration | Conformance | Critical | `AC-F8-3` | New |
| `TC-BATTLE-005` | The delivered no-shell surface is extended over the loop modules and fails by name on a planted reference | Invariant | Checks | Critical | `AC-F8-3` | Extended (`no-shell-dispatch.ts`, `no-shell-dispatch.test.ts`) |
| `TC-BATTLE-006` | The pick-deliver-merge cycle runs the real `dispatch` deliver leg over the real runtime with zero shells and zero kills | Integration | Conformance | Critical | `AC-F8-4` | New |
| `TC-BATTLE-007` | The proof boundary is a permanent constant: nine proven, six not-proven, in order, no row off-boundary | Structure | Conformance | Critical | `AC-F8-5` | New |
| `TC-BATTLE-008` | The prompt-required inventory is repinned to 27 with `loop` last across all three pinned suites, and the removal control fails by name | Invariant | Checks | Critical | `AC-F1-1` | Extended (`install-conformance-mutants`, `metrics-mounting` + stale-pin set, `reference-page-parity` + M4 mapping, `coverage.json`, `mounting.ts`) |
| `TC-CONTRACT-001` | The closed contract surface is unchanged against an in-suite literal baseline, and exactly three additive facts exist | Invariant | Checks | Critical | `NFR-7` | New |
| `TC-CONTRACT-002` | Record, log, and diagnostic hygiene holds across the whole battery | Integration | Conformance | Critical | `NFR-10` | New |
| `TC-CONTRACT-003` | One evaluation read per cycle, and zero extra reads or writes for the read-only verbs | Integration | Behaviour | Critical | `NFR-11` | New |
| `TC-CONTRACT-004` | Zero configuration keys are added and the six delivered keys are consumed with their shipped defaults | Structure | Checks | Critical | `NFR-7` | New |
| `TC-CONTRACT-005` | The loop domain tier is pure: no ambient clock, timer, environment, I/O, or network | Structure | Behaviour | Critical | `NFR-1`, `NFR-11` | New |
| `TC-CONTRACT-006` | The loop imports the delivered engine primitives and reimplements no lease, budget, kill, or lock | Structure | Behaviour | Critical | `NFR-7` | New |
| `TC-PARITY-001` | A second start exits 2, not the shell's silent 0 | Integration | Behaviour | Critical | `AC-F6-1` | New |
| `TC-PARITY-002` | A grammar refusal exits 1, not the shell's usage 2 | Integration | Behaviour | Critical | `AC-F1-1` | New |
| `TC-PARITY-003` | The restart budget is durable per epoch; only `--fresh-budget` resets it | Integration | Behaviour | Critical | `AC-F3-4` | New |
| `TC-PARITY-004` | Stuck restarts back off while ordinary iterations use the collection interval | Integration | Behaviour | Critical | `AC-F3-2` | New |
| `TC-PARITY-005` | A restart starts a fresh session; no context resume is attempted or claimed | Integration | Behaviour | Critical | `AC-F2-2` | New |
| `TC-PARITY-006` | `log` returns the bounded supervision log, never a session transcript | Integration | Behaviour | Critical | `AC-F7-1`, `AC-F7-3` | New |
| `TC-PARITY-007` | `stop` defaults to `drain`; `--mode immediate` is the additive opt-in | Integration | Behaviour | Critical | `AC-F4-4` | New |
| `TC-PARITY-008` | No pre-iteration hook runs and no hook path is read | Integration | Behaviour | High | `AC-F2-1`, `AC-F1-1` | New |
| `TC-PARITY-009` | No `CEO_LOOP_*` environment knob participates; the loop is unbounded | Integration | Behaviour | High | `AC-F1-1` | New |
| `TC-PARITY-010` | The typed stop and the shell stop are not interchangeable | Integration | Behaviour | Critical | `AC-F4-2`, `AC-F4-5` | New |

### 5.2 Scenario Details

#### TC-VERB-001 - Every verb × declared flag combination performs its effect and returns its payload, and a clean end is the cycle driver's declared end rather than a failure

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, API-1, API-2, API-3, API-4, API-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-grammar.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-verb` — the real `loop` command definition through `runCli`
**Fixture mechanism**: `createLoopHarness` (new, over `createTestEdge`) with a seeded stopped state and a seeded running state; the harness exposes its cycle driver so the declared end can be delivered as data.

**Preconditions**:
- Two harnesses over separate temp state roots: one with no records (stopped) and one with a seeded live lease plus an `active` session record (running).
- The config resolution is the delivered one with the shipped defaults.
- The cycle driver is armed to report its **declared end** (the fifth declared end cause of `F-1`/`API-1`), not a failure, not a signal, and not a budget exhaustion.

**Steps**:
1. Run each green row: `loop start --foreground`, `loop start --foreground --fresh-budget`, `loop stop`, `loop stop --mode drain`, `loop stop --mode immediate`, `loop status`, `loop log`, `loop log --lines 1`, `loop log --lines 100`, `loop reset`.
2. Record the exit, the `error` pair when present, the machine `data`, and the record-count delta per verb.
3. Assert each row's declared effect and payload shape.
4. Assert the `start --foreground` row's end is the driver's declared end: `state=stopped`, exit 0, no error field, `fence.action=released`, and exactly one `event=release` log line.

**Expected Outcome**:
- `start --foreground` on the stopped harness acquires the lease, records one `acquired` record, establishes a session, and ends on the **declared clean-end cause** — the composition's cycle driver reporting its declared end (`F-1`, `API-1`) — with `state=stopped` and exit 0. There is no "cycle budget" concept: the end cause is contract, not a test artifact; `start --foreground --fresh-budget` records an epoch-open; both exit 0.
- The clean end is never reported as a failure: no `error` field, no `fallback.*` identity, and no `event=error` log line.
- `stop` (either mode) appends one `loop.stop` with `action=requested` and the mode; `reset` appends one `cleared` only when folded.
- `status` returns `delivery.loop.v1`; `log` returns `delivery.loop.log.v1`; neither appends a record (asserted again by `TC-VERB-004`).
- Every row's exit is the delivered projection of its identity (0 for success and the folded-stop success; see `TC-VERB-005`).
- No `fallback.internal` appears in any envelope.

#### TC-VERB-002 - Every malformed form — including a missing required `--foreground` — is a grammar refusal at exit 1 with zero records, while the global flags are accepted

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, AC-F1-3, API-1, API-2, API-3, API-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-grammar.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-verb` — every refusal producer through the real command path
**Fixture mechanism**: `createLoopHarness` plus a counting store facade so a refused invocation's append count is observable.

**Preconditions**:
- A refused-invocation table: a missing subcommand; an unknown subcommand (`loop pause`, `loop resume`, `loop attach`, `loop install`, `loop logs --follow`); **`loop start` with no `--foreground`**; **`loop start --fresh-budget` with no `--foreground`**; `--foreground` on `status`/`stop`/`log`/`reset`; `--fresh-budget` on a non-`start` verb; `--live` on any verb; `--lines` on a non-`log` verb; an unknown option; `--lines 0`, `--lines 101`, `--lines 1.5`, `--lines abc`, `--lines -1`; `--mode park`; `--max-iterations 3`.
- A global-flag acceptance table: `--json`, `--verbose`, `--pretty`, and each combination thereof on every verb.
- `NG-8`'s operator-surface limit is the expected-refusal source: none of the refused names is a declared verb or flag, and `--foreground` is declared required on `start` (`F-1`).

**Steps**:
1. Run each refusal row on both the stopped and the running harness.
2. Assert exit, the error pair, the summary text, and the record delta.
3. Run each global-flag row on every verb; assert it is **not** a refusal.

**Expected Outcome**:
- Every refusal row: exit 1 (`fallback.invocation`, `user-validation` computed through the table), summary contains `result=refused; reason=grammar`, and record delta 0 (`loop.session`, `loop.stop`, and `coordinator.fence` arrays unchanged byte-for-byte).
- The two required-flag rows (`loop start`, `loop start --fresh-budget`) are refusals of exactly that shape: an implementation that **defaults** `--foreground` would make them succeed and fails here by name (register `M104`).
- Global-flag rows: `--json`, `--verbose`, `--pretty` are accepted on every verb — exit is the verb's own success exit, the record delta is the verb's declared delta, and no row produces `fallback.invocation`. With `--json` the machine payload is selected; without it the human block is rendered.
- No session is spawned and no terminate is invoked on any refusal row (session-port call counts unchanged).
- No crash: the envelope is returned and the store remains readable for a subsequent successful invocation.

#### TC-VERB-003 - The status block follows the status-key source table: six shell keys, then `stop_mode`, then the additive tail, `loop_id=loop-main` always present, live-only `ceo_pid`/`ceo_session`, bare `key=` elsewhere, no `none` placeholder

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-2, API-4, API-7, DM-4, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-status.test.ts` + `tests/fixtures/loop/golden/status.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-status` — the real status projection and the real text renderer
**Fixture mechanism**: three seeded worlds (running with no folded stop, stopped with a folded `requested` stop, and a world where every optional identifier is genuinely absent) plus three golden text/JSON pairs.

**Preconditions**:
- World A (running): live lease under `loop-main` with a recorded holder pid, an `active` live session record with a pid and title, one restart record under `epoch-2`, no folded stop.
- World B (stopped, stop folded): no live lease, an **`ended`** session record with a recorded pid and session id, one folded `requested` stop with `mode=immediate`, one persisted verdict.
- World C (absent): no lease, no session record, no stop record, no restart record, no verdict, no persisted epoch — every genuinely optional value is absent, while `loop_id` (the constant) and `restarts` (with the composition-supplied bound) are still present.
- Golden files: `status-running.txt`, `status-stopped.txt`, `status-absent.txt` and their `.json` counterparts (committed, reviewed, regenerated by an explicit command — never by blanket rewrite).

**Steps**:
1. Run `loop status` (human) and `loop status --json` for all three worlds.
2. Assert each human block line-by-line against its golden; assert the key order and the value vocabulary of every key; scan the raw output for ANSI escape bytes (`0x1b`).
3. Assert the **status-key source table** row by row (`API-4`/`API-7`): for each key, assert the value its declared source predicts, and assert that a key whose declared source says "never empty" is non-empty in every world.
4. Assert that no line contains the `none` token: scan with a word-boundary match that does **not** match a value containing `none` inside a longer token (`/(?:^|[\s=])none(?:$|[\s])/u`) and assert zero matches in all three human blocks. The scan is scoped to the human block only: `none` remains a legal corroborator **enum value** in `F-5`/`DM-6` verdict evidence, so the machine payload and the records are scanned only for the *status placeholder* shape (`key=none`), never for the bare word.
5. Assert the machine payload against each golden JSON and inside the 65 536-byte bound.
6. Assert the line count is ≤ 32 and the key sequence is exactly the six shell keys followed by `stop_mode` and the seven remaining additive keys.
7. Assert the three booleans are exactly `loop_running`, `ceo_alive`, `stop_signal` (no other key renders `yes`/`no`), and that `stop_mode` is `immediate` in world B and empty in worlds A and C.
8. Fold a fourth variation (`mode=drain`) on world A and assert `stop_mode=drain` inline (no golden), so both declared mode values are observed rather than inferred.

**Expected Outcome**:
- Human key order, exactly: `loop_running`, `loop_pid`, `ceo_alive`, `ceo_pid`, `ceo_session`, `stop_signal`, `stop_mode`, `loop_id`, `ceo_title`, `restarts`, `budget_epoch`, `last_restart_reason`, `last_verdict`, `degraded` (14 keys; eight in the additive tail).
- Exactly three keys are boolean and render `yes`/`no`: `loop_running`, `ceo_alive`, and `stop_signal` — with `stop_signal=yes` in world B (a stop is folded) and `no` in worlds A and C; `loop_running` is `yes` in A and `no` in B and C; `ceo_alive` is `yes` in A and `no` in B and C.
- `stop_mode` renders `immediate` in world B (the folded mode) and is **empty** in worlds A and C; the fourth variation asserts `drain` for a folded `drain`; it never renders `yes`/`no`.
- **`loop_id=loop-main` in all three worlds** — it is the constant supervisor identity, never the lease instance id, always present, never empty. World C is therefore *not* a world where every identifier is bare: `loop_id` and `restarts` are present by source.
- `restarts` renders `<n>/<bound>` from the current epoch's restart fold plus the composition-supplied bound: `1/10` in world A, `0/10` in world B and world C. It is never empty.
- `ceo_pid` and `ceo_session` are **live-only** (shell parity): present in world A (`ceo_pid=<pid>`, `ceo_session=<sessionId>`), and **empty** in world B even though an `ended` session record with a pid exists, and empty in world C. A case that rendered the recorded-but-ended identity fails by name (register `M115`).
- `loop_pid` follows the live lease holder: present in world A, empty in B and C.
- The remaining optional values render as the **empty string after `=`**, asserted line-by-line in world C as `loop_pid=`, `ceo_pid=`, `ceo_session=`, `stop_mode=`, `ceo_title=`, `budget_epoch=`, `last_restart_reason=`, `last_verdict=`, `degraded=` — and **no `none` placeholder appears anywhere** in any block (step 4).
- 0 ANSI escapes; ≤ 32 lines; machine `data` ≤ 65 536 bytes.
- The `none` token remains valid only as the corroborator enum value in `F-5`/`DM-6`; this case asserts its absence as a *status value* and does not forbid it in a record.

#### TC-VERB-004 - `status` and `log` append nothing, create nothing, read no configuration in the handler, fall back to the shipped defaults, and effect no session

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-5, API-4, API-5, NFR-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-status.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-status` + `S-verb` — the composed runtime with a counting store, a read-only file-system double, a **handler-scoped** configuration double, and a refusing network double
**Fixture mechanism**: `createLoopHarness` with `counters.appends`, a recording FS double, and a handler-scoped configuration double that records every read the **command handler** performs (and can be armed to fail acquisition or resolution, injecting the shipped defaults).

**Preconditions**:
- Running world from `TC-VERB-003` (world A), plus a second harness whose configuration acquisition fails and a third whose resolution fails.
- The FS double records every `mkdir`, `write`, `open` for write, `rename`, and `unlink`.
- The handler-scoped configuration double counts reads made inside the handler and distinguishes them from the composition's own resolution, which happens before the handler runs and supplies the resolved settings — including the budget bound behind `restarts=<n>/<bound>`.
- The network guard records and refuses every `fetch`.

**Steps**:
1. Run `loop status`, `loop status --json`, `loop log`, and `loop log --lines 10` on the normal harness; assert the counts.
2. Assert the composition supplied the resolved bound: the human block renders `restarts=<n>/10` and the machine payload carries the same bound, without the handler reading a configuration branch.
3. On the acquisition-failure harness and the resolution-failure harness, run `loop status` and `loop status --json`; assert the surface still composes and reports the shipped defaults.

**Expected Outcome**:
- Store appends: 0 for all four invocations; the ledger bytes are identical before and after.
- Created paths: 0; opened-for-write: 0.
- Handler-scoped configuration reads: **0** in every invocation. The `restarts` bound is the composition-supplied resolved value (asserted present in both the human block and the payload), so the read-only property holds and the bound is still rendered.
- On a configuration acquisition failure and on a resolution failure, `status` still returns a bounded block at exit 0 using the shipped defaults (`coordinator.restart-budget` = 10, and the other five keys), with no error identity and no degraded entry borrowed for a configuration fault.
- `fetch` calls: 0; session-port spawn/resume/terminate calls: 0; process-port signal calls: 0.
- Exit 0 for every invocation, including both failure rows.

**Notes**: Fails if `status` evaluates a verdict or `log` touches the directory to discover the file.

#### TC-VERB-005 - Every verb's exit is the delivered projection of the identity that produced it

**Scenario Type**: Structure
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-7
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-grammar.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-verb` — the delivered `ERROR_TABLE` projection map beside the loop's refusal table
**Fixture mechanism**: the delivered `ERROR_TABLE` and projection map imported as data.

**Preconditions**:
- The delivered `ERROR_TABLE` and the projection map.

**Steps**:
1. Collect every identity the loop family can emit (from `TC-VERB-002`, `TC-SPAWN-003`, `TC-INSTANCE-001`, `TC-INSTANCE-007`, `TC-STUCK-008`, `TC-BACKOFF-004`, `TC-STOP-003`).
2. For each, compute the exit through the delivered table and compare with the exit the case observed.

**Expected Outcome**:
- Every observed exit equals the table's projection: 2 for `platform-provider`, 1 for `user-validation`, 0 for success.
- No loop-specific exit literal exists in the loop sources (a source scan for a bare exit digit on a refusal path finds none; exits come from the projection).
- `fallback.invocation` is 1 and `coordinator.restart-budget-exhausted` is 1 in every row that observes them.

#### TC-SPAWN-001 - A fresh spawn renders one `--agent ceo`, one resolved `--model`, and a fixed argv

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-1, API-6, DM-4, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-spawn.test.ts` + `tests/structure/loop-production-session.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-spawn` — the real path composition → `resolveHarnessAdmissionBinding` → adapter `bindingSeams.invocationArgs` → starter
**Fixture mechanism**: the recording starter from `tests/fixtures/loop/session.ts`; a fixed profile/chain fixture; the guarded runner for the `shell:false` check.

**Preconditions**:
- A fresh start with no recorded session and no folded stop.
- A selected profile whose `ceo` seat resolves to `provider-a/model-large`.
- The recording starter captures `{file, args, options}` and the prompt as data.

**Steps**:
1. Run `loop start --foreground` on D2 and on D1.
2. Read the recorded invocation, the argv, and the prompt.
3. Count each flag and assert the value that follows it.

**Expected Outcome**:
- Exactly one `--agent` with the value `ceo`; exactly one `--model` with the resolved seat model; exactly one title argument and no operator override (`--agent`/`--model`/`--title` are not CLI flags — see `TC-VERB-002`).
- The argv is the harness command plus the delivered fixed arguments; `options.shell === false` at the call site; the guarded runner records 0 violations.
- The prompt arrives as data (stdin), never as an argv element; it names the jaiship primitives and carries no script path.
- Both drivers produce the same flag set (one `--agent`, one `--model`).

#### TC-SPAWN-002 - Exactly one deterministic `ceo-loop-<stamp>` title on a fresh spawn, none on a resume, and it is the reap identity

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-2, DM-1, DM-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-spawn.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-spawn` + `S-terminate` — the adapter's argv rendering and the terminate target selection
**Fixture mechanism**: fixed clock (`2026-11-19T12:34:56.000Z`), the recording starter, and `createProcessTreeModel` from the GH-347 fixtures.

**Preconditions**:
- Fixed clock and id sequence so the stamp is deterministic.
- A process-tree model whose escaped runtime is tagged by the session id and by the exact title, plus two unrelated pids.

**Steps**:
1. Spawn fresh twice at the same fixed clock; assert both titles are byte-equal.
2. Spawn fresh at a different fixed clock; assert the title changes only in the stamp.
3. Assert the title matches `^ceo-loop-\d{8}-\d{6}$` and its length is ≤ 64.
4. Drive a terminate for that session and read the target set the adapter computed.
5. Drive the **one resume path** — the pid-less re-find owned and asserted by `TC-INSTANCE-006` — and assert the resume invocation carries **no** title argument. This case asserts the no-title half of `AC-F2-2`; the call itself, its count, its target session id and its returned handle are asserted by `TC-INSTANCE-006`, which is the only case that drives a resume.

**Expected Outcome**:
- Exactly one `--title` on a fresh spawn; the value is `ceo-loop-<UTC yyyymmdd-hhmmss>`; length ≤ 64; deterministic for a fixed clock; the title contains no space.
- The reap target set is exactly `{sessionId, title}` — no name pattern, no prefix match; the two unrelated pids receive no signal.
- The resume invocation driven by `TC-INSTANCE-006` carries no `--title` (asserted on that call's recorded argv, not on a hypothetical one), and `TC-PARITY-005`'s "zero resumes" holds only for the restart path — the two are distinct paths and neither is vacuous.

#### TC-SPAWN-003 - Each pre-session provider/config/harness refusal is its delivered identity with a released lease and no session record

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-3, DM-1, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-spawn.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-spawn` — the real pre-session refusal producers through the composed path
**Fixture mechanism**: three profile fixtures (an unassigned `ceo` seat; an unresolvable profile context; an unrepresentable seat model) and the recording starter.

**Preconditions**:
- Row A: the selected profile assigns no `ceo` seat.
- Row B: the profile context cannot be resolved.
- Row C: the resolved seat model cannot be represented as an adapter model string.

**Steps**:
1. For each row, run `loop start --foreground` and assert the exit, the error pair, the session-port call counts, the session-record count, and the lease fold.

**Expected Outcome**:
- Row A: exit 1, `provider.profile.invalid`; Row B: exit 1, `config.value.invalid`; Row C: exit 1, `harness.profile.model-unrepresentable` — each a delivered identity, computed through the table (see `TC-VERB-005`).
- Zero spawns and zero resumes recorded; zero `loop.session` records; zero `loop.stop` records.
- The lease the start held is released: the fence fold ends `released`, and a second `loop start` at once is admitted (not `already-running`) — the observable proof that the refusal released the lease.
- No `fallback.internal` anywhere in the envelope.

#### TC-SPAWN-004 - The binding is the delivered per-spawn resolution and nothing else

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-4, API-6, NFR-7
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/loop-production-composition.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-spawn` — the composition's mounted resolution symbols
**Fixture mechanism**: source import-identity assertions plus the D1 argv observation.

**Preconditions**:
- The loop composition module and the delivery composition module.

**Steps**:
1. Assert the loop composition imports `createHarnessProfilePort` from `packages/cli/src/production.ts` and calls `resolveHarnessAdmissionBinding` there.
2. Assert no second resolver symbol is imported by the loop modules (`provider-*` resolver, `policy`, `quota`, `route`), and that no loop module reads an operator override for the seat.
3. Run the D1 fresh spawn and assert the resolved seat model reaches the argv (shared with `TC-SPAWN-001`).

**Expected Outcome**:
- Import identity holds: one resolution helper, one profile-port wrapper, both the delivered ones.
- Zero occurrences of a policy/quota/router symbol in the loop surface; zero operator flags for agent/model/title.
- The argv carries the resolved seat model observed from the same composed path the `dispatch` surface uses.

#### TC-SPAWN-005 - The additive handle `pid` is filled when the starter supplies one and absent otherwise

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-2, DM-3, NFR-7
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/loop-production-session.test.ts` + `tests/behaviour/loop-spawn.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-spawn` — the delivered opencode adapter's handle construction
**Fixture mechanism**: two starter doubles: one whose stream exposes a child pid (via `acquired()`), one that exposes none; the delivered `createClaudeSession`/`createOpenCodeSession` doubles already used by the delivered suites.

**Preconditions**:
- `HarnessSessionHandle` and the streaming spawn seam carry the optional `pid`; the opencode adapter fills it from the host starter's child.
- A starter that supplies `pid: 51234`; a starter that supplies nothing.

**Steps**:
1. Spawn through the delivered adapter with the pid-supplying starter; assert the handle and the recorded session facts.
2. Spawn with the pid-less starter; assert the handle and the session facts.
3. Assert every pre-existing handle double in `tests/**` still typechecks and behaves (the delivered `coordinator-production-session.test.ts` is untouched and green).
4. Assert no capability name was added.

**Expected Outcome**:
- Pid-present: `handle.pid === 51234` and the loop's `loop.session` record carries `pid: 51234`.
- Pid-absent: `handle.pid === undefined` (the member is absent, not `0`, not `null`), the record carries `pid: null`, and no capability name appears in the harness capability vocabulary.
- The delivered adapter's absence path is unchanged (an adapter that exposes nothing keeps its delivered behaviour).

#### TC-SPAWN-006 - The session record carries the declared facts and is appended per acquisition and per state change only

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-2, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-spawn.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-session-record` — the real `loop.session` append and the real per-identity read
**Fixture mechanism**: `createLoopHarness` with a cycle driver that runs N quiet cycles, then one session end.

**Preconditions**:
- A spawned session with a pid, start time, and title.
- A cycle driver that runs three cycles with no progress change and no artifact change.

**Steps**:
1. Run the acquisition; read the records and assert the field set.
2. Run three quiet cycles; assert the record count.
3. End the session; assert one state-change record.
4. Assert the record is owned by `loop.sessions:<loopId>` and is invisible to the coordinator read.

**Expected Outcome**:
- Exactly one `active` record at acquisition with the exact DM-1 field set (`schemaId`, `sessionRecordId`, `loopId`, `sessionId`, `harnessKind`, `pid`, `processStartTimeMs`, `title`, `state`, `acquiredAt`, `recordedAt`) — no extra key, no prompt/transcript/diff/credential/provider/model/seat.
- After three quiet cycles the count is unchanged (1).
- The end appends exactly one `ended` record; latest-wins reading returns `ended`.
- `readCoordinatorRecords(store, "coordinator-main")` returns none of the loop's records.

#### TC-BACKOFF-001 - A below-bound stuck restart appends one restart record, one session record, and one spawn

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, DM-5, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-backoff.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-backoff` — the real restart fold, the real budget admission, and the recording delay
**Fixture mechanism**: `createLoopHarness` with a two-iteration session script (stuck, then clean), the recording cycle driver, and a seeded epoch at count 1.

**Preconditions**:
- Epoch at count 1 of bound 10; a stuck verdict reachable in the first iteration.
- The first session's termination is **confirmed** (TERM accepted and the tree observed closed). This is the confirmed-path case; the unconfirmed path is owned by `TC-STUCK-008` and `TC-STUCK-006` rows B/C and never reaches this restart fold (ruling `R3`, `AC-F3-1`, `AC-F5-1`).
- The injected delay records `(reason, ms)` and advances the virtual clock.

**Steps**:
1. Run the cycle to completion.
2. Read `coordinator.restart`, `loop.session`, `coordinator.stuck`, and the starter calls.
3. Assert the ordinal, the reason, the replaced session identity, and the counts.
4. Assert the outcome record's `killOutcome` is a confirmed value (`terminated` or `forced`), so the restart is provably downstream of a confirmation.

**Expected Outcome**:
- Exactly one `coordinator.restart` with `ordinal === 2`, `reason === "stuck-artifact-evidence"`, and the replaced session identity equal to the first session's id.
- Exactly one new `active` session record for the second session (plus the first session's single `ended` state change).
- Exactly one spawn recorded for the second session, in order after the outcome record.
- No second restart record for the same episode; the delay recorded once with reason `restart-backoff` and value `4000`.
- The restart is only admissible because the outcome is a confirmed termination: the case asserts `killOutcome ∈ {terminated, forced}` before asserting the restart, so the confirmed path is proven rather than assumed.

#### TC-BACKOFF-002 - The declared delay schedule holds at ordinals 1–10, the total is bounded, and no ambient timer exists

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, DM-5, NFR-1
**Test Type(s)**: Unit + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-backoff.test.ts` + `tests/structure/loop-imports.test.ts` + `tests/checks/loop-mutants.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-backoff` — the exported pure schedule and the injected delay fact
**Fixture mechanism**: the pure `restartDelayMs`, the recorded delay list, and a temp-copy clock-marker mutant.

**Preconditions**:
- The declared policy data: base 2 000 ms, cap 300 000 ms, ordinal source = the delivered restart fold.

**Steps**:
1. Assert `restartDelayMs(n)` for n = 1…12 equals `[2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 300000, 300000, 300000, 300000]`.
2. Sum n = 1…10 and assert ≤ 1 110 000.
3. Drive a full epoch in the harness; assert the recorded delay list is exactly the n = 1…10 prefix, in order, with the reason `restart-backoff`.
4. Assert the backoff module references no `setTimeout`, `setInterval`, `node:timers`, `Bun.sleep`, `Date.now`, or `new Date`; assert a temp-copy mutant that adds one is detected by name.

**Expected Outcome**:
- The table matches exactly; the cap binds at n = 9; the total is 1 110 000.
- The recorded list matches the table positionally; 0 real elapsed wall-clock time is spent (the recorder is the only wait).
- The purity assertion passes on the live tree; the mutant reports `loop-backoff.ts: ambient clock/timer setTimeout`.

#### TC-BACKOFF-003 - A durable stop or a signal cancels the wait without applying the session effect

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, DM-5, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-backoff.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-backoff` + `S-stop` — the cancellable wait and the stop fold
**Fixture mechanism**: a cycle driver whose `beforeCycle` hook folds a stop during the recorded wait; a `signalHost` double that delivers `SIGTERM` at the same boundary.

**Preconditions**:
- A stuck restart reached **after a confirmed termination** (ruling `R3`: the restart record only exists downstream of a confirmation), with the restart record already appended (the ordinal is consumed before the wait).

**Steps**:
1. Row A: fold `loop stop --mode drain` at the wait boundary; assert the wait ended, no second spawn occurred, and the lease was released.
2. Row B: deliver a signal at the wait boundary; assert the same, plus the declared signal exit.

**Expected Outcome**:
- Neither row applies the session effect: 0 spawns after the restart record, 0 new `active` session records.
- The lease ends `released`; the exit is 0 for the stop row and the declared signal exit for the signal row.
- The restart record stays (an ordinal consumed by a real stuck verdict is not refunded) — asserted explicitly so a later reader does not "fix" it.

#### TC-BACKOFF-004 - At the bound the loop exits 1 on the delivered identity with its own remediation and no new session

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-3, DM-5, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-backoff.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-backoff` — the delivered admission fold at the bound
**Fixture mechanism**: a seeded epoch at count 10 of bound 10, a stuck verdict, and the harness counters.

**Preconditions**:
- Persisted count 10, bound 10 (the shipped `coordinator.restart-budget`).
- A stuck verdict reachable in the iteration.

**Steps**:
1. Run the cycle.
2. Assert the restart-record count, the spawn count, the session-record count, the lease fold, the log events, the exit, the error pair, and the summary.

**Expected Outcome**:
- `coordinator.restart` records: 0 for this episode; new sessions: 0; new `active` session records: 0.
- The lease is released (fold ends `released`).
- The operational log contains exactly one `event=budget-exhausted` line.
- Exit 1 with `coordinator.restart-budget-exhausted` (computed through the table, not as a literal).
- The bounded summary names the **history reference** in the declared shape `epoch-<n>;restarts=<count>;seq=<newest restart ledger sequence>` — asserted value for this run: `epoch-1;restarts=10;seq=<the ledger sequence of the tenth restart record>`. Each component is independently derivable from durable state (the epoch from the lease carrier, the count from the epoch's restart fold, the sequence from the newest restart record), so the assertion computes all three from the store rather than matching a fixed string; a history reference missing the `seq` component fails by name (register `M112`).
- The same summary carries `restarts=10/10` and the loop's own remediation `loop start --foreground --fresh-budget`. The delivered error row's `coordinator`-shaped remediation stays unchanged (assert both, so neither is "fixed" by editing the row).

#### TC-BACKOFF-005 - `--fresh-budget` opens the next epoch, and the epoch is durable

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-4, DM-5, DM-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-backoff.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-backoff` — the delivered epoch fold on the lease carrier
**Fixture mechanism**: a seeded exhausted epoch and a `reopenStore` between the phases (a genuine second process view).

**Preconditions**:
- Epoch `epoch-1` at count 10/10, exhausted.
- A stop is not folded.

**Steps**:
1. Run `loop start --foreground --fresh-budget` and stop it at its first boundary.
2. Assert the epoch identity on the lease carrier and the count.
3. Reopen the store (new handle over the same root) and run `loop status`, then `loop start --foreground`.
4. Assert the previous epoch's records are still readable.

**Expected Outcome**:
- The new epoch is `epoch-2`; the count is 0; the bound is 10.
- `loop status` in the new process reports `budget_epoch=epoch-2` and `restarts=0/10`; the following start runs under `epoch-2` without re-opening it.
- `epoch-1`'s ten restart records are still readable and unchanged (byte-equal prefix).
- A plain `loop start --foreground` (no flag) under an exhausted epoch does not open a new one.

#### TC-BACKOFF-006 - A self-ended session consumes no ordinal, appends no restart, and waits the collection interval

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-5, DM-5, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-backoff.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-backoff` — the real per-iteration wait and the real restart fold
**Fixture mechanism**: two session scripts: a clean end and an unclean non-stuck end.

**Preconditions**:
- Epoch at count 3 of bound 10.

**Steps**:
1. Row A: a session that ends cleanly mid-cycle, then the next iteration.
2. Row B: a session that ends with a non-zero exit but no stuck verdict, then the next iteration.
3. Assert the restart records, the ordinal, the recorded waits, and the spawn count.

**Expected Outcome**:
- Both rows: 0 `coordinator.restart` records; the ordinal stays 3; the wait before the next session is `coordinator.collection-interval` (30 000 ms) with reason `collection-interval`, never `restart-backoff`.
- Exactly one new session per row, appended as one `ended` + one `active` session-record pair.
- Parity assertion: only a **stuck** restart consumes an ordinal (the shell increments only on `stuck`).

#### TC-BACKOFF-007 - A stuck restart's evidence names the ordinal, reason, delay, and a bounded identifier-only corpus

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-6, DM-5, DM-6, NFR-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-backoff.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-backoff` + `S-verdict` — the record pair and the log renderer
**Fixture mechanism**: a stuck restoration with a maximal evidence corpus.

**Preconditions**:
- A stuck verdict with all six declared corpus fields present (`session`, `traffic`, `delivery`, `windowMs`, `progressAgeMs`, `killOutcome`).

**Steps**:
1. Run the stuck restart.
2. Read the `coordinator.stuck` outcome, the `coordinator.restart` record, and the log lines for the episode.
3. Assert each field against the declared grammar and the byte bound.

**Expected Outcome**:
- The outcome and the restart record together name the ordinal, the delivered reason `stuck-artifact-evidence`, and the applied delay (4000 for ordinal n).
- The evidence corpus is identifier-only, contains the six declared fields, and is ≤ 512 UTF-8 bytes.
- Exactly one log line carries the same facts (`event=restart` with the ordinal, reason, and delay), ANSI-free and ≤ 512 bytes, and no line carries a prompt, transcript, credential, environment value, model, or seat name.

#### TC-STOP-001 - A repeated `stop` appends exactly one `requested` and exits 0 twice

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-4, AC-F1-4, AC-F4-1, DM-2, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stop.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-stop` — the real `loop.stop` append and the fold
**Fixture mechanism**: `createLoopHarness` with no running loop and a counting store.

**Preconditions**:
- No lease, no session, no folded stop.
- A counting store facade recording every append by kind.

**Steps**:
1. Run `loop stop`; assert the exit and the delta.
2. Run `loop stop --mode immediate` again; assert the exit and the delta.
3. Read the fold and the folded mode.

**Expected Outcome**:
- First invocation: exit 0, exactly one `loop.stop` with `action=requested`, `mode=drain`.
- Second invocation: exit 0, **zero** further records (idempotent within one stop episode), the folded mode still `drain` (a repeat does not silently upgrade to `immediate`).
- No lease record, no session record, no session effect.

#### TC-STOP-002 - A folded stop prevents a start after a process restart and after a crash

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, DM-2, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stop.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-stop` — the fold read before the claim
**Fixture mechanism**: `loop stop`, then a full composition teardown and rebuild over the same temp root (`reopenStore`); a second row that also removes the record's writer process identity.

**Preconditions**:
- Row A: `loop stop` then a clean teardown/rebuild (a simulated process restart).
- Row B: `loop stop` then a simulated crash (no release record; the same store reopened with a stale live lease from the previous run).

**Steps**:
1. For each row, run `loop start --foreground` in the rebuilt composition.
2. Assert the exit, the state, the lease records, the session-record count, and the spawn count.

**Expected Outcome**:
- Both rows: exit 0, `state=stopped`.
- `coordinator.fence` records appended by the start: **0** (the claim is never reached).
- 0 spawns, 0 session records, 0 lease acquisition.
- Row B additionally: the stale lease from the crashed run is untouched (the start does not take it over, because the stop fold is read first).

#### TC-STOP-003 - An unreadable or torn stop fold fails closed at exit 2 with zero session effects

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, DM-2, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stop.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-stop` — the delivered per-identity read with an injected read failure
**Fixture mechanism**: a store wrapper that fails the stop key's read (`readFail`-style) and a torn-record seeder (an undecodable `loop.stop` payload).

**Preconditions**:
- Row A: the store's `readRecords` returns a `state.*` failure for the loop's stop key.
- Row B: a `loop.stop` record whose payload is undecodable (torn).

**Steps**:
1. Run `loop start --foreground` for each row.
2. Assert exit, the error pair, the lease records, and the session effects.

**Expected Outcome**:
- Both rows: exit 2 with a `state.*` identity (asserted as `kind === "state"` and present in `ERROR_TABLE`), never exit 0 and never a "not stopped" reading.
- 0 lease records, 0 spawns, 0 session records.
- The failure is not relabelled `fallback.internal` and the store remains readable.

**Notes**: This is the `RSK-6` guard: "unreadable" must never read as "not stopped".

#### TC-STOP-004 - `reset` appends one `cleared` when folded and nothing otherwise; the loop then runs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-4, AC-F1-4, AC-F4-3, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stop.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-stop` — the clearance transition and the subsequent fold
**Fixture mechanism**: `createLoopHarness` with the counting store.

**Preconditions**:
- A folded `requested` stop; a second harness with no folded request.

**Steps**:
1. Run `loop reset` with the request folded; assert the delta and the exit.
2. Run `loop start --foreground`; assert the loop runs.
3. Run `loop reset` twice more; assert the deltas.
4. On the second harness (no request), run `loop reset`; assert the delta and the exit.

**Expected Outcome**:
- Folded: exactly one `loop.stop` with `action=cleared`, `mode=null`; exit 0; the following start acquires the lease, spawns one session, and runs.
- Repeated reset: the second and third invocations append nothing and exit 0.
- No request: exit 0, zero records.

#### TC-STOP-005 - `drain` never terminates; `immediate` terminates within the bound; an unverifiable identity is never signalled

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-4, DM-2, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stop.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-stop` + `S-terminate` — the mode decision and the identity-verified kill
**Fixture mechanism**: a running harness with a live session; `createProcessTreeModel`; the injected delay recorder; a pid-less session row.

**Preconditions**:
- Row A: `stop --mode drain` at a cycle boundary while a session is live.
- Row B: `stop --mode immediate` while a session is live with a verified pid + start time.
- Row C: `stop --mode immediate` while the session record is `active` with no pid.

**Steps**:
1. For each row, fold the stop at the declared boundary and run to completion.
2. Assert the terminate call count, the signal records, the virtual elapsed time, the lease fold, the exit, and the degradation list.

**Expected Outcome**:
- Row A: 0 terminate calls, 0 signals; the loop ends at the next iteration boundary; the lease is released; exit 0.
- Row B: exactly 1 terminate; TERM then (after the grace) KILL when the tree is still listed; virtual elapsed from the fold to the end ≤ `collection-interval + kill-grace` (50 000 ms); lease released; exit 0.
- Row C: 0 signals; the loop reports `session-pid-unknown` on the bounded degradation list and ends at the iteration boundary; lease released; exit 0.
- No row signals a pid outside the session's own tree.

#### TC-STOP-006 - The stop payload carries the loop identity, action, mode, and timestamps only

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-5, DM-2
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stop.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-stop` — the record payload shape
**Fixture mechanism**: the real records produced by `TC-STOP-001`/`-004`, read through the delivered reader.

**Preconditions**:
- One `requested` and one `cleared` record from the live store.

**Steps**:
1. Assert `Object.keys(record)` equals the DM-2 set for both actions.
2. Assert the record carries no pid, holder, instance, processStartTime, session, or provider field.
3. Assert the key is `loop.stops:<loopId>` and the schema id is `delivery.loop.stop.v1`.
4. Assert a second loop identity's records are not returned by the read.

**Expected Outcome**:
- Exact key set for both records: `schemaId`, `stopId`, `loopId`, `action`, `mode`, `recordedAt`; `mode` is the declared mode on `requested` and `null` on `cleared`.
- Zero process or instance fields; zero prompt/credential/provider fields.
- The read is identity-scoped: a seeded `loop.stops:loop-other` record is invisible.

#### TC-STOP-007 - A stop recorded by one process is honoured by a rebuilt composition

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-5, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stop.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-stop` — the fold across two composition instances
**Fixture mechanism**: writer composition A records the stop and is disposed; composition B is built over the same temp root with a different injected process id and owner identity.

**Preconditions**:
- Two compositions over one state root with different `processId`/owner identities; the same loop id.

**Steps**:
1. In A, record `loop stop --mode drain` and dispose A.
2. In B, run `loop start --foreground` and assert it folds the request.

**Expected Outcome**:
- B exits 0 with `state=stopped`, appends 0 lease records, spawns 0 sessions, and appends 0 session records.
- The stop record's `recordedAt` and `stopId` are the ones A wrote (byte-identical), proving the honouring did not depend on A's process, pid, or holder.

#### TC-STUCK-001 - All four stuck conditions produce one verdict record with the loop-scoped identity, one termination, one outcome, and a restart

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-6, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stuck.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-verdict` + `S-terminate` — the real predicate over injected facts, the delivered kill
**Fixture mechanism**: `createLoopHarness` with a live session, a zero-progress source, no artifact advance, a corroborator whose F-3 fold reads `none`, and the process-tree model.

**Preconditions**:
- Live session with a recorded pid (and a matching platform start time on the **session record** — the re-find identity of `F-6`, not a lane-owner fact); sourced progress `zero` observed at acquisition; the virtual clock advanced past 600 000 ms; no merge/answer artifact since that observation; a readable store whose only lane candidates are dead or terminal so the corroborator folds to `none`.
- Epoch at count 0 of bound 10; the cycle that reaches the verdict is **cycle ordinal 3**.

**Steps**:
1. Run cycles until the verdict is reached (the third cycle).
2. Read the verdict/outcome pair, the restart record, the signal log, and the record counts.
3. Assert the delivered record's required fields.

**Expected Outcome**:
- Verdict `stuck`; exactly one `coordinator.stuck` record with `phase=verdict` and the bounded corpus, then exactly one with `phase=outcome` and `killOutcome=terminated`; same `stuckId`.
- The delivered payload's required fields are populated as `DM-6` declares: `stuckId` **and** `iterationId` both equal `loop-main:3` (`<loopId>:<cycle ordinal>`, the ordinal of the cycle that reached the verdict), `coordinatorId` = the loop identity, `verdict` = `stuck`, `reason` = the delivered token, and `killFailureReason` = `null` (a confirmed kill is not a failure). A synthetic, empty, or foreign `iterationId` fails by name (register `M110`).
- No `coordinator.iteration` record is written and no third record kind is created — the loop-scoped string satisfies the delivered required field without a loop-owned iteration record.
- Exactly one terminate, TERM first, and the session's own tree only.
- Because that termination is **confirmed** (`killOutcome=terminated`), and only then, exactly one `coordinator.restart` with ordinal 1 and the delivered reason lands, followed by exactly one new session.
- No kill while a session is not live (assert the case fails if the live-session condition is removed).
- The confirmed-termination precondition is asserted before the restart assertion, so this case can never be read as licensing a restart after an unconfirmed kill (`R3`; the terminal path is `TC-STUCK-008`).

#### TC-STUCK-002 - Sourced positive progress within the bound is `progressing` with zero records and zero terminations

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-2, DM-6, NFR-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stuck.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-verdict` — the pure predicate
**Fixture mechanism**: the fact table from `tests/fixtures/loop/facts.ts`.

**Preconditions**:
- Live session; sourced progress `positive` observed at `now − 100 000 ms` (inside `coordinator.progress-bound` = 300 000 ms); no artifact advance; corroborator `none`.

**Steps**:
1. Evaluate the predicate for the row; assert the verdict.
2. Run the equivalent cycle in the harness; assert the record and terminate counts.

**Expected Outcome**:
- Verdict `progressing`; 0 verdict records; 0 terminates; the last-progress observation advances to the reading time.
- A second row with a positive reading at `now − 299 999 ms` is also `progressing`, and one at `now − 300 001 ms` is not automatically stuck (it still needs the window and the other conditions) — asserted as the boundary behaviour.

#### TC-STUCK-003 - Zero traffic for twenty virtual minutes with a live delivery in progress is never stuck

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-3, DM-6, NFR-5, RSK-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stuck.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-verdict` + `S-corroborator` — the veto over the real lane records
**Fixture mechanism**: `seedDispatchLane` / `seedDaemonLane` from the GH-347 fixtures seeded with a **composition-shaped `startedAt`**, a zero-reading progress source, and a 1 200 000 ms virtual window.

**Preconditions**:
- Live session; sourced progress `zero` for 1 200 000 ms (twenty minutes) of virtual time; no artifact advance.
- The newest `dispatch.lane` record for `GH-348` is `active` with a **present** owner `processId` that the process-port probe answers `alive`; its recorded `startedAt` is the composition instant (`2026-11-19T12:00:00.000Z`), **deliberately unlike** any platform process start time the probe could return (the probe answers liveness only, never a start time, and the corroborator must not read `startedAt` at all).

**Steps**:
1. Run 40 cycles of 30 000 ms virtual each.
2. Assert the verdicts, the record counts, and the terminate counts.
3. Assert, with a start-time probe armed to **fail if called**, that no platform start-time read is made by the corroborator on any cycle (the probe call count is 0) — the pid-only rule of `AC-F5-7`.

**Expected Outcome**:
- Every cycle is `progressing`; 0 verdict records; 0 terminates; 0 restarts; the session is never signalled.
- The reading is `in-progress` **because** the owner pid is alive, with no start-time or age comparison anywhere: a rule that compared `startedAt` with a platform start time would fold to `none` here and then kill the CEO, and this case fails by name if it does (registers `M45`, `M106`).
- A second row with a `daemon.lane` in `delivering` and a live recorded process yields the same verdict.
- The start-time probe call count is 0; the `S-corroborator` consumes no `startedAt` (shared with `TC-STUCK-009`).
- The assertion fails by name if the corroborator is dropped from the predicate (`M45`), which is the `RSK-2` control; this is the **live-shape** observation that keeps the rule from being fixture-shaped.

#### TC-STUCK-004 - An unreadable progress reading is `unevaluable`: one record, no kill, continued cycling

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-4, DM-6, NFR-5, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stuck.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-verdict` — the `unknown` branch
**Fixture mechanism**: a progress-source double returning no reading; the process-tree model.

**Preconditions**:
- Live session; no sourced progress source (the totals reader is absent for the harness kind); a readable store whose lane candidates fold to `none`; the window elapsed.

**Steps**:
1. Run three cycles.
2. Assert the verdicts, the record count, the terminate count, and the cycling.
3. Run `loop status --json` and assert the bounded degradation list.

**Expected Outcome**:
- Verdict `unevaluable`; exactly one verdict record per expectation with reason `evidence-unevaluable` and `killOutcome=not-attempted`; 0 terminates; 0 restarts.
- The loop continues to the next cycle (cycle count advances by 3).
- `unknown` is never rendered as `zero` anywhere in the record or the status projection.
- `degraded` contains **`progress-unreadable`** and does **not** contain `delivery-corroborator-unreadable` (the corroborator here is readable) — the fifth and last closed degradation value gets its owning assertion, so all five are observed (register `M105`).

#### TC-STUCK-005 - An unreadable corroborator is `unevaluable` and never `stuck`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-4, DM-6, NFR-5, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stuck.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-corroborator` — the `unknown` reading
**Fixture mechanism**: a store wrapper whose lane read fails (`state.*`), a zero-progress source, and the window elapsed.

**Preconditions**:
- Live session; sourced progress `zero` for more than the window; the corroborator's state read fails.

**Steps**:
1. Run three cycles.
2. Assert the verdict, the record count, the terminate count, and the degradation.

**Expected Outcome**:
- Verdict `unevaluable`; 1 verdict record per expectation; 0 terminates; the loop continues.
- The degradation list carries `delivery-corroborator-unreadable` on `loop status`; no `stuck` verdict is ever produced by an unreadable read (assert across all cycles).
- The case fails by name if an unreadable read is coerced to `none` (register `M46`).

#### TC-STUCK-006 - Detection-to-next-session holds the bound *formula* at two interval settings and the shipped-default 652 000 ms on the confirmed path; an unconfirmed termination has no next session

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-5, DM-5, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stuck.test.ts` + `tests/structure/loop-imports.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-verdict` + `S-backoff` + `S-terminate` — the composed bound formula and the unconfirmed branch
**Fixture mechanism**: the recording clock plus the recording delay; two resolved-settings sets (the shipped defaults and a raised interval); a session whose last sourced progress is stamped at a known virtual instant; a process-tree model armed to fail or mismatch on the unconfirmed rows.

**Preconditions**:
- The formula is `stuck-window + collection-interval + kill-grace + first backoff`.
- Setting 1 (shipped defaults): 600 000 + 30 000 + 20 000 + 2 000 = **652 000 ms**. Setting 2 (raised interval): 600 000 + 60 000 + 20 000 + 2 000 = **682 000 ms**, i.e. exactly +30 000 ms.
- Row A: a **confirmed** termination at setting 1. Row A′: a **confirmed** termination at setting 2. Row B: an identity mismatch. Row C: a failed signal (TERM refuses).

**Steps**:
1. Row A: run the cycle to the second session's acquisition; compute the virtual elapsed time from the last sourced-progress instant to that acquisition; assert the bound and its four components.
2. Row A′: repeat at the raised interval; assert the bound is raised by exactly the interval delta and not by anything else.
3. Rows B and C: run the cycle; assert there is no next session to measure and that the loop ended at the terminal exit.
4. Source-level: scan the loop's supervision/bound module for a `652` (or `652000`) numeric literal and for a bound assembled from anything other than the four named settings; assert zero occurrences.

**Expected Outcome**:
- Row A: elapsed ≤ 652 000 ms and equal to `600 000 + 30 000 + 20 000 + 2 000` for the worst-case row (poll granularity at the last instant of the interval).
- Row A′: elapsed ≤ 682 000 ms and equal to `600 000 + 60 000 + 20 000 + 2 000`; the delta over row A is exactly the interval delta. A hardcoded 652 000 literal fails row A′ by name (register `M109`).
- 0 real wall-clock time spent; every wait in the computation is a recorded entry.
- The source scan finds no `652`/`652000` literal and no bound arithmetic over a constant; the implementation holds the **formula**, not the literal (`R-09`).
- Rows B and C: **no next session** — 0 spawns and 0 new session records after the verdict; the elapsed-time bound therefore does not apply, and the case asserts the terminal exit instead (the full consequence is asserted by `TC-STUCK-008`).
- The bound is stated as a bound on the confirmed path only; a case that measured a restart after an unconfirmed termination would contradict `R3` and `AC-F3-1`.

#### TC-STUCK-007 - TERM precedes KILL, KILL respects the grace and the live tree

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-6, DM-3, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stuck.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-terminate` — the delivered adapter `terminate` over `createProcessTreeModel`
**Fixture mechanism**: the process-tree model with a root pid and two descendants; a scripted sequence in which the tree closes on TERM; a second row in which it survives.

**Preconditions**:
- `coordinator.kill-grace` = 20 000 ms; the injected delay advances the virtual clock.
- Row A: the tree closes on TERM. Row B: the tree survives TERM.

**Steps**:
1. Row A: terminate; assert the signals and timestamps.
2. Row B: terminate; assert the signals and timestamps.
3. Assert no KILL is sent before TERM and none before the grace.

**Expected Outcome**:
- Row A: exactly `[SIGTERM]`; 0 KILL; the grace wait recorded with reason `terminate-grace` and value 20 000.
- Row B: `[SIGTERM, SIGKILL]` with `SIGKILL` recorded at `TERM + 20 000` virtual ms or later.
- Every signal targets a pid in this session's tree; no signal targets the loop's own pid.

#### TC-STUCK-008 - Only this session's tree or its exact identity is signalled, and an unconfirmed termination is terminal: one outcome, lease released, exit 2, zero restarts, zero spawns

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-6, DM-3, NFR-5, RSK-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stuck.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-terminate` — the exact-identity selection and the recorded-pid path
**Fixture mechanism**: `createProcessTreeModel` with escaped runtimes tagged by session id and by the exact title, plus two unrelated pids; the recording process port with a mismatched start time.

**Preconditions**:
- Row A: an escaped runtime matching this session's id, one matching its exact title, one matching a similar but different title (`ceo-loop-20260101-000000` vs `...-000001`), and two unrelated pids.
- Row B: a recorded pid whose live start time differs from the record (an identity mismatch).
- Row C: a second terminate on an already-terminated session.
- Row D: a failed signal — the port refuses TERM (`signalFails`), so the termination cannot be confirmed.
- The epoch is below the bound in rows B and D, so a restart would be *permitted* by the budget — which is what makes the "no restart" assertion meaningful rather than budget-driven.

**Steps**:
1. Row A: terminate; assert the target set and the signals.
2. Row B: run the recorded-pid kill path; assert the signals, the outcome, the exit, and the whole post-verdict consequence.
3. Row C: terminate twice; assert idempotence.
4. Row D: run the failed-signal path; assert the same terminal consequence as row B.

**Expected Outcome**:
- Row A: only the id-match and title-exact pids and this session's tree receive signals; the near-miss title and the unrelated pids receive **0** signals; no name or prefix matching exists.
- Rows B and D are **terminal** (ruling `R3`, `F-5`, `AC-F5-6`, `API-1`): 0 signals on the mismatch (row B) and no further signal after the refused TERM (row D); the outcome is the failed/unconfirmed outcome; **exactly one** `coordinator.stuck` outcome record lands; the lease fold ends **`released`**; the invocation exits **2** with `coordinator.session.kill-failed` (computed through the table, never as a literal); **0** `coordinator.restart` records are appended; **0** spawns occur; **0** new `loop.session` records appear; and the session count never exceeds one.
- The outcome record's required fields are populated as `DM-6` declares: `stuckId` = `iterationId` = the loop-scoped `<loopId>:<cycle ordinal>` (the same identity the verdict record carried), and `killFailureReason` is populated **only** here — `identity-mismatch` on row B and the delivered failed-signal reason on row D — while every confirmed-kill case asserts `null` (`TC-STUCK-001`). A loop that leaves `killFailureReason` null on a failed kill, or sets it on a confirmed one, fails by name (register `M110`).
- Row C: the second call is a success with 0 additional signals.
- The case asserts the restart-record delta explicitly as **zero**, so a future edit that resumes F-3 after an unconfirmed kill fails here by name (register `M96`).

#### TC-STUCK-009 - The corroborator reads delivered lane records from the single read, consumes no start-time fact, and writes nothing

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-7, NFR-9, NFR-10
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stuck.test.ts` + `tests/structure/loop-imports.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-corroborator` — the read-only source set
**Fixture mechanism**: an import-identity scan of the loop modules, a path-literal scan, and the lane-record count before/after the battery.

**Preconditions**:
- The corroborator module and the loop supervisor module.
- The whole battery's store, read through `readDispatchLanes` / `readDaemonLanes`.

**Steps**:
1. Assert no lane appender, no process runner, and no shell-probe symbol is imported by the corroborator or the supervisor.
2. Assert no `.ai/local` path literal appears anywhere in the declared loop surface, and `delivering` appears only as a lane state value, never as a file name.
3. Assert the corroborator path reads **no** `startedAt`, no process start time, and no age fact: a source scan of the corroborator module finds zero `startedAt`, `startTimeMs`, `processStartTime`, `Date.parse(...startedAt)`, and age-difference reads, and an armed start-time probe records 0 calls (`R-01`, `AC-F5-7`).
4. Assert the `dispatch.lane` and `daemon.lane` record counts are unchanged (byte-equal) before and after the battery.
5. Assert the corroborator consumed the same snapshot as the cycle (one evaluation read — shared with `TC-CONTRACT-003`).

**Expected Outcome**:
- Zero writer imports (`appendDispatchLane`, `appendDaemonLane`, `recordDaemonDispatchResult`), zero `child_process`, zero script literal, zero `--is-delivering` reference.
- Zero start-time or age reads on the corroborator path — the owner-liveness rule consumes the recorded `processId` and the process-port liveness answer only. A start-time comparison fails here by name (register `M106`).
- Lane record counts identical before/after; no lane record created by the loop.
- The corroborator's input comes from the one snapshot the cycle already read.

#### TC-STUCK-010 - The corroborator is the total 16-row decision: evidence classes D1–D6 and M1–M6, the F0–F3 fold, plus the pid-reuse residual risk

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-3, AC-F5-7, DM-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stuck.test.ts` + `tests/fixtures/loop/facts.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-corroborator` — the pure decision over injected lane facts and an injected liveness answer
**Fixture mechanism**: the fact table from `tests/fixtures/loop/facts.ts`, composing `seedDispatchLane`/`seedDaemonLane` rows and a scripted liveness answer (`alive` / `dead` / `unreadable`) per pid; **no** start-time source is offered to the corroborator at all.

**Preconditions**:
- The sixteen rows below are spec `F-5`'s tables verbatim: twelve evidence classes (D1–D6, M1–M6) and four fold rules (F0–F3), each evaluated as one case.
- Evidence rows are evaluated with a readable store and the other candidate lane(s) absent; fold rows are evaluated on the aggregate of their evidence classes.

**Steps**:
1. Evaluate the corroborator for each evidence row with only that candidate present; record its contribution.
2. Evaluate the four fold rows over the specified aggregates.
3. Assert the live-shape observation and the pid-reuse observation as separate labelled assertions (not table rows).

**Expected Outcome** — **evidence classes (12)**:

| # | Candidate | Reading |
|---|---|---|
| D1 | no `dispatch.lane` for the ref | ignored |
| D2 | newest `dispatch.lane` `terminal` (any owner pid) | ignored |
| D3 | `active` + **absent** owner `processId` | `unknown` |
| D4 | `active` + **present** owner pid **alive** | `in-progress` |
| D5 | `active` + **present** owner pid **dead** | ignored |
| D6 | `active` + **present** owner pid **unreadable** (undeclared or failing probe) | `unknown` |
| M1 | no `daemon.lane` | ignored |
| M2 | newest `daemon.lane` state ≠ `delivering` | ignored |
| M3 | `delivering` + **absent** `processId` | `unknown` |
| M4 | `delivering` + **present** pid **alive** | `in-progress` |
| M5 | `delivering` + **present** pid **dead** | ignored |
| M6 | `delivering` + **present** pid **unreadable** | `unknown` |

**Expected Outcome** — **fold (4)**:

| # | Condition | Reading |
|---|---|---|
| F0 | the state read is unreadable | `unknown` |
| F1 | any candidate contributes `in-progress` (even beside an `unknown`) | `in-progress` |
| F2 | else any candidate contributes `unknown` | `unknown` |
| F3 | else: readable store, every candidate ignored because absent, terminal, or provably dead | `none` |

- All 16 rows yield exactly the declared readings. `none` is reachable **only** through F3; an implementation that returns `none` for an unreadable store (F0) or for an absent daemon pid (M3) fails by name (registers `M107`, `M108`).
- **No row consumes `startedAt`, an age bound, or a start-time comparison.** The v1.0 rows that tested a "matching start time" are removed with the rule; a reintroduced start-time row fails `TC-STUCK-009`'s source scan and register `M106`.
- `in-progress` dominates `unknown` (F1 before F2) — the deliberate asymmetry: a false `in-progress` delays a kill, a false `none` kills a healthy session.
- **Newest-wins is folded into the rows rather than added as a seventeenth**: D2 and M2 are evaluated with a newer terminal/non-delivering record beside an older `active`/`delivering` one, so the newest record decides and a stale one never wins.
- **Live-shape observation (beyond the table):** a `dispatch.lane` whose owner `startedAt` is a composition instant deliberately unlike any platform reading still folds to `in-progress` on D4, because only the pid and its liveness are consumed (this is the same fact `TC-STUCK-003` asserts across forty cycles).
- **Pid-reuse residual-risk observation (beyond the table):** an `active` lane whose recorded pid has been reused by an unrelated live process folds to `in-progress` and the loop declines to kill. The case asserts that this is the observed, intended behaviour — a delayed kill, never a kill — and that no age or start-time test is added to "tighten" it.
- The reading set is closed: no row yields a value outside `in-progress` / `none` / `unknown`.

#### TC-STUCK-011 - A just-started supervisor seeds the progress observation at acquisition, so a restart can only delay a verdict

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stuck.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-verdict` — the seeding rule
**Fixture mechanism**: a session record whose `acquiredAt` is far older than the process start, and a supervisor that has just begun.

**Preconditions**:
- A recorded `active` session acquired 3 600 000 ms before the current virtual instant (an hour ago), now being observed by a freshly started supervisor.
- Sourced progress `zero`, no artifact advance, corroborator `none`.

**Steps**:
1. Run the first cycle immediately after acquisition; assert the verdict.
2. Advance the virtual clock by the window minus one millisecond; assert the verdict.
3. Advance past the window; assert the verdict.
4. Repeat with a supervisor restart at each stage.

**Expected Outcome**:
- Step 1 and 2: `progressing` (the observation was seeded at *this* supervisor's acquisition, not at the record's `acquiredAt`).
- Step 3: `stuck` — the window is measured from the seeded observation.
- A supervisor restart re-seeds, so the elapsed time before a verdict is never shorter than the window after the restart: a restart can only delay, never cause, a kill.

#### TC-INSTANCE-001 - Two concurrent starts both directions: exactly one admitted, one `coordinator.already-running`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-instance.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-lease` — the delivered claim fold over the real store
**Fixture mechanism**: `createFenceLatch` from the GH-347 fixtures wired to the injected wait; two `runCli` invocations over one store.

**Preconditions**:
- One shared store; no pre-existing lease; the injected delay parks the first arrival at its fence wait.
- Both orderings are run (A parked then B wins; B parked then A wins).

**Steps**:
1. Start A; await its fence-wait arrival.
2. Start B; await B's completion.
3. Release A; await A's completion.
4. Read the lease records, the session records, and the starter calls.

**Expected Outcome**:
- Exactly one invocation exits 0 and spawns (one starter spawn recorded); the other exits 2 with `coordinator.already-running` and a summary naming the live holder.
- `coordinator.fence` records: exactly one acquisition appended by the winner; **0** by the loser.
- The loser appends 0 session records and spawns 0 sessions.
- Both directions produce the same verdict shape (which invocation wins may differ; that it is exactly one each may not).

#### TC-INSTANCE-002 - A dead holder with a live recorded session is taken over and joined with zero spawns

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-2, DM-1, NFR-6, RSK-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-instance.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-lease` + `S-refind` — the takeover fold and the session resolution
**Fixture mechanism**: a seeded `acquired` lease whose holder is not alive, plus a seeded `loop.session` record `active` with a pid that **is** alive and a matching start time.

**Preconditions**:
- Lease holder dead; recorded session pid alive with a matching platform start time; the collection interval's age fallback is not needed (liveness answers first).

**Steps**:
1. Run `loop start --foreground` for one cycle.
2. Read the lease fold, the starter calls, and the session records.

**Expected Outcome**:
- Exactly one takeover lease record (`stale-takeover`), appended once.
- The recorded session is **joined**: 0 spawns, 0 resumes, 1 session record state unchanged; the cycle observes the existing session.
- No second `active` session record is appended for the join.

#### TC-INSTANCE-003 - A recorded ended session is replaced by exactly one fresh session

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-2, DM-1, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-instance.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-refind` — the ended-session branch
**Fixture mechanism**: a seeded lease (dead holder) plus a `loop.session` record in `ended` state.

**Preconditions**:
- Recorded session `ended`, with a pid that no longer answers alive.

**Steps**:
1. Run one cycle.
2. Assert the spawn count and the session records.

**Expected Outcome**:
- Exactly one spawn, with the declared fresh-spawn identity (`--agent ceo`, one resolved `--model`, one `ceo-loop-<stamp>` title).
- Exactly one new `active` session record; the prior `ended` record is unchanged.
- Exactly one takeover lease record.

#### TC-INSTANCE-004 - The `loop-main` identity and the `coordinator-main` identity do not exclude or read each other

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-3, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-instance.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-lease` — the identity-scoped key and the per-identity read
**Fixture mechanism**: a live `coordinator-main` lease seeded through the real claim with a live holder; then the reverse with a live `loop-main` lease.

**Preconditions**:
- Row A: a live `coordinator-main` acquisition (seeded through the delivered claim, not a foreground coordinator process).
- Row B: a live `loop-main` acquisition.

**Steps**:
1. Row A: run `loop start --foreground`; assert admission and the reads.
2. Row B: run `coordinator start --foreground` on the same harness (D2 registers both families, so the case executes on its declared harness — DoR R-08); assert admission and the reads.
3. For each, assert the record sets each surface reads.

**Expected Outcome**:
- Row A: `loop start` is admitted (one new `loop-main` acquisition) while the `coordinator-main` lease stays live and unchanged; the loop reads 0 coordinator records.
- Row B: `coordinator start` is admitted while the `loop-main` lease stays live; the coordinator reads 0 loop records.
- Both lease records carry their own identity key; neither fold sees the other's record.

#### TC-INSTANCE-005 - No more than one CEO session exists at any observation point across takeover, restart, stop, and unconfirmed termination

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-4, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-instance.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-refind` — the invariant asserted after every step
**Fixture mechanism**: a step-recording wrapper that snapshots the session records and the live pid set after every harness step across the takeover, restart, stop, and unconfirmed-termination flows.

**Preconditions**:
- The takeover scenario (`TC-INSTANCE-002`), the restart scenario (`TC-BACKOFF-001`), the immediate-stop scenario (`TC-STOP-005` row B), and the **unconfirmed-termination** scenario (`TC-STUCK-008` row B) composed in one world.
- The unconfirmed row sits below the budget bound, so the only thing that can prevent a second session is the terminal rule (`R3`), not the budget.

**Steps**:
1. Run the composed flow, snapshotting after every step.
2. After each snapshot, assert the number of sessions that are `active` and live is ≤ 1.
3. Assert no spawn occurred while a live recorded session existed.
4. Assert the unconfirmed-termination segment ends with **0 spawns after it**, a released lease, and exit 2 — so the invariant holds across that path too.

**Expected Outcome**:
- Every snapshot: at most one `active` live session; never two.
- Zero spawns while a live recorded session exists (asserted positionally: each spawn is preceded by an `ended` state change or an empty session set).
- Across the unconfirmed-termination segment: the invariant is preserved because no restart is applied at all — 0 restart records, 0 spawns, the original (possibly live) session still the only one recorded, and the lease released.
- The invariant is asserted at every step, not only at the end.

#### TC-INSTANCE-006 - A pid-less `active` session is resumed exactly once with no title and the same session id returned, never killed and never duplicated

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-5, AC-F2-2, DM-1, DM-3, API-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-instance.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-refind` + `S-verdict` — the unknown-liveness branch and the one resume path
**Fixture mechanism**: a harness kind whose adapter supplies no pid (the `claude-code` capability shape); the recording session port from `tests/fixtures/loop/session.ts`, which records every `resume` call with its argv and returns a handle; a zero-progress source; a readable corroborator folding to `none`; the window elapsed.

**Preconditions**:
- A recorded `active` session with `pid: null` and `processStartTimeMs: null`, session id `ses-resumable-1`.
- The session port's `resume` returns a handle carrying `sessionId: "ses-resumable-1"` (the delivered resume contract: the resumed session keeps its identity).
- The progress source is `zero` for more than the window.

**Steps**:
1. Run three cycles.
2. Assert the verdicts, the spawn count, the kill count, the resume count, the session records, and the degradation list.
3. Read the recorded `resume` invocation: count it, read its target session id, its argv, and the handle it returned.
4. Run `loop status --json`.

**Expected Outcome**:
- Verdict: never `stuck` (unknown liveness is not a stuck condition); the window is never counted as progress either.
- **Exactly one `resume` call** in the whole run, targeting `ses-resumable-1`, with **no** `--title` in its argv (the title is a fresh-spawn-only fact, `AC-F2-2`), and the returned handle carries `sessionId: "ses-resumable-1"` — the same session, not a new one.
- 0 spawns and 0 kills. There is no reading of this case under which an implementation that merely *observes* the session passes: the resume count is asserted `toBe(1)`, and the observation-only variant fails by name (register `M103`).
- `loop status` reports `ceo_pid` empty (no live identity), `ceo_session` empty (live-only, `R-06`), and `degraded` contains `session-pid-unknown` (plus `live-facts-unknown` where the kind supplies no liveness).
- Exactly one `loop.session` record exists and remains `active` — the resume does not append a second acquisition (no `ended`, no second `active`).

#### TC-INSTANCE-007 - An undeclared alive capability is `coordinator.process.capability-gap` before any record

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-instance.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-lease` — the delivered capability gate
**Fixture mechanism**: `createRecordingProcessPort` with `declared.alive = false` (and a second row with `startTimeIdentity = false`).

**Preconditions**:
- A process port that declares no `alive` capability; a second row that declares no start-time identity.

**Steps**:
1. Run `loop start --foreground` for each row.
2. Assert the exit, the error pair, and the record counts.

**Expected Outcome**:
- Exit 2 with `coordinator.process.capability-gap` (computed through the table), the summary naming the missing capability.
- `coordinator.fence` records: 0; session records: 0; spawns: 0; signals: 0 — the gap is detected before any record or effect.
- The loop's own composition does not invent a fallback probe.

#### TC-LOG-001 - Every event renders one bounded, ANSI-free, identifier-only line

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, DM-7, NFR-3, NFR-10
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-log.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-log` — the pure line renderer
**Fixture mechanism**: one row per event in the closed vocabulary, plus an oversized-field row.

**Preconditions**:
- The closed event vocabulary: `start`, `cycle`, `session`, `stuck-verdict`, `kill`, `restart`, `backoff`, `stop`, `budget-exhausted`, `release`, `error`.

**Steps**:
1. Render one line per event; assert the grammar.
2. Render a row with a field list that would exceed 512 bytes; assert whole-pair dropping.
3. Scan every rendered line for ANSI escapes and for the forbidden content classes.

**Expected Outcome**:
- Every line matches `^<ISO-8601 UTC> event=<name>( <key>=<value>)*$`, is a single line (no `\n`, no `\r`), is ≤ 512 UTF-8 bytes, and the name is in the closed vocabulary.
- The oversized row drops whole `key=value` pairs (never truncates inside a pair); the retained line is ≤ 512 bytes and the dropped pairs are counted, not silently lost mid-token.
- 0 ANSI escape bytes; 0 prompt/transcript/diff/credential/environment/model/seat content.

#### TC-LOG-002 - A full scenario log carries no prompt, transcript, credential, environment value, model, or seat

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, NFR-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/loop/loop-parity-battery.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-log` — the log written by the whole battery
**Fixture mechanism**: canaries injected into the prompt (a `PARITY_CANARY` token), the environment, a credential fixture, and a synthetic provider payload, plus the battery's own log files.

**Preconditions**:
- The whole registry executed with the canaries present in every injected input.
- Every log file the battery produced, plus every record, summary, and diagnostic.

**Steps**:
1. Scan every log line for each canary and for the six forbidden classes.
2. Scan every record payload and every envelope diagnostic.
3. Assert the canaries were genuinely present in the inputs (non-vacuity): the spawn prompt contains the canary.

**Expected Outcome**:
- 0 canary occurrences in any log line, record, summary, or diagnostic.
- The non-vacuity assertion passes: the canary is present in the captured spawn prompt input, so the scan is measuring something.
- Every log line is ≤ 512 bytes and every record payload is within its declared bound.

#### TC-LOG-003 - Rotation past the bound keeps the newest data and drops the oldest generation

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-2, DM-7, NFR-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-log.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-log` — the injected append-only file-system double
**Fixture mechanism**: `tests/fixtures/loop/log-fs.ts`: a scripted append sequence that crosses 1 048 576 bytes twice, with a recorded rename/rotate log.

**Preconditions**:
- A line size that makes the crossing deterministic; a virtual clock so each line's timestamp is ordered.

**Steps**:
1. Append until the active file would exceed 1 048 576 bytes; assert the rotation.
2. Append until the rotation generation would be displaced; assert the retention.
3. Read the retained content and assert which epoch it belongs to.

**Expected Outcome**:
- After the first crossing: the active file ≤ 1 048 576 bytes; exactly one rotated generation exists; total ≤ 2 097 152 bytes.
- After the second crossing: still exactly one generation; the earlier generation is **discarded**; total ≤ 2 097 152 bytes.
- The newest lines are present (the newest data is always retained) and the oldest are the ones missing.
- Rotation happened at an append, never at a read.

#### TC-LOG-004 - A failing append or rotation leaves the verdict, exit, and records unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-2, DM-7, NFR-3
**Test Type(s)**: Unit + Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-log.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-log` — the failure-swallowing path
**Fixture mechanism**: the log double configured to fail the next append, then the next rotation; a stuck scenario driven twice (failing and not).

**Preconditions**:
- A stuck episode that produces a verdict, a termination, an outcome, and a restart.
- Row A: the log append fails once. Row B: the rotation fails once. Row C: both fail.

**Steps**:
1. Run each row and record the verdict, the exit, the record set, and the status degradation list.
2. Run the control (no failure) and compare.

**Expected Outcome**:
- Verdict, exit, and the record set are byte-identical to the control in all three rows.
- Exactly one bounded attempt is made per append/rotation (asserted by the double's call count), then swallowed.
- The only disclosure is `log-unavailable` on the status degradation list; no failure identity is borrowed, no exit changes, and no `error` event line is fabricated.

#### TC-LOG-005 - `log --lines` bounds hold in lines and bytes with a correct truncation flag

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-7, AC-F1-3, AC-F7-3, API-5, NFR-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-log.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-log` — the real `log` read projection
**Fixture mechanism**: a log file seeded with 200 lines, a log file with 3 lines, and no log file at all.

**Preconditions**:
- A 200-line log with known content and per-line sizes; a 3-line log; a missing path.

**Steps**:
1. Run `loop log` (no flag) and assert 50 lines.
2. Run `loop log --lines 1`, `--lines 100`, and assert the counts.
3. Assert the byte bound and the `truncation` flag for each.
4. Assert a missing file yields 0 lines and `truncation: false` at exit 0.
5. Assert the malformed forms are grammar refusals (shared with `TC-VERB-002`).

**Expected Outcome**:
- Default: exactly 50 returned lines; `--lines 1`: 1; `--lines 100`: 100; the 200-line row sets `truncation: true` and the ≤ 100-line row sets it false.
- Response ≤ 100 lines and ≤ 65 536 bytes in every row; human output ≤ 1 + `n` lines.
- Missing file: 0 lines, `truncation: false`, `unreadable: false`, exit 0, and 0 created paths.
- `--lines 0`, `--lines 101`, and non-integers are `fallback.invocation` at exit 1 (not a silent fallback to 50 — see `TC-PARITY-002`).

#### TC-LOG-006 - The log path is the state directory beside the ledger, per identity, and a read creates nothing

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-4, NFR-3
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-log.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-log` — the path resolver
**Fixture mechanism**: the recording FS double and the injected state root.

**Preconditions**:
- An injected state root that stands in for `<home>/<stateDirectoryName>`; the ledger at `<stateRoot>/ledger.<workspace>.jsonl`.

**Steps**:
1. Resolve the log path for two loop identities; assert the paths.
2. Assert the path is under the state root, beside the ledger, and outside the working tree.
3. Read a missing log; assert 0 created paths.
4. Append one line; assert the directory and file were created by the append.
5. Assert an identity change changes the path.

**Expected Outcome**:
- Paths are `<stateRoot>/loop/<loopId>.log`; both are under the state root and neither is under the checkout.
- The read of a missing file creates 0 directories and 0 files (asserted by the FS double's created-path list).
- The first append creates the directory and the file exactly once.
- No `.ai/local` path is produced.

#### TC-LOG-007 - An unreadable log yields zero lines with the marker at exit 0

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-4, API-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-log.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-log` — the unreadable branch
**Fixture mechanism**: an FS double whose read fails with a permission-shaped error for the log path only.

**Preconditions**:
- A log file present but unreadable; every other path readable.

**Steps**:
1. Run `loop log` and `loop log --json`.
2. Assert the exit, the line count, the `unreadable` marker, and the error field.

**Expected Outcome**:
- Exit 0; 0 lines; `unreadable: true`; `truncation: false`.
- No error identity appears (the error table declares none for a log fault); no `fallback.internal`; no borrowed `state.*` identity.
- The human output says the log is unreadable in one bounded line, and no prompt/credential content is echoed from the failed read.

#### TC-BATTLE-001 - Every registry row executes, declares one proven seam, and its seam observation is non-empty

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-1, DM-9, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/loop/loop-parity-battery.test.ts` + `tests/fixtures/loop/parity/cases.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: every seam, driven from the one registry
**Fixture mechanism**: `LOOP_PARITY_CASES` — the single case registry whose group vocabulary **is** the nine proven ids.

**Preconditions**:
- `LOOP_PARITY_CASES` declares, for every entry: `id`, `group` (= the proven seam id), `declaredSeam`, `scenario`, `expected`.
- The nine groups: `verbs`, `log`, `spawn`, `stuck`, `kill`, `backoff-budget`, `stop`, `single-instance`, `no-shell`.

**Steps**:
1. Execute every registry entry through `runAllLoopParityCases()`.
2. For each row, assert its declared seam's observation is non-empty (a spawn row recorded a spawn; a kill row recorded signals; a stop row recorded a stop record; a no-shell row recorded a guard sweep).
3. Assert the executed row count equals `LOOP_PARITY_CASES.length` and the observed group set equals the nine proven ids.
4. Assert every case in §5.2 that claims a battery row is driven from the registry (no suite re-authors a scenario).

**Expected Outcome**:
- Every declared row executes exactly once in the sweep; 0 declared rows are skipped.
- Each row's seam observation is non-empty; a row whose observation is empty fails by name.
- The observed group set equals `LOOP_PARITY_PROOF_BOUNDARY.proven` exactly (order-insensitive for the set, order-sensitive for the constant — `TC-BATTLE-007`).
- 0 rows are satisfied by a fixture-written record (the harness exposes no session/stop/restart writer other than the production code).

#### TC-BATTLE-002 - No battery file reimplements a seam, and a planted reimplementation is rejected by name

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-1, DM-9, NFR-7
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/loop/loop-parity-battery.test.ts` + `tests/fixtures/loop/parity/seams.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: the seam manifest (production module per seam)
**Fixture mechanism**: `LOOP_SEAM_MANIFEST` (mirroring `tests/fixtures/dispatch/parity/seams.ts`).

**Preconditions**:
- The manifest declares each seam symbol, its production module, and the composition that mounts it: `decideCoordinatorClaim` / `coordinator-fence`, `evaluateCoordinatorRestartAdmission` / `coordinator-admission`, `killCoordinatorProcess` / `daemon/process`, `readCoordinatorRecords` / `state/coordinator`, the loop's own pure verdict and schedule modules, `createOpencodeSessionTotalsReader` / `harness/telemetry-session-totals`, the delivered `terminate` port member.

**Steps**:
1. Assert every seam symbol is imported from its declared production module by the battery (import identity).
2. Scan the loop battery's test surface for a locally re-expressed seam: a local lease fold, a local budget fold, a local `kill`/`process.kill` sequence, a local backoff loop with a timer, a local lane seeder used as a corroborator, a local token/verdict derivation.
3. Plant a temp copy of a battery fixture with a local claim fold; assert the check rejects it by name.

**Expected Outcome**:
- Import identity holds for every seam; 0 locally re-expressed seams on the live tree.
- The planted control is rejected with `reimplementation of <seam> in <file>`, proving the check is not vacuous.
- No battery file constructs a session/stop/restart record directly instead of through the production writer.

#### TC-BATTLE-003 - Two consecutive runs are identical with zero live network, zero real children, and zero real waits

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-2, NFR-1, DM-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/loop/loop-parity-battery.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: every seam replayed under the guards and the canonicalizer
**Fixture mechanism**: two fresh temp roots, a fixed clock, a fixed id sequence, the canonicalizer from `tests/fixtures/loop/parity/evidence.ts`, and the guards.

**Preconditions**:
- Guards: a `fetch` spy that records and refuses (live network), the guarded runner's real-start counter (real children), and the delay recorder's real-timer spy (real waits).
- The registry is the only driver, so "the whole battery" is defined by its contents.

**Steps**:
1. Call `runAllLoopParityCases()` twice in isolated roots.
2. Canonicalize and compare: envelopes (sorted keys, `<root>` normalized), per-group and per-kind record counts, verdict coverage, and the ordered delay lists.
3. Assert every guard counter is zero.
4. Assert the executed row count equals the registry length in both runs.

**Expected Outcome**:
- Canonical output is byte-identical between the runs.
- Per-group record counts identical; verdict coverage identical (the same verdict set in both runs); delay lists identical and ordered.
- `liveNetworkRequests === 0`, `realChildStarts === 0`, `realTimersArmed === 0`, `shellInvocations === 0` in both runs; the injected transport/session/process doubles saw every call.
- No asserted value depends on wall-clock time, an absolute path, or iteration order.

#### TC-BATTLE-004 - The guarded runner records zero shell invocations and the loop prompt carries no script path

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-3, API-6, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/loop/loop-parity-battery.test.ts` + `tests/conformance/loop/loop-pick-deliver-merge.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-exec` — the guarded injected runner over every child seam, plus the production prompt builder
**Fixture mechanism**: `createGuardedRunner` from the GH-347 fixtures, reused unchanged; the production loop-prompt module read directly.

**Preconditions**:
- The guarded runner wraps every injected child seam (`harnessSpawnRunner`, `harnessSpawnStarter`, and any git/CLI runner the pick-deliver-merge cycle composes).
- The guard refuses a shell file, a script-path argument, and a shell-enabling option, by name.

**Steps**:
1. Run the whole registry (the eight non-`no-shell` groups) under the guarded runner.
2. Assert the guard's counters and each recorded invocation's argv and `shell` value.
3. Build the declared loop prompt through the production builder and scan its text for a script-path literal, `scripts/`, `tools/`, `.sh`, and the shell entry-point names (`ceo-loop`, `deliver-ticket`).
4. Assert the prompt names the jaiship primitives it instructs the session to call.

**Expected Outcome**:
- `shellInvocations === 0`, `scriptPathInvocations === 0`; every spawn carries `shell: false`.
- 0 script-path literals in the prompt; 0 shell entry-point names; the primitive names are present (non-vacuity for the prompt scan).
- A requested shell or script path is a hard failure naming the seam and the offending value.

#### TC-BATTLE-005 - The delivered no-shell surface is extended over the loop modules and fails by name on a planted reference

**Scenario Type**: Invariant
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-3, API-6, NFR-9, DOD-5
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/no-shell-dispatch.ts` (extended) + `tests/checks/no-shell-dispatch.test.ts` (extended)
**Tags**: @backend, @checks, @offline
**Seam**: `S-exec` — the static invariant over the extended declared surface
**Fixture mechanism**: the delivered `scan`/`scanSource` functions unchanged, the extended `DISPATCH_FLOW_SURFACE`, and the existing temp-workspace planted-reference machinery.

**Preconditions**:
- The delivered four rules (`script-path literal`, `shell-enabled spawn`, `shell-exec import`, `child-process spawn without shell:false`) and the empty allowlist are reused **as is**: no new invariant module, no new rule.
- The declared surface gains the loop modules: `packages/core/src/app/loop-*.ts`, `packages/core/src/domain/loop-*.ts` (including `loop-prompt.ts`), `packages/cli/src/commands/loop.ts`, and the loop's state module.

**Steps**:
1. Assert the extended surface's declared set equals `dispatch-* globs + loop-* globs + the fixed entries` (so a new loop module can never be silently unscanned, exactly as a new dispatch module cannot).
2. Assert every declared file exists and is reachable from the declared entries (the reachability guard gains the loop entries).
3. Run the invariant over the live tree: assert 0 violations.
4. Plant one reference per rule class in a temp workspace, including a `scripts/ceo-loop.sh` literal inside a declared loop file, and assert each is reported by rule and `file:line`.
5. Assert the false-positive controls still pass (`shell: false` in the host starter; a `scripts/checks` reference outside the surface; `.sha`/`shift`/`RegExp.exec`/port-`.spawn`).
6. Assert no second no-shell invariant module exists (a scan for another module exporting a shell scan with the same rule set fails by name).

**Expected Outcome**:
- Live tree: 0 violations; 0 missing surface files; 0 unreachable surface files.
- Each planted reference fails by name: `no-shell invariant: script-path literal at <file>:<line>`, `...: shell-enabled spawn ...`, `...: shell-exec import ...`, `...: child-process spawn without shell:false ...`.
- All false-positive controls report nothing; the allowlist stays empty and its mechanism is still exercised.
- Zero new invariant modules: the property is proven by adding files to the one declared list.

#### TC-BATTLE-006 - The pick-deliver-merge cycle runs the real `dispatch` deliver leg over the real runtime with zero shells and zero kills

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, F-1, F-5, AC-F8-4, API-6, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/loop/loop-pick-deliver-merge.test.ts` + `tests/fixtures/loop/parity/e2e.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-spawn` + `S-verdict` + `S-verb` — the spawn, the cycle's observation, and the real command runtime the doubled session drives
**Fixture mechanism**: `tests/fixtures/loop/parity/e2e.ts` (the pick-deliver-merge scenario builder) over the D2 composed program, the recording session port with a two-agent script, the guarded runner, and the recording delay.

**Preconditions**:
- **Doubled** (four things, all at declared injection points):
  1. **Harness session** — one scripted session port whose `spawn` returns a handle and, while the CEO session is "running", invokes the real command runtime for the three primitives: **`queue claim` (pick)**, **`dispatch` (deliver)**, **`merge` (merge)**, each through `runCli` against the same composed program and the same store. The **nested PM session that `dispatch` spawns is doubled by the same scripted port**: the port dispatches on the caller agent identity (`ceo` vs `pm`) and on the title prefix (`ceo-loop-` vs `ticket-<REF>`), so the two sessions never collide and the nested dispatch runs to completion.
  2. **Tracker and PR effects** — a deterministic transport fixture plus seeded merge/PR artifact fixtures, so the three primitives land real records without a live tracker.
  3. **Process runner** — the guarded runner (records, refuses shell, counts real starts).
  4. **Clock and delay** — the recording cycle driver and the injected delay, so all waits are virtual and recorded — including the nested `dispatch`'s own tracker ladder and terminate grace.
- **Real** (five things): the command runtime (`runCli`/`runEntrypoint`), the `loop` **and** `dispatch` command definitions and grammars, the loop supervision cycle, the durable state store (ledger + `loop.session`/`loop.stop`/`coordinator.fence`/`coordinator.restart`/`coordinator.stuck` + the dispatch lane and attempt records), and the status/log projections.
- The progress source double yields a monotonic per-session token total that increases after each primitive runs, so the cycle observes sourced progress rather than a fabricated zero.
- **`phase complete` is not the deliver primitive and is not invoked for the deliver leg.** It is a PM lifecycle transition; naming it as delivery would prove pick → lifecycle transition → merge instead of the ticket's pick → deliver → merge. The deliver primitive is `dispatch`, the delivered jaiship replacement for `scripts/deliver-ticket.sh`.

**Steps**:
1. Run `loop start --foreground` for two iterations.
2. Assert the spawn: one fresh CEO session, `--agent ceo`, one resolved `--model`, exactly one `ceo-loop-<stamp>` title, and the declared prompt (no script path, and it names `queue`, `dispatch`, and `merge` as the primitives).
3. Assert the doubled session's three primitive invocations, in order, each with a real success envelope: `queue claim`, then **`dispatch`**, then `merge`.
4. Assert the nested `dispatch` envelope specifically: its result token and exit from the delivered projection, its attempt record and its terminal `dispatch.lane` record, and that its nested PM spawn carried `--agent pm` with a `ticket-<REF>` title (so the nested leg is the real dispatch path, not a stub).
5. Assert the artifacts landed (the dispatch attempt/lane records, a merge record) and that the cycle's artifact-advance read saw them.
6. Assert the cycle's verdicts: 0 `stuck`, 0 verdict records, 0 terminates, 0 `coordinator.restart` records.
7. Assert the session ends on the declared clean-end cause and the next iteration starts: one new `active` session record, no ordinal consumed, and the wait before it is the collection interval.
8. Assert the guards: `shellInvocations === 0`, `scriptPathInvocations === 0`, `realChildStarts === 0`, `liveNetworkRequests === 0`.

**Expected Outcome**:
- One CEO spawn, then exactly three primitive invocations — `queue claim` (pick), **`dispatch`** (deliver), `merge` (merge) — through the real command runtime, then a clean session end, then one new session, with the loop healthy throughout.
- The deliver leg's envelope is the real `dispatch` result: a token and an exit from the delivered projection, one attempt record, and a terminal lane record; the nested PM session is a `pm`/`ticket-<REF>` spawn from the same port. An implementation that runs `phase complete` in place of `dispatch` fails by name (register `M102`).
- Zero kills, zero restarts, zero stuck verdicts, zero shell entry points on the path, zero shell invocations recorded, zero real waits.
- **Proof level (R-03):** the deliver leg is proven **at command-runtime level with a doubled nested PM session, and no further**. The nested PM session's live behaviour — a real agent's real delivery — stays outside the boundary under the existing `live-opencode` not-proven id, so the boundary constant remains nine proven / six not-proven with no seventh id; and this case does not claim a live tracker, CI, or merge outcome (`real-pick-deliver-merge`).
- **Boundary honesty**: this proves the typed flow never invokes the shell entry points and never substitutes a lifecycle transition for a delivery primitive; it does not prove the CEO agent's live behaviour (see §1.2 and `TC-BATTLE-007`).

#### TC-BATTLE-007 - The proof boundary is a permanent constant: nine proven, six not-proven, in order, no row off-boundary

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-5, DM-9, NFR-1
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/loop/loop-parity-battery.test.ts` + `tests/fixtures/loop/parity/evidence.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: none executed; the permanent constant is checked for shape, order, and registry consistency
**Fixture mechanism**: `LOOP_PARITY_PROOF_BOUNDARY` — the only source of the boundary.

**Preconditions**:
- `LOOP_PARITY_PROOF_BOUNDARY.proven` = exactly `["verbs","log","spawn","stuck","kill","backoff-budget","stop","single-instance","no-shell"]`, in that order (spec Appendix G).
- `LOOP_PARITY_PROOF_BOUNDARY.notProven` = exactly `["live-opencode","live-provider","os-termination","real-pick-deliver-merge","long-run-loop","cross-process-race"]`, in that order.
- The registry's `declaredSeam` values from `TC-BATTLE-001`.
- No other input: the case reads no change artifact, no `doc/changes/**` path, and no specification.

**Steps**:
1. Assert `proven` deep-equals the nine-id array (count and order).
2. Assert `notProven` deep-equals the six-id array (count and order).
3. Assert every registry row's `declaredSeam` is a member of `proven`; assert no row's seam is a member of `notProven` and none starts with `live-`.
4. Planted controls in a temp-workspace copy of the constant, each of which must fail by name: append a tenth proven id; remove one proven id; swap two proven ids; append a seventh not-proven id; add a registry row whose `declaredSeam` is `live-opencode`.
5. Assert this suite's own source contains no `doc/changes/` reference, so the check can never regress into reading a change artifact.

**Expected Outcome**:
- `proven` is exactly 9 ids and `notProven` is exactly 6 ids, each byte-equal and in the declared order; the check passes on the live tree.
- Zero rows declare a not-proven or unclassified surface.
- The planted controls fail by name: `proof boundary drift: proven expected 9 ids, received 10`; `... received 8`; `proof boundary drift: proven order expected [...], received [...]`; `proof boundary drift: notProven expected 6 ids, received 7`; `loop battery row <id> declares a not-proven seam live-opencode`.
- The suite source scan finds 0 `doc/changes/` references; a re-added one fails by name.
- The case asserts nothing about the current-truth page: publication and page/constant agreement belong to phase 7 and the doc guard (§1.2).

#### TC-BATTLE-008 - The prompt-required inventory is repinned to 27 with `loop` last across all three pinned suites, and the removal control fails by name

**Scenario Type**: Invariant
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, DOD-8, NFR-7, RSK-8
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/install-conformance-mutants.test.ts`, `tests/structure/metrics-mounting.test.ts`, `tests/checks/reference-page-parity.test.ts` (all extended); `tests/fixtures/metrics/mounting.ts`, `tests/fixtures/help-guide/coverage.json`, `scripts/checks/help-guide-coverage.ts` (all extended)
**Tags**: @backend, @checks, @offline
**Seam**: `S-verb` — the prompt-required inventory, the help inventory, and the coverage matrix
**Fixture mechanism**: the delivered comparators, repinned; the delivered temp-tree mutant writer.

**Preconditions**:
- `PROMPT_REQUIRED_COMMANDS` has 27 entries, `loop` last, `install` at index 25 immediately before it, `supervise` at 24, `metrics` at 23.
- This is a **pin update, not a relaxation**, and it touches **three** pinned surfaces (spec v1.1 §8.5, `DOD-8`, `DEC-7`): the install-family comparator keeps its count, missing/undeclared, and tail rules; the metrics-mounting suite keeps its positional and count assertions **and its stale-pin scan set gains 26**; the reference-page-parity suite's duplicated page mapping **learns the M4 root**. No assertion is deleted or inverted.

**Steps**:
1. Assert the family comparator: 27 entries; every declared name present; no undeclared name; the tail is `loop`; `install` is immediately before `loop`.
2. Assert the mutation control: a list with `loop` removed fails by name with both `missing loop` and `tail is not loop`.
3. Assert root help lists 27 families with `loop` last, `install` second-last, `metrics` at index 23, and every delivered family still present.
4. Assert every pinning file reads 27 and no stale 23/24/25/**26** survives outside the declared residual; assert the stale-pin scan **detects a planted 26-family pin** (the stale set must be extended to include 26, so a leftover pin cannot survive the repin undetected).
5. Assert the coverage inventory: `commands` contains `loop` and its `referencePages` contains `doc/planning/oss-tooling/milestones/m4/commands/loop.md`; the inventory still names exactly the prompt-required set in both directions.
6. Assert **both** page mappings resolve `loop` to the M4 page: `runHelpGuideCoverage`'s `pageFor` **and** `tests/checks/reference-page-parity.test.ts`'s own duplicated `pageFor` chain. A mapping that still returns the M1 path must fail by name (it would otherwise read `doc/planning/oss-tooling/milestones/m1/commands/loop.md`, which never exists).
7. Assert the help entry surface: a family entry for `loop` plus one entry per declared verb, each see-also pointing at the M4 page.
8. Assert the page exists, carries `--help` and `--version`, and carries an `ados_distribution` marker.

**Expected Outcome**:
- All of 1–8 pass on the live tree: 27 families, `loop` last, one M4 page, no stale pin, and both page mappings resolving to the M4 root.
- The removal control fails by name, proving the repin did not weaken the gate; the planted 26-family pin fails by name, proving the stale set was extended rather than merely moved.
- The reference-page-parity assertion is not vacuous: if the duplicated mapping is left at the M1 fallback, the coverage failure `missing reference page doc/planning/oss-tooling/milestones/m1/commands/loop.md` is produced by name.
- A `loop` mounted without the production composition is impossible by construction: `selectPromptRequiredProgram` throws for a prompt-required name the program lacks, and a registered extra is dropped — so "prompt-required without composition" cannot ship (asserted as a structural fact over the entrypoint).
- The delivered `install` family's own entries and pages are unchanged.

#### TC-CONTRACT-001 - The closed contract surface is unchanged against an in-suite literal baseline, and exactly three additive facts exist

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-7, DOD-6, NG-4, NG-9
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/loop-contract-invariance.test.ts`
**Tags**: @backend, @checks, @offline
**Seam**: none executed; the declared contracts are compared against a pinned baseline
**Fixture mechanism**: a **committed literal baseline inside the suite itself** — `BASELINE` in `tests/checks/loop-contract-invariance.test.ts`, holding the error table (code, kind, projection class), the domain-kind set, the configuration key set with its six `coordinator.*` defaults, the coordinator payload schema ids and their version fields, and the harness capability vocabulary. **No fixture file is authored or declared**: this is a pure in-process comparison of imported data against a literal, so it starts no child process and makes no I/O beyond the imports (`NFR-1`).

**Preconditions**:
- The delivered baselines as read on `feat/GH-348/loop-supervision`, transcribed into the literal once and reviewed as data.
- The delivered coordinator suites' green result is **not** captured here: running them would start real child processes and violate `NFR-1`. Their unmodified pass is a **gate-battery read** (§7.5, "Untouched delivered surfaces"), recorded in §10, not a case.

**Steps**:
1. Compare the live error table (codes, kinds, projection classes) against the literal: assert 0 added, 0 removed, 0 changed.
2. Compare the domain-kind set: 0 added.
3. Compare the configuration key set and the six `coordinator.*` defaults: 0 added, values unchanged.
4. Compare the coordinator record payload schema ids and their version fields: 0 changed, 0 bumped.
5. Compare the harness capability vocabulary: 0 added.
6. Assert exactly **two** new record kinds exist (`loop.session`, `loop.stop`) and exactly **one** additive optional harness fact (`pid`), each reachable from the loop modules and not from the coordinator ones.
7. Assert the loop imports no agent-file or script writer (no `writeFile` of a `.opencode/agent` path, no `scripts/` path), so `DOD-7`'s prompt half cannot regress silently.

**Expected Outcome**:
- 0 new error identities; 0 new domain kinds; 0 new configuration keys; 0 changed coordinator records/payloads/defaults/behaviour; 0 delivered schema-version bumps.
- Exactly 2 new record kinds and exactly 1 additive optional harness fact, both asserted as data (not by counting a growing list).
- The suite spawns nothing and reads nothing outside its imports and the repository's own source; `realChildStarts === 0` for it in `TC-BATTLE-003`'s guard sweep.
- The "delivered coordinator suites pass unmodified" observation belongs to the gate battery (§7.5) and to `DOD-6`, never to this case.

#### TC-CONTRACT-002 - Record, log, and diagnostic hygiene holds across the whole battery

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-10, DM-1, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/loop/loop-parity-battery.test.ts` + `tests/checks/loop-privacy.test.ts` (new)
**Tags**: @backend, @loop, @parity, @offline
**Seam**: every record and log writer driven by the registry
**Fixture mechanism**: canaries in the prompt, the environment, a credential fixture, and a synthetic provider payload; the whole battery's records and logs.

**Preconditions**:
- The whole registry executed with the canaries present.
- Every `loop.session`, `loop.stop`, `coordinator.fence`, `coordinator.restart`, `coordinator.stuck`, and economics record produced.

**Steps**:
1. For every new record: assert the exact key set (no extra key) and scan every string value for the canaries and for prompt/transcript/diff/credential/provider/model/seat content.
2. Assert the evidence corpus of every verdict is ≤ 512 UTF-8 bytes.
3. Assert every diagnostic, summary, and log line is single-line and identifier-only.
4. Assert a source-level scan of the loop surface contains no seed-token literal list outside the scanner mechanism or the battery.
5. Assert the canaries were genuinely present (non-vacuity).

**Expected Outcome**:
- 0 canary occurrences in any record, log line, summary, or diagnostic.
- `loop.session`: exactly the DM-1 key set, no prompt/transcript/model/seat; `loop.stop`: exactly the DM-2 key set.
- Every evidence corpus ≤ 512 bytes; every diagnostic single-line and bounded.
- The non-vacuity assertion passes.

#### TC-CONTRACT-003 - One evaluation read per cycle, and zero extra reads or writes for the read-only verbs

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-11, AC-F1-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-read-cost.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: `S-lease` + `S-status` — the counting store facade
**Fixture mechanism**: `createLoopHarness` with `counters.reads` and `counters.evaluationReads` (mirroring `tests/behaviour/coordinator-read-cost.test.ts`).

**Preconditions**:
- A seeded epoch with five restart records, a live session, and a readable corroborator.

**Steps**:
1. Assert one cycle performs exactly one **evaluation** read (the delivered append-time post-write coverage read is excluded, exactly as the coordinator's read-cost case excludes it).
2. Assert an exhaustion cycle also performs exactly one evaluation read.
3. Assert `status`, `log`, and `reset` perform 0 evaluation reads beyond the one the projection needs, and 0 appends.
4. Assert a read-only verb performs no more reads than a single snapshot.

**Expected Outcome**:
- Every cycle: 1 evaluation read; the exhaustion cycle: 1.
- `status`: 1 read, 0 appends; `log`: 1 read (the log file is not a store read), 0 appends; `reset` with no request: 0 appends.
- No cycle reads the store twice for the corroborator and the verdict: the shared snapshot is asserted by identity (the same read result object).

#### TC-CONTRACT-004 - Zero configuration keys are added and the six delivered keys are consumed with their shipped defaults

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-7, DM-8
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/loop-contract-invariance.test.ts` + `tests/fixtures/loop/harness.ts`
**Tags**: @backend, @checks, @offline
**Seam**: the resolved configuration surface and the declared policy data
**Fixture mechanism**: the resolved key set, the defaults module, and the declared policy module.

**Preconditions**:
- The six delivered keys with their shipped defaults.

**Steps**.
1. Assert the resolved key set has no `loop.*` branch and no new `coordinator.*` key.
2. Assert the six defaults exactly: 600 000, 20 000, 10, 100 000, 30 000, 300 000.
3. Assert the shell-knob mapping table: five keys value-identical to their knob, `coordinator.progress-bound` has no shell counterpart, and `CEO_LOOP_SLEEP_SECONDS`/`CEO_LOOP_MAX_ITERATIONS` map to no key.
4. Assert the backoff constants are declared policy data in one module, not configuration: no key's value is read to produce the schedule.
5. Assert the loop's supervisor consumes the keys as injected values (no ambient environment read).

**Expected Outcome**:
- 0 new keys; the six defaults byte-equal to the delivered values.
- The mapping table holds exactly; the two replaced shell knobs produce no key.
- The schedule is data in one place; a reviewer can read the whole policy without reading test code.
- No `process.env`/`Bun.env` read on the loop's supervision path.

#### TC-CONTRACT-005 - The loop domain tier is pure: no ambient clock, timer, environment, I/O, or network

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-1, NFR-11
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/loop-imports.test.ts` + `tests/checks/loop-mutants.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: the loop's pure domain modules
**Fixture mechanism**: the AST/source purity guard (the `coordinator-imports.test.ts` + `coordinator-mutants.test.ts` pattern) with temp-copy mutants.

**Preconditions**:
- The loop's pure modules: the verdict, the backoff schedule, the log-line renderer, the status projection, and the prompt builder.

**Steps**.
1. Assert no loop domain module imports `node:*`, `bun:*`, `fs`, `os`, `child_process`, `net`, `http`, or a state/adapters module.
2. Assert no loop domain module references `Date.now`, `new Date`, `performance.now`, `process.hrtime`, `setTimeout`, `setInterval`, `Math.random`, `process.env`, `Bun.sleep`, or `fetch`.
3. Assert the modules are data/functions only (no top-level side effect, no singleton).
4. Plant one mutant per class in a temp copy (a `Date.now`, a `setTimeout`, an `import { readFileSync } from "node:fs"`) and assert each is detected by name.

**Expected Outcome**:
- Live tree: 0 violations for all three assertions.
- Each planted mutant reported by name and file (`loop-backoff.ts: ambient clock/timer Date.now`, `loop-log-line.ts: forbidden module node:fs`, and the equivalent for the timer).
- The consequence is asserted, not assumed: `TC-BACKOFF-002`'s recorded-only waits and `TC-BATTLE-003`'s zero real timers depend on this purity.

#### TC-CONTRACT-006 - The loop imports the delivered engine primitives and reimplements no lease, budget, kill, or lock

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-7, NG-3, RSK-1
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/loop-imports.test.ts`
**Tags**: @backend, @loop, @offline
**Seam**: the engine-reuse boundary
**Fixture mechanism**: an import-identity manifest plus a forbidden-signature scan, with a planted control.

**Preconditions**:
- The delivered primitives: `decideCoordinatorClaim`, `evaluateCoordinatorRestartAdmission`, `killCoordinatorProcess`, `readCoordinatorRecords`, `readDispatchLanes`/`latestDispatchLaneFor`.

**Steps**:
1. Assert each primitive is imported from its delivery module by the loop supervisor and is not re-expressed locally.
2. Scan the loop surface for a local lease fold, a local ordinal fold, a local `process.kill`/signal sequence, a second lock file or pid-file probe, and a second budget counter.
3. Plant a local lease fold in a temp copy and assert it is rejected by name.
4. Assert the coordinator modules are unimported by the loop for their *cycle* (the loop must not reuse `createCoordinatorSupervisor`, `evaluateStuck`, or `decideLifecycle`), while the record kinds and folds are shared by identity key only.

**Expected Outcome**:
- Import identity holds for every primitive; 0 local folds; 0 second kill path; 0 lock/pid file.
- The planted local fold is rejected by name.
- The loop imports no coordinator *cycle* or *predicate* symbol: the record kinds and the keys are shared, the decisions are not — the exact `DEC-1`/`NG-3` boundary.

#### TC-PARITY-001 - A second start exits 2, not the shell's silent 0

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, §8.5 row 1, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-instance.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-lease` — the live-holder refusal
**Fixture mechanism**: a live lease seeded through the real claim; a second `runCli` invocation.

**Preconditions**:
- A live `loop-main` holder with a live process identity.

**Steps**:
1. Run a second `loop start --foreground`.
2. Assert the exit, the identity, the summary, and the record counts.

**Expected Outcome**:
- Exit 2 with `coordinator.already-running` and a summary naming the live holder — never exit 0 and never a silent success.
- 0 lease records appended by the second invocation; 0 session records; 0 spawns.
- The declared reason is recorded as intended behaviour: a refused start must not look like a completed one. This is the divergence, not a defect (`§8.5` row 1, `DEC-6`).

#### TC-PARITY-002 - A grammar refusal exits 1, not the shell's usage 2

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, §8.5 row 2, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-grammar.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-verb` — the grammar refusal
**Fixture mechanism**: the refusal table from `TC-VERB-002`.

**Preconditions**:
- One representative malformed form per rejection class: unknown verb, undeclared flag, malformed `--lines`.

**Steps**:
1. Run each; assert exit 1 and `fallback.invocation`.
2. Assert the closed projection maps `user-validation` to 1 and that exit 2 is reserved for the platform class.

**Expected Outcome**:
- Exit 1 in every row (the shell's usage exit is 2; the typed closure cannot map a user error to the platform class).
- Exit 2 is observed only on the platform identities (`coordinator.already-running`, `coordinator.process.capability-gap`, `coordinator.session.kill-failed`, `state.*`).
- The summary is `result=refused; reason=grammar`; 0 records.

#### TC-PARITY-003 - The restart budget is durable per epoch; only `--fresh-budget` resets it

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-4, §8.5 row 3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-backoff.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-backoff` — the durable epoch fold
**Fixture mechanism**: three consecutive starts over one store, then a `--fresh-budget` start.

**Preconditions**:
- A stuck episode per start so an ordinal is genuinely consumed.

**Steps**:
1. Run start 1 (consumes ordinal 1) and stop it; run start 2 (consumes ordinal 2) and stop it.
2. Assert the persisted count is 2 and the epoch is unchanged across both.
3. Run `--fresh-budget`; assert the count resets to 0 under a new epoch.

**Expected Outcome**:
- The count is durable across starts: 2 after the two runs — a crash-looping start cannot launder its own history.
- The epoch identity is unchanged until `--fresh-budget`; after it, the count is 0 and the epoch is `epoch-2`.
- The shell's in-memory-per-run counter is the divergence; the durable behaviour is the assertion.

#### TC-PARITY-004 - Stuck restarts back off while ordinary iterations use the collection interval

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, §8.5 row 4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-backoff.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-backoff` — the two wait reasons
**Fixture mechanism**: one world with a stuck restart and one with a clean end; the recording delay.

**Preconditions**:
- Epoch below the bound; a stuck episode and a clean end.

**Steps**:
1. Run the stuck restart; assert the recorded wait and reason.
2. Run the clean-end row; assert the recorded wait and reason.
3. Assert the two reasons are distinct and neither is a fixed 2 000 ms pause.

**Expected Outcome**:
- Stuck restart: `restart-backoff` with `min(2 000 × 2^(n−1), 300 000)` for the consumed ordinal.
- Ordinary iteration: `collection-interval` with 30 000 ms.
- Neither wait is 2 000 ms by default, and no wait is unrecorded. The shell's fixed pause is the divergence; the declared schedule is the assertion.

#### TC-PARITY-005 - A restart starts a fresh session; no context resume is attempted or claimed

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-2, §8.5 row 5, §7.3, DM-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-spawn.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-spawn` + `S-refind` — the restart spawn path
**Fixture mechanism**: a restart after a stuck verdict; a recorded prior session whose context-token count is *below* the delivered limit (the shell would resume it).

**Preconditions**:
- A recorded `ended` prior session with a readable context total below `coordinator.resume-context-limit` (100 000).
- A stuck restart reached below the budget bound.

**Steps**:
1. Run the restart.
2. Assert the spawn/resume calls and the new session record.
3. Assert `coordinator.resume-context-limit` was not read on the spawn path.

**Expected Outcome**:
- Exactly one fresh spawn with `--agent ceo`, one resolved `--model`, and one new `ceo-loop-<stamp>` title.
- Zero resumes **on this restart path**; the new session id differs; the new session record is `active` with its own acquisition. The loop's only resume path is the pid-less re-find, and it is asserted exactly once by `TC-INSTANCE-006` — the two assertions are about different paths and neither is vacuous.
- No resume-mode field is claimed anywhere; `coordinator.resume-context-limit` is not read (a counting config read observes none on this path).
- The divergence is asserted as intended: the typed surface has no total-context source, so a fresh start is the honest behaviour, and the deferred item's trigger is recorded in the spec (§7.3).

#### TC-PARITY-006 - `log` returns the bounded supervision log, never a session transcript

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, AC-F7-3, §8.5 row 6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-log.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-log` — the read projection's source
**Fixture mechanism**: a world where the session double emits a distinctive transcript-shaped line into its stdout, plus a seeded supervision log.

**Preconditions**:
- The session double's stream carries a shape that would be obvious if it appeared in `log` output.
- The supervision log has known lines.

**Steps**:
1. Run the cycle so the session produces output.
2. Run `loop log --lines 100`.
3. Assert the response is the supervision log's tail and contains no session-stdout content.

**Expected Outcome**:
- The response contains the declared `event=` lines and 0 lines from the session stream; no transcript, diff, or model output appears.
- The response's lines and bytes are within the declared bounds (`TC-LOG-005`).
- The divergence is asserted as intended (§8.5 row 6): the adapter consumes the session stream, so the loop's own bounded log is the only honest source.

#### TC-PARITY-007 - `stop` defaults to `drain`; `--mode immediate` is the additive opt-in

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-4, §8.5 row 7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stop.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-stop` — the mode default
**Fixture mechanism**: a running harness with a live session; two rows (no flag, and `--mode immediate`).

**Steps**:
1. Run `loop stop` with no flag; assert the folded mode, the terminate count, and the end behaviour.
2. Run `loop stop --mode immediate`; assert the folded mode, the terminate count, and the elapsed bound.

**Expected Outcome**:
- Default: `mode=drain`; 0 terminates; the session is finished, then the loop ends. This reproduces the shell's "honour the stop when the session ends, never kill".
- `--mode immediate`: `mode=immediate`; exactly 1 terminate; ends within the declared bound.
- The mode is explicitly recorded on the stop record, so an operator can see which mode was applied.

#### TC-PARITY-008 - No pre-iteration hook runs and no hook path is read

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-F1-1, §8.5 row 8, NG-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-spawn.test.ts` + `tests/checks/loop-contract-invariance.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-spawn` — the pre-spawn step set
**Fixture mechanism**: an environment whose `HOME` contains a planted `~/.ados/hooks/pre-opencode-iteration` script, and a guarded runner that would record its execution.

**Preconditions**:
- A planted hook script in the fixture home, executable, with a sentinel side effect path that the guarded runner would record if it ran.
- The environment variable names the shell used (`ADOS_HOOK_ENV_V1`-shaped data) are also present.

**Steps**:
1. Spawn through D1 with the planted home.
2. Assert the guarded runner recorded no hook invocation and no process ran the planted path.
3. Assert no loop module reads a hook path (source scan) and the sentinel side-effect file was not created.

**Expected Outcome**:
- 0 hook executions; 0 reads of a hook path; the sentinel file is absent.
- The spawn's step set is exactly: resolve the binding, build the fixed argv, spawn, record the session.
- The hook's absence is intended (`NG-11`): provider policy (F2) replaces it, not a port of the hook.

#### TC-PARITY-009 - No `CEO_LOOP_*` environment knob participates; the loop is unbounded

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, §8.5 row 9, DM-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-grammar.test.ts` + `tests/behaviour/loop-backoff.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-verb` + `S-backoff` — the configuration source and the iteration bound
**Fixture mechanism**: an environment carrying all six shell knobs with hostile values (`CEO_LOOP_STUCK_MINUTES=1`, `CEO_LOOP_MAX_RESTARTS=1`, `CEO_LOOP_SLEEP_SECONDS=999`, `CEO_LOOP_POLL_SECONDS=1`, `CEO_LOOP_KILL_GRACE_SECONDS=1`, `CEO_RESUME_TOKEN_LIMIT=1`), run beside a clean environment.

**Preconditions**:
- Two environments differing only in the six knobs; the same injected configuration values.

**Steps**:
1. Run the same stuck-and-restart scenario under both; compare the window, the grace, the bound, the delay list, and the observed iteration count.
2. Run `loop start --foreground --max-iterations 3`; assert the grammar refusal.

**Expected Outcome**:
- Both runs are byte-identical in the window, grace, bound, delays, and record counts: the environment knobs change nothing.
- The values are the six `coordinator.*` defaults; the two replaced knobs (`sleep`, max iterations) produce no observable effect.
- `--max-iterations` is an unknown option → `fallback.invocation` at exit 1 (`TC-VERB-002`), so no iteration cap exists; the driver's declared cycle count is the only bound in the battery.

#### TC-PARITY-010 - The typed stop and the shell stop are not interchangeable

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, AC-F4-5, §8.5 row 10, §20, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/loop-stop.test.ts`
**Tags**: @backend, @loop, @parity, @offline
**Seam**: `S-stop` — the ledger fold versus a workspace file
**Fixture mechanism**: a planted `.ai/local/ceo/stop` file in the checkout, and a folded `loop.stop` record in the store; a created-path recording FS.

**Preconditions**:
- Row A: a planted shell stop marker at `.ai/local/ceo/stop`, no typed record.
- Row B: a typed `requested` record, no shell marker.

**Steps**:
1. Row A: run `loop start --foreground`; assert it runs (the shell marker is not read).
2. Row B: run `loop start --foreground`; assert it folds the typed stop and exits 0 with `state=stopped`.
3. Run `loop stop` in row A's world; assert no `.ai/local/ceo/stop` is created and no shell marker is written.
4. Assert the shell script's bytes are unchanged (via the delivered `provider-surface` byte pin remaining green).

**Expected Outcome**:
- The loop reads no `.ai/local` path and writes none (0 created paths under `.ai/local`); the shell marker has no effect on the typed loop.
- The typed stop is honoured by the typed loop regardless of the shell marker's presence.
- Both paths' documented governance (each path's own stop and reset) is asserted as intended behaviour, not as a compatibility gap.

## 6. Environments and Test Data

**Environment.** Local developer workstation and CI, `bun test`, no network. Every run works inside the repository's approved temp root: `tmp/tmpdir` under `$PWD`, created with `mkdir -p tmp/tmpdir` and disposed in `finally`. `TMPDIR=$PWD/tmp/tmpdir` is exported for every command so `mkdtemp` never escapes the repository. The live state directory, `~/.config`, real provider credentials, and a real checkout are never read.

**Determinism devices.** A fixed clock instant; a fixed id sequence; the recording cycle driver (`tests/fixtures/coordinator/cycle-driver.ts`) as the only time source; the injected `delay(ms, reason)` recorder; a virtual clock advanced only by that recorder; the fixed provider profile and chain fixture; a fixed evidence corpus; the deterministic fence latch for the two-start interleaving; the process-tree model for termination.

**Isolation.** One temp state root per case (or per case group where a case intentionally spans a rebuild); the store is `openStore`/`reopenStore` over that root; the log sink writes under the same root at `loop/<loopId>.log`; `dispose()` and `rmSync` in `finally`. No fixture writes outside `tmp/tmpdir`; the change folder's `tmp/` is git-ignored.

### 6.1 Fixture inventory

**Exists — reuse, do not duplicate (15).**

| Fixture | What it gives |
|---------|----------------|
| `tests/fixtures/coordinator/harness.ts` | The in-process CLI harness pattern: temp state root, injected clock/ids/config/state/process/session seams, recording counters (`reads`, `evaluationReads`, `appends`, `spawns`, `resumes`, `joins`), seeded record helpers (`seedLease`, `seedIteration`, `seedRestart`, `seedStuckVerdict`), `dataOf`/`errorCodeOf`/`envelopeOf` |
| `tests/fixtures/coordinator/cycle-driver.ts` | The injected cycle driver: N deterministic boundaries, recorded bounded waits, stop/signal/throw events delivered by data, no timer |
| `tests/fixtures/coordinator/process-port.ts` | The recording `DaemonProcessPort`: declared capabilities, an alive map (`true`/`false`/no answer), start times, a signal log, a closed kill outcome, progress readings, a signal-failure control |
| `tests/fixtures/coordinator/states.ts` | Valid record builders for the delivered coordinator kinds, persistence sequences, torn/gapped roots, `spyStore`, `reopenCoordinatorStore`, `COORDINATOR_ID`/`EPOCH_ID` |
| `tests/fixtures/coordinator/evidence.ts` | `STUCK_WINDOW_MS`, `PROGRESS_BOUND_MS`, the 3×3×3 evidence matrix, fingerprint couples, progress windows |
| `tests/fixtures/coordinator/claim-race.ts` | Two independent store handles over one root with contention and serialization controllers, no sleep |
| `tests/fixtures/coordinator/lifecycle.ts` | The six lifecycle outcomes with their decision/reason/ordinal/effect, `CONTEXT_LIMIT` |
| `tests/fixtures/coordinator/blockers.ts` | Question/answer record builders, pickup/owner/escalation shapes, the lane-resume payloads |
| `tests/fixtures/state/harness.ts` | `makeIdentity`, `openStore`, `reopenStore`, `makeTempRoot`, `removeRoot`, `createTestEdge` (clock + fault injection) |
| `tests/fixtures/dispatch/parity/process-runner.ts` | `createGuardedRunner`: records `{seam,file,args,options}`, refuses a shell file and a script-path argument by name, counts real starts |
| `tests/fixtures/dispatch/parity/terminate.ts` | `createProcessTreeModel`: root + descendants, escaped runtimes tagged by session id and exact title, per-pid signal logs, `SignalRecord` |
| `tests/fixtures/dispatch/parity/interleave.ts` | `createFenceLatch`: deterministic `arrive`/`release` parking wired to the injected wait |
| `tests/fixtures/dispatch/parity/lane.ts` | `seedDispatchLane`, `seedDaemonLane`, `dispatchLanesOf`, `daemonLanesOf` — the corroborator's real seeders and readers |
| `tests/fixtures/dispatch/parity/evidence.ts` | `canonicalize(value, root)` — temp-root normalization plus stable JSON, reused for the two-run comparison |
| `tests/golden/helpers.ts` | `bufferSink`, `SYNTHETIC_BRAND` — the stream capture and brand used by the production suites |

**Must be authored — new files, in the same fixture family (9).**

| New file | Contents |
|----------|----------|
| `tests/fixtures/loop/harness.ts` | Driver D2: one composed edge registering `loop` over a temp state root; injected clock/id/config/session/process/progress/corroborator/log-sink/delay; a **handler-scoped** configuration double that counts handler reads separately from the composition's resolution and can be armed to fail acquisition or resolution (injecting the shipped defaults); `run(argv)`, `records()`, `counters` (appends, reads, evaluationReads, spawns, resumes, joins, terminates, signals, truncations, handlerConfigReads), `dispose()`. Mirrors `coordinator/harness.ts`; it does not re-express any supervisor decision. |
| `tests/fixtures/loop/session.ts` | The scripted harness session port for the loop: `spawn`/`resume`/`terminate`/`liveness`, a recorded `{file, args, options, stdin, title, agent, binding}` invocation list, a per-session monotonic token total (the progress source), a pid-present and a pid-absent mode, and a `scriptedSession` hook the pick-deliver-merge cycle uses to fire the primitives. |
| `tests/fixtures/loop/log-fs.ts` | The injected append-only log file-system double: `append`, `read`, `rotation` log, a created-path recorder, a scripted failure injector (append/rotation/read), and the retention arithmetic readers (`activeSize`, `generationCount`, `totalSize`). |
| `tests/fixtures/loop/facts.ts` | The injected fact builders and tables: progress (`positive`/`zero`/`unknown` with observation times), artifact advance booleans, corroborator readings, the two-signal verdict table, the corroborator decision table, the evidence-corpus candidates (including a maximal corpus), and the lifecycle/restart seeds the cases share. |
| `tests/fixtures/loop/parity/cases.ts` | **The one case registry.** `LOOP_PARITY_CASES` enumerates every battery row as `{id, group, declaredSeam, scenario, expected}`, where `group` is one of the nine proven ids. Exports `loopParityCasesOf(group)` and `runAllLoopParityCases()`. No suite re-expresses a scenario. |
| `tests/fixtures/loop/parity/evidence.ts` | The **permanent `LOOP_PARITY_PROOF_BOUNDARY`** (nine proven ids, six not-proven ids, declared order), the per-seam boundary-violation helper (mirroring `boundaryViolations`), and the canonicalizer re-export used by the two-run comparison. The only source of the boundary. |
| `tests/fixtures/loop/parity/seams.ts` | The import-identity manifest (seam → symbol → production module → mounting composition) and the reimplementation-signature registry consumed by `TC-BATTLE-002`, plus the planted-control helper. |
| `tests/fixtures/loop/parity/e2e.ts` | The pick-deliver-merge scenario builder: wires the scripted session that invokes `queue claim` (pick), **`dispatch` (deliver)**, and `merge` (merge) through the real runtime; doubles `dispatch`'s nested PM session from the same port (agent identity + title prefix); advances the token total after each; and exposes the observation (spawns, the three primitive envelopes including the nested dispatch's, dispatch attempt/lane records, artifacts, verdicts, restarts, waits, guard counters). |
| `tests/fixtures/loop/golden/status.ts` | The golden status blocks for the three seeded worlds — **running**, **stopped with a folded stop**, and **absent-identifier** (the world that proves a bare `key=` for every placeholder, with all keys present) — each with its human and `delivery.loop.v1` JSON pair; the golden `delivery.loop.log.v1` JSON; and the golden log-line corpus. Committed, reviewed, regenerated by an explicit command, never by blanket rewrite. |

**Extensions to existing files (9; not new files, and no relaxation).**

| File | Change |
|------|--------|
| `scripts/checks/no-shell-dispatch.ts` | Add the loop modules and the loop prompt module to the **existing** `DISPATCH_FLOW_SURFACE`. No new rule, no new invariant module, no allowlist entry. |
| `tests/checks/no-shell-dispatch.test.ts` | Extend the declared-surface equality to `dispatch-* globs + loop-* globs + fixed entries`; add the loop entries to `FIXED_SURFACE` and `SURFACE_ENTRIES`; keep every planted-reference and false-positive control. |
| `tests/checks/install-conformance-mutants.test.ts` | Repin the family comparator: 27, `loop` last, `install` immediately before it; keep count/missing/undeclared/tail rules; add the removal control that fails by name. |
| `tests/structure/metrics-mounting.test.ts` | Repin: 27 families, `metrics` at 23, `supervise` 24, `install` 25, `loop` 26; extend the stale-pin set to include 26; keep the planted-stale-pin control. |
| `tests/fixtures/metrics/mounting.ts` | `MOUNTED_FAMILIES` gains `loop` (27); the declared history chain gains the `loop`-appended set. |
| `tests/fixtures/help-guide/coverage.json` | `commands` gains `loop` (27); `referencePages` gains `doc/planning/oss-tooling/milestones/m4/commands/loop.md`. |
| `scripts/checks/help-guide-coverage.ts` | `pageFor("loop")` returns the M4 page (the M1 snapshot root must never serve it). |
| `tests/checks/reference-page-parity.test.ts` | Its own `pageFor` chain gains the same `loop` → M4 mapping; otherwise the suite reads an M1 path that never exists. |
| `tests/checks/doc-conformance.test.ts` | **Documentation phase (7), not delivery**: the new current-truth page's required phrases and the stale "the outer loop is only `scripts/ceo-loop.sh`" scan. Listed so the phase-7 work is not forgotten; a page/constant mismatch is a documentation-phase defect. |

**Deliberately unchanged (asserted, not edited).** `tests/structure/provider-surface.test.ts` (the `scripts/ceo-loop.sh` byte pin — `DOD-7`'s shell half), every delivered `tests/behaviour/coordinator-*.test.ts` and `tests/structure/coordinator-*.test.ts` (`DOD-6`'s "coordinator suites pass unmodified"), `tests/checks/coordinator-sequence.test.ts` (the `ceo.md` J1 sequence stays green because no prompt is edited), and `tests/fixtures/coordinator/harness.ts` (the optional `pid` keeps every existing double valid).

New test hosts (**17**): `tests/behaviour/loop-{grammar,status,spawn,backoff,stop,stuck,instance,log,read-cost}.test.ts` (9), `tests/structure/loop-{imports,production-composition,production-session}.test.ts` (3), `tests/checks/loop-{contract-invariance,mutants,privacy}.test.ts` (3), `tests/conformance/loop/{loop-parity-battery,loop-pick-deliver-merge}.test.ts` (2).

### 6.2 Seams and mechanisms the fixtures must provide

- **Deterministic two-start interleaving.** One composed program (one store) drives two concurrent `runCli` invocations. The GH-347 fence latch parks the first arrival at its wait; the harness starts the second, awaits its verdict, then releases the first, which re-reads and re-decides from the live lease. Both orderings run. Determinism comes from the latch, not from scheduler luck.
- **A recording delay with the four loop reasons.** One `delay(ms, reason)` composition fact with reasons `restart-backoff`, `collection-interval`, `terminate-grace`, and `fence-wait`, recording `(reason, ms)` and advancing the virtual clock. Production binds a real timer; the battery binds the recorder, so `NFR-1`'s "0 real waits" is measurable.
- **A scripted session with a monotonic token total.** The session double owns the progress reading: it returns a total that increases when the pick-deliver-merge scenario fires a primitive, and stays flat otherwise. This is the honest stand-in for `createOpencodeSessionTotalsReader`, which is the delivered seam the production composition mounts.
- **A pid-present and a pid-absent adapter mode.** The same session double supplies a child pid in one mode and nothing in the other, so `DM-3`'s absent path is exercised without fabricating a number.
- **The process-tree model.** The GH-347 `createProcessTreeModel` provides the root pid, descendants, an escaped runtime tagged by session id, one tagged by the exact title, a near-miss title, and unrelated pids, with per-pid signal logs and a close-on-TERM script — the only way to assert "no unrelated signal" and "only after the grace" without signalling anything.
- **A read-only corroborator over real lane records.** `seedDispatchLane`/`seedDaemonLane` write real `dispatch.lane`/`daemon.lane` records through the delivered ledger append; the loop's corroborator reads them through the production read path. No new lane fixture and no lane writer on the loop side.
- **A log sink with retention arithmetic.** The log FS double is the only way to cross 1 MiB twice and observe which generation was dropped, without writing 2 MiB to disk in a test.
- **The whole-battery registry.** `LOOP_PARITY_CASES` is the single place a parity scenario is defined, so a suite and the sweep cannot drift, and "the nine proven surfaces" is a runnable thing rather than a list in a test body.

## 7. Automation Plan and Implementation Mapping

### 7.1 Battery architecture and seam exercise

**Eleven seams, each exercised through the function production uses.** The engine, the command definition, the CLI runtime, the projection, the record writers, and the state store are always the production ones.

| Seam | Production identity | Exercised by | What is real |
|------|--------------------|--------------|--------------|
| `S-verb` | the `loop` command definition through `runCli`; the delivered projection for exits | `TC-VERB-001`, `-002`, `-005`, `TC-PARITY-002`, `TC-PARITY-009` | the grammar, the refusal producers, the projection table |
| `S-status` | the status projection and text renderer, fed by the composition's resolved settings | `TC-VERB-003`, `TC-VERB-004`, `TC-INSTANCE-006` | the projection, the renderer, the key order (`stop_mode` after `stop_signal`), the empty-value rule, the composition-supplied bound |
| `S-spawn` | the composition → `resolveHarnessAdmissionBinding` → adapter `bindingSeams.invocationArgs` → starter | `TC-SPAWN-001`…`-005`, `TC-PARITY-005`, `TC-PARITY-008` | the resolver, the adapter's argv rendering, the recorded invocation |
| `S-session-record` | the `loop.session` append/read fold | `TC-SPAWN-006`, `TC-INSTANCE-002`, `TC-INSTANCE-006` | the fold, the key, the reader |
| `S-backoff` | the exported pure schedule + the inject delay + the delivered `evaluateCoordinatorRestartAdmission` | `TC-BACKOFF-001`…`-007`, `TC-PARITY-003`, `TC-PARITY-004` | the schedule data, the admission fold, the ordinal source |
| `S-stop` | the `loop.stop` append/read fold and the mode decision | `TC-STOP-001`…`-007`, `TC-PARITY-007`, `TC-PARITY-010` | the fold, the identity scoping, the mode |
| `S-verdict` | the loop's pure two-signal predicate | `TC-STUCK-001`, `-002`, `-011` | the predicate itself |
| `S-corroborator` | the real lane read over the real store plus the delivered process-port liveness probe; **no** start-time or age fact | `TC-STUCK-003`, `-005`, `-009`, `-010` | the read path, the D1–D6/M1–M6 evidence classes, the F0–F3 fold, the pid-only owner rule |
| `S-terminate` | the delivered adapter `terminate` / `killCoordinatorProcess` over the process-tree model | `TC-STUCK-007`, `-008`, `TC-STOP-005` | the ordering, the grace, the identity selection, idempotence |
| `S-lease` | `decideCoordinatorClaim` mounted at the loop composition's claim | `TC-INSTANCE-001`, `-004`, `-007`, `TC-PARITY-001` | the fence, the liveness-first fold, the real store |
| `S-refind` | the delivered per-identity read plus the loop's session resolution | `TC-INSTANCE-002`, `-003`, `-005`, `-006` | the resolution, the read, the single-session invariant |
| `S-log` | the real log renderer, the `log` read projection, and the injected sink | `TC-LOG-001`…`-007`, `TC-PARITY-006` | the renderer, the retention rule, the read bounds |
| `S-exec` | the guarded injected runner (GH-347, reused), covering the nested `dispatch` leg's child seams | `TC-BATTLE-004`, `TC-BATTLE-005`, `TC-BATTLE-006`, `TC-STUCK-009` | the guard's refusals and counters, including the nested PM spawn |

**The deliver leg runs the real `dispatch` command (R-03).** `TC-BATTLE-006` invokes `dispatch` through `runCli` on the same composed program and store as the loop, and doubles the PM session that `dispatch` spawns from the same scripted session port (keyed by agent identity `ceo`/`pm` and by the title prefix `ceo-loop-`/`ticket-<REF>`). Nested execution is feasible with the delivered composition because the command runtime is a pure function over `(program, argv, streams, clock, ids)`, re-entry is at the command layer rather than inside a global, the two supervisors hold different lease keys (`loop-main` vs dispatch's queue lease), and every wait the nested leg performs (its tracker ladder and terminate grace) receives the same injected `delay` recorder. No `phase complete` substitution exists anywhere in the battery.

**One case registry, whose groups are the nine proven ids.** `LOOP_PARITY_CASES` (§6.1) enumerates every battery row with `{id, group, declaredSeam, scenario, expected}`. The dedicated suites import their group's builders instead of re-authoring the scenario. `TC-BATTLE-001` drives the whole registry; `TC-BATTLE-003` and `TC-BATTLE-004` drive `runAllLoopParityCases()`; `TC-BATTLE-007` reads the registry's `declaredSeam` values. The `no-shell` group's rows must **not** call `runAllLoopParityCases()` (that would recurse): they run the eight non-`no-shell` groups under the guard, call the static `scan(ROOT)`, and scan the production prompt — stated here so the implementation cannot introduce recursion.

**Reimplementation detection (three independent mechanisms, all in `TC-BATTLE-002`):**

1. **Import identity.** `seams.ts` declares each seam symbol and its production module; the battery must import that symbol from that module, and the composition must mount it. A test-local copy has a different module and fails.
2. **Forbidden signature scan.** The check fails if any loop battery file contains a seam's decision signature outside the seam consumer: a local lease/ordinal fold, a local retry loop with a timer, a local `kill`/`process.kill` sequence, a local lock or pid-file probe, or a fixture-written session/stop/restart record.
3. **Planted control.** A temp copy of a battery fixture with a local claim fold must be rejected by name.

No case may satisfy itself with a fixture-written record: the harness exposes no session/stop/restart writer other than the production one, and `TC-CONTRACT-002` scans the records the production writers produced.

### 7.2 No-shell proof design

Three complementary observations, one property. Their permanent contract is the fixture constant `LOOP_PARITY_PROOF_BOUNDARY` and the invariant named below; the change specification is design provenance only.

**(a) The injected process runner.** `createGuardedRunner` (GH-347, reused unchanged) wraps every injected child seam. It records `{seam, file, args, options}` and fails the run by name when the executable is a shell, an argument is a script path (ends `.sh`, starts `scripts/` or `tools/`, or contains `deliver-ticket`), or the options carry a shell-enabling member; it asserts `shell:false` at every call site and counts real process starts (always 0 in the battery). The sweep is the registry, not a list in a test body.

**(b) The static invariant, extended.** `scripts/checks/no-shell-dispatch.ts` keeps its four rules, its empty allowlist, and its declared-surface design; this change only **adds files** to `DISPATCH_FLOW_SURFACE` (the loop app modules, the loop domain modules including the prompt module, the `loop` command module, and the loop state module). `tests/checks/no-shell-dispatch.test.ts` extends its declared-equality assertion to `dispatch-* + loop-* + fixed entries` and its reachability entries to the loop composition, so a new loop module cannot be silently unscanned — the same non-vacuity discipline that protects the dispatch surface today. No second invariant module is authored; a scan for one fails by name (`TC-BATTLE-005`).

**(c) The prompt scan.** The production prompt builder's output is read directly and scanned for a script-path literal, `scripts/`, `tools/`, `.sh`, and the shell entry-point names, with a non-vacuity assertion that the primitive names are present. A prompt that names a shell entry point fails by name.

**Publication is not this battery's job.** The same boundary is published on `doc/spec/features/feature-loop-supervision.md` and reconciled in lifecycle phase 7; a page/constant mismatch is a documentation-phase defect verified by the current-truth doc guard in the aggregate, never by `TC-BATTLE-007`. No permanent suite reads `doc/changes/**`.

### 7.3 File mapping (new vs extended)

| TC group | Target file(s) | Status |
|----------|----------------|--------|
| `TC-VERB-001`…`-005`, `TC-PARITY-002`, `TC-PARITY-009` (grammar half) | `tests/behaviour/loop-grammar.test.ts` | To implement (new) |
| `TC-VERB-003`, `-004` | `tests/behaviour/loop-status.test.ts` + `tests/fixtures/loop/golden/status.ts` | To implement (new; three goldens including the absent-identifier world) |
| `TC-SPAWN-001`…`-003`, `-006`, `TC-PARITY-005`, `TC-PARITY-008` | `tests/behaviour/loop-spawn.test.ts` | To implement (new) |
| `TC-SPAWN-004` | `tests/structure/loop-production-composition.test.ts` | To implement (new) |
| `TC-SPAWN-005` | `tests/structure/loop-production-session.test.ts` + `tests/behaviour/loop-spawn.test.ts` | To implement (new, both) |
| `TC-BACKOFF-001`…`-007`, `TC-PARITY-003`, `TC-PARITY-004` | `tests/behaviour/loop-backoff.test.ts` | To implement (new) |
| `TC-BACKOFF-002` (purity half), `TC-CONTRACT-005`, `-006` | `tests/structure/loop-imports.test.ts` + `tests/checks/loop-mutants.test.ts` | To implement (new, both) |
| `TC-STOP-001`…`-007`, `TC-PARITY-007`, `TC-PARITY-010` | `tests/behaviour/loop-stop.test.ts` | To implement (new) |
| `TC-STUCK-001`…`-011` | `tests/behaviour/loop-stuck.test.ts` | To implement (new) |
| `TC-INSTANCE-001`…`-007`, `TC-PARITY-001` | `tests/behaviour/loop-instance.test.ts` | To implement (new) |
| `TC-LOG-001`, `-003`, `-004`, `-006`, `-007`, `TC-PARITY-006` | `tests/behaviour/loop-log.test.ts` | To implement (new) |
| `TC-LOG-005` | `tests/behaviour/loop-log.test.ts` (+ `TC-VERB-002` grammar rows) | To implement (new) |
| `TC-CONTRACT-003` | `tests/behaviour/loop-read-cost.test.ts` | To implement (new) |
| `TC-BATTLE-001`…`-004`, `-007`, `TC-LOG-002`, `TC-CONTRACT-002` | `tests/conformance/loop/loop-parity-battery.test.ts` + `tests/fixtures/loop/parity/{cases,evidence,seams}.ts` | To implement (new) |
| `TC-BATTLE-006` | `tests/conformance/loop/loop-pick-deliver-merge.test.ts` + `tests/fixtures/loop/parity/e2e.ts` | To implement (new) |
| `TC-BATTLE-005` | `scripts/checks/no-shell-dispatch.ts` + `tests/checks/no-shell-dispatch.test.ts` | Existing – update (extend the declared surface; no new rule) |
| `TC-BATTLE-008` | `tests/checks/install-conformance-mutants.test.ts`, `tests/structure/metrics-mounting.test.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/fixtures/metrics/mounting.ts`, `tests/fixtures/help-guide/coverage.json`, `scripts/checks/help-guide-coverage.ts` | Existing – update (repin; no relaxation) |
| `TC-CONTRACT-001`, `-004` | `tests/checks/loop-contract-invariance.test.ts` (+ the delivered unchanged coordinator suites as an execution gate) | To implement (new) |
| `TC-CONTRACT-002` (source half) | `tests/checks/loop-privacy.test.ts` | To implement (new) |

Split: **17 new test suites** (9 behaviour + 3 structure + 3 checks + 2 conformance), **9 new fixture modules** under `tests/fixtures/loop/**`, **9 extended files** (2 fixture/inventory data files, 3 check modules, 4 check/structure suites), and **0 edits to delivered coordinator suites, delivered dispatch suites, `scripts/ceo-loop.sh`, `.opencode/agent/**`, or the production `dispatch` surface**. No fixture file is authored for `TC-CONTRACT-001`: its baseline is a committed literal inside `tests/checks/loop-contract-invariance.test.ts` (R-16), so the fixture count stays at nine. Case-level split: **all 74 cases are new code**, of which 2 are extensions of a delivered invariant (`TC-BATTLE-005`) and the delivered pinned inventory (`TC-BATTLE-008`).

### 7.4 Mutation register

Each row is a source mutation applied to the implementation; the named case must fail, with the expected failure-message family. `M` rows are the non-vacuity proof for the load-bearing invariants. The register is executed by the reviewer/fixer, not committed as a permanent suite (a permanent mutation harness belongs to review tooling; the permanent suite is the case list itself).

**Pinned surfaces (4). Mandatory rows: the removal control and the repin controls.**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M1 | Remove `loop` from `PROMPT_REQUIRED_COMMANDS` | `TC-BATTLE-008` | `count 26 != 27` + `missing loop` + `tail is not loop` |
| M2 | Move the count to 27 but leave the comparator's tail expectation at `install`/`supervise` | `TC-BATTLE-008` | `tail is not loop` / `install is not immediately before loop` |
| M3 | Leave `MOUNTED_FAMILIES` at 26 (or drop `install`) while the command set is 27 | `TC-BATTLE-008` | `expected [<27 entries>], received 26` / a positional assertion failure |
| M4 | Leave the stale-pin scan set at `toHaveLength(2[345])` after the pin moves to 27 | `TC-BATTLE-008` | `stale family-count pin 26` |

**Proof boundary (4). Mandatory rows: dropping or adding a boundary id.**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M5 | Drop one id from `LOOP_PARITY_PROOF_BOUNDARY.proven` | `TC-BATTLE-007` | `proof boundary drift: proven expected 9 ids, received 8` |
| M6 | Add a tenth proven id | `TC-BATTLE-007` | `proof boundary drift: proven expected 9 ids, received 10` |
| M7 | Reorder two proven ids | `TC-BATTLE-007` | `proof boundary drift: proven order expected [...], received [...]` |
| M8 | Register a row whose `declaredSeam` is `live-opencode` (or `os-termination`) | `TC-BATTLE-007` | `loop battery row <id> declares a not-proven seam live-opencode` |

**Verbs and output (6).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M9 | Accept an undeclared flag on `loop start` | `TC-VERB-002` | `expected fallback.invocation at exit 1, received 0` |
| M10 | Project the grammar refusal to exit 2 | `TC-VERB-002`, `TC-PARITY-002` | `grammar refusal exit expected 1, received 2` |
| M11 | Accept `--lines 0`/`101`/`1.5` and fall back to 50 | `TC-LOG-005`, `TC-PARITY-002` | `--lines 0 expected a refusal at exit 1, received 50 lines` |
| M12 | Append a record on a grammar refusal | `TC-VERB-002` | `records appended expected 0, received 1` |
| M13 | Let `status` mutate state or spawn | `TC-VERB-004`, `TC-CONTRACT-003` | `appends expected 0, received 1` |
| M14 | Reorder the status keys | `TC-VERB-003` | `status key order expected [loop_running,loop_pid,ceo_alive,ceo_pid,ceo_session,stop_signal,...], received [...]` |

**Spawn identity (8).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M15 | Drop `--agent ceo` | `TC-SPAWN-001` | `args expected exactly one "--agent ceo", received 0` |
| M16 | Drop `--model`, or render two | `TC-SPAWN-001` | `expected exactly one --model <seat>, received <0\|2>` |
| M17 | Drop `--title`, or derive it from the wall clock | `TC-SPAWN-002` | `expected --title ceo-loop-<fixed stamp>` |
| M18 | Carry a title on a resume | `TC-SPAWN-002` | `resume args must not contain --title` |
| M19 | Spawn a session on an unassigned seat | `TC-SPAWN-003` | `expected provider.profile.invalid at exit 1, received a session` |
| M20 | Keep the lease on a pre-session refusal | `TC-SPAWN-003` | `lease fold expected released, received acquired` |
| M21 | Mount a second resolver, or read a policy/quota fact | `TC-SPAWN-004` | `loop composition mounts an undeclared resolver <symbol>` |
| M22 | Fabricate a pid (or write `0`) when the adapter supplies none | `TC-SPAWN-005`, `TC-INSTANCE-006` | `session record pid expected absent, received 0` |

**Session record (5).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M23 | Append a session record per cycle | `TC-SPAWN-006` | `session records expected 1, received 2` (quiet session) |
| M24 | Append a second `active` record per acquisition | `TC-SPAWN-006` | `active records expected 1, received 2` |
| M25 | Bump a delivered payload schema or add a domain kind | `TC-CONTRACT-001` | `closed surface changed: <surface> +<added>` |
| M26 | Add a `loop.backoff` configuration key | `TC-CONTRACT-004` | `closed surface changed: config key +loop.backoff` |
| M27 | Add a `pid` harness capability name | `TC-CONTRACT-001`, `TC-SPAWN-005` | `closed surface changed: capability +pid` |

**Backoff and budget (9).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M28 | Replace the schedule with a fixed 2 000 ms pause | `TC-BACKOFF-002`, `TC-PARITY-004` | `delay(2) expected 4000, received 2000` |
| M29 | Ignore the cap | `TC-BACKOFF-002` | `delay(10) expected 300000, received 512000` |
| M30 | Consume two ordinals per restart | `TC-BACKOFF-001` | `coordinator.restart records expected 1, received 2` |
| M31 | Admit a restart at the bound | `TC-BACKOFF-004` | `expected coordinator.restart-budget-exhausted, received a restart` |
| M32 | Consume an ordinal for a clean end | `TC-BACKOFF-006` | `restart records expected 0, received 1` |
| M33 | Use the delivered row's coordinator remediation as the loop's summary | `TC-BACKOFF-004` | `summary expected "loop start --foreground --fresh-budget", received "coordinator start --foreground --fresh-budget"` |
| M34 | Make the wait non-cancellable | `TC-BACKOFF-003` | `stop folded during the wait; expected the session effect not to run` |
| M35 | Reset the epoch counter on an ordinary start | `TC-PARITY-003` | `budget epoch expected epoch-1, received epoch-2` |
| M36 | Append a restart record without the replaced session identity | `TC-BACKOFF-001` | `restart record expected replacedSessionId, received absent` |

**Durable stop (8).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M37 | Append a second `requested` on a repeated stop | `TC-STOP-001` | `requested records expected 1, received 2` |
| M38 | Read the stop fold **after** the claim (or reuse the coordinator's per-holder action) | `TC-STOP-002`, `TC-PARITY-010` | `lease records expected 0, received 1` |
| M39 | Treat an unreadable fold as "not stopped" | `TC-STOP-003` | `expected a state.* failure at exit 2, received 0` |
| M40 | Append a `cleared` with no folded request | `TC-STOP-004` | `cleared records expected 0, received 1` |
| M41 | Terminate a session on `--mode drain` | `TC-STOP-005`, `TC-PARITY-007` | `terminate calls expected 0, received 1` |
| M42 | Signal a session whose process identity is unverifiable | `TC-STOP-005` | `signals expected 0, received SIGTERM` |
| M43 | Put a pid, holder, or instance on the stop payload | `TC-STOP-006` | `stop record carries forbidden key pid` |
| M44 | Scope the stop to the writing instance | `TC-STOP-007` | `rebuilt composition did not fold the stop` |

**Stuck verdict (9).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M45 | Drop the corroborator from the verdict | `TC-STUCK-003` | `expected progressing (live delivery in progress), received stuck` |
| M46 | Treat an unreadable corroborator as `none` | `TC-STUCK-005` | `expected unevaluable, received stuck` |
| M47 | Treat an unreadable progress reading as `zero` | `TC-STUCK-004` | `expected unevaluable, received stuck` |
| M48 | Seed the last-progress observation at the record's `acquiredAt` | `TC-STUCK-011` | `verdict recorded <n> ms after acquisition; expected none before window` |
| M49 | Reuse the coordinator's artifact-evidence predicate | `TC-STUCK-003`, `TC-CONTRACT-006` | `expected progressing (healthy delivery), received stuck` / `loop imports the coordinator cycle <symbol>` |
| M50 | Record a verdict without terminating | `TC-STUCK-001` | `terminate calls expected 1, received 0` |
| M51 | Record a verdict per cycle instead of per expectation | `TC-STUCK-004` | `verdict records expected 1, received 2` |
| M52 | Decide `stuck` without a live session | `TC-STUCK-001` | `expected progressing (no live session), received stuck` |
| M53 | Widen detection past the declared bound | `TC-STUCK-006` | `detection-to-restart expected <= 652000, received <n>` |

**Terminate (7).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M54 | Send KILL before TERM | `TC-STUCK-007` | `signal order expected [SIGTERM,SIGKILL], received [SIGKILL,...]` |
| M55 | Escalate before the grace elapses | `TC-STUCK-007` | `SIGKILL recorded at +<n>ms; expected >= 20000` |
| M56 | KILL a tree that is no longer listed | `TC-STUCK-007` | `SIGKILL sent to <pid> after the tree closed` |
| M57 | Signal an unrelated pid | `TC-STUCK-008` | `unrelated pid <unrelated> expected no signal, received SIGTERM` |
| M58 | Signal on an identity mismatch | `TC-STUCK-008` | `signals expected 0 on identity mismatch, received SIGTERM` |
| M59 | Report a mismatch as success | `TC-STUCK-008` | `expected coordinator.session.kill-failed at exit 2, received 0` |
| M60 | Reap by a broad name or prefix pattern | `TC-STUCK-008` | `reap target set expected [sessionId, title], received [pattern]` |

**Single instance (7).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M61 | Pre-read the lease then claim (no in-fence decision) | `TC-INSTANCE-001` | `expected 1 acquisition, received 2` |
| M62 | Spawn beside a live recorded session after a takeover | `TC-INSTANCE-002` | `spawn calls expected 0, received 1` |
| M63 | Treat an `active` pid-less session as ended | `TC-INSTANCE-006` | `spawn calls expected 0, received 1` |
| M64 | Make the loop identity `coordinator-main` | `TC-INSTANCE-004` | `loop start expected admitted, received coordinator.already-running` |
| M65 | Append two lease records for one takeover | `TC-INSTANCE-002` | `lease records expected 1, received 2` |
| M66 | Let the loop read the coordinator's records | `TC-INSTANCE-004` | `read returned <n> foreign-identity records` |
| M67 | Claim without a declared alive capability | `TC-INSTANCE-007` | `expected coordinator.process.capability-gap at exit 2, received a lease record` |

**Log (8).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M68 | Cut a line instead of dropping whole pairs | `TC-LOG-001` | `log line ended mid-pair at byte <n>` |
| M69 | Emit an ANSI escape | `TC-LOG-001` | `ANSI escape at log line <n>` |
| M70 | Rotate without dropping the previous generation | `TC-LOG-003` | `total expected <= 2097152, received <n>` |
| M71 | Rotate at 2 MiB instead of 1 MiB | `TC-LOG-003` | `active size expected <= 1048576, received <n>` |
| M72 | Change a verdict or exit when the log append fails | `TC-LOG-004` | `verdict expected stuck, received unevaluable` / `exit expected 0, received 2` |
| M73 | Write a prompt, model, or seat into a log line | `TC-LOG-002`, `TC-CONTRACT-002` | `forbidden content class "model" in log line <n>` |
| M74 | Create the log directory on a read | `TC-LOG-006` | `created paths expected 0, received <n>` |
| M75 | Borrow a failure identity for an unreadable log | `TC-LOG-007` | `expected exit 0 with unreadable=true, received an error identity` |

**Battery and no-shell (9).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M76 | Execute a registry row only in the dedicated suite (skip it in the sweep) | `TC-BATTLE-001` | `<n> declared rows executed, expected <m>` |
| M77 | Let a battery row reimplement the lease, budget, kill, or backoff | `TC-BATTLE-002` | `reimplementation of <seam> in <file>` |
| M78 | Introduce nondeterminism (ambient clock, unordered map) | `TC-BATTLE-003` | `run 1 and run 2 differ: <field>` |
| M79 | Perform a live network call or start a real child | `TC-BATTLE-003` | `live transport request observed: <url>` / `real process started: <file>` |
| M80 | Invoke a shell with a script path in the loop flow | `TC-BATTLE-004` | `shell invocation recorded: <file> <args>` |
| M81 | Put a script path in the loop's spawn prompt | `TC-BATTLE-004` | `loop prompt carries a script path: <literal>` |
| M82 | Add a loop module without declaring it in the surface | `TC-BATTLE-005` | `declared surface expected <globbed + fixed>, received <declared>` |
| M83 | Author a second no-shell invariant instead of extending the declared list | `TC-BATTLE-005` | `second no-shell invariant module <file>` |
| M84 | Plant a `scripts/` literal in a declared loop surface file | `TC-BATTLE-005` | `no-shell invariant: script-path literal at <file>:<line>` |

**Declared divergences (4).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M85 | Make a second start exit 0 (restore the shell behaviour) | `TC-PARITY-001` | `expected coordinator.already-running at exit 2, received 0` |
| M86 | Map a grammar refusal to the shell's exit 2 | `TC-PARITY-002` | `grammar refusal exit expected 1, received 2` |
| M87 | Re-point the loop's stop at `.ai/local/ceo/stop` | `TC-PARITY-010` | `stop marker created at .ai/local/ceo/stop` |
| M88 | Read the session transcript for `log` | `TC-PARITY-006` | `log response contains session transcript content` |

**Read economy, hygiene, purity (5).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M89 | Add a second state read per cycle | `TC-CONTRACT-003` | `evaluation reads expected 1, received 2` |
| M90 | Write a record from `status` or `log` | `TC-VERB-004` | `appends expected 0, received 1` |
| M91 | Emit a credential or prompt canary into a record | `TC-CONTRACT-002` | `forbidden content class "prompt" in <record>` |
| M92 | Exceed the 512-byte evidence corpus | `TC-CONTRACT-002`, `TC-BACKOFF-007` | `evidence corpus expected <= 512 bytes, received <n>` |
| M93 | Introduce an ambient timer or clock in the loop domain | `TC-CONTRACT-005` | `loop-backoff.ts: ambient clock/timer setTimeout` |

**Spec v1.1 ruling controls (8). These are the non-vacuity proof for `R1`–`R4` and the two cross-file pins; each names the ruling it protects.**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M94 | Render `none` for an absent identifier in the status block (`loop_pid=none`) | `TC-VERB-003` | `status block renders "none" for an absent identifier; expected a bare loop_pid=` |
| M95 | Drop `stop_mode`, or render the stop mode in `stop_signal` (`stop_signal=immediate`) | `TC-VERB-003` | `status key order expected [... ceo_session,stop_signal,stop_mode,loop_id ...], received [...]` / `stop_signal expected yes\|no, received immediate` |
| M96 | Apply the restart path after an unconfirmed termination | `TC-STUCK-008`, `TC-INSTANCE-005` | `restart records expected 0 after coordinator.session.kill-failed, received 1` / `spawn calls expected 0, received 1` |
| M97 | Report an unconfirmed termination as success, or leave the lease held | `TC-STUCK-008` | `expected coordinator.session.kill-failed at exit 2, received 0` / `lease fold expected released, received acquired` |
| M98 | Append zero or two outcome records on the unconfirmed path | `TC-STUCK-008` | `stuck outcome records expected exactly 1, received <0\|2>` |
| M99 | Read the configuration branch inside the `status` handler to obtain the `restarts` bound | `TC-VERB-004` | `handler configuration reads expected 0, received 1` |
| M100 | Drop the shipped-default fallback so `status` fails when configuration acquisition fails | `TC-VERB-004` | `expected exit 0 with the shipped-default bound, received <error identity>` |
| M101 | Leave `tests/checks/reference-page-parity.test.ts`'s duplicated mapping without the M4 root | `TC-BATTLE-008` | `missing reference page doc/planning/oss-tooling/milestones/m1/commands/loop.md` |

**DoR-iteration-1 remediation controls (14). These are the non-vacuity proof for the R-03/R-07/R-10–R-16 corrections and the spec v1.2 alignments; each names the case that must fail.**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M102 | Run `phase complete` in place of `dispatch` as the deliver leg (or label it as delivery) | `TC-BATTLE-006` | `deliver primitive expected dispatch, received phase complete` / `no dispatch envelope recorded` |
| M103 | Observe a pid-less `active` session without calling `resume` | `TC-INSTANCE-006` | `resume calls expected 1, received 0` |
| M104 | Default `--foreground` on `start` so the flag is optional | `TC-VERB-002` | `loop start expected fallback.invocation at exit 1, received 0` |
| M105 | Never emit `progress-unreadable` (or always emit `delivery-corroborator-unreadable`) | `TC-STUCK-004` | `degraded expected to contain progress-unreadable, received [...]` |
| M106 | Consume `startedAt`, or compare a start time / age, in the corroborator | `TC-STUCK-009`, `TC-STUCK-010` | `startedAt read on the corroborator path (<file>:<line>)` / `corroborator reported none for a live owner pid` |
| M107 | Fold a `delivering` daemon lane with an absent pid to `none` | `TC-STUCK-010` | `M3 expected unknown, received none` |
| M108 | Fold an unreadable store to `none` instead of `unknown` | `TC-STUCK-010` | `F0 expected unknown, received none` |
| M109 | Hardcode 652 000 ms instead of the bound formula | `TC-STUCK-006` | `row A' bound expected 682000, received 652000` / `bound literal 652000 in <file>` |
| M110 | Omit `iterationId`, set `stuckId !== iterationId`, or populate `killFailureReason` on a confirmed kill | `TC-STUCK-001`, `TC-STUCK-008` | `iterationId expected loop-main:3, received <value>` / `killFailureReason expected identity-mismatch, received null` |
| M111 | Report a clean end as a failure (error identity or non-zero exit) | `TC-VERB-001` | `clean end expected state=stopped at exit 0, received <error>` |
| M112 | Omit the `seq` component from the at-bound history reference | `TC-BACKOFF-004` | `history reference expected epoch-1;restarts=10;seq=<n>, received epoch-1;restarts=10` |
| M113 | Refuse `--json`/`--verbose`/`--pretty` as grammar errors | `TC-VERB-002` | `global flag --json expected acceptance on every verb, received fallback.invocation` |
| M114 | Render `loop_id` empty, or from the lease instance id, in the absent world | `TC-VERB-003` | `loop_id expected loop-main in every world, received <empty\|instance-id>` |
| M115 | Render `ceo_pid`/`ceo_session` from the recorded (ended) session instead of live-only | `TC-VERB-003` | `ceo_pid expected empty for a non-alive session, received <pid>` |

Total: **115 mutations**, M1–M115 contiguous (4 pinned + 4 boundary + 6 verbs + 8 spawn + 5 session + 9 backoff + 8 stop + 9 stuck + 7 terminate + 7 instance + 8 log + 9 battery + 4 divergence + 5 economy/hygiene/purity + 8 spec-v1.1 ruling controls + 14 DoR-iteration-1 remediation controls). Every load-bearing invariant named in §1 has at least one row, every row names the case that must fail, the two mandatory pin families are rows `M1`/`M2`/`M3`/`M4` and `M5`/`M6`/`M7`/`M8`, the four v1.1 rulings have their own controls `M94`–`M100` with the cross-file pin at `M101`, and the DoR-iteration-1 findings are controlled at `M102` (R-03's substitution), `M103` (R-07's resume), `M104` (R-13's defaulted `--foreground`), `M105` (R-12's degradation), `M106` (R-01's start-time ban), `M107`/`M108` (R-02's fold), `M109` (R-09's formula), `M110` (R-19's identity), `M111` (R-18's clean end), `M112` (R-20's history reference), `M113` (R-21's globals), `M114`/`M115` (R-06's sources).

### 7.5 Gate battery

Every command runs from the repository root with both environment prerequisites, because the lifecycle primitives (and the `commit` primitive in particular) probe the bare `commitlint` name and must not write outside the approved temp root:

```bash
mkdir -p tmp/tmpdir
export TMPDIR=$PWD/tmp/tmpdir
export PATH=$PWD/node_modules/.bin:$PATH
```

**Gates per group (run during delivery, after the phase that owns the group):**

| Group | Command |
|-------|---------|
| Verbs | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun test tests/behaviour/loop-grammar.test.ts tests/behaviour/loop-status.test.ts` |
| Spawn | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun test tests/behaviour/loop-spawn.test.ts tests/structure/loop-production-composition.test.ts tests/structure/loop-production-session.test.ts` |
| Backoff | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun test tests/behaviour/loop-backoff.test.ts tests/structure/loop-imports.test.ts tests/checks/loop-mutants.test.ts` |
| Stop | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun test tests/behaviour/loop-stop.test.ts` |
| Stuck | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun test tests/behaviour/loop-stuck.test.ts` |
| Instance | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun test tests/behaviour/loop-instance.test.ts` |
| Log | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun test tests/behaviour/loop-log.test.ts` |
| Battery | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun test tests/conformance/loop` |
| Contract | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun test tests/checks/loop-contract-invariance.test.ts tests/checks/loop-privacy.test.ts tests/behaviour/loop-read-cost.test.ts` |
| Parity | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun test tests/behaviour/loop-grammar.test.ts tests/behaviour/loop-spawn.test.ts tests/behaviour/loop-backoff.test.ts tests/behaviour/loop-stop.test.ts tests/behaviour/loop-instance.test.ts tests/behaviour/loop-log.test.ts` |
| Pinned inventory + no-shell | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun run scripts/checks/no-shell-dispatch.ts` then `... bun run scripts/checks/help-guide-coverage.ts` then `... bun test tests/checks/no-shell-dispatch.test.ts tests/checks/install-conformance-mutants.test.ts tests/structure/metrics-mounting.test.ts tests/checks/reference-page-parity.test.ts` |
| Untouched delivered surfaces | `TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH bun test tests/structure/provider-surface.test.ts tests/checks/coordinator-sequence.test.ts tests/behaviour/coordinator-*.test.ts tests/structure/coordinator-*.test.ts tests/conformance/dispatch` — **this gate is the sole owner of the "delivered coordinator suites pass unmodified" observation** (`DOD-6`, R-16). No case runs them: a case that spawned them would start real child processes and violate `NFR-1`. |
| Hygiene | `git diff --check` |

**Aggregate gates owned by the lifecycle quality phase (phase 9), not by this plan's per-group battery:**

```bash
# The aggregate: lint → format:check → typecheck → test → check:boundaries → check:memory → prompt/help/exports
TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH pnpm check

# The branch-range commit-message gate (needs the branch's own commit range, so it only exists at PR time)
./scripts/lint-commit-range.sh --base origin/main-tools
```

Rationale for the split: `pnpm check` also builds, typechecks, and runs every unrelated suite, so it is the phase-9 aggregate rather than a per-phase loop; the range gate asserts the change branch's own commit messages against `origin/main-tools`, which is a delivery-lifecycle property. Both are recorded in pm-notes; a `FAIL` is remediated in the mode the gate names and an unresolved `ERROR` is never recorded as a pass.

The determinism gate needs no separate command: `TC-BATTLE-003` runs the whole registry twice inside the suite and compares canonical output, and `TC-BATTLE-004`/`TC-BATTLE-003` assert the zero-live-call counters. Re-running the Battery row is the manual cross-run check.

The documentation-phase gates (`bun test tests/checks/doc-conformance.test.ts`, the stale "the outer loop is only `scripts/ceo-loop.sh`" scan, and `bash scripts/.tests/test-doc-distribution.sh` when a redistributable page changes) belong to the system-spec-update phase (`DOD-9`), not to this plan's delivery battery.

### 7.6 Non-functional verification

**Offline determinism (`NFR-1`, `TC-BATTLE-003`, `TC-CONTRACT-005`, `DOD-4`).** Two runs of the whole registry in isolated roots with a fixed clock, a fixed id sequence, and root-only canonicalization. Assertions: canonical envelope JSON byte-identical; per-group and per-kind record counts identical; verdict coverage identical; the delay lists identical and ordered; `liveNetworkRequests === 0`; `realChildStarts === 0`; `realTimersArmed === 0`; `shellInvocations === 0`; the injected transport/session/process doubles saw every call, so a native fallback would have been counted. No wall-clock assertion is used anywhere; the only time source is the injected delay recorder, so the suite cannot become flaky under load.

**Bounded output (`NFR-2`, `TC-VERB-003`, `TC-LOG-005`).** Assertions: ≤ 32 human lines for `start`/`stop`/`status`/`reset`; ≤ 1 + `n` for `log`; machine `data` ≤ 65 536 bytes per verb; 0 ANSI escapes; the status key order with **exactly three** `yes`/`no` keys (`loop_running`, `ceo_alive`, `stop_signal`), `stop_mode` immediately after `stop_signal` rendering `drain`/`immediate` or empty, `<n>/<bound>` for `restarts`, and a **bare `key=`** for every absent value with no `none` *placeholder* in any human block — scoped so the corroborator's `none` enum value remains legal in records (rulings `R1`/`R2`, spec v1.2 status-key source table).

**Log retention (`NFR-3`, `TC-LOG-001`…`-007`).** Assertions: every line ≤ 512 UTF-8 bytes with whole-pair dropping; active ≤ 1 048 576; exactly one retained generation; total ≤ 2 097 152; the oldest generation is the one dropped; the newest data is present; a read returns ≤ 100 lines and ≤ 65 536 bytes; a write or rotation failure changes no verdict, exit, or record and appears only as `log-unavailable`.

**Durable stop (`NFR-4`, `TC-STOP-*`).** Assertions: 100% of folded requests prevent a start (0 lease records, 0 sessions, 0 session records) after a simulated restart and after a simulated crash; `drain` ends at the next boundary with 0 terminations; `immediate` ends within `collection-interval + kill-grace` = 50 000 virtual ms; an unverifiable identity is reported and not signalled; repeated `stop`/`reset` append ≤ 1 record each.

**Stuck-verdict safety (`NFR-5`, `TC-STUCK-*`).** Assertions: 100% of kills require a live session + sourced `zero` for ≥ 600 000 ms + no artifact advance + a corroborator whose F1–F3 fold reports `none`; 0 kills with a healthy delivery in progress (the live-shape D4 row); 0 kills on either unreadable input; 0 kills on unknown liveness; **0 `startedAt`, start-time, or age comparisons on the corroborator path** (`TC-STUCK-009`); detection-to-next-session ≤ the **formula** `stuck-window + collection-interval + kill-grace + first backoff` — 652 000 ms at the shipped defaults and 682 000 ms at a raised 60 000 ms interval (`TC-STUCK-006` rows A/A′) — **on the confirmed path**; and an unconfirmed termination is terminal at exit 2 with one outcome record, a released lease, 0 restart records, and 0 spawns (ruling `R3`).

**Single instance and session uniqueness (`NFR-6`, `TC-INSTANCE-*`).** Assertions: 2 concurrent starts → exactly 1 admitted + 1 `coordinator.already-running`; 0 double claims; 0 second spawns while a live recorded session exists; exactly 1 lease record per acquisition or takeover; ≤ 1 live `active` session at every snapshot.

**Contract invariance (`NFR-7`, `TC-CONTRACT-001`, `-004`, `-006`).** Assertions: 0 new error identities, domain kinds, configuration keys, capability names, delivered schema bumps, or coordinator behaviour changes; exactly 2 new record kinds and 1 additive optional harness fact; the loop imports the engine primitives and no coordinator cycle/predicate. All of it is compared against the **in-suite literal baseline** (no fixture file, no child process). The "delivered coordinator suites pass unmodified" observation is a **gate-battery read** (§7.5, Untouched delivered surfaces) and a `DOD-6` item, never a case.

**Restart accounting (`NFR-8`, `TC-BACKOFF-*`).** Assertions: exactly 1 `coordinator.restart` per consumed ordinal; exactly 1 ordinal per stuck restart; 0 ordinals for a clean end; the declared delay at every ordinal; 0 restarts above the bound; 1 verdict + 1 outcome per stuck episode; 0 restart records for a clean session end.

**No shell (`NFR-9`, `TC-BATTLE-004`, `-005`, `TC-STUCK-009`, `TC-PARITY-008`).** Assertions: 0 shell invocations; 0 script-path literals in the declared surface; 0 script paths and 0 shell entry-point names in the spawn prompt; 0 `.ai/local` references; a planted reference fails by name; the allowlist stays empty.

**Hygiene (`NFR-10`, `TC-CONTRACT-002`, `TC-LOG-002`, `TC-BACKOFF-007`).** Assertions: no prompt/transcript/diff/credential/environment/provider payload/model/seat in any record, log line, summary, or diagnostic; every evidence corpus ≤ 512 bytes; every diagnostic single-line and identifier-only; the canaries were demonstrably present in the inputs.

**Read economy (`NFR-11`, `TC-CONTRACT-003`, `TC-CONTRACT-005`, `TC-VERB-004`).** Assertions: one evaluation read per cycle (the delivered append-time coverage read excluded, as the coordinator's read-cost case excludes it); 0 appends and 0 extra reads for `status`/`log`/`reset`; the pure tier cannot reach the store.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Mitigation in this plan |
|------|--------|--------------------------|
| The battery proves fixtures, not the shipped composition (`RSK-9`) | H | Every case names the production seam it exercises; `TC-BATTLE-002` rejects reimplementations by import identity, signature scan, and a planted control; `TC-BATTLE-007` machine-checks the permanent boundary; the not-proven list is published (§1.2, Appendix C). |
| A test becomes the second implementation | H | `TC-BATTLE-002`'s three mechanisms; D3 is limited to the pure exported functions; the harness exposes no record writer besides the production one. |
| Timing flakiness | M | No wall-clock assertion; the cycle driver and the injected delay are the only time source; the two-start interleaving is a latch, not a sleep; the process-tree grace is virtual. |
| The interleaving is too weak (both starts effectively serialized) | H | The loser is parked *inside* its fence wait and released after the winner's lease is durable, so a pre-read-only implementation double-claims and fails `TC-INSTANCE-001`; both orders run. |
| The stuck predicate kills a working CEO (`RSK-2`) | H | `TC-STUCK-003` runs twenty virtual minutes of zero traffic with a live delivery, seeded with a composition-shaped `startedAt` deliberately unlike any platform reading, and asserts 0 kills with an armed start-time probe at 0 calls; `TC-STUCK-010` covers the full D1–D6/M1–M6/F0–F3 table plus the pid-reuse observation; registers `M45` and `M106` prove the case fails if the corroborator is dropped or a start-time test is added. |
| An unreadable signal becomes a verdict (`RSK-3`) | H | `TC-STUCK-004`/`-005` assert `unevaluable` for both inputs with 0 kills; registers `M46`/`M47`. |
| A durable stop is forgotten or over-cleared (`RSK-6`) | H | `TC-STOP-002` (restart and crash), `-003` (fail closed), `-007` (cross-process); registers `M38`/`M39`/`M44`. |
| A duplicated session after an unclean death (`RSK-5`) | H | `TC-INSTANCE-002`/`-005`/`-006`; registers `M62`/`M63`. |
| The pinned inventory is weakly relaxed instead of repinned (`RSK-8`) | H | `TC-BATTLE-008` keeps every rule across **three** pinned suites and adds the removal control and the planted-26 control; registers `M1`–`M4` and `M101`; §6.1 lists the pin update as a pin update. |
| The proof boundary drifts or a row lands off-boundary | H | `TC-BATTLE-007` asserts count, order, and membership with five planted controls; registers `M5`–`M8`. |
| A case states an exit literal the delivered matrix does not project | M | `TC-VERB-005` computes every observed exit through the table; `TC-CONTRACT-001` pins the matrix. |
| The extended no-shell surface silently shrinks | M | The declared-equality and reachability assertions are extended, not replaced; a new loop module without a surface entry fails by name (`M82`). |
| The deliver leg is overstated: a lifecycle transition passes for a delivery (DoR R-03) | H | `TC-BATTLE-006` names `dispatch` as the deliver primitive, doubles its nested PM session from the same port, asserts its real envelope and its attempt/lane records, and is controlled by `M102`; §3.1 states the proof level as command-runtime-and-no-further, and the boundary constant keeps `live-opencode` rather than claiming the nested leg live. |
| The only resume path silently degrades to observation (DoR R-07) | H | `TC-INSTANCE-006` asserts exactly one `resume` call, its target session id, no title, and the same id on the returned handle; the observation-only variant is `M103` and fails by name. |
| A case re-litigates a closed ruling | H | Every ruling is asserted as a named expectation with a planted control: `none` in the status block fails `TC-VERB-003` (`M94`), a restart after an unconfirmed termination fails `TC-STUCK-008` (`M96`), a handler configuration read fails `TC-VERB-004` (`M99`), and a stale pin or a missed M4 mapping fails `TC-BATTLE-008` (`M4`, `M101`). §8.3 records the rulings in force and the spec section that owns each, so a reviewer can check a case against the rule instead of against an open question. |

### 8.2 Assumptions

1. The production seams the battery needs exist or are created in this change: the `loop` command definition, the loop supervisor composing the delivered primitives, the pure verdict/schedule/renderer/projection modules, the two state folds, the corroborator read, and the delivered `terminate` member. This is the testability consequence of `AC-F8-1` ("exercises the real production seam"), not a new requirement. If the implementation plan drops any of them, the corresponding coverage becomes unachievable and must be reopened at the readiness gate rather than downgraded to a test-local reimplementation.
2. The composition accepts additive, non-operator injection facts for offline determinism: `delay(ms, reason)`, the harness session port, the progress reader, the corroborator read, the process port, the log sink, `signalHost`, `clock`, `newRunId`, `processId`, `environment`, `cwd`, `homeDirectory`, `workingName`. This mirrors the delivered `coordinatorSessionFacts`/`signalHost`/`collectionIntervalMs` pattern and adds no configuration key (`NFR-7`).
3. `HarnessSessionHandle.pid` and the streaming spawn seam's `pid` are **optional and absent-by-default**, so every delivered double and suite stays valid without an edit; the delivered `coordinator-production-session.test.ts` is the proof and stays untouched.
4. `tests/fixtures/coordinator/harness.ts`, `cycle-driver.ts`, `process-port.ts`, and the GH-347 seam doubles are reused unchanged. The loop harness composes them; it does not fork them.
5. The nine proven ids are exactly the registry groups, so "the nine surfaces" is a runnable set rather than a prose list; the `no-shell` group's rows never call the whole-battery sweep (no recursion).
6. `coordinator.restart-budget-exhausted` stays `user-validation` (exit 1), `coordinator.already-running`/`coordinator.process.capability-gap`/`coordinator.session.kill-failed` stay `platform-provider` (exit 2), and `fallback.invocation` stays `user-validation` (exit 1). Any assertion to the contrary is a defect in the case, not a behaviour change (`NG-4`, `NG-9`).
7. The change folder's `tmp/` is git-ignored; no fixture writes outside `tmp/tmpdir`; every temp root is removed in `finally`.
8. The delivered `provider-surface.test.ts` byte pin on `scripts/ceo-loop.sh` remains the shell-untouched observation, and the prompt-untouched half is a PR-time review recorded in §10 (`DOD-7`), because a permanent diff assertion is forbidden by `.ai/rules/testing-strategy.md`.
9. `pnpm check` is the phase-9 aggregate and the range gate is phase-9; this plan's per-group battery is delivery-time and must stay cheap enough to re-run.

### 8.3 Open Questions

**None.** Four questions were raised against spec v1.0 and are closed by the v1.1 rulings reproduced below; two further cross-file pins were confirmed as affected components. Each row names the rule **now in force** and the spec section that owns it, so a reviewer checks a case against a rule rather than against a question. No case in this plan defers an assertion, and no ruling is deferred to the readiness gate.

| Prior question | Ruling now in force | Owning spec section(s) | Asserted by |
|---|---|---|---|
| Closed `OQ-1` absent-value token (v1.0 contradiction between AC-F1-2's "empty value" and API-7's `none`) | **`R1`.** Every absent value in the status block renders as the **empty string after `=`** — `loop_pid=`, `ceo_pid=`, `ceo_session=`, `loop_id=`, `ceo_title=`, `budget_epoch=`, `last_restart_reason=`, `last_verdict=`, `degraded=`. No `none` token is emitted for an absent value. The rule is stated once with its reason: the six shell keys keep the shell's own `key=` rendering, and a fixed key order plus an empty value is unambiguous. `none` remains valid **only** as the corroborator enum value in `F-5`/`DM-6`, never as a status placeholder. | AC-F1-2, API-4, API-7, §4.1 (verb-parity metric), Appendix F (status keys), §24 (glossary) | `TC-VERB-003` (world C, bare-key assertions plus a `none`-token scan) |
| Closed `OQ-2` "the three boolean keys" not enumerated; `stop_signal` vocabulary | **`R2`.** The three boolean keys are exactly `loop_running`, `ceo_alive`, and `stop_signal` (`yes`/`no`, with `stop_signal=yes` when a stop is folded). The stop **mode** is the separate additive key `stop_mode` (`drain`/`immediate`, empty when no stop is folded), placed **immediately after `stop_signal`** in the additive tail. | AC-F1-2, API-4, API-7, Appendix F | `TC-VERB-003` (key sequence, three-boolean count, `stop_mode` values) |
| Closed `OQ-3` whether a restart follows an unconfirmed termination | **`R3`.** An unconfirmed termination is **terminal**: exactly one outcome record, the lease **released**, `coordinator.session.kill-failed` at **exit 2**, **no restart**, and **no second session** — F-6's at-most-one-session invariant outranks F-3's restart path, because a possibly-live orphan is never joined by another session. Only a **confirmed** termination proceeds to the restart path (and therefore only there does the bound formula apply — 652 000 ms at the shipped defaults, 682 000 ms at a raised 60 000 ms interval). | F-5, AC-F5-1, AC-F5-5, AC-F5-6, AC-F3-1, API-1, Appendix C item 5, RSK-4, RSK-5 | `TC-STUCK-008` (rows B and D: one outcome, lease released, exit 2, 0 restarts, 0 spawns), `TC-STUCK-006` (rows B/C: no next session), `TC-BACKOFF-001` (confirmed path only), `TC-INSTANCE-005` (invariant across the path) |
| Closed `OQ-4` `status` and the `restarts` bound | **`R4`.** `status` performs **no configuration read inside the command handler**; the composition supplies the resolved settings, including the budget bound behind `restarts=<n>/<bound>`, and a configuration acquisition or resolution failure **falls back to the shipped defaults**, so the surface always composes. AC-F1-5's no-configuration clause is handler-scoped. | AC-F1-5, API-4 | `TC-VERB-004` (handler-scoped counting double, 0 handler reads, both failure rows falling back to the defaults) |
| Cross-file pin 1: the duplicated page mapping | **`R5` (pin).** `tests/checks/reference-page-parity.test.ts` duplicates `pageFor` and **must learn the M4 root**, or `loop` resolves to a non-existent M1 page. | §2.1, §8.5, §16 (affected components), `DOD-8`, `RSK-8`, `DEC-7` | `TC-BATTLE-008` (both mappings asserted; the M1 fallback fails by name) |
| Cross-file pin 2: the stale-pin scan set | **`R5` (pin).** `tests/structure/metrics-mounting.test.ts`'s stale-pin scan set **must gain 26**, or a leftover 26-family pin survives the repin undetected. | §2.1, §8.5, §16 (affected components), `DOD-8`, `RSK-8`, `DEC-7` | `TC-BATTLE-008` (planted 26-family pin fails by name) |

The three pinned help-inventory surfaces are therefore `tests/checks/install-conformance-mutants.test.ts`, `tests/structure/metrics-mounting.test.ts`, and `tests/checks/reference-page-parity.test.ts` — a pin update with every mutation control intact, never a relaxation. §6.1 records each as an extended file, and registers `M1`–`M4` and `M101` are their controls.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-11-19 | @test-plan-writer | Initial test plan for GH-348 against spec v1.0: 74 cases in 10 groups, 41/41 AC traceability (0 unmapped, 0 orphan, 77 links), the two-signal verdict battery with the delivered corroborator, the identity-verified terminate cases, the backoff/budget and durable-stop batteries, the pick-deliver-merge cycle with its doubled/real split, the permanent nine-proven / six-not-proven boundary with its five planted controls, the extended no-shell surface (files added to the declared list, no new invariant), the repinned help inventory with its removal control, the fixture inventory (15 reuse / 9 authored / 9 extended), the 93-row mutation register, the gate battery with the `TMPDIR`/`PATH` conventions, the non-functional verification for all 11 NFRs, and four recorded open questions (`OQ-1`…`OQ-4`). |
| 0.2 | 2026-11-19 | @test-plan-writer | Closed the four open questions against spec **v1.1** (spec §26 history row; pm-notes `PM rulings on the four open questions`). **R1** (`TC-VERB-003`): a third absent-identifier world whose golden proves a bare `key=` for all nine placeholder keys, a `none`-token scan over every block, and the note that `none` remains valid only as the F-5/DM-6 corroborator enum. **R2** (`TC-VERB-003`): `stop_mode` immediately after `stop_signal`, exactly three booleans, `stop_mode` values asserted per world. **R3** (`TC-STUCK-008`, `TC-STUCK-006`, `TC-BACKOFF-001`, `TC-INSTANCE-005`): the unconfirmed-termination path is terminal — one outcome record, lease released, exit 2, **0 restart records, 0 spawns** — with a second unconfirmed row (failed signal), the confirmed-only 652 000 ms bound, a confirmed-termination precondition on the restart case, and the at-most-one-session invariant extended across the path. **R4** (`TC-VERB-004`): a handler-scoped counting configuration double, a 0-handler-read assertion with the composition-supplied bound still rendered, and two fallback rows (acquisition and resolution failure use the shipped defaults at exit 0). **R5** (`TC-BATTLE-008`): three pinned surfaces — the reference-page-parity duplicated mapping must learn the M4 root and the stale-pin scan set must detect a planted 26-family pin. §8.3 replaced the four question entries with a closed disposition table (rule, owning spec section, asserting case); every deferred assertion is now resolved; registers M94–M101 added (93 → 101 mutations). No case was added or removed and no AC link changed: **74 cases, 41/41 ACs, 77 links (36 extras), 0 unmapped, 0 orphan, 0 open questions, 0 deferred assertions**. |
| 0.3 | 2026-11-19 | @test-plan-writer | DoR-iteration-1 remediation against spec **v1.2** (`readiness-review/readiness-iter-1.md`; pm-notes `PM rulings for the DoR-iteration-1 remediation`). **R-03 (deliver leg):** `dispatch` is named as the deliver primitive everywhere; `TC-BATTLE-006` drives it through the real command runtime with its nested PM session doubled by the same scripted port, asserts the dispatch envelope plus its attempt/lane records, and states the proof level as command-runtime-and-no-further; `phase complete` survives only as an explicit negation, and the boundary constant stays nine/six with `live-opencode` carrying the nested leg's live behaviour. §3.1 gains a "deliver-leg level" paragraph. **R-07:** `TC-INSTANCE-006` now asserts exactly one `resume` with the recorded session id, no `--title`, and the same id on the returned handle; the "resumed/observed" hedge is gone; `TC-SPAWN-002`'s resume row is bound to that case and AC-F2-2 gains the link. **R-10:** case inventory corrected to **69 AC-linked / 5 NFR-only** with one source of truth (the matrix). **R-11:** both new-suite counts corrected 16 → **17**. **R-12:** `TC-STUCK-004` asserts `progress-unreadable` present and `delivery-corroborator-unreadable` absent, so all five closed degradation values have an owner. **R-13:** `TC-VERB-002` gains the two required-flag refusal rows and the global-flag acceptance rows. **R-16:** `TC-CONTRACT-001`'s baseline is now a **committed literal inside `tests/checks/loop-contract-invariance.test.ts`** (no fixture file) and the coordinator-suite observation moves to the gate battery. **Spec-v1.2 alignment:** `TC-STUCK-010` rewritten as the exact 16-row table (D1–D6, M1–M6, F0–F3) plus the pid-reuse and live-shape observations and the start-time ban; `TC-STUCK-003` seeds a composition-shaped `startedAt` and arms a start-time probe; `TC-STUCK-009` asserts no `startedAt`/start-time/age read; `TC-STUCK-001`/`-008` assert `iterationId = <loopId>:<cycle ordinal>` and `killFailureReason` only on a failed kill; `TC-STUCK-006` asserts the bound **formula** at 30 000 and 60 000 ms plus the shipped 652 000 ms and a source-level literal ban; `TC-VERB-003` follows the status-key source table (`loop_id=loop-main` always, live-only `ceo_pid`/`ceo_session`, `restarts=0/<bound>`, a `none` scan scoped away from the enum); `TC-VERB-001` and `TC-BATTLE-006` use the declared clean-end cause; `TC-BACKOFF-004` asserts `epoch-<n>;restarts=<count>;seq=<sequence>`; `TC-INSTANCE-004`'s harness registers both families. Registers `M102`–`M115` added (101 → **115** mutations, contiguous). Counts: **74 cases (unchanged, none added), 41/41 ACs, 78 links (37 extras), 0 unmapped, 0 orphan, 0 open questions, 0 deferred assertions**; fixtures **15 existing / 9 authored / 9 extended** (no new fixture). |

## 10. Test Execution Log

Populated during delivery. One row per case group; the battery is run whole before each phase boundary. Review-phase observations that are not permanent cases are recorded here with their evidence.

| TC ID(s) | Run Date | Result | Notes |
|----------|----------|--------|-------|
| — | — | Not run | Awaiting delivery |
| `DOD-7` prompt half | — | Not run | PR-time change-surface review: the change diff contains no modification under `.opencode/agent/**`; the shell half is the delivered `provider-surface.test.ts` byte pin, run in the Untouched-delivered-surfaces gate. |
| `DOD-3` | — | Not run | Phase-9 `./scripts/lint-commit-range.sh --base origin/main-tools` verdict, recorded in pm-notes. |
| `R1`–`R5` (closed rulings) | — | Closed | Reproduced in §8.3 with the owning spec section and the asserting case. `R1`/`R2` → `TC-VERB-003`; `R3` → `TC-STUCK-008`, `TC-STUCK-006`, `TC-BACKOFF-001`, `TC-INSTANCE-005`; `R4` → `TC-VERB-004`; `R5` → `TC-BATTLE-008`. Their planted controls are registers `M94`–`M101`. |
| `DOD-6` coordinator suites | — | Not run | Run by the **Untouched delivered surfaces** gate (§7.5), not by a case: `bun test tests/behaviour/coordinator-*.test.ts tests/structure/coordinator-*.test.ts`. Kept out of `TC-CONTRACT-001` so the case spawns no child process (R-16, `NFR-1`). |
| DoR-iteration-1 findings (R-03, R-07, R-10…R-13, R-16) | — | Closed | Remediated in revision 0.3: R-03 → `TC-BATTLE-006` + `M102`; R-07 → `TC-INSTANCE-006` + `M103`; R-10 → the corrected inventory sentence; R-11 → the 17-suite counts; R-12 → `TC-STUCK-004` + `M105`; R-13 → `TC-VERB-002` + `M104`; R-16 → the in-suite literal baseline plus this gate read. |
