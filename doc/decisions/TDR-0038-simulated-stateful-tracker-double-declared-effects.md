---
id: TDR-0038
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "Add ONE simulated stateful tracker double to the testkit conformance package — a runtime-neutral pure in-memory state machine driven by declared tenant data, an optional declared initial state, and a closed declared-effect vocabulary applied by the matched route — so write-then-read flows are provable offline through the existing transport seam, with every undeclared request, effect, or target failing closed by method, URL, and effect."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider adapters and the @delivery-os/testkit conformance suite"
decision_scope: repo
review_date: null
business_impact: "M3 EC-4's `simulated tracker double for offline CI` becomes a shared, reusable contract that M3-S2 and M3-S3 are tested with, instead of a single-issue helper that proves stateful behavior for one adapter in one test file and is reusable by nobody."
customer_impact: "A change that writes to a tracker and reads the result back is proven before merge without a live tenant, so the first time an operator encounters a write-then-read defect is not a delivery run."
classification:
  domains: [architecture, tooling, reliability]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-339: @pm routed the simulated tracker double question during clarification)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-339 clarify_scope: the only stateful transport today is a test helper under `tests/`)"
    - "@decision-advisor (repository analysis and this record)"
    - "@spec-writer (carry the double's declared shape, effect vocabulary, and fail-closed rules into the GH-339 change spec)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-339 PR review — this record decides where stateful simulation lives)"
  performers:
    - "@coder (GH-339 delivery: the double, its decoder, tenant effects and initial state, and the replay tests)"
    - "@doc-syncer (adapter-conformance spec reconciliation: the simulated double, the effect vocabulary, and the unchanged stateless tier)"
  informed:
    - "M3-S2 Jira backlog adapter — the double is the vehicle for its write-then-read proof"
    - "M3-S3 GitLab code-host adapter — same"
    - "M3-S4 GitHub reference adapter — its write-then-read behavior defines what the double must support"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A flow needs a state transition the five declared effects cannot express (for example a write whose result depends on a prior write's value rather than a declared literal): add an effect by a recorded extension with its own fixture, never by teaching the double to interpret a URL pattern."
  - "A tenant needs a state that no declared initial state can express (a large collection, a cross-resource invariant): decide whether the initial state grows a declared shape or whether that scenario belongs to a live tier, rather than making the double compute it."
  - "Two adapters would need the same simulated system behavior with different addressing shapes: promote the shared declaration into one named double contract instead of copying tenant effects three times."
  - "The double's determinism is observed to depend on request order in a way a flow does not control: state the ordering requirement in the declaration rather than adding implicit sorting or a clock."
  - "A provider's write returns a body whose fields the double cannot derive from declared data (a server-computed timestamp or a derived URL): declare the value in the tenant or declare the field absent — never synthesize it from ambient time."
  - "Write-then-read coverage starts requiring concurrency or interleaved actors: that is beyond a deterministic in-memory double and must be decided as a separate simulation contract."
links:
  related_changes: ["GH-339"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-339--adapter-conformance-parity/chg-GH-339-pm-notes.yaml"
    - "doc/planning/oss-tooling/milestones/m3/README.md"
    - "doc/planning/oss-tooling/milestones/m3/contracts.md"
    - "doc/planning/oss-tooling/milestones/m3/open-questions.md"
    - "doc/spec/features/feature-adapter-conformance.md"
    - "doc/spec/features/feature-adapter-reference-behavior.md"
  contracts:
    - "packages/testkit/src/conformance/mock-tenant.ts"
    - "packages/testkit/src/conformance/types.ts"
    - "packages/testkit/src/conformance/runner.ts"
    - "packages/adapters/src/io/provider-transport.ts"
  diagrams: []
  decisions: ["ADR-0003", "ADR-0005", "TDR-0036", "TDR-0037"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S5", "M3-S2", "M3-S3"]
---

# TDR-0038: Simulated Stateful Tracker Double — A Runtime-Neutral In-Memory Tenant with Declared Effects

## Context

- **FACT:** Conformance tenants are stateless declarative data: a provenance marker, an instance, a credential reference, provider addressing, an ordered route table of method plus **exact** URL with an optional exact request body, and one expected projection per executed step (`packages/testkit/src/conformance/mock-tenant.ts`, `doc/spec/features/feature-adapter-conformance.md` §Mock tier, read 2026-11-18).
- **FACT:** The stateless replay transport records every request, matches method plus exact URL (preferring a body-specific route when a body is declared), and throws `unfixtured provider request {METHOD} {URL}` on anything else. It performs no state change: a replayed `POST` returns its declared body regardless of what was written before (`packages/testkit/src/conformance/mock-tenant.ts`, read 2026-11-18).
- **FACT:** The only stateful provider transport in the repository is a test helper under `tests/`: `createStatefulIssueTransport({ issueUrl, issue })` serves GET from a mutable current issue, applies a PATCH body's `state` and `labels` to that issue, and exposes `current()`. Its own header states the division: "The conformance mock tenant stays stateless and body-keyed; read-back and the current-read precondition are proven here instead" (`tests/behaviour/providers/support.ts`, read 2026-11-18).
- **FACT:** The runner reaches a transport only through an injected factory: `RunConformanceInput.transportFactory: (provider: string) => ConformanceTransport`, and each registration's `buildClient` receives the resulting transport together with the tenant instance and credential port. No flow, step, assertion family, or registration needs to know where a transport comes from (`packages/testkit/src/conformance/types.ts`, `runner.ts`, `adapters.ts`, read 2026-11-18).
- **FACT:** The mock tier installs a throwing-`fetch` guard and a child-process guard and asserts zero calls on each; both live under `tests/` (`tests/conformance/support/fixtures.ts` re-exporting `installThrowingFetchGuard` / `installChildProcessGuard` from `tests/behaviour/providers/support.ts`, read 2026-11-18).
- **FACT:** The testkit package imports no `node:*` or `bun:*` module and reads no ambient environment, clock, or randomness; filesystem fixture loading lives only under `tests/` (`doc/spec/features/feature-adapter-conformance.md` §Security and boundaries, read 2026-11-18).
- **FACT:** M3 OQ-M3-09 was answered requiring a simulated double and an offline CI run ("simulated double required; CI runs it offline" — answer `ok`), and the M3 contract says the parity suite "runs every primitive against every adapter (or its simulated double)" (`doc/planning/oss-tooling/milestones/m3/open-questions.md`, `contracts.md`, read 2026-11-18).
- **FACT:** The runner already compares a write's normalized outcome to an expected projection when the tenant declares one, so a stateful double's returned body is asserted the same way a stateless write body is (`packages/testkit/src/conformance/runner.ts`, read 2026-11-18).

## Problem Framing (Clarified)

Write-then-read cannot be proven with stateless replay, and the reason is semantic rather than mechanical: a stateless tenant answers each request from a fixed table, so a read after a write returns the *declared* pre-write body. A suite built on it therefore proves that an adapter issues the right requests and normalizes the right payloads — never that its write landed and its read observes the landing. The one stateful transport that exists proves exactly that, for exactly one GitHub issue, inside a test helper that no other adapter and no conformance flow can use.

The question is not "should state exist"; it is **where the state belongs and who declares its behavior**:

1. **In testkit, as declared data.** The double becomes part of the shared conformance contract: M3-S2 and M3-S3 are tested with it, a new adapter inherits it, and the determinism rules that make it trustworthy (no clock, no randomness, declared ids) are enforced by the package's own runtime-neutrality constraint.
2. **Under `tests/`, as a helper.** Cheaper today and unusable tomorrow: no contract, no reuse, no parity, and no constraint stopping a helper from reading the clock or the environment to make a test pass.
3. **Against a live tenant.** Ruled out by OQ-M3-09 and by the delivered zero-network guarantee of the mock tier.

Two design hazards decide the shape:

- **Implicit state transitions.** If the double infers "a PATCH to an issue URL updates the issue's `state` field", it has a hidden provider model that will silently diverge from the production client's semantics — and it will silently *succeed* on a write the real provider would reject. The behavior must be declared per route or it must not exist.
- **Scripted responses masquerading as state.** An ordered script of responses can replay "write, then read the post-write body", but the assertion then rests on the script's order rather than on causality: an adapter that never sent the write still passes. The double must derive the read from the state the write produced.

## Constraints (Hard Requirements)

### C-1: Runtime-neutral in testkit

- **Statement:** The double is a pure in-memory state machine in `packages/testkit/src/conformance/`: no `node:*` or `bun:*` import, no filesystem, no environment, no clock, no randomness, no network, no child process.
- **Source:** Adapter-conformance spec §Security and boundaries; `.ai/rules/typescript.md` testkit purity rules.
- **Verification:** Test — ambient-pattern source scan extended to the new module; no forbidden import; no `Date`/`Math.random` use.
- **Negotiable:** no.

### C-2: Existing transport seam only; no flow or registration change

- **Statement:** The double is reached through `RunConformanceInput.transportFactory` and consumed by the existing `buildClient` registrations. No flow, step id, assertion family, adapter registration shape, or runner branch changes.
- **Source:** Delivered runner and registration contract; GH-339 scope boundary ("no new closed adapter operation").
- **Verification:** Test — the flow registry, registration shape, and runner entry point are unchanged; a conformance run against the double executes the same step ids and assertion families as against the stateless tenant.
- **Negotiable:** no.

### C-3: Declared effects, closed vocabulary

- **Statement:** Every state change is declared in the tenant, per route, using a closed effect vocabulary. The double never infers an effect from a URL pattern, an HTTP method, or a payload shape.
- **Source:** The implicit-model hazard above; the delivered principle that provider-specific data enters as declared data.
- **Verification:** Test — a mutation control whose route carries no effect performs no state change, and a route whose effect is outside the vocabulary fails decoding by name.
- **Negotiable:** no.

### C-4: Fail closed on anything undeclared

- **Statement:** An undeclared request, an effect applied to a missing resource, and an effect whose declared operands do not exist all fail with an error naming the method, the URL, and (where applicable) the effect. There is never a silent no-op and never a fallback to a live call.
- **Source:** Delivered stateless-transport behavior (`unfixtured provider request`); OQ-M3-09 offline requirement; the "never silence" discipline.
- **Verification:** Test — one negative control per failure kind, asserting the message names method, URL, and effect.
- **Negotiable:** no.

### C-5: Determinism and replay equality

- **Statement:** The same declared tenant, the same declared initial state, and the same ordered request sequence produce identical state and identical normalized reads across runs, byte for byte after canonical key ordering.
- **Source:** Delivered determinism guarantee ("the same tenant data replayed twice produces identical reports, step order, skip reasons, and diagnostics").
- **Verification:** Test — replay a write-then-read flow twice and compare canonicalized state and both normalized reads for equality.
- **Negotiable:** no.

### C-6: Offline guards still prove zero live calls

- **Statement:** Both delivered guards remain installed and assert zero calls while the double is in use; a tenant that would require an undeclared effect fails rather than degrading to a network call.
- **Source:** Delivered guard suite; OQ-M3-09.
- **Verification:** Test — the guards fire on any live attempt during a double-backed run; a run with a missing effect fails instead of reaching the guard.
- **Negotiable:** no.

### C-7: The stateless tenant contract is unchanged

- **Statement:** Exact-URL stateless replay remains valid and unchanged for read-only flows: the same committed tenants, the same decoding, the same expected projections, the same failure message. The stateful double is additive.
- **Source:** GH-339 scope boundary; the delivered mock tier is the evidence base for the current suite.
- **Verification:** Test — every existing stateless tenant still decodes and replays identically; the stateless tests are green with no fixture edit beyond the additive effect block.
- **Negotiable:** no.

### C-8: No artifact, contract, or operation change

- **Statement:** `delivery.conformance.v1` keeps its field set and bounds; no core contract type is added; the closed operation set is unchanged; the double adds no serialized surface.
- **Source:** Artifact contract; additive-within-v1 discipline.
- **Verification:** Test — artifact schema and bounds tests unchanged; contract inventory unchanged.
- **Negotiable:** no.

## Decision Drivers

1. **Causal proof instead of ordered proof.** The suite should fail an adapter whose write did not land, not merely one whose second request differed from a script.
2. **Reuse across adapters and stories.** The double is the vehicle M3-S2/S3 will use; a helper that only GitHub tests can reach buys nothing.
3. **Determinism as a property, not a hope.** Identifiers, ordering, and time must all come from declared data so a failure is reproducible.
4. **Diagnosability.** A failure should name the request and the effect, so the author learns which declaration is missing rather than bisecting a response table.
5. **Honesty of the simulated tier.** The double must never make an invalid write look successful; a declared effect set is smaller than a provider model, which is the point.
6. **Minimal surface and reversibility.** One module, one additive optional route member, one constructor — removable without touching flows or registrations.

*(Overlap check: runtime-neutrality, seam preservation, declared-only effects, fail-closed behavior, determinism, offline guards, stateless compatibility, and artifact non-growth are gates (C-1…C-8) and appear here only as ranking values — "how much causal proof per unit of simulation". The gates decide eligibility; the drivers rank survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-339 clarify_scope routed this call here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (GH-339 scope; the finding that the delivered stateful transport is a test helper); `@decision-advisor` (analysis and record); `@spec-writer` (carry the declaration shape and the fail-closed rules into the change spec).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-339; the owner for final acceptance.
- **Performers:** `@coder` (the double, its decoder, tenant effects and initial state, replay and negative-control tests); `@doc-syncer` (conformance spec reconciliation).
- **Informed:** M3-S2, M3-S3, M3-S4; the owners of the existing stateful test helper, whose division of responsibility this record formalizes rather than deletes.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The delivered mock tenant is stateless and exact-URL; a write does not change what a later read returns. | FACT | `packages/testkit/src/conformance/mock-tenant.ts` (read 2026-11-18) | If it were stateful, no new double would be needed. | High |
| The only stateful transport is `createStatefulIssueTransport`, scoped to one issue URL, under `tests/`. | FACT | `tests/behaviour/providers/support.ts` (read 2026-11-18) | A reusable stateful transport would already exist and the decision would be about promotion only. | High |
| The runner reaches transports only through an injected factory, and registrations receive it as construction input. | FACT | `packages/testkit/src/conformance/types.ts`, `runner.ts`, `adapters.ts` (read 2026-11-18) | A new double would need a runner change, breaking C-2. | High |
| The mock tier already installs a throwing-`fetch` guard and a child-process guard asserting zero calls. | FACT | `tests/conformance/support/fixtures.ts`, `tests/behaviour/providers/support.ts` (read 2026-11-18) | C-6 would have to add guards, a larger change. | High |
| Testkit is runtime-neutral by contract and by test (no node/bun, no ambient env/clock/randomness). | FACT | `doc/spec/features/feature-adapter-conformance.md` §Security; `tests/conformance/support/testkit-source-scan.ts` (read 2026-11-18) | A stateful double outside that constraint would be untrustworthy and would have to live under `tests/`. | High |
| OQ-M3-09 requires a simulated double with an offline CI run. | FACT | `doc/planning/oss-tooling/milestones/m3/open-questions.md` (read 2026-11-18) | A network-gated tier would be admissible; it is not. | High |
| The runner compares a write's normalized outcome with a declared expected projection when one exists. | FACT | `packages/testkit/src/conformance/runner.ts` (read 2026-11-18) | The double's returned write body could not be asserted without new machinery. | High |
| Five effects (set a field, reset a field, replace a collection, append a collection entry, mark a sub-resource resolved) cover the delivered write operations' observable landing effects. | ASSUMPTION | Reading of the delivered write members (`writeWorkItem`, `transitionWorkItem`, `writeComment`, `writeDeliveryRequest`, `resolveDeliveryThread`, `mergeDeliveryRequest`) | An operation needing a sixth effect is a recorded extension with its own fixture (revisit trigger). | Medium-High |
| Declared sequences and declared ids are sufficient to produce stable identities for created resources. | ASSUMPTION | Determinism requirement; existing fixtures use declared identities | If an operation requires a server-derived identity, the tenant declares it; the double never generates one from ambient data. | Medium-High |
| The delivered flows can express write-then-read ordering without a new step id, because a step's client member may issue both a write and a read. | TO-CONFIRM (owner: `@coder` in GH-339) | Reading of `ConformanceAdapterClient` write members | If a step cannot sequence two provider calls, the sequencing belongs in the tenant's route table and declared effects rather than in a new flow step. | Medium |

## Mental Models & Techniques Used

- **First principles:** What must a test double do to prove a write landed? Maintain state that the write mutates and the read observes, derive the read from that state, and fail when the mutation is undeclared. Nothing else about a provider is required.
- **Inversion:** How does this fail? A double with a hidden provider model that accepts writes the provider rejects; a scripted response list that passes an adapter that skipped the write; a helper that reads the clock to mint an id; a silent no-op that turns a missing declaration into a green test; a second copy of the same helper per adapter. C-3, C-4, C-5, and the placement decision exclude each.
- **Second-order thinking:** Putting state in testkit rather than in one test file changes who can use it — every future adapter — and therefore changes what it must guarantee: determinism and a closed effect vocabulary become properties of a shared contract instead of local test habits.
- **Systems thinking:** The double sits exactly where the injected transport sits, so every layer above it (registration, runner, assertions, projections) is unchanged and the *only* new behavior is state. That keeps the blast radius at one module and one additive data member.
- **Opportunity cost:** Rebuilding per-adapter stateful helpers for Jira and GitLab would cost more than one declared double and would produce three divergent, unreviewable simulations.
- **KISS / boundedness:** Five effects, declared ids, no clock, no randomness, one constructor.
- **Reversibility:** The double is a module plus an optional route member; deleting it restores the delivered stateless tier exactly.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 runtime-neutral | C-2 seam only | C-3 declared effects | C-4 fail closed | C-5 determinism | C-6 guards | C-7 stateless intact | C-8 no contract growth |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 do nothing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 declared-effect stateful double in testkit (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 keep and extend the stateful helper under `tests/` | ❌ | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |
| ALT-3 network-gated live write-then-read tests | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| ALT-4 implicit write-back inferred from method and URL patterns | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ⚠️ | ✅ |
| ALT-5 ordered scripted-response transport | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception. ALT-2 and ALT-5 are the two realistic near-misses and are argued below.

### Alternative 0 — Do Nothing

- **Eligibility:** Eligible.
- **Summary:** Keep stateless replay for conformance and the single-issue helper for the GitHub-specific read-after-write cases.
- **Constraint compliance:** Passes every gate trivially, because it declares nothing new.
- **Driver fit:** Fails drivers 1 and 2: write-then-read is still unproven for any adapter except through one helper, and M3-S2/S3 inherit nothing.
- **Pros:** Zero new surface; no simulation contract to maintain.
- **Cons:** EC-4's simulated-double clause stays unmet; every new adapter reinvents statefulness; a write-then-read defect surfaces in a live run.
- **Why rejected:** It leaves the milestone clause and the story's own task unmet.

### Alternative 1 — ONE Declared-Effect Stateful Double in Testkit (chosen)

- **Eligibility:** Eligible.
- **Summary:** A pure in-memory state machine constructed from a tenant plus an optional declared initial state, whose matched route applies a declared effect from a closed vocabulary over declared resources, collections, and ids; reached through the existing transport factory; failing closed on anything undeclared.
- **Constraint compliance:** C-1 by construction in testkit under the existing scan; C-2 by constructor injection only; C-3 by an explicit per-route effect and a closed vocabulary; C-4 by named errors on undeclared request, undeclared effect, and missing resource; C-5 by declared ids/sequences and canonical state comparison; C-6 by leaving both guards installed; C-7 by keeping the stateless transport untouched; C-8 by adding no serialized surface.
- **Driver fit:** Best on all six: causal proof (1), reuse (2), determinism as a property (3), request-and-effect diagnostics (4), an honest bounded simulation (5), and one removable module (6).
- **Pros:** Write-then-read becomes provable offline for every adapter; the declaration is reviewable data; the simulation's limits are explicit (a write it cannot declare fails, rather than silently succeeding); M3-S2/S3 inherit a contract instead of a helper.
- **Cons:** A new module and a new declarative surface to maintain; the five-effect vocabulary will feel narrow the first time a provider-computed value is needed; the double is not a provider emulator and will refuse some scenarios the author expects to work.
- **Why chosen:** It is the only eligible option that proves causality offline while keeping every delivered layer unchanged.

### Alternative 2 — Keep and Extend the Stateful Helper Under `tests/`

- **Eligibility:** Not eligible as a shared solution (fails C-1; C-3, C-4, C-5 only via exceptions).
- **Summary:** Generalize `createStatefulIssueTransport` where it lives: add more routes, more applied fields, and reuse it from the conformance tests.
- **Constraint compliance:** Fails C-1 — `tests/` is outside the runtime-neutrality constraint, so nothing prevents the helper from reading the clock, the environment, or a fixture file to make a stateful case pass; C-3/C-4/C-5 would each need an accepted-risk exception because the helper applies hard-coded field semantics rather than declared effects.
- **Driver fit:** Good on 6 (smallest diff) and poor on 1, 2, and 3.
- **Pros:** No new testkit surface; the existing GitHub cases keep working unchanged.
- **Cons:** No contract, no reuse outside `tests/`, no parity; each adapter would grow its own variant of the same helper; determinism is a convention rather than a checked property.
- **Why rejected:** It is the status quo with more code in an unconstrained location.

### Alternative 3 — Network-Gated Live Write-Then-Read Tests

- **Eligibility:** Not eligible (fails C-1, C-5, C-6).
- **Summary:** Prove write-then-read against real scratch tenants in CI, skipping when credentials are absent.
- **Constraint compliance:** Fails OQ-M3-09's offline requirement, fails determinism (a live tenant mutates independently), and defeats the zero-network guarantee the mock tier exists to provide.
- **Driver fit:** Strong on 5 (no simulation at all) and weak on everything else: unreproducible failures, credential-dependent coverage, and a gate that silently skips.
- **Pros:** Tests real provider semantics, including quirks the double cannot model.
- **Cons:** Not deterministic, not offline, not a merge gate; the delivered live tier is read-only evidence precisely for this reason.
- **Why rejected:** It contradicts the answered question and the delivered tier separation.

### Alternative 4 — Implicit Write-Back Inferred from Method and URL Patterns

- **Eligibility:** Not eligible (fails C-3 and C-4).
- **Summary:** Teach the stateless replay transport that a `PATCH` to a resource URL updates the resource, that a `POST` to a collection appends, and so on, with no declaration.
- **Constraint compliance:** Fails C-3 — the behavior is inferred, so the double carries a hidden provider model that silently diverges from production semantics; fails C-4 — an unmatched pattern becomes a no-op rather than a failure, so a missing declaration reads as success.
- **Driver fit:** Strong on 6 (no declaration to write) and 2 (existing tenants become stateful), weak on 1 and 5.
- **Pros:** Zero new declaration; any tenant "just works".
- **Cons:** Creates exactly the class of silent-success defect the conformance suite exists to catch; makes every tenant's behavior depend on an undocumented pattern table.
- **Why rejected:** A double that guesses can pass a write the provider would reject, which is worse than no double.

### Alternative 5 — Ordered Scripted-Response Transport

- **Eligibility:** Not eligible (fails C-3, and fails the causal-proof premise).
- **Summary:** Extend the stateless tenant with an ordered list of responses so a test can script "write, then read the post-write body".
- **Constraint compliance:** Fails C-3 in substance: the second response is declared, not derived, so the read does not depend on the write. It is otherwise mechanically compatible with C-1, C-2, C-4, C-5, C-6, C-7, and C-8 — which is why it is tempting.
- **Driver fit:** Fails driver 1 outright: an adapter that never issued the write still reads the scripted post-write body and passes.
- **Pros:** Minimal machinery; no state model; deterministic by construction.
- **Cons:** Proves request order, not causality; a write-then-read flow can be green while the write is broken.
- **Why rejected:** It reproduces the limitation the double exists to remove.

## Decision

- **Decision:** Adopt ALT-1. Add ONE simulated stateful tracker double to `packages/testkit/src/conformance/`, driven entirely by declared data, reached through the existing transport seam.

### 1. Placement

The double lives in testkit, beside the stateless transport, not under `tests/`. Two reasons, both structural:

- **It is part of the shared conformance contract.** M3-S2 and M3-S3 are tested with it, and a future adapter inherits it; a helper under `tests/` is reachable by exactly one package's test files and carries no contract.
- **It must be runtime-neutral.** Living in testkit subjects it to the package's purity rules and to the source scan that enforces them, which is what makes determinism a checked property rather than a convention.

`tests/` keeps only fixture loading and the two offline guards. No simulation state, no clock, no environment read moves into testkit.

### 2. Inputs and declaration

- **Construction:** `createStatefulTenantTransport({ tenant, initialState? })` returns the same transport shape the runner already injects (`send` plus a recorded request log).
- **Tenant:** the existing decoded `MockTenant` remains the addressing, credential-reference, and route source. One additive optional member is added to a route — the declared effect — so a tenant can carry both stateless routes and effect-bearing routes in one document. Decoding validates the effect block as untrusted data and fails by route index and effect name.
- **Initial state:** an optional declared snapshot of the resources the double serves, expressed in the same declared shape as effects (resources with fields and collections). Absent means every route's effect starts from the declared baseline the tenant already implies; the double never invents a resource.

### 3. The closed effect vocabulary

Exactly five effects, applied by the matched route:

| Effect | Meaning |
|---|---|
| `set-field` | Set one named field on the addressed resource to a declared value. |
| `reset-field` | Restore one named field of the addressed resource to its declared baseline value. |
| `replace-collection` | Replace one named collection of the addressed resource with declared entries. |
| `append-entry` | Append one declared entry to a named collection, using the next declared identity from a declared sequence. |
| `mark-resolved` | Mark one named sub-resource of the addressed resource resolved. |

An effect's operands are declared in the tenant: the target resource, the field or collection, and the value or entry. A route with no declared effect performs no state change and returns its declared body — which is exactly the delivered stateless behavior, so a read-only tenant remains a stateless tenant. The vocabulary is closed and grows only by a recorded extension with its own fixture.

### 4. Identity and ordering

- Every identity the double returns is declared: resource identities come from the tenant, created-entry identities come from a declared sequence, and ordering is the declaration order.
- The double reads no clock, no randomness, and no environment. It never derives a timestamp, a URL, or an identity from anything but declared data; a field the tenant does not declare is absent, not synthesized.
- The same tenant, the same initial state, and the same ordered request sequence therefore produce identical state and identical normalized reads. Replay equality is asserted on canonicalized state (sorted keys) and on the normalized primitive views.

### 5. Fail-closed behavior

Three failures, all named, all error-returning, none silent:

1. **undeclared request** — method plus URL (plus declared body when one is required) matches no route: `unfixtured provider request {METHOD} {URL}`, the delivered message, preserved for compatibility.
2. **undeclared effect** — the matched route names an effect outside the closed vocabulary, or omits an operand: fails at decode time naming the route index and the effect, so a tenant cannot be half-declared at run time.
3. **effect on a missing resource** — the effect's target resource, field, collection, or sub-resource does not exist: the `send` call fails naming the method, the URL, and the effect.

A tenant that would need an undeclared effect therefore fails the run rather than performing a no-op or falling back to a live call; both offline guards stay installed and assert zero live calls throughout.

### 6. Wiring

Flows reach the double through `RunConformanceInput.transportFactory`; the registration's `buildClient` is unchanged. A stateful tenant is selected by the test (or by a composition helper under `tests/`) choosing the stateful factory for a provider, so one run can replay stateless tenants for read-only flows and a stateful tenant for a write-then-read flow without a second runner or a second registry.

### 7. Explicit non-decisions

- **The stateless exact-URL tenant contract stays valid and unchanged.** Read-only flows keep their committed tenants, their decoding, their expected projections, and their failure message; the effect block is additive and optional.
- **No flow, step, assertion family, registration, or runner branch changes.** The double adds state behind an existing seam, nothing else.
- **No provider is emulated.** The double models the declared effects of the routes a tenant carries; it does not model a provider's validation rules, permissions, or error semantics beyond the declared effects.
- **No artifact, contract, or operation change.** The artifact keeps its field set and bounds; no core contract type, no closed operation, no capability declaration changes.
- **The existing test helper is not deleted by this record.** `createStatefulIssueTransport` keeps serving the provider-seed behaviour suites; whether those suites migrate onto the double is a delivery choice, not a decision recorded here.

- **Rationale (tied to drivers):** The double proves causality rather than order (driver 1), it is reachable from every adapter and from M3-S2/S3 (driver 2), determinism is enforced by package constraints and asserted by replay equality (driver 3), failures name the request and the effect (driver 4), the simulation refuses rather than guesses (driver 5), and the whole surface is one module plus one optional data member (driver 6).
- **Decider:** Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review; this record stays `Proposed` until then.
- **Conditions for revisit:** See `revisit_triggers`, notably a needed sixth effect, a provider-computed value the declaration cannot express, and any request for concurrency in the simulated tier.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 through C-8. No accepted-risk exceptions are taken.

Four consequences are recorded rather than treated as exceptions:

- The double is deliberately narrower than a provider: a write whose landing depends on provider validation the tenant does not declare will fail rather than appear to succeed. That narrowness is the honesty property, not a gap to close by inference (C-3, C-4).
- Five effects will need a recorded extension eventually; the extension carries its own fixture, so the vocabulary cannot grow by accident (C-3).
- A tenant's stateless routes and effect-bearing routes coexist in one document; the stateless transport ignores the effect block, so existing fixtures and their projections remain byte-identical (C-7).
- The double duplicates a small amount of behavior already proven by the single-issue helper; consolidating those suites is deliberately out of scope (non-decision above).

## Trade-offs & Consequences

### Positive Outcomes

- Write-then-read becomes provable offline and deterministically for every adapter, through a seam that already exists.
- The simulated tier is a shared contract: M3-S2/S3 inherit it, and a new adapter participates by declaring effects in its own tenant.
- The double cannot make an invalid write look successful, because it only applies what the tenant declares.
- Replay equality makes a stateful failure reproducible — the same declared input and request order reproduce it exactly.
- The stateless tier is untouched, so the delivered evidence base keeps its meaning.

### Negative Outcomes

- A new declarative surface (effects, initial state, declared sequences) must be authored and reviewed per tenant; an under-declared tenant fails rather than silently working, which will feel like friction the first time.
- Five effects do not cover server-computed values, so some write-then-read scenarios will need the value declared or the field declared absent.
- The double is not a provider emulator; a suite that needs provider validation semantics needs a different instrument (a live tenant or a recorded capture).
- Two stateful transports now exist (the double and the delivered test helper), which is a temporary duplication the non-decision explicitly acknowledges.

### Unresolved Questions

- [ ] Whether the five-effect vocabulary covers every delivered write member's observable landing effect, or whether a sixth is needed for `merge-delivery-request`'s provider-supplied squash identity (owner: `@coder` in GH-339; if a sixth is needed it is a recorded extension, not an implicit one).
- [ ] Whether a write-then-read flow needs its own step id or can be expressed through an existing step's client member plus declared route ordering (owner: `@coder`; the default is no new step, because C-2 forbids it).
- [ ] Whether the existing single-issue helper should migrate onto the double (owner: GH-339 delivery; default is no, to keep the change additive).
- [ ] Whether any provider-scoped scenario needs a state the declared initial-state shape cannot express (owner: `@decision-advisor` on the first such request).

## Implementation Notes and Constraints

1. **Module.** One stateful-transport module beside the stateless one, exporting the constructor, the effect types, and the decoder for the additive route member; pure data plus pure functions.
2. **Decoding.** The effect block is validated as untrusted data with the same result-shaped failure discipline the tenant decoder already uses; a malformed effect fails by route index and effect name.
3. **State model.** Resources, fields, collections, sub-resources, and declared identity sequences; no clock, no randomness, canonical ordering for comparison.
4. **Tests.** Replay equality; write-then-read through a registration's client; one negative control per failure kind (undeclared request, undeclared effect, missing resource); both offline guards asserted during a double-backed run; the stateless suite unchanged.
5. **What must not change.** Flow registry, step ids, assertion families, registration shape, runner entry point, artifact module, and the committed stateless tenants' expected projections.

## Verification Criteria

- Metric: causal proof — a write-then-read flow observes the state the write produced, and an adapter that skips the write fails — Target: ≥1 flow per shipped adapter that supports the write — Window: GH-339 CI.
- Metric: determinism — the same tenant, initial state, and request order produce identical canonical state and identical normalized reads across two runs — Target: exact — Window: GH-339 CI.
- Metric: fail-closed behavior — each of the three failure kinds has a control whose message contains method, URL, and (where applicable) the effect — Target: 100% of kinds — Window: GH-339 CI.
- Metric: offline guarantee — zero live network calls and zero live child processes during any double-backed run — Target: zero — Window: GH-339 CI.
- Metric: stateless compatibility — every existing stateless tenant decodes and replays identically; the stateless suite's reports, step order, skip reasons, and diagnostics are unchanged — Target: exact — Window: GH-339 CI.
- Metric: runtime neutrality — the testkit source scan finds zero ambient time, randomness, or environment hits in the new module — Target: zero — Window: GH-339 CI.
- Metric: no contract or artifact growth — artifact schema and bounds unchanged; contract inventory unchanged; `ADAPTER_OPERATIONS` unchanged — Target: exact — Window: GH-339 CI.

## Confidence Rating

**High** for the placement and the seam: the stateless transport, the injected transport factory, the runtime-neutrality constraint with its scan, the guard suite, and the single-issue helper's own documented division of responsibility are all verified, and together they leave testkit as the only location that can hold a bounded, deterministic, reusable double. **Medium** for the five-effect vocabulary's sufficiency across every delivered write member: the effects are derived from the delivered write members' observable landings, not from a provider specification, so the first operation that needs a sixth effect will test this record — which is why the extension path and its fixture requirement are declared rather than left to delivery improvisation.

## References

- GH-339 change workspace (gap analysis: stateless replay, one stateful test helper): `doc/changes/2026-11/2026-11-18--GH-339--adapter-conformance-parity/chg-GH-339-pm-notes.yaml`
- M3 blueprint — EC-4, M3-S5 tasks, the "Offline CI for tracker tests" risk row: `doc/planning/oss-tooling/milestones/m3/README.md`
- M3 contracts — "runs every primitive against every adapter (or its simulated double)": `doc/planning/oss-tooling/milestones/m3/contracts.md`
- M3 open questions — OQ-M3-09 (simulated double required; offline CI): `doc/planning/oss-tooling/milestones/m3/open-questions.md`
- Delivered stateless tenant model and replay transport: `packages/testkit/src/conformance/mock-tenant.ts`, `packages/testkit/src/conformance/types.ts`
- Delivered runner injection point and write-projection comparison: `packages/testkit/src/conformance/runner.ts`
- Delivered stateful test helper and its documented division of responsibility: `tests/behaviour/providers/support.ts`
- Offline guards: `tests/conformance/support/fixtures.ts`
- Conformance contract — mock tier, guards, artifact, security boundaries: `doc/spec/features/feature-adapter-conformance.md`
- [TDR-0036](TDR-0036-cross-adapter-parity-matrix-declared-difference-register.md) — the parity matrix that a stateful tenant serves once a write-then-read dimension exists
- [TDR-0037](TDR-0037-tracker-error-taxonomy-delivered-identities.md) — the failure classes a stateful tenant can also be used to provoke
- [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md) — the runtime-API confinement whose spirit the testkit purity rule mirrors
