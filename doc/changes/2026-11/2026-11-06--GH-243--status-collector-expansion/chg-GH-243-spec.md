---
change:
  ref: GH-243
  type: feat
  status: Proposed
  slug: status-collector-expansion
  title: "M1-S10: Status collector expansion — attention-state digest with stable finding codes"
  owners: [engineering]
  service: delivery-os
  labels: [m1, status, digest, attention-state]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "Status digest (M0-S6, GH-175, SPEC-STATUS-DIGEST) — the shipped six-section delivery.status.v1 surface this change extends"
      - "Queue-ready (M0-S7) — close-item / merge-ready / review-pending classification reused for the action list"
      - "Owner-gate SLA (M1-S5, GH-229) — age clock, slaState, and escalation evaluator reused for owner-gate ages"
      - "Brief (M1-S6, GH-228) — consumer of the same collector state; must stay consistent under the additive schema strategy"
      - "Result contract and error table — envelope, failure identities; no new rows"
      - "ADR-0004 (activity timestamp absence), ADR-0006 (custom-field omission and assignee-non-signal), ADR-0003 (package placement)"
      - "Branding seam — injected binary name, no product literals"
    external:
      - "GitHub tracker, pull-request, and check-runs reads (existing normalized bounded pages; no new endpoints, no pagination crawl)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Expand the shipped status digest from "what exists" to "what needs attention" — stable finding codes, grouped/deduplicated/ranked findings, a ready-to-merge action list, owner-gate ages, hygiene assertions, parked conditions, and named placeholders for spend and blockers — so one digest bootstraps every session without manual probing or re-derivation.

## 1. SUMMARY

This change is a declared contract change to the status digest surface (SPEC-STATUS-DIGEST, shipped M0-S6). It extends the digest toward attention-state coverage: every finding carries a stable finding code from a closed contract-data registry; identical observations group into one finding (four red CI runs on the primary branch render as one job, not four) with deterministic severity ranking; ready-to-merge becomes a first-class ranked action list reusing the queue-ready close-item/merge-ready classification; tracker ticket-hygiene gains the three named assertions (epic membership, story points, in-sprint) evaluated over mapped normalized data with ADR-0006 unknown semantics; owner-hand-back items gain owner-gate age and SLA state reusing the M1-S5 evaluator; parked items surface their recorded conditions; the lanes attention-state shape is declared while the section reports declared not-delivered evidence (no lane engine exists until M1-S17); and spend (until M1-S19) and blockers (until M1-S16) join as named placeholder sections. The fixed section set grows from six to nine additively; the schema version stays `delivery.status.v1` under an additive-only strategy; exit-code semantics, the read budget, the five-state vocabulary, and the read-only posture are unchanged. Every new item surface is bounded with explicit truncation, and the human grammar extension is spelled out line by line with new declared bounds (32 lines, 6144 bytes).

## 2. CONTEXT

### 2.1 Current State Snapshot

- The status digest (M0-S6, GH-175, closed, SPEC-STATUS-DIGEST Current) returns one bounded `delivery.status.v1` payload: six fixed sections in fixed order (tracker, changes-and-prs, ci, lanes-or-queue, providers, parked-work), each with exactly one state from the closed five-value set (`observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`), bounded evidence, uniform counts, ranked capped items, and an explicit truncation marker. Failed, absent, unattempted, and unresolved reads never render green/zero; partial collection is reported in-band; the command is read-only with at most three network reads, one park fold, and one configuration resolve per invocation.
- The digest answers "what exists": tracker families (owner hand-backs, blocked dependencies, stalls, hygiene) list items; CI classifies the checkout-HEAD check-runs page over the closed `STATUS_CI_RESULTS` vocabulary; parked work projects local PM-context entries. Findings carry no stable codes; identical observations are not grouped; there is no action surface, no owner-gate age, no spend or blockers surface.
- Ticket hygiene today evaluates only two findings over mapped normalized data: blank/empty title and empty label set. Comment and unmapped-custom-field conformance are not evaluated (absence means unknown, never violation).
- Reusable delivered surfaces: `queue ready` (M0-S7) already classifies close items — `merge-ready` requires an observed approval on a non-draft open pull request, `review-pending` covers everything else including unknown review state — with deterministic numeric-aware ref ranking. The owner-gate SLA (M1-S5, GH-229) already computes gate age from the provider-native activity timestamp (ADR-0004: absent/unparseable timestamp is a declared unknown-age marker, never fabricated as zero), evaluates the pinned 24 h escalation and 72 h default-on-expiry thresholds, and projects the three-value `slaState` (`fresh`, `escalated`, `default-applied`); unknown age escalates. The brief (M1-S6) consumes the same collector state by reference and renders ready-to-merge and owner-gate-age anchors.
- The lanes-or-queue section is always `not-delivered` with capability `queue-lane-engine`, expected story M1-S17, reason `engine-not-delivered`. The lane engine and its liveness signal sources (M1-S15) are not delivered in this release.
- The M1 planning pack designates this story as the digest's attention-state expansion (backlog M1-S10 canonical; the `status` man page and contracts entry are proposed design baselines, refined at story delivery). The maintenance rule in SPEC-STATUS-DIGEST explicitly anticipates this change: "adding a section is a contract change to the section id and order, state derivation, renderer line, and tests."

### 2.2 Pain Points / Gaps

- **No attention semantics**: the digest lists items but never says what needs action. An operator or agent must re-derive urgency (which red run matters, which stall is actionable) on every session.
- **No stable finding codes**: downstream agents cannot act on findings without re-deriving their meaning; there is no closed vocabulary a test plan or an agent prompt can reference by name.
- **No grouping or deduplication**: four red CI runs on the primary branch render as four unrelated items instead of one job; noise scales with observation count instead of with distinct problems.
- **Ready-to-merge is not first-class**: the merge-ready classification exists in `queue ready`, but the session-bootstrap digest — the first call of every session — has no ranked action list of closeable work.
- **Owner-gate ages invisible in the digest**: a hand-back from three weeks ago renders identically to one from three hours ago; the SLA state computed by the board never reaches the digest.
- **Hygiene assertions unnamed and incomplete**: only missing-title and missing-labels exist; the tracker-hygiene conventions the planner actually asserts (epic membership, story points, in-sprint state) are not named surfaces, so coverage cannot be pinned.
- **Parked work loses its conditions**: parked items render without the recorded re-entry condition, so "why is this parked and what would unpark it" requires opening the local context by hand.
- **Lanes attention state undeclared**: the section proves the capability gap but does not yet carry the declared delivering-versus-idle-with-reason vocabulary the M1 engine will report into.
- **Spend and blockers surfaces absent without declaration**: nothing in the digest names their absence, so a consumer cannot distinguish "no spend tracking" from "spend not delivered yet".

## 3. PROBLEM STATEMENT

Because the status digest stops at existence reporting — findings carry no stable codes, identical observations are not grouped, there is no ranked ready-to-merge action list, owner-gate ages never leave the board, hygiene assertions beyond title/labels are unnamed, parked conditions are dropped, and spend and blockers have no named surfaces — the coordinator and downstream agents cannot bootstrap a session from one digest: they must re-derive which findings matter, re-probe mergeable work and gate ages by hand, and re-open local and tracker sources to recover context, resulting in repeated manual probing, inconsistent agent behavior, and attention signals (a red primary branch, an escalated owner gate, an idle lane) that arrive late or not at all.

## 4. GOALS

- **G-1**: Every finding in the digest carries a stable finding code from a closed, contract-data registry, so agents act without re-deriving (ticket AC-3).
- **G-2**: Identical observations group, deduplicate, and rank deterministically: four red CI runs on the primary branch render as one finding with a count and bounded member list, never four items (ticket pinned decision).
- **G-3**: Ready-to-merge ranks as a first-class action list in the digest, reusing the queue-ready close-item/merge-ready classification with no new reads (ticket AC-4).
- **G-4**: Tracker ticket-hygiene assertions are covered by name — epic membership, story points, in-sprint state — evaluated over mapped normalized data with declared availability and unknown semantics per ADR-0006 (ticket AC-2).
- **G-5**: Owner-hand-back items in the digest carry owner-gate age and SLA state computed by the existing SLA evaluator, with unknown age declared and never fabricated.
- **G-6**: Parked items surface their recorded conditions; the lanes attention-state vocabulary is declared while the section reports declared not-delivered evidence in-band (ticket pinned partial-collection rule).
- **G-7**: Spend (until M1-S19) and blockers (until M1-S16) join the digest as named placeholder sections whose absence is declared in-band, never silent.
- **G-8**: Every new collector is artifact-verified (corpus and golden evidence extended) and bounded, with explicit truncation on every new item surface (ticket AC-1).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Findings carrying a registry code | 100% of emitted findings; zero free-form finding identities |
| Grouping effectiveness | K same-code observations on one surface render as exactly 1 finding with `count = K` (pinned case: 4 red primary-branch runs → 1 finding) |
| Hygiene assertion coverage | The three named assertions (epic membership, story points, in-sprint) each appear as named assertion surfaces with tri-state counts |
| Action-list ranking | merge-ready close items rank above review-pending; rank keys fully deterministic (identical inputs → identical order bytes) |
| Bounded surfaces | Every new item surface has a declared cap and truncation marker; zero unbounded arrays in the digest |
| Artifact verification | Corpus completeness meta-check covers nine sections × five states; golden fixtures pin the extended human grammar byte-identically |
| Read budget | Unchanged: at most 3 network reads, 1 park fold, 1 configuration resolve per invocation |
| Human digest bounds | ≤ 32 lines and ≤ 6144 bytes (new declared bounds), enforced and golden-pinned |

### 4.2 Non-Goals

- **NG-1**: No `--watch` flag. The daemon control socket (M1-S18) is not delivered and the flag is owned by the daemon story; the proposed man-page synopsis is not in scope for this ticket's tasks or AC.
- **NG-2**: No exit-code change. The digest remains data, not a command failure; exit-1-on-actionable-finding from the proposed man page is deferred to M1-S20 agent integration (PM decision 2026-11-06).
- **NG-3**: No lane or queue engine. The lanes-or-queue section stays `not-delivered`; no lane state is computed or fabricated (M1-S17 owns the engine; M1-S15 owns liveness signal sources).
- **NG-4**: No spend implementation. The spend section is a named placeholder until M1-S19 lands spend telemetry.
- **NG-5**: No blockers or typed-questions implementation. The blockers section is a named placeholder until M1-S16 lands the typed blocker channel.
- **NG-6**: No change to the `queue ready` command surface, its payload, or its ranking — this change reuses its classification concepts read-only.
- **NG-7**: No schema-version bump and no breaking change to `delivery.status.v1` (additive-only strategy, DEC-1).
- **NG-8**: No open-pull-request-head CI collection; only the current checkout HEAD is observed (existing deferred scope stays deferred).
- **NG-9**: No comment-conformance or unmapped-custom-field evaluation beyond the three named mapped assertions (ADR-0006: absent signals are unknown, never violations).
- **NG-10**: No new error-table rows, no new configuration keys, no new package, subpath, or runtime-API location, no state-schema change.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Stable finding codes: a closed, contract-data finding-code registry with per-code default severity, applied to every finding in the digest | Agents act on codes without re-deriving; test plans and prompts reference findings by name (ticket AC-3, pinned) |
| F-2 | Grouped, deduplicated, ranked findings: same-code observations within a section coalesce into one finding with a count, deterministic representative evidence, and a bounded member list | Noise scales with distinct problems, not observation count; four red primary-branch runs are one job (ticket pinned) |
| F-3 | Ready-to-merge action list: a new first-class section ranking close items merge-ready first, reusing the queue-ready classification and the existing PR/CI collectors | The session bootstrap answers "what can I close now" without probing (ticket AC-4) |
| F-4 | Named ticket-hygiene assertions: epic membership, story points, in-sprint state evaluated over mapped normalized data with tri-state violation/unknown/satisfied counts | Coverage pinned by name; undeclared signals are unknown, never violations; absence within a declared, available signal is a violation (ticket AC-2, DEC-13) |
| F-5 | Owner-gate ages in the digest: hand-back items carry age and `slaState` from the existing SLA evaluator; unknown age is a declared marker | Gate aging reaches the session bootstrap; three-week-old hand-backs no longer render like three-hour-old ones |
| F-6 | Parked conditions: parked-work items carry their recorded re-entry condition when present, under the existing detail cap | "Why parked and what unparks it" answers from the digest |
| F-7 | Lanes attention-state declaration: the delivering/idle-with-reason vocabulary and the dormant `lane.idle-no-reason` code are declared contract data; the section continues to report declared not-delivered evidence in-band | The engine's future evidence shape is pinned now without fabricating lane data (ticket task; PM decision) |
| F-8 | Spend placeholder section: a named `not-delivered` section declaring capability and expected delivering story M1-S19 | Absence is declared, never silent (ticket pinned) |
| F-9 | Blockers placeholder section: a named `not-delivered` section declaring capability and expected delivering story M1-S16 | Absence is declared, never silent (ticket pinned) |
| F-10 | Extended human grammar and bounds: the deterministic human digest gains the new section lines and an attention rollup line under raised declared bounds (32 lines / 6144 bytes) | Human and machine modes render the same digest; bounds grow only by declared, golden-pinned amounts |

### 5.1 Capability Details

- **F-1 — Finding-code registry.** Finding codes are stable symbolic identifiers in a namespaced lowercase dotted form `<surface>.<finding>` (optional second dot for the hygiene assertion family), declared once as contract data beside the existing declared bounds and label sets. The registry shipped by this change: `ci.red-on-main` (high), `tracker.owner-gate-escalated` (high), `tracker.stalled-ticket` (medium), `tracker.hygiene.missing-title` (low), `tracker.hygiene.missing-labels` (low), `tracker.hygiene.epic-membership` (low), `tracker.hygiene.story-points` (low), `tracker.hygiene.in-sprint` (low), `lane.idle-no-reason` (medium, dormant — untriggerable until the lane engine lands), and `parked.stale-no-condition` (low — a parked item with unknown age and no recorded condition). Severity is a closed three-value set (`high`, `medium`, `low`) declared with the registry. A code's meaning never changes silently; renaming or re-scoping a code is a reviewed contract change, and a code removed from the registry is never emitted.
- **F-2 — Grouping, deduplication, ranking.** Findings are evaluated per section over that section's ranked item surfaces before rendering. All observations matching one registry code within one section coalesce into a single finding carrying: the code, the severity from the registry, `count` (exact number of coalesced observations), a bounded member list (declared cap; each member an identity such as run identity, work-item ref, or ref — never a title or payload), and representative evidence selected deterministically. Members are unique identities, deduplicated and ordered by the section's fixed ranking order; the representative evidence field is `evidenceRef` and holds the first deduplicated member; `count` is the exact observation total and may exceed the member count when identities repeat. Sections emit at most the declared findings cap; overflow is declared via the section's existing truncation marker. The findings cap (8) is defensive headroom (DEC-15): with the shipped ten-code registry no section can reach eight distinct codes (the tracker maximum is seven), so cap enforcement is proven at the pure aggregation layer, where tests may inject a test-only registry extension to drive the cap. Findings are observed-evidence claims — **no-evidence-no-claim** (DEC-18): a failed or unresolved read emits no finding for its section; the section state and evidence reasons carry the failure. Findings rank by severity (high, medium, low), then count descending, then code ascending, then first occurrence in the fixed source order. The pinned acceptance case: a CI page with four failed runs on the primary branch yields exactly one `ci.red-on-main` finding with `count: 4` and four bounded members.
- **F-3 — Ready-to-merge action list.** A new section in the fixed order (position 7; see DM-3) whose items are open pull requests classified exactly as `queue ready` classifies close items: `merge-ready` requires an observed approval on a non-draft open pull request; `review-pending` covers every other associated open pull request, including unknown review state. No new reads: the section reuses the existing pull-request list read and the existing CI classification. Items rank `merge-ready` before `review-pending`, then the queue-ready deterministic ref rank keys (numeric-aware ref suffix, then source ref, then target ref), capped at the declared bound with the existing truncation model. An item whose review signal is unknown is `review-pending` with an unknown review marker — never `merge-ready`, never fabricated as approved. The section state follows the existing derivation matrix semantics: `observed` when the pull-request read succeeded with review signals available, `degraded` when review signals are unavailable (merge-ready then cannot be claimed and renders `?`), `unknown` on read failure, `unavailable` without a repository binding, never `not-delivered`.
- **F-4 — Named hygiene assertions.** The hygiene family gains three named assertions evaluated over mapped normalized work-item fields only: **epic membership**, **story points**, and **in-sprint**. Evaluation is gated by declared per-assertion availability that travels with the tracker read (like the existing per-family availability): a signal the source does not declare available is all-unknown with `signal-unavailable`, counted, never a violation (ADR-0006 protection at the source-declaration level). Within a declared, available signal the assertion is **absence-as-violation**, matching the shipped `missing-title`/`missing-labels` semantics: **violation** when the item carries no conforming value — the mapped field absent, empty, or unparseable — emitted as the matching finding code and grouped per F-2; **satisfied** when the item carries a conforming value (no output); **unknown** only from the availability gate. Per-assertion violation conditions are contract data (DEC-13): `epic-membership` violates when the item carries no label matching the declared epic-label convention; `story-points` violates when the item carries no label matching the declared story-point convention with a parseable non-negative integer (absent, empty, or unparseable suffix all violate); `in-sprint` violates when the item has no mapped active-sprint membership. The interplay with ADR-0006 is explicit: this change names the assertions and declares the mapping, creating the named consumer ADR-0006 requires for conformance evaluation; the unknown protection then governs source-declared availability, while item-level absence inside a declared, available signal is exactly the convention violation these assertions exist to catch. Assertion-level unknown counts aggregate on the family exactly as stall unknown-activity counts do today; family state semantics are unchanged. The existing `missing-title` and `missing-labels` findings join the registry unchanged in behavior.
- **F-4a — Mapped-signal provenance.** The hygiene signals map fields the existing bounded tracker page already returns — no new adapter endpoint, no new package or subpath, no pagination crawl. The projection is declared in the existing tracker/status contracts and mapped in the existing adapter normalization: epic membership and story points map the already-normalized label set through declared label-convention contract data (epic: a label equal to the token `epic` or prefixed `epic:`; story points: a label prefixed `points:` whose remainder parses as a non-negative integer); in-sprint maps the page's milestone field, additively normalized on the work-item view from the same response (DEC-14, DM-13). Declared per-assertion availability is part of the tracker read result, so unknown is driven by declaration, never inferred from absence. Production stays truthful where a mapping is not declared (all-unknown); corpus fixtures supply mapped labels and milestones, making the violation and satisfied arms artifact-reachable in tests.
- **F-5 — Owner-gate ages.** Each owner-hand-back item gains additive fields: observed age (derived only from the provider-native activity timestamp per ADR-0004), the declared unknown-age marker when the timestamp is absent or unparseable, and the `slaState` (`fresh`, `escalated`, `default-applied`) computed by the existing pure SLA evaluator over the injected clock and existing policy data — no new thresholds, no new policy, no re-evaluation of defaults, and no decision records written by the digest (status remains read-only; default application remains the board's owned write). Escalated and default-applied gates also surface as `tracker.owner-gate-escalated` findings, grouped per F-2. Unknown-age gates escalate per the existing SLA rule and are therefore visible in both the item fields and the findings layer.
- **F-6 — Parked conditions.** A parked-work entry that records a re-entry condition projects it as an additive optional item field, bounded by the existing evidence-detail cap; entries without a condition render without one (absence is absent, not unknown, for this optional local field). A parked item with unknown age (no parseable `parkedAt`) and no recorded condition emits `parked.stale-no-condition` (grouped per F-2), because such an item is the parked-work analogue of an unattended ask.
- **F-7 — Lanes attention-state declaration.** The attention-state vocabulary and the `lane.idle-no-reason` code enter the registry and the section's declared contract now, so the M1-S17 engine slots into a pinned evidence shape and the M1-S15 liveness signals have a declared consumer. The declared per-lane attention-state vocabulary is the closed set `delivering`, `idle-with-reason`, `idle-no-reason` (DEC-17); the section's additive declaration fields name this vocabulary now, and `lane.idle-no-reason` emits only from lanes in the `idle-no-reason` state once the engine lands. Until the engine is delivered, the section continues to report exactly the current declared not-delivered evidence (capability, expected story, reason, zero items); no lane state, liveness, or idle-with-reason value is ever fabricated, and the pinned partial-collection rule covers the gap in-band.
- **F-8 / F-9 — Named placeholders.** Two new sections join the fixed order with the uniform section shape (state, evidence, counts, items, truncation), always `not-delivered` with declared capability, expected delivering story (`M1-S19` spend, `M1-S16` blockers), reason `engine-not-delivered` from the existing closed reason set, zero items, and an explicit note — the same declared-gap pattern the lanes section established. Each placeholder is removed only by the story that delivers the real surface, as its own contract change.
- **F-10 — Human grammar.** The human digest remains deterministic, derived solely from the digest data, with one line per section in fixed order plus the optional header. The exact extended grammar is declared in section 8.3 (DM-10) and pinned by golden fixtures.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Session bootstrap with attention triage
  Actor (coordinator/agent) runs status →
    Digest renders nine sections + attention rollup.
    Agent reads codes: ci.red-on-main ×4 (one grouped finding, members listed)
      → dispatches one fix job, not four.
    Agent reads ready-to-merge: merge-ready refs ranked first → closes work.
    Agent reads tracker gates escalated <n> → chases the oldest escalated gate.

Flow 2: Grouping (pinned acceptance case)
  CI page on the primary-branch HEAD returns 4 failed runs →
    Collector classifies `failed` (unchanged) →
    Findings layer coalesces all 4 into one ci.red-on-main finding:
      severity high, count 4, four bounded member identities,
      representative evidence = first run in CI ranking order →
    Human digest shows one attention entry; machine envelope shows one finding.

Flow 3: Partial evidence stays in-band (pinned rule)
  Lane engine not delivered → lanes section renders declared not-delivered
    evidence (unchanged) + dormant lane.idle-no-reason code declared, never
    emitted.
  Spend/blockers sections render named not-delivered placeholders.
  Review signals unavailable → ready-to-merge renders degraded; merge-ready
    count renders ? ; nothing is fabricated as approved.

Flow 4: Reuse without new reads
  Pull-request list read (existing) + CI classification (existing) +
  SLA evaluator over injected facts (existing, pure) →
    ready-to-merge items, owner-gate ages, and findings all derive from
    the same injected facts; read budget stays 3 network reads + 1 park
    fold + 1 config resolve.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The finding-code registry, severity vocabulary, and per-code default severities as closed contract data (F-1).
- Grouping, deduplication, and deterministic ranking of findings per section, including the bounded member list and representative evidence (F-2).
- The new ready-to-merge section with queue-ready-reused classification, deterministic action-list ranking, and the declared state derivation row (F-3).
- The three named hygiene assertions with tri-state counts, pinned per-assertion violation conditions (absence-as-violation within declared availability, DEC-13), and the mapped-signal provenance extension (labels and milestone from the existing bounded page, declared per-assertion availability, fixture-reachable violation/satisfied arms) (F-4, F-4a).
- Additive owner-gate age and `slaState` fields on hand-back items plus the `tracker.owner-gate-escalated` finding (F-5).
- Additive parked-condition projection and the `parked.stale-no-condition` finding (F-6).
- Declared lanes attention-state vocabulary and the dormant `lane.idle-no-reason` code (F-7).
- The spend and blockers named placeholder sections in the fixed order (F-8, F-9).
- The extended fixed section order (six → nine), the extended human grammar, and the raised declared human bounds, 24 → 32 lines and 4096 → 6144 bytes (F-10).
- Declared new bounds on every new item surface (findings per section, members per finding, ready-to-merge items) and corpus/golden evidence extension covering all new sections, states, and grouping cases (G-8).

### 7.2 Out of Scope

- [OUT] `--watch` flag or any live/streaming subscription (daemon M1-S18 owns it).
- [OUT] Exit-code change, including exit-1-on-actionable-finding (deferred to M1-S20; digest stays data, successful runs exit 0 with degraded sections in-band).
- [OUT] Lane/queue engine behavior, lane state computation, or liveness signal consumption (M1-S17, M1-S15).
- [OUT] Spend telemetry, aggregation, or rendering beyond the named placeholder (M1-S19).
- [OUT] Typed blocker channel or typed questions beyond the named placeholder (M1-S16).
- [OUT] Changes to the `queue ready` command, its payload, or its bounds (reused read-only).
- [OUT] Schema-version bump or any breaking change to existing `delivery.status.v1` fields, section ids 1–6, their order, or their states.
- [OUT] Open-pull-request-head CI collection (stays deferred).
- [OUT] Comment conformance, unmapped custom-field conformance, or any assertion over unmapped data (ADR-0006).
- [OUT] New error-table rows, configuration keys, packages, subpaths, runtime-API locations, state-schema changes, writes, fences, or child processes.
- [OUT] Owner-gate SLA threshold or policy changes (the evaluator and PDR-0003 map are consumed as-is).

### 7.3 Deferred / Maybe-Later

- Attention rollup expansion beyond the bounded three-code preview (e.g., full findings listing in human mode) — revisit if operators ask after shipping.
- Fleet-wide grouping across repositories ("mains" plural in the ticket's motivating example) — natural fit for the M2-S4 shared board state; the single-repo grouping semantics are designed to compose.
- A `questions` placeholder line joining the spend/blockers pattern if the M1-S16 typed-questions scope confirms it.
- Digest-level finding subscriptions for agents (M1-S20 decides the consumption contract; this change only pins the codes).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. The change adds no endpoints; all collection remains the existing bounded read-only GitHub reads.

### 8.2 Events / Messages

None. The digest writes no events, emits no messages, and appends no records; the SLA evaluator's decision records remain the board's owned write path, untouched here.

### 8.3 Data Model Impact

Additive-only over `delivery.status.v1` (DEC-1): no existing field is removed, re-typed, or re-scoped, and the sections 1–6 delta is confined to DEC-16's named optional-field allowlist. Naming convention for all new contract names (DEC-17): camelCase for payload fields (`slaState`, `evidenceRef`, `placeholderSectionCount`), kebab-case for section and assertion ids (`ready-to-merge`, `epic-membership`), lowercase dotted for finding codes (`ci.red-on-main`), SCREAMING_SNAKE for declared constants.

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Finding-code registry | Closed contract-data map: code → default severity + one-line meaning. Declared beside the existing bounds and label sets; new codes join only by reviewed contract change. |
| DM-2 | Severity vocabulary | Closed three-value set `high`, `medium`, `low`; contract data, not configuration. |
| DM-3 | Section set 6 → 9 | Fixed order: 1 tracker, 2 changes-and-prs, 3 ci, 4 lanes-or-queue, 5 providers, 6 parked-work, then new 7 `ready-to-merge`, 8 `spend` (placeholder), 9 `blockers` (placeholder). Additive-delta rule (DEC-16): sections 1–6 keep their ids, order, state derivation, and required fields; the only permitted delta is the named optional-field allowlist — optional `findings[]` on every section (DM-4), tracker hand-back item `age`/`ageUnknownReason`/`slaState` (DM-8), hygiene per-assertion tri-state counts (DM-7), parked-work optional `condition` (DM-9), lanes attention-state declaration fields (F-7). Existing consumers indexing sections 1–6 see no reordering. |
| DM-4 | Section findings array | Additive optional `findings[]` on every section: `{ code, severity, count, members[] (bounded), evidenceRef }`. Members are unique identities, deduplicated and ordered by the section's fixed ranking order; `evidenceRef` is the representative and holds the first deduplicated member; `count` is the exact coalesced observation total and may exceed the member count when identities repeat. Capped per section at 8 — defensive headroom (DEC-15); overflow declared via the existing truncation marker. Findings are observed-evidence claims: a failed or unresolved read emits no finding for its section (DEC-18). |
| DM-5 | Ready-to-merge section | Uniform section shape; items `{ ref, class: merge-ready \| review-pending, sourceRef, targetRef, reviewState (observed \| unknown), ciResult }`; state per the declared derivation row (F-3); never `not-delivered`. |
| DM-6 | Placeholder section shape | Reuses the lanes pattern: `{ state: not-delivered, capability, expectedStory, reason: engine-not-delivered, note }`, zero items and counts. |
| DM-7 | Tracker hygiene assertions | Additive per-assertion tri-state counts on the hygiene family (violations, unknown, satisfied) for `epic-membership`, `story-points`, `in-sprint`, gated by the declared per-assertion availability on the tracker read (DM-13); existing title/label findings unchanged in behavior, now code-carrying. |
| DM-8 | Hand-back item additive fields | `age` (observed, derived per ADR-0004), `ageUnknownReason` (declared marker when absent/unparseable), `slaState` (`fresh` \| `escalated` \| `default-applied`). |
| DM-9 | Parked-condition field | Additive optional `condition` on parked items, bounded by the existing evidence-detail cap. |
| DM-10 | Extended human grammar | Exact lines declared below; golden-pinned byte-identically. |
| DM-11 | Declared bounds additions | New caps: findings per section 8; members per finding 8; ready-to-merge items 8. Raised human bounds: lines 24 → 32; bytes 4096 → 6144. Serialized-data bound unchanged at 65 536 bytes and re-verified by corpus. |
| DM-12 | Summary additions | Additive summary counts: findings total (grouped findings across sections) and placeholder-section count — exactly the two delivered placeholders (`spend`, `blockers`); the lanes section is a shipped declared-gap section, not a placeholder, and is excluded (DEC-17). Both computed by the existing observed/degraded contribution rule (placeholders contribute zero). |
| DM-13 | Hygiene mapped-signal extension | Optional declared per-assertion availability plus per-item mapped values on the tracker read result, mapped from fields the existing bounded tracker page already returns: the normalized label set (epic token `epic` or `epic:` prefix; points token `points:` prefix whose remainder parses as a non-negative integer) and the page's milestone field, additively normalized on the work-item view from the same response. Declared contract data; no new adapter endpoint, package, subpath, or pagination; production is all-unknown where a mapping is not declared (DEC-14). |

**Extended human grammar (DM-10, exact).** Header unchanged and still optional (only when binding observed and SHA resolved). One line per section in the fixed nine-section order; the attention rollup line is last. Changed fragment marked; all new lines marked:

```
<binary> status <owner>/<name> @ <branch|detached> <sha7>
tracker    <state>  hand-backs <n> | gates <n|?> escalated | blocked <state> | stalls <n> (<u> unknown) | hygiene <n> (<a> unknown)   [changed: gates + assertion-unknown fragments]
changes    <state>  active <ref|none|unknown> | PRs <n|?> (review state <unavailable|observed|unknown>)                             [unchanged]
ci         <state>  <failed|pending|succeeded|canceled|none-reported|unknown> (<failed>/<total> jobs)                                [unchanged]
lanes      not-delivered  no queue or lane engine in this release                                                                    [unchanged]
providers  <state>  chain <name|none|unknown> | active parks <n|?> | <entries|?> entries                                             [unchanged]
parked     <state>  <n|?> parked changes (git-ignored local state)                                                                   [unchanged]
ready      <state>  <n|?> ready-to-merge (merge-ready <m|?>)                                                                         [new section line]
spend      not-delivered  spend summary arrives with M1-S19                                                                          [new placeholder line]
blockers   not-delivered  typed blockers arrive with M1-S16                                                                          [new placeholder line]
attention  <n> findings (<code>×<count>[, <code>×<count>][, <code>×<count>][+N])                                                    [new rollup line]
```

Grammar rules: `gates <n>` counts hand-backs whose `slaState` is `escalated` or `default-applied` (unknown-age gates escalate per the existing SLA rule, so they are counted); `gates ?` only when the owner-hand-back family is unavailable. `ready ?` when the section is `unknown`/`unavailable`; `merge-ready <m>` only when review signals are observed, else `merge-ready ?` — an unverifiable approval is never rendered as a number. The attention line previews at most three severity-ordered code groups then `+N`; `<n>` is the total grouped findings across sections and `+N` counts grouped findings beyond the previewed three, never raw observations (DEC-17); `attention 0 findings ()` when no findings exist. Bound roles (DEC-17): the 32-line cap is defensive headroom — the extended grammar's worst case is 11 lines (optional header + nine section lines + the attention rollup); the 6144-byte cap is the operative bound enforced on rendered output and pinned by golden fixtures plus a max-length stress case. The human digest continues to contain no raw payloads, no item titles, no secrets, no timestamps, and no LLM-generated prose, and rendering performs zero extra reads.

### 8.4 External Integrations

Unchanged set: the existing tracker, pull-request, and check-runs reads over the bound repository, the provider configuration resolve, the verified park fold, and the local PM-context read. No new endpoints, no new scopes, no pagination crawl, no retries. The hygiene mapped-signal projection (DM-13) maps fields the existing bounded tracker page already returns — the normalized label set and the additively normalized milestone — so the read set is unchanged.

### 8.5 Backward Compatibility

- **Machine consumers**: additive-only. Existing fields, section ids 1–6, their order, their states, and all existing bounds and vocabularies are unchanged; the sections 1–6 delta is confined to DEC-16's named optional-field allowlist, and consumers that ignore unknown fields (the envelope's established tolerance) keep working. Consumers consuming sections by reference (the brief) are reconciled in the documentation-sync phase, not broken: the brief projects sections by id and simply sees three additional sections. Golden fixtures pin the rendered bytes, so any rendered-output change — including additive fields reaching the human grammar — regenerates goldens only as a reviewed exception, never a suite rewrite.
- **Human consumers**: the grammar extension is additive (three new section lines + one rollup line + two tracker fragments); the digest grows only within the newly declared 32-line/6144-byte bounds, which are themselves pinned by golden fixtures so the growth is visible and bounded, not open-ended.
- **Schema version**: stays `delivery.status.v1` (DEC-1). A future breaking change (field removal/re-typing, section reorder) would bump the version; none exists in this change.
- **Codes**: `lane.idle-no-reason` is declared but dormant; no consumer can observe it before the engine lands, so no behavioral compatibility risk.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Every new item surface is bounded with explicit truncation | Findings ≤ 8 per section; members ≤ 8 per finding; ready-to-merge items ≤ 8; every drop or source-at-limit marked via the existing truncation model |
| NFR-2 | Human digest bounds (raised, declared) | ≤ 32 lines (defensive headroom; worst case 11 lines) and ≤ 6144 bytes (operative bound), enforced and golden-pinned |
| NFR-3 | Machine digest bound (unchanged) | Serialized `data` ≤ 65 536 bytes with all additive surfaces populated at cap; verified by corpus cases at cap |
| NFR-4 | Read budget unchanged | ≤ 3 network reads, 1 park fold, 1 configuration resolve per invocation; zero retries, loops, daemons |
| NFR-5 | Aggregation performance (unchanged bound over larger output) | Pure aggregation over cap-sized inputs completes within 50 ms on the reference environment |
| NFR-6 | Determinism | Identical injected inputs produce identical machine and human bytes; rank keys total and order-independent (API return order never decides) |
| NFR-7 | Read-only posture unchanged | Zero writes, fences, state mutations, network writes, child processes; SLA decision records are not written by the digest |
| NFR-8 | Code stability | Finding codes and severities are closed contract data; 100% of emitted findings carry a registry code; zero free-form finding identities |
| NFR-9 | Evidence hygiene | Findings carry identities, counts, and codes only — no titles, payloads, secrets, or free-form text; the existing redaction chokepoint covers all new fields |
| NFR-10 | Artifact verification | Corpus completeness meta-check covers nine sections × five states including the new derivation row and grouping cases; golden fixtures pin the extended grammar byte-identically |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

The digest itself remains the observability surface; no telemetry exporter, event sink, or background process is added. New observability arrives as digest data: per-section findings with codes, counts, and member identities; the attention rollup; placeholder-section declarations naming the delivering story; and the existing per-section evidence and truncation markers, which extend to the new sections unchanged.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Brief projection drifts: the brief claims "same collector state as the digest"; nine sections and new item fields could contradict its render | M | M | Additive-only strategy (DEC-1) keeps every consumed field stable; the brief ignores unknown sections; documentation-sync phase reconciles the claim explicitly (PM-notes phase-7 risk) | Low — a brief-side contract change if its placeholder catalog must mirror the digest |
| RSK-2 | Hygiene assertions misread absent custom-field signals as violations, violating ADR-0006 | H | M | Tri-state assertion model: unknown is counted, never a finding; declared per-source signal availability gates each assertion; negative controls pin absent-signal → unknown | Low — a tracker source misdeclaring availability could suppress real unknowns; caught by availability fixtures |
| RSK-3 | Human digest growth erodes the session-bootstrap token budget | M | M | Bounds raised by a declared, golden-pinned amount (24→32 lines, 4096→6144 bytes), not removed; attention line previews three codes; placeholder lines are two fixed short lines | Low — future sections re-trigger the same explicit-bounds review |
| RSK-4 | Grouped findings hide actionable detail (one job, but which run?) | M | L | Bounded member list (≤ 8 identities) inside every finding; count always exact below the cap; members render in machine mode | Low |
| RSK-5 | Finding-code vocabulary drifts or bikesheds, breaking agent reliance on codes | H | L | Registry is closed contract data; rename/re-scope requires a reviewed contract change; golden fixtures pin codes byte-identically; dormant codes are declared, never silently removed | Low |
| RSK-6 | Scope creep: placeholders grow implementations (spend math, blocker storage) inside this change | M | L | Named placeholders are declared `not-delivered` sections with zero items; [OUT] markers NG-4/NG-5; delivering stories own removal | Low |
| RSK-7 | Additive surfaces push the serialized digest toward the 64 KiB bound | M | L | New caps sized so a fully-populated cap-sized digest stays well under the bound; corpus includes an all-caps case (NFR-3) | Low |
| RSK-8 | Ready-to-merge double-claims readiness the verify-gates battery owns | M | L | The action list cites observed collector evidence and never issues a merge verdict (the brief's established attention-not-authority rule); merge authority stays with verify gates and the merge transaction | Low |
| RSK-9 | Man-page/design-baseline drift: the proposed man page shows `--watch`, exit-1 semantics, and a `questions[]` field this change does not deliver | L | H | PM decisions NG-1/NG-2 recorded; man page reconciled in the documentation-sync phase as proposed-baseline refinement (PM-notes phase-7 risk list) | Low |

## 12. ASSUMPTIONS

- The lane engine (M1-S17), liveness signal sources (M1-S15), typed blocker channel (M1-S16), and spend telemetry (M1-S19) deliver after this story in M1, so the placeholders and dormant code are correct for this release's lifetime.
- The existing bounded tracker page returns the label set (already normalized) and the milestone field; the hygiene projection (DM-13) maps these additively within the existing adapter normalization, and the milestone normalization is additive on the work-item view — no new endpoint or pagination.
- The brief consumes digest sections by id and tolerates additional sections; its nine-surface catalog is its own contract and is not auto-derived from the section count.
- The existing pull-request read supplies review state (observed-or-unknown) sufficient for the merge-ready classification, exactly as `queue ready` already consumes it.
- The SLA evaluator is pure over injected facts and reusable without the board's write path.
- The primary-branch convention (`main`) is declared contract data like the existing host literal and label sets, not a configuration key.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Status digest (M0-S6, GH-175) | The extended surface; all existing invariants inherited unless explicitly revised here |
| Depends on | Queue-ready (M0-S7) | Merge-ready/review-pending classification and deterministic rank keys, reused read-only |
| Depends on | Owner-gate SLA (M1-S5, GH-229) | Age clock (ADR-0004), thresholds, `slaState`, unknown-age markers — consumed, not modified |
| Depends on | Result contract | Envelope, failure identities, exit projection, redaction chokepoint — no new rows |
| Depends on | ADR-0004 / ADR-0006 / ADR-0003 | Timestamp absence semantics; custom-field omission and unknown semantics; placement and tier rules |
| Depends on | Branding seam | Injected binary name in the human header; no product literals |
| Blocks | M1-S20 (agent integration) | Exit-1-on-actionable-finding and agent consumption of finding codes build on this registry |
| Enables | Brief anchor join | The brief's ready-to-merge and owner-gate-age anchors now reference digest-native surfaces |
| Enables | M1-S16 / M1-S19 | Their placeholder sections are pre-declared with pinned capability and story names |
| Enables | M1-S17 / M1-S15 | The lanes attention-state evidence shape and `lane.idle-no-reason` code are pinned for the engine to fill |

## 14. OPEN QUESTIONS

None at authoring time. All decisions surfaced during clarification were resolved by ticket pins, PM-notes decisions, or the decision log below (DEC-1 through DEC-18, including the iteration-2 corrections); the PM record carries an empty open-questions list.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Additive-only schema strategy: keep `delivery.status.v1`; grow the section set 6 → 9 with sections 1–6 unchanged in id, order, state derivation, and required fields (the optional-field delta is DEC-16's named allowlist); bump the version only for a future breaking change | The ticket frames this as an expansion; existing consumers (brief, doctor, verify-gates contract reuse) consume by reference; additive growth keeps every shipped consumer working without a migration | 2026-11-06 |
| DEC-2 | Finding codes are closed contract data in a namespaced dotted registry (`<surface>.<finding>`), declared beside the existing bounds and label sets, with a closed three-value severity set and per-code defaults | Matches the shared M1 contract's stable-codes pin and the repo's policy-as-data convention (thresholds, labels, caps are contract data, never configuration) | 2026-11-06 |
| DEC-3 | Grouping is per section, per code: one finding per code with exact count, deterministic representative evidence (first member in the section's fixed ranking), bounded member list (≤ 8 identities); findings rank severity → count desc → code → first occurrence | Directly implements the pinned "four red CI findings on mains is one job" case and keeps ranking total and order-independent | 2026-11-06 |
| DEC-4 | Hygiene assertions are tri-state over mapped normalized data; the ADR-0006 unknown protection gates at source-declared availability (an undeclared signal is unknown, never a violation), while item-level absence inside a declared, available signal is a violation matching the shipped `missing-title`/`missing-labels` semantics (model refined by DEC-13) | ADR-0006 binding at the source level; the availability gate preserves the no-fabrication rule while making the convention assertions effective | 2026-11-06 |
| DEC-5 | Ready-to-merge reuses the queue-ready close-item classification (observed approval on non-draft open PR = merge-ready; everything else review-pending) and the existing PR/CI collectors; zero new reads; items rank merge-ready first then queue-ready rank keys, capped at 8 | Ticket AC-4 and the no-new-reads invariant; reuse avoids a second, divergent definition of merge readiness | 2026-11-06 |
| DEC-6 | Owner-gate ages reuse the M1-S5 SLA evaluator output (age per ADR-0004, `slaState`, unknown-age markers escalate); the digest writes no decision records and changes no thresholds | Read-only invariant; one SLA definition shared by board and digest prevents divergence | 2026-11-06 |
| DEC-7 | Lanes attention-state vocabulary and `lane.idle-no-reason` are declared now but dormant; the section keeps reporting declared not-delivered evidence until M1-S17; no lane data is fabricated | PM decision (binding); pinned partial-collection rule covers the gap in-band | 2026-11-06 |
| DEC-8 | Spend and blockers join as named `not-delivered` placeholder sections (capability + expected story M1-S19 / M1-S16 + `engine-not-delivered`), reusing the lanes declared-gap pattern rather than ad-hoc marker fields | Ticket pins them as named placeholders; the uniform section shape keeps state derivation, counts, evidence, and truncation uniform across all nine sections | 2026-11-06 |
| DEC-9 | Exit-code semantics unchanged: successful runs exit 0 with degraded sections in-band; exit-1-on-actionable-finding deferred to M1-S20 | PM decision (binding); SPEC-STATUS-DIGEST pins section failures as digest data, not command failure | 2026-11-06 |
| DEC-10 | No `--watch` flag in this change | PM decision (binding); daemon M1-S18 owns the flag and its control socket | 2026-11-06 |
| DEC-11 | Human bounds raised 24 → 32 lines and 4096 → 6144 bytes; grammar extension spelled out exactly (three new section lines, attention rollup line, two tracker fragments); golden fixtures pin the result | Delegation requirement to state new declared bounds explicitly; the digest grows by a pinned, visible amount, not an open-ended one | 2026-11-06 |
| DEC-12 | Escalated owner gates and stale-conditionless parked items surface as findings (`tracker.owner-gate-escalated`, `parked.stale-no-condition`) | Attention-state coverage is the story's goal; these are the digest-native attention signals the ticket's lanes/idle example generalizes to; both are derivable from existing collectors with zero new reads | 2026-11-06 |
| DEC-13 | Hygiene violation model pinned (iteration 2): within a signal the source declares mapped-and-available, item-level absence is a violation — one violation arm covering absent, empty, and unparseable values, per assertion as contract data; ADR-0006's unknown protection operates at source-declaration level, so an undeclared signal yields unknown, never a violation | Test-plan GAP-3; absence-as-violation is the only model that lets the convention assertions catch tickets lacking required fields, and it matches the shipped `missing-title`/`missing-labels` semantics; the availability gate keeps ADR-0006's protection intact | 2026-11-06 |
| DEC-14 | Mapped-signal provenance (iteration 2): the hygiene signals map fields the existing bounded tracker page already returns — normalized labels (epic token `epic`/`epic:`; points token `points:` with parseable non-negative integer) and the page's milestone field, additively normalized on the work-item view — with declared per-assertion availability traveling on the tracker read; no new adapter endpoint, package, subpath, or pagination; production stays all-unknown where a mapping is not declared, and corpus fixtures supply mapped values so the violation/satisfied arms are artifact-reachable | Test-plan GAP-4; without named mapped fields and fixtures the non-unknown arms would be permanently untestable | 2026-11-06 |
| DEC-15 | `STATUS_MAX_FINDINGS_PER_SECTION` stays 8 as declared defensive headroom: with the shipped ten-code registry no section can emit eight distinct codes (tracker maximum seven); cap enforcement is proven at the pure aggregation layer and tests may inject a test-only registry extension to drive the cap | Test-plan GAP-2; keeping the bound avoids renumbering contract data while making its role explicit | 2026-11-06 |
| DEC-16 | Additive-delta rule for sections 1–6 (iteration 2): ids, order, state derivation, and required fields are frozen; the only permitted delta is the named optional-field allowlist — optional `findings[]` on every section, tracker hand-back item `age`/`ageUnknownReason`/`slaState`, hygiene per-assertion tri-state counts, parked-work optional `condition`, lanes attention-state declaration fields; existing consumers ignore unknown fields, and golden regeneration is a reviewed exception, never a suite rewrite | Test-plan GAP-10; replaces the inaccurate "unchanged in shape" wording with a precise, checkable delta rule | 2026-11-06 |
| DEC-17 | Minor readings adopted from the test plan (iteration 2): finding members are unique identities ordered by the section's fixed ranking with `evidenceRef` as the representative (first deduplicated member); the summary placeholder count is exactly the two delivered placeholders (`spend`, `blockers` — lanes excluded); the attention rollup `+N` counts grouped findings beyond the previewed three; the 32-line human cap is defensive headroom (worst case 11 lines) while the 6144-byte cap is the operative enforced bound; the lanes attention-state vocabulary literals are `delivering`, `idle-with-reason`, `idle-no-reason`; contract-name spelling is camelCase fields, kebab-case section/assertion ids, lowercase dotted codes, SCREAMING_SNAKE constants | Test-plan GAP-5/6/7/8/11/12; adopting the test plan's readings keeps spec and test plan in agreement | 2026-11-06 |
| DEC-18 | No-evidence-no-claim named (iteration 2): a failed or unresolved read emits no finding for its section — findings are observed-evidence claims; the section state and evidence reasons carry the failure | Test-plan GAP-9; names existing SPEC-STATUS-DIGEST behavior so the test plan's assertion has a spec anchor | 2026-11-06 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Status vocabulary contract (shared contracts) | Updated — finding registry, severity set, new bounds, three new section ids/shapes, additive item fields (types and declared data only) |
| Status aggregator and human renderer (pure domain) | Updated — findings layer (grouping, ranking, capping), three new section builders, extended derivation-matrix rows, extended grammar |
| Tracker normalized view (adapter normalization) | Updated — additive milestone field and the hygiene mapped-signal projection (DM-13) mapped from the same bounded page; no new endpoint, package, or pagination |
| Status command composition (CLI edge) | Updated — injects the same reads into the extended aggregation; no new reads, no write paths |
| Command registry documentation | Updated — the status row's M1-S10 note reconciles to delivered behavior |
| Structure, behaviour, golden, and corpus test surfaces | Updated — registry/bounds structure checks; grouping, assertion, placeholder, and derivation behaviour tests; golden grammar pins; corpus completeness meta-check extended to nine sections × five states |
| Fixtures (golden + corpus) | Updated — new cases: four-failed-run grouping, unknown review signals, unknown gate ages, parked conditions present/absent, placeholder sections, all-caps bound case |
| Feature documentation set | Updated in the documentation-sync phase — status digest (canonical), brief ("same collector state" claim), owner-gate SLA and queue-ready (reuse claims), command registry, status man page |

## 17. ACCEPTANCE CRITERIA

Ticket acceptance criteria (verbatim, binding): **1.** Each new collector is artifact-verified and bounded. **2.** Ticket-hygiene assertions are covered by name (epic membership, story points, in-sprint state). **3.** Every finding carries a stable finding code. **4.** Ready-to-merge ranks as an action list.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a digest rendered from any supported fixture state, **when** its findings are inspected (machine envelope), **then** every finding carries a `code` present in the declared registry and a `severity` from the closed three-value set, and zero findings carry free-form identities | F-1, NFR-8 |
| AC-F2-1 | **Given** a CI page with four failed runs on the primary branch, **when** the digest is built, **then** the CI section emits exactly one `ci.red-on-main` finding with `count: 4`, four bounded member identities, and deterministic representative evidence — never four separate findings | F-2, DEC-3 |
| AC-F2-2 | **Given** more same-code observations than the member cap — including repeated identities — **when** the digest is built, **then** `count` stays the exact observation total, `members[]` holds at most the cap of unique identities in fixed ranking order, `evidenceRef` is the first deduplicated member, and the section's truncation marker declares the drop | F-2, NFR-1 |
| AC-F2-3 | **Given** findings of mixed severities and counts in one section, **when** ranked, **then** the order is severity, then count descending, then code ascending, then first occurrence in fixed source order — stable under any input permutation | F-2, NFR-6 |
| AC-F2-4 | **Given** a test-only registry extension injected at the pure aggregation layer producing more distinct codes in one section than the findings cap, **when** the digest is built, **then** exactly eight findings render in rank order and the section's truncation marker declares the drop | F-2, DEC-15 |
| AC-F2-5 | **Given** a failed or unresolved CI read, **when** the digest renders, **then** the CI section emits no finding — its `unknown` state and evidence reasons carry the failure — and no `ci.red-on-main` claim is fabricated | F-2, DEC-18 |
| AC-F3-1 | **Given** open pull requests where one non-draft PR holds an observed approval, **when** the ready-to-merge section renders, **then** that item is classed `merge-ready` and ranks above every `review-pending` item, with rank keys deterministic (numeric-aware ref, then source ref, then target ref) | F-3, DEC-5 |
| AC-F3-2 | **Given** review signals unavailable or unknown, **when** the section renders, **then** affected items are `review-pending` with an unknown review marker, the section is `degraded`, and the merge-ready count renders `?` — never fabricated as approved or zero | F-3, NFR-9 |
| AC-F4-1 | **Given** tracker fixtures whose hygiene signals are declared available, **when** the hygiene family renders, **then** each of the three named assertions (`epic-membership`, `story-points`, `in-sprint`) appears as a named assertion surface with tri-state violation/unknown/satisfied counts | F-4 |
| AC-F4-2 | **Given** a declared-available signal and an item carrying no conforming value, **when** the hygiene family renders, **then** the matching named assertion records a violation — an item with no `epic`/`epic:` label violates `epic-membership`, an item with no `points:` label or an unparseable integer suffix violates `story-points`, and an item with no mapped milestone violates `in-sprint` — each emitted as its finding code and grouped per F-2 | F-4, DEC-13 |
| AC-F4-3 | **Given** a source that does not declare a signal available (including a mixed case where one of the three is undeclared), **when** the hygiene family renders, **then** the undeclared assertion is all-unknown with `signal-unavailable` and zero violations while the declared assertions evaluate independently | F-4, DEC-13 |
| AC-F4-4 | **Given** items carrying conforming values (an `epic`/`epic:` label, a `points:` label with a parseable integer, a mapped milestone), **when** the hygiene family renders, **then** each matching assertion records satisfied, emits no finding, and contributes to no violation count | F-4 |
| AC-F5-1 | **Given** a hand-back item with a parseable provider-native timestamp older than 24 h, **when** the digest renders, **then** the item carries its observed age and `slaState: escalated`, and it is counted by the `tracker.owner-gate-escalated` finding and the tracker line's `gates <n> escalated` fragment | F-5, DEC-6 |
| AC-F5-2 | **Given** a hand-back item with absent or unparseable timestamp, **when** the digest renders, **then** the item carries the declared unknown-age marker, `slaState: escalated` per the existing SLA rule, and age is never fabricated as zero or fresh | F-5, NFR-9 |
| AC-F6-1 | **Given** a parked entry with a recorded condition, **when** parked work renders, **then** the condition appears on the item within the detail cap; **and given** an entry without a condition, **then** no condition is invented | F-6 |
| AC-F6-2 | **Given** a parked entry with unknown age and no recorded condition, **when** the digest renders, **then** it contributes to the grouped `parked.stale-no-condition` finding | F-6, DEC-12 |
| AC-F7-1 | **Given** the lane engine is not delivered, **when** the lanes section renders, **then** it reports the declared not-delivered evidence (capability, expected story, reason) exactly as shipped, the attention-state vocabulary is present as declared contract data, and `lane.idle-no-reason` is never emitted | F-7, DEC-7 |
| AC-F8-1 | **Given** spend telemetry is not delivered, **when** the digest renders, **then** the spend section is `not-delivered` naming capability and expected story M1-S19 with zero items, and the human `spend` line renders the named placeholder | F-8, DEC-8 |
| AC-F9-1 | **Given** the blocker channel is not delivered, **when** the digest renders, **then** the blockers section is `not-delivered` naming capability and expected story M1-S16 with zero items, and the human `blockers` line renders the named placeholder | F-9, DEC-8 |
| AC-F10-1 | **Given** any fixture state, **when** human mode renders, **then** the output matches the declared extended grammar line-for-line (nine section lines in fixed order + optional header + attention rollup), within 32 lines and 6144 bytes, byte-identical to the golden fixture | F-10, NFR-2, NFR-10 |
| AC-NFR-1 | **Given** the corpus completeness meta-check runs, **when** it evaluates coverage, **then** it requires all nine sections and every state in the declared derivation rows including the new ready-to-merge row and the placeholder states, and corrupted states, counts, identities, codes, or truncation flags fail by case name | NFR-10, G-8 |
| AC-NFR-2 | **Given** all new item surfaces populated at their caps, **when** the digest is serialized, **then** the data payload is within the 65 536-byte bound with truncation markers exact, verified by an all-caps corpus case | NFR-1, NFR-3 |
| AC-NFR-3 | **Given** a full digest run, **when** reads are counted, **then** the invocation performs at most three network reads, one park fold, and one configuration resolve — zero new reads for the new sections and findings | NFR-4, DEC-5 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single-change delivery on the established branch/PR model; no flag, no phased runtime rollout — the digest is a read-only command surface and its extension ships as one reviewed contract change.
- Consumer impact is coordinated by the additive strategy (DEC-1): brief, doctor, and verify-gates contract reuse continue unchanged at runtime; documentation reconciliation (status digest spec, brief claim, reuse claims in the SLA and queue-ready specs, command registry, man page) is owned by the documentation-sync phase of this change's lifecycle.
- Downstream adoption: M1-S20 (agent integration) is the named consumer of the finding-code registry; the placeholders announce the M1-S16/M1-S19 surfaces to consumers ahead of their delivery.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. The digest is ephemeral command output over existing read seams; there is no state-schema change, no persisted digest, no backfill, and no seeding. Golden and corpus fixtures extend within the existing fixture model.

## 20. PRIVACY / COMPLIANCE REVIEW

- No new personal data classes. Finding members are identities (refs, run ids), never titles, payloads, or free-form text; evidence continues to carry codes, classes, counts, and safe locations only.
- Parked conditions originate from the git-ignored local PM context and render under the existing detail cap to the same local operator — no new exposure surface beyond the existing parked-work projection.
- The existing redaction chokepoint covers all new machine and human output; no secrets, no credentials, no raw provider payloads, no LLM-generated prose in the digest.
- Assignee is never a signal (ADR-0006); the new assertions consume mapped work-item metadata, not personal activity beyond the existing provider-native timestamp already used for stalls and SLA ages.

## 21. SECURITY REVIEW HIGHLIGHTS

- Read-only posture unchanged: no writes, fences, state mutations, network writes, child processes, or shells; the digest never writes SLA decision records.
- No new credential access, no secret-read allowlist entries, no configuration keys; the primary-branch convention is declared contract data, not an ambient read.
- Composition guard, origin-derived binding, bounded parsing, and bounded reads all inherited unchanged; the new sections consume the same injected facts.
- New bounds shrink the worst-case output surface (caps on findings, members, and action-list items), keeping the digest denial-of-brevity-proof: no unbounded array enters the payload.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Registry changes are contract changes**: adding, renaming, or re-scoping a finding code updates the registry, tests, and documentation together; codes are never silently retired.
- **Placeholder lifecycle**: M1-S16 removes the blockers placeholder; M1-S19 removes the spend placeholder; M1-S17 activates the lanes attention state (turning the dormant code live). Each is its own reviewed contract change touching the section set, derivation, grammar line, and fixtures.
- **The existing maintenance rules carry over**: adding a section remains a contract change to ids/order/derivation/renderer/tests; cap or threshold changes update contract data, tests, and docs without architectural change; the trap catalog remains the early-warning surface for new list-shaped provider quirks.
- **Operational cost unchanged**: same read budget, same invocation profile, no daemon, no retry loop; the human digest grows by at most the declared eight lines within the pinned bounds.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Finding | A digest attention item derived from collector evidence: a code, severity, exact count, bounded members, and representative evidence. |
| Finding code | A stable symbolic identifier from the closed contract-data registry (`<surface>.<finding>`), referenced by agents and tests instead of re-derived. |
| Severity | Closed three-value attention weight (`high`, `medium`, `low`) declared per code in the registry. |
| Grouping | Per-section coalescing of same-code observations into one finding with an exact count and bounded member list. |
| Action list | The ready-to-merge section's ranked item surface: merge-ready close items first, deterministic rank keys, capped. |
| Merge-ready | Observed approval on a non-draft open pull request, per the queue-ready classification reused here. |
| Review-pending | Every other associated open pull request, including unknown review state; never rendered merge-ready. |
| Hygiene assertion | A named mapped-data conformance check (epic membership, story points, in-sprint) with tri-state violation/unknown/satisfied per item. |
| Assertion-unknown | An assertion whose signal the source does not declare available; all-unknown with `signal-unavailable`, counted, never a violation (ADR-0006 gate at the source-declaration level). |
| Mapped-signal availability | The declared per-assertion statement, traveling with the tracker read, that a hygiene signal is mapped and evaluable; the gate between unknown and violation. |
| Absence-as-violation | Within a declared, available signal, an item with no conforming value (absent, empty, or unparseable) violates the assertion — the shipped `missing-title`/`missing-labels` semantics. |
| No-evidence-no-claim | A failed or unresolved read emits no finding for its section; the section state and evidence reasons carry the failure (DEC-18). |
| slaState | The owner-gate SLA state (`fresh`, `escalated`, `default-applied`) projected onto hand-back items from the existing evaluator. |
| Unknown age | A declared marker for an absent or unparseable activity timestamp; the gate escalates and age is never fabricated (ADR-0004). |
| Placeholder section | A named `not-delivered` section declaring a capability and its expected delivering story (spend → M1-S19, blockers → M1-S16). |
| Dormant code | A registry code declared but untriggerable until its delivering story lands (`lane.idle-no-reason` until M1-S17). |
| Attention rollup | The final bounded human line previewing up to three severity-ordered finding groups, then `+N`. |
| Additive-only | Schema evolution that adds fields and sections without removing, re-typing, or reordering existing ones; the version constant stays `delivery.status.v1`. |

## 24. APPENDICES

### Appendix A — Initial finding-code registry (contract data, shipped by this change)

| Code | Severity | Trigger surface | Notes |
|------|----------|-----------------|-------|
| `ci.red-on-main` | high | CI section | Failed CI classification on the declared primary branch; groups all failed runs (pinned case: 4 → 1) |
| `tracker.owner-gate-escalated` | high | Tracker (hand-backs) | Hand-backs with `slaState` escalated or default-applied; unknown-age gates included |
| `tracker.stalled-ticket` | medium | Tracker (stalls) | Existing stall family items, now code-carrying; behavior unchanged |
| `tracker.hygiene.missing-title` | low | Tracker (hygiene) | Existing finding, now code-carrying |
| `tracker.hygiene.missing-labels` | low | Tracker (hygiene) | Existing finding, now code-carrying |
| `tracker.hygiene.epic-membership` | low | Tracker (hygiene) | Named assertion violation (no conforming value); emitted only when the signal is declared available — undeclared → unknown, never this code |
| `tracker.hygiene.story-points` | low | Tracker (hygiene) | Named assertion violation (no `points:` label or unparseable integer); emitted only when the signal is declared available — undeclared → unknown, never this code |
| `tracker.hygiene.in-sprint` | low | Tracker (hygiene) | Named assertion violation (no mapped milestone); emitted only when the signal is declared available — undeclared → unknown, never this code |
| `lane.idle-no-reason` | medium | Lanes (dormant) | Declared for M1-S17; never emitted before the engine lands |
| `parked.stale-no-condition` | low | Parked work | Unknown-age parked entry with no recorded condition |

Hygiene assertion codes emit only under declared availability per DEC-13; the dormant `lane.idle-no-reason` never emits before the engine lands (DEC-7).

### Appendix B — New declared bounds (additions and raises)

| Constant | Value | Purpose |
|---|---|---|
| findings per section | 8 | New per-section findings cap |
| members per finding | 8 | New per-finding member-identity cap |
| ready-to-merge items | 8 | New action-list cap |
| human digest lines | 24 → **32** | Raised for three section lines, rollup line, and tracker fragments |
| human digest bytes | 4096 → **6144** | Raised proportionally, golden-pinned |
| serialized data bytes | 65 536 (unchanged) | Re-verified by an all-caps corpus case |

Bound roles: the findings cap (8) and the 32-line cap are defensive headroom (DEC-15, DEC-17) — with the shipped registry no section reaches eight distinct codes, and the extended grammar's worst case is 11 lines; the 6144-byte cap is the operative enforced bound. Findings-cap enforcement is proven at the pure aggregation layer (AC-F2-4).

### Appendix C — Derivation-matrix addition (ready-to-merge)

| Section | `observed` | `degraded` | `unknown` | `unavailable` | `not-delivered` |
|---|---|---|---|---|---|
| ready-to-merge | Pull-request list read succeeded with review signals available (verified-empty included) | Review signals unavailable on any rendered item, or a partial source failure | Pull-request read failed or no usable evidence | No repository binding | Never |

### Appendix D — Ticket-AC traceability map

| Ticket AC | Spec coverage |
|-----------|---------------|
| 1. Each new collector is artifact-verified and bounded | AC-NFR-1, AC-NFR-2, AC-F2-2, AC-F10-1; NFR-1/2/3/10; corpus + golden extension (section 16) |
| 2. Ticket-hygiene assertions covered by name | AC-F4-1..4; F-4; Appendix A codes; DM-7 |
| 3. Every finding carries a stable finding code | AC-F1-1; F-1/F-2; NFR-8; DEC-2 |
| 4. Ready-to-merge ranks as an action list | AC-F3-1..2; F-3; DEC-5 |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | spec-writer | Initial specification from ticket GH-243, backlog M1-S10, PM-notes decisions, SPEC-STATUS-DIGEST, and the M1 planning pack design baselines |
| 1.1 | 2026-11-06 | spec-writer | Iteration 2 (test-plan feedback): pinned hygiene violation conditions (DEC-13), mapped-signal provenance (DEC-14, DM-13, F-4a), defensive findings cap (DEC-15, AC-F2-4), sections 1–6 additive-delta allowlist (DEC-16), adopted minor readings (DEC-17), no-evidence-no-claim (DEC-18, AC-F2-5); AC-F4 block rewritten so violation/unknown/satisfied are each covered by name |

---

## AUTHORING GUIDELINES

Sources: GitHub issue GH-243 (tasks, ACs, pinned decisions verbatim); `doc/planning/oss-tooling/backlog.md` M1-S10 (canonical scope); `doc/planning/oss-tooling/milestones/m1/contracts.md` (`status` expansion + shared stable-codes/tri-state contracts) and `milestones/m1/commands/status.md` (proposed man page — treated as a refined-at-delivery baseline, with `--watch`/exit-1/`questions[]` excluded per PM decisions); `doc/spec/features/feature-status-digest.md` (shipped invariants: bounds table, five-state vocabulary, derivation matrix, human grammar, QA surfaces); `feature-queue-ready.md` (merge-ready classification and rank keys); `feature-owner-gate-sla.md` (age clock, slaState, unknown-age rules); `feature-brief.md` (consumer-by-reference coupling); `chg-GH-243-pm-notes.yaml` (three binding decisions, phase-7 doc-risk list); sibling spec GH-229 for format. Bound values, the registry contents, and the grammar extension are this spec's declared contract decisions (DEC-1..DEC-12), taken within the constraints above; no code was written and no implementation steps are included, per the pure-writer role.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-243)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-1..F-10, DM-1..DM-12, NFR-1..NFR-10, RSK-1..RSK-9, DEC-1..DEC-12, AC-*)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (reuse described by concept, not copied)
- [x] Front matter validates per front_matter_rules
- [x] Ticket's four ACs traced verbatim (Appendix D) and all pinned decisions recorded (DEC-7..DEC-10)
- [x] Human grammar changes spelled out exactly (DM-10); new declared bounds stated (DM-11, Appendix B)
- [x] Non-goals explicit: no --watch, no exit-code change, no lane engine, no spend/blockers implementation, no queue/lane engine change
- [x] Iteration 2: test-plan gaps GAP-2..GAP-12 resolved (DEC-13..DEC-18); OPEN QUESTIONS still empty; pinned decisions and non-goals intact
