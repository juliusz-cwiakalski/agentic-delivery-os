---
ados_distribution: project-generated
id: CHG-GH-57
links:
  decisions: ["ADR-0002"]
  related: ["GH-43", "GH-49"]
change:
  ref: GH-57
  type: feat
  status: Proposed
  slug: readiness-gate
  title: "Add Definition of Ready gate (@readiness-reviewer) to validate change artifacts before delivery"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-lifecycle
  labels: ["readiness-gate", "definition-of-ready", "dor", "agent", "lifecycle", "meta"]
  version_impact: minor
  audience: internal
  security_impact: none
  risk_level: high
  dependencies:
    internal: ["pm-agent", "change-lifecycle-guide", "reviewer-agent", "spec-writer", "test-plan-writer", "plan-writer", "agents-md", "opencode-readme", "decisions-register", "build-claude-plugin"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Insert a **Definition of Ready (DoR) gate** (`dor_check`) between `delivery_planning` and `delivery` so every change's spec, test-plan, and plan are critiqued together against the source ticket — by an adversarial reviewer independent of their authors — before a single line of implementation is written, catching the gaps that otherwise compound across the whole downstream build.

## 1. SUMMARY

This change adds a pre-delivery readiness gate to ADOS's delivery workflow. It introduces one new agent (`@readiness-reviewer`), one new command (`/check-readiness`), and one new lifecycle phase (`dor_check`, inserted as phase 5). The gate takes the complete artifact set (spec + test-plan + plan) plus the source ticket and applies a structured, multi-facet Definition of Ready under an **adversarial/critical stance** — the single highest-leverage checkpoint, because a flaw caught here saves the entire downstream implementation cost rather than being discovered post-delivery.

The gate complements — and is deliberately distinct from — the existing post-implementation `@reviewer` (Definition of Done). `@reviewer` audits **code vs spec/plan** (post-impl, diffs); `@readiness-reviewer` audits **artifacts vs ticket** (pre-impl, no code yet). Different inputs, timing, and mental model. It is a focused, additive meta-change to ADOS itself: the authoritative DoR lives in the new agent prompt; a redistributable guide mirrors it; the PM workflow gains a hard gate with an explicit, recorded override for genuinely trivial changes; and `doc/guides/change-lifecycle.md`, `AGENTS.md`, the `.opencode` inventory, and `@pm` are renumbered to an 11-phase flow. The design is recorded as **ADR-0002** (status Proposed; acceptance rides the GH-57 PR).

## 2. CONTEXT

### 2.1 Current State Snapshot

- The delivery workflow is a PM-orchestrated, 10-phase pipeline (`doc/guides/change-lifecycle.md`): `clarify_scope` → `specification` (`@spec-writer`) → `test_planning` (`@test-plan-writer`) → `delivery_planning` (`@plan-writer`) → `delivery` (`@coder`) → `system_spec_update` → `review_fix` → `quality_gates` → `dod_check` → `pr_creation`.
- Artifact-creation phases (1–4) hand their outputs straight to `@coder` at phase 5 with **no independent critique** between plan authoring and implementation.
- `@reviewer` (phase 7) is the only structured review agent. It audits **implementation against spec/plan** (the Definition of Done): it reads diffs, runs post-implementation, and may append remediation phases. It does **not** critique the artifacts themselves pre-implementation.
- `@pm` already supports phase reopening (a phase can be reopened when a later phase discovers gaps) and already routes decision-requiring situations to `@decision-advisor`; decision records live in `doc/decisions/**` per `doc/guides/decision-records-management.md`.
- The structural precedent for a unified review agent is `@reviewer` itself (GH-36 merged a separate `code-reviewer` into one `@reviewer` for the same cross-artifact-consistency reason), which uses `claude.model: opus` in frontmatter and a strong adversarial `built_in_heuristics` block — the house style the new agent mirrors.
- Agent/command definitions are the product and are co-maintained as `.opencode/` source + a generated `.ados-claude/` plugin (committed together; CI enforces freshness via `scripts/build-claude-plugin.sh`). Editing them is delegated to `@toolsmith` (hard rule in `AGENTS.md` "Extending the system").

### 2.2 Pain Points / Gaps

- **No pre-delivery critique of the artifacts themselves.** The highest-leverage artifacts (spec/plan/test-plan) are produced by `@spec-writer`/`@test-plan-writer`/`@plan-writer` and consumed by `@coder` with zero independent review. A gap in the spec compounds across every implementation task built on it.
- **AI sycophancy is unopposed at the highest-leverage point.** Agents tend toward confidently producing plausible-but-incomplete artifacts; with no adversarial gate, gaps reach `@coder` and surface only at `@reviewer` (phase 7) — after the entire implementation is written.
- **No formal Definition of Ready.** "Is this ready to build?" is judged ad hoc. There is no checklist enforcing spec completeness, AC testability/non-overlap, plan coverage of every AC, test-plan traceability to every AC, cross-artifact consistency, or decision capture.
- **DoR vs DoD are conflated by absence.** The single review checkpoint (`@reviewer`) is a Definition of Done; there is no Definition-of-Ready pair, so the question "are the *artifacts* right?" is never asked before code exists.
- **Decision capture timing is implicit.** Decisions may surface during specification but there is no dedicated gate that routes them: change-scoped decisions to change docs, system-wide/precedent-setting decisions to decision records.

> **Inherited structural decision (lifecycle numbering).** The cleanest insertion is to add `dor_check` as the **new phase 5** and renumber the existing 5–10 to **6–11**. This is a PM-level structural decision recorded in the spec and referenced by **ADR-0002**; it is adopted here, not re-debated.

## 3. PROBLEM STATEMENT

Because the artifact-creation phases hand the spec, test-plan, and plan straight to `@coder` with no independent, adversarial critique, flaws in those high-leverage artifacts go undetected until after the entire implementation is written — where they are most expensive to fix — and there is no Definition of Ready gate to catch completeness gaps, untestable/overlapping acceptance criteria, missing AC coverage, cross-artifact inconsistency, or uncaptured decisions before they multiply across delivery.

## 4. GOALS

- **G-1**: Insert a readiness gate (`dor_check`, new phase 5) between `delivery_planning` and `delivery` that reviews all change artifacts together against the source ticket, before implementation begins.
- **G-2**: Define a formal Definition of Ready as a structured, multi-facet checklist — authoritative in the `@readiness-reviewer` prompt, mirrored in a redistributable guide that states the prompt is authoritative.
- **G-3**: Counter sycophancy via an adversarial/critical review stance carried by an agent independent of the artifact authors.
- **G-4**: Make the gate the point where key decisions are captured and routed: change-scoped → change docs; system-wide/precedent-setting → decision records (`doc/decisions/**`), pausing for human input where needed.
- **G-5**: Make the gate a hard block by default with an explicit, recorded override for genuinely trivial changes (no silent skip), keeping humans in the loop for decisions and blocking gaps.
- **G-6**: Preserve the post-implementation `@reviewer` (Definition of Done) unchanged in role; keep the two gates clearly distinct (artifacts-vs-ticket vs code-vs-spec).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Pre-delivery gate | Exactly 1 new phase `dor_check` between `delivery_planning` and `delivery`; 0 changes to the DoD role of `@reviewer` |
| Lifecycle phases | 11 total after delivery; existing 5–10 renumbered to 6–11 with 0 stale phase-number references across all touched surfaces |
| DoR facets reviewed | Every gate run evaluates all DoR facets (DM-3) against the artifact set + ticket |
| Stance | `@readiness-reviewer` encodes an adversarial/critical stance and is independent of `@spec-writer`/`@test-plan-writer`/`@plan-writer` |
| Override discipline | 0 silent-skip paths; every override is an explicit, recorded approval (DM-4) |
| DoR source-of-truth | Prompt is authoritative; guide mirror states so with 0 contradictions (NFR-2) |
| Redistributable guide | `doc/guides/definition-of-ready.md` declares `ados_distribution: redistributable` and passes the CI doc-distribution guard |

### 4.2 Non-Goals

- **NG-1**: Replacing or duplicating the post-implementation `@reviewer` (Definition of Done, phase 7→8). The DoR gate is pre-delivery; the DoD gate is post-implementation.
- **NG-2**: Blocking on style/formatting nitpicks — the gate focuses on completeness, cross-artifact consistency, AC coverage, and decision capture.
- **NG-3**: A deterministic mechanical readiness pre-check command (`ados check-readiness`, issue **#49**) — explicitly OUT OF SCOPE; it is a future complement, not a dependency (DEC-6).
- **NG-4**: Post-delivery retrospectives (GH-43) — complementary but post-delivery; the DoR gate is pre-delivery.
- **NG-5**: Deepening or altering the existing artifact-creator agents (`@spec-writer`/`@test-plan-writer`/`@plan-writer`) beyond the one-line DoR cross-reference note (RT1-MAJOR-03).
- **NG-6**: Re-debating the resolved structural decisions (single critic, new agent, model tier, hard-gate+override, DoR location, ADR-0002) — fixed by the ticket + comment #1, recorded in §15.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Definition of Ready (authoritative prompt + redistributable mirror guide) | The checklist is the gate's enforcement basis; prompt-as-source-of-truth avoids drift over which is authoritative (AC1, DEC-5). |
| F-2 | Readiness gate `dor_check` (holistic cross-artifact review vs ticket) | The single highest-leverage checkpoint: review spec + test-plan + plan together against the ticket, pre-implementation (AC2, AC10). |
| F-3 | Adversarial/critical independent review stance | Counters the sycophancy that lets gaps reach `@coder`; carried by an agent distinct from the artifact authors (AC3). |
| F-4 | Gap-driven reopening of artifact-creation phases | A DoR gap is an artifact problem, not a code problem — reopen `specification`/`test_planning`/`delivery_planning`, never `delivery` (AC4). |
| F-5 | Decision capture & human-in-the-loop pause | Route change-scoped decisions to change docs and system-wide ones to decision records; pause for human confirmation where needed (AC5, AC7). |
| F-6 | Hard-gate-by-default + explicit recorded override | No silent skip — the override forces a conscious, recorded decision so the anti-sycophancy mechanism survives (AC6). |
| F-7 | Workflow integration & DoR/DoD role separation | Wire the new phase/agent/command into the 11-phase flow across all surfaces while keeping the post-impl `@reviewer` purely DoD (AC8, AC9). |

### 5.1 Capability Details

- **F-1 (Definition of Ready):** The DoR is a structured, multi-facet checklist. The **authoritative** copy lives in the `@readiness-reviewer` prompt (DoR is enforced behavior, so it belongs in the prompt — same principle by which `@reviewer` keeps its core heuristics in-prompt). `doc/guides/definition-of-ready.md` is a human-readable **mirror** that explicitly states the prompt is authoritative. Repo-local `.ai/agent/readiness-instructions.md` extensions are **deferred** (YAGNI). The DoR facets (DM-3) cover: spec completeness vs ticket; AC clarity/testability/non-overlap; plan coverage of all requirements and all AC, check-listable; test-plan traceability to every AC; cross-artifact consistency (ticket → spec → test-plan → plan); decision capture in the right place.
- **F-2 (Readiness gate):** `dor_check` runs after `delivery_planning` and before `delivery`. `@pm` delegates to `@readiness-reviewer`, which loads the artifact set (spec, test-plan, plan) and the source ticket, applies all DoR facets holistically, and emits a gate verdict (`READY` / `NOT_READY`) with per-facet findings. The holistic single-pass design exists precisely because **cross-artifact consistency** is the highest-value check and needs one view of the whole set.
- **F-3 (Adversarial/critical stance):** `@readiness-reviewer` operates independently of `@spec-writer`/`@test-plan-writer`/`@plan-writer` (distinct agent, distinct invocation). Its prompt encodes an adversarial posture: actively seek gaps, contradictions, and unstated assumptions; do not rubber-stamp; treat plausibility as a reason to probe, not to pass. This is the structural counter to AI sycophancy at the highest-leverage point.
- **F-4 (Gap-driven reopening):** When the verdict is `NOT_READY`, `@pm` reopens the **relevant artifact-creation phase** (`specification`, `test_planning`, or `delivery_planning`) and re-delegates to the matching author agent — never `delivery`. After the artifact is corrected, the gate is re-run until `READY` (capped iterations; escalate to human on stalemate).
- **F-5 (Decision capture):** The gate is the capture point for decisions surfaced by the artifacts. **Change-scoped** decisions are recorded in change docs (pm-notes/spec); **system-wide or precedent-setting** decisions are proposed as decision records under `doc/decisions/**` (per `doc/guides/decision-records-management.md`). When a decision needs human input, the workflow **pauses** (STOP and wait) — humans stay in the loop for decisions and blocking gaps.
- **F-6 (Hard gate + override):** The gate blocks delivery by default. For genuinely trivial changes, an **explicit, recorded override** is allowed (DM-4): the override records the workItemRef, the triviality rationale, the human approver, and the date. There is **no unconditional/silent skip** — a silent skip reintroduces the sycophancy this gate exists to prevent (agents would always judge their own work "trivial"). A "genuinely trivial" change = one with no behavioral or spec impact and no cross-artifact consistency risk (e.g., a docs typo fix, a comment-only edit, or a dependency bump with no contract change). The override is NOT available for changes that add/alter behavior, touch contracts, or modify the delivery workflow itself (RT1-MINOR-05).
- **F-7 (Integration & role separation):** `dor_check` becomes phase 5; existing 5–10 renumber to 6–11. The new agent (`@readiness-reviewer`), command (`/check-readiness`), and phase are reflected in `doc/guides/change-lifecycle.md` (incl. the mermaid diagram, agent-responsibility table, phase-reopening table), `AGENTS.md` (phase table, agent table, command table, manual sequence), `.opencode/README.md` inventory, and `@pm`'s workflow + PM-notes phase map. The post-implementation `@reviewer` (now phase 8) is **unchanged in role** — it remains the Definition of Done (code-vs-spec, post-implementation).

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Updated artifact→delivery flow with the dor_check gate inserted
  clarify_scope (1) → specification (2, @spec-writer) → test_planning (3,
  @test-plan-writer) → delivery_planning (4, @plan-writer)
  → dor_check (5, @readiness-reviewer) — load spec + test-plan + plan +
     source ticket → apply all DoR facets holistically → emit verdict
     ├─ READY → delivery (6, @coder) → system_spec_update (7) →
     │         review_fix (8, @reviewer/DoD) → quality_gates (9) →
     │         dod_check (10) → pr_creation (11)
     └─ NOT_READY → Flow 2 (reopen an artifact phase)

Flow 2 — Gap-driven reopening (NOT_READY → artifact phase, never delivery)
  dor_check finds a DoR gap (e.g., test-plan does not trace to AC-x) →
  @pm reopens the relevant artifact phase (specification | test_planning |
  delivery_planning) → re-delegate to the matching author agent → correct
  artifact → re-run dor_check until READY (cap iterations; escalate on
  stalemate). delivery (6) is never the target of a DoR reopening.

Flow 3 — Decision capture at the gate
  dor_check identifies a decision → classify scope:
  ├─ change-scoped → record in change docs (pm-notes / spec) → continue
  └─ system-wide / precedent-setting → propose a decision record under
     doc/decisions/** (delegate to @decision-advisor) → if the decision
     needs human input → STOP and wait for confirmation → resume.

Flow 4 — Trivial-change override (explicit + recorded)
  @pm judges the change genuinely trivial → request override → human
  approves → record override (workItemRef, rationale, approver, date) in
  change docs → dor_check is bypassed for THIS change only → delivery (6)
  proceeds. No silent skip path exists; an override always leaves a record.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- **(A) New agent** `.opencode/agent/readiness-reviewer.md` — the `@readiness-reviewer` prompt. It carries the **authoritative** Definition of Ready, the adversarial/critical stance, independence from author agents, the gate verdict format, and the hard-gate + recorded-override behavior. Model tier (`claude.model: opus`) is set in frontmatter, not the prompt body (mirrors `@reviewer`, DEC-3). **Authored by delegating to `@toolsmith`** (repo hard rule); this spec treats it as a constraint, not a spec-level edit.
- **(B) New command** `.opencode/command/check-readiness.md` — the `/check-readiness` command (the DoR pair of `/review`). **Authored via `@toolsmith`.**
- **(C) New redistributable guide** `doc/guides/definition-of-ready.md` — the human-readable **mirror** of the DoR; states the prompt is authoritative; declares `ados_distribution: redistributable`. Referenced from `doc/guides/change-lifecycle.md`.
- **(D) Lifecycle modification** `doc/guides/change-lifecycle.md` — insert `dor_check` as phase 5; renumber existing 5–10 to 6–11; update the mermaid diagram, agent-responsibility table, phase-reopening table, and PM-notes phase map; reference the DoR guide. `ados_distribution: redistributable` preserved.
- **(E) PM workflow modification** `.opencode/agent/pm.md` — add the `dor_check` step between `delivery_planning` and `delivery`; add the DoR reopening logic (gaps reopen an artifact phase, not delivery); add the decision-capture routing + human pause; add the `phases.dor_check` entry to the PM-notes structure. **Authored via `@toolsmith`.**
- **(F) Inventory + manifest updates** — `AGENTS.md` (phase table → 11 phases; agent table add `readiness-reviewer`; command table add `/check-readiness`; "Using the system" manual sequence) and `.opencode/README.md` (agent + command inventory). `.ai/agent/pm-instructions.md` reviewed for workflow-state-mapping relevance (apply only if it enumerates phase transitions).
- **(G) Decision record** `doc/decisions/ADR-0002-readiness-gate-definition-of-ready.md` (status **Proposed**, rigor R2) capturing the precedent-setting workflow-structure change, plus an `ADR-0002` row in `doc/decisions/00-index.md`. Acceptance rides the GH-57 PR. (The ADR itself is produced via the decision workflow, not authored at spec time.)
- **(H) Regeneration** of the `.ados-claude/` plugin via `scripts/build-claude-plugin.sh` after the `.opencode/` changes; source + generated committed together.
- Minimal cross-reference notes in affected artifact-creator agents: a one-line DoR cross-reference note in each affected artifact-creator agent (`@spec-writer`/`@test-plan-writer`/`@plan-writer`) via `@toolsmith` (RT1-MAJOR-03 — makes AC8 literally true). Supersedes the earlier "no edits" resolution.

### 7.2 Out of Scope

- [OUT] Replacing or duplicating the post-implementation `@reviewer` (DoD) — distinct checkpoint (DoR vs DoD).
- [OUT] The deterministic mechanical readiness pre-check `ados check-readiness` (issue **#49**) — a future complement; this change delivers the AI-driven adversarial semantic gate only.
- [OUT] Post-delivery retrospectives (GH-43) — complementary, post-delivery.
- [OUT] Repo-local `.ai/agent/readiness-instructions.md` DoR extensions — deferred (YAGNI).
- [OUT] Re-debating the resolved structural decisions (single critic, new agent, model tier, hard-gate+override, DoR location, ADR-0002) — fixed by ticket + comment #1.
- [OUT] Authoring the ADR content at spec time — produced via the decision workflow (`@decision-advisor`).
- [OUT] System-spec reconciliation of any feature spec — this is a delivery-process change; `@doc-syncer` handles any phase-7 reconciliation.

### 7.3 Deferred / Maybe-Later

- The mechanical pre-check command (#49) — would complement the adversarial gate by deterministically verifying required sections, AC traceability, and plan→spec references, leaving adversarial analysis to `@readiness-reviewer`.
- Repo-local DoR extensions (`.ai/agent/readiness-instructions.md`) — only if a project needs project-specific DoR additions.
- Splitting a DoR facet into a specialized critic — reversible; revisit only if a facet proves to need deep specialization.
- Retrospective-driven DoR evolution (GH-43) — the retrospective agent may propose DoR improvements over time.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — this change adds an internal agent/command and modifies the delivery workflow; it exposes no HTTP endpoints.

### 8.2 Events / Messages

N/A — no new events or messages. The integration contract is the PM→agent delegation: `@pm` delegates the `dor_check` phase to `@readiness-reviewer` and consumes a gate verdict.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `dor_check` phase entry | `@pm`'s PM-notes phase map gains `dor_check: { started, completed }` between `delivery_planning` and `delivery`; the lifecycle's PM-notes structure, agent-responsibility table, and phase-reopening table gain the phase. No removal/rename of existing phase keys. |
| DM-2 | Gate verdict + findings | `@readiness-reviewer` emits a structured verdict: `READY \| NOT_READY` plus per-facet findings (facet, finding, severity, linked artifact + location, suggested remediation target phase). Persisted as a readiness-review record under the change folder (mirroring `@reviewer`'s `findings-iter-<N>` discipline). |
| DM-3 | DoR facets (the checklist) | The facets the gate evaluates holistically: (a) spec completeness vs ticket; (b) AC clarity/testability/non-overlap; (c) plan coverage of all requirements + all AC, check-listable; (d) test-plan traceability to every AC; (e) cross-artifact consistency (ticket → spec → test-plan → plan); (f) decision capture in the right place. Closed, authoritative set in the prompt. |
| DM-4 | Override record | A `NOT_READY` override for a genuinely trivial change records: `workItemRef`, triviality rationale, human approver, date. Stored in change docs (pm-notes). No field may be omitted; absence of a record means no override was granted. |
| DM-5 | Decision-capture routing | At the gate, a surfaced decision carries a `scope: change \| system` classification; `system` (precedent-setting/cross-component) routes to a proposed decision record under `doc/decisions/**`; `change` routes to change docs. Needs-human-input decisions set a pause flag. |

### 8.4 External Integrations

N/A — no new external APIs or services. The gate reads local change artifacts and the source ticket (via the existing tracker access already used by `@pm`); it introduces no new network, tracker, or PR-platform access.

### 8.5 Backward Compatibility

- **Additive and backward compatible at the workflow level.** No existing phase is removed or renamed; `dor_check` is inserted and subsequent phases are renumbered. In-flight changes are not retroactively blocked.
- **Definition of Done preserved.** The post-implementation `@reviewer` (now phase 8) is unchanged in role, inputs, and contract (code-vs-spec, diffs, post-implementation). It is a distinct checkpoint, not merged with the DoR gate.
- **No new runtime/state migration.** Existing PM-notes files predate the phase; `dor_check` is simply absent (treated as not-yet-run) for changes started before adoption. The override and verdict records are new optional fields that older changes simply do not carry.
- **Inventory surfaces stay consistent.** `AGENTS.md`, `.opencode/README.md`, and the lifecycle guide are updated together so there is exactly one description of the flow (NFR-1).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Renumbering consistency | After delivery, 0 stale references to the old 10-phase numbering or to "phase 5 = delivery" anywhere in the repo, verified by a repo-wide grep (excluding `doc/changes/**`, `.ados-claude/**`, and `.git/**`) across all surfaces — including `doc/guides/change-lifecycle.md` (mermaid + tables), `AGENTS.md`, `README.md`, `doc/00-index.md`, `.opencode/README.md`, `.opencode/agent/pm.md` (incl. "step 10"/"steps 1-10"), all `doc/guides/**` (esp. the redistributable onboarding + agents-and-commands guides), `doc/spec/features/**`, and `.ai/agent/decision-instructions.md`. Total phases = 11. |
| NFR-2 | DoR source-of-truth discipline | The prompt is authoritative; `doc/guides/definition-of-ready.md` explicitly states so; 0 contradictions between prompt and mirror. |
| NFR-3 | Stronger reasoning model | `@readiness-reviewer` runs on the stronger reasoning tier via `claude.model: opus` in agent frontmatter (mirrors `@reviewer`); model assignment is NOT encoded in the prompt body. |
| NFR-4 | House-style parity with `@reviewer` | `@readiness-reviewer` follows `@reviewer`'s structural discipline: role/non_goals, frontmatter keys, safety rules (read-only, no silent skip), structured verdict/finding format. |
| NFR-5 | Plugin byte-freshness | `.opencode/agent/readiness-reviewer.md`, `.opencode/command/check-readiness.md`, and the modified `pm.md` are committed together with the regenerated `.ados-claude/` counterparts; CI verifies freshness via `scripts/build-claude-plugin.sh`. |
| NFR-6 | Redistributable guide | `doc/guides/definition-of-ready.md` declares `ados_distribution: redistributable` and passes `scripts/.tests/test-doc-distribution.sh` (wired into CI; blocks merge on drift). |
| NFR-7 | No silent skip | The gate blocks by default; the only bypass is an explicit override record (DM-4). There is no code/path that unconditionally passes a change through `dor_check`. |
| NFR-8 | Adversarial semantic review (not mechanical) | The DoR gate is an AI-driven adversarial *semantic* review (completeness, consistency, AC coverage, decision capture). It is NOT a deterministic mechanical checker; #49's mechanical role is explicitly out of scope. |
| NFR-9 | Role separation | `@reviewer` (DoD) role text is unchanged; `@readiness-reviewer` is a distinct agent/invocation. The two gates are never conflated. |
| NFR-10 | Prompt size discipline | `readiness-reviewer.md` must stay lean — reference the DoR guide for human-readable detail and duplicate no prose; delegate authoring to `@toolsmith`; warn if it exceeds house thresholds for agent prompts. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — agents and commands are prompt/definition artifacts without runtime telemetry. Observability is structural and durable: the persisted gate verdict + per-facet findings record (DM-2), the override records (DM-4), and the decision-capture routing (DM-5) are the artifacts humans and the retrospective agent (GH-43) inspect. The `dor_check` entry in `chg-<workItemRef>-pm-notes.yaml` (DM-1) is the phase-level status signal.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Renumbering touches many references; a missed reference leaves drift (e.g., a doc still says "phase 5 = delivery") | H | M | Treat renumbering as a structural sweep across all surfaces (NFR-1); the test plan = grep sweep over phase numbers + the mermaid/tables; review vs spec/plan. Sweep is repo-wide (NFR-1), not limited to the 4 core surfaces — red-team RT1-MAJOR-01 found stale refs in ~8 additional docs incl. redistributable guides. | M |
| RSK-2 | Prompt-as-source DoR drifts from the guide mirror over time | M | M | Guide explicitly states the prompt is authoritative (NFR-2); CI doc-distribution guard covers the guide; co-maintain prompt + mirror in one change. | L |
| RSK-3 | The gate over-blocks (bottleneck) or the override is abused, reintroducing sycophancy | M | M | Hard-gate + explicit recorded override (no silent skip, DM-4/NFR-7); override leaves an auditable record; capped re-run iterations with human escalation on stalemate. | M |
| RSK-4 | Most AC are behavioral agent-capability claims untestable in CI | M | H | Static/structural checks (phase presence, inventory consistency, prompt encodes stance/DoR) + CI gates (plugin freshness, doc-distribution) + a manual verification matrix; behavioral claims honestly marked manual (carried from GH-71 DEC-9 / GH-72 NFR-8). | M |
| RSK-5 | Agent prompt bloat degrades instruction-following | M | M | Lean prompt that references the guide for detail (NFR-10); delegate authoring to `@toolsmith`; size monitored by PR review. | L |
| RSK-6 | Generated `.ados-claude` counterparts go stale | M | M | Regenerate via `scripts/build-claude-plugin.sh`; commit source + generated together; CI verifies freshness (NFR-5). | L |
| RSK-7 | Scope creep into #49 mechanical checking | M | L | NFR-8 + NG-3 explicitly fence the gate as adversarial semantic only; #49 referenced as a future complement, never a dependency. | L |
| RSK-8 | DoR reopening logic regresses `@pm` orchestration (e.g., a gap wrongly reopens `delivery`) | M | M | Reopening rule is explicit and fenced: DoR gaps reopen `specification`/`test_planning`/`delivery_planning`, never `delivery` (F-4); verified structurally in the PM prompt + lifecycle phase-reopening table. | L |

## 12. ASSUMPTIONS

- The ticket's 5 open decisions are resolved as recorded in §15 (single critic; new agent; stronger reasoning model; hard-gate + recorded override; DoR prompt-as-source + guide mirror). Decision #5 is refined by ticket comment #1 (prompt-as-source-of-truth supersedes the ticket's original "dedicated guide" recommendation).
- Inserting `dor_check` as the new phase 5 and renumbering 5–10 → 6–11 is the adopted structural approach (PM-level; referenced by ADR-0002) — not re-debated.
- `@reviewer` (GH-36) is the structural/house-style precedent to mirror for the new agent (frontmatter, XML structure, adversarial heuristics, structured findings, read-only safety rules).
- `@toolsmith` is the required delegate for editing `.opencode/agent/**` and `.opencode/command/**` (repo hard rule in `AGENTS.md` "Extending the system").
- The gate reads only local change artifacts + the source ticket via existing tracker access; no new platform integration is needed.
- A human is available to approve overrides (DM-4) and to resolve decisions flagged needs-human-input (DM-5); the agent does not auto-advance past a pause.
- ADR-0002 is the right next ADR number (only ADR-0001 exists today) and its acceptance rides the GH-57 PR.
- AC10's self-dogfood is a surrogate for GH-57 (the red-team pre-delivery review); the first true dogfood is the next change post-merge (RT1-MAJOR-02).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | ADR-0002 (Proposed) | Design record for the precedent-setting workflow-structure change; acceptance rides the GH-57 PR. Produced via the decision workflow. |
| Depends on | `@toolsmith` | Required delegate for editing `.opencode/agent/readiness-reviewer.md`, `.opencode/command/check-readiness.md`, and `.opencode/agent/pm.md` (repo hard rule). |
| Depends on | `scripts/build-claude-plugin.sh` | Regenerates the `.ados-claude` counterparts; source + generated committed together (NFR-5). |
| Depends on | `@reviewer` (GH-36, merged) | Structural/house-style precedent for the new agent. |
| Depends on | `doc/guides/decision-records-management.md` | Authority for the decision-capture routing rule (change-scoped vs system-wide) and the ADR-0002 record. |
| Relates | GH-43 | Retrospective agent — complementary; DoR is pre-delivery, GH-43 is post-delivery. |
| Relates | GH-36 / GH-38 | Reviewer — distinct checkpoint (DoR vs DoD). |
| Complement (future) | GH-49 (#49) | Deterministic mechanical `ados check-readiness` pre-check — a future complement to the adversarial gate; NOT a hard dependency (out of scope, NG-3). |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Do the affected artifact-creator agents (`@spec-writer`/`@test-plan-writer`/`@plan-writer`) need a note that they may be **re-invoked** by the DoR gate (i.e., that their outputs can be sent back for revision)? | Affects delivery scope (scope item A/E minimalism) and whether to touch three more `.opencode/agent/**` files (each via `@toolsmith`). | **RESOLVED (PM, revised after red-team RT1-MAJOR-03).** Add a ONE-LINE cross-reference note to each of `@spec-writer`/`@test-plan-writer`/`@plan-writer` (via `@toolsmith`) stating their output may be returned for revision by the DoR gate (`dor_check`, phase 5). This makes the literal AC8 ("affected artifact-creator agents reflect the new phase") true. Supersedes the earlier "no edits" resolution — a strict AC8 read requires the author agents to reflect the gate. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | **One** `@readiness-reviewer` with a structured multi-facet DoR checklist (not multiple specialized critics). | Cross-artifact consistency is the highest-value check and needs one holistic view; matches the unified-`@reviewer` precedent (GH-36). Specialization via checklist sections; a facet can be split out later if needed (reversible). | 2026-06-27 |
| DEC-2 | A **new agent** (`@readiness-reviewer` + `/check-readiness` + `dor_check`), not a `@reviewer` "readiness mode". | `@reviewer` is code-vs-spec (post-impl, diffs); readiness is artifacts-vs-ticket (pre-impl, no code). Different inputs/timing/mental model; merging risks an overloaded, confused agent. | 2026-06-27 |
| DEC-3 | Stronger reasoning model: **OpenCode model via the `opencode*.jsonc` config; Claude Code model via `claude.model: opus` agent frontmatter** (mirrors `@reviewer`). Model assignment is NOT encoded in the prompt body. | Highest-leverage checkpoint warrants one stronger-model pass pre-delivery; mirrors `@reviewer`; model assignment lives in config, not behavior (AGENTS.md rule). | 2026-06-27 |
| DEC-4 | **Hard gate by default + explicit, recorded override** for genuinely trivial changes (no silent skip). | A silent skip reintroduces the sycophancy this gate exists to prevent; the override forces a conscious, recorded decision (DM-4) — the anti-sycophancy mechanism working as intended. | 2026-06-27 |
| DEC-5 | DoR location = **prompt-as-source-of-truth** (refined by ticket comment #1). Core DoR authoritative in the `@readiness-reviewer` prompt; `doc/guides/definition-of-ready.md` is a human-readable **mirror** stating the prompt is authoritative; repo-local `.ai/agent/readiness-instructions.md` deferred (YAGNI). | DoR is enforced correctness behavior, so it belongs in the prompt (AGENTS.md treats prompts as the product); avoids drift/ambiguity over which is authoritative. Supersedes the ticket's original "dedicated guide" recommendation. | 2026-06-27 |
| DEC-6 | The deterministic mechanical pre-check (#49 `ados check-readiness`) is **out of scope** (future complement). | GH-57 delivers the AI-driven adversarial semantic gate only; #49 is additive and tooling-gated, not a dependency. | 2026-06-27 |
| DEC-7 | Record the design as **ADR-0002** (Proposed; acceptance rides the GH-57 PR). | This is a precedent-setting delivery-workflow structural change; follows the ADR-0001 precedent for delivery-workflow structure. | 2026-06-27 |
| DEC-8 | Insert `dor_check` as the **new phase 5** and renumber existing 5–10 to **6–11** (rather than appending or reordering later phases). | Cleanest insertion preserves the artifact→implementation→verification→finalization grouping; referenced by ADR-0002. | 2026-06-27 |
| DEC-9 | Editing `.opencode/agent/**` and `.opencode/command/**` is delegated to `@toolsmith` at delivery. | Hard rule in `AGENTS.md` "Extending the system". | 2026-06-27 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `.opencode/agent/readiness-reviewer.md` (OpenCode source) | **New** — `@readiness-reviewer` agent; authoritative DoR; adversarial stance; verdict/finding format; hard-gate + recorded override (authored via `@toolsmith`) |
| `.opencode/command/check-readiness.md` (OpenCode source) | **New** — `/check-readiness` command (authored via `@toolsmith`) |
| `.ados-claude/` plugin counterparts | **Regenerated** — for the new agent/command + modified `pm.md`; committed alongside sources (CI freshness) |
| `doc/guides/definition-of-ready.md` | **New** — redistributable DoR mirror; states prompt is authoritative |
| `doc/guides/change-lifecycle.md` | **Modified** — `dor_check` as phase 5; renumber 5–10 → 6–11; mermaid + agent-responsibility + phase-reopening tables; PM-notes map; reference DoR guide |
| `.opencode/agent/pm.md` | **Modified** — `dor_check` step; DoR reopening logic (artifact phase, not delivery); decision-capture routing + human pause; `phases.dor_check` in PM-notes map (via `@toolsmith`) |
| `AGENTS.md` | **Modified** — phase table (11 phases); agent table (`readiness-reviewer`); command table (`/check-readiness`); "Using the system" manual sequence |
| `.opencode/README.md` | **Modified** — agent + command inventory |
| `.ai/agent/pm-instructions.md` | **Reviewed** — add a `dor_check`/planning transition only if it enumerates phase transitions (apply if relevant) |
| `.opencode/agent/{spec-writer,test-plan-writer,plan-writer}.md` | **Modified** — one-line DoR cross-reference note each (RT1-MAJOR-03; via `@toolsmith`) |
| `doc/decisions/ADR-0002-readiness-gate-definition-of-ready.md` | **New** — decision record (Proposed; acceptance rides PR) |
| `doc/decisions/00-index.md` | **Modified** — add ADR-0002 row |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion (Given / When / Then) | Linked |
|----|----------------------------------|--------|
| AC1 | **Given** GH-57 ships, **when** the `@readiness-reviewer` prompt and `doc/guides/definition-of-ready.md` are inspected, **then** a Definition of Ready checklist is defined **authoritatively** in the prompt and **mirrored** in the guide, which states the prompt is authoritative. **Verification: structural (prompt contains authoritative DoR facets DM-3; guide present + states prompt authoritative + `ados_distribution: redistributable`) + CI (doc-distribution guard).** | F-1, DM-3, NFR-2, NFR-6 |
| AC2 | **Given** all change artifacts (spec, test-plan, plan) exist, **when** `dor_check` runs, **then** `@readiness-reviewer` reviews the full artifact set together against the source ticket and emits a gate verdict (`READY`/`NOT_READY`) with per-facet findings, as the new phase 5 between `delivery_planning` and `delivery`. **Verification: structural (`dor_check` present as phase 5 in lifecycle + `AGENTS.md` + `@pm`; `@readiness-reviewer` + `/check-readiness` exist) + manual.** | F-2, F-7, DM-1, DM-2 |
| AC3 | **Given** the gate runs, **when** `@readiness-reviewer` evaluates the artifacts, **then** it adopts an adversarial/critical stance (actively seeks gaps, does not rubber-stamp) and is independent of the artifact-author agents (`@spec-writer`/`@test-plan-writer`/`@plan-writer`). **Verification: structural (prompt encodes adversarial/critical stance + independence) + manual.** | F-3, NFR-8 |
| AC4 | **Given** the gate finds an artifact gap (e.g., a test-plan not tracing to an AC, an untestable AC, a plan missing an AC), **when** the verdict is `NOT_READY`, **then** the workflow reopens the relevant artifact-creation phase (`specification`/`test_planning`/`delivery_planning`), **not** `delivery`. **Verification: structural (lifecycle phase-reopening table + `@pm` reopening logic route DoR gaps to artifact phases) + manual.** | F-4, DM-1 |
| AC5 | **Given** the gate identifies a decision needing human input, **when** no human input is yet provided, **then** the workflow pauses (STOP and wait) for human confirmation before proceeding. **Verification: structural (prompt + `@pm` step encode the pause) + manual.** | F-5, DM-5 |
| AC6 | **Given** a change reaches `dor_check`, **when** the gate is evaluated, **then** it blocks by default and the only bypass for genuinely trivial changes is an explicit, recorded override (workItemRef + rationale + approver + date); no silent/unconditional skip path exists. **Verification: structural (prompt encodes hard-gate-default + override-record fields DM-4; absence of unconditional pass) + manual.** | F-6, DM-4, NFR-7 |
| AC7 | **Given** the gate surfaces a decision, **when** it is change-scoped it is recorded in change docs (pm-notes/spec), and **when** it is system-wide/precedent-setting it is proposed as a decision record under `doc/decisions/**`. **Verification: structural (prompt encodes the routing rule DM-5) + structural (ADR-0002 exists as the exemplar system-wide record) + manual.** | F-5, DM-5 |
| AC8 | **Given** GH-57 ships, **when** `doc/guides/change-lifecycle.md`, `.opencode/agent/pm.md`, affected artifact-creator agents, `AGENTS.md`, and `.opencode/README.md` are inspected, **then** `dor_check` (phase 5), `@readiness-reviewer`, and `/check-readiness` are reflected, subsequent phases are renumbered to 6–11, and the mermaid diagram + agent-responsibility + phase-reopening tables are updated. **Verification: structural (grep sweep for stale phase numbers; inventory entries present) + CI (plugin freshness). Also verified: the three artifact-creator agents (`@spec-writer`/`@test-plan-writer`/`@plan-writer`) each carry a one-line cross-reference to the DoR gate (RT1-MAJOR-03), so "affected artifact-creator agents reflect the new phase" is literally true.** | F-7, NFR-1 |
| AC9 | **Given** GH-57 ships, **when** `@reviewer` (now phase 8) is inspected, **then** its role is unchanged — Definition of Done, code-vs-spec/plan, post-implementation — and distinct from `@readiness-reviewer` (DoR). **Verification: structural (`@reviewer` role text unchanged; distinct agent/invocation).** | F-7, NFR-9 |
| AC10 | **Given** a change is delivered through the updated 11-phase workflow, **when** it reaches `dor_check`, **then** the gate executes end-to-end — either returns `READY` (proceed to delivery) or `NOT_READY` with gaps routed to the correct artifact phase — exercising the full flow. GH-57's own delivery dogfoods the gate. **Verification: manual (end-to-end run during GH-57 delivery).** **Surrogate honesty:** because `@readiness-reviewer` does not exist until this change's own `delivery` phase, a true phase-5 self-run is structurally impossible for GH-57; the GH-57 pre-delivery red-team review is the adopted surrogate for AC10, and the FIRST true end-to-end dogfood is the NEXT change delivered after merge (RT1-MAJOR-02). | F-2, F-4, F-7 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery order (high-level):** (1) `@decision-advisor` produces ADR-0002 (Proposed) + update `00-index.md` → (2) `@toolsmith` authors `@readiness-reviewer` + `/check-readiness` and modifies `@pm` (incl. PM-notes `dor_check` entry + reopening logic) → (3) regenerate `.ados-claude/` and commit source + generated together → (4) author `doc/guides/definition-of-ready.md` (redistributable mirror) → (5) update `doc/guides/change-lifecycle.md` (insert phase 5, renumber 5–10 → 6–11, mermaid + tables) → (6) update `AGENTS.md` + `.opencode/README.md` (+ review `pm-instructions.md`) → (7) renumbering sweep verifying 0 stale references (NFR-1) → (8) `@doc-syncer` reconciles any system docs at phase 7.
- **Merge strategy:** single PR. CI must verify plugin freshness + the doc-distribution guard on the new guide; the renumbering sweep is verified structurally; behavioral claims (adversarial stance, reopening routing, end-to-end pass) are covered by the manual verification matrix + PR review (RSK-4).
- **Adoption note:** additive — no existing phase is removed/renamed; the gate simply runs before `delivery`. The post-impl `@reviewer` (DoD) is untouched.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No persisted data migration. Existing PM-notes files predate `dor_check`; the phase is simply absent (treated as not-yet-run) for changes started before adoption. The override (DM-4) and verdict (DM-2) records are new optional fields older changes do not carry. No live runtime state is seeded — this repo ships the agent/command/guide definitions; projects instantiate change artifacts at runtime.

## 20. PRIVACY / COMPLIANCE REVIEW

The gate reviews change artifacts (specs, test-plans, plans) and the source ticket — all internal engineering content. It introduces no new personal/PII processing, no new external data flows, and no new tracker/platform access beyond what `@pm` already uses. Decision-capture routing may create decision records (`doc/decisions/**`); those follow the existing decision-records policy. No privacy or compliance exposure is introduced.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Read-only review:** like `@reviewer`, the readiness reviewer critiques artifacts and emits a verdict/record; it does not modify source code and does not auto-merge/approve anything.
- **No new access:** no new external APIs, trackers, or platform access (NFR / §8.4). The gate uses existing local file reads + existing tracker access.
- **Override integrity:** the only gate bypass is an explicit, recorded approval (DM-4); there is no silent skip, so the anti-sycophancy control cannot be quietly defeated (NFR-7).
- **Decision routing safety:** system-wide decisions are routed to decision records under human pause (DM-5); the agent does not silently finalize precedent-setting decisions.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The new agent, command, and guide join the redistributable delivery-system family and are co-maintained with `@reviewer` (same frontmatter/XML/finding discipline). Edits continue to go through `@toolsmith` (hard rule).
- The DoR prompt and the guide mirror are co-maintained: any DoR change must be made in the prompt first (authoritative) and the mirror updated in the same change (NFR-2). The retrospective agent (GH-43) may propose DoR improvements over time.
- Renumbering is a one-time structural change; future phase changes must keep all surfaces consistent (NFR-1). The renumbering sweep is the durable proof there is exactly one description of the flow.
- `.ados-claude/` counterparts are kept byte-fresh (NFR-5); the doc-distribution guard covers the new guide (NFR-6).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Definition of Ready (DoR) | The pre-delivery checklist a change's artifacts (spec/test-plan/plan) must satisfy before implementation may begin. Authoritative in the `@readiness-reviewer` prompt; mirrored in `doc/guides/definition-of-ready.md`. |
| Definition of Done (DoD) | The post-implementation check that implementation matches spec/plan — the role of the existing `@reviewer`. |
| DoR gate / `dor_check` | The new lifecycle phase (5) where `@readiness-reviewer` reviews all artifacts together against the ticket and emits a `READY`/`NOT_READY` verdict. |
| `@readiness-reviewer` | The new adversarial reviewer agent that owns the DoR gate; independent of the artifact authors; mirrors `@reviewer` house style. |
| `/check-readiness` | The command that invokes the DoR gate (the DoR pair of `/review`). |
| Cross-artifact consistency | The check that ticket → spec → test-plan → plan align (e.g., every AC is covered by the plan and traced by the test-plan). The highest-value DoR facet. |
| Override record | The explicit, recorded approval (workItemRef + rationale + approver + date) that bypasses the gate for a genuinely trivial change. No silent skip exists. |
| Sycophancy | The tendency of AI agents to confidently produce plausible-but-incomplete artifacts; the structural problem the adversarial DoR gate exists to counter. |

## 24. APPENDICES

- **Appendix A — Authoritative AC source:** GitHub issue GH-57 (the 10-item "Acceptance Criteria" checklist + 5 "Open Decisions"). The 5 open decisions are resolved in §15 (DEC-1…DEC-7) per the ticket recommendations, with decision #5 refined by ticket comment #1 (prompt-as-source-of-truth). AC are carried forward here made testable (AC1–AC10), each annotated with its verification type (structural/CI vs manual).
- **Appendix B — DoR/DoD pairing (mirrors the ticket's naming table):** `dor_check` ↔ `@readiness-reviewer` ↔ `/check-readiness` ↔ `doc/guides/definition-of-ready.md` (DoR, before delivery) is the structural pair of `dod_check` ↔ `@reviewer` ↔ `/review` ↔ inline-in-change-lifecycle (DoD, before PR). The role name describes the lifecycle role; the adversarial "critic" behavior lives in the prompt.
- **Appendix C — Structural sibling:** `.opencode/agent/reviewer.md` is the agent to mirror for house style (frontmatter incl. `claude.model: opus`, role/non_goals, adversarial heuristics, structured finding format, read-only safety rules).
- **Appendix D — Decision-record linkage:** per `doc/guides/decision-records-management.md` §8, this spec's front matter declares `links.decisions: ["ADR-0002"]`; ADR-0002's front matter will declare `links.related_changes: ["GH-57"]`. ADR-0002 is the design authority for the workflow-structure change; its acceptance rides the GH-57 PR.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-27 | Juliusz Ćwiąkalski | Initial specification (DoR gate + `@readiness-reviewer` + `/check-readiness` + lifecycle renumbering to 11 phases; 5 open decisions resolved per ticket + comment #1; ADR-0002 referenced). |

---

## AUTHORING GUIDELINES

- Sources: GitHub issue GH-57 (authoritative AC + 5 open decisions), GH-57 comment #1 (refines decision #5 → prompt-as-source-of-truth; fences #49 as out of scope; records ADR-0002 intent), the shipped `.opencode/agent/reviewer.md` (house-style sibling to mirror), `.opencode/agent/pm.md` (the workflow + PM-notes phase map this change modifies), `doc/guides/change-lifecycle.md` (the artifact this change renumbers), `doc/guides/decision-records-management.md` (decision-capture routing + ADR linkage), `doc/decisions/00-index.md` (confirmed ADR-0002 is the next number), and `AGENTS.md` (phase/agent/command inventory + "Extending the system" hard rule).
- Proportionality: this is a precedent-setting delivery-workflow structural change with a wide blast radius (renumbering across many surfaces), so risk_level is **high**; the spec is kept focused on the gate + its workflow integration, referencing (not re-specifying) the DoD `@reviewer`, the decision workflow, and the future #49 complement.
- Honesty about testability: most AC are behavioral and cannot be unit-tested in CI; each AC carries a verification-type annotation (structural/CI vs manual) (RSK-4). The renumbering sweep (NFR-1) and the doc-distribution/plugin-freshness gates are the concrete CI-verifiable claims.
- Non-implementation: no file-level code edits, step-by-step tasks, or commit/git instructions. The agent/command/PM edits are stated as constraints delivered via `@toolsmith`; the ADR is produced via the decision workflow; the system-doc reconciliation is a phase-7 concern.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-57)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code edits, no step-by-step tasks)
- [x] No content duplicated from linked docs (ADR-0002 referenced, not authored; `@reviewer` house style referenced, not copied)
- [x] Front matter validates per front_matter_rules (incl. `links.decisions: ["ADR-0002"]`)
