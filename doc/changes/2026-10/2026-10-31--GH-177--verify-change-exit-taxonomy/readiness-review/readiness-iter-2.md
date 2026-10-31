# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-177
Date: 2026-10-31
Pause Required: no

Gate scope: ticket GH-177 (M0-S8) × spec v1.1 × test plan v1.1 × plan v1.1 ×
TDR-0005 (Proposed) × pm-notes (iter-1 reopens recorded complete). This
iteration re-ran the adversarial pass over the amended artifacts at
`feat/GH-177/verify-change-exit-taxonomy` @ `efd7efc` (clean tree), verified
each iter-1 finding closed with independent evidence, and re-executed the key
mechanical checks rather than trusting the amendment commit's claims. Settled
decisions were again treated as settled: DEC-1..DEC-11, PIN-1..PIN-7,
D1..D12, TDR-0005.

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

## Iter-1 Finding Closure (each verified against the live tree)

1. **[major → CLOSED] spec C-8 remediation hint × plan task 1.2 ×
   TC-VERIFY-019.** The hint was programmatically extracted from all three
   locations (spec line 638, plan line 167, test-plan line 829) and compared:
   byte-identical, single string
   `Complete the named required phases of the declared variant through the phase command, or correct the declaration, then re-run verify.`
   No forbidden seed (`ados`, `ADOS_`, `~/.ados`) occurs in the string even as
   a substring — and the live scanner (`scripts/checks/forbidden-literals.ts`)
   matches delimited occurrences, which is strictly weaker than substring, so
   the string is clean under both readings. `scripts/checks/error-table-sync.ts`
   (line 249, `hint !== entry.remediationHint` → "hint mismatch") confirms the
   byte-for-byte two-way comparison, so a machine row + documented row carrying
   this exact text in `ERROR_TABLE` and `feature-result-contract.md` passes
   both gates. Plan task 1.2's contradictory clause ("follows the spec C-8
   remediation wording") is dropped and replaced by "the exact amended spec
   C-8 string, byte-for-byte — never paraphrased, never reworded, and
   containing no product literal". TC-VERIFY-019 step 1 plus its note quote
   the oracle verbatim — the exact-match oracle is now satisfiable by a
   compliant implementation. The row's summary text and all other fields were
   also re-scanned: literal-free.
2. **[nit → CLOSED] spec C-3 "mentioned".** C-3 now reads "If the folded
   registry state has an entry for a phase…" and defines: "'Mentioned'
   therefore means present in the folded state, not merely present in the raw
   transition history: a reopen with no prior completion leaves no fold entry,
   so the declaration stands for that phase." Verified against the live
   `foldPhaseState` (`packages/core/src/state/registry.ts:209`): a `reopen`
   with `previous === undefined` writes no `phases` entry — the amended prose
   matches the code semantics exactly. The downstream uses of "mentions"
   (precedence rule, invariant, DEC-4, RSK-2) inherit the defined term.
3. **[minor → CLOSED] TC-VERIFY-012 bucket.** Preconditions (line 587) now
   carry an explicit `outside-taxonomy` bucket: the two parser-level
   `fallback.invocation` cells have **no delivery-result token** and are
   C-6-tuple-exempt, citing C-5, DEC-11, TDR-0005 Decision-5 (verified:
   TDR-0005 Decision 5 states broken invocations are outside the
   delivery-result taxonomy), and A-T6. Steps 5/6 were already consistent and
   are unchanged; precondition list and steps no longer disagree.
4. **[nit → CLOSED] TC-VERIFY-018 step 3 comparer.** Pinned (line 781) as a
   normalized **prefix match** on `none` after backtick/emphasis
   normalization, "not exact equality with the string `none`", with the
   `none in M0-S8` example. Satisfiability verified against the actual C-4
   table: the seven reserved rows' `Identity source` cells are `none` /
   `none in M0-S8` (prefix match ✓); the four reachable rows' cells
   (`success envelope`, `the pinned identity`, `the specific state.* identity`,
   `one of those identities`) do not start with `none` ✓. The `Reserved`
   marking rule (exactly seven) also matches the C-4 `M0-S8 derivation` column.
5. **[nit → CLOSED] pm-notes open question.** `open_questions: []` with the
   resolution comment citing spec DEC-5/DEC-11 and TDR-0005. Reopen
   bookkeeping complete: `reopened`/`reopened_completed` recorded for
   specification (03:05→03:35, v1.1), test_planning (03:05→03:40, v1.1),
   delivery_planning (03:05→03:45, v1.1); dor_check in progress with the
   iter-1 iteration record.

## Verification Evidence (independent, re-run at this gate)

1. **Amendment diff scope** — `git diff 61ef865..efd7efc`: the spec change is
   exactly the C-3 paragraph rewrite, the C-8 hint replacement, and the v1.1
   revision-log entry; the commit touches only the four change-artifact files
   (no source code); working tree clean at `efd7efc`. The v1.1 revision-log
   claims in all three artifacts ("no AC, identity, token, exit, summary
   grammar, or codebase-map item changed"; "no TC id, AC/NFR mapping, fixture
   path, identity, token, exit, or assertion semantics changed"; "no phase,
   task numbering, TC mapping, AC/NFR mapping, PIN, or D-binding changed")
   were verified accurate by diff and recount.
2. **Counts (recounted)** — test plan: 21 TC headings (TC-VERIFY-001..021) and
   21 rows in the plan's traceability table; 14 AC rows in §3.1 matching 14
   `AC-V*` definitions in the spec; 7 NFR rows in §3.3 matching 7 in the
   spec. Plan: 10 phases, 44 tasks (6+6+5+5+5+3+3+3+5+3). Forward and reverse
   AC/NFR/TC mappings agree across all three artifacts.
3. **Bash enum** — `scripts/deliver-ticket.sh` usage block (~2322) pins
   exactly the eleven tokens in the order `merged|blocked|pr-open|
   pr-open-unverified|failed|finished|max-restarts|state-unverified|partial|
   noop-lane-permission|noop-lane-nothing-to-do`, matching plan task 1.1 and
   spec C-4.
4. **Real corpus (re-parsed live)** — GH-179: no `variant` key, 0 null
   completions, 11/11 completed → `finished`/`0` under the declaration
   fallback. GH-170: `test_planning` and `delivery_planning` `completed: null`
   (entries present → declared-but-incomplete → `verify.ledger.incomplete`,
   `missing=test_planning,delivery_planning`), opaque non-canonical keys
   `dor_iterations`/`review_iterations`/`quality_gate_iterations`/
   `dod_findings` present. GH-171: fails YAML parse (block-collection error)
   → `lint.notes.malformed`/`1`. All three expectations agree across
   spec/test-plan/plan and the bytes.
5. **TDR-0005** — Proposed (owner ratification scheduled at PR review, per
   TDR-0003/0004 precedent; decision_capture unaffected); Decisions 1–5 match
   the spec's C-4/C-5/DEC-5/DEC-11 and the test plan's citations, including
   Decision 5's outside-taxonomy treatment cited by TC-VERIFY-012.
6. **pm-notes conformance** — the extra phase-entry keys (`reopened`,
   `reopened_completed`, `iterations`) are opaque under the live lint rules
   (`PHASE_FIELDS = [started, completed]` presence check only,
   `packages/core/src/domain/pm-notes-lint.ts`), so the tracker file remains
   conformant; it is corpus-adjacent and not a TC-VERIFY-006 fixture.

## Findings

1. [nit] cross_artifact_consistency — chg-GH-177-test-plan.md#frontmatter/§2
   Gap: the test-plan frontmatter still carries `implementation_plan: null`
   (the template expects the relative plan path "if exists" — the plan has
   existed since 05:30:13Z and maps 21/21 TCs), and the §2 reference still
   describes the spec's "revision log v1.0" (the spec is v1.1). GAP-1/A-T4's
   binding constraint — the plan must map onto the TCs and not reshape them —
   is satisfied and verified, so this is stale-pointer hygiene only; no
   behaviour, oracle, or mapping depends on it.
   Suggested remediation target phase: test_planning
   Suggested fix: at the next natural test-plan touch, set
   `implementation_plan: ./chg-GH-177-plan.md` and update the §2 spec-version
   pointer to v1.1. Not a reopen trigger.

No other new findings. No blocking or major gap was found on the re-read; the
amendment introduced no internal contradiction (checked: C-4/C-5 table cells
against TC-VERIFY-017/018 assertions, derivation-mapping paragraph against
the taxonomy, exit-column leading integers, detail-segment rules against
PIN-4/A-T6, reused-identity table against C-4 token/exit assignments).

## Gate Result

READY — all ten facets pass. The single iter-1 major (unshippable exact-hint
oracle) is closed with byte-level evidence, the minor and three nits are
closed, and the mechanical re-checks (byte-identical hint, no product literal
in any shippable error-row text, 21 TC / 14 AC / 7 NFR, 10 phases / 44 tasks,
bash enum, real corpus, fold semantics) all measure green against the live
tree. Delivery may start at plan Phase 1. The one residual nit is recorded
for the next natural test-plan touch and does not gate. TDR-0005 owner
ratification remains scheduled at PR review; no human input is required at
this gate. Iteration cap status: 2 of ~3.
