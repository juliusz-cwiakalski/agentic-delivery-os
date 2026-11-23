---
change:
  ref: GH-388
  type: fix
  status: Proposed
  slug: verify-gates-persist-merge-verification
  title: "M4-S24: verify gates must persist the verification merge consumes (M4)"
  owners: ["Juliusz Ćwiąkalski"]
  service: "verify gates command composition and the merge gate-verification ledger seam (CLI composition over the core merge-ledger state family)"
  milestone: "M4: Jaiship-native delivery"
  labels:
    - change
    - defect
    - m4
    - cli
    - merge
    - verify-gates
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "delivered merge-ledger state family: the fenced, post-append-verified merge.gate-verification append and the per-change-ref verified read (GH-225 EVT-1/DM-1)"
      - "delivered shared gate-set resolver with reserved built-in ids, surface projections, and the shipped default set whose ci-green entry is merge-applicable (GH-225 F-1/DM-4; GH-366 F-2)"
      - "delivered merge transaction: freshness envelope, recorded-or-probe verdict consumption, refusal taxonomy including merge.state-unverified (GH-225, GH-366, merged on-base as f531c057)"
      - "delivered verify gates runtime append seam and handler record construction on both the single-target and cross-repository paths (GH-178, GH-300, GH-310), composed today with a no-op append in the shipped production composition"
    external:
      - "none; no vendor, network, credential, or transport dependency changes on any path"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the documented pre-merge verification surface actually evidencing — the shipped `verify gates` run computes the complete `merge.gate-verification` record but silently discards it, so `merge` refuses `merge.state-unverified` until an undocumented `--dry-run` pre-step records the verification for it — by persisting the record `verify gates` computes under the delivered fenced append contract, declaring the identity rule under which `merge` consumes it, and pinning the refusal remediation to the command sequence that genuinely resolves it (F-1..F-5, NFR-1..NFR-5).

## 1. SUMMARY

The delivered truth in both current-truth feature specifications is option-(A) shaped: `verify gates` appends exactly one fenced `merge.gate-verification` record per full battery evaluation that is not refused for narrowed suite breadth, and `merge` consumes the newest record through its freshness envelope. The shipped runtime contradicts this at exactly one point: the verify-gates command handler constructs the complete verification record — battery verdicts with citations, gate-set identity, head SHA, verification time, tracker posture — and calls its append seam on both the single-target and cross-repository paths, but the shipped production composition never supplies that seam, and the composition default is a no-op. The record is computed and dropped. `merge`, whose dry-run path does wire the identical append, therefore finds `state=absent`, refuses `merge.state-unverified` at exit 2, and its own remediation — "Produce the verification with `verify gates <ref>` for the same work item, then re-run" — sends the operator down a sequence that provably cannot converge, as observed on PR #387 (GH-366): two passing `verify gates` runs produced no ledger record; the record appeared only after `merge --dry-run`; only then did plain `merge` land.

This change converges runtime to the declared contract at the one broken seam: the production verify-gates composition supplies the delivered fenced, post-append-verified state append, so the record `verify gates` prints is the record `merge` consumes. The ticket delegates the mechanism choice ("choose one, declare it"); this specification declares option **(A)** — `verify gates` persists the verification it computed, `merge` consumes it — and rejects option (B) (merge composing its own verification when no record exists), which would keep `verify gates` non-evidencing and double the verification composition on the landing path. Because both record producers resolve their gate set through the one shared resolver, the identity both sides carry is the full declared entry-id sequence, and this specification declares that total identity equality — not a surface projection — is the envelope's binding rule, with each surface's projection selecting only what it evaluates and what the record's verdict payload carries. `verify gates` output bytes are declared unchanged (the append is silent), the delivered read budget is unchanged (the append adds zero provider reads), and the `merge.state-unverified` remediation is pinned by test to the sequence that works.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The record contract is delivered and correct.** The merge-ledger state family ships the fenced, post-append-verified `merge.gate-verification` append (keyed per change ref, one append-only history) and the per-change-ref verified read that classifies absent/torn/unreadable/incompatible state. The merge transaction consumes the newest record through the declared freshness envelope: record exists and is readable; age below the declared bound (at-bound stale); recorded head SHA equals the current head; recorded gate-set identity equals the effective one. Absent state refuses `merge.state-unverified` at exit 2; a stale-but-readable record refuses `merge.gates-stale` at exit 1 with the age, bound, SHAs, set delta, and probe observations inline.
- **Both record producers exist and share one gate-set resolver.** `verify gates` builds the complete record on both its single-target and cross-repository paths and hands it to its append seam. `merge --dry-run` builds the same record shape over the merge-applicable entries and appends it through the merge command composition. Both derive the gate-set identity — schema version plus entry-id sequence — from the same shared resolver over the declared configuration or the shipped default set (five built-ins in shipped order plus the merge-only `tracker-freshness` entry).
- **The one broken point is composition wiring.** The verify-gates runtime's append seam is an injectable option whose composition default is a no-op ("absent leaves the evaluation unrecorded"). The shipped production composition creates the verify-gates runtime and never supplies the seam. Every shipped `verify gates` run therefore evaluates the battery, prints its verdicts, and silently discards the record it built. The merge dry-run path, composed separately, wires the same append to the real state append — which is precisely why the ledger record appears only after `merge --dry-run`.
- **The delivered proof exercises the seam, not the shipped composition.** The existing verification-record tests inject the append seam into the verify-gates runtime and prove the handler appends exactly one record per non-refused evaluation; the production composition is not covered asserting a real append from the shipped wiring. The defect lives exactly in the code the injected seam routes around.
- **The merge path already consumes battery-surface verdicts coherently.** After the envelope passes, the landing decision reads recorded verdicts for enforced entries: a recorded not-green `ci-green` refuses with the `recorded` attribution; a recorded fail on a battery-only built-in refuses through the per-gate family; `tracker-freshness` is freshly evaluated from the recorded tracker posture against the probe; a recorded green `ci-green` is re-probed. A dry-run record carries no battery-only verdicts, so those recorded-verdict checks are silent today; a verify-gates record carries all five, making the checks live and truthful.
- **The observed session is the defect end to end.** On PR #387 (GH-366, 2026-11-23): `verify gates GH-366` passed 5/5 twice with no `merge.gate-verification` record in the ledger; `merge GH-366` refused `merge.state-unverified` (`state=absent`) with the remediation naming `verify gates`; `merge GH-366 --dry-run` appended the record; plain `merge GH-366` then landed.

### 2.2 Pain Points / Gaps

- **The product's own remediation is a loop.** `merge.state-unverified` instructs the operator to run the one command that — as shipped — cannot produce the record the refusal demands. An operator following the product's instruction never converges.
- **A verification that is printed but not recorded is not evidence.** `verify gates` is the documented pre-merge verification surface; its verdicts claim gate evidence while the durable ledger holds nothing. The audit story ("the ledger is the evidence") is false on this surface.
- **The documented native sequence cannot land a change.** The engine-first operations guidance presents `verify gates` → `merge --dry-run` → `merge`. The middle step is undocumented as a requirement, undiscoverable by inspection, and exists only because the first step fails to record.
- **Every operator pays the discovery cost by trial.** The `state=absent` refusal names no dry-run step; each operator rediscovers the working sequence by experiment.
- **Runtime and current-truth spec disagree on a safety-adjacent surface.** Both feature specifications declare the append as current truth; the shipped runtime does not honor it. Until converged, the specification is not a description of the shipped system.

## 3. PROBLEM STATEMENT

Because the shipped production composition supplies no append seam to the verify-gates runtime — whose default is a no-op — `verify gates` computes and prints the pre-merge verification without persisting it, so `merge` finds no consumable record and refuses `merge.state-unverified`, and the refusal's remediation names a command sequence that cannot resolve the refusal; an operator cannot land a change through the documented native sequence without discovering an undocumented `--dry-run` pre-step by trial, resulting in a verification surface that produces no durable evidence, a remediation that loops, and a documented workflow that does not work as documented.

## 4. GOALS

- **G-1**: A shipped `verify gates <ref>` run persists exactly one fenced, post-append-verified `merge.gate-verification` record per full battery evaluation that is not refused for narrowed suite breadth — the record it already computes, under the delivered merge-ledger append contract — so the verification it prints is evidence in the ledger.
- **G-2**: After a passing `verify gates <ref>` on a clean PR, `merge <ref>` lands with no `--dry-run` pre-step: the freshness envelope accepts the verify-gates record under the declared identity rule, and the documented native sequence converges.
- **G-3**: The gate-set identity rule is declared once and total: the recorded identity equals the effective identity, both being the schema version plus the full declared (or shipped-default) entry-id sequence resolved by the one shared resolver; a surface projection selects what a surface evaluates and what the record's verdict payload carries, never the identity. The five built-in ids stay reserved and mandatory in every declared set; `tracker-freshness` stays merge-only; `merge --dry-run` keeps its merge-applicable record semantics.
- **G-4**: The `merge.state-unverified` remediation names the command sequence that genuinely resolves the refusal — produce the verification with `verify gates <ref>`, then re-run `merge <ref>` — and never names a sequence that cannot, pinned by test.
- **G-5**: `verify gates` remains bounded and secret-free with zero behavioural regression of its five gates: the delivered read budget, verdict rules, citations, ordering, human bytes, and machine envelope are unchanged; the append is the only new effect and is silent.
- **G-6**: The merge-ledger discipline is untouched: appends stay fenced and post-append-verified; an append failure is a classified state failure and never consumable evidence; no record kind, key, schema, read, or existing ledger row changes; no ledger mutation, migration, or repair exists on any branch.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| `merge.state-unverified` (`state=absent`) refusals after a passing `verify gates` on a clean PR | 0 (F-1, F-2) |
| Documented native sequence runs (`verify gates` → `merge`) requiring a `--dry-run` pre-step to land | 0 (F-2, G-2) |
| Full battery evaluations not refused for narrowed breadth that append a record | exactly 1 each (F-1) |
| Narrowed-scope refusals that append a record or capsule event | 0 (F-1) |
| Verify-gates human bytes / machine-envelope golden delta versus pre-change | 0 bytes (F-5, NFR-2) |
| Additional provider reads on any verify-gates or merge path | 0 (NFR-1) |
| Secret, credential, title, body, or raw payload material in any persisted record or output | 0 (F-5, NFR-5) |
| Recorded identities that fail the declared identity rule yet are consumed by `merge` | 0 (F-3, AC-T4) |
| `merge.state-unverified` remediation texts naming a non-working sequence | 0, test-pinned (F-4) |
| Regression cases against the five delivered gates | 0 (F-5, AC-T5) |

### 4.2 Non-Goals

- **NG-1**: No new gates and no gate-rule changes: the five built-ins keep their recipes, surfaces, reason sets, and passing conditions; no fourth-surface or required-job declaration behaviour is touched.
- **NG-2**: No read-budget expansion on any path: no new provider read, page, item, workflow read, or configuration read is added to `verify gates` or `merge`; the append is a write under the delivered fenced-append contract, not a read.
- **NG-3**: No new error-table rows: `merge.state-unverified` and every other delivered identity exist; only the remediation's tested truthfulness is pinned. No new record kind, key prefix, payload schema, envelope key, or exit code.
- **NG-4**: No change to `verify deploy`: its reads, verdict taxonomy, and bounds are untouched.
- **NG-5**: No change to the capsule `gate.outcome` append semantics: writer, kind, event key, payload, disclosure, and non-gating posture are exactly as delivered; the record append precedes it as delivered on the handler path and the narrowed refusal appends neither.
- **NG-6**: No change to `merge --dry-run`: it keeps evaluating the merge-applicable set, appending its merge-applicable record, landing nothing, and never reporting a merge verdict.
- **NG-7**: No change to the waiver and transaction ledgers, the landing mechanism, the convergence/replay path, or the refusal taxonomy beyond what consuming a verify-gates record already implies.
- **NG-8**: No option-(B) delivery: `merge` never composes its own verification when no record exists; the absence refusal and its remediation are the declared path.
- **NG-9**: No surface parity for custom declared gate sets on the verify-gates side: the production verify-gates composition keeps resolving the shipped default set; the declared-set case is deferred (§7.3, OQ-1, RSK-2).
- **NG-10**: No ledger mutation, migration, back-fill, or seeding: append-only discipline is preserved; pre-existing records (including any dry-run records) are read exactly as delivered.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Verify-gates record persistence: the shipped production composition supplies the delivered fenced, post-append-verified append, so every full battery evaluation not refused for narrowed breadth persists the record it computes — exactly one per evaluation, none on a narrowed refusal, on both the single-target and cross-repository paths | The ticket's option (A); a printed-but-unrecorded verification is not evidence, and both current-truth specs already declare this truth |
| F-2 | Merge consumption of verify-gates records: the freshness envelope and the recorded-verdict consumption accept a battery-surface record as fully consumable evidence, so `verify gates` → `merge` lands a clean PR with no `--dry-run` pre-step | The documented native sequence must converge; the landing decision should read the evidence the documented surface produces |
| F-3 | Identity reconciliation rule: total equality of the recorded gate-set identity against the effective identity, both being the schema version plus the full declared (or shipped-default) entry-id sequence from the one shared resolver; surface projections select evaluated entries and verdict payload, never the identity; built-ins stay reserved and mandatory | Code truth: both producers already carry the full-declared-sequence identity, so a projection or superset rule would invent semantics the delivered envelope does not have; the total rule keeps dry-run records coherent and makes the ticket's identity fixture satisfiable |
| F-4 | Remediation truthfulness: the `merge.state-unverified` remediation names the working sequence — produce with `verify gates <ref>`, re-run `merge <ref>` — and is pinned by test byte-exactly | Ticket requirement; the product must never instruct an operator down a sequence that cannot satisfy its own refusal |
| F-5 | Verify-gates non-regression: bounded reads, five gate rules, verdicts, citations, ordering, human bytes, machine envelope, and the capsule append are byte- and behaviour-identical to delivered; the append is silent | The battery is goldens-pinned current truth; the fix must add evidence, not change the surface |

### 5.1 Capability Details

- **F-1 — record persistence.** The verify-gates runtime's append seam is wired in the shipped production composition to the delivered merge-ledger state append: one fenced, post-append-verified `merge.gate-verification` record per full battery evaluation that reaches the append point. The record is the one the handler already constructs — schema `delivery.merge.gate-verification.v1`, change ref, observed head SHA (empty when the checkout head is unresolved, which the envelope then can never accept — honest fail-closed), verification time, full-declared-sequence gate-set identity, per-gate verdicts with bounded citations (the five battery entries; member-projected records on the cross-repository path, delivered shape preserved), and observed tracker posture. Appended-record counting is unchanged: exactly one per non-refused evaluation; a narrowed-scope refusal appends neither record nor capsule event; a configuration refusal precedes evaluation and appends nothing; an append failure is a classified state failure surfaced as the run's failure, never silent, never consumable. The append is silent: no human line, no machine field, no exit-code change.
- **F-2 — consumption.** `merge` reads the newest record and evaluates the delivered envelope unchanged. A record produced by `verify gates` passes the identity check under F-3's rule; its recorded verdicts then participate in the delivered landing decision exactly as the dry-run record's do where they overlap (`ci-green` recorded-not-green refuses with the `recorded` attribution; a recorded green is re-probed; `tracker-freshness` is freshly evaluated from the recorded tracker posture), and additionally make the recorded verdicts of the battery-only built-ins live: a recorded fail on `lifecycle-finalization`, `push-parity`, `owner-gate`, or `squash-preflight` refuses through the delivered per-gate family with the recorded evidence. On a clean PR — every battery verdict pass — the envelope holds and the probe corroborates, so the landing proceeds; no `--dry-run` step exists anywhere in the required path.
- **F-3 — identity rule.** The effective identity is the schema version plus the full declared entry-id sequence (shipped default when undeclared), resolved by the one shared gate-set resolver both surfaces compose. The envelope's binding rule is total equality of that identity: same schema version, same id sequence, order included. A surface projection (`batteryEntries` for the verify-gates battery, `mergeEntries` for the merge/dry-run evaluation) determines which entries a surface evaluates and which verdict records the payload carries — never the identity a record binds. Because both producers resolve through the same resolver against the same shipped default, a verify-gates record and a dry-run record carry identical identities, and the envelope treats them identically; the newest record wins, as delivered. The five built-in ids stay reserved and mandatory in every declared set (delivered resolver rule, unchanged); `tracker-freshness` stays merge-only; a record whose identity disagrees refuses `merge.gates-stale` with the set delta, as delivered.
- **F-4 — remediation.** The `merge.state-unverified` row's remediation names the producing command (`verify gates <ref>` for the same work item) and the consuming re-run (`merge`), and names no sequence that cannot resolve the refusal — in particular it never presents `merge --dry-run` as a required pre-step. The shipped remediation text already states the working sequence; under option (A) it becomes truthful, and the change's obligation is the byte-exact test pin (F-4/AC-T3), with any refinement constrained to preserve the property.
- **F-5 — non-regression.** All delivered verify-gates pins hold: verdict rules and reason vocabularies, citation shape and bounds, report ordering, the six-line human report and machine envelope bytes (goldens), output caps, read budget (bounded local reads; at most one page or item per provider source; one bounded configuration-document resolution attempt), secret-free posture, and the capsule append. The only new effect on any path is the state append itself.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Documented native sequence (after this change; the required path):

  Operator: verify gates GH-366
    System: evaluates the five-gate battery (delivered reads, delivered rules)
      → all pass → appends ONE fenced gate-verification record (silent)
      → prints the delivered 6-line human report (bytes unchanged), exit 0
  Operator: merge GH-366
    System: resolves the change branch and request at its asserted head
      → reads the newest gate-verification record (the one verify gates wrote)
      → envelope: record readable, age < bound, headSha == request head,
        gate-set identity == effective identity (full declared sequence) → holds
      → probe: work item + check-run page on the verified head
      → recorded verdicts + probe corroborate (clean PR) → lands
      → result=merged, squash=<provider sha>

Flow 2 — No prior verification (option A's declared path; option B not delivered):

  Operator: merge GH-366            (no record in the ledger)
    System: envelope state=absent → refuses merge.state-unverified (exit 2)
      remediation: "Produce the verification with `verify gates GH-366`
                    for the same work item, then re-run"   [pinned by test]
  Operator: verify gates GH-366 → merge GH-366   → lands (Flow 1)

Flow 3 — Failing or stale verification (fail-closed, delivered semantics):

  verify gates reports a fail → the record persists with the failing verdict
    → merge consumes it: the recorded verdict refuses the landing through the
      delivered per-gate family with the `recorded` attribution (truthful
      evidence, no silent pass)
  head moves / bound elapses after verify gates → envelope refuses
    merge.gates-stale (age/head-sha/gate-set reason, evidence inline)
    → the working sequence is the same: re-run verify gates, then merge

Flow 4 — merge --dry-run (unchanged, coherent under the identity rule):

  merge GH-366 --dry-run → evaluates the merge-applicable entries, appends ONE
    merge-applicable record (same identity, smaller verdict payload), lands
    nothing → the newest-record-wins read treats it identically to a
    verify-gates record
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The production verify-gates command composition: supply the delivered fenced, post-append-verified merge-ledger append as the verify-gates runtime's append seam (the one broken wiring point; no handler, report, or record-shape change).
- The declared identity rule (F-3) and its statement in the current-truth documentation, so the envelope's acceptance of a battery-surface record is specified truth, not accident.
- The merge-side consumption semantics for a battery-surface record as they already exist (recorded-verdict consumption, envelope, newest-record-wins), pinned by fixtures — including the ticket's identity fixture (changeRef + headSha against the merge read).
- The `merge.state-unverified` remediation content: pin the working sequence by test; refine the text only if the pin requires it, preserving the property.
- Documentation impacts: the two feature specifications (verify-gates persistence/consumption wording; merge freshness envelope and remediation), the engine-first operations guidance's native merge sequence (the ticket's blocked documentation), and the merge/verify-deploy test specification's coverage rows.
- Regression and fixture work: the identity pin, the one-record-per-evaluation counting pins, the narrowed-refusal no-append pin, the remediation pin, the clean-PR landing case, and the byte-identical goldens.

### 7.2 Out of Scope

- [OUT] No new gates, recipes, surfaces, or gate-rule changes of any kind.
- [OUT] No read-budget expansion beyond zero: no new provider read, page, item, workflow read, or configuration read on any path.
- [OUT] No new error-table rows, record kinds, key prefixes, payload schemas, envelope keys, or exit codes; no widening of any declared vocabulary.
- [OUT] No change to `verify deploy` or its test specification beyond coverage-row attribution if the test plan names it.
- [OUT] No change to the capsule `gate.outcome` append semantics (writer, kind, event key, payload, disclosure) beyond what option (A) already requires — which is nothing.
- [OUT] No change to `merge --dry-run` behaviour, the waiver ledger, the transaction ledger, the landing mechanism, convergence/replay, or the refusal taxonomy.
- [OUT] No option-(B) composition: `merge` never fabricates a verification when no record exists.
- [OUT] No verify-gates-side resolution of declared `merge.gates` configuration (custom-declared-set surface parity) — deferred (§7.3).
- [OUT] No changes to pm-notes, phase state, or the change capsule's command-owned events for this change.

### 7.3 Deferred / Maybe-Later

- **Declared-custom-set surface parity.** The production verify-gates composition resolves only the shipped default gate set; `merge` resolves the declared `merge.gates` configuration. With a custom declared set, a verify-gates record would carry the shipped-default identity and the envelope would refuse `merge.gates-stale` with the set delta — the declared fail-closed behaviour, not a silent pass. Making the verify-gates surface resolve the same declaration (so custom-declared sets work end to end through the native sequence) is a follow-up change (OQ-1, RSK-2); it is deliberately out of this ticket's scope because every ticket AC is declared over the shipped default set and the parity change would alter which gates the battery evaluates for declarers.
- **Remediation wording refresh.** If the phase-7 documentation pass prefers a remediation that explicitly names the consuming re-run (`then re-run merge <ref>`), the wording may be refined in a follow-up under the same property pin; the current text is already the working sequence under option (A).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. No HTTP surface exists or changes; all provider access stays behind the delivered bounded read seams.

### 8.2 Events / Messages

| ID | Event / Record | Change |
|----|----------------|--------|
| EVT-1 | `merge.gate-verification` (schema `delivery.merge.gate-verification.v1`, keyed `merge.gate-verification:<changeRef>`) | Producer set gains the shipped `verify gates` run: the record the handler already constructs is now persisted under the delivered fenced, post-append-verified append. Shape, schema, key, counting (exactly one per full evaluation not refused for narrowed breadth), and read tolerance are unchanged; `merge --dry-run` keeps appending its merge-applicable record. The record's verdict payload carries the producing surface's evaluated entries (battery entries for `verify gates`; merge-applicable entries for `--dry-run`) and never alters the identity the envelope binds |
| EVT-2 | `gate.outcome` capsule event | Unchanged (NG-5): same writer, kind, event key (gate-set identity + head SHA), payload, and non-gating posture; appended on the delivered paths only |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Verification record payload | Delivered EVT-1 shape, unchanged and reused verbatim: change ref, head SHA, verification time, gate-set identity (schema version + id sequence), per-gate verdicts with bounded citations, tracker posture. No new field, no optional member, no schema version change |
| DM-2 | Gate-set identity | Delivered effective identity semantics, now stated as the binding rule: schema version plus the full declared (or shipped-default) entry-id sequence from the shared resolver; surface projections select evaluated entries and payload, never the identity (F-3) |
| DM-3 | Ledger discipline | Unchanged: append-only, fenced, post-append-verified, per-change-ref history; absent/torn/unreadable/incompatible classification feeds the delivered state-failure mapping |

### 8.4 External Integrations

N/A. No provider, vendor, or transport integration changes; the append is a local state write.

### 8.5 Backward Compatibility

- **Ledger compatibility:** records written after this change are byte-shape-compatible with the delivered schema and read path; records written before (dry-run records, any cross-repository records from injected-seam testing) read exactly as delivered. A pre-change ledger with no verification record behaves as delivered: `merge` refuses `state-unverified` until a verification is produced — now by the documented command.
- **Behavioural compatibility:** one observable change is intended — a shipped `verify gates` run persists its record, so the subsequent `merge` lands without the undocumented pre-step. `merge`'s refusal taxonomy gains no member; a failing battery verdict now reaches the landing decision as recorded evidence (truthful refusal through delivered identities) where previously no record existed to read. `verify gates` output, exits, and bounds are byte-identical.
- **Scripted consumers:** no envelope key, exit code, or report field changes; a script keyed on `verify gates` bytes or `merge` refusal identities is unaffected. A script relying on `verify gates` NOT writing to the ledger would observe a new ledger record — the defect being fixed, not a compatibility break.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Read budgets unchanged on every path: `verify gates` keeps its delivered bounded local reads and at most one page or item per provider source plus one configuration-document resolution attempt; `merge` keeps its declared read budget; the persistence adds **0 provider reads** and no new read of any configuration layer | 0 added provider/config reads; delivered budgets hold exactly |
| NFR-2 | Verify-gates output bytes unchanged: human report and machine envelope are golden-identical to pre-change on every delivered outcome (pass, fail, unavailable, narrowed refusal, config refusals); the append produces no output effect | 0-byte golden delta across the full outcome matrix |
| NFR-3 | Merge landing-path latency unchanged in composition: consuming the verify-gates record replaces what a dry-run record provided; no new read or recomposition is added between envelope and landing decision | 0 added reads; ≤ the delivered per-path provider-request peaks |
| NFR-4 | Output and record bounds hold: the persisted record satisfies the delivered record validation; every bounded cap (report machine bytes, human lines/bytes, citation caps, name caps) is unchanged | 100% of delivered bounds intact; no cap widened |
| NFR-5 | Secret-free evidence: no credential, token, title, body, comment, raw payload, or log material in any persisted record or any output; the record carries identity, counts, verdicts, reasons, and posture labels only | 0 secret-bearing members across records and outputs (delivered privacy allowlist unchanged) |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- No new telemetry surface. The durable evidence is the ledger record itself; the capsule `gate.outcome` event continues to carry the non-gating posture disclosure with its delivered event key.
- The narrowed-refusal no-append invariant and the one-record-per-evaluation count are pinned by tests (AC-T1, AC-T4), not by runtime counters.
- Failure observability is delivered behaviour: an append failure surfaces as the verify-gates run's classified state failure (never silence); the merge envelope's refusals carry their inline evidence (age, bound, SHAs, set delta, probe observations) exactly as delivered.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | An accidental verify-gates output change (human bytes, envelope, verdicts) breaks the byte-pinned goldens and the delivered cross-consumers | M | L | F-5/NG-5 declare the append silent; NFR-2 pins a 0-byte golden delta across the outcome matrix; goldens are regenerated only if a declared change requires it — none does here | Low: the surface has strong pre-existing pins |
| RSK-2 | A custom declared `merge.gates` set: the verify-gates record carries the shipped-default identity, the envelope refuses `gates-stale` with the set delta — the native sequence does not land for declarers | M | M | Declared fail-closed (no silent pass); deferred with rationale (§7.3, OQ-1); every AC is declared over the shipped default; documentation states the default-set boundary | Accepted for this change; follow-up owns parity |
| RSK-3 | Record-producer interplay: a `--dry-run` record newer than a `verify gates` record is the one `merge` consumes (newest-record-wins), possibly surprising an operator who ran verify gates last-by-intent | L | M | Delivered semantics kept and documented (F-2/§6 Flow 4): both records carry the same identity; freshness is judged per record; the remediation sequence ("verify gates then merge") re-records on every run, so a stale dry-run record is overwritten by the next verify gates | Low |
| RSK-4 | Recorded battery verdicts become live refusal evidence on the merge path (a failing battery now refuses merge with `recorded` attribution where previously no record existed) — a behaviour change beyond the happy path | L | H | Intended and declared (F-2): truthful evidence; delivered identities and attributions reused; AC fixtures pin the recorded-fail refusal so the taxonomy shift is tested, not discovered | Low: fail-closed direction |
| RSK-5 | Fence contention or append failure on the verify-gates path converts a previously clean run into a state failure | L | L | Delivered discipline: classified failure, never silent, never consumable (F-1); the fence is the delivered one-append-per-record contract the dry-run path already exercises | Low |
| RSK-6 | The cross-repository path's appended record (member-projected verdicts) is consumed by `merge` in ways not separately reasoned | L | L | Delivered shape preserved (member discriminator dropped, order/count preserved, non-torn reads); the identity rule and envelope are member-independent; AC-T4's fixture pins the single-target identity and the counting pin covers the member path | Low |

## 12. ASSUMPTIONS

- The defect is composition wiring, not state-layer capability: the fenced append and verified read are delivered and proven on the merge dry-run path.
- The dependency is satisfied on-base: GH-366 (merge transaction, `ci-green` merge-applicable default, the refusal taxonomy) is merged into the integration base.
- All ticket acceptance criteria are exercised over the shipped default gate set (no declared `merge.gates` configuration), which is the delivered steady state.
- The verify-gates handler already constructs the correct record (identity, head SHA, verdicts, posture) — only the composition's append wiring is missing; no handler logic change is required for option (A).
- The observed session's ledger asymmetry (no record after `verify gates`; record after `--dry-run`) is fully explained by the wiring; no second producer-side defect exists.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-366 (delivered, merged on-base as `f531c057`) | The merge transaction, freshness envelope, `merge.state-unverified` row, and the merge-applicable `ci-green` default this change consumes |
| Depends on | Delivered merge-ledger state family (GH-225) | The fenced, post-append-verified append and per-change-ref verified read the verify-gates composition now supplies |
| Depends on | Delivered shared gate-set resolver (GH-225/GH-366) | The one resolver whose full-declared-sequence identity both surfaces carry (F-3) |
| Depends on | Delivered verify-gates runtime append seam (GH-178/GH-300/GH-310) | The seam the handler already calls; its production wiring is the fix |
| Blocks | Documentation of the native merge sequence (engine-first operations guidance) | The ticket names this documentation as blocked by GH-388; the sequence documented there must be the one that lands |
| Blocks | M4 native-delivery milestone flow | The documented pre-merge verification surface must produce the evidence `merge` consumes for the milestone's interactive delivery mode |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the verify-gates surface resolve the declared `merge.gates` configuration (surface parity) so a custom declared set works end to end through the native sequence? | Code truth: the production verify-gates composition resolves only the shipped default set, while `merge` resolves the declaration; under a custom set the record's identity cannot equal the effective one and the envelope fail-closes with the set delta (RSK-2). Every ticket AC is declared over the shipped default, and parity would change which gates the battery evaluates for declarers — a scope the ticket does not authorize | Deferred to a follow-up change; not blocking this one. Decision needed: consult `@decision-advisor` only if delivery or review judges the declared-set case blocking for M4 |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Mechanism = option (A): `verify gates` persists the `merge.gate-verification` record it computes (production composition supplies the delivered fenced append); `merge` consumes it. Option (B) is rejected — `merge` never composes its own verification when no record exists | Ticket-delegated choice ("choose one, declare it"); PM indication 2026-11-23. Drivers: both current-truth specs already declare A-shaped truth, so (A) converges runtime to spec; the record is `verify gates`' own output and a printed-but-unrecorded verification is not evidence (the ticket's own framing); (A) makes the refusal remediation truthful. (B) keeps `verify gates` non-evidencing and doubles the verification composition on the landing path | 2026-11-23 |
| DEC-2 | Identity rule = total equality of the gate-set identity, both sides being the schema version plus the full declared (or shipped-default) entry-id sequence resolved by the one shared resolver; surface projections select evaluated entries and the record's verdict payload, never the identity; no projection, superset, or delta-tolerant rule is introduced | Code-grounded: both record producers already carry the full-declared-sequence identity from the same resolver, so the delivered envelope accepts a verify-gates record without any new tolerance; a projection-based rule would invent envelope semantics the shipped code does not have and would make `--dry-run` records (which also carry the full identity) incoherent. The five built-in ids stay reserved and mandatory; `tracker-freshness` stays merge-only; disagreements fail closed as `gates-stale` with the set delta | 2026-11-23 |
| DEC-3 | The verify-gates append is silent: no human line, no machine field, no exit-code change; goldens are untouched (NFR-2) | The current-truth merge specification already declares "the append is the only output effect"; declaring output change here would force deliberate golden regeneration for zero operator value | 2026-11-23 |
| DEC-4 | The `merge.state-unverified` remediation is pinned byte-exactly by test to the working sequence; the shipped text already names that sequence under option (A), so no textual change is required by the defect — refinement is optional and property-preserving | Code truth: the shipped remediation reads "Produce the verification with `verify gates <ref>` for the same work item, then re-run; the verification state is absent, torn, or incompatible." — once (A) is wired, this is the exact working sequence. The briefing's expectation that the content must change is not supported by the shipped text; the new obligation is the pin | 2026-11-23 |
| DEC-5 | All acceptance criteria are declared over the shipped default gate set; custom-declared-set surface parity is deferred (§7.3, OQ-1, RSK-2) with fail-closed behaviour declared | The ticket's ACs are default-set scenarios; parity would alter battery selection for declarers — a scope the ticket does not authorize and PM scope lines exclude | 2026-11-23 |
| DEC-6 | Documentation strategy: the two feature specifications already declare the (A) truth, so phase-7 reconciliation verifies and sharpens their wording (identity rule, consumption semantics, remediation truth) rather than reversing it; the engine-first operations guidance's native sequence is rewritten to the converging path; the merge/verify-deploy test specification gains the new coverage rows | The divergence is runtime-behind-spec; documentation leads, runtime converges, and the phase-7 pass records the identity rule declared here | 2026-11-23 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Production verify-gates command composition | Updated — supplies the delivered fenced, post-append-verified merge-ledger append as the runtime's append seam; the one broken wiring point; no handler or report change |
| Verify-gates command handler (single-target and cross-repository paths) | Unchanged — already constructs the complete record and calls the append seam; narrowed-refusal and config-refusal no-append ordering preserved |
| Verify-gates report surface (human bytes, machine envelope, verdicts, citations) | Unchanged — byte-identical (F-5, NFR-2); the append adds no output |
| Merge transaction freshness envelope | Unchanged in code — its delivered identity/head/age checks are the declared consumption rule; pinned by new fixtures for the battery-surface record |
| Merge landing decision (recorded-verdict consumption) | Pinned — existing behaviour over verify-gates records: recorded `ci-green` not-green refuses with `recorded` attribution; recorded battery built-in fails refuse via the per-gate family; `tracker-freshness` freshly evaluated; a clean PR lands |
| `merge --dry-run` | Unchanged — keeps appending its merge-applicable record; coherent under the identity rule (newest-record-wins) |
| Merge-ledger state family (append, read, validation, fences) | Unchanged — the delivered fenced append and verified read are consumed as-is |
| Error table (`merge.state-unverified` row) | Pinned — same row, same identity; remediation content pinned by test to the working sequence (F-4); no new rows |
| Capsule `gate.outcome` append | Unchanged (NG-5) |
| Feature specification "Verify Gates" | Reconcile in phase 7 — persistence/consumption wording now runtime-true; identity-rule statement; read budget confirmed unchanged |
| Feature specification "Merge and Verify Deploy" | Reconcile in phase 7 — envelope acceptance of battery-surface records; recorded-verdict consumption; remediation truth; surface-projection-vs-identity statement |
| Engine-first operations guidance | Updated in phase 7 — the native merge sequence becomes `verify gates <ref>` → `merge <ref>`; `--dry-run` documented as an evaluation-only surface, never a required pre-step (the ticket's blocked documentation) |
| Test specification "Merge and Verify Deploy" | Updated — coverage rows for persistence counting, consumption/identity fixtures, remediation pin, clean-PR landing, byte-identical goldens |

## 17. ACCEPTANCE CRITERIA

Ticket-AC trace keys: `AC-T<n>` maps 1:1 to ticket AC `<n>` (Appendix B). Linked ids are this specification's capabilities and NFRs.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-T1-1 | **Given** a clean PR for `<ref>` (open, non-draft, mergeable, targeting the integration base, green CI, no owner-attention labels, resolved full-SHA head, positive commit/changed-file counts) and the shipped default gate set with a passing lifecycle read, **when** the shipped production `verify gates <ref>` runs (injected transports, real state store), **then** it exits 0 with the delivered byte-identical report and the ledger contains exactly one new `merge.gate-verification` record for `<ref>`, fenced and post-append-verified; **and when** `merge <ref>` then runs with no intervening step, **then** it lands (`result=merged` with the provider squash SHA) with no `merge.state-unverified` refusal and no `--dry-run` invocation anywhere in the sequence | F-1, F-2, F-3, NFR-1, NFR-2 |
| AC-T2-1 | **Given** option (A) is the declared mechanism (DEC-1), **when** `merge <ref>` runs with no prior verification record for `<ref>` in the ledger, **then** it refuses `merge.state-unverified` at exit 2 with `state=absent` exactly as delivered — option (B) composition (merge fabricating a verification) is asserted absent: zero verification appends, zero gate evaluations, and no landing occur on that refusal path; **and when** the operator follows the remediation (`verify gates <ref>` then `merge <ref>`), **then** the sequence converges and lands per AC-T1-1 — so the ticket's alternative-branch condition is satisfied by the declared mechanism's fail-closed path, never by an undocumented pre-step | F-2, F-4, DEC-1 |
| AC-T3-1 | **Given** the delivered `merge.state-unverified` error-table row, **when** its remediation content is read and when the refusal is rendered in text mode, **then** the remediation names `verify gates <ref>` (the same work item) as the producing step and the `merge` re-run as the consuming step, and names no sequence that cannot resolve the refusal — in particular `merge --dry-run` never appears as a required pre-step; **and** a test pins the remediation content byte-exactly, failing on any wording that drops the producing command, drops the re-run, or introduces a non-working step | F-4, DEC-4 |
| AC-T4-1 | **Given** a fixture ledger seeded by a shipped `verify gates` run for `<ref>` at head `H`, **when** the merge read for `<ref>` is served (the delivered per-change-ref verified read over the verification key) and the freshness envelope evaluates, **then** the record is resolved by its persisted identity — record key `merge.gate-verification:<changeRef>`, payload `changeRef == <ref>`, payload `headSha == H` — and the envelope accepts it when the merge-resolved request's asserted head equals `H`, the age is below the declared bound, and the gate-set identity equals the effective identity (schema version + full declared id sequence, order included); **and when** the fixture mutates any one of those three (head `H'`, elapsed age at/above the bound, or a one-id identity delta), **then** the envelope refuses with the corresponding declared reason (`head-sha` / `age` / `gate-set` with the set delta) and never consumes the record; **and** exactly one record exists per full battery evaluation that is not refused for narrowed suite breadth, and a narrowed-scope refusal appends neither record nor capsule event | F-1, F-3, NFR-4 |
| AC-T5-1 | **Given** the delivered verify-gates battery and its goldens, **when** the shipped composition change is in place and the full outcome matrix runs (pass; each fail reason class; unavailable; narrowed-scope refusal; each config refusal; cross-repository member evaluation), **then** every human line, machine envelope key, verdict, citation, ordering, and exit is byte-identical to pre-change (0-byte golden delta), the delivered read budget holds with **0 added provider reads** and **0 added configuration reads**, and no record, output, or capsule payload carries credential, token, title, body, comment, or raw payload material (privacy allowlist unchanged); **and** the five gates' delivered regression fixtures pass unchanged | F-5, NFR-1, NFR-2, NFR-5 |
| AC-T4-2 | **Given** a failing battery (a not-green `ci-green` or a failing battery-only built-in) recorded by a shipped `verify gates` run, **when** `merge <ref>` runs within the freshness envelope at the same head, **then** it refuses through the delivered identity for that gate with the `recorded` attribution naming the gate id and reason — the recorded failing verdict is truthful evidence, never silently passed; **and when** a passing `verify gates` run is followed by a fresh tracker change observed at the probe, **then** `tracker-freshness` refuses per the delivered transition rule | F-2, RSK-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Single change, no flag, no configuration.** The defect and its correction are one behaviour; a toggle would leave the remediation loop reachable. No operator migration or data repair: pre-existing ledgers read as delivered, and the first `verify gates` run after the change produces the evidence the next `merge` consumes.
- **Proof before merge.** The clean-PR landing case, the persistence-count and narrowed-no-append pins, the identity fixture (AC-T4-1's accept plus all three refusal mutations), the remediation byte-pin, the recorded-fail consumption pin, the no-option-B assertion, and the byte-identical goldens must be green in the aggregate gate before review.
- **Branch, target, and stop state.** The change is delivered on its own branch per the repository's branch convention for this ref, with the PR targeting the tooling integration branch and left open for merge authority; commits flow through the repository's commit primitive; gate evidence uses the declared scratch-directory convention.
- **Version metadata — declared now, not deferred.** One lockstep changeset declaring the five fixed-group packages — `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode` — at **minor** (the landed precedent for cross-cutting CLI-behaviour changes, GH-377/GH-381/GH-384; confirmed against this change's scope: composition behaviour in the CLI package over the core state family). Declared at specification time so the plan and delivery phases use the format directly.
- **Communication.** The observable change is exactly the documented workflow starting to work: `verify gates` then `merge` lands a clean PR. The phase-7 documentation pass is the announcement surface; no separate operator notice is required.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No schema change, no record-shape change, no key change, no migration, back-fill, or seeding. Existing ledgers — including any holding only dry-run records — read exactly as delivered; the newest-record-wins rule is untouched. Reverting the behaviour requires no state repair: the ledger gains only records the delivered schema already defines.

## 20. PRIVACY / COMPLIANCE REVIEW

No personal data is collected, derived, or exposed. The persisted record carries identity references (change ref, head SHA), timestamps, verdicts, reasons, aggregate counts, bounded name lists (job names, label values), and tracker posture labels — the same members the dry-run record already persists — under the delivered citation bounds. The change adds zero new data categories, zero provider reads, and zero output surface; the secret-free requirement is pinned (NFR-5, AC-T5-1) against the delivered privacy allowlist. The evidence becomes more durable, not broader: what was printed and discarded is now ledger-contained under the existing schema.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Write surface, not read surface.** The one new capability is a local state append under the delivered fence: fenced, post-append-verified, classified on failure. No network call, credential read, or environment read is added to any path (NFR-1).
- **Fail-closed on every divergence.** An identity mismatch, head mismatch, or elapsed bound refuses the landing with inline evidence; an append failure is a classified state failure and never consumable; an unresolved checkout head records an empty SHA that the envelope can never accept. No divergence is absorbed silently.
- **No authority change.** Waivers, owner-gate classes, and the landing guard are untouched; the change does not alter who may authorize what — only which previously-discarded evidence the landing decision can read.
- **No new vocabulary to misuse.** No new error identity, record kind, or schema version; the refusal taxonomy is unchanged, so no new spoofable surface exists.
- **Residual risk is low-to-medium**, dominated by RSK-2 (declared-set fail-closed boundary), which is deferred with rationale and cannot fail open.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Phase-7 reconciliation is mandatory.** Documentation targets: the Verify Gates feature specification (persistence/consumption wording now runtime-true; the identity rule; read budget confirmed), the Merge and Verify Deploy feature specification (envelope acceptance of battery-surface records; recorded-verdict consumption; remediation truth; projection-vs-identity statement), the engine-first operations guidance (native sequence `verify gates` → `merge`; `--dry-run` as evaluation-only — the ticket's blocked documentation), and the merge/verify-deploy test specification (coverage rows for the new pins). Known risk if skipped: the next reader treats the dry-run step as required and re-derives the loop (RSK-3).
- **Support semantics sharpen.** `merge.state-unverified` after this change means "no verification was produced (or the state is damaged)" — and the remediation resolves it. `merge.gates-stale` with a `gate-set` delta on the shipped default becomes a diagnostic signature of either a declared-custom-set operator (RSK-2, documented) or a genuine declaration drift.
- **The evidence chain is now closed.** The documented verification surface produces the durable record the landing decision reads; audit conversations can cite the ledger record instead of terminal scrollback.
- **No new operational surface.** No configuration key, command, flag, or state document is added; the operator's mental model changes in one respect: the documented sequence works.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Gate-verification record | The `merge.gate-verification` ledger record (EVT-1, DM-1): change ref, head SHA, verification time, gate-set identity, per-gate verdicts with bounded citations, tracker posture |
| Append seam | The verify-gates runtime's injected append capability the handler calls after evaluation; its composition default is a no-op — the defect's location |
| Fenced, post-append-verified append | The delivered write contract: read-before, fence acquisition, append, read-after equality and count verification, fence release |
| Freshness envelope | The merge-side acceptance rule over the newest record: readable, age below the bound (at-bound stale), head SHA equality, gate-set identity equality |
| Gate-set identity | Schema version plus entry-id sequence; the effective identity is the full declared (or shipped-default) sequence resolved by the shared resolver (F-3) |
| Surface projection | `batteryEntries` (what `verify gates` evaluates) and `mergeEntries` (what `merge`/`--dry-run` evaluate); selects evaluation and verdict payload, never identity |
| Battery-surface record | A gate-verification record produced by `verify gates`, whose verdict payload carries the battery entries; identity identical to a dry-run record's under the shipped default |
| `recorded` attribution | The refusal evidence class meaning the persisted verdict already reported the finding (vs `probe`: the recorded verdict was green and the fresh probe observed it) |
| Option (A) / option (B) | The ticket's two mechanisms: (A) `verify gates` persists and `merge` consumes; (B) `merge` composes its own verification when no record exists. (A) is declared (DEC-1); (B) is rejected |
| Native merge sequence | The documented operator path: `verify gates <ref>` → `merge <ref>`; after this change it lands a clean PR with no intermediate step |
| Clean PR | The AC fixture posture: open, non-draft, mergeable, targeting the integration base, green CI, no owner-attention labels, resolved full-SHA head, positive commit/changed-file counts |

## 24. APPENDICES

### Appendix A — Code-truth findings underpinning the declared option and identity rule

- **The broken seam.** The verify-gates command handler builds the complete verification record and calls its runtime append seam on both the single-target and cross-repository paths, after the narrowed-scope check and before the verdict projection — exactly where both feature specifications declare the append. The shipped production composition creates the verify-gates runtime without supplying that seam; the composition default is a no-op whose own documentation says "absent leaves the evaluation unrecorded". The merge command composition, composed separately, wires the identical state append — the observed ledger asymmetry's complete explanation. The state layer's append and read are delivered, fenced, and covered by tests that inject the seam; every existing proof of the append exercises the seam, never the shipped wiring.
- **The identity truth.** Both record producers resolve their gate set through the one shared resolver. The identity each carries — and the only identity the envelope compares — is the schema version plus the full declared (or shipped-default) entry-id sequence. The surface projections determine the evaluated entries and the record's verdict payload (battery entries vs merge-applicable entries), and the envelope never inspects that payload for identity purposes. Under the shipped default the two identities are exactly equal, so option (A) introduces no `gates-stale` flip and requires no tolerance rule.
- **The remediation truth.** The shipped `merge.state-unverified` remediation text already names the working sequence under option (A); the ticket's third requirement is satisfied by pinning it, not by rewriting it.
- **A latent seam surfaced (deferred).** The production verify-gates composition resolves only the shipped default gate set, while `merge` resolves the declared `merge.gates` configuration; under a custom declared set the recorded identity cannot equal the effective one and the envelope fail-closes with the set delta. Recorded as deferred (§7.3) with OQ-1 and RSK-2.

### Appendix B — Ticket acceptance-criteria traceability

| Ticket AC (GH-388, verbatim intent) | Spec criterion | Notes |
|--------------------------------------|----------------|-------|
| 1. After `verify gates <ref>` on a CLEAN PR, `merge <ref>` lands (no `--dry-run` pre-step required) if (A). | AC-T1-1 | Declared mechanism is (A) (DEC-1); the no-dry-run property is asserted positively (landing) and negatively (no state-unverified refusal) |
| 2. With no prior verification, `merge <ref>` lands if (B). | AC-T2-1 | (B) is rejected (DEC-1); the criterion pins the declared mechanism's fail-closed path (state-unverified refusal, zero composition, zero appends) and the converging remediation sequence, so the ticket's alternative branch is traceably resolved rather than silently dropped |
| 3. The refusal remediation names the working sequence, pinned by a test. | AC-T3-1 | Byte-exact pin; `--dry-run` never a required pre-step (F-4, DEC-4) |
| 4. A fixture pins the persisted record's identity (changeRef + headSha) against the merge read. | AC-T4-1 | Key + payload identity vs the merge read; envelope accept plus the three declared refusal mutations; counting and narrowed-no-append pins included |
| 5. `verify gates` remains bounded and secret-free (no behavioural regression of its 5 gates). | AC-T5-1 | 0-byte golden delta, 0 added reads, privacy allowlist unchanged, five-gate regression fixtures unchanged (F-5, NFR-1/2/5) |

### Appendix C — Observed evidence (corroboration, not a test dependency)

- PR #387 (GH-366), 2026-11-23T05:29Z: two passing `verify gates` runs, then the `merge.state-unverified` refusal (`state=absent`, remediation naming `verify gates`), then the record appearing only after `merge --dry-run`, then a plain `merge` landing as `f531c05`. The ledger confirmed no `merge.gate-verification` record existed between the verify-gates runs and the dry run.
- The defect reproduces on both the branch build and the installed build of the session, ruling out a local-build artifact.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-23 | @spec-writer (GLM-5.3-Flash) | Initial specification: option (A) declared, total identity rule declared, remediation pinned, ACs traced 1:1 to the ticket's five |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-388 (verbatim ACs, mechanism delegation, scope lines), the GH-388 pm-notes (intake, clarify-scope divergence note, identity seam note, PM mechanism indication), the two current-truth feature specifications, the merge-ledger state contracts, the merge transaction domain (envelope, gate-set resolution, recorded-verdict consumption, refusal taxonomy), the verify-gates command handler and runtime contracts, the production composition, the error table, the engine-first operations guidance, and the merge/verify-deploy test specification.
- Approach: code truth was pinned before declaring (both spec seams the PM briefing flagged were resolved from the shipped composition and the shared resolver, per Appendix A); the mechanism choice is declared formally (DEC-1) with the identity rule declared total (DEC-2); the ticket's five ACs are traced 1:1 with the alternative-branch AC resolved through the declared mechanism rather than dropped (AC-T2-1, Appendix B).
- Constraints honored: no implementation tasks or file paths (component-level names only); no content duplicated verbatim from linked docs; PM-owned artifacts (pm-notes, phase state, capsule) untouched; out-of-scope items prefixed `[OUT]`; NFRs quantified; risks carry Impact/Probability/Mitigation/Residual.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-388)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, NFR-, RSK-, DEC-, DM-, EVT-, OQ-, AC-, NG-, G-)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
