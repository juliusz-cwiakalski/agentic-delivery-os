---
id: TDR-0063
decision_type: tdr
status: Proposed
created: 2026-11-19
decision_date: null
last_updated: 2026-11-19
summary: "GH-350: the work-item ref the budget gate measures is a fact, not policy, and it comes from the delivered local delivery context — `<cwd>/.ai/local/pm-context.yaml` through `readLocalPmContext`, the seam `spend` already uses for an omitted `--ref`, with no state-store read, no new environment variable, and no new provider flag. Precedence is: an explicitly supplied ref-bearing fact wins, otherwise the local context, otherwise the evaluation refuses; `provider simulate` is hermetic, so its ref comes only from a new optional `workItemRef` field in the `delivery.provider.simulate.v1` fixture and it never reads the local context. The ref is required exactly when an enabled budget is evaluated (`resolve`, `simulate`), because the one spend read is ref-scoped and AC-F2-2 requires the measured figure to equal `spend --ref`; `quota`, `profile resolve`, and `watch status` evaluate no budget and must never fail on a missing context. An unresolvable ref is one typed refusal reusing `input.value.rejected` at exit 1 naming the budget(s), the missing context, and the remedy — an enabled ticket-scope budget is never measured as zero, never skipped as clear, and never downgraded to a window-only evaluation, and a window-only evaluation may not proceed without a ref either, because a window budget still measures one ref's ledger."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider policy: budget gate measurement scope"
decision_scope: repo
review_date: null
business_impact: "The owner's cost-control directive — a delivery parks rather than overspends — is unenforceable without a subject: a per-ticket ceiling that cannot name the ticket measures nothing. This record makes the gate measure the same ledger `spend` reports, so the ceiling, the report, and the alarm agree."
customer_impact: "An operator declaring a per-ticket or per-window ceiling gets a gate that measures the delivery they are actually running, keeps working outside a delivery context when no budget is declared, and gets one named refusal (naming the budget and the missing context) instead of a silent clear when it cannot measure."
classification:
  domains: [contracts, cost-control, configuration, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: high
  urgency: high
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-350 Definition-of-Ready iteration 1, blocking finding B2: the budget gate's work-item ref source is unspecified)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; AI does not accept this R2 record"
  contributors:
    - "@decision-advisor (repository analysis and this record)"
    - "@readiness-reviewer (B2: the port takes a ref no artifact supplies)"
    - "@pm (GH-350 clarify-scope: the ticket's per-ticket ceiling and the no-new-env-var rule)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-350 PR review — this record fixes the subject of a cost gate)"
  performers:
    - "@spec-writer (ref seam, precedence, refusal, fixture field)"
    - "@test-plan-writer (parity with `spend`, unresolvable-ref matrix, hermeticity of simulate)"
    - "@coder (runtime seam, composition wiring, refusal, fixture parse)"
    - "@doc-syncer (provider-engine, spend, provider reference page)"
  informed:
    - "Operators declaring ceilings"
    - "M4-S7 prompts that run `provider resolve` during a delivery"
    - "Flip F2 evidence owners"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "`provider simulate`'s v1 fixture has shipped by the time this lands: the `workItemRef` field then belongs to `delivery.provider.simulate.v2`, never to a widened v1. Today v1 cannot have shipped because the family is unreachable in production (TDR-0062)."
  - "A consumer needs a ref source that is not the local delivery context (a CI run with no checkout context, for example): that is a new composition fact with its own producer, decided then — not an environment variable and not a silently guessed ref."
  - "Operators report that `provider resolve` outside a delivery context refuses too often: the remedy is to disable or narrow the budget, or to introduce a deliberate calling surface. Do not soften the refusal into a window-only evaluation, which measures a different population than `spend --ref`."
  - "The spend read becomes all-refs (a project-scoped fold): then a window budget could honestly be ref-free, and this record's ref requirement must be re-derived rather than relaxed ad hoc."
  - "The local PM context file moves or changes shape: the seam is one function (`readLocalPmContext`) and moves with it; the refusal text names the context, so it must be updated with the path."
links:
  related_changes: ["GH-350", "GH-294"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-provider-engine.md"
    - "doc/spec/features/feature-spend.md"
    - "doc/spec/features/feature-config-layer.md"
    - "doc/planning/oss-tooling/milestones/m1/commands/provider.md"
    - "doc/changes/2026-11/2026-11-19--GH-350--provider-policy/chg-GH-350-spec.md"
  contracts:
    - "packages/core/src/contracts/provider.ts"
    - "packages/core/src/contracts/spend.ts"
    - "packages/core/src/state/spend-reads.ts"
    - "packages/cli/src/commands/provider.ts"
    - "packages/cli/src/commands/spend.ts"
    - "packages/cli/src/edge.ts"
    - "packages/cli/src/production.ts"
    - "packages/adapters/src/file/pm-context.ts"
  diagrams: []
  decisions: ["TDR-0058", "TDR-0059", "TDR-0062", "ADR-0007"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S4"]
---

# TDR-0063: Provider Budget Work-Item Ref — A Fact From the Local Delivery Context, Never a Flag, Never a Silent Clear

## Context

- **FACT:** `DM-3` declares one read-only port, `ProviderSpendTotalsPort`, whose input is `{ workItemRef, scopes: [{ scopeKey, fromMs }] }`; `scopes` are per declared budget, and a `ticket` scope is bounded by "the ref's beginning" (change spec §8.3 DM-3, Appendix C).
- **FACT:** The measurement behind the port is `readSpendLedger(store, workItemRef)` — a **ref-scoped** verified fold. There is no all-refs fold: `spend`, `metrics`, and the gate all read one work item's ledger (TDR-0058 D2; `doc/spec/features/feature-spend.md`).
- **FACT:** `provider resolve` accepts only `--chain` and `--profile`; `quota` accepts `--provider`; `parks list` accepts `--all`/`--provider`; `profile resolve` accepts `--agent`/`--for-spawn`; `watch status` accepts `--provider`. No member takes a ref, and the delivered grammar refuses any other flag (`packages/cli/src/commands/provider.ts:91-171`).
- **FACT:** `spend` already answers exactly this question for an omitted `--ref`: `runtime.resolveActiveRef()` reads the local delivery context — `<cwd>/.ai/local/pm-context.yaml` via `readLocalPmContext({ path, fs })` — **without touching the state store**, and refuses `input.value.rejected` with "no active change context; pass `--ref <ref>`" when it cannot (`packages/cli/src/commands/spend.ts:209-216`; `packages/core/src/contracts/spend.ts:325-335`; `packages/cli/src/edge.ts:5615`).
- **FACT:** `dispatch attempts` and `metrics` use the same seam with the same semantics (`packages/cli/src/production.ts:3211-3216`, `:4437`; `packages/cli/src/commands/metrics.ts:86`). The production composition already builds the path as `${cwd}/.ai/local/pm-context.yaml` (`packages/cli/src/production.ts:1880`).
- **FACT:** The change's configuration rule is "policy expressed only in Jaiship config": provider policy resolves from typed configuration, and F-3 / `AC-F3-4` state that this change "introduces no environment variable and no flag". `NG-11` adds "no new command family, no new state record kind, no new store write path".
- **FACT:** The simulate fixture (`delivery.provider.simulate.v1`, TDR-0059 D2 / Appendix D) declares the instant, chain/profile, credential outcomes, quota transport results, spend telemetry state and points, and zone offsets. It has **no** ref field, so a ticket-scope budget cannot be replayed offline.
- **FACT:** TDR-0059 C-3 requires identical fixture bytes to produce byte-identical output on any host, and C-2 forbids an ambient read in simulate. A simulate path that read the local delivery context would decide differently on two machines for the same fixture.
- **FACT:** Tests inject the totals port, so a green suite coexists with a gate that has no subject. This is B2: the port takes a ref no artifact supplies, and no test can notice.
- **Why now:** GH-350 is the change that introduces the ceiling. If the ref source is left to the implementer, one of two silent failures ships: a `ticket` budget that measures zero (a silent clear of the owner's cost directive) or a gate whose measured figure differs from `spend --ref` (three cost surfaces disagreeing about one delivery).

## Problem Framing (Clarified)

The requirement is not "pass a ref around". It is: **the gate must measure the same ledger `spend` reports, for the delivery the operator is actually running, without adding a second source of truth and without a new input surface.** That decomposes into four questions that are currently conflated:

1. **Source.** Where does the ref come from? The repository already answers this once: the local delivery context, read by one function, with no store access. A second answer would be a second truth for the same fact.
2. **Precedence.** If a surface has both an explicitly supplied value and a context, which wins? `spend` already declares the rule — an explicit `--ref` wins, the context is the fallback — and the provider family has no `--ref`, so in production the context is the sole tier; a hermetic surface has no context tier at all.
3. **The unresolvable case.** A missing context is not an empty ledger. Treating it as zero is the silent clear ADR-0007 exists to forbid; skipping the budget is the same clear with an extra step. The only honest outcomes are "measure" or "refuse, classified".
4. **Scope kind.** Does a `window` budget need a ref? The intuition "a window is a time range, so it is ref-free" is false here: the read is ref-scoped, so a "window budget without a ref" would have to measure across refs — a different population, a second measurement path, and a parity failure with `spend --ref`.

Two further constraints shape the answer. First, the ref is a **fact about which delivery is being evaluated**, not a **policy input**: policy is what the operator declares (chains, ceilings, windows), and the ref is the subject of the measurement, exactly as `spend --ref` is. That distinction is why reading the local context does not violate "policy expressed only in Jaiship config" — no policy value is read from a file outside configuration, and the environment is never consulted. Second, a read-only member must not acquire a dependency on a delivery: `provider quota` on a workstation outside a change context must keep working, so the requirement must be attached to **budget evaluation**, not to the family.

## Constraints (Hard Requirements)

### C-1: No new environment variable and no new provider flag

- **Statement:** The ref is not supplied through an environment variable and no provider member gains a ref flag.
- **Source:** Change spec F-3 / `AC-F3-4` ("this change introduces no environment variable and no flag"); `NG-11`; ticket scope.
- **Verification:** Review + a variant-scan case asserting zero ref-bearing flags in the family's grammar and zero `environment[...]` read on the ref path.
- **Negotiable:** no.

### C-2: The measured figure equals `spend --ref` for the same selection and instant

- **Statement:** The ref the gate measures is the ref `spend` would resolve for the same invocation facts, so the budget's measured cost/tokens equal the delivered spend fold's figure for that ref.
- **Source:** Change spec `AC-F2-2` ("the measured figure equals `spend --ref` for the same selection and instant"); TDR-0058 driver 1 (one truth).
- **Verification:** Test — same fixture/report facts drive both surfaces for one ref; 0 differences.
- **Negotiable:** no.

### C-3: No state-store read to obtain the ref

- **Statement:** Ref resolution reads only the local delivery context (an injected path plus file facts); it performs no state-store read, no fence, and no write.
- **Source:** Delivered `spend` contract ("without touching the state store", `packages/core/src/contracts/spend.ts:330`); TDR-0058 C-1 (no second truth / no write on the evaluation path).
- **Verification:** Test — a poisoned/throwing store port observes zero calls during ref resolution; byte snapshot of the state root unchanged.
- **Negotiable:** no.

### C-4: Fail loud, never silent-clear

- **Statement:** When a budget must be evaluated and the ref cannot be resolved, the decision refuses with a typed identity; an enabled `ticket` budget is never measured as zero, never skipped, and never converted into a window-only evaluation.
- **Source:** Prior decision (ADR-0007 C-5 no silent clear; TDR-0058 C-5); config-validation discipline (`AC-F2-1` "no partial evaluation occurs").
- **Verification:** Test — the unresolvable matrix (no context file, unreadable context, malformed ref) produces one refusal per case and zero measurements; a `ticket` budget never evaluates clear without a ref.
- **Negotiable:** no.

### C-5: Simulate stays hermetic

- **Statement:** `provider simulate` reads no local context, no environment, no clock, and no store; its ref comes only from the fixture document, so identical fixture bytes decide identically on any host.
- **Source:** TDR-0059 C-2 and C-3; change spec `AC-F5-1` (zero ambient effects).
- **Verification:** Test — a recording file-facts seam observes zero local-context reads during simulate; paired-run byte equality across two fixture paths and two working directories.
- **Negotiable:** no.

### C-6: Read-only members keep working outside a delivery context

- **Statement:** `provider quota`, `provider profile resolve`, and `provider watch status` resolve no ref and never fail because no delivery context exists; a declared budget does not change their behaviour.
- **Source:** Delivered behaviour of those members (they evaluate no budget); TDR-0058 (budget joins **chain resolution**, not profile eligibility or watch reads); operator ergonomics.
- **Verification:** Test — the same invocations with no context file at all answer their normal outcome at exit 0 (or their delivered classified failure for a configuration problem), and a recording ref seam observes zero calls.
- **Negotiable:** no.

> **Table stakes:** the `DM-3` port signature is unchanged; no new record kind, counter, or derived document; the envelope/exit taxonomy and the evidence bounds are delivered and unchanged.

## Decision Drivers

**Technical drivers (ranked):**

1. **One truth** — the gate must measure the fold `spend` reports; anything else makes three surfaces disagree about one delivery.
2. **No second input surface** — the ref is a fact the tool can already obtain; asking the operator for it duplicates state the delivery already records.
3. **Hermetic replay** — a fixture must be a complete statement of its scenario, or the flip's evidence is host-dependent.
4. **Fail-loud over convenient** — an unevaluable ceiling must say so, because a silent clear is the failure mode the owner directive exists to prevent.

**Operational drivers:**

5. **Legibility** — an operator can see, from the refusal and the park message, which delivery was measured.
6. **Precedent unity** — `spend`, `dispatch attempts`, and `metrics` already answer "which ref?" one way; a fourth answer is a support cost.
7. **No over-refusal** — a read-only quota snapshot must not require a delivery context.
8. **Reversibility** — if a non-context source is ever needed, it arrives as its own composition fact; today's decision forecloses nothing structural.

*(Overlap check: the no-env-var/no-flag rule, parity with `spend`, no store read, fail-loud, hermeticity, and non-over-refusal are gates C-1…C-6 and appear above only as ranking values. The gates decide eligibility; the drivers rank the survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-350 DoR iteration 1, B2).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review. The AI does not accept this R2 record.
- **Contributors:** `@readiness-reviewer` (B2); `@pm` (ticket scope and the cost directive); `@decision-advisor` (analysis and this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, human owner.
- **Performers:** `@spec-writer` (seam, precedence, refusal, fixture field); `@test-plan-writer` (parity, unresolvable matrix, hermeticity); `@coder` (runtime seam, composition, parse, refusal); `@doc-syncer` (provider-engine, spend, reference page).
- **Informed:** operators declaring ceilings, M4-S7 prompts, flip evidence owners.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| `spend` resolves an omitted `--ref` from the local context without a store read | FACT | `packages/cli/src/commands/spend.ts:209-216`; `packages/core/src/contracts/spend.ts:325-335`; `packages/cli/src/edge.ts:5615`, read 2026-11-19 | The chosen seam would be new invention and ALT-2/ALT-3 would compete | High |
| The local context is `<cwd>/.ai/local/pm-context.yaml`, read via `readLocalPmContext({path, fs})` | FACT | `packages/cli/src/production.ts:1880`, `:3212`, `:4437`, read 2026-11-19 | The refusal's remedy text and the test seam would be wrong | High |
| `dispatch attempts` and `metrics` use the same seam | FACT | `packages/cli/src/production.ts:3211-3216`; `packages/cli/src/commands/metrics.ts:86`, read 2026-11-19 | Driver 6 (precedent unity) weakens | High |
| The spend read is ref-scoped; no all-refs fold exists | FACT | TDR-0058 D2; `doc/spec/features/feature-spend.md`; `readSpendLedger(store, workItemRef)`, read 2026-11-19 | "Window budgets are ref-free" would be true and D6 would change | High |
| `provider resolve` accepts only `--chain`/`--profile`; no member takes a ref | FACT | `packages/cli/src/commands/provider.ts:91-171`, read 2026-11-19 | ALT-2 would be cheaper | High |
| The fixture schema has no ref field | FACT | TDR-0059 D2; change spec Appendix D, read 2026-11-19 | D7 would be unnecessary | High |
| The change forbids new env vars and provider flags | FACT | change spec F-3, `AC-F3-4`, `NG-11`, read 2026-11-19 | ALT-5 (environment) would be eligible | High |
| The entrypoint's invocation fact carries no work-item ref | FACT | `packages/cli/src/entrypoint.ts` (`EntrypointInvocationFact`), read 2026-11-19 | ALT-4 (composition injection) would have a producer | High |
| Simulate must be host-independent byte-for-byte | FACT | TDR-0059 C-2, C-3, read 2026-11-19 | Simulate could read the local context and D7 would be optional | High |
| A read-only member never evaluates a budget | FACT | TDR-0058 D3 (budget joins chain resolution); change spec F-2, read 2026-11-19 | C-6 would be wrong and every member would need a ref | High |
| `readLocalPmContext` is the PM-context reader, not a state read, and its active-change ref is the delivery identity | FACT | `packages/cli/src/production.ts` call sites; `steer`'s origin derivation uses the same file | The distinction between "fact" and "policy input" would need rewording | High |
| A malformed ref in the context should be treated as unresolvable rather than passed to the fold | ASSUMPTION (fail-closed judgement, accepted by the owner at PR review) | The delivered `spend` refusal validates `--ref` against `SPEND_WORK_ITEM_REF_PATTERN`; this record applies the same shape test to the context value | A malformed value would reach the ledger read and fail there with a different identity | Medium-High |
| Operators accept one refusal naming the context path and the enabled budget as adequate remedy | ASSUMPTION (product judgement) | This record §4 | The remedy would need a command (a read surface for "which ref am I on") — additive, not structural | Medium |

## Mental Models & Techniques Used

- **First principles:** a ceiling is a predicate over a measured number; the number comes from one ref-scoped fold; therefore the gate needs a ref, and the quality of the decision is the quality of the ref it uses.
- **Inversion:** how does this fail silently? By measuring zero (no ref treated as empty), by measuring someone else's delivery (a guessed default ref), by measuring a different population (all-refs window), or by refusing something that did not need measuring (a quota snapshot). C-2, C-4, and C-6 close the four.
- **Second-order thinking:** adding `--ref` makes every invocation repeat a fact the delivery already records, and invites a divergence between "the ref I passed" and "the ref the dispatch ran" — a silent mis-measurement that looks intentional.
- **Systems thinking:** the gate, `spend`, `metrics`, and the dispatch all consume one ledger keyed by one ref. The cheapest way to keep them consistent is to use the same resolver, not the same value passed by hand.
- **Boundary thinking:** fact versus policy. The ref says *whose* spend is measured; it never says *how much* may be spent or *which* provider to use. That boundary is what keeps "policy expressed only in Jaiship config" true while reading a context file.
- **KISS:** one seam, one precedence rule, one refusal, one fixture field.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 no env/flag | C-2 parity with `spend` | C-3 no store read | C-4 fail loud | C-5 hermetic simulate | C-6 no over-refusal |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 leave the ref source unspecified (status quo) | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| ALT-1 local delivery context + fixture `workItemRef` (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 `--ref <ref>` flag on the members | ❌ | ✅ | ✅ | ✅ | ⚠️ (a fixture flag would compete with the document) | ✅ |
| ALT-3 compose-injected ref from the acting dispatch work item | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| ALT-4 environment variable | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-5 window-only evaluation when no ref resolves (partial) | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via a narrowing (no accepted-risk exception is claimed for any ❌).

### Alternative 0 — Leave the Source Unspecified

- **Eligibility:** Not eligible (fails C-2 and C-4; declines the requirement).
- **Summary:** Deliver the port and let each composition decide where the ref comes from.
- **Constraint compliance:** C-2 fails — with no declared source, the measured ref is an implementation detail and parity with `spend` is accidental; C-4 fails — the cheapest implementation of "no ref" is zero, which is a silent clear.
- **Driver fit:** Fails 1, 3, 4, 5.
- **Pros:** No artifact change.
- **Cons:** B2 ships as a latent defect that no test can see (the port is injected in tests).
- **Why rejected:** It is the finding.

### Alternative 1 — Local Delivery Context Plus a Fixture `workItemRef` (chosen)

- **Eligibility:** Eligible (passes C-1 … C-6).
- **Summary:** The provider runtime gains one ref seam supplied by the composition from `readLocalPmContext` — the identical seam `spend` uses — and the simulate fixture gains an optional `workItemRef` that is its only ref source.
- **Constraint compliance:** C-1 by construction; C-2 because it is the same resolver `spend` uses; C-3 because the seam reads a file through injected file facts; C-4 with one `input.value.rejected` refusal; C-5 because simulate never calls the seam; C-6 because the requirement is attached to budget evaluation only.
- **Driver fit:** Best on 1, 2, 5, 6, 8; good on 3 (with D7), 4, 7.
- **Pros:** Same answer as the delivered surfaces; no new surface for the operator; hermetic replay preserved; one refusal instead of a silent clear.
- **Cons:** The gate inherits the context file's lifecycle (it is git-ignored and ephemeral, so outside a delivery the operator must be inside a change context or disable the budget); a CI composition without a checkout needs its own answer later.

### Alternative 2 — A `--ref <ref>` Flag on the Provider Members

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** `provider resolve --ref GH-350`, `provider quota --ref GH-350`, and so on.
- **Constraint compliance:** C-1 fails — `AC-F3-4` states the change introduces no provider flag, and a ref flag is a flag. C-2 would hold only when the operator passes the same ref the delivery is running; a mismatch is silent.
- **Driver fit:** Fails 2, 5, 6; neutral elsewhere.
- **Pros:** Explicit, discoverable through `--help`, no context dependency.
- **Cons:** Duplicates a fact the delivery already records; invites a divergence between the passed ref and the running ref; must be repeated on every member; and a `--ref` on `profile resolve --for-spawn` would create a second authority for "which delivery is spawning".
- **Why rejected:** It buys explicitness with a duplicated fact and a new input surface, against an explicit constraint.

### Alternative 3 — Compose-Injected Ref From the Acting Dispatch Work Item

- **Eligibility:** Not eligible (fails C-5 and C-6).
- **Summary:** The composition knows "the work item this dispatch is acting on" and injects it; the operator supplies nothing.
- **Constraint compliance:** C-5 fails, because simulate would inherit an ambient fact and two hosts would decide differently for one fixture. C-6 fails, because a read-only member invoked outside any dispatch would have no ref and would either refuse (over-refusal) or need a special case. It also has no producer: `EntrypointInvocationFact` carries `command`, `runId`, `groupScoped`, and `priorWorkingName` — no ref — and a direct operator invocation has no acting dispatch at all.
- **Driver fit:** Fails 3, 5, 7; strong on 2 in the dispatch path only.
- **Pros:** Zero operator input; matches how the engine is fed during a spawn.
- **Cons:** Only correct for invocations that *are* a dispatch; every other invocation (an operator verifying a lane, a CI check, a fixture replay) has no such fact; and the answer would be invisible, which is worse than an explicit refusal.
- **Why rejected:** The fact it injects does not exist for the invocation shapes the family serves; where it does exist, it is derived from the same local context, so it collapses into ALT-1 with extra machinery.

### Alternative 4 — An Environment Variable (for example `JAISHIP_WORK_ITEM_REF`)

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** The composition reads a declared environment variable.
- **Constraint compliance:** C-1 fails outright (F-3 / `AC-F3-4`); C-5 fails because simulate would inherit an ambient value; the redaction and credential-reference surface would have to tolerate a new ambient read.
- **Driver fit:** Fails 2, 3, 6.
- **Pros:** Trivial to plumb.
- **Cons:** A new ambient input is the class this change exists to remove from the provider path ("a delivery runs with the shell hook and profile files disabled" — an env var is the same shape of hidden input).
- **Why rejected:** It contradicts the change's central claim.

### Alternative 5 — Window-Only Evaluation When No Ref Resolves

- **Eligibility:** Not eligible (fails C-2 and C-4).
- **Summary:** When the ref is unresolvable, skip `ticket` budgets and evaluate `window` budgets anyway.
- **Constraint compliance:** C-2 fails — a window budget's read is ref-scoped, so "window without ref" means an all-refs fold that does not exist; measuring something else breaks the `spend --ref` parity clause. C-4 fails — skipping an enabled `ticket` budget is a silent clear of a declared ceiling. C-5 fails for simulate, which has no reason to be incomplete.
- **Driver fit:** Fails 1, 4, 6; ostensibly good on 8.
- **Pros:** The run continues and window ceilings still apply.
- **Cons:** Two different meanings of "budget" depending on whether a context exists; a per-ticket ceiling that silently does nothing is worse than a refusal, because the operator believes it is enforced.
- **Why rejected:** It converts an unevaluable ceiling into an invisible one.

## Decision

- **Decision:** Adopt **ALT-1**, with the seam, precedence, refusal, and fixture field below.

### D1 — One ref seam, and which members it serves

`ProviderCommandRuntime` gains **one** member: `resolveWorkItemRef(): { readonly ref: string } | { readonly ref: null }`. The composition supplies it from `readLocalPmContext({ path, fs })` with the same path the delivered surfaces use (`<cwd>/.ai/local/pm-context.yaml`) and returns `context.ok ? context.context.activeChange?.workItemRef : null`. The seam performs no store read, no fence, no write, and reads no environment variable.

The requirement is attached to **budget evaluation**, not to the family:

| Member | Calls the seam? | Requires a ref? |
|---|---|---|
| `provider resolve` | yes, once per invocation, **only when at least one enabled budget is declared** | yes, when an enabled budget is declared |
| `provider simulate` | **never** — its ref comes from the fixture (D7) | yes, when the resolved configuration declares an enabled budget, from the fixture |
| `provider quota` | never | no |
| `provider parks list` | never | no |
| `provider profile resolve` | never | no |
| `provider watch status` | never | no |
| `provider migrate legacy` | never | no |

This **tightens** the option space rather than departing from it: the seam exists once for the family, but only the two members that evaluate a budget depend on it. A read-only member that refused because a `window` budget exists in configuration would be an over-refusal with no measurement behind it (C-6). Budget evaluation also happens **before** resolution, in the composition edge (TDR-0058 D2), so the ref is resolved once, not once per entry.

A value that fails `SPEND_WORK_ITEM_REF_PATTERN` is treated as **unresolvable**, not passed to the fold: the delivered `spend` path validates `--ref` against the same pattern, and a malformed context value that reached the ledger read would fail with a store identity that misdescribes the cause.

### D2 — Precedence

One rule, three tiers:

1. **An explicitly supplied ref-bearing fact wins.** Today exactly one surface has one: the simulate fixture's `workItemRef`.
2. **Otherwise the local delivery context is the fallback** — the identical precedence `spend` declares (`--ref` wins; the context answers an omitted `--ref`).
3. **Otherwise the ref is unresolvable** and the evaluation refuses (D4).

Two corollaries, both deliberate:

- **A hermetic surface has no context tier.** Simulate is tier 1 only. It is the surface whose bytes must decide identically everywhere (C-5), so consulting a working-directory file would make the fixture incomplete.
- **No production member has a caller-supplied ref**, because no flag is added (C-1), so in production the local context is the sole tier. That is not a degenerate case: it is the delivered answer for the same question.

### D3 — When the ref is required, precisely

The ref is required **exactly when the evaluation performs a budget read**, which is decided by configuration, not by the resolution outcome:

- **No enabled budget declared** → no read, no seam call, no refusal. The delivered behaviour is unchanged, and `provider resolve` outside a delivery context keeps working exactly as today.
- **At least one enabled budget declared** (either scope) → one read is required, therefore one ref is required. A disabled budget is inert (no read, no condition, no requirement — TDR-0058 D1).
- The need is determined before resolution and does not depend on which entry the resolver would have reached: a `budget-scope` refusal must not be a function of chain order, or the same configuration would refuse or pass depending on a provider's current state.

### D4 — Unresolvable ref: one typed refusal reusing `input.value.rejected`

When a budget read is required and no ref resolves, the decision answers **one** refusal:

- **Identity:** `input.value.rejected` (`kind: "input"`), projected to exit `1` (`user-validation`).
- **Content:** the enabled budget name(s) that require measurement, that the budget measures the work item's spend ledger, that no active change context was found at `<cwd>/.ai/local/pm-context.yaml`, and the remedy — run inside an active delivery context (the change the delivery is working) or disable/narrow the budget. For simulate the content names the fixture field: `workItemRef` is required when the configuration declares an enabled budget.
- **Timing:** before any resolution, probe, credential read, transport call, or state write. No park is created and no announcement is emitted on this path.

**Why `input.value.rejected` and not a new `provider.budget.*` identity.** The condition is "the request cannot be served because a required input is absent", which is precisely what the delivered identity means and precisely what the sibling surface answers for the same condition: `spend` returns `input.value.rejected` with "no active change context" when `--ref` is omitted and no context exists. A second identity would make two commands disagree about one missing context; it would add a fourth provider row and move the error-table counts a second time in a change that already moves them for three declared rows (`AC-F8-1`); and it would create a `provider.budget.*` prefix for a condition that is not about a budget's value but about the absence of an identity. The refusal is typed either way — envelope, registered identity, projected exit — so reusing the delivered identity costs nothing in rigour. The candidate identity a reviewer might prefer, `provider.budget.ref-unresolved`, is **named and rejected** here for exactly those reasons; if the owner prefers a distinct row, it is an additive error-table decision with its own count movement, and this record's semantics (refuse, never clear) do not change.

### D5 — An enabled `ticket` budget when the ref is unresolvable

- It is **never** measured as zero. Verified-empty telemetry means "this ref has no spend yet" (TDR-0058 C-5); a missing ref means "there is no ref", which is a different fact and must not borrow that identity.
- It is **never** skipped as clear or as an inert budget. Disabled is a declared operator choice; unresolvable is a missing fact.
- It is **never** converted into a window-only evaluation (ALT-5). A `ticket` ceiling's lower bound *is* the ref's beginning (Appendix C), so without a ref the ceiling has no definition.
- It **refuses** once, per D4, before resolution.

The same rule applies to a `window` budget (D6), so there is no scope-dependent branch in the refusal. One rule for every enabled budget is simpler to state, simpler to test, and impossible to get subtly wrong.

### D6 — May a window-only evaluation proceed without a ref? No.

A window budget is bounded by `now − windowSeconds`, so its *lower bound* is ref-free — but its *measurement* is not: the port's one read is `readSpendLedger(store, workItemRef)`, and `AC-F2-2` requires the measured figure to equal `spend --ref` for the same selection and instant. Measuring all refs instead would (a) be a different population, (b) be a second measurement path (TDR-0058 C-1 forbids it), and (c) break the parity clause the test plan asserts. Therefore the ref is required whenever **any** enabled budget is evaluated; the scope kind changes only the lower bound and the outcome at a crossing. A future all-refs fold would reopen this (see the revisit trigger), not a local exception.

### D7 — The simulate fixture gains `workItemRef`

`delivery.provider.simulate.v1` gains one optional field:

| Key | Shape | Required | Meaning |
|---|---|---|---|
| `workItemRef` | canonical uppercase work-item ref (`SPEND_WORK_ITEM_REF_PATTERN`, the same shape `spend --ref` validates) | required **iff** the resolved configuration declares an enabled budget (either scope); accepted otherwise | The work item whose spend ledger the fixture's `spend` block stands for. It is a declared fact, not a read: the fixture never touches a ledger, a store, or the local context. |

- **It is not a policy input.** The `spend` block still supplies the points; the ref only names whose ledger those points stand for, so a `ticket`-scope replay is possible and the parity test can compare `resolve` and `simulate` on identical facts.
- **It is disclosed**, not inferred: the payload's `simulation` block gains one optional `workItemRef`. This is an additive amendment to TDR-0059 D4's enumeration of that block; the **resolve** keys (`summary`, `chain`, `decision`, `skipped`, `parks`, `announcements`) are untouched, so TDR-0059 C-5 still holds.
- **It joins v1, not v2.** v1 has never shipped: the family is unreachable in production (TDR-0062) and TDR-0059 is `Proposed`. A version bump for an unshipped schema would be ceremony that pins a field to a version no reader ever saw. If v1 has shipped by delivery time, the field goes into `v2` — that is a revisit trigger, not a judgement call at implementation time.
- **Absent when required** refuses `input.value.rejected` naming the field, before evaluation, with no fixture content echoed (TDR-0059 C-4).
- **Invalid shape** refuses the same way, with the same bounded summary, because the pattern is the declared shape test.

### D8 — Nothing else moves

No new environment variable; no new provider flag; no new error row (D4); no new state record kind; the `DM-3` port signature unchanged; no change to `spend`, `metrics`, or the dispatch resolvers. The only additions are one runtime seam, one fixture field, one disclosure field, and one refusal.

### D9 — Disclosure of the measured ref

The ref the gate measured must be visible where the operator needs it, without changing a pinned shape:

- A **budget park or crossing announcement message** states the measured ref (message text is not the evidence allowlist; TDR-0058 D5 fixes exactly five evidence fields, and this record does not add a sixth).
- A **refusal** (D4) names the budget(s) and the missing context; for simulate it names the fixture field.
- The **`provider resolve` `data` shape is unchanged**: no key is added, because TDR-0059 C-5 and the delivered resolve payload pin it, and a ref belongs to the evaluation's identity rather than to its decision. If an operator needs a machine-readable "which ref did the gate use", that is a read-side surface of its own (an additive decision), not a silent widening of the resolve payload.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies C-1 through C-6. No accepted-risk exceptions are taken. Two consequences are recorded rather than treated as exceptions: the gate inherits the local context's lifecycle (so an invocation outside a delivery context with an enabled budget refuses instead of clearing — the fail-loud direction), and the simulate fixture gains its first identity field (declared in v1 because v1 cannot have shipped, with the v2 trigger recorded).

**Reversal.** Removing the seam, the fixture field, and the refusal restores today's behaviour: the port is still injected, so tests still pass; the only loss is that a `ticket` budget has no production subject, which is exactly the state this record exists to prevent. A flag, if ever required, is an additive member of the same grammar.

## Trade-offs & Consequences

### Positive Outcomes

- The gate, the spend report, and the burn-rate alarm measure one delivery with one resolver: 0 drift.
- No new operator input, no environment variable, no flag; the tool answers a question it can already answer.
- An unevaluable ceiling refuses loudly instead of passing silently, which is the only behaviour compatible with the owner's cost directive.
- Offline replay of a ticket-scope scenario becomes possible, and the parity test can compare `resolve` and `simulate` on budgets for the first time.
- Read-only members keep working outside a delivery context, so the mount does not degrade existing ergonomics.

### Negative Outcomes

- The gate depends on an ephemeral, git-ignored local context. A CI composition with no checkout context and an enabled budget will refuse until a deliberate source exists (declared, not hidden).
- A malformed context value is treated as unresolvable, so a corrupted context file blocks budget evaluation with an `input` identity rather than a store identity — accurate, but a new refusal cause operators must learn.
- The fixture gains a field that is redundant when no budget is declared; the strict schema accepts it but does not require it, so a fixture author can declare a ref that changes nothing.
- The refusal reuses an `input` identity for a condition that is partly contextual; the message must therefore carry the whole story (budget, context path, remedy) or the identity will read as a generic invocation error.

### Unresolved Questions

- [ ] Whether a CI composition without a local context needs a declared source before M4-S5 (owner: `@pm`; recommendation: no — this change's CI posture is test-driven, and a real need is a new composition fact with its own producer).
- [ ] Whether the measured ref belongs in the park evidence allowlist as a sixth field (owner: `@spec-writer`; recommendation: no — the message carries it, and the allowlist is a closed set with a declared size).
- [ ] Whether `readLocalPmContext` should expose "context present but no active change" distinctly from "no context file" (owner: `@doc-syncer`/`@spec-writer`; recommendation: the refusal summary already distinguishes them by naming the path and the missing active change; no contract change).

## Implementation Plan

1. **Contracts.** Add `resolveWorkItemRef` to `ProviderCommandRuntime` (declaration only); add `workItemRef` to the simulate fixture type and the `simulation` block type; no port change.
2. **CLI.** Resolve the ref once per invocation in `provider resolve`, only when configuration declares an enabled budget; validate against `SPEND_WORK_ITEM_REF_PATTERN`; emit the D4 refusal before any edge call.
3. **Composition.** Supply the seam in `packages/cli/src/production.ts` from `readLocalPmContext` with the delivered path; supply nothing to the read-only members.
4. **Simulate.** Parse and validate the fixture field; require it when the resolved configuration declares an enabled budget; never read the local context; disclose it on `simulation`.
5. **Evidence and messages.** Include the measured ref in budget park/crossing announcement messages; include the budget set, the context path, and the remedy in the refusal.
6. **Tests.** Parity with `spend --ref`; the unresolvable matrix (no file, unreadable, malformed, no active change) for both scopes; zero seam calls on the five read-only members; zero context reads in simulate; paired-run byte equality across working directories; absent/invalid fixture field refusals.
7. **Docs.** Provider-engine (ref rule, precedence, refusal), spend (the gate consumes the same resolver and the same fold), the provider reference page (per-member ref requirement), and the simulate fixtures page (the new field and its requiredness).

## Verification Criteria

- Metric: budget evaluations whose measured ref differs from the ref `spend` resolves for the same invocation facts — Target: 0 — Window: GH-350 CI.
- Metric: ticket-scope budgets silently skipped, zeroed, or downgraded to window-only when the ref is unresolvable — Target: 0 — Window: GH-350 CI (unresolvable matrix).
- Metric: refusals caused by a missing context when no enabled budget is declared — Target: 0 — Window: GH-350 CI (the five read-only members plus budget-free `resolve`).
- Metric: local-context reads, environment reads, and store reads during `provider simulate` — Target: 0 each — Window: GH-350 CI.
- Metric: new environment variables and new provider flags — Target: 0 each — Window: review + variant scan.
- Metric: new error rows introduced by the ref rule — Target: 0 — Window: `error-table-sync`.
- Metric: state writes during ref resolution and budget evaluation — Target: 0 — Window: byte snapshot.

## Confidence Rating

**High.** The seam, the path, the null-shape, and the refusal wording already exist in three delivered surfaces; the change is adopting them rather than inventing them. The medium-confidence elements are the CI-outside-a-checkout case (declared as a known gap with a revisit trigger) and the treatment of a malformed context value as unresolvable (fail-closed, but a new cause operators will see).

## References

- [TDR-0058](TDR-0058-budget-ceilings-park-before-spend-injected-spend-totals.md) — the budget gate, the port, and the park/refusal split this record supplies the subject for.
- [TDR-0059](TDR-0059-provider-simulate-fixture-and-zero-write-simulation.md) — the fixture this record adds one field to.
- [TDR-0062](TDR-0062-provider-family-mounting-27th-prompt-required.md) — the mount that makes the family reachable.
- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — no silent clear.
- Feature specs: [Provider Engine](../spec/features/feature-provider-engine.md), [Spend](../spec/features/feature-spend.md).
- Delivered seams: `packages/cli/src/commands/spend.ts` (`resolveActiveRef`), `packages/cli/src/production.ts` (`readLocalPmContext` call sites), `packages/core/src/contracts/spend.ts`.
- Readiness evidence: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/readiness-review/readiness-iter-1.md` (B2).
- Change: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/`.
