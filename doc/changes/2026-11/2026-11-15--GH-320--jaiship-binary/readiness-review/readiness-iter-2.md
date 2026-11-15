# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-320
Date: 2026-11-15
Pause Required: no

Reviewed artifact set: `chg-GH-320-spec.md` (v1.3), `chg-GH-320-test-plan.md` (v1.2,
55 cases), `chg-GH-320-plan.yaml` (revision 1.1, 5 phases, 44 declared files,
`plan validate` = valid / tier full), `chg-GH-320-pm-notes.yaml` (D1–D11, D5
withdrawn, D6–D11 binding), `readiness-review/readiness-iter-1.md`, GitHub issue
320 (six verbatim ACs, milestone "M4: Public release readiness", OPEN), and the
current tree (`packages/cli/src/{entrypoint,production,edge}.ts`,
`packages/core/src/branding/index.ts`, `scripts/install.sh`,
`scripts/run-bash-suites.sh`, `.github/workflows/ci.yml`,
`scripts/checks/forbidden-literals.ts` + registry, and the delivered suites the
artifacts cite).

Iteration 1's remediation is materially real: every blocking finding except one
is verified fixed against the tree, and the two premises iteration 1 got wrong
(the `status` acquisition and the invalid-override projection) are now correct
and evidence-backed. One new blocking defect was introduced by that remediation,
and one new cross-artifact hazard exists that no artifact resolves.

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS (minor: the declared AC→phase matrix omits two ids)
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Blocking findings: 1. Major (non-blocking): 1. Minor: 7. Nits: 4.

## Verification performed (reproducible; hermetic)

All probes used a scratch `HOME` and a scratch state root; no command touched the
real `~/.delivery-os-state`, no daemon was started, and no git operation was
performed.

- Fixture `/tmp/opencode/dor2-fixture/{repo,home}` (git init + one commit +
  `.delivery-os/config.yaml`, 89 bytes). `strace -f -e trace=openat,read` over
  `HOME=<scratch> DELIVERY_OS_STATE_DIR=<scratch> bun packages/cli/bin/delivery-os.ts
  status --json`: exit `0`, exactly 4 `openat(.../.delivery-os/config.yaml, O_RDONLY)`
  and 4 matching `read(7, "daemon:\n  socket: …"…, ) = 89`. Zero non-`O_RDONLY`
  accesses. Finding 1's corrected premise is true.
- Same fixture: `DELIVERY_OS_WORKING_NAME='bad/name' … status --json` → exit `2`,
  envelope `code: "fallback.internal"`, summary `command "status" is not part of
  the composed prompt-required set`. `… config --json` → exit `2`,
  `fallback.internal`. `… --version` / `--help` → exit `0`, `delivery-os …`,
  stderr empty. Findings 1 and 2 confirmed.
- AST literal scan (`typescript` walk, `packages/**` minus `dist`/`node_modules`,
  string + no-substitution-template literals equal to `delivery-os`/`jaiship`):
  today 4 sites (MCP default, entrypoint neutral, `bin/delivery-os.ts`, `SCOPE_ORG`).
  After the declared removals/additions: 1 + 2 + 1 + 1 = **5**. Finding 5's
  arithmetic is exact.
- Spec §16 impact map parsed: 55 rows, 11 `UNCHANGED` → 44 `CHANGED`/`NEW`,
  set-equal to the plan's 44 declared files (0 plan-only, 0 spec-only). Finding 6
  is exact at the file level.
- `.github/workflows/ci.yml`: `bash-tests` installs `jq` only, no Bun;
  `scripts/run-bash-suites.sh` discovers any `*/.tests/test-*.sh`; `ts-test`
  installs Bun and runs `pnpm test` = `bun test`. Finding 4's remediation is
  sound and needs no workflow edit.
- `scripts/install.sh` supports `--local`, `--no-fetch`, `ADOS_SOURCE_DIR`,
  `DRY_RUN`, `--tool`, and skips auto-fetch when `ADOS_SOURCE_DIR` is set;
  `shellcheck --severity=error scripts/install.sh` = clean at HEAD.
- `bun test <file> --filter <anything>` under the pinned Bun 1.4.4: `--filter` is
  not a `bun test` flag; unknown flags are ignored and the whole file runs
  (`--filter zzzz` → 3/3 pass; `--totallyBogusFlag` → 3/3 pass).
- `plan validate GH-320` → `verdict=valid tier=full readyForDevelopment=true`;
  `~/.cache` exists and `mktemp -d "$HOME/.cache/ados-check-XXXXXX"` succeeds;
  `bun run scripts/checks/forbidden-literals.ts` → 5/5 classes, 0 violations;
  main-tools HEAD `573be730` CI = success.

## Iteration-1 finding dispositions

| # | Iter-1 severity | Disposition | Basis |
|---|---|---|---|
| 1 | critical | **Verified fixed** | Premise corrected with reproducible evidence (4 reads traced); DEC-14 + §2.1/F-3/AC-F3-4 keep the ticket's literal `status --json` surface; `config --json` unreachable, proven. |
| 2 | critical | **Verified fixed (spec side)** / **replaced by a new blocking defect in the test plan** | Spec is now internally consistent on one projection (`fallback.internal`, exit 2, both bins, alias byte-identical) across §2.1, §4.1, §5.1 F-2, §8.5, AC-F2-3, AC-F2-7, DEC-11, Appendix B. The test case that owns this path gained an unsatisfiable clause — see N1. |
| 3 | critical | **Verified fixed** | Only the three named delivered suites rely on the removed neutral floor: of 20 `runEntrypoint(` call sites in 15 files, exactly two omit `configuredWorkingName` (`entrypoint-help-isolation:33`, `pilot-isolation:109`) and `entrypoint-version` has the `versionRun({})`/`undefined` cells. All three are phase-1 scope with the affected call sites named and the required-property design pinned. |
| 4 | critical | **Verified fixed** | Bun-test home is the only home that keeps CI green; no `scripts/.tests` suite, no workflow change; the case is hermetically feasible in a Bun test. |
| 5 | critical | **Verified fixed** | Five-site inventory verified by an independent AST scan; guard asserts rule + inventory in both directions with sixth-site/missing-site controls. |
| 6 | major | **Verified fixed** (files) / arithmetic prose stale — see N2 | 44 changed files are set-equal; the declared fixture folder appears in both artifacts. |
| 7 | major | **Verified fixed** | §15.1's reasoning is honest: `doc/spec/features/feature-branding-seam.md:23` really does claim "no working-name literal is committed" while the tree commits three, so DEC-5 is a correction; TDR-0022's summary states "home plus `brand.stateDirectoryName`", which the policy still composes (twice), with one root, one helper, one `_STATE_DIR` read — an extension, not a contradiction. See N7 for the residual record-drift note. |
| 8 | major | **Verified fixed** in the spec/plan; **new hazard in the docs phase** | Fourth divergence, install-time Bun requirement, no-CLI source, `DRY_RUN`, `--tool` independence and the distribution-marker page are all declared. The guide's mandated `ADOS_*` content collides with the forbidden-literal scan — see N3. |
| 9 | major | **Verified fixed** | One executable same-device gate; the repo-local invocation is labelled evidence. Nit N10 (missing `mkdir -p "$HOME/.cache"`). |
| 10 | major | **Verified fixed** | Two implementable halves + canaries; in-process arming dropped. |
| 11 | major | **Verified fixed** | Snapshot-only real-home assertion; no absence claim anywhere. |
| 12 | major | **Verified fixed** | Self-contained five-page table; the delivered phrase table's page set (`FULL_PHRASE_PAGES`) excludes `feature-cli-entrypoint.md`, so no conflict; scratch checkouts replace nested `.git`. |
| 13 | major | **Verified fixed** | `completion` on both bins pinned (plan 1.3/1.4, TC-BIN-063 step 5, per-file allowance). |
| 14–19 | minor | **Verified fixed** | `--print-install-path` stated as the one new public token; per-source-kind reading recorded; notice once-state owned by the composition; DEC-15 scrubs the ambient override for the install-path query while the launcher forwards it; F-4 wording matches the CLI tier as the only probing site; the test-only helper is explicitly out of path and unedited. |
| 20 | minor | **Verified fixed** | Five acquisition sites enumerated (`production.ts:848,1811,1981,2081,2701` + `edge.ts createConfigProgram`) and wrapped, not re-implemented. |
| 21 | minor | **Verified fixed, weak rationale** — see N4 | Landing page deliberately untouched, discoverability via the four spec pages. |
| 22 | minor | **Verified fixed** | No stdin cell; the reason is stated. |
| 23 | minor | **Verified fixed** | `shellcheck --severity=error scripts/install.sh` on the phase-3 gate. |

## Findings

### Blocking

1. [critical] test_traceability — `chg-GH-320-test-plan.md` TC-BIN-012 step 2
   (and §3.2 row "§8.1 invalid-override configuration-bearing invocation").
   Gap: step 2 requires, "for each bin and each invalid override", that a
   **state-opening configuration-bearing command (`daemon status`)** exit `2`
   with `fallback.internal` "with the summary naming the missing composition".
   The delivered behaviour is exit **`1`** with **`fallback.invocation`** /
   `delivery-os: unexpected argument "status"` (verified with and without
   `--json`). Mechanism: an invalid override fails at `createConfigProgram`'s
   brand resolution (`packages/cli/src/edge.ts:3309`) before any acquisition;
   `production.ts:3031` throws; `runEntrypoint` catches and substitutes
   `{commands:{}}`; the synthetic `uncomposedDefinition` (`entrypoint.ts:180`)
   declares no `positionals`, so `parseInvocation` (`index.ts:295`) rejects the
   subcommand token before the containment handler runs. Only a
   positional-free command name reaches `fallback.internal`, and no command can
   be "state-opening" in that state because composition never runs — so the
   clause is unattainable, not merely misnamed. Satisfying it would require
   changing the alias's delivered invalid-override projection, which
   AC-F2-3/AC-F2-7/DEC-11 forbid, and dropping it silently is an undeclared
   relaxation (armed by the plan's own escalation trigger).
   Suggested remediation target phase: test_planning
   Suggested fix: keep `status --json` as the containment cell; replace the
   `daemon status` clause with either (a) the parse-level projection asserted as
   its own delivered fact (`fallback.invocation`, exit `1`, "unexpected
   argument"), or (b) the state-opening cell moved to a case where composition
   actually runs (valid override, missing prior artifacts). State which
   projection belongs to which invocation shape so the case cannot be read two
   ways.

### Major (non-blocking)

2. [major] cross_artifact_consistency / plan_doc_update_coverage —
   `chg-GH-320-spec.md` F-8, §8.5 divergence 4, §16; `chg-GH-320-test-plan.md`
   TC-BIN-072 steps 5–7, TC-BIN-071 step 2, TC-BIN-073; `chg-GH-320-plan.yaml`
   obligations 4.3/4.4 and the Phase 4 gate.
   Gap: the guide must state the installer's `~/.ados` / `ADOS_*` surface
   (divergence 4) **and** be registered in
   `scripts/checks/forbidden-literals.registry.json`; but the scan seeds
   `ados`, `ADOS_`, `~/.ados`, matches case-insensitively with
   lowercase-letter delimiting, and scans every *registered* doc
   (`forbidden-literals.ts:229–244,318–326,435`). `ADOS_HOME` matches the `ADOS_`
   seed (the character after the seed is uppercase), so a literal rendering of
   the divergence fails the phase-4 gate — while a non-literal rendering makes
   TC-BIN-072 step 7's "named in the guide's divergence section" pass only by
   interpretation. No artifact declares how both are satisfied, and a
   path/line allowlist entry for the guide is not among the declared
   obligations (the registry is declared in scope, the allowlist decision is
   not).
   Suggested remediation target phase: specification (with delivery_planning)
   Suggested fix: declare the resolution in F-8/§8.5 and mirror it in the plan's
   4.3/4.4 — either the guide names the four divergences and describes the
   installer surface without seed-literal bytes, or a line-allowlist entry for
   the guide's divergence rows is declared as an intended registry change
   (seed set unchanged, NG-9 intact). Add the corresponding assertion to
   TC-BIN-072 so the constraint is guarded rather than discovered.

### Minor

3. [minor] cross_artifact_consistency — `chg-GH-320-plan.yaml` header
   (SOURCES, SCOPE CONVENTION, R-H) and `chg-GH-320-test-plan.md` §2/§1
   preamble.
   Gap: the plan is written against "spec v1.2" and "test plan v1.2" while the
   spec is v1.3, and its arithmetic paragraph is now self-contradictory:
   "Spec v1.2 §16 lists 43 file paths + that folder; the only delta is R-H's
   `arm-counters.preload.ts`" — v1.3 §16 lists that path as row 44, so R-H's
   "the ONE declared path that spec §16 does not list" is false; and
   "Declared: 44 file paths + 1 folder" while the YAML declares **two** folders
   (`tests/fixtures/entrypoint/prior-identity`, phase 2; the change folder,
   phase 5). The test plan also pins `implementation_plan: … # plan revision 1.x
   (1.0 at this writing)` and "spec **v1.2**".
   Suggested remediation target phase: delivery_planning (with test_planning for
   its two citations)
   Suggested fix: bump the citations to spec v1.3 / plan revision 1.1, restate
   the count as "44 files + 2 folders (one fixture folder, one change folder)",
   and delete the now-false R-H delta claim (keep R-H as the record that §16 was
   reconciled to it).

4. [minor] test_traceability — `chg-GH-320-test-plan.md` §1.2, §6, §7 and every
   "Harness entry" line.
   Gap: ~40 harness entries use `bun test <file> --filter <name>`. Under the
   pinned Bun 1.4.4 `--filter` is not a `bun test` flag; unknown flags are
   ignored, so the whole file runs and a mis-typed filter can never fail loudly
   (verified: `--filter zzzz` and `--totallyBogusFlag` both run 3/3 tests and
   exit 0). The gates still run their files, so nothing is vacuous — but
   "narrow first" execution and per-case evidence attribution are not what the
   plan says, and `bun test <file> -t <regex>` (which *does* error on 0 matches)
   is available.
   Suggested remediation target phase: test_planning
   Suggested fix: use `-t/--test-name-pattern` for per-case selection, or drop
   the flag and state that each harness entry runs its whole suite file.

5. [minor] plan_coverage / cross_artifact_consistency — `chg-GH-320-plan.yaml`
   "AC -> PHASE MATRIX".
   Gap: TC-BIN-083 and TC-BIN-084 appear in the TC→PHASE map but in no AC row of
   the plan's own AC matrix, while the test plan assigns both to AC-F7-9
   (§3.1, §5.1). Two of 55 ids are therefore untraceable through the plan's
   declared AC matrix.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add both ids to the `AC-F7-9` row (083) and to the guard's AC
   row (084, "AC-F1-1..AC-F8-11 guard half").

6. [minor] test_traceability — `chg-GH-320-test-plan.md` TC-BIN-070 step 2.
   Gap: the stale phrase is quoted as "the bin is not part of the install
   surface"; the delivered sentence is "The bin is not part of the install or
   release surface." (`doc/spec/features/feature-cli-entrypoint.md:99`). A
   substring assertion on the quoted text passes on today's file, i.e. the
   stale check would be vacuous for the very sentence it exists to remove.
   Suggested remediation target phase: test_planning
   Suggested fix: quote the delivered sentence verbatim (both artifacts), and
   keep the required-phrase half as the non-vacuity control.

7. [minor] system_spec_consistency — `chg-GH-320-spec.md` §15.1 bullet 2;
   `doc/decisions/TDR-0022-multi-repository-workstation-state-scope.md`.
   Gap: the "extension without contradiction" reading holds, but TDR-0022 stays
   unamended and still `status: Proposed`; its summary describes a single
   host-root composition, so after delivery the record will not describe the
   two-candidate selection. The spec argues the page-level reconciliation is
   enough, and it may be — but the record-drift is carried entirely by
   `feature-projects.md` / `feature-config-layer.md`, which makes that phase-7
   step load-bearing rather than confirmatory.
   Suggested remediation target phase: specification
   Suggested fix: either add "TDR-0022 revisit trigger" wording to OQ-1/the
   M4-S1 remainder, or route an amendment through `@decision-advisor`; no new
   record is needed.

8. [minor] plan_doc_update_coverage — `chg-GH-320-test-plan.md` TC-BIN-071
   step 5; plan R-D.
   Gap: the landing-page rationale is self-undermining — "`doc/00-index.md` is
   deliberately untouched, because spec §16 marks it UNCHANGED and every
   existing redistributable guide is already listed there". `doc/00-index.md:58–78`
   lists ~20 guides, so the second clause argues *for* adding the row, not
   against. Also step 5 requires "at least one" of the four spec pages to link
   the guide while the plan requires all four.
   Suggested remediation target phase: test_planning (with delivery_planning)
   Suggested fix: restate the reason honestly ("discoverability is via the four
   affected spec pages; the landing page is deferred to the M4-S1 remainder") and
   align "at least one" with "the four".

9. [minor] plan_coverage — `chg-GH-320-plan.yaml` "DECLARED DEFAULT SELECTOR
   INPUT" bullet.
   Gap: "the remaining 29 files that call `runEntrypoint`" — the tree has 20
   `runEntrypoint(` call sites in 15 files, and 12 of those files are unaffected
   (three are edited, so 12, not 29). The *coverage* claim (all call sites
   accounted for) is correct; the count is not, which weakens the "accounted
   for" argument a reviewer can check.
   Suggested remediation target phase: delivery_planning
   Suggested fix: state the real numbers or drop the count and keep the named
   files.

### Nits

10. [nit] plan_coverage — the Phase 5 gate line
    `TMPDIR=$(mktemp -d "$HOME/.cache/ados-check-XXXXXX") pnpm check` omits the
    `mkdir -p "$HOME/.cache"` that TC-BIN-080's harness entry prescribes, so the
    gate is not executable on a host without `~/.cache`.
11. [nit] cross_artifact_consistency — the plan counts `LIT-TP-1` among the
    "§3.5 substitute assertions"; the test plan reclassified it as a direct
    assertion (§3.4/§3.5, five substitutions remain).
12. [nit] cross_artifact_consistency — `chg-GH-320-test-plan.md` §9 revision log
    is out of order (1.0, 1.2, 1.1).
13. [nit] spec_completeness — §23 glossary defines "Host root" as
    "override … otherwise `<home>/<stateDirectoryName>`" without the prior-root
    candidate that F-4/§8.3 add.

## Notes (verified, no action)

- Ticket fidelity: six ACs, milestone M4, OPEN. AC4's literal surface is kept;
  the two unavoidable deviations (no `.delivery-os/config.yaml` in this
  checkout, so a fixture proves it; the state half proved on a scratch
  counterpart) are disclosed in §12 and DEC-14. GH-310 is OPEN with no PR, so
  the stop-at-open-PR constraint is real and recorded.
- Appendix A matches the resolver exactly for both identities (all 12 fields,
  including `docsBaseUrl`/`repositoryUrl` staying on the delivery-os scope).
- The delivered seam rule tolerates the new non-exported selector constants
  (`branding-seam.test.ts:exportedStringConstants`/`fieldLiterals`); the
  five-site scan and the seam scan do not overlap in what they forbid.
- `installPath` genuinely has no production consumer, so "unconsumed today" is
  accurate despite the seam page's aspirational wording.
- Each of the 55 ids is owned by exactly one phase, and every suite named in §7
  is declared in exactly one phase's scope (R-F's split of the "extends" halves
  into phase 1 and the case bodies into phase 2 is coherent).
- The plan's Phase 4 gate, Phase 3 gate and Phase 5 gate commands all resolve to
  existing scripts/files (`exports-parity.ts`, `changesets-group.ts`,
  `forbidden-literals.ts`, `prompt-conformance.ts`, `help-guide-coverage.ts`,
  `test-doc-distribution.sh`, `test-install.sh`, `lint-commit-range.sh`).

## Next

Reopen `test_planning` for findings 1 (blocking), 4, 6, 8 (test-plan half);
`delivery_planning` for findings 3, 5, 9 and the plan half of 8; `specification`
for finding 2 (the declared resolution of the guide/forbidden-literal
constraint) and finding 7. Do not start delivery until this gate returns
`READY`. No human input is required for this iteration: the two
owner-visible interpretations (DEC-14's surface, DEC-11's projection) are
already PM-decided, evidence-backed, and disclosed for acceptance at the
pull-request gate.
