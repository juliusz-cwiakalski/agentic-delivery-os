---
id: TDR-0008
decision_type: tdr
status: Proposed
created: 2026-11-01
decision_date: null
last_updated: 2026-11-01
summary: "Extend the v1 adapter contract additively for closeout: an optional `DeliveryRequest.headSha` (absent = unknown; branch cleanup refuses rather than guesses) and a new `resolve-delivery-thread` member in the closed adapter-operation set (GitHub implements it; Jira/GitLab declare gaps), with no schema-version bump, no migration, and no implied parity."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_scope: repo
review_date: null
classification:
  domains: [architecture, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-183 spec OQ-1)"
  decider: "Juliusz Ćwiąkalski (human acceptance pending at GH-183 PR review)"
  contributors:
    - "@spec-writer (GH-183 F-11/F-12, DM-8, DEC-11/DEC-12, OQ-1 framing)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Owner (human final acceptance)"
  performers:
    - "@coder (GH-183 delivery)"
  informed:
    - "M0-S14 closeout v1 (GH-183)"
    - "M3-S3 full GitHub adapter"
    - "M1-S12 change capsule completion and closeout promotion"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A consumer needs more of the delivery-request head identity than exact-equality comparison (short-sha display, author/committer metadata, or ancestry proof): add a purpose-shaped additive field then; never repurpose `headSha`."
  - "A provider's merged-head signal is observable only outside the injected transport or requires a new credential/network location: revisit the transport boundary (ADR-0005) instead of widening the adapter."
  - "Thread resolution outgrows 'resolve one thread' (reply, unresolve, batch, or inline-comment writes): decide that write shape deliberately with a named consumer; do not overload `resolve-delivery-thread`."
  - "The v1→v2 contract boundary is ever opened: restate the absence semantics and the closed-operation gap discipline deliberately at that boundary."
links:
  related_changes: ["GH-183"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-01--GH-183--closeout-v1-branch-cleanup/chg-GH-183-spec.md"
    - "doc/spec/features/feature-adapter-ports.md"
  contracts:
    - "packages/core/src/contracts/ports.ts"
    - "packages/core/src/contracts/adapter-capabilities.ts"
  diagrams: []
  decisions: ["ADR-0003", "ADR-0004", "ADR-0005", "ADR-0006"]
  experiments: []
  metrics: []
  roadmap_items: ["M0-S14", "M3-S3"]
---

# TDR-0008: Additive Adapter-Contract Extensions for Closeout v1 (`DeliveryRequest.headSha` and `resolve-delivery-thread`)

## Context

- **FACT:** The v1 `DeliveryRequest` port carries `identity`, `sourceRef`, `targetRef`, `reviewState`, and `threads` — no head commit (`packages/core/src/contracts/ports.ts`, read 2026-11-01).
- **FACT:** `ADAPTER_OPERATIONS` is a closed set of seven operations — `read-work-item`, `write-work-item`, `transition-work-item`, `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `write-comment` — and contains no thread-resolution operation (`packages/core/src/contracts/adapter-capabilities.ts`, read 2026-11-01).
- **FACT:** GH-183 closeout v1 needs both signals: F-10 requires the merged request's head to prove a local branch's work landed after a squash merge, and F-8 resolves unresolved review threads on the merged request. The spec records them as DM-8 and DEC-11/DEC-12 and raises the governance question as OQ-1 (GH-183 spec §8.3, §14).
- **FACT:** The substrate's evolution discipline is additive-within-v1 and decision-record governed: "evolution is additive within v1, and a decision record governs adapter-contract changes." The first additive round executed under ADR-0004 (optional `WorkItem.updatedAt`) and ADR-0006 (optional `WorkItem.comments`); further evolutions stay additive within v1 and remain record-governed (`doc/spec/features/feature-adapter-ports.md`, contract-churn risk; ADR-0003; ADR-0004/ADR-0006).
- **FACT:** The contracts tier is types plus `as const` data only — no behavior, I/O, ambient environment, clock, or randomness — so both extensions are type-shape changes, not behavior changes (ADR-0003 DEC-2).
- **FACT:** The conformance invariant pins the closed operation set: `tests/structure/conformance-coverage.test.ts` asserts that the conformance flow registry's operation set equals `ADAPTER_OPERATIONS` exactly, so adding a member requires a registry step in the same change (test read 2026-11-01). This is a mechanical consequence, not a barrier.
- **FACT:** GitHub exposes a merged pull request's head commit and a review-thread resolution mutation (`resolveReviewThread`, named in GH-183 F-8); Jira has no pull-request review-thread surface; the GitLab v1 slice is reads only. Exact recorded response shapes are confirmed by fixtures at implementation.
- **FACT:** The caller routed GH-183 OQ-1 here and requested a TDR for the two extensions; ADR-0004 and ADR-0006 remain the semantic precedent for additive v1 evolution.
- **Scope note (OQ-2):** GH-183's "no closure comment in v1; `write-comment` stays a declared gap" is a PM scope boundary already pinned by NG-6 and the F-11 declarations. It adds no contract element and needs no separate decision record.

## Problem Framing (Clarified)

Two representation questions sit behind the governance question:

1. **Merged-head truth.** Squash-safe deletion needs to compare the local branch head to the merged request's head. The head must come from provider truth and its absence must be distinguishable from a real value; otherwise closeout either deletes on a guess or cannot ever delete.
2. **Thread-resolution vocabulary.** The closed operation set has no way to say "resolve one review thread on a delivery request". Reusing a work-item or delivery-request write would make a capability declaration claim something the adapter does not support — the implied parity the substrate forbids.

Both are the same decision class — how provider truth enters the normalized contract without a parallel surface, without fabricated values, and without implied parity. The governance answer follows from the substrate's own rule: adapter-contract evolution is decision-record governed, and the two prior additive rounds each carry a record. **A record is therefore required; this TDR is that record.**

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Additive within v1: no delivered field is removed, retyped, or made required; the new field is optional; no operation is removed or renamed. | Prior decision (ADR-0004 C-1; feature-adapter-ports evolution discipline) | Contract-inventory/field-shape probes and `pnpm typecheck` in the same change | no |
| C-2 | Contracts-tier neutrality: the extension is type shape plus `as const` data only — no behavior, clock, I/O, or derivation enters `core ./contracts`. | ADR-0003 DEC-2 | `tests/structure/port-neutrality.test.ts` and boundary guards | no |
| C-3 | Truthful absence: a missing `headSha` means unknown, is distinguishable from any value, and is never fabricated or derived; a destructive action on unknown must refuse. | GH-183 AC-F12-3, AC-F10-7; ADR-0004/ADR-0006 absence precedent | Paired present/absent fixtures; refusal test | no |
| C-4 | Capability honesty: an unsupported operation is never reported `applied` or `satisfied`; every gap carries a valid reason; no adapter implies parity. | GH-183 F-11, AC-F11-2/3/4, NFR-9 | Capability-parity tests; gap fixtures; review | no |
| C-5 | No parallel adapter surface and no provider-native type crossing the port. | ADR-0003 DEC-6; feature-adapter-ports | Boundary matrix; `tests/structure/provider-surface.test.ts`; review | no |
| C-6 | No new transport, credential, or network location: the merged-request lookup and the thread-resolution mutation ride the existing injected transport and credential port. | GH-183 F-12/§8.4; ADR-0005 | Code review; secret-read invariant count unchanged | no |
| C-7 | The extension makes the GH-183 acceptance criteria satisfiable: merged head round-trips when present and stays absent when absent (AC-F12-3), and thread resolution is available on GitHub with declared gaps elsewhere (AC-F8-2, AC-F11-2/3). | GH-183 AC | Offline fixture tests in GH-183 CI | no |

## Decision Drivers

1. **Provable squash-safe deletion (safety).** The head comparison must rest on provider truth; a wrong deletion loses unmerged work.
2. **Truthful capability declarations.** Unsupported writes must be visible gaps; parity is never implied (the delivered substrate rule).
3. **Minimal additive surface (least privilege).** Add exactly what closeout needs; no speculative fields or operations.
4. **Uniform absence semantics.** One mental model across the contract: absent = unknown, present = provider-asserted truth.
5. **Precedent consistency (paved road).** Follow the additive-within-v1, record-governed path already traversed by ADR-0004 and ADR-0006.
6. **Fixture provability.** Every representation must be assertable offline against a recorded fixture.
7. **Solo-maintainer cost.** No schema-version bump, no migration, and no per-adapter improvisation.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-183 spec OQ-1 delegates this call).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at GH-183 PR review. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (F-11/F-12, DM-8, DEC-11/DEC-12, OQ-1 framing); `@decision-advisor` (analysis and record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-183; the owner for final acceptance of this record.
- **Performers:** `@coder` (contract fields, capability declarations, adapters, conformance registry, fixtures).
- **Informed:** M0-S14 closeout v1 (GH-183), the M3-S3 full GitHub adapter, and M1-S12 closeout promotion.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| `DeliveryRequest` has no head commit today. | FACT | `packages/core/src/contracts/ports.ts` (read 2026-11-01) | The field would be redundant; decision void. | High |
| `ADAPTER_OPERATIONS` is a closed seven-operation set with no thread resolution. | FACT | `packages/core/src/contracts/adapter-capabilities.ts` (read 2026-11-01) | The operation addition would be unnecessary. | High |
| Adapter-contract changes are decision-record governed and additive within v1. | FACT | `doc/spec/features/feature-adapter-ports.md` contract-churn risk; ADR-0003; ADR-0004/ADR-0006 precedent | The governance answer could be "no record"; it is not — the rule is stated in the current spec. | High |
| The conformance flow-registry test requires every closed operation to appear in a registry step. | FACT | `tests/structure/conformance-coverage.test.ts` (read 2026-11-01) | Adding the operation would not ripple into conformance; it does. | High |
| GitHub exposes merged PR head identity and a review-thread resolution mutation behind the existing transport. | FACT (spec-level) / TO-CONFIRM (exact response shape) | GH-183 F-8/F-12; public GitHub API; fixtures at implementation | If unavailable, GitHub declares the same gap and closeout degrades safely. | Medium-High |
| Jira has no pull-request review-thread surface. | FACT | GH-183 F-8/F-11; Jira provider model | If a Jira surface exists, it can implement later behind the same operation. | High |
| GitLab's v1 slice exposes merged-MR head identity but no writes. | ASSUMPTION | GH-183 F-12/§8.4; GitLab read slice | If not exposed, GitLab leaves `headSha` absent and declares the gap — truthful either way. | Medium |
| No consumer needs richer head metadata or different thread-write shapes in v1. | ASSUMPTION | GH-183 F-8/F-10 scope; no other named consumer | A future purpose-shaped additive extension is added when a consumer names it. | Medium |

## Mental Models & Techniques Used

- **First principles:** What must be true before deleting a branch after a squash merge? The local head must equal the provider's merged head. That is provider-resolved data, so it belongs in the normalized view — not reconstructed from ancestry (which a squash merge deliberately breaks).
- **Inversion:** What makes the extension unsafe? A guessed/derived head, an absence collapsed into a value, or an operation implying support it does not have. Each is excluded by C-3 and C-4.
- **Second-order thinking:** Adding one operation widens a closed union, so every exhaustive consumer and the conformance registry ripple. That cost is paid once, in this change, and is cheaper than a parallel operation family or a per-adapter workaround.
- **Least privilege / minimal surface:** one optional scalar and one narrowly-scoped operation; no batch, reply, unresolve, or delivery-request write surface.
- **Paved road:** additive-within-v1, record-governed is the substrate's declared path; this record extends the ADR-0004/ADR-0006 precedent rather than inventing a new one.
- **Reversibility:** the optional field is removable until a consumer relies on it; the operation member is harder to remove once adapters declare it, so the operation semantics are stated narrowly now.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 additive | C-2 neutrality | C-3 truthful absence | C-4 capability honesty | C-5 no parallel surface | C-6 no new transport | C-7 AC satisfiable |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 do nothing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-1 additive field + operation (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 adapter-local wrapper | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-3 v2 contract / operation family | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 overload `write-delivery-request` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing / Declare Everything a Gap

- **Eligibility:** Not eligible (fails C-7).
- **Summary:** Keep the v1 contract unchanged; branch cleanup always refuses (no merged head) and thread resolution is always a declared gap, even on GitHub.
- **Constraint compliance:** Passes C-1…C-6; fails C-7 because AC-F12-3 (round-trip of the merged head) and F-8 thread resolution on GitHub cannot be satisfied.
- **Driver fit:** Weak on drivers 1 and 2 — safe but permanently unable to deliver the closeout goals.
- **Pros:** Zero contract change; zero ripple.
- **Cons:** The story's two provider-dependent steps never work on the dogfood host; "closeout" degrades to everything-except-threads-and-deletion.
- **Why rejected:** It fails the change's own acceptance criteria.

### Alternative 1 — Additive Optional `headSha` + Additive `resolve-delivery-thread` (chosen)

- **Eligibility:** Eligible.
- **Summary:** Add `readonly headSha?: string` to `DeliveryRequest` (provider-resolved merged head, copied verbatim; absent = unknown) and add `"resolve-delivery-thread"` to `ADAPTER_OPERATIONS` (canonical args `{ deliveryRequest, threadId }`; GitHub implements; Jira/GitLab declare gaps).
- **Constraint compliance:** Passes all constraints C-1…C-7 (matrix above).
- **Driver fit:** Best on every driver: truthful head proof, honest gaps, minimal surface, uniform absence, precedent-following, fixture-provable, no migration.
- **Pros:** One optional scalar and one narrowly-scoped operation; no schema-version bump; reuses the existing transport and credential port; sets no new precedent class.
- **Cons:** Widens a closed union (compile-time ripple into exhaustive consumers and the conformance registry); `headSha` stays absent on providers that cannot supply it; the operation is hard to remove once declared.
- **Why chosen:** It is the only eligible option that satisfies the closeout acceptance criteria without a parallel surface, a fabricated value, or implied parity.

### Alternative 2 — Adapter-Local Wrapper for Head Identity and Thread Resolution

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Leave the core contract untouched; adapters export a provider-specific `DeliveryRequest & { headSha }` view and a provider-specific resolve method for the engine to call.
- **Constraint compliance:** Fails C-5 — a wrapper type is the parallel surface the substrate forbids; the engine would branch on provider-specific types.
- **Driver fit:** Fails drivers 1 and 2 (consumer becomes provider-aware; capability declarations no longer describe the write).
- **Pros:** No core contract change.
- **Cons:** Fragmented surface; every adapter invents its own shape; the closeout engine becomes provider-aware.
- **Why rejected:** Violates the delivered port boundary and capability-honesty rules.

### Alternative 3 — Open a v2 Contract or a New Operation Family with a Schema-Version Bump

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Introduce `DeliveryRequest.v2` (with a required head) and a new `closeout-*` operation family behind a schema version.
- **Constraint compliance:** Fails C-1 — not additive within v1; forces a migration and a required field that providers cannot always supply.
- **Driver fit:** Worst on drivers 3, 5, and 7 (surface growth, broken precedent, migration cost).
- **Pros:** Clean break if a future v2 is needed anyway.
- **Cons:** Migration, duplicated types, and a required field that forces fabrication on providers without a head signal.
- **Why rejected:** Additive v1 extension makes a version bump unnecessary; a v2 should be opened deliberately, not for two optional signals.

### Alternative 4 — Overload `write-delivery-request` for Thread Resolution

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Reuse the existing `write-delivery-request` operation with thread-resolution arguments instead of adding a new operation.
- **Constraint compliance:** Fails C-4 — declaring `write-delivery-request` supported to resolve threads would claim a delivery-request write capability the adapter does not have, and Jira/GitLab gaps would become ambiguous.
- **Driver fit:** Fails driver 2 (capability honesty) and driver 3 (one operation would carry two meanings).
- **Pros:** No closed-set change.
- **Cons:** A lying capability declaration; ambiguous gap reasons; the operation's arguments would become a union of unrelated writes.
- **Why rejected:** It is exactly the implied-parity failure the closed set and gap records exist to prevent.

## Decision

- **Recommendation (tied to drivers):** Adopt ALT-1. Extend the v1 adapter contract additively with two elements and no schema-version bump:
  1. **`DeliveryRequest.headSha`** — `readonly headSha?: string`, the provider-resolved head commit of the merged delivery request, copied verbatim. Absent means unknown, never a guessed, derived, or defaulted value. Consumers may compare it for exact equality with the local branch head only; when absent, branch cleanup refuses with `closeout.branch.unsafe` and retains the branch.
  2. **`resolve-delivery-thread`** — added to the closed `ADAPTER_OPERATIONS` set, meaning "resolve one review thread on a delivery request" with canonical arguments `{ deliveryRequest: <identity>, threadId: <id> }`. GitHub implements it through the existing injected transport (GraphQL `resolveReviewThread`); Jira declares `provider-unsupported`; GitLab declares `adapter-not-implemented`. Any adapter that does not implement it must record a gap with a valid reason; an operation absent from `supportedOperations` is unsupported, and parity is never implied.
  3. **No schema-version bump, no migration.** The contracts tier is types plus `as const` data; the optional field is producer-compatible, and the operation addition widens a closed compile-time union. Persisted state (`delivery.state.v1`) is unaffected.
- **Backward-compatibility rules:**
  - Existing producers that omit `headSha` remain valid; consumers see "unknown", never "empty".
  - Adding the operation intentionally fails exhaustive consumers at compile time (fail-loud); the conformance flow registry, capability declarations, and fixtures are updated in the same change, not later.
  - No consumer may treat absence as a value, and no consumer may infer adapter support from the operation's presence in the enum.
- **Authorization:** Status `Proposed`. Human acceptance is recorded at GH-183 PR review; AI does not accept this R2 record.
- **Decider:** Juliusz Ćwiąkalski.
- **Conditions for revisit:** See `revisit_triggers`; the first GH-183 closeout retrospective confirms the absence semantics and the narrow thread-resolution scope.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 through C-7. No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- Squash-safe deletion rests on provider truth rather than ancestry heuristics; an unknown head produces a safe, explainable refusal.
- Thread resolution enters the vocabulary as one honest operation, so GitHub can implement it while Jira and GitLab declare gaps without ambiguity.
- The additive-within-v1 precedent is extended consistently (third governed round), with no schema-version bump and no migration.
- Capability declarations remain the single source of truth: an unsupported operation can never be reported as applied or satisfied.

### Negative Outcomes

- The closed operation set grows by one, so every adapter must declare support or a gap, the conformance flow registry gains a step, and exhaustive operation sets in tests are updated.
- `headSha` remains absent on providers that cannot supply it, so branch cleanup is unavailable there by design.
- Removing the operation later is a v1-breaking change once adapters declare it; the optional field is cheaper to reverse than the operation.
- The compile-time ripple is deliberate but adds work in the same change (registry, fixtures, capability tables).

### Unresolved Questions

- [ ] Exact GitHub response shape for the merged head and the GraphQL thread-resolution mutation, proven by recorded fixtures (owner: `@coder`, GH-183 delivery).
- [ ] Whether the GitLab read slice populates merged-MR head identity without a write surface (owner: GH-183 delivery; absent stays truthful).
- [ ] Whether a later closeout needs batch, reply, or unresolve thread writes (owner: future named consumer; new purpose-shaped operation, never an overload).

## Implementation Plan

1. **Contracts:** add optional `headSha` to `DeliveryRequest` in `ports.ts`; add `"resolve-delivery-thread"` to `ADAPTER_OPERATIONS` in `adapter-capabilities.ts`. Keep the contracts tier types-plus-data only.
2. **Capability declarations:** GitHub adds `resolve-delivery-thread` to `supportedOperations` and keeps `write-comment` / `write-delivery-request` gaps; Jira declares `resolve-delivery-thread` as `provider-unsupported`; GitLab declares it as `adapter-not-implemented`. Preserve the existing gap set.
3. **Conformance:** add a closeout flow step for `resolve-delivery-thread` so the closed-operation/flow-registry invariant (`tests/structure/conformance-coverage.test.ts`) stays green; update mock/live operation sets and gap fixtures accordingly.
4. **Adapters:** GitHub normalizes the merged head verbatim and implements `resolveReviewThread` behind the existing injected transport; Jira/GitLab leave `headSha` absent where unsupported and declare gaps. No new transport or credential path.
5. **Tests:** paired head-present/head-absent fixtures (round-trip vs unknown + refusal); resolved/already-resolved thread fixtures; capability-parity tests proving no gap is reported as success.
6. **Docs:** the phase-7 system-spec update reconciles the `DeliveryRequest` row and the capability table in `feature-adapter-ports.md`.

## Verification Criteria

- Metric: contract-inventory/field-shape probes and `pnpm typecheck` green with optional `headSha` pinned — Target: 100% — Window: GH-183 CI.
- Metric: conformance flow-registry operation set equals `ADAPTER_OPERATIONS` including `resolve-delivery-thread` — Target: exact equality — Window: GH-183 CI.
- Metric: paired head fixtures — present round-trips verbatim; absent remains unknown and deletion refuses with `closeout.branch.unsafe` — Target: ≥1 case per provider that exposes the signal, plus an absent case — Window: GH-183 CI, offline.
- Metric: capability parity — every adapter's `supportedOperations` plus `declaredGaps` covers the closed set exactly and no unsupported operation is reported `applied`/`satisfied` — Target: 100% — Window: GH-183 CI.
- Metric: transport/credential boundary — no new secret-read entry and no new network location — Target: allowlist count unchanged; boundary tests green — Window: GH-183 CI.

## Confidence Rating

**High** for the additive shape and the absence semantics: the contract gaps are verified in the delivered source, the evolution rule is stated in the current spec, and two prior records establish the precedent. **Medium** for exact provider response shapes until recorded fixtures exist; those are `TO-CONFIRM` at implementation and degrade safely to declared gaps if unavailable.

## References

- GH-183 change spec (F-8, F-10, F-11, F-12, §8.3 DM-8, DEC-11/DEC-12, §14 OQ-1/OQ-2, RSK-4): `doc/changes/2026-11/2026-11-01--GH-183--closeout-v1-branch-cleanup/chg-GH-183-spec.md`
- Current system spec (adapter evolution discipline and port table): `doc/spec/features/feature-adapter-ports.md`
- Delivered contracts: `packages/core/src/contracts/ports.ts`, `packages/core/src/contracts/adapter-capabilities.ts`
- Conformance invariant: `tests/structure/conformance-coverage.test.ts`, `packages/testkit/src/conformance/flows.ts`
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — tier rules, contracts neutrality, no parallel adapter surface
- [ADR-0004](ADR-0004-workitem-activity-timestamp-additive-v1.md) — additive optional `WorkItem.updatedAt`, absent-means-unknown precedent
- [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md) — provider-client runtime confinement
- [ADR-0006](ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) — optional `WorkItem.comments`, absence representability precedent
