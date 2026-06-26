---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-bootstrapper.md

id: SPEC-BOOTSTRAPPER
status: Current
created: 2026-03-10
last_updated: 2026-03-16
owners: [Juliusz Ćwiąkalski]
service: delivery-os
links:
  related_changes: ["GH-32", "GH-36"]
  guides:
    - "doc/guides/onboarding-existing-project.md"
summary: "Multi-session bootstrapper agent and /bootstrap command that automate ADOS adoption for existing projects via repo scan, confidence assessment, human interview, and artifact generation."
---

# Feature: Bootstrapper (`@bootstrapper` agent + `/bootstrap` command)

## Overview

The bootstrapper provides an automated adoption path for Agentic Delivery OS (ADOS) in existing projects. It consists of a stateful `@bootstrapper` agent (`.opencode/agent/bootstrapper.md`) and a thin `/bootstrap` command (`.opencode/command/bootstrap.md`) that together guide users through a multi-session workflow: scanning the target repo, assessing confidence, interviewing the human, drafting artifacts, and writing them upon approval.

The bootstrapper complements the manual onboarding guide (`doc/guides/onboarding-existing-project.md`) by automating the artifact generation steps.

## Business Context

### Problem Statement

- **Problem:** Teams adopting ADOS must reverse-engineer the required files, their order, and content from multiple cross-referencing guides — a process that is error-prone and discouraging.
- **Affected Users:** Engineers and tech leads evaluating or adopting ADOS for their projects.
- **Business Impact:** Without guided onboarding, adoption friction reduces ADOS's value as a reusable delivery framework.

### Goals & Success Metrics

- **Primary Goal:** Enable a team to go from zero ADOS artifacts to a working setup in a single interactive session.
- **KPIs:** Bootstrapper generates valid `AGENTS.md` + `pm-instructions.md` + `pr-instructions.md` + at least one feature spec per invocation.

## User Experience & Functionality

### Capabilities

- **Multi-session stateful workflow (F-1):** The agent persists state across sessions at `.ai/local/bootstrapper-context.yaml` (git-ignored), enabling pause and resume without data loss.
- **Repo scan (F-2):** Automatically detects project structure, tech stack, existing docs, CI/CD configuration, and package managers.
- **Confidence assessment (F-3):** Scores each artifact to generate on a 0.0–1.0 scale, focusing interview questions on low-confidence areas only.
- **Human interview (F-4):** Asks 3–7 targeted questions per turn, grouped by theme, with progressive refinement. Accepts "skip" and "I don't know" responses.
- **Draft generation (F-5):** Produces mandatory artifacts (`AGENTS.md`, `.ai/agent/pm-instructions.md`, `.ai/agent/pr-instructions.md`, `doc/documentation-handbook.md`) and recommended artifacts (feature specs, overview docs) based on accumulated context.
- **Human review (F-6):** Presents each draft for approval, highlights low-confidence areas with TODOs, and iterates on corrections.
- **Write phase (F-7):** Writes approved artifacts to the filesystem, creates necessary directories, and provides next-step suggestions.

### User Flow

```
User runs /bootstrap [<project-name>]
  → @bootstrapper checks for existing state
  → If state exists: resume from last phase
  → If no state: start fresh
    → Phase 1: Repo scan (directory structure, tech stack, existing docs)
    → Phase 2: Confidence assessment (score per artifact)
    → Phase 3: Human interview (targeted questions for low-confidence areas)
    → Phase 4: Draft generation (mandatory + recommended artifacts)
    → Phase 5: Human review (present drafts, iterate on corrections)
    → Phase 6: Write (save approved artifacts, suggest next steps)
```

### Edge Cases & Error Handling

- **Pre-existing ADOS artifacts:** Detected during repo scan; bootstrapper warns and asks whether to overwrite or skip.
- **Session interruption:** State file preserves all progress; resume is idempotent.
- **Insufficient information:** Low-confidence artifacts get TODO placeholders; human review catches gaps.
- **No tracker configured:** Interview explicitly asks about tracker setup; supports GitHub Issues, Jira, or none.

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `.opencode/agent/bootstrapper.md` | Agent prompt | Defines the 6-phase workflow, state schema, interview logic, and safety rules |
| `.opencode/command/bootstrap.md` | Command entry point | Thin wrapper that delegates to `@bootstrapper` with optional project-name argument |
| `.ai/local/bootstrapper-context.yaml` | Persistent state | Git-ignored YAML file storing project metadata, interview history, confidence scores, artifact status, and session timestamps |

### Persistent State Schema

```yaml
project:
  name: <project-name>
  description: <brief-description>
  tech_stack: [<languages>, <frameworks>, <tools>]
  repo_type: <monorepo|single-service|library|docs-only>
  primary_language: <language>
  existing_docs: [<paths>]
  existing_ci: <ci-system-or-null>

tracker:
  type: <github|jira|linear|none>
  project_key: <key-or-null>
  owner: <org-or-username>
  repo: <repo-name>

interview:
  questions_asked:
    - { question: <text>, answer: <text>, date: <ISO-date> }
  pending_questions: [<text>]

confidence:
  agents_md: <0.0-1.0>
  pm_instructions: <0.0-1.0>
  documentation_handbook: <0.0-1.0>
  feature_specs: <0.0-1.0>
  overview_docs: <0.0-1.0>
  templates: <0.0-1.0>

artifacts:
  agents_md: { status: <pending|draft|approved|written>, path: <path-or-null> }
  pm_instructions: { status: <pending|draft|approved|written>, path: <path-or-null> }
  documentation_handbook: { status: <pending|draft|approved|written>, path: <path-or-null> }
  feature_specs:
    - { name: <feature-name>, status: <pending|draft|approved|written>, path: <path-or-null> }
  overview_docs:
    - { name: <doc-name>, status: <pending|draft|approved|written>, path: <path-or-null> }
  templates: { status: <pending|draft|approved|written>, path: <path-or-null> }

sessions:
  - { started: <ISO-timestamp>, phase: <phase-name>, notes: <summary> }

last_updated: <ISO-timestamp>
```

### Generated Artifacts

| Artifact | Mandatory | Description |
|----------|-----------|-------------|
| `AGENTS.md` | Yes | Project-specific version with correct repo structure, tech stack, and references |
| `.ai/agent/pm-instructions.md` | Yes | Tracker configuration based on interview answers |
| `.ai/agent/pr-instructions.md` | Yes | PR/MR platform configuration based on interview answers (Git platform, CLI tool) |
| `doc/documentation-handbook.md` | Yes | Copied as-is from ADOS source |
| Feature specs in `doc/spec/features/` | Recommended | Based on project scan and interview (at least one) |
| `doc/overview/` docs | Optional | North star and/or architecture overview |
| `doc/templates/` | Optional | Copied from ADOS source |
| `doc/decisions/` | Optional | Directory setup with README and index |

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Resilience | State file survives session interruption | Zero data loss on resume |
| NFR-2 | Security | State file never contains secrets, tokens, or credentials | Enforced by agent prompt |
| NFR-3 | Safety | Never overwrites existing files without explicit human approval | Confirmation required |
| NFR-4 | Safety | Never modifies existing source code | Agent constraint |
| NFR-5 | Fallback | Agent functions correctly when templates directory is absent | Embedded defaults used |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | Full workflow validation | Run `/bootstrap` on a project with no ADOS artifacts; verify all mandatory artifacts are generated correctly |
| Manual | Resume validation | Interrupt a bootstrap session; resume and verify state continuity |
| Manual | Edge case validation | Run on a project with pre-existing ADOS artifacts; verify warning and skip behavior |

## Operational & Support

### Configuration

- **State location:** `.ai/local/bootstrapper-context.yaml` (git-ignored)
- **Command invocation:** `/bootstrap [<project-name>]`
- **Agent model:** `anthropic/claude-opus-4-6`

## Dependencies & Risks

- **Depends on:** Onboarding guide (`doc/guides/onboarding-existing-project.md`) for manual fallback path
- **Depends on:** Document templates (`doc/templates/`) for structural guidance during artifact generation
- **Risk:** Bootstrapper generates inaccurate artifacts for complex projects — mitigated by mandatory human review checkpoint

## Related Documentation

- **Onboarding guide:** [doc/guides/onboarding-existing-project.md](../../guides/onboarding-existing-project.md) — manual adoption path
- **Project inception guide:** [doc/guides/project-inception.md](../../guides/project-inception.md) — manual 8-phase inception process and artifact catalog
- **Agent prompt:** `.opencode/agent/bootstrapper.md` — full workflow definition
- **Command prompt:** `.opencode/command/bootstrap.md` — entry point
- **Agent inventory:** [.opencode/README.md](../../../.opencode/README.md)
