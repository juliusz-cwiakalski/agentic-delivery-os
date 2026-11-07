# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-224
Date: 2026-11-06
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Findings

1. [major] system_spec_consistency — chg-GH-224-plan.md#Phase-4/task-4.4
   Gap: Task 4.4 instructs extending `tests/structure/cli-edge-seam.test.ts` so that "`humanText` declarers are exactly status/brief/doctor per the delivered hook set". The delivered test (`tests/structure/cli-edge-seam.test.ts`, "only brief, closeout, db, plan, queue, status, verify, and watchdog declare the optional human-text renderer") pins an eight-declarer set, and delivered code declares `humanText` in exactly those eight command files (verified: brief GH-228, closeout GH-183, db GH-180, plan GH-226, queue GH-176, status GH-175, verify GH-178, watchdog GH-221). Doctor would be the ninth consumer. Executing task 4.4 as written produces a wrong or red assertion against delivered code; under D10 a red gate blocks the commit, and in `delivery_mode: autonomous` the coder must guess or escalate. Same stale enumeration shape also implied by plan.md line 133 ("the hook's second consumer after status").
   Suggested remediation target phase: delivery_planning
   Suggested fix: In task 4.4, replace "exactly status/brief/doctor" with "add `doctor.ts` to the existing eight-declarer list pinned by `tests/structure/cli-edge-seam.test.ts` (brief, closeout, db, plan, queue, status, verify, watchdog → +doctor)"; correct the "second consumer after status" phrasing at plan.md line 133. No behavior, coverage, or coverage-ledger change.

2. [minor] system_spec_consistency — chg-GH-224-spec.md#F-10 (also §8.5 "Additive renderer consumer", §16 "CLI surface")
   Gap: The spec states the human-text renderer hook was "delivered for status; doctor is its second consumer" (F-10), "gains its second consumer (doctor)" (§8.5), and "the human-renderer hook's second consumer" (§16). Delivered truth: the hook has eight consumers today; doctor is the ninth. The additivity argument is unaffected, but plan task 7.2 carries the same wording into the phase-7 instruction for `feature-status-digest.md` ("doctor as the human-renderer hook's second consumer"), so executing phase 7 as written would propagate a false fact into current-truth docs.
   Suggested remediation target phase: specification
   Suggested fix: Reword F-10/§8.5/§16 to "additive consumer (the ninth) of the optional human-text renderer hook delivered with status and since adopted by brief, closeout, db, plan, queue, verify, and watchdog" (or simply "an additive consumer"); mirror the correction in plan task 7.2's feature-status-digest note during the delivery_planning fix for finding 1.

3. [nit] cross_artifact_consistency — chg-GH-224-test-plan.md#front-matter-links
   Gap: `links.implementation_plan: null` is stale — `chg-GH-224-plan.md` and `chg-GH-224-plan.yaml` now exist and satisfy GAP-1/A-T3 (all 31 TCs mapped, none reshaped). The null link misrepresents the artifact set to tooling and readers.
   Suggested remediation target phase: test_planning
   Suggested fix: Set `implementation_plan: ./chg-GH-224-plan.md` (and note the YAML mirror) or reference both; no content change.

4. [nit] plan_coverage — chg-GH-224-plan.md#Phase-5-Files-and-modules
   Gap: Phase 5 "Files and modules" lists `tests/fixtures/doctor/http-status/**` as "(new)", but Phase 3 already creates that folder (Phase 3 files list and `chg-GH-224-plan.yaml` phase 3 scope). YAML wins, so this is a narrative double-count, but the "(new)" label on an existing folder invites a wrong commit boundary in D10's explicit `git add` protocol.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Remove `http-status` from the Phase 5 "(new)" set (it is consumed there by task 5.2), leaving it solely in Phase 3 scope, matching the YAML.

## Verification Evidence (for re-run dedup)

- Ticket GH-224 (body; zero comments): AC "doctor output names each failing check with a fix hint" → spec §17 maps to AC-F9-1/AC-F2-1 with per-check guarantees AC-F3-1..AC-F7-1 and never-crash AC-F8-1/AC-F8-2; pinned decision ("every failing check names a fix hint; doctor exits 1 with classified errors and never crashes") → AC-F9-1/AC-F9-3/AC-F8-1/AC-F8-2. Ticket tasks (five areas, stable exit codes) → F-2/G-4/AC-F2-1/AC-F9-1..3. No gap.
- Spec v1.1 internal consistency: DEC-11 (structured `httpStatus`, 401/403 → `credential-rejected`) and DEC-12 (two-reason tolerant provider-config read) propagated coherently across §1, §2.1, F-4/F-5/F-7, §7.1, §8.4/§8.5, DM-4, Appendix A rows (tracker/ci/provider), Appendix B, AC-F4-1/AC-F5-2/AC-F7-1, §16, §25. DM-6 = exactly 22 reasons, DM-5 = 11 sources — identical spellings/order in test plan (§3.2, TC-DOCTOR-021) and plan (Pinned Delivery Spellings). Appendix B goldens byte-identical across spec, TC-DOCTOR-015/027, and plan D6 (substituted templates reproduce the strings verbatim). AC count 21 consistent everywhere.
- Test plan: 31 TCs (TC-DOCTOR-001..031), §3.1 covers 21/21 ACs, §3.2 covers DM-1..DM-8, §3.3 covers NFR-1..NFR-10, §8.1 covers RSK-1..RSK-10; §5.1 index and §7 automation table both list all 31; the eight AC-F2-3 negative controls match the spec list one-to-one with verdicts matching Appendix A; §4.2 non-vacuity contract intact (no weakened controls found).
- Plan coverage: 43 tasks across 7 phases; coverage ledger maps all 21 ACs and all 31 TCs two-directionally (spot-checked every AC row and reverse ledger). Phase order correct (contracts→domain→read-slice→CLI→battery→pack/changeset→doc-syncer); error-table machine row + documented row + corpora in Phase 1; trap entry + fixture in Phase 1 with behaviour assertions in Phase 3 (same change); doc-syncer phase present and correctly fenced from `@coder`. Commit subjects conventional-commit compliant (feat/test/chore/docs with GH-224 scope). All four delivery-bound open questions (OQ-T4/T6/T7/T9) pinned as D5/D6/D13/D12; remaining OQs (spec OQ-1..3, OQ-T8) are deferred/seed-maintenance, not behavioral.
- YAML plan: `validatePlan` executed against `chg-GH-224-plan.yaml` with the delivered validator → `{ verdict: "valid", readyForDevelopment: true, errors: [] }`, confirming the PM-notes claim. YAML phase scopes match the markdown narrative phases (the one divergence is finding 4).
- Code seams verified against delivered tree: `providerPayloadFailure`/`providerNotFoundFailure` single-arg constructors exist (`packages/adapters/src/io/provider-transport.ts:73,80`); GitHub client folds non-2xx status into prose today (`packages/adapters/src/github/client.ts:193-197,226-227`); `PARK_CAUSES` = exactly the seven spellings the spec partitions into five wiring-neutral + two credential-caused (`packages/core/src/contracts/provider.ts:40-48`); tolerant config read reason union `"config-invalid" | "provider-chain-unresolved"` with `failureCode: "config.value.invalid"` at `edge.ts:1295-1308`; `DOMAIN_KINDS` ends at `watchdog` (plan appends `doctor` after it); status limits 100/20 (D5 rationale); watchdog refusal identities exist and are excluded; registry row matches the spec's quote; `resolveProviderConfig` at edge.ts:1295, `createStatusCommandRuntime`, `readProviderParkViews`, `readRepositoryFacts`/`parseGitHubRemote` all exist; inventory/v1-contract-inventory/trap-harness/doc-distribution guard/testkit `assertEnvelopeContract`/`guardStore`/state harness all exist; man-page drift `doctor [--fix-hints]` confirmed at the cited location; `.changeset/brief-v1-minor.md` precedent exists.
- Dependencies: PR #209 (GH-175 status) and PR #202 (GH-182 provider) verified MERGED (2026-10-31). The plan builds only on delivered seams.
- Scope: no repair surface, no sixth area, no quota fetches, no new config keys/state schema/packages/subpaths/allowlist entries. The one beyond-literal-ticket surface (additive optional `httpStatus` on the adapter-local failure types, DEC-11) is minimal, additive, decision-captured, and required for the ticket's own hint fidelity on auth rejections — not scope creep.
- No prior readiness records; this is iteration 1. Findings 1–4 are new.
