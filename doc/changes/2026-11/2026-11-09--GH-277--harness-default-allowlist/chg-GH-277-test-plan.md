---
id: chg-GH-277-test-plan
status: Updated
version: 1.2
created: 2026-11-09T04:10:00Z
last_updated: 2026-11-09T07:10:00Z
owners: [engineering]
service: delivery-os harness adapters
labels: [change, harness, bug, dispatch]
links:
  change_spec: ./chg-GH-277-spec.md
  implementation_plan: ./chg-GH-277-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
version_impact: minor
summary: "Twenty-nine scenarios verifying GH-277: a viable zero-configuration default spawn allowlist (PATH and HOME required, TMPDIR optional, DELIVERY_WORK_PATH injected, no model variables), an additive variable-only optional marker with fail-closed required absence and strictly required credentials, deny-by-default with zero ambient leakage, an additive dispatch data.error.detail that is always present on the pre-session path with kind and code required and field present only when the harness failure carries one, in machine JSON and verbose human output while non-verbose text stays exactly four keys and the spawn-failed identity, token, exit, and last message are unchanged, the additive optional HumanTextContext third parameter of CommandDefinition.humanText (DM-4) with two-parameter definitions still compiling and behaving identically, configuration/schema/defaults and golden-envelope parity, the TC-RELEASE-001 changeset invariant, and one bounded operator-run real dispatch proof in a disposable clone under an isolated probe state root. Every automated scenario is hermetic: the only real child is a synthetic opencode script on a controlled PATH, no live harness CLI runs in CI, and all dispatch facts are injected. Plan v1.2 is aligned with change spec v1.2 and TDR-0017 and names the delivered seams: the verbose diagnostic is selected at the dispatch human-text seam (packages/cli/src/commands/dispatch.ts:133-149) through the additive HumanTextContext and rendered in packages/cli/src/output/dispatch-text.ts, the inspection surface is config get harness.environment --show-origin (packages/cli/src/commands/config.ts:96-155), and the dispatch error type is DispatchEnvelopeError (CommandResultError plus an optional detail), leaving CommandResultError and every other envelope unchanged."
---

# Test Plan - Make the default harness spawn allowlist able to start opencode without user configuration

## 1. Scope and Objectives

This plan protects one defect and five anti-recurrence claims that must be impossible to reintroduce silently. The defect is that the shipped `harness.environment` default declares two model variables the real environment does not set and never declares `PATH` or `HOME`, so a default installation cannot start the default opencode harness and every typed `dispatch` collapses to `dispatch.session.spawn-failed`. The five claims are: (a) the shipped default resolves to exactly `PATH`, `HOME`, and injected `DELIVERY_WORK_PATH` as required and `TMPDIR` as optional, with no model variable; (b) a declared variable entry can be marked optional, and an absent required entry still fails closed with `harness.spawn.variable-missing` naming the variable in `field` while an absent optional entry is omitted; (c) deny-by-default is preserved with zero undeclared ambient variables in the child and a record value taking precedence over the parent value; (d) a pre-session spawn failure keeps the delivered `dispatch.session.spawn-failed` identity, token, outcome, exit, and last message while adding an additive `data.error.detail` that is always present on that path, carries the underlying harness failure `kind` and `code` (both required) and `field` only when the failure carries one, in machine JSON and verbose human output, with non-verbose text still exactly four keys; and (e) the release changeset invariant holds. The verbose human channel rides the additive optional `HumanTextContext` third parameter of the published `CommandDefinition.humanText` (DM-4), which leaves every two-parameter definition and direct two-argument call valid.

The change is additive on the harness environment contract, the dispatch envelope, and the published CLI human-text context, and it leaves the session port, the one-shot runner, the streaming starter, the classifier, the failure-code vocabulary, the delivery-result tokens, and the bash stack untouched. The test plan therefore has to prove two things at once: the repaired default works, and none of the preserved contracts moved. Both are gating.

The most dangerous testing mistakes this plan is designed against are: proving the default with a fixture that still declares the model variables; "proving" PATH resolution with an absolute command path; letting a fake CLI receive an ambient environment that hides a leakage defect; proving the optional marker only on a synthetic descriptor that never reaches the configuration or composition path; asserting the new dispatch detail by inventing a field the contract does not carry or by assuming a detail-less pre-session path; weakening the four-key text contract to make verbose output easy; letting the end-to-end proof write the live state root or release a real lease; and letting a nested real lifecycle mutate this change's worktree during the end-to-end proof.

### 1.1 In Scope

- The shipped `harness.environment` default: exact required/optional sets, no model variables, `defaults` origins, and the empty-configuration resolution path (F-1, F-2, F-6, AC-F1-1..AC-F1-4, AC-F2-1, AC-F2-2, AC-F6-1, DEC-1, DEC-2, DEC-6).
- Model-variable policy: the two `HARNESS_*` names leave the default, no `OC_ADOS_*` mapping is added, and an explicit user declaration of either name keeps required-entry semantics (F-2, AC-F2-2, AC-F2-3, DEC-2).
- The additive variable-only optional marker across the contract, the configuration branch, the catalog/schema, the composition mapping, and the deny-by-default builder: absent required fails closed naming `field`; absent optional is omitted; present optional is forwarded; record value wins; credentials stay strictly required (F-3, F-4, F-6, AC-F3-1..AC-F3-5, AC-F4-2, AC-F6-2, DM-1, DM-2, DEC-3, TDR-0017).
- Deny-by-default and confinement: zero undeclared parent variables in the child, no ambient read in the builder/composition, the unchanged 12-site `node:child_process` allowlist, and the secret-read boundary (F-4, AC-F4-1, NFR-3, NFR-9).
- The additive dispatch `data.error.detail`: machine JSON carriage, verbose human naming, detail always present on the pre-session path with `kind` and `code` required and `field` present only when the failure carries one, unchanged identity/token/outcome/exit/last message, unchanged four-key non-verbose text, identifiers-only single-line bounded content, and no new failure code, token, classifier rule, or error-table row (F-5, AC-F5-1..AC-F5-5, DM-3, DEC-4).
- The additive published CLI human-text context (DM-4): `HumanTextContext = { readonly verbose: boolean }` as an optional third `CommandDefinition.humanText` parameter, dispatch-only consumption, two-parameter definitions and direct two-argument calls unchanged, and an omitted context meaning non-verbose (F-5, AC-F5-3, DM-4).
- The golden spawn-failure envelope: `tests/fixtures/dispatch/golden/errors/spawn-failed.json` gains the always-present detail for its `harness.spawn.refused` failure (kind and code, no field), and its byte-equality consumer `tests/golden/dispatch-errors.test.ts` pins the repaired shape (F-5, DM-3, NFR-4).
- Regression coverage for the default spawn path with a synthetic `opencode` executable on a controlled `PATH`, an absent-required field assertion in both the harness failure and the dispatch detail, an ambient-leak canary, paired optional-present/optional-absent cases, and machine/verbose/non-verbose assertions (F-7, AC-F7-1..AC-F7-5).
- Configuration compatibility: `{ name: "X" }` keeps required semantics with no migration, `value` stays `config.secret.forbidden`, non-boolean marker and marker-plus-`credentialRef` stay `config.value.invalid`, and the generated schema/defaults manifest/source hashes pass parity (F-6, AC-F3-5, AC-F6-1..AC-F6-3, NFR-8).
- The `TC-RELEASE-001` changeset invariant: exactly one added changeset, the five fixed-group packages at `minor`, a non-empty body, no pre-existing changeset modified, and no `@delivery-os/testkit` entry (DEC-5, spec §18).
- One bounded operator-run real-CLI dispatch proof that reaches classification with any token other than `dispatch.session.spawn-failed` and writes an attempt record into an isolated probe state root, executed outside this change's worktree and without reading or mutating the live state root beyond a read-only lease precondition (F-8, AC-F8-1, AC-F8-2, RSK-6).

### 1.2 Out of Scope and Known Gaps

- **[OUT] No requirement change.** Every scenario derives from spec §5, §6, §8, §9, §15, and §17. No new failure code, delivery-result token, classifier rule, error-table row, configuration command, persisted shape, or CLI grammar is expected or tested for (NG-3, NG-4, §8.5).
- **[OUT] No ambient inheritance.** The plan never tests an opt-in passthrough or a fallback that copies `process.env`; it tests only that no undeclared variable leaks (NG-1, NG-8, F-4).
- **[OUT] No engine model routing.** The plan never asserts an `OC_ADOS_*` to `HARNESS_*` mapping, a new model branch, or engine-controlled model selection (NG-2, DEC-2).
- **[OUT] No credential-semantics change.** Optional credentials, literal secret values, and credential-resolution changes are out; the plan asserts that the marker cannot make a credential optional (NG-5, AC-F3-4, AC-F3-5).
- **[OUT] No Windows parity.** Windows host-profile variables (`USERPROFILE`, `APPDATA`, equivalents) are not asserted; the default is the POSIX host profile (NG-6, DEC-6).
- **[OUT] No bash-stack changes.** `scripts/**` is not modified and no bash test is an oracle for the typed CLI (NG-7, §7.2). The typed path is proven in TypeScript.
- **[OUT] No live harness tier in CI.** The automated suites never invoke the real `opencode` or `claude` CLI. The single real-CLI proof is the operator-run procedure in §6.3 (GAP-T1).
- **[GAP-T1 — the real CLI is proven once, manually]** AC-F8-1/AC-F8-2 cannot run deterministically: they need a live model session and installed CLI. They are proven by the bounded §6.3 procedure during delivery and re-run after merge under an isolated probe state root, with evidence recorded in §10. No AC except AC-F8-1/AC-F8-2 depends on a live CLI.
- **[GAP-T2 — the detail type is named by spec v1.2 and lands with the implementation]** Spec v1.2 DM-3 and Appendix C name the type: `DispatchEnvelopeError` in `packages/core/src/contracts/dispatch.ts` is the delivered `CommandResultError` (same six fields) plus `detail?: { kind: "harness" | "config"; code: string; field?: string }`, and `DispatchEnvelopeData.error` is retyped from `CommandResultError` to it. The type does not exist in the delivered tree yet, so until it lands the owning authority is spec DM-3/Appendix C; after it lands, every assertion must read the delivered contract. `CommandResultError` (`packages/core/src/contracts/result.ts:36-43`) stays at six fields, and every other envelope keeps its six-field error because it is built from the error table (`packages/cli/src/index.ts:262-272`). §3.5 and TC-HDA-029 record this boundary.
- **[GAP-T5 — the published human-text type is widened additively by DM-4]** Spec v1.2 DM-4 adds an optional third `HumanTextContext = { readonly verbose: boolean }` parameter to `CommandDefinition.humanText` in `packages/cli/src/index.ts`. The type exists in the delivered tree only as the two-parameter form today; after the change lands, TC-HDA-032 must read the delivered signature and `pnpm typecheck` must accept a two-parameter definition and a direct two-argument call.
- **[GAP-T3 — a real dispatch cannot dump the child environment]** The real proof proves a boot and an attempt record; the exact child environment is proven hermetically by the synthetic-CLI suite (TC-HDA-010/012), because a live `opencode` cannot be asked to print its environment. This split is intentional.
- **[GAP-T4 — resolved by spec v1.2: the verbose rendering seam is named]** Spec v1.2 §2.1/§16 fixes the channel: `--verbose` is parsed in `packages/cli/src/index.ts:317`, passed to `writeOutput` (`packages/cli/src/output/serialize.ts:73, 97-113`), and handed to the dispatch command's human-text selection as the optional `HumanTextContext` (DM-4); the dispatch command selects its human text at `packages/cli/src/commands/dispatch.ts:133-149`, and `renderDispatchText` (`packages/cli/src/output/dispatch-text.ts:28-34`) keeps the four non-verbose keys while the dispatch text module renders the bounded verbose diagnostic. The shared stderr `diagnosticFor` (`packages/cli/src/index.ts:298-303`) stays non-verbose-gated and carries no dispatch envelope data. TC-HDA-032 asserts stdout verbose detail, the two-parameter compatibility clause under `pnpm typecheck`, four-key non-verbose text, and the absence of dispatch detail on stderr; OQ-T3 is closed.

### 1.3 Risk-Based Prioritization

**Must-pass (AC-gating).** Every scenario below is must-pass; the change is small and every ticket claim maps to one of them. The leading indicators whose failure reopens the design rather than just the test are: `TC-HDA-005` (exact shipped default), `TC-HDA-010` (zero-config default spawn over a synthetic CLI on `PATH`), `TC-HDA-011` (bare command resolution with an off-PATH control), `TC-HDA-012` (no ambient leakage), `TC-HDA-014` (required absence names the field and spawns no child), `TC-HDA-015`/`TC-HDA-016` (optional absent/present), `TC-HDA-018` (credential cannot be bypassed), `TC-HDA-030`/`TC-HDA-031`/`TC-HDA-032` (additive detail and four-key text), `TC-HDA-033` (unchanged identity), and `TC-HDA-100`/`TC-HDA-101` (the real proof).

**Supplemental but still gating.** `TC-HDA-001`–`TC-HDA-004` (contract, schema, artifacts, confinement), `TC-HDA-017` (record precedence), `TC-HDA-019`/`TC-HDA-020` (model-name and `{ name }` compatibility), `TC-HDA-021`/`TC-HDA-022`/`TC-HDA-023` (validation, inspection, composition mapping), `TC-HDA-029` (dispatch contract shape), `TC-HDA-034` (detail hygiene), `TC-HDA-035` (field in both layers), and `TC-HDA-006` (release invariant). They fail loudly and cheaply, so they must stay green while iterating.

### 1.4 Binding Judgment Calls Enforced by This Plan

| # | Judgment call | Where enforced |
|---|---|---|
| 1 | The shipped default is the exact set `PATH`, `HOME`, `DELIVERY_WORK_PATH` required and `TMPDIR` optional; no `HARNESS_MODEL` or `HARNESS_SMALL_MODEL` is declared (spec F-1, AC-F1-3, DEC-1). | `TC-HDA-005`, `TC-HDA-010` |
| 2 | "Required" means absent fails closed with `harness.spawn.variable-missing` and the name in `field`; "optional" means absent is omitted. Absence of the marker means required (spec F-3, DEC-3, TDR-0017). | `TC-HDA-014`, `TC-HDA-015`, `TC-HDA-016`, `TC-HDA-020` |
| 3 | The marker is variable-only; a credential entry is always required and an unresolved reference is `config.credential.missing`; a marker combined with `credentialRef` is `config.value.invalid` (spec F-3, NG-5, TDR-0017 C-5). | `TC-HDA-018`, `TC-HDA-021` |
| 4 | Deny-by-default means the child environment is exactly the declared and present entries plus resolved credentials; an undeclared parent canary is absent, and `OC_ADOS_*` is never forwarded or mapped (spec F-4, AC-F1-4, AC-F2-2, AC-F4-1). | `TC-HDA-012`, `TC-HDA-004` |
| 5 | A record value wins over the injected parent value; an undeclared record name changes nothing (spec F-4, AC-F4-2). | `TC-HDA-017` |
| 6 | The dispatch identity `dispatch.session.spawn-failed`, its token, outcome, exit, category, retryability, consequence, remediation hint, and last message are unchanged; the additive `detail` is always present on the pre-session path and optional only because other dispatch error rows lack it (spec F-5, DM-3, DEC-4). | `TC-HDA-029`, `TC-HDA-030`, `TC-HDA-033` |
| 7 | The detail carries identifiers only (`kind`, `code`, `field`), is single-line, and is bounded to 256 characters; `kind` and `code` are required and `field` is present only when the harness failure carries one; it never carries an environment value or secret (spec NFR-6, AC-F5-1, AC-F5-5). | `TC-HDA-030`, `TC-HDA-034` |
| 8 | Non-verbose dispatch text is exactly four keys and four lines in the delivered order `result`, `pr_url`, `exit_code`, `last_message` (spec NFR-7, `packages/cli/src/output/dispatch-text.ts:28-34`). | `TC-HDA-032` |
| 9 | No new failure code, delivery-result token, classifier rule, or error-table row; the four reused identities are `harness.spawn.variable-missing`, `config.credential.missing`, `config.value.invalid`, and `config.secret.forbidden` (spec NFR-4, TDR-0017 C-6). | `TC-HDA-021`, `TC-HDA-033` |
| 10 | "The builder/composition reads no ambient environment" is a semantic tree invariant plus a negative fixture, not a file hash or a moving-base diff (testing-strategy §Invariant-test authoring). | `TC-HDA-004` |
| 11 | The only real child in the automated battery is a synthetic `opencode` script on a controlled `PATH`; no real harness CLI runs in CI (spec F-7, NFR-5 analogue, GAP-T1). | `TC-HDA-010`, `TC-HDA-011`, §6.1 |
| 12 | The end-to-end proof runs in a disposable clone outside this worktree under a probe-only brand (`DELIVERY_OS_WORKING_NAME=gh277-probe`) whose state root is `$LIVE_HOME/.gh277-probe-state`, kills only its own `opencode` child, never writes or releases anything in the live state root, and never lets a nested lifecycle touch this change's worktree (spec AC-F8-2, RSK-6). | `TC-HDA-100`, `TC-HDA-101`, §6.3 |
| 13 | The verbose diagnostic is selected at the dispatch human-text seam (`packages/cli/src/commands/dispatch.ts:133-149`) from the optional `HumanTextContext` third parameter (DM-4: `{ readonly verbose: boolean }`), uses the `--verbose` fact parsed at `packages/cli/src/index.ts:317`, and is rendered in `packages/cli/src/output/dispatch-text.ts`; two-parameter definitions and direct two-argument calls stay valid under `pnpm typecheck`; the shared stderr `diagnosticFor` stays non-verbose-gated and carries no dispatch envelope data (spec §2.1, §16, DM-4, AC-F5-3). | `TC-HDA-032` |
| 14 | The delivered golden spawn-failure envelope gains the always-present detail for a `harness.spawn.refused` failure with no `field`, so the golden byte-equality consumer pins the repaired shape rather than the pre-change six-field error (spec F-5, Appendix C, DM-3). | `TC-HDA-030`, `TC-HDA-033` |

## 2. References

- **Change specification (v1.2)**: [chg-GH-277-spec.md](./chg-GH-277-spec.md) — F-1..F-8, AC-F1-1..AC-F8-2 (29 ACs), NFR-1..NFR-9, DEC-1..DEC-6, RSK-1..RSK-8, DM-1..DM-4, OQ-1 (resolved by TDR-0017), OQ-2 (open), §6 flows 1–6, §8.3 data-model impact (DM-3 names `DispatchEnvelopeError`, DM-4 names the additive `HumanTextContext`), §8.4 external contract, §8.5 backward compatibility, §17.1 Definition of Done, Appendix B (proposed default), Appendix C (diagnostic detail shape and the always-present pre-session attachment rule), Appendix D (source evidence index). Spec v1.2 retains the v1.1 decisions, resolves DoR iteration 1 (DM-4, the detail-attachment rule, and the Definition of Done), and keeps `config get harness.environment --show-origin` as the inspection surface (AC-F6-3).
- **Implementation plan**: [chg-GH-277-plan.yaml](./chg-GH-277-plan.yaml) — authored after this file (phase 4). Where the plan and this test plan disagree on file placement, this plan's §7.1 names the required files and the plan owns sequencing.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun test` over `tests/**/*.test.ts`, fixtures never named `*.test.ts`, no moving-base diff assertions, permanent invariants as tree assertions, boundaries via `pnpm check:boundaries`, aggregate gate `pnpm check`.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, no `any`/`!`/unjustified `as`, injected fakes over `mock.module`, deterministic tests with no real clock/network/`$HOME`/sleeps, optional properties modelled as absent.
- **Decision record (DEC-3 governance)**: [TDR-0017](../../../../doc/decisions/TDR-0017-additive-optional-harness-environment-marker.md) — the additive `optional?: boolean` marker on `HarnessEnvironmentVariable`, absent/`false` = required, credential entries strictly required, no schema bump, and the exact constraints C-1..C-8 this plan verifies. Spec v1.2 lists `TDR-0017` in `links.decisions` and in the §13 "Governed by" row; this plan cites it as the governing record.
- **Additive-contract rule**: [TDR-0008](../../../../doc/decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) and [TDR-0016](../../../../doc/decisions/TDR-0016-harness-streaming-spawn-seam.md) — additive-within-v1, record-governed adapter-contract evolution.
- **Delivered harness contract**: [packages/core/src/contracts/harness.ts](../../../../packages/core/src/contracts/harness.ts) — `HarnessEnvironmentVariable` (120-124), `HarnessEnvironmentCredential` (127-131), `HarnessEnvironmentEntry` (134), `HarnessExecutionEnvironmentDescriptor` (144-148), `HARNESS_FAILURE_CODES` (286-296), `HarnessFailure` (306-314).
- **Delivered builder**: [packages/core/src/domain/harness-spawn-env.ts](../../../../packages/core/src/domain/harness-spawn-env.ts) — record-over-parent precedence (48), required-absence failure (49-56), credential failure (60-64).
- **Delivered configuration**: [packages/core/src/config/defaults.ts](../../../../packages/core/src/config/defaults.ts) (harness branch 45-63; environment 58-62), [packages/core/src/config/harness.ts](../../../../packages/core/src/config/harness.ts) (setting 23-25; validation 110-134), [packages/core/src/config/catalog.ts](../../../../packages/core/src/config/catalog.ts) (entry fields 276-284), [packages/core/src/config/schema.ts](../../../../packages/core/src/config/schema.ts) (object schema and `additionalProperties: false` 19-33).
- **Generated-artifact parity**: [scripts/checks/exports-parity.ts](../../../../scripts/checks/exports-parity.ts) — `config.schema.json`, `defaults-positions.json`, `schema-sources.json` (23-24, 54-58) and the generate flag (117); [tests/checks/config-default-positions.test.ts](../../../../tests/checks/config-default-positions.test.ts) (16, 18-35).
- **Delivered composition**: [packages/cli/src/production.ts](../../../../packages/cli/src/production.ts) — allowlist mapping (423-438), `DELIVERY_WORK_PATH` record injection (441-447), bare `opencode` command and args (462-465).
- **Delivered dispatch**: [packages/core/src/app/dispatch.ts](../../../../packages/core/src/app/dispatch.ts) — `errorOf` (185-200), attempt envelope assembly (347-400), pre-session spawn branch (466-485, message 482, evidence ref 483); [packages/core/src/contracts/dispatch.ts](../../../../packages/core/src/contracts/dispatch.ts) (attempt record 189-210; envelope `data` 277-296, `error?: CommandResultError` at 288; `DISPATCH_MAX_LAST_MESSAGE_CHARS` 356); [packages/core/src/contracts/result.ts](../../../../packages/core/src/contracts/result.ts) (36-43). Spec v1.2 DM-3 adds `DispatchEnvelopeError` in `dispatch.ts` and retypes `DispatchEnvelopeData.error` to it; `result.ts` `CommandResultError` stays unchanged.
- **Delivered dispatch text and verbose seam**: [packages/cli/src/output/dispatch-text.ts](../../../../packages/cli/src/output/dispatch-text.ts) — `renderDispatchText` four keys (28-34); [packages/cli/src/commands/dispatch.ts](../../../../packages/cli/src/commands/dispatch.ts) — `humanText` selection (133-149), which is the dispatch-specific seam for the bounded verbose diagnostic (spec §16); [packages/cli/src/index.ts](../../../../packages/cli/src/index.ts) — the published `CommandDefinition.humanText` two-parameter type (51) and its two-argument call site (351-353), widened additively by DM-4 (`HumanTextContext = { readonly verbose: boolean }`).
- **Configuration inspection surface**: [packages/cli/src/commands/config.ts](../../../../packages/cli/src/commands/config.ts) — `config get <key>` and `--show-origin` accepted only with `get` (96-99, 102-155), returning `{ key, value, origin }` (150) with `originLabel` (`layer=defaults file=... line=...`).
- **CLI flag plumbing**: [packages/cli/src/index.ts](../../../../packages/cli/src/index.ts) — `diagnosticFor` (298-303), `emitEnvelope`/`verbose` parse (316-317), `humanText` invocation (351-352), `writeOutput` call (413-435); [packages/cli/src/output/serialize.ts](../../../../packages/cli/src/output/serialize.ts) — `WriteOutputOptions.verbose` (73), `writeOutput` (89-115), machine-mode verbose selection (97-98), redacted `humanText` write (103-104).
- **Error table**: [packages/core/src/contracts/error-table.ts](../../../../packages/core/src/contracts/error-table.ts) — `harness.spawn.variable-missing` row (1001-1011).
- **Golden dispatch envelope**: [tests/fixtures/dispatch/golden/errors/spawn-failed.json](../../../../tests/fixtures/dispatch/golden/errors/spawn-failed.json) — the byte-pinned spawn-failure envelope consumed by [tests/golden/dispatch-errors.test.ts](../../../../tests/golden/dispatch-errors.test.ts:49-57); its scenario is `createScriptedHarness({ spawnFails: true })`, whose failure is `{ kind: "harness", code: "harness.spawn.refused" }` with no `field` ([tests/fixtures/dispatch/harness.ts](../../../../tests/fixtures/dispatch/harness.ts:158-162)). Under the always-present pre-session attachment rule the golden gains `data.error.detail` with `kind` and `code` and no `field`.
- **Release invariant**: [tests/checks/privacy-release.test.ts](../../../../tests/checks/privacy-release.test.ts) — `TC-RELEASE-001` (133), fixed packages (42-49), `validateChangeset` (70-86).
- **Child-process allowlist**: [tests/structure/harness-imports.test.ts](../../../../tests/structure/harness-imports.test.ts) — the exact 12 declared sites (26-40).
- **Current system spec to reconcile later**: [feature-config-layer.md](../../../../doc/spec/features/feature-config-layer.md) (harness environment default/entry shape), [feature-harness-adapters.md](../../../../doc/spec/features/feature-harness-adapters.md) §1/§4 (deny-by-default descriptor and configuration), [feature-dispatch-engine.md](../../../../doc/spec/features/feature-dispatch-engine.md) (spawn-failure narrative and error table), [feature-result-contract.md](../../../../doc/spec/features/feature-result-contract.md) (error object field set), [feature-adapter-ports.md](../../../../doc/spec/features/feature-adapter-ports.md) (descriptor description and evolution rule).
- **Sibling precedent**: [chg-GH-275-test-plan.md](../2026-11-08--GH-275--opencode-harness-contract/chg-GH-275-test-plan.md) — the real-CLI proof procedure shape (§6.3), the mutation-evidence table (§7.3), and the execution-log skeleton (§10) reused here.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC | Criterion (abbreviated) | TC ID(s) | Status |
|----|--------------------------|----------|--------|
| AC-F1-1 | Shipped defaults composed against a parent with `PATH`/`HOME` and without the model variables; a synthetic `opencode` on `PATH` spawns; environment construction succeeds, an attempt record exists, and the result token is not `dispatch.session.spawn-failed`. | TC-HDA-010 | Covered |
| AC-F1-2 | The configured command is the bare name `opencode` with no absolute path; the child is started with the declared `PATH` and the executable is resolved and attempted. | TC-HDA-011 | Covered |
| AC-F1-3 | The shipped allowlist has exactly `PATH`, `HOME`, `DELIVERY_WORK_PATH` required and exactly `TMPDIR` optional, and declares no model variable. | TC-HDA-005 | Covered |
| AC-F1-4 | An undeclared parent variable is absent from the child environment. | TC-HDA-012 | Covered |
| AC-F2-1 | Zero configuration and `HARNESS_MODEL`/`HARNESS_SMALL_MODEL` unset: no required-variable failure occurs when a spawn is composed. | TC-HDA-013 | Covered |
| AC-F2-2 | Ambient `OC_ADOS_MAIN_MODEL`/`OC_ADOS_SMALL_MODEL` are neither forwarded nor mapped and no `HARNESS_*` name is synthesized. | TC-HDA-012 | Covered |
| AC-F2-3 | An explicit user declaration of `HARNESS_MODEL` as required with a parent that lacks it fails closed with `harness.spawn.variable-missing` naming `HARNESS_MODEL`. | TC-HDA-019 | Covered |
| AC-F3-1 | A declared required variable absent from parent and record fails with `harness.spawn.variable-missing`, the variable in `field`, no child spawned, and no partial environment returned. | TC-HDA-014 | Covered |
| AC-F3-2 | A declared optional variable absent from parent and record builds successfully with the key absent. | TC-HDA-015 | Covered |
| AC-F3-3 | A declared optional variable present in parent or record is forwarded with that value. | TC-HDA-016 | Covered |
| AC-F3-4 | A declared credential entry whose reference does not resolve fails closed with `config.credential.missing` and no optional marker can bypass it. | TC-HDA-018 | Covered |
| AC-F3-5 | A non-boolean marker, or a marker on a credential entry, classifies `config.value.invalid`; a literal `value` remains `config.secret.forbidden`. | TC-HDA-001, TC-HDA-002, TC-HDA-021 | Covered |
| AC-F4-1 | The builder and composition introduce no ambient environment read; the child environment comes from descriptor, injected parent, record, and credential port only; the single host child-process site is unchanged. | TC-HDA-004, TC-HDA-012 | Covered |
| AC-F4-2 | A declared record value wins over the parent value for the same name; an undeclared record name changes nothing. | TC-HDA-017 | Covered |
| AC-F5-1 | A pre-session spawn failure with an underlying failure keeps `data.error.code = dispatch.session.spawn-failed` and carries an always-present `data.error.detail` with the underlying `kind` and `code`, plus `field` only when the failure carries one. | TC-HDA-029, TC-HDA-030 | Covered |
| AC-F5-2 | With `--json`, the underlying detail is present in machine output and survives the redaction path. | TC-HDA-031 | Covered |
| AC-F5-3 | In verbose human mode the dispatch human-text selection receives the parsed `--verbose` fact through the optional `HumanTextContext` and names the underlying code and, when present, the field; a two-parameter definition still type-checks under `pnpm typecheck` and behaves identically; without verbose, text output remains exactly the four delivered keys. | TC-HDA-032 | Covered |
| AC-F5-4 | The spawn-failed category, retryability, consequence, remediation hint, token, outcome, exit projection, and last message are unchanged, and no new failure code, token, classifier rule, or error-table row exists. | TC-HDA-033 | Covered |
| AC-F5-5 | A detail carrying a variable name but no value contains identifiers only, is single-line, and is bounded to 256 characters. | TC-HDA-034 | Covered |
| AC-F6-1 | An empty configuration resolves the new default list with `defaults` origins, and the generated schema, defaults-position manifest, and source hashes pass their parity checks. | TC-HDA-002, TC-HDA-003, TC-HDA-005 | Covered |
| AC-F6-2 | An existing valid configuration entry written as `{ name: "X" }` keeps required semantics and requires no migration. | TC-HDA-001, TC-HDA-020, TC-HDA-023 | Covered |
| AC-F6-3 | The inspection surface `config get harness.environment --show-origin` renders the four shipped default entries with the `optional` marker on `TMPDIR`, reports the origin `defaults`, and emits no secret value. | TC-HDA-022 | Covered |
| AC-F7-1 | The regression suite contains a default-allowlist spawn with a fake CLI on `PATH` asserting the attempt record and a token other than `dispatch.session.spawn-failed`. | TC-HDA-010 | Covered |
| AC-F7-2 | The regression suite contains an absent-required-variable case asserting the field name in the harness failure and in the dispatch detail. | TC-HDA-035 | Covered |
| AC-F7-3 | The regression suite contains an ambient-leak canary asserting an undeclared parent variable is absent from the child. | TC-HDA-012 | Covered |
| AC-F7-4 | The regression suite contains machine JSON and verbose human assertions for the underlying code and field, and a non-verbose four-key text assertion. | TC-HDA-031, TC-HDA-032 | Covered |
| AC-F7-5 | The regression suite contains paired optional-present and optional-absent cases for `TMPDIR`. | TC-HDA-015, TC-HDA-016 | Covered |
| AC-F8-1 | One bounded real `dispatch GH-277` on the installed healthy CLI with no user configuration declaration reaches classification with any token other than `dispatch.session.spawn-failed`, and an attempt record exists. | TC-HDA-100 | Covered |
| AC-F8-2 | The end-to-end proof is bounded and creates no nested lifecycle mutation in this change's worktree. | TC-HDA-101 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 005, 010, 011, 023; F-2 → 012, 013, 019; F-3 → 001, 002, 014, 015, 016, 018, 020, 021; F-4 → 004, 012, 017, 018; F-5 → 029, 030, 031, 032, 033, 034, 035; F-6 → 001, 002, 003, 005, 021, 022, 023; F-7 → 010, 012, 015, 016, 031, 032, 035; F-8 → 100, 101.

**Decision coverage**: DEC-1 → 005, 010, 013, 023; DEC-2 → 012, 013, 019; DEC-3 → 001, 002, 014, 015, 016, 017, 018, 020, 021; DEC-4 → 029, 030, 031, 032, 033, 034, 035; DEC-5 → 006; DEC-6 → 005, 012. TDR-0017 C-1..C-8 → 001, 002, 003, 014, 015, 016, 018, 020, 021, 023.

**Risk coverage**: RSK-1 → 004, 012; RSK-2 → 012, 019; RSK-3 → 014, 015, 016, 020; RSK-4 → 031, 032, 034; RSK-5 → 100; RSK-6 → 101; RSK-7 → OQ-T2/TDR-0017 closure, 001; RSK-8 → 002, 003, 022.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no REST/HTTP endpoint (§8.1 N/A) and no event or message contract (§8.2 N/A). There are therefore no `API-*` or `EVT-*` identifiers to trace. The data-model surfaces this plan covers are enumerated here so no surface escapes the matrix.

| Surface | Declared change | TC ID(s) | Observable assertion |
|---|---|---|---|
| DM-1 — `harness.environment` configuration entry | Gains an optional boolean marker; remains `name` plus optional `credentialRef`; marker valid only on a variable entry | TC-HDA-002, TC-HDA-021, TC-HDA-022 | Catalog/schema admits `optional: boolean`; non-boolean and marker+`credentialRef` classify `config.value.invalid`; literal `value` stays `config.secret.forbidden`; inspection shows the marker |
| DM-2 — Harness execution-environment descriptor variable entry | Gains the same additive marker; credential entry unchanged | TC-HDA-001, TC-HDA-017, TC-HDA-023 | Contract type carries `optional?: boolean`; composition maps it verbatim; builder uses it; credential form byte-identical |
| DM-3 — Dispatch envelope error detail (`DispatchEnvelopeError`) | `packages/core/src/contracts/dispatch.ts` declares `DispatchEnvelopeError` = the delivered `CommandResultError` (same six fields) plus `detail?: { readonly kind: "harness" \| "config"; readonly code: string; readonly field?: string }`; `DispatchEnvelopeData.error` is retyped from `CommandResultError` to it; `CommandResultError` and every other envelope are unchanged | TC-HDA-029, TC-HDA-030, TC-HDA-031, TC-HDA-034 | Error code identity unchanged; `detail` is optional in the type (other dispatch error rows lack it) and always present on the pre-session path; `kind` and `code` are required and `field` is present only when carried; fields are identifiers only; `CommandResultError` keeps exactly six fields and every non-dispatch envelope keeps its six-field error |
| DM-4 — CLI command-definition human-text context (additive) | `packages/cli/src/index.ts` gains `HumanTextContext = { readonly verbose: boolean }` and widens `CommandDefinition.humanText` with an optional third context parameter; only the dispatch command consumes it; omitted context means non-verbose; existing two-parameter definitions and direct two-argument calls stay valid | TC-HDA-032 | `pnpm typecheck` accepts a two-parameter definition and a direct two-argument call; dispatch verbose output names the underlying code and field; non-verbose output stays exactly four keys; no other `CommandDefinition` member changes |
| Shipped `harness.environment` default | Replaced set | TC-HDA-005, TC-HDA-010, TC-HDA-011, TC-HDA-023 | Exact required/optional set; bare command resolves; composition injects `DELIVERY_WORK_PATH` through the record |
| Dispatch text contract | Unchanged four keys; verbose adds a bounded diagnostic selected at the dispatch human-text seam (`packages/cli/src/commands/dispatch.ts:133-149`) through DM-4 and rendered in `packages/cli/src/output/dispatch-text.ts` | TC-HDA-032 | Exactly four lines in order without verbose; verbose names the underlying code and field on the human-text channel with no dispatch detail on stderr |
| Golden spawn-failure envelope | `tests/fixtures/dispatch/golden/errors/spawn-failed.json` gains the always-present detail for `harness.spawn.refused` (kind and code, no field); its consumer stays byte-exact | TC-HDA-030, TC-HDA-033 | Byte-equality consumer `tests/golden/dispatch-errors.test.ts` passes with `data.error.detail = { kind: "harness", code: "harness.spawn.refused" }` and no `field` |
| Configuration inspection | `config get harness.environment --show-origin` | TC-HDA-022 | Four default entries, `optional: true` only on `TMPDIR`, origin label `layer=defaults …`, no secret value |
| Release metadata | One added changeset | TC-HDA-006 | Exactly one added changeset with five fixed-group packages at `minor` and a non-empty body |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | Zero-configuration default spawn success on a POSIX parent with `PATH` and `HOME` (100% of cases). | TC-HDA-010, TC-HDA-013 | Covered |
| NFR-2 | 100% of absent required entries fail with `harness.spawn.variable-missing`, name the variable in `field`, and attempt no child spawn. | TC-HDA-014, TC-HDA-035 | Covered |
| NFR-3 | 0 undeclared parent variables present in the child across the test matrix. | TC-HDA-004, TC-HDA-012 | Covered |
| NFR-4 | 0 new failure codes, 0 new delivery-result tokens, 0 classifier changes, 0 error-table rows. | TC-HDA-006, TC-HDA-029, TC-HDA-033 | Covered |
| NFR-5 | 100% of pre-session harness failures carry the underlying `kind` and `code` in machine JSON, plus the `field` when the failure carries one; verbose human output names the code and, when present, the field. | TC-HDA-030, TC-HDA-031, TC-HDA-032, TC-HDA-035 | Covered |
| NFR-6 | Detail and verbose text contain identifiers only, no environment value or secret; detail is single-line and at most 256 characters. | TC-HDA-034 | Covered (the 256 threshold is spec-derived until the delivered constant lands; see §3.5) |
| NFR-7 | Exactly 4 keys and 4 lines: `result`, `pr_url`, `exit_code`, `last_message`. | TC-HDA-032 | Covered |
| NFR-8 | 0 required edits for existing valid configuration and 0 changes to the top-level `CommandResult` envelope shape. | TC-HDA-020, TC-HDA-029 | Covered |
| NFR-9 | `pnpm typecheck`, `pnpm test`, `pnpm check:boundaries`, configuration schema/default parity, and the secret-read boundary all pass. | TC-HDA-001, TC-HDA-002, TC-HDA-003, TC-HDA-004, TC-HDA-006, TC-HDA-032 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 29 AC identifiers from spec §17 appear in §3.1 with at least one TC, and no AC identifier outside the spec is used.
- **Orphan TCs**: none. Every functional TC names at least one AC in §5.1 and §5.2; TCs also name the F-/NFR-/DEC-/DM- they discharge. `TC-HDA-006` is the one deliberate exception: it names NFR-4/NFR-9 and spec §18 rather than a functional AC because the release invariant has no AC row in the spec; it is a declared delivery obligation (DEC-5), and the requirement to cover it comes from the ticket/spec rollout section, not from an invented AC.
- **Partially testable, with the boundary recorded**: AC-F8-1/AC-F8-2 are operator-run once (GAP-T1); the exact child environment is proven hermetically rather than by the live CLI (GAP-T3); the named `DispatchEnvelopeError` type does not exist until the implementation lands, so its shape is spec-anchored until then (GAP-T2); the `HumanTextContext` third parameter is spec-anchored until the implementation lands (GAP-T5); the verbose rendering seam is now named by spec v1.2 and OQ-T3 is closed (GAP-T4); NFR-6's 256-character threshold is spec-derived until the delivered constant exists (TC-HDA-034, §3.5).
- **Definition of Done binding**: spec §17.1 binds all 29 ACs, all 29 TCs, NFR-1..NFR-9, M-1..M-20, the single changeset, the bounded real dispatch, and the gate battery to named evidence. This plan's §10 execution log is the DoD-2 evidence, §7.3 plus the §10 mutation log is the DoD-4 evidence, and the §6.3 evidence block is the DoD-6 evidence.
- **Intentional duplicate coverage**: AC-F4-1 spans TC-HDA-004 (static confinement) and TC-HDA-012 (behavioural canary) because a static scan and a real-child observation can regress independently. AC-F5-1 spans TC-HDA-029 (contract shape) and TC-HDA-030 (behavioural detail) because a type can admit detail that dispatch never attaches. AC-F6-1 spans TC-HDA-005 (resolution) and TC-HDA-003 (artifact parity) because the default can resolve while the generated artifacts drift. AC-F6-2 spans TC-HDA-020 (pure validation) and TC-HDA-023 (composition mapping) because an existing entry can keep its meaning at one layer while the production mapping drops it. AC-F7-4 spans TC-HDA-031 (machine) and TC-HDA-032 (verbose/non-verbose) because the two renderers fail differently.
- **No moving-base diff assertion**: "the builder/composition reads no ambient environment" is enforced as a tree invariant plus a behavioural canary (TC-HDA-004/012), not a `origin/main-tools...HEAD` diff. The `TC-RELEASE-001` check is the repository's existing PR-time invariant; TC-HDA-006 executes it rather than duplicating it.
- **Regression half**: the unchanged dispatch, harness, configuration, and structure suites run as-is; §6.4 lists the non-TC regression runs and the aggregate gate.

### 3.5 Source Anchors for Asserted Literals

Every literal count, field name, or value a TC asserts is anchored to an executed read of the file that owns it. Fields introduced by this change are anchored to the change spec v1.2 until the delivered contract exists (GAP-T2), after which the test must read the delivered source. Line references to `chg-GH-277-spec.md` are for spec v1.2.

| Asserted fact | Owning source | Line(s) |
|---|---|---|
| The delivered default allowlist declares `HARNESS_MODEL`, `HARNESS_SMALL_MODEL`, `DELIVERY_WORK_PATH` and no `PATH`/`HOME`/`TMPDIR` | `packages/core/src/config/defaults.ts` | 58-62 |
| The harness default branch begins at `harness:` and includes `kind`, `execution`, `stores`, `environment` | `packages/core/src/config/defaults.ts` | 45-63 |
| Record value precedence `record?.[name] ?? parentEnvironment[name]` | `packages/core/src/domain/harness-spawn-env.ts` | 48 |
| Required absence returns `harness.spawn.variable-missing` with `field: entry.name` and no partial env | `packages/core/src/domain/harness-spawn-env.ts` | 49-56 |
| Unresolved credential returns `config.credential.missing` with `field: variable` | `packages/core/src/domain/harness-spawn-env.ts` | 21-29, 60-64 |
| Variable entry is `{ kind: "variable"; name }` with no optionality; credential entry is `{ kind: "credential"; name; reference }`; union is the two members | `packages/core/src/contracts/harness.ts` | 120-134 |
| Descriptor environment is `readonly HarnessEnvironmentEntry[]` | `packages/core/src/contracts/harness.ts` | 144-148 |
| Nine delivered failure codes including `harness.spawn.variable-missing` | `packages/core/src/contracts/harness.ts` | 286-296 |
| `HarnessFailure` carries `kind`, `code`, `summary`, `field`, `reference`, `status`, `cause` | `packages/core/src/contracts/harness.ts` | 306-314 |
| `HarnessEnvironmentSetting` is `{ name }` or `{ name; credentialRef }` | `packages/core/src/config/harness.ts` | 23-25 |
| Validation: `value` → `config.secret.forbidden`; `credentialRef` branch; every other key → `config.value.invalid` | `packages/core/src/config/harness.ts` | 110-134 |
| Catalog entry fields are exactly `name`, `credentialRef`, `value` | `packages/core/src/config/catalog.ts` | 276-284 |
| Generated schema uses `additionalProperties: false` and object `properties`/`required` | `packages/core/src/config/schema.ts` | 19-33 |
| Config artifacts are `config.schema.json`, `defaults-positions.json`, `schema-sources.json`; source hash is sha256 of `defaults.ts` | `scripts/checks/exports-parity.ts` | 23-24, 54-58 |
| The generation flag is `--generate-config-artifacts` | `scripts/checks/exports-parity.ts` | 117 |
| Composition maps `credentialRef` to a credential entry and otherwise to a variable entry | `packages/cli/src/production.ts` | 423-438 |
| Composition injects `DELIVERY_WORK_PATH` from the descriptor work directory through the validated record | `packages/cli/src/production.ts` | 441-447 |
| The configured harness command is the bare string `"opencode"` with args `run --format json` | `packages/cli/src/production.ts` | 462-465 |
| `errorOf` produces exactly `code`, `category`, `retryable`, `consequence`, `remediationHint`, `summary` | `packages/core/src/app/dispatch.ts` | 185-200 |
| The pre-session branch returns `errorCode: "dispatch.session.spawn-failed"`, `outcome: O_FAILED`, `lastMessage: "spawn failed before a session existed"`, `evidenceRefs: ["harness:spawn-failed"]` | `packages/core/src/app/dispatch.ts` | 466-485 (message 482, ref 483) |
| `DispatchEnvelopeData` carries `error?: CommandResultError` today; spec v1.2 retypes it to `DispatchEnvelopeError`; `lastMessage: string` | `packages/core/src/contracts/dispatch.ts` | 277-296 (error 288) |
| `CommandResultError` fields are `code`, `category`, `retryable`, `consequence`, `remediationHint`, `summary?` and stay unchanged | `packages/core/src/contracts/result.ts` | 36-43 |
| `DispatchEnvelopeError` = `CommandResultError` + optional `detail { kind: "harness" \| "config"; code: string; field?: string }`; the detail is always present on the pre-session path, `kind`/`code` required and `field` only when carried; every other envelope's error is built from the error table and stays six fields | `chg-GH-277-spec.md` | DM-3 239; §8.5 261-271; Appendix C 516-540; F-5 145 |
| `HumanTextContext = { readonly verbose: boolean }`; `CommandDefinition.humanText` gains an optional third context parameter; omitted context means non-verbose; two-parameter definitions and direct two-argument calls stay valid | `chg-GH-277-spec.md`; `packages/cli/src/index.ts` | DM-4 240; AC-F5-3 395; 51, 351-353 |
| The golden spawn-failure envelope gains `data.error.detail = { kind: "harness", code: "harness.spawn.refused" }` with no `field`, and its consumer stays byte-exact | `tests/fixtures/dispatch/golden/errors/spawn-failed.json`; `tests/golden/dispatch-errors.test.ts`; `tests/fixtures/dispatch/harness.ts` | fixture today; consumer 49-57; harness 158-162 |
| Non-verbose text emits exactly `result`, `pr_url`, `exit_code`, `last_message` in that order | `packages/cli/src/output/dispatch-text.ts` | 28-34 |
| The dispatch `humanText` seam selects the bounded verbose diagnostic for a data-bearing result; `renderDispatchText` keeps the four keys | `packages/cli/src/commands/dispatch.ts`; `packages/cli/src/output/dispatch-text.ts` | 133-149; 28-34 |
| `--verbose` is parsed as a global flag (317), passed to `writeOutput` (413-435), consumed by the writer for machine mode (73, 97-113), and passed to the human-text call site as `{ verbose }` (351-353, DM-4) | `packages/cli/src/index.ts`; `packages/cli/src/output/serialize.ts` | 317, 351-353; 73, 89-115 |
| The shared stderr `diagnosticFor` is not verbose-gated, is emitted only for a failure outcome, and carries no dispatch envelope data | `packages/cli/src/index.ts` | 298-303 |
| Configuration inspection is `config get <key> [--show-origin]`; `--show-origin` is accepted only with `get` and returns `{ key, value, origin }` with `originLabel` | `packages/cli/src/commands/config.ts`; `packages/core/src/config/provenance.ts` | 96-99, 102-155; 20-24 |
| `harness.spawn.variable-missing` has one error-table row with category `user`, retryable `false`, consequence `not_landed`, projection `user-validation` | `packages/core/src/contracts/error-table.ts` | 1001-1011 |
| `TC-RELEASE-001` asserts exactly one added changeset; fixed packages are the five; each must be `minor`; testkit excluded; body non-empty | `tests/checks/privacy-release.test.ts` | 42-49, 70-86, 133-175 |
| The `node:child_process` allowlist has exactly 12 declared sites and includes `packages/adapters/src/host/index.ts` | `tests/structure/harness-imports.test.ts` | 26-40 |
| `pnpm check` runs lint → format:check → typecheck → test → check:boundaries → prompt/help/exports parity | `package.json` | 18 |
| The repo-local temp dir `tmp/tmpdir` is created before temp-workspace tests | `tests/checks/config-default-positions.test.ts` | 16 |
| The `data.error.detail` members `kind` and `code` (required) and `field` (optional), plus the 256-character bound | `chg-GH-277-spec.md` | DM-3 239; Appendix C 516-540; NFR-6 281; AC-F5-5 395 |
| The exact default set `PATH`/`HOME`/`TMPDIR`/`DELIVERY_WORK_PATH` and the no-model rule | `chg-GH-277-spec.md` | F-1 141; AC-F1-3 379; Appendix B 480-490 |

## 4. Test Types and Layers

| Layer | What it proves | Runner / invocation | Location |
|---|---|---|---|
| Structure / contract (static) | The optional marker is additive and type-only; the credential form and union are unchanged; `DispatchEnvelopeError` is the dispatch-only additive error type with an optional `detail`, while `CommandResultError` and every other envelope keep their six fields; the published `humanText` type gains only the optional `HumanTextContext` third parameter | `bun test tests/structure/**/*.test.ts`; `pnpm typecheck` | `packages/core/src/contracts/harness.ts`, `packages/core/src/contracts/dispatch.ts`, `packages/core/src/contracts/result.ts`, `packages/cli/src/index.ts`, `tests/structure/**`, `tests/types/**` |
| Configuration and schema | The catalog admits the optional boolean; the generated schema has the property and still rejects unknown keys; literal `value` stays secret-forbidden; the default resolves with `defaults` origins; `config get harness.environment --show-origin` renders the branch; artifacts parity holds | `bun test tests/behaviour/harness-config.test.ts tests/behaviour/config-cli.test.ts tests/checks/config-default-positions.test.ts`; `pnpm typecheck` | `packages/core/src/config/**`, `packages/cli/src/commands/config.ts`, `tests/behaviour/**`, `tests/fixtures/harness/config/**`, `tests/checks/**` |
| Behaviour — builder | Required absence fails closed naming `field`; optional absence is omitted; optional presence is forwarded; record wins; credential failure cannot be bypassed; no ambient leakage | `bun test tests/behaviour/harness-spawn-env.test.ts tests/behaviour/harness-spawn-credential.test.ts` | `tests/behaviour/**`, `tests/fixtures/harness/spawn-env.ts` |
| Behaviour — composition | The production composition maps the marker to the descriptor, injects `DELIVERY_WORK_PATH` through the record, and keeps the bare `opencode` command | `bun test tests/structure/dispatch-composition.test.ts` | `packages/cli/src/production.ts`, `tests/structure/dispatch-composition.test.ts` |
| Behaviour — real synthetic child | The default allowlist actually starts a child by bare name through a controlled `PATH`; the child sees exactly the declared environment; an attempt record is written and the token is not spawn-failed | `bun test tests/behaviour/dispatch-harness-default-spawn.test.ts`; `bun test tests/behaviour/harness-default-path.test.ts` | `tests/behaviour/**`, `tests/fixtures/harness/default-spawn.ts` |
| Behaviour — dispatch diagnostics | `DispatchEnvelopeError` carries an always-present `kind`/`code` detail on the pre-session path, with `field` only when the failure carries one; JSON carries it through redaction; the dispatch human-text seam names it in verbose output through the optional `HumanTextContext` (DM-4); non-verbose text stays four keys; identity and last message are unchanged; the golden envelope pins the repaired shape; detail is bounded | `bun test tests/behaviour/dispatch-error-envelope.test.ts tests/behaviour/dispatch-harness-default-detail.test.ts tests/golden/dispatch-errors.test.ts`; `pnpm typecheck` | `packages/core/src/contracts/dispatch.ts`, `packages/core/src/app/dispatch.ts`, `packages/cli/src/commands/dispatch.ts`, `packages/cli/src/output/dispatch-text.ts`, `packages/cli/src/index.ts`, `tests/golden/**`, `tests/fixtures/dispatch/golden/**`, `tests/behaviour/**` |
| Checks / repository invariants | The release changeset invariant; the 12-site child-process allowlist; the ambient-globals and secret-read boundaries; privacy literals | `bun test tests/checks/privacy-release.test.ts`; `pnpm check:boundaries`; `pnpm check:privacy-literals` | `tests/checks/**`, `scripts/checks/**` |
| Manual (operator-run, not automated) | One real dispatch reaches classification and writes an attempt record; bounded and outside this worktree | §6.3 procedure; evidence in §10 | Disposable clone + installed `opencode` CLI |

**Hermeticity rule (NFR-5 analogue).** No automated suite invokes the real `opencode` or `claude` CLI. The only real child processes in the automated battery are: (a) the synthetic `opencode` script in TC-HDA-010/011, which is a `mkdtemp` script that prints a fixed JSONL stream and never contacts a model; (b) the delivered host-starter synthetic-child suite that already exists and runs a test-supplied script, never a harness CLI; and (c) the process-spawning checks tier that already exists. Every dispatch fact is injected through the existing fixtures.

## 5. Test Scenarios

### 5.1 Scenario Index

`TC-HDA` is a new prefix with no prior use in the repository; no delivered `TC-HARN-*`, `TC-DISP-*`, `TC-CONFIG-*`, `TC-ERR-*`, or `TC-RELEASE-*` identifier is reused for a different scenario. The plan holds 29 scenarios, `TC-HDA-001`..`TC-HDA-101` (gaps in the sequence are intentional grouping, not missing rows), each present in this index, in §5.2, and in §7.2. `TC-HDA-006` executes the repository's existing `TC-RELEASE-001` invariant and does not redefine it.

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-HDA-001 | Additive variable-only optional marker on the harness environment contract | Regression | Critical | High | AC-F3-5, AC-F6-2; F-3, F-6; DM-2; NFR-8, NFR-9; TDR-0017 C-1/C-2 |
| TC-HDA-002 | Catalog and generated schema admit `optional: boolean`; unknown keys and literal values stay rejected | Regression | Critical | High | AC-F3-5, AC-F6-1; F-6; DM-1; NFR-9; TDR-0017 C-7 |
| TC-HDA-003 | Generated config artifacts regenerate and pass source/parity checks | Regression | Critical | High | AC-F6-1; F-6; NFR-9; TDR-0017 C-7 |
| TC-HDA-004 | Builder and composition confinement: no ambient read, 12-site child-process allowlist, secret-read boundary | Regression | Critical | High | AC-F4-1; F-4; NFR-3, NFR-9 |
| TC-HDA-005 | Empty configuration resolves the exact shipped default allowlist with `defaults` origins | Happy Path | Critical | High | AC-F1-3, AC-F6-1; F-1, F-2, F-6; DM-1; DEC-1, DEC-2, DEC-6 |
| TC-HDA-006 | Release invariant: exactly one five-package minor changeset with a non-empty body (`TC-RELEASE-001`) | Regression | Critical | High | NFR-4, NFR-9; DEC-5; spec §18 |
| TC-HDA-010 | Zero-configuration default spawn over a synthetic `opencode` on a controlled `PATH` writes an attempt and classifies | Happy Path | Critical | High | AC-F1-1, AC-F7-1; F-1, F-7; NFR-1; DEC-1 |
| TC-HDA-011 | Bare command `opencode` resolves through the declared `PATH`; off-PATH control fails | Happy Path | Critical | High | AC-F1-2; F-1; DEC-1 |
| TC-HDA-012 | Deny-by-default: undeclared canary absent from the real child; `OC_ADOS_*` neither forwarded nor mapped; no `HARNESS_*` synthesized | Regression | Critical | High | AC-F1-4, AC-F2-2, AC-F4-1, AC-F7-3; F-2, F-4, F-7; NFR-3; DEC-2 |
| TC-HDA-013 | Zero configuration with both model variables unset causes no required-variable failure | Happy Path | Critical | High | AC-F2-1; F-2; NFR-1; DEC-1, DEC-2 |
| TC-HDA-014 | Absent required variable fails closed naming `field`, spawns no child, returns no partial environment | Negative | Critical | High | AC-F3-1; F-3, F-4; NFR-2; DEC-3 |
| TC-HDA-015 | Absent optional variable is omitted and the build succeeds | Happy Path | Critical | High | AC-F3-2, AC-F7-5; F-3; DEC-3 |
| TC-HDA-016 | Present optional variable is forwarded with its value | Happy Path | Critical | High | AC-F3-3, AC-F7-5; F-3; DEC-3 |
| TC-HDA-017 | Record value wins over the parent; an undeclared record name is inert | Regression | Critical | High | AC-F4-2; F-4; DM-2; DEC-3 |
| TC-HDA-018 | Unresolved credential fails closed and no optional marker bypasses it | Negative | Critical | High | AC-F3-4; F-3, F-4; NG-5; DEC-3; TDR-0017 C-5 |
| TC-HDA-019 | Explicit `HARNESS_MODEL` declaration preserves required-entry semantics | Regression | Important | High | AC-F2-3; F-2, F-3, F-6; DEC-2 |
| TC-HDA-020 | Existing `{ name: "X" }` configuration keeps required semantics with no migration | Regression | Critical | High | AC-F6-2; F-6, F-3; NFR-8; DEC-3; TDR-0017 C-7 |
| TC-HDA-021 | Optional-marker validation: non-boolean, marker+`credentialRef`, unknown key, literal value | Negative | Critical | High | AC-F3-5; F-3, F-6; DM-1; NFR-4; TDR-0017 C-5/C-6 |
| TC-HDA-022 | `config get harness.environment --show-origin` renders the new defaults and the optional marker with no secret value | Happy Path | Important | High | AC-F6-3; F-6; DM-1 |
| TC-HDA-023 | Production composition maps the marker and injects `DELIVERY_WORK_PATH` through the record | Regression | Critical | High | AC-F1-1, AC-F6-2; F-1, F-6; DM-2; DEC-1 |
| TC-HDA-029 | `DispatchEnvelopeError`: additive optional `detail` on the dispatch error; `CommandResultError` and every other envelope unchanged | Regression | Critical | High | AC-F5-1; F-5, F-6; DM-3; NFR-8; DEC-4 |
| TC-HDA-030 | Pre-session failure always carries underlying `kind`/`code` on `data.error.detail` (with `field` only when carried) while identity stays `dispatch.session.spawn-failed` | Happy Path | Critical | High | AC-F5-1; F-5; DM-3; NFR-5; DEC-4 |
| TC-HDA-031 | `--json` machine output carries the detail and survives redaction | Regression | Critical | High | AC-F5-2, AC-F7-4; F-5, F-7; NFR-5; DEC-4 |
| TC-HDA-032 | Verbose human output names the underlying code and field at the dispatch human-text seam; non-verbose text is exactly four keys | Regression | Critical | High | AC-F5-3, AC-F7-4; F-5, F-7; NFR-7; DEC-4 |
| TC-HDA-033 | Spawn-failed identity, token, outcome, exit, and last message unchanged; no new vocabulary | Regression | Critical | High | AC-F5-4; F-5; NFR-4; DEC-4 |
| TC-HDA-034 | Detail hygiene: identifiers only, single-line, bounded to 256 characters | Regression | Critical | High | AC-F5-5; F-5; NFR-6; DEC-4 |
| TC-HDA-035 | Absent-required field name appears in both the harness failure and the dispatch detail | Regression | Critical | High | AC-F7-2; F-3, F-5, F-7; NFR-2, NFR-5; DEC-3, DEC-4 |
| TC-HDA-100 | End-to-end real dispatch reaches classification with any token other than `dispatch.session.spawn-failed` | Happy Path | Critical | High | AC-F8-1; F-8, F-1; NFR-1 |
| TC-HDA-101 | End-to-end proof is bounded and leaves this change's worktree git-clean and `HEAD`-stable | Regression | Critical | High | AC-F8-2; F-8; RSK-6 |

### 5.2 Scenario Details

#### TC-HDA-001 - Additive variable-only optional marker on the harness environment contract

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, AC-F3-5, AC-F6-2, DM-2, NFR-8, NFR-9, DEC-3, TDR-0017 C-1/C-2
**Test Type(s)**: Contract, Static, Type
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-environment-marker.test.ts`; `packages/core/src/contracts/harness.ts`; `tests/types/harness-environment-marker.type-test.ts`
**Tags**: @backend, @static, @contract

**Preconditions**:

- The delivered contract is read from `packages/core/src/contracts/harness.ts` (variable entry 120-124, credential entry 127-131, union 134, descriptor 144-148).
- The delivered contract tier is type-plus-`as const` data with no runtime import; the existing data-only scan is retained.

**Steps**:

1. In the type suite, construct a variable entry with `optional: true`, one with `optional: false`, and one with the marker absent; assert all three are assignable to `HarnessEnvironmentVariable`.
2. Assert a credential entry carrying `optional` is rejected at compile time with `@ts-expect-error`; assert the delivered credential shape (`kind`, `name`, `reference`) still compiles unchanged.
3. Assert a descriptor whose `environment` contains both a variable entry with the marker and a credential entry is assignable to `HarnessExecutionEnvironmentDescriptor`.
4. In the runtime suite, assert a representative variable entry's runtime key set equals `["kind","name","optional"]` when the marker is present and `["kind","name"]` when absent (set equality, order-insensitive); assert the credential entry's runtime key set equals `["kind","name","reference"]`.
5. Run the delivered data-only statement scan over `packages/core/src/contracts/harness.ts`; assert only type aliases, imports, exports, and `as const` statements appear, and that the file contains no `from "node:` or `from "bun:`.
6. Assert `HARNESS_FAILURE_CODES` still has exactly nine entries and `HARNESS_OUTCOMES` is unchanged, so the marker added no vocabulary.

**Expected Outcome**:

- The marker is one additive optional boolean on the variable form only; the credential form, the union, and the descriptor keep their delivered meaning; the contracts tier stays type-only.

**Notes / Clarifications**:

- The credential form must remain byte-identical: the marker is not a general entry property (TDR-0017 C-5). A compile-time rejection is stronger than a runtime comment.
- Source anchors: `packages/core/src/contracts/harness.ts:120-134`, `:144-148`, `:286-296`.

#### TC-HDA-002 - Catalog and generated schema admit `optional: boolean`; unknown keys and literal values stay rejected

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F3-5, AC-F6-1, DM-1, NFR-9, TDR-0017 C-7
**Test Type(s)**: Contract, Configuration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-config.test.ts`; `packages/core/src/config/catalog.ts`; `packages/core/src/config/schema.ts`
**Tags**: @backend, @config, @schema

**Preconditions**:

- The delivered catalog entry fields are exactly `name`, `credentialRef`, `value` (`packages/core/src/config/catalog.ts:276-284`).
- The generated schema uses object `properties` and `additionalProperties: false` (`packages/core/src/config/schema.ts:19-33`).

**Steps**:

1. Assert `PRODUCTION_SCHEMA` exposes `harness.environment.items.properties.optional` with `type: "boolean"` and that `harness.environment.items.additionalProperties` is `false`.
2. Assert the catalog entry still exposes `name` (required), `credentialRef`, and `value`; assert the marker is not added to any other branch.
3. Compile the trusted schema and validate an entry `{ name: "SYNTHETIC_CANARY_VARIABLE", optional: true }`; assert it passes.
4. Validate an entry with `optional: "yes"`; assert it fails with the schema's type fault, and that `resolveHarnessSettings` classifies the same input `config.value.invalid` at `harness.environment[0]`.
5. Validate an entry with an unknown key (`mystery: true`); assert it fails and classifies `config.value.invalid`.
6. Validate an entry with a literal `value`; assert the configuration path (not only the schema) returns `config.secret.forbidden` — the schema may accept a string `value`, so the classified rejection is the load-bearing assertion.

**Expected Outcome**:

- The marker is admitted as a boolean on the environment entry; unknown keys and literal values keep their delivered classified rejections; the schema never becomes permissive.

**Notes / Clarifications**:

- Step 6 is deliberately at the resolver level: `HARNESS_ENVIRONMENT_ENTRY` declares `value` as a string for historical parsing, and `resolveHarnessSettings` is the chokepoint that turns it into `config.secret.forbidden` (`packages/core/src/config/harness.ts:120-122`). Asserting only the schema would be false confidence.
- Source anchors: `packages/core/src/config/catalog.ts:276-284`; `packages/core/src/config/schema.ts:19-33`; `packages/core/src/config/harness.ts:110-134`.

#### TC-HDA-003 - Generated config artifacts regenerate and pass source/parity checks

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-9, TDR-0017 C-7
**Test Type(s)**: Contract, Configuration, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/config-default-positions.test.ts`; `scripts/checks/exports-parity.ts`; `packages/core/dist/config/`
**Tags**: @backend, @config, @checks

**Preconditions**:

- `pnpm build` has produced `packages/core/dist/config/`; the artifacts are `config.schema.json`, `defaults-positions.json`, and `schema-sources.json` (`scripts/checks/exports-parity.ts:23-24, 54-58`).
- The generation command is `bun run scripts/checks/exports-parity.ts --generate-config-artifacts` (`:117`); generation is never run as part of a test assertion.

**Steps**:

1. Run `bun test tests/checks/config-default-positions.test.ts`; assert `checkConfigArtifacts(ROOT)` returns an empty list.
2. Parse `defaults-positions.json`; assert `source === "core/src/config/defaults.ts"`, `sourceHash` is a 64-character lowercase hex string, and `sourceHash` equals a fresh sha256 of the current `packages/core/src/config/defaults.ts`.
3. Assert `positions` includes the `harness` key and its value is a positive line number; assert the position points at the `harness` initializer line in the current source.
4. Parse `schema-sources.json`; assert it hashes exactly `packages/core/src/config/schema.ts` and `packages/core/src/config/catalog.ts` and both hashes match fresh reads.
5. Parse `config.schema.json`; assert `harness.environment.items.properties.optional.type === "boolean"`.
6. Run `bun run scripts/checks/exports-parity.ts` as the gate; assert exit 0.
7. **Non-vacuity control (in-suite, not committed):** temporarily edit a scratch copy of the defaults file (or use the delivered `configArtifacts` helper over a mutated scratch root) and assert `checkConfigArtifacts` returns a drift entry naming the artifact; restore the scratch copy.

**Expected Outcome**:

- The regenerated schema, defaults-position manifest, and source hashes are the source-derived truth; a defaults or catalog edit that is not regenerated fails parity with a named artifact.

**Notes / Clarifications**:

- The source hash is the detection mechanism for an insertion with zero defaults, so step 2 must hash the whole file, not only the harness line.
- Source anchors: `scripts/checks/exports-parity.ts:23-24, 54-58, 117`; `tests/checks/config-default-positions.test.ts:16, 18-35`.

#### TC-HDA-004 - Builder and composition confinement: no ambient read, 12-site child-process allowlist, secret-read boundary

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-3, NFR-9, DEC-3, TDR-0017 C-2/C-3
**Test Type(s)**: Static, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-neutrality.test.ts`, `tests/structure/harness-imports.test.ts`; `packages/core/src/domain/harness-spawn-env.ts`; `packages/cli/src/production.ts`
**Tags**: @backend, @static, @boundary

**Preconditions**:

- The delivered ambient-read scan exists (`ambientReadViolations` in `tests/fixtures/harness/neutrality-scans.ts`).
- The delivered `node:child_process` allowlist has exactly 12 declared sites and includes `packages/adapters/src/host/index.ts` (`tests/structure/harness-imports.test.ts:26-40`).

**Steps**:

1. Assert `ambientReadViolations` over `packages/core/src/domain/harness-spawn-env.ts` is empty with a non-zero scanned-file floor.
2. Assert the builder source contains no `process.env`, `globalThis`, `Deno.env`, `Bun.env`, `setTimeout`, or `Date.now` token.
3. Assert the composition's allowlist mapping and builder binding (`packages/cli/src/production.ts:423-447`) contain no ambient read beyond the injected `environment` fact.
4. Run the delivered child-process allowlist equality test; assert the observed set equals the 12 declared sites exactly and still contains `packages/adapters/src/host/index.ts`; assert no file under `packages/adapters/src/harness/` imports `node:child_process`.
5. Run `pnpm check:boundaries`; assert the `ambient-globals` guard, the `workspace-entrypoints` check, and the `secret-read-boundary` check all pass.
6. **Negative control:** in a scratch copy, add `const leaked = process.env;` to the builder and assert the ambient-read scan names the file and token; restore. No mutant is committed.

**Expected Outcome**:

- The builder and composition read only injected data; the child environment cannot acquire an ambient source; the single host child-process site and the secret-read boundary are unchanged.

**Notes / Clarifications**:

- "Unchanged" is a semantic tree invariant plus a negative fixture, not a file hash (testing-strategy §Invariant-test authoring).
- Source anchors: `packages/core/src/domain/harness-spawn-env.ts:38-67`; `packages/cli/src/production.ts:423-447`; `tests/structure/harness-imports.test.ts:26-40`.

#### TC-HDA-005 - Empty configuration resolves the exact shipped default allowlist with `defaults` origins

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-6, AC-F1-3, AC-F6-1, DM-1, DEC-1, DEC-2, DEC-6
**Test Type(s)**: Unit, Configuration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-config.test.ts`; `tests/fixtures/harness/config/default.resolved.json`
**Tags**: @backend, @config, @defaults

**Preconditions**:

- `resolveConfig()` with no sources resolves the shipped defaults; the harness branch currently declares the three model/work-path names (`packages/core/src/config/defaults.ts:58-62`).
- The expected repaired set is the spec's proposed default: `PATH`, `HOME`, `TMPDIR` (optional), `DELIVERY_WORK_PATH` (spec Appendix B 480-490, DEC-1).

**Steps**:

1. Resolve with no configuration sources and assert `ok: true`.
2. Assert the required variable names are exactly `["PATH","HOME","DELIVERY_WORK_PATH"]` in declaration order and that each has no `optional: true` marker.
3. Assert exactly one entry is optional and its name is exactly `TMPDIR`.
4. Assert the set contains no `HARNESS_MODEL` and no `HARNESS_SMALL_MODEL`, and no Windows host-profile variable.
5. Assert `resolveHarnessSettings` projects the same set with `optional: true` only on `TMPDIR`.
6. Assert the origins for `harness`, `harness.environment`, and every declared entry path are `layer === "defaults"`.
7. Update and assert the pinned fixture `tests/fixtures/harness/config/default.resolved.json` equals the resolved branch exactly (canonical JSON equality), so a default change is a deliberate fixture edit.
8. Assert `harness.kind === "opencode"` and `harness.execution.kind === "host"` are unchanged.

**Expected Outcome**:

- A zero-configuration installation resolves a default that can start the default POSIX harness: `PATH`, `HOME`, and injected `DELIVERY_WORK_PATH` required, `TMPDIR` optional, no model variable, all from the defaults layer.

**Notes / Clarifications**:

- Order is asserted for `PATH`, `HOME`, `DELIVERY_WORK_PATH` because the shipped literal is ordered; if the implementation chooses a different defensible order, set equality plus the exact required/optional partition is the binding claim. The plan prefers order so a review diff is legible.
- Source anchors (current, pre-change): `packages/core/src/config/defaults.ts:58-62`; spec F-1 141, AC-F1-3 379, Appendix B 480-490.

#### TC-HDA-006 - Release invariant: exactly one five-package minor changeset with a non-empty body (`TC-RELEASE-001`)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4, NFR-9, DEC-5, spec §18, `TC-RELEASE-001`
**Test Type(s)**: Checks, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-release.test.ts`; `.changeset/`
**Tags**: @checks, @release

**Preconditions**:

- The branch is based on `origin/main-tools`; run `git fetch origin main-tools` so the comparison base exists.
- The change touches `packages/**`, so the changeset obligation binds (spec DEC-5).

**Steps**:

1. Run `bun test tests/checks/privacy-release.test.ts`; assert the `TC-RELEASE-001` describe passes.
2. Assert `git diff --name-status origin/main-tools...HEAD -- .changeset/` reports exactly one added (`A`) path and no modified (`M`) or deleted (`D`) path; include untracked `.changeset/*.md` in the added set as the delivered test does.
3. Read the added changeset and assert its frontmatter lists exactly the five fixed-group packages `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`, each at `minor`.
4. Assert the changeset does not list `@delivery-os/testkit`, and that its body after the frontmatter is non-empty and describes the change.
5. Assert no pre-existing changeset is byte-modified or deleted relative to the merge base.
6. **Mutation control:** in an in-memory string, change one package to `patch`, add `@delivery-os/testkit: minor`, remove one of the five, and empty the body; assert `validateChangeset` reports a failure for each. These controls already run inside the delivered test; the plan records them so a future edit cannot delete them silently.

**Expected Outcome**:

- Exactly one added changeset satisfies the five-package lockstep `minor` rule with a non-empty body; every pre-existing changeset is untouched; the release gate is green.

**Notes / Clarifications**:

- The invariant is a branch-diff gate, which the testing strategy assigns to review/CI PR-time checks rather than to a permanent tree invariant; `TC-HDA-006` executes the delivered gate and records the result, it does not duplicate it as a tree assertion.
- Source anchors: `tests/checks/privacy-release.test.ts:42-49, 70-86, 133-175`; precedent `.changeset/gh-273-queue-repository-binding-minor.md`.

#### TC-HDA-010 - Zero-configuration default spawn over a synthetic `opencode` on a controlled `PATH` writes an attempt and classifies

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-7, AC-F1-1, AC-F7-1, NFR-1, DEC-1
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-harness-default-spawn.test.ts`; `tests/fixtures/harness/default-spawn.ts`
**Tags**: @backend, @integration, @spawn

**Preconditions**:

- A `mkdtemp` bin directory contains an executable synthetic `opencode` script. The script writes its received environment to a file and prints the pinned two-line JSONL (`step_start` with a top-level `sessionID`, `step_finish` with `part.reason === "stop"`) before exiting 0. It uses only a shell builtin/absolute interpreter and never contacts a model.
- The controlled parent environment contains at least `PATH: TEMP_BIN:RUNTIME_PATH` and `HOME: SYNTHETIC_HOME`, plus the named canaries from §6.1 (`SYNTHETIC_UNDECLARED_TOKEN`, `OC_ADOS_MAIN_MODEL`, `OC_ADOS_SMALL_MODEL`, and a decoy name shaped like `HARNESS_MODEL` but not equal to it) that TC-HDA-012 reads; `TMPDIR`, `HARNESS_MODEL`, and `HARNESS_SMALL_MODEL` are absent. The canaries are undeclared, so the exact child-key-set assertion in step 5 is unaffected.
- The temp state root declares `GH-277` in its queue (`queue add`) or the composition injects the lease-claim port. Without the queue entry the production dispatch returns `queue.entry.unobserved` and appends no attempt record before reaching the spawn path.
- A temp state root and the existing dispatch fixture's injected truth reads, clock, and ids are used; the production composer (or the dispatch engine with the production opencode adapter over the host starter) is composed with these facts.

**Steps**:

1. Run `dispatch GH-277 --json` through `runCli` with the production composition over the controlled environment and the synthetic state root.
2. Assert the command returns a numeric exit and one envelope.
3. Assert `data.result` is a member of the delivered delivery-result token set and is not `dispatch.session.spawn-failed`; assert `data.outcome` is a delivered `HarnessOutcome`.
4. Read the attempt ledger and assert exactly one attempt record for `GH-277`; assert its `token` and `outcome` match the envelope and it has a non-empty `attemptId`.
5. Read the fake CLI's environment dump and assert its key set is exactly `PATH`, `HOME`, `DELIVERY_WORK_PATH` (and `TMPDIR` only if present); assert `DELIVERY_WORK_PATH` equals the descriptor's work directory; assert neither model variable nor any `OC_ADOS_*` appears.
6. Assert the fake CLI was invoked by the bare name `opencode` with the delivered spawn args (recorded by the fake's argv file), not by an absolute path.
7. **Non-vacuity control:** rerun with the old default descriptor (`HARNESS_MODEL`, `HARNESS_SMALL_MODEL`, `DELIVERY_WORK_PATH`) over the same parent and assert environment construction fails with `harness.spawn.variable-missing` and no child marker is written; this proves the test detects the original defect.

**Expected Outcome**:

- The repaired default starts the configured harness with zero user configuration, an attempt record is written, and the result token is not `dispatch.session.spawn-failed`.

**Notes / Clarifications**:

- This is the AC-F1-1/AC-F7-1 proof. The synthetic CLI is not the real harness: PATH resolution, environment construction, attempt recording, and classification are real; model work is not.
- Source anchors: `packages/core/src/config/defaults.ts:58-62` (before), `packages/cli/src/production.ts:423-447, 462-465`, `packages/core/src/app/dispatch.ts:347-400`.

#### TC-HDA-011 - Bare command `opencode` resolves through the declared `PATH`; off-PATH control fails

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, DEC-1
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-default-path.test.ts`; `tests/fixtures/harness/default-spawn.ts`
**Tags**: @backend, @integration, @spawn, @path

**Preconditions**:

- The synthetic `opencode` script is executable and writes a marker file when it runs.
- The opencode adapter is composed over the real host starter and a descriptor whose `PATH` variable value is the controlled temp bin directory (plus the runtime path needed by the interpreter, if any).

**Steps**:

1. Compose the opencode adapter over the real host starter with `command: "opencode"` and `spawnArgs: ["run", "--format", "json"]` (`packages/adapters/src/harness/opencode.ts:63-88`, `packages/cli/src/production.ts:462-465`); the descriptor declares `PATH` with the controlled temp bin directory (plus the runtime path the interpreter needs, if any).
2. Call `spawn({ workItemRef, prompt, descriptor })` on the composed `HarnessSessionPort`. The delivered port takes `HarnessSpawnInput` and has no `command` parameter; the command is fixed when the adapter is composed (`packages/core/src/contracts/harness.ts:259-264, 411-412`).
3. Assert the spawn resolves `ok: true`, the handle's `harnessKind` is `opencode`, and the marker file exists.
4. Read the injected spawn runner/starter record: assert `file` is exactly the bare string `opencode` and `args` equal `["run","--format","json"]`; assert no absolute path appears in either (`packages/core/src/contracts/harness.ts:326-336, 373-377`).
5. Assert the fake script observed its own name as `opencode` (argv[0] basename) and that the child's `PATH` equals the declared value.
6. **Negative control:** rebuild with the temp bin directory removed from the declared `PATH` and assert the spawn fails pre-session (the delivered refusal identity, not a success) and no marker is written.
7. Assert the negative control records zero attempt successes and no fabricated handle.

**Expected Outcome**:

- The bare name is resolved through the child's declared `PATH` from the adapter's composed `command`; removing the path makes the same bare name fail, so the positive result is load-bearing.

**Notes / Clarifications**:

- Do not use `command -v` on the test host as the oracle; the oracle is that the child actually executed and wrote its marker.
- The delivered port shape matters: `HarnessSessionPort.spawn` accepts only `HarnessSpawnInput`, and `command`/`spawnArgs` belong to `OpencodeHarnessOptions`; the assertion must read the runner's `(file, args)` record, not an invented spawn argument.
- Source anchors: `packages/cli/src/production.ts:458-465` (bare `opencode`), `packages/adapters/src/harness/opencode.ts:63-88, 281-300`, `packages/core/src/contracts/harness.ts:259-264, 326-336, 373-377, 411-412`, `packages/core/src/domain/harness-spawn-env.ts:46-58` (environment construction).

#### TC-HDA-012 - Deny-by-default: undeclared canary absent from the real child; `OC_ADOS_*` neither forwarded nor mapped; no `HARNESS_*` synthesized

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, F-7, AC-F1-4, AC-F2-2, AC-F4-1, AC-F7-3, NFR-3, DEC-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-spawn-env.test.ts`; `tests/behaviour/dispatch-harness-default-spawn.test.ts`; `tests/fixtures/harness/spawn-env.ts`
**Tags**: @backend, @security, @spawn, @canary

**Preconditions**:

- The parent environment includes an undeclared canary `SYNTHETIC_UNDECLARED_TOKEN` with a unique value, `OC_ADOS_MAIN_MODEL` and `OC_ADOS_SMALL_MODEL` with unique values, and a decoy `HARNESS_MODEL`-shaped name that is not declared.
- The default descriptor is the repaired shipped default.

**Steps**:

1. Build the child environment from the repaired default and the canary-bearing parent; assert `ok: true`.
2. Assert the child key set equals the declared and present set exactly; assert the canary key is absent.
3. Assert no `OC_ADOS_MAIN_MODEL` or `OC_ADOS_SMALL_MODEL` key is present and no `HARNESS_MODEL`/`HARNESS_SMALL_MODEL` key is synthesized.
4. Serialize the built environment with `canonicalHarnessJson` and `JSON.stringify`; assert none of the canary values appear.
5. In the real-child suite (TC-HDA-010), read the fake CLI's environment dump; assert the same absence in the actual child, not only in the pure builder result.
6. Assert determinism: build twice and assert canonical JSON equality.

**Expected Outcome**:

- The child receives exactly the declared and present entries plus resolved credentials; undeclared ambient variables and the `OC_ADOS_*` names are absent from both the pure result and the real child.

**Notes / Clarifications**:

- The existing fixture already models a `HOME` canary and undeclared tokens (`tests/fixtures/harness/spawn-env.ts:22-49`); the repaired default now declares `HOME`, so the fixture's undeclared set must be adjusted to keep a genuine undeclared canary. Never delete the canary to make the test pass.
- Source anchors: `tests/fixtures/harness/spawn-env.ts:22-63`; `packages/core/src/domain/harness-spawn-env.ts:44-66`.

#### TC-HDA-013 - Zero configuration with both model variables unset causes no required-variable failure

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-1, DEC-1, DEC-2
**Test Type(s)**: Unit, Configuration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-spawn-env.test.ts`
**Tags**: @backend, @config, @spawn

**Preconditions**:

- The parent environment has `PATH` and `HOME` and does not have `HARNESS_MODEL` or `HARNESS_SMALL_MODEL`.
- The repaired default descriptor is used.

**Steps**:

1. Resolve the shipped defaults and assert the resolved allowlist contains no model variable.
2. Build the child environment from the default descriptor and the model-free parent; assert `ok: true`.
3. Assert no `harness.spawn.variable-missing` failure is produced and the returned environment contains `PATH` and `HOME`.
4. **Before/after control:** build with the pre-change descriptor literal from the spec Appendix A; assert it fails with `harness.spawn.variable-missing` and `field === "HARNESS_MODEL"`. This proves the repaired default, not the test harness, removed the failure.

**Expected Outcome**:

- A zero-configuration spawn composes without any required-model-variable failure.

**Notes / Clarifications**:

- The pre-change descriptor is a test-only literal taken from the spec Appendix A, not a second product default.
- Source anchors: `packages/core/src/config/defaults.ts:58-62`; spec Appendix A 466-476, F-2 142.

#### TC-HDA-014 - Absent required variable fails closed naming `field`, spawns no child, returns no partial environment

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-1, NFR-2, DEC-3
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-spawn-env.test.ts`; `tests/behaviour/harness-spawn-credential.test.ts`
**Tags**: @backend, @spawn, @negative

**Preconditions**:

- A descriptor declares `PATH`, `HOME`, and `DELIVERY_WORK_PATH` required (no marker), and the parent or record omits one of them.
- A recording starter/runner counts invocations.

**Steps**:

1. Build with `HOME` absent from both parent and record; assert `ok: false`, `error.code === "harness.spawn.variable-missing"`, and `error.field === "HOME"`.
2. Assert the failure summary names `HOME` and the result carries no environment value (no partial map).
3. Assert the failure contains no credential reference, no parent value, and no canary.
4. At the adapter level, call `spawn` with the same descriptor; assert the starter was invoked zero times and no handle was produced.
5. Repeat for `PATH` and `DELIVERY_WORK_PATH`; assert each names its own field and no child starts.
6. Assert the code is one of the delivered nine (`HARNESS_FAILURE_CODES`), so no new identity was introduced.

**Expected Outcome**:

- Every absent required entry is a loud, named, pre-spawn failure with no partial environment and no child process.

**Notes / Clarifications**:

- "No child spawn" is proven by the recording starter/runner; asserting only `ok: false` would let an implementation build the child and then discard it.
- Source anchors: `packages/core/src/domain/harness-spawn-env.ts:46-58`; `packages/core/src/contracts/harness.ts:286-296, 306-314`.

#### TC-HDA-015 - Absent optional variable is omitted and the build succeeds

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, AC-F7-5, DEC-3
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-spawn-env.test.ts`
**Tags**: @backend, @spawn, @optional

**Preconditions**:

- A descriptor declares `TMPDIR` with `optional: true` and the parent/record omit it.
- A second descriptor uses the repaired shipped default.

**Steps**:

1. Build with the optional descriptor and no `TMPDIR` in parent or record; assert `ok: true`.
2. Assert `Object.hasOwn(child, "TMPDIR")` is `false` and every required entry is present.
3. Assert the build did not substitute an empty string, `"undefined"`, or a synthetic path for the absent optional key.
4. Repeat with the repaired shipped default and a parent that lacks `TMPDIR`; assert `ok: true` and `TMPDIR` absent.
5. **Non-vacuity control:** change only the descriptor marker to `optional: false` (or remove it) and assert the same input fails with `harness.spawn.variable-missing` and `field === "TMPDIR"`.

**Expected Outcome**:

- An absent optional entry is omitted and does not abort the spawn; the same entry without the marker still fails closed.

**Notes / Clarifications**:

- The pair TC-HDA-015/TC-HDA-016 is the required/optional × absent/present table for the one shipped optional entry.
- The delivered non-vacuity meta-check `tests/checks/harness-mutants.test.ts:76-84, 102-111` mutates `packages/core/src/domain/harness-spawn-env.ts` by exact string replacement; the optional branch must preserve those anchors or the mutant becomes a no-op and the suite fails with "mutant … passed". It runs unchanged in §6.4.
- Source anchors: `packages/core/src/domain/harness-spawn-env.ts:46-58`; spec F-3 143, AC-F3-2 385, AC-F7-5 403.

#### TC-HDA-016 - Present optional variable is forwarded with its value

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, AC-F7-5, DEC-3
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-spawn-env.test.ts`
**Tags**: @backend, @spawn, @optional

**Preconditions**:

- A descriptor declares `TMPDIR` optional; the parent supplies `TMPDIR=/synthetic/tmp`.
- A record may also supply a distinct value for the precedence cross-check.

**Steps**:

1. Build with the optional descriptor and the present parent value; assert `ok: true` and `child.TMPDIR === "/synthetic/tmp"`.
2. Assert `TMPDIR` appears exactly once and no other key is added or removed by the optional branch.
3. Supply a record value `/synthetic/record-tmp` and assert the record value wins over the parent value (cross-check to TC-HDA-017).
4. Repeat with the repaired shipped default and a present `TMPDIR`; assert the value is forwarded unchanged.
5. Assert the optional marker does not change the key name (no renaming, no prefixing).

**Expected Outcome**:

- A present optional entry is forwarded with its value, and the record still wins.

**Notes / Clarifications**:

- Source anchors: `packages/core/src/domain/harness-spawn-env.ts:48`; spec F-3 143, AC-F3-3 386.

#### TC-HDA-017 - Record value wins over the parent; an undeclared record name is inert

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-2, DEC-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-spawn-env.test.ts`
**Tags**: @backend, @spawn, @precedence

**Preconditions**:

- A descriptor declares `PATH` and `DELIVERY_WORK_PATH`; the parent supplies different values from the record.
- A record contains one declared name and one undeclared name.

**Steps**:

1. Build with the record supplying `DELIVERY_WORK_PATH` and `PATH`; assert both child values equal the record values, not the parent values.
2. Assert the precedence expression is observed on a declared variable entry only, and that a credential entry is never overridden by a record value.
3. Add an undeclared record name (`SYNTHETIC_RECORD_EXTRA`) and assert it is absent from the child and changes no other key.
4. Assert the build result is deterministic across two calls with the same inputs.
5. **Negative control:** in a scratch copy, invert the precedence to `parent ?? record` and assert the record-value assertion fails; restore.

**Expected Outcome**:

- Validated record data takes precedence for declared variables; an undeclared record name cannot enter the child or alter the result.

**Notes / Clarifications**:

- The delivered expression is `input.record?.[entry.name] ?? input.parentEnvironment[entry.name]` (`packages/core/src/domain/harness-spawn-env.ts:48`).
- Source anchors: `packages/core/src/domain/harness-spawn-env.ts:42-48`; spec F-4 144, AC-F4-2 390.

#### TC-HDA-018 - Unresolved credential fails closed and no optional marker bypasses it

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-4, NG-5, DEC-3, TDR-0017 C-5
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-spawn-credential.test.ts`
**Tags**: @backend, @security, @credential, @negative

**Preconditions**:

- A descriptor declares a credential entry `{ kind: "credential", name: "HARNESS_AUTH", reference }` whose fake credential port is set to fail.
- The credential entry has no optional marker (the type forbids it; TC-HDA-001).

**Steps**:

1. Build with the failing credential port; assert `ok: false`, `error.code === "config.credential.missing"`, and `error.field === "HARNESS_AUTH"`.
2. Assert the failure carries the reference name and no credential material, source-key value, or parent canary.
3. Assert no partial environment is returned and no declared variable value appears in the error.
4. Assert the credential port was consulted exactly once and the failure happened before any child spawn.
5. **Bypass control:** construct a configuration entry combining `optional: true` with `credentialRef` and assert `resolveHarnessSettings` returns `config.value.invalid` (cross-check to TC-HDA-021); assert the marker cannot construct a credential entry at all in the type suite.
6. Assert a successful resolution still enters only the declared credential name and no optional path is consulted.

**Expected Outcome**:

- Credentials remain strictly required and fail closed on an unresolved reference; optionality cannot reach or bypass a credential.

**Notes / Clarifications**:

- Source anchors: `packages/core/src/domain/harness-spawn-env.ts:60-64`; `packages/core/src/contracts/harness.ts:127-131`; TDR-0017 C-5.

#### TC-HDA-019 - Explicit `HARNESS_MODEL` declaration preserves required-entry semantics

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, F-3, F-6, AC-F2-3, DEC-2
**Test Type(s)**: Configuration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-config.test.ts`; `tests/behaviour/harness-spawn-env.test.ts`
**Tags**: @backend, @config, @compatibility

**Preconditions**:

- A user configuration declares `{ name: "HARNESS_MODEL" }` as a required entry; the shipped default does not declare it.
- The parent has `OC_ADOS_MAIN_MODEL` set but not `HARNESS_MODEL`.

**Steps**:

1. Resolve the user configuration and assert the setting is `{ name: "HARNESS_MODEL" }` with no optional marker.
2. Build with the parent lacking `HARNESS_MODEL`; assert `ok: false`, `code === "harness.spawn.variable-missing"`, `field === "HARNESS_MODEL"`.
3. Assert the ambient `OC_ADOS_MAIN_MODEL` is not used as a fallback and the failure is not silently repaired from it.
4. Supply `HARNESS_MODEL` in the parent; assert it is forwarded and the build succeeds.
5. Assert the default descriptor still declares no `HARNESS_MODEL`, so the user-specific behaviour is not reintroduced globally.
6. Assert no deprecation warning or migration is emitted for the explicit declaration.

**Expected Outcome**:

- An explicit user declaration keeps the delivered required-entry semantics; the default simply stops declaring it, and no implicit mapping appears.

**Notes / Clarifications**:

- This is the Flow 5 compatibility case (spec §6) and the AC-F2-3 negative.
- Source anchors: `packages/core/src/config/harness.ts:23-25, 130-133`; spec F-2 142, AC-F2-3 383.

#### TC-HDA-020 - Existing `{ name: "X" }` configuration keeps required semantics with no migration

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-3, AC-F6-2, NFR-8, DEC-3, TDR-0017 C-7
**Test Type(s)**: Configuration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-config.test.ts`; `tests/behaviour/harness-spawn-env.test.ts`
**Tags**: @backend, @config, @compatibility

**Preconditions**:

- A valid configuration file declares `harness.environment: [{ name: "SYNTHETIC_CANARY_VARIABLE" }]`.
- The schema and `resolveHarnessSettings` are both exercised.

**Steps**:

1. Resolve the configuration through `resolveConfig`; assert `ok: true` with no migration warning and no strict failure.
2. Assert the projected setting is `{ name: "SYNTHETIC_CANARY_VARIABLE" }` with `optional` absent (not `false` unless the implementation explicitly chooses to materialize it; either is required semantics, but the absence is the additive default).
3. Build with the parent lacking the variable; assert `harness.spawn.variable-missing` and `field === "SYNTHETIC_CANARY_VARIABLE"`.
4. Build with the parent supplying it; assert the value is forwarded.
5. Assert the configuration required no edit: the same YAML text that was valid before is valid after.
6. Assert no second optionality mechanism (a separate list or a new `kind`) is required to express this entry.

**Expected Outcome**:

- An existing `{ name }` entry keeps fail-closed semantics with no migration; the marker is opt-in only.

**Notes / Clarifications**:

- TDR-0017 driver 3 and C-7: `false` and absence both mean required; the plan accepts either representation as long as behaviour is required.
- Source anchors: `packages/core/src/config/harness.ts:23-25, 130-133`; `packages/core/src/domain/harness-spawn-env.ts:46-58`; TDR-0017 C-7.

#### TC-HDA-021 - Optional-marker validation: non-boolean, marker+`credentialRef`, unknown key, literal value

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, AC-F3-5, DM-1, NFR-4, TDR-0017 C-5/C-6
**Test Type(s)**: Configuration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-config.test.ts`; `tests/fixtures/harness/config/`
**Tags**: @backend, @config, @negative

**Preconditions**:

- Both paths are exercised: the trusted schema through `resolveConfig` with a YAML fact, and the pure `resolveHarnessSettings` over a values record.
- The delivered error identities are `config.value.invalid` and `config.secret.forbidden` (`packages/core/src/config/harness.ts:110-134`).

**Steps**:

1. `optional: "yes"` (string) → assert `config.value.invalid` at `harness.environment[0]` from both paths.
2. `optional: 1` (number) → assert `config.value.invalid`.
3. `{ name: "X", optional: true, credentialRef: "ref" }` → assert `config.value.invalid`; assert the marker did not silently win or get dropped.
4. `{ name: "X", value: "synthetic-literal-value" }` → assert `config.secret.forbidden`, not `config.value.invalid`.
5. `{ name: "X", mystery: true }` → assert `config.value.invalid`.
6. `{ name: "X", optional: true }` → assert `ok: true` and the projected setting carries the marker.
7. `{ name: "X", credentialRef: "ref" }` → assert `ok: true` and the credential setting carries no optional marker.
8. Assert every failure names the configuration path and none emits the rejected value or a secret.

**Expected Outcome**:

- Only a boolean marker on a non-credential entry is accepted; every invalid shape keeps its delivered classification; literal values remain secret-forbidden.

**Notes / Clarifications**:

- Step 4's distinction matters: a literal value is a security-sensitive rejection, not a generic invalid value.
- Source anchors: `packages/core/src/config/harness.ts:110-134`; `packages/core/src/config/catalog.ts:276-284`; spec AC-F3-5 388.

#### TC-HDA-022 - `config get harness.environment --show-origin` renders the new defaults and the optional marker with no secret value

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-3, DM-1
**Test Type(s)**: Integration, Configuration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-cli.test.ts`; `packages/cli/src/commands/config.ts`
**Tags**: @backend, @cli, @config

**Preconditions**:

- The delivered inspection surface is `config get <key> [--show-origin]`; `--show-origin` is accepted only with `get` and returns `{ key, value, origin }` (`packages/cli/src/commands/config.ts:96-99, 102-155`, return at 148-152). `origin` is the `originLabel` string, so a defaults origin renders as `layer=defaults file=... line=...` (`packages/core/src/config/provenance.ts:20-24`).
- `runCli` is invoked through the delivered config command fixture (`tests/behaviour/config-cli.test.ts`) with the injected resolver; no user configuration declares `harness.environment`, so the shipped defaults are in effect.
- The output passes through the delivered redaction chokepoint; no secret is registered.

**Steps**:

1. Invoke `config get harness.environment --show-origin --json`; assert one envelope whose `data.key === "harness.environment"`, `data.value` is the four-entry array, and `data.origin` matches `/^layer=defaults\b/`.
2. Assert `data.value` contains exactly four entries: required `PATH`, `HOME`, and `DELIVERY_WORK_PATH` without the `optional` marker, and `TMPDIR` with `optional: true` (the same required/optional partition TC-HDA-005 asserts).
3. Invoke `config debug --json`; assert `data.origins["harness.environment"]` and the origins for every declared entry path begin with `layer=defaults`.
4. Assert the serialized get/debug payloads contain no literal environment value, credential material, or source-key value; assert the redaction chokepoint received an empty/synthetic secret set and emitted nothing secret.
5. Assert the surface rejects the invalid pairing: `config harness.environment --show-origin` without `get` classifies `input.value.rejected` (the delivered validation message names `get`).
6. Write a project configuration that declares an explicit `{ name: "X", optional: true }` entry and assert the rendered value carries the marker verbatim; assert a `{ name: "Y" }` entry renders without it.
7. Assert the inspection surface does not invent a model entry.

**Expected Outcome**:

- `config get harness.environment --show-origin` lists the four shipped default entries with the `optional` marker on `TMPDIR`, reports a `defaults` origin, and emits no secret value; the inspection surface is truthful and read-only.

**Notes / Clarifications**:

- AC-F6-3 names this invocation, so the plan no longer accepts an implementation-defined inspection spelling (OQ-T4 closed). The marker arrives as configuration data inside `value`; the origin arrives as the `originLabel` string, not the raw origin object.
- Source anchors: `packages/cli/src/commands/config.ts:96-99, 102-155`; `packages/core/src/config/provenance.ts:20-24`; `packages/core/src/config/resolver.ts:343-368`; spec AC-F6-3 398, §8.3 243.

#### TC-HDA-023 - Production composition maps the marker and injects `DELIVERY_WORK_PATH` through the record

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-1, AC-F6-2, DM-2, DEC-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-composition.test.ts`
**Tags**: @backend, @composition, @config

**Preconditions**:

- The production composer accepts injected `environment` facts and an injected harness session port/runner (`packages/cli/src/production.ts:184-230`).
- The recorded spawn input is captured by the injected port (`spawnInputs`).

**Steps**:

1. Compose the production stack with an injected environment `{ PATH, HOME }` (no `TMPDIR`) and an injected recording harness port; dispatch one ref.
2. Inspect the recorded `spawnInput.descriptor.environment`; assert `PATH`, `HOME`, and `DELIVERY_WORK_PATH` are variable entries without the marker and `TMPDIR` is a variable entry with `optional: true`.
3. Assert no `HARNESS_MODEL`/`HARNESS_SMALL_MODEL` entry and no credential entry is synthesized.
4. Assert the builder receives `record: { DELIVERY_WORK_PATH: descriptor.workDirectory }` and the child value equals the work directory (the composition call site is `packages/cli/src/production.ts:441-447`).
5. Assert the opencode branch is composed with the bare command `"opencode"` and the delivered args (`packages/cli/src/production.ts:462-465`).
6. Assert a user configuration with an explicit optional entry is projected with the marker verbatim, and a `{ name }` entry is projected without it.

**Expected Outcome**:

- The composition carries the marker from configuration to the descriptor and keeps the `DELIVERY_WORK_PATH` record injection and the bare command; no second mapping is introduced.

**Notes / Clarifications**:

- This is the DM-2 bridge: a marker that round-trips through the contract but is dropped by the composition would pass TC-HDA-001 yet fail here.
- Source anchors: `packages/cli/src/production.ts:423-447, 462-465`; `packages/core/src/contracts/harness.ts:144-148`.

#### TC-HDA-029 - `DispatchEnvelopeError`: additive optional `detail` on the dispatch error; `CommandResultError` and every other envelope unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, AC-F5-1, DM-3, NFR-8, DEC-4
**Test Type(s)**: Contract, Type, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-envelope-detail.test.ts`; `tests/types/dispatch-envelope-detail.type-test.ts`; `packages/core/src/contracts/dispatch.ts`; `packages/core/src/contracts/result.ts`
**Tags**: @backend, @contract, @dispatch

**Preconditions**:

- The delivered envelope `data.error` is `CommandResultError` (`packages/core/src/contracts/dispatch.ts:277-296`, error at 288).
- The delivered `CommandResultError` fields are `code`, `category`, `retryable`, `consequence`, `remediationHint`, and optional `summary` (`packages/core/src/contracts/result.ts:36-43`); it must stay exactly these six.
- Spec v1.2 DM-3 and Appendix C declare `DispatchEnvelopeError` in `packages/core/src/contracts/dispatch.ts` as `CommandResultError` plus `detail?: { readonly kind: "harness" | "config"; readonly code: string; readonly field?: string }`, and retype `DispatchEnvelopeData.error` from `CommandResultError` to `DispatchEnvelopeError`.
- Every envelope's top-level error is assembled from the error table in `packages/cli/src/index.ts:262-272`; widening `CommandResultError` would widen all of them.

**Steps**:

1. In the type suite, import `DispatchEnvelopeError` (and `DispatchEnvelopeData`) from `@delivery-os/core/contracts`; construct an error with `detail: { kind: "harness", code: "harness.spawn.variable-missing", field: "HARNESS_MODEL" }`; assert it is assignable both to `DispatchEnvelopeError` and to `DispatchEnvelopeData["error"]`.
2. Assert the detail is optional in the type and narrow: an error without `detail` is still assignable (this covers non-spawn dispatch error rows); the always-present runtime rule on the pre-session path is asserted behaviourally by TC-HDA-030, not here; `detail.field` may be omitted; `kind` accepts only `"harness"` and `"config"` (a `kind: "network"` literal is rejected with `@ts-expect-error`); `code` is a string.
3. Assert `CommandResultError` is **not** widened: a type-key assertion proves its keys are exactly `code`, `category`, `retryable`, `consequence`, `remediationHint`, `summary`; a value carrying `detail` is rejected with `@ts-expect-error`; a runtime key-set check on a representative error produced by a failing CLI command equals the six delivered keys.
4. Assert every other envelope keeps its six-field error: build a non-dispatch failure envelope through `runCli` (e.g. an unknown config key) and assert its `error` runtime key set is a subset of the six `CommandResultError` keys and contains no `detail`, no `field`, and no dispatch-only member.
5. Assert the dispatch envelope is the only widened envelope surface: `DispatchEnvelopeData.error` names `DispatchEnvelopeError` in the delivered source, and `packages/core/src/contracts/result.ts` declares no `detail` member. The separate additive published-type change is DM-4 (`HumanTextContext` on `CommandDefinition.humanText`), declared by spec §8.3/§8.5 and asserted by TC-HDA-032; it is not an envelope widening and does not touch `CommandResultError`.
6. Assert a successful dispatch envelope has no `error` and therefore no `detail`.
7. Assert the top-level `CommandResult` success/failure envelope shape is unchanged: success carries `data`, failure carries `error`, both keep `schemaVersion`, `runId`, `exitCode`, `timing`.
8. Assert the new type is exported through the same `@delivery-os/core/contracts` entrypoint as `CommandResultError` (the exports-parity gate stays green).

**Expected Outcome**:

- The detail is additive on a dispatch-specific `DispatchEnvelopeError` only (the envelope surface); `CommandResultError` stays at six fields and every other envelope, plus the top-level result envelope, is unchanged in shape. The separately declared DM-4 human-text context is additive on `CommandDefinition.humanText` and is proven by TC-HDA-032.

**Notes / Clarifications**:

- The exact nesting (`data.error.detail.kind`, `.code`, `.field`) is fixed by spec DM-3 and Appendix C; tests must read the delivered contract once it exists (GAP-T2). Step 3 is the anti-widening assertion the spec calls out: a shared-type edit would silently widen every envelope.
- Source anchors: `packages/core/src/contracts/dispatch.ts:277-296`; `packages/core/src/contracts/result.ts:36-43`; `packages/cli/src/index.ts:262-272`; spec DM-3 239, §8.5 261-271, Appendix C 516-540.

#### TC-HDA-030 - Pre-session failure always carries underlying `kind`/`code` on `data.error.detail` (with `field` only when carried) while identity stays `dispatch.session.spawn-failed`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-3, NFR-5, DEC-4
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-harness-default-detail.test.ts`; `tests/fixtures/dispatch/harness.ts`
**Tags**: @backend, @dispatch, @diagnostics

**Preconditions**:

- The scripted harness fixture is extended with a `spawnFailure: HarnessFailure` option so a test can supply `{ kind: "harness", code: "harness.spawn.variable-missing", field: "HARNESS_MODEL", summary: "..." }`. The existing `spawnFails: true` path returns `harness.spawn.refused` with no field and is retained for the unchanged-identity cases.
- The detail shape is `DispatchEnvelopeError["detail"]`: `kind` is `"harness" | "config"`, `code` is a string, `field` is an optional string (spec DM-3, Appendix C).
- A temp state root and the delivered dispatch fixture are used.

**Steps**:

1. Create a dispatch scenario whose spawn fails pre-session with the supplied `spawnFailure`.
2. Invoke `dispatch GH-277 --json`; assert the command returns exit 1 and one envelope.
3. Assert `data.error.code === "dispatch.session.spawn-failed"` (identity unchanged).
4. Assert `data.error.detail` exists and is assignable to `DispatchEnvelopeError["detail"]`; assert it carries `kind: "harness"`, `code: "harness.spawn.variable-missing"`, and `field: "HARNESS_MODEL"`; assert no other member appears beyond the delivered detail type and no environment value, credential material, prompt, or stream content appears.
5. Assert `data.result === "failed"`, `data.outcome === "failed"`, and `data.error.category === "user"`, `retryable === false`, `consequence === "not_landed"` (unchanged projection).
6. Read the attempt ledger; assert exactly one record with `token === "failed"`, `outcome === "failed"`, and `evidenceRefs` containing `harness:spawn-failed`.
7. Repeat with a spawn failure that carries a `kind: "config"` code (`config.credential.missing`) and a field; assert the detail carries the config kind and code and the identity is still `dispatch.session.spawn-failed`.
8. Repeat with the delivered generic refusal, which carries `kind: "harness"` and `code: "harness.spawn.refused"` but no `field` ([tests/fixtures/dispatch/harness.ts:158-162](../../../../tests/fixtures/dispatch/harness.ts)). Assert `data.error.detail` is present with `kind: "harness"` and `code: "harness.spawn.refused"`, and assert `field` is omitted (`Object.hasOwn(detail, "field") === false`) rather than `null` or an empty string.
9. Assert the golden byte-equality consumer passes with the repaired envelope: run `bun test tests/golden/dispatch-errors.test.ts` and assert its spawn-failure case ([tests/golden/dispatch-errors.test.ts:49-57](../../../../tests/golden/dispatch-errors.test.ts)) compares the emitted envelope byte-for-byte with [tests/fixtures/dispatch/golden/errors/spawn-failed.json](../../../../tests/fixtures/dispatch/golden/errors/spawn-failed.json), where the golden now carries the same `{ kind: "harness", code: "harness.spawn.refused" }` detail with no `field`. This is the regression that pins the always-present attachment rule.
10. Assert there is no pre-session variant that omits `detail`: the delivered pre-session branch always has an underlying `HarnessFailure`, so every case above must produce a detail (the only optionality is the `field` member and the type-level optionality that covers non-spawn dispatch error rows).

**Expected Outcome**:

- A pre-session failure keeps the delivered identity and always carries the real underlying `kind` and `code` additively; `field` appears only when the failure carries one, and no detail is fabricated beyond the underlying failure. The golden envelope pins the same shape for `harness.spawn.refused`.

**Notes / Clarifications**:

- The fixture extension is a test-support edit; it does not change product behaviour and is listed in §7.1. The attached object is the `DispatchEnvelopeError.detail` member, not a new envelope field.
- The attachment rule is spec v1.2 F-5/Appendix C: every pre-session failure carries a `HarnessFailure`, `kind` and `code` are required, and `field` is optional. There is no reachable detail-less pre-session case; the type keeps `detail` optional only because other dispatch error rows (which are not pre-session spawn failures) do not carry it.
- Source anchors: `packages/core/src/app/dispatch.ts:466-485`; `packages/core/src/contracts/harness.ts:306-314`; `tests/fixtures/dispatch/harness.ts:158-162`; `tests/golden/dispatch-errors.test.ts:49-57`; spec AC-F5-1 393, DM-3 239, Appendix C 516-540.

#### TC-HDA-031 - `--json` machine output carries the detail and survives redaction

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-7, AC-F5-2, AC-F7-4, NFR-5, DEC-4
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-harness-default-detail.test.ts`
**Tags**: @backend, @dispatch, @json, @redaction

**Preconditions**:

- The dispatch scenario fails with a `harness.spawn.variable-missing` detail naming `HARNESS_MODEL`.
- `runCli` is invoked with `--json` and a `deps.secrets` list containing a registered synthetic secret value; the detail contains identifiers only.

**Steps**:

1. Invoke `dispatch GH-277 --json`; capture stdout.
2. Parse stdout as one JSON document; assert it is a full envelope (interactive mode) with `data.error.detail` present.
3. Assert the detail's `kind`, `code`, and `field` are exactly the supplied identifiers and are members of `DispatchEnvelopeError["detail"]`; assert the detail contains no environment value, credential material, prompt content, or stream content.
4. Assert every registered secret value is absent from the serialized document (the existing redaction chokepoint ran before the single write).
5. Assert the detail is not removed by redaction: the identifiers survive because they are not registered secrets.
6. Assert the machine output still contains the unchanged top-level `error.code`, `data.result`, and `data.lastMessage`.

**Expected Outcome**:

- The detail reaches machine consumers intact and survives the redaction path with no value leak.

**Notes / Clarifications**:

- Source anchors: `packages/cli/src/output/serialize.ts:41-49, 89-117`; `packages/cli/src/index.ts:413-435`; `packages/core/src/contracts/dispatch.ts` (`DispatchEnvelopeError`); spec AC-F5-2 392.

#### TC-HDA-032 - Verbose human output names the underlying code and field at the dispatch human-text seam; non-verbose text is exactly four keys

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-7, AC-F5-3, AC-F7-4, DM-4, NFR-7, DEC-4
**Test Type(s)**: Integration, Behaviour, Type
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-harness-default-detail.test.ts`; `tests/types/dispatch-human-text-context.type-test.ts`; `packages/cli/src/commands/dispatch.ts`; `packages/cli/src/output/dispatch-text.ts`; `packages/cli/src/index.ts`
**Tags**: @backend, @dispatch, @text, @verbose

**Preconditions**:

- The same failing scenario is used for all three invocations, and the failure carries `detail: { kind: "harness", code: "harness.spawn.variable-missing", field: "HARNESS_MODEL" }`.
- `--verbose` is parsed in `runCli` (`packages/cli/src/index.ts:317`) and handed to `writeOutput` (`packages/cli/src/index.ts:413-435`; `packages/cli/src/output/serialize.ts:73, 97-113`).
- DM-4 is delivered: `packages/cli/src/index.ts` exports `HumanTextContext = { readonly verbose: boolean }` and declares `CommandDefinition.humanText` as `(data: unknown, brand: BrandIdentity, context?: HumanTextContext) => string | undefined`; `runCli` passes `{ verbose }` at the single human-text call site (351-353); an omitted context means non-verbose.
- The dispatch command selects its human text at `packages/cli/src/commands/dispatch.ts:133-149`; `renderDispatchText` emits the four keys (`packages/cli/src/output/dispatch-text.ts:28-34`) and the dispatch text module renders the bounded verbose diagnostic. The shared stderr `diagnosticFor` (`packages/cli/src/index.ts:298-303`) is not verbose-gated and is emitted only for a failure outcome; a pre-session spawn failure is a data-bearing success envelope, so it produces no stderr diagnostic.

**Steps**:

1. Invoke `dispatch GH-277 --verbose` without `--json`; capture stdout and stderr separately.
2. Assert stdout — the human-text channel that `writeOutput` writes from `options.humanText` after redaction (`packages/cli/src/output/serialize.ts:103-104`) — names the underlying code `harness.spawn.variable-missing` and the field `HARNESS_MODEL`.
3. Assert the verbose stdout introduces no new `key=value` contract: every rendered key line is one of the four delivered keys (no fifth `detail=`/`field=` key line), and the diagnostic is prose naming the code and field.
4. Assert stderr is empty or, if it carries any content, contains neither `harness.spawn.variable-missing` nor `HARNESS_MODEL`; a dispatch-pre-session failure therefore cannot be diagnosed through the shared `diagnosticFor` channel.
5. Assert the verbose combined output does not contain any environment value, credential material, prompt, or stream content.
6. Invoke `dispatch GH-277` without `--verbose` and without `--json`; capture stdout.
7. Assert stdout is exactly the four rendered lines, in order `result=`, `pr_url=`, `exit_code=`, `last_message=`; assert there is no fifth key and no blank trailing content beyond the final newline.
8. Assert the non-verbose combined output does not contain `harness.spawn.variable-missing` or `HARNESS_MODEL` (the underlying detail is verbose-only), while it contains the spawn-failed sentence as `last_message`.
9. Invoke `dispatch GH-277 --json --verbose`; parse stdout as one envelope; assert it still carries `data.error.detail` and that, apart from the generated `runId` and `timing`, it equals the `--json`-without-`--verbose` envelope (verbose changes no machine shape).
10. Assert the DM-4 two-parameter compatibility clause under `pnpm typecheck`: a `CommandDefinition` whose `humanText` declares only `(data, brand)` is assignable to the published type; a direct two-argument call `definition.humanText(data, brand)` compiles; the same definition under an omitted context produces the same text as the delivered two-parameter form (non-verbose); and a three-argument call `definition.humanText(data, brand, { verbose: true })` compiles. Assert `HumanTextContext` is exactly `{ readonly verbose: boolean }` (a `{ verbose: "yes" }` literal is rejected with `@ts-expect-error`).
11. Assert only the dispatch command consumes the context: every other delivered command definition either declares the two-parameter form or ignores the third parameter, and no other human-text output changes between omitted context and `{ verbose: true }`.

**Expected Outcome**:

- Verbose human mode names the underlying code and field on the dispatch human-text channel through the optional `HumanTextContext` and not on the shared stderr diagnostic; non-verbose text remains exactly the four delivered keys with no detail leak; machine JSON is unaffected by verbose; and a delivered two-parameter definition still compiles and behaves identically under `pnpm typecheck`.

**Notes / Clarifications**:

- Spec v1.2 §2.1/§16 and Appendix D name the seam, so OQ-T3 is closed: the bounded verbose diagnostic is selected by the dispatch command's `humanText` (133-149) through the optional `HumanTextContext` third parameter (DM-4) and rendered in the dispatch text module, with `--verbose` as the parsed fact (317). DM-4 declares the additive published-type widening: existing two-parameter definitions and direct two-argument calls stay valid, and an omitted context means non-verbose. Step 10 asserts that compatibility under `pnpm typecheck`; the observable channel is asserted by steps 1–9.
- The four-key assertion is unchanged and load-bearing (NFR-7); M-11 proves a fifth key goes red, M-10 proves a removed verbose rendering goes red.
- Source anchors: `packages/cli/src/commands/dispatch.ts:133-149`; `packages/cli/src/output/dispatch-text.ts:28-34`; `packages/cli/src/index.ts:51, 298-303, 317, 351-353, 413-435`; `packages/cli/src/output/serialize.ts:73, 89-115`; spec AC-F5-3 395, DM-4 240, NFR-7 282, §16 366-369, Appendix C 516-540.

#### TC-HDA-033 - Spawn-failed identity, token, outcome, exit, and last message unchanged; no new vocabulary

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-4, NFR-4, DEC-4
**Test Type(s)**: Integration, Contract, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-error-envelope.test.ts`; `tests/golden/dispatch-errors.test.ts`; `tests/fixtures/dispatch/golden/errors/spawn-failed.json`; `tests/checks/**`
**Tags**: @backend, @dispatch, @identity, @vocabulary

**Preconditions**:

- The delivered spawn-failed branch returns `errorCode: "dispatch.session.spawn-failed"`, `outcome: O_FAILED`, `lastMessage: "spawn failed before a session existed"`, and `evidenceRefs: ["harness:spawn-failed"]` (`packages/core/src/app/dispatch.ts:466-485`).
- The error table row for `dispatch.session.spawn-failed` is the delivered row (category `user`, projection `user-validation`, exit 1).

**Steps**:

1. Invoke the failing scenario with `--json`; assert `data.error.code === "dispatch.session.spawn-failed"`.
2. Assert `data.error.category === "user"`, `retryable === false`, `consequence === "not_landed"`, and `remediationHint` equals the delivered string for a non-state failure.
3. Assert `data.result === "failed"`, `data.outcome === "failed"`, and the projected exit is `1`.
4. Assert `data.lastMessage === "spawn failed before a session existed"` exactly (same text, same punctuation); assert no truncation marker is appended.
5. Assert the attempt record's `token` is `failed`, `outcome` is `failed`, and its `evidenceRefs` contains `harness:spawn-failed`.
6. Assert the failure-code array is the delivered nine, the delivery-result token set is unchanged, the classifier's outcome/projection table is unchanged, and the error table has no new row for the detail (compare imported constants and the row code set).
7. Assert the delivered golden spawn-failure envelope still matches byte-for-byte after the change: `bun test tests/golden/dispatch-errors.test.ts` passes, and the golden [tests/fixtures/dispatch/golden/errors/spawn-failed.json](../../../../tests/fixtures/dispatch/golden/errors/spawn-failed.json) carries the repaired `{ kind: "harness", code: "harness.spawn.refused" }` detail with no `field` while every other field, including `data.lastMessage`, `data.result`, and the exit projection, is byte-unchanged.
8. **Negative control:** in a scratch copy, change the last message to `"spawn failed"` or add a new error-table row; assert steps 4/6 go red; restore.

**Expected Outcome**:

- Only the additive detail changed; the identity, token, outcome, exit, category, retryability, consequence, remediation hint, last message, classifier, and error table are untouched, and the golden envelope pins the repaired detail byte-for-byte.

**Notes / Clarifications**:

- This is the bash-continuity contract: a fourth text key or a changed sentence would break consumers.
- The golden update is deliberate: its `harness.spawn.refused` failure carries kind and code and no field, so the expected detail is `{ kind: "harness", code: "harness.spawn.refused" }`; the fixture edit and its consumer are named in §7.1/§7.2. A golden edited without the attachment rule is a review item.
- Source anchors: `packages/core/src/app/dispatch.ts:185-200, 466-485`; `packages/core/src/contracts/error-table.ts` (`dispatch.session.spawn-failed` row); `tests/golden/dispatch-errors.test.ts:49-57`; `tests/fixtures/dispatch/golden/errors/spawn-failed.json`; spec AC-F5-4 394, NFR-4 279.

#### TC-HDA-034 - Detail hygiene: identifiers only, single-line, bounded to 256 characters

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-5, NFR-6, DEC-4
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-harness-default-detail.test.ts`; `packages/core/src/contracts/dispatch.ts`
**Tags**: @backend, @dispatch, @bounds, @security

**Preconditions**:

- A detail carrying `kind: "harness"`, `code: "harness.spawn.variable-missing"`, and `field: "HARNESS_MODEL"`, typed as `DispatchEnvelopeError["detail"]`.
- The delivered bound constant (expected `256`) is introduced with the detail; until it exists the spec threshold is the authority (spec NFR-6 281, AC-F5-5 395).

**Steps**:

1. Serialize the detail with `JSON.stringify`; assert it carries the identifier members `kind`, `code`, and `field`, and that no environment value, credential material, prompt, or stream content appears. Any additional member must be an identifier, never a value.
2. Assert the serialized detail contains no CR or LF (single line).
3. Assert the serialized detail length is at most the delivered bound constant (expected 256); assert the bound is a named constant, not a magic number duplicated in the test.
4. Assert an optional `field` that is absent is omitted, not serialized as `null` or an empty string.
5. **Non-vacuity control:** construct a synthetic detail whose field is a 300-character identifier and assert the bound assertion fails; construct one whose field contains a newline and assert the single-line assertion fails; restore.
6. Assert the real dispatch detail from TC-HDA-030 passes all of the above with the real `HARNESS_MODEL` field.

**Expected Outcome**:

- The detail is an identifiers-only, single-line, bounded diagnostic that cannot become an environment dump or a secret-exfiltration path.

**Notes / Clarifications**:

- The 256 threshold is spec-derived until the delivered constant lands; the test must then read the constant so the plan and product cannot drift.
- Source anchors: spec NFR-6 281, AC-F5-5 395, Appendix C 494-505; `packages/core/src/contracts/dispatch.ts` (`DispatchEnvelopeError.detail`); `packages/core/src/app/dispatch.ts:179-182` (the existing single-line/bound helper pattern for `last_message`, not to be reused as the detail bound without a decision).

#### TC-HDA-035 - Absent-required field name appears in both the harness failure and the dispatch detail

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-5, F-7, AC-F7-2, NFR-2, NFR-5, DEC-3, DEC-4
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-harness-default-detail.test.ts`; `tests/behaviour/dispatch-harness-default-spawn.test.ts`
**Tags**: @backend, @integration, @dispatch, @traceability

**Preconditions**:

- The production composition (or the dispatch engine with the production opencode adapter) is used with a parent environment that lacks a declared required variable (e.g. `HOME`), so the real builder produces the failure rather than a scripted one.
- The temp state root declares `GH-277` in its queue (`queue add`) or the composition injects the lease-claim port; without it the production dispatch returns `queue.entry.unobserved` before any spawn or attempt record, so step 5 cannot be reached.
- A recording adapter boundary captures the `HarnessFailure` before dispatch collapses it.

**Steps**:

1. Compose the repaired default with a parent that has `PATH` but not `HOME`; invoke `dispatch GH-277 --json`.
2. Capture the harness failure at the adapter boundary; assert `code === "harness.spawn.variable-missing"` and `field === "HOME"`.
3. Assert the dispatch envelope keeps `data.error.code === "dispatch.session.spawn-failed"` and `data.error.detail.code === "harness.spawn.variable-missing"` with `detail.field === "HOME"`.
4. Assert the same field string appears in both layers (no renaming, no case change, no truncation).
5. Assert no child was spawned and exactly one attempt record was written with `token === "failed"`.
6. Invoke without `--json`; assert the four-key text contract holds and the field name is not in the non-verbose output (cross-check to TC-HDA-032).
7. **Control:** supply `HOME` and assert the failure disappears, proving the field assertion is caused by the absence and not by the fixture.

**Expected Outcome**:

- The absent required variable is named identically in the harness failure and the dispatch detail, and the failure is observable without source.

**Notes / Clarifications**:

- This is the AC-F7-2 regression case and the ticket's "declared-but-absent variable still fails closed, with the failing name visible in the error detail" bullet.
- Source anchors: `packages/core/src/domain/harness-spawn-env.ts:49-56`; `packages/core/src/app/dispatch.ts:466-485`; spec AC-F7-2 400.

#### TC-HDA-100 - End-to-end real dispatch reaches classification with any token other than `dispatch.session.spawn-failed`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-1, AC-F8-1, NFR-1
**Test Type(s)**: E2E, Manual
**Automation Level**: Manual
**Target Layer / Location**: §6.3 procedure; evidence in §10
**Tags**: @manual, @e2e, @real-cli

**Preconditions**:

- The §6.3 preconditions pass: clean worktree, recorded `HEAD` and `opencode --version`, a non-empty `GITHUB_TOKEN` in the invoking shell, `gh auth status` green, a readable tracker probe, and no active `GH-277` lease in the live state root (a read-only precondition; if one exists, STOP and report).
- A disposable clone exists outside this worktree with the real repository origin and no clone-local `harness.environment` declaration, and the probe runs under the probe-only brand `gh277-probe`, so the production state root is `$LIVE_HOME/.gh277-probe-state`, never the live `$HOME/.delivery-os-state`.

**Steps**:

1. Execute §6.3 steps 0–7 exactly under the isolated probe state root, including the zero-configuration assertion (`config get harness.environment --show-origin` reports origin `layer=defaults`) and the live-root lease STOP precondition.
2. Record `data.result`, `data.lastMessage`, `data.error.code` (or absence), `data.error.detail` (or absence), and the exit code; when present, `data.error.detail` conforms to `DispatchEnvelopeError["detail"]` and, on the pre-session path, is always present with `kind` and `code` and `field` only when carried.
3. Assert `data.result` is a member of the delivered delivery-result token set and is not `dispatch.session.spawn-failed`; assert `data.lastMessage` is not `spawn failed before a session existed`.
4. Read the attempt ledger under the isolated probe state root (`$LIVE_HOME/.gh277-probe-state/ledger.default.jsonl`) and assert an attempt record exists for `GH-277` with a non-empty `attemptId`, a delivered `token`, an `outcome`, and `evidenceRefs` containing `attempt:ATTEMPT_ID`; state explicitly that the evidence comes from the probe root, not the live root.
5. If the run still fails pre-session, record `data.error.detail` verbatim; treat a newly named required boot variable as OQ-2 evidence and add it to the default set before delivery closes (spec F-8, §18).
6. Record the elapsed wall time and the observed CLI version.

**Expected Outcome**:

- One real dispatch reaches classification with any token other than `dispatch.session.spawn-failed`, and an attempt record exists.

**Notes / Clarifications**:

- GAP-T1: this is the only AC that needs a live CLI. A blocked precondition is recorded and re-run; it is not a product failure.
- Source anchors: spec AC-F8-1 404, F-8 148, §18 417-424; sibling procedure GH-275 §6.3.

#### TC-HDA-101 - End-to-end proof is bounded and leaves this change's worktree git-clean and `HEAD`-stable

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-2, RSK-6
**Test Type(s)**: E2E, Manual
**Automation Level**: Manual
**Target Layer / Location**: §6.3 procedure; evidence in §10
**Tags**: @manual, @e2e, @isolation

**Preconditions**:

- The probe runs in the disposable clone, not in this change's worktree, and its queue/state writes go to the probe-only brand root `$LIVE_HOME/.gh277-probe-state`, not the live `$HOME/.delivery-os-state`.
- `HEAD_before` and `git status --porcelain` are recorded before the run; no active `GH-277` lease exists in the live state root (otherwise STOP and report, never release it).

**Steps**:

1. Before the run, record `git -C "$REPO" rev-parse HEAD` and assert `git -C "$REPO" status --porcelain` prints nothing.
2. Execute §6.3 with the hard bounds: ≤60 s to observe the `opencode run --format json` child and ≤180 s total wall time, under `DELIVERY_OS_WORKING_NAME=gh277-probe` and the probe state root `$LIVE_HOME/.gh277-probe-state`.
3. Kill only the dispatch's own child (`pgrep -P "$DISPATCH_PID"`), never the parent or any unrelated process.
4. After the run, assert `git -C "$REPO" status --porcelain` still prints nothing and `HEAD` equals `HEAD_before`; if a concurrent commit moved `HEAD` (as GH-275 recorded), record the commit identities and assert the probe wrote nothing (the clone's own `.git` moved independently). Byte identity is not asserted: `pnpm build` intentionally rewrites gitignored `packages/*/dist` and `*.tsbuildinfo`, and the clone symlinks `$REPO/node_modules`, so only tracked and untracked-not-ignored paths are in scope.
5. Assert the disposable clone was removed, its `node_modules` symlink with it, and this worktree's `node_modules` was untouched.
6. Assert no dispatch child survives (`pgrep` after cleanup is empty for the probe's command line).
7. Assert the attempt record was written to the isolated probe state root and copied to the retained evidence directory; assert the live `$HOME/.delivery-os-state` was not written and no live lease was released.

**Expected Outcome**:

- The proof is bounded and scoped: a nested lifecycle can only touch the disposable clone and the probe-brand state root (`$LIVE_HOME/.gh277-probe-state`); this change's worktree stays git-clean (`git status --porcelain` empty) and `HEAD`-stable, while ignored build outputs are intentionally rewritten and byte identity is not claimed.

**Notes / Clarifications**:

- The worktree snapshot is asserted only in this manual procedure; the automated suites are read-only by construction and do not need a `git status` assertion.
- The probe state root is the evidence source; the live state root is read only for the lease STOP precondition and is never mutated or released.
- Source anchors: spec AC-F8-2 405, RSK-6 305; sibling procedure GH-275 §6.3/§10.

## 6. Environments and Test Data

| Environment | Runtime / tool | Invocation | Scope |
|---|---|---|---|
| Local iteration | Bun 1.4.4 (repo pin), pnpm 10.18.3 | `bun test tests/behaviour/harness-spawn-env.test.ts`; `bun test tests/behaviour/harness-config.test.ts` | Narrow suites while implementing |
| Type and boundaries | Bun / TypeScript 6.0.3 | `pnpm typecheck`; `pnpm check:boundaries`; `pnpm check:privacy-literals` | Type tests, data-only contract, ambient/secret boundaries, privacy literals |
| Full automated battery | Bun | `bun test` | Every `*.test.ts`, including the checks tier |
| Aggregate gate | Bun / pnpm | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | Pre-finish gate (NFR-9) |
| Synthetic-child process cases | Bun + a `mkdtemp` shell script | `bun test tests/behaviour/harness-default-path.test.ts tests/behaviour/dispatch-harness-default-spawn.test.ts` | The only real child in the battery, and never a harness CLI |
| End-to-end proof | Installed `opencode` + Bun | §6.3 | One real dispatch, operator-run, outside the change worktree, under an isolated probe state root |

### 6.1 Test Data

- **Controlled parent environment**: a synthetic record built in the test, containing only `PATH` (a `mkdtemp` bin directory plus the runtime path the interpreter needs) and `HOME` (a `mkdtemp` home), plus explicitly named canaries. `TMPDIR` is absent for the absent-optional cases and present only for the present-optional cases. The model variables are always absent unless a case explicitly declares them.
- **Synthetic `opencode` executable**: `tests/fixtures/harness/default-spawn.ts` writes an executable script into a `mkdtemp` bin directory. The script writes its received environment and argv to files in the same temp root, prints two JSONL lines (`step_start` with a top-level `sessionID`, `step_finish` with `part.reason === "stop"`), and exits 0. It never contacts a model, a network, or a real store.
- **Canaries**: unique fabricated values for `SYNTHETIC_UNDECLARED_TOKEN`, `OC_ADOS_MAIN_MODEL`, `OC_ADOS_SMALL_MODEL`, and a decoy name shaped like `HARNESS_MODEL` but not equal to it; they must never appear in the child environment or in serialized output. The existing fixture (`tests/fixtures/harness/spawn-env.ts:22-49`) is extended so it keeps a genuine undeclared canary after `HOME` becomes declared.
- **Default fixture**: `tests/fixtures/harness/config/default.resolved.json` is updated deliberately to the repaired set and asserted by canonical JSON equality. A default change is a visible fixture diff, not a silent drift.
- **Dispatch fixture extension**: `tests/fixtures/dispatch/harness.ts` `createScriptedHarness` gains a `spawnFailure: HarnessFailure` option so a test can supply the underlying kind/code/field. The existing `spawnFails` boolean is retained for the unchanged-identity cases; its failure is `{ kind: "harness", code: "harness.spawn.refused" }` with no `field`, which is the reachable no-field case in TC-HDA-030 step 8.
- **Queue entry**: a scenario that goes through the production composition declares `GH-277` in the temp state root's queue (`queue add`) or injects the lease-claim port; otherwise the dispatch returns `queue.entry.unobserved` before any spawn or attempt record.
- **Golden spawn-failure envelope**: `tests/fixtures/dispatch/golden/errors/spawn-failed.json` is updated deliberately to carry `data.error.detail = { kind: "harness", code: "harness.spawn.refused" }` with no `field`; `tests/golden/dispatch-errors.test.ts` keeps its byte-equality assertion unchanged.
- **Synthetic identities**: fabricated refs (`GH-277`), attempt ids, repository keys, session ids (`ses_*`), and paths under a `mkdtemp` root. No real session id, prompt, credential, repository name, or personal data appears.
- **The 256-character detail bound**: the test reads the delivered constant once it exists; until then the spec threshold (spec NFR-6 281, AC-F5-5 395) is the documented authority and the constant name is an implementation choice (GAP-T2). The detail member is `DispatchEnvelopeError["detail"]`.

### 6.2 Isolation and Cleanup

- Every filesystem-touching suite creates its root with `mkdtempSync` under `join(ROOT, "tmp", "tmpdir")` (the repo-local temp root), not the system `/tmp`, and removes it in `finally`, including on failure. This is the same repair the config-artifact suite uses (`tests/checks/config-default-positions.test.ts:16`).
- The synthetic child is always killed in `finally`; the suite waits only on child close/completion promises, never on a sleep; every case has a bounded test timeout so a broken kill fails rather than hangs.
- No suite reads `process.env`, `$HOME`, the network, or a real credential. All environment facts are injected; the synthetic CLI's environment dump is the only view of a child environment and it is a `mkdtemp` file.
- No suite writes the real worktree or the live state root. The end-to-end procedure is where the worktree git-clean/`HEAD` snapshot and the isolated probe state root are asserted (TC-HDA-101).
- The real attempt record written by the E2E probe belongs to the isolated probe state root and is copied into the retained evidence directory; the live `$HOME/.delivery-os-state` is never written. Every other artifact is removed with the disposable clone.

### 6.3 End-to-end proof procedure (operator-run, AC-F8-1/AC-F8-2)

Executed in the delivery (or verification) phase, not by any automated suite. **It must not run inside this change's worktree.** It uses a disposable clone so a nested lifecycle cannot touch this worktree (spec AC-F8-2, RSK-6). The probe runs under a probe-only brand (`DELIVERY_OS_WORKING_NAME=gh277-probe`): production derives `stateDirectory = homeDirectory/brand.stateDirectoryName` (`packages/cli/src/production.ts:232-233`), so the brand is the state-directory override and the probe writes `$LIVE_HOME/.gh277-probe-state`, never the live `$HOME/.delivery-os-state`; `DELIVERY_OS_STATE_DIR` is not on the production path and is unset. The live root is read once, only to prove no `GH-277` lease is active. The procedure shape follows the GH-275 sibling plan §6.3.

```bash
# 0. Preconditions: this worktree is clean, the delivered build is current, the CLI
#    is installed and healthy, and the dispatch process can authenticate to GitHub.
REPO=$PWD                                  # this change's worktree (never the probe cwd)
E2E=/tmp/opencode/gh277-e2e                # disposable clone; outside the worktree
EVIDENCE=/tmp/opencode/gh277-e2e-evidence  # retained evidence; outside worktree and live state
LIVE_HOME="$HOME"                          # the operator's live home (never written by the probe)
LIVE_STATE="$LIVE_HOME/.delivery-os-state" # live root: read-only, never written or released
PROBE_NAME=gh277-probe                     # probe-only brand; yields .gh277-probe-state
PROBE_STATE="$LIVE_HOME/.gh277-probe-state"
LOG=$E2E/dispatch.log
TRACKER_REPO=juliusz-cwiakalski/agentic-delivery-os
unset DELIVERY_OS_WORKING_NAME             # step 0b reads the live default brand root
unset DELIVERY_OS_STATE_DIR                # no state-dir override; the brand selects the root
git -C "$REPO" status --porcelain          # must print nothing
HEAD_BEFORE=$(git -C "$REPO" rev-parse HEAD)
opencode --version | tee /tmp/opencode/gh277-cli-version.txt # record; no product pass/fail on the version
( cd "$REPO" && pnpm build )               # the code under test is this worktree's build

# 0a. HARD CREDENTIAL PRECONDITION. Production resolves the literal GITHUB_TOKEN
#     environment variable, so a `gh` keyring login alone is not visible.
export GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token 2>/dev/null)}"
[ -n "${GITHUB_TOKEN:-}" ] || { echo "STOP: no GITHUB_TOKEN for the dispatch process"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "STOP: gh is not authenticated"; exit 1; }
gh issue view 277 -R "$TRACKER_REPO" --json number >/dev/null \
  || { echo "STOP: tracker read probe failed"; exit 1; }

# 0b. HARD LIVE-STATE PRECONDITION. Read the live lease view only; never mutate or
#     release it. If a GH-277 dispatch lease is active, STOP and report.
mkdir -p "$EVIDENCE"
LIVE_LEASES=""
if [ -f "$LIVE_STATE/ledger.default.jsonl" ]; then
  LIVE_JSON=$( cd "$REPO" && bun packages/cli/bin/delivery-os.ts queue list --json ) \
    || { echo "STOP: cannot read the live lease view"; exit 1; }
  LIVE_LEASES=$( printf '%s\n' "$LIVE_JSON" \
    | jq -r '.data.leases[]?
        | select(.ref=="GH-277")
        | [.leaseId, .holder, .scope] | @tsv' ) \
    || { echo "STOP: cannot parse the live lease view"; exit 1; }
fi
printf '%s\n' "$LIVE_LEASES" | tee "$EVIDENCE/live-leases.tsv"
[ -z "$LIVE_LEASES" ] \
  || { echo "STOP: a live GH-277 lease is active; report it and do not proceed or release it"; exit 1; }

# 1. A disposable clone outside the change worktree (own .git, own worktree).
rm -rf "$E2E"
git clone --no-hardlinks --single-branch \
  --branch fix/GH-277/harness-default-allowlist "$REPO" "$E2E"
ln -s "$REPO/node_modules" "$E2E/node_modules"   # run the delivered workspace build

# 1a. ISOLATED PROBE BRAND AND STATE ROOT. The brand name selects the config and
#     state directories, so every probe queue/lease/attempt write lands in
#     $LIVE_HOME/.gh277-probe-state, never the live .delivery-os-state. The probe
#     brand is removed in cleanup; the live root is never written or released.
export DELIVERY_OS_WORKING_NAME="$PROBE_NAME"
case "$PROBE_STATE" in
  "$LIVE_STATE"|"$LIVE_STATE"/*) echo "STOP: probe state root resolves to the live state root"; exit 1 ;;
esac
[ "$PROBE_STATE" != "$LIVE_STATE" ] || { echo "STOP: probe state root equals the live root"; exit 1; }
rm -rf "$PROBE_STATE"                      # fresh probe root; never the live root

# 1b. ZERO-CONFIGURATION ASSERTION (the point of this change). No clone-local or
#     probe-brand user config may declare harness.environment; the shipped defaults
#     must supply it. The surface is the delivered inspection command (AC-F6-3).
PROBE_USER_CONFIG="${XDG_CONFIG_HOME:-$LIVE_HOME/.config}/.gh277-probe/config.yaml"
for c in "$E2E/.delivery-os/config.yaml" "$E2E/.gh277-probe/config.yaml" "$PROBE_USER_CONFIG"; do
  if [ -f "$c" ] && grep -q 'harness' "$c"; then
    echo "STOP: probe configuration declares harness; zero-config proof invalid"; exit 1
  fi
done
CONFIG_JSON=$( cd "$E2E" && bun packages/cli/bin/delivery-os.ts \
  config get harness.environment --show-origin --json )
printf '%s\n' "$CONFIG_JSON" | tee "$E2E/harness-environment.json" | jq -e '
  .data.key == "harness.environment" and
  (.data.value | length) == 4 and
  ([.data.value[] | select(.optional != true) | .name] | sort) == (["DELIVERY_WORK_PATH","HOME","PATH"] | sort) and
  ([.data.value[] | select(.optional == true) | .name]) == ["TMPDIR"] and
  (.data.origin | startswith("layer=defaults"))
' >/dev/null || { echo "STOP: shipped default is not the expected zero-configuration set"; exit 1; }

# 1c. Record the parent facts the proof depends on; unset the old model names and
#     TMPDIR so the run proves (a) no model variable is required and (b) the
#     optional entry may be absent.
printf 'TMPDIR=%s\n' "${TMPDIR-UNSET}"
printf 'HOME=%s\n' "$HOME"
printf 'DELIVERY_OS_WORKING_NAME=%s\n' "$DELIVERY_OS_WORKING_NAME"
command -v opencode | tee "$E2E/opencode-path.txt"
env | grep -E '^(HARNESS_MODEL|HARNESS_SMALL_MODEL|OC_ADOS_MAIN_MODEL|OC_ADOS_SMALL_MODEL)=' \
  | tee "$E2E/parent-model-vars.txt" || true
unset HARNESS_MODEL HARNESS_SMALL_MODEL TMPDIR

# 1d. FIRST-EVENT PROBE (environmental, independent of the product). A healthy
#     local CLI emits its first JSONL event in seconds. A slow provider/CLI is a
#     blocked precondition, never a product failure.
PROBE_START=$(date +%s%3N)
FIRST_EVENT=$( ( cd "$E2E" && printf 'Reply with the single word: ok\n' | timeout 70 opencode run --format json ) | head -n 1 )
FIRST_EVENT_MS=$(( $(date +%s%3N) - PROBE_START ))
printf 'first-event-ms=%s\n' "$FIRST_EVENT_MS" | tee "$E2E/first-event.txt"
printf '%s\n' "$FIRST_EVENT" | jq -e '.sessionID' >/dev/null \
  || { echo "STOP: no JSONL first event from the CLI"; exit 1; }
[ "$FIRST_EVENT_MS" -le 60000 ] \
  || { echo "STOP: first event exceeded the 60 s acquisition bound"; exit 1; }

# 2. The origin must be the real repository: dispatch derives its repository
#     identity from origin, then reads tracker and CI truth through it.
git -C "$E2E" remote set-url origin https://github.com/juliusz-cwiakalski/agentic-delivery-os.git

# 3. Declare the queue entry in the ISOLATED probe state root only. A stale probe
#     lease may be released here; no live lease is ever released.
( cd "$E2E" && bun packages/cli/bin/delivery-os.ts queue release GH-277 --holder dispatch --json ) >/dev/null 2>&1 || true
( cd "$E2E" && bun packages/cli/bin/delivery-os.ts queue add GH-277 --json )

# 4. Run one real dispatch in the background. `exec` keeps $! equal to the dispatch
#    process, so the opencode child is a direct child of it.
( cd "$E2E" && exec bun packages/cli/bin/delivery-os.ts dispatch GH-277 --json ) >"$LOG" 2>&1 &
DISPATCH_PID=$!

# 5. Observe the handle window: the opencode child must exist and dispatch must
#    still be running. A pre-session environment failure shows no child at all.
CHILD=""
for _ in $(seq 1 60); do
  CHILD=$(pgrep -P "$DISPATCH_PID" -f 'opencode run --format json' || true)
  [ -n "$CHILD" ] && break
  sleep 1
done
if [ -z "$CHILD" ]; then
  echo "FAIL: no opencode child within 60 s"; kill "$DISPATCH_PID" 2>/dev/null; wait "$DISPATCH_PID"; false
fi
sleep 15        # let the first identified line arrive and classification begin

# 6. End only this dispatch's session; never the dispatch parent.
kill -TERM "$CHILD" 2>/dev/null || true
wait "$DISPATCH_PID"; RC=$?

# 7. Evidence: envelope, then the durable attempt record from the ISOLATED root.
jq -r '.data.result, .data.lastMessage, (.data.error.code // "-"), (.data.error.detail // "-")' "$LOG" \
  | tee "$E2E/envelope-evidence.txt"
echo "exit=$RC"
STATE_ROOT="$PROBE_STATE"                    # isolated probe root, never $LIVE_STATE
ATTEMPT=$(jq -r --arg ref GH-277 \
  'select(.kind=="dispatch.attempt") | select(.payload.ref==$ref) | .payload
   | [.attemptId, .recordedAt, .token, .outcome, (.evidenceRefs|join(","))] | @tsv' \
  "$STATE_ROOT/ledger.default.jsonl" | tail -1)
printf '%s\n' "$ATTEMPT" | tee "$E2E/attempt.tsv"
ATTEMPT_ID=$(printf '%s\n' "$ATTEMPT" | cut -f1)
[ -n "$ATTEMPT_ID" ] || echo "FAIL: attempt record has no attemptId"
printf '%s\n' "$ATTEMPT" | grep -q 'attempt:' || echo "FAIL: no attempt evidence ref"

# 7a. LEASE PROOF (corroboration, isolated root): a completed dispatch released
#     the lease it acquired in the probe root.
ACTIVE_LEASES=$( ( cd "$E2E" && bun packages/cli/bin/delivery-os.ts queue list --json ) \
  | jq -r '.data.leases[]
      | select(.ref=="GH-277")
      | select(.repository=="github.com/juliusz-cwiakalski/agentic-delivery-os")
      | [.leaseId, .holder, .scope] | @tsv' )
printf '%s\n' "$ACTIVE_LEASES" | tee "$E2E/leases.tsv"
[ -z "$ACTIVE_LEASES" ] || echo "FAIL: GH-277 lease still active in the probe root after dispatch"

# 7b. Retain the evidence outside the disposable clone and outside the live root.
cp "$E2E/envelope-evidence.txt" "$E2E/attempt.tsv" "$E2E/leases.tsv" \
   "$E2E/harness-environment.json" "$E2E/first-event.txt" "$EVIDENCE/"
cp "$LOG" "$EVIDENCE/dispatch.log"

# 8. Isolation: this worktree stays git-clean and HEAD-stable. Byte identity is
#    NOT asserted: step 0's `pnpm build` rewrites gitignored packages/*/dist and
#    *.tsbuildinfo, and the clone symlinks $REPO/node_modules.
git -C "$REPO" status --porcelain            # must still print nothing
git -C "$REPO" rev-parse HEAD                # must equal HEAD_BEFORE
```

**Evidence-root declaration.** Every attempt, lease, and envelope fact recorded from this procedure in §10 comes from the isolated probe state root `$LIVE_HOME/.gh277-probe-state` (retained copies in `$EVIDENCE`), never from the live `$HOME/.delivery-os-state`. The live root was read once, at step 0b, for the lease precondition only.

**Expected observable evidence.**

- Step 0b passes: the live root has no active `GH-277` lease, and the read-only `live-leases.tsv` is empty. If it is non-empty, the run does not start.
- Step 1a passes: `DELIVERY_OS_WORKING_NAME=gh277-probe`, `PROBE_STATE` is `$LIVE_HOME/.gh277-probe-state`, and it is not the live root; the probe root starts fresh.
- Step 1b passes: the clone-local `.delivery-os` and `.gh277-probe` configs and the probe-brand user config do not declare `harness`, and `config get harness.environment --show-origin --json` reports exactly four `data.value` entries — required `PATH`, `HOME`, `DELIVERY_WORK_PATH`, optional `TMPDIR` — with `data.origin` starting `layer=defaults`. This is the zero-configuration proof and the AC-F6-3 inspection surface.
- Step 1c records the parent facts; the run unsets both model variables and `TMPDIR`, so a pass proves neither is required and the optional entry tolerates absence.
- Step 1d records a first event with a top-level `sessionID` and `first-event-ms` ≤60 000. A longer first event is a blocked precondition (CLI/provider slowness), not a product failure.
- Step 3 declares `GH-277` in the probe state root; no live queue write occurs.
- Step 5 finds the `opencode run --format json` child while dispatch is still alive (the handle window). No child within 60 s means the environment/command resolution failed.
- Step 7 prints a `data.result` in the delivered token set, a `data.lastMessage` that is not `spawn failed before a session existed`, and a `data.error.code` that is not `dispatch.session.spawn-failed` (it may be absent). When a pre-session failure occurs, `data.error.detail` is always present with `kind` and `code` and `field` only when carried; if it names a variable, that is OQ-2 evidence.
- Step 7 prints the attempt record's `attemptId`, `recordedAt`, `token`, `outcome`, and `evidenceRefs` from the probe state root; the refs contain `attempt:ATTEMPT_ID`. The repository key is `github.com/juliusz-cwiakalski/agentic-delivery-os`.
- Step 7a shows no active `GH-277` lease in the probe state root on `github.com/juliusz-cwiakalski/agentic-delivery-os`.
- Step 8 shows this worktree's `git status --porcelain` empty and `HEAD` equal to `HEAD_BEFORE`; ignored build outputs are intentionally rewritten and are not part of the assertion.
- The live root is unchanged: no probe queue or attempt write lands there, and no live lease is released.
- Total wall time from step 4 to step 6 is ≤180 s.

**Pass/fail rule.**

- **PASS** = `data.result` in the delivered token set, `data.lastMessage` not the spawn-failed sentence, `data.error.code` not `dispatch.session.spawn-failed`, a non-empty `attemptId` read from the isolated probe state root, an `attempt:ATTEMPT_ID` ref, no active `GH-277` lease in the probe root, elapsed ≤180 s, this worktree git-clean with `HEAD` unchanged, and no write to the live root.
- **FAIL** = the spawn-failed identity appears, no child within 60 s, elapsed >180 s, a missing attempt id/ref in the probe root, an active lease in the probe root, this worktree's status/`HEAD` changed, or any probe write reached the live root. A failure reopens delivery, not the E2E wording. If the failure detail names a new required boot variable, land that variable in the default set (required, or optional when legitimately absent) before the pull request is finalized (spec F-8, §18), then re-run.
- **STOP (blocked precondition, not a product-test failure)** = step 0a fails, step 0b finds an active live `GH-277` lease or cannot read the live lease view, step 1a resolves the probe root to the live root, step 1b does not show the expected zero-configuration default (a procedure/config error), or step 1d records a first event later than the 60 s bound. Record the blocked precondition, restore the environment, and re-run; do not write a TC-HDA-100/101 result and do not reopen delivery on it. Never release the live lease to clear a STOP.

**Cleanup.**

- Kill any surviving child of `DISPATCH_PID`, then the dispatch process if it is still alive.
- If step 7a found an active lease in the probe state root, release it with `( cd "$E2E" && bun packages/cli/bin/delivery-os.ts queue release GH-277 --holder dispatch --json )` before cleanup; this touches the probe root only.
- `rm -rf "$E2E" "$PROBE_STATE" "$LIVE_HOME/.gh277-probe"` (the clone, its `node_modules` symlink, the probe state and config roots); never `$REPO/node_modules` and never `$LIVE_STATE`.
- Retain `$EVIDENCE` (the copied envelope, attempt, lease, zero-configuration, and first-event evidence) deliberately as the probe record; the live state root is never written.

### 6.4 Regression Runs Outside the TC Matrix

These run as part of delivery evidence but are not AC-bearing scenarios, so they carry no `TC-HDA-*` id:

- `bun test tests/behaviour/dispatch-*` and `bun test tests/conformance/dispatch*` — prove the dispatch engine's other behaviours are unchanged.
- `bun test tests/golden/dispatch-errors.test.ts` — prove the delivered golden spawn-failure envelope is byte-exact after the deliberate detail update (its failure is `harness.spawn.refused` with kind and code and no field).
- `bun test tests/behaviour/harness-* tests/structure tests/boundaries` — prove the delivered harness and structural invariants still hold.
- `bun test tests/checks` — prove the repository checks, including the changeset invariant, config artifacts, and the `harness-spawn-env` mutation anchors, stay green.
- `bun test tests/behaviour/queue-production-binding.test.ts` — note the degradation risk: `createProductionQueueHarness` composes the production stack with `{ HOME, HARNESS_MODEL, HARNESS_SMALL_MODEL }` and no `PATH` (`tests/fixtures/queue/production/harness.ts:194-199`), so after the repair `TC-BIND-007` fails pre-session on `harness.spawn.variable-missing: PATH`; its own `not.toBe("queue.entry.unobserved")` assertions still pass, so it can silently stop proving a spawn. The delivery plan must add a synthetic `PATH` to that fixture or restate the case as a queue-observation proof.
- `bun test tests/checks/harness-mutants.test.ts` — prove the delivered non-vacuity meta-check still mutates `harness-spawn-env.ts` at its string anchors (`76-84, 102-111`) after the optional branch; a changed anchor makes the mutant a no-op and the suite fails with "mutant … passed".
- `bash scripts/.tests/test-opencode-session.sh` — proves the untouched bash stack still reads the first `.sessionID` line (spec §7.2 [OUT]); it is not an oracle for the typed path.
- `pnpm check` — the aggregate gate (NFR-9).

### 6.5 Aggregate Gate and Privacy-Literal Constraint

The aggregate gate must run with a repo-local temp root:

```bash
TMPDIR=$PWD/tmp/tmpdir pnpm check
```

- **Why the override is required.** Several suites create temporary workspaces under the repository's `tmp/tmpdir` root (`tests/checks/config-default-positions.test.ts:16`). When `TMPDIR` points at a different filesystem from the repository, those tests can fail on a cross-device rename in CI-parity fixtures. The repo-local `TMPDIR` keeps every temporary root on the same filesystem and matches the CI invocation. Do not substitute `mktemp -d` or an unset `TMPDIR` for the final gate.
- **What `pnpm check` covers.** `lint` → `format:check` → `typecheck` (with the `pretypecheck` build) → `test` → `check:boundaries` (depcruise, ambient-globals, workspace entrypoints, secret-read boundary) → prompt conformance → help-guide coverage → exports parity (`package.json:18`). Run `git diff --check` before the gate.
- **Privacy-literal constraint.** Change artifacts, test files, and fixtures must contain no absolute workstation paths, machine-specific user names, private repository names, or cloud literals. Use placeholders (`$REPO`, `/path/to/...`, `/tmp/opencode/gh277-e2e`), synthetic identities, and `mkdtemp` roots. The binding guard is `pnpm check:privacy-literals` (`scripts/checks/privacy-literals.ts`, scope mode `working-tree`, hashed registry at `scripts/checks/privacy-literals.registry.json`). A literal that is genuinely required must be registered by the repository process, never hand-added to this plan.
- **No destructive generation.** `bun run scripts/checks/exports-parity.ts --generate-config-artifacts` is a deliberate artifact-generation step; it is never part of a test assertion and never run to make a failing parity check pass without reviewing the generated diff.

## 7. Automation Plan and Implementation Mapping

### 7.1 Files the Delivery Must Add or Edit

**Test fixtures and suites (add or edit; no license headers — test files and change artifacts are exempt):**

| Path | Action | Purpose |
|---|---|---|
| `tests/fixtures/harness/default-spawn.ts` | add | Controlled parent environment (at least `PATH` and `HOME` plus the named canaries), `mkdtemp` bin with the synthetic `opencode` script, env/argv capture helpers (TC-HDA-010, 011, 012) |
| `tests/fixtures/harness/spawn-env.ts` | edit | Repaired default descriptor, optional-present/absent descriptors, keep a genuine undeclared canary after `HOME` becomes declared (TC-HDA-012–017) |
| `tests/fixtures/harness/config/default.resolved.json` | edit | Pin the repaired default set (TC-HDA-005) |
| `tests/fixtures/harness/config/optional-entry.yaml` | add | A valid `{ name, optional: true }` entry (TC-HDA-021, 022) |
| `tests/fixtures/harness/config/invalid-optional-non-boolean.yaml` | add | `optional: "yes"` (TC-HDA-021) |
| `tests/fixtures/harness/config/invalid-optional-credential.yaml` | add | `optional: true` combined with `credentialRef` (TC-HDA-018, 021) |
| `tests/fixtures/dispatch/harness.ts` | edit | `createScriptedHarness` gains `spawnFailure: HarnessFailure`; existing `spawnFails` retained; its failure is `{ kind: "harness", code: "harness.spawn.refused" }` with no `field` (TC-HDA-030, 031, 032, 034) |
| `tests/fixtures/dispatch/golden/errors/spawn-failed.json` | edit | Deliberate golden update: `data.error.detail = { kind: "harness", code: "harness.spawn.refused" }` with no `field`; every other field byte-unchanged (TC-HDA-030, 033) |
| `tests/golden/dispatch-errors.test.ts` | run unchanged | Byte-equality consumer of the golden spawn-failure envelope; its scenario uses the no-field `harness.spawn.refused` failure (TC-HDA-033) |
| `tests/structure/harness-environment-marker.test.ts` | add | TC-HDA-001 |
| `tests/types/harness-environment-marker.type-test.ts` | add | TC-HDA-001 (picked up by the `tests/types/tsconfig.json` glob) |
| `tests/structure/dispatch-envelope-detail.test.ts` | add | TC-HDA-029 |
| `tests/types/dispatch-envelope-detail.type-test.ts` | add | TC-HDA-029 |
| `tests/types/dispatch-human-text-context.type-test.ts` | add | TC-HDA-032 (DM-4 two-parameter compatibility; picked up by the `tests/types/tsconfig.json` glob) |
| `tests/behaviour/harness-config.test.ts` | edit | TC-HDA-002, 005, 019, 020, 021 |
| `tests/behaviour/config-cli.test.ts` | edit | TC-HDA-022 |
| `tests/behaviour/harness-spawn-env.test.ts` | edit | TC-HDA-012–017 |
| `tests/behaviour/harness-spawn-credential.test.ts` | edit | TC-HDA-014, 018 |
| `tests/behaviour/harness-default-path.test.ts` | add | TC-HDA-011 |
| `tests/behaviour/dispatch-harness-default-spawn.test.ts` | add | TC-HDA-010, 012 |
| `tests/behaviour/dispatch-harness-default-detail.test.ts` | add | TC-HDA-030, 031, 032, 034, 035 |
| `tests/behaviour/dispatch-error-envelope.test.ts` | edit | TC-HDA-033 |
| `tests/structure/dispatch-composition.test.ts` | edit | TC-HDA-023 |
| `tests/structure/harness-neutrality.test.ts` | run unchanged | TC-HDA-004 |
| `tests/structure/harness-imports.test.ts` | run unchanged | TC-HDA-004 |
| `tests/checks/config-default-positions.test.ts` | run unchanged | TC-HDA-003 |
| `tests/checks/privacy-release.test.ts` | run unchanged | TC-HDA-006 |
| `tests/checks/harness-mutants.test.ts` | run unchanged | Delivered non-vacuity meta-check; its string anchors on `harness-spawn-env.ts` (76-84, 102-111) must survive the optional branch (TC-HDA-015) |
| `tests/behaviour/queue-production-binding.test.ts`, `tests/fixtures/queue/production/harness.ts` | run/update per plan | `TC-BIND-007` degradation risk: after the repair its `{ HOME, HARNESS_MODEL, HARNESS_SMALL_MODEL }` parent has no `PATH`, so dispatch fails pre-session on `harness.spawn.variable-missing: PATH` while its own assertions still pass; the implementation plan must add a synthetic `PATH` or restate the case as a queue-observation proof |
| `.changeset/gh-277-harness-default-allowlist-minor.md` | add | TC-HDA-006 (product/release metadata) |

**Product code (owned by the implementation plan; named here because the tests bind to these seams):**

| Path | Declared change |
|---|---|
| `packages/core/src/config/defaults.ts` | Replace `harness.environment` with `PATH`, `HOME`, `TMPDIR` (optional), `DELIVERY_WORK_PATH` |
| `packages/core/src/contracts/harness.ts` | Add `readonly optional?: boolean` to `HarnessEnvironmentVariable`; everything else unchanged |
| `packages/core/src/config/catalog.ts` | Add `optional: { type: "boolean" }` to `HARNESS_ENVIRONMENT_ENTRY` |
| `packages/core/src/config/harness.ts` | Accept `optional` as a boolean on a variable entry; reject non-boolean, marker+`credentialRef`, and unknown keys as `config.value.invalid`; keep `value` as `config.secret.forbidden`; carry the marker on `HarnessEnvironmentSetting` |
| `packages/core/src/domain/harness-spawn-env.ts` | Treat `entry.optional === true` as "omit when absent"; keep the delivered required path and record precedence |
| `packages/cli/src/production.ts` | Map the marker verbatim to the descriptor; keep the `DELIVERY_WORK_PATH` record injection and the bare `opencode` command |
| `packages/core/src/contracts/dispatch.ts` | Declare `DispatchEnvelopeError` as the delivered `CommandResultError` plus `detail?: { kind: "harness" \| "config"; code: string; field?: string }`; retype `DispatchEnvelopeData.error` to it; keep `CommandResultError` (`result.ts`) and every other envelope unchanged |
| `packages/core/src/app/dispatch.ts` | Preserve the underlying `HarnessFailure` on the pre-session spawn path and attach it as `error.detail` where `errorOf` assembles the dispatch error |
| `packages/cli/src/commands/dispatch.ts`, `packages/cli/src/output/dispatch-text.ts` | Select the bounded verbose diagnostic at the dispatch `humanText` seam (133-149) through the optional `HumanTextContext` context (DM-4) and render it in the dispatch text module; keep `renderDispatchText` at exactly four keys for non-verbose mode |
| `packages/cli/src/index.ts`, `packages/cli/src/output/serialize.ts` | Export `HumanTextContext = { readonly verbose: boolean }` (DM-4), widen `CommandDefinition.humanText` with the optional third parameter, and pass `{ verbose }` at the single call site (351-353) while keeping every two-parameter definition and two-argument call valid; keep `diagnosticFor` non-verbose-gated and the single redacted `writeOutput` path unchanged |
| `packages/core/dist/config/*` | Regenerate `config.schema.json`, `defaults-positions.json`, `schema-sources.json` |

### 7.2 TC → File / Command Mapping

Each row records the owning source anchor for any literal the scenario asserts. Fields that do not exist yet are anchored to spec v1.2 until the delivered contract lands (GAP-T2); spec line references in this table are for spec v1.2.

| TC ID | File(s) to create or update | Execution command | Source anchors | Status |
|---|---|---|---|---|
| TC-HDA-001 | `tests/structure/harness-environment-marker.test.ts`, `tests/types/harness-environment-marker.type-test.ts` | `bun test tests/structure/harness-environment-marker.test.ts`; `pnpm typecheck` | `packages/core/src/contracts/harness.ts:120-134, 144-148, 286-296` | To Implement |
| TC-HDA-002 | `tests/behaviour/harness-config.test.ts` | `bun test tests/behaviour/harness-config.test.ts` | `config/catalog.ts:276-284`; `config/schema.ts:19-33`; `config/harness.ts:110-134` | Existing – Update |
| TC-HDA-003 | `tests/checks/config-default-positions.test.ts` (unchanged), `scripts/checks/exports-parity.ts` (unchanged) | `bun test tests/checks/config-default-positions.test.ts`; `bun run scripts/checks/exports-parity.ts` | `scripts/checks/exports-parity.ts:23-24, 54-58, 117` | Existing – No Change (assertions already cover) |
| TC-HDA-004 | `tests/structure/harness-neutrality.test.ts`, `tests/structure/harness-imports.test.ts` (unchanged) | `bun test tests/structure/harness-neutrality.test.ts tests/structure/harness-imports.test.ts`; `pnpm check:boundaries` | `domain/harness-spawn-env.ts:38-67`; `harness-imports.test.ts:26-40` | Existing – No Change |
| TC-HDA-005 | `tests/behaviour/harness-config.test.ts`; `tests/fixtures/harness/config/default.resolved.json` | `bun test tests/behaviour/harness-config.test.ts` | `config/defaults.ts:58-62`; spec Appendix B 480-490 | Existing – Update |
| TC-HDA-006 | `tests/checks/privacy-release.test.ts` (unchanged); `.changeset/gh-277-harness-default-allowlist-minor.md` | `bun test tests/checks/privacy-release.test.ts` | `tests/checks/privacy-release.test.ts:42-49, 70-86, 133-175` | Existing – No Change; changeset To Add |
| TC-HDA-010 | `tests/behaviour/dispatch-harness-default-spawn.test.ts`; `tests/fixtures/harness/default-spawn.ts` | `bun test tests/behaviour/dispatch-harness-default-spawn.test.ts` | `cli/production.ts:423-447, 462-465`; `app/dispatch.ts:347-400` | To Implement |
| TC-HDA-011 | `tests/behaviour/harness-default-path.test.ts`; `tests/fixtures/harness/default-spawn.ts` | `bun test tests/behaviour/harness-default-path.test.ts` | `cli/production.ts:458-465`; `adapters/src/harness/opencode.ts:63-88, 281-300`; `contracts/harness.ts:259-264, 326-336, 373-377, 411-412`; `domain/harness-spawn-env.ts:46-58` | To Implement |
| TC-HDA-012 | `tests/behaviour/harness-spawn-env.test.ts`, `tests/behaviour/dispatch-harness-default-spawn.test.ts`; `tests/fixtures/harness/spawn-env.ts` | `bun test tests/behaviour/harness-spawn-env.test.ts tests/behaviour/dispatch-harness-default-spawn.test.ts` | `tests/fixtures/harness/spawn-env.ts:22-63`; `domain/harness-spawn-env.ts:44-66` | Existing – Update |
| TC-HDA-013 | `tests/behaviour/harness-spawn-env.test.ts` | `bun test tests/behaviour/harness-spawn-env.test.ts` | `config/defaults.ts:58-62`; spec Appendix A 466-476 | Existing – Update |
| TC-HDA-014 | `tests/behaviour/harness-spawn-env.test.ts`, `tests/behaviour/harness-spawn-credential.test.ts` | `bun test tests/behaviour/harness-spawn-env.test.ts tests/behaviour/harness-spawn-credential.test.ts` | `domain/harness-spawn-env.ts:46-58`; `contracts/harness.ts:286-296, 306-314` | Existing – Update |
| TC-HDA-015 | `tests/behaviour/harness-spawn-env.test.ts` | `bun test tests/behaviour/harness-spawn-env.test.ts` | `domain/harness-spawn-env.ts:46-58`; spec F-3 143 | Existing – Update |
| TC-HDA-016 | `tests/behaviour/harness-spawn-env.test.ts` | same | `domain/harness-spawn-env.ts:48`; spec F-3 143 | Existing – Update |
| TC-HDA-017 | `tests/behaviour/harness-spawn-env.test.ts` | same | `domain/harness-spawn-env.ts:42-48` | Existing – Update |
| TC-HDA-018 | `tests/behaviour/harness-spawn-credential.test.ts`; `tests/fixtures/harness/config/invalid-optional-credential.yaml` | `bun test tests/behaviour/harness-spawn-credential.test.ts` | `domain/harness-spawn-env.ts:60-64`; `contracts/harness.ts:127-131` | Existing – Update |
| TC-HDA-019 | `tests/behaviour/harness-config.test.ts`, `tests/behaviour/harness-spawn-env.test.ts` | `bun test tests/behaviour/harness-config.test.ts tests/behaviour/harness-spawn-env.test.ts` | `config/harness.ts:23-25, 130-133` | Existing – Update |
| TC-HDA-020 | `tests/behaviour/harness-config.test.ts`, `tests/behaviour/harness-spawn-env.test.ts` | same | `config/harness.ts:23-25, 130-133`; `domain/harness-spawn-env.ts:46-58` | Existing – Update |
| TC-HDA-021 | `tests/behaviour/harness-config.test.ts`; the three config fixtures | `bun test tests/behaviour/harness-config.test.ts` | `config/harness.ts:110-134`; `config/catalog.ts:276-284` | Existing – Update |
| TC-HDA-022 | `tests/behaviour/config-cli.test.ts`; `tests/fixtures/harness/config/optional-entry.yaml` | `bun test tests/behaviour/config-cli.test.ts` | `packages/cli/src/commands/config.ts:96-99, 102-155`; `config/provenance.ts:20-24`; spec AC-F6-3 398 | Existing – Update |
| TC-HDA-023 | `tests/structure/dispatch-composition.test.ts` | `bun test tests/structure/dispatch-composition.test.ts` | `cli/production.ts:423-447, 462-465`; `contracts/harness.ts:144-148` | Existing – Update |
| TC-HDA-029 | `tests/structure/dispatch-envelope-detail.test.ts`, `tests/types/dispatch-envelope-detail.type-test.ts` | `bun test tests/structure/dispatch-envelope-detail.test.ts`; `pnpm typecheck` | `contracts/dispatch.ts:277-296`; `contracts/result.ts:36-43`; `cli/index.ts:262-272`; spec DM-3 239, §8.5 261-271, Appendix C 516-540 | To Implement |
| TC-HDA-030 | `tests/behaviour/dispatch-harness-default-detail.test.ts`; `tests/fixtures/dispatch/harness.ts`; `tests/fixtures/dispatch/golden/errors/spawn-failed.json` (edit) | `bun test tests/behaviour/dispatch-harness-default-detail.test.ts`; `bun test tests/golden/dispatch-errors.test.ts` | `app/dispatch.ts:466-485`; `contracts/harness.ts:306-314`; `tests/fixtures/dispatch/harness.ts:158-162`; `tests/golden/dispatch-errors.test.ts:49-57` | To Implement |
| TC-HDA-031 | `tests/behaviour/dispatch-harness-default-detail.test.ts` | same | `cli/output/serialize.ts:41-49, 89-117`; `app/dispatch.ts:466-485` | To Implement |
| TC-HDA-032 | `tests/behaviour/dispatch-harness-default-detail.test.ts`; `tests/types/dispatch-human-text-context.type-test.ts` | `bun test tests/behaviour/dispatch-harness-default-detail.test.ts`; `pnpm typecheck` | `cli/commands/dispatch.ts:133-149`; `cli/output/dispatch-text.ts:28-34`; `cli/index.ts:51, 298-303, 317, 351-353`; `cli/output/serialize.ts:73, 89-115`; spec AC-F5-3 395, DM-4 240, NFR-7 282 | To Implement |
| TC-HDA-033 | `tests/behaviour/dispatch-error-envelope.test.ts`; `tests/golden/dispatch-errors.test.ts` (unchanged); `tests/fixtures/dispatch/golden/errors/spawn-failed.json` (edit) | `bun test tests/behaviour/dispatch-error-envelope.test.ts tests/golden/dispatch-errors.test.ts` | `app/dispatch.ts:185-200, 466-485`; `contracts/error-table.ts` spawn-failed row; `tests/golden/dispatch-errors.test.ts:49-57` | Existing – Update |
| TC-HDA-034 | `tests/behaviour/dispatch-harness-default-detail.test.ts` | `bun test tests/behaviour/dispatch-harness-default-detail.test.ts` | `contracts/dispatch.ts` (`DispatchEnvelopeError.detail`); spec NFR-6 281, AC-F5-5 395, Appendix C 494-505 | To Implement |
| TC-HDA-035 | `tests/behaviour/dispatch-harness-default-detail.test.ts`, `tests/behaviour/dispatch-harness-default-spawn.test.ts` | `bun test tests/behaviour/dispatch-harness-default-detail.test.ts` | `domain/harness-spawn-env.ts:49-56`; `app/dispatch.ts:466-485` | To Implement |
| TC-HDA-100 | §6.3 procedure; no test file | Manual: §6.3 steps 0–7 under the isolated probe state root | spec AC-F8-1 404, F-8 148, §18 417-424 | Manual Only |
| TC-HDA-101 | §6.3 procedure; no test file | Manual: §6.3 steps 0–8 + git-clean/HEAD snapshots + probe-root evidence | spec AC-F8-2 405, RSK-6 305 | Manual Only |

**Blast-radius notes.**

- `tests/fixtures/dispatch/golden/errors/spawn-failed.json` is a delivered byte-pinned artifact, not a new fixture: its scenario failure is `{ kind: "harness", code: "harness.spawn.refused" }` with no `field`, so under the always-present attachment rule it gains `data.error.detail = { kind: "harness", code: "harness.spawn.refused" }` and nothing else. The golden must be regenerated from the delivered envelope (including key order, which byte equality observes), not hand-inserted; `tests/golden/dispatch-errors.test.ts` stays unchanged and must pass; editing the golden without reviewing that diff is a review item.
- `tests/fixtures/queue/production/harness.ts` needs a synthetic `PATH` (or a restated `TC-BIND-007` scope) in the implementation plan; otherwise that delivered test still passes for the wrong reason after the default repair.
- `tests/checks/harness-mutants.test.ts` must keep its string anchors on `harness-spawn-env.ts` (76-84, 102-111) through the optional branch; a moved anchor turns the mutant into a no-op.

**Sequencing notes.**

1. Contract and config shape first (TC-HDA-001/002/003/029 unblock everything).
2. Repaired defaults and fixtures second (TC-HDA-005, `default-spawn.ts`, the updated descriptor) so the behaviour suites are written against the repaired set from the first run.
3. Builder projection (required/optional/precedence/credential) next; run the narrow builder suites between steps.
4. Composition mapping and the synthetic-child spawn; then dispatch detail and rendering.
5. Release changeset last, so the `TC-RELEASE-001` gate is green only when the code is complete.
6. Never delete a delivered assertion to make a new case pass; an assertion that must change is a design signal and a review item.

### 7.3 Mutation Evidence (Executable)

Each anti-recurrence claim has a named mutation that must turn a named test red. The delivery (or reviewer) applies the mutation in a scratch copy, runs the command, records the failure, and reverts with `git checkout -- FILE`. No mutation is committed. Every mutation has a green baseline before it is applied and a green restore after it is reverted.

| # | Claim (behavioural rule) | Concrete mutation | Command | Must go red (assertion) | TC that goes red |
|---|---|---|---|---|---|
| M-1 | The shipped default is the viable set | Restore the old `HARNESS_MODEL`/`HARNESS_SMALL_MODEL` list (or drop `PATH`) | `bun test tests/behaviour/harness-config.test.ts tests/behaviour/dispatch-harness-default-spawn.test.ts` | Expected required/optional set mismatch; default spawn fails `harness.spawn.variable-missing` | TC-HDA-005, TC-HDA-010 |
| M-2 | Required absence fails closed | Treat every absent declared variable as optional (omit it) | `bun test tests/behaviour/harness-spawn-env.test.ts` | `ok` is true where `ok:false` and `harness.spawn.variable-missing` are expected | TC-HDA-014 |
| M-3 | Optional absence is omitted | Treat the optional marker as required (or ignore it) | `bun test tests/behaviour/harness-spawn-env.test.ts` | Absent `TMPDIR` fails instead of building; key-present assertions fail | TC-HDA-015 |
| M-4 | Optional presence is forwarded | Drop a present optional entry from the child | `bun test tests/behaviour/harness-spawn-env.test.ts` | `child.TMPDIR` is undefined where the parent value is expected | TC-HDA-016 |
| M-5 | Credentials stay strictly required | Make the credential branch tolerate an unresolved reference (or accept `optional` on a credential entry) | `bun test tests/behaviour/harness-spawn-credential.test.ts tests/behaviour/harness-config.test.ts` | `config.credential.missing` missing; the marker+`credentialRef` case resolves `ok:true` | TC-HDA-018, TC-HDA-021 |
| M-6 | Deny-by-default / no ambient leakage | Spread the parent environment into the child (`{ ...parentEnvironment, ...built }`) | `bun test tests/behaviour/harness-spawn-env.test.ts tests/behaviour/dispatch-harness-default-spawn.test.ts` | The undeclared canary appears in the child; the canary serialization assertion fails | TC-HDA-012, TC-HDA-004 |
| M-7 | Record value wins | Invert precedence to `parentEnvironment[name] ?? record?.[name]` | `bun test tests/behaviour/harness-spawn-env.test.ts` | The record value assertion fails (parent value returned) | TC-HDA-017 |
| M-8 | Bare command resolves through `PATH` | Remove `PATH` from the child (or pass an absolute command path) | `bun test tests/behaviour/harness-default-path.test.ts` | The marker file is absent / spawn fails; the absolute-path assertion fails | TC-HDA-011, TC-HDA-010 |
| M-9 | Underlying detail is carried on the dispatch-specific type | Do not attach `detail` on the pre-session branch (or attach only `code`, or omit `kind`), or move the detail onto the shared `CommandResultError` | `bun test tests/behaviour/dispatch-harness-default-detail.test.ts tests/structure/dispatch-envelope-detail.test.ts tests/golden/dispatch-errors.test.ts` | `data.error.detail` is absent or missing `kind`/`code`; the no-field case still requires kind and code; the golden byte-equality fails (TC-ERR-004); the anti-widening assertion fails on the shared error type | TC-HDA-029, TC-HDA-030, TC-HDA-031; delivered `TC-ERR-004` |
| M-10 | Verbose human output names the detail at the dispatch human-text seam | Remove the verbose selection at `packages/cli/src/commands/dispatch.ts:133-149` (keep only the non-verbose four-key text) | `bun test tests/behaviour/dispatch-harness-default-detail.test.ts` | The underlying code/field strings are absent from verbose stdout | TC-HDA-032 |
| M-11 | Non-verbose text stays four keys | Add a fifth key (e.g. `detail=`) to `renderDispatchText` | same | The exactly-four-lines/keys assertion fails | TC-HDA-032 |
| M-12 | Identity and last message unchanged | Change `lastMessage` to `spawn failed`, or add a new error-table/delivery-result token | `bun test tests/behaviour/dispatch-error-envelope.test.ts` | The exact-sentence assertion or the vocabulary-set assertion fails | TC-HDA-033 |
| M-13 | Detail is identifiers-only and bounded | Interpolate a parent value into `field`, or remove the 256-character bound | `bun test tests/behaviour/dispatch-harness-default-detail.test.ts` | The value-leak or length assertion fails | TC-HDA-034 |
| M-14 | Catalog/schema admits the marker | Remove `optional` from `HARNESS_ENVIRONMENT_ENTRY` | `bun test tests/behaviour/harness-config.test.ts` | The schema property assertion fails; a valid optional entry classifies `config.value.invalid` | TC-HDA-002 |
| M-15 | Non-boolean marker is invalid | Coerce any truthy marker (`Boolean(entry.optional)`) | `bun test tests/behaviour/harness-config.test.ts` | `optional: "yes"` resolves `ok:true` instead of `config.value.invalid` | TC-HDA-021 |
| M-16 | Artifacts parity | Edit `defaults.ts` and do not regenerate `config.schema.json`/`defaults-positions.json` | `bun test tests/checks/config-default-positions.test.ts` | `checkConfigArtifacts` returns a named drift entry | TC-HDA-003 |
| M-17 | Empty config resolves the repaired default | Remove `harness.environment` from `PRODUCTION_DEFAULTS` | `bun test tests/behaviour/harness-config.test.ts` | The resolved default assertion fails (empty/absent) | TC-HDA-005 |
| M-18 | `{ name }` keeps required semantics | Default the marker to optional when absent | `bun test tests/behaviour/harness-config.test.ts tests/behaviour/harness-spawn-env.test.ts` | The absent `{ name }` entry succeeds instead of failing closed | TC-HDA-020, TC-HDA-014 |
| M-19 | Composition maps the marker and injects the work path | Drop the marker in `harnessEnvironmentEntries`, or stop injecting `DELIVERY_WORK_PATH` | `bun test tests/structure/dispatch-composition.test.ts` | The descriptor entry has no `optional:true`, or the child work path is absent | TC-HDA-023 |
| M-20 | Release invariant | Remove the added changeset, change one package to `patch`, add `testkit`, or empty the body | `bun test tests/checks/privacy-release.test.ts` | `TC-RELEASE-001` fails with the corresponding message | TC-HDA-006 |

**Non-vacuity note.** TC-HDA-011's off-PATH control, TC-HDA-013's pre-change descriptor control, TC-HDA-015's marker-removal control, TC-HDA-021's literal-value control, and TC-HDA-034's over-bound/over-line control run inside CI, so the assertions cannot pass for the wrong reason even if no delivery-time mutation is recorded. The delivered `tests/checks/harness-mutants.test.ts` is the repository's own mutation meta-check and runs unchanged in §6.4; its exact-string anchors on `packages/core/src/domain/harness-spawn-env.ts:76-84, 102-111` must survive the optional branch or it fails with "mutant … passed". M-1..M-20 are the delivery-time evidence recorded in §10.

### 7.4 Gate Commands

```bash
# Narrow suites while iterating
bun test tests/behaviour/harness-spawn-env.test.ts \
         tests/behaviour/harness-spawn-credential.test.ts \
         tests/behaviour/harness-config.test.ts \
         tests/behaviour/config-cli.test.ts
bun test tests/behaviour/harness-default-path.test.ts \
         tests/behaviour/dispatch-harness-default-spawn.test.ts \
         tests/behaviour/dispatch-harness-default-detail.test.ts
bun test tests/structure/harness-environment-marker.test.ts \
         tests/structure/dispatch-envelope-detail.test.ts \
         tests/structure/dispatch-composition.test.ts \
         tests/structure/harness-neutrality.test.ts \
         tests/structure/harness-imports.test.ts
bun test tests/behaviour/dispatch-error-envelope.test.ts
bun test tests/golden/dispatch-errors.test.ts
bun test tests/checks/config-default-positions.test.ts tests/checks/privacy-release.test.ts tests/checks/harness-mutants.test.ts
bun test tests/behaviour/queue-production-binding.test.ts

# Type and boundaries
pnpm typecheck
pnpm check:boundaries
pnpm check:privacy-literals

# Aggregate gate (CI parity; repo-local TMPDIR)
TMPDIR=$PWD/tmp/tmpdir pnpm check
```

## 8. Risks, Assumptions, and Open Questions

### 8.1 Testing Risks

| ID | Testing risk | Mitigation |
|----|--------------|------------|
| R-T1 | The repaired default is "proven" with a fixture that still declares the model variables, so the suite passes the original defect. | TC-HDA-005 asserts the exact set; TC-HDA-013 runs the pre-change descriptor as a negative control; TC-HDA-010 spawns the synthetic CLI over the repaired default and asserts a non-spawn-failed token. |
| R-T2 | PATH resolution is "proven" with an absolute command path, so the child never exercises the declared `PATH`. | TC-HDA-011 invokes the bare name and asserts no argument/command is absolute; the off-PATH control must fail; TC-HDA-010 reads the fake CLI's argv[0] basename. |
| R-T3 | The fake CLI is too permissive and receives an ambient environment, hiding a leakage defect. | The synthetic CLI dumps its environment; TC-HDA-012 asserts the exact key set and the canary absence in the real child, not only in the builder result. |
| R-T4 | The optional marker is proven only on a synthetic descriptor and never reaches configuration or composition. | TC-HDA-002 (catalog/schema), TC-HDA-021 (validation), TC-HDA-022 (inspection), TC-HDA-023 (composition) cover the full path. |
| R-T5 | The dispatch detail assertion invents a field the contract does not carry, assumes a detail-less pre-session variant, or widens the shared error type. | TC-HDA-029 reads the delivered `DispatchEnvelopeError` and asserts `CommandResultError` stays at six fields while every other envelope keeps its six-field error; TC-HDA-030 asserts the always-present detail, the no-field `harness.spawn.refused` case, and the byte-exact golden; §3.5 anchors the named type to spec v1.2 DM-3/Appendix C until the contract lands (GAP-T2). |
| R-T6 | The four-key text contract is weakened to make verbose output easy, the verbose detail is smuggled onto the shared stderr diagnostic, or the DM-4 type widening breaks a two-parameter definition. | TC-HDA-032 asserts exactly four lines/keys without verbose, asserts the detail is verbose-only on the dispatch human-text channel, asserts stderr carries no dispatch detail, and runs `pnpm typecheck` over a two-parameter definition and a direct two-argument call; M-11 proves a fifth key goes red and M-10 the verbose seam. |
| R-T7 | A redaction gap leaks a value through the new detail. | TC-HDA-031 registers a synthetic secret and asserts its absence from the serialized JSON; TC-HDA-034 asserts identifiers-only and no value. |
| R-T8 | A mutation is applied and not reverted, or a mutant is committed. | Every mutation runs in a scratch copy or is reverted with `git checkout --`; §10 records "Restored: Green"; the final `pnpm check` runs on a clean tree. |
| R-T9 | The end-to-end proof starts a nested lifecycle that mutates this worktree, writes the live state root, or runs for hours. | §6.3: disposable clone, probe-only brand state root (`DELIVERY_OS_WORKING_NAME=gh277-probe` → `$LIVE_HOME/.gh277-probe-state`), read-only live lease precondition with STOP, `pgrep -P` child scoping, ≤180 s bound, zero-config assertion, git-clean/`HEAD` snapshots (TC-HDA-101). |
| R-T10 | The end-to-end proof fails for an unrelated reason (missing auth, unparseable origin, missing queue entry, active live lease) and is misread as a product regression. | §6.3 preconditions (token, `gh auth status`, tracker probe, origin, probe-root `queue add`, live-lease STOP) and an explicit STOP rule separate a blocked precondition from a product FAIL. |
| R-T11 | The generated artifacts are regenerated blindly, hiding a real schema/defaults change. | TC-HDA-003 compares source hashes and reads the generated schema; generation is a reviewed step, never a test fix (§6.5). |
| R-T12 | Changing the existing spawn-env fixture deletes the undeclared canary or the delivered assertions to make the new default pass. | TC-HDA-012 requires a genuine undeclared canary after `HOME` becomes declared; §7.2 marks the fixture edit as "Existing – Update" and review must reject a deleted assertion. |
| R-T13 | The byte-pinned golden spawn-failure envelope is forgotten (delivered `TC-ERR-004` fails) or updated without applying the attachment rule (the envelope pin drifts). | §7.1/§7.2 name the golden and its consumer; TC-HDA-030 step 9 and TC-HDA-033 step 7 assert the byte-exact repaired shape with `harness.spawn.refused` and no `field`; M-9 includes the golden in its command. |
| R-T14 | Existing fixtures silently degrade after the default repair: `TC-BIND-007` no longer reaches a spawn because its parent lacks `PATH`, and `tests/checks/harness-mutants.test.ts` string anchors could become no-ops. | §6.4 and §7.1 name both as run-unchanged regressions with their failure modes; the implementation plan must add a synthetic `PATH` or restate `TC-BIND-007`, and the optional branch must preserve the mutation anchors. |

### 8.2 Assumptions

- The installed CLI is a healthy version of `opencode` on the POSIX profile; GH-275 verified the `run --format json` JSONL shape at v2.2.5, and this proof records the observed version rather than pinning it.
- The parent environment is trusted and has `PATH` and `HOME`; a `PATH` containing user-controlled directories is the operator's existing trust decision.
- `TMPDIR` is legitimately absent on the supported Linux profile and present on many macOS shells; the suite covers both and the real proof runs with it unset.
- The synthetic `opencode` script is a valid proxy for command resolution, environment construction, attempt recording, and classification; one bounded real dispatch is the end-to-end proof of the real harness.
- `pnpm build` has run before the artifact-parity and exports checks; the aggregate gate's `pretypecheck`/`pretest` hooks build again.
- `origin/main-tools` is fetched before the `TC-RELEASE-001` check so its merge base exists.
- The production GitHub instance resolves the literal `GITHUB_TOKEN` environment variable (as GH-275 recorded), so the E2E procedure exports it explicitly.
- The attempt ledger path is `$HOME/.delivery-os-state/ledger.default.jsonl` under the default working name, as GH-275 recorded; the E2E probe runs under the probe brand `gh277-probe`, so its ledger is `$HOME/.gh277-probe-state/ledger.default.jsonl` and the live path is read-only.
- The dispatch detail is typed by spec v1.2 DM-3 as `DispatchEnvelopeError["detail"]`; it is always present on the pre-session path with required `kind` (`"harness" | "config"`) and `code`, and optional `field`; the 256-character bound is fixed by the spec and the implementation may choose the constant's name (GAP-T2).
- The verbose diagnostic channel is fixed by spec v1.2: the dispatch command's `humanText` seam selects it through the optional `HumanTextContext` third parameter (DM-4) and the dispatch text module renders it; the shared stderr `diagnosticFor` stays non-verbose-gated (GAP-T4, GAP-T5, OQ-T3 closed).
- The configuration inspection surface is the delivered `config get harness.environment --show-origin`, returning the `originLabel` string (OQ-T4 closed).

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Resolution path / status |
|----|----------|-----------|-------|--------------------------|
| OQ-T1 | Does opencode require a boot variable beyond `PATH`, `HOME`, and optionally `TMPDIR` on the supported POSIX profile? | No | `@coder` / owner | Carried from spec OQ-2. The §6.3 real proof is the evidence source. If a new required variable appears, land it in the default set (required, or optional when legitimately absent) before the PR is finalized, and re-run TC-HDA-100. |
| OQ-T2 | Does the synthetic CLI need its interpreter directory on the declared `PATH`, or can it use an absolute shebang? | No | `@coder` | Delivery-bound. Either is acceptable as long as the positive case invokes the bare name and the negative case removes the temp bin from `PATH`. The plan does not fix the script interpreter. |
| OQ-T3 | Is the verbose human diagnostic emitted on the delivered diagnostic/error stream or in the human text? | No | `@spec-writer` (resolved) | **Resolved by spec v1.2 §2.1/§16 and Appendix D**: it is the dispatch human-text channel — selected at `packages/cli/src/commands/dispatch.ts:133-149` through the optional `HumanTextContext` third parameter (DM-4), rendered in `packages/cli/src/output/dispatch-text.ts`, with `--verbose` parsed at `packages/cli/src/index.ts:317` and passed at the human-text call site (351-353). The shared stderr `diagnosticFor` stays non-verbose-gated. TC-HDA-032 asserts stdout detail, the two-parameter compatibility clause under `pnpm typecheck`, no dispatch detail on stderr, and the four-key non-verbose text. |
| OQ-T4 | Does the config inspection need the delivered `config` command or the source bin in the disposable clone? | No | `@spec-writer` (resolved) | **Resolved by spec v1.2 AC-F6-3/§8.3**: the surface is `config get harness.environment --show-origin` (`packages/cli/src/commands/config.ts:96-155`). TC-HDA-022 asserts the command, the four entries, the `TMPDIR` marker, and the `layer=defaults` origin; §6.3 step 1b runs the same command in the disposable clone via `bun packages/cli/bin/delivery-os.ts`. |
| OQ-T5 | Should the real proof pin the opencode version to the GH-275-verified 2.2.5? | No | `@pm` | No. The spec requires a healthy installed CLI; the procedure records the version and treats a version mismatch as context, not a product failure. |

**Spec gaps discovered during test planning and DoR iteration 1 (resolved in spec v1.1/v1.2, reported not edited here).** The four gaps this plan raised against spec v1.0 are closed in v1.1 (governing TDR, verbose seam, dispatch error type, inspection surface). The test-planning DoR iteration-1 gaps are closed in v1.2: DM-4 declares the additive optional `HumanTextContext`; F-5/Appendix C state the always-present pre-session attachment rule (`kind` and `code` required, `field` only when carried); and §17.1 defines the Definition of Done. No gap remains open against the plan.

- Spec `links.decisions` and the §13 "Governed by" row list `TDR-0017` alongside `TDR-0008`/`TDR-0016`.
- Spec §16 names the verbose rendering seam the plan asserts: the dispatch command's human-text selection (`packages/cli/src/commands/dispatch.ts:133-149`) through the optional `HumanTextContext` (DM-4), with `--verbose` parsed at `packages/cli/src/index.ts:317`, passed at the call site (351-353), and the shared stderr `diagnosticFor` unchanged.
- Spec DM-3/§8.3/§8.5/§16/Appendix C name `DispatchEnvelopeError` and keep `CommandResultError` and every other envelope at their delivered shape.
- Spec F-5/Appendix C/AC-F5-1 fix the detail-attachment rule: the detail is always present on the pre-session path, with `kind` and `code` required and `field` optional; there is no detail-less pre-session variant.
- Spec AC-F6-3/§8.3 name `config get harness.environment --show-origin` as the inspection surface.
- Spec §17.1 binds all 29 ACs, all 29 TCs, NFR-1..NFR-9, M-1..M-20, the single changeset, the bounded real dispatch, and the gate battery to named evidence; this plan's §10 is the execution-log evidence.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-09 | @test-plan-writer | Initial test plan for GH-277. 29 scenarios cover all 29 ACs (AC-F1-1..AC-F8-2), all nine NFRs, DEC-1..DEC-6, DM-1..DM-3, RSK-1..RSK-8, and TDR-0017 C-1..C-8: the viable zero-configuration default allowlist, the variable-only optional marker with fail-closed required absence and strict credentials, deny-by-default with a real-child canary, record-over-parent precedence, config/schema/artifact parity, the additive dispatch `data.error.detail` in JSON and verbose output with the four-key non-verbose contract and unchanged spawn-failed identity, detail hygiene bounds, the `TC-RELEASE-001` changeset invariant, and one bounded operator-run real dispatch in a disposable clone. Every asserted literal is anchored to an executed source read in §3.5 and §7.2; new detail fields are anchored to the spec until the contract lands (GAP-T2). The plan includes 20 named mutants (M-1..M-20) with red/green controls, the repo-local `TMPDIR=$PWD/tmp/tmpdir pnpm check` aggregate gate, the privacy-literal constraint, and a per-phase execution-evidence skeleton. |
| 1.1 | 2026-11-09 | @test-plan-writer | Aligned with change spec v1.1 and TDR-0017; no TC id, AC mapping, or coverage row removed. OQ-T3 closed: TC-HDA-032 (and §1.2 GAP-T4, §1.4 row 13, §3.5, §4, §7.1–7.3, §8) now asserts the named verbose seam — `--verbose` parsed at `packages/cli/src/index.ts:317`, consumed by `writeOutput` (`serialize.ts:73, 97-113`), dispatch human text selected at `commands/dispatch.ts:133-149`, rendered in `output/dispatch-text.ts` — with the non-verbose exact-four-key assertion unchanged and no dispatch detail on the shared stderr `diagnosticFor`. OQ-T4 closed: TC-HDA-022 now uses `config get harness.environment --show-origin` (`commands/config.ts:96-155`, `originLabel` `layer=defaults …`) and §6.3 step 1a runs the same command. GAP-T2 anchored: TC-HDA-029 names `DispatchEnvelopeError` (the six-field `CommandResultError` plus optional `detail { kind: "harness" \| "config"; code; field? }`), adds the anti-widening assertion that `CommandResultError` itself is not widened and every other envelope keeps its six-field error, and TC-HDA-030/031/034 reference that named type. Spec line references re-anchored to v1.1; resolved spec gaps recorded in §8.3. |
| 1.2 | 2026-11-09 | @test-plan-writer | DoR iteration-1 remediation; no TC id, AC mapping, or coverage row removed; 29 scenarios and 29 ACs remain. B-3: TC-HDA-030 step 8 replaces the unreachable detail-less case with the reachable `harness.spawn.refused` failure (`kind` and `code`, no `field`), asserting `field` is omitted while `kind`/`code` are present, and every detail assertion now follows spec v1.2 F-5/Appendix C (detail always present on the pre-session path; `kind`/`code` required; `field` optional). B-4: §6.3 runs under the probe-only brand `gh277-probe` with state root `$LIVE_HOME/.gh277-probe-state`, never touches the live root, never releases a live lease, STOPs if a live `GH-277` lease exists, and records evidence from the probe root. B-5: TC-HDA-101/§6.3 replace "byte-identical" with git-clean `git status --porcelain` plus unchanged `HEAD`, noting that `pnpm build` rewrites gitignored dist and the clone symlinks `node_modules`. Minors: queue-entry preconditions added to TC-HDA-010/035; TC-HDA-010's parent environment now includes the §6.1 canaries while keeping the exact child-key-set assertion; TC-HDA-011 steps use the delivered `HarnessSessionPort.spawn(input)` shape and assert the runner's `(file, args)` record; the golden `tests/fixtures/dispatch/golden/errors/spawn-failed.json` and its consumer are named in §7.1/§7.2/§7.3 with the `harness.spawn.refused` no-field detail; `tests/fixtures/queue/production/harness.ts`/`TC-BIND-007` and `tests/checks/harness-mutants.test.ts` anchors are recorded as regression risks; TC-HDA-032/DM-4 adds the `HumanTextContext` coverage with the two-parameter compatibility clause under `pnpm typecheck`. |

## 10. Test Execution Log

Execution window: TBD (the coder fills one row per phase as scenarios run). Branch: `fix/GH-277/harness-default-allowlist`.
Runtime: Bun 1.4.4 (repo pin), pnpm 10.18.3, the recorded `opencode` version from §6.3.

**How to fill.** Replace `Pending` with `Pass` or `Fail` and the run date as each scenario is executed; a Fail row names the failing assertion and the reopened phase. A `Manual` row is filled only from the §6.3 evidence. Do not mark a row `Pass` from a narrow suite when the scenario's command includes the aggregate gate.

| TC ID | Phase | Run Date | Result | Notes |
|---|---|---|---|---|
| TC-HDA-001 | delivery | TBD | Pending | Contract/type and data-only scan |
| TC-HDA-002 | delivery | TBD | Pending | Catalog/schema admission and rejections |
| TC-HDA-003 | delivery | TBD | Pending | Config artifact parity |
| TC-HDA-004 | delivery | TBD | Pending | Ambient/secret/child-process confinement |
| TC-HDA-005 | delivery | TBD | Pending | Exact shipped default and `defaults` origins |
| TC-HDA-006 | delivery | TBD | Pending | `TC-RELEASE-001` changeset invariant |
| TC-HDA-010 | delivery | TBD | Pending | Zero-config synthetic spawn; attempt + token |
| TC-HDA-011 | delivery | TBD | Pending | Bare-command PATH resolution + off-PATH control |
| TC-HDA-012 | delivery | TBD | Pending | Ambient canary and `OC_ADOS_*` absence |
| TC-HDA-013 | delivery | TBD | Pending | Model variables unset; no required failure |
| TC-HDA-014 | delivery | TBD | Pending | Required absence names `field`, no child |
| TC-HDA-015 | delivery | TBD | Pending | Optional absent omitted |
| TC-HDA-016 | delivery | TBD | Pending | Optional present forwarded |
| TC-HDA-017 | delivery | TBD | Pending | Record precedence |
| TC-HDA-018 | delivery | TBD | Pending | Credential fail-closed; no bypass |
| TC-HDA-019 | delivery | TBD | Pending | Explicit `HARNESS_MODEL` required semantics |
| TC-HDA-020 | delivery | TBD | Pending | `{ name }` compatibility |
| TC-HDA-021 | delivery | TBD | Pending | Marker validation matrix |
| TC-HDA-022 | delivery | TBD | Pending | `config get harness.environment --show-origin` inspection |
| TC-HDA-023 | delivery | TBD | Pending | Composition mapping and work-path injection |
| TC-HDA-029 | delivery | TBD | Pending | `DispatchEnvelopeError` shape; `CommandResultError`/other envelopes not widened |
| TC-HDA-030 | delivery | TBD | Pending | Always-present detail; no-field `harness.spawn.refused` case; golden byte-equality |
| TC-HDA-031 | delivery | TBD | Pending | JSON detail survives redaction |
| TC-HDA-032 | delivery | TBD | Pending | Verbose detail at the dispatch human-text seam; DM-4 two-parameter clause under `pnpm typecheck`; non-verbose four keys |
| TC-HDA-033 | delivery | TBD | Pending | Identity/token/exit/last message unchanged |
| TC-HDA-034 | delivery | TBD | Pending | Detail identifiers-only, single-line, ≤256 |
| TC-HDA-035 | delivery | TBD | Pending | Field in harness failure and dispatch detail |
| TC-HDA-100 | delivery/verification | TBD | Pending | Manual §6.3 real dispatch |
| TC-HDA-101 | delivery/verification | TBD | Pending | Manual §6.3 bounds, isolated probe root, git-clean/HEAD isolation |

**Mutation evidence (M-1..M-20).** Each mutation is applied in a scratch copy or in place with a recorded revert; no mutant is committed.

| # | Mutation | Observed red | Restored |
|---|---|---|---|
| M-1 | Old default list restored / `PATH` dropped | TC-HDA-005, TC-HDA-010 | Green |
| M-2 | Absent required treated as optional | TC-HDA-014 | Green |
| M-3 | Optional marker treated as required | TC-HDA-015 | Green |
| M-4 | Present optional dropped | TC-HDA-016 | Green |
| M-5 | Credential optional / bypass | TC-HDA-018, TC-HDA-021 | Green |
| M-6 | Parent environment spread into child | TC-HDA-012, TC-HDA-004 | Green |
| M-7 | Record precedence inverted | TC-HDA-017 | Green |
| M-8 | `PATH` removed / absolute command path | TC-HDA-011, TC-HDA-010 | Green |
| M-9 | Detail not attached / shared type widened / golden not refreshed | TC-HDA-029, TC-HDA-030, TC-HDA-031; delivered `TC-ERR-004` | Green |
| M-10 | Verbose selection removed at the dispatch human-text seam | TC-HDA-032 | Green |
| M-11 | Fifth text key added | TC-HDA-032 | Green |
| M-12 | Last message or vocabulary changed | TC-HDA-033 | Green |
| M-13 | Value interpolated / bound removed | TC-HDA-034 | Green |
| M-14 | `optional` removed from catalog | TC-HDA-002 | Green |
| M-15 | Truthy marker coerced | TC-HDA-021 | Green |
| M-16 | Defaults edited, artifacts not regenerated | TC-HDA-003 | Green |
| M-17 | `harness.environment` default removed | TC-HDA-005 | Green |
| M-18 | `{ name }` defaulted to optional | TC-HDA-020, TC-HDA-014 | Green |
| M-19 | Composition drops marker or work-path injection | TC-HDA-023 | Green |
| M-20 | Changeset removed/patched/testkit/empty body | TC-HDA-006 | Green |

**End-to-end evidence (§6.3, AC-F8-1/AC-F8-2).** Fill from the recorded run. **Evidence root:** all probe facts below come from the isolated probe state root `$LIVE_HOME/.gh277-probe-state` (retained copies in `/tmp/opencode/gh277-e2e-evidence`), never the live `$HOME/.delivery-os-state`.

- Preconditions: `opencode` version TBD; `gh auth status` green; `GITHUB_TOKEN` non-empty; tracker probe exit TBD; live `GH-277` lease present: TBD (must be none, else STOP).
- Step 1a isolated probe brand/state root: `DELIVERY_OS_WORKING_NAME` TBD (must be `gh277-probe`); `PROBE_STATE` TBD (must be `$LIVE_HOME/.gh277-probe-state`, not the live root).
- Step 1b zero-configuration default: `config get harness.environment --show-origin` value TBD; origin TBD (expected `layer=defaults …`).
- Step 1c parent facts: `TMPDIR` TBD; `command -v opencode` TBD; parent model variables TBD.
- Step 1d first event: TBD ms (must be ≤60 000) with a top-level `sessionID`.
- Step 5 handle window: child observed after TBD ms; dispatch alive: TBD.
- Step 7 envelope: `data.result` TBD; `data.lastMessage` TBD; `data.error.code` TBD; `data.error.detail` TBD; `exit` TBD.
- Step 7 attempt record (from the probe root): `attemptId` TBD; `token` TBD; `outcome` TBD; `evidenceRefs` TBD (must contain `attempt:ATTEMPT_ID`).
- Step 7a lease (probe root): no active `GH-277` lease on `github.com/juliusz-cwiakalski/agentic-delivery-os`: TBD.
- Step 8 isolation: this worktree's `git status --porcelain` TBD (must be empty); `HEAD` before/after TBD (must be equal); elapsed TBD ms (≤180 000); clone removed TBD; no surviving child TBD; live root written TBD (must be none).
- Cleanup: probe evidence retained in `/tmp/opencode/gh277-e2e-evidence`; disposable clone removed; probe-brand state/config roots (`$LIVE_HOME/.gh277-probe-state`, `$LIVE_HOME/.gh277-probe`) removed; live `$HOME/.delivery-os-state` untouched.
