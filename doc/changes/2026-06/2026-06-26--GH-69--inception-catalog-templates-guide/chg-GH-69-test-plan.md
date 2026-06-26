---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-06/2026-06-26--GH-69--inception-catalog-templates-guide/chg-GH-69-test-plan.md
id: chg-GH-69-test-plan
status: Proposed
created: 2026-06-26
last_updated: 2026-06-26
owners: ["Juliusz Ćwiąkalski"]
service: documentation
labels: ["inception", "docs", "templates", "guide"]
version_impact: minor
summary: "Author the canonical inception documentation set — a single artifact catalog, a committed workspace skeleton, 17 new templates, an enriched north star, and a standalone human-executable process guide — so any project can be incepted consistently by hand."
links:
  change_spec: ./chg-GH-69-spec.md
  implementation_plan: ./chg-GH-69-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

> **PLAN STATUS NOTE**
> - `implementation_plan` (`chg-GH-69-plan.md`) now **EXISTS**. All 10 phases are ≤ 9 files (Phase 2 is the largest at 9), so NFR-8 (no review phase exceeds ~12 files) is **satisfied** (TC-INCEPT-026 confirmed; OQ-1 resolved).
> - This is a **documentation / templates / guide change**: there are **no unit / integration / E2E code tests**. Per `.ai/rules/testing-strategy.md`, "tests" here are **verification checks** — file existence, content assertions, marker/header presence, diagram counting, cross-reference integrity, and the repo's doc-distribution guard (`scripts/.tests/test-doc-distribution.sh`, which is the CI merge gate).
> - The doc-distribution guard's scan set is: `doc/guides/*.md`, `doc/templates/**/*.{md,yaml}`, and the standalone docs (`doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`, `doc/decisions/00-index.md`, `.ai/rules/README.md`). **`doc/inception/**` is NOT scanned** (per spec §12 assumption + pm-notes DEC-5 marker rule; scan-set confirmed independently by reading the guard source) — workspace READMEs get license headers for consistency but need **no** `ados_distribution` marker.

# Test Plan - Inception artifact catalog, templates, and complete process guide

## 1. Scope and Objectives

This change ships the foundation for ADOS project inception: a standalone redistributable process guide (`doc/guides/project-inception.md`), a committed `doc/inception/` workspace skeleton, 17 new templates, an enriched north-star and a rich engineering roadmap, a restructured operational `doc/overview/README.md`, and discoverability updates to the handbook and templates index. The core properties to protect are: (1) every new/changed **distributable** doc is marker-valid and install-set-consistent (the CI merge gate), (2) the guide is **self-contained** (zero references to gitignored `.ai/local/inception/*`), (3) **zero ghost references** across the four cross-referencing docs, and (4) structural completeness of the centerpiece guide (exactly 4 Mermaid diagrams; all 8 phases with 4 sub-parts each).

Because the deliverables are consumed verbatim by both humans and agents, a misplaced marker or a dangling cross-reference degrades every downstream inception — these are the regressions this plan guards against.

### 1.1 In Scope

- Existence of all 17 new templates, 4 workspace READMEs, the centerpiece guide, and the restructured/updated files — at the exact paths in the spec.
- `ados_distribution: redistributable` presence + enum-validity on every new distributable `.md`/`.yaml` under `doc/templates/**` and on `doc/guides/project-inception.md`.
- License-header coverage (copyright / MIT / source) on new files in `doc/templates/`, `doc/guides/project-inception.md`, and `doc/inception/**/*.md`.
- The repo doc-distribution guard exiting 0 (the merge gate).
- Guide content completeness: 4 Mermaid diagrams; 8 phases × 4 sub-parts; legacy-differences table for Phases 0–4; conditional matrix with 5 project-type columns; `inception-state.yaml` schema + resume behavior; workspace lifecycle; out-of-scope section.
- Self-containment (no `.ai/local/inception` references) and no ghost cross-references.
- North-star enrichment content; engineering-roadmap rich content; templates-README "Inception templates" category; handbook catalog + matrix + workspace section + forward-pointer; overview README operational classification.
- Static/diff hygiene (`git diff --check`) and `.yaml` syntax validity.

### 1.2 Out of Scope & Known Gaps

- Agent prompt changes, code, CI workflow logic, tooling behavior (explicit non-goals NG-5 / NG-6).
- `@bootstrapper` phased workflow / agent automation (GH-71), legacy deepening (GH-72), layered planning (GH-68), ADOS self-host overview content (GH-70).
- Live overview content files (`01-north-star.md`, …) and live `inception-state.yaml` / `inception-summary.md` instances (per-project outputs, not GH-69 deliverables — DEC-1/DEC-8).
- Automated unit/integration/E2E tests: N/A (docs-only repo per testing strategy; `tools/` and `scripts/` are untouched).
- No new `.tests/test-*.sh` is authored by this change; the existing `scripts/.tests/test-doc-distribution.sh` is reused as the automated oracle.

## 2. References

| Item | Path |
|------|------|
| Change specification | `./chg-GH-69-spec.md` (authoritative for AC IDs, NFRs, DM-1/DM-2, template manifest Appendix A) |
| Implementation plan | `./chg-GH-69-plan.md` |
| Testing strategy | `.ai/rules/testing-strategy.md` (docs/templates → static/diff + content checks; guard as the automated check) |
| PM notes / decisions | `./chg-GH-69-pm-notes.yaml` (DEC set mirrors spec §15; confirms `doc/inception/**` is outside the guard scan set) |
| Doc-distribution guard | `scripts/.tests/test-doc-distribution.sh` (GH-67; 5 failure modes; `.yaml` marker is top-level line per ODR-0001) |
| License-header tool | `scripts/add-header-location.sh` (`-n` / `--dry-run`; env `DRY_RUN=true`; agents must not hand-add headers — DEC-6) |
| Distribution contract | `doc/decisions/ODR-0001-classify-yaml-register-templates-redistributable.md` |
| Embedded-diagram source | `.ai/local/inception/inception-process-diagrams.md` (gitignored research; guide embeds content, never links to it — DEC-7) |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

All 23 acceptance criteria are covered. Every AC maps to at least one TC; IDs are stable.

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Guide exists + license header + `ados_distribution: redistributable` | TC-INCEPT-004, TC-INCEPT-002, TC-INCEPT-003 | Covered |
| AC-F1-2 | All 8 phases (0–7) document Activities / Anti-sycophancy / Human gate / Outputs | TC-INCEPT-006 | Covered |
| AC-F1-3 | All 4 Mermaid diagrams embedded | TC-INCEPT-005 | Covered |
| AC-F1-4 | Legacy flow differences for Phases 0–4 in a table | TC-INCEPT-007 | Covered |
| AC-F1-5 | Conditional-artifacts matrix with all 5 project-type columns | TC-INCEPT-008 | Covered |
| AC-F1-6 | Each decision-dense phase lists anti-sycophancy technique with concrete prompt text | TC-INCEPT-009 | Covered |
| AC-F1-7 | `inception-state.yaml` schema + resume behavior documented | TC-INCEPT-010 | Covered |
| AC-F1-8 | `doc/inception/` purpose / structure / lifecycle / inputs-vs-analysis split explained | TC-INCEPT-011 | Covered |
| AC-F1-9 | Out-of-scope-for-inception section listed | TC-INCEPT-012 | Covered |
| AC-F1-10 | Reader can execute inception end-to-end without external context (self-containment) | TC-INCEPT-013 | Covered |
| AC-F2-1 | Handbook defines inception artifact catalog + conditional matrix | TC-INCEPT-015 | Covered |
| AC-F3-1 | Workspace has 4 READMEs and no live instances | TC-INCEPT-014 | Covered |
| AC-F4-1 | Overview README operational file set + Recommended/Conditional/Optional (no content files) | TC-INCEPT-016 | Covered |
| AC-F5-1 | 9 engineering templates exist | TC-INCEPT-017 | Covered |
| AC-F5-2 | 3 product-discovery templates exist | TC-INCEPT-018 | Covered |
| AC-F5-3 | 3 UX templates exist | TC-INCEPT-019 | Covered |
| AC-F5-4 | 2 risk/assumption templates exist | TC-INCEPT-020 | Covered |
| AC-F5-5 | `roadmap-engineering-template.md` has per-milestone success metrics + validation approach | TC-INCEPT-022 | Covered |
| AC-F6-1 | North-star enrichment: strategic-pyramid + outcome-vs-output + JTBD + four-risk | TC-INCEPT-021 | Covered |
| AC-F8-1 | Templates README "Inception templates" category lists all 17 | TC-INCEPT-023 | Covered |
| AC-NFR-1a | Doc-distribution guard exits 0 | TC-INCEPT-001 | Covered |
| AC-NFR-3a | 100% license-header coverage on new files | TC-INCEPT-003 | Covered |
| AC-NFR-5a | 0 ghost references across handbook / overview / guide / templates README | TC-INCEPT-024 | Covered |

**AC coverage count: 23 / 23.**

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/event interfaces (spec §8.1/§8.2: N/A). Data-model coverage:

| DM ID | Element | TC ID(s) | Status |
|-------|---------|----------|--------|
| DM-1 | `inception-state.yaml` schema (documented in guide; shipped as `doc/templates/inception-state-template.yaml`) | TC-INCEPT-010, TC-INCEPT-028 | Covered |
| DM-2 | Conditional-artifact matrix (5 project-type columns), in guide + handbook mirror | TC-INCEPT-008, TC-INCEPT-015 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Doc-distribution guard exits 0 | TC-INCEPT-001 | Covered |
| NFR-2 | 100% `ados_distribution` marker presence + enum-validity on new distributable docs | TC-INCEPT-002 | Covered |
| NFR-3 | 100% license-header coverage via `scripts/add-header-location.sh` | TC-INCEPT-003 | Covered |
| NFR-4 | 0 references to `.ai/local/inception/*` in new docs | TC-INCEPT-013 | Covered |
| NFR-5 | 0 ghost cross-references | TC-INCEPT-024 | Covered |
| NFR-6 | 100% of new templates include `id`/`status`/`owners`/`summary` mirroring existing style | TC-INCEPT-025 | Covered |
| NFR-7 | Exactly 4 embedded Mermaid diagrams in the guide | TC-INCEPT-005 | Covered |
| NFR-8 | Phased so no review phase exceeds ~12 files | TC-INCEPT-026 | Covered |

**NFR coverage count: 8 / 8.**

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this is a `doc/**` / `doc/templates/**` change → **static/diff + content checks**. There is exactly one automated oracle in the repo, plus scripted verification.

- **Unit / Integration / E2E tests:** N/A — no application code; `tools/` and `scripts/` untouched. (Fallback rule: automated tests marked N/A; manual verification + `git diff --check` required.)
- **Automated oracle (merge gate):** `bash scripts/.tests/test-doc-distribution.sh` — exercises its own parser self-tests (7 `.md` + 4 `.yaml` cases) and the 5 failure modes (missing-marker, invalid-enum, redistributable-not-installed, internal-installed, derived-set drift). Required exit code 0.
- **License-header tool:** `scripts/add-header-location.sh -n doc/templates doc/guides doc/inception` (dry-run idempotency; must report nothing to do post-apply).
- **Content / structural checks:** `test -f`, `ls`, `grep -cE`, `awk`, and one-off loops — run by reviewer/runner against the deliverable paths.
- **Manual checks:** end-to-end readability of the guide (AC-F1-10 is partly a judgment call); per-phase sub-part presence confirmation.

**Locations:**
- Deliverable root: `doc/templates/`, `doc/guides/project-inception.md`, `doc/inception/`, `doc/overview/README.md`, `doc/documentation-handbook.md`, `doc/templates/README.md`.
- Guard: `scripts/.tests/test-doc-distribution.sh`. Header tool: `scripts/add-header-location.sh`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC / NFR / DM Coverage |
|-------|-------|------|-------|----------|------------------------|
| TC-INCEPT-001 | Doc-distribution guard is green (merge gate) | Happy Path | Automated | High | AC-NFR-1a, NFR-1 |
| TC-INCEPT-002 | `ados_distribution` markers present + enum-valid on new distributable docs | Happy Path | Semi-automated | High | AC-F1-1, NFR-2, DM-1/DM-2 |
| TC-INCEPT-003 | License-header coverage on new files (100%) | Happy Path | Semi-automated | High | AC-NFR-3a, NFR-3 |
| TC-INCEPT-004 | Centerpiece guide exists at exact path | Happy Path | Semi-automated | High | AC-F1-1 |
| TC-INCEPT-005 | Guide embeds exactly 4 Mermaid diagrams | Happy Path | Semi-automated | High | AC-F1-3, NFR-7 |
| TC-INCEPT-006 | Guide: 8 phases × 4 sub-parts (Activities / Anti-sycophancy / Human gate / Outputs) | Happy Path | Semi-automated | High | AC-F1-2 |
| TC-INCEPT-007 | Guide: legacy-vs-new differences table for Phases 0–4 | Happy Path | Semi-automated | Medium | AC-F1-4 |
| TC-INCEPT-008 | Guide: conditional-artifacts matrix with 5 project-type columns | Happy Path | Semi-automated | High | AC-F1-5, DM-2 |
| TC-INCEPT-009 | Guide: anti-sycophancy techniques with concrete prompt text | Happy Path | Manual | Medium | AC-F1-6 |
| TC-INCEPT-010 | Guide: `inception-state.yaml` schema + resume behavior | Happy Path | Semi-automated | High | AC-F1-7, DM-1 |
| TC-INCEPT-011 | Guide: workspace purpose / structure / lifecycle / inputs-vs-analysis split | Happy Path | Manual | Medium | AC-F1-8 |
| TC-INCEPT-012 | Guide: explicit out-of-scope-for-inception section | Happy Path | Semi-automated | Low | AC-F1-9 |
| TC-INCEPT-013 | Guide self-containment: zero `.ai/local/inception` references | Negative | Semi-automated | High | AC-F1-10, NFR-4 |
| TC-INCEPT-014 | Workspace skeleton existence + no live instances | Happy Path | Semi-automated | High | AC-F3-1 |
| TC-INCEPT-015 | Handbook: catalog + conditional matrix + workspace section + forward-pointer | Happy Path | Semi-automated | High | AC-F2-1, F-7, DM-2 |
| TC-INCEPT-016 | Overview README: operational file set + Recommended/Conditional/Optional | Happy Path | Semi-automated | Medium | AC-F4-1 |
| TC-INCEPT-017 | 9 engineering templates exist at correct paths | Happy Path | Semi-automated | High | AC-F5-1 |
| TC-INCEPT-018 | 3 product-discovery templates exist | Happy Path | Semi-automated | High | AC-F5-2 |
| TC-INCEPT-019 | 3 UX templates exist | Happy Path | Semi-automated | High | AC-F5-3 |
| TC-INCEPT-020 | 2 risk/assumption templates exist | Happy Path | Semi-automated | High | AC-F5-4 |
| TC-INCEPT-021 | North-star enrichment content (pyramid / outcome / JTBD / four-risk) | Happy Path | Manual | High | AC-F6-1 |
| TC-INCEPT-022 | Engineering roadmap: per-milestone success metrics + validation approach | Happy Path | Manual | Medium | AC-F5-5 |
| TC-INCEPT-023 | Templates README "Inception templates" category lists all 17 | Happy Path | Semi-automated | High | AC-F8-1 |
| TC-INCEPT-024 | No ghost cross-references across handbook / overview / guide / templates README | Negative | Semi-automated | High | AC-NFR-5a, NFR-5 |
| TC-INCEPT-025 | Template front-matter consistency (`id`/`status`/`owners`/`summary`) | Happy Path | Semi-automated | Medium | NFR-6 |
| TC-INCEPT-026 | Phased review sizing (no phase exceeds ~12 files) | Regression | Manual | Low | NFR-8 |
| TC-INCEPT-027 | Static/diff hygiene (`git diff --check`) | Happy Path | Automated | Medium | (testing-strategy baseline) |
| TC-INCEPT-028 | `inception-state-template.yaml` parses as valid YAML | Corner Case | Automated | High | DM-1 |

### 5.2 Scenario Details

#### TC-INCEPT-001 - Doc-distribution guard is green (merge gate)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-1a, NFR-1, DEC-5
**Test Type(s)**: Manual → Automated (CI)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @docs, @ci, @distribution

**Preconditions**:

- All new distributable docs are committed under `doc/templates/**` and `doc/guides/project-inception.md`.
- `scripts/install.sh` is invokable (guard runs a sandbox `install.sh --local` to derive the actual install set).

**Steps**:

1. From repo root, run `bash scripts/.tests/test-doc-distribution.sh`.

**Expected Outcome**:

- Exit code `0`.
- Stdout includes `(guard-doc-distribution)[OK]   get_marker() self-tests passed` and a final `(guard-doc-distribution)[OK]   no drift — <N> in-scope docs; install set matches ados_distribution markers`.
- No `::error::` annotations; none of the 5 failure modes fire (missing-marker, invalid-enum, redistributable-not-installed, internal-installed, derived-set drift).

**Notes / Clarifications**:

- This single command transitively validates NFR-2 (markers present + valid) and the install-set invariant, because modes 1–5 re-derive both the marker set and the sandbox install set. It is the **CI merge gate**.

---

#### TC-INCEPT-002 - `ados_distribution` markers present + enum-valid on new distributable docs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, NFR-2, DM-1, DM-2, DEC-5
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/**` (new `.md` + `inception-state-template.yaml`), `doc/guides/project-inception.md`
**Tags**: @docs, @distribution

**Preconditions**:

- New templates and the guide are present.

**Steps**:

1. For each new `doc/templates/**/*.{md,yaml}` and `doc/guides/project-inception.md`, assert the marker resolves to exactly `redistributable`.
2. Verify `.md` placement: marker is inside the **first** `---` frontmatter block (line 1 is `---`), e.g. `awk 'NR==1&&/^---[ \t]*$/{f=1} f&&/^ados_distribution:/{print; exit}' <file>`.
3. Verify `.yaml` placement (`inception-state-template.yaml`): marker is a **top-level line** (`^ados_distribution:`) with **no** `---` block (per ODR-0001; a `---` block would break `yaml.safe_load()`).

**Expected Outcome**:

- 100% of new distributable docs declare `ados_distribution: redistributable`.
- Enum value is one of `{redistributable, internal, project-generated}` (here always `redistributable`).

**Notes / Clarifications**:

- The guard's `get_marker()` parser enforces this; this scenario documents the per-file intent for reviewers. `doc/inception/**` READMEs are **excluded** (outside the scan set) and intentionally carry no marker.

---

#### TC-INCEPT-003 - License-header coverage on new files (100%)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-NFR-3a, NFR-3, DEC-6
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/` (new), `doc/guides/project-inception.md`, `doc/inception/**/*.md`
**Tags**: @docs, @headers

**Preconditions**:

- Headers applied via `scripts/add-header-location.sh` (agents must not hand-add — DEC-6).

**Steps**:

1. For each new file in scope, assert the three header comment lines are present: `# Copyright (c) 2025-2026 …`, `# MIT License - see LICENSE file for full terms`, and `source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/<repo-relative-path>`.
2. Confirm idempotency: run `scripts/add-header-location.sh -n doc/templates doc/guides doc/inception` (dry-run) and assert it reports **nothing to do**.

**Expected Outcome**:

- 100% of new files carry the header; dry-run is a no-op.

**Notes / Clarifications**:

- For `.md`, the header lives inside the first `---` block, immediately before the `ados_distribution` line (mirrors `north-star-template.md`). Default `add-header-location.sh` paths do **not** include `doc/templates`/`doc/inception`, so they must be passed explicitly.

---

#### TC-INCEPT-004 - Centerpiece guide exists at exact path

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/project-inception.md`
**Tags**: @docs

**Preconditions**: delivery Phase 5 complete for the guide.

**Steps**:

1. `test -f doc/guides/project-inception.md` → exit 0.

**Expected Outcome**:

- File exists and is non-empty.

---

#### TC-INCEPT-005 - Guide embeds exactly 4 Mermaid diagrams

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-3, NFR-7
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/project-inception.md`
**Tags**: @docs

**Preconditions**: guide authored.

**Steps**:

1. Count opening Mermaid fences: `n=$(grep -cE '^[[:space:]]*```mermaid[[:space:]]*$' doc/guides/project-inception.md)`.
2. Assert `n == 4`.
3. Manually confirm the four are the named diagrams: master flow, Phase 0 decision detail, new-vs-legacy, two-track convergence.

**Expected Outcome**:

- Exactly 4 fenced `` ```mermaid `` blocks; each renders (balanced closing fence).

---

#### TC-INCEPT-006 - Guide: 8 phases × 4 sub-parts

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/project-inception.md`
**Tags**: @docs

**Preconditions**: guide authored.

**Steps**:

1. Count phase sections: `grep -cE '^#+[[:space:]]*Phase[[:space:]]+[0-7]\b' doc/guides/project-inception.md` → 8.
2. Count the four sub-parts across the guide: `grep -cE '^#+[[:space:]]+(Activities|Anti-sycophancy|Human[[:space:]]+gate|Outputs)' doc/guides/project-inception.md` → ≥ 32 (4 × 8).
3. Manually confirm each of Phases 0–7 individually contains all four sub-parts (Activities, Anti-sycophancy technique, Human gate, Outputs-with-template).

**Expected Outcome**:

- 8 phase sections; each phase carries all four required sub-parts.

---

#### TC-INCEPT-007 - Guide: legacy-vs-new differences table for Phases 0–4

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F1-4, F-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/project-inception.md`
**Tags**: @docs

**Preconditions**: guide authored.

**Steps**:

1. Confirm a differences table exists: `grep -nEi 'legacy|new[[:space:]]+project|difference' doc/guides/project-inception.md` yields a table region.
2. Within that region, confirm rows reference each of Phases 0, 1, 2, 3, 4.

**Expected Outcome**:

- One consolidated table covering Phases 0–4 legacy-vs-new flow differences.

---

#### TC-INCEPT-008 - Guide: conditional-artifacts matrix with 5 project-type columns

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-5, DM-2
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/project-inception.md`
**Tags**: @docs

**Preconditions**: guide authored.

**Steps**:

1. Locate the matrix section and assert the 5 column headers are all present: "CLI/API only", "Library", "Web app new", "Web app legacy", "Business repo".

**Expected Outcome**:

- Conditional-artifacts matrix present with all 5 project-type columns (mirrors DM-2).

**Notes / Clarifications**:

- The research source (§5) uses `Web app (new)`/`Web app (legacy)` with parentheses; the guide MUST use the no-paren form (`Web app new`/`Web app legacy`) so the runbook's `grep -F` matches (plan Phase 8.7 pins these literals).

---

#### TC-INCEPT-009 - Guide: anti-sycophancy techniques with concrete prompt text

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F1-6, F-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/guides/project-inception.md`
**Tags**: @docs

**Preconditions**: guide authored.

**Steps**:

1. For each decision-dense phase (per spec §5.1(f)), confirm an "Anti-sycophancy" sub-part names the technique and includes a **concrete prompt text** block (e.g., a fenced/quoted prompt), not just a label.

**Expected Outcome**:

- Each decision-dense phase lists its technique (devil's advocate / pre-mortem / alternative comparison / unknown-unknowns / four-risk) with copy-pasteable prompt text.

---

#### TC-INCEPT-010 - Guide: `inception-state.yaml` schema + resume behavior

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-7, DM-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/project-inception.md` (schema) + `doc/templates/inception-state-template.yaml` (instance)
**Tags**: @docs, @data-model

**Preconditions**: guide + template authored.

**Steps**:

1. Confirm the guide documents the schema keys: `schema_version`, `project`, `phases[]`, `artifacts{}`, `decisions[]`, `assumptions[]`, `sessions[]`, `last_updated`.
2. Confirm the guide documents **resume behavior** (re-entering at the last incomplete phase).

**Expected Outcome**:

- Full schema documented; resume semantics explained.

---

#### TC-INCEPT-011 - Guide: workspace purpose / structure / lifecycle / inputs-vs-analysis split

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F1-8, F-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/guides/project-inception.md`
**Tags**: @docs

**Preconditions**: guide authored.

**Steps**:

1. Confirm a workspace section covers: purpose, structure, lifecycle, and the **inputs vs. analysis** split (and that templates live under `doc/templates/`, not `doc/inception/`).

**Expected Outcome**:

- Workspace guidance is complete and consistent with DEC-1.

---

#### TC-INCEPT-012 - Guide: explicit out-of-scope-for-inception section

**Scenario Type**: Happy Path
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: AC-F1-9, F-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/project-inception.md`
**Tags**: @docs

**Preconditions**: guide authored.

**Steps**:

1. `grep -nEi 'out[[:space:]]+of[[:space:]]+scope|not[[:space:]]+in[[:space:]]+scope' doc/guides/project-inception.md` → ≥ 1 hit.
2. Confirm the section enumerates what inception does **not** do.

**Expected Outcome**:

- Out-of-scope section present with enumerated items.

---

#### TC-INCEPT-013 - Guide self-containment: zero `.ai/local/inception` references

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-10, NFR-4, DEC-7
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/project-inception.md`, `doc/inception`, `doc/templates`, `doc/overview/README.md`, `doc/documentation-handbook.md`
**Tags**: @docs, @distribution

**Preconditions**: all deliverables authored.

**Steps**:

1. `grep -RIn "\.ai/local/inception" doc/guides/project-inception.md doc/inception doc/templates doc/overview/README.md doc/documentation-handbook.md` (note: `-R` recurses into directories).

**Expected Outcome**:

- Zero matches (exit code 1 from grep). The guide and all redistributable docs are fully self-contained.

**Notes / Clarifications**:

- The change **spec** itself references `.ai/local/inception/*` in its AUTHORING GUIDELINES — that is expected and is **not** in the scanned set (only deliverables are).

---

#### TC-INCEPT-014 - Workspace skeleton existence + no live instances

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, DEC-1, DEC-8
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/inception/`
**Tags**: @docs

**Preconditions**: workspace delivered.

**Steps**:

1. Assert the 4 READMEs exist: `doc/inception/README.md`, `doc/inception/inputs/README.md`, `doc/inception/meetings/README.md`, `doc/inception/analysis/README.md`.
2. Assert **no** live instances: `test ! -e doc/inception/inception-state.yaml && test ! -e doc/inception/inception-summary.md`.

**Expected Outcome**:

- 4 skeleton READMEs present; no live state/summary files (those are templates under `doc/templates/`, per DEC-8).

---

#### TC-INCEPT-015 - Handbook: catalog + conditional matrix + workspace section + forward-pointer

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-1, F-7, DM-2
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/documentation-handbook.md`
**Tags**: @docs

**Preconditions**: handbook updated.

**Steps**:

1. `grep -niE 'inception artifact catalog|conditional (matrix|artifacts)' doc/documentation-handbook.md` → ≥ 2 distinct hits.
2. `grep -niE 'doc/inception|workspace' doc/documentation-handbook.md` → workspace section referenced.
3. `grep -niE 'project-inception\.md' doc/documentation-handbook.md` → forward-pointer to the guide exists.

**Expected Outcome**:

- Catalog, conditional matrix (DM-2 mirror), workspace section, and guide forward-pointer all present; handbook marker remains `redistributable`.

---

#### TC-INCEPT-016 - Overview README: operational file set + Recommended/Conditional/Optional

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F4-1, F-4, DEC-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/overview/README.md`
**Tags**: @docs

**Preconditions**: overview README restructured.

**Steps**:

1. `grep -nE 'Recommended|Conditional|Optional' doc/overview/README.md` → all three classifications present.
2. Confirm the file set lists `01-north-star`, `02-roadmap`, `architecture-overview`, `tech-stack`, `glossary`, `opportunity-solution-tree`, `user-journeys`, `screen-inventory`, `ux-guidance`, `ubiquitous-language`.
3. Assert **no** content files were created: `test ! -e doc/overview/01-north-star.md` (and the other content files remain absent).

**Expected Outcome**:

- README-level restructure only; classification present; no live overview content files (DEC-4).

---

#### TC-INCEPT-017 - 9 engineering templates exist at correct paths

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/`
**Tags**: @docs

**Preconditions**: engineering templates delivered.

**Steps**:

1. Assert each of the 9 exists:
   `architecture-overview-template.md`, `tech-stack-template.md`, `glossary-template.md`, `roadmap-engineering-template.md`, `ubiquitous-language-template.md`, `repo-analysis-template.md`, `inception-summary-template.md`, `inception-state-template.yaml`, `material-inventory-template.md`.

**Expected Outcome**:

- All 9 present under `doc/templates/`.

---

#### TC-INCEPT-018 - 3 product-discovery templates exist

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-2, F-5, DEC-2
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/`
**Tags**: @docs

**Preconditions**: product-discovery templates delivered.

**Steps**:

1. Assert each of the 3 exists: `opportunity-solution-tree-template.md`, `project-prd-template.md`, `persona-jtbd-template.md`.

**Expected Outcome**:

- All 3 present.

---

#### TC-INCEPT-019 - 3 UX templates exist

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-3, F-5
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/`
**Tags**: @docs

**Preconditions**: UX templates delivered.

**Steps**:

1. Assert each of the 3 exists: `user-journey-template.md`, `screen-inventory-template.md`, `ux-guidance-template.md`.

**Expected Outcome**:

- All 3 present.

---

#### TC-INCEPT-020 - 2 risk/assumption templates exist

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-4, F-5
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/`
**Tags**: @docs

**Preconditions**: risk/assumption templates delivered.

**Steps**:

1. Assert each of the 2 exists: `assumption-register-template.md`, `risk-register-template.md`.

**Expected Outcome**:

- Both present.

---

#### TC-INCEPT-021 - North-star enrichment content (pyramid / outcome / JTBD / four-risk)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/templates/north-star-template.md`
**Tags**: @docs

**Preconditions**: north-star enriched (additive; existing structure preserved).

**Steps**:

1. Confirm four enrichment blocks are present:
   - strategic-pyramid context (mission → vision → strategy → outcome),
   - outcome-vs-output distinction (NSM + guardrails),
   - JTBD framing for the primary persona,
   - four-risk awareness section (value / usability / feasibility / viability).
2. Confirm existing sections (Vision, Mission, etc.) are preserved (additive only).

**Expected Outcome**:

- All four additions present; original structure intact; marker still `redistributable`.

---

#### TC-INCEPT-022 - Engineering roadmap: per-milestone success metrics + validation approach

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F5-5, F-5, DEC-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/templates/roadmap-engineering-template.md`
**Tags**: @docs

**Preconditions**: engineering roadmap authored (new, distinct from business `product-roadmap-template.md`).

**Steps**:

1. Confirm a "Current Milestone" first-class section.
2. Confirm **success metrics per milestone**.
3. Confirm a **validation approach** section.

**Expected Outcome**:

- Milestone/validation semantics present; distinct from the business narrative roadmap (DEC-3).

---

#### TC-INCEPT-023 - Templates README "Inception templates" category lists all 17

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, F-8
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/README.md`
**Tags**: @docs

**Preconditions**: templates README updated.

**Steps**:

1. `grep -niE 'inception templates' doc/templates/README.md` → category heading present.
2. For each of the 17 template filenames (Appendix A), assert it is referenced in the README.

**Expected Outcome**:

- "Inception templates" category lists all 17 templates.

---

#### TC-INCEPT-024 - No ghost cross-references across handbook / overview / guide / templates README

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-5a, NFR-5, F-7, F-8
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/documentation-handbook.md`, `doc/overview/README.md`, `doc/guides/project-inception.md`, `doc/templates/README.md`
**Tags**: @docs

**Preconditions**: all four cross-referencing docs delivered.

**Steps**:

1. A "ghost" is a reference to an artifact **GH-69 ships** (the 17 templates + `doc/guides/project-inception.md` + the standalone deliverables) that does not resolve. References to **per-project destination paths described as guidance** are EXEMPT — they are documented destinations, not shipped artifacts.
2. (a) Extract every `doc/templates/<name>` reference from the four docs and `test -f` each (shipped templates must resolve).
3. (b) The only non-template artifact GH-69 ships is `doc/guides/project-inception.md`; assert it resolves (`test -f`). Any other `doc/<path>` reference is a per-project destination described as guidance (e.g., `doc/overview/*.md` instances, `doc/inception/*.yaml` instances, `doc/documentation-profile.md`, `doc/business/*`, `doc/contracts/*`, `doc/decisions/*`, `doc/meetings/*`, `doc/spec/*`, `doc/guides/dev-setup.md`) and is exempt by definition — it is not a GH-69-shipped artifact.

**Expected Outcome**:

- 0 ghost references (shipped-artifact references all resolve; per-project destinations are exempt).

**Notes / Clarifications**:

- Concrete two-part scripted approach is given in the Verification Runbook (§7.1 step 15): (a) `test -f` each `doc/templates/<name>` reference; (b) `test -f doc/guides/project-inception.md` (the only non-template shipped artifact). All other `doc/<path>` references are per-project destinations documented as guidance and are exempt by the §24 ghost definition — enumerating them as exempt prefixes is fragile and unnecessary, because a ghost is defined strictly as a reference to a GH-69-shipped artifact. The guide is required to document per-project destinations (`doc/inception/inception-state.yaml`, `doc/inception/analysis/*.md`, `doc/overview/*.md`) that are never committed to this repo — these are not ghosts.

---

#### TC-INCEPT-025 - Template front-matter consistency (`id`/`status`/`owners`/`summary`)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-6, F-5
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/` (17 new templates)
**Tags**: @docs

**Preconditions**: templates authored.

**Steps**:

1. For each of the 17 new templates, assert the frontmatter includes `id`, `status`, `owners`, `summary` (mirroring `north-star-template.md` style). For the `.yaml` template, assert the equivalent identifying keys are consistent with existing YAML register templates.

**Expected Outcome**:

- 100% of new templates carry consistent frontmatter.

---

#### TC-INCEPT-026 - Phased review sizing (no phase exceeds ~12 files)

**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: NFR-8, RSK-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/changes/2026-06/2026-06-26--GH-69--inception-catalog-templates-guide/chg-GH-69-plan.md`
**Tags**: @docs, @process

**Preconditions**: implementation plan authored.

**Steps**:

1. Inspect the plan's delivery phases; confirm each reviewable unit stays within the ~12-file guideline.

**Expected Outcome**:

- Delivery is phased by area (workspace → templates → enrichments → guide → handbook/index) so no single review phase exceeds ~12 files.

**Notes / Clarifications**:

- Confirmed — all 10 phases are ≤ 9 files (Phase 2 is the largest at 9); NFR-8 (no review phase exceeds ~12 files) is satisfied. (Previously TODO until the plan existed; OQ-1 resolved.)

---

#### TC-INCEPT-027 - Static/diff hygiene (`git diff --check`)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: (testing-strategy baseline)
**Test Type(s)**: Manual
**Automation Level**: Automated
**Target Layer / Location**: repo working tree
**Tags**: @docs

**Preconditions**: changes staged/committed on the branch.

**Steps**:

1. `git diff --check` (and `git diff --cached --check` if staged) → no whitespace/conflict-marker errors.

**Expected Outcome**:

- Clean diff; no trailing whitespace, no conflict markers.

---

#### TC-INCEPT-028 - `inception-state-template.yaml` parses as valid YAML

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-1, AC-F5-1
**Test Type(s)**: Manual
**Automation Level**: Automated
**Target Layer / Location**: `doc/templates/inception-state-template.yaml`
**Tags**: @docs, @data-model

**Preconditions**: template authored.

**Steps**:

1. Validate YAML parse: `python3 -c "import yaml,sys; yaml.safe_load(open('doc/templates/inception-state-template.yaml')); print('ok')"`.
2. Confirm the `ados_distribution` line being top-level (no `---` block) does **not** break `safe_load` (this is the ODR-0001 constraint the guard's mode-5 + this check protect).

**Expected Outcome**:

- Prints `ok`; loads as a single YAML document with the documented schema keys.

## 6. Environments and Test Data

- **Environment:** local dev checkout on the change branch (`docs/GH-69/inception-catalog-templates-guide`, per pm-notes). The CI environment runs `test-doc-distribution.sh` identically (bash ≥ 4 required — the guard self-checks this).
- **Test data:** none. Templates and the guide contain **placeholders and structural guidance only** (spec §21/§20: no real/personal data). No fixtures, no DB.
- **Isolation:** the guard runs `install.sh --local` in a throwaway sandbox (`mktemp -d`); it never mutates the working tree. All other checks are read-only (`test`, `grep`, `awk`).
- **Cleanup:** none required — no temp files are produced by the verification checks.

## 7. Automation Plan and Implementation Mapping

| TC ID | Implementation Status | Execution Command / Location | Mocking |
|-------|-----------------------|------------------------------|---------|
| TC-INCEPT-001 | Existing – No Change | `bash scripts/.tests/test-doc-distribution.sh` (CI merge gate) | None (sandbox install) |
| TC-INCEPT-002 | To Implement (review check) | `awk`/`grep` per file → see Runbook §7.1 | None |
| TC-INCEPT-003 | To Implement (review check) | `scripts/add-header-location.sh -n doc/templates doc/guides doc/inception` + `grep` | None |
| TC-INCEPT-004 | To Implement | `test -f doc/guides/project-inception.md` | None |
| TC-INCEPT-005 | To Implement | `grep -cE '^\s*```mermaid\s*$'` | None |
| TC-INCEPT-006 | To Implement | `grep -cE` phase + sub-parts | None |
| TC-INCEPT-007 | To Implement | `grep -nEi 'legacy\|difference'` | None |
| TC-INCEPT-008 | To Implement | column-header `grep` | None |
| TC-INCEPT-009 | Manual Only | reviewer reads each phase | N/A |
| TC-INCEPT-010 | To Implement | schema-key `grep` | None |
| TC-INCEPT-011 | Manual Only | reviewer reads workspace section | N/A |
| TC-INCEPT-012 | To Implement | `grep -nEi 'out of scope'` | None |
| TC-INCEPT-013 | To Implement | `grep -RIn "\.ai/local/inception" <set>` | None |
| TC-INCEPT-014 | To Implement | `test -f` ×4 + `test ! -e` ×2 | None |
| TC-INCEPT-015 | To Implement | `grep` catalog/matrix/workspace/pointer | None |
| TC-INCEPT-016 | To Implement | `grep` classifications + `test ! -e` content files | None |
| TC-INCEPT-017 | To Implement | `test -f` ×9 | None |
| TC-INCEPT-018 | To Implement | `test -f` ×3 | None |
| TC-INCEPT-019 | To Implement | `test -f` ×3 | None |
| TC-INCEPT-020 | To Implement | `test -f` ×2 | None |
| TC-INCEPT-021 | Manual Only | reviewer reads enrichment blocks | N/A |
| TC-INCEPT-022 | Manual Only | reviewer reads milestone/validation | N/A |
| TC-INCEPT-023 | To Implement | `grep` + per-template presence loop | None |
| TC-INCEPT-024 | To Implement | ghost-ref script (Runbook §7.1) | None |
| TC-INCEPT-025 | To Implement | frontmatter `grep` loop | None |
| TC-INCEPT-026 | Manual Only (confirmed) | review `chg-GH-69-plan.md` phases | N/A |
| TC-INCEPT-027 | Existing – No Change | `git diff --check` | None |
| TC-INCEPT-028 | To Implement | `python3 -c "yaml.safe_load(...)"` | None |

### 7.1 Verification Runbook (single sequential block)

A reviewer/runner executes the following from the repo root, in order. The block exits non-zero on the first failing assertion (`set -euo pipefail`). It is safe to run repeatedly (all checks are read-only; only the guard creates a sandbox under `mktemp`).

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

GUIDE="doc/guides/project-inception.md"
declare -a NEW_TEMPLATES=(
  doc/templates/architecture-overview-template.md
  doc/templates/tech-stack-template.md
  doc/templates/glossary-template.md
  doc/templates/roadmap-engineering-template.md
  doc/templates/ubiquitous-language-template.md
  doc/templates/repo-analysis-template.md
  doc/templates/inception-summary-template.md
  doc/templates/inception-state-template.yaml
  doc/templates/material-inventory-template.md
  doc/templates/opportunity-solution-tree-template.md
  doc/templates/project-prd-template.md
  doc/templates/persona-jtbd-template.md
  doc/templates/user-journey-template.md
  doc/templates/screen-inventory-template.md
  doc/templates/ux-guidance-template.md
  doc/templates/assumption-register-template.md
  doc/templates/risk-register-template.md
)
declare -a WORKSPACE_READMES=(
  doc/inception/README.md
  doc/inception/inputs/README.md
  doc/inception/meetings/README.md
  doc/inception/analysis/README.md
)
declare -a XREF_DOCS=(
  doc/documentation-handbook.md
  doc/overview/README.md
  doc/guides/project-inception.md
  doc/templates/README.md
)

echo "== 1. static/diff hygiene =="
git diff --check && git diff --cached --check
echo "   OK"

echo "== 2. existence: 17 templates + 4 workspace READMEs + guide + updated files =="
for f in "${NEW_TEMPLATES[@]}" "${WORKSPACE_READMES[@]}" "$GUIDE" \
         doc/overview/README.md doc/documentation-handbook.md doc/templates/README.md \
         doc/templates/north-star-template.md; do
  test -f "$f" || { echo "   MISSING: $f"; exit 1; }
done
echo "   OK (17 templates + 4 workspace READMEs + guide + updated files exist)"

echo "== 3. workspace has NO live instances =="
test ! -e doc/inception/inception-state.yaml
test ! -e doc/inception/inception-summary.md
echo "   OK"

echo "== 4. overview restructure: no live content files created =="
test ! -e doc/overview/01-north-star.md
grep -nE 'Recommended|Conditional|Optional' doc/overview/README.md >/dev/null
echo "   OK"

echo "== 5. guide: exactly 4 Mermaid diagrams =="
n=$(grep -cE '^[[:space:]]*```mermaid[[:space:]]*$' "$GUIDE")
[ "$n" -eq 4 ] || { echo "   expected 4 mermaid blocks, got $n"; exit 1; }
echo "   OK ($n diagrams)"

echo "== 6. guide: 8 phases + >=32 sub-parts =="
ph=$(grep -cE '^#+[[:space:]]*Phase[[:space:]]+[0-7]\b' "$GUIDE")
[ "$ph" -eq 8 ] || { echo "   expected 8 phase sections, got $ph"; exit 1; }
sp=$(grep -cE '^#+[[:space:]]+(Activities|Anti-sycophancy|Human[[:space:]]+gate|Outputs)' "$GUIDE")
[ "$sp" -ge 32 ] || { echo "   expected >=32 sub-parts (4x8), got $sp"; exit 1; }
echo "   OK ($ph phases, $sp sub-parts)"

echo "== 7. guide: legacy differences (Phases 0-4) + conditional matrix (5 cols) =="
grep -nEi 'legacy|new[[:space:]]+(project|flow)|difference' "$GUIDE" >/dev/null
for col in 'CLI/API only' 'Library' 'Web app new' 'Web app legacy' 'Business repo'; do
  grep -F "$col" "$GUIDE" >/dev/null || { echo "   missing matrix column: $col"; exit 1; }
done
echo "   OK"

echo "== 8. guide: inception-state schema + resume + out-of-scope =="
for k in schema_version project phases artifacts decisions assumptions sessions last_updated; do
  grep -F "$k" "$GUIDE" >/dev/null || { echo "   guide missing schema key: $k"; exit 1; }
done
grep -niE 'resume|re-?enter|re-?start' "$GUIDE" >/dev/null
grep -niE 'out[[:space:]]+of[[:space:]]+scope' "$GUIDE" >/dev/null
echo "   OK"

echo "== 9. self-containment: zero .ai/local/inception refs in deliverables =="
if grep -RIn "\.ai/local/inception" doc/guides/project-inception.md doc/inception doc/templates \
                                       doc/overview/README.md doc/documentation-handbook.md; then
  echo "   FAIL: self-containment violation"; exit 1
fi
echo "   OK (0 refs)"

echo "== 10. ados_distribution marker present + valid on new distributable docs =="
for f in "${NEW_TEMPLATES[@]}" "$GUIDE"; do
  case "$f" in
    *.md)
      v=$(awk 'NR==1&&/^---[ \t]*$/{f=1;next} f&&/^---[ \t]*$/{exit} f&&/^ados_distribution:[ \t]*.+/{s=$0;sub(/^ados_distribution:[ \t]*/,"",s);sub(/[ \t]+$/,"",s);gsub(/^['"'"'"]|['"'"'"]$/,"",s);print s;exit}' "$f")
      ;;
    *.yaml|*.yml)
      v=$(awk '/^ados_distribution:[ \t]*.+/{s=$0;sub(/^ados_distribution:[ \t]*/,"",s);sub(/[ \t]+$/,"",s);gsub(/^['"'"'"]|['"'"'"]$/,"",s);print s}' "$f")
      ;;
  esac
  [ "$v" = "redistributable" ] || { echo "   marker FAIL ($f): '$v'"; exit 1; }
done
echo "   OK ($((${#NEW_TEMPLATES[@]}+1)) docs marker-valid)"

echo "== 11. license-header coverage on new .md files =="
# Headers are added only to .md files by add-header-location.sh; .yaml register
# templates use the top-level ados_distribution marker (no header, no --- block).
for f in "${NEW_TEMPLATES[@]}" "${WORKSPACE_READMES[@]}" "$GUIDE"; do
  case "$f" in *.md) ;; *) continue;; esac
  head -10 "$f" | grep -q 'Copyright (c) 2025-2026 Juliusz' || { echo "   header MISSING: $f"; exit 1; }
  head -10 "$f" | grep -q 'MIT License' || { echo "   MIT line MISSING: $f"; exit 1; }
done
echo "   OK"

echo "== 12. add-header-location idempotency (dry-run = nothing to do) =="
scripts/add-header-location.sh -n doc/templates doc/guides doc/inception >/dev/null
echo "   OK"

echo "== 13. templates README lists all 17 under 'Inception templates' =="
grep -niE 'inception templates' doc/templates/README.md >/dev/null
for t in "${NEW_TEMPLATES[@]}"; do
  grep -F "$(basename "$t")" doc/templates/README.md >/dev/null || { echo "   README missing: $(basename "$t")"; exit 1; }
done
echo "   OK"

echo "== 14. handbook: catalog + matrix + workspace + forward-pointer =="
grep -niE 'inception artifact catalog|conditional (matrix|artifacts)' doc/documentation-handbook.md >/dev/null
grep -niE 'doc/inception|workspace' doc/documentation-handbook.md >/dev/null
grep -F 'project-inception.md' doc/documentation-handbook.md >/dev/null
echo "   OK"

echo "== 15. ghost-reference check across the 4 cross-referencing docs =="
# A "ghost" (per §24) = a reference to an artifact GH-69 SHIPS that does NOT
# resolve. GH-69 ships: the 17 templates (doc/templates/*) and the guide
# (doc/guides/project-inception.md). Per-project destination paths the docs
# describe as guidance (doc/overview/*.md instances, doc/inception/*.yaml
# instances, doc/documentation-profile.md, doc/business/*, doc/contracts/*,
# doc/decisions/*, doc/meetings/*, doc/spec/*, doc/guides/dev-setup.md, etc.)
# are NOT shipped artifacts — they are documented destinations and are exempt.
for d in "${XREF_DOCS[@]}"; do
  # (a) shipped templates: every doc/templates/<name> reference must resolve
  grep -ohE 'doc/templates/[A-Za-z0-9._-]+' "$d" | sort -u | while read -r ref; do
    test -f "$ref" || { echo "   GHOST (shipped template) in $d -> $ref"; exit 1; }
  done || exit 1
done
# (b) shipped guide: the one non-template artifact GH-69 ships must exist
test -f doc/guides/project-inception.md \
  || { echo "   GHOST (shipped guide) -> doc/guides/project-inception.md"; exit 1; }
echo "   OK (0 ghost references — shipped templates + guide resolve; per-project destinations exempt per §24)"

echo "== 16. inception-state-template.yaml parses as YAML (top-level marker must not break safe_load) =="
python3 -c "import yaml; yaml.safe_load(open('doc/templates/inception-state-template.yaml')); print('   OK (yaml valid)')"

echo "== 17. doc-distribution guard (CI merge gate) =="
bash scripts/.tests/test-doc-distribution.sh
echo "   OK (guard green)"

echo
echo "ALL VERIFICATION CHECKS PASSED"
```

**Runbook notes:**

- **Tool availability:** requires `bash>=4`, `git`, `grep`, `awk`, `python3` (PyYAML) — all already needed by the guard and `install.sh`.
- **Ordering rationale:** cheap structural checks first; the heavyweight guard + sandbox install last.
- **Reviewer-only (manual) steps** not in the block: AC-F1-6 anti-sycophancy prompt concreteness (TC-INCEPT-009), AC-F1-8 workspace narrative (TC-INCEPT-011), AC-F6-1 north-star enrichment blocks (TC-INCEPT-021), AC-F5-5 roadmap richness (TC-INCEPT-022), and end-to-end readability (AC-F1-10 qualitative half).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Mitigation |
|------|------------|
| Large change (~23 files) → review fatigue / dropped deliverables (RSK-1) | Phased delivery by area; existence checks (TC-014/017–020) catch dropped files; NFR-8 (TC-INCEPT-026) sizes phases. |
| Ghost references (RSK-2) | TC-INCEPT-024 scripted cross-check + Runbook §15. |
| Guide-vs-handbook/template consistency drift (RSK-3) | Single source = the guide; handbook mirrors the matrix (TC-015/008); templates README mirrors the list (TC-023). |
| Doc-distribution guard failure from misplaced `.yaml` marker (RSK-4) | TC-INCEPT-002 asserts top-level placement; TC-INCEPT-028 asserts `safe_load` still works; TC-INCEPT-001 is the gate. |
| `persona-jtbd` overlap with business templates (RSK-5) | New template states the relationship (DEC-2); templates README clarifies both categories (TC-023). |

### 8.2 Assumptions

- The two research notes (`.ai/local/inception/full-inception-bootstrap-process.md`, `inception-process-diagrams.md`) are accurate; the guide embeds their content (spec §12).
- `doc/templates/**` installs recursively via `install.sh` without per-file allowlisting (GH-67) — so a valid marker is sufficient.
- `scripts/add-header-location.sh` applies headers to explicit path args (its `DEFAULT_PATHS` exclude `doc/templates`/`doc/inception`).
- The doc-distribution guard's scan set and `get_marker()` parser remain as read at test-plan time.

### 8.3 Open Questions

| # | Question | Blocking? | Owner |
|---|----------|-----------|-------|
| OQ-1 | ~~Implementation plan (`chg-GH-69-plan.md`) not yet authored~~ — **RESOLVED**: the plan now exists; all 10 phases are ≤ 9 files (Phase 2 largest at 9), so NFR-8 is satisfied and TC-INCEPT-026 is confirmed. | No | — |
| OQ-2 | ~~Exact list of "decision-dense" phases for AC-F1-6 (TC-INCEPT-009)~~ — **RESOLVED**: the decision-dense phases are 1, 2, 3, 4 (per research §6); phases 0/5/6/7 carry `Anti-sycophancy: None (intake/framework-integration/readiness-check/handoff phase)` (plan Phase 8.4 mandates the heading + N/A body for all 8 phases). | No | — |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-26 | Juliusz Ćwiąkalski | Initial test plan: 28 TCs; 23/23 ACs covered; 8/8 NFRs; DM-1/DM-2 covered; includes single-block Verification Runbook. Implementation plan referenced as pending (OQ-1). |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(all)_ | _pending delivery_ | — | Execute after delivery Phase 5; record command + result here. TC-INCEPT-001 result is the merge-gate evidence. |
