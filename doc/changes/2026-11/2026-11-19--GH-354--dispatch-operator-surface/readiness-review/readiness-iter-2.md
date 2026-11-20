---
title: "GH-354 readiness review — iteration 2"
work_item: GH-354
change: dispatch-operator-surface
iteration: 2
date: "2026-11-19"
verdict: NOT_READY
reviewer: readiness-reviewer
artifacts_reviewed:
  spec: chg-GH-354-spec.md (v1.4)
  test_plan: chg-GH-354-test-plan.md (v0.2, 72 cases, 83 AC links across 59 cases)
  plan: chg-GH-354-plan.yaml (8 phases: 1 planning + 7 delivery; 72 owned case ids; 68 mutation rows)
  pm_notes: chg-GH-354-pm-notes.yaml
  decision_record: TDR-0058 (status `Proposed`; human owner accepts at PR review)
  ticket: GitHub issue GH-354 (read via `gh issue view 354`; body matches spec Appendix B)
scope_note: >-
  Findings are stated against the versions above as read during this iteration.
  Iteration 1's record is at readiness-review/readiness-iter-1.md.
---

# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-354
Date: 2026-11-19
Pause Required: no

Blocking findings: 3 (N1–N3). Non-blocking: N4–N12. F1, F2, F4, F5 and
advisories A1, A2, A5, A6, A7, A9 are closed. F3 is partially closed: the
execution split F3 asked for is now stated, but the same boundary rule is still
violated by two sibling cases, and the case-id owner is stated three different
ways across the two artifacts.

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Verification of the reported totals (recomputed, not trusted)

- Test plan: 72 `#### TC-*` detail headings, 0 duplicate ids; groups MATRIX 2,
  STATUS 8, LOG 11, ISDEL 7, MSG 10, GRAMMAR 5, PERSIST 11, RO 4, SHELL 4,
  CONTRACT 3, NFR 4, FIXTURE 3 = 72. §3.1: 38 AC rows, 83 links, 59 distinct
  cases, 45 extras — all three numbers reproduce from the table. The 13 cases
  with no AC link are exactly the set named at line 138.
- Plan: per-phase case ids 0 + 15 + 10 + 12 + 10 + 6 + 19 + 0 = 72, no id
  twice. AC ownership 0 + 12 + 4 + 6 + 7 + 4 + 5 + 0 = 38. Mutation rows
  0 + 14 + 11 + 13 + 9 + 6 + 15 + 0 = 68, M1–M68 contiguous.
- Test plan §7.4: 68 rows M1–M68 contiguous; every row names at least one case
  that exists.
- Arithmetic is internally consistent; the defects below are allocation and
  ownership defects, not count defects.

## Closure of iteration-1 findings

### F1 — seam bounded the message — CLOSED

Checked `chg-GH-354-spec.md` F-4 (line 134), API-4 (247), API-9 (252), DM-3
(267), AC-F4-7 (470), §21 (532), §22 (547); `chg-GH-354-test-plan.md`
`TC-MSG-008` (1237-1268), `TC-MSG-010` (1297-1329).

API-9 and DM-3 now return "the stored final assistant text under the adapter's
own read cap" and state that the seam "does not redact, flatten, bound to 512
characters, or set `truncated`"; the query is the sole place the composition
happens, in the declared order. `TC-MSG-010` asserts the raw seam return
(`RAW-SEAM-TEXT` keeps its newline, tab, and un-redacted credential) and, in the
same case, the query's composition over the real reader; `TC-MSG-008` owns the
composition assertion. The straddling-credential claim is now provable at the
layer where the cut happens.

Residual (non-blocking, N10): the relationship between the adapter's read cap
and the 512-character bound is still stated the wrong way round.

### F2 — AC-F7-3 was per file — CLOSED

Checked spec AC-F7-3 (497), F-7 (140), DM-2 (266), AC-F2-6 (448), §21 (533),
glossary "Declared transformation" (575), DEC-3 (390); plan phase 3 (999-1130)
and phase 4 (1174-1280); test plan `TC-PERSIST-005` (1576-1611),
`TC-PERSIST-006` (1613-1646), `TC-PERSIST-011` (1758-1784).

AC-F7-3 is now stated over "the concatenation of one stream's files in name
order", with the single stated exception that a file filled by a value longer
than the cap ends mid-value, and the per-file clause kept only for values that
fit. AC-F2-6, DM-2, F-7, DEC-3 and the glossary say the same thing in the same
words.

### F3 — split-case allocation — PARTIALLY CLOSED

What is fixed: the test plan now carries explicit "Write half — runs at the
phase-3 boundary, with no query involved" / "Read-back half — runs at the
phase-4 boundary" blocks in `TC-PERSIST-005`/`006`, the plan states "NO
`dispatch log` step appears in the phase-3 gate" (plan phase 3, line ~1104) and
allocates mutation `M46` to phase 4 because its named failure is a read-back.
The specific iteration-1 defect (phase 3 red because the case ran `dispatch
log`) is gone.

What is still open: (a) the case-id owner is stated three different ways — see
N3; (b) two sibling cases reproduce the same boundary defect — `TC-PERSIST-009`
(N1) and `TC-PERSIST-011` (N2); (c) the read-back halves of 005/006 have no
declared home inside phase 4's `scope.files` (the test plan §7.3 says "landed
with the log suite in phase 4", which is fine, but the case's own "Target Layer
/ Location" still names the phase-3 files).

### F4 — per-phase battery did not run the pinned suites — CLOSED

Checked plan GATE ENVIRONMENT (601-625) and the gates of phases 2 (943-959),
3 (1116-1133), 4 (1267-1283), 5 (1418-1434), 7 (1699-1715).

Each of those gates now lists
`bun test tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts tests/checks/no-shell-dispatch.test.ts`
verbatim, alongside `bun run scripts/checks/no-shell-dispatch.ts`, and the
header makes the trio "NOT OPTIONAL WHERE A PIN MOVES". Phase 6 explains why it
is excluded (no module, no exported contract name) and keeps the conditional
("if it does add an exported name, the trio ... runs in the SAME commit"). The
pinned-surface edits named by phases 2–5 (inventory.json,
content-inventory allowances, ports contract inventory, the no-shell surface and
`FIXED_SURFACE`) are therefore proven at their own boundary.

### F5 — fold before filter — CLOSED

Checked spec F-1 (128), F-3 (132), API-6 (249), DM-1 (265), NFR-4 (298), AC-F1-6
(436); test plan `TC-STATUS-006` (489-521), `TC-ISDEL-007` (1027-1058),
`TC-STATUS-008` (550-578); plan phase 2 contract (≈866-880).

Every statement of the read now says **filter to the resolved repository first,
then fold to the newest record per ref**, for `status` and for both
`is-delivering` forms, and each explains why (the key carries no repository
component). I verified the key shape in the delivered code
(`packages/core/src/contracts/dispatch.ts:574` `dispatch.lanes:` +
`dispatchLaneRecordKey(ref)`), so two records for one ref under different
repositories genuinely share a key and the fixtures are expressible. The test
plan now has both directions: a newer foreign record over an older local
terminal record (must not answer `absent`/foreign facts) and a newer foreign
terminal record over an older local active record (must not hide the local
lane). `TC-STATUS-008` covers the `status` store failure with the *named* code
and its row's projection; I verified the delivered error table
(`packages/core/src/contracts/error-table.ts:407-418,449-459`):
`state.store.torn` → `platform-provider` (exit 2), `state.permission.denied` →
`user-validation` (exit 1), so the case's expectations are real, not invented.

## Closure of iteration-1 advisories

- A1 (no-log meaning) — CLOSED. `no-log` is "no artifact exists for this ref"
  with the two named causes in F-2 (130), AC-F2-3 (445), §8.5 (286), §10 (314),
  RSK-17 (336) and glossary (571); `TC-LOG-004` covers the pre-change lane, the
  Claude lane, and a never-laned ref. Minor wording residual in N6.
- A2 (append accounting) — CLOSED. "one per fitting value, several for a value
  longer than the cap" now appears in F-7 (140), API-8 (251), DM-2 (266), DEC-3
  (390), RSK-16 (335), §12 (352), §23 (560). Nit in N11.
- A3 (truncation precedence) — PARTIALLY CLOSED. The precedence is now
  normative in F-2 (130), API-2 (245), DM-6 (270), NFR-3 (297) and AC-F2-5
  (447): binding byte bound → `bytes`; otherwise a shorter line count → `tail`;
  the human 200-line bound is `tail`-scope. Not closed: §19 still calls Appendix
  C "the authoritative statement of what each query answers" while the `log` row
  (633) still carries neither the one-fact rule nor the precedence, and
  `TC-LOG-007` does not declare the `bytes` scope for the human 32 768-byte
  fixture (N5).
- A4 (operator-facing state word) — NOT CLOSED. API-11 (254) and DM-7 (271)
  still name only the projection classes; Appendix D (644) still delegates only
  key order, the `log` truncation line, probe implementation, storage queries,
  naming encoding, split accounting, sink-fault taxonomy, reason wording, and
  wiring. No human form is assigned a state word anywhere, and nothing says the
  human forms carry none. Nit, non-blocking.
- A5 (status store failure) — CLOSED. `TC-STATUS-008` (550-578), linked
  API-1/API-6/API-11/DM-7/NFR-5, both output modes, both codes, and explicitly
  "never `marker=absent` at exit 0".
- A6 (registered-credential set) — CLOSED. Test plan §6.2 "declared composition
  fact 5" with supply point (`registerEdgeSecrets` → composer `secrets`), owning
  phase 5, asserted by `TC-MSG-008` and `TC-NFR-004`; plan phase 5 carries
  `F-secrets` through `packages/cli/src/edge.ts` / `production.ts` and declares
  both files in its scope.
- A7 (phase 1 already satisfied) — CLOSED. Plan COMMIT-BOUNDARY REALITY block
  (70-118) and phase 1 (785-840): satisfied at plan time, commit hashes named,
  no commit authored, gate is two `git` checks, pm-notes records the verdict.
- A8 (naming input set) — PARTIALLY CLOSED. F-7 (140), DM-2 (266), DEC-3 (390)
  and Appendix D (644) now enumerate "the stream kind (spawn, resume, deliver)
  or an explicit stream ordinal" and require lexical order = creation order, no
  shared counter. Not closed: the "or" still leaves two input sets in play, the
  plan says "the input set is not [implementation-decided]" while presenting the
  alternative, and TDR-0058 DR-4 lists neither stream kind nor ordinal (N9).
- A9 (decision-pass count) — CLOSED. `chg-GH-354-pm-notes.yaml:136-145` now says
  `@decision-critic` "challenged it four times (REWORK on every pass; no PASS
  claimed)"; spec changelog v1.2/v1.3 record the second, third and fourth passes
  in the same order.

## Findings

### Blocking

1. [major] plan_code_area_coverage / plan_coverage — `chg-GH-354-plan.yaml`
   phase 4 `scope.files` (lines 1287-1311) against test plan `TC-PERSIST-009`
   (1701-1728) and §7.3 (2384)
   Gap: the plan allocates `TC-PERSIST-009` to phase 4 ("the writer is phase
   3's, but the assertion is the reader's tear rule"), and both the case and the
   file map put it in `tests/conformance/dispatch/dispatch-operator-persist.test.ts`.
   That file is created in phase 3 and is **not** in phase 4's declared scope;
   phase 4's gate runs it only as a read-only control (line ~1274). So phase 4
   must author/complete the case in an undeclared file (a `plan diff`
   `undeclared` violation and a breach of the plan's own SCOPE DECLARATION RULE),
   or the case must be authored in phase 3 — where its step 2
   (`dispatch log GH-354`) cannot run because the reader does not exist yet.
   Either boundary is broken.
   Suggested remediation target phase: delivery_planning
   Suggested fix: either add `tests/conformance/dispatch/dispatch-operator-persist.test.ts`
   to phase 4's `scope.files` (so phase 4 authors the case) — keep phase 3's
   gate running only the writer assertions — or move `TC-PERSIST-009`'s reader
   half into a phase-4-declared file and say so in the case's Target Location.
   Do not leave the case in a file its owning phase may not edit.

2. [major] plan_coverage — `chg-GH-354-test-plan.md` `TC-PERSIST-011`
   (1758-1784) against plan phase 3 (1097) and the phase-3 gate (1116-1133)
   Gap: `TC-PERSIST-011` is phase-3-owned and lives in
   `tests/conformance/dispatch/dispatch-operator-persist.test.ts`, which the
   phase-3 gate runs in full. Its expected outcome requires a `dispatch log`
   answer ("The `dispatch log` answer contains only the requested tail — never
   the whole file", and "nowhere in any record ... beyond the requested tail").
   `dispatch log` does not exist until phase 4, so the phase-3 boundary is red
   as written, or the coder silently defers the clause — which the plan forbids
   ("assertions never deleted, renamed, relaxed ... or skipped"). This is the
   same defect class as iteration-1 F3, in a case the split did not cover.
   Suggested remediation target phase: delivery_planning (or test_planning if
   the clause moves)
   Suggested fix: either declare a split for `TC-PERSIST-011` (write half at
   phase 3: file bytes equal the declared transformation, no canary in any
   record/evidence/derived document; read half at phase 4/7) or move the
   "only the requested tail" clause to `TC-RO-001`, which is phase 7 and already
   owns AC-F6-1.

3. [major] cross_artifact_consistency — `chg-GH-354-test-plan.md` `TC-PERSIST-005`
   (1581, 1611), `TC-PERSIST-006` (1618, 1646), §7.3 (2399), §9 v0.2 (2655)
   against `chg-GH-354-plan.yaml` (326, 352-356, 373-390, 1097-1108)
   Gap: the case-id owner is stated three ways. The test plan says
   "owned by phase 4" in both cases' `Plan Phase(s)` and Notes and "Both ids are
   phase-4-owned" in §7.3, but its own revision log says "the ids phase-3-owned".
   The plan says the ids stay phase 3's and then claims "exactly as the test
   plan's v0.2 phase labels record" — which is false. A coder or reviewer cannot
   tell which artifact is authoritative for phase completeness, and the plan's
   justification for its allocation is factually wrong.
   Suggested remediation target phase: test_planning (align the case labels to
   the plan) — delivery_planning only if the plan's allocation changes
   Suggested fix: declare one owner everywhere. With the plan's TC→PHASE MAP
   unchanged, change the two `Plan Phase(s)` fields, both Notes, and §7.3 to
   "phase-3-owned; read-back halves executed at phase 4 as cross-controls", and
   drop the claim that the test plan records phase 3 until it does.

### Non-blocking

4. [major] plan_coverage — `chg-GH-354-plan.yaml` MUTATION REGISTER ALLOCATION
   (410-416), phase 2 gate (959), phase 5 gate (1432) against test plan M25
   (2443) and `TC-STATUS-008` Notes (578)
   Gap: M25 is allocated to phase 5 on the stated ground that "test plan v0.2
   widened it to name `TC-STATUS-008` and `TC-ISDEL-006` ... AND `TC-MSG-006`".
   The row names only `TC-ISDEL-006` and `TC-STATUS-008`, and `TC-STATUS-008`'s
   own Notes call those "both phase-2 surfaces". Under the plan's own rule
   ("allocated to the phase owning the LAST boundary among them"), M25 is phase
   2, and the per-phase totals become 15/8 rather than 14/9.
   Suggested remediation target phase: delivery_planning
   Suggested fix: either move M25 to phase 2 (and restate the totals) or widen
   the register row to name `TC-MSG-006` with a last-message-shaped failure —
   do not keep a rationale that the register does not support.

5. [major] cross_artifact_consistency — `chg-GH-354-test-plan.md` `TC-LOG-007`
   (741-768) against spec F-2 (130), DM-6 (270), NFR-3 (297), AC-F2-5 (447)
   Gap: the case seeds three fixtures, the third being "human bytes exceed
   32 768 bytes at fewer than 200 lines", but the expected outcome declares only
   two shapes: `{scope: "bytes", bound: 65536}` for the machine case and
   "`scope: "tail"` with the human bound for the human case". Per the spec's
   declared precedence, the 32 768-byte human fixture is a binding **byte**
   bound and must yield `scope: "bytes"` with `bound: 32768`. As written the case
   can pass an implementation that labels the human byte cut `tail`, which is the
   opposite of the precedence it exists to pin. (A3's root cause survives in the
   case layer.)
   Suggested remediation target phase: test_planning
   Suggested fix: enumerate the third variant's expectation explicitly
   (`{scope: "bytes", bound: 32768, omittedLines: <n>}`) and keep
   `scope: "tail"` only for the 200-line fixture.

6. [minor] test_traceability — `chg-GH-354-test-plan.md` `TC-LOG-004` Notes (690)
   Gap: it still says "`no-log` means 'this adapter streams nothing for `log`'",
   the pre-v1.4 single-cause reading, while the case's own rows cover the
   pre-change lane and the never-laned ref. Align to "no artifact exists for this
   ref", two named causes.
   Suggested remediation target phase: test_planning

7. [minor] cross_artifact_consistency — version metadata: test plan §2 (61)
   "`./chg-GH-354-spec.md` (v1.3)"; plan SOURCES header (15) "v1.3".
   Gap: the spec under review is v1.4 and both artifacts were revised against
   it. Cheap to fix; misleads a reviewer diffing the baseline.
   Suggested remediation target phase: test_planning / delivery_planning

8. [minor] decision_capture — `chg-GH-354-spec.md` F-7 (140), DM-2 (266),
   Appendix D (644) against `doc/decisions/TDR-0058` DR-4 (204)
   Gap: the spec adds "the stream kind (spawn, resume, deliver) or an explicit
   stream ordinal" to the naming inputs; TDR-0058 DR-4 lists "the stream's
   recorded time, the attempt identity, the iteration ordinal, and the segment
   ordinal" and nothing else, and DR-5 (205) — the record's list of the spec
   statements it refines — does not mention naming. The spec calls the record
   authoritative for the details it restates, so this is an unrecorded
   divergence from the governing decision (and the "or" leaves the input set
   undecided, A8).
   Suggested remediation target phase: specification (with @decision-advisor for
   the record amendment)
   Suggested fix: pick one input set (an explicit stream ordinal is the
   collision-free choice), state it once, and record the DR-4 refinement in
   TDR-0058 before acceptance.

9. [minor] spec_completeness — `chg-GH-354-spec.md` Appendix D (644) and test
   plan §8.3 item 5 (2647)
   Gap: both say the adapter's per-adapter read bounds sit "below the declared
   message bound". A read cap numerically below 512 characters would truncate
   the stored text before redaction — reintroducing exactly the pre-redaction cut
   F1 closed — and would leave `truncated` false while content was dropped. The
   delivered caps are 8 388 608 bytes / 50 000 lines
   (`packages/core/src/contracts/harness-telemetry.ts:272-275`), so the wording is
   also factually wrong for today's adapter.
   Suggested remediation target phase: specification
   Suggested fix: state the invariant instead — the read cap must be at least the
   message bound (and the credential's length) so the query's post-redaction cut
   is the only cut, and any read-cap truncation sets `truncated`.

10. [nit] test_traceability — `chg-GH-354-test-plan.md` `TC-PERSIST-008` (1696)
    Gap: "Exactly one append per yielded value (40 writes for 40 values)" without
    declaring that all 40 values fit the current file; as written it contradicts
    API-8's multi-append rule for a value longer than the cap.
    Suggested remediation target phase: test_planning

11. [nit] test_traceability — `chg-GH-354-test-plan.md` `TC-MATRIX-001` (301-305)
    Gap: the preconditions give a "resolvable transcript" only for the terminal
    seed, but the live row also needs one to answer `available=true,
    final=false` (AC-F4-3).
    Suggested remediation target phase: test_planning

## Ticket-AC and ticket-task check (GitHub issue GH-354, verified by `gh issue view`)

| Ticket requirement | Verdict | Evidence |
|---|---|---|
| Four queries answer for a **live** dispatch | PASS | AC-F1-1, AC-F2-1, AC-F3-1, AC-F4-3; `TC-MATRIX-001` live row in both output modes |
| Four queries answer for a **finished** dispatch | PASS | AC-F1-2, AC-F2-1, AC-F3-2, AC-F4-1; `TC-MATRIX-001` terminal row |
| Four queries answer for an **absent** ref | PASS | AC-F1-3, AC-F2-3, AC-F3-2, AC-F4-4; `TC-MATRIX-001` absent row, `no-log`/`no-lane` at their declared exits |
| The log is **bounded and reference-scoped** | PASS with N5 | AC-F2-1/5/6, NFR-3/4; `TC-LOG-001/007/008/010`, `TC-PERSIST-005/006/007`; 1 048 576 per file by segmentation, 2 × cap family, 1..500 tail, one truncation fact, 0 foreign lines |
| `last-message` is the **PM's final message**, not a classifier sentence | PASS | AC-F4-1/2, `TC-MSG-001/002/010`; source is the transcript seam only; envelope `lastMessage` explicitly excluded |
| **No shell script is read or executed** | PASS | F-6, API-12, AC-F6-2..AC-F6-5; `TC-SHELL-001..004`, `TC-RO-002/003`; planted decoys byte- and mtime-identical, shell-absent checkout answers 4/4 |
| Task: per-ref `status` fields (delivering, pid, session id, stale, marker) | PASS | AC-F1-1/2/3 payload; DM-5 |
| Task: per-ref `log` with bounded tail | PASS | F-2, AC-F2-1..6 |
| Task: `is-delivering` query | PASS | F-3, DEC-1 (both forms), AC-F3-1..5 |
| Task: `last-message` from the persisted session transcript | PASS | F-4, DM-3, DEC-4, AC-F4-1..7 |
| Task: persist harness stdout per ref during a dispatch | PASS | F-7, API-8, DM-2, AC-F7-1..4 |
| Task: one family with `--json` | PASS | F-5, AC-F5-1..4, `TC-GRAMMAR-*`, help entries 5→9 |

No ticket requirement is unmet or silently narrowed. The two declared scope
reductions (Claude Code `capability-gap`; one-shot adapter `no-log`) are
consistent with the ticket's "depends on GH-347" and its persistence task and are
stated in F-4/F-7, §8.4, §8.5 and Appendix B.

## Did any AC change meaning while keeping its id?

No silent change found. All 38 ids are present and reconciled against §17 by
feature (7/6/5/7/4/5/4). The four criteria whose text moved — AC-F2-3 (no-log
meaning), AC-F2-6 and AC-F7-3 (stream-wide concatenation), AC-F4-7 (seam raw,
query composes) — are documented in §26 v1.4 and their meaning moved in the
direction the corresponding finding asked for. AC-F1-6's outcome text is
unchanged and still consistent with API-6 (the order itself lives in API-6,
F-1, DM-1 and `TC-STATUS-006`, which is sufficient to make it checkable).

## Residual risks the human decider inherits

- TDR-0058 is `Proposed` after four REWORK-challenged rounds (no PASS claimed).
  It is the binding design of this change; acceptance is the owner's at PR
  review, and the DR-4 naming-input refinement (finding 8) should be in the
  record before that acceptance.
- The proof boundary is fixtures, not live storage: opencode `current`/`legacy`
  generations only (RSK-15), injected probe verdicts (no kernel semantics),
  scripted streaming, planted torn tails, no real snapshot race, no real
  disk-full or `0600` enforcement (Appendix C, §1.2).
- Declared divergence, not parity: the typed tail is the harness's own stdout
  (opencode JSON events); the shell's `--log` tails the child's stderr, and the
  wrapper's progress lines go to its terminal (RSK-12; documented in phase 6
  reference page and the operations guide).
- Claude Code lanes answer `capability-gap` for `last-message` and `no-log` for
  `log`; no page may claim general harness support.
- Redaction covers registered credential values only; prose and harness-printed
  values pass through within the bound (RSK-18).
- Two-file retention can lose the start of a long run; the reader declares one
  truncation fact rather than presenting a fragment as whole (RSK-14/21), and
  same-ref concurrency can evict a still-growing older stream's evidence
  (RSK-20).
- One open question is carried by the test plan, not decided by the spec: a ref
  first delivered by opencode and later by Claude Code would have an artifact
  directory but no new stream (`no-log` vs the existing family). No AC covers
  it; the coder is asked to record the reading (test plan §8.3 item 4). The
  spec's "no artifact exists" wording does not resolve it.
- Operational prerequisite: `TMPDIR=$PWD/tmp/tmpdir`, `PATH=$PWD/node_modules/.bin:$PATH`,
  and `pnpm build` before any `jaiship` invocation.
- Delivery cannot start while findings 1–3 stand: phase 3 would be red or a
  phase-4 commit would edit an undeclared file, and the case owner for
  `TC-PERSIST-005/006` is contradictory between the two artifacts.

## Remediation routing

- delivery_planning: findings 1, 2, 4 (and 3 if the plan's allocation changes)
- test_planning: findings 3, 5, 6, 7, 10, 11
- specification: findings 8, 9
- delivery: not a remediation target for any finding.

Re-run this gate after the revisions; this is iteration 2 of the 3-iteration cap.
If the same three blocking findings persist on iteration 3, escalate to the human
rather than looping.
