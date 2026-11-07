# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-233
Date: 2026-11-06
Pause Required: no

Reviewer: @readiness-reviewer (adversarial DoR gate, lifecycle phase 5)
Inputs: ticket `juliusz-cwiakalski/agentic-delivery-os#233` (OPEN, milestone M1), `chg-GH-233-spec.md` (v1.0, 509 lines), `chg-GH-233-test-plan.md` (v1.0, 1425 lines, 32 TCs), `chg-GH-233-plan.yaml` (delivery.plan.v1), `chg-GH-233-pm-notes.yaml`, `doc/spec/**` current truth, `doc/decisions/**` (ADR-0008, TDR-0005), `.dependency-cruiser.cjs`, workspace source (read-only, for code-area verification). No prior readiness records; this is iteration 1.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: FAIL

Counts: 0 critical, 1 major (blocking), 3 minor, 1 nit. Every non-blocking finding can be folded into the same revision cycle; only Finding 1 blocks.

## Verification Evidence (what was actually checked)

- **Plan validator (canonical, repo code):** `validatePlan` from `packages/core/src/domain/plan-validate.ts` with `parseConfigYaml` from `packages/adapters/src/file/yaml-parser.ts` over `chg-GH-233-plan.yaml` → `verdict: "valid"`, `readyForDevelopment: true`, 0 errors, 8 phases parsed with declared scope/leases/interactions. Matches the PM-note claim exactly.
- **Code-area existence audit:** all 49 plan/test-plan-referenced existing paths verified present, including the `packages/adapters/src/host/index.ts` scaffold placeholder (the plan's "replaces the placeholder" claim is accurate), `packages/core/src/state/driver/runtime-edge.ts`, conformance suite (`packages/testkit/src/conformance/{adapters,runner,coverage}.ts` + `tests/structure/conformance-coverage.test.ts`), closeout/state/session-admin fixtures, watchdog suites, `tests/behaviour/config-schema.test.ts`, `scripts/.tests/test-{opencode-session,pm-liveness,doc-distribution}.sh`, all 8 Phase-8 doc files, both decision records, and the `.changeset/gh-225-merge-verify-deploy-minor.md` naming precedent. CI job names (ts-test/boundaries/invariants/license-audit/vuln/forbidden-literals/aggregate) match `.github/workflows/ci.yml`.
- **Runtime-API confinement precedent:** `.dependency-cruiser.cjs` already allows `^packages/adapters/src/(repo|file|host|session|legacy|credentials)/` (folder-level, reason-bearing) — the plan's Phase-5 `^packages/adapters/src/harness/` allowance follows the established pattern; `host` is indeed already allowed as the plan states.
- **Dependencies:** GH-181 CLOSED 2026-10-30, GH-202 closed-by-merge 2026-10-31 (verified via tracker) — the ticket's "(ticket pending)" note is stale, as the spec records.
- **Boundary-router runtime:** `pnpm typecheck` includes `tsc -p tests/types/tsconfig.json`, so the plan's `tests/types/harness.type-test.ts` gate is real. Bun pin 1.4.4 matches the test plan. `TC-HARN` prefix has no prior use in the repo. `doc/spec/features/feature-harness-adapters.md` absent (correctly created in-change).
- **Ticket→AC traceability:** the mapping (AC1→AC-F2-1, AC2→AC-F2-2, AC3→AC-F5-1, AC4→AC-F5-2, AC5→AC-F8-1) is identical in spec §17, test plan §1.1, and plan task 8.6. All five ticket ACs are Given/When/Then testable; all 32 TCs cover all 12 ACs, 9 NFRs, EVT-1, DM-1..4 with no uncovered AC and no orphan TC.

**PM-recorded context decisions — challenged and upheld:** (a) DEC-1's adapter/port-boundary satisfaction of ticket AC 1 is sound: the backlog's rank-33 row (M1-S11 itself) reads "The dispatch pilot needs the harness port", M1-S9 (rank 39) is the milestone-closer consumer, and shipping a dispatch engine here would collide with M1-S17/S18/S9 sequencing; the interpretation is recorded with basis in three artifacts and the plan forbids a composition edge. (b) The proxy-test posture (GAP-T1..T7, each with a pinned resolution mechanism in spec §14) is honest about what CI can and cannot prove; RSK-4/R-T1 make mock-only proof structural rather than a coverage claim. (c) Dependency closure verified. (d) The YAML-only plan is the canonical format per the transition rule and validates green. No override record is needed or used.

## Findings

1. [major] [BLOCKING] dod_defined — chg-GH-233-spec.md (no Definition of Done section anywhere in §1–§25)
   Gap: The spec contains strong completion ingredients (§4.1 measurable success metrics, §17 testable ACs, §18 rollout) but never binds them into an explicit change-specific Definition of Done — `grep -ci "definition of done"` over the spec returns 0. `doc/guides/definition-of-done.md` is explicit: "Every change must define its own DoD in its spec — concrete, testable, and traceable to its acceptance criteria… delivery cannot start without a clear, testable DoD written into the spec." Repo precedent enforces this at this exact gate, twice: GH-173 DoR iteration 1 and, one day before this change, GH-228 DoR iteration 1 (2026-11-05), which rejected precisely the "strong ingredients but no explicit DoD" posture as blocking (GH-228 spec v1.2 §17.1 was the remediation). The plan's `doneArtifacts` and task 8.6 PR checklist do not substitute — the gate requires the DoD in the spec, and the pm-notes DoD instruction ("DoD must cite DEC-1 and the GAP records") currently has no spec-level DoD to attach to.
   Suggested remediation target phase: specification
   Suggested fix: Add an additive "Definition of Done (change-specific)" section (e.g. §17.1, mirroring GH-228 v1.2) binding: all 12 ACs green with traceable TC evidence; all 9 NFR thresholds met with measured evidence recorded in test-plan §10; §4.1 success-metric rows with per-row verification; the DoD citing DEC-1 and GAP-T1..T7 (per the PM decision) rather than literal ticket wording; bash-era suites green and untouched; error-table/inventory reconciliation green; `pnpm check` green on a clean checkout; exactly one lockstep changeset; TC-HARN-032 documentation posture satisfied via the phase-7 handoff; PR targeting main-tools with CI green. Fail-closed closing rule: a condition without passing evidence is not done. Do not renumber or weaken existing ACs — additive only.

2. [minor] test_traceability — chg-GH-233-spec.md#F-3/§8.4 vs chg-GH-233-test-plan.md#§1.1/§3.1
   Gap: F-3 and §8.4 name "session listing for discovery" as opencode-adapter behavior being ported, but no TC exercises a listing/introspection call — it appears only as a declared capability (TC-HARN-001/002 assert the declaration) and as fixture-header documentation (TC-HARN-010 step 6, GAP-T2's "spawn/resume/list mapping"). The ticket's task wording ("porting today's bash session spawn, resume, and liveness handling") does not require listing, so nothing ticket-level is uncovered; this is a spec-internal facet without a behavioral test, which invites the coder to either invent an untested surface or silently skip a named capability.
   Suggested remediation target phase: test_planning
   Suggested fix: Either add a listing/introspection assertion (e.g. a step in TC-HARN-008 or TC-HARN-010 driving the session-list seam over injected I/O and asserting the mapping/absence behavior) or narrow F-3/§8.4 to the proven facets (spawn, resume/steer, liveness, classification) and record session listing as a declared-but-deferred capability in §7.3. One-line matrix note either way.

3. [minor] cross_artifact_consistency — chg-GH-233-spec.md#DEC-1 (and §Appendix A) vs chg-GH-233-pm-notes.yaml notes 2026-11-06 vs doc/planning/oss-tooling/backlog-ranking.md
   Gap: DEC-1's rationale states "the dispatch pilot M1-S9 rank 33: 'The dispatch pilot needs the harness port'". Verified against backlog-ranking.md: rank 33 is M1-S11's own row (whose rationale carries the quoted sentence); M1-S9 is rank 39. The pm-notes carry both readings ("M1-S9 rank 39" in the scope-interpretation note; "backlog-ranking rank 33" quoting the rationale in the later note). The substance — the dispatch pilot is a later consumer that needs this port — is fully supported either way, so the boundary decision stands; only the citation conflates two rows.
   Suggested remediation target phase: specification
   Suggested fix: Correct DEC-1/Appendix A to cite "M1-S11's rank-33 rationale ('The dispatch pilot needs the harness port'); the dispatch pilot M1-S9 ranks 39". Fold into the Finding-1 revision; do not reopen the decision.

4. [minor] system_spec_consistency — chg-GH-233-spec.md#§2.1/§13 (and chg-GH-233-pm-notes.yaml note 4) vs doc/decisions/ADR-0008-harness-adapter-contract.md frontmatter and doc/decisions/00-index.md
   Gap: The spec asserts ADR-0008 "is accepted as this change's governing boundary" and pm-notes say "accepted at M0-S17"; the ADR itself records `status: Proposed`, `decision_date: null`, decider "acceptance pending at GH-186 PR review" — although GH-186's PR #207 merged 2026-10-31 and current truth (feature-adapter-ports.md) already records the contract as "implemented in M1-S11". Register-wide, 8 of 10 ADRs rest at Proposed, so this is register drift rather than a governance hole; but the spec's factual claim contradicts the repo's own decision register as written, and RSK-8 leans on the ADR's "recorded" status.
   Suggested remediation target phase: specification
   Suggested fix: Align the wording to the register ("recorded at M0-S17 (GH-186, merged) and adopted as the design baseline by the accepted M1 plan") in the Finding-1 revision. Decision routing (system, non-blocking, for @pm): if the GH-186 merge constituted acceptance, delegate the ADR-0008 status flip (and the stale "acceptance pending" decider line) to @decision-advisor as a decision-record correction; do not gate GH-233 on it.

5. [nit] plan_doc_update_coverage — chg-GH-233-spec.md#§18 vs chg-GH-233-plan.yaml Phase 1 / Phase 8 scope
   Gap: Spec §18's phase-7 reconciliation list omits two docs the plan (correctly) touches: `doc/spec/features/feature-result-contract.md` (extended in Phase 1 so the new `harness.*` error rows land doc/table/inventory-synced in the same commit) and `doc/spec/features/feature-adapter-conformance.md` (the harness conformance registry, named in spec §16 but missing from §18's list). The plan is a superset — nothing is missing — but the two lists should not drift.
   Suggested remediation target phase: specification
   Suggested fix: Add both files to §18's reconciliation note during the Finding-1 revision (marking result-contract as delivered in the error-table commit, Phase 1).

## Decision Routing

- `change`: Finding 1 (DoD section), Finding 3 (citation fix), Finding 5 (§18 list sync) — all spec-side, one additive revision.
- `change`: Finding 2 — test-plan-side touch-up, same revision cycle if convenient.
- `system` (non-blocking, delegated): ADR-0008 register status reconciliation (Finding 4) — @pm to delegate to @decision-advisor; not a gate condition for GH-233.
- `needs_human_input`: none. No pause flag.

## Gate Result

NOT_READY. One facet fails (dod_defined) on one blocking finding (Finding 1). Reopen `specification` for a single additive revision (change-specific Definition of Done; Findings 3/4/5 are wordings foldable into the same edit). Finding 2 is a `test_planning` touch-up that should ride the same cycle so iteration 2 can close everything at once. Delivery remains blocked until a READY verdict; re-run this gate after revision. No human input required; no override applicable (this change adds behavior and contracts — the override path is explicitly unavailable).
