---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/zclaude.md
---

# zclaude User Guide

> Version 1.0.0 | [Changelog](#100-2026-05-11)

## Quick start

Install `zclaude`:

```bash
curl -fsSL https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/scripts/install-zclaude.sh | bash
```

The installer also checks for Claude Code CLI. If `claude` is missing, it offers to install it using Anthropic's official installer.

Start it:

```bash
zclaude
```

On first run, `zclaude` detects that no Z.AI API key is configured. It shows where to create a Z.AI subscription and API key, asks you to paste the key (input hidden), saves it to `~/.ai/zclaude/api-key`, and immediately launches Claude Code with Z.AI GLM models.

After that, just use:

```bash
zclaude   # Claude Code via Z.AI GLM
```

Your regular `claude` command remains unchanged:

```bash
claude    # your normal Claude Code setup, e.g. Anthropic/default provider
zclaude   # Claude Code using Z.AI GLM Coding Plan
```

## Why zclaude exists

`zclaude` lets you use Claude Code with Z.AI GLM models **without changing your Claude Code configuration**.

If you configure Z.AI manually in `~/.claude/settings.json`, that setting affects regular `claude` sessions too. `zclaude` avoids that by keeping Z.AI credentials separate, setting Z.AI environment variables only for the current process, and passing Claude Code arguments through unchanged.

<!-- TOC -->
* [zclaude User Guide](#zclaude-user-guide)
  * [Quick start](#quick-start)
  * [Why zclaude exists](#why-zclaude-exists)
  * [Overview](#overview)
  * [Problem it solves](#problem-it-solves)
  * [Why use zclaude](#why-use-zclaude)
  * [Requirements](#requirements)
  * [Installation](#installation)
    * [One-liner (recommended)](#one-liner-recommended)
    * [From the ADOS repo](#from-the-ados-repo)
    * [Verify](#verify)
  * [First-time setup](#first-time-setup)
  * [Usage](#usage)
  * [Configuration](#configuration)
    * [API key storage](#api-key-storage)
    * [Environment variable overrides](#environment-variable-overrides)
    * [Model mapping](#model-mapping)
  * [CLI Reference](#cli-reference)
  * [Troubleshooting](#troubleshooting)
    * ["No Z.AI API key configured" and setup prompt not appearing](#no-zai-api-key-configured-and-setup-prompt-not-appearing)
    * [Claude Code starts but shows API errors](#claude-code-starts-but-shows-api-errors)
    * [Claude Code shows "Claude" model names instead of GLM](#claude-code-shows-claude-model-names-instead-of-glm)
    * [Timeout errors during long agent sessions](#timeout-errors-during-long-agent-sessions)
    * [Key was saved incorrectly (contains extra text)](#key-was-saved-incorrectly-contains-extra-text)
  * [Changelog](#changelog)
    * [1.0.0 (2026-05-11)](#100-2026-05-11)
<!-- TOC -->

## Overview

`zclaude` is `claude` with process-local Z.AI settings. It sets the Z.AI endpoint, auth token, timeout, and GLM model mapping, then starts Claude Code.

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

You also need to avoid credential confusion with `ANTHROPIC_API_KEY` and store the Z.AI key somewhere secure.

Doing this manually means either editing `~/.claude/settings.json` (global side effect) or exporting env vars every time you open a terminal. It also makes provider switching awkward: your normal `claude` command may unexpectedly use Z.AI when you wanted Anthropic, or vice versa.

`zclaude` avoids that by keeping Z.AI configuration separate from Claude Code's global settings and applying it only to the `zclaude` process.

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
- **Claude Code CLI** (`claude`) installed and in PATH — the one-liner installer can install it for you if missing
- **A Z.AI GLM Coding Plan subscription** — [sign up](https://z.ai/subscribe?ic=MMUPBUJ7PN) (affiliate link: author earns commission, buyer gets 10% discount)

## Installation

### One-liner (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/scripts/install-zclaude.sh | bash
```

Or with `wget`:

```bash
wget -qO- https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/scripts/install-zclaude.sh | bash
```

This downloads `zclaude`, makes it executable, and chooses the best user-local install directory available. If the install directory is not in your PATH, the installer prints the line to add to your shell profile and can append it for you.

Works on Linux, macOS, Windows (Git Bash, WSL).

### From the ADOS repo

If you already have the ADOS repo cloned:

```bash
./tools/zclaude        # run directly, no install needed
```

Or install to PATH:

```bash
cp tools/zclaude ~/.local/bin/
```

### Verify

```bash
zclaude --version
```

## First-time setup

Run `zclaude`. If no API key is found, it starts interactive setup:

```bash
zclaude
```

```
[INFO]  (zclaude) No Z.AI API key configured.
  To use zclaude, you need a Z.AI GLM Coding Plan subscription.

  1. Create a subscription: https://z.ai/subscribe?ic=MMUPBUJ7PN
     (affiliate link — you get 10% discount, author earns a bonus)
  2. Generate an API key:   https://z.ai/manage-apikey/apikey-list

  Set up now? [Y/n]
```

Press Enter to accept, paste your API key (input is hidden), and Claude Code launches immediately. The key is saved for future runs.

## Usage

`zclaude` passes Claude Code arguments directly to `claude` — no special syntax or `--` separator needed.

```bash
# Launch Claude Code with Z.AI (same as 'claude' but with Z.AI provider)
zclaude

# All Claude Code flags work transparently
zclaude --chat
zclaude -p "explain this code"
zclaude --plugin-dir .ados-claude

# zclaude-specific commands
zclaude setup                     # First-time: save your Z.AI API key
zclaude env                       # Debug: show env vars that will be set
zclaude --version                 # Show zclaude + claude versions
zclaude --help                    # Show this wrapper's help
zclaude --help-claude             # Show Claude Code's own help
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
zclaude 1.0.0 — Claude Code with Z.AI GLM Coding Plan

USAGE:
  zclaude [setup|env]                  — zclaude-specific commands
  zclaude [CLAUDE_ARGS...]             — launch Claude Code with Z.AI (default)
  zclaude --version                    — show zclaude + claude versions
  zclaude --help                       — show this wrapper's help
  zclaude --help-claude                — show Claude Code's own help

ZCLAUDE COMMANDS:
  setup            Configure Z.AI API key (first-time or reconfigure)
  env              Show environment variables that will be set (diagnostics)

PASSTHROUGH:
  All other arguments are passed directly to Claude Code.
  No -- separator needed. Examples:
    zclaude --chat
    zclaude -p "explain this code"
    zclaude --plugin-dir .ados-claude

ENVIRONMENT:
  ZAI_API_KEY              Z.AI API key (overrides file)
  ZCLAUDE_CONFIG_DIR       Config directory (default: ~/.ai/zclaude)
  ZCLAUDE_BASE_URL         API endpoint
  ZCLAUDE_TIMEOUT_MS       API timeout in ms
  ZCLAUDE_HAIKU_MODEL      Haiku model override
  ZCLAUDE_SONNET_MODEL     Sonnet model override
  ZCLAUDE_OPUS_MODEL       Opus model override
  ZCLAUDE_NO_VERSION_CHECK Set to 'true' to skip version check

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
