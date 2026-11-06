---
id: chg-GH-224-test-plan
status: Updated
created: 2026-11-06T04:55:00Z
last_updated: 2026-11-06T07:05:00Z
owners: [engineering]
service: delivery-os CLI doctor command
labels: [change, planning]
version_impact: minor
summary: "M1-S3 doctor v1 (reconciled with spec v1.2): one read-only `doctor` command that runs exactly five checks in fixed order (repo, tracker, provider, state, ci), each with one verdict from ok/fail/unreachable, bounded evidence, a deterministic detail, and an unconditional fix hint on every non-ok verdict. The plan proves the five-check report totality and the Appendix A verdict derivation matrix cell by cell; the exhaustive AC-F2-3 negative-control matrix (no failed, unattempted, or unread tracker/provider/state/CI read ever becomes ok); the structured `httpStatus` (401/403) credential-rejection mechanism shared by tracker and CI with every other non-2xx/transport failure staying unreachable and no prose parsing; the tolerant provider-configuration read (`config-invalid`, `provider-chain-unresolved`) as check-level fail evidence that never aborts the run; `reevaluation-cap` as wiring-neutral; the additively extended reason set (`config-invalid`, `state-unreadable`, delivered `provider-chain-*` spellings) and evidence model (`failureClass`, `httpStatus`); the one additive GitHub trap-catalog entry and fixture assertion; per-check isolation for injected throws, rejections, and malformed results with sibling completion and no `fallback.internal` inside a check boundary; the verify-change outcome model (all-ok success data + exit 0; any non-ok `doctor.check.failed` error envelope + exit 1 with the Appendix B deterministic summary; unable-to-run through the existing projection + exit 2); provider quota safety; the 64 KiB / 24-line / 4096-byte / 200-char / 4-source / 4-reason bounds; the additive `doctor` error kind and single row with two-way sync coverage; tier, boundary, branding, privacy, and secret-read gates; and a fixture-driven default suite with zero live network, zero live credentials, and zero process spawns."
links:
  change_spec: ./chg-GH-224-spec.md
  implementation_plan: ./chg-GH-224-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S3: doctor v1

## 1. Scope and Objectives

This change introduces the single read-only pre-flight diagnostic that answers "is this environment wired for delivery?" before a session spends tokens or provider quota. The tests must prove four things at once: **the report is total and truthful** (exactly five checks in the fixed order `repo`, `tracker`, `provider`, `state`, `ci`; one verdict from the closed set `ok | fail | unreachable`; non-empty bounded detail and evidence on every check; a non-empty fix hint on every non-ok verdict; no failed, unattempted, unobserved, or contained read ever reported as `ok`), **the verdict derivation is exhaustive and pinned** (every Appendix A cell, including local defects, performed-read defects, unattempted reads, transport failures, and contained execution, maps to its declared verdict and closed reason set), **per-check isolation and outcome modelling hold** (each check's throw, rejection, or malformed intermediate result becomes that check's `unreachable` verdict without aborting siblings or escaping as `fallback.internal`; all-ok runs exit `0` with the structured report as `data`; any non-ok run exits `1` with exactly `doctor.check.failed` and the deterministic Appendix B summary; doctor-unable-to-run projects exit `2` only through the existing chain), and **the read-only/economic contract holds** (zero writes, fences, state mutations, network writes, child processes, quota fetches, engine `resolve` calls, and provider mutations; at most two bounded single-page reads; deterministic replay; bounded output; no new configuration key, state schema, package, subpath, runtime-API location, secret-read allowlist entry, or product literal).

The plan is built around four adversarial mechanisms the specification names. First, the **Appendix A verdict derivation matrix is executed cell by cell**, with at least one fixture per declared condition and a precedence case where an observed `fail` outranks a later dependency failure. Second, the **AC-F2-3 negative-control matrix is exhaustive and non-vacuous**: each of the eight named controls asserts the exact affected-check verdict, the closed reason set, the absence of `ok` and of fabricated detail, and a restored control that reaches the declared outcome. Third, the **isolation suite injects three failure shapes per check in turn** (a thrown value, a rejected promise, and a malformed intermediate result), asserting sibling completion, full five-check aggregation, `doctor.check.<area>.unreachable`, and zero `fallback.internal` inside check boundaries. Fourth, **bounds and economics are measured, not sampled**: two-read call counts with a zero-read binding-unresolved control, 1/5 and 2/5 summary goldens from Appendix B, 64 KiB machine and 24-line/4096-byte human over-limit controls, 200-character text caps, and four-source/four-reason evidence caps.

### 1.1 In Scope

- The `doctor` command surface: exact command name, no positionals, no command-specific flags, global `--json` only; parser rejection of an extra positional or unknown flag, including `--fix-hints`, with `fallback.invocation`, exit `1`, and zero source reads before the handler; a write-free, exit-free handler (F-1, AC-F1-1).
- Read-only, deterministic execution: zero writes, fences, state mutations, network writes, and child processes; byte-identical machine and human replay over identical injected inputs (F-12, AC-F1-2, NFR-6).
- The five-check report: fixed area order, closed verdict vocabulary, non-empty bounded detail, evidence sources/outcomes/reasons with optional `failureClass`/`httpStatus` data, `fixHint` iff non-ok, the shared repository binding, `summary` counts, and `delivery.doctor.v1` (F-2, DM-1..DM-4, AC-F2-1, NFR-1).
- The additively enriched wiring-read failure surface: an optional structured, secret-free `httpStatus` on the shared adapter-local payload failure, supplied by the GitHub read slice on non-2xx responses; `provider.payload.invalid` remains the only payload-failure identity; one GitHub trap-catalog entry and fixture assertion land in the same change (F-4, F-7, F-12, DM-4, DEC-11, AC-F4-1, AC-F7-1, AC-F12-1).
- The full Appendix A verdict derivation matrix across `repo`, `tracker`, `provider`, `state`, and `ci`, including local defects, performed-read defects (structured 401/403 credential rejection and all other non-2xx/transport failures), unattempted reads, the two tolerant provider-configuration failures, verified-empty/observed-empty success, and contained execution; reason sets from DM-6 only; within-check precedence (F-2, DM-3, DM-6, DEC-11, DEC-12, AC-F2-2, NFR-3).
- The AC-F2-3 negative-control matrix: failed tracker read, unattempted tracker read, failed CI read, missing credential, torn store, undeclared provider chain, unreadable provider park/announcement fold, and contained check-internal throw; no control becomes `ok`, and no detail is fabricated (F-2, F-8, AC-F2-3, NFR-3).
- The repo check: clean work tree plus a GitHub `origin` binding with factual branch/HEAD detail and no base-conformance claim; dirty tree; missing/unparseable/non-GitHub `origin`; unreadable checkout facts; no `watchdog.*` identity (F-3, DM-5, DEC-8, AC-F3-1).
- The tracker check: resolvable binding and credential plus exactly one bounded single-page list read, including a verified-empty page; unresolvable credential; wiring read rejected with structured `httpStatus` 401/403 (`credential-rejected`, replace-or-broaden hint); any other non-2xx/transport failure as unreachable; unresolvable binding leaving the read unattempted (F-4, DM-4, DM-5, DEC-11, AC-F4-1, NFR-7).
- The provider check: the delivered tolerant provider-configuration read (`config-invalid` with a classified `config.*` code and `provider-chain-unresolved` with `config.value.invalid`, both check-level fail evidence that never aborts the run); declared structurally valid chain, credential presence, readable park/announcement fold; wiring-neutral capacity, environment, and loop-cap parks (`peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, `reevaluation-cap`) with cause, expiry, and `provider quota --provider <name>`; credential-caused parks fail; no chain, invalid chain, unresolvable credential reference, and unreadable fold (`state-unreadable`); zero quota/engine/write activity (F-5, DM-3, DM-4, DM-6, DEC-6, DEC-12, AC-F5-1..AC-F5-3, NFR-3, NFR-5).
- The state check: verified reads including verified-empty; torn, schema-mismatch, permission, and unknown-record-kind failures with their delivered remediation hints; unreadable-beyond-classified as `unreachable`; no salvage or repair (F-6, AC-F6-1).
- The CI check: resolvable binding/credential/commit plus exactly one bounded single-page check-runs read, including zero runs; missing credential; wiring read rejected with structured `httpStatus` 401/403 using the one shared credential-rejection mechanism; unresolved commit; any other non-2xx/transport failure as unreachable; unattempted read; failed runs never flipping the verdict (F-7, DM-4, DM-5, DEC-11, NG-6, AC-F7-1, NFR-7).
- Per-check isolation: three injected failure shapes per check in turn, sibling completion, full five-check aggregation, `doctor.check.<area>.unreachable`, and containment that never resolves a check-internal failure through `fallback.internal` (F-8, AC-F8-1, AC-F8-2, NFR-2).
- Outcome and exit modelling: all-ok success data + exit `0`; any non-ok `doctor.check.failed` error envelope + exit `1`; deterministic Appendix B summary in fixed area order; envelope exclusivity; doctor-unable-to-run via the existing projection + exit `2`; no exit overrides (F-9, DM-1, DM-7, AC-F9-1..AC-F9-3, NFR-4).
- Machine and human output: exactly one valid `CommandResult` envelope on every outcome; serialized `data` ≤ 64 KiB; deterministic human report with one line per check plus one indented hint per non-ok check; ≤ 24 lines and ≤ 4096 bytes; zero extra reads; the failure diagnostic additionally carries the summary (F-10, DM-8, AC-F10-1, NFR-8).
- The additive error-table evolution: `doctor` in `DOMAIN_KINDS` with exactly one row `doctor.check.failed` (user, retryable `false`, consequence `not_landed`, projection `user-validation`, generic remediation hint, non-identifying summary); documented row; sync-check corpora and fixtures in both directions; no existing row modified (F-11, AC-F11-1, NFR-9).
- Contract and tier discipline: runtime-neutral contracts data only; pure aggregation in the domain tier importing contracts only; runtime I/O only in admitted adapter subpaths and the CLI edge; no new package, subpath, runtime-API location, configuration key, or state record kind; boundary, ambient, forbidden-literal, privacy, and secret-read gates; planted-secret canaries (F-12, AC-F12-1, AC-F12-2, NFR-10).
- A fixture-driven default suite with zero live network, zero live credentials, and zero process spawns; at most two bounded single-page reads with no pagination or retries; shared binding/config/store reads resolved once (F-4, F-7, F-12, AC-F12-2, NFR-7, DEC-9).
- In-change documentation reconciliation: the planning pack's man-page `doctor [--fix-hints]` drift is corrected to `<binary> doctor [--json]`; the result-contract documented row, command registry, glossary, index, and new current-truth feature spec are reconciled (F-1, F-11, §8.5; no dedicated AC).

### 1.2 Out of Scope & Known Gaps

- [OUT] Any repair or mutation: `--fix`, salvage execution, checkout restore, park clear, credential provisioning, store migration, state write, fence acquisition, or child process (NG-1, NG-7).
- [OUT] Merge/gate/deploy evaluation (M1-S4), CI build-health verdicts, queue/lane/daemon/provider-watching surfaces, the M3 memory `doctor` family, fleet/cross-repository doctor, MCP/OpenCode surfaces, LLM-generated guidance, and agent prompt adoption (NG-2..NG-6, NG-8, NG-9).
- [OUT] Provider-engine execution, chain decision making, live quota evaluation/fetch, quota-transport injection, park/announcement writes, and peak/quota condition evaluation (NG-5, AC-F5-3).
- [OUT] Base-branch conformance evaluation: v1 reports observed branch/HEAD facts only; no global declared base source exists and no configuration key is invented (DEC-8, OQ-1, §7.3).
- [OUT] New error-table identities beyond `doctor.check.failed`, data-bearing failure envelopes, envelope-shape changes, exit overrides outside the projection module, and new configuration keys/state schema/record kinds (F-9, F-11, NG-7).
- [OUT] Reuse of `watchdog.checkout-dirty` / `watchdog.checkout-non-base` as doctor identities; those conditions are diagnostic check data only (NG-8, §7.2).
- [GAP-1 — implementation plan absent] No `chg-GH-224-plan.yaml`/`chg-GH-224-plan.md` exists at authoring; `delivery_planning` follows this phase. This plan binds behaviour, verdicts, reasons, identities, bounds, and AC/NFR mapping; the plan must map onto these TCs and must not reshape them.
- [GAP-2 — seed has no doctor-scoped SC-M1 scenario] `doc/planning/oss-tooling/milestones/m1/test-scenarios.md` lists no M1-S3/doctor scenario; its coverage map omits S3 and its coverage rule says unlisted stories inherit the pattern at test-plan time with story-local TC ids. The doctor-relevant seed material is the cross-cutting SC-M1-19 plus the pack's `doctor` contract prose and examples; §5.3 records every disposition. This is a seed gap, not a dropped scenario.
- [GAP-3 — RESOLVED by spec v1.1 F-8/F-9] The full-report wording is confirmed as: the internal aggregation always has five checks; the human failure report renders all five lines; the machine failure path is error-only and carries the failing-check summary. The plan asserts exactly that and OQ-T1 is closed; no data-bearing failure envelope is introduced.
- [GAP-4 — RESOLVED by spec v1.1 DEC-11] The wiring-read credential rejection is classified from a new optional structured `httpStatus` on the shared adapter-local payload failure: 401/403 → `fail`/`credential-rejected`; every other non-2xx/timeout/transport failure → `unreachable`/`read-failed`; prose is never parsed. One GitHub trap-catalog entry and fixture assertion land in-change; `provider.payload.invalid` remains the only adapter identity and no additional error-table row is added for the field (the separate `doctor.check.failed` row is TC-DOCTOR-020). OQ-T3 and OQ-T10 are closed.
- [GAP-5 — numeric doctor read limits not pinned] DM-8 requires one declared per-source read limit for each of the two network reads but does not give the numeric values (unlike status's 100/20). The plan asserts a declared positive integer, exactly one page, and no pagination/retries; the numeric constant remains delivery-bound (OQ-T4 open).
- [GAP-6 — hint wording beyond Appendix B] DM-7 pins the summary grammar and Appendix B gives two canonical examples. The v1.1 condition catalog adds `config-invalid`/`provider-chain-unresolved` and the `reevaluation-cap` wiring-neutral condition, but not every template string is enumerated. The plan binds the Appendix B examples exactly and asserts every other hint is a non-empty, action-first, secret-free catalog template with one entry per condition (OQ-T6 open, narrowed).
- [GAP-7 — doc-distribution marker] No redistributable guide or template is changed: the planning pack is `doc/planning/**` (internal) and the new current-truth feature spec lives under `doc/spec/features/**` (honest `internal`, outside the guard's scan scope). If delivery changes any redistributable doc under `doc/guides/**` or `doc/templates/**`, `bash scripts/.tests/test-doc-distribution.sh` must pass and the `ados_distribution` marker must be explicit (OQ-T7 open).
- [GAP-8 — delivery-bound spellings] Contract export names, runtime type names, helper names, exact non-Appendix-B hint wording, human line labels, and fixture file names are delivery-bound. The area ids/order, verdicts, sources, reasons (including the delivered `provider-chain-*` spellings), bounds, schema version, error identity, and summary grammar are pinned and may not be rebound.

## 2. References

- **Change specification**: [chg-GH-224-spec.md](./chg-GH-224-spec.md) — F-1..F-12, DM-1..DM-8, NFR-1..NFR-10, RSK-1..RSK-10, DEC-1..DEC-12, OQ-1..OQ-3, AC-F1-1..AC-F12-2 (21), Appendix A (verdict derivation matrix), Appendix B (evidence application and failure-summary examples).
- **M1 test-scenario seed**: [test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — cross-cutting SC-M1-19 and the seed's coverage rule; §5.3 records the doctor dispositions.
- **Planning-pack proposed contract**: [commands/doctor.md](../../../planning/oss-tooling/milestones/m1/commands/doctor.md) (synopsis, output, exit status, examples), [contracts.md §doctor](../../../planning/oss-tooling/milestones/m1/contracts.md), [interactions.md Session F](../../../planning/oss-tooling/milestones/m1/interactions.md), [man-page.md](../../../planning/oss-tooling/milestones/m1/man-page.md).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries,golden}`, `scripts/checks/*.ts` mutation tests, `pnpm check`, fixture-driven default CI.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, runtime-API confinement, no ambient reads.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope shape, documented error table, classification chain, `{0,1,2}` projection, sole redaction path, bidirectional sync.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — verified reads, torn/schema/unknown classification, verified-empty, provider park/announcement fold, no write on read.
- **Provider engine**: [feature-provider-engine.md](../../../spec/features/feature-provider-engine.md) — typed provider branch, chain validation, parks, announcements, `provider quota` / `resolve` surfaces, credential causes.
- **Provider client seeds / GitHub read slice**: [feature-provider-client-seeds.md](../../../spec/features/feature-provider-client-seeds.md) — the adapter-local payload-failure type, the optional structured `httpStatus` enrichment (DEC-11), and the four-field GitHub trap catalog with bidirectional coverage; the additive field and one trap entry land in-change.
- **Status digest**: [feature-status-digest.md](../../../spec/features/feature-status-digest.md) — `origin`-derived repository binding, bounded single-page GitHub reads, closed-evidence rules, optional human-renderer hook, read-only consumer pattern.
- **Verify change**: [feature-verify-change-and-exit-taxonomy.md](../../../spec/features/feature-verify-change-and-exit-taxonomy.md) — classified failure envelope, deterministic multi-finding summary, envelope exclusivity, exit projection; [TDR-0005](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md).
- **Adapter ports and credentials**: [feature-adapter-ports.md](../../../spec/features/feature-adapter-ports.md) — `CredentialPort`, bounded GitHub read slices, runtime I/O confinement; [feature-config-layer.md](../../../spec/features/feature-config-layer.md) — typed provider branch, no default chain.
- **Architecture**: [ADR-0003 — OSS Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) — package tiers and runtime-API allowlist.
- **Existing mechanisms**: `tests/golden/helpers.ts` (`runCli`, synthetic brand, fixed run id/clock); `packages/testkit/src/result-conformance.ts` (`assertEnvelopeContract`); `tests/fixtures/state/harness.ts` (temp verified store, park/announcement fold); `tests/behaviour/verify-support.ts` (`guardStore`); `tests/behaviour/status-*` (collector/harness/negative-control patterns); `tests/structure/status-contract.test.ts` and `status-imports.test.ts` (vocabulary and tier detectors); `tests/structure/error-table.test.ts`; `tests/checks/error-table-sync.test.ts`; `tests/checks/{secret-read-boundary,forbidden-literals,exit-code-literals}.test.ts`; `tests/boundaries/**`; `scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`.
- **Ticket**: GH-224 — M1-S3: doctor v1.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | `doctor` runs with no positionals/flags and returns one outcome; extra positional/unknown flag → `fallback.invocation`, exit `1`, no read; `--json` only; no `--fix-hints` | TC-DOCTOR-001 | Covered |
| AC-F1-2 | Zero writes, fences, state mutations, network writes, child processes; identical injected inputs replay identically | TC-DOCTOR-002 | Covered |
| AC-F2-1 | Exactly five checks in fixed order; closed verdict; non-empty bounded detail; evidence; `fixHint` iff non-ok; summary counts | TC-DOCTOR-003, TC-DOCTOR-021, TC-DOCTOR-030 | Covered |
| AC-F2-2 | Every Appendix A cell maps to its declared verdict and closed reason set; no invented reason | TC-DOCTOR-004, TC-DOCTOR-021, TC-DOCTOR-030 | Covered |
| AC-F2-3 | Eight negative controls never yield `ok`; unattempted/unobserved reads are `unreachable` (or declared `fail`), never ok; no fabricated detail | TC-DOCTOR-005 | Covered |
| AC-F3-1 | Repo: clean+GitHub origin ok with branch/HEAD detail and no base claim; dirty fail with commit/discard hint; bad origin fail with fix-remote hint; unreadable unreachable; no `watchdog.*` identity | TC-DOCTOR-006 | Covered |
| AC-F4-1 | Tracker: one bounded page, ok incl verified-empty; missing credential fail with env-var hint; structured `httpStatus` 401/403 fail with replace-or-broaden hint/reason `credential-rejected` from the status only; any other non-2xx/transport/timeout unreachable; unattempted read unreachable | TC-DOCTOR-007, TC-DOCTOR-025, TC-DOCTOR-031 | Covered |
| AC-F5-1 | Provider: valid chain/credentials/fold ok; capacity/environment/loop-cap parks incl `reevaluation-cap` stay ok with cause/expiry and quota directive; credential-caused park fail with refresh hint naming source key only | TC-DOCTOR-008 | Covered |
| AC-F5-2 | Provider: configuration-resolution failure `config-invalid` with classified `config.*` code + correct-source hint; provider-branch validation `provider-chain-unresolved` with `config.value.invalid` + correct-provider-config hint; missing chain/declare hint (`provider-chain-not-declared`); unresolvable credential/supply hint; unreadable fold unreachable `state-unreadable` and never "no parks" | TC-DOCTOR-009 | Covered |
| AC-F5-3 | Zero quota fetches, engine `resolve` calls, park/announcement writes, peak/quota evaluations, quota-transport injection | TC-DOCTOR-010 | Covered |
| AC-F6-1 | State: verified/empty ok; torn/schema/permission/unknown fail with delivered hints and no repair; unreadable-beyond-classified unreachable | TC-DOCTOR-011 | Covered |
| AC-F7-1 | CI: one bounded page, ok incl zero runs; missing credential fail; structured `httpStatus` 401/403 fail with the tracker's shared credential-rejection hint/reason; unresolved commit fail; any other non-2xx/timeout/transport/unattempted unreachable; failed runs do not flip the verdict | TC-DOCTOR-012, TC-DOCTOR-025, TC-DOCTOR-031 | Covered |
| AC-F8-1 | Injected throw/rejection/malformed result per check → affected check unreachable with `doctor.check.<area>.unreachable` + hint; siblings complete; full outcome; no crash; no `fallback.internal` | TC-DOCTOR-013 | Covered |
| AC-F8-2 | `fallback.internal`/platform identities only outside per-check execution; documented classes never contained as `fallback.internal`; zero escapes | TC-DOCTOR-014, TC-DOCTOR-017 | Covered |
| AC-F9-1 | Any non-ok → exactly `doctor.check.failed`, exit `1`, deterministic one-line summary naming every failing check with verdict+hint in area order; non-failing absent; no secrets | TC-DOCTOR-015, TC-DOCTOR-027 | Covered |
| AC-F9-2 | All-ok → success envelope, exit `0`, `delivery.doctor.v1` data (five checks, summary, binding); failure → no `data`; exact v1 key set and exactly one of data/error | TC-DOCTOR-016, TC-DOCTOR-018 | Covered |
| AC-F9-3 | Unable-to-run (outside-check containment or platform-category failure) → exit `2` via existing chain, no fabricated report, no overrides; every exit in `{0,1,2}` and table-derived | TC-DOCTOR-017, TC-DOCTOR-014 | Covered |
| AC-F10-1 | `--json`: exactly one valid envelope every outcome, `data` ≤ 64 KiB; human: one line per check + one indented hint per non-ok, ≤ 24 lines/4096 bytes, same data, zero extra reads, no LLM; failure adds summary | TC-DOCTOR-018, TC-DOCTOR-019, TC-DOCTOR-026, TC-DOCTOR-027 | Covered |
| AC-F11-1 | `doctor` kind + exactly one row with pinned fields; no existing row change; documented row; two-way sync; corpora/fixtures cover the new row; classification green | TC-DOCTOR-020, TC-DOCTOR-028 | Covered |
| AC-F12-1 | Tier/boundary/ambient/forbidden-literal/privacy/secret-read gates green; the `httpStatus` enrichment is type-additive within an existing adapter type; no new runtime location/subpath/config key/state kind/allowlist entry/error identity/product literal; no planted secret escapes | TC-DOCTOR-022, TC-DOCTOR-023, TC-DOCTOR-030, TC-DOCTOR-031 | Covered |
| AC-F12-2 | Fixture-driven default suite: zero live network/credentials/process spawns; network-posture fixtures assert ≤2 single-page reads with doctor's limits and no pagination/retries | TC-DOCTOR-024, TC-DOCTOR-025 | Covered |

**Capability coverage** (no capability left unlinked): F-1 → TC-DOCTOR-001, TC-DOCTOR-028; F-2 → TC-DOCTOR-003, TC-DOCTOR-004, TC-DOCTOR-005, TC-DOCTOR-021; F-3 → TC-DOCTOR-006; F-4 → TC-DOCTOR-007, TC-DOCTOR-025, TC-DOCTOR-031; F-5 → TC-DOCTOR-008, TC-DOCTOR-009, TC-DOCTOR-010; F-6 → TC-DOCTOR-011; F-7 → TC-DOCTOR-012, TC-DOCTOR-025, TC-DOCTOR-031; F-8 → TC-DOCTOR-013, TC-DOCTOR-014; F-9 → TC-DOCTOR-015, TC-DOCTOR-016, TC-DOCTOR-017; F-10 → TC-DOCTOR-018, TC-DOCTOR-019, TC-DOCTOR-026; F-11 → TC-DOCTOR-020, TC-DOCTOR-028; F-12 → TC-DOCTOR-002, TC-DOCTOR-022, TC-DOCTOR-023, TC-DOCTOR-024, TC-DOCTOR-031.

**TC → AC traceability**: every scenario's `Related IDs` line and the Scenario Index (§5.1) carry the reverse direction; the table above carries the forward direction. All 21 ACs are covered; there is no deferred AC and no uncovered AC.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no `API-#` or `EVT-#` identifiers and no HTTP endpoint or event (§8.1, §8.2). The machine data-model surface is DM-1..DM-8; each is mapped below.

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| DM-1 — `DoctorReport` | `schemaVersion: "delivery.doctor.v1"`, injected `generatedAt`, `repository`, exactly five checks, `summary {total:5, ok, fail, unreachable}` | TC-DOCTOR-003, TC-DOCTOR-016, TC-DOCTOR-018 | Covered |
| DM-2 — `DoctorCheck` | `area`, `verdict`, non-empty bounded `detail`, `fixHint` iff non-ok, `evidence` | TC-DOCTOR-003, TC-DOCTOR-021, TC-DOCTOR-026 | Covered |
| DM-3 — Verdict vocabulary | Closed `ok`, `fail`, `unreachable`; fail = observed wiring defect; unreachable = evidence could not be obtained; both non-ok are failing and exit `1` | TC-DOCTOR-004, TC-DOCTOR-013, TC-DOCTOR-021 | Covered |
| DM-4 — Check evidence model | ≤4 sources `{source,outcome}`, ≤4 unique reasons from DM-6 ordered by first occurrence, optional `failureCode` limited to existing `config.*`/`state.*` codes, optional adapter-local `failureClass` (never an identity), and optional structured numeric `httpStatus` from the delivered read; `credential-rejected` derived only from 401/403, prose never copied or parsed | TC-DOCTOR-003, TC-DOCTOR-026, TC-DOCTOR-030, TC-DOCTOR-031 | Covered |
| DM-5 — Areas and sources | Fixed area→source mapping: repo (checkout, remote-binding); tracker (remote-binding, credential, tracker-read); provider (provider-config, provider-credential, provider-parks, provider-announcements); state (state-stores); ci (remote-binding, credential, commit, ci-read); shared sources read once | TC-DOCTOR-004, TC-DOCTOR-006, TC-DOCTOR-007, TC-DOCTOR-008, TC-DOCTOR-009, TC-DOCTOR-011, TC-DOCTOR-012, TC-DOCTOR-025 | Covered |
| DM-6 — Closed reason set | Exactly the twenty-two declared reasons, including `config-invalid`, `state-unreadable`, and the delivered spellings `provider-chain-not-declared`/`provider-chain-unresolved`; renderer/aggregator never invent a reason | TC-DOCTOR-004, TC-DOCTOR-005, TC-DOCTOR-021, TC-DOCTOR-030 | Covered |
| DM-7 — Failure summary grammar | One deterministic line in fixed area order: `doctor check failures (<n>/5) — <area> (<verdict>): <fixHint>[; …]`, newlines collapsed, no secrets/remote prose, non-failing absent; generic remediation hint | TC-DOCTOR-015, TC-DOCTOR-021, TC-DOCTOR-027 | Covered |
| DM-8 — Bounds | Declared per-source read limits (one page, no pagination/retries); detail/hint ≤200 chars; serialized data ≤65 536 bytes; human ≤24 lines/4096 bytes; evidence ≤4 sources/≤4 reasons | TC-DOCTOR-018, TC-DOCTOR-019, TC-DOCTOR-025, TC-DOCTOR-026 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Check totality: 5/5 in fixed order, 100% valid verdicts, 100% non-empty detail, 100% hint on non-ok, 0 missing/extra | TC-DOCTOR-003, TC-DOCTOR-021 | Covered |
| NFR-2 | Never-crash/isolation: 0 crashes, 0 aborted siblings, 0 unhandled escapes; contaminated checks carry `doctor.check.<area>.unreachable` | TC-DOCTOR-013, TC-DOCTOR-014 | Covered |
| NFR-3 | Evidence truthfulness: 0 failed/absent/unattempted reads as ok, 0 fabricated details, 0 missing detail/hint, 0 parked provider without park evidence in detail, 0 credential-rejection classifications from prose instead of structured `httpStatus` | TC-DOCTOR-004, TC-DOCTOR-005, TC-DOCTOR-007, TC-DOCTOR-009, TC-DOCTOR-011, TC-DOCTOR-012, TC-DOCTOR-030, TC-DOCTOR-031 | Covered |
| NFR-4 | Exit stability: 100% all-ok→0, 100% non-ok→1 with `doctor.check.failed`, unable-to-run per projection, 0 exits outside `{0,1,2}`, 0 overrides, 0 failure envelopes carrying `data` | TC-DOCTOR-015, TC-DOCTOR-016, TC-DOCTOR-017 | Covered |
| NFR-5 | Provider quota safety: 0 quota fetches, 0 `resolve` calls, 0 park/announcement writes, 0 quota-transport injections | TC-DOCTOR-010 | Covered |
| NFR-6 | Read-only determinism: 0 writes/fences/state mutations/network writes/child processes; 0 machine or human drift | TC-DOCTOR-002, TC-DOCTOR-027 | Covered |
| NFR-7 | Cost bounds: ≤2 single-page reads, 0 pagination/retries, ≤1 config resolve, 0 duplicated shared store reads, pure aggregation ≤50 ms | TC-DOCTOR-007, TC-DOCTOR-012, TC-DOCTOR-025, TC-DOCTOR-029 | Covered |
| NFR-8 | Output bounds: 100% one valid envelope, human ≤24 lines/4096 bytes, serialized data ≤64 KiB | TC-DOCTOR-018, TC-DOCTOR-019, TC-DOCTOR-026, TC-DOCTOR-027 | Covered |
| NFR-9 | Error-table binding: exactly 1 new row, 0 two-way drift, 0 existing rows modified, corpora/fixtures in the same change | TC-DOCTOR-020, TC-DOCTOR-028 | Covered |
| NFR-10 | Boundaries/branding/privacy: 0 new runtime-API locations, 0 new secret-read entries, 0 product literals, 0 secrets/remote prose in output, 0 canary escapes; the additive `httpStatus` field is secret-free and introduces no new identity/location | TC-DOCTOR-022, TC-DOCTOR-023, TC-DOCTOR-031 | Covered |

All ten NFRs are covered. No NFR is left uncovered or deferred.

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Behaviour — command surface | `bun test tests/behaviour/doctor-command.test.ts` | `tests/behaviour/doctor-command.test.ts`, `tests/fixtures/doctor/harness.ts` | TC-DOCTOR-001 |
| Behaviour — report totality | `bun test tests/behaviour/doctor-report.test.ts` | `tests/behaviour/doctor-report.test.ts`, `tests/fixtures/doctor/matrix/**` | TC-DOCTOR-003, TC-DOCTOR-004 |
| Behaviour — repo | `bun test tests/behaviour/doctor-repo.test.ts` | `tests/behaviour/doctor-repo.test.ts`, `tests/fixtures/doctor/repo/**`, temp git-shaped dirs | TC-DOCTOR-006 |
| Behaviour — tracker | `bun test tests/behaviour/doctor-tracker.test.ts` | `tests/behaviour/doctor-tracker.test.ts`, `tests/fixtures/doctor/tracker/**`, reused GitHub fixtures | TC-DOCTOR-007 |
| Behaviour — provider | `bun test tests/behaviour/doctor-provider.test.ts` | `tests/behaviour/doctor-provider.test.ts`, `tests/fixtures/doctor/provider/**`, `tests/fixtures/state/harness.ts` | TC-DOCTOR-008, TC-DOCTOR-009, TC-DOCTOR-010 |
| Behaviour — state | `bun test tests/behaviour/doctor-state.test.ts` | `tests/behaviour/doctor-state.test.ts`, reused `tests/fixtures/state/harness.ts` | TC-DOCTOR-011 |
| Behaviour — CI | `bun test tests/behaviour/doctor-ci.test.ts` | `tests/behaviour/doctor-ci.test.ts`, `tests/fixtures/doctor/ci/**` | TC-DOCTOR-012 |
| Behaviour — isolation | `bun test tests/behaviour/doctor-isolation.test.ts` | `tests/behaviour/doctor-isolation.test.ts`, `tests/fixtures/doctor/isolation/cases.ts` | TC-DOCTOR-013, TC-DOCTOR-014 |
| Behaviour — outcomes | `bun test tests/behaviour/doctor-outcome.test.ts` | `tests/behaviour/doctor-outcome.test.ts`, `tests/fixtures/doctor/outcomes/**` | TC-DOCTOR-015, TC-DOCTOR-016, TC-DOCTOR-017 |
| Behaviour — output/bounds | `bun test tests/behaviour/doctor-output.test.ts` | `tests/behaviour/doctor-output.test.ts`, `tests/fixtures/doctor/bounds/**` | TC-DOCTOR-018, TC-DOCTOR-019, TC-DOCTOR-026 |
| Behaviour — negative controls | `bun test tests/behaviour/doctor-negative-controls.test.ts` | `tests/behaviour/doctor-negative-controls.test.ts`, `tests/fixtures/doctor/negative-controls/cases.ts` | TC-DOCTOR-005 |
| Behaviour — read-only/determinism | `bun test tests/behaviour/doctor-readonly-determinism.test.ts` | `tests/behaviour/doctor-readonly-determinism.test.ts`, `guardStore`, transport recorder, spawn sentinel | TC-DOCTOR-002 |
| Behaviour — GitHub httpStatus/trap catalog | `bun test tests/behaviour/doctor-github-http-status.test.ts`; `bun test tests/behaviour/providers/github-collection.test.ts` | `tests/behaviour/doctor-github-http-status.test.ts`, `tests/behaviour/providers/github-collection.test.ts`, `tests/behaviour/providers/trap-harness.ts`, `tests/fixtures/providers/traps/github.traps.json` | TC-DOCTOR-031 |
| Behaviour — network posture | `bun test tests/behaviour/doctor-network-posture.test.ts` | `tests/behaviour/doctor-network-posture.test.ts`, counting transport/readers | TC-DOCTOR-024, TC-DOCTOR-025 |
| Behaviour — performance | `bun test tests/behaviour/doctor-performance.test.ts` | `tests/behaviour/doctor-performance.test.ts`, cap-sized matrix fixture | TC-DOCTOR-029 |
| Golden — machine/human/summary | `bun test tests/golden/doctor-output.test.ts` | `tests/golden/doctor-output.test.ts`, `tests/fixtures/doctor/golden/**` | TC-DOCTOR-027 |
| Structure — vocabulary/constants | `bun test tests/structure/doctor-contract.test.ts` | `tests/structure/doctor-contract.test.ts`, `tests/structure/inventory.json` | TC-DOCTOR-021 |
| Structure — tier/purity/imports | `bun test tests/structure/doctor-imports.test.ts` | `tests/structure/doctor-imports.test.ts` (pattern from `status-imports.test.ts`) | TC-DOCTOR-022, TC-DOCTOR-023, TC-DOCTOR-030 |
| Structure — error table | `bun test tests/structure/error-table.test.ts` | existing suite extended | TC-DOCTOR-020 |
| Structure — trap catalog | `bun test tests/structure/trap-catalog.test.ts` | existing suite extended with the one added GitHub entry and fixture assertion | TC-DOCTOR-031 |
| Checks — error-table sync | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts` | existing check and mutation suite extended | TC-DOCTOR-020 |
| Checks — secret/literals/exit | `bun test tests/checks/{secret-read-boundary,forbidden-literals,exit-code-literals}.test.ts` | existing suites, doctor fixtures/cases added | TC-DOCTOR-017, TC-DOCTOR-023 |
| Boundaries / ambient / entrypoints | `bun test tests/boundaries`; `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts` | existing harnesses and rule fixtures; no new rule | TC-DOCTOR-022, TC-DOCTOR-023 |
| Documentation reconciliation | `git diff --check`; YAML parse/link review; `bash scripts/.tests/test-doc-distribution.sh` when applicable | `doc/planning/.../man-page.md`, `doc/spec/features/**`, `doc/00-index.md`, glossary, registry | TC-DOCTOR-028 |
| Aggregate and non-regression | `pnpm check`; `git diff --check`; `git status --porcelain` | repo root | all TCs |

### 4.1 In-Process Doctor-Harness Contract (binding for every doctor behaviour TC)

1. **One harness, no spawned processes.** Every behaviour test builds the `doctor` command definition with injected dependencies (brand, clock, run id, secrets/credential port, repository facts, GitHub client/read functions, provider config, state store/fold, transport, streams) and calls `runCli(argv, streams, deps)` in process, following `tests/golden/helpers.ts` and the `runCli` contract in `packages/cli/src/index.ts`. No doctor suite spawns a child process.
2. **Injected reads and time.** The repository binding/checkout facts, tracker list read, check-runs read (including the optional structured `httpStatus`/`failureClass` on failed reads), provider configuration snapshot, provider ledger/fold, verified state reads, credential resolution, clock, run id, brand, and streams are injected. No test reads `$HOME`, the wall clock, the real state directory, the ambient environment, or the network where purity is asserted.
3. **Self-materializing fixtures.** Normalized facts are committed under `tests/fixtures/doctor/**` or built in a fresh `mkdtemp` root from the state harness; no test writes the live tree, `dist/`, or the user's real state directory.
4. **One oracle per verdict cell.** Every matrix, negative-control, isolation, and corpus case asserts (a) the five areas and order, (b) each affected check's verdict, (c) the closed evidence reason set and source outcomes, (d) detail/hint presence and bounds, (e) the `summary` counts, (f) the error identity/exit/summary on non-ok, and (g) the absence of `data` on failure. A case that merely asserts "not ok" is not sufficient.
5. **Recording seams.** Read functions record call order and arguments; the state-store wrapper (reuse `guardStore` from `tests/behaviour/verify-support.ts`) records reads and throws on `append`/`replaceDocument`/`acquireFence`/`releaseFence`; the provider engine/quota seams are counting stubs that throw if called; the credential port records presence resolutions and never returns material into evidence; the transport records every request and throws on an unfixtured URL or a non-`GET` method; a spawn sentinel throws if used. The adapter payload-failure fixture asserts the optional `httpStatus` is present on non-2xx and tolerated when absent on older shapes. A recorder that never observes a read is itself a failure (proved by a positive control).
6. **Fixed output facts.** Where byte equality is asserted, the harness injects a fixed `runId` (for example `run-doctor-fixture`), a fixed clock tick (for example `2026-11-18T10:20:00Z`), and the synthetic brand from `tests/golden/helpers.ts`, so the envelope and human text are comparable byte-for-byte.
7. **No handler stream writes or exit choices.** The doctor handler returns the report or a classified failure; the CLI edge is the only writer and the only projector. Tests supply throwing sinks to the handler invocation and passing sinks to the edge, and assert the handler never calls `process.exit` or writes a stream.

### 4.2 Non-Vacuity Contract (binding for every negative, matrix, isolation, bounds, and read-only scenario)

- Every negative fixture carries a distinctive `planted-doctor-*` canary in a source payload, credential, provider park evidence, state payload, or remote detail; the fixture builder asserts the intended mutation/omission is present before doctor runs, and the canary must not appear in stdout, stderr, evidence, detail, hint, summary, or human report.
- Every negative is paired with a restored-or-valid control that reaches the declared `ok` or `fail` outcome through the same invocation path (for example, a failed tracker read restored to a successful page yields tracker `ok`).
- Every cap/truncation fixture has an under-cap control and an at/over-cap control in the same test; the under-cap control must not be marked truncated or clamped, and the over-cap control must be bounded deterministically.
- Every isolation injection is paired with an all-ok control through the same harness, and every sibling's expected verdict is asserted so an implementation cannot hide an aborted sibling behind the affected check.
- Every read-only assertion is paired with a seeded-write/spawn/engine call that the guard detects; every no-quota/no-engine assertion is paired with a counting stub proven live by a deliberate call in the control.
- Every structure/mutation test runs on in-memory values or temp copies; the live tree is never written, and the unmutated control is green in the same test.
- Every golden is regenerated only by an explicit command and compared byte-for-byte; a changed-fact control must break equality, proving the golden is live.
- Every `httpStatus` control pairs the structured status with a conflicting prose detail: `httpStatus: 401` + prose "server error" must still classify `credential-rejected`; `httpStatus: 500` + prose "unauthorized" must still stay `read-failed`/unreachable; a failure with `httpStatus` absent and prose "401 Unauthorized" must stay unreachable — proving classification never parses prose.
- The additive trap-catalog test asserts the new entry's four-field shape and its fixture assertion; removing the entry or its fixture must fail bidirectional coverage by name, while the unmutated catalog is green.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-DOCTOR-001 | Command surface: no positionals/flags, `--json` only, parser rejection before reads | Happy Path | Critical | High | AC-F1-1 |
| TC-DOCTOR-002 | Read-only and deterministic: zero writes/fences/mutations/network writes/spawns, byte-identical replay | Regression | Critical | High | AC-F1-2, NFR-6 |
| TC-DOCTOR-003 | Five-check report totality, fixed order, verdict/detail/evidence/hint discipline, summary counts | Happy Path | Critical | High | AC-F2-1, NFR-1 |
| TC-DOCTOR-004 | Appendix A verdict derivation matrix incl structured `httpStatus`, every condition and within-check precedence | Regression | Critical | High | AC-F2-2, NFR-3 |
| TC-DOCTOR-005 | Exhaustive AC-F2-3 negative-control matrix: no false all-clear (plus supplementary auth/config controls) | Negative | Critical | High | AC-F2-3, NFR-3 |
| TC-DOCTOR-006 | Repo check: clean/dirty/origin/unreadable, no base conformance | Corner Case | Critical | High | AC-F3-1 |
| TC-DOCTOR-007 | Tracker check: one bounded page, empty success, credential/`httpStatus` 401-403/transport/unattempted | Corner Case | Critical | High | AC-F4-1, NFR-7 |
| TC-DOCTOR-008 | Provider ok path: chain/credentials/fold, wiring-neutral parks incl `reevaluation-cap`, announcements | Corner Case | Critical | High | AC-F5-1 |
| TC-DOCTOR-009 | Provider wiring defects: tolerant config failures, no/invalid chain, unresolvable credential, unreadable fold | Negative | Critical | High | AC-F5-2, NFR-3 |
| TC-DOCTOR-010 | Provider quota safety: zero quota/resolve/write/transport/peak activity | Negative | Critical | High | AC-F5-3, NFR-5 |
| TC-DOCTOR-011 | State check: verified/empty, torn/schema/permission/unknown, no repair | Corner Case | Critical | High | AC-F6-1 |
| TC-DOCTOR-012 | CI check: one bounded page, zero runs, credential/`httpStatus` 401-403/commit/transport/unattempted, failed runs neutral | Corner Case | Critical | High | AC-F7-1, NFR-7 |
| TC-DOCTOR-013 | Per-check isolation: throw/rejection/malformed result per area, sibling completion | Negative | Critical | High | AC-F8-1, NFR-2 |
| TC-DOCTOR-014 | Containment boundary: no `fallback.internal` inside checks; tolerant config failures stay in-check; outside-check containment exit 2 | Regression | Critical | High | AC-F8-2, AC-F9-3, NFR-2 |
| TC-DOCTOR-015 | Failure outcome: `doctor.check.failed`, exit 1, Appendix B summary grammar | Negative | Critical | High | AC-F9-1, DM-7 |
| TC-DOCTOR-016 | Success outcome and envelope exclusivity: all-ok data/exit 0; failure no data | Happy Path | Critical | High | AC-F9-2, NFR-4 |
| TC-DOCTOR-017 | Unable-to-run and exit taxonomy: exit 2 through the projection, no overrides, `{0,1,2}` totality | Negative | Critical | High | AC-F8-2, AC-F9-3, NFR-4 |
| TC-DOCTOR-018 | Machine output: one valid envelope every outcome, data ≤64 KiB, v1 key set | Happy Path | Critical | High | AC-F9-2, AC-F10-1, NFR-8 |
| TC-DOCTOR-019 | Human report: fixed lines/hints, ≤24 lines/4096 bytes, zero extra reads, failure summary | Happy Path | Critical | High | AC-F10-1, NFR-8 |
| TC-DOCTOR-020 | Error-table evolution: doctor kind + one row, documented row, two-way sync corpora | Regression | Critical | High | AC-F11-1, NFR-9 |
| TC-DOCTOR-021 | Contract vocabulary and constants: 22 reasons, `httpStatus`/`failureClass`, areas/verdicts/sources/bounds/catalog bound to spec | Regression | Critical | High | AC-F2-1, AC-F2-2, NFR-1 |
| TC-DOCTOR-022 | Tier, purity, imports, inventory, no new locations/keys/record kinds | Regression | Critical | High | AC-F12-1, NFR-10 |
| TC-DOCTOR-023 | Privacy, secret, forbidden-literal, and redaction canaries | Regression | Critical | High | AC-F12-1, NFR-10 |
| TC-DOCTOR-024 | Hermetic default suite: zero live network/credentials/spawns | Regression | Critical | High | AC-F12-2 |
| TC-DOCTOR-025 | Network posture and shared-source read budget: ≤2 single-page reads, no pagination/retries, one shared 401/403 mechanism | Regression | Critical | High | AC-F4-1, AC-F7-1, AC-F12-2, NFR-7 |
| TC-DOCTOR-026 | Text bounds and evidence caps: 200 chars, 4 sources/reasons, `failureCode`/`failureClass`/`httpStatus` discipline | Corner Case | Critical | High | AC-F10-1, DM-4, DM-8 |
| TC-DOCTOR-027 | Golden outputs: Appendix B summaries, success report, human report, changed-fact control | Regression | Critical | High | AC-F9-1, AC-F10-1, NFR-6 |
| TC-DOCTOR-028 | Documentation reconciliation: man-page grammar, feature spec, additive read-result surface, registry/glossary/index | Regression | Important | High | AC-F11-1, F-1, F-11, NFR-9, §8.5 |
| TC-DOCTOR-029 | Performance and cost: pure aggregation ≤50 ms, one config resolve, no retry loops | Regression | Important | Medium | NFR-7 |
| TC-DOCTOR-030 | Evidence discipline: DM-5 sources, 22 DM-6 reasons, `failureCode`/`failureClass`/`httpStatus` rules, no identity promotion | Regression | Critical | High | AC-F2-1, AC-F2-2, AC-F12-1, NFR-3 |
| TC-DOCTOR-031 | Additive `httpStatus` read-result field and GitHub trap-catalog coverage | Regression | Critical | High | AC-F4-1, AC-F7-1, AC-F12-1, NFR-3, NFR-10 |

Thirty TCs are fully automated; TC-DOCTOR-028 is semi-automated (structural assertions plus a manual documentation/link review). Every TC is non-vacuous per §4.2; the controls are named in each scenario.

### 5.2 Scenario Details

#### TC-DOCTOR-001 - Command surface: no positionals/flags, `--json` only, parser rejection before reads

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DEC-1, NFR-4
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-command.test.ts`, `tests/fixtures/doctor/harness.ts`
**Tags**: @backend @cli

**Preconditions**:

- The `doctor` command definition is composed with injected readers, a fixed brand/clock/run id, and a recording source-read counter.
- An all-ok fixture reaches a success report; the parser program registers `doctor` with no flags and no positionals.
- A throwing-sink handler invocation and a passing-sink edge invocation are available.

**Steps**:

1. Run `runCli(["doctor"], streams, deps)` and assert exactly one outcome, exit `0`, and the five-check success report.
2. Run `runCli(["doctor", "--json"], ...)` and assert exactly one `CommandResult` envelope on stdout, no human diagnostic on stdout, and the same `data` report as step 1 (modulo fixed run id/timing).
3. Run `runCli(["doctor", "extra"], ...)` and assert `error.code` is exactly `fallback.invocation`, exit `1`, no `data`, and source-read count `0`.
4. Run `runCli(["doctor", "--fix-hints"], ...)` and `runCli(["doctor", "--json", "--fix-hints"], ...)`; assert `fallback.invocation`, exit `1`, zero source reads, and no `data`.
5. Run an unknown flag (`--limit 5`) and assert the same rejection with zero reads.
6. Assert the definition declares `positionals.max` absent/zero and `flags: []`; `--json` is the global output switch and adds no doctor-specific behavior; no `--fix-hints` or other doctor flag exists.
7. Invoke the handler with throwing stdout/stderr sinks and assert it returns data or a classified failure only, with no stream write and no exit call.
8. Positive control: re-run `["doctor"]` after the rejected invocations; assert exit `0` and five checks.

**Expected Outcome**:

- The exact surface `<binary> doctor [--json]` returns one report; extra positionals and unknown flags (including `--fix-hints`) are rejected by the parser with `fallback.invocation`, exit `1`, and zero source reads; `--json` changes only serialization; the handler is write-free and exit-free.

**Notes / Clarifications**:

- The pack man page's `doctor [--fix-hints]` is seed drift; the spec removes it and the parser rejection above is the executable negative proof.

#### TC-DOCTOR-002 - Read-only and deterministic: zero writes/fences/mutations/network writes/spawns, byte-identical replay

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F1-2, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-readonly-determinism.test.ts`, `tests/fixtures/state/harness.ts`, `tests/behaviour/verify-support.ts`
**Tags**: @backend @security

**Preconditions**:

- A verified temp state store wrapped by `guardStore` (records reads, throws on `append`/`replaceDocument`/`acquireFence`/`releaseFence`).
- A recording transport that permits only `GET` to the two fixture URLs and throws on every other method/URL.
- A spawn sentinel injected into the runtime that throws if any child-process seam is used.
- A fully-ok fixture and a mixed failure fixture; fixed run id, clock, and brand.

**Steps**:

1. Snapshot the temp state root bytes and the transport request log before the run.
2. Run `doctor --json` on the all-ok fixture; assert exit `0` and zero mutation calls on the guarded store.
3. Assert the transport log contains only the two read `GET`s (where the fixture reaches both reads), no write method, and no unfixtured URL.
4. Assert the spawn sentinel was never invoked; run the same with the mixed fixture and assert the sentinel remains unused.
5. Assert the state-root bytes are unchanged after both runs.
6. Run each fixture twice with the fixed run id and clock; assert byte-identical stdout for `--json` and byte-identical human stdout.
7. Control: deliberately call `append` and the spawn sentinel in the harness; assert the guards fire, proving the detectors are live.

**Expected Outcome**:

- Doctor performs zero writes, fences, state mutations, network writes, and child processes; identical injected inputs produce byte-identical machine and human output.

#### TC-DOCTOR-003 - Five-check report totality, fixed order, verdict/detail/evidence/hint discipline, summary counts

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-1, DM-2, DM-3, DM-4, AC-F2-1, NFR-1
**Test Type(s)**: Contract, Structure, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-report.test.ts`, `tests/fixtures/doctor/matrix/**`
**Tags**: @backend

**Preconditions**:

- An all-ok fixture and an internal aggregation fixture with `repo: fail`, `tracker: unreachable`, and the other three `ok`.
- A mixed fixture whose shared repository binding is unresolvable, so the internal report's `repository` is in its declared unavailable shape.
- The expected area order `["repo","tracker","provider","state","ci"]`, the closed verdict set, and the closed outcome set.
- `assertEnvelopeContract` from `packages/testkit/src/result-conformance.ts`.

**Steps**:

1. Run `--json doctor` on the all-ok fixture; assert exit `0`, one success envelope, `assertEnvelopeContract` returns `[]`, no `error`, and `data.schemaVersion === "delivery.doctor.v1"`.
2. Assert `data.checks.map(c => c.area)` is exactly the five areas in order, length `5`, no duplicate/extra; each check has a verdict in the closed set, a non-empty detail, and an evidence object.
3. Assert the all-ok report has no `fixHint` on any check and `data.summary` is exactly `{total:5, ok:5, fail:0, unreachable:0}`.
4. Call the pure aggregator with the mixed check results and inspect the internal `DoctorReport`; assert `repo` is `fail`, `tracker` is `unreachable`, each non-ok check has a non-empty bounded `fixHint`, and ok checks have none; assert `summary` is `{total:5, ok:3, fail:1, unreachable:1}`.
5. For every check assert `detail` is a non-empty string ≤200 characters and `evidence.sources`/`evidence.reasons` obey the DM-4 shape and caps; when a failed read is present, assert optional `failureClass` (adapter-local class) and optional numeric `httpStatus` are structured data, never identities, and that `credential-rejected` appears only for 401/403.
6. Assert `generatedAt` equals the injected clock value and `repository` is the shared observed binding.
7. Assert the all-ok report's `repository` is the observed `{host, owner, name}` binding; assert the unresolved-binding internal report carries the declared unavailable `repository` shape with no owner/name/credential material (DM-1).
8. Negative controls (in-memory report mutation): drop a check, duplicate an area, swap the order, empty a detail, add a `fixHint` to an ok check, remove a non-ok hint, and corrupt a summary count; each mutation must make the assertion fail.
9. Assert the machine failure path still has no `data` (envelope exclusivity, TC-DOCTOR-016) while the internal aggregation above remains five checks (spec v1.1 F-8/F-9; OQ-T1 closed).

**Expected Outcome**:

- Every completed aggregation has exactly five ordered checks with valid verdicts, non-empty bounded detail, evidence, `fixHint` iff non-ok, and truthful summary counts; the all-ok machine report carries no hints; malformed report controls fail by name.

#### TC-DOCTOR-004 - Appendix A verdict derivation matrix incl structured `httpStatus`, every condition and within-check precedence

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-3, DM-5, DM-6, DEC-11, AC-F2-2, NFR-3
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-report.test.ts`, `tests/fixtures/doctor/matrix/**`
**Tags**: @backend

**Preconditions**:

- One fixture per Appendix A condition:
  - `repo` `ok` (readable clean work tree + GitHub `origin`); `fail` (dirty; origin missing; origin unparseable; non-GitHub origin); `unreachable` (checkout facts unreadable; contained execution cross-referenced to TC-DOCTOR-013).
  - `tracker` `ok` (resolved binding + credential + successful read, including a verified-empty page); `fail` (credential unresolvable; wiring read failed with structured `httpStatus` 401 and 403 → credential rejection); `unreachable` (binding unresolvable → read not attempted; any other non-2xx 404/500/503, timeout, or transport failure with no 401/403 → `read-failed`; contained execution).
  - `provider` `ok` (provider-configuration read succeeded, declared valid chain, credentials resolve, fold readable; active `peak-window`/`quota-exhausted`/`provider-outage`/`chain-exhausted`/`reevaluation-cap` park stays ok with detail); `fail` (configuration-resolution failure `config-invalid` with a classified `config.*` code; provider-branch validation failure `provider-chain-unresolved` with `config.value.invalid`; no default chain `provider-chain-not-declared`; unresolvable credential reference; active park with `credential-missing`/`credential-rejected`); `unreachable` (park/announcement fold read failure `state-unreadable`; contained execution).
  - `state` `ok` (all stores verify including verified-empty); `fail` (torn; schema mismatch; permission failure; undeclared record kind/schema); `unreachable` (unreadable beyond classified conditions; contained execution).
  - `ci` `ok` (binding + credential + commit + successful check-runs read, including zero runs); `fail` (credential unresolvable; wiring read failed with structured `httpStatus` 401/403 → credential rejection; commit unresolved); `unreachable` (binding unresolvable → read not attempted; any other non-2xx 404/500/503, timeout, or transport failure → `read-failed`; contained execution).
- Precedence fixtures: tracker credential unresolvable plus binding unresolvable; CI credential unresolvable plus commit unresolved; provider multiple defects; state torn plus schema mismatch; a 401 with a conflicting transport-shaped prose detail.
- A reason-spelling control table with the old draft names (`chain-not-declared`, `chain-unresolved`) as deliberate negative inputs.

**Steps**:

1. For each condition fixture run the aggregation and the CLI; assert the affected check's verdict exactly as Appendix A declares, the expected reason(s) from DM-6, the expected source outcome (`read`/`observed-empty`/`failed`/`not-configured`), and a non-empty detail plus hint on every non-ok verdict.
2. Assert `summary` counts equal the verdicts and the error identity/exit are `doctor.check.failed`/`1` whenever any check is non-ok; assert `ok` only for the declared success conditions.
3. For `tracker` verified-empty and `ci` zero runs, assert the check is `ok` with `observed-empty` evidence and no fabricated items.
4. For `ci` with failed runs, assert the verdict remains `ok` and the failed-run facts appear only as bounded detail (build health is not wiring).
5. Assert `tracker`/`ci` 401 and 403 fixtures are `fail`/`credential-rejected`; assert 500, 503, transport, and absent-`httpStatus` fixtures are `unreachable`/`read-failed`; assert classification follows the structured status only (a 401 with prose "server error" is fail; a 500 with prose "unauthorized" is unreachable).
6. Assert the provider `config-invalid` and `provider-chain-unresolved` fixtures are `fail` with their declared reasons and `failureCode`s, that all five checks still report, and that neither aborts the command or becomes `unreachable` (DEC-12).
7. Precedence: assert the observed `fail` outranks the later dependency `unreachable` (tracker credential failure with an unresolvable binding is `fail`, not `unreachable`; CI missing credential with an unresolved commit is `fail`, with the credential hint first); assert provider and state fail precedence follows the Appendix A left-to-right order.
8. Negative controls: flip one expected verdict per area in an in-memory expected table and assert the matrix test fails; assert no fixture produces a reason outside the twenty-two DM-6 values; assert the old draft spellings fail the reason-set assertion; assert the contained-execution cells are covered by TC-DOCTOR-013 rather than duplicated here.
9. Assert the matrix case table is complete: five areas × three verdicts, plus the precedence and `httpStatus` cases, with no unnamed cell.

**Expected Outcome**:

- Every Appendix A condition maps to exactly its declared verdict, reason, source outcome, detail/hint, and exit; verified-empty and observed-empty are the only zero-claim success paths; 401/403 classify as credential rejection while every other non-2xx/transport failure stays unreachable; provider configuration failures are check-level `fail`, never an abort; fail outranks later dependency failure; no invented or stale reason appears.

#### TC-DOCTOR-005 - Exhaustive AC-F2-3 negative-control matrix: no false all-clear

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-8, DM-6, AC-F2-3, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-negative-controls.test.ts`, `tests/fixtures/doctor/negative-controls/cases.ts`
**Tags**: @backend

**Preconditions**:

- Exactly the eight AC-F2-3 controls, each with a distinctive `planted-doctor-control-*` canary:
  1. failed tracker read (a non-auth 500/503, timeout, or transport failure, not 401/403);
  2. unattempted tracker read because the binding is unresolvable;
  3. failed CI read (a non-auth 500/503, timeout, or transport failure, not 401/403);
  4. missing credential (tracker and/or CI);
  5. torn state store;
  6. undeclared provider chain;
  7. unreadable provider park/announcement fold;
  8. contained check-internal throw.
- Supplementary controls (not part of the required-eight meta-check), each also non-`ok`: tracker 401/403, CI 401/403, provider `config-invalid`, and provider `provider-chain-unresolved`.
- A restored/valid control for each case that reaches the declared non-`ok` or `ok` outcome through the same harness.

**Steps**:

1. For each of the eight required controls run `doctor --json`; assert the affected check's verdict is exactly the Appendix A verdict (`unreachable` for 1, 2, 3, 7, 8; `fail` for 4, 5, 6), never `ok`.
2. Assert the affected check's evidence reason set is within DM-6 and includes the expected reason (`read-failed`, `not-attempted`, `credential-unavailable`, `store-torn`, `provider-chain-not-declared`, `state-unreadable`, `check-unreachable` as applicable).
3. Run the four supplementary controls; assert tracker/CI 401/403 are `fail`/`credential-rejected`, provider `config-invalid`/`provider-chain-unresolved` are `fail` with their declared reasons/`failureCode`s, and none is `ok`.
4. Assert the detail is bounded factual text derived from the fixture, not a fabricated success/zero claim; assert no "no parks", "all clear", or empty-detail claim appears for the provider fold control.
5. Assert exit `1`, error identity `doctor.check.failed`, no `data`, and the summary names the affected check with its verdict and hint.
6. Assert the control canary never appears in stdout, stderr, evidence, detail, hint, summary, or the human report.
7. Run the restored control for each case and assert it reaches the declared restored outcome (for example, a successful tracker page yields tracker `ok`; a readable fold yields provider `ok`), proving the control is live.
8. Meta-check: assert the case table contains exactly the eight required AC-F2-3 controls and no duplicate or missing id; assert a deliberately dropped case makes the meta-check fail; assert the supplementary controls are labelled as supplemental and do not replace a required control.

**Expected Outcome**:

- None of the eight required controls yields `ok` for the affected check or fabricates a detail; unattempted/unobserved reads are `unreachable` (or the declared `fail`); the four supplementary auth/config controls are also non-`ok`; every control is paired with a live restored control.

#### TC-DOCTOR-006 - Repo check: clean/dirty/origin/unreadable, no base conformance

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-5, DEC-8, AC-F3-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-repo.test.ts`, `tests/fixtures/doctor/repo/**`, temp git-shaped dirs
**Tags**: @backend

**Preconditions**:

- Clean checkout fixtures with an HTTPS `origin` and an SSH `origin`, both resolving to a GitHub owner/name.
- Dirty work-tree fixture; origin missing/unparseable/non-GitHub fixtures; unreadable checkout-facts fixture; linked-worktree fixture.
- A recording transport that must remain unused for the repo check.

**Steps**:

1. Run the clean HTTPS and SSH fixtures; assert `repo` is `ok`, detail names the observed branch and HEAD (bounded) or explicitly states the facts, and no base-conformance claim appears.
2. Assert the clean run performed zero network reads for the repo check (transport count unchanged), proving the repo check is local.
3. Run the dirty fixture; assert `repo` is `fail`, the reason includes `checkout-dirty`, the hint instructs commit-or-discard, and no `watchdog.checkout-dirty` / `watchdog.checkout-non-base` identity appears in the error or evidence.
4. Run the three bad-origin fixtures; assert `repo` is `fail` with `remote-unresolvable` and a fix-the-remote hint; assert zero connection attempts (transport count `0`).
5. Run the unreadable-checkout fixture; assert `repo` is `unreachable` with `doctor.check.repo.unreachable`, a bounded detail, and a hint.
6. Run the linked-worktree fixture with a GitHub origin; assert `repo` is `ok` and the detail does not invent a base branch.
7. Negative controls: assert no fixture output contains a base-branch verdict (`base`, `non-base`) or a `watchdog.*` code; assert the dirty fixture restored to clean yields `ok`.

**Expected Outcome**:

- The repo check truthfully distinguishes clean/dirty/bad-origin/unreadable local states, never performs a network read, never evaluates base conformance, and never reuses a watchdog refusal identity.

#### TC-DOCTOR-007 - Tracker check: one bounded page, empty success, credential/`httpStatus` 401-403/transport/unattempted

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-4, DM-5, DEC-11, AC-F4-1, NFR-3, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-tracker.test.ts`, `tests/fixtures/doctor/tracker/**`, reused GitHub fixtures
**Tags**: @backend

**Preconditions**:

- A success fixture with a non-empty work-item page; a verified-empty page fixture; a credential-resolution-failure fixture; wiring-read rejection fixtures with `httpStatus: 401` and `httpStatus: 403`; any-other-non-2xx fixtures with `httpStatus: 404`, `httpStatus: 500`, and `httpStatus: 503`; a timeout fixture; a transport-failure fixture with `httpStatus` absent; an unresolvable-binding fixture.
- A failure fixture whose prose detail conflicts with the structured status (for example `httpStatus: 401` + detail "server error"; `httpStatus: 500` + detail "unauthorized"; absent status + detail "401 Unauthorized").
- A recording list read that captures limit and pagination parameters; a credential port recorder that returns presence only.

**Steps**:

1. Run the success fixture; assert `tracker` is `ok`, exactly one list read occurred with the declared positive limit, no page/cursor parameter beyond that limit, and no retry.
2. Run the verified-empty fixture; assert `tracker` is `ok` with `observed-empty` evidence and no fabricated items.
3. Run the credential-failure fixture; assert `tracker` is `fail`, reason `credential-unavailable`, the classified `config.credential.missing` failure code is carried where the port supplies it, and the hint names only the declared environment-variable/source key (never a value).
4. Run the 401 and 403 fixtures; assert `tracker` is `fail`, reason `credential-rejected`, the hint instructs replacing or broadening the credential, and the classification derives from the structured `httpStatus` only; assert the read was attempted exactly once.
5. Run the 404, 500, 503, timeout, and absent-`httpStatus` transport fixtures; assert `tracker` is `unreachable` with `doctor.check.tracker.unreachable`, reason `read-failed`, and a check-the-credential-and-reachability hint; assert one attempt and no retry.
6. Run the conflicting-prose fixtures; assert 401 + "server error" is still `fail`/`credential-rejected`; 500 + "unauthorized" is still `unreachable`/`read-failed`; absent status + "401 Unauthorized" is still `unreachable`/`read-failed` — prose is never parsed.
7. Run the unresolvable-binding fixture; assert the list read was not attempted (call count `0`), `tracker` is `unreachable` with `not-attempted`, and the hint directs to the repo finding.
8. Negative controls: assert no failed/empty/unattempted case is `ok`; assert the credential canary never appears; assert the success fixture restored after each failure reaches `ok`; assert an older failure shape without `httpStatus` is tolerated and remains unreachable.

**Expected Outcome**:

- Tracker wiring is proven by exactly one bounded read; verified-empty is the only zero-claim success; credential-port failure is `fail`/`credential-unavailable`; structured 401/403 is `fail`/`credential-rejected` with the replace-or-broaden hint; every other non-2xx/timeout/transport failure with absent status is `unreachable`/`read-failed`; prose is never parsed.

**Notes / Clarifications**:

- DEC-11 supplies the structured `httpStatus`; TC-DOCTOR-031 asserts the adapter payload failure carries the field and the trap catalog covers it. A failure without the field is a valid older shape and must stay `unreachable` — never inferred from prose.

#### TC-DOCTOR-008 - Provider ok path: chain/credentials/fold, wiring-neutral parks, announcements

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-3, DM-5, DEC-6, AC-F5-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-provider.test.ts`, `tests/fixtures/doctor/provider/**`, `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Preconditions**:

- A provider-configuration read that succeeded, a declared structurally valid default chain with enabled entries whose credential references resolve; a readable verified park/announcement fold (empty and populated).
- Park fixtures built from verified state-harness records for all five closed wiring-neutral causes, using the delivered `PARK_CAUSES` spellings: `peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, `reevaluation-cap`; plus `credential-missing`/`credential-rejected` credential-cause parks.
- Persisted announcement records with allowed codes/severities.

**Steps**:

1. Run the empty-fold fixture; assert `provider` is `ok`, the chain is resolved, enabled credentials are present, and the fold read occurred once.
2. Run each of the five wiring-neutral park fixtures (`peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, `reevaluation-cap`); assert the verdict stays `ok`, the detail names the park's subject, cause, and expiry, and the detail carries `provider quota --provider <name>`; assert the evidence reason includes `park-active`.
3. Assert the overall run with only a wiring-neutral park (including `reevaluation-cap`) is a success envelope with exit `0` (routine parks never flip the exit or train operators to ignore exit `1`).
4. Run the announcement fixture; assert the persisted announcement is reflected as bounded evidence/detail (`announcement-recorded`) without flipping the verdict and without raw payload/remote prose.
5. Run the credential-caused park fixture; assert `provider` is `fail`, reason `park-credential-cause`, the hint instructs refreshing the credential naming the source key only, and the detail still directs to `provider quota --provider <name>`.
6. Run a fixture with multiple active parks; assert deterministic ordering (expiry ascending, then name) or a documented stable order, and that all are named within bounds.
7. Negative controls: assert a parked provider never appears as if no park were recorded; assert no park evidence leaks a credential value; assert the restored readable/empty fold yields `ok`; assert `reevaluation-cap` is not rendered as a credential defect or a fail.

**Expected Outcome**:

- Capacity, environment, and loop-cap parks (including `reevaluation-cap`) are wiring-neutral detail with cause, expiry, and a quota directive; credential-caused parks fail with a refresh hint naming only the source key; persisted announcements are bounded evidence; the provider never presents a parked provider as unrecorded.

**Notes / Clarifications**:

- OQ-T11 is resolved by spec v1.1 DEC-6 and AC-F5-1: `reevaluation-cap` (the delivered `PARK_CAUSES` spelling) is a self-expiring defensive loop-cap pause and is wiring-neutral, exactly like the other capacity/environment parks.

#### TC-DOCTOR-009 - Provider wiring defects: tolerant config failures, no/invalid chain, unresolvable credential, unreadable fold

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-3, DM-4, DM-5, DM-6, DEC-12, AC-F5-2, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-provider.test.ts`, `tests/fixtures/doctor/provider/**`, `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Preconditions**:

- Fixtures: no default chain; structurally invalid chain; enabled entry with an unresolvable credential reference; disabled entry with an unresolvable reference (must not fail); provider-configuration read failure `config-invalid` carrying a classified `config.*` code and a correct-the-named-source hint; provider-branch validation failure `provider-chain-unresolved` carrying `failureCode: "config.value.invalid"` and a correct-the-provider-configuration hint; park/announcement fold read failure (`state-unreadable`).
- The provider configuration read, resolved snapshot, and ledger are injected; no engine is present; all five checks are in the run.
- A reason-spelling control table with the old draft names (`chain-not-declared`, `chain-unresolved`) as deliberate negative inputs.

**Steps**:

1. Run the no-chain fixture; assert `provider` is `fail`, reason `provider-chain-not-declared`, and the hint instructs declaring a chain (mirroring `provider.chain.empty` guidance).
2. Run the invalid-chain fixture; assert `provider` is `fail`, reason `provider-chain-unresolved`, and the hint instructs correcting the provider configuration (mirroring `provider.chain.invalid`).
3. Run the unresolvable-credential fixture; assert `provider` is `fail`, reason `credential-unavailable`, and the hint names the declared source key only.
4. Run the disabled-entry fixture; assert the check is `ok` and the disabled reference is not required.
5. Run the `config-invalid` fixture; assert `provider` is `fail`, reason `config-invalid`, the evidence carries the classified `config.*` failure code, and the hint corrects the named source; assert the internal aggregation and human failure report contain all five checks and the command does not abort (DEC-12).
6. Run the `provider-chain-unresolved` fixture; assert `provider` is `fail`, reason `provider-chain-unresolved`, `failureCode` is exactly `config.value.invalid`, and the hint corrects the provider configuration; assert the internal aggregation and human failure report contain all five checks and the command does not abort.
7. Run the unreadable-fold fixture; assert `provider` is `unreachable`, reason `state-unreadable`, the hint repairs the store, and no "no parks"/empty-park claim appears.
8. Negative controls: assert no defect yields `ok`; assert no defect yields `fallback.internal`; assert the readable/valid restored controls reach `ok`; assert the fold failure is never rendered as "no parks"; assert the old reason spellings (`chain-not-declared`, `chain-unresolved`) fail the reason-set assertion.

**Expected Outcome**:

- Every provider wiring defect maps to its declared fail/unreachable verdict, reason, and actionable hint; the two delivered provider-configuration failure reasons are check-level `fail` evidence and never abort the run; disabled entries do not require credentials; an unreadable fold is never mistaken for an empty fold.

#### TC-DOCTOR-010 - Provider quota safety: zero quota/resolve/write/transport/peak activity

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-provider.test.ts`, `tests/behaviour/doctor-readonly-determinism.test.ts`
**Tags**: @backend @security

**Preconditions**:

- Counting stubs for: quota fetch/transport `send`, provider-engine `resolve`, chain decision/evaluate, peak/quota condition evaluation, park write/clear, announcement write, state append/replace/fence.
- The provider check runs across the `ok`, `fail`, and `unreachable` fixtures from TC-DOCTOR-008/009.
- A control that deliberately calls each stub once to prove the counters are live.

**Steps**:

1. Zero all counters, run the provider check on each fixture, and assert every counter remains `0`.
2. Assert the quota transport was never constructed or injected into the doctor runtime; assert no URL matching a quota endpoint appears in the transport log.
3. Assert no `provider resolve`/engine call is recorded and no peak/quota evaluation function is invoked.
4. Assert no park/announcement write, state append/replace, or fence acquisition is recorded.
5. Control: deliberately invoke each counting stub once at the end and assert the counters increment, proving the zero assertions are non-vacuous.
6. Assert the provider hint text directs the operator to `provider quota --provider <name>` but doctor itself never calls it.

**Expected Outcome**:

- Doctor's provider check reads configuration, credential presence, parks, and announcements only; it makes zero quota fetches, zero engine `resolve` calls, zero writes, zero peak/quota evaluations, and never touches the quota transport.

#### TC-DOCTOR-011 - State check: verified/empty, torn/schema/permission/unknown, no repair

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, DM-5, AC-F6-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-state.test.ts`, reused `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Preconditions**:

- Verified temp stores: valid non-empty, verified-empty, torn, schema-mismatch, permission-denied, undeclared-record-kind, and unreadable-beyond-classified.
- A guarded store that records reads and throws on mutation/salvage; the provider fold shares the store read.

**Steps**:

1. Run the valid and verified-empty fixtures; assert `state` is `ok` and the evidence uses `state-stores` with a successful/empty outcome.
2. Run the torn fixture; assert `state` is `fail`, reason `store-torn`, the hint describes salvage as a separate step, and no salvage/repair call was made.
3. Run the schema-mismatch fixture; assert `fail`, reason `store-schema-mismatch`, and the compatible-version-or-migrate hint.
4. Run the permission fixture; assert `fail`, reason `store-unreadable`, and the fix-permissions hint; assert the outcome is `fail` (not `unreachable`).
5. Run the undeclared-record-kind fixture; assert `fail`, reason `store-unknown`, and the declare-or-compatible-version hint.
6. Run the unreadable-beyond-classified fixture; assert `unreachable` with `doctor.check.state.unreachable` and a hint.
7. Negative controls: assert no state case triggers a write/repair; assert a failed store is never `ok`; assert the restored valid store reaches `ok`; assert the provider fold read is shared rather than duplicated (cross-reference TC-DOCTOR-025).

**Expected Outcome**:

- Every delivered store classification maps to its declared `ok`/`fail`/`unreachable` verdict with the correct delivered remediation hint; doctor never salvages, migrates, or repairs; verified-empty is a success.

#### TC-DOCTOR-012 - CI check: one bounded page, zero runs, credential/`httpStatus` 401-403/commit/transport/unattempted, failed runs neutral

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, DM-4, DM-5, DEC-11, NG-6, AC-F7-1, NFR-3, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-ci.test.ts`, `tests/fixtures/doctor/ci/**`
**Tags**: @backend

**Preconditions**:

- A resolvable binding, credential, and HEAD commit; a check-runs page with runs; a zero-run page; a page with failed runs; a missing-credential fixture; wiring-read rejection fixtures with `httpStatus: 401` and `httpStatus: 403`; any-other-non-2xx fixtures with `httpStatus: 404`, `httpStatus: 500`, and `httpStatus: 503`; a timeout fixture; a transport-failure fixture with `httpStatus` absent; an unresolved commit/detached-HEAD fixture; an unresolvable-binding fixture.
- A failure fixture whose prose detail conflicts with the structured status.
- A recording check-runs read that captures the commit SHA, limit, and pagination parameters.

**Steps**:

1. Run the success fixture; assert `ci` is `ok`, exactly one check-runs read occurred for the HEAD commit at the declared positive limit, no pagination beyond that limit, and no retry.
2. Run the zero-run fixture; assert `ci` is `ok` with `observed-empty` evidence and no fabricated pipeline.
3. Run the failed-runs fixture; assert the verdict remains `ok`, and failed-run facts appear only as bounded detail (no build-health verdict).
4. Run the missing-credential fixture; assert `ci` is `fail`, reason `credential-unavailable`, the classified `config.credential.missing` failure code is carried where the port supplies it, and the environment-variable hint is present.
5. Run the 401 and 403 fixtures; assert `ci` is `fail`, reason `credential-rejected`, with the same replace-or-broaden hint and reason as the tracker check (the one shared DEC-11 mechanism); assert the read was attempted exactly once.
6. Run the 404, 500, 503, timeout, and absent-`httpStatus` transport fixtures; assert `ci` is `unreachable` with `doctor.check.ci.unreachable`, reason `read-failed`, and a restore-reachability hint; assert one attempt and no retry.
7. Run the conflicting-prose fixtures; assert 401 + "server error" is still `fail`/`credential-rejected`; 500 + "unauthorized" is still `unreachable`/`read-failed`; absent status + "401 Unauthorized" is still `unreachable`/`read-failed` — prose is never parsed.
8. Run the unresolved-commit fixture; assert `ci` is `fail`, reason `commit-unresolved`, with a run-from-a-branch hint.
9. Run the unresolvable-binding fixture; assert the read was not attempted (call count `0`), `ci` is `unreachable` with `not-attempted`, and the hint directs to the repo finding.
10. Negative controls: assert no failed/unattempted case is `ok`; assert the failed-run fixture is not reported as a build failure; assert the success fixture restored after each failure reaches `ok`; assert an older failure shape without `httpStatus` is tolerated and remains unreachable.

**Expected Outcome**:

- CI wiring is proven by exactly one bounded check-runs read; zero runs are a success; failed runs never flip the verdict; structured 401/403 is `fail`/`credential-rejected` with the tracker's shared hint; every other non-2xx/timeout/transport failure with absent status is `unreachable`/`read-failed`; credential-port failure, unresolved commit, and unattempted reads map to their declared outcomes; prose is never parsed.

#### TC-DOCTOR-013 - Per-check isolation: throw/rejection/malformed result per area, sibling completion

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, DM-3, AC-F8-1, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-isolation.test.ts`, `tests/fixtures/doctor/isolation/cases.ts`
**Tags**: @backend

**Preconditions**:

- The all-ok fixture and a harness seam that can replace one check's execution with: (a) a thrown `Error`/non-Error value, (b) a rejected promise, (c) a malformed intermediate result (missing verdict, null, wrong-shape object, undefined detail).
- One case per area × failure shape = 15 cases; the other four checks have known expected verdicts.

**Steps**:

1. For each of the 15 cases run `doctor --json`; assert the affected check's verdict is `unreachable`, its evidence reason includes `check-unreachable`, and its detail is non-empty/bounded with a fix hint.
2. Assert the other four checks complete with their own expected verdicts and all five checks appear in the internal aggregation (five entries, fixed order).
3. Assert the command returns the `doctor.check.failed` error envelope, exit `1`, no crash, no stack trace, and the summary names the affected check.
4. Assert `error.code` is never `fallback.internal` and no platform-category identity appears in any of the 15 cases.
5. Assert the affected check's detail names the failed source/area and does not fabricate a success/zero claim.
6. Control: run the all-ok fixture through the same harness and assert five `ok` checks, proving the injection seam is live and the success path is not bypassed.
7. Meta-check: assert the case table covers all five areas × three shapes with no duplicate/missing id.

**Expected Outcome**:

- Every injected throw, rejection, or malformed result is contained as that check's `unreachable` verdict with `doctor.check.<area>.unreachable`, a bounded detail, and a hint; siblings complete; the run returns a full five-check outcome; nothing crashes or escapes as `fallback.internal`.

#### TC-DOCTOR-014 - Containment boundary: no `fallback.internal` inside checks; outside-check containment exit 2

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-9, AC-F8-2, AC-F9-3, NFR-2
**Test Type(s)**: Integration, Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-isolation.test.ts`, `tests/behaviour/doctor-outcome.test.ts`
**Tags**: @backend

**Preconditions**:

- The documented failure classes: tracker read failure, tracker 401/403 rejection, CI read failure, CI 401/403 rejection, missing credential, torn store, undeclared provider chain (`provider-chain-not-declared`), provider configuration-resolution failure (`config-invalid`), provider-branch validation failure (`provider-chain-unresolved`), unreadable provider fold (`state-unreadable`), contained throw.
- Outside-check failure seams: an unclassifiable shared-input composition failure (not a provider-configuration failure, which is check-level per DEC-12), aggregation, envelope assembly, and serialization.
- The classification chain and error table.

**Steps**:

1. For each documented failure class assert the resulting identity is the check verdict + reason (`fail`/`unreachable`), never `fallback.internal`; assert no class is "contained as fallback.internal".
2. For each injected in-check throw (TC-DOCTOR-013) assert the error identity on the failure envelope is `doctor.check.failed`, not `fallback.internal`.
3. Run the provider `config-invalid` and `provider-chain-unresolved` fixtures; assert they are provider-check `fail` evidence with the internal aggregation/human report containing five checks, never an outside-check composition failure, `fallback.internal`, exit `2`, or a command abort (DEC-12).
4. Inject an unclassifiable failure in shared-input composition before any check runs; assert `fallback.internal` (platform-provider) and exit `2`, no doctor report, no fabricated verdicts.
5. Inject a failure in aggregation/envelope assembly/serialization after checks complete; assert exit `2` via the existing chain and no partial report.
6. Structural assertion: doctor's domain/contracts modules do not import or declare `fallback.internal`; only the classification/projection modules use it.
7. Negative control: assert a documented class never renders as `fallback.internal` even when its source throws an unknown value (that is the check's `unreachable`, not the command's internal containment).
8. Assert zero check-internal failures escape their boundary across the isolation matrix.

**Expected Outcome**:

- `fallback.internal` and platform-category identities occur only outside per-check execution; every documented class is classified truthfully; provider configuration failures stay check-level `fail` and never abort the run; in-check failures become `doctor.check.<area>.unreachable`; zero escapes.

#### TC-DOCTOR-015 - Failure outcome: `doctor.check.failed`, exit 1, Appendix B summary grammar

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, DM-7, AC-F9-1, NFR-4
**Test Type(s)**: Integration, Contract, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-outcome.test.ts`, `tests/fixtures/doctor/outcomes/**`
**Tags**: @backend @golden

**Preconditions**:

- Failure fixtures with exactly 1, 2, and 5 non-ok checks, including the Appendix B shapes: `provider (fail)` alone; `repo (fail)` + `tracker (unreachable)`.
- The documented error-table row for `doctor.check.failed` and the Appendix B summary examples.
- `assertEnvelopeContract`.

**Steps**:

1. Run the 1/5 provider fixture; assert exit `1`, exactly one error envelope, `error.code === "doctor.check.failed"`, category `user`, retryable `false`, consequence `not_landed`, projection class `user-validation` (table metadata), and no `data`.
2. Assert `error.summary` is exactly `doctor check failures (1/5) — provider (fail): refresh the credential for provider-c, then run provider quota --provider provider-c` (the Appendix B example; the fixture's hint template must equal it).
3. Run the 2/5 repo+tracker fixture; assert the summary is exactly the Appendix B two-failure example with `repo (fail)` then `tracker (unreachable)` in fixed area order and the two hints separated by `; `.
4. Run the 5/5 fixture; assert `(5/5)` and all five areas in order with their verdicts/hints; assert non-failing checks never appear.
5. Assert newlines in any injected detail/hint are collapsed to spaces, the summary is one line, and no secret/remote canary appears.
6. Assert the failure envelope's `remediationHint` is the generic row hint ("resolve each named failing check using its fix hint, then re-run doctor"), not a per-check hint.
7. Negative controls: remove one failing check from the expected summary, reorder areas, leave a non-failing check in the summary, and inject a newline/secret; each mutation must fail; assert the success path never carries this error.

**Expected Outcome**:

- Any non-ok run returns exactly one `doctor.check.failed` error envelope, exit `1`, with the deterministic Appendix B summary naming every failing check in fixed area order and no non-failing check, secret, or remote prose.

**Notes / Clarifications**:

- The Appendix B examples are binding for the 1/5 and 2/5 shapes; other hint templates are catalog data (OQ-T6). If the delivered catalog wording differs, the documented example and the catalog must be reconciled deliberately.

#### TC-DOCTOR-016 - Success outcome and envelope exclusivity: all-ok data/exit 0; failure no data

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, DM-1, AC-F9-2, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-outcome.test.ts`
**Tags**: @backend

**Preconditions**:

- All-ok fixture, including variants where tracker returns an empty page, CI returns zero runs, state is verified-empty, and the provider fold is empty; each is a success.
- Mixed failure fixture; a fixed run id/clock.
- `assertEnvelopeContract`.

**Steps**:

1. Run each all-ok variant with `--json`; assert exit `0`, exactly one envelope, no `error`, `assertEnvelopeContract` returns `[]`, and the top-level key set is exactly `{schemaVersion, runId, exitCode, timing, data}`.
2. Assert `data` is the `delivery.doctor.v1` report with exactly five checks, the summary counts, the observed repository binding, and the injected `generatedAt`.
3. Run the mixed failure fixture; assert exit `1`, exactly one envelope, no `data`, and the top-level key set is exactly `{schemaVersion, runId, exitCode, timing, error}`.
4. Assert every outcome has exactly one of `data`/`error`, never both and never neither.
5. Assert a success envelope never carries `error` and a failure envelope never carries `data`, including when a check is `unreachable` rather than `fail`.
6. Negative controls (in-memory envelope mutation): add `data` to the failure, remove `error` from the failure, add an unknown top-level key, and set both `data` and `error`; each mutation must fail.
7. Assert the success data is identical in shape across the verified-empty/observed-empty variants (only facts/counts differ).

**Expected Outcome**:

- All-ok runs, including verified-empty and observed-empty variants, return one success envelope with the structured report and exit `0`; every non-ok run returns one error-only envelope with exit `1`; envelope exclusivity and the exact v1 key set hold.

#### TC-DOCTOR-017 - Unable-to-run and exit taxonomy: exit 2 through the projection, no overrides, `{0,1,2}` totality

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F8-2, AC-F9-3, NFR-4
**Test Type(s)**: Integration, Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-outcome.test.ts`, `tests/checks/exit-code-literals.test.ts`
**Tags**: @backend

**Preconditions**:

- Outside-check failure fixtures: an unclassifiable shared-input composition throw, aggregation throw, envelope assembly/serialization throw, and a platform-category classified failure outside checks.
- Provider `config-invalid` and `provider-chain-unresolved` fixtures to prove they stay check-level `fail` and never become an outside-check abort or exit `2` (DEC-12).
- The full outcome matrix (all-ok, 1/5, 5/5, isolation, outside-check failures).

**Steps**:

1. Run each outside-check containment fixture; assert `fallback.internal` or the platform-category identity, exit `2`, no `data`, and no fabricated doctor report or check verdicts.
2. Run the provider `config-invalid` and `provider-chain-unresolved` fixtures; assert `doctor.check.failed` with exit `1`, the internal aggregation/human report contain all five checks, and no outside-check `fallback.internal`/exit-2/command abort occurs (DEC-12; OQ-T5 closed).
3. Run the full outcome matrix and assert every exit is in `{0, 1, 2}`, with all-ok `0`, any non-ok `1`, and unable-to-run `2`.
4. Assert the exit is never chosen at the doctor call site: run the `exit-code-literals` check and a static scan asserting no integer exit literals or `process.exit` in doctor source; the projector module derives from the table.
5. Assert no failure envelope carries `data` in any exit-2 case and no report is fabricated from a partial aggregation.
6. Negative controls: inject a call-site exit override in a temp copy and assert the exit-literal/structure check fails; assert a platform failure is not projected to `1`; assert a provider configuration failure is not projected to `2`.

**Expected Outcome**:

- Doctor-unable-to-run projects exit `2` only through the existing classification chain for containment/platform failures; provider configuration failures are check-level `fail`/exit `1` and never abort; every exit is in `{0,1,2}` and no doctor call site overrides an exit.

#### TC-DOCTOR-018 - Machine output: one valid envelope every outcome, data ≤64 KiB, v1 key set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-1, DM-8, AC-F10-1, AC-F9-2, NFR-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-output.test.ts`, `tests/fixtures/doctor/bounds/**`
**Tags**: @backend

**Preconditions**:

- A cap-sized success fixture (five checks with maximal detail/evidence within the bounds); an under-cap fixture; an over-limit fixture that would exceed 64 KiB if unbounded.
- Failure fixtures for all non-ok outcomes.
- `assertEnvelopeContract`.

**Steps**:

1. For every fixture (all-ok, 1/5, 5/5, isolation, outside-check failure) run `--json`; assert stdout contains exactly one JSON document, `assertEnvelopeContract` returns `[]`, and stderr carries no second envelope.
2. Assert every failure envelope has no `data`; assert every success envelope's `data` has `schemaVersion: "delivery.doctor.v1"`.
3. Measure `Buffer.byteLength(JSON.stringify(envelope.data), "utf8")`; assert ≤65 536 for the under-cap and cap-sized fixtures; assert the over-limit fixture is bounded at or below 65 536 (deterministic clamping/omission) and the bound assertion is not skipped.
4. Assert the summary line and error object are within the same envelope and no raw provider payload, credential, or remote-controlled prose appears.
5. Negative controls: a report deliberately over 64 KiB must fail the bound test; a second JSON document on stdout must fail the single-envelope assertion; a success with an `error` key must fail.
6. Assert the exact top-level key set on success and failure (cross-reference TC-DOCTOR-016).

**Expected Outcome**:

- Every `--json` outcome emits exactly one valid `CommandResult` envelope; success data is the v1 report and ≤64 KiB; failure envelopes are data-free; over-limit and multi-envelope controls fail by name.

#### TC-DOCTOR-019 - Human report: fixed lines/hints, ≤24 lines/4096 bytes, zero extra reads, failure summary

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-8, AC-F10-1, NFR-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-output.test.ts`, `tests/fixtures/doctor/bounds/**`
**Tags**: @backend @cli

**Preconditions**:

- All-ok fixture; mixed failure fixture; cap-sized fixture with maximal detail/hints; a fixed synthetic brand and clock.
- A read-counter shared between the human and `--json` runs.

**Steps**:

1. Run human `doctor` on the all-ok fixture; assert one line per check in fixed order, each carrying area, verdict, and bounded detail; assert there are no hint lines (all ok).
2. Run human `doctor` on the mixed fixture; assert the five check lines plus exactly one indented hint line per non-ok check; assert the failure diagnostic additionally carries the deterministic failing-checks summary.
3. Assert the optional header uses the injected `brand.binaryName` and no product literal appears.
4. Assert line count ≤24 and byte count ≤4096 for the all-ok, mixed, and cap-sized fixtures; assert the cap-sized fixture still contains all five check lines and every non-ok hint line (no silent omission).
5. Assert the human output is derived from the same data as `--json`: run both modes with the same fixed inputs and assert the read-counter total is identical (zero extra reads) and the check areas/verdicts/details align.
6. Assert the handler returns data only and the edge invokes the command definition's `humanText` hook with the same report and injected brand; no handler-side rendering path exists.
7. Over-limit control: a fixture whose raw detail/hint inputs exceed the contract bounds must render a bounded report (clamped details/hints) at ≤24 lines/4096 bytes; an implementation that emits an unclamped line over the bound fails.
8. Assert no LLM call, remote prose, or secret appears; assert the human report never invents a check or verdict.

**Expected Outcome**:

- Human mode renders a deterministic five-line check report plus one indented hint per non-ok check, bounded at 24 lines/4096 bytes, from the same data with zero extra reads, using the injected brand; failure mode adds the summary.

#### TC-DOCTOR-020 - Error-table evolution: doctor kind + one row, documented row, two-way sync corpora

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, NFR-9
**Test Type(s)**: Structure, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/fixtures/result/code-corpora/**`
**Tags**: @backend

**Preconditions**:

- A baseline snapshot of the pre-change `DOMAIN_KINDS`, `ERROR_TABLE` rows, and the documented table in `doc/spec/features/feature-result-contract.md`.
- The new row data: `doctor.check.failed`, kind `doctor`, category `user`, retryable `false`, consequence `not_landed`, projection `user-validation`, generic remediation hint, non-identifying default summary.
- The mutation harness that copies the table/doc/corpora into a temp root.

**Steps**:

1. Assert `DOMAIN_KINDS` contains `doctor` exactly once and no other new kind exists; assert `ERROR_TABLE` contains exactly one row with `domainKind: "doctor"` and that its fields equal the pinned values.
2. Assert every pre-change row and kind is byte-for-byte unchanged (baseline comparison), and `fallback` remains the reserved two-segment namespace.
3. Assert the documented table in `feature-result-contract.md` contains exactly one matching `doctor.check.failed` row with the same fields, and the sync check reports zero failures.
4. Extend the true-positive corpus with `doctor.check.failed` (`recognized: true`, `resolves: true`); assert the false-positive corpus does not recognize a doctor-like non-code; run the sync check and assert both corpus directions pass.
5. Mutation controls in a temp copy: remove the table row, change one field, remove the documented row, add an undocumented doctor row, add a second doctor row, and change an existing row; each must make the sync/structure check fail by name.
6. Assert the unmutated control is green in the same suite; assert classification of a `doctor` failure selects the row and `doctor.check.failed` resolves.
7. Assert no doctor check-level cause is promoted to an error identity.

**Expected Outcome**:

- `DOMAIN_KINDS` gains `doctor`; exactly one additive row with the pinned fields exists in the machine and documented tables; both sync directions and the corpora cover it; no existing row changes; check-level causes remain evidence, not identities.

#### TC-DOCTOR-021 - Contract vocabulary and constants: areas/verdicts/sources/reasons/bounds/catalog bound to spec

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-2, DM-3, DM-5, DM-6, DM-7, DM-8, AC-F2-1, AC-F2-2, NFR-1
**Test Type(s)**: Structure, Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/doctor-contract.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend

**Preconditions**:

- The doctor contract module(s) under `packages/core/src/contracts/**` and the doctor domain aggregator.
- The spec's Appendix A/B and DM-3/DM-4/DM-5/DM-6/DM-8 tables as the expected source, including the v1.1 structural `httpStatus`/`failureClass` evidence rules and the delivered provider-chain reason spellings.

**Steps**:

1. Assert the area constant/order is exactly `["repo","tracker","provider","state","ci"]`; the verdict set is exactly `["ok","fail","unreachable"]`; the outcome set is exactly `["read","observed-empty","failed","not-configured"]`.
2. Assert the source-id set is exactly the eleven DM-5 ids and each area maps to its declared source subset.
3. Assert the reason set is exactly the twenty-two DM-6 values in declared order, including `config-invalid`, `state-unreadable`, `provider-chain-not-declared`, and `provider-chain-unresolved`; assert no extra/missing/renamed reason; assert the old draft spellings (`chain-not-declared`, `chain-unresolved`) are absent; assert the renderer/aggregator never emits a reason outside the set.
4. Assert the doctor bounds constants are the declared values: detail/hint 200, machine 65 536, human 24 lines/4096 bytes, evidence 4 sources/4 reasons, and a positive declared per-source read limit for each network read.
5. Assert the schema version is exactly `"delivery.doctor.v1"` and the summary grammar/prefix constants match DM-7.
6. Assert the condition catalog has exactly one entry per declared condition, each with a verdict mapping and a non-empty, action-first hint template (not a bare code/identifier); assert no condition maps to two verdicts; assert the catalog includes `config-invalid`/`provider-chain-unresolved` as provider `fail` conditions and `reevaluation-cap` as a wiring-neutral condition.
7. Assert the evidence model type permits optional `failureClass` (adapter-local, never an identity) and optional numeric `httpStatus`; assert `failureCode` remains restricted to existing `config.*`/`state.*` codes; assert `credential-rejected` is derived only from 401/403.
8. Assert doctor does not import `STATUS_*` constants or share a caps module (DEC-10); the constants are doctor-scoped.
9. Mutation controls in memory/temp: add/remove/reorder a verdict, source, reason, or bound, add a condition without a hint, and add an old chain spelling; each must fail; the unmutated control is green.

**Expected Outcome**:

- The doctor vocabulary, order, source mapping, twenty-two-value reason set, evidence model, bounds, schema version, summary grammar, and condition catalog are single-home contract data bound to spec v1.1; every mutation and stale spelling is caught.

#### TC-DOCTOR-022 - Tier, purity, imports, inventory, no new locations/keys/record kinds

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, NFR-10
**Test Type(s)**: Structure, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/doctor-imports.test.ts`, `tests/structure/{subpaths,content-inventory,cli-edge-seam}.test.ts`, `tests/boundaries/**`
**Tags**: @backend

**Preconditions**:

- The new doctor contract/domain/command files and `tests/structure/inventory.json`.
- The existing status-imports detector pattern, dependency-cruiser rules, ambient guard, and entrypoint check.

**Steps**:

1. Assert doctor contract module(s) are data-only (type aliases, interfaces, `as const` data, imports/exports; no executable statements, no I/O, clock, random, or ambient access).
2. Assert the doctor domain imports only `#contracts`/core contracts and other core domain modules; it imports no adapter, CLI, `node:`, `bun:`, filesystem, network, process, clock, or randomness API.
3. Assert runtime I/O for doctor exists only in admitted adapter subpaths and the CLI edge; no new runtime-API location, package, subpath, configuration key, or state record kind is introduced.
4. Assert `inventory.json` lists every new doctor source file and no stale entry; assert the content-inventory test passes.
5. Assert the CLI edge composes the doctor command over injected dependencies and the handler remains in the command tier; assert no boundary rule exemption was added.
6. Assert `bun test tests/boundaries` and `bun run scripts/checks/{ambient-globals,workspace-entrypoints}.ts` pass; assert the fixture-coverage meta-check still covers every rule.
7. Mutation controls: seed an adapter import in domain, a `node:` import in contracts, an unlisted file, and a new subpath/entrypoint; each must fail the relevant detector; the unmutated control is green.

**Expected Outcome**:

- Contracts are data-only, the domain is pure and imports contracts only, runtime I/O stays in admitted adapters/CLI edge, the inventory is complete, and no new package/subpath/runtime location/config key/state record kind exists.

#### TC-DOCTOR-023 - Privacy, secret, forbidden-literal, and redaction canaries

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, NFR-10
**Test Type(s)**: Integration, Structure, Security
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/{secret-read-boundary,forbidden-literals}.test.ts`, `tests/structure/doctor-imports.test.ts`, `tests/behaviour/doctor-output.test.ts`
**Tags**: @backend @security

**Preconditions**:

- Planted secret canaries in: the credential value, provider park evidence, persisted announcement payload, state payload, tracker/CI response body, and remote detail.
- The `SECRET_READ_ALLOWLIST` baseline (exactly four entries, one credential-material), the forbidden-literal registry, and the redaction chokepoint.
- Doctor fixtures that reach success, fail, unreachable, and outside-check containment.

**Steps**:

1. Assert `SECRET_READ_ALLOWLIST` is still exactly four entries with one credential-material entry, and no doctor file appears in it.
2. Assert doctor source reads no ambient environment and adds no secret-read pattern; run the secret-read boundary check and assert zero doctor violations.
3. Run every fixture with planted canaries; assert no canary appears in stdout, stderr, envelope `data`/`error`, evidence, detail, hint, summary, or human report.
4. Assert hints/details/evidence are built from the closed condition catalog with safe identifier substitution only; inject a remote-controlled string into a payload and assert it is not interpolated into any output.
5. Run the forbidden-literal check; assert no product/binary literal appears in doctor source or user-facing docs (the brand name is injected at runtime).
6. Assert the serialization redaction chokepoint covers the envelope, failure summary, and human diagnostics; seed a secret in a detail field and assert the redaction/check catches it (non-vacuous control).
7. Assert no raw provider payload, repository file content, or credential material is carried in evidence.

**Expected Outcome**:

- Doctor adds no secret-read allowlist entry, reads no ambient environment, and leaks no planted secret or remote-controlled prose into any output surface; the allowlist remains four entries and all privacy/literal gates are green.

#### TC-DOCTOR-024 - Hermetic default suite: zero live network/credentials/spawns

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-7, F-12, AC-F12-2, DEC-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-network-posture.test.ts`, `tests/behaviour/doctor-command.test.ts`
**Tags**: @backend

**Preconditions**:

- A transport guard that throws on any unfixtured URL or non-`GET` method; a credential port stub with no live material; a spawn sentinel; an environment guard that fails on `$HOME`/real state/ambient reads where purity is asserted.
- The full doctor suite run in default `bun test` (no live switch).

**Steps**:

1. Run the doctor behaviour suites with the transport guard installed; assert zero live network calls and zero unfixtured URLs.
2. Assert the credential port stub returns only injected presence facts; no test reads a live token or environment variable.
3. Assert the spawn sentinel is never invoked across the suite; no child process is created.
4. Assert the suite passes with the transport guard refusing every non-fixture call (offline-equivalent execution) and with a minimal environment; assert no test depends on `$HOME`, the real state directory, or the wall clock.
5. Non-vacuity control: deliberately call the transport guard with a live URL and the spawn sentinel; each must throw, proving the guards are live.
6. Assert the default suite does not require an opt-in live switch and no live smoke is part of `pnpm check`.

**Expected Outcome**:

- The doctor default suite is hermetic: fixture-driven, zero live network calls, zero live credentials, zero process spawns, and no ambient dependency; the guards are proven live by deliberate controls.

#### TC-DOCTOR-025 - Network posture and shared-source read budget: ≤2 single-page reads, no pagination/retries, read once

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-7, F-12, DM-5, DM-8, AC-F4-1, AC-F7-1, AC-F12-2, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-network-posture.test.ts`, counting transport/readers
**Tags**: @backend

**Preconditions**:

- Counting readers for: repository binding, tracker list, CI check-runs, credential resolution, provider config, provider ledger, and verified state reads.
- Fixtures: both reads reached; binding unresolvable (zero network reads); tracker failure with CI success; CI failure with tracker success; tracker/CI 401/403 and 404/500/503/timeout/absent-`httpStatus` rejection fixtures.
- A transport log recording URL, method, limit, and any pagination/cursor parameter.

**Steps**:

1. Run the both-reads fixture; assert exactly one tracker list read and exactly one check-runs read (two network reads total), each with the declared positive limit, a single page, no cursor/page token, and no retry.
2. Assert the tracker read uses the resolved binding target and the CI read uses the current HEAD commit; assert no independent binding/credential resolution per check.
3. Assert the repository binding and provider configuration are each read once and shared across checks; assert the provider ledger and the verified state verification share one store read/reuse plan so the same store is not read once per check, and assert zero duplicated shared store reads.
4. Run the binding-unresolvable fixture; assert zero network reads (both reads unattempted) and the repo/provider/state local checks still run.
5. Run the tracker-failure/CI-success and CI-failure/tracker-success fixtures; assert each read is attempted exactly once and no retry loop occurs.
6. Run the tracker/CI 401/403 and 404/500/503/timeout/absent-`httpStatus` fixtures; assert both checks use the same 401/403 → `credential-rejected`/`fail` mechanism and the same 404/500/503/timeout/absent → `read-failed`/`unreachable` mechanism, with no prose parsing and no additional reads.
7. Assert repo, provider, and state perform zero network reads; assert the total is never more than two.
8. Negative controls: a fixture that triggers pagination or a retry must fail the posture assertion; a fixture that resolves the binding twice must fail the read-once assertion; a classification driven by prose instead of `httpStatus` must fail.

**Expected Outcome**:

- Doctor performs at most two bounded single-page reads (one tracker, one CI), never paginates or retries, resolves shared sources once, uses the one shared structured 401/403 credential-rejection mechanism across tracker and CI, and performs zero network reads when the binding is unresolved; repo/provider/state stay local.

#### TC-DOCTOR-026 - Text bounds and evidence caps: 200 chars, 4 sources, 4 reasons, failureCode discipline

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-2, DM-4, DM-8, AC-F10-1, NFR-8
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-output.test.ts`, `tests/fixtures/doctor/bounds/**`
**Tags**: @backend

**Preconditions**:

- Injected details/hints at 199, 200, and 201 characters (and a multi-byte/Unicode case); source/reason lists at 4 and 5 entries; duplicate reasons; a provider check with its four declared sources.
- A fixture with a classified `config.*`/`state.*` failure that supplies a `failureCode`; a fixture with an adapter-local `failureClass` (`provider.payload.invalid`); fixtures with structured `httpStatus` 401, 403, 500, 503, and absent.

**Steps**:

1. Assert a 199/200-character detail/hint is preserved; assert a 201-character input is deterministically bounded to 200 (or rejected/truncated by contract) without splitting a multi-byte UTF-8 sequence.
2. Assert every check's evidence has at most four sources and four unique reasons; assert a fifth source/reason is dropped deterministically or impossible by construction; assert duplicate reasons are deduplicated and ordered by first occurrence.
3. Assert the provider check's four sources and the tracker/CI source subsets match DM-5 exactly; assert no source id outside the closed set.
4. Assert `failureCode` is present only for a classified `config.*`/`state.*` failure and is one of the existing table codes; assert an adapter-local code (`provider.payload.invalid` or similar) is never used as `failureCode` or identity.
5. Assert `failureClass` may carry the adapter-local payload identity but is never an identity, and `httpStatus` is an optional numeric structured status: 401/403 → `credential-rejected`, 404/500/503 → `read-failed`/unreachable, absent → tolerated; assert neither field carries prose and neither is parsed for classification.
6. Assert no raw payload, credential, or remote-controlled prose appears in detail/evidence; assert the serialized report remains ≤64 KiB at the cap-sized fixture (cross-reference TC-DOCTOR-018).
7. Negative controls: inject a 201-character unbounded detail, a fifth reason, a duplicate reason, an adapter-local `failureCode`, a prose-valued `httpStatus`, and a `failureClass` promoted to identity; each must fail the bound/discipline assertion; the under-cap control passes.

**Expected Outcome**:

- Detail/hint text is bounded at 200 characters, evidence is capped at four sources/four reasons with deterministic dedupe/order, `failureCode` stays within existing `config.*`/`state.*` codes, `failureClass`/`httpStatus` remain structured data (never identities or prose), and no raw or adapter-local identity leaks into evidence.

#### TC-DOCTOR-027 - Golden outputs: Appendix B summaries, success report, human report, changed-fact control

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-10, DM-7, AC-F9-1, AC-F10-1, NFR-6, NFR-8
**Test Type(s)**: Golden, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/doctor-output.test.ts`, `tests/fixtures/doctor/golden/**`
**Tags**: @backend @golden

**Preconditions**:

- Fixed run id (`run-doctor-fixture`), fixed clock (`2026-11-18T10:20:00Z`), synthetic brand.
- Committed goldens: success machine envelope, success human report, 1/5 provider summary text (Appendix B example), 2/5 repo+tracker summary text (Appendix B example), and a mixed failure human report.
- A changed-fact control that mutates one check detail/verdict.

**Steps**:

1. Run `--json doctor` on the all-ok fixture; assert stdout equals the committed success golden byte-for-byte; assert the golden data is ≤64 KiB and has five checks.
2. Run human `doctor` on the all-ok fixture; assert stdout equals the committed human golden byte-for-byte; assert ≤24 lines/4096 bytes.
3. Run the 1/5 provider fixture; assert `error.summary` equals the committed Appendix B summary exactly.
4. Run the 2/5 repo+tracker fixture; assert `error.summary` equals the committed Appendix B summary exactly.
5. Run the mixed failure human fixture; assert the golden contains the five check lines, the non-ok hint lines, and the deterministic summary.
6. Changed-fact control: mutate one fixture fact and assert byte equality breaks (golden is live); assert the goldens are read-only and no test regenerates them implicitly.
7. Assert every golden passes `assertEnvelopeContract` where it is an envelope, and no secret/canary appears.

**Expected Outcome**:

- The success machine/human outputs and the Appendix B 1/5 and 2/5 summaries are pinned byte-for-byte at fixed inputs; a changed fact breaks the golden, proving the goldens are live and deterministic.

#### TC-DOCTOR-028 - Documentation reconciliation: man-page grammar, feature spec, registry/glossary/index

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-11, AC-F11-1, NFR-9, §7.1, §8.5
**Test Type(s)**: Manual, Structure
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/milestones/m1/man-page.md`, `doc/spec/features/**`, `doc/00-index.md`, glossary, command registry
**Tags**: @docs

**Preconditions**:

- The committed man page, command registry, new doctor feature spec, result-contract doc, glossary, and index.
- The doc-distribution marker rules and `scripts/.tests/test-doc-distribution.sh`.

**Steps**:

1. Assert the man-page `doctor` row/synopsis is exactly `<binary> doctor [--json]` and contains no `--fix-hints`; assert no doctor-specific flag is documented.
2. Assert the planning-pack `commands/doctor.md` synopsis matches the delivered grammar and no stale `--fix-hints` remains.
3. Assert the new current-truth doctor feature spec exists and is registered in the required index/scan; assert the result-contract feature doc contains the new `doctor.check.failed` row and describes the new kind; assert the provider client seeds / GitHub read-slice doc records the additive optional `httpStatus` field and the one new trap-catalog entry.
4. Assert the command registry row wording matches "diagnoses and prescribes" and the five areas; assert the glossary/index entries exist.
5. Assert one minor changeset is recorded for the affected workspace packages (lockstep versioning) and no package manifest gains a new subpath/export for doctor.
6. Assert the new feature spec declares `ados_distribution: internal` (or the honest classification for `doc/spec/features/**`) and that no redistributable guide/template changed; if one did, run `bash scripts/.tests/test-doc-distribution.sh` and assert it passes with the marker present.
7. Run `git diff --check`, YAML parse for changed YAML, and a link/path review for changed docs; assert no broken relative links.
8. Negative control: re-adding `--fix-hints` to a temp copy of the man page must fail the grammar check.

**Expected Outcome**:

- The man page, command registry, feature spec, result-contract doc, glossary, and index are reconciled with the delivered grammar and row; the stale `--fix-hints` drift is gone; doc-distribution rules are respected or the guard is run when applicable.

**Notes / Clarifications**:

- This TC records an in-change documentation obligation that has no dedicated AC; it is traced to F-1/F-11 and §8.5. The spec's in-scope list explicitly includes the man-page reconciliation.

#### TC-DOCTOR-029 - Performance and cost: pure aggregation ≤50 ms, one config resolve, no retry loops

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-7, F-12
**Test Type(s)**: Performance, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-performance.test.ts`, cap-sized matrix fixture
**Tags**: @backend @perf

**Preconditions**:

- A cap-sized five-check report (maximal details, evidence, hints within bounds); a warm-up run.
- A counting config resolver and a counting provider-ledger/state read; the environment recorded.

**Steps**:

1. Warm up the pure aggregator, then measure at least 20 runs and take the median; assert ≤50 ms on the reference environment and record the measurement environment/tolerance.
2. Assert the config resolver is called at most once per run; assert the provider ledger/state reads are shared and not multiplied by checks.
3. Assert no retry loop or unbounded iteration: the transport call count is bounded by two, the aggregation is linear over five checks, and a 100-run replay completes without growth.
4. Assert the performance assertion does not weaken the correctness assertions (a slow run still passes correctness; a correctness mutation still fails).
5. Negative control: a deliberately duplicated-read/retry implementation in a temp copy must fail the read-count/no-retry assertion, and a correctness mutation must still fail the correctness assertions.

**Expected Outcome**:

- The pure aggregation over the capped report is ≤50 ms (median) on the reference environment, with one config resolve, shared reads, at most two network attempts, and no retry/unbounded loop; the measurement environment is recorded and the bound is not silently relaxed.

#### TC-DOCTOR-030 - Evidence discipline: DM-5 sources, DM-6 reasons, no adapter-local identity/class promotion

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-4, DM-5, DM-6, AC-F2-1, AC-F2-2, AC-F12-1, NFR-3
**Test Type(s)**: Unit, Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-report.test.ts`, `tests/structure/doctor-imports.test.ts`
**Tags**: @backend

**Preconditions**:

- Fixtures covering every check's declared source subset, a classified `config.*` failure, a classified `state.*` failure, an adapter-local failure class (`provider.payload.invalid` or a transport class), structured `httpStatus` 401/403/500/503/absent, and an injected unknown detail string.
- The closed DM-5 source set, the twenty-two-value DM-6 reason set, and the existing `config.*`/`state.*` code list.

**Steps**:

1. For each check assert `evidence.sources` is exactly the DM-5 subset (no extra source id, no missing required source when the check attempted it) and each outcome is from `read`/`observed-empty`/`failed`/`not-configured`.
2. Assert every reason is from DM-6, unique, ordered by first occurrence, and ≤4; assert the reason semantics match the verdict (for example `check-unreachable` only for contained execution; `park-active` only for a wiring-neutral park; `config-invalid`/`provider-chain-unresolved` only for the provider config failures; `state-unreadable` for the provider fold failure).
3. Run the classified config/state failure fixtures; assert `failureCode` is the existing `config.*`/`state.*` code and the identity is the containing doctor error, not the code; assert `config-invalid` carries the classified resolver code and `provider-chain-unresolved` carries `config.value.invalid`.
4. Run the adapter-local class fixture; assert `provider.payload.invalid` (or equivalent) is never promoted to `failureCode`, `error.code`, or a new table row; assert it may appear only as `failureClass`/bounded reason evidence.
5. Assert `httpStatus` is optional and numeric; 401/403 yield reason `credential-rejected`; 404/500/503/absent remain `read-failed`; assert no prose detail is copied or parsed, and no credential material/remote content appears.
6. Assert the old draft reason spellings (`chain-not-declared`, `chain-unresolved`) are never emitted.
7. Negative controls: inject an invented reason, an old reason spelling, an extra source, a duplicate reason, an adapter-local `failureCode`, a prose `httpStatus`, and a `failureClass` promoted to identity; each must fail; the valid control is green.

**Expected Outcome**:

- Every check's evidence uses exactly its declared sources, closed outcomes, and the twenty-two closed reasons in deterministic order; classified failures carry only existing `config.*`/`state.*` codes; `failureClass`/`httpStatus` remain structured data, with 401/403 the only credential-rejection source and prose never parsed; adapter-local classes never become identities; no raw or remote-controlled content leaks.

#### TC-DOCTOR-031 - Additive `httpStatus` read-result field and GitHub trap-catalog coverage

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-7, F-12, DM-4, DEC-11, AC-F4-1, AC-F7-1, AC-F12-1, NFR-3, NFR-10
**Test Type(s)**: Unit, Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-github-http-status.test.ts`, `tests/behaviour/providers/github-collection.test.ts`, `tests/behaviour/providers/trap-harness.ts`, `tests/structure/trap-catalog.test.ts`, `tests/fixtures/providers/traps/github.traps.json`
**Tags**: @backend

**Preconditions**:

- The shared adapter-local payload-failure type and the GitHub read slice (list/check-runs `get` path).
- Response fixtures: 401, 403, 404, 500, 503, a timeout, a transport failure, and an older failure shape with `httpStatus` absent.
- The existing four-field GitHub trap catalog and its bidirectional coverage harness; one new trap entry and fixture assertion are expected in the same change.

**Steps**:

1. Assert the payload-failure type declares an optional numeric `httpStatus`; existing failure shapes without the field remain assignable and every existing consumer narrows unchanged; `provider.payload.invalid` remains the only payload-failure identity and the field introduces no new error-table/domain identity (the separate doctor row is covered by TC-DOCTOR-020).
2. Drive the GitHub read slice with 401 and 403 responses; assert the failure carries `httpStatus: 401`/`403`, is secret-free (no headers, body, credential, or prose copied), and remains `provider.payload.invalid` as its identity.
3. Drive it with 500 and 503; assert the structured status is carried; drive it with 404; assert `provider.not-found` remains the identity and the structured `httpStatus: 404` is carried; drive a timeout and a transport failure; assert `provider.payload.invalid` with no fabricated status and that an absent `httpStatus` is tolerated.
4. Feed the 401/403 facts to the tracker and CI checks; assert both classify `fail`/`credential-rejected` with the shared replace-or-broaden hint; feed 404/500/503/timeout/absent facts; assert both classify `unreachable`/`read-failed`; assert no prose detail is parsed (401 + "server error" stays fail; 500 + "unauthorized" stays unreachable).
5. Assert the trap catalog gains exactly one new GitHub entry with the four-field shape and a fixture assertion; run bidirectional coverage and assert the entry is covered; remove the entry or its fixture in a temp copy and assert coverage fails by name; assert the closed operation set, capability declaration, and read count are unchanged.
6. Run the error-table sync and structure checks; assert the `httpStatus` enrichment introduces no second/extra error-table row, kind, or identity beyond the already-covered `doctor` row (TC-DOCTOR-020), and `provider.payload.invalid` remains the only payload-failure identity; assert the unmutated catalog/control is green.
7. Negative controls: a failure shape with `httpStatus: "401"` (string/prose) must be rejected or treated as absent (never credential-rejected); a `httpStatus: 200` on a failure shape must not classify as a successful read; a `failureClass` promoted to an identity must fail.

**Expected Outcome**:

- The additive optional `httpStatus` is structured, secret-free, present on non-2xx where supplied, and tolerated when absent; tracker and CI share the 401/403 → `credential-rejected` and every-other-failure → `read-failed` mechanism without prose parsing; exactly one GitHub trap-catalog entry and fixture assertion land in-change with bidirectional coverage; `provider.payload.invalid` remains the only adapter identity and no additional error-table row is added for the field.

### 5.3 Seed Scenario Reconciliation

The M1 seed (`doc/planning/oss-tooling/milestones/m1/test-scenarios.md`) contains no doctor-scoped `SC-M1-*` scenario: its coverage map lists M1-S4, S9, S13–S18, S21–S23 and the cross-cutting SC-M1-19, and its coverage rule says unlisted stories (including S3) inherit the pattern at test-plan time with story-local TC ids. The remaining seed scenarios cover those listed stories and are out of scope for this change. The doctor-relevant seed material is therefore the cross-cutting SC-M1-19 plus the pack's proposed `doctor` contract prose/examples. The spec is binding where they disagree.

| Seed item | Source | Disposition | TC ID(s) | Reconciliation note |
|---|---|---|---|---|
| SC-M1-19 — valid envelope on failure; malformed input → error (code/category/retryable/consequence/remediationHint), projected exit; JSON parses, schemaVersion present, secrets absent | `test-scenarios.md` §D (cross-cutting) | Inherited and specialized | TC-DOCTOR-001, TC-DOCTOR-015, TC-DOCTOR-016, TC-DOCTOR-018, TC-DOCTOR-023 | The spec refines doctor-specific malformed input to command grammar only (`fallback.invocation`, exit `1`, no read); check failures use `doctor.check.failed`/exit `1`; unable-to-run uses the existing projection/exit `2`; the v1 key set and secret absence are asserted by the outcome/output/privacy TCs. |
| "Each failing check names its fix hint; doctor exits 1 with classified errors, never crashes" | `contracts.md` §doctor | Inherited and reconciled | TC-DOCTOR-003, TC-DOCTOR-013, TC-DOCTOR-014, TC-DOCTOR-015 | The binary `ok/failing` wording is refined by the spec into the closed `ok/fail/unreachable` vocabulary; every non-ok (fail or unreachable) carries a hint and drives exit `1`; containment guarantees the never-crash clause. |
| Session F transcript: `repo ok base=main-tools clean=true`; `tracker ok Jira reachable auth ok projects mapped`; `provider FAIL provider-c token expired`; `state ok all stores validate (4/4)`; `ci ok 3 platforms reachable last probe 8s ago`; `exit_code=1` | `interactions.md` Session F | Reconciled; illustrative details superseded | TC-DOCTOR-006, TC-DOCTOR-007, TC-DOCTOR-008, TC-DOCTOR-011, TC-DOCTOR-012 | v1 evaluates no base branch (DEC-8/OQ-1); the tracker check is the GitHub single-page read, not "Jira projects mapped"; "token expired" is recorded park/credential evidence or a structured 401/403 wiring-read rejection (DEC-11), never a live probe; the CI check is one check-runs read for HEAD, not "3 platforms / last probe"; the state check reads delivered stores; the exit-1 shape is preserved. |
| `doctor.md` OUTPUT: text check lines `ok/FAIL` with hints; envelope `data.checks[]` (area, verdict, detail, fixHint) | `commands/doctor.md` | Reconciled | TC-DOCTOR-003, TC-DOCTOR-019 | The delivered vocabulary has three verdicts, evidence, and a hint iff non-ok; the human report is one line per check plus one indented hint per non-ok. |
| `doctor.md` envelope example: `schemaVersion: 1`, `data.checks[]` on an exit-1 run, no repository/summary | `commands/doctor.md` | Rejected by the spec; spec wins | TC-DOCTOR-016, TC-DOCTOR-018 | The pinned schema is `delivery.doctor.v1`; failure envelopes carry no `data`; success data includes the repository binding and summary; the example is illustrative draft material, not a contract. |
| `doctor.md` EXIT STATUS: `0 all ok; 1 at least one failing check with hint; 2 doctor itself unable to run (classified)` | `commands/doctor.md` | Inherited unchanged | TC-DOCTOR-015, TC-DOCTOR-016, TC-DOCTOR-017 | The exit taxonomy is preserved; the spec pins the identity (`doctor.check.failed`) and the projection route (existing chain) and forbids overrides. |
| Man page: `<binary> doctor [--fix-hints]` | `man-page.md` | Reconciled; flag removed | TC-DOCTOR-001, TC-DOCTOR-028 | The spec removes `--fix-hints`; hints are unconditional; unknown flags including `--fix-hints` are parser-rejected; the man page is corrected in-change. |
| `contracts.md` binary `ok/failing` vocabulary | `contracts.md` §doctor | Reconciled | TC-DOCTOR-021 | The delivered vocabulary is the closed three-value `ok/fail/unreachable`; both non-ok values are failing for exit purposes. |
| Missing doctor `SC-M1` scenario (M1-S3 absent from the coverage map) | `test-scenarios.md` coverage map | Recorded seed gap; story-local TCs created | All TC-DOCTOR-001..031 | Per the seed's own coverage rule, M1-S3 inherits the pattern at test-plan time with story-local TC ids. No seed scenario is silently dropped; the pack's doctor prose/examples are reconciled above. This is reported as OQ-T8. |

Spec v1.1's refinements (structured `httpStatus` 401/403, the shared tracker/CI credential-rejection mechanism, `reevaluation-cap` wiring-neutrality, the tolerant provider-configuration read, and the reason/evidence-model spellings) are spec-level clarifications of the same pack surface; they change no seed disposition above. The seed-gap disposition and all eight mapped items remain as recorded.

**Disposition counts:** 9 doctor-relevant seed items reviewed (1 cross-cutting `SC-M1` scenario + 8 pack contract artifacts/omissions). 8 are mapped to TC ids (7 reconciled or superseded by the binding spec, 1 inherited unchanged); 1 is recorded as a seed gap (no doctor-scoped `SC-M1` scenario) and covered by story-local TCs. 0 seed items are silently ignored.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager` | All doctor suites are hermetic and in-process |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; existing `ts-*` jobs | Authoritative for structure, checks, boundary, golden, and aggregate gates |
| Temp fixture roots | `mkdtemp` under the OS temp directory | State, repo, and mutation fixtures never write the live tree |
| In-process test process | Bun runtime; injected brand, clock, run id, credential port, readers, state, transport, streams | No child processes for any doctor suite; fixed output facts for byte assertions |
| Documentation check | `git diff --check`, YAML parse, link review, doc-distribution guard when a redistributable doc changes | The pack and feature spec are internal; no live opt-in smoke is planned for v1 (OQ-2 deferred) |

### 6.2 Test Data

| Data | Source / shape | Lifecycle |
|------|----------------|-----------|
| Matrix fixtures | `tests/fixtures/doctor/matrix/**`: one case per Appendix A condition plus precedence cases | Read-only; builder asserts each intended fact |
| Negative-control cases | `tests/fixtures/doctor/negative-controls/cases.ts`: the eight AC-F2-3 controls plus restored controls | Read-only case definitions |
| Isolation cases | `tests/fixtures/doctor/isolation/cases.ts`: five areas × three failure shapes plus the all-ok control | Read-only; injection seams in memory |
| Repository fixtures | `tests/fixtures/doctor/repo/**` URL strings and temp git-shaped `.git/config`/`HEAD` directories | Read-only URL strings; temp dirs for the adapter read |
| Tracker/CI fixtures | `tests/fixtures/doctor/{tracker,ci}/**`, `tests/fixtures/doctor/http-status/**` (401/403/404/500/503/timeout/absent + conflicting prose), and reused `tests/fixtures/providers/github/**` | Read-only normalized facts |
| Provider fixtures | `tests/fixtures/doctor/provider/*.json` config snapshots, including `config-invalid` and `provider-chain-unresolved` reads; verified park/announcement ledgers built with `tests/fixtures/state/harness.ts` for `peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, `reevaluation-cap`, and credential causes | Read-only config; temp verified ledgers |
| GitHub trap catalog | `tests/fixtures/providers/traps/github.traps.json` with exactly one new entry and its fixture assertion; the existing bidirectional coverage harness | Read-only at test time; deletion/mutation controls on temp copies |
| State fixtures | Reused `tests/fixtures/state/harness.ts`: valid, verified-empty, torn, schema-mismatch, permission, unknown-kind, unreadable | Temp roots; never the real state directory |
| Bounds fixtures | `tests/fixtures/doctor/bounds/{under-cap,at-cap,over-cap,cap-sized}/**` | Read-only; over-limit/clamp controls |
| Golden fixtures | `tests/fixtures/doctor/golden/{success.json,success-human.txt,summary-1-of-5.txt,summary-2-of-5.txt,mixed-human.txt}` at fixed run id/clock/brand | Read-only; changed-fact control |
| Error table | `ERROR_TABLE`, `DOMAIN_KINDS`, the documented table in `doc/spec/features/feature-result-contract.md`, and `tests/fixtures/result/code-corpora/**` | Read-only at test time; drift fails sync; mutation copies only |
| Baseline oracles | Pre-change error rows/kinds, the Appendix A cells, DM-6 reasons, DM-5 sources, and DM-8 bounds held in test files | Read-only; the only permitted change is the additive doctor surface |

### 6.3 Isolation Strategy

- Every synthetic fixture and mutation test uses a fresh `mkdtemp` root; no test writes the live repository tree, `dist/`, the real local state directory, or the user's real config.
- Doctor suites inject brand, paths, clock, run id, repository facts, credential port, provider config/ledger, state store, transport, and streams; they never read `$HOME`, the wall clock, the ambient environment where purity is asserted, or the network.
- The real `origin`/HEAD is read only by explicit repository-adapter tests over temp git-shaped dirs; the default behaviour suite uses injected facts.
- State fixtures are built from verified bytes with the state harness and mutated by a named operation; a detection-disabled control must expose the planted value, proving the fixture is live.
- Golden and corpus fixtures are read-only at test time; corruption/mutation controls run on in-memory values or temp copies, and the unmutated control runs in the same suite.
- Error-table/doc/corpora baselines are read-only; mutations run on temp copies and fail closed by name.

## 7. Automation Plan and Implementation Mapping

All 31 TCs are automated except TC-DOCTOR-028, which is semi-automated (structural assertions plus a manual documentation/link review). Locations follow the spec's affected-components table and the repository testing strategy; delivery planning may rename helper files but must preserve each TC's behaviour, verdicts, reasons, bounds, assertions, and AC/NFR mapping.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-DOCTOR-001 | `tests/behaviour/doctor-command.test.ts` + `tests/fixtures/doctor/harness.ts` | `bun test tests/behaviour/doctor-command.test.ts` | parser rejection (extra positional, `--fix-hints`, unknown flag), zero-read recorder, write-free handler, valid control | To Implement |
| TC-DOCTOR-002 | `tests/behaviour/doctor-readonly-determinism.test.ts` + state harness + `guardStore` | `bun test tests/behaviour/doctor-readonly-determinism.test.ts` | guarded store, transport method/URL, spawn sentinel, byte replay, seeded-write/spawn controls | To Implement |
| TC-DOCTOR-003 | `tests/behaviour/doctor-report.test.ts` + matrix fixtures | `bun test tests/behaviour/doctor-report.test.ts` | five-check shape, verdict/detail/evidence/hint, summary; drop/duplicate/swap/empty/hint mutations | To Implement |
| TC-DOCTOR-004 | same + `tests/fixtures/doctor/matrix/**` | same | one case per Appendix A condition + precedence + `httpStatus` 401/403/500/absent; flipped-verdict/invented-reason/old-spelling controls | To Implement |
| TC-DOCTOR-005 | `tests/behaviour/doctor-negative-controls.test.ts` + cases | `bun test tests/behaviour/doctor-negative-controls.test.ts` | eight AC-F2-3 controls + four supplementary auth/config controls + restored controls; case-table meta-check | To Implement |
| TC-DOCTOR-006 | `tests/behaviour/doctor-repo.test.ts` + repo fixtures | `bun test tests/behaviour/doctor-repo.test.ts` | clean/dirty/origin/unreadable/linked worktree; zero-network and no-base controls | To Implement |
| TC-DOCTOR-007 | `tests/behaviour/doctor-tracker.test.ts` + tracker/http-status fixtures | `bun test tests/behaviour/doctor-tracker.test.ts` | success/empty/credential/401-403/500-503/absent/transport/unattempted; conflicting-prose controls; one-read/no-retry | To Implement |
| TC-DOCTOR-008 | `tests/behaviour/doctor-provider.test.ts` + provider fixtures/state harness | `bun test tests/behaviour/doctor-provider.test.ts` | valid chain/empty fold; five wiring-neutral parks incl `reevaluation-cap`; announcements; credential park; ordering | To Implement |
| TC-DOCTOR-009 | same | same | tolerant `config-invalid`/`provider-chain-unresolved`; no/invalid chain; unresolvable/disabled credential; unreadable fold; old-spelling controls | To Implement |
| TC-DOCTOR-010 | same + `doctor-readonly-determinism.test.ts` | corresponding `bun test` | counting quota/engine/write/eval stubs; deliberate-call control | To Implement |
| TC-DOCTOR-011 | `tests/behaviour/doctor-state.test.ts` + state harness | `bun test tests/behaviour/doctor-state.test.ts` | verified/empty/torn/schema/permission/unknown/unreadable; no-repair and restored controls | To Implement |
| TC-DOCTOR-012 | `tests/behaviour/doctor-ci.test.ts` + CI/http-status fixtures | `bun test tests/behaviour/doctor-ci.test.ts` | runs/zero runs/failed runs/credential/401-403/500-503/absent/commit/unattempted; shared-mechanism and prose controls | To Implement |
| TC-DOCTOR-013 | `tests/behaviour/doctor-isolation.test.ts` + isolation cases | `bun test tests/behaviour/doctor-isolation.test.ts` | 15 injections (5 areas × 3 shapes) + all-ok control; sibling/aggregation/no-fallback assertions | To Implement |
| TC-DOCTOR-014 | same + `doctor-outcome.test.ts` | corresponding `bun test` | documented classes vs fallback; provider config stays in-check; outside-check composition/aggregation/serialization failures; structural scan | To Implement |
| TC-DOCTOR-015 | `tests/behaviour/doctor-outcome.test.ts` + outcome fixtures | `bun test tests/behaviour/doctor-outcome.test.ts` | 1/5, 2/5, 5/5 summaries; newline/secret/reorder/extra-check controls; generic remediation | To Implement |
| TC-DOCTOR-016 | same | same | all-ok variants incl empty/zero/verified-empty; mixed failure; data+error exclusivity mutations | To Implement |
| TC-DOCTOR-017 | same + `tests/checks/exit-code-literals.test.ts` | corresponding `bun test` | outside-check containment/platform failures; provider config stays check-level; exit matrix; no call-site override | To Implement |
| TC-DOCTOR-018 | `tests/behaviour/doctor-output.test.ts` + bounds fixtures | `bun test tests/behaviour/doctor-output.test.ts` | one envelope; 64 KiB under/at/over; multi-envelope/data-on-failure controls | To Implement |
| TC-DOCTOR-019 | same + human fixtures | same | five lines/hints; 24/4096 bounds; zero extra reads; cap-sized no-omission; over-limit control | To Implement |
| TC-DOCTOR-020 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, corpora | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts`; `bun test tests/structure/error-table.test.ts` | one doctor row/kind; doc row; corpora both directions; remove/change/duplicate/undocumented controls | To Implement (existing suites extended) |
| TC-DOCTOR-021 | `tests/structure/doctor-contract.test.ts`, `tests/structure/inventory.json` | `bun test tests/structure/doctor-contract.test.ts` | 22 reasons incl delivered spellings; `failureClass`/`httpStatus`; areas/verdicts/sources/bounds/schema/catalog; in-memory mutation controls | To Implement |
| TC-DOCTOR-022 | `tests/structure/doctor-imports.test.ts`, `subpaths`, `content-inventory`, `cli-edge-seam`, `tests/boundaries` | corresponding `bun test` / `bun run scripts/checks/*.ts` | contracts data-only, domain purity, I/O confinement, inventory, seeded violations | To Implement (new suite) + Existing – Update |
| TC-DOCTOR-023 | `tests/checks/{secret-read-boundary,forbidden-literals}.test.ts`, `doctor-imports`, `doctor-output` | corresponding `bun test` | allowlist four; no doctor entry; planted canaries on every surface; redaction control | Existing – Update + To Implement |
| TC-DOCTOR-024 | `tests/behaviour/doctor-network-posture.test.ts` + guards | `bun test tests/behaviour/doctor-network-posture.test.ts` | transport guard, credential stub, spawn sentinel, offline run; deliberate-call controls | To Implement |
| TC-DOCTOR-025 | same + counting readers | same | two reads/one page/no pagination/no retries; shared 401/403 and 500/absent mechanisms; read-once; pagination/retry/prose controls | To Implement |
| TC-DOCTOR-026 | `tests/behaviour/doctor-output.test.ts` + bounds fixtures | `bun test tests/behaviour/doctor-output.test.ts` | 199/200/201 chars; 4/5 sources/reasons; `failureCode`/`failureClass`/`httpStatus` discipline; prose/identity controls | To Implement |
| TC-DOCTOR-027 | `tests/golden/doctor-output.test.ts` + golden fixtures | `bun test tests/golden/doctor-output.test.ts` | byte goldens; Appendix B 1/5 and 2/5; changed-fact control; read-only goldens | To Implement |
| TC-DOCTOR-028 | man page, feature spec, provider client seeds, registry/glossary/index | `git diff --check`; YAML/link review; `bash scripts/.tests/test-doc-distribution.sh` when applicable | re-added `--fix-hints` control; additive-field/trap-entry doc; marker/link checks | To Implement |
| TC-DOCTOR-029 | `tests/behaviour/doctor-performance.test.ts` + cap-sized fixture | `bun test tests/behaviour/doctor-performance.test.ts` | median ≤50 ms; one config resolve; read counts; duplicated-read/retry control | To Implement |
| TC-DOCTOR-030 | `tests/behaviour/doctor-report.test.ts`, `doctor-imports` | corresponding `bun test` | DM-5 sources/22 DM-6 reasons; `failureCode`/`failureClass`/`httpStatus`; invented/old-spelling/extra controls | To Implement |
| TC-DOCTOR-031 | `tests/behaviour/doctor-github-http-status.test.ts`, `tests/behaviour/providers/github-collection.test.ts`, `tests/structure/trap-catalog.test.ts`, `tests/fixtures/providers/traps/github.traps.json` | `bun test tests/behaviour/doctor-github-http-status.test.ts`; `bun test tests/structure/trap-catalog.test.ts` | 401/403/404/500/503/timeout/absent/transport; conflicting-prose controls; one trap entry + fixture; bidirectional coverage/deletion control | To Implement |

**Execution order.**

1. Contracts, vocabulary, error-table, and boundary baselines: TC-DOCTOR-021, TC-DOCTOR-020, TC-DOCTOR-022, TC-DOCTOR-023, TC-DOCTOR-030.
2. Additive read-result surface and trap catalog: TC-DOCTOR-031.
3. Command surface, report totality, and matrix: TC-DOCTOR-001, TC-DOCTOR-003, TC-DOCTOR-004.
4. Per-check behaviour: TC-DOCTOR-006, TC-DOCTOR-007, TC-DOCTOR-008, TC-DOCTOR-009, TC-DOCTOR-010, TC-DOCTOR-011, TC-DOCTOR-012.
5. Isolation and containment: TC-DOCTOR-013, TC-DOCTOR-014.
6. Outcome, exit, and envelope: TC-DOCTOR-015, TC-DOCTOR-016, TC-DOCTOR-017.
7. Negative controls and network posture: TC-DOCTOR-005, TC-DOCTOR-024, TC-DOCTOR-025.
8. Output, bounds, and determinism: TC-DOCTOR-018, TC-DOCTOR-019, TC-DOCTOR-026, TC-DOCTOR-002.
9. Goldens and performance: TC-DOCTOR-027, TC-DOCTOR-029.
10. Documentation reconciliation: TC-DOCTOR-028.
11. Aggregate: `pnpm check`, `git diff --check`, `git status --porcelain`.

**Wiring.** The new behaviour suites are discovered by root `bun test`; no new CI job topology is introduced. The new structure suite is discovered by `bun test tests/structure`. The GitHub trap-catalog entry and fixture ride the existing provider client/trap-catalog suites; the error-table sync check stays in the existing invariants wiring. The boundary rules and the secret-read/forbidden-literal/exit-literal checks extend to the new modules automatically; no rule is added or weakened. Documentation reconciliation gates run in the delivery/phase-7 window.

**Evidence commands** (run and record in the change/PR; never record unrun results as passing):

```
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
pnpm check
git diff --check
git status --porcelain
```

**Open-PR DoD evidence checklist.** All 21 ACs have a passing traceable TC and all 10 NFRs are measured; the five checks and three verdicts are total with non-empty detail/evidence and a hint iff non-ok; the Appendix A matrix is exhaustive with precedence, `httpStatus` 401/403 vs 500/503/absent, and verified-empty/observed-empty controls; the eight AC-F2-3 controls plus four supplementary auth/config controls never yield `ok`; the 15-case isolation suite completes siblings and never uses `fallback.internal` inside a check; structured 401/403 is the only credential-rejection source and no prose is parsed; provider `config-invalid`/`provider-chain-unresolved` are check-level `fail` and never abort; `reevaluation-cap` is wiring-neutral; the additive optional `httpStatus` field and exactly one GitHub trap-catalog entry with fixture assertion land in-change; all-ok exits `0` with the v1 data report, any non-ok exits `1` with exactly `doctor.check.failed` and the Appendix B summary, unable-to-run exits `2` through the existing chain, and no override exists; provider quota/resolve/write/transport activity is zero; the 64 KiB / 24-line / 4096-byte / 200-char / 4-source / 4-reason bounds are live; the `doctor` kind + single row + documented row + corpora sync in both directions; tier/boundary/ambient/forbidden-literal/privacy/secret-read gates are green with no new location/key/schema/allowlist/product literal/error identity; the default suite has zero live network/credentials/spawns and at most two single-page reads with no pagination/retries; the man page, provider client seeds, and feature/result-contract docs are reconciled; a minor changeset is recorded; an open unmerged PR targets `main-tools`. No merge or owner acceptance is claimed by this plan.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

**Specification risk coverage (RSK-1..RSK-10).** Every spec risk is exercised by at least one TC; the mapping is the forward trace from the spec.

| Spec risk | Mitigating TC(s) |
|-----------|------------------|
| RSK-1 — failed/absent/unattempted read reported as ok (false all-clear) | TC-DOCTOR-003, TC-DOCTOR-004, TC-DOCTOR-005, TC-DOCTOR-030 |
| RSK-2 — doctor burns quota through the provider check | TC-DOCTOR-008, TC-DOCTOR-010 |
| RSK-3 — hints/details leak secrets or remote-controlled text | TC-DOCTOR-018, TC-DOCTOR-019, TC-DOCTOR-023, TC-DOCTOR-026, TC-DOCTOR-031 |
| RSK-4 — containment masks a real defect as a vague unreachable | TC-DOCTOR-013, TC-DOCTOR-014 |
| RSK-5 — exit-code confusion between check failure (1) and unable-to-run (2) | TC-DOCTOR-015, TC-DOCTOR-016, TC-DOCTOR-017, TC-DOCTOR-027 |
| RSK-6 — doctor findings drift from other surfaces' refusals | TC-DOCTOR-006, TC-DOCTOR-009, TC-DOCTOR-028 |
| RSK-7 — network reads make doctor slow or flaky | TC-DOCTOR-024, TC-DOCTOR-025, TC-DOCTOR-029 |
| RSK-8 — routine parks (incl `reevaluation-cap`) train operators to ignore exit 1 | TC-DOCTOR-008, TC-DOCTOR-015 |
| RSK-9 — new error rows/docs drift from the machine table | TC-DOCTOR-020, TC-DOCTOR-028 |
| RSK-10 — scope creep into repair/extra areas | §1.2 non-goals; TC-DOCTOR-010, TC-DOCTOR-022, TC-DOCTOR-028 |

**Testing risks.**

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A negative fixture is inert, so a false all-clear passes | H | M | Every negative/matrix/isolation case asserts the exact verdict, reason set, detail/hint, and exit, with a restored or all-ok control (§4.2) |
| RSK-T2 | A "not ok" assertion is vacuous because the run failed elsewhere | H | M | One oracle per cell asserts verdict + reasons + sources + detail/hint + summary + error identity + no data; siblings are asserted in the isolation suite |
| RSK-T3 | The isolation seam never fires, hiding an aborted sibling | H | M | Each injection is paired with an all-ok control through the same harness; the case table is meta-checked; a recorder that never observes the injected check fails |
| RSK-T4 | The quota/engine zero-call proof is vacuous | H | L | Every counting stub is proven live by a deliberate call in the control (TC-010) |
| RSK-T5 | Provider park fixtures do not exercise the real verified fold | H | M | Parks/announcements are built from verified bytes with the state harness; a detection-disabled control exposes the planted value (TC-008/009) |
| RSK-T6 | Bounds are asserted by sampling and miss an over-limit case | M | M | Under/at/over-cap fixtures for 64 KiB, 24 lines/4096 bytes, 200 chars, and 4 sources/reasons run together (TC-018/019/026) |
| RSK-T7 | The additive `httpStatus` is dropped, mis-typed, or bypassed and credential rejection is inferred from prose | H | M | DEC-11 pins the structured 401/403 mechanism; TC-007/012/031 pair 401/403 against 404/500/503/timeout/absent with conflicting prose, assert 401/403 is the only fail source, and assert the field/trap entry in-change |
| RSK-T8 | The performance assertion is flaky on slow CI | M | M | Measure only the pure aggregator with warm-up/median, record the environment, and never silently relax the 50 ms bound (OQ-T9) |
| RSK-T9 | The seed's missing doctor scenario leaves a coverage hole | M | L | §5.3 records every seed disposition; story-local TCs cover all ACs; OQ-T8 tracks the seed gap |
| RSK-T10 | Doc-distribution markers drift because the pack/spec are internal | M | L | TC-028 checks the marker/guard only when a redistributable doc changes; the new feature spec uses the honest internal classification |
| RSK-T11 | The GitHub trap catalog gains the `httpStatus` entry without bidirectional coverage or a fixture assertion, or the additive field silently promotes a new identity | M | L | TC-031 asserts exactly one four-field entry + fixture, bidirectional coverage, deletion-by-name failure, `provider.payload.invalid` as the only identity, and no new error row |

### 8.2 Assumptions

- **A-T1 — Spec binding.** The spec is the single source of truth for areas/order, verdicts, sources, reasons, bounds, schema version, identity, and summary grammar. Delivery planning may choose helper/file names but may not rebind a pinned value.
- **A-T2 — In-process harness.** Every doctor behaviour test uses `runCli` with injected dependencies and readers; no doctor suite spawns a child process or reads the ambient environment/network in default CI.
- **A-T3 — Plan mapping.** GAP-1: the implementation plan does not exist yet; it must map all 31 TCs onto its phases and must not reshape them. Any later plan or implementation that alters a TC's behaviour/verdicts/reasons/bounds/AC mapping reopens this test plan.
- **A-T4 — Delivery-bound spellings.** Contract export names, runtime type names, helper names, exact non-Appendix-B hint wording, human line labels, and fixture file names are delivery-bound (GAP-8). The vocabulary, order, sources, reasons (including the delivered `provider-chain-*` spellings), bounds, schema version, identity, and summary grammar are pinned.
- **A-T5 — Machine failure path (OQ-T1 closed).** Spec v1.1 F-8/F-9 confirms: the internal aggregation always has five checks, the human failure report renders all five lines, and the machine failure envelope is error-only and carries the failing-check summary. Tests assert that reading; no data-bearing failure envelope exists.
- **A-T6 — Auth signal (OQ-T3/OQ-T10 closed).** Spec v1.1 DEC-11: the shared adapter-local payload failure carries an optional structured `httpStatus` supplied by the GitHub read slice; tracker and CI classify 401/403 as `credential-rejected`/fail and every other non-2xx/transport/absent status as `read-failed`/unreachable. Tests inject the field and never parse prose.
- **A-T7 — Read limits.** Per OQ-T4/GAP-5, the numeric per-read limit is delivery-bound contract data; the tests assert a declared positive integer, one page, and no pagination/retries, not a specific number.
- **A-T11 — Tolerant provider configuration (OQ-T2/OQ-T5 closed).** Spec v1.1 DEC-12 removes the ambiguous "unreadable at check scope" condition: `config-invalid` (with the classified `config.*` code) and `provider-chain-unresolved` (with `config.value.invalid`) are provider-check `fail` evidence; all five checks report and the command never aborts. Tests assert this and do not treat a provider configuration failure as an outside-check composition failure.
- **A-T12 — `reevaluation-cap` (OQ-T11 closed).** Spec v1.1 DEC-6/AC-F5-1 pins `reevaluation-cap` as a wiring-neutral loop-cap park; tests assert it stays `ok` with cause/expiry and the quota directive.
- **A-T8 — Hermetic default.** No live smoke is planned for v1 (OQ-2 deferred); the default suite is fixture-driven, and any future opt-in live smoke is outside `pnpm check`/default CI and structural only.
- **A-T9 — Documentation marker.** No redistributable doc is intended to change; the pack is internal and the new feature spec is `internal`. If a redistributable guide/template changes, the distribution guard must pass.
- **A-T10 — Seed status.** The M1 seed has no doctor-scoped SC-M1 scenario; §5.3 records the cross-cutting SC-M1-19 and the pack artifacts as the inherited seed. This is a recorded gap, not a silent omission.

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | On a non-ok run, what exactly is the "full five-check report" given that failure envelopes carry no `data`? | Spec v1.1 F-8/F-9 confirm the reading: internal aggregation = five checks; human failure = five lines + hints; machine failure = error-only + failing-check summary. | **Closed — spec v1.1 F-8/F-9 confirm the plan's reading** | @spec-writer |
| OQ-T2 | What input represents "provider configuration branch unreadable at check scope"? | Spec v1.1 DEC-12 removes the condition; `config-invalid` (classified `config.*` code) and `provider-chain-unresolved` (`config.value.invalid`) are provider-check `fail` evidence, never an abort. | **Closed — spec v1.1 DEC-12** | @spec-writer |
| OQ-T3 | How does the tracker/CI check distinguish an authentication rejection (`fail`, `credential-rejected`) from a transport/server failure (`unreachable`, `read-failed`)? | Spec v1.1 DEC-11 adds the optional structured `httpStatus` to the adapter payload failure; 401/403 is the only credential-rejection source; every other non-2xx/transport/absent status stays unreachable; prose is never parsed. | **Closed — spec v1.1 DEC-11** | @plan-writer / @coder |
| OQ-T4 | What are the exact numeric per-source read limits doctor declares for the tracker list and check-runs reads? | GAP-5/DM-8. The spec still requires declared limits without numeric values. The plan asserts a positive declared constant, one page, no pagination/retries. | Open — non-blocking; delivery-bound | @plan-writer |
| OQ-T5 | Does a non-platform classified failure outside per-check execution project exit `1` rather than `2`? | Spec v1.1 DEC-12 moves the provider configuration failure into the provider check as `fail`; the old outside-check `config.value.invalid` example is removed. No user-category outside-check path is pinned for doctor. | **Closed — spec v1.1 DEC-12; old example removed** | @spec-writer |
| OQ-T6 | Which hint-template strings beyond the two Appendix B examples are binding, and where is the canonical catalog? | Spec v1.1 adds the `config-invalid`/`provider-chain-unresolved` conditions and `reevaluation-cap` to the catalog, but does not enumerate every template string. Appendix B goldens remain binding; other templates remain contract data. | Open — non-blocking, narrowed by v1.1 catalog additions | @plan-writer / @coder |
| OQ-T7 | Does any changed doc trigger the doc-distribution marker guard, and what is the correct `ados_distribution` value for the new feature spec? | GAP-7. The pack is internal; `doc/spec/features/**` is outside the guard and uses `internal` honestly. If a redistributable doc changes, the guard must run. | Open — non-blocking; verify at delivery | @doc-syncer |
| OQ-T8 | Should the M1 seed gain a doctor-scoped `SC-M1` scenario/coverage-map row? | GAP-2. The seed's coverage map omits S3 and its rule says unlisted stories get story-local TCs. This plan records the disposition; a future seed update could add the row. | Open — non-blocking; seed maintenance | @pm / @doc-syncer |
| OQ-T9 | What CI tolerance applies to the 50 ms pure-aggregation measurement? | NFR-7/RSK-T8. The plan measures the pure aggregator with warm-up/median and records the environment; the spec bound is not silently relaxed. | Open — non-blocking | @plan-writer |
| OQ-T10 | Does an authentication rejection on the CI check-runs read map to `fail` (`credential-rejected`) or to `unreachable` (`read-failed`)? | Spec v1.1 aligns the `ci` row and AC-F7-1 with the tracker's one shared 401/403 mechanism; every other non-2xx/transport/absent status is unreachable. | **Closed — spec v1.1 Appendix A/AC-F7-1** | @spec-writer |
| OQ-T11 | What is the provider verdict for an active `reevaluation-cap` park? | Spec v1.1 DEC-6/AC-F5-1 pins the delivered `reevaluation-cap` spelling as a self-expiring loop-cap pause, wiring-neutral like the other capacity/environment parks. | **Closed — spec v1.1 DEC-6/AC-F5-1** | @spec-writer |

**Recorded gaps and dispositions (spec v1.1):**

1. **Implementation-plan mapping** — GAP-1/A-T3; the plan does not exist yet and must map all 31 TCs without reshaping them. **Open (delivery-planning dependency), not a spec gap.**
2. **Seed has no doctor SC-M1 scenario** — GAP-2/A-T10/OQ-T8; §5.3 dispositions all doctor-relevant seed material and records the gap. **Open (seed maintenance), not a spec contradiction.**
3. **Full report vs envelope exclusivity** — GAP-3/A-T5/OQ-T1; spec v1.1 F-8/F-9 confirm the plan's reading. **Closed.**
4. **Auth-rejection signal** — GAP-4/A-T6/OQ-T3; spec v1.1 DEC-11 supplies the structured `httpStatus`; the plan asserts 401/403 only and never prose. **Closed.**
5. **Numeric read limits** — GAP-5/A-T7/OQ-T4; tests assert a declared positive limit, one page, no pagination/retries. **Open, delivery-bound; no spec contradiction.**
6. **Hint catalog beyond Appendix B** — GAP-6/A-T4/OQ-T6; v1.1 pins the new conditions and spellings; Appendix B goldens are binding; other templates remain delivery-bound catalog data. **Open, narrowed; no contradiction.**
7. **Doc-distribution marker** — GAP-7/A-T9/OQ-T7; no redistributable doc is intended to change; the guard runs if one does. **Open, delivery-verification; no contradiction.**
8. **Delivery-bound spellings** — GAP-8/A-T4; only the pinned vocabulary/order/reasons/bounds/grammar are asserted. **Open, delivery-bound; no contradiction.**
9. **Performance tolerance** — OQ-T9; median measurement with recorded environment, 50 ms bound not relaxed. **Open, CI tolerance; no contradiction.**
10. **CI authentication rejection** — OQ-T10; spec v1.1 aligns the CI row and AC-F7-1 with the shared 401/403 mechanism. **Closed.**
11. **`reevaluation-cap` park disposition** — OQ-T11; spec v1.1 DEC-6/AC-F5-1 pins it wiring-neutral. **Closed.**

No AC and no NFR is left without a TC. No plan gap remains that contradicts spec v1.1; the remaining open items are delivery-bound details or recorded seed/plan-maintenance gaps, not behavioral conflicts.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-06T04:55:00Z | Change Test Plan Writer | Initial plan: 30 TCs (TC-DOCTOR-001..030). All 21 ACs (AC-F1-1..AC-F12-2), all 10 NFRs, all 8 DMs, and all 10 spec risks mapped; five-check totality and the Appendix A matrix cell by cell with within-check precedence; the eight AC-F2-3 negative controls; the 15-case per-check isolation suite with sibling completion and no in-check `fallback.internal`; the verify-change outcome model (all-ok data/exit 0, any non-ok `doctor.check.failed`/exit 1, unable-to-run projection/exit 2, no overrides); provider quota safety; the 64 KiB/24-line/4096-byte/200-char/4-source/4-reason bounds; the additive doctor error row and two-way sync corpora; tier/purity/boundary/ambient/forbidden-literal/privacy/secret-read gates; network posture and shared read-once; golden Appendix B summaries; documentation reconciliation; performance. The M1 seed was reconciled in §5.3 (no doctor-scoped SC-M1 scenario; SC-M1-19 plus eight pack artifacts/omissions dispositioned; seed gap recorded). Eleven recorded gaps/open questions (implementation plan absent, seed gap, full report vs envelope exclusivity, tracker auth-rejection signal, numeric read limits, hint catalog, doc-distribution marker, delivery-bound spellings, timing tolerance, CI authentication rejection, `reevaluation-cap` park disposition); no coverage silently weakened. |
| 1.1 | 2026-11-06T06:20:00Z | Change Test Plan Writer | Reconciliation with spec v1.1. **TC-DOCTOR-031 added** (31 TCs total): additive optional structured `httpStatus` on the adapter payload failure, 401/403 vs 500/503/timeout/absent/transport classification, no prose parsing, exactly one GitHub trap-catalog entry + fixture with bidirectional coverage, `provider.payload.invalid` as the only identity, no new error row. **TC-DOCTOR-004/005/007/012/025** updated to the shared tracker/CI 401/403 mechanism, supplementary auth/config controls, conflicting-prose negatives, and the 404/500/503/timeout/absent unreachable path. **TC-DOCTOR-008** extended with `reevaluation-cap` (wiring-neutral). **TC-DOCTOR-009** replaced the ambiguous unreadable-config condition with the two tolerant provider-config read failures (`config-invalid` + `config.*`, `provider-chain-unresolved` + `config.value.invalid`) as check-level fail evidence; **TC-DOCTOR-014/017** updated so provider config failures never abort or project exit 2. **TC-DOCTOR-021/026/030** updated to the 22-value DM-6 set (`config-invalid`, `state-unreadable`, delivered `provider-chain-*` spellings), the DM-4 `failureClass`/`httpStatus` rules, and stale-spelling negatives. **TC-DOCTOR-028** updated for the additive read-result/trap documentation. §1.2 GAP-3/GAP-4 marked resolved; GAP-5..GAP-8 re-verified; §5.3 seed dispositions re-checked (unchanged, v1.1 refinements noted); AC coverage still 21/21; all OQ-T entries dispositioned (OQ-T1/T2/T3/T5/T10/T11 closed; OQ-T4/T6/T7/T8/T9 open and delivery-bound/seed-maintenance, none contradicting v1.1). |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds or tests and implemented no code. The executor records per-TC evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
