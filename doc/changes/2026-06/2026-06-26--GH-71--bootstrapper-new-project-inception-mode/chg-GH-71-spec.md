---
workItemRef: GH-71
title: "[inception:2] Iterative phased inception workflow for @bootstrapper — new-project mode with product discovery, UX, and repo-persistent state"
links:
  decisions: ["ODR-0001", "TDR-0001"]
  related_changes: ["GH-32", "GH-69", "GH-52"]
  benefits: ["GH-72", "GH-70"]
change:
  ref: GH-71
  type: feat
  status: Proposed
  slug: bootstrapper-new-project-inception-mode
  title: "[inception:2] Iterative phased inception workflow for @bootstrapper — new-project mode with product discovery, UX, and repo-persistent state"
  owners: ["Juliusz Ćwiąkalski"]
  service: bootstrapper-agent
  labels: ["inception", "bootstrapper", "agent"]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: ["bootstrapper-agent", "project-inception-guide", "inception-state-template", "inception-templates", "code-review-instructions-blueprint", "documentation-profile", "build-claude-plugin"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Give `@bootstrapper` a new-project inception mode that automates the 8-phase iterative inception workflow defined in `doc/guides/project-inception.md` — with repo-persistent state, per-phase human gates, conditional product/UX artifacts, and embedded anti-sycophancy — so a brand-new project can be incepted into a deep, agent-consumable knowledge base across multiple sessions.

## 1. SUMMARY

This change extends the `@bootstrapper` agent with a **new-project inception mode** (`mode: new`) implementing the 8-phase iterative workflow (phases 0–7). It adds repo-persistent, git-tracked inception state, per-phase human review gates, project-characteristics detection that activates conditional artifacts, embedded anti-sycophancy techniques (including the four-risk framework), and Phase-5 generation of **all four** `.ai/agent/*-instructions.md` files. The existing legacy (existing-project) 6-phase flow is preserved unchanged. The agent references — and does not recreate — the human-executable guide delivered in GH-69.

## 2. CONTEXT

### 2.1 Current State Snapshot

- `@bootstrapper` (delivered in GH-32) supports only **existing-project (legacy) adoption** through a 6-phase flow: repo scan → confidence assessment → human interview → draft → review → write.
- State is persisted at a **git-ignored** path (`.ai/local/bootstrapper-context.yaml`) — suitable for a single-machine session, not for a multi-day, team-visible, committed process.
- Legacy Phase 4 (draft generation) produces three of the four `.ai/agent/*-instructions.md` files (pm, pr, decision). It does **not** generate `code-review-instructions.md`.
- The bootstrapper's write allowlist is oriented to legacy outputs (`doc/overview/**`, `doc/spec/features/**`, etc.); it has no provision for `doc/inception/**`.
- GH-69 (merged) delivered the full inception support set: the standalone human-executable guide (`doc/guides/project-inception.md`), the `doc/inception/` workspace skeleton, the `inception-state-template.yaml` schema, 17 inception templates, and the `code-review-instructions--example.md` blueprint.

### 2.2 Pain Points / Gaps

- **No new-project path:** a brand-new repo or an idea cannot be incepted; `@bootstrapper` assumes an existing codebase to scan and interview against.
- **Shallow knowledge bases:** the legacy flow produces overview/spec skeletons but does not integrate product-discovery knowledge (OST, JTBD, personas) or capture assumptions/risks against the four-risk framework.
- **No iterative gating:** the legacy flow is a single pass with one review phase; inception is decision-dense and needs a human gate per phase, with the ability to reopen earlier phases.
- **Ephemeral state:** the git-ignored context file cannot be committed, reviewed, or resumed across a team or after conversation compaction over days.
- **No conditional artifact activation:** every project is treated identically; a CLI-only library and a multi-user web app receive the same artifact set.
- **Incomplete Phase-5 outputs:** `code-review-instructions.md` is never generated, leaving the reviewer agent without a project-local override file.
- **No adversarial rigor:** the agent has no built-in anti-sycophancy steps, so it tends to ratify the human's first framing rather than stress-test it.

## 3. PROBLEM STATEMENT

Because `@bootstrapper` only onboards existing projects through a single-pass, shallow, ephemeral-state flow, a team starting a new project cannot use the agent to build the deep, product-aware, risk-tagged knowledge base that ADOS delivery agents need to operate autonomously — forcing them to author inception artifacts by hand (per the GH-69 guide) or skip them entirely, resulting in shallow specs and lower delivery autonomy downstream.

## 4. GOALS

- **G-1**: Add a `mode: new` inception path to `@bootstrapper` that implements the 8-phase iterative workflow (0–7) defined in the guide, selectable deterministically in Phase 0, with the legacy path still reachable.
- **G-2**: Enforce a **per-phase human review gate** for all 8 phases; no phase proceeds without explicit human approval, and Phase 6 may reopen earlier phases.
- **G-3**: Implement **repo-persistent, git-tracked** inception state at `doc/inception/inception-state.yaml` that supports resume across sessions and conversation compaction.
- **G-4**: Detect **project characteristics** (UI-bearing, multi-user, complex domain, code project) in Phase 0 and activate the matching conditional artifacts.
- **G-5**: Capture **product-discovery knowledge** (enriched north star with strategic pyramid/outcome/NSM/JTBD; conditionally OST and project PRD; assumption and risk registers tagged by the four-risk framework).
- **G-6**: Capture **conditional UX artifacts** (user journeys, screen inventory, UX guidance) for UI-bearing projects.
- **G-7**: Embed **anti-sycophancy techniques** in the correct phases (devil's advocate→1, pre-mortem→2&3, alt comparison→3, unknown-unknowns→4, four-risk→1/2/3).
- **G-8**: Generate **all four** `.ai/agent/*-instructions.md` files (pm, pr, decision, code-review) in Phase 5.
- **G-9**: Preserve the existing legacy 6-phase flow and its state file **unchanged**.
- **G-10**: Keep the agent prompt and the human guide **consistent** — the prompt references the guide as the human-readable authority and does not duplicate its prose.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Phases with an explicit human gate | 8 of 8 (phases 0–7) |
| Instruction files generated in Phase 5 | 4 of 4 (pm, pr, decision, code-review) |
| Legacy-mode behavioral parity | 100% — legacy section and its state schema unchanged |
| Anti-sycophancy techniques placed in correct phases | 5 of 5 mappings (devil's advocate→1; pre-mortem→2&3; alt→3; unknown-unknowns→4; four-risk→1/2/3) |
| Conditional-artifact triggers defined for detected characteristics | 4 of 4 (UI, multi-user, complex domain, code project) |
| Resume round-trips across a fresh invocation | 100% — last incomplete phase is determinable from state alone |
| Prompt duplication of guide prose | 0 — guide is referenced, not recreated |

### 4.2 Non-Goals

- **NG-1**: Legacy onboarding deepening — repo ingestion, behavioral-spec extraction, tribal-knowledge graduation (→ GH-72, inception:3).
- **NG-2**: Layered technical planning beyond what Phase 3 produces (→ GH-68, inception:4).
- **NG-3**: Self-hosting ADOS onto itself via inception (→ GH-70, capstone).
- **NG-4**: Running user research, experiments, or prototyping — inception CAPTURES the outputs of these activities; it does not perform them.
- **NG-5**: Recreating `doc/guides/project-inception.md` (already delivered in GH-69). GH-71 amends it only if implementation reveals concrete gaps.
- **NG-6**: Authoring new inception templates (all templates shipped in GH-69).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | New-project inception mode selection | The agent must deterministically route a new/idea project into the 8-phase inception flow while keeping the legacy path reachable (AC1, AC17). |
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
| F-16 | Legacy-mode preservation | The existing flow and its state schema must continue to work unchanged (AC16). |

### 5.1 Capability Details

- **F-1 (Mode selection):** On invocation the agent inspects the repository/idea and selects `new` (empty repo or greenfield idea) or `legacy` (existing code/history), mirroring the guide's Phase 0 flow decision. Legacy selection routes to the unchanged 6-phase flow; `new` routes to phases 0–7. Ambiguous cases surface a clarifying question rather than guessing.
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
- **F-13 (State & resume):** Inception state is a committed file instantiated from `inception-state-template.yaml`. On a fresh invocation the agent reads it, determines the last incomplete phase, and resumes with state + prior artifacts as context.
- **F-14 (Anti-sycophancy):** The decision-dense phases run adversarial prompts before their gates: devil's advocate (1), pre-mortem (2 & 3), alternative comparison (3), unknown-unknowns (4), and the four-risk check (1, 2, 3). Phases 0, 5, 6, 7 carry none.
- **F-15 (Phase 5 outputs):** Phase 5 generates `AGENTS.md` plus all four `.ai/agent/*-instructions.md` (pm, pr, decision, code-review), sets the documentation profile, and installs handbook/templates/decisions. `code-review-instructions.md` is generated from the GH-69 blueprint and is a net-new addition vs. legacy.
- **F-16 (Legacy parity):** The legacy 6-phase section, its state schema, and its resume behavior remain functionally identical. The inception additions are organized as a parallel sub-mode so the legacy content is untouched.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — New-project inception (high level)
  Human invokes /bootstrap in an empty/greenfield repo
  → Agent enters Phase 0: detects mode=new, classifies repo profile,
    detects 4 characteristics, scans inputs/, builds material inventory
  → HUMAN GATE 0 (confirm flow, profile, characteristics, inventory)
  → Phases 1–4 each: produce draft → run anti-sycophancy → HUMAN GATE
    (P1 devil's advocate; P2 pre-mortem + four-risk; P3 alt-comparison + pre-mortem; P4 unknown-unknowns)
  → Phase 5: generate AGENTS.md + 4 instruction files + profile + handbook/templates/decisions → HUMAN GATE
  → Phase 6: readiness check → PASS proceeds / FAIL reopens an earlier phase (1–4) → HUMAN GATE
  → Phase 7: inception summary + initial feature specs → FINAL SIGN-OFF
  → State committed at doc/inception/inception-state.yaml after each gate.

Flow 2 — Resume across sessions
  Human invokes /bootstrap again (or after conversation compaction)
  → Agent reads doc/inception/inception-state.yaml
  → Determines last incomplete phase from state alone
  → Restores state + prior artifacts as context, resumes at that phase.

Flow 3 — Legacy (unchanged)
  Human invokes /bootstrap in an existing repo
  → Agent selects mode=legacy → runs the existing 6-phase flow
    using .ai/local/bootstrapper-context.yaml → unchanged behavior.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- A new `mode: new` inception sub-mode in `@bootstrapper` implementing phases 0–7.
- Phase 0 mode selection, characteristics detection, and material inventory.
- Phases 1–7 enriched artifacts (north star, OST/PRD, roadmap, registers, UX artifacts, tech/architecture/FSE audit, glossary/ubiquitous language, UX guidance, quality baseline, framework integration, readiness check, summary + feature specs).
- Repo-persistent inception state + resume.
- Per-phase human gates with Phase-6 reopen.
- Embedded anti-sycophancy (5 technique→phase mappings).
- Phase-5 generation of all four instruction files, including `code-review-instructions.md`.
- Write-allowlist additions for `doc/inception/**` (incl. `doc/inception/abandoned-<ISO>.yaml` for archived abandoned runs per DEC-6) and `.ai/agent/code-review-instructions.md`.
- Additive update to the `bootstrapper` one-line description in `AGENTS.md`.
- Regeneration of the Claude Code plugin counterpart (committed alongside the source, per the multi-tool rule).

### 7.2 Out of Scope

- [OUT] Legacy-flow repo ingestion, behavioral-spec extraction, tribal-knowledge graduation (→ GH-72).
- [OUT] Layered technical planning beyond Phase 3 outputs (→ GH-68).
- [OUT] Self-hosting ADOS via inception (→ GH-70).
- [OUT] Conducting user research, experiments, or prototyping.
- [OUT] Authoring `doc/guides/project-inception.md` from scratch (reference only; amend solely on concrete gaps).
- [OUT] New inception templates (all shipped in GH-69).
- [OUT] Any change to legacy flow behavior or its state schema.

### 7.3 Deferred / Maybe-Later

- Reusing this workflow infrastructure for the legacy flow (GH-72, inception:3).
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
| DM-1 | `doc/inception/inception-state.yaml` | New committed state file instantiated from `inception-state-template.yaml`. Holds `schema_version`, `project` (name, `flow`, `profile`, `characteristics`), `phases[]` (id/name/status/timestamps), `artifacts{}` (status/path/confidence), `decisions[]`, `assumptions[]` (risk_type + validation_status), `sessions[]`, `last_updated`. |
| DM-2 | `project.flow` + `project.characteristics` | `flow ∈ {new, legacy}` selects the sub-mode; the four booleans (`ui_bearing`, `multi_user`, `complex_domain`, `code_project`) drive conditional artifacts. |
| DM-3 | `assumptions[]` | Each entry carries `risk_type ∈ {value, usability, feasibility, viability}` and `validation_status ∈ {unvalidated, testing, validated, invalidated}` — the four-risk tagging backbone. |
| DM-4 | Bootstrapper "mode" concept | A mode dimension (`new` vs `legacy`) is introduced across the agent. Inception mode uses the committed state (DM-1); legacy mode continues to use its existing git-ignored context schema, unchanged. |

### 8.4 External Integrations

N/A — no new external APIs or services. The agent may use existing MCP/CLI access (e.g., tracker, PR platform) only where Phase 5 framework-integration already defines it; nothing new is introduced.

### 8.5 Backward Compatibility

- The legacy 6-phase flow, its state schema, and its resume behavior are **unchanged** (F-16). Existing projects bootstrapped via GH-32 are unaffected.
- The new inception mode is **additive**: it adds a parallel sub-mode, new committed-state file, and new allowlist entries; it does not alter legacy outputs.
- The `AGENTS.md` one-line description edit is additive (capabilities grow; nothing is removed).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Mode-selection determinism | Empty repo / greenfield idea → `new`; existing code or git history → `legacy`; ambiguous cases must surface a question, never silently guess (0 silent guesses). |
| NFR-2 | Resume correctness | On a fresh invocation, the last incomplete phase is determinable from `doc/inception/inception-state.yaml` alone (single-file read, no reliance on in-memory conversation state). |
| NFR-3 | Prompt maintainability | The inception sub-mode references the guide for human-readable detail and does not duplicate its prose; the agent file remains structured as frontmatter + well-formed sections (no malformed tags). |
| NFR-4 | Legacy behavioral parity | 100% — the legacy section text, phase tags, state schema, and resume behavior are byte-for-behavior equivalent to pre-change; legacy state path and git-ignore status unchanged. |
| NFR-5 | Guide/prompt consistency | The agent prompt and the guide must not contradict; the prompt names the guide as the human-readable authority. 0 known contradictions at delivery. |
| NFR-6 | State-file safety | The committed inception state must never contain secrets, tokens, or credentials (same security constraint as the legacy context file). |
| NFR-7 | Write-safety | Inception writes are confined to the allowlist; any write outside it requires explicit human confirmation with a warning. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — agents are prompt definitions without runtime telemetry. Observability is structural: the committed `doc/inception/inception-state.yaml` itself is the progress/observability artifact (phase statuses, confidence scores, decisions, sessions), reviewed by humans at each gate.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Prompt bloat degrades agent instruction-following (the file is already large) | H | M | Organize inception as a parallel sub-mode; reference the guide instead of duplicating prose; keep agent instructions terse; delegate prompt authoring to `@toolsmith` | M |
| RSK-2 | Most AC are behavioral agent-capability claims untestable in CI | M | H | Combine static/structural checks (allowlist entries, all-four instruction files referenced, legacy section intact, guide referenced) with a manual verification matrix in the test plan | M |
| RSK-3 | Mode-selection ambiguity causes wrong-flow routing | M | M | Explicit decision tree mirroring the guide's Phase 0 diagram; ambiguous cases ask the human (NFR-1) | L |
| RSK-4 | Two state files (git-ignored legacy vs committed inception) confuse the agent | M | M | Explicit per-mode state-file rule in the prompt; legacy uses its existing path unchanged; inception uses only the committed path | L |
| RSK-5 | Drift between the guide (human authority) and the prompt (agent authority) | M | M | Prompt references the guide; both updated together if a concrete gap is found; NFR-5 forbids contradictions | L |
| RSK-6 | Editing the agent regresses the legacy flow | H | L | Preserve the legacy section unchanged; add a legacy-parity structural check (NFR-4) | L |
| RSK-7 | Generated Claude-plugin counterpart goes stale (multi-tool rule) | M | M | Regenerate via `scripts/build-claude-plugin.sh` and commit source + generated together; CI verifies freshness | L |

## 12. ASSUMPTIONS

- GH-69 deliverables (guide, workspace skeleton, `inception-state-template.yaml`, inception templates, `code-review-instructions--example.md` blueprint) are present and stable — verified present at authoring time.
- The `@toolsmith` agent is the correct delegate for editing `.opencode/agent/bootstrapper.md` (hard rule in `AGENTS.md` "Extending the system").
- `doc/guides/project-inception.md` is the human authority and is accurate; the agent mirrors, not replaces, it.
- Inception is run by a human who will attend each gate; the agent does not auto-advance phases.
- The four-risk framework values are fixed: Value, Usability, Feasibility, Viability.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-69 | Templates, `doc/inception/` workspace, `inception-state-template.yaml`, `doc/guides/project-inception.md`, `code-review-instructions--example.md` blueprint — VERIFIED PRESENT. |
| Depends on | GH-52 | `documentation-profile.md` classification used in Phase 5. |
| Depends on | `@toolsmith` | Required delegate for editing the agent prompt (repo hard rule). |
| Depends on | `scripts/build-claude-plugin.sh` | Regenerates the `.ados-claude` counterpart; source + generated committed together. |
| Blocks | GH-72 (inception:3) | Will reuse this workflow infrastructure for the legacy flow. |
| Relates | GH-70 (capstone) | Self-hosting consumes this capability. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the inception sub-mode live as discrete `<phase_*>` sections inside `bootstrapper.md`, or as a separate referenced structure, to best manage prompt size? | The file is already large; structure choice affects maintainability and the `@toolsmith` hand-off. | **Resolved → DEC-7 / TDR-0001** (nested phase sections under a `<mode_new_project_inception>` umbrella, parallel to legacy). |
| OQ-2 | What is the bar for amending `doc/guides/project-inception.md` vs recording the gap as deferred? | The change may amend the guide only on concrete gaps; the threshold was undefined. | **Resolved → DEC-5** (amend only on concrete AND blocking gaps). |
| OQ-3 | How is mode (`new` vs `legacy`) persisted/selected when a project has a partial `doc/inception/inception-state.yaml` from a prior abandoned run? | Edge case for resume correctness (NFR-2). | **Resolved → DEC-6** (`project.flow` is the resume source of truth; abandoned state archived, never silently destroyed). |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Inception state is committed (`doc/inception/inception-state.yaml`); legacy state stays git-ignored. | A multi-day, team-visible process needs to be committed and resumable; legacy single-machine flow should not change behavior. | 2026-06-26 |
| DEC-2 | The agent references the guide rather than recreating it. | Avoids two divergent authorities; the guide (GH-69) is the human-readable source of truth. | 2026-06-26 |
| DEC-3 | Phase 5 generates all four instruction files including `code-review-instructions.md`. | Closes the GH-32 gap; the reviewer agent needs a project-local override file; the blueprint already exists (GH-69). | 2026-06-26 |
| DEC-4 | Editing the agent prompt is delegated to `@toolsmith`. | Hard rule in `AGENTS.md` "Extending the system". | 2026-06-26 |
| DEC-5 | Guide-amendment threshold: amend `doc/guides/project-inception.md` in-repo only when a gap is **concrete AND blocking** — a prompt↔guide contradiction (NFR-5), a failing AC/NFR, a factual error (wrong path/phase-mapping/anti-sycophancy assignment), or a ghost reference. Everything else (clarity, completeness, enhancement) is recorded as deferred, not amended here. Amendments are surgical, preserve `ados_distribution`, and co-update prompt+guide. | Scope discipline — the guide just shipped in GH-69; this change must not rewrite it but must not ship a real contradiction. Resolves OQ-2. | 2026-06-26 |
| DEC-6 | Resume mode selection: `project.flow` in `doc/inception/inception-state.yaml` is the source of truth on resume. Valid in-progress → resume at that flow (no repo-shape re-derivation; the Phase-0 human gate is where the human may confirm or archive-and-restart). All phases completed → "already incepted". Malformed / `schema_version` mismatch → warn + offer repair or archive-and-restart (mirrors the legacy version-mismatch handling). Abandoned-run state is archived to `doc/inception/abandoned-<ISO>.yaml` (added to the write allowlist), never silently overwritten. Legacy is unaffected (separate git-ignored state file). | NFR-2 resume correctness + 0 silent guesses; `project.flow` already exists in the schema so determinism falls out naturally. Resolves OQ-3. | 2026-06-26 |
| DEC-7 | Inception sub-mode prompt structure: organize as eight terse `<phase_N_inception>` sections nested under one `<mode_new_project_inception>` umbrella, parallel to the legacy `<workflow_phases>` block, with a `<mode_selection>` router and additive `<resume_behavior>`/`<write_allowlist>` extensions. Operational control flow stays inline (self-contained-agent principle); content detail is referenced from the guide (not duplicated). | Resolves OQ-1; recorded in detail in TDR-0001 (R2, acceptance at GH-71 PR). | 2026-06-26 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `@bootstrapper` agent definition (OpenCode source) | Updated — new inception sub-mode added; legacy section unchanged |
| `@bootstrapper` Claude Code plugin counterpart | Updated — regenerated artifact (source + generated committed together) |
| `doc/guides/project-inception.md` | Possibly amended — only if a concrete gap is proven; `ados_distribution` preserved |
| `AGENTS.md` (bootstrapper one-line description) | Updated — additive capability description |
| `doc/inception/inception-state.yaml` | New — committed state file (instantiated per project at runtime; no live instance ships in this repo) |
| Change artifacts (this folder) | New — spec, plan, test-plan, pm-notes |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion (Given / When / Then) | Linked |
|----|----------------------------------|--------|
| AC1 | **Given** `@bootstrapper` is invoked, **when** Phase 0 evaluates an empty repo or greenfield idea, **then** it selects `mode: new` and enters the 8-phase inception flow, while existing-code repos still route to the legacy flow. | F-1, NFR-1 |
| AC2 | **Given** Phase 0 runs in `mode: new`, **when** it inspects the project, **then** it detects the four characteristics (UI-bearing, multi-user, complex domain, code project) and activates exactly the matching conditional artifacts. | F-2, DM-2 |
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
| AC13 | **Given** an inception is in progress, **when** the agent is re-invoked in a fresh session, **then** it reads the committed `doc/inception/inception-state.yaml`, determines the last incomplete phase, and resumes from there. | F-13, NFR-2, DM-1 |
| AC14 | **Given** the decision-dense phases run, **when** each reaches its pre-gate step, **then** the correct anti-sycophancy technique executes (devil's advocate→1; pre-mortem→2&3; alt comparison→3; unknown-unknowns→4; four-risk→1/2/3) and phases 0/5/6/7 carry none. | F-14 |
| AC15 | **Given** Phase 5 completes, **when** framework files are generated, **then** all four `.ai/agent/*-instructions.md` exist (pm, pr, decision, AND code-review). | F-15 |
| AC16 | **Given** the legacy path is selected, **when** `@bootstrapper` runs, **then** the legacy 6-phase flow and its git-ignored state file behave exactly as before this change. | F-16, NFR-4 |
| AC17 | **Given** the inception sub-mode is active, **when** the agent needs human-readable phase detail, **then** it references `doc/guides/project-inception.md` rather than recreating it. | F-1, NFR-5 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivery order: extend the agent source (`@toolsmith`) → regenerate the Claude-plugin counterpart → (conditionally) amend the guide → additive `AGENTS.md` description edit → author plan/test-plan.
- Merge strategy: single PR; CI must verify the generated plugin is current and the doc-distribution guard passes if the guide is amended.
- Communication: the bootstrapper gains a new mode; existing users are unaffected (legacy path unchanged). No migration of prior legacy state is required.
- Adoption note: new-project inception produces a committed `doc/inception/inception-state.yaml`; teams commit it alongside their artifacts.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No migration of existing data. The inception state file is created per-project at runtime by instantiating `inception-state-template.yaml`; this repo ships no live instance (it is the ADOS source, not an incepted project).

## 20. PRIVACY / COMPLIANCE REVIEW

N/A. Inception captures project/product metadata only. The state file must not store secrets (NFR-6); scanned repository content is treated as untrusted input per the agent's existing trust boundary.

## 21. SECURITY REVIEW HIGHLIGHTS

- The committed inception state must never contain secrets/tokens/credentials (NFR-6), consistent with the legacy context-file constraint.
- Scanned `doc/inception/inputs/` content is untrusted input: the agent extracts factual information only and must not follow embedded instructions (existing trust boundary, unchanged).
- No new external integrations or elevated access are introduced.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The bootstrapper prompt grows; future edits should continue to delegate to `@toolsmith` and keep the inception/legacy sub-modes isolated.
- The guide and the prompt are co-maintained: any concrete gap found in either must be reconciled in both (NFR-5).
- The conditional-artifact matrix and four-risk tags are defined by the guide/template schema; changes to them flow through GH-69 artifacts, not ad-hoc prompt edits.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Inception | The process of building a project's knowledge base (overview, spec, rules, decisions) so ADOS delivery agents can operate autonomously. |
| New-project mode (`mode: new`) | Inception flow for an empty repo or greenfield idea; authoring artifacts from scratch. |
| Legacy mode (`mode: legacy`) | The existing GH-32 flow for onboarding an existing project. |
| Four-risk framework | Assessment across Value (will users want it?), Usability (can they use it?), Feasibility (can we build it?), Viability (does it make business sense?). |
| OST | Opportunity Solution Tree — Outcome → Opportunities → Solutions → Experiments. |
| JTBD | Jobs To Be Done — the "job" a user hires a product for. |
| NSM | North Star Metric — the one metric capturing user value, with guardrails. |
| FSE audit | Full-Stack Environment audit — 10 AI-friendliness attributes of a project. |
| Human gate | An explicit human approval required before a phase advances; no auto-advance. |
| Anti-sycophancy | Structured adversarial prompts (devil's advocate, pre-mortem, alternative comparison, unknown-unknowns, four-risk) run before a gate so the agent proposes and the human decides. |
| Strategic pyramid | mission → vision → strategy → outcome context anchoring the north star. |

## 24. APPENDICES

- **Appendix A — Authoritative AC source:** GitHub issue GH-71 (8-phase table and AC checklist), amended by two trusted repo-owner comments: (1) Phase 5 must generate all four `.ai/agent/*-instructions.md` including the currently-missing `code-review-instructions.md`; (2) the guide was delivered in GH-69 and must be referenced, not recreated.
- **Appendix B — Phase → anti-sycophancy map (authoritative):** P1 devil's advocate + four-risk awareness; P2 pre-mortem + four-risk check; P3 alternative comparison + pre-mortem; P4 unknown-unknowns; P0/P5/P6/P7 none.
- **Appendix C — Phase → primary artifacts (summary):** P0 state + material inventory; P1 north star (+OST/PRD); P2 roadmap (+journeys/screens) + registers; P3 tech/architecture/FSE audit + ADRs (+NFRs); P4 glossary (+ubiquitous language/UX guidance) + testing/CI/dev-env; P5 AGENTS.md + 4 instruction files + profile + handbook/templates/decisions; P6 readiness report; P7 inception summary + feature specs.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-26 | Juliusz Ćwiąkalski | Initial specification |

---

## AUTHORING GUIDELINES

- **Sources:** GitHub issue GH-71 (authoritative AC + 8-phase table); two trusted repo-owner comment amendments (all-four instruction files; reference-not-recreate the guide); `doc/guides/project-inception.md` (GH-69, human authority); `.opencode/agent/bootstrapper.md` (existing legacy flow + state schema + write allowlist); `doc/templates/inception-state-template.yaml` (state schema); `doc/inception/README.md` (workspace); `doc/templates/blueprints/code-review-instructions--example.md` (Phase-5 blueprint); `AGENTS.md` (Extending the system, Multi-tool support, License headers). Gitignored research notes were used only as design input and are NOT referenced in this committed artifact.
- **Approach:** WHAT/WHY only — problem, goals, functional capabilities, contracts, NFRs, risks, AC. No implementation tasks, no step-by-step edits, no low-level code paths. Committed paths are referenced at the artifact/contract level (state file, instruction files, guide, templates) because they are the deliverables and interfaces; no gitignored `.ai/local/` paths appear.
- **Constraints:** AC numbered AC1–AC17 for 1:1 traceability to the ticket checklist; each uses Given/When/Then and references at least one F-/NFR-/DM- ID. NFRs are quantified. Risks carry Impact and Probability. Mode determinism, resume correctness, and legacy parity are called out as measurable NFRs.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-71)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability
- [x] No implementation details (no step-by-step tasks, no low-level code edits)
- [x] No content duplicated from linked docs (guide is referenced, not copied)
- [x] Front matter validates per front_matter_rules
