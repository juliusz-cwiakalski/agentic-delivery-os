# Readiness Review Iteration 1

Verdict: READY
Work Item: GH-251
Date: 2026-11-06
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

## Review Basis

Ticket #251 fetched verbatim via `gh issue view` (4 tasks, 4 ACs, out-of-scope list). All four artifacts read in full. Source claims independently verified: `.github/workflows/ci.yml` `bash-tests` job (find expression matches plan task 1.1 character-for-character, `-exec bash` appears only at the suite-execution site); `scripts/checks/ci-topology.ts` additions-only removed-line rule, `BASH_JOBS`/`TS_JOBS` presence loops, exported `validate`/`scanJobFailures` (pure-seam extraction per plan 2.2 is feasible against this shape); `packages/adapters/src/file/yaml-parser.ts:79` and `pm-notes-parser.ts:167,228` `text.length > MAX_SOURCE_BYTES` (1_048_576) exactly as inventoried; failure-object shapes match TC-UTF8LIMIT-002/003/005 deep-equality assertions exactly (incl. absent `line` field at the YAML site); `utf8ByteLength` confirmed module-private in `packages/core/src/domain/queue-ready.ts:86`; NFR-TOOL-005 gap wording quoted verbatim from `doc/spec/nonfunctional.md:156-157`; scaffold "byte-unchanged and authoritative" sentence verified at `feature-monorepo-scaffold-toolchain.md:204`; phase-4 baseline finding section and FSE-05 row exist as plan-4.1 targets; `tests/checks/ci-checks.test.ts` mutated-temp-copy style supports the plan-2.3 fixture shape; test plan's 26 TCs recounted and all 9 ACs traced.

## Adversarial Determinations

1. **PM interpretation — byte-enforcement direction (DEC-1): defensible.** Ticket says "either enforce bytes or rename to characters, per spec truth"; NFR-TOOL-005 verbatim names byte enforcement as the reconciliation direction ("UTF-8 byte enforcement needs reconciliation; do not claim it from the name alone"). Direction grounded in spec truth; no human gate needed.
2. **PM interpretation — AC-1 evidence shape (DEC-6): defensible.** Ticket task 2 itself constrains the control to "behind a flag or a separate workflow step", i.e. the owner anticipated a contained failure assertion, not a permanently red job. The green-run control + run-link recording (TC-CIPROP-013) plus the optional, skip-recordable red demonstration run (plan 4.4) satisfies "demonstrably fails the CI job (evidence: CI run link)" within the ticket's own latitude. Recorded as DEC-6 with rationale.
3. **DEC-7 is necessity, not scope invention.** Empirically verified: the ci-topology additions-only rule fails on *any* removed ci.yml line, so no compliant repair could ship without the allowance. Minimal (one job's run block + comment lines), job-presence loops stay fatal, non-vacuity fixtures specified (plan 2.3, TC-CIPROP-015), precedent routed to PR human review (RSK-7) — properly documented, not silently expanded.
4. **Phase-2 single-commit coherence holds.** Workflow rewiring (2.1), allowance (2.2), fixtures (2.3), and the TC-CIPROP-012 static workflow assertions (2.4) land in one commit (2.5); phase 1 deliberately omits the workflow-dependent assertions (task 1.2) and adds files only, so every interim commit satisfies the additions-only rule and stays green. Runner CWD-rooted zero-argument contract + copied-tree seam resolves GAP-3 without recursion (contract suite and control run against synthetic temp trees only).
5. **UTF-8 approach sound at 1 MiB scale.** O(n) codePointAt replication (module-private, core untouched — consistent with spec §16), generated fixtures with repeated-fill + bounded ASCII tail, rejected cases short-circuit before parse, lone-surrogate=3-bytes consistent between helper and `Buffer.byteLength` oracle.
6. **Known residuals properly documented, not re-litigated:** NG-3/DEC-5 (verify-gates instance), RSK-7 (PR human review), NG-1 (OPEN-Q15 human part) — all pinned in spec, test plan ([OUT]/TR rows), and plan (TC-SCOPE-001 assertions).

## Findings

1. [minor] cross_artifact_consistency — chg-GH-251-test-plan.md#frontmatter (`links.implementation_plan: null`) and §1.2 GAP-1
   Gap: The test plan still declares the implementation plan absent; `chg-GH-251-plan.yaml` now exists and fulfills GAP-1's demands (all 26 TCs mapped, artifact names recorded). Stale link only — traceability content itself is complete.
   Suggested remediation target phase: test_planning
   Suggested fix: Set `links.implementation_plan: ./chg-GH-251-plan.yaml` and mark GAP-1 resolved-by-plan (one-line edit, can ride the delivery-evidence update pass).
2. [minor] decision_capture — chg-GH-251-spec.md#DEC-7 / chg-GH-251-plan.yaml task 4.6(5)
   Gap: DEC-7 is labeled "change-scoped", but the specified implementation is a standing rule: future PRs removing lines inside the `bash-tests` execution block/comment region will also be admitted (no bypass toggle exists by design, TC-CIPROP-015 step 7). The PR human reviewer should judge the actual governance footprint — a standing regional exemption — not just this change's diff. Within the already-routed RSK-7 concern; documentation sharpness only.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Extend plan task 4.6(5) (or the PR description obligation) with one sentence stating the allowance persists beyond this change and applies to future removals within that region, so the open-PR human review decides with the full footprint on record.
3. [nit] test_traceability — chg-GH-251-test-plan.md#TC-CIPROP-005 (vs plan task 1.1)
   Gap: The TC asserts "deterministic ordering across two consecutive runs" while plan 1.1 pins `find`'s natural traversal order (no added sort). readdir order is stable for an unchanged tree in practice but is not a portable guarantee; the normative contract is set-equality.
   Suggested remediation target phase: test_planning
   Suggested fix: Keep set-equality as the asserted contract; soften or drop the cross-run order assertion (or assert it only as a same-tree stability observation) to avoid a theoretical flake.
4. [nit] plan_coverage — chg-GH-251-plan.yaml task 1.4
   Gap: Marking the two new suites executable makes them discoverable by `scripts/test-all.sh` (`-perm -u+x` over `.tests/`), whose semantics task 1.4 declares out of scope without acknowledging the overlap. Harmless (suites are hermetic, fast, passing), but unstated.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add one sentence to task 1.4 noting the executable bit makes the new suites visible to test-all.sh local runs and that this is accepted (or align the bits with existing `.tests` suites' mode).

## Verdict Rationale

All ten facets pass. Ticket tasks 1–4 and ACs 1–4 are traceably covered (spec Appendix A 1:1; plan phases 1–4; test plan 26/26 TCs, 9/9 ACs, 10/10 NFRs, DM-1/DM-2). Both PM interpretations are defensible against the verbatim ticket text and are recorded as change decisions (DEC-1, DEC-6). The reopen history (ci-topology additions-only conflict) is closed consistently across spec v1.1, test-plan rev 1.1, and pm-notes. Blast radius is explicit (15 files across 4 phases), doc impact is registered for both in-change updates and phase-7 reconciliation, and no untestable or self-contradictory requirement was found. The four findings are minor/nit sharpenings that do not fail any facet and carry suggested remediation in test_planning/delivery_planning. Delivery may start; findings 1–4 should be folded in opportunistically without reopening the gate.
