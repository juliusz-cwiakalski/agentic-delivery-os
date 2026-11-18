---
id: TDR-0034
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "Exactly one integration mode is the delivered default for opencode dispatch — the per-invocation private server, the surface the installed opencode v2.3.2 exposes as `--standalone` and the wrapper on the observation host already prepends — expressed as a declared value on the typed harness configuration branch (absent → the default with a `defaults` origin), evaluated once per dispatch and never inferred from ambient state or switched at runtime; the managed background service and the client to a running server stay declared members of the closed mode vocabulary and refuse with `harness.mode.unavailable`, naming the requested and the available mode, before any session exists. Telemetry reads the harness store read-only through the same decision: one bounded, query-only, direct-store read per capture in the harness data directory, never a write, a configuration mutation, or a service lifecycle operation."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os harness plane (opencode integration mode, mode configuration expression, mode refusal, read-only store access)"
decision_scope: repo
review_date: null
classification:
  domains: [architecture, contracts, tooling]
  archetype: selection
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-335 spec G3/DEC-2/G-3: an integration mode is a mode in fact today but is never declared, configured, refused, or recorded, so the spike and its record are ticket deliverables)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-335 PR review; AI does not accept this R2 record"
  contributors:
    - "@spec-writer (chg-GH-335-spec §5.1 F-2, §6 Flow 1, §7.1, AC-F2-1/AC-F2-3/AC-F2-4, DEC-2/DEC-7)"
    - "@plan-writer (chg-GH-335-plan Phase 1.1-1.3, Phase 3.2, Phase 4.3)"
    - "@readiness-reviewer (readiness iterations 1-6, the mode-record findings)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "@decision-critic (independent review artifact chg-GH-335-decision-review.md)"
    - "Human owner (GH-335 PR review)"
  performers:
    - "@coder (GH-335 Phase 2: DEFAULT_HARNESS_MODE and the mode vocabulary; Phase 3: mode resolution with its origin; Phase 4: the selected mode on the honoured surface)"
    - "@doc-syncer (GH-335 Phase 8: feature-harness-adapters and feature-config-layer)"
  informed:
    - "Operators of `dispatch` (an unavailable mode refuses by identity instead of degrading silently)"
    - "The telemetry capture path (it reads the store read-only and never mutates harness state)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A second mode becomes the delivered default: the default changes by a new record, and `DEFAULT_HARNESS_MODE` moves with it in one commit (the constant-equality assertion this record's delivery ships fails otherwise)."
  - "A mode's observed surface changes on a newly installed harness line: the mode member's declared surface is re-observed and re-recorded, because the mode is defined by the surface the harness honours, not by a label."
  - "A dispatch must fall back between modes at runtime: that is a reversal of DEC-2 and needs its own decision, its own refusal identity removal, and a doubled test surface."
  - "Telemetry must write to the harness store, mutate harness configuration to force a model, or manage the harness service lifecycle: each is out of scope here and each would reverse a constraint below."
  - "The harness store location is re-rooted by a later harness line: the configured path and its override are reconciled by a follow-up record rather than by widening the reader."
links:
  related_changes: ["GH-335"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-spec.md"
    - "doc/spec/features/feature-harness-adapters.md"
    - "doc/spec/features/feature-config-layer.md"
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/config/catalog.ts"
    - "packages/core/src/config/defaults.ts"
    - "packages/core/src/config/harness.ts"
  diagrams: []
  decisions: ["ADR-0008", "TDR-0016", "TDR-0021", "TDR-0032", "TDR-0033"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S1"]
---

# TDR-0034: opencode Integration Mode — One Declared Default, Selected Never Inferred

## Context

- **FACT:** The installed harness reports `opencode v2.3.2` on stdout (exit 0, empty stderr), and its mode surfaces are the per-invocation private server (`--standalone`), the managed background service (`service start|restart|status|stop`), and a client to a running server (`--server`, `api`; the harness's `serve` starts that server) (spec Appendix C; read 2026-11-18).
- **FACT:** The delivered adapter starts one harness process per spawn and reads the harness session store read-only for telemetry (`packages/adapters/src/harness/opencode.ts`; `packages/adapters/src/harness/telemetry-opencode.ts`, read 2026-11-18). That behaviour is a mode in fact, but no mode is declared, configured, refused, or recorded as a decision.
- **FACT:** The typed harness configuration branch carries `kind` and the store settings, and the mode is absent from it (`packages/core/src/config/catalog.ts`, `packages/core/src/config/harness.ts`, read 2026-11-18).
- **FACT:** No mode identity exists in the closed harness failure vocabulary, and no path refuses an unavailable requested mode (`packages/core/src/contracts/harness.ts:294-306`).
- **FACT:** On the observation host the harness on `PATH` is a wrapper that prepends `--standalone`, so the surface that actually runs today is the per-invocation private server (spec Appendix C; observed 2026-11-18).
- **FACT:** `doc/decisions/` contains no integration-mode record; ADR-0008 governs the harness adapter contract and states no mode (`doc/decisions/00-register.md`, read 2026-11-18).
- **FACT:** The harness store is a SQLite file in the harness data directory with two coexisting session generations, and the delivered telemetry path reads it; the store accepts `PRAGMA query_only` before reads (spec Appendix C, DM-10).
- **Why now:** GH-335's ticket makes the spike and its record deliverables (G-3, G-8), and the mode must be observable, configurable, and refusable before any mode selection is implemented in the dispatch path.

## Problem Framing (Clarified)

**Question.** Which of the three mode surfaces the installed opencode line exposes is the delivered default for `delivery-os`/`jaiship` dispatch, how is it expressed and refused, and what does the telemetry path need from the same decision?

**Clarified problem.** Dispatch must run the harness on exactly one decided surface. A mode chosen by accident (whatever the wrapper happens to prepend) cannot be asserted, configured, or refused, and a runtime fallback would make the decision unobservable and double the tested surface. The telemetry path additionally needs read-only access to the store the harness writes, because the store is the only source of the session facts the rows carry.

**In scope.** The default mode; its configuration expression and origin; the closed vocabulary of requestable modes; the refusal for an unavailable requested mode; the read-only direct-store rationale for telemetry.

**Out of scope.** Concurrent multi-mode operation; runtime fallback; harness-side configuration mutation; background-service lifecycle management by this tooling; a new command surface.

## Constraints (Hard Requirements)

### C-1: Exactly one mode is the default and the others refuse

Exactly one member of the closed mode vocabulary is the delivered default. Any other requested member refuses with a single closed identity (`harness.mode.unavailable`) naming the requested and the available mode, before a lease is claimed and before a session-bearing child process starts. No request degrades into the default silently.

### C-2: The mode is declared or defaulted, never inferred

The mode value comes from the typed harness configuration branch or from the declared default. It is never read from an environment variable, a process-global value, ambient state, or the shape of the installed binary. Omitted → the default with the `defaults` origin; present → `configured`. An unknown value is the delivered `config.value.invalid` naming the path; it is never defaulted.

### C-3: No runtime fallback and no concurrent modes

A dispatch selects one mode and stays on it for every spawn, deliver, resume, and attach of that dispatch. A failure never switches mode.

### C-4: Telemetry reads the store read-only, and only reads

The telemetry path opens the harness store read-only, sets `PRAGMA query_only` before its first read, issues bounded indexed statements, and performs no write, no schema mutation, no configuration mutation, and no service lifecycle operation. The store is the harness's own data directory file; the configured path is reconciled there.

### C-5: The mode is additive within the delivered configuration and result contracts

No configuration key is removed or renamed; the mode key is additive on the harness branch. No result-envelope shape changes beyond the declared `detail.harness` member of TDR-0033, and no new command, verb, or exit projection is added.

### C-6: The chosen mode's value is the single authored constant

The record names the mode value the contract constant `DEFAULT_HARNESS_MODE` carries, and the two are asserted equal by a test in the delivering change. A second authored copy of the mode vocabulary does not exist.

## Decision Drivers

1. **Observability.** A reader must be able to tell which mode produced a delivery (C-1, C-2).
2. **Honesty over convenience.** A mode that cannot run must refuse, not degrade (C-1, C-3).
3. **Smallest honouring surface.** The mode must be the one the installed harness actually runs today, so the delivered behaviour is described rather than changed (context, C-3).
4. **Read-only posture.** The harness store is an input, never an output (C-4, NG-5).
5. **Additivity.** The change extends delivered contracts rather than re-shaping them (C-5, ADR-0008, TDR-0016, TDR-0021).
6. **Reversibility.** Removing the mode key and the refusal identity restores the delivered behaviour (C-3, C-5).

## Decision Rights (DACI)

| Role | Party |
|---|---|
| Driver | `@decision-advisor` (mode selection is a ticket deliverable) |
| Approver | Human owner (GH-335 PR review) |
| Contributors | `@spec-writer`, `@plan-writer`, `@readiness-reviewer` |
| Informed | Dispatch operators; the telemetry capture path |

## Evidence, Assumptions & Unknowns

**Evidence.** The mode surfaces are observed on the installed line (context facts 1, 5). The delivered adapter already starts one process per spawn and reads the store read-only (fact 2). The configuration branch has no mode member (fact 3). No mode identity exists (fact 4). The store accepts the query-only pragma (fact 7).

**Assumptions.** A1: the installed line keeps the three surfaces named here for the supported window; a new line re-observes them (revisit trigger). A2: a per-invocation private server is sufficient for one spawn at a time, which is what the port's one-spawn-one-session contract requires.

**Unknowns.** U1: the wall-clock cost of a per-invocation server start is not measured here and is not a CI threshold (GAP-3). U2: whether a future line makes the background service cheaper is a later decision, not a defect of this one.

## Mental Models & Techniques Used

- **Selection under a closed vocabulary** (archetype: selection): the alternatives are the three declared surfaces, and the decisive criteria are the observed reality plus the refusal requirement.
- **Reversibility-first**: the selected alternative is the one whose removal restores the prior behaviour with one key and one identity removed.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| Alternative | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 |
|---|---|---|---|---|---|---|
| ALT-0 Keep the implicit behaviour | Fail | Fail | Pass | Pass | Pass | Fail |
| ALT-1 Managed background service | Pass | Pass | Pass | Pass | Pass | Pass |
| ALT-2 Client to a running server | Pass | Pass | Pass | Pass | Pass | Pass |
| ALT-3 Selected: per-invocation private server (`--standalone`) | Pass | Pass | Pass | Pass | Pass | Pass |

### Alternative 0 — Do Nothing: Keep the Wrapper's Behaviour Unstated

Nothing is declared, so nothing is configurable and nothing is refusable. C-1 fails because there is no refusal identity; C-2 fails because the mode is whatever the installed wrapper prepends; C-6 fails because there is no constant to assert. Rejected.

### Alternative 1 — Managed Background Service as the Default

`service start|restart|status|stop` would let several spawns share one service. It satisfies the constraints, but it makes this tooling own the harness's lifecycle (supervision, restart, health) — an explicit non-goal (NG-8) — and it adds a long-lived local service to every dispatch. It is also not the observed behaviour, so selecting it would change today's delivery rather than describe it. Rejected as the default; kept in the vocabulary.

### Alternative 2 — Client to a Running Server as the Default

`--server`/`api` would require an operator-started server to exist before a dispatch runs, which makes a dispatch depend on ambient state the tooling does not establish. It is not the observed behaviour and it fails the "no ambient inference" intent even when configured explicitly. Rejected as the default; kept in the vocabulary.

### Alternative 3 — Selected: Per-Invocation Private Server (`--standalone`)

The installed line exposes it, the observation host's wrapper already runs it, and it keeps one spawn in one private server with no long-lived service and no ambient dependency. It satisfies C-1 through C-6. Selected.

## Decision

- **Decision:** Adopt **ALT-3**. The delivered default mode is the per-invocation private server.
- **Chosen mode value:** `per-invocation-private-server`.
- **Declared mode surfaces (closed vocabulary):**

  | Mode member | Observed surface | Selected default |
  |---|---|---|
  | `per-invocation-private-server` | `--standalone` on `run`; the observation host's `PATH` wrapper prepends it | **Yes** — `DEFAULT_HARNESS_MODE` |
  | `managed-background-service` | `service start\|restart\|status\|stop` | No — refuses `harness.mode.unavailable` |
  | `running-server-client` | `--server`, `api` (the harness's `serve` starts the server) | No — refuses `harness.mode.unavailable` |

- **Decision statement.** Exactly one mode is the default for dispatch. The mode is a declared configuration value on the typed harness branch (`harness.mode`): omitted → the default with the `defaults` origin; present and recognised → `configured`; present and unrecognised → the delivered `config.value.invalid` naming the path, never a silent default. A recognised non-default mode refuses with `harness.mode.unavailable`, naming the requested and the available mode, before any session exists. No dispatch falls back between modes and no two modes run concurrently. The mode value the contract constant `DEFAULT_HARNESS_MODE` carries is `per-invocation-private-server`; the record and the constant are asserted equal in the delivering change.
- **Read-only direct-store rationale for telemetry.** The rows the change lands must carry facts only the harness store holds (the session's own version, the observed agent and model, token classes, cost, timestamps). The store is a file in the harness data directory; the capture opens it read-only with `PRAGMA query_only` before the first read, issues bounded indexed statements scoped by the held session identities, and projects non-content fields only. No alternative was viable: the streaming stdout carries no version stamp and no durable per-session usage, and a harness-side configuration mutation or write is out of scope (NG-5, NG-11).
- **Constraint compliance.** C-1: one default, one refusal identity, named alternatives. C-2: configuration-or-default only, with the origin recorded. C-3: one mode per dispatch, no fallback. C-4: read-only, query-only, bounded. C-5: additive key, no shape change beyond TDR-0033's member. C-6: one authored constant, asserted equal to this record's chosen value.

### Constraint Compliance Attestation

C-1 through C-6 are satisfied as stated above. No accepted-risk exception is claimed. The two non-default modes remain requestable values that refuse, not removable surfaces: a later story may select one under its own decision.

## Trade-offs & Consequences

### Positive Outcomes

- The delivered behaviour becomes assertable: a test can state the mode, the origin, and the surface (`--standalone` exactly once on the invocation).
- An unavailable mode refuses by identity instead of silently running the default, so an operator sees the decision instead of a surprise.
- Telemetry's read-only posture has a recorded rationale, so a later "just write it back" proposal has a named constraint to argue against.
- The mode vocabulary is one authored constant; the record cites it rather than duplicating it.

### Negative Outcomes

- Every dispatch pays one private-server start. This is the observed cost today, and it is a reference measurement only (U1).
- A multi-spawn delivery starts several private servers serially. That is the port's one-spawn-one-session contract, not a defect of the mode.
- The configuration surface grows by one key, and one pin must move with it. Mitigated by declaring the key additively and by asserting the unknown value as the delivered refusal.

### Unresolved Questions

- U1 (wall-clock per-invocation start) is a reference measurement, never a CI threshold.
- Whether a later harness line makes the background service preferable is deferred to a future selection record.

## Implementation Plan

| Surface | Change |
|---|---|
| `packages/core/src/contracts/harness.ts` | The closed mode vocabulary with its observed surface per member, `DEFAULT_HARNESS_MODE`, and the mode-origin vocabulary (`defaults` / `configured`). |
| `packages/core/src/config/catalog.ts` | The typed `harness.mode` key. |
| `packages/core/src/config/defaults.ts` | The shipped default carrying this record's chosen mode value. |
| `packages/core/src/config/harness.ts` | The projection into `HarnessSettings`; an unknown value classified `config.value.invalid`. |
| `packages/core/src/domain/harness-mode.ts` | Pure resolution of the declared value with its origin; no ambient inference, no fallback. |
| `packages/adapters/src/harness/opencode.ts` | The selected mode on the honoured surface (`--standalone` once), with `harness.mode.unavailable` for any other requested mode before a session exists. |
| `packages/core/src/contracts/error-table.ts` | The `harness.mode.unavailable` row with its `user-validation` projection and remediation hint. |

## Rollback / Reversal

Remove the `harness.mode` key, the mode vocabulary, the refusal identity, and the mode-selection step: dispatch returns to starting one harness process per spawn with no declared mode, which is exactly the delivered behaviour before this change. No data migration is required and no state is written.

## Communication Plan

The harness adapters page and the configuration-layer page state the default, the origin, the refusal, and the read-only store posture. The change's pull request description names this record and its chosen mode. The change's decision review artifact carries the independent verdict on this record.

## Verification Criteria

- The mode vocabulary is exactly three closed members with a declared surface each, and `DEFAULT_HARNESS_MODE` equals `per-invocation-private-server`.
- The configuration document with no mode value resolves the default with origin `defaults`; the document with the default spelled out resolves it with origin `configured`; an unknown value refuses `config.value.invalid` naming the path with no session started.
- A dispatch on the default sends `--standalone` exactly once on its invocation and touches no other transport; a dispatch requesting either non-default mode refuses `harness.mode.unavailable` naming the requested and the available mode, with zero session starts.
- A failed spawn never changes the recorded mode and never attempts another transport.
- The telemetry path opens the store read-only, records `PRAGMA query_only` before its first read, performs no write, no schema mutation, and no service lifecycle call.
- This record is present with `status: Proposed`, an R2 body (problem framing, alternatives, consequences, verification criteria), and an index row; its chosen mode equals the contract constant (asserted by the delivering change's decision-record suite).

## Confidence Rating

**High.** The selected alternative is the one already running on the observation host and already implemented by the delivered adapter; the decision adds declaration, configuration, and a refusal rather than a new behaviour. The residual uncertainty is external (a future harness line's surfaces) and is bounded by the revisit triggers.

## References

- [GH-335 specification](../changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-spec.md) — §5.1 F-2, §6 Flow 1, §7.1/§7.2, AC-F2-1/AC-F2-3/AC-F2-4, DEC-2, DEC-7.
- [GH-335 delivery plan](../changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-plan.yaml) — Phase 1.1-1.3, Phase 2.1, Phase 3.2, Phase 4.3.
- [GH-335 spike evidence](../changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-spike-evidence.md) — the read-only mode-surface re-observation.
- [ADR-0008](ADR-0008-harness-adapter-contract.md) — the harness adapter contract this decision extends additively.
- [TDR-0016](TDR-0016-harness-streaming-spawn-seam.md), [TDR-0021](TDR-0021-additive-optional-harness-environment-marker.md) — the additive-extension precedent.
- [TDR-0032](TDR-0032-harness-seat-spawn-cardinality-and-seat-resolution.md) — the seat/carrier contract this record does not restate.
- [TDR-0033](TDR-0033-harness-dispatch-outcome-envelope-detail.md) — the refusal-disclosure member that carries the selected mode on a mode refusal.
