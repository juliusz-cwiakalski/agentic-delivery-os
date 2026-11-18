---
id: TDR-0039
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "Adapter extensibility becomes ONE declared registration-only participation contract — an `AdapterContract` from the closed operation set, one registration binding a client builder over the tenant, credential port, and injected transport, one parity-matrix column, one mock-tenant fixture set, and one trap catalog — proven twice: by a provider-name-free core invariant pinned to an exact allowlist written against a binding identity-construct definition (full-value provider-name or provider-contract literals and provider-discriminant comparisons; redaction labels and URL patterns are not constructs), with the parity matrix's adapter columns derived from the registration list so the matrix module carries no identity, and by a composition-injected synthetic control adapter that supplies only those five items and produces a green run with a complete matrix column while the shipped registry stays exactly the three shipped contracts."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider adapters and the @delivery-os/testkit conformance suite"
decision_scope: repo
review_date: null
business_impact: "M3-S2 and M3-S3 can be delivered against a bar that is proven rather than asserted: the plug-in contract is five items wide, a violation shows up as a failing gate rather than as an architectural discovery mid-delivery, and the shipped registry keeps its exact-three invariant so a control adapter can never masquerade as a shipped adapter."
customer_impact: "Adding a tracker does not change the lifecycle any delivery runs on, so an operator adopting a new tracker takes on an adapter, not a workflow."
classification:
  domains: [architecture, tooling]
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
  driver: "@decision-advisor (GH-339: @pm routed the new-adapter plug-in question during clarification)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-339 clarify_scope: extensibility is proven only by structure tests over the three shipped contracts)"
    - "@decision-advisor (repository analysis and this record)"
    - "@spec-writer (carry the five-item contract and the two proofs into the GH-339 change spec)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-339 PR review — this record fixes what `plugs in without lifecycle changes` means)"
  performers:
    - "@coder (GH-339 delivery: the participation contract statement, the provider-name scan with its allowlist, the synthetic control adapter, and its green-run test)"
    - "@doc-syncer (adapter-conformance spec reconciliation: the participation contract, the invariants, and the control-adapter boundary)"
  informed:
    - "M3-S2 Jira backlog adapter — authors its five items against this contract"
    - "M3-S3 GitLab code-host adapter — same"
    - "M3-S4 GitHub reference adapter — the reference column a new adapter's column is compared against"
    - "M3-S6 multi-tracker per project — its tracker composition work must not depend on a lifecycle change either"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A new adapter needs a sixth item (for example a new seam, a new injected dependency, or a new assertion family): that is a missing seam decision, not a delivery detail — decide the seam and its contract before accepting the adapter."
  - "The provider-name scan's allowlist has to grow for anything other than the delivered runner identity derivation: stop and decide whether the new occurrence is a legitimate tenant-data shape or the beginning of a per-adapter engine branch."
  - "The synthetic control adapter starts needing a real provider's response shape to pass: the control has drifted from a plug-in proof into a fourth adapter, and the proof must be rebuilt around a minimal declared contract."
  - "A shipped adapter needs a lifecycle, port, or flow-registry edit for an ordinary adapter concern (a capability, a fixture, or an assertion): the participation contract is incomplete; widen the contract by decision, never by precedent."
  - "The control adapter cannot run in the same suite as the shipped registry because of a shared fixture or credential collision: give the control its own tenant namespace rather than weakening the shipped-registry invariant."
  - "A second port family (harness, CI) asks for the same participation shape: promote the five-item contract into that family's own decision rather than generalizing the provider contract into a universal adapter protocol."
links:
  related_changes: ["GH-339"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-339--adapter-conformance-parity/chg-GH-339-pm-notes.yaml"
    - "doc/planning/oss-tooling/milestones/m3/README.md"
    - "doc/planning/oss-tooling/milestones/m3/contracts.md"
    - "doc/spec/features/feature-adapter-conformance.md"
    - "doc/spec/features/feature-adapter-ports.md"
  contracts:
    - "packages/core/src/contracts/adapter-capabilities.ts"
    - "packages/testkit/src/conformance/adapters.ts"
    - "packages/testkit/src/conformance/runner.ts"
    - "packages/testkit/src/conformance/coverage.ts"
    - "packages/testkit/src/conformance/types.ts"
  diagrams: []
  decisions: ["ADR-0003", "ADR-0005", "TDR-0008", "TDR-0036", "TDR-0037", "TDR-0038"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S5", "M3-S2", "M3-S3", "M3-S6"]
---

# TDR-0039: Registration-Only Adapter Extensibility — Five Supplied Items, a Provider-Name-Free Core, and a Synthetic Registration Proof

## Context

- **FACT:** M3-S5's acceptance criterion is "the suite fails on undeclared behavior differences; **new adapters plug in without changing the lifecycle**" (`doc/planning/oss-tooling/milestones/m3/README.md`, read 2026-11-18).
- **FACT:** The shipped conformance registry is pinned to exactly the three shipped provider contracts. A structure test enforces the count, forbids an unexpected non-provider registration, requires the contract's `adapterName` to equal the registration's provider, and requires a client builder (`tests/structure/conformance-coverage.test.ts` `adapterRegistryViolations`, read 2026-11-18).
- **FACT:** A declaration-only scan over `packages/adapters/src` finds exported `*_ADAPTER_CONTRACT` bindings and fails when a provider contract has no registration or a registration names no declared contract; an `index.ts` re-export is deliberately not an occurrence (`tests/structure/conformance-coverage.test.ts` `scanContractDeclarations` / `registrationViolations`, read 2026-11-18).
- **FACT:** The runner takes `adapters` as an explicit input and calls it "the sole participant list": "production callers pass the shipped registry, while controls inject test-only registrations" (`packages/testkit/src/conformance/runner.ts`, read 2026-11-18).
- **FACT:** The delivered broken-adapter control already exercises that seam: it wraps the production GitHub client, corrupts one normalized view, and must fail with provider, flow, step, operation, and assertion named, while "it never enters the production registry" (`tests/conformance/broken-adapter-control.test.ts`, read 2026-11-18).
- **FACT:** The coverage gates are registry-agnostic: `structuralCoverageViolations({ flows, adapters })` and `runtimeCoverageViolations(report, adapters, tier)` accept whatever registration list they are given and validate it against the shared flow registry (`packages/testkit/src/conformance/coverage.ts`, read 2026-11-18).
- **FACT:** The harness conformance registry is the delivered precedent for the same shape in another port family: a sole participant list, per-registration capability declaration and builder, and a coverage meta-check that fails a missing scenario, a duplicate registration, an unregistered closed-vocabulary kind, and a registered kind absent from the vocabulary (`packages/testkit/src/conformance/harness.ts`, spec §Harness conformance registry, read 2026-11-18).
- **FACT:** Four engine modules are already provider-name-free under the identity-construct definition in §2: `flows.ts`, `coverage.ts`, `artifact.ts`, and `harness.ts` contain no adapter identity construct (searched 2026-11-18). `artifact.ts` does carry the redaction table's `"github token"`/`"gitlab token"` labels (`packages/testkit/src/conformance/artifact.ts:84-85`) and provider-host URL patterns (`artifact.ts:91,114`); under that definition they are content-family patterns to redact, not identity constructs, because neither is a full-value provider name and no provider discriminant is compared.
- **FACT:** One engine module is not: `runner.ts` derives expected entity identity from `tenant.addressing` with five provider comparisons (`"github"`, `"jira"`, `"gitlab"`), and `mock-tenant.ts` decodes provider-tagged addressing; `types.ts` declares the provider-tagged addressing types and derives the read-failure union from three provider clients (read 2026-11-18).
- **FACT:** The delivered suite forbids comparing against a moving base ref: a structure test asserts that `coverage.ts` and `runner.ts` contain no `origin/main-tools` reference, described as "the gates do not compare against a moving base ref" (`tests/structure/conformance-coverage.test.ts`, read 2026-11-18).
- **FACT:** `ADAPTER_OPERATIONS` is a closed nine-member set and `AdapterContract` is the delivered provider contract type; the capability declaration is `supportedOperations` plus `declaredGaps` plus the two carrier arrays (`packages/core/src/contracts/adapter-capabilities.ts`, read 2026-11-18).

## Problem Framing (Clarified)

"New adapters plug in without lifecycle changes" is currently a claim about three adapters that already exist, supported by structure tests that assert the registry matches the contracts. That is a *consistency* proof, not an *extensibility* proof: it cannot distinguish an architecture that admits a fourth adapter from one that happens to describe three.

Two proof strategies are available and they answer different questions:

1. **A negative invariant.** No lifecycle, port, flow-registry, or runner module learns anything adapter-specific. This is checkable by scanning those modules for adapter identity, but only if the scan's exceptions are enumerated honestly — the delivered runner does carry provider comparisons, and a scan that pretends otherwise is a false claim.
2. **A constructive proof.** Register a conformance-only adapter through the injected list, supply nothing but the declared participation items, and run the whole gate battery green. If a fourth adapter would need a lifecycle edit, this run cannot be green without one — so a green run *is* the proof.

Neither alone is sufficient. The scan can be satisfied by an allowlist that quietly grows; the constructive proof can be satisfied by an adapter that is not representative. Together, with the allowlist pinned to exactly what exists today and the control adapter forbidden from entering the shipped registry, they answer the criterion.

The design hazard is the "fourth shipped adapter" shortcut: adding a fake provider to `CONFORMANCE_ADAPTERS` to prove pluggability would delete the exact-three invariant that three stories depend on, make every shipped-registry assertion weaker, and put a non-provider into a list consumers read as truth. The proof must be composition-injected instead.

The second hazard is scope creep in the other direction: if the participation contract is described as "whatever the adapter needs", it proves nothing. It must be an enumerated, closed list — and a new adapter needing a sixth item must be a decision, not a delivery improvisation.

## Constraints (Hard Requirements)

### C-1: The shipped registry stays exactly the three shipped contracts

- **Statement:** `CONFORMANCE_ADAPTERS` registers exactly GitHub, GitLab, and Jira. No fourth entry, no test-only entry, no conditional entry; the existing structure test that rejects a non-shipped registration in the shipped list stays enforced and unedited in substance.
- **Source:** Delivered registry invariant and its structure tests; spec §Adapter registry.
- **Verification:** Test — registry length, provider set, contract binding, and builder presence unchanged; a mutation control adding an `azure` registration still fails.
- **Negotiable:** no.

### C-2: A new adapter adds no lifecycle, port, flow-registry, or runner branch

- **Statement:** The participation contract is exactly five items. A new adapter adds no lifecycle phase, no lifecycle hook, no port, no operation, no flow, no step id, no assertion family, no coverage-gate branch, no runner branch, and no artifact field.
- **Source:** M3-S5 AC; GH-339 scope boundary ("no new closed adapter operation", "no lifecycle changes").
- **Verification:** Test — a green run of a control adapter supplying only the five items, with the lifecycle, port, flow, coverage, runner, and artifact modules unmodified; review of the change's touched files.
- **Negotiable:** no.

### C-3: The provider-name-free invariant is stated over a named module set with an exact allowlist

- **Statement:** The modules named as the extensibility surface contain no **adapter identity construct** as defined in §2 — a full-value provider name or provider-contract string literal, or a provider-discriminant comparison or branch — and the delivered occurrences elsewhere are enumerated exactly (file plus construct), each labelled as a legitimate home or as the one pinned engine exception. The scan fails on any new occurrence outside the allowlist, and the allowlist is written against the §2 definition one (file, construct) pair at a time. The parity matrix is inside the bound set and satisfies the invariant by **deriving** its adapter columns from the conformance registration list, never by authoring provider-name keys.
- **Source:** The honest-invariant requirement (a scan that hides delivered code is worse than no scan); delivered module contents; the delivered registration list as the sole participant source.
- **Verification:** Test — provider-identity-literal scan over the bound module set and over the allowlist using the §2 definition, with a mutation control adding a literal and failing by file and construct; a second control hand-authors a provider-name column key inside the parity module and must fail the same scan.
- **Negotiable:** no.

### C-4: The proof is constructive and green, not a documented procedure

- **Statement:** Extensibility is demonstrated by an executed, green conformance run of a control adapter through the injected adapter list, producing a complete parity-matrix column, not by a checklist or a review convention.
- **Source:** M3-S5 AC; the delivered principle that a gate must fail rather than a document warn.
- **Verification:** Test — the control run's report is `passed`, its matrix column is complete over the nine operations, and no lifecycle/port/flow/runner module was edited in the change that added it.
- **Negotiable:** no.

### C-5: No contract, port, or lifecycle growth

- **Statement:** No core contract type is added or retyped; `ADAPTER_OPERATIONS` is unchanged; no new lifecycle phase or adapter lifecycle hook is introduced; no new configuration key enters the production catalog.
- **Source:** Additive-within-v1 discipline; GH-339 scope boundary.
- **Verification:** Test — contract inventory unchanged; operation set unchanged; catalog unchanged; review of the change diff.
- **Negotiable:** no.

### C-6: The five-item contract is closed

- **Statement:** The participation contract enumerates exactly five supplied items. A new adapter that appears to need a sixth item is a signal that a seam is missing, and the response is a decision — never an informal widening of the list.
- **Source:** This record's purpose (a bounded, checkable bar); the M3 blueprint's additive-not-forked principle.
- **Verification:** Review of the contract statement against the control adapter's actual inputs; the scan and control-run tests catch the mechanical part.
- **Negotiable:** no.

### C-7: CI topology and runtime neutrality unchanged

- **Statement:** No workflow job is added; the plug-in proof runs inside `pnpm test`. The scan and any supporting data live in testkit when pure and under `tests/` when they touch the filesystem, in line with the delivered boundary.
- **Source:** Adapter-conformance spec §Quality assurance and §Security; the delivered workflow pin.
- **Verification:** Test — workflow contract test green with no workflow edit; the filesystem-reading scan lives under `tests/`.
- **Negotiable:** no.

## Decision Drivers

1. **Fidelity to the acceptance criterion.** "Plug in without lifecycle changes" must be refutable; a proof that cannot fail is not a proof.
2. **Blast radius of the proof itself.** Proving extensibility must not weaken the shipped registry that three stories and every consumer read as truth.
3. **Diagnosability.** When the invariant breaks, the failure should name the file and the construct, so the author learns which seam grew.
4. **Ceremony proportional to value.** The proof should reuse the injected adapter list and the coverage gates that already exist, not invent a plugin framework.
5. **Honesty over elegance.** A partially true invariant with an exact allowlist beats a clean claim that the code contradicts.
6. **Reversibility.** The proof must be removable without touching the shipped suite.

*(Overlap check: the shipped-registry invariant, the no-branch rule, the honest allowlist, the constructive green run, no contract growth, the closed list, and topology neutrality are gates (C-1…C-7) and appear here only as ranking values — "how much refutable extensibility per unit of new machinery". The gates decide eligibility; the drivers rank survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-339 clarify_scope routed this call here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (GH-339 scope; the finding that extensibility is proven only over the three shipped contracts); `@decision-advisor` (analysis and record); `@spec-writer` (carry the contract and the two proofs into the change spec).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-339; the owner for final acceptance.
- **Performers:** `@coder` (contract statement, scan with allowlist, control adapter, green-run test); `@doc-syncer` (conformance spec reconciliation).
- **Informed:** M3-S2, M3-S3, M3-S4, M3-S6 — all of whom depend on "an adapter, not a lifecycle".

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The shipped registry is pinned to exactly three providers, and a structure test rejects an unexpected non-provider registration. | FACT | `tests/structure/conformance-coverage.test.ts`, `packages/testkit/src/conformance/adapters.ts` (read 2026-11-18) | If it were open, a fourth registered adapter would be the cheapest proof. | High |
| The runner's adapter list is an explicit input described as the sole participant list, with controls injecting test-only registrations. | FACT | `packages/testkit/src/conformance/runner.ts` (read 2026-11-18) | The constructive proof would need a runner change, breaking C-2. | High |
| A control registration that never enters the production registry is already delivered practice. | FACT | `tests/conformance/broken-adapter-control.test.ts` (read 2026-11-18) | The synthetic proof would be unprecedented and would need its own justification. | High |
| The coverage gates accept an arbitrary registration list and validate it against the shared flow registry. | FACT | `packages/testkit/src/conformance/coverage.ts` (read 2026-11-18) | A control adapter's completeness could not be checked without new gate code. | High |
| `flows.ts`, `coverage.ts`, `artifact.ts`, and `harness.ts` contain no adapter identity construct. | FACT | Module search (read 2026-11-18) | A wider allowlist would be needed and the invariant would be weaker. | High |
| `runner.ts` derives expected entity identity from tenant addressing with five provider comparisons, and `mock-tenant.ts` plus `types.ts` carry provider-tagged addressing. | FACT | Module search (read 2026-11-18) | If the runner were provider-free, the allowlist would be empty and C-3 simpler. | High |
| The suite forbids comparing against a moving base ref, by an explicit structure assertion. | FACT | `tests/structure/conformance-coverage.test.ts` (read 2026-11-18) | A diff-based proof of "no lifecycle file changed" would be admissible; it is not. | High |
| The harness registry's coverage meta-check is a delivered precedent for a sole-participant-list invariant in another port family. | FACT | `packages/testkit/src/conformance/harness.ts`, spec §Harness conformance registry (read 2026-11-18) | The pattern would have to be invented rather than copied. | High |
| A minimal control adapter can satisfy all nine operations' parity cells with declared data only (no real provider responses). | ASSUMPTION | The registry and matrix are data-driven; cell values are declared | If a cell required observed behavior, the control would need a real response model — the revisit trigger covers the drift. | Medium-High |
| The delivered provider-tagged addressing in `mock-tenant.ts`/`types.ts` is legitimate tenant-data shape rather than adapter-identity branching in an engine. | ASSUMPTION (labelled as such, not asserted as fact) | Reading of `decodeAddressing` and the addressing types | If a reviewer judges it as engine branching, the allowlist grows by three entries and the invariant's claim weakens accordingly — it does not change the decision. | Medium |

## Mental Models & Techniques Used

- **First principles:** What is "a new adapter plugs in" *made of*? A contract, a registration, a declared behavior set, a fixture set, and a trap catalog. If the list is complete, the lifecycle cannot be involved; if the list is incomplete, the gap shows up as a needed sixth item.
- **Inversion:** How does the proof fail dishonestly? A fake fourth shipped adapter (weakens the registry), a scan with a growing allowlist (claim decays silently), a checklist (no gate), a diff-based assertion against a base ref (forbidden by a delivered invariant), and a control adapter that is really a fourth provider (proves nothing about minimality).
- **Second-order thinking:** Two independent proofs make each one's weakness visible. The scan catches "the engine learned an adapter"; the control run catches "the adapter needed the engine". Neither can be satisfied by editing the other.
- **Systems thinking:** The five items map exactly onto the delivered seams: the contract is core's, the registration is testkit's participant list, the column is the matrix (TDR-0036), the tenants are the declaration surface (TDR-0038), and the trap catalog is the failure proof (TDR-0037). The contract is therefore a *derived* statement about existing seams, not a new abstraction over them.
- **Opportunity cost:** A plugin framework — descriptor types, a loader, a lifecycle hook set — would cost weeks and buy the same five items with more indirection.
- **Reversibility:** The scan, the allowlist, and the control adapter are removable in one change; the shipped registry is untouched either way.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 shipped registry | C-2 no new branch | C-3 honest allowlist | C-4 constructive proof | C-5 no growth | C-6 closed list | C-7 topology |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 do nothing | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| ALT-1 five-item contract + two proofs (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 add a fourth fake shipped registration | ❌ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| ALT-3 documented checklist, review-enforced | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| ALT-4 extract a core "adapter plugin descriptor" contract | ✅ | ⚠️ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-5 assert the change diff touches no lifecycle file | ✅ | ✅ | ❌ | ⚠️ | ✅ | ✅ | ❌ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception. ALT-4 is the only eligible-with-exception option and is argued below.

### Alternative 0 — Do Nothing

- **Eligibility:** Not eligible (fails C-3, C-4, C-6).
- **Summary:** Keep the existing structure tests over the three shipped contracts and treat extensibility as an architectural claim in the spec.
- **Constraint compliance:** Satisfies the no-growth gates trivially; fails the proof gates — nothing states what a new adapter must supply, and nothing demonstrates that supplying it is sufficient.
- **Driver fit:** Fails 1 and 3.
- **Pros:** Zero new surface.
- **Cons:** The AC's second clause remains untested; M3-S2/S3 discover the real contract by trial.
- **Why rejected:** It is the status quo the story exists to replace.

### Alternative 1 — Five Supplied Items, Two Independent Proofs (chosen)

- **Eligibility:** Eligible.
- **Summary:** Declare the participation contract as exactly five items; prove it with (1) a provider-name-free invariant over a named module set with an exact, honest allowlist, and (2) a composition-injected control adapter that supplies only those five items and runs green with a complete matrix column.
- **Constraint compliance:** C-1 by leaving the shipped registry and its tests alone; C-2 by proving the run needs no engine edit; C-3 by enumerating the delivered occurrences and failing on new ones; C-4 by executing the run inside `pnpm test`; C-5 by adding no core type, operation, phase, or hook; C-6 by declaring the list closed; C-7 by riding the existing job.
- **Driver fit:** Best on all six: refutable (1), registry untouched (2), file-and-construct diagnostics (3), reuses the injected list and coverage gates (4), states the delivered exception rather than hiding it (5), removable (6).
- **Pros:** The AC becomes two mechanical checks; a new adapter's obligations are five readable items; the delivered runner exception is documented instead of silently tolerated; M3-S2/S3 inherit a bar they can author against.
- **Cons:** Two proofs to maintain; the allowlist is a permanent, if small, maintenance point; the control adapter is a test fixture that must stay minimal to remain meaningful.
- **Why chosen:** It is the only eligible option that makes the criterion refutable without weakening the shipped registry.

### Alternative 2 — Add a Fourth Fake Shipped Registration

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Register a synthetic provider in `CONFORMANCE_ADAPTERS` and show that the suite passes with four entries.
- **Constraint compliance:** Fails C-1 outright: the exact-three invariant and its mutation controls would have to be rewritten, every consumer of the registry would see a non-existent provider, and the "control is never in the production registry" discipline would be inverted. C-6 also weakens, because a shipped registration is not required to be minimal.
- **Driver fit:** Strong on 4 (least new machinery) and weak on 2 (largest possible blast radius on the registry that three stories depend on).
- **Pros:** No separate injection path; the proof runs through the production path verbatim.
- **Cons:** The registry stops being truth; structure tests lose their meaning; a future reader cannot tell a control from an adapter.
- **Why rejected:** It buys a proof by destroying the invariant the proof is supposed to protect.

### Alternative 3 — Documented Checklist, Review-Enforced

- **Eligibility:** Not eligible (fails C-3, C-4).
- **Summary:** Write the five items in the spec page and rely on review to confirm a new adapter supplied them.
- **Constraint compliance:** Passes C-1, C-2, C-5, C-6, C-7; fails the mechanical proof entirely — nothing fails when an adapter needs a sixth item, and no run demonstrates sufficiency.
- **Driver fit:** Good on 4 (no machinery), failing 1 and 3.
- **Pros:** Cheapest to write; readable.
- **Cons:** Unfalsifiable; the criterion stays an assertion.
- **Why rejected:** A checklist is a convention, not a proof.

### Alternative 4 — Extract a Core "Adapter Plugin Descriptor" Contract

- **Eligibility:** Eligible-with-accepted-risk-exception (C-2).
- **Summary:** Add a core contract type describing a pluggable adapter (identity, contract, builder descriptor, fixture descriptors) and have the registry consume descriptors.
- **Constraint compliance:** Takes an exception on C-2 in substance: the descriptor is a new port-shaped abstraction that the runner and registry must consume, so a new adapter participates through a new core surface rather than through the five delivered seams. Fails C-5 if the descriptor becomes a core contract type, which the alternative implies.
- **Driver fit:** Strong on 1 (a declared, typed contract) and weak on 4 and 6: a new abstraction over seams that already exist, plus a migration of three registrations.
- **Pros:** The participation contract would be typed and enforced by the compiler.
- **Cons:** New core surface for a test-only concern; a migration of the shipped registry; the descriptor would encode fixture and matrix concepts into `core`, which is runtime-neutral and consumer-facing.
- **Why rejected:** It moves test-harness shape into the production contract layer to describe seams that are already sufficient.

### Alternative 5 — Assert the Change Diff Touches No Lifecycle File

- **Eligibility:** Not eligible (fails C-7 and conflicts with a delivered invariant).
- **Summary:** Have CI diff the branch against the base and fail when a lifecycle, port, or flow-registry file changed alongside an adapter addition.
- **Constraint compliance:** Fails C-7 — it requires either a new job or a base-ref comparison inside `pnpm test`; and the delivered suite explicitly forbids comparing against a moving base ref (`origin/main-tools`), so the assertion would contradict a rule the gate battery already enforces.
- **Driver fit:** Strong on 4 (no new data) and weak on 1 and 3: it proves what a diff touched, not what an adapter needed.
- **Pros:** Catches the exact failure mode ("someone edited the runner") directly.
- **Cons:** Depends on VCS state, is unstable across rebases and squash merges, and is forbidden by the delivered no-moving-base-ref rule.
- **Why rejected:** It is the proof shape the delivered suite deliberately excluded.

## Decision

- **Decision:** Adopt ALT-1. Adapter extensibility is one declared registration-only participation contract, proven by a provider-name-free core invariant with an exact allowlist and by a composition-injected synthetic control adapter.

### 1. The participation contract (exactly five items)

A new adapter supplies:

| # | Item | Where it lives |
|---|---|---|
| (a) | An `AdapterContract` drawn from the closed operation set, with an honest capability declaration (supported operations, declared gaps with reasons, declared carriers). | The adapter package; the registration imports it. |
| (b) | One registration binding a client builder over the decoded tenant, the credential port, and the injected transport. | The conformance registry. |
| (c) | One parity-matrix column (TDR-0036) with a declared cell per closed operation. | The matrix declaration. |
| (d) | One mock-tenant fixture set, using the stateless or stateful declaration as the flow requires. | The conformance fixture tree. |
| (e) | One trap catalog covering the tracker-error families (TDR-0037). | The conformance fixture tree. |

Nothing else. No lifecycle phase, no adapter lifecycle hook, no port, no operation, no flow, no step id, no assertion family, no coverage-gate branch, no runner branch, no artifact field.

### 2. Proof one — the provider-name-free core invariant

**Identity construct (binding definition).** An *adapter identity construct* in a scanned module is either:

- **(i) a full-value provider name or provider-contract string literal** — a string literal whose entire value is a provider name (`github`, `gitlab`, `jira`) or the name of a provider contract binding (`GITHUB_ADAPTER_CONTRACT`, `GITLAB_ADAPTER_CONTRACT`, `JIRA_ADAPTER_CONTRACT`), wherever it appears: as an argument, a record key, a `Map` key, a template payload, or a comparison operand; or
- **(ii) a provider-discriminant comparison or branch** — a comparison of a provider discriminant (`provider`, `addressing.provider`, `tenant.provider`, or an equivalent field) against a provider name, in an `if`, `switch`, conditional expression, logical conjunction, or lookup that selects behavior.

A provider literal appearing *inside a comparison still matches the definition*: `detail.includes("jira")` is construct (i) as a literal and construct (ii) as a comparison, so the definition cannot be evaded by embedding a name in a larger expression. **Explicitly not identity constructs:** the redaction labels and URL patterns inside the artifact module's redaction table (`{ detail: "github token", pattern: /\bghp_…/ }` and `{ detail: "gitlab token", … }` at `artifact.ts:84-85`; the avatar-host pattern at `artifact.ts:91,114`). They name a *content family to redact*, not an adapter to dispatch: redacting a GitHub-shaped token from a diagnostic is a property of the bytes, it answers no question about which adapter produced them, and no provider discriminant is compared. This definition is what the exact allowlist is written against — one allowlist entry per (file, construct) pair — so the taxonomy scan (TDR-0037 C-7), the bound-set scan, and the permit list all agree by construction rather than by interpretation.

**Bound set (must contain zero adapter identity constructs):** the flow registry (`flows.ts`), the coverage gates (`coverage.ts`), the artifact module (`artifact.ts`), the harness registry (`harness.ts`), the parity engine (TDR-0036), the tracker-error taxonomy table (TDR-0037), and the stateful double (TDR-0038).

**Delivered state:** all four existing modules are already free of adapter identity under this definition. The new modules must be authored that way; the taxonomy and the double are provider-name-free by design (families and effects, not providers), and the parity engine contains no provider name at all — its columns are **derived** from the registration list it is given (TDR-0036 §1), so it neither authors nor branches on a provider.

**Permitted homes of adapter identity (enumerated, not implied):**

- the registration list (`adapters.ts`) — its purpose;
- the parity matrix's adapter columns — permitted only as **values derived from the registration list**: the matrix module builds its column set by mapping `CONFORMANCE_ADAPTERS` and associates each adapter's cells and register entries with a column by that derivation, so it authors no provider-name key. A hand-authored provider-name key, lookup operand, or comparison inside the parity module is an identity construct and fails the scan;
- tenant and trap fixtures under `tests/fixtures/`;
- provider-tagged addressing types and the derived read-failure union in `types.ts` — declared tenant/type shape;
- provider-tagged addressing decoding in `mock-tenant.ts` — declared fixture-data shape;
- **one engine exception, pinned:** `runner.ts` derives an expected entity identity from `tenant.addressing` (five provider comparisons). It is recorded here as the delivered exception, not as an approved pattern.

**Enforcement:** a structure test scans the bound set and the allowlisted modules for adapter identity constructs as defined above and fails by file and construct when a new occurrence appears outside the allowlist. The allowlist is exact (file plus construct), so it cannot absorb a new branch quietly; growing it for anything other than the pinned runner derivation is a revisit trigger.

**The runner exception, as delivered and disclosed.** The runner is not provider-free: it derives an expected entity identity from `tenant.addressing` with exactly five provider comparisons, and that derivation is the record's **one pinned, exact allowlist exception** — enumerated in the permitted homes above, disclosed rather than concealed, and covered by the allowlist's (file, construct) entries so the scan fails on any sixth occurrence. No reconciliation is outstanding: the change specification's registration-only section carries the same pinned exception (F-4, AC-F4-4, DM-6). The only open question about it is the separate one below — whether the expectation should eventually move into declared tenant data, which would be a runner change and a decision of its own, not a correction to this record.

### 3. Proof two — the synthetic registration proof

- **Instrument:** a conformance-only control adapter, defined under `tests/`, supplying only items (a)–(e). Its contract is drawn from the closed operation set; its builder is bound over the tenant, the credential port, and the injected transport; its column is supplied as declared data by the test; its tenant and trap fixtures are committed under the control's own fixture namespace.
- **Injection:** through `RunConformanceInput.adapters` — the delivered sole-participant seam — exactly as the broken-adapter control already does. It never enters `CONFORMANCE_ADAPTERS`.
- **Assertions:** the run is `passed`; every closed operation has an executed step or a declared-gap skip; the control's matrix column is complete and consistent with its capability declaration; and the lifecycle, port, flow-registry, coverage, runner, and artifact modules are the committed ones — no edit to any of them is part of the change that adds the control.
- **Honesty about the proof's nature:** the "no edit" part is a proof by construction (the run cannot be green without the seam) plus review of the change's touched files. It is not a VCS-diff assertion, because the delivered suite forbids comparing against a moving base ref (ALT-5).

### 4. The shipped-registry invariant is preserved

`CONFORMANCE_ADAPTERS` remains exactly the three shipped contracts; the existing structure test that rejects an unexpected non-provider registration and requires the exact count stays enforced and unedited in substance. The control adapter is composition-injected and therefore invisible to every shipped-registry assertion — which is the point: a proof instrument must not become a participant.

### 5. Explicit non-decisions

- **No lifecycle, port, or flow-registry module gains a per-adapter branch**, and no new lifecycle phase or adapter lifecycle hook is introduced.
- **No new core contract type and no plugin framework.** The participation contract is a statement about existing seams, not a new abstraction over them.
- **No fourth shipped registration.** The registry's exact-three invariant is preserved, including its mutation controls.
- **The delivered runner exception is recorded, not fixed.** Generalizing the addressing-derived identity expectation into declared tenant data would change the runner and is a separate decision.
- **No workflow change.** The proof runs inside `pnpm test`.

- **Rationale (tied to drivers):** The criterion becomes two refutable checks (driver 1) without touching the registry three stories depend on (driver 2), failures name a file and a construct (driver 3), the proof reuses the injected list and the coverage gates (driver 4), the delivered exception is stated rather than concealed (driver 5), and the whole instrument is removable (driver 6).
- **Decider:** Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review; this record stays `Proposed` until then.
- **Conditions for revisit:** See `revisit_triggers`, notably a needed sixth item, an allowlist growth outside the pinned derivation, and a control adapter that drifts into being a fourth adapter.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 through C-7. No accepted-risk exceptions are taken.

Four consequences are recorded rather than treated as exceptions:

- The provider-name-free invariant is *not* absolute: `runner.ts` carries one pinned, enumerated exception. Stating it is the condition of the invariant being trustworthy; a claim of total provider-name-freeness would be contradicted by delivered code (C-3).
- The "no module edited" half of the constructive proof is review-verified rather than diff-asserted, because the delivered suite forbids base-ref comparison. The run itself is the mechanical half (C-4).
- The control adapter is test-only instrumentation whose minimality is maintained by the revisit trigger; if it grows into a provider emulator it stops proving minimality (C-6).
- The five-item contract is closed, which means a legitimate future need is a decision rather than a delivery change. That is deliberate friction (C-6).

## Trade-offs & Consequences

### Positive Outcomes

- "A new adapter plugs in without lifecycle changes" becomes two mechanical checks with named failures.
- A new adapter's obligations are five readable items, so M3-S2/S3 can author against the bar before writing code.
- The delivered runner exception is documented and pinned, so a future reviewer can see exactly where adapter identity lives in the engine.
- The shipped registry keeps its exact-three invariant and its mutation controls.
- No plugin framework, no new job, no new core type.

### Negative Outcomes

- Two proofs must be maintained, and the scan's allowlist is a permanent maintenance point.
- The invariant's honesty weakens its rhetorical force: "provider-name-free except one pinned derivation" is a less satisfying sentence than "provider-name-free".
- The control adapter is a fixture that can drift; if it starts modeling real provider behavior, the minimality claim quietly stops being proven.
- Review, not a gate, verifies that the lifecycle modules were not edited for the control.

### Unresolved Questions

- [ ] Whether the runner's addressing-derived identity expectation should move into declared tenant data (making the engine exception disappear) — a runner change, deliberately out of scope here (owner: `@decision-advisor` on the first adapter whose addressing cannot be derived this way).
- [ ] Whether the control adapter should exercise the stateful double as well as the stateless tenant, which would widen the proof at some cost in fixture surface (owner: `@coder` in GH-339; default is whichever the delivery's flow coverage needs).
- [ ] Whether the scan should be extended to `packages/adapters/src/**` (where provider names legitimately dominate) or stay scoped to the engine set (owner: `@decision-advisor`; default is the engine set, because scanning an adapter package for its own name is noise).
- [ ] Whether a second port family should adopt the same participation statement (owner: future harness/CI decision; explicitly not generalized here).

## Implementation Notes and Constraints

1. **Contract statement.** One normative paragraph plus the five-item table in the conformance spec page; the record is the rationale, the spec is the current truth.
2. **Scan.** A structure test under `tests/` reads the bound module set and the allowlisted modules, matches adapter identity constructs as defined in §2 (a full-value provider name or provider-contract literal; a provider-discriminant comparison or branch), and fails by file and construct; the allowlist is a declared constant with one (file, construct) entry per enumerated occurrence, and the artifact's redaction labels and URL patterns are declared non-constructs rather than allowlisted.
3. **Control adapter.** A test-only registration under `tests/` with its own tenant namespace, contract, builder, column data, and trap fixtures; injected through `RunConformanceInput.adapters`; asserted green with a complete column.
4. **Registry guard.** The existing exact-three structure test and its mutation controls stay unedited in substance; a control registration in the shipped list still fails.
5. **What must not change.** `CONFORMANCE_ADAPTERS`, the flow registry, the coverage gates, the runner, the artifact module, `ADAPTER_OPERATIONS`, the production configuration catalog, and the CI workflows.

## Verification Criteria

- Metric: contract minimality — the control adapter supplies exactly the five declared items and its run is `passed` with every operation executed or declared-gap skipped — Target: exact — Window: GH-339 CI.
- Metric: matrix completeness for the control — a declared cell for every closed operation, consistent with the control's capability declaration — Target: exact — Window: GH-339 CI.
- Metric: engine invariant — zero adapter identity constructs (per §2's definition) in the bound module set; zero occurrences outside the exact allowlist; a mutation adding one fails by file and construct, and a control that hand-authors a provider-name column key in the parity module fails the same scan — Target: zero — Window: GH-339 CI.
- Metric: shipped-registry invariant — registry length, provider set, contract binding, builder presence unchanged; an added non-provider registration still fails — Target: exact — Window: GH-339 CI.
- Metric: no growth — contract inventory, `ADAPTER_OPERATIONS`, the configuration catalog, and the workflow files unchanged — Target: exact — Window: GH-339 CI and review.
- Metric: offline proof — the control run performs zero live network calls and zero live child processes — Target: zero — Window: GH-339 CI.

## Confidence Rating

**High** for the contract's items and for the injection seam: the registry's exact-three invariant, the declaration scan, the runner's explicit adapter list, the delivered control-registration practice, the registry-agnostic coverage gates, and the provider-name-free module set are all verified, so the two proofs rest on delivered mechanisms rather than new ones. **Medium** for the invariant's wording and for the control adapter's minimality: the delivered runner carries one provider-aware derivation, which is recorded rather than removed, and the control's minimality is maintained by review and a revisit trigger rather than by a gate — both are stated as limitations rather than presented as complete.

## References

- GH-339 change workspace (gap analysis: extensibility proven only by structure tests over the three shipped contracts): `doc/changes/2026-11/2026-11-18--GH-339--adapter-conformance-parity/chg-GH-339-pm-notes.yaml`
- M3 blueprint — M3-S5 AC, M3-S2/S3 dependency on the conformance harness, EC-4: `doc/planning/oss-tooling/milestones/m3/README.md`
- M3 contracts — the parity suite and its adapter/shape framing: `doc/planning/oss-tooling/milestones/m3/contracts.md`
- Delivered registry, declaration scan, and their mutation controls: `tests/structure/conformance-coverage.test.ts`, `packages/testkit/src/conformance/adapters.ts`
- Delivered injection seam and the sole-participant statement: `packages/testkit/src/conformance/runner.ts`
- Delivered control-registration practice: `tests/conformance/broken-adapter-control.test.ts`
- Registry-agnostic coverage gates: `packages/testkit/src/conformance/coverage.ts`
- Harness-registry precedent for a sole-participant-list invariant: `packages/testkit/src/conformance/harness.ts`, `doc/spec/features/feature-adapter-conformance.md` §Harness conformance registry
- Contract and capability vocabulary: `packages/core/src/contracts/adapter-capabilities.ts`, `doc/spec/features/feature-adapter-ports.md`
- No-moving-base-ref rule: `tests/structure/conformance-coverage.test.ts` (TC-CONF-005)
- [TDR-0036](TDR-0036-cross-adapter-parity-matrix-declared-difference-register.md) — the matrix column a new adapter supplies
- [TDR-0037](TDR-0037-tracker-error-taxonomy-delivered-identities.md) — the trap catalog a new adapter supplies
- [TDR-0038](TDR-0038-simulated-stateful-tracker-double-declared-effects.md) — the double a new adapter's write-then-read flows run against
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — tier rules and the no-parallel-adapter-surface discipline
- [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) — additive-within-v1 discipline

## Revision

### 2026-11-18 — binding identity-construct definition and derived matrix columns (readiness iteration 1)

- **Status:** unchanged — `Proposed`, `decision_date: null`. The owner accepts or rejects this record at the GH-339 PR review; this revision grants no authority and records no acceptance.
- **Trigger:** GH-339 readiness review iteration 1 (`doc/changes/2026-11/2026-11-18--GH-339--adapter-conformance-parity/readiness-review/readiness-iter-1.md`), finding **6** parts (a) and (b), plus the PM direction recorded in `chg-GH-339-pm-notes.yaml` (decision of 2026-11-18) that binding wording for findings 6-11 lands in the binding artifacts rather than only in the plan.
- **What this record had wrong.** (a) The record required "no adapter identity literal" without defining the construct, so the requirement and the delivered scan agreed only through a reading recorded in a plan comment: the artifact module really does contain `"github token"`/`"gitlab token"` labels (`packages/testkit/src/conformance/artifact.ts:84-85`) and provider-host URL patterns (`artifact.ts:91,114`), and nothing in this record said why those are not hits. (b) The permitted-home list included "the parity matrix's column keys — its purpose" while the parity module is inside the zero-identity bound set, and the record said the parity engine "reads provider names only from the matrix data it is given" — which is satisfiable only if those columns are derived, and was never stated. The permit list and the zero-claim could therefore be read as contradicting each other.
- **Corrected statement now carried by this record.** §2 opens with the **binding identity-construct definition** — (i) a full-value provider name or provider-contract string literal, (ii) a provider-discriminant comparison or branch — states that a provider literal inside a comparison still matches (so the definition stays falsifiable), and states explicitly that the artifact's redaction labels and URL patterns are **not** constructs because they name a content family to redact rather than an adapter to dispatch. The definition is what the exact allowlist is written against, and TDR-0037 C-7 cites it so one definition serves both scans. The parity matrix's adapter columns are now a permitted home **only as values derived from the registration list** (`CONFORMANCE_ADAPTERS` mapped to `registration.provider`), so the parity module authors no provider-name key, and a hand-authored key, lookup operand, or comparison in that module is an identity construct that fails the scan. TDR-0036 §1 now says the same thing about the control run's column.
- **Sections amended:** Context (the four-provider-free-modules FACT now names the definition and the artifact's non-construct labels with line evidence); C-3 (statement, source, verification — definition-based scan plus the derived-column rule and a column-key mutation control); Decision §2 (new binding definition block; bound set now counts constructs; delivered-state sentence about the parity engine's derivation; the matrix-columns permit replaced by the derivation rule; enforcement paragraph); Verification Criteria (engine invariant); Implementation Notes 2 (scan matches constructs; the allowlist is one (file, construct) pair per occurrence; redaction patterns are declared non-constructs rather than allowlisted). The five-item contract, the two proofs, the alternative set, the DACI assignment and the status are unchanged.
- **Follow-ups this revision forces on other artifacts (not made here):** the change specification's DM-6 and AC-F4-4 must carry this definition and replace "the matrix column keys" with the derived-column rule, and TC-REG-004 must be worded as "zero unpermitted occurrences" so the permit list and the zero-claim cannot contradict. No code, spec, test-plan, or plan file was changed by this revision.

### 2026-11-18 — runner exception restated as disclosed, not outstanding (readiness iteration 3)

- **Status:** unchanged — `Proposed`, `decision_date: null`. The owner accepts or rejects this record at the GH-339 PR review; this revision grants no authority and records no acceptance.
- **Trigger:** GH-339 readiness review iterations 2 and 3 (`readiness-review/readiness-iter-2.md` finding 10, carried unchanged into `readiness-iter-3.md`): the runner "reconciliation note" in Decision §2 still claimed a disagreement between this record and the change specification. That disagreement has been resolved by the specification's own revision, which now carries the pinned exception verbatim (F-4, AC-F4-4, DM-6).
- **What this record had wrong.** The note was written when the specification's registration-only section listed the runner among the provider-free modules. It described the mismatch and a two-move resolution — move the derivation into declared tenant data, or have the specification record the pinned exception. The specification now records the pinned exception, so the note describes a disagreement that no longer exists, and a reviewer of this record could conclude the record and the specification are still unreconciled.
- **Corrected statement now carried by this record.** §2 states the delivered fact instead of a pending obligation: the runner's exactly five provider comparisons are this record's **one pinned, exact allowlist exception**, enumerated in the permitted homes, disclosed rather than concealed, and covered by the allowlist's (file, construct) entries so the scan fails on any sixth occurrence; no reconciliation is outstanding. The only open item is the separate unresolved question — whether the expectation should eventually move into declared tenant data — which is a runner change and a decision of its own, not a correction to this record.
- **Sections amended:** Decision §2, the "Reconciliation note (specification obligation)" paragraph replaced by "The runner exception, as delivered and disclosed."; plus this revision entry. The five-item contract, the identity-construct definition, the bound set, the permitted homes, the enforcement rule, the two proofs, the alternative set, the DACI assignment, the Verification Criteria and the status are unchanged.
- **Follow-ups not made here:** the change specification's F-4/AC-F4-4/DM-6 already state the pinned exception, so no artifact outside this record needs an edit for this finding; no spec, test-plan, plan, or code file was changed by this revision.

