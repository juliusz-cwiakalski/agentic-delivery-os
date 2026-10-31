# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-180 (M0-S11 — db session-admin port)
Date: 2026-10-31
Pause Required: no

Artifacts reviewed: `chg-GH-180-spec.md` v1.2 (18 ACs), `chg-GH-180-test-plan.md` v1.2 (38 TCs),
`chg-GH-180-plan.md` v1.1 (5 phases, 39 tasks), `chg-GH-180-pm-notes.yaml`, GH-180 (body + the
2026-10-31 blocker comment), current system spec/decision docs, and the actual repository gate code.
No prior readiness record exists; this is iteration 1. No artifact was modified by this review.

## Facet Summary

| # | Facet | Result |
|---|---|---|
| 1 | spec_completeness | FAIL |
| 2 | ac_quality | PASS |
| 3 | plan_coverage | FAIL (38/38 TCs and 18/18 ACs mapped, but the ordered phase tasks cannot all reach a green gate as written — B2/B3/M6) |
| 4 | test_traceability | FAIL (18/18 ACs and 0 orphan TCs, but adapter-SQL non-vacuity and NFR-D4 evidence are incomplete — B5/M4) |
| 5 | cross_artifact_consistency | FAIL |
| 6 | decision_capture | FAIL |
| 7 | system_spec_consistency | FAIL |
| 8 | plan_doc_update_coverage | FAIL |
| 9 | plan_code_area_coverage | FAIL |
| 10 | dod_defined | PASS |

Counts verified mechanically: 18 `AC-D*`, 38 `TC-DB-*`, 38/38 TCs mapped to a phase, 5 phase headings,
39 `- [ ] **N.M**` tasks, zero retired `db.reboot.live-session` spellings in spec/test-plan/plan.
The four `db.*` identities all match the repository format `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$`
(`db.opencode.unavailable`, `db.query.failed`, `db.delete.failed`, `db.reboot.live`).

## Ticket-to-Spec Coverage and Fallback Assessment

The ticket asks for `size`, `list`, `prune`, `reboot`, bounded output, dry-run default, idempotent
re-runnable prune, and no deletion of a "live session lock". The spec maps these to F-D1..F-D4,
F-D6, AC-D3, AC-D6, AC-D4/AC-D7, and states the 15-minute live window, 30-day default, leaf-only
rule, `--apply` and the TOCTOU re-check. That coverage is materially present and the fallback is
internally consistent for surface, defaults, threshold, window, leaf-only and apply gating.

The missing inlined prototype is disclosed honestly (spec §1, OQ-D1, RSK-D11; PM notes decisions),
and the PM fallback is recorded. The prototype absence is therefore a resolved, recorded decision,
not itself a DoR blocker. Three residual risks nevertheless need explicit owner acceptance at PR
review, because they narrow or postpone what the ticket/fallback promised:

1. `reboot` does **not** restart the opencode process. The ticket's offered fallback says "reboot
   restarts the opencode process only when no live session is detected"; the spec makes reboot a
   single WAL checkpoint plus a manual-restart instruction (NG-D2, §3.5). Safer, but a visible
   behaviour deviation that is not labelled as a deviation from the fallback.
2. "Live" is defined only as `time_updated >= now - 15 min`. With `--older-than` floor 1 day the
   live check is unreachable (the spec admits this), so an open-but-idle session older than the
   threshold is a prune candidate. No PID or lock-file check exists; the ticket's "no live session
   lock is deleted" is satisfied only under this narrowed definition.
3. If the NFR-D4 reference measurement is recorded as "not run" (explicitly permitted by plan 5.4
   and test plan §6.5), no test ever executes the adapter SQL against the real opencode schema.
   A wrong table or predicate can pass the fake-IO suite.

## Findings

### Blockers

**B1 — [blocker] cross_artifact_consistency — `chg-GH-180-plan.md` PIN-11 / D11 / Phase 1 tasks 1.5–1.6 / File Layout; `tests/structure/error-table.test.ts:605-606,616`; `chg-GH-180-test-plan.md:191,490,1624,1760`.**
Gap: The plan claims `tests/structure/error-table.test.ts` stays byte-identical. It cannot. That
file asserts `ERROR_TABLE` has exactly 31 entries (`:616`) and asserts the documented prose contains
the exact string "`provider`, `input`, `config`, `state`, `lint`, and `verify`" (`:605-606`).
Adding `db` to `DOMAIN_KINDS`, four `db` rows (31 → 35), and `db` to the documented kind prose makes
both assertions red. Phase 1's own gate command includes this suite and expects 5/5 green (plan
`:351`), so Phase 1 cannot commit. The test plan already says this suite is "Existing – Update"
(`:191`, `:490`, `:1624`) and A-T7 says it is "extended, never weakened" (`:1760`); the plan's own
traceability table also names it as the TC-DB-003 suite (`:276`), contradicting its "unchanged"
claim (`:258`, `:345`).
Remediation target: `delivery_planning`.
Suggested fix: amend PIN-11/D11/Phase 1 to permit the additive edits to `tests/structure/error-table.test.ts`
(31 → 35, declared-kind prose, `db` row/containment assertions), or explicitly relocate TC-DB-003/005
to the new contract suite and amend test plan A-T7/§4.3/§7. Keep `scripts/checks/error-table-sync.ts`
unchanged; do not widen the error-code format.

**B2 — [blocker] plan_code_area_coverage — `chg-GH-180-plan.md` PIN-10 / Phase 5 task 5.2 / Phase 1 tasks 1.1–1.2 / Phase 2 task 2.2 / Phase 4 task 4.1; `tests/structure/content-inventory.test.ts:29-350,365,458`; `tests/structure/inventory.json`.**
Gap: Executable allowances are deferred to Phase 5 (`task 5.2`), but the executables land in
Phases 1, 2 and 4. `content-inventory` scans every inventory file and rejects any exported
`as const` variable or function without an exact per-file allowance (`VariableStatement` is not in
`ALLOWED_TYPES_ONLY` at `:365`; test at `:458`). Consequently Phase 1 (`contracts/session.ts`,
`domain/session-admin.ts`) and Phase 2 (`adapters/session/index.ts`) `pnpm check` are red before
Phase 5; `cli/src/commands/db.ts` is only implied by the Phase 4 files list, not by a Phase 4 task.
Remediation target: `delivery_planning`.
Suggested fix: add each file's exact executable allowance in the phase that introduces it (Phase 1
contracts/domain, Phase 2 adapter, Phase 4 `db` command/edge), register `cli/src/commands/db.ts` in
`inventory.json` in Phase 4, and leave Phase 5 as verification only. List the exact constant/function
names in the plan, not just "the new constants".

**B3 — [blocker] plan_code_area_coverage — `chg-GH-180-plan.md` Phase 1 / File and Module Layout; `tests/structure/port-contract-inventory.test.ts:95,135`; `tests/fixtures/ports/v1-contract-inventory.json`.**
Gap: The plan never mentions `tests/fixtures/ports/v1-contract-inventory.json`. That fixture is the
exact contract-module/export inventory; `compareInventory` reports "unexpected contract module" for
the new `contracts/session.ts` and unexpected exports on `contracts/index.ts`. Phase 1 `pnpm check`
is therefore red.
Remediation target: `delivery_planning`.
Suggested fix: add the fixture update to Phase 1 and its files list: a `session.ts` module entry with
every exported name, plus the re-exported names added to the `index.ts` entry.

**B4 — [blocker] cross_artifact_consistency / spec_completeness — `chg-GH-180-spec.md` §3.4, §3.8, §4.7; `chg-GH-180-plan.md` PIN-4 and Phase 3 task 3.2; `chg-GH-180-test-plan.md` TC-DB-022.**
Gap: A mid-run `db.query.failed` after one or more deletes landed aborts the run and returns
`db.query.failed` with consequence `not_landed` and no landed-count truth. The spec defines
`not_landed` as an aggregate partial-prune statement only for `db.delete.failed` and says the per-row
truth is carried in the bounded summary (§3.8); PIN-4/TC-DB-022 encode an abort after the first delete
landed with no such summary. The operator would be told "not landed" when rows were deleted,
contradicting NFR-D10 truthfulness and the spec's own aggregate statement.
Remediation target: `specification`.
Suggested fix: define abort-after-landed-delete semantics — include landed/failed counts and the first
identity in a bounded partial-abort summary, or restrict `db.query.failed` abort to selection-time only
and treat a mid-run re-read failure as a counted skip/failure with partial truth — then add an AC/TC
assertion and update PIN-4/TC-DB-022.

**B5 — [blocker] test_traceability — `chg-GH-180-test-plan.md` §4.1, TC-DB-011..014, TC-DB-031..032, TC-DB-037; `chg-GH-180-plan.md` PIN-7/D5.**
Gap: The fake IO "never interprets SQL semantically" (§4.1), so adapter SQL correctness must be
asserted textually or structurally. The suite asserts the re-read SQL text (TC-DB-018) but not the
prune selection SQL, and not the reboot live-count SQL. A selection query missing cold/live predicates
or a reboot live-count query using the wrong window still passes the scripted fake (it returns the
same rows/count), so AC-D4 and AC-D10 are not actually verified at the adapter boundary. The
safety-critical reboot gate is unverified for window/inclusivity and injected-clock use.
Remediation target: `test_planning`.
Suggested fix: add textual/structural assertions for the selection SQL (cold, not-live, `NOT EXISTS`
child, ORDER BY, LIMIT), assert the adapter uses `computeDbCutoffMs`/`computeDbLiveBoundaryMs` (or
assert the SQL carries the computed boundary), add a clock-shift reboot case, and assert the live-count
SQL carries the 15-minute comparison. Keep the SQL text delivery-bound but pin its predicates.

### Major

**M1 — [major] spec_completeness — `chg-GH-180-spec.md` §3.3, §4.6; `chg-GH-180-test-plan.md` TC-DB-008, TC-DB-037; `chg-GH-180-plan.md` PIN-3/PIN-7.**
Gap: Per-item `messageCount`, `partCount` and `dataBytes` are required, but the spec never says how
they are derived. TC-DB-037 requires `db list` to issue exactly two queries, so the page query must
carry correlated per-session aggregates; PIN-3/PIN-7 do not pin that, and a coder issuing per-session
queries fails TC-DB-037 while a page-only query cannot populate the fields.
Remediation target: `specification`.
Suggested fix: define the single-page aggregate (correlated subqueries/joins) and the exact
`dataBytes` column semantics; reflect it in PIN-7 and TC-DB-037.

**M2 — [major] spec_completeness — `chg-GH-180-spec.md` §3.4, §1; GH-180 AC "no live session lock is deleted"; `chg-GH-180-pm-notes.yaml` live-lock decision.**
Gap: The live definition is activity-based only, and the 1-day floor makes the live predicate
unreachable; an open-but-idle session older than the threshold can be pruned. The spec asserts "a live
session is never deleted" without stating this limitation or requiring owner acceptance.
Remediation target: `specification`.
Suggested fix: state the limitation as an explicit residual risk (activity-based liveness; no PID/lock
probe) and add it to the PR-body/C-11 owner acceptance, or add a real lock/PID check.

**M3 — [major] spec_completeness / cross_artifact_consistency — GH-180 blocker comment (offered fallback) vs `chg-GH-180-spec.md` NG-D2, §3.5, DEC-D5, AC-D18.**
Gap: The ticket's fallback says reboot restarts the opencode process when no live session is detected;
the spec delivers checkpoint-only plus a manual restart. The safer choice is defensible, but the
deviation from the owner's fallback is not recorded as a deviation.
Remediation target: `specification`.
Suggested fix: record the deviation explicitly (spec §1/§3.5/RSK-D11) and require the PR body (the
AC-D18 manual half) to surface it for owner acceptance.

**M4 — [major] test_traceability — `chg-GH-180-test-plan.md` GAP-T2, §6.5, TC-DB-037; `chg-GH-180-plan.md` Phase 5 tasks 5.4/5.6; `chg-GH-180-spec.md` NFR-D4.**
Gap: NFR-D4 is a stated requirement with latency thresholds, but latency is non-CI and the reference
measurement may be recorded "not run"; no real-schema smoke test is mandatory. The suite never executes
adapter SQL against the real store, so NFR-D4 is unverifiable and adapter SQL correctness is unproven.
Remediation target: `test_planning`.
Suggested fix: make a read-only real-store smoke test (`db size`, `db list`) mandatory before PR
(non-CI, recorded), or downgrade NFR-D4 to a non-gating target and obtain explicit owner acceptance
for shipping without it.

**M5 — [major] decision_capture / plan_doc_update_coverage — `chg-GH-180-spec.md` §4.1–§4.2, DEC-D4; `chg-GH-180-plan.md` Phase 5 task 5.8; `doc/decisions/ADR-0003-oss-monorepo-structure.md` DEC-6/C-11.**
Gap: The change adds a new public mutating `SessionAdminPort` on the published `adapters ./session`
subpath. ADR-0003 describes `SessionStore` as read-only/never a mutation path and makes the adapter
metadata guarantee a public API obligation; the decision is captured only in change docs (DEC-D4/PM
notes), and the phase-7 reconciliation list omits ADR-0003 (and the CLI command-registry delivery row
mentioned in PM notes).
Remediation target: `delivery_planning` (with `@decision-advisor` authoring).
Suggested fix: add an ADR-0003 reconciliation or a decision-record proposal for the mutating admin
port (semver/public-contract impact, C-11 gate) and add it plus the command-registry row to the
phase-7 doc list.

**M6 — [major] plan_coverage / plan executability — `chg-GH-180-plan.md` Phase 5 task 5.1 vs Phase 1–4 gates and D7; `chg-GH-180-spec.md` §7.3, AC-D17.**
Gap: The baseline repair is Phase 5, but every phase gate requires `pnpm check` exit 0. In a clean
checkout `tests/checks/config-default-positions.test.ts` is red until Phase 5, so Phases 1–4 cannot
pass their stated gate; the current worktree only passes because `tmp/tmpdir` already exists locally.
Remediation target: `delivery_planning`.
Suggested fix: move the scoped repair to Phase 1 (first task) so every phase gate is deterministic, or
state explicitly that phase gates run in the existing worktree and the clean-checkout proof is Phase 5.

**M7 — [major] plan_coverage — `chg-GH-180-plan.md` Phase 5 task 5.7; `chg-GH-180-test-plan.md` §7.3; `.github/workflows/ci.yml:237,246`.**
Gap: The evidence battery omits merge-blocking CI checks `changesets-group.ts` and
`privacy-literals.ts` (and other ts-invariants scripts). A green local `pnpm check` can still fail the
pushed branch's required CI.
Remediation target: `delivery_planning`.
Suggested fix: add `bun run scripts/checks/changesets-group.ts` and `privacy-literals.ts` to Phase 5's
battery and test plan §7.3, and record their results in the evidence.

### Minor

- **m1 [minor] spec_completeness — `chg-GH-180-spec.md` §4.6/NFR-D4; `chg-GH-180-plan.md` PIN-4.** The
  post-delete existence read (one per failed delete) is not in the spec's read-set list and its extra
  query is not reflected in the NFR-D4/TC-DB-037 failure-path bound. Remediation target: `specification`.
  Fix: add the bounded read and the failure-path query bound.
- **m2 [minor] cross_artifact_consistency — `chg-GH-180-plan.md` PIN-5; `chg-GH-180-spec.md` §3.1/AC-D12.**
  `positionals.max: 8` means a ninth unexpected positional becomes parser `fallback.invocation`, while
  the spec says any unexpected positional is `input.value.rejected`. Remediation target: `specification`.
  Fix: pin the bound/carve-out or handle arbitrarily many positionals in the handler.
- **m3 [minor] test_traceability — `chg-GH-180-test-plan.md` G-12 vs `chg-GH-180-spec.md` AC-D12/§3.8.**
  Repeated-flag rejection is asserted but not enumerated in AC-D12 or the §3.8 error row. Remediation
  target: `specification`. Fix: add it to AC-D12/§3.8 or state it is covered by the grammar umbrella.
- **m4 [minor] cross_artifact_consistency — `chg-GH-180-spec.md` §3.4 vs `chg-GH-180-test-plan.md` TC-DB-020/A-T4.**
  The spec says the partial-failure summary is "for example"; the test plan asserts an exact regex.
  Remediation target: `specification`. Fix: make the summary format normative or loosen the test to
  count + first identity.
- **m5 [minor] test_traceability — `chg-GH-180-test-plan.md` GAP-T1, frontmatter `last_updated`, revision log.**
  GAP-T1 says no plan exists (stale), and the v1.2 revision timestamp predates the PM-recorded rename
  window. Remediation target: `test_planning`. Fix: mark GAP-T1 resolved and align timestamps.
- **m6 [minor] plan_coverage — `chg-GH-180-plan.md` Constraints ("No gate is edited").** The plan does
  edit test suites (`error-table-sync.test.ts`, `cli-edge-seam.test.ts`, `config-default-positions.test.ts`,
  `content-inventory.test.ts`). Clarify that these are additive test updates, not gate weakening, to
  avoid a false compliance statement. Remediation target: `delivery_planning`.
- **m7 [minor] test_traceability — `chg-GH-180-test-plan.md` TC-DB-006 Notes vs Steps.** "The SQL text
  must name `session_message` and `part`" is only a note; make it an asserted step (or rely on
  TC-DB-037). Remediation target: `test_planning`.
- **m8 [minor] spec_completeness — `chg-GH-180-spec.md` §9.2/RSK-D5.** The external opencode surface
  (`db path`, `db "<SQL>" --format json`, `session delete`, WAL mode) is taken from recorded PM live
  facts and cannot be verified by repository tests; state this as a residual risk in the PR body.
  Remediation target: `specification`.

### Nits

- **n1 [nit] test_traceability — `chg-GH-180-test-plan.md` §5.1 TC-DB-037.** The AC column omits
  NFR-D4 even though §3.3 maps it; harmless but inconsistent.
- **n2 [nit] spec_completeness — `chg-GH-180-spec.md` §4.7 prose vs `chg-GH-180-plan.md` Phase 1.3.**
  The plan's remediation-hint strings are delivery-table data, not verbatim spec prose; the sync gate
  will enforce machine/doc equality, so keep both consistent.
- **n3 [nit] process (not an artifact defect) — GH-180 labels.** `blocked` and `human-input-needed`
  remain on the issue while delivery proceeds under the recorded resume; PM should annotate or remove
  them when the PR is opened.

## Gate Result

- Verdict: **NOT_READY** — delivery is blocked.
- Pause: **no** — no human decision is required to proceed with remediation; the C-11 sign-off and the
  fallback deviations remain owner merge-gate items at PR review.
- Next remediation routing: `delivery_planning` (B1, B2, B3, M5, M6, M7, m6);
  `specification` (B4, M1, M2, M3, m1, m2, m3, m4, m8); `test_planning` (B5, M4, m5, m7, n1).
- No implementation, PR, merge, or artifact edit was performed by this review. Only this record was
  written.
