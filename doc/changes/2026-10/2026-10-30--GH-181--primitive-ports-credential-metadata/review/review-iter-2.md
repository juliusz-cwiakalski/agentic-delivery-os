# Code Review — GH-181 Iteration 2 (Independent Local Re-Review)

- **Change**: GH-181 — M0-S12: Primitive ports, credential port, and embedded metadata
- **Reviewer**: `@reviewer` (local mode), invoked as the Phase 6.3 independent re-review after remediation
- **Date**: 2026-10-30T22:13:34Z
- **Diff ground truth**: full change `git diff origin/main-tools..HEAD`; remediation delta `git diff 7121ee3..HEAD` (`da1b00a`, `e45207e`, `a12bbc5`, `d7a7779` + uncommitted doc-reconciliation edits in two spec files and the doc-syncer-report addendum)
- **Dedup base**: `code-review/review-iter-1.yaml` (F-1 major, F-2/F-3 minor, F-4/F-5 informational)
- **Verdict**: **PASS** — 0 blockers, 0 majors, 0 minors, **2 informational** (+1 informational suppressed as iter-1 F-5 class). R-1, R-2, R-3 verified genuinely closed by independent re-execution of the original reproductions. No remediation tasks appended; no plan changes required.

## 1. Remediation Verification (original reproductions re-run by this reviewer)

| Remediation | Original failure | Re-executed now | Result |
|---|---|---|---|
| **R-1** (`da1b00a`) computed-key ambient reads | `process[key]`, `` process[`env`] ``, `globalThis[name()].env` → zero violations | `sourceViolations()` probe on all three forms | **All three flagged** with detail `ambient element access with non-literal key on <host>`; `Bun[key]`, `Deno[key]`, bare `globalThis[key]` also flagged |
| **R-1** no-regression | — | literal key `process["env"]`, property `process.env`, optional chain, aliased `process` | All still flagged with their original rule details (detection outside the slice unchanged) |
| **R-1** fixtures/tests | — | `tests/fixtures/secret-boundary/cases.ts` + suite | 3 new fixtures (`computed-key-env`, `template-literal-key-env`, `computed-global-name`); suite **15 pass / 0 fail** (was 14); clean control green; non-vacuous — reverting the fix zeroes the new assertions |
| **R-1** live tree | — | `bun run scripts/checks/secret-read-boundary.ts` | OK — **51 production files clean** (matches evidence record); `git status --porcelain` identical before/after (read-only) |
| **R-2** (`e45207e`) quadratic marker scan | 193 KB hostile comment → 1747 ms (iter-1 measurement) | 232 KB hostile comment + 216 KB hostile compact through `parseEnvelope` | Both bounded (< 1000 ms; commit records 110 ms class) and degrade as **`missing`**; cap math sound — `MARKER_PAYLOAD_MAX_CHARS = ENVELOPE_MAX_BYTES` with bytes ≥ chars keeps every spec-valid envelope matchable |
| **R-2** no-regression | — | near-bound valid envelope (byteLength 1639 > 1500 asserted) + typical round-trip | Near-bound envelope parses with logical equality; ordinary round-trip control green |
| **R-2** regression test | — | TC-META-002 hostile test | Asserts > 200 KB input, < 1000 ms bound, `missing` — reverting the cap fails the time bound (pre-fix extrapolates to seconds); near-bound test fails if the cap is set too low. Non-vacuous |
| **R-3** (`a12bbc5`) stale-index strip corruption | nested compact lookalike in comment payload + trailing content → `""` | `stripEnvelope` on `<!-- … {x:"[delivery.metadata.v1:{…}]y"} -->\nTAIL` | Returns **`TAIL`** (was `""`); parse degrades `malformed` with `humanContent === "TAIL"`; valid envelope whose payload *is* a lookalike round-trips intact with human content kept |
| **R-3** no-regression | — | strip identity at beginning / middle / end | Exact equality preserved for all three placements (`collectMarkerSpans` + ascending non-overlapping single-pass rebuild; indices refer only to the untouched input) |
| **R-3** regression tests | — | TC-META-002 (2 tests) + TC-META-003 (1 test) | Exact-equality `toBe("TAIL line that must survive")` assertions — vacuity-proof against the pre-fix `""` output; 6/6 degradation matrix unchanged with visible `malformed`, body intact, `structural === false` |

**Smallest-adequate-change check**: R-1 adds one host set (`AMBIENT_ELEMENT_HOSTS` = process/Bun/Deno/globalThis) and one else-branch; R-2 caps two regex quantifiers with a constant + rationale comment; R-3 rewrites only the span-bookkeeping inside the codec. No collateral edits; full suite parity confirms no behavior change outside the three slices.

## 2. New-Issue Scan of the Remediation Delta (`7121ee3..HEAD` + uncommitted docs)

Reviewed every hunk of `da1b00a`, `e45207e`, `a12bbc5`, `d7a7779` and the end-state of `envelope-codec.ts` and `secret-read-boundary.ts`. Adversarial probes beyond the original repros: property-chain reach-throughs (`globalThis.process.env`, `globalThis.Bun.env` — both caught by the aliased rule), `globalThis["process"].env` (caught by literal-key rule), `import p from "process"` (caught by runtime-import rule), destructured reads (caught), adjacent markers, marker-at-boundary strip identities, newline swallowing in `removeMarkers`, regex `lastIndex` state sharing between `parseEnvelope` and `collectMarkerSpans` (both reset — no leak). **No blocker/major/minor issues found.** Two informational observations recorded as findings (§5): a pre-existing `require()` reach-through residual in the invariant (unreachable through the gate battery — see F-6) and the host-agnostic literal-key false-positive class (fail-closed direction — F-7).

## 3. Evidence Records vs Reality (spot-check)

| Claim (plan 6.1/6.2, R-1..R-3 records; test-plan §10 rows; execution log Phase 6 row) | Verified |
|---|---|
| R-1 "suite 15 PASS, live scan 51 files clean" | ✓ 15 pass / 0 fail; OK — 51 production files clean |
| R-2 "216 KB hostile 3201 ms → 110 ms, degrades `missing`; near-bound parses; 1000 ms regression bound; bound documented in `feature-adapter-ports.md`" | ✓ post-fix behavior independently reproduced; bound paragraph present in the spec (committed in `e45207e`) |
| R-3 "`TAIL` preserved (was `''`); regressions in TC-META-002/003; F-4 limitation documented" | ✓ all reproduced; limitation paragraph present |
| "Targeted `bun test` 306 PASS" | ✓ 306 pass / 0 fail across 39 files |
| "`pnpm check` 610 PASS (was 604)" | ✓ 610 pass / 0 fail, exit 0 (delta = 6 new regression tests: 604 + 6 = 610) |
| "`git diff --check` clean" | ✓ clean |
| Task 6.3 recorded as pending re-review | ✓ honest state; this iteration closes it |

Task 6.1 ("reproduce first, regression with each fix") and 6.2 ("fixes, fixtures, docs together; no error-table or allowlist change needed") records match reality — each fix commit carries its regression(s), and no registry/table changes were required or made.

## 4. Doc Reconciliation of the Remediation Delta (uncommitted edits — content verified)

- `doc/spec/features/feature-adapter-ports.md` patched invariant sentence and `doc/spec/features/feature-monorepo-scaffold-toolchain.md` patched paragraph: **each clause matches implemented behavior** — literal-key element rule (env/ambient-global names), computed/template-literal key fail-closed on the four hosts, runtime imports, aliased globals, ignored identifier positions, fixture coverage claim (literal via `globalThis["process"]`, computed-key, template-key fixtures all exist). Verified clause-by-clause against empirical probes.
- doc-syncer-report addendum: R-2/R-3 "no change needed" claims are accurate — the pre-existing spec text describes only outcomes (bounded scan paragraph landed with `e45207e`; strip outcome guarantees unchanged by the span rewrite); no stale literal-key-only, unbounded-scan, or stale-index claim remains in `doc/**` current-truth docs.
- Addendum consistency claims re-run by this reviewer: doc-distribution guard "no drift — 80 in-scope docs" ✓; forbidden-literals "5/5 scope classes, 0 violations" ✓; no source/spec/plan/test-plan/pm-notes touched by the uncommitted edits ✓ (only the two spec files + the addendum).

## 5. Findings

| ID | Severity | Location | Summary |
|---|---|---|---|
| F-6 | info | `scripts/checks/secret-read-boundary.ts:126` | `require("node:process").env` (and `import.meta.require`) silently accepted by the invariant — the runtime-import rule covers import declarations only. Pre-existing within this change's new invariant (verified identical at `7121ee3`); **not** a remediation regression and outside R-1's enumerated element-access scope. Unreachable through the gate battery: `tsconfig.base.json` pins `types: ["bun"]`, `@types/bun` declares no `require`, and no `@types/node` is installed, so the form fails typecheck (binding in CI) before the invariant is consulted. Suggestion: future defense-in-depth hardening — flag `require`/`import.meta.require` call expressions naming `process`/`bun` modules, or document as an unsupported form with a negative control per task 4.1's discipline. No action required for this change. |
| F-7 | info | `scripts/checks/secret-read-boundary.ts:148` | Literal-key element rule is host-agnostic: `record["process"]` / `record["env"]` on arbitrary non-ambient objects is flagged (fail-closed false positive). Pre-existing (identical pre-fix), conservative by design, and live tree green (51 files). No action required; noted so future allowlist consumers understand the false-positive class. |
| F-8 | info (suppressed — dup of iter-1 F-5) | plan execution log Phase 6 row | Wall-clock labels continue to drift from git history (Phase 6 row dated date-only "2026-10-30"; remediation commits stamped 21:53–21:59Z). Same accepted informational class as iteration-1 F-5; substantive evidence is accurate. No action. |

No other findings. Iteration-1 F-1/F-2/F-3 are **closed with verified fixes**; F-4 was closed by documentation (verified present); F-5 accepted (no action).

## 6. Standing Checks

- **`pnpm check`**: exit 0 — **610 pass / 0 fail** (expected 610), incl. `pnpm build`, boundaries chain, ambient-globals (18 neutral files), secret-read-boundary (51 files), exports-parity/attw, dependency cruise.
- **Protected paths**: `scripts/*.sh`, `tools/**`, `.opencode/**`, `.ados-claude/**` untouched across the full branch diff; only permitted additions (`scripts/checks/*.ts` new check + registry) and the single additions-only `ts-invariants` CI line.
- **Contracts-tier purity**: remediation did not touch `packages/core/**`; ambient-globals green; codec remains adapter-internal with zero runtime imports.
- **License headers**: none added by the remediation (the `doc/planning/concepts/primitive-catalogue.md` header predates this change — introduced on `main-tools` at `9786dc1`, GH-164); glossary "copyright" matches are SPDX glossary prose, not headers.
- **Live-tree read-only discipline**: `git status --porcelain` identical before/after live invariant runs; reviewer probes executed from the external tmp workspace only.

## 7. Verdict

**PASS.** Zero blockers, zero majors, zero minors; two informational notes (neither actionable in this change). R-1 is verified closed with fixtures and independent reproduction; R-2 and R-3 likewise. The remediation is the smallest adequate change with no regression outside the fixed slices; evidence records and doc reconciliation are accurate.

- Plan status: 6.1/6.2 done and accurate; **6.3 can now be checked** citing this iteration (`review/review-iter-2.md`, `code-review/review-iter-2.yaml`). No remediation phase appended — no plan changes required.
- Next step: **PROCEED** — close task 6.3, stage the uncommitted doc-reconciliation edits via `@committer`, then complete 7.5 (open PR to `main-tools`).
