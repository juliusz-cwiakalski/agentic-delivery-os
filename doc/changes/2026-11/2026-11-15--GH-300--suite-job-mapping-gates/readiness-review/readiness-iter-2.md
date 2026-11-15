# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-300
Date: 2026-11-15
Pause Required: no

Reviewer stance: adversarial, independent, re-run from scratch. Remediation headers were
not accepted as closure: every iteration-1 finding was re-verified in the artifact that
owned it, and the delivered code was read directly to test each new v1.2 claim. Counts
that pass mechanically were re-derived, not trusted.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: PASS
- dod_defined: PASS

Mechanically sound (re-derived, no finding):

- 30 §17 ACs defined; 30 named by the test plan and 30 named by the plan; no orphan.
- 37 TCs declared; 37 named by the plan; SMAP 7 · SCITE 6 · SNARR 6 · SRES 5 · SPAR 6 ·
  SCTR 3 · SDET 2 · SHERM 1 · SWRITE 1.
- DM-1..DM-9 each covered; Appendix A rows 1..24 present; C-1..C-17 present.
- Phase 6 no longer declares the read-only `corpus/cases.json` (F9 genuinely closed).
- Reference declaration is feasible against delivered facts: `.github/workflows/ci.yml`
  job `ts-aggregate` has display name `TS aggregate check` and runs `pnpm check`, whose
  eight steps match the pinned eight suite ids; `brand.configDirectoryName` derives
  `.delivery-os` from the working name.
- `.git/info/exclude` (shared repo, line 21) does list `.delivery-os/`, so P-3 and the
  Phase 5 force-add boundary assertion remain necessary and correctly stated.

## Closure Table (iteration-1 findings)

| # | Owner artifact | Iter-1 gap (short) | Iter-2 status | Evidence / residual |
|---|---|---|---|---|
| F1 | plan | Fail-open whole-document fallback contradicted AC-F1-2 | **CLOSED** | Revision header (F1), P-1, obligations 4.3/5.3/5.4, escalation trigger; the map node is validated only by its own resolver and every unusable document state refuses before any source read. No fail-open wording remains in the plan. Proof of the adapter's mapping is a new gap (finding 3). |
| F2 | spec | Unreadable/unresolvable document posture unpinned; §21 contradicted | **CLOSED** | DM-9, DEC-18, NFR-10, AC-F1-4, AC-NFR8-1, Flow 6 (six states), §8.3 item 9, §10, §21 rewrite, Appendix A row 22, Appendix C C-15. Tolerant posture explicitly rejected with a reason. |
| F3 | spec | Member-declaring path never resolved breadth and still appended | **CLOSED** | F-3 now pins both report paths; DM-4 "one resolution rule serves both"; DEC-6 member precedence; AC-F3-6; Flow 2 member variant; C-17; Appendix A row 10; TC-SNARR-006; plan 4.2/4.12. Residual: read-ordering precision (finding 9). |
| F4 | plan | `readGateSet` wiring would activate config `merge.gates` in production | **CLOSED** | NG-7 added; DEC-11 revised in v1.2; §12, §16, F-1 corrected; plan P-6 and 5.6 state `readGateSet` is never sourced and `resolveMergeGateSetFromConfig` is not called from `packages/cli`/`packages/mcp`. Verified in code: the symbol is defined/exported only (no call site outside core). |
| F5 | spec | Map config-layer posture unpinned; overlays could supply policy data | **CLOSED** | DEC-19 (committed-slot only, no merged tree, overlay not a refusal), AC-F1-5, DM-9, RSK-10/RSK-11, Appendix A row 23, §20/§21, TC-SMAP-007, plan 5.5/5.9. Residual: the selected-file channel is unnamed (finding 9). |
| F6 | test plan | No set-equal, differently ordered local/mirror fixture | **CLOSED** | TC-SCITE-006 (reversed local + third permutation, fails if copied from local), plan 4.13, TR-10, §6.2/§6.4 golden, AC-F2-1 order wording. |
| F7 | spec / plan docs | Two docs stating the append rule were outside Appendix D and Phase 7 | **PARTIALLY CLOSED** | D-14, D-15, D-16 added and Phase 7 scopes those two files. But the same invariant is stated in ≥10 other current-truth sentences across four files, none in D-1..D-16 and three of the files outside Phase 7 scope. See finding 1. |
| F8 | plan | Plan cited test-plan v1.1 and P-4 as pending | **CLOSED** | Source block cites v1.3; P-4 recorded CLOSED with a pointer to the v1.2 log row. (The inverse staleness now sits in the test plan — finding 8.) |
| F9 | plan | Phase 6 scoped the read-only corpus file | **CLOSED** | `corpus/cases.json` removed from Phase 6 `scope.files`; SCOPE CONVENTION records the read-only control and cites F9. |
| F10 | spec | SC-M2-S7-02 reinterpretation unrecorded | **CLOSED** | Appendix B "SC-M2-S7-02 reinterpretation — recorded, not hidden", with NG-3/OQ-1/RSK-1 and the seed's intent. |
| F11 | spec | MCP shipped-composition posture unpinned | **CLOSED** | DEC-20, AC-F5-6, §8.1 second paragraph, §16 row, Appendix A row 24, plan 5.7, TC-SCITE-005. Residual: the `error.kind` assertion is unobservable (finding 2). |

## Findings

### 1. [major] plan_doc_update_coverage + system_spec_consistency — `chg-GH-300-spec.md` §24
Appendix D (D-1..D-16) and `chg-GH-300-plan.yaml` Phase 7 `scope.files`

**Gap.** The delta register's closing sentence, "No other current-truth sentence changes",
is false. This change narrows two invariants — "exactly one gate-verification record per
full battery evaluation" (DEC-7) and "`verify gates` appends one `gate.outcome`" (§8.2) —
and both are stated unconditionally in current truth outside D-1..D-16:

- `doc/spec/features/feature-verify-gates.md` line 172–173 (§Bounds and read budget: "The
  only write is one appended gate-verification record per full battery evaluation"), line
  217 (§Durable ledger projection: "a cross-repository evaluation appends exactly one
  `MergeGateVerificationRecord`" — zero on a narrowed member path per AC-F3-6), line 318
  ("The append posture is unchanged — exactly one gate-verification record per full battery
  evaluation … plus the non-gating capsule append"), line 374 (§Capsule gate append: "a
  full battery evaluation also appends one `gate.outcome` capsule event"), and line 407
  (§Config-declared gate set and verification record: "Every full battery evaluation
  appends exactly one fenced, post-append-verified EVT-1 gate-verification record … the
  append is the only output effect"). D-2 quotes only the §Overview sentence and D-5 does
  not reach the append sentence in its own section.
- `doc/spec/features/feature-capsule.md` line 129 ("`verify gates` appends one
  `gate.outcome` event after the gate-verification state append for a full battery
  evaluation") and line 205 ("`verify gates` appends a `gate.outcome` event"). This file
  is not in Appendix D and not in Phase 7 `scope.files` at all, although §8.2 of the spec
  explicitly adds the "no capsule append on a narrowed refusal" behaviour.
- `doc/spec/features/feature-verify-change-and-exit-taxonomy.md` lines 43 and 49
  ("`verify gates` adds exactly one gate-verification record" / "appends one
  gate-verification record"). Not in Appendix D, not in Phase 7 scope.
- `doc/overview/architecture-overview.md` line 179 ("and appends one gate-verification
  record"). Not in Appendix D, not in Phase 7 scope.

Phase 7 is explicitly bound to "exactly the spec's Appendix D list … nothing else moves",
so four documents will still carry a false invariant after the change, and three of them
would have to be edited outside any declared scope.

**Suggested remediation target phase:** specification (add the delta rows quoting these
sentences; the plan's Appendix D binding then pulls them into Phase 7 scope and Phase 7
`scope.files` gains `feature-capsule.md`, `feature-verify-change-and-exit-taxonomy.md`, and
`overview/architecture-overview.md`).

### 2. [major] ac_quality + cross_artifact_consistency — `chg-GH-300-spec.md` F-3/DM-5/§17; `chg-GH-300-test-plan.md` §3.1, §3.2, TC-SNARR-001/006, TC-SCITE-005
**Gap.** The artifacts assert a failure-envelope member that the delivered contract does
not have. `delivery.result.v1`'s `error` object is exactly `{code, category, retryable,
consequence, remediationHint, summary?}` (`packages/core/src/contracts/result.ts:36-43`);
the CLI projection builds it with those fields only (`packages/cli/src/index.ts`
`toErrorObject`), and the MCP tool failure uses the same `CommandResultError`
(`packages/mcp/src/output/payload.ts`). Verified on a committed failure envelope fixture
(`tests/fixtures/result/envelopes/classified-user/stdout.json`): no `kind`.

Against that, AC-F3-1 and AC-F3-6 assert "`error.kind` is `verify`"; AC-F5-6 asserts the
tool call "fails with `error.kind` `verify`"; DM-5 states "The handler emits it with
`error.kind: "verify"`"; and TC-SNARR-001 step 2, TC-SNARR-006 step 2, TC-SCITE-005 step 2
(plus TC-SMAP-006 steps 2–3 for `config`) assert `error.kind` while reading captured
envelopes/tool results. `error.kind` is a handler-level discriminant and an error-table
domain-kind column, never an envelope or tool-result field. A delivery can therefore only
either drop the assertion (weakening two core ACs) or add `kind` to the closed error shape
— a contract change the nine-item §8.3 literal table does not enumerate and a broad
regression of every failure golden. Either resolution is a delivery-time improvisation
the spec is supposed to prevent.

**Suggested remediation target phase:** specification (drop `error.kind` from the
observable ACs and assert the documented row's domain kind through the error table, as
AC-NFR7-1 already does; or, if `kind` must be exposed, declare it as an enumerated
contract delta with its own parity cases), then test_planning for the three TCs.

### 3. [major] plan_coverage — `chg-GH-300-plan.yaml` Phase 4 (TC-SMAP-006) vs Phase 5 (`readCommittedConfigDocument`)
**Gap.** The change's central new failure path — "a present but unreadable, unparseable, or
defective-node document refuses `config.value.invalid` before any source read, and never
becomes undeclared" (AC-F1-4, AC-NFR8-1, NFR-10, DM-9, DEC-18) — has no witness through
the real adapter.

The mapping lives in the Phase 5 adapter (`readCommittedConfigDocument`, obligation 5.3),
but the AC's owning TC (TC-SMAP-006) is owned by Phase 4 and its preconditions pin "a seam
harness that injects each document state"; its note says the unreadable state is "injected
through the configuration seam". Phase 4 also precedes the adapter's existence, so an
injected outcome is the only state TC-SMAP-006 can assert at its own boundary. Phase 5's
gates then exercise the real adapter only for the valid document (TC-SMAP-004) and the
absorbed/valid layer set (TC-SMAP-007); no phase asserts that the real read maps
unreadable/unparseable/defective-node to a refusal. TC-SPAR-006 (Phase 6) reuses the same
injected matrix.

Consequence: an adapter that returns `{ok: true, declared: false}` on a read or parse
failure — the exact fail-open shape iteration 1 rejected in the plan — passes every stated
TC, including the F1 remediation's own witness. `tests/fixtures/verify-gates/suite-map/config/*`
fixtures are named by TC-SMAP-006 and §6.2, but the plan never binds an assertion through
them at the adapter boundary, and the test plan does not say which states go through the
real adapter versus the seam (the two statements are in tension).

**Suggested remediation target phase:** delivery_planning (add an adapter-level
classification suite in Phase 5 over the real `readCommittedConfigDocument` with a
per-case fixture root and injected fs: unreadable, unparseable, no-node, each defective
node class, defect-elsewhere; keep the injected seam case for the handler branch), then
test_planning to state per state which layer is exercised.

### 4. [minor] cross_artifact_consistency — `chg-GH-300-spec.md` NFR-4 / AC-F5-4 vs §4.1 and `chg-GH-300-plan.yaml` 6.4
**Gap.** NFR-4 requires "identical counts and identical transport calls with and without a
declared map" and, in the same cell, "the map adds exactly 1 bounded read of the
project-committed configuration document". AC-F5-4 repeats both ("those counts are
identical with and without the declaration"). The two clauses cannot both be literally
true; the test plan resolves the intended reading (TR-6: "identical per-source counts …
the map's one bounded document read is the only difference") but the authoritative
threshold does not. Relatedly, plan 6.4's "the narrowed case performs exactly the same
reads as a non-narrowed run" is unqualified and false for the member-declaring narrowed
case, which by design performs no member reads (AC-F3-6).

**Suggested remediation target phase:** specification.

**Suggested fix:** state that the *enumerable gates source* counts are identical and the
configuration-document read is the one permitted addition, and scope the plan's narrowed
read statement to the member-less path.

### 5. [minor] spec_completeness — `chg-GH-300-spec.md` DM-9 / DEC-18 / NFR-10
**Gap.** "A defect elsewhere in the document … is not interpreted by this command and
therefore neither refuses the gate run nor removes a valid declaration" and NFR-10's "0
refusals attributable to a defect outside the `verify.suite-map` node" are false for
document-level parse defects. The delivered parser the new read must use
(`packages/adapters/src/file/yaml-parser.ts` `parseConfigYaml`) refuses, anywhere in the
document, a duplicate key (`uniqueKeys: true`), an unsupported tag, a non-JSON scalar, a
non-map root, and the 1 MiB / 2048-node / depth-64 / alias-100 caps — all of which become
the "unparseable as a whole" refusal. TC-SMAP-006 step 6 and TC-SPAR-006 step 5 only use
semantic defects (another invalid branch, an unknown key, a forbidden value), so the
tolerance looks total when it is not.

**Suggested remediation target phase:** specification.

**Suggested fix:** scope the tolerance to semantic/schema defects outside the node and
state that any document-level parse failure anywhere is the unparseable-as-a-whole
refusal (and bound NFR-10's zero-refusal threshold to the semantic class).

### 6. [minor] spec_completeness — `chg-GH-300-spec.md` F-1 (job rule) vs DEC-15 / DEC-16 / NFR-2
**Gap.** The map's `job` validation is "non-string, empty, over 120 characters, duplicate"
only — no character class. The header and cause line are byte-pinned as *one physical
line*, with `<job>` "verbatim … never quoted, escaped, … or truncated" and "terminated by
the final occurrence of the literal ` breadth=`". A declared job containing a line break
(YAML permits it) breaks the six-line/4096-byte summary bound and the two-line stderr
claim; a job containing ` breadth=` breaks the header's termination rule. No TC exercises
either, and TC-SNARR-001/005/TC-SDET-002 use benign names.

**Suggested remediation target phase:** specification.

**Suggested fix:** pin the `job` value to a single-line, control-character-free printable
class (or declare the rendering escape/quotation rule and add the corresponding fixture).

### 7. [minor] cross_artifact_consistency — `chg-GH-300-spec.md` §7.2 / C-10 vs `chg-GH-300-plan.yaml` 2.8
**Gap.** §7.2 marks "Amending current-truth feature specifications in this specification;
phase 7 reconciles them" as out of scope, and C-10 says "Current-truth specifications flip
in phase 7 only". Phase 2 obligation 2.8 edits `doc/spec/features/feature-result-contract.md`
(the error row and the 135→136 count) in the delivery commit. The test plan already carves
this exception ("the error-table documented row … because the delivered sync gate binds
it", §1.2/§6.6); the spec does not, so a reviewer applying C-10 literally fails Phase 2.

**Suggested remediation target phase:** specification.

**Suggested fix:** name the two-way error-table sync as the one sanctioned exception in
C-10/§7.2 (or move the row to Phase 7 and accept a red Phase 2 boundary).

### 8. [minor] cross_artifact_consistency — `chg-GH-300-test-plan.md` §8.3 "Cross-artifact handoff"
**Gap.** The paragraph still states that the implementation plan "predates spec v1.2 and
therefore does not yet own AC-F1-4, AC-F1-5, AC-F3-6, AC-F5-6, AC-NFR8-1, or these six
TCs", and that "delivery planning must adopt them … in its own revision before the DoR
gate". Plan revision 1.2 already does (30/30 ACs, 37/37 TCs, the six new TCs each owned).
This is the mirror image of iteration-1 F8 and would mislead the phase-7/review reader.

**Suggested remediation target phase:** test_planning.

**Suggested fix:** restate the handoff as satisfied, citing plan revision 1.2's adoption block.

### 9. [minor] plan_coverage — `chg-GH-300-plan.yaml` 4.2 / 5.3
**Gap (two precision points).** (a) 4.2 gives one handler order — "… readGateSet →
repository/lifecycle/workflow/provider reads … → breadth resolution" — and then requires the
member-path refusal "BEFORE `crossRepositoryEvaluation`". In the delivered code
`readWorkflow`, `readRepository`, lifecycle, and work-item reads all live *inside*
`crossRepositoryEvaluation` (`packages/cli/src/commands/verify-gates.ts:323-337`), so the
workflow read must be hoisted for corroboration to precede the member path; the plan does
not say so, and a literal implementation would either double the reads or place the
refusal after the append it is meant to preempt. (b) 5.3 says the read "resolves exactly
one path — the explicitly selected file when one occupies the slot" without naming the
selection input: `verify gates` declares `flags: []` (`packages/cli/src/commands/verify.ts:139`),
so `--config` is `fallback.invocation` and only `${environmentPrefix}CONFIG` (TDR-0003
selector) is reachable. The plan should name that channel (or declare the selection arm
unreachable for this grammar) and state that the new adapter takes injected
`FileSystemFacts`, which the isolation assertions in TC-SMAP-007 depend on.

**Suggested remediation target phase:** delivery_planning.

### 10. [minor] spec_completeness — `chg-GH-300-spec.md` F-1 / DM-9 / DEC-18
**Gap.** "whether the defect is caught by the catalog schema or by the map's resolver,
which agree by construction" is not true of the delivered machinery.
`generateConfigSchema` (`packages/core/src/config/schema.ts`) can express only
type/required/additionalProperties; it cannot express the suite-id grammar, the length and
cap bounds, or uniqueness, and the `verify` branch will not reject an over-cap or duplicate
list. The resolver is strictly stronger, and the gates surface never consumes the catalog
outcome, so "whichever layer catches it" is vacuous for this surface even though the single
`config.value.invalid` identity holds.

**Suggested remediation target phase:** specification.

**Suggested fix:** state that the map resolver is the only validator for this surface, and
that the catalog branch constrains other consumers' whole-document validity only.

### 11. [minor] decision_capture — `chg-GH-300-spec.md` DEC-19; `chg-GH-300-pm-notes.yaml`
**Gap (two process points).** (a) DEC-19 establishes a general posture — policy-as-code
declarations are honoured only from the project-committed layer slot, never from a merged
tree — which will be cited by every later policy declaration; it is recorded only as a
change-level decision. Either route it to `@decision-advisor` for `doc/decisions/**` or
state in DEC-19/D-8 that it is scoped to `verify.suite-map`. (b) The pm-notes carry the
iteration-1 verdict and remediation *plan* but no entry for the reopens that produced spec
v1.2, test plan v1.3, and plan revision 1.2 (the notes still say "53/53 suite homes" and
"plan authored: 7 phases … 25/25 ACs", both since superseded by 65/65 and 30/30).

**Suggested remediation target phase:** specification (DEC-19 scope) and PM notes (reopen
provenance; PM lane, no artifact edit by this gate).

### 12. [nit] test_traceability — TC-SCITE-005 step 3
**Gap.** The step asserts "the call appended no `merge.gate-verification` record and no
capsule `gate.outcome` event (real state module plus recorder)" for a tool whose engine has
no append seam at all; the assertion is structurally vacuous. TC-SCITE-005's real value is
the non-vacuous structure assertion (step 1) plus the identical refusal (step 2).

**Suggested remediation target phase:** test_planning.

## Verified delivered-fact claims (no finding)

Spot-checked and accurate: the `verify gates` grammar (`flags: []`, `positionals.max: 2`,
third positional/unknown flag → `fallback.invocation`); the delivered append-then-project
handler order that the refusal must precede; the member path's in-function reads and append;
`renderVerifyGatesFailureSummary`'s header formula (`result=…; gates=<p>/<t> passed, …`,
which yields `gates=0/0 …` for zero gates); the failure-diagnostic writer (`<binary>: <code>`
then `summary:`), and the config-shaped suppression in `failureOutcome`; `explicitDetail`'s
current holder-only shape (which the plan correctly says must be restructured);
`COMMAND_FAILURE_DETAIL_MAX_CHARS = 128`; the four reused `VERIFY_GATES_*` bounds
(120/8/6/4096); `readCiWorkflowJobNames` and the `ts-aggregate` / `TS aggregate check` /
`pnpm check` facts; `.delivery-os` being listed in the shared repo's
`.git/info/exclude`; and `resolveMergeGateSetFromConfig` having no production call site.

Environment note (not a finding): `delivery-os plan validate GH-300` could not be re-run
in this worktree because the installed binary loads the parent checkout's stale
`packages/core/dist` (`evaluateCrossRepositoryGates` not exported). The plan's
`plan validate` claim was therefore not independently reproduced here; the mechanical
counts above were re-derived from the artifacts instead.

## Next step

Reopen `specification` for findings 1, 2, 4, 5, 6, 7, 10, 11; `test_planning` for findings
2 (TC assertions) and 8; `delivery_planning` for findings 1 (Phase 7 scope/files) and 3, 9.
Re-run this gate (iteration 3) after the revisions. Delivery must not start from this
verdict.
