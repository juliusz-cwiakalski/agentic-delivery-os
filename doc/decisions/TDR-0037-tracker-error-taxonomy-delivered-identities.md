---
id: TDR-0037
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "The blueprint's four tracker-error classes become ONE closed classification table in testkit that maps each class onto an ALREADY-DELIVERED identity and the structured fields that decide it — capability gap as declared data, 401/403 as `provider.payload.invalid` with `httpStatus`, transport failure as `provider.payload.invalid` without status, malformed/non-2xx as `provider.payload.invalid` — with the parity assertion being that registered adapters classify the same trap-family fixture into the same class; no error-table row, no `DOMAIN_KINDS` member, no new `tracker.*` code namespace, and one namespace-absence scan scoped to exactly the testkit and adapters source trees with a single-file allowlist."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider adapters and the @delivery-os/testkit conformance suite"
decision_scope: repo
review_date: null
business_impact: "M3 EC-4's `including error taxonomy` clause becomes a mechanical cross-adapter claim about how failures are classified, without adding a second failure vocabulary that every consumer, projection, and exit code would have to learn."
customer_impact: "An operator sees the same classified failure for the same provider condition regardless of which tracker a project uses, and learns that an unsupported operation is a declared gap rather than a failure — instead of comparing provider-specific error prose."
classification:
  domains: [contracts, architecture, tooling]
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
  driver: "@decision-advisor (GH-339: @pm routed the tracker error taxonomy question during clarification)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-339 clarify_scope: trap coverage is scattered across provider unit suites with no conformance-level catalog)"
    - "@decision-advisor (repository analysis and this record)"
    - "@spec-writer (carry the class table, the class decision rule, and the family coverage rule into the GH-339 change spec)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-339 PR review — this record fixes what `the same error` means across adapters)"
  performers:
    - "@coder (GH-339 delivery: the taxonomy table, the family fixtures, the replay assertions, and the coverage gate)"
    - "@doc-syncer (provider-client-seeds trap-catalog note, adapter-conformance spec reconciliation, result-contract pointer)"
  informed:
    - "M3-S2 Jira backlog adapter — supplies its family fixtures and must classify identically"
    - "M3-S3 GitLab code-host adapter — supplies its family fixtures and must classify identically"
    - "M3-S4 GitHub reference adapter — owns the reference classification"
    - "Consumers of adapter-local failure identities (verify, closeout, merge, status) — no new identity reaches them"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A provider signals a rate limit with a status the taxonomy already assigns to another class (notably 403): either the taxonomy gains a structured rate-limit discriminator that providers actually expose (a declared header or body field) or the class assignment is re-decided; a prose exception is not an option."
  - "A consumer needs to branch on the class (for example retry budgets keyed on a rate-limit class): that is the moment the class must become an error-table identity through its own additive decision, because a testkit label must never become consumer-visible behavior by accident."
  - "A fifth blueprint class appears (for example `tracker.conflict`): map it onto a delivered identity and a structured field, or decide explicitly that it needs a new identity — never add it to the taxonomy as an unproven class."
  - "Two adapters provably cannot classify one family identically because their transports differ structurally (an MCP-only path with no HTTP status, for example): register the difference through TDR-0036's `failure-classification` class with the deciding field named, rather than widening the taxonomy."
  - "The four-field trap-catalog entry shape becomes insufficient for family evidence (rationale or provider-behavior text that does not fit): extend the catalog by a recorded decision; do not overload `expectedNormalizedOutcome` with class ids."
  - "A trap family fixture starts proving a provider version rather than a behavior (a status code that changed with a provider release): re-author the fixture and note the change in the family declaration; the class assignment must not move with it."
links:
  related_changes: ["GH-339"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-339--adapter-conformance-parity/chg-GH-339-pm-notes.yaml"
    - "doc/planning/oss-tooling/milestones/m3/contracts.md"
    - "doc/planning/oss-tooling/milestones/m3/README.md"
    - "doc/spec/features/feature-adapter-reference-behavior.md"
    - "doc/spec/features/feature-provider-client-seeds.md"
    - "doc/spec/features/feature-adapter-conformance.md"
    - "doc/spec/features/feature-result-contract.md"
  contracts:
    - "packages/core/src/contracts/adapter-capabilities.ts"
    - "packages/adapters/src/io/provider-transport.ts"
    - "packages/adapters/src/github/normalize.ts"
  diagrams: []
  decisions: ["ADR-0003", "TDR-0008", "TDR-0032", "TDR-0036"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S5", "M3-S2", "M3-S3", "M3-S4"]
---

# TDR-0037: Tracker Error Taxonomy — Parity Assertion over Delivered Identities, Not a New Closed Identity Set

## Context

- **FACT:** The M3 tracker contract names exactly four typed refusals — `tracker.capability.unsupported`, `tracker.transport.failed`, `tracker.auth.rejected`, `tracker.payload.invalid` — and the conformance section names four trap families: "rate limits, auth shapes, pagination truncation, workflow-state mismatches" (`doc/planning/oss-tooling/milestones/m3/contracts.md`, read 2026-11-18).
- **FACT:** None of the four `tracker.*` strings exists anywhere in the delivered codebase. Provider failures are adapter-local identities, and the delivered reference behavior states them per operation: a read's 404 is `provider.not-found`; any other non-2xx is `provider.payload.invalid` carrying the structured `httpStatus`; a transport failure is `provider.payload.invalid` **without** status; a resolved credential failure is `config.credential.missing`; a write classifies any non-2xx (404 included) as `provider.payload.invalid` with `httpStatus` (`doc/spec/features/feature-adapter-reference-behavior.md` §Failure identities, read 2026-11-18).
- **FACT:** `provider.payload.invalid` is an *adapter-local* identity, deliberately not an error-table row: the CLI classification recognizes the exact `(provider, provider.payload.invalid)` pair and projects it as `platform-provider` at exit `2`, and the error-table sync check accepts the literal without demanding a documented row (`doc/spec/features/feature-result-contract.md`, read 2026-11-18).
- **FACT:** The error table already owns `provider.auth.rejected` — one of the five **provider-engine** identities for the AI-model provider, which the same page explicitly distinguishes from the adapter-local provider-I/O identity (`doc/spec/features/feature-result-contract.md`, read 2026-11-18). A `tracker.auth.rejected` that reused that row would collide with a model-provider identity; a new row would need a `DOMAIN_KINDS` member or a new namespace.
- **FACT:** `config.credential.missing` is a table row of the `config` kind, and the adapter boundary already routes a credential-port resolution failure to it (`doc/spec/features/feature-result-contract.md`; `doc/spec/features/feature-adapter-ports.md`, read 2026-11-18).
- **FACT:** Adapter-local refusals raised before dispatch carry `provider.payload.invalid` with zero provider requests: the delivered GitHub workflow-map validation failure and the undeclared-alias, non-terminal-alias, and `done`-resolving transition refusals all classify that way (`doc/spec/features/feature-adapter-reference-behavior.md` §Workflow mapping, read 2026-11-18).
- **FACT:** Trap catalogs are delivered, per provider, as four-field data entries — `trapName`, `providerBehavior`, `expectedNormalizedOutcome`, `fixtureReference` — with GitLab 3, Jira 7, GitHub 37 entries, replayed offline through the production clients by `tests/behaviour/providers/trap-harness.ts` (spec `feature-provider-client-seeds.md`, read 2026-11-18).
- **FACT:** The delivered trap suites are provider-scoped: each replays its own provider's fixtures and asserts its own provider's normalization. No suite asserts that two adapters classify the same condition into the same class (searched `tests/behaviour/providers/`, read 2026-11-18).
- **FACT:** The conformance skip vocabulary is already closed to `declared-gap`, `capability-absent`, and `live-read-only`, and the runner records an unsupported operation as a `declared-gap` skip carrying the adapter's own gap reason — an unsupported operation is never a failed step (`packages/testkit/src/conformance/runner.ts`, `packages/testkit/src/conformance/types.ts`, read 2026-11-18).
- **FACT:** The conformance suite compares an expected projection exactly and separates a classified failure from a projection mismatch by named assertion (`packages/testkit/src/conformance/runner.ts`, read 2026-11-18).

## Problem Framing (Clarified)

The blueprint writes four classes as if they were identities. They are not: they are *conditions*. Read that way, the question stops being "which codes do we add" and becomes two narrower questions:

1. **Is each blueprint class already distinguishable from the delivered structured data?** It is, and exactly: capability support is declared data with a reason; an HTTP 401/403 is a distinguishable status on a classified failure; a transport failure is the *absence* of a status on that same identity; a malformed or non-2xx payload is the same identity with a status. Nothing in the four classes requires an identity that does not exist. The blueprint's `tracker.*` strings are therefore best read as *class labels for a conformance assertion*, not as codes to emit.
2. **What makes the taxonomy a parity claim rather than a second vocabulary?** A class table is a claim only if it is paired with a fixture that produces it. So the taxonomy must be (class → delivered identity → the structured fields that decide it → the trap family that proves it), and the parity assertion must be: *the same trap-family fixture classifies into the same class on every adapter that supports the operation, or the adapter declares a gap, or the difference is registered under TDR-0036*.

Three failure modes decide the shape:

- **A second vocabulary.** If the classes become emitted codes, every consumer must learn them: projections, exit codes, envelopes, and the error-table sync check. That is a contract change wearing a test-suite costume, and it would give the project two names for one failure.
- **A prose catalog.** If the taxonomy lives as documentation ("GitLab classifies 401 as auth"), it cannot fail a build and drifts the moment a normalizer changes.
- **Silent non-coverage.** If a family is skipped because an adapter "cannot exercise it", the gate is vacuous exactly where a new adapter is weakest. A family an adapter cannot exercise must be a declared gap or a registered difference — never silence.

A second-order point decides the class *decision rule*: because the classes are decided by structured fields, the rule must be total. Any partial rule (a list of "interesting" statuses) leaves an unclassified remainder that someone will classify by prose. The record therefore declares a total projection over four observable outcomes plus the capability-gap case.

## Constraints (Hard Requirements)

### C-1: No new failure identity, no new domain kind, no new namespace

- **Statement:** No error-table row is added, `DOMAIN_KINDS` is unchanged, no `tracker.*` string becomes an emitted failure code, and the projection classes and exit codes are unchanged. The four class ids are testkit-local labels, declared in exactly one file — `packages/testkit/src/conformance/tracker-error-taxonomy.ts` — and no string literal beginning `tracker.` occurs anywhere else in the two source trees `packages/testkit/src/**` and `packages/adapters/src/**`. The pre-existing `tracker.*` vocabulary **outside** those two trees is out of scope, unchanged by this change, and neither evidence for nor against the taxonomy: the daily-status observation codes and their owner map (`packages/core/src/contracts/status.ts:87-93,116-152,175-181`), the doctor diagnostic codes (`packages/core/src/contracts/doctor.ts:129-156`), their domain and mapping sites (`packages/core/src/domain/status.ts`, `packages/core/src/domain/doctor.ts`), the status-collector row, and the `tracker` field names across core, CLI and MCP.
- **Source:** Result contract (adapter-local identity, `provider` kind inventory, CLI projection); additive-within-v1 discipline; GH-339 scope boundary; the delivered core vocabulary that makes a repository-wide absence claim false.
- **Verification:** Test — error-table row count and domain-kind inventory unchanged; a forbidden-literal scan whose scope is exactly those two source trees and whose allowlist is exactly that one file fails naming file and construct when a string literal beginning `tracker.` appears elsewhere in them; projection and exit-table tests unchanged.
- **Negotiable:** no.

### C-2: Every class maps onto an already-delivered identity

- **Statement:** Each class resolves to a delivered identity — the capability declaration, `provider.payload.invalid`, `provider.not-found`, or `config.credential.missing` — with the structured field that decides it. No class may resolve to "an exception" or "unclassified".
- **Source:** Delivered reference behavior and result contract.
- **Verification:** Test — the class table is total over the declared observable outcomes; a mutation control shows that removing a class leaves an outcome unmapped and fails.
- **Negotiable:** no.

### C-3: Every class is proven by a committed offline fixture

- **Statement:** Each class has at least one committed fixture per adapter that supports the operation the class is declared over, replayed through the production client with zero network calls and zero child processes, and asserted on the resulting classification. `tracker.capability.unsupported` is proven structurally (declaration plus `declared-gap` skip), not by a fixture.
- **Source:** M3 EC-4 ("including error taxonomy and trap catalogs"); OQ-M3-09 (offline CI); delivered trap-replay discipline.
- **Verification:** Test — family coverage gate: a family with no fixture, or a fixture with no family, fails naming both; replay assertions per family.
- **Negotiable:** no.

### C-4: No silence where a family cannot be exercised

- **Statement:** A family an adapter cannot exercise is a declared capability gap or a registered difference whose register entry's class set contains TDR-0036's `failure-classification` class. An absent family entry is a failure.
- **Source:** Delivered rule that an unsupported operation without a declared gap fails closed; the "never silence" requirement.
- **Verification:** Test — a mutation control removing a family fixture without a gap or a registered difference fails naming adapter, family, and operation.
- **Negotiable:** no.

### C-5: The four-field trap catalog is unchanged

- **Statement:** `tests/fixtures/providers/traps/*.traps.json` keeps its exact four-field entry shape and its per-provider minima; the taxonomy references fixtures, never a new catalog field.
- **Source:** `feature-provider-client-seeds.md` (trap-catalog entry contract and the structure tests that pin it).
- **Verification:** Test — the existing trap-catalog structure test unchanged and green; no new key in any catalog entry.
- **Negotiable:** no.

### C-6: Runtime-neutral taxonomy data

- **Statement:** The class table and the family declaration are pure data plus pure functions in `packages/testkit/src/conformance/`; fixture loading and any filesystem or environment access stay under `tests/`.
- **Source:** Conformance spec §Security and boundaries; testkit runtime-neutrality rules.
- **Verification:** Test — ambient-pattern source scan extended to the new module; no `node:*`/`bun:*` import.
- **Negotiable:** no.

### C-7: The taxonomy is provider-name-free

- **Statement:** The taxonomy module names classes, identities, structured fields, and family ids — never an adapter. Which adapter exercises which family is declared by fixture presence and by the matrix, not by a branch in the table.
- **Source:** TDR-0036 C-2 and TDR-0039's registration-only extensibility principle.
- **Verification:** Test — a provider-identity-literal scan over the taxonomy module, using TDR-0039 §2's binding identity-construct definition so the taxonomy and the extensibility scan share one definition rather than two readings.
- **Negotiable:** no.

## Decision Drivers

1. **One name per failure.** A failure should have exactly one machine identity in the system; a second vocabulary multiplies the places a consumer can be wrong.
2. **Falsifiability of "same taxonomy".** The claim is only worth making if a fixture forces each adapter to produce the class.
3. **Diagnosis at the trap, not at the suite.** A mismatch should name adapter, family, fixture, expected class, and received class.
4. **Paved road.** The delivered identities, trap replay harness, and conformance skip vocabulary already exist; new machinery must justify itself.
5. **Provider agnosticism.** The taxonomy must survive M3-S2/S3's transports (MCP, `glab`) without a table edit.
6. **Reversibility.** Adding or retiring a class must be a data change with no consumer impact.

*(Overlap check: single identity set, total mapping, fixture proof, no-silence, unchanged catalog, runtime-neutrality, and provider-agnosticism are gates (C-1…C-7) and appear here only as ranking values — "how much falsifiable taxonomy per unit of vocabulary". The gates decide eligibility; the drivers rank survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-339 clarify_scope routed this call here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (GH-339 scope; the finding that trap coverage is provider-scoped); `@decision-advisor` (analysis and record); `@spec-writer` (carry the table and the rule into the change spec).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-339; the owner for final acceptance.
- **Performers:** `@coder` (taxonomy table, family fixtures, replay assertions, coverage gate); `@doc-syncer` (trap-catalog note, conformance spec, result-contract pointer).
- **Informed:** M3-S2, M3-S3, M3-S4, and the consumers of adapter-local failure identities.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The four taxonomy class ids (`tracker.capability.unsupported`, `tracker.auth.rejected`, `tracker.transport.failed`, `tracker.payload.invalid`) occur nowhere in delivered code. | FACT | Repository search over `packages/**` (read 2026-11-18) | If they were delivered, this record would be a migration, not a mapping. | High |
| The two-tree scan starts from zero, and the pre-existing vocabulary it excludes is real and larger: 26 `tracker.` occurrences in `packages/core/src/contracts/status.ts` (21) and `contracts/doctor.ts` (5), plus their domain and mapping sites (`packages/core/src/domain/status.ts`, `packages/core/src/domain/doctor.ts`); a scan over `packages/*/src` would fail on delivered code before this change exists. | FACT | Repository search over `packages/**` (read 2026-11-18) | A repository-wide absence claim is unsatisfiable, so C-1's scope must be the two change-owned trees plus one allowlisted file. | High |
| `provider.payload.invalid` is adapter-local, unrowed, and projected as `platform-provider` at exit 2. | FACT | `doc/spec/features/feature-result-contract.md` (read 2026-11-18) | If it were a table row, the "no new row" argument would be about placement rather than identity. | High |
| `provider.auth.rejected` is a provider-**engine** (model provider) identity, explicitly distinct from adapter-local provider I/O. | FACT | `doc/spec/features/feature-result-contract.md` (read 2026-11-18) | If it were a generic auth identity, the auth class could map onto it, changing the decision. | High |
| Read classification distinguishes 404, other non-2xx (with `httpStatus`), and transport failure (no status). | FACT | `doc/spec/features/feature-adapter-reference-behavior.md` (read 2026-11-18) | Without the status/no-status distinction, `tracker.transport.failed` would need a new identity. | High |
| Adapter-local refusals before dispatch carry `provider.payload.invalid` with zero provider requests. | FACT | Reference behavior §Workflow mapping (read 2026-11-18) | If refusals had no identity, the workflow-state family would need one. | High |
| Trap catalogs are four-field entries replayed offline per provider, with no cross-adapter assertion. | FACT | `feature-provider-client-seeds.md`; `tests/behaviour/providers/trap-harness.ts` (read 2026-11-18) | If a cross-adapter assertion existed, the parity claim would be a coverage extension only. | High |
| The conformance runner records an unsupported operation as a `declared-gap` skip carrying the declared reason, never a failure. | FACT | `packages/testkit/src/conformance/runner.ts` (read 2026-11-18) | If it failed, `tracker.capability.unsupported` would need a failure identity. | High |
| Providers signal rate limiting with a status; the delivered classification reads only the structured status and never provider prose. | FACT (`GH-PAYLOAD-HTTP-STATUS` trap) | `feature-provider-client-seeds.md` (read 2026-11-18) | If prose were consulted, a rate-limit class could be derived from a message — forbidden here. | High |
| A provider that signals a rate limit with 403 is indistinguishable from an auth rejection by the structured fields the delivered clients expose. | ASSUMPTION (design consequence, not a provider claim) | Delivered classification reads `httpStatus` only | If a structured rate-limit discriminator existed, the taxonomy could carry a rate-limit class; it does not today (revisit trigger). | Medium-High |
| An MCP-mediated Jira transport can still supply a status-like structured outcome for its failures. | TO-CONFIRM (owner: M3-S2) | Not yet delivered | If a transport can only report success/failure with no structured status, its class assignment needs the `failure-classification` registered-difference path — not a taxonomy widening. | Low |
| One fixture per family per supported adapter is sufficient evidence, rather than one per operation. | ASSUMPTION | Boundedness of the fixture set | Under-coverage shows up as a family with no fixture, which the coverage gate fails naming adapter and family. | Medium |

## Mental Models & Techniques Used

- **First principles:** What is an error taxonomy *for*? So that a consumer can decide without reading provider prose. That requires (a) a total decision rule, (b) structured inputs, (c) one name per outcome. Only (c) was missing across adapters; (a) and (b) are delivered.
- **Inversion:** How does this go wrong? A second code namespace consumers must learn; a class that cannot be produced by any fixture; a family that is silently skipped on the adapters that need it most; a table that branches per provider; a trap catalog quietly extended with class ids. C-1…C-7 exclude each.
- **Second-order thinking:** Making the classes *labels* rather than *codes* keeps the blast radius at zero today and makes the future promotion path explicit: the day a consumer needs to branch on a class, that is an additive identity decision with a named consumer (ADR-0006's rule), not an accident of test naming.
- **Systems thinking:** The taxonomy sits between the provider normalizers (which produce identities) and the conformance comparison (which asserts equality). Putting it in testkit keeps the normalizers untouched and lets the assertion span adapters without either adapter importing the other's tests.
- **Opportunity cost:** A second vocabulary costs every consumer a mapping and every projection a case; the same effort spent on fixtures buys the cross-adapter claim the milestone actually asks for.
- **KISS:** four classes, six families, one total rule, one table.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 no new identity | C-2 delivered mapping | C-3 fixture proof | C-4 no silence | C-5 catalog unchanged | C-6 runtime-neutral | C-7 provider-free |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 do nothing | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| ALT-1 map onto delivered identities, prove by family fixtures (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 add four `tracker.*` error-table rows | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 reuse `provider.auth.rejected` for the auth class | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 prose taxonomy in the spec page, per-provider unit tests unchanged | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception. ALT-3 is eligible-with-exception but conflates two different provider notions (see below).

### Alternative 0 — Do Nothing

- **Eligibility:** Not eligible (fails C-2, C-3, C-4).
- **Summary:** Keep provider-local trap suites; leave the four blueprint classes as planning vocabulary.
- **Constraint compliance:** Satisfies the "no new identity" gate trivially and fails the claim gates: no cross-adapter taxonomy exists, no family is proven across adapters, and a family an adapter cannot exercise remains invisible.
- **Driver fit:** Fails 2, 3, and 5.
- **Pros:** Zero work; no new module.
- **Cons:** EC-4's error-taxonomy clause stays prose; M3-S2/S3 inherit no classification bar.
- **Why rejected:** It leaves the milestone clause unmet.

### Alternative 1 — One Closed Class Table Mapped onto Delivered Identities, Proven by Family Fixtures (chosen)

- **Eligibility:** Eligible.
- **Summary:** One testkit data module declares the four classes, the delivered identity each resolves to, the structured fields that decide the class, and the family id that proves it, plus a total class decision rule over capability-gap, adapter-refusal, no-response, and status outcomes; committed per-adapter family fixtures replay through the production clients; a parity assertion requires identical classes across adapters, or a gap, or a registered difference.
- **Constraint compliance:** C-1 (labels, not codes), C-2 (total rule over delivered outcomes), C-3 (fixture per class per supporting adapter), C-4 (gap or registered difference, never silence), C-5 (catalog untouched; taxonomy references fixtures), C-6 (data and pure functions), C-7 (no provider names).
- **Driver fit:** Best on all six: one name per failure (1), fixture-forced falsifiability (2), class-and-fixture diagnosis (3), delivered identities and harness reused (4), transport-agnostic table (5), data-only reversibility (6).
- **Pros:** The cross-adapter claim becomes mechanical; the blueprint's vocabulary is honored without entering the runtime vocabulary; the trap catalogs gain a conformance-level consumer without changing shape; a future promotion to a real identity has an explicit, recorded route.
- **Cons:** Two extra families beyond the blueprint's four are needed to make the rule total (transport failure had no named family; a malformed 2xx decode had none); a 403 rate limit classifies as auth, which is a declared limitation; the class table must stay in sync with the delivered reference behavior by review.
- **Why chosen:** It is the only eligible option that delivers the taxonomy clause without growing the contract or leaving a family unproven.

### Alternative 2 — Add Four `tracker.*` Error-Table Rows

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Make the blueprint's four strings real identities: new table rows, a new domain kind or namespace, projection and exit mappings, docs, and sync-check entries.
- **Constraint compliance:** Fails C-1 on every axis: four rows, a `DOMAIN_KINDS` member or a namespace, four projection cases, four documented rows, and a migration of every adapter site that currently returns `provider.payload.invalid`. It also collides with the existing `provider.auth.rejected` row's meaning (model provider) unless a new namespace is introduced.
- **Driver fit:** Strong on 1 (one canonical name) and weak on 4 and 6: five surfaces change for a test-suite claim.
- **Pros:** The blueprint's strings become true codes; consumers could branch on them later.
- **Cons:** Every adapter call site changes; every projection gains cases; the error table gains identities with no consumer; the milestone's additive boundary breaks.
- **Why rejected:** It inverts the milestone's own constraint — a conformance story would change the failure contract.

### Alternative 3 — Reuse `provider.auth.rejected` for the Auth Class

- **Eligibility:** Eligible-with-accepted-risk-exception.
- **Summary:** Map `tracker.auth.rejected` onto the existing `provider.auth.rejected` row rather than onto `provider.payload.invalid` with a 401/403 status.
- **Constraint compliance:** Passes C-1 mechanically (no new row) but takes an exception on C-2, because the delivered classification does not produce that identity for an adapter read: the row means the **AI-model provider engine** rejected a request, and the reference behavior classifies a tracker 401 as `provider.payload.invalid` with `httpStatus`. Mapping the class onto it would either change every adapter's classification (a real behavior change for a test-suite claim) or make the table describe behavior that does not occur.
- **Driver fit:** Good on 1, poor on 2 (the table must describe delivered behavior) and 3 (a mismatch would report an identity no adapter emits).
- **Pros:** Reuses a row whose name reads correctly.
- **Cons:** Conflates two provider notions the result contract deliberately separates; would require adapter changes to make it true.
- **Why rejected:** It is a naming convenience bought with a behavior change and a semantic collision.

### Alternative 4 — Prose Taxonomy with Unchanged Per-Provider Trap Suites

- **Eligibility:** Not eligible (fails C-3 and C-4).
- **Summary:** Document the class mapping in the spec page and rely on the existing provider-scoped trap suites.
- **Constraint compliance:** Passes C-1, C-2, C-5, C-6, C-7; fails the proof and no-silence gates — nothing asserts that two adapters classify alike, and a missing family is invisible.
- **Driver fit:** Weak on 2 and 3.
- **Pros:** No new code; fastest to write.
- **Cons:** The claim is unfalsifiable; drift shows up as a delivery failure instead of a test.
- **Why rejected:** Documentation cannot be the proof of a parity claim.

## Decision

- **Decision:** Adopt ALT-1. The four blueprint tracker-error classes become one closed classification table in testkit, mapped onto delivered identities and proven by committed trap-family fixtures. The parity assertion is cross-adapter classification agreement, not a new identity set.

### 1. The class table (closed)

The table lives as declared data in `packages/testkit/src/conformance/tracker-error-taxonomy.ts` — the single file the namespace-absence scan allows, so a class id is written in exactly one place and every other occurrence of a `tracker.` literal is a failure (C-1).

| Class id | Resolves to (delivered) | Structured fields that decide it | Proving family |
|---|---|---|---|
| `tracker.capability.unsupported` | the capability-gap declaration — operation plus a closed `CapabilityGapReason`; **never a failure** | the operation is absent from `supportedOperations` and present in `declaredGaps` | structural: the coverage gates plus the runtime `declared-gap` encounter rule (no fixture family) |
| `tracker.auth.rejected` | `provider.payload.invalid` | `httpStatus` ∈ {401, 403}; a missing credential stays `config.credential.missing` and is outside the tracker taxonomy | `auth-shape` |
| `tracker.transport.failed` | `provider.payload.invalid` with **no** `httpStatus` | the failure carries no provider response | `transport-failure` |
| `tracker.payload.invalid` | `provider.payload.invalid` | `httpStatus` present and outside {401, 403}; or an adapter-local named refusal with zero requests; or an undecodable 2xx body | `rate-limit`, `payload-shape`, `workflow-state-mismatch` |

A read's explicit 404 remains `provider.not-found` — a definitive absence outcome, deliberately **outside** the taxonomy, because it is not an error class but a truthful observation.

### 2. The class decision rule (total)

Classification is a total projection over five observable outcomes, evaluated in this order, with no prose input and no provider branch:

1. **capability gap** — the operation is unsupported with a declared reason → `tracker.capability.unsupported`; the conformance result is a `declared-gap` skip, never a failure.
2. **adapter refusal** — a named refusal raised before dispatch, zero provider requests → `tracker.payload.invalid`.
3. **no response** — the transport failed or timed out, so no status exists → `tracker.transport.failed`.
4. **status present, 404 on a read** → `provider.not-found` (absence, outside the taxonomy).
5. **status present otherwise** — 401/403 → `tracker.auth.rejected`; any other status, or a 2xx whose body does not decode → `tracker.payload.invalid`.

A 2xx that decodes is a success and is not classified. Write classification keeps the delivered write rule unchanged: a write's 404 classifies as `tracker.payload.invalid`, so the absence promotion stays read-scoped and no write is ever reported as "not found".

### 3. Trap families (six, each with a declared class outcome)

| Family | Proves | Declared outcome |
|---|---|---|
| `auth-shape` | credential and authorization rejection shapes (401, 403) | `tracker.auth.rejected` |
| `transport-failure` | a request that produced no response (aborted, timed out) | `tracker.transport.failed` |
| `rate-limit` | a throttled response (429 and provider-specific throttling statuses) | `tracker.payload.invalid` |
| `payload-shape` | a 2xx body that does not decode, and a non-2xx error body whose prose contradicts its status | `tracker.payload.invalid` |
| `workflow-state-mismatch` | an unresolvable native state on read, and a transition the declared mechanism cannot perform | `tracker.payload.invalid`, asserted with zero provider requests |
| `pagination-truncation` | a bounded read's **declared page bound** plus **whether it reports a page count** — GitHub `readPipelineRun(commitSha, limit = STATUS_SOURCE_PIPELINE_LIMIT)` returns `{ items, pageItemCount }`; GitLab returns a bare `readonly PipelineRun[]` with no bound and no count. No closed-operation view carries a truncation flag. | **not an error class**: a `bounded-observation` assertion, never an error classification. Its three postures: GitHub `covered`; GitLab `recorded-difference` through `pagination-model` on `(gitlab, read-pipeline-run)`; Jira `gap-backed` on its `provider-unsupported` `read-pipeline-run` gap. |

The blueprint's four families are all present; `transport-failure` and `payload-shape` are added because otherwise `tracker.transport.failed` and the malformed-decode branch of `tracker.payload.invalid` would be classes with no proof. The taxonomy set is closed and additive only by a recorded extension.

**Reconciliation note (specification obligation).** The M3 contract names four families, and a change specification written against that list will name four. That list leaves one declared class with no possible proof: nothing among rate limits, auth shapes, pagination truncation, or workflow-state mismatch produces a *transport* failure, so `tracker.transport.failed` would be a class no fixture can ever exercise — and a row with no proof is exactly the prose taxonomy C-3 forbids. This record therefore declares six families, and the change specification must carry six family rows. Where the specification and this record disagree on the family count, this record is the decision and the specification is the place to reconcile it; a readiness finding of four rows has found the reconciliation gap, not a second decision. The class table (four classes) is unchanged either way.

### 4. Fixture and coverage rule

- One committed fixture per family per adapter **whose posture is `covered`**, for one declared operation the family is meaningful for, replayed through the production client with an injected transport and no live network or child process.
- A family names its operation, and every adapter holds exactly one posture per family: `covered` (the committed fixture above), `gap-backed` (that operation is a declared gap on that adapter, with the exact reason), or `recorded-difference` (the family is not observable on that adapter and a register entry's class set explains why — GitLab's `pagination-truncation` is `recorded-difference` through `pagination-model` on `(gitlab, read-pipeline-run)`). The coverage gate fails when the operation is a declared gap on that adapter while the posture is not `gap-backed`, and fails when an adapter has neither a fixture nor a declared posture for a family.
- The taxonomy table contains no provider name; which adapter proves which family is decided by fixture presence and by the parity matrix (TDR-0036), never by a branch in the table.

### 5. The parity assertion

For each family: every adapter that supports the family's operation classifies the fixture into the declared class, or records the operation as a declared gap, or carries a register entry whose class set contains TDR-0036's `failure-classification` class and which names the structured field that decides it. A disagreement that is none of those three is a failure naming adapter, family, fixture, expected class, and received class.

### 6. Explicit non-decisions

- **No error-table row.** No identity is added; no `DOMAIN_KINDS` member; the table's row count is unchanged.
- **No new namespace.** The four `tracker.*` strings are testkit labels and never appear as an emitted failure code, an envelope identity, a CLI projection input, or an exit-code case. They are written in exactly one file inside the two change-owned source trees; the pre-existing `tracker.*` vocabulary outside those trees belongs to daily status and doctor and is untouched (C-1).
- **No change to projection classes or exit codes.** `provider.payload.invalid` keeps its `platform-provider` projection at exit 2; `provider.not-found` keeps its read-scoped role.
- **No change to the trap-catalog entry shape.** Four fields per entry, unchanged per-provider minima, unchanged replay harness.
- **No provider behavior is normalized differently.** This record adds classification assertions over delivered behavior; it does not change what any adapter returns.

- **Rationale (tied to drivers):** One name per failure is preserved because the classes resolve to identities the system already has (driver 1), the claim becomes falsifiable because every class carries a fixture (driver 2), a mismatch is diagnosable at adapter-family-fixture granularity (driver 3), the delivered identities and replay harness are reused rather than replaced (driver 4), the table is transport-agnostic (driver 5), and the taxonomy is data (driver 6).
- **Decider:** Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review; this record stays `Proposed` until then.
- **Conditions for revisit:** See `revisit_triggers`, notably a provider whose rate limiting is signalled with 403, and any consumer that needs to branch on a class.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 through C-7. No accepted-risk exceptions are taken.

Four consequences are recorded rather than treated as exceptions:

- The taxonomy is a *projection* over delivered classification, so it inherits the delivered limits: a rate limit signalled with 403 classifies as `tracker.auth.rejected`, and the record says so instead of inventing a discriminator the clients do not expose (C-2, revisit trigger).
- Two families beyond the blueprint's four are declared so that every class has a proof; the blueprint's four remain, and none is dropped (C-3).
- `tracker.capability.unsupported` is proven structurally rather than by a fixture, because a capability gap is declared data and the conformance result is already a `declared-gap` skip; a fixture would be a second, weaker statement of the same fact (C-3).
- The class ids are deliberately not identities; the day a consumer needs one, that is a separate additive decision with a named consumer, so no behavior is pre-committed here (C-1).

## Trade-offs & Consequences

### Positive Outcomes

- The error-taxonomy clause of EC-4 becomes mechanical across adapters without any contract growth.
- The four blueprint classes gain a total, structured decision rule, so a future adapter author has one table to satisfy instead of provider-specific prose.
- Trap catalogs gain a conformance-level consumer while keeping their four-field shape.
- A missing family on a new adapter fails a gate instead of waiting for a delivery incident.
- The promotion path to a real identity is explicit and owned by a future decision with a named consumer.

### Negative Outcomes

- A 403-signalled rate limit is classified as an auth rejection; the taxonomy cannot distinguish them with the structured fields the delivered clients expose.
- Six families × three adapters is a bounded but real fixture and assertion surface, and `payload-shape` fixtures are the easiest to write badly (a fixture that proves only that JSON parsing fails).
- The class table must stay consistent with the reference-behavior page by review; no gate compares the two documents.
- Because class ids are not codes, an operator reading an artifact sees identities, not classes — the class vocabulary lives in the spec and the tests.

### Unresolved Questions

- [ ] Whether a structured rate-limit discriminator exists that the delivered clients could expose without a behavior change (owner: `@decision-advisor` on the first 403-classified rate-limit trap).
- [ ] Whether the taxonomy should be asserted against the live tier's recorded failures as well as the mock tier (owner: `@coder`; default is mock-only, because the live tier is read-only evidence and not a merge gate).
- [ ] Whether `provider.not-found` should be named in the taxonomy as a documented "outside the taxonomy" outcome rather than only in prose (owner: `@spec-writer` at GH-339 specification).
- [ ] Whether an MCP-mediated Jira transport can supply a status-like structured outcome, which decides whether M3-S2 needs a registered `failure-classification` difference (owner: M3-S2).
- [ ] Whether the change specification's family list is reconciled to six rows (the four blueprint families plus `transport-failure` and `payload-shape`) or whether the taxonomy is reduced to four families with `tracker.transport.failed` left unproven (owner: `@pm` / `@readiness-reviewer` at the GH-339 DoR gate; this record's position is stated in §3's reconciliation note).

## Implementation Notes and Constraints

1. **Taxonomy module.** One data module in testkit: the four classes, their delivered identity, the deciding structured fields, the closed family set, each family's declared outcome and representing operation, and the total decision rule as a pure function over the five outcomes.
2. **Fixtures.** Committed per-family, per-adapter fixtures under the conformance fixture tree, replayed through the registration's client builder with the injected transport; the throwing-`fetch` and child-process guards assert zero calls.
3. **Assertions.** A behaviour test replays each family and asserts the resulting identity, the structured `httpStatus` presence/value where applicable, the zero-request property for refusals, and the class via the decision rule.
4. **Coverage gate.** A structure test enforces the family ↔ fixture ↔ adapter posture bijection and fails naming adapter, family, and operation.
5. **What must not change.** The error table, `DOMAIN_KINDS`, projection classes, exit codes, the four-field trap catalog shape, and any adapter's returned identity. An edit to any of these means the decision is being widened.

## Verification Criteria

- Metric: identity inventory — error-table row count, `DOMAIN_KINDS` membership, projection classes, and exit codes unchanged — Target: exact — Window: GH-339 CI.
- Metric: namespace absence — zero string literals beginning `tracker.` in `packages/testkit/src/**` and `packages/adapters/src/**` outside the single allowlisted file `packages/testkit/src/conformance/tracker-error-taxonomy.ts`; the pre-existing core/CLI/MCP vocabulary is out of scope and unchanged; the sync check and forbidden-literal scan stay green — Target: zero outside the allowlist — Window: GH-339 CI.
- Metric: mapping totality — every declared outcome maps to exactly one class; removing a class leaves an unmapped outcome and fails a control — Target: exact — Window: GH-339 CI.
- Metric: family coverage — for each adapter, each family has either a fixture over a supported operation or a declared posture (gap or registered difference); a mutation removing one fails naming adapter, family, operation — Target: 100% — Window: GH-339 CI.
- Metric: cross-adapter agreement — every family classifies identically on every supporting adapter, or the difference is registered — Target: exact — Window: GH-339 CI.
- Metric: offline proof — zero live network calls and zero live child processes during family replay — Target: zero — Window: GH-339 CI.
- Metric: trap-catalog integrity — four-field entries, per-provider minima, and bidirectional coverage unchanged — Target: exact — Window: GH-339 CI.

## Confidence Rating

**High** for the mapping: the delivered identities, the status/no-status distinction, the adapter-local refusal identity, the `declared-gap` skip semantics, and the `provider.auth.rejected` semantic collision are all verified in the repository, so the "no new identity" decision rests on delivered facts rather than preference. **Medium** for the family set and the 403 rate-limit limitation: the blueprint does not name fixtures for transport failures or malformed bodies, so those two families are inferred from the classes they must prove, and the rate-limit/auth ambiguity is a property of the providers' structured surface rather than of this record.

## References

- GH-339 change workspace (gap analysis: trap coverage provider-scoped, no conformance-level catalog): `doc/changes/2026-11/2026-11-18--GH-339--adapter-conformance-parity/chg-GH-339-pm-notes.yaml`
- M3 contracts — the four typed refusals and the four trap families: `doc/planning/oss-tooling/milestones/m3/contracts.md`
- M3 blueprint — EC-4, M3-S5 AC, offline-CI risk: `doc/planning/oss-tooling/milestones/m3/README.md`
- M3 open questions — OQ-M3-09 (simulated double required; CI runs offline): `doc/planning/oss-tooling/milestones/m3/open-questions.md`
- Delivered failure identities, absence semantics, and the zero-request refusal rule: `doc/spec/features/feature-adapter-reference-behavior.md`
- Adapter-local identity, the `provider` kind inventory, and the `platform-provider` projection: `doc/spec/features/feature-result-contract.md`
- Trap-catalog entry contract, per-provider minima, and replay discipline: `doc/spec/features/feature-provider-client-seeds.md`
- Conformance skip vocabulary, declared-gap skips, exact projection comparison: `doc/spec/features/feature-adapter-conformance.md`, `packages/testkit/src/conformance/runner.ts`
- Delivered trap replay harness: `tests/behaviour/providers/trap-harness.ts`, `tests/fixtures/providers/traps/*.traps.json`
- [TDR-0036](TDR-0036-cross-adapter-parity-matrix-declared-difference-register.md) — the matrix whose failure-classification dimension this taxonomy supplies
- [TDR-0032](TDR-0032-github-adapter-cli-first-provider-transport.md) — the adapter-local refusal vocabulary and transport-failure classification precedent
- [ADR-0006](ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) — the named-consumer rule that governs any future promotion of a class into a real identity

## Revision

### 2026-11-18 — scan scope, class-set wording, shared identity definition (readiness iteration 1)

- **Status:** unchanged — `Proposed`, `decision_date: null`. The owner accepts or rejects this record at the GH-339 PR review; this revision grants no authority and records no acceptance.
- **Trigger:** GH-339 readiness review iteration 1 (`doc/changes/2026-11/2026-11-18--GH-339--adapter-conformance-parity/readiness-review/readiness-iter-1.md`), finding **10** (scan scope), with findings **6a** and **1/12** carried as coherence with the records they touch.
- **What this record had wrong (finding 10).** C-1 and the namespace-absence verification required "zero `tracker.` literals in production source outside the testkit taxonomy module" over `packages/*/src`. That requirement is unsatisfiable before this change ships: `packages/core/src/contracts/status.ts` carries 21 `tracker.` occurrences (the daily-status observation codes and their owner map, lines 87-93, 116-152, 175-181) and `packages/core/src/contracts/doctor.ts` carries 5 (lines 129-156), with their domain and mapping sites in `packages/core/src/domain/status.ts` and `domain/doctor.ts`. A reader of this record as authority would have written a gate that fails on delivered code, or widened the allowlist until the claim meant nothing.
- **Corrected statement now carried by this record.** C-1's absence claim is scoped to exactly the two change-owned source trees — `packages/testkit/src/**` and `packages/adapters/src/**` — with exactly one allowlisted file, `packages/testkit/src/conformance/tracker-error-taxonomy.ts`, and it states that the pre-existing core vocabulary (daily status, doctor, the status-collector row, and the `tracker` field names across core, CLI and MCP) is out of scope and unchanged by this change. The substantive half of C-1 is unchanged: no error-table row, no `DOMAIN_KINDS` member, no emitted `tracker.*` code, no projection class, and no normalized-view or artifact occurrence.
- **Coherence edits carried with it.** (a) C-4 and §5 now say a registered difference is a register entry **whose class set contains** TDR-0036's `failure-classification` class, because TDR-0036's entry now carries a non-empty set of classes rather than one class (readiness findings 1 and 12). (b) C-7's verification names TDR-0039 §2's binding identity-construct definition, so the taxonomy scan and the extensibility scan share one definition instead of two readings (readiness finding 6a). (c) An evidence row records the excluded vocabulary and its count, so the scope decision is auditable rather than implicit.
- **Sections amended:** C-1 (statement, source, verification); C-4 statement; C-7 verification; Decision item 1 (the taxonomy file is named as the scan's single allowed file); Decision item 5 (class-set wording); Decision item 6 (the no-new-namespace bullet states the scope); the Evidence table (one row tightened to the four class ids, one row added for the excluded vocabulary); Verification Criteria (namespace absence). The class table, the decision rule, the family set, the four-class mapping, the alternative set, the DACI assignment and the status are unchanged.
- **Follow-ups not made here:** the change specification's AC-F2-1/DM-3/NFR-3 already state the two-tree scope with the single-file allowlist and are the current truth this record now matches; no spec, test-plan, plan, or code file was changed by this revision.

### 2026-11-18 — `pagination-truncation` observable restated (readiness iteration 3)

- **Status:** unchanged — `Proposed`, `decision_date: null`. The owner accepts or rejects this record at the GH-339 PR review; this revision grants no authority and records no acceptance.
- **Trigger:** GH-339 readiness review iteration 3 (`readiness-review/readiness-iter-3.md`), **major, persistent** decision-capture finding 1 (first raised as iteration 2's finding 3 and carried unchanged), against Decision §3's family table.
- **What this record had wrong.** The `pagination-truncation` row defined the family as "a page-limited read and its truncation signal", proven "by absence/truncation assertions". No closed-operation view declares a truncation signal: `WorkItem`, `DeliveryRequest`, and `PipelineRun` carry none, GitHub's pipeline read returns `{ items, pageItemCount }` from a default-limited request (`readPipelineRun(commitSha, limit = STATUS_SOURCE_PIPELINE_LIMIT)`) while GitLab's returns a bare `readonly PipelineRun[]` with no bound and no count (`packages/adapters/src/gitlab/client.ts:38-39,106-112`). A coder reading this row as the authority for the family vocabulary would have asserted a signal that does not exist — the defect iteration 1 raised against the specification and iteration 2's specification fixed.
- **Corrected statement now carried by this record.** The family observes a bounded read's **declared page bound** plus **whether a page count is reported**, and it remains a `bounded-observation` assertion rather than an error class. Its three postures are named in the row: GitHub `covered`, GitLab `recorded-difference` through `pagination-model` on `(gitlab, read-pipeline-run)`, Jira `gap-backed` on its `provider-unsupported` `read-pipeline-run` gap. §4's fixture-and-coverage rule now names the same three postures — `covered` (a committed fixture), `gap-backed` (that operation is a declared gap on that adapter, with the exact reason), and `recorded-difference` (the family is not observable on that adapter and a register entry's class set explains why) — so the row and the coverage rule cannot disagree about what an adapter owes for a family. The four tracker classes, the six families, the class table, the decision rule, §5's parity assertion, the alternative set, the DACI assignment and the status are unchanged.
- **Sections amended:** Decision §3 family table, `pagination-truncation` row; Decision §4, bullets 1–2 (the fixture-per-adapter rule scoped to `covered`, and the three-posture rule named); plus this revision entry. No other line of the record changed.
- **Follow-ups not made here:** the specification (F-2, DM-4, AC-F2-7) and the test plan (TC-TAX-008) already state this observable and these postures in v1.3, and the plan's phase-3 obligations reference them; no spec, test-plan, plan, or code file was changed by this revision.

