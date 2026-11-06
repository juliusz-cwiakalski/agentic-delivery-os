---
id: chg-GH-224-doctor-v1
status: Proposed
created: 2026-11-06T00:00:00Z
last_updated: 2026-11-06T00:00:00Z
owners: [engineering]
service: delivery-os CLI doctor command
labels: [change, planning]
links:
  change_spec: ./chg-GH-224-spec.md
  test_plan: ./chg-GH-224-test-plan.md
  machine_plan: ./chg-GH-224-plan.yaml
  decision_refs:
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
    - ../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md
  related:
    - ../../../spec/features/feature-result-contract.md
    - ../../../spec/features/feature-status-digest.md
    - ../../../spec/features/feature-provider-engine.md
    - ../../../spec/features/feature-provider-client-seeds.md
    - ../../../spec/features/feature-state-layer.md
    - ../../../spec/features/feature-config-layer.md
    - ../../../spec/features/feature-adapter-ports.md
    - ../../../spec/features/feature-verify-change-and-exit-taxonomy.md
    - ../../../spec/features/feature-plan-schema.md
    - ../../../spec/features/feature-monorepo-scaffold-toolchain.md
    - ../../../planning/oss-tooling/cli-command-registry.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
summary: >-
  Deliver M1-S3 per spec v1.1: one read-only `doctor` command that runs exactly
  five checks in fixed order (repo, tracker, provider, state, ci), each with one
  verdict from the closed ok/fail/unreachable set, bounded evidence, a
  deterministic detail, and an unconditional fix hint on every non-ok verdict;
  per-check isolation (never crashes, never aborts siblings); the verify-change
  outcome model (all-ok success data + exit 0; any non-ok one classified
  `doctor.check.failed` envelope + exit 1 with the Appendix B deterministic
  summary; unable-to-run through the existing projection + exit 2); the
  additive optional structured `httpStatus` on the adapter-local read-failure
  types supplied by the GitHub read slice with one trap-catalog entry; the
  additive `doctor` error kind with exactly one row under the binding sync
  discipline; zero quota/engine/write activity; and the 64 KiB / 24-line /
  4096-byte / 200-char / 4-source / 4-reason bounds as doctor-scoped contract
  constants.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-224: M1-S3: doctor v1

> **Artifact pair.** This markdown plan is the human/coder narrative. The
> machine-readable declaration `chg-GH-224-plan.yaml` (`delivery.plan.v1`,
> delivered by GH-226) mirrors the same seven phases and wins for tooling
> (`plan validate`, `plan diff`, `run-plan`); this file remains the binding
> task-level detail. Both files describe one plan.

## Context and Goals

- **Work item**: GH-224 — M1-S3: doctor v1 (`feat/GH-224/doctor-v1`, targets `main-tools`).
- **Inputs (authoritative, read in full by this pass)**:
  - [chg-GH-224-spec.md](./chg-GH-224-spec.md) — **v1.1** (2026-11-06): F-1..F-12, AC-F1-1..AC-F12-2 (21), NFR-1..NFR-10, DM-1..DM-8 (incl. the 22-value DM-6 reason set and the DM-4 `failureClass`/`httpStatus` rules), RSK-1..RSK-10, DEC-1..DEC-12, OQ-1..OQ-3, Appendix A (verdict derivation matrix with precedence), Appendix B (evidence application + binding failure-summary goldens).
  - [chg-GH-224-test-plan.md](./chg-GH-224-test-plan.md) — **v1.1** (2026-11-06; 31 TCs TC-DOCTOR-001..031; 21/21 ACs, 10/10 NFRs, 8/8 DMs, 10/10 spec risks covered): §4.1 in-process harness contract and §4.2 non-vacuity contract are binding; §5.2 scenario steps/control lists; §7 execution order + evidence commands; §8 assumptions (A-T1..A-T12) and open questions (OQ-T4/T6/T7/T9 open and delivery-bound — all pinned below).
  - [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) (tiers/runtime-API confinement), [TDR-0005](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) (exit taxonomy), [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md), [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md), [feature-plan-schema.md](../../../spec/features/feature-plan-schema.md) (plan artifact contract).
  - Baseline code read: `packages/core/src/contracts/{result,error-table,provider,status,plan}.ts`, `packages/core/src/domain/status.ts` (collector + `failureClassOf` precedent), `packages/core/src/provider/{parks,announcements,validate,chain}.ts`, `packages/core/src/state/{index,registry}.ts`, `packages/adapters/src/io/provider-transport.ts` (`ProviderPayloadFailure`/`ProviderNotFoundFailure` — the DEC-11 seam), `packages/adapters/src/github/client.ts` (`get`/`send` non-2xx paths where the numeric status is currently dropped into prose), `packages/adapters/src/repo/index.ts`, `packages/cli/src/{index,classify,projection,edge}.ts`, `packages/cli/src/commands/{status,verify,queue,brief}.ts`, `packages/cli/src/output/serialize.ts`, `scripts/checks/error-table-sync.ts`, `tests/{structure,behaviour,checks,boundaries,golden,fixtures}` corpora layout, `.changeset/config.json`.
- **Status**: Proposed (awaiting the Definition of Ready gate, lifecycle phase 5).
- **Baseline**: `feat/GH-224/doctor-v1` at `f6bf7f2b`; `main-tools` at `47270b37`. Dependencies verified merged: GH-172 result contract, GH-173 config layer, GH-174 state layer, GH-175 status digest (PR #209), GH-177 verify change, GH-181 adapter ports, GH-182 provider engine (PR #202), GH-221 watchdog, GH-226 plan schema.
- **No behavioural spec/test-plan inconsistency found.** Two wording frictions are recorded and pinned (not conflicts; Appendix B and the TC steps stay authoritative):
  1. Spec F-4 calls the tracker read-failure hint the "check-the-credential-and-reachability" hint while the binding Appendix B golden (asserted byte-for-byte by TC-DOCTOR-015 step 3 and TC-DOCTOR-027) renders `restore tracker reachability, then re-run doctor`. The plan pins the Appendix B string as the template and treats F-4's phrase as the descriptive label (the test plan uses both the same way).
  2. Spec §7.1/§8.5 name the additive `httpStatus` field on "the shared adapter-local payload-failure type", while TC-DOCTOR-031 step 3 also asserts a 404 carries `httpStatus: 404` under the `provider.not-found` identity (a sibling adapter-local failure type). The plan adds the optional field to both adapter-local read-failure constructors — type-additive either way, no new identity — satisfying the spec's "supplied on every non-2xx response" intent and the TC exactly.

**Goals** (spec §4): one read-only pre-flight `doctor` answering "is this environment wired for delivery?" — five checks, closed verdicts, truthful evidence, unconditional fix hints, stable exits `{0,1,2}`, at most two bounded single-page network reads, zero writes/quota/engine activity, deterministic bounded output, and full contract/tier/brand discipline (G-1..G-11).

**Delivery model**: `@coder` executes Phases 1–6 in order, each ending in exactly one Conventional Commit and a green phase gate (`pnpm check` exit 0 plus the phase's focused suites). Phase 7 is the documentation/spec reconciliation owned by **`@doc-syncer`** (lifecycle phase 7, `system_spec_update`); `@coder` must not perform it or mark it complete — the coder's obligation ends with the Phase 6 doc-impact handoff. Dependency order: **1 → 2 → 3 → 4 → 5 → 6 → 7** (3 needs only 1; it is ordered before 4 so the command composes over the finished read surface). Phase 1 lands the complete contract vocabulary, the error row, and the additive adapter field so every later phase consumes one vocabulary home and the error-table sync stays green from the first commit boundary.

**Open questions resolved by this plan** (delivery-bound items the test plan left open; all pinned in [Delivery Bindings](#delivery-bindings-d1d14)):

- **OQ-T4 / GAP-5 (numeric read limits)** → D5: `DOCTOR_TRACKER_READ_LIMIT = 50`, `DOCTOR_CI_READ_LIMIT = 20`.
- **OQ-T6 / GAP-6 (hint-template catalog)** → D6: the full closed catalog below; the two Appendix B examples are reproduced verbatim.
- **OQ-T9 / RSK-T8 (50 ms tolerance)** → D12: median-of-21 measurement of the pure aggregator only, environment recorded, bound never relaxed.
- **OQ-T7 / GAP-7 (doc-distribution verification)** → D13: no redistributable doc changes; the new feature spec declares `ados_distribution: internal`; the distribution guard runs in the Phase 6 and 7 gates regardless.
- Spec OQ-1..OQ-3 stay non-blocking and out of this change (base-branch conformance, live smoke, announcement recency).

## Pinned Delivery Spellings (binding for delivery)

The test plan leaves export names, runtime type names, helper names, non-Appendix-B hint wording, human line labels, and fixture file names delivery-bound (GAP-8/A-T4). The vocabulary, order, verdicts, sources, reasons, bounds, schema version, identity, and summary grammar come from the spec and may not be rebound. This section pins the spellings; changing one later reopens this plan (route through `@pm`/`@decision-advisor`, never apply silently).

### Contract module — `packages/core/src/contracts/doctor.ts` (new, data and types only)

Exported constants (exact names and values):

| Constant | Value |
|---|---|
| `DOCTOR_SCHEMA_VERSION` | `"delivery.doctor.v1"` |
| `DOCTOR_AREAS` | `["repo", "tracker", "provider", "state", "ci"]` |
| `DOCTOR_VERDICTS` | `["ok", "fail", "unreachable"]` |
| `DOCTOR_EVIDENCE_SOURCES` | the eleven DM-5 ids: `checkout`, `remote-binding`, `credential`, `tracker-read`, `provider-config`, `provider-credential`, `provider-parks`, `provider-announcements`, `state-stores`, `commit`, `ci-read` |
| `DOCTOR_EVIDENCE_OUTCOMES` | `["read", "observed-empty", "failed", "not-configured"]` |
| `DOCTOR_EVIDENCE_REASONS` | the twenty-two DM-6 values in declared order: `observed`, `observed-empty`, `checkout-dirty`, `checkout-unreadable`, `remote-unresolvable`, `credential-unavailable`, `credential-rejected`, `read-failed`, `not-attempted`, `config-invalid`, `provider-chain-not-declared`, `provider-chain-unresolved`, `park-active`, `park-credential-cause`, `announcement-recorded`, `store-torn`, `store-schema-mismatch`, `store-unreadable`, `store-unknown`, `commit-unresolved`, `state-unreadable`, `check-unreachable` |
| `DOCTOR_AREA_SOURCES` | the DM-5 mapping: repo → `checkout`, `remote-binding`; tracker → `remote-binding`, `credential`, `tracker-read`; provider → `provider-config`, `provider-credential`, `provider-parks`, `provider-announcements`; state → `state-stores`; ci → `remote-binding`, `credential`, `commit`, `ci-read` |
| `DOCTOR_CONDITION_CATALOG` | one entry per closed condition (below), each `{ condition, area, verdict, hintTemplate }`; no condition maps to two verdicts; `park-active` and `announcement-recorded` are detail-only reasons (never flip a verdict, DEC-6) |
| `DOCTOR_CREDENTIAL_REJECTION_STATUSES` | `[401, 403]` |
| `DOCTOR_TRACKER_READ_LIMIT` | `50` (D5) |
| `DOCTOR_CI_READ_LIMIT` | `20` (D5) |
| `DOCTOR_MAX_DETAIL_CHARS` | `200` |
| `DOCTOR_MAX_HINT_CHARS` | `200` |
| `DOCTOR_MAX_MACHINE_BYTES` | `65536` |
| `DOCTOR_MAX_HUMAN_LINES` | `24` |
| `DOCTOR_MAX_HUMAN_BYTES` | `4096` |
| `DOCTOR_MAX_EVIDENCE_SOURCES` | `4` |
| `DOCTOR_MAX_EVIDENCE_REASONS` | `4` |
| `DOCTOR_SUMMARY_GRAMMAR` | `"doctor check failures (<n>/5) — <area> (<verdict>): <fixHint>[; …]"` prefix constant + `"; "` separator constant (DM-7) |

Exported types (exact names): `DoctorArea`, `DoctorVerdict`, `DoctorEvidenceSource`, `DoctorEvidenceOutcome`, `DoctorEvidenceReason`, `DoctorConditionId`, `DoctorCondition`, `DoctorEvidence`, `DoctorCheck`, `DoctorReport`, `DoctorSummaryCounts`, `DoctorRepositoryBinding`, `DoctorReadFailure`, `DoctorWiringRead`, `DoctorProviderConfigRead` (reuses the delivered two-reason shape), `DoctorParkFoldRead`, `DoctorStateStoresRead`, `DoctorCheckoutFacts`, `DoctorCheckInputs`, `DoctorCheckResult`.

- **Report shape (DM-1/DM-2)**: `DoctorReport` = `{ schemaVersion, generatedAt, repository, checks, summary }`; `summary` is exactly `{ total: 5, ok, fail, unreachable }`. `DoctorCheck` = `{ area, verdict, detail, fixHint?, evidence }` with `fixHint` present iff non-ok; `detail` non-empty and ≤200 chars on every check. The unavailable `repository` shape carries no owner/name/credential material.
- **Evidence (DM-4)**: `{ sources: [{ source, outcome }], reasons: [unique, first-occurrence order], failureCode?, failureClass?, httpStatus? }` — ≤4 sources, ≤4 reasons; `failureCode` only existing `config.*`/`state.*` codes; `failureClass` adapter-local, never an identity; `httpStatus` optional numeric; `credential-rejected` derived only from `httpStatus` ∈ {401, 403}; prose is never copied or parsed.
- **No status-cap import (DEC-10)**: the doctor module does not import any `STATUS_*` constant and shares no caps module with status.

### Domain module — `packages/core/src/domain/doctor.ts` (new)

Exported functions only:

- `aggregateDoctorReport(inputs: DoctorCheckInputs): DoctorReport` — pure; Appendix A verdict derivation with left-to-right precedence (an observed `fail` outranks a later dependency `unreachable`), evidence construction (dedupe, first-occurrence order, 4/4 caps), detail/hint rendering from the condition catalog with safe identifier substitution and 200-char bounds, and the summary counts. No I/O, clock, randomness, or ambient access; `generatedAt`/`nowMs` arrive through the inputs.
- `formatDoctorFailureSummary(checks: readonly DoctorCheck[]): string` — pure DM-7 grammar: `doctor check failures (<n>/5) — <area> (<verdict>): <fixHint>[; <area> (<verdict>): <fixHint>]…` in fixed area order, newlines collapsed, non-failing checks absent.
- `renderDoctorHuman(report: DoctorReport, brand: BrandIdentity): string` — pure; one line per check in fixed order (`<area> <verdict> <detail>`, optionally a header using `brand.binaryName` when the binding is observed) plus one indented fix-hint line per non-ok check; bounded at 24 lines / 4096 bytes with deterministic clamping; derived only from the report.
- `runIsolatedDoctorCheck(area: DoctorArea, execute: () => Promise<DoctorCheckResult>): Promise<DoctorCheckResult>` — the per-check containment container (F-8): any thrown value, rejected promise, or malformed intermediate result becomes that area's `unreachable` verdict with condition `doctor.check.<area>.unreachable` (reason `check-unreachable`), a bounded detail naming the failed source, and the catalog hint; it never rethrows, never resolves through `fallback.internal`, and never aborts siblings.

Internal (not exported) helpers own the condition→verdict table application. No additional exported executable names.

### CLI and adapter spellings

- `packages/cli/src/commands/doctor.ts` (new): `DoctorCommandRuntime` and `createDoctorCommandDefinition(runtime)`.
  - `DoctorCommandRuntime` = `{ readRepository(): DoctorCheckoutFacts; resolveTrackerCredential(): CredentialPresenceResult; readTrackerPage(target, limit): Promise<DoctorWiringRead>; resolveHeadCommit(): CommitResolution; readCheckRuns(sha, limit): Promise<DoctorWiringRead>; readProviderConfig(): DoctorProviderConfigRead; resolveProviderCredential(ref): CredentialPresenceResult; readParkFold(nowMs): DoctorParkFoldRead; readStateStores(): DoctorStateStoresRead; nowIso(): string; nowMs(): number }` (exact member set delivery-tunable; the read-once sharing contract is not).
  - `createDoctorCommandDefinition(runtime)` sets `flags: []`, `positionals: { max: 0 }`, `humanText: (data, brand) => renderDoctorHuman(data as DoctorReport, brand)` (the hook's ninth consumer: the delivered declarer set is brief, closeout, db, plan, queue, status, verify, watchdog), and an async handler that reads each shared source once, executes the five checks in `DOCTOR_AREAS` order each through `runIsolatedDoctorCheck`, aggregates via `aggregateDoctorReport`, and returns `{ data: report }` when every verdict is `ok`, else `{ error: { kind: "doctor", code: "doctor.check.failed", summary: formatDoctorFailureSummary(report.checks) } }`. The handler owns no stream write, no exit literal, no adapter/state import; it never returns per-check error envelopes.
- `packages/cli/src/edge.ts`: `DoctorComposition` and `createDoctorCommandRuntime(options, resolveProviderConfig)`; `ConfigProgramOptions.doctor?: DoctorComposition`, composed in `createConfigProgram` beside `status`/`brief`/`queue` (the `createStatusCommandRuntime` precedent): the credential-reference guard from status is reused (an instance that is not a GitHub `vcs` + `credential-reference` is refused before any client construction, so tracker/CI presence resolution reports `credential-unavailable` with `config.credential.missing` and zero transport calls); `resolveProviderConfig` (edge.ts:1295) is consumed as-is for the tolerant two-reason provider-config read; `readProviderParkViews(store, nowMs)` (plus the ledger's persisted announcements from the same verified read) supplies the park/announcement fold shared with the state check; repository binding/HEAD via `readRepositoryFacts` + `parseGitHubRemote`; the two wiring reads via the GitHub client at the declared limits.
- `packages/adapters/src/io/provider-transport.ts`: `ProviderPayloadFailure` and `ProviderNotFoundFailure` each gain `readonly httpStatus?: number` (optional, structured, secret-free); the constructors become `providerPayloadFailure(detail, httpStatus?)` and `providerNotFoundFailure(detail, httpStatus?)`. Type-additive: existing producers and consumers compile unchanged; `provider.payload.invalid` and `provider.not-found` remain the only identities; no new error-table row or adapter-local class.
- `packages/adapters/src/github/client.ts`: the `get`/`send` non-2xx paths pass `response.status` into the constructors (`404` → not-found with `httpStatus: 404`; every other non-2xx → payload failure with its status); transport/timeout catch paths omit the field. No other behavior change; no new exported name.
- GitHub trap catalog: exactly one new entry `GH-PAYLOAD-HTTP-STATUS` in `tests/fixtures/providers/traps/github.traps.json` (four fields: `trapName`, `providerBehavior`, `expectedNormalizedOutcome`, `fixtureReference`) with fixture `tests/fixtures/providers/github/read-failure-statuses.json` and its assertion in the trap harness; the closed operation set, capability declaration, and read count are unchanged.

### Error-table evolution (F-11, exactly one additive row)

- `DOMAIN_KINDS` gains `"doctor"` (after `"watchdog"`); `ERROR_TABLE` gains exactly:

```ts
{
  code: "doctor.check.failed",
  domainKind: "doctor",
  category: "user",
  retryable: false,
  consequence: "not_landed",
  remediationHint: "Resolve each named failing check using its fix hint, then re-run doctor.",
  projectionClass: "user-validation",
  summary: "One or more wiring checks failed.",
}
```

- The documented table in `doc/spec/features/feature-result-contract.md` gains the matching row and the `DOMAIN_KINDS` prose mentions `doctor` **in the same phase as the machine row** (the two-way sync check is part of `pnpm check`; a doc-only deferral would keep every later phase gate red). The corpora extend in the same change: `tests/fixtures/result/code-corpora/true-positives.json` += `doctor.check.failed` (`recognized: true`, `resolves: true`); `false-positives.json` += `doctor.check.repo.unreachable` (a check condition, never an identity — the negative proves check-level causes are not promoted). No existing row or kind changes; `fallback` stays reserved.

## Fix-hint catalog (D6 — one closed template per non-ok condition)

Substitution vocabulary (identifiers only, never values): `{providerName}`, `{envVar}`, `{sourceKey}`, `{area}`, `{failureCode}`. All templates ≤200 chars, action-first, secret-free, no remote-controlled prose. The three Appendix B strings are reproduced **verbatim** and are the binding goldens (TC-DOCTOR-015/027).

| Area | Condition | Verdict | Hint template |
|---|---|---|---|
| repo | `checkout-dirty` | fail | `commit or discard the uncommitted changes, then re-run doctor` *(Appendix B verbatim)* |
| repo | `remote-unresolvable` | fail | `point the origin remote at a GitHub repository over https or ssh, then re-run doctor` |
| repo | `checkout-unreadable` | unreachable | `restore readable checkout facts for the work tree, then re-run doctor` |
| tracker | `credential-unavailable` | fail | `provide the tracker credential in the {envVar} environment variable, then re-run doctor` |
| tracker | `credential-rejected` (401/403) | fail | `replace or broaden the rejected credential through its declared environment source, then re-run doctor` |
| tracker | `read-failed` (other non-2xx/transport/timeout) | unreachable | `restore tracker reachability, then re-run doctor` *(Appendix B verbatim)* |
| tracker | `not-attempted` (binding unresolvable) | unreachable | `resolve the repository remote binding first (see the repo check finding), then re-run doctor` |
| provider | `config-invalid` | fail | `correct the named configuration source ({failureCode}), then re-run doctor` |
| provider | `provider-chain-unresolved` | fail | `correct the provider configuration so the declared default chain resolves, then re-run doctor` |
| provider | `provider-chain-not-declared` | fail | `declare a default provider chain in the provider configuration, then re-run doctor` |
| provider | `credential-unavailable` | fail | `supply the credential for {providerName} through its declared source key {sourceKey}, then re-run doctor` |
| provider | `park-credential-cause` | fail | `refresh the credential for {providerName}, then run provider quota --provider {providerName}` *(Appendix B verbatim)* |
| provider | `state-unreadable` (fold) | unreachable | `repair the provider state store so parks and announcements read, then re-run doctor` |
| state | `store-torn` | fail | `run the store salvage as a separate step, then re-run doctor` |
| state | `store-schema-mismatch` | fail | `use a compatible version or migrate the store, then re-run doctor` |
| state | `store-unreadable` (permission) | fail | `fix the state store file permissions, then re-run doctor` |
| state | `store-unknown` | fail | `declare the record kind or use a compatible store version, then re-run doctor` |
| ci | `credential-unavailable` | fail | `provide the tracker credential in the {envVar} environment variable, then re-run doctor` (shared mechanism with tracker) |
| ci | `credential-rejected` (401/403) | fail | `replace or broaden the rejected credential through its declared environment source, then re-run doctor` (the one shared mechanism, DEC-11) |
| ci | `commit-unresolved` | fail | `run from a branch with a resolved HEAD commit, then re-run doctor` |
| ci | `read-failed` | unreachable | `restore CI read reachability, then re-run doctor` |
| ci | `not-attempted` (binding unresolvable) | unreachable | `resolve the repository remote binding first (see the repo check finding), then re-run doctor` |
| any | `check-unreachable` (contained) | unreachable | `resolve the {area} check failure described in its detail, then re-run doctor` |

Wiring-neutral detail (never a hint, never a verdict flip, DEC-6): an active `peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, or `reevaluation-cap` park renders in the provider check's detail with subject, cause, and expiry plus the directive `provider quota --provider <name>`; a persisted announcement renders as bounded detail (reason `announcement-recorded`). Ok verdicts never carry a hint.

## Delivery Bindings (D1..D14)

Binding for delivery; behaviour, pinned identities, reasons, bounds, exits, and AC mappings come from the spec/test plan and may not change (A-T1, A-T3).

- **D1 — Module layout**: new `packages/core/src/contracts/doctor.ts`, `packages/core/src/domain/doctor.ts`, `packages/cli/src/commands/doctor.ts`, `tests/fixtures/doctor/**` (harness, matrix, negative-controls, isolation, repo, tracker, ci, http-status, provider, bounds, golden), `tests/behaviour/doctor-*.test.ts`, `tests/structure/doctor-{contract,imports}.test.ts`, `tests/golden/doctor-output.test.ts`; extended `contracts/index.ts`, `domain/index.ts`, `core/src/index.ts`, `packages/adapters/src/io/provider-transport.ts`, `packages/adapters/src/github/client.ts`, `packages/cli/src/{commands/index.ts,edge.ts}`, `packages/core/src/contracts/error-table.ts`, `doc/spec/features/feature-result-contract.md` (documented row, Phase 1), the trap catalog + GitHub read-failure fixture, the error-table corpora, `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts` (`EXECUTABLE_ALLOWANCES`), `tests/fixtures/ports/v1-contract-inventory.json`, `tests/structure/cli-edge-seam.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/trap-catalog.test.ts`, `tests/behaviour/providers/github-collection.test.ts`, `tests/checks/{secret-read-boundary,forbidden-literals,exit-code-literals}.test.ts` (doctor cases), the planning pack man page, `.changeset/doctor-v1-minor.md`, and Phase 7 docs. No new package, subpath, package export, or runtime-API location.
- **D2 — Single vocabulary home**: every area, verdict, source, outcome, reason, condition, bound, limit, and the schema version are declared once in `contracts/doctor.ts`; the domain, command, edge, and renderer consume it; tests may hold independent oracles. No production module redeclares a vocabulary list; doctor imports no `STATUS_*` constant (DEC-10).
- **D3 — Domain purity**: `domain/doctor.ts` imports only `#contracts` and relative domain types; no `node:*`/`bun:*`, adapter, state, config, parser, file, clock, randomness, or environment access. All variable facts arrive through the inputs. Per-check containment (`runIsolatedDoctorCheck`) lives in the domain and catches everything inside the check boundary; `fallback.internal` never appears in doctor domain/contracts code (only the classification/projection modules use it).
- **D4 — Command purity and composition**: the doctor handler owns no stream writes and no exit codes; the parser grammar (`positionals.max: 0`, no flags) rejects extra input with `fallback.invocation` before any read; all reads are injected through `DoctorCommandRuntime`; `packages/cli/src/edge.ts` is the only composition point, composing doctor beside the existing commands over the shared `resolveProviderConfig` seam (the status/brief/queue precedent). Shared sources (binding, credential port, config resolve, store reads/park fold) are read once per run and reused across checks (G-8, TC-DOCTOR-025).
- **D5 — Read limits (OQ-T4 pinned)**: `DOCTOR_TRACKER_READ_LIMIT = 50` and `DOCTOR_CI_READ_LIMIT = 20`, doctor-scoped contract constants (DEC-10). Rationale following the status precedents (`STATUS_SOURCE_ITEM_LIMIT` 100, `STATUS_SOURCE_PIPELINE_LIMIT` 20): wiring proof needs reachability and auth, not enumeration, so the tracker page sits below the digest's enumeration limit while remaining a meaningful single page; the CI check-runs page mirrors the delivered check-runs limit exactly because it reads the same endpoint shape for the same wiring purpose. Each read sends exactly one page (`per_page` = the declared limit), no cursor, no pagination, no retry (DM-8, TC-DOCTOR-025).
- **D6 — Hint catalog (OQ-T6 pinned)**: the closed table above; one template per non-ok condition; the Appendix B strings verbatim; substitution limited to the five identifier tokens; wording changes are contract changes that move catalog, fixtures, goldens, and the feature-spec table together.
- **D7 — Outcome model**: all-ok → success envelope with the report as `data`, exit `0`; any non-ok → exactly one error envelope `{ kind: "doctor", code: "doctor.check.failed", summary }`, exit `1` (user-validation projection from the table, never a call-site literal); failure envelopes carry no `data`; unable-to-run (containment or platform-category failure outside per-check execution) projects exit `2` through the existing chain; `classifyDomainKind("doctor")` resolves via the single row; no `exitProjection` hook is used by doctor (the failure is an error envelope, not a negative success verdict).
- **D8 — Error-table evolution**: exactly one additive row + kind + documented row + corpora in Phase 1; `scripts/checks/error-table-sync.ts` and both mutation suites stay green; no existing row modified; check-level causes never become identities.
- **D9 — Fixture hygiene and non-vacuity**: committed fixtures are read-only; derived/mutated fixtures self-materialize under fresh `mkdtemp` roots; every negative/matrix/isolation/bounds case carries a distinctive `planted-doctor-*` canary and a restored-or-valid control; every recorder/stub/guard is proven live by a seeded deliberate call; goldens regenerate only by an explicit command; the live tree stays clean after every suite (test plan §4.1/§4.2 bind every suite).
- **D10 — Inline committer protocol for `@coder`**: exactly one Conventional Commit per phase with the completion signals below; explicit `git add` of exactly the phase's Files-and-modules entries; verify the staged set with `git status --porcelain` before committing; never stage `.ai/local/**`, `tmp/**`, or untracked scratch; `pnpm check` green before every commit with the log captured under `.ai/local/` (never staged); no push, no amend; a red gate blocks the commit. `@doc-syncer` owns Phase 7.
- **D11 — Changeset and evidence**: one minor changeset `.changeset/doctor-v1-minor.md` for the lockstep fixed five-package group (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`), mirroring `.changeset/brief-v1-minor.md`; brand-neutral summary, no product literal. Evidence recorded in `chg-GH-224-test-plan.md` §10 and the Phase 6 doc-impact handoff `chg-GH-224-doc-impact.md`; unrun evidence is never recorded as passing.
- **D12 — Performance measurement (OQ-T9 pinned)**: `tests/behaviour/doctor-performance.test.ts` measures **only** the pure `aggregateDoctorReport` over a cap-sized report: 3 warm-up runs, then the median of 21 measured runs via `performance.now()`; assert median ≤ 50 ms (the spec bound; never relaxed, never deleted); record the Bun version, platform, and measured median in the test output; a deliberately expensive control function proves the timer is live; correctness mutations still fail in the same suite. The aggregator is pure and linear over five checks (status precedent: 0.3 ms median), so the bound carries ~100× headroom — median-of-21 removes CI jitter without weakening the claim. If a CI environment still trips the bound, escalate to `@pm`/`@decision-advisor` per RSK-T8; never silently relax it.
- **D13 — Doc-distribution verification (OQ-T7 pinned)**: no redistributable doc (`doc/guides/**`, `doc/templates/**`, standalone docs) is intended to change; the new `doc/spec/features/feature-doctor.md` declares `ados_distribution: internal` (the sibling-spec convention, outside the guard's scan scope); `bash scripts/.tests/test-doc-distribution.sh` runs in the Phase 6 and Phase 7 gates regardless and must exit 0; if delivery must touch a redistributable doc, the changed file declares its `ados_distribution` marker and the guard is blocking.
- **D14 — No new CI/checks/config/state/secret surface**: the new suites are discovered by root `bun test`; the boundary/ambient/literal/entrypoint/error-table/secret-read gates extend to the new modules automatically; no new CI job, configuration key, state-schema change or record kind, package/subpath, runtime-API location, secret-read allowlist entry (stays exactly four), or product literal. No live smoke (OQ-2 deferred).

## Scope

### In Scope

- The `doctor` command surface, grammar, runtime composition, and the human-renderer hook's ninth consumer (extending the delivered eight-declarer set; F-1, F-10; AC-F1-1; Phases 4, 5).
- The complete `delivery.doctor.v1` vocabulary as data/types: areas/order, verdicts, condition catalog, evidence model, 22-value reason set, bounds, report/check shapes, failure-summary grammar (F-2, DM-1..DM-8; AC-F2-1, AC-F2-2; Phases 1, 2).
- Pure doctor aggregation: Appendix A verdict derivation with precedence, evidence/caps, summary counts, DM-7 summary rendering, human report, per-check isolation container (F-2, F-8, F-9, F-10; AC-F2-2, AC-F8-1; Phase 2).
- The five checks with their declared sources, the two tolerant provider-config failure reasons, park/announcement evidence rules, verified state reads, the shared 401/403 credential-rejection mechanism, and unattempted-read semantics (F-3..F-7; AC-F3-1..AC-F7-1; Phases 2, 4, 5).
- The additive optional structured `httpStatus` on the adapter-local read-failure types, supplied by the GitHub read slice on every non-2xx, with exactly one trap-catalog entry + fixture assertion (DEC-11; AC-F4-1, AC-F7-1; Phases 1, 3).
- The `doctor` domain kind + single `doctor.check.failed` row + documented row + corpora/sync coverage (F-11; AC-F11-1; Phase 1).
- Outcome/exit modelling, envelope exclusivity, exit taxonomy, and the deterministic failing-checks summary (F-9; AC-F9-1..AC-F9-3; Phases 2, 4, 5).
- Machine/human output bounds and goldens (F-10, DM-8; AC-F10-1; Phases 2, 5).
- The full test battery per the 31 TCs: matrix, negative controls, isolation, network posture, read-only/determinism, bounds, goldens, performance, structure/checks/boundaries (Phases 1–5).
- In-change planning-pack reconciliation (man-page `--fix-hints` drift), the minor changeset, doc-impact handoff, and the final local battery (Phase 6).
- The new current-truth feature spec and documentation/spec reconciliation (Phase 7, `@doc-syncer`).

### Out of Scope

- NG-1..NG-9 in full: any repair/`--fix` surface, merge/deploy/daemon/memory surfaces, live quota evaluation or provider-engine execution, CI build-health verdicts, base-branch conformance (OQ-1), new configuration keys/state schemas/packages/subpaths/runtime locations/allowlist entries, watchdog refusal identities, cross-repo/fleet/MCP/LLM surfaces, data-bearing failure envelopes or exit overrides.
- A live smoke (deferred with OQ-2); seed maintenance (OQ-T8 — the M1 seed scenario gap is recorded in the test plan §5.3, not fixed here).
- Publishing, merge, or owner acceptance.

### Constraints

- D1..D14 are binding.
- **Commit strategy**: exactly one Conventional Commit per phase with the completion signals below; explicit `git add` of the phase's files; never stage `.ai/local/**` or `tmp/**`; no push during delivery; no amend; `pnpm check` green before every commit (D10).
- Strict TypeScript, injected time/randomness/environment, runtime-API confinement, and `bun:test` authoring per [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md); suite layout and the gate battery per [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md); test plan §4.1 (in-process harness: `runCli`, injected brand/clock/run id/readers, no spawns) and §4.2 (non-vacuity) bind every doctor suite.
- `GITHUB_TOKEN` resolves only through `CredentialPort`; the secret-read allowlist stays exactly four entries; doctor source reads no ambient environment.
- Phase gate = the phase's focused suites green plus `pnpm check` exit 0; the five invariant checks (`error-table-sync`, `forbidden-literals`, `ambient-globals`, `exit-code-literals`, `workspace-entrypoints`) as applicable; doc-distribution in Phases 6–7.
- **Rollback and failure handling**: the change is fully additive — a single-PR revert removes contracts/domain/command/adapter-field/tests/fixtures/changeset/docs together, with no data cleanup (doctor wrote nothing). Never roll back one side of a documented-table, corpora, or inventory change without the other. A failing phase stops at its last green task boundary and reports; any discovered spec/test-plan inconsistency escalates to `@pm` — this plan never reshapes a TC (A-T3, A-T4).

### Risks (with plan anchors)

| ID | Risk | Impact | Prob. | Mitigation (anchor) |
|---|---|---|---|---|
| RSK-1/RSK-T1/T2 | A failed/unattempted/unread read becomes an ok verdict (false all-clear) | H | M | Closed-evidence rules in `aggregateDoctorReport`; Appendix A matrix cell-by-cell fixtures with one oracle per cell; the eight AC-F2-3 controls + four supplementary; restored controls; canaries (Phases 2, 5; TC-003/004/005/030) |
| RSK-2 | Doctor burns quota through the provider check | H | L | Wiring evidence only; quota transport never injected; counting stubs proven live by deliberate calls (Phase 5; TC-010) |
| RSK-3 | Hints/details leak secrets or remote prose | H | L | Closed catalog, identifier-only substitution, 200-char bounds, redaction chokepoint, planted canaries on every surface (Phases 1, 5; TC-018/019/023/026/031) |
| RSK-4 | Containment masks defects as vague unreachable | M | M | Contained verdicts carry `doctor.check.<area>.unreachable`, a bounded detail naming the failed source, and a catalog hint; isolation matrix 5×3 with sibling assertions (Phase 5; TC-013/014) |
| RSK-5 | Exit confusion between 1 and 2 | M | M | Outcome matrix pinned; provider config failures stay in-check (DEC-12); exit-literal/static scan; goldens (Phases 4, 5; TC-015/016/017) |
| RSK-6 | Findings drift from watchdog/verify refusals | M | M | Diagnostic-only posture; no `watchdog.*` reuse asserted; docs state complementarity (Phases 5, 7; TC-006/009/028) |
| RSK-7 | Network reads make doctor slow/flaky | M | M | ≤2 single-page reads at declared limits, no pagination/retries, zero-read binding-unresolved control; fixture-only default CI (Phase 5; TC-024/025) |
| RSK-8/RSK-T11 | `httpStatus` field dropped/mistyped/bypassed; classification from prose | H | M | DEC-11 pinned; 401/403 vs 404/500/503/timeout/absent fixtures with conflicting prose; string-status and 200-on-failure negatives; trap entry with bidirectional coverage (Phases 1, 3; TC-007/012/031) |
| RSK-9 | Error rows/docs drift | M | L | Machine row + documented row + corpora land together in Phase 1; both-direction mutation controls (TC-020/028) |
| RSK-10 | Scope creep into repair/extra areas | M | M | Closed condition catalog; non-goals pinned; quota-safety and no-new-surface gates (TC-010/022) |
| RSK-T6 | Bounds asserted by sampling | M | M | Under/at/over-cap fixtures for every bound in one suite (Phase 5; TC-018/019/026) |
| RSK-T8 | 50 ms measurement flaky on CI | M | M | D12: pure-aggregator median-of-21, environment recorded, ~100× headroom; escalate, never relax (Phase 5; TC-029) |
| RSK-P1 | A phase overruns | M | M | Stop at the last green task boundary and report; never enlarge or split the phase commit (D10) |
| RSK-P2 | Existing suites/inventories regress | M | M | `pnpm check` every phase; inventory/allowances updated in the same phase as each module (D1) |

### Success Metrics

- NFR-1: 5/5 checks in fixed order on every completed run; 100% valid verdicts, non-empty bounded detail, hint iff non-ok.
- NFR-2: 0 crashes/aborted siblings/unhandled escapes from inside checks.
- NFR-3: 0 false all-clears across the exhaustive negative-control matrix; 0 fabricated details.
- NFR-4: 100% exit mapping across the outcome matrix; 0 exits outside `{0,1,2}`; 0 overrides; 0 failure envelopes with `data`.
- NFR-5/NFR-6: 0 quota/resolve/write/fence/spawn activity; byte-identical replay.
- NFR-7: ≤2 single-page reads, 0 pagination/retries, ≤1 config resolve, 0 duplicated shared reads, pure aggregation ≤50 ms (D12).
- NFR-8: 100% one valid envelope; human ≤24 lines/4096 bytes; machine `data` ≤64 KiB.
- NFR-9: exactly 1 new row; 0 drift; corpora/fixtures in-change.
- NFR-10: 0 new locations/keys/allowlist entries/literals/secret escapes.
- Aggregate: all 31 TCs green with recorded evidence; `pnpm check` exit 0; clean tree after every suite.

## Phases

### Phase 1: Doctor contracts, the additive error row, and the structured `httpStatus` read field

**Goal**: Land the complete `delivery.doctor.v1` vocabulary as data/types, the `doctor` kind + single row with same-phase documented row and corpora, and the type-additive `httpStatus` field on the adapter-local read-failure types with its trap entry — one vocabulary home, sync green from the first boundary (D1, D2, D8).

**Tasks**:

- [ ] **1.1** Author `packages/core/src/contracts/doctor.ts` (D1, D2) with exactly the constants and types pinned in "Pinned Delivery Spellings" (areas/order, verdicts, 11 sources, outcomes, the 22 reasons in DM-6 order, area→source map, the closed condition catalog with verdict + hint template per entry, credential-rejection statuses, all DM-8 bounds and the two read limits, schema version, summary-grammar constants, report/check/evidence/read types). Data and types only; no functions, no runtime imports, no executable statements beyond `as const` data and declarations. Re-export from `contracts/index.ts` and `core/src/index.ts`. **Anchors**: DM-1..DM-8, F-2, DEC-10. **Verification**: TC-DOCTOR-021 (task 1.6).
- [ ] **1.2** Extend `packages/core/src/contracts/error-table.ts` (D8): `DOMAIN_KINDS` += `"doctor"`; `ERROR_TABLE` += exactly the pinned `doctor.check.failed` row. In the same task, extend the documented table in `doc/spec/features/feature-result-contract.md` with the matching row and add `doctor` to the `DOMAIN_KINDS` prose sentence (the two-way sync check runs inside `pnpm check`; both sides must land together). **Anchors**: F-11, AC-F11-1, NFR-9. **Verification**: TC-DOCTOR-020; `bun run scripts/checks/error-table-sync.ts` exit 0.
- [ ] **1.3** Extend the corpora (D8): `tests/fixtures/result/code-corpora/true-positives.json` += `doctor.check.failed`; `false-positives.json` += `doctor.check.repo.unreachable` (check condition, never an identity). Extend `tests/structure/error-table.test.ts` (doctor kind appears exactly once; exactly one doctor row with the pinned fields; pre-change rows byte-identical; `fallback` reserved) and `tests/checks/error-table-sync.test.ts` (both corpus directions; mutation controls in temp copies: remove table row, change a field, remove documented row, add undocumented/second doctor row, change an existing row — each fails by name; unmutated control green). **Anchors**: AC-F11-1, NFR-9. **Verification**: TC-DOCTOR-020.
- [ ] **1.4** Add the adapter-local field (DEC-11): `packages/adapters/src/io/provider-transport.ts` — `ProviderPayloadFailure` and `ProviderNotFoundFailure` gain `readonly httpStatus?: number`; constructors gain the optional second parameter. Type-additive only; no consumer changes; `provider.payload.invalid`/`provider.not-found` remain the only identities; no error-table change for the field. **Anchors**: F-4, F-7, DM-4, DEC-11, §8.5. **Verification**: typecheck green; TC-DOCTOR-031 step 1 (task 3.2).
- [ ] **1.5** Add the trap-catalog entry and fixture (D1): append `GH-PAYLOAD-HTTP-STATUS` to `tests/fixtures/providers/traps/github.traps.json` with exactly the four fields (`trapName`, `providerBehavior` — non-2xx responses fold into adapter-local failures whose only discriminant used to be prose; `expectedNormalizedOutcome` — the read slice carries the structured numeric `httpStatus` on every non-2xx and omits it on transport failures, secret-free, identity unchanged; `fixtureReference` — `tests/fixtures/providers/github/read-failure-statuses.json`), commit the synthetic sanitized fixture (401/403/404/500/503 + transport shapes), and extend `tests/structure/trap-catalog.test.ts` with the entry's bidirectional coverage + deletion-by-name control. **Anchors**: DEC-11, AC-F12-1. **Verification**: TC-DOCTOR-031 structure half.
- [ ] **1.6** Author `tests/structure/doctor-contract.test.ts` (D2) and register the modules (D1): bind every constant to spec DM-3..DM-8 and Appendices A/B (values, order, spellings incl. `provider-chain-not-declared`/`provider-chain-unresolved` and `state-unreadable`; the 22 reasons exact; old draft spellings `chain-not-declared`/`chain-unresolved` absent; the condition catalog one-entry-per-condition with verdict mapping and non-empty action-first template; evidence model permits optional `failureClass`/numeric `httpStatus`, `failureCode` restricted to `config.*`/`state.*`; doctor imports no `STATUS_*`); in-memory mutation controls (reorder/ add/ remove/ rename a value, add a condition without a hint, add an old spelling) fail by name. Register `contracts/doctor.ts` + `domain/doctor.ts` (land Phase 2; the inventory entry may land with Phase 2) in `tests/structure/inventory.json`, `EXECUTABLE_ALLOWANCES`, and `tests/fixtures/ports/v1-contract-inventory.json` as each module lands. **Anchors**: AC-F2-1, AC-F2-2, NFR-1. **Verification**: TC-DOCTOR-021.
- [ ] **1.7** Phase gate: `bun test tests/structure/doctor-contract.test.ts tests/structure/error-table.test.ts tests/structure/trap-catalog.test.ts tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts`; `pnpm check` exit 0.

**Acceptance criteria**: AC-F11-1 complete at this boundary (machine + documented row + corpora, sync green, no existing row changed); the doctor vocabulary is single-home contract data bound to spec; the adapter field is type-additive; TC-DOCTOR-020/021 and TC-DOCTOR-031's structure half green; mutation controls fail by name.

**Files and modules**: `packages/core/src/contracts/doctor.ts` (new), `packages/core/src/contracts/error-table.ts` (updated), `packages/core/src/contracts/index.ts` (updated), `packages/core/src/index.ts` (updated), `packages/adapters/src/io/provider-transport.ts` (updated), `doc/spec/features/feature-result-contract.md` (updated — documented row + prose), `tests/fixtures/result/code-corpora/{true-positives,false-positives}.json` (updated), `tests/fixtures/providers/traps/github.traps.json` (updated), `tests/fixtures/providers/github/read-failure-statuses.json` (new), `tests/structure/{doctor-contract,error-table,trap-catalog,content-inventory}.test.ts` (new/updated), `tests/checks/error-table-sync.test.ts` (updated), `tests/structure/inventory.json` (updated), `tests/fixtures/ports/v1-contract-inventory.json` (updated).

**Rollback**: single-phase revert restores the table, corpora, documented row, field, and catalog together — never revert the machine row without the documented row (sync fails closed).

**Completion signal**: `feat(GH-224): add doctor contracts, error row, and structured httpStatus read field`

---

### Phase 2: Pure doctor aggregation, isolation container, and the domain matrix

**Goal**: Implement the complete pure domain — Appendix A verdict derivation with precedence, evidence/caps, summary counts, DM-7 summary rendering, the human report, and the per-check containment container — proven against the pure matrix from the first boundary (D3).

**Tasks**:

- [ ] **2.1** Author `packages/core/src/domain/doctor.ts` (D3): `aggregateDoctorReport`, `formatDoctorFailureSummary`, `renderDoctorHuman`, `runIsolatedDoctorCheck` exactly as pinned. All clock/time facts arrive through the inputs; the containment container catches every thrown/rejected/malformed shape into the area's `unreachable` verdict with reason `check-unreachable` and never rethrows; the aggregator applies Appendix A left-to-right precedence (observed `fail` outranks later dependency `unreachable`), evidence dedupe/order/caps (4/4), 200-char detail/hint bounds with multi-byte-safe clamping, and the DM-7 grammar with newline collapsing. Export only the four functions. **Anchors**: F-2, F-8, F-9, F-10, DM-1..DM-8, DEC-2..DEC-4. **Verification**: TC-DOCTOR-003/004 (task 2.2), TC-DOCTOR-013 domain half.
- [ ] **2.2** Author `tests/fixtures/doctor/harness.ts` (fact/check-input builders, fixed run id `run-doctor-fixture`, clock `2026-11-18T10:20:00Z`, synthetic brand) and `tests/fixtures/doctor/matrix/**` plus the pure halves of `tests/behaviour/doctor-report.test.ts` (TC-DOCTOR-003, TC-DOCTOR-004): five-check totality/shape, verdict/detail/evidence/hint/summary discipline; the Appendix A matrix cell by cell over injected check inputs — every condition fixture (repo ok/dirty/bad-origin/unreadable; tracker ok/verified-empty/credential/401/403/404/500/503/timeout/transport/unattempted; provider ok incl. all five wiring-neutral parks + announcements, config-invalid, provider-chain-unresolved, no-chain, unresolvable credential, credential park, unreadable fold; state ok/verified-empty/torn/schema/permission/unknown/unreadable; ci ok/zero-runs/failed-runs-neutral/credential/401/403/commit/transport/unattempted), the precedence fixtures, the conflicting-prose fixtures, and the old-spelling negatives. CLI-level runs complete in Phase 5; this task calls the aggregator and renderer directly. **Anchors**: AC-F2-1, AC-F2-2, NFR-1, NFR-3. **Verification**: TC-DOCTOR-003/004 (pure half), TC-DOCTOR-030 (evidence discipline, pure half).
- [ ] **2.3** Author the core halves of `tests/structure/doctor-imports.test.ts` (TC-DOCTOR-022/023 core, TC-DOCTOR-030 structure half): contracts data-only (AST detector), domain purity (imports only `#contracts`/relative; no `node:*`/`bun:*`, I/O, clock, randomness, env), no `STATUS_*` import (DEC-10), single-vocabulary-home scan, no `fallback.internal` in doctor domain/contracts, brand-literal absence; each detector has a failing fixture and a clean control (temp copies only). Update `tests/structure/inventory.json` + `EXECUTABLE_ALLOWANCES` for the domain module. **Anchors**: AC-F12-1, NFR-10. **Verification**: TC-DOCTOR-022/023 core halves.
- [ ] **2.4** Phase gate: `bun test tests/structure/doctor-contract.test.ts tests/structure/doctor-imports.test.ts tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/behaviour/doctor-report.test.ts`; `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`; `pnpm check` exit 0.

**Acceptance criteria**: AC-F2-1/AC-F2-2 measurable at the pure boundary (five ordered checks, closed verdicts, evidence caps, summary counts, matrix cells exact incl. precedence and httpStatus classification); the isolation container contains every injected shape; domain purity gates green; mutation controls fail by name.

**Files and modules**: `packages/core/src/domain/doctor.ts` (new), `packages/core/src/domain/index.ts` (updated), `packages/core/src/index.ts` (updated), `tests/behaviour/doctor-report.test.ts` (new — pure halves), `tests/fixtures/doctor/{harness.ts,matrix/**}` (new), `tests/structure/doctor-imports.test.ts` (new — core halves), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated).

**Rollback**: revert restores the domain module and its suites; contracts (Phase 1) stand alone and stay green.

**Completion signal**: `feat(GH-224): add pure doctor aggregation with per-check isolation`

---

### Phase 3: The GitHub read-slice `httpStatus` supply

**Goal**: Supply the structured numeric status on every non-2xx response in the GitHub read slice (get/send paths), keep transport failures status-free, and prove the behaviour with the new trap and the conflict/prose-negative fixtures (DEC-11).

**Tasks**:

- [ ] **3.1** Extend `packages/adapters/src/github/client.ts` (D1): in `get` and `send`, pass `response.status` into `providerNotFoundFailure`/`providerPayloadFailure` on non-2xx (404 → not-found with `httpStatus: 404`; other non-2xx → payload failure with its status); the `catch` transport/timeout paths keep omitting the field (no fabricated status). No new exported name; no behavior change beyond the additive field; existing consumers compile unchanged. **Anchors**: F-4, F-7, DEC-11, §8.4. **Verification**: TC-DOCTOR-031 steps 2–3.
- [ ] **3.2** Author `tests/behaviour/doctor-github-http-status.test.ts` (TC-DOCTOR-031): drive the read slice with 401/403/404/500/503/timeout/transport fixtures and the older absent-`httpStatus` shape; assert the field is present on non-2xx, absent on transport failures, secret-free (no headers/body/credential/prose copied), `provider.payload.invalid`/`provider.not-found` remain the identities, and every existing consumer narrows unchanged; negatives: `httpStatus: "401"` (string) rejected or treated as absent — never credential-rejected; `httpStatus: 200` on a failure never a successful read. **Anchors**: AC-F4-1, AC-F7-1, AC-F12-1, NFR-3, NFR-10. **Verification**: TC-DOCTOR-031.
- [ ] **3.3** Extend `tests/behaviour/providers/github-collection.test.ts` (TC-DOCTOR-031): the `GH-PAYLOAD-HTTP-STATUS` trap assertion (bidirectional coverage; deleting the entry or fixture fails by name); feed the 401/403 facts forward to the classification contract (shared mechanism consumed in Phase 5 fixtures) and the 404/500/503/timeout/absent facts to `read-failed`; assert the closed operation set, capability declaration, and read count are unchanged. **Anchors**: DEC-11, NFR-10. **Verification**: TC-DOCTOR-031; `bun test tests/structure/trap-catalog.test.ts`.
- [ ] **3.4** Phase gate: `bun test tests/behaviour/doctor-github-http-status.test.ts tests/behaviour/providers/github-collection.test.ts tests/behaviour/providers/github-trap.test.ts tests/structure/trap-catalog.test.ts tests/structure/provider-surface.test.ts`; `bun run scripts/checks/{forbidden-literals,ambient-globals,workspace-entrypoints}.ts`; `pnpm check` exit 0.

**Acceptance criteria**: the additive field is supplied on every non-2xx by the read slice, structured and secret-free, with exactly one trap entry + fixture covered bidirectionally; no identity, operation, or capability changes; TC-DOCTOR-031 green.

**Files and modules**: `packages/adapters/src/github/client.ts` (updated), `tests/behaviour/doctor-github-http-status.test.ts` (new), `tests/behaviour/providers/github-collection.test.ts` (updated), `tests/fixtures/doctor/http-status/**` (new — 401/403/404/500/503/timeout/absent + conflicting prose), `tests/structure/trap-catalog.test.ts` (updated — Phase 1 entry, behaviour assertion here).

**Rollback**: revert restores the client's constructors calls; the Phase 1 optional field is harmless without a supplier (absent-tolerant by contract).

**Completion signal**: `feat(GH-224): supply structured httpStatus on GitHub read failures`

---

### Phase 4: The `doctor` command, runtime composition, and human renderer

**Goal**: Compose the read-only `doctor` command end to end — grammar, shared read-once composition, the five isolated checks, the verify-change outcome model, and the human-renderer hook's ninth consumer (D4, D7).

**Tasks**:

- [ ] **4.1** Author `packages/cli/src/commands/doctor.ts` (D1, D4, D7): `DoctorCommandRuntime` + `createDoctorCommandDefinition(runtime)` exactly as pinned — `flags: []`, `positionals: { max: 0 }`, `humanText` hook, and the handler that reads each shared source once, runs the five checks in order each through `runIsolatedDoctorCheck`, aggregates, and returns `{ data }` on all-ok or the single `{ error: { kind: "doctor", code: "doctor.check.failed", summary } }` on any non-ok. No stream write, no exit literal, no adapter/state import, no per-check error envelope. **Anchors**: F-1, F-8, F-9, F-10, DEC-1, DEC-3, DEC-4. **Verification**: TC-DOCTOR-001 (task 4.3), TC-DOCTOR-015/016 domain halves (Phase 5 completes).
- [ ] **4.2** Extend `packages/cli/src/edge.ts` (D4): `DoctorComposition` + `createDoctorCommandRuntime(options, resolveProviderConfig)` reusing the status composition discipline — credential-reference guard before any client construction (non-admitted instance ⇒ tracker/CI credential presence reports `credential-unavailable`/`config.credential.missing` with zero transport calls); repository binding/HEAD via `readRepositoryFacts`/`parseGitHubRemote`; the two wiring reads at `DOCTOR_TRACKER_READ_LIMIT`/`DOCTOR_CI_READ_LIMIT` (one page each, no pagination/retry); `resolveProviderConfig` consumed as the tolerant provider-config read; the park fold + persisted announcements from the one verified state read shared with the state check; `ConfigProgramOptions.doctor?` composed beside status/brief/queue. **Anchors**: F-3..F-7, G-8, DEC-5, DEC-12. **Verification**: TC-DOCTOR-025 (Phase 5).
- [ ] **4.3** Author `tests/fixtures/doctor/harness.ts` `runDoctorCli` builders and `tests/behaviour/doctor-command.test.ts` (TC-DOCTOR-001): `doctor` and `doctor --json` return one outcome (all-ok fixture: exit 0, five checks); extra positional, `--fix-hints`, and unknown flag → `fallback.invocation`, exit 1, no `data`, zero source reads; the definition declares no flags and `positionals.max` 0; the handler is write-free and exit-free (throwing sinks); positive control re-run after rejections. **Anchors**: AC-F1-1, DEC-1, NFR-4. **Verification**: TC-DOCTOR-001.
- [ ] **4.4** Extend `tests/structure/cli-edge-seam.test.ts` (doctor composed beside the existing commands; EXTEND the existing eight-declarer `humanText` seam assertion — brief, closeout, db, plan, queue, status, verify, watchdog — with `commands/doctor.ts`, nine declarers total), the command half of `tests/structure/doctor-imports.test.ts` (command imports only core/contracts, no direct adapter/state), `tests/structure/inventory.json` + `EXECUTABLE_ALLOWANCES`, and `tests/fixtures/ports/v1-contract-inventory.json`. **Anchors**: AC-F12-1. **Verification**: TC-DOCTOR-022 command half.
- [ ] **4.5** Phase gate: `bun test tests/behaviour/doctor-command.test.ts tests/structure/cli-edge-seam.test.ts tests/structure/doctor-imports.test.ts tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts`; `bun run scripts/checks/{exit-code-literals,ambient-globals,forbidden-literals,workspace-entrypoints}.ts`; `pnpm check` exit 0.

**Acceptance criteria**: AC-F1-1 green (exact surface, parser rejection before reads, write-free handler); the shared read-once composition and the credential guard land; the outcome model returns the single classified failure envelope; the human hook's ninth consumer is additive; TC-DOCTOR-001 green.

**Files and modules**: `packages/cli/src/commands/doctor.ts` (new), `packages/cli/src/commands/index.ts` (updated), `packages/cli/src/edge.ts` (updated), `tests/behaviour/doctor-command.test.ts` (new), `tests/fixtures/doctor/harness.ts` (updated), `tests/structure/cli-edge-seam.test.ts` (updated), `tests/structure/doctor-imports.test.ts` (updated — command half), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated), `tests/fixtures/ports/v1-contract-inventory.json` (updated).

**Rollback**: revert removes the command and edge wiring; Phases 1–3 stand alone (the contracts/domain/error row have no CLI dependency).

**Completion signal**: `feat(GH-224): add doctor command with runtime composition and human report`

---

### Phase 5: The verification battery — matrix, per-check behaviour, isolation, outcomes, controls, posture, bounds, goldens, performance

**Goal**: Complete every remaining TC through the in-process `runCli` harness: the five per-check suites, isolation/containment, outcome/exit/envelope, negative controls, read-only/determinism, network posture, output bounds, goldens, performance, and the checks/boundary extensions — all fixture-driven, non-vacuous, hermetic (test plan §4.1/§4.2 bind every suite).

**Tasks**:

- [ ] **5.1** `tests/behaviour/doctor-repo.test.ts` + `tests/fixtures/doctor/repo/**` (TC-DOCTOR-006): clean HTTPS/SSH ok with factual branch/HEAD detail and no base claim; dirty fail (commit-or-discard hint, no `watchdog.*` identity); missing/unparseable/non-GitHub origin fail (`remote-unresolvable`, fix-remote hint, zero connection attempts); unreadable checkout unreachable (`doctor.check.repo.unreachable`); linked-worktree ok; zero network reads for the repo check; restored controls. **Anchors**: AC-F3-1, DEC-8.
- [ ] **5.2** `tests/behaviour/doctor-tracker.test.ts` + `tests/fixtures/doctor/{tracker,http-status}/**` (TC-DOCTOR-007): success incl. verified-empty ok; credential unresolvable fail with the `{envVar}`-only hint; 401/403 fail/`credential-rejected` from the structured field only (conflicting-prose fixtures: 401+"server error" fails; 500+"unauthorized" unreachable; absent+"401 Unauthorized" unreachable); 404/500/503/timeout/transport-with-absent-status unreachable/`read-failed`; unresolvable binding → zero tracker reads, unreachable/`not-attempted`, repo-finding hint; exactly one read, declared limit, no pagination/retry; restored controls; absent-`httpStatus` older shape tolerated. **Anchors**: AC-F4-1, NFR-3, NFR-7.
- [ ] **5.3** `tests/behaviour/doctor-provider.test.ts` + `tests/fixtures/doctor/provider/**` + `tests/fixtures/state/harness.ts` (TC-DOCTOR-008, TC-DOCTOR-009, TC-DOCTOR-010): ok path (valid chain, credentials, readable fold incl. empty; announcements as bounded detail); all five wiring-neutral parks (`peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, `reevaluation-cap`) stay ok with cause/expiry + `provider quota --provider <name>` directive and exit 0; credential-caused park fail with the refresh hint naming the source key only; multiple-park deterministic ordering; defects: no chain (`provider-chain-not-declared`), invalid chain (`provider-chain-unresolved` + `config.value.invalid`), unresolvable credential, disabled-entry-not-required, `config-invalid` with the classified `config.*` code, unreadable fold (`state-unreadable`, never "no parks") — both config failures are check-level `fail`, all five checks report, no abort (DEC-12); quota safety: counting quota/engine/resolve/write/evaluate stubs stay zero across ok/fail/unreachable fixtures, quota transport never constructed, deliberate-call controls prove the counters live. **Anchors**: AC-F5-1..AC-F5-3, DEC-6, DEC-12, NFR-5.
- [ ] **5.4** `tests/behaviour/doctor-state.test.ts` reusing `tests/fixtures/state/harness.ts` (TC-DOCTOR-011): valid/verified-empty ok; torn (`store-torn`, salvage-as-separate-step hint, no salvage call); schema mismatch; permission (`store-unreadable`, fail); unknown record kind (`store-unknown`); unreadable-beyond-classified unreachable (`doctor.check.state.unreachable`); no write/repair; the provider fold shares the store read (cross-ref TC-DOCTOR-025); restored controls. **Anchors**: AC-F6-1, NFR-3.
- [ ] **5.5** `tests/behaviour/doctor-ci.test.ts` + `tests/fixtures/doctor/ci/**` (TC-DOCTOR-012): success incl. zero-runs ok (`observed-empty`); failed runs never flip the verdict (bounded detail only); credential fail; 401/403 fail with the tracker's shared hint/reason; 404/500/503/timeout/absent unreachable; unresolved commit fail (`commit-unresolved`, run-from-branch hint); unresolvable binding → zero reads, `not-attempted`; one read for the HEAD commit at the declared limit, no pagination/retry; conflicting-prose and restored controls. **Anchors**: AC-F7-1, NG-6, NFR-7.
- [ ] **5.6** `tests/behaviour/doctor-isolation.test.ts` + `tests/fixtures/doctor/isolation/cases.ts` (TC-DOCTOR-013, TC-DOCTOR-014): 15 injections (5 areas × throw/rejection/malformed) → affected check unreachable with `doctor.check.<area>.unreachable`, bounded detail, hint; siblings complete with expected verdicts; five-check aggregation; `doctor.check.failed` envelope, exit 1, no crash/stack; never `fallback.internal` in-check; documented classes never contained as `fallback.internal`; outside-check composition/aggregation/serialization failures → exit 2 via the existing chain with no fabricated report; provider config failures stay in-check (DEC-12); structural scan (no `fallback.internal` in doctor domain/contracts); all-ok control; case-table meta-check. **Anchors**: AC-F8-1, AC-F8-2, NFR-2.
- [ ] **5.7** `tests/behaviour/doctor-outcome.test.ts` + `tests/fixtures/doctor/outcomes/**` (TC-DOCTOR-015, TC-DOCTOR-016, TC-DOCTOR-017): 1/5, 2/5, 5/5 failure summaries — the two Appendix B examples byte-exact; newline collapse; non-failing checks absent; generic `remediationHint`; all-ok variants (verified-empty/zero-runs/empty fold) → success envelope with the exact v1 key set and `data`; failure → no `data`, exact key set; exactly one of `data`/`error`; envelope mutations fail; exit matrix `{0,1,2}` over the full outcome set; outside-check platform failures → exit 2, no fabricated report; `exit-code-literals` check + static scan (no exit literal/`process.exit` in doctor source); call-site-override negative control. **Anchors**: AC-F9-1..AC-F9-3, DM-1, DM-7, NFR-4.
- [ ] **5.8** `tests/behaviour/doctor-output.test.ts` + `tests/fixtures/doctor/bounds/**` (TC-DOCTOR-018, TC-DOCTOR-019, TC-DOCTOR-026): one valid envelope on every outcome incl. isolation/outside-check; serialized `data` ≤65 536 bytes with over-limit clamping control; human report — one line per check + one indented hint per non-ok + optional brand header, ≤24 lines/4096 bytes, cap-sized no-silent-omission, over-limit clamp, zero extra reads (shared read-counter with `--json`), failure diagnostic carries the summary, no LLM; text/evidence caps — 199/200/201 chars (multi-byte safe), 4/5 sources/reasons, duplicate-reason dedupe/order, `failureCode` only existing `config.*`/`state.*`, `failureClass`/`httpStatus` never identities/prose. **Anchors**: AC-F10-1, DM-2, DM-4, DM-8, NFR-8.
- [ ] **5.9** `tests/behaviour/doctor-negative-controls.test.ts` + `tests/fixtures/doctor/negative-controls/cases.ts` (TC-DOCTOR-005): exactly the eight AC-F2-3 controls with `planted-doctor-control-*` canaries + the four supplementary auth/config controls; each asserts the exact verdict, reasons, detail/hint presence, exit 1/identity/no-data; canaries never surface; restored control per case; case-table meta-check (dropped case fails). **Anchors**: AC-F2-3, NFR-3.
- [ ] **5.10** `tests/behaviour/doctor-readonly-determinism.test.ts` (TC-DOCTOR-002): `guardStore` (reads recorded, append/replace/fence throw), recording transport (GET-only, fixtured URLs), spawn sentinel, state-root bytes unchanged, byte-identical `--json`/human replays at fixed run id/clock, seeded write/spawn controls prove the guards live. **Anchors**: AC-F1-2, NFR-6.
- [ ] **5.11** `tests/behaviour/doctor-network-posture.test.ts` (TC-DOCTOR-024, TC-DOCTOR-025): ≤2 single-page reads at the declared limits (no cursor/pagination/retry); shared sources read once (binding, config, store/fold); binding-unresolvable → zero network reads with local checks still running; per-read single attempt on failure mixes; the one shared 401/403→`credential-rejected` and 404/500/503/timeout/absent→`read-failed` mechanism across tracker and CI with no prose parsing; repo/provider/state zero network reads; hermetic suite (transport guard, credential stub, spawn sentinel, no `$HOME`/wall-clock/real-state) with deliberate-call controls; pagination/retry/double-resolve/prose-classification negatives fail. **Anchors**: AC-F4-1, AC-F7-1, AC-F12-2, DM-5, DM-8, NFR-7, DEC-5, DEC-9.
- [ ] **5.12** `tests/behaviour/doctor-performance.test.ts` + cap-sized fixture (TC-DOCTOR-029, D12): pure `aggregateDoctorReport` — 3 warm-ups, median of 21, ≤50 ms, environment recorded; one config resolve per run; shared reads not multiplied; transport count ≤2; 100-run replay without growth; expensive control proves the timer live; correctness mutations still fail.
- [ ] **5.13** `tests/golden/doctor-output.test.ts` + `tests/fixtures/doctor/golden/{success.json,success-human.txt,summary-1-of-5.txt,summary-2-of-5.txt,mixed-human.txt}` (TC-DOCTOR-027): byte-for-byte goldens at the fixed run id/clock/brand; Appendix B summaries exact; changed-fact control breaks equality; goldens read-only; `assertEnvelopeContract` clean.
- [ ] **5.14** Checks/boundary extensions: doctor cases in `tests/checks/{secret-read-boundary,forbidden-literals,exit-code-literals}.test.ts` (allowlist still four entries with no doctor file; no product literal; no exit literal), `tests/boundaries` fixture-coverage unchanged (no new rule), and the completed `doctor-imports.test.ts` final half + `doctor-report.test.ts` CLI-level completion of TC-DOCTOR-030 (DM-5 sources exact per check, closed outcomes, 22 reasons, `failureCode`/`failureClass`/`httpStatus` rules, no adapter-local promotion, old spellings never emitted).
- [ ] **5.15** Phase gate: every doctor suite + `bun test tests/structure tests/checks tests/boundaries tests/golden`; the five invariant checks; `pnpm check` exit 0; `git diff --check`; clean tree.

**Acceptance criteria**: all 31 TCs except TC-DOCTOR-028 green with non-vacuous controls (TC-DOCTOR-028's structural halves land with their files here; its doc review completes in Phases 6–7); every AC except the documentation half of AC-F11-1 measurable; NFR-1..NFR-10 measured.

**Files and modules**: `tests/behaviour/doctor-{repo,tracker,provider,state,ci,isolation,outcome,output,negative-controls,readonly-determinism,network-posture,performance}.test.ts` (new), `tests/golden/doctor-output.test.ts` (new), `tests/fixtures/doctor/{repo,tracker,ci,provider,outcomes,bounds,negative-controls,isolation,golden}/**` (new), `tests/fixtures/doctor/http-status/**` (existing — created in Phase 3, consumed here by TC-DOCTOR-007/012), `tests/fixtures/doctor/harness.ts` (updated), `tests/behaviour/doctor-report.test.ts` (completed), `tests/structure/doctor-imports.test.ts` (completed), `tests/checks/{secret-read-boundary,forbidden-literals,exit-code-literals}.test.ts` (updated).

**Rollback**: revert removes the suites/fixtures; production phases are unaffected (tests only).

**Completion signal**: `test(GH-224): prove doctor matrix, isolation, outcomes, and cost bounds`

---

### Phase 6: Planning-pack reconciliation, changeset, doc-impact handoff, and the final battery

**Goal**: Close the coder obligations: fix the man-page grammar drift, record the minor changeset, hand the documentation impact to `@doc-syncer`, record execution evidence, and run the full local battery to a clean tree (D10, D11, D13).

**Tasks**:

- [ ] **6.1** Correct the planning-pack drift: `doc/planning/oss-tooling/milestones/m1/man-page.md` line 88 — `doctor [--fix-hints]` → `doctor [--json]`; verify `commands/doctor.md` already matches (it does) and no doctor-specific flag is documented anywhere; the `--fix-hints` re-added-to-temp-copy negative control lives in TC-DOCTOR-028's structural check. **Anchors**: F-1, DEC-1, §8.5, AC-F11-1 doc half. **Verification**: TC-DOCTOR-028 steps 1–2.
- [ ] **6.2** Author `.changeset/doctor-v1-minor.md` (D11): lockstep `minor` for the fixed five-package group; brand-neutral summary naming the doctor command, the `delivery.doctor.v1` contract, the additive `httpStatus` read field, and the one error row. **Anchors**: §18.
- [ ] **6.3** Author `chg-GH-224-doc-impact.md` (the doc-syncer handoff): the new `doc/spec/features/feature-doctor.md` to author (current-truth, `ados_distribution: internal`), the result-contract prose to extend, the provider-client-seeds additive-field/trap-entry documentation, the status-digest second-renderer-consumer note, registry/glossary/index registrations, and the required scans. Record per-phase evidence in `chg-GH-224-test-plan.md` §10 (commands + results, never unrun as passing). **Anchors**: §16, §22, TC-DOCTOR-028.
- [ ] **6.4** Final local battery (record only executed evidence): `pnpm install --frozen-lockfile`; every doctor suite; `bun test` (all layers); `pnpm check`; `bun run scripts/checks/{error-table-sync,forbidden-literals,ambient-globals,exit-code-literals,workspace-entrypoints}.ts`; `bash scripts/.tests/test-doc-distribution.sh` (D13 — no redistributable doc changed; guard must exit 0); `git diff --check`; `git status --porcelain` clean. No push; Phase 7 and the PR handoff remain.

**Acceptance criteria**: the man page shows the delivered grammar; the changeset is recorded; the handoff names every doc surface; the battery is green on the working HEAD with a clean tree; TC-DOCTOR-028 coder steps done.

**Files and modules**: `doc/planning/oss-tooling/milestones/m1/man-page.md` (updated), `.changeset/doctor-v1-minor.md` (new), `chg-GH-224-doc-impact.md` (new), `chg-GH-224-test-plan.md` (§10 evidence rows).

**Rollback**: revert restores the man page and removes the changeset/handoff; no code coupling.

**Completion signal**: `chore(GH-224): reconcile man page, record changeset, and hand off docs`

---

### Phase 7: Documentation and spec reconciliation (`@doc-syncer`)

**Goal**: Author the current-truth doctor feature spec and reconcile the affected feature docs, registry, glossary, and index — lifecycle phase 7 (`system_spec_update`); **owned by `@doc-syncer`, not `@coder`** (D10).

**Tasks**:

- [ ] **7.1** Author `doc/spec/features/feature-doctor.md` (new current truth, `ados_distribution: internal`): command surface, the five checks and Appendix A matrix, the closed verdict/reason/condition vocabulary, evidence model, bounds (incl. the D5 read limits), outcome/exit model, the hint catalog (D6 table), isolation contract, quota-safety posture, and the doctor kind/row — registered in `doc/00-index.md` and the required scans.
- [ ] **7.2** Reconcile affected current-truth docs: `feature-result-contract.md` (the `doctor` kind narrative around the Phase 1 row); `feature-provider-client-seeds.md` (the additive optional `httpStatus` field on the adapter-local failure types + the `GH-PAYLOAD-HTTP-STATUS` trap entry and maintenance note); `feature-status-digest.md` (doctor as an additional human-renderer hook consumer joining the delivered eight-declarer set); provider-engine/state-layer consumer notes (doctor reads parks/announcements/stores read-only); `doc/planning/oss-tooling/cli-command-registry.md` (verify the doctor rows' wording still matches the delivered surface — they do today); `doc/overview/glossary.md` (wiring, verdict, fix hint, per-check isolation, wiring-neutral park, failure summary).
- [ ] **7.3** Complete TC-DOCTOR-028: the manual documentation/link review over every changed doc (relative links resolve, YAML parses, `git diff --check`); the doc-distribution guard re-run (D13); the reconciliation log recorded.
- [ ] **7.4** Phase gate: `bash scripts/.tests/test-doc-distribution.sh` exit 0; `git diff --check`; `pnpm check` exit 0 (docs-only since Phase 6's battery, re-confirmed).

**Acceptance criteria**: AC-F11-1's documentation half complete; TC-DOCTOR-028 fully green; every doc named in §16/"Docs to keep current" reconciled; the feature spec registered.

**Files and modules**: `doc/spec/features/feature-doctor.md` (new), `doc/spec/features/{feature-result-contract,feature-provider-client-seeds,feature-status-digest,feature-provider-engine,feature-state-layer}.md` (updated), `doc/planning/oss-tooling/cli-command-registry.md` (verified/updated), `doc/overview/glossary.md` (updated), `doc/00-index.md` (updated).

**Rollback**: revert removes/restore the docs; no code coupling.

**Completion signal**: `docs(GH-224): add doctor feature spec and reconcile current-truth docs`

---

## Coverage Ledger (phases/tasks → AC → TC)

All 21 ACs and all 31 TCs are mapped; no TC is reshaped (A-T3). DoD verifies completeness against this ledger.

| AC | TC(s) | Phase.task |
|---|---|---|
| AC-F1-1 | TC-DOCTOR-001 | 4.3 |
| AC-F1-2 | TC-DOCTOR-002 | 5.10 |
| AC-F2-1 | TC-DOCTOR-003, 021, 030 | 2.2, 1.6, 5.14 |
| AC-F2-2 | TC-DOCTOR-004, 021, 030 | 2.2, 1.6, 5.14 |
| AC-F2-3 | TC-DOCTOR-005 | 5.9 |
| AC-F3-1 | TC-DOCTOR-006 | 5.1 |
| AC-F4-1 | TC-DOCTOR-007, 025, 031 | 5.2, 5.11, 1.5/3.2/3.3 |
| AC-F5-1 | TC-DOCTOR-008 | 5.3 |
| AC-F5-2 | TC-DOCTOR-009 | 5.3 |
| AC-F5-3 | TC-DOCTOR-010 | 5.3 |
| AC-F6-1 | TC-DOCTOR-011 | 5.4 |
| AC-F7-1 | TC-DOCTOR-012, 025, 031 | 5.5, 5.11, 1.4/3.2 |
| AC-F8-1 | TC-DOCTOR-013 | 5.6 |
| AC-F8-2 | TC-DOCTOR-014, 017 | 5.6, 5.7 |
| AC-F9-1 | TC-DOCTOR-015, 027 | 5.7, 5.13 |
| AC-F9-2 | TC-DOCTOR-016, 018 | 5.7, 5.8 |
| AC-F9-3 | TC-DOCTOR-017, 014 | 5.7, 5.6 |
| AC-F10-1 | TC-DOCTOR-018, 019, 026, 027 | 5.8, 5.13 |
| AC-F11-1 | TC-DOCTOR-020, 028 | 1.2, 1.3, 6.1, 7.1, 7.2 |
| AC-F12-1 | TC-DOCTOR-022, 023, 030, 031 | 2.3, 5.14, 1.4/3.2 |
| AC-F12-2 | TC-DOCTOR-024, 025 | 5.11 |

Reverse ledger (every TC has a home): 001→4.3; 002→5.10; 003→2.2; 004→2.2; 005→5.9; 006→5.1; 007→5.2; 008→5.3; 009→5.3; 010→5.3; 011→5.4; 012→5.5; 013→5.6; 014→5.6+5.7; 015→5.7; 016→5.7; 017→5.7; 018→5.8; 019→5.8; 020→1.2+1.3; 021→1.6; 022→2.3+5.14; 023→2.3+5.14; 024→5.11; 025→5.11; 026→5.8; 027→5.13; 028→6.1+6.3+7.1–7.3; 029→5.12; 030→2.2+2.3+5.14; 031→1.4+1.5+3.2+3.3.

## Verification Commands

Per-phase gates are named in each phase; the change-level battery (record in `chg-GH-224-test-plan.md` §10; never record unrun results as passing):

```bash
pnpm install --frozen-lockfile
bun test tests/structure/doctor-contract.test.ts
bun test tests/structure/doctor-imports.test.ts
bun test tests/structure/error-table.test.ts
bun test tests/structure/trap-catalog.test.ts
bun test tests/structure/subpaths.test.ts
bun test tests/structure/content-inventory.test.ts
bun test tests/structure/cli-edge-seam.test.ts
bun test tests/behaviour/doctor-command.test.ts
bun test tests/behaviour/doctor-github-http-status.test.ts
bun test tests/behaviour/providers/github-collection.test.ts
bun test tests/behaviour/doctor-report.test.ts
bun test tests/behaviour/doctor-repo.test.ts
bun test tests/behaviour/doctor-tracker.test.ts
bun test tests/behaviour/doctor-provider.test.ts
bun test tests/behaviour/doctor-state.test.ts
bun test tests/behaviour/doctor-ci.test.ts
bun test tests/behaviour/doctor-isolation.test.ts
bun test tests/behaviour/doctor-outcome.test.ts
bun test tests/behaviour/doctor-output.test.ts
bun test tests/behaviour/doctor-negative-controls.test.ts
bun test tests/behaviour/doctor-readonly-determinism.test.ts
bun test tests/behaviour/doctor-network-posture.test.ts
bun test tests/behaviour/doctor-performance.test.ts
bun test tests/golden/doctor-output.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/checks/secret-read-boundary.test.ts
bun test tests/checks/forbidden-literals.test.ts
bun test tests/checks/exit-code-literals.test.ts
bun test tests/boundaries
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
bash scripts/.tests/test-doc-distribution.sh
pnpm check
git diff --check
git status --porcelain
```

## DoD Checklist

- [ ] All 21 ACs have a passing traceable TC and all 10 NFRs are measured (Coverage Ledger complete; test plan §3.1/§3.2/§3.3 tables green).
- [ ] Five checks in fixed order on every completed run; closed verdicts; non-empty bounded detail; hint iff non-ok; 0 missing/extra.
- [ ] Appendix A matrix exhaustive with precedence; 401/403 vs 404/500/503/timeout/absent classified from the structured field only; verified-empty/observed-empty the only zero-claim successes.
- [ ] The eight AC-F2-3 controls + four supplementary auth/config controls never yield `ok`; restored controls live.
- [ ] The 15-case isolation suite completes siblings; no `fallback.internal` inside a check boundary; outside-check containment → exit 2.
- [ ] All-ok → exit 0 with the `delivery.doctor.v1` data report; any non-ok → exactly `doctor.check.failed`, exit 1, Appendix B summary; no overrides; failure envelopes data-free.
- [ ] Provider quota/engine/resolve/write/transport activity zero; parks read from the verified fold; `reevaluation-cap` wiring-neutral.
- [ ] The additive optional `httpStatus` field + exactly one GitHub trap-catalog entry + fixture land in-change; `provider.payload.invalid`/`provider.not-found` remain the only adapter identities.
- [ ] `doctor` kind + single row + documented row + two-way corpora sync in both directions; no existing row changed.
- [ ] Tier/boundary/ambient/forbidden-literal/privacy/secret-read gates green; no new location/key/schema/allowlist entry/product literal/error identity.
- [ ] Default suite hermetic: zero live network/credentials/spawns; ≤2 single-page reads at `DOCTOR_TRACKER_READ_LIMIT`/`DOCTOR_CI_READ_LIMIT`; no pagination/retries; shared sources read once.
- [ ] Bounds live: 64 KiB machine / 24-line / 4096-byte human / 200-char / 4-source / 4-reason; pure aggregation ≤50 ms median (D12 environment recorded).
- [ ] Man page grammar corrected; doctor feature spec + result-contract/provider-client-seeds/status docs reconciled; registry/glossary/index updated; doc-distribution guard green.
- [ ] One minor changeset recorded; per-phase Conventional Commits with green gates; evidence in test plan §10; open unmerged PR targeting `main-tools` (no merge, no owner acceptance claimed).
