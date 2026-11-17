---
id: chg-GH-335-test-plan
status: Proposed
created: 2026-11-17T00:00:00Z
last_updated: 2026-11-17T00:00:00Z
owners: [engineering]
service: "delivery-os harness plane (harness port, opencode adapter, version gate, profile propagation, telemetry extraction)"
labels: [m3, harness, opencode, telemetry, version-gate, conformance, decision-record]
version_impact: minor
summary: "Traceable verification of M3-S1 opencode v2.x harness and telemetry: a supported-version window (2.2.x plus 2.1.x, pinned as data) evaluated once per dispatch before any session exists, refusing out-of-window versions with `harness.version.unsupported` at exit 1 and undeterminable or unparseable versions with the distinct `harness.version.unknown` while the observed version stays the explicit unknown and the delivered `version-probe-failed` warning is preserved; exactly one declared integration mode for dispatch that never falls back at runtime, refuses any other requested mode with `harness.mode.unavailable`, expresses the mode on the harness configuration branch with a `defaults` origin when omitted, refuses an unknown value instead of defaulting, and is governed by an in-change decision record; per-spawn propagation of the resolved per-seat model record map into the spawn descriptor where a record value beats a conflicting ambient parent value, undeclared record names change nothing and never widen the deny-by-default allowlist, an inexpressible required seat refuses with `harness.profile.model-unrepresentable` before any session exists, and the identical contract drives deliver and resume; resume and attach continuing one session identity with the tree root preserved; per-seat telemetry rows inside the unchanged `delivery.harness.telemetry.v1` identity carrying seat identity, the resolved model beside the never-overwritten harness-reported model with divergence disclosed by a closed-vocabulary warning, the five token classes, calls, cost that is null and never zero when missing, and durations that are explicitly absent with a warning and never derived from the capture timestamp; `harness.telemetry.absent` at exit 1 with no zero-valued row kept distinct from the delivered `harness.telemetry.extraction-failed`; the conformance registry gaining the version-window, unknown-version, mode-unavailable and profile-propagation scenarios while the delivered six-scenario classification floor stays unchanged; and refusal hygiene — a closed identity with a stable code, exit projection and non-empty remediation hint, and no session-bearing side effect — proven for every new identity. Every acceptance criterion maps to at least one automated case; the plan runs offline against simulated harness I/O and fixture stores with zero live harness invocations, credentials or network, and carries a refusal/oracle matrix, a version verdict matrix, a telemetry field matrix, a conformance scenario matrix, a binding fixture contract, and a mutant non-vacuity contract."
links:
  change_spec: ./chg-GH-335-spec.md
  implementation_plan: ./chg-GH-335-plan.yaml   # authored in phase 4; not yet present (GAP-1)
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M3-S1: opencode v2.x harness and telemetry

## 1. Scope and Objectives

This change makes a dispatch either run on a compatible harness with the resolved profile or refuse with a typed, actionable identity. Four properties are load-bearing and each is tested independently so weakening one cannot hide behind another.

**First, the version gate must decide before a session exists, and it must be honest about what it knows.** The supported window ships as data (`2.2.x` plus `2.1.x` at intake, pinned from the observed `v2.2.5`), is evaluated once per dispatch at harness resolution, and carries one verdict on the instance every consumer reads (AC-F1-1). A version outside the window refuses with `harness.version.unsupported` at exit 1 and starts no session (AC-F1-2, the pinned blueprint scenario TC-M3-HARNESS-002). A version that cannot be probed or parsed refuses with the distinct `harness.version.unknown`, keeps `observedVersion === null`, and never fabricates a version or passes silently (AC-F1-3, DEC-3). The delivered `version-probe-failed` warning keeps its meaning beside the refusal. An absent or unusable window setting degrades to the pinned default and never widens acceptance (AC-F1-4).

**Second, the mode is declared, not inferred, and the profile is propagated, not hoped for.** Exactly one integration mode is the delivered default; a dispatch never falls back between modes (AC-F2-1); any other requested mode refuses with `harness.mode.unavailable` naming both values before any spawn (AC-F2-3); the mode lives on the harness configuration branch with a `defaults` origin when omitted and a refusal — never a silent default — for an unknown value (AC-F2-4); and a decision record states the chosen mode among the three declared modes, with the read-only direct-store rationale, and is linked from the change and the harness feature spec (AC-F2-2). Per spawn, the resolved per-seat model record map reaches the spawn descriptor, a record value beats a conflicting ambient parent value, undeclared record names change nothing, and an inexpressible required seat refuses with `harness.profile.model-unrepresentable` before any session exists (AC-F3-1..AC-F3-4). The identical contract drives deliver, resume and attach, which continue one session identity with the tree root preserved (AC-F4-1).

**Third, telemetry must attribute without fabricating or double counting.** Every landed row keeps the schema identity `delivery.harness.telemetry.v1` and stamps the harness kind and version, the seat identity, the resolved seat model beside the harness-reported model, the five token classes, calls, cost (null when missing), and durations (AC-F5-1). Pre-change rows stay readable and unchanged with additions only (AC-F5-2, DEC-4). A resolved-versus-reported divergence keeps both values and discloses itself with a closed-vocabulary warning, never reconciling by overwrite (AC-F5-3, DEC-5). A duration the store does not expose is explicitly absent with a warning and is never derived from the capture timestamp (AC-F5-4). Seat attribution is an added dimension, not a second reading basis, so session totals stay single-counted (RSK-7). Absence stays `harness.telemetry.absent` at exit 1 with no zero-valued row, and an unreadable store keeps the delivered `harness.telemetry.extraction-failed` and is never re-projected as absence (AC-F6-1, AC-F6-2).

**Fourth, conformance and refusal hygiene must make regression visible, and the whole battery must stay offline.** The registry keeps exactly the two shipped harnesses and their six-scenario classification floor (AC-F7-1), gains the version-window, unknown-version, mode-unavailable and profile-propagation scenarios as data on the same registry, and fails a harness or an identity that is missing one while naming both (AC-F7-2). It runs with zero live harness invocations (AC-F7-3). Every refusal carries a closed identity with a stable code, a projection-derived exit and a non-empty remediation hint, and leaves no session-bearing side effect (AC-N1-1). Every new test runs offline against simulated harness I/O and fixture stores with no network, no credentials and no live harness store (NFR-10).

This is a design and verification map, not an execution claim: no suites were run while authoring it.

### 1.1 In Scope

- Supported-version window as data: the pinned `2.2.x` + `2.1.x` default, the evaluation verdict (inside, outside, indeterminate) carried on the instance, and the one-evaluation-per-dispatch rule (F-1, DM-1, DM-2, AC-F1-1, AC-F1-4).
- Out-of-window refusal `harness.version.unsupported` at exit 1 with remediation naming the supported lines and zero spawned sessions (F-1, AC-F1-2, NFR-1, pinned TC-M3-HARNESS-002).
- Indeterminate refusal `harness.version.unknown` as a distinct identity, explicit-unknown observation, preserved `version-probe-failed` warning, and zero fabrication (F-1, AC-F1-3, NFR-6, DEC-3).
- Version-probe bound: one bounded shell-free invocation per dispatch within 5 s, no retry loop, failure distinguishable from out-of-window (NFR-2, RSK-8).
- Integration-mode declaration: exactly one delivered default, no runtime fallback, `defaults` origin when omitted, refusal for an unknown configured value, and the closed requested-mode vocabulary (F-2, DM-3, AC-F2-1, AC-F2-4, DEC-2).
- `harness.mode.unavailable` refusal naming the requested and available mode before any spawn (F-2, AC-F2-3, NFR-1).
- Integration-mode decision record and adapters-contract decision record authored in-change, with the chosen mode matching the delivered default constant and the read-only direct-store rationale recorded (F-2, G-8, AC-F2-2, DEC-7).
- Per-spawn propagation of the resolved per-seat model record map into the spawn descriptor, bound per declared model variable name or seat `envName` (F-3, DM-4, AC-F3-1).
- Record precedence over a conflicting ambient parent value, undeclared-record neutrality, and preservation of the deny-by-default posture (F-3, NFR-9, AC-F3-2, AC-F3-3, RSK-6).
- `harness.profile.model-unrepresentable` refusal naming the seat, before any session exists, with no partial profile (F-3, AC-F3-4, DEC-6).
- Per-spawn (not process-global) propagation semantics across consecutive spawns with different resolved profiles (F-3, AC-F3-1).
- Identical propagation contract for spawn, deliver and resume; resume/attach identity continuation with the tree root preserved and delivered `harness.session.unknown` semantics retained (F-4, AC-F4-1).
- Per-seat telemetry rows: schema identity unchanged, harness kind and version stamped, seat identity, resolved model beside never-overwritten reported model, five token classes, calls, cost null-when-missing, durations or explicit absence (F-5, DM-5, DM-6, AC-F5-1, AC-F5-3, AC-F5-4).
- Additive-only schema growth with pre-change rows readable unchanged and no new major version (F-5, AC-F5-2, DEC-4).
- Single totals basis: seat attribution adds a dimension without double counting per-step rows against the session baseline (RSK-7).
- Absence/failure taxonomy: `harness.telemetry.absent` at exit 1 with no zero-valued row beside the delivered `harness.telemetry.extraction-failed` (F-6, AC-F6-1, AC-F6-2).
- Telemetry read discipline unchanged: read-only open, query-only pragma before the first read, bounded indexed queries, caps 64 sessions / 16 agents / 16 models / 24 tools per agent with explicit truncation marks (NFR-3).
- Conformance registry extension: the five new scenarios registered per harness, the delivered six-scenario floor unchanged, and violations naming the harness and the scenario or identity (F-7, DM-7, AC-F7-1, AC-F7-2, AC-F7-3).
- Refusal hygiene: the five new identities declared once with stable codes, projection-derived exits, non-empty remediation hints, additive `HARNESS_FAILURE_CODES` growth, and zero session-bearing side effects (AC-N1-1, RSK-5).
- Bounds, privacy, determinism, non-interference and offline hermeticity across every new path (NFR-4, NFR-5, NFR-7, NFR-8, NFR-10).
- Documentation reconciliation: harness feature spec, non-functional harness rows, decision index and planning status markers reflecting the delivered window, mode, propagation and seat telemetry (G-8, AC-F2-2).
- Test evidence for the pinned blueprint scenarios TC-M3-HARNESS-001 and TC-M3-HARNESS-002 and every acceptance criterion, offline (spec §17 traceability note, NFR-10).

### 1.2 Out of Scope & Known Gaps

- [OUT] Extending the Claude Code adapter: it stays a registered generated-artifact surface and is exercised only through the unchanged classification floor and the unchanged registration assertions (NG-1, OQ-M3-01).
- [OUT] Concurrent multi-mode operation, runtime mode fallback, or mode auto-detection from ambient state. Tested only as the *absence* of a second transport attempt (NG-2, AC-F2-1).
- [OUT] A telemetry schema version bump, structural re-shape, or field removal; currency conversion, re-pricing, or cross-model cost normalization (NG-3, NG-6, AC-F5-2).
- [OUT] Backfilling historical sessions with seat or duration facts. Legacy rows are asserted unchanged and *not* enriched (NG-4, AC-F5-2).
- [OUT] Harness store writes of any kind, including harness-side configuration mutation to force model selection. Asserted as a zero-write posture, never exercised as a write path (NG-5, NFR-3).
- [OUT] Provider profile resolution, model selection, pacing, nomination, or cost normalization: consumed as input and seeded as fixtures (NG-6).
- [OUT] Tracker adapters, the parity/trap-catalog suite, and multi-tracker composition (NG-7); background-service supervision, daemonization, or harness health management (NG-8); a new CLI command surface (NG-9).
- [OUT] Real harness stores, live sessions, provider calls, network I/O, and real user state directories on any test path (NFR-10). See §6 for the single documented, gated, non-CI probe and why it is not a test.
- [GAP-1 — implementation-plan mapping — PENDING] `chg-GH-335-plan.yaml` is authored in `delivery_planning` (phase 4) and does not exist yet. It must map `TC-HARNESS-001..041` onto phases without reshaping any TC's behavior, oracle, identity, exit, bound, or AC/NFR mapping, and it must resolve OQ-4 and OQ-5 below. Any later plan that changes a pinned contract reopens this test plan.
- [GAP-2 — delivery-bound, non-blocking: the live-harness half of AC-F3-1] Offline tests prove the resolved per-seat model record map reaches the spawn descriptor as data and that a simulated harness double reports back exactly what it received. They cannot prove that a real opencode v2.x reads that variable family (RSK-1, OQ-2). The in-change spike is the named evidence for that half; an optional documented, gated, non-CI probe (§6) may record it. AC-F3-1 is marked Covered-offline with this named boundary, never as fully proven.
- [GAP-3 — delivery-bound, non-blocking: NFR-2's 5 s wall-clock bound is runner-dependent] The CI oracle is **bounded work** — exactly one shell-free probe invocation per dispatch, no retry loop, a timeout that yields `indeterminate` rather than a hang — plus a reference measurement recorded in §10. The wall-clock half is never reported as a passing CI threshold.
- [GAP-4 — delivery-bound, non-blocking: AC-F2-2 is a human-gated record] A test can assert that both decision records exist, follow the per-type identifier convention, state the chosen mode among exactly the three declared modes, carry the read-only direct-store rationale, and are linked from the harness feature spec. It cannot assert that the decision is *correct* or accepted; the records stay `Proposed` until a human decides (DEC-7, spec §12).
- [GAP-5 — delivery-bound, non-blocking: new field and reason-constant names] The spec pins the *obligations* (seat identity, resolved model, observed model, durations, a divergence warning, an explicit duration absence) but not the exact JSON field names or the exact new closed-vocabulary reason strings. Every assertion goes through declared contract constants pinned once in the contract suite (TC-HARNESS-019, TC-HARNESS-035); no test asserts an inline string literal.
- [GAP-6 — delivery-bound, non-blocking: 2.1.x store shape is unobserved at intake] The window includes a minor line whose store layout was not observed (RSK-4). Its fixture is a declared shape derived from the `2.2.5` shape with named removals; the degrade-versus-failed split is asserted through the mandatory-field set declared by OQ-8's default, not against an unobserved real store.

## 2. References

- **Change specification**: [chg-GH-335-spec.md](./chg-GH-335-spec.md) — 23 ACs (AC-F1-1..4, AC-F2-1..4, AC-F3-1..4, AC-F4-1, AC-F5-1..4, AC-F6-1..2, AC-F7-1..3, AC-N1-1), F-1..F-7, DM-1..DM-7, NFR-1..NFR-10, DEC-1..DEC-7, RSK-1..RSK-8, OQ-1..OQ-3, §17 traceability note, Appendix B (pinned scenarios verbatim).
- **Ticket**: GH-335 — M3-S1: opencode v2.x harness and telemetry (https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/335). Ticket AC decomposes per spec §17: dispatch runs with the resolved profile (AC-F2-1, AC-F3-1..4, AC-F4-1), telemetry rows land with schema version and per-seat models (AC-F5-1, AC-F5-3, AC-F5-4), unsupported versions refuse with a typed error (AC-F1-2, AC-F1-3, AC-N1-1), integration-mode decision recorded (AC-F2-2).
- **PM record**: [chg-GH-335-pm-notes.yaml](./chg-GH-335-pm-notes.yaml) — scope source, the delivered-seam cross-check, gaps G1–G5, the GH-342 Q-06 default, observed harness `v2.2.5`, and the gate-command convention (`TMPDIR=$PWD/tmp/tmpdir`).
- **Milestone pack (planning truth)**: [m3/test-scenarios.md](../../../planning/oss-tooling/milestones/m3/test-scenarios.md) — TC-M3-HARNESS-001 and TC-M3-HARNESS-002 verbatim; [m3/README.md](../../../planning/oss-tooling/milestones/m3/README.md) EC-1; [m3/contracts.md](../../../planning/oss-tooling/milestones/m3/contracts.md) (extended harness port and the three declared typed refusals); [m3/architecture.md](../../../planning/oss-tooling/milestones/m3/architecture.md) (boundary invariants); [m3/open-questions.md](../../../planning/oss-tooling/milestones/m3/open-questions.md) (OQ-M3-01, OQ-M3-02, OQ-M3-07).
- **Implementation plan**: `./chg-GH-335-plan.yaml` — authored in phase 4; not yet present (GAP-1).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module→test mapping, `bun:test`, invariant-test authoring rules, aggregate `pnpm check`, fixture conventions.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, the error contract, `bun:test` authoring.
- **Current system truth — harness seam**: [feature-harness-adapters.md](../../../spec/features/feature-harness-adapters.md) — `HarnessInstance` (`observedVersion: string | null`, `versionWarning`), `HarnessSessionPort`, opencode streaming JSONL adapter, deny-by-default spawn environment with the optional profile record map, read-only bounded extraction into `delivery.harness.telemetry.v1`, closeout capture, the conformance registry with two registrations and the six-scenario floor.
- **Current system truth — NFRs**: [nonfunctional.md](../../../spec/nonfunctional.md) harness rows — read budget and query-only pragma, machine payload ≤ 65 536 UTF-8 bytes, human disclosure ≤ 4 096 bytes / 24 lines, byte-identical determinism, conformance-registration invariants, deny-by-default spawn environment.
- **Current system truth — telemetry v2 and spend**: [feature-telemetry-v2.md](../../../spec/features/feature-telemetry-v2.md), [feature-spend.md](../../../spec/features/feature-spend.md) — record families, attribution dimensions, reading bases, `spend.telemetry-absent` meaning (untouched here), bounded read discipline.
- **Current system truth — result contract and state**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) (`delivery.result.v1`, error table, projection-derived exit, redaction chokepoint), [feature-state-layer.md](../../../spec/features/feature-state-layer.md) (fenced verified appends, `state.*` identities), [feature-config-layer.md](../../../spec/features/feature-config-layer.md) (typed `harness` branch and `defaults` origins).
- **Contracts and seams consumed**: `packages/core/src/contracts/harness.ts` (`HARNESS_KINDS`, `HARNESS_FAILURE_CODES` — nine delivered codes, `HARNESS_VERSION_WARNINGS` = `["version-probe-failed"]`, `HarnessInstance`, `HarnessExecutionEnvironmentDescriptor`, the spawn/resume inputs, `HarnessSessionHandle`), `packages/core/src/contracts/harness-telemetry.ts` (`HARNESS_TELEMETRY_SCHEMA_ID`, `HARNESS_TOKEN_CLASSES`, `HARNESS_WARNING_REASONS`, `HarnessTelemetryRecord`, `HarnessTruncation`), `packages/core/src/contracts/error-table.ts` (rows with `code`, `domainKind`, `category`, `retryable`, `consequence`, `remediationHint`, `projectionClass`, `summary`), `packages/core/src/contracts/result.ts` (`RESULT_SCHEMA_VERSION`, `error.code`, `error.remediationHint`), `packages/cli/src/projection.ts` (`success → 0`, `user-validation → 1`, `platform-provider → 2`, `attention → 1`), `packages/core/src/domain/harness-registry.ts` (injected version probe, `null` + `version-probe-failed` on failure), `packages/core/src/domain/harness-spawn-env.ts` (deny-by-default builder), `packages/core/src/provider/profile-env-record.ts` (`envRecordNameForSeat`, `buildProfileEnvRecord`), `packages/adapters/src/harness/opencode.ts`, `telemetry-opencode.ts`, `telemetry-session-totals.ts`, `packages/adapters/src/host/index.ts`.
- **Conformance testkit**: [packages/testkit/src/conformance/harness.ts](../../../../packages/testkit/src/conformance/harness.ts) — `HARNESS_CONFORMANCE_SCENARIOS` (the six ids), `HarnessConformanceRegistration`, `HARNESS_CONFORMANCE_REGISTRY` (exactly `opencode` and `claude-code`), `harnessConformanceViolations`.
- **Existing evidence to extend (not replace)**: `tests/structure/{harness-contract,harness-stream-contract,harness-neutrality,harness-environment-marker,harness-review-deferrals,error-table,conformance-coverage,content-inventory}.test.ts`; `tests/behaviour/{harness-spawn-env,harness-spawn-credential,harness-default-path,harness-config,harness-opencode-session,harness-opencode-stream,harness-opencode-resume-stream,harness-host-stream,harness-stream-hygiene,harness-telemetry-opencode,harness-telemetry-shape,harness-telemetry-drift,harness-telemetry-claude,harness-telemetry-claude-budget,harness-telemetry-opencode-orphan-scope,harness-closeout-capture,harness-closeout-idempotency,harness-closeout-nongating,harness-output-bounds,dispatch-harness-acquisition,dispatch-harness-default-spawn}.test.ts`; `tests/conformance/{harness-classification,harness-liveness}.test.ts`; `tests/checks/{harness-mutants,harness-determinism,harness-ci-parity,error-table-sync,exit-code-literals,decision-record,fixture-privacy}.test.ts`; `tests/fixtures/harness/{spawn-env,harness-io,opencode-store/build,scenarios/classification,scenarios/stream,stream/README}.ts`; `tests/fixtures/harness/stream/opencode-v2.2.5{,-tool-error,-stream-error,-tokens}.jsonl`.
- **Closest delivered precedent**: [chg-GH-291-test-plan.md](../2026-11-12--GH-291--telemetry-v2/chg-GH-291-test-plan.md) — the fixture contract, non-vacuity contract, oracle matrices and mutant discipline mirrored here; and [chg-GH-233-test-plan.md](../2026-11-06--GH-233--harness-adapters/chg-GH-233-test-plan.md) for the harness-port conventions (`TC-HARN` numbering, the `harness-mutants` pattern).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | An in-window version with a resolved profile proceeds, and the observed version plus window verdict ride the resolved instance | TC-HARNESS-001, TC-HARNESS-004, TC-HARNESS-006, TC-HARNESS-040 | Covered |
| AC-F1-2 | **Pinned TC-M3-HARNESS-002** — an out-of-window version refuses with `harness.version.unsupported` (exit 1, remediation naming the window) and no session is spawned | TC-HARNESS-002, TC-HARNESS-004, TC-HARNESS-006, TC-HARNESS-036 | Covered |
| AC-F1-3 | An undeterminable or unparseable version refuses with `harness.version.unknown`, the observation stays the explicit unknown, and nothing is fabricated or silently permitted | TC-HARNESS-003, TC-HARNESS-006 | Covered |
| AC-F1-4 | The window is data: absent or unusable configuration degrades to the pinned default, never to an unbounded or wider window | TC-HARNESS-005 | Covered |
| AC-F2-1 | The delivered default mode is used for a spawn, with no other mode attempted as a runtime fallback | TC-HARNESS-007, TC-HARNESS-040 | Covered |
| AC-F2-2 | An integration-mode decision record states the chosen mode among the three declared modes with the read-only direct-store rationale, linked from the change and the harness feature spec | TC-HARNESS-010, TC-HARNESS-041 | Covered (structural half; human-gated — GAP-4) |
| AC-F2-3 | A requested mode the delivery does not support refuses with `harness.mode.unavailable` before any spawn, naming requested and available | TC-HARNESS-008, TC-HARNESS-036 | Covered |
| AC-F2-4 | An omitted mode applies the default with a `defaults` origin; an unknown value is refused rather than silently defaulted | TC-HARNESS-009 | Covered |
| AC-F3-1 | **Pinned TC-M3-HARNESS-001** — the spawn descriptor carries each declared seat's model record, the session reports the resolved per-seat models, and telemetry rows carry those seats with tokens and cost | TC-HARNESS-011, TC-HARNESS-015, TC-HARNESS-016 | Covered (offline against a simulated harness double — GAP-2) |
| AC-F3-2 | A resolved record value wins over a conflicting ambient parent value for a declared name | TC-HARNESS-012, TC-HARNESS-015 | Covered |
| AC-F3-3 | Undeclared record names change nothing and no undeclared parent variable is forwarded | TC-HARNESS-013 | Covered |
| AC-F3-4 | An inexpressible required seat model refuses with `harness.profile.model-unrepresentable` naming the seat, with no session spawned | TC-HARNESS-014, TC-HARNESS-036 | Covered |
| AC-F4-1 | Resume or attach continues the session identity with the tree root and propagation contract preserved; unknown or different sessions keep delivered `harness.session.unknown` semantics | TC-HARNESS-016, TC-HARNESS-017, TC-HARNESS-018 | Covered |
| AC-F5-1 | Every landed row stamps the schema version, harness kind and version, seat identity, resolved seat model, reported model, five token classes, calls, cost (null when missing), and durations | TC-HARNESS-011, TC-HARNESS-019, TC-HARNESS-026, TC-HARNESS-028 | Covered |
| AC-F5-2 | Pre-change `delivery.harness.telemetry.v1` rows remain readable and unchanged; fields are additions with no removal, rename, or new major version | TC-HARNESS-020 | Covered |
| AC-F5-3 | A resolved-versus-reported model divergence keeps both values and discloses itself with a closed-vocabulary warning, never by overwrite | TC-HARNESS-021 | Covered |
| AC-F5-4 | A duration the store does not expose is explicitly absent with a closed-vocabulary warning and is never derived or estimated | TC-HARNESS-022, TC-HARNESS-028 | Covered |
| AC-F6-1 | A session with no telemetry rows returns `harness.telemetry.absent` at exit 1 and produces no zero-valued row | TC-HARNESS-023 | Covered |
| AC-F6-2 | An unreadable or unopenable store keeps `harness.telemetry.extraction-failed` and is never re-projected as absence | TC-HARNESS-024 | Covered |
| AC-F7-1 | Both registered harnesses still cover and pass the unchanged six-scenario classification floor | TC-HARNESS-031 | Covered |
| AC-F7-2 | A registered harness missing a version-window, unknown-version, mode-unavailable, or profile-propagation scenario fails the suite, naming the harness and the scenario; a new refusal identity with no scenario fails too | TC-HARNESS-032, TC-HARNESS-033 | Covered |
| AC-F7-3 | The conformance suite runs offline against simulated harness I/O with zero live harness invocations | TC-HARNESS-033, TC-HARNESS-034 | Covered |
| AC-N1-1 | Any version, mode, or profile refusal leaves no child session, no orphan process, no telemetry row, and no other spawn side effect | TC-HARNESS-035, TC-HARNESS-036, TC-HARNESS-038 | Covered (with the probe-scope clarification recorded as OQ-6) |

**Traceability to the ticket AC (verbatim, binding).**

| Ticket AC | Covered by | How the plan proves it |
|---|---|---|
| "dispatch through the installed harness port runs with the resolved profile" | TC-HARNESS-011, TC-HARNESS-012, TC-HARNESS-013, TC-HARNESS-014, TC-HARNESS-016, TC-HARNESS-017, TC-HARNESS-007 | The profile-propagation matrix P-01..P-08 plus the recorded child environment of a simulated harness double: each declared seat's variable carries the resolved value, a conflicting parent value loses, an undeclared name vanishes, and an unrepresentable seat refuses before spawn |
| "telemetry rows land with schema version and per-seat models" | TC-HARNESS-019, TC-HARNESS-021, TC-HARNESS-022, TC-HARNESS-026 | Field matrix T-01..T-14 on fixture-seeded stores: schema constant equality, seat identity, resolved and observed model kept side by side, token/cost/duration fields or explicit absence, one totals basis |
| "unsupported versions refuse with a typed error" | TC-HARNESS-002, TC-HARNESS-003, TC-HARNESS-036 | Version verdict matrix V-01..V-12 plus the refusal/oracle matrix M-01..M-10: exact identity, projection class, exit, envelope shape, session-seam call count 0 |
| "integration-mode decision recorded" | TC-HARNESS-010, TC-HARNESS-041 | Both decision records exist with required fields, the chosen mode equals the delivered default constant and is one of the three declared modes, and the harness feature spec links it |

**Capability coverage** (no capability unlinked): F-1 → TC-HARNESS-001..006; F-2 → TC-HARNESS-007..010, 040; F-3 → TC-HARNESS-011..016; F-4 → TC-HARNESS-016..018; F-5 → TC-HARNESS-019..030; F-6 → TC-HARNESS-023, 024; F-7 → TC-HARNESS-031..034. Cross-cutting hygiene, mutation, hermeticity and docs: TC-HARNESS-035..041.

All 23 acceptance criteria map to at least one automated case; none is left unmapped. Two criteria carry an explicit named boundary instead of a silent claim: AC-F3-1's live-harness half (GAP-2) and AC-F2-2's human-gated correctness half (GAP-4).

**Pinned blueprint scenarios (verbatim, binding).**

```
TC-M3-HARNESS-001 opencode v2.x dispatch with profile propagation
Given a resolved model profile and an installed opencode v2.x,
When the harness port spawns an agent session in standalone mode,
Then the session reports the resolved per-seat models and emits versioned
telemetry rows with tokens and cost.

TC-M3-HARNESS-002 unsupported harness version
Given an opencode version outside the supported window,
When a dispatch is attempted,
Then it refuses with `harness.version.unsupported` and no session is spawned.
```

| Pinned scenario | Delivered as | Assertions that make it non-vacuous |
|---|---|---|
| TC-M3-HARNESS-001 | TC-HARNESS-011 (with TC-HARNESS-019, TC-HARNESS-026 supplying the row and totals half) | Seat count N ≥ 2 and distinct resolved models, so a single collapsed seat fails; the spawn descriptor *and* the echoed child environment are both inspected, so a descriptor that never reaches the spawn fails; rows must be non-empty with non-null tokens and cost, so a rows-present claim with zero rows fails |
| TC-M3-HARNESS-002 | TC-HARNESS-002 (with TC-HARNESS-036 supplying the side-effect half) | A paired in-window control must proceed on the same fixture, so a blanket refusal fails; the version string is mutated from the out-of-window fixture to an in-window one and the verdict must flip, so a hardcoded refusal fails; the session-spawn seam call count is asserted to be 0, so "refused after spawning" fails |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no HTTP endpoint (§8.1: N/A) and adds no message/event bus element; §8.2 elements are the inbound harness stream, the spawn-descriptor environment records, storage rows, and derived disclosures, all covered below.

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| Outbound — version probe invocation (§8.2) | One bounded, shell-free invocation through the delivered child-process seam at resolution; no session, no prompt, no allowlist bypass | TC-HARNESS-006, TC-HARNESS-036 | Covered |
| Internal — spawn descriptor environment records (§8.2) | The resolved per-seat model record map carried as data per spawn; record values win for declared names; undeclared names change nothing | TC-HARNESS-012, TC-HARNESS-013, TC-HARNESS-015, TC-HARNESS-016 | Covered |
| Inbound — harness JSONL stream (§8.2) | Unchanged read-only consumption over the delivered streaming seam; no new frame-parsing contract | TC-HARNESS-037 | Covered (regression half) |
| Storage — `harness.telemetry` rows (§8.2) | Additive fields under the unchanged `delivery.harness.telemetry.v1` identity; schema version and harness version stamped per row | TC-HARNESS-019, TC-HARNESS-020, TC-HARNESS-021, TC-HARNESS-022 | Covered |
| Derived — refusal disclosure (§8.2) | Every version, mode and profile refusal names the identity, the observed/requested value, the supported/available alternative, and a remediation hint | TC-HARNESS-035, TC-HARNESS-036 | Covered |
| DM-1 — Supported-version window | The declared minor lines a harness may run on, carried as data with the verdict; one pinned default | TC-HARNESS-004, TC-HARNESS-005, TC-HARNESS-006 | Covered |
| DM-2 — Version evaluation result | The verdict (inside, outside, indeterminate) with the observed version or explicit unknown and the warning that rides an unknown | TC-HARNESS-001, TC-HARNESS-002, TC-HARNESS-003, TC-HARNESS-006, TC-HARNESS-040 | Covered |
| DM-3 — Integration-mode declaration | The declared mode, its origin (default or configured), and the closed vocabulary of requestable modes | TC-HARNESS-007, TC-HARNESS-008, TC-HARNESS-009, TC-HARNESS-040 | Covered |
| DM-4 — Profile propagation record | Per seat: the declared model variable name, the resolved model value, and the seat identity, carried into the spawn descriptor | TC-HARNESS-011..TC-HARNESS-017 | Covered |
| DM-5 — Seat telemetry attribution | Additive row fields: seat identity, resolved model, and the observed harness-reported model with its divergence warning | TC-HARNESS-019, TC-HARNESS-021 | Covered |
| DM-6 — Duration fields | Additive per-row durations (start, end, elapsed) or an explicit absence with a closed warning; never derived from capture time | TC-HARNESS-019, TC-HARNESS-022, TC-HARNESS-028 | Covered |
| DM-7 — Conformance scenario set | The delivered six-scenario floor plus version-window, unknown-version, mode-unavailable, and profile-propagation scenarios | TC-HARNESS-031, TC-HARNESS-032, TC-HARNESS-033 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | A version, mode, or profile refusal occurs before any session: zero spawned sessions, zero orphans, zero telemetry rows, zero store writes | TC-HARNESS-006, TC-HARNESS-008, TC-HARNESS-014, TC-HARNESS-036 | Covered |
| NFR-2 | The probe resolves within 5 s; an unanswered probe is an explicit indeterminate version, never a retried loop, never a fabricated version | TC-HARNESS-006 | Covered by bounded work in CI plus a non-CI reference measurement (GAP-3) |
| NFR-3 | Read-only open, query-only pragma before the first read, bounded indexed queries only, caps 64 / 16 / 16 / 24 with explicit truncation marks | TC-HARNESS-025 | Covered |
| NFR-4 | Machine payload ≤ 65 536 UTF-8 bytes; human disclosure ≤ 4 096 bytes and ≤ 24 lines; truncation deterministic, tail-ordered, marked; refusal identities and hints never truncated | TC-HARNESS-030 | Covered |
| NFR-5 | Rows and refusals carry identity references, counts, costs and durations only — never prompt text, message bodies, transcripts, diffs, tool output, credential material, or harness configuration values | TC-HARNESS-027 | Covered |
| NFR-6 | No figure is invented: missing cost is null, missing token class is null with a warning, missing duration is explicitly absent, missing version is the explicit unknown; zero is never a substitute for absence | TC-HARNESS-003, TC-HARNESS-019, TC-HARNESS-022, TC-HARNESS-023, TC-HARNESS-028 | Covered |
| NFR-7 | Byte-identical output for identical injected harness facts, probe result, resolved profile and clock; zero model calls and zero network on any evaluation, refusal, or render path | TC-HARNESS-029 | Covered |
| NFR-8 | Version evaluation, mode resolution and profile propagation add no blocking work to the delivered stream drain, handle acquisition, or output-bound behavior | TC-HARNESS-037 | Covered |
| NFR-9 | No ambient environment read outside the injected seams; the profile record map is passed as data and adapters read no ambient environment | TC-HARNESS-013, TC-HARNESS-015, TC-HARNESS-027 | Covered |
| NFR-10 | 100% of new tests offline against simulated harness I/O and fixture stores; zero live harness invocations, credentials, or network | TC-HARNESS-034, TC-HARNESS-039 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 23 are mapped. AC-F3-1 is Covered-offline with GAP-2 naming its live-harness half; AC-F2-2 is Covered-structural with GAP-4 naming its human-gated half. Neither is left unmapped.
- **Orphan TCs**: none. Every TC names at least one AC, NFR or DM in §5.1 and §5.2.
- **Uncovered NFRs**: none. NFR-2's wall-clock half is explicitly reference-only (GAP-3); its CI-verifiable bounded-work half is asserted in TC-HARNESS-006.
- **Uncovered DMs**: none (DM-1..DM-7 all mapped).
- **Gap status**: GAP-1 (plan mapping) is phase-4-pending; GAP-2 (live-harness propagation), GAP-3 (probe wall-clock), GAP-4 (human-gated record), GAP-5 (field/reason constant names), GAP-6 (unobserved 2.1.x shape) are delivery-bound and non-blocking, each with a named oracle and owner.
- **Intentional duplicate coverage**: AC-F1-1 spans four TCs because verdict carriage, boundary parsing, the pre-spawn evaluation point and outcome disclosure fail independently. AC-F3-1 spans three because descriptor content, per-spawn (not process-global) semantics, and the spawn/deliver/resume identity of the contract are separately falsifiable. AC-F5-1 spans four because row shape, totals basis, and the two store-shape variants degrade differently. AC-F5-4 spans two because the field contract and the 2.1.x shape are separate fixtures. AC-F7-2 spans two because "missing scenario fails" and "scenario actually proves the property" are distinct regressions. AC-N1-1 spans three because identity/exit hygiene, side-effect freedom, and mutant coverage fail independently.
- **Spec-named behavior bound to an existing AC/NFR** (no dedicated AC by design):

| Behavior | Spec source | Bound AC/NFR | Where |
|---|---|---|---|
| The window is a maintained constant with a declared revisit trigger | §22, RSK-2 | AC-F1-4 | TC-HARNESS-005 |
| "Refuse" wording resolved over "degrade with a typed refusal" | pm-notes, §1 | AC-F1-2, AC-F2-3, AC-F3-4 | TC-HARNESS-002, 008, 014 |
| Every dispatch discloses the version verdict and the selected mode | §10 | AC-F1-1, AC-F2-1 | TC-HARNESS-040 |
| Telemetry capture stays non-gating and never changes a delivery outcome | §10 | AC-F5-1, AC-F6-1 | TC-HARNESS-023, 037 |
| Per-seat attribution discloses unresolved seats and divergence with counts and reasons | §10 | AC-F5-3 | TC-HARNESS-021 |
| Every invocation lands its command-audit record; an audit-write failure is diagnostic | §10 | AC-N1-1 | TC-HARNESS-037 |
| Failure identities are declared once; delivered meanings are untouched | §8.5, RSK-5 | AC-N1-1 | TC-HARNESS-035 |
| Store access is read-only with the query-only pragma before the first read | §8.4, §21 | NFR-3 | TC-HARNESS-025 |
| Brand neutrality: no hardcoded product or binary name in tooling contracts | §21 | NFR-7 (determinism/naming discipline), AC-F2-2 | TC-HARNESS-029, TC-HARNESS-035 |
| Planning status markers and decision index reconciled | §18 | AC-F2-2 | TC-HARNESS-041 |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract and vocabulary | `bun test tests/structure` | `tests/structure/harness-contract.test.ts` (update), `tests/structure/harness-version-window-contract.test.ts` (new), `tests/structure/harness-neutrality.test.ts` (update if literals extend) | TC-HARNESS-004 (constant half), 005, 019 (shape half), 020, 035 |
| Error identity and sync | `bun test tests/checks`; `bun run scripts/checks/error-table-sync.ts` | `tests/structure/error-table.test.ts` (update), `tests/checks/error-table-sync.test.ts` (update), `tests/checks/exit-code-literals.test.ts` (must stay green) | TC-HARNESS-035 |
| Behaviour — version gate | `bun test tests/behaviour` | `tests/behaviour/harness-version-gate.test.ts`, `harness-version-window.test.ts`, `harness-version-probe-bound.test.ts` (new) | TC-HARNESS-001..006 |
| Behaviour — integration mode | `bun test tests/behaviour` | `tests/behaviour/harness-mode-selection.test.ts`, `harness-mode-refusal.test.ts`, `harness-mode-config.test.ts` (new) | TC-HARNESS-007..009 |
| Behaviour — profile propagation | `bun test tests/behaviour` | `tests/behaviour/harness-profile-propagation.test.ts`, `harness-profile-precedence.test.ts`, `harness-profile-neutrality.test.ts`, `harness-profile-unrepresentable.test.ts`, `harness-profile-per-spawn.test.ts` (new) | TC-HARNESS-011..016 |
| Behaviour — resume and attach | `bun test tests/behaviour` | `tests/behaviour/harness-resume-propagation.test.ts`, `harness-attach.test.ts` (new); `harness-opencode-resume-stream.test.ts` (assertions unchanged) | TC-HARNESS-017, 018 |
| Behaviour — telemetry rows | `bun test tests/behaviour` | `tests/behaviour/harness-telemetry-seat-attribution.test.ts`, `harness-telemetry-durations.test.ts`, `harness-telemetry-divergence.test.ts`, `harness-telemetry-version-compat.test.ts`, `harness-telemetry-absent.test.ts`, `harness-telemetry-extraction-failure.test.ts`, `harness-telemetry-seat-totals.test.ts` (new); `harness-telemetry-shape.test.ts`, `harness-telemetry-opencode.test.ts` (update) | TC-HARNESS-019..028 |
| Behaviour — dispatch disclosure | `bun test tests/behaviour` | `tests/behaviour/dispatch-harness-verdict-mode.test.ts` (new); `dispatch-harness-acquisition.test.ts`, `dispatch-harness-default-spawn.test.ts` (assertions unchanged) | TC-HARNESS-040, 037 |
| Conformance — registry extension | `bun test tests/conformance tests/structure` | `tests/conformance/harness-version-mode-propagation.test.ts` (new); `tests/conformance/harness-classification.test.ts` (assertions unchanged); `tests/structure/conformance-coverage.test.ts` (update) | TC-HARNESS-031..034 |
| Mutation meta-suite | `bun test tests/checks` | `tests/checks/harness-mutants.test.ts` (extend the delivered pattern) | TC-HARNESS-038 |
| Determinism | `bun test tests/checks` | `tests/checks/harness-determinism.test.ts` (update), `tests/checks/harness-ci-parity.test.ts` (assertions unchanged) | TC-HARNESS-029 |
| Hermeticity | `bun test tests/checks` | `tests/checks/harness-hermetic.test.ts` (new; the `telemetry-hermetic` / `provider-hermetic` pattern) | TC-HARNESS-039, 034 |
| Privacy and bounds | `bun test tests/behaviour tests/checks` | `tests/behaviour/harness-telemetry-privacy.test.ts` (new), `harness-output-bounds.test.ts` (update), `tests/checks/fixture-privacy.test.ts` (fixture scan), `tests/checks/privacy-literals.test.ts` (update if literals extend) | TC-HARNESS-027, 030 |
| Decision records | `bun test tests/checks` | `tests/checks/decision-record.test.ts` (extend the inventory) | TC-HARNESS-010 |
| Documentation surface | Manual content check + `bun test tests/checks` | `doc/spec/features/feature-harness-adapters.md`, `doc/spec/nonfunctional.md`, `doc/decisions/00-index.md`, `doc/planning/oss-tooling/` status markers; `tests/checks/doc-conformance.test.ts`, `tests/structure/content-inventory.test.ts` | TC-HARNESS-041 |
| Aggregate and non-regression | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | repo root; unchanged gates (`lint → format:check → typecheck → test → check:boundaries` plus the repository invariant checks) | All TCs (regression half) |

### 4.1 Fixture and Harness Contract (binding for every TC)

1. **No live harness, network, credential, or user state directory.** Every suite imports production modules and injects fakes plus a per-test temp root. No suite starts the opencode binary, opens a real harness store, reads `$HOME`, resolves a credential through a real source, or opens a socket (NFR-10).
2. **The harness double is injected, not mocked globally.** Version probing, streaming spawn, one-shot spawn, session listing and telemetry-store reading are injected seams. No test installs a process-global `node:child_process` mock (the delivered `harness-stream-hygiene.test.ts` read-only guard forbids it). A double records every call and its arguments so "was a session started" is asserted from recorded arguments, never inferred.
3. **The version table is data.** One fixture module declares the version verdict table (V-01..V-12 in §4.4): observed string, expected verdict, expected identity, expected exit. Suites iterate the table; adding a row is a data edit, not a new test body.
4. **Propagation fixtures are declared profile records, not ad-hoc object literals.** One fixture module declares resolved profiles with N seats, their declared variable names or explicit `envName`, the resolved models, the conflicting ambient parent values, the undeclared record names with unique canaries, and one unrepresentable seat. Canaries are unique strings asserted absent elsewhere.
5. **The telemetry store oracle is a fixture builder.** `tests/fixtures/harness/opencode-store/build.ts` is extended with declared variants: complete seat/duration row, missing-duration, missing-cost, missing token class, model divergence, no optional columns, 2.1.x-shape degradation, unreadable/unopenable, and zero-rows. Each variant carries a privacy canary in place of message bodies. No binary store is committed.
6. **Injected time, ids and brand.** A fixed `NOW_MS`; `capturedAt` and any duration fixtures are literal constants, never `Date.now()`. Session ids and run ids are fixed sequences. The brand is a synthetic brand constant so a hardcoded product name fails.
7. **Read-only fixture discipline.** Truncation, clamp, and mutation probes run against temp copies (the delivered `tests/checks/harness-mutants.test.ts` temp-copy pattern); the live tree and committed fixtures are never written, and no assertion reads a diff against a moving base branch.
8. **The one permitted real-store read is not a test.** The in-change spike may record a real harness observation through a documented live entrypoint modelled on `tests/conformance/live/run-live.ts`: it is not `*.test.ts`, is not discovered by `bun test`, is never invoked by `pnpm check` or CI, and its output is recorded in the change artifacts as spike evidence. The spec's spike deliverable (AC-F2-2, GAP-2) is the only justification for its existence; it is never an oracle for any TC.
9. **Fixture privacy.** Every new fixture passes `tests/checks/fixture-privacy.test.ts`: synthetic, redacted content only — no real session ids, credentials, model-provider secrets, or personal data.

### 4.2 Non-Vacuity Contract (binding for every refusal, absence, bound, divergence and propagation case)

1. **A planted positive is asserted before the absence or refusal.** Before asserting `harness.telemetry.absent`, a paired store with one row appends and renders. Before asserting an unrepresentable seat refuses, a paired representable seat spawns. Before asserting a duration is absent, a paired complete row carries literal start/end/elapsed. Before asserting a payload is bounded, an under-cap render is asserted untruncated.
2. **A paired live control runs in the same test.** Every out-of-window fixture beside an in-window fixture; every unavailable-mode request beside the default-mode request; every conflicting parent value beside a record-absent case; every divergent model pair beside an agreeing pair; every damaged store beside a healthy store.
3. **The gate is exercised, not hardcoded.** Mutating the pinned window value in a temp copy of the window module must flip the verdict of the same fixture (V-10): an out-of-window fixture that still refuses under a widened window proves the test is asserting a literal, not the gate. Conversely, widening the window to an unbounded value must make V-04 accept, so "never widen silently" (AC-F1-4) is falsifiable.
4. **The probe is exercised, not skipped.** A passing probe control beside the failing probe; a recorded invocation count of exactly 1 proves the evaluation happened once rather than not at all; a 5 001 ms fake-clock advance proves the bound is applied rather than the verdict being computed from a cached "inside".
5. **Propagation is proven at the spawn, not at the derivation.** The oracle is the child environment the spawn seam actually received, cross-checked against the session's echoed report. A descriptor object that is built and discarded fails.
6. **A disabling mutant must fail the suite (TC-HARNESS-038).** Each mutant is a temporary copy of one production module with one honesty rule disabled. The mutant must produce the prohibited observable on an unchanged fixture; if the real module also produces nothing, the suite fails.
7. **Bounds are measured, never assumed.** Byte bounds are measured on serialized UTF-8 bytes with a positive measured length asserted first; line bounds by counting rendered lines; truncation by comparing the under-cap and over-cap renders.
8. **Permutation invariance is asserted, not assumed.** Store rows appended in shuffled order must yield byte-identical rows, verdicts and renders; a fixture whose expected result depends on append order fails.

### 4.3 Refusal / Oracle Matrix (binding for AC-F1-2, AC-F1-3, AC-F2-3, AC-F3-4, AC-F6-1, AC-F6-2, AC-N1-1)

Envelope shape for every row: `RESULT_SCHEMA_VERSION` = `delivery.result.v1` with `error.code` equal to the identity verbatim and `error.remediationHint` non-empty. Exit is a pure function of `projectionClass` via `packages/cli/src/projection.ts` (`user-validation → 1`, `platform-provider → 2`, `attention → 1`, `success → 0`) and is never read from a table entry.

| ID | Trigger | Identity (closed) | Projection class | Exit | Remediation hint must state | Session-bearing side effects |
|---|---|---|---|---|---|---|
| M-01 | Observed version outside the supported window | `harness.version.unsupported` | user-validation | 1 | The observed version and the supported lines (`2.2.x`, `2.1.x`) so the fix is an upgrade | Session-spawn seam calls 0; telemetry rows 0; store writes 0 |
| M-02 | Version probe fails, is empty, or yields an unparseable string | `harness.version.unknown` | user-validation | 1 | That the installation's version could not be determined and must be repaired; never an "upgrade" instruction | Session-spawn seam calls 0; `observedVersion === null`; telemetry rows 0 |
| M-03 | Requested mode is not the delivered default | `harness.mode.unavailable` | user-validation | 1 | The requested mode and the available mode | Session-spawn seam calls 0; no alternate transport attempt |
| M-04 | Mode branch carries an unknown value | The delivered configuration refusal identity for an invalid value (`config.value.invalid`; OQ-5 default) | user-validation | 1 | The received value and the accepted values | No silent default applied; session-spawn seam calls 0 |
| M-05 | A required seat model cannot be expressed as a declared per-spawn variable | `harness.profile.model-unrepresentable` | user-validation (OQ-5 default) | 1 | The seat and the declared name or `envName` it needs | Session-spawn seam calls 0; no partial environment built |
| M-06 | Session has no telemetry rows | `harness.telemetry.absent` | user-validation | 1 | That no rows exist for the session and capture must run | No zero-valued row appended; no report rendered |
| M-07 | Harness store cannot be opened or read | `harness.telemetry.extraction-failed` (delivered, unchanged) | platform-provider | 2 | The configured store location and read permissions | No row; never re-projected as M-06 |
| M-08 | Resume or attach names a different or absent session | `harness.session.unknown` (delivered, unchanged) | user-validation | 1 | The existing session identity from the original spawn | Idempotent kill; no orphan; no new root |
| M-09 | A declared spawn variable is absent | `harness.spawn.variable-missing` (delivered, unchanged) | user-validation | 1 | The variable name in `field` | Session-spawn seam calls 0 |
| M-10 | In-window version, available mode, complete representable profile | — (success) | success | 0 | — | Rows land; one session |

**Refusal precedence (Flow 1 / Flow 2 order, binding).**

| ID | Condition | Expected outcome |
|---|---|---|
| P-01 | Out-of-window version *and* an unavailable requested mode | M-01 wins; M-03 is not evaluated; exactly one identity on the envelope |
| P-02 | In-window version *and* unavailable requested mode | M-03; no spawn |
| P-03 | In-window version, available mode, unrepresentable required seat | M-05; no spawn, no rows, no partial environment |

**Invariants.** Each new identity is declared exactly once; the nine delivered codes keep their meaning; no exit literal exists outside the projection module; absence is never reused for damage and damage is never reused for absence; a refusal is a classified outcome, never a bare exit status.

### 4.4 Version Verdict Matrix (binding for AC-F1-1..AC-F1-4)

`W` = the pinned window `{2.2.x, 2.1.x}` (DEC-1). The accepted version grammar is a declared contract constant (GAP-5); the table below is generated from it so parse acceptance and rejection cannot drift apart.

| ID | Observed version | Expected verdict | Expected identity | Exit | Notes |
|---|---|---|---|---|---|
| V-01 | `2.2.5` | inside | — | 0 | The intake observation |
| V-02 | `2.1.7` | inside | — | 0 | The previous minor line |
| V-03 | `2.2.0` | inside | — | 0 | Lower bound of the current line |
| V-04 | `2.3.0` | outside | `harness.version.unsupported` | 1 | The next minor is out |
| V-05 | `2.0.9` | outside | `harness.version.unsupported` | 1 | Two minors back |
| V-06 | `3.0.0` | outside | `harness.version.unsupported` | 1 | A major beyond the window |
| V-07 | `""` (empty probe) | indeterminate | `harness.version.unknown` | 1 | Delivered `version-probe-failed` warning preserved at instance level |
| V-08 | probe throws / exceeds 5 s | indeterminate | `harness.version.unknown` | 1 | One invocation; no retry |
| V-09 | `2.two.5`, `2.2.x`, `latest` | indeterminate | `harness.version.unknown` | 1 | Unparseable is unknown, never a match |
| V-10 | `2.3.0` with the window constant widened to include `2.3` (temp copy) | inside | — | 0 | Non-vacuity: the gate is exercised |
| V-11 | `9.9.9` with the window constant made unbounded (temp copy) | inside | — | 0 | Proves V-04 is not a hardcoded literal in the *other* direction; the production constant still refuses |
| V-12 | `9.9.9` with an absent or malformed configured window | outside | `harness.version.unsupported` | 1 | Degrades to the pinned default, never unbounded (AC-F1-4) |

### 4.5 Telemetry Field Matrix (binding for AC-F5-1..AC-F5-4, NFR-3, NFR-6)

Field names below are role names; the exact JSON keys and warning reason strings are declared once in the contract module and asserted through those constants (GAP-5). `schemaId` is exact: `delivery.harness.telemetry.v1`.

| ID | Store / spawn shape | Expected row | Never |
|---|---|---|---|
| T-01 | Complete seat, both models equal, all classes, cost, durations | Every field present; `schemaId === "delivery.harness.telemetry.v1"`; `harnessKind === "opencode"`; `harnessVersion === "2.2.5"`; seat identity; resolved model; observed model; five token classes; calls; cost; `{start, end, elapsed}` matching literal fixtures; `warnings` empty | A missing mandatory field; a warning on a complete row |
| T-02 | Store exposes no duration | Durations explicitly absent with the declared absence reason in `warnings`; `capturedAt` still present | A duration computed from `capturedAt`, an estimate, a `0`, or any number |
| T-03 | Store exposes no cost | `cost === null` with the delivered `cost-missing` warning | `cost === 0` |
| T-04 | Store omits one token class | That class `null` with a warning; the other four counted exactly; excluded from sums | `0` in the sum for the omitted class |
| T-05 | Resolved model ≠ observed model | Both values kept; divergence warning from the closed vocabulary; one row per agent/model group | Overwriting either value; collapsing to one model |
| T-06 | Resolved model == observed model | No divergence warning (paired control for T-05) | A warning on agreement |
| T-07 | A seat cannot be resolved | Disclosed with the declared reason and a count; never guessed into another seat | A fabricated seat name; a silently dropped row |
| T-08 | Pre-change row (no seat, no durations, no resolved model) | Read unchanged; new fields absent; no backfill; no crash | Enriching the stored row; a schema bump |
| T-09 | Additive-only assertion | `HARNESS_TELEMETRY_SCHEMA_ID` unchanged; no field removed or renamed; a consumer ignoring new fields behaves as before | A new major identity; a structural re-shape |
| T-10 | Caps exceeded (65 sessions / 17 agents / 17 models / 25 tools) | `HarnessTruncation` marks `{truncated: true, omitted, cap}` at the exact caps 64 / 16 / 16 / 24 | A silent drop; an uncounted omission |
| T-11 | Any read | `PRAGMA query_only = 1` recorded before the first `SELECT`; only bounded indexed statements; no `message`/`part` scan | A write, a schema mutation, a full scan |
| T-12 | Store seeded with prompt, transcript, diff, tool-output, credential and config canaries | No canary appears in any row, warning, or refusal envelope | Content leakage |
| T-13 | Per-step rows plus a session baseline | One totals basis: session totals equal the baseline once; seat breakdown sums equal the totals per class | Summing steps *and* the baseline into one total |
| T-14 | 2.1.x-shape store (durations and seat columns absent; identity and token fields present) | Rows land with degradation warnings and explicit duration absence; a session missing mandatory identity/token fields becomes a failed-session entry with its closed reason | Fabricated seat/duration; a zero-valued row; classifying a present-fields session as failed |

### 4.6 Conformance Scenario Matrix (binding for AC-F7-1..AC-F7-3)

| ID | Registry condition | Expected outcome | Never |
|---|---|---|---|
| C-01 | Delivered registry unchanged | `HARNESS_CONFORMANCE_SCENARIOS` is exactly the six delivered ids in order; both `opencode` and `claude-code` register every one; `harnessConformanceViolations` is `[]` | A renamed, reordered or removed floor scenario |
| C-02 | Extended registry | Each registration also declares exactly the five new ids: version-inside-window, version-outside-window, version-unknown, mode-unavailable, profile-propagation | A new id registered on only one harness without declaration |
| C-03 | One registration missing one new scenario | Violations contain a message naming the harness *and* the missing scenario; the suite fails | A silent pass; a message naming only one of the two |
| C-04 | A new refusal identity with no registered scenario | Violations name the identity; the suite fails | An identity that ships unexercised |
| C-05 | Each new scenario executed over simulated harness I/O | The scenario's expected verdict/identity is produced; the session-spawn seam double records 0 session starts for refusals | A live process; a store read |
| C-06 | Extension shape | The new scenarios resolve through the same registry functions and data declarations as the floor — no forked conformance module or parallel path | A second registry, a private code path |
| C-07 | CI execution | Zero sockets, zero live harness invocations, zero credentials; the suite runs inside `bun test tests/conformance` | Any network or process dependency |
| C-08 | One new scenario's guard disabled (mutant) | That scenario's oracle fails while its fixture is unchanged | A scenario that cannot fail |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Suite class | Scenario type | Level | Priority | AC coverage |
|-------|-------|-------------|---------------|-------|----------|-------------|
| TC-HARNESS-001 | In-window dispatch proceeds and carries one version verdict | behaviour | Happy Path | Integration | Critical | AC-F1-1 |
| TC-HARNESS-002 | **TC-M3-HARNESS-002** — out-of-window version refuses, no session spawned | behaviour | Negative | Integration | Critical | AC-F1-2, NFR-1 |
| TC-HARNESS-003 | Indeterminate or unparseable version refuses with the distinct unknown identity | behaviour | Negative | Unit/Behaviour | Critical | AC-F1-3, NFR-6 |
| TC-HARNESS-004 | Version verdict matrix: boundary and parse table | unit | Corner Case | Unit | High | AC-F1-1, AC-F1-2 |
| TC-HARNESS-005 | Window as data: pinned default and unusable-config degradation | unit | Edge Case | Unit/Behaviour | Critical | AC-F1-4 |
| TC-HARNESS-006 | One bounded probe per dispatch before any session; probe-failure warning preserved | behaviour | Regression | Integration | Critical | AC-F1-1, AC-F1-2, AC-F1-3, NFR-1, NFR-2 |
| TC-HARNESS-007 | Delivered default mode used with no runtime fallback | behaviour | Happy Path | Behaviour | Critical | AC-F2-1 |
| TC-HARNESS-008 | Unavailable requested mode refuses naming requested and available | behaviour | Negative | Behaviour | Critical | AC-F2-3, NFR-1 |
| TC-HARNESS-009 | Mode origin: omitted → `defaults`; unknown value → refusal, never default | behaviour | Edge Case | Behaviour | High | AC-F2-4 |
| TC-HARNESS-010 | Mode and adapter-contract decision records exist, agree with the default, and are linked | structure | Regression | Structure | Critical | AC-F2-2 |
| TC-HARNESS-011 | **TC-M3-HARNESS-001** — profile propagation into spawn plus seat-attributed rows | behaviour | Happy Path | Integration | Critical | AC-F3-1, AC-F5-1 |
| TC-HARNESS-012 | Record value beats a conflicting ambient parent value | unit | Happy Path | Unit/Behaviour | Critical | AC-F3-2 |
| TC-HARNESS-013 | Undeclared record names change nothing; no ambient forwarding; allowlist not widened | unit | Negative | Unit/Behaviour | Critical | AC-F3-3, NFR-9 |
| TC-HARNESS-014 | Unrepresentable required seat refuses naming the seat, no session | behaviour | Negative | Behaviour | Critical | AC-F3-4, NFR-1 |
| TC-HARNESS-015 | Propagation is per spawn, not process-global | behaviour | Corner Case | Behaviour | Important | AC-F3-1, AC-F3-2 |
| TC-HARNESS-016 | Spawn, deliver and resume share one propagation contract | behaviour | Regression | Integration | High | AC-F3-1, AC-F4-1 |
| TC-HARNESS-017 | Resume continues identity and preserves the tree root | behaviour | Happy Path | Behaviour | High | AC-F4-1 |
| TC-HARNESS-018 | Attach resolves from a bounded listing, spawns nothing, and keeps unknown-session semantics | behaviour | Edge Case | Behaviour | High | AC-F4-1 |
| TC-HARNESS-019 | Row shape: schema identity, harness version, seat, both models, tokens, calls, cost, durations | behaviour | Happy Path | Contract/Behaviour | Critical | AC-F5-1 |
| TC-HARNESS-020 | Pre-change rows stay readable and unchanged; additive only | behaviour | Regression | Contract/Behaviour | Critical | AC-F5-2 |
| TC-HARNESS-021 | Model divergence disclosed with both values kept, never overwritten | behaviour | Edge Case | Behaviour | Critical | AC-F5-3 |
| TC-HARNESS-022 | Missing duration is explicitly absent, never derived from capture time | behaviour | Negative | Behaviour | Critical | AC-F5-4, NFR-6 |
| TC-HARNESS-023 | Absence is `harness.telemetry.absent` at exit 1 with no zero-valued row | behaviour | Negative | Behaviour | Critical | AC-F6-1 |
| TC-HARNESS-024 | Unreadable store keeps `harness.telemetry.extraction-failed`, never absence | behaviour | Negative | Behaviour | Critical | AC-F6-2 |
| TC-HARNESS-025 | Bounded read discipline: query-only pragma, indexed queries, exact caps, truncation marks | behaviour | Regression | Behaviour | High | NFR-3 |
| TC-HARNESS-026 | One totals basis: seat attribution does not double count | behaviour | Corner Case | Behaviour | High | AC-F5-1 |
| TC-HARNESS-027 | Privacy: identity, counts, cost and durations only | behaviour | Regression | Behaviour/Checks | High | NFR-5, NFR-9 |
| TC-HARNESS-028 | 2.1.x store shape degrades with warnings, never fabricates | behaviour | Edge Case | Behaviour | High | AC-F5-1, AC-F5-4, NFR-6 |
| TC-HARNESS-029 | Byte-identical determinism and zero network or model calls | behaviour | Regression | Checks | High | NFR-7 |
| TC-HARNESS-030 | Bounded output with marked truncation; refusal identity and hint never truncated | behaviour | Corner Case | Behaviour | High | NFR-4 |
| TC-HARNESS-031 | Delivered six-scenario classification floor unchanged and passing | conformance | Regression | Conformance | Critical | AC-F7-1 |
| TC-HARNESS-032 | Missing new scenario or unexercised identity fails and names both | conformance | Negative | Conformance | Critical | AC-F7-2 |
| TC-HARNESS-033 | New scenarios execute over simulated I/O and prove their property | conformance | Happy Path | Conformance | Critical | AC-F7-2, AC-F7-3 |
| TC-HARNESS-034 | Conformance runs offline with zero live harness invocations | conformance | Regression | Checks | Critical | AC-F7-3, NFR-10 |
| TC-HARNESS-035 | Refusal identity contract: one row per identity, stable code, derived exit, hint present | structure | Regression | Structure/Checks | Critical | AC-N1-1 |
| TC-HARNESS-036 | Refusals leave no session-bearing side effect | negative | Negative | Integration | Critical | AC-N1-1, NFR-1 |
| TC-HARNESS-037 | Gate composition does not disturb the delivered stream, handle or bounds behaviour | behaviour | Regression | Integration | High | NFR-8 |
| TC-HARNESS-038 | Mutant meta-suite over every new honesty rule | fixture | Regression | Checks (mutation) | Critical | AC-F1-2, AC-F1-3, AC-F1-4, AC-F2-1, AC-F3-2, AC-F3-3, AC-F3-4, AC-F5-3, AC-F5-4, AC-F6-1, AC-F6-2, AC-F7-2 |
| TC-HARNESS-039 | Whole-change offline hermetic posture | fixture | Regression | Checks | Critical | NFR-10 |
| TC-HARNESS-040 | Dispatch outcome discloses the version verdict and the selected mode | behaviour | Happy Path | Behaviour | Important | AC-F1-1, AC-F2-1 |
| TC-HARNESS-041 | Documentation and conformance reconciliation for window, mode, propagation and seat telemetry | structure | Regression | Manual + Structure | Important | AC-F2-2 |

### 5.2 Scenario Details

#### TC-HARNESS-001 - In-window dispatch proceeds and carries one version verdict

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, DM-1, DM-2
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: harness resolution seam (`packages/core/src/domain/harness-registry.ts` plus the new window evaluation module); `tests/behaviour/harness-version-gate.test.ts`
**Tags**: @offline, @harness, @version-gate

**Preconditions**:

- Injected version probe returning `2.2.5`; a resolved profile with two seats; a recording streaming-spawn double.
- Injected clock and ids; the pinned window default (V-01 in §4.4).

**Steps**:

1. Resolve the harness with the in-window probe result and a resolved profile.
2. Assert the resolved instance carries `observedVersion === "2.2.5"` and a verdict equal to the declared *inside* constant (DM-2).
3. Assert no `versionWarning` is set, and that resolution did not refuse.
4. Spawn one session through the port and assert the session-spawn seam was called exactly once.

**Expected Outcome**:

- The dispatch proceeds; the instance carries the observation and one verdict; downstream consumers read the verdict from the instance rather than re-deriving it.

**Binding oracle**:

- `instance.observedVersion === "2.2.5"`; `instance.versionVerdict === INSIDE` (declared constant); `instance.versionWarning === undefined`; session-spawn seam `calls === 1`; exit `0`; zero refusal envelope.

**Postconditions**:

- Temp root discarded; no writes outside it.

**Notes / Clarifications**:

- The verdict field name and the three verdict values are declared once in the contract module (GAP-5); this plan asserts through those constants.

#### TC-HARNESS-002 - Pinned TC-M3-HARNESS-002: out-of-window version refuses with no session

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-2, NFR-1, DM-1, DM-2, RSK-2
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: harness resolution + refusal projection; `tests/behaviour/harness-version-gate.test.ts` (matrix M-01, V-04)
**Tags**: @offline, @harness, @version-gate, @refusal

**Preconditions**:

- Injected probe returning `2.3.0` (outside `2.2.x` + `2.1.x`); a paired in-window fixture (`2.2.5`) in the same test.
- A recording streaming-spawn double and a recording telemetry-append seam.

**Steps**:

1. Attempt a dispatch with the out-of-window probe result.
2. Assert the refusal identity, projection class and exit from matrix M-01.
3. Assert the envelope carries the observed version and a remediation hint naming both supported lines.
4. Assert the session-spawn seam call count is `0`, the telemetry append count is `0`, and the store write count is `0`.
5. Mutate the observed version to `2.2.5` on the same fixture and assert the dispatch proceeds (non-vacuity per §4.2 rule 2).

**Expected Outcome**:

- The pinned scenario holds verbatim: an out-of-window version refuses with `harness.version.unsupported` and no session is spawned; the fix is an upgrade named in the hint.

**Binding oracle**:

- `error.code === "harness.version.unsupported"`; `projectionClass === "user-validation"`; exit `1`; envelope `schemaVersion === "delivery.result.v1"`; `remediationHint` non-empty and contains the supported lines; session-spawn seam `calls === 0`; telemetry appends `0`; store writes `0`.

#### TC-HARNESS-003 - Indeterminate version refuses with the distinct unknown identity

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-3, NFR-6, DM-2, DEC-3
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: probe + verdict classification; `tests/behaviour/harness-version-gate.test.ts` (matrix M-02, V-07..V-09)
**Tags**: @offline, @harness, @version-gate, @refusal

**Preconditions**:

- Four probe variants: throws; returns `""`; returns `2.two.5`; returns `latest`. A paired passing probe control.

**Steps**:

1. Resolve the harness for each variant.
2. Assert the refusal identity is `harness.version.unknown` and that it is **not** `harness.version.unsupported` (explicit distinctness assertion).
3. Assert the instance-level observation remains `null` and the delivered warning is exactly `version-probe-failed`.
4. Assert no version string is fabricated anywhere in the envelope, the instance, or the recorded facts.
5. Assert the paired passing probe resolves inside and spawns.

**Expected Outcome**:

- An undeterminable version is its own classified condition with its own identity; the observation stays the explicit unknown; nothing is guessed and nothing proceeds silently (DEC-3, NFR-6).

**Binding oracle**:

- `error.code === "harness.version.unknown"`; `error.code !== "harness.version.unsupported"`; `observedVersion === null`; `versionWarning === "version-probe-failed"`; exit `1`; session-spawn seam `calls === 0`; no string matching a version pattern in the serialized envelope beyond the identity text.

#### TC-HARNESS-004 - Version verdict matrix: boundary and parse table

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F1-2, DM-1, DM-2
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: window evaluation and version parsing; `tests/behaviour/harness-version-window.test.ts` + `tests/structure/harness-version-window-contract.test.ts`
**Tags**: @offline, @harness, @version-gate

**Preconditions**:

- The declared version table fixture (V-01..V-09) and the accepted-grammar constant.

**Steps**:

1. Iterate every table row and assert the verdict, identity and exit match exactly.
2. Assert the parse-acceptance constant and the table agree: every accepted form appears in the table, every rejected form is `indeterminate`.
3. Assert both minor lines of the window are represented (`2.2.0`, `2.2.5`, `2.1.7`) and both immediate outsides (`2.0.9`, `2.3.0`).
4. Assert a version that merely *contains* a supported prefix (`2.20.0`, `12.2.5`) is outside or unknown — never inside.

**Expected Outcome**:

- Boundary behavior is pinned as data, not as incidental parsing behavior; prefix-shaped near-misses never pass.

**Binding oracle**:

- Per row: verdict, identity and exit as tabulated; `2.20.0` and `12.2.5` are not *inside*.

#### TC-HARNESS-005 - Window as data: pinned default and unusable-config degradation

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-4, DM-1, DEC-1, RSK-2
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: window policy constants; `tests/behaviour/harness-version-window.test.ts` + `tests/structure/harness-version-window-contract.test.ts` (V-11, V-12)
**Tags**: @offline, @harness, @version-gate

**Preconditions**:

- The declared pinned window constant. Configured-window variants: absent; empty string; `"2"`; `">=2"`; a value selecting a line older than `2.1`.

**Steps**:

1. Assert the pinned constant is exactly the current minor line plus one previous minor (`2.2` + `2.1` at intake) and is the only place acceptance widens.
2. With no configured value, assert the pinned default applies (`2.2.5` inside, `2.3.0` outside).
3. For each malformed or unsupported configured value, assert the pinned default applies — never an unbounded window — by asserting `2.3.0` still refuses and `9.9.9` still refuses.
4. Assert no configured value can widen acceptance beyond the pinned constant in this change.

**Expected Outcome**:

- A pinned, testable default governs acceptance; a configuration path cannot accidentally widen it (DEC-1, RSK-2).

**Binding oracle**:

- `WINDOW === {lines: ["2.2", "2.1"]}`; for every unusable-config variant: `2.3.0 → harness.version.unsupported`, `9.9.9 → harness.version.unsupported`, exit `1`.

#### TC-HARNESS-006 - One bounded probe per dispatch before any session; warning preserved

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, AC-F1-2, AC-F1-3, NFR-1, NFR-2, RSK-8
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: version probe seam and its ordering; `tests/behaviour/harness-version-probe-bound.test.ts`
**Tags**: @offline, @harness, @version-gate, @bound

**Preconditions**:

- A recording child-process double for the probe (args, environment, invocation count) and a separate recording session-spawn double.
- A fake clock able to advance past 5 000 ms.

**Steps**:

1. Run one dispatch and assert the probe is invoked exactly once, shell-free (no shell argument, no prompt, no session args), and before any session-spawn call.
2. Assert the probe-invocation ordering flag recorded by the double is "probe, then session" for the in-window case and "probe, then nothing" for the refusal cases.
3. Advance the fake clock by 5 001 ms without a probe answer and assert the verdict is `indeterminate` with identity `harness.version.unknown`, invocation count still `1`, and no retry loop.
4. Assert a failing probe preserves the delivered `version-probe-failed` instance warning while the dispatch-level consequence is the refusal.
5. Record a local reference measurement of probe duration in §10 (non-CI, GAP-3).

**Expected Outcome**:

- The gate is evaluated once, bounded, before any session; failure is classified, never retried, never fabricated (NFR-2, RSK-8 mitigation proven).

**Binding oracle**:

- Probe seam `calls === 1`; probe args contain no shell and no prompt; session-spawn seam `calls === 0` on refusal; on the 5 001 ms advance: `error.code === "harness.version.unknown"`, exit `1`, probe `calls === 1`; on failure: `versionWarning === "version-probe-failed"`.

#### TC-HARNESS-007 - Delivered default mode used with no runtime fallback

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-1, DM-3, DEC-2, NG-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: mode resolution and the opencode dispatch path; `tests/behaviour/harness-mode-selection.test.ts`
**Tags**: @offline, @harness, @mode

**Preconditions**:

- No mode configured; recording doubles for every declared transport (per-spawn CLI invocation, service start, API client).

**Steps**:

1. Resolve settings and spawn one session.
2. Assert the resolved mode equals the declared default-mode constant.
3. Assert exactly one transport family recorded a call and it is the default's family; assert zero service starts and zero API client constructions.
4. Make the default transport fail; assert the failure is the default mode's classified outcome and that no alternate transport was attempted afterwards.
5. Assert the recovered outcome does not silently switch mode (the recorded mode on the outcome equals the resolved mode).

**Expected Outcome**:

- The declared default is the only mode a dispatch uses, and a transport failure is reported rather than papered over by a fallback (DEC-2, NG-2).

**Binding oracle**:

- `resolvedMode === DEFAULT_MODE` (declared constant, OQ-1 answer); default transport `calls === 1`; every other transport `calls === 0`; on failure exit and identity are the default mode's classified outcome; recorded `mode === resolvedMode` in both cases.

#### TC-HARNESS-008 - Unavailable requested mode refuses naming requested and available

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-3, DM-3, NFR-1, DEC-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: mode resolution refusal; `tests/behaviour/harness-mode-refusal.test.ts` (matrix M-03)
**Tags**: @offline, @harness, @mode, @refusal

**Preconditions**:

- A configured mode equal to each of the two non-default declared modes in turn; a recording spawn seam; a paired default-mode control.

**Steps**:

1. Resolve settings with a non-default mode requested and attempt a dispatch.
2. Assert the refusal identity, projection class and exit per M-03.
3. Assert the envelope names both the requested mode and the available mode (declared fields, GAP-5 constants).
4. Assert the session-spawn seam call count is `0` and no transport double recorded a call.
5. Run the paired default-mode control and assert it spawns.

**Expected Outcome**:

- An unavailable mode is a classified, actionable refusal before any spawn, and the operator learns both the request and the available alternative (AC-F2-3).

**Binding oracle**:

- `error.code === "harness.mode.unavailable"`; `projectionClass === "user-validation"`; exit `1`; structured error carries requested `"background-service"` (and the other non-default value) and available `DEFAULT_MODE`; all transport calls `0`.

#### TC-HARNESS-009 - Mode origin and unknown-value refusal

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-4, DM-3
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: typed `harness` configuration branch + mode resolution; `tests/behaviour/harness-mode-config.test.ts` (matrix M-04)
**Tags**: @offline, @harness, @mode, @config

**Preconditions**:

- Config fixtures: branch absent; branch with the default mode explicitly set; branch with an unknown value (`"daemon"`), a wrong-typed value, and an empty string.

**Steps**:

1. With the branch absent, resolve settings and assert the mode equals the default and its origin equals `defaults`.
2. With the default set explicitly, assert origin equals `configured` and the same mode value.
3. For each unknown or malformed value, assert a refusal (never a silent default) and that no spawn occurred.
4. Assert the resolved mode is never inferred from ambient state: an ambient variable shaped like a mode is injected and must change nothing (NFR-9).

**Expected Outcome**:

- The mode is a declared value with an observable origin; an unknown value is refused rather than defaulted; ambient state cannot select a mode (AC-F2-4).

**Binding oracle**:

- Absent → `mode === DEFAULT_MODE` and `origin === "defaults"`; explicit → `origin === "configured"`; unknown `"daemon"` → `error.code === "config.value.invalid"` (OQ-5 default), exit `1`, spawn calls `0`; ambient canary changes nothing.

#### TC-HARNESS-010 - Mode and adapter-contract decision records exist, agree with the default, and are linked

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-2, G-8, DEC-7, DM-3
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated structural assertions + manual content review
**Target Layer / Location**: `doc/decisions/`, `doc/spec/features/feature-harness-adapters.md`; `tests/checks/decision-record.test.ts` (extend the inventory)
**Tags**: @offline, @docs, @decision

**Preconditions**:

- The delivered per-type identifier convention (`TYPE-NNNN-slug.md` under `doc/decisions/`) and the decision-record contract test.

**Steps**:

1. Assert a mode decision record and an adapters-contract decision record exist and follow the identifier convention, with `Proposed` or `Accepted` status.
2. Assert the mode record states a chosen mode that equals the delivered default-mode constant (the same constant TC-HARNESS-007 asserts) and that the chosen mode is one of exactly standalone service, background service, direct API.
3. Assert the mode record states the read-only direct-store rationale.
4. Assert the harness feature spec links the record and that `doc/decisions/00-index.md` lists it.
5. Assert the decision-record conformance test passes with both new entries.

**Expected Outcome**:

- The decision precedes the behavior it governs and cannot drift from the code: the record's chosen mode and the default constant are asserted equal (DEC-7; correctness is human-gated — GAP-4).

**Binding oracle**:

- Both record files exist under the convention; mode record `chosenMode === DEFAULT_MODE`; chosen mode ∈ `{standalone service, background service, direct API}`; read-only direct-store rationale present; `feature-harness-adapters.md` contains a link to the mode record; index row present; `tests/checks/decision-record.test.ts` green.

#### TC-HARNESS-011 - Pinned TC-M3-HARNESS-001: profile propagation plus seat-attributed rows

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, F-5, AC-F3-1, AC-F5-1, DM-4, DM-5, DM-6
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: spawn descriptor construction, spawn seam and telemetry extraction; `tests/behaviour/harness-profile-propagation.test.ts` + `harness-telemetry-seat-attribution.test.ts`
**Tags**: @offline, @harness, @profile, @telemetry

**Preconditions**:

- A resolved profile with three seats having distinct resolved models and declared variable names (one seat using an explicit `envName`).
- A recording streaming-spawn double that echoes the child environment it received; a fixture-seeded store exposing seat, model, tokens and cost for the three seats.

**Steps**:

1. Spawn one session through the port with the resolved profile.
2. Assert the spawn descriptor's environment records name each declared seat variable with exactly its resolved model value.
3. Assert the echoed child environment the spawn seam received carries the same three name/value pairs.
4. Collect evidence and assert the session reports the resolved model for all three seats.
5. Land telemetry rows and assert three seat-attributed rows with non-null tokens and cost, zero unattributed seats, and the schema identity on every row (`TC-HARNESS-019` supplies the full field assertions).

**Expected Outcome**:

- The pinned scenario holds: the session reports the resolved per-seat models and emits versioned rows carrying those seats with tokens and cost; zero seats are unattributed.

**Binding oracle**:

- Descriptor record names/values equal the resolved profile exactly (3/3); echoed child env equal (3/3); reported seat models equal resolved models (3/3); rows `count === 3` with distinct seat identities; every row `schemaId === "delivery.harness.telemetry.v1"`; `tokens` non-null; `cost` non-null; unattributed seats `0`; session-spawn seam `calls === 1`.

**Notes / Clarifications**:

- GAP-2: this proves propagation *to* the harness. A real harness honouring the variable family is the in-change spike's evidence, not this test's.

#### TC-HARNESS-012 - Record value beats a conflicting ambient parent value

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, DM-4, NFR-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: deny-by-default environment builder (`packages/core/src/domain/harness-spawn-env.ts`) with a profile record map; `tests/behaviour/harness-profile-precedence.test.ts` (matrix P-02)
**Tags**: @offline, @harness, @profile, @spawn-env

**Preconditions**:

- A descriptor declaring the seat variable; an injected parent environment carrying a conflicting value (`canary-ambient-model`); a resolved record value (`synthetic/model-resolved`).

**Steps**:

1. Build the child environment with both values present.
2. Assert the built entry equals the resolved record value.
3. Assert the ambient conflicting value appears nowhere in the built environment or in serialized evidence.
4. Run the paired control: the record omits that name and the declared parent value is used unchanged.

**Expected Outcome**:

- The resolved profile is authoritative for a declared name, and a stale ambient value cannot override it (AC-F3-2).

**Binding oracle**:

- `childEnv[SEAT_VAR] === "synthetic/model-resolved"`; `"canary-ambient-model"` absent from the built environment and from serialized evidence; control: `childEnv[SEAT_VAR] === parentValue`.

#### TC-HARNESS-013 - Undeclared record names change nothing; no ambient forwarding

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-3, NFR-9, RSK-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: deny-by-default environment builder; `tests/behaviour/harness-profile-neutrality.test.ts` (with the delivered `harness-spawn-env.test.ts` assertions unchanged)
**Tags**: @offline, @harness, @profile, @spawn-env

**Preconditions**:

- A record map containing a name outside the allowlist (`OC_ADOS_AGENT_REVIEWER_MODEL` style) with a unique value; the parent environment carrying unique undeclared canaries, including one shaped like a model variable.

**Steps**:

1. Build the child environment.
2. Assert `Object.keys(childEnv)` equals exactly the declared allowlist set — the undeclared record name added nothing and nothing was removed.
3. Assert every undeclared canary (including the model-shaped decoy) is absent.
4. Assert the allowlist itself is unchanged (same length and same names) after the build.
5. Assert the delivered deny-by-default assertions still hold unchanged.

**Expected Outcome**:

- The record map supplies values only for already-declared names; adding profile data never widens the environment (AC-F3-3, RSK-6 mitigation proven).

**Binding oracle**:

- `sorted(Object.keys(childEnv)) === sorted(declaredNames)`; undeclared record name absent; all canaries absent; allowlist length unchanged; delivered `harness-spawn-env.test.ts` green.

#### TC-HARNESS-014 - Unrepresentable required seat refuses naming the seat, no session

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-4, DM-4, NFR-1, DEC-6, RSK-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: spawn preparation and refusal projection; `tests/behaviour/harness-profile-unrepresentable.test.ts` (matrix M-05)
**Tags**: @offline, @harness, @profile, @refusal

**Preconditions**:

- Three unrepresentable variants: a required seat whose model value is empty; whose declared name is not a valid environment variable name; whose model cannot be expressed in the declared variable family and which declares no honoured `envName`.
- A recording spawn seam and a paired representable-seat control.

**Steps**:

1. Prepare each spawn and assert the refusal identity, projection class and exit per M-05.
2. Assert the structured error names the offending seat (declared naming field, GAP-5 constant).
3. Assert the session-spawn seam call count is `0` and no partial environment was handed to any seam.
4. Assert no telemetry row was written.
5. Run the paired representable control and assert it spawns with the full profile.

**Expected Outcome**:

- A partial profile is refused rather than delivered under the wrong seat; the identity names the seat so the fix is actionable (DEC-6).

**Binding oracle**:

- `error.code === "harness.profile.model-unrepresentable"`; projection class `user-validation` (OQ-5 default); exit `1`; seat identifier present in the structured error; spawn calls `0`; telemetry rows `0`; control spawns with 3/3 seats.

#### TC-HARNESS-015 - Propagation is per spawn, not process-global

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Important
**Related IDs**: F-3, AC-F3-1, AC-F3-2, DM-4
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: spawn descriptor construction and composition lifetime; `tests/behaviour/harness-profile-per-spawn.test.ts`
**Tags**: @offline, @harness, @profile

**Preconditions**:

- Two resolved profiles A and B differing in one seat's model; one shared composition instance reused for both spawns.

**Steps**:

1. Spawn with A, then with B on the same composition, asserting each spawn descriptor carries its own profile's value.
2. Repeat in reverse order (B then A) and assert the values follow the profiles, not the order.
3. Spawn concurrently with A and B and assert neither descriptor is contaminated by the other.
4. Assert no module-level mutable state carries a profile value: after both spawns, a third spawn with no profile declares no seat record.

**Expected Outcome**:

- Propagation is a per-spawn data contract; a previous spawn cannot leak its profile into the next (F-3).

**Binding oracle**:

- Spawn 1 `childEnv[SEAT_VAR] === modelA`; spawn 2 `=== modelB`; reversed order swaps accordingly; concurrent spawns each correct; profile-free spawn has no seat key.

#### TC-HARNESS-016 - Spawn, deliver and resume share one propagation contract

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-1, AC-F4-1, DM-4
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: opencode adapter paths (`packages/adapters/src/harness/opencode.ts`); `tests/behaviour/harness-resume-propagation.test.ts`
**Tags**: @offline, @harness, @profile, @resume

**Preconditions**:

- One resolved profile; a recording spawn double for spawn, deliver and resume; the delivered resume acquisition fixtures.

**Steps**:

1. Spawn, deliver and resume with the same profile.
2. Assert the three constructed environments are canonically byte-identical (`canonicalHarnessJson`).
3. Assert the resume that supplies the original descriptor reuses it rather than re-deriving a different map.
4. Assert a resume whose descriptor is absent rebuilds an environment equal to the original.

**Expected Outcome**:

- A resumed or delivered session runs the profile its spawn declared; the contract is one contract, not three (F-4).

**Binding oracle**:

- `canonical(envSpawn) === canonical(envDeliver) === canonical(envResume)`; all three carry the same seat name/value pairs; zero divergence.

#### TC-HARNESS-017 - Resume continues identity and preserves the tree root

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-4
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: opencode resume path; `tests/behaviour/harness-resume-propagation.test.ts`
**Tags**: @offline, @harness, @resume

**Preconditions**:

- A spawned handle with `sessionId` S and `treeRoot` equal to the work-item ref; the committed resume stream fixture.

**Steps**:

1. Resume the handle and assert the acquired identity equals S and the tree root is unchanged.
2. Assert the profile propagation is identical to the spawn (TC-HARNESS-016).
3. Assert no second root is created: the handle reported after resume has the same `treeRoot` and the same work-item ref.
4. Assert the stream still drains to completion and collection returns completion-scoped evidence.

**Expected Outcome**:

- A resume continues the caller's session with its profile and root intact (F-4).

**Binding oracle**:

- `resumedHandle.sessionId === S`; `resumedHandle.treeRoot === workItemRef`; propagation equal to spawn; completion evidence present; exit `0`.

#### TC-HARNESS-018 - Attach resolves from a bounded listing, spawns nothing, keeps unknown-session semantics

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: session listing + resume; `tests/behaviour/harness-attach.test.ts` (matrix M-08)
**Tags**: @offline, @harness, @attach

**Preconditions**:

- A listed handle for the work item; a listing with more entries than the cap; a listing that does not contain the requested identity; a recording spawn seam and a recording kill double.

**Steps**:

1. Attach to an existing session and assert the listing was called exactly once with the declared cap, the resolved handle equals the listed identity, and the session-spawn seam call count is `0`.
2. Assert the truncated listing carries its explicit truncation mark when over cap and still resolves a contained identity.
3. Attach to an absent or different identity and assert `harness.session.unknown`, exit 1, and that kill was invoked exactly once and is idempotent on a second call.
4. Assert no orphan survives (the recorded double reports no live child) and no new root was created.

**Expected Outcome**:

- Attach is a read-only lookup plus resume, never a spawn; an unknown session keeps its delivered semantics with an idempotent kill (AC-F4-1).

**Binding oracle**:

- Listing `calls === 1` with cap constant; spawn `calls === 0`; resolved handle identity equal; over-cap listing has `{truncated: true, omitted, cap}`; unknown/different → `error.code === "harness.session.unknown"`, exit `1`, kill `calls === 1`, second kill no-op, live children `0`.

#### TC-HARNESS-019 - Row shape: schema identity, harness version, seat, both models, tokens, calls, cost, durations

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-5, DM-6, NFR-6
**Test Type(s)**: Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: telemetry row contract and opencode extractor; `tests/behaviour/harness-telemetry-seat-attribution.test.ts` + `harness-telemetry-shape.test.ts` (update); `tests/structure/harness-contract.test.ts`
**Tags**: @offline, @telemetry, @contract

**Preconditions**:

- The complete store variant (T-01) with literal token, call, cost and duration values; an injected `capturedAt`.

**Steps**:

1. Extract and assert every mandatory field against the hand-written fixture constants.
2. Assert `schemaId` equals the delivered constant exactly, `harnessKind` is `opencode`, and `harnessVersion` equals the store's version.
3. Assert the seat identity, resolved model and observed model fields are present and equal to their distinct fixture values.
4. Assert the five token classes, `calls`, `cost`, and the three duration fields equal the fixture literals.
5. Assert the contract module exposes exactly the declared field names and the token-class set is still exactly five.

**Expected Outcome**:

- The ticket's "schema version and per-seat models" is a row field set, not a claim: every mandatory field is present with the exact seeded value (AC-F5-1).

**Binding oracle**:

- `schemaId === "delivery.harness.telemetry.v1"`; `harnessVersion === "2.2.5"`; `seat === "reviewer"`; `resolvedModel === "synthetic/model-a"`; `observedModel === "synthetic/model-a"`; `tokens === {input: 11, output: 22, reasoning: 3, cacheRead: 4, cacheWrite: 5}` (fixture literals); `calls === 7`; `cost === 1.25`; `durations === {start: T0, end: T0+3000, elapsed: 3000}`; `warnings === []`.

#### TC-HARNESS-020 - Pre-change rows stay readable and unchanged; additive only

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-2, DEC-4, NG-3, NG-4
**Test Type(s)**: Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: telemetry read path and golden rows; `tests/behaviour/harness-telemetry-version-compat.test.ts` (T-08, T-09)
**Tags**: @offline, @telemetry, @compat

**Preconditions**:

- A committed pre-change row fixture captured under the delivered GH-291/GH-233 shape (no seat, no durations, no resolved model), plus a paired post-change row.

**Steps**:

1. Read the legacy row through the post-change reader and assert it is returned unchanged: same schema identity, same field set, new fields absent.
2. Assert re-serialization is canonically byte-identical to the committed fixture.
3. Assert `HARNESS_TELEMETRY_SCHEMA_ID` is unchanged and no new major identity exists in the contract.
4. Assert no backfill occurred: the legacy row still has no seat and no duration, and the read did not mutate it.
5. Assert a post-change row is readable by a reader that ignores the new fields (the compatibility direction that matters for old consumers).

**Expected Outcome**:

- Zero removals or renames; pre-change rows are readable and unchanged; the new fields are additions a legacy reader can ignore (AC-F5-2, DEC-4).

**Binding oracle**:

- Legacy row canonical JSON equal to the committed golden; `schemaId === "delivery.harness.telemetry.v1"`; seat/durations/resolvedModel absent in the legacy row; no mutation (store byte count unchanged); post-change row read by the ignoring projection yields the legacy field set.

#### TC-HARNESS-021 - Model divergence disclosed with both values kept

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-3, DM-5, DEC-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: extractor and row landing; `tests/behaviour/harness-telemetry-divergence.test.ts` (T-05, T-06)
**Tags**: @offline, @telemetry, @divergence

**Preconditions**:

- A store reporting `synthetic/model-b` while the spawn profile resolved `synthetic/model-a`; a paired agreeing fixture.

**Steps**:

1. Land the row and assert `resolvedModel === "synthetic/model-a"` and `observedModel === "synthetic/model-b"` — both present and distinct.
2. Assert the divergence warning is present and its reason is a member of `HARNESS_WARNING_REASONS` (the declared constant set).
3. Assert neither value was overwritten in either direction, and the stored row keeps both.
4. Run the paired agreeing fixture and assert no divergence warning appears.

**Expected Outcome**:

- Divergence is evidence, not noise: both the intent and the observation survive, and silence about it is impossible when they differ (DEC-5).

**Binding oracle**:

- `resolvedModel !== observedModel` and both equal their seeded values; divergence reason ∈ `HARNESS_WARNING_REASONS`; agreement control has no divergence reason.

#### TC-HARNESS-022 - Missing duration is explicitly absent, never derived

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-4, DM-6, NFR-6, RSK-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: extractor duration projection; `tests/behaviour/harness-telemetry-durations.test.ts` (T-02)
**Tags**: @offline, @telemetry, @durations

**Preconditions**:

- The missing-duration store variant; the complete variant as control; `capturedAt` present in both.

**Steps**:

1. Land the row from the missing-duration store and assert the duration fields are absent, not `0` and not a number.
2. Assert a warning with the declared duration-absence reason from the closed vocabulary.
3. Assert that mutating `capturedAt` by +10 minutes does not change any duration value (it stays absent) — proving nothing is derived from capture time.
4. Run the complete control and assert `{start, end, elapsed}` equal the fixture literals.

**Expected Outcome**:

- Absence stays absence; a duration is never manufactured from timestamps or estimated (AC-F5-4, NFR-6).

**Binding oracle**:

- Missing-duration row: duration fields absent (`undefined`), no numeric duration anywhere in the row; warning reason ∈ `HARNESS_WARNING_REASONS`; `capturedAt` mutation leaves durations absent; control `elapsed === 3000` exactly.

#### TC-HARNESS-023 - Absence is `harness.telemetry.absent` at exit 1 with no zero-valued row

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: telemetry read/request path; `tests/behaviour/harness-telemetry-absent.test.ts` (matrix M-06)
**Tags**: @offline, @telemetry, @absence

**Preconditions**:

- A healthy store with zero rows for the requested session; a paired store with one row; a recording state-append seam.

**Steps**:

1. Request telemetry for the empty session and assert the identity, projection class and exit per M-06.
2. Assert the append seam recorded zero appends — no zero-valued row was produced.
3. Assert no report or table with zero figures is rendered anywhere in the output.
4. Assert the identity differs from `spend.telemetry-absent` (the delivered read-side meaning is untouched, not reused as a harness identity).
5. Run the paired one-row control and assert a row lands and the invocation succeeds.

**Expected Outcome**:

- Absence is a classified condition at exit 1, and a zero-valued row can never masquerade as data (AC-F6-1).

**Binding oracle**:

- `error.code === "harness.telemetry.absent"`; `error.code !== "spend.telemetry-absent"`; `projectionClass === "user-validation"`; exit `1`; appends `0`; no `0` token or cost figure in the output; control appends `1` and exits `0`.

#### TC-HARNESS-024 - Unreadable store keeps `harness.telemetry.extraction-failed`, never absence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-2, NFR-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: store open/read failure classification; `tests/behaviour/harness-telemetry-extraction-failure.test.ts` (matrix M-07)
**Tags**: @offline, @telemetry, @failure-taxonomy

**Preconditions**:

- Four damaged variants: nonexistent path; permission-denied; not-a-database content; torn/invalid schema. A paired healthy store.

**Steps**:

1. Request telemetry for each damaged store and assert the delivered identity, projection class and exit per M-07.
2. Assert no variant returns `harness.telemetry.absent` (the taxonomy boundary is explicit).
3. Assert no row was written and no partial report rendered.
4. Assert the delivered damaged-store assertions (`harness-telemetry-opencode`, `harness-telemetry-shape`) still hold unchanged.
5. Run the healthy control and assert success.

**Expected Outcome**:

- Damage stays damage; absence is never used as a catch-all, so an operator fixes the right thing (AC-F6-2).

**Binding oracle**:

- `error.code === "harness.telemetry.extraction-failed"` for all four variants; `projectionClass === "platform-provider"`; exit `2`; never `harness.telemetry.absent`; appends `0`; healthy control exit `0`.

#### TC-HARNESS-025 - Bounded read discipline: query-only pragma, indexed queries, exact caps, truncation marks

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-3, RSK-4, NG-5
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: opencode store loader (`packages/adapters/src/harness/sqlite-loader.ts`, `telemetry-opencode.ts`); `tests/behaviour/harness-telemetry-bounds.test.ts` (T-10, T-11)
**Tags**: @offline, @telemetry, @bounds, @readonly

**Preconditions**:

- A recording store double capturing every statement in order; fixture stores exceeding each cap (65 sessions, 17 agents, 17 models, 25 tools).

**Steps**:

1. Read a store and assert the first recorded statement enables the query-only pragma before any `SELECT`.
2. Assert every recorded statement is bounded and indexed per the declared allowlist; assert no statement touches message or part tables.
3. For each cap, assert the truncation mark is `{truncated: true, omitted: n, cap: N}` with N equal to 64 / 16 / 16 / 24 and `n` the hand count.
4. Assert an at-cap store produces no truncation mark (paired control).
5. Assert the open mode is read-only and no write statement was recorded.

**Expected Outcome**:

- The read budget is unchanged and the new fields add no scan, no write, and no silent drop (NFR-3, NG-5).

**Binding oracle**:

- `statements[0]` is the query-only pragma; zero message/part statements; truncation objects exactly `{truncated: true, omitted: 1, cap: 64|16|16|24}` for the over-cap fixtures; at-cap fixtures have no mark; write statements `0`.

#### TC-HARNESS-026 - One totals basis: seat attribution does not double count

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, RSK-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: totals fold over step rows and the session baseline; `tests/behaviour/harness-telemetry-seat-totals.test.ts` (T-13)
**Tags**: @offline, @telemetry, @totals

**Preconditions**:

- A store/fixture with per-step rows for two seats and one session baseline, all hand-summed; the baseline equals the seat sums.

**Steps**:

1. Fold totals and assert each token class total equals the baseline value exactly — not the baseline plus the step sum.
2. Assert the seat breakdown sums equal the total per class.
3. Assert adding a seat dimension does not change the delivered totals reading basis (the delivered fold's basis is asserted unchanged).
4. Assert a fixture where the baseline is deliberately wrong still reports one basis (the baseline), with divergence disclosed rather than two conflicting totals.

**Expected Outcome**:

- Seat attribution is a dimension, not a second count: totals remain single-based and breakdowns reconcile to them (RSK-7 mitigation proven).

**Binding oracle**:

- `total.input === baseline.input`; `sum(perSeat.input) === total.input`; no doubled figure; one basis named; delivered totals assertions unchanged.

#### TC-HARNESS-027 - Privacy: identity, counts, cost and durations only

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-5, NFR-9, §20
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: rows, warnings and refusal envelopes; `tests/behaviour/harness-telemetry-privacy.test.ts` + `tests/checks/fixture-privacy.test.ts` + `tests/checks/privacy-literals.test.ts` (update if literals extend)
**Tags**: @offline, @privacy

**Preconditions**:

- A store seeded with unique canaries in message bodies, part text, diffs, tool output, credential-looking values, and a profile carrying a canary config value.

**Steps**:

1. Land rows and assert no canary appears in any row, warning, or serialized output.
2. Produce each refusal variant and assert no canary appears in any envelope.
3. Assert the delivered redaction chokepoint composes unchanged on the new disclosure paths.
4. Assert every new fixture passes the fixture-privacy scan.

**Expected Outcome**:

- Telemetry and refusals carry identity references, counts, cost and durations only (NFR-5, §20).

**Binding oracle**:

- Zero canary occurrences across rows, warnings and envelopes; redaction suite green; fixture-privacy scan green.

#### TC-HARNESS-028 - 2.1.x store shape degrades with warnings, never fabricates

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F5-4, NFR-6, RSK-4, OQ-3, GAP-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: extractor shape tolerance; `tests/behaviour/harness-telemetry-version-compat.test.ts` (T-14)
**Tags**: @offline, @telemetry, @degradation

**Preconditions**:

- A declared 2.1.x-shape store variant derived from the 2.2.5 shape with named removals: no duration columns, no seat column, identity and token fields present.
- A second variant missing mandatory identity or token fields; a paired complete 2.2.5 fixture.

**Steps**:

1. Land rows from the degrading variant and assert rows exist with the mandatory identity and token fields populated.
2. Assert the duration is explicitly absent with a warning and the seat is disclosed as unresolved with a count — never guessed.
3. Land the missing-mandatory variant and assert the affected session becomes a failed-session entry with a closed reason and no fabricated row.
4. Assert no zero-filled value appears anywhere in either variant.

**Expected Outcome**:

- The in-window older line survives with honest degradation, and only a session whose mandatory fields are absent is failed (OQ-3 default, RSK-4).

**Binding oracle**:

- Degrading variant: `records.length === expectedSessions`; durations absent + warning; unresolved seats count `> 0` and disclosed; missing-mandatory variant: `failedSessions` has one entry with a reason ∈ `HARNESS_WARNING_REASONS`; zero indices where absence should be.

#### TC-HARNESS-029 - Byte-identical determinism and zero network or model calls

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-7, NFR-9, §21
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: window evaluation, mode resolution, propagation construction, extraction and refusal render; `tests/checks/harness-determinism.test.ts` (update)
**Tags**: @offline, @determinism

**Preconditions**:

- One fixture set: probe result, store, resolved profile, injected clock and ids; a recording network/model-call seam.

**Steps**:

1. Run each evaluation, refusal and extraction path twice with identical injected inputs and assert canonical output is byte-identical.
2. Shuffle store row order and assert identical canonical output.
3. Assert zero recorded network opens and zero model calls on every path.
4. Assert no ambient clock, environment or randomness read: a changed ambient environment changes nothing.
5. Assert brand-neutral naming: no hardcoded product or binary name in new contracts or surfaces.

**Expected Outcome**:

- Identical injected facts produce identical bytes with no network, no model calls and no ambient reads (NFR-7).

**Binding oracle**:

- `canonical(run1) === canonical(run2)` per path; shuffled order identical; sockets `0`; model calls `0`; ambient mutation yields identical output; literals scan green.

#### TC-HARNESS-030 - Bounded output with marked truncation; refusal identity and hint never truncated

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: human and machine render of refusals and telemetry disclosures; `tests/behaviour/harness-output-bounds.test.ts` (update)
**Tags**: @offline, @bounds

**Preconditions**:

- Generated over-cap fixtures (many seats/models), at-cap and under-cap controls; refusal variants with long observed values.

**Steps**:

1. Measure serialized UTF-8 bytes and rendered lines; assert machine ≤ 65 536 and human ≤ 4 096 bytes and ≤ 24 lines.
2. Assert truncation is deterministic, tail-ordered, and marked with a recorded truncation warning.
3. Assert the refusal identity, the observed/requested value, the supported/available alternative and the remediation hint are present and intact on every over-cap refusal render.
4. Assert the under-cap control renders untruncated and its measured length is asserted first (non-vacuity).

**Expected Outcome**:

- Output stays bounded while the actionable part of a refusal survives every truncation (NFR-4).

**Binding oracle**:

- Machine ≤ `65536` bytes; human ≤ `4096` bytes and ≤ `24` lines; `error.code` and `error.remediationHint` present on every over-cap render; under-cap fixture has no truncation mark; measured length `> 0` asserted before the bound.

#### TC-HARNESS-031 - Delivered six-scenario classification floor unchanged and passing

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, DM-7
**Test Type(s)**: Conformance, Contract
**Automation Level**: Automated
**Target Layer / Location**: conformance registry; `tests/conformance/harness-classification.test.ts` (assertions unchanged) + `tests/structure/conformance-coverage.test.ts` (update)
**Tags**: @offline, @conformance

**Preconditions**:

- The delivered registry and the committed classification scenario fixtures.

**Steps**:

1. Assert `HARNESS_CONFORMANCE_SCENARIOS` is exactly the six delivered ids in the delivered order.
2. Assert exactly the two kinds are registered, each exactly once, each declaring all six floor scenarios.
3. Run the delivered classification suite and assert identical classification on both adapters with the assertions unchanged.
4. Assert `harnessConformanceViolations(HARNESS_CONFORMANCE_REGISTRY)` is `[]`.

**Expected Outcome**:

- The floor is untouched: same ids, same order, same two registrations, same passing classification (AC-F7-1).

**Binding oracle**:

- Scenario ids exactly `["completed","tool-failure","premature-end","harness-failure","spawn-refusal","timeout"]`; violations `[]`; classification suite green unchanged.

#### TC-HARNESS-032 - Missing new scenario or unexercised identity fails and names both

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-2, DM-7, RSK-5
**Test Type(s)**: Conformance, Contract
**Automation Level**: Automated
**Target Layer / Location**: registry violation function; `tests/structure/conformance-coverage.test.ts` (update) + `tests/conformance/harness-version-mode-propagation.test.ts` (matrix C-03, C-04)
**Tags**: @offline, @conformance, @negative

**Preconditions**:

- The delivered registry; a fixture builder producing a mutated registry with one new scenario removed from one registration; a fixture with a new refusal identity absent from the scenario set.

**Steps**:

1. Assert the unmutated registry yields no violation (planted positive first).
2. Remove `version-outside-window` from the opencode registration and assert a violation string naming both `opencode` and `version-outside-window`.
3. Add a sixth new identity beyond the declared scenario set and assert a violation naming that identity.
4. Assert the suite fails on each mutation (the violation array is non-empty and the failing assertion names the pair).

**Expected Outcome**:

- A missing scenario or an unregistered identity cannot ship: the failure message is the diagnosis, naming both sides (AC-F7-2).

**Binding oracle**:

- Baseline `violations.length === 0`; mutated → `violations` contains a string matching `opencode` and `version-outside-window`; identity case → a string containing the identity; both cases fail the suite.

#### TC-HARNESS-033 - New scenarios execute over simulated I/O and prove their property

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-2, AC-F7-3, DM-7
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: registry scenario execution; `tests/conformance/harness-version-mode-propagation.test.ts` (matrix C-05, C-06)
**Tags**: @offline, @conformance

**Preconditions**:

- The five new scenario ids registered per harness; simulated harness I/O fixtures (probe results, spawn environment echo, store rows) with no process and no store.

**Steps**:

1. For each new scenario id, execute it through the registry and assert its declared expected outcome: inside → proceeds; outside → `harness.version.unsupported`; unknown → `harness.version.unknown`; unavailable mode → `harness.mode.unavailable`; propagation → the descriptor records reach the spawn and are echoed.
2. Assert each refusal scenario records zero session starts.
3. Assert the scenarios resolve through the same registry functions as the floor (no forked path) by asserting the registration type and builder entry point.
4. Assert each new scenario can fail: flip its fixture's expected outcome and assert the scenario reports a mismatch (matrix C-08 half).

**Expected Outcome**:

- The new scenarios are real, executable checks of the new properties rather than declaration-only ids (AC-F7-2, AC-F7-3).

**Binding oracle**:

- Five ids present per registration; each produces its declared verdict/identity; refusal scenarios session starts `0`; fixture flip produces a mismatch; extension resolves through `HARNESS_CONFORMANCE_REGISTRY`.

#### TC-HARNESS-034 - Conformance runs offline with zero live harness invocations

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-3, NFR-10
**Test Type(s)**: Conformance, Checks
**Automation Level**: Automated
**Target Layer / Location**: conformance suite execution; `tests/checks/harness-hermetic.test.ts` (new) + `tests/checks/harness-ci-parity.test.ts` (assertions unchanged)
**Tags**: @offline, @hermetic, @conformance

**Preconditions**:

- A network and child-process probe harness (the delivered hermeticity pattern); the conformance suite invoked under it.

**Steps**:

1. Run `bun test tests/conformance` under the probe and assert zero sockets opened.
2. Assert no live harness binary was executed: the command seam was the injected double, and no real spawn of the configured harness command was recorded.
3. Assert no harness store was opened and no credential resolved.
4. Assert the CI wiring that runs the conformance suite is unchanged.

**Expected Outcome**:

- Conformance is CI-safe and offline: simulated I/O only, zero live invocations (AC-F7-3, NFR-10).

**Binding oracle**:

- Sockets `0`; live harness spawns `0`; store opens `0`; credentials resolved `0`; `harness-ci-parity` green unchanged.

#### TC-HARNESS-035 - Refusal identity contract: one row per identity, stable code, derived exit, hint present

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-N1-1, RSK-5, §8.5, §21
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: error table, harness failure vocabulary, projection; `tests/structure/error-table.test.ts` + `tests/structure/harness-contract.test.ts` (update) + `tests/checks/error-table-sync.test.ts` (update)
**Tags**: @offline, @contract, @refusal

**Preconditions**:

- The five new identities; the nine delivered `HARNESS_FAILURE_CODES`.

**Steps**:

1. Assert each new identity appears exactly once in the error table with `domainKind: "harness"`, a category, `retryable`, `consequence`, a non-empty `remediationHint`, and a `projectionClass`.
2. Assert `HARNESS_FAILURE_CODES` grew by exactly the new codes and still contains all nine delivered codes unchanged.
3. Assert the projection class → exit mapping resolves each new identity through `projectExitCode` (no exit literals outside the projection module).
4. Assert documented and machine tables agree bidirectionally and no delivered row changed meaning.
5. Assert `harness.telemetry.absent` and `harness.telemetry.extraction-failed` are distinct rows with distinct projection classes.

**Expected Outcome**:

- Every refusal is a classified outcome with a stable contract; vocabulary growth is additive and cannot silently fork a delivered meaning (RSK-5).

**Binding oracle**:

- Per identity: exactly one row; hint length `> 0`; `projectExitCode(row.projectionClass)` equals the matrix exit; `HARNESS_FAILURE_CODES` set-diff equals exactly the five new codes; delivered nine present and unchanged; sync test green.

#### TC-HARNESS-036 - Refusals leave no session-bearing side effect

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-N1-1, NFR-1, §5.1, OQ-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: refusal paths at harness resolution and spawn preparation; `tests/behaviour/harness-refusal-side-effects.test.ts` (new; matrix M-01..M-05, P-01..P-03)
**Tags**: @offline, @harness, @refusal, @side-effects

**Preconditions**:

- One fixture per refusal identity; recording seams for the probe child process, the streaming session start, the one-shot runner, the telemetry append, and the store writer; a fake process table.

**Steps**:

1. For each refusal, assert the session-spawn seam and one-shot-runner session calls are `0`.
2. Assert the probe child-process seam was invoked at most once, and if invoked, it completed and was reaped (fake process table empty — no orphan).
3. Assert telemetry appends `0` and store writes `0`.
4. Assert precedence P-01..P-03: exactly one identity, evaluated in order version → mode → profile.
5. Assert a paired in-window, available-mode, representable control spawns exactly one session (non-vacuity).

**Expected Outcome**:

- A refusal is inert: it starts no session, leaks no process, writes nothing, and reports exactly one identity (AC-N1-1).

**Binding oracle**:

- Per refusal: session starts `0`; runner session calls `0`; probe calls `≤ 1`; live children `0`; appends `0`; store writes `0`; one `error.code`; control session starts `1`.

**Notes / Clarifications**:

- OQ-6 records the reading applied here: AC-N1-1's "no child process" is read as "no session-bearing child process"; the version probe is the one bounded invocation the spec itself mandates (F-1, §8.2).

#### TC-HARNESS-037 - Gate composition does not disturb the delivered stream, handle or bounds behaviour

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-8, AC-F1-1, §10
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: streaming spawn composition with version, mode and propagation composed; `tests/behaviour/harness-stream-hygiene.test.ts`, `harness-opencode-stream.test.ts`, `harness-output-bounds.test.ts` (assertions unchanged) + `tests/behaviour/dispatch-harness-verdict-mode.test.ts`
**Tags**: @offline, @harness, @stream, @noninterference

**Preconditions**:

- The committed stream fixtures (clean stop, tool error, stream error, tokens); a synthetic long stream; the delivered stream assertions.

**Steps**:

1. Replay each committed capture through the composed path and assert handle acquisition on the first identified line, full drain, and identical completion evidence versus the delivered behavior.
2. Assert the output byte bound and truncation marker behavior are unchanged.
3. Assert no added per-frame blocking work: the synthetic long stream completes with the same recorded frame order and no new await boundary changes ordering.
4. Assert every invocation lands its delivered command-audit record, and an injected audit-write failure changes no outcome (§10).

**Expected Outcome**:

- The new gate work is resolution-time only; the stream, handle and bounds contracts are untouched (NFR-8).

**Binding oracle**:

- Evidence canonical JSON equal to the delivered golden per capture; acquired-on-first-line flag true; truncation marker semantics equal; frame order equal; audit records `1` per invocation; audit failure leaves exit and outcome unchanged.

#### TC-HARNESS-038 - Mutant meta-suite over every new honesty rule

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-2, AC-F1-3, AC-F1-4, AC-F2-1, AC-F3-2, AC-F3-3, AC-F3-4, AC-F5-3, AC-F5-4, AC-F6-1, AC-F6-2, AC-F7-2
**Test Type(s)**: Contract (mutation)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/harness-mutants.test.ts` (extend the delivered temp-copy pattern)
**Tags**: @offline, @mutation

**Preconditions**:

- The TC-HARNESS-002/003/004/007/012/013/014/021/022/023/024 fixtures; temp mutant copies of the production modules.

**Steps**:

1. For each mutant below, run the paired fixture suite against the mutant copy and assert it produces the prohibited observable while the fixture is unchanged:
   - **accept-outside-window**: treat an out-of-window version as inside → M-01 becomes a success (violates AC-F1-2).
   - **fabricate-version-on-failure**: substitute a default version string when the probe fails → `observedVersion` non-null (violates AC-F1-3, NFR-6).
   - **collapse-unknown-into-unsupported**: report the unknown case as unsupported → wrong code (violates DEC-3, AC-F1-3).
   - **widen-window-on-bad-config**: fall back to an unbounded window for a malformed configured value → `9.9.9` accepted (violates AC-F1-4).
   - **fallback-to-default-mode**: spawn under the default mode when another mode was requested → M-03 becomes a success (violates AC-F2-1, AC-F2-3).
   - **ambient-wins-over-record**: let the parent value beat the record value → wrong child value (violates AC-F3-2).
   - **forward-undeclared-record**: add an undeclared record name to the environment → extra key (violates AC-F3-3).
   - **partial-profile**: drop the unrepresentable seat and spawn → M-05 becomes a success (violates AC-F3-4).
   - **overwrite-observed-with-resolved**: replace the reported model with the resolved one → divergence erased (violates AC-F5-3).
   - **derive-duration-from-capture**: compute elapsed from `capturedAt` → a number appears where absence was required (violates AC-F5-4).
   - **absence-as-empty-success**: return exit 0 with zero figures on an empty session → prohibited output (violates AC-F6-1).
   - **absence-for-damage**: map an unreadable store to `harness.telemetry.absent` → wrong identity (violates AC-F6-2).
   - **ignore-missing-scenario**: let a registration miss a new scenario without a violation → registry passes (violates AC-F7-2).
2. Assert each real module produces none of the prohibited observables on the same fixtures; if a mutant changes nothing, the meta-check fails.

**Expected Outcome**:

- Every new honesty rule has a disabling mutant that fails the suite — the rules are load-bearing, not decorative.

**Binding oracle**:

- Per mutant: prohibited observable present under the mutant and absent under the real module; a mutant that fails to change behavior fails TC-HARNESS-038 by name.

#### TC-HARNESS-039 - Whole-change offline hermetic posture

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-10, §6
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: the full new suite set; `tests/checks/harness-hermetic.test.ts` (new)
**Tags**: @offline, @hermetic

**Preconditions**:

- The new suites; a network/credential/environment probe harness; the fixture-privacy scan.

**Steps**:

1. Run every new suite under the probe and assert zero sockets, zero real harness invocations, zero real store opens, zero `$HOME` reads and zero credential resolutions.
2. Assert every store is a per-test temp root and every stream fixture is committed.
3. Assert no test installs a process-global child-process mock (the delivered read-only guard).
4. Assert every new fixture passes the fixture-privacy scan.

**Expected Outcome**:

- 100% of new tests are offline and hermetic; nothing reaches a real harness, credential or network (NFR-10).

**Binding oracle**:

- Sockets `0`; live harness `0`; real stores `0`; `$HOME` reads `0`; global process mocks `0`; fixture-privacy green.

#### TC-HARNESS-040 - Dispatch outcome discloses the version verdict and the selected mode

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Important
**Related IDs**: AC-F1-1, AC-F2-1, DM-2, DM-3, §10
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: dispatch outcome composition; `tests/behaviour/dispatch-harness-verdict-mode.test.ts` (new)
**Tags**: @offline, @dispatch, @observability

**Preconditions**:

- Two dispatches: one in-window with the default mode; one out-of-window refusal.

**Steps**:

1. Assert the successful dispatch's recorded outcome carries the observed version and the inside verdict and the selected mode.
2. Assert the refusal's recorded facts carry the observed version and the outside verdict and the resolved mode (so a reader can tell what was attempted).
3. Assert the two recorded facts differ in version and verdict (non-vacuity: the fields are not constants).
4. Assert an absent mode run records the default mode with its `defaults` origin.

**Expected Outcome**:

- A later reader can always tell which harness line and which mode produced (or refused) a delivery (§10).

**Binding oracle**:

- Success: `recorded.observedVersion === "2.2.5"`, `recorded.versionVerdict === INSIDE`, `recorded.mode === DEFAULT_MODE`; refusal: `recorded.versionVerdict === OUTSIDE` with identity `harness.version.unsupported`; the two records differ in verdict; absent-mode run `origin === "defaults"`.

#### TC-HARNESS-041 - Documentation and conformance reconciliation for window, mode, propagation and seat telemetry

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Important
**Related IDs**: AC-F2-2, G-8, §18, §22
**Test Type(s)**: Manual, Contract
**Automation Level**: Semi-automated (structural checks + manual content review)
**Target Layer / Location**: `doc/spec/features/feature-harness-adapters.md`, `doc/spec/nonfunctional.md`, `doc/decisions/00-index.md`, `doc/planning/oss-tooling/` markers; `tests/checks/doc-conformance.test.ts`, `tests/structure/content-inventory.test.ts`
**Tags**: @docs, @conformance

**Preconditions**:

- The delivered change and its decision records; the documentation handbook conventions.

**Steps**:

1. Assert the harness feature spec states the supported window, the typed refusals, the mode declaration, the propagation contract, and the seat/duration telemetry fields as current truth.
2. Assert the non-functional harness rows state the restated bounds and determinism invariants, including the unchanged read budget.
3. Assert the decision index lists both new records and the harness feature spec links the mode record.
4. Assert the planning status markers for M3-S1 are updated.
5. Run the documentation conformance checks and record the manual traceability review in §10.

**Expected Outcome**:

- Documentation matches the delivered behavior, so the next change reads current truth rather than a stale seam (G-8, AC-F2-2).

**Binding oracle**:

- Every named statement present in the feature spec; both records in the index; feature spec contains the mode-record link; `doc-conformance` and `content-inventory` green; manual review recorded in §10.

## 6. Environments and Test Data

- **Environment**: local developer machine or CI runner; Bun pinned via `.bun-version`; pnpm workspace. Offline and hermetic — no network, no live harness, no credentials, no real user state directories (NFR-10). Narrow suites while iterating; the aggregate gate before completion: `TMPDIR=$PWD/tmp/tmpdir pnpm check`.
- **Version fixtures**: a version table module under `tests/fixtures/harness/` declaring V-01..V-12 (observed string, expected verdict, identity, exit) and the accepted-grammar constant. Probe doubles record invocation arguments and ordering; no test spawns a real binary.
- **Mode fixtures**: config fixtures for absent / explicit-default / unknown / wrong-typed / empty mode values, plus recording doubles for every declared transport so "no fallback" is a recorded-call assertion.
- **Propagation fixtures**: declared resolved profiles with N ≥ 2 seats, one seat using an explicit `envName`; conflicting ambient parent values; undeclared record names with unique canaries; one unrepresentable seat per variant; `tests/fixtures/harness/spawn-env.ts` extended rather than replaced.
- **Store test data**: `tests/fixtures/harness/opencode-store/build.ts` extended with the declared variants (complete, multi-seat, missing-duration, missing-cost, missing token class, divergence, no-optional-columns, 2.1.x-shape, missing-mandatory, zero-rows, permission-denied, not-a-database, over-cap). Every variant is built in a temp directory; no binary store is committed; every variant carries a privacy canary.
- **Stream test data**: the committed real-shape captures at `tests/fixtures/harness/stream/` (`opencode-v2.2.5.jsonl`, `-tool-error`, `-stream-error`, `-tokens`) with their provenance README; synthetic frames only through `tests/fixtures/harness/scenarios/stream.ts`.
- **Resume/attach fixtures**: the committed resume fixture plus a bounded listing fixture with an over-cap variant and an absent-identity variant.
- **Injected nondeterminism sources**: fixed `NOW_MS`, fixed session/run id sequences, synthetic brand constant; duration fixtures are literals.
- **Isolation**: one temp root per case; mutation probes and clamp probes operate on temp copies; the live tree and real state directories are never written.
- **The single permitted live observation**: the in-change spike may use a documented entrypoint modelled on `tests/conformance/live/run-live.ts` to record a real harness observation (version string, whether the per-seat model variable family is honoured). It is not `*.test.ts`, is not discovered by `bun test`, is never invoked by `pnpm check` or CI, and its output is recorded as spike evidence in the change artifacts (GAP-2). It is never an oracle for any TC in this plan.
- **Cleanup**: temp roots discarded per test; no persistent state outside committed fixtures.

## 7. Automation Plan and Implementation Mapping

| TC ID(s) | Test file(s) to create/update | Execution command | Mocking / seeding requirements | Status |
|----------|------------------------------|-------------------|-------------------------------|--------|
| 001, 002, 003, 006 | `tests/behaviour/harness-version-gate.test.ts`, `harness-version-probe-bound.test.ts` (new) | `bun test tests/behaviour/harness-version-gate.test.ts tests/behaviour/harness-version-probe-bound.test.ts` | Version table fixture; probe and session-spawn doubles; fake clock; paired in-window control | To Implement |
| 004, 005 | `tests/behaviour/harness-version-window.test.ts`, `tests/structure/harness-version-window-contract.test.ts` (new) | `bun test tests/behaviour/harness-version-window.test.ts tests/structure/harness-version-window-contract.test.ts` | Version table + window constant; temp-copy window mutants for V-10/V-11 | To Implement |
| 007, 008, 009 | `tests/behaviour/harness-mode-selection.test.ts`, `harness-mode-refusal.test.ts`, `harness-mode-config.test.ts` (new) | `bun test tests/behaviour/harness-mode-*.test.ts` | Mode config fixtures; recording transport doubles; ambient canary | To Implement |
| 010 | `tests/checks/decision-record.test.ts` (extend inventory) | `bun test tests/checks/decision-record.test.ts` | The two authored records; chosen-mode constant equality | To Implement (+ docs) |
| 011, 015 | `tests/behaviour/harness-profile-propagation.test.ts`, `harness-profile-per-spawn.test.ts` (new); `harness-telemetry-seat-attribution.test.ts` (new) | `bun test tests/behaviour/harness-profile-propagation.test.ts tests/behaviour/harness-profile-per-spawn.test.ts tests/behaviour/harness-telemetry-seat-attribution.test.ts` | N-seat profiles; environment-echoing spawn double; seat-attributed store variant | To Implement |
| 012, 013, 014 | `tests/behaviour/harness-profile-precedence.test.ts`, `harness-profile-neutrality.test.ts`, `harness-profile-unrepresentable.test.ts` (new) | `bun test tests/behaviour/harness-profile-{precedence,neutrality,unrepresentable}.test.ts` | Conflicting parent values; undeclared canaries; three unrepresentable variants; delivered spawn-env assertions unchanged | To Implement |
| 016, 017 | `tests/behaviour/harness-resume-propagation.test.ts` (new); `harness-opencode-resume-stream.test.ts` (assertions unchanged) | `bun test tests/behaviour/harness-resume-propagation.test.ts tests/behaviour/harness-opencode-resume-stream.test.ts` | Committed resume fixture; canonical environment comparison | To Implement |
| 018 | `tests/behaviour/harness-attach.test.ts` (new) | `bun test tests/behaviour/harness-attach.test.ts` | Bounded listing fixtures (in-cap, over-cap, absent); kill double | To Implement |
| 019, 021, 022 | `tests/behaviour/harness-telemetry-seat-attribution.test.ts`, `harness-telemetry-divergence.test.ts`, `harness-telemetry-durations.test.ts` (new); `harness-telemetry-shape.test.ts` (update) | `bun test tests/behaviour/harness-telemetry-{seat-attribution,divergence,durations,shape}.test.ts` | Complete / divergence / missing-duration store variants; literal duration constants | To Implement (+ update) |
| 020, 028 | `tests/behaviour/harness-telemetry-version-compat.test.ts` (new) | `bun test tests/behaviour/harness-telemetry-version-compat.test.ts` | Committed legacy row golden; 2.1.x-shape and missing-mandatory variants | To Implement |
| 023, 024 | `tests/behaviour/harness-telemetry-absent.test.ts`, `harness-telemetry-extraction-failure.test.ts` (new) | `bun test tests/behaviour/harness-telemetry-{absent,extraction-failure}.test.ts` | Zero-rows store; four damaged-store variants; recording append seam; paired controls | To Implement |
| 025, 026 | `tests/behaviour/harness-telemetry-bounds.test.ts`, `harness-telemetry-seat-totals.test.ts` (new) | `bun test tests/behaviour/harness-telemetry-{bounds,seat-totals}.test.ts` | Recording statement double; over-cap and at-cap stores; baseline + step fixtures | To Implement |
| 027, 029, 030 | `tests/behaviour/harness-telemetry-privacy.test.ts` (new); `harness-output-bounds.test.ts` (update); `tests/checks/harness-determinism.test.ts` (update); `tests/checks/fixture-privacy.test.ts`, `privacy-literals.test.ts` (update as needed) | `bun test tests/behaviour/harness-telemetry-privacy.test.ts tests/behaviour/harness-output-bounds.test.ts tests/checks/harness-determinism.test.ts tests/checks/fixture-privacy.test.ts` | Canary fixtures; over-cap render sets; injected clock and ids | To Implement (+ updates) |
| 031, 032, 033 | `tests/conformance/harness-version-mode-propagation.test.ts` (new); `tests/structure/conformance-coverage.test.ts` (update); `tests/conformance/harness-classification.test.ts` (assertions unchanged) | `bun test tests/conformance tests/structure/conformance-coverage.test.ts` | Extended registry; mutated-registry fixtures; simulated harness I/O | To Implement (+ update) |
| 034, 039 | `tests/checks/harness-hermetic.test.ts` (new) | `bun test tests/checks/harness-hermetic.test.ts` | Network/credential/process probe harness; the full new suite set | To Implement |
| 035 | `tests/structure/error-table.test.ts`, `tests/structure/harness-contract.test.ts` (update); `tests/checks/error-table-sync.test.ts` (update); `tests/checks/exit-code-literals.test.ts` (must stay green) | `bun test tests/structure tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts` | Five new identities; delivered nine codes; projection mapping | To Implement (+ updates) |
| 036 | `tests/behaviour/harness-refusal-side-effects.test.ts` (new) | `bun test tests/behaviour/harness-refusal-side-effects.test.ts` | Recording probe/session/one-shot/append/store seams; fake process table; precedence fixtures | To Implement |
| 037, 040 | `tests/behaviour/dispatch-harness-verdict-mode.test.ts` (new); `harness-stream-hygiene.test.ts`, `harness-opencode-stream.test.ts`, `dispatch-harness-*.test.ts` (assertions unchanged) | `bun test tests/behaviour/dispatch-harness-verdict-mode.test.ts tests/behaviour/harness-stream-hygiene.test.ts tests/behaviour/harness-opencode-stream.test.ts tests/behaviour/dispatch-harness-acquisition.test.ts` | Committed stream fixtures; synthetic long stream; audit seam | To Implement |
| 038 | `tests/checks/harness-mutants.test.ts` (extend) | `bun test tests/checks/harness-mutants.test.ts` | Thirteen named mutants; paired fixtures | To Implement (+ extension) |
| 041 | `doc/spec/features/feature-harness-adapters.md`, `doc/spec/nonfunctional.md`, `doc/decisions/00-index.md`, `doc/planning/oss-tooling/` markers | manual content check + `bun test tests/checks/doc-conformance.test.ts tests/structure/content-inventory.test.ts` | none | Manual + static checks |
| Fixture set | `tests/fixtures/harness/version.ts`, `mode.ts`, `profile.ts` (new); `opencode-store/build.ts` (extend); `spawn-env.ts` (extend); `scenarios/` (extend) | `bun test tests/checks/fixture-privacy.test.ts` | Synthetic, privacy-scanned fixtures only | To Implement |
| Regression envelope | all suites above | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | none (aggregate gate unchanged) | Existing – No Change |

Existing suites asserted unchanged (regression half only): `tests/conformance/harness-classification.test.ts`, `harness-liveness.test.ts`, `tests/behaviour/harness-spawn-env.test.ts`, `harness-spawn-credential.test.ts`, `harness-default-path.test.ts`, `harness-opencode-stream.test.ts`, `harness-opencode-resume-stream.test.ts`, `harness-host-stream.test.ts`, `harness-stream-hygiene.test.ts`, `harness-telemetry-{opencode,claude,shape,drift,claude-budget,opencode-orphan-scope}.test.ts`, `harness-closeout-{capture,idempotency,nongating}.test.ts`, `dispatch-harness-{acquisition,default-spawn,lease}.test.ts`, `tests/checks/harness-ci-parity.test.ts`, and the delivered spend read-side suites (untouched: `spend.telemetry-absent` keeps its meaning).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Mitigation in this plan |
|------|------------------------|
| Propagation is nominally correct but inert because a real harness ignores the variable family (RSK-1) | GAP-2 names the boundary explicitly: tests prove the descriptor and echoed child environment, never a live harness's honouring; the in-change spike is the named evidence and the optional gated probe records it. AC-F3-1 is never claimed beyond what is proven |
| The pinned window ages out and blocks delivery (RSK-2) | TC-HARNESS-005 asserts the window is data with one pinned default and that a malformed configured value degrades to it; a stale window surfaces as a classified refusal (TC-HARNESS-002), not a silent acceptance |
| New refusal identities fragment the error table or duplicate delivered meanings (RSK-5) | TC-HARNESS-035 asserts one row per identity, additive `HARNESS_FAILURE_CODES` growth, unchanged delivered codes, and a distinct absence/failure pair; TC-HARNESS-038's collapse mutant guards identity distinctness |
| Deny-by-default environment is weakened while adding propagation (RSK-6) | TC-HARNESS-013 asserts exact key-set equality, allowlist immutability and canary absence; TC-HARNESS-012 asserts precedence; the `forward-undeclared-record` and `ambient-wins-over-record` mutants must fail |
| Seat attribution double counts against session totals (RSK-7) | TC-HARNESS-026 asserts one totals basis with breakdown sums equal to totals and explicitly not baseline-plus-steps |
| A 2.1.x store shape is unobserved, so degradation rules could be pinned against an invented shape (RSK-4, GAP-6) | The fixture is a declared derived shape; the assertions target the *rules* (degrade when mandatory fields exist, fail when absent) through the declared mandatory-field set (OQ-8 default), never the invented column names |
| `AC-F2-2` could pass on a decorative record | TC-HARNESS-010 asserts the record's chosen mode equals the code's default constant and that the chosen mode is one of exactly three declared modes; correctness remains human-gated (GAP-4) |
| The version probe's child process contradicts a literal reading of AC-N1-1 | OQ-6 records the reading applied (no *session-bearing* child process); TC-HARNESS-036 asserts probe count ≤ 1, reaping, and zero session starts, so the guarantee is tested in its meaningful form |
| Adding gate work could disturb the delivered stream (NFR-8) | TC-HARNESS-037 replays the committed captures and asserts evidence, acquisition and bound parity, plus audit composition |
| Tests could assert implementation strings and become brittle (GAP-5) | Every field name and warning reason goes through declared contract constants pinned in the contract suite; no TC asserts an inline literal |

### 8.2 Assumptions

- The harness rejects/accepts versions through the delivered injected probe seam; the probe stays one bounded shell-free invocation (spec §8.2, NFR-2).
- The resolved per-seat model record map is available at spawn time as validated data from the delivered profile resolution (spec §12); profile resolution itself is not re-tested here.
- A record name only binds when the name is declared in the harness environment allowlist; the delivery declares the per-seat names it propagates, and an undeclared record name is inert (AC-F3-3; OQ-4).
- The delivered telemetry row grouping (per session/agent/model) remains the coarse grain and seat identity is an added dimension (spec §12).
- The delivered `error-table` rows derive exit purely from `projectionClass`; no new exit literal is introduced (spec §21, `packages/cli/src/projection.ts`).
- The delivered six-scenario floor and both registrations survive unchanged; new scenarios are additions to the same registry (spec §8.5).
- The 2.1.x store shape observed in fixtures is a declared derived shape, not an observed production capture (GAP-6).

### 8.3 Open Questions

| ID | Question | Blocking status | Default applied here | Owner |
|----|----------|-----------------|----------------------|-------|
| OQ-4 | Do the per-seat model variable names have to be declared on the harness configuration branch for the record map to bind, and who declares them (configuration, profile resolution, or composition)? | Non-blocking for this plan; blocking for TC-HARNESS-011's fixture wiring | The allowlist must declare each propagated name; the delivery supplies the declaration; an undeclared record name changes nothing (AC-F3-3) | @plan-writer → @coder |
| OQ-5 | Which refusal identity and projection class does AC-F2-4's "unknown mode value" use, and which projection class do `harness.mode.unavailable` and `harness.profile.model-unrepresentable` take? | Non-blocking; asserted through declared constants either way | Unknown mode value → the delivered `config.value.invalid` (user-validation, exit 1); mode-unavailable and model-unrepresentable → user-validation, exit 1 | @plan-writer |
| OQ-6 | AC-N1-1 says "no child process has been started", but the version probe is itself a bounded child-process invocation (F-1, §8.2). Does the guarantee scope to session-bearing processes? | Non-blocking; the plan asserts the meaningful form and records the reading | Yes — zero session-bearing child processes; the probe is the single permitted invocation, completes, and is reaped | @plan-writer |
| OQ-7 | Is `attach` a distinct port operation, or the bounded `listSessions` lookup followed by `resume`? | Non-blocking; the oracle asserts listing-once + spawn-zero either way | Attach = bounded listing plus resume; no new port member (F-4 wording) | @plan-writer → @coder |
| OQ-8 | For the 2.1.x shape, which fields are "mandatory identity and token fields" that separate "degrade with warnings" from "classify the session as failed"? | Non-blocking; pins the degrade-vs-failed boundary in TC-HARNESS-028 | Mandatory = session identity plus at least one token class plus work-item attribution; absent → failed session with a closed reason; present → degrade for the missing optional fields | @plan-writer → @coder (fixtures) |
| OQ-9 | What is the exact registry surface that supplies version and mode facts to a conformance scenario, given that the registry builds a session port while version and mode are resolution-time concerns? | Non-blocking for the plan's oracles (they assert through the registry API and violation messages); blocking for TC-HARNESS-033's implementation | Scenario facts are injected as data through the registration/deps surface; the production resolution path is untouched; the extension is data on the same registry (F-7) | @plan-writer → @coder |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-17 | @test-plan-writer | Initial test plan for GH-335 (M3-S1 opencode v2.x harness and telemetry): 41 scenarios (TC-HARNESS-001..041) covering all 23 ACs, DM-1..DM-7 and NFR-1..NFR-10 with every AC mapped; both pinned blueprint scenarios (TC-M3-HARNESS-001/002) delivered as dedicated cases with their verbatim Given/When/Then; refusal/oracle matrix M-01..M-10 with precedence P-01..P-03, version verdict matrix V-01..V-12, telemetry field matrix T-01..T-14, conformance scenario matrix C-01..C-08; binding fixture, non-vacuity and mutant contracts mirroring the GH-291 precedent; gaps GAP-1..GAP-6 and open questions OQ-4..OQ-9 declared with defaults and owners |

## 10. Test Execution Log

No suites were run while authoring this plan. This log is populated during delivery (phase 6) and quality gates (phase 9). The NFR-2 reference measurement (TC-HARNESS-006, GAP-3) and the manual documentation traceability review (TC-HARNESS-041) are recorded here; the optional gated live probe (GAP-2) records its spike evidence in the change artifacts, not here.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Awaiting delivery |
