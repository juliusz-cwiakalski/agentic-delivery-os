---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/zclaude.md
---

# zclaude User Guide

> Version 1.0.0 | [Changelog](#100-2026-05-11)

<!-- TOC -->
* [zclaude User Guide](#zclaude-user-guide)
  * [Overview](#overview)
  * [Problem it solves](#problem-it-solves)
  * [Why use zclaude](#why-use-zclaude)
  * [Requirements](#requirements)
  * [First-time setup](#first-time-setup)
  * [Usage](#usage)
  * [Configuration](#configuration)
    * [API key storage](#api-key-storage)
    * [Environment variable overrides](#environment-variable-overrides)
    * [Model mapping](#model-mapping)
  * [CLI Reference](#cli-reference)
  * [Troubleshooting](#troubleshooting)
  * [Changelog](#changelog)
    * [1.0.0 (2026-05-11)](#100-2026-05-11)
<!-- TOC -->

## Overview

`zclaude` is a convenience wrapper that launches Claude Code with Z.AI GLM Coding Plan as the model provider. It configures the correct endpoint, model mapping, and timeout settings, then starts Claude Code — no file editing or environment variable setup required.

## Problem it solves

Using Z.AI GLM Coding Plan with Claude Code requires configuring several environment variables:

```
ANTHROPIC_AUTH_TOKEN  — your Z.AI API key
ANTHROPIC_BASE_URL    — https://api.z.ai/api/anthropic
API_TIMEOUT_MS        — 3000000 (50 min, for long agent sessions)
ANTHROPIC_DEFAULT_SONNET_MODEL  — glm-5.1
ANTHROPIC_DEFAULT_OPUS_MODEL    — glm-5.1
ANTHROPIC_DEFAULT_HAIKU_MODEL   — glm-4.5-air
```

Plus you need to unset `ANTHROPIC_API_KEY` if it exists (to avoid credential confusion), and store the API key somewhere secure.

Doing this manually means either editing `~/.claude/settings.json` (which affects all Claude Code sessions globally) or exporting env vars every time you open a terminal.

## Why use zclaude

| Aspect | `zclaude` | Manual setup |
|--------|-----------|-------------|
| **Setup** | One command, guided prompts | Edit JSON or export env vars |
| **Key storage** | `~/.ai/zclaude/api-key` (chmod 600) | Plaintext in `settings.json` or shell profile |
| **Isolation** | Process-scoped — does not touch `~/.claude/` | Global — affects all Claude Code sessions |
| **Switching providers** | `claude` = Anthropic, `zclaude` = Z.AI | Must edit settings or unset vars to switch |
| **Model mapping** | Pre-configured for ADOS (glm-5.1) | Must set each variable manually |
| **Diagnostics** | `zclaude env` shows masked key + all vars | `env \| grep ANTHROPIC` |

The key advantage: **`claude` and `zclaude` coexist**. Use `claude` when you want direct Anthropic API, and `zclaude` when you want Z.AI GLM. No settings to toggle, no env vars to export.

## Requirements

- **Bash** 4.0 or higher
- **Claude Code CLI** (`claude`) installed and in PATH
- **A Z.AI GLM Coding Plan subscription** — [sign up](https://z.ai/subscribe?ic=MMUPBUJ7PN) (affiliate link: author earns commission, buyer gets 10% discount)

## First-time setup

Run `zclaude` — if no API key is found, it offers interactive setup:

```bash
./tools/zclaude
```

```
[INFO]  (zclaude) No Z.AI API key configured.
  To use zclaude, you need a Z.AI GLM Coding Plan subscription.

  1. Create a subscription: https://z.ai/subscribe?ic=MMUPBUJ7PN
     (affiliate link — you get 10% discount, author earns a bonus)
  2. Generate an API key:   https://z.ai/manage-apikey/apikey-list

  Set up now? [Y/n]
```

Press Enter to accept, paste your API key (input is hidden), and Claude Code launches immediately.

## Usage

```bash
# Launch Claude Code with Z.AI (default command)
zclaude

# Reconfigure or replace your API key
zclaude setup

# Show masked key and all environment variables (diagnostics)
zclaude env

# Show version
zclaude --version

# Show help
zclaude --help
```

## Configuration

### API key storage

The API key is stored at `~/.ai/zclaude/api-key` with permissions `600` (owner read/write only). The directory `~/.ai/zclaude/` is created with permissions `700`.

Override the config directory:

```bash
export ZCLAUDE_CONFIG_DIR="/custom/path"
```

Override the API key directly (bypasses file storage):

```bash
export ZAI_API_KEY="your_api_key"
```

### Environment variable overrides

| Variable | Default | Description |
|----------|---------|-------------|
| `ZAI_API_KEY` | *(from file)* | Z.AI API key (overrides file-based key) |
| `ZCLAUDE_CONFIG_DIR` | `~/.ai/zclaude` | Config directory location |
| `ZCLAUDE_BASE_URL` | `https://api.z.ai/api/anthropic` | API endpoint |
| `ZCLAUDE_TIMEOUT_MS` | `3000000` (50 min) | API timeout in milliseconds |
| `ZCLAUDE_HAIKU_MODEL` | `glm-4.5-air` | Model for Haiku slot |
| `ZCLAUDE_SONNET_MODEL` | `glm-5.1` | Model for Sonnet slot |
| `ZCLAUDE_OPUS_MODEL` | `glm-5.1` | Model for Opus slot |
| `ZCLAUDE_NO_VERSION_CHECK` | `false` | Set to `true` to skip version check |
| `VERBOSE` | `false` | Set to `true` for debug output |

### Model mapping

By default, `zclaude` maps Claude Code's model slots to GLM models:

| Claude slot | GLM model | Why |
|-------------|-----------|-----|
| Opus | `glm-5.1` | Most capable — used for planning and complex reasoning |
| Sonnet | `glm-5.1` | Most capable — used for code generation and execution |
| Haiku | `glm-4.5-air` | Fast and cost-effective — used for quick tasks |

This mapping is optimized for ADOS autonomous multi-agent workflows where reasoning quality matters most.

## CLI Reference

```
zclaude 1.0.0 — Launch Claude Code with Z.AI GLM Coding Plan

USAGE:
  zclaude [COMMAND]

COMMANDS:
  (default)    Launch Claude Code with Z.AI GLM models
  setup        Configure or replace your Z.AI API key
  env          Show masked key and environment variables

FLAGS:
  -h, --help       Show help message and exit
  -V, --version    Show version and exit

ENVIRONMENT:
  ZAI_API_KEY              Z.AI API key (overrides file)
  ZCLAUDE_CONFIG_DIR       Config directory (default: ~/.ai/zclaude)
  ZCLAUDE_BASE_URL         API endpoint
  ZCLAUDE_TIMEOUT_MS       API timeout in ms
  ZCLAUDE_HAIKU_MODEL      Haiku model override
  ZCLAUDE_SONNET_MODEL     Sonnet model override
  ZCLAUDE_OPUS_MODEL       Opus model override
  VERBOSE                  Enable debug output

EXIT CODES:
  0   Success
  1   Runtime error
  2   Usage error
  3   Config error (missing API key)
```

## Troubleshooting

### "No Z.AI API key configured" and setup prompt not appearing

Ensure you're running `zclaude` in an interactive terminal. If stdin is not a TTY, the interactive setup is skipped. Run `zclaude setup` instead.

### Claude Code starts but shows API errors

Verify your API key is correct:

```bash
zclaude env
```

Check that the key is valid at [z.ai/manage-apikey/apikey-list](https://z.ai/manage-apikey/apikey-list).

### Claude Code shows "Claude" model names instead of GLM

This is expected — Claude Code's UI always shows Claude model names. The server-side mapping at Z.AI routes to GLM models transparently. Verify with `/status` inside Claude Code.

### Timeout errors during long agent sessions

Increase the timeout:

```bash
export ZCLAUDE_TIMEOUT_MS="6000000"  # 100 minutes
zclaude
```

### Key was saved incorrectly (contains extra text)

This can happen if `zclaude` was interrupted during setup. Fix by running:

```bash
zclaude setup
```

And entering your API key again. The old key is replaced.

## Changelog

### 1.0.0 (2026-05-11)

- Initial release
- Interactive first-time setup with hidden input
- API key storage at `~/.ai/zclaude/api-key` (chmod 600)
- Pre-configured model mapping for ADOS (glm-5.1 / glm-4.5-air)
- `zclaude env` diagnostics with masked key
- `zclaude setup` for reconfiguration
- Automatic version check (24h cache, silent failure, opt-out)
- Process-scoped env vars — does not modify `~/.claude/`
