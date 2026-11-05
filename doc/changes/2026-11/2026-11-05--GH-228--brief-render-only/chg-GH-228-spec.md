---
change:
  ref: GH-228
  type: feat
  status: Proposed
  slug: brief-render-only
  title: "M1-S6: Brief render-only v0"
  owners: [engineering]
  service: delivery-os
  labels: [change, m1]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: [status-digest, result-contract, queue-ready, verify-gates, cli-command-registry, m1-contract-pack]
    external: [github-rest]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver a deterministic, render-only `brief` command that renders the owner's daily attention surface from the same collector state as the status digest, with anchored decision-first actions and named placeholders for every unbuilt capability.

## 1. SUMMARY

Add a read-only `brief` command: one screen, decision-first, rendered from the same collector state as the shipped status digest (`delivery.status.v1`), with no LLM in the render path. The brief carries ready-to-merge, blocker questions, and owner-gate ages as anchored actions; every unbuilt capability (typed questions, gate SLA states, the queue/lane engine) renders as a named placeholder that maps exactly to the digest's closed five-value section-state vocabulary. Collector unavailability is digest data, never a command failure; the brief adds no error-table row, no configuration key, no adapter read, and no new package or runtime location.

## 2. CONTEXT

### 2.1 Current State Snapshot

The shipped status command (M0-S6) returns one bounded `delivery.status.v1` digest: six fixed sections in order, each with a closed five-value state (`observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`), bounded evidence, uniform counts, ranked capped items, and explicit truncation. A failed, absent, unattempted, or unresolved read is digest data, not a command failure. The pure aggregation surface (`aggregateStatus`) and the deterministic human renderer (`renderStatusHuman`) derive everything from injected facts with zero writes and zero child processes. The related read-only ready-set command (`queue ready`, M0-S7) and the verify-gates battery exist as separate surfaces with their own contracts. The M1 contract pack proposes `brief` as a one-screen deterministic render from the same collector state; the command registry lists it as planned (M1-S6), delivery rank 28, depending only on M0-S6.

### 2.2 Pain Points / Gaps

- The owner's daily attention has no one-screen starting point: facts must be assembled by hand from `status` output, ready-set reads, and tracker probes.
- Chat-based or LLM-assembled summaries have historically drifted or gotten facts wrong; the operator requires every brief rule to be deterministic code (operator requirement R11).
- Unbuilt capabilities (typed blocker questions M1-S16, gate SLA states M1-S5, queue/lane engine M1-S17, spend M1-S19) risk appearing as silent zeros or empty claims instead of named gaps.
- The proposed brief contract declares exit `2` for collector unavailability and an error identity `status.collector.<id>.unavailable`, which contradicts the shipped result-contract convention that status-family section failures are digest data with no error-table row.

## 3. PROBLEM STATEMENT

Because the delivery system renders collector truth only as a coordinator-facing digest and has no deterministic owner-facing render surface, the owner cannot start daily attention from one factual, decision-first screen, resulting in hand-assembled facts, drifted or fabricated summaries, and unbuilt capabilities silently reading as "nothing to do".

## 4. GOALS

- **G-1**: One deterministic, render-only `brief` command that renders from the same collector state as the status digest (one source of truth), with zero reads of its own.
- **G-2**: Decision-first anchored actions: ready-to-merge, blocker questions, and owner-gate ages surface first, each citing collector evidence and carrying an explicit evidence state.
- **G-3**: Named, never-silent placeholders for every unbuilt capability, mapped exactly to the digest's five-value section states.
- **G-4**: A contract posture non-contradictory with the shipped status and result contracts: standard envelope, `{0,1,2}` exit projection, zero new error-table rows, bounded deterministic output, no LLM in the render path.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|---|---|
| Shared-truth agreement with the status digest on identical injected facts | 100% of brief truth claims equal the digest's corresponding claims; 0 brief-only facts |
| Brief-only collector reads | 0 (net read cost identical to one status invocation: at most 3 outbound read-only requests, 1 park fold, 1 config resolve) |
| Unbuilt-capability placeholders rendered | 3 of 3 (typed questions, gate SLA states, lane/queue engine), each named with owning story and state |
| Failed/absent reads rendered as clear, green, available, or zero | 0 |
| New error-table rows or domain kinds | 0; error-table sync check stays green |
| LLM/model calls in the render path | 0; asserted by dependency-boundary checks and review |
| Human output bounds | At most 24 lines and 4096 bytes (one screen) |

### 4.2 Non-Goals

- **NG-1**: No gate verdicts: the brief's ready-to-merge anchor is an attention projection citing collector evidence; merge readiness verdicts remain owned by the verify-gates battery and the merge transaction.
- **NG-2**: No new collectors, adapter reads, configuration keys, state-schema changes, packages, subpaths, or runtime-API locations.
- **NG-3**: No SLA escalation mechanics (M1-S5), typed blocker channel (M1-S16), queue/lane engine (M1-S17), or spend read side (M1-S19); these render only as named placeholders.
- **NG-4**: No expansion of the status digest itself; digest expansion (attention-state coverage) is M1-S10 and renders from the same collector state without changing brief responsibilities.
- **NG-5**: No LLM or model call anywhere in the render path, and no interactive, mutating, or daemon-dependent behavior.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|---|---|---|
| F-1 | A read-only `brief` command rendering one deterministic screen from the same collector facts as the status digest, with zero brief-specific reads | Makes the owner's daily attention start from facts (R11; ticket goal). |
| F-2 | Decision-first anchored actions: ready-to-merge projections, owner-gate ages, and blocker-question surface, each citing bounded collector evidence and an explicit state | Puts decisions before context; anchors are the ticket's named action set. |
| F-3 | A closed named-placeholder catalog for unbuilt capabilities, each placeholder naming the capability, its owning story, and its collector evidence state | Unbuilt capability must be visible by name, never silent (ticket AC 2). |
| F-4 | Truthful evidence-state discipline: every brief surface carries one state from the digest's closed five-value vocabulary and matches the digest section state for the same facts; unknown ages and signals are never fabricated | Prevents false all-clear; brief output matches collector state exactly (ticket AC 1). |
| F-5 | Contract posture: standard `CommandResult` envelope, `{0,1,2}` exit projection, error-identity reuse with zero new rows, collector unavailability as digest data | Keeps brief and status contracts non-contradictory on one source of truth. |
| F-6 | Deterministic, bounded, brand-neutral, read-only render path with no LLM call, no child process, and the same credential-reference composition posture as status | Operator requirement R11 and the standing no-LLM-render constraint. |

### 5.1 Capability Details

- **F-1**: The command is exactly `brief`, composed where the other top-level commands are composed, with no positionals and no command-specific flags beyond the global machine-output switch. It binds to the current checkout the same way status does. It performs zero reads of its own: it consumes the same injected collector facts status consumes (repository binding, tracker read, changes read, CI read, provider configuration and park fold, local PM context) and renders a projection. A successful run returns every surface, including placeholder surfaces; a failed or absent source is surface data, never a command failure.
- **F-2**: Anchored actions render in decision-first order, before any context. **Ready-to-merge** projects only from digest-observed evidence: an open, non-draft pull request whose review signal is observed approved. Each action cites that digest item's bounded evidence; the anchor is attention, not a gate verdict. **Owner-gate ages** project from the tracker section's owner-hand-back family; an age derives only from a present, parseable provider-native last-modified timestamp, and is unknown otherwise. **Blocker questions** render as a placeholder surface in v0 until the typed blocker channel exists.
- **F-3**: The v0 placeholder catalog is closed with exactly three entries: `typed-questions` (owning story M1-S16), `gate-sla-states` (M1-S5), and `lane-queue-engine` (M1-S17). Each placeholder names the capability, the owning story, and its collector evidence state (`not-delivered` for absent capability), and renders in human output as a named line, never as an empty list, a zero, or an observed claim. The catalog grows only through a reviewed change.
- **F-4**: Every anchored surface and every context line carries one state from the closed five-value set, equal to the corresponding digest section state for the same injected facts. An observed surface may legitimately be empty (verified-empty); an unknown, unavailable, or not-delivered surface never renders as empty-by-quiet. Item-level unknown signals (unparseable timestamps, unknown review state) are counted and rendered as unknown, never defaulted.
- **F-5**: `brief --json` emits exactly one standard success envelope whose `data` is the brief payload; failures use only the existing containment identities. Collector unavailability yields a success envelope with named placeholder surfaces at exit `0`, matching the shipped status posture; the proposed exit-2 "collectors unavailable" row and the `status.collector.<id>.unavailable` error identity are not adopted, and no error-table row or domain kind is added.
- **F-6**: Identical injected inputs produce byte-identical human and machine output. Human output uses the injected brand binary name and contains no timestamps, no secrets, no raw payloads, and no generated prose. The command performs zero writes, fences, mutations, network writes, or child processes, admits only a credential-reference external-system instance exactly as status does, and performs no model call — asserted by dependency-boundary checks and review.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Owner morning brief (target loop)
  Owner runs `<binary> brief`
    → command collects the same facts as one status invocation (bounded, read-only)
    → pure projection ranks decision-first surfaces and derives placeholders
    → one screen: ready-to-merge actions, owner-gate ages with placeholder SLA states,
      blocker-questions placeholder, lane/queue placeholder, context lines
    → owner reads facts and decides; no chat, no LLM assembly

Flow 2: Degraded world
  A collector read fails or a source is absent
    → the affected surface carries the digest's state (degraded / unknown / unavailable)
    → the surface names the gap in place; the brief still renders, exit 0
    → nothing renders as a silent zero or an all-clear

Flow 3: Machine consumption
  Agent runs `<binary> brief --json`
    → exactly one valid CommandResult envelope; `data` is the brief payload
    → agents branch on per-surface states and placeholder entries, never on fabricated values
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The read-only `brief` command with `--json` machine mode and a deterministic one-screen human mode.
- The `delivery.brief.v1` brief payload schema and its pure projection and renderer surfaces.
- The three anchored action surfaces (ready-to-merge, owner-gate ages, blocker-question placeholder) and the closed three-entry placeholder catalog.
- Contract posture: envelope, exit projection, error-identity reuse, bounds, determinism, no-LLM guarantee, read-only and credential posture.
- Documentation impacts: a new current-truth feature specification for the brief, cross-links from the status-digest specification, the command registry row moving planned to delivered, and man-page pack updates aligning the proposed brief contract with the shipped behavior.

### 7.2 Out of Scope

- [OUT] SLA escalation mechanics or any `escalated`/expiry state (M1-S5); ages render, classifications do not.
- [OUT] Typed blocker questions, answers, or any question record (M1-S16); the surface is a named placeholder.
- [OUT] Queue or lane engine data (M1-S17); the lane/queue placeholder reflects the digest's always-`not-delivered` section.
- [OUT] Spend summary or any cost surface (M1-S19); not surfaced in v0.
- [OUT] Any change to the status digest schema, sections, or command; any new collector, adapter read, configuration key, or state-schema change.
- [OUT] LLM or model calls in any brief path; interactive, mutating, daemon-dependent, or watch behavior.

### 7.3 Deferred / Maybe-Later

- Spend anchor and placeholder surfacing, with M1-S19.
- SLA-state rendering replacing the placeholder, with M1-S5.
- Live question records replacing the placeholder, with M1-S16.
- Anchor surfaces joining the status digest as attention-state coverage (M1-S10), rendering from the same collector state; the brief remains the owner-facing render surface in v0 and both surfaces stay non-contradictory.
- Brief-specific surfacing for parked-work and provider context beyond the digest projection, if owner review asks for it.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. The command reuses the existing bounded read-only collection reads through the delivered adapters; no new endpoint, transport, or API surface is introduced.

### 8.2 Events / Messages

None. The command emits no events, subscribes to nothing, and touches no daemon, control socket, or stream.

### 8.3 Data Model Impact

| ID | Element | Description |
|---|---|---|
| DM-1 | Brief payload (`delivery.brief.v1`) | The machine `data` payload: schema version, injected generation time, repository binding reference, per-surface states, ranked anchored actions, placeholder entries, and explicit truncation markers. Reuses the status vocabulary by reference rather than duplicating it. |
| DM-2 | Anchored action record | A ready-to-merge projection: item identity, citing evidence from the digest's bounded item evidence, and the surface state. Never a gate verdict. |
| DM-3 | Placeholder record | A closed-catalog entry: stable capability id, owning story reference, and the collector evidence state that justifies the placeholder (`not-delivered` for absent capability). |
| DM-4 | Reused collector-state vocabulary | The closed five-value section states, the tracker owner-hand-back family, the changes review signals, the CI classification, and the declared status bounds are consumed by reference from the delivered status contracts; no parallel vocabulary is defined. |

### 8.4 External Integrations

None added. The same GitHub collection reads (tracker list, open pull-request list, one bounded check-runs page), provider configuration read, verified park fold, and local PM-context read are reused exactly as the status invocation performs them. No new provider, credential path, or network call is introduced.

### 8.5 Backward Compatibility

Additive change: a new command name registered in the command registry, respecting the locked command naming decision. No existing command, envelope, digest schema, exit code, or error identity changes. The proposed man-page exit-2 row and error identity for the brief are corrected to the shipped posture as an in-change documentation update; no consumer contract exists yet for the brief, so nothing breaks.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|---|---|---|
| NFR-1 | One-screen output bound | Human output at most 24 lines and 4096 bytes; machine `data` payload at most 65536 bytes; same declared bounds as the status digest, reused by reference; every truncation explicit. |
| NFR-2 | Determinism | Identical injected inputs produce byte-identical human and machine output; human output carries no timestamps; golden bytes pin the render. |
| NFR-3 | Read-cost parity | Zero brief-specific reads: net cost identical to one status invocation (at most 3 outbound read-only requests, 1 park fold, 1 configuration resolve); zero retries, loops, pagination crawls, or daemon interactions. |
| NFR-4 | Render latency | Pure projection over cap-sized inputs completes within 50 ms on the reference environment. |
| NFR-5 | No-LLM render path | 0 model calls in the render path; asserted by dependency-boundary checks and by review on every change to the render surface. |
| NFR-6 | Read-only and containment posture | 0 writes, fence acquisitions, state mutations, network writes, or child processes; only a credential-reference external-system instance is admitted, exactly as status; the sole serialization redaction path covers all output. |
| NFR-7 | Error-table stability | 0 new error-table rows, 0 new domain kinds, 0 new configuration keys; the error-table sync check stays green. |
| NFR-8 | Brand neutrality | 0 product or binary literals in committed code and docs; human output uses the injected brand binary name; the literal and inventory gates stay green. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No new telemetry. The standard envelope's `runId` and `timing` remain the invocation observability surface, and the brief payload's per-surface evidence states, placeholder entries, and truncation markers are the observability content. Degraded collection is visible in-band on the rendered surfaces; nothing is reported green from an unobserved source.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|---|---|---|---|---|---|
| RSK-1 | Brief and status contracts diverge (exit semantics, error identity, vocabulary) | H | M | DEC-2 pins the status evidence posture; DEC-1 pins one source of truth; shared-truth agreement is an acceptance criterion; man-page reconciliation is an in-change doc target | L: future edits could drift; mitigated by cross-linked current-truth specs |
| RSK-2 | Ready-to-merge anchor read as a merge authorization | H | M | DEC-1/NG-1: the anchor cites collector evidence and carries a state; gate verdicts remain owned by verify gates and merge; wording and docs state attention-only | L: consumers could still over-trust; residual wording risk |
| RSK-3 | Placeholders drift into silent zeros or fabricated states | M | M | Closed three-entry catalog (DEC-6); every placeholder names capability, story, and state; corpus completeness meta-check covers each placeholder and each state edge | L |
| RSK-4 | Ages or review signals fabricated from absent data | H | L | Reuse the status absence rules: ages only from present, parseable provider-native timestamps; review signals observed-or-unknown, never defaulted | L |
| RSK-5 | Output bound overflow on dense collector worlds | M | L | Same declared caps and deterministic truncation markers as the status digest; golden and bound tests | L |
| RSK-6 | Anchor ownership conflict when M1-S10 expands the status digest | M | M | DEC-4: brief is the v0 owner-facing render surface; M1-S10 joins anchors from the same collector state; both specs cross-link and must stay non-contradictory | M: reconciled again at M1-S10 delivery |

## 12. ASSUMPTIONS

- The ticket's pinned decisions are binding: same collector state as the digest (one source of truth), no LLM in the render path, placeholders named and never silent.
- The shipped status digest specification is the current-truth model of the collector state and its five-value vocabulary; the proposed contract pack documents are proposals refined at delivery, except where this spec pins them.
- The man-page example JSON fields (run id, timing, evidence strings, question ages) are illustrative of the envelope shape only; the binding shape is the standard `CommandResult` envelope plus the payload defined here.
- M1-S5, M1-S16, M1-S17, and M1-S19 are not delivered at the time this change ships, so their placeholders render in v0.
- The ticket's reference to a milestone README that does not exist in the pack is dead; pack conventions live in the contract pack files actually present, and this spec does not cite the dead path as normative.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|---|---|---|
| Depends on | Status digest v1 (M0-S6, shipped) | The one source of truth: collector facts, five-value states, vocabulary, bounds, and read posture. |
| Depends on | Result contract and error table (shipped) | Envelope, `{0,1,2}` exit projection, containment identities, redaction chokepoint, error-table sync check. |
| Depends on | Queue-ready and verify-gates semantics (shipped) | Merge-ready/observed-approval conventions and gate-verdict ownership the ready-to-merge anchor must not contradict. |
| Depends on | Command naming lock and command registry | The `brief` name is planned in the registry; delivery moves the row to delivered. |
| Enables | Owner-gate SLA (M1-S5) | The aging surface on which SLA states will render. |
| Enables | Typed blocker channel (M1-S16) | The placeholder surface that live questions will replace. |
| Relates to | Status digest expansion (M1-S10) | Joins the same anchors to the digest from the same collector state; responsibilities reconciled by DEC-4. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|---|---|---|---|
| OQ-1 | Exact human line grammar and within-screen surface wording (beyond the pinned decision-first order and named-state rule) | The ordering, per-surface states, and bounds are pinned here; exact line wording is rendered deterministically and pinned with golden bytes at delivery. If the one-screen bound cannot fit the decision-first ordering, the ordering wins and the bound pressure is reported back. | Open; resolved at story delivery via golden fixtures. No `@decision-advisor` escalation required unless the ordering and bound conflict. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|---|---|---|---|
| DEC-1 | The brief renders from the same collector state as the status digest with zero brief-specific reads (ticket pinned decision) | One source of truth; eliminates brief-only drift (R11). | 2026-11-05 |
| DEC-2 | Collector unavailability is digest data, not a command failure: the brief renders with named placeholder surfaces and exit `0`; failures use only the existing containment identities (invocation → 1, internal → 2); the proposed exit-2 "collectors unavailable" and the `status.collector.<id>.unavailable` error identity are not adopted and no error-table row is added | Keeps brief and status non-contradictory, satisfies the `{0,1,2}` taxonomy and the error-table sync check without new rows; mirrors the shipped status evidence posture. | 2026-11-05 |
| DEC-3 | No LLM in the render path (ticket pinned decision) | Deterministic render is the operator's explicit requirement; every brief rule exists because assembly once drifted. | 2026-11-05 |
| DEC-4 | The brief is the owner-facing render surface for the three anchors in v0; M1-S10 joins the same anchors to the status digest from the same collector state, so the two contracts stay non-contradictory | Resolves the overlap between the brief contract and the proposed status expansion without duplicating collection or contradicting either surface. | 2026-11-05 |
| DEC-5 | The v0 anchor set is exactly ready-to-merge, blocker questions (placeholder), and owner-gate ages; spend is not surfaced in v0 | Ticket scope decides the anchors; spend joins only through a later additive change with M1-S19. | 2026-11-05 |
| DEC-6 | The placeholder catalog is closed for v0 with exactly three entries — `typed-questions` (M1-S16), `gate-sla-states` (M1-S5), `lane-queue-engine` (M1-S17) — each naming capability, owning story, and collector evidence state | Makes "named, not silent" testable and prevents silent zeros; the catalog grows only through a reviewed change. | 2026-11-05 |
| DEC-7 | Ready-to-merge projects only observed-approval, non-draft, open pull-request evidence from the digest, and is an attention anchor, never a gate verdict | Keeps the anchor truthful against the digest's review-signal availability and non-contradictory with verify-gates and merge ownership. | 2026-11-05 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|---|---|
| CLI command surface | New read-only `brief` command composed beside the existing top-level commands |
| Core contracts | New brief payload types reusing the status vocabulary by reference; data-only |
| Core domain | New pure projection and deterministic human renderer over injected collector facts |
| Status digest specification | Cross-links to the new current-truth brief specification; no schema or behavior change |
| Command registry | `brief` row moves from planned to delivered at doc-sync |
| Man-page pack | Proposed brief contract aligned with shipped behavior (exit and error rows per DEC-2) |
| New current-truth feature spec | Authored for the brief in this change's documentation phase |
| Adapters, state layer, configuration | No change: zero new reads, keys, schemas, packages, or subpaths |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|---|---|---|
| AC-F1-1 | **Given** identical injected collector facts, **when** the status digest and the brief are rendered from those facts, **then** every truth claim in the brief (per-surface states, counts, ages, action identities, placeholder justifications) equals the digest's corresponding claim, and the brief performs zero collector reads of its own. | F-1, F-4, NFR-3 |
| AC-F1-2 | **Given** any collector fact set, **when** the brief runs, **then** it renders exactly one screen within the declared bounds (at most 24 human lines and 4096 bytes; machine `data` at most 65536 bytes) with explicit truncation markers on any drop. | F-1, NFR-1 |
| AC-F2-1 | **Given** an observed approved, non-draft, open pull request in the changes evidence, **when** the brief renders, **then** a ready-to-merge action cites that item's bounded digest evidence; **given** unknown or unavailable review signals, **when** the brief renders, **then** no merge-ready claim is made and the surface names its state from the five-value set. | F-2, F-4, DM-2 |
| AC-F2-2 | **Given** owner-hand-back items with a parseable and an absent or unparseable last-modified timestamp, **when** the brief renders, **then** the age renders only from the parseable timestamp, the other item's age is unknown and never fabricated, and no SLA escalation state is rendered — the gate-sla-states placeholder appears instead. | F-2, F-3, F-4 |
| AC-F3-1 | **Given** v0 with M1-S5, M1-S16, and M1-S17 unbuilt, **when** the brief renders, **then** all three catalog placeholders render, each naming its capability, owning story, and collector evidence state, and blocker questions, SLA states, and the lane/queue surface never render as observed, empty, or zero. | F-3, DM-3 |
| AC-F4-1 | **Given** every collector failure mode in the digest's state-derivation matrix (failed reads, absent sources, missing credential, unresolved commit, absent or malformed local context, torn park fold, undeclared chain), **when** the brief renders, **then** every affected surface carries exactly the digest's section state, and no failed, absent, unattempted, or unresolved read renders as clear, green, available, or zero. | F-4, DM-4 |
| AC-F5-1 | **Given** any invocation outcome, **when** `--json` is used, **then** exactly one valid `CommandResult` envelope is emitted with an exit code in `{0,1,2}`; collector unavailability yields a success envelope at exit `0` with named placeholders; only the existing containment identities can fail the command (invocation → `1`, internal → `2`); zero new error-table rows exist and the error-table sync check stays green. | F-5, NFR-7 |
| AC-F6-1 | **Given** identical injected inputs, **when** the brief runs twice, **then** the human text and the machine envelope are byte-identical, and the human text contains no timestamps, no raw payloads, and no generated prose. | F-6, NFR-2 |
| AC-F6-2 | **Given** the delivered tooling, **when** the dependency-boundary checks and review run on the render path, **then** the brief render surface imports no model-call capability and performs no model call. | F-6, NFR-5 |
| AC-F6-3 | **Given** a planted secret value and any outcome, **when** output is written, **then** the single serialization redaction path covers the envelope and human text; the run performs zero writes, zero state mutations, zero child processes, and refuses any non-credential-reference external-system instance exactly as status does. | F-6, NFR-6 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

The command ships as an additive top-level command behind the existing composition, with its current-truth feature specification authored in the same change. Documentation sync aligns the command registry row, the man-page pack, and the status-digest cross-links before review closes. No migration, feature flag, or deprecation is involved; adoption is the owner choosing `brief` as the morning first call. The placeholder catalog and anchor set grow only through reviewed changes.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. The command reads existing state and sources and writes nothing; no store, schema, seed, or backfill changes.

## 20. PRIVACY / COMPLIANCE REVIEW

No new privacy surface. The brief reuses the status evidence model: bounded codes, classes, counts, and safe locations only; no raw payloads, no item titles beyond the digest's own projections, no secrets, no credential values, and no ambient environment reads outside the existing allowlist. The single serialization redaction chokepoint covers machine and human output.

## 21. SECURITY REVIEW HIGHLIGHTS

Read-only by construction: zero writes, fences, mutations, network writes, and child processes. Composition admits only a credential-reference external-system instance, exactly as status; credential resolution stays on the credential port with no new allowlist entry. Bounded addressing and bounded reads are inherited unchanged from the status collector set. Brand neutrality holds: no product or binary literals; human output uses the injected brand name.

## 22. MAINTENANCE & OPERATIONS IMPACT

A new current-truth feature specification becomes the maintenance baseline for the brief; the status-digest specification cross-links to it. Adding an anchor or placeholder is a contract change to the closed catalog plus tests and docs. When M1-S5, M1-S16, and M1-S17 land, their placeholders are replaced by real surfaces through their own reviewed changes, preserving the same-source and no-LLM invariants; M1-S10 reconciliation follows DEC-4. The no-LLM render-path assertion is re-run on every change to the render surface.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Brief | The one-screen, decision-first, deterministic render of the collector state for the owner's daily attention; render-only, no LLM. |
| Anchored action | A decision-first surface entry (ready-to-merge, owner-gate age, blocker question) citing bounded collector evidence and carrying an explicit evidence state; attention, never a gate verdict. |
| Named placeholder | A closed-catalog entry naming an unbuilt capability, its owning story, and its collector evidence state; rendered in place, never silent, never a zero. |
| Same collector state | The identical injected fact set the status digest consumes; the brief adds zero reads of its own. |
| `delivery.brief.v1` | The brief payload schema version in the machine envelope's `data`. |
| Five-value section state | The digest's closed state set (`observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`), reused by reference for every brief surface. |

## 24. APPENDICES

Sources: GitHub issue GH-228 (goal, tasks, two acceptance criteria, binding pinned decisions); clarify-scope PM notes; operator requirement R11 (brief render-only, same source as the digest); M1 backlog entry M1-S6 and ranking (rank 28, depends on M0-S6); the M1 contract pack (`brief` man-page proposal, `status` man page, shared contracts, `board`/`brief` outcomes); the shipped current-truth specifications for status digest, result contract and error table, queue ready, and verify gates; the command registry row; and the roadmap M1 section (attention surfaces; standing constraint that digest, brief, and plan render paths contain no LLM calls). The proposed man-page example envelope fields are illustrative, not binding. The ticket's reference to a milestone README absent from the pack is dead and is not cited as normative.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-05 | Change spec writer | Initial specification for the render-only brief v0 |

---

## AUTHORING GUIDELINES

Authored from the ticket, the clarify-scope PM notes, the M1 contract pack, and the shipped current-truth specifications only. The three pinned ticket decisions are recorded as decisions and not re-derived. The proposed brief contract's exit-2 row and error identity were reconciled against the shipped result-contract and status evidence posture rather than copied, and the reconciliation is recorded as DEC-2. Unbuilt-sibling capabilities (M1-S5, M1-S10, M1-S16, M1-S17, M1-S19) are scoped as placeholders or deferred items, never fabricated states. Outcomes are phrased as observable behavior; no implementation tasks, file paths, or code-level instructions are included.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-228)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, OQ-, DEC-, AC-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] Out-of-scope items prefixed `[OUT]`
- [x] Placeholder vocabulary maps exactly to the digest's five-value states; nothing fabricated
