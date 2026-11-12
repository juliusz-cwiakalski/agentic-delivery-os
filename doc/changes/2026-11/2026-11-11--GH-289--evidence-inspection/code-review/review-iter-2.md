# Code Review — GH-289 (M2-S12: Evidence inspection and divergence resolution) — Iteration 2

- **Iteration:** 2 (re-review after `review_fix` remediation)
- **Mode:** local (ADOS review gate, `review_fix` output)
- **Branch:** `feat/GH-289/evidence-inspection`
- **Base:** `origin/main-tools` merged at `d36d75c0` (GH-268 pre-PR commitlint gate); remediation commit `f9fab824`
- **Artifacts reviewed:** `chg-GH-289-spec.md` v1.5 (36 ACs), `chg-GH-289-test-plan.md` v1.3 (39 TCs, unchanged by remediation), `chg-GH-289-plan.yaml` revision 2.2 (5 phases), `chg-GH-289-pm-notes.yaml`, [`review-iter-1.md`](./review-iter-1.md), [`review-iter-1.yaml`](./review-iter-1.yaml)
- **Machine record:** [`review-iter-2.yaml`](./review-iter-2.yaml)
- **Reviewed at:** 2026-11-11

## Verdict

**Status = PASS**

Every iteration-1 finding (F-1…F-10, I-1) is genuinely closed by reading the changed code and the
assertions — not by trusting the remediation report. No product behaviour changed: the diff against
the merge base touches exactly two source files, `packages/cli/src/commands/dispatch.ts` (a
behaviour-preserving refactor that derives the delivered-flag guard from the definition) and
`packages/cli/src/help.ts` (one attempts help-summary line). The remaining remediation is in test
suites/fixtures, the spec (two AC wording corrections), the plan (one phase-3 scope row) and pm-notes.

There are no genuine blockers. Two non-blocking observations (O-1, O-2) are recorded below; neither
requires action and neither contradicts an AC, a plan phase, or a test-plan cell.

## Closure of prior findings (verified, not trusted)

| ID | Sev | Location | Verified closure | Evidence I read / ran |
|----|-----|----------|------------------|-----------------------|
| F-1 | medium | `tests/behaviour/dispatch-attempts-contract.test.ts:333-390` | **Closed.** Two new cells assert the exact sorted envelope key set: 8 always-present keys for a `--limit 3` page on 5 records, and those 8 **plus** `truncation` (with `scope: "page"`) for a byte-bound page, plus `Object.hasOwn(data,"truncation") === false` for the unbound page. The field list equals spec Appendix D's eight (`repository, ref, refSource, limit, matched, hasMore, attempts, excluded`). | Read cells at `:344-390`; suite green (72 targeted pass). |
| F-2 | medium | `tests/behaviour/dispatch-divergence-count.test.ts:44-53, 107-155` | **Closed.** (a) A 25-open + 3-resolved, **no-foreign** fixture asserts `28/3/25`, `unresolvedIds.length === 20`, `idsTruncated === true`, and block key order (`:120-155`). (b) The human `unresolved_divergences=` line is now asserted to equal `unresolvedIds.join(",")` for the >20 case (`:107-113`) and the unmigrated case (`:150`). | Read cells; suite green. |
| F-3 | medium | `tests/behaviour/dispatch-attempts-scope.test.ts:156-278`; `tests/fixtures/dispatch/attempts-harness.ts:104,133`; `tests/fixtures/dispatch/attempts-production.ts:106` | **Closed.** `countStore` now exposes a real `releaseFence` counter (`attempts-harness.ts:96-137`). A **successful** read cell (`:156-180`) asserts `readRecords +1`, and `append`/`acquireFence`/`releaseFence` unchanged. The production cell (`:182-251`) uses `harness.snapshot` → real **sha256** (`production.ts:106`) and asserts whole-store and ledger byte equality; asserts project-marker before/after with `state === "present"`; asserts host-index writes `≤1` on first and `0` on the second (text) invocation; and asserts the text digest discloses no absolute path. The torn-binding cell (`:255-278`) writes a torn `dispatch-identity.json` and proves the read neither repairs nor re-persists it. All cells execute and pass (not defined-but-unused). | Read harness + fixture + all three cells; suite green. |
| F-4 | medium | `packages/cli/src/help.ts:437`; `tests/structure/dispatch-attempts-composition.test.ts:39-43` | **Closed.** The `dispatch attempts` help entry now names `dispatch dual-run summary --repo <repo>` for "coverage and floor"; TC-029 step 3 asserts both substrings on `attempts.summary`. AC-F7-2 is now served by both help surfaces. | Read both; suite green. |
| F-5 | low | `chg-GH-289-spec.md:448` (AC-F2-2) | **Closed.** AC-F2-2 now states the machine row carries `endedAt`/`startedAt`/`recordedAt` and the digest prints **only** `startedAt`, with `endedAt`/`recordedAt` machine-only; recorded in spec §25 history as v1.5. Matches the delivered renderer and golden `attempts.txt`. | Read spec diff (`f9fab824`). |
| F-6 | low | `tests/behaviour/dispatch-attempts-ref.test.ts:194-263` | **Closed.** Six declared ref shapes (`241`, `gh-241`, `GH-`, `GH241`, `GH-241-extra`, `""`) plus the unknown flag and the unexpected positional; each refusal asserts the summary names the supplied value (the message also names the canonical shape and an example `GH-289`), and "nothing appended" is declared as the store-port append counter in the docstring. AC-F1-6 identity (exit 1, `input.value.rejected`, zero reads, no `attempts.*`) asserted. | Read cells; suite green. |
| F-7 | low | `tests/structure/dispatch-attempts-count-rule.test.ts` | **Closed.** Genuine TypeScript-AST + import-graph check: declaration exactly once in the domain tier; signature admits a repository scope and both call sites pass one (`:189+`); both consumers import the same exported symbol through the import graph; exactly one latest-per-identifier fold; no `unresolved`/`resolved` count derived from `unresolvedIds`; retirement scan over `packages/**` + `tests/**` reports file:line. **Detection power proven:** the mutation `unresolved: unresolvedIds.length` is caught and reported as `packages/core/src/domain/dispatch-gate.ts:10: unresolved: unresolvedIds.length` (standalone AST probe mirroring the test's predicate). | Read test; ran probe; suite green. |
| F-8 | low | `tests/checks/dispatch-attempts-test-isolation.test.ts:35` | **Closed.** `NEW_SUITES` now includes `tests/structure/dispatch-attempts-composition.test.ts`, so "every new suite" is literal. | Read; suite green. |
| F-9 | low | `packages/cli/src/commands/dispatch.ts:212-213, 220-221, 272-275` | **Closed.** The allowed flag set is derived at call time from `definition.flags` + `definition.requiresValue`, which are themselves the definition vocabulary (`DELIVERED_FLAGS`/`DELIVERED_VALUE_FLAGS` feed the definition). A flag added to the definition can no longer be refused by drift; the four delivered forms still refuse an undeclared flag at `fallback.invocation` exit 1 (additive-stability cell 7, green). | Read code; ran additive-stability suite. |
| F-10 | low | `chg-GH-289-plan.yaml:1083` | **Closed.** Plan revision 2.2 adds `tests/behaviour/dispatch-additive-stability.test.ts` to phase 3 `scope.files` with a co-owned-suite note (phase 2 owns cells 1/4/5/7, phase 3 owns cells 2-3). `plan validate GH-289` = valid / `tier=full` / `readyForDevelopment=true`. | Read diff; ran plan validate; verified commit `b95695dc` touched that file. |
| I-1 | info | `chg-GH-289-spec.md:457` (AC-F4-3) | **Closed.** AC-F4-3 now says each failure exits with its row's delivered projection (`state.permission.denied` → exit `1`; platform state rows → exit `2`). Confirmed against `error-table.ts:440-446` (`projectionClass: "user-validation"`). | Read spec + error table. |
| I-2 | info | `packages/cli/src/commands/dispatch.ts` (`positionals.max: 3`) | Unchanged; not required to change. Single-positional refusal still satisfies AC-F1-6. | No action. |
| I-3 | info | `packages/core/src/app/dispatch-attempts.ts` (generic checkout message) | Unchanged; AC-F3-3 satisfied in substance. | No action. |
| I-4 | info | `packages/cli/src/output/dispatch-text.ts` (`utf8Bytes` duplicate) | Unchanged; no new duplication introduced. | No action. |
| I-5 | info | full-tree gate | Environmental; reconfirmed by isolation runs below. | No action. |

## No-regression evidence

**Source blast radius.** `git diff --name-only d36d75c0 HEAD -- packages/*/src/**` returns exactly
`packages/cli/src/commands/dispatch.ts` and `packages/cli/src/help.ts`. The `dispatch.ts` change is a
line-for-line move of the existing handler into a named `definition` object plus derivation of the
guard set from that object; branch order, guards, positionals, `acceptsAnyFlag`, `exitProjection`,
`humanText` and every `failure`/`fallbackInvocation` call are unchanged. `help.ts` is a one-line
summary change.

**Delivered contracts unchanged.**
- Closed error table: `error-table-sync` green — **124** source entries / **124** documented rows; `dispatch` domain kind **4**; no `attempts.*` identity in source, table, help, or output.
- Bounds (`dispatch-attempts-bounds`), ordering/digest (`dispatch-attempts-digest`), taxonomy (`dispatch-attempts-taxonomy`), refusals (`dispatch-attempts-refusals`), composition, isolation — all green.
- No manifest/lockfile diff since the merge (`pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `packages/*/package.json` untouched); the one five-package minor changeset `.changeset/gh-289-…-minor.md` is unchanged and still declares "no error identity, record kind, schema version, configuration key, dependency, token, projection class, or exit literal is added". No new exit literal or token appears in the `dispatch.ts` diff (moved lines only).

**Gates re-run (this session).**

| Check | Result |
|---|---|
| Remediation suites (contract, divergence-count, scope+production, ref, count-rule, composition, isolation) | **72 pass / 0 fail** |
| Affected + regression set (additive-stability, bounds, digest, refusals, resolve-result, taxonomy, composition, resolve-composition, help-inventory, help-version, isolation, doc-conformance) | **74 pass / 0 fail** |
| `tests/{behaviour,structure,conformance}/dispatch` (69 files) | **461 pass / 0 fail** |
| Structural/registry gates (reference-page-parity, doc-conformance, error-table-sync, exports-parity, privacy-release, privacy-literals) | **160 pass / 0 fail** |
| registry gates (content-inventory, port-contract-inventory, error-table-sync, exit-code-literals, privacy-literals, subpaths) | **171 pass / 0 fail** |
| `pnpm typecheck` (tests/types + cli package) | exit 0 |
| `pnpm check:boundaries` (depcruise + ambient/entrypoints/secret-read) | 385 modules, 0 violations |
| `check:prompt` / `check:help` / `exports-parity` / `forbidden-literals` / `privacy-literals` | clean / all covered / 5 publishables / 0 violations / 0 violations |
| `scripts/.tests/test-doc-distribution.sh` | 83 in-scope docs, no drift |
| `plan validate GH-289` | valid / `tier=full` / `readyForDevelopment=true` |
| GH-268 gate suite `scripts/.tests/test-lint-commit-range.sh` | **50/50 passed** |

**Host-load handling (explicit, per the brief).**
- `tests/checks/exit-code-literals.test.ts` — **untouched** by the diff (`git diff d36d75c0 HEAD` is empty) and **15 pass / 0 fail in 2.87 s** when run alone; the known TC-EXIT-002 race with concurrent `pack` is a host-load artefact only.
- `tests/checks/privacy-ci-wiring.test.ts` — **untouched** by the diff and **14 pass / 0 fail in 7.68 s** when run alone with a 30 s budget; the ~5.9 s TC-WIRE-002 vs 5 s default is host load, not a regression.
- The full aggregate was **not** re-run as a single command on this loaded host (the 908-file run was abandoned mid-flight); per the brief this is not required, and every change-relevant suite and structural/registry gate was re-run individually and is green, with the two known-flaky suites passing in isolation.

## Merge-integrity (GH-268 commitlint gate)

The `origin/main-tools` merge `d36d75c0` is clean: no conflict markers in tracked sources; `scripts/lint-commit-range.sh` is present, executable, registered in `ADOS_DELIVERY_SCRIPTS` (`scripts/install.sh:130`) and `scripts/uninstall.sh:433`; `AGENTS.md` describes the phase-9 gate; `check:prompt` is green (the gate's prompt contract is intact); its own test suite passes 50/50. Nothing the merge introduced conflicts with GH-289's delivered behaviour.

## Plan / test-plan alignment

- Plan revision 2.2 validates (`tier=full`, ready). The only delta from 2.1 is the F-10 phase-3 scope row plus the co-owned-suite note and verbatim revision header — no other phase, scope, or expected outcome changed.
- The test plan is byte-for-byte unchanged by the remediation; every closed finding now satisfies the cells the unchanged plan declares (envelope key set for TC-028, unmigrated baseline + human line for TC-022, counters/sha256/markers/host-index for TC-014, help pointer for TC-029, six ref shapes for TC-039, AST/import-graph for TC-038, full `NEW_SUITES` for TC-036).
- `plan diff GH-289` still cannot run in this worktree (`input.value.rejected` — the CLI's diff port is uncomposed); the phase-3 file list was compared mechanically instead and the F-10 omission is now declared.

## Observations (non-blocking, no action required)

- **O-1 (info):** `packages/cli/src/commands/dispatch.ts:211` — the doc comment on the flag vocabulary reads "…the four delivered forms, and of `attempts`", but `attempts`' `--ref`/`--limit` are not in those arrays (the subform relies on `acceptsAnyFlag` + its own grammar). The comment is slightly inaccurate; behaviour is correct. Optional: drop "and of `attempts`".
- **O-2 (info):** TC-014's expected outcome says the store-port counters are asserted "across both invocations"; the delivered counters wrap one **successful JSON** invocation (`scope.test.ts:156`), while the text invocation's effects are covered by the production cell (sha256, both markers, host-index writes). Because the read path is output-form-independent, the property holds; this is a literal test-plan-fidelity note only.

## Next step

**PROCEED** → `dod_check`. No remediation phase is required; every prior finding is closed and no new
finding was raised. This artifact and `review-iter-2.yaml` are the only files written by this review.
