# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-180 (M0-S11 — db session-admin port)
Date: 2026-10-31
Pause Required: no

Artifacts reviewed: `chg-GH-180-spec.md` v1.4 (18 ACs), `chg-GH-180-test-plan.md` v1.3
(38 TCs), `chg-GH-180-plan.md` v1.2 (42 tasks, 5 phases, 38/38 TCs), `chg-GH-180-pm-notes.yaml`,
`readiness-review/readiness-iter-1.md`, the ticket context and recorded PM fallback, current
`doc/spec/**` and `doc/decisions/**`, the actual repository gate code, and a read-only check of the
reference opencode store. No source, test, spec, test-plan, plan, or pm-notes file was modified; only
this record was written.

Mechanical counts re-verified: 18 `AC-D*`, 38 `TC-DB-*`, 38/38 TCs mapped in the plan, 5 phase
headings, 42 `- [ ] **N.M**` tasks, 18/18 ACs referenced by the test plan, 0 orphan TCs. No retired
`db.reboot.live-session` spelling remains.

## Facet Summary

| # | Facet | Result |
|---|---|---|
| 1 | spec_completeness | FAIL (`archived` derivation and `dataBytes` byte semantics are unpinned; B4/M1/M2/M3/m1/m2/m4/m8 are closed) |
| 2 | ac_quality | PASS (18 ACs testable and non-overlapping; AC-D18 has an automated in-tree half plus a PR-body half) |
| 3 | plan_coverage | FAIL (B6 repeated-flag contradiction; M8 error-table-sync literal gap) |
| 4 | test_traceability | PASS (18/18 ACs and 38/38 TCs traced, 0 orphans; B5/M4 closure verified) |
| 5 | cross_artifact_consistency | FAIL (B6, M9, M11, m10) |
| 6 | decision_capture | PASS (change decisions in spec/PM notes; ADR-0003 reconciliation/decision proposal is a named phase-7 handoff) |
| 7 | system_spec_consistency | FAIL (M9 store-pin contradiction with `feature-autonomous-delivery.md` and `scripts/pm-liveness.sh`) |
| 8 | plan_doc_update_coverage | FAIL (M9 phase-7 doc list omits `feature-autonomous-delivery.md`) |
| 9 | plan_code_area_coverage | FAIL (M8, M11) |
| 10 | dod_defined | PASS (change-level DoD and per-AC DoD predicates exist) |

## Iteration-1 Remediation Verification

Closed as requested:

- **B1 closed.** Spec/test-plan/plan now permit the additive `tests/structure/error-table.test.ts`
  edits (31 → 35, `db` in the declared-kind prose, `db` row/kind-only assertions). The plan keeps
  `scripts/checks/error-table-sync.ts` unchanged and does not widen the format (PIN-11/D11; plan
  `:344`, spec `:377-384`).
- **B2 closed.** Per-phase `content-inventory` allowances are named for `contracts/session.ts`,
  `domain/session-admin.ts`, `adapters/session/index.ts`, `cli/src/commands/db.ts`,
  `commands/index.ts`, and `edge.ts`; `cli/src/commands/db.ts` registers in `inventory.json` in Phase 4;
  Phase 5 verifies only (PIN-10, D8; plan `:200-214`, tasks 1.2/1.3/2.2/4.1/4.2).
- **B3 closed.** `tests/fixtures/ports/v1-contract-inventory.json` is updated in Phase 1 with the
  `session.ts` module entry and the `contracts/index.ts` re-exports (plan task 1.9 `:346`).
- **B4 closed.** Pre-land failure keeps `db.query.failed`/`db.opencode.unavailable`; post-land abort
  returns `db.delete.failed` with the normative
  `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"` summary
  (`attempted = landed + failed`); AC-D8 and TC-DB-022 assert it (spec `:164-166, :607-609`; test
  plan `:253`, `:1107`).
- **B5 closed.** Selection SQL predicates (cold, not-live, `NOT EXISTS` child, `ORDER BY ... time_updated`,
  `LIMIT`), `computeDbCutoffMs`/`computeDbLiveBoundaryMs` coupling, reboot live-count 15-minute
  comparison, and a clock-shift flip are asserted (test plan `:209`, `:224`, `:242-245`, `:262-263`,
  `:356-357`, `:750`, `:813`, `:1335`, `:1343`).
- **M1 closed.** `list` is exactly two queries; `messageCount`/`partCount`/`dataBytes` derive from
  `message`/`part` in the page statement (spec `:134`, `:358`; test plan `:657`, `:1510`).
- **M2 closed.** Activity-based liveness is an explicit residual risk (RSK-D12) and an AC-D18
  owner-acceptance item (spec `:42`, `:156`, `:523`, `:648`).
- **M3 closed.** Checkpoint-only reboot is recorded as a deliberate deviation from the offered
  fallback and surfaced in AC-D18 (spec `:42`, `:179`, `:522`, `:648`).
- **M4 closed.** Mandatory non-CI read-only real-store smoke (`db size`, `db list --limit 5`) is in
  TC-DB-037 step 7 and plan task 5.4 (test plan `:1498-1505`; plan `:497`).
- **M5 closed.** ADR-0003 reconciliation/decision-record proposal for the mutating `SessionAdminPort`
  and the CLI command-registry row are in the Phase 7 handoff, owned by PM/`@decision-advisor` (plan
  task 5.8 `:501`).
- **M6 closed.** The defaults-position baseline repair is Phase 1 task 1.1; Phase 5 verifies only
  (plan `:334`, `:494`).
- **M7 closed.** The Phase 5 battery includes `changesets-group.ts`, `privacy-literals.ts`, and the
  full `ts-invariants` set, plus `ambient-globals.ts` and `forbidden-literals.ts` (plan task 5.7
  `:500`).
- **m1 closed.** The post-delete existence read and failure-path query bound are in §4.6 and the
  failure-path bound (spec `:361`, `:363`).
- **m2 closed.** Positionals 1–8 are handler `input.value.rejected`; the ninth and later are parser
  `fallback.invocation` (spec `:105`, AC-D12 `:617`; plan PIN-5 `:151-152`).
- **m3 closed in the spec and test plan** (last-wins; test plan G-12 `:322`, A-T3 `:329`) **but not in
  the plan** — see B6.
- **m4 closed.** The partial-failure summary is normative, not "for example" (spec `:164`, `:609`;
  test plan `:253`).
- **m5 partially closed.** GAP-T1 is marked resolved (test plan `:50`, `:1799`), but the v1.3
  `last_updated` is still `20:40Z` while PM notes record v1.3 at `22:35Z` — see m9.
- **m6 closed.** The plan no longer says "No gate is edited"; it says no gate is weakened or bypassed
  and lists the allowed additive test updates (plan `:573`).
- **m7 closed.** TC-DB-006 now asserts the recorded SQL names `message` and `part` (test plan
  `:594`, `:603`).
- **m8 closed.** The external opencode surface is RSK-D5 and AC-D18(c) (spec `:516`, `:648`).
- **n1 closed.** TC-DB-037's AC column includes NFR-D4 (test plan `:268`).
- **n2 closed.** §4.7 pins the exact remediation-hint strings matching the plan's rows (spec
  `:377-384`; plan `:338-341`).
- **n3 (process nit, GH-180 labels)** remains a PM/PR action, not an artifact defect.

## Findings

### Blocker

**B6 — [blocker] cross_artifact_consistency / plan_coverage — `chg-GH-180-plan.md` PIN-5 item 5
(`:161`), Phase 4 task 4.3 (`:458`), RSK-P1 (`:591`), and Change-level DoD grammar invariant
(`:629`); versus `chg-GH-180-spec.md` §3.1 (`:109`) and `chg-GH-180-test-plan.md` G-12/A-T3
(`:322`, `:329`), TC-DB-023 step 5 (`:1107`).**
Gap: The plan still instructs the handler to reject repeated flags as `input.value.rejected`
(`--apply --apply`, `--limit 5 --limit 10`), and task 4.3 places G-12 in the rejection group
("G-01..G-05, G-07..G-13 → `input.value.rejected`"). The spec and the binding test plan say the
opposite: repeated same-flag occurrences are last-wins at the parser (`--apply --apply` is apply;
`--limit 5 --limit 10` is `limit 10`) and G-12 is an exit-0 acceptance case. The plan was not updated
for iteration-1 m3; a coder following the plan would implement rejection and fail TC-DB-023/AC-D12.
Remediation target: `delivery_planning`.
Suggested fix: Update PIN-5 item 5, task 4.3's matrix grouping, RSK-P1, and the Change-level DoD/
Execution Notes to last-wins; keep `prune --apply false` (G-11) as a rejection. Do not change the
spec or test plan.

### Major

**M8 — [major] plan_code_area_coverage / cross_artifact_consistency — `chg-GH-180-plan.md` Phase 1
task 1.7 (`:344`) and File Layout (`:269`); `tests/checks/error-table-sync.test.ts:396-401,481-486,955-960`.**
Gap: Adding `"db"` to `DOMAIN_KINDS` changes the source literal that three existing temp-copy
controls replace exactly ("removing state/lint/verify from DOMAIN_KINDS"). Those substitutions will
no longer match, so all three tests fail and Phase 1's stated gate (the 8-suite run at plan `:368`)
is red. The plan says "db drift controls ... with unchanged controls" and never names the three
literal updates. This is the same mechanical class as iteration-1 B1, in the sibling sync suite.
Remediation target: `delivery_planning`.
Suggested fix: Add an explicit Phase 1 instruction to update the three `DOMAIN_KINDS` replacement
literals in `tests/checks/error-table-sync.test.ts` to the new seven-kind array (assertions otherwise
unchanged) and to add the `db` machine-only and doc-only drift controls. Keep
`scripts/checks/error-table-sync.ts` unchanged.

**M9 — [major] system_spec_consistency / plan_doc_update_coverage — `chg-GH-180-spec.md` §3.2/§3.3/
§4.6/§9.2/§12 (`:124-126`, `:134`, `:359`, `:524`, `:556`), plan Phase 5 task 5.8 (`:501`), PM notes
live facts (`chg-GH-180-pm-notes.yaml:45`); `doc/spec/features/feature-autonomous-delivery.md:12,53,113,156`;
`scripts/pm-liveness.sh:11,181,193`.**
Gap: The new store pin (`message`/`part` are current; `session_message` is empty/legacy) contradicts
the current system spec and the liveness script, which describe and query `session_message` as the
current message table. A read-only check of the reference store on this host confirms the spec pin —
`session_message` 0, `message` 213,235, `part` 961,085, `session` 6,978 — so the system spec is stale,
but the plan's phase-7 reconciliation list omits `feature-autonomous-delivery.md`, and the PM notes'
live-facts block never records the `session_message`=0 fact that v1.4 relies on. This is silent drift
from the current documented behavior/contract, and the liveness script remains a separate live
inconsistency that should be surfaced rather than silently inherited.
Remediation target: `delivery_planning` (doc/handoff list) and `specification` (record the live
fact).
Suggested fix: Add `feature-autonomous-delivery.md` (plus a note that `scripts/pm-liveness.sh` still
queries `session_message`, as a separate follow-up) to the phase-7 reconciliation/handoff; record the
verified `session_message`/`message`/`part`/`session` row counts in the PM notes or evidence so the
v1.4 pin is traceable. If the owner decides the liveness spec is out of scope, record that decision
explicitly.

**M10 — [major] spec_completeness — `chg-GH-180-spec.md` §3.3 item shape (`:138`, `:190`) and §4.6
read set (`:356-359`); `chg-GH-180-plan.md` task 2.3 (`:384`); `chg-GH-180-test-plan.md`
TC-DB-008 (`:239`, `:656`).**
Gap: `archived` is a required per-item field, but its source column and semantics are never pinned.
The reference schema has `session.time_archived` (there is no `archived` column); a coder could emit a
non-existent column and only the mandatory non-CI real-store smoke would catch it. `createdAt` and
`updatedAt` are likewise implied but not mapped to `time_created`/`time_updated`.
Remediation target: `specification`.
Suggested fix: Pin `archived = time_archived IS NOT NULL` (or the chosen semantics),
`createdAt = time_created`, and `updatedAt = time_updated` in §3.3/§4.6 and TC-DB-008; add the
mapping to the page SQL description.

**M11 — [major] cross_artifact_consistency / test_traceability — `chg-GH-180-plan.md` File Layout
(`:268`), Phase 1 task 1.6 (`:343`), traceability table (`:289`); `chg-GH-180-test-plan.md`
TC-DB-005 (`:236`, `:545`, `:1641`) and A-T7 (`:1785`).**
Gap: The plan declares `tests/behaviour/error-classification.test.ts` "Consumed, unchanged; the db
assertions live in the new contract test", while the binding test plan names
`tests/behaviour/error-classification.test.ts` (update) as TC-DB-005's target and A-T7 says that suite
is extended with `db` cases. The plan's own traceability table says TC-DB-005's suite is
`error-classification.test.ts`, contradicting its File Layout/task 1.6. The same placement ambiguity
exists for TC-DB-003 (new contract test versus `tests/structure/error-table.test.ts`).
Remediation target: `delivery_planning`.
Suggested fix: Choose one home for the TC-DB-003/005 assertions and make the plan's File Layout, task
1.6, and traceability table agree; either extend `error-classification.test.ts` with the `db` cases
and keep the new contract test for TC-DB-001/TC-DB-038, or amend the test plan's suite mapping and
A-T7. Do not leave both claims in place.

### Minor

**m9 — [minor] test_traceability / cross_artifact_consistency — `chg-GH-180-test-plan.md`
frontmatter `last_updated` (`:5`) and revision log 1.3 (`:1813`); `chg-GH-180-pm-notes.yaml:9`
(`reopened_3_completed: 2026-10-31T22:35:00Z`).**
Gap: Iteration-1 m5 asked to align timestamps. GAP-T1 is now resolved, but the v1.3 remediation is
still stamped `20:40Z` while PM notes record it at `22:35Z`; the revision log's claim to be aligned
is therefore inaccurate.
Remediation target: `test_planning`.
Suggested fix: Set `last_updated` and the 1.3 log row to the actual v1.3 time (or the commit time).

**m10 — [minor] cross_artifact_consistency — `chg-GH-180-plan.md` PIN-10 (`:214`) and task 4.7
(`:462`); `tests/structure/cli-edge-seam.test.ts:415-418`.**
Gap: The human-text declarer assertion builds sorted full paths
(`packages/cli/src/commands/db.ts`, then `packages/cli/src/commands/status.ts`). The plan's exact
literal `["commands/status.ts", "commands/db.ts"]` has the wrong order and prefix; copying it
verbatim into `toEqual` fails.
Remediation target: `delivery_planning`.
Suggested fix: State the exact sorted full-path pair, or say "in `listTypeScriptFiles` sort order".

**m11 — [minor] spec_completeness — `chg-GH-180-spec.md` §3.3 (`:134`, `:140`) and §4.6 (`:358`);
`chg-GH-180-plan.md` task 2.3 (`:384`); `chg-GH-180-test-plan.md` TC-DB-008 (`:656`, `:665`).**
Gap: `dataBytes` is computed with `LENGTH(message.data)` / `LENGTH(part.data)`. In SQLite,
`LENGTH(text)` counts characters, not bytes, so a field named `dataBytes` under-reports UTF-8 payload
bytes. AC-D2 does not assert exact values, so CI will not catch it; it is a truthfulness/precision
gap in an advisory field.
Remediation target: `specification`.
Suggested fix: Use `LENGTH(CAST(data AS BLOB))`/`OCTET_LENGTH` and keep the bytes name, or define
`dataBytes` as a character length and rename/annotate it; align TC-DB-008.

## Gate Result

- Verdict: **NOT_READY** — delivery is blocked.
- Pause: **no** — no human decision is required to proceed with remediation. The C-11 privacy
  sign-off and the fallback deviations (checkpoint-only reboot; activity-based liveness) remain owner
  merge-gate items at PR review, as recorded, and are not delivery blockers.
- Blocking finding: **B6** (repeated-flag contradiction). Additional majors: **M8** (Phase 1
  error-table-sync literal gap), **M9** (store-pin/system-spec drift and doc-list omission), **M10**
  (`archived` derivation), **M11** (TC-DB-005 placement). Minors: **m9**, **m10**, **m11**.
- Next remediation routing: `delivery_planning` (B6, M8, M9 doc list, M11, m10); `specification`
  (M9 live-fact record, M10, m11); `test_planning` (m9; M11 only if the test-plan suite mapping is
  changed). Re-run this gate after the revisions; cap at ~3 iterations and escalate if B6 persists.
- No implementation, dispatch, PR, merge, or artifact edit was performed. Only this record was
  written.
