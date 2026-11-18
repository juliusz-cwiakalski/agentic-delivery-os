# GH-335 live observation — a harness-port spawn with a caller-supplied agent identity

> Human-gated observation (TC-HARNESS-045, AC-F5-6, AC-F3-1 live half; DoD clauses
> 4 and 5). Re-recorded for review iteration 1 (F-1) **through the delivered path**:
> the production composition's resolution wrapper, a recorded dispatch attempt, the
> delivered attribution resolver, and the delivered capture. It is a recorded manual
> observation, not a test: not a `.test.ts` file, never discovered by `bun test`,
> never invoked by `pnpm check` or CI, and never read as an oracle by any suite.

## 1. Pass facts

| Fact | Value |
|---|---|
| Date | 2026-11-18 (delivery pass, review remediation iteration 1) |
| Installed harness | `opencode v2.3.2` — normalized `2.3.2`, an **in-window** line |
| Intake pass line (Phase-1 spike evidence) | `opencode v2.2.5` — normalized `2.2.5`, also in window |
| Store | `~/.local/share/opencode/opencode.db`, opened read-only with `PRAGMA query_only = 1` |

The argv-only invocation recorded in the previous version of this file is
**superseded and withdrawn as evidence**: plan 8.12 and DoD clause 4 require the
agent identity to reach the port on the input contract's agent-identity member,
not through an argv convention, and a raw CLI run records no dispatch attempt, so
the delivered capture would have returned `skipped-gap`. It is no longer cited.

## 2. What was observed (the delivered path)

The observation ran one harness-port `spawn` through the **production composition's
resolution wrapper** — `createHarnessProfilePort` from
`packages/cli/src/production.ts`, the same call site the production dispatch
composition mounts — over the delivered opencode session adapter and the host
streaming starter.

- **Caller-supplied agent identity:** `agent: "coder"` on the spawn input.
- **Declared observation profile** (the profile the composition would resolve for
  this agent): one seat `coder-seat`, resolved model `deepseek/deepseek-flash`,
  `agentOverrides: { coder: "coder-seat" }`.
- **Resolver output (recorded binding),** from the delivered pure
  `resolveBinding(profile, selection, "coder")` the wrapper calls:

  ```json
  {"outcome":"binding","binding":{"agent":"coder","seat":"coder-seat","resolvedModel":"deepseek/deepseek-flash"}}
  ```

- **Spawn result** — the handle the port acquired from the first identified line:

  ```json
  {"ok":true,"value":{"harnessKind":"opencode","sessionId":"ses_e10abeb40ffe2WzlUul79pJvK3","treeRoot":"ses_e10abeb40ffe2WzlUul79pJvK3","workItemRef":"GH-335"}}
  ```

- **Collection** — the stream drained to completion:

  ```json
  {"ok":true,"value":{"completionMarker":true,"exitStatus":0,"timedOut":false,"spawnRefused":false,"failureReported":false,"toolFailure":false}}
  ```

- **Recorded attempt:** one dispatch attempt appended with
  `ref: "GH-335"`, `sessionIds: ["ses_e10abeb40ffe2WzlUul79pJvK3"]` and the
  resolver's binding above (`appendDispatchAttempt` → `ok: true`).
- **Attribution (the delivered union resolver, `resolveSessionAttribution`):**

  ```json
  {"heldSessionIds":["ses_e10abeb40ffe2WzlUul79pJvK3"],"bindings":{"ses_e10abeb40ffe2WzlUul79pJvK3":{"agent":"coder","seat":"coder-seat","resolvedModel":"deepseek/deepseek-flash"}},"unattributedAttempts":0}
  ```

## 3. The landed capture output (verbatim, nothing inferred)

The delivered `createOpencodeTelemetryExtractor` ran over the store with the
union above and the recorded binding:

```json
[
  {
    "schemaId": "delivery.harness.telemetry.v1",
    "workItemRef": "GH-335",
    "runId": "run-live-observation",
    "sessionId": "ses_e10abeb40ffe2WzlUul79pJvK3",
    "harnessKind": "opencode",
    "harnessVersion": "2.3.2",
    "agent": "coder",
    "model": "deepseek/deepseek-flash",
    "treeRoot": "ses_e10abeb40ffe2WzlUul79pJvK3",
    "parentChain": [],
    "tokens": { "input": 146, "output": 2, "reasoning": 0, "cacheRead": 16640, "cacheWrite": 0 },
    "calls": 1,
    "toolCounts": [],
    "cost": 0.00007302,
    "capturedAt": "2026-11-18T15:43:52.437Z",
    "warnings": [{ "reason": "no-tool-source", "field": "toolCounts" }],
    "seat": "coder-seat",
    "resolvedModel": "deepseek/deepseek-flash",
    "durations": {
      "status": "sourced",
      "start": "2026-11-18T15:43:47.409Z",
      "end": "2026-11-18T15:43:51.869Z",
      "elapsedMs": 4460
    }
  }
]
```

Capture meta: `{"failedSessions":[],"absences":null,"warnings":[{"reason":"no-tool-source","field":"toolCounts"}]}`.

## 4. The store read (verbatim, read-only)

```
$ sqlite3 "file:$HOME/.local/share/opencode/opencode.db?mode=ro" \
    "PRAGMA query_only=1; SELECT id, parent_id, version, agent, model, cost, tokens_input,
       tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write,
       time_created, time_updated FROM session_v2 WHERE id = '<session>'"
ses_e10abeb40ffe2WzlUul79pJvK3||2.3.2|coder|{"id":"deepseek-flash","providerID":"deepseek"}|
0.000104688|340|5|0|16896|0|1795016627409|1795016631869
```

The session record's own `version` is `2.3.2` (in window), its `agent` is `coder`,
and its structured model object normalizes to `deepseek/deepseek-flash`.

## 5. Observed versus inferred

| Fact | Status |
|---|---|
| A harness-port `spawn` ran with a caller-supplied `agent: "coder"` and completed with a session identity | **Observed** (§2 spawn result) |
| The wrapper resolved the caller's agent to one seat `coder-seat` with resolved model `deepseek/deepseek-flash` | **Observed** (§2 resolver output) |
| One dispatch attempt recorded that identity and that binding | **Observed** (§2, `ATTEMPT true`) |
| The capture read exactly that held identity and produced the row above | **Observed** (§3 verbatim capture output) |
| `seat` is `coder-seat` on the landed row | **Observed** (§3) |
| The observed model agrees with the resolved model (no `model-divergence` warning) | **Observed** (row `model` = row `resolvedModel`; warnings list only `no-tool-source`) |
| Durations are store-sourced, not estimated | **Observed** (§3 pair equals the store's `time_created`/`time_updated` pair) |
| Token and cost figures | **Observed snapshot** at capture time; the store read afterwards (§4) reports the run's final values, so the two reads differ (the capture is a point-in-time read of a live session). |
| The `no-tool-source` warning | **Observed** — no observed store generation exposes a populated tool source |
| The session's absolute wall-clock start | **Observed** from the store row |

No field in §3 is a projection or a narration; every value above is copied from
the executed commands' output.

## 6. Environment observations (not delivered defects)

- On this observation host the `opencode` on `PATH` is a wrapper that prepends
  `--standalone`; passing the production argv set (which also selects
  `--standalone`) to that wrapper duplicates the flag and the harness exits `1`.
  The observation therefore invoked the installed binary at its real path. The
  delivered model is one binary plus its declared argv; the wrapper duplication
  is a host artifact recorded here for transparency.
- The capture is a read-only point-in-time read of a live store: the row's token
  and cost figures and the store's later read differ because the harness updated
  the session after the capture. Neither value is fabricated.

## 7. Role-less control (an observation, never propagation proof)

The shipped generic `dispatch` supplies no agent identity, so its spawn binds
nothing and its rows carry a null seat with `unresolved-seat`. That is the honest
unbound state; it is recorded as an observation and is never accepted as
propagation proof.

## 8. Outcome

- **AC-F3-1 live half: met by the observation above.** A harness-port spawn with
  a caller-supplied agent identity ran the resolved model on the installed
  in-window harness; the landed row's recorded seat and resolved model are the
  resolver's output and agree with the store's observed agent and model.
- **AC-F5-6: met by the observation above.** A row landed for a session a
  harness-port spawn carried through the installed harness, stamped with the
  session's own version, the recorded seat and resolved model, the observed
  identity, tokens, cost, and store-sourced durations.
- **DoD clause 4: satisfied.** DoD clause 5: satisfied by the recorded
  `opencode v2.3.2` → `2.3.2` line beside the intake `v2.2.5` line.
- No deferral is claimed, because the port path was exercised in this environment.
