---
change:
  ref: GH-277
  type: fix
  status: Proposed
  version: 1.8
  slug: harness-default-allowlist
  title: "Make the default harness spawn allowlist able to start opencode without user configuration"
  owners: [engineering]
  service: delivery-os harness adapters
  labels: [change, harness, bug, dispatch]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: medium
  last_updated: 2026-11-10
  dependencies:
    internal: [harness adapter contract, deny-by-default spawn-environment builder, configuration layer, CLI production composition, host spawn seams, dispatch engine, CLI dispatch output, harness and dispatch test fixtures]
    external: [opencode CLI]
links:
  decisions: ["TDR-0008", "TDR-0016", "TDR-0021"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make a zero-configuration installation able to spawn the default opencode harness by shipping a viable deny-by-default spawn allowlist, by removing the two model variables that no environment sets, by distinguishing required from optional allowlist entries, and by surfacing the underlying harness failure identity when a spawn still fails.

## 1. SUMMARY

Replace the shipped `harness.environment` default from `HARNESS_MODEL`, `HARNESS_SMALL_MODEL`, and `DELIVERY_WORK_PATH` with a set that can actually start the default harness: `PATH` and `HOME` as required entries, `TMPDIR` as an optional entry, and the existing `DELIVERY_WORK_PATH` injection. Add an additive optional marker to a declared variable entry so an allowlisted variable that is legitimately absent (notably `TMPDIR` on Linux) is omitted instead of aborting the whole spawn, while an absent required entry still fails closed and names the variable.

Remove `HARNESS_MODEL` and `HARNESS_SMALL_MODEL` from the default required set and do not fabricate a mapping from `OC_ADOS_MAIN_MODEL` or `OC_ADOS_SMALL_MODEL`: no repository code consumes the `HARNESS_*` names and opencode resolves its own models. Deny-by-default is unchanged: the child receives only declared entries, never ambient inheritance.

When a spawn still fails, dispatch keeps the delivered `dispatch.session.spawn-failed` identity and last message but carries the underlying harness failure `kind` and `code`, plus `field` when the failure carries one, in an additive detail on the dispatch error, visible in machine JSON and in verbose human output, so operators no longer need source to diagnose a spawn failure. Verbose human selection receives the parsed `--verbose` fact through an additive optional context on the published command-definition human-text seam.

## 2. CONTEXT

### 2.1 Current State Snapshot

The typed harness stack is delivered on the integration branch. Configuration resolves a typed `harness` branch, the production composition maps its allowlist onto an execution-environment descriptor, the deny-by-default builder constructs the child environment, the adapter spawns the configured harness, and dispatch records one attempt and classifies the result.

The shipped defaults declare only three allowlist names:

```
harness.environment:
  - HARNESS_MODEL
  - HARNESS_SMALL_MODEL
  - DELIVERY_WORK_PATH
```

The relevant delivered behaviour:

| Component | Location | Observed behaviour |
|---|---|---|
| Shipped defaults | `packages/core/src/config/defaults.ts:45-63` | `harness.environment` declares `HARNESS_MODEL`, `HARNESS_SMALL_MODEL`, and `DELIVERY_WORK_PATH` only. `PATH` and `HOME` are never declared and therefore never reach the child. |
| Deny-by-default builder | `packages/core/src/domain/harness-spawn-env.ts:38-67` | Builds exactly the declared set from the injected parent environment plus validated records; an absent declared variable returns `harness.spawn.variable-missing` with the variable in `field`, and no partial environment is returned. |
| Harness environment contract | `packages/core/src/contracts/harness.ts:120-148` | `HarnessEnvironmentEntry` has a variable form (`kind`, `name`) and a credential form (`kind`, `name`, `reference`); there is no required/optional distinction. |
| Configuration validation | `packages/core/src/config/harness.ts:110-145`, `packages/core/src/config/catalog.ts:276-318` | `harness.environment` entries accept `name` and optional `credentialRef`; a literal `value` is rejected as `config.secret.forbidden`; other keys are `config.value.invalid`. |
| CLI composition | `packages/cli/src/production.ts:423-447` | Maps config settings onto descriptor entries and injects `DELIVERY_WORK_PATH` through the validated record. The harness command is the bare name `opencode`, resolved through PATH. |
| Dispatch spawn path | `packages/core/src/app/dispatch.ts:466-485` | Any pre-session spawn or resume failure collapses to `dispatch.session.spawn-failed` with the fixed message `spawn failed before a session existed`; the underlying harness failure is discarded. |
| Dispatch error assembly | `packages/core/src/app/dispatch.ts:185-200` | `errorOf` produces only `code`, `category`, `retryable`, `consequence`, `remediationHint`, and `summary`. |
| Dispatch result contract | `packages/core/src/contracts/dispatch.ts:277-296`, `packages/core/src/contracts/result.ts:36-43` | `DispatchEnvelopeData.error` is a `CommandResultError`, which has no detail or field slot. |
| Dispatch text output | `packages/cli/src/output/dispatch-text.ts:28-34` | Text mode emits exactly `result`, `pr_url`, `exit_code`, and `last_message`, in that order. |
| CLI verbose flag and human diagnostic | `packages/cli/src/index.ts:298-303`, `packages/cli/src/index.ts:317`, `packages/cli/src/output/serialize.ts:69-82`, `packages/cli/src/output/serialize.ts:97-98`, `packages/cli/src/output/serialize.ts:110-113` | `--verbose` is parsed in `runCli` and handed to the single output writer, where it selects the full envelope over the scripted one-line trim in machine mode. The shared stderr diagnostic (`diagnosticFor`) is built from a failure outcome's message, summary, and error-table code, is written only by `writeOutput` after redaction, and is emitted for a failure outcome in every mode; it carries no dispatch envelope data. |
| Dispatch human rendering seam | `packages/cli/src/commands/dispatch.ts:133-149`, `packages/cli/src/index.ts:51,351-353` | The dispatch command selects human text for data-bearing results and passes `data` to the four-key dispatch text renderer. The published seam is `CommandDefinition.humanText`, declared as `(data, brand) => string \| undefined` and invoked with exactly those two arguments, so the human-text selection currently has no verbose fact. A pre-session spawn failure returns a success envelope carrying `data`, so its human rendering is that four-key text and no stderr failure diagnostic is produced for it. |

Measured evidence from the reporting environment:

```
HARNESS_MODEL=<unset>   HARNESS_SMALL_MODEL=<unset>
OC_ADOS_MAIN_MODEL=deepseek/deepseek-flash
OC_ADOS_SMALL_MODEL=deepseek/deepseek-flash
command -v opencode -> /home/<user>/.nvm/versions/node/v24.11.1/bin/opencode
```

No repository production code consumes `HARNESS_MODEL` or `HARNESS_SMALL_MODEL`; the names appear only in defaults, fixtures, and tests. opencode resolves model selection from its own configuration, which requires `HOME` to locate.

### 2.2 Pain Points / Gaps

- The default configuration cannot spawn the default harness: environment construction fails on the first absent `HARNESS_MODEL` before any child process starts.
- Even when those model variables are present, `PATH` is undeclared, so a bare `opencode` command cannot be resolved and executed by the child.
- `HOME` is undeclared, so the child cannot locate the harness's own configuration and credential material.
- The default required set contains names the real environment does not use, turning an unused capability into a hard pre-spawn failure.
- Every declared entry is implicitly required, so a variable that is legitimately absent on a platform (`TMPDIR` on Linux) cannot be allowlisted without risking the same hard failure.
- Dispatch collapses every harness failure into one fixed message and discards the underlying failure identity, so an operator cannot tell a missing variable from a credential failure, a refused spawn, or a missing binary without reading source.
- The current fixtures pin the unviable default allowlist and the collapsed envelope, so the regression is not caught by the delivered suite.

## 3. PROBLEM STATEMENT

Because the shipped spawn allowlist omits `PATH` and `HOME` and requires two model variables that a real environment does not set, a default installation cannot spawn the default opencode harness, so every typed `dispatch` fails as `dispatch.session.spawn-failed` and the engine delivery path remains unusable without hand-written configuration.

## 4. GOALS

- **G-1**: Ship a default allowlist that can start the default harness on a realistic parent environment with zero user configuration: `PATH` and `HOME` required, `TMPDIR` optional, `DELIVERY_WORK_PATH` injected as today.
- **G-2**: Stop requiring model variables under names the environment does not use, and do not invent an unused mapping from `OC_ADOS_MAIN_MODEL` or `OC_ADOS_SMALL_MODEL`.
- **G-3**: Preserve deny-by-default and distinguish required from optional allowlist entries; an absent required entry still fails closed and names the variable, while an absent optional entry is omitted.
- **G-4**: Surface the underlying harness failure kind, code, and field when dispatch records a pre-session spawn failure, in machine JSON and verbose human output, without changing the delivered dispatch identity, token, exit, or non-verbose text shape.
- **G-5**: Prove the repair with regression tests and one bounded real dispatch, and prove that no undeclared ambient variable reaches the child.

### 4.1 Success Metrics / KPIs

| Metric | Target for this change |
|---|---|
| Zero-configuration default spawns that start the configured harness on a POSIX parent with `PATH` and `HOME` | 100% |
| Shipped default required entries | Exactly `PATH`, `HOME`, `DELIVERY_WORK_PATH` |
| Shipped default optional entries | Exactly `TMPDIR` |
| Shipped default required model variables | 0 |
| Undeclared parent variables present in the child environment | 0 |
| Pre-session spawn failures whose underlying kind and code are surfaced, with the field when the failure carries one | 100% |
| New failure codes, delivery-result tokens, classifier rows, or error-table rows | 0 |
| Non-verbose dispatch text keys | Exactly 4 |
| Real bounded dispatches on a healthy CLI that reach classification instead of `dispatch.session.spawn-failed` | 1 of 1 |
| Release invariant compliance (`TC-RELEASE-001`) | Exactly 1 added changeset, five fixed-group packages at minor, non-empty body |

### 4.2 Non-Goals

- **NG-1**: Ambient inheritance or any fallback that copies all of `process.env` into the child.
- **NG-2**: Engine-controlled model routing, a new model configuration branch, or an `OC_ADOS_*` to `HARNESS_*` mapping.
- **NG-3**: A new harness kind, a new adapter operation, or a change to the opencode invocation grammar or session-port contract, beyond the shipped default allowlist and the DEC-7 host stdin observer.
- **NG-4**: A new dispatch failure identity, delivery-result token, classifier rule, exit projection, or change to `dispatch.session.spawn-failed` category, retryability, consequence, or remediation hint.
- **NG-5**: Credential resolution semantics, optional credentials, or accepting literal secret values in configuration.
- **NG-6**: Windows-specific default environment variables (`USERPROFILE`, `APPDATA`, and equivalents); Windows parity is deferred.
- **NG-7**: Changes to the bash delivery stack or making it depend on the typed CLI.
- **NG-8**: A user-facing configuration key that lets a user inherit the entire parent environment.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|---|---|---|
| F-1 | Viable default spawn allowlist for the default harness | A default that cannot start the default harness is not a default. |
| F-2 | Model-variable policy without an invented mapping | The real environment does not set the `HARNESS_*` names and no code consumes them. |
| F-3 | Required versus optional allowlist entries | A legitimately absent entry such as `TMPDIR` must not abort the spawn. |
| F-4 | Deny-by-default preserved and provable | The fix must not degrade into ambient inheritance. |
| F-5 | Underlying harness failure identity in dispatch diagnostics | Operators must diagnose a spawn failure without reading source. |
| F-6 | Configuration and contract compatibility | Existing valid configuration must keep its meaning and shape. |
| F-7 | Regression coverage for the default spawn path | The unviable default and the collapsed envelope must not return silently. |
| F-8 | End-to-end default-installation proof | The acceptance is a working spawn, not only a synthetic unit test. |

### 5.1 Capability Details

- **F-1**: The shipped `harness.environment` default declares `PATH`, `HOME`, `TMPDIR`, and `DELIVERY_WORK_PATH`. `PATH` and `HOME` are required and forwarded from the parent environment; `DELIVERY_WORK_PATH` remains required and is supplied by the composition record; `TMPDIR` is optional and forwarded only when present. The configured harness command remains a bare executable name (`opencode`), so PATH resolution must work without an absolute command path. The default declares no model variable.
- **F-2**: `HARNESS_MODEL` and `HARNESS_SMALL_MODEL` are removed from the default required set. No mapping from `OC_ADOS_MAIN_MODEL` or `OC_ADOS_SMALL_MODEL` is added. A user may still declare either `HARNESS_*` name explicitly; doing so preserves the delivered required-entry semantics. Model routing remains owned by the harness's own configuration, and this change adds no engine-side model control.
- **F-3**: A declared variable entry may carry an optional marker. An entry without the marker is required: an absent value fails closed with the existing `harness.spawn.variable-missing` identity and the variable in `field`, and no partial environment is returned. An entry with the marker is optional: an absent value omits the key and the build continues; a present value is forwarded. The optional marker applies only to variable entries; a credential entry stays required and an unresolvable reference still fails closed with the delivered `config.credential.missing` identity.
- **F-4**: The child environment is still exactly the declared and present entries plus resolved credentials. An undeclared parent variable is absent. No ambient environment read is added in the runtime-neutral core or the builder. A declared record value still takes precedence over the injected parent value, and an undeclared record name still changes nothing.
- **F-5**: When a spawn or resume fails before a session exists, the underlying `HarnessFailure` is always available on that path: `kind` and `code` are required fields and `field` is optional. Dispatch keeps the delivered `dispatch.session.spawn-failed` identity, category, retryability, consequence, remediation hint, exit projection, token, outcome, and last message. It additionally carries an additive detail on the dispatch error whenever that underlying failure is available — which is every pre-session failure — containing the underlying `kind` and `code`, plus `field` only when the failure carries one; no detail is fabricated, and there is no detail-less variant on this branch. The detail is present in machine JSON output and is named in verbose human output. Verbose human output is selected by the dispatch command's human-text seam, which receives the parsed `--verbose` fact through the additive optional `HumanTextContext` parameter of `CommandDefinition.humanText` (DM-4). Non-verbose text output remains exactly the four delivered keys. The detail contains identifiers only, never an environment value or secret.
- **F-6**: The configuration branch keeps its existing shape and validation: a variable entry is still `name` plus optional `credentialRef`; the new optional marker is a boolean and is rejected when non-boolean or combined with a credential reference; a literal `value` remains `config.secret.forbidden`; unknown keys remain `config.value.invalid`. A configuration entry without the marker behaves exactly as today (required). The generated schema, defaults-position manifest, and source hashes are regenerated and parity-checked.
- **F-7**: The suite pins the repaired default with a fake `opencode` executable placed on a controlled `PATH`: the spawn resolves the bare command, the child environment contains the expected declared entries, an attempt record is written, and the result token is not `dispatch.session.spawn-failed`. Additional cases cover an absent required variable naming the field, an absent optional variable succeeding, an undeclared parent canary staying absent, a present optional variable being forwarded, and explicit `HARNESS_MODEL` compatibility.
- **F-8**: One real `dispatch <ref>` on the installed healthy opencode CLI with no user configuration declaration reaches classification with any result token other than `dispatch.session.spawn-failed`, and an attempt record exists. The proof is bounded so a nested lifecycle cannot mutate this change's worktree: a probe-scale prompt or a session ended after the handle is observed, executed outside the change worktree. If the real proof exposes another environment variable that opencode genuinely needs to boot, that variable joins the default set as required, or as optional when it is legitimately absent, before delivery closes.

## 6. USER & SYSTEM FLOWS

```
Flow 1: zero-configuration spawn
  operator runs `dispatch <ref>` on a fresh installation
  -> config resolves the shipped defaults
  -> descriptor declares PATH, HOME, TMPDIR (optional), DELIVERY_WORK_PATH
  -> builder forwards parent PATH and HOME, omits absent TMPDIR, injects DELIVERY_WORK_PATH
  -> host starts the bare `opencode` command, resolved through PATH
  -> the child reads its own configuration and credentials through HOME
  -> first JSONL line carries a sessionID -> handle acquired
  -> attempt record written -> classification reaches a result token other than spawn-failed

Flow 2: required entry absent
  config declares a required variable (default PATH/HOME or an explicit entry)
  -> builder finds it absent in parent and record
  -> harness.spawn.variable-missing with the variable in `field`
  -> dispatch records dispatch.session.spawn-failed
  -> JSON detail names the underlying kind and code, plus the field when present; verbose human output names them
  -> non-verbose text remains `result`, `pr_url`, `exit_code`, `last_message`

Flow 3: optional entry absent or present
  TMPDIR absent in parent -> key omitted -> spawn continues
  TMPDIR present in parent -> key forwarded -> spawn continues

Flow 4: undeclared ambient variable
  parent contains an undeclared canary -> child environment does not contain it

Flow 5: explicit model-variable override
  user explicitly declares HARNESS_MODEL as a required entry
  -> parent supplies it -> forwarded
  -> parent lacks it -> fails closed naming HARNESS_MODEL, exactly as any required entry

Flow 6: diagnostic inspection
  machine consumer reads `data.error.code` and `data.error.detail`
  human operator adds `--verbose` and sees the underlying code and, when present, the field
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The shipped `harness.environment` default allowlist and its `config` origin.
- The optional marker on a declared variable entry across the configuration and harness descriptor layers.
- The deny-by-default builder's required/optional projection, including fail-closed behaviour and omission of absent optional entries.
- The production composition mapping of the optional marker and the existing `DELIVERY_WORK_PATH` injection.
- The host spawn seams' child-stdin observer (DEC-7): a benign `error` listener attached before the prompt write at both the one-shot runner and the streaming starter, so a child that exits early cannot surface an uncaught stdin stream error. The observer never classifies: an early-exit `EPIPE` and any other stdin error are absorbed, and the result comes from the child `error`/`close` events and the seam's own bounds.
- The synthetic default-spawn fixture's stdin drain, so the fixture child never races the parent's prompt write.
- The dispatch error detail carrying the underlying harness failure identity.
- Machine JSON and verbose human rendering of that detail, with the four-key non-verbose text contract preserved.
- Regression tests, fixtures, and golden envelopes that pin the default allowlist and the spawn-failure envelope.
- The release changeset required by `TC-RELEASE-001`.
- Current-truth documentation updates flagged for the system-spec update phase.

### 7.2 Out of Scope

- [OUT] Inheriting all of `process.env`, an opt-in ambient passthrough, or any fallback that forwards undeclared variables.
- [OUT] Mapping `OC_ADOS_MAIN_MODEL` or `OC_ADOS_SMALL_MODEL` to `HARNESS_MODEL` or `HARNESS_SMALL_MODEL`.
- [OUT] Engine-controlled model selection or a new model configuration branch.
- [OUT] A new harness kind, a new adapter operation, or a change to the opencode invocation grammar.
- [OUT] A new dispatch error identity, delivery-result token, classifier rule, exit code, or change to the spawn-failed category, retryability, consequence, or remediation hint.
- [OUT] Optional credential entries, literal secret values in configuration, or a change to credential resolution.
- [OUT] User-facing configuration for ambient inheritance.
- [OUT] Windows-specific default environment variables; Windows parity is deferred.
- [OUT] Bash stack changes or a bash dependency on the typed CLI.
- [OUT] Changes to the harness session port, the streaming-starter or one-shot-runner lifecycle, timeout or kill-escalation behaviour, output buffering or truncation, or the classifier. The delivered child-stdin early-close guard at both host write seams (§7.1) is in scope: it changes no lifecycle boundary, timeout, process primitive, or invocation grammar.

### 7.3 Deferred / Maybe-Later

Every item below is outside delivery scope and names an owner and a home so it does not become an unowned follow-up (DoD-10).

| Deferred item | Owner | Home |
|---|---|---|
| Windows host-profile variables (`USERPROFILE`, `APPDATA`, and equivalents) in the default allowlist, if harness dispatch is claimed on Windows. | `@pm` | This change §7.3, §12, and DEC-6; re-evaluated at PR review and again only if Windows harness dispatch is claimed, then routed as a follow-up ticket on the GH-277 tracker. |
| A configurable per-platform default allowlist or a platform-aware default provider. | `@pm` | This change §7.3; re-evaluated at PR review; no work is scoped until a platform-aware default is requested. |
| Per-harness default allowlist overlays, if a second harness needs a materially different boot environment. | `@pm` | This change §7.3; re-evaluated at PR review; scoped only when a second harness is proposed. |
| A richer nested failure chain for other dispatch failures beyond the pre-session spawn path. | `@pm` | This change §7.3; re-evaluated at PR review; scoped only when a non-spawn dispatch failure needs the nested detail. |
| Additional optional entries discovered by real operation, beyond `TMPDIR`. | `@pm` | This change §7.3 and §14 OQ-2; the bounded real-dispatch proof (F-8, AC-F8-1, `TC-HDA-100`/`TC-HDA-101`) is the closure evidence, and a later discovery reopens §7.3 and follows the default-addition rule in §22. |

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. This change introduces no HTTP surface and changes no existing HTTP contract.

### 8.2 Events / Messages

N/A. No internal event, message, state record, or capsule event is added or changed. The dispatch detail is a command-envelope field, not a product event.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `harness.environment` configuration entry | Gains an optional boolean marker. An entry remains `name` plus optional `credentialRef`; the marker is valid only on a variable entry. Existing entries without the marker keep required semantics. |
| DM-2 | Harness execution-environment descriptor variable entry | Gains the same additive optional marker. The marker is data only and introduces no behaviour in the contracts tier. Credential entries are unchanged. |
| DM-3 | Dispatch envelope error detail (`DispatchEnvelopeError`) | `packages/core/src/contracts/dispatch.ts` declares `DispatchEnvelopeError` as the delivered `CommandResultError` (same six fields) plus `detail?: { readonly kind: "harness" \| "config"; readonly code: string; readonly field?: string }`. `DispatchEnvelopeData.error` is retyped from `CommandResultError` to `DispatchEnvelopeError`. `CommandResultError` itself and every other envelope stay unchanged, because every envelope's top-level error is built from the error table and widening the shared type would widen all of them. |
| DM-4 | CLI command-definition human-text context (additive) | `packages/cli/src/index.ts` gains an exported `HumanTextContext = { readonly verbose: boolean }` and widens the published `CommandDefinition.humanText` signature from `(data: unknown, brand: BrandIdentity) => string \| undefined` to `(data: unknown, brand: BrandIdentity, context?: HumanTextContext) => string \| undefined`. The third parameter is optional and additive: every existing command definition that declares two parameters (or fewer) stays assignable, every direct two-argument call stays valid, and an omitted context means non-verbose. `runCli` passes the parsed `--verbose` fact as `{ verbose }` at the single human-text call site, and only the dispatch command's human-text selection consumes it to choose the bounded verbose diagnostic. No other `CommandDefinition` member changes. |

No persisted model, state record, event-log shape, schema version, or migration is affected. DM-4 is additive in the type sense: the new third parameter is optional, so no existing definition or direct two-argument call needs an edit.

The `detail` field is optional on `DispatchEnvelopeError` because dispatch error rows other than the pre-session spawn path do not carry it; on the pre-session path it is always present because a `HarnessFailure` is always available there, and its `kind` and `code` are required while `field` appears only when the failure carries one (F-5, AC-F5-1). The detail is identifiers only, single-line, at most 256 characters, and it introduces no new failure code, delivery-result token, classifier row, or error-table row (AC-F5-4, AC-F5-5). The inspection surface for DM-1/DM-2 is the delivered `config get <key> [--show-origin]` form, read as `config get harness.environment --show-origin` for the harness branch.

### 8.4 External Integrations

The external integration is the opencode child process environment. Its delivered contract is unchanged; the allowlist contents change:

| Aspect | Contract used by this change |
|---|---|
| Command | Bare `opencode` (and its existing argument grammar), resolved through the child's `PATH`. |
| Required environment | `PATH` (executable and subprocess resolution), `HOME` (harness configuration and credential location), `DELIVERY_WORK_PATH` (injected work directory). |
| Optional environment | `TMPDIR` (forwarded when present, omitted when absent). |
| Model variables | None required by default. No `OC_ADOS_*` mapping. opencode resolves its own model configuration. |
| Undeclared variables | Absent. No ambient inheritance. |
| Credentials | Unchanged: declared credential references resolve through the credential port at spawn time and fail closed when unresolved. |

No external API, network endpoint, vendor SDK, or transport is added or changed.

### 8.5 Backward Compatibility

- A user configuration entry written as `{ name: "X" }` keeps required semantics. No migration or edit is required.
- A user who explicitly declared `HARNESS_MODEL` or `HARNESS_SMALL_MODEL` keeps those entries and their required behaviour; only the shipped default stops declaring them.
- A literal `value` in an allowlist entry remains `config.secret.forbidden`; an unknown key remains `config.value.invalid`.
- Credential entries remain required and fail closed on an unresolved reference.
- The `dispatch.session.spawn-failed` identity, category, retryability, consequence, remediation hint, token, outcome, exit projection, and last message are unchanged.
- Non-verbose dispatch text remains exactly four keys in the delivered order. The new detail is additive on the dispatch error; on the pre-session path it is always present because a `HarnessFailure` is always available there.
- The dispatch `data.error` field is retyped to `DispatchEnvelopeError`, which keeps every delivered `CommandResultError` field and adds only an optional `detail`; a consumer that reads the six delivered fields is unaffected, and the top-level `CommandResult` envelope, `CommandResultError`, and every other envelope keep their delivered shape.
- The published `CommandDefinition.humanText` type gains an optional third `HumanTextContext` parameter (`{ readonly verbose: boolean }`). An existing definition that declares only `(data, brand)` stays assignable, keeps compiling, and produces identical text because an omitted context means non-verbose; direct two-argument calls keep compiling. Only the dispatch command consumes the context, and no other `CommandDefinition` member, CLI grammar, help entry, or output envelope changes.
- No CLI grammar, help entry, unrelated output envelope, error-table row, delivery-result token, classifier rule, or persisted shape changes.
- The default behaviour changes intentionally: a zero-configuration installation no longer requires the two model variables and now forwards `PATH` and `HOME`. This is the repair, not a compatibility break for any repository consumer.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|---|---|---|
| NFR-1 | Zero-configuration default spawn success on a POSIX parent that has `PATH` and `HOME` | 100% of cases |
| NFR-2 | Required-entry fail-closed behaviour | 100% of absent required entries fail with `harness.spawn.variable-missing`, name the variable in `field`, and attempt no child spawn |
| NFR-3 | Deny-by-default leakage | 0 undeclared parent variables present in the child across the test matrix |
| NFR-4 | Vocabulary and identity stability | 0 new failure codes, 0 new delivery-result tokens, 0 classifier changes, 0 error-table rows |
| NFR-5 | Diagnostic completeness | 100% of pre-session harness failures carry the underlying `kind` and `code` in machine JSON, plus the `field` when the failure carries one; verbose human output names the code and, when present, the field |
| NFR-6 | Diagnostic hygiene | Detail and verbose text contain identifiers only, no environment value or secret; detail is single-line and at most 256 characters |
| NFR-7 | Non-verbose text stability | Exactly 4 keys and 4 lines: `result`, `pr_url`, `exit_code`, `last_message` |
| NFR-8 | Compatibility | 0 required edits for existing valid configuration and 0 changes to the top-level `CommandResult` envelope shape |
| NFR-9 | Gate health | `pnpm typecheck`, `pnpm test`, `pnpm check:boundaries`, configuration schema/default parity, and the secret-read boundary all pass |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No new metric, log stream, trace, alert, or persisted telemetry record is required. Observable behaviour stays within the delivered surfaces:

- The default spawn is observable as a returned handle, one attempt record, and a result token other than `dispatch.session.spawn-failed`.
- A pre-session failure is observable as the delivered dispatch identity plus the additive underlying detail in machine JSON.
- Verbose human output adds a bounded diagnostic naming the underlying code and, when present, the field; non-verbose text is unchanged.
- No environment value, credential material, prompt content, or stream content is logged or persisted by any new path.
- The detail is a user-facing diagnostic, not a telemetry record; it adds no state record kind.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|---|---|---|---|---|---|
| RSK-1 | Declaring `PATH` and `HOME` widens the child environment beyond the previous default. | M | M | The entries are the minimum for command execution and harness configuration; deny-by-default and the no-ambient-inheritance rule are unchanged; tests prove undeclared variables stay absent; security review covers the widened set. | L |
| RSK-2 | Removing `HARNESS_MODEL` and `HARNESS_SMALL_MODEL` breaks an undocumented consumer or a model-routing expectation. | M | L | Repository-wide search finds no production consumer; opencode resolves its own models; a user can explicitly re-declare either name; the default does not fabricate a mapping. | L |
| RSK-3 | The optional marker weakens fail-closed semantics or accidentally makes a required variable optional. | M | M | Absence of the marker means required; the marker is variable-only; credential entries stay required; paired present/absent tests cover both classes. | L |
| RSK-4 | The diagnostic detail leaks a value or breaks the four-key text contract. | M | L | Detail carries only `kind`, `code`, and `field` identifiers; it is bounded and single-line; the existing redaction path applies; the text contract has a dedicated assertion. | L |
| RSK-5 | A fake CLI on PATH passes while a real opencode still fails because another variable is required to boot. | H | M | The required proof includes one bounded real dispatch; any newly discovered required variable joins the default set before delivery closes; the real proof is recorded in the plan and PR. | M |
| RSK-6 | The real dispatch proof starts a nested lifecycle that mutates this change's worktree or runs for hours. | H | M | Bound the proof to a probe-scale prompt or end the session after the handle is observed; run it outside the change worktree. | L |
| RSK-7 | The additive optional contract marker needs a decision record under the delivered additive adapter-contract rule. | M | L | Closed: raised as OQ-1 and answered by authoring `TDR-0021` as the standalone record the rule requires; DEC-3 remains the in-change rationale, and the owner records acceptance at PR review. | L |
| RSK-8 | The generated schema, defaults manifest, fixtures, or golden envelopes drift from the new default. | M | M | Regenerate schema and defaults-position artifacts; update the pinned default fixture and spawn-failure golden; parity checks run in the gate battery. | L |

## 12. ASSUMPTIONS

- The default-installation behaviour this change must repair is the POSIX host profile (Linux and macOS). Windows host-profile variables are deferred.
- `PATH` is sufficient to resolve the bare `opencode` command and the harness's own subprocesses.
- `HOME` is sufficient for opencode to locate its own configuration and credential material; the harness reads it from the child environment.
- `TMPDIR` is legitimately absent on Linux and is therefore optional; no shipped default entry other than `TMPDIR` is optional.
- `DELIVERY_WORK_PATH` continues to be injected by the production composition record and is required in the descriptor.
- No repository production code consumes `HARNESS_MODEL` or `HARNESS_SMALL_MODEL`; opencode resolves model selection from its own configuration.
- The parent environment is trusted; a `PATH` containing user-controlled directories is the operator's existing trust decision.
- A fake CLI on a controlled `PATH` is a valid regression proxy for command resolution and environment construction; one bounded real dispatch is the end-to-end proof of the real harness.
- The existing redaction chokepoint covers the new detail because it is part of the dispatch envelope.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|---|---|---|
| Depends on | Harness execution-environment contract | The optional variable marker is added here; the session port interface, evidence, outcomes, failure codes, and credentials are unchanged, and the host runner and starter keep their lifecycle, timeout, and spawn-failure semantics (the child-stdin observer, DEC-7, is the only change inside those seams). |
| Depends on | Configuration layer (`harness` branch, schema, defaults) | The allowlist entry shape and shipped defaults change; validation keeps the secret-forbidden rule. |
| Depends on | Deny-by-default spawn-environment builder | Required/optional projection and fail-closed naming live here. |
| Depends on | CLI production composition | Maps the optional marker and keeps the `DELIVERY_WORK_PATH` record injection. |
| Depends on | Dispatch engine and dispatch contract | Captures the underlying harness failure and adds the additive detail. |
| Depends on | CLI dispatch output | Machine JSON already carries the whole envelope through the shared serializer; the four-key non-verbose text is unchanged, and the bounded verbose diagnostic is rendered through the dispatch human-text seam with the `--verbose` fact. |
| Depends on | `opencode` CLI | The real harness that must boot with the new default environment. |
| Governed by | Additive adapter-contract rule (`TDR-0008`, `TDR-0016`, `TDR-0021`) | The optional marker is a type-only additive contract field. `TDR-0021` is the standalone decision record the rule requires for it; this change's decision log DEC-3 carries the in-change rationale, and `TDR-0008`/`TDR-0016` state the rule and its prior application to the same contract module. |
| Blocks | M1-S9 engine dispatch path on a default installation | No typed dispatch can start the default harness until this lands. |
| Blocks | Any later harness work that needs a live opencode session | Those paths remain unexercised until a default spawn succeeds. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status | Owner | Home |
|---|---|---|---|---|---|
| OQ-1 | Does the additive optional marker on the harness environment contract require a standalone decision record under the delivered additive adapter-contract rule, or is this change's decision log sufficient? | `TDR-0016` records that adapter-contract evolution is decision-record governed and that adding types to the harness contract is the class the rule covers; this change adds an optional field to `HarnessEnvironmentVariable`. The marker is type-only, additive, and reversible, which is the `ADR-0004`/`ADR-0006` precedent shape. | Resolved 2026-11-09 by `TDR-0021`: the delivered rule governs each adapter-contract change and states no size threshold and no waiver mechanism, so a standalone record is required and `TDR-0021` is that record; §15 DEC-3 is the in-change rationale, not a waiver. | `@pm` | `TDR-0021` (§13, DEC-3); acceptance recorded at PR review (RSK-7). |
| OQ-2 | Does opencode require any environment variable beyond `PATH`, `HOME`, and optionally `TMPDIR` to boot on the supported POSIX profile? | The ticket names `TMPDIR` as the likely optional case, but the complete boot requirement is not established by source alone. The bounded real dispatch proof (F-8, AC-F8-1) is the evidence source; a discovered required variable must join the default set before delivery closes. | Open, evidence needed from the real dispatch proof; non-blocking for specification. | `@pm` | This change §14 OQ-2 and §7.3; closed by the `TC-HDA-100`/`TC-HDA-101` evidence recorded in the plan and PR and re-checked at PR review; any discovered variable joins the default set before delivery closes (F-8). |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|---|---|---|---|
| DEC-1 | Replace the shipped default allowlist with `PATH` and `HOME` as required, `TMPDIR` as optional, and the existing required `DELIVERY_WORK_PATH` injection. | `PATH` is required to resolve the bare `opencode` command and its subprocesses; `HOME` is required for the harness's own configuration and credential lookup; `TMPDIR` is legitimately absent on Linux and must not abort a spawn; `DELIVERY_WORK_PATH` is already injected by the composition and must remain declared. A default that cannot start the default harness is not a default. | 2026-11-09 |
| DEC-2 | Drop `HARNESS_MODEL` and `HARNESS_SMALL_MODEL` from the default required set. Do not map `OC_ADOS_MAIN_MODEL` or `OC_ADOS_SMALL_MODEL` to them. | No repository production code consumes the `HARNESS_*` names, and opencode resolves model selection from its own configuration. A mapping would add an unused, privileged declared input and would imply engine-controlled model routing that this change does not deliver. The `OC_ADOS_*` names remain ambient facts, not allowlist entries. A user may still declare either `HARNESS_*` name explicitly. | 2026-11-09 |
| DEC-3 | Add an additive optional marker to a declared variable entry. An entry without the marker is required and fails closed when absent; an entry with the marker omits an absent key and forwards a present one. The marker is variable-only; credential entries remain required and fail closed when unresolved. | The ticket requires a legitimate absence not to kill the whole spawn. Making absence the default for every entry would weaken the deny-by-default discipline; keeping the marker explicit preserves required semantics for every existing entry and limits optionality to declarations that need it. Credentials stay strictly required so optionality never becomes a silent credential bypass. Record: `TDR-0021`, because an additive change to `packages/core/src/contracts/harness.ts` is record-governed under the `TDR-0008`/`TDR-0016` rule (see OQ-1). | 2026-11-09 |
| DEC-4 | Carry the underlying harness failure as an additive detail on the dispatch `data.error`: `kind`, `code`, and `field` when present. Keep `dispatch.session.spawn-failed` as the identity, token, outcome, exit, retryability, consequence, remediation hint, and last message. Surface the detail in machine JSON and in verbose human output; keep non-verbose text exactly four keys. | The ticket requires the underlying kind, code, and field to be visible without source, while the delivered dispatch identity and bash-continuity text contract must stay stable. A nested additive detail preserves the error's identity and the four-key text contract; a new error identity or a changed last message would be a larger, consumer-visible break. | 2026-11-09 |
| DEC-5 | `version_impact` is `minor` and the change ships exactly one changeset declaring `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, and `@delivery-os/opencode` at `minor`, with a non-empty body, and modifies no pre-existing changeset. | Probed `TC-RELEASE-001` (`tests/checks/privacy-release.test.ts`): a branch that touches `packages/**` with zero added changesets fails because the test asserts the publishable diff is empty in that case; more than one added changeset fails `expect(added).toHaveLength(1)`; `validateChangeset` requires exactly the five fixed-group packages at `minor`, excludes `@delivery-os/testkit`, and requires a non-empty body. This change touches multiple packages, so the gate binds. The lockstep five-package `minor` convention is the repository release rule (precedent: `.changeset/gh-273-queue-repository-binding-minor.md`). | 2026-11-09 |
| DEC-6 | Scope the default-environment repair to the POSIX host profile and defer Windows-specific variables. | The ticket's evidence and the M1-S9 pilot are POSIX; the harness stack nowhere claims Windows dispatch parity, and adding `USERPROFILE`/`APPDATA` without a Windows acceptance path would be an unverified default. Windows variables remain a documented deferred item and a revisit trigger if Windows harness dispatch is claimed. | 2026-11-09 |
| DEC-7 | Add a benign child-stdin observer to both host spawn seams: an `error` listener is attached before the prompt write, it never kills the child and never resolves the seam, and classification stays with the child `error`/`close` events and the seam's existing handle and session bounds. No stdin error — `EPIPE` from a child that exits without reading included — synthesizes a spawn result. | Review-mandated reliability fix: a child that exits before reading its prompt closed the pipe mid-write and surfaced an uncaught stream error, which made the default-spawn regression non-deterministic. The observer keeps that stream error observed while leaving the delivered spawn semantics untouched, so no failure code, token, exit projection, API, contract, or process primitive is added, and the module stays the single child-process site (F-4, AC-F4-1, §21). Classification cannot move into the observer: a runner that emitted a non-`EPIPE` stdin error at pipe teardown was resolved as a synthetic `status: 127` before the child produced any output, so a stdin error must not fabricate a result under any code. The synthetic default-spawn fixture drains stdin for the same reason: its child must not race the parent's prompt write. | 2026-11-10 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|---|---|
| Configuration defaults (`packages/core/src/config/defaults.ts`) | Updated: default allowlist becomes `PATH`, `HOME`, `TMPDIR` (optional), `DELIVERY_WORK_PATH`. |
| Configuration catalog and harness validation (`packages/core/src/config/catalog.ts`, `packages/core/src/config/harness.ts`) | Updated: optional boolean on a variable entry; literal values still secret-forbidden; unknown or invalid combinations still classified. |
| Configuration schema and defaults manifest | Regenerated: new default list and optional field; parity checks must stay green. |
| Harness environment contract (`packages/core/src/contracts/harness.ts`) | Updated: additive optional marker on a variable entry; session port, evidence, outcomes, failure codes, and credentials unchanged. |
| Deny-by-default builder (`packages/core/src/domain/harness-spawn-env.ts`) | Updated: required/optional projection; required absence still fails closed with the field; optional absence is omitted. |
| CLI production composition (`packages/cli/src/production.ts`) | Updated: map the optional marker; keep the `DELIVERY_WORK_PATH` record injection and the bare `opencode` command. |
| Host spawn adapters (`packages/adapters/src/host/index.ts`) | Updated (review-mandated reliability fix, DEC-7): both seams — the one-shot runner and the streaming starter — attach a benign child-stdin `error` observer before the prompt write. It absorbs an early-exit `EPIPE` and any other stdin error without killing the child or resolving the seam, so classification stays with the child `error`/`close` events and the seam's existing handle and session bounds. It remains the single production child-process module: no ambient environment read, no new process primitive, and no lifecycle, timeout, or invocation-grammar change. |
| Host seam behaviour suite (`tests/behaviour/harness-host-stream.test.ts`) | Updated: the host one-shot-runner and streaming-starter coverage that pins the close-classified result at both seams, alongside the delivered streaming, timeout, kill-escalation, and orphan cases; extended for the host stdin observer. |
| Dispatch contract (`packages/core/src/contracts/dispatch.ts`) | Updated: declares `DispatchEnvelopeError` (the delivered `CommandResultError` plus an optional bounded `detail` carrying `kind` and `code`, plus `field` when the failure carries one) and retypes `DispatchEnvelopeData.error` to it; `CommandResultError` in `packages/core/src/contracts/result.ts` and every other envelope stay unchanged. |
| Dispatch engine (`packages/core/src/app/dispatch.ts`) | Updated: preserve the underlying harness failure on the pre-session spawn path (lines 466-485) and populate `data.error.detail` where `errorOf` assembles the dispatch error (lines 185-200). This is where the detail is attached to data. |
| CLI dispatch human rendering (`packages/cli/src/commands/dispatch.ts`, `packages/cli/src/output/dispatch-text.ts`) | Updated: `renderDispatchText` keeps exactly the four delivered keys as the non-verbose text; the dispatch command's human-text selection (lines 133-149) is the dispatch-specific seam that selects the bounded verbose diagnostic instead when the optional context reports `verbose: true` (DM-4), and that diagnostic is rendered in the dispatch text module. No failure identity, token, or exit projection changes here. |
| CLI flag parsing and human-text seam (`packages/cli/src/index.ts`, `packages/cli/src/output/serialize.ts`) | Updated: `--verbose` is parsed at `index.ts:317`; the output writer (`serialize.ts:97-98`) keeps using it to select the full envelope over the scripted trim in machine mode, and `runCli` now also passes the parsed fact as the optional `HumanTextContext` third argument at the `CommandDefinition.humanText` call site (`index.ts:351-353`). The published type gains that optional context (DM-4); existing two-parameter definitions and direct two-argument calls stay valid. The shared stderr diagnostic (`diagnosticFor`, `index.ts:298-303`) and the single redacted write path (`serialize.ts:110-113`) stay the only stderr channel and carry no dispatch envelope data. |
| CLI machine output (`packages/cli/src/output/serialize.ts:46-49`) | Unchanged: the whole envelope is serialized and redacted in one place, so `data.error.detail` reaches machine JSON with no dispatch-specific serializer. |
| Harness and dispatch test fixtures/goldens | Updated/new: pinned default configuration, spawn-failure envelope, fake CLI on PATH, required/optional cases, ambient-leak canary, and the synthetic default-spawn child's stdin drain so it never races the parent's prompt write. |
| Release metadata (`.changeset/gh-277-harness-default-allowlist-minor.md`) | Added: exactly one changeset with the five fixed-group packages at `minor` and a non-empty body. |
| Current-truth documentation | Updated in the system-spec update phase: configuration layer, harness adapters, dispatch engine, result contract, adapter ports. The `--verbose` human-mode meaning (it also selects the bounded verbose human diagnostic, not only the full machine envelope) is reconciled in `doc/spec/features/feature-result-contract.md` (mode override and human output) and `doc/spec/features/feature-cli-entrypoint.md` (global flags), and the `CommandDefinition.humanText` hook, including the additive optional `HumanTextContext`, is reconciled in `doc/spec/features/feature-status-digest.md`, `doc/spec/features/feature-brief.md`, `doc/spec/features/feature-doctor.md`, and `doc/spec/features/feature-owner-gate-sla.md`. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|---|---|---|
| AC-F1-1 | **Given** the shipped defaults and a parent environment with `PATH` and `HOME` set and without `HARNESS_MODEL` or `HARNESS_SMALL_MODEL`, **when** the defaults are composed and the configured harness is spawned with a fake `opencode` executable on `PATH`, **then** environment construction succeeds, an attempt record is written, and the result token is not `dispatch.session.spawn-failed`. | F-1, F-2, F-7 |
| AC-F1-2 | **Given** the configured harness command is the bare name `opencode` with no absolute path, **when** the child is started with the declared `PATH`, **then** the executable is resolved through `PATH` and the spawn is attempted. | F-1 |
| AC-F1-3 | **Given** the shipped defaults, **when** the allowlist is inspected, **then** the required entries are exactly `PATH`, `HOME`, and `DELIVERY_WORK_PATH`, the optional entry is exactly `TMPDIR`, and no model variable is declared. | F-1, F-2 |
| AC-F1-4 | **Given** a parent variable that is not declared by the allowlist, **when** the child environment is built, **then** the variable is absent from the child. | F-1, F-4 |
| AC-F2-1 | **Given** zero user configuration and an environment where `HARNESS_MODEL` and `HARNESS_SMALL_MODEL` are unset, **when** a spawn is composed, **then** no required-variable failure occurs. | F-2 |
| AC-F2-2 | **Given** ambient `OC_ADOS_MAIN_MODEL` and `OC_ADOS_SMALL_MODEL` values, **when** the child environment is built from the defaults, **then** neither value is forwarded or mapped and no `HARNESS_*` name is synthesized. | F-2, F-4 |
| AC-F2-3 | **Given** an explicit user configuration that declares `HARNESS_MODEL` as a required entry and a parent environment that lacks it, **when** the environment is built, **then** the spawn fails closed with `harness.spawn.variable-missing` naming `HARNESS_MODEL`, preserving the delivered required-entry semantics. | F-2, F-3, F-6 |
| AC-F3-1 | **Given** a declared required variable absent from the parent and record, **when** the environment is built, **then** it fails with `harness.spawn.variable-missing`, the variable is carried in `field`, no child is spawned, and no partial environment is returned. | F-3, F-4 |
| AC-F3-2 | **Given** a declared optional variable absent from the parent and record, **when** the environment is built, **then** the build succeeds and the key is absent from the child. | F-3 |
| AC-F3-3 | **Given** a declared optional variable present in the parent or record, **when** the environment is built, **then** the key is forwarded with that value. | F-3 |
| AC-F3-4 | **Given** a declared credential entry whose reference does not resolve, **when** the environment is built, **then** it fails closed with `config.credential.missing` and no optional marker can bypass the failure. | F-3, F-4 |
| AC-F3-5 | **Given** a configuration entry whose optional marker is not a boolean, or a credential entry carrying the optional marker, **when** the harness branch is resolved, **then** the entry is classified `config.value.invalid`; a literal `value` remains `config.secret.forbidden`. | F-3, F-6 |
| AC-F4-1 | **Given** the builder, composition, and host sources, **when** the boundary, secret-read, and structure gates run, **then** no ambient environment read is introduced, the child environment is constructed from the descriptor, injected parent, record, and credential port only, and the host spawn path stays the single production child-process module, which also carries the delivered benign child-stdin observer: stdin errors, an early-exit `EPIPE` included, are observed and never synthesize a spawn result, while the child `error`/`close` events and the seam's existing handle and session bounds own classification, with no new process primitive and no change to the environment-as-data rule. | F-4, NFR-3, NFR-9 |
| AC-F4-2 | **Given** a declared record value and a parent value for the same name, **when** the environment is built, **then** the record value wins; an undeclared record name changes nothing. | F-4 |
| AC-F5-1 | **Given** a pre-session spawn failure, **when** dispatch records the failure, **then** `data.error.code` remains `dispatch.session.spawn-failed` and `data.error.detail` carries the underlying harness failure `kind` and `code`, plus `field` when the failure carries one. | F-5 |
| AC-F5-2 | **Given** the same spawn failure with `--json`, **when** the envelope is rendered, **then** the underlying detail is present in machine output and survives the redaction path. | F-5, NFR-5 |
| AC-F5-3 | **Given** the same spawn failure in verbose human mode, **when** the output is rendered, **then** the dispatch human-text selection receives the parsed `--verbose` fact through the additive optional `HumanTextContext` parameter of `CommandDefinition.humanText` and names the underlying code and, when present, the field; **and given** a command definition that declares only the delivered two-parameter form, **then** it still type-checks under the workspace typecheck and behaves identically; **and given** no verbose, **then** the text output remains exactly the four delivered keys. | F-5, NFR-7, DM-4 |
| AC-F5-4 | **Given** the spawn-failed identity across this change, **when** the result is inspected, **then** its category, retryability, consequence, remediation hint, token, outcome, exit projection, and last message are unchanged and no new failure code, token, classifier rule, or error-table row exists. | F-5, NFR-4 |
| AC-F5-5 | **Given** a detail carrying a variable name but no value, **when** it is serialized or rendered, **then** it contains identifiers only, is single-line, and is bounded to 256 characters. | F-5, NFR-6 |
| AC-F6-1 | **Given** an empty configuration, **when** the harness branch resolves, **then** the new default list resolves with `defaults` origins and the generated schema, defaults-position manifest, and source hashes pass their parity checks. | F-6, F-1 |
| AC-F6-2 | **Given** an existing valid configuration entry written as `{ name: "X" }`, **when** it resolves, **then** it keeps required semantics and requires no migration. | F-6, F-3 |
| AC-F6-3 | **Given** the configuration inspection surface `config get harness.environment --show-origin`, **when** it renders the harness branch, **then** the payload lists the four shipped default entries with the `optional` marker on `TMPDIR`, the reported origin is `defaults`, and no secret value is emitted. | F-6 |
| AC-F7-1 | **Given** the regression suite, **when** it runs, **then** it contains a default-allowlist spawn with a fake CLI on `PATH` that asserts the attempt record and a result token other than `dispatch.session.spawn-failed`. | F-7, F-1 |
| AC-F7-2 | **Given** the regression suite, **when** it runs, **then** it contains an absent-required-variable case that asserts the field name in the harness failure and in the dispatch detail. | F-7, F-3, F-5 |
| AC-F7-3 | **Given** the regression suite, **when** it runs, **then** it contains an ambient-leak canary that asserts an undeclared parent variable is absent from the child. | F-7, F-4 |
| AC-F7-4 | **Given** the regression suite, **when** it runs, **then** it contains machine JSON and verbose human assertions for the underlying code and field, and a non-verbose four-key text assertion. | F-7, F-5 |
| AC-F7-5 | **Given** the regression suite, **when** it runs, **then** it contains paired optional-present and optional-absent cases for `TMPDIR`. | F-7, F-3 |
| AC-F8-1 | **Given** the installed healthy opencode CLI and a real ticket, **when** one bounded `dispatch <ref>` runs with no user configuration declaration, **then** it reaches classification with any result token other than `dispatch.session.spawn-failed` and an attempt record exists. | F-8, F-1 |
| AC-F8-2 | **Given** the end-to-end proof, **when** it executes, **then** it is bounded (probe-scale prompt or session ended after the handle is observed) and creates no nested lifecycle mutation in this change's worktree. | F-8, RSK-6 |

**Ticket acceptance traceability**

| Ticket acceptance bullet | Acceptance criteria |
|---|---|
| With zero user configuration, composing the defaults against a realistic parent environment and spawning the configured harness succeeds: an attempt record is written and a result token other than `dispatch.session.spawn-failed` is produced. | AC-F1-1, AC-F2-1, AC-F8-1 |
| `PATH` resolution works (command found without an absolute path). | AC-F1-2 |
| A declared-but-absent variable still fails closed, with the failing name visible in the error detail. | AC-F3-1, AC-F5-1, AC-F5-3 |
| Regression tests: default-allowlist spawn with a fake CLI on PATH; absent-variable failure names the field; no ambient env leakage (an undeclared parent variable is absent from the child). | AC-F7-1, AC-F7-2, AC-F7-3 |
| Verbose/JSON output surfaces the underlying harness failure code and field. | AC-F5-2, AC-F5-3, AC-F7-4 |

### 17.1 Definition of Done

This change is done when every condition below holds and is evidenced. Each condition binds the §17 acceptance criteria, the §4.1 success metrics, and the test plan's 30 scenarios (`TC-HDA-001`..`TC-HDA-101`) to a named verification, and cites the delivering plan phase in `chg-GH-277-plan.yaml` (Phases 1–5) or the lifecycle phase that owns the proof. `dod_check` uses this checklist; a condition without passing evidence reopens the owning plan phase rather than being waived. This specification claims no passing evidence; the conditions define what must be proven.

| # | Done condition | Binds | Verification | Proven in |
|---|---|---|---|---|
| DoD-1 | All 29 acceptance criteria (AC-F1-1..AC-F8-2) are satisfied against the delivered tree, with no uncovered criterion; each criterion's evidence is its mapped test-plan scenario. | §17 (29 ACs) | Test-plan coverage matrix all Covered; execution-log rows resolve | Phases 1–4 |
| DoD-2 | Every test-plan scenario reports Pass in the execution log: all 30 TCs, `TC-HDA-001`..`TC-HDA-101`, including the manual real-dispatch pair `TC-HDA-100`/`TC-HDA-101`; no Pending, Fail, skipped, or blocked row remains. | §17; test plan §10 | Execution log | Phases 1–5 |
| DoD-3 | All nine NFR thresholds (NFR-1..NFR-9) are met with recorded evidence: zero new failure codes, delivery-result tokens, classifier rows, or error-table rows; detail identifiers only, single-line, at most 256 characters; non-verbose text exactly four keys and four lines. | NFR-1..NFR-9, §4.1 | Execution log; vocabulary and bounds assertions | Phases 1–4 |
| DoD-4 | Mutation evidence M-1..M-21 is recorded: each mutant applied, the named TC(s) observed red, the mutant reverted, and no mutant committed. | Test plan §10 | Mutation log | Phases 1–5 per the per-phase mutation split |
| DoD-5 | Exactly one changeset is added — `.changeset/gh-277-harness-default-allowlist-minor.md` — declaring `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, and `@delivery-os/opencode` at `minor` with a non-empty body; no pre-existing changeset is modified; `TC-RELEASE-001` passes. | §4.1, DEC-5 | `tests/checks/privacy-release.test.ts` | Phase 4 |
| DoD-6 | The bounded real-dispatch evidence exists: one `dispatch <ref>` on the installed healthy opencode CLI with zero user configuration, run in a disposable clone outside this worktree, reaches classification with a token other than `dispatch.session.spawn-failed`, writes an attempt record, and produces no nested-lifecycle mutation and no tracked or untracked source change in this change's worktree. The worktree claim is the precise, achievable one: `git status --porcelain` after the proof equals the pre-run baseline captured immediately before it (including any expected uncommitted P4 artifacts such as the untracked `TDR-0021` record and the new changeset), `HEAD` is unchanged, and only gitignored build outputs are rewritten because the in-repo `pnpm build` refreshes `packages/*/dist` and `*.tsbuildinfo`. | F-8, AC-F8-1, AC-F8-2, RSK-6 | `TC-HDA-100`, `TC-HDA-101` manual evidence | Phase 4 |
| DoD-7 | The repaired default holds: `PATH` and `HOME` required, `TMPDIR` optional, `DELIVERY_WORK_PATH` injected, no model variable declared, and no undeclared parent variable present in the child. | F-1..F-4, AC-F1-3, AC-F1-4, NFR-3 | `TC-HDA-005`, `TC-HDA-010`, `TC-HDA-012` | Phases 1, 3 |
| DoD-8 | The diagnostic surface is delivered as pinned: the detail carries `kind` and `code` on every pre-session failure and `field` only when the failure carries one; verbose selection receives the parsed `--verbose` fact through the optional `HumanTextContext`; a two-parameter definition still compiles and behaves identically; non-verbose text stays four keys. | F-5, DM-3, DM-4, AC-F5-1..AC-F5-5 | `TC-HDA-029`..`TC-HDA-035` | Phases 2, 3 |
| DoD-9 | Current-truth documentation is reconciled through the system-spec update phase: the configuration default/entry shape, harness adapters descriptor and spawn narrative, dispatch engine spawn-failure envelope, result-contract data-bearing error field set, and adapter-ports descriptor; the `--verbose` human-mode meaning and the `CommandDefinition.humanText` hook (with its additive optional `HumanTextContext`) are reconciled in `doc/spec/features/feature-result-contract.md`, `doc/spec/features/feature-cli-entrypoint.md`, `doc/spec/features/feature-status-digest.md`, `doc/spec/features/feature-brief.md`, `doc/spec/features/feature-doctor.md`, and `doc/spec/features/feature-owner-gate-sla.md`; no stale claim remains. | §16, §22 | `@doc-syncer` reconciliation record | Lifecycle phase 7 (`system_spec_update`) |
| DoD-10 | No orphan TODO/FIXME marker, placeholder, or unowned follow-up introduced by the change remains in the delivered tree or change artifacts; remaining follow-ups (`OQ-2` discovered boot variables, Windows parity, and the other §7.3 deferred items) are named with an owner and a home, as recorded in §7.3 and §14. | §12, §14, §7.3 | Tree scan; review record | Phases 1–4 |
| DoD-11 | The lifecycle phase registry shows the `delivery` phase complete and all five declared plan phases complete, recorded only through the `phase` command family; no phase state is hand-edited; the PR URL is recorded as a pm-notes `notes:` entry at PR creation. | Delivery process | `phase list`; per-phase pm-notes `notes:` evidence | Phases 1–5; lifecycle boundary |
| DoD-12 | The gate battery is green on a clean tree: `pnpm typecheck`, `pnpm test`, `pnpm check:boundaries`, configuration schema/defaults parity, the secret-read boundary, and the aggregate `pnpm check` with the repo-local temp root. | NFR-9 | Gate logs | Phase 4 |
| DoD-13 | PR posture: one pull request targets `main-tools` and stays open for human review with the required CI jobs green on the pushed HEAD; merge and owner acceptance are not claimed. | §18 | PR record and CI run | Phase 4; lifecycle phase 11 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Deliver as one change on `fix/GH-277/harness-default-allowlist` with a single pull request to `main-tools`.
- No migration, feature flag, staged rollout, or user configuration change is required. The repair takes effect when the new defaults, builder, composition, and dispatch detail ship.
- Release obligation: add exactly one changeset, `.changeset/gh-277-harness-default-allowlist-minor.md`, declaring `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, and `@delivery-os/opencode` at `minor`, with a non-empty body, and modify no pre-existing changeset. This satisfies the `TC-RELEASE-001` invariant probed above; the plan owns the file.
- After merge, re-run one real dispatch on a default installation and record the observed result token.
- Communicate the operational consequence: a zero-configuration installation now forwards `PATH` and `HOME`, no longer requires `HARNESS_MODEL` or `HARNESS_SMALL_MODEL`, and reports the underlying spawn failure identity in JSON and verbose output. Non-verbose text is unchanged for bash continuity.
- If the bounded real proof discovers another required boot variable, land it in the same change before the pull request is finalized and record the evidence in the plan and PR.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No stored data is migrated, seeded, rewritten, or invalidated. No schema version or persisted shape changes. The configuration defaults artifact is regenerated from source, not migrated.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A. The change forwards two standard process variables (`PATH`, `HOME`) and one optional temporary-directory variable into a child process that the operator already controls. No personal-data field, new storage, new external recipient, or retention is added. The diagnostic detail carries variable names and closed failure codes only, never an environment value, credential material, prompt content, or stream content. Existing redaction and credential boundaries are unchanged.

## 21. SECURITY REVIEW HIGHLIGHTS

- Deny-by-default is preserved: the child receives only declared and present entries plus resolved credentials; no ambient inheritance is introduced.
- The optional marker cannot make a credential entry optional, and a literal secret value remains `config.secret.forbidden`.
- `PATH` and `HOME` are the minimum variables needed to execute the trusted harness and let it locate its own configuration; the parent environment is the operator's existing trust boundary.
- The diagnostic detail carries identifiers (`kind`, `code`, `field`) only and is bounded; it cannot become an environment dump or a secret-exfiltration path.
- The single host child-process site, the injected-environment-as-data rule, and the secret-read boundary are unchanged: the site stays the single production child-process module and now also observes child stdin before the prompt write, so an early child exit cannot surface as an unhandled stream error; the observer absorbs an `EPIPE` and any other stdin error without killing the child or classifying the result, so the child `error`/`close` events and the seam's bounds remain the only classifiers, and no new process primitive, failure code, or ambient read is added.
- No new dependency, network call, file write, or ambient environment read is added.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The default allowlist becomes a deliberate operational contract: adding a required entry can make a previously working installation fail closed, so a future default addition must be justified by a real boot requirement and covered by the regression matrix.
- `TMPDIR` is the first optional entry; the optional marker is the supported way to add a platform-variable entry that may legitimately be absent.
- The dispatch detail is an additive diagnostic surface; future nested failures can reuse the shape without changing the delivered dispatch identity.
- The system-spec update phase must reconcile the configuration default table, the harness environment descriptor and spawn narrative, the dispatch spawn-failure envelope narrative, the result-contract data-bearing error field set, and the adapter-ports descriptor description; it must also reconcile the `--verbose` human-mode meaning in `doc/spec/features/feature-result-contract.md` and `doc/spec/features/feature-cli-entrypoint.md` and the additive optional `HumanTextContext` on the `CommandDefinition.humanText` hook in `doc/spec/features/feature-status-digest.md`, `doc/spec/features/feature-brief.md`, `doc/spec/features/feature-doctor.md`, and `doc/spec/features/feature-owner-gate-sla.md`.
- The bounded real dispatch proof is the operational check that `HOME` is sufficient for the installed harness; a future harness that needs more must extend the default set deliberately.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Allowlist | The complete declared set of environment entries the child may receive. |
| Ambient inheritance | Copying all of the parent process environment into the child without declaration; explicitly forbidden. |
| Required entry | A declared variable that must be present in the parent or record; absence fails the spawn closed. |
| Optional entry | A declared variable that is forwarded when present and omitted when absent; absence does not fail the spawn. |
| Deny-by-default | The property that an undeclared parent variable is absent from the child. |
| Underlying harness failure | The classified `HarnessFailure` (kind, code, field, optional reference/status) produced before dispatch collapses a pre-session failure. |
| Pre-session spawn failure | A spawn or resume that fails before any session handle exists; dispatch records it as `dispatch.session.spawn-failed`. |
| POSIX host profile | The Linux and macOS host execution profile targeted by the default allowlist in this change. |

## 24. APPENDICES

### A. Current default allowlist (problem)

```
harness.environment:
  - HARNESS_MODEL          (required, unset in a real environment)
  - HARNESS_SMALL_MODEL    (required, unset in a real environment)
  - DELIVERY_WORK_PATH     (required, injected by composition)
# PATH  -> undeclared
# HOME  -> undeclared
# TMPDIR -> undeclared
```

Failure path: the first absent `HARNESS_MODEL` returns `harness.spawn.variable-missing`; if it were present, the child would still lack `PATH` and `HOME`.

### B. Proposed default allowlist

```
harness.environment:
  - PATH                   (required)
  - HOME                   (required)
  - TMPDIR                 (optional)
  - DELIVERY_WORK_PATH     (required, injected by composition)
# HARNESS_MODEL and HARNESS_SMALL_MODEL: not declared
# OC_ADOS_MAIN_MODEL and OC_ADOS_SMALL_MODEL: not mapped, not forwarded
```

An explicitly user-declared entry keeps its declared required or optional semantics.

### C. Diagnostic detail shape

```
data.error                 : DispatchEnvelopeError = CommandResultError + optional detail
data.error.code            = dispatch.session.spawn-failed        (unchanged identity)
data.error.detail          = present on every pre-session spawn failure
data.error.detail.kind     = harness | config                     (required)
data.error.detail.code     = harness.spawn.variable-missing | config.credential.missing | ...
data.error.detail.field    = <declared variable name>             (when the failure carries one)
data.lastMessage           = spawn failed before a session existed (unchanged)
```

`DispatchEnvelopeError` is declared in `packages/core/src/contracts/dispatch.ts` and is the delivered `CommandResultError` (code, category, retryable, consequence, remediationHint, summary) plus `detail?: { kind: "harness" | "config"; code: string; field?: string }`. `CommandResultError` and every other envelope are unchanged. The detail is additive, optional in the type because other dispatch error rows do not carry it, identifiers only, single-line, at most 256 characters, and introduces no new error code, delivery-result token, classifier row, or error-table row.

The detail is attached whenever an underlying `HarnessFailure` is available, which is every pre-session spawn or resume failure; the failure's `kind` and `code` are required and always present, and `field` appears only when the failure carries one. There is no detail-less variant on that branch, and no detail is fabricated where no underlying failure exists.

The detail contains no values and no secrets. Non-verbose text remains:

```
result=<token>
pr_url=<url>
exit_code=<digit>
last_message=<bounded single line>
```

### D. Source evidence index

| Fact | Evidence |
|---|---|
| Shipped default allowlist declares the two model variables and the work path only. | `packages/core/src/config/defaults.ts:45-63` |
| The builder is deny-by-default and hard-fails on the first absent declared variable with the field. | `packages/core/src/domain/harness-spawn-env.ts:38-67` |
| A variable entry has no required/optional distinction. | `packages/core/src/contracts/harness.ts:120-148` |
| The configuration branch accepts `name`/`credentialRef`, rejects literal `value`, and rejects extra keys. | `packages/core/src/config/harness.ts:110-145`, `packages/core/src/config/catalog.ts:276-318` |
| Production composition maps the allowlist and injects `DELIVERY_WORK_PATH`; the command is the bare name `opencode`. | `packages/cli/src/production.ts:423-447,462` |
| Dispatch collapses a pre-session failure and discards the underlying failure. | `packages/core/src/app/dispatch.ts:466-485` |
| The dispatch `data.error` slot is typed `CommandResultError`, which has no detail or field slot. | `packages/core/src/contracts/dispatch.ts:277-296`, `packages/core/src/contracts/result.ts:36-43` |
| Every envelope's top-level error is assembled from the error-table entry, so widening `CommandResultError` would widen every envelope; a dispatch-specific type is required for the detail. | `packages/cli/src/index.ts:262-272` |
| The harness failure already carries `kind` (`harness`/`config`), `code`, and optional `field`, which is the detail shape. | `packages/core/src/contracts/harness.ts:306-314` |
| A pre-session spawn failure returns a data-bearing result (a success envelope), so no stderr failure diagnostic is produced for it. | `packages/core/src/app/dispatch.ts:347-389`, `packages/core/src/app/dispatch.ts:466-485` |
| Non-verbose text emits exactly four keys, and the dispatch command selects that renderer as its human text. | `packages/cli/src/output/dispatch-text.ts:28-34`, `packages/cli/src/commands/dispatch.ts:133-149` |
| `--verbose` is parsed in `runCli` and consumed only by the output writer, where it selects the full envelope over the scripted one-line trim; the shared stderr diagnostic is not verbose-gated and carries no dispatch data. | `packages/cli/src/index.ts:298-303`, `packages/cli/src/index.ts:317`, `packages/cli/src/output/serialize.ts:69-82`, `packages/cli/src/output/serialize.ts:97-98` |
| `CommandDefinition.humanText` is a published two-parameter type declared as `(data, brand)` and invoked with exactly two arguments, and the parsed `--verbose` fact is not passed to it. | `packages/cli/src/index.ts:51,351-353`; direct two-argument calls at `tests/structure/watchdog-imports.test.ts:226` and `tests/behaviour/verify-gates-output.test.ts:199` |
| Configuration inspection is `config get <key> [--show-origin]`, and `--show-origin` is accepted only with `get`. | `packages/cli/src/commands/config.ts:96-99`, `packages/cli/src/commands/config.ts:102-155` |
| The standalone record for the optional marker. | `doc/decisions/TDR-0021-additive-optional-harness-environment-marker.md` |
| The harness failure identity already exists in the error table. | `packages/core/src/contracts/error-table.ts:1001-1011` |
| The release invariant requires one five-package minor changeset when `packages/**` changes. | `tests/checks/privacy-release.test.ts:1-100,133-170` |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-09 | `@spec-writer` | Initial specification for GH-277. |
| 1.1 | 2026-11-09 | `@spec-writer` | Specification-phase corrections after test planning; all AC ids stable. Added `TDR-0021` to `links.decisions` and to the §13 "Governed by" row, and closed RSK-7 accordingly. Named the delivered verbose/diagnostic channel accurately: the detail is attached in `packages/core/src/app/dispatch.ts` (`errorOf`, pre-session path), machine JSON flows through the whole-envelope writer, non-verbose text is `renderDispatchText`, verbose selection is the dispatch command's human-text seam, and `--verbose` is parsed in `packages/cli/src/index.ts` and consumed only by the output writer (§2.1, §16). Named the dispatch-specific error type `DispatchEnvelopeError` (DM-3, §8.3, §8.5, §16, Appendix C), leaving `CommandResultError` and every other envelope unchanged. Named the inspection invocation `config get harness.environment --show-origin` in AC-F6-3 and §8.3. |
| 1.2 | 2026-11-09 | `@spec-writer` | DoR iteration 1 remediation; all AC ids stable. B-1 (undeclared public-contract change): added DM-4 for the additive optional `HumanTextContext` widening of the published `CommandDefinition.humanText` — the third parameter is optional, so existing two-parameter definitions and direct two-argument calls stay valid — with a §8.5 backward-compatibility bullet, a §16 seam declaration, a §2.1 current-state observation, an Appendix D evidence row, and an AC-F5-3 seam assertion. B-3 (unreachable detail case): stated the detail-attachment rule in F-5 and Appendix C — every pre-session failure carries a `HarnessFailure`, `kind` and `code` are always present, `field` only when carried — and aligned AC-F5-1, NFR-5, the §4.1 metric, §1, §6, and §10. B-6 (missing Definition of Done): added §17.1 binding all 29 ACs, all 29 test-plan TCs, NFR-1..NFR-9, M-1..M-20, the single added changeset, the bounded real dispatch, current-truth reconciliation, orphan-TODO cleanup, phase-registry completion, the gate battery, and PR posture to named evidence and plan phases. |
| 1.3 | 2026-11-09 | `@spec-writer` | DoR iteration 2 remediation; all AC and DoD ids stable. B (unachievable worktree claim): reworded DoD-6 from "mutates no file" to the precise claim — no nested-lifecycle mutation and no tracked or untracked source change, `git status --porcelain` after equals the pre-run baseline (including expected uncommitted P4 artifacts such as the untracked `TDR-0021` record and the new changeset), `HEAD` unchanged, and only gitignored build outputs (`packages/*/dist`, `*.tsbuildinfo`) rewritten by the in-repo `pnpm build`. Phase-7 handoff nit: named the files that carry the `--verbose` human-mode meaning (`feature-result-contract.md`, `feature-cli-entrypoint.md`) and the `CommandDefinition.humanText` hook (`feature-status-digest.md`, `feature-brief.md`, `feature-doctor.md`, `feature-owner-gate-sla.md`) in the §16 current-truth row, DoD-9, and the §22 bullet. |
| 1.4 | 2026-11-09 | `@spec-writer` | DoR iteration 3 remediation; all AC, DoD, and OQ ids stable. Closed the DoD-10 owner gap: §7.3 deferred items are now a table whose every item names owner `@pm` and a concrete home, and §14 gained `Owner` and `Home` columns so OQ-2 is owned by `@pm` with its home in §7.3/§14 and its closure evidence named as `TC-HDA-100`/`TC-HDA-101`; DoD-10 now points to those owner and home records. No new work, ACs, or DoD items were introduced. |
| 1.5 | 2026-11-10 | `@spec-writer` | Review iteration 3 R3-1 scope reconciliation for an already-delivered, review-mandated fix; all AC, DoD, DEC, and OQ ids stable, and no new work was introduced. The host spawn seams observe child stdin before the prompt write — `EPIPE` is a benign early exit, any other stdin error is classified as a spawn failure with status 127 — and the synthetic default-spawn fixture drains stdin. Reconciled the binding artifacts: §7.1 lists the guard at both seams and the fixture drain; §7.2 no longer excludes the delivered starter/runner change and now excludes only lifecycle, timeout, kill-escalation, buffering, and classifier changes; AC-F4-1 keeps its intent and states that the site stays the single child-process module and carries the guard; §21 states the same correction; §16 adds `packages/adapters/src/host/index.ts` and `tests/behaviour/harness-host-stream.test.ts`; DEC-7 records the review-mandated reliability fix as adding no API, contract, failure code, or process primitive. |
| 1.6 | 2026-11-10 | `@spec-writer` | Review iteration 4 F-1 remediation: the Definition of Done no longer lags the plan and test plan delivered in the same commit. DoD-2 now requires all 30 test-plan scenarios (the added `TC-HDA-036`), DoD-4 now requires M-1..M-21 (the added mutant), and DoD-11 now requires all five declared plan phases (the added remediation phase); the §17.1 preamble and the validation checklist carry the same counts. §16 records the new host stdin guard suite (a dedicated process-global module-mock suite, since removed after the CI root cause) and the extension of `tests/behaviour/harness-host-stream.test.ts` for that guard. All AC, DoD, DEC, and OQ ids are stable and no new work was added. |
| 1.7 | 2026-11-10 | `@spec-writer` | CI remediation: DEC-7 and AC-F4-1 corrected to the delivered benign stdin observer; no AC, DoD, DEC, or OQ id added or removed and no scope change. The prior clause classified any non-`EPIPE` stdin error as a spawn failure with status 127, but a stdin error fires at pipe teardown on the CI runner before the child produces output, so that clause fabricated a 127 for every host-seam spawn. The corrected claim: stdin errors ('EPIPE' from an early-exit child included) are observed and never synthesize a spawn result, while the child `error`/`close` events and the seam's existing handle and session bounds own classification. Rolled into §7.1, §13, §15 DEC-7, §16 (host adapters and both host suites), and §21; test plan v1.8 and `doc/spec/features/feature-harness-adapters.md` carry the same correction. |
| 1.8 | 2026-11-10 | `@spec-writer` | CI root-cause remediation: the process-global `node:child_process` module mock in the dedicated stdin-error suite corrupted async spawn for every later suite in the shared Bun test process (spawn returned status 0 with empty stdout for all async variants, while `spawnSync` still worked), so every red CI run included that suite. The mock suite is deleted and §16 no longer names it; TC-HDA-036 keeps its real-child `EPIPE` legs in `tests/behaviour/harness-host-stream.test.ts`, and a read-only guard in `tests/behaviour/harness-stream-hygiene.test.ts` rejects the pattern in any test file. No AC, DoD, DEC, OQ, or product-code change; test plan v1.9 and the harness-adapters feature spec carry the same correction. |

---

## AUTHORING GUIDELINES

This specification was authored from the GH-277 ticket, the PM's verified root-cause evidence, the delivered configuration layer, harness contract, spawn-environment builder, host runner, production composition, dispatch engine, dispatch output, and the current feature specs. It resolves the ticket's two design directions as DEC-1 through DEC-3, keeps the dispatch identity and closed vocabularies unchanged in DEC-4, records the probed release obligation in DEC-5, records the POSIX scope boundary in DEC-6, and records the review-mandated host stdin early-close guard and fixture drain in DEC-7 as a reliability fix that adds no API, contract, failure code, or process primitive. Implementation sequencing, test file placement, fixture mechanics, and the bounded real-dispatch procedure belong to the plan and test plan.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (`GH-277`)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] Change-specific Definition of Done present (§17.1) — binds all 29 ACs, all 30 test-plan TCs, NFR-1..NFR-9, M-1..M-21, the single added changeset, the bounded real dispatch, current-truth reconciliation, orphan-TODO cleanup, phase-registry completion, the gate battery, and PR posture
- [x] No implementation tasks or step-by-step delivery instructions
- [x] No content duplicated from linked docs
- [x] Front matter validates per `front_matter_rules`
