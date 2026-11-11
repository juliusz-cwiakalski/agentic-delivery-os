# Readiness review — GH-286 — iteration 2

- **Verdict:** NOT_READY
- **Date:** 2026-11-11
- **Iteration:** 2 of 3
- **Pause required:** no — every blocking finding is artifact-repairable.
- **Artifacts:** spec v1.1, test plan v1.1, plan v1.1 (`plan validate` valid), pm-notes, TDR-0023 (DC-1 amended), readiness-iter-1.md, ticket #286, delivered tree.

## Facet summary

| Facet | Result |
|---|---|
| spec_completeness | FAIL (RF2-4) |
| ac_quality | FAIL (RF2-4) |
| plan_coverage | FAIL (RF2-2, RF2-3, RF2-5) |
| test_traceability | PASS (49/49 rows, 53/53/53, no orphan) |
| cross_artifact_consistency | FAIL (RF2-1, RF2-4, RF2-5, RF2-6) |
| decision_capture | FAIL (RF2-1: TDR DC-2 not amended with the rest) |
| system_spec_consistency | PASS |
| plan_doc_update_coverage | PASS |
| plan_code_area_coverage | FAIL (RF2-2, RF2-3) |
| dod_defined | PASS |

## Iteration-1 closure

| ID | Status |
|---|---|
| RF-1 | Partially closed — triad consistent and the spawn proof real; the fail-closed half is not testable as written (RF2-4) |
| RF-2 | Partially closed — TC-070/073/075/078 and the plan agree on strict `<`; TDR-0023 DC-2 still pins `<=` (RF2-1) |
| RF-3 | Closed |
| RF-4 | Closed |
| RF-5 | Closed |
| RF-6 | Closed |
| RF-7 | Closed for the 20 declared mutants; one test-plan mutant has no owner (A2-2) |
| A-1 | Closed |
| A-2 | Partial (RF2-4) |
| A-3 | Partial (A2-1) |
| A-4, A-5, A-6, A-8 | Closed |
| A-7 | Closed in spec; stale history remains in pm-notes (A2-7) |
| A-9 | Closed as a disposition, but the wording contradicts TC-039 (RF2-6) |

## Blocking findings

### RF2-1 [major] — the binding decision record still pins an inclusive staleness bound

`doc/decisions/TDR-0023-…md:427` still reads `nowMs − Date.parse(beatAt) ≤ lockStalenessMs`, and the `Amendments` section covers DC-1 only. Spec DM-4/EVT-2/AC-F5-4/AC-F5-6, plan header and TC-073 all pin strict `<`. An implementer following the declared-binding record implements `<=` and fails AC-F5-4/TC-073.

**Remediation:** amend DC-2 to `<` and add the amendment row.
**Reopen:** `specification` (+ decision record).

### RF2-2 [major] — the re-entry spawn edit has no phase whose scope contains `daemon-compose.ts`

Task 1.1 declares the input inert until Phase 2; the delivered spawn still replaces the environment with one variable (`packages/cli/src/daemon-compose.ts:671-675`). Phase 2's `scope.files` omits `daemon-compose.ts`; Phases 1 and 4 declare it but assign no spawn merge. TC-030/040/041 are Phase 2-mapped.

**Remediation:** declare `daemon-compose.ts` in Phase 2 scope and assign the merge there.
**Reopen:** `delivery_planning`.

### RF2-3 [major] — AC-F7-5's refusal has no implementation site in Phase 3

The delivered install handler performs no entry-path check (`daemon-compose.ts:781-795`); `binary` is a required field. TC-104 is Phase 3-mapped but the guard must live in `daemon-compose.ts`, which Phase 3 does not declare.

**Remediation:** add `daemon-compose.ts` to Phase 3 scope; name the refusal (`daemon.state-recovery-failed`, before rendering) in task 3.2.
**Reopen:** `delivery_planning`.

### RF2-4 [major] — the home-less fail-closed case is unsatisfiable as written

TC-041 steps 5/6 assert no store is opened and no root-level path is used, but F-3/AC-F3-4 pin "the composition keeps the home-based value", and `production.ts:285-286` builds `${homeDirectory}/${brand.stateDirectoryName}` after `trimTrailingSeparators`, so an empty home yields `/<stateDirectoryName>`.

**Remediation:** pin the unresolvable outcome in F-3/DM-5/AC-F3-4/AC-F2-10 — an unresolvable state directory (empty home and no override) leaves the `daemon` family mounted but composes an unavailable runtime whose subcommands return the delivered `config.value.invalid` at exit 2, opening no store, lock, or socket; the home-based fallback applies only when a home exists (so a non-absolute override still falls back). Restate TC-041 to that outcome with a faithful `homeDirectory = ""` fixture.
**Reopen:** `specification`, `test_planning`.

### RF2-5 [major] — the second `daemon` absence assertion turns red in Phase 6 and is not in the permitted-edit set

`tests/behaviour/entrypoint-composition.test.ts` has two daemon-absence sites (`:73` and `:86`); TC-010 step 5 and plan task 6.6 name only the first. After the mount, the second loop's `fallback.internal`/exit-2 assertion for `daemon` fails.

**Remediation:** name both sites in TC-010 step 5 and plan task 6.6.
**Reopen:** `test_planning`, `delivery_planning`.

### RF2-6 [major] — the `createDaemonMainEntry` disposition forbids what TC-039 requires

Phase 4 says the entry "gains no test", while TC-039's precondition requires a fixture that invokes the real `createDaemonMainEntry`.

**Remediation:** scope the disposition to production surfaces ("never wired into the composition, composer, or bin; a test fixture may use it as a library seam"), or re-pin TC-039's fixture.
**Reopen:** `delivery_planning`.

## Advisories

| ID | Sev | Finding | Reopen |
|---|---|---|---|
| A2-1 | minor | Test plan §-line still says the coverage fixture update is "sorted, duplicate-free"; plan says order is not normative. Pick one rule. | test_planning |
| A2-2 | minor | `spawn-with-full-env` mutant is declared in the test plan but no phase creates or consumes it (plan totals 20, test plan 21). | delivery_planning |
| A2-3 | minor | Test plan declares `tests/fixtures/daemon/mount-golden/`; plan declares `mount-mutants/` as the only subfolder. | delivery_planning |
| A2-4 | nit | `tests/checks/daemon-privacy.test.ts` is labelled "(update)" but does not exist; Phase 8 creates it. | test_planning |
| A2-5 | minor | Status/control-plane cases need an injected transport/process port/platform, but DM-5 pins exactly two new production facts and exposes no such seam. State per case whether the composition under test is the production composer or a directly composed `createDaemonCommandRuntime`. | test_planning |
| A2-6 | nit | TC-039 step 4 proves the interpreter basename but not that it came from the forwarded `PATH`. | test_planning |
| A2-7 | nit | PM notes keep historical "47 ACs"/"50 TCs"/"four suites" claims; the final entry supersedes them. Add a superseded marker or leave as history. | specification (hygiene) |
| A2-8 | nit | Spec §2.1 says `readDaemonStatus` derives the marker "without a socket probe"; it merges `daemon-unreachable` from `socket.reachable`. Reword. | specification |
| A2-9 | nit | TDR-0023:402 still names `ProductionCompositionFacts.entryScriptPath`; spec DEC-2 adopts `daemonEntry`. | specification (+ decision record) |

## Verified sound (do not re-litigate)

- Count integrity: 49 AC rows = 49 ACs; 53 index/detail/automation; plan map 53 unique, 0 missing; validator valid.
- Strict-`<` boundary consistent across spec DM-4/EVT-2/AC-F5-1/4/6/8, plan header + 5.2/5.3/5.4, TC-070/073/075/078; no case denies another.
- RF-1 substance coherent across TDR DC-1, spec F-2/F-3/DM-1/DM-5/AC-F2-1/AC-F2-10/AC-F3-2/§8.5/§12/RSK-2/RSK-6/DEC-16/Appendix E, plan header + task 2.4, TC-030/039/040/041.
- Re-entry environment does not leak into the unit.
- Permitted-edit set complete for the enumeration; other suites derive from `PROMPT_REQUIRED_COMMANDS`.
- Phase ordering safe; Phase 6 lands membership + help + coverage + conformance + both hard-coded lists in one commit.
- Zero-new-module pin keeps the inventory/exports controls byte-identical.
- Phase 7 page targets exist with the exact claims to reverse; the doc-conformance CLI_COMMAND_CLAIMS guard excludes those pages.
- A-5 closure verified.

## Reopen routing

| Phase | Findings |
|---|---|
| `specification` | RF2-4, A2-7, A2-8, A2-9 (+ TDR-0023 DC-2 amendment for RF2-1) |
| `test_planning` | RF2-4, RF2-5, A2-1, A2-4, A2-5, A2-6 |
| `delivery_planning` | RF2-2, RF2-3, RF2-5, RF2-6, A2-2, A2-3 |

No finding targets `delivery`. This is iteration 2 of 3.
