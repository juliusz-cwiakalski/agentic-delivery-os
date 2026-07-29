---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/zai-peak-hours-hook.md
ados_distribution: redistributable
---
# Z.AI Peak-Hours Hook Guide

The Z.AI peak-hours hook pauses autonomous delivery during the Z.AI Coding
Plan peak window so you don't burn quota when rates are highest. It is an
opt-in, user-owned executable that `deliver-ticket.sh` and `ceo-loop.sh`
invoke before every PM/CEO spawn.

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
[INFO] (pre-opencode-iteration-zai) zai-coding-plan peak window; waiting until 2026-07-29T10:00:00Z
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

> **Affiliate disclosure:** Z.AI signup links in this guide use
> `https://z.ai/subscribe?ic=MMUPBUJ7PN`. The author earns a commission and
> the buyer receives a 10% discount on the first subscription purchase.
