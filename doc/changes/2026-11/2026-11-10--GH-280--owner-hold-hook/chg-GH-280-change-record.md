# GH-280 Change Record — owner hold that outranks provider windows

Status: Delivered to `main-tools` for review.
Date: 2026-11-10
Change: [chg-GH-280-spec.md](./chg-GH-280-spec.md)
Plan: [chg-GH-280-plan.yaml](./chg-GH-280-plan.yaml)
Test plan: [chg-GH-280-test-plan.md](./chg-GH-280-test-plan.md)

## Delivered summary

One owner-hold fact with two equivalent sources now outranks every provider
window:

- **Fact.** `OwnerHoldFact` is resolved per pass from the brand-derived
  `<PREFIX>_OWNER_HOLD` environment value, the fixed production store directory
  `<home>/<stateDirectoryName>`, and its `owner-hold` marker. Environment wins
  when active; an unreadable, non-regular, or stat-failing marker is active
  without a reason (fail closed); only a non-existent path is inactive. The
  reason is stripped of ANSI/C0/C1, folded to one line, and truncated to 160
  characters.
- **Shell path.** The inactive example
  `scripts/hooks/pre-opencode-iteration-owner-hold.sh` registers exactly one
  default condition, `howLongToSleepDueToOwnerHold()`, applies no provider/model
  gate, and has no fixed iteration cap. It recognises exactly
  `<PREFIX>_OWNER_HOLD` and `<PREFIX>_OWNER_HOLD_POLL_SECONDS` (default `300`,
  accepted `1`–`3600`), reads the marker only at the fixed production store path,
  and emits one bounded reason line per sleep.
- **Typed path.** An active hold empties the next-action list and emits no
  preemption proposal. `ready` becomes `held`; `held` and `not-ready` keep their
  state; `owner-hold` is prepended to every gated entry's ordered `blocking[]`,
  including active and stuck parks, which keep their state `parked`/`stuck` and
  park reason `parked:<cause>`/`park-condition-stuck`; a resumable park becomes
  `held`. Claim refuses before ref selection (so a no-ref claim never returns
  `no-eligible-action`) and the fenced claim refuses before the fence; dispatch
  refuses before claiming. Both use the existing `queue.precondition.unmet`
  identity at exit 1 with the token exactly `owner-hold`. The mutating
  park-recovery pass is skipped, so a parked lane does not resume at its provider
  window. Bookkeeping (`add`, `prioritize`, `dep`, `release`) remains available.
- **Visibility.** `status` adds the optional evidence-level
  `providers.evidence.ownerHold` member and a bounded human suffix. `doctor`
  reports the hold whenever a `DoctorComposition` is supplied — the
  command-runtime/test-harness layer — keeping the provider check `ok` and adding
  the single non-failing annotation reason `owner-hold` plus an appended bounded
  detail that survives the detail clamp. The production composer supplies no
  `DoctorComposition` today (a pre-existing doctor residual, GAP-T8), so
  `status` is the only production operator surface that reports the hold.
  `queue ready` is unchanged and carries no hold.

## Operator communication

- Create a hold with either `export <PREFIX>_OWNER_HOLD="<reason>"` or
  `printf '<reason>\n' > <home>/<stateDirectoryName>/owner-hold`. The marker is
  preferred for durability across processes.
- There is **no marker-path override and no store relocation** for the hold. The
  shipped example defaults to the production path of this product; adopters who
  rename the product edit that default (the environment source is
  relocation-safe).
- The hold is **not a kill switch**. A session already running continues until it
  ends or its provider cuts it out; a `partial` lane may remain.
- A held claim or dispatch is a **classified user-validation refusal at exit 1**,
  not an internal wait. `owner-hold` means wait/do-not-abort to deferral callers;
  it is never a transient retry.
- Clearing a hold is `unset <PREFIX>_OWNER_HOLD` plus
  `rm <home>/<stateDirectoryName>/owner-hold`. No state repair, migration, or
  branch/worktree action is needed.

## Additive contract and rollback

Additions: `OwnerHoldFact`/`OwnerHoldSource` and the `OWNER_HOLD_*` constants;
`QueueSchedulerFacts.ownerHold?`, `QueueReadData.ownerHold?`; the lane/blocking
reason `owner-hold`; `StatusProviderFacts.ownerHold?` and
`StatusEvidence.ownerHold?`; `DoctorProviderFacts.ownerHold?` and the evidence
reason `owner-hold`; the optional `readOwnerHold` runtime hooks; the new adapter
reader and the new example hook. No new park cause, park condition type,
recovery state, state record kind, queue-ready condition, status section, status
reason, doctor verdict, doctor summary count, doctor condition, doctor evidence
source, doctor area, error identity, domain kind, command, flag, or configuration
key.

Rollback: revert the change. A hold writes nothing, so no record written before
the change depends on it, and no migration or state repair is required.

## Manual evidence (TC-HOLDE2E-001)

Status: **NOT EXECUTED during this automated delivery.** The procedure is
PR-scoped and must be run in a disposable clone and disposable `HOME`; its
transcript belongs in the pull request. The automated suites prove the same facts
through injected composition and seams (GAP-T1), but the operator-run sequence
below is still required before merge:

1. Create a disposable root under `./tmp/tmpdir/e2e-gh280` and set `HOME` to it.
2. Create `<home>/<stateDirectoryName>/owner-hold` with
   `peak-hour cost pause`.
3. Run `status --json`; record `providers.evidence.ownerHold` and exit `0`.
   `status` is the only production operator surface that reports the hold. Do
   **not** run production `doctor`: the production composer supplies no
   `DoctorComposition`, so the production binary does not register `doctor`
   (GAP-T8). Doctor hold evidence is covered at the command-runtime layer by
   `TC-HOLDDOCTOR-001..007` over an injected `DoctorComposition`.
4. Run `queue claim` **with no ref** and a `dispatch`; record
   `queue.precondition.unmet`, `reason=owner-hold`, the bounded detail and
   summary, exit `1`, zero records, and zero sessions. Record that `owner-hold`
   means wait/do-not-abort (D19), not a transient retry.
5. Show an expired park staying parked with unchanged bytes while held.
6. Remove the marker; show the next pass resuming from unchanged records with one
   session.
7. Record the known limits: no kill switch, no MCP queue surface, no BSD runner,
   the seam-observed 4 096-byte read bound, GAP-T7 (the production resident
   daemon is not wired), and GAP-T8 (the production composer supplies no
   `DoctorComposition`).

## Known gaps

- **GAP-T1 — one operator-run end-to-end proof.** TC-HOLDE2E-001 is manual and
  PR-scoped; it is the only real CLI end-to-end proof.
- **GAP-T2 — real permission failures are not deterministic on every runner.**
  The `chmod 000` case is skipped as root; the deterministic permission case uses
  an injected `EACCES`, and a real directory-at-path is always exercised.
- **GAP-T3 — the 4 096-byte read bound is observed at the reader seam.** The real
  adapter is additionally exercised over a 10 KB temp file.
- **GAP-T4 — no MCP queue surface exists.** MCP parity covers `status`; the queue
  composition pin is CLI-only.
- **GAP-T5 — BSD/macOS portability is proven by construction, not by a runner.**
  The example uses bash builtins for existence and read checks and no `stat` or
  `date -d`; no BSD runner is in the battery.
- **GAP-T6 — the reason-line grammar is pinned behaviourally.**
- **GAP-T7 — the production resident daemon is not wired.** The guarantee is
  conditional on a supervision cycle whose `nextAction` seam derives from the
  held pass; the resident-daemon residual is unchanged.
- **GAP-T8 — the production composer does not compose `doctor`.**
  `createProductionComposer` supplies no `DoctorComposition`, and
  `createConfigProgram` registers `doctor` only when one is supplied, so the
  production binary rejects `doctor` as outside the composed prompt-required
  set. Doctor's owner-hold support is a command-runtime/test-harness capability;
  `status` is the only production operator surface that reports the hold. Wiring
  production doctor is a pre-existing residual owned by the doctor feature, not
  this change.

## Verification

- `pnpm check`: exit 0 after review remediation — 7133 pass, 4 skip, 0 fail
  (7137 tests, 880 files); lint, format, typecheck, boundaries, ambient-globals,
  secret-read, prompt, help, and exports-parity all green.
- `bash scripts/run-bash-suites.sh`: 26/26 suites pass.
- `shellcheck` on both new scripts: zero findings.
- `bash scripts/.tests/test-doc-distribution.sh`: no drift (82 in-scope docs).
- `pnpm exec delivery-os plan validate GH-280`: `verdict=valid`,
  `tier=full`, `readyForDevelopment=true`.
- `pnpm build` and `pnpm exec delivery-os --version` (0.0.0) succeed.
- Inactive queue/status/doctor/lanes/MCP goldens are byte-identical; only the
  declared held fixtures/goldens were added.
- Review remediation focused runs: owner-hold fact/reader 30/30 (including the
  two-pass zero-count recorders), production composition 3/3 plus the structure
  pin 5/5, and the touched doctor/queue/status/conformance suites 232/232 across
  12 files; `pnpm typecheck`, `pnpm check:boundaries`, shellcheck (0 findings),
  the hook suite (13/13), the doc-distribution guard (82 in-scope docs, no
  drift), and `plan validate GH-280` (`verdict=valid`,
  `readyForDevelopment=true`) are green.

## DoR-2 minors resolved

1. The doctor provider evidence-source count is corrected to eleven sources
   across five areas (four in the provider area) and six provider evidence
   reasons in the spec §2.1 and the plan's phase 4 verification.
2. `TC-HOLDFACT-009` is declared as a split case (resolver-surface half in phase
   1, composition canary in phase 5) in the plan's coverage invariant.
3. The structural test compares `QUEUE_LANE_IDLE_REASONS` and
   `QUEUE_BLOCKING_REASONS` to the named fixture arrays with exact two-way ordered
   equality; no containment inference remains.

## Scope deviations

- `packages/mcp/src/commands/status.ts` received a two-line optional reader. The
  MCP status tool runtime type lives there; the plan scope listed only
  `packages/mcp/src/serve.ts`, so the reader could not reach the MCP digest
  without it.
- `tests/structure/error-table.test.ts` had its expected
  `queue.precondition.unmet` remediation hint updated to the new operator-hold
  wording. This is the regression test for the identity that phase 2 changed.
- The doc-sync reconciliation touched seven files beyond the feature specs and
  command pages: `doc/00-index.md` (index summary), `doc/overview/glossary.md`
  (the owner-hold term), `doc/planning/oss-tooling/milestones/m1/commands/dispatch.md`
  (the dispatch refusal), `doc/quality/test-specs/test-spec-autonomous-delivery.md`
  (the autonomous-delivery test spec), `doc/spec/features/feature-config-layer.md`
  (the no-new-key note), `doc/spec/features/feature-dispatch-engine.md` (the
  dispatch refusal), and `doc/spec/features/feature-resident-daemon.md` (the
  conditional-residual note).
- Phase 8 is **verification plus the lint/format edits**, not formatting-only.
  It includes the behavior-preserving construction change in
  `packages/core/src/domain/owner-hold.ts` (the control-character and ANSI
  patterns are built with `new RegExp`/`String.fromCharCode(27)` to satisfy a
  lint rule with identical matching behaviour), the functional
  `queue.precondition.unmet` hint expectation in
  `tests/structure/error-table.test.ts`, and biome formatting/reindent of files
  already declared in phases 1–7. No assertion meaning, fixture content, golden
  byte, or runtime behaviour changed.

## Review iteration 1 remediation (D20–D25)

Code review iteration 1 (`code-review/review-iter-1.yaml`) returned FAIL with one
high, two medium, six low, and two info findings. Dispositions:

| Finding | Disposition |
|---|---|
| F-1 (high) production doctor claim | **Fixed by claim correction, not by wiring production doctor (D20).** The spec, plan, this record, the changeset, `doc/guides/delivery-modes.md`, `doc/planning/oss-tooling/milestones/m1/commands/doctor.md`, and `doc/spec/features/feature-doctor.md` now state that doctor reports the hold only when a `DoctorComposition` is supplied; the production composer supplies none, and `status` is the only production operator surface. The `doctor --json` E2E step is removed and GAP-T8 records the residual. |
| F-2 (medium) commit subjects | **Accepted under D21.** The `commit` primitive composes the subject; template-fallback subjects are accepted, no history is rewritten, and the tree is byte-identical. The plan's phase `summary` remains a plan description, not a hand-authored commit message. |
| F-3 (medium) composition test | **Fixed by D22.** New `tests/behaviour/owner-hold-production-composition.test.ts` drives the real `createProductionComposer` over a temp HOME whose `<stateDirectoryName>/owner-hold` marker is materialized on disk, covering queue list/plan, supplied-ref and no-ref claim, dispatch, and status, with a marker-removal mutation control and per-pass restore. The structure suite's source-text check is secondary only. |
| F-4 (low) doc-sync scope | **Fixed.** The seven doc-sync files are declared above and in phase 7 scope. |
| F-5 (low) phase-8 scope | **Fixed.** Phase 8 is described as verification plus the lint-driven regex construction and the error-table expectation, above. |
| F-6 (low) park blocking array | **Fixed in the spec and test plan (D25).** `owner-hold` is prepended to every gated entry's ordered `blocking[]`, including active/stuck parks, whose state and park reason are preserved and rendered on the lane surface. |
| F-7 (low) DM-4 payload shape | **Fixed in the spec (D25):** `{ source; reason? }`, the active fact projected without its `active` member. |
| F-8 (low) stale test-plan/pm-notes claims | **Fixed (D25):** test-plan §2 records the valid plan, §7.3 describes the 28-entry `laneIdleReasons` and 27 → 34 `blockingReasons`, and D1 carries its inline D12 supersession marker. |
| F-9 (info) shell read bound | **Fixed.** The hook comment now states the 4 096-character shell read versus the engine's 4 096-byte bound; behaviour is unchanged. |
| F-10 (low) adapter existence check | **Fixed.** `packages/adapters/src/file/owner-hold-marker.ts` uses an error-aware `lstatSync` existence check: `ENOENT` is absent, every other stat failure (including an unreadable parent store directory) is unreadable/fail-closed. Reader tests cover the injected stat failure and a root-skipped real unreadable-parent case. |
| F-11 (info) TC ids and counts | **Fixed.** Relevant suites carry their TC ids (`TC-HOLDDOCTOR-006`, `TC-HOLDQUEUE-011`, `TC-HOLDSTATUS-004`, `TC-HOLDNEG-001/002`, and the `TC-HOLDDOCS-004` script mapping); `TC-HOLDFACT-009` now records exactly zero credential, transport, store-write, and spawn calls across two passes. |

No acceptance criterion, delivered golden, closed set, or runtime behaviour moved
in this remediation.
