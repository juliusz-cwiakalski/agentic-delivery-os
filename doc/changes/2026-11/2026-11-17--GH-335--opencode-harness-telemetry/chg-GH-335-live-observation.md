# GH-335 live observation — a harness-port spawn with a caller-supplied agent identity

> Human-gated observation (TC-HARNESS-045, AC-F5-6, AC-F3-1 live half; DoD clauses
> 4 and 5). This is a recorded manual observation, not a test: it is not a
> `.test.ts` file, is never discovered by `bun test`, is never invoked by
> `pnpm check` or CI, and is never read as an oracle by any suite.

## 1. Pass facts

| Fact | Value |
|---|---|
| Date | 2026-11-18 (delivery pass) |
| Host | The delivery host named in the change record |
| Installed harness | `opencode v2.3.2` — normalized `2.3.2`, an **in-window** line under the delivered window |
| Intake pass line (recorded in Phase-1 spike evidence) | `opencode v2.2.5` — normalized `2.2.5`, also in window |
| Store | The harness's own data directory (`~/.local/share/opencode/opencode.db` family), opened read-only with `PRAGMA query_only = 1` |

## 2. The observation invocation

The observation is a **harness-port spawn carrying a caller-supplied agent
identity**, not a `dispatch` run: the shipped generic `dispatch` sets neither
spawn-input member (DEC-15), so it would bind nothing and prove nothing here. The
caller supplied the agent identity `coder` and the resolved model
`deepseek/deepseek-flash` on the invocation; the equivalent port call is a spawn
whose input carries `agent: "coder"` and the resolved single-seat binding
`{ agent: "coder", seat: "coder-seat", resolvedModel: "deepseek/deepseek-flash" }`,
which the adapter expresses as exactly one `--agent coder` and one
`--model deepseek/deepseek-flash`.

```
$ opencode run --agent coder --model deepseek/deepseek-flash \
    "Reply with the single word OK and nothing else."
> coder · deepseek-flash
OK
   (exit 0)
```

The harness-port spawn completed and its stream drained; the session identity was
acquired from the first identified line, exactly as the adapter's handle
acquisition requires.

## 3. The landed store row (read-only)

Session identity (redacted): `ses_e110…43bjq` — a single root session
(`parent_id` null), created by this invocation.

```
$ sqlite3 "file:$HOME/.local/share/opencode/opencode.db?mode=ro" \
    "PRAGMA query_only=1; SELECT version, agent, model, cost, tokens_input, tokens_output,
       tokens_reasoning, tokens_cache_read, tokens_cache_write, time_created, time_updated
     FROM session_v2 WHERE id = '<session>'"
2.3.2 | coder | {"id":"deepseek-flash","providerID":"deepseek"} | 0.001985838 |
13141 | 4 | 0 | 4096 | 0 | 1795010825635 | 1795010831063
```

The session's own `version` is `2.3.2`; the session row's `agent` is `coder` and
its structured model object normalizes to `deepseek/deepseek-flash`.

## 4. What the delivered extractor lands for this session

With the union of held identities = this session and the recorded binding above,
the capture produces one row with:

| Field | Value |
|---|---|
| `schemaId` | `delivery.harness.telemetry.v1` |
| `harnessVersion` | `2.3.2` (the session record's own version, normalized) |
| `agent` | `coder` (the harness-reported agent) |
| `model` | `deepseek/deepseek-flash` (the observed model, canonicalized from the structured object) |
| `seat` | `coder-seat` (the recording attempt's binding — attached because the observed agent equals the binding's agent) |
| `resolvedModel` | `deepseek/deepseek-flash` — **agrees** with the observed model, so no `model-divergence` warning |
| `tokens` | `{ input: 13141, output: 4, reasoning: 0, cacheRead: 4096, cacheWrite: 0 }` |
| `cost` | `0.001985838` — a reported non-zero value, recorded as reported |
| `durations` | `{ status: "sourced", start: "2026-11-18T14:07:05.635Z", end: "2026-11-18T14:07:11.063Z", elapsedMs: 5428 }` — from the store's own timestamp pair |
| `toolCounts` | absent with the `no-tool-source` warning (no observed generation exposes a populated tool source) |
| `absentObservedAxes` | absent — both identity axes are stated |

**Resolved versus observed comparison.** The supplied binding's agent (`coder`)
equals the observed session agent (`coder`), and its resolved model
(`deepseek/deepseek-flash`) equals the observed model (`deepseek/deepseek-flash`)
after canonicalization. The harness therefore ran the named agent on the resolved
model, which is the criterion this observation exists to confirm; a zero-row or a
different-model outcome would have failed it.

## 5. Role-less control observation (not propagation proof)

The shipped generic `dispatch` supplies no agent identity, so a dispatch binds
nothing and its rows carry a null seat with `unresolved-seat`. That is the honest
unbound state; it is recorded here as an **observation** and is never accepted as
propagation proof.

## 6. Outcome

- AC-F3-1 live half: **met** — a harness-port spawn carrying a caller-supplied
  agent identity ran the resolved model on the installed in-window harness, and the
  landed row's recorded seat and resolved model agree with the observed facts.
- AC-F5-6: **met** — rows landed for a session a harness-port spawn with a
  caller-supplied agent identity ran through the installed harness.
- DoD clause 4: satisfied by this observation. DoD clause 5: satisfied by the
  recorded `opencode v2.3.2` → `2.3.2` line beside the intake `v2.2.5` line.
- No deferral is claimed, so no accepting human/PM decision is required for this
  record.
