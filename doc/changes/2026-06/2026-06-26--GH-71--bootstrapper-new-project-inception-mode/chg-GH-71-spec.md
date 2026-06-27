---
workItemRef: GH-71
title: "[inception:2] Unified 8-phase inception workflow for @bootstrapper — single process with new|legacy front-half, product discovery, UX, and committed state"
links:
  decisions: ["ODR-0001", "TDR-0001"]
  related_changes: ["GH-69", "GH-52", "GH-32"]
  benefits: ["GH-72", "GH-70"]
change:
  ref: GH-71
  type: feat
  status: Proposed
  slug: bootstrapper-new-project-inception-mode
  title: "[inception:2] Unified 8-phase inception workflow for @bootstrapper — single process with new|legacy front-half, product discovery, UX, and committed state"
  owners: ["Juliusz Ćwiąkalski"]
  service: bootstrapper-agent
  labels: ["inception", "bootstrapper", "agent"]
  version_impact: major
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: ["bootstrapper-agent", "project-inception-guide", "inception-state-template", "inception-templates", "code-review-instructions-blueprint", "documentation-profile", "build-claude-plugin"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Unify `@bootstrapper` onto ONE 8-phase iterative inception workflow (phases 0–7) whose `project.flow: new|legacy` selects only the front-half (phases 0–4) differences — eradicating the legacy GH-32 6-phase flow and its git-ignored state, and folding the pre-ADOS-project ("legacy") inception path into the same process — so any project (greenfield or pre-ADOS) can be incepted into a deep, agent-consumable knowledge base across multiple sessions.

## 1. SUMMARY

This change unifies `@bootstrapper` onto a **single 8-phase inception workflow** (phases 0–7). It supersedes the prior two-mode design (an inception sub-mode alongside a preserved GH-32 6-phase flow). `project.flow ∈ {new, legacy}` now selects **only the front-half differences** within one workflow (phases 0–4): `new` (empty repo / greenfield idea) **authors** artifacts from scratch; `legacy` (a pre-ADOS long-lived project) **extracts/reconstructs** them from existing code and docs. Phases 5–7 are shared.

The change **eradicates** the old 6-phase flow and its git-ignored state (`.ai/local/bootstrapper-context.yaml`). A single committed state file (`doc/inception/inception-state.yaml`) drives both flows. There is **no backward-compatibility and no migration** — by design. It **folds in** the legacy inception front-half behaviors previously slated for GH-72 (repo ingestion, behavioral-spec extraction from tests, next-milestone scope + tribal-knowledge graduation, architecture reconstruction from code, conventions audit). The GH-33 tribal-knowledge **extraction** machinery remains a separate follow-up. The agent references — and does not recreate — the human-executable guide delivered in GH-69.

## 2. CONTEXT

### 2.1 Current State Snapshot

- `@bootstrapper` (delivered in GH-32) supports only **pre-ADOS (existing-project) adoption** through a single-pass 6-phase flow: repo scan → confidence assessment → human interview → draft → review → write.
- Its state is persisted at a **git-ignored** path (`.ai/local/bootstrapper-context.yaml`) — a single-machine scratch file, not committable, reviewable, or resumable across a team or after conversation compaction.
- Its draft phase produces **three** of the four `.ai/agent/*-instructions.md` files (pm, pr, decision); it does **not** generate `code-review-instructions.md`.
- It has **no new-project path**, no product-discovery/UX artifacts, no per-phase gating, no conditional-artifact activation, and no anti-sycophancy steps.
- GH-69 (merged) delivered the full inception support set: the standalone human-executable guide (`doc/guides/project-inception.md`), the `doc/inception/` workspace skeleton, the `inception-state-template.yaml` schema, 17 inception templates, and the `code-review-instructions--example.md` blueprint.

### 2.2 Pain Points / Gaps

- **No new-project path:** a brand-new repo or an idea cannot be incepted; the agent assumes an existing codebase to scan and interview against.
- **Two-flow duplication:** maintaining a separate, shallow legacy 6-phase flow alongside a richer inception flow doubles the prompt surface, drifts, and forces parity guards. The legacy flow should itself be folded into the inception workflow rather than preserved in parallel.
- **Shallow knowledge bases:** the legacy flow produces overview/spec skeletons but does not integrate product-discovery knowledge (OST, JTBD, personas) or capture assumptions/risks against the four-risk framework.
- **No iterative gating:** the legacy flow is a single pass with one review phase; inception is decision-dense and needs a human gate per phase, with the ability to reopen earlier phases.
- **Ephemeral state:** the git-ignored context file cannot be committed, reviewed, or resumed across a team or over days.
- **No conditional artifact activation:** every project is treated identically; a CLI-only library and a multi-user web app receive the same artifact set.
- **Incomplete instruction-file outputs:** `code-review-instructions.md` is never generated, leaving the reviewer agent without a project-local override file.
- **No adversarial rigor:** the agent has no built-in anti-sycophancy steps, so it tends to ratify the human's first framing rather than stress-test it.

## 3. PROBLEM STATEMENT

Because the GH-32 bootstrapper only onboards pre-ADOS projects through a single-pass, shallow, ephemeral-state 6-phase flow — and has no new-project path at all — a team cannot use one agent to build the deep, product-aware, risk-tagged knowledge base that ADOS delivery agents need, regardless of whether the project is greenfield or pre-ADOS. Maintaining two divergent flows compounds the drift and maintenance cost. This change unifies the bootstrapper onto one stateful, iterative, 8-phase inception workflow whose `project.flow` front-half differences serve both project shapes, eradicating the legacy flow rather than preserving it in parallel.

## 4. GOALS

- **G-1**: Unify `@bootstrapper` onto ONE 8-phase inception workflow (phases 0–7). `project.flow ∈ {new, legacy}` selects **only the front-half (phases 0–4) differences** within that one flow — there is no separate legacy flow.
- **G-2**: Enforce a **per-phase human review gate** for all 8 phases; no phase proceeds without explicit human approval, and Phase 6 may reopen earlier phases.
- **G-3**: Implement **repo-persistent, git-tracked** inception state at `doc/inception/inception-state.yaml` that supports resume across sessions and conversation compaction.
- **G-4**: Detect **project characteristics** (UI-bearing, multi-user, complex domain, code project) in Phase 0 and activate the matching conditional artifacts.
- **G-5**: Capture **product-discovery knowledge** (enriched north star with strategic pyramid/outcome/NSM/JTBD; conditionally OST and project PRD; assumption and risk registers tagged by the four-risk framework).
- **G-6**: Capture **conditional UX artifacts** (user journeys, screen inventory, UX guidance) for UI-bearing projects.
- **G-7**: Embed **anti-sycophancy techniques** in the correct phases (devil's advocate→1, pre-mortem→2&3, alt comparison→3, unknown-unknowns→4, four-risk→1/2/3).
- **G-8**: Generate **all four** `.ai/agent/*-instructions.md` files (pm, pr, decision, code-review) in Phase 5.
- **G-9**: **Eradicate** the old 6-phase flow and its git-ignored state — one process, one state file, no backward-compat/migration — and **fold the legacy front-half** (repo ingestion, extract/reconstruct, next-milestone scope + graduation, architecture reconstruction, conventions audit) into the unified workflow. *(Supersedes the original G-9 "preserve legacy unchanged"; see DEC-8.)*
- **G-10**: Keep the agent prompt and the human guide **consistent** — the prompt references the guide as the human-readable authority and does not duplicate its prose.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Phases with an explicit human gate | 8 of 8 (phases 0–7) |
| Instruction files generated in Phase 5 | 4 of 4 (pm, pr, decision, code-review) |
| Unified-process invariant | Exactly one 8-phase workflow and one state file; the legacy 6-phase flow and `.ai/local/bootstrapper-context.yaml` are absent (0 legacy-flow entry points) — see NFR-4 |
| Front-half branches covered | 2 of 2 (`new` authoring; `legacy` extract/reconstruct) across phases 0–4 |
| Anti-sycophancy techniques placed in correct phases | 5 of 5 mappings (devil's advocate→1; pre-mortem→2&3; alt→3; unknown-unknowns→4; four-risk→1/2/3) |
| Conditional-artifact triggers defined for detected characteristics | 4 of 4 (UI, multi-user, complex domain, code project) |
| Resume round-trips across a fresh invocation | 100% — last incomplete phase is determinable from state alone |
| Prompt duplication of guide prose | 0 — guide is referenced, not recreated |

### 4.2 Non-Goals

- **NG-1**: Tribal-knowledge **extraction** machinery (GH-33) — the workflow **consumes/graduates** a `tribal-knowledge` doc if one is present, but does not build the extraction tooling. (The legacy front-half ingestion/graduation behaviors are now IN scope via the fold-in.)
- **NG-2**: Layered technical planning beyond what Phase 3 produces (→ GH-68, inception:4).
- **NG-3**: Self-hosting ADOS onto itself via inception (→ GH-70, capstone).
- **NG-4**: Running user research, experiments, or prototyping — inception CAPTURES the outputs of these activities; it does not perform them.
- **NG-5**: Recreating `doc/guides/project-inception.md` (already delivered in GH-69). GH-71 amends it only if implementation reveals concrete gaps.
- **NG-6**: Authoring new inception templates (all templates shipped in GH-69).
- **NG-7**: Backward-compatibility or migration of the eradicated 6-phase flow or its git-ignored state — explicitly out of scope by design (DEC-8).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Front-half selection via `project.flow` | The agent must deterministically select `new` or `legacy` to drive front-half (phases 0–4) differences within ONE workflow — not route to a separate flow (AC1, AC17). |
| F-2 | Project-characteristics detection & conditional activation | A one-size artifact set wastes effort or misses critical docs; Phase 0 must detect 4 signals and activate the matching artifacts (AC2). |
| F-3 | Material inventory from staged inputs | Inception quality depends on using the user's provided materials; Phase 0 must scan and map them (AC3). |
| F-4 | Enriched north star | The compass doc must carry strategic context (pyramid, outcome, NSM, JTBD), not just a vision sentence (AC4). |
| F-5 | Conditional discovery artifacts | When discovery materials exist, OST and/or a project PRD capture opportunities/positioning (AC5). |
| F-6 | Enriched roadmap with validation | Each milestone needs outcome-based success metrics and a validation approach, not a feature list (AC6). |
| F-7 | Assumption & risk registers (four-risk tagged) | Explicit, tagged assumptions/risks are the backbone of disciplined inception (AC7). |
| F-8 | Conditional UX artifacts | UI projects need journeys and a screen inventory to scope the build (AC8). |
| F-9 | Full-Stack Environment audit & four-risk check (Phase 3) | Architecture decisions must be stress-tested for AI-friendliness and four-risk exposure (AC9). |
| F-10 | Conditional UX guidance (Phase 4) | UI projects need a design-system/interaction baseline (AC10). |
| F-11 | Code-project quality baseline | Code projects need testing strategy, CI baseline, and dev-env docs (AC11). |
| F-12 | Per-phase human gates | Inception mistakes compound; every phase needs an explicit approval, with Phase 6 able to reopen earlier phases (AC12). |
| F-13 | Repo-persistent inception state & resume | A multi-day process must be committable and resumable from state alone (AC13). |
| F-14 | Embedded anti-sycophancy | Decision-dense phases must run adversarial checks before their gates (AC14). |
| F-15 | All-four instruction-file generation | Phase 5 must emit pm, pr, decision, AND code-review instructions (AC15). |
| F-17 | Legacy repo ingestion (Phase 0) | A pre-ADOS project must be ingested — code/components/dependencies/external integrations analyzed — before anything can be extracted (AC18). |
| F-18 | Legacy north-star & behavioral-spec extraction (Phase 1) | A pre-ADOS project's vision already exists in docs; the north star must be extracted/reconciled, not rewritten, and behavioral specs extracted from tests to seed feature specs (AC19). |
| F-19 | Legacy next-milestone scope & tribal-knowledge graduation (Phase 2) | A pre-ADOS project scopes the next milestone (not an "MVP") and graduates consumed tribal knowledge into permanent homes (AC20). |
| F-20 | Legacy architecture reconstruction & uncertainty flagging (Phase 3) | A pre-ADOS project's architecture must be reconstructed from code, with low-confidence areas explicitly flagged for human confirmation (AC21). |
| F-21 | Legacy conventions audit (Phase 4) | A pre-ADOS project's actual conventions must be audited against the FSE checklist (documenting ACTUAL, not ideal) and gaps flagged (AC22). |

> **F-16 (legacy parity) — DROPPED.** The prior capability "preserve the legacy 6-phase flow unchanged" no longer applies: the legacy flow is eradicated (DEC-8). There is no separate flow to preserve.

### 5.1 Capability Details

- **F-1 (Front-half selection):** On invocation the agent inspects the repository and selects `project.flow` once, persisting it in state and never silently re-deriving it on resume. `new` (empty repo, no committed source, no meaningful history, or a greenfield idea) → author artifacts from scratch. `legacy` (existing source code or non-trivial history; a long-lived project delivered so far without ADOS) → extract/reconstruct artifacts. `project.flow` controls **only** the front-half (phases 0–4); phases 5–7 are shared. Ambiguous cases surface one clarifying question rather than guessing.
- **F-2 (Characteristics detection):** Phase 0 detects four boolean signals — `ui_bearing`, `multi_user`, `complex_domain`, `code_project` — and records them in state. Each signal activates a defined artifact subset (UI → journeys/screens/UX guidance; multi-user → personas/JTBD; complex domain → ubiquitous language; code → testing strategy/CI baseline/dev-env docs).
- **F-3 (Material inventory):** Phase 0 scans `doc/inception/inputs/`, producing an inventory that lists each provided material, maps it to the phase it informs, and extracts key elements/concepts.
- **F-4 (Enriched north star):** Phase 1 runs a Socratic session over the inventory and drafts a north star carrying: strategic-pyramid context (mission→vision→strategy→outcome), a measurable outcome, the North Star Metric with guardrails, target users with JTBD, a problem statement, and guiding principles.
- **F-5 (Discovery artifacts):** When discovery materials are present, Phase 1 drafts an Opportunity Solution Tree (Outcome→Opportunities→Solutions→Experiments) and, for non-trivial products, optionally a project PRD (Working Backwards / press-release format).
- **F-6 (Roadmap):** Phase 2 defines current-milestone scope and drafts an engineering roadmap where each milestone has deliverables, outcome-based success metrics, a validation approach, and OST linkage where discovery exists.
- **F-7 (Registers):** Phase 2 drafts an assumption register (each assumption tagged Value/Usability/Feasibility/Viability + validation status) and a risk register (four-risk assessment for the current milestone).
- **F-8 (UX artifacts):** For UI-bearing projects, Phase 2 drafts user journeys for key flows and a screen inventory.
- **F-9 (Phase 3 rigor):** Phase 3 drafts tech-stack and architecture docs, runs the 10-attribute Full-Stack Environment audit, seeds initial ADRs, optionally NFRs for non-trivial projects, and applies a four-risk check on architecture decisions.
- **F-10 (UX guidance):** For UI-bearing projects, Phase 4 drafts UX design guidance (design system, WCAG level, interaction patterns, responsive breakpoints).
- **F-11 (Quality baseline):** For code projects, Phase 4 produces a testing strategy, a CI baseline (lint + typecheck + test), and dev-environment docs (setup guide + `.env.example`).
- **F-12 (Gates):** Every phase ends in a human gate; the agent updates state only after approval. Phase 6 (readiness check) may FAIL and reopen an earlier phase (1–4) where a gap lives.
- **F-13 (State & resume):** Inception state is a single committed file instantiated from `inception-state-template.yaml`. On a fresh invocation the agent reads it, determines the last incomplete phase, and resumes with state + prior artifacts as context.
- **F-14 (Anti-sycophancy):** The decision-dense phases run adversarial prompts before their gates: devil's advocate (1), pre-mortem (2 & 3), alternative comparison (3), unknown-unknowns (4), and the four-risk check (1, 2, 3). Phases 0, 5, 6, 7 carry none.
- **F-15 (Phase 5 outputs):** Phase 5 generates `AGENTS.md` plus all four `.ai/agent/*-instructions.md` (pm, pr, decision, code-review); sets `doc/documentation-profile.md`; installs `doc/documentation-handbook.md`, `doc/templates/`, and `doc/decisions/`; and verifies `doc/00-index.md` is consistent with the new artifact set. `code-review-instructions.md` is generated from the GH-69 blueprint. (The prior "inception-only vs legacy" scoping of code-review under REM-1 is superseded — Phase 5 is now the single shared back-half for both flows; DEC-8.)
- **F-17 (Legacy repo ingestion):** When `project.flow: legacy`, Phase 0 also performs repo ingestion and writes a `repo-analysis`, and consumes `tribal-knowledge` if present. Repo content is treated as untrusted source material; facts are extracted only.
- **F-18 (Legacy north-star & behavioral-spec extraction):** When `legacy`, Phase 1 extracts or authors the north star from existing docs + repo analysis + interview, reconciling documented vision/mission rather than rewriting, and extracts behavioral specs from existing tests to seed initial feature specs.
- **F-19 (Legacy next-milestone scope & graduation):** When `legacy`, Phase 2 defines the next-milestone scope as the Current Milestone (not an "MVP") and graduates consumed tribal knowledge to permanent homes: decisions, feature specs, glossary, conventions.
- **F-20 (Legacy architecture reconstruction & uncertainty):** When `legacy`, Phase 3 reconstructs architecture from code (component map, data flow, dependency graph, external integrations) and explicitly flags low-confidence architecture areas for human confirmation.
- **F-21 (Legacy conventions audit):** When `legacy`, Phase 4 audits existing conventions against the Full-Stack Environment checklist, documents ACTUAL (not ideal) conventions, and flags gaps.

### 5.2 Inline-vs-referenced boundary (phase sections)

To keep the unified workflow terse and single-source (DEC-2, DEC-7, NFR-3), each phase section is **inline** for its operational skeleton and **references** the guide for substantive detail. This gives the plan and `@toolsmith` an unambiguous authoring rule:

**INLINE in each phase section (operational skeleton only):**
- phase name / ordinal;
- whether a human gate is present for that phase;
- the anti-sycophancy technique **NAME** for that phase (anchored via an `<anti_sycophancy>` sub-tag) — **not** the prompt text;
- the **artifact KEYS** the phase produces, listed by name/key only (and, for front-half phases, the `new` vs `legacy` behavior difference);
- the state-update point (when `doc/inception/inception-state.yaml` advances);
- a one-line reference to the relevant guide section.

**REFERENCED, not duplicated (from `doc/guides/project-inception.md` / templates):**
- substantive artifact content and field-level detail;
- the full anti-sycophancy prompt text;
- conditional-artifact activation details (the 4-signal matrix from F-2);
- the four-risk definitions (Value / Usability / Feasibility / Viability).

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Unified inception (high level)
  Human invokes /bootstrap in any repo (new or pre-ADOS)
  → Agent enters Phase 0: selects project.flow once (new|legacy|ambiguous→ask),
    classifies repo profile, detects 4 characteristics, scans inputs/,
    builds material inventory; legacy ALSO ingests the repo + consumes
    tribal-knowledge → writes repo-analysis
  → HUMAN GATE 0 (confirm flow, profile, characteristics, inventory, legacy analysis if any)
  → Phases 1–4 (FRONT-HALF): branches differ by project.flow
      new    = author artifacts from scratch
      legacy = extract/reconstruct (reconcile vision; behavioral specs from tests;
               next-milestone scope; reconstruct architecture + flag uncertainty;
               audit actual conventions)
     each phase: produce draft → run anti-sycophancy → HUMAN GATE
     (P1 devil's advocate; P2 pre-mortem + four-risk; P3 alt-comparison + pre-mortem; P4 unknown-unknowns)
  → Phases 5–7 (SHARED back-half): identical for both flows
      P5 generate AGENTS.md + 4 instruction files + profile + handbook/templates/decisions → HUMAN GATE
      P6 readiness check → PASS proceeds / FAIL reopens an earlier phase (1–4) → HUMAN GATE
      P7 inception summary + initial feature specs → FINAL SIGN-OFF
  → State committed at doc/inception/inception-state.yaml after each gate.

Flow 2 — Resume across sessions
  Human invokes /bootstrap again (or after conversation compaction)
  → Agent reads doc/inception/inception-state.yaml (single file)
  → project.flow is the resume source of truth — not re-derived from repo shape
  → Determines last incomplete phase from state alone
  → Restores state + prior artifacts as context, resumes at that phase.

(There is no separate legacy flow. The prior GH-32 6-phase flow is eradicated by DEC-8.)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- A **unified 8-phase inception workflow** in `@bootstrapper` (phases 0–7) driven by `project.flow: new|legacy`.
- The **eradication** of the old GH-32 6-phase flow and its git-ignored state (`.ai/local/bootstrapper-context.yaml`); one process, one state file.
- The **legacy front-half fold-in** (phases 0–4 extract/reconstruct behaviors): repo ingestion + `repo-analysis`; north-star reconciliation + behavioral-spec extraction from tests; next-milestone scope + tribal-knowledge graduation; architecture reconstruction from code + uncertainty flagging; existing-conventions audit vs FSE.
- Phase 0 characteristics detection, material inventory, and front-half selection.
- Phases 1–7 enriched artifacts (north star, OST/PRD, roadmap, registers, UX artifacts, tech/architecture/FSE audit, glossary/ubiquitous language, UX guidance, quality baseline, framework integration, readiness check, summary + feature specs).
- Repo-persistent inception state + resume (single committed file).
- Per-phase human gates with Phase-6 reopen.
- Embedded anti-sycophancy (5 technique→phase mappings).
- Phase-5 generation of all four instruction files, including `code-review-instructions.md`.
- The bootstrapper **write allowlist** as the single, unified allowlist (incl. `doc/inception/**` and `doc/inception/abandoned-<ISO>.yaml`, `.ai/agent/code-review-instructions.md`, and `doc/documentation-profile.md`).
- Update to the `bootstrapper` one-line description in `AGENTS.md`.
- Regeneration of the Claude Code plugin counterpart (committed alongside the source, per the multi-tool rule).

### 7.2 Out of Scope

- [OUT] Tribal-knowledge **extraction** machinery (GH-33) — the workflow consumes/graduates a present `tribal-knowledge` doc only.
- [OUT] Layered technical planning beyond Phase 3 outputs (→ GH-68).
- [OUT] Self-hosting ADOS via inception (→ GH-70).
- [OUT] Conducting user research, experiments, or prototyping.
- [OUT] Authoring `doc/guides/project-inception.md` from scratch (reference only; amend solely on concrete gaps).
- [OUT] New inception templates (all shipped in GH-69).
- [OUT] **Backward-compatibility or migration** of the eradicated 6-phase flow or its git-ignored state (DEC-8).

### 7.3 Deferred / Maybe-Later

- Tribal-knowledge **extraction** tooling (GH-33) — only consume/graduate is in scope now.
- Capstone self-hosting of ADOS (GH-70).
- Any guide amendments discovered during implementation are captured here as deferred edits and applied only if a concrete gap is proven.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — this change extends an internal agent prompt; it exposes no HTTP endpoints.

### 8.2 Events / Messages

N/A — no new events or messages.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `doc/inception/inception-state.yaml` | The **single** committed state file (instantiated from `inception-state-template.yaml`), used by BOTH flows. Holds `schema_version`, `project` (name, `flow`, `profile`, `characteristics`), `phases[]` (id/name/status/timestamps), `artifacts{}` (status/path/confidence), `decisions[]`, `assumptions[]` (risk_type + validation_status), `sessions[]`, `last_updated`. |
| DM-2 | `project.flow` + `project.characteristics` | `flow ∈ {new, legacy}` selects the **front-half (phases 0–4) behavior** within the unified workflow (`new` = author; `legacy` = extract/reconstruct); phases 5–7 are shared. The four booleans (`ui_bearing`, `multi_user`, `complex_domain`, `code_project`) drive conditional artifacts. |
| DM-3 | `assumptions[]` | Each entry carries `risk_type ∈ {value, usability, feasibility, viability}` and `validation_status ∈ {unvalidated, testing, validated, invalidated}` — the four-risk tagging backbone. |
| DM-4 | Eradicated state artifact | The prior `.ai/local/bootstrapper-context.yaml` git-ignored schema is **removed**. It has no replacement and is referenced here only as superseded history. Exactly one state file remains (DM-1); there is no per-flow state split. |

### 8.4 External Integrations

N/A — no new external APIs or services. The agent may use existing MCP/CLI access (e.g., tracker, PR platform) only where Phase 5 framework-integration already defines it; nothing new is introduced.

### 8.5 Backward Compatibility

- **Not backward compatible — by design (DEC-8).** The GH-32 6-phase flow and its git-ignored state (`.ai/local/bootstrapper-context.yaml`) are **eradicated**. There is no parallel legacy flow and no migration path; this is an accepted, intentional break.
- Projects previously bootstrapped via GH-32 keep their **committed artifacts** (e.g., `AGENTS.md`, instruction files, overview/spec docs) — those outputs remain valid. Only the **re-inception process** changes: a subsequent `/bootstrap` runs the unified flow (with `project.flow: legacy`), not the old 6-phase flow.
- The new unified mode is the **sole** bootstrapper process; it is not additive to a preserved legacy mode.
- The `AGENTS.md` one-line description edit reflects the unified capability (not an additive parallel mode).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Front-half selection determinism | Empty repo / greenfield idea → `project.flow: new`; existing source code or non-trivial history (a pre-ADOS project) → `project.flow: legacy`; ambiguous cases must surface one question, never silently guess (0 silent guesses). |
| NFR-2 | Resume correctness | On a fresh invocation, `project.flow` is the resume source of truth (not re-derived from repo shape), and the last incomplete phase is determinable from `doc/inception/inception-state.yaml` alone (single-file read, no reliance on in-memory conversation state). |
| NFR-3 | Prompt maintainability | The unified workflow references the guide for human-readable detail and does not duplicate its prose. Per the inline-vs-referenced boundary (§5.2), each phase section is inline only for its operational skeleton (name, gate presence, anti-sycophancy technique **name**, artifact keys, new/legacy front-half difference, state-update point, one-line guide reference) and references the guide for substantive detail. The agent file remains structured as frontmatter + well-formed sections (no malformed tags). |
| NFR-4 | Unified-process invariant | Exactly ONE inception workflow (8 phases) and exactly ONE state file (`doc/inception/inception-state.yaml`) exist. The legacy 6-phase flow and `.ai/local/bootstrapper-context.yaml` are removed; 0 code paths route to a separate legacy flow. *(Supersedes the prior NFR-4 "legacy behavioral parity"; see DEC-8.)* |
| NFR-5 | Guide/prompt consistency | The agent prompt and the guide must not contradict; the prompt names the guide as the human-readable authority. 0 known contradictions at delivery. |
| NFR-6 | State-file safety | The committed inception state must never contain secrets, tokens, or credentials. |
| NFR-7 | Write-safety | Inception writes are confined to the allowlist; any write outside it requires explicit human confirmation with a warning. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — agents are prompt definitions without runtime telemetry. Observability is structural: the committed `doc/inception/inception-state.yaml` itself is the progress/observability artifact (phase statuses, confidence scores, decisions, sessions), reviewed by humans at each gate.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Prompt bloat degrades agent instruction-following (the file is large) | H | M | Unify onto one workflow (no parallel legacy block); reference the guide instead of duplicating prose; keep agent instructions terse; delegate prompt authoring to `@toolsmith`. Size is monitored by the manual verification matrix + PR review, not a CI structure test (DEC-9). | M |
| RSK-2 | Most AC are behavioral agent-capability claims untestable in CI | M | H | The ONLY test layer is the **manual** `TC-INCEP-*` verification matrix + PR review — there is no CI structure test (DEC-9). Static/allowlist facts and CI gates (plugin freshness, doc-distribution marker) are checked where mechanical; behavioral claims are honestly marked manual. | M |
| RSK-3 | Front-half selection ambiguity causes wrong-branch behavior | M | M | Explicit `new`/`legacy` decision rule; ambiguous cases ask the human (NFR-1). | L |
| RSK-4 | ~~Two state files confuse the agent~~ | — | — | **Superseded by DEC-8** — there is now a single state file; the two-state-file premise no longer holds. | None |
| RSK-5 | Drift between the guide (human authority) and the prompt (agent authority) | M | M | Prompt references the guide; both updated together if a concrete gap is found; NFR-5 forbids contradictions. | L |
| RSK-6 | Editing the agent regresses the **unified** flow (no CI structure guard) | H | M | The unified workflow is the only flow, so any regression is a regression of inception itself. Behavioral correctness is verified by the manual `TC-INCEP-*` matrix + PR review; **TDR-0001 is the structure authority** (DEC-9). No frozen legacy blocks remain to guard. | M |
| RSK-7 | Generated Claude-plugin counterpart goes stale (multi-tool rule) | M | M | Regenerate via `scripts/build-claude-plugin.sh` and commit source + generated together; CI verifies freshness. | L |
| RSK-8 | Eradication breaks re-inception for projects previously bootstrapped via GH-32 | M | L | Prior committed artifacts remain valid; only the re-inception path changes (it now runs the unified flow with `project.flow: legacy`). No data migration is required (the old flow's outputs are committed docs, not consumed state). | L |

## 12. ASSUMPTIONS

- GH-69 deliverables (guide, workspace skeleton, `inception-state-template.yaml`, inception templates, `code-review-instructions--example.md` blueprint) are present and stable — verified present at authoring time.
- The `@toolsmith` agent is the correct delegate for editing `.opencode/agent/bootstrapper.md` (hard rule in `AGENTS.md` "Extending the system").
- `doc/guides/project-inception.md` is the human authority and is accurate; the agent mirrors, not replaces, it.
- Inception is run by a human who will attend each gate; the agent does not auto-advance phases.
- The four-risk framework values are fixed: Value, Usability, Feasibility, Viability.
- Projects previously bootstrapped via GH-32 retain their committed artifacts; only the re-inception process changes — no migration of prior outputs is needed.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-69 | Templates, `doc/inception/` workspace, `inception-state-template.yaml`, `doc/guides/project-inception.md`, `code-review-instructions--example.md` blueprint — VERIFIED PRESENT. |
| Depends on | GH-52 | `documentation-profile.md` classification used in Phase 5. |
| Depends on | `@toolsmith` | Required delegate for editing the agent prompt (repo hard rule). |
| Depends on | `scripts/build-claude-plugin.sh` | Regenerates the `.ados-claude` counterpart; source + generated committed together. |
| Supersedes (partial) | GH-72 | The legacy front-half behaviors (repo ingestion, behavioral-spec extraction, next-milestone scope + graduation, architecture reconstruction, conventions audit) are folded INTO this change; GH-72's remaining scope shrinks accordingly. |
| Relates | GH-33 | Tribal-knowledge EXTRACTION machinery remains a separate follow-up (only consume/graduate is in scope here). |
| Relates | GH-70 (capstone) | Self-hosting consumes this capability. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the phase sections live as discrete sections inside `bootstrapper.md`, or as a separate referenced structure, to best manage prompt size? | The file is already large; structure choice affects maintainability and the `@toolsmith` hand-off. | **Resolved → DEC-7 / TDR-0001**, then **superseded in framing by DEC-8** (the "parallel to legacy" framing is historical; the delivered structure is one `<inception_workflow>` with 8 phase sections under `<mode_selection>`). |
| OQ-2 | What is the bar for amending `doc/guides/project-inception.md` vs recording the gap as deferred? | The change may amend the guide only on concrete gaps; the threshold was undefined. | **Resolved → DEC-5** (amend only on concrete AND blocking gaps). |
| OQ-3 | How is `project.flow` selected/persisted when a project has partial state from a prior abandoned run? | Edge case for resume correctness (NFR-2). | **Resolved → DEC-6** (`project.flow` is the resume source of truth; abandoned state archived, never silently destroyed). |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Inception state is committed (`doc/inception/inception-state.yaml`). | A multi-day, team-visible process needs to be committed and resumable. *(The original "legacy state stays git-ignored" clause is superseded by DEC-8 — there is now a single committed state file for both flows.)* | 2026-06-26 |
| DEC-2 | The agent references the guide rather than recreating it. | Avoids two divergent authorities; the guide (GH-69) is the human-readable source of truth. | 2026-06-26 |
| DEC-3 | Phase 5 generates all four instruction files including `code-review-instructions.md`. | Closes the GH-32 gap; the reviewer agent needs a project-local override file; the blueprint already exists (GH-69). *(The REM-1 "inception-only vs legacy" scoping is superseded by DEC-8 — Phase 5 is the shared back-half for both flows.)* | 2026-06-26 |
| DEC-4 | Editing the agent prompt is delegated to `@toolsmith`. | Hard rule in `AGENTS.md` "Extending the system". | 2026-06-26 |
| DEC-5 | Guide-amendment threshold: amend `doc/guides/project-inception.md` in-repo only when a gap is **concrete AND blocking**. Everything else is recorded as deferred, not amended here. | Scope discipline — the guide just shipped in GH-69; this change must not rewrite it but must not ship a real contradiction. Resolves OQ-2. | 2026-06-26 |
| DEC-6 | Resume: `project.flow` in `doc/inception/inception-state.yaml` is the source of truth on resume. Valid in-progress → resume; all completed → "already incepted"; malformed/mismatch → warn + offer repair or archive-and-restart; abandoned-run state archived to `doc/inception/abandoned-<ISO>.yaml`, never silently overwritten. | NFR-2 resume correctness + 0 silent guesses. Resolves OQ-3. | 2026-06-26 |
| DEC-7 | Phase-section prompt structure (recorded in TDR-0001). | Resolves OQ-1. *(The "parallel to the legacy `<workflow_phases>` block" framing is historical — superseded by DEC-8: the delivered agent has one `<inception_workflow>` of 8 phases; there is no parallel legacy block.)* | 2026-06-26 |
| DEC-8 | **Unified single-process bootstrapper** (USER DIRECTIVE, REM-9): ERADICATE the GH-32 6-phase legacy flow and `.ai/local/bootstrapper-context.yaml`. The bootstrapper has ONE process — the 8-phase inception workflow — with `project.flow: new|legacy` selecting front-half (phases 0–4) differences only; phases 5–7 shared. Single state file `doc/inception/inception-state.yaml`. No backward-compat, no migration. "legacy" is redefined as a **pre-ADOS long-lived project** (extract/reconstruct), NOT a previously-bootstrapped project. Folds in part of GH-72 (legacy front-half behaviors); GH-33 tribal-knowledge EXTRACTION stays a separate follow-up. Supersedes the old G-9, F-16, AC16, NFR-4 (legacy-parity) and the REM-1 inception-vs-legacy scoping. | This is the original inception design intent; GH-71 had deviated by preserving the old flow out of caution. One process removes the parity-guard contradiction and the two-state-file confusion. | 2026-06-27 |
| DEC-9 | **Delete the structure test** (USER DIRECTIVE, REM-10): `scripts/.tests/test-bootstrapper-prompt-structure.sh` is removed. It hardcoded prompt wording (grep-as-a-test), would fossilize TDR-0001's chosen wording against future evolution, and its only defensible piece (the two-tier legacy-parity guard) dissolves under DEC-8 (no frozen legacy blocks remain). **TDR-0001 is the structure authority**; behavioral correctness is the manual `TC-INCEP-*` matrix + PR review, not CI. | Removes false confidence and a brittle CI coupling; keeps TDR-0001 as the single source for the structure decision. | 2026-06-27 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `@bootstrapper` agent definition (OpenCode source) | **Rewritten** — unified 8-phase inception workflow; the GH-32 6-phase legacy flow is eradicated (not extended in parallel) |
| `@bootstrapper` Claude Code plugin counterpart | Updated — regenerated artifact (source + generated committed together) |
| `doc/guides/project-inception.md` | Possibly amended — only if a concrete gap is proven; `ados_distribution` preserved |
| `AGENTS.md` (bootstrapper one-line description) | Updated — reflects the unified single-process capability |
| `doc/inception/inception-state.yaml` | New — the single committed state file (instantiated per project at runtime; no live instance ships in this repo) |
| `scripts/.tests/test-bootstrapper-prompt-structure.sh` | **Deleted** — per DEC-9 (no longer a deliverable) |
| `.ai/local/bootstrapper-context.yaml` | **Removed** — eradicated per DEC-8 (superseded history only) |
| Change artifacts (this folder) | New/updated — spec, plan, test-plan, pm-notes |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion (Given / When / Then) | Linked |
|----|----------------------------------|--------|
| AC1 | **Given** `@bootstrapper` is invoked, **when** Phase 0 evaluates the repo shape, **then** it selects `project.flow` (`new` for empty/greenfield; `legacy` for existing source/history; ambiguous asks) and that selection drives **only the front-half (phases 0–4) differences within one 8-phase workflow** — there is no separate legacy flow. | F-1, NFR-1, DM-2 |
| AC2 | **Given** Phase 0 runs, **when** it inspects the project, **then** it detects the four characteristics (UI-bearing, multi-user, complex domain, code project) and activates exactly the matching conditional artifacts. | F-2, DM-2 |
| AC3 | **Given** user-provided materials exist in `doc/inception/inputs/`, **when** Phase 0 completes, **then** a material inventory is produced mapping each input to the phase it informs with extracted key elements. | F-3 |
| AC4 | **Given** Phase 1 completes, **when** the north star is drafted, **then** it contains the strategic-pyramid context, a measurable outcome, the North Star Metric, and target users with JTBD. | F-4 |
| AC5 | **Given** discovery materials are present, **when** Phase 1 completes, **then** it conditionally produces an OST and/or a project PRD; when no discovery materials exist, **then** those artifacts are skipped. | F-5 |
| AC6 | **Given** Phase 2 completes, **when** the roadmap is drafted, **then** each milestone carries outcome-based success metrics and a validation approach. | F-6 |
| AC7 | **Given** Phase 2 completes, **when** the registers are drafted, **then** an assumption register and a risk register exist, each tagged by the four-risk framework (Value/Usability/Feasibility/Viability). | F-7, DM-3 |
| AC8 | **Given** the project is detected UI-bearing, **when** Phase 2 completes, **then** user journeys and a screen inventory are produced; for non-UI projects they are skipped. | F-8, F-2 |
| AC9 | **Given** Phase 3 completes, **when** architecture is drafted, **then** a 10-attribute Full-Stack Environment audit and a four-risk check on architecture decisions are present. | F-9 |
| AC10 | **Given** the project is detected UI-bearing, **when** Phase 4 completes, **then** UX design guidance is produced; for non-UI projects it is skipped. | F-10, F-2 |
| AC11 | **Given** the project is detected as a code project, **when** Phase 4 completes, **then** a testing strategy, a CI baseline, and dev-environment docs are produced. | F-11, F-2 |
| AC12 | **Given** the inception flow runs, **when** any of phases 0–7 reaches completion, **then** it cannot advance without explicit human approval, and Phase 6 may reopen an earlier phase (1–4) on FAIL. | F-12 |
| AC13 | **Given** an inception is in progress, **when** the agent is re-invoked in a fresh session, **then** it reads the committed `doc/inception/inception-state.yaml`, treats `project.flow` as the resume source of truth, determines the last incomplete phase, and resumes from there. | F-13, NFR-2, DM-1 |
| AC14 | **Given** the decision-dense phases run, **when** each reaches its pre-gate step, **then** the correct anti-sycophancy technique executes (devil's advocate→1; pre-mortem→2&3; alt comparison→3; unknown-unknowns→4; four-risk→1/2/3) and phases 0/5/6/7 carry none. | F-14 |
| AC15 | **Given** Phase 5 completes, **when** framework files are generated, **then** all four `.ai/agent/*-instructions.md` exist (pm, pr, decision, AND code-review). | F-15 |
| AC16 | **SUPERSEDED by DEC-8 / redesign.** *(Original: "legacy 6-phase flow + git-ignored state behave unchanged.")* The legacy 6-phase flow is **eradicated**; there is no separate unchanged legacy flow to preserve. Replaced by AC23 (unified-process invariant). | — |
| AC17 | **Given** the unified workflow is active, **when** the agent needs human-readable phase detail, **then** it references `doc/guides/project-inception.md` rather than recreating it. | F-1, NFR-5 |
| AC18 | **Given** `project.flow: legacy`, **when** Phase 0 completes, **then** a `repo-analysis` is produced (component map, data flow, dependencies, external integrations) and `tribal-knowledge` is consumed if present. | F-17 |
| AC19 | **Given** `project.flow: legacy`, **when** Phase 1 completes, **then** the north star is extracted/reconciled from existing docs (vision/mission reconciled, not rewritten) AND behavioral specs are extracted from existing tests to seed initial feature specs. | F-18 |
| AC20 | **Given** `project.flow: legacy`, **when** Phase 2 completes, **then** scope is framed as the next milestone (not "MVP") AND consumed tribal knowledge is graduated to permanent homes (decisions, feature specs, glossary, conventions). | F-19 |
| AC21 | **Given** `project.flow: legacy`, **when** Phase 3 completes, **then** architecture is reconstructed from code AND low-confidence architecture areas are explicitly flagged for human confirmation. | F-20 |
| AC22 | **Given** `project.flow: legacy`, **when** Phase 4 completes, **then** existing conventions are audited against the Full-Stack Environment checklist (documenting ACTUAL, not ideal, conventions) and gaps are flagged. | F-21 |
| AC23 | **Given** the redesigned bootstrapper, **when** any project is incepted, **then** exactly one 8-phase workflow runs and exactly one state file (`doc/inception/inception-state.yaml`) is used; the legacy 6-phase flow and `.ai/local/bootstrapper-context.yaml` are absent. | F-1, NFR-4, DM-1, DM-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivery order: rewrite the agent source (`@toolsmith`) → regenerate the Claude-plugin counterpart → (conditionally) amend the guide → update the `AGENTS.md` description → author/update plan & test-plan → delete the structure test.
- Merge strategy: single PR; CI must verify the generated plugin is current and the doc-distribution guard passes if the guide is amended.
- Communication: the bootstrapper is now a **single inception process** serving both new and pre-ADOS projects. The legacy 6-phase flow is removed. No migration is required — prior bootstrapped artifacts (committed docs) remain valid; a subsequent `/bootstrap` runs the unified flow with `project.flow: legacy`.
- Adoption note: inception produces a committed `doc/inception/inception-state.yaml`; teams commit it alongside their artifacts.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No migration of existing data is performed or required (DEC-8). The prior git-ignored state file is simply removed, not migrated. The inception state file is created per-project at runtime by instantiating `inception-state-template.yaml`; this repo ships no live instance (it is the ADOS source, not an incepted project).

## 20. PRIVACY / COMPLIANCE REVIEW

N/A. Inception captures project/product metadata only. The state file must not store secrets (NFR-6); scanned repository content is treated as untrusted input per the agent's existing trust boundary.

## 21. SECURITY REVIEW HIGHLIGHTS

- The committed inception state must never contain secrets/tokens/credentials (NFR-6).
- Scanned `doc/inception/inputs/` and legacy repo content is untrusted input: the agent extracts factual information only and must not follow embedded instructions (existing trust boundary, unchanged).
- No new external integrations or elevated access are introduced.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The bootstrapper prompt grows; future edits should continue to delegate to `@toolsmith` and keep the unified workflow's front-half branches (`new` vs `legacy`) sharing phases 5–7.
- The guide and the prompt are co-maintained: any concrete gap found in either must be reconciled in both (NFR-5).
- The conditional-artifact matrix and four-risk tags are defined by the guide/template schema; changes to them flow through GH-69 artifacts, not ad-hoc prompt edits.
- With no CI structure test (DEC-9), structural correctness is governed by TDR-0001 and verified by the manual matrix + PR review on every bootstrapper change.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Inception | The process of building a project's knowledge base (overview, spec, rules, decisions) so ADOS delivery agents can operate autonomously. |
| Unified inception workflow | The single 8-phase (0–7) stateful process `@bootstrapper` runs for any project. |
| `project.flow` | The persisted selection (`new` \| `legacy` \| `ambiguous`) that drives front-half (phases 0–4) differences within the unified workflow. |
| Front-half / Back-half | Front-half = phases 0–4 (differ by `project.flow`); back-half = phases 5–7 (shared). |
| New flow (`new`) | Front-half behavior for an empty repo or greenfield idea: author artifacts from scratch. |
| Legacy flow (`legacy`) | Front-half behavior for a pre-ADOS long-lived project: extract/reconstruct artifacts (NOT a previously-bootstrapped project). |
| Four-risk framework | Assessment across Value (will users want it?), Usability (can they use it?), Feasibility (can we build it?), Viability (does it make business sense?). |
| OST | Opportunity Solution Tree — Outcome → Opportunities → Solutions → Experiments. |
| JTBD | Jobs To Be Done — the "job" a user hires a product for. |
| NSM | North Star Metric — the one metric capturing user value, with guardrails. |
| FSE audit | Full-Stack Environment audit — 10 AI-friendliness attributes of a project. |
| Human gate | An explicit human approval required before a phase advances; no auto-advance. |
| Anti-sycophancy | Structured adversarial prompts (devil's advocate, pre-mortem, alternative comparison, unknown-unknowns, four-risk) run before a gate so the agent proposes and the human decides. |
| Strategic pyramid | mission → vision → strategy → outcome context anchoring the north star. |

## 24. APPENDICES

- **Appendix A — Authoritative AC source:** GitHub issue GH-71 (8-phase table and AC checklist), amended by trusted repo-owner comments: (1) Phase 5 must generate all four `.ai/agent/*-instructions.md` including the currently-missing `code-review-instructions.md`; (2) the guide was delivered in GH-69 and must be referenced, not recreated; and (3) the redesign directive (REM-9/REM-10): unify onto one process, eradicate the legacy flow, fold in the legacy front-half, delete the structure test.
  - **AC traceability note (RT1-11):** The ticket's *"guide exists and documents the full workflow"* acceptance criterion was **delivered in GH-69**. GH-71's **AC17** enforces the reference-not-recreate invariant.
  - **AC16 supersession note:** The ticket's legacy-parity criterion (AC16) is **superseded by the redesign** (DEC-8); its intent is carried by AC23 (unified-process invariant).
- **Appendix B — Phase → anti-sycophancy map (authoritative):** P1 devil's advocate + four-risk awareness; P2 pre-mortem + four-risk check; P3 alternative comparison + pre-mortem; P4 unknown-unknowns; P0/P5/P6/P7 none. Identical for `new` and `legacy`.
- **Appendix C — Phase → primary artifacts (summary):** P0 state + material inventory (+legacy `repo-analysis`); P1 north star (+OST/PRD; +legacy behavioral-spec seeds); P2 roadmap (+journeys/screens) + registers (+legacy next-milestone scope + graduation); P3 tech/architecture/FSE audit + ADRs (+NFRs; +legacy architecture reconstruction + uncertainty flags); P4 glossary (+ubiquitous language/UX guidance) + testing/CI/dev-env (+legacy conventions audit + gaps); P5 AGENTS.md + 4 instruction files + profile + handbook/templates/decisions; P6 readiness report; P7 inception summary + feature specs.
- **Appendix D — Redesign amendment (REM-9/REM-10):** Eradicate the GH-32 6-phase flow + `.ai/local/bootstrapper-context.yaml`; unify onto one 8-phase workflow; `project.flow` selects front-half differences only; fold in the legacy front-half (previously GH-72); delete the structure test; TDR-0001 is the structure authority; behavioral correctness = manual `TC-INCEP-*` matrix + PR review. No backward-compat/migration.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-26 | Juliusz Ćwiąkalski | Initial specification |
| 1.1 | 2026-06-27 | Juliusz Ćwiąkalski | Red-team pre-delivery remediation: REM-1 (code-review scoped to inception Phase 5), REM-2 (NFR-4/RSK-6 parity method), REM-3 (§5.2 inline-vs-referenced boundary), REM-5 (`doc/documentation-profile.md` allowlist), RT1-11 (Appendix A traceability), RT1-16 (Phase-5 sub-artifacts folded into F-15). |
| 1.2 | 2026-06-27 | Juliusz Ćwiąkalski | **Redesign amendment (REM-9/REM-10).** Reframed from "add inception mode alongside preserved legacy" to "unify onto one 8-phase workflow with `new|legacy` front-half; eradicate the GH-32 6-phase flow + git-ignored state; fold in the legacy front-half." Dropped G-9(old), F-16, AC16, NFR-4(old), RSK-4(premise). Reframed F-1/AC1/NFR-1 (front-half selection, not mode routing). Added F-17–F-21 / AC18–AC22 (legacy front-half behaviors), AC23 (unified invariant), NFR-4(new), RSK-8. Added DEC-8/DEC-9; marked DEC-1/DEC-3/DEC-7 superseded-in-framing. Removed the structure-test deliverable (DEC-9); TDR-0001 is the structure authority. `version_impact` → major (breaking, no backward-compat). |

---

## AUTHORING GUIDELINES

- **Sources:** GitHub issue GH-71 (authoritative AC + 8-phase table); trusted repo-owner comment amendments (all-four instruction files; reference-not-recreate the guide; the redesign directive REM-9/REM-10); `doc/guides/project-inception.md` (GH-69, human authority); `.opencode/agent/bootstrapper.md` (the delivered unified 8-phase workflow — confirmed as implemented truth before finalizing AC/F wording); `doc/templates/inception-state-template.yaml` (state schema); `doc/inception/README.md` (workspace); `doc/templates/blueprints/code-review-instructions--example.md` (Phase-5 blueprint); `doc/decisions/TDR-0001-*.md` (structure authority); `AGENTS.md` (Extending the system, Multi-tool support, License headers). Gitignored research notes were used only as design input and are NOT referenced in this committed artifact.
- **Approach:** WHAT/WHY only — problem, goals, functional capabilities, contracts, NFRs, risks, AC. No implementation tasks, no step-by-step edits, no low-level code paths. Committed paths are referenced at the artifact/contract level (state file, instruction files, guide, templates) because they are the deliverables and interfaces; the eradicated `.ai/local/bootstrapper-context.yaml` is referenced only as superseded history.
- **Constraints:** AC numbering kept traceable to the ticket (AC1–AC17 retained; AC16 marked superseded in place; AC18–AC23 added) so each maps cleanly to a checklist item. Each AC uses Given/When/Then and references at least one F-/NFR-/DM- ID. NFRs are quantified. Risks carry Impact and Probability. Front-half selection determinism, resume correctness, and the unified-process invariant are called out as measurable NFRs.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-71)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then (AC16 is explicitly marked superseded, not a live criterion)
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability (RSK-4 marked superseded, not a live risk)
- [x] No implementation details (no step-by-step tasks, no low-level code edits)
- [x] No content duplicated from linked docs (guide is referenced, not copied)
- [x] Front matter validates per front_matter_rules
- [x] Eradicated artifact (`.ai/local/bootstrapper-context.yaml`) referenced only as superseded history, never as a current artifact
