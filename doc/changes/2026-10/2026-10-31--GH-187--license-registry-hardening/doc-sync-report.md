---
id: GH-187-doc-sync-report
work_item: GH-187
phase: system_spec_update
status: Complete
created: 2026-10-31T00:00:00Z
last_updated: 2026-10-31T00:00:00Z
owners: [engineering]
links:
  change_spec: ./chg-GH-187-spec.md
  plan: ./chg-GH-187-plan.md
  test_plan: ./chg-GH-187-test-plan.md
  decisions: ../../../decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md
---

# Documentation Sync Report - GH-187

## Status

`SUCCESS` - current-truth documentation reconciled with the delivered license-registry hardening.

## Scope

Resolved context from `doc/changes/2026-10/2026-10-31--GH-187--license-registry-hardening/`: spec v1.4, plan v1.4, test plan v1.5, readiness iteration 3, TDR-0007, and the delivered diff `git diff origin/main-tools...HEAD -- doc/legal scripts/checks tests/checks .github`. Ground truth was read from the tree and the delivered files, not from the change prose alone.

Inspected current-truth surfaces:

- `doc/spec/features/feature-monorepo-scaffold-toolchain.md` (License registry section, CI coexistence, codebase map, QA strategy)
- `doc/spec/features/**` (all other feature specs referencing license policy or the license registry)
- `doc/overview/glossary.md`
- `doc/decisions/00-index.md`
- `doc/legal/dependency-licenses.yaml` (header policy comments and data)
- `doc/00-index.md`, `doc/quality/**`, `doc/guides/**`, `doc/contracts/**`, `doc/domain/**`, `doc/ops/**`, `doc/diagrams/**`
- `doc/documentation-handbook.md` and the `ados_distribution` guard contract (`scripts/.tests/test-doc-distribution.sh`)

## Reconciled files

| File | Change |
|------|--------|
| `doc/spec/features/feature-monorepo-scaffold-toolchain.md` | Rewrote the **License registry** section to describe schema v3, the required `deny_list` with the 20-identifier five-family floor, the four-identifier allow list, deny-before-allow precedence, allow/deny disjointness, the single-identifier grammar, the preserved `scope: direct-and-runtime-closure` check, the fail-closed non-asserted values, per-branch compound evaluation, and TDR-0007 as Proposed. Updated the codebase-map row, added a license-policy row to the QA strategy, and added GH-187 / TDR-0007 traceability. Deduplicated the duplicated `links` keys in the front matter while adding traceability. |
| `doc/overview/glossary.md` | Added **Deny list** and **License registry** terms, updated **Fail-closed audit** and **SPDX expression** to include denied identifiers and per-branch evaluation with TDR-0007, and added GH-187 / TDR-0007 traceability. Deduplicated the duplicated `links` and `summary` keys in the front matter while adding traceability. |
| `doc/changes/2026-10/2026-10-31--GH-187--license-registry-hardening/doc-sync-report.md` | This report. |

## Documentation gaps resolved

- **Stale license-registry description:** the feature spec described the registry as an allow-list-only verdict store and the audit as failing closed only on non-allow-listed branches. It now states the delivered deny list, precedence, integrity rules, floor, scope check, non-asserted handling, and compound interpretation.
- **Missing legal vocabulary:** the glossary had no deny-list or license-registry entry and described SPDX handling without denial or per-branch semantics. It now covers both, with a link to TDR-0007.
- **Invalid or ambiguous traceability front matter:** both reconciled documents carried duplicated `links`/`summary` keys (the glossary front matter did not parse as YAML). The duplicate keys were collapsed to one valid block that includes GH-187 and TDR-0007, so `links.related_changes` and `links.related_decisions` are machine-readable again.

## Spec coverage gaps

NONE. The modified area is already covered by `feature-monorepo-scaffold-toolchain.md`, so the existing spec was reconciled instead of re-authored. No other `doc/spec/features/*` file asserts an allow-list-only policy or a schema-v2 registry; `feature-config-layer.md` references the same registry and license audit and remains accurate. No feature-spec or test-spec gap was suppressed.

## Residual documentation gaps

NONE for GH-187. Current-truth documentation covers the delivered registry schema, deny list and precedence, scope check, non-asserted handling, compound evaluation, TDR-0007 status, and the unchanged single-gate CI model.

Out-of-scope observations (pre-existing on `origin/main-tools`, not introduced by GH-187, not edited by this sync):

- `doc/spec/features/feature-monorepo-scaffold-toolchain.md` still carries duplicated Overview paragraphs and duplicated codebase-map rows from an earlier merge; the license-related content is reconciled and unambiguous.
- `doc/overview/glossary.md` still carries a few duplicated term rows (for example `Domain kind` and `Empty-but-enforced`) from the same earlier merge; the license terms added by this sync are single, unambiguous rows.
- `doc/decisions/00-index.md` still has the pre-existing TDR-0005/TDR-0006 link-label swap noted by readiness iteration 3; the GH-187 TDR-0007 row is correct and its status is Proposed.

## TDR-0007 and ADR-0003 boundary

- TDR-0007 is documented as **Proposed**. The title and body state that it clarifies ADR-0003 C-2 as per-branch fail-closed evaluation and does not amend or supersede ADR-0003. No acceptance is claimed; the owner accepts or rejects at PR review.
- `doc/decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md` was not edited. `doc/decisions/ADR-0003-oss-monorepo-structure.md` was not edited; an ADR-0003 C-2 editorial cross-reference remains a separate owner-authorized change.

## Verified without change

| Surface | Finding |
|---------|---------|
| `doc/legal/dependency-licenses.yaml` | Header comments already state the five policy claims; `schema_version: 3`, `scope: direct-and-runtime-closure`, the 20-identifier `deny_list` (5/5 families), the unchanged four-identifier `allow_list`, and all 16 entries/uses/verdicts are present. `doc/legal/` contains exactly one file. |
| `doc/decisions/00-index.md` | The TDR-0007 row exists with status Proposed and a working link; no change required. |
| `doc/00-index.md` | Does not enumerate individual feature specs or the license registry; no stale reference. |
| `doc/quality/**` | The license policy test surface is documented on the feature spec's QA strategy; no test spec exists for the monorepo toolchain area and none was warranted. |
| `doc/spec/features/feature-config-layer.md` | Its references to the runtime-closure license registry and `tests/checks/license-audit.test.ts` remain accurate. |
| CI model | `.github/workflows/ci.yml` is unchanged; `ts-license-audit` remains the only license gate and no new job was added. The feature spec continues to state sixteen additive `ts-*` jobs. |
| Enabling base repair | The `tests/checks/privacy-release.test.ts` change is test-only enabling work, not license-policy product behaviour; no current-truth document describes it. |

## Validation

| Check | Result |
|-------|--------|
| `bash scripts/.tests/test-doc-distribution.sh` | `[OK] no drift — 81 in-scope docs; install set matches ados_distribution markers` (exit 0). |
| `rg -n 'deny_list\|deny.*allow\|deny.*over\|scope\|TDR-0007' doc/spec/features/feature-monorepo-scaffold-toolchain.md` | Matches present (deny list, precedence, scope, TDR-0007). |
| Front-matter parse (`yaml.safe_load` on both reconciled docs) | Both parse; `links.related_changes` includes `GH-187`; `links.related_decisions` includes `TDR-0007`. |
| `ls doc/legal` | Exactly `dependency-licenses.yaml`. |
| `bun run scripts/checks/license-audit.ts` | `OK license-audit: …` (exit 0). |
| `bun test tests/checks/license-` | 44 pass, 0 fail across 4 files. |
| `git diff --exit-code -- doc/decisions/ADR-0003-oss-monorepo-structure.md` | Exit 0 (not edited). |
| `rg -n '^status: Proposed' doc/decisions/TDR-0007-…md`; `git diff --exit-code -- doc/decisions/TDR-0007-…md` | Status Proposed; exit 0 (not edited). |
| `git diff --stat origin/main-tools...HEAD -- .github` | Empty (no CI job or workflow change). |
| Forbidden paths | No source code, test, fixture, pm-notes, spec, plan, test-plan, TDR-0007, or ADR-0003 file was modified. The pre-existing modification to `chg-GH-187-pm-notes.yaml` was present before this sync and was left untouched. |

## Constraints

- No git operations were performed and nothing was committed; the PM commits after review.
- No document outside `doc/00-index.md`, `doc/guides/**`, `doc/overview/**`, `doc/spec/**`, `doc/contracts/**`, `doc/domain/**`, `doc/quality/**`, `doc/ops/**`, `doc/diagrams/**`, `doc/decisions/**`, or the change folder was modified.
- No business docs were created; `doc/documentation-profile.md` does not enable them.

## Next Step

Ready for Finalization.
