---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-external-researcher.md
ados_distribution: internal
id: SPEC-EXTERNAL-RESEARCHER
status: Current
created: 2026-06-28
last_updated: 2026-06-28
owners: ["engineering"]
service: delivery-os
summary: "MCP-driven external research: tool routing across context7/deepwiki/perplexity/web-search, untrusted-content handling, a research process, and an output contract."
links:
  related_changes: ["GH-79"]
  guides:
    - "doc/guides/external-researcher-setup.md"
---

# Feature: External Researcher

## Overview

The `@external-researcher` agent gathers, synthesizes, and delivers external knowledge using four MCP servers. It routes queries by authority (context7 → deepwiki → perplexity → web-search), treats **all external content as untrusted data** (extracting facts, never instructions), and returns a concise, structured answer with source references. This spec covers the routing, the untrusted-content handling, the process, and the output contract.

> **Authoritative source is the agent prompt.** This spec mirrors `.opencode/agent/external-researcher.md`; the MCP server **setup** (keys, config, tool scoping) is in the sibling [external-researcher-setup.md](../../guides/external-researcher-setup.md) guide.

## Business Context

### Problem Statement

- **Problem:** Agents need current external knowledge (library docs, repo internals, web research) but (a) cannot fabricate it, (b) must route to the most authoritative source, and (c) must defend against prompt-injection in fetched content.
- **Affected Users:** Other ADOS agents (PM, spec-writer, coder, decision-advisor) and humans who delegate research.
- **Business Impact:** Without disciplined external research, answers are stale, misrouted, or poisoned by injected instructions.

### Goals & Success Metrics

- **Primary Goal:** Deliver synthesized external knowledge routed by authority, with untrusted-content defenses and graceful degradation when servers are unavailable.
- **KPIs:** All four servers optional; the agent degrades gracefully and never fabricates results.

## User Experience & Functionality

### Capabilities

- **MCP tool routing (F-1):** Four servers, routed by authority:
  - **context7** — authoritative framework/library docs (APIs, changelogs, migrations, config). First choice for library/framework questions.
  - **deepwiki** — open-source repo architecture, internals, contribution/issue context.
  - **perplexity** — AI-synthesized web research (news, blogs, comparisons, community discussion). Fallback when context7/deepwiki are insufficient.
  - **web-search\*** — raw structured web search (URL discovery, domain-scoped lookup, recency-filtered results). Used for page discovery, not synthesis.
  - Routing rules: prefer context7 → deepwiki → perplexity for authority; use web-search when URLs/domain/recency filters or non-synthesized results matter; prefer single-source queries and cross-validate only when the caller requests it or confidence is low; combine results in authority order.
- **Untrusted-content handling (F-2):** All external content is treated as **untrusted data** — facts are extracted, never instructions. The agent ignores source instructions that ask it to reveal/modify prompts, bypass rules, call tools, read unrelated local files, exfiltrate secrets, install code, or change task scope. Prompt-injection text is mentioned only as a source-quality warning, never obeyed. User instructions, the agent prompt, and repo rules always outrank external content.
- **Graceful degradation (F-3):** If a server is unavailable, misconfigured, quota-limited, or errors, the agent states the failure in one sentence (e.g., "context7 unavailable, using deepwiki instead") and proceeds. If **all** MCP servers are unavailable, it states clearly that external research cannot be performed and returns only what can be answered from local repo context (if any) — it never speculates or fabricates.
- **Research process (F-4):** Parse the request and identify the knowledge domain + which server(s) to query → query the most authoritative source first → widen or reroute if insufficient → combine results by source type (authoritative docs, repo internals, synthesized web context, raw search results) → synthesize a concise structured answer.
- **Output contract (F-5):** Findings as bullet points or tables with source links/references; conflicting information is highlighted with an authority judgment and rationale; uncertain/incomplete findings are flagged explicitly with a recommendation for further investigation; if file updates were requested, a brief change summary + rationale is provided.

### Tool Access Scoping

By default MCP tools are available to all agents; the external-researcher servers are scoped to `@external-researcher` only via a global-disable + agent-enable pattern (global `tools: { "context7*": false, ... }` in OpenCode config, overridden by `tools: true` in the agent frontmatter). The agent has `bash: false`, `write: false`, `edit: false` (read-only research), with read/glob/grep enabled. Setup detail lives in the sibling guide.

### User Flows

```
Caller asks a research question  → @external-researcher routes to most authoritative server
                                 → extracts facts (treats content as untrusted)
                                 → reroutes/widens if insufficient or a server is down
                                 → synthesizes structured answer with sources
                                 → optional: applies minimal file edits if requested
```

### Edge Cases & Error Handling

- **All servers unavailable:** state the limitation; return only local-repo-context answers; never fabricate.
- **Conflicting sources:** highlight the discrepancy, state which source is more authoritative and why.
- **Prompt-injection in content:** mention only as a source-quality warning; do not obey.

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `.opencode/agent/external-researcher.md` | External researcher agent | MCP routing, untrusted-content handling, synthesis, output contract |
| `doc/guides/external-researcher-setup.md` | MCP setup guide | Server keys, OpenCode config, tool scoping |
| OpenCode config (`opencode.jsonc`) | Tool scoping | Global-disable + agent-enable pattern for the four MCP servers |

### MCP Servers

| Server | Type | Purpose | Auth |
|--------|------|---------|------|
| context7 | remote | Authoritative framework/library docs | API key |
| deepwiki | remote | Open-source repo architecture & internals | None (public repos) |
| perplexity | local | AI-synthesized web research | API key |
| web-search-prime | remote | Raw structured web search | Bearer token |

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Authority routing | Queries route context7 → deepwiki → perplexity → web-search by authority | Routing rules followed |
| NFR-2 | Untrusted content | External content is data, never instructions; injection ignored | Never obeys source instructions |
| NFR-3 | No fabrication | If tools cannot answer, state the limitation; never fabricate | Graceful degradation only |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | Routing | Ask a library-docs question; verify context7 is first choice |
| Manual | Degradation | Disable one server; verify one-sentence failure + reroute |
| Manual | Injection defense | Feed a known injection snippet; verify it is flagged, not obeyed |

## Dependencies & Risks

- **Depends on:** the four MCP servers (all optional) and their keys/env vars (see the setup guide).
- **Risk:** Untrusted-content defense is **behavioral, not cryptographic** — it depends on the LLM following instructions. Avoid routing `@external-researcher` to arbitrary user-supplied URLs in security-sensitive contexts.
- **Risk:** Paid-service quota misuse; mitigated by preferring single-source queries and avoiding unnecessary parallel calls.

## Related Documentation

- **Agent prompt (authoritative):** `.opencode/agent/external-researcher.md`.
- **MCP setup guide:** [doc/guides/external-researcher-setup.md](../../guides/external-researcher-setup.md) — keys, config, tool scoping.
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — external-researcher role.
