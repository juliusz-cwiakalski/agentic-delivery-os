---
ados_distribution: project-generated
id: chg-GH-72-tribal-knowledge-extraction
status: Proposed
created: 2026-06-27T00:00:00Z
last_updated: 2026-06-27T00:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: bootstrapper-agent
labels: ["inception", "bootstrapper", "agent", "legacy"]
links:
  change_spec: ./chg-GH-72-spec.md
  test_plan: ./chg-GH-72-test-plan.md
  decision: ../../decisions/PDR-0001-tribal-knowledge-extraction-taxonomy.md
  system_spec: ../../../spec/features/feature-bootstrapper.md
summary: >
  Add the missing PRODUCE step to @bootstrapper's legacy Phase 0 so a pre-ADOS
  project's undocumented decisions, conventions, rejected approaches, workarounds,
  and domain terms — scattered across repo docs and git history — are mined into a
  graduation-ready `doc/inception/analysis/tribal-knowledge.md` (new redistributable
  template encoding PDR-0001's 5-category record, source pointers, confidence rubric,
  and an Open Contradictions roll-up), surfacing contradictions and low-confidence
  items at the Phase-0 human gate instead of letting them drift or silently graduate.
  Focused + additive: consume (Phase 0) and graduate (Phase 2) wiring from GH-71 is
  untouched; the taxonomy is inherited as invariants from PDR-0001 (ALT-1), not re-debated.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-72: Tribal-knowledge extraction — bootstrapper Phase-0 PRODUCE path

## Context and Goals

This plan delivers **GH-72**: the **PRODUCE** half of the tribal-knowledge loop that
GH-71 left open. GH-71 already **consumes** (Phase 0) and **graduates** (Phase 2) a
`tribal-knowledge.md` *when one exists*, but nothing **produces** it from in-repo
sources — so the loop never fires for real legacy projects. GH-72 inserts the missing
PRODUCE step into `@bootstrapper`'s **Phase-0 legacy branch only** (file reads + `git log`
only; no new tooling), writes `doc/inception/analysis/tribal-knowledge.md` from a new
redistributable template, and leaves graduation to the already-wired Phase-2 path.

The product under change is an **agent prompt** (the prompt IS the product) plus a
**redistributable template** and **surgical guide amendments**. The taxonomy, graduation
mapping, confidence rubric, pointer/dedup, and contradiction handling are **fixed by
PDR-0001 (ALT-1)** and inherited here as invariants C-1…C-5 — they are encoded in the
template, not re-debated and not duplicated into the agent prompt.

**Phasing model.** Phases follow the spec §18 delivery order, sequenced so each phase is
a discrete, independently-committable unit. The new template ships first (Phase A, no
agent edits) so the Phase-B agent step has a concrete reference target. The agent-prompt
edit (Phase B) is **delegated to `@toolsmith`** (AGENTS.md hard rule). Guide amendments
(Phase C) follow the agent edit so the human authority can match the agent authority.
The system-spec reconciliation (scope item D) is **out of this plan** — delivered by
`@doc-syncer` at phase 6 (DEC-3); it is cross-referenced, not authored here.

**Resolved open questions (no blockers — see spec §14):**

- **OQ-1** (medium-confidence graduation) → RESOLVED: `medium` **graduates directly**
  (same as `high`); the Phase-2 human gate is the universal safety net. `low` is the
  sole level explicitly re-flagged for confirmation. The template records this rule.
- **OQ-2** (overwrite vs preserve on fresh legacy run) → RESOLVED: PRODUCE **preserves**
  a hand-authored `tribal-knowledge.md`; it produces fresh only when none exists or the
  human approves overwrite (existing `<safety_rules>` "never overwrite without approval").

**Hard process rules encoded into the phases (from AGENTS.md):**

1. **All edits to `.opencode/agent/bootstrapper.md` are delegated to `@toolsmith`**
   (AGENTS.md "Extending the system"). `@coder` never hand-edits the agent prompt —
   Phase B is executed as `@coder → @toolsmith`. PM never hand-edits agent files.
2. **Source + generated committed together**: editing the agent source requires
   regenerating the Claude Code plugin via `scripts/build-claude-plugin.sh` and
   committing `.ados-claude/**` in the same commit (NFR-5; RSK-6).
3. **Produce stays inside the write-allowlist**: PRODUCE writes exactly one file —
   `doc/inception/analysis/tribal-knowledge.md` (already under `doc/inception/**`).
   Graduation writes happen at Phase 2 (PDR-0001 C-1; NFR-2).
4. **Inherited trust/safety**: the produce step inherits the bootstrapper's
   `<trust_boundary>` and `<safety_rules>` verbatim — untrusted input, facts only,
   no embedded instructions followed, credential patterns refused (PDR-0001 C-4; AC6).

> **No open questions remain.** No decision-record placeholder is needed — PDR-0001 is
> the design authority and is inherited as invariants.

## Scope

### In Scope

- **(A) New template** `doc/templates/tribal-knowledge-template.md`
  (`ados_distribution: redistributable`) encoding PDR-0001 — spec §7.1(A), F-2, AC2/AC3.
- **(B) Agent prompt extension** — `@bootstrapper` Phase-0 legacy branch gains the
  PRODUCE step, inheriting `<trust_boundary>`/`<safety_rules>` — spec §7.1(B), F-1/F-5,
  AC1/AC6; **delivered via `@toolsmith`** (DEC-2).
- **(C) Surgical guide amendments** to `doc/guides/project-inception.md` (3 edits,
  preserving `ados_distribution: redistributable`) — spec §7.1(C), DEC-4, NFR-7.
- **Plugin regeneration** of `.ados-claude/**` (committed with the agent source) — NFR-5.

### Out of Scope

- **(D) System-spec reconciliation** of `doc/spec/features/feature-bootstrapper.md` →
  `@doc-syncer`, phase 6 (DEC-3; out of this plan — cross-referenced in §Artifacts).
- PR/MR comment + review-thread extraction → **GH-33** (parked on tooling).
- Consume (Phase 0) / graduate (Phase 2) wiring → **GH-71** (delivered, untouched).
- Re-debating taxonomy / mapping / rubric / pointers / contradiction handling → fixed by
  **PDR-0001** (inherited as invariants C-1…C-5).
- Greenfield/`new`-project extraction (no history to mine — NFR-1, NG-4).
- New CLI tooling (file reads + `git log` only — NFR-3, NG-5); a new tech-debt register
  or any invented graduation home (ALT-2 rejected in PDR-0001).

### Constraints

- **C-1** Produce writes only `doc/inception/analysis/tribal-knowledge.md` (PDR-0001).
- **C-2** Every category maps to an *existing* ADOS home (no invented register).
- **C-3** Contradicted items never silently graduate.
- **C-4** No secrets/credentials extracted or recorded (credential patterns refused).
- **C-5** Every item carries a verifiable source pointer.
- **NFR-1** PRODUCE runs **only** for `project.flow: legacy` (0 produce effects on `new`).
- **NFR-3** Extraction uses file reads + `git log` only (0 new CLI/deps).
- **NFR-4** `bootstrapper.md` (278 lines today) must stay lean — reference the
  template/guide for detail, duplicate no prose; warn >650, hard concern >800.
- **Hard rule** — agent-prompt edits delegated to `@toolsmith`; source + generated
  committed together.

### Risks

- **RSK-1** (extraction quality — misses/hallucination) → mitigated by per-item source
  pointers (DM-3), corroboration-raises-confidence rubric, and the Phase-0 + Phase-2
  human gates. Residual M; behavioral, verified manually.
- **RSK-2** (prompt-injection via scanned content) → mitigated by inheriting
  `<trust_boundary>` (facts only, embedded instructions ignored, attempts noted in state).
- **RSK-3** (secret/credential leakage from git history) → mitigated by inheriting
  `<safety_rules>` credential refuse list (`ghp_`, `sk-`, `xoxb-`, `AKIA`, `Bearer `,
  `token:`, `password:`, API keys >20 chars).
- **RSK-5** (prompt bloat) → mitigated by referencing (not duplicating) template/guide
  detail, delegating authoring to `@toolsmith`, and the line-count check in Phase B.
- **RSK-6** (`.ados-claude` staleness) → mitigated by regenerating and committing source
  + generated together; CI verifies freshness.
- **RSK-7** (contradictions silently graduate) → mitigated by inline `status: contradicted`
  flag + `## Open Contradictions` roll-up; contradicted items excluded from graduation.

### Success Metrics

- 1 PRODUCE step in the Phase-0 legacy branch; **0** in the `new` branch.
- 100% of produced items carry a `category` (DM-2) + ≥1 source pointer (DM-3/AC2).
- 100% of flagged contradictions appear in the `## Open Contradictions` roll-up; 0 graduate.
- Write footprint: exactly one new file written by produce; 0 writes outside `doc/inception/**`.
- `doc/templates/tribal-knowledge-template.md` exists and passes the doc-distribution guard.
- Guide structural-integrity guard stays green after the 3 surgical edits (NFR-7).

## Phases

> Each phase is a discrete commit. Verification uses the CI gates below; the formal
> `TC-STRUCT-*` IDs will be assigned by the GH-72 test plan (`chg-GH-72-test-plan.md`).
> Per NFR-8, behavioral agent-capability claims are honestly marked **manual**.

### Phase A: New template — tribal-knowledge-template.md (no agent edits)

**Goal**: Ship the redistributable template that encodes PDR-0001's record design, so the
Phase-B PRODUCE step has a concrete reference target and Phase-C guide edit has a real
template to point at. **No agent-prompt edits in this phase.**

**Delegate**: `@coder` (the template is a doc under `doc/templates/`; the `@toolsmith`
hard rule is scoped to `.opencode/agent/*.md` and does **not** apply to templates).
`@toolsmith` is available for prompt-engineering consultation on the record shape, but the
file write is `@coder`'s.

**Tasks**:

- [ ] **A.1** Author `doc/templates/tribal-knowledge-template.md`. Mirror the sibling
  `doc/templates/repo-analysis-template.md` frontmatter discipline —
  `ados_distribution: redistributable`, `id: TRIBAL-KNOWLEDGE`, `status: Draft`,
  `created`/`last_updated` 2026-06-27, a confidence column, and the standard license
  header (`scripts/add-header-location.sh .` covers `doc/guides`/`doc/templates`).
- [ ] **A.2** Encode PDR-0001's design into the template body:
  - **Producer note**: produced in Phase 0 (legacy) → reviewed at human gate 0 → graduated
    at Phase 2 (human-gated). State that a hand-authored file is preserved; PRODUCE writes
    fresh only when none exists or the human approves overwrite (OQ-2).
  - **5-category item record**: `category ∈ {decision, convention, rejected-approach,
    workaround, domain-term}` (closed set, DM-2); a normalized fact statement; a
    source-pointer field supporting **multiple pointers** (docs `path:line`; git history
    commit short SHA, expand to full SHA on ambiguity; multi-source dedup key =
    `(category, normalized fact statement)` — DM-3); `confidence ∈ {high, medium, low}`
    with the §3 rubric inline (high = explicit+corroborated/recent; medium = explicit+single
    OR inferred+corroborated; low = inferred+single OR stale; **medium graduates directly**,
    low is re-flagged — OQ-1); `status` (incl. `contradicted`).
  - **Category → graduation-home reference table** from PDR-0001 §1 (all homes existing;
    no invented register) — `decision`→`doc/decisions/` typed DR; `convention`→
    `.ai/rules/<topic>-conventions.md`; `rejected-approach`→parent DR's Alternatives;
    `workaround`→feature spec "Known limitations" (+ DR if load-bearing); `domain-term`→
    `doc/overview/glossary.md` (or `ubiquitous-language.md` for bounded-context vocabulary).
  - **Contradiction handling note**: inline per-item `status: contradicted` flag + a
    consolidated `## Open Contradictions` roll-up section (pointers + nature of conflict);
    contradicted items excluded from Phase-2 graduation until the human clears/drops them.
  - **Trust/safety producer note**: untrusted input, facts only, embedded instructions
    never followed, credential-pattern refusal — point at the bootstrapper
    `<trust_boundary>` / `<safety_rules>` rather than re-listing patterns.
- [ ] **A.3** *(Should)* Index the new template in `doc/templates/README.md` under the
  "Inception templates" category, matching the sibling `repo-analysis-template.md`.
  Note: the `test-inception-doc-consistency.sh` `INCEPTION_TEMPLATES` list is hard-coded to
  17 and does **not** (yet) include this template, so indexing is good-practice/consistency,
  not test-enforced; it keeps the redistributable set internally consistent (NFR-7).

**Acceptance Criteria**:

- Must: file exists and declares `ados_distribution: redistributable` (**AC3**, NFR-6).
- Must: the 5-category record, multi-source pointer field, confidence rubric, `contradicted`
  status, and `## Open Contradictions` roll-up are all present (**AC2**, F-2, DM-1…DM-5).
- Must: category→home table maps every category to an existing ADOS home (C-2, F-4).
- Should: indexed in `doc/templates/README.md` (A.3).

**Files and modules**:

- `doc/templates/tribal-knowledge-template.md` (new)
- `doc/templates/README.md` (updated — index entry; A.3, optional)

**Tests**:

- `bash scripts/.tests/test-doc-distribution.sh` — must pass (validates the marker +
  install-set invariants; AC3, NFR-6).
- `grep -F "ados_distribution: redistributable" doc/templates/tribal-knowledge-template.md`.
- Structural read: confirm record fields, roll-up section, and category→home table present.
- `bash scripts/.tests/test-inception-doc-consistency.sh` — must stay green (A.3 README edit
  must not drift the matrix/four-risk/landmark invariants).

**No-op escape**: if `doc/templates/tribal-knowledge-template.md` already exists with the
marker and PDR-0001 fields, skip A.1/A.2 and only verify; still run the gates.

**Completion signal**: `feat(templates): add tribal-knowledge-template (GH-72)`

---

### Phase B: Agent prompt extension — @bootstrapper Phase-0 legacy PRODUCE step (DELEGATE TO @toolsmith)

**Goal**: Insert the PRODUCE step into `@bootstrapper`'s **Phase-0 legacy branch only**,
so legacy onboardings mine repo docs + git history into a graduation-ready
`tribal-knowledge.md`. The `new` branch and the consume/graduate wiring are untouched.

**Delegate**: **`@coder → @toolsmith`** — **HARD RULE** (AGENTS.md "Extending the system"):
all `.opencode/agent/*.md` edits MUST be delegated to `@toolsmith`. `@coder` orchestrates
Phase B but does **not** hand-edit the agent prompt. Source `.opencode/` + regenerated
`.ados-claude/` are committed together (NFR-5).

**Tasks**:

- [ ] **B.1** `@toolsmith` extends `.opencode/agent/bootstrapper.md` `<phase_0>` **legacy
  branch** (currently: "legacy: also perform repo ingestion; write `repo-analysis`;
  consume `tribal-knowledge` if present") with the PRODUCE step:
  - **Extract** tribal knowledge from (i) repo docs — READMEs, decision records, design
    notes, CONTRIBUTING, code comments holding *rationale* — and (ii) git history via
    `git log` — merge commits, Conventional-Commit histories, tagged releases/changelogs.
    Mechanism: file reads + `git log` only (NFR-3).
  - **Categorize** each item (5-category closed set), **attach ≥1 source pointer** (DM-3),
    **score confidence** (rubric), **flag contradictions** (inline `status: contradicted`
    + roll-up), and **write** `doc/inception/analysis/tribal-knowledge.md` from the new
    template.
  - **Inherit** `<trust_boundary>` / `<safety_rules>` (untrusted input, facts only,
    prompt-injection defense, credential refuse list; write confined to `doc/inception/**`).
  - **Preserve** the OQ-2 overwrite rule: preserve a hand-authored file; produce fresh only
    when none exists or the human approves overwrite.
  - **Reference** the template + guide for detail — **duplicate no prose** (NFR-4, RSK-5).
  - **Do NOT** touch the `new` branch (NFR-1) or the consume/graduate wiring (GH-71 scope,
    NG-3).
- [ ] **B.2** Regenerate the Claude Code plugin: `scripts/build-claude-plugin.sh`, then
  stage the `.ados-claude/**` counterpart together with the agent source in one commit.

**Acceptance Criteria**:

- Must: the PRODUCE step is present in the Phase-0 **legacy** branch only (**AC1**, F-1).
- Must: the `new` branch has **no** produce-side effects (**NFR-1**).
- Must: the prompt inherits `<trust_boundary>`/`<safety_rules>` and references the template
  + guide (not duplicated prose) (**AC6**, F-5, NFR-2/NFR-3).
- Must: `bootstrapper.md` stays ≤800 lines (warn >650) — **NFR-4** (278 today; the step is
  a terse reference, not duplicated detail).
- Must: source + regenerated `.ados-claude` committed together (**NFR-5**).

**Files and modules**:

- `.opencode/agent/bootstrapper.md` (updated — Phase-0 legacy PRODUCE step only)
- `.ados-claude/agent/bootstrapper.md` (regenerated counterpart)

**Tests**:

- Structural: PRODUCE step present in the legacy branch; absent from the `new` branch.
- `wc -l .opencode/agent/bootstrapper.md` — ≤800 (NFR-4); warn if >650.
- `bash scripts/build-claude-plugin.sh` then `git status` — the regenerated `.ados-claude`
  counterpart must be the only generated change (byte-fresh; NFR-5).
- `bash scripts/.tests/test-build-claude-plugin.sh` — must pass (plugin-freshness/staleness).
- **Manual** (NFR-8): behavioral AC1/AC6 are agent-capability claims verified by PR review +
  the manual matrix, not CI.

**No-op escape**: if `<phase_0>` legacy branch already carries the PRODUCE step (e.g.,
partial prior attempt) and the `new` branch is clean, only regenerate + recommit the
generated counterpart; otherwise re-delegate the missing piece to `@toolsmith`.

**Completion signal**: `feat(agent): @bootstrapper Phase-0 legacy PRODUCE step — tribal-knowledge extraction (GH-72)`

---

### Phase C: Guide amendments — DEC-5, 3 surgical edits to project-inception.md

**Goal**: Remove the 3 concrete+blocking contradictions between the guide and the shipped
agent + spec (DEC-4/NFR-7), so human authority matches agent authority. The guide is a doc;
the `@toolsmith` hard rule does **not** apply.

**Delegate**: `@coder`.

**Tasks**:

- [ ] **C.1** **(a) Artifact-catalog template column** (~line 152): the "Tribal knowledge"
  row currently shows an em-dash template. After Phase A ships
  `tribal-knowledge-template.md`, reference it (the cell points at the real template).
- [ ] **C.2** **(b) Phase-0→2 graduation label** (~line 663, "Legacy-specific additional
  activities"): "Tribal-knowledge graduation (Phase 0→1)" contradicts the shipped agent
  (`<phase_2>` graduates) + spec (`feature-bootstrapper.md`) + Diagram 3. Correct the
  parenthetical to **Phase 2** (produce @ Phase 0; graduate @ Phase 2). Do not alter the
  surrounding bullet's meaning.
- [ ] **C.3** **(c) Trust/safety note in the legacy section**: add a brief note that scanned
  repo docs **and git history** are untrusted input — facts only, embedded instructions
  never followed, and credential/secret patterns are refused (point at the bootstrapper
  `<trust_boundary>` / `<safety_rules>`). Keeps human authority aligned with agent authority
  on the expanded (git-history) extraction surface.
- [ ] **C.4** Preserve `ados_distribution: redistributable` and **guide structural
  integrity**: do **not** add/remove mermaid blocks (must stay exactly 4), phase sections
  (must stay 8, Phase 0–7), or phase sub-parts (Activities/Anti-sycophancy/Human gate/
  Outputs; must stay ≥32). Do **not** remove the "Tribal knowledge" landmark conditional-matrix
  row (consistency guard Check 3 enforces it in guide + handbook).

**Acceptance Criteria**:

- Must: all 3 edits applied (catalog cell, Phase-2 label, trust/safety note) — **DEC-4**.
- Must: `ados_distribution: redistributable` intact and 0 new contradictions vs the agent +
  spec — **NFR-7**.
- Must: the structural-integrity guard stays green (4 mermaid / 8 phases / ≥32 sub-parts) —
  Phase C must not break `test-inception-doc-consistency.sh` Check 6.

**Files and modules**:

- `doc/guides/project-inception.md` (updated — 3 surgical edits)

**Tests**:

- `bash scripts/.tests/test-inception-doc-consistency.sh` — must stay green (Check 3
  landmark rows incl. "Tribal knowledge"; Check 6 structural integrity).
- `bash scripts/.tests/test-doc-distribution.sh` — marker intact after edits.
- Manual: re-read the edited lines against `<phase_0>`/`<phase_2>` in the agent + the spec
  to confirm 0 contradictions (NFR-7).

**No-op escape**: if an edit is already correct (e.g., someone already fixed the Phase-2
label), skip that single edit and note it in the execution log; still run both gates.

**Completion signal**: `docs(inception): surgical guide amendments — tribal-knowledge template ref + Phase 2 graduation + trust/safety note (GH-72)`

---

### Phase D: Execution log + plan-task reconciliation

**Goal**: Record what was delivered so the plan's checkboxes and execution log reflect the
shipped state. This is a bookkeeping commit on this plan file only.

**Delegate**: `@coder`.

**Tasks**:

- [ ] **D.1** Tick the completed task checkboxes for Phases A–C.
- [ ] **D.2** Append execution-log rows (phase / status / commit / notes) for each delivered
  phase.

**Acceptance Criteria**:

- Must: plan checkboxes and execution log match the actually-committed state of Phases A–C.

**Files and modules**:

- `doc/changes/2026-06/2026-06-27--GH-72--tribal-knowledge-extraction/chg-GH-72-plan.md`
  (updated — this file)

**Tests**:

- None (bookkeeping).

**No-op escape**: if the log is already current, skip.

**Completion signal**: `docs(change): GH-72 execution log`

---

> **Out-of-plan phases (cross-referenced, not authored here — per DEC-3 and the 10-phase
> lifecycle):**
>
> - **System-spec reconciliation** (`doc/spec/features/feature-bootstrapper.md`, scope item
>   D) → `@doc-syncer`, **phase 6** (`/sync-docs GH-72`): add the PRODUCE-path description
>   alongside consume/graduate.
> - **Review** → `@reviewer`, **phase 7** (`/review GH-72`): audit vs spec/plan.
> - **Quality gates** → `@runner`, **phase 8** (`/check`): `test-doc-distribution.sh`,
>   `test-build-claude-plugin.sh`, `test-inception-doc-consistency.sh` (and fixes via
>   `@fixer` if any fail).
> - **PR creation** → `@pr-manager`, **phase 10** (`/pr`): single PR; CI verifies plugin
>   freshness + doc-distribution guard; behavioral claims covered by the manual matrix +
>   PR review.

## Test Scenarios

| ID | Scenario | Phases | AC | Type |
|----|----------|--------|----|------|
| TC-STRUCT-TPL | Template exists + declares `ados_distribution: redistributable` | A | AC3, NFR-6 | CI (`test-doc-distribution.sh`) |
| TC-STRUCT-RECORD | Template encodes 5-category record, multi-source pointer, confidence rubric, `contradicted` status, `## Open Contradictions` roll-up, category→home table | A | AC2, F-2, DM-1…DM-5 | structural read |
| TC-STRUCT-PRODUCE | PRODUCE step present in Phase-0 **legacy** branch; absent from `new` branch | B | AC1, NFR-1 | structural read |
| TC-STRUCT-TRUST | Prompt inherits `<trust_boundary>`/`<safety_rules>`; credential refuse list referenced | B | AC6, F-5 | structural read |
| TC-STRUCT-SIZE | `bootstrapper.md` ≤800 lines (warn >650) | B | NFR-4 | `wc -l` |
| TC-CI-PLUGIN | Plugin byte-fresh — source + regenerated `.ados-claude` committed together | B | NFR-5 | CI (`test-build-claude-plugin.sh`) |
| TC-STRUCT-GUIDE | Guide: catalog cell, Phase-2 label, trust/safety note; 0 contradictions; structural integrity (4 mermaid / 8 phases / ≥32 sub-parts) | C | DEC-4, NFR-7 | CI (`test-inception-doc-consistency.sh`) |
| TC-MANUAL-EXTRACT | On a legacy sample, the agent extracts items, each with category + pointer; contradictions roll up; secrets refused; graduation excluded for contradicted items | A–D | AC1, AC2, AC4, AC6 | manual (NFR-8) |
| TC-MANUAL-GRAD | Non-contradicted, sufficient-confidence items graduate to permanent homes under the Phase-2 gate (existing GH-71 path) | (GH-71) | AC5 | manual (NFR-8) |

> Behavioral AC (AC1, AC2, AC4, AC5, AC6 agent-behavior parts) cannot be unit-tested in CI
> and are honestly marked **manual** (NFR-8, RSK-4). The formal `TC-*` IDs are provisional;
> the GH-72 test plan (`chg-GH-72-test-plan.md`) is the authoritative traceability source.

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | ./chg-GH-72-spec.md | Spec (authority) |
| Test plan | ./chg-GH-72-test-plan.md | Test plan (authoritative TC traceability — to be authored) |
| PM notes | ./chg-GH-72-pm-notes.yaml | Coordination |
| Design decision (inherited invariants) | ../../decisions/PDR-0001-tribal-knowledge-extraction-taxonomy.md | PDR (ALT-1, C-1…C-5) |
| New template (Phase A) | ../../../templates/tribal-knowledge-template.md | Redistributable template |
| Agent prompt (Phase B, via @toolsmith) | .opencode/agent/bootstrapper.md | Agent source |
| Agent prompt — generated (Phase B) | .ados-claude/agent/bootstrapper.md | Generated plugin |
| Inception guide (Phase C, 3 edits) | ../../../guides/project-inception.md | Redistributable guide |
| System spec (OUT of plan — @doc-syncer, phase 6) | ../../../spec/features/feature-bootstrapper.md | Feature spec (reconciled post-delivery) |
| Produce target state entry (no change) | ../../../templates/inception-state-template.yaml (line 54) | State template |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-27 | plan-writer | Initial plan — 4 phased commits (A template, B agent prompt via @toolsmith, C guide amendments, D execution log); PDR-0001 inherited as invariants; system-spec reconciliation cross-referenced to @doc-syncer phase 6. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| A — template | Not started | — | — | — | — |
| B — agent prompt (@toolsmith) | Not started | — | — | — | — |
| C — guide amendments | Not started | — | — | — | — |
| D — execution log | Not started | — | — | — | — |
| (phase 6) system-spec reconciliation (@doc-syncer) | Out of plan | — | — | — | scope item D — `/sync-docs GH-72` |
| (phase 7) review (@reviewer) | Out of plan | — | — | — | `/review GH-72` |
| (phase 8) quality gates (@runner) | Out of plan | — | — | — | `/check` |
| (phase 10) PR (@pr-manager) | Out of plan | — | — | — | `/pr` |
