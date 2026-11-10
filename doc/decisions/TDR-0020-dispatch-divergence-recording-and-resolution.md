---
ados_distribution: project-generated
id: TDR-0020
decision_type: tdr
status: Proposed
created: 2026-11-10
decision_date: null
last_updated: 2026-11-10
summary: "Record at most one open, locally resolvable delivered-evidence divergence per (repository, work-item ref) when a dispatch delivered locally evidenced work but could not read truth — amending four TDR-0015 assertions of the old rule (three in §1, one in §5) for that case only, as an additive amendment link rather than a supersession — and keep dispatch dual-run resolve on local evidence alone: no credential, no network, a distinguishable internal not-found sentinel mapped to input.value.rejected instead of reusing state.keys.missing, genuine store faults carried under kind state with their own identities, and the note clamped to 240 characters before the record is built; closure is attestation-dischargeable by that note."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os dispatch engine divergence ledger and handover gate
decision_scope: repo
review_date: null
classification:
  domains: [tooling, operations, security]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@pm (change GH-279, decisions D2/D3 recorded in chg-GH-279-pm-notes; analysis and record by @decision-advisor)"
  decider: "Juliusz Ćwiąkalski (owner) — acceptance pending at the GH-279 PR review; TDR-0015 is itself Proposed, so this additive amendment takes effect only if the owner accepts both Proposed records at that review; the AI does not accept either record"
  contributors:
    - "@spec-writer (chg-GH-279-spec DEC-2, DEC-3, DEC-7; F-3, F-4; DM-2, DM-3, DM-5; Appendix B)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "@decision-critic (independent challenge recommended: this record amends durable gate semantics)"
    - "Human owner (GH-279 PR review)"
  performers:
    - "@test-plan-writer (recording, replay, resolve-identity, and note-bound oracles)"
    - "@plan-writer (recording step and resolve diagnostics)"
    - "@coder (delivery per spec and plan)"
  informed:
    - "M1-S9 operational owners (the gate's truth condition changes shape for unverifiable deliveries)"
    - "Operators who resolve divergences (`dispatch dual-run resolve`)"
    - "Gate and summary consumers (unresolved counts move for new attempts only)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A consumer needs an unverifiable-but-delivered attempt to block the window permanently rather than until it is resolved: that is a change to the TDR-0015 bar, not a resolve-path adjustment."
  - "Delivered evidence needs a source other than the local phase ledger (for example a credential-free tracker read): reopen the delivered-evidence definition and its amendment scope."
  - "The divergence population grows without bound on a provisioned install — a second open delivered-evidence divergence for the same (repository, work-item ref), a divergence per retry or resume, or an unresolvable divergence: reopen the per-work-item at-most-one rule and the adequacy of the admission preflight that keeps this population small."
  - "A resolve failure is reported with any token other than the failing store identity, the not-found sentinel is confused with a store key-set failure, or a note is rejected for length instead of clamped: reopen the resolve diagnostics decision."
  - "The owner requires evidence-bound closure of a delivered-evidence divergence instead of a clamped free-text note: that is a deliberate reversal of the accepted attestation-dischargeable posture, not a resolve-path adjustment."
  - "The closed dispatch read-family set gains or loses a member: the bounded `truth:unreadable:<reason>` vocabulary and the recorded reason must be re-derived."
  - "TDR-0015 is accepted with different wording for any of the four amended assertions, or the owner accepts only one of the two Proposed records at the GH-279 PR: this additive amendment must be reconciled with that wording or carried by a successor record before it is relied on."
links:
  related_changes: ["GH-279"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-10--GH-279--dispatch-credential-preflight/chg-GH-279-spec.md"
  contracts:
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/contracts/delivery-result.ts"
  diagrams: []
  decisions: ["TDR-0015", "TDR-0005", "TDR-0010"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S9"]
---

# TDR-0020: Dispatch Divergence Recording and Resolution — Delivered-Evidence Divergence (TDR-0015 Amendment) and Local-Evidence-Only Resolve

## Context

- **FACT:** TDR-0015 asserts the old "no divergence" rule in **four places**, not two: §1 `Truth(W)` ("a divergence exists only when a comparison outcome is `mismatch`; a not-applicable comparison is never a divergence"), §1 `Coverage(W)` (a `state-unverified` attempt "creates no divergence"), §1 record-level degradation ("it does not create a divergence"), and §5 ("a divergence record is appended iff `outcome = "mismatch"`. `match` and `not-applicable` never create a divergence"). TDR-0015 is itself `Proposed` (`doc/decisions/TDR-0015-dispatch-handover-gate-operational-semantics.md`).
- **FACT:** The delivered closed dispatch read-failure set is `["ledger", "tracker", "artifact", "state"]`; there is no `ci` read family (`packages/core/src/domain/dispatch-result.ts`, `DISPATCH_READ_FAILURE_SOURCES`).
- **FACT:** The delivered engine implements exactly that: a divergence is appended only when the comparison outcome is `mismatch` (`packages/core/src/app/dispatch.ts`; an unverifiable attempt carries the exposure-only `not-applicable` comparison). An attempt that delivered work but could not be verified therefore leaves no record at all.
- **FACT:** The harness completion fact lives on the shared classifier's result (`classification.outcome === "completed"`), not on the persisted attempt record: the attempt record is written with `outcome: derivation.outcome`, and for `state-unverified` that derived outcome is `failed` (`packages/core/src/app/dispatch.ts`; `packages/core/src/domain/dispatch-result.ts`). Delivered evidence must therefore be evaluated from the classifier result and the readable ledger, not from the persisted attempt record's `outcome`.
- **FACT:** `dispatch dual-run resolve` reaches the store through `resolveDispatchDivergenceEvidence`, which maps **every** store failure other than `state.keys.missing` to `dispatch.state-unverified`, and maps `state.keys.missing` (misused as "divergence identifier not found") to `input.value.rejected` (`packages/core/src/app/dispatch-gate.ts`, `resolveDispatchDivergenceEvidence` and `resolveAppend`). `state.keys.missing` is also a genuine store key-set failure, so the not-found branch is indistinguishable from a store fault today.
- **FACT:** Classification is kind-and-code exact: `classifyDomainKind(kind, code)` throws unless the code's table row has that `domainKind`, and a thrown classification is contained as `fallback.internal`. A `{ kind: "dispatch", code: "state.lock.busy" }` pair therefore loses the state identity; a state code must carry `kind: "state"` (`packages/cli/src/classify.ts`; `packages/core/src/contracts/error-table.ts`).
- **FACT:** The resolve runtime is composed with store, fence token, and principal only — no credential port, no transport, no truth read. Resolve resolves no credential by construction (spec §2.1; `dispatch-gate.ts` input shape).
- **FACT:** The note bound is declared once (`DISPATCH_MAX_NOTE_CHARS = 240`, `packages/core/src/contracts/dispatch.ts`). The ledger's own resolution helper clamps the note before building the resolved record (`packages/core/src/app/dispatch-ledger.ts`, `resolveDispatchDivergence`), while the record validator rejects a note longer than the bound (`isDivergenceRecord`). The gate resolution path builds its record from the raw note (`packages/core/src/app/dispatch-gate.ts`, `resolveAppend`), so an over-long note is rejected as `state.write.failed` and that failure is then relabelled `dispatch.state-unverified` (spec §2.1).
- **FACT:** The closed state vocabulary already carries the identities a store fault actually produces: `state.lock.busy`, `state.store.torn`, `state.write.failed`, `state.storage.exhausted`, `state.schema.mismatch`, `state.permission.denied` (`packages/core/src/contracts/error-table.ts`).
- **FACT (observed 2026-11-10):** `dispatch dual-run resolve DIV-GH-275-79416392-c1c4-48a0-997e-1f6409daa7df --note …` returned `dispatch.state-unverified`, while `dispatch dual-run summary --repo …` exited `0` reporting `unresolved: 1` — the same local store read successfully on both commands, so the resolve failure was neither a credential failure nor an unreadable store (spec §2.1).
- **Trigger:** GH-279. A real dispatch (GH-241) delivered complete phases and an open PR while reporting `state-unverified`, and the divergence it ought to have left behind could neither be listed nor closed; a second observed resolve failure then blamed the truth-read token for a local fault. Both are diagnostic-honesty defects in the same ledger.

## Problem Framing (Clarified)

Two different conflations sit behind the symptoms.

**Conflation 1 — a local fault reported as a truth-read verdict.** `dispatch dual-run resolve` resolves no credential and reads no truth, so `dispatch.state-unverified` cannot describe anything it does. It appears because a defensive catch relabels every store failure it does not specifically recognize. The consequence is not cosmetic: the real remedy (release the lock, repair the torn store, fix permissions, make space) becomes unreachable, and a security-sounding prerequisite is blamed for a local write/read fault. The fix cannot be "give resolve a credential" — resolve has nothing to verify. It is to stop collapsing identities, and to stop letting an unbounded input turn into a write failure that is then mislabelled.

**Conflation 2 — absence of evidence treated as nothing to record.** An attempt whose harness completed and whose local phase ledger shows progress has *delivered*, even if its truth could not be read. Today that attempt is exposure-only: it is invisible in the one count that governs handover ("unresolved divergences"), so the ledger reports a clean zero it has not earned. Silence here is not neutrality — it is a false zero, and it is the exact shape of the gate-reachability problem the change's predecessor fixed in the other direction (TDR-0015 §1's "creates no divergence" was correct for a bare `state-unverified`; it is wrong for one that demonstrably delivered).

The decision question is therefore two-part: **when truth cannot be read after a session that demonstrably delivered, what obligation must the ledger record — and on what evidence may that obligation be discharged?** The answer must keep the TDR-0015 bar strict, keep it reachable, reuse the delivered vocabulary, and let an operator close the obligation with no credential at all.

The discharge posture is deliberately attestation-based: the obligation is closed by a **free-text note clamped to 240 characters**, and **no evidence reference is required**. That keeps closure payable on an unprovisioned install, but it means the ledger records *that someone closed it*, not that truth was re-read or independently proven. This is an accepted residual, not an implied evidence-bound closure.

TDR-0015 is itself `Proposed`. The repository guide defines `Accepted`, `Deprecated`, and `Superseded` but no additive-amendment convention; this record therefore uses an **additive amendment link**, not supersession, and it can take effect only if the owner accepts both Proposed records at the GH-279 PR.

Out of scope: the delivery-result taxonomy, the projection and exit tables, the four-condition gate predicate, evidence classes, window and floor rules, comparison families, repository identity, and authority semantics — all unchanged. Also out of scope: backfilling historical attempts, and closing the pre-existing `DIV-GH-275-…` divergence that supplied the evidence.

## Constraints (Hard Requirements)

### C-1: Resolution is local-only

- **Statement:** `dispatch dual-run resolve` performs 0 credential resolutions, 0 network calls, and 0 truth reads; it reads only the local state store and the divergence ledger.
- **Source:** AC (AC-F3-1, F-3.1, DEC-2, NFR-7)
- **Verification:** test (spy credential and transport ports assert zero invocations on every resolve path)
- **Negotiable:** no

### C-2: No diagnostic collapse on the resolve path

- **Statement:** Every local store failure surfaces its own typed state identity with that row's category, retryability, consequence, remediation, and projection (`state.lock.busy`, `state.store.torn`, `state.write.failed`, `state.storage.exhausted`, `state.schema.mismatch`, `state.permission.denied`, …), carried as `kind: "state"` with that code so `classifyDomainKind` accepts the pair. The resolve path never produces `dispatch.state-unverified`. An identifier absent from the ledger is the **internal not-found sentinel `divergence-not-found`** — a local resolve reason, not an error-table code — and not `state.keys.missing` (which remains a genuine store key-set failure); the sentinel maps to `input.value.rejected` with `kind: "input"` and appends nothing. No new error-table identity is introduced.
- **Source:** AC (AC-F3-2, AC-F3-3, AC-F3-5; F-3.2/F-3.3, DM-5, DEC-7, NFR-14) + internal standard (`packages/cli/src/classify.ts`)
- **Verification:** test (one case per store identity, asserting kind + identity + projection + exit; a distinct not-found case; a classification test proving a state code under the wrong kind would fall to `fallback.internal`) + error-table sync check
- **Negotiable:** no

### C-3: The note is clamped before the record is built

- **Statement:** The resolution note is clamped to the declared 240-character bound on every resolution path before the record is built and validated, so an over-long note can never become a write failure. Bounded diagnostics hold: resolution note ≤ 240, `last_message` ≤ 512, ≤ 16 evidence references per record.
- **Source:** AC (AC-F3-4; F-3.4, NFR-5, NFR-11)
- **Verification:** test (over-long note lands, stored note length ≤ 240, no `state.write.failed`)
- **Negotiable:** no

### C-4: A divergence is opened on mismatch — plus one declared delivered-evidence exception

- **Statement:** A divergence is appended when a comparison outcome is `mismatch`, **or** when the attempt carries delivered evidence and a truth read was unreadable. The delivered-evidence exception opens **at most one OPEN delivered-evidence divergence per (repository, work-item ref)**, identified by its shape (`comparisonClass: "not-applicable"`, `engineToken: "state-unverified"`, `comparisonToken: null`, and a `truth:unreadable:<reason>` evidence reference): a resume or another unverifiable delivered attempt for the same work item reuses and references the existing open one instead of appending a second, and a new one may be opened only after the previous one is resolved. An unrelated open `mismatch` divergence does not suppress recording. A replay of an already-recorded attempt appends nothing, even after its divergence is resolved; a new attempt after resolution may open one. No divergence is opened when delivered evidence is not established.
- **Source:** AC (AC-F4-1, AC-F4-3, AC-F4-4; F-4.2/F-4.5/F-4.6, DEC-3) + prior decision (TDR-0015, amended by this record)
- **Verification:** test (per-work-item recorded-once, resume-reuses-open, new-after-resolved, replay-noop, absent-evidence negative)
- **Negotiable:** no

### C-5: Delivered evidence is local and credential-free

- **Statement:** "Delivered evidence" is established only by facts that require no credential, evaluated at record time from the **shared classifier's** result and the **readable ledger as produced**: `classification.outcome === "completed"`, the phase ledger is readable, and the ledger shows progress (`ledger.progressed`) or a complete ledger (`ledger.total > 0` and `completed === total`). The persisted attempt record's derived `outcome` is **not** an evaluation input: for `state-unverified` it is `failed` even when the harness completed.
- **Source:** AC (F-4.1, A-4) + internal standard (`packages/core/src/app/dispatch.ts`; `packages/core/src/domain/dispatch-result.ts`)
- **Verification:** test (each conjunct falsified independently yields no divergence; a `state-unverified`-but-completed case records a divergence despite the persisted attempt `outcome: failed`)
- **Negotiable:** no

### C-6: The amendment is scoped and does not rewrite history

- **Statement:** **Four TDR-0015 assertions of the old rule are amended** — §1 `Truth(W)` (the not-applicable-comparison clause), §1 `Coverage(W)` ("creates no divergence"), §1 record-level degradation ("does not create a divergence"), and §5 ("appended iff `outcome = "mismatch"`") — for the delivered-evidence case only. Every other gate condition — class coverage as exposure, record- versus window-level degradation, comparison families, evidence classes, the incident-exclusive window, the UTC floor, corroboration rules, repository identity, and append-only per-repository authority — is unchanged. TDR-0015's decision text and history are not rewritten; each affected assertion carries an additive amendment note linking here.
- **Source:** prior decision (TDR-0015, itself `Proposed`) + internal standard (`doc/guides/decision-records-management.md` §4 immutability, lifecycle, and supersession)
- **Verification:** audit (this record + the four additive notes in TDR-0015) + test (gate suite unchanged apart from the amended cases)
- **Negotiable:** no

### C-7: The obligation is traceable and locally dischargeable

- **Statement:** The recorded divergence carries `attempt:<attemptId>` and one bounded `truth:unreadable:<reason>`, the attempt carries that `divergenceRef` (the existing open one when reused), the summary lists the divergence and counts it as unresolved until it is resolved, and resolving it appends one resolved record with a **free-text note clamped to 240 characters** and reduces the unresolved count by exactly one without rewriting the original. **No evidence reference is required to resolve**; closure is attestation-dischargeable by the note.
- **Source:** AC (AC-F4-1, AC-F4-2; F-4.3/F-4.4/F-4.7/F-4.8, DM-2, DM-3, A-7)
- **Verification:** test (summary count before/after, original record byte-identical, idempotent replay, note-only closure accepted)
- **Negotiable:** no

> **Table stakes:** the TDR-0005 token vocabulary, projections and exits; the TDR-0010 dispatch-session projection (including `outcome` beside `partial`); the existing divergence record kind and payload schema version; the append-only ledger and its validator; and the zero-model-call bounded summary. Every eligible alternative satisfies them and they are not scored again.

## Decision Drivers

1. **Honest counting** — the unresolved-divergence count is the gate's truth unit; a delivered-but-unverified attempt that records nothing produces a false zero (G-4, PP-5).
2. **Diagnostic accuracy** — a readable local store must never be reported as an unreadable credential or a truth failure; the operator must see the fault that actually occurred and its remedy (PP-4).
3. **Local dischargeability** — an obligation that requires a credential to close is a debt an unprovisioned install cannot pay; resolution must need nothing but the ledger and a clamped free-text note, with no evidence reference required (G-3, A-7).
4. **Bar reachability without weakening it** — the truth condition must be satisfiable on a default install once admission is fixed; the new population is bounded to at most one OPEN divergence per (repository, work-item ref) and disappears as obligations are resolved (PP-6, RSK-5).
5. **Append-only integrity and idempotency** — records are written once, never rewritten, and replays converge; a resolver can always audit why an attempt was unverifiable (TDR-0015 §7 lineage, NFR-11).
6. **Least vocabulary** — reuse the delivered `not-applicable` comparison class, the `state-unverified` token, and the existing record shape; add no token, identity, schema version, or field kind (G-7, NFR-8).
7. **Bounded, deterministic diagnostics** — every surfaced field has a bound, and identical injected inputs produce byte-identical envelopes and records (NFR-4, NFR-5).

## Decision Rights (DACI)

- **Driver:** `@pm` — change owner for GH-279; D2/D3 are recorded in `chg-GH-279-pm-notes.yaml`, analysis and record by `@decision-advisor`.
- **Decider / Approver:** Juliusz Ćwiąkalski — the one accountable human authority. **Acceptance is pending at the GH-279 PR review**; this record claims no acceptance, stays `Proposed` with `decision_date: null`, and grants no authority in the interim. Because it amends a durable operational policy (the handover-gate truth condition), the amendment itself is owner-owned, not AI-owned.
- **Contributors:** `@spec-writer` (DEC-2, DEC-3, DEC-7; F-3/F-4; DM-2/DM-3/DM-5; Appendix B; the observed resolve evidence), `@decision-advisor` (analysis, record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` during delivery; independent challenge by `@decision-critic` is recommended for an amendment of accepted-semantics territory; the human owner decides at PR review.
- **Performers:** `@test-plan-writer` (recording, replay, resolve-identity, and note-bound oracles), `@plan-writer` (recording step and resolve diagnostics), `@coder` (delivery).
- **Informed:** M1-S9 operational owners (the gate's truth condition now has a resolvable obligation attached to unverifiable deliveries); divergence resolvers; summary and gate consumers (unresolved counts move for new attempts only; historical attempts are not backfilled).
- **Timing and escalation:** recorded during GH-279 specification. The spec names this amendment as a dependency so gate semantics keep a durable home (spec §13); its F-4.9/DEC-3 sentence summarizes the change as two gate behaviours, while the authoritative scope is the **four** amended TDR-0015 assertions recorded here — this record is their durable home and the spec pointer does not narrow them. Implementation may proceed with acceptance pending (TDR-0005/TDR-0015 precedent). Unresolved disagreement escalates to the owner.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| TDR-0015 asserts the old rule in four places: §1 `Truth(W)` (not-applicable is never a divergence), §1 `Coverage(W)` ("creates no divergence"), §1 record-level degradation ("does not create a divergence"), and §5 ("appended iff `outcome = "mismatch"`"). | FACT | TDR-0015 §1, §5 (read 2026-11-10) | The amendment would have no target, or would miss three assertions and leave the old rule standing | High |
| TDR-0015 is itself `Proposed`, and the repository guide defines acceptance and supersession but no additive-amendment convention. | FACT | TDR-0015 front matter; `doc/guides/decision-records-management.md` §4 | The amendment could claim authority it does not have or a convention the guide does not define | High |
| The delivered engine appends a divergence only on `mismatch`, so an unverifiable-but-delivered attempt records nothing. | FACT | `packages/core/src/app/dispatch.ts` | The defect's shape would differ; the amendment might be unnecessary | High |
| The shared classifier's outcome is `completed` for a completed harness session, while the persisted attempt record's derived `outcome` is `failed` for `state-unverified`. | FACT | `packages/core/src/app/dispatch.ts` (`record({ outcome: derivation.outcome })`); `packages/core/src/domain/dispatch-result.ts` | Delivered evidence evaluated from the attempt record would never see a delivered `state-unverified` attempt | High |
| `resolveDispatchDivergenceEvidence` collapses every non-`state.keys.missing` store code into `dispatch.state-unverified`, and uses `state.keys.missing` itself as "not found"; the ledger's `resolveDispatchDivergence` helper uses `state.keys.missing` for the same purpose. | FACT | `packages/core/src/app/dispatch-gate.ts`; `packages/core/src/app/dispatch-ledger.ts` | The collapse or the not-found misuse would remain, and the fix would target only one of the two resolve seams | High |
| Classification requires the code's own `domainKind`: a `{ kind: "dispatch", code: "state.lock.busy" }` pair is contained as `fallback.internal`. | FACT | `packages/cli/src/classify.ts`; `packages/core/src/contracts/error-table.ts` | The state identity would be lost even after the collapse is removed | High |
| The resolve composition has no credential port and no transport. | FACT | `dispatch-gate.ts` input shape; spec §2.1 | Resolve could actually read truth, and C-1 would be a design preference rather than a fact | High |
| The 240-character note bound exists, the ledger clamps, and the gate path passes the raw note. | FACT | `packages/core/src/contracts/dispatch.ts`; `dispatch-ledger.ts`; `dispatch-gate.ts` | An over-long note would already be safe and that half of the change unnecessary | High |
| The six named store identities exist in the error table with their own projections and remediations. | FACT | `packages/core/src/contracts/error-table.ts` | C-2 would require new identities, which DEC-7 forbids | High |
| Resolve reported `dispatch.state-unverified` while `summary` read the same store successfully (2026-11-10). | FACT | spec §2.1 observed evidence | The collapse would be hypothetical rather than demonstrated | High |
| The local phase ledger is readable without a credential, which makes delivered evidence a credential-free fact. | ASSUMPTION | spec A-4 | Delivered evidence would need a credential and the whole construction fails C-5 | High |
| A `not-applicable` divergence can be resolved from a local note alone (240-character clamp, no evidence reference), so the gate's truth condition stays recoverable. | ASSUMPTION | spec A-7 | The new divergence would be an unpayable debt and would break TDR-0015 C-1 reachability | Medium |
| The corrected admission preflight keeps this divergence population small (unverifiable deliveries become rare rather than routine). | ASSUMPTION | GH-279 F-1; TDR-0019 | Divergence noise grows; revisit trigger 3 fires and the per-work-item at-most-one rule would be re-examined | Medium |
| The exact bounded `truth:unreadable:<reason>` vocabulary is the delivered closed read-failure set (`ledger`, `tracker`, `artifact`, `state`); there is no `ci` read family. | FACT | `packages/core/src/domain/dispatch-result.ts` (`DISPATCH_READ_FAILURE_SOURCES`) | Reasons could drift or include a non-existent family, breaking boundedness | High |

## Mental Models & Techniques Used

- **First principles:** separate *what the ledger knows* (delivered evidence — local, credential-free), *what it could not learn* (truth), and *what it therefore owes* (a resolvable obligation). The current design merges the third into silence.
- **Inversion:** how would the gate be made to lie? Count an unverifiable delivery as clean by never recording it, and report a local lock contention as an unreadable credential. Both inversions become explicit constraints (C-2, C-4).
- **Second-order thinking:** recording the divergence tightens `Truth(W)` for a case that was previously invisible — the honest reading, and the reason the amendment is scoped and resolvable rather than absolute. Recording it *and* requiring evidence to close it would make the bar reachable only on provisioned installs; the accepted cost is that closure attests rather than proves.
- **Systems thinking:** admission (TDR-0019), recording, summary counting, resolution, and the gate's truth fold are one loop. A correction at admission lowers the future population; a correction at resolution makes the population payable; a correction at recording makes it visible. Fixing one without the others leaves the loop either lying or stuck.
- **Opportunity cost:** one open record with two evidence references buys a countable, closeable obligation; the alternative (a credential-gated re-read) buys a second network path and a second failure mode inside the diagnostic tool. Per-work-item reuse bounds the population so repeated resumes do not multiply the debt.
- **KISS / least vocabulary:** reuse `not-applicable`, `state-unverified`, and the existing record shape; the only new datum is a bounded reason token.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 local-only | C-2 no collapse | C-3 note bounded | C-4 one divergence | C-5 delivered evidence | C-6 scoped | C-7 dischargeable | Eligibility |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| ALT-0 do nothing | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | Not eligible |
| ALT-1 live-read/credentialed resolution | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Not eligible |
| ALT-2 fix the collapse only, record nothing | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | Not eligible |
| ALT-3 selected composite | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Eligible |
| ALT-4 treat unverifiable delivery as a false-success incident | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | Not eligible |
| ALT-5 backfill historical attempts | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | Not eligible |

Legend: ✅ passes · ❌ fails. No alternative relies on an accepted-risk exception.

### Alternative 0 — Do Nothing

- **Eligibility:** Not eligible (fails C-1, C-2, C-3, C-4, C-7).
- **Summary:** Keep the current recording rule and the collapsing resolve path; leave the note unbounded on the gate path.
- **Constraint compliance:** Fails C-1/C-2 (resolve keeps reporting a truth token for store faults), C-3 (an over-long note still becomes a write failure), C-4 (delivered-but-unverifiable attempts still record nothing), C-7 (nothing to list or close).
- **Driver fit:** Worst on every driver; it preserves both conflations.
- **Pros:** No change, no migration, no new population.
- **Cons:** A diagnostic tool that misattributes faults; a ledger that reports a clean zero it has not earned; delivered work that cannot be acknowledged.
- **Why rejected:** Both symptoms are demonstrated production behavior, not theory.

### Alternative 1 — Live Reads / Credentialed Resolution

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Give `dispatch dual-run resolve` a credential port and a transport so it can re-read truth, confirm (or refute) the unverifiable attempt, and close the divergence against fresh evidence.
- **Constraint compliance:** Passes C-2…C-7 in principle; fails C-1 decisively — it makes a local ledger write depend on the exact capability whose absence created the divergence, and it converts a local fault into a credential requirement.
- **Driver fit:** Looks strong on driver 1 (evidence-based closure) but destroys drivers 2 and 3.
- **Pros:** Resolution would rest on independent truth rather than on the operator's note.
- **Cons:** An unprovisioned install still cannot close anything — the obligation becomes unpayable; the resolve path gains a second failure surface (network); a lock or torn-store fault could be reported as a credential problem again; the diagnostic tool acquires the credential posture the change exists to keep narrow.
- **Why rejected:** Adding credentials to resolve would hide a local write/read defect behind a security story, and it makes the obligation payable only on provisioned installs.

### Alternative 2 — Fix the Collapse Only, Record Nothing

- **Eligibility:** Not eligible (fails C-4 and C-7).
- **Summary:** Correct the resolve identity mapping and the note clamp, but keep the "divergence iff mismatch" rule untouched, so unverifiable-but-delivered attempts remain exposure-only.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-5, C-6; fails C-4 (no obligation is recorded) and C-7 (nothing to trace or discharge).
- **Driver fit:** Good on driver 2, unserved on drivers 1 and 4.
- **Pros:** Diagnosable resolve failures without touching gate semantics — the smallest diff and no TDR-0015 amendment.
- **Cons:** Delivered work that could not be verified stays invisible; the summary's unresolved count keeps under-reporting; the gate keeps a false zero.
- **Why rejected:** It fixes the mislabelling and leaves the silence. The silence is the larger defect: the mislabel wastes an operator's time once, the silence corrupts the evidence the handover depends on.

### Alternative 3 — Selected: Delivered-Evidence Divergence + Local-Only Typed Resolve

- **Eligibility:** Eligible (passes C-1…C-7).
- **Summary:** Split the two facts. Recording: when delivery is locally evidenced (classifier outcome + readable ledger) and truth is unreadable, append at most one open `not-applicable` divergence per (repository, work-item ref), carrying `engineToken: state-unverified`, a null comparison token, `attempt:<id>` plus one bounded `truth:unreadable:<reason>`, and carry its id on the attempt; reuse the open one on resume. Resolution: keep it local-only, preserve the failing store identity under `kind: "state"`, distinguish the not-found sentinel under `kind: "input"`, clamp the note, and accept note-only closure.
- **Constraint compliance:** Passes all seven — local-only resolution (C-1), no collapse or not-found conflation (C-2), clamped note (C-3), one declared exception to the mismatch rule with per-work-item reuse (C-4), credential-free delivered evidence evaluated at the classifier (C-5), a scoped four-assertion amendment that leaves every other gate clause intact (C-6), and a traceable obligation payable by a bounded note (C-7).
- **Driver fit:** Best overall; the only alternative that serves drivers 1, 2, and 3 simultaneously.
- **Pros:** Silent evidence becomes a countable, closeable debt; resolve failures become diagnosable and their remedy obvious; the gate stays strict and remains reachable; no new token, identity, or schema; records stay append-only; per-work-item reuse bounds the population.
- **Cons:** One more unresolved divergence per unverifiable delivery until it is resolved — a real tightening of `Truth(W)` for a previously invisible case (RSK-5); resolvers gain a routine obligation; closure is attestation-dischargeable, so it records that someone closed the obligation, not that truth was proven; the per-work-item and not-found guards must be proven against replay and resume.
- **Why chosen:** See Decision.

### Alternative 4 — Treat Unverifiable-But-Delivered as a False-Success Incident

- **Eligibility:** Not eligible (fails C-4, C-6, C-7).
- **Summary:** Record the attempt as a false-success incident so the evidence window resets, on the reasoning that an unverifiable delivery is a trust failure.
- **Constraint compliance:** Fails C-4 (a different record kind, and one that is not the declared divergence), C-6 (it changes the incident/window semantics, which this amendment must not touch), and C-7 (an incident is not dischargeable by resolving a divergence; only post-incident re-accrual clears it).
- **Driver fit:** Apparently strongest on driver 1; it destroys driver 4 by making every unverifiable delivery restart the clock.
- **Pros:** Maximal conservatism; nothing unverifiable is ever near an eligible window.
- **Cons:** A false-success incident means a success claim was contradicted — no success was claimed here; a single transient read failure would reset 20 dispatches of evidence; recovery becomes expensive and operationally discouraging.
- **Why rejected:** It misclassifies the event and pays for honesty with an eligibility cliff, exactly the failure mode TDR-0015's window design exists to avoid.

### Alternative 5 — Backfill Historical Attempts

- **Eligibility:** Not eligible (fails C-4, C-5, C-6).
- **Summary:** As part of this change, append divergences for the historical unverifiable attempts that motivated it (including the observed GH-241 attempt).
- **Constraint compliance:** Fails C-4 (backfill is not a record-time delivery decision and breaks the per-work-item open rule and its provenance), C-5 (the delivered-evidence facts would be reconstructed after the fact rather than observed at record time), and C-6 (it retroactively changes the evidence window and the unresolved count for past work).
- **Driver fit:** Harmless on drivers 2 and 3, but it manufactures evidence rather than recording it (driver 5) and inflates the population (driver 4).
- **Pros:** The historical gap would be visible.
- **Cons:** Rewrites the meaning of past periods; makes the ledger's timestamps less truthful; is not needed for correctness of future behavior.
- **Why rejected:** The defect is about what the engine records going forward; the historical attempts stay exposure-only, and the one divergence that mattered (`DIV-GH-275-…`) stays open and out of scope (spec NG-7, §19).

## Decision

- **Decision:** **ALT-3.** An unverifiable-but-delivered dispatch records at most one open, locally resolvable delivered-evidence divergence per (repository, work-item ref); `dispatch dual-run resolve` stays on local evidence and surfaces the fault that actually happened.

1. **Delivered evidence.** Delivery is locally evidenced when, and only when, all three hold, evaluated at record time from the shared classifier result and the readable ledger as produced: `classification.outcome === "completed"`; the phase ledger is readable; and that ledger shows progress (`ledger.progressed`) or is complete (`ledger.total > 0` and `completed === total`). These facts require no credential. The persisted attempt record's derived `outcome` is not an input: for `state-unverified` it is `failed` even when the harness completed.
2. **Recording rule.** When delivery is evidenced and a truth read is unreadable, the dispatch records an open divergence in the same step as its attempt record, carrying: `comparisonClass: "not-applicable"`, `engineToken: "state-unverified"`, `comparisonToken: null`, the resolved repository identity, the work-item reference, the attempt id, the recording instant, and evidence references `attempt:<attemptId>` plus one bounded `truth:unreadable:<reason>` drawn from the delivered closed read-failure set (`ledger`, `tracker`, `artifact`, `state`; there is no `ci` family). Before appending, it checks for an existing **open delivered-evidence divergence for the same (repository, work-item ref)** — identified by the `not-applicable`/`state-unverified`/null-comparison/`truth:unreadable:` shape, so an unrelated open `mismatch` divergence does not suppress recording: if one exists, it reuses and references it instead of appending a second (the existing record is not rewritten; the later attempt's own record and bounded `last_message` carry its evidence); if none exists, it appends one. A new divergence may be opened only after the previous one is resolved. A replay of an already-recorded attempt appends nothing (even after resolution); a new attempt after resolution may open one. The attempt record carries the resulting `divergenceRef`. When delivery is not evidenced (`classification.outcome` other than `completed`, an unreadable ledger, or no progress with an incomplete total), no divergence is opened and the attempt stays exposure-only.
3. **Amendment of TDR-0015 (scoped, four assertions).** Four assertions of the old rule are amended, for the delivered-evidence case only:
   - TDR-0015 §1, `Truth(W)` (the not-applicable-comparison clause): a divergence is no longer only a `mismatch`; a delivered-evidence attempt with an unavailable comparison source records at most one open, resolvable divergence per (repository, work-item ref) and it counts as unresolved until resolved.
   - TDR-0015 §1, `Coverage(W)`: a `state-unverified` attempt "creates no divergence" now reads — it creates no divergence **unless the attempt carries delivered evidence**, in which case the open divergence above is recorded. `state-unverified` remains a non-success token, remains exposure for coverage, remains uncorroborated-but-not-blocking on the corroboration condition, and keeps exit `2`.
   - TDR-0015 §1, record-level degradation: an attempt whose comparison or corroboration source cannot be read "does not create a divergence" now reads — it creates no divergence **unless the attempt carries delivered evidence and its truth read is unreadable**, in which case the same single open delivered-evidence divergence is recorded; it still does not become a false-success incident, and a success-claimed token's uncorroborated status is unchanged.
   - TDR-0015 §5, the comparison invariant "a divergence record is appended iff `outcome = "mismatch"`": a divergence is appended iff `outcome = "mismatch"` **or** `class = "not-applicable"` with `reason = "comparison-source-unavailable"` on an attempt that carries delivered evidence. All other comparison rules — family mapping, the `state-unverified` and dispatch-derived-`failed` not-applicable shapes, dispatch-session families, `pr-open-unverified` equivalence, `urlResolved` as an attribute — are unchanged.
   - **Consequence, stated plainly:** an unverifiable-but-delivered attempt now blocks `Truth(W)` until its divergence is resolved, where previously it blocked nothing. This is the intended honest tightening, and it is reachable because resolution requires no credential. Every other gate condition — record-level versus window-level degradation, evidence classes, the incident-exclusive window, the UTC floor, corroboration, repository identity, and append-only per-repository authority — is unchanged.
   - **Record-keeping:** the amendment lives here and is linked additively from each affected TDR-0015 assertion; TDR-0015's decision text and history are not rewritten. **No supersession is claimed.** TDR-0015 is itself `Proposed`; the repository guide defines acceptance and supersession but no additive-amendment convention, so this record can take effect only if the owner accepts both Proposed records at the GH-279 PR.
4. **Resolution is local-only and typed.** `dispatch dual-run resolve` consults no credential port, performs no network call, and reads no truth source outside the local store and the divergence ledger. Every genuine store failure is surfaced as its own typed state identity with that row's category, retryability, consequence, remediation, and projection, carried under `kind: "state"` with that code so `classifyDomainKind` accepts the pair; it is never `dispatch.state-unverified`. A `{ kind: "dispatch", code: "state.lock.busy" }` pair is rejected as containing no matching entry and would classify to `fallback.internal`, losing the identity. An identifier absent from the ledger returns the **internal not-found sentinel `divergence-not-found`** (a local resolve reason, not an error-table code and not `state.keys.missing`, which remains a genuine store key-set failure); it maps to `input.value.rejected` under `kind: "input"` and appends nothing. The ledger's own `resolveDispatchDivergence` helper returns the same sentinel rather than `state.keys.missing`, so both resolve seams agree.
5. **The note is clamped, not validated into failure.** The resolution note is clamped to 240 characters before the record is built, on every resolution path.
6. **Success semantics unchanged; closure is attestation-dischargeable.** A successful resolution appends one resolved record, leaves the original open record byte-identical, reports the resolved state and the stored note, and is idempotent on replay (an already-resolved divergence is a no-op reporting the existing record). The success payload, bounds, principal, and timestamps are unchanged. **No evidence reference is required to resolve**: the obligation is closed by the clamped free-text note, so the ledger records that someone attested closure, not that truth was independently re-read. This is an accepted residual.
7. **No new vocabulary, no migration, no backfill.** Reuse the existing record kind, payload schema version, `not-applicable` class, and `state-unverified` token; add 0 tokens, 0 error-table identities, 0 schema versions, 0 field kinds, 0 configuration keys. Historical attempts are not backfilled, and the pre-existing `DIV-GH-275-…` divergence stays open and out of scope.

- **Rationale (tied to drivers):** The divergence ledger's job is to be the honest count behind the handover bar. Left as delivered, the resolve path reports the wrong fault (driver 2) and the recording rule reports no fault at all for a delivery that could not be verified (driver 1). The selected composite records exactly the obligation the situation creates, using the vocabulary that already exists (driver 6), bounds it to one open record per work item so resume cannot inflate it (driver 5), and makes it payable with nothing but the ledger and a bounded note (driver 3) — which keeps the tightened truth condition reachable on an unprovisioned install (driver 4) and every diagnostic bounded and deterministic (driver 7). Credentialed resolution was rejected precisely because it would make the debt payable only where the credential exists; requiring evidence to close it would do the same by another route.
- **Decider:** Juliusz Ćwiąkalski — acceptance pending at the GH-279 PR review; neither this record nor the Proposed TDR-0015 it amends is accepted by the AI, and this amendment takes effect only if the owner accepts both at that review.
- **Conditions for revisit:** See `revisit_triggers`; the primary ones are a demand to make the attempt block permanently, a change to the delivered-evidence definition, unbounded divergence growth on a provisioned install, a recurrence of collapse or note rejection, a change in the read-family set, and a wording divergence when TDR-0015 is accepted.

### Constraint Compliance Attestation

The chosen alternative satisfies every constraint. The one accepted residual — attestation-dischargeable closure, where a clamped note closes the obligation without an evidence reference — is not an exception to a `negotiable: no` constraint because C-7 requires traceability, not evidence-bound closure; it is recorded in Negative Outcomes.

- **C-1** — resolve is composed with store, fence token, and principal only; spy-port tests assert zero credential and zero transport invocations (AC-F3-1, NFR-7).
- **C-2** — each store failure keeps its own row, `kind: "state"`, and projection, proven case by case; the not-found sentinel is distinct from `state.keys.missing`, carries `kind: "input"`, and maps to `input.value.rejected`; the error-table sync is green and `dispatch.state-unverified` is unreachable from the resolve path (AC-F3-2/AC-F3-3/AC-F3-5, DM-5, NFR-14).
- **C-3** — the clamp runs before the record is built on every path, so a 240+ character note lands truncated instead of failing (AC-F3-4, NFR-5/NFR-11).
- **C-4** — one declared exception to the mismatch rule, at most one OPEN divergence per (repository, work-item ref), resume reuses it, new only after resolution, replay-proven, with an explicit negative when delivered evidence is absent (AC-F4-1/AC-F4-3/AC-F4-4).
- **C-5** — delivered evidence is the credential-free classifier-plus-ledger triple, evaluated from `classification.outcome` and the readable ledger as produced, never from the persisted attempt record's derived `outcome`; each conjunct is falsified independently in tests (F-4.1, A-4).
- **C-6** — four TDR-0015 assertions (three in §1, one in §5) are amended through additive notes, with no rewrite and no supersession; TDR-0015 is itself Proposed, so the amendment depends on the owner accepting both Proposed records at the GH-279 PR; the gate suite changes only for the amended cases.
- **C-7** — the record carries `attempt:<id>` and `truth:unreadable:<reason>`, the attempt carries `divergenceRef`, the summary counts it until resolved, and resolution is a local append of a clamped free-text note that decrements the count exactly once; no evidence reference is required (accepted residual: attestation-dischargeable closure) (AC-F4-1/AC-F4-2, DM-2/DM-3).

## Trade-offs & Consequences

### Positive Outcomes

- Delivered-but-unverifiable work leaves a countable obligation instead of silence: the summary's unresolved count becomes truthful, and the debt can be paid by a bounded note.
- Resolution failures name the fault that occurred — a busy lock, a torn store, an exhausted disk, a permission problem — with that row's own remedy and exit, so the operator stops hunting a credential that resolve never needed; an absent identifier is a clean `input.value.rejected` rather than a masquerading store fault.
- Oversized notes stop turning operator prose into write failures.
- The gate stays strict and becomes satisfiable in the case that previously could never be closed: the truth condition now ranges over a resolvable record rather than an invisible one.
- Append-only integrity, determinism, and the vocabulary are untouched: same record kind, same schema version, same tokens, same exits.
- Nothing is migrated and nothing is backfilled; the population grows only forward, at most one open record per (repository, work-item ref).

### Negative Outcomes

- **A deliberate tightening.** An unverifiable-but-delivered attempt now counts as an unresolved divergence and therefore blocks `Truth(W)` until resolved, where before it blocked nothing. Operators must resolve it to restore eligibility — cheap once, but a new routine obligation (RSK-5). This is a change in verdict for real repositories and is the owner-visible consequence of the amendment.
- **Attestation-dischargeable closure (accepted).** The obligation is closed by a free-text note clamped to 240 characters; **no evidence reference is required**. The ledger therefore records who closed it and what they wrote, not that truth was re-read or independently proven. Accepted because requiring evidence would make the obligation payable only where the credential or evidence source exists — the dependency this decision exists to avoid. The revisit trigger records the owner's option to require evidence-bound closure explicitly.
- **Population growth until admission is fixed.** An unverifiable delivered attempt for a work item with no open delivered-evidence divergence adds one open record; resumes reuse it. The corrected admission preflight (TDR-0019) is what keeps the population small, and the two corrections should land together to avoid a noisy ledger.
- **Resolve becomes an obligation-bearing command.** An operator-facing diagnostic now routinely writes records; runbooks must distinguish "nothing to resolve" from "resolved" from "store fault" (spec §22).
- **A bounded reason vocabulary to maintain.** `truth:unreadable:<reason>` must stay the delivered closed read-failure set (`ledger`, `tracker`, `artifact`, `state`), so adding a read family becomes a documentation and test obligation rather than a free string.
- **Historical asymmetry.** Attempts recorded before this change carry no divergence and never will; two periods of the same ledger are not comparable on this dimension (documented, not backfilled).

### Unresolved Questions

- [ ] Pin the delivered closed `truth:unreadable:<reason>` vocabulary (`ledger`, `tracker`, `artifact`, `state`) and assert it (owner: `@test-plan-writer`, AC-F4-1).
- [ ] Keep the recorded tightening and the note-only closure visible in the runbook and the dispatch reference page so operators read "unresolved: 1" after a delivery as an obligation, not a regression, and know that a note is the discharge (owner: `@doc-syncer`, spec §16.1).
- [ ] Decide separately whether the owner wants evidence-bound closure instead of the accepted attestation-dischargeable posture; this record's answer is note-only (owner: Juliusz Ćwiąkalski).
- [ ] Decide separately whether any historical attempts deserve backfill; this record's answer is no (owner: Juliusz Ćwiąkalski, spec NG-7/§19).

## Implementation Plan

1. **Recording:** derive delivered evidence from `classification.outcome === "completed"` plus the readable ledger facts as produced; when it holds and truth is unreadable, look up an existing open delivered-evidence divergence for the same (repository, work-item ref) and reuse it, otherwise append one open divergence of the declared shape; carry the resulting id on the attempt. Prove the per-work-item guard against replay and resume.
2. **Resolution:** preserve the failing store identity end to end under `kind: "state"` (no relabelling); replace the `state.keys.missing` not-found branch in both the gate path and the ledger helper with the internal `divergence-not-found` sentinel that maps to `input.value.rejected` under `kind: "input"`; clamp the note before the record is built on every path; keep the success payload, principal, timestamps, and idempotency unchanged; require no evidence reference to resolve.
3. **Summary and gate:** fold the new divergence into the existing unresolved count and the truth condition; assert the pre-amendment gate cases are unchanged apart from the four amended assertions.
4. **Tests:** invert any assertion that expects silence for a delivered-but-unverifiable attempt; add the per-work-item recorded-once, resume-reuses-open, new-after-resolved, replay-noop, absent-evidence, classifier-outcome-not-attempt-outcome, per-identity resolve with domain kinds, not-found-versus-store-fault, note-only closure, and over-long-note cases; assert zero credential and zero transport invocation on resolve; keep the error-table and taxonomy sync checks green.
5. **Documentation:** dispatch reference page covers the resolution path, the tightening, the note-only discharge, and the domain-kind mapping; the dispatch feature spec and the gate semantics are reconciled after delivery; the PR description states that unresolved counts move for new attempts only and that TDR-0015 and TDR-0020 must both be accepted.

## Verification Criteria

- **Resolve isolation:** 0 credential resolutions and 0 network calls on every resolve path; the spies are asserted, not inferred (Target: 0 / 0; Window: AC-F3-1, NFR-7).
- **No collapse:** 0 resolve failures reported as `dispatch.state-unverified`; every store identity surfaces under `kind: "state"` with its own projection and exit and 0 classify as `fallback.internal`; unknown identifiers map to `input.value.rejected` under `kind: "input"` and are never reported as `state.keys.missing` (Target: 0 / 100%; Window: AC-F3-2/AC-F3-3/AC-F3-5, NFR-14).
- **Note bound and note-only closure:** 100% of resolution notes stored at ≤ 240 characters with 0 `state.write.failed` produced by length; 100% of resolutions succeed with a note and no evidence reference (Target: 100% / 0; Window: AC-F3-4).
- **Recording at most one per work item:** 100% of unverifiable-but-delivered attempts carry a `divergenceRef`; at most one OPEN delivered-evidence divergence exists per (repository, work-item ref); a resume reuses it; 0 divergences for attempts without delivered evidence; 0 second divergences on replay; a new divergence appears only after the previous is resolved (Target: 100% / 0 / 0; Window: AC-F4-1/AC-F4-3/AC-F4-4).
- **Delivered-evidence evaluation points:** 100% of delivered-evidence decisions use `classification.outcome === "completed"` and the readable ledger facts as produced; 0 use the persisted attempt record's derived `outcome` (Target: 100% / 0; Window: F-4.1, A-4).
- **Dischargeable obligation:** the summary lists the divergence and counts it unresolved; one note-only resolution decreases the count by exactly one; the original record is byte-identical afterward (Target: 1 of 1 per case; Window: AC-F4-2).
- **Scope discipline:** 0 new tokens, identities, schema versions, field kinds, or configuration keys; the gate suite differs only in the four amended assertions (Target: 0 each; Window: taxonomy/error-table pins + gate suite review).
- **No backfill:** 0 historical attempts gain a divergence (Target: 0; Window: ledger inspection at delivery).

## Confidence Rating

**High.** Every load-bearing claim is repo-local and read directly: the four TDR-0015 assertions being amended and TDR-0015's own `Proposed` status, the classifier-versus-attempt outcome split, the delivered recording branch, the resolve collapse and its `state.keys.missing` misuse, the domain-kind classification rule, the delivered read-failure set, the declared note bound with its clamping asymmetry, and the six store identities. The observed production evidence (resolve failing while summary succeeded) is the fact that fixes the diagnosis as a diagnostic collapse rather than a credential problem. The residual uncertainty is bounded and named: the delivered-evidence definition's sufficiency, the local note-only dischargeability assumption, the population assumption this record shares with TDR-0019, and the read-family vocabulary. AI-generated confidence is not evidence; the owner's decision at the GH-279 PR review is authoritative, both records stay `Proposed` until then, and acceptance requires the owner to accept TDR-0015 and TDR-0020 together.

## References

- [GH-279 specification](../changes/2026-11/2026-11-10--GH-279--dispatch-credential-preflight/chg-GH-279-spec.md) — F-3, F-4, DEC-2, DEC-3, DEC-7, DM-2/DM-3/DM-5, NFR-4/NFR-5/NFR-7/NFR-8/NFR-11/NFR-14, RSK-5/RSK-6, §19, §22, AC-F3-1…AC-F3-5, AC-F4-1…AC-F4-4, Appendix A/B.
- [TDR-0015](TDR-0015-dispatch-handover-gate-operational-semantics.md) — the amended record (itself `Proposed`): §1 `Truth(W)`, §1 `Coverage(W)`, §1 record-level degradation, and §5 comparison invariants each carry an additive amendment note; all other clauses stand.
- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — the token vocabulary, projection classes, and exit derivation reused unchanged.
- [TDR-0010](TDR-0010-dispatch-session-classification-token-projection.md) — the dispatch-session projection and its `outcome`-beside-`partial` rule.
- [TDR-0019](TDR-0019-dispatch-admission-credential-preflight.md) — the admission preflight that keeps this divergence population small.
- `packages/core/src/app/dispatch.ts` — the recording branch (divergence only on `mismatch`), the classifier result used for delivered evidence, and the attempt/divergence correlation field.
- `packages/core/src/app/dispatch-gate.ts` — `resolveDispatchDivergenceEvidence` and `resolveAppend`: the collapse and the `state.keys.missing` not-found misuse to be removed.
- `packages/core/src/app/dispatch-ledger.ts` — the ledger's clamping append and the record validator that rejects an over-long note.
- `packages/core/src/domain/dispatch-result.ts` — `DISPATCH_READ_FAILURE_SOURCES` (`ledger`, `tracker`, `artifact`, `state`) and the derived attempt outcome.
- `packages/core/src/contracts/dispatch.ts` — `DISPATCH_MAX_NOTE_CHARS` (240) and the divergence record contract.
- `packages/core/src/contracts/error-table.ts` — the state identities, their `domainKind`, and the `input.value.rejected` row.
- `packages/cli/src/classify.ts` — `classifyDomainKind` and the `fallback.internal` containment path.
