# Readiness Confirmation (narrow, after iteration 3)

Verdict: READY
Work Item: GH-416
Date: 2026-11-27
Pause Required: no
HEAD reviewed: `ac4129a6a` (branch `feat/GH-416/lane-pushes-own-evidence-commit`)
Record name: follows the PM's instruction (`readiness-confirmation.md`, the GH-286 precedent). It sits beside `readiness-iter-1.md` to `readiness-iter-3.md` and is not a fourth iteration record.

Review type: a narrow confirmation of the plan correction that followed iteration 3. It re-verifies the delta and the five checks the PM named, each against the tree and the history, and it carries every other result from `readiness-review/readiness-iter-3.md`.

## Basis for a narrow confirmation

- Iteration 3 returned NOT_READY on one blocking finding (3-B1). That finding was new, not persistent, and every earlier blocking finding was closed.
- Its Gate Result named the correction (one path, one list entry, one comment line) and stated that a narrow confirmation of the plan after the edit can stand in for a full re-run.
- PM ruling R16 (`chg-GH-416-pm-notes.yaml`, the note "DoR ruling R16 and the iteration-limit decision") records the correction and the limit decision: three remediation iterations are exhausted, this is one new finding with a mechanical correction and a direct precedent rather than a stalemate on a persistent blocker, and the owner is told in the change's final message.

## Delta reviewed

Commit `ac4129a6a` touches three files in the change folder: `chg-GH-416-plan.yaml` (revision v1.5), `chg-GH-416-pm-notes.yaml` (the iteration-3 verdict note and ruling R16) and the committed `readiness-iter-3.md`. The spec (v1.5) and the test plan (v1.6) are byte-identical across that commit.

The plan's machine-readable change is exactly one line: `doc/quality/test-specs/test-spec-loop-supervision.md` added to phase 3's `scope.files` (plan :1292). A diff of both revisions with every comment line removed shows that single addition and nothing else. Every other plan change is a `#` comment.

## The five checks

### 1. The page is in phase 3 scope, with a true same-commit statement: PASS

- Scope: plan :1292, inside phase 3's `scope.files` (:1285-1357). The validator's envelope lists the page under phase 3.
- Count-and-tail list: plan :1172-1181. The page is the list's last member (:1181).
- Never-edited line: plan :1196-1199 now reads "the decision records that state a family's ordinal, and every pre-existing changeset", plus `m4/backlog.md`. The page is gone from it. The plan mentions the page in five other places (:12, :119, :562, :1182, :1292) and none excludes it; :562 is the closed Part F history entry quoting the old state.
- Same-commit statement (plan :1182-1188), each claim checked against the tree:
  - `doc/quality/test-specs/test-spec-loop-supervision.md:158` reads "the prompt-required set at 28 families with `provider` last and `loop` 27th". Exact match.
  - The page's frontmatter carries `status: Current` (:4).
  - `tests/checks/doc-conformance.test.ts:2331-2334` is the page's `GH350_TRUTH_ROWS` row. Its `required` phrase (:2333) is that exact sentence. The describe at :2373 and the test at :2382-2384 assert it.
  - Commit `e1ebc76cf` changed that page line from "at 27 families with `loop` last" to the 28 form, and added this row in the same commit. The precedent is stated correctly.

### 2. No other page or row stating the outgoing count or the last member is out of scope: PASS

Five sweeps of the tracked tree: word forms ("twenty-eighth", "28 families", "`provider` last"); digit forms near a family, command, row or mount word, case-insensitive, including 27 and 29; numberless tail statements; every standalone `28` in current docs; and the count assertions in tests, scripts and packages together with the `PINNING_FILES` derivation. `doc/changes` was excluded. `doc/decisions` was excluded from the sweeps and its hits were then read by hand.

- Eleven current pages state the count or the last member, and all eleven are in phase 3's scope (plan :1286-1297, with the new `push.md` reference page at :1290 among them): `doc/00-index.md`, `doc/overview/glossary.md`, `doc/planning/oss-tooling/cli-command-registry.md`, `m1/commands/provider.md`, `m4/flip-plan.md`, the loop-supervision test spec, and the `feature-board`, `feature-cli-entrypoint`, `feature-install-lifecycle`, `feature-metrics` and `feature-provider-engine` pages.
- `tests/checks/doc-conformance.test.ts` holds the phrase rows, including the other two `GH350_TRUTH_ROWS` rows (:2312-2329): `feature-provider-engine.md` requires "the twenty-eighth and last" and `feature-board.md` requires "28-family counts". Both phrases stop being true with this change. The file is in phase 3's scope (:1328), the suite runs in phase 3 (:1243), and the plan's rule at :1172-1175 moves each row with its page.
- All 17 `PINNING_FILES` members (`tests/fixtures/metrics/mounting.ts:54-72`) and every `toHaveLength(28)` or `at(-1) === "provider"` assertion are in phase 3's scope. The one count assertion outside it, `tests/behaviour/dispatch-divergence-count.test.ts:137`, counts divergences, not families.
- Of the 21 standalone `28` hits outside phase 3's scope, none is a family count: they are dates, a template line number, a scenario id and a link count.
- Two statements stay out of scope on purpose, and both are sound. `doc/planning/oss-tooling/milestones/m4/backlog.md:107` says "the twenty-eighth prompt-required family" with no "and last", which stays true. The decision register (`doc/decisions/TDR-0063-...md` and `doc/decisions/00-index.md:137`) states what an accepted decision mounted, and is covered by the never-edited rule at plan :1196-1197.
- No live change on the branch declares the page. The only other plan that names it is GH-348, which created the page and is merged (#371).

### 3. The three wording corrections are true against code: PASS

Code: `packages/adapters/src/git/push.ts:75-79` defines `isSafeRef` as the alphabet check alone. The separate `PROTECTED_REF_NAMES` membership check at :146 is what refuses a protected name. The set is `main`, `main-tools`, `HEAD` (`packages/core/src/contracts/closeout.ts:146`, pinned at `tests/structure/closeout-contract.test.ts:159`).

Executed through the real seam with an injected child runner: each of `main`, `main-tools` and `HEAD` returns `{"outcome":"rejected","detail":"protected-ref"}` with zero child calls. The alphabet guard at :145 runs first and would have answered `unsafe-branch`, so this proves that the alphabet predicate accepts all three and that only the set check refuses them. None of the three is a convention match (`branchConvention`, `packages/core/src/domain/closeout.ts:337-338`). Convention matches carrying `~`, `..`, a space, `:` or `?` return `unsafe-branch`, so the safe-ref refusal is exercisable on a resolved name, as the plan says.

- Fence, plan :317-321: "a direct call of the command's guard, the alphabet predicate and the protected-name membership check together ... the alphabet predicate alone accepts the protected members, which is why the set check is a separate second guard". True.
- Phase 3 step 2, plan :1030-1034: the same statement. True.
- Phase 3 exit criterion, plan :1263-1268: the same statement. True.
- Phase 1 cause constant, plan :697-701: protected-set membership is now "defence in depth that no resolved name triggers (proven by a direct call)". True, and it no longer calls it the command's pre-act refusal.
- No instance of "the shared predicate refuses each protected member" remains in the plan. The one surviving "shared predicate" phrase in operational text (phase 2's summary, :848) says the guards run "on the shared predicate and set", which is true.
- The two new code-truth restatements hold. Plan :124-127 matches `push.ts:75-79` and `:145-148`. Plan :128-130 matches `tests/structure/dispatch-token-home.test.ts`: the eleven-token literal regex at :66-67 includes `failed`, and :70-73 selects every `packages/*/src/**/dispatch*.ts` outside the contracts home.

The token-home control: one Verify line in each of phases 1 (:792), 3 (:1249), 4 (:1475) and 5 (:1595). It is declared in no phase's scope, which is right for a never-edited control. It is green at HEAD (7 pass). Each Verify comment names a module that the scanner's filter covers.

### 4. The plan validates and no scope entry contradicts the test plan: PASS

- `jaiship plan validate GH-416` on the plan as committed: `verdict=valid`, `readyForDevelopment=true`, `totalErrors=0`, `errors=[]`, `truncated=false`, exit 0. Eight phases in order 1 to 8. Phase 3 holds 72 files and one folder.
- The new scope entry against the unchanged test plan: TC-LDOC-001 step 5 (test plan :995) and its risk row (:1220) bind "every other M1/M2 reference page" to stay byte-unchanged. The page is a quality test spec under `doc/quality/test-specs/`, not an M1 or M2 page, so "the only M1 exemptions" stays true. The same step requires `tests/checks/doc-conformance.test.ts` green, which needs the page and its row to move together. The scope entry serves that step.
- The spec holds no closed list of count-and-tail pages that eleven pages would contradict.

### 5. Nothing else regressed: PASS

- AC Then clauses: the spec is byte-identical across the delta commit, so every AC is exactly what iteration 3 reviewed.
- Phase ids, order, kinds, titles, summaries and interactions are YAML keys. The comment-stripped diff shows they are unchanged. The validator reports phases 1 to 8 in order, with phases 1 to 7 `delivery` and phase 8 `planning`.
- AC and TC ownership: every `# AC:` and `# TC ownership:` block, and the header's "Test plan alignment" block (:202-217), is byte-identical across the delta.
- The delta agrees with the plan's own escalation trigger at :601 ("a page outside the declared count-and-tail set is rewritten to satisfy a pin"): the page is now inside the declared set.

## Facet Summary

"Re-verified" means checked on the delta for this record. "Carried" means unchanged from iteration 3, because the delta did not touch what the facet depends on.

- spec_completeness: PASS (carried; spec unchanged)
- ac_quality: PASS (carried; spec unchanged)
- plan_coverage: PASS (carried; the plan's machine-readable delta is one scope line, checked against the test plan)
- test_traceability: PASS (carried; test plan unchanged)
- cross_artifact_consistency: PASS (re-verified; one carried minor advisory below)
- decision_capture: PASS (re-verified; ruling R16 is recorded in pm-notes)
- system_spec_consistency: PASS (re-verified; iteration-3 finding 1 is closed)
- plan_doc_update_coverage: PASS (re-verified; closed)
- plan_code_area_coverage: PASS (re-verified; closed)
- dod_defined: PASS (carried; spec unchanged)

## Residual findings (non-gating; none blocks this verdict)

1. [minor] cross_artifact_consistency, carried from iteration-3 finding 2. Test plan :483, :493, :725, :732, :1216; pm-notes R13 (:303-307); plan :227.
   Gap: The test plan still says "the shared predicate refuses each protected member" and "call the shared predicate directly with `main` ... assert the protected members are refused". Against the symbol it names (the shared predicate in `packages/core/src/contracts/dispatch.ts`, test plan :1129) that is false: executed, the alphabet predicate accepts all three members. The plan is now correct at its three operative places, and its exit criterion tells the coder what the cell must exercise, so nothing wrong can ship from this. A coder who reads the test-plan step alone takes a wrong turn. The plan's landing note at :227 ("a predicate-level unit cell") paraphrases the same loose phrase. The spec does not carry it.
   Suggested remediation target phase: test_planning (optional; iteration 3 ruled that it can follow or be skipped without risk).
   Suggested fix: Align the five test-plan lines with the plan's wording, or name the reading in the pull request description.

Earlier non-gating advisories stand as recorded in iteration 3 (I-7, I-8 and I-9 open with the PM, and its carried advisories and nits). This confirmation neither re-opens nor re-verifies them.

## Decision routing

- Ruling R16 is a `change` decision and is recorded in pm-notes. No decision record is involved and no human input is needed.
- The residual above is `change`, wording only.
- No `needs_human_input` item exists. Pause Required stays no.

## Read-only statement

No source file was modified and no commit was made. The execution probe ran under `tmp/tmpdir` and was deleted. `plan validate` and the control suite were run read-only: HEAD (`ac4129a6a`) and the hash of the change folder were identical before and after, and the tree had no status entries. This record is the only file written.

## Gate result

READY. Iteration-3 finding 1 is closed by ruling R16, verified on the delta. The gate clears on the strength of iteration 3's full review plus this confirmation of the delta.
