# Delivery Evidence — GH-184: M0-S15: Privacy and no-cloud guards

Implementation HEAD when this artifact was authored: `517326e`
(spec v1.1, test plan v1.1, plan v2; DoR iteration 2 READY).

## 1. Phase commits and green criteria

| Phase | Commit | Subject | Green criteria (evidence) |
|-------|--------|---------|---------------------------|
| 1 | `0b94517` | `feat(GH-184): add pure shared privacy rule module and hashed-literal registry` | `pnpm build`, `pnpm check:boundaries`, `ambient-globals`, `secret-read-boundary`, `bun test tests/structure/privacy-imports.test.ts tests/structure/content-inventory.test.ts` (13 pass), `pnpm check` (1001 pass). |
| 2 | `2ef90be` | `feat(GH-184): add privacy-literals check with fail-closed validation` | Live guard exit 0 (975 files at that boundary); two-run determinism; JSON summary fields; temp-tree detection/no-echo; `ci-topology`; `pnpm check` (1001 pass). |
| 3 | `65c9f4b` | `feat(GH-184): add stdin-only no-echo authoring mode with CI refusal` | Authoring record/digest/class checks; no echo; no writes; `CI`/`GITHUB_ACTIONS` refusal (exit 2); guard and `pnpm check` green. |
| 4 | `86bb608` | `test(GH-184): add privacy guard mutation and behaviour suites` | TC-PRIVACY-001..021 suites with every mutant control; RV matrix; live-tree green; exact allowlist set; `bun test` 1076 pass / 0 fail; `pnpm check` green. |
| 5 | `bc8f73f` | `ci(GH-184): wire privacy-literals into ts-invariants` | Additive `ts-invariants` line; additions-only workflow diff; preserved validators + `ci-checks.test.ts` (27 pass); local command build-free/offline; `bun test` 1090 pass; `pnpm check` green. |
| 6 | `517326e` | `feat(GH-184): require an injected content policy at envelope serialization` | Contract types, policy builder, required codec input, all call sites updated; TC-POLICY-001..008; purity/boundary gates; `pnpm check` (1115 pass). |
| 7 | this commit | `chore(GH-184): add five-package minor changeset with release evidence` | One five-package minor changeset; pre-existing changesets untouched; lockfile/version/dependency assertions; full battery below. |

## 2. Consolidated gate battery (working HEAD)

Commands are the plan's Phase-7 battery. Outcomes are recorded from the
working-HEAD run; the pushed-HEAD CI result remains the evidence of record for
AC-F7-1 and the NFR-5 reference-runner number (CI-runner-evidenced).

| Command | Outcome |
|---------|---------|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm build` | PASS |
| `bun test tests/checks/privacy-literals.test.ts` | PASS |
| `bun test tests/checks/privacy-registry.test.ts` | PASS |
| `bun test tests/checks/privacy-scope.test.ts` | PASS |
| `bun test tests/checks/privacy-reporting.test.ts` | PASS |
| `bun test tests/checks/privacy-authoring.test.ts` | PASS |
| `bun test tests/checks/privacy-performance.test.ts` | PASS |
| `bun test tests/checks/privacy-ci-wiring.test.ts` | PASS |
| `bun test tests/checks/privacy-release.test.ts` | PASS |
| `bun test tests/behaviour/envelope-content-policy.test.ts` | PASS |
| `bun test tests/structure tests/boundaries tests/behaviour` | PASS |
| `bun test` | PASS (1115+ tests; see phase-7 run below) |
| `pnpm check` | PASS |
| `pnpm check:privacy-literals` | PASS (exit 0) |
| `bun run scripts/checks/ci-topology.ts` | PASS |
| `bun run scripts/checks/ci-bindingness.ts` | PASS |
| `bun run scripts/checks/ci-supply-chain.ts` | PASS |
| `bun run scripts/checks/script-surface.ts` | PASS |
| `bun run scripts/checks/boundary-ci-parity.ts` | PASS |
| `bun run scripts/checks/changesets-group.ts` | PASS |
| `bun run scripts/checks/license-audit.ts` | PASS |
| `bun run scripts/checks/forbidden-literals.ts` | PASS |
| `bun run scripts/checks/manifest-privacy.ts` | PASS |
| `bun run scripts/checks/ambient-globals.ts` | PASS |
| `bun run scripts/checks/secret-read-boundary.ts` | PASS |
| `bun run scripts/checks/workspace-entrypoints.ts` | PASS |
| `git diff --check` | clean |
| `git status --porcelain` | clean after commit |

`bash scripts/.tests/test-doc-distribution.sh` is not required: no
`doc/guides/**` or `doc/templates/**` file changed in Phases 1–7.

## 3. TC coverage map (34/34)

| TC | Evidence location | Status |
|----|-------------------|--------|
| TC-PRIVACY-001 | `tests/checks/privacy-literals.test.ts` (single/multi plant, detection-disabled) | PASS |
| TC-PRIVACY-002 | same (near-misses, corpus, threshold-removal mutant) | PASS |
| TC-PRIVACY-003 | same (suppression classes, mixed line, suppression-disabled mutant) | PASS |
| TC-PRIVACY-004 | same (hashed entry, removal, disabled mutant) | PASS |
| TC-PRIVACY-005 | same (authored entry as data, clone probe, digests) | PASS |
| TC-PRIVACY-006 | same (case/whitespace variants, case-fold mutant) | PASS |
| TC-PRIVACY-007 | same (lengths 4/5/7/16/64/512, boundaries, short file) | PASS |
| TC-PRIVACY-008 | same (production class vacuous, RV-09 control) | PASS |
| TC-PRIVACY-009 | same (synthetic activation/removal, term search, disabled mutant) | PASS |
| TC-PRIVACY-010 | `tests/checks/privacy-registry.test.ts` (RV-01..RV-10, short-circuit mutant) | PASS |
| TC-PRIVACY-011 | same (RV-11..RV-20, permissive mutant) | PASS |
| TC-PRIVACY-012 | same + `privacy-literals.test.ts` (RV-21..RV-26, exact set, rule scope, prefix mutant) | PASS |
| TC-PRIVACY-013 | same (RV-18, RV-27..RV-30, exact boundaries, uncapped mutant) | PASS |
| TC-PRIVACY-014 | `tests/checks/privacy-scope.test.ts` (history/untracked/ignored/tracked/binary/exclusion/order) | PASS |
| TC-PRIVACY-015 | `tests/checks/privacy-reporting.test.ts` (replay, snapshot, import graph, fetch stub, writing mutant) | PASS |
| TC-PRIVACY-016 | same (both modes, recursive walk, windows, hex inventory, echo mutant) | PASS |
| TC-PRIVACY-017 | same (length/charset/stability/collision/content independence) | PASS |
| TC-PRIVACY-018 | `tests/checks/privacy-authoring.test.ts` (record, no echo, no writes, echo mutant) | PASS |
| TC-PRIVACY-019 | same (CI markers, no argv/env channel) | PASS |
| TC-PRIVACY-020 | `privacy-literals.test.ts` (live tree, non-vacuous summary, planted copy) | PASS |
| TC-PRIVACY-021 | `privacy-performance.test.ts` (budgets, N/2N, pattern lint; emitter half in Phase 6) | PASS |
| TC-POLICY-001 | `tests/behaviour/envelope-content-policy.test.ts` (field × carrier, escaping, clean control) | PASS |
| TC-POLICY-002 | same + `tests/types/envelope-policy.type-test.ts` + `tests/structure/envelope-contract.test.ts` | PASS |
| TC-POLICY-003 | same (order matrix, totality, no carrier) | PASS |
| TC-POLICY-004 | same (three-kind union, legacy fields, failure keys) | PASS |
| TC-POLICY-005 | `tests/structure/privacy-imports.test.ts`, `envelope-contract.test.ts`, `content-inventory.test.ts` | PASS |
| TC-POLICY-006 | `envelope-content-policy.test.ts` (parity, id-rename propagation, static scan) | PASS |
| TC-POLICY-007 | same (human content preserved, policy input excludes it, widening control) | PASS |
| TC-POLICY-008 | same (both classes, fixed-hash stub, empty entries, namespace check) | PASS |
| TC-WIRE-001 | `tests/checks/privacy-ci-wiring.test.ts` + preserved validators | PASS |
| TC-WIRE-002 | same (local command counts, build-free clone, offline/read-only) | PASS |
| TC-WIRE-003 | same (`ts-test`, bunfig, explicit suite runs, failing temp test) | PASS |
| TC-RELEASE-001 | `tests/checks/privacy-release.test.ts` + `changesets-group` | PASS |
| TC-RELEASE-002 | same (`frozen-lockfile`, version/dependency/lockfile, license/exports) | PASS |

## 4. Baseline suppression inventory (Phase 2; path + rule scope + reason)

No literal content is reproduced here or anywhere in this artifact.

| Path | Rule scope | Reason |
|------|------------|--------|
| `packages/adapters/src/io/privacy-rules.ts` | `*` | Guard-owned rule definitions and suppression markers. |
| `scripts/checks/privacy-literals.registry.json` | `*` | Guard-owned registry data. |
| `scripts/checks/privacy-literals.ts` | `*` | Guard implementation and path forms. |
| `tests/structure/privacy-imports.test.ts` | `*` | Guard purity/definition suite. |
| `tests/fixtures/providers/sanitization/cases.ts` | `secret.provider-token-prefix`, `secret.private-key-block`, `secret.credential-assignment` | Pre-existing sanitization canary corpus; NG-3 excludes retroactive remediation. |
| `doc/changes/2026-03/2026-03-10--GH-32--bootstrap-onboarding-consistency/feedback/red-team-report-v3.md` | `private.absolute-user-path` | Archival review record quoting real owner paths. |
| `doc/changes/2026-03/2026-03-10--GH-32--bootstrap-onboarding-consistency/feedback/red-team-report-v4.md` | `private.absolute-user-path` | Archival review record quoting a real owner path. |
| `doc/changes/2026-07/2026-07-03--GH-124--batch-delivery-infrastructure/chg-GH-124-plan.md` | `private.absolute-user-path` | Archival plan quoting real owner paths. |
| `doc/changes/2026-10/2026-10-31--GH-184--privacy-and-no-cloud-guards/readiness-review/readiness-iter-1.md` | `private.absolute-user-path` | Archival DoR record quoting verified paths. |
| `pnpm-lock.yaml` (exclusion) | `*` | Generated lockfile content; covered by separate lockfile gates. |

Phase-4 guard-own surfaces (`tests/fixtures/privacy-literals` directory plus the
eight guard suites and the behaviour suite) are `*`-scoped and carry written
reasons in the registry. No entry was added for a file the live scan does not
report (including the GH-26 plan/pm-notes, GH-32 v2/pm-notes, or the generated
mirror).

## 5. NFR-5 local measurements (recorded, not authoritative)

Measured with the deterministic generated corpus and non-matching registry
entries on the delivery machine:

| Measurement | Value |
|-------------|-------|
| 8 KiB corpus scan, median of 3 | ~203 ms |
| 16 KiB corpus scan, median of 3 | ~342 ms |
| Pathological near-miss corpus, median of 3 | ~325 ms |
| N/2N ratio (local) | within the 3× slack asserted by the suite |

The authoritative NFR-5 number is the pushed-HEAD CI reference-runner result
(spec §17).

## 6. Partial / deferred evidence

- AC-F7-1 (binding CI invocation) is structurally proven locally and remains
  CI-runner-evidenced by the pushed-HEAD job; the local battery proves the
  command can fail and that the workflow is additions-only.
- NFR-5's numeric bound is local-only in this artifact; the CI run supplies the
  reference-runner number.
- OQ-1 (owner-supplied `private-literal`/`cloud-term` digests) is out-of-band
  owner action; both production classes are intentionally empty and explicitly
  vacuous until then.

## 7. Rollback

Revert all GH-184 phase commits as one unit. Never split: contract types +
codec + policy builder + all call sites; shared rule module + registry +
allowlist + guard suites; `ci.yml` wiring + the check script;
inventory/allowances registrations; the changeset. After rollback run
`pnpm check`, `pnpm check:boundaries`, `bun run scripts/checks/ci-topology.ts`,
and `bun run scripts/checks/forbidden-literals.ts` to confirm the baseline.

## 8. Review iteration 1 remediation (Phase 9)

Source: `review/review-iter-1.md` and `code-review/review-iter-1.yaml`.

| Finding | Fix | Regression evidence |
|---------|-----|---------------------|
| F-1 | Marker evaluation is scoped to the rule's protected value segment (user segment, URI password, assigned value, bearer tail), not the whole span. Windows separator handling accepts repeated separators. | `PLATFORM_FORM_POSITIVES` breadth matrix (`/home/`, `/Users/`, `C:\Users\`, connection-string userinfo, `apikey` key) plus marker-broadening mutant in `privacy-literals.test.ts`; synthetic-user suppression preservation. |
| F-2 | Emitter policy no longer applies documentation-placeholder suppression. | Marker-carrying assignment and bearer payloads denied at every field × carrier in `envelope-content-policy.test.ts`. |
| F-3 | Precomputed newline-offset index with binary-search line attribution. | Match-dense N/2N performance case in `privacy-performance.test.ts`. |
| F-4 | Policy builder validates injected entries at construction (hash function, digest shape, lengths, duplicate ids/digests, distinct-length cap, optional algorithm) and fails closed. | Construction-failure tests in `envelope-content-policy.test.ts`; window-matcher cap documented as unreachable after validation. |
| F-5 | Each file is read and binary-checked once; the scan loop passes the decoded text into matching. | Existing scan/reporting suites remain byte-identical. |
| F-6 | Removed the dead per-class length map. | Registry matrix remains green. |
| F-7 | Code-unit ordering replaces locale-dependent comparison. | Mixed-case and non-ASCII ordering test in `privacy-scope.test.ts`. |
| F-8 | Unknown positional arguments fail closed with a usage exit; the diagnostic names the argument position without echoing its value. | `privacy-authoring.test.ts` positional-argument test plus the existing argv no-echo test. |
| F-9 | Single-serialization-point audit walks `packages`, `scripts`, and `tools`. | Seeded second serializer under `scripts/` is caught in `envelope-contract.test.ts`. |
| F-10 | Layout mapping recorded here (no code change). | Temp-tree support lives in `tests/checks/privacy-support.ts`; corpus data lives in `rules.ts` constants; mutants are generated in temp copies. Functionally equivalent to the plan wording; no assertion depends on the old names. |
| F-11 | No action (benign index housekeeping). | — |
| F-12 | JSON parse failures emit a generic content-free diagnostic instead of the parser message. | Content-free parse-failure test in `privacy-registry.test.ts`. |

**New suppression entries (unavoidable after the F-1 fix):** the two archival
review artifacts now report true-positive probe shapes. Both entries are
exact-path and rule-scoped; no production file, marker, rule, or cap was
weakened.

| Path | Rule scope | Reason |
|------|------------|--------|
| `doc/changes/2026-10/2026-10-31--GH-184--privacy-and-no-cloud-guards/review/review-iter-1.md` | `private.absolute-user-path`, `secret.connection-string-credential`, `secret.credential-assignment` | Read-only review evidence quoting the F-1 runtime probe values. |
| `doc/changes/2026-10/2026-10-31--GH-184--privacy-and-no-cloud-guards/code-review/review-iter-1.yaml` | `private.absolute-user-path` | Read-only machine-readable review evidence quoting the F-1 path example. |

**Remediation gate results:** focused privacy/policy suites 151 pass / 0 fail;
`bun test` 1136 pass / 0 fail; `pnpm check`; `pnpm check:privacy-literals` exit 0
(1006 files, 7 rules, 0 violations, 25 allowlisted files, 1 exclusion, 3 binary
skips, both classes vacuous); `ci-topology`, `ci-bindingness`, `ci-supply-chain`,
`script-surface`, `boundary-ci-parity`, `secret-read-boundary`,
`ambient-globals`, `forbidden-literals`, and `error-table-sync` all exit 0;
`git diff --check` clean.
