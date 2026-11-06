---
id: TDR-0009
decision_type: tdr
status: Proposed
created: 2026-11-06
decision_date: null
last_updated: 2026-11-06
summary: "The retro evidence sidecar chains records with an HMAC-style keyed link (chaining key + previous link + canonically-ordered record content) over a distinct store-managed chaining-key artifact — separate bytes and family from the audit-ledger chain key — with collector identity as claimed attribution plus structural write-path separation: tamper-EVIDENCE for actors not possessing the key, never tamper-prevention, inside the pinned single-user-host trust model."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os learning plane (retro evidence pipeline)"
decision_scope: repo
review_date: null
classification:
  domains: [security, architecture]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: local
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-232 spec OQ-1)"
  decider: "Juliusz Ćwiąkalski (human acceptance pending at GH-232 PR review)"
  contributors:
    - "@spec-writer (GH-232 DEC-1/DEC-2/DEC-4, DM-2/DM-3/DM-4, OQ-1 framing)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Owner (human final acceptance)"
  performers:
    - "@coder (GH-232 delivery)"
  informed:
    - "M1-S8 OSS retro pipeline (GH-232)"
    - "M1-S12 capsules/closeout (retro consumer)"
    - "M2-S3 ceremony runner (retro scheduler)"
    - "M2-S10 action registry (follow-through enforcement)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Backup/restore or key-escrow work is scheduled for the audit-ledger chain key: re-evaluate the sidecar key's loss-of-key semantics in the same round (GH-232 NG-6, §7.3)."
  - "A deployment model with multiple users, remote hosts, or OS-level privilege separation is pinned: the single-user trust model and the claimed-identity convention must be redecided deliberately, not stretched."
  - "A forgery or undetected alteration occurs inside the documented lane-environment model (an actor without the key): the construction or the key-containment seam has failed and this decision is reopened."
  - "The audit ledger redecides its own chain construction (its invertibility caveat is revisited): decide to unify or to keep deliberately divergent constructions, with a fresh record."
  - "A third chained plane appears (e.g., the capsule plane): apply the distinct-key-per-chained-domain rule deliberately rather than by copy-paste."
links:
  related_changes: ["GH-232", "GH-223"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-06--GH-232--oss-retro-pipeline/chg-GH-232-spec.md"
    - "doc/spec/features/feature-audit-ledger.md"
    - "doc/planning/concepts/retrospectives.md"
  contracts:
    - "packages/core/src/contracts/audit.ts"
  diagrams: []
  decisions: ["TDR-0004", "TDR-0005"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S8", "M1-S12", "M2-S3", "M2-S10"]
---

# TDR-0009: Retro Evidence Sidecar — Keyed-Chain Construction, Distinct Chaining Key, and Claimed Collector Identity

## Context

- **FACT:** The state layer (TDR-0004; GH-174/GH-222) delivers the substrate this decision composes: append-only schema-versioned stores, validated artifact boundaries, fences, store-managed artifacts, least-privilege permissions (0700 directory, 0600 files), explicit salvage, and forever retention.
- **FACT:** The command audit ledger (GH-223) chains its records with a keyed link and a store-managed `chain-key.<workspace>.json` artifact: generated once with cryptographic randomness at the runtime edge, created `0600` and verified on open, never silently regenerated when guarded records exist, open failures reusing the existing state identities, and read by every later process so verification spans processes (`doc/spec/features/feature-audit-ledger.md`, read 2026-11-06).
- **FACT:** The audit ledger's spec documents an honesty caveat: the link's FNV-1a-64 construction is invertible modulo 2⁶⁴, so a same-user process can derive the internal chain state from one public record and forge chain values **without reading the key**; within the pinned single-user model, that ledger's in-model forgery resistance rests on state-file permissions, not key secrecy (same spec, §Keyed chain and chaining key).
- **FACT:** Ticket GH-232 (M1-S8) pins the integrity decision this record makes inspectable: tamper-evidence, not prevention; the sidecar is hash-chained with a chaining key that never enters lane environments; a delivery agent cannot alter evidence undetectably; the retro flags the tamper (GH-232 spec §12 assumptions, §21 security review, Appendix A).
- **FACT:** The retro concepts doc makes the evidence plane outside delivery-agent write authority a P0, grounded in the 2026-10 research corpus finding that tested coding-agent harnesses let agents delete their own traces; its named defense is independent collector identity, append-only storage, and a tamper-evident chain (`doc/planning/concepts/retrospectives.md`, process stage 2 and failure-mode table).
- **FACT:** The GH-232 spec resolves the mechanics in its decision log — DEC-1 (HMAC-style keyed link, deliberately not the audit ledger's invertible derivation), DEC-2 (distinct store-managed key artifact), DEC-4 (collector identity as claimed attribution plus structural write-path separation; OS privilege separation out of scope) — and OQ-1 asks for exactly this standalone TDR because the choice is AC-bearing and deliberately diverges from the audit-ledger precedent.
- **FACT:** Binding AC 2 of GH-232 ("evidence alteration by a delivery agent is detectable — hash-chain break flagged, not silently trusted") rides directly on this decision; the mutation suite's "edit with a recomputed unkeyed checksum" class is the adversarial case the construction must survive.
- **Scope note:** this record covers DEC-1 + DEC-2 + DEC-4 (construction, key material, identity mechanics). Sidecar placement (DEC-3), level registry (DEC-5), pipeline-truth checks (DEC-6), malformation taxonomy (DEC-7), and the remaining spec pins stay in the change's decision log; they are change-scoped, not precedent-diverging.
- **Branding note:** operator-facing naming introduced by this work goes through the branding seam (identity-variable naming root, forbidden-literal registry); nothing here names a product or binary literal.

## Problem Framing (Clarified)

Three linked questions sit under OQ-1:

1. **Construction.** Which link function makes "the chaining key never enters lane environments" carry real weight for the retro guarantee? The adversary here is the reviewed system itself — a delivery agent operating within its declared lane environment, able to read every public byte (records, links, output). Forgery of a consistent history must require key possession, not merely record access.
2. **Key material.** Where does the chaining key live so that verification spans processes, open failures classify in the existing state-identity language, and compromise of one chained plane's key does not enable forging another plane's chain?
3. **Identity mechanics.** What does "a collector identity delivery agents cannot write" honestly reduce to on a single-user host, where nothing physically stops a same-user process from touching a file?

The root cause is not detection capability — the audit ledger proves walk-and-compare verification works and how to make it survive process boundaries. It is **forgery-resistance scoping**: choosing the strongest boundary the pinned trust model can honestly draw (key possession) and the machinery that makes that boundary real, while refusing to claim an OS-level guarantee (prevention, authentication) the model does not provide.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Alteration of sidecar evidence by any actor not possessing the chaining key — content edit, record deletion, reorder, tail truncate-and-reappend, edit with a recomputed unkeyed checksum, key-artifact substitution — is detected by chain verification on the next read and flagged (break naming record position and trace id; altered records never served as verified findings). | GH-232 binding AC 2 (spec AC-F2-3, AC-F3-1); pinned ticket decision | Tamper mutation suite (spec NFR-2) | no |
| C-2 | The sidecar chaining key never appears in lane environments, records, output, configuration, or the ambient environment; it exists only as store-managed key material and runtime-edge-injected data. | Pinned ticket decision (spec DM-3, NFR-3) | Key-exclusion assertions over lane environment, records, output, configuration; review | no |
| C-3 | Forgery resistance boundary is key possession: an actor holding only public records and links — no key — cannot compute a valid chain link. Key separation must be non-vacuous. | Pinned ticket decision requiring non-vacuous key separation (spec DEC-1, §2.2) | Construction argument; the recomputed-checksum mutation class must flag | no |
| C-4 | Operates within the pinned single-user-host trust model: no OS-level privilege separation, no multi-user or remote threat model, no authenticated identity, no cryptographic non-repudiation claimed. | Pinned ticket decision (spec NG-5, §21) | Spec audit of guarantee wording at review; no OS-principal machinery in delivery | no |
| C-5 | Cross-process continuity: verification of unaltered sidecar history from a later process produces zero false chain breaks. | Internal standard (state layer; audit-ledger key-artifact precedent, GH-223; spec NFR-3) | Cross-process verification tests | no |
| C-6 | Key-artifact open failures classify through the existing state identities — absent on a non-first open → `state.keys.missing`; unparsable/wrong-schema/malformed key → `state.store.torn`; wrong permission bits → `state.permission.denied` — with no new error-table rows for key handling. | Internal standard (GH-222/GH-223 minimal-table discipline; spec DM-3, DEC-11) | Key-open-failure tests; error-table sync check | no |
| C-7 | No new third-party dependency: the construction composes platform/runtime-edge primitives, with runtime APIs only at admitted I/O locations. | Internal standard (ADR-0003 tier rules, runtime-edge discipline; spec NFR-9) | Dependency boundaries; forbidden-literals checks; `pnpm check` | no |

## Decision Drivers

1. **Non-vacuous key separation.** The reviewed system is the adversary; possession of records and links alone must not enable forgery. This is the pinned decision's core demand.
2. **Precedent consistency (paved road).** Reuse the proven store-managed key-artifact pattern — runtime-edge generation, `0600` least privilege, verified-on-open, state-identity failures, cross-process continuity — rather than inventing new key machinery.
3. **Plane isolation.** Compromise of the audit-ledger chain key must not enable forging the evidence sidecar's chain (and vice versa).
4. **Honest, testable guarantee wording.** The guarantee must be stateable in one sentence ("actors not possessing the key cannot alter evidence undetectably") and assertable in a mutation suite; tamper-EVIDENCE, never tamper-prevention.
5. **Minimal ceremony.** One failure language (existing state identities), no new error-table rows for key handling, no new dependencies, no new ambient reads.
6. **Determinism and offline testability.** Verification is pure computation over stored bytes plus the key: no clock, environment, network, or model calls.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-232 spec OQ-1 delegates this record).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at GH-232 PR review. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (DEC-1/DEC-2/DEC-4, DM-2/DM-3/DM-4, OQ-1 framing); `@decision-advisor` (analysis and record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-232; the owner for final acceptance of this record.
- **Performers:** `@coder` (GH-232 delivery: contracts, sidecar consumer, key lifecycle, mutation suite).
- **Informed:** M1-S8 (GH-232) and the downstream consumers M1-S12 (capsules/closeout), M2-S3 (ceremony runner), M2-S10 (action registry).

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The audit-ledger link's FNV-1a-64 construction is invertible modulo 2⁶⁴; a same-user process can derive internal chain state from one record and forge values without the key. | FACT | `doc/spec/features/feature-audit-ledger.md` (read 2026-11-06) | Reusing the construction (ALT-1) would be viable; the divergence rationale collapses. | High |
| The store-managed chaining-key pattern (runtime-edge generation, `0600`, verified on open, never silently regenerated, state-identity open failures, cross-process continuity) is delivered and proven. | FACT | `doc/spec/features/feature-audit-ledger.md`; GH-223 delivery | Key placement would need new design; C-5/C-6 would lose their precedent. | High |
| GH-232 pins: tamper-evidence not prevention; chaining key never enters lane environments; a delivery agent cannot alter evidence undetectably; the retro flags the tamper. | FACT | GH-232 spec §12/§21/Appendix A; ticket | The constraint set C-1..C-4 would need re-derivation. | High |
| The evidence plane must sit outside delivery-agent write authority (P0); tested harnesses let agents delete their own traces. | FACT | `doc/planning/concepts/retrospectives.md` (2026-10 research corpus) | The threat model would be weaker than assumed; the whole sidecar premise weakens. | High |
| Keyed-hash (MAC) constructions of the HMAC family are designed so computing a valid tag without the key is computationally infeasible under the hash function's PRF assumptions. | FACT | Standard property of the construction family (no external dependency introduced; exact primitive pinned at plan time) | The chosen family would not deliver C-3; a different MAC family member would be selected. | High |
| A suitable keyed-hash primitive is available at the runtime edge in the delivery runtime without a new third-party dependency. | ASSUMPTION | Delivery runtime platform crypto surface; spec DEC-1 defers the exact primitive to plan time | C-7 forces either a different family member or an explicit dependency decision record. | Medium |
| Lane environments are declaratively bounded and inspectable, so "the key never enters lane environments" is assertable by test. | ASSUMPTION | Spec AC-F2-2 provides exactly this test | C-2 verification would rest on review only; guarantee wording unchanged. | Medium-High |
| Exact primitive, digest width, canonical encoding details, and key-artifact filename. | TO-CONFIRM | Spec DEC-1 final clause; OQ-2 resolved as a plan-time pin (as GH-223 did) | None to the decision; plan-time pin only. | — |
| The deployment reality is a single-user host operated by a solo developer with AI agents. | FACT | Ticket trust model; `.ai/agent/decision-instructions.md` key constraints | ALT-4 (OS privilege separation) would become decidable; trust model must be redecided first. | High |

## Mental Models & Techniques Used

- **Inversion:** design for the adversary. Assume the reviewed delivery agent reads every public byte and ask only "what can it still not do?" The answer must be "compute a valid link" — which requires the key.
- **First principles:** integrity evidence is a value computable only by a holder of a secret over the observed history. If everything the verifier uses is public, the evidence is theater. Remove the secret from the public set or drop the claim.
- **Second-order thinking:** sharing the audit key would couple the planes — any future flaw or compromise in one chain's key handling cascades into the other. Distinct keys make forgery of both planes require two independent `0600` artifact reads.
- **Systems thinking:** the guarantee is a property of the whole seam — construction + key placement + structural write-path separation + claimed identity — not of the hash function alone. Each alternative was evaluated against the seam, not the primitive.
- **Threat-model scoping (honesty):** state the boundary where it actually holds. The audit ledger's documented caveat is the house style; this record draws the in-model boundary at key possession instead of file permissions alone, and says so in the same breath.
- **Opportunity cost:** OS privilege separation buys partial prevention but costs a deployment topology the pinned model excludes; detection at near-zero marginal operational cost is the pinned trade.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 alteration detected | C-2 key containment | C-3 non-vacuous separation | C-4 pinned trust model | C-5 cross-process continuity | C-6 state-identity failures | C-7 no new dependency |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no chain | ❌ | ✅ (vacuous) | ❌ | ✅ | ✅ (vacuous) | ✅ (vacuous) | ✅ |
| ALT-1 reuse audit-ledger FNV-style construction | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 HMAC-style keyed chain, distinct key (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 unkeyed content hash | ❌ | ✅ (vacuous) | ❌ | ✅ | ✅ (vacuous) | ✅ (vacuous) | ✅ |
| ALT-4 OS-privilege-separated collector | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails · ⚠️ = passes only via an accepted-risk exception. "(vacuous)" marks constraints that pass only because no key artifact exists to constrain — the pass carries no evidential weight.

### Alternative 0 — Do Nothing / No Integrity Chain on the Evidence Plane

- **Eligibility:** Not eligible (fails C-1, C-3).
- **Summary:** Ship no evidence sidecar chain (or no sidecar at all): retrospectives read memory, claims, and unverified artifacts — the exact current-state gap the change exists to close.
- **Constraint compliance:** Fails C-1 (no detection mechanism) and C-3 (no key, no boundary). Key-related constraints pass vacuously.
- **Driver fit:** Fails driver 1 outright; leaves the concepts-doc P0 (trace tampering by the reviewed system) unaddressed.
- **Pros:** Zero new machinery.
- **Cons:** Binding AC 2 unsatisfiable; a delivery agent can rewrite its own traces with no detection; downstream consumers (M1-S12, M2-S3, M2-S10) build on nothing.
- **Why rejected:** It fails the ticket's pinned decision and binding AC 2 by construction.

### Alternative 1 — Reuse the Audit-Ledger FNV-Style Keyed Construction

- **Eligibility:** Not eligible (fails C-1, C-3).
- **Summary:** Chain sidecar records with the same link mathematics as the audit ledger (internal-state derivation over key + previous link + content), possibly under a distinct key artifact.
- **Constraint compliance:** Fails C-1 and C-3 — see Reasoning below. C-2 passes formally (the key artifact is still excluded from lanes) but the exclusion buys nothing, which is precisely what C-3 exists to expose.
- **Driver fit:** Strong on drivers 2, 5 (maximum precedent reuse, one construction to maintain); fails driver 1 and 4 (the guarantee sentence would be false as scoped).
- **Pros:** One construction across both planes; the audit-ledger implementation pattern ports directly; cross-process continuity and state-identity failures come free.
- **Cons:** The keyed-separation guarantee is vacuous: everything needed to forge is public. The mutation suite's recomputed-checksum class (generalized to recomputed keyed checksums without the key) would produce false "verified" verdicts.
- **Why rejected:** The invertibility documented in the audit-ledger spec makes key separation meaningless for the retro guarantee; the pinned decision explicitly requires non-vacuous separation.

### Alternative 2 — HMAC-Style Keyed Chain with a Distinct Store-Managed Chaining Key (chosen)

- **Eligibility:** Eligible.
- **Summary:** Each sidecar record's link is a keyed-hash (MAC) computation over the chaining key, the previous sidecar link (or the sidecar chain anchor for the first record), and the record's canonically-ordered content with its own chain value excluded. The chaining key is distinct store-managed material — separate artifact and separate bytes from the audit-ledger chain key — generated once with cryptographic randomness at the runtime edge on the sidecar's first append, persisted beside the sidecar under the store-managed artifact family convention, created `0600` and verified on open, read by every later collector process. Appends serialize under one dedicated collector fence (the audit-ledger close-the-whole-domain precedent). Every read verifies the chain; a break names the record position and trace id and fails classified (`retro.evidence.tamper-flagged`, exit 1); altered records are never served as verified findings. Collector identity on records is claimed attribution per the M1-S22 convention; refusal of non-collector writes is structural write-path ownership plus claimed-identity marking (`retro.evidence.denied`), never authentication. The exact primitive is pinned at plan time within the keyed-hash family.
- **Constraint compliance:** Passes C-1 through C-7 (matrix above).
- **Driver fit:** Best on every driver: forgery requires key possession (1), reuses the proven key-artifact pattern (2), isolates the planes (4), yields a one-sentence testable guarantee (4), adds no error rows or dependencies (5), and verification is pure computation (6).
- **Pros:** Non-vacuous key separation with near-zero marginal operational cost over the proven precedent; plane isolation; the honesty boundary is inspectable and testable.
- **Cons:** A second key artifact to operate (loss-of-key semantics below); the collector process itself is trusted by construction (it holds the key); a same-user process that deliberately reads the `0600` key artifact can forge — outside the lane contract, inside accepted residual risk.
- **Why chosen:** The only eligible alternative. See Decision.

### Alternative 3 — Unkeyed Content Hash Chain

- **Eligibility:** Not eligible (fails C-1, C-3).
- **Summary:** Chain records with an unkeyed hash over the previous link and content — no secret anywhere.
- **Constraint compliance:** Fails C-1 (edit plus recomputation of subsequent links is mechanical, no secret needed — the classic unkeyed-chain splice; GH-232's mutation suite includes exactly this class) and C-3 (no key exists, so a key-possession boundary is undefined).
- **Driver fit:** Cheapest option (5, 6); fails drivers 1 and 4.
- **Pros:** Simplest construction; no key artifact, no loss-of-key failure mode.
- **Cons:** Detects corruption and lazy edits only; any adversary that can read can also recompute. The pinned decision's key-separation requirement exists precisely to exclude this.
- **Why rejected:** The adversary in this threat model reads everything public; an unkeyed chain is public.

### Alternative 4 — OS-Privilege-Separated Collector Process

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Run the collector as a distinct OS principal (service account / separate user) owning the sidecar files, so lane processes are physically unable to write them — converting detection into partial prevention and the claimed-identity refusal into real authentication.
- **Constraint compliance:** Passes C-1..C-3, C-5..C-7 (it would over-deliver on integrity); fails C-4 — see Reasoning below.
- **Driver fit:** Over-delivers driver 1; catastrophically fails the pinned trust model and the project's lean-process/solo-maintainer priorities.
- **Pros:** Strongest guarantee of any option; identity becomes provable.
- **Cons:** Requires a second OS principal, service accounts, permission bridging, and a deployment topology the project does not operate; changes the documented trust model from under the ticket.
- **Why rejected:** Out of model — not wrong, but it decides a different trust model than the pinned one. If that model ever changes, a revisit trigger fires and the identity mechanics are redecided deliberately.

## Decision

- **Recommendation (tied to drivers):** Adopt ALT-2. The retro evidence sidecar uses an HMAC-style keyed-hash chain with a distinct store-managed chaining key, and collector identity is claimed attribution with structural write-path separation. Concretely, three pins mirroring GH-232 DEC-1/DEC-2/DEC-4:
  1. **Construction (DEC-1).** The chain link is a keyed computation from the cryptographic keyed-hash family over the chaining key, the previous sidecar link (or the sidecar chain anchor), and the record's canonically-ordered content (the record's own chain value excluded). It is deliberately **not** the audit ledger's invertible internal-state derivation; exact primitive pinned at plan time within the family. The guarantee wording is pinned: **tamper-EVIDENCE by actors not possessing the key, never tamper-PREVENTION**.
  2. **Key material (DEC-2).** The sidecar chaining key is distinct store-managed key material — separate artifact, separate bytes, separate artifact family from the audit-ledger chain key — generated once with cryptographic randomness at the runtime edge on the sidecar's first append; persisted beside the sidecar under the store-managed artifact family convention (the `chain-key.<workspace>.json` precedent); created `0600` and verified on open; never silently regenerated when guarded records exist; open failures reuse the existing state identities (`state.keys.missing` / `state.store.torn` / `state.permission.denied`); read by every later collector process for cross-process continuity; never present in records, output, configuration, the ambient environment, or any lane environment.
  3. **Collector identity (DEC-4).** Identity stamps on evidence records follow the claimed-identity convention of the audit ledger (value plus `claimed` marker): attribution only — never verified, never an authorization input. "A collector identity delivery agents cannot write" reduces honestly to **structural write-path separation**: the sidecar sits outside every delivery-lane write path, only the collector's own write seam appends, and a write attempted outside that seam or from a delivery-agent context is refused with `retro.evidence.denied` — a structural refusal plus claimed-identity marking, explicitly **not** authentication. OS-level privilege separation is out of scope under the pinned single-user trust model.
- **Reasoning — why the audit-ledger construction makes key separation vacuous (ALT-1):** The audit ledger's link is computed from (key, previous link, content), but through an FNV-1a-64 pipeline that is invertible modulo 2⁶⁴. Given one public record's stored link and its content, a same-user process solves for the internal chain state and can forge valid-looking links for edited records — for the whole remaining chain — **without ever reading the key artifact**. Under that construction, "the key never enters lane environments" constrains nothing the adversary needs: every input required for forgery is already public. Distinct key bytes (DEC-2) would change nothing; the separation would be vacuous, exactly what C-3 forbids. This is acceptable for the audit ledger — its spec says so honestly, resting in-model forgery resistance on `0600` file permissions within the single-user model, and its own caveat stands untouched for its own domain. The retro sidecar cannot accept the same trade: its in-model adversary is the reviewed delivery system itself, and the pinned GH-232 decision requires the key-separation rule to carry real weight. A keyed-hash (MAC) link restores the missing property — computing a valid link without the key is computationally infeasible — so the boundary the guarantee draws becomes key possession rather than file permissions alone.
- **Reasoning — why OS privilege separation is out of model (ALT-4):** The pinned trust model is a single-user host; NG-5 excludes OS-level privilege separation, multi-user and remote threat models, and authenticated identity. On a single-user host there is no second OS principal to separate — manufacturing one means service accounts, permission bridging, and a deployment topology a solo developer with AI agents does not operate, converting a detection guarantee into a partial-prevention guarantee nobody asked for and cannot deploy. The refusal semantics would silently upgrade from "structural write-path ownership plus claimed-identity marking" to real authentication, contradicting the ticket's own honest scoping. The option is rejected as exceeding the model, not as unsound; the revisit trigger reopens it if the deployment model ever changes.
- **Honest scoping statement (the enforceable claim):** a delivery agent operating within its declared lane environment cannot alter evidence undetectably, because the lane environment never receives the chaining key and a valid link cannot be computed from public records and links alone. A same-user process that deliberately reads the store-managed key artifact to forge links is outside the documented lane-environment contract and inside the accepted single-user residual risk — stated with the same honesty as the audit ledger's documented caveat, and stronger: the in-model boundary is key possession, not permissions alone.
- **Authorization:** Status `Proposed`. Human acceptance is recorded at GH-232 PR review; AI does not accept this R2 record.
- **Decider:** Juliusz Ćwiąkalski.
- **Conditions for revisit:** See `revisit_triggers`; the first GH-232 retrospective (which this pipeline itself will host) confirms the guarantee's realized boundary against the mutation suite's live behavior.

### Constraint Compliance Attestation

The chosen alternative (ALT-2) satisfies every constraint C-1 through C-7. No accepted-risk exceptions are taken. The residual same-user-key-reader risk is not a constraint violation — C-4 pins the model within which that actor is out of scope; it is recorded honestly under Trade-offs & Consequences rather than absorbed into the guarantee.

## Trade-offs & Consequences

### Positive Outcomes

- **Non-vacuous key separation:** forgery of a consistent sidecar history requires possession of the chaining key; a lane agent — which never receives it — cannot produce one from public bytes.
- **Binding AC 2 becomes mechanically testable:** every pinned alteration class (content edit, deletion, reorder, tail truncate-and-reappend, recomputed unkeyed checksum, key-artifact substitution) flags as a chain break naming position and trace id, with zero false "verified" verdicts.
- **Plane isolation:** the audit plane and the evidence plane chain under independent keys, so one key's compromise does not cascade; both remain backward-compatible neighbors in the state directory.
- **Paved-road operations:** the proven store-managed key-artifact pattern gives least privilege, one failure language, no new error-table rows, and no new dependencies.
- **An inspectable guarantee:** the boundary ("actors not possessing the key") is one sentence, testable, and honest — the record and the spec say the same thing.

### Negative Outcomes — what the guarantee honestly does NOT cover

- **Not tamper-prevention.** Nothing physically stops any same-user process from writing to the sidecar files; the guarantee is detection on the next verified read, never prevention.
- **Key possession is the boundary, not permissions alone.** A same-user process that deliberately reads the `0600` store-managed key artifact can forge links indistinguishably from the collector. That actor is outside the documented lane-environment contract and inside the accepted single-user residual risk (GH-232 RSK-1, accepted per the pinned tamper-evidence-not-prevention decision).
- **Claimed, not proven, identity.** A lying collector stamp is indistinguishable from a truthful one; identity is attribution, never authentication or authorization. `retro.evidence.denied` is structural write-path ownership, not a credential check.
- **The collector is trusted by construction.** It holds the key; a compromised collector process can write plausible forged evidence. This decision defends the evidence plane against the delivery plane, not the learning plane against itself.
- **Wholesale destruction is not chain evidence.** Deleting the entire sidecar (with its key) surfaces as an unreachable or verified-empty store — a store-level condition — not as a chain break; partial deletion is what the chain catches.
- **A second key artifact to operate**, with the loss-of-key semantics below.

### Cross-process continuity

The chaining key is durable store-managed material read by every later collector process, so records written by earlier processes verify continuously with zero false chain breaks (tested per GH-232 NFR-3). Substituting a different key artifact fails verification the same way as a record edit, naming the affected domain.

### Loss-of-key failure semantics (audit-ledger precedent)

Losing or deleting the key artifact prevents continuation **and** verification of subsequently appended records: later appends fail, and non-empty reads fail classified rather than returning unverified records (`state.keys.missing` on a non-first open; corrupt content → `state.store.torn`; wrong permission bits → `state.permission.denied`). An artifact absent while guarded records already exist is never silently regenerated. Key rotation, escrow, and backup/restore are deferred with the audit-ledger precedent (GH-232 NG-6) and revisitable alongside that work (revisit trigger).

### Unresolved Questions

- [ ] Exact primitive, digest width, canonical-encoding details, and key-artifact filename pinned at plan time (owner: `@plan-writer`/`@coder`, GH-232 delivery).
- [ ] Runtime-edge primitive availability without a new third-party dependency confirmed at plan time; if unavailable, an explicit dependency decision record precedes any addition (owner: `@coder`; C-7).
- [ ] Key escrow / backup-restore posture for both chained planes (owner: Juliusz Ćwiąkalski; deferred with backup/restore work).

## Implementation Plan

1. **Contracts:** retro vocabulary additions (record shape with chain value, chain verdict, key-artifact naming, sidecar chain anchor) as types and `as const` data only; runtime APIs (cryptographic random bytes, the keyed-hash primitive) stay at the runtime edge.
2. **Sidecar consumer:** ensure-key (guarded get-or-create), append under the single dedicated collector fence covering the verified pre-append read, link computation, and the appends; verified read plus chain verification on every read path (collect, report, export).
3. **Key lifecycle:** generate once at first append with cryptographic randomness at the runtime edge; persist store-managed `0600` beside the sidecar; verify on open; classify open failures through the existing state identities; never regenerate silently when guarded records exist.
4. **Identity:** collector stamps per the claimed-identity convention; structural write-seam refusal (`retro.evidence.denied`) documented as write-path ownership plus claimed-identity marking.
5. **Tests:** the tamper mutation matrix (all pinned alteration classes including recomputed-unkeyed-checksum and key substitution) with zero false "verified" verdicts; cross-process continuity; key-exclusion assertions across lane environments, records, output, and configuration; key-open-failure classification; error-table sync for the three `retro` rows.
6. **Docs:** phase-7 doc-sync authors the retro-pipeline feature spec; this record joins the change spec's `links.decisions`.
- **Guardrails:** no change to the audit ledger or its construction (its caveat stands for its own domain); no new dependency without a decision record (C-7); forbidden-literals and branding-seam checks govern any new operator-facing naming; the deterministic render-path invariant (no model calls) holds across collect/report.

## Verification Criteria

- Metric: tamper mutation suite — 100% of pinned alteration classes flagged naming record position and trace id; 0 false "verified" verdicts on unaltered history — Window: GH-232 CI.
- Metric: key-artifact substitution — 100% detected as a verification failure naming the affected domain — Window: GH-232 CI.
- Metric: key occurrences outside the store-managed artifact and runtime-edge-injected data (lane environments, records, output, configuration) — Target: 0 — Window: GH-232 CI.
- Metric: cross-process verification of unaltered sidecar history — Target: 0 false chain breaks — Window: GH-232 CI.
- Metric: key-open-failure classification — absent → `state.keys.missing`, corrupt/wrong-schema → `state.store.torn`, wrong bits → `state.permission.denied`; documented-table drift in either direction — Target: 0 rows — Window: GH-232 CI.
- Metric: new third-party dependencies and forbidden literals introduced by the chain — Target: 0 — Window: GH-232 CI / `pnpm check`.

## Confidence Rating

**High** for the construction-class choice and the key-placement pattern: the divergence rationale rests on a documented, verifiable property of the incumbent construction (FNV-1a-64 invertibility, stated in the current audit-ledger spec), the keyed-hash family's forgery property is definitional, and the key-artifact pattern is delivered precedent. **Medium** for the exact primitive until the plan-time pin confirms runtime-edge availability without a new dependency (`TO-CONFIRM`). AI-generated confidence is not evidence; the mutation suite is.

## References

- GH-232 change spec (DEC-1/DEC-2/DEC-4, DM-2/DM-3/DM-4, NFR-2/NFR-3, RSK-1, §14 OQ-1, §21 security review): `doc/changes/2026-11/2026-11-06--GH-232--oss-retro-pipeline/chg-GH-232-spec.md`
- Ticket GH-232 (M1-S8, pinned integrity decision, binding ACs): https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/232
- Audit-ledger current truth (precedent key-artifact pattern; invertibility honesty caveat): `doc/spec/features/feature-audit-ledger.md`
- Retro concepts (P0 evidence plane, trace-tampering defense row): `doc/planning/concepts/retrospectives.md`
- [TDR-0004](TDR-0004-state-storage-engine.md) — state storage engine (store-managed artifacts, validated boundaries, least privilege)
- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — exit taxonomy the `retro.evidence.tamper-flagged` (exit 1) outcome rides on
- GH-223 change record (audit-ledger delivery): `doc/changes/2026-11/2026-11-06--GH-223--audit-ledger/`
