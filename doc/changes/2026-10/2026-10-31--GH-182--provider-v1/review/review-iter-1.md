# Review — GH-182 provider v1 (iteration 1)

Status: **FAIL**

Mode: local, first review. Consolidated from two bounded @reviewer passes (core/security; CLI/state/docs) because the single-run review exceeded the execution window. Diff base: `c1ba948` (DoR checkpoint). Head at review: `5e3c72f`.

## Verdict summary

- Core/security pass: FAIL — 2 medium, 2 low.
- CLI/state/docs pass: PASS with findings — 1 medium (doc drift), 1 low (test strength), 2 info.
- No critical or high findings. No secret-leakage path found. Exactly one confinement admission; secret-read allowlist unchanged at four entries.

## Findings requiring remediation

| # | Severity | Area | Finding | Required fix |
|---|----------|------|---------|--------------|
| R1 | medium | `packages/core/src/provider/parks.ts` persist/clear | A `cleared` record is appended whenever an active park is absent from the current resolution, even when it already expired (`prior.expiresAtMs <= nowMs`). DM-10 permits a cleared record only for a clear observed **before** expiry; an expired park must remain `expired` in `--all` views, with the `provider.resumed` announcement emitted on the next mutating resolve. | Gate the cleared record on `prior.expiresAtMs > nowMs`; emit `provider.resumed` unconditionally; add a clock-past-expiry test. |
| R2 | medium | `packages/core/src/provider/{engine,chain}.ts`; spec F-2/DM-7 | A single entry with a `failed` condition (quota exhausted, no valid reset) aborts the entire resolve even when a later entry is eligible. This contradicts F-2's first-eligible walk and DM-7's per-entry reason rule; multi-entry `[failed, eligible]` is untested. | Pin intended behavior in spec F-2, then implement: continue the walk, select the later eligible entry, report the failed entry as `quota-exhausted` and keep its announcement visible; if no later eligible entry exists, fail loud with the classified provider failure (no fabricated expiry). Add multi-entry tests. |
| R3 | medium | `doc/spec/features/feature-provider-engine.md` (composition-edge claim) | The spec claims the CLI edge imports the production credential port and quota transport. The delivered edge accepts an injected composition; no production module imports those factories yet. Violates the current-state doc rule. | Reword to the delivered truth: the host/binary composition injects the production credential port and quota transport; the edge wires them into the engine; tests inject fakes. |
| R4 | low | `packages/core/src/provider/validate.ts` | `quota: { enabled: false }` without `endpoint`/`credentialRef` fails with the misleading detail "references unknown credential". | Reject with the exact missing field path, or skip both relational checks when `enabled === false`; add the fixture/test. |
| R5 | low | `packages/core/src/provider/parks.ts` announcement evidence | `announcementEvidence` is a runtime pass-through and does not filter keys to the closed 11-field allowlist (the park path does). | Filter keys against `ANNOUNCEMENT_EVIDENCE_FIELDS`; add an over-bound/unknown-key test. |
| R6 | low | `tests/behaviour/provider-parks.test.ts` / `provider-cli.test.ts` | AC-F5-4 (park vs blocked lane) has no explicit test; the `parks list` read-only test uses a fresh empty store and only asserts an array exists. | Add an explicit park-vs-lane distinction test and reuse one store across the two `parks list` invocations (or rename the weak test). |
| R7 | info | `packages/core/src/provider/quota.ts`; spec §F-4 | Exhausted limit A with a past reset + exhausted limit B with no reset evaluates `clear` via the clamp path. Matches past-reset parity but the combination is neither spec-pinned nor tested. | Pin the intended outcome in the spec quota semantics and add a fixture/test. |

## Explicit unknowns (not passes)

- The bound passes did not execute tests or the secret-read/error-table checks; those are covered by the aggregate evidence and are re-checked in the quality-gate phase.
- Production registration of the `provider` command by a binary/host composition is absent for every command family at this stage; tracked as part of R3, not a GH-182 regression.

## Remediation path

1. Reopen `specification` and pin R2 and R7 semantics.
2. Add Phase 10 remediation tasks to the plan (R1–R7) and record the reopen/findings/retro in PM notes.
3. `@coder` remediates, `@doc-syncer` fixes R3 and re-syncs, then re-review the delta.
