# Review Iteration 1

Verdict: PASS
Work Item: GH-179 (M0-S10)
Date: 2026-10-31
Reviewer: @reviewer (local mode, first iteration)
Reviewed range: f6c8d18..HEAD on `feat/GH-179/pm-notes-registry-lint-phase-transitions` (20 commits)
Inputs: spec v1.2, test plan v1.0 (25 TCs), plan v1.0 (12 phases, PIN-1..8, D1..D11), readiness-review/readiness-iter-1.md (READY, 3 nits)

Gate result: PASS — 0 blocker, 0 major, 3 minor, 4 info. Minors/infos are
non-blocking advisories (PR review + Phase 11/12 bookkeeping); Phase 10 code
remediation is not required.

## Facet Summary

| Dimension | Result |
|---|---|
| A. Spec compliance — AC-L1..L6 | PASS (all six verified against delivered tests, below) |
| A. Spec compliance — C-1..C-6 | PASS (schema vocabulary, variant sets, target semantics, matrix, records, error rows all exact) |
| A. Spec compliance — NFR-1..5 | PASS (each re-measured at this gate) |
| A. Plan compliance — Phases 1–8 | PASS (every task backed by its commit; gates re-run green) |
| A. Plan compliance — deviations | PASS (all documented deviations verified additive and spec-consistent) |
| A. Plan compliance — Phases 9–12 | OPEN by design (PM-scheduled); record-accuracy minors F-1/F-2 below |
| B. Code quality — security | PASS (secret boundary green; parser limits + tag allowlist; manifest path guard) |
| B. Code quality — correctness | PASS with minor F-3 and info F-4 (below) |
| B. Code quality — performance | PASS with infos F-5/F-6 (bounded; documented) |
| B. Code quality — error handling | PASS (classified identities; fences released; info F-7) |
| B. Repo rules | PASS (no protected path touched; tier/literal/inventory/doc gates green) |

## Verification Evidence (independently re-run at this gate)

1. `pnpm check` → exit 0: **913 pass / 0 fail**, 5461 expect() calls, 87 files;
   boundaries (`depcruise` 78 modules), ambient-globals (22 files),
   workspace-entrypoints, secret-read-boundary (63 production files),
   exports-parity all green.
2. `bun run scripts/checks/error-table-sync.ts` → `entries=26 documented=26
   S1=36 S3=14 corpus=13` — both directions agree; the five lint rows exist
   exactly once in `feature-result-contract.md` and round-trip with
   `ERROR_TABLE` (NFR-5: 5/5).
3. `bash scripts/.tests/test-doc-distribution.sh` → no drift (80 in-scope docs);
   the new feature doc correctly needs no `ados_distribution` marker
   (`doc/spec/**` is outside the guard's scope).
4. Focused suites re-run live: `phase-transitions` + `pm-notes-lint` → 40/40.
   Remaining GH-179 suites verified by reading assertions and by the 913-test
   aggregate above.
5. Protected-path proof: `git diff --name-only f6c8d18..HEAD` touches nothing
   under `.opencode/**`, `.ados-claude/**`, `.ai/**`, `scripts/*.sh`, `tools/**`,
   or `.github/**`; all changed files sit under `doc/`, `packages/`, `tests/`,
   or `scripts/checks/`.
6. AC audit against the delivered tests (non-vacuity checked, not just pass flags):
   - **AC-L1** — `phase-write-path-lint.test.ts` blocks all eight malformed
     classes + missing target + unrelated-missing-phase through the real command
     with the same pinned code standalone lint returns; each case asserts exit 1,
     envelope contract, zero ledger records, unchanged bytes, fence released,
     canary absent; valid control mutates exactly once. `pm-notes-lint-rejections.test.ts`
     pins one code per class at rule and command level with restored controls.
   - **AC-L2** — all nine matrix cells asserted with exit code + ledger delta +
     document change + evidence class together; no-op cells additionally assert
     unchanged target bytes; append-on-no-op and append-without-entry controls
     prove the assertions live.
   - **AC-L3** — `phase-rejections.test.ts`: rows 7–8 against valid/malformed/
     missing targets, recording seam proves zero runtime calls, and the
     deliberately wrongly-ordered control is caught (would return
     `lint.target.missing`); positive controls mutate.
   - **AC-L4** — six single-omission LITE fixtures each fail
     `lint.phases.incomplete` naming exactly the omitted phase; restoration
     passes; two-phase omission names both.
   - **AC-L5** — `phase-registry.test.ts`: torn (payload flip/framing/sequence),
     schema mismatch, missing declared key, verified-empty, and
     `state.write.failed` on rebuild are each exactly classified and mutually
     distinct; a mutating append over torn bytes is refused with zero records;
     detection-disabled control exposes the canary.
   - **AC-L6** — corpus derives from folder dates + manifest at run time
     (GH-170/172/173/174/181/179 members; GH-171 excluded only by the manifest;
     legacy folders absent); committed files lint clean read-only; malformed and
     missing-phase injections fail in temp copies; manifest guard (exactly one
     existing, genuinely unparseable path) blocks growth and widening.
7. NFR audit: NFR-1 via `pm-notes-imports.test.ts` (five detector rules, each
   with failing fixture + clean control + deletion meta-check), `cli-edge-seam`
   additions (composition, parser ownership at the edge, no exit decisions,
   seeded core-imports-CLI catch), and the extended packed probe reading runtime
   contract values and appending a `phase.transition`-shaped record on Node and
   Bun; NFR-2 via the envelope/exit matrices (0/1/2 exact, user→1, platform→2);
   NFR-3 via the determinism suite (replays, throwing ambient stubs, AST scan,
   tree digest, recording edge, cache-writing control caught); NFR-4 via the
   corpus fixture + schema-mutation control; NFR-5 via item 2 above plus
   containment/ambiguity tests.
8. Deviation audit (plan execution log): Phase 5's two deviations are genuine
   and additive — the state layer's `replaceDocument` appends its own
   `document` intent record (so the "kinds = [phase.transition]" assertion is
   correctly scoped to append-only records), and the transition payload carries
   the verified history under `transitions[]` because the port offers no
   all-records read (see F-5). Phase 6's two additions (`readPmNotesText` /
   `stagePmNotesPhaseEntry` in the same adapter module; `state-scope.test.ts`
   consumer allowlist superseding GH-174's "no consumer" premise) are documented,
   spec-consistent (the spec's code map already names the parser's document-edit
   API), and the superseded rule keeps a live seeded-violation control.
9. DoR nit disposition: N2 (spec adapters code-map row) — folded in 3d0d3cf
   (verified). N3 (TC-LINT-004 exit-2 oracle) — folded (pm-notes-lint.test.ts:260
   asserts exit 2 on the torn registry). N1 (plan timestamps) — NOT folded; see F-2.

## Findings

1. [minor] plan-compliance / evidence accuracy —
   `chg-GH-179-pm-notes.yaml:13` + `chg-GH-179-plan.md:715` + commit 3d0d3cf
   Gap: `system_spec_update` is recorded complete with "residual gaps: NONE"
   (and 3d0d3cf's message says "Residual gaps: none"), but plan tasks 11.5
   (`chg-GH-179-plan.md:491`) and 11.6 (`:492`) are unexecuted —
   `doc/planning/**` is untouched in the range: `cli-command-registry.md` still
   lists `ados lint`/`ados phase` without delivered markers, and
   `backlog.md` (M0-S10 section, :238) / `backlog-ranking.md` (:34) are unmarked.
   The plan execution log simultaneously reports Phase 11 "Not started" while
   3d0d3cf delivered seven of its nine touchpoints early (early doc-sync is
   allowed — the plan assigns gate ordering to the PM — but the records now
   contradict each other, and Phase 12's dod_check would inherit a false
   "NONE").
   Directive: before Phase 12, either complete 11.5/11.6 (planning-registry
   markers) or record their explicit reassignment in the plan; correct the
   execution-log row 11 to reference 3d0d3cf and its actual scope. Fold with F-2.

2. [minor] plan-compliance / DoR disposition — `chg-GH-179-plan.md:4-5` and `:698`
   Gap: DoR nit N1 (plan metadata timestamps contradict the delivery sequence:
   created 02:10:00Z / last_updated 02:16:29Z vs test plan authored 03:45Z and
   delivery_planning closing 04:10Z) was dispositioned "fold into the first
   execution-log update" — two plan edits followed (98ce450, 327b5b8) — but the
   timestamps and the v1.0 revision-log entry are unchanged. The review input
   brief claimed N1 already folded; the tree says otherwise.
   Directive: correct `created`/`last_updated` and the revision-log timestamp to
   the 03:45–04:10Z window at the next plan edit (no content change).

3. [minor] correctness / reliability — `packages/cli/src/commands/phase.ts:318-336`
   Gap: the landing sequence is append → writePmNotes → replaceProjection with
   no compensation. If the document write fails after a landed append, the
   command reports `fallback.internal` and the pm-notes entry stays open while
   the authoritative ledger says completed; re-running `complete` is a row-2
   no-op and never converges the document (recovery exists only via
   reopen + complete, landing two extra records). No test covers the failed
   `writePmNotes` branch. Ledger authority (PIN-6, RSK-2) makes this a
   consistency window rather than data loss.
   Directive (advisory for PR review / follow-up story): document the recovery
   path in the feature doc, and consider converging the document on a row-2
   no-op when the staged entry differs from the written entry; add a regression
   test for the failed-write branch if pursued.

4. [info] correctness / lint ordering nuance — `packages/core/src/domain/pm-notes-lint.ts:118-123`
   With an unknown `variant` string, `variantDecidable` gates the entry-level
   keys/types families, so a document with both an unknown variant and a missing
   `started` on an applicable entry reports `lint.variant.unknown` where a
   strict PIN-5 family order (keys before variant) would report
   `lint.keys.missing`. Single-defect behavior is exactly per C-6 (every class
   maps to one code); the gating is defensible (the applicable set is
   undecidable). Worth one sentence in the feature doc if anyone depends on
   cross-defect precedence. No action required.

5. [info] performance / registry payload — `packages/core/src/state/registry.ts:90-108`
   Each `phase.transition` payload embeds the full verified history
   (`transitions[]`), so store bytes grow quadratically over a change's
   lifetime. Documented Phase-5 deviation (the port offers no all-records
   read); bounded by lifecycle size (tens of transitions per change). Revisit
   only if a future story batches many transitions per change.

6. [info] performance / corpus fixture — `tests/behaviour/pm-notes-corpus-support.ts:146-154`
   `copyChangesTree` copies the entire `doc/changes` tree (all artifacts, not
   just pm-notes files) into a temp root for each of ~5 mutation controls per
   run. Hermetic and correct; scales linearly with repository history.
   Optional future optimization: copy only `chg-*-pm-notes.yaml` files.

7. [info] error handling / target read — `packages/adapters/src/file/pm-notes-parser.ts:200-205`
   A filesystem read error (e.g. EACCES) maps to `malformed` and surfaces as
   `lint.notes.malformed` (location = file path). Contained and classified —
   never a crash — but the identity conflates I/O failure with document
   malformation; acceptable within C-6's five-code budget. No action required.

## Gate Result

PASS. Phases 1–8 fully verified against spec v1.2, the 25-TC test plan, and the
plan's pins/bindings; the aggregate battery is green on this tree (913/913,
sync 26/26 both directions, doc-distribution clean, no protected path touched).
The three minors are record-accuracy and advisory items: F-1 and F-2 must be
folded before Phase 12 (PM bookkeeping inside the still-open Phase 11 window —
no code change, no Phase 10 remediation required); F-3 is a PR-review advisory.
Next step: PROCEED — close F-1/F-2 in the Phase 11 window, then Phase 12
(finalize/release) on the pushed HEAD.

Reviewed-by: @reviewer (iteration 1). Canonical machine state:
`../code-review/review-iter-1.yaml`.
