# GH-228 doc-impact handoff for @doc-syncer (Phase 8 input)

This file is the @coder → @doc-syncer handoff for delivery-lifecycle phase 7
(`system_spec_update`). It is **not** current truth and must be reconciled by
`@doc-syncer`; @coder does not author `doc/spec/features/feature-brief.md` or
edit status-digest current truth.

## New surfaces and files

| Delivered behavior | Source of truth |
|---|---|
| Read-only `brief` command, composed at the CLI edge beside `status` | `packages/cli/src/commands/brief.ts`, `packages/cli/src/edge.ts` |
| `delivery.brief.v1` payload: schema id, generation time, repository binding reference, nine surfaces, two ranked anchor groups, three placeholders, truncation markers | `packages/core/src/contracts/brief.ts` |
| Pure `projectBrief` / `renderBriefHuman` (same injected `StatusFacts`, `collectStatusFacts` reused, no brief-only read) | `packages/core/src/domain/brief.ts` |

## Decisions to mirror

- **DEC-1** same collector state as the status digest; zero brief-specific reads.
- **DEC-2** collector unavailability is digest data at exit `0`; no
  `status.collector.<id>.unavailable` identity; no exit-2 unavailability path;
  only `fallback.invocation` (1) and `fallback.internal` (2) can fail.
- **DEC-3** no LLM in the render path.
- **DEC-4** brief is the v0 owner-facing render surface; M1-S10 joins the same
  anchors from the same collector state; neither spec may contradict the other.
- **DEC-5** no spend surface in v0.
- **DEC-6** closed catalog exactly `typed-questions` (M1-S16),
  `gate-sla-states` (M1-S5), `lane-queue-engine` (M1-S17), all `not-delivered`.
- **DEC-7** ready-to-merge is observed-approval, non-draft, open PR attention,
  never a merge verdict.

## OQ-1 resolution

The exact human grammar is pinned by the committed goldens
`tests/fixtures/brief/golden/human.txt` and `envelope.json`; regeneration is the
explicit command `bun run tests/fixtures/brief/golden/regenerate.ts`. No
bound-pressure conflict was observed: the cap-sized screen renders in 11 lines
and 641 bytes, well inside 24 lines / 4096 bytes.

## Required documentation changes

1. **New current-truth feature spec** `doc/spec/features/feature-brief.md`,
   mirroring `feature-status-digest.md` structure (architecture and codebase
   map, data flow, interface contracts, security/boundaries, NFRs, QA strategy)
   with DEC-2 posture. It must state: exit `0` on collector unavailability; no
   `status.collector.<id>.unavailable`; nine surfaces; three placeholders;
   ready-to-merge attention, never a verdict.
2. **Status-digest cross-link** in `doc/spec/features/feature-status-digest.md`
   ↔ the new brief spec per DEC-4, and update the line that says the
   `humanText` hook is consumed only by `status` (the brief now consumes it too).
3. **Command registry** `doc/planning/oss-tooling/cli-command-registry.md`: move
   the `brief` row from planned to delivered, naming M1-S6.
4. **Proposed man page** `doc/planning/oss-tooling/milestones/m1/commands/brief.md`:
   remove the EXIT STATUS row that claims exit `2` for "collectors unavailable";
   align the envelope example to the shipped `CommandResult` shape
   (`schemaVersion`, `runId`, `exitCode`, `timing.totalMs`, `data`); mark
   illustrative-only fields as illustrative.
5. **TC-BRIEF-022 evidence** in `chg-GH-228-test-plan.md` §10: record the
   content-check commands and output (no "collectors unavailable" row, no
   `status.collector.` identity, registry row delivered) and the two review
   checklist items ("no LLM or model call in the brief render path"; "the
   ready-to-merge anchor is attention, never a merge verdict").
6. **`ados_distribution` markers**: no new or changed file is under
   `doc/guides/`, `doc/templates/`, or the standalone distributable docs, so no
   new marker is required. If doc-syncer touches a distributable doc while
   cross-linking, keep its existing `ados_distribution` marker intact and run
   `bash scripts/.tests/test-doc-distribution.sh`.

## Explicit non-changes

- No status digest schema, section, order, or command change.
- No adapter, state, configuration, package, or subpath change.
- No new error-table row, domain kind, or configuration key
  (`tests/checks/error-table-sync.test.ts` green; `ERROR_TABLE` has no `brief.`
  or `status.` code).
