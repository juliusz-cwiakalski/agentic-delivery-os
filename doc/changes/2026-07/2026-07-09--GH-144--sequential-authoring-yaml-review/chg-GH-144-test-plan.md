---
ados_distribution: project-generated
id: chg-GH-144-test-plan
status: Proposed
created: 2026-07-09
last_updated: 2026-07-09
owners: ["engineering"]
service: agentic-delivery-os
labels: ["process", "agents"]
version_impact: patch
summary: "Test plan — strictly sequential artifact authoring (spec→test-plan→plan, reopen-on-gap) + consolidated single-YAML review output (local + remote)"
links:
  change_spec: ./chg-GH-144-spec.md
  implementation_plan: ./chg-GH-144-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - GH-144

> **SOURCE OF TRUTH:** `chg-GH-144-spec.md` (AC-01..AC-08, F-1/F-2/F-3, NFR-1..9,
> DM-1..DM-4). Every TC ID, AC mapping, and verification value below is derived
> from that spec — nothing is invented. **Testing standard:**
> `.ai/rules/testing-strategy.md` (docs/template/agent changes → static/diff +
> content checks; automated tests N/A → manual verification + `git diff --check`).

## 1. Scope and Objectives

GH-144 changes **agent prompts and a guide** (no runtime code). It (a) makes
artifact authoring strictly sequential with a reopen-on-gap loop, (b) collapses
the reviewer's dual JSON+MD review output into a single YAML, and (c) adds a
pre-DoR cross-check safety net + the "canonical DoR trap" anti-pattern.

Because there is **no executable code**, most verification is **structural**
(presence/absence of specific language in `.opencode/agent/**`,
`.opencode/command/**`, `doc/guides/change-lifecycle.md`), two **CI** gates
(plugin freshness, doc-distribution), and **manual** review of behavior. Per
`.ai/rules/testing-strategy.md` §"Fallback rules", automated unit tests are
**N/A** for this doc/agent-only change; manual verification + `git diff --check`
are required. A deterministic `ados check-readiness` CLI is explicitly out of
scope (NG-4) — the cross-check here is an AI-driven procedure, not a new tool.

### 1.1 In Scope

- `.opencode/agent/pm.md` step-4 sequencing language (AC-01).
- `doc/guides/change-lifecycle.md` reopen-on-gap loop + mermaid edges + reopen fencing (AC-02).
- `.opencode/agent/test-plan-writer.md` and `.opencode/agent/plan-writer.md` artifact-consumption language (AC-03).
- `.opencode/agent/reviewer.md` single-YAML output (local + remote), `state_files`, re-review self-load (AC-04, AC-05, AC-06).
- `.opencode/command/review-remote.md` path references (AC-05).
- `doc/guides/change-lifecycle.md` "canonical DoR trap" + pre-DoR cross-check (AC-07).
- `.ados-claude/` regeneration + plugin-freshness + doc-distribution CI gates (AC-08).

### 1.2 Out of Scope & Known Gaps

- Migrating historical review artifacts (`findings-iter-*.json`, `review-iter-*.md`, `review-draft.md`, `findings.json`) — NG-1; left as-is.
- `@readiness-reviewer`'s `readiness-iter-<N>.md` format — NG-2.
- Which model authors artifacts — NG-3 (#115).
- A new deterministic CLI for the cross-check — NG-4 (#49).
- **Testability gap (RSK-5):** most ACs are behavioral agent-capability claims
  untestable in CI. Structural checks verify the *prompt/guide contains the
  required language*; the actual agent behavior (e.g., truly waiting before
  delegating) is verified manually + by PR review + the requested red-team
  review (`chg-GH-144-pm-notes.yaml`). This is recorded honestly per TC.

## 2. References

| Ref | Path |
|-----|------|
| Change spec (authoritative) | `./chg-GH-144-spec.md` |
| PM analysis | `./chg-GH-144-pm-notes.yaml` |
| Testing strategy | `.ai/rules/testing-strategy.md` |
| Bash rules (if any test script added) | `.ai/rules/bash.md` |
| Plugin builder (CI) | `scripts/build-claude-plugin.sh` |
| Doc-distribution guard (CI) | `scripts/.tests/test-doc-distribution.sh` |
| Structural reference (house style) | `doc/changes/2026-06/2026-06-27--GH-57--readiness-gate/` |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| AC-01 | pm.md step 4 strictly sequential + wait-for-completion + each-builds-on-previous; no parallel-delegation | TC-SEQ-001, TC-SEQ-002, TC-SEQ-003 | Pending |
| AC-02 | change-lifecycle.md documents reopen-on-gap loop; fenced to artifact-creation phases; never delivery/dor_check | TC-SEQ-004, TC-SEQ-005, TC-SEQ-006 | Pending |
| AC-03 | test-plan-writer consumes completed spec; plan-writer consumes completed spec + test plan (first actions) | TC-SEQ-007, TC-SEQ-008 | Pending |
| AC-04 | reviewer local mode writes single `review-iter-<N>.yaml`; state_files lists only YAML; schema matches DM-1 | TC-YAML-001, TC-YAML-002, TC-YAML-003 | Pending |
| AC-05 | reviewer remote mode writes single `review-draft.yaml` (same schema); other remote artifacts unchanged | TC-YAML-004, TC-YAML-005, TC-YAML-008 | Pending |
| AC-06 | re-review self-loads the YAML (not JSON) for dedup, both modes | TC-YAML-006, TC-YAML-007 | Pending |
| AC-07 | change-lifecycle.md names "canonical DoR trap" + documents pre-DoR cross-check as safety net (not gate) | TC-XCHECK-001, TC-XCHECK-002, TC-XCHECK-003 | Pending |
| AC-08 | `.ados-claude/` regenerated; plugin-freshness + doc-distribution CI guards green | TC-CI-001, TC-CI-002 | Pending |

### 3.2 Interface Coverage (DM-#)

| DM ID | Element | TC ID(s) |
|-------|---------|----------|
| DM-1 | Consolidated review YAML schema (keys + `version: 1`) | TC-YAML-003, TC-YAML-006 |
| DM-2 | Local path `<change_folder>/code-review/review-iter-<N>.yaml` | TC-YAML-001, TC-YAML-002 |
| DM-3 | Remote path `tmp/code-review/<branch>/review-draft.yaml`; other remote artifacts unchanged | TC-YAML-004, TC-YAML-005 |
| DM-4 | Reopen target fenced to specification/test_planning/delivery_planning | TC-SEQ-006 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) |
|--------|-------------|----------|
| NFR-1 | Sequencing explicitness (phrases + 0 parallel bullets) | TC-SEQ-001, TC-SEQ-002 |
| NFR-2 | Artifact consumption explicit (both authors, first action) | TC-SEQ-007, TC-SEQ-008 |
| NFR-3 | Plugin byte-freshness (source + generated committed together) | TC-CI-001 |
| NFR-4 | Schema parity local↔remote (0 divergence) | TC-YAML-006, TC-YAML-007 |
| NFR-5 | No orphan review files (exactly one YAML per mode; 0 JSON/MD review files) | TC-YAML-001, TC-YAML-002 |
| NFR-6 | Backward compatibility (historical untouched; readiness-reviewer unchanged) | TC-YAML-009 |
| NFR-7 | Doc-distribution guard (`change-lifecycle.md` keeps `redistributable`) | TC-CI-002 |
| NFR-8 | Prompt-size discipline (lean, no prose duplication) | TC-SEQ-009 |
| NFR-9 | Safety net, not gate replacement (`dor_check` authoritative) | TC-XCHECK-003 |

## 4. Test Types and Layers

| Layer | Applies? | How |
|-------|----------|-----|
| Unit / Integration / E2E (executable) | **N/A** | No runtime code in this change (docs/agent-only). Per testing-strategy §Fallback rules. |
| Static/diff | **Yes (always)** | `git diff --check` (TC-CI-003); changed-file path/naming review. |
| Content checks | **Yes** | Traceability review vs spec/AC; markdown rendering; YAML syntax check on any sample YAML (TC-YAML-003). |
| **Structural (grep/presence)** | **Yes — primary** | Reproducible `rg` checks for required (and forbidden) language in agent prompts + guide. May be run manually or wrapped in a test script; needles are the contract. |
| **CI** | **Yes** | Plugin freshness (`scripts/build-claude-plugin.sh`) + doc-distribution guard (`scripts/.tests/test-doc-distribution.sh`). |
| Manual | **Yes** | Behavioral capability claims (RSK-5) + lean-prompt judgment (NFR-8). |

**Needle policy (from house style):** if a prompt/guide is restructured, needle
phrases may be updated, but the *contract* each TC asserts must remain.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Priority | AC Coverage |
|-------|-------|------|----------|-------------|
| TC-SEQ-001 | pm.md: strictly-sequential + wait-for-completion + each-builds-on-previous present | Structural | High | AC-01 |
| TC-SEQ-002 | pm.md: no parallel-delegation phrasing (absence) | Structural | High | AC-01 |
| TC-SEQ-003 | pm.md step 4 reads as ordered chain (not independent bullets) | Manual | High | AC-01 |
| TC-SEQ-004 | lifecycle: reopen-on-gap loop documented (both reopen edges) | Structural | High | AC-02 |
| TC-SEQ-005 | lifecycle: mermaid feedback-loop edges reflect reopen-on-gap | Structural | Medium | AC-02 |
| TC-SEQ-006 | lifecycle: reopen target fenced to artifact-creation phases (absence) | Structural | High | AC-02 |
| TC-SEQ-007 | test-plan-writer.md: reads completed spec, derives all values | Structural | High | AC-03 |
| TC-SEQ-008 | plan-writer.md: reads completed spec AND test plan, derives all values | Structural | High | AC-03 |
| TC-SEQ-009 | modified prompts stay lean; no prose duplication | Manual | Medium | NFR-8 |
| TC-YAML-001 | reviewer.md: local writes single `review-iter-<N>.yaml`; 0 JSON/MD review files | Structural | High | AC-04 |
| TC-YAML-002 | reviewer.md: `state_files` table lists only the YAML (local mode) | Structural | High | AC-04 |
| TC-YAML-003 | local review YAML matches DM-1 schema (all keys; valid YAML) | Manual | High | AC-04 |
| TC-YAML-004 | reviewer.md: remote writes single `review-draft.yaml` (same schema) | Structural | High | AC-05 |
| TC-YAML-005 | reviewer.md: other remote artifacts unchanged (absence/presence) | Structural | Medium | AC-05 |
| TC-YAML-006 | schema parity: local + remote share one DM-1 schema | Manual/Structural | High | AC-05, AC-06 |
| TC-YAML-007 | re-review self-loads the YAML `findings[]` (not JSON), both modes | Structural | High | AC-06 |
| TC-YAML-008 | review-remote.md: references `review-draft.yaml`; no removed-file refs | Structural | Medium | AC-05 |
| TC-YAML-009 | backward compat: no migration/deletion; readiness-reviewer.md unchanged | Structural/Manual | Medium | NFR-6 |
| TC-XCHECK-001 | lifecycle: names the "canonical DoR trap" anti-pattern | Structural | High | AC-07 |
| TC-XCHECK-002 | lifecycle: documents pre-DoR cross-check (AC↔TC, file inventory, shared values) | Structural | High | AC-07 |
| TC-XCHECK-003 | cross-check framed as safety net; `dor_check` remains authoritative | Structural | High | AC-07 |
| TC-CI-001 | `.ados-claude/` regenerated; plugin freshness green | CI | High | AC-08 |
| TC-CI-002 | doc-distribution guard green (`change-lifecycle.md` keeps `redistributable`) | CI | High | AC-08 |
| TC-CI-003 | `git diff --check` clean (whitespace/conflict) | CI | Medium | (static layer) |

### 5.2 Scenario Details

---

#### TC-SEQ-001 - pm.md: strictly-sequential + wait-for-completion + each-builds-on-previous

**Scenario Type**: Happy Path (structural presence)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-01, NFR-1
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/pm.md` (step 4)
**Tags**: @agent-prompt

**Preconditions**:
- `.opencode/agent/pm.md` delivered (via `@toolsmith`).

**Steps**:
1. `rg -ni -e 'strictly sequential' -e 'wait for completion' -e 'each build' .opencode/agent/pm.md`
   (Needles per NFR-1: "strictly sequential", "wait for completion before delegating next", "each builds on the previous output".)

**Expected Outcome**:
- All three required phrases present in pm.md step 4. (Needles may be adjusted if reworded; the contract — explicit sequential + wait + builds-on-previous — must hold.)

---

#### TC-SEQ-002 - pm.md: no parallel-delegation phrasing (absence)

**Scenario Type**: Negative (structural absence)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-01, NFR-1
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/pm.md` (step 4)
**Tags**: @agent-prompt

**Preconditions**:
- pm.md step 4 delivered.

**Steps**:
1. `rg -ni -e 'in parallel' -e 'parallel' -e 'simultaneously' .opencode/agent/pm.md`
   - Review any hit contextually; confirm none instructs/permits parallel delegation of the three phases.

**Expected Outcome**:
- 0 parallel-delegation phrasing. Any literal "parallel" occurrence must be a must-not/forbidding statement (e.g., "never parallel"), not an instruction to parallelize.

---

#### TC-SEQ-003 - pm.md step 4 reads as ordered chain (not independent bullets)

**Scenario Type**: Regression (manual judgment)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-01
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/agent/pm.md`
**Tags**: @agent-prompt

**Preconditions**:
- pm.md step 4 delivered.

**Steps**:
1. Read pm.md step 4 in full.
2. Confirm the three delegations appear as an explicit ordered chain (spec → test-plan → plan), each gated on the predecessor's completion, not as three independent co-equal bullets.

**Expected Outcome**:
- A capable agent reading step 4 cannot reasonably fire the three phases in parallel; the ordering + gating is unambiguous.

---

#### TC-SEQ-004 - lifecycle: reopen-on-gap loop documented (both reopen edges)

**Scenario Type**: Happy Path (structural presence)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-02, DM-4
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/change-lifecycle.md`
**Tags**: @guide

**Preconditions**:
- `doc/guides/change-lifecycle.md` updated.

**Steps**:
1. `rg -ni -e 'reopen' .opencode/../doc/guides/change-lifecycle.md` (i.e., `rg -ni 'reopen' doc/guides/change-lifecycle.md`).
2. Confirm both edges are documented:
   - test_planning finding a spec gap → reopens **specification** (phase 2).
   - delivery_planning finding a spec/test-plan gap → reopens **specification** or **test_planning**.

**Expected Outcome**:
- Both reopen edges present and described (the "reopen-on-gap loop" by name or equivalent).

---

#### TC-SEQ-005 - lifecycle: mermaid feedback-loop edges reflect reopen-on-gap

**Scenario Type**: Regression (structural presence)
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, AC-02
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/change-lifecycle.md` (mermaid block)
**Tags**: @guide, @diagram

**Preconditions**:
- lifecycle guide updated.

**Steps**:
1. Locate the mermaid diagram block in change-lifecycle.md.
2. `rg -ni -e 'reopen' -e 'test_planning' -e 'specification' doc/guides/change-lifecycle.md` within the diagram region.

**Expected Outcome**:
- The diagram's feedback-loop edges include reopen paths from test_planning→specification and delivery_planning→(specification|test_planning). (Existing A→B→C→D→E shape preserved; reopen edges added.)

---

#### TC-SEQ-006 - lifecycle: reopen target fenced to artifact-creation phases (absence)

**Scenario Type**: Negative (structural absence / fencing)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-02, DM-4
**Test Type(s)**: Manual (structural grep + judgment)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/change-lifecycle.md`
**Tags**: @guide

**Preconditions**:
- lifecycle guide updated.

**Steps**:
1. Read the reopen-on-gap section.
2. Confirm the documented reopen target set is **only** `specification` | `test_planning` | `delivery_planning`.
3. `rg -ni -e 'delivery' -e 'dor_check' -e 'review_fix' doc/guides/change-lifecycle.md` and verify no reopen edge routes to phase 5 (`dor_check`) or later (DM-4; mirrors GH-57 F-4 fencing earlier in the chain).

**Expected Outcome**:
- Reopen target never `delivery` or `dor_check`; explicitly limited to the three artifact-creation phases.

---

#### TC-SEQ-007 - test-plan-writer.md: reads completed spec, derives all values

**Scenario Type**: Happy Path (structural presence)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-03, NFR-2
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/test-plan-writer.md`
**Tags**: @agent-prompt

**Preconditions**:
- test-plan-writer.md updated (via `@toolsmith`).

**Steps**:
1. `rg -ni -e 'read' -e 'completed spec' -e 'derive' .opencode/agent/test-plan-writer.md`
2. Confirm an explicit **first action** that reads the completed `chg-<ref>-spec.md` and derives all values (TC IDs, AC coverage, file names, canonical values) from it.

**Expected Outcome**:
- First-action consume-and-derive language present (per NFR-2). (This test plan itself models that behavior — it read the spec before authoring.)

---

#### TC-SEQ-008 - plan-writer.md: reads completed spec AND test plan, derives all values

**Scenario Type**: Happy Path (structural presence)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-03, NFR-2, RSK-4
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/plan-writer.md`
**Tags**: @agent-prompt

**Preconditions**:
- plan-writer.md updated (via `@toolsmith`).

**Steps**:
1. `rg -ni -e 'spec' -e 'test plan' -e 'test-plan' -e 'derive' .opencode/agent/plan-writer.md`
2. Confirm the test plan is now a **required input** (first action reads completed spec **and** completed test plan).

**Expected Outcome**:
- Both artifacts named as required inputs; derive-all-values language present. (New behavior per spec §2.1 — previously plan-writer did not mention the test plan as input.)

---

#### TC-SEQ-009 - modified prompts stay lean; no prose duplication

**Scenario Type**: Regression (manual judgment)
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-8
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: all modified `.opencode/agent/*.md`, `.opencode/command/review-remote.md`
**Tags**: @agent-prompt, @quality

**Preconditions**:
- All agent/command edits delivered.

**Steps**:
1. Review the diff for each modified prompt.
2. Confirm sequencing/consolidation language is **added minimally** — no prose duplication, no bloat.

**Expected Outcome**:
- Prompts remain lean; additions are tight and non-redundant (authored via `@toolsmith` per NFR-8).

---

#### TC-YAML-001 - reviewer.md: local writes single review-iter-<N>.yaml; 0 JSON/MD review files

**Scenario Type**: Happy Path + Negative (structural presence + absence)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-04, DM-1, DM-2, NFR-5
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/reviewer.md`
**Tags**: @agent-prompt, @review-output

**Preconditions**:
- reviewer.md updated (via `@toolsmith`).

**Steps**:
1. `rg -ni -e 'review-iter-.*\.yaml' .opencode/agent/reviewer.md` → present.
2. `rg -ni -e 'findings-iter-.*\.json' -e 'review-iter-.*\.md' .opencode/agent/reviewer.md` → review hits; confirm no instruction to **write** these for new iterations.
3. Confirm the YAML path matches DM-2: `<change_folder>/code-review/review-iter-<N>.yaml`.

**Expected Outcome**:
- Local mode writes exactly one `review-iter-<N>.yaml` per iteration; 0 instructions to write `findings-iter-<N>.json` or `review-iter-<N>.md` for new iterations. (Historical files may be referenced as legacy only.)

---

#### TC-YAML-002 - reviewer.md: state_files table lists only the YAML (local mode)

**Scenario Type**: Regression (structural presence)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-04, NFR-5
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/reviewer.md` (`state_files` table)
**Tags**: @agent-prompt, @review-output

**Preconditions**:
- reviewer.md updated.

**Steps**:
1. Locate the `state_files` table in reviewer.md.
2. Confirm the local-mode row lists only `review-iter-<N>.yaml` (the JSON/MD rows are removed).

**Expected Outcome**:
- `state_files` table reflects the single-YAML output for local mode; no orphan JSON/MD rows.

---

#### TC-YAML-003 - local review YAML matches DM-1 schema (all keys; valid YAML)

**Scenario Type**: Contract (manual schema-conformance)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-04, DM-1, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: sample `review-iter-<N>.yaml` (constructed for the test)
**Tags**: @review-output, @schema

**Preconditions**:
- reviewer.md schema description delivered (DM-1).

**Steps**:
1. Construct a sample YAML per DM-1 with all top-level keys: `version: 1`, `iteration`, `mode: local`, `work_item_ref`, `branch`, `status: PASS|FAIL`, `summary`, `severity_breakdown: {critical, high, medium, low, info}`, `spec_compliance: PASS|FAIL|NA`, `plan_compliance: PASS|FAIL|NA`, `findings: [{id, severity, category, location, message, suggestion}]`, `reviewed_at` (ISO8601), `next_step`.
2. Validate YAML syntax: `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" sample.yaml` (no error).
3. Cross-check each key against DM-1 in the spec.

**Expected Outcome**:
- Sample YAML parses; every DM-1 top-level key present with correct types/shapes. `findings[]` is the dedup source (OQ-2 resolved).

---

#### TC-YAML-004 - reviewer.md: remote writes single review-draft.yaml (same schema)

**Scenario Type**: Happy Path (structural presence)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-05, DM-3
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/reviewer.md`
**Tags**: @agent-prompt, @review-output

**Preconditions**:
- reviewer.md updated.

**Steps**:
1. `rg -ni -e 'review-draft\.yaml' .opencode/agent/reviewer.md` → present.
2. Confirm remote-mode path matches DM-3: `tmp/code-review/<branch>/review-draft.yaml`.
3. Confirm the schema description is **identical** to local (DM-1).

**Expected Outcome**:
- Remote mode writes a single `review-draft.yaml` with the same schema as local.

---

#### TC-YAML-005 - reviewer.md: other remote artifacts unchanged (absence/presence)

**Scenario Type**: Regression (structural presence)
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-05, DM-3
**Test Type(s)**: Manual (structural grep + diff)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/reviewer.md`, `.opencode/command/review-remote.md`
**Tags**: @review-output

**Preconditions**:
- reviewer.md / review-remote.md updated.

**Steps**:
1. `rg -ni -e 'context\.json' -e 'diff\.patch' -e 'comments-snapshot\.json' -e 'ticket-context\.json' -e 'publish-report\.json' .opencode/agent/reviewer.md .opencode/command/review-remote.md` → all present (unchanged).
2. Confirm only the review-output pair collapsed; these five remote artifacts are untouched.

**Expected Outcome**:
- The five enumerated remote artifacts remain; only `review-draft.md`+`findings.json` → single `review-draft.yaml`.

---

#### TC-YAML-006 - schema parity: local + remote share one DM-1 schema

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-05, AC-06, DM-1, NFR-4
**Test Type(s)**: Manual (structural + judgment)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/reviewer.md`
**Tags**: @review-output, @schema

**Preconditions**:
- reviewer.md updated.

**Steps**:
1. Compare the schema described for local mode vs remote mode in reviewer.md.
2. `rg -ni -e 'same schema' -e 'identical schema' -e 'DM-1' .opencode/agent/reviewer.md`.

**Expected Outcome**:
- 0 schema divergence between modes (NFR-4). Both reference one shared DM-1 schema; only path/filename differ.

---

#### TC-YAML-007 - re-review self-loads the YAML findings[] (not JSON), both modes

**Scenario Type**: Happy Path (structural presence + absence)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-06, DM-1, NFR-4
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/reviewer.md` (re-review step)
**Tags**: @agent-prompt, @review-output

**Preconditions**:
- reviewer.md updated.

**Steps**:
1. Locate the re-review / dedup step.
2. `rg -ni -e 'review-iter-.*\.yaml' -e 'review-draft\.yaml' -e 'findings' .opencode/agent/reviewer.md` → re-review loads the YAML.
3. Confirm no instruction to read `findings-iter-*.json`/`findings.json` for dedup (absence).

**Expected Outcome**:
- Re-review self-loads the prior iteration YAML (`findings[]` is the dedup source — OQ-2 resolved); no JSON read. Applies to both local and remote.

---

#### TC-YAML-008 - review-remote.md: references review-draft.yaml; no removed-file refs

**Scenario Type**: Regression (structural)
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-05 (scope item F)
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/command/review-remote.md`
**Tags**: @command

**Preconditions**:
- review-remote.md updated (via `@toolsmith`).

**Steps**:
1. `rg -ni -e 'review-draft\.yaml' .opencode/command/review-remote.md` → present.
2. `rg -ni -e 'review-draft\.md' -e 'findings\.json' .opencode/command/review-remote.md` → review hits; confirm any remaining references are legacy/contextual, not active write/read paths.

**Expected Outcome**:
- review-remote.md artifact-path references point to the single `review-draft.yaml`; no dangling references to removed files as active paths.

---

#### TC-YAML-009 - backward compat: no migration/deletion; readiness-reviewer.md unchanged

**Scenario Type**: Negative / Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-6, NG-1, NG-2
**Test Type(s)**: Manual (diff inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: change diff; `.opencode/agent/readiness-reviewer.md`
**Tags**: @backward-compat

**Preconditions**:
- Change delivered on a branch.

**Steps**:
1. `git diff --stat main...HEAD` — confirm no deletion of historical review artifacts and no migration logic added.
2. `git diff main...HEAD -- .opencode/agent/readiness-reviewer.md` — confirm `readiness-iter-<N>.md` handling unchanged (NG-2).

**Expected Outcome**:
- Historical review files untouched (no migration/deletion — NG-1); `@readiness-reviewer` output format unchanged (NG-2).

---

#### TC-XCHECK-001 - lifecycle: names the "canonical DoR trap" anti-pattern

**Scenario Type**: Happy Path (structural presence)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-07
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/change-lifecycle.md`
**Tags**: @guide

**Preconditions**:
- lifecycle guide updated.

**Steps**:
1. `rg -ni -e 'canonical DoR trap' doc/guides/change-lifecycle.md`.

**Expected Outcome**:
- The anti-pattern is named "canonical DoR trap" (exact phrase per spec §23), with a description of independently-invented canonical values colliding at the gate.

---

#### TC-XCHECK-002 - lifecycle: documents pre-DoR cross-check (AC↔TC, file inventory, shared values)

**Scenario Type**: Happy Path (structural presence)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-07
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/change-lifecycle.md`
**Tags**: @guide

**Preconditions**:
- lifecycle guide updated.

**Steps**:
1. `rg -ni -e 'pre-DoR' -e 'cross-check' -e 'coverage' -e 'file inventory' -e 'canonical values' doc/guides/change-lifecycle.md`.
2. Confirm the three checks are documented: (a) AC↔TC coverage (every AC traced by ≥1 TC; every TC maps to an AC); (b) file inventory consistency across spec/plan; (c) shared/canonical values agreement.

**Expected Outcome**:
- The pre-DoR cross-check procedure is documented with all three checks (Flow 4 a/b/c).

---

#### TC-XCHECK-003 - cross-check framed as safety net; dor_check remains authoritative

**Scenario Type**: Negative / Contract (structural + judgment)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-07, NFR-9
**Test Type(s)**: Manual (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/change-lifecycle.md`
**Tags**: @guide

**Preconditions**:
- lifecycle guide updated.

**Steps**:
1. `rg -ni -e 'safety net' -e 'not a replacement' -e 'authoritative' -e 'dor_check' doc/guides/change-lifecycle.md`.

**Expected Outcome**:
- The cross-check is explicitly a complementary safety net; `dor_check` (phase 5) remains the authoritative adversarial gate. (NFR-9.)

---

#### TC-CI-001 - .ados-claude/ regenerated; plugin freshness green

**Scenario Type**: CI gate
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-08, NFR-3, RSK-6
**Test Type(s)**: CI
**Automation Level**: Automated
**Target Layer / Location**: `scripts/build-claude-plugin.sh`, `.ados-claude/`
**Tags**: @ci, @plugin

**Preconditions**:
- All `.opencode/` source edits committed.

**Steps**:
1. `bash scripts/build-claude-plugin.sh`
2. `git diff --exit-code -- .ados-claude/` (no stale diff after regeneration).

**Expected Outcome**:
- `.ados-claude/` counterparts for `pm.md`, `test-plan-writer.md`, `plan-writer.md`, `reviewer.md`, `review-remote.md` are regenerated and byte-fresh; CI freshness guard green. Source + generated committed together.

---

#### TC-CI-002 - doc-distribution guard green (change-lifecycle.md keeps redistributable)

**Scenario Type**: CI gate
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-08, NFR-7
**Test Type(s)**: CI
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`, `doc/guides/change-lifecycle.md`
**Tags**: @ci, @docs

**Preconditions**:
- lifecycle guide updated.

**Steps**:
1. `rg -n '^ados_distribution: redistributable$' doc/guides/change-lifecycle.md` → present.
2. `bash scripts/.tests/test-doc-distribution.sh` → green.

**Expected Outcome**:
- `change-lifecycle.md` retains `ados_distribution: redistributable`; the distribution drift guard passes (no drift in the install set).

---

#### TC-CI-003 - git diff --check clean (whitespace/conflict markers)

**Scenario Type**: Static gate
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: testing-strategy.md §Test layers (1)
**Test Type(s)**: CI
**Automation Level**: Automated
**Target Layer / Location**: whole change diff
**Tags**: @ci, @quality

**Preconditions**:
- Change on a branch.

**Steps**:
1. `git diff --check` (against base).

**Expected Outcome**:
- 0 whitespace errors / conflict markers across all changed files.

## 6. Environments and Test Data

- **Environment:** local dev checkout of this repo on the change branch. No external services, no opencode/`gh` runtime, no DB (this is a prompt/guide change).
- **Test data:** one hand-constructed sample `review-iter-<N>.yaml` for TC-YAML-003 (validates DM-1 schema + YAML parseability). No persistent fixtures.
- **Isolation:** all structural greps are read-only against committed files; no writes. CI gates are repo scripts run locally before push (CI re-runs them).

## 7. Automation Plan and Implementation Mapping

| TC ID | Implementation status | Execution command |
|-------|----------------------|-------------------|
| TC-SEQ-001..009 | Manual Only (structural grep + judgment) | `rg ...` on the listed files |
| TC-YAML-001,002,004,005,007..009 | Manual Only (structural grep) | `rg ...` / `git diff` on the listed files |
| TC-YAML-003 | Manual Only (schema conformance) | hand-built YAML + `python3 -c "import yaml,sys; yaml.safe_load(...)"` |
| TC-YAML-006 | Manual (structural + judgment) | `rg ...` + schema comparison |
| TC-XCHECK-001..003 | Manual Only (structural grep) | `rg ...` on `doc/guides/change-lifecycle.md` |
| TC-CI-001 | Automated (existing script) | `bash scripts/build-claude-plugin.sh && git diff --exit-code -- .ados-claude/` |
| TC-CI-002 | Automated (existing script) | `bash scripts/.tests/test-doc-distribution.sh` |
| TC-CI-003 | Automated (git built-in) | `git diff --check` |

**Optional:** if desired, the structural TCs may be wrapped into a single
`scripts/.tests/test-gh144-structural.sh` (embedded framework per
`.ai/rules/bash.md` §11, mirroring the GH-142 static prompt-test pattern). This
is **optional** and out of the spec's hard scope (NG-4 forbids only a *new CLI*,
not a test script). If added, register needles per the contracts above and keep
historical-artifact references out of active-path assertions. By default, mark
structural TCs as **Manual** per testing-strategy §Fallback rules.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| TR-1 | Most ACs are behavioral agent-capability claims untestable in CI (spec RSK-5). | Structural checks verify the prompt/guide contains the required language; behavior is verified manually + PR review + the requested red-team review. Behavioral claims are honestly marked Manual. |
| TR-2 | Static grep needles are brittle to prompt rewording. | Needles may be updated when a prompt is restructured; the *contract* each TC asserts is stable and recorded. Multiple needles per contract where reasonable. |
| TR-3 | `review-draft.yaml` schema could drift between modes over time (spec RSK-7). | TC-YAML-006 asserts one shared DM-1 schema; re-review self-load (TC-YAML-007) exercises it. Formal linter deferred. |
| TR-4 | Generated `.ados-claude` goes stale. | TC-CI-001 regenerates + asserts no stale diff; CI enforces (spec RSK-6). |

### 8.2 Assumptions

- The spec's claim holds: no agent/script parses the review JSON programmatically — only `@reviewer` re-reads it for dedup (`chg-GH-144-pm-notes.yaml`). TC-YAML-007 relies on this.
- Editing `.opencode/agent/**` and `.opencode/command/**` is delegated to `@toolsmith` (repo hard rule); these TCs verify the *result*, not the authoring path.
- The cross-check is AI-driven (NG-4); TC-XCHECK-* verify its *documentation*, not a scripted execution.
- `change-lifecycle.md`'s mermaid is sequentially correct in shape and only needs the explicit wording + reopen edges (spec §12).

### 8.3 Open Questions

None blocking. OQ-1 (`version: 1` in schema) and OQ-2 (`findings[]` is the dedup source) are RESOLVED in the spec (§14/§15) and reflected in TC-YAML-003/007.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-09 | @test-plan-writer | Initial test plan for GH-144, derived from `chg-GH-144-spec.md` (AC-01..08, F-1..3, NFR-1..9, DM-1..4). |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(populated during `/run-plan` phase + `/review`)_ | | | |

---

## AUTHORING NOTES

This plan models the behavior GH-144 enforces: the completed spec was **read
first** and every TC ID, AC mapping, schema key, path, and needle is derived from
it (not invented). The three feature prefixes (TC-SEQ / TC-YAML / TC-XCHECK)
mirror F-1 / F-2 / F-3; every AC-01..08 maps to ≥1 TC; all 9 NFRs and DM-1..4 are
covered. Because the change ships no executable code, automated unit/integration
tests are N/A per `.ai/rules/testing-strategy.md` §Fallback rules — verification
is structural (grep), CI (plugin freshness + doc-distribution), and manual
(behavioral claims, per spec RSK-5).
