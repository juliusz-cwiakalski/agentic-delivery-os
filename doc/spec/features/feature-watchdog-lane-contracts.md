---
ados_distribution: internal
id: SPEC-WATCHDOG-LANE-CONTRACTS
status: Current
created: 2026-11-05
last_updated: 2026-11-05
owners: ["engineering"]
service: delivery-os
summary: "The M1-S1 watchdog check family: `watchdog preflight <lane>` refuses dirty or non-base checkouts with named evidence and mutates nothing, `watchdog teardown <lane>` restores the lane's base checkout on every caller-invoked exit path and reports each action while verifying that agent-memory publications are committed or preserved (never discarded), and `watchdog liveness <lane>` ships contract-first with the verdict vocabulary, the declared signals shape, and the `watchdog.signals-absent` classification for absent sources (unknown, never guessed; CPU is never the only signal). A `watchdog` domain kind joins the closed error-table union with exactly three identities, every probe projects through the v1 envelope and the `{0, 1, 2}` exit taxonomy, and the surface checks rather than runs."
links:
  related_changes: ["GH-221"]
  related_decisions: ["ADR-0003", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/watchdog.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/contracts/result.ts"
---

# Feature: Watchdog and Lane Contracts

> **Role of this Document:** Source of truth for the delivered watchdog check family. It describes the commands, contract data, verdict/exit matrix, preservation semantics, and failure identities. Requirements live in the GH-221 change artifacts; this document describes current behavior.

## 1. Overview

`watchdog` is a check-only command family over a data-only contract module:

| Invocation | Purpose | Outcome |
|---|---|---|
| `<binary> watchdog preflight <lane>` | Admission control | `ok` (exit `0`) or a refusal identity (exit `1`) |
| `<binary> watchdog teardown <lane>` | Caller-invoked restoration | `ok` with a restoration report (exit `0`) or a classified failure |
| `<binary> watchdog liveness <lane>` | Liveness contract probe | A sourced verdict (exit `0`/`1`) or `watchdog.signals-absent` (exit `2`) |

Liveness is contract-first in M1-S1. The production edge wires **zero** signal sources, so every production liveness run classifies `watchdog.signals-absent` and emits no verdict. The verdict vocabulary additionally declares `stalled` and `progressing` as contract values whose signal-backed reachability arrives with M1-S15 (SC-M1-14).

## 2. Business Context

### 2.1 Problem Statement

The bash-era delivery stack carries the "lying liveness" defect family: exit-zero false success, stranded commits left by interrupted lanes, and foreign commits landing on a base the lane does not own. Nothing refuses a lane before it starts on a dirty or off-base checkout, nothing guarantees restoration on exit, and nothing verifies that agent-memory publications survive a lane. A liveness evaluation without signal sources invites CPU-only heuristics that read a prefilling session as stalled.

### 2.2 Users and Impact

- **Delivery coordinators and agents** get an evidence-bearing refusal before foreign work lands and a restoration report after every lane exit.
- **Operators** gain a stable refusal/restore evidence trail instead of manual forensic inspection of stranded state.
- **Later lane consumers** (the scheduling engine M1-S17, the resident daemon M1-S18, and supervise M2-S2) consume these probes instead of reimplementing them.

## 3. Capabilities

### 3.1 Grammar and command shape

- The command name is `watchdog`; the only subcommands are `preflight`, `teardown`, and `liveness`.
- Each subcommand accepts exactly one `<lane>` positional. A third positional, an unknown flag, a missing flag value, a conflicting flag pair, or an unknown top-level command is `fallback.invocation` before the handler. A missing subcommand, an unknown subcommand, or a missing/empty lane is `input.value.rejected` inside the handler, before any lane read.
- `--json` is global and stripped by the shared parser. There are no command-specific flags and no run/mutate flags.
- Handlers return `{ data }` or `{ error: { kind, code, summary } }`; the CLI edge owns envelope assembly and exit projection. No handler writes to a stream and no exit literal exists in the command.
- Text mode renders the verdict line plus one line per restoration action and memory publication, using the same evidence as `--json`; the envelope remains the machine truth.

### 3.2 Preflight (F-1)

Preflight reads the lane record through the injected lane reader (`readLane`) and the checkout facts through the bounded git seam, then classifies admission:

| Condition | Outcome |
|---|---|
| Unresolvable base ref, unreadable checkout facts, or contradictory facts | `input.value.rejected` (fail closed, exit `1`) |
| Torn lane record | `state.store.torn` (exit `2`) |
| Dirty working tree | `watchdog.checkout-dirty` (exit `1`), evidence names the dirt and expected base |
| Checkout not on the declared base (including a detached HEAD or foreign worktree) | `watchdog.checkout-non-base` (exit `1`), evidence names expected vs actual |
| Clean checkout on the declared base | verdict `ok` (exit `0`), evidence names the admitted base |

Preflight is read-only on every outcome: it calls only the lane read and `git.readCheckoutFacts`, and the working tree, HEAD, and branch are byte-for-byte unchanged.

### 3.3 Teardown (F-2, F-3)

Teardown is the caller's unconditional restoration contract. It reads the lane record and checkout facts, plans the ordered restoration, and executes only the planned mutations:

1. **Stranded/detached commit preservation.** A commit reachable from no branch is preserved by creating or updating one attributed ref per lane, `watchdog-preserved/<lane>`, and reported with the commit hash.
2. **Checkout restore.** The checkout is restored to the lane's declared base. A checkout already on the base reports `checkout-unchanged` with "nothing to restore" evidence. A lane branch carrying the delivered commit is preserved as-is; teardown never deletes a commit-bearing branch (branch cleanup belongs to `closeout`).
3. **Lane-workspace residue.** Untracked paths under the lane's declared workspace are removed, one report entry per item.
4. **Unattributable content.** Any other dirty path that is not an agent-memory path is preserved in place and reported.
5. **Memory publications.** Every path under `.ai/memory` is classified `committed` (with file and commit evidence) or `preserved` (modified, untracked, or staged, preserved in place). Teardown never stages, commits, reverts, cleans, or deletes a memory path.

The restoration report is always produced, including on a clean exit, and every action carries a kind, an observation, and non-empty evidence. Memory entries carry their status (`committed` or `preserved`) and evidence naming the path and reason. Ordering is deterministic: preserve commit, checkout action, then dirty paths in path order (each reported as residue removal or preserved content); memory entries are sorted by path.

Restoration failures are classified through existing identities (`input.value.rejected` for unevaluable or failed restoration facts), never `fallback.internal` for a documented class and never a silent exit `0`.

### 3.4 Liveness (F-4)

`watchdog liveness <lane>` evaluates the declared progress-signal shape `heartbeatAgeMs`, `tokenDelta`, `traffic`. The input type declares no CPU field, so a CPU-only reading can never satisfy the shape and can never classify `stalled`. `stalled` additionally requires corroboration: a heartbeat age at or beyond the declared bound together with `tokenDelta: 0` and `traffic: 0`. Any partial or progressing reading classifies `progressing`.

Absent declared signal values classify as the absent outcome, which the command boundary maps to `watchdog.signals-absent` with exit `2`. No verdict key or value appears in that payload; the evidence-bearing summary states that the answer is unknown. The pure classifier implements the corroboration rule; the shipped composition wires zero signal sources, so no liveness run through the production edge reaches `stalled` or `progressing` until M1-S15 supplies them.

### 3.5 Error-table binding (F-5)

The `watchdog` domain kind joins the closed union with exactly three identities, appended after the existing rows:

| Code | Category | Retryable | Consequence | Projection class | Exit |
|---|---|---|---|---|---|
| `watchdog.checkout-dirty` | `user` | `false` | `not_landed` | `user-validation` | `1` |
| `watchdog.checkout-non-base` | `user` | `false` | `not_landed` | `user-validation` | `1` |
| `watchdog.signals-absent` | `platform` | `true` | `not_landed` | `platform-provider` | `2` |

The machine rows, their documented rows in [Result Contract and Error Table](feature-result-contract.md), and the true-positive corpus rows are bound in both directions by `error-table-sync`. No existing row changes.

### 3.6 Checks, not a runner (F-6)

The surface never dispatches a lane, spawns a session, kills a process, restarts, or supervises. Local `git` child processes are the expected mechanism for inspection and restoration and are not a lane or session spawn. The binary name renders only through the injected branding seam; no product or binary literal appears in the contract, domain, or command modules.

## 4. Verdict and Exit Matrix

| Outcome | Verdict | Exit | Identity | Reachable in M1-S1 |
|---|---|---|---|---|
| Clean on-base checkout admitted | `ok` | `0` | — | Yes |
| Teardown restored, publications verified | `ok` | `0` | — | Yes |
| Dirty checkout | `refused` | `1` | `watchdog.checkout-dirty` | Yes |
| Off-base checkout | `refused` | `1` | `watchdog.checkout-non-base` | Yes |
| Stall (signal-corroborated) | `stalled` | `1` | — | No through the production edge — the classifier is delivered; sources arrive with M1-S15 |
| Progressing (signal-corroborated) | `progressing` | `0` | — | No through the production edge — the classifier is delivered; sources arrive with M1-S15 |
| No signal sources | none emitted | `2` | `watchdog.signals-absent` | Yes |
| Grammar / invocation failure | none emitted | `1` | `input.value.rejected` / `fallback.invocation` | Yes |

Refusal rows show the conceptual verdict `refused`; on the wire the machine representation is the refusal identity on a failure envelope with no `data.verdict`, per the exclusive `data`/`error` contract. A sourced `stalled` outcome has no declared error identity; M1-S15 must decide its machine representation (GAP-T2).

## 5. Contract Data and Interfaces

`packages/core/src/contracts/watchdog.ts` is the single home for:

- `WATCHDOG_SCHEMA_VERSION` — `delivery.watchdog.v1`.
- `WATCHDOG_VERDICTS` / `WatchdogVerdict` — `ok`, `refused`, `stalled`, `progressing`, derived from one `as const` declaration.
- `WATCHDOG_SIGNAL_KEYS` / `WatchdogSignals` — `heartbeatAgeMs`, `tokenDelta`, `traffic`; no CPU field.
- `WATCHDOG_STALL_HEARTBEAT_MS` — the declared stall-corroboration bound (300000 ms).
- `WATCHDOG_PROBES` / `WatchdogProbe` — `preflight`, `teardown`, `liveness`.
- `WATCHDOG_ERROR_CODES` — the three identities.
- `WatchdogLaneRecord`, `WatchdogLaneRead`, `WatchdogGitPort`, `WatchdogGitFacts`, `WatchdogWorktreeEntry`, `WatchdogMemoryFact`, `WatchdogSignalSource`.
- `WatchdogRestorationAction` (kind, observation, evidence), `WatchdogMemoryPublication` (path, status, evidence), `WATCHDOG_RESTORATION_ACTION_KINDS`, `WATCHDOG_MEMORY_STATUSES`.
- `WatchdogVerdictData` (schema version, probe, lane, verdict, signals, evidence) and `WatchdogTeardownData` (verdict data plus `actions` and `memory`).

The domain tier `packages/core/src/domain/watchdog.ts` is runtime-neutral and exposes the pure classification, restoration planning, liveness classification, signal merging, and data builders. The bounded git seam `packages/adapters/src/git/watchdog.ts` implements `WatchdogGitPort` inside the existing `@delivery-os/adapters/git` subpath with fixed argv, no shell, no network, bounded timeouts, and `SIGKILL`. The command module composes all three; the edge registers the family behind an optional `watchdog` composition that requires an injected lane reader, defaults to a production git seam, and wires zero signal sources.

## 6. Non-Functional Behavior

- **Evidence totality.** Every refusal, restoration action, memory entry, and verdict carries non-empty evidence. Failure evidence rides the failure summary; success evidence rides `data.evidence`.
- **Determinism.** Identical lane and checkout facts replay to identical verdict, evidence, action order, and exit. Evidence names branch names, refs, paths, and codes (and commit hashes for preserved commits); the test normalizer replaces only the temporary repository root and the volatile `runId`/`timing`.
- **Offline.** Every behaviour test uses a real temporary repository (`mkdtemp`, `git init -b main`, fixed author, real `git worktree`), injected clock/brand/run-id, and buffer sinks. A fixture guard rejects any root equal to the live workspace.

## 7. Boundaries and Deferred Work

- Real progress-signal ingestion and sourced `stalled`/`progressing` outcomes are M1-S15 (SC-M1-14).
- Daemon consumption (M1-S18), supervise (M2-S2), the `lanes` surface, scheduling, dispatch, restart budgeting, and session kill are out of scope.
- The lane record arrives through the injected reader; no state-layer import, contract change, or stored-record migration is involved. The v1 envelope, `{0, 1, 2}` projection, and branding seam are reused unchanged.
- Lane-branch deletion and closeout branch cleanup remain the delivered `closeout` surface.

## 8. Validation and References

- Change artifacts: `doc/changes/2026-11/2026-11-05--GH-221--watchdog-lane-contracts/` (spec, test plan, plan).
- Binding check: `scripts/checks/error-table-sync.ts`; documented rows in [Result Contract and Error Table](feature-result-contract.md).
- Test levels:
  - Structure (`tests/structure/watchdog-contract.test.ts`, `watchdog-imports.test.ts`): exact verdict/signal/probe vocabularies, one-home constants, the three error identities, and tier/import boundaries.
  - Behaviour (`tests/behaviour/watchdog-*.test.ts`): real temporary repositories for preflight admission/refusal, teardown restoration and memory preservation, liveness absence and corroboration, envelope/exit projection, grammar reuse, and the checks-not-runner assertion.
  - Golden (`tests/golden/watchdog-output.test.ts`): committed normalized envelopes for admission, refusal, teardown, and signals-absent, with only the temporary repository root and volatile `runId`/`timing` normalized.
  - Fixtures (`tests/fixtures/watchdog/`): a shared temporary-repository harness whose guard rejects any root equal to the live workspace.
- Totals: 35 test cases cover 14/14 acceptance criteria.

## 9. Glossary

| Term | Definition |
|---|---|
| Lane | One unit of delivery work with an identity and a declared base. |
| Watchdog | The check family (`preflight`, `teardown`, `liveness`); it checks, it does not run. |
| Stranded commit | Work left behind by a lane that exited without restoration; preserved through `watchdog-preserved/<lane>`. |
| Foreign commit | A commit on a checkout that is not the lane's declared base; refused at preflight. |
| Memory publication | An agent-memory write under `.ai/memory`; reported `committed` or `preserved` at teardown. |
| Signals-absent | The classified "unknown" answer when no declared signal source is available; never a guessed verdict. |
| Prefill | The early phase of a (re)started session; must never read as stalled. |

See also: [Result Contract and Error Table](feature-result-contract.md), [State Layer](feature-state-layer.md), [Branding Seam and Working Name](feature-branding-seam.md), [Closeout Transaction](feature-closeout.md), and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).

**Change record:** `doc/changes/2026-11/2026-11-05--GH-221--watchdog-lane-contracts/`.

## Related

- [Harness Adapters](feature-harness-adapters.md) provides the adapter-level liveness signal surface (session traffic, worktree activity, process) with declared absences; the watchdog stays zero-source and economics remain M1-S15.
