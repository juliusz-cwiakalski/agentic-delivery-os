---
id: TDR-0029
decision_type: tdr
status: Proposed
created: 2026-11-13
decision_date: null
last_updated: 2026-11-13
summary: "Resolve GH-294 OQ-2: the stop, parked, resumed, and park-edge kinds join the event taxonomy as a new declared version `v2` — one whole-taxonomy version carrying v1's six topics, with the three new kinds on `dispatch.attempt` and park-edge on `queue.graph`; every v1 kind and payload stays byte-identical; the envelope, per-(topic, lane) sequence ordering, overflow-to-repoll, and emission model are unchanged; the frame stamp and the reference surface render `taxonomyVersion: v2` from one declaration constant; v2 is the single spoken version and retires v1 from the subscribe surface. A v1 consumer keeps working under a six-point compatibility statement: frames keep their shape, v1 kinds are unchanged, the new (topic, kind) pairs are decodable and ignorable (ignore-and-continue, not repoll — the sequence stays contiguous), a stamp other than the pin is a version-drift signal answered by re-reading the reference surface, ordering/overflow semantics are untouched, and no v1 kind's payload grows in v2."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os event taxonomy on the resident daemon subscribe surface (GH-294 EVT-1..EVT-4)"
decision_scope: repo
review_date: null
business_impact: "The peak-pause episode becomes auditable on the published ledger surface without a protocol change; the next kind addition's cost stays fixed and known (a version), per TDR-0025 DC-5."
customer_impact: "A taxonomy consumer that pinned v1 keeps decoding every frame: nothing it listens for is renamed, removed, or re-semanted; it gains four ignorable (topic, kind) pairs and a moved version stamp; a consumer that validates the stamp gains an explicit version-drift signal instead of an undefined state."
classification:
  domains: [architecture, contracts, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: customers
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-294: PM routed OQ-2 to a record; record written before delivery planning finalizes)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-294 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-294 clarify-scope: OQ-2 framing — version identifier and v1-consumer compatibility)"
    - "@spec-writer (GH-294 specification v1.0: EVT-1..EVT-4, DEC-3, RSK-6, §8.2, §8.5)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-294 PR review — this record amends a published client contract's version line)"
  performers:
    - "@coder (GH-294 delivery: v2 declaration, emission projection kinds, drift/contract tests, reference surface)"
    - "@doc-syncer (event-taxonomy and resident-daemon spec reconciliation)"
  informed:
    - "Every taxonomy consumer (board, watch surfaces, M2-S16 engine-first operations, M2-S6 alarm/metric layers)"
    - "M2 stories that add future kinds (they budget a version bump, per DC-5)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A consumer needs v1 served concurrently with v2: reopen TDR-0025 DC-5's single-spoken-version rule — concurrent serving is an envelope-level protocol change and belongs in an ADR, not a taxonomy revision."
  - "A future kind must be added: budget a v3 under this record's scheme — never edit a shipped kind set in place, never add kinds under a stamp that has shipped."
  - "A v1 kind's payload must grow (e.g. nomination on `started`): that is DC-5's cheap additive channel and is a per-story decision recorded on that story; this record's default is that v2 keeps every v1 payload byte-identical."
  - "A consumer cannot tolerate the stamp move without a protocol negotiation: that is a control-protocol change (ADR territory), not a taxonomy version question."
links:
  related_changes: ["GH-294", "GH-290", "GH-291"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-13--GH-294--provider-peak-pausing/chg-GH-294-spec.md"
    - "doc/spec/features/feature-event-taxonomy.md"
    - "doc/spec/features/feature-spend.md"
  contracts: []
  decisions: ["TDR-0025"]
  diagrams: []
---

# TDR-0029: Event Taxonomy v2 — Peak-Pause Kinds Under a New Declared Version with Additive v1 Compatibility

## Context

GH-294 commits four new event kinds: `stop`, `parked`, and `resumed` on `dispatch.attempt` (EVT-1..EVT-3) and `park-edge` on `queue.graph` (EVT-4), each with declared payload fields — the bounded-grace deadline; reason `peak-window`, the profile, and `until`; the preserved session-state reference, the same branch, and the no-re-dispatch fact; and the queue-graph park lifecycle edge. Taxonomy v1 is delivered (GH-290): six closed topics, the eight-field event envelope with `taxonomyVersion` stamped on every frame outside `payload`, per-`(topic, lane)` process-scoped `sequence` as the only ordering guarantee with gap-to-repoll, one degraded-event overflow carriage stamped `repoll`, and the `events` reference surface generated from one authored declaration with bidirectional kind-set and per-kind emitted-payload-key drift comparisons.

Two delivered boundaries govern this decision. First, the taxonomy spec's own boundary: "Provider-aware peak-pausing shapes (stop, parked, resumed, and park-edge) are a future taxonomy version, never an in-place edit to v1." Second, TDR-0025 DC-5, the version boundary: v1 pins each topic's kind set; v1 may grow payload fields inside existing payloads; v1 may not add, remove, or rename a kind — "a kind is a version" — and DC-5 names these exact four kinds as "the first expected v2 candidate". DC-5 also records that the daemon speaks one version at a time, and that serving two versions concurrently is an envelope-level protocol change belonging in an ADR.

A contrast precedent exists: spend v2 (GH-291) added five payload keys additively under the **kept** `delivery.spend.v1` schema identity. That precedent kept a schema-identity *constant* while growing additive payload keys with no closed-set pin. The taxonomy stamp is a different mechanism: it names a closed, drift-tested kind set per topic, so it cannot stay while the kind set grows.

OQ-2 asks two things: which version identifier carries the four kinds, and what compatibility statement accompanies it for a v1-pinned consumer.

## Problem Framing (Clarified)

The identifier question is narrower than it looks, because TDR-0025 DC-5 already fixed the rule ("a kind is a version"); what remains is to (a) confirm the identifier literal and the versioning unit (whole taxonomy vs per-topic), (b) define precisely what a v1-pinned consumer experiences when the daemon it subscribes to begins speaking v2, and (c) keep the drift suite, the contract tests, and the reference surface coherent with one declared version. The compatibility statement is the load-bearing part: the v1 client posture is declared as "pin `taxonomyVersion`, switch on `(topic, kind)`, treat a sequence discontinuity or an overflow stamp as repoll" — it does not yet define unknown-kind or stamp-mismatch behavior, and v2 is the event that makes both reachable. The statement must define them without retroactively changing the v1 contract and without inventing a remedy that conflicts with the declared ones (repoll is for discontinuity and overflow; an ignorable additive kind is neither).

## Constraints (Hard Requirements)

### C-1: No in-place edit to v1

- **Statement:** No kind is added to, removed from, or renamed inside the shipped v1 declaration; v1's kind sets, payloads, envelope, ordering, and overflow stay as delivered.
- **Source:** prior decision (TDR-0025 DC-5; feature-event-taxonomy.md Boundaries; GH-294 DEC-3, G-9).
- **Verification:** test (drift suite + v1-declaration pin).
- **Negotiable:** no.

### C-2: The four kinds are declared and pinned like every delivered kind

- **Statement:** `stop`, `parked`, `resumed`, and `park-edge` carry declared per-kind payload field lists, producer coverage, and the delivered envelope/ordering/overflow rules; the bidirectional kind-set and per-kind emitted-payload-key comparisons extend to them.
- **Source:** AC (GH-294 F-7, EVT-1..EVT-4, NFR-6) and internal standard (TDR-0025 DC-4).
- **Verification:** test (contract suites per topic).
- **Negotiable:** no.

### C-3: The wire carries no protocol change

- **Statement:** No new wire type, no frame field outside `data`, no change to the eight-field envelope, the per-`(topic, lane)` sequence and its scope, the overflow mechanism, or the emission model (watermark, baseline, 64/tick burst).
- **Source:** prior decision (TDR-0025 DC-2/DC-3 consequences) and AC (GH-294 §8.5).
- **Verification:** test (envelope and emission suites).
- **Negotiable:** no.

### C-4: The daemon speaks one version at a time

- **Statement:** One declared version is spoken on the subscribe surface; concurrent serving of v1 and v2 is out of scope (ADR-level per TDR-0025's revisit triggers).
- **Source:** prior decision (TDR-0025 DC-5).
- **Verification:** test + code review.
- **Negotiable:** no.

### C-5: The v1-consumer contract stays coherent

- **Statement:** The compatibility statement must define unknown `(topic, kind)` pairs and stamp mismatch for a v1-pinned consumer using only the delivered vocabulary and remedies, without retroactively rewriting the v1 client posture.
- **Source:** AC (GH-294 RSK-6, §8.5).
- **Verification:** test (consumer-behavior suites) + review.
- **Negotiable:** no.

### C-6: One declaration, one version source

- **Statement:** The stamp on event frames, the degraded/overflow frame's stamp, and the reference surface's `taxonomyVersion` render from one declaration constant; the reference surface equals the declaration.
- **Source:** internal standard (TDR-0025 DC-3/DC-4 single-source discipline).
- **Verification:** test (reference-surface equality).
- **Negotiable:** no.

## Decision Drivers

**Technical drivers (ranked):**

1. **Contract coherence** — the version string is the mechanism that names a closed kind set; whatever it says must be true of every frame stamped with it.
2. **Minimal client-visible change** — v1 consumers should keep working by construction (shape unchanged, kinds additive, ignorable), not by hope.
3. **Test economy** — one version bump with the existing per-topic pinning machinery extended, not a new matrix.

**Operational drivers:**

4. **Precedent alignment** — follow TDR-0025's declared extension path verbatim; the spend-v2 kept-identity precedent is honored by recognizing where it does not apply.
5. **Cognitive load** — one whole-taxonomy version; no per-topic version matrix to reason about.
6. **Forward cost-fixing** — the next kind addition's price stays known: a version.

## Decision Rights (DACI)

Mirrors the `governance:` front matter. Driver: `@decision-advisor`. Decider: Juliusz Ćwiąkalski (human acceptance at the GH-294 PR review; AI does not accept this R2 record). Contributors: `@pm`, `@spec-writer`, `@decision-advisor`. Reviewers: `@readiness-reviewer`, `@reviewer`, human owner at the GH-294 PR review. Performers: `@coder` (declaration, emission, tests, reference surface), `@doc-syncer` (spec reconciliation). Informed: all taxonomy consumers and future kind-adding M2 stories.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Taxonomy v1 delivered: six topics, per-topic kind sets, eight-field envelope, stamp outside `payload` | FACT | doc/spec/features/feature-event-taxonomy.md | High — the base contract would differ | High |
| Boundary: peak-pausing shapes are "a future taxonomy version, never an in-place edit to v1" | FACT | feature-event-taxonomy.md (Boundaries) | High — C-1 would not be precedent-pinned | High |
| DC-5: v1 may not grow kinds; a kind addition is a version change; these four kinds are "the first expected v2 candidate"; one spoken version | FACT | TDR-0025 (DC-5, revisit triggers) | High — ALT-1/ALT-3 eligibility would change | High |
| DC-5 growth channel: payload fields inside existing payloads are additive in-place; clients tolerate unknown payload fields | FACT | TDR-0025 (DC-5 "v1 may grow") | Medium — the payload-growth note in D2 | High |
| Client posture: pin version, switch on `(topic, kind)`, repoll on sequence discontinuity or overflow stamp | FACT | feature-event-taxonomy.md (Overview) | Medium — the compatibility statement would redefine, not define | High |
| Drift machinery: bidirectional kind-set comparison, per-kind emitted-payload-key comparison, reference surface rendered from the declaration | FACT | feature-event-taxonomy.md (Overview, "Kinds and payloads") | Medium — test extension plan in D7 | High |
| Spend v2 added five payload keys under the kept `delivery.spend.v1` schema identity (no closed-set pin) | FACT | feature-spend.md (§Overview, DEC-6) | Low — used only as the contrast precedent | High |
| The codec leaves event `data` open, so a peer that ignores new fields keeps working | FACT | TDR-0025 (DC-2) | Medium — the ignorable-kinds guarantee | High |
| No known consumer switches exhaustively on `dispatch.attempt` kinds without a default branch | ASSUMPTION | repo consumer survey (board/watch/M2 stories in flight) | Medium — a crashing consumer would need migration; the statement mandates default-ignore for exactly this reason | Medium |
| Whether out-of-repo consumers pin v1 | TO-CONFIRM | none observable in-repo | Medium — the compatibility statement is written to protect an unknown v1 consumer regardless | Low |

## Mental Models & Techniques Used

- **Precedent as pavement** — treated TDR-0025 DC-5 as the standing rule and the decision as its first application, rather than re-deriving versioning policy.
- **Inversion** — asked "what breaks a v1 consumer": a renamed/removed kind, a payload change, an envelope change, a lost ordering rule, or an undefined stamp reaction. The compatibility statement is the inverse of that list.
- **Mechanism discrimination** — separated the two "additive under kept identity" precedents by mechanism: spend kept a schema constant with no closed-set pin; the taxonomy stamp *is* the closed-set pin, so keeping it while growing the set would make the stamp lie.
- **Second-order thinking** — traced "ignore vs repoll" for unknown kinds: a repoll on an ignorable kind would loop a compliant client (the condition persists), so ignore-and-continue is the only stable remedy; repoll stays reserved for discontinuity.
- **KISS** — one whole-taxonomy version literal; rejected per-topic versioning as a matrix nobody needs to reason about.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 |
|----------|-----|-----|-----|-----|-----|-----|
| ALT-0 (defer the kinds) | — | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 (add kinds under kept `v1` stamp) | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| ALT-2 (per-topic versions) | ⚠️ | ✅ | ❌ | ✅ | ❌ | ❌ |
| ALT-3 (declare `v2`, single spoken version) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails · ⚠️ = passes only via an accepted-risk exception (none claimed). ALT-0's "—" marks it as not reaching the question.

### Alternative 0 — Do Nothing / Defer the Kinds

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Ship peak pausing without taxonomy events; episodes live only on park records and surfaces.
- **Constraint compliance:** Fails C-2 — EVT-1..EVT-4 are committed contract items (spec §8.2, AC-F7-6); without them the episode is unauditable from the ledger (F-7 fails).
- **Driver fit:** Poor on driver 1 (the audit surface is the point of a published taxonomy).
- **Pros:** No version question today.
- **Cons:** The change's own AC fails; the question returns with the next consumer story.
- **Why rejected:** Fails a committed acceptance criterion.

### Alternative 1 — Additive Kinds Under the Kept `v1` Stamp

- **Eligibility:** Not eligible (fails C-1, C-5, C-6).
- **Summary:** Apply the spend-v2 precedent literally: declare the four kinds inside v1 and keep stamping frames `v1`.
- **Constraint compliance:** Fails C-1 — this is precisely the in-place kind-set edit GH-290 and DC-5 forbid. Fails C-5 — a v1-pinned consumer's pin now names a kind set it never agreed to; unknown kinds under a *matching* stamp are undefined behavior, the worst state for C-5. Fails C-6 — the drift comparison would either fail (the declaration changed under the pin) or be edited to accept the change, which is the in-place edit wearing a test costume.
- **Driver fit:** Scores on driver 2 only by fraud: the client-visible stability is superficial because the stamp's meaning changed.
- **Pros:** No stamp move; no consumer sees a foreign version string.
- **Cons:** The stamp exists to name the closed kind set; keeping it while growing the set destroys the one guarantee versioning here provides.
- **Why rejected:** Mechanism discrimination (Mental Models): the spend precedent kept a schema constant for additive keys with no closed-set pin; this stamp *is* the pin. A `v1.1`-style scheme fails for the same reason plus inventing a literal convention the delivered surface does not have (stamps are whole-version strings).

### Alternative 2 — Per-Topic Version Scheme

- **Eligibility:** Not eligible (fails C-3, C-5, C-6).
- **Summary:** Version only the two affected topics; the other four "stay v1"; the frame stamp stays global or becomes per-topic.
- **Constraint compliance:** Fails C-3 — per-topic stamps require a new frame field or a changed envelope (the stamp is one taxonomy-level value outside `payload`). A global `v1` stamp over two topics carrying v2 kinds fails C-6 (the stamp misstates the contract) and C-1-in-spirit. Fails C-5 — a consumer now needs a version matrix to know what any frame means.
- **Driver fit:** Fails driver 5 (cognitive load) outright; fragments DC-5's single-spoken-version rule.
- **Pros:** Untouched topics never change version.
- **Cons:** The versioning unit is the declaration, not the topic; the reference surface, the stamp, and the drift suite all assume one version.
- **Why rejected:** Solves a problem no consumer has, at the cost of a protocol change.

### Alternative 3 — Declare `v2`, the Single Spoken Version

- **Eligibility:** Eligible (passes C-1 through C-6).
- **Summary:** A new whole-taxonomy version `v2` carrying all six topics with the four additive kinds, a moved stamp, and an explicit compatibility statement.
- **Constraint compliance:** C-1 by declaration (v1 untouched); C-2 by extending the existing pinning machinery; C-3 by leaving the wire alone; C-4 by retiring v1 as the spoken version; C-5 by defining the two undefined reactions; C-6 by one constant.
- **Driver fit:** Best on all six drivers.
- **Pros/Cons:** See Trade-offs.
- **Why chosen:** See Decision.

## Decision

- **Decision:** Adopt **ALT-3**, as seven binding clauses:

  1. **D1 — Identifier.** The version is `v2`: a plain whole-version literal following the delivered `v1` convention. The taxonomy is the versioning unit; all six topics move together, and every topic's declared `version` in the reference record follows the taxonomy's single version value.
  2. **D2 — Declaration content.** `v2` declares the six v1 topics unchanged in shape, frame, lane rule, ordering, and overflow, with two kind-set additions: `dispatch.attempt` — `started`, `refused`, `completed`, `stop`, `parked`, `resumed`; `queue.graph` — `entry`, `dependency-edge`, `release`, `remove`, `park-edge`. Every v1 kind emits exactly its delivered payload fields — byte-identical, no v1 payload grows in v2 (the new information rides the new kinds' payloads: the grace deadline; reason, profile, and `until`; the session-state reference, branch, and no-re-dispatch fact; the park lifecycle edge). DC-5's payload-growth channel remains available for future per-story additions; this record's default is not to use it here.
  3. **D3 — Wire unchanged.** The eight-field envelope, per-`(topic, lane)` process-scoped `sequence` with gap-to-repoll, the one-degraded-event overflow carriage, the watermark/baseline/burst emission model, and the unknown-topic refusal are exactly as delivered.
  4. **D4 — The stamp moves.** Every event frame and the degraded/overflow frame carry `taxonomyVersion: "v2"`, rendered with the reference surface from one declaration constant. The stamp is a declaration identifier, never an ordering signal. In practice the stamp moves at deploy with the daemon process that speaks it; there is no in-place version flip of a running daemon, and the deploy restart already restarts sequence counters — a discontinuity clients detect as delivered.
  5. **D5 — Single spoken version.** `v2` supersedes `v1` on the subscribe surface and the `events` reference surface; `v1` is retired by this owner decision (the explicit retirement DC-5 requires), not served concurrently. Concurrent serving remains ADR-level and a revisit trigger. The v1 declaration remains the historical contract of record in TDR-0025 and the delivered spec history.
  6. **D6 — The v1-consumer compatibility statement.** Published with the v2 declaration, six points:
     1. *Frames keep their shape.* The eight `data` keys and their order are unchanged; every v2 frame is structurally decodable by a v1 consumer.
     2. *Nothing you listen for changed.* Every v1 `(topic, kind)` pair and its payload field list is unchanged; no rename, removal, or re-semantics.
     3. *The four new pairs are decodable and ignorable.* `stop`, `parked`, `resumed`, and `park-edge` are additive `(topic, kind)` identities; a consumer's kind switch must carry a default-ignore branch. They are **not** a discontinuity — `sequence` stays contiguous per `(topic, lane)` — so the correct reaction is ignore-and-continue, never repoll (a repoll would loop: the condition persists).
     4. *A foreign stamp is a version-drift signal, not an error.* A consumer that validates `taxonomyVersion` against its pin treats a stamp it does not pin as: re-read the `events` reference surface, repin if it can speak `v2`, otherwise keep default-ignoring unknown kinds. It forces no disconnect and changes no ordering behavior.
     5. *Ordering and overflow semantics are untouched.* Gap-to-repoll, restart-as-discontinuity, and the degraded-event overflow carriage behave exactly as declared in v1 (the degraded frame's stamp moves with everything else).
     6. *The remedies do not multiply.* Repoll remains reserved for sequence discontinuity and overflow exactly as delivered; version drift and unknown kinds get their own reactions above. No new client action is required to keep receiving v1 content.
  7. **D7 — Tests and surface move with the declaration.** The bidirectional kind-set and per-kind emitted-payload-key comparisons extend to the v2 declaration (including the four new kinds); the per-topic contract tests assert the v2 declaration and the v1-payload byte-identity; the reference surface renders `taxonomyVersion: v2` from the same constant as the frames; the declaration-integrity check covers the new kinds.

- **Rationale (tied to drivers):** Driver 1 (coherence) is why ALT-1 is disqualified on mechanism, not preference: a stamp that survives a kind-set change stops naming anything. Driver 2 (minimal client-visible change) is maximized by D2/D3/D6: the only observable differences for a v1 consumer are four ignorable kinds and the stamp value. Driver 3 (test economy): D7 extends existing comparisons rather than inventing a scheme. Driver 4 (precedent): this *is* DC-5's declared path — "S17's stop, parked, resumed, and park-edge kinds are the first expected v2 candidate" — executed as written. Driver 5 (cognitive load) eliminates ALT-2's matrix. Driver 6 keeps the next kind's cost fixed.

- **Decider:** Juliusz Ćwiąkalski (owner) — human acceptance at the GH-294 PR review; AI does not accept this R2 record.

- **Conditions for revisit:** See `revisit_triggers`; principally a real consumer needing concurrent v1/v2 serving (ADR territory) or a consumer that cannot tolerate the stamp move (protocol negotiation, ADR territory).

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-6 (see the ALT-3 compliance row). No accepted-risk exceptions are claimed.

## Trade-offs & Consequences

### Positive Outcomes

- The peak-pause episode is fully auditable from the ledger with the delivered envelope, ordering, and overflow guarantees; no protocol change rides along.
- The versioning discipline survives its first real exercise intact: the next kind addition is a known cost (a version), and v1 remains a truthful historical contract.
- The compatibility statement converts two previously undefined consumer reactions (unknown kind, foreign stamp) into defined, testable behavior.

### Negative Outcomes

- Every v1-pinned consumer that validates the stamp observes a one-time version drift at deploy; consumers without a default-ignore branch on their kind switch must add one (the statement mandates it; the ASSUMPTION row tracks that no in-repo consumer currently lacks one).
- The taxonomy version line moves for all six topics even though only two gained kinds — the price of a single versioning unit; a consumer that cared only about `phase.state` still sees the stamp move.
- Retiring v1 means no consumer can ask the daemon to speak v1; anyone needing that must wait for an ADR-level protocol change.

### Unresolved Questions

- [ ] Exact payload field lists for the four kinds (owner: @spec-writer/@coder — declared in the v2 declaration, pinned by the per-kind tests; the spec's EVT table and the M2 contracts section govern the content).
- [ ] Whether any out-of-repo consumer pins v1 and validates stamps (owner: @pm — surfaced in the PR description; the statement protects them regardless).

## Implementation Plan

1. **Declaration first** — author the v2 declaration (six topics, two kind-set additions, per-kind payload field lists) as the single source; the frames, the degraded stamp, and the reference surface render from it.
2. **Emission projection** — extend the projection with the four kinds from the durable park/stop/resume records under the delivered watermark/baseline/burst model; no projection read of its own.
3. **Tests** — extend the drift suite and per-topic contract tests per D7, including v1-payload byte-identity assertions and the compatibility behaviors (ignore-and-continue on new kinds; stamp-drift handling).
4. **Reference surface and mounts** — `events list/describe` render v2; the M2 reference page and help inventory reconcile per the delivered page-root discipline.
5. **Spec reconciliation** — feature-event-taxonomy moves from "EXTENSION PATH (S17 — not v1)" to the declared v2 section with the compatibility statement; resident-daemon's summary line updates its taxonomy reference.

## Verification Criteria

- Metric: v1 `(topic, kind)` pairs emitting byte-identical payload field lists under v2 — Target: 100% — Window: contract suites, every run.
- Metric: declared-but-unemitted or emitted-but-undeclared kinds on the v2 declaration — Target: 0 (bidirectional comparison) — Window: drift suite.
- Metric: consumer suites demonstrating ignore-and-continue on the four new kinds and defined stamp-drift handling — Target: all pass — Window: behaviour suites.
- Metric: stamp agreement between event frames, degraded frames, and the reference surface — Target: one constant, zero divergence — Window: every run.

## Confidence Rating

High. The rule applied is DC-5 verbatim, the drift and pinning machinery already exists and extends naturally, and the compatibility statement defines the only two previously undefined reactions using delivered vocabulary. The residual unknown (out-of-repo v1 consumers) is addressed by construction, not by evidence.

## References

- TDR-0025 (the v1 decision: DC-2 envelope, DC-4 reference surface, DC-5 version boundary) — `doc/decisions/TDR-0025-public-event-taxonomy-v1-subscribe-surface.md`
- Event taxonomy current truth: `doc/spec/features/feature-event-taxonomy.md`
- GH-294 specification: `doc/changes/2026-11/2026-11-13--GH-294--provider-peak-pausing/chg-GH-294-spec.md` (§8.2, DEC-3, RSK-6, §8.5)
- Spend v2 kept-identity precedent (contrast): `doc/spec/features/feature-spend.md` (DEC-6)
- Ticket: GitHub issue 294 (milestone M2); M2 contracts pack §S17
