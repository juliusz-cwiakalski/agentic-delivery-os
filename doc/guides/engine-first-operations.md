---
ados_distribution: redistributable
id: GUIDE-ENGINE-FIRST-OPERATIONS
status: Current
created: 2026-11-18
last_updated: 2026-11-26
owners: ["engineering"]
summary: "Operating guide for engine-first delivery: the daily routine, the per-reference inspection queries, peak pausing, parking and the operator stop, how to read the handover gate and the fleet row, how a per-repository flip and its reversal are performed, the typed Mode A loop beside its shell fallback, and the declared residuals."
links:
  related_changes: ["GH-293", "GH-348", "GH-354", "GH-388", "GH-386", "GH-404", "GH-413"]
  related_decisions: ["TDR-0031", "TDR-0056", "TDR-0057", "TDR-0058", "TDR-0077", "TDR-0078"]
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
verify gates <ref>             # evaluate the battery and persist its verification record
merge <ref>                    # land one verified squash commit
```

Each command runs where its evidence lives. `dispatch <ref>` starts the work item
in its own worktree; `dispatch status <ref>` reports that worktree's path. `verify
gates <ref>` evaluates the **invoking working tree** — the pm-notes and the
checkout head it is given — so under a worktree lane it runs **inside the lane's
worktree**; run from the main checkout it evaluates the main checkout, fails the
lifecycle-finalization source, and records the base head. `merge <ref>` runs from
either checkout, because the landing is provider-side. `closeout <ref>` runs from
the **main checkout**: its checkout restore refuses an invocation made from the
lane's worktree. A remedy that runs the battery in the lane's worktree for you is
not part of this contract.

`verify gates <ref>` followed by `merge <ref>` is the native merge sequence: a
clean PR lands with no intermediate step, because the verification `verify gates`
prints is the record `merge` consumes. `merge --dry-run` is an evaluation-only
surface — it appends a verification record and lands nothing — and it is never a
required pre-step.

`dispatch <ref>` appends exactly one real `pilot` attempt record per delivery with
its outcome and corroboration. The lifecycle merge and closeout run through those
engine primitives; `@pr-manager` never merges and the platform merge command is
not the primary path. Every command is daemon-free: no step needs a resident
daemon, a scheduler tick, or a background watcher.

Each dispatch runs the work item's whole lifecycle in its own linked worktree,
provisioned detached at the base tip after the repository lease is claimed and
before the first phase. By default the worktree is a sibling of the main checkout
named `<checkout-basename>-<ref>`; `lane.worktree-root` declares another root. No
lane branch is created: the lane's own intake creates the delivery branch
`<type>/<ref>/<slug>` inside the worktree. Dependencies and the workspace gate
build are provisioned in the worktree before the first phase, so the lane's gates
run there and the main checkout stays on the base branch and clean while you keep
working. An active lane resumes in the worktree it recorded — detached at the base
branch's head or on its delivery branch — and never provisions a second one; `dispatch status
<ref>` shows where it is. An environment that cannot create worktrees sets
`lane.disable-worktrees: true` and runs every lane in the invoking checkout,
byte-for-byte the behaviour of a composition without worktrees. Closeout preserves
the lane's runner logs (`tmp/run-logs-runner/**`, newest-first under a declared
byte cap with any truncation disclosed) at
`<state root>/closeout-lane-logs/<ref>`, discards the `tmp/tmpdir` gate scratch,
and removes the worktree and its branch only once the merge is confirmed — the
merge step defers that branch deletion to closeout while the branch is checked out
in the lane's worktree — so a stalled lane keeps its worktree until it is resumed
or closed out.

The bash entry points (`deliver-ticket.sh`, `batch-deliver.sh`, `ceo-loop.sh`,
`pm-liveness.sh`) stay executable throughout. In `dual-run` they behave exactly as
before; after an owner flip they keep their output and exits and print the bounded
authoritative-mode pointer (section 5). The Mode A outer loop is also a typed
command — `jaiship loop start|stop|status|log|reset` over the delivered supervision
engine — and `ceo-loop.sh` remains its documented fallback
([Loop Supervision](../spec/features/feature-loop-supervision.md)).

### Peak windows, parking, and the operator stop

A dispatch lane is watched for its whole life by the invocation that started it,
so a window that opens mid-lane is respected without a resident daemon. The watch
is composed only for a harness that declares the terminate operation, because the
stop it issues is that operation: a terminate-less harness, the Claude Code
adapter, composes no watch, so its lanes run through a window and `lanes` reports
`iteration-start-gating` for it even with pausing enabled. When the
nominated profile's `peakWindows` rule data declares an open window, the lane is
stopped with one bounded-grace stop, parked with cause `peak-window` and the
window's end, and resumed in the same invocation once the end is observed — the
same session, branch, and worktree, and exactly one `stop`, one `parked`, and, on
resume, one `resumed`. The invocation returns one result whose summary states that
the lane was paused and resumed. Between the park and the resume the invocation
keeps the lane's repository lease live at `min(lane.liveness-interval,
queue.lease-ttl / 2)`, so a second dispatch while the lane runs is refused
`queue.single-flight`; while an un-expired standing park holds the ref it is
refused `dispatch.resume-parked` at exit `2` at resume admission, not
`queue.single-flight`. `dispatch status <ref>` explains a pause: the lane reads
`stale=false` and `delivering=true` while its owner is alive, and the additive park
fact names the cause, the recorded end, the recorded stop instant, and the
preservation classification, carried from the park record; the only refusal on
the not-preserved path of a dispatch-owned episode is budget exhaustion, recorded as the
delivered terminal exhaustion record and raised as the delivered typed question, so the park record
carries no refusal member ([Provider Peak
Pausing](../spec/features/feature-peak-pausing.md)).

Run it as follows:

- **Expect a long invocation and a delayed answer.** A lane parked inside a window
  stays in flight for the length of the window; that is the point. Read `dispatch
  status <ref>`, `lanes`, and `board` for progress rather than elapsed time. A
  dispatch that supplies the watch also withholds its terminal classification for
  at least the applied grace plus one observation cadence after the session ends —
  about 50 s at the defaults — so a session end is reported roughly that much
  later, with pausing enabled or disabled. The withhold steps at the renewal
  cadence `min(lane.liveness-interval, queue.lease-ttl / 2)` and renews the lease
  before each step, so the heartbeat stays below the TTL even when the liveness
  interval is at or above it; an invocation that loses the lease before or inside
  the withhold returns the classified `dispatch.state-unverified` result with the
  park standing, appends no terminal lane record, and derives nothing.
- **Relax activity-keyed stall detection.** A parked lane is silent by design.
  `pm-liveness.sh`, `deliver-ticket.sh`, `ceo-loop.sh`, and any operator probe with
  the same shape must be relaxed or must exclude a parked lane before a lane is
  dispatched into a window; otherwise the probe kills the waiting invocation and
  orphans the park.
- **Only a profile that declares windows, on a harness that declares `terminate`, is
  pausable.** The shipped
  `provider.profiles` branch is empty, so a host that declares no `peakWindows`
  gets no lane pausing. Declare the windows on the profile your lanes are
  nominated to, and run them on a harness that declares the terminate operation;
  a terminate-less harness never pauses.
- **Request the pause yourself with `dispatch stop`.** `dispatch stop <ref>
  --cause peak-window --until <iso>` sends the same bounded-grace stop to a running
  lane and parks it at the declared end. It admits the `peak-window` cause only and
  requires `--until`, accepted in the canonical `Z` form
  (`2026-11-12T12:00:00Z`) or the exact millisecond form
  (`2026-11-12T12:00:00.000Z`); another cause, a missing end, a past end, or a
  non-canonical end is `input.value.rejected` before any read. A lane that is
  terminal, absent, has no session, is already
  parked, or whose session cannot be confirmed stopped is refused
  `queue.precondition.unmet` and nothing is written. The park lands only after a
  confirmed terminate, and the owning invocation re-reads the park after its
  collection resolves and waits and resumes, so the stop's answer is not the
  resume. Because a fresh session's argv carries only the deterministic,
  non-repository-scoped `ticket-<REF>` title, run at most one lane per work-item
  ref per host: a separately invoked stop resolves the exact argv identity and
  could otherwise reach a same-titled session in another repository.
- **A parked lane whose invocation is gone is visible, not hidden.** `dispatch
  status` then answers `stale=true` with the park fact and its recorded end; the
  next invocation, or the delivered operator resume path, recovers the standing
  park before any new episode and before the invocation's first session, so an
  unrecoverable park is a refusal that starts no session and names the stuck
  references the repository-wide recovery pass reports. A resume or re-dispatch
  while the park has not expired is refused `dispatch.resume-parked` at exit `2`
  and writes nothing.
- **One declared residual.** A lane admitted while its nominated profile's window
  is already open is parked at the first observation, so up to one observation
  cadence plus the applied grace of billing precedes the park. No billable call
  follows the park instant.
- **Turn pausing off deliberately.** `lane.disable-peak-pausing: true` restores
  admission-gating-only behaviour, composes no watch, and makes `lanes --json`
  report `peakEnforcement.mode: "iteration-start-gating"`; a harness that declares
  no terminate operation reads the same value with pausing enabled, because no
  watch is composed for a harness that cannot stop its session. `dispatch stop`
  keeps working either way.

## 2. Inspecting one delivery

Four read-only queries answer the per-reference inspection questions without
reading any of the shell's files:

```
dispatch status <ref>                  # lane view for one reference
dispatch log <ref> --tail 200          # bounded tail of the harness's own stdout
dispatch is-delivering [<ref>]         # 0 in progress, 1 not in progress
dispatch last-message <ref>            # the session's final assistant message
```

Each takes the global `--json`. A query that needs repository identity resolves it
with persistence disabled, so no checkout marker is created, repaired, or
re-persisted. All four read only typed state: no ledger append, no fence, no
process start, no deletion, and no read of `tmp/deliver-ticket/**` or
`.ai/local/delivery/**`.

**Inspect a live delivery.** `dispatch status <ref>` reports `delivering`,
`marker` (`active`, `terminal`, or `absent`), `probe` (`live`, `dead`, `unknown`,
or `not-applicable`), the owner `pid`, the `sessionId`, the lane facts
(`attemptId`, `harness`, `iterationOrdinal`, `restartsConsumed`,
`ownerStartedAt`, `lastToken`, `lastOutcome`, `recordedAt`), and — for a worktree
lane — `worktreePath`, the directory the lane is working in. Read it as:

- `marker=active` with `probe=live` is a live delivery; `delivering=true`.
- `marker=terminal` is a finished lane; `lastToken` and `lastOutcome` carry the
  recorded outcome. A terminal lane is never stale.
- `marker=absent` is a successful answer at exit `0`: no lane exists for that
  reference in this repository.
- `stale=true` means an `active` record whose recorded owner is confirmed gone.
  The lane is inspectable but **not repaired**: the read never rewrites, clears,
  or resets it, because a stale lane is still the resumable artifact. A stale
  lane does not block a new delivery; the queue lease remains the exclusion
  mechanism.
- `probe=unknown` (an unreadable process table) never asserts staleness: the
  durable state stands, and the answer says so rather than guessing.

**Gate on `is-delivering`.** Use the per-ref form when one delivery is in
question and the ref-less form to ask whether the repository is busy; the
ref-less form lists up to 20 delivering references and one truncation fact when
more exist. Both exit `0` for "in progress" and `1` for "not in progress", and
`--json` carries the boolean in `data` with no error object. Use the payload
fact, not the exit digit, in a scripted consumer: exit `1` is a negative answer,
not a failure. An active lane whose owner is confirmed gone answers "not in
progress", so a stale lane never makes a reference or the repository look busy.

**Diagnose from the bounded tail.** `dispatch log <ref> --tail 200` returns the
newest lines of the streaming harness's own stdout, oldest-to-newest; `--tail`
defaults to 50 and accepts `1..500`. The reader stitches the newest two retained
files in name order, drops an unterminated tail (a torn write), and returns a
snapshot of what was durable when it ran — an append or a segment switch in
flight may not be in the answer, so re-run the query. When a bound binds, the
answer carries exactly one truncation fact (`scope`, `bound`, `omittedLines`);
the retained window is two files, so the newest file is not the whole story.

What the tail does **not** contain:

- the opencode child's stderr — that is the shell's `tmp/deliver-ticket/<REF>.log`,
  which the shell's `--log` tails;
- the wrapper's own progress lines — those go to the wrapper's terminal.

For opencode the typed tail is the JSON event stream, not human log text. A
`no-log` answer (`available=false`, exit `0`) means **no artifact exists for that
reference**, with two causes: the lane's adapter is one-shot (Claude Code streams
nothing) or the lane predates the artifact family. It never means "nothing ran";
`status` still answers the lane. An unreadable file answers `unreadable` at exit
`1`.

**Read the PM's final message.** `dispatch last-message <ref>` returns the
session's final assistant message, flattened to one line and bounded to 512
characters with registered credential values replaced before the bound. `final`
is true exactly when the lane is terminal; on a live lane the answer is the
latest message observed so far and may be partial, so treat it as provisional.
The query is capability-gated: opencode supports the read, while a Claude Code
lane declares the `session-introspection` gap and answers `capability-gap`. Every
negative answer is one closed reason — `no-lane`, `capability-gap`,
`session-unknown`, `no-message`, or `unreadable` — at exit `1`, with the fact in
the payload.

The per-ref queries never compose a sentence from a classifier or derivation: a
`last-message` answer is the transcript's own text, and an unavailable answer
names why. Contract detail is in [Dispatch Engine](../spec/features/feature-dispatch-engine.md).

## 3. Reading the gate

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

## 4. Flipping a repository and reversing the flip

A flip is a separate owner act, never a side effect of a delivery:

```
dispatch handover <host/owner/name>            # flip once the gate reads eligible
dispatch handover <host/owner/name> --revert   # restore dual-run
```

- A met bar records the flip; its `data` reports `operation=authoritative`,
  `recorded=true`, `reversible=true`, and the four `met` conditions, and moves
  only that repository.
- A readable but unmet bar is a clean refusal at exit `1` naming every unmet
  condition; nothing is recorded.
- A repository already `authoritative` answers an idempotent noop: its `data`
  reports `recorded=false`, `reversible=true`, no second record.
- `--revert` records a reversal and its `data` reports `reversible=false`; history
  is preserved, never deleted. Repeating the revert on a `dual-run` repository
  answers an idempotent noop with no conditions, no verdict, and no truncation — it
  changes no authority, so a torn attempts ledger cannot refuse it.
- An unreadable or torn **handover** ledger is still a classified
  `dispatch.state-unverified` refusal at exit `2`, on every path.

`repos list` reflects the same fact per row: `reversible` reads `true` for a
flipped repository and `false` after the reversal, and other repositories are
unaffected.

## 5. The shell fallback

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

**Parity enforcement is typed-lane behavior (GH-386).** The typed engine
evaluates the `pr-open` parity precondition at its derivation arm — it reads the
local branch head against the pull request's head, pushes the change branch
fast-forward exactly once when the heads are unequal, re-reads parity once, and
classifies an unresolvable push as a typed failure that retains the PR URL. The
bash fallback gains **no** parity enforcement: its five-key tail, its exits, and
its session-side push conventions are unchanged, and a fallback `pr-open`
summary makes no parity claim. An operator who chooses the fallback owns the
head check the typed lane performs by construction; the divergence is declared,
never silent, and the fallback's documented status and retirement path are
unchanged.

## 6. Declared residuals

Four limits are stated so an operator does not plan around capability that does not
exist:

- **`verify deploy` target resolution** is a declared residual: the command's
  delivered behaviour is unchanged and deploy confidence is not engine-verified.
- **A declared peak window has no read surface** of its own: the engine exposes the
  park it causes (`dispatch status`'s park fact, `status.laneParks`, the board
  `PARKED` section, the `peak-window` park record), never a window listing.
- **The `lanes` read is profile-blind**: `QueueLane` carries no `providerProfile`
  and the lanes projection shows none, so a `lanes list` reader cannot attribute a
  running lane to a provider profile. The surfaces that do carry the nomination are
  the attempt history, the daemon and dispatch lane records, the `dispatch status`
  park fact, `status.laneParks`, the board's `PARKED` section, and the
  window-scoped spend evidence.
- **A lane admitted inside an already-open window bills briefly before it parks.**
  Profile `peakWindows` do not gate admission, so such a lane spawns and is parked
  at the first observation: one observation cadence (`lane.liveness-interval`,
  30 000 ms default) plus the applied grace (`coordinator.kill-grace`, 20 000 ms
  default) at most, and no billable call after the park instant. There is no
  pre-session park; an unexpected peak charge is read against that bound before
  anything else is suspected.

The broader suites behind these contracts are specified in
[Test Specification: Dispatch Engine](../quality/test-specs/test-spec-dispatch-engine.md)
and [Test Specification: Merge and Verify Deploy](../quality/test-specs/test-spec-merge-verify-deploy.md);
those pages are reconciled at each change's `system_spec_update` lifecycle phase
(phase 7), while this guide stays the operator reference. The contract details are
in the feature pages linked above.
