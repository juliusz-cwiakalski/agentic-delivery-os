# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-177
Date: 2026-10-31
Pause Required: no

Gate scope: ticket GH-177 (M0-S8) × spec v1.0 (1009 lines, AC-V1..V14,
C-1..C-8, DEC-1..DEC-11, NFR-1..NFR-7) × test plan v1.0 (21 TCs,
TC-VERIFY-001..021) × plan v1.0 (10 phases, 44 tasks; PIN-1..PIN-7,
D1..D12) × TDR-0005 (Proposed). Settled decisions were treated as settled,
not re-litigated: ledger-only scope (DEC-1), variant-aware sets from pinned
GH-179 data (DEC-9), per-phase registry-over-declaration overlay (DEC-4),
projection-not-evidence (DEC-10), `verify.ledger.incomplete` as the one
additive row (DEC-8), `state-unverified` → exit 2 (DEC-5, TDR-0005).

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Verification Evidence (independent, run at the gate)

The gate did not take the artifacts' factual claims on faith; each load-bearing
claim was re-measured against the live tree (`feat/GH-177/verify-change-exit-taxonomy`
@ 55b2f90, spec 04a4ed2, test plan bc14d5e):

1. Bash reference (AC-V8, TDR-0005) — `scripts/deliver-ticket.sh` usage block
   (~2322) pins exactly the eleven tokens in the claimed order
   `merged|blocked|pr-open|pr-open-unverified|failed|finished|max-restarts|state-unverified|partial|noop-lane-nothing-to-do`
   → `noop-lane-permission|noop-lane-nothing-to-do`; the "Exit codes" block
   confirms bash `0` for merged/blocked/pr-open/pr-open-unverified/PM-finished/
   noop-lane-nothing-to-do, `1` for failed/max-restarts/partial/noop-lane-permission/
   **state-unverified**, `2` usage — exactly the single declared DEC-5 divergence
   (CLI 2) and the DEC-11 out-of-taxonomy treatment of broken invocations.
   `print_delivery_summary` (~2097–2113) and `classify_result` (~1300–1400)
   exist as cited.
2. Real corpus (AC-V11/NFR-7) — re-parsed all three with YAML 1.2 core:
   GH-179 parses, no `variant`, all eleven completions non-null → `finished`/0
   under the declaration fallback; GH-170 parses, `test_planning` and
   `delivery_planning` `completed: null` (entries present → declared-but-
   incomplete → `verify.ledger.incomplete`, not `lint.phases.incomplete`), opaque
   non-canonical keys `dor_iterations`/`review_iterations`/
   `quality_gate_iterations`/`dod_findings` present and opaque under GH-179 R2;
   GH-171 fails to parse ("All mapping items must start at the same column",
   line 28 — the pinned orphaned-indentation class) → `lint.notes.malformed`.
   All three expectations in spec/test-plan/plan agree with the bytes.
3. Variant data (C-2) — `PM_NOTES_VARIANT_VALUES`, `PM_NOTES_DEFAULT_VARIANT`,
   `PM_NOTES_REQUIRED_PHASES_BY_VARIANT` exist in
   `packages/core/src/contracts/pm-notes.ts`; full = the canonical eleven in
   the spec's order, LITE = the pinned six in canonical relative order.
   Nothing is re-declared by the change.
4. Lint reuse (C-7) — `lintPmNotes` (`packages/core/src/domain/pm-notes-lint.ts`)
   implements exactly the fixed order parse → keys → value types → variant →
   phase presence with the identity mapping the spec's C-7 table claims,
   including `variant: 1` and non-timestamp typed values → value-type family
   (`lint.notes.malformed`), entry `started`/`completed` and collection `text`
   → `lint.keys.missing`, unknown string variant → `lint.variant.unknown`,
   required-phase-key absence → `lint.phases.incomplete`.
5. Error-table baseline — `DOMAIN_KINDS = [provider, input, config, state, lint]`
   (`verify` joins additively); 26 rows; every reused identity exists with the
   claimed category/projection class: platform rows `state.store.torn`/
   `state.schema.mismatch`/`state.keys.missing` → platform-provider (2);
   `state.permission.denied`/`state.level.unsupported` → user-validation (1);
   `fallback.internal` → 2. `classifyDomainKind` exact-code semantics already
   satisfy TC-VERIFY-019 step 2 with no code change (kind + wrong-kind code
   throws; one-row kind-only resolves) — plan Phase 1 "Should" note is correct.
6. State/CLI feasibility — `StateReadEvidence.recordCount` exists (PIN-2
   grounded); `createRegistryLintReader` in `edge.ts` already demonstrates the
   `read({requiredKeys: []})` + `Object.hasOwn(values, key)` presence pattern
   PIN-6 needs; `createConfigProgram` composes `lint?`/`phase?` runtime
   options exactly as PIN-7 proposes for `verify?`; `CommandDefinition`
   supports `flags`/`positionals {max}`; the parser rejects extra positionals
   and unknown flags as `fallback.invocation` **before** the handler and
   filters `--json` globally (AC-V14 semantics verified in
   `packages/cli/src/index.ts`); `projectExitCode` is the sole exit-digit
   owner and throws on unknown classes; the adapter's
   `REF_PATTERN = /^[A-Z]+-[0-9]+$/` makes malformed-shape refs resolve to
   `missing` → `lint.target.missing` with no new ref-shape identity (C-1).
   `foldPhaseState` complete/reopen semantics match C-3's worked examples.
7. Sync check — `scripts/checks/error-table-sync.ts` compares the documented
   `Remediation hint` column byte-for-byte; drift messages match TC-VERIFY-019
   step 4 verbatim ("documented code … has no source entry", "source entry … is
   undocumented", "undeclared namespace …", "duplicate documented row"); the
   `### Documented error table` heading matches via substring; the current
   documented table carries all 26 rows (baseline+1 oracle sound).
8. Branding seam — the forbidden-literals scan is a substring seed scan
   (`ados`, `ADOS_`, `~/.ados`) over `packages/**` and `doc/**` (excluding
   `doc/changes/`, `doc/decisions/`); `feature-result-contract.md` currently
   contains zero seed literals; the `registered` key in
   `forbidden-literals.registry.json` is the real precedent plan task 9.1
   cites. **This is the basis of the blocking finding below.**
9. Referenced machinery — all exist: `tests/behaviour/pm-notes-lint-command-support.ts`,
   `phase-support.ts`, `phase-registry.test.ts`, `state-permissions.test.ts`,
   `tests/fixtures/state/harness.ts`, `tests/golden/helpers.ts`,
   `testkit assertEnvelopeContract`, `tests/structure/{error-table,
  result-contract,content-inventory,pm-notes-imports,state-scope,cli-edge-seam}`,
   `inventory.json` + `EXECUTABLE_ALLOWANCES`, `STATE_CONSUMERS` in
   `state-scope.test.ts`, `runSyncCheck` export, the five named checks,
   `.changeset/config.json` fixed five-package group + `pm-notes-lint-minor.md`
   precedent. No dangling reference.
10. Trace counts and ordering — 21 TCs (recounted), all mapped in the plan's
    traceability table with per-phase completion marks; 14/14 ACs and 7/7 NFRs
    covered forward and reverse; plan = 10 phases / 44 tasks (recounted
    6+6+5+5+5+3+3+3+5+3); test plan created 05:30:00Z precedes plan 05:30:13Z
    (no GH-179 timestamp inversion); pm-notes/plan baseline claims match git
    log (04a4ed2 → bc14d5e → 55b2f90, cut from 77119b9). The plan requires no
    nested subagent dispatch by `@coder` (D6 + Execution Log); Phases 7–10 are
    PM-scheduled.
11. Ticket fidelity chain — goal (verify vs ledger, classify tuple, kill
    exit-zero false success) → C-1/C-3/C-4/C-5; bash-enum mirroring for
    dual-run comparability → AC-V8 (verified against the script); variant-aware
    required set "not a hardcoded eleven" → C-2/AC-V1/AC-V2; malformed
    classified never a crash → C-7/AC-V3; exit taxonomy → AC-V9. Dependencies
    M0-S5 (GH-174) and M0-S10 (GH-179) delivered; `ados verify change` is
    assigned to M0-S8 in `cli-command-registry.md`. No scope creep: NG-1..NG-8
    fence off tracker/PR evidence, mutation, `verify gates`, dispatch,
    envelope changes, schema changes, prompt adoption, and remote ledgers; the
    C-3 overlay and exit-2 divergence are in-scope design decisions (DEC-4/
    DEC-5), each with tests.

## Findings

1. [major] cross_artifact_consistency — chg-GH-177-spec.md#C-8 (remediation
   hint) × chg-GH-177-plan.md task 1.2 × chg-GH-177-test-plan.md TC-VERIFY-019
   step 1
   Gap: The spec C-8 pins the row's remediation hint as "Complete the named
   required phases of the declared variant through `ados phase`, or correct the
   declaration, then re-run verify." The substring `ados` is a forbidden-literal
   seed scanned over all of `packages/**` and `doc/**` (only
   `core/src/branding/**` and `adapters/src/legacy/**` are allowlisted), and
   `scripts/checks/error-table-sync.ts` compares the hint byte-for-byte between
   `ERROR_TABLE` and the documented row in `feature-result-contract.md`
   (currently 0 seed literals). No shippable machine row or documented row can
   carry the C-8 text verbatim, yet TC-VERIFY-019 step 1 asserts "the exact C-8
   remediation hint" — an oracle no compliant implementation can satisfy — and
   plan task 1.2 is internally contradictory ("phrased brand-neutrally per the
   repo's no-literal rule — the hint text follows the spec C-8 remediation
   wording"). The artifacts themselves classify a pin change as reopen-worthy
   (A-T1: remediation fields "may not be rebound"; plan: PIN changes "route
   through PM, never apply silently"), so leaving it to @coder at Phase 1
   forces a mid-delivery reopen.
   Suggested remediation target phase: specification
   Suggested fix: amend C-8's hint to one pinned brand-neutral exact string,
   e.g. "Complete the named required phases of the declared variant through the
   phase command, or correct the declaration, then re-run verify." and mirror
   the same string in plan task 1.2 (drop the contradictory sentence) so
   TC-VERIFY-019's exact-match oracle is satisfiable as written. One string;
   every other field of the row (code/kind/category/retryable/consequence/
   projection/summary) is already consistent and brand-neutral across all
   three artifacts.

2. [minor] cross_artifact_consistency — chg-GH-177-test-plan.md#TC-VERIFY-012
   Preconditions
   Gap: The matrix precondition list groups the two parser-level
   `fallback.invocation` cells under the "`failed`:" bucket, while C-5, DEC-11,
   TDR-0005 §Decision-5, A-T6, and TC-VERIFY-011's notes all place broken
   invocations **outside** the delivery-result taxonomy (exempt from the C-6
   tuple). Steps 5 and 6 handle the exemption correctly, so behavior is
   unambiguous, but the bucket label invites an implementer to emit a
   `failed` token for a cell that must carry none.
   Suggested remediation target phase: test_planning
   Suggested fix: relabel the precondition list to a fourth "outside-taxonomy:
   fallback.invocation (two parser cases)" bucket (fold into the same reopen
   cycle as finding 1; not a standalone blocker).

3. [nit] cross_artifact_consistency — chg-GH-177-spec.md#C-3 (precedence prose)
   Gap: "If the history mentions a phase, its latest operation determines that
   phase's completion" admits a second reading ("any raw transition mentions
   the phase") that diverges from the pinned `foldPhaseState` semantics: a
   reopen-only history leaves **no fold entry** (registry.ts keeps no entry
   when `previous === undefined`), so the declaration would stand. Unreachable
   through the guarded write path (phase.ts makes reopen-on-not-completed a
   no-op, line 313) and no TC builds a reopen-only record, so behavior is
   deterministic either way — but the prose should say "mentioned = present in
   the fold".
   Suggested remediation target phase: specification
   Suggested fix: one-clause wording clarification ("a phase the *fold* has an
   entry for"), fold into the finding-1 amendment; not blocking alone.

4. [nit] test_traceability — chg-GH-177-test-plan.md#TC-VERIFY-018 step 3
   Gap: The comparer rule for the C-4 `Identity source` cell is unpinned: the
   spec's `merged` cell reads "none in M0-S8", and the TC requires the seven
   reserved rows to carry "none" — satisfiable by a contains/prefix match,
   unsatisfiable by exact equality. Delivery-bound detail, but naming the rule
   avoids a @coder coin-flip.
   Suggested remediation target phase: test_planning
   Suggested fix: pin the rule (e.g. "cell starts with `none`" after emphasis
   normalization) when the test plan is next touched.

5. [nit] decision_capture — chg-GH-177-pm-notes.yaml#open_questions
   Gap: The first open question (exit-taxonomy tension) is already resolved by
   spec DEC-5/DEC-11 and TDR-0005 as recorded in the same file's `decisions`;
   the residual entry reads as unresolved. PM bookkeeping hygiene only.
   Suggested remediation target phase: specification
   Suggested fix: annotate/close the resolved question at the next pm-notes
   touch (PM-owned fold-in; no artifact reopen needed).

## Gate Result

NOT_READY — one major finding blocks. The defect class is exactly what this
gate exists to catch: a binding test oracle (TC-VERIFY-019's exact-hint
assertion, enforced twice by the error-table sync check) pinned to a string
that repository invariants (forbidden-literals, verified live) make
unshippable. Discovered now it is a one-string spec amendment; discovered at
Phase 1 it would be a mid-delivery specification reopen.

Smallest set of changes that clears the gate (single reopen cycle,
specification primary):

1. Spec C-8: replace the hint's `ados phase` phrase with a pinned
   brand-neutral exact string (finding 1); optionally fold the C-3
   "mentioned = fold entry" clarification (finding 3).
2. Plan task 1.2: mirror the pinned hint string and drop the contradictory
   "follows the spec C-8 remediation wording" clause (fold-in; delivery_planning
   touch, no structural change).
3. Test plan TC-VERIFY-012 precondition bucket relabel (finding 2, fold-in;
   test_planning touch, no behaviour change).

Findings 4–5 are non-blocking nits for the next natural touch. Everything
else measured green: ticket fidelity exact; the three real-corpus claims,
the bash enum, the error-table baseline, the variant data, the lint rule
order, the parser/projection/edge composition claims, all referenced
machinery, and the 21-TC/14-AC/7-NFR trace counts were independently
re-verified against the live tree. No human input required; TDR-0005 owner
ratification stays scheduled at PR review per the TDR-0003/0004 precedent.
Re-run this gate after the amendment; expected outcome READY at iteration 2.
