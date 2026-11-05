# provider(1)

Status: M0 shipped (M0-S13). Shipped behavior summarized; examples
proposed.

## NAME

`provider` - AI model provider routing: resolve, quota, parks.

## SYNOPSIS

```
<binary> provider resolve [--profile <name>]
<binary> provider quota [--provider <name>]
<binary> provider parks list [--all] [--provider <name>]
```

## DESCRIPTION

Subscription-first chain resolution with quota and peak-window
awareness; named self-expiring parks; fail-loud announcements. Model
hosts only (tracker, VCS, and CI providers are adapters, not this
family). Credentials resolve through the credential port, never direct
environment reads.

## OUTPUT

Text: chain decision, quota snapshot, park lines. Envelope `data`:
(`resolve`) `provider`, `mode` (subscription, paid), `decision`,
`parksConsidered`; (`quota`) per-provider conditions; (`parks list`)
`parks[]` (id, provider, cause, expiresAt, recheck).

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
{"schemaVersion":1,"runId":"r_01J8ZU3A7F","exitCode":2,"timing":{"started":"2026-11-18T09:31:12Z","durationMs":190},"error":{"code":"provider.chain-exhausted","category":"platform","retryable":true,"consequence":"not_landed","remediationHint":"all 3 providers skipped: peak-window (2), quota-exhausted (1); earliest clear 10:30Z"}}
```

## ERRORS

`provider.chain-exhausted`, `provider.quota-exceeded`,
`provider.park-active` (informational on reads).

## SEE ALSO

[doctor.md](doctor.md), [queue.md](queue.md)
