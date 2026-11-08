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
<binary> dispatch --help
<binary> dispatch --version
```

## DESCRIPTION

Spawns or resumes the lifecycle session for one change through the configured
harness adapter, watches it with progress-based liveness, classifies the outcome
through the shared classifier, and derives the result from artifact, tracker,
ledger, and CI truth rather than from an exit code. An exit-0 session with no
branch commit, no pull request, and no ledger progress is `failed`; unreadable
truth is `state-unverified`.

The watch polls the harness liveness source at the `lane.liveness-interval`
cadence while collection is pending and carries the previous observation, so a
stall needs two consecutive sourced evaluations with no advance. A stall is a
current-state verdict, not a latch: a later `progressing` observation clears it.
A stall that is still current when evidence collection resolves, at or above
`lane.restart-budget`, is the restart-budget refusal (`max-restarts`) with the
terminal exhaustion record; below the bound it is recorded as liveness evidence
and left to lane supervision. A session that completed is never re-keyed to
`max-restarts` by an already-reached bound, because the budget governs admission
of a further attempt rather than the classification of a finished session. The
delivered session port exposes no kill operation, so the one-shot command never
starts a second session for the same attempt: a stall is never silently leaked.

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
four bash entry points read the derived authority view as a plain file, so an
absent or malformed view means dual-run and the typed CLI is never required to
decide fallback.

`dispatch` never fires a merge. `result=merged` is already-merged detection only;
a merge-ready PR stays `pr-open` or `pr-open-unverified` for the coordinator's
merge decision.

## OPTIONS

- `<ref>` - work item reference.
- `--harness <name>` - harness adapter (opencode, claude-code); default from
  configuration.
- `--resume-prompt <text>` - resume the existing lane with guidance instead of
  spawning fresh; the resume mode and prefill cost are recorded.
- `--repo <repo>` - repository identity for `dual-run summary` and `handover`.
- `--note <text>` - bounded resolution note for `dual-run resolve`.
- `--revert` - revert a recorded handover to dual-run.
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
eligibility verdict, and every unmet condition.

## EXIT STATUS

- `0` for `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `finished`, and
  `noop-lane-nothing-to-do`; also for a summary (even ineligible) and a noop
  reversal.
- `1` for `failed`, `max-restarts`, `partial`, `noop-lane-permission`, a
  restart-budget or resume-economics refusal, and a readable-but-unmet handover.
- `2` for `state-unverified` and an unreadable or torn evidence read.

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

`dispatch.session.spawn-failed`, `dispatch.restart-budget-exceeded`,
`dispatch.resume-uneconomical`, `dispatch.state-unverified`. A pre-session
refusal (unknown harness, rejected input, or a conflicting lease before a spawn)
emits the classified envelope and appends no attempt record; every attempt-stage
failure is recorded with its pinned token and outcome.

## SEE ALSO

[merge.md](merge.md), [blockers.md](blockers.md), [daemon.md](daemon.md)
