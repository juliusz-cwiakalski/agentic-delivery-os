---
change:
  ref: GH-222
  type: feat
  status: Proposed
  slug: state-validation-everywhere
  title: "M1-S2: State validation everywhere"
  owners: [engineering]
  service: delivery-os
  labels: [m1, state-layer]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: [state layer (M0-S5), result contract and error table, delivery registry]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Guarantee that every state boundary classifies torn or unknown data instead of silently reading it as empty, and that self-corruption salvage and disk exhaustion are classified, data-preserving, fail-closed events.

## 1. SUMMARY

This change hardens the M0-S5 state layer so that schema validation and classification happen at every state read/write boundary — covering the delivery registry, the retro registry, and ceremony artifacts as validated boundaries, not only pm-notes. It adds an explicit, guided salvage operation for torn ledger tails (truncate to the last valid frame, append a classified salvage record, quarantine post-tear bytes so they are never silently read), proves indexes rebuild from the log alone including after salvage, and makes disk exhaustion a classified fail-closed event with no partial write. Coverage is mechanism-first: reusable boundary-validation and artifact contracts ship now so later registries (retro pipeline M1-S8, ceremony runner M2-S3) are born validated; those pipelines themselves are not implemented here.

## 2. CONTEXT

### 2.1 Current State Snapshot

M0-S5 (GH-174, closed) delivered the state layer: a schema-versioned, append-only JSONL ledger as the single durable truth; driver kinds that select only the read/index strategy over that ledger (`jsonl` verified scan; `sqlite` disposable derived index rebuilt from verified ledger truth whenever it is missing, corrupt, or divergent); classified torn-state detection (framing break, truncated tail, sequence gap/duplicate/reset, checksum mismatch) failing before any value returns; an explicit verified-empty verdict that is never conflated with torn; key-set assertions with no default substitution (recorded values return exactly, including falsy values); single-writer fences; atomic derived-document replace; and explicit terminal-tail repair as the only destructive operation — mid-record corruption refuses and changes nothing, and no automatic repair exists. Seven state failure codes are declared in the machine error table and the documented error table with a binding bidirectional sync check; all state failures carry consequence `not_landed`. Evidence names store paths and record positions, never payload content or checksum bytes. Consumers (delivery registry, provider parks, closeout, status, queue ready, verify change) read and write only through verified, classified paths.

### 2.2 Pain Points / Gaps

- **No salvage beyond tail removal:** the current repair model removes terminal truncation and reports it, but does not preserve and quarantine the bytes after a tear, and appends no classified salvage record — a torn store's damaged region is discarded rather than kept as evidence.
- **Storage exhaustion is unclassified:** disk-full behavior is not a classified event; a storage-boundary failure could leave an ambiguous or partially observable write.
- **Boundary validation is per-consumer, not a mechanism:** each consumer composes verified reads independently; there is no reusable boundary-validation and artifact contract so that new registries (retro, ceremony) are validated at their boundaries from birth.
- **Rebuild provability after salvage:** the disposable index already rebuilds from ledger truth on divergence, but rebuild-from-log-alone must also hold on the post-salvage ledger shape introduced by this change.

## 3. PROBLEM STATEMENT

Because the state layer can detect a torn store but cannot salvage it beyond removing a truncated tail, cannot classify storage exhaustion, and exposes verified boundary behavior only per-consumer rather than as a reusable mechanism, an agent or operator facing a corrupted, unknown-schema, or storage-exhausted registry has no classified, recoverable truth — risking silent zeros that masquerade as empty registries, discarded evidence, or partial writes that masquerade as landed mutations.

## 4. GOALS

- **G-1**: Classification everywhere — every state read/write boundary validates against its declared schema and classifies torn or unknown data before any value returns; unknown is never a silent zero.
- **G-2**: Guided salvage — a torn ledger tail salvages to the last valid frame under an explicit, guided operation, with a classified salvage record and quarantine of post-tear bytes, preserving the M0-S5 "no automatic repair" invariant.
- **G-3**: Provable index rebuild — indexes rebuild from the ledger alone, including on the post-salvage ledger shape.
- **G-4**: Fail-closed storage exhaustion — disk-full is a classified event with consequence `not_landed` and no partial write observable at any boundary.
- **G-5**: Reusable boundary validation — mechanism-first coverage so the delivery registry, retro registry, and ceremony artifact boundaries all validate, without implementing the retro pipeline or ceremony runner.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Ticket acceptance criteria demonstrated by automated state-tier tests | 5 of 5 |
| Reads returning silent zeros on torn or unknown-schema stores | 0 |
| Partial frames or partial derived documents observable under injected disk-full faults | 0 |
| Pre-tear records lost by salvage | 0 (verified-readable and unchanged after salvage) |
| Post-tear bytes silently served as content after salvage | 0 (100% quarantined) |
| Error-table drift between machine and documented tables when codes change | 0 (bidirectional sync check passes) |

### 4.2 Non-Goals

- **NG-1**: Implementing the retro pipeline (M1-S8) or the ceremony runner (M2-S3).
- **NG-2**: Any automatic or read-triggered repair; salvage remains an explicit, guided operation.
- **NG-3**: A user-facing CLI command surface for state in this story (OQ-1 resolved v1.1: library-only, DEC-4 confirmed; the current state layer ships no command surface).
- **NG-4**: Backup, restore, or migration surfaces (M3-S6).
- **NG-5**: Scheduler/queue and agent-integration work that this story unblocks (M1-S17, M1-S8 consumption).
- **NG-6**: A state schema-version bump or migration of existing stores; evolution is additive within the current schema version.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Boundary validation at every state read/write boundary | Schema checks and classification run before any value returns; the ticket goal "torn or unknown registries are classified events, never silently read as empty" holds at every boundary, not only pm-notes |
| F-2 | Torn and unknown classification with repair guidance | Reads classify torn or unknown state and return repair guidance, never silent zeros; verified-empty stays distinct from torn and unknown |
| F-3 | Explicit guided tail salvage | Torn tail truncates to the last valid frame, a classified salvage record is appended, and post-tear bytes are quarantined and never silently read (pinned ticket decision; terminal/torn-tail tears only — DEC-2) |
| F-4 | Index rebuild from the log alone | Indexes stay disposable and rebuildable from verified ledger truth alone, including after salvage (pinned ticket decision) |
| F-5 | Fail-closed storage exhaustion | Disk-full is a classified fail-closed event; a partial write is never observable (pinned ticket decision) |
| F-6 | Artifact-boundary contracts for later registries | Reusable validated artifact contracts so the retro registry (M1-S8) and ceremony artifacts (M2-S3) are born validated (pinned mechanism-first decision) |

### 5.1 Capability Details

- **F-1 Boundary validation**: every read and write through a state boundary — delivery registry records, derived documents, and artifact kinds standing in for the retro registry and ceremony artifacts — validates the declared schema and record identity before any value returns. Classification verdicts are distinct: valid, verified-empty, torn, and unknown (schema or kind not declared). Writes admit only schema-conforming records; a boundary that cannot validate classifies rather than serves.
- **F-2 Torn and unknown classification**: a read of a torn or unknown-schema registry returns a classified failure naming the store path and record position — never payload or checksum bytes — with remediation guidance. An undeclared record kind or payload schema at a boundary classifies as `state.store.unknown`; the version-scoped store mismatch stays `state.schema.mismatch` (DEC-5). A classified read never returns an empty record set for a non-empty store, and verified-empty evidence continues to satisfy only an empty key-set declaration.
- **F-3 Guided tail salvage**: salvage is explicit and guided (pinned decision 2): reads never repair. The salvage operation truncates the ledger at the last valid frame, appends a classified salvage record describing the salvage as durable ledger truth, and quarantines the post-tear bytes — preserved outside the read path and never served as content. The operation returns salvage evidence (truncation position, quarantined extent, record counts). Salvage applies ONLY to terminal/torn-tail tears (OQ-2 resolved, DEC-2): a mid-record (non-terminal) integrity break keeps the M0-S5 refuse-and-classify model with zero byte mutation, and salvage invoked on a mid-record tear fails classified (`state.store.torn`) without changing any ledger bytes. This extends the M0-S5 bounded-repair model; the no-automatic-repair invariant is preserved and asserted by tests.
- **F-4 Index rebuild from the log alone**: with only the ledger file available — index absent, corrupt, divergent, or on a post-salvage ledger — the index rebuilds from verified ledger truth and converges with the verified scan. The index remains disposable and never truth; divergence is resolved by rebuild with a reported rebuild, or the operation fails classified.
- **F-5 Fail-closed storage exhaustion**: an append, derived-document replace, or salvage write that cannot complete for storage exhaustion fails `state.storage.exhausted` — a classified failure carrying consequence `not_landed` with remediation naming storage exhaustion (DEC-5). The ledger remains at the last valid frame; no partial frame is appended and no partial derived document is observable — the target stays the previous version.
- **F-6 Artifact-boundary contracts**: reusable contracts declare the schema, record identity, and classification behavior for artifact-kind boundaries. They are exercised in this story on artifact kinds (and on the delivery registry), so the retro registry and ceremony artifacts adopt validated boundaries by construction when their stories land. No retro pipeline or ceremony runner behavior is delivered.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Torn read classification
  Consumer requests a verified read
    → boundary validation detects a framing break / truncated tail /
      sequence discontinuity / checksum mismatch / unknown schema
    → classified failure returns: store path, record position, repair guidance
    → no value — not even an empty record set — is served

Flow 2: Guided salvage
  Operator or agent follows the repair guidance and invokes the explicit
  salvage operation (precondition: a terminal/torn-tail tear; a
  mid-record tear refuses classified with no byte change — DEC-2)
    → system truncates the ledger at the last valid frame
    → system appends a classified salvage record (durable ledger truth)
    → system quarantines post-tear bytes (preserved, never read as content)
    → salvage evidence returns: truncation position, quarantined extent, counts
    → subsequent reads verify against the salvaged ledger;
      indexes rebuild from the salvaged log alone

Flow 3: Disk exhaustion
  Append / derived-document replace / salvage write under injected
  storage exhaustion
    → write fails classified with consequence not_landed and
      storage-exhaustion remediation guidance
    → ledger remains at the last valid frame; no partial frame or
      partial document is observable

Flow 4: Future registry onboarding (after this story)
  Retro registry (M1-S8) / ceremony artifacts (M2-S3) adopt the
  artifact-boundary contract
    → their boundaries are born validated: schema checks + classification
      at every read/write, no silent zeros
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The generalized boundary-validation mechanism (schema checks + classification with repair guidance) applied at every state read/write boundary, exercised on the delivery registry and on artifact kinds representing the retro registry and ceremony artifacts.
- Torn and unknown classification distinct from verified-empty; never silent zeros.
- The explicit, guided tail-salvage operation: truncate-to-last-valid-frame, classified salvage record appended to the ledger, quarantine of post-tear bytes, salvage evidence report.
- Index rebuild from the ledger alone, including the post-salvage ledger shape.
- Fail-closed storage-exhaustion classification with no partial write at any write boundary.
- Pinned error-code dispositions (DEC-5): two additive rows — `state.storage.exhausted` (disk-full) and `state.store.unknown` (undeclared record kind or payload schema at a boundary) — plus TWO text-only remediation-guidance refinements on existing rows: `state.write.failed` (storage exhaustion carved out to the dedicated row) and `state.store.torn` (guidance gains the pointer to salvage as an explicit separate operation, per the §22 maintenance mandate); the identity, semantics, and consequence of both refined rows are unchanged; salvage and quarantine operation failures reuse existing rows (`state.store.torn`, `state.write.failed`, `state.lock.busy`) with no new rows; every new or refined row is declared in the machine error table and the documented error table in the same change, with the binding bidirectional sync check; all state failures carry consequence `not_landed`.
- State-tier tests demonstrating all five ticket acceptance criteria.

### 7.2 Out of Scope

- [OUT] The retro pipeline (M1-S8) and its registry implementation.
- [OUT] The ceremony runner (M2-S3) and ceremony pipeline behavior.
- [OUT] A user-facing CLI command surface for state (deferred to the later operate-family CLI line; OQ-1 resolved library-only, DEC-4).
- [OUT] Automatic repair of any kind; salvage is explicit only.
- [OUT] Backup, restore, or migration surfaces (M3-S6).
- [OUT] Scheduler/queue (M1-S17) and agent-integration work this story unblocks.
- [OUT] A state schema-version bump or migration of existing stores.

### 7.3 Deferred / Maybe-Later

- A minimal `state check` / `describe` CLI surfacing per-store verdicts, per the proposed milestone contract — deferred to the later operate-family CLI line (OQ-1 resolved library-only; DEC-4 confirmed).
- Extending salvage to mid-record (non-terminal) tears — resolved out of this story (OQ-2: terminal-tail-only per DEC-2); a future change would be required to revisit.
- Quarantine-artifact disposition policies (retention currently follows the forever-retention rule), revisitable with M3-S6 backup/restore.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — the state tier is a local library surface with no network interface.

### 8.2 Events / Messages

| ID | Event | Description |
|----|-------|-------------|
| EVT-1 | Salvage ledger record | One additive, classified record kind appended by an explicit salvage: describes the salvage within the existing schema-versioned envelope (tear position, quarantine reference, record counts); never carries payload content or checksum bytes |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Salvage record kind | Additive record kind inside the existing state schema version; durable ledger truth; self-describing evidence of the salvage (DM-3 evidence draws from it) |
| DM-2 | Quarantine artifact | Preserved post-tear bytes stored outside the read path; never served as content; named by path and extent in evidence only; subject to the same least-privilege permissions as store files |
| DM-3 | Salvage evidence verdict | Operation outcome report: truncation position, quarantined extent, record counts; names paths and positions, never payload content or checksum bytes |
| DM-4 | Artifact-boundary schema declarations | Declared schemas, record identities, and classification behavior for validated artifact-kind boundaries, reusable by the retro registry and ceremony artifacts |

### 8.4 External Integrations

N/A — no external vendors, APIs, or services are involved; all behavior is local to the state tier.

### 8.5 Backward Compatibility

- Existing stores open unchanged; no schema-version bump and no reinterpretation of existing records (additive record kinds, consistent with the provider-park and closeout precedents).
- The seven existing state codes keep their identity and semantics; this change adds two additive rows (`state.storage.exhausted`, `state.store.unknown`) and refines only the remediation guidance text of TWO existing rows: `state.write.failed` (storage exhaustion carved out to the dedicated row; the write-or-rebuild-did-not-land semantics are unchanged) and `state.store.torn` (the guidance additionally points at inspection and salvage as an explicit separate operation; the torn classification's identity, refusal behavior, zero-byte-mutation semantics, and consequence are unchanged) — all declared in both error tables in the same change (DEC-5).
- Verified reads of the valid prefix of a ledger behave exactly as before; classification behavior consumers already rely on (torn ≠ empty, no default substitution) is preserved and extended, not changed.
- The M0-S5 terminal-tail repair model is extended by salvage: the no-automatic-repair invariant and "reads never mutate ledger bytes" behavior are preserved; salvage is a distinct, explicitly invoked operation.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Classification completeness: every enumerated corruption/unknown class (framing break, truncated tail, sequence gap/duplicate/reset, checksum mismatch, unknown schema/kind) is classified before any value returns | 100% of classes classified; 0 silent-zero paths |
| NFR-2 | Salvage data preservation: all records up to the last valid frame remain unchanged and verified-readable after salvage | 0 pre-tear records lost or altered |
| NFR-3 | Quarantine integrity: post-tear bytes are preserved and provably unread as content | 100% of post-tear bytes quarantined; 0 read paths serve them |
| NFR-4 | Fail-closed writes: under injected storage exhaustion at any write boundary | 100% of attempts leave the ledger at the last valid frame; 0 partial frames; 0 observable partial documents |
| NFR-5 | Rebuild completeness: index reconstruction from the ledger alone (index absent, corrupt, divergent, or post-salvage) converges with the verified scan | 100% of test stores rebuild; 0 divergence after rebuild |
| NFR-6 | Error-table sync: machine and documented error tables stay consistent whenever codes are added or refined | Bidirectional sync check passes with 0 drift in the same change |
| NFR-7 | No automatic repair: reads are side-effect-free with respect to ledger bytes; store bytes change only via explicit operations | 0 byte mutations triggered by reads; salvage invoked only explicitly |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

Observability is evidence-based, consistent with the state layer's evidence model; no external telemetry system is introduced:

- Every read returns an evidence verdict: verification classes performed, record count, and the explicit verified-empty marker; classification of torn/unknown names store path and record position with remediation guidance.
- Salvage returns an evidence report naming truncation position, quarantined extent, and record counts — never payload content or checksum bytes.
- Index rebuilds report that a rebuild occurred; failed writes report the classified failure code with consequence `not_landed`.
- Repair guidance accompanies every torn/unknown classification so an operator or agent can act without guessing.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Salvage destroys recoverable data if triggered on the wrong store or state | H | L | Explicit guided invocation only; post-tear bytes quarantined (never discarded); evidence reports extents; reads never trigger salvage | L — quarantined bytes remain recoverable manually |
| RSK-2 | New error codes drift between the machine and documented error tables | M | M | New codes declared in both tables in the same change; the bidirectional sync check is binding and runs in quality gates | L |
| RSK-3 | A partial-write path escapes disk-full coverage (e.g. a derived-document replace or salvage write not fault-injected) | H | M | Fail-closed contract asserted at every write boundary — append, derived-document replace, salvage — via injected storage-exhaustion faults at the named fault points | L |
| RSK-4 | Scope creep into retro/ceremony pipeline behavior | M | M | Mechanism-first decision pinned (DEC-1); AC satisfied via validated artifact-kind boundaries; DoR and review gates enforce the boundary | L |
| RSK-5 | Salvage is mistaken for automatic repair, eroding the M0-S5 invariant | M | M | Trigger pinned explicit (DEC-2); tests assert reads are side-effect-free (NFR-7); guidance distinguishes classification from salvage | L |
| RSK-6 | Index/ledger divergence after salvage is served as stale truth | M | L | Rebuild-from-log-alone AC explicitly covers the post-salvage ledger shape; index remains disposable, never truth | L |

## 12. ASSUMPTIONS

- M0-S5 (GH-174) is delivered as specified: ledger truth, torn detection, verified-empty, key-set assertions, disposable index, atomic replace, bounded repair, and the seven-code error tables with the binding sync check.
- Storage exhaustion can be simulated deterministically through the state layer's injected runtime-edge fault points, without depending on real disk conditions in tests.
- The state schema version remains unchanged: additive record kinds (salvage) and artifact-contract declarations do not bump it, consistent with prior additive kinds.
- Retro registry and ceremony artifact schemas are not final in this story; coverage is via reusable contracts and artifact kinds, per the mechanism-first decision.
- The state tier's existing boundaries hold: state-tier imports its contracts and own modules only; runtime APIs live only in the driver edge; the public port exposes no driver discriminant; evidence never names payload or checksum bytes.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | State layer (M0-S5, GH-174) | Closed/delivered; supplies ledger truth, torn detection, verified reads, fences, atomic replace, error tables |
| Depends on | Result contract and error table | Supplies the `state` domain kind, code rows, consequence model, and the binding bidirectional sync check |
| Blocks | M1-S8 retro pipeline (rank 32) | Consumes the artifact-boundary contracts delivered here; its implementation is out of scope |
| Blocks | M1-S17 scheduling engine | Backlog lists M1-S2 as a hard prerequisite ("validated state"); not in scope here |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Does this story require a minimal user-facing `state check`/`describe` CLI surface, or does the library-only boundary-validation surface satisfy the ticket? | The milestone pack proposes a `state` command contract (per-store verdicts) naming M1-S2, while the current state-layer spec states the layer ships no command surface and the backlog task list names no command. **Resolution:** the backlog is canonical for scope (per milestones/README conventions) and names no command; the current feature-state-layer spec ships no command surface; all five ticket ACs are testable at the library boundary — library-only surface confirmed (DEC-4). The m1 contracts pack `state` command entry remains a proposed milestone-end artifact for the later operate-family CLI line | Resolved (v1.1) |
| OQ-2 | Does tail salvage extend to mid-record (non-terminal) tears, or stay scoped to torn tails with mid-record corruption continuing to refuse destructively-nothing (classified only)? | The pinned decision and ticket AC cover the torn tail ("truncate to the last valid frame"); the M0-S5 model treats mid-record corruption as refuse-and-classify with no change; the mid-record salvage policy was unstated. **Resolution:** salvage is terminal-tail-only — the pinned ticket decision and AC3 cover torn tails only; a mid-record (non-terminal) integrity break keeps the M0-S5 refuse-and-classify model with zero byte mutation, and salvage invoked on a mid-record tear fails classified without changing any ledger bytes (recorded in DEC-2); mid-record salvage would be scope invention and erodes the changes-nothing safety invariant | Resolved (v1.1) |
| OQ-3 | Which state failure-code rows — new versus refined existing — express this story's classifications (unknown schema/kind, salvage failure, quarantine, disk-full)? | All state failures carry consequence `not_landed`; the machine ↔ documented bidirectional sync check is binding; the existing `state.write.failed` row plausibly hosts disk-full, while the proposed milestone contract names `state.store.unknown-schema`, which does not exist in the current seven-row table. **Resolution:** pinned in-spec as DEC-5 — new row `state.storage.exhausted` for storage exhaustion; new row `state.store.unknown` for undeclared record kind/schema (supersedes the m1 pack's proposed `state.store.unknown-schema` naming for style alignment); `state.write.failed` remediation text refined (storage exhaustion carved out); `state.store.torn` remediation text refined (guidance-only salvage pointer, completed in the v1.2 amendment); salvage/quarantine failures reuse existing rows with no new rows | Resolved (v1.1) |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Mechanism-first retro/ceremony coverage: ship reusable boundary validation (schema checks + classification) and artifact contracts; do not implement the retro pipeline or ceremony runner | Backlog rank 22 places M1-S2 before M1-S8 (rank 32) and M2-S3; the backlog goal line states the validation mechanism lands early so every later registry is born validated; AC2 is satisfied by validated boundaries exercised on artifact kinds | 2026-11-05 |
| DEC-2 | Salvage trigger is an explicit, guided operation: reads classify torn state with repair guidance and never repair; the salvage operation performs truncate-to-last-valid-frame + classified salvage record + quarantine; salvage scope is terminal/torn-tail ONLY — a mid-record (non-terminal) integrity break keeps the M0-S5 refuse-and-classify model with zero byte mutation, and salvage invoked on a mid-record tear fails classified (`state.store.torn`) changing no ledger bytes | Preserves the M0-S5 "no automatic repair" invariant while adding salvage; the pinned ticket decision fixes the mechanism, not the trigger; OQ-2 resolved v1.1 — the pinned ticket decision and AC3 cover torn tails only, and mid-record salvage would be scope invention eroding the changes-nothing safety invariant | 2026-11-05 |
| DEC-3 | Pinned binding mechanisms: torn-tail salvage truncates to the last valid frame with a classified salvage record; the quarantined tail is never silently read; indexes rebuild from the log alone; disk-full is classified fail-closed, never a partial write | Ticket-pinned decisions, not re-derived | 2026-11-05 |
| DEC-4 | Scope is the state-tier library surface plus contracts/error table plus tests; no user-facing CLI command in this story | The backlog task list names no command and the current state-layer spec ships no command surface; the milestone `state` contract remains a proposed milestone-end artifact until refined at delivery (see OQ-1). Confirmed v1.1 (OQ-1 resolved): the backlog is canonical for scope and names no command, and all five ticket ACs are testable at the library boundary; the m1 contracts pack `state` command entry stays a proposed milestone-end artifact for the later operate-family CLI line | 2026-11-05 |
| DEC-5 | Pinned error-code dispositions (OQ-3 resolved in-spec; amended v1.2 to record all four dispositions): (1) storage exhaustion gets a NEW dedicated row `state.storage.exhausted` (transient, retryable) — consequence `not_landed`, remediation names storage exhaustion, the ledger remains at the last valid frame, and no partial write is observable. (2) An undeclared record KIND or payload schema at a boundary gets a NEW dedicated row `state.store.unknown` (naming aligned with the existing table's `state.<noun>.<word>` style; supersedes the m1 pack's proposed `state.store.unknown-schema`), distinct from the version-scoped `state.schema.mismatch`. (3) The existing `state.write.failed` row's remediation guidance is refined (TEXT ONLY) to scope it to storage errors other than exhaustion, with its write-or-rebuild-did-not-land semantics unchanged. (4) The existing `state.store.torn` row's remediation guidance is refined (TEXT ONLY; recorded in full in v1.2): the guidance additionally points at inspection and at salvage as an explicit separate operation — required by the §22 maintenance mandate and asserted by test cases TC-GH222-001/010 — while the row's identity, torn classification, refuse-and-change-nothing semantics, retryability, and consequence `not_landed` are unchanged; the salvage pointer lives in the guidance text, not in read evidence — the evidence model (paths, positions, counts only) is unchanged. (5) Salvage and quarantine operation failures reuse existing rows with no new rows: salvage on a mid-record tear fails `state.store.torn` (zero byte mutation); salvage/quarantine writes under exhaustion fail `state.storage.exhausted`; other salvage/quarantine write failures, including a quarantine-preservation failure, fail `state.write.failed` (nothing landed, ledger unchanged); fence contention stays `state.lock.busy`. Net set: seven existing rows + two additive rows, minimal and non-overlapping; both text-only refinements preserve code identity. (6) Every new or refined row is declared in BOTH the machine error table and the documented error table in this change, consequence `not_landed`, with the binding bidirectional sync check (NFR-6, AC-F5-2 unchanged) | A dedicated exhaustion row aids diagnosis and testability and separates retry semantics cleanly; a version-scoped row cannot host record-kind unknowns without overloading `state.schema.mismatch`; reuse over new rows where semantics fit keeps the set minimal and the changes-nothing invariant testable; text-only remediation refinements preserve code identity, so the seven-code compatibility guarantee holds; the torn-row refinement is decided because maintenance (§22) requires the guidance to point at the explicit salvage operation and the evidence model forbids carrying remediation prose in read evidence | 2026-11-05 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core state-tier library surface (boundary validation, salvage, fail-closed writes) | Updated |
| State contracts and vocabulary (record kinds, evidence, artifact-boundary contracts) | Updated |
| Machine + documented error tables (two additive rows + two text-only remediation-guidance refinements per DEC-5; kept in bidirectional sync) | Updated |
| Delivery registry consumer | Verified/extended (boundary validation exercised on its boundaries) |
| State-tier test suites | New/extended (fault-injected disk-full, salvage, rebuild, classification coverage) |
| System spec documentation (state layer; result contract) | Reconciled post-delivery by doc-sync |

## 17. ACCEPTANCE CRITERIA

Ticket AC traceability: ticket AC1 → AC-F2-1; AC2 → AC-F6-1; AC3 → AC-F3-1; AC4 → AC-F4-1; AC5 → AC-F5-1.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** any state read or write boundary (delivery registry records, derived documents, artifact kinds), **when** data fails its declared schema or is of an undeclared kind or schema, **then** the boundary classifies the event as one of valid, verified-empty, torn, or unknown — distinctly and before any value returns — and never substitutes a default or zero (undeclared kind/schema classifies `state.store.unknown`; version-scoped mismatch stays `state.schema.mismatch`). | F-1, F-2, DM-4, NFR-1 |
| AC-F2-1 | **Given** a registry whose ledger contains a torn tail (framing break, truncated tail, sequence discontinuity, or checksum mismatch), **when** a consumer performs a verified read, **then** the read returns a classified torn failure naming the store path and record position — never payload or checksum bytes — with repair guidance, and no value, including an empty record set, is served. | F-2, F-1, NFR-1 |
| AC-F3-1 | **Given** a store with a torn tail, **when** the explicit guided salvage operation runs, **then** the ledger is truncated to the last valid frame, a classified salvage record is appended as durable ledger truth, the post-tear bytes are quarantined and never served as content, and a salvage evidence report names the truncation position and quarantined extent. | F-3, EVT-1, DM-1, DM-2, DM-3, NFR-2, NFR-3 |
| AC-F3-2 | **Given** a torn store, **when** any read occurs without an explicit salvage invocation, **then** the ledger bytes are unchanged, no repair happens automatically, and the read returns only the classified failure with repair guidance. | F-2, F-3, NFR-7 |
| AC-F3-3 | **Given** a ledger whose integrity break is mid-record (non-terminal), **when** the salvage operation is invoked, **then** the operation fails classified with the torn classification (`state.store.torn`), zero ledger bytes change, and the M0-S5 refuse-and-classify model holds with no salvage performed. | F-3, F-2, NFR-7 |
| AC-F4-1 | **Given** only the ledger file for a store — index absent, corrupt, divergent, or on a post-salvage ledger — **when** an indexed read occurs or a rebuild is requested, **then** the index rebuilds from verified ledger truth alone and converges with the verified scan. | F-4, NFR-5 |
| AC-F5-1 | **Given** an injected storage-exhaustion fault at any write boundary (append, derived-document replace, salvage write), **when** the write is attempted, **then** the operation fails `state.storage.exhausted` — a classified failure carrying consequence `not_landed` with remediation naming storage exhaustion — the ledger remains at the last valid frame, and no partial frame or partial derived document is observable. | F-5, NFR-4 |
| AC-F5-2 | **Given** a new state failure code introduced by this change, **when** the machine error table and the documented error table are checked, **then** the code is declared in both with consequence `not_landed` and the bidirectional sync check passes with zero drift. | F-5, F-1, NFR-6 |
| AC-F6-1 | **Given** the artifact-boundary contracts applied to artifact kinds standing in for the retro registry and ceremony artifacts, **when** records or artifacts at those boundaries are read or written, **then** schema violations and unknown kinds are classified events — never silent zeros — without any retro pipeline or ceremony runner behavior existing. | F-6, F-1, DM-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single-story delivery on the change branch per the standard lifecycle; the PR targets the tooling integration branch, not the public baseline.
- No user-facing behavior change: the state tier is a library surface; consumers adopt the generalized validation without contract changes to their own outputs.
- No migration or rollout flag: behavior is additive; existing stores open unchanged.
- The test plan inherits the milestone test-scenario pattern with story-local test-case ids (the milestone pack has no dedicated S2 scenario; this note is the handoff for the test-plan author).
- Doc reconciliation after delivery: the state-layer feature spec and the result-contract error table (codes change per DEC-5) are updated by doc-sync, and milestone pack artifacts are refined only if this story finalizes the proposed `state` contract.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. No schema-version bump, no migration, no seeding. Existing stores open unchanged; salvage record kinds and artifact-contract declarations are additive within the current schema version. Quarantine artifacts are created only by an explicit salvage operation and follow the store's forever-retention rule.

## 20. PRIVACY / COMPLIANCE REVIEW

- State stores remain local-only under the M0-S5 least-privilege contract; no data leaves the machine and no external service is involved.
- Quarantine artifacts must inherit the same least-privilege permissions as store-managed files (applied at creation, verified on access) so corrupted bytes are not exposed more broadly than live store content.
- Evidence, classification failures, and the salvage record name paths, positions, and counts — never payload content or checksum bytes; no secrets enter ledger records.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Destructive operation discipline**: salvage truncates a ledger; it must be reachable only through the explicit operation, never as a side effect of reads or classification.
- **Quarantine containment**: quarantined bytes live outside the read path with the same permission contract applied and verified; no read path may serve them as content.
- **Evidence hygiene**: the existing evidence model is preserved — paths and positions only, never payload or checksum bytes.
- **No new privilege or dependency**: no new environment reads beyond the existing allowlisted driver-edge inputs, no third-party dependency, no network access; disk-full fault injection is test-only.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Operators gain a guided salvage path with preserved evidence (quarantine) instead of bare terminal-tail removal; repair guidance text must be updated to point at it.
- The new error codes (`state.storage.exhausted`, `state.store.unknown`) and the refined remediation texts (`state.write.failed`; `state.store.torn` with the salvage-as-explicit-operation pointer) become part of the synced error-table contract and must stay in bidirectional sync in future changes.
- System spec documentation requires reconciliation after delivery (state-layer feature spec; result-contract error table — codes change per DEC-5).
- No new recurring jobs or schedules; retention remains forever, now including quarantine artifacts.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Boundary validation | Schema checks plus classification performed at every state read/write boundary before any value returns |
| Classified failure | A failure carrying a declared error-table code, consequence, and remediation guidance; never an unclassified crash or silent default |
| Torn store / torn tail | A ledger with an integrity break (framing, truncation, sequence, checksum); the torn tail is the invalid suffix beginning at the tear point |
| Verified-empty | Explicit evidence that a store is absent or has zero verified records; distinct from torn and unknown |
| Salvage | The explicit operation truncating the ledger at the last valid frame, appending a classified salvage record, and quarantining post-tear bytes |
| Salvage record | The additive classified ledger record describing a salvage; durable ledger truth |
| Quarantine | Preservation of post-tear bytes outside the read path, never silently read as content |
| Fail-closed | A write that cannot complete leaves durable truth unchanged — no partial frame, no partial document observable |
| Index rebuild | Reconstruction of the disposable derived index from verified ledger truth alone |
| Artifact-boundary contract | A reusable declared schema + classification contract applied at an artifact-kind boundary |
| `not_landed` | The consequence carried by all state failures: the attempted mutation did not land |

## 24. APPENDICES

### Appendix A: Source documents

- Ticket GH-222 (GitHub issue, milestone M1) — goal, tasks, five ACs, pinned binding decisions.
- Backlog, M1-S2 section — canonical scope (mirrors the ticket).
- Backlog ranking, rank 22 — ordering rationale ("validation mechanism lands early so every later registry is born validated").
- Milestone M1 contracts pack, `state` entry — proposed milestone-end contract (planned until refined at delivery; see OQ-1).
- State-layer feature spec (M0-S5 truth) — respected boundaries: state-tier imports contracts and own modules only; runtime APIs only at the driver edge; no driver discriminant on the public port; evidence names paths/positions only.
- Change pm-notes — recorded decisions DEC-1, DEC-2, DEC-4 and the doc-impact list.

### Appendix B: Test-plan handoff note

The milestone test-scenario pack has no dedicated S2 scenario. Per its coverage rule, the story test plan inherits the milestone pattern with story-local test-case ids recorded in the story's test plan. The five ticket ACs (mapped above) define the minimum coverage; fault-injected disk-full and salvage tests exercise the runtime edge's named fault points.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-05 | @spec-writer | Initial specification |
| 1.1 | 2026-11-05 | @spec-writer | Amendment: resolved OQ-1 (library-only surface; DEC-4 confirmed), OQ-2 (salvage terminal-tail-only; DEC-2 amended), and OQ-3 in-spec as DEC-5 — new rows `state.storage.exhausted` and `state.store.unknown`, refined `state.write.failed` remediation; salvage/quarantine failures reuse existing rows |
| 1.2 | 2026-11-05 | @spec-writer | Amendment (DoR iteration 1 remediation, single root cause — self-contradiction about which remediation rows are refined): §7.1 and §8.5 now declare BOTH text-only refinements (`state.write.failed` storage-exhaustion carve-out; `state.store.torn` salvage-as-explicit-operation pointer — identity, semantics, and consequence unchanged; evidence model unchanged); DEC-5 extended to record all four dispositions; OQ-3 resolution, §16 error-table row, and §22 synced-contract wording aligned; no structural changes |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-222 (source of truth), the backlog M1-S2 section, the m1 contracts pack `state` entry, the current state-layer feature spec (M0-S5 truth), the result-contract error table, and the pm-notes decisions. Nothing was invented beyond these; genuinely unresolved points were captured as OQ-1 through OQ-3 and resolved in the v1.1 amendment (DEC-2 amended, DEC-4 confirmed, DEC-5 pinned).
- The three pinned binding decisions from the ticket are recorded as DEC-3 and are not re-derived anywhere in this document.
- Scope is deliberately mechanism-first per pm-notes decision 1: the retro pipeline and ceremony runner are named only as future consumers of the contracts delivered here.
- Code-level detail is avoided: capabilities are behavioral; the error-table constraint (machine ↔ documented bidirectional sync, consequence `not_landed`) is stated as a contract requirement, not an implementation step.
- Respect for state-tier boundaries from the current system spec is recorded as an assumption (section 12) so plan and review phases can assert them.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-222)
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
