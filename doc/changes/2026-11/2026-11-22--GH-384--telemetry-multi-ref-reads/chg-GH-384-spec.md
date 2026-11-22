---
change:
  ref: GH-384
  type: fix
  status: Proposed
  slug: telemetry-multi-ref-reads
  title: "M4-S22: Telemetry reads must be multi-ref safe everywhere — window evidence and baseline capture (M4)"
  owners: ["Juliusz Ćwiąkalski"]
  service: "state-layer telemetry step and baseline reads and the baseline append idempotency path (core read/write path)"
  milestone: "M4: Jaiship-native delivery"
  labels:
    - change
    - planning
    - defect
    - state
    - telemetry
    - spend
    - m4
  version_impact: minor
  audience: internal
  security_impact: none
  risk_level: low
  dependencies:
    internal:
      - "delivered telemetry v2 storage families: the harness.telemetry.step and harness.telemetry.baseline record kinds under their store-scoped key prefixes (GH-291, GH-294, GH-299, GH-335)"
      - "delivered per-ref telemetry families projection: the rule source whose foreign-key skip, bare-prefix tear, and requested-ref tear this change applies unchanged at the two remaining sites (GH-381)"
      - "delivered state store: the single verified ledger read (parse, contiguous sequence, checksum recomputation) that every projection composes"
      - "delivered spend read side: the window-scoped zero-spend evidence reading composed over the steps read (GH-236, GH-299)"
      - "delivered baseline capture path: the fenced, framed, checksummed baseline append whose idempotency pre-read and post-verified read own the second defect site"
      - "delivered versioned step read: the versioned composition over the steps read that inherits the correction unchanged"
    external:
      - "none; both sites perform zero network, zero harness-store, and zero vendor calls, unchanged"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the two telemetry reads that still treat a foreign change ref's telemetry as damage behave exactly like the delivered per-ref families projection — the window-evidence steps read skips well-formed foreign step keys, and the baseline append's idempotency reads skip well-formed foreign baseline keys — so window evidence renders and a second ref's baseline capture succeeds on any multi-change ledger, while bare prefixes, requested-ref damage, idempotency semantics, the one-verified-pass bound, and every delivered identity stay exactly as delivered (F-1..F-8, NFR-1..NFR-7).

## 1. SUMMARY

Two sibling reads in the state layer's telemetry module still classify any telemetry-family key that is not the requested ref's exact key as `state.store.torn`, although the delivered per-ref families projection (GH-381) established the house rule for exactly this shape: a well-formed family key naming another ref is skipped and never damage. The first site is the per-ref steps read composed by the spend command's window-scoped zero-spend evidence: on any ledger holding two changes' telemetry it tears on a valid foreign step record, so that spend surface stays unavailable. The second site is the baseline append's idempotency pre-read and post-verified read: on a ledger already holding another ref's baseline records it tears, so a second ref's baseline capture fails permanently. Both failures were observed, not theorized — the second one directly, when the GH-381 change's own fixtures had to raw-append two refs' baselines inside one fence to avoid exercising the delivered helper at all.

This change applies the delivered rule, unchanged and in full, to the two remaining sites. A well-formed family key for another ref is skipped — no kind inspection, no payload inspection, no evidence; the bare family prefix tears `state.store.torn` at its own position; the requested ref's key with the wrong kind tears; and requested-ref payload validation is untouched. Baseline idempotency is not weakened: a same-ref repeat capture stays a no-op rather than a duplicate, and the first ref's baseline record stays byte-identical. No ledger record is deleted, rewritten, or salvaged; every read stays a single verified pass over the store with no per-record store reads. Consumer report shapes are unchanged: the only observable difference is that multi-ref ledgers read and capture successfully, and each result contains exactly the requested ref's records.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The state ledger is one shared append-only log.** Every change's records land in one project ledger with contiguous sequences and per-record checksums. Multi-ref telemetry is the normal steady state: any project that has delivered two changes holds two refs' telemetry families.
- **The house rule is delivered and declared.** The per-ref families projection corrected by GH-381 (merged to the tooling integration branch as `0320321f`, PR #383) skips well-formed foreign family keys without inspecting their kind or payload, tears on the bare family prefix at its own position, and tears on requested-ref kind mismatches and payload failures. The telemetry v2 reading bases state this rule as current truth for the per-ref families read and its declared consumers.
- **Two delivered reads still contradict the rule.** The per-ref steps read — composed by the window-scoped zero-spend evidence reading and by the versioned steps composition — tears on any record under the step family prefix whose key is not the requested ref's exact key. The per-ref baseline records read — which is the composition seam of the baseline append's fence-scoped idempotency pre-read and post-verified read — tears identically on foreign baseline keys. Both treat the family prefix as an ownership claim, so a valid record of another ref lands in the branch and stops the read.
- **Window evidence is offline on every multi-ref ledger.** The window-scoped zero-spend evidence reading — the peak-pause proof surface — composes the steps read; with two refs' telemetry in the ledger it returns `state.store.torn` naming a valid foreign step record instead of the evidence reading.
- **Second-ref baseline capture fails permanently.** The baseline append's idempotency check runs inside the fence by reading the requested ref's baseline records before and after the append; on a ledger holding another ref's baselines the pre-read tears, so the capture for the second and every subsequent ref of a project cannot run at all. This was observed directly: the GH-381 fixtures worked around it by raw-appending both refs' baselines inside one fence — a workaround that exists only because the delivered helper cannot perform a second ref's append.
- **The defect class has one known latent instance outside the ticket's scope.** The standalone capture-family read carries the same tear-on-foreign-key shape in delivered code; it has no delivered consumer composing it, no observed failure, and is not named by the ticket or the binding owner comment. It is recorded as deferred (§7.3), not in scope.
- **The append-only ledger has no repair path.** The delivered storage contract never mutates, drops, or rewrites stored records, and no salvage tooling exists — the only correct remedy is at the reads, where the defect lives.

### 2.2 Pain Points / Gaps

- **The peak-pause proof surface bricks on success.** Window evidence — the falsifiable zero-spend reading that peak pausing depends on — refuses to render exactly when a project has delivered two or more changes: it tears on the first foreign step record it meets, which with a long-running first change is early in the ledger.
- **Every change after the first loses baseline capture.** The baseline append is the capture-time record of a session's starting totals; with the idempotency read tearing, no change after the first in a project can capture baselines through the delivered path, impairing the telemetry foundation all spend and metrics reads rest on.
- **The tears name healthy records.** `state.store.torn` is the identity for ledger damage, and both sites point it at records a valid append path produced — misdirecting diagnosis toward ledger repair, the one remedy the append-only contract forbids.
- **The existing proof ships around the defect.** The delivered fixtures' raw-append workaround proves the fixture data, not the helper; the defect hides in exactly the code the workaround avoids. Any fix proof that keeps the workaround would certify nothing.
- **The failure scales with success.** A single-ticket project works; the defects arrive the moment the tooling is used as designed across consecutive tickets — the same structural shape GH-381 closed for the families projection.
- **A blocking prerequisite.** Spend reconciliation (#378) requires attribution and window reads plus a second ref's baselines to work before cost can be reconciled per change; both are offline today.

## 3. PROBLEM STATEMENT

Because the per-ref steps read and the baseline append's idempotency pre- and post-reads classify any telemetry-family key that is not the requested ref's exact key as `state.store.torn`, an operator cannot obtain window-scoped zero-spend evidence in any project holding two or more changes' telemetry, and the system cannot capture a second change's session baselines through the delivered append path — resulting in peak-pause episodes that cannot be evidenced, telemetry capture that degrades permanently after the first change, damage reports naming valid records, and a blocked spend-reconciliation prerequisite.

## 4. GOALS

- **G-1**: The steps read answers exactly one ref: a well-formed step-family key belonging to another ref is skipped — no kind inspection, no payload inspection, no evidence — so the window-scoped evidence reading renders on a ledger holding two or more refs' telemetry and reports exactly the requested ref's steps.
- **G-2**: The baseline append's idempotency pre-read and post-verified read answer exactly one ref: a well-formed baseline-family key belonging to another ref is skipped under the same terms, so a second ref's baseline capture succeeds on a ledger that already holds another ref's baselines.
- **G-3**: Baseline idempotency semantics are preserved, not weakened: a repeat capture for the same ref and the same run-and-session identity is a no-op, never a duplicate; the append remains fence-scoped; and every pre-existing ledger record stays byte-identical across another ref's successful append.
- **G-4**: Damage detection is preserved, not relaxed: the bare step prefix and the bare baseline prefix each tear `state.store.torn` at their own record's position; the requested ref's key with the wrong family kind tears; and requested-ref payload validation runs exactly as delivered.
- **G-5**: Every read stays one verified pass over the store: no second pass, no per-record store reads, no harness re-query; the baseline append keeps its delivered fence-scoped pre/post read shape with no additional store reads.
- **G-6**: The ledger is untouched: append-only semantics, record contents, sequences, and checksums are preserved; no delete, rewrite, truncate, compact, or salvage path exists on any branch of this change.
- **G-7**: Single-ref behavior is identical: on a ledger whose telemetry holds only the requested ref, every result — records, ordering, verified-empty flag, evidence, append outcomes, and every tear case — is identical to delivered behavior.
- **G-8**: The original failures are pinned: a regression case named for the GH-381 review advisory reproduces both pre-fix failures against the pre-fix code (golden-before-fix), so the proof demonstrates the defect, not a workaround of it.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Multi-ref ledgers (≥2 refs' telemetry) on which the window-scoped evidence reading tears | 0, over the full proof matrix (F-1) |
| Second-ref baseline captures failing on a ledger holding another ref's baselines | 0 (F-2) |
| Same-ref baseline repeats producing a duplicate record instead of a no-op | 0 (F-3) |
| Pre-existing ledger records whose bytes change across another ref's baseline append | 0 (F-3, NFR-7) |
| Foreign steps appearing in a window reading's matched or excluded sets | 0 (F-1, NFR-5) |
| Bare-prefix keys (step or baseline family) skipped instead of tearing, or tearing at a wrong position | 0 of each (F-4, NFR-3) |
| Requested-ref kind mismatches or payload failures wrongly skipped | 0 (F-5, NFR-3) |
| Additional store reads or per-record re-reads introduced by any path | 0 each (F-5-goal, NFR-1) |
| Ledger records mutated, dropped, or reordered by any path of this change | 0 (G-6) |
| Behavior differences versus delivered behavior on single-ref ledgers | 0, golden comparison (G-7, NFR-6) |
| Pre-fix failure shapes not reproduced by the named regression case | 0 of 2 (G-8) |

### 4.2 Non-Goals

- **NG-1**: No ledger mutation of any kind — no delete, rewrite, truncate, compaction, salvage, or repair of any record; no migration, back-fill, or seeding step.
- **NG-2**: No new vocabulary: no new error identity, state record kind, payload schema, store-scoped key prefix, envelope key, event code, or exit code. Every identity produced on any path is delivered today.
- **NG-3**: No change to the per-ref families projection — it is already correct and is the rule source this change applies; no change to the telemetry capture writers, the step append, the capture-outcome append, or the session-record branch.
- **NG-4**: No change to consumer report shapes: the spend envelope, the window-scoped evidence reading's keys and exclusion-reason set, the status digest, and the metrics report keep their delivered shapes, figures, tolerances, and disclosure rules; their only difference is failing → succeeding on multi-ref ledgers.
- **NG-5**: No new reads and no optimization beyond the delivered read shapes: no per-ref index, no cache, no second projection, no additional store read on any path.
- **NG-6**: No change to any other ledger projection (economics, phase history, command audit, change registry) or to the global ledger verifier.
- **NG-7**: No decision record is authored: this change continues the delivered GH-381 rule at two remaining sites; the read contract is unchanged (see DEC-4 and §14).
- **NG-8**: No documentation edits in this change; the phase-7 reconciliation obligation is named in §22.
- **NG-9**: The spend-reconciliation work item (#378) keeps its own scope; this change is its prerequisite, not its substitute.
- **NG-10**: No change to the standalone capture-family read: it has no delivered consumer, no observed failure, and is outside the ticket's declared two-site scope (deferred, §7.3).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Per-ref steps read: foreign well-formed step keys are skipped, never damage; window evidence renders on multi-ref ledgers, exactly scoped | The peak-pause proof surface is unusable on the ledgers projects actually accumulate; the read must project one ref, mirroring the delivered families rule |
| F-2 | Per-ref baseline idempotency reads: foreign well-formed baseline keys are skipped, never damage; a second ref's baseline capture succeeds | The capture-time baseline foundation fails permanently for every change after a project's first; the idempotency reads must project one ref under the same rule |
| F-3 | Baseline idempotency semantics preserved: same-ref repeat is a no-op, never a duplicate; pre-existing records stay byte-identical | The owner constraint forbids weakening idempotency; the fix must not trade the multi-ref tear for a duplicate-append defect |
| F-4 | Malformed family keys still tear: the bare prefix of either family tears at its own position | The fix must separate "someone else's record" from "a record that is itself invalid", or damage detection would be silently weakened |
| F-5 | Requested-ref damage still tears: kind mismatch and payload validation unchanged, with delivered location fidelity | The tear contract for the ref actually being read must not relax |
| F-6 | One verified pass per read, zero ledger mutation on any path | The delivered read bound and the append-only contract are declared constraints the fix must keep |
| F-7 | Single-ref behavior identical | Every existing single-ref ledger, report, append outcome, and tear case must behave identically after the fix |
| F-8 | Pre-fix failure reproduction pinned: the named regression case proves both defects against the pre-fix code | A proof that never exercises the defect proves nothing; GH-381's raw-append workaround must become the behavior under test |

### 5.1 Capability Details

**F-1 — Per-ref steps read.** The steps read answers one work-item ref and no other: its returned collection contains exactly the requested ref's step records, and its result shape — records, verified-empty flag, evidence disclosing the store path — is unchanged. A ledger record whose key falls under the step family prefix, carries a non-empty ref remainder, and is not the requested ref's key belongs to another change: it is skipped in ledger order — it contributes no record, no evidence, no count, and no classification — and the scan continues. This is the delivered families rule applied unchanged (DEC-1). The skip is silent by design; the evidence continues to disclose the store path and the ledger's record count. The window-scoped zero-spend evidence reading, which composes this read, therefore renders on a multi-ref ledger: its matched and excluded sets are computed over exactly the requested ref's steps, so a foreign step appears in neither set — skipped steps are not re-classified as exclusions, and no exclusion reason exists or is invented for them (NFR-5). The versioned steps composition inherits the corrected read unchanged.

**F-2 — Per-ref baseline idempotency reads.** The baseline append's idempotency check runs inside the acquired fence: a pre-read establishes whether the run-and-session identity already exists, and a post-verified read confirms the append landed. Both reads compose the per-ref baseline records read, which currently tears on any baseline-family key that is not the requested ref's exact key — so a ledger holding another ref's baselines stops the capture before it starts. Under this change both reads apply the delivered families rule unchanged: a well-formed baseline-family key naming another ref is skipped — no kind inspection, no payload inspection, no evidence — and the idempotency comparison considers exactly the requested ref's baseline records, as it already intends to. The rule is required on the composition path of both the pre-read and the post-read; fixing one and not the other is a partial fix and fails this capability (DEC-3). A second ref's baseline capture on a ledger holding another ref's baselines therefore succeeds, appending only the second ref's record.

**F-3 — Idempotency semantics preserved.** Nothing about idempotency relaxes. The dedupe key stays the run-and-session identity pair, evaluated over the requested ref's baseline records inside the fence. A repeat capture for the same ref, run, and session observes the existing record and appends nothing: the outcome is the delivered no-op, not a duplicate record. A capture for a different session of the same ref appends as delivered. The first ref's baseline record — and every pre-existing ledger record — is byte-identical after another ref's successful append (NFR-7): the append path adds records and never modifies existing ones, and the foreign-key skip adds no write of any kind.

**F-4 — Malformed family keys still tear.** The distinction is exact and declared, restating the delivered rule for the two sites. Within a family, a ledger key has the shape `<family prefix><ref remainder>`:

| Key under a family prefix | Classification | Behavior |
|---------------------------|----------------|----------|
| Ref remainder is empty (the bare prefix, e.g. `harness.telemetry.step:` with nothing after it) | Malformed — the record itself is invalid | `state.store.torn` at that record's position (store path + record sequence), as delivered for damage |
| Ref remainder is non-empty and the key is the requested ref's key | The requested ref's record | Governed by F-5: kind must match the family kind and the payload must validate, exactly as delivered |
| Ref remainder is non-empty and the key is any other ref's key | Foreign — someone else's record | Skipped; no kind inspection, no payload inspection, no evidence |

The rule applies symmetrically to the step family (in the steps read) and the baseline family (in the idempotency composition path). A foreign key's kind and payload are deliberately not inspected: they are that record's own ref's business, and a per-ref read is not a global validator (DEC-2). The global integrity layer — the verified read that parses every record, checks sequence contiguity, and recomputes every checksum regardless of key — is unchanged and remains the place where physically damaged records are caught for every ref.

**F-5 — Requested-ref damage preserved.** For the requested ref's own keys, nothing relaxes. A step-family key of the requested ref whose record kind is not the step kind tears `state.store.torn` at that record's position; symmetrically for the baseline family on the idempotency path. Payload validation of the requested ref's records runs exactly as delivered, with its delivered classifications and locations. Every preserved tear names the delivered safe location — the store path and the offending record's sequence — so tear-location fidelity is a hard requirement, not an incidental (NFR-3).

**F-6 — One verified pass, no ledger mutation.** Each read composes exactly one verified pass over the ledger, in ledger order, as delivered; the skip adds no read: no second scan, no per-record store re-read, no harness or session query, no index. The baseline append keeps its delivered fence-scoped shape — one pre-read and one post-verified read — with zero additional store reads introduced by this change. No branch of this change writes, mutates, reorders, or deletes any ledger record; the only writes on any path are the delivered appends themselves.

**F-7 — Single-ref behavior identical.** For a ledger whose telemetry families hold only the requested ref — today's single-ticket projects — every observable is identical to delivered behavior: the same records returned in the same order, the same verified-empty result, the same evidence, the same append outcomes, and the same tear behavior for every delivered tear case. The correction changes exactly one thing: keys that are provably someone else's no longer stop a read or a capture.

**F-8 — Pre-fix failure reproduction pinned.** A regression case named for the GH-381 review advisory that identified these defects reproduces both original failures against the pre-fix code: the steps read tearing on a valid foreign step key, and the baseline append failing on a ledger holding another ref's baselines. The proof is a golden-before-fix pin: the pre-fix failure shapes are captured from committed fixtures and asserted, so the case fails if either defect regresses and demonstrates the fixtures genuinely exercise the defect. The proof exercises the delivered append helper — not a raw append — for the baseline site; the GH-381 workaround becomes exactly the behavior under test (DEC-3). Raw appends inside a fence survive only for shapes production writers never emit (bare prefixes, wrong kinds), the delivered technique for damage fixtures.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Window evidence on a multi-ref ledger, corrected
  Ledger: change A telemetry interleaved with change B telemetry, a foreign
  step record appearing before the requested ref's first record
    Operator: spend --window-evidence --from <park> --through <window> --ref B
      → one verified pass over the shared ledger
      → A's step-family keys: well-formed, foreign → skipped, never damage
      → B's step records projected into the window reading
      → evidence reading renders; matched/excluded sets contain exactly B's
        steps per the delivered window rules; A's steps appear in neither set
```

```
Flow 2 — Second ref's baseline capture on a shared ledger
  Ledger already holds change A's baseline records
    Capture for change B: baseline append acquires the fence
      → pre-read: A's baseline keys are well-formed, foreign → skipped
      → no record of B's run-and-session identity → the append proceeds
      → B's baseline record appended; post-verified read succeeds
      → capture returns appended; A's baseline record is byte-identical
    Repeat capture for change B, same run and session
      → pre-read finds the identity → no-op outcome, no duplicate record
```

```
Flow 3 — Malformed family key still tears
  A record whose key is the bare step prefix (or bare baseline prefix)
    → the F-4 table classifies it malformed — a record that is itself invalid
    → state.store.torn at that record's position (store path + sequence)
    → the read or capture stops; damage reporting is unchanged in identity
      and location fidelity
```

```
Flow 4 — Requested-ref damage still tears
  A record under the requested ref's step key carrying a non-step kind
  (symmetrically: requested baseline key, non-baseline kind, on the
  idempotency path)
    → the F-4 table classifies it requested-ref damage
    → state.store.torn at that record's position, as delivered
  A requested-ref record whose payload fails validation
    → the delivered payload classification and location, unchanged
```

```
Flow 5 — The pre-fix failures, pinned
  The regression case named for the GH-381 review advisory, against the
  pre-fix code over committed fixtures
    → steps read tears on a valid foreign step key (site one)
    → baseline append for the second ref fails on foreign baselines (site two)
    → both failure shapes are captured and asserted; against the corrected
      code both succeed instead
```

```
Flow 6 — Single-ref ledgers unchanged
  A ledger whose telemetry holds only the requested ref
    → the steps read, the baseline append, and every tear case behave
      byte-identically to delivered: same records, same outcomes, same
      evidence, same identities and locations
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The per-ref steps read: the foreign-key skip, the bare-prefix tear, and the unchanged requested-ref tear and payload behavior (the F-4 table as the normative rule).
- The per-ref baseline records read as the composition seam of the baseline append's idempotency pre-read and post-verified read: the same rule applied on both reads' path; no partial fix.
- Baseline idempotency semantics preserved: fence-scoped run-and-session dedupe unchanged, no-op repeat outcome, byte-identity of pre-existing records.
- Tear-location fidelity for every preserved tear case: store path plus offending record sequence.
- The proof fixtures: interleaved two-ref step families with the foreign record first (the observed shape); two-ref baselines where the second ref's append runs through the delivered helper; bare-prefix fixtures for both families; requested-ref kind-mismatch fixtures; the named pre-fix regression pin; the single-ref golden comparison; the single-pass read proof; the determinism matrix.
- The declared lockstep changeset format (§18) and the phase-7 reconciliation obligation (§22).

### 7.2 Out of Scope

- [OUT] Any ledger mutation: deleting, rewriting, truncating, compacting, or salvaging any record; any repair, migration, back-fill, or seeding step.
- [OUT] New vocabulary of any kind: error identity, state record kind, payload schema, key prefix, envelope key, event code, exit code.
- [OUT] Changes to the per-ref families projection (the rule source, already correct), the capture writers, the step append, the capture-outcome append, or the session-record branch.
- [OUT] Changes to consumer report shapes or semantics: spend envelope keys, the window-evidence reading's keys and closed exclusion-reason set, digest sections, metrics report blocks, tolerances, disclosure rules, or exit projections.
- [OUT] Changes to other ledger projections (economics, phase history, command audit, change registry) or to the global ledger verifier.
- [OUT] The standalone capture-family read (NG-10): no delivered consumer, no observed failure, not named by the ticket — deferred (§7.3).
- [OUT] Per-ref indexes, caches, secondary projections, or any read beyond the delivered single verified pass and the delivered pre/post append shape.
- [OUT] A decision record: the read contract is unchanged by this continuation (NG-7, DEC-4).
- [OUT] Documentation edits (phase-7 scope, §22).
- [OUT] The spend-reconciliation work item #378 and its scope.
- [OUT] Global validation of foreign refs' key grammar, kinds, or payloads — outside a per-ref read's jurisdiction (DEC-2).

### 7.3 Deferred / Maybe-Later

- **The standalone capture-family read.** Delivered code carries the same tear-on-foreign-key shape in the capture-family read, but no delivered consumer composes it, no failure has been observed through it, and the binding ticket scopes two sites. If a consumer ever composes it, the same rule applies — this specification's F-4 table is the stated rule for that day, and closing it then is a one-line-class continuation, not a new design.
- **A writer-side bare-prefix guard**, so a bare-prefix record can never land: a distinct append-time concern; the reader-side tears delivered here remain the safety net either way.
- **A shared projection helper for the per-ref skip rule.** With the economics read, the families projection, and now the steps and baseline reads, the rule is stated in several delivered places; a helper is worthwhile when the next per-ref read is authored, not as a side effect of this defect correction.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. The change is confined to the local state read path, the baseline append, and their CLI consumers; no HTTP endpoint, route, or payload is added or modified, and no vendor endpoint is contacted.

### 8.2 Events / Messages

N/A. Neither site emits an event, announcement, or message on any path, before or after this change. No event code or evidence key is added.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Family key grammar (declared, unchanged) | A telemetry family key is `<family prefix><ref remainder>`. The step and baseline family prefixes are the delivered store-scoped constants (`harness.telemetry.step:`, `harness.telemetry.baseline:`). An empty ref remainder is malformed; a non-empty remainder names the record's owning ref. No new prefix or grammar is introduced. |
| DM-2 | Steps-read result | Unchanged shape: the records collection, the verified-empty flag, and the evidence (store path). Contents on a multi-ref ledger are exactly the requested ref's steps; the window-evidence consumer composes the same result unchanged. |
| DM-3 | Baseline append outcome | Unchanged shape and semantics: appended true with the delivered append outcome, or the delivered no-op outcome for an existing run-and-session identity, fence-scoped as delivered; idempotency key unchanged. The only behavioral difference is succeeding where the pre- or post-read previously tore on foreign baselines. |
| DM-4 | Damage taxonomy unchanged | `state.store.torn` keeps exactly its delivered subjects: malformed family keys, requested-ref kind mismatches, requested-ref payload validation failures, and every other delivered tear case. No identity is added, removed, or re-semanted. |
| DM-5 | Ledger records | Unchanged: same record kinds, payload schemas, keys, sequences, and checksums. Nothing is written, mutated, or reordered by any path of this change beyond the delivered appends; existing ledgers — multi-ref included — are read without transformation. |

### 8.4 External Integrations

N/A. Both sites perform zero harness-store queries, zero network calls, and zero vendor requests, before and after this change.

### 8.5 Backward Compatibility

- **Single-ref ledgers: identical behavior** (F-7, NFR-6). Same records, same ordering, same verified-empty result, same evidence, same append outcomes, same tear behavior for every delivered tear case.
- **Multi-ref ledgers: failing → succeeding.** The only behavioral difference is that a read or capture that returned `state.store.torn` naming a valid foreign record now succeeds and returns exactly the requested ref's records. No report or capture that succeeded before this change changes shape or content.
- **Tear identities and locations unchanged.** Every preserved tear produces the delivered `state.store.torn` with the delivered safe location (store path + record sequence); no identity, exit projection, or location convention changes.
- **Idempotency contract unchanged.** The same-ref repeat remains a no-op; the run-and-session dedupe key and the fence scoping are as delivered; no duplicate can be produced on any path.
- **Ledgers need no migration.** Existing multi-ref ledgers become readable and capturable without transformation, repair, or rewrite; the append-only contract is untouched.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Single-pass read cost | Exactly one verified pass over the ledger per read invocation (steps read; each baseline idempotency read); the baseline append keeps its delivered pre/post read shape with 0 additional store reads, 0 per-record re-reads, 0 harness or session queries; work linear in total ledger records and constant per record |
| NFR-2 | Determinism and hermeticity | The same ledger, the same requested ref, and the same code produce identical results — records, ordering, verified-empty, append outcomes, evidence, tear identities and locations — across repeated runs (three-run equality over the proof matrix); all proof fixtures run offline over committed state with zero network, zero ambient-store, and zero real-clock dependencies |
| NFR-3 | Tear fidelity | Every preserved tear names `state.store.torn` with the delivered safe location — the store path and the offending record's 1-based ledger sequence; 0 location drift across the bare-prefix, kind-mismatch, and payload cases, in both families |
| NFR-4 | Closed-vocabulary invariance | Exact equality with the delivered sets: 0 new error identities, state record kinds, payload schemas, key prefixes, envelope keys, event codes, and exit codes on any path |
| NFR-5 | Projection exactness | A multi-ref read returns exactly the requested ref's records: 0 foreign records in any returned collection, 0 requested-ref records dropped; a window reading's matched and excluded sets contain 0 foreign steps and are computed over exactly the requested ref's steps; verified-empty true if and only if the requested ref holds no records of the family; hold for both read directions of every interleaved fixture |
| NFR-6 | Single-ref golden equality | On ledgers whose telemetry holds only the requested ref, the steps read result, the baseline append outcomes, and every tear case are identical to delivered behavior — golden comparison; 0 differences |
| NFR-7 | Ledger byte-identity across append | Appending the second ref's baseline leaves every pre-existing ledger record byte-identical: 0 bytes changed in existing records; the ledger grows by exactly the appended record(s); asserted for the append path of every multi-ref baseline fixture |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **No new telemetry.** No metric, log channel, event code, announcement, or alert is added; both sites are as silent as delivered. The change is observable entirely through the delivered surfaces.
- **The correction is visible as absence of failure.** On a multi-ref ledger, the window-scoped evidence reading renders where it returned `state.store.torn`, and a second ref's baseline capture succeeds where it failed; no counter, marker, or disclosure distinguishes a multi-ref result from a single-ref one, and none is needed.
- **Damage stays loud.** Bare prefixes and requested-ref damage keep tearing with the delivered identity and location, so a genuinely damaged ledger degrades into a named failure, never into a silently clean report or a spurious successful append (F-4, F-5, NFR-3).
- **Foreign-record skipping is not hidden, only silent per record.** The reads' evidence continues to disclose the store path and the ledger's record count, and the window reading's matched/excluded sets cover exactly the requested ref's steps, so an operator comparing coverage against the disclosed ledger size can always see that a reading answers one ref's slice of a larger ledger.
- **Operator reproduction from recorded state alone.** Both defects and their correction must be reproducible from committed fixtures over recorded ledger shapes — including the foreign-first shape — so a support conversation cites fixtures, not a live incident ledger.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | An over-broad skip masks genuine damage: a record that should tear is skipped, so a damaged ledger yields a clean report or a spurious append success | H | L | The F-4 table is exhaustive over family keys: only a non-empty foreign remainder skips; the bare prefix tears at its own position, and requested-ref kind and payload damage tear as delivered; fixtures pin each tear case with identity and location assertions (NFR-3) | L |
| RSK-2 | An under-broad or partial fix reintroduces the defect: only the pre-read fixed and not the post-read, only the steps site fixed and not baselines, or a variant shape the fixtures miss | H | L | The rule is required on the composition path of both idempotency reads and both sites (DEC-3); fixtures prove the steps read and the baseline append symmetrically, both read directions, with the foreign record first in the named regression case — the exact observed shape | L |
| RSK-3 | Idempotency is silently weakened: the skip misapplied so a same-ref repeat appends a duplicate, or a foreign append disturbs ref A's record | H | M | F-3 and NFR-7 make the no-op outcome and byte-identity of pre-existing records asserted properties of every multi-ref baseline fixture; the run-and-session key and fence scoping are declared unchanged (DM-3) | L |
| RSK-4 | The proof exercises the workaround instead of the defect: fixtures keep GH-381's raw-append two-refs technique for healthy baselines, certifying code the defect never touches | H | M | F-8 and the binding owner comment require the delivered append helper on the baseline fixtures; raw append inside a fence survives only for shapes production writers never emit; the pre-fix regression pin fails if the helper is not the exercised path | L |
| RSK-5 | Test-case id collisions recreate the GH-381 DoR iteration-1 failure: a chosen case id names a delivered, unrelated case | M | M | The delivered TC-id series state is recorded in Appendix D as of authoring; the test-plan author verifies the next free ids in the delivered tree before assigning (§24) | L |
| RSK-6 | Changeset format regression: a single-package patch instead of the five-package lockstep minor, repeating the GH-381 quality-gate rework | M | M | The format is declared in §18 and the front matter from the start, with the verified ground truth recorded (§24); plan and delivery authors use it directly | L |
| RSK-7 | Tear-location fidelity drifts while editing the branches: a preserved tear reports the wrong record position | M | L | NFR-3 makes location equality a hard, asserted property for the bare-prefix, kind-mismatch, and payload cases in both families; no new location convention exists to drift into | L |
| RSK-8 | Single-ref behavior drifts as a side effect of editing the branches | M | L | F-7/NFR-6 golden equality over records, ordering, verified-empty, append outcomes, evidence, and all tear cases; the single-ref fixture is part of the proof matrix | L |
| RSK-9 | The specification reading bases are read as covering only the families projection, so future changes miss the standalone reads and reintroduce the class | M | M | §22 declares the phase-7 reconciliation obligation naming the steps read and the baseline idempotency reads explicitly; this specification states the corrected contract as current until then | M (until phase 7 lands) |

## 12. ASSUMPTIONS

- **A-1**: The GH-381 dependency is satisfied: the rule and its fixtures are merged to the tooling integration branch (`0320321f`, PR #383), so this change reuses rather than re-derives the convention.
- **A-2**: The ledger is healthy wherever these reads are the suspect: damage is the global verifier's jurisdiction, unchanged.
- **A-3**: The delivered rule's classification table applies verbatim; no key-grammar extension, no ref validation, no new malformed shape beyond the bare prefix is introduced.
- **A-4**: The window-scoped evidence reading is the delivered consumer composing the steps read, and the versioned steps composition inherits it; correcting the steps read corrects both with no per-consumer edit.
- **A-5**: The baseline append keeps its delivered fence-scoped read shape — one pre-read and one post-verified read — and this change adds no store read on any path.
- **A-6**: The lockstep changeset format verified from the repository's changeset configuration and landed precedent (one changeset declaring all five fixed-group packages at minor) is binding for the plan and delivery phases of this change.
- **A-7**: The proof battery runs under the repository's declared gate conventions (including the scratch-directory override used for gate evidence) and is fully hermetic: fixtures are committed state, never a live ledger.
- **A-8**: No decision record is required because the read contract — a per-ref projection in one verified pass, with `state.store.torn` reserved for genuinely invalid or requested-ref damage — does not change; this change continues the delivered rule at two remaining sites (§14, DEC-4).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-381 (merged, `0320321f`, PR #383) | The rule source and fixture precedent; satisfied |
| Depends on | Delivered telemetry v2 storage families (GH-291, GH-294, GH-299, GH-335) | Supplies the record kinds, payload schemas, and the store-scoped family prefixes the F-4 table classifies |
| Depends on | Delivered state store verified read | Supplies the single verified pass — parse, sequence contiguity, checksums — every read composes, and the global integrity layer that stays unchanged |
| Depends on | Delivered spend read side (GH-236, GH-299) | The window-scoped evidence consumer whose multi-ref failure is site one's observable; unchanged except failing → succeeding |
| Depends on | Delivered baseline capture path | The fenced append whose idempotency pre/post reads own site two; its write semantics are unchanged, only its reads are corrected |
| Depends on | Ticket GH-384 and its binding owner implementation-pointer comment | Source of truth for the two sites, the required behavior, the AC fixtures, and the constraints |
| Blocks | Spend reconciliation (#378) | Attribution/window reads and a second ref's baselines must work before cost can be reconciled per change |
| Blocks | Peak-pause evidence in every multi-ticket project | The window reading is offline exactly when a project's second change lands |
| Blocks | Baseline capture for every change after a project's first | The idempotency pre-read tears on the first ref's baselines |
| External | None | No vendor, network, credential, or transport dependency exists on any path |

## 14. OPEN QUESTIONS

None open. The two questions raised during clarification are resolved and recorded here for traceability; both resolutions are already reflected in the pm-notes.

| ID | Question | Resolution | Status |
|----|----------|------------|--------|
| OQ-1 | Does the second site mean only the two idempotency read calls, or the per-ref baseline read they compose? | The rule is required on the composition path of both idempotency reads — the pre-read and the post-verified read; both compose the delivered per-ref baseline read, and the rule lands on that shared path so no partial fix is possible. The read's own result shape is unchanged (DEC-3). | Resolved (owner comment + delivered composition; pm-notes 2026-11-22) |
| OQ-2 | The delivered capture-family read carries the same tear-on-foreign-key shape — is it a third site? | No. It has no delivered consumer composing it, no observed failure, and is not named by the ticket or the binding owner comment; the ticket scopes two sites. It is recorded as deferred (§7.3) with this specification's F-4 table as the stated rule should a consumer ever compose it. | Resolved (ticket scope + owner comment; code-grounded) |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Both sites apply the delivered GH-381 rule exactly and unchanged: a well-formed family key naming another ref is skipped with no kind or payload inspection and no evidence; the bare family prefix tears `state.store.torn` at its own position; the requested ref's key with the wrong kind tears; requested-ref payload validation is unchanged. | The binding owner comment demands the delivered rule, not a second convention; re-deriving a variant would fork the damage taxonomy across sibling reads. | 2026-11-22 |
| DEC-2 | The reads' damage jurisdiction is unchanged from GH-381: (a) malformed family keys and (b) the requested ref's own records; foreign keys — including their kinds and payloads — are outside jurisdiction and remain with the global verified read, which checks every record regardless of key. | A per-ref read answers one ref; making it a global validator would blur the tear taxonomy and contradict the delivered precedent. | 2026-11-22 |
| DEC-3 | The baseline correction is required on the composition path of both idempotency reads (pre-read and post-verified read), and the baseline proof fixtures must exercise the delivered append helper — GH-381's raw-append two-refs workaround becomes the behavior under test, not the proof technique, for healthy baselines. | A fix on one read only is a partial fix that leaves the append failing or unverifiable on multi-ref ledgers; a fixture proof that routes around the helper certifies nothing about the defect. Raw appends survive only for damage shapes production writers never emit. | 2026-11-22 |
| DEC-4 | No decision record is authored for this change; the decision baseline stands at the ledger maximum stated by the owner (TDR-0075) and is re-verified on the integration branch before any delivery-phase authoring; ids are never renumbered. | This change continues the delivered GH-381 rule at two remaining sites; the read contract is unchanged. Escalation to a decision is triggered only if delivery discovers the contract itself must change. | 2026-11-22 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Per-ref steps read (state layer) | Updated — skips well-formed foreign step keys per the F-4 table; bare prefixes and requested-ref damage keep tearing with delivered identities and locations; result shape unchanged |
| Per-ref baseline records read (state layer) | Updated — the composition seam of the baseline append's idempotency pre-read and post-verified read applies the same rule; result shape unchanged |
| Baseline append (state layer, capture path) | Succeeds — for a second ref on a ledger holding another ref's baselines; write semantics, fence scoping, run-and-session dedupe, and no-op outcome unchanged; no writer-side rule change |
| Window-scoped zero-spend evidence reading (spend surface) | Succeeds — no shape or semantics change; multi-ref ledgers render the evidence reading, with matched/excluded sets covering exactly the requested ref's steps |
| Versioned steps composition | Inherits — composes the corrected steps read; otherwise unchanged |
| Per-ref families projection | Unchanged — already correct; the rule source this change applies, not edited |
| Telemetry capture writers (step append, capture-outcome append) | Unchanged — ref-scoped appends as delivered |
| Metrics report and status digest | Unchanged — they compose the already-correct families projection |
| Standalone capture-family read | Unchanged in this change — latent same-class shape, no delivered consumer; deferred (§7.3) |
| State ledger and global verifier | Unchanged — append-only contract, record kinds, sequences, checksums, and the verified read are untouched; no repair or migration path exists on any branch |
| Feature specification "Harness Telemetry v2" (§5/§5.1 reading bases, §7 suite rows) | Reconcile in phase 7 — state that the per-ref rule covers the steps read and the baseline idempotency pre/post reads; add the new regression suite rows |
| Feature specification "Spend Read Side" (window-evidence sections) | Reconcile in phase 7 — the multi-ref render proof and suite rows |
| Feature specification "Metrics Report and Burn-Rate Alarms" | Verify in phase 7 — only if its consumer wording names the reads |
| Proof harness and committed fixtures | New — interleaved two-ref step fixtures (foreign first), two-ref baseline fixtures exercising the real helper, bare-prefix and kind-mismatch fixtures, the named pre-fix regression pin, single-ref golden, single-pass proof, determinism matrix |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a committed fixture ledger interleaving two refs' step-family records with a foreign step record appearing before the requested ref's first record, **when** the window-scoped zero-spend evidence reading runs for the requested ref over a declared window, **then** it succeeds — no `state.store.torn` and no other classification — and its matched and excluded sets are computed over exactly the requested ref's steps, with 0 foreign steps named in either set and 0 requested-ref steps dropped; **and when** the same reading runs for the other ref over the same ledger, **then** it likewise succeeds with exactly that ref's steps | F-1, NFR-5 |
| AC-F2-1 | **Given** a fixture ledger holding ref A's baseline records — seeded through the delivered append path — **when** ref B's baseline capture runs through the delivered append helper, **then** it succeeds and appends exactly ref B's record; **and when** the same capture repeats for ref B with the same run-and-session identity, **then** the outcome is the delivered no-op with no duplicate record appended; **and** ref A's baseline record — and every pre-existing ledger record — is byte-identical afterwards, with the ledger grown by exactly ref B's appended record | F-2, F-3, NFR-7 |
| AC-F4-1 | **Given** a fixture ledger containing a record whose key is the bare step prefix, **when** the steps read runs for any ref, **then** it returns `state.store.torn` located at that record's position — the disclosed store path and that record's 1-based ledger sequence; **and when** the fixture symmetrically carries a bare baseline-prefix record, **then** the baseline idempotency composition path tears at that record's position with the same identity and location; **and when** the fixture instead marks the malformed records skipped or drops their locations, **then** the proof fails | F-4, F-5, NFR-3 |
| AC-F4-2 | **Given** a fixture ledger in which the requested ref's step key carries a record kind other than the step kind, **when** the steps read runs for that ref, **then** it returns `state.store.torn` at that record's position, exactly as delivered; **and when** the requested ref's baseline key symmetrically carries a non-baseline kind on the idempotency path, **then** the same tear behavior holds; **and when** a requested-ref record's payload fails validation, **then** the delivered payload classification and location are unchanged | F-5, NFR-3 |
| AC-F8-1 | **Given** the regression case named for the GH-381 review advisory, run against the pre-fix code over committed fixtures, **then** it reproduces both original failures — the steps read tearing on a valid foreign step key, and ref B's baseline append through the delivered helper failing on a ledger holding ref A's baselines — with the pre-fix failure shapes captured and asserted (golden-before-fix); **and when** the same case runs against the corrected code, **then** both succeed per AC-F1-1 and AC-F2-1 | F-8, F-1, F-2 |
| AC-F6-1 | **Given** any fixture in the proof matrix, **when** the steps read or either baseline idempotency read runs, **then** it performs exactly one verified pass over the ledger — 0 additional store reads, 0 per-record re-reads, 0 harness or session queries — with work linear in total ledger records; **and** the baseline append keeps its delivered fence-scoped pre/post read shape with 0 additional store reads; **and when** foreign records are interleaved throughout, **then** each foreign record is visited exactly once and the read bound is unchanged | F-6, NFR-1 |
| AC-F7-1 | **Given** a fixture ledger whose telemetry holds only the requested ref's records, **when** the steps read runs, a baseline capture and its repeat run, and every delivered tear case is exercised, **then** records, ordering, verified-empty flag, evidence, append outcomes, and every tear identity and location are identical to delivered behavior — golden equality with 0 differences | F-7, NFR-6 |
| AC-NFR2-1 | **Given** each fixture in the proof matrix run three times and compared, **when** results are compared across runs, **then** records, ordering, verified-empty, append outcomes, evidence, and every tear identity and location are identical, with 0 network calls, 0 ambient-store reads, and 0 real-clock dependencies; **and when** the delivered vocabulary sets are compared with the delivered ones, **then** error identities, record kinds, payload schemas, key prefixes, envelope keys, and exit codes are exactly equal, with 0 additions | NFR-2, NFR-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Single change, no flag.** The defects and their correction are one behavior; a toggle would leave the multi-ref tears reachable, which is the defect.
- **Proof before merge.** The interleaved fixtures, the real-helper baseline append and idempotency cases with byte-identity assertions, the bare-prefix and kind-mismatch tear cases with location assertions, the named pre-fix regression pin, the single-pass bound, and the single-ref golden equality must be green in the aggregate gate before review.
- **No operator action and no data repair.** No configuration edit, migration, or ledger fix-up is required or permitted; ledgers that fail today need no treatment beyond this change, and no live ledger is touched.
- **Branch, target, and stop state.** The change is delivered on its own branch per the repository's branch convention for this ref, with the PR targeting the tooling integration branch and left open for merge authority; commits flow through the repository's commit primitive; the declared scratch-directory convention applies to gate evidence.
- **Version metadata — declared now, not deferred.** One lockstep changeset declaring all five fixed-group packages — `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode` — at **minor** (the verified ground truth of the repository's changeset configuration and landed precedent, §24). This declaration is made at specification time so the plan and delivery phases use the format directly; the GH-381 retro showed a deferred or mis-formatted changeset costs a quality-gate cycle.
- **Documentation lands next.** The phase-7 reconciliation named in §22 is the follow-on obligation; until it lands, this specification is the current statement of the two sites' rule and review reads against it.
- **No announcement or operator communication** is required; the observable change is that the window-evidence surface renders and second-ref baselines capture on the ledgers and projects operators already have.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. There is no schema change, no record-shape change, no key change, and no write path change. Existing ledgers — single-ref and multi-ref — are read without transformation, repair, back-fill, or dual-read; the only writes on any path are the delivered appends. Reverting the behavior requires no state repair: the ledger never changed.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A for personal data: no personal data is collected, derived, or exposed. Telemetry records already carry aggregate counts, identity references, and time windows only, under the delivered redaction chokepoint, and this change reads them without adding a field or surface. The correction strictly narrows what a read returns — exactly one ref's records — so a multi-ref result exposes less, not more, of the shared ledger than the raw store discloses. No vendor terms are newly exercised: no request of any kind is added.

## 21. SECURITY REVIEW HIGHLIGHTS

- **No new read or write surface.** Both sites perform the same single verified pass as delivered, and the append path's write shape is unchanged: zero network calls, zero credential reads, zero harness-store queries, zero environment reads added.
- **Damage stays fail-closed.** The skip applies only to keys provably owned by another ref; bare prefixes and requested-ref damage keep tearing with delivered identities and locations, so a tampered or damaged ledger cannot be laundered into a silently clean report or a spurious append success for the ref being read (F-4, F-5, RSK-1).
- **Idempotency is a correctness boundary, not just a convenience.** A weakened dedupe would allow duplicate baseline records to inflate or distort downstream figures; F-3 and NFR-7 pin the no-op outcome and byte-identity of pre-existing records so the fix cannot trade a tear for a duplication defect (RSK-3).
- **Integrity is not weakened by skipping.** The global verified read still parses every record, checks sequence contiguity, and recomputes every checksum regardless of key; skipping a foreign key in a per-ref read removes no global check (DEC-2).
- **Read-only plus the delivered append, privilege-free.** No path of this change grants any capability; the reads cannot alter, reorder, or suppress another ref's records — only decline reading them — and the append writes exactly what it delivered before.
- **Foreign records are declined, not surfaced.** A multi-ref result contains only the requested ref's records; no foreign payload, key, or evidence crosses into any consumer's output, and skipped steps are not named in window-reading exclusion sets.
- **Residual risk is low**: the change strictly narrows what stops a read or capture, and every narrowing is pinned by a tear-preserving fixture.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Phase-7 reconciliation is mandatory, not cosmetic.** The reading bases must state that the per-ref rule covers the two remaining sites, so the specification is not read as covering only the families projection: the steps read and the baseline idempotency pre/post reads skip well-formed foreign family keys, and `state.store.torn` is reserved for malformed family keys and requested-ref damage. Documentation targets: the telemetry v2 feature specification (§5/§5.1 reading bases; §7 suite rows for the new regression cases), the spend read side feature specification (window-evidence sections and suite rows for the multi-ref render proof), and the metrics feature specification only if its consumer wording names the reads; the change-folder artifacts are updated as part of the normal change record. Known risk if skipped: future changes re-read the old contract and reintroduce the class at a sibling read (RSK-9).
- **The house rule is now stated in several delivered reads.** With the economics read, the families projection, and the steps and baseline reads, the per-ref skip rule is established doctrine over the shared ledger; the deferred shared helper (§7.3) exists for the next per-ref read, and review of any new per-ref read checks the rule is applied rather than reinvented.
- **Support semantics sharpen.** A remaining `state.store.torn` from these reads now means genuinely malformed family keys or requested-ref damage — never another ref's valid record — so support conversations can cite the located record as real damage and treat the verifier's verdict as corroboration.
- **No new operational surface.** No configuration key, command, flag, or state document is added, so runbooks, doctor checks, and the operator's mental model change only in one respect: the window-evidence surface and baseline capture work on the ledgers and projects operators actually accumulate.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Telemetry family | One of the record families the state layer stores under store-scoped key prefixes: step records, baseline records, harness session records, and capture-outcome records |
| Family key / ref remainder | A ledger record's key within a family: the family prefix followed by the owning change's ref remainder; an empty remainder is the bare prefix |
| Bare prefix | A family key with an empty ref remainder (e.g. `harness.telemetry.step:` naming no ref); malformed by the F-4 table and a tear subject |
| Foreign record | A well-formed record whose owning ref differs from the ref the read is answering; skipped, never damage |
| Per-ref read | A read that answers exactly one work-item ref from the shared ledger, returning only that ref's records |
| Verified pass | The delivered single read over the ledger that parses every record, checks sequence contiguity, and recomputes checksums, yielding verified truth for every projection |
| `state.store.torn` | The delivered damage identity for a ledger record that is itself invalid or inconsistent with the ref being read; located by store path and record sequence |
| Verified-empty | The result flag that is true exactly when the requested ref holds no records of the family |
| Window-scoped zero-spend evidence | The spend surface's falsifiable peak-pause proof reading: the billable-call count over a declared window with matched and excluded step sets and classified telemetry absence; composed over the steps read |
| Matched / excluded sets | The window reading's position disclosures: steps the interval matched, and steps excluded with a reason from the closed four-value set; foreign steps appear in neither set |
| Baseline append | The delivered fenced, framed, checksummed append of a session's baseline record; idempotent by run-and-session identity within the fence |
| Idempotency pre-read / post-verified read | The fence-scoped read before the append (duplicate check) and after the append (landing verification), both composing the per-ref baseline read |
| Run-and-session identity | The pair of identifiers whose presence in the requested ref's baselines makes a repeat capture a no-op |
| Pre-fix pin / golden-before-fix | The proof technique that captures the pre-fix failure shapes from committed fixtures and asserts them, so the regression case demonstrates the defect itself |
| Rule source | The delivered per-ref families projection (GH-381) whose skip/tear classification both sites apply unchanged |

## 24. APPENDICES

### Appendix A — Observed evidence (corroboration, not a test dependency)

- The live tooling project ledger (several thousand records, refs spanning multiple merged changes) reproduces both failures today: the window-evidence surface refuses with `state.store.torn`, and a second ref's baseline capture cannot run through the delivered helper.
- GH-381's own delivered fixtures raw-append two refs' baselines inside one fence — direct evidence that the delivered baseline append cannot perform a second ref's capture on a shared ledger, and the origin of the requirement that GH-384's fixtures exercise the real helper instead.
- GH-381's local review identified both defect sites and posted them to the GH-381 ticket, from which GH-384 was filed; the regression case is named for that advisory.

### Appendix B — Ticket acceptance-criteria traceability

| Ticket AC | Specification criterion |
|-----------|-------------------------|
| Ticket AC-1 (two refs, interleaved step families, foreign first → window evidence succeeds, foreign steps excluded) | AC-F1-1 |
| Ticket AC-2 (two refs' baselines; ref B append succeeds; repeat idempotent; ref A byte-identical) | AC-F2-1 |
| Ticket AC-3 (bare prefixes still tear at correct positions, both families) | AC-F4-1 |
| Ticket AC-4 (requested-ref kind mismatch still tears) | AC-F4-2 |
| Ticket AC-5 (regression case named for the GH-381 review advisory reproduces pre-fix failures) | AC-F8-1 |
| Required behavior (rule applied exactly; one verified pass; no mutation; idempotency un-weakened) | AC-F6-1, AC-F7-1, AC-NFR2-1 |

### Appendix C — Normative classification table (the rule restated for the two sites)

For each ledger record in ledger order, in the steps read — mirrored identically on the baseline idempotency composition path:

| Condition on the record's key | Classification | Behavior |
|-------------------------------|----------------|----------|
| Key equals `<family prefix><requested ref>` | Requested ref's record | Kind must match the family kind (else `state.store.torn` at position); payload validated as delivered; contributes to the result |
| Key equals the bare `<family prefix>` (empty remainder) | Malformed | `state.store.torn` at that record's position |
| Key under the prefix, non-empty remainder, any other ref | Foreign | Skip; no kind or payload inspection; no evidence |

The baseline append's pre-read and post-verified read both run this classification over the baseline family; the post-read's landing check compares only the requested ref's records, exactly as delivered.

### Appendix D — Verified ground truth and traceability notes for downstream artifacts

- **Changeset format** (verified at authoring from the repository's changeset configuration and the landed GH-381 changeset at merge `0320321f`): one changeset declaring all five fixed-group packages — `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode` — at **minor**. The landed GH-381 file's name suffix is cosmetic (a `-patch` filename carrying five minor entries); the entries, not the filename, are the contract. The plan and delivery phases use this format directly.
- **Test-case id series state** (verified in the delivered tree at authoring, for the test-plan author; the GH-381 DoR iteration 1 failed on exactly this class of collision): the delivered maxima are TC-TELEMETRY-047, TC-REF-007, TC-METRICS-113, and TC-SPEND-034. The next free ids at authoring time are TC-TELEMETRY-048+, TC-REF-008+, TC-METRICS-114+, TC-SPEND-035+. Verify the chosen ids are unused in the delivered tree immediately before authoring the test plan — other changes may have landed in between; never reuse an id, including a freed one.
- **Fixture discipline** (binding, from the owner comment and DEC-3): healthy two-ref records are seeded through the delivered append paths; the baseline fixtures exercise the delivered append helper as the behavior under test; raw append inside a fence is reserved for shapes production writers never emit (bare prefixes, wrong kinds, invalid payloads), with valid framing and checksums so the verified read admits them and the reads' classification is what is tested.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-22 | @spec-writer (GLM-5.3-Flash) | Initial specification from ticket GH-384, the binding owner implementation-pointer comment, the committed pm-notes (intake constraints, changeset-format decision, GH-381 retros), and the delivered GH-381 specification as rule source and structural model |

---

## AUTHORING GUIDELINES

- **Sources.** Ticket GH-384 body (two defect sites, required behavior, AC fixtures, delivery conventions) and the binding owner implementation-pointer comment (the seam, the rule to reuse, the constraints); the committed pm-notes `chg-GH-384-pm-notes.yaml` (intake constraints, clarify_scope cross-check, documentation impacts, changeset-format decision, GH-381 retros, decision-id ledger); the delivered GH-381 specification (`chg-GH-381-spec.md`) as rule source, evidence base, and structural model; the delivered state-layer telemetry reads and baseline append (functional behavior only); the telemetry v2 and spend read side feature specifications (declared reading bases).
- **Approach.** The specification states the two sites' corrected behavior as current truth, restates the delivered classification table normatively (F-4, Appendix C), and keeps every delivered identity, tear case, idempotency semantic, and read bound as an asserted invariant rather than a redesigned surface. The ticket's five AC fixtures map onto spec criteria with three additions (single-pass bound, single-ref golden equality, determinism/vocabulary invariance); the mapping is tabulated in Appendix B for the test plan's traceability. The two deviations from GH-381's spec that its retros forced: the five-package minor changeset is declared here rather than deferred (A-6, §18), and the TC-id series state is recorded here so the test plan starts from verified ground truth (RSK-5, Appendix D).
- **Constraints honored.** No ledger mutation on any path; the single verified pass and the delivered pre/post append read shape preserved; idempotency never weakened; fixtures required to exercise the real append helper; no decision record planned (NG-7, DEC-4, with the escalation trigger recorded); no file-level code paths in the specification body — the seam is named functionally, and contract constants (record kinds, key prefixes) are vocabulary, not paths.
- **Deliberate silences.** Consumer report shapes, the families projection, the capture writers, other projections, and the global verifier are declared unchanged and out of scope rather than restated; their authorities are the linked feature specifications, which phase 7 reconciles (§22). The standalone capture-family read's latent shape is recorded as a resolved boundary (OQ-2, §7.3), not invented into scope.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef`
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` equals the tracker milestone title verbatim and the pm-notes milestone
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-, NG-, G-)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
