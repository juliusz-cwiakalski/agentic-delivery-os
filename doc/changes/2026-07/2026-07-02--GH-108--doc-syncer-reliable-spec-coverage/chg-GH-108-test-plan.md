---
id: chg-GH-108-test-plan
status: Proposed
created: 2026-07-02T23:05:00Z
last_updated: 2026-07-02T23:05:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["fix", "process", "doc-syncer", "spec-coverage", "autonomous-delivery", "epic-107"]
version_impact: minor
summary: "doc-syncer reliability — make the phase-7 spec-coverage *resolution* path mode-aware (delivery_mode) so a detected gap is resolved in-change in autonomous mode, interactive de-noise is preserved unchanged, and the 'PM never creates tickets autonomously' governance rule stays intact; plus a spec-coverage observability aid."
links:
  change_spec: ./chg-GH-108-spec.md
  implementation_plan: ./chg-GH-108-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - doc-syncer reliability — specs/guides must actually fire post-merge (GH-108)

## 1. Scope and Objectives

This is a **process / prompt / docs fix** (no application code). There is no runtime to unit-test; "tests" are **verification checks** — grep-able content audits on edited agent prompts/guides, a verbatim-governance retention check, an interactive back-compat audit, a runnable shell test for the new visibility aid, a plugin-regeneration invariant, a system-spec reconciliation audit, and one manual post-merge **demonstration** of the actual resolution (the core fix, which cannot be exercised pre-merge without a live autonomous run).

Core behaviors to protect:

- **AC-1 — Root cause accuracy:** the change spec itself names the *resolution-path mode blindness* and distinguishes it from a "missing check" and from a "de-noise design flaw" (NFR-6). This is asserted over the spec doc, not the implementation.
- **AC-2 — Mode-aware rule lands:** a per-change `delivery_mode` signal is declared at intake (pm-notes + `@pm` step 3) and read identically from every entry point; `@doc-syncer`'s spec-coverage handoff becomes mode-aware (autonomous ⇒ resolve in-change; existing spec ⇒ reconcile); the "PM must NEVER create new tickets autonomously" rule is retained **verbatim with no autonomous-mode exception**; absent/`interactive` ⇒ byte-for-byte unchanged; the autonomous session prompt instructs `@pm` to set `autonomous`; authoring fires only for the *first* spec of an unspecced modified feature area (over-fire guard).
- **AC-3 — "Advisory" no longer means "silently skipped":** phase-7 (`change-lifecycle.md`) and `doc-syncer.md` (`<rules>`/`<reporting>`) wording disambiguates "advisory" so it cannot read as "silently skipped" in autonomous mode.
- **AC-4 — Coverage gap is observable:** a repo-internal `scripts/` tool produces a computable, non-zero feature-specs-present vs changes-touching-feature-areas count, with its own `scripts/.tests/test-*.sh` per the repo convention.
- **Cross-cutting:** `.ados-claude/` is regenerated **iff** a `.opencode/` source was edited (NFR-7); `doc/spec/features/feature-delivery-lifecycle.md` is **reconciled** at phase 7 to describe the mode-aware resolution (DM-2 / this change's own feature area, which already has a spec).

### 1.1 In Scope

- Content/grep audits on `.opencode/agent/doc-syncer.md`, `.opencode/agent/pm.md` (step 3), `.ai/agent/pm-instructions.md`, `doc/guides/change-lifecycle.md` (Phase 7), `scripts/opencode-session.sh` (`default_prompt_for()`).
- Root-cause audit over the change spec `./chg-GH-108-spec.md`.
- Verbatim-governance retention + no-exception negative greps (AC-F2-2 / NFR-3).
- Interactive back-compat audit (AC-F2-3 / NFR-1).
- New `scripts/` visibility aid + its `scripts/.tests/test-spec-coverage-snapshot.sh` runnable test (AC-F5-1 / NFR-5), modeled on the `test-*.sh` convention (`scripts/.tests/test-opencode-session.sh` is the structural exemplar).
- Automated assertion over `default_prompt_for()` via the existing `scripts/.tests/test-opencode-session.sh` (AC-F3-1).
- Plugin regeneration invariant (AC-NFR7-1 / NFR-7).
- System-spec reconciliation audit of `doc/spec/features/feature-delivery-lifecycle.md` (AC-DM2-1).
- One **manual post-merge demonstration** (Flow 3) confirming an autonomous run over an unspecced modified feature area yields an authored spec — the rollout guardrail (PDR-0002 step 6; spec §4.1 KPI).
- Regression: all repo `test-*.sh` stay green; `git diff --check` clean.

### 1.2 Out of Scope & Known Gaps

- **Authoring-ownership choice (OQ-1):** *which* agent writes the spec (`@doc-syncer` directly vs delegate to `@coder`/a stronger model) is a plan decision; this plan does **not** assert a specific authoring agent — it asserts the *rule* (gap resolved in-change in autonomous mode) and the *outcome* (a spec exists). No AC hard-codes the author.
- **Exact visibility-aid form (OQ-2):** the recommended form is a `scripts/spec-coverage-snapshot.sh` tool; the test asserts the **outcome** (computable, non-zero count), so a plan-decided equivalent name still passes — the exact filename is open.
- **Behavior of the coverage check in live operation** is exercised only by (a) prompt-text audits pre-merge and (b) the one post-merge demonstration (TC-DOCSYNC-003). A pre-merge "run the agents end-to-end" check is out of scope.
- **Project spec cleanup** (authoring the many *historically* missing specs) is explicitly out (NG-4); the demonstration proves the *mechanism* on one area.
- **GH-111** (operational-guides trigger) is out of scope (NG-5); only the reusability of `delivery_mode` is designed for.
- `definition-of-ready.md` carries no dedicated AC; its "advisory, not a DoR facet" note is checked informally as supporting evidence for AC-F2-3 only where it appears.

## 2. References

- Change spec: [./chg-GH-108-spec.md](./chg-GH-108-spec.md) — AC-NFR6-1, AC-F1-1, AC-F1-2, AC-F2-1, AC-F2-2, AC-F2-3, AC-F3-1, AC-NFR4-1, AC-F4-1, AC-F4-2, AC-F5-1, AC-NFR7-1, AC-DM2-1.
- Decision: [PDR-0002 — Mode-Aware Spec-Coverage Resolution](../../decisions/PDR-0002-mode-aware-spec-coverage-resolution.md) (Alternative 1; constraints C-1…C-4; verification criteria C-1…C-4).
- Implementation plan: `./chg-GH-108-plan.md` (pending / created in phase 4 — referenced for task-level detail).
- Testing strategy: [.ai/rules/testing-strategy.md](../../../.ai/rules/testing-strategy.md).
- Structural exemplars (script-test convention): [scripts/.tests/test-opencode-session.sh](../../../scripts/.tests/test-opencode-session.sh) (embedded framework, `source` the script, `assert_*` helpers).
- Authoritative current-behavior sources read during authoring: `.opencode/agent/doc-syncer.md` (`<rules>` "Spec-coverage handoff (report, never ticket)", `<reporting>` `spec_coverage_gaps`), `.opencode/agent/pm.md` step 3 (coverage "advisory only — not a delivery blocker"), `.ai/agent/pm-instructions.md` line 40 ("PM must NEVER create new tickets autonomously"), `doc/guides/change-lifecycle.md` Phase 7 (coverage "does not block the change"), `scripts/opencode-session.sh` `default_prompt_for()`.

## 3. Coverage Overview

### 3.1 Functional & Acceptance-Criteria Coverage (F-#, AC-#) — Traceability Matrix

| AC ID | Criterion (short) | TC ID(s) | How verified | Type | Status |
|-------|-------------------|----------|--------------|------|--------|
| **AC-NFR6-1** (AC-1) | Spec names the root cause (resolution-path mode blindness) and distinguishes it from "missing check" + "de-noise flaw" | TC-ROOTCAUSE-001 | grep audit over the spec doc | Audit / Content | Pending |
| **AC-F1-1** (AC-2) | pm.md step 3 + pm-notes YAML structure declare `delivery_mode` | TC-MODE-001 | grep on `.opencode/agent/pm.md` + YAML structure | Audit / Content | Pending |
| **AC-F1-2** (AC-2) | Both entry points read the same `delivery_mode` (no env-var-only mechanism) | TC-MODE-002 | grep + negative grep on session script; portability review | Audit + Review | Pending |
| **AC-F2-1** (AC-2) | doc-syncer handoff is mode-aware: reads `delivery_mode`; autonomous ⇒ resolve in-change; existing ⇒ reconcile | TC-DOCSYNC-001, TC-DOCSYNC-002 | grep on `.opencode/agent/doc-syncer.md` | Audit / Content | Pending |
| **AC-F2-2** (AC-2) | No tracker ticket; "PM must NEVER create new tickets autonomously" verbatim, no autonomous exception | TC-GOV-001 | verbatim grep + negative carve-out grep | Audit / Negative | Pending |
| **AC-F2-3** (AC-2) | Absent/`interactive` ⇒ identical to pre-change; no new blocking prompt | TC-BACKCOMPAT-001 | grep interactive-unchanged wording + negative blocking-prompt grep | Audit / Negative | Pending |
| **AC-F3-1** (AC-2) | `default_prompt_for()` instructs `@pm` to set `delivery_mode: autonomous` | TC-SESSION-001 | automated assert in `scripts/.tests/test-opencode-session.sh` | Automated (shell) | Pending |
| **AC-NFR4-1** (AC-2) | Over-fire guard: existing spec reconciled (not re-authored); routine edits excluded | TC-DOCSYNC-002, TC-OVERFIRE-001 | grep + manual falsifiability probe | Audit + Review | Pending |
| **AC-F4-1** (AC-3) | change-lifecycle Phase 7 disambiguates advisory ≠ silently-skipped; describes mode-aware resolution | TC-WORDING-001 | grep on Phase 7 of guide | Audit / Content | Pending |
| **AC-F4-2** (AC-3) | doc-syncer `<rules>`/`<reporting>` wording no longer ⇒ silently-skipped in autonomous | TC-WORDING-002 | grep + negative grep on doc-syncer prompt | Audit / Content | Pending |
| **AC-F5-1** (AC-4) | Visibility aid yields a computable, non-zero feature-specs-present vs changes-touching-feature-areas count | TC-COVSNAP-001 | runnable `scripts/.tests/test-spec-coverage-snapshot.sh` | Automated (shell) | Pending |
| **AC-NFR7-1** (cross) | `.ados-claude/` regenerated via build script and current (iff `.opencode/` edited) | TC-PLUGIN-001 | rebuild + `git diff --stat` invariant | Automated (build) | Pending |
| **AC-DM2-1** (cross) | `feature-delivery-lifecycle.md` reconciled at phase 7 to describe mode-aware resolution (existing spec ⇒ reconcile) | TC-SYSSPEC-001, TC-DOCSYNC-003 | grep audit on the feature spec + demonstration | Audit + Manual | Pending |

**AC coverage total: 13 / 13.**

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP (§8.1 N/A) or event (§8.2 N/A) surfaces. Data-model items are conceptual/report-only:

| DM ID | Element | TC ID(s) | How verified |
|-------|---------|----------|--------------|
| DM-1 | `delivery_mode` (new pm-notes field: `interactive \| autonomous`; default/absent ⇒ `interactive`) | TC-MODE-001, TC-MODE-002 | grep declaration + default-semantics grep |
| DM-2 | Mode-aware resolution contract matrix over (mode) × (spec exists?) | TC-DOCSYNC-001, TC-DOCSYNC-002, TC-DOCSYNC-003, TC-SYSSPEC-001 | grep the matrix clauses + demonstration |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | How verified |
|--------|-------------|----------|--------------|
| NFR-1 | Backward compatibility — interactive / absent `delivery_mode` behaves identically to pre-change | TC-BACKCOMPAT-001 | interactive-unchanged grep + negative blocking-prompt grep |
| NFR-2 | Entry-point portability — `delivery_mode` readable from every entry point; no env-var-only signal | TC-MODE-002, TC-SESSION-001 | portability review + session-script negative grep |
| NFR-3 | Governance invariance — verbatim rule; no auto-ticket; no autonomous exception | TC-GOV-001 | verbatim + negative carve-out grep |
| NFR-4 | Over-fire guard — first-spec-only; existing reconciled; routine edits excluded | TC-DOCSYNC-002, TC-OVERFIRE-001 | grep + manual falsifiability probe |
| NFR-5 | Observability — computable, non-zero coverage signal for autonomous runs | TC-COVSNAP-001 | runnable shell test asserting non-zero count |
| NFR-6 | Root-cause accuracy — names resolution-path mode blindness; 0 mischaracterizations | TC-ROOTCAUSE-001 | spec-doc grep audit |
| NFR-7 | Plugin freshness — regenerated iff `.opencode/` edited | TC-PLUGIN-001 | rebuild + diff-stat invariant |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this `doc/**` + `.opencode/**` + `.ados-claude/**` + `scripts/**` change maps to:

- **Static/diff checks (always):** `git diff --check`; changed-file path/naming review. → TC-REGRESS-003.
- **Content checks (docs/templates/agent prompts):** grep-able traceability against ACs; markdown render review; link review; YAML frontmatter validity (the pm-notes `delivery_mode` field is a conceptual addition, not a parsed register — still linted for valid enum). → TC-ROOTCAUSE-001, TC-MODE-001/002, TC-DOCSYNC-001/002, TC-GOV-001, TC-BACKCOMPAT-001, TC-OVERFIRE-001, TC-WORDING-001/002, TC-SYSSPEC-001.
- **Automated shell/tool tests (when code changes):**
  - `scripts/spec-coverage-snapshot.sh` (new) → `scripts/.tests/test-spec-coverage-snapshot.sh`. → TC-COVSNAP-001.
  - `scripts/opencode-session.sh` (`default_prompt_for()` edited) → extend `scripts/.tests/test-opencode-session.sh`. → TC-SESSION-001, TC-REGRESS-002.
  - `.opencode/` edits → regenerate plugin via `scripts/build-claude-plugin.sh`. → TC-PLUGIN-001.
- **Manual verification:** falsifiability of the over-fire guard (NFR-4); portability review (NFR-2); and the post-merge **demonstration** of the actual fix (Flow 3) per PDR-0002 step 6. → TC-OVERFIRE-001 (manual), TC-MODE-002 (manual), TC-DOCSYNC-003.
- **Regression:** all `scripts/.tests/test-*.sh` + `tools/.tests/test-*.sh` stay green. → TC-REGRESS-001.

No unit/integration/E2E framework applies (no application code). All automated checks are shell `rg`/`test`/script invocations run from the repo root.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-ROOTCAUSE-001 | Spec names mode blindness + distinguishes missing-check & de-noise | Regression | Critical | High | AC-NFR6-1, NFR-6 |
| TC-MODE-001 | pm.md step 3 + pm-notes structure declare `delivery_mode` | Happy Path | Critical | High | AC-F1-1, DM-1 |
| TC-MODE-002 | Single pm-notes signal, portable; no env-var-only detection | Corner Case | Critical | High | AC-F1-2, NFR-2 |
| TC-DOCSYNC-001 | doc-syncer reads `delivery_mode`; autonomous ⇒ resolve in-change | Happy Path | Critical | High | AC-F2-1, DM-2 |
| TC-DOCSYNC-002 | Existing spec reconciled, not re-authored | Corner Case | Critical | High | AC-F2-1, AC-NFR4-1, DM-2 |
| TC-DOCSYNC-003 | Autonomous run over unspecced area yields authored spec (demonstration) | Manual | Critical | High | AC-DM2-1, DM-2 (C-2 target) |
| TC-OVERFIRE-001 | Over-fire guard: routine edits excluded; feature-area definition present | Corner Case | Important | Medium | AC-NFR4-1, NFR-4 |
| TC-GOV-001 | No tracker ticket; verbatim rule retained; no autonomous exception | Negative | Critical | High | AC-F2-2, NFR-3 |
| TC-BACKCOMPAT-001 | Absent/interactive ⇒ unchanged; no new blocking prompt | Negative | Critical | High | AC-F2-3, NFR-1 |
| TC-SESSION-001 | `default_prompt_for()` instructs @pm to set `autonomous` | Happy Path | Critical | High | AC-F3-1, NFR-2 |
| TC-WORDING-001 | change-lifecycle Phase 7 disambiguates advisory ≠ silently-skipped | Happy Path | Important | High | AC-F4-1 |
| TC-WORDING-002 | doc-syncer `<rules>`/`<reporting>` wording normalized | Happy Path | Important | Medium | AC-F4-2 |
| TC-COVSNAP-001 | Visibility aid yields computable, non-zero count | Happy Path | Critical | High | AC-F5-1, NFR-5 |
| TC-PLUGIN-001 | `.ados-claude/` regenerated iff `.opencode/` edited | Regression | Critical | High | AC-NFR7-1, NFR-7 |
| TC-SYSSPEC-001 | `feature-delivery-lifecycle.md` reconciled to describe mode-aware resolution | Happy Path | Important | Medium | AC-DM2-1, DM-2 |
| TC-REGRESS-001 | All repo `test-*.sh` stay green | Regression | Critical | High | (regression) |
| TC-REGRESS-002 | Existing opencode-session assertions hold after `default_prompt_for()` edit | Regression | Critical | High | AC-F3-1 (no break) |
| TC-REGRESS-003 | `git diff --check` clean | Regression | Important | Medium | (static guard) |

### 5.2 Scenario Details

#### TC-ROOTCAUSE-001 - Spec names the root cause (mode blindness) and distinguishes it from "missing check" + "de-noise flaw"

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR6-1, NFR-6, DM-2
**Test Type(s)**: Manual (content audit over the spec doc)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/changes/2026-07/2026-07-02--GH-108--doc-syncer-reliable-spec-coverage/chg-GH-108-spec.md`
**Tags**: @process, @spec, @root-cause

**Preconditions**:

- The change spec is authored and present.

**Steps**:

1. Assert the spec names the resolution-path mode blindness (the actual root cause):
   `rg -n -i -e "mode blindness" -e "mode-blind" -e "resolution-path mode blindness" -e "resolution path is mode-blind" chg-GH-108-spec.md` (run from the change folder) → ≥1 match.
2. Assert the spec explicitly **distinguishes** the root cause from a *missing check*:
   `rg -n -i -e "not a missing check" -e "not.*missing check" -e "missing check" -e "check exists and fires" -e "detection works" chg-GH-108-spec.md` → ≥1 match stating the check is not missing.
3. Assert the spec explicitly **distinguishes** the root cause from a *de-noise design flaw* (the de-noise design is correct for human-in-loop):
   `rg -n -i -e "de-noise" -e "de-noising" -e "de-noise design.*correct" -e "absence of mode-awareness" chg-GH-108-spec.md` → ≥1 match.
4. Manual: confirm the spec's Problem/Context (§3 / §2) states that in autonomous delivery "advisory + human-gated" reduces to "never"/"never happens" because no human is reachable mid-flight — i.e., the *why* of zero specs produced.

**Expected Outcome**:

- The spec documents the actual root cause (mode blindness in the resolution path), explicitly distinguishes it from a missing check and from a de-noise design flaw, and states why zero specs were produced in autonomous delivery. NFR-6 (0 mischaracterizations) holds.

**Notes / Clarifications**:

- This case asserts over the **spec artifact**, not the implementation — NFR-6 is a root-cause-accuracy requirement on the spec itself. Anchor phrases above already match the authored spec; the author may reword as long as each grep still passes.

---

#### TC-MODE-001 - pm.md step 3 (clarify_scope) + pm-notes YAML structure declare `delivery_mode`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/pm.md` (step 3, clarify_scope) + pm-notes YAML structure block
**Tags**: @process, @pm, @intake, @mode

**Preconditions**:

- Delivery is complete (`pm.md` edited).

**Steps**:

1. Assert the field is declared at intake in pm.md step 3:
   `rg -n "delivery_mode" .opencode/agent/pm.md` → ≥1 match within/around step 3 (clarify_scope).
2. Assert the pm-notes YAML structure block declares the field (DM-1):
   `rg -n -e "delivery_mode:" -e "delivery_mode" .opencode/agent/pm.md` → the field appears in the documented YAML structure (e.g., `delivery_mode: interactive   # interactive | autonomous`).
3. Assert default/absent ⇒ `interactive` semantics are stated (backward compatibility):
   `rg -n -i -e "default.*interactive" -e "absent.*interactive" -e "interactive.*default" .opencode/agent/pm.md` → ≥1 match.

**Expected Outcome**:

- `@pm` intake (step 3) declares/sets `delivery_mode` and the pm-notes YAML structure includes the field with an explicit `interactive | autonomous` enum and a default/absent ⇒ `interactive` note.

---

#### TC-MODE-002 - Single `delivery_mode` signal, portable across entry points; no env-var-only detection

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F1-2, NFR-2
**Test Type(s)**: Manual (content + portability review)
**Automation Level**: Semi-automated
**Target Layer / Location**: `scripts/opencode-session.sh`, `.opencode/agent/{pm,doc-syncer}.md`
**Tags**: @process, @mode, @portability

**Preconditions**:

- Delivery is complete.

**Steps**:

1. Assert the signal is the committed pm-notes field (single source) read by the consuming agent:
   `rg -n -i -e "delivery_mode" .opencode/agent/doc-syncer.md` → ≥1 match reading it from pm-notes (not from an env var).
2. Assert the session script does **not** introduce an env-var-only mode signal as the *detection mechanism* (NFR-2 / C-4). Negative grep for env-var detection:
   `rg -n -e "DELIVERY_MODE=|export DELIVERY_MODE|OPENCODE_DELIVERY_MODE|\$\{?DELIVERY_MODE" scripts/opencode-session.sh` → 0 matches (the prompt instructs `@pm` to set the pm-notes field; no env-var gate).
3. **Manual portability review:** confirm a manual `@pm` invocation reads the same `delivery_mode` from `chg-<ref>-pm-notes.yaml` as a session-driven run would — i.e., the signal is in a committed artifact both entry points can read, satisfying C-4.

**Expected Outcome**:

- There is exactly one `delivery_mode` signal — the pm-notes field — readable from every entry point; no env-var-only or session-tooling-only mechanism exists.

**Notes / Clarifications**:

- A literal env var named differently (unrelated) may exist; the negative grep is scoped to `DELIVERY_MODE`/`OPENCODE_DELIVERY_MODE` to catch a mode *detection* gate. The intent is: mode must not be inferrable only from session tooling.

---

#### TC-DOCSYNC-001 - doc-syncer reads `delivery_mode`; autonomous mode resolves a gap in-change

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/doc-syncer.md` (`<rules>` / step 2 / `<reporting>`)
**Tags**: @process, @doc-syncer, @mode, @resolution

**Preconditions**:

- Delivery is complete (`doc-syncer.md` edited).

**Steps**:

1. Assert doc-syncer reads the mode from pm-notes:
   `rg -n -i -e "delivery_mode" .opencode/agent/doc-syncer.md` → ≥1 match referencing the pm-notes field.
2. Assert the autonomous ⇒ resolve-in-change rule is present:
   `rg -n -i -e "autonomous" -e "resolve.*in-change" -e "resolved within the change" -e "author" .opencode/agent/doc-syncer.md` → ≥1 match describing that in `autonomous` mode a detected gap for a modified feature area lacking a spec is resolved in-change (the missing `feature-<slug>.md` is authored, or authoring is owned/delegated).
3. Assert the promotion is scoped to **first-spec-only** (advisory → required for the *first* spec of an area that has none):
   `rg -n -i -e "first spec" -e "first-spec" -e "has no spec" -e "lacking a spec" -e "no spec" .opencode/agent/doc-syncer.md` → ≥1 match.
4. Manual: confirm the rule is coherently worded — detection (positive coverage check, unchanged) and resolution (new, mode-gated) are distinguishable.

**Expected Outcome**:

- doc-syncer's spec-coverage handoff is mode-aware: it reads `delivery_mode` from pm-notes; in `autonomous` mode a detected gap for a modified feature area with no spec is resolved in-change (first-spec-only). DM-2 autonomous-cell holds.

---

#### TC-DOCSYNC-002 - Existing spec is reconciled, not re-authored (first-spec-only authoring)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-NFR4-1, DM-2, DEC-4
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/doc-syncer.md`
**Tags**: @process, @doc-syncer, @over-fire

**Preconditions**:

- Delivery is complete.

**Steps**:

1. Assert an **existing** spec is merely **reconciled** (not re-authored) even in autonomous mode:
   `rg -n -i -e "reconcile" -e "reconciled" -e "not re-authored" -e "existing spec" .opencode/agent/doc-syncer.md` → ≥1 match capturing that an existing `feature-<slug>.md` continues to be reconciled (authoring fires only when no spec exists).

**Expected Outcome**:

- The mode-aware rule authorizes authoring **only** for a missing first spec; an existing feature spec is reconciled. DM-2 "existing ⇒ reconcile" cell holds; DEC-4 (first-spec-only) is encoded.

---

#### TC-DOCSYNC-003 - Autonomous run over an unspecced modified feature area yields an authored spec (demonstration)

**Scenario Type**: Manual
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-2, AC-DM2-1, NFR-5 (PDR-0002 C-2 target; spec §4.1 KPI; rollout guardrail)
**Test Type(s)**: Manual (live demonstration)
**Automation Level**: Manual
**Target Layer / Location**: a real autonomous delivery run + `doc/spec/features/**`
**Tags**: @process, @autonomous, @demonstration, @rollout

**Preconditions**:

- This change has landed. The visibility aid (TC-COVSNAP-001) is available. A genuinely unspecced modified feature area exists for the demonstration (or the demonstration is run on the next such change).

**Steps**:

1. Identify (or wait for) a change that modifies a feature area with **no** existing `doc/spec/features/feature-<slug>.md`, delivered via `scripts/opencode-session.sh` (autonomous).
2. Confirm `delivery_mode: autonomous` is set in that change's `chg-<ref>-pm-notes.yaml`.
3. After phase 7 (`system_spec_update`) completes, confirm a new `doc/spec/features/feature-<slug>.md` was authored as part of that change (status appropriate for a new spec; linked to the workItemRef).
4. Confirm **no tracker ticket** was auto-created by any agent for the gap (review the issue tracker).
5. Cross-check with the visibility aid: the feature-specs-present count for that area went from 0 → 1.

**Expected Outcome**:

- An autonomous delivery run over an unspecced modified feature area produces a feature spec in-change; no tracker ticket is auto-created; the visibility aid reflects the new spec. This is the 1/1 demonstration target (spec §4.1) and the PDR-0002 C-2 verification.

**Notes / Clarifications**:

- This is a **post-merge rollout guardrail** (PDR-0002 step 6), not a pre-merge CI check — a live autonomous run cannot be exercised in the PR gate. If no qualifying change is immediately available, record the case as **deferred to first autonomous run** and leave the execution log open. The pre-merge evidence for the *mechanism* is TC-DOCSYNC-001 (prompt encodes the rule) + TC-COVSNAP-001 (drop is observable); this case proves it *fires* in operation.

---

#### TC-OVERFIRE-001 - Over-fire guard: routine edits excluded; "feature area" definition present and falsifiable

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-NFR4-1, NFR-4, DEC-4
**Test Type(s)**: Manual (content + falsifiability probe)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/doc-syncer.md` (operational definition), `.opencode/agent/pm.md`
**Tags**: @process, @doc-syncer, @falsifiability

**Preconditions**:

- Delivery is complete.

**Steps**:

1. Assert the operational definition of "feature area" is present and ties to spec existence:
   `rg -n -i -e "feature area" -e "warrants a" -e "warrants .feature-" .opencode/agent/doc-syncer.md .opencode/agent/pm.md` → ≥1 match defining a feature area as a coherent, nameable capability that warrants a `feature-<slug>.md`.
2. Assert routine edits / one-off scripts / already-specced areas are **excluded** from authoring:
   `rg -n -i -e "routine edit" -e "one-off" -e "not.*new feature area" -e "already-specced" .opencode/agent/doc-syncer.md` → ≥1 match.
3. **Manual falsifiability probe:** the reviewer names a real modified area (e.g., "the delivery lifecycle" — already specced ⇒ reconcile; a genuinely new capability ⇒ author) and confirms the rule produces a determinate reconcile-vs-author decision, not a subjective judgement.

**Expected Outcome**:

- Authoring fires only for the first spec of an unspecced modified feature area; routine edits and already-specced areas are excluded; the decision is falsifiable per named area.

---

#### TC-GOV-001 - No tracker ticket; "PM must NEVER create new tickets autonomously" retained verbatim; no autonomous exception

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, NFR-3, DEC-2
**Test Type(s)**: Manual (negative content)
**Automation Level**: Automated
**Target Layer / Location**: `.ai/agent/pm-instructions.md`, `.opencode/agent/{pm,doc-syncer}.md`
**Tags**: @process, @governance, @negative

**Preconditions**:

- Delivery is complete.

**Steps**:

1. Assert the verbatim governance rule is retained in its canonical home (pm-instructions.md):
   `rg -n "PM must NEVER create new tickets autonomously" .ai/agent/pm-instructions.md` → ≥1 match (exact phrase).
2. Assert **no** autonomous-mode exception is carved into the rule across the PM + doc-syncer surfaces. Negative grep:
   `rg -n -i -e "except in autonomous" -e "autonomous.{0,40}exception" -e "exception.{0,40}autonomous" -e "in autonomous mode.*create.{0,30}ticket" .ai/agent/pm-instructions.md .opencode/agent/pm.md .opencode/agent/doc-syncer.md` → 0 matches.
3. Assert the resolution path produces a **doc artifact** (not a tracker ticket) in autonomous mode:
   `rg -n -i -e "doc artifact" -e "never create.{0,20}ticket" -e "does not create.{0,20}ticket" -e "no tracker ticket" .opencode/agent/doc-syncer.md` → ≥1 match affirming the autonomous resolution authors a spec scoped to the change (reviewed at the open-PR gate), not a tracker ticket.

**Expected Outcome**:

- The verbatim rule is intact; no autonomous exception is carved in; the mode-aware resolution closes the coverage gap by authoring a doc artifact, never by creating a tracker ticket. NFR-3 holds.

**Notes / Clarifications**:

- The verbatim phrase currently lives in `pm-instructions.md`; if the author also mirrors it into `pm.md`, step 1 is widened to both. Step 1 asserts at least `pm-instructions.md` (the AC's "pm-instructions.md / pm.md" is satisfied by either; `pm-instructions.md` is the canonical home). The disqualifying condition is step 2 finding a carve-out.

---

#### TC-BACKCOMPAT-001 - Absent / `interactive` mode is identical to pre-change; no new blocking prompt

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-3, NFR-1, DEC-3
**Test Type(s)**: Manual (negative content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/doc-syncer.md`, `doc/guides/change-lifecycle.md` (Phase 7)
**Tags**: @process, @back-compat, @negative

**Preconditions**:

- Delivery is complete.

**Steps**:

1. Assert the interactive/absent path is described as unchanged — advisory + human-gated:
   `rg -n -i -e "interactive" -e "absent" -e "unchanged" -e "byte-for-byte" -e "report.*pm.*propos" -e "human.*approv" .opencode/agent/doc-syncer.md` → ≥1 match capturing the report → PM proposes → human approves flow for `interactive`/absent.
2. Assert **no new blocking prompt** is introduced for interactive runs. Negative grep for a forced author-or-defer interaction in interactive mode:
   `rg -n -i -e "interactive.*(must|force|require).{0,40}(author|defer|resolve)" -e "block.{0,30}interactive" .opencode/agent/doc-syncer.md doc/guides/change-lifecycle.md` → 0 matches (interactive mode must not gain a new blocking interaction).
3. Manual: confirm the default/absent ⇒ `interactive` ⇒ today's behavior is stated (overlaps TC-MODE-001 step 3) so existing change folders need no migration.

**Expected Outcome**:

- `interactive` (and absent `delivery_mode`) behavior is byte-for-byte unchanged: advisory, non-blocking, human-gated follow-up. NFR-1 holds.

---

#### TC-SESSION-001 - `default_prompt_for()` instructs @pm to set `delivery_mode: autonomous`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-2
**Test Type(s)**: Automated (shell)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/opencode-session.sh` (`default_prompt_for()`) + `scripts/.tests/test-opencode-session.sh`
**Tags**: @scripts, @autonomous, @entry-point

**Preconditions**:

- Delivery is complete; `scripts/.tests/test-opencode-session.sh` was extended (it already sources the script and asserts on `default_prompt_for`).

**Steps**:

1. Run the (extended) session test:
   `bash scripts/.tests/test-opencode-session.sh` → exit 0 (PASS).
2. The test contains an assertion (in the `test_default_prompt_*` family) that the autonomous prompt instructs `@pm` to set the mode, e.g. an `assert_contains "$(default_prompt_for 'GH-77')" "delivery_mode: autonomous"` (or an equivalent phrase directing `@pm` to set `autonomous`).
3. Confirm the addition is a **one-line instruction** (no new tooling surface / flags): manual read of the `default_prompt_for()` diff.

**Expected Outcome**:

- `default_prompt_for()` instructs `@pm` to set `delivery_mode: autonomous`; the session test passes (including the new assertion); no new flags/tooling surface are added.

**Notes / Clarifications**:

- The test file follows the existing embedded-framework pattern (`source "${SCRIPT_DIR}/opencode-session.sh"`, `assert_contains`). The exact assertion phrasing is at coder discretion as long as it pins the autonomous-mode instruction; existing assertions (`CREATE THE PR AND LEAVE IT OPEN`, `full ADOS 11-phase lifecycle`, one-ticket) must keep passing — see TC-REGRESS-002.

---

#### TC-WORDING-001 - change-lifecycle Phase 7 disambiguates "advisory" ≠ "silently skipped" in autonomous mode

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/change-lifecycle.md` (§7 system_spec_update)
**Tags**: @docs, @lifecycle, @wording

**Preconditions**:

- Delivery is complete.

**Steps**:

1. Assert the coverage check match falls in Phase 7 and now describes the mode-aware resolution:
   `rg -n -i -e "delivery_mode" -e "autonomous" -e "mode-aware" doc/guides/change-lifecycle.md` → ≥1 match at/after the `### 7) system_spec_update` heading (manual confirmation of placement).
2. Assert "advisory" is disambiguated so it cannot read as "silently skipped" in autonomous mode — the resolution (author in-change in autonomous) is described:
   `rg -n -i -e "autonomous" -e "resolved" -e "author" -e "not silently skipped" doc/guides/change-lifecycle.md` → ≥1 match in the Phase-7 coverage context.
3. Manual: confirm the interactive reading ("advisory = non-blocking at phase 7 / human decides ticket creation") is preserved alongside the new autonomous clause.

**Expected Outcome**:

- Phase 7 documents the mode-aware resolution; "advisory" is disambiguated; the guide no longer lets "advisory" read as "silently skipped" in autonomous mode while keeping the interactive meaning intact.

---

#### TC-WORDING-002 - doc-syncer `<rules>`/`<reporting>` wording no longer implies advisory ⇒ silently-skipped in autonomous

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, AC-F4-2
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/doc-syncer.md` (`<rules>`, `<reporting>`)
**Tags**: @process, @doc-syncer, @wording

**Preconditions**:

- Delivery is complete.

**Steps**:

1. Assert the `<rules>` / `<reporting>` sections reflect the mode-aware handoff:
   `rg -n -i -e "delivery_mode" -e "autonomous" .opencode/agent/doc-syncer.md` → ≥1 match within `<rules>` and/or `<reporting>` (the handoff is no longer a single report-only branch).
2. Negative grep: assert no remaining unqualified "advisory ⇒ never creates a spec" language that would re-introduce the silent-skip reading in autonomous mode. (Today's text says reporting "carries no automated side effect; it never creates a spec or a ticket" — confirm this is now scoped to interactive/absent, with the autonomous branch stated separately.)
   `rg -n -i -e "never creates a spec" -e "carries no automated side effect" .opencode/agent/doc-syncer.md` → if present, the surrounding text must qualify it to interactive/absent mode (manual confirmation that it is not stated unconditionally over all modes).

**Expected Outcome**:

- doc-syncer's rules/reporting disambiguate the two modes; the wording no longer implies advisory ⇒ silently-skipped in autonomous mode.

---

#### TC-COVSNAP-001 - Visibility aid yields a computable, non-zero feature-specs-present vs changes-touching-feature-areas count

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-5
**Test Type(s)**: Automated (shell)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/spec-coverage-snapshot.sh` (new) + `scripts/.tests/test-spec-coverage-snapshot.sh` (new)
**Tags**: @scripts, @observability, @automated

**Preconditions**:

- Delivery is complete; the visibility aid and its test exist. (`bash`, `rg`, and standard coreutils available.)

**Steps**:

1. Run the visibility-aid test:
   `bash scripts/.tests/test-spec-coverage-snapshot.sh` → exit 0 (PASS).
2. The test exercises the tool against a fixture (and/or the live repo) and asserts a **computable, non-zero** count — e.g. it runs `scripts/spec-coverage-snapshot.sh`, parses the output, and asserts:
   - the feature-specs-present count (`doc/spec/features/feature-*.md`) is an integer ≥ 0;
   - the changes-touching-feature-areas count (derived from `doc/changes/**`) is an integer **> 0** (non-zero — the repo has real changes);
   - the tool emits a stable, parseable line (e.g., a `specs=N changes=M` summary) the test greps/awks.
3. Run the tool directly on the live repo to produce evidence:
   `scripts/spec-coverage-snapshot.sh` → prints a non-zero count and exits 0.

**Expected Outcome**:

- The visibility aid produces a durable, computable signal: a count of feature specs present vs changes touching feature areas, non-zero for the repo, parseable and asserted by its `scripts/.tests/test-spec-coverage-snapshot.sh`. A silent spec-coverage drop is now detectable without a manual audit.

**Notes / Clarifications**:

- **Form is a plan decision (OQ-2):** the recommended form is `scripts/spec-coverage-snapshot.sh` (`.sh` per the `scripts/` convention, with a matching `scripts/.tests/test-spec-coverage-snapshot.sh` per the testing-strategy "Automated shell/tool tests" rule). If the plan chooses an equivalent durable surface, this case asserts the **outcome** (computable + non-zero) regardless of exact filename — but a `scripts/` tool with its own test is the expected path.
- The test follows the repo script-test convention (embedded framework + `assert_*` helpers) exemplified by `scripts/.tests/test-opencode-session.sh`. Fixtures live under a `tmp/` subdir or an in-test `mktemp -d` and are cleaned up on `EXIT`.

---

#### TC-PLUGIN-001 - `.ados-claude/` regenerated iff a `.opencode/` source was edited

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR7-1, NFR-7
**Test Type(s)**: Integration (build invariant)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/build-claude-plugin.sh` → `.ados-claude/`
**Tags**: @plugin, @ci, @regression

**Preconditions**:

- Delivery is complete; `.ados-claude/` was regenerated and committed. The committed baseline (HEAD) is itself current (deterministic build).

**Steps**:

1. `git status --short -- .ados-claude/` → clean (committed baseline).
2. Re-run the generator: `scripts/build-claude-plugin.sh` → exits 0; reports agent/skill counts.
3. `git diff --stat -- .ados-claude/` → assert the changed set equals (under the `agents/<name>.md` mapping) **exactly** the `.opencode/` agents this change edited. Expected for GH-108: `.ados-claude/agents/doc-syncer.md` and `.ados-claude/agents/pm.md` (the two `.opencode/agent/` files in scope; confirm against `git diff --name-only -- .opencode/`).
4. Confirm the 1:1 invariant: the `.ados-claude/` diff set equals the `.opencode/` edited set under the path mapping; no unrelated `.ados-claude/agents/*`, `.ados-claude/skills/**`, or `plugin.json` drift.

**Expected Outcome**:

- The build is deterministic; regeneration touched exactly the edited-agent outputs; the regenerate-iff-`.opencode/`-edited invariant (NFR-7) holds.

**Notes / Clarifications**:

- If `git diff --stat` shows additional files, either the baseline was stale before this change or the build became non-deterministic — both are release blockers. (`.ai/agent/pm-instructions.md` is **not** a `.opencode/` file and must **not** trigger a regen — only `.opencode/` edits do.)

---

#### TC-SYSSPEC-001 - `feature-delivery-lifecycle.md` reconciled at phase 7 to describe the mode-aware resolution

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-DM2-1, DM-2, F-2
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-delivery-lifecycle.md`
**Tags**: @docs, @specs, @reconcile

**Preconditions**:

- Phase 7 (`system_spec_update`) ran for this change; `feature-delivery-lifecycle.md` already exists (this change's own feature area — it is *reconciled*, not authored).

**Steps**:

1. Assert the lifecycle spec now describes the mode-aware resolution:
   `rg -n -i -e "delivery_mode" -e "mode-aware" -e "autonomous" doc/spec/features/feature-delivery-lifecycle.md` → ≥1 match in the phase-7 / spec-coverage context.
2. Assert the reconciliation is consistent with the agent prompt (prompt wins on conflict): manual confirmation that the spec's description matches `.opencode/agent/doc-syncer.md` (TC-DOCSYNC-001) — same mode cells, same no-ticket rule.
3. Assert the file remains `status: Current` and links `GH-108` (traceability):
   `rg -n -e "status: Current" -e "GH-108" doc/spec/features/feature-delivery-lifecycle.md` → ≥1 match each.

**Expected Outcome**:

- The existing lifecycle spec is reconciled (not re-authored) to describe the mode-aware resolution; it stays `status: Current`, cites `GH-108`, and matches the authoritative prompt. AC-DM2-1 holds and demonstrates the DM-2 "existing ⇒ reconcile" cell.

---

#### TC-REGRESS-001 - All repo `test-*.sh` scripts stay green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: testing-strategy §"Quality gates"
**Test Type(s)**: Integration (shell suite)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-*.sh`, `tools/.tests/test-*.sh`
**Tags**: @regression, @ci

**Preconditions**:

- Full delivery (agent edits + session-script edit + new visibility tool + plugin regen) is complete.

**Steps**:

1. Run all script tests:
   ```bash
   for t in scripts/.tests/test-*.sh ; do echo "== $t ==" ; bash "$t" >/tmp/$(basename "$t").log 2>&1 && echo PASS || echo "FAIL($?)"; done
   ```
   Expected (current inventory + GH-108 additions): `test-add-header-location.sh`, `test-build-claude-plugin.sh`, `test-doc-distribution-modes.sh`, `test-doc-distribution.sh`, `test-inception-doc-consistency.sh`, `test-install-zclaude.sh`, `test-install.sh`, `test-opencode-session.sh`, `test-spec-coverage-snapshot.sh` (new), `test-uninstall.sh` → all PASS.
2. Run all tool tests:
   ```bash
   for t in tools/.tests/test-*.sh ; do echo "== $t ==" ; bash "$t" >/tmp/$(basename "$t").log 2>&1 && echo PASS || echo "FAIL($?)"; done
   ```
   Expected: text-to-image + zclaude tests PASS or SKIP-with-reason (provider credentials) — document any SKIP.

**Expected Outcome**:

- No regression: every script test PASSes (including the new `test-spec-coverage-snapshot.sh` and the extended `test-opencode-session.sh`); every tool test PASSes or is documented SKIP. The process/prompt/docs change breaks nothing.

**Notes / Clarifications**:

- `test-build-claude-plugin.sh` and `test-opencode-session.sh` are the most relevant to this change — confirm both PASS explicitly after the edits.

---

#### TC-REGRESS-002 - Existing `opencode-session.sh` assertions still hold after the `default_prompt_for()` edit

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1 (no break)
**Test Type(s)**: Integration (shell)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-opencode-session.sh`
**Tags**: @regression, @scripts

**Preconditions**:

- The `default_prompt_for()` one-line addition is in place.

**Steps**:

1. Confirm the pre-existing invariants still pass (they are part of `bash scripts/.tests/test-opencode-session.sh`):
   - `CREATE THE PR AND LEAVE IT OPEN` present;
   - `Do NOT merge it` present;
   - `Deliver exactly this one workItemRef` + `Do not select, plan, or start a next ticket` present;
   - `full ADOS 11-phase lifecycle` present.

**Expected Outcome**:

- The autonomous-mode instruction is **additive**: all prior prompt invariants remain green; the one-line addition did not alter the stop-at-open-PR, single-ticket, or 11-phase behavior.

---

#### TC-REGRESS-003 - `git diff --check` is clean

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: testing-strategy §"Static/diff checks"
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: repo working tree
**Tags**: @regression, @static

**Preconditions**:

- All delivery edits are staged/committed on the branch.

**Steps**:

1. `git diff --check` → no whitespace errors, no conflict markers.

**Expected Outcome**:

- Clean; no trailing-whitespace or conflict-marker violations across the diff.

---

## 6. Environments and Test Data

- **Environment:** local-dev clone on branch `fix/GH-108/doc-syncer-reliable-spec-coverage`; `rg` (ripgrep), `bash`, `jq`, and `git` available. No network required for pre-merge checks (the post-merge demonstration TC-DOCSYNC-003 needs a live `opencode` CLI + tracker access).
- **Test data:** none generated for the audit/grep cases — all assertions read repo files directly. TC-COVSNAP-001 may build a small fixture under `tmp/` (or an in-test `mktemp -d`) and cleans up on `EXIT`. `/tmp/*.log` outputs from TC-REGRESS-001 are ephemeral.
- **Isolation:** no shared state across checks. Plugin regen (TC-PLUGIN-001) mutates `.ados-claude/` only to the committed baseline state. The new visibility tool is read-only over `doc/spec/features/**` and `doc/changes/**`.

## 7. Automation Plan and Implementation Mapping

| TC ID | Implementation status | Execution command | Mocking | Notes |
|-------|-----------------------|-------------------|---------|-------|
| TC-ROOTCAUSE-001 | Manual Only (grep over spec) | `rg -n -i "mode blindness\|missing check\|de-noise" chg-GH-108-spec.md` | None | Run from the change folder |
| TC-MODE-001 | To Implement (content check) | `rg -n "delivery_mode" .opencode/agent/pm.md` | None | Confirm step-3 + YAML-structure placement |
| TC-MODE-002 | To Implement (grep + review) | `rg -n "delivery_mode" .opencode/agent/doc-syncer.md`; negative grep on session script | None | Portability review is manual (C-4) |
| TC-DOCSYNC-001 | To Implement (content check) | `rg -n -i "delivery_mode\|autonomous\|resolve.*in-change" .opencode/agent/doc-syncer.md` | None | — |
| TC-DOCSYNC-002 | To Implement (content check) | `rg -n -i "reconcile\|not re-authored\|existing spec" .opencode/agent/doc-syncer.md` | None | First-spec-only (DEC-4) |
| TC-DOCSYNC-003 | Manual Only (post-merge demonstration) | live autonomous run + inspect `doc/spec/features/**` + tracker | N/A | Rollout guardrail (PDR-0002 step 6); deferrable |
| TC-OVERFIRE-001 | To Implement (grep + manual probe) | `rg -n -i "feature area\|warrants\|routine edit" .opencode/agent/{doc-syncer,pm}.md` | None | Manual falsifiability probe is core |
| TC-GOV-001 | To Implement (negative grep) | `rg -n "PM must NEVER create new tickets autonomously" .ai/agent/pm-instructions.md`; carve-out negative grep | None | Step 2 = 0 matches is the gate |
| TC-BACKCOMPAT-001 | To Implement (negative grep) | `rg -n -i "interactive\|unchanged\|human.*approv" .opencode/agent/doc-syncer.md`; blocking-prompt negative grep | None | — |
| TC-SESSION-001 | Existing – Update (extend test) | `bash scripts/.tests/test-opencode-session.sh` | None | Add `assert_contains "$(default_prompt_for …)" "delivery_mode: autonomous"`-style case |
| TC-WORDING-001 | To Implement (content check) | `rg -n -i "delivery_mode\|autonomous\|mode-aware" doc/guides/change-lifecycle.md` | None | Confirm Phase-7 placement |
| TC-WORDING-002 | To Implement (content check) | `rg -n -i "delivery_mode\|autonomous\|never creates a spec" .opencode/agent/doc-syncer.md` | None | Qualify report-only language to interactive |
| TC-COVSNAP-001 | To Implement (new tool + test) | `bash scripts/.tests/test-spec-coverage-snapshot.sh`; `scripts/spec-coverage-snapshot.sh` | Optional fixture | Form per OQ-2; assert computable + non-zero |
| TC-PLUGIN-001 | Existing – No Change (script) | `scripts/build-claude-plugin.sh && git diff --stat -- .ados-claude/` | None | Diff set = edited `.opencode/agent/*` |
| TC-SYSSPEC-001 | Existing – Update (reconcile by @doc-syncer) | `rg -n -i "delivery_mode\|autonomous\|status: Current\|GH-108" doc/spec/features/feature-delivery-lifecycle.md` | None | Reconciled (existing spec), not authored |
| TC-REGRESS-001 | Existing – No Change | loop `bash scripts/.tests/test-*.sh` + `tools/.tests/test-*.sh` | None | Document any SKIP |
| TC-REGRESS-002 | Existing – No Change | `bash scripts/.tests/test-opencode-session.sh` (invariant subset) | None | Additive edit must not break priors |
| TC-REGRESS-003 | Existing – No Change | `git diff --check` | None | — |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **RSK-T1 (grep fragility):** content audits depend on the author choosing grep-able phrasing for new terms (`delivery_mode`, `autonomous`, "resolve in-change"). **Mitigation:** each audit case lists recommended anchor phrases; the case passes on any wording that satisfies the grep, and the author is told the anchors up front. The `delivery_mode` token itself is non-negotiable (it is the DM-1 field name).
- **RSK-T2 (post-merge-only demonstration):** the core fix (TC-DOCSYNC-003) cannot be exercised in the PR gate — a live autonomous run is required. **Mitigation:** the mechanism is pinned pre-merge by TC-DOCSYNC-001 (rule encoded) + TC-COVSNAP-001 (drop observable); TC-DOCSYNC-003 is the PDR-0002 step-6 rollout guardrail and may be recorded as deferred to the first real autonomous run.
- **RSK-T3 (shared-file rebase collisions):** `pm-instructions.md` and `change-lifecycle.md` are edited surgically; parallel sibling sessions may collide. **Mitigation:** edits are confined to the Phase-7 / coverage / mode sections; this plan's greps target only those sections.
- **RSK-T4 (governance wording drift):** the verbatim rule must survive surgical edits to `pm-instructions.md`. **Mitigation:** TC-GOV-001 asserts the exact phrase + a no-carve-out negative grep; any edit that softens the rule is a release blocker.
- **RSK-T5 (visibility-tool non-determinism):** the count could vary by branch state. **Mitigation:** the test asserts the count is *computable and non-zero* (not a fixed magic number), so branch churn does not flake it.

### 8.2 Assumptions

- The verbatim governance rule remains canonically in `.ai/agent/pm-instructions.md` (its current home); AC-F2-2's "pm-instructions.md / pm.md" is satisfied by retention in `pm-instructions.md` (mirroring into `pm.md` is optional). TC-GOV-001 does not require the phrase in `pm.md`.
- `.ai/agent/pm-instructions.md` is **not** a `.opencode/` file, so editing it must **not** trigger `.ados-claude/` regeneration — only `.opencode/` edits do (TC-PLUGIN-001 enforces the 1:1 mapping against `git diff --name-only -- .opencode/`).
- The visibility aid's exact filename is open (OQ-2); `scripts/spec-coverage-snapshot.sh` is the recommended form and is what TC-COVSNAP-001/TC-REGRESS-001 name, but the test asserts the **outcome**.
- The new `scripts/` tool is read-only over committed artifacts (`doc/spec/features/**`, `doc/changes/**`) — no destructive writes.
- Authoring-ownership (OQ-1) is a plan decision; no test asserts *which* agent writes the spec.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner |
|----|----------|-----------|-------|
| OQ-T1 | Should the `default_prompt_for()` autonomous-mode instruction also be asserted against a *literal* `delivery_mode: autonomous` token, or is a natural-language instruction ("set delivery_mode to autonomous") acceptable? | No | @coder (TC-SESSION-001 picks one; either passes AC-F3-1) |
| OQ-T2 | If the plan picks a non-`scripts/` form for the visibility aid (OQ-2), how is TC-COVSNAP-001/TC-REGRESS-001 reconciled? | No | @plan-writer (expected: a `scripts/` tool with a test; outcome-based assertion makes it robust either way) |
| OQ-T3 | Should TC-DOCSYNC-003 be promoted to a recurring CI check (e.g., the visibility aid asserting the ratio never regresses) post-rollout? | No | @pm (deferred; mirrors spec OQ-3) |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-02 | @test-plan-writer | Initial test plan for GH-108: 18 scenarios, 13/13 ACs covered (process/prompt/docs fix — audit/grep + demonstration + one new `scripts/` tool test). Incorporates PDR-0002 verification criteria C-1…C-4. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(populated during delivery by @coder / @reviewer / @runner)_ | | | |
