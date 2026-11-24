# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-394
Date: 2026-11-24
Pause Required: no

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
- dod_defined: PASS

## Remediation Verification (iter-1 findings, verified in artifacts — not taken on faith)

1. **F1 (critical, engine.ts forwarding fence) — REMEDIATED.** Spec rev 1.1 verified: F-4 detail (§5.1) now states the forwarding scope expressly — provider-engine park-evidence build + failure reconstruction, announcement derivation, merge-chain refusal reconstruction — and fences ONLY the pending-park semantics of the park construction for #395 (§7.1 bullet, §7.2 [OUT], NG-9, §8.2, §10, §16 rows, DEC-14). DEC-14 records the correction with the owner's D3 rationale ("collapse the failure into a fixed shape today … unless each is edited" — verified verbatim in the governing draft, line 136). Code truth re-verified at HEAD 0ca7fe4d: the collapse sites exist exactly as scoped (engine.ts builds park evidence from `failureClass`+`credentialRefName` at :291/:306; reconstructs from the parked condition at :799; announcements.ts:48 maps code-only) — they are now in scope, so the deterministic-STOP defect is gone. Escalation trigger rewritten (plan header line 6): pending-park region + daemon-compose forbidden; unmapped-site discovery is a STOP-and-report (map omission), never a constraint violation. AC IDs unchanged; AC-F4-2 stands; test plan TC-REMEDY-003 restated on the corrected fence with an explicit supersession note.
2. **F2 (major, merge chain orphaned + uncommitted site map) — REMEDIATED.** Plan rev 2: phase 4 scope extended to 18 files — engine.ts (forwarding-only), announcements.ts, merge.ts, merge-transaction.ts, merge-text.ts, dispatch.ts, app/dispatch.ts, simulate.ts all present. Committed forwarding-site map verified **independently reproduced at HEAD 0ca7fe4d: exactly 46 literal sites across 19 source files** — per-file counts match the map row for row (edge 11, production 5, serve 4, engine 3, harness 3, merge-transaction 2, harness-spawn-env 2, credentials 2, app/dispatch 2, cli/index 2, adapters/credentials 2, +8×1); 2 derivation-only files (announcements.ts, merge-text.ts — zero literals, confirmed); every OWNS file maps to exactly one phase scope; 4 untouched files named with reasons (harness.ts :362/:374/:381 verified as definition-site rows). Spot-checked anchors all exact: merge.ts trustedRefusal arm, dispatch.ts :69 marker, app/dispatch :153/:385, simulate.ts :438, merge-transaction :296/:362/:604-620 (`landingFaultIdentityOf` mapping arm), merge-text :80 delegation.
3. **F3 (major, guide-pinning pairing ownership) — REMEDIATED.** Phase 6 title, summary, and binding comment assign the guide reversal (`doc/guides/tracker-credential-provisioning.md`) + test re-pin (`tests/checks/tracker-credential-provisioning-guide.test.ts`) as ONE coder-owned commit in phase 6; doc-syncer's no-source-edit contract honored; the plan-wide Guide-pairing fence makes the red-window argument explicit (no commit boundary ever observes old-test-vs-new-guide). Verified the pinning test currently pins `toContain("only an environment source")` and the guide carries the sentences at :19/:33 — phase 6's re-pin anchors are accurate as of HEAD. Phase 7 is declaration-only for docs; doc-syncer edits no source anywhere in the plan.
4. **F4 (major, no DoD) — REMEDIATED.** Spec §17.1 added: 20/20 ACs via mapped TCs + manual/post-merge demonstration; phase commits through the commit primitive with passing boundary gates; `pnpm check` incl. the tripwire + doc-distribution guard green; §18 reconciliation complete (incl. the re-pinned check); ADR-0014 `Proposed`/`decision_date: null` + index/register rows; OQ-1..OQ-3 typed outcomes; PR open against main-tools; merge authority and Accepted-status human-only. Testable and consistent with the plan's phase fences (each phase ONE commit; phase 6 verify commands cover the ADR/guide/distribution checks).
5. **F5 (minor, name-only rule) — REMEDIATED.** §18 adds the merge-landing name-only-evidence reconciliation note; §20 and §21 state the fields are name-shaped evidence (identifier-only source, closed reason token, fixed remedy text) with the rule's scope unchanged; plan map preserves the delivered name-only site (:595-609) with name-shaped forwarding; phase 7 scope includes `doc/spec/features/feature-merge-verify-deploy.md`.
6. **F6 (minor, doc scope mismatch) — REMEDIATED.** Phase 7 scope = changeset + exactly the six reconciliation targets of spec §18 rev 1.1; `feature-resident-daemon.md` and `feature-harness-adapters.md` excluded explicitly, each with its reason (daemon composition unchanged; harness adapter posture gains no new truth).
7. **F7 (nit, seam wording) — REMEDIATED.** Four construction inputs (active harness identity, child runner, environment record, store facts) aligned across spec F-8 detail, AC-F8-2, test plan §1/TA-1/TC-HERM-001, and the plan's Hermeticity fence. "Store facts" is the fourth seam everywhere; the allowlist table is shipped closed data, not a seam.
8. **F8 (nit, stale pointers) — REMEDIATED.** Test plan rev 1.1: OQ-T1..T4 resolved against the plan's fixed constants (253/64, 256 KiB, DBUS_SESSION_BUS_ADDRESS + XDG_RUNTIME_DIR, >=2.3.2 <3.0.0); no "pending — authored in phase 4" residue; merge-refusal surfaces folded into TC-REMEDY-001 (renderer pass-through step), TC-REMEDY-003 (restated arm), TC-REDACT-001 (swept set) with existing TC IDs kept. Independently counted: **37 unique TCs; coverage matrix 20/20, all Covered, none TODO.**

## New-Fact Ruling — site-count delta (46/19 vs ADR Context's 37/16)

**Disposition ACCEPTED.** Verified independently: the governing draft's Context (line 106) states 37 sites across 16 files as its authoring-time analysis (11+5+4+3+2+2+10×1, 6+10 files); the plan's committed map, re-enumerated at HEAD 0ca7fe4d and dated 2026-11-24, states 46 across 19 (+2 derivation-only) — reproduced exactly by this review's own repository scan. The delta (+9 sites, +3 files) accumulated from post-snapshot deliveries and is directionally benign: more branch sites strengthens, never weakens, the one-code rationale the figure supports. Ruling basis: (a) the ADR lands unmodified as `Proposed` per the ADR fence — editing its authored Context figures pre-landing would alter the record the owner shaped and expects to review; (b) the plan map is the operative verification surface — the escalation trigger names the map as the fence and turns any delivery-time undercount into a STOP-and-report map omission; (c) the delta is disclosed in the committed map itself ("the governing record's context enumerates 37 … this map is the current-truth re-enumeration"), so the owner reviewing the PR sees both figures with their attributions. No artifact change required. **Non-blocking observation for @pm/@pr-manager:** surface the 37→46 / 16→19 delta in the PR description so the owner's ADR-0014 acceptance is explicitly informed — PR-stage enrichment, not a gate condition (the disclosure already exists in the committed change folder).

## Deduplication

All eight iter-1 findings are closed by the verified remediations above; none is repeated. No new blocking gap introduced by the remediation. Residual nit-class observation (spec F-4 rationale's bare "(37 enumerated consumer sites)" parenthetical carries no as-of qualifier) is resolved in substance by the map's explicit attribution of both figures and requires no artifact change — recorded here, not re-raised in a future iteration.

## Decision Routing

- F1's fence correction (DEC-14) is a change-doc decision grounded in the owner's own ticket text; correctly recorded in spec §15 + plan header. No new decision record required; ADR-0014 routing unchanged (lands `Proposed`, owner decides at PR).
- The 46-vs-37 ruling is change-doc level (committed map disclosure); PR-description pointer routes to @pr-manager as enrichment.
- No `needs_human_input`; Pause Required: no.

## Gate Result

**READY** — all ten facets pass; delivery may start. Escalation budget note: one iteration remains unused; this gate does not predict its need. The ADR-0014 acceptance, merge, and PR review remain owner acts downstream, per spec §17.1.
