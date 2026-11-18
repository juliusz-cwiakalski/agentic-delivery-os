---
id: TDR-0035
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "The harness adapter contract for opencode under GH-335: the supported-version window stated as a rule (the current minor line at delivery time plus one previous minor) with its value at delivery (`2.3.x` plus `2.2.x`, derived from the installed `v2.3.2`), the accepted probe grammar and its normalization to a bare semantic version with two distinct refusals (outside → `harness.version.unsupported`, indeterminate → `harness.version.unknown`), the integration mode as a declared value with its `defaults`/`configured` origin, the propagation contract by reference to TDR-0032 and the unassigned/expressibility refusals with the expressibility check as an in-process grammar/bounds predicate and NO recognised-model catalogue and NO second pre-session child process, the recorded per-attempt binding as a run fact, and the per-seat telemetry fields over the OBSERVED store contract — seat and resolved model from the recording attempt's binding beside the harness-reported agent and observed model, store-sourced durations with explicit absence, reported zero cost recorded as reported, and an unstated observed axis carried by one declared absence marker with the delivered empty-string placeholder and the same-axis `optional-field-absent` warning, superseding the delivered `invalid-session-identity` for a merely unstated axis while keeping it for a genuinely unusable one."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os harness plane (version window and probe grammar, integration-mode contract, opencode adapter contract, per-seat telemetry over the observed store)"
decision_scope: repo
review_date: null
classification:
  domains: [contracts, architecture, telemetry]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-335 spec G1/G2/G3/G4/G7, DEC-7: a harness adapter-contract change is governed by a recorded decision, and the delivered telemetry path reads a store shape no observed store has)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-335 PR review; AI does not accept this R2 record"
  contributors:
    - "@spec-writer (chg-GH-335-spec §5.1 F-1/F-3/F-5/F-6, §7.1, §8.2, §8.3 DM-1..DM-10, AC-F1-1..AC-F1-5, AC-F3-2..AC-F3-4, AC-F5-1..AC-F5-7)"
    - "@plan-writer (chg-GH-335-plan Phase 2, 3, 4, 5, 8)"
    - "@readiness-reviewer (readiness iterations 1-6)"
    - "@decision-advisor (repository and harness observation, this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "@decision-critic (independent review artifact chg-GH-335-decision-review.md)"
    - "Human owner (GH-335 PR review)"
  performers:
    - "@coder (GH-335: the window, the probe seam, the mode contract, the adapter mapping, the telemetry fields and the absence taxonomy)"
    - "@doc-syncer (GH-335 Phase 8: the harness adapters, telemetry-v2, state-layer, spend, result-contract and dispatch-engine pages)"
  informed:
    - "The spend read side (it consumes the rows this contract shapes)"
    - "The conformance registry (its scenarios assert this contract's refusals)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The installed harness minor advances: the window's VALUE is re-applied from the rule (`2.3.x` + `2.2.x` becomes `2.4.x` + `2.3.x` at the next minor), and the constant carries its revisit note so the rule is visible beside the literal."
  - "The observed probe line changes shape (a different product token, a build suffix, a two-line answer): the grammar constant is re-observed and re-recorded, never loosened to a substring match."
  - "A second harness kind is added: the window and mode become per-kind data, and a per-kind record is required rather than widening this one for all kinds."
  - "The observed store gains or loses a readable field, or a third generation appears: DM-10 is re-observed and the fixture builders move with it; the reader never guesses a column."
  - "A consumer needs an absent observed axis as a nullable field: refused by this contract — the marker plus the placeholder is the absence signal, and widening a delivered non-null field is a schema decision of its own."
  - "The seat/carrier rules need to change: that is a TDR-0032 revision (and this record's reference is updated), not an edit here, because TDR-0032 is their single home."
links:
  related_changes: ["GH-335"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-spec.md"
    - "doc/spec/features/feature-harness-adapters.md"
    - "doc/spec/features/feature-telemetry-v2.md"
    - "doc/spec/features/feature-config-layer.md"
    - "doc/spec/features/feature-state-layer.md"
    - "doc/spec/features/feature-spend.md"
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/harness-telemetry.ts"
    - "packages/core/src/contracts/result.ts"
    - "packages/adapters/src/harness/opencode.ts"
    - "packages/adapters/src/harness/telemetry-opencode.ts"
  diagrams: []
  decisions: ["ADR-0008", "TDR-0016", "TDR-0021", "TDR-0032", "TDR-0033", "TDR-0034"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S1"]
---

# TDR-0035: opencode Harness Adapter Contract — Version Window, Mode, Propagation Reference, and Observed-Store Telemetry

## Context

- **FACT:** The installed harness reports `opencode v2.3.2`; the intake pass observed `opencode v2.2.5`. Both are a product token, an optional `v`, and a newline-terminated three-part semantic version (spec Appendix C, read 2026-11-18).
- **FACT:** `HarnessInstance` carries `observedVersion: string | null` where `null` is the explicit unknown that always rides `version-probe-failed`; no component compares it to a supported window and the closed failure vocabulary has no version or mode identity (`packages/core/src/contracts/harness.ts:102-118,294-306`).
- **FACT:** The delivered probe seam is `HarnessVersionProbe = () => Promise<string>` — no deadline, no outcome status, no clock (`packages/core/src/domain/harness-registry.ts:29-30`).
- **FACT:** The delivered telemetry extractor and the per-session totals read a store shape no observed store has: a work-item column, a separate harness-version column, per-message token/agent/model columns, and `part(tool …)` (`packages/adapters/src/harness/telemetry-opencode.ts`, `packages/adapters/src/harness/telemetry-session-totals.ts`, read 2026-11-18).
- **FACT:** The observed store has two coexisting generations (`session_v2`/`session_message`/`session_part` and `session`/`message`/`part`), records `version` on the session row as a bare semver, records the model as a structured provider/model object, records cost as `NOT NULL DEFAULT 0`, and has no work-item column anywhere (spec Appendix C, DM-10).
- **FACT:** The delivered row is non-null in `agent` and `model`, and `sameSessionGroup` already keys groups on that pair (`packages/core/src/contracts/harness-telemetry.ts:82-100`; `packages/core/src/domain/harness-telemetry.ts`).
- **FACT:** `invalid-session-identity` is a delivered warning reason used today to classify a group whose agent/model is unreadable (`packages/core/src/contracts/harness-telemetry.ts:39-49`).
- **FACT:** The delivered per-seat model record is a convention with no consumer on this harness: opencode exposes no per-seat variable family, and per-invocation selection is what it honours (spec §2.1).
- **FACT:** TDR-0032 (with Amendments A-1..A-4) is the single home of the seat cardinality, the resolution chain, the two-member carrier, the surface mapping, the seat identity with no argv carrier, the unassigned refusal, and the role-less `unresolved-seat` disclosure; TDR-0033 is the single home of the failure-envelope `detail.harness` member (read 2026-11-18).
- **Why now:** GH-335 changes the adapter contract and must be governed by a record (G-6, DEC-7); the delivered telemetry path cannot land a row against a real store (G7), so the store contract, the field set, and the absence taxonomy must be stated before the code moves.

## Problem Framing (Clarified)

**Question.** What does the opencode adapter contract become under GH-335, and what may the telemetry path read and emit, so that a harness-port spawn either runs on a compatible harness with a disclosed outcome or refuses with a typed identity, and a landed row can be attributed and read without fabrication?

**Clarified problem.** Four contract surfaces change at once and must be stated together because they share facts: the version window and its probe grammar; the integration mode and its origin; the propagation contract at the port boundary (whose rules live in TDR-0032); and the telemetry field set over the store that actually exists. Stating them separately invites drift; stating them together with explicit reference boundaries keeps one home per rule.

**In scope.** The version window rule and its delivery value; the probe grammar, normalization, and the two version refusals; the mode declaration, origin, and unavailable-mode refusal; the propagation contract by reference; the expressibility-only refusal (no catalogue, no second child process); the recorded binding as a run fact; the per-seat telemetry fields; the observed store contract; the absence taxonomy including the observed-axis absence marker.

**Out of scope.** Seat cardinality, the resolution chain, the two-member carrier, the surface mapping, the seat identity's argv treatment, the unassigned refusal, and the role-less disclosure (TDR-0032 owns them; this record cites them). The envelope member (TDR-0033). The mode selection itself (TDR-0034).

## Constraints (Hard Requirements)

### C-1: The window is a rule with a delivery value, and it is pinned data

The window is declared as data: the current minor line at delivery time plus one previous minor. Its value at delivery is `2.3.x` plus `2.2.x`, derived from the installed `v2.3.2`; the same rule read `2.2.x` plus `2.1.x` at intake. The constant carries the rule and its revisit note beside the literal. No configuration key widens or narrows it.

### C-2: The probe grammar is one constant, and every off-grammar answer is indeterminate

The accepted output is a product token, an optional `v`, and a three-part semantic version, newline-terminated; it normalizes to the bare semantic version. Empty, non-zero-exit, timed-out, multi-line, trailing-junk, two-part, four-part, or otherwise off-grammar output is `indeterminate` — never a substring match, never a partial version, never a permissive pass. A near-miss that merely contains a supported prefix parses and is out of window.

### C-3: Two distinct version refusals, before any session

An observed version outside the window refuses `harness.version.unsupported`, naming the observed version and the window. An indeterminate version refuses `harness.version.unknown`. Both refuse before a lease is claimed and before a session-bearing child process starts. The single bounded version probe is the declared exception: it completes and is reaped, and it is one bounded, shell-free invocation per dispatch with no retry.

### C-4: The mode is declared with an origin, and an unavailable mode refuses

The mode is a declared value on the typed harness branch: omitted → the delivered default with origin `defaults`; present → `configured`. An unknown value is the delivered `config.value.invalid` naming the path. A recognised non-default mode refuses `harness.mode.unavailable` naming the requested and the available mode. No runtime fallback. The selected default and its surface are TDR-0034's decision.

### C-5: The propagation rules are referenced, not restated

Seat cardinality, the resolution chain, the two-member carrier on the spawn/resume inputs, the exactly-one-`--agent`/one-`--model` surface mapping, the seat identity with no argv carrier, the unassigned named agent's refusal through the delivered `provider.profile.invalid`, and the role-less `unresolved-seat` disclosure are TDR-0032's contract (as amended by A-1..A-4). This record CITES and LINKS them and carries no obligation of its own over them; a restatement or redefinition here is a defect of this record, not a second contract.

### C-6: The expressibility refusal is a predicate, not a catalogue

A resolved model that cannot be expressed as `provider/model[#variant]` — an empty provider or model segment, a missing separator, whitespace or control characters that would corrupt the argument, or a value beyond the adapter's declared bound — refuses `harness.profile.model-unrepresentable` naming the seat, before any descriptor or binding reaches a seam. The predicate is an in-process grammar/bounds check. There is NO recognised-agent or recognised-model catalogue anywhere in the delivery, and NO second pre-session child process is introduced.

### C-7: The recorded binding is a run fact and capture cites it

A valid spawn's single-seat binding is recorded on that dispatch attempt's record as values (agent identity, seat, resolved model) beside the session identities the attempt held. Capture reads the recorded binding and attaches it only to the group whose observed agent equals the binding's agent; it never re-derives a seat from the current profile. An attempt that recorded no identity contributes nothing and is disclosed as a counted unattributed attempt; an empty union is the delivered `skipped-gap` outcome with `session-attribution-unavailable`, zero rows, and zero statements.

### C-8: Telemetry is additive within the unchanged schema identity, over the observed store

`HARNESS_TELEMETRY_SCHEMA_ID` stays `delivery.harness.telemetry.v1`; no field is removed or renamed; new fields are additive and optional. Rows are read from the observed store generations only: the session identity and tree from the session row's id and parent link, the version from the session row's own `version`, the harness-reported agent and observed model from the per-message group with the session row as baseline, tokens from the session row's token columns with per-message group detail, cost from the session row's cost (a reported zero is recorded as reported), calls from usage-bearing message rows, and durations from the store's timestamp pairs or an explicit absence. The reader never assumes a work-item column, a separate harness-version column, per-message token/agent/model/cost columns, a `part(tool …)` column, or a populated tool source.

### C-9: Absence is classified, never fabricated, and an unstated axis still lands

A missing duration, cost source, token class, or tool source is explicitly absent with a closed warning and never zero, an estimate, or derived from the capture timestamp. A group whose mandatory usage fact is present and whose observed agent or model the store states nowhere LANDS with exactly one declared absence marker naming that axis, the declared empty-string placeholder in the delivered non-null field, and the `optional-field-absent` warning on the same axis, and does NOT emit `invalid-session-identity`; an unstated observed agent yields a null seat with `unresolved-seat`. No delivered non-null field is widened to nullable. `invalid-session-identity` keeps only its literal meaning: a genuinely unusable group identity.

### C-10: Absence, degraded capture, and extraction failure stay three classifications

An unreadable or unopenable store keeps the delivered `harness.telemetry.extraction-failed` and is never re-projected as absence. A readable store that yields zero rows for a session the dispatch ran is a capture failure, never a pass. Absence is disclosed inside the delivered capture and read envelopes with no new identity and no new command or exit.

## Decision Drivers

1. **Honesty.** A compatible harness proceeds; an incompatible or unknown one refuses by identity (C-1..C-3).
2. **One home per rule.** The window, grammar, mode, seat rules, and store contract each have exactly one authored home (C-2, C-4, C-5, C-8).
3. **Observed reality over inferred shape.** Fixtures and readers model DM-10, not the delivered extractor's assumptions (C-8).
4. **No fabrication.** Absence is explicit and never a zero, an estimate, or a widened nullable field (C-9, C-10).
5. **Additivity.** The schema identity and every delivered field stay (C-8).
6. **No hidden machinery.** No catalogue, no extra child process, no ambient read (C-6).

## Decision Rights (DACI)

| Role | Party |
|---|---|
| Driver | `@decision-advisor` |
| Approver | Human owner (GH-335 PR review) |
| Contributors | `@spec-writer`, `@plan-writer`, `@readiness-reviewer` |
| Informed | Spend read-side consumers; the conformance registry |

## Evidence, Assumptions & Unknowns

**Evidence.** The probe lines, the store generations, the store's column inventory, the absent work-item column, and the absence of a per-seat variable family are observed (context facts 1, 5, 8). The delivered seams and their gaps are read in the tree (facts 2, 3, 4, 6, 7).

**Assumptions.** A1: both observed generations remain readable for the supported window; a third generation is a classified outcome, not a guessed schema. A2: the session row's `version` is the only version source, and it is a bare semver.

**Unknowns.** U1: the `2.1.x` generation is unobserved; the reader classifies an unrecognised generation rather than assuming a shape. U2: the probe grammar is observed on one harness line; the refusal for an unparseable answer is the guard, never a silent pass.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| Alternative | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 | C-7 | C-8 | C-9 | C-10 |
|---|---|---|---|---|---|---|---|---|---|---|
| ALT-0 Keep the delivered contract | Fail | Fail | Fail | Fail | n/a | Fail | Fail | Fail | Fail | Pass |
| ALT-1 A configurable window plus a recognised-model catalogue | Pass | Pass | Pass | Pass | Pass | Fail | Pass | Fail | Pass | Pass |
| ALT-2 Selected: pinned window, one grammar, reference-only seat rules, observed-store fields, declared absence | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |

### Alternative 0 — Keep the Delivered Contract

The delivered contract has no window evaluation, no grammar, no mode, no run-recorded binding, and a reader over a shape that does not exist. Only C-10 passes by default. Rejected: it is the problem statement.

### Alternative 1 — A Configurable Window and a Recognised-Model Catalogue

Making the window configuration-driven satisfies C-1's availability half but fails C-1's "pinned data" requirement and would let a configuration change acceptance, which is exactly what AC-F1-4 forbids. A recognised-model catalogue needs a supplier, a read, and either a second child process or a bundled list that goes stale, failing C-6 and adding a drift surface. Rejected.

### Alternative 2 — Selected: Pinned Window, One Grammar, Reference-Only Seat Rules, Observed-Store Fields, Declared Absence

The window is data with a rule and a delivery value; the grammar is one constant; the seat rules stay in TDR-0032 and are cited; the telemetry fields follow the store that exists; and every absence is declared. It satisfies C-1 through C-10. Selected.

## Decision

- **Decision:** Adopt **ALT-2**. The opencode adapter contract under GH-335 is stated by the constraints above, with the reference boundaries C-5 makes explicit.

- **Window (C-1).** Rule: the current minor line at delivery time plus one previous minor. Value at delivery: `2.3.x` plus `2.2.x` (installed `opencode v2.3.2`). Intake application of the same rule: `2.2.x` plus `2.1.x` (observed `opencode v2.2.5`). Pinned data; no configuration key.

- **Probe grammar and normalization (C-2).** Accepted: a product token, an optional `v`, a three-part semantic version, newline-terminated; `opencode v2.3.2` → `2.3.2`, `opencode v2.2.5` → `2.2.5`. Everything else is indeterminate. Near-misses (`2.20.0`, `12.2.5`) parse and are out of window.

- **Version refusals (C-3).** `harness.version.unsupported` (outside, observed version named) and `harness.version.unknown` (indeterminate, no fabricated version), both pre-session, both with a `user-validation` projection, both carrying the TDR-0033 evidence member. One bounded, shell-free probe per dispatch; no retry.

- **Mode (C-4).** Declared value with origin; unknown value → `config.value.invalid`; a recognised non-default mode → `harness.mode.unavailable` naming requested and available; no fallback. The selected default and its observed surface are TDR-0034's decision.

- **Propagation (C-5).** By reference only. TDR-0032, as amended by A-1..A-4, is the single home of the seat cardinality, the resolution chain, the two-member carrier, the surface mapping, the seat identity with no argv carrier, the unassigned refusal through the delivered `provider.profile.invalid`, and the role-less `unresolved-seat` disclosure. This record cites `DEC-13` and `TDR-0032` for the seat rule, and adds no obligation of its own over them.

- **Expressibility (C-6).** The predicate refuses `harness.profile.model-unrepresentable` for an empty segment, a missing separator, whitespace or control characters, or a value beyond the adapter's bound. In-process only; no catalogue; no second child process.

- **Recorded binding (C-7).** Per attempt: the held session identities and the recorded single-seat binding, additive optional members; capture cites them; each binding attaches only to its own attempt's identities; a counted unattributed attempt; an empty union is `skipped-gap`/`session-attribution-unavailable`.

- **Telemetry fields and store contract (C-8).** Additive `seat`, `resolvedModel`, `durations`, and `absentObservedAxes` under the unchanged schema identity. The delivered non-null `agent` and `model` ARE the harness-reported agent and the observed model; no duplicate member is added. Seat and resolved model come from the recording attempt's binding. Durations come from the store's timestamp pairs. A reported zero cost is recorded as reported.

- **Absence (C-9, C-10).** The five-token classes, cost, durations, tool counts, and the observed agent/model axis each have a declared absence rule. An unstated observed axis lands with the marker, the placeholder, and the same-axis warning, superseding `invalid-session-identity` for that case only. Absence, degraded capture, and extraction failure are distinct classifications inside the delivered envelopes.

### Constraint Compliance Attestation

C-1 through C-10 are satisfied as stated. No accepted-risk exception is claimed. C-5 is honoured by reference: this record names TDR-0032 and DEC-13 and deliberately does not enumerate their rules as its own obligations.

## Trade-offs & Consequences

### Positive Outcomes

- Every new refusal, field, and absence rule has one authored home, so a later change edits one place and the tests read that place.
- The telemetry path describes the store that exists, so a real store's capture can land rows and a fixture can no longer encode an invented shape.
- An unstated observed axis no longer turns a usage-bearing row into a failure: it lands with a machine-readable marker beside the delivered placeholder.
- The window's rule is visible beside its literal, so a harness minor advance re-applies a rule rather than silently keeping a stale default.

### Negative Outcomes

- Nine constraints and four field groups must move together in one delivery; a partial move leaves a documented contract ahead of the code. Mitigated by the plan's per-phase scope and by the contract-first phase.
- The empty-string placeholder in a non-null field is less ergonomic than a nullable field for a consumer. Accepted because widening a delivered field is a schema decision this change forbids; the marker is the machine signal.
- The recorded binding duplicates, as run facts, values the profile could re-derive. Deliberate: citing the run is what keeps capture from re-deriving a seat from a profile that may have changed.

### Unresolved Questions

- U1 (the `2.1.x` store generation) stays an unobserved generation, classified honestly.
- U2 (a second harness line's grammar) is guarded by the unknown-version refusal.

## Implementation Plan

| Surface | Change |
|---|---|
| `packages/core/src/contracts/harness.ts` | Window data and rule, grammar constant, probe outcome types and boundary, verdict/mode/origin vocabularies, the new failure identities, the mandatory-field constants. |
| `packages/core/src/contracts/harness-telemetry.ts` | Additive `seat`, `resolvedModel`, `durations`, `absentObservedAxes`, the closed warning reasons, and the placeholder constant. |
| `packages/core/src/domain/harness-version-window.ts` | Parse, normalize, compare, and classify. |
| `packages/core/src/domain/harness-mode.ts` | Resolve the declared mode with its origin. |
| `packages/core/src/domain/harness-registry.ts` | The deadline seam, one verdict per resolution, the resolved mode on the instance. |
| `packages/adapters/src/harness/opencode.ts` | The selected mode on the honoured surface, the refusals before any session, resume/attach under the same contract. |
| `packages/adapters/src/harness/telemetry-opencode.ts` | Extraction over DM-10, both generations, the absence taxonomy, the observed-axis marker. |
| `packages/core/src/state/harness-telemetry.ts` | The payload allowlist persists the additive fields and the placeholder unchanged. |
| `packages/core/src/contracts/error-table.ts` | The four new rows. |
| `doc/spec/features/*` | The reconciled pages (Phase 8). |

## Rollback / Reversal

Remove the additive contract members, the four refusals, the window evaluation, and the additive telemetry fields; restore the delivered reader. No data migration is needed: stored rows stay readable because every added field is optional, and the schema identity is unchanged. Reverting the telemetry reader is the only non-trivial step, and it is a code revert, not a state rewrite.

## Communication Plan

The harness adapters page states the window rule and its value, the grammar, the mode and its origin, and the propagation contract by reference. The telemetry-v2 and state-layer pages state the additive fields, the absence marker, and the placeholder. The spend page states that the role breakdown still reports the harness-reported agent and that the seat is a row-level field. The change's pull request description names this record and the independent review artifact.

## Verification Criteria

- The window constant carries the rule, the delivery value `2.3.x` + `2.2.x`, and `2.2.5` is in-window while `2.1.x` is out; no configuration key changes that.
- The observed probe lines normalize (`opencode v2.3.2` → `2.3.2`, `opencode v2.2.5` → `2.2.5`); every off-grammar shape in the grammar matrix is indeterminate and refuses `harness.version.unknown`; `2.20.0` and `12.2.5` parse and refuse `harness.version.unsupported`.
- Exactly one bounded probe invocation per dispatch, with the declared deadline and the injected clock, reaped before the verdict; no retry.
- The mode resolves with its origin; an unknown value is `config.value.invalid`; a non-default mode is `harness.mode.unavailable` naming requested and available; no fallback and no second transport attempt.
- The seat rules are verified only through TDR-0032's criteria; this record's suites assert that the contract names no rule of its own (the reference boundary) and that no catalogue or second child process exists.
- An unrepresentable seat model refuses `harness.profile.model-unrepresentable` before any seam, with no partial binding.
- A row from a complete current-generation fixture carries the schema identity, the session's own version, the recorded seat and resolved model, the observed agent and model, the five token classes, calls, cost, and durations from the store pair; the same holds through the legacy generation with tool counts absent.
- A reported zero cost stays `0` with no `cost-missing` warning; an absent cost source is `null` with the warning; a non-numeric cost is `null` with `non-numeric-value`.
- An unstated observed agent and/or model still lands, with `absentObservedAxes` naming exactly the unstated axis, the declared empty-string placeholder in the delivered non-null field, the `optional-field-absent` warning on the same axis, no `invalid-session-identity`, and — for an unstated agent — a null seat with `unresolved-seat`.
- An unreadable store is `harness.telemetry.extraction-failed`, never absence; a readable store with zero rows for a held session is a capture failure, never a pass; an empty union is `skipped-gap`/`session-attribution-unavailable` with zero rows.
- Every fixture and every statement obeys DM-10: no work-item column, no harness-version column, no per-message token/agent/model/cost columns, no `part(tool …)`, no store-wide scan, no content projection.

## Confidence Rating

**High.** The contract is derived from observed harness output and the observed store inventory, and every rule has a named home in the tree or in a cited record. The residual uncertainty is external (a future harness line) and is bounded by explicit revisit triggers and by the unknown-version refusal.

## References

- [GH-335 specification](../changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-spec.md) — §5.1 F-1/F-3/F-5/F-6, §7.1, §8.2, §8.3 DM-1..DM-10, §17 AC-F1-1..AC-F1-5, AC-F3-2..AC-F3-4, AC-F5-1..AC-F5-7.
- [GH-335 delivery plan](../changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-plan.yaml) — Phases 2, 3, 4, 5 and 8.
- [GH-335 test plan](../changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-test-plan.md) — §4.1a observed store contract, §4.4 grammar matrix, §4.5 field matrix.
- [GH-335 spike evidence](../changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-spike-evidence.md) — the read-only re-observation of the version line and the store.
- [ADR-0008](ADR-0008-harness-adapter-contract.md) — the harness adapter contract this record extends additively.
- [TDR-0016](TDR-0016-harness-streaming-spawn-seam.md), [TDR-0021](TDR-0021-additive-optional-harness-environment-marker.md) — the additive-extension precedent.
- [TDR-0032](TDR-0032-harness-seat-spawn-cardinality-and-seat-resolution.md) — the single home of the seat/carrier rules this record cites.
- [TDR-0033](TDR-0033-harness-dispatch-outcome-envelope-detail.md) — the single home of the failure-envelope `detail.harness` member.
- [TDR-0034](TDR-0034-opencode-integration-mode.md) — the integration-mode selection this record's mode constraint assumes.
