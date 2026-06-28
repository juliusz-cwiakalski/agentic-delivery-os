---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-06/2026-06-28--GH-85--ados-process-map-diagrams/chg-GH-85-test-plan.md
id: chg-GH-85-test-plan
status: Updated
created: 2026-06-28T10:35:00Z
last_updated: 2026-06-28T14:30:00Z
owners: [Juliusz Ćwiąkalski]
service: docs
labels: [docs, guides, diagrams, mermaid, dx]
version_impact: none — documentation only (no agent/command/process-logic changes)
summary: "Create canonical ADOS process map (doc/guides/ados-processes.md with master Mermaid diagram + per-process cards), add a compact Mermaid process map to README.md, add Mermaid diagrams near the top of three process guides, wire cross-navigation (back-links + forward links + doc/00-index.md entry), and run a consistency review of existing diagrams. Reduces time-to-AHA for new adopters."
links:
  change_spec: ./chg-GH-85-spec.md
  implementation_plan: ./chg-GH-85-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - ADOS processes map + per-guide diagrams (GH-85)

## 1. Scope and Objectives

This is a **documentation-only change**: it adds a canonical process-map guide, compact Mermaid diagrams, and cross-navigation links. There is no executable agent/command/process-logic code, so there are no unit/integration/E2E tests to run against behavior. Instead, verification is structured around:

- **One automated gate** (`scripts/.tests/test-doc-distribution.sh`) that enforces `ados_distribution` markers and install-set invariants over the closed DM-2 doc set — directly applicable here because the change touches redistributable guides and `doc/00-index.md`.
- **License-header coverage** for every new/modified redistributable doc.
- **Repeatable structural checks** (grep/awk-based) that turn each acceptance criterion into a binary pass/fail probe.
- **Manual review** for inherently subjective qualities (readability, diagram aesthetics, Mermaid rendering on GitHub, stylistic consistency).

Core behavior to protect: every AC in the ticket must be objectively verifiable, and the change must not leak scope into agents/commands/process logic or `doc/spec/**` features (explicit non-goals).

### 1.1 In Scope

- New file `doc/guides/ados-processes.md` (canonical process map: master Mermaid diagram + 6 per-process overview cards).
- README.md compact Mermaid process map + adjacent clickable link block.
- Mermaid diagrams added near the top of: `meeting-preparation-and-summarization.md`, `decision-making.md`, `onboarding-existing-project.md`.
- Cross-navigation: back-links to `ados-processes.md` from every process guide; forward links from `ados-processes.md` to each process guide; prominent link from `doc/00-index.md` to `ados-processes.md`.
- License headers + `ados_distribution` markers on all new/modified redistributable docs.
- `git diff --check` cleanliness and scope-bounded diff.

### 1.2 Out of Scope & Known Gaps

- **No agent/command/process-logic changes** (`.opencode/**`, `.ai/**` config) — explicit non-goal; verified as a regression guard, not tested for behavior.
- **No PNG/SVG assets** — issue forbids rendered images; Mermaid only. (So no image-rendering or binary-asset checks.)
- **No `doc/spec/**` feature additions** — explicit non-goal; verified as a regression guard.
- **Mermaid CLI lint is best-effort** — the repo does not ship a pinned `mmdc` (Mermaid CLI) dependency, so syntax validation relies primarily on GitHub visual render review; if `mmdc` is locally available it may be used as a secondary check (see TC-PROC-013).
- **License-header "verify mode":** `scripts/add-header-location.sh` has no fail-on-missing verify mode; it only mutates (with `--dry-run`). AC12 is therefore verified by grep + dry-run idempotency, not by a failing CI gate.
- **NFR coverage is reconciled to the spec's `NFR-1..NFR-6`** (§9 of `chg-GH-85-spec.md`). Each TC traces to its NFR ID in §3.3 (OQ-4 closed).
- **"Documentation reconciliation" has no standalone guide.** Per the landed spec, it is a *supporting process embedded in the change lifecycle* (phase 7 `system_spec_update`, run by `@doc-syncer` / `/sync-docs` inside `doc/guides/change-lifecycle.md`). There is therefore no 6th standalone guide to back-link or link-table; its representation is the canonical-map card + the change-lifecycle phase-7 section (OQ-1 closed).

## 2. References

- Change spec: `./chg-GH-85-spec.md` (landed; canonical source of truth for AC/NFR IDs — see §3.1 cross-walk).
- Implementation plan: `./chg-GH-85-plan.md` (landed; note the plan still uses a flat `AC-1..AC-12` scheme — see §3.1 cross-walk for the 1:1 remap; plan-side reconciliation is tracked separately).
- PM notes / ticket context: `./chg-GH-85-pm-notes.yaml` (issue #85 summary, decisions, existing-diagram style inventory).
- Testing strategy: `.ai/rules/testing-strategy.md`.
- Automated guard: `scripts/.tests/test-doc-distribution.sh` (GH-67 drift guard — 5 failure modes over DM-2 doc set).
- Header tool: `scripts/add-header-location.sh`.
- Consistency reference diagrams:
  - `doc/guides/change-lifecycle.md` (`flowchart TD` + `subgraph` + quoted labels + `<br/>` multiline).
  - `doc/guides/project-inception.md` (`flowchart TB/TD/LR` + `subgraph X["..."]` + `style X fill:#...` color fills + convergence diamonds).
- AGENTS.md (agent/team inventory + delivery process table — source of truth for the 6-process inventory and relationships).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

> **AC scheme cross-walk (canonical).** This plan adopts the spec's prefixed AC scheme (`AC-F1-1`…`AC-F5-1`, `AC-NFR4-1`, `AC-NFR5-1`) as the single source of truth — see `chg-GH-85-spec.md` §17. The earlier flat `AC-1`…`AC-12` IDs are retired here. 1:1 remap to the sibling artifacts: this is the same scheme the spec uses; the implementation plan still carries a flat `AC-1`…`AC-12` scheme that disagrees in places (e.g., its `AC-6` = "link table" vs. this plan's former `AC-6` = "meeting diagram"), so when referencing the plan, map by **intent**, not by number. The canonical IDs below win on any conflict.
>
> Note on README: AC-F2-1 is a **single** criterion — the compact README map **and** its adjacent link legend are verified together in one AC (not split). Documentation reconciliation has **no standalone guide**, so it contributes a canonical-map card (AC-F1-3) but no per-guide diagram or back-link target (the 5 standalone guides carry the back-links under AC-F4-1).

Traceability matrix — every canonical AC maps to one or more test cases and a verification method. Verification method legend: **AUTO** = automated script gate; **STRUCT** = repeatable structural check (grep/awk); **MANUAL** = human review.

| AC ID | Description (canonical, from spec §17) | TC ID(s) | Method | Pass criterion | Status |
|-------|----------------------------------------|----------|--------|----------------|--------|
| AC-F1-1 | `doc/guides/ados-processes.md` exists with `ados_distribution: redistributable` | TC-PROC-001, TC-PROC-011 | STRUCT + AUTO | File exists; frontmatter marker parses to `redistributable`; doc-distribution guard exits 0 | Covered |
| AC-F1-2 | Master Mermaid diagram shows all 6 processes (5 primary + documentation reconciliation as supporting) with their cross-process relationships | TC-PROC-002, TC-PROC-016 | STRUCT + MANUAL | Master Mermaid block contains all 6 canonical process labels + ≥1 relationship edge each; renders on GitHub | Covered |
| AC-F1-3 | Per-process overview card (problem/audience/output/link) for each of the 6 processes | TC-PROC-003, TC-PROC-016 | STRUCT + MANUAL | Exactly 6 cards; each card exposes all 4 fields; each card's link resolves to the correct guide (documentation reconciliation → change-lifecycle.md phase 7) | Covered |
| AC-F1-4 | Easy-to-read, scannable structure (clear sections, cards/tables, short prose — not a wall of text) | TC-PROC-004 | MANUAL | Reviewer confirms logical section order, ≤2 nesting depth for cards, no wall-of-text; documented in execution log | Covered |
| AC-F2-1 | README compact Mermaid process map near top **and** adjacent markdown link legend for one-click access (clickability via the legend — DEC-1; nodes not clickable) | TC-PROC-005 | STRUCT + MANUAL | First ```mermaid block within first 60 lines; adjacent link legend contains a link to every (standalone) process guide | Covered |
| AC-F3-1 | `meeting-preparation-and-summarization.md` Mermaid diagram (before/during/after) near top | TC-PROC-006 | STRUCT + MANUAL | First ```mermaid block within first 80 lines; renders on GitHub | Covered |
| AC-F3-2 | `decision-making.md` Mermaid diagram (D0–D14 kernel + R0–R3 routing) near top | TC-PROC-007 | STRUCT + MANUAL | First ```mermaid block within first 80 lines; renders on GitHub | Covered |
| AC-F3-3 | `onboarding-existing-project.md` Mermaid setup-flow diagram near top | TC-PROC-008 | STRUCT + MANUAL | First ```mermaid block within first 80 lines; renders on GitHub | Covered |
| AC-F4-1 | Every process guide has a back-link to `ados-processes.md` | TC-PROC-009 | STRUCT | Each of the 5 standalone process guides contains a navigational markdown link to `ados-processes.md` | Covered |
| AC-F4-2 | `doc/00-index.md` links to `ados-processes.md` prominently | TC-PROC-010 | STRUCT + MANUAL | Link present within first 50 lines (top index tables) | Covered |
| AC-F5-1 | Consistency review — all process diagrams (2 existing + new) share consistent node-naming, color, subgraph, multiline-label, and feedback-loop conventions | TC-PROC-014 | MANUAL (+ STRUCT spot-checks) | New diagrams share the established conventions; every color-coded diagram carries a Legend + non-color cue (see TC-PROC-014) | Covered |
| AC-NFR4-1 | All new/modified redistributable docs carry license headers | TC-PROC-012 | STRUCT (+ AUTO idempotency) | Every touched file — new `ados-processes.md`; 5 modified guides; `doc/00-index.md`; **and `README.md`** (pre-existing header preserved) — has Copyright/MIT/source lines; header-tool dry-run is a no-op | Covered |
| AC-NFR5-1 | Doc-distribution test exits 0 | TC-PROC-011 | AUTO | `bash scripts/.tests/test-doc-distribution.sh` exits 0 | Covered |

**Cross-cutting coverage (not a single AC, but ticket verification strategies):**

| Concern | TC ID(s) | Method | Pass criterion |
|---------|----------|--------|----------------|
| Mermaid syntax validity (conservative, GitHub-renderable) | TC-PROC-013 | MANUAL (+ best-effort `mmdc`) | Every new/modified Mermaid block renders on GitHub; uses only conservative directives |
| Scope/regression guard (docs-only, no spec features) | TC-PROC-015 | STRUCT | Diff touches only `doc/**` + `README.md` + this change folder; no `.opencode/`, `.ai/`, `tools/`, `scripts/` logic; no `doc/spec/**` feature files |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

N/A. This is a documentation-only change with no APIs, events, or data-model interfaces. The only "interface" touched is the navigational link graph between docs, covered structurally by TC-PROC-005, TC-PROC-009, TC-PROC-010.

### 3.3 Non-Functional Coverage (NFR-#)

Reconciled to the landed spec's `NFR-1..NFR-6` (spec §9). Each NFR traces to its TC(s). (OQ-4 closed.)

| NFR ID | Requirement (spec §9) | TC ID(s) | Verification |
|--------|-----------------------|----------|--------------|
| NFR-1 | Mermaid syntax renders on GitHub (conservative, widely-supported; no directives outside GitHub's pinned version) | TC-PROC-013 | Manual GitHub render review + optional best-effort `mmdc` |
| NFR-2 | README compact map fits one screen-width (~1280px, no horizontal scrollbar) | TC-PROC-005, TC-PROC-004 | Structural compact-map probe + GitHub render review (compact LR diagram) |
| NFR-3 | Mobile rendering does not break layout (renders, no destructive horizontal overflow; vertical scroll OK) | TC-PROC-013, TC-PROC-004 | Manual GitHub mobile render review (desktop+mobile) |
| NFR-4 | License headers on all new/modified redistributable docs | TC-PROC-012 | Structural header check + header-tool dry-run idempotency (→ AC-NFR4-1) |
| NFR-5 | doc-distribution guard passes (marker present/valid, no install-set drift) | TC-PROC-011 | Automated doc-distribution guard (→ AC-NFR5-1) |
| NFR-6 | Diagram consistency (all process diagrams share consistent node-naming, color, subgraph, multiline-label, feedback-loop conventions) | TC-PROC-014 | Manual consistency review + structural spot-checks (→ AC-F5-1) |
| (scope guard) | No scope creep / non-functional regression (docs-only, no spec features) | TC-PROC-015 | Structural diff guard (non-goal guard, not a spec NFR) |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this is a `doc/**` change → **static/diff + content checks** are the primary layers. There is no unit/integration/E2E layer because there is no executable product code. Specifically:

- **Static/diff checks (always):** `git diff --check` (whitespace/conflict-marker guard) and changed-file path/naming review. → TC-PROC-015.
- **Content checks (docs):** manual traceability review vs AC, Markdown rendering review, link/path review, YAML frontmatter syntax. → TC-PROC-002/003/004/016 + all link checks.
- **Automated shell/tool tests (when applicable):** the doc-distribution drift guard (`scripts/.tests/test-doc-distribution.sh`) applies because the change touches redistributable docs in the closed DM-2 set. No `tools/` or `scripts/` logic is modified, so no `test-*.sh` for those modules is in scope.
- **Manual verification:** required for all subjective qualities (readability, diagram aesthetics, consistency, GitHub render). Per strategy, for docs-only changes manual verification + `git diff --check` is the fallback floor; here it is augmented by the automated doc-distribution gate.

Evidence convention: every executed check records the exact command run + pass/fail result in §10 (Test Execution Log).

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC Coverage |
|-------|-------|------|--------|----------|-------------|
| TC-PROC-001 | `ados-processes.md` exists with correct distribution marker | Happy Path | Critical | High | AC-F1-1 |
| TC-PROC-002 | Master Mermaid diagram enumerates all 6 processes + relationships | Happy Path | Critical | High | AC-F1-2 |
| TC-PROC-003 | Six per-process overview cards each expose problem/audience/output/link | Happy Path | Critical | High | AC-F1-3 |
| TC-PROC-004 | Process-map guide is readable and scannable | Manual Review | Important | Medium | AC-F1-4 |
| TC-PROC-005 | README compact Mermaid map + clickable link block near top | Happy Path | Critical | High | AC-F2-1 |
| TC-PROC-006 | Meeting-prep guide has Mermaid diagram near top | Happy Path | Important | Medium | AC-F3-1 |
| TC-PROC-007 | Decision-making guide has Mermaid diagram near top | Happy Path | Important | Medium | AC-F3-2 |
| TC-PROC-008 | Onboarding guide has Mermaid diagram near top | Happy Path | Important | Medium | AC-F3-3 |
| TC-PROC-009 | Every process guide back-links to `ados-processes.md` | Happy Path | Important | High | AC-F4-1 |
| TC-PROC-010 | `doc/00-index.md` prominently links `ados-processes.md` | Happy Path | Important | Medium | AC-F4-2 |
| TC-PROC-011 | Doc-distribution drift guard exits 0 | Regression | Critical | High | AC-F1-1, AC-NFR5-1 |
| TC-PROC-012 | License headers present on all touched redistributable docs | Regression | Critical | High | AC-NFR4-1 |
| TC-PROC-013 | All new/modified Mermaid blocks use conservative, GitHub-renderable syntax | Corner Case | Important | High | AC-F1-2, AC-F2-1, AC-F3-1, AC-F3-2, AC-F3-3 |
| TC-PROC-014 | New diagrams are stylistically consistent with existing diagram conventions | Manual Review | Important | Medium | AC-F5-1 |
| TC-PROC-015 | Diff is scope-bounded: docs-only, no spec features, no agent/command logic | Negative / Regression | Critical | High | (non-goal guards) |
| TC-PROC-016 | 6-process inventory + cross-process relationships match the ticket | Corner Case | Critical | High | AC-F1-2, AC-F1-3 |

### 5.2 Scenario Details

#### TC-PROC-001 - `ados-processes.md` exists with correct distribution marker

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, TC-PROC-011, NFR-5
**Test Type(s)**: Manual (structural)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/ados-processes.md`
**Tags**: @docs, @distribution

**Preconditions**:

- Change has been delivered (file written) on branch `docs/GH-85/ados-process-map-diagrams`.

**Steps**:

1. Confirm the file exists: `test -f doc/guides/ados-processes.md`.
2. Parse the frontmatter marker the same way the drift guard does:
   `awk 'NR==1 && /^---[ \t]*$/ {f=1;next} f && /^---[ \t]*$/ {f=0} f && /^ados_distribution:[ \t]*/ {gsub(/ados_distribution:[ \t]*/,""); gsub(/[ \t]+$/,""); print}' doc/guides/ados-processes.md`
3. (Automated) Run `bash scripts/.tests/test-doc-distribution.sh` and confirm `ados-processes.md` is not named in any `::error::` annotation (no missing-marker / invalid-enum / redistributable-not-installed failure).

**Expected Outcome**:

- File exists; marker value is exactly `redistributable`; doc-distribution guard exits 0 with `ados-processes.md` in the install set.

**Notes / Clarifications**:

- The structural probe in step 2 mirrors `get_marker()` in the guard; step 3 is the authoritative automated check. Both must agree.

---

#### TC-PROC-002 - Master Mermaid diagram enumerates all 6 processes + relationships

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, AC-F1-3, TC-PROC-013, TC-PROC-016, NFR-1
**Test Type(s)**: Manual (structural)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/ados-processes.md` (first/largest Mermaid block = "master diagram")
**Tags**: @docs, @mermaid

**Preconditions**:

- `ados-processes.md` exists (TC-PROC-001 pass).

**Steps**:

1. Extract the master Mermaid block (the ```mermaid fence that introduces the 6-process map) and confirm all six canonical process labels appear. Probe each:
   ```
   for p in "Inception" "Onboarding" "Change Delivery" "Meeting Management" "Decision Making" "Documentation Reconciliation"; do
     grep -c "$p" doc/guides/ados-processes.md
   done
   ```
   (The six canonical labels — Inception, Onboarding, Change Delivery, Meeting Management, Decision Making, Documentation Reconciliation — are final in the spec §5.1; the probe matches those labels.)
2. Confirm each of the 6 processes is connected to at least one other process via a relationship (arrow), i.e., no isolated node in the master diagram.
3. Visually confirm on GitHub render that the diagram shows the 5 primary processes + 1 supporting process and the relationships between them.

**Expected Outcome**:

- All six process labels present (count ≥ 1 each); each process participates in ≥1 relationship edge; GitHub renders the diagram cleanly.

---

#### TC-PROC-003 - Six per-process overview cards each expose problem/audience/output/link

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-3, TC-PROC-016
**Test Type(s)**: Manual (structural)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/ados-processes.md` (card section)
**Tags**: @docs

**Preconditions**:

- `ados-processes.md` exists (TC-PROC-001 pass).

**Steps**:

1. Count card headings (e.g., `## Process N — <name>` or `### <name>`) and confirm exactly **6**:
   `grep -cE '^#{2,3} .*(Inception|Onboarding|Change Delivery|Meeting|Decision|Documentation Reconcil)' doc/guides/ados-processes.md` → expect 6 (adjust regex to spec's headings).
2. For each card, confirm the four required fields are present: **Problem** (what it solves), **Audience** (who it's for), **Output** (what it produces), **Link** (markdown link to the process's guide). Probe field presence per card section.
3. For each card's **Link**, confirm the target path resolves (`test -f <linked guide>` or resolves to an in-repo anchor).

**Expected Outcome**:

- Exactly 6 cards; every card exposes all 4 fields; every card link points to an existing, correct guide.

**Notes / Clarifications**:

- Field naming is finalized in the spec; the probe matches the spec's field labels (e.g., `**Problem:**` / `**Audience:**` / `**Output:**` / `**Link:**`).

---

#### TC-PROC-004 - Process-map guide is readable and scannable

**Scenario Type**: Manual Review
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F1-4, NFR-2, NFR-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/guides/ados-processes.md`
**Tags**: @docs, @ux

**Preconditions**:

- `ados-processes.md` fully authored.

**Steps**:

1. Open `ados-processes.md` rendered on GitHub.
2. Reviewer confirms: clear section hierarchy (title → master diagram → cards → relationships/cross-nav); cards scannable at a glance; no wall-of-text; consistent heading depth for the 6 cards; the guide answers "what are the ADOS processes, who runs them, and where do I go next?" within one screen-scroll of the top.

**Expected Outcome**:

- Reviewer records PASS with a one-line note in the execution log. Any readability defect is filed and remediated before DoD.

---

#### TC-PROC-005 - README compact Mermaid map + clickable link block near top

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, TC-PROC-013, NFR-2
**Test Type(s)**: Manual (structural)
**Automation Level**: Semi-automated
**Target Layer / Location**: `README.md`
**Tags**: @docs, @mermaid, @dx

**Preconditions**:

- README modified on branch.

**Steps**:

1. Confirm a ```mermaid block exists within the first 60 lines:
   `awk '/^```mermaid/{print NR; exit}' README.md` → expect a line number ≤ 60.
2. Confirm an adjacent link block (a markdown table or list) immediately follows the diagram and contains a link to **each** standalone process guide (the 5 guides; documentation reconciliation has no standalone guide and is reachable via `change-lifecycle.md`). Probe:
   `for g in project-inception onboarding-existing-project change-lifecycle meeting-preparation-and-summarization decision-making; do grep -c "$g.md" README.md; done` (5 standalone guides).
3. Confirm README's existing 3-line license header (Copyright/MIT/source) is retained (covered authoritatively by TC-PROC-012).
4. Visually confirm the compact map renders on GitHub and the link block gives one-click access to each guide.

**Expected Outcome**:

- Mermaid block within first 60 lines; link block present with a link to every process guide; header retained; GitHub render clean.

**Notes / Clarifications**:

- Per PM decision (pm-notes), GitHub's Mermaid iframe sandbox blocks node `click`/`<a>` callbacks, so "clickable links to guides" is satisfied by the **adjacent markdown link block**, not by clickable diagram nodes. This is the GitHub-native interpretation of the AC.

---

#### TC-PROC-006 - Meeting-prep guide has Mermaid diagram near top

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F3-1, TC-PROC-013, TC-PROC-009, NFR-1
**Test Type(s)**: Manual (structural)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/meeting-preparation-and-summarization.md`
**Tags**: @docs, @mermaid

**Preconditions**:

- Guide modified on branch (currently has 0 Mermaid blocks on `main`).

**Steps**:

1. `awk '/^```mermaid/{print NR; exit}' doc/guides/meeting-preparation-and-summarization.md` → expect ≤ 80 (structural proxy for "near top", after frontmatter + title + audience blockquote).
2. Visually confirm the diagram renders on GitHub and accurately reflects the meeting lifecycle (before/during/after).

**Expected Outcome**:

- First ```mermaid block within first 80 lines; renders cleanly; content accurate.

---

#### TC-PROC-007 - Decision-making guide has Mermaid diagram near top

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F3-2, TC-PROC-013, TC-PROC-009, NFR-1
**Test Type(s)**: Manual (structural)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/decision-making.md`
**Tags**: @docs, @mermaid

**Preconditions**:

- Guide modified on branch (currently has 0 Mermaid blocks on `main`).

**Steps**:

1. `awk '/^```mermaid/{print NR; exit}' doc/guides/decision-making.md` → expect ≤ 80.
2. Visually confirm the diagram renders on GitHub and reflects the decision rigor/kernel lifecycle (R0 escape + D0–D14 kernel).

**Expected Outcome**:

- First ```mermaid block within first 80 lines; renders cleanly; content accurate.

---

#### TC-PROC-008 - Onboarding guide has Mermaid diagram near top

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F3-3, TC-PROC-013, TC-PROC-009, NFR-1
**Test Type(s)**: Manual (structural)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/onboarding-existing-project.md`
**Tags**: @docs, @mermaid

**Preconditions**:

- Guide modified on branch (currently has 0 Mermaid blocks on `main`).

**Steps**:

1. `awk '/^```mermaid/{print NR; exit}' doc/guides/onboarding-existing-project.md` → expect ≤ 80.
2. Visually confirm the diagram renders on GitHub and reflects the onboarding flow (bootstrap path / manual setup / mandatory vs optional artifacts).

**Expected Outcome**:

- First ```mermaid block within first 80 lines; renders cleanly; content accurate.

---

#### TC-PROC-009 - Every process guide back-links to `ados-processes.md`

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F4-1
**Test Type(s)**: Manual (structural)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/*.md` (process-guide set)
**Tags**: @docs, @navigation

**Preconditions**:

- Designated process-guide set (the 5 standalone process guides): `project-inception.md`, `onboarding-existing-project.md`, `change-lifecycle.md`, `meeting-preparation-and-summarization.md`, `decision-making.md`. The 6th process — **documentation reconciliation** — has **no standalone guide**; it is a supporting process embedded in the change lifecycle (phase 7 `system_spec_update`, `@doc-syncer` / `/sync-docs`), so it is represented via the canonical-map card (→ AC-F1-3) and the change-lifecycle phase-7 section, not via a back-link target. (OQ-1 closed.)

**Steps**:

1. For each of the 5 standalone process guides, confirm a navigational markdown link to `ados-processes.md` exists:
   ```
   for g in project-inception onboarding-existing-project change-lifecycle \
            meeting-preparation-and-summarization decision-making; do
     printf "%s: " "$g"; grep -c "ados-processes.md" "doc/guides/$g.md"
   done
   ```
   → expect count ≥ 1 for every guide. (Documentation reconciliation is intentionally absent — no standalone guide.)
2. Confirm the back-link is phrased as navigation (e.g., "Part of the [ADOS process map](ados-processes.md)") rather than an incidental mention.

**Expected Outcome**:

- Every standalone process guide links to `ados-processes.md`; links are navigational.

---

#### TC-PROC-010 - `doc/00-index.md` prominently links `ados-processes.md`

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F4-2
**Test Type(s)**: Manual (structural)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/00-index.md`
**Tags**: @docs, @navigation

**Preconditions**:

- `doc/00-index.md` modified on branch.

**Steps**:

1. `awk '/ados-processes\.md/{print NR; exit}' doc/00-index.md` → expect ≤ 50 (i.e., the link appears in one of the top index tables: Start Here / Changing Behavior / Guides).
2. Confirm the link is in a table row or list item (not buried in prose).
3. Confirm `doc/00-index.md` retains its `ados_distribution: redistributable` marker (covered by TC-PROC-011).

**Expected Outcome**:

- Link to `ados-processes.md` present within first 50 lines, in a prominent index position; marker intact.

---

#### TC-PROC-011 - Doc-distribution drift guard exits 0

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-NFR5-1, TC-PROC-001, NFR-5
**Test Type(s)**: Manual (automated script)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @docs, @distribution, @automation

**Preconditions**:

- Bash ≥ 4 available (guard requires `shopt globstar`).
- All new/modified docs committed/staged so the guard scans the working tree.

**Steps**:

1. `bash scripts/.tests/test-doc-distribution.sh ; echo "exit=$?"`
2. Inspect output for the 5 failure modes (missing-marker, invalid-enum-value, redistributable-not-installed, internal-installed, derived-set drift) referencing any file touched by this change (`ados-processes.md`, the 3 modified guides, `doc/00-index.md`).

**Expected Outcome**:

- Exit code 0; final line `[OK]   no drift — <N> in-scope docs; install set matches ados_distribution markers`; no `::error::` annotation references any file in this change.

**Notes / Clarifications**:

- This single gate authoritatively covers AC-F1-1 (marker present+valid on `ados-processes.md`) and AC-NFR5-1. It also regressively protects the wider DM-2 doc set from drift introduced by the new file.

---

#### TC-PROC-012 - License headers present on all touched redistributable docs

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR4-1, NFR-4
**Test Type(s)**: Manual (structural + tool idempotency)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/*.md`, `README.md`
**Tags**: @docs, @license, @automation

**Preconditions**:

- All new/modified docs on branch.

**Steps**:

1. For every touched redistributable doc, confirm the 3-line license header block is present in frontmatter (Copyright + MIT + source):
   ```
   for f in doc/guides/ados-processes.md \
            doc/guides/meeting-preparation-and-summarization.md \
            doc/guides/decision-making.md \
            doc/guides/onboarding-existing-project.md \
            doc/guides/change-lifecycle.md \
            doc/guides/project-inception.md \
            README.md doc/00-index.md; do
     printf "%s: " "$f"
     grep -cE '^(# Copyright \(c\) 2025-2026|# MIT License - see LICENSE file for full terms|source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/)' "$f"
   done
   ```
   → expect count ≥ 3 for every file (guides also carry `ados_distribution`).
2. (Idempotency) Run the header tool in dry-run and confirm it reports no pending changes for the touched paths:
   `DRY_RUN=true VERBOSE=true scripts/add-header-location.sh doc/guides/ados-processes.md doc/guides/meeting-preparation-and-summarization.md doc/guides/decision-making.md doc/guides/onboarding-existing-project.md` → expect "No changes needed" / skip for each.
3. Confirm README's existing header is retained (not clobbered by the diagram insertion).

**Expected Outcome**:

- Every touched redistributable doc has Copyright/MIT/source lines; header-tool dry-run is a no-op; README header intact.

**Notes / Clarifications**:

- The header tool has no fail-on-missing "verify mode", so step 1 (grep) is the authoritative pass/fail probe; step 2 (dry-run idempotency) is corroborating. (This gap is noted in §1.2.)
- **Authoritative enumerated header list (m7 cross-walk):** this plan treats AC-NFR4-1 as covering **all** modified files whose header must be present/preserved — the new `doc/guides/ados-processes.md`; the **5** modified guides (`meeting-preparation-and-summarization.md`, `decision-making.md`, `onboarding-existing-project.md`, `change-lifecycle.md`, `project-inception.md`); `doc/00-index.md`; **and `README.md`** (README's pre-existing header is modified-adjacent and must be preserved verbatim). `README.md` is included here even though it is not in the doc-distribution scan set, because it is a touched file and its header is a DoD-relevant invariant. The spec's AC-NFR4-1 prose currently enumerates only `ados-processes.md; modified guides; doc/00-index.md` — for cross-artifact agreement the spec/plan should add `README.md` to that enumerated list (this plan cannot edit them; tracked in §8.3).

---

#### TC-PROC-013 - All new/modified Mermaid blocks use conservative, GitHub-renderable syntax

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-2, AC-F2-1, AC-F3-1, AC-F3-2, AC-F3-3, NFR-1, NFR-3
**Test Type(s)**: Manual (+ best-effort automated)
**Automation Level**: Semi-automated
**Target Layer / Location**: every new/modified ```mermaid block
**Tags**: @docs, @mermaid, @rendering

**Preconditions**:

- All diagrams authored.

**Steps**:

1. Enumerate all ```mermaid fences in touched files:
   `grep -rn '^```mermaid' doc/guides/ados-processes.md README.md doc/guides/meeting-preparation-and-summarization.md doc/guides/decision-making.md doc/guides/onboarding-existing-project.md`
2. Reviewer confirms each block uses only conservative, widely-supported Mermaid: `flowchart TD|TB|LR`, `subgraph`, quoted node labels, `style <node> fill:#...`, `<br/>` multiline, standard arrows (`-->`, `-.->`, `==>`). No bleeding-edge directives (no exotic `classDef`-only styling inconsistent with existing diagrams, no unsupported `click` callbacks — see PM decision).
3. Push the branch and visually confirm every diagram renders on GitHub (the authoritative renderer for this repo).
4. (Best-effort, optional) If `npx --yes @mermaid-js/mermaid-cli` (`mmdc`) is available locally, run it against each extracted block and confirm exit 0. Record availability in the execution log; do not block delivery on absence of `mmdc`.

**Expected Outcome**:

- Every block uses conservative syntax; every block renders on GitHub; optional `mmdc` passes when available.

**Notes / Clarifications**:

- GitHub render is authoritative because the repo ships no pinned Mermaid version; `mmdc` is best-effort only.

---

#### TC-PROC-014 - New diagrams are stylistically consistent with existing diagram conventions

**Scenario Type**: Manual Review
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F5-1, NFR-6
**Test Type(s)**: Manual (+ structural spot-checks)
**Automation Level**: Manual
**Target Layer / Location**: new diagrams vs `doc/guides/change-lifecycle.md`, `doc/guides/project-inception.md`
**Tags**: @docs, @mermaid, @consistency, @a11y

**Preconditions**:

- Existing conventions documented (pm-notes): `change-lifecycle.md` → `flowchart TD` + `subgraph "..."` + `<br/>` multiline + dashed feedback loops + Legend; `project-inception.md` → `flowchart TB/TD/LR` + `subgraph X["..."]` quoted labels + `style X fill:#...` color fills + convergence diamonds. The implementation plan defines a shared palette where **green `#4CAF50` = entry/success and red `#F44336` = remediation/fail**.

**Steps**:

1. Reviewer compares each new diagram against the two reference diagrams.
2. Confirm "consistent" means, at minimum:
   - Uses the `flowchart TD|TB|LR` family (not `graph` shorthand that differs).
   - Uses `subgraph` with quoted labels for grouping (matches both references).
   - Uses `style <node> fill:#...` for color (matches `project-inception.md`); no jarring palette shift.
   - Uses `<br/>` (not literal newlines) for multiline labels (matches `change-lifecycle.md`).
   - Every diagram carries a `**Legend**:` block or one-line caption (a11y + comprehension — matches the `change-lifecycle.md` legend pattern).
3. Confirm existing diagrams (`change-lifecycle.md`, `project-inception.md`) are **not** regressed/restyled in a way that breaks their own consistency (the change is additive; if the consistency review touched them, the diff is stylistic-only and justified).
4. **Accessibility — non-color cue (WCAG 1.4.1).** For every diagram that uses red/green (or any color) to encode pass/fail or success/remediation, confirm the meaning is **also** conveyed without color: the diagram has a **Legend** naming the color semantics **and** each such node carries a **non-color text cue** (e.g., a label word like "✅/PASS/success" vs "❌/FAIL/remediation", or distinct node shapes). A reader who cannot distinguish red from green must still derive the outcome from the diagram. Structural spot-check: for each red/green-styled node, verify its label text states the outcome independently of color.

**Expected Outcome**:

- New diagrams share the established visual language; every color-coded diagram has a Legend + a non-color text cue on red/green nodes; no inconsistency or a11y defects filed; existing diagrams unbroken.

---

#### TC-PROC-015 - Diff is scope-bounded: docs-only, no spec features, no agent/command logic

**Scenario Type**: Negative / Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: (issue non-goals)
**Test Type(s)**: Manual (structural diff guard)
**Automation Level**: Automated
**Target Layer / Location**: git diff vs `origin/main`
**Tags**: @docs, @scope, @regression

**Preconditions**:

- Change delivered on branch.

**Steps**:

1. `git diff --check` → expect exit 0 (no whitespace errors / conflict markers).
2. Enumerate changed paths vs base:
   `git diff --name-only $(git merge-base HEAD origin/main)..HEAD` (or vs the agreed base commit `1e2e7ff` per pm-notes).
3. Confirm every changed path matches one of:
   - `doc/guides/ados-processes.md` (new)
   - `doc/guides/meeting-preparation-and-summarization.md`
   - `doc/guides/decision-making.md`
   - `doc/guides/onboarding-existing-project.md`
   - `doc/guides/change-lifecycle.md` (only if consistency review edited it)
   - `doc/guides/project-inception.md` (only if consistency review edited it)
   - `doc/00-index.md`
   - `README.md`
   - `doc/changes/2026-06/2026-06-28--GH-85--ados-process-map-diagrams/**` (this change's artifacts)
4. Confirm **none** of the following appear in the diff:
   - `.opencode/**` (agents/commands/skills)
   - `.ai/**` (config/rules — except read-only reference)
   - `tools/**`, `scripts/**` (CLI/automation logic)
   - `doc/spec/**` (feature specs — explicit non-goal)
   - any binary asset under `assets/` / `doc/**` (no PNG/SVG per non-goal)

**Expected Outcome**:

- `git diff --check` exits 0; changed-path list is a subset of the allowed set; zero forbidden paths present.

---

#### TC-PROC-016 - 6-process inventory + cross-process relationships match the ticket

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, AC-F1-3
**Test Type(s)**: Manual (+ structural)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/ados-processes.md`
**Tags**: @docs, @correctness

**Preconditions**:

- `ados-processes.md` authored.

**Steps**:

1. Confirm the inventory narrated in `ados-processes.md` is exactly the ticket's set: **inception, onboarding, change delivery, meeting management, decision making, documentation reconciliation** — 5 primary + 1 supporting, no more, no less, no renames that change meaning.
2. Confirm the "supporting" designation (which 1 of the 6 is supporting) matches the ticket/AGENTS.md framing.
3. Confirm cross-process relationships narrated in the guide (and shown in the master diagram) match the ticket — e.g., inception feeds onboarding; change delivery consumes decisions; decisions are captured from meetings; documentation reconciliation runs as a phase of change delivery; etc. Reviewer cross-checks each narrated relationship against AGENTS.md's process table.

**Expected Outcome**:

- Inventory == ticket set; supporting designation correct; every narrated relationship is faithful to the ticket + AGENTS.md; no invented or dropped processes.

**Notes / Clarifications**:

- This is the content-fidelity guardrail against scope drift (inventing an extra process or quietly dropping one).

---

## 6. Environments and Test Data

- **Environment:** local working copy on branch `docs/GH-85/ados-process-map-diagrams`, based on `origin/main` (commit `1e2e7ff` per pm-notes). Bash ≥ 4 required for the doc-distribution guard.
- **No test data fixtures:** all checks run against the real authored docs in-tree. There is no seeded input/output data.
- **Isolation:** all checks are read-only against the working tree except TC-PROC-012 step 2 (`add-header-location.sh` is run in `DRY_RUN=true`, so it writes nothing). No environment mutation.
- **GitHub render verification:** requires pushing the branch (or previewing via GitHub's Mermaid renderer) — coordinated with PR creation (phase 11); documented in execution log.

## 7. Automation Plan and Implementation Mapping

| TC ID | Automation approach | Command | Status |
|-------|---------------------|---------|--------|
| TC-PROC-001 | Structural probe + automated guard | `awk` marker probe + `bash scripts/.tests/test-doc-distribution.sh` | To run post-delivery |
| TC-PROC-002 | Structural probe | `grep` per-process label counts in master block | To run post-delivery |
| TC-PROC-003 | Structural probe | `grep -cE` card headings + per-card field presence | To run post-delivery |
| TC-PROC-004 | Manual only | GitHub render review | Manual Only |
| TC-PROC-005 | Structural probe | `awk` first-mermaid-line + `grep` link table | To run post-delivery |
| TC-PROC-006 | Structural probe | `awk '/^```mermaid/{print NR;exit}' …` ≤ 80 | To run post-delivery |
| TC-PROC-007 | Structural probe | same as TC-PROC-006 on `decision-making.md` | To run post-delivery |
| TC-PROC-008 | Structural probe | same as TC-PROC-006 on `onboarding-existing-project.md` | To run post-delivery |
| TC-PROC-009 | Structural probe | `grep -c "ados-processes.md"` per process guide | To run post-delivery |
| TC-PROC-010 | Structural probe | `awk '/ados-processes\.md/{print NR;exit}' doc/00-index.md` ≤ 50 | To run post-delivery |
| TC-PROC-011 | Automated guard (existing) | `bash scripts/.tests/test-doc-distribution.sh` | Existing – No Change |
| TC-PROC-012 | Structural + tool idempotency | header-line `grep` + `DRY_RUN=true scripts/add-header-location.sh …` | To run post-delivery |
| TC-PROC-013 | Manual + best-effort `mmdc` | GitHub render review; optional `npx @mermaid-js/mermaid-cli` | Manual (+ best-effort) |
| TC-PROC-014 | Manual | side-by-side vs `change-lifecycle.md` / `project-inception.md` | Manual Only |
| TC-PROC-015 | Automated structural diff | `git diff --check` + `git diff --name-only` allow/deny filter | To run post-delivery |
| TC-PROC-016 | Manual + structural | inventory/relationship review vs ticket + AGENTS.md | To run post-delivery |

**Implementation mapping note:** No new test scripts are authored for this change (docs-only). The only pre-existing automated gate exercised is `scripts/.tests/test-doc-distribution.sh`. Per `.ai/rules/testing-strategy.md`, the docs-only fallback floor (manual verification + `git diff --check`) is augmented here by that guard because redistributable docs are in scope.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Mermaid block placed just past the "near top" threshold (e.g., line 82) → structural probe fails though reviewer deems it fine | Medium | Low | Probe thresholds (README ≤60, guides ≤80) are documented proxies; reviewer can adjust with a recorded justification in the execution log. |
| GitHub Mermaid renderer rejects a directive that looks conservative (e.g., a `subgraph` quoting edge case) | Low | High | TC-PROC-013 makes GitHub render the authoritative check; must pass before DoD. |
| The new `ados-processes.md` is redistributable but `install.sh` fails to install it → doc-distribution "redistributable-not-installed" fires | Low | High | TC-PROC-011 catches this automatically; remediation is a marker/install-rule fix. |
| Back-link wording drifts into an incidental mention rather than clear navigation | Medium | Low | TC-PROC-009 step 2 requires the link be navigational phrasing. |
| Consistency review accidentally restyles existing diagrams and introduces churn/regression | Low | Medium | TC-PROC-014 step 3 + TC-PROC-015 confirm any existing-diagram edit is stylistic-only and justified. |

### 8.2 Assumptions

- The change spec (`chg-GH-85-spec.md`) has landed and codifies: canonical process labels, the per-process card field names, the "supporting" process designation (documentation reconciliation), the process→guide mapping (5 standalone guides + documentation-reconciliation embedded in `change-lifecycle.md` phase 7), and explicit `NFR-1..NFR-6` IDs. This plan is reconciled to it (AC/NFR cross-walk in §3.1, §3.3).
- **"Near the top" threshold (m3 — single canonical value, stated once, referenced identically across spec/plan/test-plan):** the compact README diagram's first ```mermaid fence must appear **within the first 60 lines**; each process-guide diagram's first ```mermaid fence must appear **within the first 80 lines**. These are this plan's structural proxies for the spec/plan's qualitative "near the top" (which gives no line number); frontmatter + title + audience blockquote legitimately occupy the first ~9–20 lines. Same thresholds are used in TC-PROC-005 (≤60) and TC-PROC-006/007/008 (≤80) and the §3.1 pass criteria.
- GitHub's native Mermaid renderer is the authoritative renderer for this repo (no pinned local Mermaid version).
- The repo's `doc/spec/**` is out of scope as a feature target (non-goal); the change does not add spec features.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Status |
|----|----------|-----------|-------|--------|
| OQ-1 | Which guide(s) represent the **"documentation reconciliation"** process? | No | @spec-writer | **Closed (R1).** Documentation reconciliation has **no standalone guide** — it is a supporting process embedded in `doc/guides/change-lifecycle.md` phase 7 (`system_spec_update`, `@doc-syncer` / `/sync-docs`). It is represented by the canonical-map card (AC-F1-3) and the change-lifecycle phase-7 section. The 5 standalone guides carry the back-links (AC-F4-1). Probes updated accordingly. |
| OQ-2 | Confirm the GitHub-native interpretation of "clickable links to guides" (AC-F2-1) = adjacent markdown link block, not clickable diagram nodes (per PM decision in pm-notes, GitHub sandbox blocks node callbacks). | No (PM decision already recorded) — surface for DoR confirmation. | @pm | Open (DoR confirmation only). |
| OQ-3 | Should a pinned Mermaid CLI lint be added to CI as a follow-up, or is GitHub render review sufficient for this and future diagram changes? | No (best-effort `mmdc` noted in TC-PROC-013). | @decision-advisor (follow-up) | Open. |
| OQ-4 | Reconcile explicit `NFR-#` IDs into §3.3. | No. | @test-plan-writer | **Closed (R1).** §3.3 now traces every TC to `NFR-1..NFR-6`; status → Updated; Revision Log 0.2. |
| OQ-5 | AC-NFR4-1 enumerated header list (m7): the spec's prose lists `ados-processes.md; modified guides; doc/00-index.md` and omits `README.md`; this plan includes README. For full cross-artifact agreement the spec/plan should add `README.md` to their enumerated lists. | No (test-plan covers README authoritatively via TC-PROC-012). | @spec-writer / @plan-writer | Open — sibling-artifact alignment. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-06-28 | @test-plan-writer | Initial draft. Derived from issue #85 ticket summary + `chg-GH-85-pm-notes.yaml` (spec `chg-GH-85-spec.md` authored in parallel). 16 test cases (TC-PROC-001..016) covering all 12 ACs + cross-cutting consistency/scope/correctness guards. NFR IDs and process→guide mapping flagged for reconciliation on spec landing (OQ-1, OQ-4). |
| 0.2 | 2026-06-28 | @test-plan-writer | Red-team R1 reconciliation (status → Updated). (1) **M1/m1:** retired flat `AC-1..AC-12`; §3.1 + §5.1 + all TC `Related IDs` remapped to the spec's canonical 13-ID scheme (`AC-F1-1`…`AC-F5-1`, `AC-NFR4-1`, `AC-NFR5-1`); README map+legend collapsed to the single AC-F2-1; consistency review promoted to its own AC row (AC-F5-1, TC-PROC-014). (2) **M3/OQ-4:** §3.3 reconciled to spec `NFR-1..NFR-6`, each TC traced to its NFR ID. (3) **M3/OQ-1:** confirmed documentation reconciliation has no standalone guide (embedded in `change-lifecycle.md` phase 7); removed `<6th-per-spec>` placeholders from TC-PROC-005/009; updated probes to the 5 standalone guides. (4) **m3:** stated the single canonical "near the top" threshold (README ≤60 lines, guides ≤80 lines). (5) **m7:** TC-PROC-012 enumerated header list made authoritative incl. `README.md`; OQ-5 raised for spec/plan alignment. (6) **a11y:** TC-PROC-014 gains a WCAG 1.4.1 non-color-cue + Legend step. No scope/non-goal/decision/TC-structure changes. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(populated during/after delivery — record exact command + pass/fail per TC)_ | | | |
