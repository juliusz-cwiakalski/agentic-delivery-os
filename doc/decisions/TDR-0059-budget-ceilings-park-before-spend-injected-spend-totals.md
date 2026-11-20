---
id: TDR-0059
decision_type: tdr
status: Proposed
created: 2026-11-19
decision_date: null
last_updated: 2026-11-19
summary: "GH-350: per-window and per-ticket spend ceilings are a typed provider.budgets branch evaluated before spawn by a pure evaluator over an injected read-only ProviderSpendTotalsPort implemented at the composition edge from the delivered spend fold; no budget counter is persisted and no new state kind exists. A window-scope crossing parks with cause budget-exhausted and an honest expiry (newest contributing observation + windowSeconds × 1000), a ticket-scope crossing is a terminal classified refusal provider.budget.exceeded at exit 1 because no honest future expiry exists, and a budget park never licenses paid substitution. Named vocabulary: condition kind and park cause and skip reason budget-exhausted, announcements provider.budget.parked (info) and provider.budget.crossed (warning), five evidence fields, config branch provider.budgets.<name> with enabled/scope/basis/ceiling/windowSeconds/entries. No new alarm kind: metrics.burn-rate stays the post-hoc alarm and is not a gate."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider policy: budgets, parks, and cost gating"
decision_scope: repo
review_date: null
business_impact: "The owner's cost-control directive — a delivery parks rather than overspends — becomes a declared, validated ceiling evaluated at spawn, with an honest resume time on the sliding window and an honest terminal refusal where no resume time exists."
customer_impact: "An operator declares a cost or token ceiling per trailing window or per ticket and gets a named park with a computable resume instant, or a named refusal that says the ceiling cannot reopen; neither case can silently overspend."
classification:
  domains: [contracts, cost-control, operations, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-350 clarify_scope: budgets and alarms that park)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-350 clarify-scope: budget data source and seam options)"
    - "@spec-writer (GH-350 specification: branch keys, evaluated facts, park contract)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-350 PR review — this record fixes a cost gate and a closed vocabulary)"
  performers:
    - "@spec-writer (encode the branch, facts, and park rules)"
    - "@test-plan-writer (crossing, expiry, refund, unmeasurable facts)"
    - "@coder (pure evaluator, spend-totals projection, vocabulary, CLI wiring)"
    - "@doc-syncer (provider-engine, config-layer, spend, metrics reconciliation)"
  informed:
    - "Metrics burn-rate alarm owners (the post-hoc alarm stays distinct)"
    - "Operators declaring ceilings"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Operators routinely hit ticket ceilings: that is a planning signal, not a gate defect; do not soften the terminal refusal into a park with a fabricated expiry."
  - "The per-spawn spend-totals read proves too costly (large ledgers, many spawns): reopen the read-cost clause with a bounded projection before any cache is introduced, because a stale cache defeats the gate."
  - "A second spend basis is needed (per-lane, per-role): it is a dimension on the existing read, decided then; the gate keeps one basis per budget."
  - "Budget parks and the metrics burn-rate alarm disagree on measured spend for the same window: one basis is wrong; reconcile the reading basis rather than adding a third figure."
  - "A consumer needs a budget read surface of its own (an operator asking which ceiling is closest): that is a read-side decision, not a gate change."
links:
  related_changes: ["GH-350"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-provider-engine.md"
    - "doc/spec/features/feature-spend.md"
    - "doc/spec/features/feature-metrics.md"
    - "doc/spec/features/feature-config-layer.md"
  contracts:
    - "packages/core/src/contracts/provider.ts"
    - "packages/core/src/contracts/spend.ts"
    - "packages/core/src/state/spend-reads.ts"
    - "packages/core/src/config/catalog.ts"
  decisions: ["ADR-0007", "TDR-0011"]
  roadmap_items: ["M4-S4"]
---

# TDR-0059: Budget Ceilings — A Pure Evaluator over an Injected Spend-Totals Port, Park on the Sliding Window, Terminal Refusal on the Ticket

## Context

- **FACT:** The ticket requires "per-window and per-ticket ceilings that park rather than overspend", evaluated before spawn, and the owner directive adds "budgets and alarms park the lane rather than overspend".
- **FACT:** The delivered spend read side is a read-only fold over the state ledger: `readSpendLedger(store, workItemRef)` composes both telemetry planes plus the ref's transition history, and `computeSpendReport` projects five token classes, harness-reported cost, and breakdowns. It writes nothing, opens no harness store, and classifies absence (`spend.telemetry-absent`) rather than reporting zero (`doc/spec/features/feature-spend.md`).
- **FACT:** The delivered alarm is `metrics.burn-rate`: a post-hoc, read-only evaluation of a project-committed threshold over a trailing window, with no persisted alarm state and no gate (`doc/spec/features/feature-metrics.md` §Burn-rate alarms). It raises an alarm; it never blocks a spawn.
- **FACT:** The provider engine's park invariant is strict: a park carries a creation time and an **absolute expiry strictly in the future at creation**, and an exhausted condition with no honest reset is a *failed* condition, never a fabricated expiry (`feature-provider-engine.md` §Quota evaluation, §Parks; ADR-0007 DC-2/DC-3).
- **FACT:** Chain resolution already separates policy limits from infrastructure conditions: peak and quota are independent conditions combined by MAX with a fixed tie order, and a peak park never permits paid substitution (`feature-provider-engine.md` §Conditions and MAX, chain resolution).
- **FACT:** Nothing in the delivered state schema holds a spend counter; the ledger holds telemetry records, and the fold derives totals at read time.
- **Why now:** GH-350 is where the owner's cost-control directive becomes machinery. A budget that is evaluated after the fact is an alarm; a budget that is evaluated before the spawn is a gate. The ticket asks for the gate.

## Problem Framing (Clarified)

Three questions are tangled in "budgets and alarms":

1. **What is the measured fact?** Spend is already recorded as telemetry and folded on demand. A budget needs a *number* and, for a sliding window, an *instant* at which that number stops counting.
2. **Where does the number come from?** Either the tool derives it from the one delivered telemetry truth at evaluation time, or it maintains a second, mutable budget counter that must be kept in step with every spawn. The second option duplicates truth and can drift from the fold every surface already reports.
3. **What is an honest outcome at a crossing?** A park requires a future resume instant. A trailing-window ceiling can honestly compute one (the instant the newest contributing spend ages out). A per-ticket ceiling cannot: the ceiling never decreases, so there is no future instant at which the ticket is under budget again. Presenting such a crossing as a park would fabricate an expiry — the exact defect ADR-0007 removed.

The framing that follows: **evaluate the delivered spend truth before spawn, park only where a resume instant is computable, and refuse loudly where it is not.** The post-hoc `metrics.burn-rate` alarm is neither replaced nor duplicated; gate and alarm answer different questions ("may this spawn?" versus "did this delivery drift?").

## Constraints (Hard Requirements)

### C-1: No persisted budget counter and no second truth

- **Statement:** The budget decision derives from the delivered telemetry fold; no new state record kind, mutable counter, or derived document is introduced, and no write occurs on the evaluation path.
- **Source:** prior decision (ADR-0007 C-3: parks through the delivered state layer, no second store); spend spec "one basis" discipline
- **Verification:** structure test (no new record kind / schema id); write-discipline test (byte-snapshot of the store before and after an evaluation)
- **Negotiable:** no

### C-2: Evaluation is pure and the read is injected

- **Statement:** The comparison, MAX combination, park construction, and expiry computation are pure functions over injected facts and the injected clock; the spend read enters through a declared port implemented at the composition edge, and the provider core reads no state store.
- **Source:** ADR-0003 runtime neutrality; ADR-0007 C-1
- **Verification:** boundaries/ambient-globals check; hermetic evaluation suite with an injected facts fake
- **Negotiable:** no

### C-3: A park always carries an honest future expiry

- **Statement:** A budget outcome is a park only when a strictly-future resume instant is computable from measured facts; otherwise it is a classified refusal or a skipped failed entry. No budget park is created with a past, absent, or guessed expiry.
- **Source:** prior decision (ADR-0007 DC-3; quota `reset_missing` precedent)
- **Verification:** test (every budget park has `expiresAt > createdAt`; the ticket-scope crossing produces no park)
- **Negotiable:** no

### C-4: A budget crossing never licenses more spending

- **Statement:** A `budget-exhausted` condition on a subscription entry never makes a pay-per-token entry selectable; the gate prefers the sunk-cost subscription entry and stops rather than escalating cost.
- **Source:** AC (owner directive: prefer sunk-cost subscription quota; park rather than burn quota or pay peak rates); ADR-0007 DC-4
- **Verification:** test (chain with paid fallback enabled and a budget-parked subscription entry selects nothing and parks)
- **Negotiable:** no

### C-5: Fail-loud on unmeasurable spend

- **Statement:** A declared budget whose measurement cannot be read (store damage, unreadable family) refuses the decision with the delivered `state.*` identity; verified-empty telemetry measures zero spend (no captured spend yet), never an assumed zero on a failed read.
- **Source:** ADR-0007 C-5 (no silent clear); spend spec presence tolerance
- **Verification:** test (damaged store refuses; verified-empty store evaluates clear; the two are distinguishable)
- **Negotiable:** no

### C-6: Closed vocabulary only, and no new alarm kind

- **Statement:** Every added member is a named extension of an existing closed set; no second alarm system, notification channel, event topic, or scheduler is introduced.
- **Source:** internal standard (guarded sets); metrics spec "alarms are evidence, not gates"
- **Verification:** structure inventory + error-table sync
- **Negotiable:** no

### C-7: Deterministic and bounded

- **Statement:** Identical configuration, clock, and measured facts produce byte-identical decisions, parks, and announcement identities; the read is bounded (one verified ref-scoped fold per evaluation, no per-budget re-read) and its cost does not scale with budget count.
- **Source:** provider-engine NFR determinism; spend fold latency discipline
- **Verification:** paired-run byte equality; read-count assertion (one read pass regardless of declared budgets)
- **Negotiable:** no

> **Table stakes:** credential safety (no credential is resolved on the budget path at all), the existing envelope/exit taxonomy, and the delivered evidence bounds (≤ 1024 bytes, ≤ 20 fields) are assumed and not scored.

## Decision Drivers

**Technical drivers (ranked):**

1. **One truth** — the budget must measure the same figures `spend` and `metrics` report, or three surfaces will disagree about one delivery.
2. **Honesty of the pause** — a resume instant must be computable, not conventional; a gate that wakes to the same breach is worse than a refusal.
3. **Purity and hermeticity** — the comparison and park construction must be testable without a store.
4. **No new mutable state** — a counter is a second truth with a write path on every spawn.

**Operational drivers:**

5. **Operator actionability** — a crossing says which budget, which scope, which basis, measured versus ceiling, and either when it reopens or that it cannot.
6. **Cost-control direction** — subscription first; never escalate to paid capacity to escape a ceiling.
7. **Lean delivery** — reuse the delivered spend fold and provider park machinery.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-350 clarify-scope).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; the AI does not accept this record.
- **Contributors:** `@pm`, `@spec-writer`, `@decision-advisor`.
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, human owner at the GH-350 PR review.
- **Performers:** `@spec-writer`, `@test-plan-writer`, `@coder`, `@doc-syncer`.
- **Informed:** metrics alarm owners, operators declaring ceilings.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Spend is a read-only fold over telemetry with harness-reported cost and five token classes; it writes nothing | FACT | `doc/spec/features/feature-spend.md`; `packages/core/src/state/spend-reads.ts`; `packages/core/src/domain/spend.ts` | A budget gate would need its own measurement path | High |
| Telemetry absence is classified, and verified-empty is distinguished from a failed read | FACT | `feature-spend.md` §Telemetry state and fold basis, §Presence tolerance | C-5's zero-versus-unknown rule would be unsound | High |
| A park requires an absolute expiry strictly after creation; no expiry is fabricated | FACT | `feature-provider-engine.md` §Parks; ADR-0007 DC-3 | The ticket-scope decision would be a fabricated park | High |
| The `metrics.burn-rate` alarm is post-hoc evidence with no gate and no persisted state | FACT | `doc/spec/features/feature-metrics.md` §Burn-rate alarms | A second gate/alarm pairing would be invented | High |
| Chain resolution already walks entries with one closed skip reason each and MAX-combines conditions | FACT | `feature-provider-engine.md` §Chain resolution, §Conditions and MAX | The budget condition would need a parallel resolver | High |
| No state record kind or counter currently persists spend totals | FACT | `packages/core/src/contracts/spend.ts`; state record-kind inventory | The "no second truth" driver would be weaker | High |
| Verified-empty telemetry is the honest reading for a ref that has not spent yet, so a pre-spawn gate evaluates clear | ASSUMPTION | spend presence-tolerance semantics applied to a fresh ref | A fresh ticket would be blocked by its own empty budget read | Medium |
| One ref-scoped fold per spawn is affordable on the expected ledger sizes | ASSUMPTION | fold latency budget (p95 ≤ 500 ms at 1 000 records) | The gate would need a bounded projection or a different host | Medium |
| Harness-reported cost is sparse and un-repriced | FACT | `feature-spend.md` §Spend breakdown, cost paragraph | A cost-basis budget could undercount; must be disclosed, not zero-filled | High |

## Mental Models & Techniques Used

- **First principles:** a ceiling is a predicate over measured spend. Measuring is a read; deciding is a comparison. Nothing about it requires a counter.
- **Inversion:** how does a budget gate become dangerous? By measuring a different number than the report (two truths), by waking into the same breach (fabricated expiry), or by treating an unreadable store as zero (silent clear). Each inversion maps to C-1, C-3, C-5.
- **Opportunity cost:** a persisted counter costs a write on every spawn, a fence, a reconciliation path, and a drift class forever; the fold costs one read that already exists.
- **Systems thinking:** spend, metrics, and the gate are one measurement loop. The gate is the only member that may block; the other two must remain readings of the same facts.
- **Second-order thinking:** allowing paid substitution on a budget park would convert a cost ceiling into a cost accelerator — the exact second-order error the owner directive names.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 one truth | C-2 pure/injected | C-3 honest expiry | C-4 no escalation | C-5 fail-loud | C-6 closed vocab | C-7 deterministic/bounded |
|---|---|---|---|---|---|---|---|
| ALT-0 no budgets | ❌ (requirement declined) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 injected spend-totals port + pure evaluator (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 persisted budget-counter record per spawn | ❌ | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | ✅ |
| ALT-3 reuse captured `spend`/`metrics` output out-of-band | ❌ | ✅ | ⚠️ | ✅ | ❌ | ✅ | ❌ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none claimed).

### Alternative 0 — No Budget Gate

- **Eligibility:** Not eligible (declines the ticket's explicit requirement).
- **Summary:** Keep `metrics.burn-rate` as the only cost control; overspend is discovered after the fact.
- **Constraint compliance:** Every constraint passes trivially; the requirement is unmet.
- **Driver fit:** Fails driver 6 (the owner directive) and driver 5 (an alarm names a drift, not a decision).
- **Pros:** Zero delivery cost; no new vocabulary.
- **Cons:** The AC "budgets and alarms park rather than overspend" has no machinery; the lane runs until the post-hoc alarm fires.
- **Why rejected:** Declining an explicit requirement is an owner scope decision, not an implementation choice.

### Alternative 1 — Injected Spend-Totals Port with a Pure Evaluator (selected)

- **Eligibility:** Eligible (passes C-1 … C-7).
- **Summary:** A declared `provider.budgets` branch is validated with the provider config. Before resolution, the composition edge performs **one** ref-scoped spend read and projects a totals fact per declared budget scope (measured cost, measured tokens, newest contributing observation instant); the pure evaluator compares each applicable budget and produces conditions. A window-scope crossing parks; a ticket-scope crossing fails with a classified refusal. No state is written.
- **Constraint compliance:** C-1 by construction (no record kind); C-2 by the port; C-3 because the window expiry is derived from the newest observation and the ticket case is a refusal; C-4 by a resolution rule that a budget park blocks paid substitution; C-5 by the store-failure policy; C-6 by named extensions only; C-7 by one read and pure comparison.
- **Driver fit:** Best on all seven.
- **Pros:** Same figures as `spend`; one read per spawn regardless of budget count; no drift class; hermetically testable.
- **Cons:** The gate's freshness is the telemetry's freshness (closeout/stream capture), not a live provider balance; and it adds a read to the spawn path.
- **Why chosen:** It is the only option that keeps one truth while satisfying the park invariant.

### Alternative 2 — Persisted Budget-Counter Record Updated per Spawn

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Maintain a `provider.budget-counter` record per budget and work item, incremented by each spawn's measured spend.
- **Constraint compliance:** C-1 fails — a second truth that must be reconciled against telemetry on every read and every repair. C-5 degrades: a counter that failed to update reads a *plausible* number, which is worse than an unreadable one. C-3 degrades: a counter cannot tell when its own trailing window starts without per-entry instants, so the expiry becomes a convention.
- **Driver fit:** Fails drivers 1, 2, 4.
- **Pros:** No fold at spawn time.
- **Cons:** A write and a fence on every spawn; drift on crash between spawn and increment; a repair path; a second number that can disagree with `spend`.
- **Why rejected:** It buys read latency with a permanent correctness liability, and the delivered fold is already bounded.

### Alternative 3 — Reuse Captured `spend`/`metrics` Output Out-of-Band

- **Eligibility:** Not eligible (fails C-1, C-5, C-7).
- **Summary:** The gate reads the last operator-captured report file (or a report cached by a prior command) instead of measuring.
- **Constraint compliance:** C-5 fails — absence or staleness becomes an assumed clear; C-7 fails — the decision depends on when someone last ran a command; C-1 fails — the cached report is a second truth.
- **Driver fit:** Fails drivers 1, 2, 5.
- **Pros:** No read on the spawn path.
- **Cons:** A gate whose verdict depends on whether an operator ran a report is not a gate.
- **Why rejected:** Staleness is indistinguishable from headroom, so the ceiling is unenforceable.

## Decision

- **Decision:** Adopt **ALT-1**, with the named vocabulary below.

### D1 — Configuration branch and keys

The typed `provider` branch gains `provider.budgets`, a dynamic-name record map (`record` field kind) whose children are budgets:

| Key | Shape | Default | Rule |
|---|---|---|---|
| `provider.budgets.<name>.enabled` | boolean | `true` | Disabled budgets are inert (no read, no condition). |
| `provider.budgets.<name>.scope` | `ticket` \| `window` | required | `ticket` measures the whole work-item ref; `window` measures the trailing span. |
| `provider.budgets.<name>.basis` | `cost` \| `tokens` | required | Reuses the `metrics.burn-rate` basis vocabulary; `cost` is harness-reported units, never re-priced. |
| `provider.budgets.<name>.ceiling` | positive number | required | A measurement at or above the ceiling is a crossing (`>=`). |
| `provider.budgets.<name>.windowSeconds` | positive integer | required iff `scope: window`, refused when `scope: ticket` | The trailing span ending at the evaluation instant. |
| `provider.budgets.<name>.entries` | non-empty list of declared descriptor names | absent = every declared entry | Restricts which entries the budget governs. |

Semantic validation is fail-closed and names the offending field: an unknown scope or basis, a non-positive ceiling or window, a `windowSeconds` on a ticket scope (or its absence on a window scope), an entry name that is not declared, or an empty `entries` list fails the provider configuration (`provider.chain.invalid`), never a partial evaluation.

### D2 — The injected port and the one read

One declared port, `ProviderSpendTotalsPort`, receives `{ workItemRef, scopes: [{ scopeKey, fromMs }] }` — one scope per declared budget, each naming its lower bound (the ticket scope uses the ref's beginning; a window scope uses `now − windowSeconds`) — and answers either `{ status: "measured", totals: [{ scopeKey, cost, tokens, newestAtMs }] }` or `{ status: "empty" }` (verified-empty telemetry, every scope measuring zero). Both bases are returned for every scope, so budgets declaring different bases still share one read and the evaluator selects the declared basis. The composition edge implements it over **one** verified `readSpendLedger` + spend fold, projecting every requested scope in the same pass; there is no new adapters I/O subpath, because the store port and the fold already exist. The response is `O(declared budgets)` regardless of record count, so no per-record data crosses the port and no second read is needed per budget. A failed read returns the delivered `state.*` failure and the decision refuses with that identity (C-5). `newestAtMs` is `null` only when a scope has no contributing observation.

### D3 — Pure evaluation and the park/refusal split

`evaluateBudgets` is a pure function of the declared budgets, the measured facts, and the injected clock. For each enabled budget that governs the entry under evaluation:

- **Clear** when the measured figure is below the ceiling.
- **Parked** (window scope) when it is at or above the ceiling; `waitSeconds` is derived from `newestAtMs + windowSeconds × 1000` and the expiry is that absolute instant, which is strictly future because `newestAtMs <= now` and `windowSeconds > 0`. Cause `budget-exhausted`, condition kind `budget-exhausted`, announcement `provider.budget.parked` (severity `info`). The bound is conservative and honest: at that instant every spend observation counted now has left the trailing window, and no new spend can accrue while the entry is parked.
- **Failed** (ticket scope) when it is at or above the ceiling. No expiry exists, so no park is created; the entry is a failed entry announced as `provider.budget.crossed` (severity `warning`) and skipped with reason `budget-exhausted`. When no later entry is eligible and no honest contributing park supplies an expiry, resolution fails with the classified `provider.budget.exceeded`.

Budget conditions join the delivered MAX combination and the fixed tie order, inserted **after `quota-exhausted` and before `provider-outage`** in `PROVIDER_CONDITION_TIE_ORDER`; the chain-park cause stays `chain-exhausted` with the union of contributing kinds, exactly as quota and peak already do.

### D4 — No paid substitution

A pay-per-token entry remains selectable exactly under the delivered eligibility rule — the chain allows paid fallback and no subscription entry is parked for a peak window — **and additionally** only when no subscription entry is parked for `budget-exhausted`. Budget pressure therefore prefers the sunk-cost subscription entry (already first by validation) and stops; it never converts a ceiling into a paid-capacity escape. This adds one blocking condition to the delivered rule without weakening it: quota stays a provider limit that paid capacity may relieve (the delivered rule), while a budget is the operator's own spend ceiling and nothing may relieve it.

### D5 — Skip reason, announcements, error identity, evidence

- **Skip reason:** `budget-exhausted`, added to `PROVIDER_SKIP_REASONS` after `quota-exhausted` (the set grows from eight to nine).
- **Condition kind and park cause:** `budget-exhausted`, added to `PROVIDER_CONDITION_KINDS` and `PARK_CAUSES`.
- **Announcements:** `provider.budget.parked` (`info`) and `provider.budget.crossed` (`warning`), added to `ANNOUNCEMENT_CODES`. There is no `provider.budget.reset_missing` analogue: the ticket scope is terminal *by design*, so the refusal itself carries the fact.
- **Error identity:** `provider.budget.exceeded` — category `user`, retryable `false`, consequence `not_landed`, projection `user-validation` (exit `1`). It is distinct from `provider.quota.exceeded` (a provider limit, transient, exit `2`).
- **Evidence:** the closed park evidence allowlist gains exactly five fields — `budgetName`, `budgetScope`, `budgetBasis`, `budgetMeasured`, `budgetCeiling` — and the announcement allowlist inherits them through its base projection. No measured value is ever a credential or a provider identity.

### D6 — Gate versus alarm

No alarm kind is added and `metrics.burn-rate` is unchanged. The two surfaces are declared complementary and non-substitutable: the gate answers "may this spawn proceed under the declared ceiling?" using the same measured facts, and the alarm answers "did the trailing window drift past the declared threshold?" after the fact. Neither derives from the other, and a budget crossing is not an alarm; it is a condition plus a park or refusal.

- **Decider:** Juliusz Ćwiąkalski — pending at the GH-350 PR review.
- **Conditions for revisit:** see `revisit_triggers`.

### Constraint Compliance Attestation

The chosen alternative satisfies C-1 … C-7: measurements come from the delivered fold with no new record kind or write (C-1); the evaluator is pure over injected facts and the injected clock (C-2); window parks carry a computed strictly-future expiry and ticket crossings are refusals (C-3); a budget park blocks paid substitution (C-4); a failed read refuses while verified-empty measures zero (C-5); every added member extends a named closed set and no alarm system is added (C-6); one read and pure comparison give deterministic, bounded behaviour (C-7). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The ceiling measures the same figures the spend report and the metrics alarm report; one delivery, one number.
- No mutable budget state exists to drift, repair, or reconcile; a crash cannot desynchronize a counter.
- The park/refusal split is honest: a sliding-window crossing has a real resume instant, and a ticket ceiling admits it cannot.
- The cost policy stays monotone: budget pressure never escalates to paid capacity.

### Negative Outcomes

- The gate's freshness is telemetry freshness. A spawn that spends more than the ceiling within one window can still land one increment above it before the next evaluation sees the new records; the ceiling is a pre-spawn gate, not a hard real-time cap. This is stated, not hidden.
- The spawn path gains one verified ref-scoped read.
- Two provider-kind error rows (this one and the zone row) move the delivered sync counts.
- The evidence allowlist grows by five fields, raising the bounded payload for budget parks.
- A cost-basis budget can undercount when harness cost is sparse; the measured figure must disclose sparsity rather than zero-fill.

### Unresolved Questions

- [ ] Whether a cost-basis budget must expose `sparse` on the park evidence (owner: `@spec-writer`; recommendation: mirror the spend report's disclosure in the announcement summary, not in a new evidence field).
- [ ] Whether per-lane budgets are needed before M4-S5 (owner: `@pm`; recommendation: no, `ticket` is the required scope and `entries` already narrows the governed providers).

## Implementation Plan

1. Contracts: `ProviderBudget`, the `provider.budgets` catalog branch, `ProviderSpendTotalsPort`, the five evidence fields, and the three vocabulary additions.
2. Pure policy: `evaluateBudgets`; integrate into `conditions.ts` (MAX and tie order) and `chain.ts` (eligibility, skip reason, no paid substitution).
3. Edge: project the spend fold into totals per declaration; one read per evaluation; map read failures to the delivered state identities.
4. Error table: add `provider.budget.exceeded`; move the synchronization counts.
5. Specs/docs: provider-engine (branch, conditions, parks, announcements, error rows), config-layer (branch table), spend (the gate consumes the same fold), metrics (gate/alarm distinction).
6. Tests: crossing and non-crossing matrices for both scopes, expiry arithmetic, verified-empty versus damaged store, no-substitution, one-read assertion, deterministic replay.

## Verification Criteria

- Metric: budget parks with a non-future or absent expiry — Target: 0 — Window: GH-350 CI.
- Metric: ticket-scope crossings presented as parks — Target: 0 — Window: GH-350 CI.
- Metric: paid entries selected while a subscription entry is budget-parked — Target: 0 — Window: GH-350 CI.
- Metric: spend-totals reads per evaluation — Target: exactly 1 regardless of budget count — Window: GH-350 CI.
- Metric: state writes on the evaluation path — Target: 0 — Window: GH-350 CI (byte-snapshot).
- Metric: budget figures disagreeing with `spend --ref` for the same selection and instant — Target: 0 — Window: GH-350 CI.

## Confidence Rating

**Medium–high.** The measurement source, the park invariant, and the chain machinery are delivered and well specified. The medium component is operational: the gate is only as fresh as telemetry capture, so a single spawn can land above a ceiling before the next read; that is inherent to pre-spawn gating and is disclosed rather than engineered away. The ticket-scope refusal is a deliberate divergence from the ticket's "park" wording and is the most likely point of owner debate.

## References

- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — fail-loud, park invariant, subscription-first policy.
- [TDR-0011](TDR-0011-spend-resume-amplification-v0-formula.md) — the spend fold's amplification contract (unchanged).
- Feature specs: [Provider Engine](../spec/features/feature-provider-engine.md), [Spend Read Side](../spec/features/feature-spend.md), [Metrics](../spec/features/feature-metrics.md), [Configuration Layer](../spec/features/feature-config-layer.md).
- Change: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/`.
