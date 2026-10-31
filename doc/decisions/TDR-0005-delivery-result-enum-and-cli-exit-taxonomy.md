---
ados_distribution: project-generated
id: TDR-0005
decision_type: tdr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "Adopt the eleven-token bash-era delivery result enum as the single typed CLI vocabulary bound to the result-contract projection classes, with one deliberate divergence: state-unverified maps to platform-provider (exit 2) where bash exits 1. Token-level parity, not numeric exit parity, is the dual-run comparison unit."
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os CLI verification
decision_scope: repo
review_date: null
classification:
  domains: [tooling, architecture]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@pm"
  decider: "Juliusz Ćwiąkalski (human acceptance pending)"
  contributors: ["@decision-advisor", "@spec-writer"]
  reviewers: ["@reviewer", "@readiness-reviewer", "Human owner (PR review)"]
  performers: ["@coder"]
  informed: []
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A dual-run evaluator or downstream consumer ever requires numeric exit parity for state-unverified; that requires a deliberate result-contract change (a new or remapped projection class), never a call-site exit override."
  - "The bash reference moves or its usage enum changes; the binding structure test fails closed and this taxonomy must be re-derived deliberately."
  - "A token needs a different projection class, a twelfth token, or an exit outside {0, 1, 2}."
  - "M0-S19/M1-S9 evidence collectors land and the seven reserved tokens need derivation updates or reachable-subset changes."
  - "A future command wants to diverge from token-level parity, reopening the CLI-wide vocabulary decision."
links:
  related_changes: [GH-177, GH-172]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-10/2026-10-31--GH-177--verify-change-exit-taxonomy/chg-GH-177-spec.md"
    - "doc/spec/features/feature-result-contract.md"
  contracts:
    - "packages/core/src/contracts/error-table.ts"
    - "packages/cli/src/projection.ts"
  diagrams: []
  decisions: [ADR-0003]
---

# TDR-0005: Delivery Result Enum and CLI Exit Taxonomy

## Context

- **FACT:** The bash-era delivery loop classifies every run into an eleven-token result enum that exists only inside `scripts/deliver-ticket.sh`: the usage block (circa line 2322) pins the vocabulary and its order — `merged | blocked | pr-open | pr-open-unverified | failed | finished | max-restarts | state-unverified | partial | noop-lane-permission | noop-lane-nothing-to-do` — produced by `print_delivery_summary` (circa lines 2097–2113) and the `classify_result` family (circa lines 1300–1400).
- **FACT:** Bash exit semantics: `0` for `merged`, `blocked`, `pr-open`, `pr-open-unverified`, PM `finished`, and `noop-lane-nothing-to-do`; `1` for `failed`, `max-restarts`, `partial`, `noop-lane-permission`, **and `state-unverified`** (tracker state fetch failed after retries); `2` for usage errors (usage block, "Exit codes").
- **FACT:** The typed CLI result contract is binding (GH-172, `doc/spec/features/feature-result-contract.md`, status Current): exit codes are a projection of the error table — `success`→`0`, `user-validation`→`1`, `platform-provider`→`2` — and exit digits exist only in `packages/cli/src/projection.ts`, which rejects unknown projection classes; the `exit-code-literals` invariant forbids call-site exit literals everywhere else. Handlers never choose exits.
- **FACT:** `fallback.invocation` (broken invocations, unknown commands) is `user-validation` → exit `1` in the CLI today; bash uses exit `2` for usage errors. This predates the present decision and is unchanged by it.
- **FACT:** The platform-category state rows (`state.store.torn`, `state.schema.mismatch`, `state.keys.missing`) project `platform-provider` → exit `2`; the user-category state rows (`state.permission.denied`, `state.level.unsupported`) project `user-validation` → exit `1` (documented error table).
- **FACT:** GH-177 (M0-S8) introduces the ledger-only, read-only `ados verify change <ref>`. Its spec records the exit-taxonomy choice as DEC-5 ("`state-unverified` projects to `platform-provider` → exit `2`; bash's exit `1` is not reproduced. Token parity is the dual-run comparison unit… **Recommend a decision record** ratifying token-level parity CLI-wide"), DEC-11 (broken invocations ride `fallback.invocation` → exit `1`), C-4/C-5 (enum and taxonomy tables), AC-V8/AC-V9 (totality and non-zero guarantee), and RSK-3 (dual-run numeric-comparison risk). This record is that decision record.
- **Trigger:** M0-S8 must land the typed vocabulary now, and M0-S9 (`verify gates`), M1-S7, and M1-S9 (dual-run evidence) consume the verdict — the vocabulary choice determines how they interpret results.
- **Classification note:** TDR/R2. The ADR-vs-TDR tie is resolved to TDR (recorded here per Decision-Making Guide §7): the governing architecture — exit codes as a projection of the binding result contract — is already Accepted (ADR-0003 lineage, GH-172 spec); this decision selects a vocabulary and its projection binding *within* that architecture, and it is additive and reversible (data plus one documented row). TDR-0002 (Accepted, `blast_radius: team`) is the precedent for a team-scope TDR.

## Problem Framing (Clarified)

The typed CLI needs one delivery-result vocabulary so that `verify` classifies outcomes and downstream consumers (M0-S9, M1-S7, M1-S9) compare dual-run evidence like with like. The bash enum is the normative vocabulary, but its exit assignment predates the typed result contract: bash gives `state-unverified` exit `1` (a user-category digit in the CLI's model) for what is, in the typed CLI, a platform-category registry/store failure. Reproducing bash exits numerically would require an exit override outside the projection module — precisely the exit-code folklore the result contract eliminates. The problem is therefore not "which exit digit per token" but "which projection class each token's identity already carries", plus an explicit, documented answer to the one token where the two models disagree.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Exit digits exist only in the CLI projection module; every exit is the projection of a declared error-table projection class; no call-site or per-command exit override exists. | GH-172 result contract (Current spec); `packages/cli/src/projection.ts` | `exit-code-literals` invariant, projection tests, code review | no |
| C-2 | The taxonomy is total over exactly the eleven bash-era tokens (set and order equal to the bash usage enum), each with exactly one projection class and one derivation class. | GH-177 AC-V8, NFR-5, DEC-3 | structure test extracting the bash usage enum (fails closed if the reference is missing) | no |
| C-3 | Non-zero guarantee: exit `0` occurs only for a fully verified `finished` outcome; incomplete, malformed, missing-target, and unverifiable outcomes never exit `0`. | GH-177 AC-V9, NFR-3 | exhaustive rejection matrix asserting `exit != 0` and error-only envelopes | no |
| C-4 | No exit outside `{0, 1, 2}`; no `CommandResult` envelope shape change; the addition is v1-additive (one new error row with its documented row in the same change). | GH-177 NG-5; result-contract evolution discipline | error-table sync check, envelope conformance validator | no |
| C-5 | The enum is declared once as `as const` data in `core ./contracts` (runtime-neutral, data and types only); no other production module declares a token list. | GH-177 DEC-3 and the single-enum-home invariant; ADR-0003 tier rules | `verify-imports` structure test, boundary/dependency-cruiser gates | no |

## Decision Drivers

1. **Dual-run comparability (M1-S9):** the typed verdict and the bash summary must be comparable in a single, well-defined comparison unit.
2. **Contract consistency:** exits derive from identity projection classes; no command-family gets a private exit policy.
3. **Totality and determinism:** every outcome maps to exactly one token, one projection class, and one exit; reserved outcomes are declared, not implicit.
4. **Low ceremony / reversibility:** the smallest additive change — data plus one documented row — that kills the exit-zero false-success class at the verification layer.
5. **Consumer clarity:** agents and scripts branch on tokens and error identities, not on exit-number folklore.

Drivers rank survivors; C-1…C-5 above are gates, not scoring factors.

## Decision Rights (DACI)

- **Driver:** @pm; **accountable human decider:** Juliusz Ćwiąkalski; **contributors:** decision advisor, spec writer; **performer:** @coder.
- **Required review:** delivery reviewer, readiness reviewer, and human owner acceptance at PR review. **Informed:** later consumer stories (M0-S9, M1-S7, M1-S9).
- **Timing:** recorded during GH-177 delivery, before the contracts module lands. Implementation, tests, and an unmerged PR may proceed with acceptance pending (TDR-0003/TDR-0004 precedent); the spec's open-questions section explicitly states ratification is not required before delivery because the decision is reversible and encoded as data plus one documented row.
- **Acceptance:** no owner approval is claimed by this record. Set `decision_date` and `review_date` only on human acceptance; status remains **Proposed**.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false / confidence |
|---|---|---|---|
| Bash usage enum lists exactly the eleven tokens in the order `merged…noop-lane-nothing-to-do`. | FACT | `scripts/deliver-ticket.sh` usage block (circa line 2322), read 2026-10-31 | Vocabulary/order binding breaks; the AC-V8 structure test would fail closed; high |
| Bash exits `1` for `state-unverified` and `2` for usage errors. | FACT | `scripts/deliver-ticket.sh` usage "Exit codes" block and `classify_result` family, read 2026-10-31 | The documented divergence premise would be wrong; high |
| The CLI projection maps `success`→`0`, `user-validation`→`1`, `platform-provider`→`2`, rejects unknown classes, and is the only module permitted to contain exit literals. | FACT | `packages/cli/src/projection.ts`; result-contract spec | Any alternative needing an override violates the contract; high |
| `fallback.invocation` is `user-validation` → exit `1`; `state.store.torn`, `state.schema.mismatch`, `state.keys.missing` are `platform-provider` → exit `2`. | FACT | documented error table in `feature-result-contract.md` (sync-checked against `ERROR_TABLE`) | Broken-invocation and registry-failure exits would differ; high |
| `scripts/deliver-ticket.sh` remains present through the M1-S9 dual-run period as the normative enum reference. | ASSUMPTION | GH-177 spec assumptions | If it moves, the binding structure test fails closed and must be updated deliberately; high |
| Token-level parity suffices for dual-run evaluation; no current consumer requires numeric exit equality. | ASSUMPTION | GH-177 RSK-3 mitigation; M1-S9 is design-stage | If false, a deliberate result-contract change is needed (revisit trigger); medium |
| M0-S9/M1-S7/M1-S9 will consume tokens (not raw exit digits) as the verdict unit. | TO-CONFIRM | those stories' designs | A consumer that hardcodes bash's `state-unverified` exit `1` would misread exit `2`; confirm at each story's design review; medium |

## Mental Models & Techniques Used

- **Inversion:** how does false success happen? An unverifiable outcome riding a `0`/`1` exit that callers read as "not a platform problem". The taxonomy makes every non-verified token a non-zero, class-projected failure.
- **Single source of truth:** one enum, one taxonomy, one exit-projection module; bash stays the external reference, never a second implementation.
- **Eligibility-first comparison:** constraints (projection ownership, totality) eliminated alternatives before driver ranking.
- **Second-order thinking:** what do dual-run evaluators do when exits differ on one token? They must compare tokens — so the comparison unit is made explicit and the divergence is documented rather than discovered.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| Alternative | C-1 | C-2 | C-3 | C-4 | C-5 | Eligibility |
|---|---|---|---|---|---|---|
| ALT-0: do nothing (no typed vocabulary) | pass | fail | fail | pass | fail | Not eligible |
| ALT-1: bash numeric parity (`state-unverified` → exit `1`) | fail | pass | pass | pass | pass | Not eligible (fails C-1, `negotiable: no`) |
| ALT-2: token parity + projection binding (selected) | pass | pass | pass | pass | pass | Eligible |
| ALT-3: new verify-only exit policy (per-token exits / usage exit `2`) | fail | pass | pass | fail | pass | Not eligible |

### Alternative 0 — Do Nothing / Keep Current Approach

- **Summary:** The enum remains bash-internal; the CLI has no delivery-result vocabulary and `verify` would need an ad-hoc, verify-local classification.
- **Constraint compliance:** fails C-2 (no total taxonomy) and C-5 (no single contracts home); also fails C-3's testability.
- **Driver fit:** worst — no dual-run comparability, drift guaranteed.
- **Why rejected:** the vocabulary choice is exactly what M0-S8 exists to make; inaction recreates the false-success class in new tooling.

### Alternative 1 — Bash Numeric Parity for `state-unverified` (exit `1`)

- **Summary:** Adopt the eleven tokens but reproduce bash's exit digits exactly, forcing `state-unverified` to exit `1`.
- **Constraint compliance:** fails C-1 — the platform-category `state.*` identities project `platform-provider`; an exit `1` requires an exit override outside the projection module, the exact call-site folklore the contract forbids.
- **Driver fit:** good on driver 1 only if "parity" means digits; but it breaks driver 2 (contract consistency) and driver 5 (a user-category digit on a platform failure misleads agents about retryability).
- **Pros:** numeric drop-in compatibility for existing bash-exit consumers.
- **Cons:** duplicates exit policy; corrupts the class→exit mapping; a hand-picked exit is untestable against the table.
- **Why rejected:** disqualifying constraint violation (C-1, `negotiable: no`), per GH-177 DEC-5.

### Alternative 2 — Token Parity with Projection-Class Binding (selected)

- **Summary:** Adopt the eleven tokens verbatim (set and order) as `as const` data in `core ./contracts` with a total per-token taxonomy (projection class, derivation class, M0-S8-reachable subset); exits come solely from each token's identity projection class. `state-unverified` rides `platform-provider` → exit `2`; token-level parity is the dual-run comparison unit.
- **Constraint compliance:** passes C-1…C-5 by construction (exits derived, taxonomy total, only `finished` exits `0`, additive row, single contracts home).
- **Driver fit:** best — explicit comparison unit (driver 1), zero exit-policy duplication (driver 2), total and deterministic (driver 3), minimal additive surface (driver 4), consumers branch on tokens (driver 5).
- **Cons:** one documented numeric divergence from bash (`state-unverified`: bash `1`, CLI `2`).
- **Why chosen:** see Decision.

### Alternative 3 — New Verify-Only Exit Policy

- **Summary:** Give `verify` its own exit policy — e.g., per-token exit digits or a bash-style usage exit `2`.
- **Constraint compliance:** fails C-1 (exit policy outside the projection) and C-4 (a second policy invites exits outside the derived classes).
- **Why rejected:** duplicates exit policy and breaks contract consistency (GH-177 DEC-11 rejected the same shape for usage errors).

## Decision

- **Decision:** ALT-2. Adopted CLI-wide, not verify-locally.
- **Recommendation vs authorization:** the following are the binding selections proposed for delivery; the WHAT and ACs stay owned by the GH-177 spec. No owner approval is claimed; the record remains **Proposed** for human PR review.
- **Decider:** Juliusz Ćwiąkalski (acceptance pending at PR review).

1. **Single typed vocabulary.** The eleven bash-era tokens are adopted verbatim — set and order — as `DELIVERY_RESULT_TOKENS`, `as const` data in `packages/core/src/contracts/delivery-result.ts`. No other production module declares a token list; the bash usage line remains the external reference, bound by a fail-closed structure test (AC-V8/NFR-5).
2. **Total taxonomy.** `DELIVERY_RESULT_TAXONOMY` declares exactly one entry per token with one projection class (`success | user-validation | platform-provider`) and one derivation class (`verify | tracker-pr | dispatch-session`). The M0-S8-reachable subset is exactly `finished`, `partial`, `failed`, `state-unverified`; the other seven tokens are declared and reserved for M0-S19/M1-S9 collectors and are unreachable in M0-S8.
3. **Exit binding — one deliberate divergence.** Every token's exit is the projection of its identity's projection class. `state-unverified` maps to `platform-provider` → exit `2`, where bash exits `1`: in the typed CLI the token is reached through platform-category registry/store failures (`state.store.torn`, `state.schema.mismatch`, `state.keys.missing`), and the binding projection invariant takes precedence over bash's numeric precedent. All other tokens' exits coincide with bash (`merged`/`blocked`/`pr-open`/`pr-open-unverified`/`finished`/`noop-lane-nothing-to-do` → `0`; `failed`/`max-restarts`/`partial`/`noop-lane-permission` → `1`). The non-zero guarantee is preserved (`2 ≠ 0`).
4. **Comparison unit.** Token-level parity — not numeric exit parity — is the dual-run comparison unit CLI-wide. Dual-run evaluators compare the typed token with the bash summary token and must treat `state-unverified` as the known, documented divergence. If numeric parity is ever required, it needs a deliberate result-contract change (new or remapped projection class), never a call-site override.
5. **Broken invocations.** Broken invocations continue to ride `fallback.invocation` → exit `1` (bash uses exit `2` for usage errors); verify handler grammar failures use `input.value.rejected` → exit `1`. This is existing binding CLI behavior, unchanged by and out of scope of the delivery-result taxonomy (GH-177 DEC-11).

User-category `state.*` failures (`state.permission.denied`, `state.level.unsupported`) classify `failed` → exit `1`, so a user-fixable failure can never masquerade as a platform-unverified outcome.

### Constraint Compliance Attestation

ALT-2 satisfies C-1 through C-5: exits are derived only in the projection module from declared projection classes (C-1); the taxonomy is total over the bash-pinned eleven tokens with one class each, bound by a fail-closed structure test (C-2); only `finished` exits `0` and every non-verified outcome is a non-zero error envelope (C-3); exits stay in `{0, 1, 2}` with no envelope change and one additive, sync-checked error row (C-4); the enum is declared once as runtime-neutral `as const` contracts data (C-5). No accepted-risk exceptions are claimed.

## Trade-offs & Consequences

### Positive Outcomes

- One typed, total, deterministic result vocabulary for the CLI; the exit-zero false-success class is killed at the verification layer with a testable guarantee.
- Dual-run evidence (M1-S9) is comparable immediately — identical tokens — with the single divergence declared up front instead of discovered in evaluation.
- No exit-policy duplication: the binding result contract stays intact; every future command inherits the taxonomy by reusing tokens and identity projection.
- Additive and reversible: data plus one documented row; removal restores the prior surface with no data migration.

### Negative Outcomes

- One numeric divergence from bash (`state-unverified`: CLI `2`, bash `1`): any consumer that hardcodes bash's exit digits for that token will misread the CLI's verdict. Mitigated by the documented comparison unit and the M1-S9 evaluator note (GH-177 RSK-3).
- The taxonomy's value depends on bash-reference stability; a moved or edited usage block trips the binding test and forces a deliberate re-derivation.

### Neutral Outcomes

- Broken invocations exit `1` in the CLI vs bash's usage-exit `2` — pre-existing, contract-bound behavior, deliberately restated here so dual-run documentation can list it as out of taxonomy scope.
- Reserved tokens carry projection classes today that their future collectors must honor or deliberately change; declaring them early trades a small documentation burden for a total taxonomy.

### Unresolved Questions

- None blocking. Whether any M1-S9 consumer ever demands numeric parity is an explicit revisit trigger, not an open design question (owner: Juliusz Ćwiąkalski at M1-S9 design review).

## Implementation Plan

1. Land the contracts module (tokens, taxonomy, reachable subset) and the additive `verify.ledger.incomplete` row **with its documented row in the same delivery phase**, so the two-way error-table sync stays green (GH-177 delivery phases).
2. Land the binding structure tests (bash usage-enum extraction, taxonomy totality, single-enum-home/import rules) together with the behavior suites (rejection matrix, envelope exclusivity, replay determinism).
3. Reconcile `feature-result-contract.md` (new `verify` domain kind and row) and the new verify feature spec in-change; record the `state-unverified` divergence and the token-parity comparison unit in the M1-S9 evaluator-facing documentation when that story is designed.

## Verification Criteria

- Enum/taxonomy binding: structure test equality of set and order vs the bash usage enum — 11/11, 0 drift; one taxonomy row per token; 0 duplicate/extra/missing (AC-V8, NFR-5).
- Non-zero guarantee: exhaustive rejection matrix asserts `exit != 0` with error-only envelopes for every non-verified class; the complete-ledger fixture asserts `0` (AC-V9, NFR-3).
- Projection ownership: `exit-code-literals` stays green; no exit digit appears outside `projection.ts` (C-1).
- Error-table binding: the `verify` row round-trips with its documented row; two-way sync drift `0` (NFR-6).
- Dual-run readiness: M1-S9 evaluator documentation names `state-unverified` as the single known divergence and compares tokens — verified when M1-S9 lands.

## Confidence Rating

**High.** All load-bearing evidence is repo-local and read directly (bash usage/exit blocks, the binding projection module, the documented error table, the GH-177 spec). The main residual uncertainty — whether a future consumer demands numeric parity — is bounded by an explicit revisit trigger rather than by evidence.

## References

- [GH-177 specification](../changes/2026-10/2026-10-31--GH-177--verify-change-exit-taxonomy/chg-GH-177-spec.md) — DEC-5, DEC-11, C-4, C-5, AC-V8, AC-V9, RSK-3.
- [Result contract (Current spec)](../spec/features/feature-result-contract.md) — envelope, error table, exit projection, documented-table sync.
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — package tiers, runtime-API confinement, contracts-tier rules.
- `packages/cli/src/projection.ts`; `packages/core/src/contracts/error-table.ts` — machine sources of the projection and table.
- `scripts/deliver-ticket.sh` — bash-era reference: usage enum and exit codes (circa line 2322), `print_delivery_summary` (circa 2097–2113), `classify_result` family (circa 1300–1400).
- [TDR-0003](TDR-0003-config-parser-schema-and-acquisition.md) and [TDR-0004](TDR-0004-state-storage-engine.md) — Proposed-TDR-during-delivery precedent.
