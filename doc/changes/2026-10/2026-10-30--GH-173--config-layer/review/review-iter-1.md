# Code Review — GH-173 Config Layer — Iteration 1

| Field | Value |
|---|---|
| work_item_ref | GH-173 |
| mode | local (independent, plan Phase 6 tasks 6.1–6.3) |
| branch / HEAD | `feat/GH-173/config-layer` @ `35b31c5` |
| base | `main-tools` |
| reviewed_at | 2026-10-30T15:52:40Z (actual UTC, system clock) |
| verdict | **PASS** |
| findings | 3 (0 critical / 0 high / 0 medium / 1 low / 2 info) |
| remediation phase | NOT REQUIRED (see F-1 disposition) |
| scope of write | this file only; no source, plan, or git modifications |

## 1. Review Method

Pre-collected runner evidence (logs under `tmp/run-logs-runner/2026-10-30/`, incl.
`164624-gh173-remediation-verify.log` — 11 steps, ALL STEPS DONE, exit table clean — and
`144249-gh173-phase5-confirmation.log`) was accepted as stated after existence and tail
spot-checks; no exhaustive grep batteries were re-run. This reviewer independently read:
the spec (25 ACs, DM-2 matrix, §8.4 governance), the plan (39 tasks, 25-AC/TC map,
execution log), PM notes (RETROACTIVE rules note), `doc-syncer-report.md`,
`packages/adapters/src/file/yaml-parser.ts`, `packages/adapters/src/file/config-source.ts`,
`packages/cli/src/output/serialize.ts`, the relevant part of
`packages/core/src/config/resolver.ts`, `.ai/rules/typescript.md`, the full
`git show 35b31c5` diff, `doc/legal/dependency-licenses.yaml` (plus its base diff), and
the assertion bodies of the five highest-risk test files.

## 2. (A) Spec / Plan Compliance — PASS

**AC→TC mapping.** Plan §Test Scenarios maps all 25 ACs one-to-one to
TC-CONFIG-001–025 with primary phases and target files; phases 1–5 evidence cites runner
logs and phase commits (`7661d46`, `e94b2fe`, `7fb56de`, `74e6f28`, `8fcf880`/`c8aae25`).
No CHECKED_BUT_MISSING tasks found in phases 1–5. Phases 6–8 open by design (this review
executes 6.1–6.3; 7 is conditional; 8 is PM-owned handoff).

**High-risk AC non-vacuity checks (all confirmed by reading the assertions):**

- **AC-F3-1 malformed-classified-error (TC-CONFIG-007).**
  `tests/behaviour/config-parser.test.ts:111,132` assert `config.file.malformed` with real
  line positions from the walker; `tests/behaviour/config-cli.test.ts:286,356-357,410` run
  malformed YAML containing `UNREGISTERED-MALFORMED` / `.inf # UNREGISTERED-NONJSON`
  canaries through the real command path and assert the classified code and exit-1
  envelope. Non-vacuous: classification AND canary absence asserted on the real path.
- **AC-F5-1 debug file+line origins (TC-CONFIG-015).**
  `tests/behaviour/config-cli.test.ts:248-266` assert the exact origin grammar
  `layer=project-committed file=<path> line=3` (a true positive fixture line, not a
  guessed number), `loadedFiles`/`skippedLayers` payload completeness, and
  `get --show-origin` returning the identical winning origin. Non-vacuous.
- **AC-F4-2 secret fail-closed (TC-CONFIG-013).**
  `packages/core/src/config/resolver.ts:235-236` rejects `environment-only` catalog fields
  from **every** layer except environment (both repository layers, defaults and CLI —
  F-4's "including defaults and CLI"); `tests/behaviour/config-restrictions.test.ts:39-45`
  asserts `config.secret.forbidden` **and** `JSON.stringify(error)` not containing the
  canary — dual classification + non-leak assertion. Non-vacuous.
- **AC-F2-3 CI skip matrix (TC-CONFIG-005).**
  `tests/behaviour/config-sources.test.ts:180-330` is a row-oracle over the DM-2 matrix,
  including the two adversarial rows: CI outside git → committed `no-git-root` / local
  `ci-disabled` (line 204-207), and non-CI outside git → both `no-git-root` (line
  216-219); independent `--enable-*-config` re-enable rows (lines 239-260); selection →
  local `selected-config` under CI and root (lines 282-330). Zero-read is enforced via a
  `reads` map on the injected fs (line 35-44, asserted e.g. line 89 for a decoy path) —
  skipped and poisoned sources are proven **never read**, not merely ignored. Non-vacuous
  and consistent with spec §8.3 DM-2 verbatim.
- **AC-F1-2 reset semantics (TC-CONFIG-002).**
  `tests/behaviour/config-resolver.test.ts:114-143` asserts reset removes inherited values
  and **descendant origins** before the same layer's values apply, and that invalid reset
  targets fail `config.reset.invalid` even when later shadowed (`sources: [lower, reset]`
  rows). Non-vacuous.

## 3. (B) Security Correctness — PASS

- **Host-switch rejection precedes parsing.** `yaml-parser.ts:73-78`: the
  `parserHostSwitchBlocked()` check (`LOG_TOKENS`/`LOG_STREAM` non-empty, empty/unset
  passes — matching the positive-control contract) is the first statement of
  `parseConfigYaml`, before `LineCounter`/`parseAllDocuments` construction; rejection is a
  constructed `config.value.invalid` with layer+file only. Subprocess tests
  (`config-parser.test.ts:164-169`) also assert the switch takes precedence over
  malformed classification (not `config.file.malformed`), exactly per F-6-4.
- **No source-text/exception leakage.** `logLevel: "silent"`, `prettyErrors: false`
  (yaml-parser.ts:88-89); the entire walk is inside one `try { … } catch { return
  malformed(layer, file) }` (lines 81-180) — no upstream message, stack, document or
  snippet crosses the boundary; bounds (1 MiB source / 2048 nodes / 64 depth / 100
  aliases), core-schema tag allowlist, `<<`/`__proto__`/`prototype`/`constructor` key
  rejection, and `Number.isFinite` scalar filtering are all enforced in-file.
  `config-source.ts` catches read failures into constructed `config.value.invalid`
  (lines 74-79, 117-119).
- **Redaction chokepoint intact.** `serialize.ts` remains the sole stream-writer
  (`writeText` is the single write site); envelope, opt-in `humanJson`, diagnostic and
  warnings are all redacted **before** any write and **before** `JSON.stringify`, so
  escaped/multilinear forms of registered secrets cannot reform post-serialization;
  empty-string secrets are skipped defensively (line 23).
- **Env-only secrets enforced end-to-end.** Core rejects non-environment sources for
  secret-designated fields pre-merge (resolver.ts:235); `cli/src/edge.ts` derives
  `secretKeys` from the catalog and registers non-empty environment values into the
  invocation redaction set before any inspection (`registerEdgeSecrets`, edge.ts:40-68,
  193-198, 260).

## 4. (C) Rules Conformance Ruling — REMEDIATION COMPLETE AND CORRECT

`git show 35b31c5` verified against `.ai/rules/typescript.md` and the RETROACTIVE note in
PM notes: all five flagged violations are remediated (grep guards independently
confirmed: zero `../contracts` in `packages/core/src/config/**`; zero `../../packages`
deep imports in `scripts/checks/exports-parity.ts`; no star imports in
`tests/structure/config-contract.test.ts`).

**Ruling CR-1 — remaining documented post-guard casts: SANCTIONED.** Rules §0 bans an
"`as` cast **used to silence a type error**", and §12 requires no "*unjustified* `as`";
it does not ban all casts. The three `resolver.ts` casts (lines ~178, ~345, ~410) each
carry a one-line `// Guard-validated:` reason tied to a preceding runtime check
(JSON-compat walk, catalog-by-construction, schema-accepted values); the single test cast
(`config-default-positions.test.ts:36-37`) is a deliberately out-of-contract negative
input with its justification comment, replacing the prior `as unknown as` double cast.
Checker-wins corroboration: typecheck/lint/format green in `164624` log with no
suppression directives added. The `redact()` `as T` in `serialize.ts` predates this
change (file last on `main-tools` at `b2914fd`, GH-172; no `as T` lines in this change's
diff) — out of scope (recorded as F-3).

**Ruling CR-2 — public `serializeProductionSchema`: SANCTIONED.** Spec F-7 explicitly
permits "a pure core resolver and **catalog/schema helpers** … through the existing core
`.` entry (no new public `./config` subpath)". The helper is a pure string builder over
`PRODUCTION_SCHEMA`, exported only via the existing root entry (`packages/core/src/index.ts`),
with no new subpath and content-inventory registration added in the same commit; it also
operationalizes AC-F3-5's "shipped JSON artifact matches the public core schema value"
and removes the check's rule-violating deep source import (§2/§11). Byte-identity claim
verified textually: the helper returns exactly the expression the check previously
inlined (`JSON.stringify(PRODUCTION_SCHEMA, null, 2) + "\n"`), and the remediation gate
re-ran the parity check green.

## 5. (D) Documentation Accuracy — PASS

`doc-syncer-report.md` claims were spot-verified against implementation:
`feature-config-layer.md` documents top-level-only `x-` vendor data, the unknown-`get`
`config.key.unknown` failure, the exact first-match skip order with the never-read rule
(line 62-64), empty production catalog vs required bootstrap descriptor (line 75), all
nine error codes (line 111), and the actual packed artifact names / no `./config`
subpath (line 150) — each matches the code and registry state read by this review.
Error-table 13/13 bidirectional sync is backed by the binding guard (runner-evidenced)
and the nine rows are present in the documented table.

## 6. (E) License / Dependency Governance — PASS

`doc/legal/dependency-licenses.yaml` (v2) rows are truthful: `yaml@2.9.1` (ISC) carries
all four locked uses incl. the new adapters runtime dependency; `ajv@8.20.0` (MIT)
carries core runtime + the commitlint transitive; the four closure rows match spec §8.4
exactly (`fast-deep-equal@3.1.3` MIT, `fast-uri@3.1.9` BSD-3-Clause,
`json-schema-traverse@1.0.0` MIT, `require-from-string@2.0.2` MIT). The owner-review
gate is worded truthfully — registry header and `c2_determination: proposed at delivery;
confirmed by the owner at PR review` — so machine `approved` verdicts are explicitly
proposals, and BSD-3-Clause's allow-list addition is the flagged proposed change. No
fabricated acceptance exists in spec (§18, OQ-1, RSK-7), plan, or registry.

## 7. Findings

| ID | Severity | Location | Mapping | Finding | Fix |
|----|----------|----------|---------|---------|-----|
| F-1 | low | `chg-GH-173-plan.md:421` (Phase 5 execution-log row) and the remediation sentence appended in `35b31c5` | plan §Execution Log; Phase 6.3 evidence traceability | Execution-log record is stale: Phase 5 row still reads "commit pending / — " although Phase 5 content was committed (`8fcf880`, `3357c3d`, `c8aae25`), and the appended remediation sentence says "pending runner" although the `164624` runner verification (15:47:03Z) completed **before** commit `35b31c5` (15:48:17Z). Evidence exists; only the record wording lags. | PM folds the actual commit SHAs and the `164624` log reference into the execution log during the Phase 8 finalization pass. No code impact; no severity downgrade applied — recorded as the only actionable finding. |
| F-2 | info | — | RSK-7 / spec OQ-1 | Residual risk carried by design: TDR-0003 and the runtime license/closure compatibility determination (incl. BSD-3-Clause) remain Proposed pending owner PR review before merge/adoption. | None at this phase; gate stays closed until owner acceptance at PR review. |
| F-3 | info | `packages/cli/src/output/serialize.ts:42` | rules §0 (record-only) | `redact()` retains one `as T` cast; it predates this change (GH-172, base `b2914fd`) and is untouched by GH-173. | None within GH-173 scope; noted for any future rules-conformance pass over pre-existing code. |

No critical, high, or medium findings. No vacuous AC evidence, no security regression, no
rules violation, no governance misstatement found.

## 8. Residual Risks

1. **RSK-7 (M, by design):** human TDR-0003/license-closure acceptance pending owner PR
   review; this PASS does not constitute or predict that acceptance.
2. **Lifecycle remainder:** Phases 7 (conditional — not required, no findings above low)
   and 8 (gates, changeset, PR handoff on pushed HEAD) remain open PM-owned work; this
   PASS covers analysis only, not the Phase 8 gate battery on the pushed HEAD.
3. **Pre-existing surface:** out-of-scope legacy casts/patterns from GH-170–172 code were
   not newly audited (F-3 is an example, not an exhaustive list).

## 9. Verdict and Next Step

**PASS.** All 25 ACs trace to non-vacuous, real-path evidence on the sampled
highest-risk set and to runner-evidenced suites for the remainder; security posture
verified in code; rules remediation complete and correct under the checker-wins reading;
docs and license governance accurate and truthful. No remediation phase is activated
(F-1 is a record-keeping update safely absorbable into Phase 8; F-2/F-3 require no
action now).

**Next step:** PROCEED — PM records this review (marks plan 6.1–6.3 complete), treats
Phase 7 as not-required with this artifact as evidence, and advances to Phase 8
(final gates, changeset, open-PR handoff targeting `main-tools`).

## Evidence Index

- Diff base: `main-tools...35b31c5` (91 files, +7491/−130)
- Remediation: `git show 35b31c5` (full read); guards re-run by this reviewer:
  `../contracts` in core config = 0; deep package paths in exports-parity = 0
- Security reads: `yaml-parser.ts` (181 l.), `config-source.ts` (215 l.),
  `serialize.ts` (90 l.), `resolver.ts:215-259`, `edge.ts` (secret registration)
- Tests read: `config-sources.test.ts`, `config-cli.test.ts`, `config-parser.test.ts`,
  `config-restrictions.test.ts`, `config-resolver.test.ts` (assertion bodies)
- Runner logs (existence + tail verified): `164624-gh173-remediation-verify.log`
  (11 steps, ends `ALL STEPS DONE`, final UTC 15:47:03Z), `144249-…phase5-confirmation.*`
- Governance: `doc/legal/dependency-licenses.yaml` + `git diff main-tools...HEAD` on it;
  `.ai/rules/typescript.md`; spec §8.4/OQ-1/RSK-7; plan OQ-1
- Reviewer performed no git state changes, no source/plan edits, no commits.
