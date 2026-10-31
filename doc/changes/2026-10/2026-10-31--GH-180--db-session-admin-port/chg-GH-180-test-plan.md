---
id: chg-GH-180-test-plan
status: Updated
created: 2026-10-31T19:45:00Z
last_updated: 2026-10-31T22:55:00Z
owners: [engineering]
service: delivery-os CLI session-database administration
labels: [change, planning]
version_impact: minor
summary: "Verify M0-S11: the `ados db` session-admin port (`size`, `list`, `prune`, `reboot`) through one injected fake `OpencodeSessionIo` and two core ports — bounded metadata-only size/list facts with an injected clock, dry-run-by-default prune over the exact cold/live/leaf boundary with a per-candidate TOCTOU re-check, one official delete per candidate, partial-failure truthfulness and retry convergence, idempotency and absent-row absorption, the reboot live gate and single bounded checkpoint with no process kill and no sidecar deletion, grammar rejection before I/O with the `input.value.rejected`/`fallback.invocation` carve-out and exact exits, SQL/id/range safety, the four `db.*` error rows with bidirectional documented sync, determinism and byte-identical replays, tier/runtime/no-SQLite confinement and composition-absent non-registration, the scoped `config-default-positions` baseline repair, and the ADR-0003 C-11 owner merge gate with no approval claimed."
links:
  change_spec: ./chg-GH-180-spec.md
  implementation_plan: ./chg-GH-180-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S11: db session-admin port

## 1. Scope and Objectives

`ados db` is the only product-code path to the opencode session database, and it is allowed to destroy data. The tests must therefore prove four things at once: **truthful metadata** (bounded size/list facts, an injected clock, a runtime-resolved path, and a closed field whitelist with no user content anywhere), **selection safety** (only cold, non-live, leaf sessions become candidates; the same predicate decides selection and the pre-delete re-check; a gained child, a vanished row and an already-absent row are all absorbed as counted skips), **mutation discipline** (dry-run mutates nothing; apply deletes one session at a time through `opencode session delete <id>`; `reboot --apply` performs at most one bounded `PRAGMA wal_checkpoint(TRUNCATE)` and only with no live session; no file, sidecar or process is ever touched), and **failure honesty** (every failure is one of four classified `db.*` rows with the documented exit, and a partial prune is never rendered as success).

The plan is built around three binding mechanisms: an **injected fake `OpencodeSessionIo`** that records every query, delete, checkpoint and stat and answers from scripted results over a synthetic store; a **non-vacuity contract** in which every negative, skip, cap and absence assertion is paired with a live control (a present sibling, a restored row, or a mutant that must fail the suite); and a **boundary matrix** in which cold, live and leaf each have a positive and a negative neighbour in the same fixture. It is a design and verification map, not an execution claim: this writer ran no builds, tests or commands against the delivered state.

### 1.1 In Scope

- Command grammar: the closed subcommand set, declared flag sets, value and range validation before any I/O, the boolean `--apply` forms, repeated-flag last-wins (the shared parser overwrites; `db` declares no conflict pairs), `--json` as a rendering-only global, and the two-class `input.value.rejected` / `fallback.invocation` split with exit `1` (F-D5, AC-D12).
- `db size`: runtime path resolution, database/WAL/SHM bytes with explicit presence, session/message/part counts, oldest/newest ISO-8601 UTC timestamps or `null`, zero mutations (F-D1, DM-D1, AC-D1).
- `db list`: bounded page, `updatedAt` descending then `id` ascending, default 20 / max 100, `total`/`omitted`/`truncated`, the exact nine-field item shape with `dataBytes` as the summed UTF-8 **byte** length over the current `message` and `part` stores, `live` from the injected clock (F-D2, DM-D2, AC-D2).
- `db prune`: dry-run zero mutation, the cold/live/leaf candidate rule at each boundary (with the selection-SQL predicates pinned textually), oldest-first ordering with `id` tiebreak, the cap, apply through one `deleteSession` per candidate, idempotent re-runs, the pre-delete re-check (gained child, vanished row), the already-absent row at delete, partial failure with the normative bounded summary and retry convergence, the pre-land abort identities (`db.opencode.unavailable`/`db.query.failed`) and the post-land partial-abort truth (`db.delete.failed` with landed/failed counts and first identity) (F-D3, DM-D3, AC-D3..AC-D9).
- `db reboot`: dry-run plan, the live-session gate on `--apply`, exactly one checkpoint on success, WAL before/after, no process kill, no sidecar deletion, manual-restart guidance (F-D4, DM-D4, AC-D10, AC-D11).
- Output: one `CommandResult` envelope per run in machine mode, the `delivery.session-admin.v1` payload shape, machine and human caps, `+N more` truncation, byte-identical replays, and the metadata-only whitelist with a canary secret (F-D6, DM-D1..DM-D5, AC-D14).
- Failure identity: the four `db.*` rows, `db` in `DOMAIN_KINDS`, bidirectional documented sync, and kind-only containment (DM-D7, AC-D15).
- Boundaries: contracts data-only, core domain pure, production I/O only in `packages/adapters/src/session/index.ts`, no SQLite driver anywhere, secret-read allowlist unchanged at four, no new package/subpath/dependency, and `commands.db` registered only with a composition (F-D7, DM-D8, AC-D16).
- CI determinism: the scoped `tests/checks/config-default-positions.test.ts` parent-directory repair, zero real process/file/network/home use in the new suites, and zero real user paths in the files this change introduces (AC-D17).
- The ADR-0003 C-11 privacy sign-off as a recorded owner merge gate with no approval claimed (AC-D18, DEC-D10).

### 1.2 Out of Scope & Known Gaps

- [OUT] Harness lifecycle, spawn, resume and telemetry; no session is created or killed (NG-D1).
- [OUT] Process killing or automatic host restart; `reboot` prepares the database only (NG-D2, AC-D11 asserts the absence).
- [OUT] `VACUUM` or any compaction beyond the single bounded WAL checkpoint (NG-D3).
- [OUT] Any `node:sqlite`, `bun:sqlite`, `better-sqlite3` or equivalent driver in product code, tests or scripts (NG-D4, asserted by TC-DB-002).
- [OUT] Titles, prompts, message bodies, part data, credentials, environment values or command arguments in any output, error, evidence, fixture or log (NG-D5, asserted by TC-DB-029).
- [OUT] GUI, interactive prompts, shared/remote database mode (NG-D6).
- [OUT] Changes to `scripts/pm-liveness.sh`, `scripts/ceo-loop.sh`, `.opencode/**`, the generated Claude Code plugin, existing gates, or unrelated refactors (NG-D7). Existing gates are re-run, never re-baselined.
- [OUT] Descendant-aware pruning, retention policies, scheduling, automatic pruning (NG-D8).
- [OUT] A second database access path or a schema reimplementation (NG-D9).
- [OUT] Re-testing unrelated product behaviour beyond the regression half of `pnpm check` (TC-DB-036, §7).
- [GAP-T1 — resolved: plan now exists] `chg-GH-180-plan.md` is present and maps its phases onto these TCs. This plan binds behaviour, assertions, identities and AC mapping; the plan must not reshape them. Resolved at v1.3.
- [GAP-T2 — NFR-D4 is not CI-verifiable] The latency thresholds (≤ 30 s `size`, ≤ 10 s `list`, ≤ 30 s prune selection, ≤ 250 ms per re-check, ≤ 10 s reboot live check, ≤ 180 s for a 500-candidate apply) are defined on a roughly 120 GiB store with ~6,900 sessions and ~209k messages. No CI runner has that store and this plan will not invent a measured number. The CI oracle is **bounded work**: fixed/invariant query counts, one page query with a `LIMIT`, at most one re-check and one delete per candidate, one live-count query and at most one checkpoint, plus the declared timeout constants. A **mandatory read-only real-store smoke** (`db size` and `db list --limit 5`, non-CI, recorded with output and exit, confirming no mutation) runs before the PR so the adapter SQL is exercised once against the real opencode schema, and an optional **reference latency measurement** is documented in §6.5 and recorded in §10. Both are explicitly **non-CI**; NFR-D4 remains a target, and the reference measurement is recorded rather than used as a pass gate (TC-DB-037).
- [GAP-T3 — AC-D18 is half in-tree] "This specification, the pull request description, and the change evidence" are three carriers; only the specification and committed change evidence exist in the tree. The in-tree half is asserted by TC-DB-038 (automated); the PR-body half is a PR-time manual check recorded in §10 (semi-automated, non-CI by design).
- [GAP-T4 — delivery-bound spellings] The exact `DbCommandRuntime` method internals beyond the spec's four, the internal SQL text, the absent-row representation at the delete seam, golden file names and fixture helper names are delivery-bound. The semantics, identities, shapes, exits and observables are pinned here and may not be rebound (A-T2, A-T5, OQ-T1, OQ-T2).
- [GAP-T5 — spec-named behaviours bound to existing ACs] Four behaviours are named in the spec but have no dedicated AC: prune's pre-land abort on `db.opencode.unavailable`/`db.query.failed` and its post-land `db.delete.failed` partial abort (§3.4), the read-only `SessionStorePort` surface (§4.2), the metadata-only read restriction of `size`/`list` (§3.2/§3.3), and the declared timeouts (DM-D6). §3.4 maps each to an existing AC; nothing is tested without an AC anchor.
- [GAP-T6 — single scoped test-only repair] AC-D17 requires the baseline repair in `tests/checks/config-default-positions.test.ts`. That file is not part of the session-admin suites; the repair is a test-environment change with no product or assertion change (DEC-D11, TC-DB-035).

## 2. References

- **Change specification**: [chg-GH-180-spec.md](./chg-GH-180-spec.md) — AC-D1..AC-D18 (18 ACs), F-D1..F-D7, DM-D1..DM-D8, NFR-D1..NFR-D10, DEC-D1..DEC-D11, RSK-D1..RSK-D11, §3.1–§3.10 (surface, shapes, pinned constants), §7.1 suite names, §7.2 fixtures, §7.3 baseline repair.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries,golden}`, `scripts/checks/*.ts` mutation tests, boundary fixture meta-check, `pnpm check` as the aggregate gate, permanent suites assert the current tree.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, injected time/randomness/environment, runtime-API confinement, purity, result/error contract, fake-based deterministic tests, no moving-base diff assertions.
- **Adapter ports**: [feature-adapter-ports.md](../../../spec/features/feature-adapter-ports.md) — read-only `SessionStore` semantics, `SessionAdminPort` addition, `adapters ./session` no longer a stub.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope, error table, classification chain, binding bidirectional documented sync.
- **Architecture**: [ADR-0003 — OSS Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) — DEC-6 admitted I/O subpaths, C-11 metadata-only guarantee and privacy sign-off gate.
- **Command registry**: [cli-command-registry.md](../../../planning/oss-tooling/cli-command-registry.md) — the `ados db` family row; [backlog.md](../../../planning/oss-tooling/backlog.md) M0-S11.
- **Existing mechanisms (reuse, never re-implement)**: `tests/fixtures/status/harness.ts` and `tests/behaviour/status-output.test.ts` (runtime-fake + envelope + human caps pattern); `tests/golden/helpers.ts` (`SYNTHETIC_BRAND`, buffer streams, mutant-module import); `tests/behaviour/provider-cli.test.ts` and `config-cli.test.ts` (`createConfigProgram`/`runCli` in-process composition); `tests/structure/status-contract.test.ts` (constants + AST mutation controls); `tests/structure/cli-edge-seam.test.ts` (composition and exit-decision scans); `tests/checks/error-table-sync.test.ts` (temp-copy sync mutations); `tests/checks/config-default-positions.test.ts` (the repaired baseline); `tests/checks/fixture-sanitization.test.ts`; `scripts/checks/{ambient-globals,secret-read-boundary,forbidden-literals,exit-code-literals}.ts`.
- **Change precedents for shape**: [chg-GH-179-test-plan.md](../2026-10-31--GH-179--pm-notes-registry-lint-phase-transitions/chg-GH-179-test-plan.md), [chg-GH-184-test-plan.md](../2026-10-31--GH-184--privacy-and-no-cloud-guards/chg-GH-184-test-plan.md).
- **PM record**: [chg-GH-180-pm-notes.yaml](./chg-GH-180-pm-notes.yaml) — PM decisions, the missing-prototype fallback, live read-only environment facts, standing delivery rules.
- **Ticket**: GH-180 — M0-S11: db session-admin port.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC | Criterion (abbreviated) | TC ID(s) | Status |
|----|--------------------------|----------|--------|
| AC-D1 | `size` reports the runtime-resolved path, database/sidecar bytes with presence, counts and oldest/newest ISO timestamps (`null` when empty) with zero mutations | TC-DB-001, TC-DB-006, TC-DB-007, TC-DB-037 | Covered |
| AC-D2 | `list` returns at most `n` items (default 20, max 100), `updatedAt` descending then `id`, with `total`/`omitted`/`truncated`, whitelisted fields only, `live` from the injected clock, byte-identical replays | TC-DB-008, TC-DB-009, TC-DB-030, TC-DB-037 | Covered |
| AC-D3 | `prune` is dry-run by default: reports candidates and counts, performs no delete/checkpoint/file action/process action; a second dry-run is identical | TC-DB-011, TC-DB-030, TC-DB-037 | Covered |
| AC-D4 | Candidate selection enforces cold (strict), not-live (inclusive boundary), leaf, oldest-first ordering with `id` tiebreak, and the cap | TC-DB-012, TC-DB-013, TC-DB-014 | Covered |
| AC-D5 | Apply deletes only via one `opencode session delete <id>` per candidate; no raw `DELETE`/`DROP`/`TRUNCATE`/`VACUUM`; no database/WAL/SHM file is deleted, truncated or renamed | TC-DB-015, TC-DB-016, TC-DB-027 | Covered |
| AC-D6 | A second identical apply selects zero, deletes nothing and succeeds; a dry-run after apply also reports zero | TC-DB-017 | Covered |
| AC-D7 | The pre-delete re-check skips a candidate that gained a child (no delete, counted reason, others proceed) and re-asserts cold and live on the same predicate | TC-DB-018, TC-DB-019 | Covered |
| AC-D8 | Partial failure and post-land abort return `db.delete.failed` (exit 2, transient, retryable) with the normative summary `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"` (`attempted = landed + failed`); successful deletes are not failures; a retry converges; a pre-land query/re-read failure returns `db.query.failed` | TC-DB-020, TC-DB-022 | Covered |
| AC-D9 | An already-absent row is a counted skip mid-run, not a hard failure; the run continues | TC-DB-019, TC-DB-021 | Covered |
| AC-D10 | `reboot --apply` with a live session returns `db.reboot.live` and does nothing; with zero live sessions it performs exactly one checkpoint and reports WAL before/after; dry-run reports the block without erroring | TC-DB-031, TC-DB-032 | Covered |
| AC-D11 | No reboot run kills/signals/suspends/restarts a process or deletes/truncates a sidecar; human output states the operator restarts opencode manually | TC-DB-016, TC-DB-033 | Covered |
| AC-D12 | Grammar is validated before I/O: missing/unknown subcommand, unexpected positional (including a single-dash token such as `-x`), wrong flag for the subcommand, missing value, out-of-range number, value-bearing `--apply` are `input.value.rejected`; an undeclared `--`-prefixed token is `fallback.invocation`; both at exit 1 with zero reads and zero mutations | TC-DB-023, TC-DB-024 | Covered |
| AC-D13 | Numeric flags at min/max/one-below/one-above and injection-shaped ids: out-of-range rejected, in-range values are the only ones interpolated, no id outside `^[A-Za-z0-9_-]+$` is interpolated or passed to delete | TC-DB-025, TC-DB-026, TC-DB-027 | Covered |
| AC-D14 | Machine `data` ≤ 524288 bytes; human ≤ 32 item lines, 40 lines, 8192 bytes with `+N more`; no forbidden field or real user path in any output/error/evidence/fixture/log; canary appears zero times; redaction removal fails the suite | TC-DB-010, TC-DB-026, TC-DB-028, TC-DB-029, TC-DB-030 | Covered |
| AC-D15 | The four `db.*` failures map to their declared rows; documented table matches both directions; kind-only `db` contains via `fallback.internal`; no redundant grammar row | TC-DB-003, TC-DB-004, TC-DB-005, TC-DB-022 | Covered |
| AC-D16 | Contracts data-only, core domain pure, production I/O only in `packages/adapters/src/session/index.ts`, no SQLite driver, secret allowlist at four, no new package/subpath/dependency, `commands.db` registered only with a composition | TC-DB-001, TC-DB-002, TC-DB-010, TC-DB-034 | Covered |
| AC-D17 | Clean-checkout determinism: session-admin suites pass from fakes/fixtures, the repaired `config-default-positions` tests pass, zero real process/file/network/home use, zero real home paths in the introduced files | TC-DB-035, TC-DB-036, TC-DB-037 | Covered |
| AC-D18 | The C-11 sign-off is stated as required before merge, not claimed granted, with merge authority held by the CEO/human owner and the PR left open | TC-DB-038 | Covered (in-tree half automated; PR body manual per GAP-T3) |

**Capability coverage** (no capability unlinked): F-D1 → TC-DB-006, TC-DB-007; F-D2 → TC-DB-008, TC-DB-009, TC-DB-030; F-D3 → TC-DB-011..TC-DB-022; F-D4 → TC-DB-031..TC-DB-033; F-D5 → TC-DB-023..TC-DB-027; F-D6 → TC-DB-010, TC-DB-028..TC-DB-030; F-D7 → TC-DB-001, TC-DB-002, TC-DB-010, TC-DB-034.

### 3.2 Interface Coverage (F-#, DM-#)

The spec declares no `API-#` or `EVT-#` (no HTTP surface, no event or telemetry emission; §8.3). The interface surface is the eight data-model elements and the two ports.

| DM | Element | TC ID(s) | Observable assertion |
|----|---------|----------|----------------------|
| DM-D1 | `SizeData` | TC-DB-006, TC-DB-007, TC-DB-028 | Exact key set, presence flags, bytes, counts, ISO timestamps or `null`, zero mutations |
| DM-D2 | `ListData` / `SessionSummary` | TC-DB-008, TC-DB-009, TC-DB-010, TC-DB-028 | Exact page keys, exactly the nine item fields, ordering, caps, `live` from the injected clock, `dataBytes` as an exact summed UTF-8 byte length over `message`/`part` |
| DM-D3 | `PruneData` | TC-DB-011, TC-DB-014, TC-DB-017, TC-DB-020 | Mode, threshold, limit, live window, cutoff, the five counts, bounded candidates |
| DM-D4 | `RebootData` | TC-DB-031, TC-DB-032, TC-DB-033 | Mode, live window/count, blocked flag, checkpoint outcome, WAL before/after, presence |
| DM-D5 | Vocabulary data | TC-DB-001, TC-DB-028 | `DB_SCHEMA_VERSION` and closed command/mode sets exactly as declared |
| DM-D6 | Constants and bounds | TC-DB-001, TC-DB-025, TC-DB-037 | Exact values, enforced ranges, declared timeouts present and referenced |
| DM-D7 | Error identities | TC-DB-003, TC-DB-004, TC-DB-005, TC-DB-022 | Four rows round-trip; documented sync both directions; kind-only containment |
| DM-D8 | Ports and seam | TC-DB-001, TC-DB-010, TC-DB-034 | `SessionStorePort` read-only (`size`/`list`); `SessionAdminPort` extends with `prune`/`reboot`; seam is adapter-local and injectable |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-D1 | Determinism: 0 output drift, 0 ambient reads outside the seam, 100 % byte-identical human replays | TC-DB-030, TC-DB-011, TC-DB-036 | Covered |
| NFR-D2 | Boundedness: 0 outputs over the item/line/byte caps, 0 ids over 128, 0 paths over 1024, 0 unbounded fields | TC-DB-028, TC-DB-008, TC-DB-026 | Covered |
| NFR-D3 | Safety/idempotency: 0 live deletions, 0 file/sidecar mutations by prune, 0 second-run candidates, 0 non-converging retries, 0 parents deleted with children | TC-DB-011..TC-DB-021, TC-DB-033 | Covered |
| NFR-D4 | Performance on the reference store (≤ 30 s / ≤ 10 s / ≤ 30 s / ≤ 250 ms per re-check / ≤ 10 s / ≤ 180 s) | TC-DB-037 | Covered by bounded work in CI; mandatory read-only real-store smoke before PR; latency reference-only, non-CI (GAP-T2) |
| NFR-D5 | CI parity: 0 tests needing a real binary, database, network, home-directory or host state; 0 real user paths added; 100 % green including the repaired baseline | TC-DB-035, TC-DB-036 | Covered |
| NFR-D6 | Privacy/metadata-only: 0 forbidden fields, 0 canary occurrences, 0 extra item/evidence fields, 0 ambient environment values surfaced | TC-DB-010, TC-DB-029 | Covered |
| NFR-D7 | Error-table binding: 4/4 round-trip, 0 drift both directions, 0 containment escapes, 0 ambiguous kind-only selections | TC-DB-003, TC-DB-004, TC-DB-005 | Covered |
| NFR-D8 | SQL safety: 0 interpolated untrusted values, 0 unvalidated ids in SQL/argv, 0 out-of-range numbers interpolated, 0 bulk `IN (...)` | TC-DB-025, TC-DB-026, TC-DB-027 | Covered |
| NFR-D9 | Tier/runtime confinement: 0 new runtime-API locations, 0 secret-read entries added, 0 SQLite driver imports, 0 new packages/subpaths/dependencies, 0 contracts-tier behaviour | TC-DB-001, TC-DB-002, TC-DB-034 | Covered |
| NFR-D10 | Operational truthfulness: 0 failed delete reported as success, 0 live session reported deletable, 0 absent sidecar reported as a real zero-byte file, 0 `reboot` restart claims, 0 partial failure rendered as success | TC-DB-007, TC-DB-020, TC-DB-021, TC-DB-033 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 18 ACs appear in §3.1 with at least one TC.
- **Orphan TCs**: none. Each of the 38 TCs names at least one AC in §5.1 and §5.2.
- **Uncovered NFRs**: none. NFR-D4's CI-verifiable half is covered and its mandatory real-store smoke is recorded; its latency reference is explicitly reference-only (GAP-T2).
- **Duplicate coverage is intentional where a property is shared**: AC-D14 spans four TCs because it asserts four distinct properties (per-item whitelist, envelope/human caps, canary/whitelist over all channels, replay determinism); AC-D16 spans four because contracts, imports, seam conformance and composition registration are different failure modes; AC-D13 spans three because numeric ranges, id shapes and SQL text are separate oracles.
- **Spec-named behaviours bound to an existing AC** (GAP-T5; no separate AC by design):

| Behaviour | Spec source | Bound AC | Where |
|---|---|---|---|
| Abort the prune: before any delete lands on `db.opencode.unavailable` / `db.query.failed`; after at least one delete lands return `db.delete.failed` with the partial-abort summary; never substitute success | §3.4, §3.9 flow 4 | AC-D8 (no success on incomplete selection; post-land partial truth) + AC-D15 (exact classified row) + NFR-D10 | TC-DB-022 |
| `SessionStorePort` stays read-only while `SessionAdminPort` owns mutation | §4.2, DEC-D4 | AC-D16 (contract shape/boundaries) | TC-DB-001, TC-DB-010 |
| `size`/`list` read metadata only, never titles/prompts/bodies/parts | §3.2, §3.3 | AC-D14 (metadata-only in every mode) + NFR-D6 | TC-DB-010, TC-DB-029 |
| Declared timeouts exist as contract data and are referenced per I/O class | §3.10 DM-D6 | AC-D1/AC-D2/AC-D3 (bounded operations) + NFR-D2 | TC-DB-001, TC-DB-037 |
| Sidecar absence is explicit, never a real zero-byte file | §3.2, NFR-D10 | AC-D1 (size fields) | TC-DB-007 |

### 3.5 Coverage Matrix (requirement × suite)

Legend: `x` = the suite asserts the requirement. Suite columns are the spec's §7.1 names (`CON` = `session-admin-contract`, `IMP` = `session-admin-imports`, `SZL` = `session-admin-size-list`, `PRU` = `session-admin-prune`, `REB` = `session-admin-reboot`, `GRA` = `session-admin-grammar`, `OUT` = `session-admin-output`, `SQL` = `session-admin-sql-safety`, `PRV` = `session-admin-privacy`) plus the existing suites (`SYN` = `tests/checks/error-table-sync.test.ts`, `ETA` = `tests/structure/error-table.test.ts`, `ECL` = `tests/behaviour/error-classification.test.ts`, `EDG` = `tests/structure/cli-edge-seam.test.ts`, `BSE` = `tests/checks/config-default-positions.test.ts`, `GATE` = `pnpm check`).

| Requirement | CON | IMP | SZL | PRU | REB | GRA | OUT | SQL | PRV | SYN | ETA | ECL | EDG | BSE | GATE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AC-D1 | x |  | x |  |  |  | x |  | x |  |  |  |  |  | x |
| AC-D2 | x |  | x |  |  |  | x |  | x |  |  |  |  |  | x |
| AC-D3 | x |  |  | x |  |  | x |  |  |  |  |  |  |  | x |
| AC-D4 |  |  | x | x |  |  |  |  |  |  |  |  |  |  | x |
| AC-D5 |  | x |  | x |  |  |  | x |  |  |  |  |  |  | x |
| AC-D6 |  |  |  | x |  |  |  |  |  |  |  |  |  |  | x |
| AC-D7 |  |  |  | x |  |  |  |  |  |  |  |  |  |  | x |
| AC-D8 |  |  |  | x |  |  | x |  |  |  |  |  |  |  | x |
| AC-D9 |  |  |  | x |  |  |  |  |  |  |  |  |  |  | x |
| AC-D10 | x |  |  |  | x |  |  |  |  |  |  |  |  |  | x |
| AC-D11 |  | x |  | x | x |  | x |  |  |  |  |  |  |  | x |
| AC-D12 | x |  |  |  |  | x | x |  |  |  |  |  |  |  | x |
| AC-D13 | x |  |  |  |  | x |  | x |  |  |  |  |  |  | x |
| AC-D14 |  |  | x |  |  |  | x |  | x |  |  |  |  |  | x |
| AC-D15 | x |  |  |  |  |  | x |  |  | x | x | x |  |  | x |
| AC-D16 | x | x |  |  |  |  |  |  | x |  |  |  | x |  | x |
| AC-D17 |  | x |  |  |  |  |  |  | x |  |  |  |  | x | x |
| AC-D18 | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DM-D1 | x |  | x |  |  |  | x |  | x |  |  |  |  |  |  |
| DM-D2 | x |  | x |  |  |  | x |  | x |  |  |  |  |  |  |
| DM-D3 | x |  |  | x |  |  | x |  |  |  |  |  |  |  |  |
| DM-D4 | x |  |  |  | x |  | x |  |  |  |  |  |  |  |  |
| DM-D5 | x |  |  |  |  |  | x |  |  |  |  |  |  |  |  |
| DM-D6 | x |  |  |  |  |  |  | x |  |  |  |  |  |  |  |
| DM-D7 |  |  |  |  |  |  |  |  |  | x | x | x |  |  |  |
| DM-D8 | x |  |  |  |  |  |  |  | x |  |  |  | x |  |  |
| NFR-D1 |  |  |  | x |  |  | x |  | x |  |  |  |  |  | x |
| NFR-D2 | x |  | x |  |  |  | x |  |  |  |  |  |  |  | x |
| NFR-D3 |  | x |  | x | x |  |  | x |  |  |  |  |  |  | x |
| NFR-D4 |  |  | x | x | x |  |  |  |  |  |  |  |  |  | x |
| NFR-D5 |  | x |  |  |  |  |  |  | x |  |  |  |  | x | x |
| NFR-D6 |  |  | x |  |  |  | x |  | x |  |  |  |  |  | x |
| NFR-D7 |  |  |  |  |  |  |  |  |  | x | x | x |  |  | x |
| NFR-D8 |  |  |  |  |  | x |  | x |  |  |  |  |  |  | x |
| NFR-D9 | x | x |  |  |  |  |  |  |  |  |  |  | x |  | x |
| NFR-D10 |  |  | x | x | x |  | x |  |  |  |  |  |  |  | x |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract and vocabulary | `bun test tests/structure` | `tests/structure/session-admin-contract.test.ts`; `tests/structure/error-table.test.ts` (update) | TC-DB-001, TC-DB-003, TC-DB-038 |
| Boundary, purity and confinement | `bun test tests/structure tests/boundaries`; `bun run scripts/checks/{ambient-globals,secret-read-boundary,workspace-entrypoints,exit-code-literals}.ts` | `tests/structure/session-admin-imports.test.ts` | TC-DB-002, TC-DB-036 |
| Error classification and sync | `bun test tests/behaviour tests/checks`; `bun run scripts/checks/error-table-sync.ts` | `tests/behaviour/error-classification.test.ts` (update), `tests/checks/error-table-sync.test.ts` (update) | TC-DB-004, TC-DB-005 |
| Behaviour — size and list | `bun test tests/behaviour` | `tests/behaviour/session-admin-size-list.test.ts` + `tests/fixtures/session-admin/**` | TC-DB-006..TC-DB-009, TC-DB-037 |
| Behaviour — prune | `bun test tests/behaviour` | `tests/behaviour/session-admin-prune.test.ts` | TC-DB-011..TC-DB-022, TC-DB-037 |
| Behaviour — reboot | `bun test tests/behaviour` | `tests/behaviour/session-admin-reboot.test.ts` | TC-DB-031..TC-DB-033 |
| Behaviour — grammar and errors | `bun test tests/behaviour` | `tests/behaviour/session-admin-grammar.test.ts` | TC-DB-023, TC-DB-024, TC-DB-025 (grammar half) |
| Behaviour — output | `bun test tests/behaviour` | `tests/behaviour/session-admin-output.test.ts` + committed goldens | TC-DB-028, TC-DB-030 |
| Behaviour — SQL safety | `bun test tests/behaviour` | `tests/behaviour/session-admin-sql-safety.test.ts` | TC-DB-025 (clamp half), TC-DB-026, TC-DB-027 |
| Contract and privacy | `bun test tests/behaviour` | `tests/behaviour/session-admin-privacy.test.ts` | TC-DB-010, TC-DB-029, TC-DB-036 |
| CLI composition | `bun test tests/structure` | `tests/structure/cli-edge-seam.test.ts` (update) | TC-DB-034 |
| Baseline repair | `bun test tests/checks/config-default-positions.test.ts` | repaired in place | TC-DB-035 |
| Aggregate and non-regression | `pnpm check` | repo root; unchanged gates | All TCs (regression half) |

### 4.1 In-Process Fake-IO Contract (binding for every session-admin TC)

1. **No real process, file, database, home or network.** Every session-admin suite imports the production modules and injects fakes. No suite spawns `opencode`, `bun`, or any process; no suite opens a SQLite file; no suite reads `$HOME`, `os.homedir()` or an ambient environment where purity is asserted; no suite resolves a host or opens a socket. The only implicit process in the plan is the test runner itself; TC-DB-036 asserts the absence of spawns inside the suites.
2. **One fake `OpencodeSessionIo`, two observation levels.**
   - *IO-level* (`tests/behaviour/session-admin-{size-list,prune,reboot,sql-safety,privacy}.test.ts`): the fake implements `databasePath`, `query`, `deleteSession`, `checkpoint`, `now`, `stat` plus injected `command`/`environment` data. It records an ordered call log `{ kind, value }` and answers from a scripted per-call queue or a bound handler per query class. The fake never interprets SQL semantically; it pops the scripted response and the test asserts the recorded `sql` text separately. Because the fake is blind to SQL meaning, adapter SQL correctness is pinned **textually/structurally** over the recorded query text — the prune selection predicates (cold, not-live, `NOT EXISTS` child), `ORDER BY ... time_updated`, and `LIMIT`; the reboot live-count 15-minute comparison (or the injected live boundary value); the list page aggregates over the current `message` and `part` stores, with `dataBytes` expressed as a **byte** length (`LENGTH(CAST(<column> AS BLOB))` or `OCTET_LENGTH(<column>)`, never a bare character `LENGTH(<column>)`); and that the SQL carries the values returned by `computeDbCutoffMs`/`computeDbLiveBoundaryMs`. The exact SQL wording stays delivery-bound (GAP-T4/A-T1), but these predicates may not be dropped.
   - *Runtime-level* (`tests/behaviour/session-admin-{grammar,output}.test.ts`): a fake `DbCommandRuntime` with one recording method per subcommand (the `tests/fixtures/status/harness.ts` precedent) returns scripted `Session*Read` results or classified failures. Grammar and output tests assert zero runtime calls for rejections and the exact data for successes.
3. **Injected time, ids and brand.** `nowMs` is fixed (`NOW_MS = Date.UTC(2026, 9, 31, 12, 0, 0)`); `newRunId` is a fixed sequence; the brand is `SYNTHETIC_BRAND` from `tests/golden/helpers.ts`. No test depends on the wall clock, the developer home or file enumeration order.
4. **Recorded arguments over inference.** Where the AC concerns what the seam receives (query text, delete id, checkpoint SQL, stat path), the test asserts the recorded argument, not a guessed side effect.
5. **Mutation between calls is explicit.** TOCTOU fixtures mutate the fake store between the selection call and the re-read call, and between the re-read and the delete call, by named operations (`fakeSetChildren`, `fakeRemoveRow`, `fakeFailDelete`). No timing, sleep or scheduler is involved.
6. **Temp roots only.** Any test needing a real filesystem (goldens, baseline mechanism proof, whole-tree scans) uses `mkdtemp` in the OS temp directory or read-only committed fixtures. The live repository tree is never written by a session-admin test.

### 4.2 Non-Vacuity Contract (binding for every negative, skip, cap and absence scenario)

Every TC declares its control in §4.3 and §5.2. The contract is:

1. **A planted positive is asserted present before the absence is asserted.** A canary value, a forbidden-shaped field, a cold row or a candidate id is asserted to exist in the fixture (or in the fake's raw response) before the test asserts it is absent from output, excludes it from selection, or skips it.
2. **A paired live control runs in the same test.** A boundary exclusion runs beside a boundary inclusion (at-cutoff excluded / one millisecond older included); a skip runs beside a successful sibling delete; a cap-truncated output runs beside a within-cap output; a composition-absent case runs beside a composition-present case.
3. **A detection-disabled mutant must fail the suite.** For each guard that could pass vacuously (the field projection, the whitelist check, the leaf predicate, the cold/live predicate, the SQL scanner, the destructive-call scanner, the registration guard), the suite imports a temp mutant copy of the production module through a file URL (`tests/golden/redaction.test.ts` pattern) in which the named step is disabled, and asserts the mutant produces the prohibited observable while the fixture still verifiably contains the trigger. If the real module also produced nothing, the test fails.
4. **No assertion depends on a moving base.** Every assertion reads the current tree, a committed fixture, or an isolated temp copy. A `git diff` against `origin/main-tools` is not used anywhere in the permanent suite.
5. **Adapter SQL predicates are asserted, not inferred.** Because the fake never interprets SQL, every selection/live-count oracle asserts the recorded query text: the prune selection SQL carries the cold predicate, the not-live predicate, the `NOT EXISTS` child (leaf) predicate, `ORDER BY ... time_updated`, and `LIMIT`; the reboot live-count SQL carries the 15-minute comparison (or the injected live boundary). A mutant adapter that drops one predicate or hardcodes the host clock while the scripted fake returns the same rows/count must fail the suite (TC-DB-011..TC-DB-014, TC-DB-031, TC-DB-032).

### 4.3 Normative Test-Case Table

This table is binding: a TC is complete only when every column is satisfied. `Level` names the layer and the spec §7.1 suite. Exit codes are absolute (`0` success, `1` user rejection, `2` platform failure).

| TC | AC | Level / suite | Fixture / fake | Steps (compact) | Oracle | Exit / observable | Non-vacuity control |
|----|----|---------------|----------------|-----------------|--------|-------------------|---------------------|
| TC-DB-001 | AC-D16, AC-D1 | Contract / CON | `packages/core/src/contracts/session.ts`; AST scan | Parse the contracts file; assert declaration-only; assert every pinned constant and the closed command/mode sets; assert port members | Zero executable statements; exact constant values; `SessionStorePort` = `size`,`list`; `SessionAdminPort` adds `prune`,`reboot` | Exports load; no I/O member | A seeded executable statement and a wrong constant in a temp copy each fail |
| TC-DB-002 | AC-D16, NFR-D9 | Static / IMP | New source files; boundary harness; secret-read check; repo-wide import scan | Scan imports/purity/runtime conditionals; scan the tree for SQLite drivers; assert allowlist length 4; assert no new package/subpath/dependency; assert boundary fixtures unchanged | Zero `node:*`/`bun:*` in contracts and domain; runtime APIs only in the admitted subpath; 0 SQLite imports; 4 allowlist entries; unchanged export key sets | Suite green; seeded violations fail | Seeded `node:fs` in core, `bun:sqlite` in a temp copy, and a fifth allowlist entry all fail |
| TC-DB-003 | AC-D15, NFR-D7 | Contract / ETA | `ERROR_TABLE`, `DOMAIN_KINDS`; trigger invocations | Assert `db` in `DOMAIN_KINDS`; assert exactly 4 `db` rows with every field; drive each code through its trigger; compare `classifyThrown`/`classifyDomainKind` | 4/4 exact rows; same entry from both classifiers; no new grammar row | Codes reachable; failure envelopes carry the row fields | Removing one row in a temp copy fails its trigger test |
| TC-DB-004 | AC-D15, NFR-D7 | Contract / SYN | `scripts/checks/error-table-sync.ts`; documented table | Run sync green; assert non-zero counts; assert each `db` row appears once in the documented table; mutate machine and doc copies in both directions; assert missing/empty/unparseable fails closed | 0 drift both directions; named offender per mutation | Sync exit 0 on the tree; non-zero on every mutation | Unchanged control stays green; doc-only and machine-only drift both fail |
| TC-DB-005 | AC-D15, NFR-D7 | Contract / ECL | `classifyDomainKind`, `classifyThrown`; existing kinds; first-row control | Kind-only `db`; wrong-kind; unknown/missing/non-string code; exact codes; existing kinds | Kind-only lookup throws and thrown kind-only contains via `fallback.internal`; exact codes resolve; existing kinds unchanged | `fallback.internal` at exit 2 | First-row-selecting control is caught |
| TC-DB-006 | AC-D1, DM-D1 | Behaviour / SZL | IO fake + synthetic store (12 rows, mixed sidecars) | Run `db size`; assert data keys/values; assert call log | Path from `databasePath`; bytes and presence; counts; oldest/newest ISO; zero delete/checkpoint | Exit 0; one envelope; zero mutations | Paired absent/present sidecar fixture; a fabricating mutant fails |
| TC-DB-007 | AC-D1, NFR-D10 | Behaviour / SZL | Empty store; absent sidecars; zero-byte sidecar | Run `db size` on empty and on a real zero-byte sidecar | `oldest/newest = null`; `walBytes 0` + `walPresent false`; a real zero-byte file reports `present true` | Exit 0 | Absent versus zero-byte pair; a conflating mutant fails |
| TC-DB-008 | AC-D2, DM-D2 | Behaviour / SZL | 25 sessions; 100/101-session fixtures; tie row; multi-byte byte-length row; empty row set; archived/unarchived rows | Run `db list` default and with `--limit`; assert order, page keys, item key set, exact `dataBytes`, the field-source mapping and the aggregate SQL | Default 20; max 100; `updatedAt` desc then `id`; `total/omitted/truncated`; exactly 9 item fields; `dataBytes` = summed UTF-8 byte length over `message`+`part` (multi-byte case 11, not 6), `0` when no rows; `archived = time_archived IS NOT NULL`; `createdAt`/`updatedAt` from `time_created`/`time_updated`; page SQL uses `LENGTH(CAST(... AS BLOB))`/`OCTET_LENGTH` over `message`/`part` | Exit 0; item keys exactly the whitelist; bytes and field sources exact | Shuffled fake response still sorts; an added `title` fails; a character-`LENGTH` mutant reports 6 and fails; an `archived`-column selection mutant fails |
| TC-DB-009 | AC-D2 | Behaviour / SZL | Boundary rows at 15 min, ±1 ms, 16 min; empty store | Run `db list`; assert `live` per row; run on empty store; shift the injected clock | `live` true at exactly 15 min and newer, false at 15 min + 1 ms; empty page `total 0`, `items []`, `truncated false` | Exit 0 | Paired boundary rows; a `<` mutant fails |
| TC-DB-010 | AC-D14, AC-D16, NFR-D6 | Contract / PRV | Port type surface; fake IO conformance; canary constants | Assert the read port has no mutation member; conform the fake to both ports; assert the seam is adapter-local; run a metadata-only probe | Read port surface is exactly `size`/`list`; `prune`/`reboot` only on the admin port; seam exported from `@delivery-os/adapters/session` only | Type-level and runtime conformance green | A `prune` member added to the read port in a temp copy fails |
| TC-DB-011 | AC-D3, NFR-D3 | Behaviour / PRU | 5 cold leaves; IO fake | Run `db prune` twice; snapshot the fake store; inspect the recorded selection SQL | `mode dry-run`; `selected 5`, `deleted/failed/skipped 0`; 5 candidates; zero `deleteSession`/`checkpoint`; two runs byte-identical; selection SQL carries the cold predicate, the not-live predicate, `NOT EXISTS` child, `ORDER BY ... time_updated`, and `LIMIT` | Exit 0; zero mutations; all five selection predicates present | A delete-in-dry-run mutant fails; a dropped-predicate selection mutant fails; row bytes unchanged |
| TC-DB-012 | AC-D4 | Behaviour / PRU | `boundaries.ts`: at-cutoff, cutoff−1 ms, cutoff+1 ms, 24 h pair | Run `db prune --older-than 30` and `--older-than 1`; inspect the selection SQL | At-cutoff excluded; 1 ms older included; 1 ms newer excluded; cutoff echoed as ISO; the SQL cold comparison carries `computeDbCutoffMs(NOW_MS, days)` and changes with `--older-than` | Exit 0; selected ids exact; computed cutoff in SQL | Both sides in one fixture; a `<=` mutant includes the boundary row and fails; a wrong-cutoff mutant fails |
| TC-DB-013 | AC-D4 | Behaviour / PRU | Live rows at 5/15 min, 15 min−1 ms, 15 min+1 ms, 16 min; parent/child/leaf fixtures | Run `db list` and `db prune`; run the pure predicate probe; inspect the selection SQL | Exactly 15 min and newer are live; 15 min+1 ms is not live; 16 min is not cold and not a candidate; a parent with any child is excluded; a child leaf is included; the SQL not-live predicate carries `computeDbLiveBoundaryMs(NOW_MS)` and the `NOT EXISTS` child predicate | Exit 0; selected ids and `live` flags exact; computed live boundary and leaf predicate in SQL | Parent/child pair; live pair; defensive live+cold policy probe (`liveExcluded` at policy level per §3.4); a dropped-not-live or dropped-leaf mutant fails |
| TC-DB-014 | AC-D4 | Behaviour / PRU | Distinct and tied `updatedAt`; 5 candidates, limit 2 | Run `db prune --limit 2`; assert order and cap; inspect the selection SQL | Oldest-first, `id` ascending on ties, exactly 2 candidates, `selected 2`; SQL carries `ORDER BY ... time_updated` and `LIMIT 2` | Exit 0; candidate order exact; ordering and limit in SQL | Fake returns rows scrambled; a pass-through mutant fails; a dropped `ORDER BY`/`LIMIT` mutant fails |
| TC-DB-015 | AC-D5 | Behaviour / PRU | 3 eligible candidates; IO fake | Run `db prune --apply`; inspect the call log | One `deleteSession` per selected id in order; zero raw `DELETE`; `mode applied`; `deleted 3` | Exit 0; call log exact | A bulk-SQL-delete mutant is caught |
| TC-DB-016 | AC-D5, AC-D11, NFR-D3 | Behaviour / PRU + IMP | Recorded `stat` calls; adapter AST scan | Run prune dry-run and apply; assert stat paths; scan the adapter for destructive file APIs | Stats only `db`, `db-wal`, `db-shm`; zero unlink/rm/truncate/write/rename; the seam has no delete-file member | Exit 0; no file operation recorded | Planted `unlinkSync` in a temp adapter copy fails the scan |
| TC-DB-017 | AC-D6, NFR-D3 | Behaviour / PRU | Fake store that removes deleted rows | Apply, apply again, then dry-run | Second apply `selected 0`, `deleted 0`, zero delete calls, success; dry-run `selected 0`; third run stable | Exit 0 on all three | A mutant keeping rows selected fails |
| TC-DB-018 | AC-D7 | Behaviour / PRU | Candidate X gains a child after selection; sibling Y | Apply; inspect re-read and delete calls | Zero delete for X; `skipped >= 1`; X not reported deleted; Y deleted; re-read SQL carries cold, live and child predicates | Exit 0; counts and call log exact | A re-read mutant checking only child existence fails the SQL-text and outcome assertions |
| TC-DB-019 | AC-D7, AC-D9 | Behaviour / PRU | Candidate vanishes before the re-read | Apply; inspect the call log | X skipped, no delete, run continues, no failure | Exit 0 | A mutant deleting from the selection row fails |
| TC-DB-020 | AC-D8, NFR-D10 | Behaviour / PRU + OUT | 3 candidates; second delete fails | Apply; inspect envelope and store; retry | `db.delete.failed`, transient, retryable, `not_landed`, exit 2; normative summary names failed count, attempted count, first id and landed count; failed row remains; retry deletes it only | Exit 2, then 0 | A success-on-partial mutant and a summary-without-id or summary-without-landed-count mutant both fail |
| TC-DB-021 | AC-D9, NFR-D10 | Behaviour / PRU | Row absent at delete (re-read succeeds, delete rejects, store lacks the row) | Apply; inspect counts and continuation | `skipped >= 1`, no `db.delete.failed` for that candidate, subsequent candidates attempted | Exit 0 | Present-row sibling still deleted and counted in the same run |
| TC-DB-022 | AC-D8, AC-D15 | Behaviour / PRU | `databasePath` throws; malformed JSON; non-array; non-zero; re-read failure after one delete landed | Run each pre-land class and the post-land abort through `db prune` | Pre-land: `db.opencode.unavailable` / `db.query.failed` at exit 2, zero deletes. Post-land: `db.delete.failed`, transient, retryable, `not_landed`, exit 2, summary `"1 of 2 session deletes did not land (first: <second-id>); 1 landed"`, zero further candidates; never success | Exit 2 by class | A failure-to-empty mutant returns success while candidates exist and is caught; a post-land mutant that reports `db.query.failed` instead of `db.delete.failed` is caught |
| TC-DB-023 | AC-D12, NFR-D8 | Behaviour / GRA | Runtime fake; grammar matrix §4.5 | Run each rejection class and the last-wins case | Exactly `input.value.rejected`; zero runtime calls; `--json` stripped and accepted; repeated flags last-wins | Exit 1; zero I/O for rejections; exit 0 for last-wins | A valid sibling invocation succeeds and calls the runtime |
| TC-DB-024 | AC-D12 | Behaviour / GRA | Runtime fake; containment matrix §4.5 | Run each undeclared `--`-prefixed containment token | Exactly `fallback.invocation`; zero runtime calls | Exit 1; zero I/O | A valid flag with the same prefix succeeds |
| TC-DB-025 | AC-D13, NFR-D8 | Behaviour / SQL + GRA | Range matrix §4.6; pure selection probe | Run min/max/±1 for each flag; probe defensive clamping | Out-of-range rejected with `input.value.rejected`; in-range passed through exactly; a direct out-of-range injection is clamped before interpolation | Exit 1 out of range; exit 0 in range | A raw-value mutant emits `99999` and fails |
| TC-DB-026 | AC-D13, AC-D14, NFR-D8 | Behaviour / SQL | Id-shape matrix §4.7; over-cap id/path | Run each shape through the adapter | Invalid id → `db.query.failed`, zero deletes; no SQL/argv contains an invalid id; over-cap id/path → `db.query.failed` naming the field, never truncation | Exit 2 | An interpolating mutant puts `';` into SQL and fails |
| TC-DB-027 | AC-D13, AC-D5, NFR-D8 | Behaviour / SQL | Call log from every run | Assert statement count and text; assert delete path | One statement per query (no `;`), no `DELETE`/`DROP`/`TRUNCATE`/`VACUUM`/`ALTER`/`CREATE`, no `IN (`, per-candidate delete only | Exit 0 | A `DELETE FROM session` mutant fails |
| TC-DB-028 | AC-D14, NFR-D2 | Behaviour / OUT | Runtime fake; max-fixture; goldens | Run every success and failure class in both modes | One valid envelope in `--json`, no `data` on failure, `data.schemaVersion` exact; human ≤ 32 item lines/40 lines/8192 bytes; `+N more`; rendered + N = total; machine data ≤ 524288 | Exits 0/1/2 by class | Over-cap renderer and 40-item mutants both fail |
| TC-DB-029 | AC-D14, NFR-D6 | Behaviour / PRV + OUT | Canary constants; forbidden-shaped fake columns; env canary | Run every class; walk stdout, stderr, parsed envelope, human text, error objects; scan fixtures | Zero canary occurrences; exact key sets; zero extra fields; no forbidden field name in committed fixtures | Exits by class | Presence asserted first; wide-projection and extra-field mutants expose the canary |
| TC-DB-030 | AC-D2, AC-D3, AC-D14, NFR-D1 | Behaviour / OUT | Runtime + IO fakes; fixed clock/runId; throwing ambient stubs | Run each subcommand three times; compare bytes and call logs; stub `Date.now`/`Math.random`/`fetch` | Identical stdout bytes, deep-equal data, identical call log; stubbed run unchanged | Exit 0 | A `Date.now()` renderer mutant drifts and fails |
| TC-DB-031 | AC-D10, DM-D4 | Behaviour / REB | 2 live sessions; 0 live sessions; same stored state under a shifted injected clock | Dry-run with live; apply with live; re-run dry-run/apply under a later injected clock; inspect the log and live-count SQL | Dry-run `mode dry-run`, `liveSessions 2`, `blockedByLiveSession true`, `checkpointPerformed false`, exit 0; apply `db.reboot.live`, transient, retryable, exit 2, zero checkpoint/delete; the live-count SQL carries the 15-minute comparison (or the injected `computeDbLiveBoundaryMs` value); the clock shift changes the live count and flips the gate | Exit 0 then 2; clock-shift count changes | A checkpointing-despite-gate mutant fails; a host-clock live-count mutant fails the clock-shift case |
| TC-DB-032 | AC-D10, DM-D4 | Behaviour / REB | 0 live sessions; WAL before/after fixtures | Apply; inspect data, call log and live-count SQL | Exactly one `checkpoint`; SQL exactly `PRAGMA wal_checkpoint(TRUNCATE)`; `walBytesBefore`/`After` present; `checkpointPerformed true`; live-count SQL carries the 15-minute comparison (or the injected boundary) | Exit 0 | A double-checkpoint or `VACUUM` mutant fails; a live-count SQL missing the window predicate fails |
| TC-DB-033 | AC-D11, NFR-D3, NFR-D10 | Behaviour / REB + OUT | Adapter AST scan; human goldens | Run dry-run and apply; assert no process/file action; assert human text | Zero kill/signal/suspend/restart; zero sidecar deletion; human text contains the manual-restart sentence and no restart claim | Exit 0/2 by branch | A planted `process.kill` and a "restarted" mutant text both fail |
| TC-DB-034 | AC-D16, NFR-D9 | Contract / EDG | `createProgram` with and without `db`; commands index; edge | Compose without `db`; run `db size`; compose with `db`; inspect exports | Without composition `commands.db` absent and `db size` is `fallback.invocation` exit 1; with composition registered and running; handler has no `exitCode` decision | Exit 1 then 0 | Both branches asserted, so a no-op registration fails |
| TC-DB-035 | AC-D17 | Integration / BSE | Repaired test file; absent-parent mechanism probe | Assert the recursive parent creation and position; prove the mechanism with and without the parent | One recursive `tmp/tmpdir` creation before the first `mkdtemp`; every target parent is `tmp/tmpdir`; absent parent throws without the repair and succeeds with it; the suite passes | Suite exit 0 in a clean checkout | The no-repair control must throw `ENOENT` |
| TC-DB-036 | AC-D17, NFR-D5, NFR-D1 | Static / IMP + PRV | The nine suites; declared file set; path scanner | Scan for spawns/`$HOME`/network/writes; scan the introduced files for real home paths | Zero spawns, zero home reads, zero network, zero SQLite; zero real home-path matches; non-empty scan scope | Suite green; scan reports a positive scope count | A planted runtime-synthesized home-shaped path (segments joined at test runtime, never a committed literal) and a planted `spawn` both fail |
| TC-DB-037 | AC-D1, AC-D2, AC-D3, AC-D17, NFR-D4 | Performance / SZL + PRU + REB | 10-row and 6,900-row synthetic fixtures; call logs; mandatory real-store smoke; reference procedure | Assert query-count invariance and bounded per-candidate work; assert timeouts; run the pure-policy budget; run the mandatory read-only real-store smoke and record the optional reference measurement | `size` query count equal for both fixtures and aggregate-shaped; `list` exactly 2 queries; prune ≤ 1 + limit queries and ≤ limit deletes; reboot 1 live-count + ≤ 1 checkpoint; timeouts 30000/30000/120000 referenced; policy over 6,900 rows within the soft local budget; real-store `db size` and `db list --limit 5` exit 0 with recorded output and no mutation | Exit 0; counts bounded; smoke recorded; reference numbers recorded as non-CI | A per-row-query mutant breaks invariance; a newest-first fixture proves the count assertion is not the ordering test; a mutation-inducing smoke is rejected |
| TC-DB-038 | AC-D18, RSK-D9 | Contract / CON (+ manual) | Spec §5.5; PR body checklist | Scan the spec and change evidence for the sign-off statement; assert no approval claim; complete the PR-body half manually | Sign-off required and not claimed granted; merge authority named; PR open | Automated green; manual checklist recorded in §10 | A temp copy asserting approval fails the scan |

**Exit-code oracle for the table above** (the single source for §4.3, encoded in TC-DB-028 and TC-DB-003):

| Condition | Identity | Category | Retryable | Consequence | Projection class | Exit | TC |
|---|---|---|---|---|---|---|---|
| Missing/unknown subcommand, unexpected positional (including a single-dash token such as `-x`), flag not declared for the subcommand, missing value, out-of-range numeric, value-bearing `--apply` reaching the handler (repeated same-flag occurrences are last-wins, not a rejection) | `input.value.rejected` | user | false | not_landed | user-validation | 1 | TC-DB-023 |
| Undeclared `--`-prefixed token (`--bogus`, `--accept`, `--apply=false`, `--limit=5`) | `fallback.invocation` | user | false | unknown | user-validation | 1 | TC-DB-024 |
| `opencode` unavailable, `opencode db path` fails, database absent/unreadable before any delete lands | `db.opencode.unavailable` | platform | false | not_landed | platform-provider | 2 | TC-DB-022 |
| A query fails or returns a malformed result before any delete lands | `db.query.failed` | platform | true | not_landed | platform-provider | 2 | TC-DB-022, TC-DB-026 |
| A delete did not land, including partial failure and an aborting query/re-read/availability failure after at least one delete landed | `db.delete.failed` | transient | true | not_landed | platform-provider | 2 | TC-DB-020, TC-DB-022 |
| `reboot --apply` while a live session exists | `db.reboot.live` | transient | true | not_landed | platform-provider | 2 | TC-DB-031 |
| Unclassifiable failure, including kind-only `db` | `fallback.internal` | platform | false | unknown | platform-provider | 2 | TC-DB-005 |
| Any success | — | — | — | — | success | 0 | TC-DB-028 |

### 4.4 Boundary Matrix (binding for AC-D4 and AC-D9)

Time base: `NOW_MS = Date.UTC(2026, 9, 31, 12, 0, 0)`; `LIVE_BOUNDARY = NOW_MS − 15 × 60_000`; `CUTOFF(d) = NOW_MS − d × 86_400_000`.

| ID | Row fact | Expected outcome | Asserted by |
|----|----------|------------------|-------------|
| B-01 | `updatedAt == CUTOFF(30)` (exactly at the cold boundary) | Not cold → not a candidate | TC-DB-012 |
| B-02 | `updatedAt == CUTOFF(30) − 1 ms` | Cold → candidate if leaf and not live | TC-DB-012 |
| B-03 | `updatedAt == CUTOFF(30) + 1 ms` | Not cold → not a candidate | TC-DB-012 |
| B-04 | `updatedAt == CUTOFF(1) − 1 ms` (24 h + 1 ms) | Cold (the 1-day floor) → candidate if leaf | TC-DB-012 |
| B-05 | `updatedAt == LIVE_BOUNDARY` (exactly 15 min) | Live (inclusive lower boundary) → never a candidate; `list.live true` | TC-DB-009, TC-DB-013 |
| B-06 | `updatedAt == LIVE_BOUNDARY + 1 ms` (15 min − 1 ms) | Live; `list.live true` | TC-DB-009, TC-DB-013 |
| B-07 | `updatedAt == LIVE_BOUNDARY − 1 ms` (15 min + 1 ms) | Not live, but not cold at ≥ 1 day → not a candidate | TC-DB-009, TC-DB-013 |
| B-08 | 16 minutes old, `--older-than 30` | Not live and not cold → not a candidate and not counted `liveExcluded` | TC-DB-013 |
| B-09 | Live row forced through the pure predicate with an injected cold fact | Excluded by the not-live predicate; `liveExcluded = 1` at assembly level only (unreachable through the CLI at the 1-day floor, per §3.4) | TC-DB-013 |
| B-10 | Cold leaf with no children | Candidate | TC-DB-013 |
| B-11 | Cold parent whose child is also cold | Parent excluded; child (a leaf) candidate | TC-DB-013 |
| B-12 | Cold parent whose only child is live | Parent excluded (child existence is independent of the child's coldness) | TC-DB-013 |
| B-13 | Candidate that gains a child between selection and re-read | Skipped with a counted reason; zero delete | TC-DB-018 |
| B-14 | Candidate whose row vanishes before the re-read | Skipped; zero delete; run continues | TC-DB-019 |
| B-15 | Candidate whose row is absent when the delete is attempted | Skipped; no `db.delete.failed`; run continues | TC-DB-021 |
| B-16 | Two candidates with equal `updatedAt` and ids `b`, `a` | Ordered `a` then `b` | TC-DB-014 |

### 4.5 Grammar Rejection and Last-Wins Matrix (binding for AC-D12)

| ID | Invocation (after `db`) | Expected identity | Exit | Runtime/IO calls |
|----|--------------------------|-------------------|------|------------------|
| G-01 | *(none)* | `input.value.rejected` | 1 | 0 |
| G-02 | `inspect` | `input.value.rejected` | 1 | 0 |
| G-03 | `size extra` | `input.value.rejected` | 1 | 0 |
| G-04 | `size --limit 5` | `input.value.rejected` | 1 | 0 |
| G-05 | `list --older-than 7` | `input.value.rejected` | 1 | 0 |
| G-06 | `prune --json` (accepted globally, stripped) | success path | 0 | ≥ 1 (proves `--json` is not a grammar token) |
| G-07 | `list --limit` (no value) | `input.value.rejected` | 1 | 0 |
| G-08 | `prune --older-than` (no value) | `input.value.rejected` | 1 | 0 |
| G-09 | `list --limit 0`, `--limit 101`, `prune --limit 0`, `--limit 501`, `prune --older-than 0`, `--older-than 3651` | `input.value.rejected` | 1 | 0 |
| G-10 | `list --limit abc`, `--limit 1.5`, `prune --older-than -1` | `input.value.rejected` | 1 | 0 |
| G-11 | `prune --apply false` (stray value token) | `input.value.rejected` | 1 | 0 |
| G-12 | `prune --apply --apply`; `prune --limit 5 --limit 10` (repeated same flag; the parser overwrites, no `db` conflict pairs) | success path; `--apply` accepted as apply; effective `limit 10` | 0 | ≥ 1 (proves repeated flags are not a rejection) |
| G-13 | `size -x` (single-dash token; unexpected positional) | `input.value.rejected` | 1 | 0 |
| P-01 | `size --bogus` | `fallback.invocation` | 1 | 0 |
| P-02 | `size --limit=5` | `fallback.invocation` | 1 | 0 |
| P-03 | `reboot --apply=false` | `fallback.invocation` | 1 | 0 |
| P-04 | `size --x` | `fallback.invocation` | 1 | 0 |

**Why G-03/G-07/G-08/G-13 are handler rejections and P-01..P-04 are parser containments** (A-T3): the shared parser recognizes only `--`-prefixed tokens as flags. The command declares its full `--` flag set and enough positional capacity for the handler to see the tokens, so missing values, unexpected positionals (including a single-dash token such as `-x`) and wrong-for-subcommand flags are validated in the handler and classified `input.value.rejected` per §3.1. An undeclared `--`-prefixed token (including a fused `--flag=value`) is contained by the parser as `fallback.invocation` per DEC-D7. Both classes are exit 1 with zero I/O. **Repeated same-flag occurrences are not a conflict:** `db` declares no conflict pairs, the parser overwrites and the last value wins (spec §3.1), so G-12 is a last-wins acceptance case (`--apply --apply` is apply; `--limit 5 --limit 10` is `limit 10`), not a rejection.

### 4.6 Numeric Flag Range Matrix (binding for AC-D13, NFR-D8)

| Flag | Default | Min | Max | Accepted probes | Rejected probes |
|------|---------|-----|-----|-----------------|-----------------|
| `list --limit` | 20 | 1 | 100 | 1, 20, 100 | 0, 101, `""`, `1.5`, `abc` |
| `prune --limit` | 50 | 1 | 500 | 1, 50, 500 | 0, 501, `""`, `1.5`, `abc` |
| `prune --older-than` | 30 | 1 | 3650 | 1, 30, 3650 | 0, 3651, `""`, `1.5`, `abc` |

Accepted values are asserted to be the exact values the seam receives (never silently clamped). A **direct** out-of-range injection into the pure selection/assembly (bypassing the grammar, the defence-in-depth path of DEC-D8) is asserted to be clamped to the declared bound before interpolation; a raw-value mutant that emits `99999` must fail.

### 4.7 Id-Shape and SQL-Discipline Matrix (binding for AC-D13, NFR-D8)

| ID | Shape | Expected |
|----|-------|----------|
| I-01 | `ses_abc-123`, `ABC`, `a`, `0` | Accepted |
| I-02 | `"x'; DROP TABLE session; --"` | `db.query.failed`; zero deletes; raw value absent from every SQL and argv |
| I-03 | `x" OR "1"="1` | `db.query.failed`; zero deletes |
| I-04 | `x;y`, `x y`, newline in id, `x--y`, `x/*c*/y` | `db.query.failed`; zero deletes |
| I-05 | `sés`, `""` | `db.query.failed`; zero deletes |
| I-06 | 129-character id | `db.query.failed` naming the over-cap field; never truncated |
| I-07 | 1025-character database path | `db.query.failed` naming the over-cap field; never truncated |
| S-01 | Any adapter SQL | Exactly one statement; no `;`; no comment markers |
| S-02 | Any adapter SQL | No `DELETE`, `DROP`, `TRUNCATE`, `VACUUM`, `ALTER`, `CREATE` |
| S-03 | Prune delete path | No bulk `IN (`; one `deleteSession` per candidate |
| S-04 | Checkpoint SQL | Exactly `PRAGMA wal_checkpoint(TRUNCATE)` |
| S-05 | Prune selection SQL | Contains the cold predicate, the not-live predicate, the `NOT EXISTS` child (leaf) predicate, `ORDER BY ... time_updated`, and `LIMIT`; its cold/live boundary values equal `computeDbCutoffMs`/`computeDbLiveBoundaryMs` |
| S-06 | Reboot live-count SQL | Contains the 15-minute live-window comparison (or the injected `computeDbLiveBoundaryMs` value) |
| S-07 | `list` page aggregate SQL | Derives `dataBytes` with a byte-length expression — `LENGTH(CAST(<data column> AS BLOB))` or `OCTET_LENGTH(<data column>)` — over `message.data` and `part.data`; no bare character `LENGTH(<data column>)`; the statement names `message` and `part` and never `session_message` |
| S-08 | `list` page projection | Selects `time_created`, `time_updated` and `time_archived`; `createdAt`/`updatedAt` render from the first two and `archived` renders as `time_archived IS NOT NULL`; no `archived` column is selected |

### 4.8 Prohibited Test Dependencies (explicit)

- **No real opencode binary.** No suite spawns `opencode` or any process; the seam is a fake (TC-DB-036 asserts the absence by scan).
- **No real session database.** No suite opens, stats, copies or reads a SQLite file; no `node:sqlite`/`bun:sqlite`/`better-sqlite3` import exists anywhere in product code, tests or scripts (NG-D4, TC-DB-002).
- **No real home directory or ambient environment.** Fixtures use `/synthetic/harness/opencode/opencode.db`; environment and executable arrive as injected data. No test reads `$HOME`, `os.homedir()` or a real username.
- **No network.** No test resolves a host or opens a socket; the seam has no transport member and the new files import no HTTP client.
- **No wall clock for correctness.** Time is the injected `nowMs`; the only timing in the plan is the soft local budget and the optional non-CI reference measurement of TC-DB-037, neither of which affects a verdict. The mandatory real-store smoke is a read-only correctness check, not a latency assertion.
- **No moving-base diff.** Every assertion reads the current tree, a committed fixture or an isolated temp copy.
- **No real content in fixtures.** Committed fixtures contain synthetic ids, synthetic paths, counts, sizes, booleans and ISO timestamps only. The single canary constant is fabricated and exists only to prove the metadata-only boundary.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC |
|-------|-------|------|--------|----------|----|
| TC-DB-001 | Contract vocabulary, constants and data-only contracts | Regression | Critical | High | AC-D16, AC-D1 |
| TC-DB-002 | Tier, purity, runtime confinement, no SQLite, allowlist unchanged | Regression | Critical | High | AC-D16, NFR-D9 |
| TC-DB-003 | Four `db` error identities round-trip | Regression | Critical | High | AC-D15, NFR-D7 |
| TC-DB-004 | Bidirectional documented-table synchronization | Regression | Critical | High | AC-D15, NFR-D7 |
| TC-DB-005 | Kind-only `db` containment and wrong-code classification | Regression | Critical | High | AC-D15, NFR-D7 |
| TC-DB-006 | Size metadata from a fixture with zero mutations | Happy Path | Critical | High | AC-D1, DM-D1 |
| TC-DB-007 | Size on an empty store and with absent or zero-byte sidecars | Edge Case | Critical | High | AC-D1, NFR-D10 |
| TC-DB-008 | List page ordering, caps, totals, exact item shape, byte-exact `dataBytes` and pinned field sources | Happy Path | Critical | High | AC-D2, DM-D2 |
| TC-DB-009 | List live classification at the window boundary and the empty page | Edge Case | Critical | High | AC-D2 |
| TC-DB-010 | Port surfaces, fake conformance and the read-only store surface | Contract | Critical | High | AC-D14, AC-D16, NFR-D6 |
| TC-DB-011 | Prune dry-run performs zero mutations and repeats identically | Happy Path | Critical | High | AC-D3, NFR-D3 |
| TC-DB-012 | Cold boundary selection | Edge Case | Critical | High | AC-D4 |
| TC-DB-013 | Live window and leaf-only selection | Edge Case | Critical | High | AC-D4 |
| TC-DB-014 | Oldest-first ordering, id tiebreak and the cap | Edge Case | Critical | High | AC-D4 |
| TC-DB-015 | Apply deletes only through the official delete command | Happy Path | Critical | High | AC-D5 |
| TC-DB-016 | No database, WAL or SHM file is touched | Regression | Critical | High | AC-D5, AC-D11, NFR-D3 |
| TC-DB-017 | Idempotent re-run and post-apply dry-run | Regression | Critical | High | AC-D6, NFR-D3 |
| TC-DB-018 | TOCTOU: a candidate that gains a child is skipped | Negative | Critical | High | AC-D7 |
| TC-DB-019 | A row that vanishes before the re-read is skipped | Negative | Important | High | AC-D7, AC-D9 |
| TC-DB-020 | Partial failure is reported and a retry converges | Negative | Critical | High | AC-D8, NFR-D10 |
| TC-DB-021 | An already-absent row at delete is a skip | Edge Case | Critical | High | AC-D9, NFR-D10 |
| TC-DB-022 | Pre-land abort identities and post-land partial-abort truth | Negative | Critical | High | AC-D8, AC-D15 |
| TC-DB-023 | Grammar rejection matrix and last-wins before any I/O | Negative | Critical | High | AC-D12, NFR-D8 |
| TC-DB-024 | Parser containment carve-out at exit 1 | Negative | Critical | High | AC-D12 |
| TC-DB-025 | Numeric flag ranges and the defensive clamp | Negative | Critical | High | AC-D13, NFR-D8 |
| TC-DB-026 | Id shapes, injection attempts and over-cap identities | Negative | Critical | High | AC-D13, AC-D14, NFR-D8 |
| TC-DB-027 | Single-statement SQL discipline and no raw delete | Negative | Critical | High | AC-D13, AC-D5, NFR-D8 |
| TC-DB-028 | Envelope validity, schema version and machine/human caps | Regression | Critical | High | AC-D14, NFR-D2 |
| TC-DB-029 | Metadata-only whitelist, canary and mutation sensitivity | Regression | Critical | High | AC-D14, NFR-D6 |
| TC-DB-030 | Byte-identical replays and zero ambient reads | Regression | Critical | High | AC-D2, AC-D3, AC-D14, NFR-D1 |
| TC-DB-031 | Reboot dry-run plan and the live gate on apply | Happy Path | Critical | High | AC-D10, DM-D4 |
| TC-DB-032 | Reboot apply: exactly one bounded checkpoint | Happy Path | Critical | High | AC-D10, DM-D4 |
| TC-DB-033 | Reboot never kills a process or deletes a sidecar | Regression | Critical | High | AC-D11, NFR-D3, NFR-D10 |
| TC-DB-034 | Composition-absent `db` non-registration and present registration | Regression | Critical | High | AC-D16, NFR-D9 |
| TC-DB-035 | Scoped baseline repair for the defaults-position tests | Regression | Critical | High | AC-D17 |
| TC-DB-036 | Hermeticity and the no-real-home-path scan | Regression | Critical | High | AC-D17, NFR-D5, NFR-D1 |
| TC-DB-037 | Bounded-work oracle and the non-CI real-store evidence | Performance | Important | Medium | AC-D1, AC-D2, AC-D3, AC-D17, NFR-D4 |
| TC-DB-038 | The C-11 sign-off is a recorded owner merge gate | Contract | Critical | High | AC-D18 |

`TC-DB-*` is a new prefix with no prior use in the repository, so no existing TC identifier is reused for a different scenario.

### 5.2 Scenario Details

#### TC-DB-001 - Contract vocabulary, constants and data-only contracts

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D7, DM-D5, DM-D6, DM-D8, AC-D16, AC-D1
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/session-admin-contract.test.ts`
**Tags**: @backend

**Preconditions**:

- `packages/core/src/contracts/session.ts` exists and exports the vocabulary, the two ports and the constants.
- A TypeScript AST parser is available (the `tests/structure/status-contract.test.ts` pattern).

**Steps**:

1. Parse the contracts file and assert every top-level statement is a type alias, interface, `import type`, `export`, or an `as const` variable declaration; assert zero executable statements, zero function bodies, zero `new`, zero calls.
2. Assert the exact pinned constants: `DB_SCHEMA_VERSION = "delivery.session-admin.v1"`, live window `15`, defaults `30 / 20 / 50`, floors/ceilings `1 / 3650`, `1 / 100`, `1 / 500`, caps `128 / 32 / 1024 / 32 / 40 / 8192 / 524288`, id pattern `^[A-Za-z0-9_-]+$`, timeouts `30000 / 30000 / 120000`.
3. Assert the closed command set is exactly `["size", "list", "prune", "reboot"]` and the mode set is exactly `["dry-run", "applied"]`.
4. Assert `SessionStorePort` declares exactly `size` and `list`, and `SessionAdminPort` extends it with exactly `prune` and `reboot`; assert both are type-only.
5. Assert the data shapes carry the documented keys and that `SessionSummary.parentId` is optional (absent, never `undefined`).

**Expected Outcome**:

- Contracts are declaration-only with the exact constants, the closed command/mode sets and the read/admin port split.
- No behaviour, clock, randomness or environment enters the contracts tier.

**Notes / Clarifications**:

- Constant values are spec-fixed (§3.10) and may not be rebound; renaming is delivery-bound but must preserve the value and the exported name used by TC-DB-025 and TC-DB-037.

#### TC-DB-002 - Tier, purity, runtime confinement, no SQLite, allowlist unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D7, DM-D8, AC-D16, NFR-D9, NFR-D5
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/session-admin-imports.test.ts`, `tests/boundaries/**`, `scripts/checks/{ambient-globals,secret-read-boundary,workspace-entrypoints,exit-code-literals}.ts`
**Tags**: @backend

**Preconditions**:

- The new `contracts/session.ts`, `domain/session-admin.ts`, `adapters/src/session/index.ts`, `cli/src/commands/db.ts` and the edge changes.
- The boundary harness and fixture registry; the secret-read allowlist; the package manifests.

**Steps**:

1. Assert `contracts/session.ts` and `domain/session-admin.ts` import only `#contracts`/`./contracts` and own modules: no `node:*`, no `bun:*`, no adapters, no branding/config/CLI, no `process`, no `fetch`, no timers.
2. Assert zero runtime conditionals in contracts and domain (`process.platform`, `Bun`, `Deno`, `window`, `navigator`), with a synthetic control.
3. Assert `node:child_process` and `node:fs` appear only in `packages/adapters/src/session/index.ts` among the files this change introduces; assert the adapter reads no ambient environment (executable and environment are injected).
4. Scan the whole tree (product code, tests, scripts) for `node:sqlite`, `bun:sqlite`, `better-sqlite3`, `sqlite3`, `@libsql`; assert zero, with a seeded violation control.
5. Assert `SECRET_READ_ALLOWLIST.length === 4` and its entries are unchanged; assert the secret-read check is green and fail-closed.
6. Assert package manifests and export maps are unchanged in key set (no new package, subpath or dependency); run `workspace-entrypoints` and `exit-code-literals`.
7. Assert the boundary fixture-coverage meta-check passes unchanged and the new code introduces no rule without a failing fixture.

**Expected Outcome**:

- The contracts stay data-only, the domain stays pure, the single I/O location is the admitted adapter subpath, no SQLite driver exists anywhere, the allowlist stays at four, and nothing is added to the package graph.

**Notes / Clarifications**:

- Planted controls: a core file importing `node:fs`, a temp copy importing `bun:sqlite`, a synthetic fifth allowlist entry, and a seeded exit-code literal. Each must fail the suite.

#### TC-DB-003 - Four `db` error identities round-trip

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-D7, AC-D15, NFR-D7
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (update), `tests/behaviour/session-admin-prune.test.ts`, `session-admin-reboot.test.ts`
**Tags**: @backend

**Preconditions**:

- `DOMAIN_KINDS` including `db`; `ERROR_TABLE` with exactly four `db` rows; the trigger paths from TC-DB-020, TC-DB-022 and TC-DB-031.
- `classifyThrown`, `classifyDomainKind` and `resolveAppErrorCode`.

**Steps**:

1. Assert `DOMAIN_KINDS` contains `db` and exactly four rows have domain kind `db` with the exact code, category, retryability, consequence `not_landed`, projection class `platform-provider`, summary and remediation hint from the spec.
2. Drive each code through its trigger (`opencode` unavailable, malformed query, failed delete, live-session reboot) and assert the classified failure is exactly that entry.
3. Assert `classifyDomainKind("db", CODE)` and `classifyThrown({ kind: "db", code: CODE })` return the same entry for all four codes.
4. Assert each code round-trips through the envelope with matching fields and exit 2.
5. Assert no `db` grammar row was added and `input.value.rejected` remains the grammar identity.

**Expected Outcome**:

- 4/4 exact identities, all fields matching, each reachable through its trigger, and no redundant row.

**Notes / Clarifications**:

- Remediation hints are asserted against the table the change ships; a reviewed wording change is a table change, not silent drift.

#### TC-DB-004 - Bidirectional documented-table synchronization

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-D7, AC-D15, NFR-D7
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts` (update), `doc/spec/features/feature-result-contract.md`
**Tags**: @backend

**Preconditions**:

- The four `db` rows authored in the same change in both the machine table and `doc/spec/features/feature-result-contract.md`.
- The existing sync check and its temp-copy mutation harness.

**Steps**:

1. Run the sync check on the delivered tree and assert green with non-zero source, documented, recognized-reference and corpus counts.
2. Assert each of the four `db` codes appears exactly once in the documented table with matching category, retryability, consequence, projection class and summary.
3. Machine-direction mutations in a temp copy: remove one `db` row; remove `db` from `DOMAIN_KINDS`; each must fail naming the offender.
4. Documentation-direction mutations: remove a `db` row, add a doc-only `db` row, alter a documented field, duplicate a row; each must fail.
5. Assert a missing, empty or unparseable documented table fails closed rather than passing vacuously; run the unchanged control and assert it stays green.

**Expected Outcome**:

- 4/4 rows synchronize in both directions; every drift fails with a named offender; the unchanged control is green.

#### TC-DB-005 - Kind-only `db` containment and wrong-code classification

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-D7, AC-D15, NFR-D7
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/error-classification.test.ts` (update), `tests/structure/error-table.test.ts`
**Tags**: @backend

**Preconditions**:

- Four `db` rows; existing `config`, `state`, `lint` and `input` rows; a first-row-selecting control classifier.

**Steps**:

1. Assert `classifyDomainKind("db")` without a code throws (the kind is multi-row) and `classifyThrown({ kind: "db" })` returns `fallback.internal`, never the first `db` row.
2. Assert a wrong-kind pairing (`db` with `state.store.torn`), an unknown code (`db.nope`), a missing code, a non-string code and a mismatched code all contain through `fallback.internal`.
3. Assert exact-code lookup returns exactly that row for each of the four codes.
4. Assert existing kinds (`provider`, `input`, `config`, `state`, `lint`, `verify`) behave unchanged.
5. Run the first-row-selecting control and assert the suite catches it.

**Expected Outcome**:

- Kind-only `db` is ambiguous and contained; bad codes contain via `fallback.internal`; exact codes resolve; no existing kind regresses.

#### TC-DB-006 - Size metadata from a fixture with zero mutations

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D1, DM-D1, AC-D1, NFR-D2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-size-list.test.ts`, `tests/fixtures/session-admin/{harness,store}.ts`
**Tags**: @backend

**Preconditions**:

- A synthetic store with 12 sessions (one live), 40 `message` rows, 90 `part` rows; `databasePath()` returns `/synthetic/harness/opencode/opencode.db`; `stat` returns distinct database/WAL/SHM byte counts with mixed presence.
- An injected clock; the IO fake records `databasePath`, `query`, `stat`, `deleteSession`, `checkpoint`.

**Steps**:

1. Run `db size --json` through the composed program.
2. Assert `data.schemaVersion` is `delivery.session-admin.v1`, `data.command` is `size`, and the key set is exactly the DM-D1 shape.
3. Assert the path equals the injected `databasePath()` result; assert `dbBytes`, `walBytes`, `shmBytes` and both presence flags come from `stat` (never a literal).
4. Assert `sessions 12`, `messages 40`, `parts 90`, and that `oldestSessionUpdatedAt`/`newestSessionUpdatedAt` are ISO-8601 UTC strings equal to the fixture's min/max.
5. Assert the recorded message-count SQL names `message` and the part-count SQL names `part`; assert the fixture also carries non-zero legacy `session_message` rows that are **not** counted (the assertion is on the recorded SQL table names, not on a semantic fake result).
6. Assert the call log contains zero `deleteSession` and zero `checkpoint`, and that no `stat` path is outside the three database paths.

**Expected Outcome**:

- Every size field is asserted from the fixture; timestamps are ISO strings; the path is runtime-resolved; zero mutations.

**Notes / Clarifications**:

- The message-count SQL must name `message` and the part-count SQL must name `part` (current stores on the reference opencode 1.19.3 schema); a fixture that also contains legacy `session_message` rows asserts they are not counted (RSK-D13). Asserting the recorded SQL table names is what keeps the check non-vacuous, because the fake does not interpret SQL.

#### TC-DB-007 - Size on an empty store and with absent or zero-byte sidecars

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D1, DM-D1, AC-D1, NFR-D10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-size-list.test.ts`, `tests/fixtures/session-admin/{store,boundaries}.ts`
**Tags**: @backend

**Preconditions**:

- An empty-store fixture (zero sessions/messages/parts).
- A fixture with `walPresent: false, walBytes: 0` and `shmPresent: false, shmBytes: 0`.
- A fixture where the WAL file exists with `bytes: 0` (`present: true`).

**Steps**:

1. Run `db size` on the empty store; assert both timestamps are `null` (not `""`, not the epoch) and all counts are `0`.
2. Run `db size` with absent sidecars; assert `walBytes 0` + `walPresent false` and `shmBytes 0` + `shmPresent false`.
3. Run `db size` with a real zero-byte WAL; assert `walBytes 0` + `walPresent true`.
4. Assert the human output renders `absent` for the absent case and `present` for the zero-byte case.

**Expected Outcome**:

- An empty store yields explicit `null` timestamps; absence is never confused with a real zero-byte file; the three cases are distinguishable in data and human text.

#### TC-DB-008 - List page ordering, caps, totals, exact item shape, byte-exact `dataBytes` and pinned field sources

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D2, DM-D2, AC-D2, NFR-D2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-size-list.test.ts`, `tests/fixtures/session-admin/store.ts`
**Tags**: @backend

**Preconditions**:

- A store with 25 sessions whose `updatedAt` values are distinct except one deliberate tie broken by `id`.
- A 100-session fixture and a request for 101.
- A byte-length row (`ses_bytes`) scripted as `messageCount 2`, `partCount 1`, `dataBytes 11`: two message payloads of 2 and 3 UTF-8 bytes and one part payload of 6 UTF-8 bytes, whose character length is 6 — so a character count would under-report.
- A session with no `message` or `part` rows at all.
- One session with `time_archived` set and one with it null; every session has distinct `time_created`/`time_updated` values.
- The IO fake returns the page rows in scrambled order to prove the adapter sorts.

**Steps**:

1. Run `db list` with no flag; assert 20 items, `limit 20`, `total 25`, `omitted 5`, `truncated true`.
2. Run `db list --limit 100`; assert 25 items, `omitted 0`, `truncated false`.
3. Run `db list --limit 100` on the 100-session fixture; assert exactly 100 items.
4. Assert the order is `updatedAt` descending then `id` ascending, including the tie.
5. Assert every item's key set is exactly `{id, parentId?, createdAt, updatedAt, messageCount, partCount, dataBytes, archived, live}` and that `parentId` is absent (not `undefined`, not `null`) for a root session.
6. Assert `ses_bytes` reports `messageCount 2`, `partCount 1` and `dataBytes 11` exactly; assert that a character count of the same rows would be `6`, so the byte semantics are observable.
7. Assert the session with no `message` or `part` rows reports `dataBytes 0` (never `null`, absent or `undefined`).
8. Assert the recorded page SQL derives `dataBytes` with a byte-length expression (`LENGTH(CAST(... AS BLOB))` or `OCTET_LENGTH(...)`) over `message` and `part`, contains no bare character `LENGTH(<data column>)`, and names `message` and `part` and never `session_message` (S-07).
9. Assert the session whose `time_archived` is non-null reports `archived true` and the session whose `time_archived` is null reports `archived false`; assert `createdAt`/`updatedAt` equal the ISO-8601 renderings of the fixture's `time_created`/`time_updated`, and that the page SQL selects `time_created`, `time_updated` and `time_archived` (there is no `archived` column).
10. Assert the page SQL carries a `LIMIT` and that exactly two queries are issued (total count + one page).

**Expected Outcome**:

- The page is bounded and deterministic, totals/omitted/truncated are exact, the tie is broken by `id`, and the item shape is closed.
- `dataBytes` is the exact summed UTF-8 **byte** length over the current `message` and `part` stores, `0` when the session has no messages or parts; a character-length implementation under-reports and fails step 6.
- `createdAt`/`updatedAt` come from `session.time_created`/`time_updated` and `archived` is `session.time_archived IS NOT NULL`; no `archived` column is selected.

**Notes / Clarifications**:

- `dataBytes` is the summed stored payload **byte** length — `COALESCE(SUM(LENGTH(CAST(message.data AS BLOB))),0) + COALESCE(SUM(LENGTH(CAST(part.data AS BLOB))),0)`, equivalently with `OCTET_LENGTH` — over the current `message` and `part` stores; the legacy `session_message` store is never summed. It is asserted as an exact length, never as content.
- The multi-byte fixture makes the byte/character distinction non-vacuous: a `LENGTH(text)` implementation returns `6` where the byte oracle requires `11`. A mutant adding `title` to the item must fail step 5.

#### TC-DB-009 - List live classification at the window boundary and the empty page

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D2, DM-D2, AC-D2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-size-list.test.ts`, `tests/fixtures/session-admin/boundaries.ts`
**Tags**: @backend

**Preconditions**:

- Boundary rows B-05, B-06 and B-07 (§4.4) plus an empty store.
- The injected clock fixed at `NOW_MS`.

**Steps**:

1. Run `db list --limit 100` and assert `live` is `true` for exactly the rows at `LIVE_BOUNDARY` and newer (B-05, B-06) and `false` for B-07 and older.
2. Run again with a shifted injected clock and assert the classification shifts without changing the store facts.
3. Run on the empty store; assert `total 0`, `items []`, `omitted 0`, `truncated false`, and that no `live` value is fabricated.
4. Assert the item count and the human "live in page" count agree with the data.

**Expected Outcome**:

- The live boundary is inclusive at exactly 15 minutes; classification follows the injected clock; the empty page is explicit.

**Notes / Clarifications**:

- The shifted-clock replay is what makes the injected-clock claim non-vacuous: a host-clock implementation fails step 2.

#### TC-DB-010 - Port surfaces, fake conformance and the read-only store surface

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D7, DM-D8, DM-D2, AC-D14, AC-D16, NFR-D6
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-privacy.test.ts`, `tests/fixtures/session-admin/harness.ts`
**Tags**: @backend

**Preconditions**:

- The two core port interfaces and the adapter-local `OpencodeSessionIo` seam.
- The harness fake implementing both ports over the same fake IO.

**Steps**:

1. Assert `SessionStorePort` has no `prune` or `reboot` member and that `SessionAdminPort` extends it; assert a `SessionStorePort`-typed value exposes only `size`/`list` at runtime.
2. Assert the fake satisfies both ports structurally (compile-time plus a runtime method-presence check) and returns the documented read shapes.
3. Assert `OpencodeSessionIo` is exported from `@delivery-os/adapters/session` only, is absent from `@delivery-os/core/contracts`, and that core does not import the adapter.
4. Assert the seam declares exactly the documented members and no destructive or process member.
5. Assert the same fake drives a `size` and a `list` call and returns the same values through both the read port and the admin port (no divergent read path).

**Expected Outcome**:

- The read port stays read-only, the admin port owns mutation, and the seam is adapter-local, injectable and destructively inert.

**Notes / Clarifications**:

- Adding a mutation member to `SessionStorePort` in a temp copy must fail step 1. This is the concrete proof of DEC-D4.

#### TC-DB-011 - Prune dry-run performs zero mutations and repeats identically

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, DM-D3, AC-D3, NFR-D1, NFR-D3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`, `tests/fixtures/session-admin/{harness,boundaries}.ts`
**Tags**: @backend

**Preconditions**:

- Five cold leaf sessions; a fixed clock; the IO fake records every call.
- A snapshot of the fake store and of the recorded stat paths before the run.

**Steps**:

1. Run `db prune` with no `--apply`.
2. Assert `mode "dry-run"`, `olderThanDays 30`, `limit 50`, `liveWindowMinutes 15`, the ISO `cutoff`, `counts { selected: 5, deleted: 0, failed: 0, skipped: 0, liveExcluded: 0 }`, and 5 candidate summaries.
3. Assert the recorded selection `query` text carries the cold predicate, the not-live predicate, the `NOT EXISTS` child (leaf) predicate, an `ORDER BY` naming `time_updated`, and a `LIMIT`; assert the cold/live boundary values in that SQL equal `computeDbCutoffMs(NOW_MS, 30)` and `computeDbLiveBoundaryMs(NOW_MS)`.
4. Assert the call log contains zero `deleteSession`, zero `checkpoint`, and zero write-shaped stat operations; assert the fake store is unchanged.
5. Run the identical invocation again and assert the serialized data and the human text are byte-identical to the first run.
6. Run a temp mutant that calls `deleteSession` in dry-run and assert the suite fails.
7. Run a temp mutant whose selection SQL drops the not-live predicate and assert the suite fails step 3.

**Expected Outcome**:

- Dry-run reports the plan and mutates nothing; the selection SQL pins all five predicates; two runs are byte-identical; the deleting and dropped-predicate mutants are caught.

#### TC-DB-012 - Cold boundary selection

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, DM-D3, AC-D4
**Test Type(s)**: Integration, Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`, `tests/fixtures/session-admin/boundaries.ts`
**Tags**: @backend

**Preconditions**:

- Boundary rows B-01..B-04 (§4.4) as four leaves in one fixture.
- `NOW_MS` fixed; `--older-than 30` and `--older-than 1` runs.

**Steps**:

1. Run `db prune --older-than 30`; assert the selected ids are exactly B-02 plus any older row, and that B-01 and B-03 are absent.
2. Run `db prune --older-than 1`; assert B-04 (24 h + 1 ms) is selected and a row exactly 24 h old is not.
3. Assert the reported `cutoff` equals `NOW_MS − days × 86_400_000` as an ISO string for both thresholds, and that the recorded selection SQL carries the same value produced by `computeDbCutoffMs(NOW_MS, days)` (the SQL cold comparison changes when `--older-than` changes).
4. Assert every non-selected row is still present in the fake store with unchanged bytes.

**Expected Outcome**:

- The cold comparison is strict: the boundary itself is not cold and the neighbouring millisecond is; the cutoff is computed once from the injected clock via `computeDbCutoffMs` and both reported and carried in the selection SQL.

**Notes / Clarifications**:

- A mutant using `<=` includes B-01 and must fail step 1. Both sides are asserted in the same run, so the exclusion cannot pass because the fixture lacked the boundary row.

#### TC-DB-013 - Live window and leaf-only selection

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, DM-D3, AC-D4, NFR-D3
**Test Type(s)**: Integration, Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`, `session-admin-size-list.test.ts`, `tests/fixtures/session-admin/boundaries.ts`
**Tags**: @backend

**Preconditions**:

- Boundary rows B-05..B-12 (§4.4): live rows at 5/15 min, a 15 min − 1 ms row, a 15 min + 1 ms row, a 16-minute row, a cold leaf, a cold parent with a cold child, and a cold parent with a live child.
- The pure candidate predicate exported by `core/domain`.

**Steps**:

1. Run `db list --limit 100` and assert the `live` flags for B-05, B-06 and B-07 exactly.
2. Run `db prune --older-than 30`; assert the selected ids are exactly the cold leaf and the cold child whose own children set is empty; assert the two parents are absent.
3. Assert the 16-minute row (B-08) is not selected and is not counted as `liveExcluded` (it is cold-excluded, not live-excluded).
4. Call the pure candidate predicate directly with a fact set that is live *and* cold (B-09) and assert it returns not-candidate with reason `live`; assert the result assembly counts it in `liveExcluded` exactly once.
5. Assert the recorded selection SQL carries the not-live predicate with the value returned by `computeDbLiveBoundaryMs(NOW_MS)` and the `NOT EXISTS` child (leaf) predicate; assert the adapter imports both `computeDbCutoffMs` and `computeDbLiveBoundaryMs` from the pure domain (or that the SQL carries those computed boundaries).
6. Assert the leaf predicate is the same function used by the pre-delete re-check: a source-level assertion that the adapter imports the shared predicate and contains no duplicate inline `parent_id` comparison.

**Expected Outcome**:

- The live boundary is inclusive; a leaf is eligible; a parent is never eligible even when its child is live; the defensive live condition is exercised at the policy level; a single predicate decides selection and the re-check; the selection SQL pins the computed live boundary and the leaf predicate.

**Notes / Clarifications**:

- `liveExcluded` cannot be produced through the CLI because the 1-day floor makes "cold and live" unreachable (spec §3.4 states this explicitly). Step 4 is the deliberate policy-level probe that keeps the counter non-vacuous; it is not a reinterpretation of the CLI behaviour.

#### TC-DB-014 - Oldest-first ordering, id tiebreak and the cap

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, DM-D3, AC-D4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`, `tests/fixtures/session-admin/store.ts`
**Tags**: @backend

**Preconditions**:

- Five cold leaves with `updatedAt` t1 < t2 = t3 < t4 < t5, and ids on the tie chosen so ascending order is `a` then `b`.
- The fake returns the selection rows in scrambled order.

**Steps**:

1. Run `db prune --limit 50`; assert the candidate order is `t1`, `(t2, a)`, `(t2, b)`, `t4`, `t5`.
2. Run `db prune --limit 2`; assert exactly the first two candidates, `counts.selected 2`, and that the remaining three are untouched.
3. Run `db prune --limit 5`; assert all five are selected (the cap exceeds the population).
4. Assert the ordering is produced by the adapter/policy, not inherited from the fake's response order, and that the recorded selection SQL carries `ORDER BY ... time_updated` and `LIMIT 2` for the capped run.

**Expected Outcome**:

- Deterministic oldest-first ordering with an `id` tiebreak; the cap truncates the selection and never the ordering; the ordering and cap are carried in the selection SQL, not just in the policy sort.

#### TC-DB-015 - Apply deletes only through the official delete command

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, AC-D5, NFR-D8, NFR-D9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`, `tests/behaviour/session-admin-sql-safety.test.ts`
**Tags**: @backend

**Preconditions**:

- Three cold leaves; the IO fake records `deleteSession(id)` and every `query(sql)`.
- The fake store removes a row, and cascades its dependent `message`/`part`/`session_message` rows, only when its `deleteSession` is called.

**Steps**:

1. Run `db prune --apply`.
2. Assert exactly three `deleteSession` calls, one per selected id, in selection order, with no repeated id.
3. Assert no recorded query text contains `DELETE`, `DROP` or `TRUNCATE`, and that `mode` is `applied` with `counts.deleted 3`.
4. Assert the three session rows are gone from the store, together with their dependent rows as cascaded by the harness on delete, and that no unrelated session row or file-state observable changed.
5. Run a temp mutant that issues a bulk SQL delete and never calls `deleteSession`; assert the suite fails.

**Expected Outcome**:

- One official delete per candidate, zero raw SQL deletes, and a truthful applied count.

**Notes / Clarifications**:

- The cascade of the deleted session's `message`, `part` and legacy `session_message` rows happens inside opencode's own `session delete` implementation, never in `prune`: the fake removes the row and its dependent rows only when `deleteSession(id)` is called, and no recorded query carries a `DELETE` (step 3). Legacy `session_message` rows are never counted or summed by `size`/`list` (TC-DB-006, TC-DB-008); only the official delete path removes them.

#### TC-DB-016 - No database, WAL or SHM file is touched

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, F-D4, AC-D5, AC-D11, NFR-D3
**Test Type(s)**: Static, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`, `session-admin-reboot.test.ts`, `tests/structure/session-admin-imports.test.ts`
**Tags**: @backend

**Preconditions**:

- The recorded `stat` calls from prune dry-run, prune apply, reboot dry-run and reboot apply.
- An AST scan of `packages/adapters/src/session/index.ts` against a destructive-API denylist: `unlink`, `unlinkSync`, `rm`, `rmSync`, `rmdir`, `truncate`, `truncateSync`, `writeFile`, `writeFileSync`, `rename`, `renameSync`, `ftruncate`, `copyFile`, `appendFile`.

**Steps**:

1. Run all four invocations and assert every recorded `stat` path is one of `<dbPath>`, `<dbPath>-wal`, `<dbPath>-shm` and no other path appears.
2. Assert the seam declares no file-deletion or file-write member.
3. AST-scan the adapter for every destructive API and assert zero, with a seeded control that plants `unlinkSync` in a temp copy of the adapter and must fail.
4. Assert no recorded operation is write-shaped and that the reported presence/bytes come from the read-only `stat` results.

**Expected Outcome**:

- The only file interaction is a bounded read-only `stat` of the database and its two sidecars; no destructive file API exists in the adapter; the planted control is caught.

#### TC-DB-017 - Idempotent re-run and post-apply dry-run

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, DM-D3, AC-D6, NFR-D3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`
**Tags**: @backend

**Preconditions**:

- Three cold leaves in a fake store that removes a row on a successful `deleteSession`.

**Steps**:

1. Run `db prune --apply`; assert `deleted 3` and an empty candidate set afterwards.
2. Run the identical apply again; assert `selected 0`, `deleted 0`, `failed 0`, zero `deleteSession` calls, and a success envelope.
3. Run `db prune` (dry-run) again; assert `selected 0` and `mode dry-run`.
4. Run the apply a third time and assert the second and third apply payloads are byte-identical.
5. Run a mutant that keeps deleted rows in the selection and assert the suite fails.

**Expected Outcome**:

- A re-run selects nothing and mutates nothing; the post-apply dry-run is zero; repeated runs are stable.

#### TC-DB-018 - TOCTOU: a candidate that gains a child is skipped

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, AC-D7, NFR-D3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`, `tests/fixtures/session-admin/harness.ts`
**Tags**: @backend

**Preconditions**:

- Candidates X and Y selected as cold leaves; a hook marks X as having a child between the selection query and X's re-read.
- The IO fake answers the re-read for X with `hasChildren: true` and for Y with `hasChildren: false`.

**Steps**:

1. Run `db prune --apply`.
2. Assert zero `deleteSession("X")` calls and exactly one `deleteSession("Y")`.
3. Assert `counts.skipped >= 1`, that X is not in `deleted`, and that the skip reason names the leaf condition.
4. Assert the run does not return `db.delete.failed`.
5. Assert the re-read SQL text carries a `time_updated` comparison against the cutoff, a `time_updated` comparison against the live boundary, and a child-existence clause.
6. Run a temp mutant whose re-read checks only child existence and assert the suite fails step 5.

**Expected Outcome**:

- A gained child is skipped, counted, and never deleted; unaffected candidates proceed; the re-read re-asserts cold and live and uses the same predicate as selection.

**Notes / Clarifications**:

- Step 5 asserts the SQL the adapter actually issues; it is deliberately textual because the AC requires the re-check predicates to be present, and a purely behavioural assertion could pass with a weaker query.

#### TC-DB-019 - A row that vanishes before the re-read is skipped

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-D3, AC-D7, AC-D9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`
**Tags**: @backend

**Preconditions**:

- Candidate X selected; a hook removes X from the fake store before its re-read; candidate Y remains.

**Steps**:

1. Run `db prune --apply`.
2. Assert the re-read for X returns zero rows, zero `deleteSession("X")` calls, `counts.skipped >= 1`, and that the run continues to delete Y.
3. Assert the envelope is success and `deleted` counts only Y.
4. Run a mutant that deletes from the selection row when the re-read is empty and assert the suite fails.

**Expected Outcome**:

- A vanished row is a skip, not a failure or a delete; the run continues.

#### TC-DB-020 - Partial failure is reported and a retry converges

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, DM-D3, DM-D7, AC-D8, NFR-D10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`, `tests/behaviour/session-admin-output.test.ts`
**Tags**: @backend

**Preconditions**:

- Three eligible candidates X, Y, Z; the fake fails the delete for Y and succeeds for X and Z.
- The documented partial-failure summary format from §3.4.

**Steps**:

1. Run `db prune --apply`.
2. Assert the result is a failure envelope (no `data`) with `code db.delete.failed`, `category transient`, `retryable true`, `consequence not_landed`, `projectionClass platform-provider`, and exit 2.
3. Assert the summary matches the normative format `^1 of 3 session deletes did not land \(first: Y\); 2 landed$` (`attempted = landed + failed = 3`) and contains no title, prompt, body or path.
4. Assert the store retains Y and no longer contains X or Z; assert X and Z are not reported as failures.
5. Run the identical apply again; assert it selects only Y, deletes it once, returns success with `deleted 1`, and leaves zero candidates.
6. Run a success-on-partial mutant and a summary-without-id mutant; assert both fail.

**Expected Outcome**:

- A partial prune is never success; the summary is bounded and names the failed count, attempted count, first id and landed count; successful deletes are not failures; the retry converges.

#### TC-DB-021 - An already-absent row at delete is a skip

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, DM-D3, AC-D9, NFR-D10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`
**Tags**: @backend

**Preconditions**:

- Candidate X: the pre-delete re-read returns the row, then the row disappears from the fake store and `deleteSession("X")` rejects (the only channel the declared seam offers).
- Candidate Y remains present and deletable.

**Steps**:

1. Run `db prune --apply`.
2. Assert `counts.skipped >= 1`, zero `db.delete.failed`, no failure envelope, and that Y is still deleted.
3. Assert the summary/counts never claim X was deleted.
4. Assert a present sibling row is deleted in the same run, so the skip did not abort the run.

**Expected Outcome**:

- An absent row at delete is absorbed as a skip; the run continues; no failure is fabricated for a row that no longer exists.

**Notes / Clarifications**:

- The plan does not add a seam member: absence is observed from the store state after the failed delete (a post-delete read of the same row), which is derivable from AC-D9 without changing `OpencodeSessionIo`. If delivery instead reports absence explicitly, the test binds to the observable, not the representation (OQ-T2, A-T5).

#### TC-DB-022 - Pre-land abort identities and post-land partial-abort truth

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, DM-D7, AC-D8, AC-D15, NFR-D10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-prune.test.ts`, `tests/fixtures/session-admin/malformed.ts`
**Tags**: @backend

**Preconditions**:

- Pre-land scenarios: `databasePath()` rejects; `query` returns malformed JSON; `query` returns a non-array; `query` returns a non-zero outcome — all before any delete has landed.
- Post-land scenario: candidates X, Y, Z selected; X's delete lands; the pre-delete re-read for Y then fails; Z is never reached. Post-land variants also cover a post-delete existence-read failure and an availability/`databasePath` failure after X landed; each must return the same `db.delete.failed` identity and partial-abort summary (the aborting candidate counts in `failed`, the not-attempted candidate does not).

**Steps**:

1. Run `db prune --apply` for each pre-land failure; assert `db.opencode.unavailable` for the path/unavailable class and `db.query.failed` for the malformed-result class, both exit 2, with zero `deleteSession` calls.
2. Run each post-land abort variant; assert `db.delete.failed` (not `db.query.failed` or `db.opencode.unavailable`), `category transient`, `retryable true`, `consequence not_landed`, `projectionClass platform-provider`, exit 2, and zero deletes for the remaining candidates (the run stops; Z is not attempted).
3. Assert the post-land summary matches the normative format `^1 of 2 session deletes did not land \(first: Y\); 1 landed$`: `landed = 1` (X), `failed = 1` (the aborting candidate Y), `attempted = landed + failed = 2`, first identity `Y`.
4. Assert a malformed body is never treated as an empty result, and that no success envelope is produced in any class.
5. Run a mutant that maps a query failure to an empty row set; assert the suite fails because the fixture has candidates and the mutant returns success with zero.
6. Run a post-land mutant that reports `db.query.failed` (or omits the landed count) and assert the suite fails steps 2–3.

**Expected Outcome**:

- Unavailable and query failures **before any delete lands** abort with `db.opencode.unavailable`/`db.query.failed` at exit 2 and zero deletes; any aborting failure **after at least one delete lands** returns `db.delete.failed` with the normative partial-abort summary carrying landed/failed counts and the first identity; selection validity is never assumed; malformed is never empty; the run is never reported as success.

**Notes / Clarifications**:

- Bound to AC-D8 (a run that cannot guarantee selection validity must not report success, and a post-land abort must preserve per-row truth) and AC-D15 (the exact `db.*` identity). See GAP-T5. TC-DB-020 remains the per-candidate partial-delete case; this TC adds the abort-after-landed-delete case.

#### TC-DB-023 - Grammar rejection matrix and last-wins before any I/O

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D5, DM-D7, AC-D12, NFR-D8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-grammar.test.ts`
**Tags**: @backend

**Preconditions**:

- The runtime-level fake `DbCommandRuntime` recording every subcommand call.
- The rejection matrix G-01..G-05, G-07..G-11, G-13 (§4.5), plus the `--json` acceptance case G-06 and the repeated-flag last-wins case G-12.

**Steps**:

1. For each of G-01..G-05, G-07..G-11 and G-13, run the invocation in both human and `--json` modes.
2. Assert exactly `input.value.rejected`, `category user`, `retryable false`, `consequence not_landed`, `projectionClass user-validation`, exit 1, and no `data` key.
3. Assert the runtime fake recorded zero calls (no read, no mutation, no path resolution).
4. Assert G-06 (`prune --json`) succeeds and that the handler's `argv` excludes `--json`, proving `--json` is not a grammar token.
5. Assert G-12: `prune --apply --apply` is accepted as apply and `prune --limit 5 --limit 10` runs with effective `limit 10` at exit 0 (the parser applies the last value; no `db` conflict pair exists).
6. Assert a valid sibling invocation in the same suite succeeds and calls the runtime, so the zero-call assertion is not vacuous.

**Expected Outcome**:

- Every handler-level rejection is `input.value.rejected` at exit 1 with zero I/O; `--json` is rendering-only; repeated same-flag occurrences are accepted last-wins, not rejected.

#### TC-DB-024 - Parser containment carve-out at exit 1

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D5, AC-D12
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-grammar.test.ts`
**Tags**: @backend

**Preconditions**:

- The tokens P-01..P-04: `--bogus`, `--limit=5`, `--apply=false`, `--x`.
- A valid flag with the same prefix (`--limit 5`) as the live control.

**Steps**:

1. Run each containment token; assert exactly `fallback.invocation`, `category user`, exit 1, and no `data`.
2. Assert the runtime fake recorded zero calls.
3. Run the valid `--limit 5` control and assert success with a non-zero runtime call count.
4. Assert the diagnostic names the offending token without echoing any value beyond the token itself.

**Expected Outcome**:

- Undeclared `--`-prefixed tokens are contained by the parser as `fallback.invocation`; a single-dash token such as `-x` is an unexpected positional rejected by the handler as `input.value.rejected` (TC-DB-023, G-13); both classes exit 1; the control proves the split is token-shape driven.

#### TC-DB-025 - Numeric flag ranges and the defensive clamp

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D5, DM-D6, AC-D13, NFR-D8
**Test Type(s)**: Integration, Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-grammar.test.ts`, `tests/behaviour/session-admin-sql-safety.test.ts`
**Tags**: @backend

**Preconditions**:

- The range matrix of §4.6 for all three numeric flags.
- The pure selection/assembly function accepting an injected numeric independent of the grammar.

**Steps**:

1. For each flag, run min − 1, min, max, max + 1, the empty string, a decimal and a non-numeric string; assert rejection with `input.value.rejected` and exit 1 for every non-integer or out-of-range value.
2. Assert each accepted value reaches the runtime/IO seam exactly as parsed (no silent clamping) and that the reported `limit`/`olderThanDays` equals it.
3. Call the pure selection/assembly directly with a value beyond the maximum; assert the emitted query bound and the reported value are clamped to the declared maximum and never interpolated raw.
4. Run the raw-value mutant (`99999` interpolated) and assert the suite fails.

**Expected Outcome**:

- Out-of-range user values are rejected, never clamped; in-range values pass through exactly; the internal clamp is a defence-in-depth invariant that never hides a user error.

#### TC-DB-026 - Id shapes, injection attempts and over-cap identities

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D5, DM-D6, AC-D13, AC-D14, NFR-D8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-sql-safety.test.ts`, `tests/fixtures/session-admin/ids.ts`
**Tags**: @backend

**Preconditions**:

- The id-shape matrix I-01..I-07 (§4.7) as database rows returned by the fake, plus a 1025-character path.
- The id pattern and the two caps (`DB_MAX_ID_CHARS`, `DB_MAX_PATH_CHARS`).

**Steps**:

1. Run `db list` and `db prune --apply` on a store whose rows include I-02..I-06; assert each invalid id aborts with `db.query.failed`, exit 2, naming the offending field, and that zero `deleteSession` calls occur.
2. Assert every recorded SQL string and every `deleteSession` argument matches `^[A-Za-z0-9_-]+$`, and that no invalid raw id appears in any SQL or argv.
3. Assert I-01 rows proceed normally (the valid control).
4. Run `db size` with a 1025-character path; assert `db.query.failed` naming the path and that the output is never truncated to fit.
5. Run the interpolating mutant and assert the recorded SQL contains `';` and the suite fails.

**Expected Outcome**:

- No id outside the shape is interpolated or passed to delete; an unaddressable row is a classified query/selection failure with no partial delete; over-cap identity fails rather than truncates.

#### TC-DB-027 - Single-statement SQL discipline and no raw delete

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D3, F-D5, AC-D13, AC-D5, NFR-D8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-sql-safety.test.ts`
**Tags**: @backend

**Preconditions**:

- The complete call log from a `size`, a `list`, a prune dry-run and a prune apply run.

**Steps**:

1. Assert every recorded `query` text is a single statement: no `;`, no `--` comment marker, no `/*`.
2. Assert no recorded text contains `DELETE`, `DROP`, `TRUNCATE`, `VACUUM`, `ALTER` or `CREATE` (case-insensitive, word-boundary).
3. Assert no recorded text contains a bulk `IN (` list and that the delete path is per-candidate `deleteSession`.
4. Assert the checkpoint text is exactly `PRAGMA wal_checkpoint(TRUNCATE)`.
5. Run a mutant that issues `DELETE FROM session` and assert the suite fails.

**Expected Outcome**:

- Every read is one bounded statement; the delete path never issues SQL; the single checkpoint is the exact bounded statement.

#### TC-DB-028 - Envelope validity, schema version and machine/human caps

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D6, DM-D1..DM-D5, AC-D14, NFR-D2
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-output.test.ts`, `tests/fixtures/session-admin/golden/**`
**Tags**: @backend @golden

**Preconditions**:

- Success invocations for all four subcommands and failure invocations for every row of the exit-code oracle (§4.3).
- A max-fixture: 100 list items at the per-field caps (128-char ids, 1024-char path, 32-char timestamps); a 50-candidate prune.
- `assertEnvelopeContract` from the testkit; committed normalized goldens.

**Steps**:

1. For every success and failure class, run `--json` and assert stdout contains exactly one JSON document, `assertEnvelopeContract` returns `[]`, success has `data` and no `error`, failure has `error` and no `data`.
2. Assert `data.schemaVersion === "delivery.session-admin.v1"` and `data.command` is the invoked subcommand for all four successes.
3. Assert machine `data` serialized bytes ≤ 524288 on the max-fixture.
4. Assert human mode writes no envelope to stdout, writes the rendered report to stdout and diagnostics to stderr, and returns the same exit code.
5. Assert human caps on the 100-item list: at most 32 item lines, at most 40 lines, at most 8192 bytes, a `+N more` marker, and `rendered item lines + N = total`.
6. Assert the same caps on the 50-candidate prune (`rendered + N = candidates.length`).
7. Assert each golden matches byte-for-byte after normalization (no absolute paths, no host timestamps, ordering fixed).
8. Run an over-cap renderer mutant (40 item lines) and an 8193-byte mutant; assert both fail.

**Expected Outcome**:

- Exactly one valid envelope per run, the declared schema version, machine and human caps enforced at and above their thresholds, and truthful `+N more` truncation.

**Notes / Clarifications**:

- `+N more` is pinned to "items the reader did not see" (`rendered + N = total`, or `rendered + N = candidates.length` for prune), because a literal reading of the data's `omitted` would under-count the unrendered page remainder and violate NFR-D10 truthfulness. Recorded as OQ-T3 for the spec owner; non-blocking.

#### TC-DB-029 - Metadata-only whitelist, canary and mutation sensitivity

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D6, AC-D14, NFR-D6
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-privacy.test.ts`, `tests/fixtures/session-admin/{canary,harness}.ts`
**Tags**: @backend

**Preconditions**:

- A fabricated canary constant (for example `CANARY-SESSION-ADMIN-7f3a`) and a fabricated environment value.
- The IO fake's raw responses carry forbidden-shaped columns populated with the canary: `title`, `prompt`, `messageBody`, `partData`, `credential`, `envValue`, `commandArgument`, plus `parent_title`.
- A committed fixture scan over `tests/fixtures/session-admin/**`.

**Steps**:

1. Assert the canary is present in the fake's raw response before the run (presence control).
2. Run every success and failure class; walk stdout, stderr, the parsed envelope (all keys and string values, recursively), the human text and the failure objects; assert zero canary occurrences.
3. Assert the exact key set of each item and each payload; assert zero extra item or evidence fields.
4. Assert no forbidden field name appears as a key in any committed fixture under `tests/fixtures/session-admin/**`, and that fixture values are synthetic ids, counts, sizes, booleans and ISO timestamps only.
5. Assert the injected environment value never appears in any output.
6. Run a wide-projection mutant (spreads the raw row) and an extra-field mutant; assert both expose the canary or the extra key and fail the suite.

**Expected Outcome**:

- Zero canary occurrences across every channel; a closed field whitelist; committed fixtures contain no forbidden content; the two mutants prove the assertions are live.

#### TC-DB-030 - Byte-identical replays and zero ambient reads

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D1..F-D6, AC-D2, AC-D3, AC-D14, NFR-D1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-output.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- Fixed `NOW_MS`, a fixed `newRunId` sequence and `SYNTHETIC_BRAND`.
- Throwing stubs for `Date.now`, `Math.random` and `fetch`, restored in `afterEach`.

**Steps**:

1. Run each subcommand three times with identical inputs; assert stdout bytes are identical across the three runs and parsed `data` is deeply equal.
2. Assert the fake call logs are identical across the three runs (same SQL, same ids, same order).
3. Assert human-mode output is byte-identical across the three runs after normalizing only the configured binary name (which is fixed by the injected brand).
4. Install the throwing ambient stubs and rerun each subcommand; assert the same success and the same bytes.
5. Run a mutant renderer that calls `Date.now()`; assert the replay comparison fails.

**Expected Outcome**:

- Identical inputs produce byte-identical data and human text; zero ambient reads; the clock-dependent mutant is caught.

#### TC-DB-031 - Reboot dry-run plan and the live gate on apply

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D4, DM-D4, AC-D10, NFR-D10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-reboot.test.ts`
**Tags**: @backend

**Preconditions**:

- A fixture with two live sessions; a fixture with zero live sessions; a WAL byte count before the run; the same stored rows evaluated under `NOW_MS` and a later injected clock (`NOW_MS + 15 min + 1 ms`).

**Steps**:

1. Run `db reboot` (dry-run) with two live sessions; assert `mode "dry-run"`, `liveWindowMinutes 15`, `liveSessions 2`, `blockedByLiveSession true`, `checkpointPerformed false`, `walBytesBefore` present, no `walBytesAfter`, exit 0.
2. Assert the call log contains exactly one live-count query, zero `checkpoint`, zero `deleteSession`; assert the recorded live-count SQL carries the 15-minute comparison (or the injected `computeDbLiveBoundaryMs(NOW_MS)` value).
3. Run `db reboot --apply` with two live sessions; assert the failure envelope `db.reboot.live`, `category transient`, `retryable true`, `consequence not_landed`, exit 2, and zero `checkpoint`/`deleteSession` calls.
4. Re-run the dry-run and the apply against the **same stored rows** under the later injected clock; assert the live count drops to 0, the dry-run no longer reports the block, and the apply proceeds to the checkpoint branch — proving the window is evaluated from the injected clock, not the host clock.
5. Assert the blocked apply changed no file metadata and no store row.
6. Run a mutant that checkpoints despite the live gate and a mutant that derives the live count from the host clock; assert both fail (the second fails the clock-shift case).

**Expected Outcome**:

- Dry-run reports the block without erroring; apply with a live session fails answered and performs nothing; the live-count SQL pins the window; the same stored state under a shifted injected clock changes the live count and flips the gate, so the injected clock is load-bearing.

#### TC-DB-032 - Reboot apply: exactly one bounded checkpoint

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D4, DM-D4, AC-D10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-reboot.test.ts`
**Tags**: @backend

**Preconditions**:

- Zero live sessions; WAL before 19_800_000 bytes and after 0 bytes; SHM present.
- The recorded checkpoint SQL and count.

**Steps**:

1. Run `db reboot --apply`; assert exactly one `checkpoint` call whose SQL is exactly `PRAGMA wal_checkpoint(TRUNCATE)`.
2. Assert `mode "applied"`, `liveSessions 0`, `blockedByLiveSession false`, `checkpointPerformed true`, `walBytesBefore 19800000`, `walBytesAfter 0`, and the sidecar presence flags.
3. Assert the call log contains exactly one live-count query and zero `deleteSession`; assert the live-count SQL carries the 15-minute comparison (or the injected `computeDbLiveBoundaryMs(NOW_MS)` value) and that the adapter uses the computed boundary rather than a literal host clock.
4. Run a double-checkpoint mutant, a `VACUUM` mutant and a live-count-SQL mutant that omits the window predicate; assert all three fail.

**Expected Outcome**:

- One bounded checkpoint, no delete, WAL before/after reported truthfully; the live-count SQL pins the injected window.

#### TC-DB-033 - Reboot never kills a process or deletes a sidecar

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D4, AC-D11, NFR-D3, NFR-D10
**Test Type(s)**: Static, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/session-admin-reboot.test.ts`, `tests/behaviour/session-admin-output.test.ts`, `tests/structure/session-admin-imports.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- An AST denylist over the adapter and the db command: `kill`, `process.kill`, `pkill`, `killall`, `SIGTERM`, `SIGKILL`, a kill-bearing spawn, and destructive file calls on a sidecar.
- The reboot human golden.

**Steps**:

1. Run reboot dry-run and apply; assert the call log contains no process or file operation beyond the single checkpoint and the read-only `stat` calls.
2. AST-scan the new files for every denylisted API and assert zero, with a seeded `process.kill` control that must fail.
3. Assert the human report contains the manual-restart sentence ("restart the opencode host manually; this command only prepares the database") for both modes.
4. Assert no output claims an automatic restart or reports a process action.
5. Run a mutant human renderer that claims a restart and assert the golden comparison fails.

**Expected Outcome**:

- No process action and no sidecar deletion in any reboot run; the manual restart is stated, never performed or claimed.

#### TC-DB-034 - Composition-absent `db` non-registration and present registration

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-D7, DM-D8, AC-D16, NFR-D9
**Test Type(s)**: Contract, Integration, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/cli-edge-seam.test.ts` (update), `tests/behaviour/session-admin-output.test.ts`
**Tags**: @backend

**Preconditions**:

- The program composition entry called with and without `options.db`.
- The commands index and the edge source.

**Steps**:

1. Compose without `db`; assert `program.commands.db` is absent and running `db size` returns `fallback.invocation`, exit 1.
2. Compose with the `db` composition; assert `commands.db` is registered and `db size` runs through the fake and returns success.
3. Assert `commands/index.ts` exports `createDbCommandDefinition` and the `DbCommandRuntime` type, and that the edge exports `DbComposition` and `createDbCommandRuntime`.
4. Assert `commands/db.ts` contains no `exitCode` assignment and no stream write (the existing exit-decision scan), and that its only exported function is the definition factory.
5. Update the existing "only status declares the optional human-text renderer" assertion to the exact new set (status and db) rather than removing it, and assert both register their renderer.
6. Run a no-op registration mutant (registers `db` unconditionally) and assert step 1 fails.

**Expected Outcome**:

- `db` exists only when composed, exactly like lint/phase/provider/status/verify; the edge owns rendering and exit projection; the existing seam assertion is extended, not weakened.

#### TC-DB-035 - Scoped baseline repair for the defaults-position tests

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-D17, RSK-D10, DEC-D11
**Test Type(s)**: Integration, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/config-default-positions.test.ts` (repaired in place)
**Tags**: @backend

**Preconditions**:

- The repaired file importing `mkdirSync` and creating `join(ROOT, "tmp", "tmpdir")` with `{ recursive: true }` before the first `mkdtempSync`.
- A fresh temp root with no `tmp/tmpdir` parent for the mechanism probe.

**Steps**:

1. Assert the file imports `mkdirSync` and contains exactly one recursive creation of `join(ROOT, "tmp", "tmpdir")` positioned before the first `mkdtempSync`.
2. Assert every `mkdtempSync` target in the file names `join(ROOT, "tmp", "tmpdir", …)` as its parent.
3. Assert the file's assertion count is at or above the pre-repair floor and that no assertion body was removed (a structural floor, not a moving-base diff).
4. Mechanism proof: in a fresh temp root, call `mkdtempSync(join(root, "tmp", "tmpdir", "case-"))` without creating the parent and assert it throws `ENOENT`; then create the parent with `mkdirSync(..., { recursive: true })` twice (proving idempotence) and assert `mkdtempSync` succeeds.
5. Run `bun test tests/checks/config-default-positions.test.ts` and assert it passes.

**Expected Outcome**:

- The parent-directory defect is repaired with one recursive creation; the mechanism and its absence-of-repair control are both proven; the suite passes in a clean checkout.

**Notes / Clarifications**:

- This is the only file outside the session-admin surface touched by the plan. It is a test-environment repair: no product behaviour, assertion or fixture semantics change (DEC-D11). The clean-checkout green is recorded in §10 as part of the aggregate gate.

#### TC-DB-036 - Hermeticity and the no-real-home-path scan

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-D17, NFR-D5, NFR-D1
**Test Type(s)**: Static, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/session-admin-imports.test.ts`, `tests/behaviour/session-admin-privacy.test.ts`
**Tags**: @backend

**Preconditions**:

- The nine session-admin suite files; the declared new/changed file set (current-tree paths); a path scanner for real home shapes (POSIX and Windows home prefixes followed by a username-shaped segment, a real developer username, `$HOME` expansion).
- The repository fixture-sanitization scanner as the precedent.

**Steps**:

1. Scan the nine suites for `node:child_process` imports, `spawn`, `exec`, `fork`, `Bun.spawn` and `node:http`/`node:https`/`fetch`; assert zero, with a seeded `spawn` control in a temp copy.
2. Scan the nine suites for `$HOME`, `os.homedir`, `process.env` and `node:fs` write APIs; assert zero.
3. Scan `tests/fixtures/session-admin/**` and the new source files for SQLite driver imports; assert zero.
4. Run the home-path scanner over the declared file set; assert zero matches and assert the scan reported a positive file count (non-empty scope).
5. Plant a home-shaped absolute path assembled at test runtime from joined path segments (a home prefix, a username segment and `session/opencode.db`; never committed as a literal) in a temp copy of one fixture and assert the scanner reports it.
6. Assert the session-admin suites themselves make zero child-process, real-file and network calls by construction (the fake IO contract of §4.1) and record the aggregate-gate result in §10.

**Expected Outcome**:

- The suites are hermetic; no real home path exists in the change's files; the scanner is non-vacuous because it has scope and a planted positive.

#### TC-DB-037 - Bounded-work oracle and the non-CI real-store evidence

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-D1, F-D2, F-D3, F-D4, DM-D6, AC-D1, AC-D2, AC-D3, AC-D17, NFR-D4
**Test Type(s)**: Performance, Contract, Manual (real-store smoke, non-CI)
**Automation Level**: Automated (bounded work); Manual (mandatory read-only real-store smoke; optional latency reference)
**Target Layer / Location**: `tests/behaviour/session-admin-size-list.test.ts`, `session-admin-prune.test.ts`, `session-admin-reboot.test.ts`, `tests/structure/session-admin-contract.test.ts`
**Tags**: @backend @perf

**Preconditions**:

- Two synthetic fixtures with identical shape but different populations: 10 rows and 6,900 sessions / 209,000 messages / 400,000 parts (facts only; no real database).
- The call recorder; the pure selection/assembly function; the declared timeout constants.
- A real opencode store on the reference environment for the mandatory read-only smoke, and the resolved binary name for the invocation.

**Steps**:

1. Run `db size` against both fixtures; assert the number of `query` calls is identical and independent of the population, that every SQL text contains an aggregate (`count(`, `min(` or `max(`), and that no per-session query exists.
2. Run `db list --limit 100` against both; assert exactly two queries (total count + one page) and that the page SQL carries `LIMIT`.
3. Run `db prune --limit 500 --apply` against the 6,900-row fixture; assert one selection query, at most one re-read per candidate and at most one `deleteSession` per candidate, with total queries ≤ `1 + limit` and deletes ≤ `limit`.
4. Run `db reboot --apply` with zero live sessions; assert exactly one live-count query and at most one `checkpoint`.
5. Assert `DB_QUERY_TIMEOUT_MS = 30000`, `DB_DELETE_TIMEOUT_MS = 30000`, `DB_CHECKPOINT_TIMEOUT_MS = 120000` and that the adapter references each constant on the matching I/O class (a structural assertion with a removal control).
6. Measure the pure selection/ordering over the 6,900-row fact set with a generous soft local ceiling (for example ≤ 50 ms) and record the median of three runs; a breach is a regression signal, not the NFR threshold.
7. **Mandatory before PR (non-CI):** run `db size` and `db list --limit 5` against the real opencode store **read-only**; record each command, exit code, and bounded output in the change evidence (§10); assert the store, WAL and SHM bytes and row counts are unchanged before/after (no delete, no checkpoint, no write). This is the only real-schema execution and it is required, not optional.
8. Optionally run the reference latency measurement procedure below and record its result in §10 as **non-CI**; a missing latency measurement is recorded as "not run", never as passing. The mandatory smoke in step 7 is not optional and is not a latency assertion.

**Reference measurement procedure (documented, non-CI, not a pass gate):**

- Preconditions: a real opencode store on the reference environment (opencode 1.19.3; roughly 120 GiB; ~6,900 sessions; ~209k messages) and a host with no concurrent harness activity.
- Mandatory read-only smoke (always run before PR): `db size` and `db list --limit 5`, recording output and exit and confirming no mutation.
- Optional reference commands, each run three times and recorded with median wall time: `db size`; `db list --limit 100`; `db prune --older-than 30 --limit 500` (dry-run, selection only); one pre-delete re-check for a single candidate; `db reboot` (dry-run, live check); and one `db prune --apply --limit 500` against a disposable copy of the store.
- Recorded numbers are labelled **reference-only / non-CI** in §10. NFR-D4 remains a target; the reference measurement is recorded for the owner and is never asserted by a test. No number is invented in this plan.

**Expected Outcome**:

- Bounded work is proven in CI: fixed/invariant query counts, one page query, at most one re-check and one delete per candidate, one live-count query and at most one checkpoint, and the declared timeouts present and referenced. The mandatory read-only real-store smoke is recorded with output, exit and a no-mutation check, so the adapter SQL is exercised once against the real opencode schema. The latency thresholds remain a target evidenced by the optional recorded reference measurement.

**Notes / Clarifications**:

- GAP-T2 records why the latency half cannot be CI-verified. The CI oracle is structural; a latency assertion on a shared runner without the reference store would be a fabricated measurement. The read-only smoke closes the "fake IO never touches the real schema" gap without turning latency into a CI gate.

#### TC-DB-038 - The C-11 sign-off is a recorded owner merge gate

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-D18, RSK-D9, DEC-D10
**Test Type(s)**: Contract, Manual (PR-body half)
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/structure/session-admin-contract.test.ts`, §5.5 of the spec, PR body
**Tags**: @backend

**Preconditions**:

- The delivered spec §5.5, the change evidence in §10, and the PR description.

**Steps**:

1. Assert the spec states that the ADR-0003 C-11 privacy sign-off is required before merge, that it is **not** claimed as granted, and that merge authority remains with the CEO/human owner.
2. Assert no artifact in the change (spec, test plan, plan, pm-notes) asserts that approval has been given.
3. Assert the automated evidence the sign-off needs exists: the metadata-only whitelist (TC-DB-029), the canary test (TC-DB-029), the no-SQLite check (TC-DB-002) and the destructive-operation boundaries (TC-DB-016, TC-DB-033).
4. Manual PR-time check: the PR body carries the same statement, the PR is open, and the delivery process did not merge it. Record the PR URL and the checklist result in §10.
5. Run a temp copy whose spec text claims approval and assert the scan fails.

**Expected Outcome**:

- The sign-off is recorded as an owner merge gate, not a claimed approval; the evidence it needs is present and green; the PR-body half is recorded manually.

**Notes / Clarifications**:

- Step 4 is the semi-automated, non-CI half described in GAP-T3. It is not a test pretending to be the PR.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version` (1.4.4); pnpm pinned by `packageManager` (10.18.3); no opencode binary, no session database, no network | All session-admin suites are hermetic and in-process |
| CI (`ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; `pnpm build` before the test job (the `pretest` hook); `fetch-depth: 0` | Authoritative for the suite results, the boundary/sync checks and the aggregate gate |
| In-process test process | Bun runtime; injected brand, clock, run id, streams, IO fake and runtime fake | No child processes, no real `stat`, no real filesystem except temp roots |
| Temp fixture roots | `mkdtemp` under the OS temp directory | Goldens, baseline mechanism proof and whole-tree scans; deleted per test |
| Reference environment (non-CI) | Real opencode 1.19.3; roughly 120 GiB store; ~6,900 sessions; ~209k messages; idle host | Mandatory read-only smoke (`db size`, `db list --limit 5`) and the optional reference latency measurement, both recorded in §10 and never asserted |

### 6.2 Test Data and Fixtures (all synthetic)

All session-admin fixtures live under `tests/fixtures/session-admin/` or are generated in a temp directory. No fixture contains a real path, title, prompt, message body, part payload, credential, environment value or command argument.

| Fixture / artefact | Shape | Lifecycle |
|--------------------|-------|-----------|
| `tests/fixtures/session-admin/harness.ts` | The fake `OpencodeSessionIo` and fake `DbCommandRuntime`, the ordered call recorder, `runDbCli`, the scripted-response queue, and the mutation hooks (`fakeSetChildren`, `fakeRemoveRow`, `fakeFailDelete`) | Read-only code; per-test instances |
| `tests/fixtures/session-admin/store.ts` | `makeSession({...})` builder over synthetic ids, `parentId`, `updatedAtMs`, message/part counts, `dataBytes` as an exact UTF-8 byte length, `archived`; no content fields | Read-only |
| `store.ts` byte-length cases | Session `ses_bytes` scripted as `messageCount 2`, `partCount 1`, `dataBytes 11` — two message payloads of 2 + 3 UTF-8 bytes and one part payload of 6 UTF-8 bytes (character length 6, so the byte/character distinction is observable); a session with no rows reports `dataBytes 0` | Read-only; lengths only, never content |
| `tests/fixtures/session-admin/boundaries.ts` | Boundary rows B-01..B-16 (§4.4) with their expected outcomes | Read-only |
| `tests/fixtures/session-admin/malformed.ts` | Malformed query responses: truncated JSON, non-array JSON, non-zero outcome, absent result | Read-only |
| `tests/fixtures/session-admin/ids.ts` | Id-shape matrix I-01..I-07 (§4.7) | Read-only |
| `tests/fixtures/session-admin/canary.ts` | One fabricated canary constant, the forbidden-shaped field names and the fabricated environment value | Read-only; the only canary source |
| `tests/fixtures/session-admin/golden/**` | Normalized human reports for `size`, `list`, `prune` and `reboot` in dry-run and applied modes; no absolute paths, no host timestamps | Read-only; regenerated only by an explicit command |
| `tests/fixtures/session-admin/mutants/**` | Temp-copied mutant modules: delete-in-dry-run, bulk-SQL delete, no-predicate re-read, wide projection, extra item field, 40-item renderer, `Date.now()` renderer, `process.kill`, destructive file call, restart claim, no-op registration, failure-to-empty, raw-value/numeric interpolation, unconditional registration, approval claim | Temp-copied and imported through a file URL; never executed against the live tree |
| Empty/zero-byte sidecar fixtures | Empty store, absent WAL/SHM, real zero-byte WAL | Generated in temp |
| Performance fixtures | 10-row and 6,900-session / 209k-message / 400k-part fact sets (counts only; no payloads) | Generated in memory per test |
| Baseline mechanism probe | `tmp/tmpdir` absent-parent and repaired-parent roots | `mkdtemp`; removed per test |

**Fixture rules.** Ids are `ses_`/`msg_`-style synthetic strings matching `^[A-Za-z0-9_-]+$`. Paths use `/synthetic/...`. Timestamps are ISO-8601 UTC or epoch milliseconds derived from `NOW_MS`. Counts and byte sizes are small integers or documented maxima; `dataBytes` fixtures are exact UTF-8 **byte** lengths and include a multi-byte case whose byte length differs from its character length. The canary is a fabricated marker, not a credential, and exists only to prove the metadata-only boundary.

### 6.3 Determinism Contract

- Time comes only from the injected `nowMs`; `newRunId` is a fixed sequence; the brand is the injected `SYNTHETIC_BRAND`. No test reads `Date.now`, `Math.random`, `process.env`, `$HOME` or a real path for a verdict (TC-DB-030, TC-DB-036).
- Every iteration over rows, candidate ids, recorded calls and files has an asserted order; no test depends on file enumeration or object key order.
- Replays use identical inputs and byte-compare stdout; goldens are committed, normalized and regenerated only by an explicit command.
- No sleep, timer, retry-with-delay or scheduler is used; TOCTOU state changes are explicit hook calls between recorded calls.
- No assertion compares against a moving base branch. Tree scans read the current tree; mutation tests read and edit temp copies only.

### 6.4 Isolation Strategy

- Every mutation and golden comparison runs on a fresh temp root or a committed read-only fixture; the live repository tree, `dist/` and the user's real state directory are never written.
- The fake IO has no file-write, file-delete, process or transport member; the only file-shaped operation is a read-only `stat` of the database and its two sidecars.
- The suites are discovered by the root `bun test`; no test writes a `.test.ts` fixture (fixtures are never named `*.test.ts`).
- Temp copies are deleted at test end; a clean-worktree check is part of the aggregate gate in §7.3.

### 6.5 Entry and Exit Criteria for the Phase

**Entry (before execution)**

- The spec is accepted into the change (Proposed is acceptable per the delivery precedent) and `.ai/rules/testing-strategy.md` and `.ai/rules/typescript.md` have been read (this plan was authored against them).
- The delivered contracts, domain policy, adapter session implementation, `db` command and edge composition exist, and the four `db` rows exist in both the machine table and `doc/spec/features/feature-result-contract.md`.
- The fake IO harness and the fixture modules above exist.
- No real opencode binary, session database or populated home directory is required for the CI suites; the environment may be a clean checkout. The mandatory pre-PR read-only smoke (TC-DB-037 step 7) runs separately against the operator's real store and is non-CI.

**Exit (before the change is proposed)**

- All 18 ACs have passing, traceable evidence recorded in §10 with commands and HEAD; the pushed-HEAD CI result is recorded for the `ts-test`, `ts-boundaries`, `ts-invariants` and `ts-aggregate` jobs.
- Every boundary in §4.4 has both its positive and its negative assertion; every guard has its detection-disabled control; every cap is asserted at and above its threshold.
- The four error rows are 4/4 round-trip and the documented sync is green in both directions.
- The composition-absent case leaves `db` unregistered and the composition-present case runs it.
- The repaired baseline suite passes, and `pnpm check` is green in a clean checkout.
- The mandatory read-only real-store smoke (`db size` and `db list --limit 5`) is recorded in §10 with commands, exit codes, bounded output, and a no-mutation confirmation (database/WAL/SHM bytes and row counts unchanged).
- The optional non-CI reference latency measurement of TC-DB-037 is recorded with its environment and date, or explicitly recorded as not run; it is never reported as a passing threshold and NFR-D4 remains a target.
- `git diff --check` is clean and no gate in §7 was skipped.

## 7. Automation Plan and Implementation Mapping

All TCs are automated except the PR-body half of TC-DB-038, the mandatory read-only real-store smoke and the optional reference latency measurement of TC-DB-037. The smoke and the PR-body check are recorded manually in §10; the smoke is mandatory before the PR and is not optional. File names are the spec's §7.1 suite names; delivery planning may add helpers but must preserve each TC's behaviour, assertions and AC mapping.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-DB-001 | `tests/structure/session-admin-contract.test.ts` | `bun test tests/structure/session-admin-contract.test.ts` | executable-statement and wrong-constant mutants | To Implement |
| TC-DB-002 | `tests/structure/session-admin-imports.test.ts`; existing boundary and check suites | `bun test tests/structure tests/boundaries`; `bun run scripts/checks/{ambient-globals,secret-read-boundary,workspace-entrypoints,exit-code-literals}.ts` | seeded imports, fifth allowlist entry, seeded literal | To Implement |
| TC-DB-003 | `tests/structure/error-table.test.ts`; trigger suites | `bun test tests/structure/error-table.test.ts` | row-removal mutant | Existing – Update |
| TC-DB-004 | `tests/checks/error-table-sync.test.ts`; `scripts/checks/error-table-sync.ts` | `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | machine/doc drift both directions; empty-table control | Existing – Update |
| TC-DB-005 | `tests/behaviour/error-classification.test.ts`; `tests/structure/error-table.test.ts` | corresponding `bun test` | kind-only, bad-code, first-row control | Existing – Update |
| TC-DB-006 | `tests/behaviour/session-admin-size-list.test.ts` | `bun test tests/behaviour/session-admin-size-list.test.ts` | fabricated-path/timestamp mutant | To Implement |
| TC-DB-007 | same | same | absent vs zero-byte pair; conflating mutant | To Implement |
| TC-DB-008 | same | same | scrambled response; extra-field mutant; character-`LENGTH` aggregate mutant (reports 6, not 11); `archived`-column projection mutant | To Implement |
| TC-DB-009 | same | same | boundary pair; shifted-clock replay; host-clock mutant | To Implement |
| TC-DB-010 | `tests/behaviour/session-admin-privacy.test.ts` | `bun test tests/behaviour/session-admin-privacy.test.ts` | mutation member on the read port | To Implement |
| TC-DB-011 | `tests/behaviour/session-admin-prune.test.ts` | `bun test tests/behaviour/session-admin-prune.test.ts` | delete-in-dry-run mutant; dropped-selection-predicate mutant; byte-identical replay | To Implement |
| TC-DB-012 | same | same | `<=` mutant; wrong-cutoff mutant; both boundary sides present | To Implement |
| TC-DB-013 | same + `session-admin-size-list.test.ts` | corresponding `bun test` | leaf/live pairs; policy-level live probe; dropped-not-live and dropped-leaf SQL mutants | To Implement |
| TC-DB-014 | `tests/behaviour/session-admin-prune.test.ts` | `bun test tests/behaviour/session-admin-prune.test.ts` | scrambled input; pass-through mutant; dropped `ORDER BY`/`LIMIT` mutant | To Implement |
| TC-DB-015 | same + `session-admin-sql-safety.test.ts` | corresponding `bun test` | bulk-SQL-delete mutant | To Implement |
| TC-DB-016 | same + `session-admin-reboot.test.ts` + `session-admin-imports.test.ts` | corresponding `bun test` | planted `unlinkSync`; stat-path assertion | To Implement |
| TC-DB-017 | `tests/behaviour/session-admin-prune.test.ts` | same | row-retention mutant | To Implement |
| TC-DB-018 | same | same | gained-child hook; no-predicate re-read mutant | To Implement |
| TC-DB-019 | same | same | vanished-row hook; delete-from-selection mutant | To Implement |
| TC-DB-020 | same + `session-admin-output.test.ts` | corresponding `bun test` | success-on-partial and summary-without-id mutants | To Implement |
| TC-DB-021 | `tests/behaviour/session-admin-prune.test.ts` | same | absent-row-at-delete with a present sibling | To Implement |
| TC-DB-022 | same + `tests/fixtures/session-admin/malformed.ts` | same | failure-to-empty mutant; post-land wrong-identity and missing-landed-count mutants | To Implement |
| TC-DB-023 | `tests/behaviour/session-admin-grammar.test.ts` | `bun test tests/behaviour/session-admin-grammar.test.ts` | per-class matrix including the single-dash positional; G-12 last-wins acceptance; valid sibling control | To Implement |
| TC-DB-024 | same | same | undeclared `--`-prefixed containment tokens; same-prefix valid control | To Implement |
| TC-DB-025 | same + `tests/behaviour/session-admin-sql-safety.test.ts` | corresponding `bun test` | raw-value mutant; boundary matrix | To Implement |
| TC-DB-026 | `tests/behaviour/session-admin-sql-safety.test.ts` + `ids.ts` | `bun test tests/behaviour/session-admin-sql-safety.test.ts` | interpolating mutant; over-cap id/path | To Implement |
| TC-DB-027 | same | same | `DELETE FROM session` mutant | To Implement |
| TC-DB-028 | `tests/behaviour/session-admin-output.test.ts` + goldens | `bun test tests/behaviour/session-admin-output.test.ts` | over-cap renderer and 40-item mutants | To Implement |
| TC-DB-029 | `tests/behaviour/session-admin-privacy.test.ts` + `canary.ts` | `bun test tests/behaviour/session-admin-privacy.test.ts` | wide-projection and extra-field mutants; presence control | To Implement |
| TC-DB-030 | `tests/behaviour/session-admin-output.test.ts` | same | `Date.now()` renderer mutant; throwing ambient stubs | To Implement |
| TC-DB-031 | `tests/behaviour/session-admin-reboot.test.ts` | `bun test tests/behaviour/session-admin-reboot.test.ts` | checkpoint-despite-gate mutant; host-clock live-count mutant; clock-shift case | To Implement |
| TC-DB-032 | same | same | double-checkpoint, `VACUUM`, and dropped-window-predicate mutants | To Implement |
| TC-DB-033 | same + `session-admin-output.test.ts` + `session-admin-imports.test.ts` | corresponding `bun test` | planted `process.kill`; restart-claim mutant | To Implement |
| TC-DB-034 | `tests/structure/cli-edge-seam.test.ts` + `session-admin-output.test.ts` | corresponding `bun test` | unconditional-registration mutant; both branches asserted | Existing – Update |
| TC-DB-035 | `tests/checks/config-default-positions.test.ts` | `bun test tests/checks/config-default-positions.test.ts` | absent-parent `ENOENT` control; structural floor | Existing – Repair |
| TC-DB-036 | `tests/structure/session-admin-imports.test.ts` + `session-admin-privacy.test.ts` | corresponding `bun test` | planted runtime-synthesized home-shaped path; planted `spawn` | To Implement |
| TC-DB-037 | `session-admin-size-list.test.ts` + `session-admin-prune.test.ts` + `session-admin-reboot.test.ts` + `session-admin-contract.test.ts` + manual real-store smoke | corresponding `bun test` + manual `db size` / `db list --limit 5` | per-row-query mutant; newest-first fixture; timeout-removal mutant; recorded no-mutation smoke | To Implement |
| TC-DB-038 | `tests/structure/session-admin-contract.test.ts` + manual PR checklist | `bun test tests/structure/session-admin-contract.test.ts` + manual | approval-claim mutant; PR body recorded in §10 | To Implement |

### 7.1 Execution Order

1. Contracts, imports and error identity: TC-DB-001, TC-DB-002, TC-DB-003, TC-DB-005.
2. Size and list: TC-DB-006, TC-DB-007, TC-DB-008, TC-DB-009.
3. Prune selection: TC-DB-012, TC-DB-013, TC-DB-014, TC-DB-011.
4. Prune mutation and failure: TC-DB-015, TC-DB-016, TC-DB-017, TC-DB-018, TC-DB-019, TC-DB-021, TC-DB-020, TC-DB-022.
5. Grammar and SQL safety: TC-DB-023, TC-DB-024, TC-DB-025, TC-DB-026, TC-DB-027.
6. Output, privacy and determinism: TC-DB-010, TC-DB-028, TC-DB-029, TC-DB-030.
7. Reboot: TC-DB-031, TC-DB-032, TC-DB-033.
8. Composition, repair and hermeticity: TC-DB-034, TC-DB-035, TC-DB-036.
9. Documented sync and sign-off: TC-DB-004, TC-DB-038.
10. Bounded work and aggregate regression: TC-DB-037, `pnpm check`.

### 7.2 CI Mapping

No new CI job is introduced. The existing jobs carry the new suites:

| Suite / check | Discovered by | CI job(s) |
|---------------|---------------|-----------|
| `tests/structure/session-admin-contract.test.ts`, `session-admin-imports.test.ts` | `bun test` (whole tree) | `ts-test` (`pnpm test`); the import and boundary scans also run in `ts-boundaries` (`pnpm check:boundaries`) and the static checks in `ts-invariants` |
| `tests/behaviour/session-admin-*.test.ts` (seven behaviour suites) | `bun test` | `ts-test` |
| `tests/behaviour/error-classification.test.ts`, `tests/structure/error-table.test.ts` | `bun test` | `ts-test` |
| `tests/checks/error-table-sync.test.ts` | `bun test` | `ts-test` |
| `scripts/checks/error-table-sync.ts` | direct invocation | `ts-invariants` |
| `scripts/checks/{ambient-globals,secret-read-boundary,workspace-entrypoints,exit-code-literals}.ts` | direct invocation | `ts-boundaries` (`ambient-globals`, `workspace-entrypoints`, `secret-read-boundary` via `check:boundaries`) and `ts-invariants` (`secret-read-boundary`, `workspace-entrypoints`, `exit-code-literals`) |
| `tests/checks/config-default-positions.test.ts` (repaired) | `bun test` | `ts-test` |
| Full gate | `pnpm check` | `ts-aggregate` and the individual `ts-*` jobs |
| Build prerequisite | `pretest` → `pnpm build` | `ts-test` runs the build via `pretest`; `ts-boundaries` builds explicitly |

**Wiring rules.** The suites are discovered by the root `package.json#scripts.test` (`bun test`), which contains no filter, no `--bail`, no `--passWithNoTests` and no `|| true`; no job uses `continue-on-error`; no test is skipped by `bunfig.toml` ignore patterns. The change adds no workflow file and no job. The aggregate gate is unchanged.

### 7.3 Evidence Commands

Run and record in §10 (never record an unrun result as passing):

```
pnpm install --frozen-lockfile
pnpm build
bun test tests/structure/session-admin-contract.test.ts
bun test tests/structure/session-admin-imports.test.ts
bun test tests/structure/error-table.test.ts
bun test tests/behaviour/error-classification.test.ts
bun test tests/behaviour/session-admin-size-list.test.ts
bun test tests/behaviour/session-admin-prune.test.ts
bun test tests/behaviour/session-admin-reboot.test.ts
bun test tests/behaviour/session-admin-grammar.test.ts
bun test tests/behaviour/session-admin-output.test.ts
bun test tests/behaviour/session-admin-sql-safety.test.ts
bun test tests/behaviour/session-admin-privacy.test.ts
bun test tests/structure/cli-edge-seam.test.ts
bun test tests/checks/config-default-positions.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/boundaries
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/secret-read-boundary.ts
bun run scripts/checks/workspace-entrypoints.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/forbidden-literals.ts
pnpm check
git diff --check
git status --porcelain
```

**Mandatory non-CI real-store smoke (before PR, recorded in §10; not part of the CI battery):**

```
# read-only; run against the operator's real opencode store, never mutate
<binary> db size
<binary> db list --limit 5
```

Record each command, exit code, bounded output, and a before/after confirmation that database/WAL/SHM bytes and row counts are unchanged. The optional reference latency measurement described in TC-DB-037 is recorded separately and labelled reference-only.

Notes on the battery:

- `pnpm build` is required because the `pretest` hook builds and because the boundary and export checks read `dist/`.
- The nine session-admin suites are also exercised in one pass by `bun test` (the CI command); the individual lines above localize a failure.
- `git status --porcelain` is captured before and after the battery; the suites must not modify the worktree.

**Open-PR Definition of Done evidence checklist.** All 18 ACs have a passing traceable TC; the cold/live/leaf boundary matrix is complete with both sides asserted; the selection and live-count SQL predicates are asserted textually (cold, not-live, `NOT EXISTS`, `ORDER BY`, `LIMIT`, 15-minute live comparison); dry-run mutates nothing and apply deletes only through the official command; the TOCTOU, vanished-row and absent-row cases are counted skips; partial failure and the post-land abort are never success, carry the normative landed/failed summary, and the retry converges; the reboot gate blocks, the success path checkpoints exactly once, clock shifts flip the gate, and no process or sidecar is touched; grammar and its parser carve-out both exit 1 with zero I/O, while repeated flags are last-wins; ids and numeric ranges are safe; the four error rows round-trip and sync both ways; the metadata-only whitelist and canary are proven by mutants; `list` `dataBytes` is byte-exact (`LENGTH(CAST(... AS BLOB))`/`OCTET_LENGTH` over `message`/`part`) including the multi-byte case, with `session_message` never counted; replays are byte-identical; contracts are data-only, the domain is pure, the single I/O location is the admitted subpath, no SQLite driver exists, the allowlist stays at four, and `db` is registered only with a composition; the repaired baseline suite is green; the mandatory read-only real-store smoke is recorded with a no-mutation check; the C-11 sign-off is recorded as an owner merge gate and the PR is left open. This plan claims no merge and no owner approval.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A boundary fixture is inert, so a negative passes without proving the predicate | H | M | Every boundary has its positive and negative neighbour in the same fixture; both outcomes are asserted; a wrong-comparison mutant must fail (TC-DB-012, TC-DB-013) |
| RSK-T2 | A skip is reported without being counted, or the run is misreported as success | H | M | Skips assert counts, the absence of a delete and the continuation of the run; a success-on-partial mutant must fail (TC-DB-018..TC-DB-021) |
| RSK-T3 | The fake IO hides a real destructive call because the adapter is never exercised end to end | H | M | The adapter's destructive-API surface is scanned with a planted control; the seam declares no destructive member; the call log is asserted (TC-DB-016, TC-DB-033) |
| RSK-T4 | The metadata-only whitelist passes vacuously because the fixture never contains forbidden content | H | M | The canary presence is asserted before its absence; the wide-projection and extra-field mutants must expose it (TC-DB-029) |
| RSK-T5 | The evidence for AC-D17 depends on a developer home path or local state | H | L | Suites are hermetic by contract; the path scanner has a positive planted control; the aggregate gate runs in a clean checkout (TC-DB-036) |
| RSK-T6 | The baseline repair is read as scope creep or silently weakens the test | M | M | The repair is one recursive parent creation; the assertion floor and the `ENOENT` control prove nothing was removed (TC-DB-035) |
| RSK-T7 | NFR-D4 is claimed as met without a measurement | H | M | CI asserts bounded work only; a mandatory read-only real-store smoke is recorded before PR; the latency reference measurement is labelled non-CI and recorded, never asserted (TC-DB-037, GAP-T2) |
| RSK-T8 | The documented error table drifts while the machine table changes | H | L | Bidirectional sync with machine-only and doc-only mutations plus a fail-closed empty-table control (TC-DB-004) |
| RSK-T9 | Composition is asserted structurally but `db` leaks into every program | H | L | Both the absent and the present composition are asserted at runtime, plus a no-op-registration mutant (TC-DB-034) |
| RSK-T10 | The `+N more` count is asserted inconsistently and the human output becomes untruthful | M | M | The count is pinned to unshown items; the over-cap and 40-item mutants must fail (TC-DB-028, OQ-T3) |
| RSK-T11 | A shared module change (edge, classifier, serializer) regresses existing behaviour | M | M | Existing `cli-edge-seam`, `error-classification`, `error-table`, envelope, boundary and aggregate suites run unchanged as the regression half |
| RSK-T12 | The absent-row-at-delete representation is implemented as a generic delete failure | H | M | TC-DB-021 binds the observable (skip, continue, no `db.delete.failed`); the store state and the absence signal are both part of the fixture (OQ-T2) |

### 8.2 Assumptions

- **A-T1 — Behaviour-bound TCs.** Proposed helper names, fixture file contents, golden file names and the internal SQL text may change in delivery planning; the behaviour, assertions, identities, shapes, exits and AC mapping must not. Spec-fixed values (`delivery.session-admin.v1`, the four `db.*` codes, the live window, the ranges, the caps, the id pattern, the timeouts) may not be rebound.
- **A-T2 — In-process harness.** The suites exercise the production modules through the fake IO and the fake runtime, in-process. No session-admin test spawns a process, opens a database, reads a home directory or uses the network (TC-DB-036 asserts the absence).
- **A-T3 — Grammar split, declaration and repeated flags.** The shared parser recognizes only `--`-prefixed tokens as flags. The `db` command declares its full `--` flag set and enough positional capacity for the handler to see the tokens, so missing values, unexpected positionals (including a single-dash token such as `-x`) and wrong-for-subcommand flags are handler rejections (`input.value.rejected`), while an undeclared `--`-prefixed token (including a fused `--flag=value`) is parser containment (`fallback.invocation`). Repeated occurrences of the same flag are not a conflict: `db` declares no conflict pairs and the parser applies the last value (`--apply --apply` is apply; `--limit 5 --limit 10` is `limit 10`). This is the implementable reading of §3.1 and DEC-D7; the matrix in §4.5 is the binding oracle.
- **A-T4 — Partial-failure summary format.** The summary is asserted against the spec's normative format `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"` with `attempted = landed + failed` (and, for the post-land abort, the aborting candidate counted in `failed` with the not-attempted candidates excluded). A wording change requires a spec amendment and a plan update, not a silent test relaxation.
- **A-T5 — Absent-row representation is delivery-bound.** The seam is not extended by this plan. Absence at delete is derived from the store state after the failed delete (or an equivalent delivery representation); the test binds to the observable (skipped, run continues, no `db.delete.failed`).
- **A-T6 — NFR-D4 evidence.** The mandatory read-only real-store smoke (`db size`, `db list --limit 5`) is recorded before PR with a no-mutation check. The latency thresholds are evidenced only by the optional recorded reference measurement; the CI oracle is bounded work. A missing latency measurement is recorded as "not run", never as passing; NFR-D4 remains a target.
- **A-T7 — Two suites are extended, not replaced.** `tests/structure/cli-edge-seam.test.ts` keeps its existing assertions (including the human-text-declarer set) and extends the expected set to include `db`; `tests/structure/error-table.test.ts`, `tests/behaviour/error-classification.test.ts` and `tests/checks/error-table-sync.test.ts` are extended with `db` cases, never weakened.
- **A-T8 — Single scoped repair.** The only non-session-admin file changed for testing is `tests/checks/config-default-positions.test.ts`, and only by the recursive parent creation and its import (DEC-D11).
- **A-T9 — Plan-relative (resolved).** `chg-GH-180-plan.md` now exists and maps its phases onto these TCs; GAP-T1 is resolved. Any later plan or implementation change that alters a TC's behaviour, assertion or AC mapping must reopen this test plan.
- **A-T10 — Version impact.** `minor` is taken from the spec; this plan introduces no version or release metadata of its own.

### 8.3 Open Questions and Recorded Gaps

| ID | Question / gap | Context | Status | Owner |
|----|----------------|---------|--------|-------|
| OQ-T1 | What are the internal helper, fixture and golden file names, and the exact SQL text? | The spec pins the surface, shapes and identity; the internal spellings are delivery-bound | Open — delivery-bound, non-blocking (A-T1, GAP-T4) | @plan-writer / @coder |
| OQ-T2 | How does the delete seam report "row already absent" as distinct from a delete failure? | `deleteSession` returns `Promise<void>`; AC-D9 requires the distinction, so the adapter must derive absence (for example by a post-delete read) or delivery must report it explicitly | Open — observable pinned (A-T5, RSK-T12); non-blocking | @coder / @reviewer |
| OQ-T3 | Does `+N more` count only the data's `omitted` or all unshown items? | The human template writes `+<omitted> more`; the data's `omitted` excludes the unrendered page remainder, which would under-count | Pinned by this plan to unshown items (`rendered + N = total`) under NFR-D10 truthfulness; owner may amend | @spec-writer / @pm |
| OQ-T4 | Does the repo want a `tests/types/` compile-time probe for the port split? | TC-DB-010 asserts the shape at runtime and by AST; a type probe would add a second line of defence | Open — optional, non-blocking | @plan-writer |
| OQ-T5 | Which exact PR-body wording satisfies AC-D18? | The spec states the semantics; the PR template wording is delivery-bound | Open — manual check in §10 (GAP-T3) | @pr-manager |
| GAP-T1 | Implementation plan absent at authoring | Resolved: `chg-GH-180-plan.md` now exists; no reshaped TC/AC | Resolved, non-blocking | @plan-writer |
| GAP-T2 | NFR-D4 latency is not CI-verifiable | No CI runner has the reference store; bounded work is the CI oracle, a mandatory read-only real-store smoke is recorded before PR, and the latency reference measurement is non-CI | Recorded, non-blocking (A-T6) | @pm / @runner |
| GAP-T3 | AC-D18's PR-body carrier is outside the tree | Only the spec and committed evidence can be asserted automatically | Recorded, non-blocking; manual step in §10 | @pr-manager |
| GAP-T5 | Four spec-named behaviours have no dedicated AC | Mapped to existing ACs in §3.4 | Recorded, non-blocking | @spec-writer |

**No blocking gap was found.** The spec's 18 ACs are each testable with an observable oracle; the grammar split is implementable and pinned in §4.5; repeated flags are last-wins; the absent-row case is bound to its observable without extending the seam; adapter SQL predicates are asserted textually because the fake is blind to SQL; and NFR-D4 is evidenced by bounded work in CI plus a mandatory read-only real-store smoke, with an optional non-CI reference latency measurement. The plan existed at this revision, so GAP-T1 is resolved. No spec, plan, pm-notes or code file was modified by this author.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T19:45:00Z | Change Test Plan Writer | Initial plan: 38 TCs (`TC-DB-001..TC-DB-038`, a new prefix). All 18 ACs (AC-D1..AC-D18) and all 10 NFRs mapped with no orphan TCs; a binding cold/live/leaf boundary matrix (B-01..B-16) with both sides asserted; grammar and parser-containment matrices; numeric-range and id-shape/SQL-discipline matrices; dry-run zero mutation, official-delete-only apply, idempotency, TOCTOU, vanished-row and already-absent handling, partial-failure truthfulness and retry convergence, reboot gate and single checkpoint, no process kill and no sidecar deletion; machine and human caps with `+N more`; metadata-only whitelist with a canary and mutation-sensitivity controls; four `db.*` rows with bidirectional sync and kind-only containment; tier/purity/no-SQLite/allowlist confinement and composition-absent non-registration; the scoped `config-default-positions` baseline repair; hermeticity and no-real-home-path scan; bounded-work NFR-D4 evidence with an explicitly non-CI reference measurement; and the C-11 sign-off gate. Recorded gaps: plan absent, NFR-D4 non-CI latency, AC-D18's PR-body half, delivery-bound spellings, four AC-less spec behaviours, and the single scoped repair. |
| 1.1 | 2026-10-31T19:55:00Z | Change Test Plan Writer | Targeted amendment aligning the grammar oracle with spec v1.1: P-04 is now `size --x` (parser `fallback.invocation`); added G-13 `size -x` as an unexpected positional (`input.value.rejected`); AC-D12 wording, the exit oracle, TC-DB-023/TC-DB-024, §7 mapping and A-T3 now state the two-class rule. TC count unchanged at 38; exits, AC mappings and the zero-I/O oracle unchanged; privacy scan 0 matches. |
| 1.2 | 2026-10-31T20:10:00Z | Change Test Plan Writer | Targeted amendment: renamed the reboot failure identity to `db.reboot.live`. The earlier spelling appended a hyphenated `session` segment, which the repo error-code format `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$` rejects because a segment may contain only lowercase letters and digits; the gate was not widened. Updated every occurrence — AC-D10 in §3.1, TC-DB-031 in §5.1 and §5.2, the exit-code oracle row, and the TC-DB-031 step in §5.2. TC count unchanged at 38; all AC mappings, exits, categories and assertions unchanged. Post-edit scan for the retired spelling: 0 matches. |
| 1.3 | 2026-10-31T22:35:00Z | Change Test Plan Writer | DoR iteration-1 remediation. **B5:** added textual/structural assertions over the recorded selection SQL (cold, not-live, `NOT EXISTS` child, `ORDER BY ... time_updated`, `LIMIT`) and the reboot live-count SQL (15-minute comparison or the injected `computeDbLiveBoundaryMs`), asserted the adapter uses `computeDbCutoffMs`/`computeDbLiveBoundaryMs`, and added a reboot clock-shift case; updated §4.1, §4.2, §4.3, §4.7 S-05/S-06, TC-DB-011..TC-DB-014, TC-DB-031, TC-DB-032 and §7. **M4:** added a mandatory non-CI read-only real-store smoke (`db size`, `db list --limit 5`, recorded with output/exit and a no-mutation check) before PR, kept the CI oracle as bounded work, and kept NFR-D4 as a target with the reference measurement recorded rather than gated; updated GAP-T2, §6.5, §7, TC-DB-037 and §10. **B4:** pre-land query/re-read failures stay `db.query.failed` (or `db.opencode.unavailable`) at exit 2, while any aborting failure after at least one delete lands returns `db.delete.failed` with the normative `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"` summary (`attempted = landed + failed`); added the post-land abort case to TC-DB-022 and updated the AC-D8 row, GAP-T5 mapping, exit-code oracle and §7; TC-DB-020/A-T4's partial-delete case is retained. **Message store:** corrected every count/aggregate reference from `session_message` to `message` (messages) and `part` (parts), kept `session_message` only as the legacy/not-counted/delete-cascade mention, and made TC-DB-006 assert the recorded SQL step names `message` and `part`. **m5:** marked GAP-T1 resolved and aligned `last_updated` with this revision. **m7:** made the TC-DB-006 table-name assertion an explicit step. **n1:** added NFR-D4 to TC-DB-037's AC column in §5.1. **m3:** G-12 is now a last-wins acceptance case (`--apply --apply` is apply; repeated `--limit` takes the last value) and §4.5/A-T3/§1.1 no longer assert repeated-flag rejection. **m4:** aligned the TC-DB-020 summary regex with the normative landed/failed format. TC count unchanged at 38; TC IDs unchanged; AC mappings unchanged. |
| 1.4 | 2026-10-31T22:55:00Z | Change Test Plan Writer | DoR iteration-2 remediation. **m9:** corrected the v1.3 revision row to its actual PM-recorded time (`2026-10-31T22:35:00Z`) and set `last_updated` to this row's time, so the front matter and the revision log agree. **m11:** aligned `dataBytes` with spec v1.5 byte semantics — it is the summed stored payload **byte** length (`COALESCE(SUM(LENGTH(CAST(message.data AS BLOB))),0) + COALESCE(SUM(LENGTH(CAST(part.data AS BLOB))),0)`, equivalently `OCTET_LENGTH`), not a character `LENGTH`; added the byte-length aggregate to the textual SQL oracle (§4.1, new §4.7 S-07), made TC-DB-008 assert exact byte values including a multi-byte case (11 bytes where a character count yields 6) and the `dataBytes 0` empty case, and updated §1.1, the TC-DB-008 title/row in §4.3 and §5.1, §6.2 and §7. **Spec v1.5 AC-D2 DoD alignment:** TC-DB-008 now also asserts the pinned field sources (`createdAt = time_created`, `updatedAt = time_updated`, `archived = time_archived IS NOT NULL`, no `archived` column) and the page projection oracle (new §4.7 S-08). **Store pin confirmed:** `message`/`part` are the current stores for counts and aggregates; `session_message` remains only the legacy, never-counted store, and TC-DB-015 now records that its rows are removed by the official delete's cascade, never by a `prune` SQL statement. TC count unchanged at 38; TC IDs, AC mappings and exits unchanged. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds, tests or commands and implemented no code. The executor records per-TC evidence, exact commands, HEAD, and the pushed-HEAD CI result for `ts-test`/`ts-boundaries`/`ts-invariants`/`ts-aggregate`. Unrun evidence must never be recorded as passing. |
| TC-DB-037 — mandatory read-only real-store smoke | — | Planned (non-CI, required before PR) | Run `db size` and `db list --limit 5` against the real opencode store read-only; record commands, exit codes, bounded output, and before/after database/WAL/SHM bytes and row counts showing no mutation. |
| TC-DB-037 — reference latency measurement | — | Optional (non-CI, not a pass gate) | Record environment, date and median timings for `db size`, `db list --limit 100`, prune selection, one re-check, `db reboot` live check and a disposable-copy 500-candidate apply; or record "not run". NFR-D4 remains a target. |
| TC-DB-038 — PR-body checklist | — | Planned (manual, non-CI) | Record the PR URL, the open/not-merged state, and the C-11 sign-off, activity-based-liveness, reboot-deviation and external-surface statements. |
