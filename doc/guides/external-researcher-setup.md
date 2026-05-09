---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/external-researcher-setup.md
---
# External Researcher — MCP Server Setup

How to configure the four MCP servers used by `@external-researcher` so the agent can query framework docs, open-source repos, and the web.

## Overview

| Server | Type | Purpose | Auth | Free tier |
|--------|------|---------|------|-----------|
| **Context7** | remote | Authoritative framework/library docs | API key header | 1K calls/mo |
| **DeepWiki** | remote | Open-source repo architecture & internals | None (public repos) | Yes |
| **Perplexity** | local | AI-synthesized web research | API key env var | No (credit-based) |
| **web-search-prime** | remote | Raw structured web search | Bearer token | No (pay-as-you-go) |

All four are optional — the agent gracefully falls back to remaining servers when one is unavailable.

## Provider setup

### Context7

Framework/library documentation (APIs, changelogs, migration guides).

1. Go to <https://context7.com/dashboard>.
2. Sign in with GitHub or Google.
3. Click **Create API Key**.
4. Export the key:

```bash
export CONTEXT7_API_KEY="your-key-here"
```

Free tier: 1,000 calls/month for public repos.

### DeepWiki

Open-source repo architecture, internals, contribution guides.

No setup required for public GitHub repos. The server works without authentication.

If you need private repo access, sign up at <https://devin.ai> and use the Devin MCP server instead.

### Perplexity

AI-synthesized web research with citations.

1. Create an account at <https://perplexity.ai>.
2. Go to <https://console.perplexity.ai>.
3. Set up an API Group (org workspace) and add a payment method.
4. Navigate to **API Keys** → **Generate API Key**.
5. Export the key:

```bash
export PERPLEXITY_API_KEY="your-key-here"
```

No free tier — credit-based billing. Add a card and purchase credits upfront.

> **Supply-chain note:** `npx -y` auto-installs the package without confirmation. Consider pinning the version (e.g., `@perplexity-ai/mcp-server@1.2.3`) or verifying the package before first use.

### web-search-prime (Z.AI)

Raw structured web search with domain filtering, recency control, and up to 50 results per query.

1. Sign up at [https://z.ai/](https://z.ai/subscribe?ic=MMUPBUJ7PN).
2. Go to [https://z.ai/manage-apikey/apikey-list](https://z.ai/manage-apikey/apikey-list).
3. Click **Create a new API key**.
4. Export the key:

```bash
export ZAI_MCP_TOOLS_KEY="your-key-id.secret"
```

No free tier — pay-as-you-go (add credits to your account).

> **Affiliate link:** [https://z.ai/subscribe?ic=MMUPBUJ7PN](https://z.ai/subscribe?ic=MMUPBUJ7PN) — this is an affiliate link. The author earns a commission **and** the buyer receives a **10% discount** on their subscription.

## OpenCode configuration

Add the servers to your `opencode.jsonc` under the `"mcp"` key. Only include the servers you have keys for.

```jsonc
"mcp": {
  "context7-mcp": {
    "type": "remote",
    "url": "https://mcp.context7.com/mcp",
    "enabled": true,
    "headers": {
      "CONTEXT7_API_KEY": "{env:CONTEXT7_API_KEY}"
    }
  },
  "deepwiki-mcp": {
    "type": "remote",
    "url": "https://mcp.deepwiki.com/mcp",
    "enabled": true
  },
  "perplexity-mcp": {
    "type": "local",
    "command": ["npx", "-y", "@perplexity-ai/mcp-server"],
    "enabled": true,
    "environment": {
      "PERPLEXITY_API_KEY": "{env:PERPLEXITY_API_KEY}",
      "PERPLEXITY_TIMEOUT_MS": "600000"
    }
  },
  "web-search-mcp": {
    "type": "remote",
    "url": "https://api.z.ai/api/mcp/web_search_prime/mcp",
    "enabled": true,
    "headers": {
      "Authorization": "Bearer {env:ZAI_MCP_TOOLS_KEY}"
    }
  }
}
```

## Scoping tools to external-researcher only

By default, MCP tools are available to **all** agents. To restrict these tools so only `@external-researcher` can use them, apply the global-disable + agent-enable pattern:

**Step 1:** Disable the tools globally in `opencode.jsonc`:

```jsonc
"tools": {
  "context7*": false,
  "perplexity*": false,
  "deepwiki*": false,
  "web-search-prime*": false
}
```

Note: the Z.AI tool is named `web-search-prime`, so the global disable uses `web-search-prime*`. The agent frontmatter uses the shorter glob `web-search*` which also matches `web-search-prime*`. See [Naming reference](#naming-reference) below for the full mapping.

**Step 2:** The agent frontmatter in `.opencode/agent/external-researcher.md` already re-enables them:

```yaml
tools:
  "context7*": true
  "perplexity*": true
  "web-search*": true
  "deepwiki*": true
```

The agent-level `true` overrides the global `false`, so only `@external-researcher` has access.

> Reference: [OpenCode MCP docs — Per Agent](https://opencode.ai/docs/mcp-servers/#per-agent)

## Naming reference

The same integration is referenced by different names depending on context:

| Context | Name | Example |
|---------|------|---------|
| Provider / service | `web-search-prime` | Z.AI's search engine |
| OpenCode `mcp` key | `web-search-mcp` | Config key in `opencode.jsonc` |
| Tool name (glob pattern) | `web-search-prime*` | Global `tools` disable rule |
| Agent routing | `web-search` | Short name in agent prompt |

## Environment variables summary

| Variable | Server | Required |
|----------|--------|----------|
| `CONTEXT7_API_KEY` | Context7 | Yes |
| `PERPLEXITY_API_KEY` | Perplexity | Yes |
| `ZAI_MCP_TOOLS_KEY` | web-search-prime | Yes |
| — | DeepWiki | No key needed |

Set these in your shell profile (e.g., `~/.bashrc`, `~/.zshrc`) or in a `.env` file sourced before launching OpenCode. Ensure `.env` is listed in `.gitignore` — never commit API keys to version control.

## Security considerations

The agent prompt instructs it to treat all external content as untrusted data and ignore prompt-injection attempts. This defense is **behavioral, not cryptographic** — it depends on the LLM following the instructions. Avoid routing `@external-researcher` to arbitrary user-supplied URLs in security-sensitive contexts.

## Tool routing in the agent

The `@external-researcher` agent uses this precedence:

1. **context7** — first choice for library/framework docs
2. **deepwiki** — for open-source repo internals
3. **perplexity** — AI-synthesized web research, fallback
4. **web-search** — raw URL discovery, domain/recency filtering

If a server is unavailable (error, quota, misconfiguration), the agent acknowledges it and routes to the next-best server.
