# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-288
Date: 2026-11-11
Pause Required: no

Reviewed: `chg-GH-288-spec.md` v1.2 (38 ACs, DEC-1..DEC-19, §15.1, §16.1),
`chg-GH-288-test-plan.md` v3 (42 TCs, §3.1 matrix, §5 scenarios, §7 mapping, §8.3),
`chg-GH-288-plan.yaml` revision 2.0 (6 phases; `plan validate` → `valid`,
`readyForDevelopment: true`; `lint plan` → `valid` — both re-run for this review),
`chg-GH-288-pm-notes.yaml`, and `readiness-review/readiness-iter-1.md`.

Source evidence re-derived for this iteration (not re-read from the artifacts):
`.dependency-cruiser.cjs` tiers; `packages/core/src/config/catalog.ts`;
`packages/core/src/{index,config/index,app/index}.ts`; `packages/cli/src/{edge,production,entrypoint}.ts`
and `packages/cli/package.json` `workspaceImports`; `packages/cli/src/help/prompt-required-commands.ts`;
`packages/adapters/src/repo/index.ts`; `scripts/checks/{help-guide-coverage,error-table-sync,forbidden-literals,exports-parity}.ts`;
`scripts/checks/forbidden-literals.registry.json`; `scripts/.tests/test-doc-distribution.sh`;
`scripts/install.sh` guide install path; `tests/checks/{reference-page-parity,help-guide-coverage,forbidden-literals,privacy-release,error-table-sync}.test.ts`;
`tests/behaviour/{entrypoint-composition,entrypoint-help}.test.ts`; `package.json` scripts; `doc/decisions/**`.

## Verdict in one line

All twelve iteration-1 blockers are substantively closed and the mapping arithmetic is exact
(38 ACs, 42 TCs, each owned once). Three **plan-scope** defects remain, each of which makes a phase
boundary red or forces an edit outside declared scope. They are mechanical (six lines), but they are
gate breakers, not style findings.

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS (two minor wording defects, F3/F4, not blocking)
- plan_coverage: PASS (38/38 ACs and 42/42 TCs owned exactly once; verified by parsing the ownership block)
- test_traceability: PASS (38 §3.1 rows for 38 ACs; every TC names an AC or a declared cross-cutting NFR)
- cross_artifact_consistency: FAIL (B13's final-tree registry delta; F1, F2)
- decision_capture: PASS (DEC-1..19 in spec, TDR-0022 scoped; F2 is a wording conflict only)
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS (§16.1 and phase 6 cover the system-spec set, with additive pages; F5 is minor)
- plan_code_area_coverage: FAIL (B13, B14, B15)
- dod_defined: PASS

## Blocking findings

### B13. **[critical] plan_code_area_coverage / cross_artifact_consistency — plan phase 6 `scope.files`;
test-plan TC-PROJ-028 `Expected Outcome` and §7 "Gate battery"; plan phase 5 `Done when`; spec §16.1 row for `doc/guides/`**

Gap: phase 6 creates a **second** new user-facing document, `doc/spec/features/feature-projects.md`,
and no phase owns its forbidden-literals registration. `scripts/checks/forbidden-literals.ts` scans the
`userFacingDocs` class rooted at `doc` with `excludedPrefixes: ["doc/changes/", "doc/decisions/"]`
(verified in `scripts/checks/forbidden-literals.registry.json`), enumerates present files through
`listRepoFiles` (tracked **plus untracked-not-ignored**, so a newly authored page counts), and fails with
`unregistered user-facing doc absent at corpusBaseline: <path>` for any present doc that is neither in
the baseline tree nor in `registered` (verified at `scripts/checks/forbidden-literals.ts` lines 415-431).
`tests/checks/forbidden-literals.test.ts` asserts `scan(ROOT).failures` equals `[]` (line 43), so
`bun test` — and therefore `pnpm check` (`package.json`: `test` runs `bun test`) — reds the moment
phase 6 writes that page. I verified that `doc/spec/features/feature-projects.md` exists neither in the
working tree nor at `corpusBaseline` (`git ls-tree -r 32784aff… -- doc/spec/features`), so it is exactly
the unregistered-new-doc case.

Consequences at the boundary: phase 6's `Done when` ("the release, doc-distribution and literal gates
are green") is unsatisfiable inside the declared scope, and the only fix is an edit to
`scripts/checks/forbidden-literals.registry.json`, which phase 6 does not scope while phase 5's
`Done when` simultaneously requires "the registry diff is exactly one addition". TC-PROJ-028
(`Expected Outcome`: "The registry diff shows exactly one addition (the migration note)") is therefore
true at phase 5's boundary and false at the final tree, and phase 6 re-runs earlier owning TCs.

Suggested remediation target phase: delivery_planning
Suggested fix (exact):
1. Add `scripts/checks/forbidden-literals.registry.json` to phase 6 `scope.files`.
2. Reword phase 5 `Done when` and TC-PROJ-028 to "exactly one addition at this boundary (the migration
   note); the `feature-projects` page adds the second row in the reconciliation phase".
3. Add one line to §16.1's `doc/guides/` row: every new document under the scanned `doc/` roots is
   registered in the same phase that adds it — the guide here, the new feature page in phase 6.

### B14. **[critical] plan_code_area_coverage — plan phase 3 `scope.files`; test-plan TC-PROJ-030
`Target Layer / Location`; verified in `packages/cli/src/edge.ts`, `packages/cli/src/production.ts`,
`packages/cli/src/entrypoint.ts`, `tests/behaviour/entrypoint-composition.test.ts`**

Gap: phase 3 is the indivisible mount unit, but two files the unit cannot exist without are undeclared.

(a) **The command definition is composed in `packages/cli/src/edge.ts`, not in `production.ts`.**
`createConfigProgram` (edge.ts:3076) owns the closed option object `ConfigProgramOptions` (edge.ts:2966),
builds `const commands: Record<string, CommandDefinition> = {...}` (edge.ts:3172), adds each family with an
explicit `if (options.x !== undefined) commands.x = ...` block, and returns `program: { commands }`
(edge.ts:3585). `production.ts` only calls `createConfigProgram(configured)` (production.ts:1561) and
passes options. `entrypoint.ts:134-150` (`selectPromptRequiredProgram`) **throws**
`prompt-required command "projects" is not composed` for any name in `PROMPT_REQUIRED_COMMANDS` that the
program lacks. Phase 3 changes `help/prompt-required-commands.ts` (in scope) and `production.ts`
(in scope) but not `edge.ts`, so the built entrypoint throws and TC-PROJ-029/TC-PROJ-030 step 4
(`projects --help` resolves rather than refusing) cannot be green.

(b) **A third existing suite pins the exact prompt-required set.** `tests/behaviour/entrypoint-composition.test.ts`
holds a literal `EXPECTED: readonly PromptRequiredCommand[]` of the 16 current names (lines 15-33) and asserts
set equality at line 67, plus `Object.keys(selected.commands)` equality in the next test. Adding
`projects` reds it. Phase 3 does not scope this file. (`tests/behaviour/entrypoint-help.test.ts` and the
`tests/structure/{cli-edge-seam,entrypoint-bin}.test.ts` set are `PROMPT_REQUIRED_COMMANDS`-driven or
`toContain`-based and need no change — verified.)

Suggested remediation target phase: delivery_planning
Suggested fix (exact):
1. Add `packages/cli/src/edge.ts` and `tests/behaviour/entrypoint-composition.test.ts` to phase 3
   `scope.files`; add them to TC-PROJ-030's target layer.
2. Correct the header/§18 claim that "both help gates assert set equality": **three** pins exist — the
   coverage gate, the parity test, and `TC-ENTRY-009` (`entrypoint-composition.test.ts`) — so the mount
   unit's file list must include the entrypoint-composition expectation.

### B15. **[critical] plan_code_area_coverage — plan phase 2 `scope.files`; verified in
`packages/core/src/index.ts`, `packages/core/package.json`, `packages/cli/package.json`**

Gap: phase 2 adds `packages/core/src/app/host-index.ts` and runs its pure fold from
`packages/cli/src/production.ts` (phase 2 work 2.4). The CLI cannot import it: `packages/cli/package.json`
declares `@delivery-os/core` workspace imports `[".", "./contracts", "./state", "./branding", "./provider"]`,
and `packages/core/src/index.ts` re-exports app symbols by an **explicit name list** from
`./app/index.js` (the closing block ends at line 191), not by a wildcard. Any new app-tier export the CLI
consumes must be added to that list. Phase 2 scopes `packages/core/src/app/index.ts` but **not**
`packages/core/src/index.ts`, so phase 2's typecheck fails unless the coder edits an undeclared file (which
`plan diff` would classify `outside-declared`).

Suggested remediation target phase: delivery_planning
Suggested fix (exact): add `packages/core/src/index.ts` to phase 2 `scope.files` and to phase 2's
registration note ("the root entry re-exports the new app-tier names"). Phase 3 and phase 1 already scope
it; only phase 2 omits it.

Note on B14/B15: both are the same class as iteration-1 B5/B9 — a required code area outside the phase that
needs it. Every other "would this file break?" check I ran is clean: all non-new paths in every phase's
`scope.files` exist, and every new path is genuinely absent.

## Non-blocking findings (apply in the same pass; none of these reds a gate)

F1. **[major] cross_artifact_consistency — test-plan §7 (line 2000) and §8.3 X-1/X-4**
Gap: the test plan still states "The delivery plan (`chg-GH-288-plan.yaml`, revision 1.0) still maps
**35 ACs / 39 TCs** … must be re-mapped before the next `dor_check`" (X-1), while plan revision 2.0 maps
38/42 (verified: 4+1+20+6+4+3 = 38 ACs, 5+1+21+6+4+5 = 42 TCs, no duplicate, no orphan). X-4 also calls
TDR-0022 a "phase-7 deliverable", which neither the spec nor the plan says.
Fix: replace X-1 with "revision 2.0 maps 38/42; verified at DoR iteration 2" and X-4 with "TDR-0022 is
phase 1 work item 1.0 (DEC-19)". Target: test_planning.

F2. **[major] decision_capture / cross_artifact_consistency — spec §15.1, §18 "Decision record", DEC-19**
Gap: the spec requires TDR-0022 "before delivery planning completes" and "carried in the plan's final
phase scope", while plan phase 1 work 1.0 authors it first and phase 6.4 only verifies it. Not blocking:
the record still lands before any code that depends on it, and the plan's escalation trigger
`decision-record-tdr-0022-missing-or-not-indexed-before-delivery-starts` matches the plan, not the prose.
Fix: state it as "authored as phase 1's prerequisite work item, before any code that depends on it, and
verified (not authored) in the final phase". Target: specification.

F3. **[minor] ac_quality — spec §17 AC-F1-6 Evidence cell**
Gap: the cell still reads "Suite (test-plan traceability placeholder — the cell that creates two
same-basename checkouts is to be named by the test plan)", but TC-PROJ-040 names it. Fix: replace with
"Suite (TC-PROJ-040, cells 1-6)". Target: specification.

F4. **[minor] cross_artifact_consistency — spec AC-F3-5 cell 1 and test-plan §3.1 AC-F3-5 row**
Gap: both pin `daemonReachable.reason` = `state-absent` for the first-use cell, while AC-F5-1 and
Appendix C say the shipped composition reports `daemon-not-mounted` for every entry (no capability ⇒ no
probe). TC-PROJ-042 hedges ("or `daemon-not-mounted` … records which"), so the ACs, not the test, are
wrong. Fix: make the cell conditional on the composition, or run the cell with an injected capability.
Target: specification.

F5. **[minor] plan_doc_update_coverage — plan phase 6 `scope.files`**
Gap: phase 6 adds `doc/spec/features/feature-projects.md`; `doc/00-index.md` hand-lists every feature page
and is not scoped. No gate enforces it, but the landing page would omit a delivered surface.
Fix: add `doc/00-index.md` to phase 6 (the doc carries a valid marker, so the distribution guard stays green).
Target: delivery_planning.

F6. **[minor] plan_code_area_coverage — plan phase 6 `Done when`**
Gap: it claims "the doc-distribution … gate is green", but `scripts/.tests/test-doc-distribution.sh` is not
part of `pnpm check` (verified: `check` = lint, format:check, typecheck, test, check:boundaries,
prompt-conformance, help-guide-coverage, exports-parity). Phase 5 names the command; phase 6 does not.
Fix: name `bash scripts/.tests/test-doc-distribution.sh` in phase 6's done-when. Target: delivery_planning.

## Closure status of iteration-1 blockers

- **B1 closed.** Spec F-1 pins the key as `<sanitised mint-time basename>-<discriminator>` with the
  discriminator = first eight lowercase hex of a random 128-bit project identifier persisted in the marker,
  so two same-basename checkouts mint different keys by construction; the mint-time basename travels in the
  marker, so rename/move cannot re-key; the index key guard is specified (F-1 "Collision guard", DEC-18,
  Appendix A row 7) and owned (AC-F1-6, plan phase 3) and proven (TC-PROJ-040 cells 1-6, including the
  copied-marker cell that asserts the existing entry is byte-identical and no revision advances).
- **B2 closed.** AC-F3-4 owns "list writes nothing" with a byte+mode+mtime snapshot of the host index and
  the `projects/` container; F-3, §4.1, §8.1 and §NFR-4 all state maintenance never runs on `list`;
  TC-PROJ-041 owns it (and enumerates the host-root set per lifecycle state), plan phase 3 owns the AC.
- **B3 closed as specified** (one indivisible mount unit in one phase; TC-PROJ-020 no longer asserts
  prompt-set membership; both gates and the inventory land together). The *scope* of that phase is still
  incomplete — recorded as B14, which is a new defect, not a reopening of B3.
- **B4 closed.** TC-PROJ-001 now asserts absence of store artifacts (with the forbidden artifact names
  enumerated) and defers the exact set to TC-PROJ-041; phase 1's done-when says the host root holds no
  index. Phase 1 is index-free and green.
- **B5 closed.** The policy is `packages/core/src/app/state-scope.ts`; `tier-app-allowed-set` forbids only
  `app → branding|state`, so `app → config|domain|contracts` is legal; no phase places the policy in
  `domain`. Moving `resolveStateDirectoryScope` out of `catalog.ts` is safe: its only importers are
  `packages/cli/src/edge.ts`, `packages/core/src/{index,config/index}.ts`,
  `tests/behaviour/config-resolver.test.ts` and the symbol list in `tests/structure/content-inventory.test.ts`
  — all inside phase 1's scope; `tier-config-only-contracts` constrains config's *imports*, which do not
  change; `catalog.ts` keeps `resolveDaemonSettings`.
- **B6 closed.** DEC-17 makes the identity outcome a closed table with one outcome per state, and every
  branch is producible: I re-verified that a `.git` file containing a bare `gitdir:` passes
  `findGitRoot`'s prefix test and then fails `resolveGitDir` (regex needs a non-empty value), which is
  exactly Appendix A row 2; a non-`gitdir:` file yields `undefined` = `unbound`; a `gitdir:` to a missing
  directory resolves directories and fails at marker creation (row 5). TC-PROJ-013 provokes refusals with
  bytes (four marker shapes plus the empty-`gitdir:` row) and adds anti-collapse controls in both
  directions; AC-F3-3 fixes the subject as the **invoking** checkout.
- **B7 closed.** DEC-8 now has exactly four cells; DEC-16's naming rule is conditional ("only when both
  exist", else checkout root plus failing path); AC-F3-5 owns all four cells and TC-PROJ-042 provokes each
  (cell 4 structurally, via a regular file at the marker parent, so it is root-proof).
- **B8 closed.** §16.1's page row and plan 6.1 both itemise (a)-(e): the `identity-unreadable` row no
  longer claims "not a git work tree", an explicit `unbound` row, the closed `daemon` vocabulary in OUTPUT
  and EXAMPLES, the `state-unavailable` wording, and the `state` example path; TC-PROJ-034 asserts the
  page agrees with AC-F1-5 and AC-F3-2.
- **B9 closed** for the guide: the registry is in phase 5 `scope.files` and done-when, and I confirmed the
  rule fires for an unregistered new doc. The same rule now also bites the phase-6 feature page — B13.
- **B10 closed.** AC-F9-2 and AC-F10-3 split their evidence explicitly. I re-read
  `tests/checks/privacy-release.test.ts`: TC-RELEASE-001 asserts exactly-one-added, no modified/deleted
  changeset, pre-existing byte-identity and non-vacuity; TC-RELEASE-002 asserts manifests at `0.0.0`, a
  frozen-lockfile install (which also passes after a legitimate dependency+lockfile change), and green
  licence/exports gates. So "no dependency or lockfile change" is correctly review-verified.
- **B11 closed.** AC-F6-4 is `mutation-verified` with the mutation named (P8: revert the composing site's
  argument to the host root); F-5 and plan 4.2 record that `resolveDaemonSettings` has **no caller** in
  `packages/**` (verified by grep) and that `daemon-compose.ts` derives no socket path (it consumes
  `settings.socketPath`); phase 4 scopes the site as "the one place that supplies a state directory",
  never as a module that derives a socket.
- **B12 closed.** One TDR is scoped (DEC-19), `TDR-0022` is free (highest existing is TDR-0021 in
  `doc/decisions/` and its index), and phase 1 places authoring as work item 1.0 before any code that
  depends on it. F2's wording conflict does not reopen it.

## Gate facts verified this iteration (do not re-litigate)

- `pnpm check` = `lint && format:check && typecheck && test && check:boundaries && prompt-conformance &&
  help-guide-coverage && exports-parity`; `check:help` = `scripts/checks/help-guide-coverage.ts`. Both
  help gates assert **set equality** with `PROMPT_REQUIRED_COMMANDS`, the coverage gate reads
  `tests/fixtures/help-guide/coverage.json`, and the parity test hardcodes the M1 page root today — so
  DEC-13's per-command root is genuinely required in both files, and `tests/checks/help-guide-coverage-mutants.test.ts`
  copies only the M1 page dir today (phase 3 scopes it, correctly).
- The error-table sync gate is `tests/checks/error-table-sync.test.ts` (plus
  `scripts/checks/error-table-sync.ts`); §16.1's correction is accurate.
- The release gate pins the five fixed-group packages at `minor`; `.changeset/config.json` `fixed` matches
  the five names in the spec.
- `scripts/.tests/test-doc-distribution.sh` scans `doc/guides/*.md` for the marker and derives the expected
  install set **from the marker**; `scripts/install.sh` installs guides marker-driven (no hand list), so a
  new `redistributable` guide needs no installer edit.
- `plan validate GH-288` → `valid`, `readyForDevelopment: true`; `lint plan GH-288` → `valid`.
- All non-new files in every phase's `scope.files` exist; every missing path is a declared new artifact.

## Residual risks I would accept once B13-B15 are fixed

1. **32-bit discriminator.** Eight hex characters of a 128-bit identifier give a ~2^-32 collision
   probability per pair; the index key guard (DEC-18) turns any collision into a named refusal rather
   than shared state, so the failure mode is visible. Accepted.
2. **Review-verified halves.** AC-F8-3, AC-F10-1, AC-F10-2 and the diff halves of AC-F9-2/F9-3/F10-3
   rest on review rather than a permanent assertion, because a diff against a moving base cannot be
   asserted in-tree. The exact review checks are named, which is the strongest available form. Accepted.
3. **No live daemon probe in the shipped build.** AC-F6-4 is structural plus mutation by design, which
   is honest given the daemon family is unmounted (NG-4). Accepted.
4. **`unbound` basename outcome is not pinned.** F-1 refuses `unbound` as a basename but does not state
   which basename replaces it; TC-PROJ-040 asserts only that the key does not start `unbound-`. Accepted
   as an implementation detail with a testable invariant.
5. **First-use daemon reason ambiguity** (F4) is a documentation inconsistency the test already tolerates.

## Can delivery proceed with a recorded accepted risk?

No. B13, B14 and B15 each make a phase boundary red (`pnpm check` in phase 6; typecheck plus the
prompt-required throw in phases 2 and 3), and the only remedy is an edit to a file the phase does not
declare — the same class the DoR gate exists to catch. The override path is unavailable: this change
alters behaviour, contracts and the delivery workflow, so it is not "genuinely trivial".

The remediation is six mechanical lines across plan phases 2, 3 and 6 plus three one-line wording
alignments (F1, F2, F3), all inside `delivery_planning`, `test_planning` and `specification`. Re-run this
gate (iteration 3) after they are applied; if the owner's one-iteration limit is binding, the owner must
record an explicit, reasoned deviation in `chg-GH-288-pm-notes.yaml`, because this gate cannot approve
delivery on the current artifacts.
