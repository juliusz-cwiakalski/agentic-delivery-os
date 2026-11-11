# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-268
Date: 2026-11-11
Pause Required: no

Iteration 2 of the DoR gate, run after the specification/test-plan/plan remediation. Inputs re-read in full: ticket `juliusz-cwiakalski/agentic-delivery-os#268` (`gh issue view 268`), `chg-GH-268-spec.md` v1.3 (511 lines, 19 ACs), `chg-GH-268-test-plan.md` v0.3 (1364 lines, 40 TCs), `chg-GH-268-plan.yaml` v1.1 (463 lines, 5 phases; `pnpm exec delivery-os plan validate GH-268` → `verdict=valid`, `readyForDevelopment=true`), `chg-GH-268-pm-notes.yaml`, and `readiness-review/readiness-iter-1.md`. Repository truth re-verified for every literal the remediation touched (commands and results below).

No finding from iteration 1 is repeated; no finding is marked persistent. Findings 2–6 below are new or newly visible consequences of the amendment set — five of them minor/nit.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

`plan_coverage` fails only on non-assertive verification lines (finding 4); all 19 ACs still appear exactly once in `acCoverage` (12/1/1/1/4 across phases 1–5) and all 40 TCs still have a declared home or an explicit handoff (TC-DOC-002/003/005 → system-spec update; TC-CONFINE-001 → PR-time review). `test_traceability` passes on mapping, but the *evidence path* of AC-F3-5 is the subject of blocking finding 1.

## Iteration-1 closure verification (all ten closed as claimed)

| Iter-1 | Claim | Verified against repository truth |
|---|---|---|
| 1 major | Phase 2 raw-write scan negation-filtered, line 31 named as the exempt match | Unfiltered `grep -nE '\bgit[[:space:]]+(rebase\|reset\|commit…--amend\|push…--force\|filter-branch\|reflog…delete)' .opencode/agent/{committer,pm}.md` returns exactly one line — `.opencode/agent/committer.md:31` (`<rule>Never run `git add`, `git commit`, `git reset`, …`); the plan's filtered form exits 1 (empty). The prohibition is additionally asserted byte-identical. Closed. |
| 2 major | `/check` and `/check-fix` literals corrected with backticks + ERE anchors | `grep -cE '^\| `/check` \| Run quality gates \(no fixes\) \|$' AGENTS.md` → 1 and the `/check-fix` form → 1 (rows are `AGENTS.md:111-112`); the bare forms would indeed exit 1. Plan and `TC-DOC-001` step 3 now agree, and both state the re-verify requirement. Closed. |
| 3 major | DEC-10 binary precedence + origin disclosure + dogfood without `PATH` prefix | `node_modules/.bin/commitlint` exists and is executable; `command -v commitlint` resolves to `<sibling-checkout>/node_modules/.bin/commitlint` — a **sibling checkout**, i.e. the foreign-origin scenario DEC-10 discloses. Spec F-3/§10/§12/RSK-1/AC-F3-3 (+ unchanged DM-1.g), plan DELIVERY PINS, `TC-COMMITLINT-008`, and `TC-DOGFOOD-001` step 1 all state the same local-first/`PATH`-second/absent-is-loud contract; the `.husky/commit-msg` hook (`./node_modules/.bin/commitlint --edit`) and CI's `pnpm exec` form corroborate the rationale. `TC-COMMITLINT-007` step 3 pins configuration-check-before-binary. Closed (see finding 1 for the fixture consequence). |
| 4 major | Appendix C rows 9–10 register the delivered-set enumerations and the batch-guide install block | All four locations exist as described: `doc/spec/features/feature-autonomous-delivery.md:26` (overview enumeration), `:180-191` (Core Components table), `:193-200` (Install inventory blockquote), `doc/guides/autonomous-batch-delivery.md:37-41` (install comment block, genuinely non-exhaustive). F-8 names all three page locations; plan `docHandoffs` on phases 4 and 5; `TC-DOC-003` steps 4–7. Closed as a register (completeness caveat: finding 2). |
| 5 minor | `TC-PROMPT-003` negation-exempt framing | `tests/fixtures/prompt-inventory/lifecycle.json` pins `forbidden: ["git add", "git commit"]` for `.opencode/agent/committer.md` with `required: ["commit", "never stage"]`; both literals appear only inside the line-31 prohibition and `never stage` is at line 32. Closed. |
| 6 minor | `100755` requirement + discovery proof | `scripts/test-all.sh:88` discovery is `find … -name 'test-*.sh' -perm -u+x`; plan Phase 1/4 assert index mode and `test -x`, `TC-DIST-001` steps 2–3 pin the mode, and Phase 4 proves discovery by name. Closed. |
| 7 minor | Cross-links and version | Test plan front matter now has `version: 0.3` and `implementation_plan: ./chg-GH-268-plan.yaml`; plan cites v0.3. Closed. |
| 8 nit | `TC-COMMITLINT-009` removed from the AC-F3-3 row | §3.1 AC-F3-3 row now maps 007/008/DOGFOOD and states 009 is DM-1.h/AC-F3-5. Closed. |
| 9 minor | Remediation-ownership split | Spec F-4 + F-6 + AC-F4-1 assign committer/PM/acting-agent/gate roles; plan's prompt pin restates them; `TC-PROMPT-001` step 5 and `TC-PROMPT-002` step 7 assert them, and step 5 explicitly reconciles with `Never push and never rewrite history.` (verified at `.opencode/agent/committer.md:33`). Closed. |
| 10 nit | Parity principle routed as a decision record | Not routed as a record; recorded instead as `OQ-2` (deferred to the change reviewer/owner at PR review, DEC-1 cross-referenced). Accepted as a recorded, non-blocking deferral — the gap is no longer silent. Not repeated. |

Additional repo-truth checks that pass: base precedence in the plan (`--base` → `ADOS_BASE_BRANCH` → `- **Default base branch**: `<ref>`` → `main`) matches `scripts/deliver-ticket.sh:292-309` and `.ai/agent/pr-instructions.md:20` (`main-tools`); the eight configuration candidates match `scripts/checks/commitlint-authority.ts:16-23`; `@commitlint/cli` is `21.2.4` as the plan claims; `scripts/build-claude-plugin.sh --verbose` exists; `test-deliver-ticket{,-result-tuples,-result-tuples-modes}.sh` and `test-doc-distribution.sh` exist; `.opencode/agent/pm.md:285` step 9 matches `TC-PROMPT-002`; `build_delivery_prompt` and the bare `git merge origin/${base_branch}` at `scripts/deliver-ticket.sh:948` match phase 3; the current suite assertion is at `scripts/.tests/test-deliver-ticket.sh:1001`; `pnpm check` composition matches spec §2.1; `ADOS_DELIVERY_SCRIPTS` is `scripts/install.sh:123-130` and is copied at `:847-854`.

## Findings

Blocking finding: 1.

1. [major] cross_artifact_consistency — `chg-GH-268-test-plan.md`#`TC-COMMITLINT-009` step 6, §6.2 `FX-BAD-CONFIG` row and "Binary availability per case" table, `TC-COMMITLINT-020` row h; mirrored by `chg-GH-268-plan.yaml`#DELIVERY PINS "Committed fixtures" / "Lint invocation and parse contract"
   Gap: DEC-10's local-first resolution makes the DM-1.h *execution-failure* half of AC-F3-5 unreachable as written. `FX-BAD-CONFIG` is defined only as "`commitlint.config.js` copied from `commitlint.config.invalid.txt`"; its binary origin is stated nowhere — it is absent from the "Binary availability per case" table that the remediation added. Under the test plan's own rule ("fixtures that need a working linter get one through a helper"; `FX-BAD-BODY` is "local binary installed"), `FX-BAD-CONFIG` carries the fixture-local `node_modules/.bin/commitlint`, so step 6's shim prepended to `PATH` **never executes**: the gate resolves the local binary, the invalid configuration raises `ERROR`/exit `2`, and steps 1–5's assertions pass again for the invalid-config reason. The sub-case therefore proves nothing while reporting green — the exact "gate that verifies nothing" failure this change exists to eliminate, and the same vacuity discipline the remediation correctly applied to `TC-COMMITLINT-008`'s decoy. The alternative reading (no local tree) is equally undeclared: steps 1–5 would then be decided by an unstated `PATH` binary — in this environment a sibling checkout's, which the fixture is supposed to be independent of. `TC-COMMITLINT-020` row h (`FX-BAD-CONFIG` → `2`) inherits the same undeclared dependency and can satisfy its row via DM-1.g instead of DM-1.h.
   Suggested remediation target phase: test_planning
   Suggested fix: Declare the fixture's binary shape explicitly and split it if needed — `FX-BAD-CONFIG` with the local helper for the invalid-config half, plus `FX-BAD-CONFIG-NO-LOCAL` (no `node_modules` tree) for the execution-failure half — add both rows to the §6.2 "Binary availability per case" table, and make the shim self-evidencing (it writes a marker; step 6 asserts the marker exists **and** that no local `node_modules/.bin` was resolved) so the sub-case cannot pass vacuously. Mirror it with a one-line pin in the plan: the shim "is reached only through `PATH` **in a fixture with no local `node_modules/.bin`, asserted before the run**".

2. [minor] cross_artifact_consistency — `chg-GH-268-spec.md`#Appendix C row 9(c) and F-8 vs `chg-GH-268-test-plan.md`#`TC-DOC-003` step 6 vs `scripts/install.sh:123-130` (and `TC-DIST-001` steps 1–2)
   Gap: Row 9(c) requires the "Install inventory" blockquote to be completed "so each claim stays true", and `TC-DOC-003` step 6 says the blockquote "today names **exactly** `opencode-session.sh`, `deliver-ticket.sh`, `batch-deliver.sh`, `ceo-loop.sh`, `pm-liveness.sh`". That is what the blockquote says, but the array it describes has six entries: `scripts/lib/dispatch-authority.sh` is also registered and is installed to adopters (`scripts/install.sh:126`, copied at `:847-854`). Adding only the gate leaves the blockquote still under-inclusive, so the row's completeness goal is not reachable as written — and `TC-DOC-003` cannot catch it because its assertion is scoped to the gate. (Same page: the overview sentence at line 26 and the Core Components table at 180–191 also omit that entry; the batch guide's list is explicitly illustrative, so row 10 is unaffected.)
   Suggested remediation target phase: specification
   Suggested fix: Amend row 9(c)/F-8 to require that the reconciliation either enumerate every `ADOS_DELIVERY_SCRIPTS` entry, naming the pre-existing `scripts/lib/dispatch-authority.sh` omission as part of the fix, or marks the list illustrative and names `scripts/install.sh` as authoritative; drop "exactly" from `TC-DOC-003` step 6 and assert the enumeration against the array.

3. [minor] cross_artifact_consistency — `chg-GH-268-spec.md`#§8.3 DM-1 ("are decision-complete") vs `chg-GH-268-plan.yaml`#DELIVERY PINS "Terminal resolution order"
   Gap: DM-1 asserts the nine rows are decision-complete, but rows co-occur and the spec states no precedence: no configuration with an unresolvable base (DM-1.d vs DM-1.e), configured with an unresolvable base and no usable binary (e vs g), invalid configuration with an unresolvable base (e vs h), and an unknown-argument run in a repository with no configuration (i is pinned first by the plan only). The plan supplies the order (usage → configuration → base → merge-base → binary → lint), and that order is the only reason delivery is unambiguous. Consequence of the omission: under the plan's order a *no-configuration* repository with `--base no-such-ref` returns SKIP/exit 0, quietly narrowing AC-F3-2's unconditional "unresolvable base → unable-to-verify". Nothing blocks implementation today, but a spec-only reader could order the same rows differently and produce different exit codes for the same invocation.
   Suggested remediation target phase: specification
   Suggested fix: Add one sentence to F-3/DM-1 adopting the plan's precedence and stating that a repository with no commitlint configuration reports SKIP regardless of base or binary state, so the "decision-complete" claim is true on its own terms.

4. [minor] plan_coverage — `chg-GH-268-plan.yaml`#Phase 1 verification steps 5 and 10, `#Phase 3` verification step 4
   Gap: Three verification lines cannot fail, so they cannot carry the evidence their wording claims. `grep -oE 'exit [[:digit:]]+' scripts/lint-commit-range.sh | sort -u || the exit literals are exactly {0, 1, 2}` prints the observed set but never compares it (an `exit 3` would still "pass"). `git status --porcelain && git stash list || unchanged after every outcome` exits 0 on a dirty tree, so the fallback text never prints and a dirty or stashed tree looks compliant. Phase 3's `git status --porcelain || empty:` has the same defect. The real assertions exist in `TC-COMMITLINT-012` step 5 and `TC-COMMITLINT-018`, so no coverage is lost — this is evidence hygiene in the phase gate itself, the same class of defect iteration 1 flagged in the opposite direction (a check that could not pass rather than one that cannot fail).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Make them assert, e.g. `test "$(grep -oE 'exit [[:digit:]]+' scripts/lint-commit-range.sh | awk '{print $2}' | sort -u | tr '\n' ' ')" = "0 1 2 "` and `test -z "$(git status --porcelain)" && test -z "$(git stash list)"`.

5. [nit] cross_artifact_consistency — `chg-GH-268-test-plan.md`#§8.3 OQ-1
   Gap: OQ-1 is still recorded as open with owner `@plan-writer`, but the plan now pins exactly what it asked for: one `commitlint --color=false` invocation per commit over `git rev-list --reverse <merge-base>..HEAD`, offender iff exit 1 *and* a parsed `[rule-id]` line, exit ≥2 or unparsed exit 1 → DM-1.h. Stale bookkeeping of the same kind iteration 1 flagged for the cross-links (which was fixed); the binary half of OQ-2 was correctly marked resolved, so the table is now internally inconsistent.
   Suggested remediation target phase: test_planning
   Suggested fix: Mark OQ-1 resolved, citing the plan's pin (keep the delivery-planning owner note as the resolution), as was done for the binary half of OQ-2.

6. [nit] plan_coverage — `chg-GH-268-plan.yaml`#Phase 3 verification step 5 vs `chg-GH-268-test-plan.md`#`TC-PROMPT-004` step 4
   Gap: The plan's negative probe uses `git merge[[:space:]]+origin/[^[:space:]-]+[[:space:]]*$`, excluding hyphens, so a bare merge of a hyphenated branch (`git merge origin/feat-x`) would evade it; the test plan's version correctly uses `[^[:space:]]+`. The plan's probe is therefore weaker than the suite assertion it mirrors.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Use the test plan's character class so the two probes agree.

## Gate Result

NOT_READY. Delivery is blocked by one defect: after the binary-resolution contract was pinned, the fixture that carries AC-F3-5's execution-failure evidence was left without a declared binary origin, so the sub-case is vacuous or unsatisfiable depending on an unstated choice — and this change's stated purpose is to stop green gates that lie. Findings 2–6 are improvements and do not block: 2 is a completeness caveat on an otherwise correctly registered doc obligation, 3 records a precedence the plan already pins, 4 and 6 are evidence-hygiene defects in the plan's own verification lines with equivalent assertions present in the suite, and 5 is table bookkeeping.

Routing: reopen `test_planning` for findings 1 and 5 (finding 1 carries a one-line `delivery_planning` pin mirror); `specification` for findings 2 and 3; `delivery_planning` for findings 4 and 6. No human input is required, so no pause is set. Neither `doc/guides/definition-of-ready.md` nor the prompt DoR was amended by this review, and this review authored nothing but this record.
