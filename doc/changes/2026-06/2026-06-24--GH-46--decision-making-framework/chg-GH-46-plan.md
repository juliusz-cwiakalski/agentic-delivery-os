---
id: chg-GH-46-decision-making-framework
status: Proposed
created: 2026-06-24T00:00:00Z
last_updated: 2026-06-24T00:00:00Z
owners: ["@cwiakalski"]
service: delivery-os
labels: [decision-making, agent-framework, documentation-framework, template, refactor]
links:
  change_spec: ./chg-GH-46-spec.md
  pm_notes: ./chg-GH-46-pm-notes.yaml
summary: >
  Generalize ADOS decision-making from an architecture-biased single-ceremony
  workflow into a universal decision kernel with adaptive playbooks: one
  domain-neutral orchestrator agent (@decision-advisor, renamed from @architect),
  proportional rigor (R0-R3 + emergency overlay), first-class decision rights
  (DACI-style), a bounded AI-authority model, an independent challenger
  (@decision-critic + /review-decision), a process-first Decision-Making Guide,
  a rigor-aware additive template, generalized /plan-decision and /write-decision,
  meeting integration, a repo-wide reference sweep, and a dogfood ADR-0001. No
  application source code; this is a documentation- and agent-prompt-framework
  change. Version impact: none.
version_impact: none
---

# IMPLEMENTATION PLAN — GH-46: Decision-making refactor: universal kernel, proportional rigor, unified agent, process-first guide

## Context and Goals

This plan delivers the change specified in `chg-GH-46-spec.md`: a documentation-
and agent-prompt-framework refactor that rebuilds the decision-making subsystem
end-to-end while reusing the decision-**record** foundation already generalized
to all five types (ADR/PDR/TDR/BDR/ODR) and hardened by GH-60 / PR #61.

Today, ADOS generalized only the decision-**record artifact** — never the agent,
the process narrative, decision rights, an AI-authority model, or proportional
rigor. Concretely: `@architect` is framed as architecture-only yet its prompt
owns all five types (a discovery failure); a reversible UI choice and a
data-residency strategy receive identical ceremony; nobody is formally the
decider; AI is neither authorized nor bounded; recommendation and critique come
from the same agent; and the agent prompt + `/write-decision` both **bake in** the
full decision-record body structure, duplicating the template (the drift source
that caused GH-60's section-order collision).

This change introduces:

- A **universal decision kernel (D0-D14)** shared by all significant decisions.
- **Proportional rigor (R0-R3) + an emergency overlay** that scale ceremony to stakes.
- **Four-axis classification** (type x domain tags x archetype x conditions) that drives routing.
- **First-class decision rights** (DACI-style) in both the planning session and the record.
- A **bounded AI-authority model** (AI recommends/facilitates; acts autonomously only within delegated, reversible, bounded R0-R1 with audit + escalation; R2/R3 always require a human final decision; recommendation != decision).
- One **domain-neutral orchestrator** — `@decision-advisor` (renamed/rewritten from `@architect`, baked-in structure removed) — and a lean **`@decision-critic`** for independent challenge.
- A **process-first Decision-Making Guide** that supersedes the artifact-centric guide.
- A **rigor-aware, additive** template (optional front matter + proportional rendering), plus the GH-60 carryover defect fixes.
- **Generalized commands** (`/plan-decision`, `/write-decision`) and a new `/review-decision`.
- **Meeting integration** (discussion as evidence input; durable decisions get records; three decision modes).
- A **repo-wide reference sweep** with the generated Claude plugin regenerated.
- A **dogfood** — GH-46 itself recorded as `ADR-0001` via the new process.

All planning decisions are locked in the spec's Decision Log (DEC-1 … DEC-18,
covering the PM decisions RD-1 … RD-16 plus the OQ-A/OQ-B resolutions) and the
two open questions resolved in lean (OQ-A: proportional rendering of one template;
OQ-B: rename the planning-summary tag with a back-compat alias). **This plan
implements those decisions; it does not re-decide them.** The dogfood ADR-0001
records the decision set RD-1 … RD-16.

The single most critical invariant is **cross-source section-order consistency
(spec NFR-4, preserving GH-60's NFR-1)**: after removing the agent's baked-in body
structure, the template must remain the **single source of truth** for the body
section order, and the write command's structure definition must match it with
zero mismatches. Phase 8 verifies this explicitly.

The change propagates across roughly **fifteen live artifacts** routed through
**two tracks** per `AGENTS.md`:

- **Documentation track (normal flow):** new `doc/guides/decision-making.md`;
  demotion of `doc/guides/decision-records-management.md`; additive
  `doc/templates/decision-record-template.md`; meeting guide; feature specs;
  top-level docs/templates.
- **`.opencode/` track (via `@toolsmith`):** `git mv .opencode/agent/architect.md`
  -> `decision-advisor.md` (+ rewrite); new `.opencode/agent/decision-critic.md`;
  `.opencode/command/plan-decision.md`, `.opencode/command/write-decision.md`;
  new `.opencode/command/review-decision.md`; `@meeting-organizer`; and the
  agent reference sweep (pm/spec-writer/plan-writer/coder/bootstrapper).
- **Generated track (DO NOT hand-edit):** `.ados-claude/**` is regenerated by
  `scripts/build-claude-plugin.sh` (Phase 6) and committed alongside the source.

**Open questions** (delivery-level):

- **Branch type reconciliation:** `chg-GH-46-pm-notes.yaml` records
  `branch: feat/GH-46/...` (pre-spec lean), but the spec's `change.type` is
  `refactor`, making the convention-correct branch
  `refactor/GH-46/decision-making-framework`. **Resolve to `refactor/...`** (the
  spec-derived `change.type` is authoritative); update the pm-notes `branch:`
  field as a trivial reconciliation when that file is next touched (it is a
  change artifact, not swept in the live-source phases).
- **`@architect` historical references are intentionally NOT swept.** Frozen
  change artifacts (`chg-GH-60-*`, `chg-GH-52-*`, `chg-GH-32-*`, `chg-GH-36-*`,
  `chg-GH-26-*` and their feedback/test-plan/red-team files) and this change's
  own spec/pm-notes are immutable records that legitimately mention `@architect`
  as history. The sweep targets **live source** only; NFR/AC count "stale
  **live** references" = 0, not absolute repo grep = 0.

## Scope

### In Scope

- New process-first **Decision-Making Guide** (`doc/guides/decision-making.md`):
  kernel D0-D14, R0-R3 + emergency overlay, four-axis classification, decision
  rights (DACI), AI-authority model, per-type nuance matrix (condensed, not 18
  files), constraints/drivers discipline, demoted record-artifact reference,
  agent & command integration (spec F-1, F-2, F-3, F-4, F-5, F-8).
- **Demote** `doc/guides/decision-records-management.md` to a record-artifact
  reference that links to the new process-first guide (spec F-8).
- **Additive** `doc/templates/decision-record-template.md`: optional
  `classification`, `governance`, `ai_assistance`, and review/revisit front matter
  (spec DM-1..DM-4); proportional-rendering guidance (R1/R2/R3); GH-60 defect
  fixes (spec F-9, NFR-4).
- **Rename + rewrite** `@architect` -> `@decision-advisor`
  (`git mv .opencode/agent/architect.md` -> `decision-advisor.md`): domain-neutral,
  type-aware, **no baked-in body structure** (references the template), preserves
  recommendation/decision separation, requests human approval for R2/R3. No
  separate `@architect` retained (spec F-6, RD-3).
- **New** `@decision-critic` agent: read-only independent challenger returning
  PASS / PASS_WITH_RISKS / REWORK (spec F-7).
- **Generalize** `/plan-decision` (triage -> classify -> rigor -> rights; generic
  `<decision_planning_summary>` tag with a back-compat alias for the legacy
  `<technical_decision_planning_summary>` tag and `adr.*` fields; keeps the GH-60
  hard-requirements elicitation step) (spec F-10, DM-5).
- **Generalize** `/write-decision` (consumes the generic summary; renders
  proportionally; records `ai_assistance`; enforces recommendation != decision;
  does not mark Accepted for R2/R3 without an authorized human decision)
  (spec F-10, DM-3).
- **New** `/review-decision <ID>` command: independent review via
  `@decision-critic`; read-only by default; produces a review artifact/verdict
  (spec F-7).
- **Meeting integration:** `@meeting-organizer` + meeting guide route discussion
  as evidence input to `/plan-decision`, durable decisions to `/write-decision`,
  reference `@decision-advisor`, and document three decision modes (spec F-11).
- **Repo-wide live reference sweep:** every live `@architect` reference ->
  `@decision-advisor`; inbound links to the renamed guide updated; `feature-decision-records.md`
  and `feature-document-templates.md` reconciled (spec F-12).
- **Plugin regeneration** of `.ados-claude/**` via `scripts/build-claude-plugin.sh`
  (spec F-12).
- **Dogfood** `ADR-0001` recording GH-46's decisions RD-1 … RD-16 via the new
  process (spec F-13).

### Out of Scope

- [OUT] Decision verifier agent and `/verify-decision`, `/decision-retro`
  (verification/retrospective lifecycle) (spec NG-1).
- [OUT] JSON schemas + validator/index tools (`validate-decision-record`,
  `generate-decision-index`) (spec NG-2).
- [OUT] Eighteen per-domain YAML checklists under a catalog directory; v1 uses a
  condensed master checklist + per-type matrix **in the guide** (spec NG-3).
- [OUT] Structured evidence-ledger YAML; v1 tightens prose
  FACT/ASSUMPTION/UNKNOWN discipline + source references (spec NG-4).
- [OUT] Probabilistic forecasting / Brier-calibration fields (spec NG-5).
- [OUT] Dedicated `@decision-researcher` (reuse `@external-researcher`) (spec NG-6).
- [OUT] Migrating/backfilling existing records (none exist; new fields optional) (spec NG-7).
- [OUT] Reordering the template body sections. GH-60 settled the order; this
  change **adds** optional front matter + proportional rendering only (spec NG-8).
- [OUT] Splitting GH-46 into multiple tickets (spec NG-9).
- [OUT] Sweeping `@architect` mentions inside frozen change artifacts / red-team
  reports / this change's own spec & pm-notes (immutable history).
- [OUT] Any application source-code, runtime service, CI pipeline, or build change.

### Constraints

- **Two routing tracks.** `.opencode/agent/*.md` and `.opencode/command/*.md` edits
  go through `@toolsmith` (per `AGENTS.md`); documentation artifacts follow the
  normal flow. `.ados-claude/**` is GENERATED — never hand-edit; regenerate via
  `scripts/build-claude-plugin.sh` and commit source + generated together (spec
  §12, `AGENTS.md`).
- **Single source of truth for the body structure (RD-3 / NFR-4).** The agent
  prompt must **reference** `doc/templates/decision-record-template.md` for the
  decision-record body structure, not bake it in. This removes the agent from the
  "sources to keep in sync" set, leaving the template as the single source and the
  write command's structure definition as its only mirror.
- **Additive only on the template.** No existing body section renamed, renumbered,
  reordered, or removed; new front-matter blocks are optional; existing records
  remain valid (spec §8.5, NG-8).
- **Agent rename = file rename.** `git mv` preserves history; update frontmatter
  `description` and every command's `agent:` field from `architect` to
  `decision-advisor`.
- **License headers.** AI agents MUST NEVER add headers. Only
  `scripts/add-header-location.sh` adds them, and only to `.opencode/agent`,
  `.opencode/command`, `doc/guides`, `doc/documentation-handbook.md`, `tools/`.
  The new guide and the new agent/command files qualify — run the script; do not
  hand-add (per `AGENTS.md`).
- **Never stage `.ai/local/`.** It is git-ignored; never commit it.
- **Commit per phase** via `@committer` (Conventional Commits). Only stage the
  files belonging to that phase.
- **Version impact: none.** No version bump required.

### Risks

- **RSK-1** (Agent rename breaks inbound references / user muscle memory; spec
  Impact M / Prob M): *Delivery mitigation* — Phase 5 sweeps every **live** source;
  a migration note in `AGENTS.md` and the new guide documents the rename; Phase 6
  regenerates and verifies the plugin; Phase 8 greps that 0 stale **live**
  `@architect` references remain. Residual L.
- **RSK-2** (Removing baked-in structure lets the agent drift from required
  section order; spec M / M): *Delivery mitigation* — the advisor references the
  template; Phase 3 makes `/write-decision`'s structure definition the template's
  only mirror; Phase 8 diffs section order across the reduced source set with zero
  mismatches (NFR-4); the dogfood ADR (Phase 7) exercises it end-to-end. Residual L.
- **RSK-3** (Over-engineering — pulling deferred machinery into v1; spec M / M):
  *Delivery mitigation* — the deferred list (RD-13) is enforced as Out-of-Scope
  above; Phase 1's per-type content stays a condensed matrix, not 18 files; Phase
  8 re-checks nothing schema/catalog/verifier landed. Residual L.
- **RSK-4** (`@decision-critic` independence is illusory — same model/prompt
  lineage; spec H / M): *Delivery mitigation* — the guide (Phase 1) and the critic
  prompt (Phase 2) state same-model != independent evidence; the critic receives
  problem/evidence/options without the recommendation where practical; the guide
  recommends a different model or a human reviewer for R3. Residual M.
- **RSK-5** (Proportional rendering ambiguity -> inconsistent R1 records; spec L /
  M): *Delivery mitigation* — the template carries explicit R1/R2/R3
  proportional-rendering guidance (Phase 1); the guide defines the exact R1 subset
  (Phase 1); one-template approach (OQ-A) minimizes drift. Residual L.
- **RSK-6** (Backward-compat break for consumers of the legacy summary tag/fields;
  spec L / L): *Delivery mitigation* — Phase 3 ships an explicit back-compat alias
  mapping the legacy `<technical_decision_planning_summary>` tag and `adr.*` fields
  to the generic summary fields; Phase 8 spot-checks both tag forms parse. Residual L.
- **RSK-7** (Recommendation/decision boundary eroded by AI auto-accepting R2/R3;
  spec H / M): *Delivery mitigation* — `/write-decision` must not mark Accepted
  without an authorized human decision; `ai_assistance.human_decider` required;
  the critic (Phase 2) and `/review-decision` (Phase 3) provide independent review;
  Phase 8 verifies the writer's no-auto-Accept rule. Residual M.
- **Delivery-only RSK-D1** (Plugin goes stale between the incremental `.opencode/`
  commits of Phases 2-5 and the Phase-6 regen): *Delivery mitigation* — keep all
  `.opencode/` work on the feature branch; do not merge to `main` before Phase 6;
  Phase 6 regenerates `.ados-claude/**` and the CI "stale plugin" gate passes only
  after that commit. Residual L.

### Success Metrics

| Metric | Target |
|--------|--------|
| Domain-neutral orchestrator named `@decision-advisor` (renamed from `@architect`); covers 5/5 types; prompt contains 0 baked-in body sections | **1/1** |
| `@decision-critic` exists; read-only; independent of advisor; returns PASS / PASS_WITH_RISKS / REWORK | **1/1** |
| Body section order: single source of truth (template); `@decision-advisor` baked-in body sections = **0**; `/write-decision` structure matches template with **0** mismatches | **0** mismatches |
| Live `@architect` references after sweep | **0** (frozen change artifacts excluded) |
| Decision-record body sections/sections rendered: R0 mandatory records = **0**; R1 output is a strict proper subset of R3; R1 cycle <= 1 business day | All three hold |
| Existing decision records requiring migration | **0** |
| Source-code / CI / build files changed | **0** |
| Dogfood ADR-0001 records RD-1 … RD-16 | **1/1** |

## Phases

### Phase 1: Decision-Making Guide + additive template + GH-60 defect fixes (Documentation track)

**Goal**: Establish the foundational model content — the process-first guide and
the rigor-aware additive template — that Phases 2-3 reference and that Phase 8
verifies against. Also land the GH-60 carryover defect fixes here (template side).

**Tasks**:

- [x] **1.1** Create new `doc/guides/decision-making.md` (process-first; supersedes
  the artifact-centric guide). Author all ten required content areas per spec F-8:
  (1) When to decide — record-worthiness + the R0 escape hatch; (2) the universal
  kernel **D0-D14** (use the spec's F-1 stage list verbatim as the index);
  (3) **R0-R3 rigor profiles + the emergency overlay** (required output + target
  cycle time per profile, per spec F-2); (4) **four-axis classification**
  (type x domain tags x archetype x conditions) -> routing, per spec F-3;
  (5) **decision rights** (DACI: driver/decider/contributors/reviewers/performers/informed)
  with who-typically-decides-per-type-and-risk, per spec F-4; (6) the **bounded
  AI-authority model** (allowed roles, autonomous-action bounds, recommendation !=
  decision, privacy/provenance), per spec F-5 — **including the honesty framing (RD-16
  / RT-04): for a single-model setup `@decision-critic` is a first-pass check, NOT
  independent assurance, and R3 ALWAYS requires a human reviewer**; (7) the **per-type nuance matrix**
  (context anchors, typical approver, fitting framework) — condensed, one matrix,
  NOT 18 catalog files (RD-14); (8) **constraints vs drivers discipline** with the
  GH-60 fixes folded in; (9) the **record artifact** reference (naming / front
  matter / lifecycle — demoted, links to the template); (10) **agent & command
  integration** (reference `@decision-advisor`, `@decision-critic`,
  `/plan-decision`, `/write-decision`, `/review-decision`, the three decision modes).
  **Skimmability guardrail (RD-14 / RT-09):** keep the guide a single condensed,
  skimmable document — NOT a multi-thousand-line tome — so the process is not bypassed
  for being too heavy; per-type nuance stays a condensed matrix (per RD-14), not
  proliferated files; target a length budget appropriate to a quick-reference guide.
- [x] **1.2** **Demote** `doc/guides/decision-records-management.md` to a thin
  record-artifact reference: keep the naming/front-matter/lifecycle content as an
  appendix, replace its process narrative with a redirect pointer to
  `decision-making.md`, and update its `@architect` references to
  `@decision-advisor` (its §9 "Agent Integration" subsection and §References
  link). The full process now lives in the new guide.
- [x] **1.3** Update `doc/templates/decision-record-template.md` with **optional,
  additive** front-matter blocks (all optional so existing records stay valid):
  - `classification:` (domains, archetype, environment, rigor R0-R3, reversibility,
    stakes, urgency, uncertainty, blast-radius, recurrence) — spec DM-1.
  - `governance:` (driver, decider, contributors, reviewers, performers, informed)
    — spec DM-2.
  - `ai_assistance:` (used, roles, external_data_shared, citations_verified,
    human_decider, reviewers) — spec DM-3.
  - `review_date:` + revisit triggers — spec DM-4.
  Existing extended-metadata fields (`decision_area`, `decision_scope`,
  `reversibility`, `review_date`, `business_impact`, `customer_impact`, optional
  links) MUST remain valid.
- [x] **1.4** Add **proportional-rendering guidance** to the template (OQ-A
  confirmed lean: one template, rendered proportionally): define the explicit
  R1 compact subset (problem, constraints, top drivers, baseline + >=1 option,
  choice + rationale, owner, revisit trigger), the R2 standard record, and the R3
  full record (independent challenge + human final decision + review date). State
  R0 produces no record.
- [x] **1.5** **Fix GH-60 carryover defects across ALL sources that carry the wording**
  (RT-03). The defect is cross-source, so the fix MUST be cross-source — every source is
  named below so none is missed:
  - **(a) "non-negotiable" → `negotiable: no` (or neutral pass/fail wording)** — the phrase
    currently coexists with the `negotiable: yes|no` data field. Fix in ALL **five** sources:
    `doc/templates/decision-record-template.md`, `doc/guides/decision-records-management.md`
    (**2 places**), `.opencode/command/write-decision.md`, and
    `.opencode/command/plan-decision.md`.
  - **(b) Context-conflation ("constraints" in the Context description)** — fix in BOTH
    sources: `doc/templates/decision-record-template.md` (Context comment line ~52:
    "Relevant constraints (technical, organizational, regulatory)" → reword to situational
    facts/triggers that are NOT pass/fail gates) AND `.opencode/command/write-decision.md`
    (the Context authoring rule currently says "and relevant constraints").
  - **(c) per-alternative heading/wording** — standardize so it matches across the template,
    the new guide, and (in Phase 3) both commands.
  - **Routing:** the template + guide edits land in this phase (docs flow); the
    `write-decision.md` and `plan-decision.md` edits are delivered via `@toolsmith` in
    Phase 3 (tasks 3.1 and 3.2). (Note: the "Per-Alterative" typo flagged in the pm-notes
    appears only in this change's own pm-notes description, not in any live source — verify
    and confirm clean; no live edit needed if already correct.)
- [x] **1.6** Confirm the template edit is **strictly additive** — no existing
  body section renamed/renumbered/reordered/removed; GH-60's section order
  preserved (spec NG-8, NFR-2). Body section order remains: Context, Problem
  Framing, Constraints (Hard Requirements), Decision Drivers, Mental Models &
  Techniques Used, Alternatives Considered, Decision, Trade-offs & Consequences,
  Implementation Plan, Verification Criteria, Confidence Rating, Lessons Learned
  (Retrospective), Examples & Usage (Optional), References.

**Acceptance Criteria**:

- Must: AC-GH46-6 (guide contains kernel D0-D14, R0-R3 + emergency, four-axis
  classification, decision rights, AI-authority model, per-type matrix,
  constraints/drivers discipline).
- Must: AC-GH46-7 (template has optional classification/governance/AI front
  matter + proportional-rendering guidance; GH-60 wording defects fixed).
- Must: AC-GH46-8 (R0 produces no record; R1 is a strict proper subset of R3;
  R1 cycle <= 1 business day — defined here).
- Should: AC-GH46-14 (existing records remain valid; additive only).

**Files and modules**:

- `doc/guides/decision-making.md` (new)
- `doc/guides/decision-records-management.md` (updated — demoted to record-artifact reference)
- `doc/templates/decision-record-template.md` (updated — additive front matter + proportional rendering + GH-60 fixes)

**Tests**:

- The new guide's table of contents shows all ten content areas; the per-type
  matrix is a single matrix (no catalog directory).
- The template's new front-matter blocks are all marked optional; a prior-shape
  record (front matter only) still renders; no body section moved.
- The template Context comment no longer conflates Context with Constraints;
  "non-negotiable" no longer appears in the template.

**Completion signal**: `docs(GH-46): add process-first decision-making guide and rigor-aware template`

---

### Phase 2: Agent topology — rename @architect to @decision-advisor + new @decision-critic (`.opencode/` track, via `@toolsmith`)

**Goal**: Land the unified domain-neutral orchestrator and the independent
challenger. Crucially, the orchestrator prompt must contain **no baked-in body
structure** — it references the template (RD-3, the single biggest drift fix).

> **Routing note (per `AGENTS.md`)**: These artifacts live under `.opencode/agent/`.
> The delivery agent (`@coder`) MUST delegate these edits to **`@toolsmith`** — it
> specializes in model-format-aware agent/command design. Do not hand-edit these
> files directly. **License headers must NOT be added by the agent**; they are
> applied in Phase 6 via `scripts/add-header-location.sh`.

**Tasks**:

- [x] **2.1** **Delegate to `@toolsmith`** to `git mv
  .opencode/agent/architect.md` -> `.opencode/agent/decision-advisor.md` (preserve
  history), then rewrite the file:
  - Frontmatter `description`: domain-neutral orchestrator for **all five types**
    (ADR/PDR/TDR/BDR/ODR), type-aware, decision-kernel-driven. Remove the
    architecture-only framing.
  - **Identity = domain-neutral** (spec F-6). State it explicitly owns all five
    types; no separate `@architect` is retained (architecture depth is the
    advisor's type-aware context mode reading specs/contracts/config/source).
  - **Type-aware context modes**: ADR/TDR -> specs/contracts/source; PDR ->
    roadmap/UX; BDR -> strategy/ICP/pricing; ODR -> runbooks/infra.
  - Run **triage -> classify (four axes) -> select rigor (R0-R3) -> assign rights
    (DACI) -> plan (D0-D14)**, with depth scaled by rigor profile.
  - **Remove the baked-in decision-record body section list** (the fenced code
    block at lines ~180-199 in the current file). Replace it with an instruction
    to **reference `doc/templates/decision-record-template.md`** for the body
    structure (RD-3). This is the key NFR-4 / AC-GH46-1 acceptance point.
  - Preserve **recommendation/decision separation**; **request human approval for
    R2/R3**; honor the bounded AI-authority model (spec F-5).
  - Keep the decision-record workflow contract (resolve number, one file, stage
    only that file, commit message format) but reference the template for body
  structure.
- [x] **2.2** **Delegate to `@toolsmith`** to create new
  `.opencode/agent/decision-critic.md` (read-only independent challenger per spec
  F-7):
  - Mission: detect framing errors, missing options, violated constraints, fragile
    assumptions / arbitrary weights, stakeholder harm, unsupported certainty, and
    automation bias; run a premortem.
  - **Independent of the advisor**: receives problem / evidence / constraints /
    options and, where practical, NOT the recommendation initially (spec F-7,
    RSK-4 mitigation). State explicitly that same-model/same-prompt agents are
    NOT independent evidence. **Independence honesty (RD-16 / RT-04):** for a
    single-model configuration the critic is explicitly a **first-pass check, NOT
    independent assurance**; **R3 ALWAYS requires a human reviewer** regardless of
    the critic's verdict; **recommend (do not mandate)** assigning a different
    model family to the critic where one is configured. This converts RSK-4's
    residual into a documented limitation rather than implicit false assurance.
  - Returns a verdict: **PASS / PASS_WITH_RISKS / REWORK**.
  - Frontmatter `description` + `mode: all` + `claude.model`. Read-only by default
    (no write to decision records).
- [x] **2.3** Confirm the advisor's `decision_type` default handling: type
  defaults to ADR **only when type is genuinely unspecified** (not when a
  non-architecture decision was misrouted) — spec NFR-3.
- [x] **2.4** Confirm **no baked-in body structure remains** in
  `decision-advisor.md` (grep for the fenced section list -> 0); confirm the
  advisor instructs reading the template.

**Acceptance Criteria**:

- Must: AC-GH46-1 (`@decision-advisor` named/renamed; domain-neutral; owns all
  five types; no baked-in body structure — references the template).
- Must: AC-GH46-2 (`@decision-critic` exists; read-only; independent of advisor;
  returns PASS / PASS_WITH_RISKS / REWORK).
- Must: AC-GH46-9 (AI-authority model reflected: recommendation != decision;
  R2/R3 request human approval).
- Should: NFR-3 (type defaults to ADR only when genuinely unspecified).

**Files and modules**:

- `.opencode/agent/decision-advisor.md` (renamed via `git mv` from `architect.md` + rewritten — via `@toolsmith`)
- `.opencode/agent/decision-critic.md` (new — via `@toolsmith`)
- `.opencode/agent/architect.md` (removed by the rename)

**Tests**:

- `git mv` preserved history (`git log --follow .opencode/agent/decision-advisor.md`).
- `decision-advisor.md` contains 0 fenced body-section lists; contains a
  reference to `doc/templates/decision-record-template.md`.
- `decision-critic.md` declares read-only behavior and the three-value verdict.

**Completion signal**: `refactor(GH-46): rename architect to decision-advisor and add decision-critic`

---

### Phase 3: Command refactors — /plan-decision, /write-decision, new /review-decision (`.opencode/` track, via `@toolsmith`)

**Goal**: Generalize the commands to the universal kernel: triage-to-rights
planning, a generic planning-summary tag with a back-compat alias, proportional
rendering, AI-assistance recording, recommendation != decision, no auto-Accept for
R2/R3, and an independent review command.

> **Routing note (per `AGENTS.md`)**: These artifacts live under
> `.opencode/command/`. Delegate every edit to **`@toolsmith`**. Do not hand-edit.

**Tasks**:

- [x] **3.1** **Delegate to `@toolsmith`** to generalize
  `.opencode/command/plan-decision.md`:
  - Update frontmatter `agent: architect` -> `agent: decision-advisor`; update
    `description` from "Interactive technical-decision planning session" to a
    domain-neutral description.
  - Add the **triage -> classify (four axes) -> select rigor (R0-R3) -> assign
    rights (DACI)** front-end to the session flow (spec F-10).
  - **Rename the emitted summary tag** from `<technical_decision_planning_summary>`
    to `<decision_planning_summary>` (generic) and provide a **back-compat alias**:
    `/write-decision` (and any consumer) accepts BOTH the legacy tag and the legacy
    `adr.*` fields, mapping them to the generic fields (spec DM-5, NFR-2). In the
    generic path, **0 `adr.*` fields are required** (NFR-3).
  - **Keep the GH-60 hard-requirements elicitation step** (the distinct
    constraint step + driver/constraint overlap detection + `hard_requirements:`
    field) — do not regress GH-60.
  - Add rigor/governance/ai-assistance capture to the summary so `/write-decision`
    can render proportionally.
  - **GH-60 carryover (RT-03):** neutralize the "non-negotiable" wording in
    `.opencode/command/plan-decision.md` → `negotiable: no` / neutral pass/fail wording
    (one of the five sources coordinated with task 1.5).
- [x] **3.2** **Delegate to `@toolsmith`** to generalize
  `.opencode/command/write-decision.md`:
  - Update frontmatter `agent: architect` -> `agent: decision-advisor`.
  - **Consume the generic `<decision_planning_summary>`** (and accept the legacy
    tag/fields via alias).
  - **Render proportionally** by rigor: R1 compact subset, R2 standard, R3 full
    (spec F-10, OQ-A).
  - **Record `ai_assistance`** provenance (used, roles, external_data_shared,
    citations_verified, human_decider, reviewers) — spec DM-3.
  - **Enforce recommendation != decision**: the writer outputs a Proposed record
    with the analyst/AI recommendation separate from the authorized decision.
  - **Do not mark Accepted for R2/R3 without an authorized human decision**;
    require `ai_assistance.human_decider` before any Accepted transition (spec
    F-10, RSK-7).
  - **Structural definition (RT-02):** after consolidating to ONE structural
    definition (task 3.5), it MUST match the template's section order with 0
    mismatches (NFR-4; verified in Phase 8). **GH-60 carryover (RT-03):** fix BOTH
    the "non-negotiable" wording (→ `negotiable: no`) AND the Context-conflation
    (drop "constraints" from the Context authoring rule) in `write-decision.md` —
    one of the five non-negotiable sources and one of the two Context-conflation
    sources (coordinated with task 1.5).
- [x] **3.3** **Delegate to `@toolsmith`** to create new
  `.opencode/command/review-decision.md`:
  - Frontmatter `agent: decision-critic`.
  - Invocation `/review-decision <ID>`; loads the decision record read-only;
    delegates to `@decision-critic` for independent challenge (D10); produces a
    review artifact/verdict (PASS / PASS_WITH_RISKS / REWORK) and **modifies
    nothing** by default (spec F-7).
- [x] **3.4** Confirm the command `agent:` frontmatter fields are all updated
  (`plan-decision`, `write-decision` -> `decision-advisor`; `review-decision` ->
  `decision-critic`).
- [x] **3.5** **Consolidate the two structural copies in `/write-decision`** (RT-02).
  The command currently carries BOTH `<decision_structure>` (the ordered heading list)
  AND `<embedded_template>` (a full body duplicate) — two structural definitions of the
  same record. Consolidate into **exactly ONE** structural definition that **references**
  `doc/templates/decision-record-template.md` as canonical — remove the redundant
  full-body `<embedded_template>` duplicate. **Goal:** `write-decision.md` contains
  exactly ONE structural definition, which references (not duplicates) the template.
  Phase 8 task 8.1 and TC-GH46-019 verify there is no second structural enumeration.

**Acceptance Criteria**:

- Must: AC-GH46-3 (`/plan-decision` performs triage/classification/rigor/rights;
  emits `<decision_planning_summary>`; accepts the legacy tag + `adr.*` via alias).
- Must: AC-GH46-4 (`/write-decision` renders proportionally; records
  `ai_assistance`; keeps recommendation separate from decision; does not auto-
  Accept R2/R3 without an authorized human decision).
- Must: AC-GH46-5 (`/review-decision <ID>` runs independent review via
  `@decision-critic`; modifies nothing).
- Must: AC-GH46-12 (write-decision's structure definition matches the template
  with 0 mismatches).
- Should: NFR-2 (legacy tag/fields accepted with 0 behavior change); NFR-3 (0
  `adr.*` required fields in the generic path).

**Files and modules**:

- `.opencode/command/plan-decision.md` (updated — via `@toolsmith`)
- `.opencode/command/write-decision.md` (updated — via `@toolsmith`)
- `.opencode/command/review-decision.md` (new — via `@toolsmith`)

**Tests**:

- Trace the updated `/plan-decision` flow against spec Flow 1: triage -> classify
  -> rigor -> rights -> D2-D9 -> generic `<decision_planning_summary>`.
- Confirm a legacy `<technical_decision_planning_summary>` with `adr.*` fields is
  still accepted by `/write-decision` (back-compat alias).
- Confirm `/write-decision` will not transition an R2/R3 record to Accepted when
  `human_decider` is absent.
- Confirm `/review-decision` is read-only and emits a three-value verdict.

**Completion signal**: `refactor(GH-46): generalize plan/write-decision and add review-decision`

---

### Phase 4: Meeting integration (Documentation + `.opencode/` tracks)

**Goal**: Route durable meeting decisions into the decision workflow; recognize
meeting discussion as legitimate evidence input; document the three decision modes;
update `@meeting-organizer` and the meeting guide to reference `@decision-advisor`.

**Tasks**:

- [x] **4.1** **Delegate to `@toolsmith`** to update `.opencode/agent/meeting-organizer.md`:
  - In Phase B (Summarize), change "Identify significant durable decisions ...
    delegate to `@architect` or suggest `/write-decision`" to route via
    `@decision-advisor`, and add: meeting discussion becomes **evidence input to
    `/plan-decision`**; durable decisions route to `/write-decision` (spec F-11).
  - In `<delegation_policy>`, rename the `<agent name="@architect">` entry to
    `<agent name="@decision-advisor">`.
  - Reference the **three decision modes**: (a) interactive AI session with human
    driver/decider; (b) meeting-driven (discussion as evidence input); (c)
    delegated AI autonomous action within R0-R1 bounds (spec F-11).
- [x] **4.2** Update `doc/guides/meeting-preparation-and-summarization.md`:
  - In §4.3 "File significant decisions", cross-link the new Decision-Making Guide
    and reference `@decision-advisor` (not `@architect`); note meeting discussion
    as evidence input to `/plan-decision`.
  - Document the three decision modes near the decision-framework guidance (§2.4).

**Acceptance Criteria**:

- Must: AC-GH46-10 (meeting discussion usable as evidence input to
  `/plan-decision`; durable decisions route to `/write-decision`; guide references
  `@decision-advisor`; three decision modes documented).

**Files and modules**:

- `.opencode/agent/meeting-organizer.md` (updated — via `@toolsmith`)
- `doc/guides/meeting-preparation-and-summarization.md` (updated — Documentation)

**Tests**:

- `meeting-organizer.md` contains 0 `@architect` references and references
  `@decision-advisor` + the three modes.
- The meeting guide §4.3 links the new Decision-Making Guide and names the three
  decision modes.

**Completion signal**: `docs(GH-46): integrate meeting decisions into the decision workflow`

---

### Phase 5: Live @architect reference sweep + system-spec reconciliation (Documentation + `.opencode/` tracks)

**Goal**: Update every **live** `@architect` reference to `@decision-advisor`,
update inbound links to the renamed guide, and reconcile the system feature specs.
Do NOT touch frozen change artifacts or this change's own spec/pm-notes.

**Tasks**:

- [ ] **5.1** **Documentation track** — sweep `@architect` -> `@decision-advisor`
  in live docs/guides/specs/templates/top-level files:
  - `AGENTS.md` (the agent-team table + the `coder` delegation line) -> reference
    `@decision-advisor`; add a one-line **migration note** documenting the rename.
  - `AGENTS.md` commands table (NFR-3, RT-07): rewrite the `/plan-decision`
    description from "Interactive architecture decision session" to a
    **domain-neutral** description (e.g., "Interactive decision planning session") —
    removes architecture-bias leakage.
  - `README.md` (the agent links list: replace `[@architect](.opencode/agent/architect.md)`
    with `[@decision-advisor](.opencode/agent/decision-advisor.md)`).
  - `.opencode/README.md` (agent/command inventory: rename `architect` entry, add
    `decision-advisor` + `decision-critic` agents and the `review-decision` command).
  - `doc/guides/change-lifecycle.md` (lines ~177, ~347: delegation/routing).
  - `doc/guides/onboarding-existing-project.md` (lines ~275, ~600); update the
    inbound link from `decision-records-management.md` to the new
    `decision-making.md` where appropriate.
  - `doc/guides/opencode-agents-and-commands-guide.md` (the agent table row for
    `@architect`).
  - `doc/templates/change-spec-template.md` (the OPEN-QUESTIONS table example
    "Decision needed: consult `@architect`" -> `@decision-advisor`).
  - `.ai/agent/pm-instructions.md` (line ~110: "Delegate to `@architect`" ->
    `@decision-advisor`).
- [ ] **5.2** **`.opencode/` track (via `@toolsmith`)** — sweep `@architect` ->
  `@decision-advisor` in the orchestration/implementation agents:
  - `.opencode/agent/pm.md` (~lines 85, 100, 426).
  - `.opencode/agent/spec-writer.md` (~line 171).
  - `.opencode/agent/plan-writer.md` (~line 99).
  - `.opencode/agent/coder.md` (~lines 36, 91, 133).
  - `.opencode/agent/bootstrapper.md` (~line 19).
- [ ] **5.3** **System-spec reconciliation (doc-syncer-equivalent):** update
  `doc/spec/features/feature-decision-records.md` (KPIs line ~36, F-5 line ~58,
  NFR-3 line ~171, Dependencies line ~185; the governance/Codebase-Map entries
  referencing `.opencode/agent/architect.md`) to reflect `@decision-advisor`,
  `@decision-critic`, `/review-decision`, the new rigor/rights/AI capabilities,
  and the new Decision-Making Guide; update
  `doc/spec/features/feature-document-templates.md` (the template->agent consumer
  table row: `decision-record-template.md` consumer `@architect` ->
  `@decision-advisor`; verify the body-section count stays accurate). Update both
  files' `last_updated` and `links.related_changes` (add `GH-46`).
- [ ] **5.4** Confirm the sweep **excludes** frozen artifacts: `chg-GH-60-*`,
  `chg-GH-52-*`, `chg-GH-32-*`, `chg-GH-36-*`, `chg-GH-26-*` and their
  feedback/test-plan/red-team files, plus this change's own `chg-GH-46-spec.md`
  and `chg-GH-46-pm-notes.yaml` (immutable history).

**Acceptance Criteria**:

- Must: AC-GH46-11 (every **live** `@architect` reference updated to
  `@decision-advisor`; inbound links to the renamed guide updated).
- Should: system feature specs reconciled with the new capabilities.

**Files and modules**:

- `AGENTS.md`, `README.md`, `.opencode/README.md` (updated — Documentation)
- `doc/guides/change-lifecycle.md`, `doc/guides/onboarding-existing-project.md`, `doc/guides/opencode-agents-and-commands-guide.md` (updated — Documentation)
- `doc/templates/change-spec-template.md` (updated — Documentation)
- `.ai/agent/pm-instructions.md` (updated — Documentation)
- `.opencode/agent/{pm,spec-writer,plan-writer,coder,bootstrapper}.md` (updated — via `@toolsmith`)
- `doc/spec/features/feature-decision-records.md`, `doc/spec/features/feature-document-templates.md` (reconciled — Documentation)

**Tests**:

- Grep live sources only (exclude `doc/changes/**` and this change's spec/pm-notes)
  for `@architect` and `architect.md` -> expect **0** matches after this phase
  (the generated `.ados-claude/**` is fixed by Phase 6, so exclude it here).
- `feature-decision-records.md` references `@decision-advisor`, `@decision-critic`,
  `/review-decision`, and the new guide.

**Completion signal**: `docs(GH-46): sweep @architect references and reconcile decision-record specs`

---

### Phase 6: Plugin regeneration + license headers (Generated + tooling)

**Goal**: Bring the generated Claude Code plugin back in sync with the `.opencode/`
source (the rename, new agent, and new command), and apply license headers to the
qualifying new files via the script (never by hand).

**Tasks**:

- [ ] **6.1** Run `scripts/build-claude-plugin.sh` to regenerate `.ados-claude/**`
  from the `.opencode/` source. Expected outputs: `.ados-claude/agents/decision-advisor.md`
  (was `architect.md`), new `.ados-claude/agents/decision-critic.md`, new
  `.ados-claude/skills/review-decision/SKILL.md` (commands are transformed into skill
  *directories* by `transform_command_to_skill`, NOT `commands/*.md`), and updated
  `.ados-claude/agents/{pm,spec-writer,plan-writer,coder,bootstrapper,meeting-organizer}.md`
  (auto-swept of `@architect`).
- [ ] **6.2** **Verify the generated plugin is in sync**: the generated files'
  generated-header comments name their `.opencode/` source and the regeneration
  command; confirm `.ados-claude/agents/architect.md` is removed and
  `decision-advisor.md` exists; confirm 0 stale `@architect` references in
  `.ados-claude/**`.
- [ ] **6.3** **Apply license headers via the script** (AI agents MUST NOT add
  headers by hand). Run:
  - `scripts/add-header-location.sh .opencode/agent`
  - `scripts/add-header-location.sh .opencode/command`
  - `scripts/add-header-location.sh doc/guides`
  This adds headers to the qualifying new files (`decision-making.md` guide,
  `decision-advisor.md`, `decision-critic.md`, `review-decision.md`) and is a
  no-op for files that already carry headers (the renamed `decision-advisor.md`
  retains its header from the `git mv`).
- [ ] **6.4** Confirm no proprietary runtime, secret, or network call was
  introduced (spec NFR-5).

**Acceptance Criteria**:

- Must: AC-GH46-11 (the generated Claude plugin is regenerated and in sync).
- Must: NFR-5 (git-native; no proprietary runtime).
- Should: all qualifying new files carry the standard ADOS license header added by
  the script (not by hand).

**Files and modules**:

- `.ados-claude/**` (regenerated — DO NOT hand-edit)
- New files in `.opencode/agent`, `.opencode/command`, `doc/guides` (headers applied by `scripts/add-header-location.sh`)

**Tests**:

- `scripts/build-claude-plugin.sh` runs clean; `git status` shows only generated
  `.ados-claude/**` changes (plus any header-only additions to new files).
- `rg '@architect' .ados-claude/` -> **0** matches.
- The new files carry the three-line ADOS license header.

**Completion signal**: `build(GH-46): regenerate Claude plugin and apply headers to new files`

---

### Phase 7: Dogfood — produce ADR-0001 via the new process

**Goal**: Validate the new process end-to-end on its own delivery by recording
GH-46's decisions (RD-1 … RD-16) as `ADR-0001` using `/plan-decision` +
`/write-decision` against the new process. This is intentionally **last**: the
dogfood ADR can only be cleanly produced AFTER the new commands/agents exist
(chicken-and-egg).

**Tasks**:

- [ ] **7.1** Determine the decision's rigor for the dogfood: GH-46 is a
  medium-risk refactor of a governance subsystem affecting all agents -> at least
  **R2**, arguably **R3** (org-wide agent-behavior change). Treat as R2/R3: produce
  a full record and keep `status: Proposed` (do not auto-Accept — require an
  authorized human decision per the new AI-authority model).
- [ ] **7.2** Run the new `/plan-decision` flow to produce a
  `<decision_planning_summary>` capturing GH-46's decisions RD-1 … RD-16 (one
  generalized orchestrator; rename to `@decision-advisor`; remove baked-in
  structure; process-first guide; consolidate into GH-46; dogfood; universal kernel
  + R0-R3 + emergency; DACI rights; bounded AI authority; lean critic +
  `/review-decision`; meeting integration; defer the heavy machinery; condensed
  guide matrix) plus OQ-A/OQ-B leans.
- [ ] **7.3** Run `/write-decision` to produce
  `doc/decisions/ADR-0001-<slug>.md` with full front matter (including the new
  optional `classification`/`governance`/`ai_assistance` blocks), the canonical
  body (referencing the template order), `status: Proposed`, and
  `ai_assistance.human_decider` recorded. Confirm recommendation != decision.
- [ ] **7.4** Optionally run `/review-decision ADR-0001` via `@decision-critic` to
  exercise the independent-challenge path and capture a verdict.
- [ ] **7.5** Update `doc/decisions/00-index.md` to list ADR-0001.

**Acceptance Criteria**:

- Must: AC-GH46-13 (ADR-0001 exists and captures RD-1 … RD-16).
- Should: AC-GH46-5 (the `/review-decision` path is exercised if run).

**Files and modules**:

- `doc/decisions/ADR-0001-<slug>.md` (new — produced by `/write-decision`)
- `doc/decisions/00-index.md` (updated)

**Tests**:

- ADR-0001 uses the template's body section order; contains all 14 decisions;
  status is Proposed (not auto-Accepted).
- The ADR front matter includes the new optional blocks, demonstrating they render.

**Completion signal**: `docs(adr): add ADR-0001-decision-making-framework (GH-46 dogfood)`

---

### Phase 8: Final consistency sweep + verification + release

**Goal**: Enforce the critical invariants — single source of truth for body
section order (NFR-4), 0 stale live `@architect` references (AC-GH46-11),
proportionality (NFR-1), backward compatibility (NFR-2), git-native (NFR-5), no
stored chain-of-thought (NFR-6) — and confirm every AC is met before review/PR
(spec §18).

**Tasks**:

- [ ] **8.1** **Cross-source section-order verification (NFR-4 / GH-60 NFR-1):**
  extract the decision-record body section order from (a)
  `doc/templates/decision-record-template.md` and (b) **ALL** structural enumerations in
  `.opencode/command/write-decision.md` (e.g., `<decision_structure>` AND any
  `<embedded_template>` / body block). After the RT-02 consolidation (task 3.5) there
  must be **exactly ONE** structural definition in `write-decision.md`; assert the count
  is 1 (guards against re-proliferation of a second full-body copy) and diff it against
  the template -> expect **0 mismatches**. Confirm `decision-advisor.md` contains **0**
  baked-in body-section list (the agent is no longer a source to sync — single source of
  truth is the template).
- [ ] **8.2** **Stale-reference grep:** `rg '@architect|architect\.md'` across
  live sources only (exclude `doc/changes/**`, this change's spec/pm-notes, and
  `.ados-claude/**`) -> expect **0** matches. Confirm `.ados-claude/**` also has
  **0** `@architect` matches.
- [ ] **8.3** **Proportionality check (NFR-1):** confirm the guide + template +
  commands define R0 = no record, R1 = strict proper subset of R3, R1 cycle <= 1
  business day, R2/R3 = full evidence + >=2 alternatives + baseline + review date.
- [ ] **8.4** **Backward-compat check (NFR-2):** confirm the legacy
  `<technical_decision_planning_summary>` tag and `adr.*` fields are accepted via
  alias with 0 behavior change; confirm all new template front-matter blocks are
  optional.
- [ ] **8.5** **Architecture-bias check (NFR-3):** confirm the generic path emits
  `<decision_planning_summary>` with 0 required `adr.*` fields; type defaults to
  ADR only when genuinely unspecified.
- [ ] **8.6** **No-hidden-CoT / git-native (NFR-5, NFR-6):** confirm records
  capture decision + rationale + assumptions only; 0 new runtime services; 0
  stored raw model chain-of-thought; 0 proprietary-binary artifacts.
- [ ] **8.7** **Spec reconciliation confirmation:** confirm
  `feature-decision-records.md` and `feature-document-templates.md` reflect the
  rename + new capabilities + new guide; confirm `version_impact: none` (no version
  bump).
- [ ] **8.8** **AC walk:** walk every AC-GH46-1 … AC-GH46-14 against the artifacts
  and mark each satisfied (see the AC coverage map below). Hand off to review
  (`/review GH-46`).

**Acceptance Criteria**:

- Must: All AC-GH46-1 … AC-GH46-14 satisfied and traceable.
- Must: NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-6 satisfied.
- Should: system feature specs reconciled; version impact = none confirmed.

**Files and modules**:

- No edits unless a drift/stale reference is found (then a corrective edit to the
  offending source via its track — Documentation or `@toolsmith`).

**Tests**:

- Side-by-side section-order comparison (template vs. write-decision structure) =
  identical.
- Final AC/NFR coverage matrix (every AC-GH46-* mapped to >= 1 phase task).

**Completion signal**: `docs(GH-46): finalize decision-making framework change`

---

## Deviation handling

- **If `@toolsmith` cannot be spawned** (as happened during GH-60 delivery, where
  no task/subagent tool was available): apply the **`customize-opencode` skill**
  discipline directly to the `.opencode/agent/*.md` and `.opencode/command/*.md`
  edits, and record the substitution in the Execution Log. The skill provides the
  model-format-aware authoring rules `@toolsmith` would apply. This does NOT relax
  the "never hand-edit `.ados-claude/`" rule — that output is always regenerated.
- **If `@doc-syncer` is not spawned:** reconcile `doc/spec/features/*` inline (the
  spec files are normal-documentation track; direct edits are permitted) and note
  the inline reconciliation in the Execution Log (mirrors the GH-60 precedent).
- **If the build script or headers script is unavailable:** STOP and surface the
  blocker; do not hand-author generated `.ados-claude/**` or hand-add license
  headers.

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | `@decision-advisor` is named/renamed, domain-neutral, owns all 5 types, references the template (0 baked-in body sections) | 2, 8 | AC-GH46-1 |
| TS-2 | `@decision-critic` is read-only, independent of the advisor, returns PASS / PASS_WITH_RISKS / REWORK | 2 | AC-GH46-2 |
| TS-3 | `/plan-decision` performs triage/classify/rigor/rights and emits `<decision_planning_summary>` while still accepting the legacy tag + `adr.*` | 3, 8 | AC-GH46-3 |
| TS-4 | `/write-decision` renders proportionally, records `ai_assistance`, keeps recommendation != decision, won't auto-Accept R2/R3 | 3, 8 | AC-GH46-4 |
| TS-5 | `/review-decision <ID>` runs `@decision-critic` read-only and emits a verdict | 3, 7 | AC-GH46-5 |
| TS-6 | Decision-Making Guide contains kernel D0-D14, R0-R3 + emergency, four-axis, rights, AI authority, per-type matrix, constraints/drivers discipline | 1 | AC-GH46-6 |
| TS-7 | Template has optional classification/governance/AI front matter + proportional rendering; GH-60 wording defects fixed | 1, 8 | AC-GH46-7 |
| TS-8 | R0 produces no record; R1 is a strict proper subset of R3, cycle <= 1 day | 1, 8 | AC-GH46-8 |
| TS-9 | AI authority model: allowed roles + bounds; autonomous only within delegated R0-R1; R2/R3 human final; recommendation != decision | 1, 2, 3 | AC-GH46-9 |
| TS-10 | Meeting discussion is evidence input to `/plan-decision`; durable decisions route to `/write-decision`; guide references `@decision-advisor`; 3 modes documented | 4 | AC-GH46-10 |
| TS-11 | Every live `@architect` reference -> `@decision-advisor`; inbound links updated; plugin regenerated and in sync | 5, 6, 8 | AC-GH46-11 |
| TS-12 | Template is the single source of truth for body order; write-decision structure matches with 0 mismatches | 3, 8 | AC-GH46-12 |
| TS-13 | ADR-0001 exists and records RD-1 … RD-16 | 7 | AC-GH46-13 |
| TS-14 | Existing records remain valid; 0 new runtime; 0 stored chain-of-thought | 1, 8 | AC-GH46-14 |

## Task-to-AC coverage

| AC | Covered by tasks |
|----|------------------|
| AC-GH46-1 | 2.1, 2.3, 2.4, 8.1 |
| AC-GH46-2 | 2.2 |
| AC-GH46-3 | 3.1, 8.5 |
| AC-GH46-4 | 3.2, 8.3 |
| AC-GH46-5 | 3.3, 7.4 |
| AC-GH46-6 | 1.1 |
| AC-GH46-7 | 1.3, 1.4, 1.5, 1.6 |
| AC-GH46-8 | 1.1, 1.4, 8.3 |
| AC-GH46-9 | 1.1, 2.1, 3.2 |
| AC-GH46-10 | 4.1, 4.2 |
| AC-GH46-11 | 5.1, 5.2, 5.3, 6.1, 6.2, 8.2 |
| AC-GH46-12 | 2.4, 3.2, 8.1 |
| AC-GH46-13 | 7.2, 7.3 |
| AC-GH46-14 | 1.3, 1.6, 8.4, 8.6 |

**Coverage:** 14 / 14 acceptance criteria mapped to >= 1 concrete task. Every
phase (1-8) contributes to >= 1 AC; AC-GH46-11 (reference integrity) is the most
widely distributed (Phases 5, 6, 8).

## Artifacts and Links

| Artifact | Location | Type | Track |
|----------|----------|------|-------|
| Change specification | ./chg-GH-46-spec.md | Spec | — |
| Implementation plan (this file) | ./chg-GH-46-plan.md | Plan | — |
| PM notes | ./chg-GH-46-pm-notes.yaml | Planning notes | — |
| Decision-Making Guide | `doc/guides/decision-making.md` | New | Documentation |
| Decision-records-management guide | `doc/guides/decision-records-management.md` | Updated (demoted) | Documentation |
| Decision-record template | `doc/templates/decision-record-template.md` | Updated (additive) | Documentation |
| `@decision-advisor` agent | `.opencode/agent/decision-advisor.md` | Renamed + rewritten | `.opencode/` (via `@toolsmith`) |
| `@decision-critic` agent | `.opencode/agent/decision-critic.md` | New | `.opencode/` (via `@toolsmith`) |
| `/plan-decision` command | `.opencode/command/plan-decision.md` | Updated | `.opencode/` (via `@toolsmith`) |
| `/write-decision` command | `.opencode/command/write-decision.md` | Updated | `.opencode/` (via `@toolsmith`) |
| `/review-decision` command | `.opencode/command/review-decision.md` | New | `.opencode/` (via `@toolsmith`) |
| `@meeting-organizer` agent | `.opencode/agent/meeting-organizer.md` | Updated | `.opencode/` (via `@toolsmith`) |
| Meeting guide | `doc/guides/meeting-preparation-and-summarization.md` | Updated | Documentation |
| Orchestration/impl agents (pm, spec-writer, plan-writer, coder, bootstrapper) | `.opencode/agent/*.md` | Updated (sweep) | `.opencode/` (via `@toolsmith`) |
| Top-level docs | `AGENTS.md`, `README.md`, `.opencode/README.md` | Updated (sweep) | Documentation |
| Guides | `doc/guides/{change-lifecycle,onboarding-existing-project,opencode-agents-and-commands-guide}.md` | Updated (sweep) | Documentation |
| Change-spec template | `doc/templates/change-spec-template.md` | Updated (sweep) | Documentation |
| PM instructions | `.ai/agent/pm-instructions.md` | Updated (sweep) | Documentation |
| Feature spec: decision records | `doc/spec/features/feature-decision-records.md` | Reconciled | Documentation |
| Feature spec: document templates | `doc/spec/features/feature-document-templates.md` | Reconciled | Documentation |
| Generated Claude plugin | `.ados-claude/**` | Regenerated | Generated (`scripts/build-claude-plugin.sh`) |
| Dogfood decision record | `doc/decisions/ADR-0001-<slug>.md` | New | Produced by `/write-decision` |
| Decision index | `doc/decisions/00-index.md` | Updated | Documentation |
| Related (dependency) | GH-60 / PR #61 — structural/template axis (merged) | Related change | — |
| Related (complementary) | GH-57 — Definition of Ready (open) | Related change | — |
| Related (complementary) | GH-58 — stakeholders/team topology (open) | Related change | — |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-24 | plan-writer | Initial plan authored from `chg-GH-46-spec.md`; 8 phases across two routing tracks (Documentation + `.opencode/` via `@toolsmith`) plus a generated-plugin regeneration phase and a dogfood phase; AC coverage 1-14; cross-source section-order consistency and stale-reference grep as a dedicated final verification phase. Resolved open questions: branch type `refactor/GH-46/...` (spec `change.type: refactor` authoritative over the pm-notes `feat` lean); `@architect` historical references intentionally excluded from the sweep. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | COMPLETED | 2026-06-24 | 2026-06-24 | c8af272 | New decision-making.md (10 sections); demoted records-mgmt guide; additive template front matter + proportional rendering; GH-60 defects fixed in docs (template+guide); body order preserved (additive). |
| 2 | COMPLETED | 2026-06-24 | 2026-06-24 | f86edb6 | git mv architect.md -> decision-advisor.md (history preserved) + rewrite (domain-neutral, 5 types, type-aware modes, no baked-in structure, references template, R2/R3 human approval); new decision-critic.md (read-only, RD-16 independence honesty, tri-state verdict). @toolsmith not spawnable -> applied customize-opencode skill discipline (GH-60 precedent). |
| 3 | COMPLETED | 2026-06-24 | 2026-06-24 | 4a49bdf | plan-decision.md generalized (triage->classify->rigor->rights; <decision_planning_summary> + legacy alias; GH-60 wording fixed); write-decision.md generalized (proportional rendering, ai_assistance, rec!=decision, no auto-Accept R2/R3; RT-02: embedded_template removed -> single structural definition mirroring template; GH-60 fixes); new review-decision.md (read-only critic, tri-state verdict). |
| 4 | COMPLETED | 2026-06-24 | 2026-06-24 | _(pending commit)_ | meeting-organizer.md routes via @decision-advisor (evidence input -> /plan-decision; durable -> /write-decision); delegation_policy @architect -> @decision-advisor; three decision modes documented. Meeting guide §2.4 documents three modes; §4.3 cross-links Decision-Making Guide + @decision-advisor. 0 @architect in meeting files. |
