# Readiness Review Iteration 4

Verdict: NOT_READY
Work Item: GH-176
Date: 2026-10-31
Pause Required: yes

## Gate Summary

- Findings: 6 new — **1 major, 2 minor, 3 nit**. No critical.
- Blocking finding: **R-37** (test plan AC-F14-1 row and TC-QREADY-021 expected outcome over-broad and unsatisfiable; contradicts spec AC-F14-1, AC-F10-1, and the test plan's own `ready-unknown-association` / `at-limit-pr-no-match` corpus rows).
- Iteration-3 closure: **R-30, R-31, R-32, R-33, R-34, R-35, R-36 are all independently verified closed** (see the closure table below).
- Facets failing: `test_traceability`, `cross_artifact_consistency`.
- Primary remediation targets: `test_planning` (R-37, R-38, R-41), `delivery_planning` (R-39), `specification` (R-40, R-41). Do not reopen `delivery`.
- The PM-authorized scoped R-30..R-36 correction pass did **not** introduce a regression in the provider-mapping, identity, count, identity-projection, duplicate, or byte-arithmetic rules. The new blocker is a pre-existing negative-control assertion defect that the previous three passes did not surface.
- **Human process decision required:** iteration 4 returns a new major finding outside the PM's R-30..R-36 authorization. Under the PM's own process decision, delivery stops for human input. Options: authorize one scoped `test_planning` correction pass for R-37/R-38/R-41 and a re-gate, or record an explicit accepted risk. The Definition-of-Ready override is **not** available because this change alters behavior and contracts.

## Facet Summary

- spec_completeness: PASS (ticket coverage complete; R-30..R-36 pinned; only wording nits R-40/R-41)
- ac_quality: PASS (the ACs themselves are precise; R-37 is a test-plan restatement defect, not an AC defect)
- plan_coverage: PASS
- test_traceability: FAIL (the AC-F14-1 coverage row misstates the AC; TC-QREADY-021's expected outcome contradicts it)
- cross_artifact_consistency: FAIL (test plan vs spec vs its own corpus; plan PM-NOTE-1 vs test plan)
- decision_capture: PASS
- system_spec_consistency: PASS (provider mapping verified against the delivered status domain and `doc/spec/features/feature-status-digest.md`)
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS (the plan's Definition of Done plus 23 ACs / 11 NFRs are explicit and testable)

## Iteration-3 Finding Closure Status

| Iter-3 finding | Status | Independent verification |
|---|---|---|
| R-30 provider config failure by `StatusProviderConfigRead.reason` | **Closed** | Spec F-9 (line 167), AC-F9-1 (line 481), Appendix A (line 579), Appendix D (lines 681/685), DEC-8 (line 413), and the v1.4 history (line 781) now map `{ok:false, reason:"config-invalid"}` → `config-invalid` and `{ok:false, reason:"provider-chain-unresolved"}` → `provider-chain-unresolved`, never blanket-mapped; the defensive `ok:true` declared-chain-missing view stays `provider-chain-unresolved`; the park fold stays `provider-parks`/`state-unreadable`. This matches the delivered code: `packages/core/src/domain/status.ts:924-931`, `packages/cli/src/edge.ts:613-625`, `packages/core/src/provider/validate.ts`, and `packages/core/src/contracts/status.ts:294-300`. The current system spec (`doc/spec/features/feature-status-digest.md:164,210`) states the same. Plan RES-8 (line 118), the provider table row (line 216), task 4.1, and test plan GAP-14 (line 74), the AC-F9-1 row (line 116), TC-QREADY-012 steps 5-6 (lines 716-717), and corpus rows `not-ready-provider-unresolved`/`not-ready-provider-config-invalid` (lines 1789-1790) agree. |
| R-31 candidate-set-scoped identity observation wording | **Closed** | Spec F-2 (line 160) now qualifies per-candidate condition independence with candidate-set-scoped identity observation: a shared bare numeric suffix leaves the item unobserved for every sharing candidate, no precedence and no caller order; §8.3 (lines 284/287) says the same and AC-F2-3 (line 473) covers the `GH-7`+`PDEV-7` `"7"` ambiguity. Plan RES-6 (line 116), the candidate-observation sub-rule (line 220), task 3.2, and D6 (line 302) agree; test plan summary (line 10), §1.1, §4.2, TC-QREADY-032 (line 1453), TC-QREADY-036 steps 5/10-11 (lines 1620, 1625-1626), and corpus `identity-ambiguous-suffix` (line 1762) agree. |
| R-32 deps state-count detail sums to total blocked-by targets | **Closed** | Spec F-4 (line 162), AC-F4-1 (line 475), Appendix A (line 581), and Appendix D (line 687) now say the three counts sum to the total number of `blocked-by` relation targets (observed + unobserved), not the observed-target count. Plan RES-2 (line 112) says the same and pins done+canceled under `done`; the condition table (line 211), task 3.1 (line 485), NFR-1, and the DoD (line 690) agree. Test plan lines 110, 417, 459-461, 1650, 1824, and the Open-PR DoD (line 1955) agree, including the `done:0; open:0; unknown:1` oracle. No "observed target count" reading remains in any normative section. |
| R-33 target uniqueness domain = observed work-item set; canonical observed target not requested resolves by exact match | **Closed** | Spec §8.3 (line 289) pins target resolution against the observed work-item set: exact full-value identity wins; a bare all-ASCII-digit target bridges only when exactly one observed item carries the suffix; ambiguity or no match is `dependency-unobserved`; a canonical-shaped target not observed stays `dependency-unobserved`. F-4 (line 162) and AC-F4-2 (line 476) add the canonical-observed-but-unrequested exact-match case. Plan RES-6 (line 116), the deps sub-rule (line 222), task 3.1/3.2, and D9 (line 305) agree; test plan AC-F4-2 row (line 111), TC-QREADY-037 steps 3/5-7 (lines 1656-1660), the corpus `relation-target-canonical-unrequested` (line 1767), and the meta-check (line 1834) agree. |
| R-34 projected identities `entityId`-only, no `systemName`; whole identity object ≤128; tests assert absence | **Closed** | Spec DM-2 (line 242), DM-6 (line 246), DM-11 (line 251), Appendix B (lines 601/607), AC-F12-2 (line 485), NFR-2 (line 321), and §20 (line 512) now project every provider-qualified identity as `entityId` only; `systemName` is omitted, so the whole projected identity object is the capped 128-character `entityId`; the nine caps are unchanged (no tenth cap). Plan `QueueReadyWorkItemRelation`/`QueueReadyPullRequest` (lines 179-181), the projection rule (line 227), D7/D9, RSK-14, and tasks 5.1/5.3/6.1/6.2 agree. Test plan AC-F12-2/DM-2/DM-6/DM-11/NFR-2 rows, TC-QREADY-018/019/038, the over-long `systemName` (200-character) fixture, and the meta-check assert the key and value are absent from payload and digest. |
| R-35 duplicate-ref wording | **Closed** | Spec F-2 (line 160), AC-F1-1 (line 468), and DEC-15 (line 420) now say the candidate set is canonicalized refs; duplicates are detected after canonicalization and rejected, never silently merged. Plan lines 35-37, 281-282, 386, task 2.1/2.4, and the DoD (line 692) agree. Test plan AC-F1-1 row (line 103), TC-QREADY-001 step 3 (line 308), TC-QREADY-032 step 3 (line 1465), and the corpus meta-check state the same. No "de-duplicated" candidate wording remains. |
| R-36 proxy-suffix byte count | **Closed** | Spec Appendix F (line 713) and DM-12 (line 252) state 41 bytes; plan line 275 states 41 bytes. I independently counted `[repo:local-context; tier:priority-label]` at 41 ASCII bytes. No 43-byte figure remains in any normative section (only in revision-history text). |

## Claims Checked (verification notes, not findings)

- **Counts.** 38 TCs (TC-QREADY-001..038), 23 ACs (AC-F1-1..AC-F17-1), 11 NFRs, and 13 DMs; the plan has 7 phases / 39 tasks and maps 38 TCs, 23 ACs, and 11 NFRs with zero orphans. All three artifacts agree on the counts.
- **System-spec consistency.** The provider mapping matches the delivered status domain and `doc/spec/features/feature-status-digest.md:164,210`; the queue/lane section remains `not-delivered` and explicitly leaves `queue ready` to M0-S7.
- **Feasibility.** `StatusCommandRuntime` already exposes repository, issues, pulls, check-runs, provider-config, park-fold, local-context, and clock reads (`packages/cli/src/commands/status.ts:27-43`); `createStatusCommandRuntime` is exported (`packages/cli/src/edge.ts:251`); `StatusFacts` carries the raw normalized reads the evaluator needs (`packages/core/src/contracts/status.ts:352-361`). Extracting `collectStatusFacts` and `classifyPipelineRuns` adds no adapter read.
- **Identity live-shape.** `packages/adapters/src/github/normalize.ts` emits bare numeric `identity.entityId` for issues, PRs, and relation targets; the §8.3 bridge and exact-match target rule are reachable on the live slice.
- **Bounds.** The nine provider-derived caps, 64 KiB machine, 16-line/4096-byte human, 64-character ref cap, 0..100 `associatedCount`, and the six-reason cap are consistently stated in spec, plan, and test plan; R-34 removes the only unbounded projected value.
- **Read-only and boundaries.** No new error row/domain kind, configuration key, state-schema change, adapter operation, package, subpath, runtime-API location, or secret-read allowlist entry is planned. The actual forbidden-literal allowlist has five entries; the secret-read allowlist has four. The command reuses the delivered reads and is pure in the domain tier.
- **Scope.** Six conditions, close ranking, read-only posture, and identity/cap rules trace to the ticket and PM decisions. The bounds, fixture corpus, and live smoke are defensive, not product scope creep.

## Findings

1. [major] test_traceability / cross_artifact_consistency — `chg-GH-176-test-plan.md` AC-F14-1 coverage row (line 122), TC-QREADY-021 `Then` (line 1044) and Expected Outcome (line 1066), with steps 1-2 at lines 1054-1055; `chg-GH-176-spec.md` AC-F14-1 (line 487) and AC-F10-1 (line 482); the same test plan's corpus rows `ready-unknown-association` (line 1756) and `at-limit-pr-no-match` (line 1799).
   Gap: TC-QREADY-021 asserts that the 22 negative controls yield "no ready candidate, a satisfied condition, a merge-ready claim, a new-start claim, or an all-clear" and that "no control becomes ready, satisfied, merge-ready, new-start, or an all-clear". That is stronger than the spec. AC-F14-1 forbids a satisfied condition only **from an absent, failed, unattempted, unavailable, or unresolved source**, and forbids a ready claim only **when a condition is non-satisfied**; AC-F10-1 explicitly allows a ready candidate with an unknown close association. The test plan's own corpus proves it: `ready-unknown-association` is `S S S S S S`, `ready: true`, close `unknown`, and `at-limit-pr-no-match` is also ready with `unknown` close. The matrix controls are built from a "fully-satisfiable baseline" with one source degraded, so the PR-read-failure (control 20) and at-limit-no-match (control 22) controls keep all six readiness conditions satisfied and the candidate is ready. The matrix's blanket "no ready candidate / no satisfied condition" is therefore unsatisfiable as written (or forces the test author to make the close controls artificially not-ready, weakening the intended coverage and contradicting the corpus).
   Suggested remediation target phase: test_planning
   Suggested fix: Scope the assertion to the affected condition/source: "no control yields a satisfied **affected** condition from an absent/failed/unattempted/unavailable/unresolved source; no control yields a ready claim **when a condition is non-satisfied**; the PR-read-failure and at-limit controls yield `unknown` close association and never `new-start`, while unaffected satisfied conditions and a ready candidate with `unknown` close are allowed." Either state that the matrix's close controls are deliberately not-ready (and why that does not weaken the coverage) or let them be ready and assert the close class instead. Apply the same correction to the AC-F14-1 coverage row, TC-QREADY-021 steps 1-2/Then/Expected Outcome, and any matching plan DoD wording. Keep AC-F14-1/AC-F10-1 unchanged.

2. [minor] cross_artifact_consistency — `chg-GH-176-test-plan.md` TC-QREADY-028 step 10 (line 1322).
   Gap: The meta-check requires a "provider-cap row (`provider-over-cap-fields`, `provider-chain-unresolved-command`)". No artifact defines `provider-chain-unresolved-command`: the corpus row is `not-ready-provider-unresolved` (line 1789), the fixture is `unresolved-chain-command` (TC-QREADY-012 line 705; plan line 528), and the plan's corpus list names `not-ready-provider-unresolved`. This conflicts with TC-QREADY-028 step 9 ("every meta-check key has a case") and makes the meta-check reference a nonexistent case.
   Suggested remediation target phase: test_planning
   Suggested fix: Replace `provider-chain-unresolved-command` with the actual corpus row `not-ready-provider-unresolved` (or the fixture `unresolved-chain-command` if the meta-check intentionally keys on fixtures) and align the plan's task 6.1 reference.

3. [minor] cross_artifact_consistency — `chg-GH-176-plan.md` PM-NOTE-1 (line 119) versus `chg-GH-176-test-plan.md` `all-unknown-degraded` (line 1798) and `chg-GH-176-spec.md` Appendix G (line 740).
   Gap: The plan says the corpus rows `not-ready-ci-addressing-unresolved`, `not-ready-ci-remote-unsupported`, `not-ready-ci-credential-unavailable`, and `all-unknown-degraded` assert the composed outcome `? S ? ? ? S`. The last row is `? S ? ? ? ?` in both the test plan and the spec because the degraded case also fails the provider config and park fold, so `provider-available` is `unknown`. The plan's parenthetical is wrong for `all-unknown-degraded` (the three binding/credential rows are `? S ? ? ? S`).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Correct the PM-NOTE-1 parenthetical to scope `? S ? ? ? S` to the three binding/credential rows and state that `all-unknown-degraded` is `? S ? ? ? ?`.

4. [nit] spec_completeness — `chg-GH-176-spec.md` §8.3 (line 289, final sentence).
   Gap: The sentence says "the target bridge exists for provider-native or canonical-shaped targets compared against canonical-shaped observed identities". A canonical-shaped target is resolved by the exact full-value rule, not by the numeric bridge; only a bare all-ASCII-digit target bridges. The sentence is explanatory, but it can be read as allowing a suffix bridge for canonical-shaped targets (for example `GH-179` against an observed `PDEV-179`), which the normative rule forbids.
   Suggested remediation target phase: specification
   Suggested fix: Reword to "the target bridge exists for provider-native bare-digit targets compared against canonical-shaped observed identities; a canonical-shaped target is resolved only by the exact full-value rule".

5. [nit] spec_completeness — `chg-GH-176-spec.md` F-2 (line 160).
   Gap: "Each input ref must match `QUEUE_READY_WORK_ITEM_REF_PATTERN` exactly: input matching is case-insensitive" reads as a contradiction ("exactly" versus case-insensitive). The intended rule is clear from the rest of the paragraph, but the wording is loose.
   Suggested remediation target phase: specification
   Suggested fix: Say "Each input ref must match the declared pattern when matched case-insensitively; the canonical form is ...".

6. [nit] spec_completeness / test_traceability — `chg-GH-176-spec.md` F-9 (line 167) and AC-F9-1 (line 481) versus `chg-GH-176-test-plan.md` TC-QREADY-012 step 6 (line 717).
   Gap: The spec's config-read-failure case record is `{ source: "provider-config", reason: <reason> }` with no detail; TC-QREADY-012 step 6 says the case record comes with "any safe failure code (never a raw payload)", which can be read as projecting a bounded `detail`. If a failure code is intended in the evidence, the spec should pin its detail format; otherwise the test step should say the read's `failureCode` is not projected.
   Suggested remediation target phase: test_planning (with a one-line specification pin if a detail is intended)
   Suggested fix: State explicitly that the config-failure evidence has no `detail` (the read's `failureCode` is not projected), or pin a bounded `detail` such as `code:<failureCode>` in F-9/AC-F9-1 and the test.

## Open Decision / Human Escalation

No product, architecture, or business decision is required for R-37..R-41; they are test-plan/plan/spec wording corrections the PM can direct. However, iteration 4 has surfaced a **new major** finding outside the PM's R-30..R-36 authorization, and TC-QREADY-021 is a satisfiability defect in the negative-control matrix. Under the PM's recorded process decision ("If iteration 4 returns a new non-mechanical finding or any critical/major that would change behavior, delivery stops for human input") and the gate's stalemate rule, a human process decision is required:

1. Authorize one scoped `test_planning` correction pass for R-37/R-38/R-41 (plus the `delivery_planning` R-39 and specification R-40 nits) and a re-gate, or
2. Record an explicit accepted risk for the over-broad negative-control assertion and proceed with the spec AC-F14-1/AC-F10-1 interpretation.

The Definition-of-Ready override is **not** available: the change alters behavior and contracts, and the override is limited to genuinely trivial, behavior-neutral changes. `Pause Required: yes`.

## Next Remediation Targets

1. `test_planning`: R-37 (scope the AC-F14-1/TC-QREADY-021 assertions to the affected condition/source and allow ready+unknown close), R-38 (dangling `provider-chain-unresolved-command`), R-41 (config-failure evidence detail wording). Do not change TC identities, states, reasons, bounds, or AC/NFR mappings beyond these corrections.
2. `delivery_planning`: R-39 (PM-NOTE-1 `all-unknown-degraded` pattern).
3. `specification`: R-40 (target-bridge sentence), R-41 (only if the config-failure detail is pinned in the spec).

The next verdict artifact is `readiness-review/readiness-iter-5.md` only if the human authorizes the scoped correction pass; otherwise the accepted risk/exception must be recorded in `chg-GH-176-pm-notes.yaml`.

## Delivery Statement

**Delivery may not proceed.** The iteration-3 findings R-30..R-36 are all resolved, and the provider-mapping/identity/count/identity-projection/duplicate/byte rules are consistent across the spec, test plan, plan, delivered code, and system spec. The remaining blocker is R-37: TC-QREADY-021 and the AC-F14-1 coverage row assert a stronger, unsatisfiable negative-control outcome than AC-F14-1/AC-F10-1 and contradict the test plan's own ready+unknown corpus cases. R-38/R-39 are non-blocking cross-artifact corrections; R-40/R-41 are cosmetic. Because R-37 is a new major outside the PM's R-30..R-36 scoped authorization, the workflow pauses for a human process decision before any further correction pass.
