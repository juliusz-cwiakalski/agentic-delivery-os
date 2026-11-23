# Readiness Review Iteration 6

Verdict: READY
Work Item: GH-366
Date: 2026-11-22
Pause Required: no

## Basis of review

- Artifacts read at HEAD `7f8b8bb4`: `chg-GH-366-spec.md` (**v2.5**), `chg-GH-366-test-plan.md`
  (**v1.7**), `chg-GH-366-plan.yaml` (**v16**), `chg-GH-366-pm-notes.yaml` (top-level
  `branch` present at line 8; iteration-5 verdict, the PM remediation decision and a
  retro recorded as `notes:` entries).
- This is the **verification run** authorized on iteration 5's escalation: one
  mechanical pass over the three scoped fixes. Every fix was **re-verified against
  the artifacts and tooling directly, not accepted from the change summary**.
- Remediation commit re-inspected: `7f8b8bb4` (single commit, parent `164a0927`)
  touches exactly the four change artifacts — **zero code diff** in `packages/`,
  `tests/`, `tools/`, `scripts/` — so the delivered seam is byte-identical to the
  tree iteration 5 verified in-session (`findMergedDeliveryRequest`'s collapse of
  every non-2xx/unparseable fault into one `{observation: "invalid", detail}`
  outcome discarding `code`/`httpStatus`; the open list and single-request reads
  returning the raw non-ok response with its status; `mergeReadCodeOf` resolving
  non-401/403 payload-invalid to `provider.outage`).
- Mechanical invariants re-derived in this session (script, not accepted): 54
  detail headings = 54 unique ids (`TC-MRG-001`…`TC-MRG-054`, none missing) = 54
  §5.1 index rows = 54 §7.1 automation rows = 54 `Plan Phase(s)` lines;
  allocation 0 / 9 / 19 / 17 / 3 / 5 / 1 = 54 unchanged; 27 AC coverage rows = 27
  unique AC ids; plan phase ids and titles byte-identical v15 → v16 (diffed); the
  plan parses (7 phases, `tier: full`, escalation triggers intact — trigger 5
  budget, trigger 7 fault-is-not-zero in single-identity language); `jaiship plan
  validate GH-366` run by this gate → `verdict: "valid"`, `readyForDevelopment: true`.
- No artifact was modified by this gate. No source file was touched.

## Authorized remediation — verification results

**Finding 1 (major) — test plan v1.7: VERIFIED CLOSED.**
TC-MRG-052 (test plan 3569–3652) is restated to the single delivered outcome: the
three fault classes (transport, auth rejection, payload-invalid) are kept as
**input fixtures** with the collapse stated ("the parameterization is coverage of
the delivered boundary's collapse, not three asserted identities"), and every
cell asserts the **one** outcome — `provider.outage` with
`operation=github-delivery-request-list`, Appendix B's single row governing and
the delivered payload-invalid mapping recorded as the rationale that row carries
the payload cell (rationale, not a second asserted identity). The never-rules are
intact and strengthened (never `no-open-request` / `merge.request-unresolved` /
`merge.transaction-aborted`, never folded into the empty-identities outcome),
the paired control with TC-MRG-005 is explicit (healthy-read cell refuses
`no-open-request` with the member **present and empty**; fault cells refuse the
provider identity with the member **absent**), the budget is **2** per cell, and
AC-F1-4's fault-clause traceability survives ("a fault is a distinct outcome from
zero, never a request reason, spending 2"). A v1.7 history row documents the
restatement. No per-class assertion for the merged read survives anywhere as a
live claim: the §3.1 AC-F1-4 row (436), the front-matter summary (10), the §5.1
index row (596) and the §7.1 automation row (3939) are all single-identity; the
remaining `provider.auth.rejected` mentions sit on other read surfaces — the
declared landing-fault mapping (F-3 / Appendix B row 20), the credential cells,
and the open-list/check-run fault cells (~1339) whose per-class mapping **is**
producible (re-verified: `listDeliveryRequests` returns the raw non-ok response
carrying its status) — exactly the boundary iteration 5 drew, and the v1.6
per-class wording survives only in document-history narration, which is correct.

**Finding 2 (minor, persistent) — plan v16: VERIFIED CLOSED.**
`doc/spec/features/feature-provider-client-seeds.md` is now declared executable
in the plan: phase 7's `scope.files` contains the page (line 1853; machine-verified
through the parsed YAML), the enumerated documentation-obligation list carries the
matching bullet naming both moving statements with their spec §16 / test plan §7.4
citations (1768–1773), and a REVISION header block documents both halves. Phase 3
is synced to the single-outcome oracle: the fault-arm comment (~857–880) states
EVERY fault input class refuses the ONE declared identity with the collapse
rationale, distinguishable-from-zero (paired healthy-read control) and TWO
provider requests, and the TC-MRG-052 line (~1021–1031) matches. No phase was
added, removed, renamed or reordered (ids and titles diffed identical v15 → v16);
the validator verdict is `valid` / `readyForDevelopment: true`.

**Finding 3 (nit) — spec v2.5: VERIFIED CLOSED.**
F-1 step 3 (465–471) now reads "refuses `provider.outage` (**one identity for all
three fault classes**; a payload the read cannot parse lands on that same row
because the delivered payload-invalid mapping **itself resolves to
`provider.outage`** at this seam)" — one identity governs, the payload-invalid
mapping is rationale. The §25 revision row carries v2.5 (1812) and states no AC
added or removed; the diff is confined to those two hunks (7/4-line), the 27-id
inventory and the recounted arithmetic untouched.

## Disclosed residuals — weighed as instructed (advisory, non-blocking)

**(a) The two-reading parenthetical survives in three prose locations** — §6 Flow 7
(spec 980), §17.1 AC-F1-4 (1406), §24-A Appendix A step 3 (~1695–1698), phrased as
the owner ruling's own wording. Weighed a **nit**: both readings converge on the
same identity at the delivered seam — `provider.outage` — because the delivered
payload-invalid mapping resolves to `provider.outage` there, and the v1.6 defect
(`provider.auth.rejected` for the auth cell) is licensed by *neither* reading; the
over-read invented a mapping neither arm contains. With every implementation-facing
oracle (TC-MRG-052, the plan's phase-3 arm and TC-MRG-052 line, F-1 step 3)
single-identity, the residual prose cannot produce a contradictory pass condition
or a coder fork: an implementation asserting `provider.outage` satisfies all three
survivors, and no implementation satisfies them otherwise. Advisory on remediated
ground; no reopen.

**(b) AUTHORING GUIDELINES prose narrates v2.0–v2.4 without a v2.5 sentence** —
verified as disclosed (~1788–1795: "implemented in v2.4"); the §25 revision table
carries v2.5. v2.5 added no AC, moved no identity total and changed no behaviour —
one parenthetical's wording. The canonical revision history is complete; the prose
narration gap is a documentation nicety on a no-substance revision. Weighed a
**nit**; advisory.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS *(flipped from iteration 5's FAIL — the one flip this run was asked to verify)*
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS *(iteration 5's open half closed)*
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Findings

1. **[nit] [ADVISORY — non-blocking] cross_artifact_consistency — spec §6 Flow 7
   (980), §17.1 AC-F1-4 (1406), §24-A Appendix A step 3 (~1695–1698)**
   Gap: the fault outcome's parenthetical "(provider.outage, or the delivered
   payload-invalid mapping)" survives in three prose locations while every
   implementation-facing oracle is single-identity; both readings resolve to the
   same `provider.outage` at the delivered seam, so no criterion is undecidable
   and no oracle is red by construction.
   Suggested remediation target phase: specification
   Suggested fix: optionally align the three survivors' wording with F-1 step 3's
   v2.5 phrasing (one identity; the payload-invalid mapping as rationale) in any
   future spec touch — must not reopen this gate.

2. **[nit] [ADVISORY — non-blocking] spec_completeness — spec AUTHORING
   GUIDELINES (~1788–1795) vs §25 revision row 2.5 (1812)**
   Gap: the prose narration of the merged-truth rule's implementation history
   stops at v2.4; v2.5 exists only in the §25 revision table.
   Suggested remediation target phase: specification
   Suggested fix: optionally add one narration sentence for v2.5 in any future
   spec touch — must not reopen this gate.

No critical or major findings. No persistent finding remains open.

## Notes that are not findings

- **Deduplication**: both advisories are the disclosed residuals, recorded so they
  are not re-derived by a future review; they are not iterations of iteration 5's
  findings 1–3, whose named sites are all remediated and verified. Nothing here
  repeats an earlier record as persistent — none qualifies.
- **Process observation for @pm (not a gate matter)**: the remediation commit
  `7f8b8bb4` carries the four artifacts but not `readiness-iter-4.md` /
  `readiness-iter-5.md` (both still untracked, alongside this record) although the
  pm-notes decision entry describes the commit as carrying the remediation plus
  the iteration-5 verdict record. Committing readiness records is the PM's
  checkpoint duty, not a DoR facet — iter-4, iter-5 and iter-6 records should ride
  the next checkpoint commit together.
- Ticket state: unchanged since iteration 5's in-session fetch (issue #366 OPEN;
  the last comment is the ruling's intake acknowledgment; no unread owner input).
  This run adds no new question to the ticket.
- The stop condition set by the authorizing escalation is met: all three scoped
  fixes are landed and verified, the disclosed residuals are nit-level on ruled
  or remediated ground, and every facet passes. The gate closes here; delivery
  may proceed.

## Gate result

**READY.** Ten of ten facets pass; two advisory nits recorded, neither blocking.
Delivery is unblocked. Recommended next step for @pm: proceed to `delivery`
(`@coder`), with the checkpoint commit picking up the readiness records.
