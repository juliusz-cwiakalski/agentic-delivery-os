# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-170
Date: 2026-10-29
Pause Required: no

Reviewed artifacts: chg-GH-170-spec.md (v1.1, unchanged), chg-GH-170-test-plan.md (v1.3, 38 TCs),
chg-GH-170-plan.md (v1.2, P0–P10), chg-GH-170-pm-notes.yaml. Source of truth: GitHub issue #170
re-loaded via tracker this iteration (OPEN, 0 comments, body unchanged from iter 1/2 — no scope
drift). Binding context: ADR-0003 (Accepted 2026-10-24, PR #163) — DEC-2 "Additional rules"
bullets 1–7 and "Enforcement is mechanical" bullets 1–6 re-read verbatim (ADR lines 497–571,
esp. 535/564); owner directive 2026-10-29; DEC-10/DEC-11 as ratified. Prior records:
readiness-review/readiness-iter-1.md (NOT_READY, 8 findings), readiness-iter-2.md (NOT_READY,
4 findings). Iteration 3 of the ~3-iteration cap — verdict is final-gate: READY or escalate.

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

## Iteration-2 Finding Closure Verification (all 4 verified genuine, mechanically)

1. CLOSED (major, ambient-guard scope + runtime-API allowlist) — Verified by byte-comparison
   against ADR-0003 line 535, not by plausibility. The full neutrality sentence ("`core` `.`,
   `./contracts`, and `./branding` are runtime-neutral: no `bun:*`, no `node:*`, …") is
   byte-identical in test plan §4.1's scope contract (grep -F: ADR 1 / TP 1). The four-location
   allowlist fragment ("the `core ./state` driver code, the adapter I/O subpaths, the CLI build,
   and the OpenCode host integration") is verbatim in both artifacts (ADR 1 / TP 5 / PLAN 2).
   The neutral set — `packages/core/src/index.ts` + `core/src/contracts/**` +
   `core/src/{domain,app,config,branding}/**` — is stated identically in test plan §4.1 and plan
   task 4.2; its derivation (ADR L535 read against the DEC-1 tree, plus L530/L531 domain/app
   purity) is printed and is a ban-direction superset that is itself ADR-mandated, not silent
   drift. The guard self-assertion (TC-015 step 1) is a real gate, not prose: it reads the
   guard's configured scope and asserts **equality** with the neutral set — a guard omitting
   `./contracts` or the `.` entry fails naming the missing path; a guard over-covering (e.g.
   `state`) fails the step-6 `core/src/state` control. It runs under `bun test tests/boundaries`
   → the `test` step of the binding aggregate `check`. Complementary independent gates: TC-014
   step 5 asserts the allowlist names all four ADR locations (narrower allowlist exits non-zero;
   over-enforcement is a defect, not a safe default); TC-016 step 5 registers the `./contracts`
   and `.`-entry ambient cases so the registry meta-check sees the hole even if the config-scope
   assertion were weakened. Plan 4.1 mirrors the allowlist verbatim; plan 4.2 mirrors the scope
   and the self-assertion. ADR bullet citations verified correct (Additional rules bullets
   1–7, Enforcement bullets 1–6 as cited per row).
2. CLOSED (nit, TC-029 missing from §4 layer table) — CI job check row now lists
   "023, 024, 025, 029, 038"; §4 names the post-`build` job `ts-exports`, consistent with §7
   and plan 8.1.
3. CLOSED (nit, allowed-cell controls) — §4.1 now carries a named allowed-cell control matrix
   ("exact, named, not 'some control exists'"). TC-008: 5 controls (adapters→`core ./contracts`
   + 4 NEW surface/`testkit`-src→`@delivery-os/adapters/registry`); TC-009: 15 controls
   (12 surface→core-subpath + 2 testkit→core + 1 adapters→`./contracts`). Counts agree across
   §4.1, TC bodies, §7 automation map, and plan task 4.4. The catch mechanism is genuine:
   fixture manifests declare the allowed deps (so controls test the matrix rule, not
   `subpath-undeclared`), and the harness's clean-cruise precondition (0 violations required
   before injection) makes an over-broad importer rule fail the control cruise — an ADR-allowed
   edge cannot be silently over-blocked. The `core ./state` control note correctly separates
   importer-side subpath permission from callee-side runtime-API confinement.
4. CLOSED (nit, root e2e//bdd dev-edge row 3) — TC-013 Case E: root `e2e/m0.test.ts` +
   `bdd/m0.test.ts` → `@delivery-os/testkit` via root `devDependencies`, expect 0 violations;
   synthetic fixture justified and recorded (A-T10); precondition permits fixture sources
   outside `packages/`; mirrored in plan 4.4 with matching counts (8 violating probes + 2
   passing controls + 1 metadata-only). ADR row 3's "dependency-cruiser plus a passing fixture"
   now has its passing proof.

Deduplication: no finding from iter 1 or iter 2 persists; nothing carried forward as persistent.

## New-content spot checks (no new blocking issue)
- Rule-name parity: all 19 rule names (5 matrix importer, 3 subpath, 2 deep/relative, 5 tier,
  2 testkit, 1 runtime-apis, 2 ambient) present in both artifacts; registry keys on the same
  names (TC-016/plan 4.5), `severity: 'error'` contract stated in both.
- Counts: 38 TCs (index contiguous 001–038), 17 ACs (spec §17), 7 matrix cases, 4 subpath
  forbidden cases, 7+7 tier cases, 8+2+1 testkit cases, 37+2 ambient cases — consistent across
  test plan §4.1/§5/§7 and plan 4.4; revision logs (TP 1.3, PLAN 1.2) match the diffs actually
  present.
- TC-015 arithmetic verified: 2 + 1 + 2 + (8 × 4 = 32) = 37 failing + 2 controls; the deliberate
  rule-id/scope distinction between the `.`-entry and branding env cases is stated.
- Byte-fidelity: every ADR fragment quoted in test plan §4.1 (neutrality, branding-env, tier
  allowed-set, dev-edge rows, relative-form bullet, subpath preamble) matches the ADR exactly,
  with one trailing-punctuation adaptation (preamble colon→period) — no semantic drift.

## Findings (all non-blocking observations under READY — none reopen a phase)

1. [nit | non-blocking] system_spec_consistency — chg-GH-170-test-plan.md §4.1 (neutral-set
   ban list) + chg-GH-170-plan.md task 4.2.
   Gap: the ambient clock/randomness and fs/network ban enumerations (8 identifier forms:
   `process`, `Bun`, `Deno`, `setTimeout`, `setInterval`, `Date.now`, `Math.random`, `fetch`)
   are representative identifiers for the ADR's category wording; a guard implementing exactly
   these forms satisfies the contract while, e.g., `performance.now` in a neutral tier would
   pass. No content exists at scaffold to hit this; the time/identifier ports arrive with
   M0-S2/M0-S3 content.
   Suggested remediation target phase: test_planning (optional ride-along only)
   Suggested fix: none required before delivery; when the first content story extends the
   guard's identifier set, update the §4.1 ban list in the same change.
2. [nit | non-blocking] system_spec_consistency — chg-GH-170-test-plan.md A-T9 + TC-014 step 5;
   chg-GH-170-plan.md task 4.1.
   Gap: `runtime-apis-confinement`'s posture toward surface packages under the strict
   "confined to four locations" reading (ADR L535 final sentence) is deferred (A-T9) — only the
   two scaffold-reachable allowlist locations have behavioral clean-cruise controls; CLI-build
   and OpenCode-host controls arrive with the first such code. Protected in the interim by the
   allowlist-shape assertion; surfaces are types-only at scaffold (TC-006 inventory), so no
   unproven edge ships now.
   Suggested remediation target phase: test_planning (deferral already recorded — no action)
   Suggested fix: none; the deferral is explicit with a named trigger story.
3. [nit | non-blocking] cross_artifact_consistency — chg-GH-170-test-plan.md §4 (fixture
   harness contract step 1) vs TC-013 preconditions.
   Gap: the §4 harness contract says the harness "materialises `packages/*/` from the fixture
   directory"; TC-013 Case E's root-level `e2e/`+`bdd/` files rest on the TC-013 precondition
   ("fixtures can place sources outside `packages/`") rather than on the §4 contract wording —
   a wording seam, not a coverage gap (the precondition is explicit and plan 4.4 mirrors it).
   Suggested remediation target phase: test_planning (optional ride-along only)
   Suggested fix: none required; delivery may add one clarifying clause to the §4 harness
   contract without changing any TC behaviour.

## Positive verifications (no finding)

- Standard applied: starting @coder now would not produce avoidable rework or silently ship an
  unproven edge. Both prior silent-ship failure modes (missing `matrix-adapters-importer`;
  guard-scope drift from the ADR neutrality set) are now gated at three independent layers:
  config-shape assertion (TC-015 step 1 / TC-014 step 5), fixture cases on the exact hole
  (TC-015 Cases C/D; TC-008 adapters cases), and registry meta-check (TC-016 steps 3/5/7).
- Ticket coverage, phase ordering, protected-file fencing, counts (38/17), and the DoD
  walkthrough: unchanged from iter 1/2 verification and still sound; ticket re-verified
  unchanged today.
- Decision hygiene: OQ-1→DEC-10, OQ-T1→DEC-11 correctly routed; OQ-T4 resolved and bound in
  plan 5.3/8.1; A-T9/A-T10 deferrals recorded with protection mechanisms and named trigger
  stories; no unrouted or precedent-setting decision surfaced this iteration.
- The v1.3/v1.2 remediation introduced no new count, ID, or reference drift (mechanically
  re-verified: rule names, TC/AC counts, control counts, ADR-quote byte-parity).

Gate result: READY — delivery (phase 6) may start. No override record needed (hard gate passed
on merits; not a triviality bypass).
