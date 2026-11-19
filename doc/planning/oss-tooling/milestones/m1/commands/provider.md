# provider(1)

Status: shipped (M0-S13 engine; M1-S21 profiles and watching; GH-350 simulation,
migration, watch freshness, and the mount). Shipped behavior summarized.

## NAME

`provider` - AI model provider policy: resolve, quota, parks, profiles, watches,
simulation, and legacy migration.

## SYNOPSIS

```
<binary> provider resolve [--chain <name>] [--profile <name>]
<binary> provider quota [--provider <name>]
<binary> provider parks list [--all] [--provider <name>]
<binary> provider profile resolve [--agent <name>] [--for-spawn]
<binary> provider watch status [--provider <name>]
<binary> provider simulate --fixture <path>
<binary> provider migrate legacy [--profiles-dir <dir>] [--hook <path>] [--write]
```

## DESCRIPTION

Subscription-first chain resolution with zone-aware peak windows, quota
awareness, and budget gates; named self-expiring parks; fail-loud
announcements. Model hosts only (tracker, VCS, and CI providers are adapters,
not this family). Credentials resolve through the credential port, never direct
environment reads.

The family is the twenty-seventh and last prompt-required command family. It
answers `--help` from the static help inventory and `--version` as the
identity-only read, and every member below is reachable through the installed
product binary.

Profile selection (M1-S21) is tier-driven configuration: tiers are
responsibility structure, profiles assign the model per tier with per-agent
overrides; selection heuristics are declarative policy (consequence times
reasoning depth divided by volume; capability gates are hard rules - a
text-only seat never receives a vision task; family-diversity and amplification
rules declared). A profile is eligible iff every provider it uses is available
(lazy, memoized probes); on exhaustion the chain switches automatically and
reverts on recovery; expensive windows park with cause and expiry; subscription
pacing rungs (declared goal priorities) move only the declared non-judgment
seats. `provider profile resolve` is the selection decision every spawn runs
(CLI or daemon); `--for-spawn` emits the model environment as validated data
records for the spawn wrapper.

Provider watching (GH-350, F-7) reads the coding-plan subscription quota
endpoints (weekly and rolling windows), the balance endpoint, and the
subscription usage windows. Each declared watch target carries
`maxAgeSeconds`; a reading whose age reaches the bound is reported with the
watch-only `watch-stale` condition, is never probed, never coerced to clear,
and never reported as an outage.

`provider simulate` replays one resolution from a bounded fixture with zero
state, credential, network, spend, or local-context effect, so a decision can
be verified offline. `provider migrate legacy` reads legacy provider profiles
and the pre-iteration hook as compatibility input, prints a reviewable proposal,
and writes only under `--write`; it never imports or executes the hook.

## MEMBERS

### `provider resolve [--chain <name>] [--profile <name>]`

Resolve one chain decision; the only mutating member, persisting parks and
announcements.

| Option | Meaning |
|---|---|
| `--chain <name>` | Resolve one declared chain instead of the default chain |
| `--profile <name>` | Scope the resolution to one named profile's providers |

Examples: `<binary> provider resolve`, `<binary> provider resolve --profile mixed --json`.

Exit status: `0` a provider was selected or a park was recorded; `1` a
classified configuration, credential, or budget refusal; `2` every provider was
skipped (announced, with skip reasons).

### `provider quota [--provider <name>]`

Evaluate quota conditions without writing state.

| Option | Meaning |
|---|---|
| `--provider <name>` | Evaluate one declared provider instead of the default chain |

Examples: `<binary> provider quota`, `<binary> provider quota --provider coding-plan --json`.

Exit status: `0` conditions were evaluated; `1` a classified configuration or
credential refusal; `2` an evaluation returned its declared negative verdict.

### `provider parks list [--all] [--provider <name>]`

Read the active park projection.

| Option | Meaning |
|---|---|
| `--all` | Include cleared and expired parks |
| `--provider <name>` | Narrow the projection to one provider |

Examples: `<binary> provider parks list`, `<binary> provider parks list --all --json`.

Exit status: `0` the projection was read; `2` a platform or state failure
prevented the read.

### `provider profile resolve [--agent <name>] [--for-spawn]`

Resolve the profile selection decision for a spawn.

| Option | Meaning |
|---|---|
| `--agent <name>` | Select the seat for one agent instead of the preference chain |
| `--for-spawn` | Emit the validated model environment record for the spawn wrapper |

Examples: `<binary> provider profile resolve`,
`<binary> provider profile resolve --agent reviewer --for-spawn --json`.

Exit status: `0` a profile was selected; `1` a classified profile or capability
refusal; `2` the selection was refused by provider availability.

### `provider watch status [--provider <name>]`

Read the declared watch conditions and their observation freshness.

| Option | Meaning |
|---|---|
| `--provider <name>` | Read one declared watch target instead of every target |

Examples: `<binary> provider watch status`, `<binary> provider watch status --json`.

Exit status: `0` every declared target was read; `1` a classified value
refusal; `2` a platform failure prevented the read.

### `provider simulate --fixture <path>`

Replay a resolution from one bounded fixture without side effects.

| Option | Meaning |
|---|---|
| `--fixture <path>` | The bounded simulation fixture to replay |

Examples: `<binary> provider simulate --fixture tmp/simulate.json`,
`<binary> provider simulate --fixture tmp/simulate.json --json`.

Exit status: `0` the replay completed; `1` a classified fixture or input
refusal; `2` a platform failure prevented the replay.

### `provider migrate legacy [--profiles-dir <dir>] [--hook <path>] [--write]`

Read legacy sources as compatibility input and emit a proposal.

| Option | Meaning |
|---|---|
| `--profiles-dir <dir>` | Read legacy profiles from one declared directory |
| `--hook <path>` | Read the pre-iteration hook from one declared path |
| `--write` | Write the proposal to the project-committed configuration document |

Examples: `<binary> provider migrate legacy`,
`<binary> provider migrate legacy --profiles-dir ~/.delivery-os/config/profiles --json`.

Exit status: `0` a proposal was produced; `1` a classified migration refusal
(`provider.migrate.refused`) or an input refusal; `2` a platform failure
prevented the read.

## BUDGET REF

A declared budget is evaluated only where a resolution is evaluated. The
work-item ref resolves from an explicit fact, then the local delivery context
(`.ai/local/pm-context.yaml`), then the declared project scope; an enabled
budget with no resolvable ref refuses one `input.value.rejected` before any
resolution, probe, credential read, transport call, or write. `provider
simulate` takes its ref from the fixture; `quota`, `parks list`, `profile
resolve`, `watch status`, and `migrate legacy` never read the local delivery
context and never fail because one is absent.

## OUTPUT

Text: chain decision, quota conditions, park lines, profile selection, watch
lines. Envelope `data`: (`resolve`) `summary`, `chain`, `decision`, `skipped`,
`parks`, `announcements`; (`quota`) `providers[]`, `announcements[]`;
(`parks list`) `parks[]` (id, provider, cause, expiresAt, recheck);
(`profile resolve`) `outcome`, `profile`, `tier`, `rung`, `eligibility[]`,
`agentOverrides`, `envRecord`; (`watch status`) `providers[]` (name, condition,
source, checkedAt, observedAt, ageSeconds, maxAgeSeconds); (`simulate`) the
replay payload with `simulation.stateWrites` at `0`; (`migrate legacy`) the
`proposal` document and its `report`.

## OPTIONS

Every member accepts the global `--json`, `--verbose`, and `--pretty` flags.
`--help` renders this family or a member page from the static inventory;
`--version` answers the binary identity and the build token only.

## EXIT STATUS

0 resolved or read; 1 misconfiguration, refusal, or invalid input (classified);
2 all providers skipped (announced, with skip reasons) or a platform failure
prevented the operation.

## EXAMPLES

```
$ <binary> provider resolve --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZU2Z5E",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T09:30:00Z", "durationMs": 210 },
  "data": {
    "provider": "provider-b",
    "mode": "subscription",
    "decision": "chain[0] provider-a skipped: peak-window; chain[1] provider-b quota ok",
    "parksConsidered": ["P-31"]
  }
}
```

All providers skipped, announced:

```
$ <binary> provider resolve --json | cat
{"error":{"code":"provider.chain-exhausted","category":"platform","retryable":true,"consequence":"not_landed","remediationHint":"all 3 providers skipped: peak-window (2), quota-exhausted (1); earliest clear 10:30Z"}}
```

Profile selection for a spawn (scripted mode, trimmed output):

```
$ <binary> provider profile resolve --agent reviewer --for-spawn --json | cat
{"data":{"profile":"mixed","rung":"cruise","eligibility":[{"profile":"mixed","verdict":"eligible","blockers":[]},{"profile":"deepseek","verdict":"eligible","blockers":[]}],"agentOverrides":{"reviewer":"tier1-judgment"},"envRecord":{"OC_MODEL_COORDINATOR":"tier2","OC_MODEL_REVIEWER":"tier1","recordFormat":"data-v1"}}}
```

Watch status (with the observation instant and the effective bound):

```
$ <binary> provider watch status --json
{
  "schemaVersion": 1,
  "runId": "r_01J9A2C8K1P",
  "exitCode": 0,
  "timing": { "started": "2026-11-20T06:55:00Z", "durationMs": 640 },
  "data": {
    "providers": [
      { "name": "coding-plan subscription", "condition": "quota-ok",
        "source": "quota endpoints: weekly 61%, 5h window 12%", "checkedAt": "2026-11-20T06:54:59Z",
        "observedAt": "2026-11-20T06:54:59Z", "ageSeconds": 0, "maxAgeSeconds": 900 },
      { "name": "deepseek", "condition": "balance-ok",
        "source": "balance API above floor", "checkedAt": "2026-11-20T06:54:58Z",
        "observedAt": "2026-11-20T06:54:58Z", "ageSeconds": 1, "maxAgeSeconds": 900 },
      { "name": "openai", "condition": "watch-stale",
        "source": "observed 2026-11-20T06:30:00Z; stale at age >= 900s", "checkedAt": "2026-11-20T06:54:58Z",
        "observedAt": "2026-11-20T06:30:00Z", "ageSeconds": 1498, "maxAgeSeconds": 900 }
    ]
  }
}
```

Simulation (zero writes), and the migration proposal:

```
$ <binary> provider simulate --fixture tmp/simulate.json --json | cat
$ <binary> provider migrate legacy --json | cat
```

## ERRORS

`provider.chain.empty`, `provider.chain.invalid`, `provider.quota.exceeded`,
`provider.outage`, `provider.auth.rejected`; profile selection adds
`provider.profile.absent`, `provider.profile.invalid`,
`provider.profile.capability-denied`, `provider.profile.unavailable`; the
env-record contract adds `provider.env-record.unauthorized`,
`provider.env-record.duplicate`, `provider.env-record.malformed`, and
`provider.env-record.oversized`. The GH-350 surface adds
`provider.peak.zone-unknown` (an undeclared or unknown IANA zone, refused before
evaluation), `provider.budget.exceeded` (a declared budget ceiling at or above
its bound), and `provider.migrate.refused` (a legacy read, parse, proposal, or
target-exists refusal). Budget evaluation with no resolvable work-item ref is
`input.value.rejected`, not a provider identity.

## SEE ALSO

[doctor.md](doctor.md), [queue.md](queue.md),
[feature-provider-engine.md](../../../spec/features/feature-provider-engine.md),
[feature-provider-profiles.md](../../../spec/features/feature-provider-profiles.md)
