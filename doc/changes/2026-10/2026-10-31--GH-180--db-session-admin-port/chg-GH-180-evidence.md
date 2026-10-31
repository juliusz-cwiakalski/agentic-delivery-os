---
id: chg-GH-180-evidence
status: Complete
created: 2026-10-31T23:55:00Z
last_updated: 2026-10-31T23:55:00Z
owners: [engineering]
service: delivery-os CLI session-database administration
labels: [change, evidence]
links:
  change_spec: ./chg-GH-180-spec.md
  test_plan: ./chg-GH-180-test-plan.md
  implementation_plan: ./chg-GH-180-plan.md
---

# DELIVERY EVIDENCE — GH-180: M0-S11: db session-admin port

## 1. Delivery summary

- Branch: `feat/GH-180/db-session-admin-port` (PR base `main-tools`).
- Delivery HEAD at Phase 5 start: `f339843`.
- Delivery model: Phases 1–5 executed in order; one Conventional Commit per phase.
- No pull request, push, merge, or owner-approval claim was made by the coder.

## 2. Per-phase commits

| Phase | Commit | Subject |
|---|---|---|
| 1 | `2426640` | `feat(GH-180): add session-admin contracts, pure policy, and synchronized db error rows` |
| 2 | `e7d6cd7` | `feat(GH-180): add opencode-backed session size and list with fake-IO fixtures` |
| 3 | `d850727` | `feat(GH-180): add leaf-only prune and guarded reboot administration with TOCTOU and partial-failure proofs` |
| 4 | `f339843` | `feat(GH-180): add db command and edge composition with grammar, output, privacy, and SQL-safety proofs` |
| 5 | (this evidence commit) | `test(GH-180): verify db surfaces, record real-store smoke and aggregate evidence` |

## 3. Focused and aggregate gate results

All commands were executed on the delivery tree; logs are under `.ai/local/` (git-ignored and never staged).

| Gate | Command | Result |
|---|---|---|
| Phase 1 contracts/error suites | `bun test tests/structure/session-admin-contract.test.ts tests/structure/session-admin-imports.test.ts tests/structure/error-table.test.ts tests/behaviour/error-classification.test.ts tests/checks/error-table-sync.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/content-inventory.test.ts tests/checks/config-default-positions.test.ts` | 8/8 suites, 157 pass, 0 fail |
| Error-table sync | `bun run scripts/checks/error-table-sync.ts` | exit 0; entries=35 documented=35; S1=50 S3=15 corpus=13 |
| Phase 2 suites | `bun test tests/behaviour/session-admin-size-list.test.ts tests/behaviour/session-admin-privacy.test.ts tests/structure/session-admin-imports.test.ts` | 3/3 suites, 41 pass, 0 fail |
| Boundaries and secret-read | `bun test tests/boundaries`; `bun run scripts/checks/secret-read-boundary.ts` | 132 pass, 0 fail; 102 production files clean, 4 allowlisted |
| Phase 3 suites | `bun test tests/behaviour/session-admin-prune.test.ts tests/behaviour/session-admin-reboot.test.ts tests/behaviour/session-admin-sql-safety.test.ts tests/structure/session-admin-imports.test.ts` | 4/4 suites, 54 pass, 0 fail |
| Phase 4 suites | `bun test tests/behaviour/session-admin-grammar.test.ts tests/behaviour/session-admin-output.test.ts tests/behaviour/session-admin-sql-safety.test.ts tests/behaviour/session-admin-privacy.test.ts tests/structure/cli-edge-seam.test.ts` | 5/5 suites, 73 pass, 0 fail |
| Nine session-admin suites | `bun test` over the nine named suites | 126 pass, 0 fail |
| Baseline repair | `bun test tests/checks/config-default-positions.test.ts` after removing `tmp/tmpdir` | 6 pass, 0 fail |
| Baseline mechanism proof | temp-root probe | absent parent throws `ENOENT`; two recursive `mkdirSync` calls succeed; two `mkdtempSync` calls succeed |
| All Bun tests | `bun test` | 1754 pass, 2 pre-existing skips, 0 fail (1756 tests, 158 files) |
| Aggregate gate | `pnpm check` | exit 0; same 1754 pass / 2 pre-existing skips / 0 fail |
| Boundaries | `pnpm run check:boundaries` | exit 0; 120 modules, 232 dependencies cruised; ambient/entrypoints/secret-read clean |
| CI invariants | 18 `scripts/checks/*.ts` scripts listed in `.github/workflows/ci.yml` plus `ambient-globals` and `forbidden-literals` | 18/18 exit 0 |
| Whitespace | `git diff --check` | exit 0 |
| Worktree before/after the battery | `git status --porcelain` | identical (no test writes); clean after the Phase 5 commit |

The two skips are pre-existing conditional `status-live` tests, not session-admin tests and not introduced by this change.

## 4. TC coverage (38/38)

| TC | Suite / artefact | Result |
|---|---|---|
| TC-DB-001 | `tests/structure/session-admin-contract.test.ts` | PASS |
| TC-DB-002 | `tests/structure/session-admin-imports.test.ts` + boundaries | PASS |
| TC-DB-003 | `tests/structure/error-table.test.ts` | PASS |
| TC-DB-004 | `tests/checks/error-table-sync.test.ts` | PASS |
| TC-DB-005 | `tests/behaviour/error-classification.test.ts` | PASS |
| TC-DB-006..009 | `tests/behaviour/session-admin-size-list.test.ts` | PASS |
| TC-DB-010 | `tests/behaviour/session-admin-privacy.test.ts` | PASS |
| TC-DB-011..022 | `tests/behaviour/session-admin-prune.test.ts` | PASS |
| TC-DB-023..025 | `tests/behaviour/session-admin-grammar.test.ts` + sql-safety | PASS |
| TC-DB-026..027 | `tests/behaviour/session-admin-sql-safety.test.ts` | PASS |
| TC-DB-028..030 | `tests/behaviour/session-admin-output.test.ts` + goldens | PASS |
| TC-DB-031..033 | `tests/behaviour/session-admin-reboot.test.ts` + output/imports | PASS |
| TC-DB-034 | `tests/structure/cli-edge-seam.test.ts` | PASS |
| TC-DB-035 | `tests/checks/config-default-positions.test.ts` (verified only) | PASS |
| TC-DB-036 | `tests/structure/session-admin-imports.test.ts` + privacy | PASS |
| TC-DB-037 | size-list/prune/reboot/contract bounded-work assertions | PASS for bounded work; reference latency measurement **not run** (non-CI) |
| TC-DB-038 | contract test automated half | PASS; PR-body half **deferred** (no PR created) |

## 5. Mandatory non-CI read-only real-store smoke (TC-DB-037)

- Environment: opencode `1.19.3`; real store resolved by `opencode db path` to an operator-local data directory (path intentionally not committed).
- Command: a one-off Bun script under `tmp/tmpdir/` (git-ignored) invoked the production `createOpencodeSessionIo` and `createSessionStore` against the real store, then ran `db size` and `db list --limit 5` semantics. The script was read-only: `size`/`list` call only `databasePath`, `stat`, and single-statement `SELECT` queries; no `deleteSession`, no `checkpoint`, no file write.
- Exit code: `0`.
- Bounded output:
  - `size`: database bytes 130,602,913,792; WAL bytes 19,854,312; SHM bytes 65,536; sessions 7,039; messages 216,390; parts 975,062; oldest/newest ISO timestamps present.
  - `list --limit 5`: limit 5; total 7,039; returned 5; omitted 7,034; truncated true; live 5; item keys exactly the nine metadata fields.
- Before/after no-mutation check: **PARTIAL, recorded honestly.** Sessions were unchanged at 7,039; WAL and SHM bytes were unchanged; no row deletion, checkpoint, or file truncation was observed. Messages and parts increased (216,388→216,406 and 975,048→975,132) and the database file grew because the reference host was concurrently live and writing. The adapter path exercised here issues no writes, and the in-process suite proves zero `deleteSession`/`checkpoint` calls for `size`/`list`. A byte-identical before/after snapshot is not achievable on an actively written store and is not claimed.
- This smoke is non-CI. It is not a latency assertion and not a merge gate.

## 6. Deferred / non-CI items

- NFR-D4 reference latency measurement: **not run** (non-CI; no shared-runner reference store).
- AC-D18 / TC-DB-038 PR-body half: **deferred**; no PR was created, pushed, or merged by the coder.
- The C-11 privacy sign-off remains an owner merge gate. No approval is claimed.

## 7. Deviations and plan corrections (recorded)

1. **Changeset timing.** The fixed-group minor changeset `.changeset/db-session-admin-minor.md` landed in Phase 2 instead of Phase 5 task 5.5. The pre-existing `privacy-release` gate fails as soon as `packages/**` changes without a changeset, so the early landing keeps every phase gate green. Phase 5 verifies it only.
2. **TC-DB-026 `x--y`.** The test plan's I-04 lists `x--y` as invalid, but the pinned `DB_SESSION_ID_PATTERN` (`^[A-Za-z0-9_-]+$`) admits it. The suite treats `x--y` as a valid control and keeps quotes, spaces, semicolons, newlines, comment markers, over-cap ids, and over-cap paths as invalid. No identity, shape, or AC changes.
3. **Baseline proof.** The Phase 1 repair intentionally changed no assertions (plan task 1.1). The absent-parent `ENOENT` and idempotent recursive-creation proof was executed as a temp-root probe in Phase 5 and recorded in §3; TC-DB-035 is verified, not edited.
4. **Live real-store snapshot.** As §5 records, the reference store was live; the no-mutation check is partial (no deletes/checkpoint/truncation, external inserts observed) rather than byte-identical.
5. **Skips.** The aggregate run has 2 pre-existing `status-live` skips; 0 failures. The plan's "0 skips" expectation is not met by unrelated conditional tests and was not changed.

## 8. Phase-7 system-spec and decision handoff (not executed here)

- Create `doc/spec/features/feature-session-database-admin.md`.
- Reconcile `doc/spec/features/feature-adapter-ports.md` (`SessionStore` implemented, `SessionAdminPort` added, `adapters ./session` no longer a stub), `feature-result-contract.md` remainder, `feature-monorepo-scaffold-toolchain.md`, and `doc/overview/glossary.md` (live window, live session, prune candidate, leaf session, session admin, `db` domain kind).
- Correct `doc/spec/features/feature-autonomous-delivery.md` (`:12`, `:53`, `:113`, `:156`) from `session_message` as the current store to `message` (messages) and `part` (parts), recording the verified reference facts: `session_message` 0; `message` ≈213k; `part` ≈961k (RSK-D14).
- Also flag `doc/guides/delivery-modes.md` in the same follow-up; it still describes `session_message`.
- Record the **ADR-0003 reconciliation or a new decision-record proposal for the mutating `SessionAdminPort`** (public-contract/semver impact, read-only `SessionStore` preserved, C-11 gate). Owner: PM/`@decision-advisor`; not a coder task.
- Add the CLI command-registry delivery row.
- `scripts/pm-liveness.sh` still queries `session_message`; it is **out of scope** (NG-D7) and is an owner follow-up.
- The ADR-0003 C-11 sign-off remains a required owner merge gate; no approval is claimed.

## 9. Rollback

- The change is additive except for the scoped test-environment baseline repair and the documented error-table rows. Revert the whole PR (or the phase commits) together; do not roll back one side of the error-table sync.
- Tests mutate only fakes/temp copies and never the real database, so no data cleanup is required.
- The fixed-group changeset and the four documented rows must be reverted together with the machine rows.

## 10. Handoff status

- No PR, push, merge, or owner-approval claim was made.
- Lifecycle phase 7 reconciliation and the ADR-0003 decision proposal are recorded as deferred handoffs in §8.
