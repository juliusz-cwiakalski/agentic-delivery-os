# Readiness Review Iteration 4

Verdict: READY
Work Item: GH-268
Date: 2026-11-11
Pause Required: no

Iteration 4 (PM-approved cap extension, last iteration before human escalation), run after the iteration-3 remediation. Inputs re-read in full: `chg-GH-268-spec.md` v1.5 (524 lines, 19 ACs, history row 1.5 at line 501), `chg-GH-268-test-plan.md` v0.5 (1394 lines, 40 TCs, revision row 0.5 at line 1380), `chg-GH-268-plan.yaml` v1.3 (557 lines, 5 phases; `pnpm exec delivery-os plan validate GH-268` → `verdict=valid`, `readyForDevelopment=true`), `chg-GH-268-pm-notes.yaml` (which records the deliberate cap extension at lines 103–112), and `readiness-review/readiness-iter-{1,2,3}.md`.

Iteration 3's blocking finding — the declared fixture-local binary mechanism — is **closed and empirically re-proven in this review**, not accepted on the strength of the prose. The remaining artifacts contain no defect that can change the delivered behaviour or make a specified verification unreachable; the residues found are wording/citation precision and are reported as non-blocking.

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

Structural results re-verified programmatically: all 19 ACs appear exactly once in `acCoverage` (19 entries, 19 unique, no missing/extra/duplicate against the spec's 19 `AC-` rows); the scenario index, the detailed sections and the plan's coverage declarations all carry the same 40 TC ids (index 40, `^#### TC-` sections 40, no orphan in either direction); all 24 declared `FX-` fixtures are used and every used fixture is declared.

## Iteration-3 closure verification (re-measured, not taken on trust)

| Iter-3 | Claim | Verified |
|---|---|---|
| 1 (blocking) | Fixture binaries installed as an **exec wrapper**, never a symlink/copy; helper rationale recorded; every fixture/table/TC reference updated; `FX-PATH-FOREIGN` uses the same wrapper outside the fixture repo | **Closed, mechanism proven working.** Re-read `node_modules/.bin/commitlint`: a 1794-byte `/bin/sh` shim with `basedir=$(dirname "$0")` → `exec "$basedir/../@commitlint/cli/cli.js"` and an absolute `NODE_PATH` (`@commitlint/cli` 21.2.4). Built the wrapper exactly as §6.2 specifies and measured: fixture with its own `commitlint.config.js` (ESM `export default { extends: ["@commitlint/config-conventional"] }`) → valid message exits `0`; 140-char body line exits `1` with `[body-max-line-length]` parseable; **invalid** config exits `1` with `SyntaxError` on stderr and **zero** `[rule-id]` lines (so the plan's parse contract correctly yields `DM-1.h`, which is what `FX-BAD-CONFIG` exists to prove); the same wrapper written to `_test_tmpdir/bin/commitlint` outside a fixture with no `node_modules` resolves and returns `0`/`1` normally, i.e. the foreign-origin case reaches PASS. The fixture reads its **own** config (the invalid one), which proves the wrapper does not substitute the delivery repo's configuration underneath the fixture. Wrapper text present at test-plan lines 374, 1241–1249, 1269–1270, 1323, 1349 and plan lines 176–196, 222–237, 386. |
| 2 (non-blocking) | Exit-literal requirement replaced by outcome-path subset + one `130` inside `_on_interrupt` + usage documentation, mirrored in plan Phase 1 | **Closed and satisfiable.** `.ai/rules/bash.md:837-845` really is the canonical `_on_interrupt() { … exit 130 }` block behind `trap '_on_interrupt' INT TERM`. Replayed the four new Phase 1 verification lines (plan 389–392) verbatim against a bash.md-faithful sample script that also documents `130` in `usage()` (as NFR-7 requires): all four pass. Falsifiability checked too — injecting `exit 3` on an outcome path makes line 389 print `3` and fail; a second `exit 130` statement makes line 390's count check fail. No conflict with `.ai/rules/bash.md` §10.5 constants remains, because the checks are subset-shaped. |
| 3 (non-blocking) | The two untested v1.4 precedence pairs asserted | **Closed.** `TC-COMMITLINT-007` step 5 (`--base no-such-ref` in `FX-NO-CONFIG` still exit `0`/`SKIP`, no `DM-1.e`) and `TC-COMMITLINT-020` step 7 (`FX-CLEAN-NO-DEPS` + unresolvable base reports the base cause, `e` before `g`) are both reachable under the pinned evaluation order (configuration presence precedes base resolution; base resolution precedes the tool probe). |
| 4 (minor) | SOURCES re-pinned to spec v1.5 / test plan v0.5, third review cited | **Closed.** Plan lines 46–99: revision v1.3 cites `readiness-iter-3.md`, SOURCES pins spec v1.5 and test plan v0.5 (with the plan's own back-link declared), and the v1.4 DM-1 order is cited as normative. |
| 5 (nit) | `TC-COMMITLINT-009` step 6d relaxed to "ran at least the declared commit count", count declared | **Closed.** Step 6d (line 417) asserts the marker is non-empty, every recorded line names the shim path, and the invocation count is **at least** the declared commit count, explicitly forbidding an exact total; `FX-BAD-CONFIG-NO-LOCAL` declares a single-commit range (lines 405, 1229, 1274). |
| 6 (nit) | Appendix C row 9 attributes the omission to (a), (b) and (c); `TC-DOC-003` step 4 allows the illustrative route | **Closed.** Spec line 477 now says "(a), (b), and (c) already omit `scripts/lib/dispatch-authority.sh`" with the either/or rule applied to all three, mirrored in F-8 (line 127) and the §16 row (line 351); test-plan line 939 applies the same choice to the overview sentence. |

Repo-truth spot-checks re-measured at this review and still true: `.husky/commit-msg` untouched surface, `commitlint` 21.2.4 at `node_modules/.bin/commitlint`, `scripts/install.sh:123-130` six-entry `ADOS_DELIVERY_SCRIPTS` including `scripts/lib/dispatch-authority.sh`, `scripts/test-all.sh:88` `-perm -u+x` discovery, `scripts/build-claude-plugin.sh` accepts `--verbose` (line 478), `.gitignore` covers `tmp/`, the suite harness uses `_test_tmpdir="$(mktemp -d)"` (outside the worktree, so the read-only and clean-tree assertions are not self-defeating), and `commitlint` still accepts the plain subject `Merge remote-tracking branch 'origin/main'` (exit `0`) while rejecting a 140-character body line — the parity claims behind `TC-COMMITLINT-004`/`DEC-4` hold.

## Findings

Blocking findings: 0.

The four items below are non-blocking. Each is wording/citation/specification-tightness only: none can make a specified verification unreachable, none changes a delivered behaviour, and each is resolvable by the phase that owns the file without reopening a completed phase. They are recorded so they are not silently lost.

1. [minor, non-blocking] cross_artifact_consistency — `chg-GH-268-plan.yaml`#DELIVERY PINS, first bullet (line 137)
   Gap: the invocation-contract bullet still ends "No other exit code exists (TC-COMMITLINT-012 step 5 asserts the literal set)" — a residue of the pre-iter-3 wording. It now contradicts `TC-COMMITLINT-012` step 5 (line 497: "Do **not** assert set equality with `{0, 1, 2}`") and the plan's own Phase 1 pins 20 lines below (lines 389–390, which *require* one `exit 130` in `_on_interrupt`). The authoritative pins and spec NFR-7 are unambiguous and were replayed green against a canonical script, so nothing in delivery depends on the stale clause; it is a leftover sentence in the same plan, of exactly the family as the resolved iter-3 finding 2 (persistent residue, different defect).
   Suggested remediation target phase: delivery_planning
   Suggested fix: replace the parenthetical with "(TC-COMMITLINT-012 step 5 and the Phase 1 pins assert the outcome-path subset plus the documented `130` interrupt carve-out)".

2. [minor, non-blocking] test_traceability — `chg-GH-268-test-plan.md`#`TC-COMMITLINT-012` step 5 (line 497)
   Gap: the mechanical clause "assert every `130` occurrence lies inside the `_on_interrupt` body" is over-broad as written, because the same step (and spec NFR-7, line 261, and plan pin line 392) require `usage()` to *document* `130` as an interrupt code — that documentation is a `130` occurrence outside the handler. The intended meaning is recoverable from the immediately preceding sentence ("every `exit N` literal") and from the plan's precise form (`grep -cE '^[[:space:]]*exit 130[[:space:]]*$'` = 1 plus the handler-body probe), both of which a canonical script satisfies; a literal reading would only cost a one-line assertion edit during Phase 1, never a behaviour change.
   Suggested remediation target phase: test_planning
   Suggested fix: say "every `exit 130` **statement** lies inside the `_on_interrupt` body; `usage()` may name `130` as the interrupt code".

3. [minor, non-blocking] test_traceability — `chg-GH-268-test-plan.md`#§6.2 fixture matrix, `FX-EMPTY` (line 1224) and `FX-ALT-CONFIG` (line 1227) vs the binary-availability table (lines 1269–1275)
   Gap: both fixtures need a usable linter, but neither row nor the availability table says so. `FX-EMPTY` must reach `DM-1.b` (PASS, zero commits), and under the pinned order binary availability (`DM-1.g`) is resolved *before* the per-commit verdict, so an empty-range fixture without a local binary would report `ERROR`, exit `2`; `FX-ALT-CONFIG` is asserted to exit `1` naming the violated rule (step 4), which likewise needs a real lint verdict. §6.2's general rule ("Fixtures that need a working linter get one through a helper") does cover them, and the failure would be loud and one line to fix, so this is under-specification rather than a broken mechanism.
   Suggested remediation target phase: test_planning
   Suggested fix: add `+ local exec wrapper` to both fixture rows (or add TC-006 and TC-007 step 4 to the repository-local row of the availability table).

4. [nit, non-blocking] cross_artifact_consistency — `chg-GH-268-test-plan.md`#§2 References (line 49)
   Gap: the spec reference row still bounds the decision log at "DEC-1…DEC-9" while spec v1.5 carries DEC-10 (the binary-precedence/disclosure decision) and the test plan itself cites DEC-10 in `TC-COMMITLINT-008`/§8.2. Citation only; no assertion depends on it.
   Suggested remediation target phase: test_planning
   Suggested fix: change to "DEC-1…DEC-10".

5. [nit, non-blocking] test_traceability — `chg-GH-268-test-plan.md`#`TC-COMMITLINT-013` step 5 (line 526)
   Gap: "count `FAIL` occurrences equals the offender count" is not stable against the spec's own quotable verdict line (§10), which will contain a `FAIL` token on the summary. The intended assertion is one block *header* per offender (the pinned block template at plan line 212), which is what an implementer will write.
   Suggested remediation target phase: test_planning
   Suggested fix: count matches of the block-header shape (`^FAIL <sha> (`) rather than the bare token.

## Gate Result

READY. Delivery is unblocked.

The one defect that gated iteration 3 was a mechanism that could not hold against this repository's tooling. It is now closed on evidence produced in this review: the `exec`-wrapper fixture binary returns `0` on valid history, `1` with a parseable `[body-max-line-length]` on an over-long body, and `1` with `SyntaxError` and no rule-id line on an invalid configuration (⇒ `DM-1.h`, exactly as `FX-BAD-CONFIG` intends), and the same form works from outside the fixture repository so the `PATH`/foreign-origin case still reaches `PASS`. The reworked exit-contract assertions were replayed verbatim against a bash.md-faithful script and pass, and are falsifiable in both directions, so the iter-3 "two requirements that cannot both be satisfied" conflict is gone. Coverage is structurally complete (19/19 ACs exactly once, 40/40 TCs homed, 24 fixtures declared and used), `plan validate` is green, and every remaining item in Findings is wording, citation, or assertion precision that cannot change what is delivered — so it does not gate.

Routing for the PM: none required for delivery. If the owner wants zero residue, the four lowest-cost items are `delivery_planning` (finding 1) and `test_planning` (findings 2–5); all five are optional and none requires reopening a completed phase before starting `delivery`. No human decision is required and no pause is set. This review authored nothing but this record (no source, artifact, or git operation).
