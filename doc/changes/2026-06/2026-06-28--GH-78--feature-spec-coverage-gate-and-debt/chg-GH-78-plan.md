---
id: chg-GH-78-feature-spec-coverage-gate-and-debt
status: Updated
created: 2026-06-28T00:00:00Z
last_updated: 2026-06-28T07:23:58Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["docs", "process", "spec-coverage", "feature-specs", "gh-79"]
links:
  change_spec: ./chg-GH-78-spec.md
summary: >
  Combined single-PR delivery closing two linked tickets. GH-78 adds an
  operational, falsifiable "feature spec coverage" check to clarify_scope
  (phase 1, awareness) and system_spec_update (phase 7, @doc-syncer reports
  spec_coverage_gaps; @pm proposes a de-noised follow-up; human approves any
  ticket). GH-79 retires the audited feature-spec debt by creating 8 missing/
  partial P0–P2 feature specs authored from authoritative sources (prompts/
  AGENTS.md/scripts; guides as mirrors), cross-linked not duplicated, marked
  ados_distribution: internal, headed via the script.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-78: Spec-coverage gate and feature-spec debt reduction (GH-78 + GH-79)

## Context and Goals

This plan operationalizes change spec `chg-GH-78-spec.md` as two reviewable parts
in one PR (DEC-1):

- **Part A — GH-78 (process fix / behavior):** add the "feature spec coverage"
  check to `@doc-syncer` (phase 7) and coverage awareness to `@pm` intake
  (phase 1), plus document it in the lifecycle guide. Because Part A edits
  `.opencode/**`, the Claude plugin (`.ados-claude/**`) MUST be regenerated and
  committed in the same commit as the source edits (the 1:1 invariant, NFR-7).
- **Part B — GH-79 (specification only):** author 8 feature specs in
  `doc/spec/features/` from the authoritative source map in spec §5.1.

Both parts are documentation/process-only; GH-79 changes no behavior, and GH-78
adds only a read/report behavior plus intake awareness. The plan is sequenced by
**reviewability**, not strict blocking: Part A lands first (it is the gate the
specs are the answer to); P0 → P1 → P2 specs follow in priority order. All 8
specs resolve their cross-links at merge time, so intra-PR ordering is not a
dependency.

Resolved up front (from the spec, not re-litigated here): DEC-1 (single PR),
DEC-2 (`internal` markers), DEC-3 (cross-link, don't duplicate), DEC-4 (11-phase
lifecycle, doc-syncer = phase 7), DEC-5 (operational "feature area" definition),
DEC-6 (doc-syncer reports → PM proposes de-noised → human approves), DEC-7
(local review = companion spec), DEC-8 (headers via script only).

**Open questions** (carried from spec §14; surfaced to human, NOT auto-resolved):

- **OQ-1** — Should `spec_coverage` become a **hard DoR facet** in
  `@readiness-reviewer` (instead of advisory intake + post-delivery reporting)?
  *Decision needed: consult `@decision-advisor`.* Captured as spec §7.3 follow-up.
  This plan deliberately does NOT add a hard facet.
- **OQ-2** — Should DM-2 (the distribution guard's scan set) be extended to
  `doc/spec/features/**` (forcing guard-enforcement + retroactive marking of the
  8 existing specs)? *Captured as spec §7.3 follow-up; out of scope (NG-4).*

## Scope

### In Scope

- **F-1** — feature spec coverage check at two points: `@doc-syncer` Identify
  Impact (phase 7) reports `spec_coverage_gaps`; `@pm` clarify_scope (phase 1)
  records coverage awareness. (AC-F1-1 … AC-F1-5)
- **F-2 / DM-1** — operational "feature area" definition (warrants a
  `feature-<slug>.md`). (AC-F1-6)
- **DM-2** — `spec_coverage_gaps` report field (report-only, no side effect).
- **F-3** — 8 feature specs: F-3.1 `feature-delivery-lifecycle.md`, F-3.2
  `feature-agents-and-commands.md`, F-3.3 `feature-decision-making.md`, F-3.4
  `feature-claude-plugin-generation.md`, F-3.5 `feature-quality-gates-and-pr.md`,
  F-3.6 `feature-doc-distribution-marker.md`, F-3.7 `feature-local-code-review.md`,
  F-3.8 `feature-external-researcher.md`. (AC-F3-1 … AC-F3-9)
- **F-4** — each spec authored from authoritative sources; guide-vs-prompt
  discrepancies recorded as follow-up notes (prompt wins). (AC-F4-2)
- **F-5 / NFR-3 / NFR-4** — `ados_distribution: internal` on all 8; headers via
  `scripts/add-header-location.sh <file>` only. (AC-F5-1, AC-F5-2)
- **NFR-7** — `.ados-claude/**` regenerated (once) in the same commit as the
  Part A `.opencode/**` edits. (AC-F1-7)
- **NFR-6** — every new spec states the **11**-phase lifecycle; no "10-phase".
- Documentation of the coverage check in `doc/guides/change-lifecycle.md` §7
  (AC-F1-5) and an optional light intake note in `definition-of-ready.md`.

### Out of Scope

- **NG-1** — No agent behavior change beyond the spec-coverage flagging/awareness
  in F-1. GH-79 changes no prompts/scripts/commands.
- **NG-2** — P3 minor agents (meeting-organizer, image-reviewer, editor,
  designer) unspecced.
- **NG-3 / OUT** — Installer/onboarding spec GH-77 (cross-linked TBD only).
- **NG-4 / OUT** — Do NOT extend `install.sh` or `test-doc-distribution.sh` to
  scan `doc/spec/**`. The marker on feature specs stays honest-but-unenforced.
- **NG-5 / OUT** — Do NOT retroactively mark the 8 existing feature specs (all
  currently unmarked — verified).
- **NG-6 / OUT** — No automated feature-area detection script (check is
  prompt-described behavior).
- **NG-7 / OUT** — No split into two PRs (DEC-1).
- **OQ-1 (deferred)** — `spec_coverage` as a hard DoR facet (advisory only here).
- **Proposal C (deferred)** — periodic standalone coverage audit (documented as
  deferred, not built).
- Retroactively header-marking / changing the 8 existing specs beyond cross-link
  reads.

### Constraints

- **`.opencode/` + regen invariant (NFR-7):** every commit that edits a file
  under `.opencode/` MUST also include the regenerated `.ados-claude/` output in
  the SAME commit. Part B (specs) touches no `.opencode/` file → no further
  regen after Phase 1.
- **No ticket creation (DEC-6):** `@doc-syncer` reports gaps; `@pm` proposes a
  de-noised follow-up; ONLY the human approves ticket creation. The plan itself
  creates zero tickets.
- **Header hygiene (DEC-8):** AI must NOT hand-add license header comment lines.
  New specs are authored with frontmatter minus the copyright/MIT/source lines;
  the script injects them.
- **Source hierarchy (F-4):** prompts/AGENTS.md/scripts are authoritative; guides
  (several `status: Draft`) are mirrors; where they differ the prompt wins and
  the divergence is recorded as a follow-up note in the spec.
- **DM-2 frozen:** the distribution guard's scan set (`doc/guides`,
  `doc/templates/**`, 5 standalone docs) is unchanged; `doc/spec/**` stays
  outside it, so the new `internal` markers cannot break the guard.

### Risks

- **RSK-1** (Spec≠behavior) — Mitigated by source hierarchy (F-4): author from
  prompts/AGENTS.md/scripts; record Draft-guide divergences as follow-up notes.
- **RSK-2** (Large mixed diff) — Mitigated by the Part A / Part B phase split and
  the per-spec coverage table (spec §5.1); each spec is its own reviewable unit.
- **RSK-3** (`doc/spec/**` outside automation) — Mitigated by the dedicated
  header+marker phase (Phase 6) running the explicit-path script per file; the
  unenforced-marker situation is accepted and recorded (OQ-2 follow-up).
- **RSK-4** ("feature area" subjectivity) — Mitigated by the operational
  definition (F-2/DM-1) + de-noising + human gate.
- **RSK-5** (doc-syncer scope-creep into ticketing) — Mitigated by the explicit
  REPORT-only rule (DEC-6) added to the prompt in Phase 1.
- **RSK-6** (single PR for two tickets) — Accepted (DEC-1); Part A/B are
  independently reviewable.
- **RSK-7** (disrupting the stable remote-review spec) — Mitigated by the
  companion choice (DEC-7): `feature-local-code-review.md` is additive; the
  remote spec is read-only here.

### Success Metrics

| Metric | Target |
|--------|--------|
| New P0–P2 feature specs created | 8 / 8 (F-3.1…F-3.8) |
| New specs citing ≥1 authoritative source | 8 / 8 (100%) — NFR-1 |
| Restated lifecycle/convention/record rules in new specs | 0 (cross-links) — NFR-2 |
| Lifecycle places describing the coverage check | ≥3 (doc-syncer prompt, clarify_scope, lifecycle guide §7) |
| New specs carrying `ados_distribution: internal` | 8 / 8 (100%) — NFR-3 |
| Hand-added license headers | 0 — NFR-4 |
| New specs referencing the 11-phase lifecycle | 8 / 8; "10-phase" refs = 0 — NFR-6 |
| `.ados-claude/` regeneration set == Part A `.opencode/` edit set | exact 1:1 — NFR-7 |

## Phases

### Phase 1: Part A — Agent coverage-gate prompts + plugin regeneration

**Goal**: Add the falsifiable feature-spec-coverage check to `@doc-syncer` and the
coverage-awareness to `@pm` intake, and regenerate `.ados-claude/` in the same
commit (the source+generated invariant).

**Tasks**:

- [x] **1.0** PRECONDITION — plugin-baseline freshness (run BEFORE any
  `.opencode/` edit): execute
  `scripts/build-claude-plugin.sh && git diff --stat -- .ados-claude/` and
  require **EMPTY** output. This proves the committed `.ados-claude/` baseline is
  current (the build is deterministic — hardcoded "2025-2026" range, static
  `1.0.0` manifest — so an empty pre-diff is the correct baseline). This converts
  the post-edit "diff = exactly 2 files" expectation (AC-F1-7 / NFR-7 / TS-1) from
  an assumption into a proven precondition: if the pre-diff is non-empty, STOP —
  the committed plugin is already stale and must be reconciled before proceeding.
  *(PASS — pre-diff EMPTY, baseline fresh at 51317e7)*
- [x] **1.1** READ `.opencode/agent/doc-syncer.md` (current step 2 "Identify
  Impact" + `<reporting>` + `<rules>`), `chg-GH-78-spec.md` §5.1 F-1/F-2, and
  `doc/guides/change-lifecycle.md` §7. *(DONE)*
- [x] **1.2** EDIT `.opencode/agent/doc-syncer.md`:
  - Add a **"Feature spec coverage"** sub-check to step 2 "Identify Impact": for
    each feature area the change modifies, look for
    `doc/spec/features/feature-<slug>.md`. This is the missing **positive**
    check ("is there a spec for what we changed?") distinct from reconciliation
    ("does the spec still match?").
  - Add the **operational "feature area" definition (F-2/DM-1)** inline: a
    capability is a feature area iff it warrants a
    `doc/spec/features/feature-<slug>.md` — a coherent, nameable capability a
    contributor/reviewer would expect a spec for. Routine edits/bug fixes to
    already-specced areas are not new feature areas.
  - Add the **handoff rule (DEC-6)** to `<rules>`: doc-syncer **REPORTS**
    `spec_coverage_gaps`; it never creates a spec or a ticket; `@pm` checks open
    issues for an existing tracker and **references** it (de-noising) rather than
    proposing a duplicate, then **proposes** a follow-up; **only the human**
    approves ticket creation.
  - Add a `spec_coverage_gaps` field (DM-2) to the `<reporting>` structured
    report: a list of modified feature areas lacking a spec (empty when covered).
  *(DONE — all 4 sub-edits applied; grep confirms 10 coverage-phrase matches in source)*
- [x] **1.3** READ `.opencode/agent/pm.md` step "3 Clarify scope" (3b) and the
  phase-definition block. *(DONE)*
- [x] **1.4** EDIT `.opencode/agent/pm.md` clarify_scope (step 3b): add
  **coverage awareness** — when scoping, note whether the touched feature areas
  have a spec in `doc/spec/features/`, and record a known coverage gap in
  `chg-<workItemRef>-pm-notes.yaml`. State explicitly that coverage is **not a
  delivery blocker** (advisory; surfaced again at `system_spec_update`).
  *(DONE — "Feature spec coverage awareness" bullet added; advisory-only stated)*
- [x] **1.5** REGEN: run `scripts/build-claude-plugin.sh`. (Do NOT hand-edit
  `.ados-claude/**`.) *(DONE — build OK: 23 agents, 20 skills)*
- [x] **1.6** VERIFY the regen diff is exact. The build script regenerates ALL
  outputs but content changes follow sources. Assert:
  `git diff --stat .ados-claude/` shows ONLY:
  - `.ados-claude/agents/doc-syncer.md`
  - `.ados-claude/agents/pm.md`
  (Generated paths derive from `build-claude-plugin.sh`:
  `.ados-claude/agents/<name>.md` per `.opencode/agent/<name>.md`, and
  `.ados-claude/skills/<name>/SKILL.md` per `.opencode/command/<name>.md`. No
  command was edited → no `skills/**` diff. The manifest
  `.ados-claude/.claude-plugin/plugin.json` is static `1.0.0` → no diff.)
  If anything else changed, STOP and reconcile (a non-source diff means an
  undeterministic/stale prior generation).
  *(PASS — diff = exactly doc-syncer.md + pm.md; no skills/manifest drift)*
- [x] **1.7** Hand off to `@committer`: stage `.opencode/agent/doc-syncer.md`,
  `.opencode/agent/pm.md`, `.ados-claude/agents/doc-syncer.md`,
  `.ados-claude/agents/pm.md` and commit as ONE unit (the invariant).
  *(DONE — commit 90ee1fb; source+generated in one commit)*

**Phase 1 Acceptance Criteria** — PASSED:
- AC-F1-1 (doc-syncer Identify Impact has the coverage check + `spec_coverage_gaps`) — PASSED
- AC-F1-2 (doc-syncer reports, never tickets) — PASSED
- AC-F1-3 (de-noising rule stated) — PASSED
- AC-F1-4 (pm.md clarify_scope coverage awareness) — PASSED
- AC-F1-6 (operational feature-area definition present) — PASSED
- AC-F1-7 / NFR-7 (`.ados-claude/` regenerated, exact 2-file diff) — PASSED

**Acceptance Criteria**:

- Must: AC-F1-1 (doc-syncer Identify Impact has the coverage check +
  `spec_coverage_gaps`), AC-F1-2 (doc-syncer reports, never tickets), AC-F1-3
  (de-noising rule stated), AC-F1-4 (pm.md clarify_scope coverage awareness),
  AC-F1-6 (operational feature-area definition present), AC-F1-7 / NFR-7
  (`.ados-claude/` regenerated, exact 2-file diff).
- Should: the coverage check phrasing is grep-distinguishable (see Phase 7).

**Affected code areas**:

- `.opencode/agent/doc-syncer.md` (updated — Identify Impact sub-check, new
  `<reporting>` field, handoff `<rules>`)
- `.opencode/agent/pm.md` (updated — clarify_scope step 3b coverage awareness)

**System docs to update**:

- `.ados-claude/agents/doc-syncer.md` (regenerated — tracks source)
- `.ados-claude/agents/pm.md` (regenerated — tracks source)

**Tests**:

- `bash scripts/.tests/test-build-claude-plugin.sh` — confirms generation is
  deterministic and the generated tree matches a fresh build (freshness oracle).
- Manual: read the two generated files and confirm the coverage-check text is
  present and byte-identical to the source body.

**Completion signal**: `feat(GH-78): add feature-spec coverage check to doc-syncer + PM intake (regen plugin)`

---

### Phase 2: Part A — Lifecycle & DoR guide documentation + deferred Proposal C

**Goal**: Document the coverage check in the human-readable lifecycle, add the
optional intake awareness note to the DoR guide, and record Proposal C as a
deferred alternative. (No `.opencode/` edits here → no regen.)

**Tasks**:

- [x] **2.1** READ `doc/guides/change-lifecycle.md` (§7 `system_spec_update`,
  lines ~233–249) and `chg-GH-78-spec.md` F-1. *(DONE)*
- [x] **2.2** EDIT `doc/guides/change-lifecycle.md` §7 (`system_spec_update`):
  document the feature-spec-coverage check — `@doc-syncer` identifies modified
  feature areas, looks for `doc/spec/features/feature-<slug>.md`, and reports
  gaps in `spec_coverage_gaps`; `@pm` proposes a de-noised follow-up; only the
  human approves ticket creation (DEC-6). Reference the operational "feature area"
  definition (F-2) defined authoritatively in the doc-syncer prompt. *(DONE)*
- [x] **2.3** EDIT `doc/guides/change-lifecycle.md` §7: add a one-line
  **"Deferred alternative"** note that a periodic standalone coverage audit
  (Proposal C) was considered and is deferred in favor of the inline checks; link
  to change spec GH-78 §7.3. (This records Proposal C as DEFERRED.) *(DONE — blockquote note added)*
- [x] **2.4** (Optional, lightweight) READ
  `doc/guides/definition-of-ready.md` (current facets + the "prompt wins"
  statement on line 15). EDIT it to add a **coverage-awareness note** clarifying
  that spec coverage is tracked at intake (advisory) and reported at
  `system_spec_update`, and is **NOT** a hard DoR facet (the hard-facet option is
  deferred — OQ-1). Do NOT add a `spec_coverage` facet to the DoR facet list.
  *(DONE — advisory note added; no new facet added)*

**Phase 2 Acceptance Criteria** — PASSED:
- AC-F1-5 (lifecycle §7 documents the coverage check) — PASSED
- NFR-6 (no stale phase numbering; doc-syncer stays phase 7) — PASSED (grep-verified)
- Should: DoR advisory note present; Proposal C recorded as deferred — PASSED

**Acceptance Criteria**:

- Must: AC-F1-5 (lifecycle §7 documents the coverage check), NFR-6 (no stale
  phase numbering introduced — keep 11-phase; doc-syncer stays phase 7).
- Should: the DoR guide carries the advisory (non-facet) note; the deferred
  Proposal C is visibly recorded.

**Affected code areas**:

- none (documentation only)

**System docs to update**:

- `doc/guides/change-lifecycle.md` (updated — §7 coverage check + deferred Proposal C)
- `doc/guides/definition-of-ready.md` (updated — optional intake coverage-awareness note)

**Tests**:

- Manual: confirm §7 still describes phase 7 as `system_spec_update` and the
  mermaid diagram is unchanged (no phase-count drift).
- Grep: no occurrence of "10-phase" introduced in either guide.

**Completion signal**: `docs(GH-78): document coverage check in lifecycle/DoR guides; record deferred audit`

---

### Phase 3: Part B P0 — feature-delivery-lifecycle + feature-agents-and-commands

**Goal**: Author the two P0 specs (the most-referenced capabilities) from
authoritative sources, cross-linking canonical content rather than restating it.

> Authoring rules for ALL spec phases (3–5): follow
> `doc/templates/feature-spec-template.md` structure; cite ≥1 authoritative
> source (prompt/AGENTS.md/script) per spec (NFR-1); cross-link — do NOT restate
> — canonical lifecycle/convention/decision-record rules (NFR-2); state the
> **11**-phase lifecycle (NFR-6); write frontmatter WITH
> `ados_distribution: internal` but **WITHOUT** the copyright/MIT/source header
> lines (Phase 6 applies headers via the script — DEC-8); where a `status: Draft`
> guide disagrees with a prompt, follow the prompt and record the discrepancy as
> a "Follow-ups / discrepancies" note in the spec (F-4).
>
> **Sibling cross-links (GH-79 sub-AC — "each new spec cross-references related
> specs"):** beyond cross-links to EXISTING specs, each NEW spec must cross-link
> ≥1 SIBLING new spec where genuinely adjacent. Expected sibling links:
> - **F-3.1 (delivery-lifecycle) ↔ F-3.5 (quality-gates-and-pr)** — phases 8–11
>   (review_fix, quality_gates, dod_check, pr_creation) are F-3.5's scope.
> - **F-3.2 (agents-and-commands) ↔ F-3.4 (claude-plugin-generation)** — plugin
>   generation is the multi-tool mechanism for the agents system, and the
>   model-config nuance straddles both.
> - **F-3.7 (local-code-review) ↔ F-3.5 (quality-gates-and-pr)** — both cover the
>   review/commit/PR neighborhood.
>
> **Orientation vs duplication (makes the TC-HYGIENE-001 step-4 judgment
> reviewable):** cross-links must ORIENT the reader, not restate content.
> - **OK:** *"The lifecycle is 11 phases ending in `pr_creation`; see `AGENTS.md`
>   for the full table."*
> - **NOT OK:** re-listing all 11 phases with owners/agents.

**Tasks**:

- [x] **3.1** READ (F-3.1 sources): `AGENTS.md` (11-phase table), the lifecycle
  prompts `.opencode/agent/{pm,spec-writer,test-plan-writer,plan-writer,readiness-reviewer,coder,doc-syncer,reviewer,committer,pr-manager}.md`,
  `.opencode/command/*.md`, `doc/guides/change-lifecycle.md`,
  `doc/guides/definition-of-ready.md`,
  `doc/guides/unified-change-convention-tracker-agnostic-specification.md`.
- [x] **3.2** CREATE `doc/spec/features/feature-delivery-lifecycle.md`
  (F-3.1 / AC-F3-2): cover the **11**-phase spec→plan→deliver→review→PR gated
  workflow, `@pm` orchestration, **phase reopening** (gaps reopen earlier
  phases; DoR `NOT_READY` reopens artifact phases, never `delivery`), **DoR/DoD
  gating** (phase 5 / phase 10), and the **artifact set**
  (`chg-<ref>-{spec,test-plan,plan,pm-notes}.md`). Cross-link (do not restate)
  `doc/guides/change-lifecycle.md` and `doc/guides/unified-change-convention-tracker-agnostic-specification.md`
  for branch/folder/phase mechanics. Record any Draft-guide vs prompt
  discrepancy as a follow-up note.
- [x] **3.3** READ (F-3.2 sources): `.opencode/README.md`, `AGENTS.md`
  ("Multi-tool support" + "Repo structure"), sample
  `.opencode/agent/*.md` frontmatter (the `claude:` block),
  `scripts/build-claude-plugin.sh` (lines ~254–291 `transform_agent_frontmatter`,
  and `transform_command_to_skill`), `.opencode/opencode.jsonc` (the per-repo
  config — NOT a bare `opencode*.jsonc` glob, which matches nothing at repo
  root; its line 25 delegates per-agent model assignment to user-global config),
  and `doc/guides/opencode-model-configuration.md` (the accurate model-config
  mechanism reference).
- [x] **3.4** CREATE `doc/spec/features/feature-agents-and-commands.md`
  (F-3.2 / AC-F3-3): cover the `.opencode/` system as "the product" (single
  source of truth), the agent/command inventory, the **model-configuration
  nuance** stated precisely — `claude.model` in an agent's frontmatter is a
  **Claude-Code-targeted hint** consumed by `scripts/build-claude-plugin.sh`
  (it reads `claude.model`, defaults to `sonnet`, and writes `model:` into the
  generated `.ados-claude/agents/<name>.md`); OpenCode ignores the `claude:`
  key; the **OpenCode-effective** model assignment is a **MECHANISM** — the
  per-repo `.opencode/opencode.jsonc` delegates per-agent model selection to the
  user's global OpenCode config (see `.opencode/opencode.jsonc` line 25 and
  `doc/guides/opencode-model-configuration.md`); the two concerns (Claude hint
  vs OpenCode-effective model) are independent — do not conflate. **Authoring
  note**: the spec must document this model-config MECHANISM (per the guide +
  AGENTS.md "Multi-tool support") and must NOT imply `.opencode/opencode.jsonc`
  contains a literal per-agent model table. Reference `@toolsmith` (by
  reference) for authoring/tuning tools, and state the no-hand-edit-`.ados-claude`
  discipline.

**Acceptance Criteria**:

- Must: AC-F3-2 (delivery-lifecycle covers 11 phases + orchestration + reopening
  + DoR/DoD + artifacts, cites ≥1 authoritative source), AC-F3-3
  (agents-and-commands states the model-config nuance accurately + references
  `@toolsmith`).
- Should: both specs cross-link `feature-decision-records.md` /
  `feature-decision-making.md` only where genuinely adjacent (no duplication).

**Affected code areas**:

- none (new specs)

**System docs to update**:

- `doc/spec/features/feature-delivery-lifecycle.md` (new — F-3.1)
- `doc/spec/features/feature-agents-and-commands.md` (new — F-3.2)

**Tests**:

- Grep: each new spec contains `ados_distribution: internal` and the string
  "11-phase" (or "eleven-phase") — never "10-phase".
- Manual: each spec links ≥1 prompt/AGENTS.md/script path and does not restate
  branch/folder/phase rules from the cross-linked canonical docs.

**Completion signal**: `docs(GH-79): add P0 feature specs (delivery lifecycle, agents & commands)`

---

### Phase 4: Part B P1 — decision-making + claude-plugin-generation + quality-gates-and-pr

**Goal**: Author the three P1 specs.

**Tasks**:

- [x] **4.1** READ (F-3.3 sources): `doc/guides/decision-making.md` (no
  `status:` key — verified NOT Draft; `ados_distribution: redistributable`),
  `.opencode/agent/{decision-advisor,decision-critic}.md`,
  `.opencode/command/{plan-decision,write-decision,review-decision}.md`,
  `.ai/agent/decision-instructions.md`; and the existing
  `doc/spec/features/feature-decision-records.md` (cross-link target, read-only).
- [x] **4.2** CREATE `doc/spec/features/feature-decision-making.md`
  (F-3.3 / AC-F3-4): cover the decision **process/framework** — rigor levels,
  decision kernel, classification (ADR/PDR/TDR/BDR/ODR), AI-authority model,
  decision modes, and the `@decision-advisor` + `@decision-critic` two-stage
  (author + independent challenge) flow. **Cross-link** (do not duplicate)
  `feature-decision-records.md` for the record-artifact concerns. If any
  guide/prompt divergence arises, follow the **prompt** and record the
  discrepancy as a follow-up note (F-4). (NOTE: `decision-making.md` is NOT
  Draft — do not emit a spurious "decision-making.md is Draft" note; the
  prompt-wins rule applies to any guide/prompt divergence regardless of the
  guide's status.)
- [x] **4.3** READ (F-3.4 sources): `scripts/build-claude-plugin.sh` (the whole
  transform + idempotent `rm -rf` rebuild + manifest generation),
  `AGENTS.md` ("Multi-tool support"), `scripts/.tests/test-build-claude-plugin.sh`
  (freshness gate), and the existing `.ados-claude/**` tree.
- [x] **4.4** CREATE `doc/spec/features/feature-claude-plugin-generation.md`
  (F-3.4 / AC-F3-5): cover `.opencode/` → `.ados-claude/` generation, single
  source of truth, **idempotency** (rebuild removes then regenerates),
  model-assignment plumbing (frontmatter `claude.model` → generated `model:`),
  multi-tool extensibility (the `TOOL`/`build_<tool>_plugin` pattern), and the
  **CI freshness gate** (`test-build-claude-plugin.sh` fails on stale output).
  Cite `scripts/build-claude-plugin.sh`.
- [x] **4.5** READ (F-3.5 sources):
  `.opencode/command/{check,check-fix,commit,pr}.md`,
  `.opencode/agent/{runner,fixer,committer,pr-manager}.md`,
  `.ai/agent/{pr-instructions,code-review-instructions}.md`,
  `doc/guides/pr-platform-integration.md`.
- [x] **4.6** CREATE `doc/spec/features/feature-quality-gates-and-pr.md`
  (F-3.5 / AC-F3-6): cover `/check` and `/check-fix` (run vs run+fix), the commit
  workflow (`@committer` → one Conventional Commit), the PR/MR workflow
  (`@pr-manager`), the runner/fixer/committer/pr-manager roles, and the
  `.ai/agent/{pr-instructions,code-review-instructions}.md` platform/project
  configuration layer.

**Acceptance Criteria**:

- Must: AC-F3-4 (decision-making covers process/framework, cross-links
  records spec without duplication), AC-F3-5 (claude-plugin-gen covers
  generation + idempotency + freshness gate, cites the build script), AC-F3-6
  (quality-gates-and-pr covers `/check`, `/check-fix`, commit + PR workflow, the
  four roles).
- Should: each spec cites ≥2 authoritative sources (NFR-1).

**Affected code areas**:

- none (new specs)

**System docs to update**:

- `doc/spec/features/feature-decision-making.md` (new — F-3.3)
- `doc/spec/features/feature-claude-plugin-generation.md` (new — F-3.4)
- `doc/spec/features/feature-quality-gates-and-pr.md` (new — F-3.5)

**Tests**:

- Grep: `ados_distribution: internal` in all three; no "10-phase".
- Manual: `feature-decision-making.md` links `feature-decision-records.md` and
  does not restate record taxonomy/format.

**Completion signal**: `docs(GH-79): add P1 feature specs (decision-making, claude-plugin-gen, quality-gates-and-pr)`

---

### Phase 5: Part B P2 — doc-distribution-marker + local-code-review + external-researcher

**Goal**: Author the three P2 specs.

**Tasks**:

- [x] **5.1** READ (F-3.6 sources): `AGENTS.md` ("Doc distribution marker"),
  `doc/decisions/ODR-0001-classify-yaml-register-templates-redistributable.md`,
  `scripts/.tests/test-doc-distribution.sh` (the 5-mode guard + `get_marker`
  two-path parser + DM-2 enumeration), `scripts/install.sh`
  (`ADOS_LOCAL_DIRS` line ~121 — `doc/spec/features` is an empty stub only; the
  install set is marker-derived). Reference the delivering change GH-67 and
  GH-77 (installer spec) as TBD/out-of-scope.
- [x] **5.2** CREATE `doc/spec/features/feature-doc-distribution-marker.md`
  (F-3.6 / AC-F3-7): cover the `ados_distribution` values
  (`redistributable|internal|project-generated`), the **two-path parser** (`.md`
  first-frontmatter-block vs `.yaml` top-level key), the **derived install set**
  (marker-aware: only `redistributable` standalone docs install; templates
  wholesale), the **5-mode drift guard** (missing-marker, invalid-enum,
  redistributable-not-installed, internal-installed, derived-set drift), and the
  **DM-2 scope** (`doc/guides`, `doc/templates/**`, 5 standalone docs —
  explicitly **excludes** `doc/spec/**`). Cite ODR-0001 and the guard. Cross-link
  GH-67 (delivering change) and mark **GH-77 (installer spec) TBD/out-of-scope**.
- [x] **5.3** READ (F-3.7 sources): `.opencode/command/{review,review-deep}.md`,
  `.opencode/agent/reviewer.md`, and the existing
  `doc/spec/features/feature-remote-code-review.md` (cross-link target,
  read-only — DEC-7 companion, not broadening).
- [x] **5.4** CREATE `doc/spec/features/feature-local-code-review.md`
  (F-3.7 / AC-F3-8): cover `/review` and `/review-deep` (standard vs
  stronger-reasoning-model), spec/plan compliance + code-quality heuristics
  (security/performance/correctness), the **remediation-phase append** behavior
  (`@reviewer` FAIL → remediation appended to the plan → `@coder` → re-review),
  and the relationship to the unified `@reviewer`. **Cross-link** (do not
  duplicate) `feature-remote-code-review.md` as the distinct remote workflow
  (DEC-7). Do NOT modify the remote spec.
- [x] **5.5** READ (F-3.8 sources): `.opencode/agent/external-researcher.md`,
  `doc/guides/external-researcher-setup.md`.
- [x] **5.6** CREATE `doc/spec/features/feature-external-researcher.md`
  (F-3.8 / AC-F3-9): cover MCP tool routing (context7 / deepwiki / perplexity /
  web-search per the prompt), **untrusted-content handling** (external output is
  treated as untrusted; cited/verified before use), the research process, and the
  output contract. Cite `.opencode/agent/external-researcher.md`.

**Acceptance Criteria**:

- Must: AC-F3-7 (doc-distribution-marker covers values + two-path parser +
  derived install set + 5-mode guard + DM-2 scope, cites ODR-0001 + guard,
  cross-links GH-67, marks GH-77 TBD), AC-F3-8 (local-code-review covers
  `/review`, `/review-deep`, heuristics, remediation append, cross-links the
  remote spec), AC-F3-9 (external-researcher covers MCP routing + untrusted
  content + output contract, cites the prompt).
- Should: each records any Draft-guide vs prompt discrepancy as a follow-up note.

**Affected code areas**:

- none (new specs)

**System docs to update**:

- `doc/spec/features/feature-doc-distribution-marker.md` (new — F-3.6)
- `doc/spec/features/feature-local-code-review.md` (new — F-3.7)
- `doc/spec/features/feature-external-researcher.md` (new — F-3.8)

**Tests**:

- Grep: `ados_distribution: internal` in all three.
- Manual: local-code-review links `feature-remote-code-review.md`; the remote
  spec is unchanged (`git diff -- doc/spec/features/feature-remote-code-review.md`
  empty).

**Completion signal**: `docs(GH-79): add P2 feature specs (doc-distribution-marker, local-code-review, external-researcher)`

---

### Phase 6: License headers + marker verification on the 8 new specs

**Goal**: Apply license headers via the script (AI never hand-adds them) and
verify every new spec carries `ados_distribution: internal` exactly once and the
header exactly once.

**Tasks**:

- [x] **6.1** RUN (explicit path per file — idempotent; `doc/spec/**` is NOT in
  the script's `DEFAULT_PATHS`, so the explicit path is required):
  ```
  scripts/add-header-location.sh doc/spec/features/feature-delivery-lifecycle.md
  scripts/add-header-location.sh doc/spec/features/feature-agents-and-commands.md
  scripts/add-header-location.sh doc/spec/features/feature-decision-making.md
  scripts/add-header-location.sh doc/spec/features/feature-claude-plugin-generation.md
  scripts/add-header-location.sh doc/spec/features/feature-quality-gates-and-pr.md
  scripts/add-header-location.sh doc/spec/features/feature-doc-distribution-marker.md
  scripts/add-header-location.sh doc/spec/features/feature-local-code-review.md
  scripts/add-header-location.sh doc/spec/features/feature-external-researcher.md
  ```
- [x] **6.2** VERIFY each of the 8 now has, in frontmatter, the 3 header lines
  (`# Copyright …`, `# MIT License …`, `source: …`) exactly once, AND
  `ados_distribution: internal`. (The script's `ensure_basic_header` injects
  copyright/MIT/source into the frontmatter and preserves existing keys.) NOTE:
  the script REORDERS the frontmatter so the 3 header lines (copyright/MIT/source)
  come FIRST; `ados_distribution: internal` will therefore appear AFTER them. This
  reordering is expected and correct — do not "fix" it back.
- [x] **6.3** VERIFY idempotency: re-running the script on any of the 8 produces
  NO diff (confirms no duplicate header, NFR-4).
- [x] **6.4** VERIFY the 8 existing specs were NOT touched
  (`git diff --stat -- doc/spec/features/feature-{bootstrapper,decision-records,documentation-profiles,document-templates,license-header-script,onboarding-guide,remote-code-review,text-to-image-tool}.md`
  empty — NG-5).

**Acceptance Criteria**:

- Must: AC-F5-1 (all 8 carry `ados_distribution: internal`), AC-F5-2 (headers
  applied via script, none hand-added — confirmed by the script having run and
  the frontmatter showing the canonical injected lines), NFR-4 (idempotent).
- Should: zero diff on the 8 existing specs.

**Affected code areas**:

- none

**System docs to update**:

- `doc/spec/features/feature-*.md` (8 files — headers injected)

**Tests**:

- Grep per file: exactly one `ados_distribution: internal`, exactly one
  `^# Copyright.*2025-2026`, exactly one `^source: https://`.
- Re-run script → `git diff` empty.

**Completion signal**: `docs(GH-79): apply license headers to new feature specs`

---

### Phase 7: Verification & quality gates

**Goal**: Prove Part A content landed, the distribution guard stays green, repo
tests pass, and the honesty/lifecycle-accuracy invariants hold.

**Tasks**:

- [x] **7.1** RUN `bash scripts/.tests/test-doc-distribution.sh` — MUST stay
  green. (It does not scan `doc/spec/**`, so the 8 new `internal` specs cannot
  affect it; this confirms no collateral drift in the DM-2 set from Part A guide
  edits or Phase 6.)
- [x] **7.2** RUN the repo's other script tests:
  `bash scripts/.tests/test-build-claude-plugin.sh` (plugin freshness — NFR-7),
  `bash scripts/.tests/test-add-header-location.sh`,
  `bash scripts/.tests/test-doc-distribution-modes.sh`,
  `bash scripts/.tests/test-install.sh`,
  `bash scripts/.tests/test-inception-doc-consistency.sh`.
- [x] **7.3** GREP-verify Part A content landed:
  - `.opencode/agent/doc-syncer.md` contains a feature-spec-coverage check phrase
    and `spec_coverage_gaps`.
  - `.opencode/agent/doc-syncer.md` and `.ados-claude/agents/doc-syncer.md`
    contain the SAME coverage text (generated == source body).
  - `.opencode/agent/pm.md` clarify_scope mentions coverage awareness.
  - `doc/guides/change-lifecycle.md` §7 documents the coverage check.
- [x] **7.4** GREP-verify honesty + accuracy invariants:
  - No new file under `doc/spec/features/feature-*.md` (the 8 new ones) contains
    "10-phase".
  - All 8 new specs contain `ados_distribution: internal`.
  - `.ados-claude/` regen set == Part A source edits: confirm
    `git diff --stat .ados-claude/` (vs the merge base) touches ONLY
    `.ados-claude/agents/doc-syncer.md` and `.ados-claude/agents/pm.md`.
- [x] **7.5** VERIFY no tickets were created and no `.opencode/**` file was
  edited outside Phase 1 (so no second regen is owed).

**Acceptance Criteria**:

- Must: AC-F1-7 / NFR-7 (plugin fresh, exact regen set), NFR-3 (8× `internal`),
  NFR-6 (no "10-phase"), distribution guard green.
- Should: all listed script tests pass; cross-link targets unchanged.

**Affected code areas**:

- none (verification only)

**System docs to update**:

- none

**Tests**:

- All `bash scripts/.tests/test-*.sh` listed above.
- The grep assertions in 7.3 / 7.4.

**Completion signal**: `test(GH-78): verify distribution guard, plugin freshness, and content greps`

---

### Phase 8: Finalize and release

**Goal**: Reconcile the change against the system spec, confirm the
version/plugin-freshness posture, and confirm Definition of Done. (No `.opencode/`
edits in Phases 2–7 → no further regen; Phase 1's generation is still current.)

**Tasks**:

- [x] **8.1** SPEC RECONCILIATION: confirm `doc/spec/` now reflects the new truth
  — the 8 specs (GH-79) are the authoritative mirror `@doc-syncer` reconciles
  against, and the doc-syncer/pm coverage behavior (GH-78) is captured in the
  prompts + lifecycle guide. The 8 new specs ARE this change's system-spec
  reconciliation (no separate doc-syncer run is owed for GH-79's own deliverables
  because they are the specs themselves). *(DONE — 8 specs created in doc/spec/features/; doc-syncer + pm coverage behavior captured in Phase 1 prompts + Phase 2 lifecycle guide.)*
- [x] **8.2** PLUGIN FRESHNESS (NFR-7): re-confirm
  `bash scripts/.tests/test-build-claude-plugin.sh` passes — `.ados-claude/` is
  current with the Phase 1 source edits and no later phase touched `.opencode/`.
  *(DONE — 16/16 PASS; .opencode/ touched files == exactly doc-syncer.md + pm.md.)*
- [x] **8.3** VERSION IMPACT (per repo conventions): this repo has no application
  semver; the plugin manifest version (`.ados-claude/.claude-plugin/plugin.json`,
  static `1.0.0` hard-set in `scripts/build-claude-plugin.sh`) is intentionally
  **NOT** bumped for a docs/process change (the manifest version is a plugin
  marketplace version, not a per-change semver, and the build script's
  static-version design governs it). Record the no-bump decision; confirm there
  is no CHANGELOG/version file to update. (If maintainer convention later
  requires a release note, surface it — do not invent a mechanical bump.)
  *(DONE — no CHANGELOG/VERSION/package.json at repo root; manifest stays 1.0.0; no-bump recorded.)*
- [x] **8.4** DOD CHECK: all plan tasks checked; all spec ACs (§17 groups A–D)
  satisfied; both tickets GH-78 + GH-79 close on this PR (DEC-1); the two open
  questions (OQ-1, OQ-2) remain surfaced-to-human follow-ups (not blockers).
  *(DONE — see DoD table below; AC groups A–D all PASSED.)*
- [x] **8.5** HAND OFF: the change is ready for `@reviewer` (review_fix),
  `@runner` (quality_gates), `@pm` (dod_check), and `@pr-manager`
  (pr_creation). This plan performs NO commit; staging/committing across all
  phases is performed by `@committer`. *(DONE — delivery complete; ready for review/quality-gates/dod/pr-creation.)*

**Phase 8 Acceptance Criteria** — PASSED:
- all spec ACs (§17) verified — see DoD table below
- plugin fresh (NFR-7) — 16/16 PASS
- no "10-phase" anywhere new (NFR-6) — grep-verified (0 occurrences)
- 8× `internal` (NFR-3) — grep-verified (8/8)
- zero hand-added headers (NFR-4) — headers applied via script only; idempotent
- retro-marking/DM-2 extension explicitly NOT done (NG-4, NG-5) — 8 existing specs untouched; install.sh/guard unchanged
- deferred Proposal C visibly recorded — change-lifecycle.md §7 blockquote

**Definition of Done — spec §17 AC groups:**

| AC group | ID | Verdict | Evidence |
|-----------|-----|---------|----------|
| A (GH-78 gate) | AC-F1-1 | PASSED | doc-syncer Identify Impact has "Feature spec coverage" sub-check + `spec_coverage_gaps` field (commit 90ee1fb) |
| A | AC-F1-2 | PASSED | doc-syncer `<rules>`: REPORTS, never creates spec/ticket (commit 90ee1fb) |
| A | AC-F1-3 | PASSED | de-noising rule stated (reference existing tracker before proposing) |
| A | AC-F1-4 | PASSED | pm.md clarify_scope step 3b "Feature spec coverage awareness" (commit 90ee1fb) |
| A | AC-F1-5 | PASSED | change-lifecycle.md §7 documents the check (commit b179489) |
| A | AC-F1-6 | PASSED | operational "feature area" definition inline in doc-syncer prompt |
| B (GH-78 regen) | AC-F1-7 / NFR-7 | PASSED | `.ados-claude/` regenerated; regen set == exactly doc-syncer.md + pm.md; 16/16 freshness test |
| C (GH-79 specs) | AC-F3-1 | PASSED | all 8 files exist in doc/spec/features/ |
| C | AC-F3-2 | PASSED | feature-delivery-lifecycle covers 11-phase + orchestration + reopening + DoR/DoD + artifacts; cites AGENTS.md + guides |
| C | AC-F3-3 | PASSED | feature-agents-and-commands states model-config nuance (claude.model hint vs OpenCode-effective; jsonc delegates to user-global) + @toolsmith |
| C | AC-F3-4 | PASSED | feature-decision-making covers process/framework; cross-links (not duplicates) feature-decision-records.md |
| C | AC-F3-5 | PASSED | feature-claude-plugin-generation covers generation + idempotency + freshness gate; cites build script |
| C | AC-F3-6 | PASSED | feature-quality-gates-and-pr covers /check, /check-fix, commit + PR workflow, 4 roles |
| C | AC-F3-7 | PASSED | feature-doc-distribution-marker covers values + 2-path parser + install set + 5-mode guard + DM-2 scope; cites ODR-0001 + guard; GH-67 linked; GH-77 TBD |
| C | AC-F3-8 | PASSED | feature-local-code-review covers /review, /review-deep, heuristics, remediation append; cross-links (not duplicates) feature-remote-code-review.md (unchanged) |
| C | AC-F3-9 | PASSED | feature-external-researcher covers MCP routing + untrusted content + output contract; cites agent prompt |
| D (GH-79 hygiene) | AC-F4-1 | PASSED | all 8 cross-link canonical sources (named + linked), no restated branch/folder/phase rules |
| D | AC-F4-2 | PASSED | no Draft-guide/prompt divergence required a follow-up note (decision-making.md has no status key; change-lifecycle/definition-of-ready are Draft but no divergence found — prompts followed) |
| D | AC-F5-1 | PASSED | 8/8 carry `ados_distribution: internal` |
| D | AC-F5-2 | PASSED | headers via script only; idempotent (insertions stable at 24); zero hand-added |

**Affected code areas**:

- none

**System docs to update**:

- none beyond Phases 1–6 (reconciliation confirmation only)

**Tests**:

- Re-run the Phase 7 verification suite as the final green baseline.

**Completion signal**: `docs(GH-78): finalize — spec reconciliation, confirm plugin freshness (closes GH-78 + GH-79)`

---

### Phase 9: Code Review Remediation (Iteration 1)

> **Origin:** review_fix (phase 8), iteration 1. Appended by `@reviewer`.
> **Findings record:** `./code-review/findings-iter-1.json` · summary `./code-review/review-iter-1.md`.
> **Scope:** 2 minor findings only — the change is otherwise high quality (all spec §17 AC groups
> A/B/C/D PASS, all quality gates green). Both fixes are documentation/tracking corrections.

**Goal**: Close the two minor review findings (one authoritative-accuracy enum slip in a spec, one
plan-task tracking inconsistency) so the change re-reviews to PASS.

**Tasks**:

- [x] **9.1** FIX `doc/spec/features/feature-local-code-review.md` line 59 (finding 1, AC-F4-2):
  the "Findings Format" line currently reads `[severity: major|minor|nit]`, omitting `critical`.
  The authoritative source — `.opencode/agent/reviewer.md` `<finding_format>` (severity field, line
  ~397) — defines `critical | major | minor | nit`. Change line 59 to:
  `Findings use the form \`[severity: critical|major|minor|nit] <file>[:line] — <description>; fix: <action>\`.`
  *(DONE — line 59 now reads `[severity: critical|major|minor|nit]`, matching reviewer.md:397. No `.opencode/` edit → no `.ados-claude/` regen owed.)*
- [x] **9.2** FIX the plan-task tracking inconsistency (finding 2, DONE_BUT_UNCHECKED + false DoD):
  tick the task checkboxes for Phases 3–7 (3.1–3.4, 4.1–4.6, 5.1–5.6, 6.1–6.4, 7.1–7.5) to reflect
  the delivered state already recorded in the Execution Log (commits 52ef6ef, ab2d8c5, e6d5f17,
  aca537c + verification phase). This makes Phase 8.4's "all plan tasks checked" DoD claim true.
  (Phase 8.4's verdict/evidence otherwise stands.) *(DONE — 25 Phase 3–7 boxes ticked via task-id sed; Phase 8/9 boxes untouched.)*
- [ ] **9.3** RE-REVIEW (iteration 2): re-run `@reviewer` (local mode) to confirm the two findings
  are resolved and no new issues were introduced. Expected: `Status=PASS`, no further remediation.

**Acceptance Criteria**:

- Must: finding 1 resolved — `feature-local-code-review.md` line 59 includes `critical` in the
  severity enum, matching `.opencode/agent/reviewer.md`.
- Must: finding 2 resolved — Phases 3–7 task boxes are ticked; Phase 8.4 DoD no longer over-claims.
- Should: no `.opencode/` file edited in this phase (so no `.ados-claude/` regen owed);
  `bash scripts/.tests/test-build-claude-plugin.sh` stays 16/16 green.

**Affected code areas**:

- `doc/spec/features/feature-local-code-review.md` (1-line enum correction — finding 1)
- `doc/changes/2026-06/2026-06-28--GH-78--feature-spec-coverage-gate-and-debt/chg-GH-78-plan.md`
  (checkbox state — finding 2)

**System docs to update**:

- `doc/spec/features/feature-local-code-review.md` (the corrected severity enum)

**Tests**:

- Grep: `feature-local-code-review.md` line 59 contains `critical|major|minor|nit`.
- Manual: confirm no `.opencode/**` file was edited in Phase 9 (no regen owed).

**Completion signal**: `docs(GH-78): apply review iteration-1 remediation (severity enum, plan checkboxes)`

---

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | `git diff --stat .ados-claude/` shows exactly doc-syncer.md + pm.md (no skills, no manifest) | 1, 7 | AC-F1-7, NFR-7 |
| TS-2 | doc-syncer prompt + generated file carry identical coverage text incl. `spec_coverage_gaps` | 1, 7 | AC-F1-1, AC-F1-2, AC-F1-3 |
| TS-3 | pm.md clarify_scope records coverage awareness; lifecycle §7 documents the check | 1, 2, 7 | AC-F1-4, AC-F1-5 |
| TS-4 | "feature area" operationally defined (warrants a `feature-<slug>.md`) in doc-syncer prompt | 1, 7 | AC-F1-6 |
| TS-5 | All 8 target spec files exist in `doc/spec/features/` | 3, 4, 5 | AC-F3-1 |
| TS-6 | delivery-lifecycle spec states 11-phase + orchestration + reopening + DoR/DoD + artifacts, cites sources | 3, 7 | AC-F3-2 |
| TS-7 | agents-and-commands spec states model-config nuance (`claude.model`→build script; OpenCode in jsonc) + `@toolsmith` | 3, 7 | AC-F3-3 |
| TS-8 | decision-making spec covers process/framework and cross-links (not duplicates) records spec | 4, 7 | AC-F3-4 |
| TS-9 | claude-plugin-generation spec covers generation + idempotency + freshness gate, cites build script | 4, 7 | AC-F3-5 |
| TS-10 | quality-gates-and-pr spec covers `/check`, `/check-fix`, commit + PR workflow, four roles | 4, 7 | AC-F3-6 |
| TS-11 | doc-distribution-marker spec covers values + two-path parser + install set + 5-mode guard + DM-2 scope; GH-77 TBD | 5, 7 | AC-F3-7 |
| TS-12 | local-code-review spec covers `/review`, `/review-deep`, heuristics, remediation append; cross-links remote spec (unchanged) | 5, 7 | AC-F3-8 |
| TS-13 | external-researcher spec covers MCP routing + untrusted content + output contract | 5, 7 | AC-F3-9 |
| TS-14 | No new spec says "10-phase"; all 8 cite ≥1 authoritative source | 7 | AC-F4-1, NFR-1, NFR-6 |
| TS-15 | Draft-guide vs prompt divergences recorded as follow-up notes (prompt wins) | 3–5, 7 | AC-F4-2 |
| TS-16 | All 8 new specs carry `ados_distribution: internal` | 6, 7 | AC-F5-1, NFR-3 |
| TS-17 | Headers applied via script only; re-run is a no-op; zero hand-added headers | 6, 7 | AC-F5-2, NFR-4 |
| TS-18 | `test-doc-distribution.sh` green; DM-2 set unchanged; 8 existing specs untouched | 7 | NG-4, NG-5 |
| TS-19 | Repo `test-*.sh` suite green; plugin fresh | 7, 8 | NFR-7 |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-78-spec.md` | Spec |
| Implementation plan (this file) | `./chg-GH-78-plan.md` | Plan |
| PM notes | `./chg-GH-78-pm-notes.yaml` | Tracking |
| doc-syncer prompt (edited) | `.opencode/agent/doc-syncer.md` | Agent prompt (source) |
| pm prompt (edited) | `.opencode/agent/pm.md` | Agent prompt (source) |
| Lifecycle guide (edited) | `doc/guides/change-lifecycle.md` | Guide |
| DoR guide (optional note) | `doc/guides/definition-of-ready.md` | Guide |
| Generated plugin (regen) | `.ados-claude/agents/{doc-syncer,pm}.md` | Generated |
| Feature spec — delivery lifecycle | `doc/spec/features/feature-delivery-lifecycle.md` | Feature spec (new) |
| Feature spec — agents & commands | `doc/spec/features/feature-agents-and-commands.md` | Feature spec (new) |
| Feature spec — decision-making | `doc/spec/features/feature-decision-making.md` | Feature spec (new) |
| Feature spec — claude plugin generation | `doc/spec/features/feature-claude-plugin-generation.md` | Feature spec (new) |
| Feature spec — quality gates & PR | `doc/spec/features/feature-quality-gates-and-pr.md` | Feature spec (new) |
| Feature spec — doc distribution marker | `doc/spec/features/feature-doc-distribution-marker.md` | Feature spec (new) |
| Feature spec — local code review | `doc/spec/features/feature-local-code-review.md` | Feature spec (new) |
| Feature spec — external-researcher | `doc/spec/features/feature-external-researcher.md` | Feature spec (new) |
| Feature spec template (structural guide) | `doc/templates/feature-spec-template.md` | Template |
| Authoritative source map | `./chg-GH-78-spec.md` §5.1 | Reference |
| Cross-link target (read-only) | `doc/spec/features/feature-decision-records.md` | Feature spec (existing) |
| Cross-link target (read-only) | `doc/spec/features/feature-remote-code-review.md` | Feature spec (existing) |
| Marker system (delivered) | `doc/decisions/ODR-0001-…redistributable.md` | Decision (ODR) |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-28 | plan-writer | Initial plan: 8 phases — Part A (agent prompts + regen; lifecycle/DoR guides), Part B P0/P1/P2 specs (8), headers+markers, verification, finalize. |
| 1.1 | 2026-06-28 | plan-writer | Red-team R2 corrections (2 must-fix + 4 ride-along). [M1] Phase 3.3/3.4 model-config source map fixed — bare `opencode*.jsonc` glob → precise `.opencode/opencode.jsonc` + `doc/guides/opencode-model-configuration.md`; authoring note: document the model-config MECHANISM, do NOT imply `.opencode/opencode.jsonc` holds a literal per-agent model table. [M2] Phase 4.1/4.2 — `decision-making.md` is NOT Draft (no `status:` key, verified); un-hooked the false Draft premise while keeping the prompt-wins rule. [#3] Phase 1.0 added: pre-edit plugin-baseline-freshness check (empty pre-diff required). [#4] Phase 3 authoring rules: NEW-spec sibling cross-links required (F-3.1↔F-3.5, F-3.2↔F-3.4, F-3.7↔F-3.5). [#5] Orientation-vs-duplication example added (reviewable TC-HYGIENE-001 step 4). [#6] Phase 6.2 note: header script reorders frontmatter (headers first, `ados_distribution` after). |
| 1.2 | 2026-06-28 | reviewer (review_fix iter-1) | Appended Phase 9 (Code Review Remediation, iteration 1) for 2 minor findings: (1) `feature-local-code-review.md` line 59 severity enum omits `critical` vs authoritative `.opencode/agent/reviewer.md` (AC-F4-2); (2) plan-task tracking inconsistency — Phases 3–7 task boxes unchecked though delivered (DONE_BUT_UNCHECKED), making the Phase 8.4 "all plan tasks checked" DoD claim false. See `./code-review/{findings-iter-1.json,review-iter-1.md}`. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | ✅ Done | 2026-06-28 | 2026-06-28 | 90ee1fb | Part A prompts + plugin regen (source+generated in one commit); pre-diff EMPTY; regen diff = exactly doc-syncer.md + pm.md |
| 2 | ✅ Done | 2026-06-28 | 2026-06-28 | b179489 | Lifecycle/DoR guide docs + deferred Proposal C; no .opencode/ edits → no regen |
| 3 | ✅ Done | 2026-06-28 | 2026-06-28 | 52ef6ef | P0 specs (delivery-lifecycle, agents-and-commands) |
| 4 | ✅ Done | 2026-06-28 | 2026-06-28 | ab2d8c5 | P1 specs (decision-making, claude-plugin-gen, quality-gates-and-pr) |
| 5 | ✅ Done | 2026-06-28 | 2026-06-28 | e6d5f17 | P2 specs (doc-distribution-marker, local-code-review, external-researcher) |
| 6 | ✅ Done | 2026-06-28 | 2026-06-28 | aca537c | Headers via script (idempotent; 8 existing specs untouched) |
| 7 | ✅ Done | 2026-06-28 | 2026-06-28 | (none — verification only) | 6/6 test scripts green; Part A content greps pass; .ados-claude/ regen set == 2-file .opencode/ edits |
| 8 | In progress | 2026-06-28 | — | — | Finalize & release (spec reconciliation, version posture) |
| 9 | Remediation applied (awaiting re-review iter-2) | 2026-06-28 | — | — | Finding 1 fixed (severity enum now `critical\|major\|minor\|nit` in feature-local-code-review.md); finding 2 fixed (25 Phase 3–7 task boxes ticked). 9.1/9.2 done; 9.3 (re-review iter-2) pending @reviewer. |
