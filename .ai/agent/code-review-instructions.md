---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.ai/agent/code-review-instructions.md
---
# Code Review Instructions

<!-- This file EXTENDS the code-reviewer agent's built-in review heuristics with
     repository-specific rules. Items here take priority over built-in defaults.
     To create this file for a new project, copy the example blueprint from
     doc/templates/blueprints/code-review-instructions--example.md -->

Repository-specific review guidance for the `code-reviewer` agent when reviewing ADOS PRs/MRs. This file is the single source of repository-local review configuration — context, priorities, checklist, and patterns.

## Repository Context

- This repo's primary deliverables are **agent prompts** (`.opencode/agent/*.md`) and **command definitions** (`.opencode/command/*.md`). A degraded prompt degrades everything downstream — treat prompt changes with the same rigor as production code.
- XML structure is preferred for Claude models; Markdown for GPT models; JSON for DeepSeek models.
- Every Markdown file must carry a three-line YAML frontmatter: copyright, MIT license reference, and canonical URL.
- Bash scripts carry the same three lines as comments after the shebang.

## Review Priorities

1. **Prompt correctness**: Does the agent/command do what it claims? Are constraints complete? Will it produce the right output?
2. **Convention alignment**: Does the change follow ADOS patterns (naming, file layout, delegation, `tmp/` conventions)?
3. **Safety**: Does the agent respect its boundaries (read-only vs write, no auto-merge, dirty tree checks)?
4. **Consistency**: Does the new tool match sibling tools in structure and style?
5. **Documentation**: Are inventories (`.opencode/README.md`, `AGENTS.md`) updated?

## Review Checklist

The `code-reviewer` agent evaluates each applicable item against the PR/MR diff.

### Prompt Quality (agents and commands)

- [ ] Prompt uses XML structure for Claude/Grok models, Markdown for GPT, JSON for DeepSeek
- [ ] Description frontmatter is short (3-10 words) and disambiguates when to use the tool
- [ ] Constraints are explicit and non-redundant
- [ ] Inputs and outputs are clearly defined
- [ ] No verbose prose — prefer structured tags over paragraphs
- [ ] Agent does not exceed its stated responsibilities (single responsibility)
- [ ] Delegation boundaries are clear (which agents are called, what is passed)

### Naming and Conventions

- [ ] File and folder names use kebab-case
- [ ] Agent/command name matches filename
- [ ] Conventional Commit format used in commit messages
- [ ] Branch naming follows `<type>/<workItemRef>/<slug>` convention
- [ ] License headers present on all new Markdown and Bash files

### Security

- [ ] No hardcoded secrets, tokens, or credentials
- [ ] No sensitive data written to non-gitignored paths
- [ ] `tmp/` artifacts do not contain secrets
- [ ] Pre-flight checks validate auth status before CLI operations

### Error Handling

- [ ] CLI commands check exit codes and handle failures
- [ ] Graceful fallback when optional files/tools are absent
- [ ] Clear error messages with actionable advice (not stack traces)
- [ ] NEEDS_INPUT marker used when critical input is missing

### Documentation

- [ ] `.opencode/README.md` inventory updated when agents/commands added or removed
- [ ] `AGENTS.md` updated when agent team or commands change
- [ ] New features documented in relevant guide files
- [ ] Decision records created for significant architectural decisions

### Testing

- [ ] Changed code paths have corresponding test coverage
- [ ] Test files follow `test-*.sh` naming in `.tests/` directories
- [ ] Acceptance criteria from spec are verifiable

### Consistency

- [ ] New tools match patterns of existing sibling tools
- [ ] Platform detection mirrors `@pr-manager` conventions
- [ ] `tmp/` directory conventions followed (per-branch paths, gitignored)
- [ ] State persistence follows established schema patterns

## What to Ignore

- Formatting handled by CI (line length, trailing whitespace) — do not flag these.
- Minor wording preferences in documentation prose — focus on correctness over style.
- Model selection choices — these are intentional and context-dependent.

## Special Patterns

- `@pr-manager` is the reference implementation for platform detection, `branchPath` sanitization, and `tmp/` state management. New agents that interact with PR/MR platforms should mirror its patterns.
- `@toolsmith` defines quality gates for agent/command creation. Reference its `quality_gates` section when reviewing new tools.
- Change artifacts live in `doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/` — never under `doc/changes/current`.
