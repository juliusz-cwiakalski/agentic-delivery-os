---
title: "GH-354 readiness review — iteration 1"
work_item: GH-354
change: dispatch-operator-surface
iteration: 1
date: "2026-11-19"
verdict: NOT_READY
reviewer: readiness-reviewer
artifacts_reviewed:
  spec: chg-GH-354-spec.md (v1.3)
  test_plan: chg-GH-354-test-plan.md (71 cases)
  plan: chg-GH-354-plan.yaml (8 phases: 1 planning + 7 delivery)
  pm_notes: chg-GH-354-pm-notes.yaml
decision_record: TDR-0056 (status `Proposed`; the human owner is the acceptor at PR review)
scope_note: >-
  Findings are stated against the versions above as read during this iteration.
  Any later revision of those files is outside this record and belongs to the
  next iteration.
---

# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-354
Date: 2026-11-19
Pause Required: no

Blocking findings: 5 (F1–F5). Advisory findings: 9 (A1–A9). No facet failed for a
missing artifact; every finding is a text-level precision or allocation defect and
none requires a redesign.

## Facet Summary
- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Findings

1. [critical] spec_completeness / cross_artifact_consistency — `chg-GH-354-spec.md` §252 (API-9) and §267 (DM-3), against §547 (§21) and AC-F4-7
   Gap: API-9 and DM-3 bound the returned message *inside the seam* ("bounded to 512 characters single-line"), while §21 and RSK-18 rely on the composition order redact → flatten → bound → mark. A bound applied in the seam truncates before redaction, so a registered credential straddling the 512th character survives as a disclosed prefix — the exact class §21 and AC-F4-7 claim is closed.
   Suggested remediation target phase: specification
   Suggested fix: remove the bound from API-9/DM-3 (the seam returns the final assistant message; the bound belongs to the query composition after redaction), and state the single composition order in API-4/§21 so AC-F4-7's "cannot survive as a prefix" claim is provable.

2. [major] ac_quality / cross_artifact_consistency — `chg-GH-354-spec.md` §497 (AC-F7-3), against §448 (AC-F2-6) and test-plan `TC-PERSIST-005`/`006`/`011`
   Gap: AC-F7-3 asserts "each file's bytes equal the declared transformation of the values that stream yielded … and nothing else", but AC-F2-6 permits a value longer than the cap to be split at the cap and continued in the next file. A value split mid-value makes per-file equality false for that file, and "nothing else" is contradicted by the continuation. The criterion is unfalsifiable as written for the oversized-value case that `TC-PERSIST-006` exists to prove.
   Suggested remediation target phase: specification
   Suggested fix: restate AC-F7-3 over the concatenation of a stream's retained files (stitch, then split on LF), keeping per-file equality only as the values-that-fit clause; align `TC-PERSIST-005`/`006`/`011` "Must fail" wording to the restated criterion.

3. [major] plan_coverage — `chg-GH-354-plan.yaml` TC → PHASE MAP (phase 3 allocation) and AC ownership
   Gap: `TC-PERSIST-005` ("cap enforced by segmentation with nothing dropped at a boundary") and `TC-PERSIST-006` ("a value longer than the cap is split and reconstructed byte-identically") are allocated to phase 3, the write path, but both are observed through the stitched reader that phase 4 lands (`dispatch log`, API-2/API-7). Phase 3 cannot be gate-green with those cases as written. The plan already applies this rule to `TC-PERSIST-009`, which was moved to phase 4 because its load-bearing half is the reader's tear rule.
   Suggested remediation target phase: delivery_planning
   Suggested fix: move `TC-PERSIST-005`/`006` to phase 4 (or re-scope them to writer-only assertions and add a phase-4 reconstruction case), then fix AC ownership, the per-phase case counts, and the mutation-register allocation rows that name them.

4. [major] plan_coverage — `chg-GH-354-plan.yaml` GATE ENVIRONMENT per-phase battery, against the PINNED SURFACES declarations
   Gap: phases 2 and 3 edit `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, and `tests/fixtures/ports/v1-contract-inventory.json`, and the no-shell surface/glob list moves with every new module. The per-phase battery runs only the phase's own suites, `scripts/checks/no-shell-dispatch.ts`, and `scripts/checks/exit-code-literals.ts`. The suites that verify the pinned inventories and the no-shell glob equality are reached only through the phase-8 aggregate, so a pinned-surface drift can be committed at a boundary the plan declares gate-green.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add the pinned-inventory suites (and the glob-equality assertion) to the per-phase battery for every phase that declares a pinned surface, so the boundary claim in "EVERY PHASE LANDS ITS OWN TESTS" holds.

5. [critical] cross_artifact_consistency / spec_completeness — `chg-GH-354-spec.md` §249 (API-6) and §265 (DM-1), against §128 (F-1) and AC-F1-6
   Gap: API-6 says the bounded read is "folded to the newest record per ref and filtered to the resolved repository", and DM-1 repeats "newest record per ref, filtered to the resolved repository". Folding before filtering lets a newer `dispatch.lane` record for the same ref under another repository win the fold, after which the repository filter drops it and the ref answers `marker=absent` (or carries foreign facts) in the current repository. That directly contradicts AC-F1-6 (a foreign lane is not reported, and the addressed repository's own record still answers) and NFR-4.
   Suggested remediation target phase: specification
   Suggested fix: filter to the resolved repository before the newest-per-ref fold, state the order once in API-6/DM-1, and cite it in AC-F1-6 so the scoping clause is checkable.

## Advisory Findings

A1. [minor] spec_completeness — `chg-GH-354-spec.md` AC-F2-3 / API-2: `no-log` carries two named causes — a one-shot adapter that streams nothing and a pre-change lane that has no artifact — but the answer exposes no discriminator, so an operator cannot tell "this adapter has no stream to capture" from "this lane predates the artifact" without outside knowledge. Add the discriminator, or state explicitly that the two causes are deliberately indistinguishable.

A2. [minor] spec_completeness — `chg-GH-354-spec.md` F-7 / DM-2 / API-8, `TC-PERSIST-008`: "one append per value" sits beside the rule that every value is written followed by exactly one LF; say whether the LF is inside the same append so the two statements cannot be read as two writes (which would split the torn-tail rule's unit).

A3. [minor] ac_quality — `chg-GH-354-spec.md` §25.3 (Appendix C, normative) against AC-F2-5: §523 designates the query answer matrix as the authoritative statement of what each query answers, but the matrix's `log` row states neither the truncation fact nor the declared precedence that AC-F2-5 carries. Restate the one-fact rule (and which scope wins) in the matrix row, or narrow §523's authority claim.

A4. [nit] ac_quality — `chg-GH-354-spec.md` API-11 / DM-7, §25.4 (Appendix D): the exit projections are named as lifecycle states (`success`, `user-validation`), while the operator-facing state word rendered in each human form is named nowhere and is not delegated by Appendix D either (it delegates key order, the `log` truncation line, and reason summaries). Either name it or add it to the fixture-decided list, so two implementations cannot differ under a green battery.

A5. [minor] test_traceability — `chg-GH-354-test-plan.md` §4: `is-delivering` has `TC-ISDEL-006` and `last-message` has `TC-MSG-006` for an unreadable lane store, but `status` has no equivalent case even though API-6 binds all three to the same read; add the `status` store-failure case.

A6. [minor] spec_completeness — `chg-GH-354-spec.md` §21 / §22, AC-F4-7: the privacy guarantee rests on "**registered** credential values" being replaced, but no artifact in this change names the registry that supplies them, so the claim cannot be checked from the spec alone. Name the registry (or its owning document) that defines the registered set.

A7. [nit] plan_coverage — `chg-GH-354-plan.yaml` phase 1: TDR-0056 and its `doc/decisions/00-index.md` row already exist on this branch (status `Proposed`), so phase 1's declared scope is already satisfied; say that the phase re-asserts and commits them rather than landing them new.

A8. [nit] plan_coverage — `chg-GH-354-spec.md` F-7 / DM-2, `TC-PERSIST-003`: the naming inputs admit "the stream kind (spawn, resume, deliver) **or** an explicit stream ordinal", so the input set the lexical-order-equals-creation-order requirement is proved over is not decided; `TC-PERSIST-003` proves the order but not which input set. Pick one input set (or state the equivalence) so the naming rule is decidable.

A9. [nit] decision_capture — `chg-GH-354-spec.md` §657/§658 changelog vs `chg-GH-354-pm-notes.yaml` line 136: the changelog describes "two independent decision-challenge rounds" and then a "third"/"fourth" pass, while the pm-notes record four REWORK rounds; reconcile the pass count so the decision history is unambiguous.

## Residual Risks Carried (not findings)

- TDR-0056 remains `Proposed`. It is the binding design of this change; the human owner is the acceptor at PR review. Delivery must not treat acceptance as implied by this gate.
- `feature-dispatch-engine.md` states that `dispatch.lane` carries no prompt, transcript, diff, or provider payload, so `log` and `last-message` must ride their own bounded, reference-scoped artifacts with a declared location, bound, and privacy boundary. The spec states the pre-change answer, but the artifact-family section must stay the only place the location and bound are defined, so a later doc sync cannot move them.
- Declared divergence, not parity: the typed `log` tails the harness's own stdout (opencode's JSON event stream), while the shell's `--log` tails only the opencode child's stderr. The reference page and operations guide must state this.
- Claude Code lanes open no stream and answer `capability-gap` for `last-message`; the scope limit must stay stated so no page claims general harness support.
- `last-message` redaction covers only registered credential values; prose and values the harness itself printed pass through within the bound (RSK-18).
- The two-file retention window plus the 2 × cap family bound means a tail can be answered with one truncation fact when a value spans more files than are retained (AC-F2-6); that case is a declared answer, not a defect.
- Operational prerequisite from GH-347: every primitive invocation needs `TMPDIR=$PWD/tmp/tmpdir` and `PATH=$PWD/node_modules/.bin:$PATH`, and an unbuilt workspace must be rebuilt before any `jaiship` call.

## Remediation Routing

- specification: F1, F2, F5 (plus A1–A4, A6)
- delivery_planning: F3, F4 (plus A7, A8)
- A5 (test_planning), A9 (change docs) are non-blocking and may ride the same revision.

Re-run this gate after the revisions; delivery stays blocked until the verdict is
`READY` or a recorded triviality override exists.
