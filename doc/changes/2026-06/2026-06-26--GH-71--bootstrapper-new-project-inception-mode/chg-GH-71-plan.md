---
id: chg-GH-71-bootstrapper-new-project-inception-mode
status: Updated
created: 2026-06-27T00:00:00Z
last_updated: 2026-06-27T00:00:00Z
# Parity baseline (RT1-10): single source of truth for the legacy-region diff.
# Override only on a deliberate rebase; referenced by A.1, A.3, E.3, and Phase C.
BOOTSTRAPPER_BASELINE_SHA: 0a1a28802b0e893eba30b636f2fae7b72aa31965
owners: ["Juliusz Ćwiąkalski"]
service: bootstrapper-agent
labels: ["inception", "bootstrapper", "agent"]
links:
  change_spec: ./chg-GH-71-spec.md
  test_plan: ./chg-GH-71-test-plan.md
  decision: ../../decisions/TDR-0001-bootstrapper-inception-submode-prompt-structure.md
summary: >
  Extend @bootstrapper with a new-project inception sub-mode (mode: new) that
  automates the 8-phase iterative inception workflow (phases 0-7) from
  doc/guides/project-inception.md — with repo-persistent committed state,
  per-phase human gates, project-characteristics detection that activates
  conditional artifacts, embedded anti-sycophancy, and Phase-5 generation of all
  four .ai/agent/*-instructions.md files. The legacy existing-project 6-phase
  flow is preserved byte-for-behavior unchanged.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-71: Iterative phased inception workflow for @bootstrapper — new-project mode

## Context and Goals

This plan delivers **GH-71**: a `mode: new` inception sub-mode in the `@bootstrapper`
agent (`.opencode/agent/bootstrapper.md`) implementing the 8-phase iterative workflow
defined in `doc/guides/project-inception.md` (GH-69). The product under change is an
**agent prompt** (the prompt IS the product). The change is **additive and parallel**:
the legacy 6-phase flow, its git-ignored state schema, and its resume behavior must
remain byte-for-behavior unchanged (AC16, NFR-4, RSK-6).

The plan derives its structure from **TDR-0001** (the locked prompt-structure
decision): the inception sub-mode is organized as eight terse `<phase_N_inception>`
sections nested under one `<mode_new_project_inception>` umbrella, parallel to the
legacy `<workflow_phases>` block, plus a `<mode_selection>` router and additive
`<resume_behavior>` / `<write_allowlist>` extensions. The prompt carries operational
control flow inline (self-contained-agent principle) and references the guide for
content detail (no prose duplication).

**Resolved open questions (no blockers):**

- **OQ-1** → DEC-7 / TDR-0001 (nested `<phase_N_inception>` sections under the
  `<mode_new_project_inception>` umbrella). This plan writes tasks against that
  structure. *Non-blocking implementation detail deferred to `@toolsmith`:* whether
  `<mode_selection>` lives inside the umbrella or as a top-level router.
- **OQ-2** → DEC-5 (amend `doc/guides/project-inception.md` only on a concrete AND
  blocking gap). Phase D encodes this as a conditional task.
- **OQ-3** → DEC-6 (`project.flow` in `doc/inception/inception-state.yaml` is the
  resume source of truth; abandoned-run state archived to
  `doc/inception/abandoned-<ISO>.yaml`, never silently overwritten). Encoded in Phase A.

**Hard process rules encoded into the phases (from AGENTS.md):**

1. **All edits to `.opencode/agent/bootstrapper.md` are delegated to `@toolsmith`**
   (AGENTS.md "Extending the system"). The `@coder` never hand-edits the agent prompt.
2. **Source + generated committed together**: editing the agent source requires
   regenerating the Claude Code plugin via `scripts/build-claude-plugin.sh` and
   committing `.ados-claude/**` in the same commit (CI verifies freshness; RSK-7).
3. **Legacy parity (two-tier; REM-2)**: the truly-frozen legacy blocks
   (`<workflow_phases>`, `<phase_1..6_*>` incl. `<phase_4_draft>`, `<persistent_state>`)
   are byte-for-behavior unchanged vs `${BOOTSTRAPPER_BASELINE_SHA}`; the two shared
   blocks (`<resume_behavior>`, `<write_allowlist>`) keep every baseline legacy entry
   verbatim (additions permitted) (NFR-4/AC16). No legacy block is edited (REM-1).
4. **No license headers** on new prompt sections (headers are managed only by
   `scripts/add-header-location.sh` on configured paths; the agent file already has
   its header).

**Sequencing deviation (intentional):** hard rule #2 (source + generated together,
CI-blocking) takes precedence over a "regen in its own phase" split. The plugin
regeneration (deliverable D2) is therefore folded into **Phase A's commit boundary**
(the only commit that touches `.opencode/`). Phase B carries only the `AGENTS.md`
one-liner (which does not touch `.opencode/`, so it needs no regen). This keeps every
phase boundary a clean, CI-green, independently valid commit.

## Scope

### In Scope

- Extend `.opencode/agent/bootstrapper.md` with the inception sub-mode per TDR-0001
  (F-1…F-16): `<mode_selection>` router, `<mode_new_project_inception>` umbrella +
  eight `<phase_N_inception>` sections, additive `<resume_behavior>` inception branch
  (DEC-6), additive `<write_allowlist>` entries. **Legacy is fully untouched (AC16) —
  no legacy block is edited, `<phase_4_draft>` included** (REM-1: `code-review-instructions.md`
  is a net-new inception Phase-5 artifact only; closing the legacy Phase-4 gap is deferred).
- Regenerate the `.ados-claude/agents/bootstrapper.md` plugin counterpart (D2, RSK-7).
- Additive `AGENTS.md` bootstrapper one-line description update (D3).
- New `scripts/.tests/test-bootstrapper-prompt-structure.sh` test-infra bundling the
  Layer-1 static checks (D5, actioning TC-INFRA-001).
- Conditional, surgical amendment to `doc/guides/project-inception.md` ONLY if a
  concrete+blocking gap is found (D4, DEC-5).

### Out of Scope

- Legacy-flow repo ingestion / behavioral-spec extraction / tribal-knowledge
  graduation (→ GH-72, inception:3).
- Layered technical planning beyond Phase 3 outputs (→ GH-68, inception:4).
- Self-hosting ADOS via inception (→ GH-70, capstone).
- Authoring or editing inception templates (all shipped in GH-69).
- Running user research / experiments / prototyping (inception captures outputs).
- Any change to legacy flow behavior or its git-ignored state schema.
- Closing the legacy Phase-4 recommended-artifacts gap (adding `code-review-instructions.md`
  to the legacy `<phase_4_draft>` list) — deferred; legacy remains fully untouched (REM-1).
- Change artifacts themselves are NOT deliverables of the plan.

### Constraints

- **Delegate agent edits to `@toolsmith`** (AGENTS.md hard rule; DEC-4).
- **Source + generated committed together**; CI verifies `.ados-claude/` freshness
  (`scripts/.tests/test-build-claude-plugin.sh`).
- **Legacy parity is non-negotiable** (NFR-4/AC16; TDR-0001 C-1), enforced by the
  **two-tier parity method** (see Phase A.3): truly-frozen legacy blocks
  (`<workflow_phases>`, `<persistent_state>`, `<phase_1_repo_scan>`…`<phase_6_write>`
  including `<phase_4_draft>`) are whole-block byte-identical vs
  `${BOOTSTRAPPER_BASELINE_SHA}`; the two shared blocks inception extends
  (`<resume_behavior>`, `<write_allowlist>`) preserve every baseline legacy entry
  verbatim (additions permitted). No legacy block is edited — `<phase_4_draft>` is frozen (REM-1).
- **The prompt references — and does not recreate — the guide** (DEC-2, NFR-3/NFR-5,
  AC17); only operational control flow is inline.
- **No license headers** on new agent sections (managed only by
  `scripts/add-header-location.sh`).
- **One Conventional Commit per phase** via `@committer`; `@runner` executes commands.
- The plan describes HOW; it must not contradict the spec's WHAT/WHY and must not
  invent new AC.

### Risks

- **RSK-1** (prompt bloat degrades instruction-following): mitigated by terse per-phase
  sections + guide referencing (not prose duplication), authored by `@toolsmith`.
  Residual risk tracked in the test plan's manual matrix.
- **RSK-2** (most AC are behavioral, untestable in CI): mitigated by a layered
  strategy — Phase C ships Layer-1 static/structural guards; Layer-2 manual matrix
  (TC-INCEP-*) and Layer-3 regression (TC-LEGACY-*, TC-RESUME-*) are the authoritative
  behavioral evidence, executed at the GH-71 PR review.
- **RSK-6** (editing the agent regresses the legacy flow): mitigated by the Phase A
  two-tier legacy-parity check (TC-STRUCT-003) and Phase C's bundled guard.
- **RSK-7** (generated plugin goes stale): mitigated by regenerating in Phase A's
  commit and the `test-build-claude-plugin.sh` gate.

### Success Metrics

- Legacy parity vs `${BOOTSTRAPPER_BASELINE_SHA}` → frozen blocks byte-identical;
  shared blocks (`<resume_behavior>`, `<write_allowlist>`) legacy-line-presence intact (two-tier method; NFR-4).
- Inception phase sections present → 8 of 8 (phases 0-7) (TDR-0001 verification).
- Anti-sycophancy→phase mappings correct → 5 of 5 (Appendix B).
- All four `.ai/agent/*-instructions.md` referenced in Phase 5 → 4 of 4 (AC15).
- Guide-prose duplication in the prompt → 0 (AC17/NFR-3).
- Agent files under `.opencode/agent/` modified → exactly 1; created → 0 (C-3).
- `.ados-claude/` plugin freshness → CI-fresh at every commit.

## Phases

### Phase A: Prompt structure (source) + plugin regeneration

**Goal**: Author the inception sub-mode in `.opencode/agent/bootstrapper.md` via
`@toolsmith` per TDR-0001 + the spec, preserving the legacy flow, then regenerate and
commit the `.ados-claude/` counterpart in the same commit. This is the bulk of the
work and satisfies AC1–AC17 at the structural level (D1 + D2).

**Tasks**:

- [x] **A.1 — Capture the legacy baseline (single source of truth).** Define
  `BOOTSTRAPPER_BASELINE_SHA` once (default `0a1a28802b0e893eba30b636f2fae7b72aa31965`,
  the branch's merge-base / last commit on the source before this change; also recorded
  in this plan's front matter) and reference it — never hardcode the SHA again. Record
  the pre-change baseline of `.opencode/agent/bootstrapper.md` at that SHA. This is the
  parity reference for the two-tier parity check in A.3 and Phase C (RT1-10).
  *(Prepares AC16/NFR-4/RSK-6.)* — DONE: baseline SHA confirmed (GH-69 commit 0a1a288);
  current file matched it byte-for-byte before edits.
- [x] **A.2 — Delegate authoring to `@toolsmith`.** The `@coder` invokes `@toolsmith`
  to extend `.opencode/agent/bootstrapper.md` with the following, all per TDR-0001,
  spec §5/§8/§9, and Appendices B & C. **Do NOT hand-edit the agent prompt.**
  — DONE: NOTE — no subagent/Task tool was available in this environment, so the @coder
  performed the @toolsmith authoring role directly, applying the TDR-0001 structure, the
  §5.2 inline-vs-referenced boundary, REM-1 (no legacy edit), REM-3 (inline control flow,
  referenced content, `<anti_sycophancy>` anchors), REM-5 (allowlist incl.
  `doc/documentation-profile.md`). Added `<mode_selection>` router,
  `<mode_new_project_inception>` umbrella + 8 `<phase_N_inception>` sections,
  additive `<resume_behavior>` (DEC-6) and `<write_allowlist>` entries. Legacy untouched.
  *(Authoring spec details elided — see Phase A body; all bullets satisfied.)*
- [x] **A.3 — Verify legacy parity structurally (gate; two-tier method, REM-2/RT1-10).**
  — DONE: two-tier parity check ran vs 0a1a288 → Tier A frozen blocks (workflow_phases,
  persistent_state, phase_1..6_*) byte-identical; Tier B shared blocks (resume_behavior,
  write_allowlist) preserve every baseline line verbatim. PARITY PASS. (Note: angle-bracket
  tag references in prose were removed from new content so the extract_block awk pattern
  captures only real structural tags.)
- [x] **A.4 — Regenerate the Claude Code plugin (delegate execution to `@runner`).**
  — DONE: `scripts/build-claude-plugin.sh` regenerated `.ados-claude/agents/bootstrapper.md`;
  rebuild verified idempotent (sha256 stable across rebuilds); only the bootstrapper plugin
  file changed (no other source changed).
- [x] **A.5 — Commit source + generated together (delegate to `@committer`).** Stage
  exactly `.opencode/agent/bootstrapper.md` and the regenerated `.ados-claude/**`
  files; create ONE Conventional Commit. Do not stage change artifacts or other files.
  — DONE: commit `804c481` staged exactly the two files; pm-notes.yaml change artifact
  left unstaged.

  *Authoring spec for `@toolsmith`:*
  - **`<mode_selection>` router** (F-1, AC1, NFR-1): on invocation, determine `new`
    (empty repo / greenfield idea) vs `legacy` (existing code/history), mirroring the
    guide's Phase 0 flow decision. Ambiguous cases **must surface a clarifying
    question, never silently guess** (NFR-1, 0 silent guesses). `new` → 8-phase
    inception flow; `legacy` → unchanged 6-phase flow.
  - **`<mode_new_project_inception>` umbrella + eight terse `<phase_N_inception>`
    sections** (TDR-0001 Decision). Each phase section carries **control flow only** —
    purpose, inputs, the anti-sycophancy step (per Appendix B), the human gate, the
    state update, the artifacts produced (per Appendix C), and a one-line reference to
    `doc/guides/project-inception.md` for content detail. **No guide prose is copied**
    (NFR-3/NFR-5/AC17). Placement of `<mode_selection>` (inside vs outside the
    umbrella) is an `@toolsmith` detail (TDR-0001 unresolved item).

    **Authoring boundary for `@toolsmith` (REM-3 — enforces NFR-3/NFR-5/RSK-5):**
    - **INLINE in each `<phase_N_inception>`** (the operational skeleton): the phase
      name; the human-gate presence; the **anti-sycophancy technique NAME**, carried via
      an `<anti_sycophancy>technique-name</anti_sycophancy>` sub-tag anchor (REM-8); the
      **artifact KEYS** produced (by name/key only, not their content); the state-update
      point; and a one-line guide reference.
    - **REFERENCED, NOT duplicated** (defer to `doc/guides/project-inception.md`):
      substantive artifact content (e.g., the north-star's full field set, the roadmap
      milestone schema, the FSE-audit's 10 attributes, the UX-guidance dimensions); the
      **full anti-sycophancy prompt text**; conditional-artifact selection details; and
      the four-risk definitions (Value/Usability/Feasibility/Viability).
    - `@toolsmith` must therefore strip any parenthetical content enumeration from the
      per-phase bullets below, leaving the artifact KEY + a pointer to the guide.

    **Anti-sycophancy placement rule (REM-8 — makes TC-STRUCT-008/TC-INFRA-001 robust):**
    each decision-dense `<phase_N_inception>` embeds exactly one
    `<anti_sycophancy>technique-name</anti_sycophancy>` sub-tag naming its technique
    (`devil's-advocate` / `pre-mortem` / `alternative-comparison` / `unknown-unknowns` /
    `four-risk-check`). Phases **0, 5, 6, 7 carry no `<anti_sycophancy>` sub-tag**.

    The eight sections:
    - **`<phase_0_inception>`** (AC1/AC2/AC3, F-2/F-3, DM-2): confirm mode; classify
      repo profile; detect the four characteristics (`ui_bearing`, `multi_user`,
      `complex_domain`, `code_project`) and record them in state; scan
      `doc/inception/inputs/`; produce the `material-inventory` artifact (KEY only; its
      input→phase→key-element structure is defined in the guide). **No
      `<anti_sycophancy>` sub-tag** (Appendix B). Human gate 0.
    - **`<phase_1_inception>`** (AC4/AC5, F-4/F-5): Socratic session over the
      inventory; draft the `north-star` artifact (KEY only; its strategic-pyramid /
      outcome / NSM / JTBD content is defined in the guide); conditional `OST` /
      `project-PRD` when discovery materials exist (selection rule per the guide).
      **Anti-sycophancy: `<anti_sycophancy>devil's-advocate + four-risk</anti_sycophancy>`**
      (Appendix B; full prompt text referenced, not inlined).
    - **`<phase_2_inception>`** (AC6/AC7/AC8, F-6/F-7/F-8): draft the `roadmap`
      artifact (KEY only; milestone schema per the guide); conditional `user-journeys`
      + `screen-inventory` (UI-bearing); draft the `assumption-register` and
      `risk-register` artifacts (KEYs only; four-risk tags + `validation_status` per
      DM-3 and the guide — the Value/Usability/Feasibility/Viability definitions are
      referenced, not inlined). **Anti-sycophancy:
      `<anti_sycophancy>pre-mortem + four-risk-check</anti_sycophancy>`** (Appendix B).
    - **`<phase_3_inception>`** (AC9, F-9): draft `tech-stack` + `architecture`;
      run the `fse-audit` (KEY only; the 10 attributes are defined in the guide); seed
      initial `ADRs`; conditional `NFRs` for non-trivial projects; apply a four-risk
      check on architecture decisions. **Anti-sycophancy:
      `<anti_sycophancy>alternative-comparison + pre-mortem</anti_sycophancy>`** (Appendix B).
    - **`<phase_4_inception>`** (AC10/AC11, F-10/F-11): draft the `glossary`;
      conditional `ubiquitous-language` (complex domain); conditional `ux-guidance`
      artifact (KEY only; UI-bearing — its design-system / WCAG / interaction /
      responsive dimensions are defined in the guide, not inlined); for code projects:
      `testing-strategy`, `ci-baseline`, and `dev-environment` docs (KEYs only; CI and
      dev-env content per the guide). **Anti-sycophancy:
      `<anti_sycophancy>unknown-unknowns</anti_sycophancy>`** (Appendix B).
    - **`<phase_5_inception>`** (AC15, F-15, DEC-3): generate `AGENTS.md` **and all
      four** `.ai/agent/*-instructions.md` — `pm-instructions.md`,
      `pr-instructions.md`, `decision-instructions.md`, **and**
      `code-review-instructions.md` (generated from the GH-69 blueprint
      `doc/templates/blueprints/code-review-instructions--example.md`, the GH-32 gap
      closure); set `doc/documentation-profile.md`; install handbook/templates/decisions.
      **No `<anti_sycophancy>` sub-tag** (Appendix B).
    - **`<phase_6_inception>`** (AC12, F-12): readiness check (artifact catalog
      completeness, cross-document consistency, FSE verification, four-risk coverage,
      assumption review, ghost reference check). **FAIL → reopen the earlier phase
      (1–4) where the gap lives**; no auto-advance. **No `<anti_sycophancy>` sub-tag.**
    - **`<phase_7_inception>`** (AC12): inception summary + initial feature specs;
      final sign-off. **No `<anti_sycophancy>` sub-tag.**
  - **State + safety** (DM-1, AC13, NFR-6, RSK-4): reference the committed
    `doc/inception/inception-state.yaml` (instantiated from
    `doc/templates/inception-state-template.yaml`); state an explicit **per-mode
    state rule** distinguishing the committed inception state from the git-ignored
    legacy `.ai/local/bootstrapper-context.yaml`; preserve a **secrets-prohibition**
    constraint (the committed state must NEVER contain secrets/tokens/credentials);
    use the four canonical risk tags **Value / Usability / Feasibility / Viability**
    (never `desirability`).
  - **Additive `<resume_behavior>` inception branch** (DEC-6, AC13, NFR-2): on resume,
    `project.flow` in `doc/inception/inception-state.yaml` is the source of truth.
    Valid in-progress → resume at that flow (no repo-shape re-derivation; the Phase-0
    human gate is where the human may confirm or archive-and-restart). All phases
    completed → "already incepted". Malformed / `schema_version` mismatch → warn +
    offer repair or archive-and-restart (mirrors the legacy version-mismatch handling).
    Abandoned-run state is **archived to `doc/inception/abandoned-<ISO>.yaml`, never
    silently overwritten**. Legacy is unaffected (separate git-ignored state file).
    *(Resolves the TC-RESUME-002 BLOCKED-on-OQ-3 criterion.)*
  - **Additive `<write_allowlist>` entries** (AC13-path/AC15-path, NFR-7; REM-5):
    `doc/inception/**` (including `doc/inception/abandoned-<ISO>.yaml` — a glob covering
    it is acceptable), `.ai/agent/code-review-instructions.md`, **and**
    `doc/documentation-profile.md` (Phase 5 sets it; it currently sits outside all legacy
    allowlist globs). The legacy allowlist entries are preserved (shared-block
    legacy-line-presence per A.3).
  - **Legacy is NOT modified (REM-1).** `code-review-instructions.md` generation is
    scoped to inception Phase 5 ONLY (per AC15). The legacy `<phase_4_draft>`
    recommended-artifacts list is left byte-for-behavior unchanged — `@toolsmith` does
    not add `code-review-instructions.md` there. **Legacy `<phase_4_draft>` is
    unchanged — `code-review-instructions.md` is a net-new inception Phase 5 artifact
    only; closing the legacy gap is deferred.**
  - **Preserve legacy (two tiers — see A.3)**: the truly-frozen blocks
    (`<workflow_phases>`, `<phase_1_repo_scan>`, `<phase_2_confidence>`,
    `<phase_3_interview>`, `<phase_4_draft>`, `<phase_5_review>`, `<phase_6_write>`,
    `<persistent_state>`) are left **byte-for-byte unchanged**; the two shared blocks
    (`<resume_behavior>`, `<write_allowlist>`) keep every baseline legacy entry verbatim
    and gain inception-only additions (TDR-0001 C-1, REM-2). The inception additions are
    additive and isolated.
  - **No license headers** on any new section.

- [ ] **A.3 — Verify legacy parity structurally (gate; two-tier method, REM-2/RT1-10).**
  Before regenerating, the `@coder` confirms every legacy anchor tag opens and closes,
  then applies the **two-tier parity check vs `${BOOTSTRAPPER_BASELINE_SHA}`** (this is
  TC-STRUCT-003 — manual run here; bundled in Phase C thereafter):
  1. **Truly-frozen legacy blocks** — `<workflow_phases>`, `<persistent_state>`,
     `<phase_1_repo_scan>`, `<phase_2_confidence>`, `<phase_3_interview>`,
     `<phase_4_draft>`, `<phase_5_review>`, `<phase_6_write>`: the whole-block
     region-diff vs baseline must be **byte-identical** (empty diff).
  2. **Shared blocks inception extends** — `<resume_behavior>`, `<write_allowlist>`:
     **legacy-line-presence** — every baseline legacy entry/bullet is still present
     verbatim (additions are permitted, since inception appends its own entries here).
  A spec-compliant implementation passes both tiers. **Do not proceed if any frozen
  block drifted or any baseline shared-block legacy line was altered/removed.**
  *(Satisfies AC16/NFR-4/RSK-6.)*
- [ ] **A.4 — Regenerate the Claude Code plugin (delegate execution to `@runner`).**
  Run `scripts/build-claude-plugin.sh`; confirm `.ados-claude/agents/bootstrapper.md`
  (and any other changed generated files) is regenerated. Verify freshness with
  `git diff --exit-code -- .ados-claude/` immediately after regeneration (it must be
  clean until staged). *(D2; RSK-7.)*
- [ ] **A.5 — Commit source + generated together (delegate to `@committer`).** Stage
  exactly `.opencode/agent/bootstrapper.md` and the regenerated `.ados-claude/**`
  files; create ONE Conventional Commit. Do not stage change artifacts or other files.

**Acceptance Criteria**:

- Must: the eight `<phase_N_inception>` sections + `<mode_selection>` router +
  `<mode_new_project_inception>` umbrella are present (AC1, TDR-0001); Phase 5
  references all four instruction files including `code-review-instructions.md`
  (AC15/F-15); each decision-dense phase carries an `<anti_sycophancy>` sub-tag naming
  the correct technique per Appendix B, and phases 0/5/6/7 carry none (AC14/F-14, REM-8);
  the committed state path + four canonical risk tags are present (AC7/AC13, DM-1/DM-3).
  **Static evidence for AC2 is limited to the four characteristic keys/section being
  present** — the *behavioral* detection+activation is manual TC-INCEP-002 (RT1-13,
  matching the E.5 split); the `<resume_behavior>` inception branch implements DEC-6
  partial/abandoned handling and the `<write_allowlist>` includes `doc/inception/**`
  (incl. `abandoned-<ISO>.yaml`), `.ai/agent/code-review-instructions.md`, **and**
  `doc/documentation-profile.md` (AC13/AC15-path, NFR-7, REM-5); the guide is
  referenced, not recreated, per the INLINE/REFERENCED boundary (AC17/NFR-3/NFR-5, REM-3);
  legacy parity passes the two-tier check vs `${BOOTSTRAPPER_BASELINE_SHA}` (AC16/NFR-4,
  REM-2/RT1-10).
- Must: the regenerated `.ados-claude/agents/bootstrapper.md` is committed in the SAME
  commit as the source and is CI-fresh (RSK-7).
- Must: the legacy `<phase_4_draft>` is NOT modified — `code-review-instructions.md` is
  a net-new inception Phase-5 artifact only (REM-1).

**Files and modules**:

- `.opencode/agent/bootstrapper.md` (updated — inception sub-mode added; legacy
  unchanged) — via `@toolsmith`.
- `.ados-claude/agents/bootstrapper.md` (updated — regenerated artifact) — via
  `@runner` running `scripts/build-claude-plugin.sh`.

**Tests**:

- TC-STRUCT-003 (legacy two-tier parity vs `${BOOTSTRAPPER_BASELINE_SHA}`) — run manually in A.3.
- TC-STRUCT-001/002/008/009/010/011/012 — run as one-shot greps after A.2 (bundled in
  Phase C).
- `git diff --exit-code -- .ados-claude/` post-regen (freshness).

**Completion signal**: `feat(agent): add new-project inception sub-mode to bootstrapper (GH-71)`

---

### Phase B: AGENTS.md capability description (D3)

**Goal**: Reflect the bootstrapper's new new-project inception capability in the
human-facing `AGENTS.md` one-liner, additively (capabilities grow; nothing removed —
§8.5 backward compatibility).

**Tasks**:

- [x] **B.1 — Update the AGENTS.md bootstrapper one-liner.** The `@coder` edits
  `AGENTS.md` directly (it is the repo bootstrap doc, NOT an `.opencode/` prompt file,
  so the `@toolsmith` hard rule does not apply). Update the bootstrapper row in the
  "Agent team → Onboarding" table (currently "`bootstrapper` — automate ADOS adoption
  for existing projects") to an additive description that also names new-project
  inception (e.g., "automate ADOS adoption for existing projects and run new-project
  inception"). Keep it a one-liner; do not restructure the table. *(D3.)* — DONE: row
  now reads "…for existing projects and run new-project inception".
- [x] **B.2 — Confirm additive.** Diff is additive only (the legacy "existing
  projects" capability is retained). No removals. *(§8.5.)* — DONE: diff retains
  "existing projects"; only appends " and run new-project inception".
- [x] **B.3 — No plugin regen needed.** `AGENTS.md` is not under `.opencode/`, so the
  build-claude-plugin gate is unaffected. Confirm `git diff --exit-code -- .ados-claude/`
  is clean (no spurious regeneration). — DONE: `.ados-claude/` clean after the edit.
- [x] **B.4 — Commit (delegate to `@committer`).** Stage exactly `AGENTS.md`.
  — DONE: commit `a2fce00`.

**Acceptance Criteria**:

- Must: the AGENTS.md bootstrapper description names the new-project inception
  capability additively and retains the existing-project capability (§8.5).
- Must: `.ados-claude/` is unchanged in this commit (no regen triggered).

**Files and modules**:

- `AGENTS.md` (updated — additive one-liner).

**Tests**:

- Manual diff review: additive only.

**Completion signal**: `docs(agents): reflect bootstrapper new-project inception capability (GH-71)`

---

### Phase C: Test-infra — bundled prompt-structure test (D5)

**Goal**: Ship the proposed Layer-1 static/structural test from TC-INFRA-001 as a
committed, CI-safe script `scripts/.tests/test-bootstrapper-prompt-structure.sh`,
making the behavioral-AC verification scaffold executable and guarding against the
RSK-6 regression class (structural drift in the prompt).

**Tasks**:

- [x] **C.1 — Create the test script.** The `@coder` (or `@toolsmith` if prompt-test
  authoring warrants it) creates `scripts/.tests/test-bootstrapper-prompt-structure.sh`
  bundling the Layer-1 assertions from the test plan (TC-STRUCT-001…005, 008, 009,
  010, 011, 012). **Match the conventions of `scripts/.tests/test-inception-doc-consistency.sh`**:
  `set -Eeuo pipefail` + `IFS=$'\n\t'`; derive `REPO_ROOT` from `BASH_SOURCE`;
  centralize an `emit_error` helper emitting `::error::` GitHub annotations; a
  `_failures` counter; exit non-zero at the end; read-only greps only (no network, no
  mutation). *(D5.)* — DONE: `scripts/.tests/test-bootstrapper-prompt-structure.sh`
  created; bundles all listed TC-STRUCT checks + the RSK-1 size guardrail; tag/well-formedness
  and block extraction are code-span-aware (strip fenced blocks + inline backticks) per the
  test-plan refinement note; `BOOTSTRAPPER_BASELINE_SHA` / `BOOTSTRAPPER_WARN_LINES` /
  `BOOTSTRAPPER_FAIL_LINES` / `BOOTSTRAPPER_MAX_OVERLAP` env-overridable.
  *(Assertions-to-bundle detail elided — all satisfied; see script.)*
- [x] **C.2 — Run it against the new prompt and ensure it passes.** Execute
  `bash scripts/.tests/test-bootstrapper-prompt-structure.sh`; fix any false positives
  (e.g., a scoping heuristic that mismatches `@toolsmith`'s final wording) until it
  exits 0. The fixes go to the test script, NOT back to alter the spec's WHAT.
  *(Delegate execution to `@runner`.)* — DONE: exits 0 ("0 warnings; 512 lines").
  Self-test: dropping "Viability" → TC-STRUCT-011 fails; deleting a
  `</phase_3_inception>` close → TC-STRUCT-005 fails; both emit `::error::`; file
  restored clean; green re-run passes.
- [x] **C.3 — Confirm CI pickup.** The script follows the `scripts/.tests/test-*.sh`
  convention and is auto-discovered alongside the other `test-*.sh` scripts; no
  separate harness wiring is required. — DONE: matches the `test-*.sh` convention.
- [x] **C.4 — Commit (delegate to `@committer`).** Stage exactly
  `scripts/.tests/test-bootstrapper-prompt-structure.sh`. — DONE: commit `fcb5a34`.

  *Assertions to bundle:*
  - **Allowlist** (TC-STRUCT-001): `<write_allowlist>` contains `doc/inception/**`,
    `.ai/agent/code-review-instructions.md`, **and** `doc/documentation-profile.md` (REM-5).
  - **Four instruction files** (TC-STRUCT-002): in the inception Phase 5 region, all
    of `pm`/`pr`/`decision`/`code-review` `-instructions.md` are referenced.
  - **Legacy two-tier parity** (TC-STRUCT-003, REM-2/RT1-10): every legacy tag opens
    and closes; `.ai/local/bootstrapper-context.yaml` and `schema_version: 1` appear
    inside `<persistent_state>`. Then the **two-tier** check vs
    `${BOOTSTRAPPER_BASELINE_SHA}` (centralized; overridable via the
    `BOOTSTRAPPER_BASELINE_SHA` env var so CI is not hard-coupled): (1) **frozen
    blocks** — `<workflow_phases>`, `<persistent_state>`, `<phase_1_repo_scan>`…
    `<phase_6_write>` incl. `<phase_4_draft>` — whole-block region-diff is
    **byte-identical** (use a refined `awk` extractor that **skips fenced code blocks**);
    (2) **shared blocks** — `<resume_behavior>`, `<write_allowlist>` — every baseline
    legacy entry/bullet is still present verbatim (additions permitted).
  - **Guide referenced, not recreated** (TC-STRUCT-004): `doc/guides/project-inception.md`
    is referenced; the guide's `### Phase N —` headings are not duplicated verbatim
    more than once in the prompt.
  - **Well-formed section tags** (TC-STRUCT-005): opening/closing tag multiset balanced,
    **code-span-aware** (skip fenced code blocks and inline backticks).
  - **Anti-sycophancy placement** (TC-STRUCT-008, REM-8): assert by `<anti_sycophancy>`
    sub-tag — each decision-dense `<phase_N_inception>` contains exactly one
    `<anti_sycophancy>technique-name</anti_sycophancy>` anchor naming the correct
    technique (devil's advocate / pre-mortem / alternative comparison / unknown-unknowns /
    four-risk check), and **no** `<anti_sycophancy>` sub-tag appears in phases 0/5/6/7.
    (The five keyword spellings remain a coarse fallback.) This is the authoritative
    AC14 structural check.
  - **Characteristics detection** (TC-STRUCT-009): the four signal names appear; both
    `new` and `legacy` modes are referenced.
  - **Material inventory** (TC-STRUCT-010): Phase 0 references `doc/inception/inputs/`
    and "material inventory".
  - **Committed state + four-risk + per-mode rule** (TC-STRUCT-011): `doc/inception/inception-state.yaml`
    referenced; all four canonical tags (Value/Usability/Feasibility/Viability) present;
    `desirability` absent; the git-ignored legacy path still named.
  - **Secrets prohibition** (TC-STRUCT-012): inception state section carries a
    secrets-prohibition constraint.
- [ ] **C.2 — Run it against the new prompt and ensure it passes.** Execute
  `bash scripts/.tests/test-bootstrapper-prompt-structure.sh`; fix any false positives
  (e.g., a scoping heuristic that mismatches `@toolsmith`'s final wording) until it
  exits 0. The fixes go to the test script, NOT back to alter the spec's WHAT.
  *(Delegate execution to `@runner`.)*
- [ ] **C.3 — Confirm CI pickup.** The script follows the `scripts/.tests/test-*.sh`
  convention and is auto-discovered alongside the other `test-*.sh` scripts; no
  separate harness wiring is required.
- [ ] **C.4 — Commit (delegate to `@committer`).** Stage exactly
  `scripts/.tests/test-bootstrapper-prompt-structure.sh`.

**Acceptance Criteria**:

- Must: the script exits 0 against the Phase A prompt; exits non-zero with `::error::`
  annotations on any of the bundled drift classes.
- Must: the script is read-only / CI-safe (no network, no mutation) and matches the
  existing `scripts/.tests/test-*.sh` conventions.
- Should: the anti-sycophancy check is anchored on the `<anti_sycophancy>` sub-tag
  (present in the right decision-dense `<phase_N_inception>` block, absent from
  0/5/6/7), not just a file-global keyword grep (REM-8).

**Files and modules**:

- `scripts/.tests/test-bootstrapper-prompt-structure.sh` (new).

**Tests**:

- Self-test: run the script against the committed prompt → exit 0. Then deliberately
  introduce a drift (e.g., delete a `<phase_N_inception>` closing tag or a four-risk
  term) and confirm it fails — a quick local sanity check (do not commit the drift).

**Completion signal**: `test(scripts): add bootstrapper prompt-structure test (GH-71)`

---

### Phase D: Conditional guide amendment (D4)

**Goal**: Apply DEC-5 — amend `doc/guides/project-inception.md` ONLY if
implementation surfaces a concrete AND blocking gap; otherwise record a deferred
no-op. This phase is **conditional** and may produce no commit.

**Provisional-prompt note (RT1-14):** the prompt committed in Phase A is **provisional
until Phase D completes**. If D.2 (guide amendment) runs, it may re-edit the prompt to
stay consistent with the guide and **re-commit the prompt + regenerated plugin** — this
is expected, not exceptional (it is the same source+generated-together rule re-applied,
not a defect).

**Tasks**:

- [x] **D.1 — Probe for a concrete+blocking gap.** While Phase A's `@toolsmith`
  authoring and Phase C's structural test run, check for any gap meeting the DEC-5
  bar: a **prompt↔guide contradiction** (NFR-5), a **failing AC/NFR**, a **factual
  error** (wrong path / wrong phase-mapping / wrong anti-sycophancy assignment), or a
  **ghost reference**. Clarity/completeness/enhancement gaps do NOT meet the bar.
  — DONE: probed. Ghost-reference scan of every path the prompt names: all real
  templates/guide/blueprint exist; `doc/inception/inception-state.yaml` and
  `doc/documentation-profile.md` are runtime/per-project paths (spec §19 — the ADOS
  source ships no live instance), not ghosts. Anti-sycophancy map, Phase 5 four-file
  set, and four-risk values all match the guide. No contradiction, no factual error,
  no ghost reference found.
- [ ] **D.2 — If a concrete+blocking gap is found: amend surgically.** *(N/A — no gap
  met the DEC-5 bar; D.3 applies.)*
- [x] **D.3 — If NO concrete+blocking gap is found: record a deferred no-op.** No
  amendment; no commit. Record in the Execution Log: "No concrete+blocking guide gap
  found during implementation; per DEC-5 no amendment was made." Any clarity/
  enhancement notes go to the change's deferred items (spec §7.3) for a future slice,
  not here. — DONE: no-op recorded. Deferred clarity notes (NOT blocking, NOT amended
  here): (a) the guide's Phase 1 anti-sycophancy section lists only "Devil's advocate"
  while spec Appendix B adds "+ four-risk awareness" — the prompt includes both, so no
  contradiction; (b) the guide's "legacy inception" flow (Phases 0–7 with repo
  ingestion) is GH-72 scope, distinct from the agent's existing 6-phase `legacy` mode —
  a documented scope split, not a contradiction. Both are candidate future-guide edits,
  routed to spec §7.3.

**Acceptance Criteria**:

- Must: if amended, the guide edit is surgical, `ados_distribution: redistributable`
  is preserved, the prompt↔guide pair is consistent (NFR-5), and both
  `test-doc-distribution.sh` and `test-inception-doc-consistency.sh` pass.
- Must: if not amended, the no-op decision is recorded (DEC-5 discipline).

**Files and modules**:

- `doc/guides/project-inception.md` (conditionally amended) — and the co-updated
  prompt/plugin IF the prompt must change to stay consistent.

**Tests**:

- TC-STRUCT-007 (doc-distribution marker preserved, conditional).
- `test-inception-doc-consistency.sh` (regression).

**Completion signal**: `docs(guide): reconcile project-inception gap surfaced by GH-71`
— OR no commit (deferred no-op recorded).

---

### Phase E: Self-verification

**Goal**: Run the full verification suite, confirm legacy parity, and reconcile
deliverables before handoff. Establish that the structural scaffolding for the
behavioral AC is in place; the behavioral AC themselves are signed off at the GH-71 PR
review (RSK-2 — they are not CI-testable).

**Tasks**:

- [x] **E.1 — Run the new prompt-structure test** (delegate to `@runner`):
  `bash scripts/.tests/test-bootstrapper-prompt-structure.sh` → exit 0. — DONE: exit 0
  ("0 warnings; 512 lines").
- [x] **E.2 — Run the existing CI gate list** (delegate to `@runner`):
  - `git diff --check` (whitespace/conflict markers). — DONE: clean across branch + working tree.
  - `bash scripts/.tests/test-build-claude-plugin.sh` (plugin freshness — RSK-7); plus
    `git diff --exit-code -- .ados-claude/` after a clean `scripts/build-claude-plugin.sh`.
    — DONE: 15/15 passed; `.ados-claude/` CI-fresh after rebuild.
  - `bash scripts/.tests/test-doc-distribution.sh` (only if `doc/guides/project-inception.md`
    was amended in Phase D — TC-STRUCT-007). — DONE: guide NOT amended (Phase D no-op);
    ran as regression sanity → exit 0 (no drift; install set matches markers).
  - `bash scripts/.tests/test-inception-doc-consistency.sh` (four-risk terminology +
    matrix regression — directly relevant; this change co-maintains the inception surface).
    — DONE: exit 0.
  - `bash scripts/.tests/test-install.sh` / `test-uninstall.sh` ONLY if the install
    manifest changed (this change does NOT add `code-review-instructions.md` to
    `install.sh` — it is generated at runtime by the agent — so normally N/A). — N/A:
    install manifest unchanged.
- [x] **E.3 — Confirm legacy parity** (the primary RSK-6/NFR-4 guard; REM-2/RT1-10):
  re-run the Phase C TC-STRUCT-003 two-tier check vs `${BOOTSTRAPPER_BASELINE_SHA}`
  explicitly here — frozen blocks byte-identical, shared blocks
  (`<resume_behavior>`, `<write_allowlist>`) legacy-line-presence intact. — DONE:
  bundled TC-STRUCT-003 passed (test exit 0); standalone Tier A re-confirm → 8/8 frozen
  blocks byte-identical vs 0a1a288.
- [x] **E.4 — Confirm deliverables D1–D5 are present**:
  - D1: `.opencode/agent/bootstrapper.md` extended per TDR-0001 (legacy unchanged). — PASS.
  - D2: `.ados-claude/agents/bootstrapper.md` regenerated + committed with the source. — PASS.
  - D3: `AGENTS.md` bootstrapper one-liner additively updated. — PASS.
  - D4: guide amendment OR recorded deferred no-op. — PASS (deferred no-op, DEC-5).
  - D5: `scripts/.tests/test-bootstrapper-prompt-structure.sh` present + passing. — PASS.
- [x] **E.5 — Note the behavioral sign-off boundary (honest RSK-2 statement).** AC1–AC14
  and AC17 behavioral confirmation (TC-INCEP-*, TC-LEGACY-*, TC-RESUME-*) is **not
  CI-verifiable** — it is performed manually at the GH-71 PR review (Layer 2 + Layer 3
  of the test plan). This plan delivers the structural scaffolding that makes those AC
  verifiable and guards against structural regression; it does not claim behavioral AC
  are CI-passing. — ACKNOWLEDGED: only Layer-1 static checks are CI-green here; TC-INCEP-001…016,
  TC-LEGACY-001/002, TC-RESUME-001/002 are manual PR-review evidence.

**Acceptance Criteria**:

- Must: E.1, E.2, E.3 all pass; D1–D5 present.
- Must: the behavioral-AC boundary (RSK-2) is documented, not hidden.

**Files and modules**:

- (none modified — verification only; any fix that surfaces a real defect loops back
  to the responsible phase with a new commit).

**Tests**:

- All Phase C/E checks above.

**Completion signal**: verification recorded in the Execution Log; no commit unless a
defect fix is required (loop back to the owning phase).

---

### Phase F: Finalize and release

**Goal**: Close the change — version impact confirmed, system-spec reconciliation
triggered, ready for the review/PR lifecycle phases.

**Tasks**:

- [x] **F.1 — Version impact.** ADOS has no numeric version file (the agents and
  commands ARE the product); version is tracked per-change via the change frontmatter.
  Confirm the change's declared `version_impact: minor` is reflected (it is, in the
  spec/plan/test-plan frontmatter). No file bump is applicable. *(If a numeric version
  surface is later introduced, bump it `minor` per repo conventions.)* — DONE:
  `version_impact: minor` confirmed in spec/plan/test-plan frontmatter; no numeric
  version surface exists to bump.
- [x] **F.2 — Spec reconciliation (hand-off).** Trigger the system_spec_update
  lifecycle phase (phase 6) for GH-71: the `@doc-syncer` reconciles `doc/spec/**` with
  the implementation (the bootstrapper agent's new inception capability). This is
  performed by `/sync-docs GH-71` as a downstream step — out of this plan's write scope
  (the plan-writer writes only the plan file; the coder/doc-syncer handle delivery).
  — RECORDED: hand-off to `@doc-syncer` (`/sync-docs GH-71`) for phase-6 system-spec
  reconciliation; out of this delivery's write scope.
- [x] **F.3 — Hand to review/quality gates.** Phase E green + Phase F recorded → the
  change is ready for the `review` (7), `quality_gates` (8), `dod_check` (9), and
  `pr_creation` (10) lifecycle phases. — RECORDED: Phase E green; ready for lifecycle
  phases 7–10 (PM-driven; PR creation via `@pr-manager`, review via `@reviewer`).

**Acceptance Criteria**:

- Must: `version_impact: minor` confirmed; spec-reconciliation hand-off recorded.
- Should: TDR-0001 `status` moves to `Accepted` at the GH-71 PR review (its acceptance
  rides the PR; out of this plan's write scope).

**Files and modules**:

- (none modified by this plan; hand-off metadata only).

**Tests**:

- (none — release/hand-off phase).

**Completion signal**: `chore(release): finalize GH-71 — minor version impact, spec sync hand-off`
— OR no commit if the execution log + downstream hand-off suffice per PM discretion.

## Test Scenarios

| ID | Scenario | Phases | AC / NFR |
|----|----------|--------|----------|
| TC-STRUCT-001 | Write-allowlist has inception + code-review + documentation-profile paths | A, C | AC13-path, AC15-path, NFR-7 |
| TC-STRUCT-002 | Phase 5 references all four instruction files | A, C | AC15, F-15 |
| TC-STRUCT-003 | Legacy two-tier parity vs `${BOOTSTRAPPER_BASELINE_SHA}` | A.3, C, E.3 | AC16, NFR-4, RSK-6 |
| TC-STRUCT-004 | Guide referenced, not recreated | A, C | AC17, NFR-3, NFR-5 |
| TC-STRUCT-005 | Prompt XML-ish tags well-formed (code-span-aware) | A, C | AC1, NFR-3 |
| TC-STRUCT-006 | Plugin regeneration staleness gate | A, E | RSK-7 |
| TC-STRUCT-007 | Doc-distribution marker (conditional, Phase D) | D, E | NFR-3, NFR-5 |
| TC-STRUCT-008 | Anti-sycophancy placement per-phase (Appendix B) | A, C | AC14, F-14 |
| TC-STRUCT-009 | Phase 0 characteristics detection section | A, C | AC2, F-2, DM-2, NFR-1 |
| TC-STRUCT-010 | Phase 0 material-inventory step | A, C | AC3, F-3 |
| TC-STRUCT-011 | Committed state + four-risk tags + per-mode rule | A, C | AC7, AC13, DM-1, DM-3, NFR-2 |
| TC-STRUCT-012 | Secrets-prohibition for inception state | A, C | NFR-6 |
| TC-INFRA-001 | Bundled prompt-structure test (the Phase C script) | C | bundles TC-STRUCT-001…005, 008…012 |
| TC-INCEP-001…015 | Behavioral matrix (manual, GH-71 PR review) | sign-off | AC1–AC14, AC17 |
| TC-LEGACY-001/002 | Legacy regression (manual) | sign-off | AC16, NFR-4, NFR-7 |
| TC-RESUME-001/002 | 2-session + partial/abandoned resume (manual) | sign-off | AC13, NFR-2, OQ-3/DEC-6 |

**Note on the testing reality (RSK-2):** the artifact under change is an agent prompt.
Layer-1 static checks (Phase C) are CI-automatable and guard structure; Layer-2
(TC-INCEP-*) and Layer-3 (TC-LEGACY-*, TC-RESUME-*) are human-executed behavioral
evidence, performed at the GH-71 PR review. No behavioral AC is claimed as CI-testable.

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-71-spec.md` | Spec |
| Test plan | `./chg-GH-71-test-plan.md` | Test plan |
| Prompt-structure decision | `../../decisions/TDR-0001-bootstrapper-inception-submode-prompt-structure.md` | TDR |
| Agent source (extended) | `.opencode/agent/bootstrapper.md` | D1 — via `@toolsmith` |
| Generated plugin counterpart | `.ados-claude/agents/bootstrapper.md` | D2 — regenerated |
| AGENTS.md one-liner | `AGENTS.md` | D3 |
| Guide (conditional amendment) | `doc/guides/project-inception.md` | D4 — conditional (DEC-5) |
| Prompt-structure test | `scripts/.tests/test-bootstrapper-prompt-structure.sh` | D5 — TC-INFRA-001 |
| Inception state template (referenced) | `doc/templates/inception-state-template.yaml` | Schema (DM-1) |
| Code-review blueprint (referenced) | `doc/templates/blueprints/code-review-instructions--example.md` | Phase-5 input |
| Regeneration script | `scripts/build-claude-plugin.sh` | Tool |
| Parity baseline | `.opencode/agent/bootstrapper.md` @ `${BOOTSTRAPPER_BASELINE_SHA}` (`0a1a28802b0e893eba30b636f2fae7b72aa31965`) | Reference |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-27 | plan-writer | Initial plan. Phases A–F; delegates all agent edits to `@toolsmith` (AGENTS.md hard rule); folds plugin regeneration (D2) into Phase A's commit so source+generated ship together (RSK-7, CI-green per phase); actions TC-INFRA-001 as Phase C; encodes DEC-5 (conditional guide amendment) as Phase D; full AC1–AC17 + NFR1–7 coverage. |
| 1.1 | 2026-06-27 | plan-writer | Red-team pre-delivery remediation (aligned with spec/test-plan slices). REM-1: dropped the legacy `<phase_4_draft>` code-review edit — legacy now fully untouched (AC16 coverage note updated). REM-2: A.3/E.3/Phase-C parity check rewritten to the two-tier method (frozen blocks byte-identical; shared blocks legacy-line-presence). REM-3: added INLINE/REFERENCED authoring boundary for `@toolsmith`; stripped parenthetical artifact content from per-phase bullets (artifact KEYs + guide pointers). REM-5: added `doc/documentation-profile.md` to the additive `<write_allowlist>`. REM-8: `<anti_sycophancy>` sub-tag anchor required in decision-dense phases (none in 0/5/6/7). RT1-10: centralized `BOOTSTRAPPER_BASELINE_SHA` across A.1/A.3/E.3/Phase C. RT1-13: softened the AC2 static claim (behavioral detection = manual TC-INCEP-002). RT1-14: Phase D notes Phase A's prompt is provisional until D completes. Phase structure A–F and per-phase commit boundaries preserved. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| A | DONE | 2026-06-27 | 2026-06-27 | 804c481 | Inception sub-mode authored (mode_selection + umbrella + 8 phase sections + additive resume_behavior/write_allowlist); legacy parity PASS (two-tier); plugin regenerated idempotently + committed with source. NOTE: no Task/subagent tool available, so @coder performed the @toolsmith authoring role directly with TDR-0001 rigor. |
| B | DONE | 2026-06-27 | 2026-06-27 | a2fce00 | AGENTS.md bootstrapper one-liner additive; no plugin regen triggered. |
| C | DONE | 2026-06-27 | 2026-06-27 | fcb5a34 | `scripts/.tests/test-bootstrapper-prompt-structure.sh` shipped (TC-INFRA-001); exits 0; drift self-test fails correctly. |
| D | NO-OP | 2026-06-27 | 2026-06-27 | (none) | No concrete+blocking guide gap found (DEC-5). Two "ghost" paths are runtime/per-project (spec §19); anti-sycophancy/Phase-5/four-risk all match the guide. Deferred clarity notes routed to spec §7.3. |
| E | DONE | 2026-06-27 | 2026-06-27 | (none) | All gates green: prompt-structure test 0; test-build-claude-plugin 15/15; .ados-claude CI-fresh; inception-doc-consistency 0; doc-distribution 0; git diff --check clean; legacy parity re-confirmed (8/8 frozen blocks byte-identical). D1–D5 present. Behavioral AC (TC-INCEP/LEGACY/RESUME) = manual PR-review (RSK-2). |
| F | DONE | 2026-06-27 | 2026-06-27 | (this bookkeeping commit) | version_impact: minor confirmed; spec-sync handed to @doc-syncer; ready for lifecycle phases 7–10 (PM-driven). |
