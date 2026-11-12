# Readiness review — GH-290 — iteration 2

- **Verdict:** NOT_READY
- **Date:** 2026-11-12
- **Gate:** `@readiness-reviewer` (adversarial Definition of Ready)
- **Artifacts reviewed:** `chg-GH-290-spec.md` (v1.1, 38 ACs), `chg-GH-290-test-plan.md` (v1.1, 45 TCs), `chg-GH-290-plan.yaml` (8 phases, `tier: full`; `plan validate` returns `valid` / `readyForDevelopment: true`), `chg-GH-290-pm-notes.yaml`, ticket `juliusz-cwiakalski/agentic-delivery-os#290` (re-read), `doc/decisions/TDR-0025-…` (amended in place, `status: Proposed`, untracked — `git ls-files` empty, `git status` `??`), the M2 planning pack, and the delivered tree under `packages/core/src/{contracts,domain,app,state}`, `packages/cli/src`, `scripts/checks`, `tests/**`.
- **Pause required:** no — every finding routes to `specification`, `test_planning`, or `delivery_planning`. No human decision is needed to repair them.
- **Iteration cap:** this is iteration 2 of ~3. RF-1..RF-9 are closed (see closure table). RF-10..RF-13 are new, introduced or exposed by the remediation; a third iteration that repeats any of them is a stalemate and must escalate to the human.

## Facet summary

| Facet | Result | Basis |
|---|---|---|
| spec_completeness | **FAIL** | RF-10: NFR-2's threshold is stated "per daemon tick", which the delivered tick cannot meet |
| ac_quality | PASS | 38 ACs are observable and non-overlapping; AC-NFR-2 correctly says "publish tick"; AC-F3-1/AC-F6-2 now have legal witnesses |
| plan_coverage | PASS | Every requirement and every AC has an owning phase; 45/45 TCs mapped single-owner; the 8-phase renumbering is internally consistent |
| test_traceability | PASS | 38/38 ACs covered, 45/45 non-orphan, 5 declared substitutes, no TODO |
| cross_artifact_consistency | **FAIL** | RF-12 (test plan's delivered-suite role is false), RF-13 (spec §16 page content vs plan Phase 5), A-12 (stale pm-notes phase) |
| decision_capture | PASS | TDR-0025 amended in place with an Amendments table; change-level decisions in DEC-A..DEC-O; nothing precedent-setting is left only in prose |
| system_spec_consistency | **FAIL** | RF-10 (NFR-2/KPI vs `daemon-runtime.ts`), A-17 (`readChangeTransitions` costs two reads, not one) |
| plan_doc_update_coverage | PASS | Every page spec §16 names is inside a phase scope; RF-13 is a content-specificity gap, not a missing page |
| plan_code_area_coverage | **FAIL** | RF-11: the new core export the composition needs is in no phase scope |
| dod_defined | PASS | Observable ACs plus per-phase gates and a done-artifact set |

## Closure table — iteration-1 findings

Status vocabulary: **closed** = the artifact text now says the right thing and (where the finding was factual) the code agrees; **partially closed** = the core defect is fixed but a related statement is still wrong; **open** = unresolved.

| ID | Status | Evidence checked |
|---|---|---|
| RF-1 | **closed** | `plan.yaml:533` declares `tests/structure/daemon-production-composition.test.ts` in Phase 5; `:502` runs it in the Phase-5 gate; `:486,509` name 19/19/18. Code: the three literal counts are at `daemon-production-composition.test.ts:71,138` (18) and `:121` (17). Spec §8.5 (`spec.md:437`) restates the edit-set rule over counts; AC-F7-4 (`:645`) and TC-EVT-063 step 7 (`test-plan.md:1243`) pin 19/19/18. |
| RF-2 | **closed** | Spec F-1 (`:164-184`), AC-F3-1 (`:607`), glossary `Lane` (`:719`): `lane` is a non-empty string on every event topic, nullability delegated to a future version; TC-EVT-022 steps 4-5 and TC-EVT-026 now assert that. Code: `contracts/blockers.ts:205` `lane: string`; `cli/src/commands/blockers.ts:139-140` requires `--lane`. TDR DC-2 (`:306`) carries the same rule; the `lane: null` witness is withdrawn in the Amendments table (`:412`). |
| RF-3 | **closed** | Spec F-1 `ref` table (`:179-184`), Appendix F (`:821`), AC-F3-1: `ref` nullable only on `blockers.state`; TC-EVT-022 step 5 and TC-EVT-026 steps 1-5 assert explicit `null`. Code: `domain/blockers.ts:221` normalises absent/empty to `null`; the publish flags (`commands/blockers.ts:266`) carry no `--ref`, so the shipped path records `null`. |
| RF-4 | **closed** | Snapshot topics declare `kinds: []` / `payloadFields: []` (F-1 `:168-169`, F-2 `:209-210`, F-6 `:273`, AC-F6-2 `:636`, DEC-B `:525`, DEC-K `:534`); the emitted-set equality is scoped to event topics (AC-F3-7 `:613`, DECL-G1, TC-EVT-027 steps 1-3, TC-EVT-051 step 2). No fabricated `snapshot` kind remains anywhere; TDR DC-4/DC-5 amended (`:320,417`). |
| RF-5 | **closed in substance; two residuals opened as RF-10/RF-11** | NFR-2 (`:446`), AC-NFR-2 (`:661`), §9 (`:456`), DEC-N (`:537`), plan Phase 7 (`:598-655`), TC-EVT-081 (`:1486-1515`) all restate the delivered seam as one whole-store `readRecords()` shared by both projections. The original "≤ 4 ledgers / bounded page" claim is gone. The residuals are the *wording/interval* (RF-10) and the *export scope* (RF-11). |
| RF-6 | **closed** | Truncation marker removed from NG-9 (`:146`), payload-bounds paragraph (`:250`), EVT-1 (`:405`), NFR-5 (`:449`), AC-NFR-4 (`:663`), DEC-O (`:538`); TC-EVT-022 step 7, TC-EVT-026 step 6, TC-EVT-071 step 5, TC-EVT-083 steps 3-4 assert its absence and a provable worst case. No `truncated`/`truncationReason` path remains for event payloads. |
| RF-7 | **closed** | `occurredAt` = source record's timestamp (F-3 `:219`, DM-2, DEC-D, AC-F3-1); `sequence` process-scoped (F-4 `:261-265`, DM-5, DEC-I, AC-F4-3). TDR DC-2 (`:306-307`), Implementation Plan item 2 (`:384`) and the Amendments table (`:413`) now match. Plan header (`:43`) and Phase 8 (`:661-678`) stage the amended file and no longer claim "consumed unchanged". Residual tense nits in A-13. |
| RF-8 | **closed** | Spec §2.1 (`:72`), §2.2 (`:92`), §8.5 (`:435`), §18 (`:674`), DEC-L (`:535`), RSK-10 (`:479`), AC-F8-1 (`:651`), Flow 5 (`:337-338`) all state acceptance → refusal with the lost mislabelled `lanes` stream; TC-EVT-075 objective/steps 1-3; TDR `customer_impact`, DC-4 (`:323`), revisit trigger and Amendments (`:414`). No "only the identity differs" framing survives outside the amendment rationale that quotes it. |
| RF-9 | **closed** | `release` payload = the lease record's own fields (`:225`), derivations (`:240`), "Park facts are not projected in v1" (`:248`); EVT-4 (`:408`) and Appendix E (`:807`) exclude `queue.park`; Appendix C (`:776`) says the park-cause vocabulary is not projected; TC-EVT-016 step 2 asserts no `parkCause`. Code: `contracts/queue.ts` `QueueLeaseRecord` has no park cause. |
| A-1 | **closed** | F-3 "Payload derivations, declared" (`:237-246`) states every rename/flatten/duplicate (`comparisonClass`, `resumeMode`, `cleared.id`, `cleared.clearedAt`, `release.operation`, payload `ref`). |
| A-2 | **closed** | Spec §16 (`:574`) and Appendix A (`:741`) name `doc/planning/oss-tooling/backlog.md`; plan Phase 8 declares it (`:709`) and the folder. |
| A-3 | **closed in spec/TDR/test plan/plan; stale in pm-notes → A-12** | Spec RSK-1 (`:470`), §16 (`:570`), TDR DC-1 (`:301`), Implementation Plan item 6 (`:388`), test plan §2/§7 (`:73,1199,1710`), plan Phase 5 (`:479-485`) all say Phase 5. `pm-notes.yaml:29` still says "phase 7". |
| A-4 | **partially closed → RF-12** | §7 now gives one role per mount-touched suite and the TC-EVT-016 union half is in Phase 6 (`:1691`, `plan.yaml:175`). But the `entrypoint-help-coverage` role is wrong: the suite hard-codes the 18 names (`entrypoint-help-coverage.test.ts:147-171`) and compares them to `coverage.commands`, so adding `events` to the fixture fails it without an edit. |
| A-5 | **closed; residual A-9** | DM-9 (`:423`) declares the identity (record `key` + view position) and the bound (4 × lanes × ≤3 families); NFR-3 (`:447`), AC-NFR-3 (`:662`), TC-EVT-082 step 5. Residual: the phase family is a cumulative artifact payload (A-9). |
| A-6 | **closed** | TDR Problem Framing (`:116`) restates additivity with the three `events` rows; Amendments row 4 (`:415`). |
| A-7 | **closed** | Spec now cites `contracts/daemon.ts:22` for `DAEMON_DEFAULT_SUBSCRIPTION_BUFFER` — verified at that exact line. EVT-4 no longer lists `queue.park` as consumed. |
| A-8 | **closed** | Plan Phase 2 gate now runs `content-inventory` (`:313`) and declares `inventory.json` (`:343`); Phase 7 no longer declares `doc/00-index.md`; Phase 8's note (`:682-684`) states no index edit. |

## New blocking findings

### RF-10 [major] — NFR-2 states a bound "per daemon tick" the delivered tick cannot meet, and the counted interval is unpinned

**Artifacts:** spec NFR-2 (`:446`), §4.1 KPI row "Store reads per daemon tick | 1" (`:123`), §9 (`:456`); AC-NFR-2 (`:661`); test plan TC-EVT-081 (`:1486-1515`) and §6.1 tick-release rule (`:1633`); plan Phase 7 (`:598-655`).

**Gap:** AC-NFR-2 is scoped to "a publish tick" and is testable, but NFR-2's threshold and the success metric say "per **daemon tick**". A delivered daemon tick is the loop iteration (`packages/core/src/app/daemon-runtime.ts:203`), and on every heartbeat cycle it calls `writeHeartbeat()`, which calls `readQueueEntries(ports.store)` and `readDaemonLanes(ports.store)` (`:172-175`) — each is a whole-store `store.readRecords()` (`app/queue.ts:409`; `app/daemon.ts:262 → readLedger → :120`). So a heartbeat tick performs **three** `readRecords()` calls (two heartbeat + one publish at `:243`), not one. The plan's Phase 7 scope (`:643-651`) does not declare `daemon-runtime.ts`, so the literal NFR cannot be met inside the declared scope.

**Why the test does not catch it:** TC-EVT-081 releases "one tick" through the manual-wake harness (§6.1) but does not pin whether that is the loop tick or the `publishState` call. With the fixed clock used by the event harness, `now - lastHeartbeatAtMs = 0 < heartbeatIntervalMs`, so the heartbeat is skipped and the count is 1; if the case advances the clock, the same assertion fails. The test therefore either passes without proving the NFR's claim or fails on the heartbeat, depending on an unstated detail. TC-EVT-081's "tick **without** the event projection (baseline)" (`:1502`) also assumes a projection-off switch that no phase declares.

**Remediation:** restate NFR-2 and the KPI as "per publish tick — one `publishState` call" (AC-NFR-2 already is), and pin the measured interval in TC-EVT-081 ("count only the calls made between entry and return of one `publishState`/`changes()` invocation; heartbeat and supervision are outside the window"). If "daemon tick" is intended after all, declare `packages/core/src/app/daemon-runtime.ts` in Phase 7 and share the view with `writeHeartbeat` — but that widens the change and needs its own AC.

**Reopen:** `specification` (NFR-2, KPI), `test_planning` (TC-EVT-081 interval and baseline definition), `delivery_planning` only for the daemon-tick variant.

### RF-11 [major] — the new core projection's consumer is unpinned, and the package-root re-export it needs is in no phase scope

**Artifacts:** plan Phase 3 scope (`:386-393`), Phase 4 (`:446-460`), Phase 7 goal (`:600-621`) and scope (`:643-651`); spec §7.1 (`:363`), §9 (`:456`), §16 (`:549`).

**Gap:** Phase 3 creates `packages/core/src/domain/event-projection.ts` and declares `packages/core/src/domain/index.ts`, but the module is not reachable from the package root. `@delivery-os/core` exposes only `.`, `./contracts`, `./state`, `./branding`, `./provider` (`packages/core/package.json` `exports`), and `scripts/checks/workspace-entrypoints.ts:30-36` allows `@delivery-os/core` subpaths `[".", "./contracts", "./state", "./branding", "./provider"]` only. `packages/core/src/index.ts:842` closes a **hand-listed** `export { … } from "./domain/index.js"` (no `export *`), so adding a name to `domain/index.ts` alone changes nothing public.

Phase 7 says "the composition takes the view once and hands the same view to the snapshot projection … and to the event projection" — the composition is `createWatchState`/`stateChanges` in `packages/cli/src/daemon-compose.ts`, which imports core through the root (`daemon-compose.ts:22-36`). Under that shape the CLI must import the projection from `@delivery-os/core`, which requires editing `packages/core/src/index.ts`'s explicit list. That file appears in **no** phase's `scope.files`. This is the RF-1 defect class: the commit primitive stages only declared phase scope, so the export cannot legally land where `pnpm typecheck` first demands it (the Phase 4 gate).

**Remediation:** pin the projection's call site in the plan and, if it is the CLI composition, declare `packages/core/src/index.ts` in Phase 3 (or the phase that first consumes it) and add the export-allowance/inventory rows if the guards require them. If the projection is instead invoked inside `packages/core/src/app/control-server.ts`, say so explicitly and state that no root export is added; then the view-taking option is the only new seam and `control-server.ts` is already in scope.

**Reopen:** `delivery_planning` (+ `test_planning` if TC-EVT-006/063's single-source scan expects the root import).

### RF-12 [major] — the test plan says the help-coverage suite needs no assertion edit, but it hard-codes the 18-command list

**Artifacts:** test plan §7 role table (`:1729`) and TC-EVT-062 row (`:1710`); plan Phase 5 scope (`:525`) and MOUNT EDIT SET (`:134-157`); spec §8.5 (`:437`).

**Gap:** `tests/behaviour/entrypoint-help-coverage.test.ts:147-171` asserts `[...coverage.commands].sort()` equals an inline array of exactly the delivered 18 names. Phase 5 adds `events` to `tests/fixtures/help-guide/coverage.json` (`plan.yaml:532`), so the inline list must gain `events` or the test fails. The test plan's §7 says the opposite: "**No assertion edit**: its coverage-fixture assertion (`coverage.commands` equals `PROMPT_REQUIRED_COMMANDS`) runs green once the Phase-5 fixture row lands." The spec already names the edit ("The prompt-required command enumeration in the help-coverage suite (18 → 19)", `spec.md:437`), and the plan declares the file in Phase 5 scope, but its MOUNT EDIT SET does not name the list.

**Why it matters:** the test plan is the executor's map of which delivered suites may be touched; a false "no edit" invites a red Phase-5 gate and an unnecessary escalation ("a delivered suite needs a semantic assertion change outside the mount rows"). The correct role is a mount row.

**Remediation:** change the §7 role to "Edited: the inline prompt-required name list gains `events` (19)" and add it to the plan's MOUNT EDIT SET and Phase-5 goal list.

**Reopen:** `test_planning`, `delivery_planning`.

### RF-13 [major] — the M2 page reconciliation omits two content items spec §16 requires, and no gate would notice

**Artifacts:** spec §16 (`:570`), plan Phase 5 goal (`:479-485`), the page `doc/planning/oss-tooling/milestones/m2/commands/events.md` (`:3,32-33,54-56`).

**Gap:** spec §16 pins the page's reconciliation content: "… the reference-record key set (`shape`, `frame`, `kinds[]` records, `lane`, `ordering`, `overflow`), … and a `Delivered (M2-S13)` status line." The plan's Phase 5 enumeration names the counts, `kinds: []`, the shape split, `emitted`, overflow carriage, ordering/restart sentences, the S17 path, and `--help`/`--version` — but not the record key set and not the status line. The page today still advertises the old `topics[]` key set (`name, version, kinds[], payloadFields[], ordering, overflow` — no `shape`, `frame`, `lane`, per-kind `emitted`) and says "Status: Proposed (M2)" / "not yet registered at the root listing". None of the Phase-5/6 guards reads those statements: TC-EVT-002 scans counts and S17 names, TC-EVT-062 checks page existence/`--help`/`--version`, and reference-page parity checks the see-also. So a public contract page can ship describing a surface that does not exist.

**Remediation:** add "the reference-record key set (`shape`, `frame`, `lane`, per-kind `emitted`)" and "a `Delivered (M2-S13)` status line replacing `Proposed` / not-yet-registered" to the Phase 5 goal (or to Phase 8's "keeps it true" list, which already owns the folder).

**Reopen:** `delivery_planning`.

## New advisory findings

| ID | Severity | Finding | Reopen |
|---|---|---|---|
| A-9 | minor | DM-9's watermark identity is per **record** (`key` + position in the view), but the `phase.state` source family is a cumulative artifact payload: `appendPhaseTransition` writes the whole verified history in each record (`state/registry.ts:401-404,445-459`). A same-tick burst of more than the 64-event cap within one change therefore needs a position *inside* an artifact's transition array, which DM-9 does not declare. The natural diff is derivable, but the bound should say so (or state that one artifact carries one transition). | specification, test_planning |
| A-10 | minor | TC-EVT-002 step 5 scans "the taxonomy section" of the M2 page for the absence of `stop`/`parked`/`resumed`/`park-edge`, while spec §16 requires the page to move that prose to the "S17 extension path" (still on the page). Pin the scanned section (e.g. the `TOPICS`/`KINDS` table only) or exclude the extension subsection by name, so the required prose cannot trip the scan. | test_planning |
| A-11 | minor | TC-EVT-081 step 4's "a source scan finds no `readRecords()` call outside the one composition seam" cannot be repo-wide: dozens of delivered modules legitimately call it (`state/audit.ts`, `state/*.ts`, `app/daemon.ts`, …). Scope the scan to the participating fold modules / publish path, and allow the additive `view ?? store.readRecords()` fallback that keeps every existing caller compiling. | test_planning |
| A-12 | minor | `pm-notes.yaml:29` still says "the planning page is reconciled in phase 7". It is Phase 5 in every other artifact, and Phase 7 is now the shared read. | `@pm` (`pm-notes`) |
| A-13 | minor | Two stale-tense/phase references: spec §15 (`:540`) says two TDR statements "diverge … and are amended … at the review" although the record is already amended in place; test plan §2 (`:65`) calls DC-1/DC-3/DC-4/DC-5 "consumed as written" while DC-4/DC-5 were amended too; test plan §7 rows for TC-EVT-072 (`:1350,1715`) say the result-contract page is updated in "phase 7" while the plan edits its table in Phase 1 and its prose in Phase 8. | specification, test_planning |
| A-14 | nit | "Seven-field envelope" (TDR summary/DC-2, spec Purpose `:56`) vs "eight fields" (spec F-2/DM-2/glossary). **Judged not a defect:** the seven are the change fields (`topic, kind, lane, ref, sequence, occurredAt, payload`) and the eighth is the `taxonomyVersion` stamp; DM-2 (`:416`) states both counts explicitly and every AC/test names eight. Only a one-line convention note would remove the ambiguity. | — |
| A-15 | nit | The plan's TC-map note names three "suite halves proven before their owner" but omits TC-EVT-004, whose integrity half runs in the Phase-1 gate (`:240`) and whose owner is Phase 2. Update the note or accept it as implicit. | delivery_planning |
| A-16 | nit | Phase 5 declares `tests/behaviour/entrypoint-help.test.ts` (`:526`) while its role says "no edit required". Harmless (a declared-but-unchanged file), but A-8's scope/gate-agreement rule suggests dropping it or marking it a control. | delivery_planning |
| A-17 | nit | The spec's cost story says `readChangeTransitions` "would be one whole-store read per change" (`:456`); the delivered function performs **two** store reads per call (`state/registry.ts:292` `store.read` and `:303` `createArtifactBoundary(...).read()`, which calls `store.readRecords()`). This strengthens DEC-N but understates the delivered cost; correct the sentence if it is cited as evidence. | specification |

## Pressure-test answers

1. **NFR-2 / AC-NFR-2 / DEC-N over the delivered `StateStorePort`.** Implementable in principle without widening the port: `readRecords()` returns every verified record in sequence order, and the phase-transition "artifact" read is itself a filter over the same view (`state/artifact-boundary.ts:111`), so one view can feed both projections. Two things are not yet implementable as written rather than as intended: the **measured interval** (RF-10) and the **public export** the CLI composition needs (RF-11). No new port method is required; an additive `view?` parameter on the folds is enough and keeps every existing caller compiling.
2. **Acceptance → refusal (DEC-L).** Correctly declared as a behaviour change with its compatibility consequence in §2.1, §2.2, §8.5, §18, DEC-L, RSK-10, AC-F8-1, TC-EVT-075, TDR DC-4/customer_impact/revisit/Amendments. No artifact still frames it as an identity rename. Closed.
3. **`kinds: []` vs the reference-surface grammar and the `events.md` page.** The grammar and the `events list` golden are consistent (`kinds=0` on snapshot topics; the machine record carries an empty `kinds[]`). Phase 5's reconciliation **is sufficient for TC-EVT-002 step 5's count assertion** (`0/0/4/3/3/3`) and TC-EVT-032's restart/repoll scan, provided the S17 prose sits outside the scanned section (A-10). It is **not sufficient** for the page's required key set and delivered-status line (RF-13), which no test reads.
4. **TDR-0025 amendment.** No DC contradicts spec v1.1: DC-1 names the mount phase (plan 5); DC-2 carries non-null `lane`, per-topic `ref`, source-record `occurredAt`, and the process-scoped `sequence`; DC-3 keeps the delivered overflow and the single constant; DC-4 carries the shape split, empty `kinds[]`, the record key set, and the acceptance→refusal with its compatibility note; DC-5 pins nullability and the version boundary. The "seven-field vs eight-field" flag is a **counting convention, not a defect**: seven change fields + the `taxonomyVersion` stamp = the eight `data` fields, and DM-2 states both. Only the terminology is worth a note (A-14).

## Verified sound (do not re-litigate)

- **Ticket coverage.** All three ticket ACs plus the delivery conventions are mapped in Appendix A and tested; the ticket body re-read this round matches the spec's sources.
- **45-TC ↔ 8-phase map.** Programmatic check: the plan's Phase 1/2/4/5/6/7 rows hold 45 distinct TC ids (8 + 9 + 9 + 5 + 13 + 1), each once; the test plan's index holds the same 45; no id is missing or extra. Phase 3 and Phase 8 own none, as declared.
- **Renumbering.** Phase 7 = shared read, Phase 8 = docs/decision/changeset. Every cross-reference checked (plan header, Phase comments, spec §9/§18, TDR DC-1/Implementation Plan item 6, test plan §2/§7) points at the right phase; only `pm-notes:29` is stale (A-12).
- **Plan validates.** `delivery-os plan validate GH-290` → `verdict: valid`, `readyForDevelopment: true`, 8 phases, done-artifact slots on the final phase.
- **RF-1's counts.** 18/18/17 verified at the exact lines, and the 124/123 → 127/126 error-table claim is real (`error-table.test.ts:802,878,1112` = 124; `:1805` = 123).
- **Mount edit set is otherwise complete.** `help-guide-coverage.ts:34-40` has no hard-coded count and needs only the `events` page-root row (declared); `reference-page-parity.test.ts:14-22` has its own map and needs the same row (declared); `coverage.json` is 18 commands / 22 pages; `entrypoint-composition.test.ts` has an `EXPECTED` list (declared); `entrypoint-help.test.ts` and `doc-conformance.test.ts` genuinely need no edit (their hand lists omit `events` by precedent).
- **`events.md` page state.** Counts 4/3/6/4 today, no `--help`/`--version`, old key table — all Phase-5 work; the page is in Phase 5 scope.
- **Regressions checked and clean:** no `snapshot` kind residue, no `parkCause` residue, no `truncated` path, no nullable-`lane` residue, no "consumed unchanged" claim, no `queue.park` consumption, no `daemon.state-recovery-failed` used for a topic refusal, and `daemon.ts:22` is the correct citation.
- **Decision capture.** TDR-0025 is untracked and staged only by Phase 8 (correct for the commit primitive); its index row is already committed; status stays `Proposed` with owner acceptance at the PR, which is the right treatment for an R2 record.

## Reopen routing

| Phase | Findings |
|---|---|
| `specification` | RF-10, A-9, A-13, A-17 |
| `test_planning` | RF-10 (TC-EVT-081 interval/baseline), RF-12, A-9, A-10, A-11, A-13 |
| `delivery_planning` | RF-11, RF-12 (MOUNT EDIT SET), RF-13, A-15, A-16 |
| `@pm` (`pm-notes`) | A-12 |
| TDR-0025 | none — iteration-1 amendment (RF-2/RF-3/RF-7/RF-8/A-3/A-6) verified closed |

No finding targets `delivery`.
