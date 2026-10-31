---
id: GH-186-doc-sync-report
work_item: GH-186
phase: system_spec_update
status: Complete
created: 2026-10-31T19:15:00Z
last_updated: 2026-10-31T19:15:00Z
owners: [engineering]
links:
  change_spec: ./chg-GH-186-spec.md
  plan: ./chg-GH-186-plan.md
  test_plan: ./chg-GH-186-test-plan.md
---

# Documentation Sync Report - GH-186

## Status

`SUCCESS` - current-truth documentation reconciled with the delivered decision-record and measurement-baseline artifacts.

## Scope

Resolved context from `doc/changes/2026-10/2026-10-31--GH-186--decision-records-measurement-baseline/`: spec v1.3, plan v1.2, test plan v1.3, and the delivered commits through HEAD `36e878f` after the `origin/main-tools` merge at `46610b6`. Ground truth was read from the tree and the delivered files, not from the change prose alone.

Doc-sync obligations checked: spec §7.1 (in-scope current-truth sync), F-6 (what phase-7 reconciles), DEC-12 (the named doc-sync set), and AC-F6-1.

## Files reviewed

| Area | Files |
|------|-------|
| Decision records | `doc/decisions/00-index.md`, `00-register.md`, `README.md`, `ADR-0008-*`, `ADR-0009-*`, `ODR-0002-*`, `ODR-0003-*` |
| Measurement artifact | `doc/planning/oss-tooling/measurement-baseline.yaml` (schema parsed; values not restated) |
| Feature specs | `feature-measurement-baseline.md`, `feature-decision-records.md`, `feature-adapter-ports.md` |
| Planning docs | `doc/planning/oss-tooling/README.md`, `cli-command-registry.md`, `doc/planning/concepts/id-prefix-catalog.md`, `agent-primitive-surface.md` |
| Overview / index | `doc/overview/glossary.md`, `doc/00-index.md` |
| Merged GH-204 content | `AGENTS.md` Agent memory section, `.ai/memory/**`, `.opencode/README.md` (read-only consistency check) |

## Files changed

| File | Change |
|------|--------|
| `doc/spec/features/feature-decision-records.md` | Bumped `last_updated` to `2026-10-31` and extended the summary to name the foundational binding register and per-type decision ID ranges. The register and ODR-0002 sections delivered in phase 10 were verified as accurate. |
| `doc/spec/features/feature-adapter-ports.md` | Consolidated duplicated front-matter blocks, restored the effective `contracts` entry, and added `GH-186` plus `ADR-0008` to the traceability links. The body already carried the ADR-0008 / M1-S11 pointer. |
| `doc/overview/glossary.md` | Consolidated duplicated front-matter blocks, added `GH-186` together with `ODR-0002`/`ODR-0003` to the links, and corrected the summary to cover the decision-governance and measurement terms. All 13 delivered terms and their anchors were verified. |
| `doc/00-index.md` | Added the Foundational Decision Binding Register to the Decision Records table so the top-level index matches `doc/decisions/00-index.md` and `doc/decisions/README.md`. |
| `doc/changes/2026-10/2026-10-31--GH-186--decision-records-measurement-baseline/doc-sync-report.md` | This report. |

## Gaps found and resolved

| Gap | Resolution |
|-----|------------|
| `feature-decision-records.md` was materially edited in phase 10 but still claimed `last_updated: 2026-07-05`, and its summary did not name the new register or ID scheme. | Bumped the date and extended the summary. The register, per-type ID ranges, ODR-0002/catalog pointer, and component-map row were already present and correct. |
| `feature-adapter-ports.md` body gained the harness-contract pointer but its effective front matter did not reference `GH-186` or `ADR-0008`; duplicated `summary`/`links` keys also made the first block's `contracts` entry unreachable. | Consolidated the front matter and added the traceability links, preserving the `envelope.ts` contract. |
| `glossary.md` had duplicated front-matter keys, so the effective `related_changes` omitted `GH-186` and the effective summary omitted the decision/measurement terms; duplicated blocks also made the metadata invalid under strict YAML parsers. | Consolidated the front matter to one valid block, added `GH-186` and the new decision IDs, and wrote a summary that covers the current term set. |
| The top-level `doc/00-index.md` Decision Records table linked the directory and the index but not the new binding register, while the decisions index and README did link it. | Added the register row for index-to-index consistency. |

The two F-6 documents with malformed front matter (`glossary.md`, `feature-adapter-ports.md`) were repaired because the duplication suppressed the very traceability and contract links GH-186 introduced. This is confined to GH-186-touched documents; unrelated pre-existing duplicates elsewhere were left untouched (see observations).

## Verified without change

| Surface | Finding |
|---------|---------|
| `feature-measurement-baseline.md` | Exists, carries `ados_distribution: internal` inside its frontmatter, states path, schema, four `MET-` IDs, `MEASURED`/`PARTIAL`/`UNAVAILABLE` semantics, source-traceability rule, fixed window, and comparison protocol, points to the log as canonical data, and restates no metric values. Its `registered` entry is in the same commit that created it (`e6de79a`). |
| `measurement-baseline.yaml` | Parses as YAML; top-level keys, change-row keys, and metric-row keys match the feature-spec data model; four `MET-` IDs present; change spine has 41 rows; `source_commit` is 40-hex; GH-186 is the `capture_change`. |
| `feature-decision-records.md` body | Describes the register as a non-record projection with an update rule, links it from the index and README, and describes per-type decision ranges adopted by ODR-0002. |
| `doc/decisions/00-index.md` | Four new records have correct type/title/status/date/owner and resolve; `TDR-0005` uses the right ID and link text and precedes `TDR-0006`; `PDR-0002` title matches its record heading; the register is linked in the header. |
| `doc/decisions/00-register.md` | All eight topics are bound to existing records/anchors; statuses mirror the records; the update rule and owner-acceptance-pending statement are present; the index and README link back. |
| `doc/decisions/README.md` | References the foundational register. |
| `doc/planning/oss-tooling/README.md` | Documents table includes `measurement-baseline.yaml` with schema version and the four `MET-` IDs, without values. |
| `doc/planning/oss-tooling/cli-command-registry.md` | v1 title, locked man-page heading, ODR-0003 lock banner, updated introduction, and the `provider` audit bullet are present; table rows are unchanged. |
| `doc/planning/concepts/id-prefix-catalog.md` | Status is annotated as adopted by ODR-0002 and links the per-type/project catalog decision. |
| `doc/planning/concepts/agent-primitive-surface.md` | Records `DeliveryRequest` as the resolved PR/MR primitive term by ODR-0003. |
| `feature-adapter-ports.md` body | Names ADR-0008 and M1-S11 as the harness contract and implementation. |
| Merged GH-204 agent-memory content | No conflict. GH-204 added `AGENTS.md` memory rules, `.ai/memory/**`, and a skill; no GH-186 current-truth doc makes a contradictory claim about agent memory, skills, or the `.ai/` tree. |

## Residual documentation gaps

**NONE** for the GH-186 reconciliation. Every in-scope current-truth document now describes the delivered artifacts accurately, traceability is present, and all cross-links resolve.

## Out-of-scope pre-existing observations

These are not GH-186 gaps and were deliberately not modified because they are outside the F-6 sync set and the change's NG-7 boundary. They are recorded for a separate documentation-hygiene change; no tracker ticket was created.

- `doc/spec/features/feature-result-contract.md`, `feature-monorepo-scaffold-toolchain.md`, and `feature-state-layer.md` still contain duplicated front-matter keys from earlier merges. Same class of defect as the two repaired GH-186 documents, but untouched by GH-186.
- `doc/decisions/00-index.md` still shows the pre-existing `ADR-0007` title drift (index title differs from the record heading). F-5 bound this change to the two named repairs, so it was left as-is.
- `doc/decisions/README.md` still lists an "Under Review" lifecycle state that is not part of the current record lifecycle. Pre-existing and unrelated.

## Validation

| Check | Result |
|-------|--------|
| `bun run scripts/checks/forbidden-literals.ts` | `OK forbidden-literals: 5/5 scope classes scanned, 0 violations` |
| `bash scripts/.tests/test-doc-distribution.sh` | `no drift - 81 in-scope docs; install set matches ados_distribution markers` |
| Front-matter parse (strict, duplicate-key detection) | The four changed docs parse as one valid block; the two repaired duplicates are gone. |
| Relative-link resolution across changed/reviewed docs | 100% resolve. |
| Baseline value leakage | No baseline metric values restated in the feature spec, glossary, index, or planning README. |
| Decision-record bodies | Zero modified. |
| Change artifacts | No spec, plan, or test plan modified; only this report was added. |
| Source, scripts, tests | Zero changes. |

## Traceability

The changed current-truth docs reference `GH-186` through `links.related_changes` (`glossary.md`) or the established front-matter traceability fields (`feature-adapter-ports.md`). `feature-decision-records.md` already carried `GH-186` in `related_changes`; the summary/date were corrected. `doc/00-index.md` and the decision indexes are navigation surfaces and do not carry change links.

## Handoff

- PM commits the four current-truth edits and this report. No git operations were performed by `@doc-syncer`.
- Optional follow-up outside GH-186: a documentation-hygiene change can consolidate the three remaining duplicated front-matter blocks and the ADR-0007 index title drift. It is not required for GH-186's DoD.

## Next Step

Ready for Finalization.
