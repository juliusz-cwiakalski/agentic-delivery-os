# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-301
Date: 2026-11-15
Pause Required: no

Reviewed artifact set: `chg-GH-301-spec.md` v1.0 (30 ACs, §17.1 DoD, Appendix A/B/C),
`chg-GH-301-test-plan.md` v1.0 (40 TCs), `chg-GH-301-plan.yaml` (7 phases),
`chg-GH-301-pm-notes.yaml`, ticket GH-301 / backlog M2-S8
(`doc/planning/oss-tooling/backlog.md:1160`), M2 scenario seeds
(`doc/planning/oss-tooling/milestones/m2/test-scenarios.md:121-139`), and repository truth
(`.ai/memory/**`, `packages/core/src/{contracts,domain}`, `packages/adapters/src/{file,io}`,
`scripts/checks/**`, `package.json`, `.github/workflows/ci.yml`, `tests/**`, `doc/templates/**`,
`doc/planning/concepts/memory-architecture.md`).

## Facet Summary
- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

Coverage accounting is complete: 30/30 ACs carry an owning plan phase, 40/40 TCs carry an
owning phase, and every ticket AC artifact (missing id/date/evidence; unbacked/uncovered index
rows; budget violations; concurrent creation) is mapped to at least one AC and TC. The defects
below are about *executability and truth*, not missing coverage.

## Findings

### Blocking

1. [critical] cross_artifact_consistency / plan_code_area_coverage — `chg-GH-301-plan.yaml` phase 2 (lines 401-456) vs `tests/structure/memory-bootstrap-templates.test.ts:258-287`
   Gap: TC-MEMDOCT-002 walks `scripts`, `tools` **and `packages`** and fails on any
   *file name* matching `/memory[-_](doctor|lint)|memoryDoctor|memoryLint/i`. Phase 2 creates
   `packages/core/src/domain/memory-lint.ts`, which matches. The guard replacement is declared
   only for phase 4 ("the old guard fails the moment `scripts/checks/memory-lint.ts` exists").
   Phase 2's own done-when ("`pnpm check`") therefore lands red, violating the plan's pinned
   "no phase lands a red tree" rule and the spec's tree-green framing rule (§17.1 rule 1).
   Evidence: verified scan set and pattern at `memory-bootstrap-templates.test.ts:271-282`;
   `memory-record.ts` and `memory-scan.ts` do not match — only the domain module name does.
   Suggested remediation target phase: delivery_planning
   Suggested fix: rename the pure module (e.g. `packages/core/src/domain/memory-evaluation.ts`)
   so the old guard stays green until phase 4, **or** split the replacement: a narrowed guard
   (sanctioning the new domain module) in phase 2 and the presence + gate-citation assertion in
   phase 4; state the chosen option in phase 2 and add the guard file to that phase's scope.

2. [critical] ac_quality / spec_completeness — `chg-GH-301-spec.md` §17 AC-F13-1 and §5.1 F-13
   Gap: AC-F13-1 requires "the merge reports zero conflicts" for two branches that each create
   a record **and append their own index row** to the single two-column index table (TC-MEMCONC-001
   steps 2-5). Two branches appending different rows at EOF of the same file conflict; verified
   empirically (`git init`, base index, branch A + row, branch B + row, `git merge` → conflict).
   F-13 simultaneously says "a creator … appends its own index row, so two distinct agents never
   touch one file", which is self-contradictory, and AC-F13-2 already accepts "union resolution"
   for the same rows. The ticket and seed SC-M2-S8-02 only claim conflict-free *record files*.
   Suggested remediation target phase: specification
   Suggested fix: scope AC-F13-1's zero-conflict assertion to record files and own entry points;
   move the index row to AC-F13-2's union-resolution clause; delete the "never touch one file"
   sentence.

3. [major] cross_artifact_consistency — `chg-GH-301-test-plan.md` TC-MEMCONC-001 (lines 1286-1322)
   Gap: steps 2-3 make each branch append its own index row to `.ai/memory/README.md` and steps
   4-5 assert both merges exit 0 with no unmerged paths. That is unachievable (see finding 2);
   the stated reason ("Record creation is conflict-free because each creator writes only new
   files") contradicts its own steps.
   Suggested remediation target phase: test_planning
   Suggested fix: keep the record files and own entry-point lines in the zero-conflict scenario,
   and assert both rows present after a scripted union resolution (mirroring TC-MEMCONC-002), or
   append rows to distinct sections and say why that models real writer behaviour.

4. [critical] spec_completeness / cross_artifact_consistency — `chg-GH-301-spec.md` AC-F6-1 vs §24 Appendix A `dating` row vs plan OQ-TP-2
   Gap: AC-F6-1 requires a record with **no** creation date to yield "one `memory.dating.*`
   error". Appendix A's closed dating register has `created-malformed`, `created-future`,
   `revalidate-missing`, `revalidate-malformed`, `entry-line-date`, `revalidate-expired` — no
   identity for an absent date. The plan resolves OQ-TP-2 to "`memory.schema.keys-missing`" and
   forbids ever reporting both. The AC, the register, and the resolved classification cannot all hold.
   Suggested remediation target phase: specification
   Suggested fix: amend AC-F6-1 and F-6 so an absent `created` is `memory.schema.keys-missing`
   (ticket intent "lint fails on a record missing date" still holds) and dating covers present but
   malformed/future values only; keep Appendix A closed as is.

5. [major] cross_artifact_consistency — `chg-GH-301-test-plan.md` TC-MEMDATE-001 (lines 779-809)
   Gap: step 1 asserts `created` absent → `memory.dating.created-malformed`, and step 2 then says
   "assert no `schema.keys-missing` finding for the absent-date case if `created` is required …
   whatever classification is chosen must be single-area" — an internally contradictory step that
   also contradicts the plan's OQ-TP-2 resolution to `memory.schema.keys-missing`.
   Suggested remediation target phase: test_planning
   Suggested fix: one row per classification, matching the resolved spec (finding 4), with no
   conditional branch in the step text.

6. [major] spec_completeness / system_spec_consistency — `chg-GH-301-spec.md` §2.1 bullet 6, GAP-9, §20, §21
   Gap: "No privacy guard scans `.ai/memory/**`" and "The memory tree … is currently outside every
   secret and private-literal scan" are false. `scripts/checks/privacy-literals.ts:119-132`
   enumerates `git ls-files --cached --others --exclude-standard`, i.e. every tracked file; all ten
   `.ai/memory/**` files are in that scan set (verified: `git ls-files .ai/memory` = 10 files, and
   `git ls-files -z … | grep -c '^.ai/memory/'` = 10). The guard is not scope-class based; the
   scope classes cited in §2.1 belong to the separate forbidden-literals guard.
   Suggested remediation target phase: specification
   Suggested fix: correct §2.1/GAP-9/§20/§21 to state that the privacy guard already scans the
   tree, and justify F-12 on memory-scoped identities, whole-tree uniformity, and the rendered
   finding contract rather than on "new coverage" (keep AC-F12 as written).

7. [major] cross_artifact_consistency / test_traceability — `chg-GH-301-test-plan.md` §6 fixture discipline vs TC-MEMSECRET-001/002; plan phase 3 scope
   Gap: "committed secret-shaped fixtures use clearly fabricated values **with the consented
   suppression markers**, so the repository privacy guard does not fail" makes TC-MEMSECRET-001's
   positive cases impossible: the memory lint reuses the same suppression classes (DEC-4), so a
   marker-carrying fixture is suppressed there too. Markerless fixtures, in turn, fail
   `privacy-literals` (the only allowlisted directory is `tests/fixtures/privacy-literals`;
   `tests/checks/fixture-privacy.test.ts` covers unrelated fixture dirs). The allowlist route is
   also undeclared: `scripts/checks/privacy-literals.registry.json` is in no phase scope.
   Suggested remediation target phase: test_planning
   Suggested fix: require fixture tokens assembled at runtime from non-matching fragments (so the
   privacy guard's source-text scan cannot match while the lint's injected text map does), or add
   `tests/fixtures/memory/secrets.ts` to the privacy registry allowlist with a reason and declare
   the registry file in phase 3 scope. Rewrite §6 accordingly.

8. [major] spec_completeness / ac_quality — `chg-GH-301-spec.md` NFR-1, AC-NFR1-1, F-4 vs AC-F6-1 and plan 4.2
   Gap: NFR-1/AC-NFR1-1 demand byte-identical output and that "the run … read no clock", and F-4
   says "no clock", yet AC-F6-1 requires future-date detection and plan 4.2 has "the edge supply
   today's date". A record dated tomorrow yields a finding today and none tomorrow, so repeated
   runs over an unchanged tree are not byte-identical across days, and the run does read a clock
   at the edge. TC-MEMNFR-001 silently narrows the claim to the domain module.
   Suggested remediation target phase: specification
   Suggested fix: define determinism as "byte-identical for a fixed date input"; state explicitly
   that the edge performs exactly one date read and injects it, and reword AC-NFR1-1/F-4 to match.

9. [major] spec_completeness — `chg-GH-301-spec.md` §5.1 F-14, DEC-12, AC-F14-1
   Gap: F-14 claims the replacement "keeps the boundary the old guard protected". The old guard
   also asserted that **no** memory-doctor/memory-lint component exists anywhere under `scripts/`,
   `tools`, `packages` (filename scan) and that `doctor.ts` carries no memory member. The
   replacement asserts a CLI command inventory with no memory subcommand, `DOCTOR_AREAS` = five,
   and unchanged error-table/domain kinds — none of which catches a stray
   `scripts/checks/memory-doctor.ts` or a second memory health component. The protective intent is
   narrowed, not preserved as claimed.
   Suggested remediation target phase: specification
   Suggested fix: keep one narrowed negative assertion — a filename scan over `scripts`, `tools`,
   `packages` whose only permitted matches are the sanctioned module set (`memory-lint.ts`, the
   pure evaluator, the scanner) — alongside the positive presence assertion.

10. [major] spec_completeness — `chg-GH-301-spec.md` DM-3 vs AC-F9-2 / Appendix A `index` row
    Gap: AC-F9-2 requires every retro note to have exactly one archive-index row and every archive
    row to be backed by a note, reported as `memory.index.*`. DM-3 declares retro notes "explicitly
    not covered", and the closed register offers only `record-uncovered`/`row-unbacked` (defined
    over the memory index's covered paths) plus `row-duplicate`/`row-malformed`/`hint-missing`.
    No identity can express "note uncovered by the archive index" without contradicting DM-3;
    TC-MEMINDEX-003 names such findings while leaving the rule ids unnamed.
    Suggested remediation target phase: specification
    Suggested fix: add the archive-index coverage universe to DM-3 and name its two rule ids in
    Appendix A (either archive-scoped ids, or state that `record-uncovered`/`row-unbacked` are
    evaluated twice over two declared universes with the universe in the detail).

11. [major] spec_completeness / system_spec_consistency — `chg-GH-301-spec.md` §5.1 F-2, DEC-5, DM-1
    Gap: "the concept document's richer keys survive as *optional* keys accepted and type-checked"
    is false for the concept model at `doc/planning/concepts/memory-architecture.md:85-118`:
    `valid_from` is absent from the closed optional set (only `invalid_from` is listed),
    `source` is a mapping `{type, ref}` while DM-1 requires a scalar channel, `evidence` is a list
    while DM-1 requires one shaped string, `rationale` is frontmatter in the concept but not an
    accepted key, and the concept writes `trust: agent_verified` rather than a T0-T5 token. A
    record copied from the concept produces `key-unknown`/`value-unknown`/`evidence-shape-unknown`.
    (Relatedly, §2.1's "T0-T5 … exist there and nowhere else" ignores the concept's own T0-T5 table.)
    Suggested remediation target phase: specification
    Suggested fix: in DM-1/§8.3 enumerate every concept key with its disposition
    (renamed to `created`, accepted-optional, or rejected-by-design) and state the two shape
    changes explicitly; correct the "nowhere else" claim.

12. [major] spec_completeness — `chg-GH-301-spec.md` §5.1 F-5, DM-1, Appendix A `statement-too-long`; `chg-GH-301-test-plan.md` §6
    Gap: the statement bound is a required, tested constant (`statement-too-long`; boundary table
    "bound−1/bound/bound+1") but no numeric value is published anywhere in the spec or README
    contract. A record author cannot know the limit, and the value would be invented at delivery.
    Suggested remediation target phase: specification
    Suggested fix: publish the numeric statement bound in DM-1/DM-5, state it in the memory index,
    and have TC-MEMSCHEMA-002 import it (already planned).

13. [major] plan_code_area_coverage — `chg-GH-301-plan.yaml` phase 1, obligation 1.6 / Inventory
    Gap: "confirm no `EXECUTABLE_ALLOWANCES` row is needed for a consts-only module" is wrong.
    `tests/structure/content-inventory.test.ts:2638-2699` treats any statement outside the
    types-only set as executable; without an allowance, every `export const` in
    `packages/core/src/contracts/memory-record.ts` is "executable statement VariableStatement is
    not permitted at scaffold". Every existing contracts module has such a row (e.g.
    `core/src/contracts/doctor.ts`, `core/src/contracts/capsule.ts`).
    Suggested remediation target phase: delivery_planning
    Suggested fix: state that the allowance row is required and must list every exported const
    name, and that the row pins the module's export surface (so the schema contract's export list
    is a declared design decision).

14. [major] plan_code_area_coverage / cross_artifact_consistency — `chg-GH-301-plan.yaml` phase 4 obligations vs `tests/structure/memory-bootstrap-templates.test.ts:235-255`
    Gap: phase 4 rewrites the manual-until-tooling sentence in
    `doc/templates/memory-doctor-checklist-template.md`, but TC-MEMDOCT-001 asserts that exact
    string verbatim ("manual until memory lint lands in the quality gates (GH-301)"). The phase
    obligations name only the guard block (lines 258-287). The file is in scope, but the commit
    set is incomplete as declared, and the plan's own "phase-4 atomic commit set" claim is
    therefore inaccurate.
    Suggested remediation target phase: delivery_planning
    Suggested fix: add "update TC-MEMDOCT-001's pinned manual-status string to the delivered
    automation-boundary wording" to phase 4's content/test obligations.

15. [minor] cross_artifact_consistency — `chg-GH-301-test-plan.md` §7 shared homes and TC-MEMGATE-004 step 5
    Gap: §7 lists `packages/core/src/contracts/capsule.ts` as a changed implementation home and
    marks `tests/checks/ci-wiring.test.ts` as "Existing–Update"; the plan instead tightens
    `source` in `packages/core/src/domain/capsule-candidates.ts` and declares neither
    `capsule.ts` nor `ci-wiring.test.ts` in any phase scope. Following the test plan literally
    requires two undeclared edits (which would surface as commit scope drift).
    Suggested remediation target phase: test_planning
    Suggested fix: drop `capsule.ts` and the `ci-wiring.test.ts` "update" row (that suite passes
    unchanged), or move the tightening to `capsule.ts` in the plan and scope it.

16. [minor] plan_code_area_coverage — `chg-GH-301-plan.yaml` phase 5, obligation 5.1
    Gap: the "do not move the guard lines pinned by mutants.ts (MUT-CAP-31..36, MUT-CAP-37/38)"
    list omits MUT-CAP-39/40/41, which pin `memory-promotion.ts` lines
    (`if (!underRoot(...))`, `if (fs.exists(target))`, the supersede replacement) — a file phase 5
    edits for the `tacit/` home-area fix.
    Suggested remediation target phase: delivery_planning
    Suggested fix: extend the pinned-guard line list to MUT-CAP-31..41.

17. [minor] spec_completeness — `chg-GH-301-spec.md` DM-1 optional set vs AC-F3-1 and `chg-GH-301-test-plan.md` TC-MEMWRITE-001 step 2
    Gap: DM-1 lists `basis` as optional; AC-F3-1 and TC-MEMWRITE-001 call it part of the required
    spine rendered by the writer. Promotion always rejects an empty `basis`
    (`capsule-candidates.ts:261-264`), so unconditional rendering is safe, but the contract text
    is contradictory and a hand-authored record may legitimately omit it.
    Suggested remediation target phase: specification
    Suggested fix: state "required in every promoted record, optional on a record; omitted when
    absent" (or move `basis` into the required spine) and align AC-F3-1/TC-MEMWRITE-001.

18. [minor] plan_code_area_coverage — `chg-GH-301-plan.yaml` phase 2/3 vs `.dependency-cruiser.cjs:17-21`
    Gap: the pure evaluator receives the privacy vocabulary "injected", but `matrix-core-importer`
    forbids `packages/core/**` importing `packages/adapters/**`, so the vocabulary *type* cannot
    come from `packages/adapters/src/io/privacy-rules.ts`. The plan does not state where the
    structural type lives, and TC plan §8.2's "add a read-only accessor" would not resolve it.
    Suggested remediation target phase: delivery_planning
    Suggested fix: state that a structural vocabulary type (recognizer classes + suppression
    markers) is declared in `packages/core/src/contracts/memory-record.ts` and the edge injects
    the adapter's data.

19. [minor] cross_artifact_consistency — `chg-GH-301-test-plan.md` TC-MEMWRITE-003 precondition; TC-MEMLAY-002 step 4
    Gap: TC-MEMWRITE-003 says the curator skill "is reconciled in the write-path phase" (plan
    phase 5) while the plan puts `SKILL.md` in phase 6. TC-MEMLAY-002 step 4 refers to "the
    register's wrong-target identity", an identity that does not exist in the closed register.
    Suggested remediation target phase: test_planning
    Suggested fix: name plan phase 6, and name `memory.index.row-malformed` (or add the identity).

20. [nit] decision_capture — change docs vs `doc/decisions/**`
    Gap: the canonical record schema plus its precedence rule (DM-1) is a system-level contract
    consumed by the curator skill, bootstrap templates, and the future M3 command family and
    compiler. It is captured only as change-local DEC-5/DEC-8.
    Suggested remediation target phase: specification (escalate to PM → `@decision-advisor`)
    Suggested fix: propose one TDR/ADR recording the canonical record schema and the one-way
    reconciliation direction (no change to the change's scope).

### Verified and accepted (no finding)

- Tree facts: `.ai/memory/README.md` = 172 lines; four entry points 12-39 lines; three lesson
  records; `tacit/` holds only `.gitkeep`; `preferences/`, `guilds/`, `retro/` absent.
- Reader/writer truth, including the `tacits/` defect: `capsule-candidates.ts` writes
  `` `${candidate.class}s/${fileName}` `` → `tacits/`; `memory-promotion.ts` reads and supersedes
  the same interpolated directory; no test currently exercises a tacit home write, so the defect
  is latent and its characterisation in the spec/plan is correct (a tacit record would land
  outside the coverage universe and produce `memory.index.row-unbacked`). Phase 5 correctly
  scopes both sides.
- Schema reconciliation direction is executable for the three delivered records: they carry
  `source: "merged_pr"` (a declared channel), `merged-pr:` is a declared evidence prefix, and the
  count (three) is right; statements/statuses/id/body stay untouched.
- Gate wiring facts: `package.json` aggregate string today is `lint → format:check → typecheck →
  test → check:boundaries → prompt-conformance → help-guide-coverage → exports-parity`; exactly
  three suites pin the literal (`tests/checks/ci-checks.test.ts:647-649`,
  `tests/checks/license-ci-binding.test.ts:22`, `tests/checks/privacy-ci-wiring.test.ts:28`);
  `scripts/checks/script-surface.ts:26-46` only enforces the five named checks' relative order, so
  inserting `check:memory` after `check:boundaries` needs no edit there; `ci-topology.ts:327-337`
  requires every `scripts/checks/*.ts` name to appear in package.json or CI, satisfied by phase 4;
  `ci.yml` `ts-invariants` is the correct step.
- Doctor boundary: `DOCTOR_AREAS = ["repo","tracker","provider","state","ci"]`
  (`packages/core/src/contracts/doctor.ts:19`), no memory member; CLI unchanged.
- Privacy vocabulary: exactly seven recognizer classes (six `secret.*` + `private.absolute-user-path`)
  and three suppression classes, matching Appendix A and the "six plus the private-literal class" count.
- Documentation conformance: `doc/templates/README.md:123` still repeats the manual wording (phase 4
  covers it); `memory-doctor-checklist-template.md` keeps `ados_distribution: redistributable`;
  TC-MEMSCAF-002 forbids `preferences`/`retro archive`/`retro-archive` in all nine templates (phase
  4 respects it); the forbidden-literals registry requires only docs absent at `corpusBaseline`,
  so the one new doc (`feature-memory-lint.md`) must be registered in lifecycle phase 7 as declared.
- Phase scope completeness for **new** files: every new file each phase creates is inside that
  phase's declared `files`/`folders` (phase 1's change-folder declaration also keeps the plan,
  test plan, and pm-notes committable). Tracked-file edits outside a phase's scope are staged with
  disclosed scope drift (`commit-staging.ts:52-66`), so findings 1/14/15 are red-boundary and
  review-scope defects, not silent staging failures.
- DoD: §17.1 provides 19 binding conditions with verification method and owning capability phase;
  the "Proven in plan" labels are capability names rather than phase ids but map unambiguously.

## Reopening

Reopen `specification` first (findings 2, 4, 6, 8, 9, 10, 11, 12, 17, 20), then `test_planning`
(3, 5, 7, 15, 19) and `delivery_planning` (1, 13, 14, 16, 18). No finding reopens `delivery`.
Re-run this gate after the revisions; the defects are independent, so iterations 2-3 should converge.
