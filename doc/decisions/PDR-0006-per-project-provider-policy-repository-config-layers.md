---
id: PDR-0006
decision_type: pdr
status: Proposed
created: 2026-11-19
decision_date: null
last_updated: 2026-11-19
summary: "GH-350: 'per-project overrides' is satisfied by the delivered repository-owned configuration layers — project-committed (<repo>/<configDirectoryName>/config.yaml) and project-local (config.local.yaml) — not by a new project-keyed provider branch. A checkout is the project identity for provider policy in M4-S4; the typed provider branch, child-name record merges, reset, and provenance already give per-repository descriptors, credentials, chains, profiles, watch targets and budgets, and the AC 'policy expressed only in Jaiship config' is met because those layers are Jaiship configuration. No new key is added; M4-S5 (project registry) is a declared future owner of a project-keyed layer, and the change must land one spec clause, the provenance/precedence tests, and the CI caveat that project-local is skipped under CI=true unless enabled."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider policy scope and configuration surface"
decision_scope: repo
review_date: null
business_impact: "GH-350 ships the required per-project policy behaviour without inventing a second project identity or a branch that M4-S5 would have to replace; the owner keeps one precedence model and one provenance story."
customer_impact: "An operator tunes providers, chains, models and ceilings per repository by committing config.yaml (or using config.local.yaml locally), sees the winning layer through config debug, and is never surprised by a host-wide key silently outranking the repository's declaration."
classification:
  domains: [product, configuration, operations, tooling]
  archetype: policy
  environment: clear
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-350 clarify_scope: per-project overrides versus undelivered M4-S5)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-350 clarify-scope: M4-S5 not delivered; AC text 'policy expressed only in Jaiship config')"
    - "@spec-writer (GH-350 specification: the clause and tests this record requires)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-350 PR review)"
  performers:
    - "@spec-writer (declare the per-repository mechanism and the CI caveat)"
    - "@test-plan-writer (precedence and provenance oracles)"
    - "@coder (tests only; no configuration branch is added)"
    - "@doc-syncer (provider-engine and config-layer wording)"
  informed:
    - "M4-S5 owners (the future project registry)"
    - "Operators sharing one host across repositories"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "M4-S5 delivers a project registry with a project key that can differ from a checkout: reopen and decide whether a project-keyed provider layer is added above or instead of the repository layers; do not silently reinterpret the layers."
  - "A real requirement appears for one project policy spanning several checkouts: the repository layers cannot express it; that is the trigger for a project-keyed layer, decided then."
  - "An operator demonstrates a provider value that cannot be expressed in the repository layers (for example a machine-only override that must beat the repository): that is the delivered environment layer's or project-local's job; if neither fits, reopen rather than widening provider keys."
  - "CI behaviour proves surprising in practice (a repository relies on project-local policy that CI silently skips): document or revisit the CI enablement, not the per-project mechanism."
links:
  related_changes: ["GH-350"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-config-layer.md"
    - "doc/spec/features/feature-provider-engine.md"
    - "doc/spec/features/feature-provider-profiles.md"
  contracts:
    - "packages/core/src/config/catalog.ts"
    - "packages/core/src/config/resolver.ts"
  decisions: ["ADR-0007", "TDR-0003", "TDR-0022"]
  roadmap_items: ["M4-S4", "M4-S5"]
---

# PDR-0006: Per-Project Provider Overrides — The Repository-Owned Configuration Layers Are the Mechanism

## Context

- **FACT:** The ticket lists "per-project overrides" among the provider-policy tasks and requires "policy expressed only in Jaiship config". M4-S5 (project registry/queues) is **not delivered**, so no project key, registry, or project-scoped storage exists to key a policy branch on.
- **FACT:** The delivered configuration model has seven ordered layers, two of which are repository-owned: project-committed (`<repo>/<configDirectoryName>/config.yaml`) and project-local (`<repo>/<configDirectoryName>/config.local.yaml`). A selected file (`--config`, `<PREFIX>CONFIG`, or a legacy selector) occupies the project-committed slot; the prior-identity fallback reads the pre-freeze file as the same layer when the current file is absent.
- **FACT:** The provider branch is a typed ordinary production branch. Its dynamic-name maps (`credentials`, `entries`, `chains`, `profiles`, `budgets`) merge by child name, lists replace whole, `reset` removes inherited values, every effective value reports a winning origin through `config debug` / `config get --show-origin`, and unknown keys fail closed.
- **FACT:** Under `CI=true`, system, user-global, and project-local sources are skipped as `ci-disabled` unless independently enabled by the corresponding `--enable-*` flag; the project-committed layer is read. A selected file makes project-local `selected-config` regardless of CI.
- **FACT:** State scope is already per project (`<host root>/projects/<project key>`), minted from the repository identity, so "project" in this repository means *the checkout's repository identity*, not a separately registered registry row.
- **Why now:** GH-350 must either state that the AC is satisfied by the delivered layers, or add a branch now. Adding a project-keyed branch before the registry exists would invent a second identity, and M4-S5 would have to reconcile or replace it.

## Problem Framing (Clarified)

The requirement is behavioural: **a repository must be able to set provider policy that differs from the machine's and from another repository's, using Jaiship configuration only.** The requirement is not "a new configuration branch exists".

Three candidate readings:

1. **Per-repository (delivered).** Each checkout owns layers 4 and 5. Committed policy travels with the code; local policy stays on the workstation; provenance names the layer. This is exactly per-project for a one-checkout-per-project workflow.
2. **Per-registered-project (not delivered).** A key from a project registry selects a policy subtree from a host-wide store. That needs M4-S5's identity, and it would make policy invisible to the repository that is being delivered — the opposite of the "policy travels with the code" property.
3. **Deferred (declared non-goal).** Say "per-project is future work". This leaves the ticket AC unaddressed and invites the next operator to re-litigate it.

The honest answer is (1) **plus a declared boundary**: the identity is the checkout; a project spanning several checkouts, or a policy that must exist without a checkout, is not expressible and is M4-S5's problem.

## Constraints (Hard Requirements)

### C-1: Policy is expressed only in Jaiship configuration

- **Statement:** Provider selection, models, chains, credentials references, windows, budgets, and watches are declared in the typed configuration tree; no shell profile, no hook, no environment-variable convention, and no hidden file participates in provider policy.
- **Source:** AC (ticket: "policy expressed only in Jaiship config")
- **Verification:** test (a delivery resolves provider policy with the legacy profiles and hook absent/disabled) + review of every provider-policy input
- **Negotiable:** no

### C-2: One project identity, no parallel key

- **Statement:** GH-350 introduces no project key, registry lookup, or second identity for provider policy; the repository checkout is the identity.
- **Source:** prior decision (TDR-0022 project state scope minted from repository identity); M4-S5 undelivered
- **Verification:** structure test (no new configuration branch or key); code review
- **Negotiable:** no

### C-3: Precedence and provenance stay observable and deterministic

- **Statement:** A repository declaration beats a user-global declaration for the same key; a project-local declaration beats the project-committed one; every effective value reports its winning origin; two resolutions of the same inputs are byte-identical.
- **Source:** internal standard (configuration layer origins, ADR-0003 DEC-4); AC (provenance through `config debug`)
- **Verification:** behaviour tests (provider key winners across three layers; origin strings) + golden output
- **Negotiable:** no

### C-4: Fail-closed validation is preserved at every layer

- **Statement:** A repo-layer provider document is validated before merge like every other layer; an invalid repository declaration fails the run with the delivered `config.*` or `provider.chain.*` identity, never a silently ignored override.
- **Source:** internal standard (configuration layer schema and semantic validation)
- **Verification:** test (invalid repo-layer provider values refuse with the named field)
- **Negotiable:** no

### C-5: The CI caveat is declared, not implied

- **Statement:** The documented mechanism states that project-local is skipped under `CI=true` unless enabled, and that the project-committed layer is the CI-visible policy layer; no test or doc claims CI reads local policy.
- **Source:** delivered CI controls; internal standard (honest claims)
- **Verification:** test (CI run resolves committed policy and reports project-local `ci-disabled`) + doc review
- **Negotiable:** no

### C-6: No shell or legacy input reaches the decision

- **Statement:** The per-project mechanism adds no read of `~/.ados/config/profiles/*.sh` or the pre-iteration hook at runtime; migration is a separate one-shot command and a separate decision.
- **Source:** AC; flip-plan F2 ("the hook is removed from the path, not from disk")
- **Verification:** test (policy resolves with those paths absent) + import/boundary review
- **Negotiable:** no

> **Table stakes:** the seven-layer order, the record-map merge rule, the reset semantics, the environment and CLI layers, and the prior-identity fallback are unchanged and are not re-scored.

## Decision Drivers

**Product drivers:**

1. **AC truthfulness** — the requirement must be met by behaviour that exists, not by wording that implies it.
2. **Policy travels with the code** — a repository's provider policy should be reviewable in that repository's PR, not hidden in a host store.
3. **No invented identity** — a project key that M4-S5 will define later must not be pre-empted.

**Technical drivers:**

4. **One precedence model** — the same seven layers, merges, resets, and origins for provider policy as for every other branch.
5. **Fail-closed at every layer** — a bad repository override must refuse, not vanish.
6. **Zero new surface** — no command, key, state kind, or error identity.

**Operational drivers:**

7. **Operator predictability** — `config debug` answers "why this provider?" from evidence.
8. **Honest CI story** — committed policy is what CI sees; local policy is a workstation affordance.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-350 clarify-scope).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; the AI does not accept this record.
- **Contributors:** `@pm` (scope and undelivered dependency), `@spec-writer` (clause and tests), `@decision-advisor` (analysis).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, human owner at the GH-350 PR review.
- **Performers:** `@spec-writer`, `@test-plan-writer`, `@coder` (tests only), `@doc-syncer`.
- **Informed:** M4-S5 owners, operators sharing a host.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Two repository-owned layers exist, ordered project-committed then project-local, above environment and CLI | FACT | `doc/spec/features/feature-config-layer.md` §Seven layers | The mechanism would have no layer to point at | High |
| The provider branch is typed, merges by child name, supports reset, and reports origins | FACT | `feature-config-layer.md` §Provider catalog branch, §Merge/reset/origins | Per-repository policy would need new merge machinery | High |
| `CI=true` skips project-local unless enabled; committed is read | FACT | `feature-config-layer.md` §Discovery and CI controls | C-5 would be a false claim | High |
| Project identity in state scope is minted from the repository identity, not a registry | FACT | TDR-0022; `packages/core/src/app/state-scope.ts` | "Project" would have two meanings | High |
| M4-S5 (registry/queues) is undelivered | FACT | milestone M4 flip-plan sequencing amendment | A project-keyed branch would have no key source | High |
| A one-checkout-per-project workflow is the current and near-term operating model | ASSUMPTION | project size (solo developer + agents), repository layout | A multi-checkout project would need a project key sooner | Medium |
| No operator currently depends on a project-keyed provider key | FACT | repository search: no such branch or key exists | Migration would be needed | High |

## Mental Models & Techniques Used

- **First principles:** what must be true for "per-project overrides" to hold? Two repositories must be able to disagree. A repository-owned layer is sufficient for that; a registry key is not necessary.
- **Inversion:** how would this decision fail? If two checkouts of one project must share a policy, the layer model cannot express it. That is named as the boundary and the revisit trigger, not hidden.
- **Opportunity cost:** a project-keyed branch now costs an identity, a precedence position, a discovery path, and a later reconciliation with M4-S5; the layer model costs a paragraph and tests.
- **Second-order thinking:** putting policy in a host store would make the repository's PR review blind to its own provider policy — a governance regression disguised as a feature.
- **KISS:** the paved road already has the merge, the reset, the origins, and the CI rules.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 config-only | C-2 one identity | C-3 precedence/provenance | C-4 fail-closed | C-5 CI honesty | C-6 no shell input |
|---|---|---|---|---|---|---|
| ALT-0 declare a non-goal and defer | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 document + test the repository layers (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 add `provider.projects.<key>` now | ✅ | ❌ | ⚠️ | ⚠️ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none claimed).

### Alternative 0 — Declare Per-Project Overrides a Non-Goal for M4-S4

- **Eligibility:** Eligible with an accepted-risk exception on C-1 (a ⚠️: the AC would be met only if "per-project" is read as out of scope).
- **Summary:** Record "per-project overrides deferred to M4-S5" and ship nothing for this task line.
- **Constraint compliance:** Every constraint passes; the ticket task line is declined.
- **Driver fit:** Fails driver 1 (AC truthfulness) and driver 2 (no policy story at all).
- **Pros:** Zero work; no wording risk.
- **Cons:** The requirement is real and already satisfied by delivered behaviour; deferring invites re-litigation and an unnecessary future branch.
- **Why rejected:** The delivered layers already provide the behaviour; declaring a non-goal would be less true than documenting what exists.

### Alternative 1 — Document and Test the Repository-Owned Layers as the Mechanism (selected)

- **Eligibility:** Eligible (passes all constraints).
- **Summary:** The spec states that per-project provider policy is expressed in the project-committed and project-local layers, with the checkout as the project identity; tests prove a repository declaration beats user-global for descriptors, chains, profiles, watch targets, and budgets, that project-local beats committed, that origins name the winning layer, that invalid repository values refuse, and that CI reads committed policy only. No key is added.
- **Constraint compliance:** C-1 — the layers are Jaiship configuration. C-2 — no new identity. C-3 — the delivered merge/origin rules, now proven for the provider branch. C-4 — layer validation already precedes merge. C-5 — documented and tested CI behaviour. C-6 — no shell read is introduced.
- **Driver fit:** Best on all eight.
- **Pros:** True today; zero new surface; policy is reviewable in the repository's PR; provenance answers "why".
- **Cons:** The identity is a checkout, not a registry project; a multi-checkout project cannot share policy (declared boundary).
- **Why chosen:** It satisfies the requirement with the delivered model and states its boundary explicitly.

### Alternative 2 — Add a `provider.projects.<key>` Branch Now

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Introduce a project-keyed subtree merged above the repository layers, keyed by a project identity minted at composition.
- **Constraint compliance:** C-2 fails — it invents a project key before M4-S5 defines one. C-3 degrades — a fourth precedence position must be specified, tested, and explained. C-4 degrades — the keyed subtree's validation and origin grammar become new surface.
- **Driver fit:** Fails drivers 3, 4, 6.
- **Pros:** Would express multi-checkout policy.
- **Cons:** A second identity, a new precedence rung, new validation, and a branch M4-S5 must reconcile; policy would no longer travel with the code it governs.
- **Why rejected:** It front-runs an undelivered story and buys a capability nobody has asked for with permanent surface.

## Decision

- **Decision:** Adopt **ALT-1**: `per-project overrides` is satisfied by the delivered project-committed and project-local configuration layers, with the repository checkout as the project identity for provider policy in M4-S4. No `provider.projects.*` branch, key, state kind, command, or error identity is added.

### D1 — Declared mechanism and identity

The GH-350 specification must carry one explicit clause: provider policy is declared in the typed `provider` branch; a repository overrides it in `<repo>/<configDirectoryName>/config.yaml` (project-committed, travels with the code and is visible to CI) and locally in `config.local.yaml` (project-local, workstation-only); the winning layer is reported by `config debug` and `config get <key> --show-origin`; a selected `--config` file occupies the project-committed slot. The project identity is the checkout; a multi-checkout project policy is a declared boundary, not a supported case.

### D2 — Required evidence

The change must land, at minimum: a provider-key precedence matrix across defaults → user-global → project-committed → project-local → environment → CLI for at least one descriptor, one chain, one profile, one watch target, and one budget; a project-local-beats-committed case; an origin-string case naming the repository file and line; an invalid repository-layer provider value refusing with the named field; a `CI=true` case showing committed policy resolved and project-local reported `ci-disabled`; and a "no shell input" case resolving policy with the legacy profile directory and hook absent.

### D3 — Explicit non-goals

No project registry, no project key, no host-store policy, no per-queue policy, and no policy inheritance between repositories. The existing environment and CLI layers remain the machine-scoped escape hatch, and they already outrank the repository layers by design.

- **Decider:** Juliusz Ćwiąkalski — pending at the GH-350 PR review.
- **Conditions for revisit:** see `revisit_triggers` (first is M4-S5 delivery).

### Constraint Compliance Attestation

The chosen alternative satisfies C-1 … C-6: policy is configuration-only (C-1); no project key or second identity is introduced (C-2); the delivered precedence and origin model is proven for the provider branch (C-3); layer validation stays fail-closed (C-4); CI behaviour is documented and tested rather than implied (C-5); and no shell or legacy input enters the decision path (C-6). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The AC is met by behaviour that exists, with tests instead of a new branch.
- Repository provider policy is reviewable in that repository's PR and travels with the code.
- Zero new configuration surface, zero new identities, zero new error rows.

### Negative Outcomes

- The identity is a checkout. A project with several checkouts cannot share one provider policy; that gap is declared and belongs to M4-S5.
- Project-local policy is invisible to CI by default; an operator who tunes locally and expects CI parity must be told (documented).
- The change is mostly documentation and tests, so its value depends on the spec clause being precise — a vague clause would leave the AC arguable.

### Unresolved Questions

- [ ] Whether the phrase "per-project" should be restated in the specification as "per-repository (checkout) for M4-S4" (owner: `@spec-writer`; recommendation: yes, with the M4-S5 pointer).
- [ ] Whether a future project-keyed layer should sit above or below the repository layers (owner: M4-S5; explicitly not decided here).

## Implementation Plan

1. Specification: add the per-project clause, the identity statement, the CI caveat, and the boundary.
2. Tests: precedence matrix, provenance, invalid-layer refusal, CI behaviour, no-shell-input resolution.
3. Docs: provider-engine and config-layer pages name the mechanism; no new key is documented because none is added.
4. No code change to the resolver, catalog, or provider branch.

## Verification Criteria

- Metric: provider keys resolvable per repository from configuration alone — Target: descriptors, chains, profiles, watch, budgets all covered — Window: GH-350 CI.
- Metric: provider values whose reported origin is not the winning layer — Target: 0 — Window: GH-350 CI.
- Metric: new configuration branches or keys for project scoping — Target: 0 — Window: GH-350 CI (structure inventory).
- Metric: CI runs reading project-local policy while `CI=true` — Target: 0 — Window: GH-350 CI.
- Metric: provider policy resolution requiring a shell profile or hook — Target: 0 — Window: GH-350 CI.

## Confidence Rating

**High.** The mechanism is delivered, the merge and origin rules are pinned by existing tests, and the CI caveat is declared behaviour rather than an inference. The only judgement call is the meaning of "project", which is bounded by the state-scope precedent (repository identity) and explicitly handed to M4-S5 for the multi-checkout case.

## References

- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — provider configuration as a typed catalog branch.
- [TDR-0003](TDR-0003-config-parser-schema-and-acquisition.md) — parser, schema, acquisition mechanics.
- [TDR-0022](TDR-0022-multi-repository-workstation-state-scope.md) — repository-minted project identity in state scope.
- Feature specs: [Configuration Layer](../spec/features/feature-config-layer.md), [Provider Engine](../spec/features/feature-provider-engine.md), [Provider Profiles](../spec/features/feature-provider-profiles.md).
- Change: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/`.
