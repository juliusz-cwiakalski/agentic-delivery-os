# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-280
Date: 2026-11-10
Pause Required: no

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

## Verification Method

Read in full: `chg-GH-280-spec.md` (v1.2, 747 lines), `chg-GH-280-test-plan.md`
(v1.2, 2064 lines), `chg-GH-280-plan.yaml` (694 lines), `chg-GH-280-pm-notes.yaml`,
`readiness-review/readiness-iter-1.md`, and ticket GH-280 (`gh issue view 280`).

Re-verified against code (not against the artifacts' own prose):

- `packages/cli/src/production.ts:282` — `const stateDirectory = ${homeDirectory}/${brand.stateDirectoryName}`;
  `packages/mcp/src/serve.ts:87` — the same literal `stateIdentity` directory.
  `packages/cli/src/edge.ts:1395-1409` + `1417-1435` — `resolveStateDirectoryScope`
  feeds **only** the audit store inside `createProductionDependencies`.
  `packages/cli/bin/delivery-os.ts:15,29` — `homeDirectory = $HOME ?? $USERPROFILE`,
  so the shell default `$HOME/.ados-state/owner-hold` and the engine store agree.
- `tests/structure/queue-scheduling-contract.test.ts:212-228` — today the lane and
  blocking arrays are only checked for containment; no comparison to
  `closed-sets.json`. `tests/fixtures/queue/vocabulary/closed-sets.json` has no
  `laneIdleReasons` key and its `blockingReasons` holds 27 entries, byte-identical
  to `QUEUE_LANE_IDLE_REASONS` (`packages/core/src/contracts/queue.ts:223-251`);
  `QUEUE_BLOCKING_REASONS` is 33 (27 + the six condition ids, `:258-266`).
- `packages/cli/src/edge.ts:4296-4310` — no-ref `queue claim` short-circuits as
  `reason=no-eligible-action`; `:4051-4120` `mapQueueFailure` renders
  `reason=<reason>; <detail>`; `packages/core/src/domain/queue-lease.ts:164-252`
  already returns `{ reason, detail? }`; `packages/cli/src/commands/queue.ts:419-431`
  accepts `claim` with no positional.
- `packages/cli/src/daemon-compose.ts:410-420` — `nextAction` defaults to
  `() => undefined`, `claim` to a permanent refusal; `packages/core/src/app/daemon-supervision.ts:96-112`
  returns `idle` on an undefined action (the tautology iteration 1 flagged).
  `doc/spec/features/feature-resident-daemon.md:287-295` declares the production
  daemon entry as a residual.
- `packages/core/src/contracts/status.ts:424-442` — `credentialPrerequisite` sits on
  `StatusEvidence` as a sibling of `sources[]`; `packages/core/src/domain/status.ts:1824-1845`
  attaches it after derivation.
- `packages/core/src/contracts/doctor.ts:26-38,42-47,51-74,300-312` — 11 sources,
  4 outcomes, 22 reasons, `DOCTOR_MAX_DETAIL_CHARS=200`,
  `DOCTOR_MAX_EVIDENCE_REASONS=4` (the provider area declares 4 sources:
  `:78-84`); `packages/core/src/domain/doctor.ts:58-60,139-160,517-676` — the
  delivered `ok` path emits `observed` (+`park-active`, +`announcement-recorded`)
  and `check()` clamps the detail at the end with no ellipsis.
- `packages/core/src/domain/queue-lanes.ts:83-94` — a lane renders
  `blocking[0]?.reason` (the masking the artifacts now document);
  `packages/core/src/contracts/queue.ts:522-523` — `held` is a delivered entry state.
- `packages/core/src/contracts/error-table.ts:1223-1232` — `queue.precondition.unmet`
  is `user` / `retryable:false` / `not_landed` / `user-validation`; the documented
  row exists at `doc/spec/features/feature-result-contract.md:257`.
- `packages/core/src/app/dispatch.ts:75-77,484-487` and
  `packages/cli/src/production.ts:1076-1089` — the dispatch claim seam carries only
  `{ ok:false, code }` today, so the additive `summary` is real work.
- `tests/structure/provider-surface.test.ts:242-267` — SHA-256 pins on
  `scripts/ceo-loop.sh` and `scripts/.tests/test-hook-regression.sh`;
  `scripts/deliver-ticket.sh:619-626` and `scripts/ceo-loop.sh:200` `wait` on the
  hook with no timeout; `scripts/install.sh:133-135,860-865`;
  `scripts/uninstall.sh:433`; `scripts/run-bash-suites.sh:32`.
- Registries and scope: `scripts/checks/forbidden-literals.registry.json` (the two
  guides and `feature-autonomous-delivery.md` are baseline-grandfathered; the three
  feature specs and the three command pages are registered and seed-free apart from
  the allowlisted `ados_distribution:` header), `.changeset/config.json` (five
  lockstep packages), `tests/structure/inventory.json` shape,
  `tests/structure/content-inventory.test.ts:30,2282`, both guides'
  `ados_distribution: redistributable` markers, and `tests/structure/doctor-contract.test.ts:114-116`
  (22 reasons today → 23).

`pnpm exec delivery-os plan validate GH-280` → `verdict=valid`, `tier=full`,
`readyForDevelopment=true`.

Mechanical traceability recomputation over the current files:

- Spec §17 acceptance criteria: 44, all unique.
- Test-plan §3.1 forward table: 44 rows, 44 unique ACs, exact set equality with the
  spec (no gap, no extra).
- Plan `acCoverage`: 44 entries, 44 unique, exact set equality with the spec, each
  in one phase (no duplicate, no dangling).
- Test-plan §5.1 scenario index: 59 cases (58 automated + `TC-HOLDE2E-001`); every
  index case has a `####` detail section; every plan `tcCoverage` entry resolves to
  an index case; every index case has at least one plan phase home.
- Plan `scope.files`: no file appears in two phases (8 phases, 12/20/12/10/13/6/11/2
  files); `dependsOn` is acyclic and phase 8 depends on 1-7.
- Every non-new path cited by the test plan exists on disk; every missing path is a
  file the plan declares as new.

## Iteration-1 Remediation Table

| # | Iter-1 finding (severity) | Status | Evidence in the current artifacts |
|---|---|---|---|
| 1 | Marker-path / state-dir override not honoured by production (critical) | Fixed | Spec §2.1:76 states both compositions fix the delivery store and only the audit store uses the resolver; F-1.1 (`:187`), F-2.3 (`:204`), DM-9 (`:384`), A-2 (`:450`), DEC-1 (`:484`), §22 (`:631`), glossary (`:642`) all fix the marker at `<home>/<brand.stateDirectoryName>/owner-hold` with **no** override; the shell accepts no path override. Test plan `:21,34,111,171,597,1869`; plan `:89-101,182`. Verified against the two composition sites (production.ts:282, serve.ts:87) and edge.ts:1399. |
| 2 | No-ref `queue claim` never names the hold (major) | Fixed | Spec F-4.3 (`:235`) and AC-F4-2 (`:566`) require the refusal "before ref selection … never `no-eligible-action`"; test plan TC-HOLDQUEUE-002 (`:950-981`) runs both legs and `:975` pins the no-ref branch; plan pins `:112-114,546,550`; E2E step 3 uses `queue claim` with no ref (test plan `:1871`; plan `:692`). Matches the real code path (`edge.ts:4296-4310`). |
| 3 | Daemon guarantee claimed against unwired seams (major) | Fixed (option a) | Conditional guarantee stated in F-4.5 (`:237`), RSK-13 (`:445`), A-9 (`:457`), §13 (`:470`), AC-F4-4 (`:568`), purpose/§2.1 (`:33,70`); `daemon-compose.ts` is in no phase and the plan says so (`:63-65,141-146`). `GAP-T7` exists at test plan `:57` and R-9 `:2033`. |
| 4 | Daemon test was tautological (major) | Fixed | TC-HOLDQUEUE-005 (`:1042-1072`) builds `nextAction` from the held `computeQueueSchedule` via a recording helper, fails by name if the seam is a literal `() => undefined`, and adds a no-hold control; §7.4 records the mutation (`:2007`); plan `:536,551`. |
| 5 | Status member: section level vs evidence level (major) | Fixed | One location everywhere: `providers.evidence.ownerHold`, sibling of `sources[]` — F-5.1 (`:250`), DM-7 (`:382`), DEC-3 (`:486`), AC-F5-1/2 (`:576-577`); test plan DM-7 (`:169`), TC-HOLDSTATUS-001/002/003 (`:1312,1341,1362`), A-T1 (`:2040`); plan pin (`:147-153`) and verifications (`:432,436`). Matches the `credentialPrerequisite` precedent in code. |
| 6 | Closed-set pin unasserted (major) | Fixed | NFR-8 (`:414`) and AC-F4-9 (`:573`) require exact two-way equality; TC-HOLDQUEUE-011 (`:1208-1236`) names both `toEqual` assertions and a mutation control; §7.1/§7.2 say "extend the structural test" (`:1917,1957`); §7.4 rows `:1998-1999`; plan pin `:128-133` and phase-2 verification `:385`. Confirmed the delivered test lacks the assertion today, so the "extend" is real. |
| 7 | `queue ready` listed as a hold surface (minor) | Fixed | NG-12 (`:167`), DM-4 (`:379`), NFR-14 (`:420`), F-4.7 (`:239`), AC-F4-7 (`:571`), Appendix B (`:685`); test plan `:46,1180`, TC-HOLDQUEUE-009 step 3/expected (`:1171,1177`); plan `:126-127,373,383`. |
| 8 | Lane-level reason masking overstated (minor) | Fixed | F-4.7 (`:239`), RSK-4 (`:436`), Appendix B (`:677`); test plan TC-HOLDQUEUE-001 (`:945`), R-11 (`:2035`); plan `:119-125`. Matches `queue-lanes.ts:83-94`. |
| 9 | Doctor reason model needed an explicit carve-out (minor) | Fixed | F-6.2 (`:262`), DM-8 (`:383`), DEC-10 (`:493`), §16.1 `feature-doctor.md` "explicitly amended … not an inference" (`:531`), Appendix D (`:708-714`), glossary (`:652`); test plan `:1575`; plan `:486`. |
| 10 | Doctor detail clamp unspecified (minor) | Fixed | D18 folded into F-6.2 (`:262`), F-6.6 (`:266`), DM-8 (`:383`), AC-F6-1 (`:580`), Appendix D (`:710`); TC-HOLDDOCTOR-007 (`:1584-1612`); plan `:159-163,487`. Arithmetic checked: the segment `; owner hold active (marker): ` plus a 160-char reason is 191 ≤ 200, so "never unrenderable" is true. |
| 11 | Decision-reference drift (minor) | Fixed | Spec history 1.0 (`:720`) and §15 remediation paragraph (`:495`); test plan `:65`; plan `:18-26`. Ranges now D1-D11 + D12-D19, DEC-1-DEC-10, D3a as history. |
| 12 | Ordering prose disagreed; stale phase-7 sentence (minor) | Fixed | Spec §18 (`:592`) restates the invariant and matches the plan order; plan header (`:31-34,70-73`) removes the phase-7 error-table claim (phase 2 owns `feature-result-contract.md`). |
| 13 | Inventory wording hedged (nit) | Fixed | Test plan §7.3 (`:1984-1986`) names all three modules; §7.2 (`:1931-1944`). |
| 14 | `owner-hold` vs `owner-gate` ambiguity (nit) | Fixed | DM-5 (`:380`) and glossary (`:653`) disambiguate; AC-DOC-1 (`:584`) and §16.1 (`:525`) oblige the guide to state it. |
| 15 | Absolute zero-record metric (nit) | Fixed | §4.1 row 2 (`:140`) now carries "because of hold resolution or gating", matching NFR-2 (`:408`). |
| 16 | "Defer" vs classified refusal (nit) | Fixed | F-4.4 (`:236`), AC-F4-3 (`:567`), AC-DOC-1 (`:584`), Appendix B (`:683`); test plan TC-HOLDQUEUE-004 (`:1036`), E2E (`:1871`); plan `:115-118,547`. |

**16 of 16 iteration-1 findings are genuinely fixed**, not reworded: each
behavioural claim above was re-checked at the composition or contract site, and
each fix reaches the spec, the test plan, and the plan (the three findings that
changed behaviour — 1, 2, 3 — are consistent across all three).

## Findings (non-blocking)

1. [minor] cross_artifact_consistency — `chg-GH-280-spec.md` §2.1 (`:74`) and
   `chg-GH-280-plan.yaml` phase 4 verification (`:491`)
   Gap: Both state "six provider evidence sources". No such set exists: the
   provider area declares four sources (`doctor.ts:78-84`) and the doctor contract
   has eleven (`:26-38`). The six-value set that does exist is the delivered
   provider **reasons** (`config-invalid`, `provider-chain-unresolved`,
   `provider-chain-not-declared`, `credential-unavailable`,
   `park-credential-cause`, `state-unreadable`). A coder asked to assert "six
   provider evidence sources are byte-unchanged" cannot execute the clause as
   written; the authoritative eleven-source pin lives only in
   TC-HOLDDOCTOR-006/TC-HOLDNEG-002.
   Suggested remediation target phase: specification
   Suggested fix: Say "eleven evidence sources across five areas (four in the
   provider area) and six provider evidence reasons" in §2.1, and repeat the same
   wording in the plan's phase 4 clause. Cheap corollary: phrase the annotation
   rule as "the fourth reason on an otherwise-`ok` provider record, at the
   four-reason record cap" instead of "the fourth and last admissible provider
   reason", which can be misread as "the provider check admits only four reasons".

2. [minor] plan_coverage — `chg-GH-280-plan.yaml` COVERAGE INVARIANT (`:212-223`)
   vs phase 1 `tcCoverage` (`:300`) and phase 5 `tcCoverage` (`:532-544`); test plan
   TC-HOLDFACT-009 target location (`:495`)
   Gap: TC-HOLDFACT-009 declares both `tests/behaviour/owner-hold-fact.test.ts`
   and `tests/structure/owner-hold-composition.test.ts` as its locations, and its
   step 1 requires resolution "through the composition that supplies the fact".
   The composition test file is phase 5 scope only; phase 1 lists the case as
   satisfied in full and phase 5's `tcCoverage` omits it. The invariant's list of
   "the only cases split across phases" therefore omits this one.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Either declare TC-HOLDFACT-009 as a split case (phase 1:
   resolver-surface zero credential/network/write counts; phase 5: the canary scan
   across status/doctor/queue payloads in `owner-hold-composition.test.ts`), or
   move the composition-canary half to TC-HOLDEDGE-001 and delete it from
   TC-HOLDFACT-009.

3. [minor] test_traceability — `chg-GH-280-test-plan.md` §7.3 (`:1970`) and
   TC-HOLDQUEUE-011 (`:1221,1225-1226`); `chg-GH-280-plan.yaml` pin (`:128-133`)
   Gap: The documented fixture change ("add a `laneIdleReasons` array and update
   `blockingReasons`, each with exactly one `owner-hold` token … no other array
   changes") does not produce a fixture that can satisfy
   `expect([...QUEUE_BLOCKING_REASONS]).toEqual(closedSets.blockingReasons)`.
   Today `blockingReasons` is 27 entries and byte-identical to
   `QUEUE_LANE_IDLE_REASONS`; `QUEUE_BLOCKING_REASONS` is 33 (27 lane reasons +
   `deps-satisfied`, `repo-free`, `tier-known`, `no-owner-gate`, `ci-healthy`,
   `provider-available`). Appending one token to each leaves 28 vs 34.
   Suggested remediation target phase: test_planning
   Suggested fix: State that `blockingReasons` becomes the full ordered array
   (lane reasons with `owner-hold` + the six condition ids in delivered order,
   34 entries) and that `laneIdleReasons` is the 28-entry lane list. The exact
   `toEqual` means this fails loudly rather than silently, so it is a precision
   gap, not a false green.

4. [nit] ac_quality — `chg-GH-280-spec.md` AC-F4-1 (`:565`)
   Gap: The Given names a `not-ready` entry but the Then requires `owner-hold` first
   only for "each ready or held entry", while F-4.2 (`:231`), Appendix B (`:677`)
   and TC-HOLDQUEUE-001 (`:943`) require it for not-ready entries too.
   Suggested remediation target phase: specification
   Suggested fix: Add "each ready, held, or not-ready entry" to AC-F4-1's Then.

5. [nit] cross_artifact_consistency — `chg-GH-280-pm-notes.yaml` D1 (`:19-25`)
   Gap: D1 still asserts that the marker lives at `${ADOS_STATE_DIR}/owner-hold`
   "the state directory the typed engine already resolves" and that "the shell
   example also accepts `ADOS_OWNER_HOLD_FILE`". Both are false about production
   (production.ts:282, serve.ts:87). D12 (`:97-106`) corrects them and the spec's
   DEC-1 is labelled "D1, corrected by D12", but D1 itself carries no in-line
   supersession marker.
   Suggested remediation target phase: specification
   Suggested fix: Append "(superseded by D12: the engine does not honour a
   store-relocation override and the example accepts no marker-path override)" to
   D1's text, or leave D1 as history and rely on DEC-1 — but do not let a reader
   take D1 unqualified.

6. [nit] cross_artifact_consistency — `chg-GH-280-test-plan.md` §2 (`:66`)
   Gap: The plan row still says the implementation plan is "Not yet authored at
   test-planning time (phase 4 follows phase 3)"; `chg-GH-280-plan.yaml` exists and
   validates.
   Suggested remediation target phase: test_planning
   Suggested fix: Replace with "Authored after this plan; 8 phases, 59 cases homed,
  `plan validate` valid".

7. [nit] spec_completeness — `chg-GH-280-spec.md` NFR-11 (`:417`) vs NG-7 (`:162`),
   A-7 (`:455`), D12
   Gap: NFR-11 demands "0 hardcoded product, binary, or brand literals in tooling
   code", while the example hook necessarily hardcodes `ADOS_OWNER_HOLD` and
   `$HOME/.ados-state/owner-hold`. The carve-out exists in NG-7/A-7/D12 and
   `scripts/` is outside the literal-scan scope, but the NFR as written invites a
   contradictory assertion in TC-HOLDNEG-003.
   Suggested remediation target phase: specification
   Suggested fix: Scope NFR-11 to `packages/**` (and to the scanned user-facing
   docs), leaving the shell examples under the existing `ADOS_*` convention.

8. [nit] spec_completeness — AC-DOC-1 (`:584`) and §16.1 (`:525`) vs D12 (`:104`)
   Gap: D12's mitigation for a renamed product is "adopters who rename the product
   edit the example", but no document obligation states it: the guide must document
   the fixed default path, not that the example's path is a product literal to be
   edited after a rename.
   Suggested remediation target phase: specification
   Suggested fix: Add one clause to AC-DOC-1/§16.1: the guide states that the
   example's marker default is the shipped product's `.ados-state` path and is
   edited when a deployment renames the product, and that the environment source
   (or a separate change) is the relocation-safe alternative.

9. [nit] cross_artifact_consistency — `doc/spec/features/feature-status-digest.md:91,290,302`
   ("section-level `credentialPrerequisite`") vs spec F-5.1/DM-7 (`:250,382`,
   "evidence-level")
   Gap: The change set consistently says "evidence-level" for the same location the
   status spec calls "section-level". The artifacts are unambiguous (`providers.evidence.ownerHold`,
   sibling of `sources[]`), but the doc-sync pass could reintroduce the DoR-1
   finding-5 ambiguity if it copies the older adjective.
   Suggested remediation target phase: specification
   Suggested fix: State in §16.1's status row which term the reconciled spec must
   use (or note that "section-level" in the delivered spec means "on the section's
   evidence record").

10. [nit] spec_completeness — `chg-GH-280-spec.md` §7.2 (`:350`)
    Gap: The GUI/dashboard exclusion's parenthetical "(NG-12 read-only inspection
    remains in scope)" now trails an item that is not NG-12 (NG-12 is the
    read-only-inspection requirement itself).
    Suggested remediation target phase: specification
    Suggested fix: Drop the parenthetical or restate it as "no ID; NG-12 keeps
    read-only inspection in scope".

## Coverage Audit

| Check | Result |
|---|---|
| ACs defined in spec §17 = 44 | PASS (44 unique) |
| Test-plan forward table covers each AC once | PASS (44/44, exact set equality, no extra) |
| Plan `acCoverage` covers each AC once | PASS (44 unique, exact set equality, one phase each) |
| Test-plan scenario index = 59 TCs | PASS (59 unique; 58 automated + 1 manual) |
| Every TC has a detail section | PASS (59/59) |
| Every TC has a plan phase home | PASS (59/59; `TC-HOLDE2E-001` → phase 8) |
| Split-case declarations | PASS with one omission — `TC-HOLDQUEUE-004/-009`, `TC-HOLDEDGE-002`, `TC-HOLDNEG-002/-003` declared; `TC-HOLDFACT-009` is split but undeclared (finding 2) |
| Every AC has an automatable proof | PASS — including AC-F4-2's no-ref leg (TC-HOLDQUEUE-002) and AC-F4-4's conditional branch (TC-HOLDQUEUE-005/006 + GAP-T7) |
| Manual E2E and the gaps explicit | PASS — TC-HOLDE2E-001 + GAP-T1..T7 (`:51-57`); E2E step 3 uses no-ref `queue claim` and matches D13/D19 |
| Non-vacuity / mutation evidence | PASS (§7.4 `:1993-2019`; each pin names the failing case) |
| Ticket acceptance bullets → coverage | PASS — dispatch refusal ✓, parked-lane non-recovery ✓, removing-hold resume ✓, docs ✓, shellcheck/hook tests ✓, "supervision/watch claims nothing" as an explicit conditional with the resident-daemon residual ✓ (D14, AC-F4-4, GAP-T7) |
| Plan tree-green ordering | PASS — dependency-ordered; phases 2-4 land their own pins, and phase 5 is the single owner of `edge.ts`/`production.ts` |
| Plan scope disjointness | PASS — 0 files in >1 phase |
| `delivery-os plan validate GH-280` | PASS — `verdict=valid`, `tier=full`, `readyForDevelopment=true` |
| Referenced paths exist or are declared new | PASS — every non-new path exists; every missing path is declared new |
| Registries / literals / changeset | PASS — the two guides carry `ados_distribution: redistributable`; the literal registry's grandfather/registered split matches the plan's claim; the changeset fixed group is the five packages the plan names |

## Closed-Set Audit

| Vocabulary | Delivered | This change | Verdict |
|---|---|---|---|
| Park condition types / causes / pairing / recovery states | 3 / 3 paired / 4 | unchanged | PASS |
| Queue entry states | 5 (`ready`, `held`, `parked`, `stuck`, `not-ready`) | unchanged; `held` reused, not added | PASS |
| Queue state record kinds | 5 | unchanged | PASS |
| Queue-ready condition ids | 6 | unchanged; `QueueReadyPayload` gains nothing (D17) | PASS |
| Lane idle / blocking reasons | 27 / 33 | +1 `owner-hold` appended to lane, inherited by blocking (→28 / 34) | PASS — but the exact-equality fixture target is under-described (finding 3) |
| Status sections / states / sources / reasons / schema | 9 / 5 / 10 / 20 / v1 | unchanged; +1 optional member **on the evidence record** | PASS |
| Doctor areas / verdicts / sources / outcomes / reasons / conditions/exit | 5 / 3 / 11 / 4 / 22 / closed / unchanged | reasons +1 (`owner-hold`, after `park-credential-cause`); provider `ok` record goes 3→4 reasons (exactly the cap); no verdict, count, source, area, condition, or exit change | PASS |
| Error identities / domain kinds | closed | unchanged; `queue.precondition.unmet` remediation prose only | PASS — and `feature-result-contract.md:257` is updated in phase 2 |
| Pinned wrapper bytes | SHA-256 on `ceo-loop.sh` + `test-hook-regression.sh` | untouched, neither in any phase scope | PASS |
| State records written by the hold | n/a | none (derived on read) | PASS |

## Non-Blocking Advisories (outside the DoR facets)

- **Phase-state evidence.** `chg-GH-280-pm-notes.yaml:7-11` still shows the original
  `specification` / `test_planning` / `delivery_planning` completion timestamps and
  `dor_check` unstarted, and the change folder has no `events.jsonl`; nothing in
  the capsule shows the reopen/re-complete directly. The artifacts themselves are
  v1.2/1.2/current and internally consistent, so this does not affect the verdict,
  but the PM should confirm the recorded phase state (e.g. `phase list`) before
  starting delivery rather than assume it.
- **`bun` vs `pnpm exec` for checks.** Phase verifications mix `bun run scripts/checks/ambient-globals.ts`,
  `bun test …`, and `pnpm exec delivery-os …`; this matches the repo's stated
  conventions (`.ai/rules/testing-strategy.md`, `AGENTS.md`) and phase 8 uses
  `pnpm check` as the aggregate gate, so no artifact change is needed.

## Verdict Basis

Delivery may start. Every iteration-1 finding was re-tested rather than re-read:
the critical marker-path claim is now true at the two compositions that matter
(`production.ts:282`, `serve.ts:87`, with the resolver confined to the audit store
at `edge.ts:1399-1435`), and no artifact in the set asserts `ADOS_STATE_DIR`,
`ADOS_OWNER_HOLD_FILE`, or any marker-path/store-relocation override as honoured —
the only surviving trace is the historical D1 text in PM notes, which D12 and DEC-1
explicitly supersede (reported as a nit, not a blocker). The no-ref claim is now
gated before selection in the spec, the test plan and the plan, and the E2E step
uses the no-ref form, so the documented acceptance is reachable. The daemon claim is
conditional everywhere it appears and its test derives the seam from the held
schedule with a no-hold control, so the iteration-1 tautology is gone and GAP-T7
carries the residual honestly. The status member has one location in all three
artifacts, the closed-set pin is an exact two-way assertion that the delivered test
genuinely lacks today, the doctor clamp is specified and arithmetically feasible,
and the doctor reason model carve-out is a declared doc-sync obligation rather than
an inference. Coverage recomputes exactly (44 ACs, 59 TCs, 44 `acCoverage`, 59
homed, 0 phantom files, 0 files in two phases, `plan validate` valid); the closed
sets move by exactly the two declared tokens; and the SHA-pinned wrappers are
untouched. The ten new findings are precision and stale-wording issues: one wrong
count ("six provider evidence sources"), one undeclared split case, one
under-described exact-equality fixture target, and seven nits that cannot produce a
false green because each is caught by a named failing assertion or is prose-only.
None requires a human decision, and none reopens the design.
