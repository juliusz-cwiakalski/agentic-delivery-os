---
ados_distribution: internal
id: SPEC-DOCTOR
status: Current
created: 2026-11-06
last_updated: 2026-11-07
owners: ["engineering"]
service: delivery-os
summary: "The read-only doctor command and its bounded delivery.doctor.v1 report: five checks in fixed order (repo, tracker, provider, state, ci), the closed ok/fail/unreachable verdicts, eleven evidence sources, four evidence outcomes, twenty-two reasons, one closed hint template per condition, the structured httpStatus credential-rejection classification, read limits of 50 tracker items and 20 check runs, machine/human bounds, the doctor.check.failed error identity with its deterministic failure summary, per-check containment, quota-free provider diagnosis, the delivery and retro registry store verdicts in the state check, and zero-write execution."
links:
  related_changes: ["GH-224", "GH-229", "GH-232", "GH-236"]
  related_decisions: ["ADR-0003", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/doctor.ts"
---

# Feature: Doctor

## Overview

The doctor command is the read-only pre-flight diagnostic of a delivery environment. It answers one question before a session starts: is this checkout, tracker connection, provider configuration, state store, and CI connection wired well enough to deliver? It runs exactly five checks in a fixed order — `repo`, `tracker`, `provider`, `state`, `ci` — and reports one verdict per check from the closed set `ok`, `fail`, `unreachable`.

Every non-ok verdict carries a bounded factual detail, bounded structured evidence, and a non-empty fix hint. The command never repairs, never writes, never runs the provider engine, and never fetches quota. Its output is `delivery.doctor.v1`: a schema version, an injected `generatedAt`, the shared repository binding, exactly five checks, and summary counts. Machine mode is the standard `CommandResult` envelope; human mode is a deterministic five-line report plus one hint line per non-ok check.

The outcome model follows the delivered verify-change precedent. An all-ok run returns a success envelope with the report as `data` and exit `0`. A run with at least one non-ok check returns the single classified error `doctor.check.failed` and exit `1`; the failure envelope carries no `data`, and its deterministic one-line summary names every failing check with its verdict and fix hint in fixed area order. A doctor run that cannot complete outside per-check execution projects exit `2` through the existing classification chain.

Doctor is the read-only consumer of the delivered status-style bounded reads: the `origin`-derived repository binding, one bounded tracker list page, and one bounded check-runs page. It is also a read-only consumer of the resolved provider configuration, the pure structural chain resolution, the credential port, and the verified provider park/announcement fold and state-store reads. It shares that store read with the fold, performs at most two network reads, and executes zero writes, zero fence acquisitions, zero state mutations, zero network writes, and zero child processes.

The surrounding contracts are described in [Result Contract and Error Table](feature-result-contract.md), [Status Digest](feature-status-digest.md), [Provider Engine](feature-provider-engine.md), [State Layer](feature-state-layer.md), [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md), and [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md). Package tiers and runtime confinement follow [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md); the outcome and exit model follows [TDR-0005](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md).

## Business Context

### Problem Statement

- **Problem:** Broken delivery wiring surfaces mid-delivery, after tokens and quota have been spent, as a confusing downstream failure far from its cause. There is no single pre-session command that proves the repository binding, tracker credential, provider configuration, state stores, and CI read all work, and no stable exit vocabulary that scripts and agents can branch on.
- **Affected Users:** Operators starting a delivery session, the coordinator, lifecycle agents, and maintainers of the repository, tracker, provider, and state surfaces.
- **Business Impact:** A pre-flight diagnostic with named findings and prescriptions converts late, expensive failures into early, actionable ones, and a stable exit taxonomy replaces ad-hoc environment probes.

### Goals

- Provide one read-only `doctor` command with no positionals and no command-specific flags beyond the global `--json`.
- Run five named checks in a fixed order, each with one closed verdict, bounded evidence, and a bounded detail.
- Attach a non-empty, action-first, secret-free fix hint to every non-ok verdict, unconditionally.
- Keep exit codes stable: all-ok `0`, any non-ok `1`, doctor unable to run `2`.
- Contain every check failure inside its own check without crashing, aborting siblings, or silencing the run.
- Never report an unobserved read as `ok`, and never present a false all-clear.
- Diagnose provider wiring without fetching quota, calling the provider engine, or writing a park or announcement.
- Keep the command deterministic, bounded, brand-neutral, and read-only.

## User Experience & Functionality

### Command surface

The command is exactly `doctor`, composed beside `status`, `brief`, `board`, `queue`, and the other top-level commands. It accepts no positionals and declares no command-specific flags; `--json` is the global machine-output switch and adds no doctor behavior. An unexpected positional or unknown flag is rejected by the parser before any source read as `fallback.invocation` with exit `1`. There is no `--fix-hints` flag: hints are part of the contract.

The handler owns no stream write and chooses no exit code. It collects the injected facts, runs the five checks inside their containment boundaries, aggregates the report, and returns `data` or a classified failure; the CLI edge renders the human text or the machine envelope and projects the exit code.

### Checks in fixed order

| Order | Area | Declared evidence sources | Network posture |
|---:|---|---|---|
| 1 | `repo` | `checkout`, `remote-binding` | Local only |
| 2 | `tracker` | `remote-binding`, `credential`, `tracker-read` | One bounded list page at `DOCTOR_TRACKER_READ_LIMIT` |
| 3 | `provider` | `provider-config`, `provider-credential`, `provider-parks`, `provider-announcements` | Local only; no quota endpoint, no engine call |
| 4 | `state` | `state-stores` | Local only; verified store read shared with the provider fold |
| 5 | `ci` | `remote-binding`, `credential`, `commit`, `ci-read` | One bounded check-runs page at `DOCTOR_CI_READ_LIMIT` |

Shared sources are resolved once and reused: the checkout facts and binding feed the repo, tracker, and CI checks; the tracker credential feeds the tracker and CI checks; the provider ledger read feeds both the provider fold and the state check. When the retro read is composed, the state check also verifies the retro registry through its validated boundary and contributes a `retro-registry` store verdict; that read is verified, acquires no fence, and writes nothing.

### Verdict derivation matrix

The matrix is normative. Within one check, precedence follows the condition order below: a locally observable defect wins over a later dependency failure.

| Check | `ok` | `fail` | `unreachable` |
|---|---|---|---|
| `repo` | readable work tree, clean working tree, `origin` resolves to a GitHub binding | dirty working tree (`checkout-dirty`); missing, unparseable, or non-GitHub `origin` (`remote-unresolvable`) | unreadable checkout facts (`checkout-unreadable`); contained execution (`check-unreachable`) |
| `tracker` | binding resolved, credential resolvable, one bounded read succeeded, including an observed-empty page | credential unresolvable (`credential-unavailable`); read rejected with structured `httpStatus` 401 or 403 (`credential-rejected`) | binding unresolved so the read was not attempted (`not-attempted`); any other non-2xx response or transport failure (`read-failed`); contained execution (`check-unreachable`) |
| `provider` | provider configuration read succeeded, a default chain is declared and structurally resolvable, enabled entries' credential references resolve, the park/announcement fold is readable; active capacity, environment, and loop-cap parks are reported without flipping the verdict | configuration-resolution failure (`config-invalid`); provider-branch validation failure (`provider-chain-unresolved`); no default chain declared (`provider-chain-not-declared`); credential reference unresolvable (`credential-unavailable`); active park with a credential cause (`park-credential-cause`) | park/announcement fold read failure (`state-unreadable`); contained execution (`check-unreachable`) |
| `state` | every delivered store (the delivery registry and, when composed, the retro registry) verifies, including verified-empty | torn store (`store-torn`); schema mismatch (`store-schema-mismatch`); permission failure (`store-unreadable`); undeclared record kind or payload schema (`store-unknown`) | store facts unreadable beyond the classified conditions (`check-unreachable`) |
| `ci` | binding resolved, credential resolvable, HEAD commit resolved, one bounded check-runs read succeeded, including zero runs | credential unresolvable (`credential-unavailable`); read rejected with structured `httpStatus` 401 or 403 (`credential-rejected`); commit unresolved (`commit-unresolved`) | binding unresolved so the read was not attempted (`not-attempted`); any other non-2xx response or transport failure (`read-failed`); contained execution (`check-unreachable`) |

Build health is never part of the `ci` verdict: failed runs do not flip it, because doctor checks wiring, not CI results. Base-branch conformance is not evaluated in v1; the repo check reports observed branch and HEAD facts only, because no global declared base source exists. A configuration failure reaches only the provider check as tolerant read evidence and never aborts the run.

### Closed vocabulary

Verdicts (3): `ok`, `fail`, `unreachable`. `ok` means every required source read for the check succeeded and every evaluated wiring condition holds. `fail` means a wiring defect was observed. `unreachable` means the check could not obtain its evidence. Both non-ok verdicts are failing checks: they carry a detail and a fix hint and they drive exit `1`.

Evidence sources (11):

| Source | Meaning |
|---|---|
| `checkout` | Local work-tree facts and HEAD |
| `remote-binding` | The `origin`-derived repository binding |
| `credential` | Tracker/CI credential presence through the credential port |
| `tracker-read` | One bounded tracker list read |
| `provider-config` | The tolerant provider-configuration read |
| `provider-credential` | Enabled provider entries' credential-reference presence |
| `provider-parks` | The verified park fold |
| `provider-announcements` | Persisted provider announcements in the verified fold |
| `state-stores` | The verified state-store read |
| `commit` | The resolved checkout HEAD commit |
| `ci-read` | One bounded check-runs read |

Evidence outcomes (4): `read` (a performed successful read), `observed-empty` (a successful verified-empty or zero-run result), `failed` (a performed read that failed), and `not-configured` (a source absent by configuration or skipped because a dependency was unavailable).

Reasons (22, declared order): `observed`, `observed-empty`, `checkout-dirty`, `checkout-unreadable`, `remote-unresolvable`, `credential-unavailable`, `credential-rejected`, `read-failed`, `not-attempted`, `config-invalid`, `provider-chain-not-declared`, `provider-chain-unresolved`, `park-active`, `park-credential-cause`, `announcement-recorded`, `store-torn`, `store-schema-mismatch`, `store-unreadable`, `store-unknown`, `commit-unresolved`, `state-unreadable`, `check-unreachable`. Reasons never invent values; they are unique per check and ordered by first occurrence.

### Condition catalog and fix hints

Every non-ok condition has exactly one verdict and exactly one hint template. Templates substitute identifiers only: `{envVar}`, `{providerName}`, `{sourceKey}`, `{failureCode}`, and `{area}`. Values (secrets, remote prose, raw payloads) are never interpolated.

| Condition | Check | Verdict | Evidence reason | Fix-hint template |
|---|---|---|---|---|
| `repo.checkout-dirty` | repo | `fail` | `checkout-dirty` | commit or discard the uncommitted changes, then re-run doctor |
| `repo.remote-unresolvable` | repo | `fail` | `remote-unresolvable` | point the origin remote at a GitHub repository over https or ssh, then re-run doctor |
| `repo.checkout-unreadable` | repo | `unreachable` | `checkout-unreadable` | restore readable checkout facts for the work tree, then re-run doctor |
| `doctor.check.repo.unreachable` | repo | `unreachable` | `check-unreachable` | resolve the repo check failure described in its detail, then re-run doctor |
| `tracker.credential-unavailable` | tracker | `fail` | `credential-unavailable` | provide the tracker credential in the {envVar} environment variable, then re-run doctor |
| `tracker.credential-rejected` | tracker | `fail` | `credential-rejected` | replace or broaden the rejected credential through its declared environment source, then re-run doctor |
| `tracker.read-failed` | tracker | `unreachable` | `read-failed` | restore tracker reachability, then re-run doctor |
| `tracker.not-attempted` | tracker | `unreachable` | `not-attempted` | resolve the repository remote binding first (see the repo check finding), then re-run doctor |
| `doctor.check.tracker.unreachable` | tracker | `unreachable` | `check-unreachable` | resolve the tracker check failure described in its detail, then re-run doctor |
| `provider.config-invalid` | provider | `fail` | `config-invalid` | correct the named configuration source ({failureCode}), then re-run doctor |
| `provider.provider-chain-unresolved` | provider | `fail` | `provider-chain-unresolved` | correct the provider configuration so the declared default chain resolves, then re-run doctor |
| `provider.provider-chain-not-declared` | provider | `fail` | `provider-chain-not-declared` | declare a default provider chain in the provider configuration, then re-run doctor |
| `provider.credential-unavailable` | provider | `fail` | `credential-unavailable` | supply the credential for {providerName} through its declared source key {sourceKey}, then re-run doctor |
| `provider.park-credential-cause` | provider | `fail` | `park-credential-cause` | refresh the credential for {providerName}, then run provider quota --provider {providerName} |
| `provider.state-unreadable` | provider | `unreachable` | `state-unreadable` | repair the provider state store so parks and announcements read, then re-run doctor |
| `doctor.check.provider.unreachable` | provider | `unreachable` | `check-unreachable` | resolve the provider check failure described in its detail, then re-run doctor |
| `state.store-torn` | state | `fail` | `store-torn` | run the store salvage as a separate step, then re-run doctor |
| `state.store-schema-mismatch` | state | `fail` | `store-schema-mismatch` | use a compatible version or migrate the store, then re-run doctor |
| `state.store-unreadable` | state | `fail` | `store-unreadable` | fix the state store file permissions, then re-run doctor |
| `state.store-unknown` | state | `fail` | `store-unknown` | declare the record kind or use a compatible store version, then re-run doctor |
| `doctor.check.state.unreachable` | state | `unreachable` | `check-unreachable` | resolve the state check failure described in its detail, then re-run doctor |
| `ci.credential-unavailable` | ci | `fail` | `credential-unavailable` | provide the tracker credential in the {envVar} environment variable, then re-run doctor |
| `ci.credential-rejected` | ci | `fail` | `credential-rejected` | replace or broaden the rejected credential through its declared environment source, then re-run doctor |
| `ci.commit-unresolved` | ci | `fail` | `commit-unresolved` | run from a branch with a resolved HEAD commit, then re-run doctor |
| `ci.read-failed` | ci | `unreachable` | `read-failed` | restore CI read reachability, then re-run doctor |
| `ci.not-attempted` | ci | `unreachable` | `not-attempted` | resolve the repository remote binding first (see the repo check finding), then re-run doctor |
| `doctor.check.ci.unreachable` | ci | `unreachable` | `check-unreachable` | resolve the ci check failure described in its detail, then re-run doctor |

Detail lines are factual and bounded: a clean repo reports `clean work tree on <branch> at <shortSha>` or `detached HEAD at <shortSha>`; a dirty repo says the working tree has uncommitted changes; tracker and CI successes report the observed item or run count (or an explicitly empty page); a credential park names the subject, cause, and expiry; a neutral park names the subject, cause, expiry, and the `provider quota --provider <name>` directive; provider announcements are listed by their closed codes (at most three).

### Provider check semantics

The provider check reads only local evidence: the resolved provider configuration, the structural resolution of the declared default chain against declared entries, credential presence for enabled entries that declare a quota policy, and the verified park/announcement fold. A successful run reports neutral parks in the detail with cause, expiry, and a `provider quota --provider <name>` directive. Active parks with cause `credential-missing` or `credential-rejected` fail the check. The five wiring-neutral causes are `peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, and `reevaluation-cap`.

The delivered provider-configuration read exposes exactly two tolerant failure reasons: `config-invalid` (a resolver failure carrying a classified `config.*` code) and `provider-chain-unresolved` (a provider-branch validation failure carrying `failureCode: "config.value.invalid"`). Both are provider-check `fail` evidence; neither aborts the run. The check never calls `provider resolve`, never calls `provider quota`, never injects or uses the quota transport, and never evaluates a peak or quota condition.

### Evidence model

Each check carries a bounded evidence record:

```ts
type DoctorEvidence = {
  sources: { source: DoctorEvidenceSource; outcome: DoctorEvidenceOutcome }[];
  reasons: DoctorEvidenceReason[];
  failureCode?: string;
  failureClass?: string;
  httpStatus?: number;
};
```

Sources are deduplicated by source id and capped at four; reasons are deduplicated and capped at four. Both keep first-occurrence order. `failureCode` appears only for a classified `config.*` or `state.*` failure. `failureClass` may record an adapter-local class such as `provider.payload.invalid` as data; it is never an error-table identity. `httpStatus` is the optional structured numeric status carried by a failed wiring read.

The credential-rejection classification is derived only from `httpStatus` 401 or 403. Remote prose is never parsed, copied into evidence, or used to classify anything. Evidence carries no raw provider payload, response body, credential material, or repository file content.

Representative source outcomes: an unreadable repo records `checkout: failed` plus the binding outcome; a tracker credential failure records `credential: failed` and `tracker-read: not-configured`; an unattempted tracker or CI read records `remote-binding: failed` and the read source `not-configured`; a provider configuration failure records `provider-config: failed`; a provider fold failure records `provider-parks: failed`; a verified-empty delivery or retro registry records `state-stores: observed-empty`; an observed-empty tracker or CI page records the read source `observed-empty`.

### Bounds and read limits

| Constant | Value | Purpose |
|---|---|---|
| `DOCTOR_TRACKER_READ_LIMIT` | 50 | One bounded tracker list page |
| `DOCTOR_CI_READ_LIMIT` | 20 | One bounded check-runs page |
| `DOCTOR_MAX_DETAIL_CHARS` | 200 | Detail text cap |
| `DOCTOR_MAX_HINT_CHARS` | 200 | Fix-hint text cap |
| `DOCTOR_MAX_MACHINE_BYTES` | 65536 | Serialized `data` report cap |
| `DOCTOR_MAX_HUMAN_LINES` | 24 | Human report line cap |
| `DOCTOR_MAX_HUMAN_BYTES` | 4096 | Human report byte cap |
| `DOCTOR_MAX_EVIDENCE_SOURCES` | 4 | Evidence source cap |
| `DOCTOR_MAX_EVIDENCE_REASONS` | 4 | Unique reason cap |

Both network reads are single-page: no pagination and no retries. Bounds are contract constants, not configuration keys.

### Outcome and exit model

| Outcome | Envelope | Exit |
|---|---|---|
| Every check `ok` | Success; `data` is the `delivery.doctor.v1` report | `0` |
| At least one check non-ok | Error `doctor.check.failed`; no `data` | `1` |
| Doctor cannot complete outside per-check execution | Existing classification chain (`fallback.internal` or a platform-category identity) | `2` |

The failure summary is one deterministic line in fixed area order:

```text
doctor check failures (<n>/5) — <area> (<verdict>): <fixHint>[; <area> (<verdict>): <fixHint>]…
```

Entries are separated by `; `, non-failing checks never appear, newlines collapse, and each hint is the declared condition template with identifier substitution only. Two byte-binding examples:

```text
doctor check failures (1/5) — provider (fail): refresh the credential for provider-c, then run provider quota --provider provider-c
doctor check failures (2/5) — repo (fail): commit or discard the uncommitted changes, then re-run doctor; tracker (unreachable): restore tracker reachability, then re-run doctor
```

The `doctor.check.failed` row is category `user`, non-retryable, consequence `not_landed`, projection `user-validation` (exit `1`), with the generic remediation hint "Resolve each named failing check using its fix hint, then re-run doctor." Check-level causes remain check data and never become error-table identities. No exit override exists outside the projection module.

### Per-check isolation contract

Each check's collection executes inside its own containment boundary (`runIsolatedDoctorCheck`). Any thrown value, rejected promise, malformed intermediate result, missing result, or mismatched facts becomes that check's `unreachable` verdict with `doctor.check.<area>.unreachable`, a bounded detail, and a fix hint. It never crashes the command, never aborts a sibling check, and never resolves through `fallback.internal`. All five checks always run, and the report is aggregated only after all five complete.

`fallback.internal` and platform-category identities apply only outside per-check execution: composition of shared inputs, aggregation, envelope assembly, and serialization. Check-level containment never classifies a documented class.

### Human and machine output

`--json` emits exactly one standard `CommandResult` envelope on every outcome. Human mode renders a deterministic report from the same data with zero extra reads:

```text
<binary> doctor <owner>/<name>
repo     ok          clean work tree on feat/GH-224/doctor-v1 at 1111111
tracker  ok          tracker read succeeded (3 items)
provider ok          provider chain and credentials resolve; no active park
state    ok          state stores verified (4 records)
ci       ok          CI read succeeded (2 check runs)
  hint: commit or discard the uncommitted changes, then re-run doctor
```

The first header line appears only when the repository binding is observed. Each check prints one line in fixed order with the verdict and bounded detail; each non-ok check adds one indented `hint:` line. The human report is bounded at 24 lines and 4096 bytes. On failure the human diagnostic additionally renders the same check report through the failure-text hook and writes the clinical diagnostic `<binary>: doctor.check.failed` plus `summary: <failure summary>`. The failure envelope still carries no `data`; the raw report object held by the failure is consumed only by that human hook and is never serialized into the error object.

### Renderer seam and consumers

Doctor supplies the optional pure `humanText` hook and the optional `humanFailureText` hook on the command-definition contract. Thirteen command declarers provide the human-text renderer: `board`, `brief`, `closeout`, `db`, `doctor`, `merge`, `plan`, `queue`, `retro`, `spend`, `status`, `verify`, and `watchdog`; the CLI-edge seam test pins that exact set. Doctor is an additional read-only consumer of the status-style renderer seam, not a new seam. This is the human rendering hook only; no doctor content is duplicated into the status digest.

## Technical Architecture & Codebase Map

### High-level design

The doctor vocabulary is runtime-neutral contract data. Pure aggregation lives in the core domain tier: verdict derivation, evidence construction, bounded detail and hint rendering, summary rendering, the human report, and the per-check containment runner. The CLI command definition owns injection, shared-source memoization, and fact collection. The runtime-aware edge owns configuration resolution, repository facts, GitHub clients, the credential port, the provider ledger read, and the injected clock. No new package, subpath, runtime-API location, configuration key, or state record kind is added.

### Core components and directory structure

| Path | Component | Responsibility |
|---|---|---|
| `packages/core/src/contracts/doctor.ts` | Doctor vocabulary | Areas, verdicts, sources, outcomes, reasons, area-to-source map, condition catalog with hint templates, wiring-neutral causes, credential-rejection statuses, read limits, bounds, report and facts types, schema version, summary prefix and separator. |
| `packages/core/src/domain/doctor.ts` | Pure aggregation | Appendix A derivation with precedence, evidence construction with dedupe and caps, bounded detail/hint rendering, `runIsolatedDoctorCheck`, `aggregateDoctorReport`, `formatDoctorFailureSummary`, and `renderDoctorHuman`. Imports contracts only. |
| `packages/cli/src/commands/doctor.ts` | Command definition | Declares no flags and `positionals.max` of `0`, memoizes shared sources, collects per-area facts, runs each check inside containment, returns the report or the classified failure with its failure-text hook. |
| `packages/cli/src/edge.ts` | Runtime composition | `DoctorComposition` and `createDoctorCommandRuntime` build the injected readers from repository facts, the GitHub client, the credential port, the provider ledger, and the injected clock; `createProductionDependencies` composes the command beside the other commands. |
| `packages/core/src/contracts/error-table.ts` | Failure identity | The `doctor` domain kind and the single `doctor.check.failed` row. |
| `packages/adapters/src/io/provider-transport.ts` | Read-failure status | The optional structured `httpStatus` on the adapter-local payload and not-found failures. |
| `packages/adapters/src/github/client.ts` | GitHub read slice | Carries the numeric status on non-2xx responses; transport failures omit it. |
| `packages/core/src/provider/parks.ts` | Verified fold | The provider park/announcement fold the edge reads once. |
| `packages/adapters/src/repo/index.ts` | Repository facts | Checkout, HEAD, and `origin` remote facts. |
| `packages/core/src/contracts/result.ts` | Envelope | The standard success/failure envelope the command returns into. |

### Data flow

1. The edge resolves brand and configuration, builds the repository facts, the GitHub client, the credential port, and the provider ledger read, and injects them with the clock.
2. The command definition reads each shared source lazily and memoizes it, so the checkout, tracker credential, HEAD, provider configuration, provider fold, and state truth are each read at most once per run.
3. Each check's collection runs inside `runIsolatedDoctorCheck`; a failure yields a contained result for that area only.
4. `aggregateDoctorReport` derives each check from the collected facts in fixed area order, builds evidence, and assembles summary counts.
5. An all-ok report becomes success `data`; otherwise `formatDoctorFailureSummary` renders the deterministic failure line and the handler returns the classified `doctor.check.failed` failure.
6. The CLI edge builds the envelope, projects `{0, 1, 2}`, renders human text when requested, and serializes through the redaction chokepoint.

### API and interface contracts

Contract data in `packages/core/src/contracts/doctor.ts`:

- `DOCTOR_AREAS`, `DOCTOR_VERDICTS`, `DOCTOR_EVIDENCE_SOURCES`, `DOCTOR_EVIDENCE_OUTCOMES`, `DOCTOR_EVIDENCE_REASONS`, `DOCTOR_AREA_SOURCES`, `DOCTOR_CONDITION_CATALOG`, `DOCTOR_WIRING_NEUTRAL_CONDITIONS`, `DOCTOR_CREDENTIAL_REJECTION_STATUSES`.
- `DOCTOR_TRACKER_READ_LIMIT`, `DOCTOR_CI_READ_LIMIT`, `DOCTOR_MAX_DETAIL_CHARS`, `DOCTOR_MAX_HINT_CHARS`, `DOCTOR_MAX_MACHINE_BYTES`, `DOCTOR_MAX_HUMAN_LINES`, `DOCTOR_MAX_HUMAN_BYTES`, `DOCTOR_MAX_EVIDENCE_SOURCES`, `DOCTOR_MAX_EVIDENCE_REASONS`.
- `DOCTOR_SCHEMA_VERSION`, `DOCTOR_SUMMARY_PREFIX`, `DOCTOR_SUMMARY_SEPARATOR`.
- Types: `DoctorReport`, `DoctorCheck`, `DoctorEvidence`, `DoctorSummaryCounts`, `DoctorRepositoryBinding`, `DoctorAreaFacts`, `DoctorCheckResult`, `DoctorCheckInputs`, and the injected fact types for each area.

Pure domain functions in `packages/core/src/domain/doctor.ts`:

- `runIsolatedDoctorCheck(area, execute)` returns the check result or a contained `unreachable` result.
- `aggregateDoctorReport(inputs)` returns the bounded `DoctorReport`.
- `formatDoctorFailureSummary(checks)` returns the deterministic summary line.
- `renderDoctorHuman(report, brand)` returns the bounded human report.

CLI surfaces:

- `createDoctorCommandDefinition(runtime, environmentPrefix?)` returns the `CommandDefinition`; `DoctorCommandRuntime` declares the injected readers and clock.
- `DoctorComposition` and `createDoctorCommandRuntime(options, resolveProviderConfig)` compose the readers at the edge.

## Security and Boundaries

- **Read-only by construction:** no write, fence, state mutation, network write, child process, repair, park clear, or store migration exists in the command. It cannot change the environment it diagnoses.
- **Credential centralization:** credential material is reachable only through `CredentialPort`; doctor code reads no ambient environment and adds no secret-read allowlist entry. Presence facts carry no material.
- **Bounded addressing:** only the `origin` remote is read; only a GitHub host binding is accepted; userinfo and credentials in a remote URL are discarded.
- **Bounded network surface:** at most two single-page reads at declared limits, no pagination, no retries, and no URL construction beyond the bound repository and the delivered read endpoints.
- **Closed output vocabulary:** verdicts, reasons, details, and hints come from declared contract data with identifier substitution only. Remote-controlled prose never reaches output.
- **Redaction and privacy:** the serialization chokepoint covers the envelope, the failure summary, and human diagnostics; evidence carries no payload, response body, credential, or repository content; no telemetry or event is emitted.
- **Containment discipline:** check-internal failures become bounded `unreachable` verdicts; containment identities never classify documented classes; `fallback.internal` remains outside the check boundary.
- **Brand neutrality:** no product or binary literal is committed; human output uses the injected brand binary name.
- **Denial-of-service:** aggregation is linear over the fixed five-check report with no recursion, unbounded loop, or retry storm.

## Non-Functional Requirements

| ID | Requirement | Measurable guarantee |
|---|---|---|
| NFR-1 | Check totality | Exactly 5 checks in fixed order on every completed run; 100% closed-set verdicts; 100% non-empty details; 100% hint presence on non-ok; 0 missing or extra checks |
| NFR-2 | Never-crash guarantee | 0 crashes, 0 aborted sibling checks, 0 escapes from per-check containment; every contained check names `doctor.check.<area>.unreachable` |
| NFR-3 | Evidence truthfulness | 0 failed, absent, or unattempted reads rendered `ok`; 0 fabricated details; 0 non-ok verdicts with empty detail or hint; 0 active parks omitted from provider detail |
| NFR-4 | Exit stability | 100% all-ok runs at exit `0`; 100% any-non-ok runs at exit `1` with `doctor.check.failed`; 100% unable-to-run outcomes projected through the existing chain; 0 exits outside `{0, 1, 2}`; 0 failure envelopes carrying `data`; 0 exit overrides outside the projection module |
| NFR-5 | Provider quota safety | 0 quota fetches; 0 provider-engine `resolve` calls; 0 park or announcement writes; 0 quota-transport injections |
| NFR-6 | Read-only determinism | 0 writes; 0 fence acquisitions; 0 state mutations; 0 network writes; 0 child processes; 0 output drift on identical injected inputs |
| NFR-7 | Cost bounds | ≤ 2 single-page network reads per run; 0 pagination or retries; ≤ 1 configuration resolve; 0 duplicated shared store reads; pure aggregation ≤ 50 ms median on the reference environment |
| NFR-8 | Output bounds | 100% `--json` runs emit exactly one valid envelope; human report ≤ 24 lines and ≤ 4096 bytes; serialized `data` ≤ 65 536 bytes |
| NFR-9 | Error-table binding | Exactly 1 new row; 0 two-way documented-table drift; 0 existing rows modified; sync corpora and fixtures cover the new row |
| NFR-10 | Boundaries, branding, privacy | 0 new runtime-API locations; 0 new secret-read allowlist entries; 0 product literals; 0 secrets or remote prose in details, hints, evidence, summaries, or diagnostics; 0 planted-secret canary escapes |

## Quality Assurance Strategy

### Testing approach

| Level | Location | Scope |
|---|---|---|
| Structure | `tests/structure/doctor-contract.test.ts`, `tests/structure/doctor-imports.test.ts` | Closed vocabulary, catalog integrity, constants and bounds, data-only contracts, pure-domain imports, and export discipline |
| Behaviour | `tests/behaviour/doctor-*.test.ts` (verdict matrix, repo, tracker, provider, state, CI, isolation, negative controls, outcome, output, performance, read-only determinism, network posture, structured HTTP status) | Appendix A derivation, per-check evidence, containment, summary grammar, bounds, read budget, zero network and zero spawn posture, determinism |
| Golden | `tests/golden/doctor-output.test.ts` with `tests/fixtures/doctor/golden/**` | Byte-identical success envelope, success and mixed human reports, and both Appendix B failure summaries |
| Checks | `tests/checks/error-table-sync.test.ts`, `tests/checks/exit-code-literals.test.ts` | The one new row stays synchronized; no call-site exit literals |

The suite is fixture-driven with zero live network, zero live credentials, and zero child processes.

### Test data and scenarios

| Fixture | Contents |
|---|---|
| `tests/fixtures/doctor/harness.ts` | Injected world builder, fake runtime with read counters, and the in-process CLI runner |
| `tests/fixtures/doctor/matrix/cases.ts` | One case per declared condition plus within-check precedence cases |
| `tests/fixtures/doctor/http-status/cases.ts` | 401/403 rejection, 404/500/503 read failures, and timeout/absent-status shapes with conflicting prose proving classification derives only from `httpStatus` |
| `tests/fixtures/doctor/golden/success.json` | Byte-binding all-ok success envelope |
| `tests/fixtures/doctor/golden/success-human.txt`, `mixed-human.txt` | Byte-binding human reports |
| `tests/fixtures/doctor/golden/summary-1-of-5.txt`, `summary-2-of-5.txt` | Byte-binding failure summaries |
| `tests/fixtures/providers/github/read-failure-statuses.json` | Non-2xx and transport read-failure shapes referenced by `GH-PAYLOAD-HTTP-STATUS` |

The negative-control matrix covers a failed tracker read, an unattempted tracker read, a failed CI read, a missing credential, a torn store, an undeclared provider chain, an unreadable provider fold, and a contained check-internal throw. Isolation tests inject thrown values, rejected promises, and malformed intermediate results per area. Performance measures the median of 21 runs after three warm-ups.

## Operational & Support

### Configuration

Doctor adds no configuration key and no doctor configuration branch. Read limits and output bounds are contract constants. The edge injects the clock, the credential port, the repository facts, the GitHub client, the provider configuration read, the provider ledger read, and the local work-tree fact; the handler reads no ambient environment.

### Observability

The report is the observability surface: `generatedAt`, the repository binding, each check's verdict, bounded detail, evidence, and fix hint, the summary counts, the deterministic failure summary, and the stable exit code. Doctor adds no telemetry, metric exporter, trace span, or event sink. Provider announcements and engine telemetry remain owned by the provider engine.

### Cost and read cost

One run performs at most two network reads, one configuration resolve, and one verified provider-ledger read shared by the provider fold and the state check. Repo, provider, and state checks are local. The pure aggregation is linear over the fixed five-check report and stays at or below 50 ms median on the reference environment.

### Maintenance

- Adding a wiring condition is a contract change: catalog entry with verdict and hint template, derivation-matrix row, fixtures, and documentation move together.
- Adding a sixth area (for example the M3 memory family) is a spec amendment with a new area id, sources, conditions, and matrix rows; it is not a runtime branch.
- Hint wording is contract data; a wording change updates contract, fixtures, and documentation together and must stay action-first and secret-free.
- The GitHub trap catalog remains the early-warning surface for the two inherited reads; doctor adds no read and extends no catalog.
- The `doctor` error kind grows by explicit additive rows under the same sync discipline; check-level causes remain evidence.

## Dependencies & Risks

- **Depends on** the result contract and error table ([feature-result-contract.md](feature-result-contract.md)) for the envelope, classification chain, `{0, 1, 2}` projection, containment entries, redaction chokepoint, and the `doctor` kind with its single row.
- **Depends on** the status digest ([feature-status-digest.md](feature-status-digest.md)) for the `origin`-derived binding, bounded single-page GitHub list and check-runs reads, verified park-fold consumption, closed-evidence rules, and the optional human-renderer hook.
- **Depends on** the provider engine ([feature-provider-engine.md](feature-provider-engine.md)) for the typed provider branch, chain vocabulary, structural chain resolution, park causes, and persisted announcements.
- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for verified store reads, torn/schema/permission/unknown classification, and the provider park/announcement fold; doctor never writes or repairs.
- **Depends on** the retro evidence pipeline ([feature-retro-pipeline.md](feature-retro-pipeline.md)) for the `retro-registry` store verdict in the state check; the registry read is verified and write-free.
- **Depends on** the configuration layer ([feature-config-layer.md](feature-config-layer.md)), adapter ports and credential port ([feature-adapter-ports.md](feature-adapter-ports.md)), branding seam ([feature-branding-seam.md](feature-branding-seam.md)), and monorepo scaffold ([feature-monorepo-scaffold-toolchain.md](feature-monorepo-scaffold-toolchain.md)).
- **Depends on** the provider client seeds ([feature-provider-client-seeds.md](feature-provider-client-seeds.md)) for the two bounded GitHub reads and the structured `httpStatus` carried by non-2xx read failures.
- **Informed by** verify change and exit taxonomy ([feature-verify-change-and-exit-taxonomy.md](feature-verify-change-and-exit-taxonomy.md)) and [TDR-0005](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) for the classified failure envelope, deterministic multi-finding summary, envelope exclusivity, and exit projection.
- **Informed by** the watchdog lane contracts ([feature-watchdog-lane-contracts.md](feature-watchdog-lane-contracts.md)) for the dirty-checkout condition; doctor diagnoses it as wiring with a prescription and reuses no watchdog refusal identity.
- **Risk — false all-clear:** a failed, absent, or unattempted read could look `ok`. Mitigation: closed-evidence rules are normative per check, unattempted reads are `unreachable`, verified-empty and observed-empty are the only zero-claim paths, and the negative-control matrix is exhaustive.
- **Risk — quota burn:** the provider check could fetch quota. Mitigation: it reads configuration, credentials, parks, and announcements only; the quota transport is never injected; hints direct operators to `provider quota`.
- **Risk — secret or remote-prose leakage:** hints or details could carry secrets or provider text. Mitigation: closed catalog with identifier substitution, bounded sanitized details, the redaction chokepoint, and planted-secret canaries.
- **Risk — containment masking:** an `unreachable` verdict could hide a real defect. Mitigation: every unreachable verdict names the failed source and reason, carries an actionable hint, and is asserted by per-area isolation injections.
- **Risk — exit-code confusion:** check failures (`1`) could be confused with unable-to-run (`2`). Mitigation: the taxonomy is pinned, documented, golden-tested, and reachable only through the projection.
- **Risk — diagnostic drift:** doctor findings could diverge from watchdog or verify refusals. Mitigation: doctor is diagnostic-only, mirrors delivered guidance text without reusing refusal identities, and the complementary surfaces are documented together.
- **Risk — flake or latency:** network reads could make doctor slow or flaky. Mitigation: at most two single-page reads, no pagination or retries, shared sources read once, and a fixture-only default suite.
- **Risk — park fatigue:** routine capacity parks could train operators to ignore exit `1`. Mitigation: capacity, environment, and loop-cap parks are wiring-neutral; only credential-caused parks fail the check.
- **Risk — table or doc drift:** the new identity could diverge from its documented row. Mitigation: one row with structured fields and same-change sync coverage; both-direction drift fails closed.
- **Risk — scope creep:** doctor could grow into repair or extra areas. Mitigation: explicit non-goals, a closed condition catalog, and a spec amendment for any new area.

## Glossary & References

| Term | Definition |
|---|---|
| Wiring | The configuration, credential, binding, and reachability facts that let delivery commands work; distinct from delivery outcomes and build health. |
| Check | One of the five fixed doctor areas (`repo`, `tracker`, `provider`, `state`, `ci`) evaluated against declared conditions over injected sources. |
| Verdict | A check's outcome from the closed set `ok`, `fail`, `unreachable`; both non-ok values are failing checks. |
| `fail` | A wiring defect was observed: a locally observable defect, or a performed wiring read that returned a definitive defect. |
| `unreachable` | The check could not obtain its evidence: a required read was not attempted because a dependency is unavailable, the read attempt failed on transport, or the check's execution failed and was contained. |
| Fix hint | The action-first, secret-free prescription attached to every non-ok verdict, built from the closed condition catalog with identifier substitution only. |
| Per-check isolation | The containment boundary around each check's execution: internal failures become that check's `unreachable` verdict and never crash, abort, or escape the run. |
| Closed-evidence rule | An unobserved, failed, or unattempted read is never an `ok` verdict and never a fabricated detail; verified-empty and observed-empty are the only zero-claim paths. |
| Wiring-neutral park | An active provider park whose cause is capacity, environment, or loop-cap (`peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, `reevaluation-cap`); reported in detail with cause, expiry, and a `provider quota` directive, but not a wiring defect. |
| Credential-caused park | An active provider park with cause `credential-missing` or `credential-rejected`; a recorded wiring defect that fails the provider check. |
| Doctor-unable-to-run | Failures outside per-check execution (composition, aggregation, envelope assembly, serialization) classified through the existing chain; platform-category outcomes project exit `2`. |
| Failure summary | The deterministic one-line summary on the `doctor.check.failed` envelope naming every failing check with its verdict and fix hint in fixed area order. |
| Doctor report | The `delivery.doctor.v1` success payload: schema version, generation time, repository binding, five checks, and summary counts. |

See also: [repository glossary](../../overview/glossary.md), [Result Contract and Error Table](feature-result-contract.md), [Status Digest](feature-status-digest.md), [Provider Engine](feature-provider-engine.md), [State Layer](feature-state-layer.md), [Retro Evidence Pipeline](feature-retro-pipeline.md), [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md), [Verify Change and Exit Taxonomy](feature-verify-change-and-exit-taxonomy.md), [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), and [TDR-0005](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md).
