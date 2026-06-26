---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/blueprints/code-review-instructions--example.md
ados_distribution: redistributable
---
# Code Review Instructions

<!-- Copy this file to `.ai/agent/code-review-instructions.md` in your project. -->
<!-- Customize the sections below for your repository's specific conventions. -->
<!-- This file EXTENDS the reviewer agent's built-in heuristics. -->
<!-- Items here take priority over built-in defaults on any conflict. -->

## Repository Context

<!-- Describe what this repo is, its primary deliverables, and what reviewers should know. -->
- Primary language: [language]
- Framework: [framework]
- Key conventions: [list]

## Review Priorities

<!-- Order from most to least important for YOUR project. -->
1. [Most important concern for this repo]
2. [Second priority]
3. ...

## Review Checklist

<!-- Add repo-specific checklist items. These supplement the agent's built-in heuristics. -->

### [Category Name]

- [ ] [Specific check for your repo]
- [ ] [Another check]

## What to Ignore

<!-- Things the agent should NOT flag in this repo. -->
- [e.g., "Formatting — handled by Prettier/CI"]
- [e.g., "Line length — enforced by linter"]

## Special Patterns

<!-- Repo-specific patterns, conventions, or known intentional deviations. -->
- [e.g., "We use Result types for error handling, not exceptions"]
- [e.g., "All API endpoints must have OpenAPI annotations"]
