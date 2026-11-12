---
id: TDR-0025
decision_type: tdr
status: Proposed
created: 2026-11-11
decision_date: null
last_updated: 2026-11-11
summary: "Publish the daemon subscribe surface as event taxonomy v1 governed by the M2 contract section: four new topics (`queue.graph`, `dispatch.attempt`, `phase.state`, `blockers.state`) beside the delivered `queue` and `lanes`, a seven-field change envelope with per-lane monotonic `sequence` as the only ordering guarantee, the delivered one-degraded-event overflow-to-repoll behaviour preserved for every topic, and the taxonomy version pinned by per-topic contract tests over a machine-readable reference surface rather than by prose. Amended 2026-11-11 (GH-290 spec v1.1, DoR iteration 1): `lane` is a non-empty string on every v1 event topic with `ref` nullable only on `blockers.state`, `occurredAt` is the source record's own timestamp, `sequence` is a process-scoped counter allocated at emission, the unknown-topic change is recorded as an acceptance becoming a refusal, additivity is restated as no new wire type, state record kind, schema version, or dependency with exactly three error rows in one new `events` kind, and the reference record gains `shape`, `frame`, `lane`, and per-kind `emitted`."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os resident daemon subscribe surface (control protocol v1 event taxonomy)"
decision_scope: repo
review_date: null
business_impact: "The subscribe surface becomes a published client contract, so watch commands, scripts, boards, and the M2 consumer stories integrate against one documented taxonomy instead of scraping state files."
customer_impact: "A client that consumes daemon events can rely on a declared topic set, a declared kind set per topic, one ordering rule, and an explicit repoll instruction on overflow — and can name the taxonomy version it speaks. A client that subscribed to a topic outside the declared set loses the stream it was served (the `lanes` snapshot under a name that was never a topic) and gains a classified `events.topic-unknown` refusal; that acceptance-to-refusal is the one intentional client-visible behaviour change."
classification:
  domains: [architecture, contracts, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: customers
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-290: PM routed the two clarify-scope decisions to a record; record written before dependent delivery)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-290 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-290 clarify_scope: kind-set authority and version-pinning decisions)"
    - "@decision-advisor (repository analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-290 PR review — this record pins a client-facing contract)"
  performers:
    - "@coder (GH-290: taxonomy declarations, envelope emission, reference surface, per-topic contract tests, and the reconciled M2 reference page in the mount phase)"
    - "@doc-syncer (plan phase 8 reconciliation: feature-resident-daemon and the planning pages other than the M2 reference page, which the mount phase (plan phase 5) reconciles)"
  informed:
    - "M2-S12 attempts read side and M2-S16 engine-first operations (consume attempt events)"
    - "M2-S15 queue lifecycle completion and M2-S17 peak pausing (declare the next kind additions)"
    - "M2-S4 board and the watch surface (consume the taxonomy)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A client needs one ordering guarantee across topics for a lane: reopen DC-2's per-(topic, lane) sequence scope instead of adding a second sequence field or a global sequencer."
  - "A kind must be added, removed, or renamed inside v1: reopen DC-5 and publish a new taxonomy version; never edit a shipped kind set in place."
  - "A future topic's source can lack a lane or a `ref`: declare that nullability in that topic's own taxonomy version; never widen v1's non-null `lane` rule or its per-topic `ref` rule in place."
  - "A client needs the delivered wrong-label acceptance back (a subscription to an undeclared topic answered with the `lanes` snapshot): that path is removed by DC-4 and is not restored; a new topic is a taxonomy version change, and a migration path would reopen DC-4's refusal identity, never the acceptance."
  - "The delivered `queue` and `lanes` snapshot topics must expose per-event kinds: reopen DC-1's kind authority and DC-4's per-topic reference record rather than deriving a kind set from the planning example text."
  - "The repoll instruction must be carried somewhere other than the reference surface: reopen DC-3's carriage and keep the value `repoll` unchanged."
  - "A second taxonomy version is served concurrently: reopen DC-5's single-spoken-version rule; serving two versions is an envelope-level protocol change and belongs in an ADR."
  - "The deliverable drifts from the control protocol's frame shape (event `data` closed, envelope placed outside `data`, or a new wire type): stop and route to an ADR, because the delivered codec and v0 compatibility are the envelope's guard."
links:
  related_changes: ["GH-290", "GH-238"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-resident-daemon.md"
    - "doc/planning/oss-tooling/milestones/m2/contracts.md"
    - "doc/planning/oss-tooling/milestones/m2/commands/events.md"
    - "doc/planning/oss-tooling/milestones/m2/test-scenarios.md"
    - "doc/planning/oss-tooling/milestones/m2/architecture.md"
    - "doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md"
    - "doc/changes/2026-11/2026-11-11--GH-290--event-taxonomy/chg-GH-290-spec.md"
  contracts:
    - "packages/core/src/contracts/control.ts"
    - "packages/core/src/domain/control-codec.ts"
    - "packages/core/src/domain/control-session.ts"
    - "packages/core/src/domain/watch-stream.ts"
    - "packages/core/src/app/control-server.ts"
    - "packages/core/src/app/daemon-runtime.ts"
    - "packages/core/src/app/watch.ts"
    - "packages/cli/src/daemon-compose.ts"
  diagrams: []
  decisions: ["TDR-0005", "TDR-0023"]
  experiments: []
  metrics: []
  roadmap_items: ["M2-S13", "M2-S17"]
---

# TDR-0025: Public Event Taxonomy v1 for the Daemon Subscribe Surface — Contract-Governed Kind Sets, Per-Lane Sequence Ordering, Preserved Overflow-to-Repoll, Version Pinned by Per-Topic Tests

## Context

- **FACT:** The delivered subscribe surface declares exactly two topics: `CONTROL_TOPICS = ["queue", "lanes"]` (`packages/core/src/contracts/control.ts:39`), and `status` is a wire type in `CONTROL_WIRE_TYPES`, not a topic (`control.ts:25-36`). *(read 2026-11-11)*
- **FACT:** A delivered event carries `data: { topic, cursor, snapshot }` and nothing else (`packages/core/src/domain/control-session.ts:199-204`; the union is `ControlEventData` at `control.ts:100-103`). There is no `kind`, `lane`, `ref`, `sequence`, `occurredAt`, or `payload` on the wire. *(read 2026-11-11)*
- **FACT:** The delivered `cursor` is a **per-topic** revision, not a per-lane sequence: `lastPublished` is keyed by topic, the cursor increments when that topic's serialized snapshot changes, and an unchanged snapshot publishes nothing (`packages/core/src/app/control-server.ts:316-330`). *(read 2026-11-11)*
- **FACT:** The delivered watch projection is snapshot-only and covers exactly `queue` and `lanes`; the first observation of a topic is a baseline rather than an event (`packages/cli/src/daemon-compose.ts:376-410`). *(read 2026-11-11)*
- **FACT:** The delivered subscribe path validates no topic value. The handler is typed over the literal pair but passes the requested topic straight through (`packages/cli/src/daemon-compose.ts:1164-1171`), the projection resolves every topic other than `queue` to the **`lanes`** snapshot (`daemon-compose.ts:383-384`), the session's `subscribe` checks only the subscription-capacity bound (`packages/core/src/domain/control-session.ts:186-192`), and the codec validates no topic (`packages/core/src/domain/control-codec.ts:94-120`). A `subscribe` for `status` or any other undeclared string therefore succeeds today and returns frames carrying the requested topic name with the `lanes` snapshot: an accepted, mislabelled stream, not a classified refusal. *(read 2026-11-11)*
- **FACT:** Overflow is delivered and uniform: each subscription has a bounded buffer, overflow deletes only that subscription and emits exactly one `degraded` event carrying `subscriber-overflow` for that topic (`control-session.ts:195-220`); the same capacity bound also caps the per-connection subscription count, which refuses with `daemon.subscriber-degraded` (`control-session.ts:186-194`); the value is `daemon.subscription-buffer` with default `256` (`packages/core/src/contracts/daemon.ts:22`; `control-server.ts:285`). *(read 2026-11-11)*
- **FACT:** The delivered client already degrades to a repoll: on `subscriber-overflow` the watch loop emits the overflow line and returns `"poll"` (`packages/core/src/app/watch.ts:153-158`), and the projection emits `degraded: "subscriber-overflow"` for the topic (`packages/core/src/domain/watch-stream.ts:71-79`). *(read 2026-11-11)*
- **FACT:** The codec leaves the event `data` body open. It validates the version, frame kind, wire type, principal, exactly-one-of `payload`/`data`/`error`, and the absence of `id` on events (`packages/core/src/domain/control-codec.ts:94-120`); it does not close or whitelist the fields inside `data`. Additive fields inside `data` are therefore wire-compatible with v0 and v1 peers. *(read 2026-11-11)*
- **FACT:** The M2 contract section `§Event taxonomy v1` (`doc/planning/oss-tooling/milestones/m2/contracts.md:62-88`) names four new topics, states that `queue.graph` extends `queue`, enumerates each topic's kinds, fixes the envelope's seven change fields, fixes per-lane monotonic ordering with gap-to-repoll, requires overflow to stay defined per topic and preserved for every topic, and requires the taxonomy version to be pinned by contract tests per topic. *(read 2026-11-11)*
- **FACT:** The M2 reference page `doc/planning/oss-tooling/milestones/m2/commands/events.md` contradicts that section on two points: its example prints `queue.graph` with 6 kinds and `dispatch.attempt` with 4, and its DESCRIPTION gives `dispatch.attempt` the stop, parked, and resumed kinds (`events.md:26-30,69-76`). The contract section enumerates 4 and 3 kinds for those topics, and the S17 mapping in the same contracts file assigns the stop, parked, resumed, and park-edge shapes to M2-S17 (`contracts.md:170-179`). *(read 2026-11-11)*
- **FACT:** The M2 test scenarios assert a monotonic `sequence` and a pinned `data.taxonomyVersion` for `queue.graph` (SC-M2-S13-01) and `data.overflow == "repoll"` for each of the four new topics (SC-M2-S13-02) (`test-scenarios.md:215-230`). *(read 2026-11-11)*
- **FACT:** The M2 architecture states the same invariant independently: event topics are ordered per lane with monotonic sequence numbers, and a slow consumer overflows to a repoll rather than receiving a reordered stream (`architecture.md:251-252,269-270`). *(read 2026-11-11)*
- **Why now:** GH-290 (M2-S13) is the story that turns the delivered two-topic snapshot stream into a published taxonomy. Until it lands, two planning pages disagree about the kind set, no client can name a version, and nothing can pin the contract.

## Problem Framing (Clarified)

"Extend the topics" hides four separable questions. Each one, answered wrong, produces a contract that looks complete and cannot be consumed:

1. **Who owns the kind set when two planning pages disagree?** A count is not a contract. If the reference page's example governs, S13 publishes shapes that belong to S17 and S17 then changes a shipped kind set in place.
2. **What is the event contract, given that the delivered publish path carries a per-topic snapshot revision and no event kind?** The delivered `cursor` answers "which revision of this topic's snapshot is this", not "which change is this, and in what lane order". A taxonomy needs the second question answered, with a field that survives the snapshot-diff publish path.
3. **Is overflow redefined per topic, or is one delivered behaviour declared per topic?** The contract says overflow is "defined per topic and preserved for every topic". Reading that as five new policies would fork one bounded-buffer mechanism into six.
4. **What makes the version enforceable?** A version string in a prose page is a claim. Pinned-by-tests means a machine-readable surface a test can compare against, per topic.

Root cause versus symptom: the delivered protocol answers *delivery* (a bounded, deduplicated snapshot stream) and not *change semantics* (what happened, in which lane, in what order). The disagreement between `contracts.md` and `events.md` is a symptom of having no single declared authority for the change semantics. The desired outcome is one declared taxonomy, with one authority, one envelope, one ordering rule, one overflow policy per topic, and one test surface that fails when any of them drifts.

Out of scope: S17's stop, parked, resumed, and park-edge shapes (declared as the extension path, decided at S17); the queue lifecycle mutations of M2-S15; telemetry attribution of M2-S14; the `board` surface; and every new persistence or transport axis. Additivity is exact and narrow: **no new wire type, no new state record kind, no payload schema version, no migration, and no new package dependency** — the one contract addition outside the taxonomy itself is **exactly three error rows in one new `events` domain kind** (DC-4), which is an additive error-table row set, not a new wire type and not new persistence.

## Constraints (Hard Requirements)

### C-1: The kind set is the contract section's enumeration, and S17's shapes are out of S13 scope

- **Statement:** Each S13 topic declares exactly the kinds the M2 contract section enumerates — `queue.graph`: entry, dependency-edge, release, remove; `dispatch.attempt`: started, refused, completed; `phase.state`: began, completed, reopened; `blockers.state`: published, updated, cleared. No stop, parked, resumed, or park-edge kind is declared by S13, and no kind from the planning example counts is declared.
- **Source:** AC (GH-290) + contractual (`doc/planning/oss-tooling/milestones/m2/contracts.md` §Event taxonomy v1, §S17 mapping)
- **Verification:** test (per-topic contract test asserts the declared kind set equals the enumerated set) + code review
- **Negotiable:** no

### C-2: Every published event carries the v1 envelope

- **Statement:** Each event carries `topic`, `kind`, `lane`, `ref`, `sequence`, `occurredAt`, and a topic-specific `payload` object; a client can classify an event from `topic` + `kind` without parsing the payload. `lane` is a non-empty string on every v1 event topic and `ref` is nullable only on `blockers.state` (DC-2's per-topic rule).
- **Source:** contractual (`contracts.md` §Event taxonomy v1 — payload shapes)
- **Verification:** test (per-topic contract test over emitted events)
- **Negotiable:** no

### C-3: Per-lane monotonic `sequence` is the only ordering guarantee

- **Statement:** Within one daemon incarnation and one `(topic, lane)` pair, events are ordered by a monotonic `sequence`; a client that observes a gap, or any value at or below its last observed value for that pair, repolls instead of inferring order. A daemon restart is a declared discontinuity answered by the same repoll. No other ordering (arrival order, `occurredAt`, snapshot cursor) is a guarantee.
- **Source:** contractual (`contracts.md` §Event taxonomy v1 — ordering guarantees; `architecture.md` §Ordering)
- **Verification:** test (monotonicity over a stream; gap detection routes to repoll)
- **Negotiable:** no

### C-4: Overflow-to-repoll survives unchanged for every topic

- **Statement:** For every topic, an overflowing subscription receives exactly one `degraded` event carrying `subscriber-overflow`, only that subscription is dropped, and the subscriber repolls; no event is silently lost, and no topic declares a different policy inside v1.
- **Source:** AC (GH-290 — overflow degrade behaviour preserved for every topic) + prior decision (`doc/spec/features/feature-resident-daemon.md` §Control protocol v1)
- **Verification:** test (SC-M2-S13-02 per topic: buffered subscription overflows, one degraded event, that subscription gone, repoll declared)
- **Negotiable:** no

### C-5: The topic set is closed and `status` is not a topic

- **Statement:** The taxonomy declares exactly six topics — `queue`, `lanes`, `queue.graph`, `dispatch.attempt`, `phase.state`, `blockers.state` — and `status` remains a wire type. `events list` returns that set with no extras and no omissions.
- **Source:** contractual (`contracts.md` §Event taxonomy v1 — topics) + prior decision (`CONTROL_TOPICS` and `CONTROL_WIRE_TYPES`, TDR-0023 context)
- **Verification:** test (reference-surface output equals the declared topic set; `status` absent)
- **Negotiable:** no

### C-6: The taxonomy version is pinned by tests over a machine-readable surface

- **Statement:** The version is readable from the reference surface (`taxonomyVersion` plus one record per topic carrying `name`, `version`, `shape`, `parent` where a topic has one, `frame`, `lane`, `kinds[]` with a per-kind `name`, `emitted`, and `payloadFields[]`, the derived `payloadFields[]`, `ordering`, and `overflow`), and a per-topic contract test fails when the published version, the declared shape, frame, lane rule, kinds, payload fields, ordering rule, or overflow value drift. The two delivered snapshot topics declare an empty `kinds[]` and `payloadFields: []`.
- **Source:** AC (GH-290 — taxonomy document version pinned by tests) + contractual (`m2/commands/events.md` §OUTPUT; GH-290 spec v1.1 DEC-K)
- **Verification:** test (per-topic contract tests; reference surface vs declaration equality)
- **Negotiable:** no

### C-7: Additive within a version, versioned for anything else

- **Statement:** Payload fields may be added inside v1 and clients tolerate unknown payload fields. Adding, removing, or renaming a kind; changing the ordering guarantee or its scope; changing an overflow policy; removing an envelope field; changing an envelope field's nullability; or changing a topic's parentage is a taxonomy version change, never an in-place edit.
- **Source:** contractual (`contracts.md` — payload fields additive within a taxonomy version) + internal standard (a published client contract)
- **Verification:** code review (any kind-set diff carries a version change) + test (a v1 client ignores an added payload field)
- **Negotiable:** no

## Decision Drivers

1. **One contract for every client (the ticket's purpose).** A watch command, a script, and a board must consume the same declared taxonomy, or each invents its own reading of the same state files.
2. **Precedent stability on the expensive axis.** Kind sets, ordering, and the topic set are the parts a client cannot absorb cheaply once published; payload fields are the part it can. Fix the first now, keep the second open.
3. **Behaviour preservation.** The delivered bounded buffer, single degraded event, per-subscription drop, and repoll already work and are already proven; a taxonomy that redefines them buys nothing.
4. **Enforceability.** A version that prose asserts is a version that drifts. The pin must be a machine-readable comparison a test runs.
5. **Scope honesty toward S17.** S17 owns peak pausing, stop, park, and resume. S13 pre-declaring those shapes would make S17's delivery a silent contract edit.
6. **Solo-maintainer cost and the paved road.** One declared taxonomy beside the existing control vocabulary, one reference surface, one set of per-topic tests — no second contract store, no new wire type, no new package.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-290 clarify-scope routed two decisions to a record; this record is authored before dependent delivery.
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-290 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (GH-290 clarify_scope: kind-set authority, version-pinning mechanism); `@decision-advisor` (repository analysis and record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-290; the owner for final acceptance of this record.
- **Performers:** `@coder` — taxonomy declarations, envelope emission on the publish path, the reference surface, per-topic contract tests, and the reconciled M2 reference page in the mount phase (plan phase 5); `@doc-syncer` — plan phase 8 reconciliation of the system spec and the remaining planning pages.
- **Informed:** the M2 consumers named in `governance.informed`; any client already reading `queue` or `lanes` events, because the envelope adds fields inside `data`; and any client subscribed to a topic outside the six, because that subscription becomes a refusal (DC-4).

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The delivered topic set is two topics and `status` is a wire type. | FACT | `packages/core/src/contracts/control.ts:25-40` (read 2026-11-11) | If a `status` topic existed, C-5's closed set would need a seventh entry. | High |
| Delivered events carry `{topic, cursor, snapshot}` with no kind and no lane. | FACT | `packages/core/src/domain/control-session.ts:199-204`; `control.ts:100-103` (read 2026-11-11) | The envelope would be partially delivered and the delta smaller; the contract still stands. | High |
| The delivered `cursor` is a per-topic snapshot revision, not a per-lane sequence. | FACT | `packages/core/src/app/control-server.ts:316-330` (read 2026-11-11) | If the cursor were per lane, ALT-5 would be viable; it is not, because the publish path keys only by topic. | High |
| Overflow already emits exactly one degraded event per overflowing subscription and drops only that subscription. | FACT | `packages/core/src/domain/control-session.ts:195-220` (read 2026-11-11) | A preserved behaviour would have to be built, and C-4 would move from regression to delivery. | High |
| The delivered watch client already returns to poll mode on `subscriber-overflow`. | FACT | `packages/core/src/app/watch.ts:153-158` (read 2026-11-11) | The repoll half of C-4 would be unproven in the client; the server half still holds. | High |
| The codec leaves event `data` open, so additive envelope fields stay wire-compatible with v0/v1 peers. | FACT | `packages/core/src/domain/control-codec.ts:94-120` (read 2026-11-11) | A closed body would force a protocol version bump and an ADR; the taxonomy would be blocked. | High |
| The M2 contract section enumerates 4 kinds for `queue.graph` and 3 for `dispatch.attempt`, and assigns stop/parked/resumed/park-edge to S17. | FACT | `doc/planning/oss-tooling/milestones/m2/contracts.md:62-88,170-179` (read 2026-11-11) | C-1's authority would be a different page and the S17 boundary would move. | High |
| The reference page's example counts (6 and 4) and its stop/parked/resumed prose contradict that enumeration. | FACT | `doc/planning/oss-tooling/milestones/m2/commands/events.md:26-30,69-76` (read 2026-11-11) | If the example governed, C-7 would be violated at delivery. | High |
| The delivered `queue` and `lanes` topics carry no kind on the wire, and no delivered authority declares their kind sets. | FACT | `control-session.ts:199-204`; `daemon-compose.ts:376-410`; absent from `contracts.md` §Event taxonomy v1 (read 2026-11-11) | If a kind set existed for them, DC-4's per-topic record would have six declared kind sets rather than four plus two declared snapshot topics. | High |
| The overflow repoll value asserted by SC-M2-S13-02 is `data.overflow == "repoll"`, while the delivered degraded frame carries only `degraded: "subscriber-overflow"`. | FACT | `doc/planning/oss-tooling/milestones/m2/test-scenarios.md:223-230`; `control-session.ts:209-216` (read 2026-11-11) | Which surface carries the value changes DC-3's carriage but not its vocabulary or its behaviour. | High |
| The delivered subscribe path validates no topic value: it accepts any topic string and answers it with the `lanes` snapshot labelled with the requested topic. | FACT | `packages/cli/src/daemon-compose.ts:383-384,1164-1171`; `packages/core/src/domain/control-session.ts:186-192`; `packages/core/src/domain/control-codec.ts:94-120` (read 2026-11-11) | The change's client-visible consequence would be understated as an error-identity difference; it is an acceptance becoming a refusal (DC-4). | High |
| No consumer outside the repository depends on the event `data` body being closed. | ASSUMPTION | Bounded repository search for `ControlEventData` consumers (2026-11-11); the subscribe surface ships as part of the CLI | An external client with a strict decoder would reject added fields; the codec and the additive-payload rule are the mitigation. | Medium-High |
| Per-topic contract tests are the right pin rather than a single whole-taxonomy test. | ASSUMPTION | AC wording "pinned by tests"; SC-M2-S13-01/02 are per-topic | A whole-taxonomy test would still pin the version but would not localize a drift. | High |
| The GH-290 specification v1.1 declares `queue` and `lanes` as snapshot topics carrying no kind (`kinds: []`, `payloadFields: []`, `ordering: snapshot-revision`) and the four event topics as the only kind-bearing topics. | FACT | `chg-GH-290-spec.md` F-1, F-6, DEC-B, DEC-K (read 2026-11-11) | DC-4's record key set and the emitted-set comparison would need a different shape. | High |
| The GH-290 specification v1.1 carries `overflow: "repoll"` on both the degraded frame and every topic's reference record, rendered from one constant. | FACT | `chg-GH-290-spec.md` F-5, EVT-2, DEC-C (read 2026-11-11) | DC-3's carriage sentence would return to a specification detail rather than a resolved position. | High |
| The GH-290 specification v1.1 declares every kind emitted except `queue.graph.remove` (`emitted: false`, owned by M2-S15), and derives `phase.state.began` from a phase's first completion. | FACT | `chg-GH-290-spec.md` F-3, DEC-J (read 2026-11-11) | A declared kind without a v1 producer would pass the declaration test and fail a consumer. | High |

## Mental Models & Techniques Used

- **First principles:** What must a client be able to answer from the wire alone? *What changed* (`topic` + `kind`), *about what* (`lane`, `ref`), *in what order* (`sequence`), *when* (`occurredAt`), and *with what detail* (`payload`). Those answers are the envelope; nothing else is required, and nothing in it may be inferred.
- **Inversion:** What would make a published taxonomy unfixable? A kind set taken from an example count; S17's shapes shipped early; ordering promised by arrival or timestamp; overflow redefined per topic until six mechanisms exist; a version that only prose asserts. C-1, C-3, C-4, C-6, and C-7 exclude exactly those failures.
- **Second-order thinking:** The expensive promise is the kind set, because a client switches on a kind. Publishing a kind set now fixes every future client's `switch`, and it fixes S17 as a version bump rather than an edit. Publishing the payload field list as *additive* keeps the cheap axis cheap, which is what makes the expensive axis affordable.
- **Systems thinking:** Authority, declaration, emission, reference surface, and tests are one chain. An authority that the declaration does not follow is a contradiction; a declaration the emitter does not follow is a lie; a reference surface that the declaration does not generate is a second source of truth; a test that reads prose cannot pin any of them. Every link is pinned once in DC-1, DC-2, DC-4.
- **Opportunity cost:** Reusing the delivered per-topic `cursor` as the ordering field costs one field and buys a guarantee that cannot express lane order or a lane gap (ALT-5). Reusing the planning example's counts costs nothing today and costs a shipped kind set that S17 must break (ALT-1).
- **Constraint-first elimination:** Every alternative is screened against C-1…C-7 before any driver ranking, so no option wins on convenience while violating a `negotiable: no` gate.
- **Paved road / KISS:** One declared taxonomy beside the delivered control vocabulary, the delivered degraded-event mechanism, the delivered codec's open `data` body, and the existing milestone page-root discipline. No new wire type, package, state record kind, payload schema version, or dependency; the only contract addition outside the taxonomy is exactly three error rows in one new `events` domain kind.
- **Reversibility:** A taxonomy version is additive. A wrong payload field is removed by a new version, not by a breaking edit; a wrong kind set is superseded the same way. The transport behaviour that cannot be reverted cheaply — the bounded buffer and the degraded event — is deliberately left untouched.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 kind authority | C-2 envelope | C-3 per-lane order | C-4 overflow preserved | C-5 closed topic set | C-6 pinned version | C-7 additive/versioned |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 do nothing | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| ALT-1 planning example counts as authority | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-2 one flat `state` topic with a kind field | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-3 prose-only contract in the system spec | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| ALT-4 selected: contract-governed kinds, envelope, preserved overflow, versioned reference surface pinned per topic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 reuse the delivered per-topic `cursor` as the ordering field | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing / Keep the Two Snapshot Topics

- **Eligibility:** Not eligible (fails C-1, C-2, C-3, C-5, C-6).
- **Summary:** Keep `queue` and `lanes` as snapshot-diff topics with the delivered `cursor`, and leave the change semantics to each client's reading of the state files.
- **Constraint compliance:** Passes C-4 (overflow is untouched) and C-7 (nothing is published, so nothing can drift) trivially; fails C-1, C-2, C-3, C-5, and C-6 outright.
- **Driver fit:** Fails driver 1 (the ticket's purpose) entirely; driver 2 is moot; driver 4 is inverted.
- **Pros:** Zero change, zero compatibility risk, no new surface.
- **Cons:** Four delivery-state planes remain unobservable, the two planning pages keep disagreeing, and no client can name a version.
- **Why rejected:** It is the absence of the deliverable, not a design choice.

### Alternative 1 — Take the Planning Reference Page's Kind Counts as Authority

- **Eligibility:** Not eligible (fails C-1, C-7).
- **Summary:** Publish `queue.graph` with 6 kinds and `dispatch.attempt` with 4, including the stop, parked, and resumed kinds, because the reference page prints those counts.
- **Constraint compliance:** Passes C-2, C-3, C-4, C-5, and C-6 (the envelope, ordering, overflow, topic set, and pinning are independent of the kind set). Fails C-1 (the counts are an example, not an enumeration, and contradict the contract section) and C-7 (publishing S17's kinds inside v1 makes S17's delivery either a silent v1 edit or a v1-to-v2 bump for shapes the contract already assigned to S17).
- **Driver fit:** Serves driver 5 worst of all alternatives — it spends S17's scope in S13 — and undermines driver 2 by publishing a kind set the contract does not define.
- **Pros:** One page fewer to reconcile; the example's kind counts look more "complete" to a casual reader.
- **Cons:** Three of the four `dispatch.attempt` kinds' payloads are undefined at S13; S17's stop event must record a bounded-grace deadline and its resume event a session-state reference, neither of which S13 can specify; the contract section becomes advisory.
- **Why rejected:** A count in an example cannot define a payload, and the contract section assigns those shapes to another story with their own payload requirements.

### Alternative 2 — One Flat `state` Topic With a Kind Field

- **Eligibility:** Not eligible (fails C-1, C-5).
- **Summary:** Publish a single `state` topic and discriminate every change by `kind`, avoiding per-topic subscriptions and per-topic version records.
- **Constraint compliance:** Passes C-2, C-3, C-4, C-6, and C-7. Fails C-5 (the contract fixes six topics and `queue.graph` extending `queue`) and C-1 (the contract enumerates kinds per topic, which a flat topic set cannot express without renaming every kind).
- **Driver fit:** Attractive on driver 6 (one subscription for everything) and poor on drivers 1, 2, and 3 — it renames every kind and moves the delivered `queue`/`lanes` topics.
- **Pros:** A client that wants "everything" subscribes once; one kind namespace.
- **Cons:** Breaks the delivered topic names and every existing subscriber; requires a kind namespace that the contract does not define; makes per-topic overflow declarations meaningless.
- **Why rejected:** It changes the contract's topic set and the delivered surface to save a subscription.

### Alternative 3 — A Prose-Only Contract in the System Spec

- **Eligibility:** Not eligible (fails C-6, C-7).
- **Summary:** Document the six topics, kinds, envelope, ordering, and overflow in `feature-resident-daemon.md` and rely on review to keep them true.
- **Constraint compliance:** Passes C-1 through C-5 (the documented sets can be correct at authoring time). Fails C-6 (no machine-readable surface, so nothing pins the version) and C-7 (a prose kind set is edited by the next author without a version change).
- **Driver fit:** Fails driver 4 directly; driver 2 is unserved because nothing detects drift.
- **Pros:** No command surface, no page root, no coverage entry.
- **Cons:** The AC's "pinned by tests" is unmet; the taxonomy becomes the third page that can disagree with the other two.
- **Why rejected:** The acceptance criterion names tests, and a prose set has no comparison a test can run.

### Alternative 4 — Selected: Contract-Governed Kinds, Envelope, Preserved Overflow, Versioned Reference Surface Pinned Per Topic

- **Eligibility:** Eligible.
- **Summary:** The M2 contract section is the sole authority for the kind sets; each event carries the seven-field change envelope inside the delivered event `data`; per-(topic, lane) monotonic `sequence` is the only ordering guarantee with a gap-to-repoll rule; overflow keeps the delivered one-degraded-event, one-subscription-dropped, repoll behaviour and each topic declares the value `repoll`; the taxonomy publishes `taxonomyVersion: v1` through `events list` / `events describe <topic>` and is pinned by per-topic contract tests.
- **Constraint compliance:** Passes C-1…C-7 (matrix above).
- **Driver fit:** Best on every driver: one contract (1), the expensive axis fixed and the cheap axis open (2), the delivered overflow untouched (3), a machine-readable pin (4), S17 left to S17 (5), and no new wire type, package, state record kind, or dependency — the one additive contract change is three error rows in one new `events` kind (6).
- **Pros:** Additive on the wire (the codec leaves `data` open); the delivered overflow mechanism and client repoll path are reused rather than rebuilt; a kind-set drift fails a named test instead of a review; the version gives S17 a declared place to land.
- **Cons:** Six per-topic test suites to maintain; a version bump becomes mandatory for any kind change, including S17's; the reference surface and the declared constants must be one source or they drift; the two delivered topics declare no kind, so their per-topic pin asserts shape, frame, ordering, and overflow rather than a kind-set comparison.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and it satisfies them by declaring what the delivered protocol leaves open instead of changing what it already fixes.

### Alternative 5 — Reuse the Delivered Per-Topic `cursor` as the Ordering Field

- **Eligibility:** Not eligible (fails C-2, C-3).
- **Summary:** Publish the kinds and payloads in the envelope but keep `cursor` as the ordering field, avoiding a second counter on the wire.
- **Constraint compliance:** Passes C-1, C-4, C-5, C-6, C-7. Fails C-2 (the envelope names `sequence` and `occurredAt`; `cursor` cannot carry both roles without changing its meaning) and C-3 (the cursor is a per-topic snapshot revision that advances on content change and says nothing about lane order or a lane-local gap).
- **Driver fit:** Weak on driver 2 — it reuses a field for a promise it cannot keep — and neutral elsewhere.
- **Pros:** One fewer counter; no new field for existing clients to ignore.
- **Cons:** A snapshot-diff publish path cannot truthfully promise lane order with a topic-wide revision; the gap rule becomes unverifiable because a cursor jump is indistinguishable from a coalesced snapshot change.
- **Why rejected:** It gives the field a meaning the delivered computation cannot support, and an unverifiable ordering promise is worse than a declared absence of one.

## Decision

- **Decision:** Adopt **ALT-4**, recorded as five decisions that bind together.

  1. **DC-1 — The M2 contract section is the sole authority for the kind sets, and S17's shapes stay out of S13.**
     - Authority is `doc/planning/oss-tooling/milestones/m2/contracts.md` §Event taxonomy v1. S13 declares exactly: `queue.graph` — `entry`, `dependency-edge`, `release`, `remove`; `dispatch.attempt` — `started`, `refused`, `completed`; `phase.state` — `began`, `completed`, `reopened`; `blockers.state` — `published`, `updated`, `cleared`.
     - An event's identity is the pair (`topic`, `kind`). `kind` is scoped to its topic and is not globally unique: `completed` exists on both `dispatch.attempt` and `phase.state`, and a client must discriminate on the pair.
     - The example kind counts on the M2 reference page (`queue.graph` 6, `dispatch.attempt` 4) and its stop/parked/resumed prose are pre-contract planning text and do not govern. The page is reconciled to the contract section in GH-290's mount phase (plan phase 5), which lands the reconciled page before the page-token tests read it; the system spec is reconciled in the documentation phase (plan phase 8).
     - The stop, parked, resumed, and park-edge shapes belong to M2-S17 (`contracts.md` §S17 mapping) and are the recorded extension path, not S13 scope. Under DC-5 their arrival is a taxonomy version change.
     - **Consequence for later changes:** a story that needs a kind must amend the contract section and publish a new version. It may not add a kind to a shipped taxonomy, and it may not treat a reference-page example as an enumeration.

  2. **DC-2 — One envelope on every published event, and per-(topic, lane) `sequence` is the only ordering guarantee.**
     - Every event carries `topic`, `kind`, `lane`, `ref`, `sequence`, `occurredAt`, and a topic-specific `payload` object. All seven change fields are present on every event, so a client never has to distinguish "absent" from "unknown". **Counting convention:** this record's "seven-field envelope" always names exactly these seven change fields; counted with the `taxonomyVersion` stamp they are the eight `data` keys of an event frame (`topic`, `kind`, `lane`, `ref`, `sequence`, `occurredAt`, `payload`, `taxonomyVersion`), so "seven change fields" and "eight `data` keys" are the same frame counted two ways. **`lane` is a non-empty string on every v1 event topic**: all four delivered lane derivations produce one — the entry `ref`, the delivery `ref`, the `changeRef`, and the question record's required `lane` — so v1 has no lane-less witness and no nullable `lane`, and a future topic whose source can lack a lane must declare a nullable `lane` in its own taxonomy version rather than widening this rule. **`ref` is nullable only on `blockers.state`**: the source `blocker.question` record's `ref` is `string | null` and the shipped `blockers publish` path records `null`, while `queue.graph`, `dispatch.attempt`, and `phase.state` carry a non-empty string. `occurredAt` is **the source record's own ISO-8601 UTC timestamp** — never the tick time and never an injected clock — so a re-observation of the same record yields the same value: `recordedAt` on `queue.entry`, `queue.dependency`, `queue.lease`, `daemon.lane`, and `dispatch.attempt`, `askedAt` on `blocker.question`, `answeredAt` on `blocker.answer`, and `timestamp` on `phase.transition`. `occurredAt` carries no ordering guarantee. Every event-topic frame also carries the taxonomy version stamp `taxonomyVersion: "v1"` inside `data` and outside `payload`, so the seven change fields carry the change and the stamp names the version a client is reading (DC-4).
     - The guarantee is scoped to one topic, one lane, and one daemon incarnation: within a `(topic, lane)` pair, `sequence` is monotonic, and a client that observes a non-contiguous value for that pair — a gap, or any value at or below its last observed value — repolls. The counters are process-scoped, so a daemon restart restarts them and is a declared discontinuity that a client detects the same way; `sequence` is a wire ordering value, not a durable revision. No cross-topic interleaving order is promised, because subscriptions are per topic and the daemon holds no cross-topic sequencer.
     - The delivered transport `cursor` stays and keeps its delivered meaning — the per-topic snapshot revision used for delivery dedupe. It is **not** the ordering guarantee, and a client may not infer lane order or a lane gap from it.
     - The envelope rides inside the delivered event `data` body, which the codec leaves open (`control-codec.ts:103-117`), so a v0 or v1 peer that ignores the new fields keeps working.
     - **Consequence for later changes:** a new event field goes inside `data` and inside `payload`. A field outside `data`, a new wire type, or a closed body is a control-protocol change and an ADR, not a taxonomy revision.

  3. **DC-3 — Overflow keeps the delivered behaviour and every topic declares the same policy.**
     - Overflow stays exactly as delivered: the per-subscription bounded buffer overflows, that subscription receives exactly one `degraded` event carrying `subscriber-overflow` for its topic, only that subscription is dropped, and the subscriber repolls. The single capacity bound (`daemon.subscription-buffer`, default 256) that also caps the per-connection subscription count is unchanged.
     - The contract reads "defined per topic and preserved for every topic" as: each topic's reference record declares its overflow policy, and in v1 every topic's declared value is `repoll`. One mechanism, six identical declarations — not six policies.
     - The vocabulary is `repoll`. The reference surface carries it as `topics[].overflow = "repoll"`, and per the GH-290 specification (DEC-C) the degraded frame carries the same value as `data.overflow`, both rendered from one declaration constant; the same frame also carries `taxonomyVersion: "v1"`, and the delivered `degraded` marker and its closed vocabulary are untouched. The carriage does not change the vocabulary or the behaviour.
     - No event is silently lost on any topic; a topic that cannot keep the guarantee is a defect, not a policy choice.
     - **Consequence for later changes:** a topic that wants a different overflow policy is a taxonomy version change, and a change to the dropped-subscription mechanism is a control-protocol change.

  4. **DC-4 — The taxonomy is a versioned published contract with a machine-readable reference surface, pinned per topic.**
     - The taxonomy publishes `taxonomyVersion: "v1"` and one record per topic carrying `name`, `version`, `shape` (`snapshot` | `event`), `parent` (only `queue.graph`, value `queue`), `frame` (the ordered frame field list), `lane` (the lane-selection rule), `kinds[]`, `payloadFields[]`, `ordering`, and `overflow` — the `/events list --json` and `/events describe <topic> --json` envelope keys. A `kinds[]` element is a record carrying `name`, `emitted`, and `payloadFields[]`. The two delivered snapshot topics declare `kinds: []` and `payloadFields: []` — no fabricated `snapshot` kind, because their wire frames carry no `kind` — and the ordering value `snapshot-revision`; the four event topics declare their kind sets with `sequence-per-lane`. The human page may print a kind count and lineage; the machine envelope is the contract.
     - The reference surface is mounted as one unit, following the milestone page-root discipline GH-288 established: the prompt-set entry, the edge composition, the help entries, the M2 reference page, the coverage-inventory row, and the per-command page root all land together, so the surface is reachable from root `--help` only when it is complete.
     - The surface follows the delivered machine-envelope and exit conventions (`{ ok, command, data, error?, warnings? }`; exit `0` produced, `1` refused, `2` platform failure) and the declared error identities `events.topic-unknown`, `events.verb-unknown`, `events.taxonomy-unavailable`. Exit-code meaning is TDR-0005's; this record adds no exit class. `events.topic-unknown` is also the daemon's subscribe refusal for a topic outside the six, decided from the declaration before any store read.
     - **The unknown-topic change is an acceptance becoming a refusal — one intentional, client-visible v1 behaviour change.** The delivered subscribe path accepts any topic string and serves the `lanes` snapshot labelled with the requested topic (Context FACT); after this change the same request is refused with `events.topic-unknown`. **Compatibility note:** the client-visible consequence is that a client which subscribed to an undeclared topic loses a stream whose data belonged to `lanes` under a name that was never a topic, and gains a classified refusal it can act on; no conforming client loses its own data, because the frames it received were never the topic it asked for. Removing the wrong-data path is part of the decision, not a side effect of adding an error identity, and the record does not describe the change as "only the error identity differs".
     - Pinning is per topic: the contract test asserts the topic's declared version, shape, frame, lane rule, kind set with per-kind `emitted`, payload fields, ordering rule, and overflow value, asserts that emitted events satisfy the envelope, and asserts that the reference-surface output equals the declaration — so the declaration is the single source and the reference surface cannot drift from it.
     - **Consequence for later changes:** the taxonomy declaration is the only place a kind, a payload field list, an ordering rule, or an overflow value is authored. A surface that hardcodes its own copy has created the second source of truth this decision removes.

  5. **DC-5 — The version boundary: what v1 pins, what v1 may grow, and what forces v2.**
     - **v1 pins:** the six-topic set; each topic's `shape`, `frame`, `lane` rule, kind set (with each kind's `emitted` flag), ordering value, and overflow value; the seven change fields and their per-topic nullability; per-(topic, lane) monotonic sequencing with the gap-to-repoll rule; and the reference-surface keys.
     - **v1 may grow:** payload fields inside an existing topic's payload object, and payload detail that does not alter the kind set or the envelope. Clients tolerate unknown payload fields, which is what makes this growth non-breaking.
     - **v1 may not grow:** adding, removing, or renaming a kind; changing the ordering guarantee or its scope; changing an overflow policy; removing or renaming an envelope field; changing an envelope field's nullability (a nullable `lane`, or a nullable `ref` on a topic where v1 declares none); changing a topic's parentage. Each of these is a taxonomy version change: a new declared version, a new reference-surface version, and contract tests for it, with the old version served or retired by an explicit owner decision. S17's stop, parked, resumed, and park-edge kinds are the first expected v2 candidate.
     - A client states the taxonomy version it speaks; the daemon speaks one version at a time in v1 of the control protocol.
     - **Consequence for later changes:** a story that adds a kind must budget a version bump and its tests. If v1 is still unpublished at that time, finalizing it inside v1 is an explicit owner decision recorded on that story, never an unrecorded edit.

- **Rationale (tied to drivers):** DC-1 ends the ambiguity with the cheapest possible move — it names one authority and leaves S17's shapes where the same contract file already puts them, so the expensive axis is decided once (drivers 1, 2, 5). DC-2 supplies exactly the fields a client needs to act, and scopes the ordering promise to what the delivered publish path can actually keep, so no client builds on a guarantee the server cannot make (drivers 1, 3, 4). DC-3 preserves a delivered, tested mechanism and unifies six declarations instead of forking the mechanism six ways (driver 3). DC-4 turns the acceptance criterion into a comparison a test runs, with one authored source and a reference surface generated from it, and it replaces the delivered wrong-label acceptance with one classified refusal (driver 4). DC-5 fixes the cost of every future change in advance: payload detail is cheap, a kind is a version, and S17 has a declared landing place (drivers 2, 5, 6).
- **Record type:** TDR. The decision fixes the declared taxonomy, its reference surface, and its version discipline inside the delivered control protocol v1. It is additive on the wire (`data` is open, no wire type or topic slot changes) with exactly one intentional client-visible behaviour change on the subscribe path — an unknown topic is refused instead of served another topic's snapshot. The protocol's frame shape, versioning, and overflow mechanism are already decided by the delivered control protocol and its spec. `classification.blast_radius` is `customers` because clients consume the contract; a future change to the protocol envelope, or concurrent version serving, is ADR-level and is listed as a revisit trigger rather than decided here.
- **Decider:** Juliusz Ćwiąkalski (owner).
- **Authorization:** Status `Proposed`. Human acceptance is recorded at the GH-290 PR review; AI does not accept this R2 record and grants no authority until then. On acceptance, `decision_date` is set and a `review_date` is fixed for the first post-implementation retrospective.
- **Conditions for revisit:** See `revisit_triggers`; the first GH-290 post-implementation retrospective confirms that the declared kinds match the contract section, that emitted events carry the envelope on all six topics, that overflow produces one degraded event and a repoll per topic, and that the reference surface equals the declaration.

### Constraint Compliance Attestation

The chosen alternative (ALT-4) satisfies every constraint C-1 through C-7. No accepted-risk exceptions are taken and no constraint is violated.

| Constraint | Attestation |
|---|---|
| C-1 | The declared kind sets are exactly the contract section's enumeration (DC-1); no S17 shape is declared, and the planning example counts are recorded as non-governing. |
| C-2 | Every event carries `topic`, `kind`, `lane`, `ref`, `sequence`, `occurredAt`, `payload` (DC-2); `lane` is a non-empty string on every v1 event topic and `ref` is nullable only on `blockers.state`; the envelope rides inside the delivered open `data` body. |
| C-3 | Per-(topic, lane) monotonic `sequence` within one daemon incarnation is the sole guarantee, with a gap-to-repoll rule and a restart declared as the same discontinuity; the delivered per-topic `cursor` is explicitly excluded as an ordering signal (DC-2). |
| C-4 | The delivered bounded-buffer, one-degraded-event, one-subscription-dropped behaviour is preserved and declared per topic with the value `repoll`; no silent loss (DC-3). |
| C-5 | Exactly six topics are declared and `status` stays a wire type; `events list` returns the declared set with equality asserted (DC-1, DC-4). |
| C-6 | The version, shape, frame, lane rule, kinds with their `emitted` flag, payload fields, ordering, and overflow are readable from the reference surface and pinned per topic; the surface is generated from the declaration (DC-4). |
| C-7 | Payload fields are additive inside v1; every kind, ordering, overflow, envelope (including its per-topic nullability), or parentage change is a version change with its own tests (DC-5). |

## Trade-offs & Consequences

### Positive Outcomes

- One declared taxonomy covers the delivery state planes a client acts on, so a watch command, a script, and a board consume the same contract instead of each parsing state files.
- A kind-set drift fails a named per-topic test rather than surviving review, and the reference surface cannot drift from the declaration because it is generated from it.
- The delivered overflow mechanism, bounded buffer, and client repoll path are reused unchanged, so the preserved-behaviour acceptance criterion is a regression check rather than new construction.
- S17 has a declared landing place: its stop/parked/resumed/park-edge shapes become a version bump with their own payload requirements, instead of an edit to a shipped kind set.
- The event envelope is additive on the wire because the codec leaves `data` open, so v0 and v1 peers keep interoperating.
- The delivered wrong-label acceptance is removed: a topic outside the six can no longer be answered with another topic's snapshot under the requested name.

### Negative Outcomes

- One delivered acceptance becomes a refusal. A client that subscribed to an undeclared topic loses the (mislabelled) stream it had and must handle `events.topic-unknown`; this is the single intentional client-visible behaviour change in v1, and it is a removal of a wrong-data path rather than a lost contract.
- The taxonomy becomes a second compatibility axis beside the control protocol version, so a client now reasons about both. This is the price of not closing the event body.
- Six per-topic test suites must be maintained, and each must be updated when a version changes.
- Any future kind addition is a version bump, including additions the project would prefer to treat as routine. That friction is deliberate: it is what makes a published kind set trustworthy.
- Two delivered topics (`queue`, `lanes`) declare no kind, so their per-topic pin asserts shape, frame, ordering, and overflow rather than a kind-set comparison — a narrower commitment for those two topics than for the four event topics.
- The reference surface introduces a command family that must be mounted as one unit across prompt set, composition, help pages, coverage inventory, and page root, or the help gates fail in both directions.

### Unresolved Questions

- [x] **Resolved by GH-290 spec v1.1 DEC-B.** `queue` and `lanes` are declared snapshot topics carrying no kind (`kinds: []`, `payloadFields: []`, `ordering: snapshot-revision`), not per-event kind sets and not a fabricated `snapshot` kind; the emitted-set equality is scoped to event topics. (owner: `@spec-writer`, GH-290 specification; recorded here so the record's envelope rule and the declaration agree.)
- [x] **Resolved by GH-290 spec v1.1 DEC-C.** The `overflow: "repoll"` value is carried on both the degraded frame (`data.overflow`) and every topic's reference record, rendered from one declaration constant; DC-3's value, vocabulary, and behaviour are unchanged.
- [x] **Resolved by GH-290 spec v1.1 DEC-J.** Every declared kind has a v1 producer except `queue.graph.remove`, which is declared with `emitted: false` and owned by M2-S15; `phase.state.began` is derived from a phase's first completion rather than recorded.
- [ ] Whether any consumer outside the repository decodes event `data` strictly enough to reject added fields (owner: `@reviewer`, GH-290 review; the codec and the additive-payload rule are the mitigation; carried as OQ-1 in the specification).

## Implementation Plan

1. **Declaration.** Declare the taxonomy beside the delivered control vocabulary in `packages/core/src/contracts/control.ts` (or a sibling contracts module re-exported from it): the six topics, each topic's `shape`, `parent` where it has one, `frame` field list, lane rule, kind list (each kind carrying `name`, `emitted`, and payload field list; empty on the two snapshot topics), the derived payload field list, the per-topic ordering and overflow values, and the taxonomy version constant. Types and closed `as const` data only; no I/O and no behavior.
2. **Emission.** Extend the publish path so an emitted event carries the envelope inside `data`, with: a per-(topic, lane) monotonic `sequence` **allocated once per emitted event, at emission, by the publishing process** — a process-scoped counter, not seeded from a ledger and **not allocated from the durable state revision**; `occurredAt` copied from **the source record's own timestamp** (`recordedAt` on `queue.entry`, `queue.dependency`, `queue.lease`, `daemon.lane`, and `dispatch.attempt`; `askedAt` on `blocker.question`; `answeredAt` on `blocker.answer`; `timestamp` on `phase.transition`) — never the tick time and never an injected clock; and the topic-specific `payload`. The sequence counters are process-scoped, so **a daemon restart restarts them and is a declared discontinuity that a client detects (any value at or below the last observed) and answers with a repoll**; `sequence` is a wire ordering value, not a durable revision. The event projection folds the one shared whole-store `readRecords()` view per tick that the delivery plan owns (spec NFR-2/DEC-N), so no fold takes its own read. Keep the delivered per-topic `cursor` and its snapshot-dedupe meaning unchanged, and keep the delivered suppressed-when-unchanged publish rule.
3. **Overflow.** Leave the delivered bounded-buffer, one-degraded-event, one-subscription-dropped path unchanged; assert its per-topic uniformity in tests rather than reimplementing it.
4. **Reference surface.** Mount `events list` and `events describe <topic>` as one unit — prompt-set entry, edge composition, help entries, M2 reference page under the M2 page root, and the coverage-inventory row — generating the envelope's `topics[]` records from the declaration so the surface cannot carry a second copy.
5. **Contract tests.** One suite per topic asserting the declared version, shape, frame, lane rule, kind set with per-kind `emitted` (and the empty kind list on the two snapshot topics), payload fields, ordering rule, and overflow value; envelope conformance over emitted events; monotonicity plus a gap-to-repoll case and a restart discontinuity case; the SC-M2-S13-02 overflow case per topic; and reference-surface-versus-declaration equality.
6. **Specification reconciliation.** State the taxonomy in `doc/spec/features/feature-resident-daemon.md` §Control protocol v1 (topics, envelope, ordering, overflow, version, and the unknown-topic refusal) in the documentation phase (plan phase 8), and reconcile the M2 reference page's example counts and its stop/parked/resumed prose to the contract section in the mount phase (plan phase 5), which lands the reconciled page before any page-token test reads it.

## Verification Criteria

- Metric: declared kind sets — each topic's declared kinds equal the contract section's enumeration exactly. Target: exact set equality for the four S13 topics (C-1). Window: GH-290 CI.
- Metric: envelope conformance — every emitted event on every subscribed topic carries all seven change fields plus the `taxonomyVersion` stamp, with `lane` a non-empty string on every event topic and `ref` nullable only on `blockers.state`. Target: 100% of emitted events (C-2). Window: GH-290 CI.
- Metric: ordering — `sequence` is strictly increasing per `(topic, lane)` in a recorded stream, and a synthetic gap or a restart-like drop routes the client to a repoll. Target: 0 orderings that contradict the sequence, and a passing gap-and-restart discontinuity test (C-3). Window: GH-290 CI.
- Metric: overflow parity — for each of the six topics, one overflowing subscription yields exactly one `degraded` event carrying `subscriber-overflow`, that subscription is gone, and every other subscription still receives events. Target: identical for all six topics (C-4, SC-M2-S13-02). Window: GH-290 CI.
- Metric: topic-set equality — `events list` returns the six declared topics and no `status` topic. Target: exact equality (C-5). Window: GH-290 CI.
- Metric: version pinning — each per-topic test fails when the version, the shape, the frame, the lane rule, a kind, a payload field, the ordering rule, or the overflow value drifts from the declaration. Target: one failing test per drift class, demonstrated (C-6). Window: GH-290 CI.
- Metric: additive tolerance — a v1 consumer decodes an event that carries an added payload field without failing, and the reference surface reports the field list it declares. Target: decode succeeds; declared list unchanged unless versioned (C-7). Window: GH-290 CI.
- Metric: unknown-topic refusal — a `subscribe` for a topic outside the six is refused with `events.topic-unknown` before any store read, and no frame carries a topic label whose data came from another topic. Target: one classified refusal, zero mislabelled streams (DC-4). Window: GH-290 CI.
- Metric: surface reachability — the `events` family appears in root `--help` only with its help page, coverage row, and page root present, and both help gates are green. Target: both gates green with the page byte-registered under the M2 page root (DC-4). Window: GH-290 CI.

## Confidence Rating

**High** for the kind-set authority, the S17 boundary, the envelope, the ordering rule's scope, and overflow preservation: every input is verified in delivered source — the two-topic constant, the snapshot-diff publish path with a per-topic cursor, the bounded buffer with its single degraded event, the client's return to poll mode, and the codec's open event body — and the contract section fixes the kinds, the envelope, the ordering rule, and the version-pinning requirement in writing.

**Medium** for two points, both closed by the GH-290 specification rather than left open. First, the delivered `queue` and `lanes` topics carry no kind; spec v1.1 DEC-B declares them snapshot topics carrying none, and the emitted-set comparison is scoped to event topics. Second, the `overflow: "repoll"` carriage differs between the test scenario's assertion and the delivered frame; spec v1.1 DEC-C carries the value on both the frame and the reference record, rendered from one constant. One premise in this record was wrong rather than open: the delivered subscribe path never refused an unknown topic — it accepted one and served the `lanes` snapshot under the requested name — and the 2026-11-11 amendment records that as an acceptance becoming a refusal (RF-8). None of these changes the decision. AI-generated confidence is not evidence, and the human decider owns acceptance.

## Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-11-11 | DC-2: `lane` is a **non-empty string** on every v1 event topic (all four delivered lane derivations produce one) and `ref` is nullable only on `blockers.state`, where `blocker.question.ref` is `string \| null` and the shipped publish path records `null`; a future topic whose source can lack a lane or a ref declares that nullability in its own taxonomy version. The envelope bullet, C-2, the evidence table, and the verification metric now say the same thing, and the `lane: null` witness is withdrawn. | DoR findings RF-2 and RF-3 (readiness iteration 1, change GH-290): no declared lane rule could produce `null` (the blocker record's `lane` is required, `packages/cli/src/commands/blockers.ts:139-141` requires `--lane`), so the record's "unleased queue entry" example was unprovable and contradicted the queue-graph lane rule; and `blockers.state` was silent on the one envelope field a client must key on, which a production-shaped published question always sends as `null`. |
| 2026-11-11 | DC-2 and Implementation Plan item 2: `occurredAt` is **the source record's own timestamp** (`recordedAt`, `askedAt`, `answeredAt`, `timestamp` per kind), never an injected clock; `sequence` is a **process-scoped counter allocated once per emitted event at emission**, not allocated from the durable state revision, and a daemon restart is a declared discontinuity a client detects and answers with a repoll. | DoR finding RF-7 (readiness iteration 1, change GH-290): the specification and test plan implement a source-record timestamp (a re-observation yields the same value) and a process-scoped counter (spec DEC-I), and the rule "the record you cite is the rule you ship" would otherwise have shipped a record contradicting the code it governs. |
| 2026-11-11 | DC-4 (the unknown-topic identity, spec DEC-L): the change is recorded as an **acceptance becoming a refusal**, not as an error-identity change. The delivered subscribe path accepts any topic and serves the `lanes` snapshot labelled with the requested topic; after this change the same request is refused with `events.topic-unknown`. A Context FACT, an evidence row, a positive outcome, a negative outcome, a Verification metric, `customer_impact`, and a revisit trigger carry the compatibility note. | DoR finding RF-8 (readiness iteration 1, change GH-290): `daemon-compose.ts:383-384` resolves every non-`queue` topic to the `lanes` snapshot and neither the session nor the codec validates the topic, so "only the identity differs" was false. The refusal is the right outcome; the record now states the client-visible consequence it actually has. |
| 2026-11-11 | Problem Framing, the Paved-road mental model, and ALT-4's driver-fit line: additivity is restated exactly — **no new wire type, state record kind, payload schema version, migration, or package dependency, and exactly three error rows in one new `events` domain kind**. | DoR advisory A-6 (readiness iteration 1, change GH-290): the Problem Framing excluded "any new error identity" while DC-4 declares three `events.*` identities, so the record contradicted itself in the same file. |
| 2026-11-11 | DC-1 and Implementation Plan item 6: the M2 reference page is reconciled in **the mount phase (plan phase 5)**, before the page-token tests read it; the system spec stays in the later documentation phase. Governance performers and the contextual phase note follow. | DoR advisory A-3 (readiness iteration 1, change GH-290): the plan reconciles the page in Phase 5 because the Phase-5/6 gates read it, while the record assigned it to phase-7 doc sync. The decision is unchanged — only the phase that lands it. |
| 2026-11-11 | DC-4 and DC-5: the reference record's key set gains `shape`, `parent`, `frame`, `lane`, per-kind `emitted`, and the empty `kinds: []` / `payloadFields: []` on the two snapshot topics, with `snapshot-revision` ordering; DC-5 pins nullability and every per-topic declaration, and forbids an in-place nullability change. | DoR findings RF-4 and the spec's DEC-K (readiness iteration 1, change GH-290): the record's key list could not express the shape split, the per-kind payloads, the lane rule, or the declared-not-emitted kind, and a fabricated `snapshot` kind would have made the emitted-set comparison unobservable. |

**Editorial integration.** This amendment is marked at the front-matter `summary` and `customer_impact` (TDR-0011's front-matter convention: no `last_amended`/`amendment_history` key exists in this repository's template, so an amendment is recorded in `last_updated`, the `summary`, and this table), and in place at: the Context FACT list, Problem Framing, C-2, C-3, C-6, C-7, DC-1, DC-2, DC-3, DC-4, DC-5, the Rationale, the constraint attestation, the DACI block, ALT-4, the Trade-offs, the Unresolved Questions, the Implementation Plan, the Verification Criteria, the Confidence Rating, and the References. Two of those in-place clauses are purely coherence with spec v1.1 and were not named in the six amendments above: the version stamp on event and degraded frames (spec DEC-G, which Appendix B maps to DC-2), and the empty `kinds[]`/`payloadFields[]` on the snapshot topics (spec DEC-B/DEC-K). No decision flips: DC-1, DC-2's guarantee, DC-3, DC-4, and DC-5 keep their selected positions, and the one newly declared behaviour change (unknown topic: acceptance → refusal) is a disclosure of what DC-4's identity already implied, now stated as the client-visible change it is. Status stays `Proposed`; acceptance still rides the GH-290 PR review.

## References

- GH-290 ticket "M2-S13: Public event taxonomy (M2)"; change capsule: `doc/changes/2026-11/2026-11-11--GH-290--event-taxonomy/chg-GH-290-pm-notes.yaml` (the two clarify-scope decisions this record formalizes)
- GH-290 specification v1.1 (the amendment source and the governing text this record binds to): `doc/changes/2026-11/2026-11-11--GH-290--event-taxonomy/chg-GH-290-spec.md` — DEC-A…DEC-O, in particular DEC-B (snapshot topics), DEC-C (overflow carriage), DEC-D (ordering scope and nullability), DEC-I (sequence allocation), DEC-J (source mapping and the two declared gaps), DEC-K (reference-record key set), and DEC-L (unknown topic, acceptance becomes refusal)
- M2 contract section: `doc/planning/oss-tooling/milestones/m2/contracts.md` §Event taxonomy v1 and §S17 mapping
- M2 reference page: `doc/planning/oss-tooling/milestones/m2/commands/events.md`
- M2 test scenarios SC-M2-S13-01 and SC-M2-S13-02: `doc/planning/oss-tooling/milestones/m2/test-scenarios.md`
- M2 architecture invariants: `doc/planning/oss-tooling/milestones/m2/architecture.md` §Boundary invariants at M2 exit
- M2 entrypoint policy: `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md`
- Current system spec (control protocol v1): `doc/spec/features/feature-resident-daemon.md`
- Delivered control vocabulary and event shape: `packages/core/src/contracts/control.ts`; `packages/core/src/domain/control-codec.ts`; `packages/core/src/domain/control-session.ts`
- Delivered publish and overflow path: `packages/core/src/app/control-server.ts`; `packages/core/src/app/daemon-runtime.ts`; `packages/cli/src/daemon-compose.ts`
- Delivered client degradation: `packages/core/src/app/watch.ts`; `packages/core/src/domain/watch-stream.ts`
- Exit-code meaning and the machine envelope: TDR-0005 (`doc/decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md`)
- Daemon composition and degradation precedent: TDR-0023 (`doc/decisions/TDR-0023-daemon-lifecycle-mount-and-degradation-composition.md`)
- Decision record standard: `doc/guides/decision-records-management.md`
