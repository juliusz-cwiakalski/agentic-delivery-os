# Code Review Iteration 1 - GH-187

Verdict: PASS
Work Item: GH-187
Branch: feat/GH-187/license-registry-hardening
Base: origin/main-tools (c62cdb8)
Reviewed HEAD: 7819ea0
Merge base: c62cdb8
Mode: local
Date: 2026-10-31
Iteration: 1

## Verdict Summary

PASS. The license-registry hardening is correct, fail-closed, and complete against
the spec and the plan's delivery phases. The registry is schema v3 with the full
20-identifier / five-family mandatory floor; the audit enforces deny-before-allow for
every parsed branch, rejects absent, non-array, empty, malformed, duplicated,
overlapping, and family-stripped deny lists, treats `NOASSERTION`, `NONE`, and
`SEE LICENSE` as non-asserted, and keeps the live `MIT OR Apache-2.0` entry green. No
gate was weakened and no CI job, lockfile, or manifest changed.

All 15 acceptance criteria are satisfied and proven by passing tests. Every plan task
1.1 through 5.4 is delivered. Two non-blocking evidence gaps and six observations are
recorded below; none is a correctness or security blocker, but F-1 and F-2 should be
closed before the Definition-of-Done/PR phase.

## Dimension Verdicts

- A. Spec and plan compliance: PASS (with non-blocking evidence gaps F-1, F-2, F-5)
- B. Code correctness and security (fail-closed supply-chain control): PASS
- C. Test quality and determinism: PASS (matrix meta-check gap F-1)
- D. Repository conventions (.ai/rules/typescript.md, testing-strategy): PASS

## Finding Counts

- Blocker (critical/high): 0
- Minor (medium): 2 (F-1, F-2)
- Low: 3 (F-3, F-4, F-5)
- Info: 3 (F-6, F-7, F-8)
- Total: 8

## Acceptance Criteria Compliance

| AC | Result | Evidence |
|----|--------|----------|
| AC-F1-1 schema v3, scope, C-2, allow list, required deny list in one YAML | PASS | `loadRegistry` => schema 3, scope `direct-and-runtime-closure`, 16 entries, allow `[Apache-2.0, BSD-3-Clause, ISC, MIT]`, 20 deny ids; TC-LICREG-001/003 |
| AC-F1-2 five families and all 20 Appendix A ids present | PASS | Fixture counts 1/2/1/1/15 = 20; TC-LICREG-002, TC-LICREG-013 |
| AC-F1-3 old/absent schema and schema-v3 wrong scope fail closed naming observed value | PASS | `validateRegistryPolicy` reports observed value; TC-LICREG-004 (5 schema mutations), TC-LICREG-031 (5 scope mutations) |
| AC-F1-4 human-readable policy notes state the five claims | PASS | Registry header comments lines 8-13; TC-LICREG-005 |
| AC-F2-1 denied single identifier fails with explicit denial naming package and id | PASS | TC-LICREG-006 (20/20), TC-LICREG-010 |
| AC-F2-2 allow-listed/approved denied id: overlap reported and entry still fails | PASS | TC-LICREG-007, TC-LICREG-008; deny check precedes allow in `auditRegistry` |
| AC-F2-3 denied branch fails in OR, AND, nested forms | PASS | TC-LICREG-009 (7 compounds), TC-LICREG-010 (per-branch attribution) |
| AC-F3-1 absent/non-array/empty deny list fails closed | PASS | TC-LICREG-011 (7 presence cases) |
| AC-F3-2 non-string/empty/duplicate/compound/malformed deny entry fails closed | PASS | TC-LICREG-012 (18 malformed cases) |
| AC-F3-3 removing any Appendix A id fails closed | PASS | TC-LICREG-013 (20 single + 5 adversarial removals) |
| AC-F4-1 unregistered dependency/use fails closed | PASS | TC-LICREG-015, TC-LICREG-022 (spawned unregistered case) |
| AC-F4-2 empty/LicenseRef/NOASSERTION/SEE LICENSE/unparseable/non-allow-listed fail closed | PASS | TC-LICREG-016 (13 values), TC-LICREG-017 (7 guards) |
| AC-F5-1 ts-license-audit present, unmodified, binding, no bypass, invariants green | PASS | TC-LICREG-020/021; workflow byte-unchanged; topology/bindingness/supply-chain/surface exit 0 |
| AC-F5-2 suite covers all classes; live registry zero failures | PASS | 44 license tests pass; `validate(ROOT)` returns `[]`; TC-LICREG-023 |
| AC-F6-1 live `@biomejs/biome` `MIT OR Apache-2.0` passes | PASS | TC-LICREG-018, TC-LICREG-019; live audit `OK` |

Ticket acceptance criteria (Appendix B): unregistered license fails CI (F-4), denied
license fails CI (F-1/F-2/F-3), the five mandated families are enforced, the gate reads
the registry and fails closed on unknown, and the gate stays binding with no new job or
bypass — all satisfied.

## Plan Task Audit

- Checked and delivered: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4,
  4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4 — all corroborated by the diff and the gate
  runs below.
- OPEN_TASKS: 7.x (review, in progress) and 8.x (finalization) — expected at this
  phase.
- DONE_BUT_UNCHECKED: 6.1-6.5 (doc-sync completed in commit 7819ea0 and
  doc-sync-report.md, but the Phase 6 checkboxes and Execution Log row 6 still say
  pending) — F-5.
- CHECKED_BUT_MISSING: none.
- Plan Status: COMPLETE for delivery phases 1-5; finalization phases 6-8 outstanding.

## Checks Executed

| Check | Result |
|-------|--------|
| `git diff --stat origin/main-tools...HEAD` | 23 files; source change only `scripts/checks/license-audit.ts`; registry `doc/legal/dependency-licenses.yaml`; tests/fixtures; docs |
| `bun test tests/checks/license-*.test.ts tests/checks/privacy-release.test.ts` | PASS — 52 pass, 0 fail (44 license + 8 privacy) |
| `bun run scripts/checks/license-audit.ts` | PASS — `OK license-audit: ...`, exit 0 |
| `bun run scripts/checks/{ci-topology,ci-bindingness,ci-supply-chain,script-surface,pin-equality,vulnerability-gate}.ts` | PASS — all exit 0 |
| `pnpm typecheck` | PASS — all six packages plus type probes |
| `pnpm exec biome check` on changed TS sources/tests | 1 warning (unused `failuresForCase`, F-3), 1 info (style), no errors; `pnpm lint` gate remains green |
| `git diff --name-only ... -- .github pnpm-lock.yaml package.json 'packages/*/package.json' ADR-0003` | empty — no CI job, lockfile, manifest, or ADR-0003 change |
| `rg '^status:' doc/decisions/TDR-0007-...md` | `status: Proposed`; TDR last touched in 680dac7, not by doc-sync 7819ea0 |
| Front matter parse of glossary and feature spec | both parse; `related_changes` includes GH-187, `related_decisions` includes TDR-0007 |
| `rg 'test\.(skip|only|todo)' tests/checks/license-*.test.ts` | none |

## Base Repair Assessment (tests/checks/privacy-release.test.ts)

The enabling change replaces `expect([...new Set(added)]).toEqual([CHANGESET_PATH])`
with a base-relative `expectedAdded` (`[]` when the base already carries
`.changeset/gh-184-privacy-guards-minor.md`, else `[CHANGESET_PATH]`). This preserves
the original on-branch guarantee: on a base that lacks the changeset the branch must
add exactly it; on a base that already carries it the branch must add none. The guard
is not weakened — `nameStatus` still rejects any other added path and any
modified/deleted changeset, `preExistingViolations` still enforces byte identity, and a
missing `origin/main-tools` ref fails loudly rather than skipping. Acceptable as an
enabling fix (F-8), and it should be called out in the PR description.

## Findings

### F-1 [minor] TC-LICREG-024 does not implement test-plan step 4; 23 declared fixture cases are never executed

Location: `tests/checks/license-policy.test.ts:618` (and `tests/fixtures/license/deny-list-cases.json`)

The test plan's TC-LICREG-024 step 4 requires "the suite executes exactly the declared
cases ... the executed count equals the declared count". The delivered test checks
class-token membership, per-group minimum counts, total equality, and baseline removal
coverage, but never asserts that each declared case ran. Consequently the groups
`unknown-reference` (2), `empty` (2), `non-asserted` (2), `unparseable` (6),
`non-allow-listed` (7), `overlap` (3), and `extension-valid-policy` (1) — 23 cases —
are only counted, never driven through `applyPolicyCase`/`validate`. Their behaviours
are covered in `license-audit.test.ts` via `cases.json`, so this is not a product
coverage hole, but the "84-case matrix / non-vacuous" claim is overstated and RSK-P2
requires a test-plan revision for any such deviation. Suggested fix: drive every case
through one loop (the unused `failuresForCase` was likely intended for this) and assert
`executed === declared`, or trim the fixture and reconcile the counts and TC-LICREG-024.

### F-2 [minor] Test-plan section 10 execution log is still a placeholder

Location: `doc/changes/2026-10/2026-10-31--GH-187--license-registry-hardening/chg-GH-187-test-plan.md:1379`

Section 10 still reads "Not yet executed", while spec section 18.1 makes recording the
test execution evidence in the test plan section 10 log a Definition-of-Done predicate
and the plan Phase 5 records a green battery. Populate section 10 with the actual
results (or point to the plan Phase 5 evidence block as authoritative).

### F-3 [low] Unused helper `failuresForCase`

Location: `tests/checks/license-policy.test.ts:133`

`failuresForCase` is never referenced; Biome reports `noUnusedVariables`. Remove it or
use it to close F-1.

### F-4 [low] Unused fixture fields in cases.json

Location: `tests/fixtures/license/cases.json:19` (also lines 10 and 64)

`deniedSingles`, `unknownReferences`, and `blank` (duplicate of `empty`) are never read
by any test. Remove them or consume them, and extend the TC-LICREG-024 meta-check to
assert every declared fixture key is used.

### F-5 [low] Plan Phase 6 tasks/status are stale (DONE_BUT_UNCHECKED)

Location: `doc/changes/2026-10/2026-10-31--GH-187--license-registry-hardening/chg-GH-187-plan.md:393` (also Execution Log row 6 at line 619)

Doc-sync is complete (doc-sync-report.md SUCCESS, commit 7819ea0), but tasks 6.1-6.5
remain unchecked and Execution Log row 6 says "Pending". Tick the tasks and mark the
row Completed.

### F-6 [info] Policy validator early-returns before floor/overlap accumulation

Location: `scripts/checks/license-audit.ts:286`

Absent/non-array/empty deny lists return early, so floor and overlap failures are not
accumulated for those inputs. Plan task 1.2 says "accumulate"; the behaviour is still
fail-closed. Optional wording/observability nuance.

### F-7 [info] Overlap check compares raw allow_list strings, not parsed identifiers

Location: `scripts/checks/license-audit.ts:324`

Equivalent to identifier comparison under the enforced single-identifier allow contract
(TC-LICREG-001); a compound allow entry carrying a denied id still fails closed through
the entry-level deny check and drift check. Noted for future grammar changes only.

### F-8 [info] Enabling base repair and front-matter dedup reviewed and accepted

Location: `tests/checks/privacy-release.test.ts:109`

Both are outside the license product surface, are documented, and preserve their
original guarantees; no action required beyond PR description visibility.

## Notes

- The working tree has one uncommitted modification, `chg-GH-187-pm-notes.yaml`, which
  is @pm-owned and outside this review's committed scope; it was not modified here.
- TDR-0007 remains `Proposed` and unedited by doc-sync; ADR-0003 was not edited. The
  plan Phase 6 wording ("created in this change as Proposed; no further delivery/
  doc-sync edits") matches reality.
- No new CI job, no `continue-on-error`/`|| true`/`set +e`/`exit 0` bypass, no
  lockfile/manifest/workflow change, no `.changeset` entry, and no SBOM/notice/checksum
  artifact was introduced.

## Next Step

PROCEED. Close F-1 and F-2 before the DoD/PR phase, and optionally clean up F-3 through
F-5. No remediation of code behaviour is required for the review to pass.
