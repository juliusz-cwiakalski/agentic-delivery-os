---
change:
  ref: GH-335
  type: feat
  status: Proposed
  slug: opencode-harness-telemetry
  title: "M3-S1: opencode v2.x harness and telemetry"
  owners: [engineering]
  service: delivery-os harness plane (harness port, opencode adapter, version gate, profile propagation, telemetry extraction)
  milestone: "M3: Harness and tracker integrations"
  labels: [m3, harness, opencode, telemetry, version-gate, conformance, decision-record]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - harness adapter seam (GH-233 / M1-S11) — HarnessInstance, HarnessSessionPort, streaming JSONL spawn, deny-by-default spawn environment, profile record map, conformance registry
      - harness telemetry v2 (GH-291 / M2-S14) — delivery.harness.telemetry.v1 records, per-step ingest, closeout capture, spend read side
      - provider profiles and environment records (GH-234) — per-seat model derivation and the data-v1 record contract
      - dispatch engine (GH-239) — the first production consumer of the session port
      - result contract and error table (GH-172) — closed error table, envelope, exit projection, remediation hints
      - state layer (GH-174) — fenced verified appends and versioned record kinds
      - configuration layer and inspection (GH-173) — the typed harness branch
      - decision records (doc/decisions) — the in-change TDR obligation
    external:
      - opencode harness v2.x (v2.2.5 observed at intake — `run --format json`, `--session`, session store sqlite under the harness data directory)
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/335
  related_changes: ["GH-233", "GH-234", "GH-239", "GH-275", "GH-291", "GH-342"]
  related_decisions: ["ADR-0008", "TDR-0016", "TDR-0021"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make opencode v2.x a version-gated, mode-decided, profile-propagating delivery harness whose sessions land schema-versioned per-seat telemetry in the state layer — so a dispatch either runs with the resolved profile or refuses with a typed, actionable identity instead of guessing.

## 1. SUMMARY

This change delivers milestone story M3-S1. It extends the delivered harness seam additively with four things the harness cannot state today: a supported-version window evaluated before any session is spawned, with typed refusals instead of an unexamined pass; one explicitly decided integration mode for opencode dispatch, recorded as a decision; per-spawn propagation of the resolved profile's per-seat model record into the spawn descriptor; and per-seat telemetry attribution — seat identity, resolved model, tokens, cost, and durations — landing in the state layer under the existing schema identity with the version stamp on every row. The delivered conformance registry gains scenarios for the three refusal and propagation properties while its six-scenario classification floor stays as delivered. Both delivery dependencies (M1-S11, M2-S14) are delivered current truth, so this change extends a live seam rather than creating one.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The harness seam is delivered.** `HarnessInstance` carries a closed kind, an injected `observedVersion` (`null` is the explicit unknown value and always rides the `version-probe-failed` warning), and a capability declaration with explicit gaps. `HarnessSessionPort` carries spawn, deliver, resume, steer, collect, classify, liveness, and read-only session listing. The opencode adapter spawns the harness, decodes its JSONL stdout line by line, acquires the handle on the first identified session line, keeps draining to process close, and resumes by session identity. The shared classifier is harness-neutral; adapters classify nothing themselves.
- **The spawn environment is deny-by-default.** The child environment is built from the declared allowlist alone. A declared variable entry is required unless it carries the variable-only optional marker; a credential entry resolves through the credential port at use time. An optional validated data-record map from profile resolution may supply values for declared variable names: a record value takes precedence over the injected parent environment, and an undeclared record name changes nothing.
- **Per-seat model derivation exists as data.** Profile resolution derives a per-seat model environment record (`OC_<PREFIX>_AGENT_<SEAT>_MODEL`, or the seat's explicit `envName`), serialized and validated under the data-v1 record contract. The record map is derived and validated; nothing in the delivered dispatch path asserts that it reaches an opencode spawn, and no test proves the spawned session runs the resolved per-seat models.
- **Version identity is observed but never evaluated.** The configured-kind registry resolves an instance from an injected version probe; a failed or empty probe yields `null` plus the warning. No component compares the observed version to a supported window, no component refuses on it, and the closed harness failure vocabulary carries nine identities — none for a version or a mode refusal.
- **Telemetry v2 is delivered without seat attribution or durations.** `delivery.harness.telemetry.v1` rows carry work item, run, session, harness kind and version, agent, model, tree root, parent chain, the five token classes, calls, bounded tool counts, cost (null when missing, never zero), an injected capture timestamp, and closed-vocabulary warnings. Rows are captured at closeout and, per step, during the opencode stream into additive state records; bounded read-only queries only. A row has no seat identity, no resolved-versus-observed model comparison, and no duration.
- **Integration mode is implicit.** The delivered adapter starts one harness process per spawn and reads the harness session store read-only for telemetry. That behavior is a mode in fact, but no mode is declared, configured, refused, or recorded as a decision, and `doc/decisions/` contains no integration-mode record.
- **Conformance is a six-scenario classification floor.** The registry registers exactly the two shipped harness kinds and fails a harness that misses a floor scenario. There is no version-window scenario, no mode scenario, and no profile-propagation scenario.
- **Planning truth.** Backlog M3-S1 and milestone pack EC-1 define goal, tasks, and AC; `m3/contracts.md` declares the extended harness port and three typed refusals; `m3/test-scenarios.md` pins TC-M3-HARNESS-001 and TC-M3-HARNESS-002. Open question Q-06 in GH-342 (opencode version window) is unanswered, so its stated default applies.

### 2.2 Pain Points / Gaps

- **G1 — No supported-window evaluation and no typed refusal.** `m3/contracts.md` declares `harness.version.unsupported`, but the closed failure vocabulary has no such identity and no code path compares an observed version to a window. An out-of-window or unknown harness today proceeds as if compatible.
- **G2 — Per-spawn profile propagation is unproven.** The per-seat record derivation exists, but the dispatch path does not state how the resolved record map reaches the spawn descriptor per spawn, that a record value beats the ambient parent environment, what happens to undeclared record names, or what is refused when a required seat model cannot be expressed.
- **G3 — Integration mode is undecided and unrecorded.** Standalone service, background service, and direct API are all plausible under opencode v2.x; no spike, no decision record, no configuration expression, and no refusal for an unavailable mode exist.
- **G4 — Telemetry carries no seat, no resolved-model comparison, and no durations.** The ticket AC requires per-seat models and durations beside schema version, tokens, and cost; the delivered row shape expresses none of the first two and only the second conditionally.
- **G5 — Conformance cannot see the new properties.** The registry's scenarios cover classification outcomes only, so a regression in version gating, mode refusal, or profile propagation would pass the suite.
- **G6 — An adapter-contract change without its governing record.** The repository rule (TDR-0016, TDR-0021 precedent) is that a harness adapter-contract change is governed by a recorded decision; neither the mode decision nor the contract refinements have one.

## 3. PROBLEM STATEMENT

Because the harness port observes a version without evaluating it, propagates the resolved profile without proving it reaches the spawn, and captures telemetry without seat attribution or durations, a dispatch cannot state that it ran the resolved per-seat models on a compatible harness — so an incompatible or unknown harness proceeds unannounced, a profile can be silently ignored, and the statistics the learning plane consumes cannot attribute cost and time to the seat that produced them.

## 4. GOALS

- **G-1**: A supported-version window is evaluated for every dispatch before any session exists, and versions outside it refuse with the declared typed identity.
- **G-2**: An undeterminable version stays an explicit unknown and refuses distinctly — never a fabricated version, never a silently permissive pass.
- **G-3**: Exactly one integration mode is the delivered default for `delivery-os`/`jaiship` dispatch, expressed through configuration, decided by an in-change spike, recorded in a decision record, and refused with a typed identity when an unavailable mode is requested.
- **G-4**: The resolved profile's per-seat model record map reaches the spawn descriptor on every spawn, wins over the ambient parent environment for declared names, changes nothing for undeclared names, and refuses with a typed identity when a required seat model cannot be expressed.
- **G-5**: Resume and attach continue an existing session identity under the same propagation contract, without forking the tree root.
- **G-6**: Telemetry rows land in the state layer with the schema version, harness kind and version, seat identity, resolved per-seat model, the five token classes, cost, and durations — additively within the existing schema identity.
- **G-7**: Conformance against the harness port gains the version-window, mode-refusal, and profile-propagation properties without altering the delivered six-scenario classification floor.
- **G-8**: The adapter-contract refinements and the integration-mode selection are recorded as decision records and reconciled into the harness feature spec.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Version gate coverage (TC-M3-HARNESS-002) | 100% of dispatch attempts evaluate the supported window before a child process starts; zero sessions spawned on a refused version |
| Typed-refusal conformance | 100% of version, mode, and profile refusals carry a closed identity from the error table with a declared exit projection and a non-empty remediation hint; zero generic failures |
| Profile propagation (TC-M3-HARNESS-001) | On a resolved profile with N seats, the spawned session reports the resolved model for all N seats; zero seats unattributed |
| Telemetry completeness | 100% of landed rows carry the schema version, harness kind and version, seat identity, and resolved model; durations are present or explicitly absent with a warning — never estimated |
| v1/v2 compatibility | Zero removals or renames in `delivery.harness.telemetry.v1`; all pre-change rows remain readable unchanged |
| Unknown-version honesty | 100% of undeterminable-version dispatches refuse with the distinct unknown identity; zero fabricated version strings, zero silent passes |
| Determinism | Byte-identical output for identical injected harness facts, version probe result, and clock |
| Offline verification | 100% of new tests run offline against simulated harness I/O and fixture stores; zero live harness invocations, credentials, or network |

### 4.2 Non-Goals

- **NG-1**: Extending the Claude Code adapter — it stays registered as a generated-artifact/compatibility surface and is not a delivery harness in M3 (OQ-M3-01).
- **NG-2**: Running more than one integration mode concurrently, or falling back between modes at runtime.
- **NG-3**: A telemetry schema version bump, structural change, or field removal (OQ-M3-07: additive only).
- **NG-4**: Backfilling historical sessions with seat or duration facts.
- **NG-5**: Harness store writes of any kind, including harness-side configuration mutation to force model selection.
- **NG-6**: Provider profile resolution, model selection, pacing, nomination, or cost normalization — delivered elsewhere and consumed here as input.
- **NG-7**: Tracker work (M3-S2/S3/S4), the parity/trap-catalog suite (M3-S5), and multi-tracker composition (M3-S6).
- **NG-8**: Background-service supervision, daemonization, or health management of the harness itself.
- **NG-9**: A new CLI command surface; the change extends existing dispatch and configuration resolution paths.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Supported-version evaluation and typed refusal | EC-1 and the ticket AC require an unsupported harness to refuse; today it proceeds unexamined (G1) |
| F-2 | Explicit integration mode with a recorded decision | The ticket makes the spike and its record a deliverable; the mode must be observable, configurable, and refusable (G3) |
| F-3 | Per-spawn profile model propagation | The ticket AC is "runs with the resolved profile"; propagation must be a stated contract, not an accident of naming (G2) |
| F-4 | Resume and attach under the same profile contract | Spawn without resume leaves long deliveries unable to continue a session with its profile intact (G5) |
| F-5 | Per-seat telemetry rows with schema version and durations | The statistics plane needs seat-attributed model, tokens, cost, and time facts (G4) |
| F-6 | Classified telemetry absence and degradation | Absence must stay distinguishable from failure and from a zero-valued row |
| F-7 | Harness-port conformance extension | Without scenarios the new properties can regress silently (G5) |

### 5.1 Capability Details

- **F-1 Supported-version evaluation and typed refusal.** A supported window is declared as data: the current minor line at delivery time plus one previous minor — at intake, the `2.2.x` line plus `2.1.x`, derived from the observed `v2.2.5`. The window is evaluated once per dispatch at harness resolution, before any child process is started, and the evaluation result is carried on the instance so every consumer reads one verdict. An observed version inside the window proceeds; an observed version outside it refuses with `harness.version.unsupported`, naming the observed version and the supported window; a version that cannot be determined refuses with `harness.version.unknown` (DEC-3), never with a fabricated version and never as a permissive pass. An unparseable version string is an unknown, not a match. No configurable window ships in this change; should a configurable window be introduced later, an absent, malformed, or unsupported configured value degrades to this pinned default — never to an unbounded or silently wider window.
- **F-2 Explicit integration mode with a recorded decision.** The spike compares the three declared modes — standalone service, background service, and direct API — including the read-only direct-store access the telemetry path needs, and its outcome is recorded as a decision record. Exactly one mode is the delivered default for `delivery-os`/`jaiship` dispatch; the others are declared and refuse with `harness.mode.unavailable`, naming the requested and the available mode. The mode is expressed as a declared value on the harness configuration branch (absent → the delivered default with a `defaults` origin) and is never inferred from ambient state. A dispatch never falls back from one mode to another: a fallback would make the decision unobservable and double the tested surface (DEC-2).
- **F-3 Per-spawn profile model propagation.** For every spawn, the resolved profile's per-seat model record map is carried into the spawn descriptor as data; each seat's value is bound to that seat's declared model variable name (`OC_<PREFIX>_AGENT_<SEAT>_MODEL`, or the seat's explicit `envName`). A record value wins over the injected parent environment for a declared name; an undeclared record name changes nothing and never widens the deny-by-default allowlist. A required seat whose model cannot be expressed as a declared per-spawn variable refuses with `harness.profile.model-unrepresentable` naming the seat, before any session exists — never a silenced seat, never a guessed value. The propagation contract is identical for spawn, deliver, and resume so a resumed session keeps the profile its spawn declared.
- **F-4 Resume and attach under the same profile contract.** A resume continues the caller's session identity and preserves the tree root; an attach resolves an existing session from the read-only, bounded session listing before resuming, and spawns nothing. A resume that identifies a different or absent session keeps the delivered `harness.session.unknown` semantics and kills its stream idempotently. Where a resumed session's original descriptor is available, its propagation contract is reused rather than re-derived.
- **F-5 Per-seat telemetry rows with schema version and durations.** Every landed row stamps the schema version and the harness kind and version (a `null` version with a warning when the harness did not report one), carries the seat identity, and carries both the resolved model from the spawn profile and the model the harness reported. A divergence between the two is disclosed with a closed-vocabulary warning and both values are kept — never reconciled by overwriting. Rows carry the five token classes, calls, cost (null when missing), and durations; a duration the store does not expose is explicitly absent with a warning and is never derived from capture timestamps or estimated. Ingestion remains bounded and read-only, riding the delivered extraction and per-step ingest seams unchanged.
- **F-6 Classified telemetry absence and degradation.** A telemetry request for a session with no rows returns `harness.telemetry.absent` at exit 1 and produces no zero-valued row; an unreadable or unopenable store keeps the delivered `harness.telemetry.extraction-failed` identity and is never re-projected as absence. Optional-field drift continues to degrade with a warning and never hard-fails. The read side's delivered `spend.telemetry-absent` meaning is untouched.
- **F-7 Harness-port conformance extension.** The registry's six-scenario classification floor for exactly the two registered kinds stays as delivered and keeps passing. New scenarios are registered per harness: version refusal inside and outside the window, unknown version, mode unavailable, and profile propagation (resolved seats reach the spawned session). A registered harness missing a newly declared scenario fails the suite; a new refusal identity with no scenario fails the suite. The extension is data on the registry, not a forked conformance path.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Dispatch resolution and version gate
  dispatch resolves harness settings (kind, mode, stores, allowlist)
  → version probe runs once through the delivered child-process seam
  → window evaluation:
      inside window   → instance carries the verdict, continue
      outside window  → refuse harness.version.unsupported (exit 1), no child process
      indeterminate   → refuse harness.version.unknown (exit 1), no child process
  → mode resolution: declared or delivered default; unavailable → harness.mode.unavailable

Flow 2: Spawn with the resolved profile
  profile resolution yields seat → model and the per-seat record map
  → record map carried into the spawn descriptor (per declared seat name)
  → environment built: record value wins, undeclared names change nothing
  → an inexpressible required seat → harness.profile.model-unrepresentable (no spawn)
  → session spawns, handle acquired on the first identified line, stream drains

Flow 3: Resume / attach
  existing handle or bounded read-only session listing → resume the same identity
  → same descriptor and propagation contract, tree root preserved
  → unknown/different session → harness.session.unknown, idempotent kill

Flow 4: Telemetry landing
  per-step frames / closeout extraction → rows with schema version, seat, resolved
  model, observed model, tokens, cost, durations
  → divergence or missing duration → closed-vocabulary warning, value kept or absent
  → fenced verified append to the state ledger (non-gating)
  → no rows for a session → harness.telemetry.absent on request; unreadable store → extraction-failed

Flow 5: Conformance
  registry → six delivered classification scenarios + new version/mode/profile scenarios
  → simulated harness I/O only → missing scenario or undeclared identity fails the suite
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The supported-version window as data, evaluated once per dispatch at resolution, with `harness.version.unsupported` and `harness.version.unknown` refusals before any session exists.
- The integration-mode spike over standalone service, background service, and direct API (including read-only direct-store access for token/usage analytics) plus its recorded decision.
- Exactly one delivered default mode, its configuration expression, and `harness.mode.unavailable` for any other requested mode.
- Per-spawn propagation of the resolved per-seat model record map into the spawn descriptor, precedence over the ambient parent environment, undeclared-name neutrality, and `harness.profile.model-unrepresentable` for an inexpressible required seat.
- Resume and attach under the same propagation contract, with the delivered `harness.session.unknown` semantics preserved.
- Per-seat telemetry attribution: seat identity, resolved model beside the harness-reported model with disclosed divergence, durations with explicit absence, schema version and harness version on every row — additive within `delivery.harness.telemetry.v1`.
- `harness.telemetry.absent` as a distinct absence identity beside the delivered `harness.telemetry.extraction-failed`.
- Error-table rows for every new identity with a stable code, exit projection, and remediation hint; `HARNESS_FAILURE_CODES` extended additively.
- Conformance registry extension covering the version-window, mode, and profile scenarios, with the delivered six-scenario floor unchanged.
- Decision records for the adapters-contract refinements and the integration mode, linked from this change and the harness feature spec.
- Tests proving TC-M3-HARNESS-001, TC-M3-HARNESS-002, and every acceptance criterion, offline against simulated harness I/O and fixture stores.

### 7.2 Out of Scope

- [OUT] Claude Code adapter extension or parity: it stays a registered generated-artifact surface, not a delivery harness (OQ-M3-01).
- [OUT] Concurrent multi-mode operation, runtime mode fallback, or mode auto-detection from ambient state.
- [OUT] Harness-side configuration mutation to force model selection (writes to the harness's own configuration or store).
- [OUT] A telemetry schema bump, structural re-shape, or field removal (OQ-M3-07).
- [OUT] Backfill of seat or duration facts onto pre-change sessions.
- [OUT] Provider profile resolution, model nomination, pacing, and cost normalization — consumed as input only.
- [OUT] Tracker adapters (M3-S2/S3/S4), the parity and trap-catalog suite (M3-S5), and multi-tracker routing (M3-S6).
- [OUT] Background-service supervision, daemonization, or health management of the harness process.
- [OUT] A new CLI command surface; existing dispatch and configuration paths are extended.
- [OUT] Currency conversion, re-pricing, or cross-model cost normalization.

### 7.3 Deferred / Maybe-Later

- A configurable supported-version window once a second harness or a second delivery line exists.
- Any mode not selected as the default, if a later story needs it (would need its own decision and test surface).
- Background-service lifecycle management for a long-lived harness instance.
- Telemetry v3 if a future harness cannot express seat or duration facts as fields.
- Claude Code per-seat propagation if it ever becomes a delivery harness.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no public HTTP surface is added or changed. If the chosen integration mode reaches the harness through a local service endpoint, that transport is internal to the adapter and is not a `jaiship` surface: no client-facing endpoint, no listening port opened by this tooling, and no network contract is introduced.

### 8.2 Events / Messages

| Direction | Element | Contract |
|-----------|---------|----------|
| Outbound | Version probe invocation | One bounded, shell-free invocation through the delivered child-process seam at resolution; no session, no prompt, no declared allowlist bypass |
| Internal | Spawn descriptor environment records | The resolved per-seat model record map carried as data per spawn; record values win for declared names; undeclared names change nothing |
| Inbound | Harness JSONL stream | Unchanged read-only consumption over the delivered streaming seam; the change adds no frame-parsing contract beyond the delivered step/evidence decoding |
| Storage | `harness.telemetry` rows | Additive fields (seat identity, resolved model, durations) under the unchanged `delivery.harness.telemetry.v1` identity; schema version and harness version stamped per row |
| Derived | Refusal disclosure | Every version, mode, and profile refusal names the identity, the observed/requested value, the supported or available alternative, and a remediation hint |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Supported-version window | The declared minor lines a harness may run on; carried as data with the evaluation verdict; ships one pinned default |
| DM-2 | Version evaluation result | The verdict (inside, outside, indeterminate) with the observed version (or explicit unknown) and the warning that rides an unknown |
| DM-3 | Integration-mode declaration | The declared mode, its origin (default or configured), and the closed vocabulary of modes a dispatch may request |
| DM-4 | Profile propagation record | Per seat: the declared model variable name, the resolved model value, and the seat identity, carried into the spawn descriptor |
| DM-5 | Seat telemetry attribution | Additive row fields: seat identity, resolved model, and the observed harness-reported model with its divergence warning |
| DM-6 | Duration fields | Additive per-row durations (start, end, and elapsed) or an explicit absence with a closed warning; never derived from capture time |
| DM-7 | Conformance scenario set | The delivered six-scenario floor plus the version-window, unknown-version, mode-unavailable, and profile-propagation scenarios |

### 8.4 External Integrations

- **opencode harness v2.x (v2.2.5 observed at intake).** The version string, the CLI surface (`run --format json`, `--session`, session listing, the standalone/service subcommands), and the session store layout are external truth consumed read-only. The store is opened read-only with the query-only pragma before the first read and only bounded indexed queries are issued; a version-line outside the window is a declared refusal, not an attempted adaptation.
- **Decision records (`doc/decisions/`).** Governed by `.ai/agent/decision-instructions.md`: sequential per-type identifiers, `doc/decisions/<TYPE>-<zeroPad4>-<slug>.md`, `Proposed` status for anything not auto-acceptable.

### 8.5 Backward Compatibility

- The delivered harness port shapes stay valid: `HarnessInstance`, `HarnessSessionPort`, the one-shot runner, and the streaming starter keep their members and semantics; additions are optional members or new closed vocabularies.
- The delivered failure identities keep their meaning: `harness.spawn.refused`, `harness.spawn.invalid-output`, `harness.spawn.variable-missing`, `harness.session.unknown`, `harness.capability.gap`, `harness.listing.invalid-output`, and the three telemetry identities are neither renamed nor repurposed.
- `delivery.harness.telemetry.v1` gains fields only; every pre-change row remains readable, and a consumer that ignores the new fields behaves exactly as before.
- The deny-by-default spawn environment is preserved: no ambient variable is forwarded, and the profile record map supplies values only for already-declared names.
- A harness that reports no version continues to resolve with the delivered `version-probe-failed` warning at the instance level; the refusal is the dispatch-level consequence, not a redefinition of the warning.
- The delivered six-scenario conformance floor and both registrations survive unchanged; new scenarios are additions to the same registry.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Refusal before side effects | A version, mode, or profile refusal occurs before any child process is started: zero spawned sessions, zero orphan processes, zero telemetry rows written, zero store writes |
| NFR-2 | Version-probe bound | The probe resolves within 5 s in the reference environment; a probe that cannot answer within the bound is an explicit indeterminate version, never a retried loop and never a fabricated version |
| NFR-3 | Bounded store reads | Read-only open, query-only pragma before the first read, bounded indexed queries only, no message/part scans; caps unchanged (64 sessions, 16 agents, 16 models, 24 tools per agent) with explicit truncation marks |
| NFR-4 | Bounded output | Machine payload ≤ 65 536 UTF-8 bytes; human disclosure ≤ 4 096 bytes and ≤ 24 lines; truncation deterministic, tail-ordered, and marked; refusal identities and remediation hints are never truncated |
| NFR-5 | Telemetry privacy | Rows and refusals carry identity references, counts, costs, and durations only — never prompt text, message bodies, transcripts, diffs, tool output, credential material, or harness configuration values |
| NFR-6 | Non-fabrication | No figure is invented: a missing cost is null, a missing token class is null with a warning, a missing duration is explicitly absent, a missing version is the explicit unknown; zero is never a substitute for absence |
| NFR-7 | Determinism | Byte-identical output for identical injected harness facts, probe result, resolved profile, and clock; zero model calls and zero network on any evaluation, refusal, or render path |
| NFR-8 | Spawn non-interference | Version evaluation, mode resolution, and profile propagation add no blocking work to the delivered stream drain, handle acquisition, or output-bound behavior |
| NFR-9 | Environment purity | No ambient environment read outside the injected seams; the profile record map is passed as data, and adapters continue to read no ambient environment |
| NFR-10 | Offline verification | 100% of new tests run offline against simulated harness I/O and fixture stores; zero live harness invocations, credentials, or network |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- Every version, mode, and profile refusal is a classified outcome on the result envelope with its identity, the observed or requested value, the supported or available alternative, and a remediation hint — never a bare exit status.
- Every dispatch discloses the evaluated version verdict and the selected mode as part of its recorded outcome, so a later reader can tell which harness line and mode produced the delivery.
- Telemetry capture stays non-gating: a capture degradation is classified with counts and closed-vocabulary warnings and never changes a delivery's outcome, phase, summary, or verdict.
- Per-seat attribution discloses unresolved seats and model divergence with counts and reasons — never silently dropped and never reconciled by overwrite.
- Every invocation lands its delivered command-audit record; an audit-write failure is a diagnostic and never changes the outcome.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The harness does not honour the per-seat model variable family, so propagation is nominally correct but inert and the ticket AC cannot be proven | H | M | The spike verifies the propagation surface before the contract is pinned; a seat may declare an explicit `envName`; an unexpressible required seat refuses with `harness.profile.model-unrepresentable` rather than passing silently (OQ-2) | M |
| RSK-2 | The pinned window (`2.2.x` + `2.1.x`) ages out with the next minor release and blocks delivery | M | H | The window is data with a declared revisit trigger on each harness minor release; a future configurable window degrades to the pinned default instead of widening silently | M |
| RSK-3 | The spike is inconclusive or overruns, leaving the mode undecided at delivery | M | M | The delivered pre-spike default is stated (OQ-1) so the requirements stay executable; the decision record is an explicit delivery deliverable with AC-F2-2 | M |
| RSK-4 | The `2.1.x` line's store layout differs from the observed `2.2.5` shape, so seat, token, or duration facts are absent there | M | M | Degrade with closed-vocabulary warnings where identity/token fields exist, classify only the unextractable session as failed, never fabricate (OQ-3) | M |
| RSK-5 | New refusal identities fragment the error table or duplicate delivered meanings | M | L | Each identity is declared once with exit projection and remediation hint; delivered identities keep their meaning; a contract test pins the closed vocabulary | L |
| RSK-6 | Deny-by-default environment is weakened while adding profile propagation | H | L | The record map only supplies already-declared names; structure and behaviour tests pin undeclared-name neutrality and absent-ambient-forwarding | L |
| RSK-7 | Seat attribution double-counts when per-step rows roll up to session totals | M | M | Seat attribution is an added dimension on the delivered grouping; totals keep the delivered reading basis and per-step ingest stays non-gating | M |
| RSK-8 | Version evaluation on the dispatch path adds latency or a process per attempt | L | M | One bounded probe per dispatch, shell-free, with a 5 s bound (NFR-2) and no retry loop | L |

## 12. ASSUMPTIONS

- The installed harness exposes its version through one bounded, shell-free invocation, and the probe failure modes stay distinguishable from a version outside the window.
- The resolved profile's per-seat model record is available at spawn time as validated data; profile resolution itself remains delivered behavior.
- The harness session store exposes per-session seat/model, token, cost, and duration facts for at least the observed `2.2.5` line; where it does not, the absence is explicit.
- The delivered telemetry row grouping (per session/agent/model) is the right coarse grain; seat identity is added as a dimension, not a re-shape.
- Exactly one mode can be the delivered default because a solo-operator delivery path needs one tested transport, not a matrix.
- Decision records follow `.ai/agent/decision-instructions.md`; the adapter-contract record stays `Proposed` until a human decides where rigor requires it.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Harness adapter seam (M1-S11, delivered) | Port shapes, streaming spawn, deny-by-default environment, profile record map, conformance registry |
| Depends on | Harness telemetry v2 (M2-S14, delivered) | Row families, per-step ingest, closeout capture, spend read side, storage-bounds discipline |
| Depends on | Provider profiles and environment records (GH-234, delivered) | Per-seat model derivation and the data-v1 record contract |
| Depends on | Dispatch engine (GH-239, delivered) | The consumer that must carry the version and mode verdict |
| Depends on | Result contract and error table, configuration layer, state layer (delivered) | Identity registration, exit projection, harness branch, fenced appends |
| Depends on | opencode v2.x (external) | Version string, CLI surface, and read-only session store |
| Blocks | M3-S5 adapter conformance and parity suite | The harness-port scenarios this change registers are the floor the suite extends to trackers |
| Blocks | M3-S2/S3/S4 tracker adapters (indirectly) | They assume a working harness plane for end-to-end delivery evidence |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Which integration mode is the delivered default: standalone service, background service, or direct API? | The ticket makes the spike and its record deliverables; OQ-M3-02 answers "no strong preference; direct DB access for usage analytics is likely needed". The requirement set is mode-parametrized, so the choice changes configuration and tests, not contracts | Open — the in-change spike decides and a decision record records it. Stated default until then: standalone per-spawn invocation of the harness CLI with read-only direct store access for telemetry (the delivered adapter's behaviour). Decision needed: consult `@decision-advisor` |
| OQ-2 | Does opencode v2.x honour the per-seat model variable family (`OC_<PREFIX>_AGENT_<SEAT>_MODEL` or an explicit seat `envName`), or does it select models through its own configuration surface? | Propagation cannot be asserted without knowing where the harness reads seat models; the delivered derivation is a naming convention, not a proven contract | Open — the spike verifies the surface. Stated default: the declared per-spawn variable family is the propagation contract; a seat that the harness cannot receive declares an explicit `envName` it honours; otherwise the seat is unrepresentable and refuses. Decision needed: consult `@decision-advisor` (recorded with the contract record) |
| OQ-3 | For an in-window `2.1.x` harness whose store layout differs from the observed `2.2.5` shape, does extraction degrade with warnings or classify the session as failed? | The window includes a minor line whose store shape was not observed at intake; both answers preserve "no fabrication" but differ in how much data survives | Open — the test plan and extraction fixtures pin the answer. Stated default: degrade with closed-vocabulary warnings wherever the mandatory identity and token fields exist, and classify only a session whose mandatory fields are absent as failed. Decision needed: consult `@decision-advisor` if the fixtures cannot settle it |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The supported window is the current minor line at delivery time plus one previous minor — `2.2.x` plus `2.1.x` at intake, from the observed `v2.2.5` — evaluated once per dispatch at resolution, and unsupported versions refuse with a typed identity. No configurable window ships; a future configured value that cannot be honoured degrades to this default, never to an unbounded or wider window | GH-342 question Q-06 is unanswered, so its stated default applies; the milestone risk table names a version window with typed refusal as the mitigation for CLI flag drift; a pinned default keeps the refusal testable and prevents a configuration path from accidentally widening acceptance | 2026-11-17 |
| DEC-2 | Exactly one integration mode is the delivered default, and a dispatch never falls back between modes; any other requested mode refuses with `harness.mode.unavailable` | EC-1 requires the mode to be decided and documented; a silent fallback would make the decision unobservable, hide transport failures, and multiply the tested surface for a solo-operator delivery path | 2026-11-17 |
| DEC-3 | An undeterminable version refuses with a distinct closed identity `harness.version.unknown` rather than reusing `harness.version.unsupported` | Reporting an unknown version as unsupported asserts a fact the system does not have; the repository's no-fabrication rule applies to classification as much as to numbers, and a distinct identity lets an operator fix a broken installation instead of "upgrading" a harness that is already fine | 2026-11-17 |
| DEC-4 | Telemetry growth stays inside `delivery.harness.telemetry.v1`: fields are added, none removed or renamed, and a new major version is reserved for a structural change or a removal | OQ-M3-07 answers "backward compatible; add fields, never remove; new version only on a structural change"; the state ledger and the spend read side both branch on the identity constant, and an unnecessary bump would strand captured rows | 2026-11-17 |
| DEC-5 | Per-seat attribution carries the resolved model beside the harness-reported model and discloses divergence; the harness-reported value is never overwritten | The profile is the intent and the harness report is the observation; overwriting either destroys the only evidence that propagation worked or silently failed, which is the exact gap this story exists to close | 2026-11-17 |
| DEC-6 | A required seat model that cannot be expressed as a declared per-spawn variable refuses with a dedicated identity `harness.profile.model-unrepresentable` rather than proceeding with a partial profile | A partially propagated profile produces a delivery whose cost and quality facts belong to the wrong seat; refusing keeps the AC "runs with the resolved profile" honest, and a dedicated identity makes the seat and reason actionable | 2026-11-17 |
| DEC-7 | The adapter-contract refinements (window and two version identities, mode declaration and identity, propagation contract and identity, seat/duration telemetry fields, absence identity) are governed by a technical decision record authored in this change, and the integration-mode selection is recorded as its own decision record — both following the TDR-0016/TDR-0021 precedent | The repository rule is that a harness adapter-contract change is governed by a recorded decision; the ticket also makes the mode decision an explicit deliverable, and separating "which mode" from "how the contract changes" keeps each record challengeable on its own merits | 2026-11-17 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Harness contracts (kind, operations, failure vocabulary, instance) | Updated — additive window/mode/profile vocabularies and identities |
| Configured-kind registry and version probe seam | Updated — window evaluation carried as a verdict on the instance; no silent default |
| opencode adapter (spawn, deliver, resume, listing) | Updated — mode selection, profile propagation into the descriptor, refusal paths, attach |
| Spawn-environment builder and profile record propagation | Updated — declared-name-only record binding with unchanged deny-by-default posture |
| Telemetry extraction (opencode extractor, per-step ingest) | Updated — seat attribution, resolved model, durations, additive fields |
| State-layer telemetry records and spend read side | Updated (read-compatible) — new fields consumed additively; no schema bump |
| Error table and result envelope | Updated — additive identities with exit projection and remediation hints |
| Configuration branch (harness) | Updated — the mode value; window remains pinned data, not a key |
| Conformance registry | Updated — new scenarios beside the unchanged six-scenario floor |
| Decision records (`doc/decisions/`) | New — the adapters-contract record and the integration-mode record |
| Harness feature spec and NFR rows (`doc/spec/`) | Updated in the documentation phase — current truth for the window, mode, propagation, and seat telemetry |
| Dispatch engine consumer | Updated — carries the version verdict and mode into its outcome |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an installed harness version inside the supported window and a resolved profile, **when** a dispatch resolves the harness, **then** the dispatch proceeds and the observed version and window verdict are carried on the resolved instance | F-1, DM-1, DM-2 |
| AC-F1-2 | **Given** an opencode version outside the supported window, **when** a dispatch is attempted, **then** it refuses with `harness.version.unsupported` (exit 1, remediation naming the supported window) and no session is spawned | F-1, DM-1, DM-2, TC-M3-HARNESS-002 |
| AC-F1-3 | **Given** a harness version that cannot be determined or parsed, **when** a dispatch resolves the harness, **then** it refuses with `harness.version.unknown`, the observed version remains the explicit unknown, and no version is fabricated and no dispatch proceeds silently | F-1, DM-2, NFR-6 |
| AC-F1-4 | **Given** the window policy is carried as data, **when** no configurable value is present or a configured value cannot be honoured, **then** the pinned default window applies and never an unbounded or silently wider window | F-1, DM-1 |
| AC-F2-1 | **Given** the delivered default integration mode, **when** a dispatch spawns a session, **then** exactly that mode is used and no other mode is attempted as a runtime fallback | F-2, DM-3 |
| AC-F2-2 | **Given** the integration-mode spike is complete, **when** the change is delivered, **then** a decision record states the chosen mode among standalone service, background service, and direct API (including the read-only direct-store rationale) and is linked from this change and the harness feature spec | F-2, G-8 |
| AC-F2-3 | **Given** a requested mode the installed harness or the delivery does not support, **when** a dispatch runs, **then** it refuses with `harness.mode.unavailable` before any spawn, naming the requested and the available mode | F-2, DM-3, NFR-1 |
| AC-F2-4 | **Given** the mode is expressed on the harness configuration branch, **when** it is omitted, **then** the delivered default applies with a declared `defaults` origin; **and when** it carries an unknown value, **then** it is refused rather than silently defaulted | F-2, DM-3 |
| AC-F3-1 | **Given** a resolved profile with seat models and an installed in-window opencode, **when** the harness port spawns an agent session, **then** the spawn descriptor carries each declared seat's model record and the session reports the resolved per-seat models, and telemetry rows carry those seats with tokens and cost | F-3, F-5, DM-4, TC-M3-HARNESS-001 |
| AC-F3-2 | **Given** a declared model variable name with both a resolved record value and a conflicting ambient parent value, **when** the spawn environment is built, **then** the record value wins | F-3, DM-4, NFR-9 |
| AC-F3-3 | **Given** record names that are not declared in the environment allowlist, **when** the spawn environment is built, **then** they change nothing and no undeclared parent variable is forwarded | F-3, NFR-9 |
| AC-F3-4 | **Given** a required seat model that cannot be expressed as a declared per-spawn variable, **when** the spawn is prepared, **then** it refuses with `harness.profile.model-unrepresentable` naming the seat and no session is spawned | F-3, DM-4, NFR-1 |
| AC-F4-1 | **Given** an existing session for the work item, **when** a resume or attach dispatch runs, **then** it continues that session identity with the tree root preserved and the same propagation contract, and an unknown or different session keeps the delivered `harness.session.unknown` semantics | F-4, DM-4 |
| AC-F5-1 | **Given** a completed session, **when** telemetry rows land in the state layer, **then** every row stamps the schema version and the harness kind and version and carries the seat identity, the resolved seat model, the harness-reported model, the five token classes, calls, cost (null when missing), and durations | F-5, DM-5, DM-6 |
| AC-F5-2 | **Given** rows captured before this change under `delivery.harness.telemetry.v1`, **when** they are read after the change, **then** they remain readable and unchanged, and the new fields are additions with no removal or rename and no new major version | F-5, NFR-6 |
| AC-F5-3 | **Given** a row whose resolved seat model differs from the harness-reported model, **when** the row lands, **then** both values are kept and the divergence is disclosed with a closed-vocabulary warning — never reconciled by overwriting | F-5, DM-5, DEC-5 |
| AC-F5-4 | **Given** a session store that does not expose a duration, **when** the row lands, **then** the duration is explicitly absent with a closed-vocabulary warning and is never derived from the capture timestamp or estimated | F-5, DM-6, NFR-6 |
| AC-F6-1 | **Given** a session with no telemetry rows, **when** telemetry is requested for that session, **then** it returns `harness.telemetry.absent` at exit 1 and no zero-valued row is produced | F-6 |
| AC-F6-2 | **Given** a harness store that cannot be opened or read, **when** telemetry is requested, **then** the delivered `harness.telemetry.extraction-failed` identity is returned and the outcome is never re-projected as absence | F-6, NFR-3 |
| AC-F7-1 | **Given** the delivered conformance registry, **when** the suite runs, **then** both registered harnesses still cover the unchanged six-scenario classification floor and pass | F-7, DM-7 |
| AC-F7-2 | **Given** the extended registry, **when** a registered harness misses a version-window, unknown-version, mode-unavailable, or profile-propagation scenario, **then** the suite fails and names the harness and the scenario | F-7, DM-7 |
| AC-F7-3 | **Given** the conformance suite, **when** it runs in CI, **then** it executes offline against simulated harness I/O and performs zero live harness invocations | F-7, NFR-10 |
| AC-N1-1 | **Given** any version, mode, or profile refusal, **when** the refusal is produced, **then** no child process has been started, no orphan process survives, no telemetry row is written, and no other side effect of the attempted spawn remains | NFR-1, NFR-8 |

Traceability note: AC-F1-2 is TC-M3-HARNESS-002 in Given/When/Then form, and AC-F3-1 plus AC-F5-1 carry TC-M3-HARNESS-001. The ticket AC decomposes as: a dispatch through the installed harness port runs with the resolved profile (AC-F2-1, AC-F3-1..AC-F3-4, AC-F4-1), telemetry rows land with schema version and per-seat models (AC-F5-1, AC-F5-3, AC-F5-4), unsupported versions refuse with a typed error (AC-F1-2, AC-F1-3, AC-N1-1), and the integration-mode decision is recorded (AC-F2-2). EC-1 additionally owes the recorded mode and the versioned telemetry outcome, covered by AC-F2-2 and AC-F5-1.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered through the repository's standard change lifecycle on this change's branch: plan phases declared in the change plan, each phase gated and committed at its boundary, quality gates green before the pull request, and the pull request targeting the tooling integration branch (`main-tools`).
- The change is self-contained and additive; no operator migration action is required. A developer already running an in-window opencode needs no change; an out-of-window installation now refuses with an actionable identity instead of proceeding unexamined.
- The integration-mode spike and its record land inside this change, before the mode-dependent behavior is delivered, so the record precedes the code it governs.
- Planning and system documentation reconciliation (harness feature spec, non-functional rows, decision index, milestone status markers) happens in the dedicated documentation phase.
- M3-S5 (conformance and parity suite) consumes the extended registry after this change lands; no external coordination is required.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

- No migration. `delivery.harness.telemetry.v1` gains fields; existing rows keep their exact shape and remain readable, and the state schema version is unchanged.
- Pre-change sessions carry no seat attribution and no durations. They are not backfilled: a read of such a row shows the explicit absence, never a fabricated seat or a derived duration.
- Test seeding uses committed fixture stores and simulated harness I/O; no live harness store, credentials, or network (NFR-10).

## 20. PRIVACY / COMPLIANCE REVIEW

- Telemetry rows and refusal disclosures carry identity references (work item, run, session, seat, agent, model, harness kind and version), counts, cost, and durations only — never prompt text, message bodies, transcripts, diffs, tool output, credential material, or harness configuration values.
- The resolved per-seat model values are provider model identifiers, not secrets; the profile record stays under the delivered data-v1 record contract and is never rendered into a payload.
- All telemetry stays local; the change adds no export, no background process, and no new retention regime.
- The delivered redaction chokepoint composes unchanged on every new disclosure path.

## 21. SECURITY REVIEW HIGHLIGHTS

- The version probe is one bounded, shell-free invocation through the delivered single child-process seam; it adds no new process primitive, no shell interpretation, and no prompt or conversation content.
- The deny-by-default spawn environment is preserved: the profile record map supplies values only for already-declared names, and no ambient variable is forwarded.
- Harness store access stays read-only with the query-only pragma before the first read; no store write, configuration mutation, or harness-side model injection is introduced.
- Every new failure identity joins the closed error table with a stable code, a declared exit projection, and a remediation hint; a refusal never leaks a credential, a prompt, or a raw store row.
- Brand neutrality is preserved: no hardcoded product or binary name in tooling contracts; the harness command and store location remain configuration.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The supported window is a maintained constant with a declared revisit trigger: every harness minor release requires re-pinning, and the pinned value is the only place acceptance widens. A stale window shows up as an explicit refusal, not as a silent compatibility claim (RSK-2).
- The per-seat model variable family is a contract with the harness: if the harness changes how it reads seat models, the propagation surface — not the profile resolution — is what changes (RSK-1).
- Any future telemetry addition follows the same rule as this change: fields only, identity unchanged, absence explicit.
- New refusal identities are cheap to add but expensive to fork; the rule is one identity per condition, with the delivered meanings untouched (RSK-5).
- Operators should expect an out-of-window harness to block delivery deliberately; the remediation hint names the supported lines so the fix is an upgrade, not a workaround.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Supported window | The declared set of harness minor lines a dispatch accepts: the current minor line plus one previous minor |
| Version verdict | The result of comparing an observed harness version to the window: inside, outside, or indeterminate |
| Indeterminate version | A version that could not be probed or parsed; carried as the explicit unknown, never fabricated |
| Integration mode | How a dispatch reaches the harness: standalone service, background service, or direct API |
| Delivered default mode | The single mode `delivery-os`/`jaiship` dispatch uses when configuration declares nothing |
| Profile propagation | Carrying the resolved per-seat model record map into the spawn descriptor so the spawned session runs the resolved models |
| Seat | One agent role in a resolved provider profile, owning a model selection and a declared environment variable name |
| Resolved model | The model the profile selected for a seat, carried beside the harness-reported model |
| Observed model | The model the harness reported for a session, kept beside the resolved model with divergence disclosed |
| Seat attribution | The row field naming which seat a telemetry row's cost, tokens, and durations belong to |
| Durations | Start, end, and elapsed time recorded per row where the store exposes them; otherwise explicitly absent |
| Typed refusal | A classified failure with a closed error identity, exit projection, and remediation hint, produced before any side effect |
| Six-scenario floor | The delivered classification conformance scenarios every registered harness must cover |

## 24. APPENDICES

### Appendix A — Source traceability

| Source | Content used |
|--------|--------------|
| Ticket GH-335 (milestone M3, story M3-S1) | Goal, tasks, AC, dependencies (M1-S11, M2-S14 — both delivered) |
| Backlog M3-S1 | Task list: integration-mode spike with recorded decision, spawn adapter with per-spawn model propagation and session resume/attach, telemetry extraction with per-seat model/tokens/cost/durations, version detection and window, conformance tests |
| Milestone pack `m3/README.md` EC-1 | Harness portability exit criterion; typed-refusal wording resolved to a refusal |
| Milestone pack `m3/contracts.md` | Extended harness port (spawn/resume/telemetry/capabilities) and the three declared typed refusals |
| Milestone pack `m3/architecture.md` | Boundary invariants: no core branch on harness kind, declared typed refusals, env-only credentials, versioned additive telemetry with mandatory per-seat model identity |
| Milestone pack `m3/test-scenarios.md` | TC-M3-HARNESS-001 and TC-M3-HARNESS-002 (Appendix B) |
| Milestone pack `m3/open-questions.md` | OQ-M3-01 (opencode the only delivery harness), OQ-M3-02 (integration-mode spike, direct DB access allowed), OQ-M3-07 (additive telemetry versioning) |
| System spec `feature-harness-adapters.md` | Delivered port surface, opencode adapter behavior, deny-by-default environment and profile record precedence, telemetry extraction and bounds, conformance registry |
| System spec `nonfunctional.md` (harness rows) | Read budget, byte bounds, determinism, conformance-registration invariants |
| Current contracts | Harness port vocabulary and instance shapes, telemetry records and bounds, configured-kind registry with the injected version probe, per-seat environment-record derivation, typed harness configuration resolution |
| Current adapters and composition | The opencode delivery adapter, the opencode telemetry extractor, the single child-process host seam, and the production harness composition (`harnessFor` / environment builder) |
| Conformance testkit | The harness conformance registry (six-scenario floor, two registrations, coverage meta-check) |
| PM clarify_scope findings (pm-notes) | Observed harness `v2.2.5`, v2 CLI surface and store location, gap inventory G1–G5, the GH-342 Q-06 default, and the resolution of the "degrade" versus "refuse" wording |

### Appendix B — Pinned blueprint scenarios

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

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-17 | spec-writer | Initial specification for M3-S1 |

---

## AUTHORING GUIDELINES

- Derived solely from the ticket GH-335 body, the M3 milestone pack (README, architecture, contracts, test scenarios, backlog, open questions), the delivered harness feature spec and non-functional rows, and the PM clarify_scope findings recorded in the change's pm-notes.
- The delivered seam is treated as current truth: every requirement is phrased as an addition or an evaluation of behavior that already exists, and no delivered identity, port member, or scenario is redefined.
- Gaps G1–G5 are transcribed from the PM findings; every requirement maps to at least one of them or to an explicit ticket AC.
- Nothing is invented where the source material is silent: the integration-mode selection and the harness's seat-model consumption surface are recorded as open questions with stated defaults, and both are flagged for `@decision-advisor`.
- Refusals are specified by identity, exit projection, and remediation rather than by message text, so the plan and test plan can pin the contract without re-deciding it.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-335)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` equals the pm-notes milestone verbatim ("M3: Harness and tracker integrations")
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability with mitigation and residual risk
- [x] No implementation details (no file-level task steps, no code instructions)
- [x] No content duplicated from linked docs
