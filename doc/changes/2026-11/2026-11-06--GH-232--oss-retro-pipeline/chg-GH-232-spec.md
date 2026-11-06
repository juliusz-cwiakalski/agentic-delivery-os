---
change:
  ref: GH-232
  type: feat
  status: Proposed
  slug: oss-retro-pipeline
  title: "M1-S8: OSS retro pipeline"
  owners: [engineering]
  service: delivery-os learning plane (retro evidence pipeline)
  labels: [m1, retro, learning-plane, state-layer, cli]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: medium
  dependencies:
    internal:
      - state layer (GH-174)
      - state validation everywhere (GH-222)
      - result contract and error table (GH-172)
      - command audit ledger and bounded read surface (GH-223)
      - closeout transaction outcome records (GH-183)
      - commit telemetry records (GH-227)
      - branding seam (identity variable naming root, forbidden-literal registry)
    external: []
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/232
  related_changes: ["GH-172", "GH-174", "GH-183", "GH-222", "GH-223", "GH-227"]
  related_decisions: ["ADR-0003", "TDR-0004", "TDR-0005", "TDR-0009"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the retro evidence pipeline — `retro collect` and `retro report` over an independent, hash-chained evidence sidecar — so retrospectives read collector-truth that delivery agents cannot alter undetectably, malformed evidence entries classify without data loss, and pipeline-truth checks keep vacuous green out of the learning plane.

## 1. SUMMARY

This change adds the M1-S8 retro evidence pipeline: the `retro` command family (`collect`, `report` per the locked command surface) running retro levels on demand per concepts/retrospectives.md. Evidence lives in an **independent evidence sidecar** — a separate append-only artifact family in the state directory, outside the delivery state store's ledger — written only by the collector and hash-chained with a chaining key that never enters lane environments. The chain uses a keyed construction from the cryptographic keyed-hash family (HMAC-style), deliberately unlike the audit ledger's invertible internal-state link, so a delivery agent operating within its declared lane environment cannot alter evidence undetectably: any alteration flags as a chain break naming the record position, and the retro refuses to serve altered records as trusted evidence.

Every evidence record carries a collector-assigned trace id, a claimed collector identity (attribution, never authentication), its source, and its collection window. Reads verify the chain on every pass; pipeline-truth checks distinguish verified-empty sources from vacuous green (skipped-ordinal findings from the audit ledger, dangling evidence refs, expected-activity-absent for a completed change) and are never silently dropped. Shape-crash guards make retro output survive a malformed entry: entry-level schema malformation classifies in-band with partial output preserved and zero data loss; store-level damage (framing tears, missing key material, permission violations) classifies through the existing state identities as an unreachable store. A bounded export surface carries evidence with its chain verdict to an explicit destination. The retro registry (levels, runs) is a validated store boundary under M1-S2 state validation; the periodic memory audit finds its home here as a registered trigger whose runs are recorded as evidence, while the audit procedure itself stays in the memory consolidation skill. Levels R1–R6 are declared in the registry; the `change` (R1) level is implemented in this change.

## 2. CONTEXT

### 2.1 Current State Snapshot

M0-S5 delivered the state layer: an append-only, schema-versioned JSONL ledger as single durable truth, composed through a driver-neutral public port (append, verified reads, fences, derived-document replace, explicit salvage), with validated artifact boundaries classifying valid / verified-empty / torn / unknown verdicts, least-privilege permissions (0700 directory, 0600 files), store-managed artifacts, and forever retention. M1-S2 extended state validation everywhere: `state check` reports per-store schema verdicts at every boundary — the contract already names the retro registry as a validated store, and the state layer's boundary contract is exercised in tests with artifact kinds standing in for it, but no retro registry exists. M1-S22 (GH-223) delivered the command audit ledger: one keyed-chained invocation record per command with a durable reservation-first ordinal, a store-managed `chain-key.<workspace>.json` chaining-key artifact, claimed agent identity, and a bounded, filtered, library-only read surface (`readAuditLedger`) built explicitly for retro and auditor consumers — reporting in-band truncation, the full chain verdict, and skipped-ordinal findings. That feature spec documents its honesty caveat: the link's FNV-1a-64 construction is invertible modulo 2⁶⁴, so a same-user process can re-derive chain state from public records and forge values without reading the key; within that model, forgery resistance rests on state-file permissions.

The M0-S3 result contract supplies the `CommandResult` envelope (`delivery.result.v1`), the machine-readable error table with its binding bidirectional documentation sync, the `{0, 1, 2}` exit projection, the deterministic in-process command surface, and the single redaction chokepoint. Closeout outcome records and commit telemetry records are durable, validated state-store record families suitable as collector sources; pm-notes carry typed `retro` notes per change — the primary delivery retro input per the retro concepts doc.

The M1 architecture places the retro pipeline in the learning plane with two planned edges: the audit ledger (AUD, M1-S22, delivered) feeds the retro (RT), and the capsule (CP, M1-S12, not yet delivered) will feed it. The retro domain itself — levels, evidence sidecar, collection, reporting — does not exist in the delivered engine. The M1 pack locks the command surface naming (`retro collect|report [--level <name>]`) and proposes the command contract with exit codes 0 / 1 / 2 and two named error identities. The 2026-10 deep research corpus warns that tested coding-agent harnesses let agents delete their own traces; the retro evidence plane must therefore sit outside delivery-agent write authority (P0 in the concepts doc).

### 2.2 Pain Points / Gaps

- **No evidence plane:** retrospectives in the delivered engine have no mechanical evidence collection. The retro process stages in the concepts doc (verify prior actions, collect evidence mechanically, generate insights) have no substrate: every retro would start from memory and claims, exactly the failure mode the evidence ledger exists to prevent.
- **The audit-ledger read surface has no consumer:** the bounded, filtered read surface delivered for retro consumers is unused; invocation history accumulates with nothing folding it into learning.
- **The audit-ledger chain cannot carry the retro guarantee:** its invertible link construction means a same-user process can forge chain values from public records alone. The pinned GH-232 decision requires key separation to be non-vacuous — the sidecar therefore needs a construction where possession of records and links without the key does not enable forgery.
- **Trace-tampering risk is unaddressed:** nothing detects a delivery agent rewriting its own history. The research-corpus failure mode ("trace tampering by the reviewed system") has a named defense in the concepts doc — independent collector identity, append-only storage, tamper-evident chain — and none of it exists.
- **Retro-blocking dependencies:** M1-S12 (capsules/closeout), M2-S3 (ceremony runner), and M2-S10 (action registry) all consume the retro pipeline; it is the unblocking prerequisite.
- **Vacuous green has no detector:** a pipeline with zero jobs, an empty evidence set, or a skipped audit ordinal reads today as clean silence; nothing distinguishes checked-and-empty from expected-activity-absent.

## 3. PROBLEM STATEMENT

Because the delivered engine has no retro evidence pipeline — no independent evidence store delivery agents cannot alter undetectably, no collector identity, no trace ids, no pipeline-truth checks, and no retro command surface — retrospectives cannot read collector-truth and would reason over memories and unverified claims; a delivery agent could rewrite its own traces without detection; malformed or tampered evidence would either crash collection or be silently trusted; and M1-S12, M2-S3, and M2-S10 stay blocked waiting for the evidence substrate their ceremonies and registries consume.

## 4. GOALS

- **G-1**: Independent evidence sidecar — a separate append-only artifact family in the state directory, outside the delivery state store's ledger, written only through the collector's write path, with collector-assigned trace ids, collection watermarks (source, window, timestamp), and claimed collector identity on every record.
- **G-2**: Tamper-evident chain with non-vacuous key separation — a keyed chain from the cryptographic keyed-hash family (HMAC-style link over chaining key + previous link + canonical record content) whose chaining key is distinct store-managed key material that never enters lane environments, so alteration by a delivery agent operating within its declared lane environment is detectable (hash-chain break flagged, not silently trusted); wording is tamper-EVIDENCE, never tamper-prevention.
- **G-3**: Retro collection and reporting on demand — `retro collect [--level <name>]` gathers GET-only, bounded collector evidence (audit ledger, delivered state-store record families, pm-notes typed retro notes), appends it to the sidecar, and records the run in the retro registry; `retro report [--level <name>] [--json]` renders the level report `{level, findings[], followThrough[], evidenceRefs[]}` through the standard result contract.
- **G-4**: Shape-crash guards — schema-validated reads over the sidecar and the retro registry that classify malformed entries in-band with partial output preserved and zero data loss; store-level damage classifies through existing state identities as an unreachable store.
- **G-5**: Pipeline-truth checks — mechanical validations that distinguish verified-empty from vacuous green: audit-ledger skipped-ordinal findings and chain verdicts carried into retro output, dangling evidence refs flagged, expected-activity-absent flagged, zero-collector runs flagged; findings are never fabricated and a null retro (no supported findings) is a valid success.
- **G-6**: Level registry with hardening — R1–R6 declared as validated registry entries with trigger declarations and implementation status; the `change` (R1) level implemented; selecting a declared-but-unimplemented level is a classified refusal, never a crash or a vacuous run.
- **G-7**: Periodic memory audit home — the retro pipeline hosts and registers the periodic memory-audit trigger and records its runs as evidence; the audit procedure itself stays in the existing memory consolidation skill; no new command is created.
- **G-8**: Bounded export — an evidence export surface producing a bounded, deterministic bundle (records with trace ids plus the chain verdict) at an explicitly named destination, with in-band truncation and no unbounded dump path.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Ticket binding AC 1 (malformed-entry survival without data loss) demonstrated by automated tests | Met — 100% of shape-crash-guard cases classify; 0 uncaught crashes; 0 valid-entry loss |
| Ticket binding AC 2 (delivery-agent alteration detectable) demonstrated by automated tests | Met — 100% of alteration mutations flagged as chain breaks; 0 false "verified" verdicts in the mutation suite |
| Evidence records carrying trace id, source, window, claimed collector identity, and chain link | 100% |
| Sidecar key material occurrences in lane environments, records, output, or configuration | 0 |
| Cross-process verification of unaltered sidecar history producing false chain breaks | 0 |
| Audit-ledger skipped-ordinal findings dropped by the retro pipeline | 0 |
| Dangling evidence refs rendered as trusted findings | 0 |
| Unbounded read or export paths through the retro surface | 0 |
| Model calls in the collect/report render paths | 0 (deterministic render path invariant) |
| Error-table drift introduced by this change | 0 undocumented rows; 3 new rows round-tripping the documented table exactly |

### 4.2 Non-Goals

- **NG-1**: The ceremony runner (M2-S3) — scheduling, ceremony wiring, and the retro close stage (coverage registry, index rebuild) are later work; M1-S8 runs levels on demand.
- **NG-2**: The action registry and follow-through enforcement (M2-S10) — aging, escalation, five-field contract enforcement, and action lifecycle are later work; this change only reads recorded follow-through entries as evidence.
- **NG-3**: Capsule expansion (M1-S12) — the capsule→retro edge is declared in the architecture but capsule records do not exist yet; collection consumes only delivered sources.
- **NG-4**: Fleet retro (R6) and the R2–R5 level implementations — levels are declared in the registry; only `change` (R1) is implemented.
- **NG-5**: Tamper prevention, OS-level privilege separation, multi-user or remote threat models, cryptographic non-repudiation, or authenticated identity — the pinned trust model is a single-user host; the guarantee is detection, not prevention; collector identity is claimed attribution, never authorization.
- **NG-6**: Key rotation, escrow, or backup/restore of the sidecar chaining key — follows the audit-ledger precedent (deferred, revisitable with backup/restore work).
- **NG-7**: Insight generation by a model inside the pipeline — findings are mechanically folded from recorded evidence; the deterministic render path contains no model calls. LLM-driven analysis belongs to the retro procedure and ceremony (M2-S3+).
- **NG-8**: A new memory-audit command or a reimplementation of the memory consolidation procedure — the periodic memory audit is hosted as a registered trigger with runs recorded as evidence; the procedure stays in the existing memory consolidation skill.
- **NG-9**: Retention, pruning, compaction, or expiry policies for the sidecar — retention follows the state layer's model (forever).
- **NG-10**: Changes to the envelope shape, exit taxonomy, or existing error-table rows — the result contract is consumed unchanged; this change adds new rows only in its own domain kind.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Retro collection (`retro collect`) | The ticket's first task: GET-only, bounded collectors fold delivered sources into evidence with trace ids; idempotent re-collection appends addenda, never rewrites |
| F-2 | Independent evidence sidecar | The ticket's core guarantee: collector-truth delivery agents cannot alter undetectably — separate artifact family, append-only storage, collector identity, key separation |
| F-3 | Verified reads and chain verification | Every sidecar read verifies the keyed chain; breaks flag in-band naming position; altered records are never silently trusted |
| F-4 | Shape-crash guards | Binding AC 1: retro output survives a malformed entry without data loss — classify-and-preserve, never crash-or-drop |
| F-5 | Retro reporting (`retro report`) | The level report envelope `{level, findings[], followThrough[], evidenceRefs[]}` through the result contract; null retro is a success |
| F-6 | Pipeline-truth checks | Vacuous-green detection: skipped ordinals, dangling refs, expected-activity-absent, zero-collector runs — flagged, never silently trusted |
| F-7 | Evidence export | Bounded, deterministic evidence bundle with chain verdict at an explicit destination |
| F-8 | Level registry (hardened) | R1–R6 declared, `change` implemented, validated-boundary discipline per M1-S2; unknown or unimplemented levels refuse classified |
| F-9 | Periodic memory audit home | Trigger registered, runs recorded as evidence; procedure stays in the memory consolidation skill; no new command |
| F-10 | Retro error identities and exit projection | The two named identities from the command contract plus the tamper identity, documentable rows in the `retro` domain kind; store-level damage reuses state identities |

### 5.1 Capability Details

- **F-1 Retro collection (`retro collect [--level <name>]`)**: one invocation collects evidence for one level over one target scope and appends every collected item to the evidence sidecar as a record carrying a collector-assigned trace id, the level, the source, the collection window (bounded, explicit start/end bounds — the watermark), the collection timestamp from the injected clock, the claimed collector identity (per the M1-S22 identity convention, attribution only), the payload references, and its chain link. Collectors are GET-only: collection reads its declared sources without mutating any of them. The M1-S8 collector sources are the delivered ones: (a) the command audit ledger through its bounded, filtered read surface — the collection carries the ledger's chain verdict and every skipped-ordinal finding into the evidence as first-class items, never dropping them; (b) delivered state-store record families relevant to the level (phase transitions, closeout outcome records, commit telemetry events); (c) pm-notes typed `retro` notes through the existing read surface. Sources that arrive later (capsule events, M1-S12) are declared edges, not implemented collectors. The target scope for the implemented `change` level is the most recent completed change in the delivery registry not yet collected at that level; re-collecting an already-collected scope appends an addendum record and never rewrites existing evidence (concepts: reruns append addenda). An omitted `--level` defaults to `change` (the always-on trigger per the concepts doc: every merged change). The collection run itself is recorded in the retro registry with its counts, the consumed sources' chain verdicts, and the pipeline-truth verdict. Collection appends serialize under a single dedicated fence (the audit-ledger precedent: one fence serializes the whole chained domain).
- **F-2 Independent evidence sidecar**: the sidecar is a distinct append-only artifact family in the state directory, beside the delivery state store's own layout — structurally outside the store port's write surface, so no delivery-lane write path (phase, commit, or any state-port consumer) can address it; only the collector's own write seam appends. Records are never updated, deleted, reordered, or compacted; retention is forever. The sidecar's chaining key is distinct store-managed key material — separate artifact, separate bytes, generated once with cryptographic randomness at the runtime edge on the sidecar's first append, persisted beside the sidecar under the store-managed artifact family convention (the `chain-key.<workspace>.json` precedent), created `0600` and verified on open, read by every later collector process so verification spans processes without false breaks. The key never appears in a record, an output line, configuration, the ambient environment, or a lane environment; it is never exported through any command surface. The chain link is a keyed construction from the cryptographic keyed-hash family (HMAC-style over the chaining key, the previous sidecar link or the sidecar chain anchor, and the record's canonically-ordered content) — deliberately NOT the audit ledger's invertible internal-state derivation, so records and links alone do not enable computing the next link. Collector identity on records is the claimed-identity convention of M1-S22: attribution only, never verified, never an authorization input.
- **F-3 Verified reads and chain verification**: every sidecar read — by `collect` (pre-append verified read), `report`, or `export` — walks the sidecar in ledger order, recomputes every expected link, and compares it to the stored one. A mismatch is a chain break naming the record position and trace id; verification continues so multiple breaks report. Breaks never carry payload bytes or key material. A break is tamper evidence: the reading command fails classified (F-10) and altered records are never served as verified findings — the partial output renders only preserved entries plus the flag. Key-artifact substitution is likewise detected: records written under a prior key fail verification and name the affected domain. Reported, explicit salvage removals (the state layer's guided-salvage discipline, which the sidecar adopts for its own tear handling) are not chain breaks; verification continues over the surviving sequence.
- **F-4 Shape-crash guards**: a two-level malformation taxonomy keeps binding AC 1 precise. **Entry-level malformation** — a record that parses but fails its schema validation at the validated boundary (missing required fields, unknown payload schema, undeclared kind, closed-vocabulary violation) — classifies in-band: the entry is reported as a named finding (position, counts — never payload bytes), every valid entry is still processed and rendered, pre-existing evidence is unchanged, and the command completes with the classified `retro.evidence.malformed-entry` identity and partial output preserved. **Store-level damage** — framing tears, sequence discontinuities, unreadable files, missing key material on a non-first open, permission violations — classifies through the existing state identities (`state.store.torn`, `state.keys.missing`, `state.permission.denied`, and kin) as an unreachable evidence store (exit 2), following the state layer's fail-closed model with its explicit salvage as the only recovery path. The same guards apply to retro-registry reads: a malformed registry entry classifies; it never crashes a run and never yields a silent zero.
- **F-5 Retro reporting (`retro report [--level <name>] [--json]`)**: renders the level report by folding verified sidecar evidence and registry run records for the level's most recent collected scope. Machine `data` is exactly `{level, findings[], followThrough[], evidenceRefs[]}` in a versioned report shape (DM-6), rendered through the standard `CommandResult` envelope with the standard exit projection. `findings[]` are mechanically folded: recorded pm-notes retro notes, mechanical collector findings, pipeline-truth findings, and tamper/malformation flags — each fact linked to evidence refs; nothing is fabricated. `followThrough[]` is a read-fold of recorded follow-through entries from prior retro records and registry data, each carrying its verification verdict and artifact reference where a verification artifact was checked with delivered surfaces; entries are never invented, and an empty fold is an explicit empty array. `evidenceRefs[]` lists the trace ids the report's findings rest on; every ref resolves to an existing sidecar record or is itself flagged (F-6). A verified-empty fold with all pipeline-truth checks passing renders an explicit empty report and exits 0 — **null retro is a success**; findings are never manufactured to justify a run. The render path is deterministic: no model calls.
- **F-6 Pipeline-truth checks**: mechanical validations run on collect and report, distinguishing verified-empty (checked, legitimately empty — rendered as explicit verified-empty evidence naming the check that produced it) from vacuous green (silence where activity should exist). The checks: (1) audit-ledger skipped-ordinal findings surface in retro output as findings, never dropped; (2) the consumed audit-ledger chain verdict is carried into evidence — a broken audit-ledger chain is a retro finding (the invocation history itself may be altered); (3) every `evidenceRefs[]` entry resolves to an existing sidecar record — a dangling ref is a finding; (4) expected-activity-absent is flagged — for the implemented level, a completed change whose window shows no audit invocations, or a closed change with no closeout outcome record, is a finding, not clean silence; (5) a collection that ran zero collectors is a finding, never a silent success. Checks validate; they never fabricate findings to fill a quiet window.
- **F-7 Evidence export**: renders a bounded, deterministic evidence bundle — selected sidecar records with trace ids, collection watermarks, and the full chain verdict (DM-7) — to an explicitly named destination provided by the caller; there is no implicit destination and no default write location. The bundle is bounded by a required limit with in-band truncation reporting; an unbounded export request is refused classified. Export writes ride the redaction chokepoint; the bundle carries the chain verdict so exported evidence travels with its integrity evidence. Export is read-plus-write of evidence only: it never mutates the sidecar or the registry.
- **F-8 Level registry (hardened)**: the retro registry declares levels R1–R6 per the concepts doc — name, scope kind, trigger declaration (the concepts doc's hybrid trigger model), and implementation status in a closed vocabulary (`implemented` | `declared`). Registry reads and writes pass a validated artifact boundary under M1-S2 state validation: kind, payload schema, identity, required fields, and closed vocabularies validate at every boundary; verdicts classify distinctly (valid / verified-empty / torn / unknown); torn or unknown reads classify with repair guidance, never silent zeros. `--level` accepts exactly the declared names: an unknown name refuses with the existing `input.value.rejected` identity; a declared-but-unimplemented name refuses with the same identity and a remediation hint naming the owning story — never a vacuous run. The implemented set in this change is `change` (R1).
- **F-9 Periodic memory audit home**: the periodic memory audit is hosted as a registered trigger in the level registry (its cadence declared as registry data per the concepts doc's declared-in-advance trigger rule). When invoked (on demand in this change; scheduled invocation arrives with the ceremony runner), the audit's run is collected and recorded as evidence with trace ids like any other retro run — the pipeline is its home and its evidence trail. The audit procedure itself — what the memory consolidation skill does — is not reimplemented here; the pipeline records that it ran, when, over what window, and with what evidence refs.
- **F-10 Retro error identities and exit projection**: the exit taxonomy follows the locked command contract — 0 collected or reported; 1 malformed evidence entry (classified, partial output preserved); 2 evidence store unreachable. New documentable rows in a new `retro` domain kind: `retro.evidence.malformed-entry` (exit 1), `retro.evidence.tamper-flagged` (exit 1, the chain-break outcome of F-3), and `retro.evidence.denied` (exit 2). Store-level conditions reuse the existing state identities and project exit 2 through their platform class; input rejections reuse `input.value.rejected` (exit 1). `retro.evidence.denied` fires when a sidecar write is attempted outside the collector write seam or from a delivery-agent context: the refusal is structural (write-path ownership) plus claimed-identity marking, honestly documented as not authentication — the sidecar is unmodified and the consequence is `not_landed`. On any exit-1 outcome the machine envelope carries the classified error object (never both `data` and `error`); the bounded partial-run facts (entries processed, entries preserved, first flagged position) travel in the error summary, and the human channel renders the preserved partial output before the diagnostic.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Collection (retro collect [--level change])
  The coordinator (or a later ceremony) runs retro collect
    → grammar and level validated against the registry (unknown/unimplemented → classified refusal, exit 1)
    → target scope resolved (most recent completed change not yet collected at the level)
    → collectors run GET-only over declared sources:
        audit ledger (bounded read: records + chain verdict + skipped-ordinal findings)
        state-store record families (phase transitions, closeout outcomes, commit telemetry)
        pm-notes typed retro notes
    → pipeline-truth checks classify each source fold
        (verified-empty rendered explicit; expected-activity-absent flagged)
    → under the collector fence: each evidence item appends to the sidecar
        (trace id, source, window, claimed collector identity, chain link)
    → the run is recorded in the retro registry (counts, consumed chain verdicts, truth verdict)
    → exit 0 with the collection summary; already-collected scope → addendum appended, nothing rewritten

Flow 2: Reporting (retro report [--level change] [--json])
  A consumer requests the level report
    → sidecar verified read (chain verification over the level's evidence)
    → registry run records folded; findings mechanically assembled
    → followThrough folded from recorded entries (artifact-verified where checkable)
    → evidenceRefs resolved; dangling refs flagged (F-6)
    → data {level, findings[], followThrough[], evidenceRefs[]} rendered through the envelope
    → exit 0; a verified-empty fold with clean truth checks is an explicit empty report (null retro is success)

Flow 3: Tamper detection (binding AC 2)
  A delivery agent alters a sidecar record (edit, delete, reorder, truncate-and-reappend,
  or edit with a recomputed unkeyed checksum)
    → the next sidecar read recomputes the keyed chain
    → the break is flagged naming the record position and trace id
    → the command fails classified `retro.evidence.tamper-flagged` (exit 1)
    → altered records are never served as verified findings; partial output renders preserved entries + flag
    → key-artifact substitution fails verification the same way, naming the affected domain

Flow 4: Malformed-entry survival (binding AC 1)
  A malformed evidence entry lands (parses but fails schema validation at the boundary)
    → the shape-crash guard classifies the entry in-band (position, counts — never payload bytes)
    → every valid entry is still processed and rendered (no data loss; stores unchanged)
    → the command completes classified `retro.evidence.malformed-entry` (exit 1, partial output preserved)
  A store-level tear (framing break, missing key, permission violation)
    → existing state identities classify it (exit 2, unreachable); the state layer's explicit salvage is the only recovery

Flow 5: Export
  An operator or agent requests an evidence bundle at an explicit destination
    → verified sidecar read + chain verdict; required limit applied
    → bundle rendered (records with trace ids + chain verdict), redaction chokepoint applied
    → written to the named destination; truncation reported in-band; sidecar and registry untouched

Flow 6: Periodic memory audit
  The registered periodic memory-audit trigger fires (on demand now; scheduled by the ceremony runner later)
    → the audit procedure executes in the memory consolidation skill (outside this pipeline)
    → the pipeline records the run as evidence: trigger, window, outcome refs, trace ids
    → the run is queryable through retro report like any other evidence
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `retro` command family (`collect`, `report`) per the locked command surface, composed at the CLI edge following the established composition-only registration pattern (registered only when its composition is provided), with grammar validated before any I/O and all rendering through the standard result contract.
- The independent evidence sidecar: separate append-only artifact family outside the delivery state store, collector-only write seam, single-fence serialized appends, trace ids, collection watermarks, claimed collector identity.
- The sidecar keyed chain: HMAC-style keyed-link construction, distinct store-managed chaining-key artifact (generated once at the runtime edge, least-privilege permissions, cross-process continuity), chain verification on every read, break flagging with position, key-substitution detection, and the explicit-salvage interaction.
- Shape-crash guards over sidecar and retro-registry reads: the two-level malformation taxonomy (entry-level classified in-band with partial output preserved; store-level classified through state identities as unreachable).
- Pipeline-truth checks (F-6) and the explicit verified-empty versus vacuous-green distinction; null-retro-is-success.
- The retro registry as a validated store boundary under M1-S2: level entries (R1–R6 declared, `change` implemented), run records, validated-boundary discipline.
- The level report data shape (`{level, findings[], followThrough[], evidenceRefs[]}`) with mechanical fold-only findings and the read-fold follow-through surface.
- The bounded evidence export surface with chain verdict and explicit destination.
- The periodic memory-audit trigger registration and run-as-evidence recording.
- Three new documentable error-table rows in a new `retro` domain kind; reuse of state identities for store-level conditions; error-table sync staying green.
- Tests demonstrating both ticket binding ACs and all derived acceptance criteria.

### 7.2 Out of Scope

- [OUT] The ceremony runner (M2-S3): scheduling, ceremony wiring, the retro close stage, coverage registry, and index rebuild.
- [OUT] The action registry and follow-through enforcement (M2-S10): five-field contract enforcement, aging, escalation, board surface, closure rules — this change reads recorded follow-through entries only.
- [OUT] Capsule expansion (M1-S12): the capsule→retro edge is declared, not implemented; capsule records are not a collector source until that change lands.
- [OUT] Fleet retro (R6) and the R2–R5 level implementations (declared-only in the registry).
- [OUT] Tamper prevention, OS privilege separation, containerized or multi-user threat models, authenticated identity, or cryptographic non-repudiation (pinned single-user trust model; detection, not prevention; claimed-not-proven identity).
- [OUT] Key rotation, escrow, or backup/restore for the sidecar chaining key (deferred with the audit-ledger precedent).
- [OUT] Model-driven insight generation inside the pipeline (deterministic render path; analysis belongs to the retro procedure/ceremony).
- [OUT] A new memory-audit command or reimplementation of the memory consolidation procedure (hosted trigger + evidence recording only; no new command).
- [OUT] Retention, pruning, compaction, or expiry behavior for the sidecar (forever, per the state-layer model).
- [OUT] Changes to the envelope contract, exit taxonomy, or existing error-table rows; changes to the audit ledger itself or its chain construction (its documented honesty caveat stands; the sidecar simply uses a stronger construction for its own chain).
- [OUT] New flags beyond the locked surface (`--level`, the global `--json`) — report windowing/scoping flags, ref arguments, and watch modes are deferred.

### 7.3 Deferred / Maybe-Later

- Report windowing and scope filters (`--from`/`--to`, per-change scoping) once ceremony usage shows the demand; the bounded read fold already carries windows on records.
- A `retro` projection on the MCP surface, after the CLI surface stabilizes (the MCP mirror follows proven engines only).
- Sidecar archival/compaction policy, revisitable with the backup/restore work alongside audit-ledger key escrow.
- Corpus doctor checks (index coverage, dangling evidence links across the whole corpus) expanding on the pipeline-truth groundwork delivered here.
- The blind-analyst/falsifier experiment layer and near-miss exchange — post-M4 candidates per the concepts doc; the evidence sidecar delivered here is their prerequisite substrate.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no network interface. The retro pipeline is local state and the existing CLI machine-output channel (contract stated in F-5 and §8.5).

### 8.2 Events / Messages

| ID | Event | Description |
|----|-------|-------------|
| EVT-1 | Evidence sidecar record | One append-only record in the sidecar artifact family, written only by the collector under the collector fence: collector-assigned trace id, level, source, collection window (explicit bounds), collection timestamp (injected clock), claimed collector identity, payload references, payload schema id, and the keyed chain link; never carries secret values, the chaining key, or payload/checksum bytes beyond the collected evidence itself |
| EVT-2 | Retro run record | One additive validated record in the retro registry store per collection or report run: run id, level, mode, target scope, counts (collected, malformed, skipped-source), the consumed sources' chain verdicts, and the pipeline-truth verdict; validated at the boundary per M1-S2 |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Level registry entries | Declared levels R1–R6: name (closed vocabulary), scope kind, trigger declaration (hybrid trigger model, declared in advance), implementation status (`implemented` \| `declared`); validated at the boundary; the implemented set in this change is `change` |
| DM-2 | Evidence sidecar record shape | Trace id (collector-assigned, `ev-` prefixed, unique per sidecar), level, source, window bounds, collected-at (UTC epoch ms, injected clock), claimed collector identity (value + `claimed` marker when present), payload refs, payload schema id, chain value; canonically ordered content feeds the chain link |
| DM-3 | Sidecar chaining-key artifact | Distinct store-managed key material for the sidecar chain — separate artifact and separate bytes from the audit-ledger chain key; generated once with cryptographic randomness at the runtime edge on first sidecar append; persisted beside the sidecar under the store-managed artifact family convention; created `0600`, verified on open; open failures reuse the existing state identities; never in records, output, configuration, ambient environment, or lane environments |
| DM-4 | Sidecar chain verdict | Verification outcome carried on every read: verified flag, record count, breaks (positions + trace ids), anchor reference; key-substitution detected as a verification failure naming the affected domain |
| DM-5 | Retro run record shape | Run id, level, mode (`collect` \| `report`), target scope, counts (collected / malformed / skipped-source), consumed sources' chain verdicts, pipeline-truth verdict; first-class input to report folding |
| DM-6 | Report data shape | Versioned machine shape (`delivery.retro.report.v1` family): `{level, findings[], followThrough[], evidenceRefs[]}`; findings carry kind + text + evidence refs; followThrough entries carry action, verdict, and artifact reference where verified; exactly this shape inside the standard envelope `data` |
| DM-7 | Export bundle shape | Versioned machine shape (`delivery.retro.export.v1` family): selected evidence records with trace ids and watermarks plus the full chain verdict; bounded by a required limit with in-band truncation |
| DM-8 | Retro error identities | `retro.evidence.malformed-entry`, `retro.evidence.tamper-flagged`, `retro.evidence.denied` — the `retro` domain kind joins the domain-kind vocabulary; kind-only classification is never used (exact-code resolution, per the multi-row-kind rule) |

### 8.4 External Integrations

N/A — no external vendors, APIs, or services. Collector sources are local: the command audit ledger, the delivery state store's record families, and pm-notes.

### 8.5 Backward Compatibility

- **Additive everywhere:** the sidecar is a new artifact family; the retro registry is a new validated store boundary; both compose the existing substrate with no schema-version bump, no migration, and no reinterpretation of existing records. Existing stores open unchanged.
- **No existing contract changes:** the envelope shape, exit taxonomy, and every existing error-table row are unchanged. The three new `retro` rows are additive; the documented-table sync check extends and stays green.
- **No consumer breakage:** nothing existing consumes the retro surface yet; the audit ledger's read surface gains its first consumer without behavior change to that surface.
- **Command registration is additive:** `retro` joins the command surface through the composition-only registration pattern; absent composition leaves it unregistered, exactly like the established optional commands.
- **Locked surface honored:** the command grammar is exactly the locked `retro collect|report [--level <name>]` plus the global `--json`; no flags are added, removed, or reinterpreted.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Malformed-entry resilience (binding AC 1): entry-level malformation classifies in-band; valid entries are fully processed; partial output preserved; stores unchanged | 100% of shape-crash-guard cases classify (0 uncaught crashes); 0 valid-entry loss; 0 byte differences in valid-entry output versus the equivalent clean run; 0 store mutations from a classified read |
| NFR-2 | Tamper detection (binding AC 2): alterations of sidecar records — content edit, deletion, reorder, tail truncate-and-reappend, edit with recomputed unkeyed checksum — flag as chain breaks; key-artifact substitution fails verification | 100% of mutation-suite alterations flagged naming position; 0 false "verified" verdicts on unaltered history; 100% of substitutions detected naming the affected domain |
| NFR-3 | Key separation and continuity: the sidecar chaining key never enters lane environments, records, output, or configuration; verification spans processes on the durable key | 0 key occurrences outside the store-managed artifact and runtime-edge-injected data; 0 false chain breaks verifying unaltered history from a later process |
| NFR-4 | Append-only discipline: sidecar records are never updated, deleted, reordered, or compacted; reads never mutate; writes serialize under the collector fence | 0 rewrite paths; 0 read-path mutations; 0 unsynchronized appends |
| NFR-5 | Boundedness: every read and export requires a positive integer limit; truncation is reported in-band | 0 unbounded dump paths; 100% of truncated results report truncation in-band |
| NFR-6 | Determinism: identical sidecar/registry state, injected clock, and flags produce byte-identical output; no ambient clock, environment, or filesystem reads outside the declared seams | 0 drift across replays; 0 ambient reads |
| NFR-7 | Performance on a sidecar of up to 10,000 evidence records including full chain verification: collect; report; export; audit-ledger read (within its own documented bounds) | ≤ 30 s / ≤ 10 s / ≤ 10 s / within documented audit-read bounds |
| NFR-8 | Error-table binding: the three `retro` rows round-trip exactly with the documented table; store-level failures reuse state identities with no new rows; no unclassified retro failure escapes containment | 3/3 round-trip; 0 documented-table drift in either direction; 0 escapes |
| NFR-9 | Tier and boundary conformance: contracts stay data-only; the pipeline composes the public state port and its own declared collector seam; runtime APIs only at admitted I/O locations; composition-only command registration; no hardcoded product names | 0 new runtime-API locations; 0 contracts-tier behavior; 0 forbidden literals; 0 always-on registrations |
| NFR-10 | Secret hygiene: evidence content, reports, and export bundles pass the single redaction chokepoint | 0 edge-registered secret survivors in any evidence record, finding, report, or bundle |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

Observability is evidence-based, consistent with the state layer's evidence model; no external telemetry system is introduced:

- The sidecar and the retro registry are the observability surfaces: run records correlate a `retro` invocation with its counts, consumed chain verdicts, and truth verdict; trace ids correlate findings to evidence across commands and time.
- Chain breaks and malformation findings name positions, trace ids, and counts — never payload bytes, checksum bytes, or key material.
- The classified retro diagnostics (exit 1 identities) render on the diagnostics stream with the brand binary name, carrying the bounded partial-run facts in their summaries.
- The consumed audit-ledger chain verdict and skipped-ordinal findings are carried into evidence verbatim, so audit-plane integrity problems are visible in the learning plane without re-reading the ledger.
- No metrics export, no sampling, no network egress exists; all evidence stays local under the state directory's least-privilege permissions.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The key separation guarantee erodes: the sidecar key leaks into a lane environment, or a same-user process deliberately reads the key artifact and forges chain links | H | M | The key is generated once at the runtime edge and persisted only as store-managed `0600` key material; it is never provisioned to lane environments, records, output, or configuration, asserted by test; the keyed-link construction makes forgery without the key computationally infeasible; the guarantee is scoped honestly to actors not possessing the key (DEC-1/DEC-4) | M — on a single-user host, a lane process that violates its environment contract to read store-managed key material is outside the documented model; accepted per the pinned tamper-evidence-not-prevention decision |
| RSK-2 | Chain-verification false positives across processes or after explicit salvage erode trust in the flag | M | M | The key is durable store-managed material read by every later process (cross-process continuity tested); reported salvage removals are distinguished from breaks, and verification continues over the surviving sequence | L |
| RSK-3 | Shape-crash guards silently drop data, violating binding AC 1 | H | M | Classify-and-preserve discipline: valid-entry output asserted byte-identical to the clean run; in-band findings name positions; store mutations from classified reads forbidden and tested | L |
| RSK-4 | The pipeline-truth checks are themselves vacuous (a check that can never fire) | H | M | Every check ships with a triggerable negative fixture (dangling ref, skipped ordinal, expected-activity-absent, zero-collector); removing or disabling a check must fail the suite | L |
| RSK-5 | Scope creep into ceremony runner, action registry, or capsule territory | M | M | [OUT] pins and NG-1..NG-4; DoR and review gates enforce the boundary; declared-only registry entries refuse with hints naming owning stories | L |
| RSK-6 | Findings fabrication or model calls leaking into the render path | M | L | Findings fold only from recorded evidence and mechanical checks; the no-model-call render-path invariant is asserted in review and boundary checks | L |
| RSK-7 | Unbounded sidecar growth (forever retention) pressures the state directory | L | H | Bounded reads and exports; retention follows the accepted state-layer model; archival revisitable later (§7.3) | L — accepted, consistent with the audit ledger's forever-retention posture |
| RSK-8 | Users select declared-but-unimplemented levels and misread the refusal as a defect | L | M | Classified refusal with a remediation hint naming the owning story; registry status vocabulary rendered in `--help`-adjacent documentation | L |

## 12. ASSUMPTIONS

- M0-S5 (state layer) and M1-S2 (state validation everywhere) are delivered and closed (verified on the tracker: GH-174, GH-222), including validated boundaries, verified reads, fences, explicit salvage, store-managed artifacts, and least-privilege permissions.
- The command audit ledger (GH-223) is delivered with its bounded, filtered read surface, chain verdict, skipped-ordinal findings, claimed-identity convention, and the store-managed chaining-key artifact precedent.
- The result contract (GH-172), closeout outcome records (GH-183), and commit telemetry records (GH-227) are delivered and usable as collector sources.
- The locked command surface is `retro collect|report [--level <name>]` with the global `--json`; the man-page naming is binding and no new flags ship in this change.
- The pinned trust model holds: single-user host, tamper-evidence not prevention, identity claimed not proven; the sidecar guarantee is scoped to actors not possessing the chaining key (DEC-1/DEC-4).
- The deterministic render path invariant applies: collect and report contain no model calls.
- The branding seam's identity-variable naming root and forbidden-literal registry govern any operator-facing naming this change introduces.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | State layer (M0-S5, GH-174) | Public port, validated boundaries, verified reads, fences, explicit salvage, store-managed artifacts, least-privilege permissions, forever retention; the substrate for the retro registry and the sidecar's discipline |
| Depends on | State validation everywhere (M1-S2, GH-222) | The retro registry is a named validated store boundary; per-store schema verdicts and classified torn/unknown reads |
| Depends on | Result contract and error table (M0-S3, GH-172) | Envelope, exit projection, redaction chokepoint, deterministic command surface, error-table sync discipline |
| Depends on | Command audit ledger (M1-S22, GH-223) | Bounded read surface (records, chain verdict, skipped-ordinal findings) as the primary collector source; key-artifact precedent; claimed-identity convention |
| Depends on | Closeout outcome records (GH-183) and commit telemetry records (GH-227) | Delivered state-store record families consumed as collector sources |
| Depends on | Branding seam | Identity-variable naming root; forbidden-literal registry constrains operator-facing naming |
| Consumed by | Capsules/closeout (M1-S12) | Closeout reads retro evidence for capsule residue and change-closeout retros (R1) |
| Consumed by | Ceremony runner (M2-S3) | Schedules retro levels; wires the periodic memory-audit trigger's scheduled invocation; owns the close stage |
| Consumed by | Action registry (M2-S10) | Follow-through enforcement builds on recorded follow-through entries and the evidence substrate |
| Blocks | The three consumers above | The retro pipeline is their unblocking prerequisite per the backlog |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the keyed-chain construction decision (DEC-1) be authored as a standalone TDR before delivery planning? | The construction choice is AC-bearing and diverges deliberately from the audit-ledger precedent; capturing the rationale in a decision record keeps the tamper-evidence model inspectable independently of this change's artifacts | Resolved — decision taken, recorded as TDR-0009 (Proposed; human acceptance at PR review) |
| OQ-2 | Exact sidecar artifact family naming (file names, key-artifact name) | Requirements are pinned (store-managed family beside the audit chain key, `0600`, verified on open); exact names follow the store-layout convention and are pinned at plan time, as GH-223 did for its key artifact | Resolved (in-spec; exact names pinned at delivery) |
| OQ-3 | Does the report need explicit window flags in M1-S8? | The locked surface has none; records carry collection windows, and the report folds the level's most recent collected scope — additive windowing is deferred (§7.3) | Resolved (in-spec) |
| OQ-4 | `change`-level target selection: the locked surface has no ref argument | Resolved by DEC-5's selection rule (most recent completed change not yet collected at the level; addenda on re-collect); if ceremony usage (M2-S3) demands explicit targeting, that is an additive contract change there | Resolved (in-spec) |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Sidecar chain construction: a keyed link from the cryptographic keyed-hash family (HMAC-style over chaining key + previous sidecar link + canonically-ordered record content), deliberately NOT the audit ledger's invertible internal-state derivation; exact primitive pinned at plan time within that family. The tamper guarantee is honestly scoped: any actor that does not possess the chaining key — including a delivery agent operating within its declared lane environment, which never receives the key — cannot alter evidence undetectably; a same-user process that deliberately reads the store-managed key artifact to forge links is outside the documented lane environment contract and inside the accepted single-user residual risk (same honesty family as the audit ledger's documented caveat, but the in-model boundary is drawn at key possession, not at file permissions alone) | The pinned GH-232 decision requires key separation to be non-vacuous; the audit precedent documents that its FNV-1a-64 link is invertible, so records+links alone enable forgery there — unacceptable for the evidence plane where the reviewed system is the adversary; a keyed-hash link makes forgery computationally infeasible without key possession; recorded in TDR-0009 | 2026-11-06 |
| DEC-2 | Key material placement: the sidecar chaining key is distinct store-managed key material — separate artifact and separate bytes from the audit-ledger chain key — generated once with cryptographic randomness at the runtime edge on the sidecar's first append, persisted beside the sidecar under the store-managed artifact family convention, created `0600` and verified on open, read by every later collector process for cross-process continuity; absent-on-non-first-open, corrupt content, and wrong permission bits reuse the existing state identities; the key never appears in records, output, configuration, the ambient environment, or lane environments | The audit-ledger key precedent (GH-223) is proven: durable store-managed material gives cross-process verification without false breaks; a distinct key isolates the evidence plane from the audit plane so compromising one chain key does not enable forging the other; reuse of state identities keeps one failure language and the error table minimal; recorded in TDR-0009 | 2026-11-06 |
| DEC-3 | Sidecar placement: a separate append-only artifact family in the state directory, structurally outside the delivery state store's ledger; the retro registry (levels, runs) stays a validated store boundary inside the state-layer discipline per the M1-S2 contract | "Independent evidence sidecar" is structural, not just logical: no state-port write path that delivery agents legitimately use can address the sidecar; separation also keeps evidence integrity out of the delivery store's salvage/repair operations, so a store tear can never masquerade as (or mask) evidence tampering; the retro registry remains a normal validated store because the M1-S2 contract already names it | 2026-11-06 |
| DEC-4 | Collector identity mechanics (honest pinning): "a collector identity delivery agents cannot write" reduces on a single-user host to tamper-evidence mechanics — separate artifact family (DEC-3), key separation (DEC-1/DEC-2), append-only storage with verified reads (F-3), and collector stamps as claimed attribution (M1-S22 convention); refusal of non-collector writes is structural write-path ownership plus claimed-identity marking (`retro.evidence.denied`), not authentication; OS-level privilege separation is out of scope | The pinned decision itself states nothing physically stops a lane process from touching the file; pinning the mechanics honestly prevents the spec from claiming an OS guarantee it does not make, while the detection guarantee (binding AC 2) stays fully enforceable; recorded in TDR-0009 | 2026-11-06 |
| DEC-5 | Level registry: R1–R6 declared as validated registry entries (name, scope kind, trigger declaration, implementation status `implemented`/`declared`); only `change` (R1) implemented in M1-S8; omitted `--level` defaults to `change`; unknown or declared-but-unimplemented levels refuse with `input.value.rejected` and a hint naming the owning story; the `change` target is the most recent completed change not yet collected at the level, with addenda on re-collect | The commands doc's example uses `--level change`; the concepts doc's trigger table makes R1 the always-on level; declared-in-advance triggers are a concepts-doc rule, so the registry declares all six now; refusing unimplemented levels prevents vacuous runs while keeping the registry honest; automatic target selection respects the locked no-new-flags surface | 2026-11-06 |
| DEC-6 | Pipeline-truth checks pinned as five mechanical validations: skipped-ordinal findings surfaced (never dropped); consumed audit-ledger chain verdict carried into evidence; every `evidenceRefs[]` entry resolves or is flagged; expected-activity-absent flagged (a completed change with no audit invocations or a closed change with no closeout record is a finding, not clean silence); zero-collector runs flagged. Verified-empty is explicit evidence naming the check that produced it; findings are never fabricated; null retro is a success | The concepts doc's "catch vacuous green (a pipeline with zero jobs never ran)" needs concrete triggers to be testable; the verified-empty/vacuous-green distinction preserves null-retro-is-success while forbidding silence from reading as success; each check ships with a triggerable negative fixture (RSK-4) | 2026-11-06 |
| DEC-7 | Shape-crash guards pinned as a two-level taxonomy: entry-level malformation (parses but fails schema validation at the boundary) classifies in-band — `retro.evidence.malformed-entry`, exit 1, valid entries fully processed, partial output preserved, stores unchanged; store-level damage (framing tears, sequence discontinuities, missing key material, permission violations) classifies through existing state identities as unreachable (exit 2) with the state layer's explicit salvage as the only recovery | This reconciles binding AC 1 ("survives a malformed entry without data loss") with the command contract's exit 2 ("evidence store unreachable") without weakening either: an entry is recoverable truth-losing noise (classify and preserve), while a store tear is fail-closed territory; the split mirrors the state layer's own torn-vs-unknown discipline | 2026-11-06 |
| DEC-8 | Tamper is loud: a detected sidecar chain break fails the command with `retro.evidence.tamper-flagged` (exit 1), the tamper evidence names positions and trace ids in-band, altered records are never served as verified findings, and the partial output renders preserved entries plus the flag; key-artifact substitution fails verification the same way | Binding AC 2 requires "flagged, not silently trusted"; exit 1 makes the flag unavoidable across every consumption channel (process exit, diagnostics, envelope) — a quiet in-data flag would risk agent consumers overlooking it; partial-output preservation keeps the evidence inspectable | 2026-11-06 |
| DEC-9 | Findings and follow-through are mechanically folded: findings come from recorded pm-notes retro notes, collector findings, and truth-check flags, each evidence-linked; follow-through is a read-fold of recorded entries with artifact-verified markers where delivered surfaces can verify; no model calls anywhere in collect/report; insight generation stays with the retro procedure and ceremony (M2-S3+) | The deterministic render path invariant (architecture boundary 5) forbids model calls in render paths; mechanical folding keeps reports reproducible and testable, and the concepts doc separates observed facts (evidence-linked) from inferences (the procedure's business) | 2026-11-06 |
| DEC-10 | Periodic memory audit boundary: the retro pipeline hosts and registers the periodic memory-audit trigger (cadence as declared registry data) and records its runs as evidence with trace ids; the audit procedure itself stays in the existing memory consolidation skill; invocation is on-demand in M1-S8, scheduled invocation arrives with the ceremony runner; no new command | The journeys registry closes the question as "folded into `ados retro` (M1-S8), no new command"; the PM scope reading pins the split; hosting-without-reimplementing keeps the consolidation procedure where the memory model owns it while the evidence trail lands here | 2026-11-06 |
| DEC-11 | Error identities: a new `retro` domain kind with exactly three rows — `retro.evidence.malformed-entry` (exit 1, platform, non-retryable, `not_landed`), `retro.evidence.tamper-flagged` (exit 1, platform, non-retryable, `not_landed`), `retro.evidence.denied` (exit 2, platform, non-retryable, `not_landed`); store-level conditions reuse existing state identities (exit 2 via their platform projection); input rejections reuse `input.value.rejected`; kind-only `retro` classification is never used (exact-code only, multi-row-kind rule); the documented-table sync extends and stays green | Both named identities from the command contract must be documentable rows; tamper needs its own identity so binding AC 2 is testable as a distinct, auditable outcome; everything else already has a row — minimal-table discipline (GH-222/GH-223 precedent) | 2026-11-06 |
| DEC-12 | Partial-output mechanics on exit 1: the machine envelope carries exactly the classified error object (never `data` and `error` together, per the envelope contract); the bounded partial-run facts (entries processed, entries preserved, first flagged position or trace id) travel in the error summary; the human channel renders preserved partial output before the diagnostic | The result contract forbids both keys in one envelope, so "partial output preserved" must reconcile with it: machine consumers get truth from the classified summary, human consumers see the preserved output; this keeps the envelope contract intact without weakening AC 1's no-data-loss guarantee (which concerns the evidence stores and valid-entry processing, both untouched) | 2026-11-06 |
| DEC-13 | Collection serialization: sidecar appends serialize under one dedicated collector fence that covers the verified pre-append read, the chain-link computation, and the appends (the audit-ledger close-the-whole-domain precedent); reads acquire no fence and mutate nothing | Every sidecar record participates in one chain, so concurrent appends could race the link computation; a single fence serializes the domain correctly; the unfenced verified-read discipline matches the audit ledger's read surface | 2026-11-06 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| CLI command surface | New — `retro collect` / `retro report` command definitions with grammar validation, composition-only registration, and envelope rendering through the existing projection chain |
| Learning plane (retro consumer) | New — collectors, sidecar consumer (append + verified reads + chain verification), pipeline-truth checks, report/export folds |
| Evidence sidecar artifact family | New — separate append-only evidence store beside the state store, with its own chaining-key artifact and collector fence |
| State tier (retro registry consumer) | New — additive validated record kinds (level entries, run records) under the retro registry store boundary named by M1-S2 |
| Core contracts (vocabulary) | Updated — retro vocabulary (levels, record shapes, chain verdict, export bundle, error identities) as types and data only |
| Machine + documented error tables | Updated — the `retro` domain kind joins the vocabulary; exactly three new rows; sync check extended and green |
| Audit ledger read surface | Consumed unchanged — first consumer; chain verdict and skipped-ordinal findings carried into evidence |
| Branding seam | Consumed — identity-variable naming root for collector stamps; forbidden-literal registry governs new operator-facing naming |
| System spec documentation | Reconciled post-delivery by doc-sync (§22) |

## 17. ACCEPTANCE CRITERIA

Ticket AC traceability: **binding AC 1** — "Retro output survives a malformed entry without data loss" → AC-F4-1 + AC-F4-2 (reconciled with the exit-2 unreachable taxonomy per DEC-7). **Binding AC 2** — "Evidence alteration by a delivery agent is detectable (hash-chain break flagged, not silently trusted)" → AC-F2-3 + AC-F3-1. Both binding ACs are kept verbatim and unweakened; all other criteria are derived from the ticket tasks and the pinned decision.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** a `retro collect` run over delivered sources, **when** collection completes, **then** every collected item is one append-only sidecar record carrying a collector-assigned unique trace id, the level, the source, explicit window bounds, the collection timestamp from the injected clock, the claimed collector identity when present (value plus `claimed` marker, attribution only), payload references, and its keyed chain link — and no update, delete, reorder, or compaction path exists for sidecar records. | F-1, F-2, DM-2, EVT-1, NFR-4 |
| AC-F2-2 | **Given** a lane environment carrying only its declared variables, and a sidecar history written by earlier collector processes, **when** the lane environment, sidecar records, output, and configuration are inspected and verification runs from a later process, **then** the sidecar chaining key appears nowhere except as store-managed key material beside the sidecar (distinct artifact and bytes from the audit-ledger chain key), and the unaltered history verifies with zero false chain breaks. | F-2, DM-3, NFR-3 |
| AC-F2-3 | **Given** a delivery agent alters sidecar evidence — content edit, record deletion, reorder, tail truncate-and-reappend, or an edit with a recomputed unkeyed checksum — **when** any sidecar read or report runs, **then** the alteration is detected: evidence alteration by a delivery agent is detectable (hash-chain break flagged, not silently trusted) — the break is flagged naming the record position and trace id, the command fails classified `retro.evidence.tamper-flagged` (exit 1), altered records are never served as verified findings, and key-artifact substitution fails verification naming the affected domain. | F-2, F-3, DM-4, DM-8, NFR-2 |
| AC-F2-4 | **Given** a write to the sidecar attempted outside the collector write seam or from a delivery-agent context, **when** the attempt is made, **then** it is refused with `retro.evidence.denied` (exit 2), the sidecar is unmodified, and the refusal is documented as structural write-path ownership plus claimed-identity marking — not authentication. | F-2, F-10, DM-8, NFR-4 |
| AC-F1-1 | **Given** the implemented `change` level with its automatic target rule (most recent completed change not yet collected at the level), **when** `retro collect` runs, **then** the collection consumes only delivered GET-only sources (audit ledger via its bounded read surface, delivered state-store record families, pm-notes retro notes), records the run in the retro registry with counts and consumed chain verdicts, and re-collecting an already-collected scope appends an addendum without rewriting any existing evidence. | F-1, F-8, DM-5, EVT-2, NFR-4 |
| AC-F1-2 | **Given** an audit ledger containing skipped-ordinal findings and/or a chain verdict, **when** the collector reads it, **then** the bounded read surface is used within its documented bounds and every skipped-ordinal finding and the full chain verdict are carried into the collected evidence verbatim — none silently dropped. | F-1, F-6, NFR-5 |
| AC-F1-3 | **Given** `retro collect` or `retro report` invoked with an omitted `--level`, an unknown level name, or a declared-but-unimplemented level name, **when** grammar and registry validation run, **then** the omitted level defaults to `change`; the unknown name and the declared-but-unimplemented name each refuse classified with `input.value.rejected` (exit 1) — the latter with a remediation hint naming the owning story — before any I/O. | F-8, DM-1, NFR-8 |
| AC-F3-1 | **Given** a sidecar containing multiple altered records, **when** verification runs, **then** every break is reported (verification continues over the sequence), each names its position and trace id and never payload or checksum bytes, and a reported explicit-salvage removal is distinguished from a break with verification continuing over the surviving sequence. | F-3, DM-4, NFR-2 |
| AC-F4-1 | **Given** a malformed evidence entry — a record that parses but fails its schema validation at the validated boundary (missing required field, unknown payload schema, undeclared kind, closed-vocabulary violation) — in the sidecar or the retro registry, **when** `retro collect` or `retro report` runs, **then** retro output survives a malformed entry without data loss: the entry classifies in-band as `retro.evidence.malformed-entry` (exit 1) naming its position (never payload bytes), every valid entry is still processed and rendered, pre-existing evidence is byte-unchanged, and no run crashes or silently drops. | F-4, DM-8, NFR-1 |
| AC-F4-2 | **Given** the full shape-crash-guard case matrix over both stores, **when** each case produces output, **then** the valid-entry portion of the partial output is byte-identical to the corresponding entries of the equivalent clean run, the error summary carries the bounded partial-run facts (entries processed, entries preserved, first flagged position), the machine envelope carries exactly the classified error object (never `data` and `error` together), and store-level damage cases (framing tear, missing key material on a non-first open, permission violation) classify through the existing state identities as unreachable (exit 2) with the explicit salvage as the only recovery. | F-4, F-10, DEC-7, NFR-1 |
| AC-F5-1 | **Given** verified sidecar evidence and registry run records for a level, **when** `retro report [--level <name>] [--json]` runs clean, **then** the machine `data` is exactly the versioned `{level, findings[], followThrough[], evidenceRefs[]}` shape in the standard success envelope (exit 0), findings fold only from recorded evidence and mechanical checks each linked to evidence refs, followThrough folds only recorded entries with artifact-verified markers where verifiable, the render path performs zero model calls, and identical state with identical injected clock and flags renders byte-identical output. | F-5, DM-6, NFR-6, NFR-10 |
| AC-F5-2 | **Given** a level whose verified evidence fold is empty and whose pipeline-truth checks all pass, **when** `retro report` runs, **then** the report is an explicit empty report (empty `findings[]`, explicit verified-empty evidence naming the checks) with exit 0 — null retro is a success — and no finding is fabricated to justify the run. | F-5, F-6, DM-6 |
| AC-F6-1 | **Given** each pipeline-truth trigger — a dangling evidence ref in a report fold, a skipped-ordinal finding in the consumed audit ledger, a broken audit-ledger chain verdict, expected-activity-absent for a completed change (no audit invocations in window, or a closed change with no closeout outcome record), or a collection that ran zero collectors — **when** collect or report runs, **then** each trigger surfaces as an explicit named finding (or, for the zero-collector and broken-verdict cases, blocks a clean exit with the classified evidence), verified-empty is always explicit evidence naming its check, and no check ever fabricates a finding to fill a quiet window; every check has a triggerable negative fixture, and removing or disabling a check fails the suite. | F-6, DM-4, DM-5, NFR-1 |
| AC-F7-1 | **Given** an explicit destination and a required limit, **when** evidence export runs, **then** a bounded deterministic bundle (selected records with trace ids and watermarks plus the full chain verdict) is written to that destination with in-band truncation reporting, the redaction chokepoint applied, and the sidecar and registry unmutated; an export without an explicit destination or without a valid limit refuses classified, and no unbounded export path exists. | F-7, DM-7, NFR-5, NFR-10 |
| AC-F8-1 | **Given** the retro registry declaring levels R1–R6 with the closed implementation-status vocabulary, **when** registry reads and writes run — including a malformed registry entry and a torn store — **then** the validated boundary classifies verdicts distinctly (valid / verified-empty / torn / unknown) with repair guidance and never a silent zero, the malformed entry classifies without crashing the run, and `state check` reports the retro registry store verdict per the M1-S2 contract. | F-8, DM-1, EVT-2, NFR-1 |
| AC-F9-1 | **Given** the registered periodic memory-audit trigger with its declared cadence, **when** the audit runs (on demand in this change), **then** the pipeline records the run as evidence — trigger identity, window, outcome references, trace ids — queryable through `retro report` like any other evidence, while the audit procedure itself executes in the memory consolidation skill and no new memory-audit command exists. | F-9, DM-1, EVT-1 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single-story delivery on the change branch per the standard lifecycle; the PR targets the tooling integration branch, not the public baseline.
- The `retro` command family lands as an additive surface: no existing command changes behavior, and the registration is composition-only (absent composition leaves the command unregistered).
- No migration and no backfill: the sidecar starts empty and the registry starts empty; the first sidecar append generates the chaining-key artifact and seeds the sidecar chain anchor; historical invocations already in the audit ledger are collectable evidence, so nothing is seeded.
- Levels R2–R6 ship declared-only: user-facing help and the refusal hints name the owning stories, so declared-but-unimplemented is discoverable, not surprising.
- Doc reconciliation after delivery (doc-sync, phase 7): author the retro-pipeline feature spec (first-spec-only), reconcile the state-layer spec (retro registry store boundary and sidecar artifact family rows in the store-layout table), the audit-ledger spec (retro consumer of the read surface), and the result-contract spec (the three `retro` rows and the domain kind); add glossary entries for the new terms (§23).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. The sidecar and retro registry are new stores starting empty; both are additive with no schema-version bump and no migration of existing stores. The sidecar chaining-key artifact generates on first append (never silently regenerated when guarded records exist — the audit-ledger precedent); the sidecar chain anchors on its first record. Historical command invocations live in the audit ledger and are read as evidence on demand; no retro-specific seeding or backfill exists.

## 20. PRIVACY / COMPLIANCE REVIEW

- Local-only: the sidecar, the retro registry, and every export bundle live under the state directory's least-privilege contract (0700 directory, 0600 files; Windows current-user ACL); no data leaves the machine and no network egress exists.
- Evidence content may include operational history (invocation records, phase transitions, closeout outcomes, retro notes) retained forever per the state layer's model; operators should treat the state directory accordingly. Redaction removes registered secret values before recording, rendering, or export; unregistered values are outside the guarantee, identical to the existing output contract.
- Collector identity is claimed attribution (agent role + lane shape per the M1-S22 convention) — not personal authentication data and carrying no credential material.
- Findings and reports never fabricate content: everything rendered traces to evidence refs, keeping the retro artifact auditable.
- No telemetry export exists; chain breaks and malformation findings name positions, trace ids, and counts only — never payload or checksum bytes.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Trust model wording:** tamper-EVIDENCE, not tamper-prevention, on a pinned single-user host. The enforceable claim: a delivery agent operating within its declared lane environment cannot alter evidence undetectably, because the lane environment never receives the chaining key and the keyed-hash link cannot be forged from records and links alone. A same-user process that deliberately reads the store-managed key artifact to forge links is outside the documented lane environment contract and inside the accepted residual risk (DEC-1/DEC-4) — stated with the same honesty as the audit ledger's documented caveat, and stronger: the in-model boundary is key possession, not permissions alone.
- **Construction divergence is deliberate:** the sidecar does not reuse the audit ledger's link construction; DEC-1 records why (invertibility) and the ticket's pinned decision requires the stronger property. The audit ledger itself is unchanged (its caveat stands for its own domain).
- **Key containment:** the sidecar chaining key exists only as store-managed `0600` key material and runtime-edge-injected data; never in records, output, configuration, ambient environment, or lane environments; substitution is detectable. Distinct artifact and bytes from the audit chain key, so one key's compromise does not cascade.
- **Write-path ownership, not authentication:** `retro.evidence.denied` is a structural refusal plus claimed-identity marking; collector identity is never an authorization input in the authentication sense and is always `claimed`.
- **Fail-closed reads:** verification failures, torn stores, and missing key material never yield silently-trusted or silently-empty results; explicit salvage is the only recovery path and is distinguishable from tampering.
- **No new ambient reads; no new runtime-API locations** beyond the admitted collector I/O seam; no third-party dependency, no network access; the redaction chokepoint remains the single serialization path for evidence, reports, and bundles.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The sidecar grows forever (two states of growth: evidence records and one chaining-key artifact); the bounded read/export surfaces are the supported access patterns — operators and agents should not read sidecar files directly.
- The sidecar chaining key carries operational weight (audit-ledger precedent): losing it prevents verification and continuation for subsequently appended records; rotation/escrow is deferred (§7.2) and revisitable with backup/restore work.
- The level registry is data: adding a level implementation later is a registry-status change plus its level implementation, not a surface change; the refusal hints must keep naming owning stories as levels land.
- The three `retro` error rows join the bidirectional documented-table sync; future changes must keep both tables identical.
- Doc-sync obligations (phase 7): author the retro-pipeline feature spec (with its `ados_distribution` marker); reconcile the state-layer spec (retro registry boundary; sidecar artifact family and chaining-key rows in the store-layout table), the audit-ledger spec (named retro consumer now exists), the result-contract spec (`retro` domain kind, three rows), and the glossary.
- No new recurring jobs or schedules in this change: the periodic memory-audit trigger is declared registry data with on-demand invocation; scheduled invocation arrives with the ceremony runner (M2-S3).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Evidence sidecar | The independent append-only artifact family beside the delivery state store where collector evidence lands; collector-write-only, chain-verified on every read, outside every delivery-agent write path |
| Trace id | The collector-assigned unique identifier (`ev-` prefixed) of one evidence record; the correlation key between findings, reports, and evidence |
| Collection window | The explicit start/end bounds recorded on an evidence record describing what span the source fold covered (the watermark) |
| Collector identity | The claimed identity stamped on evidence records per the M1-S22 convention; attribution only, never verified, never an authorization input |
| Sidecar chain break | The flagged verification failure where a recomputed keyed link diverges from the stored link; names position and trace id, never payload or checksum bytes; tamper evidence |
| Sidecar chaining key | The distinct store-managed key material behind the sidecar's keyed chain; generated once at the runtime edge, `0600`, never provisioned to lane environments, records, output, or configuration |
| Keyed-chain construction | The HMAC-style keyed link (chaining key + previous link + canonical record content) chosen so records and links alone do not enable forgery — deliberately unlike the audit ledger's invertible link |
| Shape-crash guard | The schema-validated read discipline that classifies malformed entries in-band (partial output preserved, no data loss) instead of crashing or silently dropping |
| Entry-level malformation | A record that parses but fails schema validation at the boundary; classifies `retro.evidence.malformed-entry` (exit 1) with valid entries fully preserved |
| Store-level damage | Framing tears, sequence discontinuities, missing key material, permission violations; classifies through state identities as unreachable (exit 2); explicit salvage is the only recovery |
| Pipeline-truth check | A mechanical validation distinguishing verified-empty from vacuous green (skipped ordinals, dangling refs, expected-activity-absent, zero-collector runs) |
| Vacuous green | Silence misread as success: expected pipeline activity absent from the evidence, or a check that never fires |
| Verified-empty | Explicit evidence that a source was checked and is legitimately empty, naming the check that produced the verdict |
| Null retro | A report with no supported findings; a valid success when pipeline-truth checks pass — findings are never fabricated |
| Level registry | The validated registry declaring retro levels R1–R6 with scope kinds, trigger declarations, and implementation status; only `change` is implemented in this change |
| Addendum | The record appended when an already-collected scope is re-collected; reruns append, never rewrite |
| Follow-through (read-fold) | The report section folding recorded follow-through entries with their verification verdicts and artifact references; enforcement belongs to M2-S10 |
| Evidence export | The bounded, deterministic bundle of selected evidence records plus the chain verdict, written only to an explicitly named destination |

## 24. APPENDICES

### Appendix A: Source documents

- Ticket GH-232 (GitHub issue 232, milestone M1) — goal, tasks, two binding ACs, the pinned integrity decision (tamper-evidence not prevention; chaining key never enters lane environments), dependency pins (M0-S5, M1-S2).
- Backlog, M1-S8 section — canonical scope wording (retro collection, registry hardening, shape-crash guards, export; home of the periodic memory audit; the independent evidence sidecar) and the integrity wording.
- Concepts doc, retrospectives.md — levels R1–R6 and triggers, the five-stage process, the evidence plane outside delivery-agent write authority (P0), collectors GET-only/watermarked/bounded, pipeline-truth checks (vacuous green), null-retro-is-success, follow-through-first, addenda-not-rewrites, trace-tampering defense row.
- M1 command pack, retro.md — the proposed command contract: synopsis, envelope data `{level, findings[], followThrough[], evidenceRefs[]}`, exit taxonomy 0/1/2, named errors `retro.evidence.malformed-entry` and `retro.evidence.denied`, the `--level change` example.
- M1 contracts pack — the `retro` Learn-family entry, the `state` entry naming the retro registry as a validated store boundary, cross-cutting invariants (no model calls in deterministic render paths).
- M1 man-page — the locked command surface naming (`retro collect|report [--level <name>]`).
- M1 architecture pack — learning-plane placement; AUD (M1-S22) → RT and CP (M1-S12) → RT edges; writer-ownership table; boundary invariant 5 (deterministic render paths).
- Current-truth specs — state layer (GH-174/GH-222 truth: boundaries, salvage, store-managed artifacts, store layout), audit ledger (GH-223 truth: read surface, chain verdict, skipped ordinals, key artifact precedent, honest FNV caveat), result contract (envelope, exit projection, error-table contract), journeys/cli-command registries (periodic memory audit folded into `ados retro`, no new command).
- Change pm-notes — dependency verification, the design-tension record (audit chain invertibility vs the pinned decision), the memory-audit scope reading, doc-impact list.
- Workspace rules — TypeScript ports/adapters layering, error contract, bun:test authoring; testing strategy (structure/behaviour/boundaries/checks layers, `pnpm check` aggregate).

### Appendix B: Test-plan handoff note

The test plan must demonstrate both ticket binding ACs verbatim and every derived AC above. Minimum coverage beyond the ACs: the tamper mutation matrix across all pinned alteration classes (content edit, deletion, reorder, truncate-and-reappend, recomputed-unkeyed-checksum edit, key-artifact substitution) with 0 false "verified" verdicts and cross-process verification continuity; the shape-crash-guard matrix over both stores (entry-level vs store-level taxonomy, DEC-7) with valid-entry-output byte-equality against clean runs; the five pipeline-truth checks each with a triggerable negative fixture and a check-removal mutation failing the suite; level-refusal cases (unknown, declared-but-unimplemented, omitted defaulting to `change`); addendum behavior on re-collection; the follow-through read-fold with unverifiable-artifact marking; export boundedness, destination refusal, and truncation reporting; key-exclusion assertions across lane environments, records, output, and configuration; `retro.evidence.denied` structural-refusal cases; error-table round-trip for the three new rows with the documented table; envelope/scripted rendering conformance for both commands; determinism replays; and the registry-boundary verdict matrix (valid / verified-empty / torn / unknown) with `state check` visibility. No case may be skipped; the no-model-call render-path invariant needs a structure-level assertion.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @spec-writer | Initial specification |

---

## AUTHORING GUIDELINES

Authored from the ticket-derived planning summary (PM clarify_scope, 2026-11-06), the M1-S8 backlog entry, the retro concepts doc, the M1 pack (commands/retro.md, contracts.md, man-page.md, architecture.md), the current-truth specs (state layer, audit ledger, result contract), and the workspace rules. The seven PM-flagged design tensions are resolved in the decision log (DEC-1..DEC-13) rather than deferred; both ticket binding ACs are kept verbatim and mapped to operational criteria without weakening. No implementation tasks, file paths, or code-level instructions are included; exact artifact names, primitives, and suite inventories are deliberately pinned at plan time. The audit-ledger honest-caveat precedent shapes the guarantee scoping in DEC-1/DEC-4: the spec claims detection, scopes it to actors not possessing the key, and says so in the same breath.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-232)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, EVT-, OQ-)
- [x] Acceptance criteria reference at least one F-/DM-/EVT-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (contracts summarized, not restated)
- [x] Front matter validates per front_matter_rules
- [x] Binding ticket ACs quoted verbatim and unweakened (§17 preamble, AC-F4-1, AC-F2-3)
