# GH-335 spike evidence — integration mode, version line, and observed store

> Delivery-pass evidence for plan Phase 1.1/1.6. Read-only: the harness's version and help
> surfaces, and a read-only store open with the query-only pragma. No store write, no
> configuration mutation, no credential read, no network call, no session start.

## 1. Pass facts

| Fact | Value |
|---|---|
| Pass | Delivery (plan Phase 1.1), 2026-11-18 |
| Host | The delivery host named in the change record |
| Installed harness on `PATH` | A wrapper that `exec`s the binary with `--standalone` prepended |
| Harness version line this pass | `opencode v2.3.2` — normalized `2.3.2`, **in window** under the delivered window |
| Intake pass line (recorded by the specification) | `opencode v2.2.5` — normalized `2.2.5`, also **in window** |

Both lines share one grammar: a product token, an optional `v`, a three-part semantic
version, newline-terminated. The DoD's "one real harness version output is recorded"
clause therefore has a real recorded output at each pass.

## 2. Exact commands and observed output

```
$ which opencode
/tmp/ados-standalone-bin/opencode

$ head -3 /tmp/ados-standalone-bin/opencode
#!/usr/bin/env bash
exec <node-bin-dir>/opencode --standalone "$@"

$ opencode --version
opencode v2.3.2
   (exit 0)

$ opencode --help
DESCRIPTION
  OpenCode command line interface
FLAGS
  --standalone            Run with a private server instead of the background service
  --server string         Connect to a server URL instead of the background service
  --session, -s string    Session ID to continue, or to create if it does not exist
SUBCOMMANDS
  acp                Start an Agent Client Protocol server
  api                Make a request to the running server
  run                Run OpenCode with a message
  session            Manage sessions
  service            Manage the background server
   (exit 0)
```

## 3. Mode surfaces re-observed

| Declared mode member | Observed surface this pass |
|---|---|
| `per-invocation-private-server` | `--standalone` — "Run with a private server instead of the background service"; the `PATH` wrapper prepends it, so this is the behaviour that runs today |
| `managed-background-service` | `service` — "Manage the background server" |
| `running-server-client` | `--server <url>` — "Connect to a server URL instead of the background service"; `api` — "Make a request to the running server" |

**Chosen-mode rationale.** The per-invocation private server is the surface the installed
harness already runs on this host, it needs no long-lived service for the tooling to own,
and it depends on no ambient server. Selecting it describes today's delivery instead of
changing it; the other two stay declared members that refuse rather than degrade. The
record is [TDR-0038](../decisions/TDR-0038-opencode-integration-mode.md), and its chosen
mode value is the value the Phase-2 `DEFAULT_HARNESS_MODE` constant must carry.

## 4. Store path and generation facts the telemetry path consumes

```
$ ls -la ~/.local/share/opencode/
-rw------- 1 juliusz juliusz 11721605120 Nov 18 12:13 opencode.db
-rw------- 1 juliusz juliusz       32768 Nov 18 12:13 opencode.db-shm
-rw------- 1 juliusz juliusz    14593072 Nov 18 12:13 opencode.db-wal
```

The store is the SQLite file in the harness's own **data** directory, not the state
directory the delivered default names. Opened read-only with `PRAGMA query_only = 1`
before the first read; every statement below is bounded.

```
$ sqlite3 "file:$HOME/.local/share/opencode/opencode.db?mode=ro" \
    "PRAGMA query_only=1; SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
__drizzle_migrations account account_state automation blob blob_ref control_account
credential event event_sequence instruction_blob instruction_entry instruction_state
job kv message migration part permission project project_directory session
session_inbox session_message session_part session_share session_v2 todo workspace worktree
```

Both generations coexist:

| Generation | Tables | Row counts this pass |
|---|---|---|
| Current | `session_v2`, `session_message`, `session_part` | 12 709 sessions, 451 007 messages |
| Legacy | `session`, `message`, `part` | 7 386 sessions, 230 914 messages |

Readable column inventory (from `sqlite_master.sql`):

- `session_v2(id, project_id, workspace_id, parent_id, fork_session_id, fork_boundary,
  slug, directory, path, title, version, …, cost REAL DEFAULT 0 NOT NULL,
  tokens_input/tokens_output/tokens_reasoning/tokens_cache_read/tokens_cache_write
  INTEGER DEFAULT 0 NOT NULL, agent, model, time_created, time_updated, …)`.
- `session_message(id, session_id, type, seq, time_created, time_updated, data)` — `data`
  is JSON and carries the assistant facts (agent, model object, cost, tokens, time) and
  the `agent-switched` / `model-switched` metadata events. Content lives in the same JSON
  document and is never projected.
- `session_part(message_id, session_id, ordinal, type, call_id, time_created, time_updated,
  data)` — no `tool` column.
- `session`/`message`/`part` carry the same readable facts under the legacy names; legacy
  `part` has **no** `tool` column either.

**No work-item column exists anywhere; there is no separate harness-version column; there
is no per-message token/agent/model/cost column.** The version is the session row's own
`version`:

```
$ … "SELECT version, agent, model FROM session_v2 ORDER BY time_updated DESC LIMIT 3;"
2.3.2|coder|{"id":"deepseek-flash","providerID":"deepseek"}
2.3.2|coder|{"id":"deepseek-flash","providerID":"deepseek"}
2.3.2|plan-writer|{"id":"deepseek-flash","providerID":"deepseek"}

$ … "SELECT DISTINCT version FROM session_v2 ORDER BY version LIMIT 12;"
1.19.0
1.19.3
2.2.5
2.3.2
```

`1.19.0` and `1.19.3` coexist with the in-window lines in one store, which is why the
window is evaluated on the observed version and the row stamp is the session's own value.

**Observed-axis absence is real, not hypothetical** (a growing observation, never a fixture
constant):

```
$ … "SELECT 'null-agent', COUNT(*) FROM session_v2 WHERE agent IS NULL;"
null-agent|23
$ … "SELECT 'null-model', COUNT(*) FROM session_v2 WHERE model IS NULL;"
null-model|503
```

At intake the same observation read 484 null models; the figure grows with every pass. Rows
with an unstated observed axis therefore have to land with a declared absence marker rather
than failing or dropping.

## 5. Decision records

| Record | Path | Status |
|---|---|---|
| Integration mode (this pass's spike) | [TDR-0038](../../../../decisions/TDR-0038-opencode-integration-mode.md) | `Proposed` |
| Adapters contract (window, grammar, mode, propagation by reference, observed-store telemetry, absence taxonomy) | [TDR-0039](../../../../decisions/TDR-0039-opencode-harness-adapter-contract.md) | `Proposed` |
| Dispatch-outcome envelope `detail.harness` member | [TDR-0037](../../../../decisions/TDR-0037-harness-dispatch-outcome-envelope-detail.md) | `Proposed` |
| Seat–spawn cardinality, seat resolution, and the two-member carrier (with Amendments A-1..A-4) | [TDR-0036](../../../../decisions/TDR-0036-harness-seat-spawn-cardinality-and-seat-resolution.md) | `Proposed` |

All four are `Proposed`; the human owner accepts them at the GH-335 pull request. The
independent review of this set is
[chg-GH-335-decision-review.md](./chg-GH-335-decision-review.md).
