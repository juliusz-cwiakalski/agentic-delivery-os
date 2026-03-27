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

**Official documentation:**
- [OpenCode Models](https://opencode.ai/docs/en/models/) — Model configuration syntax
- [OpenCode Config](https://opencode.ai/docs/config/) — Configuration locations and precedence
- [OpenCode Providers](https://opencode.ai/docs/providers/) — Supported providers

---

## 1. Configuration Locations

OpenCode configs are **merged**, not replaced. Later configs override earlier ones only for conflicting keys.

| Precedence | Location | Use case |
|------------|----------|----------|
| 1 (lowest) | Remote `.well-known/opencode` | Organizational defaults |
| 2 | `~/.config/opencode/opencode.jsonc` | User-wide defaults |
| 3 | `OPENCODE_CONFIG` env var | Custom config path |
| 4 | `opencode.jsonc` in project root | Project-specific (commit to git) |
| 5 | `.opencode/opencode.jsonc` | Project-specific (alongside agents) |
| 6 (highest) | `OPENCODE_CONFIG_CONTENT` env var | Runtime inline config |

**ADOS recommendation:** Use `.opencode/opencode-<provider>.jsonc` for provider-specific configs (committed to git, shared with team).

---

## 2. Model Assignment Structure

Model assignments go in the `"agent"` section of your config:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "pm",
  
  "agent": {
    "pm":               { "model": "github-copilot/claude-sonnet-4.6" },
    "coder":            { "model": "github-copilot/gpt-5.3-codex" },
    "architect":        { "model": "github-copilot/claude-opus-4.6" },
    "committer":        { "model": "github-copilot/gpt-5-mini" }
    // ... all 22 agents
  }
}
```

Each agent key matches the filename (without `.md`) from `.opencode/agent/`.

### Agent Override Behavior

Agent-specific model assignments override global defaults:

```jsonc
{
  "model": "anthropic/claude-sonnet-4-5",  // Global default
  "small_model": "anthropic/claude-haiku-4-5",  // For lightweight tasks
  
  "agent": {
    "architect": { "model": "anthropic/claude-opus-4-6" },  // Override for architect
    "coder": { "model": "openai/gpt-5.3-codex" }  // Override for coder
  }
}
```

---

## 3. Model ID Format

Model IDs use the format `provider_id/model_id`:

```jsonc
"github-copilot/claude-opus-4.6"
"anthropic/claude-sonnet-4-5"
"openai/gpt-5"
"ollama/llama-3.1"
"lmstudio/google/gemma-3n-e4b"
```

### Supported Provider Prefixes

OpenCode supports 75+ providers via AI SDK and Models.dev. Major providers:

| Category | Provider IDs |
|----------|-------------|
| **Direct APIs** | `anthropic`, `openai`, `google-vertex`, `gemini`, `deepseek` |
| **Cloud platforms** | `amazon-bedrock`, `azure-openai`, `azure-cognitive` |
| **Aggregators** | `openrouter`, `vercel`, `cloudflare-ai-gateway`, `helicone` |
| **Subscriptions** | `github-copilot`, `gitlab` (Duo) |
| **Local** | `ollama`, `lmstudio`, `llama.cpp` |

See [OpenCode Providers](https://opencode.ai/docs/providers/) for the full list.

---

## 4. Quick Setup

### GitHub Copilot (ADOS default)

ADOS includes `.opencode/opencode-github-copilot.jsonc` optimized for GitHub Copilot subscriptions:

```bash
# Already configured - just authenticate and run
opencode auth login
opencode
```

The default config uses tiered model assignment for cost optimization:
- **Tier 1 (3.0x)**: Critical reasoning — `architect`, `reviewer`, `bootstrapper`, `pm`, `toolsmith`, `plan-writer`, `doc-syncer`, `review-feedback-applier`
- **Tier 2 (1.0x)**: Core work — `coder`, `fixer`, `spec-writer`, `test-plan-writer`, `designer`, `pr-manager`, `editor`
- **Tier 3 (0.33x)**: Well-scoped — `image-reviewer`, `image-generator`
- **Tier 5 (free)**: Trivial — `committer`, `external-researcher`, `runner`

### Other Providers

Create `.opencode/opencode-<provider>.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "pm",
  
  "agent": {
    "pm": { "model": "anthropic/claude-sonnet-4-6" },
    "coder": { "model": "anthropic/claude-sonnet-4-6" },
    "architect": { "model": "anthropic/claude-opus-4-6" }
    // ... configure all 22 agents
  }
}
```

Set API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or: export OPENAI_API_KEY=sk-...
# or: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

---

## 5. Environment Variables

### Configuration Variables

| Variable | Purpose |
|----------|---------|
| `OPENCODE_CONFIG` | Path to custom config file |
| `OPENCODE_CONFIG_DIR` | Path to custom config directory |
| `OPENCODE_CONFIG_CONTENT` | Inline JSON config (highest precedence) |

### API Key Variables

Use `{env:VARIABLE_NAME}` for secure substitution:

```jsonc
{
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

**Provider-specific environment variables:**

| Provider | Key Environment Variables |
|----------|---------------------------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| AWS Bedrock | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_PROFILE` |
| Azure OpenAI | `AZURE_RESOURCE_NAME` |
| Google Vertex | `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION` |
| Cloudflare | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GATEWAY_ID`, `CLOUDFLARE_API_TOKEN` |
| GitLab Duo | `GITLAB_INSTANCE_URL`, `GITLAB_TOKEN` |

### File Substitution

Load sensitive values from files:

```jsonc
{
  "provider": {
    "openai": {
      "options": {
        "apiKey": "{file:~/.secrets/openai-key}"
      }
    }
  }
}
```

---

## 6. ADOS-Specific Considerations

### Model Selection by Agent Tier

ADOS agents have different complexity levels. Match model capability to task:

| Tier | Agents | Recommended Models |
|------|--------|-------------------|
| **Critical reasoning** | `architect`, `reviewer`, `bootstrapper`, `pm`, `toolsmith` | Claude Opus 4.6, GPT-5.3-Codex |
| **Core work** | `coder`, `fixer`, `plan-writer`, `spec-writer`, `test-plan-writer` | Claude Sonnet 4.6, GPT-5.2-Codex |
| **Well-scoped** | `committer`, `doc-syncer`, `pr-manager`, `editor` | Claude Haiku 4.5, Gemini 3 Flash |
| **Light** | `external-researcher` | Grok Code Fast 1 |
| **Trivial** | `runner` | Free models (GPT-5 mini, GPT-4o) |

### Agent-to-Agent Communication

Changing one agent's output format may break another agent that consumes it. When changing models:
- Test the full delivery pipeline (`@pm` → `@spec-writer` → `@plan-writer` → `@coder` → `@reviewer`)
- Verify artifact formats remain compatible
- Use stable providers for critical agents

### Default Agent

ADOS sets `default_agent: "pm"` so the PM agent starts by default:

```jsonc
{
  "default_agent": "pm"
}
```

This must be a primary agent (not a subagent).

---

## 7. Complete Agent List

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

## 8. Advanced Configuration

### Provider Variants

Configure model variants for different reasoning levels:

```jsonc
{
  "provider": {
    "openai": {
      "models": {
        "gpt-5": {
          "variants": {
            "high": { "reasoningEffort": "high", "textVerbosity": "low" },
            "low": { "reasoningEffort": "low" }
          }
        }
      }
    }
  }
}
```

Built-in variants: Anthropic (`high`, `max`), OpenAI (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`), Google (`low`, `high`).

### Custom Providers

Add OpenAI-compatible providers:

```jsonc
{
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My AI Provider",
      "options": {
        "baseURL": "https://api.myprovider.com/v1"
      },
      "models": {
        "my-model": { "name": "My Model Display Name" }
      }
    }
  }
}
```

Use `/connect` → **Other** to store API credentials separately from config.

### Timeout Configuration

```jsonc
{
  "provider": {
    "anthropic": {
      "options": {
        "timeout": 600000,      // Request timeout in ms (default: 300000)
        "chunkTimeout": 30000,  // Timeout between streamed chunks
        "setCacheKey": true     // Enable caching
      }
    }
  }
}
```

---

## 9. Troubleshooting

### Tool Calls Not Working with Local Models

For Ollama, increase context window:

```jsonc
{
  "provider": {
    "ollama": {
      "options": {
        "num_ctx": 32000  // Increase from default (usually ~4k)
      }
    }
  }
}
```

### GitLab Duo Compliance

Prevent data leakage outside self-hosted instance:

```jsonc
{
  "small_model": "gitlab/duo-chat-haiku-4-5",
  "share": "disabled"
}
```

### Azure Content Filter Errors

Change content filter from `DefaultV2` to `Default` in your Azure resource.

### Provider Not Loading

Use `enabled_providers` / `disabled_providers` to control loading:

```jsonc
{
  "enabled_providers": ["anthropic", "openai"],
  "disabled_providers": ["gemini"]
}
```

`disabled_providers` takes precedence over `enabled_providers`.

---

## 10. Related Documentation

- [OpenCode Models](https://opencode.ai/docs/en/models/) — Model configuration syntax
- [OpenCode Config](https://opencode.ai/docs/config/) — Configuration locations and precedence
- [OpenCode Providers](https://opencode.ai/docs/providers/) — Supported providers (75+)
- [AGENTS.md](../../AGENTS.md) — ADOS agent descriptions and team structure
- [.opencode/README.md](../../.opencode/README.md) — Agent/command inventory