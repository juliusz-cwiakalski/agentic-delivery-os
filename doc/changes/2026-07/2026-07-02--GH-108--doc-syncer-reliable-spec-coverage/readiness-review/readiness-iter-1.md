# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-108
Date: 2026-07-02
Pause Required: no

## Facet Summary
- spec_completeness: PASS — all ticket AC-1..AC-4 fully covered; root cause accurately characterized (resolution-path mode blindness, explicitly NOT a missing check, NOT a de-noise design flaw).
- ac_quality: PASS — 13 ACs in Given/When/Then, testable, traceable, largely non-overlapping.
- plan_coverage: FAIL — plan's governance-verbatim verification checks are unachievable as written (see Finding 1).
- test_traceability: PASS — 13/13 ACs map to ≥1 concrete TC; matrix complete.
- cross_artifact_consistency: FAIL — plan ↔ test-plan disagree on where the governance phrase must reside (Finding 1).
- decision_capture: PASS — PDR-0002 captures D1/D2; spec DEC-1..DEC-7 + Appendix B map constraints C-1..C-4; routing correct.
- system_spec_consistency: PASS — consistent with `feature-delivery-lifecycle.md` (phase 7 = @doc-syncer); additive; governance rule preserved; no silent drift.
- plan_doc_update_coverage: PASS — every phase lists "System docs to update"; phase 7 reconciles the feature spec.
- plan_code_area_coverage: PASS — every phase lists "Affected code areas"; @coder stop-point at phase 7 is correct (reconciliation is @doc-syncer's, not @coder's).
- dod_defined: PASS — spec §17.1 DoD is clear and testable.
- decisions_consistency: WARN — PDR-0002 is consistent with the chosen design and its constraints are honored; one factual misstatement (doc-syncer tier) is non-blocking (Finding 2).

## Verified Authoritative Claims (shipped sources)
- Governance rule verbatim present ONLY in `.ai/agent/pm-instructions.md:40` ("PM must NEVER create new tickets autonomously"). **ABSENT from `.opencode/agent/pm.md`** (exact phrase + any "never create/...tickets autonomously" variant = 0 matches).
- `pm.md` step 3 coverage awareness = "advisory only — not a delivery blocker" (line 218).
- `change-lifecycle.md` Phase 7 = "Coverage is advisory at this phase; it does not block the change" (line 246).
- `doc-syncer.md` report-only rule + "never creates a spec or a ticket" present (lines 131, 142); positive coverage check at line 54.
- `doc-syncer.md` front matter = `claude.model: opus` (PD-1 evidence is correct; PDR-0002's "haiku/scoped" assumption is wrong — Finding 2).
- `doc/spec/**` IS in doc-syncer's write-allowlist ("Safety" rule, line 141) → "natural promotion" argument holds.
- `opencode-session.sh` `default_prompt_for()` exists (line 217); no `delivery_mode` today; stop-at-open-PR intact.
- Inventory: 16 feature specs, 19 change folders (visibility-aid "non-zero" target is achievable).

## Cross-Artifact Vocabulary Check (drift trap scan)
- `delivery_mode` field name + values (`interactive | autonomous`, default/absent ⇒ interactive): identical across spec (DM-1/F-1), plan (Phase 1), test-plan (TC-MODE-001/002), pm-notes.yaml, PDR-0002. ✅
- File names (`scripts/spec-coverage-snapshot.sh`, `scripts/.tests/test-spec-coverage-snapshot.sh`): consistent across plan + test-plan. ✅
- First-spec-only rule (DEC-4/NFR-4): consistent across spec, plan (Phase 2.1), test-plan (TC-DOCSYNC-002). ✅
- No AC/test/plan step creates a tracker ticket in any mode (C-1 honored). ✅
- Interactive back-compat (C-3/NFR-1): consistent across spec (AC-F2-3), plan (Phase 2.1), test-plan (TC-BACKCOMPAT-001). ✅
- OQ-1 resolution (PD-1: doc-syncer authors directly, opus tier) does NOT contradict any AC — no AC hard-codes the authoring agent (AC-F2-1 says "authored, or authoring owned/delegated"). ✅
- Visibility aid (AC-4) has a concrete runnable test (TC-COVSNAP-001). ✅

## Findings

1. [major] cross_artifact_consistency / plan_coverage — `chg-GH-108-plan.md` (Phase 1.6 "Tests", Phase 2 "Acceptance Criteria", Phase TS-4) vs `chg-GH-108-test-plan.md` (§8.2 assumption, TC-GOV-001 step 1)
   Gap: The plan asserts in three places that "PM must NEVER create new tickets autonomously" is retained verbatim in **BOTH** `pm.md` **and** `pm-instructions.md` (e.g. Phase 1.6: *"still present and verbatim in both pm.md and pm-instructions.md"*; Phase 2 AC: *"`pm.md` + `pm-instructions.md` still verbatim"*; TS-4: *"retained verbatim in `pm.md` + `pm-instructions.md`"*). However the phrase exists ONLY in `pm-instructions.md:40` today; it is **absent** from `.opencode/agent/pm.md` (verified: exact phrase + any variant = 0 matches), and **no plan task adds it to pm.md**. Consequence: the plan's own grep verification is unachievable as written, and it directly contradicts the test plan, which correctly treats `pm-instructions.md` as the canonical home and `pm.md` as optional (§8.2: *"TC-GOV-001 does not require the phrase in `pm.md`"*; TC-GOV-001 step 1 asserts `pm-instructions.md` only). This is the canonical spec↔plan↔test-plan drift the DoR exists to catch.
   Suggested remediation target phase: delivery_planning
   Suggested fix: align the plan's governance-verification checks with the test-plan interpretation — require the verbatim rule in `pm-instructions.md` (canonical) and treat `pm.md` as optional (do NOT assert it in both). Alternatively, if the intent is to mirror the rule into `pm.md`, add an explicit task + a recorded decision to do so (but this contradicts the "surgical edit / do not touch governance wording" constraint, so the former is preferred). This is a one-paragraph plan edit; the spec and test plan need no change.

2. [minor] decisions_consistency — `PDR-0002-mode-aware-spec-coverage-resolution.md` (§"Problem Framing → TO CONFIRM", §"Negative Outcomes", §"Unresolved Questions")
   Gap: PDR-0002 repeatedly states doc-syncer's current model tier is "haiku/scoped" and builds the model-capacity concern on that. The shipped source (`.opencode/agent/doc-syncer.md` front matter) is `claude.model: opus`. The spec §25 correctly hedges ("sources disagree on the current tier") and the plan PD-1 verified `opus` directly from the source, so the chosen design and PD-1 are correct and unaffected. Non-blocking: the decision is tier-agnostic at the rule level, PDR-0002 is `Proposed` (human confirms at PR), and the only effect of the misstatement is a stale capacity-risk framing.
   Suggested remediation target phase: (decision record — corrected when the human confirms PDR-0002 at the GH-108 PR; no spec/test-plan/plan action required to unblock delivery)
   Suggested fix: correct the tier references in PDR-0002 to `opus` during PR human confirmation so the record is accurate for the GH-111 reuse precedent.

3. [minor] plan_code_area_coverage / decision_capture — `chg-GH-108-plan.md` PD-3 / Phase 6 (header application to new `scripts/` files)
   Gap: AGENTS.md enumerates configured license-header paths (`.opencode/agent`, `.opencode/command`, `doc/guides`, `doc/documentation-handbook.md`, `tools`) and does NOT include `scripts/`. PD-3 applies headers to the new `scripts/` files via explicit-path invocation of `add-header-location.sh`, justified by empirical consistency, and explicitly flags the AGENTS.md-vs-empirics ambiguity for the PR human review. Non-blocking: handled by the open-PR human gate that autonomous delivery mandates, and the approach (use the script, never hand-add) respects the "AI must never hand-add headers" rule. Advisory only.
   Suggested remediation target phase: (advisory — resolved at PR review; no DoR-phase action required to unblock delivery)

## Notes
- No `needs_human_input` decision: the two PD-2/PD-3 PR-review flags (CEO gate for the new tool; header-path ambiguity) are deferred to the normal open-PR human gate, not mid-flight stops, so `Pause Required: no`.
- PDR-0002 status `Proposed` is acceptable for proceeding — the design (ALT-1) is adopted as chosen input in the spec (DEC-1) and is not re-litigated; human confirmation rides the GH-108 PR.
- This change is NOT eligible for the trivial-override bypass (it alters behavior and contracts); the hard gate applies, and Finding 1 must be resolved before delivery.
