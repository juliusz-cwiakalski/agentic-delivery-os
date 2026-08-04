---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/zai-peak-hours-hook.md
ados_distribution: redistributable
---
# Z.AI Peak-Hours & Quota Hook Guide

The Z.AI pre-iteration hook pauses autonomous delivery during the Z.AI Coding
Plan peak window (so you don't burn quota at 3x rates) **and**, when you opt
in, when the Z.AI token quota is exhausted (so delivery sleeps until the quota
resets instead of restart-storming). It is an opt-in, user-owned executable
that `deliver-ticket.sh` and `ceo-loop.sh` invoke before every PM/CEO spawn.

## Z.AI peak hours and quota rates

From [Z.AI documentation]([https://docs.z.ai](https://docs.z.ai/devpack/overview#usage-instruction)):

> Supported models and Visual Understanding MCP share the same usage quota.
> GLM-5.2 and GLM-5-Turbo consume quota at **3x during peak hours** and 2x
> during off-peak hours. Limited-time benefit: off-peak usage is currently
> charged at only 1x quota through the end of September. **Peak hours:
> 14:00–18:00 daily (UTC+8).**

| | |
|---|---|
| **Z.AI peak (UTC+8)** | 14:00–18:00 daily |
| **Z.AI peak (UTC)** | 06:00–10:00 daily |
| **Peak rate** | 3x quota per request |
| **Off-peak rate** | 2x (limited-time: 1x through September) |

### Why we pause earlier than the peak

A single ticket delivery typically takes **1–2 hours**. If the hook waited
until exactly 06:00 UTC to start pausing, a delivery that started at 05:55
would run the bulk of its iterations inside the 3x peak window. The hook
therefore begins pausing **before** peak start by a configurable buffer.

With the default buffer of **2 hours**, the effective pause window is:

| | |
|---|---|
| **Effective pause window** | 04:00–10:00 UTC (6 hours) |
| **Effective delivery window** | 10:00–04:00 UTC (18 hours) |

## What the hook does

When the configured agent model uses the `zai-coding-plan/` provider prefix
**and** the current time is inside the effective pause window (peak window +
buffer), the hook **sleeps until the peak ends** — it does not fail, veto,
or produce environment output. The wrapper simply waits, then spawns the
agent once the off-peak window opens. If the model does not use
`zai-coding-plan/`, or the current time is outside the pause window, the
hook returns immediately (zero-cost no-op).

| | |
|---|---|
| **Activation condition** | Model value starts with `zai-coding-plan/` |
| **Behavior during pause window** | Sleeps until peak end (10:00 UTC), then returns 0 |
| **Behavior outside pause window** | Returns 0 immediately |
| **Failure handling** | A hook crash/timeout follows the standard wrapper failure path (`deliver-ticket.sh`: `failed`/exit-1; `ceo-loop.sh`: bounded retry counter) |

## Quota-aware waiting (opt-in)

In addition to peak-hours waiting, the hook can pause delivery when the Z.AI
Coding Plan token quota is exhausted, sleeping until the quota resets. This
stops the "restart-storm": when quota is exhausted the session makes no forward
progress, the wrapper misreads it as a generic liveness stall, and
kill/restarts the same work repeatedly — even though no restart can replenish a
quota. The correct action is to **wait**.

**What it does.** The hook queries the Z.AI quota endpoint and inspects the
`TOKENS_LIMIT` windows (the 5-hour and the weekly window). If **any** token
window reports `percentage >= 100`, the hook sleeps until the soonest
`nextResetTime` among the exhausted windows. It pre-empts at
`percentage >= 100` and **never** waits for an HTTP 429. `TIME_LIMIT` windows
(the MCP call budget) are ignored — they do not block model inference.

**Opt-in.** Quota checking activates **only** when all of the following hold:

- the configured model uses the `zai-coding-plan/` provider prefix, **and**
- `ZAI_API_KEY` is set (the same key you use for inference), **and**
- both `jq` and `curl` are present on `PATH`.

Users who do not set `ZAI_API_KEY` get **byte-identical peak-only behavior** —
no network call, no `jq`, no new runtime dependency. The quota code path is
never entered.

**Fail-open guarantee.** If the quota check cannot obtain a trustworthy result
(network/auth failure, HTTP 401/403, non-200 envelope, malformed JSON, missing
or non-numeric fields, or an unparseable reset time), the hook emits exactly
one `[WARN]` line (reason category only) and proceeds with peak-only behavior.
It never blocks delivery on a transient API error and never changes the hook
exit status.

**Security.** The full `ZAI_API_KEY` is **never** logged (at most a short
prefix/suffix in a diagnostic). The raw response body is **never** logged —
there is no debug/verbose toggle. A short reason category (e.g. `HTTP 401`,
`malformed JSON`) is all that appears in a `[WARN]`.

**Endpoint.** `GET https://api.z.ai/api/monitor/usage/quota/limit` with
`Authorization: Bearer $ZAI_API_KEY`. Both the 5-hour and weekly token windows
expose `nextResetTime`; the hook sleeps until the soonest reset among the
exhausted windows. After a long quota sleep the driver re-evaluates **all**
conditions, so a quota sleep that lands inside the peak window correctly sleeps
on to peak end.

### Getting the API key

Use the same Z.AI API key you already use for inference:

- Individual: <https://z.ai/manage-apikey/apikey-list>
- Team plan: <https://z.ai/manage-apikey/coding-plan/team/my-plan>

Export it before running the wrapper:

```bash
export ZAI_API_KEY=zai-...      # same key used for inference
```

### Quota env knobs

| Variable | Default | Description |
|---|---|---|
| `ZAI_API_KEY` | *(unset)* | Required to opt into quota checking. Same key used for inference. Read-only to the hook; never logged in full. |
| `ADOS_ZAI_QUOTA_DISABLED` | `0` | Set to `1` to opt out of quota checking even when `ZAI_API_KEY` is set (silent opt-out, no `[WARN]`). |
| `ADOS_ZAI_MAX_SLEEP_LOOPS` | `24` | Defensive cap on the re-evaluation loop. On exceed, the hook returns `0` and emits one `[WARN]`. Rarely needs tuning. |

The peak-hours knobs (`ADOS_ZAI_PEAK_START_UTC`, `ADOS_ZAI_PEAK_END_UTC`,
`ADOS_ZAI_BUFFER_SECONDS`) are documented in [Configurable variables](#configurable-variables).

## Configurable variables

All variables are optional. Override them in your shell environment or
`.bashrc`/`.zshrc` before running `deliver-ticket.sh` or `ceo-loop.sh`.

| Variable | Default | Description |
|---|---|---|
| `ADOS_ZAI_PEAK_START_UTC` | `21600` (06:00 UTC) | Z.AI peak start in UTC seconds-of-day |
| `ADOS_ZAI_PEAK_END_UTC` | `36000` (10:00 UTC) | Z.AI peak end in UTC seconds-of-day |
| `ADOS_ZAI_BUFFER_SECONDS` | `7200` (2h) | Start pausing this many seconds before peak start |

**Effective pause window** = `[peak_start - buffer, peak_end)`

Default: `[21600 - 7200, 36000)` = `[04:00 UTC, 10:00 UTC)`

Example — reduce buffer to 30 minutes:

```bash
export ADOS_ZAI_BUFFER_SECONDS=1800   # 0.5h → pause starts at 05:30 UTC
```

Example — shift for a different peak schedule:

```bash
export ADOS_ZAI_PEAK_START_UTC=32400   # 09:00 UTC
export ADOS_ZAI_PEAK_END_UTC=46800     # 13:00 UTC
export ADOS_ZAI_BUFFER_SECONDS=7200    # 2h buffer → pause 07:00–13:00 UTC
```

## Prerequisites

1. **ADOS installed** — `scripts/install.sh --local` or `--global` has been run (the hook example ships at `scripts/hooks/pre-opencode-iteration-zai.sh`).
2. **Z.AI Coding Plan model configured** — your OpenCode config assigns a `zai-coding-plan/` model to the `pm` and/or `ceo` agent. See the [OpenCode Model Configuration Guide](opencode-model-configuration.md).

> **Get a Z.AI Coding Plan:** [https://z.ai/subscribe?ic=MMUPBUJ7PN](https://z.ai/subscribe?ic=MMUPBUJ7PN)
> (affiliate link — you get a **10% discount**, author earns a commission)

Example config snippet (`.opencode/opencode.jsonc` or `~/.config/opencode/opencode.jsonc`):

```jsonc
{
  "agent": {
    "pm":  { "model": "zai-coding-plan/glm-4.6" },
    "ceo": { "model": "zai-coding-plan/glm-4.6" }
  }
}
```

## Install (one-liner)

From the repository root (where `scripts/hooks/` lives):

```bash
mkdir -p ~/.ados/hooks && cp scripts/hooks/pre-opencode-iteration-zai.sh ~/.ados/hooks/pre-opencode-iteration && chmod +x ~/.ados/hooks/pre-opencode-iteration
```

That's it. Both `deliver-ticket.sh` and `ceo-loop.sh` check the default path
(`~/.ados/hooks/pre-opencode-iteration`) before every iteration. A missing
file is a silent no-op, so the hook only takes effect once installed.

### Alternative: custom path

If you prefer to keep the hook elsewhere, set `ADOS_PRE_ITERATION_HOOK`:

```bash
export ADOS_PRE_ITERATION_HOOK="$PWD/scripts/hooks/pre-opencode-iteration-zai.sh"
```

## Verify

Confirm the hook is in place and executable:

```bash
ls -la ~/.ados/hooks/pre-opencode-iteration
# Should show: -rwxr-xr-x ... pre-opencode-iteration
```

Dry-run a delivery to see the hook activate (if currently in the pause window):

```bash
scripts/deliver-ticket.sh --dry-run GH-999
```

During the pause window you'll see a log line like:

```
[INFO] (pre-opencode-iteration-zai) peak-hours; waiting until 2026-07-29T10:00:00Z
```

## Uninstall

```bash
rm -f ~/.ados/hooks/pre-opencode-iteration
```

Or run `scripts/uninstall.sh --local` (removes the installed example and its
empty `scripts/hooks/` directory, but never removes a hook at the default or
overridden path).

## Blueprint

A copy-paste-ready installation script is available at
[doc/templates/blueprints/zai-peak-hours-hook--install.sh](../templates/blueprints/zai-peak-hours-hook--install.sh).

## How it works internally

The hook is a standalone bash script (`set -Eeuo pipefail`). The wrapper
calls it in a new session (`setsid`) with these environment variables:

| Variable | Value | Purpose |
|---|---|---|
| `ADOS_HOOK_AGENT` | `pm` \| `ceo` | Which agent is about to spawn |
| `ADOS_HOOK_SCRIPT` | `deliver-ticket` \| `ceo-loop` | Which wrapper invoked it |
| `ADOS_HOOK_ENV_OUTPUT` | temp file path | Where the hook writes environment data (this hook writes nothing) |
| `ADOS_HOOK_ENV_FORMAT` | `ADOS_HOOK_ENV_V1` | Protocol version |

The hook reads `OC_ADOS_AGENT_PM_MODEL` (when `ADOS_HOOK_AGENT=pm`) or
`OC_ADOS_AGENT_CEO_MODEL` (when `ADOS_HOOK_AGENT=ceo`). If the value starts
with `zai-coding-plan/` and the current UTC time is in the effective pause
window (`peak_start - buffer` through `peak_end`), it sleeps until `peak_end`.
Otherwise it returns immediately.

The hook writes **no environment output** — it is a pure gate (wait or
pass). See [TDR-0002](../decisions/TDR-0002-pre-iteration-hook-contract-details.md)
for the full hook contract and [delivery-modes.md](delivery-modes.md#optional-pre-iteration-hooks)
for the canonical lifecycle, security, and configuration reference.

## Extensibility: condition functions

The hook is a generic **sleep-driver** built on a small, documented extension
point — the **condition function** (decision DM-1 / DEC-2). This is how you add
a new wait reason, or build an entirely provider-specific hook.

### Condition-function contract

A condition is a bash function named `howLongToSleepDueTo<Reason>()` that:

1. echoes **exactly one** non-negative integer to stdout = seconds to sleep
   (`0`, empty, or any error = "no wait from this condition");
2. obtains time and HTTP **strictly through the seams** (`_now_utc_epoch`,
   `_zai_quota_fetch`) — never `date`/`curl` directly; and
3. emits **at most one** diagnostic line to stderr (e.g. a `[WARN]` on failure).

The driver gates on the configured model, then repeatedly: takes the **maximum**
seconds across all registered conditions, sleeps that long (logging the UTC wake
time and reason), and **re-evaluates all conditions** after waking — looping
until no condition wants to sleep. Composed waits are therefore handled
correctly: e.g. a quota sleep that lands inside the peak window then sleeps on
to peak end. v1 ships two conditions: `howLongToSleepDueToPeakHours` and
`howLongToSleepDueToQuotaExhaustion`.

### Adding a condition

Write a function following the contract above and register it in the condition
list (append it to the `ADOS_ZAI_CONDITIONS` array in the hook). The driver
picks it up automatically — no branching logic to edit. Illustrative stub:

```bash
howLongToSleepDueToMaintenanceWindow() {
  # ... read a maintenance window via a seam ...
  printf '%s' "${seconds_until_maintenance_end}"   # 0/empty/error = no wait
}
# then register: append howLongToSleepDueToMaintenanceWindow to ADOS_ZAI_CONDITIONS
```

### Building a provider-specific hook

To target a different provider (whose quota / rate-limit API differs from
Z.AI's), copy this hook file to a new example (e.g.
`pre-opencode-iteration-<provider>.sh`), **keep the generic driver** and its
seam/condition contract, and **replace the condition functions** with
provider-specific ones. The driver and contract are reusable; the conditions
are the provider-specific part.

See the change spec (`doc/changes/2026-08/2026-08-04--GH-150--quota-aware-delivery-wait/chg-GH-150-spec.md`,
DM-1) and [TDR-0002](../decisions/TDR-0002-pre-iteration-hook-contract-details.md)
for the full contract.

> **Affiliate disclosure:** Z.AI signup links in this guide use
> `https://z.ai/subscribe?ic=MMUPBUJ7PN`. The author earns a commission and
> the buyer receives a 10% discount on the first subscription purchase.
