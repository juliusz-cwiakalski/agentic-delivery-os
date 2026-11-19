---
ados_distribution: redistributable
---
# `loop` — the CEO outer delivery loop

`loop` runs, stops, inspects, tails, and resets the Mode A outer delivery loop as a
typed command. It is a composition profile over the delivered supervision engine
(instance lease, restart budget, stuck record pair, identity-verified kill) under
the distinct supervisor identity `loop-main`; it is not a second supervisor.

## Help and version

```text
jaiship loop --help
jaiship loop start --help
jaiship --version
```

## Verbs

| Verb | Grammar | Effect |
|---|---|---|
| `start` | `loop start --foreground [--fresh-budget]` | Refuses a folded stop (exit 0, `state=stopped`); otherwise claims the lease, establishes or re-finds the CEO session, and runs the cycle in the foreground. `--foreground` is required. |
| `stop` | `loop stop [--mode drain\|immediate]` | Appends one durable stop request for the loop identity. `drain` is the default and the parity mode; `immediate` opts into termination. |
| `status` | `loop status` | Read-only projection `delivery.loop.v1`. |
| `log` | `loop log [--lines <n>]` | The bounded tail of the operational log; `n` is an integer 1–100 (default 50). |
| `reset` | `loop reset` | Appends one durable stop clearance when a request is folded. |

`--json`, `--verbose`, and `--pretty` are the CLI's global flags and are accepted
on every verb; they are never grammar refusals.

## Exit vocabulary

| Outcome | Exit |
|---|---|
| Clean stop, folded stop, or the driver's declared clean end | 0 |
| Grammar refusal (`fallback.invocation`) | 1 |
| Budget exhaustion (`coordinator.restart-budget-exhausted`) | 1 |
| Provider/config/harness pre-session refusal | 1 |
| Live holder (`coordinator.already-running`), an undeclared capability, an unconfirmed termination, or a `state.*` failure | 2 |

## Status keys

`status` prints `key=value` lines in this order: `loop_running`, `loop_pid`,
`ceo_alive`, `ceo_pid`, `ceo_session`, `stop_signal`, `stop_mode`, `loop_id`,
`ceo_title`, `restarts`, `budget_epoch`, `last_restart_reason`, `last_verdict`,
`degraded`.

Exactly three keys are boolean and render `yes`/`no`. `loop_id` is the constant
`loop-main` and is never empty; `restarts` renders `<n>/<bound>`; `ceo_pid` and
`ceo_session` come from the LIVE session only and are empty for an ended one.
Every other absent value renders as the empty string after `=` — never a `none`
token.

## Log bounds

One line is at most 512 UTF-8 bytes; the active file is at most 1 MiB; exactly one
rotated generation is retained; the total is at most 2 MiB; `log` returns at most
100 lines and 65536 bytes. A log fault never changes a verdict, exit, or record.

## Durable stop workflow

```text
jaiship loop stop --mode drain     # one loop.stop request (identity-scoped)
# ... the process may exit, crash, or be rebooted ...
jaiship loop start --foreground    # folded request -> exit 0, state=stopped
jaiship loop reset                 # one loop.stop clearance
jaiship loop start --foreground    # runs
```

The typed stop is a ledger record; the legacy shell's workspace marker is a file.
Neither reads the other, so each path's own stop and reset governs that path.

## Declared divergences from the shell loop

1. A second start is refused at exit 2, not silently at 0.
2. A grammar refusal exits 1 (not the shell's usage 2).
3. The restart budget is durable per epoch; `--fresh-budget` opens the next one.
4. Stuck restarts wait `min(2 s × 2^(n−1), 300 s)`; ordinary iterations wait the
   collection interval.
5. A restart starts a fresh session (no context resume without a total-context
   source).
6. `log` returns the bounded supervision log, not a session transcript.
7. `stop` defaults to `drain`; `--mode immediate` is the additive opt-in.
8. No pre-iteration hook runs.
9. Five `coordinator.*` keys replace the shell's env knobs; no key is added.
10. `--lines` is an integer 1–100; anything else is a grammar refusal.

## See also

- `TDR-0056` — the loop as a profile of the coordinator engine
- `TDR-0057` — the durable stop as a state-ledger record
- `doc/spec/features/feature-loop-supervision.md` — the current-truth page
