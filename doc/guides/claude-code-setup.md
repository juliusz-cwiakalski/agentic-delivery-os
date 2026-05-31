---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/claude-code-setup.md
---
# Claude Code Setup Guide

How to install Claude Code CLI, configure a provider, and run ADOS as a Claude Code plugin.

<!-- TOC -->
* [Claude Code Setup Guide](#claude-code-setup-guide)
  * [Prerequisites](#prerequisites)
  * [Install Claude Code](#install-claude-code)
  * [Provider and authentication options](#provider-and-authentication-options)
    * [Option A: Anthropic account subscription](#option-a-anthropic-account-subscription)
    * [Option B: Anthropic API key](#option-b-anthropic-api-key)
    * [Option C: Z.AI GLM Coding Plan](#option-c-zai-glm-coding-plan)
      * [Quick setup with `zclaude` (recommended)](#quick-setup-with-zclaude-recommended)
      * [Advanced: manual Z.AI configuration](#advanced-manual-zai-configuration)
      * [Verify provider setup](#verify-provider-setup)
  * [Install ADOS as a Claude Code plugin](#install-ados-as-a-claude-code-plugin)
    * [From the marketplace](#from-the-marketplace)
    * [From a local ADOS branch for development testing](#from-a-local-ados-branch-for-development-testing)
      * [Local branch smoke test](#local-branch-smoke-test)
  * [Using ADOS with Claude Code](#using-ados-with-claude-code)
  * [Troubleshooting](#troubleshooting)
    * [Claude Code uses an API key when you expected subscription login](#claude-code-uses-an-api-key-when-you-expected-subscription-login)
    * [Claude Code asks for Anthropic login instead of using Z.AI](#claude-code-asks-for-anthropic-login-instead-of-using-zai)
    * [Z.AI subscription quota is not being used](#zai-subscription-quota-is-not-being-used)
    * [Model appears as Claude but should be GLM](#model-appears-as-claude-but-should-be-glm)
    * [Timeout errors during long agent sessions](#timeout-errors-during-long-agent-sessions)
    * [Local plugin changes do not appear](#local-plugin-changes-do-not-appear)
  * [Related documentation](#related-documentation)
<!-- TOC -->

## Prerequisites

- **Claude Code CLI** — install it with the official native installer below.
- **A Claude Code auth option** — Anthropic account subscription, Anthropic API key, or an Anthropic-compatible provider such as [Z.AI](https://z.ai/subscribe?ic=MMUPBUJ7PN).
- **Git** — required when testing ADOS from a feature branch.

## Install Claude Code

Prefer the official native installers from the [Claude Code quickstart](https://code.claude.com/docs/en/quickstart). The older npm package appears in some references, but the native installer is the recommended path in the [Claude Code GitHub README](https://github.com/anthropics/claude-code/blob/main/README.md).

| Platform | Recommended install |
|----------|---------------------|
| macOS, Linux, WSL | `curl -fsSL https://claude.ai/install.sh \| bash` |
| Windows PowerShell | `irm https://claude.ai/install.ps1 \| iex` |
| Windows WinGet | `winget install Anthropic.ClaudeCode` |
| Legacy/fallback | `npm install -g @anthropic-ai/claude-code` |

Verify:

```bash
claude --version
```

## Provider and authentication options

Claude Code can use first-party Anthropic authentication or a compatible third-party API endpoint.

| Option | Best for | Setup | Links |
|--------|----------|-------|-------|
| **Anthropic account subscription** | Interactive Claude Code use with Claude Pro/Max/Team/Enterprise-style plans | Run `claude` and complete browser login; use `claude auth login --console` when needed | [Claude plans](https://claude.com/pricing), [authentication docs](https://code.claude.com/docs/en/authentication), [CLI reference](https://code.claude.com/docs/en/cli-reference) |
| **Anthropic API key** | Pay-per-token API usage, CI, automation | Create a key in Console and set `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/), [API pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| **Z.AI GLM Coding Plan** | Flat subscription access to GLM coding models through an Anthropic-compatible endpoint | Use `zclaude` or set `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_BASE_URL` | [Sign up](https://z.ai/subscribe?ic=MMUPBUJ7PN), [Claude Code docs](https://docs.z.ai/devpack/tool/claude), [FAQ](https://docs.z.ai/devpack/faq) |

> **Z.AI affiliate disclosure:** Z.AI signup links in this guide use `https://z.ai/subscribe?ic=MMUPBUJ7PN`. The author earns a commission and the buyer receives a 10% discount on the first subscription purchase.

### Option A: Anthropic account subscription

Use this path when you want Claude Code to use your Anthropic account subscription instead of a raw API key.

```bash
claude
```

Claude Code opens a browser login flow. If the browser cannot open automatically (SSH, WSL, container), follow the terminal prompt to copy the login URL or enter the displayed login code. See the [Claude Code authentication docs](https://code.claude.com/docs/en/authentication).

For console-oriented authentication, use:

```bash
claude auth login --console
```

> **Tip:** If `ANTHROPIC_API_KEY` is set in your shell, Claude Code may prefer that API key over your logged-in subscription credentials. To use subscription login, unset it and restart Claude Code:
>
> ```bash
> unset ANTHROPIC_API_KEY
> claude
> ```

### Option B: Anthropic API key

Use this path for pay-per-token API billing, CI, or automation.

1. Create an API key in the [Anthropic Console](https://console.anthropic.com/).
2. Review [Anthropic API pricing](https://platform.claude.com/docs/en/about-claude/pricing).
3. Export the key before launching Claude Code:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
claude
```

Do not commit shell profiles, `.env` files, or config files that contain API keys.

### Option C: Z.AI GLM Coding Plan

Z.AI offers a GLM Coding Plan for Claude Code and other coding tools through an Anthropic-compatible endpoint. Use the [Z.AI Claude Code docs](https://docs.z.ai/devpack/tool/claude) and [Z.AI FAQ](https://docs.z.ai/devpack/faq) as the source of truth.

**Sign up:** [https://z.ai/subscribe?ic=MMUPBUJ7PN](https://z.ai/subscribe?ic=MMUPBUJ7PN)

> **Affiliate disclosure:** This is an affiliate link. The author earns a commission and the buyer receives a 10% discount on the first subscription purchase.

#### Quick setup with `zclaude` (recommended)

The `zclaude` tool launches Claude Code with the Z.AI endpoint, model mapping, and timeout settings without editing `~/.claude/settings.json`. It stores your Z.AI API key at `~/.ai/zclaude/api-key` with `chmod 600`.

Install `zclaude`:

```bash
curl -fsSL https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/scripts/install-zclaude.sh | bash
```

Works on Linux, macOS, Windows Git Bash, and WSL. See the [zclaude User Guide](../tools/zclaude.md#installation) for the `wget` alternative.

Launch:

```bash
zclaude
```

On first run, `zclaude` detects that no API key is configured and offers interactive setup:

```text
[INFO]  (zclaude) No Z.AI API key configured.
  To use zclaude, you need a Z.AI GLM Coding Plan subscription.

  1. Create a subscription: https://z.ai/subscribe?ic=MMUPBUJ7PN
     (affiliate link — you get 10% discount, author earns a bonus)
  2. Generate an API key:   https://z.ai/manage-apikey/apikey-list

  Set up now? [Y/n]
```

Press Enter, paste your API key (input is hidden), and Claude Code launches immediately.

**Why `zclaude` over manual setup:**

| Aspect | `zclaude` | Manual `settings.json` |
|--------|-----------|------------------------|
| Setup | One command, guided | Edit JSON file by hand |
| Key storage | `~/.ai/zclaude/api-key` with `chmod 600` | Plaintext in `settings.json` |
| Isolation | Process-scoped; does not touch `~/.claude/` | Global; affects all Claude Code sessions |
| Model mapping | Preconfigured for ADOS (`glm-5.1`) | Must set manually |
| Switching | `claude` = Anthropic, `zclaude` = Z.AI | Edit settings or env vars to switch |
| Diagnostics | `zclaude env` shows masked key and variables | Inspect environment/settings manually |

Other `zclaude` commands:

```bash
zclaude setup   # Reconfigure or replace your API key
zclaude env     # Show masked key and environment variables
```

See the [zclaude User Guide](../tools/zclaude.md) for the full reference.

#### Advanced: manual Z.AI configuration

If you prefer to configure Claude Code globally for Z.AI, edit `~/.claude/settings.json` (or `%USERPROFILE%\.claude\settings.json` on Windows):

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your_zai_api_key",
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "API_TIMEOUT_MS": "3000000",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5.1",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5.1"
  }
}
```

**Key points:**

- Use `ANTHROPIC_AUTH_TOKEN` for the Z.AI key.
- Use `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` for the Anthropic-compatible endpoint.
- Use `API_TIMEOUT_MS=3000000` (50 minutes) for long ADOS agent sessions.
- Map Opus and Sonnet to `glm-5.1`; map Haiku to `glm-4.5-air`.

| Claude slot | Recommended GLM model |
|-------------|-----------------------|
| Opus | `glm-5.1` |
| Sonnet | `glm-5.1` |
| Haiku | `glm-4.5-air` |

> **Note:** Claude Code may still display Claude model names while requests are routed to GLM models. This is expected when using an Anthropic-compatible gateway.

#### Verify provider setup

With `zclaude`:

```bash
zclaude env
zclaude
```

With `claude` and Anthropic login or manual settings:

```bash
claude
```

Inside Claude Code:

```text
/status
```

## Install ADOS as a Claude Code plugin

Once Claude Code is configured with a provider, install ADOS.

### From the marketplace

Use the marketplace path when you want the published ADOS plugin:

```text
/plugin marketplace add juliusz-cwiakalski/agentic-delivery-os
/plugin install ados@ados
```

See the [Onboarding Guide](onboarding-existing-project.md) for full project setup.

### From a local ADOS branch for development testing

Use this path to test ADOS agents and skills from a feature branch before publishing or installing a marketplace version. This is the right path for `feat/GH-40/multi-tool-support`.

Clone or update the ADOS repo:

```bash
git clone https://github.com/juliusz-cwiakalski/agentic-delivery-os.git
cd agentic-delivery-os
git fetch origin
git switch feat/GH-40/multi-tool-support
```

Regenerate the Claude Code plugin from the OpenCode source files:

```bash
scripts/build-claude-plugin.sh
```

Launch Claude Code with the local generated plugin directory:

```bash
claude --plugin-dir "$PWD/.ados-claude"
```

If you use Z.AI through `zclaude`, launch the same local plugin with:

```bash
zclaude --plugin-dir "$PWD/.ados-claude"
```

This uses the local branch contents directly. You do not need to publish or install the marketplace plugin to test branch changes.

**Source-of-truth rule:** `.opencode/` contains the canonical ADOS agent and command definitions. `.ados-claude/` is generated output for Claude Code. When changing agents, commands, or skills, edit `.opencode/`, run `scripts/build-claude-plugin.sh`, and test with `--plugin-dir "$PWD/.ados-claude"`.

#### Local branch smoke test

Inside Claude Code:

1. Check plugin/command help if your Claude Code version exposes it:

   ```text
   /help
   ```

2. Run a safe read-only prompt:

   ```text
   @pm What ADOS version or branch am I testing? Do not modify files.
   ```

3. Confirm ADOS slash commands are visible or accepted, for example `/write-spec`, `/run-plan`, `/review`, and `/pr`. Do not run ticket-creating or file-writing commands as the first smoke test unless you are in a disposable repo.

## Using ADOS with Claude Code

ADOS commands and agents work the same way in Claude Code as in OpenCode:

```text
@pm deliver change GH-1
```

Or manually:

```text
/write-spec GH-1
/write-test-plan GH-1
/write-plan GH-1
/run-plan GH-1
/review GH-1
/sync-docs GH-1
/pr
```

See the [Agents & Commands Guide](opencode-agents-and-commands-guide.md) for the full reference.

## Troubleshooting

### Claude Code uses an API key when you expected subscription login

Unset API-key variables and restart Claude Code:

```bash
unset ANTHROPIC_API_KEY
unset ANTHROPIC_AUTH_TOKEN
claude
```

### Claude Code asks for Anthropic login instead of using Z.AI

If using manual Z.AI setup, ensure `~/.claude/settings.json` has the correct `env` block. If using `zclaude`, run:

```bash
zclaude env
```

### Z.AI subscription quota is not being used

Verify that Claude Code is launched through `zclaude` or that manual settings use `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`. Check `/status` inside Claude Code.

### Model appears as Claude but should be GLM

This can happen with Anthropic-compatible gateways. Confirm your model mapping variables; Z.AI still serves GLM models behind the compatible interface.

### Timeout errors during long agent sessions

Increase `API_TIMEOUT_MS`. The recommended value for ADOS with Z.AI is `3000000` (50 minutes).

### Local plugin changes do not appear

Regenerate and relaunch:

```bash
scripts/build-claude-plugin.sh
claude --plugin-dir "$PWD/.ados-claude"
```

For Z.AI:

```bash
scripts/build-claude-plugin.sh
zclaude --plugin-dir "$PWD/.ados-claude"
```

## Related documentation

| Document | Description |
|----------|-------------|
| [Onboarding Guide](onboarding-existing-project.md) | Full ADOS project setup |
| [Agents & Commands Guide](opencode-agents-and-commands-guide.md) | How to use ADOS agents and commands |
| [zclaude User Guide](../tools/zclaude.md) | Z.AI wrapper for Claude Code |
| [External Researcher Setup](external-researcher-setup.md) | MCP server setup |
| [Adding Tool Support](adding-tool-support.md) | Extending ADOS to other AI tools |
| [Claude Code quickstart](https://code.claude.com/docs/en/quickstart) | Official Claude Code installation docs |
| [Claude Code authentication](https://code.claude.com/docs/en/authentication) | Official auth and login docs |
| [Z.AI Claude Code docs](https://docs.z.ai/devpack/tool/claude) | Official Z.AI documentation for Claude Code integration |
