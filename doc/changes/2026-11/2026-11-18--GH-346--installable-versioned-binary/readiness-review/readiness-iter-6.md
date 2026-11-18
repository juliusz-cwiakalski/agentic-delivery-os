# Readiness Review Iteration 6

Verdict: READY
Work Item: GH-346
Date: 2026-11-18
Pause Required: no

Reopen: **none.** No artifact phase needs reopening. The five items below are wording-or-mechanism nits/advisories, not preconditions for delivery; none of them makes a declared case unsatisfiable, leaves an AC untested, or falsifies a delivered artifact.

Artifacts reviewed as they stand on disk: spec **v1.6** (`daeabefe8bd8c109af13395b51e04e8b024ea355ee496370987663859b7b4d2e`), test plan **v1.6** (`6f55c6a46c44b74e07ad6f6165b77f32174528d593f4972c504c2be5821006ef`), plan **YAML read from the working tree including the uncommitted diff** (`6a5732b2ef59f2f88b054e17ed1c7be58a3b89ce180b869bcb931b5e5726d549`), `chg-GH-346-pm-notes.yaml`, TDR-0036 / TDR-0037 / TDR-0038 / TDR-0039 / TDR-0040 on disk, and the delivered pages the change falsifies. The plan diff is **comments only** — 37 insertions / 20 deletions, every changed line inside a `#` comment, **zero** structural YAML lines — so phase scope, file lists and AC/TC acceptance are byte-identical to the set iteration 5 reviewed as PASS.

This is a confirmation pass and it confirms: **the iteration-5 blocking finding is closed on the merits**, and nothing material is new.

## Iteration-5 finding close-out

| # | Iter-5 finding | Status | Anchor | What closed it |
|---|---|---|---|---|
| 1 | MAJOR blocking — `TC-INST-042` arm (g) asserted an outcome no legal implementation can produce and put the carried claim in the wrong record field: (a) X written into `previous`, (b) the run required to report the slot occupant P's identity | **CLOSED** | Spec 185 (F-8's new **"On that proceed"** clause), 377 (§8.1 rollback row), 548 (DEC-13), 645 (AC-F8-2), 895 (v1.6 history); test plan 480 (arm (g) step 7, Given and Expected), 127 (AC-F8-2 row), 166 (DM-2 row), 593 (`records.ts` fixture row), 773 (TR-11), 798 (OQ-TP-9), 26 (§1 sixth paragraph), 810 (v1.6 history); plan 98–113 (v1.6 preamble), 461, 527–536, 616–621, 1057–1062 (guardrail), 1832–1880 (phase-3 arm (g)), 1953–1960, 2009–2043 (phase-3 acceptance and gate signal). | The claim now lands in `current` verbatim, the displaced destination A lands in `previous`, the run reports **X and A only**, and the slot occupant is asserted by **bytes**, never by identity. Both halves of the old finding are gone, not re-worded. |

No `delivery` finding exists.

## Adversarial re-derivation 1 — walk the arm against the record semantics

Pre-run state (test plan 480): destination holds **A**'s bytes, slot holds **P**'s bytes, readable record `{current: A, previous: X}`, X ≠ P.

| Fact | Pre-run | After the rollback | Asserted by | Satisfiable by a correct implementation? |
|---|---|---|---|---|
| destination bytes | A's | **P's** (the old slot content) | digest equality against the pre-run slot digest | **yes** — bytes only, no identity read |
| slot bytes | P's | **A's** (the displaced destination) | digest equality against the pre-run destination digest | **yes** |
| record `current` | A | **X verbatim** (the claim, copied from the record's `previous`) | literal `{current: X, previous: A}` | **yes** — the record is the only source the process needs |
| record `previous` | X | **A** (known by construction: the run *is* A, and the record's `current` names A) | same literal | **yes** |
| identities reported | — | **X and A**, never P | "does not report P's identity", "no line claims a slot read" | **yes** — a negative assertion cannot fail a correct run |
| status after the run | — | the record's `current` reads **X** | "`install status` reports `current` as the record states it (X)" | **yes** for the identity value (see nit 4 for the wording) |
| slot comparison | — | **absent** | structural: no slot digest, no slot-derived identity field, no `previous`-versus-slot comparison | **yes** — DM-2 declares no such field, so the assertion is over the schema |

**Result: satisfiable, and satisfiable only one way.** No assertion now requires reading the slot, and no assertion now requires reporting P. The two renames, the record write and the report are all derivable from (i) the record's two names and (ii) the running artifact's own build constants.

**Field-semantics control still holds.** `TC-INST-024` step 4 pins `{current: A, previous: B}` after a rollback from `{current: B, previous: A}`; arm (g) is the same inversion over a claim that is wrong, and F-8's "slot's occupant in `current`, displaced destination in `previous`" is exactly what `previous` = A delivers (the slot *does* hold A afterwards). The arm and the control now agree instead of contradicting.

**Discriminators, against the declared limit.** The four named failures — a refusal, a claim normalised to P, an added digest field, a **reported P identity** — are each an over-read or a hardening, and each is caught by a literal assertion already in the arm (the exact record, the expired structural set, the negative report). The plan's guardrail (1087) and escalation trigger state the same four in the same direction. **Consistent with the declared limit; the arm cannot pass vacuously and cannot pass a detection.**

## Adversarial re-derivation 2 — does the new sentence contradict anything?

| Counterpart | Statement | Verdict |
|---|---|---|
| F-9 (187) "reports both identities" | The two identities a proceeding run reports are X and A | **Consistent.** F-9 never says which identities; the new clause names them. |
| AC-F9-3 (648) "the previous artifact is back in place and output names both identities" | Ordinary-case criterion; it says nothing about a wrong claim | **Consistent.** No AC now requires P. |
| §8.1 rollback row (377) | Same clause, same words as F-8 | **Consistent**, and the dry-run row (378) already treats a wrong name as admitted. |
| DEC-13 (548) | Same clause plus the same four causes | **Consistent.** |
| DM-2 (404) `previous` = "the slot's identity" | After arm (g)'s rollback the slot holds A and the record's `previous` is A | **True, not just consistent.** |
| DM-2 `version`…`channel` = "the installed artifact's injected identity" | After arm (g) the destination holds P while the record claims X | **Declared exception, unstated in DM-2** — nit 3. F-8's case-specific clause governs and explicitly says "its actual identity may differ from the recorded claim, which is precisely this limit". |
| Pair-inversion precondition | The precondition is untouched; only the *write* is now stated | **Consistent.** The precondition stays: readable, `current` names the destination's artifact, `previous` present. |
| AC-F8-2 (645) | "writes the claimed name **verbatim** in `current` …, and reports those two recorded identities, never a slot-derived identity" | **Consistent, and normative.** The arm is now checkable against a spec sentence, which is what iteration 5 asked for. |

**Result: no contradiction** with F-9, §8.1, AC-F9-3, AC-F8-2 or the precondition. Two residual internal tensions exist and are both explanatory-clause level: F-8's own general sentence "the record a rollback must write carries both names — the slot's occupant in `current`" now sits beside the limit clause that writes the claim instead (nit 3), and DEC-13's rationale column and TDR-0040 §4 repeat that general form. Neither can mislead an implementation, because the limit case is the one where the general form is *unimplementable* (no process can read P), and the case-specific clause is marked "**On that proceed**".

**The limit is also self-healing, which no artifact claims and none needs to.** Running `install` from whatever artifact is actually at the destination after the arm-(g) rollback is an ordinary agreement run: content equality stops the replace at step 4 and reconciles the record in place, so the record's `current` becomes the true identity and `previous` becomes the predecessor the readable record named (F-9; `TC-INST-037` arm (a) is exactly this shape). The false `current` is therefore repairable by the next install, without a second rule.

## Wide sweep

| Class | Result |
|---|---|
| Unsatisfiable assertion | **None left.** Arm (g) is the only case that exercised the limit and it is now satisfiable (§ re-derivation 1). The negated slot-report assertions are negative by construction. |
| Predicate stated two ways | **None on the proceed/refuse question.** `recordState` (record vs running) and the pair precondition (record vs disk) stay distinct in F-8, DM-4, §8.1, `TC-INST-026`, `TC-INST-041`, `TC-INST-044` step 8 and the plan's phase-3 predicates block — unchanged from iteration 5. |
| Case whose precondition cannot exist in its phase | **None.** Arm (g)'s fixture is declared by phase 2 (`tests/fixtures/install/records.ts`, plan 2082) and consumed by phase 3 (`install-record.test.ts`); the declared-limit record is named in the fixture row (test plan 593). |
| Unowned falsified artifact | **None new.** No delivered page states the install record's field roles (`doc/planning/.../install-model.md` describes the slot layout and `--rollback` only), so v1.6's clause falsifies nothing in `doc/**`. The nine-page §16 set is unchanged from iteration 5. |
| Count / ordinal drift | **None new.** 84 cases (12 `TC-BIN-060..071` + 72 `TC-INST`), 14 unique `TC-BIN` ids of which `050`/`057` are delivered-suite references; 34 ACs in both directions; the eleven rows, 65 → 66 and 149 → 160 are untouched by v1.6. |
| Version-reference drift | Test plan 78 still cites spec **v1.5** as the binding source (nit 1). |
| Placeholder / orphan | **None.** No TODO rows, §5.1 / §5.2 / §7.3 remain set-equal, `TC-INST-042`'s summary line (362) now reads "takes a wrong `previous` name at its word" instead of claiming a refusal. |
| Plan validity | `delivery-os plan validate GH-346` → `verdict=valid`, `artifact=yaml`, `tier=full`, `readyForDevelopment=true`, run from the repository root against the uncommitted diff. |
| Plan structural integrity | The uncommitted diff is comments only (§ snapshot note), so the 34/34 AC and 84/84 case ownership map and the phase file counts (20 + 67 + 28 + 22 + 7 + 10 = 154) are unchanged from iteration 5's PASS. |

## Findings

All five are **non-blocking**. None is raised as a reason to reopen a phase; they are recorded so the debt is visible if an artifact is touched again.

1. **[nit] `test_planning` — `chg-GH-346-test-plan.md`#78 (binding-source row), #798 (`OQ-TP-9` row)**
   Gap: the binding-source cell names **spec v1.5** while the spec is v1.6, and the v1.5 clause in that cell already describes the **v1.6** content ("the claim is written verbatim into the record's new `current`"). No reader is misled about content, but the pointer is one version behind the artifact it describes.
   Suggested remediation target phase: `test_planning` (carry-forward, not a reopen).
   Suggested fix: bump the cell to v1.6 and add one clause naming the v1.6 write-and-report sentence; leave the v1.1–v1.5 history as history.

2. **[nit] `test_planning` — `chg-GH-346-test-plan.md`#480 (arm (g) step 7, explanatory clause)**
   Gap: "the record a rollback writes names the **slot's new occupant** first and the displaced destination second" is inverted for the ordinary case too — after a rollback the slot's new occupant is the displaced destination and lands in `previous` (second). The literal `{current: X, previous: A}` and the clause that follows it ("X … becomes `current` and A … becomes `previous`") are correct, and plan 1832–1840 states the rule correctly ("`previous` = A is the slot's new content"), so this is one mislabelled rationale, not a wrong assertion.
   Suggested remediation target phase: `test_planning` (carry-forward).
   Suggested fix: read "names the **destination's** new occupant first (the artifact the record claimed for the slot) and the displaced destination second".

3. **[nit] `specification` — spec#185 (F-8), #548 (DEC-13 rationale column); echoed in TDR-0040 §4 (368)**
   Gap: F-8's general sentence "the record is a precondition because the record a rollback must write carries both names — **the slot's occupant** in `current` and the displaced destination in `previous`" is unqualified and is false under the declared-limit proceed two sentences earlier, which writes the **claim** X. The case-specific clause is marked "**On that proceed**", so no implementation can be built wrong from it (the general form is unimplementable when the occupant is unknowable), but the spec now contains the rule and its own exception without saying which is general. This is the same watch-item iteration 5 carried against TDR-0040 §4, sharpened by v1.6.
   Suggested remediation target phase: `specification` (carry-forward; a decision-record note is the better home for the TDR half).
   Suggested fix: qualify the general sentence with "in the ordinary case" (or "the record's claim for the slot's occupant"), in F-8 and DEC-13; add the same one-word qualifier to TDR-0040 §4's write sentence.

4. **[nit] `test_planning` — test plan#480 (step 7 and Expected), #127 (AC-F8-2 row), #773 (TR-11); plan 109–111, 2013–2016, 2028**
   Gap: "`install status` reports `current` as the record states it (**X**)" uses `current` — which is also the `recordState` enum value — for the record's identity field. The parenthetical (X) pins the intended reading, and DM-4 keeps `recordState` and the `installed` group apart, so the sentence is determinable; but after arm (g) an `install status` invoked from A reports `recordState` = **`record-stale`** (record X against running A), so a coder who reads the backticked `current` as the enum would write an assertion a correct implementation fails.
   Suggested remediation target phase: `test_planning` (carry-forward).
   Suggested fix: "the record's `current` identity reads X in the report's `installed` group"; optionally add "and `recordState` reads `record-stale` against the running A" so the limit's report-side consequence is pinned rather than left implicit.

5. **[minor, non-blocking] `specification` — the slot-admission mechanism F-8's premise rests on**
   Gap: `install.slot.invalid` refuses a slot that is "not a compiled artifact carrying an injected identity", but no artifact says **how** that is judged. F-9 (187) is careful — identity cannot be read from a file "without executing it" — yet nothing forbids the admission check from executing the slot artifact (the delivered read-free `--version` is exactly how identity is normally obtained). If it does, the proceeding rollback *could* know P, and the declared limit survives only because the record path does not ask and the schema cannot store it.
   Why it does not block: every declared case is still satisfiable and discriminating under either mechanism — `TC-INST-021`/`TC-INST-026` assert outcomes (launcher and identity-less binary refused, compiled artifact admitted), arm (g) forbids *reporting* P regardless of whether P was learnable, and the plan's guardrail (1087) makes any `previous`-versus-slot comparison an escalation trigger. The behaviour the ticket asks for is fully specified; only the internal predicate is free.
   Suggested remediation target phase: `specification` or a phase-3 declaration note (carry-forward).
   Suggested fix: one sentence — "the slot admission predicate is decided without executing the artifact (a structural compiled-artifact-and-marker test), so no rollback path ever learns the slot's identity; execution is reserved for the artifact the operator invoked" — or the opposite decision, stated.

## Residual risks and accepted debt (non-blocking)

Iteration-5 debt, re-checked; the correction changed the status of none of it:

| Residual | Status now | Suggested home |
|---|---|---|
| `feature-cli-entrypoint.md:131–133` states steer/metrics/supervise as the twenty-third/-fourth/-fifth family; all three stay true, but no obligation, phrase pair or guardrail names them, while phase 6 edits that page. | **Unchanged** — verified still true and still unowned (page lines 131–133). Coder hazard, not a false claim. | phase 6 nit: leave the mount-table ordinals verbatim, one assertion in `TC-INST-111` step 1. |
| TDR-0040 §4 carries the iteration-4/5 restatement in place, with no amendment heading, and its two descriptive sentences still read as a name match. | **Unchanged**, and now joined by nit 3 (the write sentence). | decision record (nit). |
| Spec §12 (486) "pending that amendment" and Appendix F (880) "until that amendment lands" — the amendment has landed. | **Unchanged.** Meta-wording only. | `specification` (nit). |
| `feature-metrics.md:264` "The family-count pins read 24 and no stale 23 remains" has been false since GH-295, on a page this change edits and whose three count sites it moves. | **Unchanged** — verified (page line 264). Pre-existing drift, not falsified by this change; the page obligation names the present-tense count sites only. | owner decision / optional phase-2 sweep. |
| The `149 entries` whole-form leftover scan can flag the title at `tests/structure/error-table.test.ts:2493`. | **Unchanged** — verified. Loud, inside a declared file; the coder must move the title. | `test_planning` (nit). |
| Plan phase 1's acceptance line maps `TC-BIN-067` to `AC-F2-3` while §7.2 places that case in the phase-2 family-array move. | **Unchanged.** The case is declared and owned; only a parenthetical is loose. | `delivery_planning` (nit). |
| `chg-GH-346-pm-notes.yaml` records `clarify_scope.started 16:53:00Z` against `completed 16:09:23.758Z`. | **Persistent since iteration 2** (the row has been carried unchanged because the mirror must not be hand-edited). The registry is authoritative and all four artifact phases are complete. | observation. |
| The operating consequence of the limit itself: after a declared-limit rollback the record's `current` names an artifact the destination need not hold, so `install status` can report an identity that is false, and no delivered gate can catch it (no slot digest). | **Accepted, and now honest**: F-8, DEC-13, §8.1 and AC-F8-2 each say so, and the falsehood is repairable by the next `install`'s content-agreement reconciliation. This is inseparable from "wrong admitted by declared limit". | none needed; recorded so the reviewer reads it as declared, not as a defect. |

## Facet Summary

- spec_completeness: **PASS** — all nine ticket tasks and six acceptance clauses trace (§17); F-8's new clause closes the last unspecified behaviour on the rollback path.
- ac_quality: **PASS** — 34 ACs independently testable; AC-F8-2 now states the proceeding rollback's field roles and reported identities, so the arm is checkable against the criterion rather than against the observer's view.
- plan_coverage: **PASS** — 34/34 ACs and 84/84 cases have exactly one owning phase; `plan validate` = `valid`, `readyForDevelopment=true`; the diff touches comments only.
- test_traceability: **PASS** — §3.1 / §3.1.1 / §3.2 / §3.3 / §5.1 stay bidirectional; arm (g) is traceable to AC-F8-2, `TR-11` and `OQ-TP-9`, all three now carrying the same corrected outcome.
- cross_artifact_consistency: **PASS** — spec F-8/DEC-13/§8.1/AC-F8-2, test plan arm (g)/Expected/AC row/DM-2 row/fixture row, and plan phase 3 + its three gate-signal restatements state one field order (`{current: X, previous: A}`), one reported pair (X, A), and one absence (no slot read). **The iteration-5 FAIL is closed.**
- decision_capture: **PASS** — OQ-TP-9 / TR-11 resolved into TDR-0040 §4 and mirrored; the five TDRs remain `Proposed` for PR acceptance; the amendment-heading gap and the write-sentence qualifier are nits.
- system_spec_consistency: **PASS** — no delivered page states the install record's field roles, so v1.6 falsifies nothing; the nine-page §16 set, the count/ordinal split and the entrypoint phrase pair are unchanged from iteration 5's PASS.
- plan_doc_update_coverage: **PASS** — the twelve documentation paths still split 5 (phase 2) + 7 (phase 6), with the entrypoint page and its phrase table as one edit-set; the residual is the unowned *leave-alone* clause for three true ordinals (nit).
- plan_code_area_coverage: **PASS** — every code, suite, fixture, script and page is declared by its owning phase, unchanged by a comments-only diff; `records.ts` is phase 2 with the declared-limit fixture named.
- dod_defined: **PASS** — AC-F16-1 plus §16's obligations, NFR-14/NFR-17 and the G0–G7 battery are testable and traceable; arm (g) now fails only for the four declared reasons.

## Verified, not findings

- **Plan validity, from the working tree, from the repository root.** `delivery-os plan validate GH-346` → `verdict=valid`, `artifact=yaml:chg-GH-346-plan.yaml`, `tier=full`, `readyForDevelopment=true`. (Recorded because a first invocation of this gate ran the same command **from the change folder**, where `changesDirectory` resolves to `<change folder>/doc/changes` and the tool correctly answers `plan.artifact.missing`; a stray human-format `invalid` in a log is a working-directory artefact, not a finding.)
- **The correction is real, not textual.** Walked assertion by assertion above: bytes-only equality for the two occupants, a claim-verbatim record, a negative report assertion, and a schema-level structural guard. The old clauses ("destination then holds P's bytes and **reports P's identity**", "its `previous` carrying **X verbatim**") are gone from all three artifacts and survive only inside the v1.5/v1.6 history rows that quote them as superseded.
- **Every restatement landed.** `install status reports current per the record (X)` and the `{current: X, previous: A}` literal appear consistently at plan 109–111, 527–536, 616–621, 1057–1062, 1832–1880, 1953–1960, 2013–2016, 2041–2043 and test plan 26, 127, 166, 480, 593, 773, 798 — nine plan sites and seven test-plan sites, one direction, no survivor with X in `previous`.
- **Arm (f1)/(f2) are still non-vacuous.** Each refuses on the destination leg with `previous` asserted present *before* the run, so no refusal can be explained by a missing name; the `--stop-daemon` arm still rides (f2) and still asserts an empty ordered daemon log.
- **`TC-INST-026` / `TC-INST-042` still partition the ordered set**, and `TC-INST-044` steps 7–8 remain reporting-only (no rollback run in the pre-upgrade home).
- **Counts and ids hold.** 72 `TC-INST` + 12 `TC-BIN` in-change cases, 34 ACs, §3.4's integrity table matching; §7.2's rows and the eleven `install` rows unchanged by v1.6.
- **The reservation around iteration 1's blockers still holds.** The Appendix B step-4 agreement stop, the step-5 skip, the `ownsInstallation` seam, the alias refusal's invoked identity / owning role / remedy, and the `runningArtifactPath` seam are unchanged and implementable.

## Iteration note

This is the **sixth** gate, called by the PM explicitly as a confirmation pass, and it closes on the first re-run: one blocking finding raised, one authoring pass spent, zero findings carried forward, zero new blocking findings. The trajectories the previous gates tracked hold — MAJOR findings 3 → 2 → 0, blocking findings 1 → 0, and no iteration has repeated an earlier finding's substance.

The PM's `pm-notes` decision entry pre-committed that "if a sixth gate is needed, stop and escalate to the human instead". That condition is not reached in the sense it was written for — the clause existed to stop an unbounded remediation loop, and this pass requests no further iteration and needs no artifact reopened. What the `pm-notes` record now owes is the closure itself: a `notes:` entry for iteration 5's NOT_READY → v1.6 remediation → iteration-6 READY, and the `dor_check` phase completion. That is the PM's record to write, not this gate's.

The hard gate is **open**: delivery may start on the plan as declared. The override route was never needed — this is a behavioural change with contract and documentation impact, and it now has a DoD it can be held to.
