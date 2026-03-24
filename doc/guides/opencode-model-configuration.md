---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/opencode-model-configuration.md
---
# OpenCode Model Configuration Guide

This guide explains how to configure AI models for ADOS agents. **Model assignments live exclusively in OpenCode config files — NOT in agent definitions.**

## Key Principle

**Agent files (`.opencode/agent/*.md`) define behavior. Config files define which model runs them.**

This separation enables:
- **Portability** — Switch providers by changing one config file
- **Team consistency** — Share model configs via git
- **Flexibility** — Override models per-project or per-user

---

## 1. Configuration Locations

OpenCode configs can live in several locations, merged in this order (later overrides earlier):

| Precedence | Location | Use case |
|------------|----------|----------|
| 1 (lowest) | Remote `.well-known/opencode` | Organizational defaults |
| 2 | `~/.config/opencode/opencode.jsonc` | User-wide defaults |
| 3 | `OPENCODE_CONFIG` env var | Custom config path |
| 4 | `opencode.jsonc` in project root | Project-specific (commit to git) |
| 5 | `.opencode/opencode.jsonc` | Project-specific (alongside agents) |
| 6 (highest) | `OPENCODE_CONFIG_CONTENT` env var | Runtime inline config |

**Recommendation for ADOS teams:** Use `opencode.jsonc` in the project root, committed to git, so all team members use the same model configuration.

**Recommendation for individual users:** Use `~/.config/opencode/opencode.jsonc` for personal preferences that apply across all repos.

---

## 2. Model Assignment Structure

Model assignments go in the `"agent"` section of your config:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "pm",
  
  "agent": {
    "pm":               { "model": "github-copilot/claude-sonnet-4.6" },
    "coder":            { "model": "github-copilot/gpt-5.2-codex" },
    "committer":        { "model": "github-copilot/claude-haiku-4.5" },
    "runner":            { "model": "github-copilot/gpt-5-mini" }
    // ... all 22 agents
  }
}
```

Each agent key matches the filename (without `.md`) from `.opencode/agent/`.

---

## 3. Model ID Format

Model IDs use the format `provider/model-name`:

| Provider prefix | Description |
|-----------------|-------------|
| `github-copilot/` | GitHub Copilot subscription |
| `anthropic/` | Anthropic direct API |
| `openai/` | OpenAI direct API |
| `deepseek/` | DeepSeek API |
| `google-vertex-ai/` | Google Vertex AI |
| `openrouter/` | OpenRouter (multi-provider) |
| `ollama/` | Local models via Ollama |

See [OpenCode providers documentation](https://opencode.ai/docs/providers/) for the full list.

---

## 4. Example Configuration

ADOS ships an example project-level config in `.opencode/opencode-github-copilot.jsonc` showing all agents with tiered model assignments optimized for GitHub Copilot subscriptions.

### How to Customize

1. **For your project** — Edit `.opencode/opencode-github-copilot.jsonc` directly (committed to git, shared with team)

2. **For your user** — Create `~/.config/opencode/opencode.jsonc` to override project settings with personal preferences:
   
   ```jsonc
   {
     "$schema": "https://opencode.ai/config.json",
     "agent": {
       // Use a different model for architect
       "architect": { "model": "github-copilot/claude-opus-4.6" }
     }
   }
   ```

3. **Environment variables** — For API keys and tokens:
   
   ```bash
   # GitHub Copilot uses your subscription - authenticate via:
   opencode auth login
   
   # For other providers, set API keys:
   export ANTHROPIC_API_KEY=sk-ant-...
   export OPENAI_API_KEY=sk-...
   ```

---

## 5. Cost Optimization Strategy

### Tiering by Agent Role

Not all agents need powerful models. Match model capability to task complexity:

| Tier | Agent Examples | Model Class |
|------|----------------|-------------|
| **Critical reasoning** | `architect`, `reviewer`, `bootstrapper` | Opus / top-tier |
| **Core work** | `pm`, `coder`, `fixer`, `plan-writer`, `spec-writer` | Sonnet / Codex |
| **Well-scoped** | `committer`, `doc-syncer`, `pr-manager`, `editor` | Haiku / Flash |
| **Fast/cheap** | `external-researcher` | Grok Code Fast |
| **Trivial** | `runner` | Free models (GPT-5 mini) |

### GitHub Copilot Cost Multipliers

| Multiplier | Models | Best for |
|------------|--------|----------|
| **3.0x** | Claude Opus 4.6 | Highest-value reasoning only |
| **1.0x** | Claude Sonnet 4.6, GPT-5.2, GPT-5.2-Codex | Core delivery work |
| **0.33x** | Claude Haiku 4.5, Gemini 3 Flash | Well-scoped tasks |
| **0.25x** | Grok Code Fast 1 | Fast, cheap tasks |
| **free** | GPT-4.1, GPT-4o, GPT-5 mini | Command execution, log capture |

---

## 6. Complete Agent List

All ADOS agents require model configuration:

| Agent | Tier | Typical Model |
|-------|------|----------------|
| `architect` | Critical | opus |
| `bootstrapper` | Critical | opus |
| `reviewer` | Critical | opus |
| `review-feedback-applier` | Critical | opus |
| `pm` | Core | sonnet |
| `coder` | Core | codex/sonnet |
| `fixer` | Core | sonnet |
| `plan-writer` | Core | sonnet |
| `spec-writer` | Core | sonnet |
| `test-plan-writer` | Core | sonnet |
| `toolsmith` | Core | sonnet |
| `designer` | Core | gemini-pro |
| `committer` | Scoped | haiku |
| `doc-syncer` | Scoped | haiku |
| `pr-manager` | Scoped | haiku |
| `image-reviewer` | Scoped | gemini-flash |
| `image-generator` | Scoped | gemini-flash |
| `editor` | Scoped | haiku |
| `external-researcher` | Light | grok-fast |
| `runner` | Trivial | free |

---

## 7. Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENCODE_CONFIG` | Path to custom config file |
| `OPENCODE_CONFIG_CONTENT` | Inline JSON config (highest precedence) |
| `ANTHROPIC_API_KEY` | API key for Anthropic models |
| `OPENAI_API_KEY` | API key for OpenAI models |
| `GITHUB_API_TOKEN` | GitHub token for GitHub MCP |

Reference env vars in config:

```jsonc
{
  "mcp": {
    "github-mcp": {
      "environment": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "{env:GITHUB_API_TOKEN}"
      }
    }
  }
}
```

---

## 8. Project Example

ADOS includes `.opencode/opencode-github-copilot.jsonc` as a ready-to-use configuration for GitHub Copilot subscriptions. This file demonstrates tiered model assignment (critical/core/scoped/light/trivial) optimized for cost-effectiveness.

### File Locations Summary

| Location | Purpose | Commit? |
|----------|---------|---------|
| `opencode.jsonc` (project root) | Project-wide defaults | Yes (team-shared) |
| `.opencode/opencode-<provider>.jsonc` | Provider-specific config | Yes (team-shared) |
| `~/.config/opencode/opencode.jsonc` | User-wide overrides | No (personal) |

---

## 9. Creating Your Own Configuration

To create a configuration for a different provider:

1. **Copy** `.opencode/opencode-github-copilot.jsonc` to `.opencode/opencode-<provider>.jsonc`
2. **Replace** all `github-copilot/` model prefixes with your provider (e.g., `anthropic/`, `openai/`, `ollama/`)
3. **Adjust** tier assignments based on your provider's pricing model
4. **Document** cost considerations with comments (multipliers, free tiers, etc.)

---

## 10. Related Documentation

- [OpenCode Configuration Docs](https://opencode.ai/docs/config/) — config locations and precedence
- [OpenCode Providers Docs](https://opencode.ai/docs/providers/) — supported model providers
- [AGENTS.md](../../AGENTS.md) — agent descriptions and team structure
- [.opencode/README.md](../../.opencode/README.md) — agent/command inventory