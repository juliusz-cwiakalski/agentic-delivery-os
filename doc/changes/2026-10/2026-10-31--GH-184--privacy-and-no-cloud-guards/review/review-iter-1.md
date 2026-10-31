# Review Iteration 1 — GH-184: M0-S15: Privacy and no-cloud guards

- **Reviewer**: `@reviewer` (local mode, plan Phase 8 / lifecycle phase 8)
- **Date**: 2026-10-31
- **Implementation HEAD reviewed**: `fe0043e` (phase commits `0b94517`…`bdefee2`, plus doc-sync `3a7635e`/`fe0043e`)
- **Base**: `origin/main-tools`
- **Inputs**: spec v1.1 (22 ACs), test plan v1.1 (34 TCs), plan v2 (PD-1..PD-10, DoR iteration 2 READY), TDR-0005, evidence artifact, readiness iterations 1–2
- **Method**: full diff read (`git diff origin/main-tools...HEAD`, 49 files, +9,502/−43); all guard/policy/codec/registry sources read in full; key suites re-run; guard re-run on the live tree; one targeted runtime probe of the shared matcher.

## Verdict: FAIL

One high-severity detection defect in the guard's own suppression logic (F-1) plus three medium findings. Everything else — fail-closed validation, no-echo reporting, hash/window semantics, allowlist integrity, emitter policy contract, CI bindingness, release integrity, docs reconciliation — verified as delivered and genuinely non-vacuous.

**Finding counts**: 0 critical · 1 high · 3 medium · 6 low · 2 info (12 total)

**Spec compliance**: FAIL (in substance — see F-1 vs F-1/AC-F1-1/NFR-4; all 22 ACs have implemented, re-run-verifiable evidence, but one rule's delivered recognizer coverage contradicts its spec definition)
**Plan compliance**: PASS with minor file-layout drift (F-10; all phases 1–7 tasks [x] with matching artifacts; phases 8–11 correctly open)

**Remediation**: a Phase 9 remediation batch IS required (F-1 mandatory; F-2/F-3/F-4 recommended in the same batch). See "Required remediation" below.

---

## Re-verified evidence (reviewer-executed)

| Check | Result |
|---|---|
| `pnpm check:privacy-literals` on live tree | exit 0 — 1004 files, 7 rules, 0 violations, 23 allowlisted, 1 excluded, 3 binary skipped, both classes explicitly vacuous |
| `bun test tests/checks/privacy-{literals,registry,scope}.test.ts` | 53 pass / 0 fail |
| `bun test tests/checks/privacy-{reporting,authoring,performance,ci-wiring,release}.test.ts` | 44 pass / 0 fail |
| `bun test tests/behaviour/envelope-content-policy.test.ts tests/structure/privacy-imports.test.ts tests/structure/envelope-contract.test.ts tests/checks/ci-checks.test.ts` | 68 pass / 0 fail |
| `git diff --name-status origin/main-tools...HEAD -- .changeset/` | exactly one `A` (`gh-184-privacy-guards-minor.md`); 5 pre-existing changesets present, unmodified |
| CI wiring diff | exactly one additive `bun run scripts/checks/privacy-literals.ts` line in `ts-invariants`; aggregate `check` string byte-unchanged; no new job |
| Codec | `policy` required on `SerializeEnvelopeInput`; order closed → size → policy → carrier; denial carries `ruleOrEntryId` only, no carrier; no `node:*`/`bun:*`, no ambient (purity suite re-run green) |
| Runtime probe | see F-1 — suppression behavior confirmed by executing the committed matcher |

The evidence artifact (`chg-GH-184-evidence.md`) is honest: every claim I re-ran reproduced. AC-F7-1/NFR-5 pushed-HEAD CI numbers are correctly recorded as pending (carried advisory from DoR), not claimed as passed.

---

## Findings

### F-1 — [HIGH] Bare-substring suppression markers silently disable `private.absolute-user-path` for `/Users/…` and `C:\Users\…`, and suppress other real credential shapes

- **Severity**: high · **Confidence**: high (runtime-proven) · **Category**: correctness / privacy detection
- **Files**: `packages/adapters/src/io/privacy-rules.ts:104-147` (marker lists), `:190-198` (`suppressionClassFor`), `:213-231` (`matchGenericRules` attaches suppression to the whole span); consumed at `scripts/checks/privacy-literals.ts:547-548` (suppressed matches skipped entirely) and `packages/adapters/src/io/envelope-content-policy.ts:35-37` (same at the emitter).
- **Evidence**: `suppressionClassFor` tests markers as substrings of the *entire matched span*. The `fabricated-sample` class contains the bare marker `"user"`, and the macOS/Windows home prefixes matched by the rule (`/Users/`, `C:\Users\`) themselves contain `user`. Runtime probe against the committed module:

  ```
  "/Users/jsmith/secret-notes.txt"   => match private.absolute-user-path, suppressed: "fabricated-sample"
  "C:\\Users\\jsmith\\Documents\\keys" => match private.absolute-user-path, suppressed: "fabricated-sample"
  "/home/jsmith/secret-notes.txt"    => match private.absolute-user-path, suppressed: null        (fires)
  "postgres://user:hunter2secret@db.internal/host" => match secret.connection-string-credential, suppressed: "fabricated-sample"
  "apikey = 9f8e7d6c5b4a321f9e8d7c6b"              => match secret.credential-assignment, suppressed: "fabricated-sample"
  "Bearer test-abcdef1234567890"                    => match secret.bearer-credential, suppressed: "fabricated-sample"
  ```

  Every `/Users/…` and `C:\Users\…` path — the canonical macOS/Windows personal-home forms the rule exists to catch — is classified as a fabricated sample and never reported, at the file scan **and** the emitter policy (same shared module). The tests cannot catch this: `RULE_POSITIVES` (`tests/fixtures/privacy-literals/rules.ts:37-39`) uses only a `/home/` form, the near-miss is a relative `home/…`, and the corpus has no `/Users/` case.
- **Spec impact**: contradicts spec F-1 ("an absolute personal home/profile path containing a concrete user segment"), the substance of AC-F1-1/NFR-4 non-vacuity for this rule, and `doc/spec/features/feature-privacy-guard.md:70-72` ("Suppression is scoped to the matched span, so a markerless value still fires" — `/Users/jsmith/...` is markerless in intent but not per the implementation). Also weakens `secret.connection-string-credential` (userinfo username `user`), `secret.credential-assignment` (key name `apikey`), and marker-carrying bearer tokens (e.g. `test-` prefixed real CI tokens).
- **Exact remediation**:
  1. Stop matching bare-word markers against the whole span. Either (a) evaluate markers only on the opaque *value* portion of the span (user segment after the `/Users/`//`home/` prefix for the path rule; password portion of URI userinfo; assigned value for credential assignments; token tail for bearer), with bare words anchored to token boundaries; or (b) restrict whole-span substring markers to the unambiguous hyphenated/underscored forms (`fake-`, `your-`, `example-`, …) and drop the ambiguous bare words (`user`, `username`, `your`, `owner`, `someone`, `somebody`, `synthetic`, `apikey`, `placeholder`) from whole-span matching.
     The intended baseline suppressions must keep working: `tests/behaviour/config-sources.test.ts` (synthetic user segment) and the `your-`/`fake-`/`redacted` fixtures must remain suppressed after the change — verify against the live tree (Phase-2 baseline must stay green without new allowlist entries).
  2. Add regression positives to `RULE_POSITIVES`/corpus: `/Users/<markerless>/…`, `C:\Users\<markerless>\…`, a `postgres://user:<opaque>@host` connection string, and `apikey = <opaque>`; assert each fires in the file scan (TC-PRIVACY-001) and — for the path value — at the emitter policy (TC-POLICY-006 parity).
  3. Add a suppression-scoping mutant control (e.g. a mutant that re-broadens marker matching to the whole span is caught by the new `/Users/` regression).
  4. Disclose the delivered suppression scoping precisely in `doc/spec/features/feature-privacy-guard.md` (§ Generic rule set / Known Limitations).

### F-2 — [MEDIUM] Emitter policy applies documentation-placeholder suppression to machine-generated payloads

- **Severity**: medium · **Confidence**: high · **Category**: correctness / security (emitter)
- **File**: `packages/adapters/src/io/envelope-content-policy.ts:35-37`
- **Evidence**: the policy builder skips matches with a non-null `suppressionClass`. A payload value carrying any marker substring (`Bearer your-…`, a `test-`-prefixed token, a `/Users/…` path — see F-1) serializes successfully. Spec F-1 scopes the placeholder-suppression list to keeping the *documentation* false-positive corpus at zero; spec DM-5/F-6 define the emitter policy as generic rules + hashed entries with no suppression mention. Machine-generated envelope JSON has no documentation context, so suppression there is an undocumented bypass of AC-F6-1 ("a guarded value in a payload field … returns `content-policy-violation`").
- **Exact remediation**: decide and pin the behavior. Recommended: the emitter policy evaluates generic rules without placeholder suppression (suppression is a file-scan/documentation concept), with a TC-POLICY case asserting a marker-carrying guarded payload is denied at every field × carrier. If suppression at the emitter is intended, record it as a pinned decision (PM/`@decision-advisor` per plan task 8.3 routing) and state it in spec DM-5 and the feature spec. Either way close the gap between behavior and both documents.

### F-3 — [MEDIUM] Quadratic line attribution on match-dense files (NFR-5 linearity risk)

- **Severity**: medium · **Confidence**: high (mechanism certain; trigger requires a match-dense file) · **Category**: performance
- **Files**: `packages/adapters/src/io/privacy-rules.ts:200-206` (`lineAt` is O(index)), called per match at `:222` and per window hit at `:268`.
- **Evidence**: `lineAt` rescans from offset 0 for every match. A single-line file with M matches costs O(M × file-length) — e.g. a pasted list of tokens or a match-dense generated corpus approaches quadratic behavior, contrary to NFR-5 ("per-file hash work is linear in scanned bytes"; ≤ 60 s for ≤ 50 MiB). The performance suite's corpora are all non-matching (`NON_MATCHING_HASHES`, "pathological near-miss"), so this path is unmeasured. The window path is safe (lineAt only on digest hits); the generic path is not.
- **Exact remediation**: precompute newline offsets once per text and binary-search per match, or track the line incrementally per rule (regex `exec` order is monotonic under the `g` flag). Add a match-dense corpus case (many positives on one line/file) to TC-PRIVACY-021 with the N/2N slack assertion applied to it.

### F-4 — [MEDIUM] `findWindowMatches` fails open above the distinct-length cap; policy builder does not validate injected entries

- **Severity**: medium · **Confidence**: high · **Category**: correctness / fail-closed philosophy (C-7)
- **Files**: `packages/adapters/src/io/privacy-rules.ts:260` (silently returns `[]` when distinct lengths > 32), `packages/adapters/src/io/envelope-content-policy.ts:29-33` (no validation of injected `entries`).
- **Evidence**: in the check path this is unreachable (registry validation rejects > 32 distinct lengths, RV-29), but the emitter policy builder accepts arbitrary injected entries; a caller injecting more than 32 distinct lengths gets a policy that silently allows every hashed literal — fail-open, against the change's stated fail-closed principle. `tests/checks/privacy-performance.test.ts:96-104` even pins the silent-empty behavior as expected.
- **Exact remediation**: have `buildEnvelopeContentPolicy` validate its inputs (reject > 32 distinct lengths, out-of-range lengths, duplicate ids; entries shape) at construction time — construction failure is the fail-closed point for an injected-inputs builder. Keep the belt-and-braces check in `findWindowMatches` but document it as unreachable-after-validation rather than "ignore".

### F-5 — [LOW] Every file is read and binary-checked twice per scan

- **Files**: `scripts/checks/privacy-literals.ts:614-618` (read + `looksBinary` in `runPrivacyScan`) and `:541-542` (re-read + re-check in `scanFileViolations`).
- **Evidence**: duplicate `readFileSync` + duplicate UTF-8 decode window per file; pure I/O waste on a 1000+ file tree.
- **Remediation**: pass the buffer (or decoded text) from the enumeration loop into `scanFileViolations`; drop the second `looksBinary`.

### F-6 — [LOW] Dead code: `lengthsByClass` in registry validation

- **File**: `scripts/checks/privacy-literals.ts:208, 270-272`
- **Evidence**: the map is declared and populated but never read; per-class length sets are unused (the global distinct-length cap at `:285-288` is what fires).
- **Remediation**: remove the dead map (or, if per-class length caps were intended, implement and test them — currently there is no per-class distinct-length cap).

### F-7 — [LOW] Violation ordering uses locale-dependent `localeCompare`

- **File**: `scripts/checks/privacy-literals.ts:623-628`
- **Evidence**: `String.prototype.localeCompare` with no locale depends on the runtime's ICU/default locale; two runs on one machine are byte-identical (NFR-1 satisfied as written), but ordering of mixed-case paths can differ across environments/ICU builds. `listScanFiles` uses codepoint `.sort()` — the program mixes two orderings.
- **Remediation**: use codepoint comparison (`a < b ? -1 : …`) or an explicit locale, matching the file-list ordering.

### F-8 — [LOW] Unknown positional arguments are silently ignored

- **File**: `scripts/checks/privacy-literals.ts:741-769`
- **Evidence**: only `-`-prefixed tokens are rejected; `bun run scripts/checks/privacy-literals.ts some/path` silently scans the working tree, inviting a mistaken belief that `some/path` was scanned.
- **Remediation**: reject unexpected positionals with the usage-error exit (2).

### F-9 — [LOW] Single-serialization-point audit walks only `packages/**`

- **File**: `tests/structure/envelope-contract.test.ts:288-291` (`envelopeSourceFiles` limits the audit to `packages`)
- **Evidence**: a second `serializeEnvelope`-style declaration under `scripts/**`, `tools/**`, or `tests/**` would not be flagged, narrowing AC-F6-3's "exactly one envelope serializer" audit.
- **Remediation**: widen the audit walk to the repository's production trees (at minimum `scripts/**` and `tools/**`), keeping the existing seeded-violation control.

### F-10 — [LOW] Delivery drifts from the plan's file layout (functionally equivalent)

- **Evidence**: plan tasks 4.2/4.5 stage temp-tree support in `tests/checks/fixture-repo.ts` ("extended"); delivery added a new `tests/checks/privacy-support.ts` (fixture-repo.ts untouched). Task 4.1 names `corpus/**` and the Phase-4 areas name `echo-mutants/**`; the corpus was consolidated into `rules.ts` constants and mutants are generated in temp copies (the latter matches PD-10's intent). All content commitments (isolation, temp roots, live tree read-only) are honored.
- **Remediation**: none required in code. Record the layout mapping in the evidence artifact or a plan execution-log note so the Phase-10/11 readers are not misled; no assertion depends on the old names.

### F-11 — [INFO] `doc/decisions/00-index.md` also adds the pre-existing TDR-0004 row

- **Evidence**: the diff adds both TDR-0004 (state-layer change, already merged as a record but unindexed) and TDR-0005. Benign, correct housekeeping; noting for scope transparency.

### F-12 — [INFO] Registry JSON parse errors may echo a short file snippet

- **File**: `scripts/checks/privacy-literals.ts:388-394`
- **Evidence**: `error.message` from `JSON.parse` can embed a source snippet. The registry is committed digest-only data, so no raw-literal channel exists today; strictly, the message string is not content-controlled (C-6 hygiene).
- **Remediation** (optional): reduce to a position/class-only message (e.g. drop `reason` from the failure line) if C-6 is read maximally.

---

## Spec / plan audit summary

**AC coverage (22/22 implemented and evidenced; re-run where local)**: AC-F1-1..AC-F5-2, AC-F6-1..F6-5, AC-F7-2, AC-F7-3, AC-F8-1 verified against delivered code and re-run suites. AC-F7-1 is structurally proven (invocation by name, additions-only diff, mutation controls, `ci-checks.test.ts` green) and correctly remains CI-runner-evidenced for the pushed HEAD — matches the DoR-carried advisory; not a finding. **In-substance exception**: AC-F1-1/NFR-4 for `private.absolute-user-path` pass their tests but the tests only exercise the `/home/` form; per F-1 the rule is vacuous for the `/Users/` and `C:\Users\` forms its spec definition promises — this is why spec compliance is FAIL despite 22/22 green.

**TC coverage (34/34)**: evidence map matches the delivered suites; every suite I re-ran is green and non-vacuous (each mutation/echo/writing mutant control genuinely fails the assertion it guards; the RV-01..30 matrix, rule-scope regression, boundary placements 4/5/7/16/64/512, no-echo recursive-JSON/candidate-window/hex-inventory checks, and CI-wiring mutation controls are all substantive).

**TDR-0005 conformance**: §1 one check + one registry + shared pure rules ✓; §2 domain-separated unsalted SHA-256 with single-sourced normalization ✓; §3 no-echo identifiers-only reporting ✓ (verified, incl. authoring mode); §4 hashed empty `cloud-term` class with synthetic activation ✓; §5 required injected policy at the single serialization point, codec purity ✓; §6 working-tree-only boundary, reason-bearing exceptions, fail-closed ✓; §7 no config-layer key ✓. Deviations: none of substance; F-1/F-2 are implementation defects inside the conformed mechanics, not departures from the TDR.

**TC-POLICY-005 import pin (explicitly requested)**: honored — codec imports exactly `@delivery-os/core/contracts` (type members via `import type`; `as const` data by value) and nothing else; policy builder adds only `./privacy-rules.js` + `import type` contract member; purity suite enforces it with seeded-violation controls (`tests/structure/privacy-imports.test.ts:303-334`). Pin confirmed.

**Pinned readings and CI bindingness**: `ts-invariants` line is inside the step's run block (not `continue-on-error`-able individually); workflow diff asserted additions-only by test; aggregate `check` byte-unchanged and does not chain the guard; `TS_JOBS`/`BASH_JOBS` untouched; topology/bindingness/supply-chain/script-surface + `ci-checks.test.ts` re-run green. ✓

**Docs accuracy**: `feature-privacy-guard.md`, `feature-adapter-ports.md`, `feature-branding-seam.md`, `feature-monorepo-scaffold-toolchain.md`, glossary — reconciled, cross-links resolve, accepted residual risk (unsalted digest oracle) and intentionally empty classes honestly documented. One over-claim: the path-rule coverage statement vs actual `/Users` suppression (F-1 remediation item 4); one under-specification: emitter-side suppression behavior undocumented (F-2).

## Required remediation

Add a **Phase 9 (review remediation, iteration 1)** batch to the plan (I do not modify the plan per instruction; PM to append):

1. **Mandatory — F-1**: re-scope suppression-marker evaluation (value/token-anchored, not whole-span substrings); add `/Users/`, `C:\Users\`, `postgres://user:…`, `apikey =` regression positives to the rule corpus and TC-POLICY-006 parity; add a marker-broadening mutant control; keep the live-tree baseline green with the existing allowlist (no new suppressions); update `feature-privacy-guard.md`.
2. **Recommended — F-2**: pin and implement emitter-side suppression behavior (deny marker-carrying guarded payloads at the emitter, or document the exception as a decided pin); add the TC-POLICY case either way.
3. **Recommended — F-3**: linear line attribution + a match-dense performance case.
4. **Recommended — F-4**: input validation in `buildEnvelopeContentPolicy` (fail-closed construction).
5. Optional in the same batch: F-5–F-9 (small, low-risk fixes with one-line regression coverage each); F-10 evidence-note only.

Re-review after remediation: re-run the affected suites plus `pnpm check`, `pnpm check:privacy-literals`, and the F-1 runtime probe against `/Users/`-form positives.

**Next step**: EXECUTE_REMEDIATION_PHASE (Phase 9) → re-review (iteration 2).
