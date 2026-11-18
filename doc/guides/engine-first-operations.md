---
ados_distribution: redistributable
id: GUIDE-ENGINE-FIRST-OPERATIONS
status: Current
created: 2026-11-18
last_updated: 2026-11-18
owners: ["engineering"]
summary: "Operating guide for engine-first delivery: the daily routine, how to read the handover gate and the fleet row, how a per-repository flip and its reversal are performed, and the shell fallback with the declared residuals."
---

# Engine-first delivery operations

This guide is the operator reference for running delivery through the typed
engine. The contract reference lives in the feature pages
([Dispatch Engine](../spec/features/feature-dispatch-engine.md),
[Repositories and the Host Overview](../spec/features/feature-projects.md),
[Merge and Verify Deploy](../spec/features/feature-merge-verify-deploy.md)); this
page is the daily routine.

## 1. Daily engine-first operation

The regular path is the engine:

```
dispatch <ref>                 # one attempt: admit, spawn or resume, classify, record
verify gates <ref>             # the merge-applicable battery for the head
merge <ref> --dry-run          # evaluate and record the verification, land nothing
merge <ref>                    # land one verified squash commit
```

`dispatch <ref>` appends exactly one real `pilot` attempt record per delivery with
its outcome and corroboration. The lifecycle merge and closeout run through those
engine primitives; `@pr-manager` never merges and the platform merge command is
not the primary path. Every command is daemon-free: no step needs a resident
daemon, a scheduler tick, or a background watcher.

The bash entry points (`deliver-ticket.sh`, `batch-deliver.sh`, `ceo-loop.sh`,
`pm-liveness.sh`) stay executable throughout. In `dual-run` they behave exactly as
before; after an owner flip they keep their output and exits and print the bounded
authoritative-mode pointer (section 4).

## 2. Reading the gate

Eligibility for a repository is the conjunction of four conditions, in the
declared order:

| Condition | What it means |
|---|---|
| `truth` | No false-success incident in the window and no unresolved divergence |
| `coverage` | The counted dispatches cover the eleven result tokens (exposure only) |
| `floor` | At least 20 counted dispatches or 7 consecutive UTC dates, whichever comes first |
| `corroboration` | Every counted success claim has the evidence its outcome family requires |

Two reads report the same derivation, so they agree over one ledger:

```
dispatch dual-run summary --repo <host/owner/name> --json
```

reports `verdict`, the four `conditions`, `countedDeliveries`, `cleanDispatches`
(the corroborated counted attempts), `consecutiveCleanDispatches` (the trailing
clean streak), and `unmetConditions`. `unverifiable` is a window-level verdict
carried with `truncation`, never a fifth condition status.

```
repos list --json
```

reports, for every `ready` row, `reversible` and a `handoverGate` block with the
same `verdict`, the same four `conditions`, `countedDeliveries`, and
`cleanDispatches`. The row is evaluated at read time, over that row's own
repository identity, so a fleet read answers "which condition is open per
repository" without a new command. Read it as: the open conditions name what
blocks a flip, and a `cleanDispatches` that does not grow means the engine path is
not accruing corroborated deliveries.

A row whose ledger cannot be read is a classified failure (`repos.state-unavailable`)
rather than a fabricated row, and a first-use repository reports the empty-window
evaluation with `countedDeliveries: 0`.

## 3. Flipping a repository and reversing the flip

A flip is a separate owner act, never a side effect of a delivery:

```
dispatch handover <host/owner/name>            # flip once the gate reads eligible
dispatch handover <host/owner/name> --revert   # restore dual-run
```

- A met bar records the flip, reports `operation=authoritative`, `recorded=true`,
  `reversible=true`, and moves only that repository.
- A readable but unmet bar is a clean refusal at exit `1` naming every unmet
  condition; nothing is recorded.
- A repository already `authoritative` answers an idempotent noop: `recorded=false`,
  `reversible=true`, no second record.
- `--revert` records a reversal and reports `reversible=false`; history is
  preserved, never deleted. Repeating the revert on a `dual-run` repository answers
  an idempotent noop with no conditions, no verdict, and no truncation — it changes
  no authority, so a torn attempts ledger cannot refuse it.
- An unreadable or torn **handover** ledger is still a classified
  `dispatch.state-unverified` refusal at exit `2`, on every path.

`repos list` reflects the same fact per row: `reversible` reads `true` for a
flipped repository and `false` after the reversal, and other repositories are
unaffected.

## 4. The shell fallback

The shell stack is the documented fallback, not a deprecated path:

- In `dual-run` the entry points behave as delivered: same arguments, same
  outputs, same exits, no pointer.
- After a flip, the same invocations exit `0`, keep the five-key delivery-summary
  tail (`result`, `pr_url`, `exit_code`, `closeout_unverified`, `last_message`),
  and print one bounded `[deprecation]` pointer on **stderr** naming
  `dispatch <ref>` and `dispatch handover <repo> --revert`. The scripts stay
  executable, and stdout is byte-identical across the two authority states.
- Reversibility is read from the engine surface (`dispatch handover` data or the
  fleet row), never from shell output.

## 5. Declared residuals

Two limits are stated so an operator does not plan around capability that does not
exist:

- **`verify deploy` target resolution** is a declared residual in this change: the
  command's delivered behaviour is unchanged and deploy confidence is not
  engine-verified by this work.
- **A declared peak window has no read surface** of its own: the engine exposes the
  park it causes (`status.laneParks`, the board `PARKED` section, the
  `peak-window` park record), never a window listing.
- **The `lanes` read is profile-blind**: `QueueLane` carries no `providerProfile`
  and the lanes projection shows none, so a `lanes list` reader cannot attribute a
  running lane to a provider profile. The surfaces that do carry the nomination are
  the attempt history, the daemon lane records, `status.laneParks`, the board's
  `PARKED` section, and the window-scoped spend evidence.

The two broader test specifications (`doc/quality/test-specs/test-spec-dispatch-engine.md`,
`test-spec-merge-verify-deploy.md`) are reconciled to the delivered contracts by
the lifecycle's `system_spec_update` phase, not by this guide.
