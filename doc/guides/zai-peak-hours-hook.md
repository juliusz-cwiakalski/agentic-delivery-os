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

## What it does

When the configured agent model uses the `zai-coding-plan/` provider prefix
**and** the current time is inside the peak window, the hook **sleeps until
the window ends** — it does not fail, veto, or produce environment output.
The wrapper simply waits, then spawns the agent once the off-peak window
opens. If the model does not use `zai-coding-plan/`, or the current time is
outside the peak window, the hook returns immediately (zero-cost no-op).

| | |
|---|---|
| **Peak window** | 04:30–10:00 UTC (5.5 hours) |
| **Off-peak window** | 10:00–04:30 UTC (18.5 hours) |
| **Activation condition** | Model value starts with `zai-coding-plan/` |
| **Behavior during peak** | Sleeps until 10:00 UTC, then returns 0 |
| **Behavior outside peak** | Returns 0 immediately |
| **Failure handling** | A hook crash/timeout follows the standard wrapper failure path (`deliver-ticket.sh`: `failed`/exit-1; `ceo-loop.sh`: bounded retry counter) |

## Prerequisites

1. **ADOS installed** — `scripts/install.sh --local` or `--global` has been run (the hook example ships at `scripts/hooks/pre-opencode-iteration-zai.sh`).
2. **Z.AI Coding Plan model configured** — your OpenCode config assigns a `zai-coding-plan/` model to the `pm` and/or `ceo` agent. See the [OpenCode Model Configuration Guide](opencode-model-configuration.md).

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

Dry-run a delivery to see the hook activate (if currently in the peak window):

```bash
scripts/deliver-ticket.sh --dry-run GH-999
```

During the peak window you'll see a log line like:

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
with `zai-coding-plan/` and the current UTC time is in the 04:30–10:00
window, it sleeps until 10:00 UTC. Otherwise it returns immediately.

The hook writes **no environment output** — it is a pure gate (wait or
pass). See [TDR-0002](../decisions/TDR-0002-pre-iteration-hook-contract-details.md)
for the full hook contract and [delivery-modes.md](delivery-modes.md#optional-pre-iteration-hooks)
for the canonical lifecycle, security, and configuration reference.
