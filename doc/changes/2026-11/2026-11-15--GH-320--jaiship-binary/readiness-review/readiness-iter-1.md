# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-320
Date: 2026-11-15
Pause Required: yes

Reviewed artifact set: `chg-GH-320-spec.md` (v1.1), `chg-GH-320-test-plan.md` (v1.1),
`chg-GH-320-plan.yaml` (revision 1.0, 5 phases, 41 declared files),
`chg-GH-320-pm-notes.yaml`, GitHub issue 320 (verbatim AC1–AC6), and the current
truth in `doc/spec/features/feature-cli-entrypoint.md`, `feature-branding-seam.md`,
`feature-config-layer.md`, `feature-projects.md`, plus the delivered code and
suites the artifacts cite. Prior readiness records: none (this is iteration 1).
Claims were verified against the repository where cheap; the verification command
or file is named per finding.

## Facet Summary
- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: FAIL
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: FAIL
- dod_defined: PASS

Blocking findings: 5 (2 need human input). Major findings: 8. Minor findings: 10.

## Findings

### Blocking

1. [critical] test_traceability / spec_completeness / ac_quality — `chg-GH-320-spec.md`
   AC-F3-4, §5.1 F-3, §6 Flow 2; `chg-GH-320-test-plan.md` TC-BIN-020 (step 5),
   TC-BIN-040 (steps 1–2), TC-BIN-041, TC-BIN-042, TC-BIN-045; `chg-GH-320-plan.yaml`
   Phase 2 obligation 2.6.
   Gap: The ticket's AC4 config half and the test plan's central notice case both
   require `jaiship status --json` to read `.delivery-os/config.yaml` (and to emit
   `prior-identity-fallback: config-read`). `status` today acquires **no** project
   configuration: `statusComposition()` wires `noChain()` (empty provider config) and
   never calls `acquireFileConfig`; the only acquisition sites in production are the
   `daemon`, `dispatch`, and `coordinator` paths
   (`packages/cli/src/production.ts:848,1811,1981,2081,2701` and
   `createConfigProgram` at `packages/cli/src/edge.ts:3361`), and the `config`
   command is not prompt-required (it is dropped by
   `selectPromptRequiredProgram`). Verified:
   `DELIVERY_OS_CONFIG=/tmp/does-not-exist.yaml bun packages/cli/bin/delivery-os.ts
   status --json` exits `0` with no config read, while the same env on any composed
   config-consuming surface is the only place a project file can be read. The
   consequence is that AC-F3-4's conditional ("when `jaiship status --json` resolves
   configuration") is vacuous, the `config-read`/`config-skipped` notice cannot appear
   on `status`, and TC-BIN-020/040/041/042/045 as written cannot pass. The ticket's
   AC4 is therefore not delivered for the configuration half.
   Suggested remediation target phase: specification
   Suggested fix: Decide and record one of — (a) `status --json` gains a project
   configuration acquisition (then declare the resulting observable change for
   **both** bins, which collides with §4.1/§8.5 — see finding 2 — and extend
   AC-F2-3), or (b) re-scope AC-F3-4 and every affected TC to a configuration-consuming
   command (`jaiship daemon …` / `dispatch …` / `coordinator …`), keep `status --json`
   for the state half, and record the explicit deviation from ticket AC4 wording with
   owner approval. Test planning must follow the chosen observable. This is a
   product/scope decision: escalate.

2. [critical] cross_artifact_consistency / ac_quality / system_spec_consistency —
   `chg-GH-320-spec.md` AC-F2-7, §2.1, §4.1 success metric "delivery-os observable
   behaviour change: 0", §5.1 F-2, §8.5 first bullet, DEC-11;
   `chg-GH-320-test-plan.md` TC-BIN-012 and §8.2 assumption; `chg-GH-320-plan.yaml`
   Phase 2 OQ-TP-2 pin.
   Gap: The artifacts both require and forbid a change to the compatibility alias on
   the invalid-override configuration path. AC-F2-7 (with TC-BIN-012 and the plan's
   OQ-TP-2 pin) requires the classified resolver-input error (`field: "override"`,
   closed code, never `fallback.internal`) for **both** bins. §4.1 says the alias's
   observable behaviour change is 0 and §8.5 says "the compatibility alias is
   behaviourally unchanged"; §2.1 and DEC-11 additionally assert the configuration
   path "continues to fail closed with the resolver's classified input error", which
   is not the delivered behaviour. Verified:
   `DELIVERY_OS_WORKING_NAME='bad/name' bun packages/cli/bin/delivery-os.ts status
   --json` exits `2` with `code: "fallback.internal"` and a misleading summary
   (`createConfigProgram` returns the classified error, `production.ts:3031` throws,
   and `runEntrypoint` converts the throw to containment). So one of the two
   statements must be wrong before delivery starts.
   Suggested remediation target phase: specification
   Suggested fix: Amend the spec to either (a) declare the alias's error-projection
   change as intentional (rewrite §2.1, §4.1, §8.5 and AC-F2-3 to scope the byte
   identity to `--version`/`--help` **and** to admit the classified projection), or
   (b) keep the alias's containment behaviour and scope AC-F2-7 / TC-BIN-012 to the
   new bin. Record the decision; it changes a delivered observable and needs owner
   acceptance.

3. [critical] plan_code_area_coverage / plan_coverage — `chg-GH-320-plan.yaml`
   Phase 1 (goal, obligation 1.5, gate) and Phase 2 scope.
   Gap: Phase 1 is not green at its own boundary. Removing the entrypoint's neutral
   default makes the invoking bin's declared default the only identity floor, and the
   plan explicitly requires "a missing declared default is the delivered containment
   identity" (matching TC-BIN-062 step 5). Two delivered suites call `runEntrypoint`
   with no name source at all and assert the neutral identity:
   `tests/behaviour/entrypoint-help-isolation.test.ts:33` (asserts `delivery-os` and
   exit 0, with a comment "render the neutral default") and
   `tests/conformance/pilot/pilot-isolation.test.ts:109` (asserts `delivery-os` and
   `0.0.0`). The first is declared only in Phase 2 but is run **as a control in the
   Phase 1 gate** (plan gate line: `bun test … entrypoint-help-isolation.test.ts`);
   the second is declared in no phase at all (`pnpm test` / Phase 5 `pnpm check`).
   `tests/structure/cli-edge-seam.test.ts:302` calls `resolveEntrypointBrand` without
   a default too, but passes a configured name, so it survives only under an
   optional-parameter design — a design detail the plan does not pin.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Put `tests/behaviour/entrypoint-help-isolation.test.ts` in Phase 1
   scope (or split its name injection into Phase 1 and its new matrix into Phase 2),
   declare `tests/conformance/pilot/pilot-isolation.test.ts` as a delivered suite this
   change must update, and state in Phase 1 whether the new selector input is an
   optional property with required semantics or a required property (and therefore
   which call sites are affected).

4. [critical] plan_code_area_coverage / test_traceability — `chg-GH-320-plan.yaml`
   Phase 3 (test 3.2) and `chg-GH-320-test-plan.md` TC-BIN-050/051/052/053/055;
   `.github/workflows/ci.yml` (not declared).
   Gap: The new suite `scripts/.tests/test-install-jaiship-launcher.sh` will be
   auto-discovered by the CI `bash-tests` job (`scripts/run-bash-suites.sh` finds
   every `.tests/test-*.sh`; `.github/workflows/ci.yml:118–146`), but that job installs
   only `jq` and **no Bun** (every Bun setup is per-job in the `ts-*` jobs). The
   planned suite must execute `bun …/packages/cli/bin/jaiship.ts --print-install-path`
   (launcher path authority, DEC-12) and then run the installed launcher, both of
   which need Bun. As declared, the PR's CI cannot be green, and the only fixes
   require an undeclared file (`.github/workflows/ci.yml`, or relocating the case into
   the `ts-test` job) or a skip (which the test plan forbids).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Declare the CI change as plan scope and spec impact-map entries
   (add `oven-sh/setup-bun` to the `bash-tests` job or gate this one suite behind a
   Bun check that fails, never skips), OR implement the installer case inside the
   Bun-bearing TS test job. Add the new bash file to the Phase 3 shellcheck gate
   (`severity: error` is the CI job's threshold).

5. [critical] spec_completeness / system_spec_consistency / test_traceability —
   `chg-GH-320-spec.md` §4.1 metric ("Exactly 4 declared sites … 0 elsewhere"),
   DM-6, AC-F7-10, NFR-6; `chg-GH-320-test-plan.md` LIT-TP-1 and TC-BIN-062
   (precondition: "an AST scan over `packages/**` … collecting string literals equal
   to a working name").
   Gap: The declared four-site inventory is not the complete set under the stated
   scan rule. `packages/core/src/branding/index.ts:63` declares
   `const SCOPE_ORG = "delivery-os"` — a committed literal byte-identical to a working
   name inside the scan root. A `packages/**` literal scan therefore finds five sites,
   not four, and the guard either fails on the live tree or needs an undeclared
   exemption. DM-6's "and nowhere else" is false as written. (The delivered
   `tests/structure/branding-seam.test.ts:validateSeam` already scans `packages/**`,
   including `bin/**`, and permits non-exported constants but forbids field-named
   literals — so the two selector literals per bin are feasible, but the resolver's
   scope-org constant is not accounted for.)
   Suggested remediation target phase: specification
   Suggested fix: Declare the scan rule precisely in DM-6/AC-F7-10/NFR-6 — either the
   resolver is the declared derivation point and is excluded by name (stating why
   `SCOPE_ORG` is a scope literal, not an identity value), or the inventory becomes
   five declared sites. Make TC-BIN-062 assert the declared rule, not a bare count.

### Major

6. [major] cross_artifact_consistency / plan_code_area_coverage —
   `chg-GH-320-spec.md` §16 "File impact map" vs `chg-GH-320-plan.yaml` 41 declared
   files.
   Gap: Eight declared plan files are absent from the spec map:
   `tests/behaviour/entrypoint-two-bins.test.ts`,
   `tests/behaviour/identity-override.test.ts`,
   `tests/behaviour/daemon-start-detached.test.ts`,
   `tests/structure/state-scope.test.ts`,
   `tests/checks/identity-docs.test.ts`,
   `tests/checks/prior-identity-hermetic.test.ts`,
   `tests/fixtures/entrypoint/alias-baseline.json`,
   `.changeset/gh-320-jaiship-binary-minor.md`; and the map's single
   `tests/behaviour/prior-identity-fallback.test.ts` is replaced by three files (the
   plan records this as R-B). The pm-notes justify the changeset as release
   bookkeeping, but the spec's own impact map was not reconciled.
   Suggested remediation target phase: specification
   Suggested fix: Update §16 to the delivered file set (or explicitly mark the
   test files as the test plan's homes and the changeset as release bookkeeping), so
   spec and plan describe one blast radius.

7. [major] decision_capture — `chg-GH-320-spec.md` DEC-5 (the seam's committed-literal
   rule becomes "declared selectors, bounded and non-exported"), DEC-9 (prior-root
   selection inside the one host-root policy), DEC-10 (new notice classification).
   Gap: DEC-5 changes a system-wide invariant documented in
   `doc/spec/features/feature-branding-seam.md` ("no working-name literal is
   committed"), and DEC-9 modifies the rule recorded in
   `doc/decisions/TDR-0022-multi-repository-workstation-state-scope.md` (single
   host-root rule). Both are precedent-setting and are captured only in the change
   spec; nothing in the plan or spec states whether a decision record is required or
   why the existing records suffice.
   Suggested remediation target phase: specification
   Suggested fix: Route through `@decision-advisor`: either amend TDR-0022 and record
   the selector rule as a new TDR/decision record (then declare the
   `doc/decisions/**` file in the plan's scope), or record in the spec why DEC-5/DEC-9
   are change-local interpretations of the existing records.

8. [major] system_spec_consistency / spec_completeness / plan_doc_update_coverage —
   `chg-GH-320-spec.md` F-6, F-8, NFR-8, §8.5 "Declared divergences", §22; guide
   obligation 4.2; `chg-GH-320-test-plan.md` TC-BIN-072 step 5
   ("0 undocumented identity paths"); `scripts/install.sh:39–41,173–175`.
   Gap: (a) The installer's own pre-freeze identity surface is undeclared: `ADOS_HOME`
   defaults to `~/.ados`, `ADOS_REPO_DIR` to `~/.ados/repo`, plus `ADOS_SOURCE_DIR`,
   `ADOS_RAW_URL`, and `ADOS_REPO_URL`. NFR-8 and TC-BIN-072 claim every remaining
   pre-freeze consumer is stated in the specification, the guide, and the change
   record. (b) The launcher step makes `install.sh --local` require the Bun runtime at
   install time (it must invoke `--print-install-path`); today local mode needs only
   bash/git/diff/cp/mkdir, and no failure/skip mode is declared. (c) The step's
   behaviour when the resolved source tree carries no CLI entry (`ADOS_SOURCE_DIR`
   pointing at a docs-only tree), its `DRY_RUN` handling, and its `--tool` semantics
   are unspecified. (d) `doc/spec/features/feature-doc-distribution-marker.md`
   documents `scripts/install.sh`'s install set and is not in the update list.
   Suggested remediation target phase: specification
   Suggested fix: Declare the installer's `~/.ados`/`ADOS_*` surfaces as a fourth
   divergence in §8.5, §22 and the guide; declare the Bun install-time requirement and
   its classified behaviour (including a no-CLI source and `DRY_RUN`); add
   `feature-doc-distribution-marker.md` to the Phase 4 doc set.

9. [major] plan_coverage / cross_artifact_consistency — `chg-GH-320-plan.yaml`
   Phase 5 gate and §6/TC-BIN-080; `chg-GH-313-pm-notes.yaml` (2026-11-14 risk note).
   Gap: The declared second gate command is not executable — it contains the
   placeholder `TMPDIR="$(mktemp -d "<same-device-parent>/ados-check-XXXXXX")" pnpm
   check`. The first declared command `TMPDIR=$PWD/tmp/tmpdir pnpm check` is the one
   GH-313 recorded as **red** (`queue-production-binding`,
   `projects-config` need a temp dir outside every worktree; `ci-baseline-parity`
   needs a same-device dir). Running a known-red invocation as a Phase 5 gate means
   the phase is not "green at its boundary" by its own gate list, and the concrete
   working command is not written down. Recording both invocations is honest; making
   a red one a gate is not.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Name the concrete same-device parent (e.g. the worktree's parent or
   `$HOME`) and make only the working invocation a gate; keep the repo-local
   invocation as recorded evidence with the GH-313 mechanism, as TC-BIN-080 already
   describes.

10. [major] test_traceability — `chg-GH-320-test-plan.md` TC-BIN-084 (step 1).
    Gap: "Run the plan's new behaviour and structure suites under the armed counters"
    is not implementable with the delivered pattern. `tests/checks/daemon-hermetic.test.ts`
    arms in-process guards (`globalThis.fetch`, injected clocks) around code the test
    itself imports; it cannot arm counters around *other* bun suites in-process.
    Running separate suites needs a `bun test --preload` harness or spawned
    subprocesses, and `pnpm check` does not invoke such a wrapper. As written the case
    will either be narrowed silently at delivery or fail.
    Suggested remediation target phase: test_planning
    Suggested fix: Define the mechanism (a preload module that installs the counters
    for a named suite list executed as subprocesses, or a static-scan plus in-process
    armed-cell combination) and state what is proven by each half.

11. [major] test_traceability — `chg-GH-320-test-plan.md` TC-BIN-055 steps 3 and 6.
    Gap: The case asserts "`~/.jaiship` still absent on the deliverer's workstation".
    On this machine `~/.jaiship/bin` already exists, and §8.2 itself says "no case
    depends on [operator-workstation facts]". A permanent suite that asserts
    non-existence of a real-home path is both non-hermetic and false here.
    Suggested remediation target phase: test_planning
    Suggested fix: Assert "unchanged (existence and mtime)" only, and drop the
    parenthetical absence claim.

12. [major] cross_artifact_consistency — `chg-GH-320-test-plan.md` TC-BIN-070
    precondition and §7 row, §6 "Fixture checkouts … each with a real `.git`
    directory", §2 row for the plan ("authored in phase 4 … and absent at authoring
    time").
    Gap: The test plan still names `doc/documentation-handbook.md` §16.1.1 as the
    phrase-table home (the plan's R-A proves the table lives in the historical GH-242
    spec and that `tests/checks/doc-conformance.test.ts` pins an exact page set), still
    requires committed fixtures with a nested `.git` (the plan's R-G proves this is
    impossible), and still says the plan is absent. The reconciliations exist only in
    the plan, which the test plan calls the "verification map".
    Suggested remediation target phase: test_planning
    Suggested fix: Carry R-A/R-B/R-C/R-D/R-E/R-F/R-G into the test plan (or state that
    the plan is authoritative for each and mark the affected rows), and drop the stale
    "absent at authoring time" sentence.

13. [major] cross_artifact_consistency — `chg-GH-320-test-plan.md` TC-BIN-063 step 5
    vs `chg-GH-320-plan.yaml` Phase 1 obligation 1.4.
    Gap: The test plan requires "the two bins' only differences are the declared
    selector facts … and the optional prior argument", while the plan keeps the
    `completion` export on `bin/delivery-os.ts` and the content-inventory allowance
    still lists it. If `bin/jaiship.ts` does not export `completion`, the structural
    diff has a second difference; if it does, the inventory must allow it and the
    file still differs by the selector facts only — but the plan does not say which.
    Suggested remediation target phase: test_planning
    Suggested fix: Pin the exact allowed difference set (completion export presence on
    each bin) in both artifacts.

### Minor

14. [minor] spec_completeness — `chg-GH-320-spec.md` §8.1 and F-6:
    `--print-install-path` is a new, documented public CLI token outside the ticket's
    stated scope; the spec calls it "not a global flag" while the implementation must
    intercept it as a root-level option, and it is deliberately absent from `--help`
    even though the guide documents it. DEC-12/OQ-TP-5 justify it, but the
    discoverability contradiction and the added interface should be stated outright.
    Suggested remediation target phase: specification.

15. [minor] spec_completeness — ticket AC4 says "a classified one-time warning"; the
    spec delivers at most one line **per source kind** (so two lines on a
    moved-in workstation). The interpretation is defensible (§8.3) but should be
    recorded as a deliberate reading of the ticket wording.
    Suggested remediation target phase: specification.

16. [minor] test_traceability — "once per source kind per process" has no declared
    owner seam. The delivered legacy adapter's once-per-process flag lives in a
    per-composition closure, not a process global; TC-BIN-041 mixes "same composed
    program twice" with "a second process". Declare where the notice state lives so
    in-process cases are order-independent and the suppression is provable.
    Suggested remediation target phase: specification (with test_planning).

17. [minor] test_traceability — TC-BIN-006 step 3 makes the ambient
    `DELIVERY_OS_WORKING_NAME` govern `--print-install-path`, so an operator whose
    shell carries the override would install to `~/.acme/bin/acme`, not
    `~/.jaiship/bin/jaiship`, contradicting ticket AC6 in that environment. Declare
    whether the installer scrubs the override or records the override-derived path.
    Suggested remediation target phase: specification (with test_planning).

18. [minor] system_spec_consistency — F-4 says the existence facts arrive from
    "adapter-tier probes", but the only composition site is
    `packages/cli/src/production.ts` (CLI tier), which already probes with
    `existsSync`. Align the wording with the delivered layering.
    Suggested remediation target phase: specification.

19. [minor] plan_code_area_coverage — `createProductionDependencies`
    (`packages/cli/src/edge.ts:1487`) resolves its own state directory through
    `resolveProjectScope`/`resolveHostStateRoot` without prior-identity facts. It is
    test-only today, but if it ever joins the production path it would create
    `~/.jaiship-state` during a fallback invocation, violating the "one root for the
    whole invocation" guarantee. Declare it out of scope or thread the fallback.
    Suggested remediation target phase: delivery_planning.

20. [minor] plan_code_area_coverage — Phase 2 obligation 2.5 says "every acquisition
    site", but does not enumerate them; the real set is
    `production.ts:848,1811,1981,2081,2701` plus `edge.ts` `createConfigProgram`.
    Enumerate them so the plan's claim is checkable by `plan diff`.
    Suggested remediation target phase: delivery_planning.

21. [minor] plan_doc_update_coverage — the new guide is not linked from
    `doc/00-index.md` (R-D). Every existing redistributable guide is listed there;
    the guide is user-facing and the index is a distributable document. Either add
    the row (and declare `doc/00-index.md` in scope) or state in the guide/plan why
    the landing page is intentionally untouched.
    Suggested remediation target phase: delivery_planning.

22. [minor] test_traceability — TC-BIN-053 step 4 requires proving stdin passthrough
    "a command that reads stdin, or a byte-for-byte pipe check"; no composed command
    reads stdin, and a pipe check proves nothing about the launcher. Define the
    observable or drop the cell.
    Suggested remediation target phase: test_planning.

23. [minor] test_traceability — the plan's Phase 3 gate omits shellcheck, while CI's
    `shellcheck` job (`severity: error`) will lint the new suite. Add
    `shellcheck scripts/.tests/test-install-jaiship-launcher.sh` to the phase gate.
    Suggested remediation target phase: delivery_planning.

## Notes (non-findings, verified good)

- The two binaries can share one composition: `bin/delivery-os.ts` already reads
  env/cwd/home and delegates; nothing else under `packages/**` imports
  `runEntrypoint` or the neutral accessor, so the retirement is contained.
- `installPath` is `~/` + dotDir + `/bin/` + sanitize
  (`packages/core/src/branding/index.ts` derivation table), so
  `~/.jaiship/bin/jaiship` is the resolver's value, as the spec states.
- The delivered `test-install.sh` calls `install_local_files` directly (never
  `do_local_install`), so putting the launcher step in `do_local_install` does not
  break that control — provided finding 4 is resolved.
- `tests/structure/branding-seam.test.ts`'s `validateSeam` scans `packages/**`
  including `bin/**`, permits non-exported string constants, and forbids
  field-named literals; the selector literals are feasible under variable names that
  are not `BrandIdentity` field names.
- The child-environment allowlist regex
  (`^(PATH|HOME|USERPROFILE|DELIVERY_OS_WORKING_NAME|[A-Z0-9_]*_STATE_DIR)$`,
  `tests/behaviour/daemon-start-detached.test.ts:618`) does admit both identities'
  keys, as §8.5 and TC-BIN-083 claim.
- The changelog/changeset convention is real (`.changeset/gh-294-…-minor.md`
  precedent) and the Phase 5 gate `scripts/checks/changesets-group.ts` exists.

## Next

Reopen `specification` for findings 1, 2, 5, 7, 8 (and the spec-side halves of 14–18),
`test_planning` for findings 10–13 and 22, and `delivery_planning` for findings 3, 4,
9, 19, 20, 21, 23. Findings 1 and 2 are recorded as `needs_human_input`: the owner
must choose the ticket-AC4 interpretation and whether the compatibility alias's
error projection may change. Do not start delivery until this gate returns `READY`.
