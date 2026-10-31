---
ados_distribution: internal
id: SPEC-SESSION-DATABASE-ADMIN
status: Current
created: 2026-10-31
last_updated: 2026-10-31
owners: ["engineering"]
service: delivery-os
summary: "The typed `ados db` session-database administration surface: four closed subcommands (`size`, `list`, `prune`, `reboot`) over the opencode SQLite session store, a read-only `SessionStorePort` for size/list and a mutating `SessionAdminPort` for prune/reboot, dry-run-by-default mutation, the 15-minute activity-based live window, the 30-day default prune threshold, leaf-only candidate selection with a pre-delete TOCTOU re-check, official `opencode session delete` per candidate, one bounded WAL checkpoint on reboot, the `message`/`part` current store pin with legacy-empty `session_message`, the `db` error kind and four rows, bounded metadata-only output, and the ADR-0003 C-11 owner merge gate."
links:
  related_changes: ["GH-180"]
  related_decisions: ["ADR-0003", "ADR-0010"]
  contracts:
    - "packages/core/src/contracts/session.ts"
    - "packages/core/src/contracts/error-table.ts"
---

# Feature: Session Database Administration

## Overview

`ados db` is the typed administration surface for the harness session database — the opencode SQLite store. It has exactly four subcommands: `size`, `list`, `prune`, and `reboot`. All four are metadata-only. `size` and `list` are read-only. `prune` and `reboot` are dry-run by default and mutate only with `--apply`.

The surface is the only product-code path to session administration. Production I/O lives in `@delivery-os/adapters/session` and reaches the database exclusively through the opencode CLI (`opencode db path`, `opencode db "<SQL>" --format json`, `opencode session delete <id>`). No package, subpath, dependency, SQLite binding, or new runtime-API location is introduced. Contracts in `core ./contracts` are types and `as const` data only; pure policy in `core ./domain/session-admin` owns candidate selection and rendering; the CLI command definition validates grammar and delegates to the ports.

Two ports split the surface. `SessionStorePort` preserves ADR-0003's read-only `SessionStore` semantics with `size` and `list`. `SessionAdminPort` extends the read surface with the mutating `prune` and `reboot` operations. The adapter implements both over one injected `OpencodeSessionIo` seam, and the CLI edge composes them. This split keeps the published read-only contract intact while adding mutation behind a distinct interface.

Safety is the product. A prune candidate is a session older than the declared threshold, outside the live window, and a leaf (no other session names it as `parent_id`). Candidate conditions are re-checked immediately before each delete. Deletes go one by one through `opencode session delete <id>`; the database file, WAL, and SHM sidecars are never deleted or truncated by `prune`. `reboot --apply` performs one bounded `PRAGMA wal_checkpoint(TRUNCATE)` only when no live session exists, never kills a process, never removes a sidecar, and instructs the operator to restart the host manually.

Every output is bounded and metadata-only. The allowed surface is session identifiers, parent identifiers, counts, byte sizes, ISO-8601 timestamps, booleans, the runtime-resolved database path, declared flag values, and declared counts. No title, prompt, message body, part data, credential, environment value, or command argument is read into output. ADR-0003 C-11 requires an explicit privacy sign-off before the `db` administration engine ships; that sign-off is an owner merge gate and is not claimed by the implementation.

The surrounding result contract is described in [Result Contract and Error Table](feature-result-contract.md); the adapter substrate and secret-read boundary in [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md); package tiers and runtime confinement in [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md). Package placement follows [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).

## Business Context

### Problem Statement

- **Problem:** The opencode session database grows without bound, and there is no supported admin surface. Existing scripts read it through ad-hoc `opencode db` and `opencode session list` calls, but nothing prunes cold sessions, reports bounded store size, or prepares the store for a host restart. Hand-written deletion risks damaging live sessions or the database files because `session.parent_id` has no foreign key and descendants do not cascade.
- **Affected Users:** The operator managing a large local opencode store, the coordinator that needs bounded store facts during recovery, lifecycle agents that need a typed metadata read, and security reviewers confirming the metadata-only guarantee.
- **Business Impact:** Reclaimable storage without live-session damage, one typed admin path instead of ad-hoc SQL, truthful bounded facts, an auditable privacy boundary, and a merge gate that makes the C-11 sign-off explicit rather than assumed.

### Goals

- Provide four closed subcommands with dry-run defaults and `--apply` as the only mutation switch.
- Make prune idempotent and safe to re-run; never delete a live session or a leaf with children.
- Keep the read-only `SessionStorePort` and add mutation only through `SessionAdminPort`.
- Reach the store exclusively through the opencode CLI and never through a direct SQLite binding.
- Return bounded, deterministic, metadata-only output in machine and human modes.
- Ship classified `db.*` failure identities with documented error-table rows in the same change.

## User Experience & Functionality

### Command surface and grammar

`ados db <subcommand> [flags]`. The subcommand set is closed: `size`, `list`, `prune`, `reboot`. The only global flag is `--json`, supplied by the CLI, which changes rendering only. Grammar is validated before any I/O.

| Subcommand | Positionals | Flags | Mutation |
|---|---|---|---|
| `size` | none | none (beyond global `--json`) | none |
| `list` | none | `--limit <n>` (optional; default 20; min 1; max 100) | none |
| `prune` | none | `--older-than <days>` (default 30; min 1; max 3650), `--limit <n>` (default 50; min 1; max 500), `--apply` (boolean) | only with `--apply` |
| `reboot` | none | `--apply` (boolean) | only with `--apply` |

A missing or unknown subcommand, an unexpected positional within the declared positional capacity (including a single-dash token such as `-x`), a declared flag used on the wrong subcommand, a missing flag value, or a numeric value outside its declared range is a classified `input.value.rejected` rejection with exit `1`; no state is read and no mutation is attempted. An undeclared `--`-prefixed token, or a positional beyond the parser capacity, is contained by the parser as `fallback.invocation` at exit `1`. `--apply` is boolean; a value-bearing `--apply` such as `prune --apply false` is rejected by the handler as `input.value.rejected`, while the undeclared exact token `--apply=false` is contained by the parser as `fallback.invocation`. Repeated occurrences of the same flag are last-wins at the shared parser; `db` declares no conflicting pairs.

### `db size`

Read-only. Resolves the database path at runtime through `opencode db path` — the path is never a committed literal — and reports:

- database path, database bytes, WAL bytes, SHM bytes, and whether each sidecar is present;
- session count, message count, and part count;
- oldest and newest session `time_updated` as ISO-8601 UTC strings, or `null` when the session table is empty.

Message count is over `message`, the current message store on the reference opencode 1.19.3 schema; parts are counted over `part`. `session_message` is the legacy/alternate store and is empty on the reference store, so it is not counted anywhere; counting it would report zero messages on a fully populated store. Sidecar absence is explicit (`walPresent: false`, `shmPresent: false`, bytes `0`), so an absent file is never confused with a real zero-byte file. `size` performs no writes, fences, or checkpoints.

### `db list`

Read-only. `list` issues exactly two read queries: one total-session count and one bounded page query. The page selects the ordered page of `session` rows and derives the three per-item aggregates in that same statement over the current `message` and `part` stores: `messageCount`, `partCount`, and `dataBytes`. `dataBytes` is a UTF-8 byte count, measured with `LENGTH(CAST(... AS BLOB))` rather than a character count, and is read as a length only, never returned as content.

The page returns at most `--limit` items (default 20, max 100), ordered by `updatedAt` descending then `id` ascending, with `total`, `omitted`, and `truncated`. Each item carries exactly: `id`, optional `parentId`, `createdAt`, `updatedAt`, `messageCount`, `partCount`, `dataBytes`, `archived`, and `live`. Field sources are pinned: `createdAt = session.time_created`, `updatedAt = session.time_updated`, `parentId = session.parent_id`, and `archived = session.time_archived IS NOT NULL` (the schema has no `archived` column). `live` is computed from the injected clock against the 15-minute window. `session_message` is never read here.

### `db prune`

Dry-run by default; mutating only with `--apply`.

**Candidate rule.** A session is a prune candidate when all three conditions hold:

1. **Cold:** `time_updated < now - older-than-days` (strict; a session exactly at the boundary is not cold).
2. **Not live:** `time_updated < now - 15 minutes` (the live window is inclusive at its lower boundary; a session exactly 15 minutes old is live).
3. **Leaf:** no other session row has `parent_id` equal to the candidate's `id`.

Candidates are ordered oldest-first by `time_updated`, then `id` ascending, and capped at `--limit` (default 50, max 500). The same pure predicate drives selection interpretation and the pre-delete re-check, so the two cannot drift.

**TOCTOU guard.** Candidate conditions are re-checked immediately before each delete. A candidate that gained a child between selection and delete is skipped so no orphan is created; a row that vanished is a skip. The cold and live conditions ride the same re-read. Skip reasons are counted, never fabricated as success.

**Leaf-only rationale.** `session.parent_id` has no foreign key and descendant sessions do not cascade. Deleting a session with children would orphan them, so a session with any child is never eligible. A child session with no children is a leaf and is eligible; a parent becomes eligible only after its last child has been removed by an earlier run.

**Liveness.** Liveness is activity-based only: a session is live when `time_updated` falls inside the 15-minute window. There is no PID or lock-file probe, so an open-but-idle session older than `--older-than` is a prune candidate. That narrowed definition is the current contract.

**Deletion path.** A delete is one `opencode session delete <sessionID>` invocation per candidate. The command cascades message, part, session_message, session_share, session_input, session_context_epoch, and todo rows through opencode's own implementation. `prune` never issues a raw `DELETE`, never drops or truncates a table, and never deletes or truncates the database file, WAL, or SHM. After a delete invocation reports failure, one bounded post-delete existence read by id distinguishes an absent row (a counted skip) from a failed delete. After at least one delete lands, an aborting query, re-read, or availability failure stops the run and returns `db.delete.failed` with the bounded partial-abort summary.

**Idempotency and partial truthfulness.** A second identical run selects zero candidates because the first run removed them. Dry-run is repeatable and mutates nothing. A failed delete leaves its row in place, so a later run selects it again. An already-absent row at delete time is a skipped outcome, not a hard mid-run failure. When one or more deletes fail, the command returns the classified `db.delete.failed` failure (exit `2`, transient, retryable) whose bounded summary is exactly `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"`, where `attempted = landed + failed` and `<id>` is the first failed session identity.

### `db reboot`

Dry-run by default; `--apply` performs the only mutation.

1. Count sessions inside the live window, using the pinned 15 minutes from the injected clock.
2. **Dry-run:** return the live-session count, `blockedByLiveSession` (true when the count is non-zero), current WAL bytes, and `checkpointPerformed: false`. A dry-run never returns the live-session failure.
3. **Apply with any live session:** return the classified `db.reboot.live` failure and perform nothing. No checkpoint, no delete, no process action.
4. **Apply with no live session:** perform exactly one bounded `PRAGMA wal_checkpoint(TRUNCATE)` through `opencode db`, report bytes before and after, and the outcome. It never kills or signals a process, never deletes WAL or SHM files, never runs `VACUUM`, and never truncates the database.

The human output states that the operator still restarts the opencode host manually; `reboot` only prepares the database.

### Output contract

Machine mode is exactly one standard `CommandResult` envelope. Its `data` is the `delivery.session-admin.v1` payload for the subcommand. Success envelopes carry no `error` key; failure envelopes carry no `data` key. All timestamps in output are ISO-8601 UTC strings; the database stores epoch milliseconds and conversion happens once at the boundary.

Data shapes:

- **`size`** — `{ schemaVersion, command: "size", database: { path, dbBytes, walBytes, shmBytes, walPresent, shmPresent }, counts: { sessions, messages, parts }, oldestSessionUpdatedAt: string | null, newestSessionUpdatedAt: string | null }`.
- **`list`** — `{ schemaVersion, command: "list", limit, total, omitted, truncated, items: SessionSummary[] }`, where `SessionSummary` is the nine-field item shape above.
- **`prune`** — `{ schemaVersion, command: "prune", mode: "dry-run" | "applied", olderThanDays, limit, liveWindowMinutes, cutoff, counts: { selected, deleted, failed, skipped, liveExcluded }, candidates: SessionSummary[] }`. On partial failure the payload is a `db.delete.failed` error, not this data object.
- **`reboot`** — `{ schemaVersion, command: "reboot", mode, liveWindowMinutes, liveSessions, blockedByLiveSession, checkpointPerformed, database: { path, walBytesBefore, walBytesAfter?, walPresent, shmPresent } }`.

Human mode renders from the same data and performs zero extra reads. It is bounded to 32 item lines, 40 total lines, and 8192 bytes, with `+N more` truncation. Output is deterministic: identical database state, injected clock, and flags produce byte-identical data and human text.

### Errors and exit codes

| Condition | Identity | Exit |
|---|---|---|
| Missing/unknown subcommand, an unexpected positional within the positional capacity (including a single-dash token such as `-x`), a declared flag used on the wrong subcommand, missing value, out-of-range numeric, value-bearing `--apply` such as `prune --apply false` | `input.value.rejected` | 1 |
| Undeclared `--`-prefixed token (including `--apply=false`), or a positional beyond the parser capacity | `fallback.invocation` | 1 |
| `opencode` unavailable, `opencode db path` fails, database absent/unreadable before any delete lands | `db.opencode.unavailable` | 2 |
| A session-database query or re-read fails, or returns a malformed result, before any delete lands | `db.query.failed` | 2 |
| A session delete did not land, or an aborting query/re-read/availability failure occurred after at least one delete landed (including partial failure) | `db.delete.failed` | 2 |
| `reboot --apply` while a live session exists | `db.reboot.live` | 2 |
| Unclassifiable failure | `fallback.internal` | 2 |

The `db` kind is multi-row, so classification is by exact code; a kind-only `db` error is contained by `fallback.internal` rather than selecting a first row.

## Technical Architecture & Codebase Map

### Components and tiers

| Path | Role |
|---|---|
| `packages/core/src/contracts/session.ts` | `delivery.session-admin.v1` vocabulary, command/mode enums, bounds, defaults, live window, flag ranges, item and result shapes, `SessionStorePort`, and `SessionAdminPort`. Types and `as const` data only; no I/O, clock, randomness, or environment. |
| `packages/core/src/domain/session-admin.ts` | Pure policy and rendering over injected facts: cutoff and live-boundary computation, candidate predicate and ordering, capping, result assembly, and deterministic human text. |
| `packages/core/src/contracts/error-table.ts` | `db` in `DOMAIN_KINDS` and the four `db.*` rows as data. |
| `packages/adapters/src/session/index.ts` | Production `OpencodeSessionIo` and the adapter implementations of `SessionStorePort` and `SessionAdminPort`. The only session-admin file admitted to use `node:child_process` and `node:fs`. |
| `packages/cli/src/commands/db.ts` | `ados db` command definition and `DbCommandRuntime`; grammar validation before I/O; no stream writes and no exit-code choice. |
| `packages/cli/src/edge.ts` | `DbComposition` and `createDbCommandRuntime`; registers `commands.db` only when the composition is provided. |
| `packages/cli/src/index.ts`, `classify.ts`, `projection.ts`, `output/` | Consumed unchanged: the shared parser, classification chain, `{0, 1, 2}` projection, and redaction chokepoint. |

No new package, subpath, dependency, or `package.json`/lockfile change is introduced. `@delivery-os/adapters/session` already exists; the core `./contracts` subpath already exists.

### Ports and purity

`SessionStorePort` is the read-only surface:

- `size(): Promise<SessionSizeRead>`
- `list(input: { limit: number; nowMs: number }): Promise<SessionListRead>`

`SessionAdminPort extends SessionStorePort`:

- `prune(input: { olderThanDays: number; limit: number; apply: boolean; nowMs: number }): Promise<SessionPruneRead>`
- `reboot(input: { apply: boolean; nowMs: number }): Promise<SessionRebootRead>`

Each read returns `{ ok: true, value }` or `{ ok: false, error }`, where the error carries a declared `db.*` identity. Grammar and range rejections happen in the handler before any port call, so `input.value.rejected` never crosses a port boundary. The ports are plain interfaces in `core ./contracts`; the adapter implements them and the CLI composes them. No behaviour enters the contracts tier.

The pure policy module owns the deterministic rules: the cutoff (`nowMs - olderThanDays * 86_400_000`), the live boundary (`nowMs - 15 * 60_000`, inclusive), the candidate predicate over injected row facts (`updatedAtMs`, `hasChildren`), oldest-first ordering with an `id` tiebreak, capping, and result assembly. The adapter owns SQL, process invocation, and the pre-delete re-read.

### Production I/O seam

`OpencodeSessionIo` is the single injected seam. It is adapter-local and exported from `@delivery-os/adapters/session`, never a core contract. It declares:

- `databasePath(): Promise<string>` — resolves through `opencode db path`.
- `query(sql: string): Promise<readonly Record<string, unknown>[]>` — one single-statement `opencode db "<SQL>" --format json` call, parsed as a JSON array.
- `deleteSession(id: string): Promise<void>` — one `opencode session delete <id>` call.
- `checkpoint(): Promise<void>` — one `opencode db "PRAGMA wal_checkpoint(TRUNCATE)"` call.
- `now(): number` — injected epoch milliseconds.
- `stat(path: string): Promise<{ bytes: number; present: boolean }>` — bounded file metadata for the database and sidecars.
- `command` and `environment` injection — the opencode executable and the process environment arrive as data, never read ambiently.

`opencode db` accepts multi-statement input but returns `[]` for it, so the adapter issues exactly one statement per query invocation and never batches. A malformed JSON body or non-array result is `db.query.failed`, never an empty result. The executable and environment are injected; the adapter adds no secret-read allowlist entry.

### Data model

| ID | Element | Contract |
|---|---|---|
| DM-D1 | `SizeData` | Path, database/sidecar bytes with presence flags, session/message/part counts, oldest/newest session timestamps or `null`. |
| DM-D2 | `ListData` and `SessionSummary` | Bounded page and the whitelisted nine-field per-session item shape. |
| DM-D3 | `PruneData` | Mode, threshold, limit, live window, cutoff, five counts, and the attempted candidate summaries. |
| DM-D4 | `RebootData` | Mode, live window, live count, blocked flag, checkpoint outcome, and database/WAL facts. |
| DM-D5 | Vocabulary data | `DB_SCHEMA_VERSION`, the closed command set, and the closed mode set. |
| DM-D6 | Constants | Bounds, defaults, flag ranges, the live window, the id pattern, and the timeouts as `as const` data. |
| DM-D7 | Error identities | The `db` domain kind and the four rows, with kind, category, retryability, consequence, remediation hint, projection class, and summary. |
| DM-D8 | Ports and seam | `SessionStorePort` and `SessionAdminPort` in core contracts; the adapter-local `OpencodeSessionIo` seam. |

All timestamps in these shapes are ISO-8601 UTC strings, never raw epoch numbers. A session id longer than `DB_MAX_ID_CHARS` or a database path longer than `DB_MAX_PATH_CHARS` is not truncated; it is a `db.query.failed` failure naming the over-cap field.

### Pinned constants

| Constant | Value | Purpose |
|---|---|---|
| `DB_SCHEMA_VERSION` | `delivery.session-admin.v1` | Machine data schema version. |
| `DB_LIVE_WINDOW_MINUTES` | `15` | Live-session window; inclusive lower boundary. |
| `DB_DEFAULT_OLDER_THAN_DAYS` | `30` | Prune default age threshold. |
| `DB_MIN_OLDER_THAN_DAYS` | `1` | Prune threshold floor. |
| `DB_MAX_OLDER_THAN_DAYS` | `3650` | Prune threshold ceiling. |
| `DB_DEFAULT_LIST_LIMIT` | `20` | `db list` default page size. |
| `DB_MAX_LIST_LIMIT` | `100` | `db list` page ceiling. |
| `DB_DEFAULT_PRUNE_LIMIT` | `50` | `db prune` default batch size. |
| `DB_MAX_PRUNE_LIMIT` | `500` | `db prune` batch ceiling. |
| `DB_MIN_LIMIT` | `1` | Shared flag floor. |
| `DB_MAX_ID_CHARS` | `128` | Session-id output and interpolation cap. |
| `DB_MAX_TIMESTAMP_CHARS` | `32` | ISO-8601 UTC output cap. |
| `DB_MAX_PATH_CHARS` | `1024` | Runtime database-path output cap. |
| `DB_MAX_HUMAN_ITEMS` | `32` | Rendered item lines per human report. |
| `DB_MAX_HUMAN_LINES` | `40` | Human report line cap. |
| `DB_MAX_HUMAN_BYTES` | `8192` | Human report byte cap. |
| `DB_MAX_MACHINE_BYTES` | `524288` | Serialized `data` byte cap. |
| `DB_SESSION_ID_PATTERN` | `^[A-Za-z0-9_-]+$` | The only session-id shape admitted for interpolation or command use. |
| `DB_QUERY_TIMEOUT_MS` | `30000` | One read-query ceiling. |
| `DB_DELETE_TIMEOUT_MS` | `30000` | One delete-invocation ceiling. |
| `DB_CHECKPOINT_TIMEOUT_MS` | `120000` | The single checkpoint ceiling. |

### SQL discipline

Read set (each one single statement):

- Session counts and `min`/`max` `time_updated` over `session` for `size`.
- Message count over `message` and part count over `part` for `size`, as store-wide `COUNT(*)` aggregates.
- **`list` uses exactly two queries**: one total-session count and one ordered page over `session`. The page derives `messageCount`, `partCount`, and `dataBytes` with correlated scalar subqueries or an equivalent single-statement form, ordered by `time_updated DESC, id ASC` with a `LIMIT`. `LENGTH(CAST(... AS BLOB))` counts UTF-8 bytes rather than characters.
- **Current store pinning**: `message` is the current message store and `part` the current part store on the reference opencode 1.19.3 schema. `session_message` is the legacy/alternate store and is empty on the reference store; no `size` or `list` query references it. A future harness version that moves the store is handled by a versioned contract change that updates the pinned queries, not by a silent adapter edit.
- Candidate rows for `prune`: cold, outside the live window, and `NOT EXISTS` a child row, ordered oldest-first and limited.
- One pre-delete re-read per candidate by id, including a leaf check, immediately before the delete.
- One bounded post-delete existence read per failed delete, by id.
- Live-session count for `reboot`.

No untrusted value is concatenated into SQL. Session ids are validated against `DB_SESSION_ID_PATTERN` before any interpolation or command use; values read from the database are re-validated before reuse. Numeric flags are range-validated at the grammar and additionally clamped before interpolation as a defensive invariant. Deletes use one `deleteSession(id)` per candidate, so no bulk `IN (...)` list is interpolated.

## Security and Boundaries

### Metadata-only and privacy

The complete allowed surface is: session identifiers, parent identifiers, counts, byte sizes, ISO-8601 timestamps, booleans (archived, live, present, truncated, checkpoint performed), the runtime-resolved database path, declared flag values, and declared counts.

Forbidden in every output, error, evidence, fixture, and log: session titles, prompts, message bodies, part data, transcripts, credentials, environment values, command arguments, file contents, and any raw database row beyond the whitelist. The only path ever surfaced is the runtime-resolved database path; it is the tool's own store location and no real user or home path is committed to the repository. A canary-secret fixture asserts zero occurrences, and a field-whitelist assertion fails on any extra item or evidence field.

### Runtime-API confinement and secret-read boundary

`node:child_process` and `node:fs` are used only in `packages/adapters/src/session/index.ts`, an already-admitted I/O subpath. Core contracts stay data-only; the core domain stays pure; the CLI handler performs no I/O and no rendering. No new runtime-API location, ambient global, or module side effect is introduced. The production adapter adds no secret-read allowlist entry and reads no ambient environment: the executable and environment arrive through injected composition.

No direct `node:sqlite`, `bun:sqlite`, `better-sqlite3`, or equivalent import appears in product code, tests, or scripts. The only database access is the opencode CLI.

### Destructive-operation boundaries

- `prune` never deletes, truncates, renames, or rewrites the database file, WAL, or SHM. It deletes session rows only through `opencode session delete <id>`.
- `prune` never issues raw `DELETE`, `DROP`, `TRUNCATE`, `VACUUM`, or schema statements.
- `reboot` performs at most one `PRAGMA wal_checkpoint(TRUNCATE)`, only with no live session, and never deletes a sidecar.
- No process is killed, signalled, suspended, or restarted.
- Only leaf sessions are eligible; a parent with children is never deleted.
- A live session is never a candidate, and the pre-delete re-check closes the race between selection and deletion.

### ADR-0003 C-11 privacy sign-off gate

ADR-0003 requires an explicit privacy sign-off before the `db` administration engine ships. The sign-off is an owner merge gate: the pull request is delivered open and merge authority remains with the CEO/human owner. The implementation supplies the evidence the sign-off needs — the metadata-only whitelist, canary and whitelist tests, the no-SQLite-in-product-code check, and the destructive-operation boundaries — but the gate decision is external.

### Decision record

ADR-0003 describes `SessionStore` as read-only access to foreign session databases and never a mutation path. The delivered `SessionAdminPort` adds a public mutating surface while preserving the read-only `SessionStorePort`. This public, semver-visible extension is recorded in [ADR-0010](../../decisions/ADR-0010-session-admin-port-mutating-contract.md), which reconciles ADR-0003's read-only `SessionStore` clause without rewriting it.

## Non-Functional Requirements

| ID | Requirement | Threshold |
|---|---|---|
| NFR-D1 | Determinism: output drift across repeated runs with identical database state, injected clock, and flags; ambient clock, randomness, environment, or filesystem reads outside the declared seam; byte-identical human rendering. | 0 drift / 0 ambient reads / 100% byte-identical replays |
| NFR-D2 | Boundedness: list items, prune candidates, human item lines, total lines, human bytes, serialized data, ids, and paths stay within their declared caps; no unbounded field. | 0 over-cap outputs / 0 unbounded fields |
| NFR-D3 | Safety and idempotency: live sessions deleted; database/WAL/SHM files deleted or truncated by `prune`; candidates selected by a second clean apply; non-converging retries; parents deleted while children exist. | 0 / 0 / 0 / 0 / 0 |
| NFR-D4 | Performance on the reference environment (opencode 1.19.3, roughly 120 GiB store): `size`; `list`; prune selection; one pre-delete re-check; reboot live check; a 500-candidate apply. | ≤ 30 s / ≤ 10 s / ≤ 30 s / ≤ 250 ms each / ≤ 10 s / ≤ 180 s total |
| NFR-D5 | CI parity: tests requiring a real opencode binary, session database, network, home directory, or host-local state; committed real user paths; fixture content outside the whitelist. | 0 / 0 / 0 |
| NFR-D6 | Privacy and metadata-only: forbidden fields in output, error, evidence, fixture, or log; canary occurrences; extra item/evidence fields; ambient environment values surfaced. | 0 / 0 / 0 / 0 |
| NFR-D7 | Error-table binding: the four `db` codes round-trip with documented rows; drift in either direction; unclassified or wrong-code escapes; ambiguous kind-only selections. | 4/4 round-trip / 0 drift / 0 escapes / 0 ambiguous selections |
| NFR-D8 | SQL safety: untrusted values interpolated; session ids used before shape validation; numeric values outside declared ranges; bulk `IN (...)` interpolation. | 0 / 0 / 0 / 0 |
| NFR-D9 | Tier and runtime confinement: new runtime-API locations; secret-read allowlist entries; SQLite driver imports; new packages, subpaths, or dependencies; contracts-tier behaviour. | 0 / 0 / 0 / 0 / 0 |
| NFR-D10 | Operational truthfulness: mutation reported as success when a delete failed; live session reported as deletable; absent sidecar reported as a real zero-byte file; `reboot` claiming a host restart; partial failure rendered as success. | 0 occurrences |

## Quality Assurance Strategy

### Testing approach

| Level | Scope | Evidence |
|---|---|---|
| Structure | Contract inventory and constants, data-only contracts, pure domain imports, export surface, error-table rows and documented sync, no SQLite imports, no product literals, secret-read allowlist unchanged, boundary matrix unchanged | `tests/structure/session-admin-contract.test.ts`, `session-admin-imports.test.ts`, `tests/checks/error-table-sync.test.ts`, existing literal and boundary suites |
| Behaviour — size and list | Metadata fields, runtime path resolution, ordering, `--limit` bounds, `live` classification at the window boundary, empty-store `null` timestamps, sidecar presence, bounds, determinism | `tests/behaviour/session-admin-size-list.test.ts` |
| Behaviour — prune | Candidate rule across cold/live/leaf boundaries, oldest-first ordering, cap, dry-run zero mutations, apply deletes only candidates, TOCTOU skip when a candidate gains a child or disappears, idempotent second run, partial-failure and post-land partial-abort shape and summary, already-absent row skipped mid-run, pre-land abort | `tests/behaviour/session-admin-prune.test.ts` |
| Behaviour — reboot | Dry-run plan, live-session gate on `--apply`, zero action on the gate, one checkpoint on success, no file deletion, no process kill, WAL before/after | `tests/behaviour/session-admin-reboot.test.ts` |
| Behaviour — grammar and errors | Missing/unknown subcommand, positionals, undeclared flags, missing values, out-of-range numbers, `--apply` forms, parser containment, exit projection | `tests/behaviour/session-admin-grammar.test.ts` |
| Behaviour — output | Envelope validity on success and failure, schema version, machine byte cap, human grammar and caps, `+N more` truncation, byte-identical replays, no extra fields | `tests/behaviour/session-admin-output.test.ts` |
| Behaviour — SQL safety | Id shape validation before interpolation and before the delete command, injection attempts, numeric clamping invariant, no bulk interpolation, single-statement queries | `tests/behaviour/session-admin-sql-safety.test.ts` |
| Contract and privacy | Fake-IO conformance to both ports, read-only store surface, metadata-only whitelist, canary secret, mutation sensitivity | `tests/behaviour/session-admin-privacy.test.ts` |
| Aggregate | The whole workspace | `pnpm check` |

### Fixtures and fakes

`tests/fixtures/session-admin/**` holds synthetic session rows, synthetic path placeholders, malformed query responses, absent-sidecar cases, and a canary secret. No fixture contains a real path, title, prompt, message body, or part payload. A fake `OpencodeSessionIo` records calls (query text, deleted ids, checkpoint calls) and returns scripted results; it never spawns a process and never opens a file. Boundary fixtures are non-vacuous: live/not-live, cold/warm, leaf/parent, absent/present sidecar, and success/failure pairs are both exercised. Golden human output is committed, normalized, and regenerated by an explicit command only.

Read-only real-store smoke evidence for the reference environment is recorded in the GH-180 delivery evidence; it is non-CI and not a merge gate.

## Operational & Support

### Defaults and flags

| Subcommand | Default mode | Defaults | Mutation switch |
|---|---|---|---|
| `db size` | read-only | — | none |
| `db list` | read-only | `--limit 20` | none |
| `db prune` | dry-run | `--older-than 30`, `--limit 50` | `--apply` |
| `db reboot` | dry-run | — | `--apply` |

No user-facing configuration key, environment override, or state-schema addition is introduced. The live window, bounds, and defaults are contract data, not user configuration.

### Operator guidance

- Run `db size` first to confirm the store path and growth.
- Run `db list` to inspect bounded session metadata; raise `--limit` only up to 100.
- Run `db prune` without `--apply` and review candidates; apply only when the candidate set is expected.
- Expect leaf-only behaviour: any session with children is not eligible, so pruning proceeds bottom-up over repeated runs and child sessions without children are pruned first.
- `reboot --apply` is safe only when no session is active; an active session produces `db.reboot.live` and changes nothing. The operator still restarts opencode manually.
- A partial prune failure is safe to retry; failed rows remain and are selected again.

### Observability

The envelope's `runId` and `timing`, the per-run counts, the explicit mode, the cutoff and live-window values, and the bounded human report are the observability surface. No telemetry exporter, event sink, daemon, or background process is added. Logs and errors carry codes, counts, and identifiers only.

### Maintenance

- Changing a bound or default is a contract-data change plus tests and documentation.
- Adding a subcommand is a grammar, port, composition, and documentation change.
- Promoting a `db.*` failure to a different category or projection requires an error-table change with its documented row.
- Widening the metadata surface is a semver-visible change to the published adapter port and requires a reviewed privacy decision, because ADR-0003 makes the metadata-only guarantee a public contract obligation.

## Dependencies & Risks

- **Depends on** ADR-0003 tier rules and the admitted `adapters ./session` I/O subpath, plus the existing runtime-API confinement and secret-read boundary invariants.
- **Depends on** the result contract and error table for the envelope, classification chain, projection, redaction chokepoint, and binding documented sync.
- **Depends on** the CLI command-definition and composition precedent and the existing `humanText` hook.
- **Depends on** the opencode CLI surface `opencode db path`, `opencode db "<SQL>" --format json`, `opencode session delete <id>`, and the SQLite WAL mode of the session store.
- **Consumed by** operator and coordinator workflows that need bounded store facts; future harness telemetry may consume the same read port, but no telemetry is added here.
- **Risk — external opencode surface:** The `db path`, `db "<SQL>" --format json`, `session delete`, and WAL behavior are taken from recorded live environment facts, are not verifiable by repository tests, and can change. Mitigation: a single adapter seam, malformed results classified as `db.query.failed`, and no direct SQLite fallback.
- **Risk — live-session definition:** Liveness is activity-based only, with no PID or lock-file probe, so an open-but-idle session older than `--older-than` is prunable. The 15-minute window and conservative default threshold bound the exposure.
- **Risk — store-version drift:** `size` and `list` pin the message store to `message` and the part store to `part` because `session_message` is empty on the reference store. A harness version that moves the store is handled by a versioned contract change; a zero message count on a non-empty session table is a review smell.
- **Risk — metadata leakage:** Mitigation: a closed field whitelist, canary fixture, no-content reads, and the C-11 owner merge gate.
- **Risk — orphan damage:** Mitigation: leaf-only selection and the pre-delete re-check.

## Glossary & References

| Term | Definition |
|---|---|
| Session database | The opencode SQLite store that holds sessions, messages, parts, and related rows; the admin target of `ados db`. |
| Session admin | The typed `ados db` surface over the session database: `size`, `list`, `prune`, `reboot`. |
| `SessionStorePort` | The read-only session-store port with `size` and `list`; preserves ADR-0003's `SessionStore` semantics. |
| `SessionAdminPort` | The admin port that extends `SessionStorePort` with mutating `prune` and `reboot`. |
| Live window | The 15 minutes before the injected current time; a session with `time_updated` inside it is live. The lower boundary is inclusive. |
| Live session | A session inside the live window. It is never a prune candidate and blocks `reboot --apply`. |
| Prune candidate | A session that is cold, not live, and a leaf; ordered oldest-first and capped at the limit. |
| Leaf session | A session that no other session names as `parent_id`. |
| Cold | Older than the declared `--older-than` threshold; the boundary itself is not cold. |
| TOCTOU guard | The immediate pre-delete re-read that closes the race between candidate selection and deletion. |
| Partial abort | A prune in which some deletes landed and some did not, or a mid-run failure after at least one delete landed; reported as `db.delete.failed` with the bounded summary, never as success. |
| WAL checkpoint | The single `PRAGMA wal_checkpoint(TRUNCATE)` that folds the write-ahead log into the database; the only mutation `reboot --apply` performs. |
| Sidecar | The SQLite `-wal` and `-shm` files next to the database. Never deleted or truncated by this surface. |
| Current message store | The `message` table on the reference opencode 1.19.3 schema; the only message source for size counts and list aggregates. The current part store is `part`. |
| Legacy message store | The `session_message` table; present in the reference schema but empty on the reference store, so it is never counted or summed. |
| Metadata-only | The ADR-0003 C-11 rule that session and host inspection surfaces identifiers, counts, timestamps, and non-user paths only. |
| Session id shape | `^[A-Za-z0-9_-]+$`; the only id form admitted before interpolation or command use. |

References: [ADR-0003 — OSS Tooling Monorepo Structure](../../decisions/ADR-0003-oss-monorepo-structure.md) (DEC-6, C-11); [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md); [Result Contract and Error Table](feature-result-contract.md); [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md); [State Layer](feature-state-layer.md); [Status Digest](feature-status-digest.md); [CLI command registry](../../planning/oss-tooling/cli-command-registry.md) (M0-S11); [TypeScript rules](../../../.ai/rules/typescript.md); [testing strategy](../../../.ai/rules/testing-strategy.md).

**Change record:** `doc/changes/2026-10/2026-10-31--GH-180--db-session-admin-port/`.
