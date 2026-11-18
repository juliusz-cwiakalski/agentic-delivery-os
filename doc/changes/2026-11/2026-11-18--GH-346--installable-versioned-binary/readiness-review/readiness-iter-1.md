# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-346
Date: 2026-11-18
Pause Required: no

Reopen: **`specification`** (findings 1, 7, 8) and **`delivery_planning`** (findings 2, 3, 4, 5, 6, 9). Findings 1 and 2 are blocking; the rest are mandatory-in-passing.

## Facet Summary
- spec_completeness: PASS
- ac_quality: FAIL
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS
- (repo-gate satisfiability, checked separately per the gate brief: FAIL — findings 3, 4, 5)

## Verified, not findings

- **Ticket fidelity (brief #1).** All twelve ticket tasks and all six acceptance clauses trace (§17). DEC-14's six-clause reading is honest: the acceptance paragraph contains exactly five semicolons and six independent, falsifiable statements. The compatibility check is legitimately attributed ("ticket task/backlog") — `doc/planning/oss-tooling/milestones/m4/backlog.md:9` declares it as an M4-S1 task even though the issue body omits it. `install status` and the five entry points are TDR-0036 §3/§4 (`TDR-0036`, lines 116, 246, 281), not inventions. Nothing invented; nothing dropped.
- **Declared limits (brief #2).** `~107 MB`, host-only, and non-reproducibility are stated as limits with revisit triggers (F-1 line 171, NFR-15 line 437, AC-F1-2 line 592, RSK-12 line 465, §21 line 684). No reproducibility claim exists.
- **§18 conformance-surface folding (brief #3b) is not a spec defect.** §18 line 644 delegates phase boundaries to the plan ("The plan owns the phase boundaries; this specification owns the contract"), and header coupling 1 proves the surface is gate-inseparable from the family. No reopen needed.
- **Commit-boundary reality for the five TDRs (brief #6) — confirmed sound.** `computeStagingPlan` includes untracked files covered by a declared scope (`packages/core/src/domain/commit-staging.ts:54-62`), and scope matching is prefix-based (`plan-paths.ts:31-38`). Phase 1 declares the five exact untracked paths **and** the `doc/decisions` folder (plan lines 579-586), inside a lifecycle phase whose declared scope is the phase's own (`commit.ts:375-385`); `phase complete delivery_planning` correctly excluded them because `LIFECYCLE_PLAN_KINDS.delivery_planning = ["planning"]` matches no plan phase. The plan therefore gives the commit primitive staging authority for the five decision records on the phase-1 commit, and a `commit ... delivery` boundary additionally unions all six phases' scopes (`commit.ts:174-205`). No hand-staging is needed.
- **Coverage arithmetic.** 34/34 ACs are owned by exactly one phase (8+7+10+6+2+1); 83/83 cases owned exactly once (13+16+23+20+4+7); no orphan, no double claim.
- **Gate surface counts.** `PROMPT_REQUIRED_COMMANDS` is 25 with `supervise` last (`packages/cli/src/help/prompt-required-commands.ts:14-40`); `RESERVED_TWO_SEGMENT_CODES` is exactly 65 with no `install.*` (`scripts/checks/error-table-sync.ts:147-…`, counted); `DOMAIN_KINDS` has no `install` (`core/src/contracts/error-table.ts:13-41`); `coverage.json` has 25 commands / 31 pages. Every "26 / 66 / eleven" movement is arithmetically right.
- **`pnpm check` does not read the two to-be-falsified sentences.** `boundaries/identity-docs` assert neither "twenty-five families" (`doc/spec/features/feature-cli-entrypoint.md:53`) nor "no uninstall path exists" (`feature-doc-distribution-marker.md:47`); `doc-conformance`'s IDENTITY_ROWS pin other phrases. The phase-6 timing of those two corrections is safe.
- **Test-plan §3.5 substitutes.** All eleven bases are honest for what they claim; none hides an AC by itself (the one AC that collapses is collapsed by *case selection*, not by a declared substitute — finding 1). `plan validate` = `verdict=valid`, `readyForDevelopment=true`.

## Findings

1. **[BLOCKER] `ac_quality` — `chg-GH-346-spec.md` AC-F9-2 (line 611) vs AC-F9-1 (line 610) + Appendix B step 4 (line 745) + Appendix C.2 (line 770).**
   Gap: two acceptance criteria of the same specification contradict in one reachable state, and the only resolution that follows the letter of step 4 silently destroys the single rollback slot. AC-F9-2: re-installing the identical artifact leaves "the record is unchanged". AC-F9-1/TC-INST-036: after an injected step-7 failure the re-run "rewrites the record and reports `current`". Step 4 stops only when "the destination's identity equals the running identity **and** the record matches", so on the step-7-failure state the run continues: step 5 renames the destination (B) onto the slot, **replacing the still-valid previous artifact A**; step 6 re-stages B; step 7 writes a record whose `previous` is B. Rollback thereafter swaps two identical files — the "go back exactly one install" guarantee of AC-F9-3 and the ticket's "reversible" clause is silently lost. C.2 has no row for "compiled artifact + stale/damaged record", and TDR-0040 carries the same tension (§2 step 4 conditioned on the record vs §3 "Same-artifact re-install is a no-op **by identity comparison**"). The test plan narrows the AC rather than resolving it: TC-INST-022's precondition is "Installed artifact with **a valid record**" (test-plan line 449), so the contradicting state is untested in either direction.
   Evidence: `chg-GH-346-spec.md:610-611,745,770`; `doc/decisions/TDR-0040` §2 step 4 and §3; `chg-GH-346-test-plan.md:449`; `chg-GH-346-plan.yaml` phase-3 contract (lines 787-795) repeats the conditional stop without adjudicating the stale-record branch.
   Suggested remediation target phase: `specification`.
   Suggested fix: adjudicate the state in the spec and in TDR-0040 (recommended: identity-equal **+ record mismatched** ⇒ repair the record only, write no bytes at the destination, do not touch the slot; the no-op sentence and AC-F9-2 stay unconditional), add the C.2 disposition row, and add one test case asserting the slot's content after a step-7-failure recovery. Route the TDR-0040 amendment through `@decision-advisor` (system/precedent decision).

2. **[BLOCKER] `cross_artifact_consistency` — `chg-GH-346-plan.yaml` D6 (lines 405-416), phase 2 scope, vs `tests/structure/entrypoint-bin.test.ts` and `packages/cli/bin/jaiship.ts`.**
   Gap: the plan's only declared mechanism for satisfying AC-F4-2 ("names the owning binary", TC-INST-004 asserts a single-line refusal) cannot be implemented without breaking a delivered structural contract, and its faithful execution breaks the alias.
   Evidence, all three clauses:
   (a) `packages/cli/bin/jaiship.ts` declares `const DEFAULT_WORKING_NAME = "jaiship"` **unexported**, and `tests/structure/entrypoint-bin.test.ts:163-180` fails any *exported* working-name literal (`if (site.exported) failures.push(...)`), with `DECLARED_INVENTORY` (lines 134-152) pinning exactly five non-exported sites and an exact `packages/cli/bin/` count of three (line 309-310). D6's "import the primary bin's declared name from ./jaiship.ts" therefore requires an export the inventory rejects.
   (b) `packages/cli/bin/jaiship.ts:24-34` runs `runBinLauncher(...)` as a top-level initializer; importing it from `delivery-os.ts` executes the primary launcher inside the alias process — a second composition of the alias's own argv, i.e. two output lines and a second exit-code write, which breaks the byte-identity and single-line contracts (`tests/behaviour/entrypoint-two-bins.test.ts`, TC-INST-004) that AC-F4-2 and AC-F2-2 protect.
   (c) The remaining route (a side-effect-free module holding both names) moves two literal sites out of `packages/cli/bin/jaiship.ts`, so `tests/structure/entrypoint-bin.test.ts`'s inventory and its 3-under-bin count must move **and** `doc/spec/features/feature-branding-seam.md` ("exactly five sites", "the three CLI selector sites", enforced by `tests/checks/doc-conformance.test.ts` IDENTITY_ROWS lines 434-452) must move — a document declared by no phase.
   Net effect: the coder must invent the mechanism, invent where the names live, and move a branding contract declared by no phase — precisely the mid-flight requirement invention the gate exists to prevent.
   Suggested remediation target phase: `delivery_planning` (with one `specification`-visible consequence: F-4's "derived from the brand's binary name, no identity literal" needs a stated source).
   Suggested fix: replace D6 with a declared, side-effect-free home for the two identity names (for example `packages/cli/src/identity-names.ts` exporting `primaryWorkingName()` / `priorWorkingName()` over non-exported constants), state that the literal inventory's two sites and the `packages/cli/bin/` count move in that phase, and add `doc/spec/features/feature-branding-seam.md` to that phase's scope. Keep the "no sixth site" rule.

3. **[MAJOR] `plan_code_area_coverage` — `tests/structure/content-inventory.test.ts` is declared by no phase, yet phases 1-4 cannot satisfy their own `pnpm check` without editing it.**
   Gap: `EXECUTABLE_ALLOWANCES` (line 30) is a per-file allowlist and `executableViolations` (3272-3320) rejects *any* executable statement in a file with no allowance entry ("unexpected executable function", "executable statement … is not permitted at scaffold"); the loop at 3349-3357 runs over every inventory file. Every new package-script file this change adds needs an entry: `cli/src/build-identity.ts` (phase 1), `core/src/contracts/install.ts`, `core/src/domain/install-admission.ts`, `install-status.ts`, `adapters/src/file/install-destination.ts`, `cli/src/commands/install.ts`, `cli/src/output/install-text.ts` (phase 2), the record/compatibility/replace/state-roots files (phase 3), removal/path-block/migration/profile (phase 4). The plan declares `tests/structure/inventory.json` in all four phases (the file *set*) and omits its sibling (the *executable* allowlist); the test plan's own §7.2 names it as a suite that must move.
   Evidence: `chg-GH-346-plan.yaml` scope lists at lines 570, 757, 873, 965 (inventory.json present); `content-inventory.test.ts` absent from every phase (only mentioned in the D2 contingency prose at lines 380-381); the header claim "§7.1 and §7.2 of the test plan are both exhausted by the six phases" is therefore false.
   Suggested remediation target phase: `delivery_planning`.
   Suggested fix: add `tests/structure/content-inventory.test.ts` to phases 1-4 (and, if finding 2 lands a new identity-names module, register that file's exported names too).

4. **[MAJOR] `plan_code_area_coverage` / `cross_artifact_consistency` — `tests/structure/entrypoint-bin.test.ts` is declared only by phase 1, but its family array and count must move in phase 2.**
   Gap: the file contains the literal 25-element ordered `PROMPT_REQUIRED_COMMANDS` copy plus a `toBe(25)` root-help family count (lines 543-575) and the five-site literal inventory. Adding `install` in phase 2 makes those assertions fail immediately, and phase 2's scope does not declare the file; making the change in phase 1 instead would fail phase 1's own gate (the array would claim 26 members while the declaration has 25). The test plan §7.2 states this move explicitly ("`TC-BIN-067` family array gains `install` and `toBe(25)` becomes `toBe(26)`").
   Evidence: `chg-GH-346-plan.yaml:567` (phase 1 only); phase 2 file list (693-757) omits it; `tests/structure/entrypoint-bin.test.ts:543-575`; `chg-GH-346-test-plan.md:673`.
   Suggested remediation target phase: `delivery_planning`.
   Suggested fix: declare `tests/structure/entrypoint-bin.test.ts` in phase 2 (retaining the phase-1 declaration for the process-edge and literal-inventory halves), and say which half lands in which phase.

5. **[MAJOR] `cross_artifact_consistency` — TC-BIN-061 is owned by phase 1 but drives `install status --json`, which does not exist until phase 2 (payload group: phase 3).**
   Gap: phase 1's declared gate runs `tests/checks/artifact-self-containment.test.ts` (plan line 547) and AC-F1-1 is a phase-1 AC, but TC-BIN-061 step 3 names `install status --json` as "one composed command" and asserts "all three exit 0" (test-plan line 410). At phase 1 `install` is not in `PROMPT_REQUIRED_COMMANDS` and is not registered by the production composer, so the invocation is contained as `fallback.internal` at exit 2 (`packages/cli/src/entrypoint.ts`, and the delivered assertion at `tests/structure/entrypoint-bin.test.ts:583-600`). The AC cannot be closed by the case that owns it in the phase that owns it. AC-F1-1's own wording ("one composed command") does not require the new family — only the authored case does.
   Evidence: `chg-GH-346-plan.yaml:183,547`; `chg-GH-346-test-plan.md:410,317`; `packages/cli/src/help/prompt-required-commands.ts`.
   Suggested remediation target phase: `delivery_planning` (a case-ownership/phase-map correction; optionally `test_planning` for the case text).
   Suggested fix: change TC-BIN-061's composed-command arm to an already-composed read-only command (for example `status --json` or `phase list`), or reassign that arm to phase 2/3 and state that AC-F1-1's composed-command half is completed there while the AC stays phase-1-owned.

6. **[MAJOR] `test_traceability` — AC-F14-1 (line 619) and TC-INST-091 (test-plan line 529) key the installer guard on "a managed binary **and its record**", while F-14 (line 197) and RSK-5 (line 458) key it on "a managed binary is present".**
   Gap: the record-free state is reachable and legitimate under F-8 (the record is `absent` after a manual delete, and `absent` is a declared readable state; a step-7 crash leaves it stale). If the guard is keyed on the record, deleting `install.json` lets the delivered launcher overwrite a managed 107 MB artifact — the exact live defect the ticket exists to close — and no case covers that arm. The plan's phase-5 contract repeats the narrower "binary (and its record) present" wording (plan lines 987-990).
   Evidence: `chg-GH-346-spec.md:197,458,619`; `chg-GH-346-test-plan.md:529`; `chg-GH-346-plan.yaml:987-990`.
   Suggested remediation target phase: `specification` (AC wording) with the case added in `test_planning`.
   Suggested fix: state the detection predicate normatively (content-based: anything at the brand install path that is not the delivered launcher is a managed/foreign artifact), drop "with a record" from AC-F14-1's given-clause, and add a TC-INST-091 arm with the record absent.

7. **[MINOR] `system_spec_consistency` — DM-8 (line 400) overstates an adapter export-surface move that the delivered code already satisfies.**
   Gap: DM-8 says the worktree-topology read "changes a pinned adapter export surface and its parity baseline once", but `packages/adapters/src/repo/index.ts:71` (`resolveCheckoutGitDirectories`) and `:103-118` (`readCheckoutIdentity`) already return `{ gitDir, commonDir }` (and `undefined` on failure, satisfying "or an absence — never an error"). Plan D2 correctly declines to fire the conditional, so the spec's factual clause and its "additive" framing are both wrong. No AC depends on it — hence MINOR, not a reopen-blocker on its own.
   Evidence: `chg-GH-346-spec.md:400`; `packages/adapters/src/repo/index.ts:28-38,71-118`; `chg-GH-346-plan.yaml:372-383`.
   Suggested remediation target phase: `specification`.
   Suggested fix: restate DM-8 as "consumes the delivered worktree-topology read; no export surface or parity baseline moves (contingent: if the read cannot express the admission decision at the artifact's directory, the additive read and the parity/inventory moves land in the phase that consumes them — declare those paths there)". Note that D2's contingency names `tests/checks/exports-parity.test.ts` and `tests/structure/content-inventory.test.ts` for phase 2 without declaring them (finding 3 overlap).

8. **[MINOR] `system_spec_consistency` — RSK-15 (line 468) claims the artifact probe is "gated" so `pnpm check` keeps its current shape; nothing gates it.**
   Gap: the artifact tier lives in `tests/checks/artifact-*.test.ts`, which `bun test` (and therefore `pnpm check`) runs on every invocation, and TC-BIN-063 builds twice. `bunfig.toml` has no gate; NG-11 forbids a new environment variable; the plan's escalation trigger forbids environment-gating a case. So `pnpm check` acquires two ~107 MB compiles per run — acceptable, but the stated mitigation is untrue, and §6.3's "G0 … required by the artifact tier" pre-warm is not actually required (§6.1 has the suite build its own).
   Evidence: `chg-GH-346-spec.md:468,486`; `package.json` `scripts.check`; `bunfig.toml`; `chg-GH-346-test-plan.md:571`; `chg-GH-346-plan.yaml` escalation triggers.
   Suggested remediation target phase: `specification`.
   Suggested fix: replace the "gated case" sentence with the measured cost (one cached build per suite run, plus one extra for the byte comparison), and align §6.3 with §6.1 on whether G0 pre-warms or the suite self-builds.

9. **[MINOR] `plan_coverage` — two different files are each called "the one declared build-side identity-literal site".**
   Gap: phase 1's contract prose says the artifact name is derived at "exactly one declared build-side site (`scripts/build-binary.ts`, scanned under its own build-side root)" (line 515-519), while D1 (line 362-364) gives the same role to `packages/cli/src/build-identity.ts`. TC-INST-107 asserts "exactly one site derives the artifact name from the declared primary identity"; with two candidate homes, the case's scan root is undetermined.
   Evidence: `chg-GH-346-plan.yaml:362-364,515-519`; `chg-GH-346-test-plan.md:544`.
   Suggested remediation target phase: `delivery_planning`.
   Suggested fix: name one file and one scan root.

10. **[MINOR] `plan_coverage` — phase 2's declared write posture ships an artifact-replacing `install` with no daemon guard, while D3 claims it "performs steps 1, 2, 3 and 6".**
    Gap: Appendix B step 1 includes the daemon guard, but the plan states the guard "lands here" in phase 3 (line 809-812) and D3 (line 384-393) lists step 1 as performed in phase 2. Between the two commits, a real `install` replaces the artifact under a live daemon — not "a subset that is TRUE".
    Evidence: `chg-GH-346-plan.yaml:384-393,809-812`; `chg-GH-346-spec.md:745`.
    Suggested remediation target phase: `delivery_planning`.
    Suggested fix: either include the daemon guard in phase 2's step 1 or state phase 2's posture as "steps 1(partial), 2, 3, 6" with the guard gap named.

11. **[NIT] `plan_coverage` — phase 5 runs no `pnpm check` while the tier's escalation trigger requires a green aggregate gate at every phase boundary.**
    Gap: phase 5 edits `scripts/install.sh`, `scripts/uninstall.sh` and two bash suites, and deliberately skips G1 (line 1013). The delivered bash coverage is narrow (G3/G4/G5) and does include the touched suites, so the risk is low; the stated reason ("no package or pinned-count surface moves") does not cover the whole aggregate.
    Suggested remediation target phase: `delivery_planning`.
    Suggested fix: run G1 in phase 5, or state the exception explicitly as a declared deviation from the trigger.

## Minimum change set for READY

1. `specification`: adjudicate the identity-equal/stale-record state (finding 1) in the spec and TDR-0040, add the C.2 row and the slot-content assertion; narrow AC-F14-1's wording to the managed-binary predicate (finding 6); correct DM-8 (7) and RSK-15 (8).
2. `delivery_planning`: replace D6 with an implementable owning-name mechanism and add `doc/spec/features/feature-branding-seam.md` to its phase (2); add `tests/structure/content-inventory.test.ts` to phases 1-4 (3); declare `tests/structure/entrypoint-bin.test.ts` in phase 2 (4); fix TC-BIN-061's composed-command arm or its phase (5); name one build-side literal site (9); settle phase 2's daemon-guard posture (10).

No `delivery` finding exists; the hard gate stays closed until the above lands and this gate re-runs.
