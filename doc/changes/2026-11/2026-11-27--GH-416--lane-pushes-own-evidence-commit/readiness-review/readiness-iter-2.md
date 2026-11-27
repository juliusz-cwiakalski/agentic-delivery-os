# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-416
Date: 2026-11-27
Pause Required: no

Artifact set reviewed in full: spec v1.4 (603 lines), test plan v1.5 (31 TCs, 1276 lines), plan v1.3 (8 phases, tier full, 1729 lines), pm-notes (rulings R1 to R11), ticket #416 body plus its single owner comment (`issuecomment-7205540856`), `readiness-review/readiness-iter-1.md`, and the delivered code and suites the artifacts restate. Every closure claim below was checked against the operative text and the code, not the claim. `plan validate GH-416` was re-run read-only: `valid`, `readyForDevelopment: true`; the run left the change folder byte-unchanged and the tree clean at `3e05597d5`. The two delivered suites of finding 1 were executed read-only (15 pass, 0 fail), and their declaration-only rule was replayed over three candidate forms of the predicate in a scratch probe under `tmp/tmpdir`, deleted afterwards. Every scope path of the plan was resolved: all declared existing files exist, all declared new files do not.

Facet convention: as in iteration 1. A facet is FAIL when a blocking finding lands on it; a PASS facet may carry advisories, and none of them gates this verdict.

## Facet Summary

- spec_completeness: PASS
- ac_quality: FAIL
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

Counts: 3 blocking (1 critical, 2 major); 3 advisory findings (all minor) and 1 nit bundle; 3 advisories from iteration 1 remain open and non-gating.

## Iteration-1 Blocking Findings: Closure Status

**B1, the predicate story: NOT CLOSED, persistent in a new form.**
What the remediation fixed, verified in the plan and the code:
- The dependency direction. The seam imports from `@delivery-os/core/contracts`, the only core subpath adapters declare (`packages/adapters/package.json` `workspaceImports`; 98 existing imports of that specifier; `.dependency-cruiser.cjs:15-20` forbids only the reverse).
- No adapters-export edit. Phase 2 keeps the seam's four exported names (plan :725-732); phase 3 declares no file under `packages/adapters/` (plan :1080-1153); the command declares no copy (plan :1025-1026).
- One definition on the push path. The seam deletes `REF_PATTERN`, `FORBIDDEN_REF` and `isSafeRef` (plan :517-522); the command applies the same predicate during resolution and never asks the seam for a refused name (plan :857-865); the seam's guards remain as defence in depth (plan :521-522, :737-738).

What is not closed: the home. Rulings R1 and R9 put the predicate in `packages/core/src/contracts/closeout.ts`. Two delivered suites pin that module declaration-only, one of them inside phase 1's own Verify line. Finding 1.

**B2, the engine and the cause: CLOSED in substance.**
No artifact now claims that the engine's parity act names, records or surfaces a seam-derived cause: spec F-4 (:170), DEC-4 (:398), section 10 (:335), section 22 (:471); test plan TC-LCAUSE-001 step 7 (:736), TC-LOUT-001 step 2 (:940); plan phase 2 (:755-760) and phase 4 (:1213-1216). Code truth holds: `packages/cli/src/production.ts:4275-4281` branches on `outcome !== "accepted"` and discards `detail`, and no delivered suite or current-truth page pins `detail` or `git-exit` (`push.ts:160` is the only occurrence in the tree). Step 7 is assertable: the parity harness injects at the child-runner level (`tests/fixtures/dispatch/parity/harness.ts:231-236, 487`), so two rejection texts reach the real classification. Residual wording: advisory 4.

**B3, the AC-1 fixture: CLOSED.**
Act-time resolution, per ref: the fake remote parses the refspec, resolves `HEAD` against the checkout at call time and stores the head per ref; nothing is handed a head (test plan :273, §7 row :1126). Observable at session end: step 5 asserts no commit landed after the act (:281). No precondition sets the equality any more. The command-side facts are pinned by steps 3, 4 (the record's `head`), 6, 7 and 8; the plan carries the same fixture and its exit criterion (plan :1031-1039, :1055-1059) and declares the fixture folder (plan :1153). It is the ticket's "fixture with an injected transport". Residual: advisory 6.

**B4, the status golden: CLOSED.**
Phase 5 declares the new snapshot `tests/golden/status-lane-push.txt`, its host `tests/golden/dispatch-status-worktree.test.ts` and the behaviour suite (plan :1409, :1412-1413). The host is the delivered status-golden suite (`tests/golden/dispatch-status-worktree.test.ts:16-17`: one committed `status-<name>.txt` per cell, status object built inline). The test plan names the same host and snapshot (TC-LSTATUS-002 :818, section 6 :1118, section 7 row :1133). `dispatch-text.test.ts` left phase 5 (plan :24-27). Phase 1 declares `tests/structure/inventory.json` (plan :673). A fresh checkout reproduces the gate.

**B5, the two routed items: CLOSED.**
R5 is recorded (pm-notes :240-242). `doc/planning/oss-tooling/milestones/m1/commands/provider.md:31` ("the twenty-eighth and last") and `tests/checks/doc-conformance.test.ts:1620` are both in phase 3's scope (plan :1085, :1123) under the as-one-unit rule (plan :1000-1006); TC-LDOC-001 step 5 exempts exactly that pair (test plan :995). The `AGENTS.md` `pr_creation` row (`AGENTS.md:46`) is phase 8's, declared by path (plan :1662-1665, :1714); no delivered suite phrase-pins that row.

## R7 and the Earlier Closures

- **R7, counts: consistent everywhere.** Eight tokens, one guard-only, seven recordable: spec :143, :170, :278, :301, :482, :566; test plan :34, :123, :126, :609, :615, :724-735, :772-773; plan :251-260, :544-558, :714-723, :886-895. No stale "six" survives outside the revision log.
- **R7, `protected-ref` from a server-side decline: holds**, so ticket behaviour 3 survives (spec :143, :170; test plan :732; plan :716-723).
- **R7, `unsafe-branch` guard-only: holds** (spec :143, :301, :563; test plan :731, :773; plan :251-254).
- **R7, one defect inside the two-source story:** the protected-set source cannot occur on the command path. Finding 2.
- **Reserved-reference count: holds.** Five delivered (`packages/core/src/app/dispatch.ts:1110-1116`), at most seven: spec :108, :161, :299, :325, :496, :532; test plan :33, :124, :618; plan :67-70, :287-289.
- **`protected-ref` literal: holds** (`packages/adapters/src/git/push.ts:147`; spec :170, :301, :398, :482, :557; test plan :772; plan :555, :725-726).
- **RSK-9 residual: holds** (spec :351, :357; plan :884-885).
- **I-1: holds** (`.opencode/agent/pm.md:403`; spec :75; plan :101-103; test plan :880).
- **I-5: holds** (`packages/cli/src/help.ts` in phase 3 scope, plan :1096; `entrypoint.ts` outside every scope).
- **I-3: holds for the 17 `PINNING_FILES` suites** (all in phase 3 scope) and for every other count or tail pin except one suite. Finding 3.
- **Iteration-1 advisories closed:** 6 (RSK-10 at spec :352, :174, :337, :467; test plan R-1; plan fences :265-267), the first half of 7 (spec :162, :362; DEC-5 :399), 9 (test plan section 1.3; plan :1686-1705; the spec itself still has no 17.1), 10 (DEC-6 :400; TC-LMSG-002 step 5 :916; plan :1459-1463), 11 (head source: spec :159, :298, :322, :511, :519).

## Blocking Findings

1. [critical] plan_code_area_coverage — plan phase 1, the predicate's home (chg-GH-416-plan.yaml:497-531, scope :663), phase 1 Verify and read-only controls (:605-608, :634-636); spec F-1 (:143), section 7.1 (:234), section 13 (:370), section 16 (:409); pm-notes rulings R1 and R9 (:228-231, :266-268)
   Gap: The declared home, `packages/core/src/contracts/closeout.ts`, is pinned declaration-only by two delivered suites, and the plan puts a function with two regexes into it.
   - `tests/structure/closeout-contract.test.ts:210-213` ("the contract module is declaration-only and ambient-clean") requires `declarationViolations("packages/core/src/contracts/closeout.ts")` to be empty. The rule (:71-110) names every top-level `function` as an "executable declaration" and every variable whose initializer is not `as const` as a "non-as-const data declaration".
   - `tests/structure/port-neutrality.test.ts:17-23, 88-99` (TC-PORT-002) lists `closeout.ts` among the modules that must be "declarations plus `as const` data".
   - `doc/spec/features/feature-adapter-ports.md:267` documents the module as "types and `as const` data only".
   - Replay of the rule: `export function isSafeRef` yields `executable declaration isSafeRef`; the seam's form "lifted unchanged" (plan :500-502) yields three `non-as-const data declaration` violations (`REF_PATTERN`, `FORBIDDEN_REF`, `isSafeRef`); an exported regex plus an arrow yields two. Only `as const` data passes. A regex literal cannot take `as const` and a function cannot be data, so there is no form of the predicate that module admits.
   - Consequence: phase 1 runs `closeout-contract.test.ts` in its own Verify line as a control it declares "never edited", so its exit criterion "every verify line exits 0" and "only the declared paths changed" cannot both hold. `port-neutrality.test.ts` is in no Verify line and no scope, so the first proof that the home is wrong would otherwise arrive at the aggregate gate, after phases 2 and 3 have built on it. `pnpm check:boundaries` (plan :631) does not cover this rule.
   - Why the home cannot be elsewhere than contracts: adapters reach only `@delivery-os/core/contracts` (`packages/core/package.json` exports `.`, `./contracts`, `./state`, `./branding`, `./provider`; adapters declare `./contracts` only). The shared function must be in a contracts module, and `closeout.ts` is the candidate that is pinned. Contracts modules that are not pinned already export functions (`isAuditRecordKind`, `audit.ts:98`; `dispatchPushEvidenceRef`, `dispatch.ts:97`).
   - Correction of the record: iteration 1's suggested fix for finding 1 recommended a home "in core contracts beside `PROTECTED_REF_NAMES`" without checking that module's declaration-only pins. R1 and R9 adopted it. That suggestion was wrong, and B1 is persistent for that reason.
   Suggested remediation target phase: delivery_planning (primary, with a PM ruling revising R9), specification, test_planning
   Suggested fix: Keep one predicate, no copy, and the adapters-to-core direction. Move the predicate's function to a core contracts module that admits functions and that the seam can import: the plan's own conditional `packages/core/src/contracts/push.ts` made unconditional (already in phase 1's scope and inventory pins, plan :565, :571-573, :667), or `packages/core/src/contracts/dispatch.ts`, which phase 1 already edits and which hosts the `push:<verdict>` builder. `PROTECTED_REF_NAMES` stays in `closeout.ts` untouched. Then carry the new home to spec F-1, section 7.1, section 13, section 16 and DM-4; to test plan section 1.1 (:31), OQ-2 (:1241) and the TC-LRES-004 target (:477); to plan phase 1 (:497-531, :593-596); and record one revised ruling in pm-notes. Add `bun test tests/structure/port-neutrality.test.ts` to phase 1's Verify line as a read-only control. Add `doc/spec/features/feature-adapter-ports.md` to phase 8's reconciliation list. The alternative, keeping `closeout.ts` and amending TC-CLOSE-002 and TC-PORT-002, changes a delivered tier-purity pin and the adapter-ports row; that is a precedent-setting change and needs a decision record, not a plan comment.

2. [major] ac_quality — spec AC-F1-2 (chg-GH-416-spec.md:427), F-1 (:142-143), section 21 (:459), Appendix E (:557, :566); test plan TC-LRES-004 arm a2 and step 3 (chg-GH-416-test-plan.md:483, :492), TC-LCAUSE-001 preconditions, step 3 source (a) and step 5 (:725, :732, :734); plan phase 3 items 2 and 3 (chg-GH-416-plan.yaml:856-874)
   Gap: The protected-set pre-act refusal, source (a) of `protected-ref`, cannot occur on the command path, and three artifacts require a real-command-path test of it.
   - A resolved name is always a convention match: the delivered read keeps only names matching `branchConvention` (`packages/adapters/src/git/index.ts:436-451`) and `selectMatchingBranch` filters by it again (`packages/core/src/domain/closeout.ts:337-358`). The convention is `^[a-z][a-z0-9-]*/<ref>/.+$` (:338), so a resolved name always contains a slash.
   - `PROTECTED_REF_NAMES` is `["main", "main-tools", "HEAD"]` (`packages/core/src/contracts/closeout.ts:146`), tested by exact membership (`packages/adapters/src/git/push.ts:146`). No convention-shaped name equals a member. The spec mandates the delivered selection unchanged (F-1 :142, NFR-7 :327), so this is not an implementation choice.
   - Therefore "a uniquely resolved branch name that is a member of the shared protected-name set" (test plan :483) does not exist. With an injected `main` fact the real selection returns `none`, the command refuses for "no match", and arm a2's no-act, no-record, no-child assertions pass for the wrong reason. Producing the protected-set refusal needs a faked selection, which the test plan forbids (:156, and TC-LRES-003 step 4 :463 pins the real `selectMatchingBranch`). AC-F1-2's protected clause would then be "proven" (test plan :55) by an arm that cannot exercise it.
   - The spec presents the clause as one of the three reachable sources of refusal (F-1 :143) and section 21 says "an unsafe or protected name is refused before any process starts on either layer" (:459).
   - Introduced by R7: v1.4 tested source (a) at the seam by direct call, which is constructible. v1.5 moved it onto the command's resolution and required a command-path assertion. The direct-call half (TC-LRES-004 step 7 :496) and the seam's own guard are unaffected, and ticket behaviour 3 is served by the server-side decline.
   Suggested remediation target phase: specification (primary), test_planning
   Suggested fix: State in F-1, AC-F1-2 and Appendix E that a resolved name is always convention-shaped and can never be an exact member of the protected set, so the command's protected-set check is defence in depth that no command-path input can trigger, and the only command-reachable source of `protected-ref` is a server-side decline. Re-scope TC-LRES-004 arm a2 and TC-LCAUSE-001 step 3 source (a) and step 5 to what is constructible: a unit-level assertion that the command applies the shared set and a structural pin that it imports it, with the seam-level direct call kept. Drop the command-path precondition and the matching clause in plan phase 3 items 2 and 3.

3. [major] plan_code_area_coverage — plan phase 3 scope (chg-GH-416-plan.yaml:1080-1153) against its own alias-baseline regeneration (:985-990) and Verify line (:1046); test plan section 7 broad note (chg-GH-416-test-plan.md:1144)
   Gap: `tests/checks/provider-alias-baseline.test.ts` pins the alias help baseline at 28 Commands rows and 27 non-install rows, with `provider` last (:186-202), and the provenance note at exactly the GH-350 clause (:205-209). Phase 3 declares that the baseline's Commands list gains the `push` line and its provenance note gains one sentence, and runs this suite in its Verify line, but the suite is not in phase 3's `scope.files`. Every other suite that pins the count or the tail is in scope (checked file by file: the 17 `PINNING_FILES` suites, `install-migration-retirement`, `provider-entrypoint-reachability`, `event-mount-guards`, `entrypoint-help-coverage`, the two mounting fixtures, `doc-conformance`). Iteration 1 recorded that every test file carrying the literal 28 was in scope; that statement was wrong for this one file.
   Consequence: smaller than finding 1. The file is tracked, so an edit is still staged with disclosed drift, but phase 3 cannot meet "only the declared paths changed" without amending the plan mid-delivery.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `tests/checks/provider-alias-baseline.test.ts` to phase 3's `scope.files`, with a comment that its 28, 27, `provider`-last and provenance pins move to 29, 28, `push`-last and the added clause.

## Advisory Findings (non-blocking; none gates this verdict on its own)

4. [minor] cross_artifact_consistency — spec F-4 (chg-GH-416-spec.md:170) against F-4 bullet 3 (:169), F-3 (:160-161), AC-F3-1 (:429) and DM-3 (:300); plan phase 2 (chg-GH-416-plan.yaml:758-760); test plan section 1.1 (:34) and TC-LCAUSE-001 step 7 (:736)
   Gap: "the cause is surfaced by the command's answer and the lane-push record alone; no engine classification, envelope, or comparison carries one" sits beside "the attempt record carries the folded references of F-3 at the next classification", and the fold writes `lane-push-cause:<cause>`. `dispatch status` also carries `lanePush.cause`. The same imprecision appears as "no engine surface carries a cause" (plan :760) and as a three-item "appears only in" list that omits the status fact and the final message (test plan :736). The intended meaning is clear from AC-F3-1, so no wrong build follows.
   Suggested remediation target phase: specification, test_planning
   Suggested fix: "The engine's parity act and its derivation carry no cause and the `dispatch <ref>` envelope carries none; the attempt carries the cause only as the lane's folded reference, and the status fact carries it from the record." Add the status fact to the step 7 list.

5. [minor] cross_artifact_consistency — test plan TC-LBND-002 step 3 (chg-GH-416-test-plan.md:1076) against step 1 (:1074) and spec NFR-2 (chg-GH-416-spec.md:322)
   Gap: "re-invocation doubles only the act, its head read, and its append" contradicts the six-part bound of step 1 and the same sentence's "the head read and the pm-notes read each happen once per invocation". Each invocation is a fresh process that must re-resolve, so the pm-notes, branch and lane reads double too. An assertion that those three stay at one can never pass. Introduced with R8's count.
   Suggested remediation target phase: test_planning
   Suggested fix: "After two invocations every one of the six parts is exactly doubled; no further read class appears, in particular no read of the standing lane-push record."

6. [minor] test plan internal consistency — TC-LPUSH-001 (chg-GH-416-test-plan.md:266, :272-273, :293) against section 1.2 (:42), section 4 (:156) and section 6 (:1113)
   Gap: The fixture runs over "a real temporary repository checkout" holding commits, while the plan states "zero real child processes" and "no case starts a real child process". Creating those commits and resolving `HEAD` at call time run git (prior art: `tests/fixtures/closeout/temp-git.ts`, `tests/fixtures/pilot/repo.ts`). The note at :293 also says the case fails "if the act pushed an earlier head", which a fake remote that resolves `HEAD` itself cannot make happen; the equality discriminates the fixture's sequencing, and the command-side facts are steps 3, 4, 6, 7 and 8.
   Suggested remediation target phase: test_planning
   Suggested fix: Scope the zero-process claim to the act under test (the injected transport) and say that fixture setup and `HEAD` resolution may run git. Reword the note to the failure modes the case can produce. Optional, the PM's call under R3: a real local bare remote would make the equality observed rather than modelled.

7. [nit] bundled wording, no reopen required on its own
   - TC-LCAUSE-001 notes (:746) quote DEC-4 as "both producers name a cause"; spec v1.4's DEC-4 (:398) no longer contains the phrase.
   - Appendix E's `protected-ref` row (spec :557) places "the seam's protected-set guard" on "the command's pre-act resolution arm"; F-1 (:143) correctly makes the seam's guard the defence-in-depth layer.
   - TC-LRES-004 arm a1's examples (:482) include a name starting with `-` and one with whitespace; neither can be a convention match. The constructible example is a git-legal name outside the predicate's alphabet, injected as a branch fact.
   - TC-LCAUSE-002 step 4 (:771) requires the cause literals to "appear once in the source". That cannot hold for the seam's guard literals, which phase 2 says do not move (plan :725-727), nor for `protected-ref` in `packages/core/src/domain/closeout.ts:365, :1464`. Scope the assertion to the classification table.
   - Phase 8's reconciliation list omits `doc/spec/features/feature-adapter-ports.md` and the contract-module row at `doc/spec/features/feature-closeout.md:615`; both describe `contracts/closeout.ts` contents. They follow finding 1's chosen home.

**Persistent from iteration 1, still non-gating:**
- Advisory 8: the adopted reading of requirement 4 (a recorded snapshot) is still not before the owner; pm-notes hold no `question` note for it. Carry it into the PR description at the latest.
- Advisory 7, second half: TC-LRES-003 still tags RSK-9 (:447).
- Nit bundle: spec section 2.1 "exactly two" (:67); Flow 5 (:219-220); pm-notes "31 TCs across 13 families".

## Decision Routing

- Finding 1: `change`, PM ruling revising R9, recorded in pm-notes and carried to the spec and the plan. It becomes `system` only if the PM prefers to relax the declaration-only pin of `closeout.ts`; then a decision record is required through `@decision-advisor`.
- Findings 2 and 3: `change`. Both are change-level and need no human input.
- No `needs_human_input` item exists. Pause Required stays no.

## Gate Result

NOT_READY. Delivery is blocked. The override is not available: the change alters behaviour and touches contracts.

Next remediation targets, in dependency order:
1. `delivery_planning`, first this time and with the PM: finding 1's home (with `tests/structure/closeout-contract.test.ts` and `tests/structure/port-neutrality.test.ts` named green at the new home) and finding 3's scope line.
2. `specification`, after the ruling: the home wording, finding 2's reachability declaration, advisory 4.
3. `test_planning`: TC-LRES-004 arm a2 and TC-LCAUSE-001 steps 3 and 5 (finding 2); TC-LBND-002 step 3 (advisory 5); advisory 6 and the nit bundle.

Stalemate watch: B1 has now blocked two iterations for two different reasons. If finding 1 is still open at iteration 3, escalate to the human rather than re-running the gate.
