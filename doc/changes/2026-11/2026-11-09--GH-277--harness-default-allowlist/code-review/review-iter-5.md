# GH-277 Code Review — Iteration 5 (final)

- **Status:** PASS
- **Mode:** local
- **Branch:** `fix/GH-277/harness-default-allowlist` (base `origin/main-tools`, merge-base `dbbc62cf`)
- **Product change under review:** `9a23c8c2` — `fix(GH-277): cover host stdin early-close guard`; product code unchanged in this iteration
- **Artifact remediation under review (uncommitted, expected):** spec v1.6, test plan v1.7, plan header/phase-5 scope, and the `doc/spec/features/feature-harness-adapters.md` doc-sync
- **Reviewed at:** 2026-11-10T07:17:58Z
- **Canonical artifact:** `review-iter-5.yaml`
- **Previous iterations:** `review-iter-1.yaml` (FAIL — 1 high / 4 low), `review-iter-2.yaml` (FAIL — 1 high / 1 low / 1 info), `review-iter-3.yaml` (FAIL — 1 high / 1 medium / 1 low), `review-iter-4.yaml` (FAIL — 1 medium / 3 low / 2 info)

## Verdict

**PASS.** The iteration-4 artifact-truth findings are closed, the product change is
unchanged and green, and no critical, high, or medium finding remains. The change is
ready for the phase-5 boundary commit, quality gates, `dod_check`, and PR creation.

The iteration-4 blocker was narrow: spec v1.5's binding Definition of Done still stated
pre-remediation counts. Spec v1.6 reconciles it, the plan header and test-plan mutation
labels are refreshed, and phase 5 now owns the doc-sync file. The remaining items are one
carried low (starter non-EPIPE stdin asymmetry, accepted) and three informational notes; none
requires a product change or a plan phase.

## Iteration-4 findings — verified closed

### F-1 (medium) — spec §17.1 Definition of Done now matches the plan and test plan

- `chg-GH-277-spec.md:431` — preamble binds "the test plan's 30 scenarios
  (`TC-HDA-001`..`TC-HDA-101`)" and "Phases 1–5".
- `:436` DoD-2 — "all 30 TCs, `TC-HDA-001`..`TC-HDA-101`" (includes TC-HDA-036 explicitly in
  the revision note), Proven in Phases 1–5.
- `:438` DoD-4 — "Mutation evidence M-1..M-21", Proven in Phases 1–5.
- `:445` DoD-11 — "all five declared plan phases complete", Proven in Phases 1–5.
- `:601` validation checklist — "all 30 test-plan TCs … M-1..M-21".
- `:374-375` §16 — the host-stdin guard suite row
  (`tests/behaviour/harness-host-stdin-error.test.ts`) is added beside the updated
  `harness-host-stream.test.ts` row.
- `:583` revision history — 1.6 row records the reconciliation and the §16 change.

Cross-check: test plan v1.7 carries exactly 30 `#### TC-HDA-*` headings, the §10 execution
log has 30 rows all `Pass` (29 dated 2026-11-09, TC-HDA-036 dated 2026-11-10), and the §10
mutation table carries 21 numbered mutants with an M-21 row. The unmodified
`Phases 1–4` cells (DoD-1, DoD-3, DoD-10) are consistent with the plan's declared
"P5 owns no AC" rule: P5's only TC, TC-HDA-036, is additive confirmation of AC-F4-1, whose
owner stays P1, and P5 owns no NFR.

### F-2 (low) — plan header refreshed

`chg-GH-277-plan.yaml:5-56` now cites spec v1.6 with DEC-1..DEC-7, test plan v1.7 with 30
scenarios including TC-HDA-036, "five delivery phases", a P5 paragraph covering both the
iteration-3 guard remediation and the iteration-4 artifact refresh, AC ownership 29/29 with
"P5 owns no AC", and TC ownership 30/30 (16 + 2 + 8 + 3 + 1). No `v1.3` string remains in
the header.

### F-3 (low) — test-plan mutation labels and the false DoD claim

`chg-GH-277-test-plan.md:194` (§3.4), `:1806` (§7.3 non-vacuity note), `:1898` (§8.3),
`:1953` (§10 heading), and `:1993` (§10 summary) all read `M-1..M-21`. The §3.4 sentence that
called the spec's DoD-1/DoD-2 claims "unaffected" is replaced: DoD-1 is unaffected because the
AC set stays 29 and AC-F4-1 stays Covered, while DoD-2 and DoD-4 moved with the added
scenario and mutant and are reconciled by spec v1.6 to 30 TCs and M-1..M-21.

### F-6 (info) — doc-sync file now inside phase-5 scope

`chg-GH-277-plan.yaml:433-436` — phase 5 `scope.files` lists
`doc/spec/features/feature-harness-adapters.md`, and the phase summary states the reconciled
system-spec edit is carried "so the boundary commit reports no scope drift". The uncommitted
tree contains only the four documentation files (spec, test plan, plan, harness-adapters
page), all covered.

## Findings (iteration 5)

### F-1 (low, accepted) — starter's non-EPIPE stdin branch does not stop the child

`packages/adapters/src/host/index.ts:272-275` ends the channel and completes
`{ status: 127 }` but does not kill the child, unlike the runner (`:79-83`, which calls
`child.kill()`). A post-acquisition coded non-EPIPE stdin error therefore resolves the session
while the child can keep running until it exits; the isolated EIO leg asserts only the
completed result. `EPIPE` (the realistic early-close case) is unaffected because the close path
ends the process. Carried from iterations 3–4, **accepted as low; no product change required**
for GH-277. Optional later hardening: call `kill()` before `complete` (idempotent), or document
the difference and assert an absent/killed child in the EIO leg.

### F-2 (info) — test-plan provenance still tagged spec v1.5, anchors shifted by one

The test plan cites "spec v1.5" in §1.1/§1.2/§2/§3.2/§3.5/§7/§8 content references and states
at `:202` that line references to the change spec are for spec v1.5. Spec v1.6 added one §16
row, so anchors after line 374 shift by one (the TC-HDA-036 anchor "spec AC-F4-1 400" now
resolves to 401; §7.1 190-203, §16 373, §21 471 and DEC-7 361 still resolve). The cited
content is unchanged by v1.6 apart from §16/§17.1, which the updated bullets already cite as
v1.6, so this is provenance drift, not a contradiction. No action required.

### F-3 (info) — commit body lost the TC id to the commit primitive's ref sanitizer

Commit `9a23c8c2` body reads "(TC-)" because `stripInventedRefs`
(`packages/core/src/domain/commit-message.ts:21`, `TRACKER_REF =
/\b[A-Z][A-Z0-9]*-\d+\b/g`) strips `HDA-036` from `TC-HDA-036`. Pre-existing primitive
behaviour, not introduced by GH-277: cite TC-HDA-036 in the PR description / pm-notes and open
a follow-up to preserve `TC-*` ids.

### F-4 (info) — phase-5 `doneArtifacts` still describes only the iteration-3 closure

`chg-GH-277-plan.yaml:444-450` — the phase summary now carries the iteration-4 artifact
refresh, but `doneArtifacts.trackerTransition` still reads "review_fix iteration 3 closes R3-2
with TC-HDA-036 green …". A phase-10 reader sees a narrower completion claim, not a false one.
When the boundary commit is recorded, extend it to name the iteration-4 F-1/F-2/F-3/F-6
closures (or rely on the pm-notes completion entry, which is the authoritative evidence).

## Gates run this iteration

| Gate | Result |
|---|---|
| `pnpm typecheck` | **exit 0** ✅ |
| `pnpm check:boundaries` | **exit 0** — 356 modules / 1041 dependencies; ambient-globals 162 files, entrypoints, secret-read (325 files) clean ✅ |
| `bun test tests/behaviour/harness-host-stream.test.ts tests/behaviour/harness-host-stdin-error.test.ts` | **11 pass / 0 fail**, 44 expect() calls across 2 files ✅ |
| `delivery-os plan validate GH-277` | `verdict=valid`, `tier=full`, `readyForDevelopment=true` ✅ |
| `delivery-os lint GH-277` | pm-notes `class: conforms` ✅ |
| `delivery-os verify change GH-277` | `result=partial`, `missing=review_fix,quality_gates,dod_check,pr_creation` — expected at this lifecycle point ✅ |
| Tree state | product code unchanged since `9a23c8c2`; only the four expected documentation edits + iteration-5 review files |

The aggregate `TMPDIR=$PWD/tmp/tmpdir pnpm check` was last green at 6618 pass / 4 skip / 0 fail
across 783 files; no product code changed since that run, so it was not repeated per the
iteration-5 scope.

## Compliance

- **Spec compliance: PASS** — every AC and DoD condition is evidenced by the 30-row all-Pass
  execution log, the 21-mutant table, the phase-5 artifact set, and the plan's per-phase
  completion notes; spec v1.6 is internally consistent with plan v1.7 and test plan v1.7.
- **Plan compliance: PASS** — `tier.phases: [1, 2, 3, 4, 5]`; phases 1–4 carry commit + gate
  evidence in pm-notes; phase 5 is declared, scoped (two suites + change folder + harness
  adapters page), and open pending this PASS, as expected before its boundary commit. No scope
  deviation: the working tree matches phase-5 scope.
- **No orphan TODOs** or unowned follow-ups introduced by the change.

## Next step

`PROCEED` — no remediation phase appended. The PM proceeds to the phase-5 boundary commit
(landing spec v1.6, test plan v1.7, the refreshed plan header, the harness-adapters doc-sync,
and the iteration-3/4/5 review records), then quality gates, `dod_check`, and PR creation.
Optional, non-blocking follow-ups: F-1 (starter kill symmetry), F-2 (spec-version/line-anchor
rebase), F-3 (TC-* id preservation ticket), F-4 (phase-5 doneArtifacts wording).
