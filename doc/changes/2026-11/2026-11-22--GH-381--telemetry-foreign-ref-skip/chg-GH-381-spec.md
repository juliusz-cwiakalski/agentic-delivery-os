---
change:
  ref: GH-381
  type: fix
  status: Proposed
  slug: telemetry-foreign-ref-skip
  title: "M4-S20: Spend reads must be multi-ref safe — one change's telemetry must never tear another's (M4)"
  owners: ["Juliusz Ćwiąkalski"]
  service: "state-layer telemetry families projection and the spend read side (core read path)"
  milestone: "M4: Jaiship-native delivery"
  labels:
    - change
    - planning
    - defect
    - state
    - telemetry
    - spend
    - m4
  version_impact: patch
  audience: internal
  security_impact: none
  risk_level: low
  dependencies:
    internal:
      - "delivered telemetry v2 storage families: the harness.telemetry.step, harness.telemetry.baseline, harness.telemetry session, and harness.telemetry.capture-outcome record kinds under their store-scoped key prefixes (GH-291, GH-294, GH-299, GH-335)"
      - "delivered state store: the single verified ledger read (parse, contiguous sequence, checksum recomputation) that every projection composes"
      - "delivered spend read side: the spend fold, the status digest section 8 projection, and the telemetry-state disclosure (GH-236, GH-299)"
      - "delivered metrics report: the per-dispatch block and the burn-rate evaluation over the same families (GH-299)"
      - "delivered provider resolution budget measurement: the ticket-scope ceiling read over the spend projection"
      - "delivered per-ref economics read: the in-repo precedent that a projection over the shared ledger skips foreign keys (GH-235)"
    external:
      - "none; the read path performs zero network, zero harness-store, and zero vendor calls, unchanged"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the per-ref telemetry families projection skip the well-formed telemetry records of other change refs instead of classifying them as damage, so spend, metrics, and provider resolution read any multi-change ledger while malformed family keys and requested-ref damage keep tearing exactly as delivered (F-1..F-6, NFR-3, NFR-5).

## 1. SUMMARY

The per-ref telemetry families read — the one projection that spend, the metrics report, and provider resolution's budget measurement all compose — scans the shared append-only ledger and classifies any telemetry-family record whose key is not the requested ref's exact key as `state.store.torn`. Because a project's ledger holds telemetry from every change that has run in it, the second ticket in any project makes `spend`, `metrics`, and `provider resolve` fail permanently: the observed incident stopped on a perfectly valid step record of another change, with a ledger the verifier returns `verified` on. The failure is structural, not incidental — it arrives exactly when the product starts being used.

This change corrects the two family branches that own the defect. A well-formed family key belonging to another ref is skipped — it contributes nothing, produces no evidence, and is never damage — mirroring the delivered per-ref economics read in the same state layer, which has skipped foreign keys since delivery. A malformed family key (a family prefix with no ref) still tears at its own position, and damage to the requested ref's own records — a kind mismatch, an invalid payload — still tears exactly as delivered. The read stays one verified pass over the ledger; no new store read, no harness re-query, and no ledger mutation of any kind exists on any path. Consumer report shapes are unchanged: the only observable difference is that multi-ref ledgers read successfully, and each report contains exactly the requested ref's records.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The state ledger is one shared append-only log.** Every change's records — telemetry, economics, phase history, audit — land in one project ledger with contiguous sequences and per-record checksums. Multi-ref telemetry is the normal steady state, not an edge case: any project that has delivered two changes holds two refs' telemetry families.
- **One projection serves every spend-side consumer.** The telemetry families read composes, for one work-item ref, its step records, baseline records, harness session records, and capture-outcome records in a single verified pass, and discloses the store path and total ledger record count as evidence. The spend fold (and through it the status digest's section 8), the metrics report's dispatch block and burn-rate evaluation, and provider resolution's budget measurement all read through this one projection.
- **Two of the four family branches own the defect.** The step-family and baseline-family branches match records by family prefix and then demand the exact requested-ref key and family kind; any prefix hit that fails either demand returns `state.store.torn` at that record's position. Because the prefix match is ref-agnostic, a valid record of another ref lands in the branch and tears the read. The capture-outcome branch is ref-scoped by a ref-bearing prefix and the session-record branch matches an exact ref-bearing key, so neither can hit a foreign record; both behave as delivered.
- **The correct rule is already delivered one projection over.** The per-ref economics read begins its scan by skipping every record whose key is not the requested delivery's key. A projection over a shared ledger skipping foreign keys is therefore the delivered house rule; the telemetry families read is the one projection that contradicts it.
- **The observed incident (2026-11-22T07:31Z, build `5ace5e9`, tooling integration branch at `5ace5e98`).** With one change's telemetry already in the ledger and a second change merged the same morning, `spend` failed with `state.store.torn` naming record 3786, and `provider resolve` failed the same way with a summary stating the spend ledger could not be read and the budget could not be measured. Record 3786 is valid: it is the first change's step record, of which that change wrote 563. All 4,876 ledger records parse, sequences are contiguous 1..4876, and every checksum recomputes; the delivered verifier run in-process returns `verified`. The ledger is not damaged; the projection is.
- **The append-only ledger has no repair path.** The delivered storage contract never mutates, drops, or rewrites stored records, and no salvage tooling exists — so the only correct remedy is at the read, where the defect lives.

### 2.2 Pain Points / Gaps

- **The second ticket bricks the spend surface.** Any project with telemetry from two changes cannot read spend or metrics at all: every read tears on the first foreign family record it meets, which with a long-running first change is early in the ledger.
- **Every dispatch is blocked, not just reporting.** Provider resolution measures the ticket-scope budget through the spend projection, so the same tear makes provider selection unavailable — the failure is admission-blocking, which is why this is a delivery-stopping defect rather than a cosmetic one.
- **The tear names a healthy record.** `state.store.torn` is the identity for ledger damage, and the report points at a record the verifier proves valid — misdirecting diagnosis toward ledger repair, the one remedy the append-only contract forbids.
- **The failure scales with success.** A single-ticket project works; the defect appears the moment the tooling is used as designed across consecutive tickets, silently converting normal usage history into a permanent failure.
- **The house rule is visibly contradicted.** The same read chain contains a projection that skips foreign keys, so the inconsistency is between two delivered siblings, not an unsolved design question.

## 3. PROBLEM STATEMENT

Because the per-ref telemetry families projection classifies any telemetry-family key that is not the requested ref's exact key as `state.store.torn`, an operator cannot run `spend`, `metrics`, or `provider resolve` in any project whose ledger holds telemetry from two or more changes — the normal multi-ticket case — resulting in a damage report that names a valid foreign record, a blocked budget measurement that stops every dispatch, and an otherwise healthy append-only ledger that the failure invites damaging "repair" of.

## 4. GOALS

- **G-1**: The per-ref projection answers exactly one ref: a well-formed family key belonging to another ref is skipped and is never classified as damage, matching the delivered per-ref economics read.
- **G-2**: Damage detection is preserved, not relaxed: a malformed family key (a family prefix with no ref) still tears `state.store.torn` at its own record's position, a kind mismatch under the requested ref's key still tears, and payload validation of the requested ref's records is unchanged.
- **G-3**: `spend`, `metrics`, and `provider resolve` succeed on a ledger holding two or more refs' telemetry, and every report contains exactly the requested ref's records — no foreign record in, no requested-ref record dropped.
- **G-4**: The read stays one verified pass over the ledger: no second pass, no new per-record store reads, no harness re-query, and read work linear in ledger records as delivered.
- **G-5**: Requested-ref behavior is unchanged: on a ledger holding only the requested ref's telemetry, the read's result — records, verified-empty flag, evidence, and every tear behavior — is identical to delivered behavior.
- **G-6**: The ledger is untouched: append-only semantics, record contents, sequences, and checksums are preserved; no delete, rewrite, truncate, compact, or salvage path exists on any branch of this change.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Multi-ref ledgers (≥2 refs' telemetry) on which `spend`, `metrics`, or `provider resolve` tears | 0, over the full proof matrix (F-1, F-4) |
| The observed 2026-11-22 shape reproduced by the named regression fixture | 1 of 1: foreign family record first, read succeeds (F-2) |
| Valid foreign family records classified `state.store.torn` anywhere in the proof matrix | 0 (F-1, NFR-5) |
| Malformed family keys (bare prefix) wrongly skipped instead of tearing | 0, step and baseline families both (F-2, NFR-3) |
| Requested-ref kind mismatches or invalid payloads wrongly skipped | 0 (F-3, NFR-3) |
| Foreign or requested-ref records exchanged in a multi-ref read result | 0 of each (NFR-5) |
| Additional store reads and harness queries per families read | 0 each (F-5, NFR-1) |
| Behavior differences versus delivered behavior on single-ref ledgers | 0, golden comparison (F-6, NFR-6) |
| Ledger records mutated, dropped, or reordered by any path of this change | 0 (G-6) |

### 4.2 Non-Goals

- **NG-1**: No ledger mutation of any kind — no delete, rewrite, truncate, compaction, salvage, or repair of the flagged record or any record; no migration, back-fill, or seeding step.
- **NG-2**: No new vocabulary: no new error identity, state record kind, payload schema, store-scoped key prefix, envelope key, event code, or exit code. Every identity produced on any path is delivered today.
- **NG-3**: No change to the capture side: the capture-outcome branch of the projection and the whole telemetry capture path stay exactly as delivered — they are already ref-scoped.
- **NG-4**: No change to consumer report shapes: the spend envelope, the metrics report, the status digest section 8, and the provider resolution envelope keep their delivered keys, figures, tolerances, and disclosure rules; their only difference is failing → succeeding on multi-ref ledgers.
- **NG-5**: No new reads and no optimization beyond the delivered single pass: no per-ref index, no cache, no second projection.
- **NG-6**: No change to any other ledger projection (economics, phase history, command audit, change registry) or to the global ledger verifier; the economics read is referenced as precedent, not edited.
- **NG-7**: No decision record is authored: this is a defect correction that makes the implementation match the delivered per-ref read contract, not a change to that contract (see DEC-4 and §14).
- **NG-8**: No documentation edits in this change; the phase-7 reconciliation obligation is named in §22.
- **NG-9**: The separate spend-reconciliation work item (#378) keeps its own scope; this change is its prerequisite, not its substitute.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Per-ref projection: foreign well-formed family keys are skipped, never damage | A projection over a shared append-only ledger answers one ref; another ref's valid record is not its subject and must not read as damage |
| F-2 | The well-formed/malformed distinction, with malformed keys still tearing | The fix must separate "someone else's record" from "a record that is itself invalid", or damage detection would be silently weakened |
| F-3 | Requested-ref damage still tears: kind mismatch and payload validation unchanged | The defect correction must not relax the tear contract for the ref actually being read |
| F-4 | Multi-ref success for spend, metrics, and provider resolution, each scoped to the requested ref | The consumers are the reason the defect is blocking; their reports must contain exactly the requested ref's records |
| F-5 | One verified pass preserved | The delivered bound — constant read work per families read, linear in ledger records, zero harness queries — is a declared contract the fix must keep |
| F-6 | Single-ref behavior identical | Every existing single-ref ledger, report, and tear case must behave byte-identically after the fix |

### 5.1 Capability Details

**F-1 — Per-ref projection.** The telemetry families read answers one work-item ref and no other: its returned collections contain the requested ref's step records, baseline records, harness session records, and capture-outcome records, and nothing else. The step-family and baseline-family branches stop treating the family prefix as an ownership claim. A ledger record whose key falls under the step or baseline family prefix, carries a non-empty ref remainder, and is not the requested ref's key belongs to another change: it is skipped in ledger order — it contributes no record, no evidence, no count, and no classification — and the scan continues. This is the delivered economics rule applied to the remaining projection: skip foreign keys, never classify them as damage. The skip is silent by design; the read's evidence continues to disclose the store path and the total ledger record count, so a reader can always see that the ledger holds more than the projection returned.

**F-2 — Well-formed versus malformed family keys.** The distinction is exact and declared. Within a family, a ledger key has the shape `<family prefix><ref remainder>`:

| Key under a family prefix | Classification | Behavior |
|---------------------------|----------------|----------|
| Ref remainder is empty (the bare prefix, e.g. `harness.telemetry.step:` with nothing after it) | Malformed — the record itself is invalid | `state.store.torn` at that record's position (store path + record sequence), as delivered for damage |
| Ref remainder is non-empty and the key is the requested ref's key | The requested ref's record | Governed by F-3: kind must match the family kind and the payload must validate, exactly as delivered |
| Ref remainder is non-empty and the key is any other ref's key | Foreign — someone else's record | Skipped (`continue`); no kind inspection, no payload inspection, no evidence |

The rule applies symmetrically to the step family and the baseline family. A foreign key's kind and payload are deliberately not inspected: they are that record's own ref's business, and a per-ref projection is not a global validator (DEC-2). The global integrity layer — the verified read that parses every record, checks sequence contiguity, and recomputes every checksum regardless of key — is unchanged and remains the place where physically damaged records are caught for every ref.

**F-3 — Requested-ref damage preserved.** For the requested ref's own keys, nothing relaxes. A step-family key of the requested ref whose record kind is not the step kind tears `state.store.torn` at that record's position; symmetrically for the baseline family. Payload validation of the requested ref's records runs exactly as delivered, with its delivered classifications and locations. Every preserved tear names the delivered safe location — the store path and the offending record's sequence — so the "correct position" fidelity of the delivered tear contract is a hard requirement, not an incidental (NFR-3).

**F-4 — Multi-ref consumer success.** With two or more refs' telemetry in the ledger, each consumer proceeds as on a single-ref ledger: the spend fold returns its report scoped to the requested ref (and the status digest section 8, fed by the same fold, matches it); the metrics report's dispatch block and burn-rate evaluation read the same scoped families; provider resolution's budget measurement reads the spend projection successfully and the resolution proceeds to a provider decision — whatever the delivered provider facts dictate — instead of failing on the telemetry read. Every returned record collection contains exactly the requested ref's records: zero foreign records in, zero requested-ref records dropped (NFR-5).

**F-5 — One verified pass.** The read composes exactly one verified pass over the ledger, in ledger order, as delivered. The skip adds no read: no second scan, no per-record store re-read, no harness or session query, no index. Read work stays linear in total ledger records and constant per record; the presence of foreign records changes scanning cost by nothing beyond the delivered single visit each.

**F-6 — Single-ref behavior identical.** For a ledger whose telemetry families hold only the requested ref — today's single-ticket projects — every observable is identical to delivered behavior: the same records returned in the same order, the same verified-empty result when the ref has no telemetry, the same evidence, and the same tear behavior for every delivered tear case. The correction changes exactly one thing: keys that are provably someone else's no longer stop the read.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — The observed defect, corrected
  Ledger: change A telemetry (563 steps + baseline) interleaved with change B telemetry
    Agent/operator: spend --ref B
      → one verified pass over the shared ledger
      → A's family keys: well-formed, foreign → skipped, never damage
      → B's step/baseline/session/capture-outcome records projected
      → report contains exactly B's records, ok
```

```
Flow 2 — Foreign-first interleaving (the observed record-3786 shape)
  The ledger's first telemetry-family record is a foreign step record of
  another ref, appearing before the requested ref's first record
    → the scan meets it, classifies it foreign by the F-2 table, skips it
    → continues in ledger order to the requested ref's records
    → read succeeds; the regression case named for this defect pins this shape
```

```
Flow 3 — Malformed family key still tears
  A record whose key is the bare step prefix (or bare baseline prefix)
    → the F-2 table classifies it malformed — a record that is itself invalid
    → state.store.torn at that record's position (store path + sequence)
    → the read stops; damage reporting is unchanged in identity and fidelity
```

```
Flow 4 — Requested-ref damage still tears
  A record under the requested ref's step key carrying a non-step kind
  (symmetrically: requested baseline key, non-baseline kind)
    → the F-2 table classifies it requested-ref damage
    → state.store.torn at that record's position, as delivered
  A record under the requested ref's key whose payload fails validation
    → the delivered payload classification and location, unchanged
```

```
Flow 5 — Provider resolution on a multi-ref ledger
  provider resolve, ledger holding ≥2 refs' telemetry
    → budget measurement reads the spend projection for the requested ref
    → the projection succeeds (F-1, F-4); the budget is measured
    → resolution proceeds to a provider decision per the delivered provider
      facts — never the telemetry tear
```

```
Flow 6 — Both refs readable from one ledger
  Reading A returns A's records only, ok; reading B returns B's records
  only, ok; neither tears, neither sees the other's records, and the
  disclosed evidence (store path, total ledger record count) is the same
  shared ledger for both
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The step-family and baseline-family classification branches of the per-ref telemetry families read: the foreign-key skip, the malformed-key tear, and the unchanged requested-ref tear behavior (the F-2 table as the normative rule).
- Tear-location fidelity for every preserved tear case: store path plus offending record sequence.
- The interleaved two-ref proof fixtures — step, baseline, and capture-family records for each ref, in both read directions — and the regression case named for this defect, whose ledger places the foreign family record first (the exact observed shape).
- Consumer success proofs on multi-ref ledgers: `spend` scoped reports, the metrics report reads, and `provider resolve` proceeding to a provider decision.
- The single-pass read bound and the single-ref golden equality, both proven.
- The declared phase-7 reconciliation obligation for the specification reading bases (§22).

### 7.2 Out of Scope

- [OUT] Any ledger mutation: deleting, rewriting, truncating, compacting, or salvaging the flagged record or any record; any repair, migration, back-fill, or seeding step.
- [OUT] New vocabulary of any kind: error identity, state record kind, payload schema, key prefix, envelope key, event code, exit code.
- [OUT] Changes to the capture-outcome branch of the projection, the session-record branch, or any part of the telemetry capture path — all already ref-scoped and delivered correct.
- [OUT] Changes to consumer report shapes or semantics: spend envelope keys, metrics report blocks, digest section 8, provider resolution envelopes, tolerances, disclosure rules, or exit projections.
- [OUT] Changes to other ledger projections (economics, phase history, command audit, change registry) or to the global ledger verifier.
- [OUT] Per-ref indexes, caches, secondary projections, or any read beyond the delivered single verified pass.
- [OUT] A decision record: the read's declared contract is unchanged by this correction (NG-7, DEC-4).
- [OUT] Documentation edits (phase-7 scope, §22).
- [OUT] The spend-reconciliation work item #378 and its scope.
- [OUT] Global validation of foreign refs' key grammar, kinds, or payloads — outside a per-ref projection's jurisdiction (DEC-2); a family-aware cross-ref lint is deferred (§7.3).

### 7.3 Deferred / Maybe-Later

- A family-key lint at append time, so a bare-prefix record can never land: a writer-side guard and a distinct concern from this read-side correction; the tear behavior delivered here remains the reader's safety net either way.
- A family-aware cross-ref consistency lint (for example, a foreign key whose kind contradicts its family), should ledger evidence ever show one: today none exists in any observed ledger, the verified read catches physical damage, and inventing a global validator inside a per-ref projection would blur the jurisdiction DEC-2 draws.
- Generalizing the per-ref skip rule into a shared projection helper for future per-ref reads: worthwhile only when a second offender appears; today the economics read and this projection are the two per-ref scans, and one precedent citation is cheaper than a premature abstraction.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. The change is confined to the local state read path and its CLI consumers; no HTTP endpoint, route, or payload is added or modified, and no vendor endpoint is contacted.

### 8.2 Events / Messages

N/A. The read path emits no event, announcement, or message on any path, before or after this change. No event code or evidence key is added.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Family key grammar (declared) | A telemetry family key is `<family prefix><ref remainder>`. The step and baseline family prefixes are the delivered store-scoped constants (`harness.telemetry.step:`, `harness.telemetry.baseline:`). An empty ref remainder is malformed; a non-empty remainder names the record's owning ref. No new prefix or grammar is introduced. |
| DM-2 | Per-ref projection result | Unchanged shape: the four record collections, the verified-empty flag, and the evidence pair (store path, total ledger record count). Contents on a multi-ref ledger are exactly the requested ref's records; the verified-empty flag is true exactly when the requested ref holds no records of any family; the evidence continues to disclose the whole shared ledger. |
| DM-3 | Damage taxonomy unchanged | `state.store.torn` keeps exactly its delivered subjects: malformed family keys, requested-ref kind mismatches, requested-ref payload validation failures, and every other delivered tear case. `state.schema.mismatch` and `state.store.unknown` keep their delivered meanings. No identity is added, removed, or re-semanted, and the state-layer torn taxonomy is unchanged. |
| DM-4 | Ledger records | Unchanged: same record kinds, payload schemas, keys, sequences, and checksums. Nothing is written, mutated, or reordered by any path of this change; existing ledgers — multi-ref included — are read without transformation. |

### 8.4 External Integrations

N/A. The read path performs zero harness-store queries, zero network calls, and zero vendor requests, before and after this change; baseline records remain capture-time only.

### 8.5 Backward Compatibility

- **Single-ref ledgers: byte-identical behavior** (F-6, NFR-6). Same records, same ordering, same verified-empty result, same evidence, same tear behavior for every delivered tear case.
- **Multi-ref ledgers: failing → succeeding.** The only behavioral difference is that a read that returned `state.store.torn` naming a valid foreign record now succeeds and returns exactly the requested ref's records. No report that succeeded before this change changes shape or content.
- **Tear identities and locations unchanged.** Every preserved tear produces the delivered `state.store.torn` with the delivered safe location (store path + record sequence); no identity, exit projection, or location convention changes.
- **Ledgers need no migration.** Existing multi-ref ledgers — including the observed incident ledger — become readable without transformation, repair, or rewrite; the append-only contract is untouched.
- **Consumer contracts unchanged.** The spend envelope, metrics report, digest section 8, and provider resolution keep their delivered keys, figures, and disclosure rules; the telemetry-state disclosure and degradation vocabulary are unaffected.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Single-pass read cost | Exactly one verified pass over the ledger per families read; 0 additional store reads, 0 per-record re-reads, 0 harness or session queries; work linear in total ledger records and constant per record; proven at the observed ledger scale (≥ 4,800 records) |
| NFR-2 | Determinism and hermeticity | The same ledger, the same requested ref, and the same code produce identical results — records, ordering, verified-empty, evidence, tear identities and locations — across repeated runs; all proof fixtures run offline over committed state with zero network, zero ambient-store, and zero real-clock dependencies |
| NFR-3 | Tear fidelity | Every preserved tear names `state.store.torn` with the delivered safe location — the store path and the offending record's 1-based ledger sequence; 0 location drift across the malformed-key, kind-mismatch, and payload cases |
| NFR-4 | Closed-vocabulary invariance | Exact equality with the delivered sets: 0 new error identities, state record kinds, payload schemas, key prefixes, envelope keys, event codes, and exit codes on any path |
| NFR-5 | Projection exactness | A multi-ref read returns exactly the requested ref's records: 0 foreign records in any returned collection, 0 requested-ref records dropped; verified-empty true if and only if the requested ref holds no records of any family; hold for both read directions of every interleaved fixture |
| NFR-6 | Single-ref golden equality | On ledgers whose telemetry holds only the requested ref, the read result is identical to delivered behavior — golden comparison over records, ordering, verified-empty, evidence, and all tear cases; 0 differences |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **No new telemetry.** No metric, log channel, event code, announcement, or alert is added; the read path is as silent as delivered. The change is observable entirely through the delivered surfaces.
- **The correction is visible as absence of failure.** On a multi-ref ledger, `spend` and `metrics` return reports where they returned `state.store.torn`, and `provider resolve` reaches a provider decision; no counter, marker, or disclosure distinguishes a multi-ref read from a single-ref one, and none is needed.
- **Damage stays loud.** Malformed family keys and requested-ref damage keep tearing with the delivered identity and location, so a genuinely damaged ledger degrades into a named failure, never into a silently clean report (F-2, F-3, NFR-3).
- **Foreign-record skipping is not hidden, only silent per record.** The read's evidence still discloses the store path and the total ledger record count, so an operator comparing a report's record coverage against the disclosed ledger size can always see that the projection returned one ref's slice of a larger ledger.
- **Operator reproduction from recorded state alone.** The observed defect and its correction must be reproducible from committed fixtures over recorded ledger shapes — including the foreign-first shape — so a support conversation cites fixtures, not a live incident ledger.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | An over-broad skip masks genuine damage: a record that should tear is skipped, so a damaged ledger yields a clean report | H | L | The F-2 table is exhaustive over family keys: only a non-empty foreign remainder skips; the bare prefix tears at its own position, and requested-ref kind and payload damage tear as delivered; AC fixtures pin each tear case with location assertions (NFR-3) | L |
| RSK-2 | An under-broad skip reintroduces the defect on a variant shape: a foreign record the branches still tear, or a family/direction the fixtures miss | H | L | The skip rule is stated per family and proven symmetrically for step and baseline, both read directions, with the foreign family record first in the named regression fixture — the exact observed shape; the interleaved fixture covers all three families per ref | L |
| RSK-3 | Tear-location fidelity drifts while editing the branches: a preserved tear reports the wrong record position | M | L | NFR-3 makes location equality a hard, asserted property for the malformed-key, kind-mismatch, and payload cases; no new location convention exists to drift into | L |
| RSK-4 | A consumer grows its own classification beside the fixed projection (for example a budget read re-checking family keys), recreating the disagreement the single projection exists to prevent | M | L | All three consumers compose the one projection; the multi-ref proof runs `spend` and `provider resolve` over the same fixture; §22 names the one-projection rule as a standing review check | L |
| RSK-5 | The specification reading bases keep implying that any prefix hit outside the requested ref is damage, so future changes re-read the old contract | M | H | §22 declares the phase-7 reconciliation obligation for the telemetry reading bases and the spend/metrics read-side statements; this specification states the corrected contract as current until then | M (until phase 7 lands) |
| RSK-6 | Requested-ref behavior drifts on single-ref ledgers as a side effect of editing the branches | M | L | F-6/NFR-6 golden equality over records, ordering, verified-empty, evidence, and all tear cases; the single-ref fixture is part of the proof matrix | L |
| RSK-7 | A foreign record with a cross-family inconsistency (for example a step-family key carrying the baseline kind for another ref) becomes invisible to every per-ref projection | L | L | By DEC-2 this is outside the projection's jurisdiction and inside the global verified read's, which still parses and checksums every record regardless of key; no such record exists in any observed ledger; the cross-ref lint is declared deferred (§7.3) | L |

## 12. ASSUMPTIONS

- **A-1**: The ledger is healthy wherever this projection is the suspect: the observed incident ledger returned `verified` from the delivered verifier, and this change treats ledger damage as out of scope (the verifier's jurisdiction).
- **A-2**: The delivered per-ref economics read is the governing in-repo precedent; its jurisdiction model — skip foreign keys before any per-record inspection — applies unchanged here.
- **A-3**: The bare family prefix (empty ref remainder) is the only malformed family-key shape the projection must classify; finer grammar questions about foreign refs' key shapes belong to no per-ref read.
- **A-4**: All three spend-side consumers compose the one families read, so correcting the projection corrects `spend`, the metrics report, and provider resolution's budget measurement together, with no per-consumer edit.
- **A-5**: A lockstep changeset for the core package is a delivery-phase consideration and not an acceptance criterion of this specification.
- **A-6**: The proof battery runs under the repository's declared gate conventions (including the scratch-directory override used for gate evidence) and is fully hermetic: fixtures are committed state, never the live incident ledger.
- **A-7**: No decision record is required because the read's declared contract — a per-ref projection in one verified pass, with `state.store.torn` reserved for genuinely invalid or requested-ref damage — does not change; the implementation is brought into line with it (§14, DEC-4).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered telemetry v2 storage families (GH-291, GH-294, GH-299, GH-335) | Supplies the record kinds, payload schemas, and the store-scoped family prefixes the F-2 table classifies |
| Depends on | Delivered state store verified read | Supplies the single verified pass — parse, sequence contiguity, checksums — every projection composes, and the global integrity layer that stays unchanged |
| Depends on | Delivered spend read side (GH-236, GH-299) | The primary consumer whose multi-ref failure is the defect's observable; unchanged except failing → succeeding |
| Depends on | Delivered metrics report (GH-299) | Second consumer over the same families; inherits the correction |
| Depends on | Delivered provider resolution budget measurement | Third consumer; its success is what unblocks dispatch |
| Depends on | Delivered per-ref economics read (GH-235) | The delivered precedent and the rule this projection is brought into line with; not edited |
| Depends on | Ticket GH-381 and its binding owner implementation-pointer comment | Source of truth for the defect, the required behavior, the AC fixtures, and the constraints |
| Blocks | Spend reconciliation (#378) | While the read tears, no cost figure exists at all; this ticket is its prerequisite |
| Blocks | Native dispatch | Provider resolution is admission-blocking while the budget read tears |
| Blocks | Spend/metrics availability in every multi-ticket project | The defect arrives exactly when a project's second change lands |
| External | None | No vendor, network, credential, or transport dependency exists on any path |

## 14. OPEN QUESTIONS

None open. The two questions raised during clarification are resolved and recorded here for traceability; both resolutions are already reflected in the pm-notes.

| ID | Question | Resolution | Status |
|----|----------|------------|--------|
| OQ-1 | Where exactly is the line between a foreign record to skip and a malformed record to tear? | The F-2 table: a family key with an empty ref remainder (the bare prefix) is malformed and tears at its own position; a family key with a non-empty remainder naming another ref is foreign and is skipped without kind or payload inspection; the requested ref's key keeps the delivered tear behavior for kind mismatch and payload failure. | Resolved (ticket required behavior + owner comment; pm-notes 2026-11-22; F-2, DEC-1) |
| OQ-2 | Does correcting the tear condition change the read's declared contract enough to require a decision record? | No. The declared contract is already "per-ref projection, one verified pass, `state.store.torn` for genuinely invalid or requested-ref damage"; the correction aligns the implementation with it, exactly as the delivered economics read already does. A decision is needed only if delivery discovers the contract itself must change — that discovery is the escalation trigger, not a planned step. | Resolved (pm-notes 2026-11-22; NG-7, DEC-4) |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Within a family, a key with an empty ref remainder (the bare prefix) is malformed and tears at its own position; a key with a non-empty remainder naming another ref is foreign and is skipped without inspecting its kind or payload; the requested ref's key keeps the delivered tear behavior. | The ticket's required behavior demands exactly this distinction — "someone else's record" versus "a record that is itself invalid" — and the owner-suggested boundary is the minimal one that draws it without importing a ref-grammar validator into the read. | 2026-11-22 |
| DEC-2 | The projection's damage jurisdiction is (a) malformed family keys and (b) the requested ref's own records; foreign keys — including their kinds, payloads, and cross-family inconsistencies — are outside its jurisdiction and remain with the global verified read, which checks every record regardless of key. | A per-ref projection answers one ref; making it a global validator would give it two jobs, blur the tear taxonomy, and contradict the delivered economics precedent that already skips foreign keys before any per-record inspection. | 2026-11-22 |
| DEC-3 | The correction is confined to the step-family and baseline-family branches; the capture-outcome branch, the session-record branch, and the whole capture path stay exactly as delivered. | Those branches are already ref-scoped — one by a ref-bearing prefix, one by an exact ref-bearing key — and cannot hit a foreign record; touching them would widen the blast radius for no defect. | 2026-11-22 |
| DEC-4 | No decision record is authored for this change; the decision baseline stands at the current ledger maximum and is re-verified on the integration branch before any delivery-phase authoring, and ids are never renumbered. | This is a defect correction that makes the implementation match the delivered per-ref read contract, not a contract change; escalation to a decision is triggered only if delivery discovers the contract itself must change. | 2026-11-22 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Per-ref telemetry families projection (state layer) | Updated — the step-family and baseline-family branches skip well-formed foreign keys per the F-2 table; malformed keys and requested-ref damage keep tearing with delivered identities and locations; capture-outcome and session-record branches unchanged |
| Spend read side (`spend` command, fold, status digest section 8) | Succeeds — no shape or semantics change; multi-ref ledgers return scoped reports where they returned `state.store.torn` |
| Metrics report (dispatch block, burn-rate evaluation) | Inherits — reads the same corrected projection; no report change beyond multi-ref success |
| Provider resolution budget measurement | Succeeds — the ticket-scope budget read proceeds on multi-ref ledgers; `provider resolve` reaches a provider decision instead of the telemetry tear |
| Telemetry capture path (step and baseline appends, ingest accounting) | Unchanged — ref-scoped as delivered; no writer-side edit |
| State ledger and global verifier | Unchanged — append-only contract, record kinds, sequences, checksums, and the verified read are untouched; no repair or migration path exists on any branch |
| Per-ref economics read and other ledger projections | Unchanged — cited as the delivered precedent, not edited |
| Feature specification "Harness Telemetry v2" reading bases (§5/§5.1) | Reconcile in phase 7 — state the per-ref projection rule (foreign family keys skipped, never damage; torn reserved for malformed family keys and requested-ref damage) |
| Feature specifications "Spend Read Side" and "Metrics Report and Burn-Rate Alarms" | Verify/clarify in phase 7 — the read-side statements may need the same per-ref sentence |
| Feature specification "State Layer" torn taxonomy | Unchanged — verify no contradiction in phase 7; no identity is added or re-semanted |
| Proof harness and committed fixtures | New — interleaved two-ref fixtures (three families per ref, both directions), the malformed-key fixtures, the requested-ref kind-mismatch fixture, the named foreign-first regression case, the single-pass and single-ref golden proofs |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a committed fixture ledger interleaving two refs A and B, holding step, baseline, and capture-family records for each ref, **when** the telemetry families read runs for A, **then** it succeeds and returns exactly A's records — zero of B's records in any collection, zero of A's records dropped — with the evidence disclosing the shared store path and total record count; **and when** the same read runs for B, **then** it likewise succeeds and returns exactly B's records; **and** neither read produces `state.store.torn` or any other classification | F-1, F-4, NFR-5 |
| AC-F2-1 | **Given** a fixture ledger containing a record whose key is the bare step prefix (the family prefix with an empty ref remainder), **when** the families read runs for any ref, **then** it returns `state.store.torn` located at that record's position — the disclosed store path and that record's ledger sequence; **and when** the fixture symmetrically carries a bare baseline-prefix record, **then** the same tear behavior holds for the baseline family; **and when** the fixture instead marks the malformed records skipped or drops their locations, **then** the proof fails | F-2, F-3, NFR-3 |
| AC-F3-1 | **Given** a fixture ledger in which the requested ref's step key carries a record kind other than the step kind, **when** the families read runs for that ref, **then** it returns `state.store.torn` at that record's position, exactly as delivered; **and when** the requested ref's baseline key symmetrically carries a non-baseline kind, **then** the same tear behavior holds; **and when** a requested-ref record's payload fails validation, **then** the delivered payload classification and location are unchanged | F-3, NFR-3 |
| AC-F4-1 | **Given** a committed regression case named for this defect, over a two-ref fixture ledger whose first telemetry-family record is a foreign step record of the other ref appearing before the requested ref's first record — the exact shape of the observed incident — **when** the families read runs for the requested ref, **then** it succeeds with exactly the requested ref's records, skipping the leading foreign record; **and when** the spend fold runs over the same ledger for that ref, **then** it returns its scoped report rather than `state.store.torn`, containing exactly that ref's steps | F-1, F-4, F-5, NFR-5 |
| AC-F4-2 | **Given** a fixture ledger holding two refs' telemetry families, **when** provider resolution runs for the requested ref, **then** its budget measurement reads the spend projection successfully and the resolution proceeds to a provider decision per the delivered provider facts — and no `state.store.torn` from the telemetry read is produced on any path | F-4, NFR-5 |
| AC-F5-1 | **Given** any fixture in the proof matrix, **when** the families read runs, **then** it performs exactly one verified pass over the ledger — 0 additional store reads, 0 per-record re-reads, 0 harness or session queries — with work linear in total ledger records; **and when** the ledger holds foreign records interleaved throughout, **then** the read bound is unchanged and each foreign record is visited exactly once | F-5, NFR-1 |
| AC-F6-1 | **Given** a fixture ledger whose telemetry families hold only the requested ref's records, **when** the families read runs and its result is compared against the delivered behavior, **then** the records, their ordering, the verified-empty flag, the evidence pair, and every tear case are identical — golden equality with 0 differences; **and when** the ref holds no telemetry at all, **then** the verified-empty result is identical to delivered | F-6, NFR-6 |
| AC-NFR2-1 | **Given** each fixture in the proof matrix run three times and compared, **when** results are compared across runs, **then** records, ordering, verified-empty, evidence, and every tear identity and location are identical, with 0 network calls, 0 ambient-store reads, and 0 real-clock dependencies; **and when** the delivered vocabulary sets are compared with the delivered ones, **then** error identities, record kinds, payload schemas, key prefixes, envelope keys, and exit codes are exactly equal, with 0 additions | NFR-2, NFR-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Single change, no flag.** The defect and its correction are one behavior; a toggle would leave the multi-ref tear reachable, which is the defect.
- **Proof before merge.** The interleaved fixtures, the malformed-key and kind-mismatch tear cases with location assertions, the named foreign-first regression case, the single-pass bound, and the single-ref golden equality must be green in the aggregate gate before review.
- **No operator action and no data repair.** No configuration edit, migration, or ledger fix-up is required or permitted; a ledger that fails today needs no treatment beyond this change, and the observed incident ledger must not be touched.
- **Branch and target.** The change is delivered on its own branch per the repository's branch convention for this ref, with the PR targeting the tooling integration branch and left open for merge authority; commit hygiene follows the repository's commit convention, and the declared scratch-directory convention applies to gate evidence.
- **Documentation lands next.** The phase-7 reconciliation named in §22 is the follow-on obligation; until it lands, this specification is the current statement of the projection rule and review reads against it.
- **Version metadata.** A lockstep changeset for the affected package is a plan-phase consideration, not an acceptance criterion (A-5).
- **No announcement or operator communication** is required; the observable change is that the spend surfaces stop failing on the ledgers operators already have.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. There is no schema change, no record-shape change, no key change, and no write of any kind. Existing ledgers — single-ref and multi-ref, including the observed incident ledger — are read without transformation, repair, back-fill, or dual-read. Reverting the behavior requires no state repair: the ledger never changed.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A for personal data: no personal data is collected, derived, or exposed. Telemetry records already carry aggregate counts, identity references, and time windows only, under the delivered redaction chokepoint, and this change reads them without adding a field or surface. The correction strictly narrows what a read returns — exactly one ref's records — so a multi-ref report exposes less, not more, of the shared ledger than the raw store discloses. No vendor terms are newly exercised: no request of any kind is added.

## 21. SECURITY REVIEW HIGHLIGHTS

- **No new read surface.** The projection performs the same single verified pass as delivered: zero network calls, zero credential reads, zero harness-store queries, zero environment reads added.
- **Damage stays fail-closed.** The skip applies only to keys provably owned by another ref; malformed family keys and requested-ref damage keep tearing with delivered identities and locations, so a tampered or damaged ledger cannot be laundered into a silently clean report for the ref being read (F-2, F-3, RSK-1).
- **Integrity is not weakened by skipping.** The global verified read still parses every record, checks sequence contiguity, and recomputes every checksum regardless of key; skipping a foreign key in a per-ref projection removes no global check (DEC-2, RSK-7).
- **Read-only, privilege-free.** No path of this change writes state, mutates records, or grants any capability; the projection cannot be used to alter, reorder, or suppress another ref's records — only to decline reading them.
- **Foreign records are declined, not surfaced.** A multi-ref report contains only the requested ref's records; no foreign payload, key, or evidence crosses into any consumer's output.
- **Residual risk is low**: the change strictly narrows what stops a read, and every narrowing is pinned by a tear-preserving fixture.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Phase-7 reconciliation is mandatory, not cosmetic.** The telemetry reading bases must state the per-ref projection rule so the specification stops implying that any prefix hit outside the requested ref is damage: foreign family keys are skipped and never classified as damage; `state.store.torn` is reserved for malformed family keys and requested-ref damage. The documentation targets are `doc/spec/features/feature-telemetry-v2.md` (§5/§5.1 reading bases), `doc/spec/features/feature-spend.md` and `doc/spec/features/feature-metrics.md` (read-side statements may need the same per-ref sentence), and a verification pass on `doc/spec/features/feature-state-layer.md` (torn taxonomy unchanged — verify no contradiction). Known risk if skipped: future changes re-read the old contract and reintroduce the defect class (RSK-5).
- **One projection, three consumers — keep it that way.** `spend` (and the digest section it feeds), the metrics report, and provider resolution's budget measurement must keep composing the single corrected projection; a consumer that grows its own family-key classification recreates the disagreement this defect demonstrated. Review of any change to the projection or its consumers checks that rule.
- **The generalized house rule is now stated twice in delivered code.** Both per-ref projections over the shared ledger — the economics read and the telemetry families read — skip foreign keys before any per-record inspection. Future per-ref reads follow the same rule; the deferred abstraction (§7.3) exists if a third case appears.
- **No new operational surface.** No configuration key, command, flag, view field, or state document is added, so runbooks, doctor checks, and the operator's mental model change only in one respect: the spend surfaces work on the ledgers projects actually accumulate.
- **Failure semantics for support.** A remaining `state.store.torn` from this projection now means genuinely malformed family keys or requested-ref damage — never another ref's valid record — so support conversations can cite the located record as real damage and treat the verifier's verdict as corroboration.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Telemetry family | One of the record families the spend side reads: step records, baseline records, harness session records, and capture-outcome records, each under its delivered store-scoped key prefix |
| Family key / ref remainder | A ledger record's key within a family: the family prefix followed by the owning change's ref remainder; an empty remainder is the bare prefix |
| Bare prefix | A family key with an empty ref remainder (e.g. `harness.telemetry.step:` naming no ref); malformed by the F-2 table and a tear subject |
| Foreign record | A well-formed record whose owning ref differs from the ref the projection is answering; skipped, never damage |
| Per-ref projection | A read that answers exactly one work-item ref from the shared ledger, returning only that ref's records |
| Verified pass | The delivered single read over the ledger that parses every record, checks sequence contiguity, and recomputes checksums, yielding verified truth for every projection |
| `state.store.torn` | The delivered damage identity for a ledger record that is itself invalid or inconsistent with the ref being read; located by store path and record sequence |
| Verified-empty | The projection result flag that is true exactly when the requested ref holds no records of any family |
| Spend fold | The read-only fold composing the telemetry families and phase history into the spend report; also feeds the status digest's section 8 |
| Budget measurement | Provider resolution's ticket-scope ceiling read over the spend projection; the consumer whose failure blocks every dispatch |
| Record position / location | The delivered safe location of a tear or classification: the store path plus the offending record's 1-based ledger sequence |
| Capture-outcome record | The per-session ingest-accounting record family, ref-scoped by its key prefix; delivered correct and unchanged here |

## 24. APPENDICES

### Appendix A — Observed evidence (corroboration, not a test dependency)

- Incident instant 2026-11-22T07:31Z, build `5ace5e9`, tooling integration branch at `5ace5e98`; two changes' telemetry in one project ledger.
- `spend` failed with `state.store.torn` naming record 3786; `provider resolve` failed with a summary stating the spend ledger could not be read and the budget could not be measured.
- Record 3786: kind `harness.telemetry.step`, key `harness.telemetry.step:GH-365` — a valid step record of the other change, one of 563 that change wrote.
- Ledger health: all 4,876 records parse, sequences contiguous 1..4876, every checksum recomputes; the delivered verifier returns `verified` in-process.

### Appendix B — Ticket acceptance-criteria traceability

| Ticket AC | Specification criterion |
|-----------|-------------------------|
| Ticket AC-1 (interleaved A and B, neither tears) | AC-F1-1 |
| Ticket AC-2 (bare prefix still tears, correct position) | AC-F2-1 |
| Ticket AC-3 (requested-ref kind mismatch still tears) | AC-F3-1 |
| Ticket AC-4 (named regression case, foreign family first) | AC-F4-1 |
| Ticket AC-5 (provider resolve proceeds to a provider decision) | AC-F4-2 |
| Required behavior 5 (single verified pass) and the single-ref invariant | AC-F5-1, AC-F6-1, AC-NFR2-1 |

### Appendix C — Normative classification table (the F-2 rule, restated for implementers' reference)

For each ledger record in ledger order, within the step-family branch — mirrored identically in the baseline-family branch:

| Condition on the record's key | Classification | Behavior |
|-------------------------------|----------------|----------|
| Key equals `<step prefix><requested ref>` | Requested ref's record | Kind must be the step kind (else `state.store.torn` at position); payload validated as delivered; contributes to the steps collection |
| Key equals the bare `<step prefix>` (empty remainder) | Malformed | `state.store.torn` at that record's position |
| Key under the prefix, non-empty remainder, any other ref | Foreign | Skip; no kind or payload inspection; no evidence |

Outside the two family branches, behavior is delivered and unchanged: the session-record branch matches an exact ref-bearing key and the capture-outcome branch a ref-bearing prefix, so neither can hit a foreign record.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-22 | @spec-writer (GLM-5.3-Flash) | Initial specification from ticket GH-381, the binding owner implementation-pointer comment, and the committed pm-notes clarify_scope findings |

---

## AUTHORING GUIDELINES

- **Sources.** Ticket GH-381 body (defect report, required behavior, AC fixtures, constraints) and the binding owner implementation-pointer comment (the seam, the delivered economics precedent, the distinction to keep); the committed pm-notes `chg-GH-381-pm-notes.yaml` (clarify_scope findings, binding constraints, decision baseline, phase-7 doc impacts); `doc/spec/features/feature-telemetry-v2.md` (§4 storage, §5/§5.1 reading bases); `doc/spec/features/feature-spend.md` (consumer contract); the delivered families read and its step/baseline/capture branches; the delivered per-ref economics read; sibling M4 defect specification GH-377 as the structural and stylistic model.
- **Approach.** The specification states the corrected projection rule as current truth, makes the well-formed/malformed boundary normative (F-2, Appendix C), and keeps every delivered identity, tear case, and read bound as an asserted invariant rather than a redesigned surface. The ticket's five AC fixtures map one-to-one onto spec criteria with two additions (single-pass bound, single-ref golden equality); the mapping is tabulated in Appendix B for the test plan's traceability.
- **Constraints honored.** No ledger mutation on any path; the single verified pass preserved; fixtures required to interleave two refs with the foreign family first; no decision record planned (NG-7, DEC-4, with the escalation trigger recorded); no file-level code paths in the specification body per the template's validation rules — the seam is named functionally, and contract constants (record kinds, key prefixes) are vocabulary, not paths.
- **Deliberate silences.** Consumer report shapes, capture-path behavior, other projections, and the global verifier are declared unchanged and out of scope rather than restated; their authorities are the linked feature specifications, which phase 7 reconciles (§22).

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef`
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
