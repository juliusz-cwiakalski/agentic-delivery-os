# dispatch(1)

Status: M1 planned (M1-S9; harness adapters M1-S11). Proposed contract;
see [../contracts.md](../contracts.md) and
[../test-scenarios.md](../test-scenarios.md).

## NAME

`dispatch` - deliver one change through the lifecycle, beside then in
place of the bash stack.

## SYNOPSIS

```
<binary> dispatch <ref> [--harness <name>] [--resume-prompt <text>]
<binary> dispatch dual-run summary --repo <repo>
<binary> dispatch handover <repo>
```

## DESCRIPTION

Spawns the lifecycle session for one change through the configured
harness adapter, watches it with progress-based liveness, and classifies
the outcome. Dual-run mode keeps the bash stack authoritative until a
repository's two clean weeks of evidence; handover flips that repository
to engine-authoritative (reversible) with bash demoted to fallback.

## OPTIONS

- `<ref>` - work item reference.
- `--harness <name>` - harness adapter (opencode, claude-code);
  default from config.
- `--resume-prompt <text>` - resume the existing lane with guidance
  instead of spawning fresh.

## OUTPUT

Text: the bash-continuity summary keys (`result=`, `pr_url=`,
`exit_code=`, `last_message=`). Envelope `data`: `result`, `prUrl`,
`phaseLedger`, `restarts`, `resumeAmplification`, `harness`,
`handoverState`.

## EXIT STATUS

0 delivered or pr-open; 1 classified refusal or user error; 2 platform
faults, restart budget exhaustion, or state-unverified outcomes.

## EXAMPLES

Happy path (interactive terminal, `--json` pretty by auto):

```
$ <binary> dispatch GH-301 --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZK3M9Q",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T09:14:02Z", "durationMs": 612000 },
  "data": {
    "result": "pr-open",
    "prUrl": "https://example/PR/341",
    "phaseLedger": { "completed": 11, "total": 11, "variant": "full" },
    "restarts": 0,
    "resumeAmplification": 1.0,
    "harness": "opencode",
    "handoverState": "dual-run"
  }
}
```

Blocked, answerable without re-entry (script context, minified by
auto):

```
$ <binary> dispatch GH-302 --json | cat
{"schemaVersion":1,"runId":"r_01J8ZK4P2R","exitCode":1,"timing":{"started":"2026-11-18T10:02:11Z","durationMs":54000},"data":{"result":"blocked","blocker":{"id":"q-8f21","type":"decision-needed","question":"plan tier: full or lite for the closeout residue sweep?","options":["full","lite+escalation"]},"lastMessage":"lane parked on typed question q-8f21"}}
```

## ERRORS

`dispatch.session.spawn-failed`, `dispatch.restart-budget-exceeded`
(classified, loud; escalates per SC-M1-15),
`dispatch.resume-uneconomical`, `dispatch.state-unverified`.

## SEE ALSO

[merge.md](merge.md), [blockers.md](blockers.md), [daemon.md](daemon.md)
