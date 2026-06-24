---
id: chg-GH-46-test-plan
status: Proposed
created: 2026-06-24
last_updated: 2026-06-24
owners: ["@cwiakalski"]
service: delivery-os
labels: [decision-making, agent-framework, documentation-framework, template, refactor]
version_impact: none
summary: "Generalize ADOS decision-making from an architecture-biased single-ceremony workflow into a universal decision kernel with adaptive playbooks — one domain-neutral orchestrator agent, proportional rigor (R0–R3 + emergency), explicit decision rights, a bounded AI-authority model, independent challenge, and a process-first guide."
links:
  change_spec: ./chg-GH-46-spec.md
  implementation_plan: ./chg-GH-46-plan.md   # pending — not yet authored at test-planning time
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Decision-making refactor: universal kernel, proportional rigor, unified agent, process-first guide

## 1. Scope and Objectives

This change rebuilds the decision-making subsystem end-to-end as a **documentation + agent-prompt-framework change** — there is **no application source code, no HTTP/event contract, and no runtime service**. Therefore this test plan is, by design, overwhelmingly **manual structural inspection, grep-based verification, and prompt-behavior evaluation** against Markdown/YAML artifacts and OpenCode agent/command prompt files. It guards against: (a) an architecture-biased agent identity that hides non-technical decisions; (b) a duplicated (drift-prone) body structure across agent + command + template; (c) silent recommendation/decision boundary erosion; (d) backward-incompatibility for legacy planning summaries and existing records; and (e) stale `@architect` references after the rename.

### 1.1 In Scope

- `.opencode/agent/` — rename `@architect` → `@decision-advisor` (no baked-in structure); new `@decision-critic`; updated `@meeting-organizer`.
- `.opencode/command/` — generalized `/plan-decision` + `/write-decision`; new `/review-decision`.
- `doc/guides/` — new process-first **Decision-Making Guide**; demoted/superseded records-management guide; updated meeting guide.
- `doc/templates/` — rigor-aware additive `decision-record-template.md` + GH-60 defect fixes.
- `doc/decisions/` — ADR-0001 dogfood record.
- `doc/spec/features/` — feature spec updates (agent rename, new capabilities).
- `AGENTS.md`, `README.md`, `.ai/` — reference sweep.
- `.ados-claude/` — regenerated Claude Code plugin kept in sync.

### 1.2 Out of Scope & Known Gaps

- **No new shell/tool tests.** Per the spec (RD-13 / NG-2) the JSON validator/index tools and decision-verifier lifecycle are explicitly deferred. There is **no new `tools/` or `scripts/` artifact** in scope for GH-46, so there are **no `test-*.sh` files to author or run** for this change. This is by design, not a gap — see §4 and §8.
- Historical change artifacts under `doc/changes/**` (e.g., GH-60, GH-32) are **immutable history** and are NOT swept; they may legitimately retain `@architect` and legacy tag references as a record of the past. The GH-46 spec itself must mention `@architect` (it describes the rename) — this is expected, not a defect.
- `.ados-claude/**` is a **generated mirror**; its correctness is verified via the plugin build/sync check (TC-GH46-023), not via the prose reference sweep.
- Deferred per RD-13: `/verify-decision`, `/decision-retro`, schemas/validators, 18 domain catalogs, evidence-ledger YAML, forecasting fields, `@decision-researcher` — none are tested here.

## 2. References

- **Change Specification (authoritative):** `./chg-GH-46-spec.md` — defines F-1…F-13, AC-GH46-1…14, NFR-1…6, DM-1…DM-5, RSK-1…7, DEC-1…16.
- **PM notes / decisions:** `./chg-GH-46-pm-notes.yaml` — RD-1…RD-16, OQ-A/OQ-C.
- **Ticket:** `GH-46` (github.com/juliusz-cwiakalski/agentic-delivery-os/issues/46).
- **Implementation plan:** `./chg-GH-46-plan.md` — *pending* (not yet authored at test-planning time; scenarios will be reconciled against it once it exists).
- **Testing strategy:** `.ai/rules/testing-strategy.md` — doc/template changes use static/diff + content checks; no automated tests exist → manual verification + `git diff --check`.
- **Predecessor:** GH-60 / PR #61 (constraints vs drivers, section order) — GH-46 fixes its carryover defects.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (short) | TC ID(s) | Status |
|-------|---------------------|----------|--------|
| AC-GH46-1 | `@decision-advisor` exists (renamed), domain-neutral, owns all 5 types, no baked-in structure | TC-GH46-001, TC-GH46-002, TC-GH46-003 | Covered |
| AC-GH46-2 | `@decision-critic` exists, read-only, independent, returns PASS/PASS_WITH_RISKS/REWORK | TC-GH46-004 | Covered |
| AC-GH46-3 | `/plan-decision` triage/classify/rigor/rights; generic summary tag + legacy alias | TC-GH46-005, TC-GH46-006, TC-GH46-007 | Covered |
| AC-GH46-4 | `/write-decision` proportional render, records `ai_assistance`, recommendation≠decision, no auto-Accept R2/R3 | TC-GH46-008, TC-GH46-009, TC-GH46-010 | Covered |
| AC-GH46-5 | `/review-decision <ID>` runs critic, read-only, verdict artifact | TC-GH46-011 | Covered |
| AC-GH46-6 | Decision-Making Guide contains all 10 required bodies of content | TC-GH46-012 | Covered |
| AC-GH46-7 | Template optional front matter + proportional rendering + GH-60 wording fixes | TC-GH46-015, TC-GH46-016, TC-GH46-017, TC-GH46-018 | Covered |
| AC-GH46-8 | R0 → no record; R1 strict subset of R3; R1 ≤ 1 business day | TC-GH46-013 | Covered |
| AC-GH46-9 | Bounded AI authority: delegated R0–R1 only, R2/R3 human final, recommendation≠decision | TC-GH46-014, TC-GH46-010 | Covered |
| AC-GH46-10 | Meeting integration: evidence input, durable→write-decision, `@decision-advisor`, 3 modes | TC-GH46-020, TC-GH46-021 | Covered |
| AC-GH46-11 | Repo-wide `@architect` sweep (0 stale); inbound links updated; plugin regenerated & in sync | TC-GH46-022, TC-GH46-023, TC-GH46-024 | Covered |
| AC-GH46-12 | Template = single source of truth; write-decision structure matches with 0 mismatches | TC-GH46-019 | Covered |
| AC-GH46-13 | ADR-0001 exists, records RD-1…RD-16, via new process | TC-GH46-025 | Covered |
| AC-GH46-14 | Legacy record stays valid; no proprietary runtime; no stored chain-of-thought | TC-GH46-026, TC-GH46-027, TC-GH46-028 | Covered |

All 14 acceptance criteria are covered (0 TODO).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP (8.1 N/A) and no events/messages (8.2 N/A). Data-model impact is additive optional front matter only:

| DM ID | Element | TC ID(s) | Status |
|-------|---------|----------|--------|
| DM-1 | Optional `classification` front-matter block | TC-GH46-015 | Covered |
| DM-2 | Optional `governance` (DACI) front-matter block | TC-GH46-015 | Covered |
| DM-3 | Optional `ai_assistance` provenance block | TC-GH46-009, TC-GH46-015 | Covered |
| DM-4 | Optional `review_date` / revisit triggers | TC-GH46-015 | Covered |
| DM-5 | Generic `<decision_planning_summary>` tag + legacy alias | TC-GH46-006, TC-GH46-007 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Proportionality (R0→0 records; R1 strict subset of R3; R1 ≤ 1 day; R2/R3 retain full evidence + ≥2 alternatives + baseline + review date) | TC-GH46-008, TC-GH46-013 | Covered |
| NFR-2 | Backward compatibility (legacy records valid; legacy tag + `adr.*` accepted via alias, 0 behavior change) | TC-GH46-007, TC-GH46-026 | Covered |
| NFR-3 | No architecture-bias leakage (generic path emits generic tag; 0 `adr.*` required fields in generic path) | TC-GH46-002, TC-GH46-006 | Covered |
| NFR-4 | Cross-source section-order consistency (1 source of truth; 0 mismatches) | TC-GH46-003, TC-GH46-016, TC-GH46-017, TC-GH46-018, TC-GH46-019 | Covered |
| NFR-5 | Git-native, no proprietary runtime (Markdown + YAML; 0 new services) | TC-GH46-022, TC-GH46-023, TC-GH46-027 | Covered |
| NFR-6 | No hidden chain-of-thought (decision + rationale + assumptions only) | TC-GH46-010, TC-GH46-014, TC-GH46-028 | Covered |

## 4. Test Types and Layers

This is a docs/templates/agent-prompt change. Per `.ai/rules/testing-strategy.md` the applicable layers are **static/diff checks** and **content checks**; there are **no unit/integration/E2E suites** to run.

- **Static/diff checks (always):** `git diff --check` (whitespace/conflict markers); changed-file naming/path conventions; YAML front-matter syntax validation. → TC-GH46-029.
- **Manual structural inspection:** read a target Markdown/YAML/agent-prompt file and verify presence/absence of required sections, clauses, front-matter keys, and prompt behavior statements. (Majority of TCs.)
- **Grep verification:** run deterministic `rg`/`grep` commands and assert match counts (0 or ≥1). Concrete commands are embedded in each scenario. (Cross-cutting — many TCs.)
- **Prompt-behavior evaluation:** run the agent/command against a sample decision scenario and human-judge the output (proportionality, recommendation/decision separation, no auto-Accept, verdict). Manual, human-judged. (TC-GH46-008, 009, 010.)
- **Automated shell/tool tests:** **N/A — intentionally none.** There is no new `tools/`/`scripts/` artifact (validator deferred per RD-13/NG-2). Per the strategy fallback rule, automated tests are marked N/A and manual verification + `git diff --check` are required instead.

All run commands use `rg` (ripgrep; `grep -rn` is an acceptable substitute). Work from the repository root unless noted.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-GH46-001 | `@decision-advisor` exists and replaces `@architect` | Structural | Critical | High | AC-1 |
| TC-GH46-002 | Advisor identity is domain-neutral and owns all 5 types | Structural + grep | Critical | High | AC-1, NFR-3 |
| TC-GH46-003 | Advisor prompt has NO baked-in body structure; references template | Structural + grep | Critical | High | AC-1, NFR-4 |
| TC-GH46-004 | `@decision-critic` exists, read-only, independent, verdict tri-state | Structural | Critical | High | AC-2 |
| TC-GH46-005 | `/plan-decision` runs triage → classify → rigor → rights | Structural | Important | High | AC-3 |
| TC-GH46-006 | `/plan-decision` emits generic `<decision_planning_summary>` | Structural + grep | Critical | High | AC-3, NFR-3 |
| TC-GH46-007 | `/plan-decision` + `/write-decision` accept legacy tag + `adr.*` via alias | Structural + grep | Important | High | AC-3, NFR-2 |
| TC-GH46-008 | `/write-decision` renders proportionally R1/R2/R3 | Prompt-behavior + structural | Critical | High | AC-4, NFR-1 |
| TC-GH46-009 | `/write-decision` records `ai_assistance` provenance | Prompt-behavior + grep | Important | High | AC-4, DM-3 |
| TC-GH46-010 | `/write-decision` keeps recommendation≠decision; no auto-Accept R2/R3 | Prompt-behavior + structural | Critical | High | AC-4, AC-9, NFR-6 |
| TC-GH46-011 | `/review-decision <ID>` exists, read-only, verdict artifact | Structural | Critical | High | AC-5 |
| TC-GH46-012 | Decision-Making Guide contains all 10 required bodies of content | Structural | Critical | High | AC-6 |
| TC-GH46-013 | R0 → no record; R1 strict subset of R3; R1 ≤ 1 business day | Structural | Critical | High | AC-8, NFR-1 |
| TC-GH46-014 | Bounded AI-authority model defined | Structural | Critical | High | AC-9, NFR-6 |
| TC-GH46-015 | Template optional classification/governance/AI/review front matter | Structural + grep | Important | High | AC-7, DM-1..4 |
| TC-GH46-016 | GH-60 fix: "non-negotiable" neutralized | Grep | Important | Medium | AC-7, NFR-4 |
| TC-GH46-017 | GH-60 fix: "constraints" removed from Context description | Structural + grep | Important | Medium | AC-7, NFR-4 |
| TC-GH46-018 | GH-60 fix: per-alternative heading standardized across sources | Grep | Minor | Medium | AC-7, NFR-4 |
| TC-GH46-019 | Template is single source of truth; write-decision structure matches (0 mismatches) | Structural + grep | Critical | High | AC-12, NFR-4 |
| TC-GH46-020 | Meeting files reference `@decision-advisor` (0 `@architect`) | Grep | Important | High | AC-10 |
| TC-GH46-021 | Meeting integration: evidence input, durable→write-decision, 3 modes | Structural | Important | High | AC-10 |
| TC-GH46-022 | Repo-wide `@architect` sweep: 0 stale live references | Grep | Critical | High | AC-11, NFR-5 |
| TC-GH46-023 | Claude plugin regenerated and in sync (idempotent build) | Manual (build + diff) | Critical | High | AC-11, NFR-5 |
| TC-GH46-024 | Inbound links to renamed/superseded guide updated | Grep + structural | Important | Medium | AC-11 |
| TC-GH46-025 | ADR-0001 exists, records RD-1…RD-16, new-process front matter | Structural | Important | High | AC-13 |
| TC-GH46-026 | Backward compatibility: sample legacy record remains valid | Structural (manual) | Important | High | AC-14, NFR-2 |
| TC-GH46-027 | No proprietary runtime introduced (Markdown + YAML only) | Structural + grep | Important | Medium | AC-14, NFR-5 |
| TC-GH46-028 | No stored raw chain-of-thought in records | Structural + grep | Important | Medium | AC-14, NFR-6 |
| TC-GH46-029 | Static/diff hygiene: `git diff --check` + YAML front-matter parse | Static/diff | Important | High | (cross-cutting) |

### 5.2 Scenario Details

#### TC-GH46-001 - `@decision-advisor` exists and replaces `@architect`

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-GH46-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/`
**Tags**: @backend, @agent-framework

**Preconditions**:

- Change delivered on branch `refactor/GH-46/decision-making-framework`.

**Steps**:

1. `ls .opencode/agent/decision-advisor.md` → file exists.
2. `ls .opencode/agent/architect.md` → file removed (no separate `@architect` retained).
3. Read front matter `description:` of `decision-advisor.md`.

**Expected Outcome**:

- `decision-advisor.md` exists; `architect.md` does not.
- The description is domain-neutral (advises/facilitates decisions of all types), NOT framed as "system architecture"-only.

---

#### TC-GH46-002 - Advisor identity is domain-neutral and owns all 5 types

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-GH46-1, NFR-3
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/decision-advisor.md`
**Tags**: @backend, @agent-framework

**Preconditions**:

- `decision-advisor.md` exists (TC-GH46-001 pass).

**Steps**:

1. `rg -n "ADR|PDR|TDR|BDR|ODR" .opencode/agent/decision-advisor.md` → all five type tokens present.
2. Confirm the prompt states it owns all five types.
3. Confirm type-aware context modes exist (ADR/TDR → specs/contracts/source; PDR → roadmap/UX; BDR → strategy/ICP/pricing; ODR → runbooks/infra).
4. Confirm the default-to-ADR behavior triggers only when type is genuinely unspecified.

**Expected Outcome**:

- All five decision types explicitly owned; domain-neutral identity; no architecture-only exclusivity; ADR default only for unspecified type (NFR-3).

---

#### TC-GH46-003 - Advisor prompt has NO baked-in body structure; references template

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-GH46-1, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/decision-advisor.md`
**Tags**: @backend, @agent-framework

**Preconditions**:

- `decision-advisor.md` exists.

**Steps**:

1. `rg -n "## Trade-offs & Consequences" .opencode/agent/decision-advisor.md` → expect **0** (record-body heading must not be baked into the agent prompt).
2. `rg -n "## Confidence Rating|## Lessons Learned|## Mental Models & Techniques Used" .opencode/agent/decision-advisor.md` → expect **0** as a fenced/body-structure enumeration (incidental prose mention is acceptable only if not part of a section-order block).
3. `rg -n "doc/templates/decision-record-template" .opencode/agent/decision-advisor.md` → expect **≥1** (it delegates structure to the template).

**Expected Outcome**:

- The agent prompt contains no fenced block enumerating the decision-record body section order (0 baked-in structure); it explicitly references the template as the single source of body structure.

---

#### TC-GH46-004 - `@decision-critic` exists, read-only, independent, verdict tri-state

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-GH46-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/agent/decision-critic.md`
**Tags**: @backend, @agent-framework

**Preconditions**:

- Change delivered.

**Steps**:

1. `ls .opencode/agent/decision-critic.md` → exists.
2. Read the prompt and verify: (a) explicitly read-only (no writes to records); (b) states independence from `@decision-advisor` (and that same-model/same-prompt-lineage agents are not independent evidence); (c) returns verdict ∈ {`PASS`, `PASS_WITH_RISKS`, `REWORK`}.

**Expected Outcome**:

- `@decision-critic` present, read-only, independence stated, tri-state verdict contract documented.

---

#### TC-GH46-005 - `/plan-decision` runs triage → classify → rigor → rights

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-10, AC-GH46-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/command/plan-decision.md`
**Tags**: @backend, @agent-framework

**Preconditions**:

- Generalized `/plan-decision` delivered.

**Steps**:

1. Read `plan-decision.md` and confirm the session flow contains, in order: **triage** (record-worthiness + R0 escape), **four-axis classification** (type × domain tags × archetype × conditions), **rigor selection** (R0–R3 + emergency overlay), and **decision-rights assignment** (DACI roles).
2. Confirm it still keeps the GH-60 hard-requirements (constraints) elicitation step distinct from drivers.

**Expected Outcome**:

- All four planning stages present; constraint/driver discipline retained.

---

#### TC-GH46-006 - `/plan-decision` emits generic `<decision_planning_summary>`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-5, AC-GH46-3, NFR-3
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/command/plan-decision.md`
**Tags**: @backend, @agent-framework

**Preconditions**:

- Generalized `/plan-decision` delivered.

**Steps**:

1. `rg -n "<decision_planning_summary>" .opencode/command/plan-decision.md` → expect **≥1** (canonical generic tag).
2. Confirm the canonical summary block uses generic field names (e.g., `decision_type`, `title`, generic scope/owner fields), NOT `adr.number` / `adr.slug_hint` / `adr.title`.
3. `rg -n "adr\." .opencode/command/plan-decision.md` → any `adr.*` references must be confined to a clearly-marked **back-compat/alias** section, NOT the canonical generic path.

**Expected Outcome**:

- Generic tag is canonical; 0 `adr.*` required fields in the generic (non-legacy) path → satisfies NFR-3 (no architecture-bias leakage).

---

#### TC-GH46-007 - `/plan-decision` + `/write-decision` accept legacy tag + `adr.*` via alias

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-10, DM-5, AC-GH46-3, NFR-2
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/command/plan-decision.md`, `.opencode/command/write-decision.md`
**Tags**: @backend, @agent-framework

**Preconditions**:

- Generalized commands delivered.

**Steps**:

1. In both command files, confirm an explicit **back-compat alias** mapping the legacy `<technical_decision_planning_summary>` tag and `adr.*` fields to the generic summary fields, with **0 behavior change** for legacy flows.
2. `rg -n "technical_decision_planning_summary" .opencode/command/plan-decision.md .opencode/command/write-decision.md` → present only in the alias/back-compat handling.
3. Prompt-behavior spot check: feed a legacy `<technical_decision_planning_summary>` block to `/write-decision` and confirm it still renders a valid record.

**Expected Outcome**:

- Legacy tag + `adr.*` accepted via documented alias; legacy flow produces a valid record unchanged (NFR-2).

---

#### TC-GH46-008 - `/write-decision` renders proportionally R1/R2/R3

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-GH46-4, NFR-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/command/write-decision.md`
**Tags**: @backend, @agent-framework

**Preconditions**:

- Generalized `/write-decision` delivered.

**Steps**:

1. Read `write-decision.md`; confirm proportional-rendering guidance distinguishes **R1** (compact subset: problem, constraints, top drivers, baseline + ≥1 option, choice + rationale, owner, revisit trigger), **R2** (standard canonical record), **R3** (full + independent challenge + review date).
2. Prompt-behavior: run `/plan-decision` to an **R1** triage, then `/write-decision` → record R1 output A.
3. Prompt-behavior: run `/plan-decision` to an **R3** triage, then `/write-decision` → record R3 output B.
4. Compare A vs B.

**Expected Outcome**:

- R1 output is a strict proper subset of R3 output; both valid; rendering honors rigor (NFR-1).

---

#### TC-GH46-009 - `/write-decision` records `ai_assistance` provenance

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-10, DM-3, AC-GH46-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/command/write-decision.md`, generated record
**Tags**: @backend, @agent-framework

**Preconditions**:

- Generalized `/write-decision` delivered.

**Steps**:

1. `rg -n "ai_assistance" .opencode/command/write-decision.md` → expect **≥1**.
2. Confirm the prompt records provenance fields: AI used, roles, `external_data_shared`, `citations_verified`, `human_decider`, `reviewers`.
3. Prompt-behavior: generate a sample record; confirm the emitted record contains an `ai_assistance:` block.

**Expected Outcome**:

- `ai_assistance` provenance block recorded in every AI-assisted record (DM-3).

---

#### TC-GH46-010 - `/write-decision` keeps recommendation≠decision; no auto-Accept R2/R3

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-5, AC-GH46-4, AC-GH46-9, RSK-7, NFR-6
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/command/write-decision.md`
**Tags**: @backend, @agent-framework

**Preconditions**:

- Generalized `/write-decision` delivered.

**Steps**:

1. Read `write-decision.md`; confirm the recommendation is rendered separately from the authorized decision.
2. Confirm the prompt **does not mark `Accepted`** without an authorized human decision — explicitly for R2/R3 — and requires `ai_assistance.human_decider`.
3. Prompt-behavior (negative): run `/write-decision` for an **R3** decision with NO human decision provided → assert the emitted record stays at `status: Proposed` (decision_date null), even though a recommendation is present.

**Expected Outcome**:

- Recommendation and decision are distinct; no R2/R3 auto-Accept; record remains Proposed absent a human decision (RSK-7 mitigation).

---

#### TC-GH46-011 - `/review-decision <ID>` exists, read-only, verdict artifact

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-GH46-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/command/review-decision.md`
**Tags**: @backend, @agent-framework

**Preconditions**:

- New command delivered.

**Steps**:

1. `ls .opencode/command/review-decision.md` → exists.
2. Read it; confirm: delegates the review to `@decision-critic`; **read-only by default** (modifies nothing); produces an independent review artifact/verdict (PASS / PASS_WITH_RISKS / REWORK).

**Expected Outcome**:

- Command present, read-only, emits a verdict artifact, does not mutate the record.

---

#### TC-GH46-012 - Decision-Making Guide contains all 10 required bodies of content

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-3, F-4, F-5, F-8, AC-GH46-6
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/guides/decision-making.md`
**Tags**: @backend, @docs

**Preconditions**:

- New process-first guide delivered.

**Steps**:

1. `ls doc/guides/decision-making.md` → exists.
2. Read it and verify all ten bodies of content are present:
   1. When to decide (record-worthiness; R0 escape hatch).
   2. Universal decision kernel **D0–D14**.
   3. Rigor profiles **R0–R3 + emergency overlay**.
   4. **Four-axis classification → routing** (type × domain × archetype × conditions).
   5. **Decision rights** (DACI-style roles).
   6. **AI-authority model** (allowed roles; autonomous-action bounds; recommendation≠decision; provenance).
   7. **Per-type nuance matrix** (context anchors / typical approver / fitting framework per type) — condensed, not 18 files.
   8. **Constraints vs drivers discipline** (GH-60 fixes carried in).
   9. The **record artifact** (naming/front matter/lifecycle — demoted reference).
   10. **Agent & command integration** (`@decision-advisor`, `@decision-critic`, `/plan-decision`, `/write-decision`, `/review-decision`).

**Expected Outcome**:

- All ten sections present and substantive.

---

#### TC-GH46-013 - R0 → no record; R1 strict subset of R3; R1 ≤ 1 business day

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-GH46-8, NFR-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/guides/decision-making.md`
**Tags**: @backend, @docs

**Preconditions**:

- Guide delivered (TC-GH46-012).

**Steps**:

1. Read the R0 definition → confirm it produces **no record** (optional note/commit/ticket comment only) and AI may act within delegated bounds.
2. Read the R1 definition → confirm required output is a **strict proper subset** of R3 and target cycle **≤ 1 business day**.
3. Read the R2/R3 definitions → confirm they retain full evidence + ≥2 alternatives + baseline + review date.

**Expected Outcome**:

- R0 → 0 mandatory records; R1 ⊂ R3; R1 cycle ≤ 1 business day; R2/R3 retain full rigor (NFR-1).

---

#### TC-GH46-014 - Bounded AI-authority model defined

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-GH46-9, NFR-6
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/guides/decision-making.md`, `.opencode/agent/decision-advisor.md`, `.opencode/command/write-decision.md`
**Tags**: @backend, @docs, @agent-framework

**Preconditions**:

- Guide + advisor + write-decision delivered.

**Steps**:

1. In the guide, confirm the AI-authority section defines: allowed AI roles; that AI may autonomously decide **only** when authority delegated + R0/R1 + machine-checkable bounds + easy reversal + limited blast radius + audit trail + escalation path; that R2/R3 require a **human final decision**; and that recommendation ≠ decision.
2. Confirm the forbidden list (R3, legal/regulatory, material financial, employment/individuals, safety-critical, privacy rights, irreversible architecture/strategy, active security-risk acceptance, ethical trade-offs).
3. Confirm the advisor prompt + write-decision enforce recommendation/decision separation and request human approval for R2/R3.

**Expected Outcome**:

- Bounded autonomy model consistent across guide + advisor + write-decision.

---

#### TC-GH46-015 - Template optional classification/governance/AI/review front matter

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, DM-1, DM-2, DM-3, DM-4, AC-GH46-7
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md`
**Tags**: @backend, @docs

**Preconditions**:

- Additive template update delivered.

**Steps**:

1. `rg -n "classification|governance|ai_assistance|review_date" doc/templates/decision-record-template.md` → each present.
2. Confirm the added front-matter blocks are **optional** and additive (existing extended-metadata fields remain valid).
3. Confirm proportional-rendering guidance is present (R1 compact subset / R2 standard / R3 full).

**Expected Outcome**:

- Optional `classification`, `governance`, `ai_assistance`, `review_date`/revisit triggers present; additive only; proportional-rendering guidance present.

---

#### TC-GH46-016 - GH-60 fix: "non-negotiable" neutralized to `negotiable: no`

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-9, AC-GH46-7, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md`, `doc/guides/decision-records-management.md`, `doc/guides/decision-making.md`, `.opencode/command/write-decision.md`, `.opencode/command/plan-decision.md`
**Tags**: @backend, @docs

**Preconditions**:

- GH-60 defect fixes delivered.

**Steps**:

1. `rg -n "non-negotiable" doc/templates/decision-record-template.md doc/guides/decision-records-management.md doc/guides/decision-making.md .opencode/command/write-decision.md .opencode/command/plan-decision.md` → expect **0** matches in the decision-record subsystem wording.
2. Confirm the only data field used is `negotiable: yes|no` (consistent across sources).

**Expected Outcome**:

- The English phrase "non-negotiable" no longer coexists with the `negotiable: yes/no` field in the decision-record subsystem files; wording uses `negotiable: no` consistently.

**Notes / Clarifications**:

- Out of scope for this grep: `README.md`, `doc/templates/business-*`, and `doc/changes/**` historical artifacts, which use "non-negotiable" generically and are not part of this defect.

---

#### TC-GH46-017 - GH-60 fix: "constraints" removed from Context description

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-9, AC-GH46-7, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md`, `doc/guides/decision-records-management.md`, `.opencode/command/write-decision.md`, `.opencode/command/plan-decision.md`
**Tags**: @backend, @docs

**Preconditions**:

- GH-60 defect fixes delivered.

**Steps**:

1. Inspect the **Context** section description/comment in `decision-record-template.md` (and the Context row in the records guide's Required Sections table), plus the Context authoring rule in `.opencode/command/write-decision.md`.
2. Confirm it describes the situation/triggers only and does **not** conflate Context with the *Constraints (Hard Requirements)* section.
3. `rg -ni "relevant constraints" doc/templates/decision-record-template.md .opencode/command/write-decision.md .opencode/command/plan-decision.md` → expect **0** (the offending conflation removed/reworded; the commands are included so the fix is asserted across every source that can carry the wording).

**Expected Outcome**:

- The Context description no longer mentions "constraints" as if it belonged there; Context is distinct from the Constraints section.

---

#### TC-GH46-018 - GH-60 fix: per-alternative heading standardized across sources

**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: F-9, AC-GH46-7, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: template + commands + guides
**Tags**: @backend, @docs

**Preconditions**:

- GH-60 defect fixes delivered.

**Steps**:

1. `rg -n "Per-Alterative" doc/templates/ doc/guides/ .opencode/command/` → expect **0** (typo eliminated).
2. `rg -n "Per-Alternative|Alternative [0-9]|Per-alternative" doc/templates/decision-record-template.md .opencode/command/plan-decision.md .opencode/command/write-decision.md doc/guides/decision-making.md doc/guides/decision-records-management.md` → confirm the per-alternative heading wording is **consistent** across all sources (one canonical spelling/wording).

**Expected Outcome**:

- "Per-Alterative" typo gone; per-alternative heading wording standardized across the template, both commands, and both guides.

---

#### TC-GH46-019 - Template is single source of truth; write-decision structure matches (0 mismatches)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-9, AC-GH46-12, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md`, `.opencode/command/write-decision.md`, `.opencode/agent/decision-advisor.md`
**Tags**: @backend, @docs, @agent-framework

**Preconditions**:

- Baked-in structure removed (TC-GH46-003); write-decision delivered.

**Steps**:

1. Extract the body section heading order from `doc/templates/decision-record-template.md`.
2. Extract **ALL** structural enumerations from `.opencode/command/write-decision.md` (e.g., `<decision_structure>` AND any `<embedded_template>` / body block). After the RT-02 consolidation there must be **exactly ONE**; assert the count is 1 (guards against re-proliferation of a second full-body duplicate).
3. Diff the two heading lists → expect **0 mismatches** in section order.
4. Confirm the advisor has **0** baked-in structure (re-check TC-GH46-003), so the only structural duplication is template ↔ write-decision, `write-decision.md` carries exactly ONE structural definition, and it matches the template exactly.

**Expected Outcome**:

- Exactly 1 source of truth for body section order (the template); `write-decision.md` carries exactly ONE structural definition (no embedded full-body duplicate) and matches the template with 0 mismatches; agent prompt carries none (NFR-4 / GH-60 NFR-1 preserved).

**Notes / Clarifications**:

- If write-decision still enumerates sections for rendering, they MUST equal the template's order verbatim; drift here is a blocker.

---

#### TC-GH46-020 - Meeting files reference `@decision-advisor` (0 `@architect`)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-11, AC-GH46-10
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/meeting-organizer.md`, `doc/guides/meeting-preparation-and-summarization.md`
**Tags**: @backend, @agent-framework, @docs

**Preconditions**:

- Meeting integration delivered.

**Steps**:

1. `rg -n "@architect" .opencode/agent/meeting-organizer.md doc/guides/meeting-preparation-and-summarization.md` → expect **0**.
2. `rg -n "@decision-advisor" .opencode/agent/meeting-organizer.md doc/guides/meeting-preparation-and-summarization.md` → expect **≥1**.

**Expected Outcome**:

- No stale `@architect` in meeting files; `@decision-advisor` referenced instead.

---

#### TC-GH46-021 - Meeting integration: evidence input, durable→write-decision, 3 modes

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-11, AC-GH46-10
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/guides/meeting-preparation-and-summarization.md`, `.opencode/agent/meeting-organizer.md`
**Tags**: @backend, @agent-framework, @docs

**Preconditions**:

- Meeting integration delivered.

**Steps**:

1. Read the meeting guide + `@meeting-organizer`; confirm:
   - Meeting discussion is treated as **legitimate evidence input** to `/plan-decision`.
   - **Durable** meeting decisions are routed to `/write-decision`.
   - **Three decision modes** are documented: (a) interactive AI session, (b) meeting-driven, (c) delegated AI autonomous within R0–R1 bounds.

**Expected Outcome**:

- All three integration points present; three decision modes documented.

---

#### TC-GH46-022 - Repo-wide `@architect` sweep: 0 stale live references

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-GH46-11, NFR-5
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: repo-wide live docs
**Tags**: @backend, @docs

**Preconditions**:

- Reference sweep delivered.

**Steps**:

1. Run against live (forward-facing) sources only, excluding generated mirrors and immutable history:
   ```
   rg -n "@architect" .opencode/ doc/guides/ doc/spec/ doc/templates/ doc/overview/ AGENTS.md README.md .ai/ --glob '!.ados-claude/**'
   ```
2. Expect **0** matches.

**Expected Outcome**:

- Every live `@architect` reference updated to `@decision-advisor`.

**Notes / Clarifications**:

- `doc/changes/**` (historical change artifacts, including this spec) and `.ados-claude/**` (generated mirror — verified separately in TC-GH46-023) are excluded by design; retaining `@architect` there is correct, not a defect.

---

#### TC-GH46-023 - Claude plugin regenerated and in sync (idempotent build)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-GH46-11, NFR-5
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ados-claude/`, `scripts/build-claude-plugin.sh`
**Tags**: @backend, @build

**Preconditions**:

- `.opencode/` edits committed; build script present.

**Steps**:

1. `bash scripts/build-claude-plugin.sh` (regenerate).
2. `git status --porcelain .ados-claude/` → expect **empty** (the committed output was already current → build is idempotent).
3. `ls .ados-claude/agent/architect.md` → absent; `ls .ados-claude/agent/decision-advisor.md` + `.ados-claude/agent/decision-critic.md` → present.
4. `ls .ados-claude/skills/review-decision/SKILL.md` → present (commands are transformed into skill *directories* by `transform_command_to_skill`, NOT `commands/*.md`).
5. `rg -l "@decision-advisor" .ados-claude/` → ≥1; `rg -l "@architect" .ados-claude/` → 0 (mirror reflects the sweep).

**Expected Outcome**:

- Generated plugin reflects all source renames/additions; rebuild produces no diff; 0 `@architect` in the mirror.

---

#### TC-GH46-024 - Inbound links to renamed/superseded guide updated

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-12, AC-GH46-11
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: repo-wide
**Tags**: @backend, @docs

**Preconditions**:

- New process-first guide delivered; records guide demoted.

**Steps**:

1. Identify the canonical link target(s) for decision-making guidance (new `doc/guides/decision-making.md`; records guide kept as artifact reference if not removed).
2. `rg -n "decision-records-management" .opencode/ doc/guides/ doc/spec/ doc/templates/ AGENTS.md README.md .ai/` → any inbound link resolves to a file that still exists (no 404).
3. Where the new guide is the intended entry point, confirm those references point to `decision-making.md`.

**Expected Outcome**:

- No broken inbound links; readers land on the authoritative process-first guide.

---

#### TC-GH46-025 - ADR-0001 exists, records RD-1…RD-16, new-process front matter

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-13, AC-GH46-13
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/decisions/`
**Tags**: @backend, @docs

**Preconditions**:

- Dogfood record delivered.

**Steps**:

1. `ls doc/decisions/ADR-0001-*.md` → exists.
2. Read front matter → `decision_type: adr`, `status` set, `decision_date` set when Accepted, `created`/`last_updated` present.
3. Read the body → confirm it captures GH-46's decisions **RD-1 … RD-16** (the orchestrator name, the rename, the template-as-source-of-truth, the process-first guide, consolidation, dogfood, kernel+R0–R3, DACI rights, bounded AI authority, agent name, critic+review-decision, meeting integration, defer list, condensed matrix).
4. Confirm the body follows the new template section order (no `<...>` placeholders).

**Expected Outcome**:

- ADR-0001 present, recording RD-1…RD-16 via the new process with compliant front matter and structure.

---

#### TC-GH46-026 - Backward compatibility: sample legacy record remains valid

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: DM-1, DM-2, DM-3, AC-GH46-14, NFR-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/templates/decision-record-template.md`, sample record
**Tags**: @backend, @docs

**Preconditions**:

- Additive template delivered.

**Steps**:

1. Author (or locate) a sample decision record using the **current/pre-change** template — no `classification`, `governance`, or `ai_assistance` blocks.
2. Validate it against the updated template + records guide rules.
3. Confirm all newly added front-matter fields are optional and additive; nothing previously required was removed or renamed.

**Expected Outcome**:

- The legacy record is fully valid under the updated template; 100% backward compatible (NFR-2).

---

#### TC-GH46-027 - No proprietary runtime introduced (Markdown + YAML only)

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: DM-1..5, AC-GH46-14, NFR-5
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: repo-wide
**Tags**: @backend, @docs

**Preconditions**:

- Change delivered.

**Steps**:

1. Confirm all new/changed artifacts are Markdown (`.md`) + YAML front matter.
2. Confirm no new runtime services, binaries, packages, or proprietary-binary artifacts were introduced.
3. `git diff --name-only <base>..HEAD | rg -v '\.(md|yaml|yml)$'` → only expected non-doc files (e.g., none, or only the build script if touched).

**Expected Outcome**:

- Pure Markdown/YAML; 0 new runtime services or proprietary binaries (NFR-5).

---

#### TC-GH46-028 - No stored raw chain-of-thought in records

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: DM-3, AC-GH46-14, NFR-6
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/decisions/**`, `doc/templates/decision-record-template.md`
**Tags**: @backend, @docs

**Preconditions**:

- ADR-0001 + template delivered.

**Steps**:

1. Confirm records capture decision + rationale + assumptions only.
2. `rg -ni "chain.of.thought|raw model|<think>|assistant>|tool_call" doc/decisions/ doc/templates/decision-record-template.md` → expect **0** (no leaked model internals).
3. Confirm the `ai_assistance` block records *roles/provenance*, not verbatim model logs.

**Expected Outcome**:

- 0 stored raw chain-of-thought/logs in committed records (NFR-6).

---

#### TC-GH46-029 - Static/diff hygiene: `git diff --check` + YAML front-matter parse

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: (testing-strategy cross-cutting; supports all ACs)
**Test Type(s)**: Manual
**Automation Level**: Automated
**Target Layer / Location**: repo-wide changed files
**Tags**: @backend, @build

**Preconditions**:

- Change delivered on the feature branch.

**Steps**:

1. `git diff --check <base>..HEAD` → no whitespace errors / conflict markers.
2. Validate YAML front matter of every changed `.md` (template, guide, ADR-0001) parses (e.g., extract the front-matter block and run it through a YAML parser / `yamllint`).
3. Markdown rendering spot-check: headings/lists/tables/code fences well-formed on `decision-making.md`, updated `decision-record-template.md`, and ADR-0001.

**Expected Outcome**:

- `git diff --check` clean; all front matter parses; Markdown well-formed. Required before completion per testing-strategy quality gates.

---

## 6. Environments and Test Data

- **Environment:** local-dev only (single git repository). No staging/production — no runtime exists.
- **Tooling:** `rg` (ripgrep) or `grep -rn`; `git`; `bash scripts/build-claude-plugin.sh`; an optional YAML linter (`yamllint`).
- **Test data:**
  - A **sample legacy record** (old template, no new front matter) — authored ad hoc for TC-GH46-026 (discard after).
  - **Sample planning summaries** — one generic `<decision_planning_summary>` (R1 and R3) and one legacy `<technical_decision_planning_summary>` — for prompt-behavior TCs (008, 009, 010). Discard after.
- **Isolation:** all inspection is read-only on the working tree; prompt-behavior sample artifacts are created in a scratch location and discarded (never committed to `doc/decisions/` except the dogfood ADR-0001).

## 7. Automation Plan and Implementation Mapping

| TC ID | Implementation status | Notes |
|-------|-----------------------|-------|
| TC-GH46-001..004 | Manual Only | Agent file inspection. |
| TC-GH46-005..007 | Manual Only (grep assist) | Command prompt inspection; alias check. |
| TC-GH46-008, 009, 010 | Manual Only (prompt-behavior) | Human-judged runs against sample inputs. |
| TC-GH46-011 | Manual Only | Command file inspection. |
| TC-GH46-012..015 | Manual Only | Guide/template structural inspection. |
| TC-GH46-016..019 | Semi-automated (grep) | Deterministic grep assertions. |
| TC-GH46-020..022 | Semi-automated (grep) | Deterministic grep assertions. |
| TC-GH46-023 | Semi-automated | Build script + `git status` idempotency. |
| TC-GH46-024 | Semi-automated (grep) | Link-target resolution. |
| TC-GH46-025..028 | Manual Only (grep assist) | ADR + compat/runtime/CoT inspection. |
| TC-GH46-029 | Automated | `git diff --check` + YAML parse. |

**No new automated test files are created for GH-46.** The repository's `test-*.sh` pattern (`tools/.tests/`, `scripts/.tests/`) applies only to `tools/`/`scripts/` artifacts; GH-46 introduces none (validator/index tools deferred per RD-13/NG-2). Per testing-strategy fallback, manual verification + `git diff --check` are the required gates.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **RSK-T1 — Prompt-behavior tests are human-judged and non-deterministic.** The R1⊂R3 proportionality check (TC-GH46-008) and no-auto-Accept check (TC-GH46-010) depend on running an LLM and judging output. *Mitigation:* pin the exact assertion (status stays `Proposed`; R1 output omits R3-only sections) so pass/fail is unambiguous regardless of prose variance.
- **RSK-T2 — Grep scoping false positives.** The `@architect` sweep (TC-GH46-022) and "non-negotiable" check (TC-GH46-016) could over-match historical/generated files. *Mitigation:* scopes are explicitly narrowed to live sources and exclude `doc/changes/**` and `.ados-claude/**` (verified separately).
- **RSK-T3 — Drift between template and write-decision after bake-in removal.** *Mitigation:* TC-GH46-019 enforces a 0-mismatch heading diff; this is the single most important regression guard (NFR-4 / GH-60 NFR-1).

### 8.2 Assumptions

- This is an `engineering-repo`; writes to `doc/guides/` and `doc/templates/` are permitted; no `doc/business/**` is created.
- No decision records exist to migrate; new optional front matter requires no remediation.
- `@external-researcher` continues to serve the research role (no dedicated `@decision-researcher` in v1).
- The generated Claude Code plugin is kept in sync via `scripts/build-claude-plugin.sh`; source-of-truth remains `.opencode/`.

### 8.3 Open Questions

| ID | Question | Status / Owner |
|----|----------|----------------|
| OQ-T1 | Does `/write-decision` still enumerate sections (for rendering) or fully delegate to the template? Either is acceptable per AC-12 provided the heading order matches 0-mismatch (TC-GH46-019). | Non-blocking — resolved by TC-GH46-019 outcome. |
| OQ-T2 | Is the old `decision-records-management.md` guide removed or kept as a demoted artifact reference? Affects inbound-link checks (TC-GH46-024). | Non-blocking — both outcomes are testable; verify no broken links either way. |
| OQ-T3 | Confirm ADR-0001 status at merge time (`Proposed` vs `Accepted`) — affects whether `decision_date` is set (TC-GH46-025). | Non-blocking — TC accepts either if front matter is internally consistent. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-24 | @test-plan-writer | Initial test plan for GH-46; 29 scenarios covering AC-GH46-1…14, DM-1…5, NFR-1…6. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(populated during review/execution phase)_ | | | |
