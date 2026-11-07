# provider(1)

Status: shipped (M0-S13 engine; M1-S21 profiles and watching). Shipped
behavior summarized.

## NAME

`provider` - AI model provider routing: resolve, quota, parks.

## SYNOPSIS

```
<binary> provider resolve [--profile <name>]
<binary> provider profile resolve [--agent <name>] [--for-spawn]
<binary> provider watch status [--provider <name>]
<binary> provider quota [--provider <name>]
<binary> provider parks list [--all] [--provider <name>]
```

## DESCRIPTION

Subscription-first chain resolution with quota and peak-window
awareness; named self-expiring parks; fail-loud announcements. Model
hosts only (tracker, VCS, and CI providers are adapters, not this
family). Credentials resolve through the credential port, never direct
environment reads.

Profile selection (M1-S21) is tier-driven configuration: tiers are
responsibility structure, profiles assign the model per tier with
per-agent overrides; selection heuristics are declarative policy
(consequence times reasoning depth divided by volume; capability gates
are hard rules - a text-only seat never receives a vision task;
family-diversity and amplification rules declared). A profile is
eligible iff every provider it uses is available (lazy, memoized
probes); on exhaustion the chain switches automatically and reverts on
recovery; expensive windows park with cause and expiry; subscription
pacing rungs (declared goal priorities) move only the declared
non-judgment seats. `provider profile resolve` is the selection
decision every spawn runs (CLI or daemon); `--for-spawn` emits the
model environment as validated data records for the spawn wrapper.
Provider watching (M1-S21, first iteration): the coding-plan
subscription quota endpoints (weekly and rolling windows), the DeepSeek
balance API, the OpenAI subscription usage windows.

## OUTPUT

Text: chain decision, quota snapshot, park lines. Envelope `data`:
(`resolve`) `provider`, `mode` (subscription, paid), `decision`,
`parksConsidered`; (`profile resolve`) `profile`, `eligibility[]`
(profile, verdict, blockers), `rung`, `agentOverrides`, `envRecord`;
(`watch status`) `providers[]` (name, condition, source, checkedAt);
(`quota`) per-provider conditions; (`parks list`) `parks[]` (id,
provider, cause, expiresAt, recheck).

## EXIT STATUS

0 resolved or read; 1 misconfiguration (classified); 2 all providers
skipped (announced, with skip reasons).

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

Profile selection for a spawn (M1-S21; scripted mode, trimmed output):

```
$ <binary> provider profile resolve --agent reviewer --for-spawn --json | cat
{"data":{"profile":"mixed","rung":"cruise","eligibility":[{"profile":"mixed","verdict":"eligible","blockers":[]},{"profile":"deepseek","verdict":"eligible","blockers":[]}],"agentOverrides":{"reviewer":"tier1-judgment"},"envRecord":{"OC_MODEL_COORDINATOR":"tier2","OC_MODEL_REVIEWER":"tier1","recordFormat":"data-v1"}}}
```

Watch status (first-iteration providers):

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
        "source": "quota endpoints: weekly 61%, 5h window 12%", "checkedAt": "2026-11-20T06:54:59Z" },
      { "name": "deepseek", "condition": "balance-ok",
        "source": "balance API above floor", "checkedAt": "2026-11-20T06:54:58Z" },
      { "name": "openai", "condition": "peak-window",
        "source": "subscription usage windows", "checkedAt": "2026-11-20T06:54:58Z" }
    ]
  }
}
```

## ERRORS

`provider.chain.empty`, `provider.chain.invalid`, `provider.quota.exceeded`,
`provider.outage`, `provider.auth.rejected`; profile selection adds
`provider.profile.absent`, `provider.profile.invalid`,
`provider.profile.capability-denied`, `provider.profile.unavailable`; the
env-record contract adds `provider.env-record.unauthorized`,
`provider.env-record.duplicate`, `provider.env-record.malformed`, and
`provider.env-record.oversized`.

## SEE ALSO

[doctor.md](doctor.md), [queue.md](queue.md)
