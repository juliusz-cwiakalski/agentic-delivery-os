# Review Iteration 2 — GH-184: M0-S15: Privacy and no-cloud guards (re-review after remediation)

- **Reviewer**: `@reviewer` (local mode, plan Phase 8 iteration 2 / lifecycle phase 8)
- **Date**: 2026-10-31
- **Implementation HEAD reviewed**: `48dfa14` (remediation `e7dc4a9` + docs re-sync `0ad062a` + ledger/docs checkpoints `d085e5c`/`6415a28`)
- **Iteration-1 HEAD**: `fe0043e` · **Delta**: `git diff fe0043e..HEAD` (25 files; core: `privacy-rules.ts`, `envelope-content-policy.ts`, `privacy-literals.ts`, registry +2 entries, suites, docs, plan Phase 9)
- **Method**: independent closure verification — own runtime probe against the fixed module (8 matrices, below), full re-read of the remediation diff, re-run of all nine privacy/policy suites + structure/round-trip suites + `ci-checks.test.ts`, the full `pnpm check` battery, all CI invariant checks, the live-tree guard, and wiring/release integrity diffs. Nothing below relies on the coder's claims.

## Verdict: PASS

All twelve iteration-1 findings are independently verified closed. No new blocking, high, or medium findings. Two informational observations (N-1, N-2), neither requiring action before PR. Remediation tasks are **no longer required**; Phase 9 can be recorded complete on this verdict.

**Finding counts (iteration 2)**: 0 critical · 0 high · 0 medium · 0 low · 2 info

**Spec compliance: PASS** (the F-1 in-substance failure is resolved — all 22 ACs now hold both in tests and in delivered behavior) · **Plan compliance: PASS** (Phase 9 tasks 9.4–9.15 executed with matching artifacts; layout drift dispositioned)

---

## Independent verification performed (this review, not inherited)

**Runtime probe (reviewer-executed, committed module, outside the repo tree).** Matrices and outcomes — concrete firing values are deliberately not reproduced in this artifact; shapes are described:

| # | Case class | Result |
|---|---|---|
| A | All three platform home forms with markerless user segments — `/Users/` + segment, bare `/Users/` + segment, `C:\Users\` backslash, `C:/Users/` forward-slash, repeated separators (both `\\` and `//`), `/home/` form, and a prose-embedded `/Users/` path | **All fire** (`private.absolute-user-path`, unsuppressed) |
| B | Intended placeholders — synthetic/your/fake user segments in `/home/`, `/Users/`, and both Windows separator styles | **All remain suppressed** (fabricated-sample / documentation-placeholder) — the Phase-2 baseline suppressions keep working |
| C | Credential/authorization forms with markerless values — URI with password in userinfo (both `user` and `owner` usernames), `apikey =` assignment, JSON `"apikey":` form, `API_KEY=`, a key *name* carrying `your_` with a clean value, plain `token =`, `Bearer` + clean tail | **All fire** unsuppressed |
| D | Key-name/separator defeat attempts — `USER_PASSWORD=`, `sample_token=`, bare `apikey=`, `example-api-key =`, URI with marker-ish username but clean password | **All fire** — markers in separators and key names can no longer suppress anything |
| E | Marker *inside* the protected value (`test-` bearer tail, `your-` assignment value, synthetic home segment, a bare marker word embedded mid-value) | Suppressed at the file scan — the documented residual class (see N-1) |
| F | Emitter policy on marker-carrying and `/Users/`-form values | **DENY** with the correct rule id (`secret.bearer-credential`, `secret.credential-assignment`, `private.absolute-user-path`) — no suppression at the emitter |
| G | Policy construction with 33 distinct lengths and with a malformed digest | **Throws at construction** (fail-closed; the suite's dedicated test additionally pins the exact `/distinct length cap/` and `/64-character lowercase hex digest/` messages with distinct digests) |
| H | Multi-line line attribution after the precomputed-offset change | Lines 2 and 4 attributed exactly — the index change did not shift attribution |

**Regression battery (reviewer-executed):**

| Check | Result |
|---|---|
| 9 privacy/check suites (`privacy-{literals,registry,scope,reporting,authoring,performance,ci-wiring,release}.test.ts`) | 105 pass / 0 fail (includes the F-1 breadth matrix, placeholder-preservation control, and marker-broadening mutant) |
| `envelope-content-policy` + `envelope-roundtrip` + `privacy-imports` + `envelope-contract` + `ci-checks.test.ts` | 84 pass / 0 fail |
| `pnpm check` (full aggregate: lint, format, typecheck, **1136 tests / 108 files**, depcruise 94 modules clean, ambient-globals, workspace-entrypoints, secret-read-boundary, exports-parity) | exit 0 — matches the evidence artifact's claimed counts exactly |
| `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `script-surface`, `boundary-ci-parity`, `changesets-group`, `license-audit`, `forbidden-literals` | all OK |
| `pnpm check:privacy-literals` live tree | exit 0 — 1006 files, 7 rules, 0 violations, 25 allowlisted, 1 exclusion, 3 binary skipped, both classes explicitly vacuous |
| `git diff --exit-code fe0043e..HEAD -- .github/workflows/ci.yml package.json .changeset/ pnpm-lock.yaml` | clean — CI wiring, aggregate scripts, changesets, and lockfile byte-untouched by remediation |

---

## Closure table — iteration-1 findings

| ID | Severity (iter 1) | Status | Independent evidence |
|----|-------------------|--------|----------------------|
| F-1 | high | **CLOSED** | `suppressionValueFor` scopes marker evaluation to the rule's protected value segment (user segment / URI password / assigned value / bearer tail); separators, prefixes, and key names are excluded (probe A–D). Windows separator handling broadened to repeated separators (`[\\/]+`) — a detection broadening, not a weakening. `PLATFORM_FORM_POSITIVES` (6 forms) fire exactly once; synthetic-user placeholders stay suppressed (probe B + suite); the marker-broadening mutant (revert to whole-span matching) is caught by the suite. Regex thresholds (24/20/30/24/14/16/12), the marker lists, and the caps are byte-unchanged — verified by diff. Docs updated to the precise semantics. |
| F-2 | medium | **CLOSED** | Emitter policy no longer consults `suppressionClass` (`envelope-content-policy.ts` — suppression line removed; builder docblock states the rationale). Probe F: marker-carrying values DENY with the right rule id. Suite: marker-carrying assignment and bearer payloads denied at every payload field × carrier. Pinned in `feature-adapter-ports.md` and the glossary ("does not apply documentation-placeholder suppression"). |
| F-3 | medium | **CLOSED** | `lineStartOffsets` precompute + `lineForIndex` binary search replace per-match rescans; attribution verified correct (probe H). New match-dense single-line corpus case (1000 vs 2000 matches) asserts the N/2N slack **and** the exact violation counts (1000/2000) — non-vacuous. NFR-5 wording extended in the feature spec. |
| F-4 | medium | **CLOSED** | `validateInputs` at construction: non-function hash, non-array entries, malformed objects, empty/duplicate ids, unsupported algorithm, non-64-hex digests, duplicate digests, out-of-range lengths, > 32 distinct lengths all throw (probe G + the construction-failure suite covering each message). The in-matcher cap is documented as belt-and-braces/unreachable-after-validation; the previous "ignored" pin replaced by the construction tests. Docs state construction is the fail-closed point and the returned policy never throws. |
| F-5 | low | **CLOSED** | Single read per file; `scanFileViolations` takes the decoded text; the redundant `readFileSync`/`looksBinary` pair removed (source-level regression asserts neither appears in the function). |
| F-6 | low | **CLOSED** | Dead `lengthsByClass` removed (asserted absent by the same test). |
| F-7 | low | **CLOSED** | `compareCodeUnits` replaces both `localeCompare` call sites; new mixed-case + non-ASCII (`Ärger.txt`) ordering test asserts byte-identical repeat runs and code-unit sort order. |
| F-8 | low | **CLOSED** | Unexpected positional arguments fail with exit 2 naming only the position, never the value; the authoring argv-channel test updated to expect the positional rejection and still asserts no echo. |
| F-9 | low | **CLOSED** | The single-serialization audit walks `packages`, `scripts`, and `tools`; the test asserts `scripts/` files are in the audited set and the seeded second serializer moved to `scripts/rogue.ts` is caught. Feature/spec docs state the widened scope. |
| F-10 | low | **CLOSED (disposition)** | Layout mapping recorded in evidence §8 (`privacy-support.ts` vs `fixture-repo.ts`, corpus constants vs `corpus/**`, temp-generated mutants) — honest, no assertion depends on the old names. |
| F-11 | info | **CLOSED (disposition)** | Recorded as benign index housekeeping, no action — matches the diff. |
| F-12 | info | **CLOSED** | Registry parse failures emit a fixed content-free message; canary test proves neither the canary value nor the broken token is echoed. |

## Suppression/allowlist integrity after remediation

- Exactly **two new registry entries**, both exact-path and rule-scoped (not `*`), covering the two iteration-1 review artifacts that now quote firing probe shapes; reasons present; both paths exist (RV-21 green in the live run). No other entry, marker, rule, threshold, or cap changed. Live allowlisted file count moved 23 → 25, exactly the two new entries.
- The guard's own allowlist-growth surfaces are intact: the exact-set assertion (`EXPECTED_ALLOWLIST`) was extended in the same commit as the entries, and the `TC-PRIVACY-020` assertion now requires that GH-184 change-folder paths outside `readiness-review|review|code-review` trip the scan (i.e., the review-artifact exception is provably narrow).

## Residual acceptance check (as requested)

The one consciously declined residual is **accurately documented and acceptable**: `feature-privacy-guard.md` §Known Limitations states that a value whose protected segment itself carries a fabricated-sample marker (e.g. a `test-`-prefixed bearer tail) is treated as fabricated at the file scan while the emitter still denies it. Probe E/F confirms exactly this behavior. Acceptance rationale (reviewer-assessed): (1) file-scan suppression is what keeps the committed documentation/change-artifact corpus at zero violations — removing it wholesale would flood public docs with placeholder samples; (2) real project-private values have a suppression-free protection path via hashed registry entries (window matching never consults suppression); (3) the emitter — the path to public provider artifacts — denies unconditionally. The residual therefore bounds to: a *real secret-shaped value committed in a file* whose opaque tail happens to contain a committed marker substring. Documented, bounded, accepted.

## New findings (iteration 2)

### N-1 — [INFO] Bare-word markers inside opaque values remain substring-broad

- **Files**: `packages/adapters/src/io/privacy-rules.ts` (`PRIVACY_SUPPRESSION_CLASSES`, bare words like `owner`, `user`, `someone` matched as substrings of the value segment).
- **Evidence**: probe E — an opaque assignment value merely *containing* a bare marker word mid-string (not as a fabrication prefix) is suppressed at the file scan. This is inside the documented residual class and the emitter denies it, but bare words are broader than the hyphenated/underscored fabrication markers.
- **Disposition**: accepted for this change (documented). Non-blocking recommendation for a future tuning change: anchor bare words to whole tokens within the value segment, leaving hyphenated markers as substring matches.

### N-2 — [INFO] Purity proxy narrowed in `privacy-imports.test.ts`

- **File**: `tests/structure/privacy-imports.test.ts:280,297` — the "no default hash" check changed from banning the literal `sha256` to banning `node:crypto`, because the policy builder now needs the `"sha256"` literal for algorithm validation.
- **Evidence**: the meaningful bars are intact — import specifiers restricted to contracts + `./privacy-rules.js`, `createHash` banned (grep of `packages/adapters/src/io/` finds none), ambient `crypto` identifier banned. The old literal ban was a blunt proxy that would now false-positive on the validation literal.
- **Disposition**: acceptable; non-blocking. A tighter future form would ban hash *call expressions* rather than either literal.

## Docs accuracy (post re-sync)

`feature-privacy-guard.md`, `feature-adapter-ports.md`, `feature-monorepo-scaffold-toolchain.md`, and the glossary were re-checked against delivered behavior: the path-rule recognizer wording now names the Unix and Windows drive forms; marker-evaluation semantics, emitter no-suppression, construction-time validation, code-unit ordering, linear line attribution, content-free parse diagnostics, and the widened serialization audit are each stated and each matches verified behavior. The accepted residual risk (unsalted digest oracle) and the intentionally empty, explicitly vacuous hashed classes remain prominent and unchanged. No over-claim found.

## Conclusion

- **Verdict: PASS.**
- **Remediation tasks still required: NO.** Phase 9 closes on this verdict (plan task 9.3's re-review condition is satisfied).
- **Next step: PROCEED** — Phase 10 (doc-sync: already substantively reconciled; verify and record) and Phase 11 (pushed-HEAD battery, DoD check, PR handoff targeting `main-tools`). AC-F7-1/NFR-5 pushed-HEAD CI numbers remain the evidence of record once the branch is pushed, per the carried DoR advisory.
- This review adds no registry entries: both iteration-2 artifacts are written content-free (firing shapes described, never reproduced) and the live guard was re-run green after they were written (see below).

**Post-write self-check**: `pnpm check:privacy-literals` re-run after both iteration-2 artifacts were committed to the change folder — exit 0, 1008 files scanned, 0 violations; the tree stays green with no new suppression entries.
