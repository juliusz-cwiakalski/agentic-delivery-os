# Code Review — GH-292 queue lifecycle (iteration 1)

- **Mode**: local (`git diff main-tools...feat/GH-292/queue-lifecycle`; 143 files, +15,732/−548)
- **Reviewed against**: `chg-GH-292-spec.md` v1.2 (46 ACs), `chg-GH-292-plan.yaml` (9/9 phases), `chg-GH-292-test-plan.md` v1.2 (§7.1 canonical pin table), `chg-GH-292-pm-notes.yaml` (phases 1–9 evidence), repo review config (`.ai/agent/code-review-instructions.md`), and the delivered tree.
- **Gate evidence relied on**: `TMPDIR=$PWD/tmp/tmpdir pnpm check` = 7,830 pass / 4 skip / 0 fail over 1,009 files, two independent green runs (`gh292-phase9-pnpm-check-fix3.log`, `-fix2.log`, both `PNPM_CHECK_EXIT=0`); range lint PASS; error-table-sync 129/129; doc-distribution no drift. Gate-owned properties (format, typecheck, depcruise, exports parity) were verified as *run*, not re-checked line-by-line, per the repo review instructions.

## Verdict

```
Status:               PASS
Remediation Phase:    NONE
Findings Count:       6 (0c / 0h / 0m / 1l / 5i)
Spec Compliance:      PASS   (46/46 ACs implemented; no contradiction found)
Plan Compliance:      PASS   (ALL_TASKS_DONE; 9/9 phases with per-phase pm-notes
                             commit-hash + gate evidence matching the registry)
Test Coverage Gaps:   NONE   (all 13 §7.1 pin rows moved two-sided; disclosed
                             deviations verified legitimate)
Next Step:            PROCEED (lifecycle review_fix complete → quality_gates →
                             dod_check → pr_creation)
```

No finding blocks merge. The single low finding is an evidence-gap, not a code defect; remediation is one pm-notes sentence and can ride the PR.

## What was verified (dimensions 1–5)

### 1. Spec compliance — PASS

**F-1 removal.** `queue.removal` declared exactly per DM-1 (`delivery.queue.removal.v1`, `queue.removals:<REF>`, `ref` identity, fields `schema|ref|reason|recordedAt|callerPrincipal` optional, closed four-value reason set) in `contracts/queue.ts` with the sixth `QUEUE_RECORD_DECLARATIONS` row. **DM-2 presence rule** implemented as `queueRefPresent` — latest entry `sequence` vs latest removal `sequence`, never `recordedAt`; applied inside `readQueueEntries` (the single read seam every fold consumer uses), so list/plan/lanes/graph/snapshot all follow. Refusal set exact and pre-append: `queue.reason-missing` (missing flag), `input.value.rejected` (bad/missing value, non-canonical ref — AC-F1-2 vs AC-F1-3 split pinned at the CLI handler), `queue.entry.unobserved` (absent/already-removed — explicit verb deliberately not idempotent, DEC-8), `queue.precondition.unmet`+`lease-held` naming the holder (DEC-9). Park withdrawal appends the delivered `recoveryState: "released"` record before the removal (DM-3); both appends verified post-append inside one fence; derived document replaced only on truth change (`sameDocument` compare, DM-4). No cascade: consumer edges untouched, `dependency-unobserved` holds (DEC-10). Re-declaration restores, including the equal-`recordedAt` cell, proven in both directions (`queue-remove-redeclare.test.ts`).

**F-2 closeout auto-removal.** Additive optional `queueRemoval?: CloseoutQueueRemovalData` non-step block with the closed outcome/skip vocabularies exactly per DM-6. The hook is assigned after the step writes, inside the fence the transaction already holds (`domain/closeout.ts` — no second acquisition); plan mode reports `would-remove`; `mergedObserved === false` → `skipped/no-merge-truth`; re-run/never-entered → `satisfied` at exit 0; step outcomes and exit code structurally independent of the hook (fail-open, NFR-3).

**F-3 dependency edges.** `dep add` routes to the delivered `dep` operation (deep-equality proven between spellings — AC-F3-1); `dep remove` returns `removed | noop` with `removed[]` populated on the `dependency-edge` event and zero appends/zero events on noop (DEC-15); cycle check add-only; verb token never parsed as a ref (only canonical refs proceed, ambiguity cells pinned). Ready set recomputed per read; mutation payload reports became-ready refs.

**F-4 single-flight — the exact precedence table.** `dispatchAdmissionRefusal` (one whole-store read, proven `reads === 1` with a counting store) refuses **any** live same-ref lease regardless of holder with `queue.single-flight`; other-ref live lease → delivered `queue.lease-conflict`; stale → abstain (delivered takeover). `claimSingleFlightRefusal` refuses only another holder's same-ref lease; own-holder same-ref falls through to renewal; other-ref falls through to `queue.lease-conflict`. Renewal narrowed to `(repository, ref, holder)` — the delivered `same holder` branch gained exactly `&& existing.ref === ref`, own-holder renewal still evaluated before staleness (delivered order preserved, so the two delivered direct-seam lease controls stay green untouched). Wired on the dispatch family's `claimLease` port in `production.ts` before claim/spawn/record, with the owner-hold precedence intact; the daemon supervision cycle threads the holder through its injected claim port (AC-F4-3, no production spawn). Refusal purity proven (record count, active-lease fold, and folded refs identical before/after). `detail.holder` rides the envelope root: `toErrorObject` untouched (six-field `CommandResultError` preserved), the record-shaped detail copied after the error is built, and `explicitDetail` enforces the bound at runtime — over-128, multiline, or non-string holders are dropped, never projected (DM-7/TDR-0027 ALT-3). The two CLI-level pins that asserted the old same-ref conflict truth moved two-sided and *re-prove* the delivered `queue.lease-conflict` on the other-ref path.

**F-5 reconcile.** Read pass completes for every examined entry before the first removal (the phase-6 rework that closed the partial-removal hole); exactly one bounded sequential tracker read per entry over the injected verified bridge (`readTrackerDeliveryState` over the closeout client's per-item observation — no new adapter op, no `status` list read); cap 100 with exact `truncated`/`remainder` and no read beyond the cap; `done`/`canceled` → `reconciled` via the ordinary F-1 seam; open states retained with their observed alias; not-found → `unobserved` retained; unreadable read → the provider identity's own projection, zero appends, no `queue.*` synonym (AC-F5-4); second-run convergence truthful (`checked` counts still-existing entries, AC-F5-9).

**F-6 events.** `emitted: true` on `remove`; the projection maps one `queue.removal` record to one `remove` event in the ref's lane with payload keys exactly `ref|reason|recordedAt`; exactly-once and repeated-tick non-duplication proven; noop/refusal/skip publish nothing; sequence stays the projection's per-`(topic, lane)` counter and no mutation result asserts one (DEC-12).

**F-7 mount/help/errors.** Exactly two new verb help paths (`queue remove`, `queue reconcile`), the rewritten `queue dep` entry with the corrected two-positional synopsis and no `--on`, family entry and `--reason`/`--ref` flags declared to the grammar; `dep add|remove --help` renders the one `dep` entry (longest-prefix fallback, disclosed). Queue error kind exactly seven rows in declared order — delivered five unchanged, `queue.reason-missing` (user-validation, exit 1, non-retryable), `queue.single-flight` (user-validation, exit 1, retryable).

### 2. Code quality — clean

Security: tracker read only through the injected declared credential port (no ambient env read added anywhere in the diff); `detail.holder` bounded/identifier-only and enforced at the seam; reconcile payload identifier/count/timestamp only; CLI tokens refused as grammar and never echoed (privacy suite, including an ambient canary). Performance: admission guard exactly 1 whole-store read / 0 records; reconcile one read per entry, cap 100, no retry/pagination/concurrency; closeout hook ≤1 fold + ≤2 appends (NFR-3 asserted). Correctness: fences held and shared (closeout hook reuses the transaction's handle); append-only discipline respected (no delete/rewrite/re-key anywhere in the diff); derived document replaced only on truth change. Boundaries: no new package/subpath/adapter; runtime-neutral contracts; no product literals in tooling code (`ados queue` in the registry is pre-existing convention); ports inventory regeneration is additive two-sided.

### 3. Tests — no weakened assertion found

All 13 §7.1 pin rows moved as declared, each as a complete-value comparison: non-emitted lists `[…remove] → []` via `toEqual([])`; `emitted` flags `false → true`; `declared.size`/`scriptedFrames` `12 → 13`; `kind.emitted` conditional `!== "remove"` → unconditional `true` (strictly stronger); the emitted-kinds source scan moved to the exact positive form (projection must contain `kind: "remove"`, other modules remain literal-free); registry/baseline counts `127 → 129`; record kinds `5 → 6`; the delivered queue goldens byte-identical (no file under `tests/fixtures/queue/golden/` changed) with new cases as new files. The `toContain` usages that exist (source-literal scan, per-kind describe line) are the natural form for those checks and are stronger than the delivered forms they replaced. Disclosed deviations verified legitimate: TC-EVT-006's allowlist admits exactly the two declared producer literals in `commands/queue.ts` (contract-required payload disclosure, narrow allowlist); TC-PORT-001 regeneration adds only the new closeout constants/types; TC-WIRE-002 is a per-test timeout ceiling (120s), not an assertion change; closeout-facts count moves track the delivered composition facts; the `dep add` existing-entry `updated` result is the AC-pinned spelling equality; `queue ready`'s fact-source cell matches the delivered surface.

### 4. Docs reconciliation — complete

Commit `886a11ae` (+ `fdb70d86`) reconciles scheduling-engine, dispatch-engine, closeout, event-taxonomy, resident-daemon, state-layer, result-contract, architecture-overview, glossary, 00-index, and the M2 `commands/events.md` emitted sentence. No page still claims `remove` unemitted, five queue rows, or five record kinds; the per-pass vs per-ref single-flight distinction is stated in the glossary and the spec pages; the state-layer page carries the six-kind table with the presence rule.

### 5. Repo rules — clean

Phase registry timestamps match pm-notes exactly for all seven completed phases (`phase list` verified). Both TDRs staged record-plus-row in one commit each (TDR-0027 in phase 2's `86b0429e`, TDR-0026 in phase 9's `741b0d2a`), index order TDR-0025 → 0026 → 0027 as pinned, both status `Proposed`. `.ados-claude/` untouched (empty diff). No license headers added by agents (no header-managed path touched outside the script). No product literals in tooling code.

## Findings

| ID | Sev | Conf | Category | Location | Owning phase | Summary |
|----|-----|------|----------|----------|--------------|---------|
| F-1 | low | high | plan-compliance | `packages/core/src/app/daemon-supervision.ts:87` | 2 | Holder threading on the supervision claim port landed outside every declared `scope.files` (spec §16 and the Phase-2 goal cover it; `daemon-compose.ts` was declared but untouched); the pm-notes phase-2 entry discloses the inverse without naming this drift. Evidence gap only — behavior spec-conformant and tested. Fix: one pm-notes sentence; no code change. |
| F-2 | info | high | plan-compliance | `biome.json:1` (+7 test files) | 2/6/7/9 | Eight files outside declared scopes, each individually disclosed in pm-notes with two-sided remedies (biome overrides, the two CLI-level F-4 pin moves, TC-EVT-006/TC-PORT-001/TC-WIRE-002, closeout-facts counts). Disclosures are the escalation record; plan artifact not reopened. |
| F-3 | info | high | repo-rules | pm-notes `retro` entry | all | Per-file template commit subjects with the literal `…` truncation in three; standalone `commit GH-292` invocations instead of `commit --phase <n>` (primitive rejects numeric phase ids). Disclosed retro; range lint PASS. |
| F-4 | info | high | spec-compliance | spec §5.1 F-1 (line 162) | — | F-1 prose lists `queue ready` among fold-derived surfaces; delivered `ready` evaluates status facts and never read the fold. AC-F1-1 doesn't name `ready`; disclosed phase 5. |
| F-5 | info | medium | correctness | `packages/core/src/app/queue.ts:1704` | 6 | A mid-sweep F-1 refusal (e.g. lease acquired after the read pass) returns the classified error with earlier removals applied — not the AC-F5-4 read-failure case, each append legitimate, converges on re-run per AC-F5-9. Defensible; noted against the "no partial-success envelope" wording. |
| F-6 | info | high | correctness | `packages/core/src/app/queue.ts:1440` | 3 | Missing apply-mode fence handle maps to `skipReason: "state-unavailable"` (nearest closed-vocabulary value for a wiring error); unreachable in production wiring; fail-open stands. |

## Remediation routing

Status is **PASS** — no remediation phase is added. F-1's one-sentence pm-notes evidence record (naming `daemon-supervision.ts` as a Phase-2 scope-list omission covered by the phase goal and spec §16) is recommended before `pr_creation` and can ride the PR; F-2..F-6 require no action.

---
*Generated by the ADOS `reviewer` agent — local mode, iteration 1. Machine verdict: `review-iter-1.yaml` (same directory).*
