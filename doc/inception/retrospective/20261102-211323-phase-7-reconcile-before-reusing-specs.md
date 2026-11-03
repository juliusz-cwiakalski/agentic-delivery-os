---
id: TOOLING-INCEPTION-RETRO-PHASE-7-REUSE
status: Draft
created: 2026-11-02T21:13:23+01:00
last_updated: 2026-11-02
phase_scope: 7
topic: "Reuse canonical legacy specs only after reconciling behavior"
outcome: repeat
owners: [bootstrapper]
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Feature mapping separates implemented contracts, proposed follow-up AC and still-missing field evidence."
---

# Reconcile before reusing specs

## What happened

After explicit Gate 6 approval, the Phase 7 draft reconciled twenty existing M0
story outcomes to canonical homes at HEAD `bd34031`, integrating `main-tools`
`5330809`. It reused delivered feature specs instead of creating duplicates.
Documentation-only GH-185 remains documentation/configuration reconciliation;
GH-186 remains static proxy data plus existing Proposed decision homes.

## What worked

Direct [verify handler](../../../packages/cli/src/commands/verify.ts) inspection
confirmed recovered `change | gates` dispatch despite its stale leading comment.
The [gate tests](../../../tests/behaviour/verify-gates-ci.test.ts) explicitly
assert red, missing-job and vacuous-green failures. Issue closure and the earlier
status snapshot were not used alone as runnable proof.

The [closeout integration test](../../../tests/behaviour/closeout-integration.test.ts)
demonstrates intended production composition over real temporary git/state with
mocked providers. Reading its boundaries avoided turning supported writes into
live-write parity or treating command composition as a shared runtime/binary.
Tests were inspected, not executed in this drafting task.

## Improvement pattern to repeat

Keep stable XC IDs, but refresh their evidence interpretation after integration.
Use explicit local proposed AC for missing pilot/attention/support/repair work;
neither broad quality principles nor a release-stage story proves M0 coverage.
Preserve existing deferred question homes and allocate only final sign-off Q21.

Check actual limits, not identifiers: config/pm-notes and CI-workflow acquisition
use string length against byte-named limits. HANDOFF-006 includes that acquisition
path in the existing parser-unit follow-up, without inventing a global threshold.
Shell CI propagation remains a separately scoped technical repair.

## Evidence and stop boundary

The [handoff](../analysis/phase-7-feature-specs-and-backlog-handoff.md) records
twenty story mappings, thirteen stable cross-cutting concerns and eleven local
proposed follow-up IDs. These are representation counts, not passing tests or
approved tickets. The [summary](../inception-summary.md) leaves sign-off blank.
Final inception approval, M0 outcome evidence and individual owner acceptances
remain distinct. Exact corpus registration and final integration validation
belong to the parent; no prior guard PASS is extrapolated to the new files.
No source/framework repair, registry/state edit, runtime/live test, tracker write,
decision acceptance, commit, push or release was performed by this draft task.

## Focused draft validation

- Four recursive duplicate-key-checked mapping frontmatters parse; 81 local
  Markdown targets/heading anchors resolve with zero errors.
- Privacy scan: 1685 files, seven rules, zero violations; both hashed classes
  remain empty/vacuous. This does not establish configured coverage or sign-off.
- Literal guard: exit 1, exactly four new-document membership failures. No
  registry write or clean scanned-content certification for these files follows.
- New-file whitespace and punctuation checks and `git diff --check` pass.
  The working tree contains exactly these four intended untracked documents.

## Parent integration verification

After draft authoring, the owner authorized only the four exact registry
memberships. Read-only independent review verified those additions, unchanged
remaining registry structure, 4/4 strict frontmatters and 81 valid links/anchors.
The branding guard then passed all 5/5 classes with zero violations; privacy
reported zero violations over 1685 files with the same vacuous classes. No
serious review findings were reported. These later results supersede the draft's
membership failure above without claiming a full product battery or final sign-off.
