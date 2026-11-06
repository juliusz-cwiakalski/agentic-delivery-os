---
change:
  ref: GH-223
  type: feat
  status: Proposed
  slug: audit-ledger
  title: "M1-S22: Command audit ledger and agent identity"
  owners: [engineering]
  service: delivery-os
  labels: [m1, audit, state-layer, cli]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: medium
  dependencies:
    internal: [result contract and error table (M0-S3), state layer (M0-S5), branding seam, configuration layer]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Give every command invocation exactly one durable, tamper-evident audit record — including caller identity when claimed — so scripted outputs can drop context fields agents do not need and auditor or retro consumers get a trustworthy record.

## 1. SUMMARY

This change adds the M1-S22 command audit ledger: an append-only, schema-versioned record in the state layer that captures one record per CLI invocation — runId, command, arguments (through the redaction chokepoint), exit code, timing, outcome class, scope/repo, and the calling agent's claimed identity when provided. It specifies the agent-identity convention (an environment variable named through the branding seam, recorded as claimed, never inferred when absent) while the spawn-side setter and harness-plugin rendering stay out of scope. Landing the ledger activates the owner-pinned scripted-mode trim of the M0-S3 machine envelope — scripted `--json` emits one minified `{"data":...}`/`{"error":...}` line while schemaVersion, runId, and timing live in the audit record (errors keep runId as the correlation key) — and adds tamper-evident hash chaining with a chaining key that never enters lane environments, plus a bounded, filtered read surface for retro and auditor consumers.

## 2. CONTEXT

### 2.1 Current State Snapshot

M0-S3 delivered the command-surface result contract: every command renders one `CommandResult` envelope (`schemaVersion` `delivery.result.v1`, opaque `runId`, `exitCode`, `timing`, exactly one of `data`/`error`); failures resolve through a machine-readable error table with a binding bidirectional documentation sync check; exit codes exist only in the standalone CLI projection (`{0, 1, 2}`); and a single serialization chokepoint redacts registered secret values before any byte reaches a stream. The surface is exercised through a deterministic, in-process entry point taking injected streams, clock, run-id factory, brand, secrets, and command program; a testkit conformance validator and golden fixtures (each case requires its golden; none may be skipped) bind the envelope bytes.

M0-S5 delivered the state layer: an append-only, schema-versioned JSONL ledger (`delivery.state.v1`) as single durable truth over one store per workspace, composed through a driver-neutral public port (append, verified reads with key-set assertions, fences, derived-document replace, salvage). Consumers (delivery registry, provider parks, closeout outcomes) add record kinds additively inside the same schema version; validated artifact boundaries classify valid, verified-empty, torn, and unknown verdicts; runtime APIs appear only at the driver edge; retention is forever; evidence names paths, positions, and counts — never payload or checksum bytes. The state layer imports contracts and its own modules only and never imports branding.

The branding seam derives `BrandIdentity.environmentPrefix` (uppercase prefix with a trailing `_`) as the naming root for the environment layer; a forbidden-literal scan binds in CI and user-facing docs must be registered in its registry. The M1 milestone pack proposes the envelope formatting amendment: interactive terminals keep the full pretty envelope; scripted or piped output (the agent case) trims to one minified line carrying only `data` or `error`, with the trimmed context fields moving to the command audit ledger and errors keeping `runId`. The milestone architecture places the command audit ledger in the learning plane, feeding the retro pipeline, and pins the identity trust model: unauthenticated attribution, recorded as claimed, not proven. Nothing audit-related exists today: invocations leave no durable trace, the CLI has no scripted-vs-interactive output distinction, and no agent identity is captured anywhere.

### 2.2 Pain Points / Gaps

- **No invocation trail:** when a delivery misbehaves — wrong verdict, surprising exit, unexpected side effect — there is no durable record of which command ran, with which arguments, producing which outcome. Retro and auditor agents have nothing trustworthy to read.
- **Agent context pays for context it cannot use:** every scripted `--json` consumer receives schemaVersion, runId, and timing on every line. The owner has pinned that these fields belong in an audit ledger, not in the agent's context — but the ledger that makes the trim safe does not exist, so the trim cannot land.
- **No caller attribution:** nothing records which agent invoked a command. The identity convention (seam-named environment variable, set at spawn from agent role plus lane id) is unpinned in the delivered system, and nothing records the claimed value.
- **No tamper-evidence:** the state layer's per-record checksum detects corruption but is not keyed — an altered record with a recomputed checksum reads as valid. The backlog pins keyed hash chaining so records cannot be altered undetectably within the trust model.
- **Unbounded reads would be unsafe by default:** once the ledger exists, a naive dump exposes every historical command line in one payload; retro/auditor access must be bounded and filtered.

## 3. PROBLEM STATEMENT

Because the delivered system keeps no durable per-invocation record — no command, arguments, outcome, timing, scope, or claimed caller identity — an operator or retro/auditor agent cannot reconstruct what any invocation did, scripted agents receive context fields the owner has ruled belong in an audit ledger rather than their context, and a record that did exist could be altered without detection because the state layer's integrity checks are unkeyed; consequently the delivery engine cannot trust its own history, and the pinned scripted-mode trim stays blocked.

## 4. GOALS

- **G-1**: Complete per-invocation audit trail — exactly one audit record per command invocation (success, classified failure, unknown failure, broken invocation alike), carrying runId, command, redacted arguments, exit code, timing, outcome class, scope/repo, and claimed identity when provided; idempotent re-runs are distinct records distinguished by runId.
- **G-2**: Specified agent-identity convention — an environment variable named through the branding seam, recorded verbatim as claimed attribution when present and never inferred when absent; the setter-side convention (harness adapter at spawn from agent role + lane id, per-lane-unique; harness-plugin rendering into agent shells) is specified, not implemented.
- **G-3**: Scripted-mode context trim enabled — the envelope context fields (schemaVersion, runId, timing) are recorded in the ledger, activating the owner-pinned trim: scripted `--json` emits one minified `{"data":...}`/`{"error":...}` line; errors keep runId as the correlation key; interactive output is unchanged.
- **G-4**: Tamper-evident ledger integrity — keyed hash chaining over the audit-record sequence with a chaining key that never enters lane environments; any alteration within the trust model is flagged as a chain break; wording is cannot-alter-undetectably, never cannot-alter.
- **G-5**: Durable, classified, data-preserving behavior — the ledger composes the state layer's verified-read, classification, salvage, fence, and retention discipline (forever) and survives a malformed entry without data loss.
- **G-6**: Bounded, filtered read access — a read surface for retro and auditor consumers that returns verified records under explicit bounds and filters, with no unbounded dump path.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Ticket acceptance criteria demonstrated by automated tests | 6 of 6 |
| Invocations (whose audit write succeeded) producing exactly one record | 100%, across all outcome classes including broken invocations |
| Planted secrets surviving into any audit record field | 0 |
| Identities inferred when the identity variable is absent | 0 |
| Alteration mutations (including recomputed-checksum edits) flagged as chain breaks | 100%; 0 false "verified" verdicts in the mutation suite |
| Scripted success lines carrying schemaVersion, runId, or timing | 0 |
| Interactive-mode envelopes deviating from the M0-S3 contract | 0 |
| Error-table drift introduced by this change | 0 (no new rows; sync check passes unchanged) |
| Golden cases without a golden, or skipped, after the mode extension | 0 |

### 4.2 Non-Goals

- **NG-1**: The harness-adapter spawn-side setter of the identity environment variable and the harness-plugin rendering of it into agent shells — the convention is specified here; the setter/plugin behavior is later work.
- **NG-2**: The retro pipeline (M1-S8) and the spend read side (M1-S19) — they are named consumers of the read surface delivered here, not delivered in this story.
- **NG-3**: A new user-facing CLI command for audit reading — the read surface is a library/query surface over the state port (DEC-6).
- **NG-4**: Tamper *prevention*, multi-user or remote threat models, cryptographic non-repudiation, or authenticated identity — the trust model is pinned: single-user host, tamper-evidence only, identity claimed not proven.
- **NG-5**: Retention, pruning, or backup/restore policies — retention follows the state layer (forever); backup/restore is M3-S6.
- **NG-6**: A state schema-version bump or migration of existing stores — the audit record kind is additive within `delivery.state.v1`.
- **NG-7**: New user-facing documents under `doc/` that would require forbidden-literals registry registration — reconciliation happens in existing in-repo feature specs at doc-sync (§22).
- **NG-8**: Changing the envelope shape, `schemaVersion`, exit taxonomy, or the documented error table — the envelope contract itself is unchanged; only its scripted-mode rendering is amended (pinned).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | One audit record per command invocation | The ticket's core guarantee: exactly one record (idempotent re-runs distinguished by runId) with the full field set, written through the state layer as durable truth |
| F-2 | Agent-identity convention (consume-only) | The calling agent's name is captured when provided and never inferred when absent; recorded as claimed, not proven, per the pinned S18 trust model |
| F-3 | Scripted-mode envelope trim | The owner-pinned amendment of the M0-S3 rendering: scripted `--json` drops context fields now stored in the ledger; the trim activates when this story lands |
| F-4 | Tamper-evident hash chaining | Records cannot be altered undetectably within the trust model; a chaining key that never enters lane environments; chain breaks flag with position |
| F-5 | Bounded, filtered read surface | Retro and auditor consumers read verified history under explicit bounds and filters — the ledger is trustworthy AND safe to read |
| F-6 | Record hygiene through the redaction chokepoint | Secrets never appear in any record; arguments reach the ledger only through the single serialization/redaction path |

### 5.1 Capability Details

- **F-1 Per-invocation audit record**: every invocation that runs through the command surface produces exactly one audit record, appended through the state layer's public port (fenced, verified) on every outcome class — success, void success, classified failure, unknown failure, and broken invocation — with the envelope's own context fields retained in the record: `runId`, the command name (raw argv tokens preserved for broken invocations where no command name resolves), arguments, exit code, timing, the outcome class (the projected outcome classification consistent with the exit taxonomy), the invocation scope (the store/workspace scope identity and the target repository when the command targets one), and the claimed agent identity when provided. A re-run of an identical command appends a second record under a new runId; records are never deduplicated or overwritten. The audit ledger composes the public state port as an additive record kind within the existing state schema version — no schema bump, no new runtime-API location, no driver discriminant (DEC-5).
- **F-2 Agent identity (claimed, consume-only)**: the identity variable is named through the branding seam — the derived `environmentPrefix` plus a declared suffix — and is read as injected environment data at the runtime-aware edge, never via an ambient read inside the surface or state tier. When present and non-empty, its value is recorded verbatim as the claimed identity; when absent or empty, the record carries no identity and nothing is inferred from user, host, session, or any other signal. The value is attribution only: recorded as claimed, never verified, and never an authorization input. The pinned convention this story specifies — the harness adapter sets the variable at spawn from the agent role and lane id in a per-lane-unique shape, and the harness plugin renders it into shells the agent starts — is documented as the convention; the setter and rendering behaviors are out of scope (NG-1).
- **F-3 Scripted-mode trim**: the machine-output channel adapts by mode (DEC-2). Interactive mode — the machine-output stream presents as an interactive terminal, determined from an injected stream-capability fact at the runtime-aware edge, never probed ambiently inside the surface — renders the full envelope exactly as the M0-S3 contract defines it (all five keys, pretty-indented). Scripted mode — piped or otherwise non-interactive — renders one minified single line: on success exactly `{"data":...}` (an explicit empty `data` object for void successes); on failure exactly one `{"error":...}` line whose error object keeps the full error-table fields and additionally carries `runId` as the correlation key. Neither line carries `schemaVersion`, `exitCode`, or `timing`: the process exit code always carries status, and the trimmed context fields live in the audit record. A documented flag override forces the full envelope in any mode (the milestone contracts name `--verbose`); a pretty-printing flag affects indentation only and never re-expands the trim; stream outputs (a future `--watch`) stay line-delimited in every mode. The trim activates when this story lands — commands shipped before it emitted the full envelope until then — with no rollout flag (DEC-1). Golden fixtures and the envelope conformance validator extend to both modes: interactive cases validate under the existing envelope rules (extra or missing keys remain contract violations); scripted cases validate under scripted-projection rules (exactly one line, exact key set, trimmed tokens absent, error lines carry runId and full error fields); every case keeps its required golden with no skip path.
- **F-4 Tamper-evident chaining**: each audit record carries a chain value computed under a chaining key, covering the previous audit record's chain value and the new record's audited content — a keyed chain over the audit-record sequence in ledger order, so interleaved records of other kinds neither break nor participate in it. The chaining key is injected from the configuration/secret boundary at the runtime-aware edge and never enters lane environments: it is never written to the ledger, never appears in any record, and is never rendered into shells or lane-visible surfaces by this story's behavior. Verification recomputes the chain over the verified audit-record sequence; any mismatch flags a chain break naming the record position — never payload or checksum bytes, per the evidence model. Within the pinned trust model (single-user host, claimed identity, evidence not prevention), altering a record undetectably is not achievable without the key: the state layer's unkeyed per-record checksum alone would accept a recomputed-checksum edit, and the chain is what flags it. Terminal-tail repair and guided salvage of the underlying store remove bytes after the last valid frame and report the removal in their own evidence; verification of the chain over the surviving verified sequence is continuous across such removals — a reported removal is not a chain break, and no re-anchoring failure arises on a salvaged ledger (DEC-4).
- **F-5 Bounded, filtered read surface**: a library read surface over the state port serves verified audit records to retro and auditor consumers under explicit filters (at minimum: by scope, by time window, and by command/outcome class) and an explicit bound (records and/or bytes); when a result set is truncated by the bound, truncation is reported in-band — never silently clipped. Reads are verified (torn and unknown classify per the state layer, never silent zeros), acquire no fence, and write nothing. There is no unbounded full-ledger dump path through this surface (DEC-6; no new CLI command in this story).
- **F-6 Record hygiene**: arguments are recorded only after passing through the single serialization/redaction chokepoint — the same path that guards output streams guards record content — so registered secret values never appear in any record field, on success, failure, or broken invocation alike. Unregistered values are outside the redaction guarantee, consistent with the existing contract. Record evidence follows the state layer's model: paths, positions, counts — never payload or checksum bytes beyond the audited arguments themselves.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Invocation audited and rendered
  An agent (or human) runs a command with --json
    → the surface determines the outcome, measures timing, generates runId
    → the audit write path assembles one record: runId, command, arguments
      (through the redaction chokepoint), exit code, timing, outcome class,
      scope/repo, claimed identity when the identity variable is present
    → the record is appended through the state layer's public port (fenced,
      verified, hash-chained under the injected chaining key)
    → the machine channel renders: interactive → full envelope (unchanged);
      scripted → one minified {"data":...} or {"error":...} line
      (error lines keep runId)

Flow 2: Scripted agent correlates a failure
  A scripted agent reads one minified error line
    → error object carries the full error-table fields plus runId
    → the agent uses runId as the correlation key (blockers, audit lookup)
    → the full context (schemaVersion, timing, args, identity, outcome)
      lives in the audit record under that runId

Flow 3: Chain verification and break flag
  An auditor reads audit history through the bounded read surface
    → verification recomputes the keyed chain over the verified sequence
    → an altered record (even with a recomputed unkeyed checksum) breaks
      the chain → a break flag names the record position
    → records before the break remain verified-readable (no data loss)

Flow 4: Salvage/repair interaction
  The store's terminal tail is truncated by terminal-tail repair or guided
  salvage (state-layer operations, explicitly invoked)
    → removal is reported by the operation's own evidence (counts, extent)
    → the audit chain verifies continuously over the surviving verified
      sequence; the removal is not a chain break
    → the next audit record chains from the last surviving audit record

Flow 5: Malformed entry survival
  A malformed audit entry lands in the ledger (broken frame or checksum)
    → the state layer classifies the condition (integrity identities)
    → pre-existing records stay verified-readable and unchanged
    → the explicit salvage path preserves the torn tail as evidence
    → no bytes are silently dropped; retention remains forever
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The per-invocation audit record write path at the command surface, covering all outcome classes (success, void success, classified failure, unknown failure, broken invocation), with the full field set and exactly-once semantics per invocation.
- The additive audit record kind, payload schema, store-scoped key, and validated artifact boundary inside the existing state schema version, composed through the public state port.
- The agent-identity consumption contract: seam-named environment variable read as injected data, claimed-not-proven recording, absent-never-inferred; plus the specification of the setter-side convention (spawn-time value from agent role + lane id, per-lane-unique; harness-plugin rendering) as documented convention only.
- The scripted-vs-interactive mode contract for the machine-output channel (mode from an injected stream-capability fact; full-envelope override; indentation-only pretty flag semantics; stream-output line discipline) and the trim's activation in this change.
- Golden-fixture and envelope-conformance extension to both modes, preserving the no-case-without-golden rule.
- Keyed, tamper-evident hash chaining over the audit-record sequence; chaining-key injection through the configuration/secret boundary; chain-break flagging with position; the salvage/repair interaction.
- The bounded, filtered library read surface for retro/auditor consumers.
- Tests demonstrating all six ticket acceptance criteria, inheriting and extending seeded scenario SC-M1-23.

### 7.2 Out of Scope

- [OUT] The harness-adapter spawn-side setter of the identity environment variable and the harness-plugin rendering of it into agent shells (later work; convention only here).
- [OUT] The retro pipeline (M1-S8), spend read side (M1-S19), and any other consumer built on the read surface.
- [OUT] A new user-facing CLI command for audit reading (library surface only; DEC-6).
- [OUT] Tamper prevention, multi-user/remote threat models, authenticated or verified identity (pinned trust model: single-user host, claimed attribution).
- [OUT] Retention, pruning, compaction, or backup/restore behavior (forever per the state layer; backup/restore is M3-S6).
- [OUT] A state schema-version bump, migration, or reinterpretation of existing records.
- [OUT] Changes to the envelope shape/schemaVersion, exit taxonomy, documented error table (no new rows; DEC-7), or text (non-`--json`) output behavior.
- [OUT] MCP surface changes (the MCP projection is untouched by the CLI's scripted-mode rendering).
- [OUT] New user-facing docs requiring forbidden-literals registry registration (§22 lists in-repo spec reconciliation only).

### 7.3 Deferred / Maybe-Later

- A CLI audit-reading command family for human operators, if the later operate-family CLI line wants one (DEC-6 notes the read surface is ready to be projected).
- A manifest or self-description of the identity convention for third-party harnesses, if adoption beyond the shipped harness adapters demands it.
- Rotation or escrow of the chaining key, revisitable with M3-S6 backup/restore if operational practice requires it.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no network interface; the audit ledger is local state and the trim concerns the existing CLI machine-output channel (contract stated in F-3 and §8.5).

### 8.2 Events / Messages

| ID | Event | Description |
|----|-------|-------------|
| EVT-1 | Audit invocation record | One additive, classified record kind appended per command invocation through the state layer's public port; carries runId, command, redacted arguments, exit code, timing, outcome class, scope/repo, claimed identity when present, and the chain value; never carries secrets, the chaining key, or evidence payload/checksum bytes |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Audit invocation record kind | Additive record kind and payload schema inside the existing state schema version (`delivery.audit.*.v1` family, following the additive-kind conventions of prior consumers) under one store-scoped key; validated by an artifact boundary declaring kinds, schema identity, required fields, and closed vocabularies |
| DM-2 | Chain value | The per-record keyed chain link covering the previous audit record's chain value and the new record's audited content; verification recomputes it over the verified sequence; the chaining key never appears in any stored value |
| DM-3 | Claimed identity field | The verbatim value of the seam-named identity environment variable when present and non-empty; absent otherwise; attribution only — never verified, never an authorization input |
| DM-4 | Stream-capability mode fact | The injected fact describing whether the machine-output stream presents as an interactive terminal; determined at the runtime-aware edge; consumed by the mode contract; part of golden-fixture injected facts |

### 8.4 External Integrations

N/A — no external vendors, APIs, or services are involved. The harness adapter and harness plugin are named as the future setter/renderer of the identity variable but are not integrated in this change.

### 8.5 Backward Compatibility

- **The envelope contract is unchanged; its scripted rendering is amended (owner-pinned).** Interactive machine output keeps the exact M0-S3 envelope (all five keys; extra or missing keys remain contract violations). Scripted/piped `--json` output changes from the full envelope to the trimmed one-line shape. This is the owner-pinned amendment of the M0-S3 rendering (DEC-1): the trim activates when this story lands, with no compatibility flag. Scripted consumers that parsed schemaVersion, runId, or timing from success lines must move to the process exit code (status) and the audit ledger (context) — the pinned intent of the change.
- **Error correlation is preserved:** every scripted failure line keeps `runId` as the correlation key, and error objects keep the full error-table fields, so code/category/retryable/consequence branching is unaffected.
- **Existing stores open unchanged:** the audit record kind is additive within `delivery.state.v1`; no migration; the first audit record seeds the chain anchor on any store.
- **No error-table change:** no new rows are introduced; audit and state failures reuse the existing state identities (torn, unknown, lock busy, storage exhausted, write failed, permission denied); the bidirectional sync check passes unchanged (DEC-7).
- **Text output and key=value continuity are untouched:** non-`--json` behavior, diagnostics, and bash-continuity keys are unchanged; the trim concerns only the scripted machine channel.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Exactly-one audit record per invocation across all outcome classes (success, void success, classified failure, unknown failure, broken invocation), distinguished by runId | 100% of tested invocations produce exactly one record; 0 missing, 0 duplicates in the mutation suite |
| NFR-2 | Secret exclusion from records: registered secret values never appear in any record field, on any outcome class | 0 planted-secret survivors across records in the suite |
| NFR-3 | Tamper-evidence: alterations of audit records within the trust model — including edits with a recomputed unkeyed checksum — are flagged as chain breaks naming the record position | 100% of alteration mutations flagged; 0 false "verified" verdicts in the mutation suite |
| NFR-4 | Chaining-key exclusion: the chaining key never enters lane environments, ledger bytes, or any record field | 0 occurrences in ledger bytes, records, or lane-visible surfaces rendered by this story |
| NFR-5 | Identity fidelity: identity captured verbatim when the variable is present; nothing inferred when absent | 100% present-value capture verbatim; 0 inferred identities |
| NFR-6 | Trim line discipline: scripted success lines carry exactly `data` (no schemaVersion/runId/timing); scripted failure lines carry `error` with full error-table fields plus `runId`; exactly one line per invocation; interactive envelopes byte-conform to the M0-S3 contract | 100% single-line scripted outputs; 0 trimmed tokens on success lines; 100% failure lines carry runId; 0 interactive deviations |
| NFR-7 | Read-surface boundedness: every read-surface query honors its declared bound and reports truncation in-band | 0 unbounded dump paths; 100% of truncated results report truncation |
| NFR-8 | Data preservation and retention: malformed entries classify without silent loss; salvage preserves per the state layer; retention stays forever | 0 pre-existing records lost or altered by classification; 0 new prune/delete/compaction paths; 100% of salvage-preserved tails readable as evidence |
| NFR-9 | Tier and boundary conformance: contracts stay runtime-neutral; the audit consumer composes the public state port only; the state tier never imports branding; error-table sync untouched and passing | 0 new runtime-API locations; 0 driver discriminants on the public port; sync check passes with 0 drift |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

Observability is evidence-based, consistent with the state layer's evidence model; no external telemetry system is introduced:

- The audit record itself is the observability surface for invocations; runId correlates machine output, human diagnostics, and the audit record.
- Chain-break flags name the record position with remediation guidance; they never carry payload or checksum bytes.
- Salvage and terminal-tail removal continue to report their own evidence (counts, extents) per the state layer; verification distinguishes a reported removal from an unexplained chain break.
- An audit write that fails is loud: the classified state failure appears on the diagnostics stream with its existing state identity; the command's own outcome is unchanged (DEC-8), and the omission is detectable as a sequence discontinuity on the next verified read.
- The read surface reports result counts and in-band truncation whenever a bound clips a result set.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The scripted trim breaks existing scripted consumers or golden fixtures that assume the full envelope | H | M | The trim is owner-pinned (DEC-1); the mode contract is specified precisely (DEC-2) with a documented full-envelope override; fixtures extend to both modes under the no-case-without-golden rule; feature-result-contract reconciliation is a mandated doc-sync obligation (§22) | L — pre-release external scripted consumers are out of the pinned support scope |
| RSK-2 | Chain-verification false positives across salvage/repair, eroding trust in the flag | M | M | The chain walks the verified audit sequence; reported removals are evidence, not breaks (AC-F4-3); verification distinguishes removal from tamper; salvage interaction tested on salvaged ledger shapes | L |
| RSK-3 | The chaining key leaks into a lane environment, defeating tamper-evidence | H | L | The key is injected from the configuration/secret boundary at the runtime edge; never written to the ledger or records; never rendered into shells by this story's behavior; exclusion asserted by test (AC-F4-2) | M — on a single-user host the owner-side configuration is readable by same-user processes; within the pinned trust model |
| RSK-4 | Claimed identity is mistaken for authenticated identity and used for attribution-based decisions | M | M | Claimed-not-proven recorded in the convention, the glossary, and the record semantics; identity is never an authorization input; the trust model is cited wherever identity is consumed | M — accepted per the pinned decision |
| RSK-5 | Audit-write failures either silently drop records or break command outcomes | M | M | Failures classify through existing state identities and are loud on the diagnostics stream without changing the command's outcome (DEC-8); omissions are detectable as sequence discontinuities on verified reads; exactly-once is asserted for writes that succeed | L |
| RSK-6 | Scope creep into the harness-adapter setter or harness-plugin rendering | M | M | Setter and rendering are pinned out of scope ([OUT], NG-1); the convention is documented without behavior; DoR and review gates enforce the boundary | L |
| RSK-7 | Golden-fixture churn across every shipped command stalls delivery | M | M | The mode fact is injected, so the fixture model extends mechanically (mode in injected/meta facts, scripted stdout per outcome class); existing full-envelope goldens remain valid as interactive cases; no auto-accept path exists | L |

## 12. ASSUMPTIONS

- M0-S3 (result contract, redaction chokepoint, deterministic in-process surface, golden + conformance tooling) and M0-S5 (state layer: ledger truth, verified reads, fences, classification, salvage, additive kinds, artifact boundaries) are delivered as specified on the integration branch (verified at HEAD c6699302).
- The scripted-vs-interactive distinction is determinable from an injected stream-capability fact at the runtime-aware edge, consistent with the contracts tier's runtime neutrality (no ambient probe inside the surface).
- The chaining key can be introduced through the existing configuration/secret boundary as a declared, injected value; its exact configuration key name follows the configuration-layer conventions and is pinned at delivery.
- The exact scripted failure-line placement of `runId` (within/alongside the error object) is a rendering detail consistent with the one-line shape and is pinned at delivery.
- The identity environment variable name is derived as the branding seam's `environmentPrefix` plus a declared suffix; the suffix vocabulary is pinned at delivery; no product token is hardcoded (forbidden-literal scan stays green).
- The pinned trust model holds: single-user host, local-first state with least-privilege permissions, identity claimed not proven (S18), tamper-evidence not prevention.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Result contract and error table (M0-S3) | Supplies the envelope, runId, timing, exit projection, the redaction chokepoint, the deterministic in-process surface, golden fixtures, and the conformance validator |
| Depends on | State layer (M0-S5) | Supplies the public port (append, verified reads, fences), additive record kinds, artifact boundaries, classification, salvage, evidence model, and forever retention |
| Depends on | Branding seam | Supplies `environmentPrefix` for the identity variable's name; the forbidden-literal scan constrains documentation |
| Depends on | Configuration layer | Supplies the declared, injected chaining-key source through the existing configuration/secret boundary |
| Consumed by (future) | Retro pipeline (M1-S8) | Named consumer of the bounded read surface (architecture: audit ledger → retro) |
| Consumed by (future) | Spend read side (M1-S19) and coordinator-iteration exit evidence (M1-S20) | Roadmap exit evidence reads audit-ledger traces and env-override counts through this ledger |
| Blocks | The scripted-mode trim's correctness contract for all later M1 command stories | Later commands ship into a world where scripted output is trimmed; they inherit the mode contract, not new trim logic |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Is the read surface a CLI command or a library/query surface? | The ticket names "a bounded, filtered read surface for retro and auditor agents" without a command; the backlog task list names no command; the architecture wires the audit ledger into the retro pipeline as its consumer. **Resolution:** library-only read surface over the state port — consistent with the state layer shipping no command surface and with the GH-222 precedent (library-only when the backlog names no command); a CLI projection is deferred (DEC-6, §7.3) | Resolved (in-spec) |
| OQ-2 | Does the chain break warrant a new error-table identity? | A chain break is detected at the audit read/verification layer, not by the state layer's framing/checksum checks; adding a new domain kind and row would be a table change the ticket does not pin. **Resolution:** no new rows — chain breaks and record gaps surface as verification verdicts/evidence on the audit read surface (with remediation guidance), while store-level integrity failures keep the existing state identities and their fail-closed model; the bidirectional sync check passes unchanged (DEC-7) | Resolved (in-spec) |
| OQ-3 | What happens to the command outcome when the audit append itself fails? | AC1 says every invocation produces exactly one record, but an exhausted or contended store cannot honor that; failing the command after its work would misreport its consequence. **Resolution:** audit-write failures are classified, loud degradations on the diagnostics stream using the existing state identities; the command's own outcome and exit code are unchanged; the omission is detectable as a sequence discontinuity on the next verified read (DEC-8); exactly-once is asserted for invocations whose audit write succeeds, and the degraded path is tested | Resolved (in-spec) |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The scripted-mode trim activates when this story lands: scripted `--json` emits one minified `{"data":...}`/`{"error":...}` line; schemaVersion and timing live in the audit record; errors keep runId as the correlation key; commands shipped before it emitted the full envelope until then | Ticket-pinned owner decision (amendment of the M0-S3 rendering); not re-derived | 2026-11-06 |
| DEC-2 | Mode contract: interactive means the machine-output stream presents as an interactive terminal, determined from an injected stream-capability fact at the runtime-aware edge (no ambient probe inside the surface); scripted (piped/non-interactive) gets the trim; a documented flag override forces the full envelope in any mode (the milestone contracts name `--verbose`); a pretty-printing flag affects indentation only; stream outputs stay line-delimited in every mode; text (non-`--json`) behavior is unchanged | The ticket requires the scripted-vs-interactive contract to be specified precisely; the injected-fact model preserves contracts-tier runtime neutrality and keeps golden fixtures deterministic | 2026-11-06 |
| DEC-3 | Identity convention (pinned, consume-only delivery): an environment variable named through the branding seam (`environmentPrefix` + declared suffix), set by the harness adapter at spawn from agent role + lane id (per-lane-unique shape), rendered into agent shells by the harness plugin; GH-223 consumes the variable as injected data when present, records it verbatim as claimed — never inferred when absent; the setter and rendering are out of scope | Ticket-pinned decision plus the S18 trust model (unauthenticated attribution, claimed not proven); delivery consumes, convention specifies | 2026-11-06 |
| DEC-4 | Tamper-evidence model (pinned): keyed hash chaining over the audit-record sequence in ledger order (interleaved kinds neither break nor participate); chaining key injected from the configuration/secret boundary, never entering lane environments, ledger bytes, or records; verification recomputes over the verified sequence and flags breaks naming position; wording is cannot-alter-undetectably within the trust model, never cannot-alter; reported repair/salvage removals are not chain breaks and the chain verifies continuously over a salvaged ledger; owner-side key access is within the pinned single-user trust model | Ticket-pinned; the salvage interaction is specified here because the state layer's repair/salvage operations truncate tails and the chain must not false-flag them (RSK-2) | 2026-11-06 |
| DEC-5 | The audit ledger composes the public state port: one additive record kind with payload schema in the `delivery.audit.*.v1` family (following the additive-kind conventions of prior consumers) inside `delivery.state.v1`, under one store-scoped key, validated by an artifact boundary; no schema bump, no migration, no new runtime-API location, no driver discriminant | The ticket places the ledger "in the state layer"; the pm-notes pin composition over the public port; prior consumers (registry, provider parks, closeout) set the additive precedent | 2026-11-06 |
| DEC-6 | The read surface is library-only — bounded, filtered, verified reads over the state port; no new CLI command in this story | The backlog task list names no command; the architecture's named consumer is the retro pipeline (library consumption); the state layer ships no command surface; the GH-222 precedent (library-only when the backlog names no command) applies; a CLI projection is deferred (§7.3) | 2026-11-06 |
| DEC-7 | No new error-table rows: audit and state failures reuse the existing state identities (`state.store.torn`, `state.store.unknown`, `state.lock.busy`, `state.storage.exhausted`, `state.write.failed`, `state.permission.denied`); chain breaks and record gaps surface as verification verdicts/evidence with remediation guidance on the audit read surface, not as error-table identities; the bidirectional sync check passes unchanged | The ticket pins no new codes; the existing state rows already cover every state-level failure this story can raise; a new domain kind would be table invention; keeps the minimal, non-overlapping table discipline from GH-222 | 2026-11-06 |
| DEC-8 | Audit-write failure semantics: the failure is classified (existing state identity), loud on the diagnostics stream, and never changes the command's own outcome or exit code; exactly-once holds for invocations whose audit write succeeds; the omission is detectable as a sequence discontinuity on the next verified read | The audit record is an observation, not a participant in the command's transaction; silently dropping it would erode ledger trust; failing the command after its work would misreport consequence | 2026-11-06 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Command surface (machine-output rendering) | Updated — scripted/interactive mode contract, trim, full-envelope override |
| Command surface (audit write path) | New — per-invocation record assembly (redacted args, outcome class, identity) and append through the state port |
| State tier (audit consumer) | New — audit record kind, payload schema, artifact boundary, hash-chain computation/verification, bounded filtered read surface |
| Core contracts (vocabulary) | Updated — audit record and chain vocabulary as types/data only; envelope and error table unchanged |
| Runtime-aware edge | Updated — stream-capability mode fact, identity-variable environment read, chaining-key injection |
| Testkit conformance validator | Updated — scripted-projection rules beside the existing envelope rules |
| Golden fixtures | Updated — mode fact in injected/meta facts; scripted-mode cases per outcome class; no-case-without-golden preserved |
| Configuration layer | Updated — declared chaining-key source through the existing configuration/secret boundary |
| Branding seam | Documented — identity-variable naming via `environmentPrefix` (no code change to the seam itself) |
| Machine + documented error tables | Unchanged — verified (no new rows; DEC-7) |
| System spec documentation | Reconciled post-delivery by doc-sync (§22) |

## 17. ACCEPTANCE CRITERIA

Ticket AC traceability: ticket AC1 → AC-F1-1 + AC-F1-2; AC2 → AC-F2-1 + AC-F2-2; AC3 → AC-F3-1 + AC-F3-2 (+ AC-F3-3, AC-F3-4); AC4 → AC-F1-3; AC5 → AC-F4-1 + AC-F4-2 + AC-F4-3; AC6 → AC-F6-1.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a command invocation completing in any outcome class (success, void success, classified failure, unknown failure, broken invocation), **when** the outcome is rendered, **then** exactly one audit record exists carrying runId, command (raw tokens when no command name resolves), arguments, exit code, timing, outcome class, scope/repo, and the claimed identity when provided — with the envelope's context fields retained in the record. | F-1, F-6, DM-1, EVT-1, NFR-1 |
| AC-F1-2 | **Given** the identical command is re-run, **when** it completes, **then** a second audit record is appended with a new runId, and the two records are distinguishable by runId alone (no deduplication, no overwrite). | F-1, NFR-1 |
| AC-F1-3 | **Given** a ledger containing a malformed audit entry (broken framing or failed checksum), **when** audit reads occur, **then** the condition is a classified event reusing the existing state identities, pre-existing records remain verified-readable and unchanged, no bytes are silently dropped, and the explicit salvage path preserves the damaged region as evidence — retention staying forever. | F-1, F-5, NFR-8 |
| AC-F2-1 | **Given** an invocation whose environment carries the seam-named identity variable (set from agent role + lane id per the convention), **when** the audit record is written, **then** the variable's value is captured verbatim as the claimed identity — recorded as claimed, not proven — and the record shows it as attribution only. | F-2, DM-3, NFR-5 |
| AC-F2-2 | **Given** an invocation whose environment does not carry the identity variable, **when** the audit record is written, **then** the record carries no identity and nothing is inferred from user, host, session, or any other signal. | F-2, NFR-5 |
| AC-F3-1 | **Given** a scripted (non-interactive) invocation with `--json` succeeding, **when** the machine output is rendered, **then** the agent receives exactly one minified `{"data":...}` line carrying no schemaVersion, runId, or timing, while the audit record retains all of them; the process exit code carries the status. | F-3, F-1, NFR-6 |
| AC-F3-2 | **Given** a scripted invocation with `--json` failing, **when** the machine output is rendered, **then** the agent receives exactly one minified `{"error":...}` line whose error object keeps the full error-table fields and carries runId as the correlation key, while the audit record retains schemaVersion, runId, and timing. | F-3, F-1, NFR-6 |
| AC-F3-3 | **Given** an interactive terminal invocation with `--json`, **when** the machine output is rendered, **then** the full M0-S3 envelope appears unchanged; and given either mode with the documented full-envelope override, **when** rendered, **then** the full envelope appears (a pretty-printing flag affects indentation only, never the trim). | F-3, NFR-6 |
| AC-F3-4 | **Given** the golden fixture and conformance suites extended to both modes, **when** the suites run, **then** interactive cases validate under the existing envelope rules, scripted cases validate under the scripted-projection rules (one line, exact key set, trimmed tokens absent, failure lines carrying runId), and every case keeps its required golden with no skip path. | F-3, DM-4, NFR-6 |
| AC-F4-1 | **Given** an audit record altered after the fact (including an edit with a recomputed unkeyed checksum), **when** chain verification runs over the verified audit sequence, **then** the alteration is flagged as a chain break naming the record position — never payload or checksum bytes — so altering a record undetectably is not achievable within the trust model. | F-4, NFR-3 |
| AC-F4-2 | **Given** a lane environment carrying only its declared variables (including the identity variable), **when** the lane's environment, the ledger bytes, and any record field are inspected, **then** the chaining key appears nowhere — it exists only as an injected value at the runtime edge from the configuration/secret boundary. | F-4, NFR-4 |
| AC-F4-3 | **Given** a store whose terminal tail was truncated by terminal-tail repair or guided salvage (reported by the operation's own evidence), **when** chain verification runs, **then** the chain verifies continuously over the surviving verified audit sequence, the reported removal is not a chain break, and the next audit record chains from the last surviving audit record. | F-4, NFR-3, NFR-8 |
| AC-F5-1 | **Given** a retro or auditor consumer querying audit history with declared filters and bound, **when** the read surface executes, **then** it returns only verified records matching the filters within the bound, reports truncation in-band when clipping occurs, acquires no fence, writes nothing, and classifies torn/unknown conditions without silent zeros; no unbounded dump path exists through the surface. | F-5, NFR-7 |
| AC-F6-1 | **Given** planted secret values registered at the edge — including one embedded in the command arguments — **when** invocations complete in any outcome class, **then** no secret value appears in any field of any audit record: arguments reach the ledger only through the single serialization/redaction chokepoint. | F-6, F-1, NFR-2 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single-story delivery on the change branch per the standard lifecycle; the PR targets the tooling integration branch, not the public baseline.
- The trim is a behavior change to scripted machine output that lands with this story, owner-pinned, with no rollout flag or staged activation (DEC-1); interactive output is unchanged.
- No migration: existing stores open unchanged; the audit record kind is additive; the chain anchors on the first record per store.
- The test plan inherits seeded scenario SC-M1-23 and extends it (the ticket makes post-delivery divergence from the seeded scenario a defect); scripted-mode fixture cases are added per outcome class alongside the existing full-envelope goldens.
- Doc reconciliation after delivery (doc-sync, phase 7): feature-result-contract.md gains the rendering amendment (mandatory — the envelope rendering contract changes); feature-state-layer.md gains the audit consumer and record kind; feature-branding-seam.md documents the identity-variable naming convention. No new user-facing docs are added (NG-7).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. No schema-version bump, no migration, no seeding, no backfill of historical invocations (commands predating this change legitimately have no audit records — the trim's "commands shipped before it emit the full envelope until then" wording describes exactly this boundary). The first audit record on any store seeds the chain anchor; existing records of other kinds are untouched.

## 20. PRIVACY / COMPLIANCE REVIEW

- The ledger is local-only under the state layer's least-privilege contract (0700 directory / 0600 files; Windows current-user ACL); no data leaves the machine.
- Audit records retain command arguments — potentially sensitive operational content — forever per the state layer's retention model. Operators should treat the state directory accordingly; redaction removes registered secret values before recording, but unregistered values are outside the guarantee (consistent with the existing redaction contract).
- The claimed identity is operator-observable attribution data (agent role + lane id shape); it is not personal authentication data and carries no credential material.
- No telemetry export exists; evidence and flags stay local and name paths, positions, and counts.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Trust model wording:** the ledger is tamper-EVIDENT, not tamper-proof — the guarantee is cannot-alter-undetectably within the pinned single-user trust model; the chaining key never enters lane environments (NFR-4, AC-F4-2) and is injected through the configuration/secret boundary, never ambient.
- **Claimed identity discipline:** identity is recorded as claimed, never verified, and is never an authorization input anywhere in the system; consumers must treat it as attribution only.
- **Redaction precedence:** record content passes the single serialization/redaction chokepoint before persistence; the chokepoint remains the only path; no secondary serialization path is introduced for audit writes.
- **No new ambient reads:** the identity variable is read as injected environment data at the runtime-aware edge; no new ambient environment probing enters the surface or state tier; no third-party dependency, no network access.
- **Chain-verification honesty:** a reported repair/salvage removal must never be suppressible into a false "verified" verdict, and verification evidence never leaks payload or checksum bytes.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The state directory now grows with one record per invocation, retained forever; the bounded read surface (explicit filters and bounds, in-band truncation) is the supported access pattern — operators and agents should not read the ledger file directly.
- The scripted-mode rendering contract becomes part of the synced result-contract documentation: future commands inherit the trim automatically and must not reimplement or bypass it; the full-envelope override flag must remain available in every command's flag surface.
- The identity convention (seam-named variable, role+lane value shape) becomes the contract later harness-adapter and harness-plugin work must implement; until then, identity capture depends on operators or tooling setting the variable themselves.
- The chaining key becomes configuration with operational weight: losing it prevents verification of new records (existing record verification still detects breaks); introducing it is a declared configuration-layer key.
- Doc-sync obligations for this change (phase 7): feature-result-contract.md (scripted-mode rendering amendment — mandatory), feature-state-layer.md (audit consumer, record kind, chain), feature-branding-seam.md (identity-variable naming convention).
- No new recurring jobs or schedules; retention stays forever; the error-table contract is unchanged and must stay in bidirectional sync in future changes.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Audit ledger | The append-only, hash-chained record of command invocations in the state layer; one record per invocation |
| Audit record | One invocation's durable record: runId, command, redacted arguments, exit code, timing, outcome class, scope/repo, claimed identity when present, chain value |
| Claimed identity | The verbatim value of the seam-named identity environment variable when present; unauthenticated attribution — recorded as claimed, not proven; never inferred when absent; never an authorization input |
| Chaining key | The injected keyed-chain secret from the configuration/secret boundary; never enters lane environments, ledger bytes, or records |
| Chain value | A record's keyed chain link covering the previous audit record's chain value and the record's audited content |
| Chain break | A flagged verification failure naming the record position where the recomputed chain diverges; evidence, never payload or checksum bytes |
| Scripted mode | The machine-output mode for piped/non-interactive streams: one minified `{"data":...}`/`{"error":...}` line; errors keep runId |
| Interactive mode | The machine-output mode for terminal streams: the full M0-S3 envelope, unchanged |
| Trim | The owner-pinned removal of schemaVersion, runId, and timing from scripted success output now that the audit record retains them |
| Outcome class | The record's classification of the invocation outcome, consistent with the exit taxonomy (success / user-validation / platform-provider) |
| Bounded read | A read-surface query honoring declared filters and a declared bound, reporting truncation in-band |
| Redaction chokepoint | The single serialization-path control that transforms registered secret values before any byte reaches a stream — or, as of this change, an audit record |
| runId | The opaque per-invocation correlation identifier; retained in the audit record and on scripted failure lines as the correlation key |

## 24. APPENDICES

### Appendix A: Source documents

- Ticket GH-223 (GitHub issue 223, milestone M1) — goal, tasks, six ACs, three pinned decisions (trim activation; identity convention; tamper-evident chaining with key never in lane environments), seeded scenario pointer.
- Backlog, M1-S22 section — canonical scope (mirrors the ticket); backlog ranking rank 23 — "small infra landed early: the ledger is what lets scripted outputs trim context fields every later story emits, and it captures caller identity from day one."
- Milestone M1 contracts pack (`contracts.md`) — shared envelope formatting and agent-mode trim proposal; `--verbose`/`--pretty` semantics; stream-output line discipline; the `retro` entry naming the append-only evidence source.
- Milestone M1 architecture pack — learning-plane placement (audit ledger feeding retro), S18 trust model (unauthenticated attribution, claimed not proven), writer-ownership table (commands write intent; lifecycle agents write ledgers), roadmap exit-evidence rows consuming audit-ledger traces.
- Milestone M1 test scenarios — SC-M1-23 (seeded; the test plan inherits and extends; divergence after delivery is a defect per the ticket).
- Result-contract feature spec (M0-S3 truth) — envelope field contract, exit projection, redaction chokepoint, containment, golden/conformance tooling, evolution discipline (additive within schemaVersion).
- State-layer feature spec (M0-S5 truth) — public port, additive kinds, artifact boundaries, verified reads, fences, salvage/repair, evidence model, forever retention, tier boundaries.
- Branding-seam feature spec — `environmentPrefix` derivation rule; forbidden-literal scan and doc-registration constraint.
- Change pm-notes — scope resolution (consume-only identity; setter/plugin out of scope), dependency verification at main-tools HEAD c6699302, doc-impact list and risks.

### Appendix B: Test-plan handoff note

The test plan must inherit SC-M1-23 ("every invocation audited; scripted output trimmed") and extend it — the ticket declares divergence after delivery a defect. Minimum coverage beyond the seeded scenario: exactly-one across all outcome classes including broken invocations; re-run yields a second record with a new runId; absent-never-inferred identity; scripted failure line carrying runId and full error fields; interactive envelope byte-conformance; both-mode golden/conformance coverage with no skipped case; altered-record (recomputed-checksum) chain break; chaining-key exclusion; salvage/repair chain continuity; malformed-entry survival with no data loss; planted-secret exclusion from records; bounded-read truncation reporting; audit-write-failure loud degradation without changing command outcome (DEC-8).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @spec-writer | Initial specification |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-223 (authoritative for scope and AC wording, fetched from GitHub), the backlog M1-S22 section and ranking (rank 23), the milestone M1 contracts pack (envelope formatting and agent-mode trim), the milestone M1 architecture pack (learning-plane placement, S18 trust model), SC-M1-23, the M0-S3 and M0-S5 feature specs, the branding-seam spec, and the change pm-notes. Nothing was invented beyond these; genuinely unstated points were pinned as in-spec decisions (DEC-1..DEC-8) with explicit rationale or recorded as resolved open questions (OQ-1..OQ-3).
- The ticket's three pinned decisions are recorded verbatim in intent as DEC-1, DEC-3, and DEC-4 and are not re-derived anywhere in this document.
- The scripted-vs-interactive mode contract is specified precisely per the PM's instruction: mode from an injected stream-capability fact (preserving contracts-tier runtime neutrality), override and pretty-flag semantics from the pinned contracts pack, activation semantics from the ticket.
- Code-level detail is avoided: capabilities are behavioral; boundaries (public state port composition, runtime-neutral contracts, single redaction path, CLI-only exit codes, no hardcoded product tokens) are stated as contract requirements and assumptions, not implementation steps.
- The chain-break/error-row question (OQ-2) and audit-write-failure semantics (OQ-3) are pinned in-spec as DEC-7 and DEC-8 to keep the error table minimal and non-overlapping, following the GH-222 table discipline; the binding bidirectional sync check is preserved unchanged.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-223)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-, EVT-, G-, NG-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM-/EVT- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
