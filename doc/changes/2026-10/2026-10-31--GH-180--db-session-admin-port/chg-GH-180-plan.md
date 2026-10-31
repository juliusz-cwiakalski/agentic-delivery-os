---
id: chg-GH-180-db-session-admin-port
status: Updated
created: 2026-10-31T21:10:00Z
last_updated: 2026-10-31T23:10:00Z
owners: [engineering]
service: delivery-os CLI session-database administration
labels: [change, planning]
links:
  change_spec: ./chg-GH-180-spec.md
  test_plan: ./chg-GH-180-test-plan.md
  adr_refs:
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
  related:
    - ../../../spec/features/feature-adapter-ports.md
    - ../../../spec/features/feature-result-contract.md
    - ../../../spec/features/feature-monorepo-scaffold-toolchain.md
    - ../../../spec/features/feature-state-layer.md
    - ../../../spec/features/feature-status-digest.md
    - ../../../planning/oss-tooling/cli-command-registry.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
summary: >-
  Deliver M0-S11 per spec v1.5 and test plan v1.4: the `ados db` session-admin port with exactly
  four metadata-only subcommands (`size`, `list`, `prune`, `reboot`), dry-run
  defaults, `--apply`-only mutation, the pinned 15-minute live window, the
  30-day default prune threshold, bounded list and prune limits, leaf-only
  selection, a per-candidate TOCTOU re-check, one official `opencode session
  delete` per candidate, partial-failure truthfulness, one bounded
  `PRAGMA wal_checkpoint(TRUNCATE)` on `reboot --apply` with no live session,
  no process kill, no sidecar deletion, no direct SQLite binding, the four
  `db.*` error identities with bidirectional documented sync, and a
  metadata-only output whitelist proven by canary and mutant controls.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-180: M0-S11: db session-admin port

## Context and Goals

- **Work item**: GH-180 — M0-S11: db session-admin port.
- **Inputs (authoritative, read in full by this pass)**:
  - [chg-GH-180-spec.md](./chg-GH-180-spec.md) — **v1.5** (2026-10-31): 18 ACs (AC-D1..AC-D18), F-D1..F-D7, DM-D1..DM-D8, NFR-D1..NFR-D10, DEC-D1..DEC-D11, RSK-D1..RSK-D14, §3.1/§3.8/AC-D12 two-class grammar with repeated-flag last-wins, §3.3 pinned item field sources (`createdAt = time_created`, `updatedAt = time_updated`, `parentId = parent_id`, `archived = time_archived IS NOT NULL`), §3.3/§4.6 byte-exact `dataBytes` (`LENGTH(CAST(... AS BLOB))`), §3.4/§3.8 post-land partial-abort truthfulness, §3.10 pinned constants, §4.1 architecture, §4.6 current `message`/`part` store, §5 boundaries, §7 QA strategy, §7.3 scoped baseline repair, RSK-D14 stale `session_message` system-doc drift.
  - [chg-GH-180-test-plan.md](./chg-GH-180-test-plan.md) — **v1.4** (2026-10-31): 38 TCs (`TC-DB-001..TC-DB-038`), the nine named suites, grammar matrix G-01..G-13 (G-12 last-wins acceptance) and P-01..P-04, boundary matrix B-01..B-16, numeric-range matrix, id-shape/SQL-discipline matrix, textual SQL-predicate assertions, byte-exact `dataBytes` and field-source oracles, fixtures/fakes, mandatory non-CI read-only real-store smoke, and the remaining non-CI gaps (NFR-D4 reference measurement; the PR-body half of AC-D18).
  - [chg-GH-180-pm-notes.yaml](./chg-GH-180-pm-notes.yaml) — PM decisions, the missing-prototype fallback, live read-only environment facts, and standing delivery rules.
  - [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, injected time/environment, runtime-API confinement, result/error contract, fake-based deterministic tests.
  - [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, suite layout, `pnpm check`, tree invariants, no moving-base diffs.
- **Status**: change Proposed (awaiting the Definition of Ready gate, lifecycle phase 5); this plan is at revision 1.3 (Updated for the DoR iteration-2 delivery-planning findings).
- **Baseline**: branch `feat/GH-180/db-session-admin-port` cut from `origin/main-tools` at `7155074`, then merged with `origin/main-tools` at `b31ec47` (159 files, no conflicts). The delivery start HEAD is `f5c4d36`; the authoritative inputs are spec v1.5 and test plan v1.4. The PR base is `main-tools`.
- **Resolved grammar contradiction (do not reopen)**: the shared parser (`packages/cli/src/index.ts`) recognizes only `--`-prefixed tokens as flags and is consumed unchanged. A single-dash token is a positional: `db size -x` reaches the handler and is `input.value.rejected` at exit 1. An undeclared `--` token is parser containment: `db size --x` is `fallback.invocation` at exit 1. Both classes perform zero I/O and zero mutations. The plan implements exactly this split and does not modify the parser.
- **No blocking spec/test-plan inconsistency remains.** The delivery-bound spellings left open by GAP-T4/A-T1/A-T5/OQ-T1/OQ-T2/OQ-T4 are pinned in this plan. No AC, TC, assertion, identity, shape, exit, or NFR is reshaped.
- **Error-identity conformance (resolved; additive test update only)**: all four `db.*` identities — `db.opencode.unavailable`, `db.query.failed`, `db.delete.failed`, and `db.reboot.live` — match the repository error-code format `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$`. The format is not widened and `scripts/checks/error-table-sync.ts` stays unchanged. `tests/structure/error-table.test.ts` cannot stay byte-identical: it asserts exactly 31 `ERROR_TABLE` entries and the exact declared-kind prose, so Phase 1 edits it additively — the count becomes 35, the declared-kind prose now includes `db`, and the `db` row/kind-only containment assertions are added while every existing assertion is preserved (PIN-11). The Phase 1 error work is `packages/core/src/contracts/error-table.ts`, the documented table in `doc/spec/features/feature-result-contract.md`, the new contract test (TC-DB-001 and the automated half of TC-DB-038), the additive `tests/structure/error-table.test.ts` update (TC-DB-003), the `db` cases in `tests/behaviour/error-classification.test.ts` (TC-DB-005), and the `db` drift controls in the existing TC-DB-004 sync-test suite.

**Goals**: make `ados db` the only typed product-code path to the opencode session database; report bounded metadata-only size/list facts from an injected clock; prune only cold, non-live, leaf sessions through the official delete command with dry-run defaults, idempotency, TOCTOU safety, and truthful partial-failure reporting; prepare the database for a manual host restart with one bounded checkpoint and no process or sidecar action; keep every failure classified; and keep the aggregate gate deterministic in a clean checkout.

**Delivery model**: `@coder` executes Phases 1–5 in order in one `/run-plan GH-180 execute all remaining phases no review` run, each phase ending in exactly one Conventional Commit and a green phase gate. `@coder` cannot dispatch subagents; committer and runner discipline are inline. Dependency order: **1 → 2 → 3 → 4 → 5**. Phase 1 repairs the scoped baseline first, then lands the full contract vocabulary, pure policy, error rows, additive error-table test updates, and the port-contract inventory fixture so later phases consume one vocabulary home. Phase 2 adds the read-only adapter. Phase 3 adds prune/reboot mutation. Phase 4 adds the CLI surface and edge composition. Phase 5 verifies the baseline, completes the oracles, runs the mandatory non-CI real-store smoke and the full merge-blocking CI battery, and records evidence.

## Pinned Delivery Decisions (PIN-1..PIN-11)

These pins resolve the delivery-bound spellings only. Every pinned constant value, identity, shape, bound, exit, and AC/TC mapping comes from the spec and test plan and may not change. Changing a pin later reopens this plan; route a challenge through PM/`@decision-advisor`, never apply it silently.

### PIN-1 — Core contract module (`packages/core/src/contracts/session.ts`, new, data and types only)

Exported constants (exact names and values):

| Constant | Value |
|---|---|
| `DB_SCHEMA_VERSION` | `"delivery.session-admin.v1"` |
| `DB_COMMANDS` | `["size", "list", "prune", "reboot"] as const` |
| `DB_MODES` | `["dry-run", "applied"] as const` |
| `DB_LIVE_WINDOW_MINUTES` | `15` |
| `DB_DEFAULT_OLDER_THAN_DAYS` | `30` |
| `DB_MIN_OLDER_THAN_DAYS` | `1` |
| `DB_MAX_OLDER_THAN_DAYS` | `3650` |
| `DB_DEFAULT_LIST_LIMIT` | `20` |
| `DB_MAX_LIST_LIMIT` | `100` |
| `DB_DEFAULT_PRUNE_LIMIT` | `50` |
| `DB_MAX_PRUNE_LIMIT` | `500` |
| `DB_MIN_LIMIT` | `1` |
| `DB_MAX_ID_CHARS` | `128` |
| `DB_MAX_TIMESTAMP_CHARS` | `32` |
| `DB_MAX_PATH_CHARS` | `1024` |
| `DB_MAX_HUMAN_ITEMS` | `32` |
| `DB_MAX_HUMAN_LINES` | `40` |
| `DB_MAX_HUMAN_BYTES` | `8192` |
| `DB_MAX_MACHINE_BYTES` | `524288` |
| `DB_SESSION_ID_PATTERN` | `"^[A-Za-z0-9_-]+$"` |
| `DB_QUERY_TIMEOUT_MS` | `30000` |
| `DB_DELETE_TIMEOUT_MS` | `30000` |
| `DB_CHECKPOINT_TIMEOUT_MS` | `120000` |

Exported types (exact names): `DbCommand`, `DbMode`, `DbDatabaseFacts`, `DbCounts`, `SessionSummary`, `SizeData`, `ListData`, `PruneData`, `RebootData`, `SessionSizeRead`, `SessionListRead`, `SessionPruneRead`, `SessionRebootRead`, `SessionAdminError`, `SessionAdminResult`, `SessionStorePort`, `SessionAdminPort`.

- `SessionStorePort` declares exactly `size(): Promise<SessionSizeRead>` and `list(input: { readonly limit: number; readonly nowMs: number }): Promise<SessionListRead>`.
- `SessionAdminPort extends SessionStorePort` and adds exactly `prune(input: { readonly olderThanDays: number; readonly limit: number; readonly apply: boolean; readonly nowMs: number }): Promise<SessionPruneRead>` and `reboot(input: { readonly apply: boolean; readonly nowMs: number }): Promise<SessionRebootRead>`.
- Each read is `SessionAdminResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: SessionAdminError }`; `SessionAdminError` carries one declared `db.*` code plus the bounded summary/fields the adapter needs.
- `SessionSummary` keys: `id`, optional `parentId` (absent, never `undefined`), `createdAt`, `updatedAt`, `messageCount`, `partCount`, `dataBytes`, `archived`, `live`.
- The file is declaration-only: types, interfaces, `import type`, `export`, and `as const` data. Zero functions, zero calls, zero `new`, zero clock/randomness/environment. Re-export through `contracts/index.ts`.

### PIN-2 — Pure policy module (`packages/core/src/domain/session-admin.ts`, new)

Exported pure functions only:

- `computeDbCutoffMs(nowMs: number, olderThanDays: number): number` — `nowMs - olderThanDays * 86_400_000`.
- `computeDbLiveBoundaryMs(nowMs: number): number` — `nowMs - DB_LIVE_WINDOW_MINUTES * 60_000`.
- `isLiveDbSession(updatedAtMs: number, nowMs: number): boolean` — inclusive at the lower boundary (`updatedAtMs >= liveBoundary`).
- `classifyPruneCandidate(fact: PruneCandidateFact, input: { readonly nowMs: number; readonly olderThanDays: number }): PruneCandidateDecision` — decision order `live` first, then `warm`, then `parent`; `eligible` only when all three conditions pass.
- `selectPruneCandidates(facts: readonly PruneCandidateFact[], input: { readonly nowMs: number; readonly olderThanDays: number; readonly limit: number }): readonly PruneCandidateFact[]` — filters eligible facts, orders oldest-first by `updatedAtMs` then `id` ascending, and caps at `limit`.
- `renderSessionAdminHuman(data: SizeData | ListData | PruneData | RebootData, brand: BrandIdentity): string` — deterministic human text from data and the injected brand only; no extra reads.

`PruneCandidateFact` carries `id`, `updatedAtMs`, `hasChildren`, and the `SessionSummary` fields needed for rendering; `PruneCandidateDecision` is `{ readonly eligible: true } | { readonly eligible: false; readonly reason: "live" | "warm" | "parent" }`. The same `classifyPruneCandidate` is used for selection interpretation and the pre-delete re-check; no duplicate inline predicate is allowed. The module imports only `#contracts` and relative domain/contracts modules; no `node:*`, `bun:*`, adapter, CLI, clock, randomness, environment, or I/O.

### PIN-3 — Adapter seam (`packages/adapters/src/session/index.ts`, implemented)

The types-only stub is replaced. Exact exports:

- `type OpencodeSessionIo` — the single injected seam, adapter-local, never a core contract. Members exactly: `databasePath(): Promise<string>`, `query(sql: string): Promise<readonly Record<string, unknown>[]>`, `deleteSession(id: string): Promise<void>`, `checkpoint(): Promise<void>`, `now(): number`, `stat(path: string): Promise<{ readonly bytes: number; readonly present: boolean }>`, plus readonly `command: string` and readonly `environment: Readonly<Record<string, string | undefined>>`.
- `createOpencodeSessionIo(input: { readonly command: string; readonly environment: Readonly<Record<string, string | undefined>>; readonly now: () => number }): OpencodeSessionIo` — production implementation.
- `createSessionStore(io: OpencodeSessionIo): SessionStorePort`.
- `createSessionAdmin(io: OpencodeSessionIo): SessionAdminPort`.

Production I/O rules:

- `node:child_process` and `node:fs` are allowed only in this file among the files this change introduces. Use `execFile` with an argv array and `shell: false`; never `exec`, never a shell string. No `process.env` read: `command` and `environment` are injected data.
- `databasePath()` invokes `opencode db path`, trims one trailing newline, and returns the path.
- `query(sql)` invokes exactly one `opencode db SQL --format json` call per statement, parses stdout as a JSON array, and never batches statements. Malformed JSON, a non-array body, or a non-zero exit is `db.query.failed`.
- `deleteSession(id)` invokes exactly one `opencode session delete sessionID` call.
- `checkpoint()` invokes exactly one `opencode db "PRAGMA wal_checkpoint(TRUNCATE)"` call.
- `stat(path)` is a read-only metadata read of the database, `-wal`, and `-shm`; absence returns `{ bytes: 0, present: false }`, a real zero-byte file returns `{ bytes: 0, present: true }`.
- The adapter imports only `@delivery-os/core/contracts` and its own modules. No new package, subpath, dependency, or runtime-API location.

### PIN-4 — Failure mapping, absence, and partial-failure truth

- `databasePath()` spawn failure (`ENOENT`), non-zero exit, or an absent/unreadable database path → `db.opencode.unavailable`.
- `query()` spawn failure → `db.opencode.unavailable`; non-zero exit, malformed JSON, or non-array body → `db.query.failed`.
- `deleteSession()` spawn failure → `db.opencode.unavailable`; non-zero exit → `db.delete.failed`, **unless** one bounded post-delete existence query by id returns zero rows, in which case that candidate is counted as `skipped` and the run continues (AC-D9). The post-delete query is a normal single-statement query; this does not add a seam member.
- `checkpoint()` spawn failure → `db.opencode.unavailable`; non-zero exit or malformed result → `db.query.failed`.
- A partial prune attempts every remaining candidate after a per-candidate delete failure, then returns `db.delete.failed` with the normative summary `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"`, where `attempted = landed + failed` and `<id>` is the first failed session identity. The failed row remains; a retry selects it again. Successful deletes are not listed as failures.
- **Pre-land failure:** a selection-time failure, or any `db.opencode.unavailable`/`db.query.failed` before any delete has landed, returns that identity (exit 2) and performs no deletes. **Post-land failure:** any aborting query, pre-delete re-read, post-delete existence-read, or availability failure after at least one delete has landed stops the run and returns `db.delete.failed` with the same normative partial-abort summary; candidates not reached are not counted as attempted and are selected again by the retry.

### PIN-5 — CLI command surface (`packages/cli/src/commands/db.ts`, new)

Exports:

- `type DbCommandRuntime` — exactly `size(): Promise<SessionSizeRead>`, `list(input: { readonly limit: number }): Promise<SessionListRead>`, `prune(input: { readonly olderThanDays: number; readonly limit: number; readonly apply: boolean }): Promise<SessionPruneRead>`, `reboot(input: { readonly apply: boolean }): Promise<SessionRebootRead>`.
- `createDbCommandDefinition(runtime: DbCommandRuntime): CommandDefinition` — the only exported executable.

Definition metadata (the parser is unchanged):

- `flags: ["--limit", "--older-than", "--apply"]`.
- **No `requiresValue` entries.** The handler owns value parsing so missing values (`list --limit`, `prune --older-than`) are handler rejections (`input.value.rejected`), not parser containments.
- `positionals: { max: 8 }` so the handler sees the subcommand and the flag values/stray tokens. Tokens beyond the bound stay on the parser's containment path.
- `humanText: (data, brand) => renderSessionAdminHuman(data as DbData, brand)`.

Handler grammar (before any runtime call):

1. `positionals[0]` is the subcommand; missing or not one of `size`, `list`, `prune`, `reboot` → `input.value.rejected`.
2. Reconstruct the flag/value sequence from `invocation.argv` (the parser already removed `--json` and collapsed flags): skip `argv[0]` (the `db` command token), treat `argv[1]` as the subcommand, and walk the remainder. Any token after the subcommand that is not a declared flag or its value → unexpected positional → `input.value.rejected`; this includes single-dash tokens such as `-x` and stray tokens such as `false` after `--apply`.
3. A declared value flag with no following non-flag token → missing value → `input.value.rejected`.
4. A flag not declared for the selected subcommand (`size --limit`, `list --older-than`, `reboot --limit`/`--older-than`) → `input.value.rejected`.
5. Repeated occurrences of the same flag are **last-wins**, not a rejection: `db` declares no parser `conflicts` pairs, so the shared parser overwrites the earlier value (`--apply --apply` is apply; `--limit 5 --limit 10` resolves to `limit 10`). The handler consumes the parser-resolved value and never re-scans raw argv to reject a repeat. This is G-12's exit-0 acceptance case (spec §3.1; test plan G-12/A-T3).
6. `--apply` must be a bare boolean token; a following stray value (`prune --apply false`) → `input.value.rejected`. `--apply=false` and `--limit=5` are undeclared exact tokens, so the parser contains them as `fallback.invocation` before the handler runs.
7. Numeric values must be base-10 integers in range: `list --limit` 1..100 (default 20), `prune --limit` 1..500 (default 50), `prune --older-than` 1..3650 (default 30). Empty, decimal, non-numeric, below-min, and above-max values → `input.value.rejected`.
8. Valid grammar calls the matching runtime method. The handler never writes a stream, never chooses an exit code, and never inspects `--json`.

Single-dash and undeclared-double-dash behavior is the pinned split: `db size -x` → handler `input.value.rejected`; `db size --x` → parser `fallback.invocation`; both exit 1 with zero runtime/IO calls.

### PIN-6 — Edge composition (`packages/cli/src/edge.ts`, extended)

- `type DbComposition = { readonly io: OpencodeSessionIo; readonly clock: { readonly nowMs: () => number } }`. Brand facts reach the renderer through the existing `humanText(data, brand)` hook supplied by `runCli`; the composition adds no ambient brand read.
- `createDbCommandRuntime(composition: DbComposition): DbCommandRuntime` builds `createSessionStore(composition.io)` and `createSessionAdmin(composition.io)`. `size`/`list` read the store port; `prune`/`reboot` read the admin port; every call passes `nowMs: composition.clock.nowMs()` at call time.
- `ConfigProgramOptions.db?: DbComposition`. Register `commands.db` only when `options.db !== undefined`, exactly like lint/phase/provider/status/verify. No bin entry, entry-point change, package export change, or new subpath.
- `packages/cli/src/commands/index.ts` exports `createDbCommandDefinition` and `type DbCommandRuntime`.

### PIN-7 — SQL, id, and bound discipline

- Every adapter query is one statement: no `;`, no `--` comment marker, no `/*`, no batching. The adapter issues exactly the read classes in spec §4.6: session count/min/max, message count over `message` (the current store; counts are `messages`), part count over `part` (the current store; counts are `parts`), one ordered list page deriving per-item `messageCount`/`partCount`/`dataBytes` over `message`/`part`, prune selection, one re-read per candidate, live-session count, and the post-delete existence read. `session_message` is the legacy/alternate store and is never counted or summed; it appears only as a legacy/not-counted/delete-cascade mention (RSK-D13).
- The prune selection SQL carries cold, not-live, and `NOT EXISTS` child predicates ordered oldest-first with an `id` tiebreak and a `LIMIT`. The pre-delete re-read carries the same cold and live predicates plus the child-existence clause; tests assert those textual predicates (TC-DB-018).
- No raw `DELETE`, `DROP`, `TRUNCATE`, `VACUUM`, `ALTER`, `CREATE`, or bulk `IN (...)` appears in adapter SQL. Deletes are per-candidate `deleteSession(id)`.
- Session ids are validated against `DB_SESSION_ID_PATTERN` before any SQL interpolation or command use; ids read from the database are re-validated before reuse. An invalid or over-cap id is `db.query.failed` naming the field, never truncated, and causes zero deletes.
- A database path over `DB_MAX_PATH_CHARS` is `db.query.failed` naming the field, never truncated.
- Numeric flags are range-rejected at the grammar and additionally clamped to their declared ranges before interpolation as a defence-in-depth invariant. A raw out-of-range value is never interpolated.
- The checkpoint statement is exactly `PRAGMA wal_checkpoint(TRUNCATE)`, issued at most once per `reboot --apply`.

### PIN-8 — Human rendering

- `renderSessionAdminHuman` is pure and consumes only the data and the injected brand. It emits the spec §3.7 grammar, including the mode/state on every line, sidecar `present|absent`, `+N more` when items are unrendered, and the exact reboot sentence: `restart the opencode host manually; this command only prepares the database`.
- Caps: at most `DB_MAX_HUMAN_ITEMS` item lines, `DB_MAX_HUMAN_LINES` lines, and `DB_MAX_HUMAN_BYTES` bytes. `+N more` counts the items the reader did not see (`rendered + N = total` for list; `rendered + N = candidates.length` for prune), not only the data's `omitted`.
- Machine mode is exactly one standard `CommandResult` envelope; success has `data` and no `error`, failure has `error` and no `data`. `data.schemaVersion` is `DB_SCHEMA_VERSION`. The single serializer and redaction chokepoint remain the only write path.
- All timestamps are ISO-8601 UTC strings. The adapter converts epoch milliseconds once at the boundary; the renderer never reads the clock.

### PIN-9 — Test harness, fixtures, and hermeticity

- Fixtures live under `tests/fixtures/session-admin/`: `harness.ts` (fake `OpencodeSessionIo`, fake `DbCommandRuntime`, ordered call recorder, `runDbCli`, scripted responses, `fakeSetChildren`, `fakeRemoveRow`, `fakeFailDelete`), `store.ts` (`makeSession` builder over synthetic ids/counts/timestamps), `boundaries.ts` (B-01..B-16), `malformed.ts`, `ids.ts` (I-01..I-07), `canary.ts`, `golden/**`, and `mutants/**` (temp copies imported through file URLs).
- Fixed test time is `NOW_MS = Date.UTC(2026, 9, 31, 12, 0, 0)`; `newRunId` is a fixed sequence; the brand is `SYNTHETIC_BRAND` from `tests/golden/helpers.ts`; the synthetic database path is `/synthetic/harness/opencode/opencode.db`.
- No suite spawns opencode or any process, opens a SQLite file, reads `$HOME`/`os.homedir()`/`process.env`, uses the network, or imports `node:sqlite`/`bun:sqlite`/`better-sqlite3`. Tests inject the fake IO and never touch the real database, binary, home directory, or network.
- Every negative, skip, cap, and absence assertion has a live control in the same test: an included neighbour, a present sibling, a restored row, or a temp-copy mutant that must fail. No assertion uses a moving-base diff.
- Golden human output is committed, normalized (no absolute paths, no host timestamps), and changed only deliberately in Phase 4.

### PIN-10 — Housekeeping and release conventions

- `tests/structure/inventory.json` gains `core/src/contracts/session.ts` and `core/src/domain/session-admin.ts` in Phase 1, and `cli/src/commands/db.ts` in Phase 4; `adapters/src/session/index.ts` is already listed.
- `tests/structure/content-inventory.test.ts` gains each file's exact executable allowance in the phase that introduces the file (a `VariableStatement` or `FunctionDeclaration` export without an exact allowance fails the suite):
  - Phase 1 — `core/src/contracts/session.ts`: exactly the 23 exported `as const` values `DB_SCHEMA_VERSION`, `DB_COMMANDS`, `DB_MODES`, `DB_LIVE_WINDOW_MINUTES`, `DB_DEFAULT_OLDER_THAN_DAYS`, `DB_MIN_OLDER_THAN_DAYS`, `DB_MAX_OLDER_THAN_DAYS`, `DB_DEFAULT_LIST_LIMIT`, `DB_MAX_LIST_LIMIT`, `DB_DEFAULT_PRUNE_LIMIT`, `DB_MAX_PRUNE_LIMIT`, `DB_MIN_LIMIT`, `DB_MAX_ID_CHARS`, `DB_MAX_TIMESTAMP_CHARS`, `DB_MAX_PATH_CHARS`, `DB_MAX_HUMAN_ITEMS`, `DB_MAX_HUMAN_LINES`, `DB_MAX_HUMAN_BYTES`, `DB_MAX_MACHINE_BYTES`, `DB_SESSION_ID_PATTERN`, `DB_QUERY_TIMEOUT_MS`, `DB_DELETE_TIMEOUT_MS`, `DB_CHECKPOINT_TIMEOUT_MS`.
  - Phase 1 — `core/src/domain/session-admin.ts`: exactly `computeDbCutoffMs`, `computeDbLiveBoundaryMs`, `isLiveDbSession`, `classifyPruneCandidate`, `selectPruneCandidates`, `renderSessionAdminHuman`.
  - Phase 2 — `adapters/src/session/index.ts`: exactly `createOpencodeSessionIo`, `createSessionStore`, `createSessionAdmin`.
  - Phase 4 — `cli/src/commands/db.ts`: exactly `createDbCommandDefinition`; `cli/src/commands/index.ts` adds `createDbCommandDefinition`; `cli/src/edge.ts` adds `createDbCommandRuntime`.
- `tests/structure/cli-edge-seam.test.ts` adds `db.ts` to the exit-decision scan and command-export assertions; the human-text declarer assertion (`:415-418`) is extended, never removed, to exactly `["packages/cli/src/commands/db.ts", "packages/cli/src/commands/status.ts"]` — the sorted full paths produced by `listTypeScriptFiles` over `packages/cli/src/commands`, written as `` [`${CLI_DIR}/commands/db.ts`, `${CLI_DIR}/commands/status.ts`] `` with `CLI_DIR = "packages/cli/src"`.
- Phase 1 repairs `tests/checks/config-default-positions.test.ts` with the `mkdirSync` import and exactly one `mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true })` before the first `mkdtempSync`; no assertion, fixture, or behaviour changes. Phase 5 verifies only.
- `.changeset/db-session-admin-minor.md` follows the repo's `fixed` group convention and lists all five locked packages (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`) at `minor`, even though only core, adapters, and cli change. No lockfile change and no version field is hand-bumped.
- Phase 5 authors `chg-GH-180-evidence.md` in this folder with per-phase commits, gate results, TC coverage, the mandatory non-CI real-store smoke record, the non-CI notes, and rollback instructions.

### PIN-11 — Error-identity conformance (additive test update; no gate weakening)

All four `db.*` identities — `db.opencode.unavailable`, `db.query.failed`, `db.delete.failed`, and `db.reboot.live` — conform to the repository error-code format `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$`: three lowercase-and-digit segments, each starting with a letter. `scripts/checks/error-table-sync.ts` stays unchanged and the error-code format is not widened; no exact-code exception is added for any identity.

`tests/structure/error-table.test.ts` cannot stay byte-identical because it asserts the exact entry count and the exact declared-kind prose. Phase 1 edits it **additively**:

- `ERROR_TABLE` count assertion `31` → `35`.
- The declared-kind prose assertion now includes `db` (the documented sentence names `provider`, `input`, `config`, `state`, `lint`, `verify`, and `db`).
- `db` row-shape and kind-only containment assertions are added, aligned with the four exact rows.
- Every existing assertion is preserved; none is removed, relaxed, or re-baselined.

The Phase 1 error work is `packages/core/src/contracts/error-table.ts` (`db` in `DOMAIN_KINDS` plus the four rows), the documented table in `doc/spec/features/feature-result-contract.md`, the new `tests/structure/session-admin-contract.test.ts` assertions (TC-DB-001 and the automated half of TC-DB-038), the additive `tests/structure/error-table.test.ts` update (TC-DB-003), the `db` cases in `tests/behaviour/error-classification.test.ts` (TC-DB-005), and the `db` drift controls in `tests/checks/error-table-sync.test.ts` (TC-DB-004). An identity that does not match the format is escalated through PM/`@decision-advisor` before Phase 1.

## Delivery Bindings (D1..D11)

- **D1 — Module layout**: new `packages/core/src/contracts/session.ts`, `packages/core/src/domain/session-admin.ts`, `packages/cli/src/commands/db.ts`; extended `contracts/index.ts`, `domain/index.ts`, `packages/core/src/index.ts` (domain re-export), `error-table.ts`, `packages/adapters/src/session/index.ts`, `commands/index.ts`, `edge.ts`, and the test/doc files named in the phases. No new package, subpath, dependency, lockfile entry, or runtime-API location.
- **D2 — Same-phase error rows**: `db` joins `DOMAIN_KINDS`, the four rows land in `ERROR_TABLE` and in the documented table at `doc/spec/features/feature-result-contract.md` in Phase 1, so `scripts/checks/error-table-sync.ts` is green in both directions from the first phase boundary. The documented table section is never rewritten by later phases.
- **D3 — Adapter-only I/O**: `node:child_process`/`node:fs` exist only in `packages/adapters/src/session/index.ts` among the new files. Core contracts are data-only; the core domain is pure; the CLI handler performs no I/O, stream write, or exit decision.
- **D4 — One surface, one composition**: the CLI edge composes `commands.db` only with `options.db`; absent composition leaves `db` unregistered and `db size` returns `fallback.invocation` at exit 1. No bin entry or package export changes.
- **D5 — One predicate**: `classifyPruneCandidate` is the only cold/live/leaf predicate. The adapter imports it for selection and the pre-delete re-check and contains no duplicate inline `parent_id` comparison.
- **D6 — Hermetic, deterministic tests**: the in-process fake-IO contract (test plan §4.1) and non-vacuity contract (§4.2) bind every suite. Time, ids, brand, environment, and executable are injected. No real process, database, home directory, network, or wall clock for correctness.
- **D7 — Inline committer protocol**: exactly one Conventional Commit per phase with the completion signal below; explicit `git add` of only that phase's files; verify the staged set with `git status --porcelain`; never stage `.ai/local/**`, `tmp/**`, or untracked scratch; `pnpm check` green before each commit with the log captured under `.ai/local/` (never staged); no push, no amend, no subagent dispatch.
- **D8 — Inventory and surface registration**: every new source file registers in `tests/structure/inventory.json` and gains its exact per-file executable allowance in `tests/structure/content-inventory.test.ts` in the phase that introduces it (Phase 1 contracts/domain, Phase 2 adapter, Phase 4 `db` command and edge); nothing is deferred to Phase 5; the CLI seam suite's human-text declaration assertion is extended to the exact new set; no speculative entries.
- **D9 — No new CI/gate surface**: new suites are discovered by root `bun test`; existing boundary, ambient, literal, entrypoint, error-table, and secret-read checks extend automatically to the new paths. No new CI job, no gate weakening, no change to the bash stack, `.opencode/**`, the generated Claude plugin, or CI topology.
- **D10 — Evidence honesty and no merge**: Phase 5 records only executed evidence with command and HEAD. The non-CI reference measurement (NFR-D4) and the PR-body half of AC-D18 are recorded as deferred/not run, never as passing. `@coder` does not create a PR, push, merge, or claim owner approval; the ADR-0003 C-11 sign-off remains an owner merge gate.
- **D11 — Error-identity conformance, additive test update only**: all four `db.*` identities (`db.opencode.unavailable`, `db.query.failed`, `db.delete.failed`, `db.reboot.live`) match the repository error-code format `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$`, so `scripts/checks/error-table-sync.ts` stays unchanged and the error-code format is not widened. `tests/structure/error-table.test.ts` is edited additively (31 → 35 entries, `db` in the declared-kind prose, `db` row/containment assertions) because it asserts the exact count and prose. Only `packages/core/src/contracts/error-table.ts` and the documented table in `doc/spec/features/feature-result-contract.md` carry the four rows.

## File and Module Layout

| Path | Status | Role |
|---|---|---|
| `packages/core/src/contracts/session.ts` | New | PIN-1 vocabulary, data shapes, ports; declaration-only. |
| `packages/core/src/contracts/index.ts` | Extended | Re-export the session contract. |
| `packages/core/src/contracts/error-table.ts` | Extended | `db` in `DOMAIN_KINDS`; four exact rows. |
| `packages/core/src/domain/session-admin.ts` | New | PIN-2 pure cutoff/live/candidate/order/cap/renderer. |
| `packages/core/src/domain/index.ts` | Extended | Re-export the policy and renderer. |
| `packages/core/src/index.ts` | Extended | Re-export the domain policy/renderer for the CLI. |
| `packages/adapters/src/session/index.ts` | Implemented | PIN-3 `OpencodeSessionIo` + store/admin implementations; the only new I/O location. |
| `packages/cli/src/commands/db.ts` | New | PIN-5 grammar, runtime type, definition, human renderer wiring. |
| `packages/cli/src/commands/index.ts` | Extended | Export the db definition and runtime type. |
| `packages/cli/src/edge.ts` | Extended | PIN-6 `DbComposition`, `createDbCommandRuntime`, conditional registration. |
| `packages/cli/src/index.ts` | Consumed, unchanged | Parser and `{0,1,2}` projection chain. |
| `packages/cli/src/classify.ts`, `projection.ts`, `output/` | Consumed, unchanged | Classification, projection, serializer, redaction. |
| `doc/spec/features/feature-result-contract.md` | Updated in Phase 1 | `db` kind prose and four documented rows; binding sync fixture. |
| `tests/fixtures/session-admin/**` | New | PIN-9 fake IO, store, boundaries, malformed, ids, canary, goldens, mutants. |
| `tests/structure/session-admin-contract.test.ts` | New | TC-DB-001 and the automated in-tree half of TC-DB-038. |
| `tests/structure/session-admin-imports.test.ts` | New | TC-DB-002, TC-DB-016/033 static halves, TC-DB-036. |
| `tests/behaviour/session-admin-size-list.test.ts` | New | TC-DB-006..009, TC-DB-037 size/list halves. |
| `tests/behaviour/session-admin-prune.test.ts` | New | TC-DB-011..022, TC-DB-037 prune half. |
| `tests/behaviour/session-admin-reboot.test.ts` | New | TC-DB-031..033, TC-DB-037 reboot half. |
| `tests/behaviour/session-admin-grammar.test.ts` | New | TC-DB-023..025. |
| `tests/behaviour/session-admin-output.test.ts` | New | TC-DB-028..030, TC-DB-020/033 output halves. |
| `tests/behaviour/session-admin-sql-safety.test.ts` | New | TC-DB-025 clamp half, TC-DB-026, TC-DB-027, TC-DB-015 SQL half. |
| `tests/behaviour/session-admin-privacy.test.ts` | New | TC-DB-010, TC-DB-029, TC-DB-036 privacy half. |
| `tests/structure/error-table.test.ts` | Updated in Phase 1 (additive) | Generic format rule and row-shape loop preserved; `ERROR_TABLE` count 31 → 35, declared-kind prose includes `db`, and `db` row/kind-only containment assertions are added (PIN-11). |
| `tests/behaviour/error-classification.test.ts` | Updated in Phase 1 | TC-DB-005 (A-T7): `db` kind-only containment, wrong-code/exact-code classifiers, and the first-row-selecting control; every existing `TC-CLASSIFY-*`/`TC-CONFIG-*`/`TC-STATE-*` assertion preserved. |
| `tests/checks/error-table-sync.test.ts` | Updated in Phase 1 | TC-DB-004: the three `DOMAIN_KINDS` replacement literals (`:400`, `:485`, `:959`) move to the seven-kind array, and the `db` machine/doc drift mutations with fail-closed controls are added. |
| `tests/structure/cli-edge-seam.test.ts` | Updated in Phase 4 | TC-DB-034; human-text declarer full-path pair and exit-decision scan. |
| `tests/checks/config-default-positions.test.ts` | Repaired in Phase 1; verified in Phase 5 | TC-DB-035; test-only parent-directory creation makes every phase gate deterministic in a clean checkout. |
| `tests/fixtures/ports/v1-contract-inventory.json` | Updated in Phase 1 | `session.ts` module entry with every exported name plus the re-exported `session` names on the `contracts/index.ts` entry (B3). |
| `tests/structure/port-contract-inventory.test.ts` | Consumed, unchanged | TC-PORT-001 exact-surface fixture comparison; passes once the fixture entry is added. |
| `tests/structure/inventory.json` | Updated in Phases 1, 2, 4 | New source files registered in the phase that introduces them. |
| `tests/structure/content-inventory.test.ts` | Updated in Phases 1, 2, 4 | Per-file executable allowances in the phase that introduces each file. |
| `.changeset/db-session-admin-minor.md` | New | Fixed-group minor changeset. |
| `chg-GH-180-evidence.md` | New in Phase 5 | Execution evidence, mandatory non-CI real-store smoke record, deferred non-CI notes, rollback. |

## Traceability and Coverage: All 38 TCs to Phases

All 38 TCs are mapped; none is orphaned. "Primary phase" is where the TC is implemented and first asserted; a parenthesized phase names a later completion half where the same TC spans an adapter and the CLI surface. "Suite" names the spec §7.1 target file.

| TC ID | Scenario (abbreviated) | AC | Primary phase(s) | Suite |
|---|---|---|---|---|
| TC-DB-001 | Contract vocabulary, constants, data-only contracts, port split | AC-D16, AC-D1 | 1 | `tests/structure/session-admin-contract.test.ts` |
| TC-DB-002 | Tier, purity, runtime confinement, no SQLite, allowlist unchanged | AC-D16, NFR-D9 | 1 (complete 5) | `tests/structure/session-admin-imports.test.ts`, boundary checks |
| TC-DB-003 | Four `db` error identities round-trip | AC-D15, NFR-D7 | 1 | `tests/structure/error-table.test.ts` |
| TC-DB-004 | Bidirectional documented-table synchronization | AC-D15, NFR-D7 | 1 | `tests/checks/error-table-sync.test.ts` |
| TC-DB-005 | Kind-only `db` containment and wrong-code classification | AC-D15, NFR-D7 | 1 | `tests/behaviour/error-classification.test.ts` |
| TC-DB-006 | Size metadata and runtime path with zero mutations | AC-D1, DM-D1 | 2 (command replay 4) | `tests/behaviour/session-admin-size-list.test.ts` |
| TC-DB-007 | Empty store, absent sidecars, real zero-byte sidecar | AC-D1, NFR-D10 | 2 (command replay 4) | same |
| TC-DB-008 | List ordering, caps, totals, exact item shape | AC-D2, DM-D2 | 2 (command replay 4) | same |
| TC-DB-009 | Live classification at the boundary and the empty page | AC-D2 | 2 (command replay 4) | same |
| TC-DB-010 | Port surfaces, fake conformance, read-only store | AC-D14, AC-D16, NFR-D6 | 2 | `tests/behaviour/session-admin-privacy.test.ts` |
| TC-DB-011 | Prune dry-run zero mutations, identical replay | AC-D3, NFR-D3 | 3 (envelope 4) | `tests/behaviour/session-admin-prune.test.ts` |
| TC-DB-012 | Cold boundary selection | AC-D4 | 3 | same |
| TC-DB-013 | Live window and leaf-only selection | AC-D4 | 3 | same + size-list |
| TC-DB-014 | Oldest-first ordering, id tiebreak, cap | AC-D4 | 3 | same |
| TC-DB-015 | Apply deletes only through the official command | AC-D5 | 3 (SQL half 4) | same + sql-safety |
| TC-DB-016 | No database, WAL, or SHM file is touched | AC-D5, AC-D11, NFR-D3 | 3 (static half 2/5) | same + reboot + imports |
| TC-DB-017 | Idempotent re-run and post-apply dry-run | AC-D6, NFR-D3 | 3 | prune |
| TC-DB-018 | TOCTOU: candidate gains a child, skipped | AC-D7 | 3 | prune |
| TC-DB-019 | Row vanishes before the re-read, skipped | AC-D7, AC-D9 | 3 | prune |
| TC-DB-020 | Partial failure reported; retry converges | AC-D8, NFR-D10 | 3 (envelope 4) | prune + output |
| TC-DB-021 | Already-absent row at delete is a skip | AC-D9, NFR-D10 | 3 | prune |
| TC-DB-022 | Abort on unavailable or failed query, never success | AC-D8, AC-D15 | 3 (envelope 4) | prune |
| TC-DB-023 | Grammar rejection matrix before I/O | AC-D12, NFR-D8 | 4 | `tests/behaviour/session-admin-grammar.test.ts` |
| TC-DB-024 | Parser containment carve-out at exit 1 | AC-D12 | 4 | same |
| TC-DB-025 | Numeric flag ranges and defensive clamp | AC-D13, NFR-D8 | 4 | grammar + sql-safety |
| TC-DB-026 | Id shapes, injection attempts, over-cap identities | AC-D13, AC-D14, NFR-D8 | 4 | sql-safety |
| TC-DB-027 | Single-statement SQL discipline and no raw delete | AC-D13, AC-D5, NFR-D8 | 4 | sql-safety |
| TC-DB-028 | Envelope validity, schema version, machine/human caps | AC-D14, NFR-D2 | 4 | output + goldens |
| TC-DB-029 | Metadata-only whitelist, canary, mutation sensitivity | AC-D14, NFR-D6 | 4 | privacy |
| TC-DB-030 | Byte-identical replays and zero ambient reads | AC-D2, AC-D3, AC-D14, NFR-D1 | 4 | output |
| TC-DB-031 | Reboot dry-run plan and live gate on apply | AC-D10, DM-D4 | 3 (envelope 4) | `tests/behaviour/session-admin-reboot.test.ts` |
| TC-DB-032 | Reboot apply: exactly one bounded checkpoint | AC-D10, DM-D4 | 3 (envelope 4) | same |
| TC-DB-033 | Reboot never kills a process or deletes a sidecar | AC-D11, NFR-D3, NFR-D10 | 3 (human text 4) | same + output + imports |
| TC-DB-034 | Composition-absent non-registration and present registration | AC-D16, NFR-D9 | 4 | `tests/structure/cli-edge-seam.test.ts` |
| TC-DB-035 | Scoped baseline repair for defaults-position tests | AC-D17 | 1 (verify 5) | `tests/checks/config-default-positions.test.ts` |
| TC-DB-036 | Hermeticity and no-real-home-path scan | AC-D17, NFR-D5, NFR-D1 | 5 (scaffold 2/4) | imports + privacy |
| TC-DB-037 | Bounded-work oracle and non-CI reference measurement | AC-D1, AC-D2, AC-D3, AC-D17 (NFR-D4) | 5 (size/prune/reboot halves 2–3) | size-list + prune + reboot + contract |
| TC-DB-038 | C-11 sign-off recorded as an owner merge gate | AC-D18, RSK-D9 | 1 (automated half), 5 (evidence) | contract + evidence |

**Coverage count**: 38/38 TCs mapped; 18/18 ACs covered; 0 orphan TCs. TC-DB-035's repair is implemented in Phase 1 and only verified in Phase 5, so every Phase 1–4 `pnpm check` is deterministic in a clean checkout. TC-DB-003 is asserted in the additively updated `tests/structure/error-table.test.ts` (31 → 35 entries, `db` prose, `db` rows); TC-DB-005 is asserted in the extended `tests/behaviour/error-classification.test.ts` (A-T7), and TC-DB-004's sync suite updates only its three `DOMAIN_KINDS` search literals and adds the `db` drift controls. TC-DB-037's mandatory read-only real-store smoke and the TC-DB-038 PR body are recorded as non-CI/deferred, never as passing.

## Phases

### Phase 1: Baseline repair, core contracts, pure policy, error identities, documented rows

**Goal**: Repair the scoped defaults-position baseline first so every phase gate is deterministic in a clean checkout, then land the complete `delivery.session-admin.v1` vocabulary, the pure policy/renderer, the four `db` error rows with the documented table synchronized in the same phase, the additive `error-table.test.ts` update plus the three `DOMAIN_KINDS` literal-control updates in the sync suite, and the port-contract inventory fixture, so every later phase consumes one vocabulary home and the bidirectional sync gate is green from the first commit boundary.

**Tasks**:

- [x] **1.1** **First task — repair the scoped baseline** `tests/checks/config-default-positions.test.ts` (TC-DB-035, DEC-D11): add `mkdirSync` to the `node:fs` import and exactly one `mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true })` before the first `mkdtempSync`. No assertion, fixture, or behaviour change. Prove in a temp root that the absent parent throws `ENOENT` and the repaired parent succeeds idempotently twice. This makes every Phase 1–4 `pnpm check` deterministic in a clean checkout; Phase 5 verifies only. — done: `mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true })` before the first `mkdtempSync`; focused suite green.
- [x] **1.2** Author `packages/core/src/contracts/session.ts` (PIN-1): all constants, command/mode sets, data shapes, `SessionStorePort`/`SessionAdminPort`, and read/error types. Declaration-only; re-export through `contracts/index.ts`; register `core/src/contracts/session.ts` in `tests/structure/inventory.json` and add the Phase 1 content-inventory allowance for exactly the 23 exported `as const` constants listed in PIN-10. — done: 23 constants + data shapes + ports; inventory and content-inventory allowance added.
- [x] **1.3** Author `packages/core/src/domain/session-admin.ts` (PIN-2): cutoff, live boundary, `isLiveDbSession`, `classifyPruneCandidate` (order `live` → `warm` → `parent`), `selectPruneCandidates` (oldest-first then `id`, cap), and `renderSessionAdminHuman`. Re-export through `domain/index.ts` and `packages/core/src/index.ts`; register `core/src/domain/session-admin.ts` in inventory and add the Phase 1 content-inventory allowance for exactly `computeDbCutoffMs`, `computeDbLiveBoundaryMs`, `isLiveDbSession`, `classifyPruneCandidate`, `selectPruneCandidates`, `renderSessionAdminHuman`. — done: cutoff/live/classify/select/render; re-exported through domain and core.
- [x] **1.4** Extend `packages/core/src/contracts/error-table.ts`: append `"db"` to `DOMAIN_KINDS` and exactly four rows. Existing rows untouched. — done: `db` kind + four exact rows.
  - `db.opencode.unavailable`: `db`, `platform`, `false`, `not_landed`, remediation `Install or repair the opencode CLI so opencode db path resolves.`, projection `platform-provider`, summary `The opencode session database is unavailable.`
  - `db.query.failed`: `db`, `platform`, `true`, `not_landed`, remediation `Retry the failed query and verify the session store is readable.`, projection `platform-provider`, summary `A session database query failed.`
  - `db.delete.failed`: `db`, `transient`, `true`, `not_landed`, remediation `Retry the prune; failed rows remain and are selected again.`, projection `platform-provider`, summary `A session delete did not land.`
  - `db.reboot.live`: `db`, `transient`, `true`, `not_landed`, remediation `Wait until the live window is empty or stop the opencode host, then retry.`, projection `platform-provider`, summary `A live session is using the database.`
- [x] **1.5** Update `doc/spec/features/feature-result-contract.md` in the same phase: add `db` to the declared domain-kind prose and append the four documented rows with the exact §4.7 fields. `bun run scripts/checks/error-table-sync.ts` must be green in both directions with non-zero counts. This section is the binding sync fixture and is never rewritten by later phases. — done: documented table and both prose sentences updated; sync green both directions.
- [x] **1.6** Author `tests/structure/session-admin-contract.test.ts` (TC-DB-001): declaration-only AST scan; exact constants; closed command/mode sets; `SessionStorePort` exactly `size`/`list`; `SessionAdminPort` adds `prune`/`reboot`; optional `parentId`; executable-statement and wrong-constant mutants. Include the automated half of TC-DB-038: scan the spec/evidence for the sign-off statement and assert no approval claim. — done: declaration/constant/port/payload scans plus the TC-DB-038 automated half.
- [x] **1.7** Update the error suites in Phase 1 (PIN-11; additive only): — done: 31→35 entries, `db` prose/rows, db classification cases, three `DOMAIN_KINDS` controls + db drift controls.
  - `tests/structure/error-table.test.ts` (TC-DB-003): the `ERROR_TABLE` count assertion `31` → `35`; the declared-kind prose assertion now includes `db` (`provider`, `input`, `config`, `state`, `lint`, `verify`, and `db`); add the `db` row-shape and kind-only containment assertions. Preserve every existing assertion.
  - `tests/behaviour/error-classification.test.ts` (TC-DB-005, A-T7): extend the existing suite with the `db` kind-only containment case (contains to `fallback.internal`, never selects the first `db` row), the wrong-code/exact-code cases, and a first-row-selecting control that must fail; preserve every existing `TC-CLASSIFY-*`, `TC-CONFIG-*`, and `TC-STATE-*` assertion.
  - `tests/checks/error-table-sync.test.ts` (TC-DB-004): the three existing `DOMAIN_KINDS` literal-replacement controls — `TC-STATE-019` (`:400`), `TC-SYNC-008` lint (`:485`), and `TC-VERIFY-019` (`:959`) — currently search for `'["provider", "input", "config", "state", "lint", "verify"]'`; replace that search literal in all three with the new seven-kind array `'["provider", "input", "config", "state", "lint", "verify", "db"]'` so the substitution still matches (assertions otherwise unchanged), then add the `db` machine-only and doc-only drift mutations with fail-closed controls.
  - `scripts/checks/error-table-sync.ts` stays unchanged and the error-code format is not widened.
- [x] **1.8** Author the contracts half of `tests/structure/session-admin-imports.test.ts` (TC-DB-002): contracts/domain tier, purity, runtime confinement, no SQLite drivers, and secret-read allowlist unchanged at four. Ensure the `db` exact-code agreement across `classifyDomainKind`/`classifyThrown` is covered by the extended `tests/behaviour/error-classification.test.ts` case (TC-DB-005) rather than duplicated in the contract test. — done: contracts/domain purity, confinement, no-driver, allowlist and package-surface assertions.
- [x] **1.9** Add `tests/fixtures/ports/v1-contract-inventory.json` (B3): a `session.ts` module entry with every exported name — the 23 `DB_*` constants plus `DbCommand`, `DbMode`, `DbDatabaseFacts`, `DbCounts`, `SessionSummary`, `SizeData`, `ListData`, `PruneData`, `RebootData`, `SessionSizeRead`, `SessionListRead`, `SessionPruneRead`, `SessionRebootRead`, `SessionAdminError`, `SessionAdminResult`, `SessionStorePort`, and `SessionAdminPort` — plus those same re-exported names on the `contracts/index.ts` entry (sorted as the fixture requires). `tests/structure/port-contract-inventory.test.ts` is consumed unchanged and must report zero missing/ unexpected modules or exports in both directions. — done: `session.ts` plus re-exported names in `v1-contract-inventory.json`; both directions green.
- [x] **1.10** Run the phase gate, stage only the Phase 1 files, and commit with the completion signal. Record the exact focused pass count and `pnpm check` result in the execution log. — done: 8/8 focused suites (157 pass), sync green, `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-D17 baseline half — the repaired defaults-position suite passes in a clean checkout and the absent-parent `ENOENT` control still proves the environment contract (TC-DB-035).
- Must: PIN-1/PIN-2 compile under strict TS with zero runtime imports; every pinned constant, command/mode set, port member, and item key is exact (TC-DB-001).
- Must: 4/4 `db` rows round-trip; the documented sync is green in both directions with non-zero counts; `tests/structure/error-table.test.ts` passes with 35 entries, `db` in the declared-kind prose, and the `db` row assertions (TC-DB-003); `tests/behaviour/error-classification.test.ts` passes with the `db` kind-only/wrong-code/exact-code cases and the first-row control (TC-DB-005); the three `DOMAIN_KINDS` literal controls in `tests/checks/error-table-sync.test.ts` still fire against the seven-kind array (TC-DB-004); kind-only `db` never selects a first row.
- Must: the contracts file is data-only and the domain file is pure (TC-DB-002 contracts/domain half).
- Must: all four `db.*` identities conform to `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$`; `scripts/checks/error-table-sync.ts` stays unchanged and the format is not widened (PIN-11).
- Must: `session.ts` and the `contracts/index.ts` re-export entry appear in `tests/fixtures/ports/v1-contract-inventory.json` and `port-contract-inventory` passes both directions (B3).
- Must: every Phase 1 executable export has its exact `content-inventory` allowance; no deferred allowance (B2).
- Should: `classifyDomainKind`/`classifyThrown` need no production code change beyond the table; record any needed change in the execution log.

**Files and modules**:

- Code areas: `tests/checks/config-default-positions.test.ts` (repaired first; TC-DB-035), `packages/core/src/contracts/session.ts` (new), `packages/core/src/contracts/index.ts` (updated), `packages/core/src/contracts/error-table.ts` (updated), `packages/core/src/domain/session-admin.ts` (new), `packages/core/src/domain/index.ts` (updated), `packages/core/src/index.ts` (updated), `tests/structure/session-admin-contract.test.ts` (new; TC-DB-001, TC-DB-038 automated half), `tests/structure/session-admin-imports.test.ts` (new, contracts half), `tests/structure/error-table.test.ts` (updated additively; 31 → 35, `db` prose, `db` rows; TC-DB-003), `tests/behaviour/error-classification.test.ts` (updated; `db` kind-only/wrong-code/exact-code cases; TC-DB-005), `tests/checks/error-table-sync.test.ts` (updated; three `DOMAIN_KINDS` search literals at `:400`/`:485`/`:959` moved to the seven-kind array, plus the `db` drift controls; TC-DB-004), `tests/fixtures/ports/v1-contract-inventory.json` (updated; `session.ts` + `index.ts` entries), `tests/structure/inventory.json` (updated; Phase 1 files), `tests/structure/content-inventory.test.ts` (updated; Phase 1 allowances). `scripts/checks/error-table-sync.ts` and `tests/structure/port-contract-inventory.test.ts` are consumed unchanged (PIN-11/B3).
- System docs: `doc/spec/features/feature-result-contract.md` (the four documented rows and the `db` kind prose; binding sync fixture).

**Tests**:

- TCs implemented: TC-DB-001, TC-DB-002 (contracts/domain half), TC-DB-003, TC-DB-004, TC-DB-005, TC-DB-035, TC-DB-038 (automated half).
- `bun test tests/structure/session-admin-contract.test.ts tests/structure/session-admin-imports.test.ts tests/structure/error-table.test.ts tests/behaviour/error-classification.test.ts tests/checks/error-table-sync.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/content-inventory.test.ts tests/checks/config-default-positions.test.ts` → expected green: 8/8 suites, 0 failures, 0 skips; record the exact Bun pass count.
- `bun run scripts/checks/error-table-sync.ts` → exit 0; source and documented counts equal and non-zero.
- `pnpm check` → exit 0 in a clean checkout (the baseline repair in task 1.1 makes this deterministic).

**Completion signal**: `feat(GH-180): add session-admin contracts, pure policy, and synchronized db error rows`

---

### Phase 2: Session adapter size/list, fake IO, fixtures, read-only behaviour

**Goal**: Implement the opencode-CLI-backed `OpencodeSessionIo` and the read-only `SessionStorePort` (`size`, `list`) with the fake-IO harness and every size/list boundary, ordering, empty-store, sidecar, and metadata-only proof. No mutation path exists yet.

**Tasks**:

- [x] **2.1** Author the shared fixture harness `tests/fixtures/session-admin/harness.ts` (PIN-9): fake `OpencodeSessionIo` with ordered call recorder `{ kind, value }`, scripted response queue, `fakeSetChildren`, `fakeRemoveRow`, `fakeFailDelete`, `runDbCli`, and a fake `DbCommandRuntime`; `store.ts` with `makeSession`; `boundaries.ts` with B-01..B-16; `malformed.ts`; `ids.ts`; `canary.ts`. Committed fixtures are read-only and contain synthetic ids, `/synthetic/...` paths, counts, sizes, booleans, and ISO timestamps only. — done: fake `OpencodeSessionIo`, ordered recorder, scripted queue, mutation hooks, store/boundaries/malformed/ids/canary fixtures.
- [x] **2.2** Implement `packages/adapters/src/session/index.ts` (PIN-3): `OpencodeSessionIo`, `createOpencodeSessionIo`, `createSessionStore`, `createSessionAdmin` (the admin methods may be stubbed to a classified `db.query.failed` until Phase 3; the read path is complete). Use `execFile` with argv arrays and `shell: false`; no `process.env`; `node:child_process`/`node:fs` only here. Register the Phase 2 content-inventory allowance for `adapters/src/session/index.ts` listing exactly `createOpencodeSessionIo`, `createSessionStore`, `createSessionAdmin` (the file is already in `tests/structure/inventory.json`). — done: `OpencodeSessionIo`, `createOpencodeSessionIo`, read store, admin seam; allowance added.
- [x] **2.3** Implement `size` and `list` (PIN-4, PIN-7): runtime path via `opencode db path`; read-only `stat` of database, `-wal`, `-shm`; session/message/part counts over `session`/`message`/`part` (the current stores; `session_message` is legacy/not counted and only appears as the delete-cascade mention); oldest/newest `time_updated` as ISO or `null`; one ordered list page with `LIMIT`, `total`, `omitted`, `truncated`, the nine-field item shape, `live` from the injected clock, and `dataBytes` as a length only. The page derives `messageCount = COUNT(*) FROM message WHERE session_id = s.id`, `partCount = COUNT(*) FROM part WHERE session_id = s.id`, and `dataBytes = COALESCE(SUM(LENGTH(CAST(message.data AS BLOB))),0) + COALESCE(SUM(LENGTH(CAST(part.data AS BLOB))),0)` in the same single statement; the `CAST(... AS BLOB)` form is pinned so the field counts UTF-8 bytes, not characters. Field sources are pinned: `createdAt = session.time_created`, `updatedAt = session.time_updated`, `parentId = session.parent_id`, and `archived = session.time_archived IS NOT NULL` (the schema has no `archived` column). Validate ids and path caps; malformed results are `db.query.failed`, path/command failures are `db.opencode.unavailable`. — done: runtime path, read-only stats, current `message`/`part` aggregates, byte-exact `dataBytes`, pinned field sources.
- [x] **2.4** Author `tests/behaviour/session-admin-size-list.test.ts` (TC-DB-006..009): exact data key sets; path and bytes from `stat`; counts and ISO timestamps; empty store `null`; absent versus zero-byte sidecar pair; 25/100/101-session pages; default 20/max 100; `updatedAt` descending then `id`; tie row; exact nine item fields with exact `dataBytes` byte values including a multi-byte fixture (11 bytes where a character count yields 6) and the `dataBytes: 0` empty case; the pinned field sources (`createdAt`/`updatedAt` from `time_created`/`time_updated`; `archived` true only when `time_archived` is non-null; no `archived` column); boundary rows B-05..B-07; shifted-clock replay; empty page; zero `deleteSession`/`checkpoint` calls; a fabricated-path/timestamp mutant, a character-count `dataBytes` mutant, and an extra-`title` mutant must fail. — done: size/list keys, empty store, sidecar pair, caps, ordering, byte oracle, field sources, bounded-work.
- [x] **2.5** Author `tests/behaviour/session-admin-privacy.test.ts` (TC-DB-010 and TC-DB-036 scaffold): `SessionStorePort` has no mutation member; fake conforms to both ports; `OpencodeSessionIo` is exported only from `@delivery-os/adapters/session`; exact seam members; no destructive/process member; the same read path through store and admin; zero forbidden fields in the item shape. Add the hermeticity scan scaffold (no spawns, home-directory reads, network, or SQLite) that Phase 5 completes. — done: read/admin port split, seam exactness, closed item shape, hermeticity scaffold.
- [x] **2.6** Extend the adapter half of `tests/structure/session-admin-imports.test.ts` (TC-DB-002): `node:child_process`/`node:fs` only in `adapters/src/session/index.ts`; no ambient environment read; zero SQLite driver imports; secret-read allowlist still exactly four; package export map unchanged. Add the bounded-work assertions for `size` (population-independent aggregate query count) and `list` (exactly two queries: total + one page with `LIMIT`). — done: adapter-only runtime APIs, no ambient env/driver, allowlist four, timeouts referenced.
- [x] **2.7** Run the phase gate, stage only the Phase 2 files, and commit. Record the exact focused pass count and `pnpm check` result. — done: 3/3 focused suites (41 pass), boundaries 132 pass, secret-read clean, `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-D1 and AC-D2 at adapter level — runtime path, bytes/presence, counts, ISO timestamps or `null`, ordering, cap, `total`/`omitted`/`truncated`, `live` from the injected clock, exact nine-field item shape (TC-DB-006..009).
- Must: absent sidecar and real zero-byte sidecar are distinguishable; empty store timestamps are `null`, not epoch (TC-DB-007).
- Must: read-only port surface and seam conformance (TC-DB-010); zero mutations recorded.
- Must: no SQLite driver, no ambient environment, no new package/subpath/dependency, allowlist at four (TC-DB-002 adapter half).

**Files and modules**:

- Code areas: `packages/adapters/src/session/index.ts` (implemented; Phase 2 content-inventory allowance for the three factories), `tests/fixtures/session-admin/{harness,store,boundaries,malformed,ids,canary}.ts` (new), `tests/behaviour/session-admin-size-list.test.ts` (new), `tests/behaviour/session-admin-privacy.test.ts` (new), `tests/structure/session-admin-imports.test.ts` (updated), `tests/structure/inventory.json` (updated only if helper modules are listed), `tests/structure/content-inventory.test.ts` (updated; Phase 2 allowance).
- System docs: none.

**Tests**:

- TCs implemented: TC-DB-006, TC-DB-007, TC-DB-008, TC-DB-009 (adapter halves), TC-DB-010 (full), TC-DB-002 (adapter half), TC-DB-036 (scaffold).
- `bun test tests/behaviour/session-admin-size-list.test.ts tests/behaviour/session-admin-privacy.test.ts tests/structure/session-admin-imports.test.ts` → expected green: 3/3 suites, 0 failures, 0 skips; record the exact Bun pass count.
- `bun test tests/boundaries` and `bun run scripts/checks/secret-read-boundary.ts` → exit 0.
- `pnpm check` → exit 0.

**Completion signal**: `feat(GH-180): add opencode-backed session size and list with fake-IO fixtures`

---

### Phase 3: Prune and reboot administration, TOCTOU, idempotency, partial failure

**Goal**: Implement the mutating admin port — leaf-only prune with the shared cold/live/leaf predicate, per-candidate pre-delete re-check, official deletes, absence absorption, partial-failure truth, idempotency, and reboot's live gate plus one bounded checkpoint — with no process kill and no sidecar deletion.

**Tasks**:

- [x] **3.1** Complete the prune policy in `packages/core/src/domain/session-admin.ts` (PIN-2, PIN-7): the selection query facts and `classifyPruneCandidate`/`selectPruneCandidates` use the same predicate; ordering oldest-first then `id`; cap at `limit`; `liveExcluded` counted at assembly when the reason is `live`. The cut/live comparisons are strict/inclusive exactly as spec §3.4. — done: shared predicate/order/cap used by selection and assembly; `liveExcluded` counted at assembly.
- [x] **3.2** Implement `createSessionAdmin(io).prune` (PIN-3/PIN-4): one selection query with cold, not-live, `NOT EXISTS` child predicates, oldest-first, `LIMIT`, carrying the cold/live boundary values returned by `computeDbCutoffMs`/`computeDbLiveBoundaryMs`; for each candidate one re-read by id with cold, live, and child-existence predicates; skip on any failed condition; one `deleteSession(id)` per eligible candidate; on a delete failure one bounded post-delete existence read — zero rows is a counted skip, a present row is a failed delete; continue after failures. A pre-land `db.opencode.unavailable`/`db.query.failed` returns that identity with zero deletes; any aborting failure after at least one delete lands returns `db.delete.failed` with the normative summary `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"` (`attempted = landed + failed`). — done: one selection query, per-candidate re-read, official delete, absence absorption, normative partial/post-land summary and retry truth.
- [x] **3.3** Implement `createSessionAdmin(io).reboot` (PIN-3/PIN-4): one live-count query; dry-run returns the plan, `blockedByLiveSession`, WAL bytes, `checkpointPerformed: false`; apply with any live session returns `db.reboot.live` and performs nothing; apply with zero live sessions performs exactly one `checkpoint()` (`PRAGMA wal_checkpoint(TRUNCATE)`), re-stats WAL, and reports before/after. No process kill, signal, suspend, restart, `VACUUM`, or sidecar deletion. — done: live-count gate, dry-run plan, exactly one checkpoint on success, WAL before/after, no process/file action.
- [x] **3.4** Author `tests/behaviour/session-admin-prune.test.ts` (TC-DB-011..022): dry-run twice byte-identical with zero delete/checkpoint; cold boundary B-01..B-04; live/leaf B-05..B-12 including the policy-level `liveExcluded` probe; oldest-first and `id` tiebreak with scrambled fake rows; cap; apply one delete per id; no raw delete; no destructive file API; idempotent second apply and post-apply dry-run; gained-child TOCTOU skip with the re-read SQL textual predicates (cold, live, child) and the selection SQL textual predicates (cold, not-live, `NOT EXISTS` child, `ORDER BY ... time_updated`, `LIMIT`, and the computed `computeDbCutoffMs`/`computeDbLiveBoundaryMs` values); vanished-row skip; partial failure envelope with the normative landed/failed summary; post-land abort returning `db.delete.failed` with the same summary; retry convergence; already-absent-at-delete skip with a present sibling; pre-land abort on unavailable/malformed/non-array/non-zero with zero deletes; every negative has its live control. — done: dry-run replay, cold/live/leaf boundaries, ordering/cap, applies, idempotency, TOCTOU, vanished/absent, partial/post-land aborts.
- [x] **3.5** Author `tests/behaviour/session-admin-reboot.test.ts` (TC-DB-031..033): two live sessions dry-run plan (exit 0, no checkpoint); apply with live → `db.reboot.live` (exit 2, zero checkpoint/delete); zero live → exactly one checkpoint with exact SQL and WAL before/after; the live-count SQL carries the 15-minute comparison (or the injected `computeDbLiveBoundaryMs` value); a shifted-clock replay changes the live count and flips the gate; no process/file action; manual-restart sentence in the human text; seeded `process.kill`, destructive-file, double-checkpoint, `VACUUM`, host-clock live-count, and restart-claim mutants must fail. — done: live gate, clock shift, one checkpoint, manual-restart text, no process/file action, mutant controls.
- [x] **3.6** Complete the destructive-API AST scan in `tests/structure/session-admin-imports.test.ts` (TC-DB-016/033 static halves): denylist `unlink`, `unlinkSync`, `rm`, `rmSync`, `rmdir`, `truncate`, `truncateSync`, `writeFile`, `writeFileSync`, `rename`, `renameSync`, `ftruncate`, `copyFile`, `appendFile`, and process kill/signal APIs; zero matches in the new files; a planted `unlinkSync` and a planted `process.kill` in temp copies must fail. — done: destructive/process AST denylist stays green with planted controls.
- [x] **3.7** Add the prune SQL-safety half to `tests/behaviour/session-admin-sql-safety.test.ts` (TC-DB-015/027 partial): one statement per query; no `DELETE`/`DROP`/`TRUNCATE`/`VACUUM`/`ALTER`/`CREATE`; no bulk `IN (`; per-candidate delete only; the re-read carries cold/live/child predicates; a bulk-SQL-delete mutant fails. — done: single-statement/no-DDL/bulk-`IN`/per-candidate-delete and clamp/id matrices.
- [x] **3.8** Run the phase gate, stage only the Phase 3 files, and commit. Record the exact focused pass count and `pnpm check` result. — done: 4/4 focused suites (54 pass), `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-D3 and AC-D4 — dry-run zero mutations and byte-identical replay; cold strict, live inclusive, leaf-only, oldest-first, `id` tiebreak, cap; the selection SQL predicates are asserted textually (TC-DB-011..014).
- Must: AC-D5..AC-D9 — official delete only; no file/sidecar touch; idempotent re-run; gained-child and vanished-row skips; partial failure and post-land abort `db.delete.failed` with the normative `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"` summary and retry convergence; absent-at-delete skip with continuation; pre-land abort keeps `db.query.failed`/`db.opencode.unavailable` (TC-DB-015..022).
- Must: AC-D10 and AC-D11 — reboot live gate performs nothing, success performs exactly one checkpoint, WAL before/after reported, live-count SQL carries the 15-minute comparison, clock shift flips the gate; no process kill and no sidecar deletion (TC-DB-031..033).
- Must: TC-DB-002's destructive/process scan remains green; no new runtime-API location or allowlist entry.

**Files and modules**:

- Code areas: `packages/core/src/domain/session-admin.ts` (updated), `packages/adapters/src/session/index.ts` (prune/reboot), `tests/behaviour/session-admin-prune.test.ts` (new), `tests/behaviour/session-admin-reboot.test.ts` (new), `tests/behaviour/session-admin-sql-safety.test.ts` (new, partial), `tests/structure/session-admin-imports.test.ts` (updated), `tests/fixtures/session-admin/**` (updated).
- System docs: none.

**Tests**:

- TCs implemented: TC-DB-011..TC-DB-022 (full adapter behaviour), TC-DB-031..TC-DB-033 (adapter behaviour), TC-DB-016/033 static halves, TC-DB-015/027 SQL halves.
- `bun test tests/behaviour/session-admin-prune.test.ts tests/behaviour/session-admin-reboot.test.ts tests/behaviour/session-admin-sql-safety.test.ts tests/structure/session-admin-imports.test.ts` → expected green: 4/4 suites, 0 failures, 0 skips; record the exact Bun pass count.
- `pnpm check` → exit 0.

**Completion signal**: `feat(GH-180): add leaf-only prune and guarded reboot administration with TOCTOU and partial-failure proofs`

---

### Phase 4: CLI `db` command, edge composition, grammar/output/privacy/SQL-safety

**Goal**: Add the `db` command definition and runtime, compose it only when `options.db` is present, and prove the two-class grammar, envelope/human caps, metadata-only privacy, SQL/id safety, composition-absent non-registration, and byte-identical replays at the CLI surface.

**Tasks**:

- [x] **4.1** Author `packages/cli/src/commands/db.ts` (PIN-5/PIN-8): `DbCommandRuntime`, `createDbCommandDefinition`, the exact definition metadata (`flags`, no `requiresValue`, `positionals.max: 8`, `humanText`), and the full handler grammar: subcommand set, argv re-scan for values/stray tokens, per-subcommand flag sets, numeric ranges, boolean `--apply`, defaults (`list` 20, `prune` 30/50), and runtime call. No stream write, no exit decision, no `--json` inspection. Export only `createDbCommandDefinition` and the runtime type; export from `commands/index.ts`. Register `cli/src/commands/db.ts` in `tests/structure/inventory.json` and add the Phase 4 content-inventory allowance `createDbCommandDefinition`; add `createDbCommandDefinition` to the existing `cli/src/commands/index.ts` allowance. — done: `DbCommandRuntime`, definition metadata, full handler grammar, last-wins, ranges/defaults; inventory + allowance added.
- [x] **4.2** Extend `packages/cli/src/edge.ts` (PIN-6): import the adapter factories and `createDbCommandDefinition`; add `DbComposition` and `createDbCommandRuntime`; add `ConfigProgramOptions.db?: DbComposition`; register `commands.db` only when `options.db` is defined. Add `createDbCommandRuntime` to the existing `cli/src/edge.ts` content-inventory allowance. No bin entry or package export change. — done: `DbComposition`, `createDbCommandRuntime`, conditional `commands.db`, edge allowance.
- [x] **4.3** Author `tests/behaviour/session-admin-grammar.test.ts` (TC-DB-023..025): G-01..G-05, G-07..G-11, G-13 in human and `--json` modes → exact `input.value.rejected`, category `user`, `consequence: not_landed`, `projectionClass: user-validation`, exit 1, no `data`, zero runtime calls; G-06 `prune --json` succeeds and proves `--json` is stripped; G-12 is the last-wins acceptance case at exit 0 — `prune --apply --apply` runs as apply and `prune --limit 5 --limit 10` runs with effective `limit 10`, proving repeated same-flag occurrences are not a rejection; P-01..P-04 → `fallback.invocation`, exit 1, zero runtime calls; `db size -x` → `input.value.rejected`; `db size --x` → `fallback.invocation`; valid sibling controls call the runtime; range matrix min/max/±1/empty/decimal/non-numeric for all three flags; `prune --apply false` (G-11) rejects; accepted values reach the runtime exactly. — done: G-01..G-13/P-01..P-04, `--json` strip, last-wins, single-dash split, range matrix.
- [x] **4.4** Author `tests/behaviour/session-admin-output.test.ts` (TC-DB-028..030 and output halves of TC-DB-020/033): exactly one valid envelope per success/failure; `data.schemaVersion`; `data.command`; success no `error`, failure no `data`; machine `data` ≤ 524288 bytes on the max fixture; human ≤ 32 item lines, 40 lines, 8192 bytes; `+N more` with `rendered + N = total`; goldens for size/list/prune/reboot in dry-run and applied modes; byte-identical three-run replays with fixed `NOW_MS`, run id, and brand; throwing `Date.now`/`Math.random`/`fetch` stubs leave output unchanged; over-cap renderer and 40-item mutants fail. — done: envelope, schema version, machine/human caps, truthful `+N more`, six committed goldens, byte-identical replays and ambient stubs.
- [x] **4.5** Author `tests/behaviour/session-admin-sql-safety.test.ts` fully (TC-DB-025 clamp half, TC-DB-026, TC-DB-027): id-shape matrix I-01..I-07 through `list` and `prune --apply` → invalid id `db.query.failed`, zero deletes, no raw id in SQL or argv; over-cap id/path `db.query.failed` naming the field, never truncated; every SQL one statement with no comment markers and no raw delete/DDL; exact checkpoint text; defensive clamp for direct out-of-range policy calls; interpolating and `DELETE FROM session` mutants fail. — done: id/path matrices, defensive clamp, single-statement/no-DDL/bulk-`IN`/per-candidate-delete, exact checkpoint.
- [x] **4.6** Complete `tests/behaviour/session-admin-privacy.test.ts` for TC-DB-029: canary presence asserted first; every success/failure class walked across stdout, stderr, parsed envelope, human text, and error objects → zero canary; exact key sets; zero extra fields; no forbidden field name in committed fixtures; injected environment value never appears; wide-projection and extra-field mutants expose the canary and fail. — done: canary presence-first, closed key sets, forbidden-field scan, ambient env absence, mutant controls.
- [x] **4.7** Update `tests/structure/cli-edge-seam.test.ts` (TC-DB-034): add `db.ts` to `NEW_COMMAND_FILES` and the command-export assertions; assert `commands/index.ts` exports `createDbCommandDefinition`/`DbCommandRuntime` and edge exports `DbComposition`/`createDbCommandRuntime`; assert no `exitCode` assignment or stream write in `db.ts`; extend the human-text declarer assertion (`:415-418`) to exactly `["packages/cli/src/commands/db.ts", "packages/cli/src/commands/status.ts"]` (the sorted full paths from `listTypeScriptFiles`, i.e. `` `${CLI_DIR}/commands/db.ts` `` then `` `${CLI_DIR}/commands/status.ts` ``; existing assertion extended, never removed); composition without `db` leaves `commands.db` absent and `db size` returns `fallback.invocation` exit 1; composition with `db` registers and runs through the fake; a no-op unconditional-registration mutant fails. — done: `db.ts` seam/export/exit scans, exact db+status human-text declarer pair, composition-absent/present cases.
- [x] **4.8** Run the phase gate, stage only the Phase 4 files, and commit. Record the exact focused pass count and `pnpm check` result. — done: 5/5 phase suites (73 pass), `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-D12 — every handler rejection is `input.value.rejected` at exit 1 with zero I/O; every undeclared `--` token is `fallback.invocation` at exit 1; `db size -x` and `db size --x` are asserted as the pinned split; `prune --json` succeeds; repeated same-flag occurrences are last-wins at exit 0 (G-12) and never rejected (TC-DB-023/024).
- Must: AC-D13 — numeric ranges and id shapes are safe; no invalid id is interpolated or passed to delete; over-cap identity fails rather than truncates (TC-DB-025/026); SQL discipline is single-statement and delete-free (TC-DB-027).
- Must: AC-D14 — envelope validity, schema version, machine/human caps, `+N more` truthfulness, zero forbidden fields, zero canary, byte-identical replays (TC-DB-028..030).
- Must: AC-D16 — `db` is registered only with a composition; absent composition leaves it unregistered; the handler has no exit decision (TC-DB-034).
- Must: command-level replay of size/list and prune/reboot output halves completes TC-DB-006..009, TC-DB-020, TC-DB-022, TC-DB-031..033.

**Files and modules**:

- Code areas: `packages/cli/src/commands/db.ts` (new; Phase 4 allowance `createDbCommandDefinition`; registered in `inventory.json`), `packages/cli/src/commands/index.ts` (updated; allowance adds `createDbCommandDefinition`), `packages/cli/src/edge.ts` (updated; allowance adds `createDbCommandRuntime`), `tests/behaviour/session-admin-grammar.test.ts`, `tests/behaviour/session-admin-output.test.ts`, `tests/behaviour/session-admin-sql-safety.test.ts`, `tests/behaviour/session-admin-privacy.test.ts` (updated), `tests/behaviour/session-admin-size-list.test.ts`, `tests/behaviour/session-admin-prune.test.ts`, `tests/behaviour/session-admin-reboot.test.ts` (command halves), `tests/structure/cli-edge-seam.test.ts` (updated), `tests/fixtures/session-admin/golden/**` (new), `tests/structure/inventory.json` (updated; `cli/src/commands/db.ts`), `tests/structure/content-inventory.test.ts` (updated; Phase 4 allowances).
- System docs: none (the result-contract documented table was shipped in Phase 1; lifecycle phase 7 reconciles the remaining docs).

**Tests**:

- TCs implemented: TC-DB-023..TC-DB-030 (full), TC-DB-034 (full), command halves of TC-DB-006..009, TC-DB-020, TC-DB-022, TC-DB-031..033, TC-DB-036 (privacy scan half).
- `bun test tests/behaviour/session-admin-grammar.test.ts tests/behaviour/session-admin-output.test.ts tests/behaviour/session-admin-sql-safety.test.ts tests/behaviour/session-admin-privacy.test.ts tests/structure/cli-edge-seam.test.ts` → expected green: 5/5 suites, 0 failures, 0 skips; record the exact Bun pass count.
- `pnpm check` → exit 0.

**Completion signal**: `feat(GH-180): add db command and edge composition with grammar, output, privacy, and SQL-safety proofs`

---

### Phase 5: Baseline verification, oracles, real-store smoke, CI battery, evidence, release handoff

**Goal**: Verify the Phase 1 baseline repair and the earlier surfaces/allowances (no edits), complete the hermeticity and bounded-work oracles, run the mandatory non-CI read-only real-store smoke, add the fixed-group changeset, run the full merge-blocking CI battery in a clean tree, and record evidence with the deferred non-CI notes and rollback instructions. No PR, push, merge, or owner-approval claim.

**Tasks**:

- [x] **5.1** Verify the Phase 1 baseline repair (TC-DB-035) without editing it: run `bun test tests/checks/config-default-positions.test.ts` in a clean checkout and record the exit and pass count; confirm the absent-parent `ENOENT` control and that the recursive parent creation succeeds idempotently twice. This is verification only; the repair landed in Phase 1 task 1.1. — verified: 6 pass after removing `tmp/tmpdir`; temp-root probe shows `ENOENT` before the repair and idempotent recursive creation twice after.
- [x] **5.2** Complete `tests/structure/session-admin-imports.test.ts` and `tests/behaviour/session-admin-privacy.test.ts` for TC-DB-036: scan the nine session-admin suites for `node:child_process`, `spawn`, `exec`, `fork`, `Bun.spawn`, `node:http`/`node:https`/`fetch`, `$HOME`, `os.homedir`, `process.env`, and `node:fs` write APIs → zero; scan the new source/fixtures for SQLite drivers → zero; run the home-path scanner over the declared file set with a positive scope count; a runtime-synthesized home-shaped path and a planted `spawn` in temp copies must fail. — completed: nine-suite process/network scan, driver scan, home-path scan with positive scope, and planted spawn/home-path controls.
- [x] **5.3** Complete the bounded-work oracle (TC-DB-037) in the size-list, prune, reboot, and contract suites: `size` query count invariant across 10-row and 6,900-row fixtures with aggregate-shaped SQL over `session`/`message`/`part` and no per-session query; `list` exactly two queries with a `LIMIT` page and correlated `message`/`part` aggregates; prune one selection query plus at most one re-read and one delete per candidate, total queries ≤ `1 + limit`, deletes ≤ `limit`; reboot one live-count query and at most one checkpoint; assert `DB_QUERY_TIMEOUT_MS`, `DB_DELETE_TIMEOUT_MS`, `DB_CHECKPOINT_TIMEOUT_MS` are present and referenced on the matching I/O class; record the optional non-CI reference latency measurement as deferred/not run (never as a passing threshold). — completed: invariant size/list/prune/reboot query counts, per-candidate bounds, and timeout references; reference latency deferred/not run.
- [x] **5.4** Run the **mandatory non-CI read-only real-store smoke** (test plan v1.4, TC-DB-037; not a CI gate): against the operator's real opencode store run `<binary> db size` and `<binary> db list --limit 5`; record each command, exit code, bounded output, and a before/after confirmation that database/WAL/SHM bytes and row counts are unchanged (no mutation). Label it non-CI and record it in the evidence file; a mutation-inducing run is rejected. — executed: read-only real-store smoke on opencode 1.19.3; size/list exit 0; sessions/WAL/SHM unchanged; external host inserts observed; no deletes/checkpoint/truncation; recorded honestly as partial, non-CI.
- [x] **5.5** Author `.changeset/db-session-admin-minor.md` (PIN-10): fixed-group minor for `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`; brand-neutral summary; no lockfile change and no hand-bumped version fields. — verified in place: fixed-group minor changeset landed early (Phase 2 deviation) and `changesets-group`/release gates are green.
- [x] **5.6** Author `chg-GH-180-evidence.md`: per-phase commit list, focused and aggregate gate results with commands and HEAD, the 38-TC coverage map, the AC-D18 in-tree evidence, the mandatory real-store smoke record with the no-mutation confirmation, the deferred PR-body half and NFR-D4 reference measurement, and rollback instructions (single-PR revert; never roll back one side of the error-table sync; no data cleanup because tests mutate only fakes). — authored `chg-GH-180-evidence.md` with commits, gates, 38-TC map, smoke record, deferrals, deviations, handoff and rollback.
- [x] **5.7** Run the full merge-blocking evidence battery and record results: every focused suite from the traceability table; `bun test` (all layers); `pnpm run check:boundaries`; all `ts-invariants` scripts already run in `.github/workflows/ci.yml` — `pnpm-foundation`, `ignore-rules`, `manifest-privacy`, `script-surface`, `workspace-entrypoints`, `tsconfig-strictness`, `changesets-group`, `testkit-exclusion`, `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `error-table-sync`, `exit-code-literals`, `secret-read-boundary`, `boundary-ci-parity`, `privacy-literals` (each `bun run scripts/checks/<name>.ts`), plus the test-plan §7.3 boundary checks `ambient-globals.ts` and `forbidden-literals.ts`; `pnpm check`; `git diff --check`; `git status --porcelain` before and after (clean tree; no test writes). Expected aggregate: exit 0, 0 failures, 0 skips; record the exact pass count and HEAD. — green: `bun test` 1754 pass / 2 pre-existing skips / 0 fail; 18/18 invariants; `pnpm check` exit 0; `git diff --check` clean; before/after status identical.
- [x] **5.8** Spec reconciliation handoff: verify the Phase 1 documented table is still synchronized in both directions; record the deferred lifecycle-phase-7 reconciliation list (`feature-session-database-admin.md` new; `feature-adapter-ports.md`, `feature-result-contract.md` remainder, `feature-monorepo-scaffold-toolchain.md`, `doc/overview/glossary.md`, and `doc/spec/features/feature-autonomous-delivery.md`), the **ADR-0003 reconciliation or a new decision-record proposal for the mutating `SessionAdminPort`** (public-contract/semver impact, read-only `SessionStore` preserved, C-11 gate) owned by PM/`@decision-advisor` (not a `@coder` implementation task), and the **CLI command-registry delivery row**. For `feature-autonomous-delivery.md`, the handoff pins the stale-claim correction: its `session_message` current-store claim (`:12`, `:53`, `:113`, `:156`) becomes `message` (messages) and `part` (parts), with the verified reference-store facts recorded — `session_message` 0 rows; `message` ~213k; `part` ~961k (RSK-D14). Note that `scripts/pm-liveness.sh` (`:11`, `:181`, `:193`) still queries `session_message`; it is **out of scope** because this change makes no bash-stack changes (NG-D7) and is flagged as a separate owner follow-up. Confirm the ADR-0003 C-11 sign-off remains a required owner merge gate with no approval claimed. Do not create a PR, push, merge, or mark lifecycle phases complete. — recorded: Phase-7 doc list, `feature-autonomous-delivery.md` `session_message`→`message`/`part` correction, `delivery-modes.md` follow-up, ADR-0003/`SessionAdminPort` decision proposal, command-registry row, `pm-liveness.sh` out of scope, C-11 owner gate with no approval claim.
- [x] **5.9** Stage only the Phase 5 files and commit. Record the final commit, aggregate battery, and evidence path in the execution log. — done: Phase 5 files staged and committed with the completion signal.

**Acceptance Criteria**:

- Must: AC-D17 — the repaired defaults-position suite passes in a clean checkout (verified, not edited); the session-admin suites make zero real process/file/network/home calls; zero real home paths in the introduced files; `pnpm check` green (TC-DB-035, TC-DB-036, TC-DB-037).
- Must: the mandatory non-CI read-only real-store smoke is recorded with commands, exit codes, bounded output, and a before/after no-mutation confirmation; it is never presented as a CI gate or as a passing latency threshold.
- Must: the fixed-group minor changeset is present and follows `.changeset/config.json`; no lockfile change.
- Must: inventory and executable allowances are exact (introduced in Phases 1/2/4, verified here); the CLI seam human-text declarer assertion is the exact sorted full-path pair `["packages/cli/src/commands/db.ts", "packages/cli/src/commands/status.ts"]`; no existing gate is weakened or bypassed.
- Must: the full `ts-invariants` battery — including `changesets-group.ts` and `privacy-literals.ts` — is run and recorded; a green local `pnpm check` alone is not the evidence.
- Must: evidence records only executed results; the non-CI reference measurement and the PR-body half of AC-D18 are marked deferred/not run; no PR/push/merge/owner-approval claim.
- Must: no file staged from `.ai/local/` or `tmp/`; no protected path (`.opencode/**`, `.ados-claude/**`, `.ai/**`, `scripts/*.sh`, `tools/**`, CI topology) touched.

**Files and modules**:

- Code areas: `tests/structure/session-admin-imports.test.ts`, `tests/behaviour/session-admin-privacy.test.ts`, `tests/behaviour/session-admin-size-list.test.ts`, `tests/behaviour/session-admin-prune.test.ts`, `tests/behaviour/session-admin-reboot.test.ts` (bounded-work completion), `.changeset/db-session-admin-minor.md` (new), `chg-GH-180-evidence.md` (new). `tests/checks/config-default-positions.test.ts` is verified only; `tests/structure/inventory.json` and `tests/structure/content-inventory.test.ts` are verified only (no Phase 5 edits).
- System docs: none in this phase beyond the Phase 1 result-contract rows; phase-7 reconciliation is recorded as a handoff, not executed, and includes `doc/spec/features/feature-autonomous-delivery.md` (the stale `session_message` current-store claim becomes `message`/`part`, with the reference facts `session_message` 0 / `message` ~213k / `part` ~961k; `scripts/pm-liveness.sh` is out of scope and flagged as an owner follow-up), the ADR-0003 reconciliation/decision-record proposal (PM/`@decision-advisor`) plus the CLI command-registry delivery row.

**Tests**:

- TCs implemented/verified: TC-DB-035 (verification), TC-DB-036, TC-DB-037, TC-DB-038 (evidence half).
- `bun test tests/checks/config-default-positions.test.ts` → expected green: 1/1 suite, 0 failures; record the exact pass count.
- `bun test tests/structure/session-admin-imports.test.ts tests/behaviour/session-admin-privacy.test.ts tests/behaviour/session-admin-size-list.test.ts tests/behaviour/session-admin-prune.test.ts tests/behaviour/session-admin-reboot.test.ts` → expected green: 5/5 suites, 0 failures, 0 skips.
- Mandatory non-CI real-store smoke (task 5.4) → `db size` and `db list --limit 5` exit 0 with recorded output and a no-mutation confirmation.
- Full battery from task 5.7 (including `changesets-group.ts` and `privacy-literals.ts`) → expected `pnpm check` exit 0; all focused suites green; `git status --porcelain` clean before and after.
- Expected overall coverage: **38/38 TCs** green or explicitly deferred (only the non-CI TC-DB-037 reference measurement and the PR-body half of TC-DB-038 may be deferred).

**Completion signal**: `test(GH-180): verify db surfaces, record real-store smoke and aggregate evidence`

## Execution Notes for `@coder` (single run, no review)

- **Run mode**: `/run-plan GH-180 execute all remaining phases no review`. Execute Phases 1–5 in order. Do not dispatch subagents; committer and runner work is inline. Stop after Phase 5; do not create a PR, push, merge, or claim owner approval.
- **One commit per phase**: use the completion signal exactly; body lines ≤ 100 characters. Stage an explicit file list matching the phase's Files-and-modules section; verify with `git status --porcelain` before committing.
- **Never stage**: `.ai/local/**`, `tmp/**`, or untracked scratch. Logs belong under `.ai/local/` (git-ignored) and are never staged.
- **Phase gate**: focused suites green plus `pnpm check` exit 0 before every commit. Capture the log under `.ai/local/`. A red aggregate gate blocks the commit; fix it or stop at the last green task boundary and report — never enlarge a commit or split a phase across commits.
- **Grammar discipline**: the parser is unchanged. The handler owns values, ranges, and per-subcommand flag sets; do not add `requiresValue` or modify `packages/cli/src/index.ts`. Repeated same-flag occurrences are last-wins (the parser overwrites; `db` declares no conflict pairs) and must never be re-rejected by the handler. Preserve the pinned `db size -x` → `input.value.rejected` and `db size --x` → `fallback.invocation` split.
- **Fixture hygiene**: committed fixtures are read-only; temp mutation copies self-materialize under `mkdtemp(path.join(os.tmpdir(), "gh180-SUITE-"))`; remove them in `finally`/`afterEach`; the live tree must stay clean after every suite.
- **Allowance discipline**: add each file's exact `content-inventory` allowance and `inventory.json` entry in the phase that introduces it (Phase 1 contracts/domain/port fixture, Phase 2 adapter, Phase 4 `db` command/edge); never defer an allowance to Phase 5.
- **Real-store smoke**: the mandatory read-only smoke (`db size`, `db list --limit 5`) is non-CI and must be recorded with commands, exit codes, bounded output, and a before/after no-mutation confirmation; it is never a CI gate or a passing latency claim.
- **Evidence honesty**: record only executed results with command and HEAD. Unrun results are never recorded as passing; the non-CI measurement and PR-body check are labeled deferred.

## Scope

### In Scope

- The `ados db` family exactly: `size`, `list`, `prune`, `reboot`; dry-run defaults; `--apply`; 15-minute live window; 30-day default `--older-than`; 20/100 list limits; 50/500 prune limits; leaf-only selection; TOCTOU re-check; one official delete per candidate; one bounded checkpoint on `reboot --apply` with no live session; no process kill; no sidecar deletion; no direct SQLite binding; no parser change (F-D1..F-D7, AC-D1..AC-D18).
- Core contract vocabulary and pure policy (DM-D1..DM-D8; Phases 1–2).
- The four `db` error rows with the documented table synchronized in the same phase (AC-D15, NFR-D7; Phase 1).
- The opencode-CLI-backed adapter and the fake-IO fixture harness (AC-D1..AC-D11, NFR-D1/NFR-D3/NFR-D8/NFR-D9; Phases 2–3).
- The CLI command, edge composition, grammar, output, privacy, and SQL-safety proofs (AC-D12..AC-D16, NFR-D2/NFR-D6/NFR-D8; Phase 4).
- The scoped defaults-position baseline repair (implemented in Phase 1, verified in Phase 5), inventory/allowance verification, the mandatory non-CI read-only real-store smoke, the full merge-blocking CI battery, the fixed-group minor changeset, evidence, and the decision/doc handoff (AC-D17/AC-D18; Phase 5).

### Out of Scope

- NG-D1: harness lifecycle, spawn, resume, telemetry; no session is created or killed.
- NG-D2: process killing or automatic host restart; `reboot` prepares the database only.
- NG-D3: `VACUUM` or compaction beyond the single bounded WAL checkpoint.
- NG-D4: `node:sqlite`, `bun:sqlite`, `better-sqlite3`, or any direct SQLite binding in product code, tests, or scripts.
- NG-D5: titles, prompts, message bodies, part data, credentials, environment values, or command arguments in any output, error, evidence, fixture, or log.
- NG-D6: GUI, interactive prompts, shared/remote database mode.
- NG-D7: changes to `scripts/pm-liveness.sh`, `scripts/ceo-loop.sh`, `.opencode/**`, the generated Claude plugin, existing gates (none weakened), or unrelated refactors.
- NG-D8: descendant-aware pruning, retention policies, scheduling, automatic pruning.
- NG-D9: a second database access path or a schema reimplementation.
- PR creation, push, merge, owner acceptance, publishing, or any new CI job (D9/D10).

### Constraints

- PIN-1..PIN-11 and D1..D11 are binding. Behaviour, identities, shapes, exits, bounds, and AC/TC mappings come from the spec and test plan and may not be rebound.
- The shared parser is consumed unchanged. The two-class grammar split is asserted, never reinterpreted.
- `node:child_process`/`node:fs` only in `packages/adapters/src/session/index.ts`; no `process.env`; no ambient clock/randomness/environment.
- No new package, subpath, dependency, bin entry, package export, state schema, config key, secret-read allowlist entry, or runtime-API location.
- Strict TypeScript, injected time/environment, runtime-API confinement, and `bun:test` authoring per the repo rules; the in-process harness contract (test-plan §4.1) and non-vacuity contract (§4.2) bind every suite.
- Phase gate = focused suites green plus `pnpm check` exit 0; boundary/ambient/literal/entrypoint/secret-read gates extend only by adding rules and fixtures. **No gate is weakened or bypassed.** Additive test updates to `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/cli-edge-seam.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/inventory.json`, and `tests/fixtures/ports/v1-contract-inventory.json`, plus the scoped `tests/checks/config-default-positions.test.ts` baseline repair, are allowed and listed in the phases. `scripts/checks/error-table-sync.ts` stays unchanged, the error-code format is not widened, and no existing assertion is removed or re-baselined (PIN-11).
- Rollback: the change is additive except for the test-environment baseline repair and the doc table addition. A single-PR revert removes the contracts, domain, adapter implementation, command, edge composition, tests/fixtures/goldens, changeset, and doc rows together. Never roll back one side of the error-table sync. No data cleanup is needed because tests mutate only fakes and no real database is touched.

### Risks

| ID | Risk | Impact | Probability | Mitigation (plan anchor) |
|---|---|---|---|---|
| RSK-D1 | Selection/deletion race: a candidate gains a child or the store changes | H | L | Shared predicate; per-candidate re-read with cold, live, and child predicates; skip on any failed condition (Phase 3, TC-DB-018/019) |
| RSK-D2 | Deleting a parent orphans children | H | L | Leaf-only selection; child existence re-checked before delete; schema rationale documented (Phase 3, TC-DB-013/018) |
| RSK-D3 | Partial failure or a post-land abort reported as success | M | M | `db.delete.failed` exit 2 with the normative `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"` summary; failed row remains; retry converges (Phase 3, TC-DB-020/022) |
| RSK-D4 | Metadata-only guarantee erodes | H | L | Closed field whitelist; canary presence-first; wide-projection and extra-field mutants; C-11 owner gate (Phase 4, TC-DB-029) |
| RSK-D5 | opencode CLI output shape changes | M | M | Single adapter seam; malformed results `db.query.failed`; no SQLite fallback (Phase 2/3, TC-DB-022) |
| RSK-D6 | Large-store queries time out or block | M | M | Single-statement bounded queries; declared timeouts; bounded-work oracle (Phase 5, TC-DB-037) |
| RSK-D7 | DB path or sidecar handling is wrong on a platform/host | M | L | Runtime path; explicit presence; no file deletion; manual restart documented (Phases 2–3, TC-DB-007/016/033) |
| RSK-D8 | SQL or shell injection through a session id | H | L | Id shape validation before SQL/argv; per-candidate delete; defensive numeric clamp (Phase 4, TC-DB-026/027) |
| RSK-D9 | C-11 sign-off assumed rather than granted | H | M | Sign-off recorded as an owner merge gate; no approval claim; PR left open (Phase 5, TC-DB-038) |
| RSK-D10 | Baseline repair read as scope creep | L | M | Test-only recursive parent creation in Phase 1; no assertion/fixture change; structural floor and `ENOENT` control; Phase 5 verifies only (Phase 1, TC-DB-035) |
| RSK-D11 | Missing prototype leads to a surface the owner would have specified differently | M | M | PM fallback is durable/reversible; owner may amend at PR review (Context, D10) |
| RSK-P1 | A coder re-derives repeat handling and rejects repeated same-flag occurrences the parser would have resolved | M | M | Consume the parser-resolved value; declare no `conflicts`; never re-scan raw argv to reject a repeat; G-12 asserts `--apply --apply` as apply and the last `--limit` winning at exit 0 (spec §3.1, PIN-5, TC-DB-023) |
| RSK-P2 | Missing-value cases accidentally route to parser `fallback.invocation` | M | M | Do not declare `requiresValue`; handler owns value parsing; G-07/G-08 asserted (PIN-5, TC-DB-023) |
| RSK-P3 | A phase overruns the single run | M | M | Stop at the last green task boundary; never enlarge or split the phase commit; report (D7) |
| RSK-P4 | Inventory/content-inventory, port-contract fixture, or seam assertions regress | M | M | Update the exact files in the phase that introduces the module (Phase 1 contracts/domain/port fixture, Phase 2 adapter, Phase 4 `db`/edge); `pnpm check` every phase; Phase 5 verifies only (D8, Phases 1/2/4) |
| RSK-P5 | Changeset lists only three packages and violates the fixed group | L | M | PIN-10 lists all five; `scripts/checks/changesets-group.ts` stays green (Phase 5) |
| RSK-P6 | An error identity is non-conforming or a gate edit is smuggled in as an "allowance" | H | M | PIN-11: the four `db.*` identities match `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$`; `scripts/checks/error-table-sync.ts` is unchanged and the format is not widened; the only `error-table.test.ts` edit is additive (31 → 35, `db` prose, `db` rows) with every existing assertion preserved; any non-conforming identity is escalated, never accommodated (Phase 1) |

### Success Metrics

- NFR-D1: 0 output drift across replays; 0 ambient reads outside the seam; 100% byte-identical human replays.
- NFR-D2: 0 outputs over the item/line/byte caps; 0 ids over 128; 0 paths over 1024; 0 unbounded fields.
- NFR-D3: 0 live deletions; 0 sidecar/file mutations by prune; 0 second-run candidates; 0 non-converging retries; 0 parents deleted with children.
- NFR-D4: bounded work proven in CI (fixed/invariant query counts, one page query with `LIMIT`, at most one re-check/delete per candidate, one live-count query, at most one checkpoint, declared timeouts); the mandatory read-only real-store smoke (`db size`, `db list --limit 5`) recorded with a no-mutation confirmation; the latency reference measurement recorded as non-CI/deferred.
- NFR-D5: 0 tests needing a real binary/database/network/home; 0 real user paths added; 100% green including the repaired baseline.
- NFR-D6: 0 forbidden fields; 0 canary occurrences; 0 extra item/evidence fields; 0 ambient environment values surfaced.
- NFR-D7: 4/4 `db` codes round-trip; 0 documented drift both directions; 0 containment escapes; 0 ambiguous kind-only selections.
- NFR-D8: 0 untrusted values interpolated; 0 unvalidated ids in SQL/argv; 0 out-of-range numbers interpolated; 0 bulk `IN (...)`.
- NFR-D9: 0 new runtime-API locations; 0 allowlist additions; 0 SQLite driver imports; 0 new packages/subpaths/dependencies; 0 contracts-tier behaviour.
- NFR-D10: 0 failed deletes reported as success; 0 live sessions reported deletable; 0 absent sidecars reported as real zero-byte files; 0 `reboot` restart claims; 0 partial failures rendered as success; 0 post-land aborts reported as pre-land failures with no landed-count truth.

## Delivery-Phase Definition of Done

### Per-phase checklist

| Phase | Done means |
|---|---|
| 1 | Baseline repaired first (clean-checkout `ENOENT` control); contracts + pure policy + four rows + documented table landed together; additive `error-table.test.ts` update (31 → 35, `db` prose, `db` rows) green; port-contract fixture updated; content-inventory allowances for contracts/domain present; 4/4 rows round-trip; sync green both directions with non-zero counts; phase suites green; `pnpm check` exit 0; commit `feat(GH-180): add session-admin contracts, pure policy, and synchronized db error rows` |
| 2 | `OpencodeSessionIo` + size/list implemented; adapter content-inventory allowance present; fake IO and fixtures; size/list/privacy/import suites green; current `message`/`part` counts; zero mutations; `pnpm check` exit 0; commit `feat(GH-180): add opencode-backed session size and list with fake-IO fixtures` |
| 3 | Prune/reboot implemented; selection/live-count SQL predicates asserted; TOCTOU, idempotency, partial failure/post-land abort, absence, single checkpoint, no process/file action proven; prune/reboot/sql/import suites green; `pnpm check` exit 0; commit `feat(GH-180): add leaf-only prune and guarded reboot administration with TOCTOU and partial-failure proofs` |
| 4 | `db` command + edge composition; `db.ts` registered in inventory and its allowance/edge allowance present; grammar split, envelope/caps, privacy, SQL safety, composition-absent case proven; 5/5 phase suites green; `pnpm check` exit 0; commit `feat(GH-180): add db command and edge composition with grammar, output, privacy, and SQL-safety proofs` |
| 5 | Baseline repair verified only (no edit); inventory/allowances/seam verified; fixed-group changeset added; hermeticity and bounded-work oracles complete; mandatory non-CI real-store smoke recorded with a no-mutation confirmation; full CI battery including `changesets-group.ts` and `privacy-literals.ts` green; evidence authored; the `feature-autonomous-delivery.md` `session_message` → `message`/`part` correction and the ADR-0003 decision proposal and command-registry row recorded as a PM/`@decision-advisor` phase-7 handoff; `scripts/pm-liveness.sh` flagged as an out-of-scope follow-up; deferred non-CI notes recorded; no PR/push/merge; commit `test(GH-180): verify db surfaces, record real-store smoke and aggregate evidence` |

### Change-level DoD (delivery handoff)

- **All 38 TCs green or explicitly deferred**: only the non-CI TC-DB-037 reference measurement and the PR-body half of TC-DB-038 may be deferred; all 18 ACs traceable to passing TCs.
- **`pnpm check` aggregate green** on the final HEAD; focused suites, boundaries, error-table sync, ambient, secret-read, entrypoint, exit-literal, forbidden-literal, `changesets-group`, and `privacy-literals` checks green; the full `ts-invariants` battery from `.github/workflows/ci.yml` is recorded; no gate weakened or bypassed.
- **Error-table sync green in both directions** with non-zero counts; the four `db` rows exist exactly once in both the machine table and `doc/spec/features/feature-result-contract.md`; `tests/structure/error-table.test.ts` passes with 35 entries, `db` in the declared-kind prose, and the `db` rows; `scripts/checks/error-table-sync.ts` and the error-code format are unchanged.
- **Safety invariants**: dry-run mutates nothing; apply deletes only cold/non-live/leaf sessions through one official delete per candidate; TOCTOU, vanished-row, and absent-row cases are counted skips; partial failure and post-land abort are never success and carry the normative landed/failed summary; reboot blocks on a live session and checkpoints exactly once otherwise; no process kill and no sidecar deletion.
- **Grammar invariants**: `db size -x` is `input.value.rejected`; `db size --x` is `fallback.invocation`; both exit 1 with zero I/O; `prune --json` succeeds; repeated same-flag occurrences are last-wins at exit 0 (`--apply --apply` applies; the last `--limit` wins); missing values, out-of-range numbers, and `--apply false` are `input.value.rejected`.
- **Privacy and boundedness**: machine data ≤ 524288 bytes; human ≤ 32 item lines/40 lines/8192 bytes; `+N more` truthful; zero canary/forbidden fields/real user paths.
- **Surface invariants**: contracts data-only; domain pure; `node:child_process`/`node:fs` only in `adapters/src/session/index.ts`; no SQLite driver; secret-read allowlist exactly four; no new package/subpath/dependency/lockfile; `db` registered only with a composition.
- **Baseline and release**: repaired defaults-position suite green in a clean checkout (repair landed in Phase 1, verified in Phase 5); fixed-group minor changeset present; mandatory non-CI read-only real-store smoke recorded with a before/after no-mutation confirmation; evidence complete with rollback; no protected path touched; nothing from `.ai/local/` or `tmp/` staged.
- **Handoff**: no PR created, pushed, or merged by `@coder`; the ADR-0003 C-11 privacy sign-off remains an owner merge gate with no approval claimed; lifecycle phase 7 reconciliation is recorded as a deferred handoff, including the `doc/spec/features/feature-autonomous-delivery.md` correction (`session_message` is not the current message store; `message`/`part` are, with `session_message` 0 / `message` ~213k / `part` ~961k), the ADR-0003 reconciliation/decision-record proposal for the mutating `SessionAdminPort` (PM/`@decision-advisor`), and the CLI command-registry delivery row; `scripts/pm-liveness.sh` is recorded as an out-of-scope owner follow-up (NG-D7).

## Artifacts and Links

| Artifact | Location | Role / handling |
|---|---|---|
| Change specification (v1.5) | [chg-GH-180-spec.md](./chg-GH-180-spec.md) | Source of 18 ACs, F-D1..F-D7, DM-D1..DM-D8, NFR-D1..NFR-D10, DEC-D1..DEC-D11, RSK-D1..RSK-D14, pinned constants, grammar split with repeated-flag last-wins, pinned item field sources, byte-exact `dataBytes`, and current `message`/`part` store |
| Test plan (v1.4, 38 TCs) | [chg-GH-180-test-plan.md](./chg-GH-180-test-plan.md) | Source of TC IDs, suites, grammar/boundary/range/id matrices (G-12 last-wins), SQL-predicate and field-source oracles, fixtures/fakes, mandatory non-CI real-store smoke, remaining non-CI gaps |
| PM notes | [chg-GH-180-pm-notes.yaml](./chg-GH-180-pm-notes.yaml) | PM decisions, fallback, baseline repair, standing rules |
| This plan | `./chg-GH-180-plan.md` | The only file written by this authoring pass |
| Session contracts | `packages/core/src/contracts/session.ts` | New; PIN-1 data-only vocabulary |
| Session policy/renderer | `packages/core/src/domain/session-admin.ts` | New; PIN-2 pure policy and human text |
| Error rows (machine + documented) | `packages/core/src/contracts/error-table.ts`, `doc/spec/features/feature-result-contract.md` | Four `db` rows shipped in Phase 1; documented section never rewritten later; `error-table.test.ts` updated additively |
| Session adapter | `packages/adapters/src/session/index.ts` | Implemented; PIN-3/PIN-4 the only new I/O location |
| CLI command and edge | `packages/cli/src/commands/db.ts`, `commands/index.ts`, `edge.ts` | New/updated; PIN-5/PIN-6 |
| Test fixtures/fakes | `tests/fixtures/session-admin/**` | New; PIN-9 hermetic fake IO, boundaries, malformed, ids, canary, goldens, mutants |
| Port-contract inventory fixture | `tests/fixtures/ports/v1-contract-inventory.json` | Updated in Phase 1; `session.ts` exports and `index.ts` re-exports (B3) |
| Baseline repair | `tests/checks/config-default-positions.test.ts` | Test-only parent-directory creation (Phase 1; verified Phase 5) |
| Changeset | `.changeset/db-session-admin-minor.md` | New; fixed-group minor (Phase 5) |
| Delivery evidence | `./chg-GH-180-evidence.md` | New in Phase 5; per-phase commits, gates, TC map, real-store smoke record, deferred non-CI notes, rollback |
| Phase-7 decision/doc handoff | `doc/spec/features/**` (incl. `feature-autonomous-delivery.md`: `session_message` → current `message`/`part`), `doc/overview/glossary.md`, `doc/decisions/ADR-0003-oss-monorepo-structure.md` or a new decision record, `doc/planning/oss-tooling/cli-command-registry.md` | Recorded, not executed; ADR-0003 reconciliation/decision proposal owned by PM/`@decision-advisor`; `scripts/pm-liveness.sh` is an out-of-scope follow-up (NG-D7) |
| Referenced decisions/specs | [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md), [feature-adapter-ports.md](../../../spec/features/feature-adapter-ports.md), [feature-result-contract.md](../../../spec/features/feature-result-contract.md) | Tier, port, and result contracts; referenced, not rewritten; ADR-0003 reconciliation is a phase-7 handoff |

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T21:10:00Z | Implementation Plan Writer | Initial plan for spec v1.1 and test plan v1.1. Five delivery phases, 40 tasks, all 38 TCs mapped (38/38) with 18/18 ACs covered; PIN-1..PIN-11 resolve the delivery-bound spellings without reshaping any TC or AC; the two-class grammar split is implemented against the unchanged parser (`db size -x` → `input.value.rejected`, `db size --x` → `fallback.invocation`); PIN-11 originally recorded an exact-code allowance for a hyphenated error identity (superseded in 1.1); includes the scoped defaults-position repair, fixed-group changeset, hermetic fixtures, non-CI deferrals, rollback, and delivery DoD. |
| 1.1 | 2026-10-31T21:20:00Z | Implementation Plan Writer | Targeted amendment for spec v1.2 and test plan v1.2. The reboot live-session failure identity is `db.reboot.live`, which conforms to `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$`, so PIN-11 is redefined as an error-identity conformance pin and the hyphen-allowance task is removed. `scripts/checks/error-table-sync.ts` and `tests/structure/error-table.test.ts` are no longer edited: the `db` row and containment assertions live in the new contract test (TC-DB-003/005) and the `db` drift controls in the existing TC-DB-004 sync-test suite. Task count 40 → 39 (Phase 1 8 → 7); all 38 TCs remain mapped (38/38) and no phase, AC, or TC→phase mapping changes. |
| 1.2 | 2026-10-31T22:30:00Z | Implementation Plan Writer | DoR iteration-1 delivery-planning remediation for spec v1.4 and test plan v1.3. **B1:** PIN-11/D11/Phase 1 now permit the additive edits to `tests/structure/error-table.test.ts` (`ERROR_TABLE` 31 → 35, declared-kind prose includes `db`, `db` row/kind-only containment assertions) while `scripts/checks/error-table-sync.ts` stays unchanged and the error-code format is not widened. **B2:** each exact `content-inventory` allowance moves to the phase that introduces the file (Phase 1 contracts/domain, Phase 2 adapter, Phase 4 `db` command/`commands/index`/edge); `cli/src/commands/db.ts` registers in `inventory.json` in Phase 4; Phase 5 verifies only. **B3:** `tests/fixtures/ports/v1-contract-inventory.json` is added to Phase 1 with the `session.ts` exports and the `index.ts` re-exports. **M5:** the ADR-0003 reconciliation/decision-record proposal for the mutating `SessionAdminPort` and the CLI command-registry delivery row are added to the phase-7 doc handoff, owned by PM/`@decision-advisor` and explicitly not a `@coder` task. **M6:** the scoped baseline repair moves to Phase 1 task 1.1; Phase 5 verifies only. **M7:** the full `ts-invariants` battery, including `changesets-group.ts` and `privacy-literals.ts`, is added to Phase 5 and the evidence. **M4:** the mandatory non-CI read-only real-store smoke is added to Phase 5. Message-store counts now reference `message`/`part` (`session_message` only legacy/not-counted/delete-cascade); the partial-failure summary is aligned to `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"`; spec v1.4 and test plan v1.3 are referenced. **m6:** Constraints now state no gate is weakened or bypassed and list the allowed additive test updates. Task count 39 → 42 (Phase 1 7 → 10; Phases 2–5 unchanged at 7/8/8/9); 38/38 TCs and 18/18 ACs remain mapped. |
| 1.3 | 2026-10-31T23:10:00Z | Implementation Plan Writer | DoR iteration-2 delivery-planning remediation for spec v1.5 and test plan v1.4. **B6:** repeated same-flag occurrences are now last-wins everywhere — PIN-5 item 5, task 4.1/4.3 (G-01..G-05, G-07..G-11, G-13 reject; G-12 is an exit-0 last-wins acceptance case), the Execution Notes grammar discipline, RSK-P1, and the Change-level DoD grammar invariant; the rejection claim is removed and `prune --apply false` (G-11) stays a rejection. **M8:** task 1.7 now names the three existing `DOMAIN_KINDS` literal-replacement controls in `tests/checks/error-table-sync.test.ts` (`TC-STATE-019` `:400`, `TC-SYNC-008` lint `:485`, `TC-VERIFY-019` `:959`) and moves their search literal to the new seven-kind array so Phase 1's 8-suite gate is green; assertions are otherwise unchanged, `scripts/checks/error-table-sync.ts` stays unchanged, and the code format is not widened. **M9:** task 5.8, the Phase 5 doc list, the per-phase DoD, the change-level handoff, and the artifacts table add `doc/spec/features/feature-autonomous-delivery.md` with the `session_message` → `message`/`part` current-store correction and the reference facts (`session_message` 0; `message` ~213k; `part` ~961k); `scripts/pm-liveness.sh` is recorded as out of scope (NG-D7) and an owner follow-up. **M11:** `tests/behaviour/error-classification.test.ts` is marked Updated in the File Layout, task 1.6/1.7 and the Phase 1 code-area list place the TC-DB-005 `db` kind-only/wrong-code/exact-code cases there, and the new contract test is scoped to TC-DB-001/TC-DB-038; the traceability mapping is unchanged. **m10:** the `cli-edge-seam.test.ts` human-text declarer expectation is pinned to the sorted full-path pair `["packages/cli/src/commands/db.ts", "packages/cli/src/commands/status.ts"]` (`:415-418`, `listTypeScriptFiles` order), replacing the wrong order/prefix. **m11 alignment:** task 2.3/2.4 now pin byte-exact `dataBytes` (`LENGTH(CAST(... AS BLOB))`) and the `time_created`/`time_updated`/`time_archived` field sources. Inputs now cite spec v1.5 and test plan v1.4. Task count remains 42; 38/38 TCs and 18/18 ACs remain mapped. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| Authoring | Complete | 2026-10-31T21:10:00Z | 2026-10-31T21:10:00Z | none | Read the completed spec v1.1, test plan v1.1, PM notes, the implementation-plan template, the GH-179 and GH-175 plan precedents, the current contracts/adapters/CLI/structure/check code, the changeset config, and the current branch state. Only this plan file was written; no code, build, test, quality gate, or git operation was performed. |
| Authoring (amendment) | Complete | 2026-10-31T21:20:00Z | 2026-10-31T21:20:00Z | none | Applied the PM-requested PIN-11 amendment against spec v1.2 and test plan v1.2: renamed the reboot identity to `db.reboot.live`, removed the hyphen-allowance task and every gate/format-test edit, and re-scanned the plan (0 retired-spelling matches; 0 tasks touching `error-table-sync.ts` or `tests/structure/error-table.test.ts`). 39 tasks; 38/38 TC→phase mapping unchanged. No code, quality gate, or git operation was run. |
| Authoring (amendment 1.2) | Complete | 2026-10-31T22:30:00Z | 2026-10-31T22:30:00Z | none | Applied the DoR iteration-1 delivery-planning remediation against spec v1.4 and test plan v1.3: B1 additive error-table test update, B2 per-phase allowances, B3 port-contract fixture, M4 real-store smoke, M5 ADR/command-registry handoff, M6 baseline sequencing, M7 full CI battery, m6 constraint wording, and the message-store/summary alignment. 42 tasks; 38/38 TC→phase mapping and 18/18 AC coverage unchanged. No code, quality gate, or git operation was run. |
| Authoring (amendment 1.3) | Complete | 2026-10-31T23:10:00Z | 2026-10-31T23:10:00Z | none | Applied the DoR iteration-2 delivery-planning remediation against spec v1.5 and test plan v1.4: B6 repeated-flag last-wins, M8 three `error-table-sync.test.ts` `DOMAIN_KINDS` literal controls, M9 `feature-autonomous-delivery.md` phase-7 reconciliation plus the `pm-liveness.sh` follow-up, M11 TC-DB-005 placement in `error-classification.test.ts`, m10 the sorted full-path human-text declarer pair, and the byte-exact `dataBytes`/field-source alignment. Verified against the current test sources (`error-table-sync.test.ts` `:400`/`:485`/`:959`; `cli-edge-seam.test.ts` `:415-418`). 42 tasks; 38/38 TC→phase mapping and 18/18 AC coverage unchanged. No spec, test plan, code, quality gate, or git operation was run. |
| 1 | Complete | 2026-10-31 | 2026-10-31 | `feat(GH-180): add session-admin contracts, pure policy, and synchronized db error rows` | Baseline repaired first; 23 constants + ports + pure policy landed; 35-row error table and documented table synchronized; focused 8/8 suites = 157 pass, 0 fail; `bun run scripts/checks/error-table-sync.ts` exit 0 (entries=35 documented=35); `pnpm check` exit 0. SHA recorded in `chg-GH-180-evidence.md`. |
| 2 | Complete | 2026-10-31 | 2026-10-31 | `feat(GH-180): add opencode-backed session size and list with fake-IO fixtures` | `OpencodeSessionIo` + read store implemented; fake IO/fixtures landed; focused 3/3 suites = 41 pass, 0 fail; `bun test tests/boundaries` 132 pass; secret-read clean; `pnpm check` exit 0. **Deviation:** the fixed-group minor changeset landed in Phase 2 instead of Phase 5 because the pre-existing release gate fails as soon as `packages/**` changes; Phase 5 verifies it only. SHA recorded in `chg-GH-180-evidence.md`. |
| 3 | Complete | 2026-10-31 | 2026-10-31 | `feat(GH-180): add leaf-only prune and guarded reboot administration with TOCTOU and partial-failure proofs` | Prune/reboot implemented; selection/live-count SQL predicates asserted; TOCTOU, idempotency, partial failure/post-land abort, absence, one checkpoint and no process/file action proven; focused 4/4 suites = 54 pass, 0 fail; `pnpm check` exit 0. **Deviation:** TC-DB-026 I-04 lists `x--y` as invalid, but the pinned `DB_SESSION_ID_PATTERN` admits it; the suite treats it as a valid control and keeps quotes, spaces, semicolons, newlines, comment markers and over-cap ids as invalid. SHA recorded in `chg-GH-180-evidence.md`. |
| 4 | Complete | 2026-10-31 | 2026-10-31 | `feat(GH-180): add db command and edge composition with grammar, output, privacy, and SQL-safety proofs` | `db` command + edge composition landed; grammar split, envelope/caps, goldens, privacy/canary, SQL/id safety, and composition-absent/present proven; phase 5/5 suites = 73 pass, 0 fail; full `pnpm check` exit 0 (1754 tests). SHA recorded in `chg-GH-180-evidence.md`. |
| 5 | Complete | 2026-10-31 | 2026-10-31 | `test(GH-180): verify db surfaces, record real-store smoke and aggregate evidence` | Baseline verified (6 pass; `ENOENT` + idempotent creation proved); hermeticity/bounded-work oracles completed; real-store smoke executed read-only (partial no-mutation because the host was live; no deletes/checkpoint/truncation); fixed-group minor changeset verified; `bun test` 1754 pass / 2 pre-existing skips / 0 fail; 18/18 invariants; `pnpm check` exit 0; evidence at `chg-GH-180-evidence.md`; phase-7 handoff recorded. |
