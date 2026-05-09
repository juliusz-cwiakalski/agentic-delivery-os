---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/claude-code-setup.md
---
# Claude Code Setup Guide

How to install Claude Code CLI, configure a model provider, and run ADOS as a Claude Code plugin.

## Prerequisites

- **Node.js 18+** — required by Claude Code CLI
- **A model provider** — either a direct Anthropic API key or a third-party provider with an Anthropic-compatible endpoint

## Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Verify:

```bash
claude --version
```

## Provider options

Claude Code connects to an Anthropic Messages-compatible API. You have two options:

| Provider | Cost | Setup |
|----------|------|-------|
| **Anthropic API** (direct) | Pay-per-token | API key only |
| **Z.AI GLM Coding Plan** | Flat subscription from $18/month | API key + endpoint override |

### Option A: Anthropic API (direct)

Set your API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

No additional configuration needed — Claude Code uses `api.anthropic.com` by default.

### Option B: Z.AI GLM Coding Plan

Z.AI offers a subscription plan that provides access to GLM models (GLM-5.1, GLM-5-Turbo, GLM-4.7) through an Anthropic-compatible endpoint. Claude Code is an officially supported tool.

**Sign up:** [https://z.ai/subscribe?ic=MMUPBUJ7PN](https://z.ai/subscribe?ic=MMUPBUJ7PN)

> **Affiliate disclosure:** This is an affiliate link. The author earns a commission **and** the buyer receives a **10% discount** on their first subscription purchase. The plan supports Claude Code, Cline, and 20+ other coding tools, starting at $18/month.

**Generate an API key:** [https://z.ai/manage-apikey/apikey-list](https://z.ai/manage-apikey/apikey-list)

**Configure Claude Code** — edit `~/.claude/settings.json` (or `%USERPROFILE%\.claude\settings.json` on Windows):

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your_zai_api_key",
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "API_TIMEOUT_MS": "3000000"
  }
}
```

**Key points:**

- Use `ANTHROPIC_AUTH_TOKEN` (not `ANTHROPIC_API_KEY`) — this is Z.AI's documented variable for Claude Code
- Use the Anthropic endpoint (`/api/anthropic`), **not** the OpenAI-compatible endpoint (`/api/coding/paas/v4`) — the wrong endpoint will not route through your subscription correctly
- `API_TIMEOUT_MS: 3000000` (50 minutes) prevents timeouts during long agent sessions

#### Model mapping

By default, Z.AI maps Claude model names to GLM models:

| Claude slot | Default GLM model |
|-------------|-------------------|
| Opus | GLM-4.7 |
| Sonnet | GLM-4.7 |
| Haiku | GLM-4.5-Air |

To use newer GLM models, add model mapping variables to `settings.json`:

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

**Recommendation for ADOS:** Map both Sonnet and Opus to `glm-5.1`. Claude Code routes most planning and execution through these slots, so using the most capable model gives better results for the autonomous multi-agent workflow. Use `glm-5-turbo` or `glm-4.7` for faster/cheaper execution when you don't need maximum reasoning.

> **Note:** Claude Code's UI may still display Claude model names even when GLM models are active underneath. This is expected — the server-side mapping is transparent.

#### Verify the setup

Open a new terminal (to pick up the `settings.json` changes), then:

```bash
cd your-project
claude
```

If prompted about using the API key, choose **Yes**.

Inside Claude Code, check model status:

```
/status
```

You can also verify environment variables are loaded:

```bash
env | grep ANTHROPIC
```

> **Tip:** If you have a stale `ANTHROPIC_API_KEY` in your environment, unset it (`unset ANTHROPIC_API_KEY`). While `ANTHROPIC_AUTH_TOKEN` takes precedence, leftover variables can make debugging confusing.

#### Automatic setup (alternative)

Z.AI provides a helper tool:

```bash
npx @z_ai/coding-helper
```

This can configure Claude Code, OpenCode, and other supported tools. For reproducible, version-controlled setups, prefer the manual `settings.json` approach documented above — but never commit your real API key.

## Install ADOS as a Claude Code plugin

Once Claude Code is configured with a provider, install ADOS:

**From GitHub marketplace (recommended):**

```
/plugin marketplace add juliusz-cwiakalski/agentic-delivery-os
/plugin install ados@ados
```

**For local development (contributors):**

```bash
claude --plugin-dir .ados-claude
```

See [Onboarding Guide](onboarding-existing-project.md) for full project setup.

## Using ADOS with Claude Code

ADOS commands and agents work the same way in Claude Code as in OpenCode:

```
@pm deliver change GH-1
```

Or manually:

```
/write-spec GH-1
/write-test-plan GH-1
/write-plan GH-1
/run-plan GH-1
/review GH-1
/sync-docs GH-1
/pr
```

See [Agents & Commands Guide](opencode-agents-and-commands-guide.md) for the full reference.

## Troubleshooting

### "Claude Code asks for Anthropic login" instead of using the API key

This means `ANTHROPIC_AUTH_TOKEN` is not being picked up. Ensure `~/.claude/settings.json` exists with the correct `env` block and restart Claude Code in a new terminal.

### Z.AI subscription quota not being used

Verify you're using the Anthropic endpoint (`https://api.z.ai/api/anthropic`), not the OpenAI-compatible one. Check `/status` inside Claude Code to confirm the connection.

### Model appears as Claude but should be GLM

This is expected — Claude Code's UI shows Claude model names while Z.AI maps them server-side. The model mapping variables control which GLM model is actually used.

### Timeout errors during long agent sessions

Increase `API_TIMEOUT_MS` in `settings.json`. The recommended value of `3000000` (50 minutes) should be sufficient for most ADOS workflows.

## Related documentation

| Document | Description |
|----------|-------------|
| [Onboarding Guide](onboarding-existing-project.md) | Full ADOS project setup |
| [Agents & Commands Guide](opencode-agents-and-commands-guide.md) | How to use ADOS agents and commands |
| [External Researcher Setup](external-researcher-setup.md) | MCP server setup (also uses Z.AI for web search) |
| [Adding Tool Support](adding-tool-support.md) | Extending ADOS to other AI tools |
| [Z.AI Claude Code docs](https://docs.z.ai/devpack/tool/claude) | Official Z.AI documentation for Claude Code integration |
