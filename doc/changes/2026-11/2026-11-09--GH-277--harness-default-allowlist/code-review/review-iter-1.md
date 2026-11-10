# GH-277 Code Review — Iteration 1

- **Status:** FAIL
- **Mode:** local
- **Branch:** `fix/GH-277/harness-default-allowlist` (base `origin/main-tools`, merge-base `dbbc62cf`)
- **Reviewed at:** 2026-11-09T10:56:20Z
- **Canonical artifact:** `review-iter-1.yaml`

## Verdict

The functional repair is correct and well covered. The shipped default now declares
`PATH` and `HOME` required, `TMPDIR` optional, and `DELIVERY_WORK_PATH` injected; the
deny-by-default builder omits an absent optional entry and still fails closed naming a
required one; `OC_ADOS_*` is never forwarded or mapped; and the pre-session
`dispatch.session.spawn-failed` failure keeps its identity while carrying a bounded
`kind`/`code`/`field` detail in machine JSON and verbose human output, with non-verbose
text staying exactly four keys.

However, the change is **not PASS** because the delivered HEAD fails a required gate.

## Blocking finding

### F-1 (high) — forbidden brand literal in current-truth docs breaks CI

- `doc/spec/features/feature-config-layer.md:259`
- `doc/spec/features/feature-harness-adapters.md:227`

Both new lines contain `OC_ADOS_*`, which matches the repository forbidden seed literal
`ADOS_`. Evidence:

```
$ bun run scripts/checks/forbidden-literals.ts
FAIL forbidden-literals: doc/spec/features/feature-config-layer.md:259: ADOS_
FAIL forbidden-literals: doc/spec/features/feature-harness-adapters.md:227: ADOS_

$ bun test tests/checks/forbidden-literals.test.ts
(fail) delivered state > 5/5 scope classes are scanned with 0 violations
(fail) TC-ECON-084 ... the live scan includes the economics modules with zero violations
 2 fail
```

This makes `pnpm test` / `pnpm check` red (NFR-9, DoD-12) and fails CI jobs
`ts-forbidden-literals`, `ts-test`, and `ts-aggregate`. The regression arrived in the
`system_spec_update` docs commit after the P4 aggregate gate, so the recorded P4
"6612 pass / 0 fail" evidence no longer holds for HEAD.

**Fix:** reword both lines to avoid the `ADOS_` token (for example, "no ambient
provider-model environment variable is mapped or forwarded"). Keep the exact
`OC_ADOS_MAIN_MODEL`/`OC_ADOS_SMALL_MODEL` names in `doc/decisions/TDR-0021`
(allowlisted) and the change artifacts (excluded), or add a sanctioned allowlist entry.
Re-run `bun run scripts/checks/forbidden-literals.ts` and the aggregate gate.

## Non-blocking findings

- **F-2 (low)** `tests/fixtures/harness/config/optional-entry.yaml` is added but never
  referenced (test plan says TC-HDA-021/022 use it; they build the entry inline).
- **F-3 (low)** `tests/fixtures/harness/default-spawn.ts:81` roots the temp dir under
  system `tmpdir()`, not the test-plan §6.2 repo-local `join(ROOT, "tmp", "tmpdir")`.
- **F-4 (low)** The `detailOf` truncation path (`packages/core/src/app/dispatch.ts:211`)
  is untested; TC-HDA-034's over-bound case only inspects a hand-built object.
- **F-5 (low)** P4 completion evidence in pm-notes omits the commit hash (changeset/TDR
  landed in `e7699431`).

## Acceptance-bullet verification

| Ticket bullet | Result |
|---|---|
| Zero-config default spawn with a fake CLI on PATH succeeds, non-spawn-failed token | PASS (TC-HDA-010) |
| PATH resolution (bare command, off-PATH control) | PASS (TC-HDA-011) |
| Declared-absent variable fails closed naming the field | PASS (TC-HDA-035, builder + detail) |
| No ambient env leakage | PASS (TC-HDA-012) |
| Verbose/JSON surfaces underlying harness code/field | PASS (TC-HDA-031/032) |
| Non-verbose text stays four keys | PASS (TC-HDA-032) |
| Spawn-failed identity unchanged | PASS (TC-HDA-033, golden) |
| Deny-by-default preserved | PASS (builder + real-child suites) |
| No `OC_ADOS_*` forwarding | PASS (TC-HDA-012) |

## Gates run

- `bun test` on all touched behaviour/structure/golden suites — pass.
- `pnpm typecheck` (incl. `tests/types`) — pass.
- `pnpm lint`, `pnpm format:check`, `pnpm check:boundaries` (depcruise, ambient globals,
  secret-read boundary) — pass.
- `pnpm check:privacy-literals`, `check:prompt`, `check:help`, `exports-parity` — pass.
- `bun test tests/checks` — 2 change-caused failures (`forbidden-literals`) plus one
  environment-only failure (`ci-baseline-parity`, cross-device hardlink in `/tmp`,
  unrelated to the change).

## Next step

`EXECUTE_REMEDIATION_PHASE` — fix F-1 in the `system_spec_update` docs, then re-run the
forbidden-literal scan and the aggregate gate. No product-code change is needed for the
blocking defect.
