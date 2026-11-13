# Code Review — GH-292 queue lifecycle (iteration 2, re-review after Phase-10 remediation)

- **Mode**: local re-review of the remediation delta — commits `7bc93867` (code + tests + spec v1.3 + feature pages) and `498c1e24` (pm-notes evidence) — read against the full branch (`git diff main-tools...feat/GH-292/queue-lifecycle` for regression checks).
- **Reviewed against**: the iteration-1 FAIL record (`code-review/review-iter-1.yaml`, 1 high / 1 medium / 2 low / 3 info — see IT2-F-1 for the mid-review archiving note), `chg-GH-292-spec.md` v1.3, `chg-GH-292-plan.yaml` Phase 10, `chg-GH-292-pm-notes.yaml` remediation entries, repo review config, and the delivered tree.

## Verdict

```
Status:               PASS
Remediation Phase:    NONE (no plan changes required)
Findings Count:       4 (0c / 0h / 0m / 0l / 4i)
Spec Compliance:      PASS   (v1.3 delta = NFR-3 + F-5 sentence + history row, exactly as declared)
Plan Compliance:      PASS   (Phase 10 executed per declared goal/DoD; scope extensions
                             disclosed and PM-sanctioned; completion evidence present)
Test Coverage Gaps:   NONE
Next Step:            PROCEED (review_fix iteration 2 PASS → quality_gates → dod_check
                             → pr_creation)
```

**F-1 (high) and F-2 (medium) are closed with evidence** — details below.

## Acceptance-bar verification

### 1. F-1 (high) — stale-lease removal liveness — CLOSED

- **All three removal paths apply the delivered predicate.** `removeQueueEntryWithinFence` refuses only when `held !== undefined && !isLeaseStale(held.heartbeatAgeMs, held.ttlMs)` (`packages/core/src/app/queue.ts:1333`); the closeout hook `queueRemovalForCloseout` applies the identical predicate before its `lease-held` skip (`queue.ts:1452`) and apply mode delegates the removal itself to the same F-1 seam (`queue.ts:1460`); reconcile routes every removal through the full `removeQueueEntry` verb (`queue.ts:1739`) and inherits the predicate. `isLeaseStale` is the delivered, unchanged predicate (imported; defined since GH-237; `7bc93867` added call sites only — it is the same predicate the active-lease folds at `queue.ts:1135/1181` and the renewal path at `queue.ts:2102` use).
- **The three new stale-lease cells exist, two-sided**, in the phase-10-declared files: explicit verb (`tests/behaviour/queue-remove-lease.test.ts` — at TTL−1 ms the lease is live, refuses `queue.precondition.unmet` with zero appends; at the inclusive TTL bound removal succeeds; the stale lease is still not released), closeout apply (`tests/behaviour/closeout-queue-removal-skips.test.ts` — `removed` with the removal record verified, no `lease-held` skip), reconcile (`tests/behaviour/queue-reconcile-invariants.test.ts` — removes over a stale lease; the fold no longer contains the entry).
- **Delivered controls untouched and green.** `tests/behaviour/queue-lease.test.ts` and `queue-lease-concurrency.test.ts` have an empty diff across the entire branch (zero assertion change trivially holds). Re-run: 37 pass / 0 fail / 238 expect() across the six suites (queue-remove-lease, closeout-queue-removal-skips, queue-reconcile-invariants, queue-lease, queue-lease-concurrency, closeout-queue-removal-cost).

### 2. F-2 (medium) — duplicate removals scan / NFR-3 read budget — CLOSED

- **The duplicate scan is gone.** `readQueueFold` no longer calls `readQueueRemovals`: `readQueueEntriesAndRemovals` classifies the entry and removal ledgers from one shared verified snapshot, the fold reuses the classified removals, and `readQueueEntries` keeps its exported signature (`queue.ts:476-537, 696-727`).
- **The read observable is pinned** by counting-store assertions in TC-QLC-082 (`tests/behaviour/closeout-queue-removal-cost.test.ts`): one fold = 2 whole-store reads; no-entry closeout = 2; plan-with-entry = 3 (fold 2 + lease 1); apply-with-removal = 13, decomposed in the assertion as hook fold 2 + hook lease 1 + removal body 10.
- **The recorded direct measurements reproduce.** This review re-measured with the same counting wrapper outside the repo tree: explicit `removeQueueEntry` = **10** reads; reconcile over one done ref = **12** (fold 2 + removal 10). Both match the pm-notes remediation entry exactly.
- **Spec v1.3 NFR-3 is reconciled two-sided**: the row now states the fold = exactly 2 reads (one shared snapshot for entries+removals, dependencies the second) and the no-entry path = exactly 2 reads, "as pinned by the counting-store assertions (TC-QLC-082)", replacing the unreachable "at most 1 read" wording. Spec text, pinned tests, and measurements agree.

### 3. F-3 (low) — CLOSED

Spec §5.1 F-5 ("An unreadable tracker removes nothing") gains the sentence documenting the unwired-tracker-port composition refusal: `queue.precondition.unmet` with blocking reason `tracker-read-unavailable`, stated as a composition precondition distinct from the provider-side classifications. Exactly one sentence; nothing else in F-5 changed.

### 4. F-4 (low) — CLOSED

`CloseoutCompositionOptions.nowMs` is optional (`nowMs?: () => number`) with the derived default `() => Date.parse(options.nowIso())` (`packages/cli/src/edge.ts:1598-1609, 1985-1988`); the two delivered-fixture `nowMs` additions from `741b0d2a` are reverted byte-exactly, restoring the untouched fixtures. Closeout suites green: composition-facts in the 26-pass batch; closeout-integration 8 pass / 0 fail.

### 5. F-5..F-7 (info) — no regression; F-7 accepted

The remediation diff touches no flag, help, or ready-verb surface, so nothing was disturbed chasing the informational findings. F-7's `queue ready` fact-source wording rides the next spec revision as recorded (pm-notes retro + plan Phase-10 header).

### 6. No new issues introduced by `7bc93867`

- **No weakened assertion.** All test changes are additive (+43, +44, +22, +111 lines) except the two single-line `nowMs` fixture deletions, which revert additions made by `741b0d2a` — verified both directions.
- **F-4 precedence table / seven-row queue error kind / delivered five rows.** The commit touches neither `contracts/taxonomy.ts` nor `commands/queue.ts`; `error-table-sync` OK (entries=129 documented=129, unchanged count).
- **Append-only discipline.** The queue.ts diff is exactly six hunks (read refactor ×3, one docstring, two predicate call sites); no delete/rewrite/re-key of records anywhere; golden fixtures untouched.
- **Spec v1.3 scope.** Three hunks only: NFR-3 row, F-5 sentence, history row v1.3.
- **Feature pages aligned with delivered truth**: scheduling-engine's removal refusal set and closeout's when-it-runs + invariant bullet state live = heartbeat age below TTL via the shared `isLeaseStale` predicate — matching the code.

### 7. Background battery

A supplementary `pnpm check` battery was executing on this tree during the review (started 05:51 local). Per instruction, not treated as a finding; the code was judged directly.

### Plan compliance and repo rules

- Phase 10 was appended by the iteration-1 reviewer (header records the FAIL), executed in `7bc93867`, and carries pm-notes completion evidence naming the phase, commit hash, and gate results (typecheck OK; targeted suites 105 pass / 0 fail across 25 files; error-table-sync OK). Goal and all four DoD bullets verified in code and tests. Scope: all eight declared files touched as declared; `packages/cli/src/edge.ts` and the two fixture reverts sit outside `scope.files` and are disclosed in pm-notes as PM-instructed extensions (legitimate). The declared full-battery gate was deferred to quality_gates per PM instruction — disclosed (IT2-F-2).
- Phase registry (pm-notes `phases:` block) shows `review_fix` open and command-written millisecond timestamps elsewhere — no hand-edited state. Commits carry the primitive's per-file template subjects (the disclosed template behavior). `.ados-claude/` has an empty diff across the whole branch.

## Findings

| ID | Sev | Conf | Category | Location | Owner | Summary |
|----|-----|------|----------|----------|-------|---------|
| IT2-F-1 | info | high | process | `code-review/review-iter-1.yaml:1` | PM (already effected) | Transient artifact anomaly, resolved mid-review: at review start the FAIL record was absent from the canonical path (an earlier lifecycle PASS occupied it, plus a misplaced nested `code-review/code-review/` copy); the artifacts were then reorganized — FAIL record at the canonical path (finding set verified against the governing record), earlier PASS archived as `review-iter-1-pre-remediation.*`, nested dir removed. No further action; optionally pair the FAIL yaml with a `.md`. |
| IT2-F-2 | info | high | plan-compliance | plan Phase 10 gates | quality_gates | Declared `pnpm check` gate deferred to quality_gates per PM instruction (disclosed); supplementary battery was running during this review. Record the final battery + range-lint verdicts as pm-notes evidence before pr_creation. |
| IT2-F-3 | info | high | repo-rules | change folder `events.jsonl` (absent) | future capsule tooling change | No capsule events/candidates for any phase — pre-existing tree-wide (no command surface writes capsule events yet; spec-only). Not a remediation regression. |
| IT2-F-4 | info | high | spec-compliance | spec §5.1 F-1 (line 162) | spec owner, next revision | F-7 `queue ready` fact-source wording accepted to ride the next spec revision; verified no regression chasing F-5..F-7. |

## Remediation routing

Status is **PASS** — no remediation phase is added and no plan changes are required. IT2-F-1 was resolved during the review itself (archive effected); IT2-F-2's battery-verdict recording rides quality_gates; IT2-F-3/F-4 need no action in this change.

---
*Generated by the ADOS `reviewer` agent — local mode, iteration 2. Machine verdict: `review-iter-2.yaml` (same directory).*
