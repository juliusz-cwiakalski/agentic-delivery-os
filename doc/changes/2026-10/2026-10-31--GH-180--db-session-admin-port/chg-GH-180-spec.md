---
change:
  ref: GH-180
  type: feat
  status: Proposed
  slug: db-session-admin-port
  title: "M0-S11: db session-admin port"
  owners: [engineering]
  service: delivery-os CLI session-database administration
  labels: [change, planning]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: high
  dependencies:
    internal:
      - adapter ports and tier rules (ADR-0003)
      - result contract and error table (GH-172)
      - configuration layer (GH-173)
      - state layer (GH-174)
      - status command composition precedent (GH-175)
      - privacy and no-cloud guards (GH-184)
    external:
      - opencode CLI (db, session delete)
      - SQLite WAL mode session database
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/180
  related_changes: ["GH-170", "GH-172", "GH-173", "GH-174", "GH-175", "GH-177", "GH-184", "GH-188"]
  related_decisions: ["ADR-0003"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the `ados db` family as the M0-S11 session-database admin port — a typed, injectable, metadata-only admin surface over the opencode session database that reports bounded size and list facts, prunes only cold leaf sessions through the official delete command, and prepares the database safely for a manual host restart, with no direct SQLite binding, no live-session damage, and no user content in any output.

## 1. OVERVIEW

`ados db` becomes the typed admin surface for the harness session database — the opencode SQLite store. It has exactly four subcommands: `size`, `list`, `prune`, and `reboot`. All four are metadata-only. `size` and `list` are read-only. `prune` and `reboot` are dry-run by default and mutate only with `--apply`. Grammar is validated before any I/O, every result rides the standard `CommandResult` envelope, and the CLI edge owns streams, envelopes, redaction, and exit projection.

The change introduces one injected I/O seam, `OpencodeSessionIo`, and two core ports: the read-only `SessionStorePort` (ADR-0003's read-only `SessionStore` semantics preserved as `size`/`list`) and `SessionAdminPort`, which extends the read surface with `prune` and `reboot`. Production I/O lives only in the already-admitted `@delivery-os/adapters/session` subpath and reaches the database exclusively through the opencode CLI. Core carries types, `as const` data, and pure policy only. No package, subpath, dependency, or runtime-API location is added.

Safety is the product. A prune candidate is a session older than the declared threshold, outside the live window, and a leaf (no other session names it as `parent_id`). The live window is 15 minutes. Candidate conditions are re-checked immediately before each delete. Liveness is activity-based only: a session is live when `time_updated` falls inside the 15-minute window; there is no PID or lock-file probe, so an open-but-idle session older than `--older-than` is a prune candidate, and the ticket's "no live session lock is deleted" is satisfied only under this narrowed definition. Deletes go one by one through `opencode session delete <sessionID>`; the database file, WAL, and SHM sidecars are never deleted or truncated by `prune`. `reboot --apply` performs one bounded `PRAGMA wal_checkpoint(TRUNCATE)` only when no live session exists, never kills a process, and never removes a sidecar. The operator still restarts opencode manually; `reboot` prepares the database safely. This is a deliberate, safer deviation from the offered fallback, which said reboot restarts the opencode process only when no live session is detected: this change performs a checkpoint only and requires a manual restart (NG-D2, §3.5). The deviation and the activity-based liveness limitation are surfaced for owner acceptance in the PR body.

The ticket's inline admin prototype is absent from the issue body, comments, and history. This specification is authored from the ticket summary, the M0-S11 backlog entry, and the recorded PM fallback (durable, reversible, owner-amendable at PR review), not from a reconstructed prototype. ADR-0003 C-11 requires an explicit privacy sign-off before the `db` administration engine ships; this change records that sign-off as an owner merge gate and does not claim it is granted.

## 2. BUSINESS CONTEXT

### 2.1 Problem Statement

The opencode session database grows without bound: the live store measured for this change is roughly 120 GiB with a WAL in the tens of megabytes, several thousand sessions (most of them child sessions), and hundreds of thousands of messages. There is no supported admin surface. Existing scripts read the database through `opencode db "<SQL>" --format json` and `opencode session list`, but nothing prunes cold sessions, nothing reports store size or growth in a bounded shape, and nothing prepares the store for a host restart.

The absence of an admin surface has three consequences. First, bloat is managed ad hoc, if at all, and disk pressure is discovered late. Second, any hand-written deletion risks damaging a live session or the database files themselves, because the schema is not self-protecting: `session.parent_id` has no foreign key, descendant sessions do not cascade, and deleting a parent can orphan children. Third, any inspection surface risks exposing user content — session titles, prompts, message bodies, part data, credentials, environment values, and command arguments — which ADR-0003 C-11 forbids for session and host inspection.

### 2.2 Affected Users

- The operator (human owner) managing a local opencode store that has grown large.
- The coordinator (`@pm` / CEO-style agent) that needs bounded, truthful store facts at session start or during recovery.
- Lifecycle agents and future harness work that must read session metadata without a second ad-hoc SQL path.
- Security and privacy reviewers who must confirm the metadata-only guarantee and the ADR-0003 C-11 sign-off gate.

### 2.3 Business Impact

- **Reclaimable storage without data loss of live work.** Cold leaf sessions can be pruned idempotently; the live window, leaf-only rule, and pre-delete re-check make re-runs safe.
- **One typed admin path.** The CLI becomes the only product-code path to session administration; no engine grows a direct SQLite binding, and no provider or state tier learns SQL.
- **Truthful, bounded facts.** Size and list answer "how big is the store and what is in it" without dumping content or unbounded rows.
- **An auditable privacy boundary.** The metadata-only surface is a published adapter contract obligation under ADR-0003, and the C-11 sign-off is an explicit merge gate rather than an assumption.
- **Merge-blocking CI restored.** A pre-existing test-environment defect in the defaults-position test is repaired as a scoped baseline task, so the full gate is deterministic before and after this change.

### 2.4 Goals (ticket intent)

1. Port the session-database admin surface as `ados db` — `size`, `list`, `prune`, `reboot` — with bounded output and dry-run by default.
2. Make prune idempotent and safe to re-run.
3. Never delete a live session or a live-session lock under the activity-based definition in §3.4 (no PID or lock-file probe; an open-but-idle session older than `--older-than` is prunable).
4. Keep ADR-0003's `SessionStore` read-only and metadata-only; add a distinct admin port for mutation.
5. Ship classified failure identities and documented error-table rows in-change.
6. Keep the delivery gate green, including the scoped baseline repair.

### 2.5 Non-Goals

- **NG-D1**: Harness lifecycle, spawn, or telemetry (M1-S11). No session is created, resumed, or killed.
- **NG-D2**: Process killing or automatic host restart. `reboot` prepares the database only; the operator restarts opencode.
- **NG-D3**: `VACUUM` or any database compaction beyond the bounded WAL checkpoint.
- **NG-D4**: A direct `node:sqlite`, `bun:sqlite`, or other SQLite binding in product code, tests, or scripts.
- **NG-D5**: Displaying titles, prompts, message bodies, part data, credentials, environment values, or command arguments.
- **NG-D6**: A GUI, an interactive prompt, or a shared/remote database mode.
- **NG-D7**: Changes to the bash stack (`scripts/pm-liveness.sh`, `scripts/ceo-loop.sh`), `.opencode/**`, the generated Claude Code plugin, existing gates (none is weakened, bypassed, or re-baselined), or unrelated refactors.
- **NG-D8**: Descendant-aware pruning (`--include-descendants`), retention policies, scheduling, or automatic pruning.
- **NG-D9**: A second database access path (for example a direct driver) or a reimplementation of opencode's schema migration.

## 3. USER EXPERIENCE & FUNCTIONALITY

### 3.1 Command surface and grammar

`ados db <subcommand> [flags]`. The subcommand set is closed: `size`, `list`, `prune`, `reboot`. The only global flag is `--json`, supplied by the existing CLI, which changes rendering only.

| Subcommand | Positionals | Flags | Mutation |
|---|---|---|---|
| `size` | none | none (beyond global `--json`) | none |
| `list` | none | `--limit <n>` (optional; default 20; min 1; max 100) | none |
| `prune` | none | `--older-than <days>` (default 30; min 1; max 3650), `--limit <n>` (default 50; min 1; max 500), `--apply` (boolean) | only with `--apply` |
| `reboot` | none | `--apply` (boolean) | only with `--apply` |

Grammar rules, all validated before any I/O:

- A missing subcommand, an unknown subcommand, an unexpected positional, a `--`-prefixed flag not declared for the selected subcommand, a missing flag value, or a numeric value outside its declared range is a classified `input.value.rejected` rejection with exit `1`. No state is read and no mutation is attempted.
- The command definition declares `positionals.max: 8`, so positionals 1–8 reach the handler (the first is the subcommand). An unexpected positional among those slots is rejected by the handler as `input.value.rejected`; the ninth and later positionals are contained by the parser as `fallback.invocation`. Both are exit `1`.
- The shared parser recognizes only `--`-prefixed tokens as flags. A single-dash token such as `-x` is not a flag; it is an unexpected positional that the handler rejects as `input.value.rejected` (exit `1`). An undeclared `--`-prefixed token such as `--x` is rejected by the parser as `fallback.invocation` (exit `1`). Both classes are input-domain, user-validation rejections at exit `1`; the split is pinned in DEC-D7.
- The shared parser is `packages/cli/src/index.ts`, which this change consumes unchanged; only the token and positional-cap classes above determine which layer rejects.
- `--apply` is boolean. `--apply=false` is an undeclared exact token contained by the parser as `fallback.invocation`; a value-bearing `--apply` (for example `prune --apply false`) is rejected by the handler as `input.value.rejected`. Boolean and value flags never share a name. The shared parser's `conflicts` mechanism rejects only declared conflicting pairs, and `db` declares none; repeated occurrences of the same flag are therefore not a parser conflict, and the parser applies the last value.
- `--json` is not a command-specific flag; the handler never inspects it.

The command handler returns data or an error object. It performs no stream write and chooses no exit code. The CLI edge renders the human text or the machine envelope and projects the exit code through the existing classification chain.

Capabilities: F-D1 `size`, F-D2 `list`, F-D3 `prune`, F-D4 `reboot`, F-D5 grammar and classified rejection, F-D6 bounded metadata-only output, F-D7 the injected session I/O seam.

### 3.2 `db size` (F-D1)

Read-only. Resolves the database path at runtime through `opencode db path` — the path is never a committed literal — and reports:

- database path, database bytes, WAL bytes, SHM bytes, and whether each sidecar is present;
- session count, message count, and part count;
- oldest and newest session `time_updated` as ISO-8601 UTC strings, or `null` when the session table is empty.

Message count is over `message`, the current message store on the reference opencode 1.19.3 schema, where `message` and `part` hold the live data. The store-wide counts are `sessions = COUNT(*) FROM session`, `messages = COUNT(*) FROM message`, and `parts = COUNT(*) FROM part`.

`session_message` is the legacy/alternate store. It is present in the reference schema but empty on the reference opencode 1.19.3 store (0 rows against roughly 213k rows in `message` and roughly 961k rows in `part`), so it is not counted anywhere in `size`; counting it would report zero messages and zero payload bytes on a fully populated store. If a future harness version moves the current store, the adapter's pinned queries are updated through a versioned contract change rather than being discovered from a silent zero (RSK-D13).

Sidecar absence is reported explicitly (`walPresent: false`, `shmPresent: false`, bytes `0`) so an absent file is never confused with a real zero-byte file.

`size` takes no command-specific flags and performs no writes, fences, or checkpoints.

### 3.3 `db list` (F-D2)

Read-only. `list` issues exactly two read queries: one total-session count query and one bounded page query. The page query selects the ordered page of `session` rows and derives the three per-item aggregates in that same single statement over the current stores `message` and `part`: `messageCount = COUNT(*) FROM message WHERE session_id = s.id`, `partCount = COUNT(*) FROM part WHERE session_id = s.id`, and `dataBytes = COALESCE(SUM(LENGTH(CAST(message.data AS BLOB))),0) + COALESCE(SUM(LENGTH(CAST(part.data AS BLOB))),0)` over the session's rows, returning `0` when the session has no `message` or `part` rows. The `CAST(... AS BLOB)` form is pinned because SQLite's `LENGTH(text)` counts characters, not bytes; `dataBytes` is a UTF-8 byte count, not a character count. `session_message` is the legacy/alternate store and is empty on the reference opencode 1.19.3 store, so it is never counted or summed here (RSK-D13). The page query carries these as correlated scalar subqueries, or an equivalent single-statement form that preserves one row per session, ordered by `time_updated DESC, id ASC` with a `LIMIT`; no per-session query is issued.

Returns a bounded page of session summaries ordered by `updatedAt` descending, then `id` ascending. `--limit` defaults to 20 and is capped at 100. The page reports `total` (all sessions), `omitted` (total minus returned), and `truncated` (true when `omitted > 0`).

Each item carries exactly: `id`, optional `parentId`, `createdAt`, `updatedAt`, `messageCount`, `partCount`, `dataBytes`, `archived`, and `live`. `live` is computed from the injected clock and the pinned 15-minute window; it is never derived from the host clock inside the adapter. Field sources are pinned: `createdAt = session.time_created`, `updatedAt = session.time_updated`, `parentId = session.parent_id`, and `archived = session.time_archived IS NOT NULL`. The schema has no `archived` column; `archived` is the boolean projection of the nullable archive timestamp. No title, prompt, message body, part data, credential, environment value, or command argument is read into output, evidence, or fixtures.

`dataBytes` is the summed stored payload byte length of the session's messages and parts, measured with `LENGTH(CAST(... AS BLOB))` so UTF-8 bytes are counted rather than characters, read as a length only and never returned as content. It is advisory metadata, not a billing or retention figure.

### 3.4 `db prune` (F-D3)

Dry-run by default; mutating only with `--apply`.

**Candidate rule (normative).** A session is a prune candidate when all three conditions hold:

1. **Cold:** `time_updated < now - older-than-days` (strict; a session exactly at the boundary is not cold).
2. **Not live:** `time_updated < now - 15 minutes` (the live window is inclusive at its lower boundary; a session exactly 15 minutes old is live).
3. **Leaf:** no other session row has `parent_id` equal to the candidate's `id`.

Candidates are ordered oldest-first by `time_updated`, then `id` ascending, and capped at `--limit` (default 50, max 500).

**Live-session rule.** A live session is never a candidate, never selected, and never deleted, and the live condition is re-asserted on every re-read. Candidate conditions are re-checked immediately before each delete (the TOCTOU guard). The reachable races are leaf status and row disappearance: a candidate that gained a child between selection and delete is skipped so no orphan is created, and a row that vanished is a skip. The cold and live conditions ride the same re-read so the selection interpretation and the guard cannot drift; with the one-day minimum threshold the live condition is a defensive invariant rather than a reachable transition. Skip reasons are counted, never fabricated as success.

Liveness is activity-based only: a session is live when `time_updated` is inside the 15-minute window. There is no PID or lock-file probe, so an open-but-idle session older than `--older-than` is a prune candidate; the ticket's "no live session lock is deleted" is satisfied only under this narrowed, activity-based definition (RSK-D12).

**Deletion path.** A delete is one `opencode session delete <sessionID>` invocation per candidate. The command cascades `message`, `part`, `session_message`, `session_share`, `session_input`, `session_context_epoch`, and `todo` rows through opencode's own implementation. `prune` never issues a `DELETE` statement itself, never drops or truncates a table, and never deletes or truncates the database file, WAL, or SHM sidecar. After a delete invocation reports failure, one bounded post-delete existence read by id decides absence versus failure: zero rows is a counted skip, a present row is a failed delete. This is a normal single-statement query and adds no seam member.

**Leaf-only rationale.** `session.parent_id` has no foreign key and descendant sessions do not cascade. Deleting a session that has children would orphan them, so a session with any child is never eligible. A leaf is a session with no children of its own: a child session with no children is a leaf and is eligible, while a parent becomes eligible only after its last child has been removed by an earlier run.

**Idempotency.** A second identical run selects zero candidates because the first run removed them. Dry-run is repeatable and mutates nothing. A failed delete leaves its row in place, so a later run selects it again. Deleting a row that is already absent is a skipped/zero outcome, never a hard failure mid-run.

**Partial failure and mid-run abort.** A per-candidate delete failure does not stop the run; remaining candidates are attempted, each failed delete increments `failed`, and each successful delete increments `landed`. When one or more deletes fail, the command returns the classified `db.delete.failed` failure (exit `2`, transient, retryable) whose bounded summary is the normative string `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"`, where `attempted = landed + failed` and `<id>` is the first failed session identity. Successful deletions are never re-listed as failures, and the failure never reports overall success; the surviving rows make the retry converge.

A query or re-read failure **before any delete has landed** returns `db.query.failed` (exit `2`) because selection validity can no longer be guaranteed; a `db.opencode.unavailable` failure before any delete lands keeps its own identity. An aborting query, pre-delete re-read, post-delete existence-read, or `db.opencode.unavailable` failure **after at least one delete has landed** stops the run and returns `db.delete.failed` (exit `2`, transient, retryable) with the same bounded partial-abort summary: `landed` is the count of deletes that succeeded, `failed` counts candidates whose delete did not land (including the aborting candidate whose re-read failed), `attempted = landed + failed`, and `<id>` is the first failed identity. The summary carries the per-row truth; `not_landed` on the identity is the aggregate run statement that the prune did not fully land. Candidates not reached by the aborted run are not counted as attempted and are selected again by the retry.

### 3.5 `db reboot` (F-D4)

Dry-run by default; `--apply` performs the only mutation.

1. Count sessions inside the live window. The live window is the pinned 15 minutes from the injected clock.
2. **Dry-run:** return `mode: "dry-run"`, the live-session count, `blockedByLiveSession` (true when the count is non-zero), current WAL bytes, `checkpointPerformed: false`. A dry-run never returns the live-session failure.
3. **Apply with any live session:** return the classified `db.reboot.live` failure and perform nothing. No checkpoint, no delete, no process action.
4. **Apply with no live session:** perform exactly one bounded `PRAGMA wal_checkpoint(TRUNCATE)` through `opencode db`, report bytes before and after, and the outcome. It never kills or signals a process, never deletes WAL or SHM files, never runs `VACUUM`, and never truncates the database.

The human output states that the operator still restarts the opencode host manually; `reboot` only prepares the database. No automatic restart exists in this change.

**Deviation from the offered fallback.** The fallback offered on the ticket said reboot restarts the opencode process only when no live session is detected. This change deliberately does not restart any process: `reboot --apply` performs one bounded checkpoint and instructs the operator to restart the host manually (NG-D2). The deviation is safer because no process is signalled; it is recorded in §1 and RSK-D11 and must be surfaced in the PR body for owner acceptance.

### 3.6 Output contract (F-D6)

Machine mode is exactly one standard `CommandResult` envelope. Its `data` is the `delivery.session-admin.v1` payload for the subcommand. Success envelopes carry no `error` key; failure envelopes carry no `data` key. All timestamps in output are ISO-8601 UTC strings; the database stores epoch milliseconds and conversion happens once at the boundary.

`--json` output is produced by the single serializer; human mode renders from the same data and performs zero extra reads. The command adds no per-subcommand `--json` behaviour.

Data shapes (normative):

- **`size`** — `{ schemaVersion, command: "size", database: { path, dbBytes, walBytes, shmBytes, walPresent, shmPresent }, counts: { sessions, messages, parts }, oldestSessionUpdatedAt: string | null, newestSessionUpdatedAt: string | null }`.
- **`list`** — `{ schemaVersion, command: "list", limit, total, omitted, truncated, items: SessionSummary[] }`, where `SessionSummary = { id, parentId?, createdAt, updatedAt, messageCount, partCount, dataBytes, archived, live }`. In this shape, `createdAt`/`updatedAt` are the ISO-8601 renderings of `session.time_created`/`session.time_updated`, and `archived` is `session.time_archived IS NOT NULL`; no `archived` column is selected.
- **`prune`** — `{ schemaVersion, command: "prune", mode: "dry-run" | "applied", olderThanDays, limit, liveWindowMinutes, cutoff, counts: { selected, deleted, failed, skipped, liveExcluded }, candidates: SessionSummary[] }`. `candidates` holds the selected/attempted sessions up to the limit. On partial failure the payload is a `db.delete.failed` error, not this data object.
- **`reboot`** — `{ schemaVersion, command: "reboot", mode, liveWindowMinutes, liveSessions, blockedByLiveSession, checkpointPerformed, database: { path, walBytesBefore, walBytesAfter?, walPresent, shmPresent } }`.

Output is deterministic: identical database state, injected clock, and flags produce byte-identical data and human text.

### 3.7 Human output (deterministic and bounded)

Human mode renders from the same data with at most 32 item lines, 40 total lines, and 8192 bytes. Every line names its mode and state; nothing is invented for an unread source.

```
<binary> db size  <dbPath>  db <n> B | wal <n> B (<present|absent>) | shm <n> B (<present|absent>)
<sessions <n> | messages <n> | parts <n>  oldest <iso|none> | newest <iso|none>

<binary> db list  <returned> of <total> sessions  limit <limit>  live in page <n>
  <id>  <live|idle>  updated <iso>  messages <n> | parts <n> | bytes <n>[  parent <id>][  archived]
  ... (up to 32 item lines)
  +<omitted> more

<binary> db prune  <dry-run|applied>  older than <days> d | live window <minutes> min | limit <limit>
  candidates <n> | deleted <n> | failed <n> | skipped <n> | live excluded <n>
  <id>  updated <iso>  messages <n> | parts <n> | bytes <n>
  ... (up to 32 item lines)
  +<omitted> more

<binary> db reboot  <dry-run|applied>  live sessions <n> | checkpoint <performed|not-performed>
  wal <before> B -> <after|unchanged> B
  restart the opencode host manually; this command only prepares the database
```

The binary name comes from the injected brand; no product literal is committed. The `opencode` name in operational guidance names the external host, not this product.

### 3.8 Errors and exit codes (F-D5)

| Condition | Identity | Exit |
|---|---|---|
| Missing/unknown subcommand, an unexpected positional within the 8-positional capacity (including a single-dash token such as `-x`), missing value, out-of-range numeric | `input.value.rejected` | 1 |
| Undeclared `--`-prefixed token, or a positional beyond the 8-positional capacity (parser containment) | `fallback.invocation` | 1 |
| `opencode` unavailable, `opencode db path` fails, database absent/unreadable before any delete lands | `db.opencode.unavailable` | 2 |
| A session database query or re-read fails, or returns a malformed result, before any delete lands | `db.query.failed` | 2 |
| A session delete did not land, or an aborting query/re-read/availability failure occurred after at least one delete landed (including partial failure) | `db.delete.failed` | 2 |
| `reboot --apply` while a live session exists | `db.reboot.live` | 2 |
| Unclassifiable failure | `fallback.internal` | 2 |

Engine consequences are `not_landed` for every new `db.*` row. For a partial prune or a post-landed abort, `not_landed` is the aggregate statement that the prune did not fully land; the per-row truth is carried in the normative bounded summary (`"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"`, where `attempted = landed + failed`), and the surviving rows make retry converge. A query or re-read failure before any delete lands returns `db.query.failed`; any failure after at least one delete has landed returns `db.delete.failed`.

### 3.9 Flows

1. **Size:** validate grammar → resolve path via `opencode db path` → stat database and sidecars → run bounded count and timestamp aggregates → assemble `size` data → render.
2. **List:** validate grammar and range → count sessions → read one bounded ordered page → classify `live` against the injected clock → assemble `list` data → render.
3. **Prune dry-run:** validate grammar → compute cutoff from the injected clock → select candidates → report candidates, counts, and live exclusions → mutate nothing.
4. **Prune apply:** validate grammar → compute cutoff → select candidates → for each candidate re-read its row and re-check cold, not live, and leaf → skip on any failed condition → `opencode session delete <id>` → continue on a failed delete; an unavailable/database read failure before any delete lands returns its own identity (`db.opencode.unavailable` or `db.query.failed`), while an aborting query, re-read, or availability failure after at least one delete lands stops the run and returns `db.delete.failed` with the partial-abort summary → return success only when every attempted delete landed; otherwise return `db.delete.failed` with the normative partial-failure summary.
5. **Reboot dry-run:** validate grammar → count live sessions → report the plan and WAL bytes → mutate nothing.
6. **Reboot apply:** validate grammar → count live sessions → if any, return `db.reboot.live` and stop → otherwise checkpoint once → re-stat WAL → report.
7. **Rejection:** validate grammar → return the classified rejection before any I/O.

### 3.10 Pinned constants

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
| `DB_MAX_ID_CHARS` | `128` | Session-id output cap. |
| `DB_MAX_TIMESTAMP_CHARS` | `32` | ISO-8601 UTC output cap. |
| `DB_MAX_PATH_CHARS` | `1024` | Runtime database-path output cap. |
| `DB_MAX_HUMAN_ITEMS` | `32` | Rendered item lines per human report. |
| `DB_MAX_HUMAN_LINES` | `40` | Human report line cap. |
| `DB_MAX_HUMAN_BYTES` | `8192` | Human report byte cap. |
| `DB_MAX_MACHINE_BYTES` | `524288` | Serialized `data` byte cap. |
| `DB_SESSION_ID_PATTERN` | `^[A-Za-z0-9_-]+$` | The only id shape admitted for interpolation or command use. |
| `DB_QUERY_TIMEOUT_MS` | `30000` | One read query ceiling. |
| `DB_DELETE_TIMEOUT_MS` | `30000` | One delete invocation ceiling. |
| `DB_CHECKPOINT_TIMEOUT_MS` | `120000` | The single checkpoint ceiling. |

## 4. TECHNICAL ARCHITECTURE & CODEBASE MAP

### 4.1 Components and tiers

| Path | Status | Role in this change |
|---|---|---|
| `packages/core/src/contracts/session.ts` | New | Types and `as const` data only: `delivery.session-admin.v1` vocabulary, command/mode enums, bounds, defaults, live window, flag ranges, item and result shapes, `SessionStorePort` (read-only `size`/`list`), `SessionAdminPort` (extends the read surface with `prune`/`reboot`). No I/O, clock, randomness, or environment. |
| `packages/core/src/domain/session-admin.ts` | New | Pure policy and rendering over injected facts: cutoff and live-boundary computation, candidate predicate and ordering, capping, result assembly, and deterministic human text. No I/O. |
| `packages/core/src/contracts/index.ts` | Extends | Re-exports the session-admin vocabulary through the shared contracts subpath. |
| `packages/core/src/domain/index.ts` | Extends | Re-exports the session-admin policy and renderer. |
| `packages/core/src/contracts/error-table.ts` | Extends | `db` joins `DOMAIN_KINDS`; the four §4.7 rows are added as data. |
| `packages/adapters/src/session/index.ts` | Implemented | Production `OpencodeSessionIo` and the adapter implementations of `SessionStorePort` and `SessionAdminPort`. Replaces the types-only stub. |
| `packages/cli/src/commands/db.ts` | New | `ados db` command definition plus `DbCommandRuntime`; grammar validation before I/O; no stream writes and no exit-code choice. |
| `packages/cli/src/commands/index.ts` | Extends | Exposes the `db` definition and runtime type for edge composition. |
| `packages/cli/src/edge.ts` | Extends | `DbComposition` and `createDbCommandRuntime`; registers `commands.db` only when the composition is provided, following the lint/phase/provider/status/verify pattern. |
| `packages/cli/src/index.ts` | Consumed, unchanged | The existing optional `humanText` hook and `{0, 1, 2}` projection chain. |
| `packages/cli/src/classify.ts`, `packages/cli/src/projection.ts` | Consumed, unchanged | The new `db` identities ride the existing classification → projection chain; grammar rejections reuse `input.value.rejected`. |
| `packages/cli/src/output/` | Consumed, unchanged | The single serializer and redaction chokepoint. |
| `doc/spec/features/feature-session-database-admin.md` | New (phase 7) | Current-truth feature spec for the delivered surface. |
| `doc/spec/features/feature-adapter-ports.md` | Reconciled (phase 7) | `SessionStore` implemented; `SessionAdminPort` added; `adapters ./session` no longer a stub. |
| `doc/spec/features/feature-result-contract.md` | Reconciled (phase 7) | The `db` domain kind and four documented rows; both-direction sync stays green. |
| `doc/spec/features/feature-monorepo-scaffold-toolchain.md` | Reconciled (phase 7) | The implemented CLI surface and adapter subpath. |
| `doc/overview/glossary.md` | Reconciled (phase 7) | Live window, live session, prune candidate, leaf session, session admin. |
| `tests/checks/config-default-positions.test.ts` | Repaired | Baseline test-environment fix: create the `tmp/tmpdir` parent before `mkdtempSync`; no behaviour change. |

No new package, no new subpath, no new dependency, and no `package.json` or lockfile change. `@delivery-os/adapters/session` already exists; the core `./contracts` subpath already exists.

### 4.2 Ports and purity

`SessionStorePort` preserves ADR-0003's read-only semantics:

- `size(): Promise<SessionSizeRead>`
- `list(input: { limit: number; nowMs: number }): Promise<SessionListRead>`

`SessionAdminPort extends SessionStorePort`:

- `prune(input: { olderThanDays: number; limit: number; apply: boolean; nowMs: number }): Promise<SessionPruneRead>`
- `reboot(input: { apply: boolean; nowMs: number }): Promise<SessionRebootRead>`

Each read returns the workspace result shape: `{ ok: true, value }` or `{ ok: false, error }`, where the error carries a declared `db.*` identity. Grammar and range rejections happen in the handler before any port call, so `input.value.rejected` never crosses a port boundary. The ports are plain interfaces in `core ./contracts`; the adapter implements them, and the CLI composes them. No behaviour enters the contracts tier.

The pure policy module in `core` owns the deterministic rules: the cutoff (`nowMs - olderThanDays * 86_400_000`), the live boundary (`nowMs - 15 * 60_000`, inclusive), the candidate predicate over injected row facts (`updatedAtMs`, `hasChildren`), oldest-first ordering with `id` tiebreak, capping, and result assembly. The adapter owns SQL, process invocation, and the pre-delete re-read. The same pure predicate is used for selection interpretation and for the re-check decision, so the two cannot drift.

### 4.3 Production I/O seam

`OpencodeSessionIo` is the single injected seam. It is adapter-local and exported from `@delivery-os/adapters/session`, never a core contract. It declares:

- `databasePath(): Promise<string>` — resolves through `opencode db path`.
- `query(sql: string): Promise<readonly Record<string, unknown>[]>` — one single-statement `opencode db "<SQL>" --format json` call, parsed as a JSON array.
- `deleteSession(id: string): Promise<void>` — one `opencode session delete <id>` call.
- `checkpoint(): Promise<void>` — one `opencode db "PRAGMA wal_checkpoint(TRUNCATE)"` call.
- `now(): number` — injected epoch milliseconds.
- `stat(path: string): Promise<{ bytes: number; present: boolean }>` — bounded file metadata for the database and sidecars.
- `command` and `environment` injection — the opencode executable and the process environment arrive as data, never read ambiently.

The production implementation lives in `packages/adapters/src/session/index.ts`. That subpath is already an admitted adapter I/O location (ADR-0003 DEC-6 and the runtime-API confinement list), so it may use `node:child_process` and `node:fs`. It adds no secret-read allowlist entry and reads no ambient environment. Tests inject a fake `OpencodeSessionIo` and never touch the real database, the real opencode binary, the real home directory, or the network.

`opencode db` accepts multi-statement input but returns `[]` for it. The adapter therefore issues exactly one statement per query invocation and never batches. A malformed JSON body or a non-array result is a `db.query.failed` failure, never an empty result.

### 4.4 Composition and registration

`packages/cli/src/edge.ts` gains `DbComposition` (the injected `OpencodeSessionIo`, clock, and brand facts) and `createDbCommandRuntime(composition)` which builds the `DbCommandRuntime` over the ports. `commands.db` is registered only when `options.db` is provided; an absent composition leaves the command unregistered exactly as lint, phase, provider, status, and verify behave. No bin entry, entry-point change, or package export change is introduced.

`DbCommandRuntime` exposes one method per subcommand: `size`, `list`, `prune`, `reboot`. Each returns a classified result or a classified failure. The handler validates grammar, calls the matching runtime method, and returns `{ data }` or `{ error }`.

### 4.5 Data model

| ID | Element | Contract |
|---|---|---|
| DM-D1 | `SizeData` | Path, database/sidecar bytes with presence flags, session/message/part counts, oldest/newest session timestamps or `null`. |
| DM-D2 | `ListData` and `SessionSummary` | Bounded page (`limit`, `total`, `omitted`, `truncated`) and the whitelisted per-session item shape. |
| DM-D3 | `PruneData` | Mode, threshold, limit, live window, cutoff, counts (`selected`, `deleted`, `failed`, `skipped`, `liveExcluded`), and the attempted candidate summaries. |
| DM-D4 | `RebootData` | Mode, live window, live count, blocked flag, checkpoint outcome, and database/WAL facts. |
| DM-D5 | Vocabulary data | `DB_SCHEMA_VERSION`, the closed command set, and the closed mode set. |
| DM-D6 | Constants | Bounds, defaults, flag ranges, the live window, the id pattern, and the timeouts as `as const` data. |
| DM-D7 | Error identities | The `db` domain kind and the four rows of §4.7, with kind, category, retryability, consequence, remediation hint, projection class, and summary. |
| DM-D8 | Ports and seam | `SessionStorePort` and `SessionAdminPort` in core contracts; the adapter-local `OpencodeSessionIo` seam exported from `@delivery-os/adapters/session`. |

All timestamps in these shapes are ISO-8601 UTC strings, never raw epoch numbers. A session id longer than `DB_MAX_ID_CHARS` or a database path longer than `DB_MAX_PATH_CHARS` is not truncated (truncation would corrupt identity or the path); it is a `db.query.failed` failure naming the over-cap field.

### 4.6 Access path and SQL discipline

Read set (each one single statement):

- Session counts and `min`/`max` `time_updated` over `session` for `size`.
- Message count over `message` and part count over `part` for `size`, as store-wide `COUNT(*)` aggregates.
- **`list` uses exactly two queries**: one total-session count and one ordered page over `session`. The page derives `messageCount = COUNT(*) FROM message WHERE session_id = s.id`, `partCount = COUNT(*) FROM part WHERE session_id = s.id`, and `dataBytes = COALESCE(SUM(LENGTH(CAST(message.data AS BLOB))),0) + COALESCE(SUM(LENGTH(CAST(part.data AS BLOB))),0)` over the session's rows, as correlated scalar subqueries or an equivalent single-statement form, ordered by `time_updated DESC, id ASC` with a `LIMIT`. The page also selects `s.time_created`, `s.time_updated`, and `s.time_archived` to render `createdAt`, `updatedAt`, and `archived` (`s.time_archived IS NOT NULL`); there is no `archived` column. `LENGTH(CAST(... AS BLOB))` is pinned so `dataBytes` counts UTF-8 bytes rather than characters.
- **Current store pinning**: `message` is the current message store and `part` the current part store on the reference opencode 1.19.3 schema. `session_message` is the legacy/alternate store and is empty on the reference opencode 1.19.3 store (0 rows against roughly 213k `message` rows and roughly 961k `part` rows); no `size` or `list` query references it (RSK-D13).
- Candidate rows for `prune`: cold, outside the live window, and `NOT EXISTS` a child row, ordered oldest-first and limited.
- One pre-delete re-read per candidate by id, including a leaf check, immediately before the delete.
- One bounded post-delete existence read per failed delete, by id, to distinguish an absent row (skip) from a failed delete.
- Live-session count for `reboot`.

**Query bounds.** `db size` issues a fixed set of aggregate queries independent of store size. `db list` issues exactly two queries (one total count and one page) and no per-session query. `db prune` issues at most one selection query, plus at most one pre-delete re-read per candidate, plus at most one post-delete existence read per failed delete, plus at most one delete invocation per candidate; no other query is issued. `db reboot` issues exactly one live-count query and at most one checkpoint.

No untrusted value is concatenated into SQL. Session ids are validated against `DB_SESSION_ID_PATTERN` before any interpolation or command use; values read from the database are re-validated before reuse. Numeric flags are range-validated at the grammar (an out-of-range value is rejected, never silently clamped) and additionally clamped to their declared ranges before interpolation as a defensive invariant. Deletes use per-candidate `deleteSession(id)`, so no bulk `IN (...)` list is ever interpolated.

Session ids that fail the shape check abort the operation with `db.query.failed` (a database row that cannot be addressed safely is a query/selection failure), never with a partial delete.

### 4.7 Error identities

`db` joins `DOMAIN_KINDS`. The kind is multi-row, so classification is by exact code; a kind-only `db` error contains via `fallback.internal` rather than selecting a first row.

| Code | Kind | Category | Retryable | Consequence | Remediation hint | Projection class | Summary |
|---|---|---|---|---|---|---|---|
| `db.opencode.unavailable` | `db` | platform | false | not_landed | Install or repair the opencode CLI so opencode db path resolves. | platform-provider | The opencode session database is unavailable. |
| `db.query.failed` | `db` | platform | true | not_landed | Retry the failed query and verify the session store is readable. | platform-provider | A session database query failed. |
| `db.delete.failed` | `db` | transient | true | not_landed | Retry the prune; failed rows remain and are selected again. | platform-provider | A session delete did not land. |
| `db.reboot.live` | `db` | transient | true | not_landed | Wait until the live window is empty or stop the opencode host, then retry. | platform-provider | A live session is using the database. |

The remediation-hint strings above are the exact machine-table values. The plan's `error-table.ts` rows and the documented table in `doc/spec/features/feature-result-contract.md` copy them verbatim, so the bidirectional sync check compares equal text.

A query or re-read failure before any delete lands carries `db.query.failed`. The same failure after at least one delete has landed carries `db.delete.failed` with the partial-abort summary, because the run consequence is `not_landed` and the per-row truth must be preserved.

Documented rows ship in this change in `doc/spec/features/feature-result-contract.md`, keeping the binding two-directional documented-table sync green from the first delivery phase. Existing rows are untouched. Grammar and range rejections reuse `input.value.rejected`; no redundant row is added.

## 5. SECURITY AND BOUNDARIES

### 5.1 Metadata-only and privacy

The metadata-only clause of ADR-0003 C-11 is the contract, not an implementation detail. The complete allowed surface is: session identifiers, parent identifiers, counts, byte sizes, ISO-8601 timestamps, booleans (archived, live, present, truncated, checkpoint performed), the runtime-resolved database path, declared flag values, and declared counts.

Forbidden in every output, error, evidence, fixture, and log: session titles, prompts, message bodies, part data, transcripts, credentials, environment values, command arguments, file contents, and any raw database row beyond the whitelist above. The only path ever surfaced is the runtime-resolved database path; it is the tool's own store location (declared operational metadata, not user content) and no real user or home path is committed to the repository. Examples, fixtures, and golden data use synthetic placeholders.

A canary-secret fixture asserts zero occurrences of the canary in any output. A field-whitelist assertion fails on any extra item or evidence field. Neither check may be vacuous: removing a forbidden field's redaction must fail the suite.

### 5.2 Secret-read boundary

The production adapter adds no secret-read allowlist entry. It reads no ambient environment: the executable and environment arrive through injected composition. The secret-read boundary invariant stays at its existing four entries and remains fail-closed. The CLI composition receives environment facts from the existing resolved configuration path rather than reading `process.env`.

### 5.3 Runtime-API confinement

`node:child_process` and `node:fs` are used only in `packages/adapters/src/session/index.ts`, an already-admitted I/O subpath. Core contracts stay data-only; the core domain stays pure; the CLI handler performs no I/O and no rendering. No new runtime-API location, ambient global, or module side effect is introduced, and the boundary fixture matrix is unchanged.

No direct `node:sqlite`, `bun:sqlite`, `better-sqlite3`, or equivalent import appears in product code, tests, or scripts. The only database access is the opencode CLI.

### 5.4 Destructive-operation boundaries

- `prune` never deletes, truncates, renames, or rewrites the database file, WAL, or SHM. It deletes session rows only through `opencode session delete <id>`.
- `prune` never issues raw `DELETE`, `DROP`, `TRUNCATE`, `VACUUM`, or schema statements.
- `reboot` performs at most one `PRAGMA wal_checkpoint(TRUNCATE)`, only with no live session, and never deletes a sidecar.
- No process is killed, signalled, suspended, or restarted. No `kill`, `pkill`, `killall`, or supervisor call exists.
- Only leaf sessions are eligible; a parent with children is never deleted, preventing orphaned descendants.
- A live session is never a candidate under the activity-based definition in §3.4, and the pre-delete re-check closes the race between selection and deletion.

### 5.5 Privacy sign-off gate (ADR-0003 C-11)

ADR-0003 requires an explicit privacy sign-off before the `db` administration engine ships. This change records the sign-off as an **owner merge gate**: the pull request is delivered open and merge authority remains with the CEO/human owner. Neither this specification nor the change claims the sign-off is granted. The change supplies the evidence the sign-off needs — the metadata-only whitelist, the canary and whitelist tests, the no-SQLite-in-product-code check, and the destructive-operation boundaries — but the gate decision is external.

## 6. NON-FUNCTIONAL REQUIREMENTS

| ID | Requirement | Threshold |
|---|---|---|
| NFR-D1 | Determinism: output drift across repeated runs with identical database state, injected clock, and flags; ambient clock, randomness, environment, or filesystem reads outside the declared seam; byte-identical human rendering from identical data. | 0 drift / 0 ambient reads / 100% byte-identical replays |
| NFR-D2 | Boundedness: list items beyond 100; prune candidates beyond 500; human output beyond 32 item lines, 40 lines, or 8192 bytes; serialized `data` beyond 524288 bytes; ids beyond 128 chars; unbounded or unbounded-growth fields. | 0 over-cap outputs / 0 unbounded fields |
| NFR-D3 | Safety and idempotency: live sessions deleted by `prune`; database, WAL, or SHM files deleted or truncated by `prune`; candidates selected by a second identical apply after a clean first run; retries after a partial failure that do not converge; parent sessions deleted while children exist. | 0 / 0 / 0 / 0 / 0 |
| NFR-D4 | Performance on the reference environment (opencode 1.19.3; roughly 120 GiB store; ~7,000 sessions; ~213k messages): `db size`; `db list`; prune selection; one pre-delete re-check; `db reboot` live check; a 500-candidate apply. | ≤ 30 s / ≤ 10 s / ≤ 30 s / ≤ 250 ms each / ≤ 10 s / ≤ 180 s total |
| NFR-D5 | CI parity: tests requiring a real opencode binary, a real session database, the network, a real home directory, or host-local state; real user or home paths introduced by this change; committed fixture content outside the whitelist; full-gate determinism in a clean checkout. | 0 / 0 / 0 / 100% green including the repaired baseline test |
| NFR-D6 | Privacy and metadata-only: forbidden fields in any output, error, evidence, fixture, or log; canary occurrences; extra item/evidence fields beyond the whitelist; ambient environment values surfaced. | 0 / 0 / 0 / 0 |
| NFR-D7 | Error-table binding: the four `db` codes round-tripping exactly with documented rows; documented-table drift in either direction; unclassified or wrong-code `db` failures escaping `fallback.internal`; kind-only `db` classification selecting a row. | 4/4 round-trip / 0 drift / 0 escapes / 0 ambiguous selections |
| NFR-D8 | SQL safety: untrusted values interpolated into SQL or shell arguments; session ids used before shape validation; numeric values interpolated outside their declared ranges; bulk `IN (...)` interpolation. | 0 / 0 / 0 / 0 |
| NFR-D9 | Tier and runtime confinement: new runtime-API locations; secret-read allowlist entries added; `sqlite` driver imports in product code; new packages, subpaths, or dependencies; contracts-tier behaviour. | 0 / 0 / 0 / 0 / 0 |
| NFR-D10 | Operational truthfulness: mutation reported as success when a delete failed; a live session reported as deletable; an absent sidecar reported as a real zero-byte file; `reboot` claiming a host restart; a partial failure rendered as success; a post-land abort reported as a pre-land failure with no landed-count truth. | 0 occurrences |

## 7. QUALITY ASSURANCE STRATEGY

### 7.1 Test levels

| Level | Scope | Evidence |
|---|---|---|
| Structure | Contract inventory and constants, data-only contracts, pure domain imports, export surface, error-table rows and documented sync, no SQLite imports, no product literals, secret-read allowlist unchanged, boundary matrix unchanged | `tests/structure/session-admin-contract.test.ts`, `session-admin-imports.test.ts`, `tests/checks/error-table-sync.test.ts`, existing literal and boundary suites |
| Behaviour — size and list | Metadata fields, runtime path resolution, ordering, `--limit` bounds, `live` classification at the window boundary, empty-store `null` timestamps, sidecar presence, bounds, determinism | `tests/behaviour/session-admin-size-list.test.ts` |
| Behaviour — prune | Candidate rule across cold/live/leaf boundaries, oldest-first ordering, cap, dry-run zero mutations, apply deletes only candidates, TOCTOU skip when a candidate gains a child or disappears, idempotent second run, partial-failure and post-land partial-abort shape and summary, already-absent row skipped mid-run, pre-land abort on query failure | `tests/behaviour/session-admin-prune.test.ts` |
| Behaviour — reboot | Dry-run plan, live-session gate on `--apply`, zero action on the gate, one checkpoint on success, no file deletion, no process kill, WAL before/after reporting | `tests/behaviour/session-admin-reboot.test.ts` |
| Behaviour — grammar and errors | Missing/unknown subcommand, positionals (including single-dash tokens), undeclared `--` flags, missing values, out-of-range numbers, `--apply` value forms, parser containment carve-out, exit projection | `tests/behaviour/session-admin-grammar.test.ts` |
| Behaviour — output | Envelope validity on success and failure, schema version, machine byte cap, human grammar and caps, `+N more` truncation, byte-identical replays, no extra fields | `tests/behaviour/session-admin-output.test.ts` |
| Behaviour — SQL safety | Id shape validation before interpolation and before the delete command, injection attempts, numeric clamping invariant, no bulk interpolation, single-statement queries | `tests/behaviour/session-admin-sql-safety.test.ts` |
| Contract and privacy | Fake-IO conformance to both ports, read-only store surface, metadata-only whitelist, canary secret, mutation sensitivity | `tests/behaviour/session-admin-privacy.test.ts` |
| Baseline repair | The defaults-position tests create their temporary workspace parent and pass in a clean checkout | `tests/checks/config-default-positions.test.ts` |
| Aggregate | The whole workspace | `pnpm check` |

### 7.2 Fixtures and fakes

- `tests/fixtures/session-admin/**` holds synthetic session rows, synthetic path placeholders, malformed query responses, absent-sidecar cases, and a canary secret. No fixture contains a real path, title, prompt, message body, or part payload.
- A fake `OpencodeSessionIo` records calls (query text, deleted ids, checkpoint calls) and returns scripted results. The fake never spawns a process and never opens a file.
- Boundary fixtures are non-vacuous: the live/not-live, cold/warm, leaf/parent, absent/present sidecar, and success/failure pairs must both be exercised.
- Golden human output is committed, normalized (no absolute paths, no host timestamps), and regenerated by an explicit command only.

### 7.3 Baseline repair (scoped)

`tests/checks/config-default-positions.test.ts` calls `mkdtempSync(join(ROOT, "tmp", "tmpdir", ...))` without ensuring the parent exists, so the full gate is red in a clean checkout. The change adds `mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true })` before the affected `mkdtempSync` calls (the tree-invariant environment contract the test already assumes) and imports `mkdirSync` in the same file. This is a test-environment repair only: no product behaviour, assertion, or fixture changes. It is required for merge-blocking CI determinism and is explicitly in scope.

## 8. OPERATIONAL & SUPPORT

### 8.1 Defaults and flags

| Subcommand | Default mode | Defaults | Mutation switch |
|---|---|---|---|
| `db size` | read-only | — | none |
| `db list` | read-only | `--limit 20` | none |
| `db prune` | dry-run | `--older-than 30`, `--limit 50` | `--apply` |
| `db reboot` | dry-run | — | `--apply` |

No new user-facing configuration key or environment override, and no state-schema addition, is introduced. The live window, bounds, and defaults are contract data, not user configuration.

### 8.2 Operator guidance

- Run `db size` first to confirm the store path and growth.
- Run `db list` to inspect bounded session metadata; raise `--limit` only up to 100.
- Run `db prune` without `--apply` and review candidates; apply only when the candidate set is expected.
- Expect leaf-only behaviour: any session with children is not eligible, so pruning proceeds bottom-up over repeated runs and child sessions without children are pruned first.
- `reboot --apply` is safe to run only when no session is active; an active session produces `db.reboot.live` and changes nothing. The operator still restarts opencode manually.
- A partial prune failure is safe to retry; failed rows remain and are selected again.

### 8.3 Observability

The envelope's `runId` and `timing`, the per-run counts, the explicit mode, the cutoff and live-window values, and the bounded human report are the observability surface. No telemetry exporter, event sink, daemon, or background process is added. Logs and errors carry codes, counts, and identifiers only.

### 8.4 Maintenance

- Changing a bound or default is a contract-data change plus tests and documentation.
- Adding a subcommand is a grammar, port, composition, and documentation change.
- Promoting a `db.*` failure to a different category or projection requires an error-table change with its documented row.
- Widening the metadata surface is a semver-visible change to the published adapter port and requires a reviewed privacy decision, because ADR-0003 makes the metadata-only guarantee a public contract obligation.

## 9. DEPENDENCIES & RISKS

### 9.1 Dependencies

- **Depends on** ADR-0003 tier rules and the admitted `adapters ./session` I/O subpath, plus the existing runtime-API confinement and secret-read boundary invariants.
- **Depends on** the result contract and error table for the envelope, classification chain, projection, redaction chokepoint, and binding documented sync.
- **Depends on** the CLI command-definition and composition precedent (config, lint, phase, provider, status, verify) and the existing `humanText` hook.
- **Depends on** the opencode CLI surface `opencode db path`, `opencode db "<SQL>" --format json`, `opencode session delete <id>`, and the SQLite WAL mode of the session store.
- **Consumed by** operator and coordinator workflows that currently probe the store by hand; future harness telemetry (M1-S11) may consume the same read port, but no telemetry is added here.
- **Blocks** nothing in M0; it is the last M0 admin surface named by the command registry.

### 9.2 Risks

| ID | Risk | Impact | Probability | Mitigation | Residual |
|---|---|---|---|---|---|
| RSK-D1 | Selection and deletion race: a candidate gains a child (orphan risk) or the database changes concurrently between selection and delete | H | L | Pre-delete re-read and full re-check (cold, live, leaf) on the same predicate; skip on any failed condition | L |
| RSK-D2 | Deleting a parent orphans child sessions | H | L | Leaf-only candidate rule; child existence re-checked before delete; schema rationale documented | L |
| RSK-D3 | A partial delete leaves the store in a mixed state and is reported as success | M | M | Bounded partial-abort summary with landed and failed counts and the first identity; `db.delete.failed` exit 2; retry converges | L |
| RSK-D4 | Metadata-only guarantee erodes (a title or message body leaks into output or evidence) | H | L | Closed field whitelist, canary fixture, no-content reads, C-11 owner merge gate | L |
| RSK-D5 | The external opencode CLI surface (`db path`, `db "<SQL>" --format json`, `session delete`, WAL mode) and its output shapes are taken from recorded live environment facts, are not verifiable by repository tests, and can change | M | M | Single adapter seam; malformed results classify as `db.query.failed`; no direct SQLite fallback; the PR body states this unverifiable-surface residual risk | M |
| RSK-D6 | Aggregate counts over a 120 GiB store time out or block the host | M | M | Declared timeouts, single-statement bounded queries, measured performance bounds, explicit query failure | M |
| RSK-D7 | The DB path or WAL/SHM handling is wrong on a platform or during an active host | M | L | Path resolved at runtime; sidecar presence explicit; no file deletion; manual restart documented | L |
| RSK-D8 | SQL or shell injection through a session id | H | L | Shape validation before any interpolation or command use; per-candidate delete; defensive numeric clamping | L |
| RSK-D9 | ADR-0003 C-11 sign-off is assumed rather than granted | H | M | Sign-off recorded as an owner merge gate; PR left open; no claim of approval; evidence supplied | M until the owner decides |
| RSK-D10 | The baseline test repair is read as scope creep or changes behaviour | L | M | Test-only change, one parent-directory creation, no assertion or fixture change, explicitly scoped | L |
| RSK-D11 | The missing prototype leads to a surface the owner would have specified differently, and reboot deliberately deviates from the offered fallback by checkpointing only with no process restart | M | M | PM fallback is durable and reversible; owner may amend at PR review; spec §1/§3.5 record the prototype absence and the reboot deviation; the PR body surfaces both for owner acceptance | M until owner accepts |
| RSK-D12 | Liveness is activity-based only: there is no PID or lock-file probe, so an open-but-idle session older than `--older-than` is prunable; the ticket's "no live session lock is deleted" holds only under this narrowed definition | H | M | Explicit residual risk in §1/§3.4 and the PR body for owner acceptance; live window and pre-delete re-check; conservative default threshold | M until owner accepts |
| RSK-D13 | Store-version drift: `db size` and `db list` pin the message store to `message` and the part store to `part` because `session_message` is empty on the reference opencode 1.19.3 store; if a future harness version moves the message data back to `session_message` (or elsewhere), the pinned queries silently under-report counts and payload bytes (zero messages or zero data bytes on a populated store) | M | L | Single adapter-local query builder holds the pinned store names; the pinned definitions are normative in §3.2/§3.3/§4.6 and the reference-store facts are recorded in §3.2 and the change notes; re-verifying the store names is part of the versioned contract change taken when the harness schema moves, not a silent adapter edit; a zero message count on a non-empty session table is a review smell | M until the next harness version is verified |
| RSK-D14 | Stale current-system documentation: `doc/spec/features/feature-autonomous-delivery.md` and `scripts/pm-liveness.sh` still describe and query `session_message` as the current message store, while the reference opencode 1.19.3 store has `session_message` 0 rows and `message` ~213k rows / `part` ~961k rows; the documented contract therefore contradicts the delivered pin | M | H | The stale claim is reconciled in phase 7 by updating `doc/spec/features/feature-autonomous-delivery.md` to the `message`/`part` store. The change itself does not edit the system spec or the bash script; `scripts/pm-liveness.sh` is out of scope because this change makes no bash-stack changes (NG-D7) and is flagged as a separate owner follow-up | M until the system spec and the liveness script are reconciled |

## 10. PINNED DECISIONS

| ID | Decision | Source | Reversibility |
|---|---|---|---|
| DEC-D1 | The surface is exactly `size`, `list`, `prune`, `reboot`; `prune` and `reboot` are dry-run by default and mutate only with `--apply`. | PM fallback adopted after the missing prototype stopped clarify_scope | Reversible at PR review |
| DEC-D2 | `--dry-run` default; prune only sessions older than the declared threshold and never a live one; `--apply` required to mutate; reboot shares the live-session gate. | PM decision 2026-10-31 | Reversible at PR review |
| DEC-D3 | Database access is the opencode CLI only; no direct SQLite binding, package, or dependency. | PM decision 2026-10-31 | Reversible only by a new decision |
| DEC-D4 | ADR-0003's `SessionStore` stays read-only/metadata-only; a separate `SessionAdminPort` owns mutation. | PM decision 2026-10-31 | Reversible only by a new decision |
| DEC-D5 | Live session means activity inside the 15-minute window; liveness is activity-based only, with no PID or lock-file probe, so an open-but-idle session outside the window is prunable. The SQLite WAL/SHM sidecars are never touched by `prune`; `reboot --apply` performs one bounded checkpoint only when no live session exists. | PM decision 2026-10-31 | Reversible at PR review |
| DEC-D6 | Prune deletes leaf sessions only, because `session.parent_id` has no foreign key and descendants do not cascade. | PM decision 2026-10-31 | Reversible at PR review |
| DEC-D7 | Grammar rejections use `input.value.rejected`; the shared parser treats only `--`-prefixed tokens as flags. A single-dash token is an unexpected positional that the handler rejects as `input.value.rejected`; an undeclared `--`-prefixed token is contained by the parser as `fallback.invocation`. Both are input-domain, user-validation rejections at exit 1, and both are asserted. The shared parser (`packages/cli/src/index.ts`) is unchanged. | Spec decision reconciling the requested identity with the existing parser | Reversible at PR review |
| DEC-D8 | User numeric flags outside their declared ranges are rejected, not silently clamped; values are additionally clamped before SQL interpolation as a defence-in-depth invariant. | Spec decision reconciling "validated and clamped" with explicit grammar rejection | Reversible at PR review |
| DEC-D9 | A partial prune, or a query/re-read failure after at least one delete has landed, returns `db.delete.failed` (exit 2, transient, retryable) with the normative summary `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"` (`attempted = landed + failed`), rather than a success envelope; a query/re-read failure before any delete lands returns `db.query.failed`. | Spec decision derived from the "never pretend success" requirement and the closed error object | Reversible at PR review |
| DEC-D10 | ADR-0003 C-11 privacy sign-off is an owner merge gate, not a delivery blocker; the PR is left open and no approval is claimed. | PM decision 2026-10-31 | Owner decision |
| DEC-D11 | The defaults-position test repair is in scope as a test-only, tree-invariant environment fix. | PM decision 2026-10-31 | Reversible at PR review |

## 11. OPEN QUESTIONS

- **OQ-D1 (non-blocking; resolved by PM fallback):** The ticket says the admin prototype surface is inlined in the ticket, but the issue body and comments carry no prototype, and no prototype was found in all refs or history. Resolution: the documented fallback (DEC-D1, DEC-D2) is the authority for this delivery; the owner may amend the surface at PR review. No decision is needed to deliver.
- **OQ-D2 (non-blocking; deferred):** Descendant-aware pruning (`--include-descendants`) would reclaim more space in one run, but it multiplies the orphan risk and is deliberately out of scope (NG-D8). Revisit only if leaf-only pruning proves too slow in practice.
- **OQ-D3 (non-blocking; platform observation):** The 15-minute live window and the 30-day default threshold are declared constants for this delivery. If live session counts or store churn make them unsuitable, adjusting a constant is a contract-data change with tests, not a redesign.

No blocking open question remains; delivery proceeds on the pinned decisions above.

## 12. GLOSSARY & REFERENCES

| Term | Definition |
|---|---|
| Session database | The opencode SQLite store that holds sessions, messages, parts, and related rows; the admin target of this change. |
| Current message store | The `message` table on the reference opencode 1.19.3 schema; the only message source for `db size` counts and `db list` `messageCount`/`dataBytes`. The current part store is `part`. |
| Legacy message store | The `session_message` table; present in the reference schema but empty on the reference opencode 1.19.3 store, so it is never counted or summed and never reported as a zero-data result (RSK-D13). |
| Session admin | The typed `ados db` surface over the session database: `size`, `list`, `prune`, `reboot`. |
| Live window | The 15 minutes before the injected current time; a session with `time_updated` inside it is live. The lower boundary is inclusive. |
| Live session | A session inside the live window. It is never a prune candidate and blocks `reboot --apply`. |
| Prune candidate | A session that is cold (older than the threshold), not live, and a leaf; ordered oldest-first and capped at the limit. |
| Leaf session | A session that no other session names as `parent_id`. |
| Cold | Older than the declared `--older-than` threshold; the boundary itself is not cold. |
| Dry-run | The default mode for `prune` and `reboot`: read, plan, and report without mutating. |
| Apply | The explicit `--apply` mode that permits a mutation. |
| TOCTOU guard | The immediate pre-delete re-read that closes the race between candidate selection and deletion. |
| Partial failure | A prune in which some deletes landed and some did not, or a mid-run failure after at least one delete landed; reported as `db.delete.failed` with the normative bounded summary, never as success. |
| WAL checkpoint | The single `PRAGMA wal_checkpoint(TRUNCATE)` that folds the write-ahead log into the database; the only mutation `reboot --apply` performs. |
| Sidecar | The SQLite `-wal` and `-shm` files next to the database. Never deleted or truncated by this change. |
| Metadata-only | The ADR-0003 C-11 rule that session and host inspection surfaces identifiers, counts, timestamps, and non-user paths only. |
| Session id shape | `^[A-Za-z0-9_-]+$`; the only id form admitted before interpolation or command use. |
| Alias `ados` | The placeholder binary name in examples; the real name comes from the injected brand. |

References: [ADR-0003 — OSS Tooling Monorepo Structure](../../decisions/ADR-0003-oss-monorepo-structure.md) (DEC-6, C-11); [Adapter Ports, Credential Resolution, and Embedded Metadata](../../spec/features/feature-adapter-ports.md); [Result Contract and Error Table](../../spec/features/feature-result-contract.md); [Monorepo Scaffold and Toolchain](../../spec/features/feature-monorepo-scaffold-toolchain.md); [State Layer](../../spec/features/feature-state-layer.md); [Status Digest](../../spec/features/feature-status-digest.md); [command registry](../../planning/oss-tooling/cli-command-registry.md); [backlog](../../planning/oss-tooling/backlog.md) (M0-S11); [TypeScript rules](../../../.ai/rules/typescript.md); [testing strategy](../../../.ai/rules/testing-strategy.md).

## 13. ACCEPTANCE CRITERIA

Each criterion is testable and traceable to a test-plan case that asserts the current tree, never a moving-base diff.

- **AC-D1 — Size reports bounded metadata and a runtime-resolved path.**
  Given a fake session database and an injected clock, when `ados db size` runs, then the envelope's `delivery.session-admin.v1` data reports the runtime-resolved path, database and sidecar bytes with explicit presence flags, session/message/part counts, and oldest/newest ISO-8601 UTC session timestamps (or `null` when empty), with no write, checkpoint, delete, or process action.
  *DoD predicate*: every size field asserted from a fixture, empty-store case yields `null` timestamps, absent sidecars yield bytes `0` plus `present: false`, and the fake records zero mutations. (F-D1, DM-D1, NFR-D2, NFR-D6)

- **AC-D2 — List returns a bounded, deterministic, metadata-only page.**
  Given more sessions than the limit, when `ados db list --limit <n>` runs, then it returns at most `n` items (default 20, max 100), ordered by `updatedAt` descending then `id` ascending, with `total`, `omitted`, and `truncated`, and each item carries only the whitelisted fields with `live` computed from the injected clock.
  *DoD predicate*: ordering, cap, `omitted`/`truncated`, and empty-page cases asserted; exact `dataBytes` values are asserted for a multi-byte UTF-8 fixture using the byte count (`LENGTH(CAST(... AS BLOB))`) rather than the character count; `archived` is asserted true only when `time_archived` is non-null; `createdAt`/`updatedAt` are asserted to derive from `time_created`/`time_updated`; a field-whitelist check fails on any extra field; two replays are byte-identical. (F-D2, DM-D2, NFR-D1, NFR-D2, NFR-D6)

- **AC-D3 — Prune is dry-run by default and performs zero mutations.**
  Given a store with eligible candidates and no `--apply`, when `ados db prune` runs, then it reports the candidates and counts in `mode: "dry-run"` and performs no delete, no checkpoint, no file change, and no process kill; a second identical dry-run produces identical data.
  *DoD predicate*: fake IO records zero `deleteSession` and zero `checkpoint` calls; two dry-runs are byte-identical; candidate rows are unchanged. (F-D3, DM-D3, NFR-D1, NFR-D3)

- **AC-D4 — Candidate selection enforces cold, not-live, leaf, order, and cap.**
  Given a fixture spanning the cold boundary, the live boundary, parents with children, and leaves, when `db prune --older-than <d> --limit <n>` selects candidates, then only sessions strictly older than the cutoff, outside the live window, and with no child are selected, ordered oldest-first by `updatedAt` then `id`, capped at `n`.
  *DoD predicate*: each boundary has a paired positive and negative fixture: exactly-at-cutoff excluded, one millisecond older included; a session exactly 15 minutes old classifies as live, while a session 16 minutes old but younger than the cold threshold is not a candidate; a parent with a child excluded, a leaf included; cap and order asserted. (F-D3, DM-D3, NFR-D3)

- **AC-D5 — Apply deletes only through the official delete command and never touches files.**
  Given eligible candidates and `--apply`, when `ados db prune --apply` runs, then each selected session is deleted by one `opencode session delete <id>` invocation, no raw `DELETE`/`DROP`/`TRUNCATE`/`VACUUM` is issued, and no database, WAL, or SHM file is deleted, truncated, or renamed.
  *DoD predicate*: exactly one delete call per selected id; zero SQL statements in the delete path; the fake filesystem records zero destructive file operations. (F-D3, NFR-D3, NFR-D8, NFR-D9)

- **AC-D6 — Prune is idempotent and safe to re-run.**
  Given a successful `db prune --apply` run, when the identical command runs again, then it selects zero candidates, deletes nothing, and succeeds; a dry-run after apply also reports zero candidates.
  *DoD predicate*: second-run selected/deleted counts are zero, zero delete calls are recorded, and a third run remains stable. (F-D3, DM-D3, NFR-D3)

- **AC-D7 — The pre-delete re-check prevents orphan damage and absorbs vanished rows.**
  Given a candidate selected by the batch, when it gains a child before its delete is attempted, then the pre-delete re-read skips it with a counted reason and no delete is issued for it, while unaffected candidates proceed; the same re-read re-asserts the cold and live conditions.
  *DoD predicate*: fixture mutates candidate state between selection and re-check; zero delete calls for the candidate that gained a child; skip count increments; the run does not report it as deleted; the re-read is asserted to carry the cold and live predicates. (F-D3, NFR-D3)

- **AC-D8 — Partial failure and post-land abort are reported, never disguised as success.**
  Given a run where some deletes fail, or a run where a query/re-read failure occurs after at least one delete has landed, when `db prune --apply` completes, then it returns the classified `db.delete.failed` failure (exit 2, transient, retryable) whose bounded summary is the normative string `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"` with `attempted = landed + failed`, successful deletions are not reported as failure, and a retry selects and deletes only the surviving rows; a query/re-read failure before any delete lands instead returns `db.query.failed` (exit 2).
  *DoD predicate*: failure envelope asserted with the exact code, category, retryability, consequence, and the normative summary format for both the per-candidate partial case and the post-land abort case (landed and failed counts plus first identity); the pre-land abort case returns `db.query.failed`; failed rows remain in the fake store; successful rows are never listed as failures; retry converges to zero candidates. (F-D3, DM-D3, DM-D7, NFR-D10)

- **AC-D9 — An already-absent row is a skipped outcome, not a mid-run failure.**
  Given a candidate whose row disappears between the re-check and the delete, when the delete reports the row absent, then the run counts it as skipped and continues with the remaining candidates instead of aborting.
  *DoD predicate*: absent-row fixture yields `skipped ≥ 1`, no `db.delete.failed` for that case, and subsequent candidates are attempted. (F-D3, DM-D3, NFR-D10)

- **AC-D10 — Reboot checkpoints only with no live session.**
  Given injected live sessions, when `db reboot --apply` runs, then it returns `db.reboot.live` and performs no checkpoint, no delete, and no process action; given zero live sessions, it performs exactly one `PRAGMA wal_checkpoint(TRUNCATE)` and reports WAL bytes before and after.
  *DoD predicate*: both branches asserted; the blocked branch records zero checkpoint calls; the success branch records exactly one. A dry-run with live sessions reports the block without erroring. (F-D4, DM-D4, NFR-D3, NFR-D10)

- **AC-D11 — Reboot never kills a process or deletes a sidecar.**
  Given any reboot run, when it completes, then no process is killed, signalled, suspended, or restarted, and no WAL or SHM file is deleted or truncated; the human output states that the operator restarts opencode manually.
  *DoD predicate*: fake process seam records zero kill/signal calls; fake filesystem records zero deletions; the human report contains the manual-restart sentence. (F-D4, NFR-D3, NFR-D10)

- **AC-D12 — Grammar is validated before I/O and rejections are classified.**
  Given a missing subcommand, an unknown subcommand, an unexpected positional within the 8-positional capacity (including a single-dash token such as `db size -x`), a missing flag value, an out-of-range `--limit` or `--older-than`, or a value-bearing `--apply`, when the command runs, then the rejection is classified as `input.value.rejected` with exit 1; given an undeclared `--`-prefixed token such as `db size --x`, or a ninth or later positional beyond the declared capacity, when the command runs, then the rejection is classified as `fallback.invocation` with exit 1; in both classes the fake IO records zero reads and zero mutations.
  *DoD predicate*: one case per rejection class; `db size -x` yields `input.value.rejected`, an unexpected positional in slots 1–8 yields `input.value.rejected`, a ninth positional yields `fallback.invocation`, and `db size --x` yields `fallback.invocation`, all at exit 1 with an empty IO call log; the `--json` stripping case still succeeds. (F-D5, DM-D7, NFR-D8)

- **AC-D13 — Numeric values and session ids are safe to interpolate.**
  Given user numeric flags at their minimum, maximum, one below, and one above each bound, and database ids including shapes with quotes, spaces, semicolons, or comment markers, when the command runs, then out-of-range flags are rejected, in-range values are the only values interpolated, and no id outside `^[A-Za-z0-9_-]+$` is ever interpolated or passed to the delete command.
  *DoD predicate*: injection-shaped ids cause a classified `db.query.failed` without any delete attempt; no SQL text or argv contains an unvalidated id; numeric clamping invariant asserted. (F-D5, NFR-D8)

- **AC-D14 — Output is bounded and metadata-only in every mode.**
  Given every subcommand in success and failure, when output is rendered, then machine data is at most 524288 bytes, human output is at most 32 item lines, 40 lines, and 8192 bytes with `+N more` truncation, and no output, error, evidence, fixture, or log contains a title, prompt, message body, part data, credential, environment value, command argument, or real user path; a canary secret appears zero times.
  *DoD predicate*: cap assertions at and above the limit; whitelist and canary checks over all outputs; removing a redaction makes the suite fail. (F-D6, DM-D1–DM-D5, NFR-D2, NFR-D6)

- **AC-D15 — Error identities round-trip and classify exactly.**
  Given the four `db.*` failures, when classification runs, then each maps to its declared row (kind, category, retryability, consequence, projection class, summary), the documented table matches in both directions, and kind-only `db` classification contains via `fallback.internal` instead of selecting a row.
  *DoD predicate*: 4/4 round-trip; zero drift both directions; kind-only and wrong-code cases contained; no redundant grammar row added. (DM-D7, NFR-D7)

- **AC-D16 — Tiers, boundaries, and the no-SQLite rule hold.**
  Given the delivered tree, when structure and boundary checks run, then contracts remain data-only, the core domain remains pure, production I/O exists only in `packages/adapters/src/session/index.ts`, no `node:sqlite`/`bun:sqlite` or other driver import exists, the secret-read allowlist stays at four entries, no new package/subpath/dependency exists, and `commands.db` is registered only when the composition is supplied.
  *DoD predicate*: structure, import, boundary, entrypoint, and secret-read suites green; composition-absent case leaves `db` unregistered; composition-present case registers it. (F-D7, NFR-D9)

- **AC-D17 — The suite is deterministic and CI-clean.**
  Given a clean checkout with no opencode binary, no real session database, no populated home directory, and no network, when the full gate runs, then the session-admin suites pass from fakes and fixtures, the repaired `config-default-positions` tests pass, and no file introduced by this change contains a real user or home path.
  *DoD predicate*: `pnpm check` green in a clean checkout; the session-admin suites make zero real-process, real-file, and network calls; a path scan over the files introduced by this change finds zero real home paths. (NFR-D1, NFR-D5)

- **AC-D18 — The C-11 privacy sign-off is a recorded owner merge gate.**
  Given the delivered change, when the pull request is prepared, then this specification, the pull request description, and the change evidence state that the ADR-0003 C-11 privacy sign-off is required before merge, that it is not claimed as granted, and that merge authority is the CEO/human owner; the PR body also states, for owner acceptance, (a) the activity-based liveness limitation (no PID or lock-file probe; an open-but-idle session older than `--older-than` is prunable), (b) the deliberate reboot deviation from the offered fallback (checkpoint-only with manual restart, no process restart), and (c) that the external opencode surface is taken from recorded live facts and is not verifiable by repository tests; the PR is left open.
  *DoD predicate*: the sign-off statement and each of the three residual-risk statements exist in the specification and PR body; no artifact asserts approval; the PR remains unmerged by the delivery process. (NFR-D6, RSK-D9, RSK-D11, RSK-D12)

## 14. DOCUMENT HISTORY

- **v1.5 (2026-10-31)** — DoR iteration-2 residual remediation for the specification-routed findings. **M10:** pins the `list` item field sources — `createdAt = session.time_created`, `updatedAt = session.time_updated`, `parentId = session.parent_id`, and `archived = session.time_archived IS NOT NULL` (the schema has no `archived` column) — in §3.3, §3.6, and §4.6. **m11:** pins `dataBytes` to true byte semantics with `LENGTH(CAST(message.data AS BLOB))` and `LENGTH(CAST(part.data AS BLOB))` because SQLite `LENGTH(text)` counts characters, not bytes; §3.3, §4.6, and AC-D2's DoD predicate now assert exact byte values plus the `archived` and timestamp derivations. **M9:** adds RSK-D14 recording that `doc/spec/features/feature-autonomous-delivery.md` and `scripts/pm-liveness.sh` still describe `session_message` as the current message store against the verified reference-store facts (`session_message` 0 rows; `message` ~213k; `part` ~961k); the system spec is reconciled in phase 7 and the bash script is flagged as an out-of-scope follow-up. Also aligns the §3.2 and NFR-D4 reference-store counts with the verified facts. AC count remains 18; no decision, constant, error identity, scope, or acceptance-criterion count changes. The test plan and plan are unchanged by this specification revision.
- **v1.4 (2026-10-31)** — Corrects the pinned message store for the `db size` and `db list` count and aggregate definitions from `session_message` to `message`, and pins the part store as `part`. Root cause: v1.3 asserted that `session_message` was the current message store and that `message` was legacy and unwritten; the verified live facts contradict that on the reference opencode 1.19.3 store — `session_message` has 0 rows while `message` holds roughly 209k rows, and `message`/`part` hold the current data. The v1.3 definition would therefore have reported zero messages and zero data bytes on a fully populated live store. Amended: §3.2 (`messages = COUNT(*) FROM message`, store-wide), §3.3 (`messageCount = COUNT(*) FROM message WHERE session_id = s.id`, `partCount = COUNT(*) FROM part WHERE session_id = s.id`, `dataBytes = COALESCE(SUM(LENGTH(message.data)),0) + COALESCE(SUM(LENGTH(part.data)),0)`), §4.6 (read set and a current-store pinning bullet), §9.2 (new RSK-D13 store-version drift: `session_message` is the legacy/alternate store, empty on the reference store, so it is not counted; a future harness version that moves the store is handled by a versioned contract change that updates the pinned queries), and §12 (current/legacy message store glossary entries). AC count remains 18 and no acceptance criterion, decision, constant, error identity, or scope changes. The test plan and plan are amended separately.
- **v1.3 (2026-10-31)** — DoR iteration-1 remediation for specification-routed findings. **B4:** a query/re-read failure before any delete lands returns `db.query.failed` (exit 2); any failure after at least one delete has landed returns `db.delete.failed` (exit 2, transient, retryable) with the normative bounded partial-abort summary `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"` (`attempted = landed + failed`), so `not_landed` remains the aggregate statement and the summary carries per-row truth; §3.4, §3.8, §3.9, §4.7, §7.1, §9.2, DEC-D9, and AC-D8 updated. **M1:** `db list` is pinned to exactly two queries (one total count and one page) and the per-item `messageCount`/`partCount`/`dataBytes` derivations, correlated-aggregate page shape, and `time_updated DESC, id ASC` ordering are defined in §3.3/§4.6; the post-delete existence read is in the read set and the failure-path query bound. **M2:** activity-based liveness with no PID/lock probe is an explicit residual risk (RSK-D12) in §1/§3.4/§9.2 and is surfaced for owner acceptance in AC-D18. **M3:** the checkpoint-only reboot is recorded as a deliberate, safer deviation from the offered fallback (NG-D2, §1, §3.5, RSK-D11) and is surfaced for owner acceptance in AC-D18. **m1:** post-delete existence read and failure-path query bound added to §3.4/§4.6. **m2:** positionals 1–8 are handler `input.value.rejected`; a ninth or later positional is parser `fallback.invocation` (§3.1, §3.8, AC-D12). **m3:** repeated flags are last-wins at the shared parser, not a conflict rejection (§3.1). **m4:** the partial-failure summary format is normative and the "for example" wording is removed. **m8:** the external opencode surface is recorded as an unverifiable residual risk in RSK-D5 and the PR body (AC-D18). **n2:** §4.7 pins the exact remediation-hint strings matching the plan's `error-table.ts` rows and the documented table. AC count remains 18; no other decision or constant changes.
- **v1.2 (2026-10-31)** — Readiness amendment renaming the reboot live-session failure identity to `db.reboot.live`. The previous form placed a hyphen inside its final segment and therefore failed the repository error-code format `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$` enforced by the error-table sync check and its structure test; the identity was renamed rather than the gate being widened. The row keeps the same kind `db`, category `transient`, retryability `true`, consequence `not_landed`, projection class `platform-provider`, and summary "A live session is using the database."; §3.5, §3.8, §3.9, §4.7, §8.2, and AC-D10 now use the renamed identity. No gate change, no AC count change (remains 18), no AC semantics change, and no other decision change.
- **v1.1 (2026-10-31)** — Delivery-planning amendment clarifying the grammar rejection split against the unchanged shared parser (`packages/cli/src/index.ts`, which recognizes only `--`-prefixed tokens as flags). §3.1, §3.8, §7.1, DEC-D7, and AC-D12 now name the two classes: a single-dash token (`-x`) is an unexpected positional the handler rejects as `input.value.rejected`, while an undeclared `--`-prefixed token (`--x`) is the parser's `fallback.invocation` containment; both are input-domain, user-validation rejections at exit 1. Root cause was the prior wording treating any token outside the declared flag set as parser containment; the parser and all product behaviour are unchanged. No AC, NFR, risk, scope, or error-identity count changes; AC count remains 18.
- **v1.0 (2026-10-31)** — Initial specification. Authored from the ticket summary, the M0-S11 backlog entry, the recorded PM fallback (the inline prototype is absent), live read-only environment facts, and the binding repo rules. Pins the four-subcommand surface, dry-run defaults, the 15-minute live window, leaf-only pruning, the TOCTOU re-check, the opencode-CLI-only access path, the `SessionStorePort`/`SessionAdminPort` split, the four `db` error rows, the bounded metadata-only output, the owner merge gate for the ADR-0003 C-11 sign-off, and the scoped defaults-position baseline repair.
