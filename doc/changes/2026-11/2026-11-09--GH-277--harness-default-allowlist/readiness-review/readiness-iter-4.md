# Readiness Review Iteration 4

Verdict: READY
Work Item: GH-277
Date: 2026-11-09
Pause Required: no

> Adversarial Definition-of-Ready pass over `chg-GH-277-spec.md` v1.4, `chg-GH-277-test-plan.md` v1.4, `chg-GH-277-plan.yaml` (`verdict=valid`, `tier=full`, `readyForDevelopment=true`), `chg-GH-277-pm-notes.yaml`, the GH-277 ticket, `TDR-0021`, and the delivered source named by the artifacts. This pass modified no spec, test-plan, plan, source, or pm-notes file and made no commit. It wrote only this record and `readiness/readiness-iter-4.yaml`.
>
> Iteration 3's single blocking finding and its single minor are verified fixed by file:line probe (below). The re-attack found no new contradiction that makes the artifacts internally unexecutable or lets delivery produce a spec-violating result; it found two documentation-level inconsistencies (severity `minor`) and re-confirmed three carried `nit` advisories. Facets are marked `FAIL` only for `critical`/`major` findings, so a `READY` verdict with non-blocking debt is intentional and explicit.

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

Counts: critical 0 · major 0 · minor 2 · nit 3

## Iteration-3 findings — verification by file:line probe

| # | Iteration-3 finding | Status | Evidence probed |
|---|---|---|---|
| 1 | [major] The v1 contract fixture was said to gain only `DispatchEnvelopeError` while TC-HDA-029 step 9 forbade any other export, contradicting the second mandatory export `DISPATCH_MAX_ERROR_DETAIL_CHARS` | **FIXED** | Test plan now states both declared additions everywhere it states the fixture: `:15` (front-matter summary), `:41` (§1.1), `:55` (GAP-T6), `:83` (§1.4 row 15), `:101` (§2 contract-surface bullet), `:189` (§3.4), `:237` (§3.5), `:1011` (TC-HDA-029 step 9 — "each list both of this change's declared additions"), `:1020` (TC-HDA-029 note), `:1338` (§6.1), `:1582-1583` (§6.4 `TC-PORT-001` run), `:1635-1637` (§7.1 fixture `edit` / comparator `run unchanged` / allowance `edit`), `:1703` (§7.2 blast radius), `:1728` (M-9), `:1795` (R-T15), `:1839` (v1.4 revision row). Plan: `:63-79` (header, "declares exactly two additions … both declared in `dispatch.ts` and re-exported from `contracts/index.ts`"), `:222-235` (P2 summary), `:247-249` (bound as registered contract export), `:286-300` (P2 doneArtifacts). |
| 2 | [minor] DoD-10 required an owner and a home for every remaining follow-up while §7.3 and §14 named none | **FIXED** | Spec `:217-225` §7.3 is now a table with `Owner`/`Home` columns and all five deferred items owned by `@pm` with concrete homes; `:344-347` §14 gained `Owner` and `Home` columns (OQ-1 → `@pm` / `TDR-0021`; OQ-2 → `@pm` / §14 OQ-2 + §7.3 with `TC-HDA-100`/`TC-HDA-101` closure evidence); `:438` DoD-10 now points at those records ("as recorded in §7.3 and §14"). Both tables are well-formed (7 and 4 pipe-delimited columns respectively). |

Residual-wording instruction from the iteration-3 remediation: the blanket prohibitions are gone. The literal strings "changes no other export name" and "only new export" no longer appear in the test plan or plan. Three qualified forms remain and are consistent with the fix, not with the old defect:

- `chg-GH-277-test-plan.md:1011` — "changes no export name other than this change's two declared additions (`DispatchEnvelopeError`, `DISPATCH_MAX_ERROR_DETAIL_CHARS`)".
- `chg-GH-277-test-plan.md:1338` — "changes no export name other than these two".
- `chg-GH-277-test-plan.md:1635`, `:1703` — "no other export name moves (the sibling `DISPATCH_MAX_LAST_MESSAGE_CHARS` is already pinned in both lists)".
- `chg-GH-277-plan.yaml:76-79`, `:299` — "no export name beyond those two changes".

Each is scoped to the two declared additions, so a delivery agent following them performs exactly the fixture and allowance edits the inventories require.

### Source probes behind the fix (re-verified this iteration)

- `tests/structure/port-contract-inventory.test.ts:57-77` (collector) adds a name for every exported declaration **and** every named re-export, so types and constants both count; `:84-109` is the bidirectional comparison ("missing export" / "unexpected export"); `:134-136` is the live-vs-fixture test. The fixture already lists the sibling constant under both `modules["dispatch.ts"]` (`:637`) and `modules["index.ts"]` (`:1540`), and lists the type `DispatchEnvelopeData` under both, which is exactly the pattern the plan now prescribes for the two new names.
- `packages/core/src/contracts/index.ts:696-703` re-exports the dispatch value constants and `:718` re-exports `type DispatchEnvelopeData`, so "re-export both new names from `contracts/index.ts`", and therefore the fixture entries under `modules["index.ts"]`, are achievable as written.
- `tests/structure/content-inventory.test.ts:466-509` is `EXECUTABLE_ALLOWANCES["core/src/contracts/dispatch.ts"]` (already lists `DISPATCH_MAX_LAST_MESSAGE_CHARS` at `:500`); `:2167-2176` reports "undeclared executable export" for an exported variable statement outside the allowance; `:2118-2124` admits `TypeAliasDeclaration` in an allowance-bearing file, which confirms the plan's claim that the `DispatchEnvelopeError` type needs no executable-allowance entry.
- Both P2 inventory gates are green before delivery, so the only P2 diff against them is the deliberate one: `bun test tests/structure/port-contract-inventory.test.ts` → 11 pass / 0 fail; `bun test tests/structure/content-inventory.test.ts` → 6 pass / 0 fail.
- `DISPATCH_MAX_LAST_MESSAGE_CHARS` is the only comparable delivered bound, and grep over `packages/**`, `tests/**`, `scripts/**`, `doc/spec/**` finds it only in `contracts/dispatch.ts:356`, `contracts/index.ts:701`, `app/dispatch.ts:180-182`, the allowance (`content-inventory.test.ts:500`), and the fixture (`:637`, `:1540`). There is no third pin of the widened dispatch surface that P2 would miss.

## Findings

1. [minor] cross_artifact_consistency — `chg-GH-277-spec.md` DM-3 (`:243`), the §8.3 `detail` note (`:248`), the §16 dispatch-contract row (`:370`), and Appendix C (`:532`); versus `chg-GH-277-test-plan.md:98` and `:1189`/`:1337`, and `chg-GH-277-plan.yaml:63-79`/`:222-235`/`:286-300`.
   Gap: The plan declares the second contract-surface addition (`DISPATCH_MAX_ERROR_DETAIL_CHARS`, an exported constant re-exported through `contracts/index.ts` and therefore pinned in the v1 contract fixture), and TC-HDA-034 step 3 requires the 256 bound to be "read from the delivered export". The specification never names that export: DM-3 defines only the type, the §8.3/Appendix C prose says "at most 256 characters", and §16 enumerates only `DispatchEnvelopeError`. Worse, `chg-GH-277-test-plan.md:98` attributes the constant to the spec — "Spec v1.3 DM-3 adds `DispatchEnvelopeError` in `dispatch.ts` (with the exported bounded constant `DISPATCH_MAX_ERROR_DETAIL_CHARS`, sibling to `DISPATCH_MAX_LAST_MESSAGE_CHARS`)" — which DM-3 does not say. Non-blocking for delivery: the spec's own DoD-2 binds all 29 TCs, and TC-HDA-034 mandates the exported bound, so the change's Definition of Done already sanctions the export; the defect is that the contract-surface description in the authoritative artifact is incomplete and one citation overstates it. Fix it before or during the spec/review touch, not as a delivery-phase task.
   Suggested remediation target phase: specification
   Suggested fix: In DM-3, add one clause: "the 256-character bound is exported from `packages/core/src/contracts/dispatch.ts` as `DISPATCH_MAX_ERROR_DETAIL_CHARS` (sibling to `DISPATCH_MAX_LAST_MESSAGE_CHARS`), re-exported from `contracts/index.ts`, and pinned in `tests/fixtures/ports/v1-contract-inventory.json`"; mirror it in the §16 dispatch-contract row and in Appendix C's contract block, and cite it in AC-F5-5's evidence. Then in `chg-GH-277-test-plan.md:98`, drop the "with the exported bounded constant …" attribution to DM-3 in favour of "spec DM-3 plus this plan's inventory obligation".

2. [minor] cross_artifact_consistency — `chg-GH-277-test-plan.md` spec line anchors and version strings; `chg-GH-277-plan.yaml` source header.
   Gap: The spec grew four lines at §7.3 in v1.4, so every cited spec line number after that point is now four lines low, and the test plan still declares its basis as v1.3. Examples probed against the current spec: `test-plan:1021` "DM-3 239" (DM-3 is at 243), `:1207` "NFR-6 283" (287), `:1277` "AC-F8-1 406, §18 439-446" (410, 443-450), `:1314` "AC-F8-2 407, §17.1 DoD-6 430, RSK-6 307" (411, 434, 311), `:1686` "AC-F6-3 400" (404), plus the Appendix A–C ranges (`488-500`, `502-514`, `516-540`). The test plan's §5.1 capability anchors (`F-1 141`, `F-3 143`, `F-5 145`, `F-8 148`) remain correct because they precede §7.3. The test plan also still declares the stale basis explicitly at `:196` ("Line references to `chg-GH-277-spec.md` are for spec v1.3") and `:1664`, and the version strings at `:15` ("aligned with change spec v1.3"), `:53`, `:54`, `:57`, `:87`, `:91`, `:98`, `:108`, `:187`, `:188`, `:997`, `:1060`, `:1134`, `:1307`, `:1807`, `:1808`, `:1818`, `:1819`, `:1822` were not bumped; `chg-GH-277-plan.yaml:5` and `:10` still cite "v1.3" for both the spec and the test plan. Non-blocking: every citation carries its stable id (`DM-3`, `NFR-6`, `AC-F8-2`, `RSK-6`), so a delivery agent can resolve the anchor from the id alone, and no DoD binds spec line numbers.
   Suggested remediation target phase: test_planning
   Suggested fix: Rebase the post-§7.3 spec anchors by +4, replace "spec v1.3"/"for spec v1.3" with "spec v1.4" at the listed locations, and update `chg-GH-277-plan.yaml:5,10` to "spec v1.4" / "test plan v1.4". Purely mechanical; no scenario, id, or coverage row changes.

## Advisories (non-blocking)

- **A1 (nit, persistent — iteration-3 A3) — `cross_artifact_consistency` (process hygiene)**: `chg-GH-277-pm-notes.yaml:6-10` records `specification`, `test_planning`, and `delivery_planning` complete at `05:57:52Z`–`05:58:03Z`, but the three artifacts were last edited at `06:54`–`06:56` (v1.4 / test plan v1.4 / plan P2 rewrite) and the blocker entry at `:85-100` says those phases were reopened for the iteration-3 remediation. DoD-11 reads the phase registry, so the reopen/re-complete cycle should be recorded through the `phase` family. DoR judges artifacts, and the superseding iterations live in `readiness-review/`, so this does not gate delivery.
- **A2 (nit, persistent — iteration-3 A1) — `plan_code_area_coverage`**: P1's gate text still says "the six named behaviour/structure suites" (`chg-GH-277-plan.yaml:171-173`) without enumerating them. The count matches the six P1-owned suites, but the set must be inferred. Enumerate the six command lines.
- **A3 (nit, persistent — iteration-3 A2) — `plan_code_area_coverage`**: `tests/structure/content-inventory.test.ts` also restricts exported symbols of `cli/src/output/dispatch-text.ts` (`:169-173`). If the bounded verbose diagnostic is implemented as a **new exported** function there, it must be registered in that allowance or P2's content-inventory gate fails with "undeclared executable export". P2's gate catches it, so the only risk is surprise; name the conditional registration or implement the renderer as a non-exported helper.

## Verified as consistent (no finding)

- **Plan schema and scope uniqueness.** `delivery-os plan validate GH-277` → `verdict=valid`, `artifact=yaml:chg-GH-277-plan.yaml`, `tier=full`, `readyForDevelopment=true`. YAML parses as `delivery.plan.v1` with four phases; scope counts 21/15/6/3 = 45 distinct paths, no path in two phases.
- **Id sets, ownership, and traceability are unchanged by the v1.4 edits.** Spec has 29 ACs and 13 DoD items; the test plan carries 29 scenarios in the §5.1 index and exactly the same 29 rows in the §10 log (set-equal, none missing or extra); plan ownership remains AC 14+2+11+2 = 29 and TC 16+2+8+3 = 29, each owned once, with mutation ownership covering M-1..M-20.
- **Ticket → AC mapping holds** for all five ticket bullets (viable default → AC-F1-1/AC-F2-1/AC-F8-1; PATH resolution → AC-F1-2; absent variable names the field → AC-F3-1/AC-F5-1/AC-F5-3; regression trio → AC-F7-1..AC-F7-3; verbose/JSON identity → AC-F5-2/AC-F5-3/AC-F7-4), and ticket option 2 ("drop the model names or map them") is decided with rationale in DEC-2 and enforced by AC-F2-1/AC-F2-3.
- **The v1.4 edits changed nothing else.** `git show f0ceb196 --stat` touches only the spec, test plan, plan, pm-notes, and the iteration-3 records, so every source-level fact verified in iteration 3 (dispatch error seam, golden byte-equality, `HarnessFailure` required fields, changeset ordering, `TC-RELEASE-001`, E2E isolation, DM-4 seam) still holds; no source file was edited and the worktree holds only the untracked `doc/decisions/TDR-0021-….md` that P4 owns.
- **No orphan marker or unowned follow-up is introduced.** A TODO/FIXME/TBD scan of the three artifacts finds only the DoD-10 rule text and the test plan's §10 `TBD` execution-log placeholders, which are the log's intended pre-run state and are filled per phase.
- **Decision capture is unchanged.** DEC-1..DEC-5 remain in `pm-notes`; DEC-3 remains governed by `TDR-0021` (status Proposed, owner acceptance at PR review); no new decision class is introduced by the v1.4 table edits.

## Gate result

`READY`. Delivery may start. Two `minor` documentation findings remain and are recorded as non-blocking debt: the spec does not name the exported 256-character bound that the plan and test plan treat as this change's second declared contract-surface addition (finding 1, remediation target `specification`), and the test plan's spec line anchors plus version strings lag spec v1.4 after the §7.3 table expansion (finding 2, remediation target `test_planning`). No pause flag, no override, and no `delivery`-phase remediation is proposed.
