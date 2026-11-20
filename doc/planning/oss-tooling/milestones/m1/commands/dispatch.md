# dispatch(1)

Status: M1 delivered (M1-S9; harness adapters M1-S11). Implemented contract;
see [../contracts.md](../contracts.md) and [../test-scenarios.md](../test-scenarios.md).

## NAME

`dispatch` - deliver one change through the lifecycle, beside then in place of
the bash stack.

## SYNOPSIS

```
<binary> dispatch <ref> [--harness <name>] [--resume-prompt <text>]
<binary> dispatch dual-run summary --repo <repo>
<binary> dispatch dual-run resolve <divergence-id> --note <text>
<binary> dispatch handover <repo> [--revert]
<binary> dispatch status <ref> [--json]
<binary> dispatch log <ref> [--tail <n>] [--json]
<binary> dispatch is-delivering [<ref>] [--json]
<binary> dispatch last-message <ref> [--json]
<binary> dispatch --help
<binary> dispatch --version
```

## DESCRIPTION

Spawns or resumes the lifecycle session for one change through the configured
harness adapter, watches it with progress-based liveness, classifies the outcome
through the shared classifier, and derives the result from artifact, tracker,
ledger, and CI truth rather than from an exit code. One invocation owns a bounded
loop of session iterations. The derivation is one total order: a spawn failure is
`failed`, a resume refused as uneconomical is `failed`, a tracker-done work item
is `merged` (corroborated by the tracker fact alone), a blocking tracker state is
`blocked`, an open pull request is `pr-open` or `pr-open-unverified`, an
already-merged pull request is `merged`, commits with complete pm-notes are
`finished`, commits with incomplete or absent pm-notes are `partial`, and no
commits with no pull request and a readable non-done non-blocked tracker is
`noop-lane-nothing-to-do`. Unreadable truth is `state-unverified`; an exit-0
session with no decisive artifact and an unreadable tracker is never a success.

A fresh spawn runs as the `pm` agent with the deterministic `ticket-<REF>` title
and the delivery-lifecycle prompt built for the reference and the base branch.
Those three facts are internal composition facts: they add no flag, argument, or
output key, and a resume carries no title.

The watch polls the harness liveness source at the `lane.liveness-interval`
cadence while collection is pending and carries the previous observation, so a
stall needs two consecutive sourced evaluations with no advance. A stall is a
current-state verdict, not a latch: a later `progressing` observation clears it.
A stall that is still current when evidence collection resolves, or a
harness-reported timeout, is restart-eligible; a clean session exit is always
terminal and is never re-keyed to `max-restarts` by an already-reached bound.
Before any restart decision the termination capability is evaluated from the
declaration carried on the port itself, and the stalled session is terminated
through the capability-gated harness `terminate` operation when it is supported:
TERM reaches the session's own process tree, KILL follows only after the declared
grace (`coordinator.kill-grace`), `reaped` reports that an escaped runtime's exact
identity was matched (a match, not an OS reap), and a resume clears the recorded
termination fact because it re-enters as a new live process tree. An adapter that
declares no terminate capability is never asked. With the terminal pre-restart
verdicts excluded, a stall on such an adapter, or a stall whose termination is not
confirmed (`terminated: false` or a rejected call), starts no second session and
resolves terminal `state-unverified` at exit `2` with the stall evidence and no
ordinal. Only a confirmed termination reaches the restart decision: below
`lane.restart-budget` it consumes one restart ordinal, appends one
`economics.restart` with reason `watchdog.liveness-stalled`, and resumes the
recorded session in-process for the next iteration; at or above the bound it
records the restart-budget refusal (`max-restarts`) with the terminal exhaustion
record. One invocation owns the whole loop and appends exactly one attempt
record, so the one-shot command never leaves a stalled session running beside a
second one.

Every session acquisition appends one active `dispatch.lane` record and the final
classification appends one terminal record carrying the token and outcome. The
record is append-only and the latest record for the ref is the lane, so a
recorded attempt — including a `pr-open` attempt — is the resumable artifact
rather than a fresh spawn. A pre-session refusal appends no lease, lane, attempt,
or queue record.

The dispatch claim decides the per-ref verdict inside the claim: a live lease
that already records the requested ref refuses `queue.single-flight` with the
holder at the failure-envelope root, a live lease on another ref refuses
`queue.lease-conflict`, a stale lease is taken over with incident evidence, and no
live lease claims. Store-fence contention is waited out within the lease TTL and
then re-decided. The dispatch caller never renews; the sibling `queue claim`
keeps its own-holder renewal and repository exclusivity unchanged.

Dual-run keeps the bash stack authoritative. A repository moves to
engine-authoritative only when the evidence-based handover bar is met. The bar is
one conjunction of four separated conditions over the evaluated evidence window:

1. **Truth**: zero false-success incidents and zero unresolved divergences inside
   the window.
2. **Coverage (exposure only)**: all eleven delivery-result classes have been
   produced at least once among counted dispatches. A `state-unverified` attempt
   counts for coverage, makes no success claim, and creates no divergence.
3. **Floor (floor-only)**: at least 20 counted dispatches, or at least 7
   consecutive UTC dates with at least one counted dispatch, whichever comes
   first. The floor never substitutes for truth, coverage, or corroboration.
4. **Corroboration (success claims only)**: every counted success claim is
   corroborated by completed pm-notes phases, tracker state, and CI on the pushed
   head as its outcome family requires.

Counted dispatches are scoped by evidence class: a production repository counts
only `pilot` deliveries; the controlled proof counts only `controlled-proof` in
its own scope; `smoke` and `fixture` deliveries count toward no handover. The
window lower bound is the most recent false-success incident's recorded
timestamp, exclusive, when an incident exists; otherwise it is the first counted
dispatch, inclusive. The summary always reports the window start and its reason.

Handover flips one repository, is recorded, and is reversible with
`dispatch handover <repo> --revert`; a reversal appends a record rather than
deleting history and an already-dual-run repository is an idempotent noop. The
handover data carries the four ordered `conditions` and `reversible` on every
outcome that performs the gate evidence read — a recorded flip, an idempotent
flip noop, a clean refusal, and a recorded revert — and the recorded revert also
carries `verdict`, so `verdict == "unverifiable"` holds exactly when `truncation`
is present. `reversible` is `true` exactly when the repository's latest folded
authority after the operation is `authoritative`. The single exemption is the
idempotent revert noop: it is answered before any gate evidence read (the folded
handover is still read to establish it) and carries no `conditions`, no
`verdict`, and no `truncation`, so an unreadable or torn attempts or divergences
ledger cannot refuse an operation that changes no authority; an unreadable or
torn handover ledger still refuses `dispatch.state-unverified` at exit `2` with
no data on this path too. The four bash entry points read the derived authority
view as a plain file, so an absent or malformed view means dual-run and the
typed CLI is never required to decide fallback.

`dispatch` never fires a merge. `result=merged` is already-merged detection only;
a merge-ready PR stays `pr-open` or `pr-open-unverified` for the coordinator's
merge decision.

## ADMISSION PREFLIGHT

Before `claimLease` and before any spawn or resume, and after harness resolution
and input validation, dispatch resolves the declared truth-read credential
reference `github-read` (the exact environment key `GITHUB_TOKEN`) and performs
one bounded work-item read. A refusal here is a pre-session refusal: it opens no
session, branch, worktree, lease, attempt, divergence, handover, or authority
change.

The preflight classifies that read itself from the received status, never by
forwarding the adapter identity:

| Read outcome | Identity | Kind | Exit |
|---|---|---|---|
| credential unresolvable | `config.credential.missing` | `config` | 1 |
| status 401 or 403 | `provider.auth.rejected` | `provider` | 1 |
| status 5xx or any other status-bearing non-2xx | `provider.outage` | `provider` | 2 |
| no status (transport throw or timeout) | `provider.outage` | `provider` | 2 |
| malformed 2xx payload (status present) | `provider.payload.invalid` | `provider` | 2 |
| status 404 | `input.value.rejected` | `input` | 1 |

A 404 means the provider reported the work item absent for this credential. A
private item the credential is not scoped to see answers 404 exactly like an
absent one, so verify the reference **and** the token's repository scope before
changing the reference. Non-interactive consumers that previously treated every
failed dispatch as exit `2` with one attempt record must treat these pre-session
refusals as precondition failures: there is no attempt record to read.

A dispatch whose session completed and whose phase ledger shows progress or a
complete total, but whose truth read is unreadable, records at most one open
delivered-evidence divergence per `(repository, work-item reference)` pair. A
resume reuses and references the existing open record instead of appending a
second one. Resolve it locally with `dispatch dual-run resolve <id> --note
<text>`; a later unverifiable attempt may open a new record only after the
previous one is resolved. `doctor` remains unshipped in this release; its
existing `tracker.credential-unavailable` check keeps parity through tests.

## OPTIONS

- `<ref>` - work item reference.
- `--harness <name>` - harness adapter (opencode, claude-code); default from
  configuration.
- `--resume-prompt <text>` - resume the recorded attempt with guidance instead of
  spawning fresh. The resolver returns the newest recorded lane for the ref that
  carries a session identity (a dispatch-owned lane in any state, including a
  recorded `pr-open` attempt, or a resumable daemon lane), and the attempted
  resume records the resume mode and prefill cost. An unknown session is a
  classified failure, never a silent fresh spawn; with no recorded lane the text
  is an explicit fresh spawn. An operator resume is admitted regardless of the
  persisted restart bound and consumes no restart ordinal. There is no new flag:
  the agent identity (`pm`), the deterministic `ticket-<REF>` title, and the
  lifecycle prompt are internal composition facts, and the grammar is unchanged.
- `--repo <repo>` - repository identity for `dual-run summary` and `handover`.
- `--note <text>` - bounded resolution note for `dual-run resolve`.
- `--revert` - revert a recorded handover to dual-run.
- `--tail <n>` - `dispatch log` only: the number of newest lines to return, a
  canonical decimal in `1..500` with a default of `50`. An out-of-range,
  negative, fractional, leading-zero, or non-numeric value is refused
  (`input.value.rejected`) rather than clamped. A missing value is the shared
  parser's refusal (`fallback.invocation`).
- `--help` - pure self-description; reads no state, git, network, or model.
- `--version` - pure version identity.

## OUTPUT

Text: the bash-continuity summary keys in order (`result=`, `pr_url=`,
`exit_code=`, `last_message=`) and no fifth key. Envelope `data`: `result`,
`prUrl`, `phaseLedger`, `restarts`, `resumeAmplification`, `harness`,
`handoverState`, `outcome`. The summary reports the window start and reason, day
count, counted deliveries, counted evidence class and cross-class exclusions,
incidents, divergences (reported, resolved, unresolved, identifiers), class
coverage as exposure, corroboration of success claims, the floor-only marker, the
eligibility verdict, and every unmet condition. After `floor` it appends
`cleanDispatches` (the corroborated counted attempts, declared identical to
`corroboration.satisfied`), `consecutiveCleanDispatches` (the trailing run of
clean counted attempts in ledger append order; `0` when the window's last counted
attempt is not clean or the window is empty), and `conditions` (four
`{condition, status}` entries in the declared order `truth`, `coverage`, `floor`,
`corroboration`, each `met` or `open`); `truncation` stays last. The summary text
appends `clean_dispatches=`, `consecutive_clean_dispatches=`, and
`conditions=truth:<status>,coverage:<status>,floor:<status>,corroboration:<status>`
after `unmet_conditions=` and before the optional truncation line.

### The four per-ref operator queries

`dispatch status <ref>`, `dispatch log <ref> [--tail <n>]`,
`dispatch is-delivering [<ref>]`, and `dispatch last-message <ref>` read the
durable `dispatch.lane` record and two reference-scoped read sources. Every answer
carries exactly one `query` discriminator (`status`, `log`, `is-delivering`,
`last-message`).

- `status` answers `delivering`, `stale`, `marker` (`active` | `terminal` |
  `absent`), `probe` (`live` | `dead` | `unknown` | `not-applicable`), `pid`,
  `sessionId`, `repository`, `ref`, and the lane facts (`attemptId`, `harness`,
  `iterationOrdinal`, `restartsConsumed`, `ownerStartedAt`, `lastToken`,
  `lastOutcome`, `recordedAt`) or a null lane. `marker` is derived from the lane
  record's state; no marker file exists on the typed path. `stale` is true only
  for an `active` lane whose recorded owner is confirmed gone; an `unknown`
  probe never asserts staleness, and a stale lane is never rewritten, cleared, or
  repaired.
- `is-delivering` answers a boolean: `ref` set for the per-ref form (no `refs`
  list), `ref=null` with up to 20 `refs` and one truncation fact for the
  repository-wide form. Exit `0` when in progress and `1` when not; the JSON
  answer carries the boolean with no error object.
- `log` answers `available`, `tail`, the newest `lines` oldest-to-newest, and at
  most one `truncation` fact (`scope` `tail` | `bytes`, `bound`, `omittedLines`).
  The selected lines are bounded to 200 lines and the machine `data` bound, so a
  request above 200 lines answers at most 200 lines plus a truncation fact. Human
  output is the raw tail followed by at most one `truncation=` line, or
  `reason=<reason>` when nothing is available. The content
  is a **streaming harness's own stdout** (for opencode, its JSON event stream),
  not the shell's child-stderr log: the shell's `--log` tails
  `tmp/deliver-ticket/<REF>.log`, which holds the opencode child's stderr, while
  the wrapper's own progress lines reach the terminal. The typed reader lists only
  `dispatch-logs.<workspace>/<REF>/`, stitches the newest two files in name order,
  drops an unterminated tail, and returns a snapshot of what was durable. A lane
  that streams nothing — a one-shot adapter such as Claude Code — and a
  pre-change lane with no artifact both answer `available=false`,
  `reason=no-log`, exit `0`; `no-log` never means "the session printed nothing".
  A retained file with no complete line is `available=true` with an empty line
  list. An unreadable file is `available=false`, `reason=unreadable`, exit `1`.
- `last-message` answers `available`, `final`, `message` (or explicit `null`),
  `truncated` (true exactly when the composed text was cut),
  `recordedAt` (or explicit `null`), and one closed `reason` when it cannot
  answer: `no-lane`, `capability-gap`, `session-unknown`, `no-message`,
  `unreadable`. The message is the session's final assistant text, composed
  `redact -> flatten -> bound(512) -> mark` (registered credential values are
  replaced first, so a credential straddling the cut cannot survive as a
  prefix), and `final` is true exactly for a terminal lane. `capability-gap`
  means the lane's harness declares the existing `session-introspection`
  capability as a gap (Claude Code, `headless-mode-limitation`); it is never
  produced for opencode. Human output is the key set `available`, `final`,
  `reason` when present, and `last_message`. The query reads no attempt record,
  derivation payload, or envelope field, and performs no session operation.

All four queries are read-only and shell-free: zero ledger appends, zero fence
acquisitions, zero lane rewrites, zero identity-marker writes, zero process
starts, zero network reads, and zero deletions inside the artifact family. They
read no shell-owned path, so the shell's marker, PID, stdout, and last-message
files can never steer a typed answer.

## EXIT STATUS

- `0` for `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `finished`, and
  `noop-lane-nothing-to-do`; also for a summary (even ineligible) and a noop
  reversal.
- `1` for `failed`, `max-restarts`, `partial`, `noop-lane-permission`, a
  restart-budget or resume-economics refusal, and a readable-but-unmet handover.
- `2` for `state-unverified` and an unreadable or torn evidence read.
- `1` for a pre-session missing or rejected credential, and for a work item the
  provider reports absent (`input.value.rejected`); `2` for a pre-session
  provider outage or a malformed 2xx payload. None of these appends an attempt
  record, so a consumer must read the refusal identity, not an attempt.
- The operator queries declare their own convention: `status` is `0` in every
  state, including an absent ref. `is-delivering` is `0` when in progress and `1`
  when not. `log` is `0` for a produced tail and for `no-log`, `1` for
  `unreadable`. `last-message` is `0` when produced and `1` for every closed
  negative reason. Because `1` is also the `user-validation` exit, every negative
  answer carries its fact in the payload and in `--json`. A lane store that
  cannot be read keeps the store's own typed `state.*` identity at that row's
  projection (`state.store.torn` is `2`, `state.permission.denied` is `1`),
  never a fabricated `absent` or `false`.

## EXAMPLES

Happy path:

```
$ <binary> dispatch GH-301
result=pr-open
pr_url=https://example/PR/341
exit_code=0
last_message=the pull request is open and awaits the coordinator's merge decision
```

Summary and handover:

```
$ <binary> dispatch dual-run summary --repo github.com/owner/repo --json
$ <binary> dispatch handover github.com/owner/repo
$ <binary> dispatch handover github.com/owner/repo --revert
```

## ERRORS

`config.credential.missing`, `provider.auth.rejected`, `provider.outage`,
`provider.payload.invalid`, `input.value.rejected`,
`dispatch.session.spawn-failed`, `dispatch.restart-budget-exceeded`,
`dispatch.resume-uneconomical`, `dispatch.state-unverified`. The operator
queries add no error-table row: `no-lane`, `no-log`, `capability-gap`,
`session-unknown`, `no-message`, and `unreadable` are DATA facts on the payload,
not error identities — `capability-gap` applies exactly when the lane's harness
declares `session-introspection` as a gap — and a malformed or missing reference,
an unexpected extra positional, or an invalid `--tail` value is the delivered
`input.value.rejected`, decided before any runtime call. A pre-session
refusal (unknown harness, rejected input, an unresolvable credential, a failing
admission read, an active owner hold reporting `queue.precondition.unmet` with
reason `owner-hold`, or a conflicting lease before a spawn) emits the classified
envelope and appends no attempt record; every attempt-stage failure is recorded
with its pinned token and outcome. A local store fault during
`dispatch dual-run resolve` keeps its own `kind: "state"` code; an absent
divergence identifier is `input.value.rejected` with `kind: "input"`.

## SEE ALSO

[merge.md](merge.md), [blockers.md](blockers.md), [daemon.md](daemon.md)
