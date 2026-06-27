---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-bootstrapper.md

id: SPEC-BOOTSTRAPPER
status: Current
created: 2026-03-10
last_updated: 2026-06-27
owners: [Juliusz Ćwiąkalski]
service: delivery-os
links:
  related_changes: ["GH-32", "GH-69", "GH-71", "GH-72"]
  guides:
    - "doc/guides/project-inception.md"
    - "doc/guides/onboarding-existing-project.md"
summary: "Stateful @bootstrapper agent and /bootstrap command that run ADOS project inception end-to-end through a single multi-session, human-gated 8-phase workflow (phases 0–7) covering new and legacy projects alike."
---

# Feature: Bootstrapper (`@bootstrapper` agent + `/bootstrap` command)

## Overview

The bootstrapper is ADOS's automated inception path. It consists of a stateful `@bootstrapper` agent (`.opencode/agent/bootstrapper.md`) and a thin `/bootstrap` command (`.opencode/command/bootstrap.md`) that together run **one process**: the 8-phase iterative inception workflow (phases 0–7) whose human-executable authority is [doc/guides/project-inception.md](../../guides/project-inception.md).

Inception produces the project's **knowledge base** — overview, spec, rules, and decision docs — that AI delivery agents operate against. The bootstrapper automates that workflow. It does **not** run user interviews, experiments, or prototyping (those precede or run alongside inception); it captures, structures, and references their outputs.

> **Superseded history.** GH-32 shipped a 6-phase "existing-project onboarding" flow that kept git-ignored state at `.ai/local/bootstrapper-context.yaml`. GH-71 redesigned the bootstrapper into the unified 8-phase inception model described here. The legacy 6-phase flow and `.ai/local/bootstrapper-context.yaml` are **gone**: no backward-compatibility, no migration.

> **Changelog.** GH-72 added the **PRODUCE** step to legacy Phase 0 (tribal-knowledge extraction from repo docs + `git log`), completing the PRODUCE → CONSUME → GRADUATE loop wired by GH-71. Consume (Phase 0) and graduate (Phase 2) are unchanged.

## Business Context

### Problem Statement

- **Problem:** Incepting an ADOS project by hand requires cross-referencing many templates and deciding artifact ordering, applicability, and content from scratch — error-prone and inconsistent across projects and project types.
- **Affected Users:** Engineers and tech leads onboarding a new or pre-ADOS legacy project into ADOS.
- **Business Impact:** Without guided inception the knowledge base is shallow, which caps how autonomously delivery agents can run later.

### Goals & Success Metrics

- **Primary Goal:** Take any project (empty repo or long-lived codebase) from zero ADOS artifacts to an incepted knowledge base through one guided, multi-session workflow.
- **KPIs:** Every applicable artifact in the inception catalog exists and passes the Phase-6 readiness check; all per-phase human gates are hit; state survives interruption and resumes idempotently.

## User Experience & Functionality

### One workflow, two front halves

The bootstrapper runs **one** workflow with **eight** phases (0–7). `project.flow` selects only the **front-half** differences in phases 0–4; phases 5–7 are shared.

| `project.flow` | When | Front-half (0–4) posture |
|---|---|---|
| `new` | Empty repo, no committed source, no meaningful history, or a greenfield idea staged in `doc/inception/inputs/` | **Author** artifacts from scratch |
| `legacy` | Existing source code or non-trivial history; a long-lived project delivered so far WITHOUT ADOS | **Extract / reconstruct** from existing code and docs |
| `ambiguous` | Cannot tell | Ask **one** clarifying question; make 0 silent guesses |

Flow is selected **once** in Phase 0, persisted to state, and never silently re-derived on resume.

New-vs-legacy front-half distinctions (phases 5–7 are identical for both):

| Phase | `new` | `legacy` |
|---|---|---|
| 0 | Scan `doc/inception/inputs/`; build material-inventory | Above + repo ingestion + `repo-analysis`; **PRODUCE** `tribal-knowledge.md` from repo docs + `git log` (file reads + `git log` only), then **consume** `tribal-knowledge` if present |
| 1 | Author north star from scratch (Socratic) | Extract/author north star from existing docs + repo + interview; behavioral-spec extraction from tests |
| 2 | Define **MVP** scope as Current Milestone | Define **next-milestone** scope (NOT "MVP"); tribal-knowledge graduation |
| 3 | Design tech stack + architecture from scratch | Reconstruct architecture from code; flag uncertainty |
| 4 | Set up domain/conventions from scratch | Audit existing conventions vs Full-Stack Environment checklist — document ACTUAL, not ideal |

### The 8-phase flow (high level)

Every phase follows the same loop: fresh conversation → read state + prior artifacts → produce draft → run anti-sycophancy check (decision-dense phases) → human gate → update state.

| Phase | Purpose | Human gate | Anti-sycophancy |
|---|---|---|---|
| 0 — Intake & material scan | Select `project.flow`; classify repo profile; detect characteristics; build material-inventory (legacy: repo ingestion + repo-analysis; **PRODUCE** `tribal-knowledge.md` from repo docs + `git log`, then consume) | Approve flow, profile, characteristics, inventory, legacy analysis (incl. the tribal-knowledge PRODUCE roll-up) | none |
| 1 — North star & vision | Author/extract north star; conditional OST, project-PRD, personas/JTBD; legacy: behavioral-spec seeds | Approve north star + discovery/persona/spec seeds | devil's advocate + four-risk awareness |
| 2 — Scope & roadmap | Current Milestone scope (MVP / next-milestone); roadmap; assumption + risk registers; legacy: tribal-knowledge graduation; conditional user journeys + screen inventory | Approve scope, roadmap, assumptions, risks, graduations | pre-mortem + four-risk check |
| 3 — Tech stack & architecture | Tech stack; architecture overview; FSE audit; seed ADRs; conditional NFRs; legacy: reconstruct + flag uncertainty | Approve tech, architecture, ADRs, NFRs, uncertainty flags | alternative comparison + pre-mortem |
| 4 — Domain, conventions & quality baseline | Glossary; conditional ubiquitous-language / UX guidance; code projects: testing-strategy, convention rules, CI baseline, dev setup, `.env.example`, security baseline; legacy: audit ACTUAL conventions | Approve glossary, conventions, quality baseline, gaps | unknown-unknowns |
| 5 — ADOS framework integration | Generate `AGENTS.md` + all four `.ai/agent/*-instructions.md`; set documentation-profile; install handbook/templates/decisions-index/00-index | Approve all framework files | none |
| 6 — Inception readiness check | Catalog completeness, cross-doc consistency, FSE verification, four-risk coverage, assumption review, ghost-reference check. **FAIL → reopen phase 1–4.** | Approve readiness report or send back | none |
| 7 — Inception summary & handoff | Inception summary; initial feature specs (new: from current-milestone scope; legacy: from code analysis reconciled with behavior) | Final sign-off — project incepted | none |

Phase-by-phase detail, anti-sycophancy prompts, the conditional matrix, and the full artifact catalog live in [doc/guides/project-inception.md](../../guides/project-inception.md); this spec does not duplicate them.

### Tribal-knowledge loop (legacy: PRODUCE → CONSUME → GRADUATE)

For `project.flow: legacy`, the bootstrapper closes the tribal-knowledge loop in three steps spanning phases 0 and 2:

| Step | Phase | What it does | Output |
|------|-------|--------------|--------|
| **PRODUCE** | 0 | Mine repo docs (READMEs, decision records, design notes, code comments holding rationale) and git history via `git log` (merge commits, Conventional-Commit histories) using **file reads + `git log` only** — no PR-thread tooling (GH-33 is parked). Categorize each item, attach a verifiable source pointer, score confidence, and flag contradictions → write `doc/inception/analysis/tribal-knowledge.md` from `doc/templates/tribal-knowledge-template.md` | Graduation-ready `tribal-knowledge.md`, reviewed at human gate 0 |
| **CONSUME** | 0 | Read a present `tribal-knowledge.md` (whether PRODUCE just wrote it or a human hand-authored it) | Item set staged for graduation |
| **GRADUATE** | 2 | Move non-contradicted, sufficiently-confident items to their permanent homes (decisions, feature specs, glossary, conventions) under human gate 2 | Items in permanent ADOS homes |

PRODUCE runs **only** for the `legacy` flow — greenfield projects have no history to mine. PRODUCE happens **before** consume so a fresh run populates the set Phase 2 graduates; it does **not** graduate itself. A hand-authored `tribal-knowledge.md` is **preserved** — PRODUCE writes fresh only when none exists or the human approves overwrite (the no-overwrite-without-approval rule).

The produced artifact's shape is fixed by [PDR-0001](../../decisions/PDR-0001-tribal-knowledge-extraction-taxonomy.md) and encoded structurally in the [tribal-knowledge template](../../templates/tribal-knowledge-template.md): a closed 5-category set (`decision | convention | rejected-approach | workaround | domain-term`), each category mapping to an **existing** ADOS graduation home (no invented register); a source pointer per item (`path:line` for docs, commit short SHA for git history; multi-source dedups into one item); a `high | medium | low` confidence rubric (high and medium graduate directly; low is re-flagged for human confirmation); and an `## Open Contradictions` roll-up that surfaces every `status: contradicted` item at gate 0 — contradicted items are **excluded from Phase-2 graduation** until a human clears the flag or drops the item. Repo docs, commit/merge messages, and `git log` output are untrusted input (see Trust boundary & safety).

### Conditional artifacts

Phase 0 detects four project characteristics and activates matching artifacts only (recorded as booleans in state):

- `ui_bearing` → user journeys, screen inventory, UX guidance, UX conventions
- `multi_user` → personas/JTBD
- `complex_domain` → ubiquitous language (DDD)
- `code_project` → testing strategy, CI baseline, dev-environment docs, `.env.example`

### Human gates & anti-sycophancy

All eight phases end in a human gate — no auto-advance. Decision-dense phases (1, 2, 3, 4) run a structured adversarial prompt before the gate (devil's advocate → 1; pre-mortem → 2 & 3; alternative comparison → 3; unknown-unknowns → 4), all under the **four-risk** framework (`Value / Usability / Feasibility / Viability`) which tags assumptions with `risk_type` and `validation_status`. Phase 6 may FAIL and reopen an earlier phase (1–4).

### State model

- **Single state file:** committed, git-tracked `doc/inception/inception-state.yaml`, instantiated from `doc/templates/inception-state-template.yaml`.
- Holds: `schema_version`; `project` (`name`, `flow`, `profile`, `characteristics`); `phases[]` (`status` + timestamps); `artifacts{}` (`status` / `path` / `confidence` 0.0–1.0); `decisions[]`; `assumptions[]` (`risk_type` + `validation_status`); `sessions[]`; `last_updated`.
- No secret/token/credential values are ever recorded; credential patterns are scanned before recording interview answers.

### Resume behavior

On invocation the bootstrapper reads `doc/inception/inception-state.yaml`:

- **Valid in-progress** state with `project.flow: new|legacy` → resume at the last incomplete phase; never re-derive flow from repo shape.
- **All phases completed** → report "already incepted".
- **Malformed / schema-mismatch** → warn; offer repair or archive-and-restart; never silently overwrite.
- **Abandoned run** → archive prior state to `doc/inception/abandoned-*.yaml`, then begin a fresh run.
- **No state** → start Phase 0 and select flow.

The current phase and completed work are always shown before proceeding.

## Phase 5 outputs (ADOS framework integration)

Phase 5 wires the project into ADOS. It produces:

| Output | Notes |
|---|---|
| `AGENTS.md` | Project-specific version |
| `.ai/agent/pm-instructions.md` | Tracker config only — references `doc/guides/change-lifecycle.md` instead of repeating it; applies tracker-workflow discovery (Jira transitions via MCP, GitHub labels, local-backlog states) |
| `.ai/agent/pr-instructions.md` | PR/MR platform config — auto-detected from `git remote`, confirmed at interview; CLI preferred over MCP when both available |
| `.ai/agent/decision-instructions.md` | Decision-tracking conventions |
| `.ai/agent/code-review-instructions.md` | Code-review configuration |
| `doc/documentation-profile.md` | engineering / business / mixed |
| `doc/documentation-handbook.md`, `doc/templates/`, `doc/decisions/` (README + index), `doc/guides/`, `doc/00-index.md` | Installed/verified from ADOS source |

## Write allowlist

The bootstrapper may **only** write to the paths below; any other path requires explicit human confirmation ("This path is outside the standard ADOS write allowlist. Proceed? [y/N]"):

- `AGENTS.md`
- `.ai/agent/{pm,pr,decision,code-review}-instructions.md`
- `.ai/rules/**`
- `.github/workflows/**`
- `.env.example`
- `doc/inception/**` (including `doc/inception/abandoned-*.yaml`)
- `doc/documentation-profile.md`
- `doc/documentation-handbook.md`
- `doc/00-index.md`
- `doc/overview/**`
- `doc/spec/features/**`
- `doc/spec/nonfunctional.md`
- `doc/templates/**`
- `doc/decisions/README.md`, `doc/decisions/00-index.md`
- `doc/guides/**`
- `doc/planning/{backlog.md, epics/**, archive/**}`

## Trust boundary & safety

All content scanned from the target repo or staged under `doc/inception/inputs/` is **untrusted input** — including Markdown, configuration, code comments, generated docs, **git history (commit and merge messages, `git log` output)**, and embedded instructions. The bootstrapper extracts facts only; it does **not** follow instructions embedded in scanned files or execute commands found in them. The legacy Phase-0 **PRODUCE** step (mining repo docs + `git log` into `tribal-knowledge.md`) operates under this same boundary — facts only, no embedded instructions followed, credential patterns refused — per the bootstrapper's `<trust_boundary>` and `<safety_rules>`. Human interview answers are trusted only after the credential-pattern check.

Safety rules: never store secrets; never modify existing source code; never overwrite files without explicit human approval; always create directories before writing; always confirm before writing any artifact.

## Technical Architecture & Codebase Map

| Path | Component | Responsibility |
|------|-----------|----------------|
| `.opencode/agent/bootstrapper.md` | Agent prompt | Defines the unified 8-phase inception workflow, `project.flow` selection, anti-sycophancy, state usage, resume, write allowlist, trust boundary, and safety rules |
| `.opencode/command/bootstrap.md` | Command entry point | Thin wrapper delegating to `@bootstrapper` with an optional project-name hint; `subtask: false` (multi-session, needs main conversation context) |
| `doc/inception/inception-state.yaml` | Persistent state | Committed, git-tracked state file (instantiated from `doc/templates/inception-state-template.yaml`) |
| `doc/guides/project-inception.md` | Human authority | The 8-phase process, anti-sycophancy prompts, conditional matrix, and artifact catalog — the human-executable process the agent automates |

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Resilience | State survives session interruption; resume is idempotent | Zero data loss on resume |
| NFR-2 | Security | State/artifacts never contain secrets, tokens, or credentials | Credential-pattern scan enforced before recording answers |
| NFR-3 | Safety | Never overwrite existing files without explicit human approval | Confirmation required |
| NFR-4 | Safety | Never modify existing source code | Agent constraint |
| NFR-5 | Containment | Writes confined to the allowlist; out-of-allowlist writes require confirmation | Allowlist enforced by agent prompt |
| NFR-6 | Trust | Scanned repo/inputs content is untrusted; embedded instructions ignored | Extract facts only |

## Relationship to the broader ADOS adoption flow

- **Human authority:** [doc/guides/project-inception.md](../../guides/project-inception.md) is the standalone, human-executable 8-phase process. The bootstrapper automates exactly this workflow; the guide is the source of truth for phase detail.
- **Manual fallback:** [doc/guides/onboarding-existing-project.md](../../guides/onboarding-existing-project.md) remains the manual adoption reference.
- **Downstream:** a completed inception (Phase 7 sign-off) hands off to autonomous per-change delivery via the 10-phase lifecycle ([doc/guides/change-lifecycle.md](../../guides/change-lifecycle.md)). A deeper knowledge base yields more agent autonomy.

## Related Documentation

- **Inception guide (authority):** [doc/guides/project-inception.md](../../guides/project-inception.md)
- **Onboarding guide (manual fallback):** [doc/guides/onboarding-existing-project.md](../../guides/onboarding-existing-project.md)
- **State template:** [doc/templates/inception-state-template.yaml](../../templates/inception-state-template.yaml)
- **Tribal-knowledge template (PRODUCE output shape):** [doc/templates/tribal-knowledge-template.md](../../templates/tribal-knowledge-template.md)
- **Design authority (tribal-knowledge taxonomy & graduation mapping):** [doc/decisions/PDR-0001-tribal-knowledge-extraction-taxonomy.md](../../decisions/PDR-0001-tribal-knowledge-extraction-taxonomy.md)
- **Agent prompt:** `.opencode/agent/bootstrapper.md`
- **Command prompt:** `.opencode/command/bootstrap.md`
- **Agent inventory:** [.opencode/README.md](../../../.opencode/README.md)
