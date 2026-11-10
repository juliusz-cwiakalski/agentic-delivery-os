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
  state; active parks keep `parked:<cause>`; stuck parks keep
  `park-condition-stuck`; a resumable park becomes `held`; `owner-hold` is the
  first blocking reason. Claim refuses before ref selection (so a no-ref claim
  never returns `no-eligible-action`) and the fenced claim refuses before the
  fence; dispatch refuses before claiming. Both use the existing
  `queue.precondition.unmet` identity at exit 1 with the token exactly
  `owner-hold`. The mutating park-recovery pass is skipped, so a parked lane does
  not resume at its provider window. Bookkeeping (`add`, `prioritize`, `dep`,
  `release`) remains available.
- **Visibility.** `status` adds the optional evidence-level
  `providers.evidence.ownerHold` member and a bounded human suffix. `doctor`
  keeps the provider check `ok` and adds the single non-failing annotation reason
  `owner-hold` plus an appended bounded detail that survives the detail clamp.
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
3. Run `status --json` and `doctor --json`; record
   `providers.evidence.ownerHold`, the `ok` provider check with the `owner-hold`
   annotation reason and the appended hold segment, and exit `0`.
4. Run `queue claim` **with no ref** and a `dispatch`; record
   `queue.precondition.unmet`, `reason=owner-hold`, the bounded detail and
   summary, exit `1`, zero records, and zero sessions. Record that `owner-hold`
   means wait/do-not-abort (D19), not a transient retry.
5. Show an expired park staying parked with unchanged bytes while held.
6. Remove the marker; show the next pass resuming from unchanged records with one
   session.
7. Record the known limits: no kill switch, no MCP queue surface, no BSD runner,
   the seam-observed 4 096-byte read bound, and GAP-T7 (the production resident
   daemon is not wired).

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

## Verification

- `pnpm check`: exit 0 — 7127 pass, 4 skip, 0 fail (7131 tests, 879 files); lint,
  format, typecheck, boundaries, ambient-globals, secret-read, prompt, help, and
  exports-parity all green.
- `bash scripts/run-bash-suites.sh`: 26/26 suites pass.
- `shellcheck` on both new scripts: zero findings.
- `bash scripts/.tests/test-doc-distribution.sh`: no drift (82 in-scope docs).
- `pnpm exec delivery-os plan validate GH-280`: `verdict=valid`,
  `tier=full`, `readyForDevelopment=true`.
- `pnpm build` and `pnpm exec delivery-os --version` (0.0.0) succeed.
- Inactive queue/status/doctor/lanes/MCP goldens are byte-identical; only the
  declared held fixtures/goldens were added.

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
- Phase 8 includes formatting-only edits (biome format) to files committed in
  earlier phases, required to make the aggregate format gate green. No behavior,
  fixture content, or assertion meaning changed.
