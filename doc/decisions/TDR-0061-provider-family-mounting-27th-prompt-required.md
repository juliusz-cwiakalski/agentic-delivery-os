---
id: TDR-0061
decision_type: tdr
status: Proposed
created: 2026-11-19
decision_date: null
last_updated: 2026-11-19
summary: "GH-350: the provider family (`resolve`, `quota`, `parks list`, `profile resolve`, `watch status`, `simulate`, `migrate legacy`) is mounted as the twenty-seventh and last prompt-required family, appended after `install`. `install` stays the twenty-sixth, `supervise` stays the twenty-fifth, and every delivered ordinal is unchanged; what moves is the family count 26 → 27 and the tail: `install` stops being last and `provider` becomes the last member. The command definition is delivered but the family is neither mounted nor composed in production, so the change adds both membership and the `ProviderComposition` seam the config program already consumes. The declared conformance surface moves in one change — prompt-required membership, the six-runtime production composition seam, one family help entry plus seven member entries, a coverage row in both directions, the M1 reference page completed to carry `--help`/`--version`, and every pinned count/tail assertion — and reachability is proven through the production composition with a negative control, because the delivered tests drove `createConfigProgram`/`runCli` and never `runEntrypoint`, which is how an unreachable family stayed green. Internal-only and partial-mount alternatives are rejected: they falsify the ticket's 'complete and document' and 'offline verification' operator claims and split one reference page across two truths."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider policy: CLI composition, help inventory, and reference documentation"
decision_scope: repo
review_date: null
business_impact: "GH-350's verification bar and the M4 flip both depend on an operator being able to run the provider policy surface through the installed binary. An unreachable family makes the story's operator claims false regardless of how much engine work lands."
customer_impact: "An operator inspects routing, quota, parks, profiles, watches, replays a decision offline, and migrates legacy shell policy through the installed product — the same command surface and the same help/exit contract as every other family — instead of through a command that answers `fallback.invocation`."
classification:
  domains: [architecture, tooling, contracts, operations, documentation]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: high
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-350 Definition-of-Ready iteration 1, blocking finding B1: the family is unreachable in the production composition)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; AI does not accept this R2 record"
  contributors:
    - "@decision-advisor (repository analysis and this record)"
    - "@readiness-reviewer (B1: the observed binary behaviour and the vacuous conformance cases)"
    - "@pm (GH-350 clarify-scope: the ticket's 'complete and document' and 'offline verification' claims)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-350 PR review — this record widens the product surface and moves a pinned count)"
  performers:
    - "@spec-writer (carry the mount, the count movement, and the reachability AC into the change spec)"
    - "@test-plan-writer (reachability case, negative control, count/tail oracles)"
    - "@coder (membership, production composition seam, help entries, coverage row, reference page)"
    - "@doc-syncer (CLI entrypoint page, glossary, index, install-lifecycle count sites)"
  informed:
    - "M4-S7 prompts that call the provider family"
    - "M4-S8 shell-wrapper rewrite (the legacy hook story this family replaces)"
    - "Flip F2/F6 evidence owners"
    - "Any later family author: the tail-append rule now has three precedents (metrics, supervise, install, provider)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A second family must be appended: append after `provider` and move only the count and the tail again. Never renumber a delivered family, because five delivered pages state `install`'s ordinal and `supervise`'s ordinal, and the documentation-conformance table pins `supervise`'s to guard against exactly that over-correction."
  - "The M1 reference page becomes the wrong home (a later milestone rewrites the provider surface wholesale): create the milestone page and add the `pageFor` branch then, and declare the M1 page a snapshot — do not fork the page now."
  - "A family is mounted without a reachability case through `runEntrypoint`: treat it as a defect in this decision's pattern, not a style choice. The delivered defect class is a family that passes `pnpm check` and cannot be invoked."
  - "The composed set grows enough that the static help inventory becomes a maintenance cost (for example a generated inventory): the count and tail assertions move with the generator, not against it."
  - "The alias needs an identity-specific refusal for a provider member: that is an ownership decision (TDR-0044 §3 pattern) and must be a new record; provider is deliberately identity-neutral today."
links:
  related_changes: ["GH-350", "GH-346"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-cli-entrypoint.md"
    - "doc/spec/features/feature-provider-engine.md"
    - "doc/spec/features/feature-provider-profiles.md"
    - "doc/spec/features/feature-install-lifecycle.md"
    - "doc/spec/features/feature-metrics.md"
    - "doc/planning/oss-tooling/milestones/m1/commands/provider.md"
    - "doc/changes/2026-11/2026-11-19--GH-350--provider-policy/chg-GH-350-spec.md"
  contracts:
    - "packages/cli/src/help/prompt-required-commands.ts"
    - "packages/cli/src/help.ts"
    - "packages/cli/src/entrypoint.ts"
    - "packages/cli/src/production.ts"
    - "packages/cli/src/edge.ts"
    - "scripts/checks/help-guide-coverage.ts"
    - "tests/fixtures/help-guide/coverage.json"
    - "tests/fixtures/metrics/mounting.ts"
    - "tests/fixtures/supervise/mounting.ts"
    - "tests/fixtures/entrypoint/alias-baseline.json"
  diagrams: []
  decisions: ["TDR-0044", "TDR-0058", "TDR-0059", "TDR-0060", "TDR-0062", "ADR-0007"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S4"]
---

# TDR-0061: Provider Family Mounting — The Twenty-Seventh and Last Prompt-Required Family, Appended After `install`

## Context

- **FACT:** `packages/cli/src/commands/provider.ts` exports `createProviderCommandDefinition` and the delivered provider grammar (`resolve`, `quota`, `parks list`, `profile resolve`, `watch status`), with its tests. The command definition therefore exists, but the family is **neither mounted nor composed** in production: `createConfigProgram` registers it only when it is handed a `provider` seam (`packages/cli/src/edge.ts:4978`, inside `if (options.provider !== undefined)`), and the production composition builds its `configured` options with **no** `provider` key (`packages/cli/src/production.ts:4347-4574`). Executed 2026-11-19, `createProductionComposer(...)(brand)` composes **27** commands and `provider` is not among them; the one non-declared command it does compose is `config`.
- **FACT:** The family is **not mounted** in the production entrypoint. `packages/cli/src/entrypoint.ts` composes through `selectPromptRequiredProgram`, which copies exactly `PROMPT_REQUIRED_COMMANDS` and drops every extra registration. `provider` is absent from that set (`packages/cli/src/help/prompt-required-commands.ts`, 26 names, `install` last).
- **FACT:** The consequence is observable on the built artifact: `jaiship --help` lists 43 commands and no `provider`; `jaiship provider quota` answers `fallback.invocation` ("unexpected argument"); `jaiship provider --help` answers `unknown flag "--help"` (readiness review iteration 1, B1, observed 2026-11-19).
- **FACT:** `packages/cli/src/help.ts` has **zero** provider entries, and `tests/fixtures/help-guide/coverage.json` has no provider row, so `pnpm check:help` neither knows nor requires the family. `scripts/checks/help-guide-coverage.ts` iterates `PROMPT_REQUIRED_COMMANDS` only.
- **FACT:** A provider reference page exists at `doc/planning/oss-tooling/milestones/m1/commands/provider.md`, is manually maintained, and contains **neither** `--help` nor `--version` — the two strings the coverage gate requires — so the page would fail the gate the moment the family joined the set.
- **FACT:** The delivered pages state the mounted family count as 26 in specific, enumerable sites: `doc/spec/features/feature-cli-entrypoint.md` ("twenty-six families", "the `install` family is the twenty-sixth and last"), `doc/spec/features/feature-install-lifecycle.md` ("Prompt-required families: exactly 26", "exactly 26 families"), `doc/spec/features/feature-metrics.md` ("mounted family count (26)"), `doc/00-index.md` ("the twenty-six-family prompt-required set"), `doc/overview/glossary.md` ("twenty-six families: … and `install`"), and `.changeset/install-lifecycle-minor.md` ("twenty-six prompt-required families"). `feature-ceremony-runner.md` and `feature-supervise.md` carry no count; `feature-supervise.md` carries `supervise`'s **ordinal** ("25th"), which is not a count.
- **FACT:** The count is pinned in code and tests: `tests/structure/entrypoint-bin.test.ts` (the literal 26-element array and a rendered-line count of 26), `tests/structure/supervision-mounting.test.ts`, `metrics-mounting.test.ts`, `steer-mounting.test.ts`, `install-conformance.test.ts`, `events-production-composition.test.ts`, `daemon-production-composition.test.ts`, `board-mounting.test.ts`, `dispatch-attempts-composition.test.ts`, `tests/behaviour/entrypoint-two-bins.test.ts`, `repos-help.test.ts`, `board-help.test.ts`, `events-mount-help.test.ts`, `install-family-surface.test.ts`, `tests/checks/install-conformance-mutants.test.ts`, and `tests/checks/doc-conformance.test.ts`'s phrase table. Two fixtures hold the expected set: `tests/fixtures/metrics/mounting.ts` (`MOUNTED_FAMILIES`, `PINNING_FILES`) and `tests/fixtures/supervise/mounting.ts`.
- **FACT:** `tests/fixtures/entrypoint/alias-baseline.json` pins the alias's `--help` bytes. The baseline was regenerated deliberately for GH-346's twenty-sixth family, and its provenance note records that only the help cell's `Commands` list changed.
- **FACT:** The ticket requires "complete and document `provider resolve|quota|parks|profile|watch`" and "policy simulation (`provider simulate`) for offline verification", and one ticket AC is "a delivery runs with the shell hook and profile files disabled". The change spec's `AC-F4-1`, `AC-F5-1`…`AC-F5-3`, and `AC-F8-3`/`AC-F8-4` are all operator-surface claims. `AC-F8-4` currently asserts "the family count unchanged at 26" and that the reference page "contains `--help` and `--version`" — the second clause is vacuous today because the page contains neither and the gate does not cover it.
- **FACT:** The delivered suite is green because tests drive the command layer (`createConfigProgram` / `runCli`) and never `runEntrypoint`. A family can therefore be fully implemented, fully tested, and unreachable.
- **Why now:** GH-350 is the change that completes the provider surface. Delivering `simulate` and `migrate` into an unmounted family would add two more members nobody can invoke and would leave the story's own acceptance criteria false at merge.

## Problem Framing (Clarified)

The question is not "should the provider family be reachable" — the ticket, the flip's verification bar, and three acceptance criteria already require it. The delivery proves the family was built and then never wired: the command definition exists, the config program can register it, a reference page exists — and yet production supplies neither the family's runtimes nor a declarative entry. The residual question is therefore narrow and mechanical:

1. **Where in the order?** Two positions are defensible: append as the twenty-seventh and last, or insert before `install` and push `install` to twenty-seventh. They are not equivalent in cost. `install`'s ordinal ("the twenty-sixth prompt-required family") is stated in five delivered pages and pinned in the documentation-conformance table; `supervise`'s ("25th") is pinned there as a **guard against over-correction**. Appending after `install` leaves every delivered ordinal true and moves exactly two things — the count and the tail. Inserting before `install` renumbers a delivered family for no operator benefit and falsifies prose that GH-346 deliberately made true.
2. **What does "mounted" cost?** A mounted family is not one array entry. It is membership, a help entry per invocation path, a coverage inventory row in both directions, a reference page that satisfies the gate, every pinned count, and — for this family — the `ProviderComposition` seam in the production composition, because the definition exists without the runtimes. This cost is enumerable, and §5 enumerates it. Naming it is the point: the GH-346 precedent is that an undeclared conformance surface is discovered as breakage.
3. **How is reachability proven so this cannot recur?** The delivered defect has two halves — a composition gap (no membership, no production seam) and a **vacuous proof**: tests exercised the command layer and the composition, and never the composition **as the entrypoint restricts it**. Any acceptance criterion that does not go through `runEntrypoint` reproduces the defect. The proof therefore needs two arms — positive (every member answers through the production composition) and negative (the filter still rejects an unmounted family) — so the test fails by name if either the mount or the filter changes.

The framing that follows: **mount the whole family as the twenty-seventh and last member, add the `ProviderComposition` seam production is missing, pay the enumerated conformance cost in one change, and prove reachability through the entrypoint with a negative control.** Alternatives that keep the family internal, mount a subset, or renumber `install` are rejected below on the ticket's own claims or on delivered-prose falsification.

## Constraints (Hard Requirements)

### C-1: Every provider member is reachable through the production composition

- **Statement:** `provider resolve`, `provider quota`, `provider parks list`, `provider profile resolve`, `provider watch status`, `provider simulate`, and `provider migrate legacy` must each reach the family handler when invoked in the shape the installed binary invokes, with no `fallback.internal`, no `fallback.invocation`, and no `unknown flag` on `--help`.
- **Source:** AC (ticket: "complete and document `provider resolve|quota|parks|profile|watch`"; "policy simulation for offline verification"); change spec `AC-F4-1`, `AC-F5-1`…`AC-F5-3`, `AC-F8-3`, `AC-F8-4`.
- **Verification:** Test — each member driven through `runEntrypoint` with the production composer; 7/7 handler paths and 8/8 help surfaces at exit 0.
- **Negotiable:** no.

### C-2: The composition filter stays honest and unchanged in behaviour

- **Statement:** `selectPromptRequiredProgram` still copies exactly the declared set and still drops extras; a missing prompt-required member still throws and is contained as `fallback.internal` at exit `2`. The mount adds a member; it does not weaken the filter or introduce a second registration path.
- **Source:** Prior decision (TDR-0044 §2); `packages/cli/src/entrypoint.ts`; change spec §Composition.
- **Verification:** Test — a case-local mutation that omits `provider` from the declarative set answers `fallback.internal` at exit `2` (the delivered mutation pattern in `tests/structure/daemon-production-composition.test.ts:141-153`); an extra synthetic family is dropped from the selected program.
- **Negotiable:** no.

### C-3: Conformance is declared and lands in one change

- **Statement:** Membership, help entries for the family and all seven member paths, the coverage inventory row and its reference-page row, the reference page's `--help`/`--version`, the page-root resolution, and every pinned count and tail assertion move in the same change, so `pnpm check` and `pnpm check:help` are green as a consequence rather than by omission.
- **Source:** `pnpm check`; `scripts/checks/help-guide-coverage.ts`; `scripts/checks/prompt-conformance.ts`; TDR-0044 C-5.
- **Verification:** `pnpm check` green on the change branch; the help-coverage mutants suite shows the provider row can fail by name.
- **Negotiable:** no.

### C-4: No delivered ordinal is falsified

- **Statement:** After the change, `supervise` is still the twenty-fifth family, `install` is still the twenty-sixth, `steer` the twenty-third, `metrics` the twenty-fourth, and `provider` is the twenty-seventh. No delivered page, test, or phrase-table guard states a false ordinal.
- **Source:** Delivered truth (`doc/spec/features/feature-cli-entrypoint.md`, `feature-supervise.md`, `feature-metrics.md`, `feature-ceremony-runner.md`); `tests/checks/doc-conformance.test.ts` (the `feature-supervise.md` row's stale phrase `"26th family"` is the delivered guard against over-correcting an ordinal).
- **Verification:** Documentation conformance plus a review of every ordinal site; the `feature-supervise.md` row is left byte-unchanged.
- **Negotiable:** no.

### C-5: Provider stays identity-neutral

- **Statement:** The family is composed for both executable identities with no new role fact and no new refusal; no ownership question is opened, and no pre-freeze namespace becomes creatable through a provider member. Identity neutrality is about **identity**, not about writes: no member gains a bin declaration, a role fact, or an identity-specific refusal, and every member's write set is the same under either bin. The members that only read (`quota`, `parks list`, `watch status`, `simulate`) write nothing under either bin; `resolve` writes only its delivered park and announcement records; `profile resolve` writes only the delivered profile-target record when the delivered lifecycle appends one; `migrate` writes only the files its delivered `--write` path names.
- **Source:** Prior decision (TDR-0044 §3 ownership rule); GH-320 §8.5 declared-divergence discipline; change spec `NG-11`.
- **Verification:** Review — no bin declaration changes; `install.identity.not-owning` untouched; each member's write set is identical under either bin (read-only members write nothing; `resolve` only its park/announcement records; `profile resolve` only its profile-target record; `migrate` only under `--write`).
- **Negotiable:** no.

### C-6: The mount adds no new error identity and no new state kind

- **Statement:** The mount introduces no error-table row, no state record kind, and no write path; a provider member's failures are the delivered provider/config/state identities or the containment identity.
- **Source:** Change spec `NG-11`, `NG-12`; TDR-0058 C-6 (lean-process driver).
- **Verification:** `error-table-sync` green with unchanged counts; no record-kind registration.
- **Negotiable:** no.

> **Table stakes:** the static-help five-section contract (`usage`, `options`, `examples`, `exit codes`, `see also`), the redaction chokepoint, the `{0,1,2}` exit projection, and the bounded-output rules are delivered and unchanged; they are not scored.

## Decision Drivers

**Technical drivers (ranked):**

1. **Reachability by the agent team** — the surface must be invocable through the installed binary, because that is the only surface M4 EC-7 lets a prompt call.
2. **Truth of the delivered ordinals** — the composition's order is documented and pinned; a mount that renumbers a delivered family converts a mechanical change into a documentation rewrite with a falsehood window.
3. **One conformance surface, declared once** — membership plus help plus coverage plus count is a bounded, enumerable diff; leaving the family internal is an unbounded "why can't I run this" support cost.
4. **Non-vacuity of the proof** — a test that cannot fail is worse than no test, because it certifies the thing that is broken.
5. **Minimum product-surface widening** — the family already exists and already documents itself; the widening is membership plus the composition seam that supplies its delivered runtimes, not new capability.

**Operational drivers:**

6. **Single documented truth per family** — one reference page, one help inventory, one coverage row; a partial mount would split the family's documentation across an operator surface and an internal half.
7. **Legibility for the operator** — root help, family help, and member help resolve for what the ticket tells the operator to run.
8. **Reversibility** — the mount is removable by one array entry plus its artefacts, exactly as TDR-0044's reversal states.

*(Overlap check: reachability, filter honesty, conformance completeness, ordinal truth, identity neutrality, and additivity are gates C-1…C-6 and appear above only as ranking values — "how much of the required surface arrives per unit of new contract". The gates decide eligibility; the drivers rank the survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-350 DoR iteration 1, B1).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review. The AI does not accept this R2 record.
- **Contributors:** `@readiness-reviewer` (the observed artifact behaviour and the vacuous cases); `@pm` (ticket scope); `@decision-advisor` (analysis and this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, human owner.
- **Performers:** `@spec-writer` (mount, count movement, reachability AC); `@test-plan-writer` (reachability + negative control + count/tail oracles); `@coder` (membership, production composition seam, help, coverage, page); `@doc-syncer` (page set).
- **Informed:** M4-S7 prompt rewrite, M4-S8 wrapper rewrite, flip evidence owners, future family authors.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The command definition exists but the family is neither mounted nor composed in production: `configured` carries no `provider` key and the entrypoint's filter copies only the declared set | FACT | `packages/cli/src/edge.ts:4978` (guarded by `options.provider !== undefined`); `packages/cli/src/production.ts:4347-4574`; executed composer: 27 commands, no `provider`, `config` the only non-declared member; `packages/cli/src/entrypoint.ts` (`selectPromptRequiredProgram`), 2026-11-19 | The mount would be membership alone; it is not — it also carries the `ProviderComposition` wiring | High |
| The built binary answers `unknown flag "--help"` / `fallback.invocation` for the family | FACT | GH-350 readiness iteration 1, B1, `node_modules/.bin/jaiship` observations, 2026-11-19 | If the family were reachable, this record would be unnecessary | High |
| `help.ts` holds no provider entry and `coverage.json` no provider row | FACT | `packages/cli/src/help.ts`; `tests/fixtures/help-guide/coverage.json`, read 2026-11-19 | The conformance cost would be lower by two artefacts | High |
| The M1 provider page lacks both `--help` and `--version` | FACT | `doc/planning/oss-tooling/milestones/m1/commands/provider.md`, read 2026-11-19 | The page would already satisfy the gate and C-3 would shrink | High |
| The default `pageFor` root is the M1 commands directory, which already holds `provider.md` | FACT | `scripts/checks/help-guide-coverage.ts` (`PAGE_ROOT`), read 2026-11-19 | A `pageFor` branch and an M4 page would be required | High |
| Twenty-six is pinned in the enumerable test and fixture set listed in Context | FACT | repository grep over `tests/**`, `doc/spec/**`, `doc/**`, `.changeset/**`, read 2026-11-19 | Some pinned site would move silently and `pnpm check` would fail late | High |
| `install`'s ordinal and `supervise`'s ordinal are stated in delivered pages and guarded by the phrase table | FACT | `feature-cli-entrypoint.md`; `feature-supervise.md`; `tests/checks/doc-conformance.test.ts` rows, read 2026-11-19 | Insert-before-`install` would be cheap and ALT-4 would compete | High |
| The alias `--help` bytes are a pinned baseline whose only count-bearing cell is the `Commands` list | FACT | `tests/fixtures/entrypoint/alias-baseline.json` `captureProvenanceNote`; `tests/behaviour/entrypoint-two-bins.test.ts:174`, read 2026-11-19 | The baseline would need a broader regeneration | High |
| Tests never drive `runEntrypoint` for this family, which is why the suite stayed green | FACT | GH-350 readiness iteration 1, B1; `tests/structure/*mounting*.test.ts` use the production harness; `createConfigProgram` direct | The vacuity diagnosis would be wrong and the new case would not close the class | High |
| A single appended family is the right unit (not a subset) | ASSUMPTION (product judgement, accepted by the owner at PR review) | This record §4, §6 | A subset mount would be defensible and the ticket's "complete" claim would weaken | Medium-High |
| Operators read the M1 page as the family's current reference rather than as a frozen milestone snapshot | ASSUMPTION | Page content ("Shipped behavior summarized"); `pageFor` mapping; the `verify` precedent (`verify` is served from an M1 page) | A new M4 page plus a branch would be the correct low-risk move instead | Medium |
| The changeset file is still pending (unreleased) so its count may move | TO-CONFIRM | `.changeset/install-lifecycle-minor.md` present in the tree, read 2026-11-19 | If already consumed by a release it is historical and must not be rewritten | Medium |

## Mental Models & Techniques Used

- **First principles:** what must be true for an operator to run `provider resolve`? The command definition must exist, the production composition must supply its runtimes, and the composed program the binary selects must include it. The first is delivered as a definition only; the other two are missing — production hands `createConfigProgram` no `provider` seam, and the declarative set has no entry. Membership alone would make the filter throw on a declared-but-uncomposed member, so both the seam and the entry are required.
- **Inversion:** how does this fail? By mounting the array entry and forgetting the help entry (gate fails), by mounting help and forgetting the page's `--help` (gate fails), by mounting everything and renumbering `install` (five pages become false), by proving reachability through `createConfigProgram` (the test passes and the binary still refuses), or by mounting a subset (the family's page documents two truths). Each failure maps to a constraint or a matrix row.
- **5 Whys:** why is the family unreachable? It is absent from the declarative set, and production never supplies the `provider` seam, so the composed program has no family. Why? Because its only registration path is a conditional arm (`options.provider !== undefined`) that production does not satisfy. Why did nobody notice? Because the tests drove the command layer. Why did the tests drive the command layer? Because there was no case or oracle that required the entrypoint. Why? Because reachability was assumed from a registration arm that production never takes. The fifth answer is the defect class this record closes with a negative control.
- **Second-order thinking:** appending after `install` keeps every delivered ordinal true forever; inserting earlier would make ordinals a function of mount history and invite the next author to renumber again.
- **Systems thinking:** the count lives in one declaration and in ~20 derived assertions, two fixtures, one byte baseline, and six documentation pages. A mount is therefore a *propagation* task; the record's job is to enumerate the propagation so it is not discovered as breakage.
- **Boundary thinking:** what this record does **not** decide: the ref source for budget evaluation (TDR-0062), the fixture schema (TDR-0058), the migration grammar (TDR-0059), the watch freshness rule (TDR-0060), and the budget semantics (TDR-0057). The mount carries them; it does not re-decide them.
- **KISS:** one array entry, one six-runtime composition seam, eight help entries, one coverage row, one page edit, and mechanical count propagation — no new abstraction, no generated inventory.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 reachable | C-2 filter honest | C-3 conformance one change | C-4 ordinals true | C-5 identity-neutral | C-6 no new contract |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 leave the family internal (status quo) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 mount as the 27th and last, appended after `install` (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 internal-only **and** re-scope the ticket's operator ACs | ❌ (declines the requirement) | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 partial mount (`simulate` + `migrate` only) | ⚠️ (partial) | ✅ | ❌ (two truths for one family) | ✅ | ✅ | ✅ |
| ALT-4 insert before `install` (provider 26th, `install` 27th) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only for the mounted subset; none of the failures is claimed as an accepted-risk exception.

### Alternative 0 — Leave the Family Internal (Status Quo)

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Keep `provider` unmounted and uncomposed, exactly as it is today; `config` is the only command the production composition carries outside the declared set.
- **Constraint compliance:** Fails C-1 by construction — the family is not composed, so every member answers the containment identity.
- **Driver fit:** Best on 5; worst on 1, 4, 7.
- **Pros:** Zero conformance cost; nothing moves.
- **Cons:** The ticket's operator claims stay false; `simulate` and `migrate` would be delivered into a surface nobody can invoke; the flip's F2 evidence has no command to point at.
- **Why rejected:** It is the defect the story is chartered to fix, and it would be merged with green tests.

### Alternative 1 — Mount as the Twenty-Seventh and Last, Appended After `install` (chosen)

- **Eligibility:** Eligible (passes C-1 … C-6).
- **Summary:** `provider` joins `PROMPT_REQUIRED_COMMANDS` after `install`; the production composition gains the six-runtime `ProviderComposition` seam and registers the family unconditionally in the same shape as `install`; the family and its seven member paths gain help entries; the coverage inventory gains a command row and the existing M1 page row; the page gains `--help`/`--version` and the two new members; every pinned count and the tail move, and only the tail moves.
- **Constraint compliance:** C-1 by membership plus the production `provider` seam — neither alone suffices, because a declared-but-uncomposed member makes the filter throw; C-2 because the filter is untouched and a negative control proves it; C-3 with the matrix in §5 landed in one change; C-4 because appending leaves `supervise` 25th and `install` 26th; C-5 because no bin declaration, role fact, or refusal changes; C-6 because no error row or record kind is added.
- **Driver fit:** Best on 1, 2, 3, 5, 6, 8; good on 4 (see §6) and 7.
- **Pros:** Every delivered ordinal stays true; one mechanical tail move; one page (not two); the conformance cost is enumerated before delivery.
- **Cons:** `install` stops being last, so five "and last"/tail assertions and the alias help baseline move; the family becomes part of the product surface that later changes must not break.

### Alternative 2 — Keep It Internal and Re-Scope the Ticket's Operator ACs

- **Eligibility:** Not eligible (fails C-1 and declines an explicit requirement).
- **Summary:** Deliver `simulate` and `migrate` as internal command-layer members, and rewrite the ACs to claim only engine/test coverage.
- **Constraint compliance:** Fails C-1. It satisfies the letter of C-2…C-6 because nothing is added.
- **Driver fit:** Fails 1, 2, 3, 6, 7.
- **Pros:** No count movement, no help surface, no page work.
- **Cons:** Falsifies "complete and document `provider resolve|quota|parks|profile|watch`" and "policy simulation for offline verification" as **operator** claims; the ticket would have to be amended, which is an owner scope decision rather than an implementation choice; the delivered family would be permanently second-class.
- **Why rejected:** The ticket, not the implementer, decides the product surface. Re-scoping is available to the owner as a separate decision, and this record does not make it.

### Alternative 3 — Partial Mount (`provider simulate` and `provider migrate` Only)

- **Eligibility:** Eligible for the mounted subset; fails C-3 as a whole.
- **Summary:** Mount only the two new members and leave `resolve`, `quota`, `parks list`, `profile resolve`, and `watch status` internal.
- **Constraint compliance:** C-1 fails for five of seven members (a partial pass is a partial failure); C-3 fails because the family's **one** reference page would have to describe two reachability classes, and the help inventory would advertise a family whose majority answers containment.
- **Driver fit:** Fails 1 (the five members the ticket names first are still unreachable), 4 (the split is invisible in the binary), 6 (two truths for one page).
- **Pros:** Smallest count-move-plus-new-surface diff; the two newest members are the ones the story introduces.
- **Cons:** "`provider simulate` works, `provider resolve` does not" is unexplainable to an operator and unimplementable as one help page; the spec's `AC-F4-1` groups `resolve`, `quota`, `watch status`, and `simulate` in one criterion, so the split falsifies it anyway.
- **Why rejected:** It is the worst of both: it pays most of the conformance cost and still leaves the ticket's primary claim false.

### Alternative 4 — Insert Before `install` (Provider 26th, `install` 27th)

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Keep the family grouping ("provider next to the other model/engine families") by inserting before `install`.
- **Constraint compliance:** Fails C-4: `install`'s ordinal is stated as "the twenty-sixth" in `feature-cli-entrypoint.md`, `feature-install-lifecycle.md` (three sites), `doc/00-index.md`, and `m4/commands/install.md`, and every GH-346 tail assertion (`supervise` immediately before `install`) would need rewriting. `supervise`'s guard row in the documentation-conformance table exists precisely to catch ordinal churn.
- **Driver fit:** Fails 2 and 3; neutral elsewhere.
- **Pros:** Slightly more thematic ordering; provider sits nearer the engine families.
- **Cons:** Renumbers a delivered family for no operator benefit; falsifies five pages and an unknown number of assertions; sets the precedent that ordinal is negotiable.
- **Why rejected:** The order is not a product statement — root help is a list, not a taxonomy — and the documentation cost of renumbering buys nothing.

## Decision

- **Decision:** Adopt **ALT-1**. `provider` is mounted as the **twenty-seventh and last** prompt-required family, appended after `install`. `install` remains the twenty-sixth and **stops being last**; `provider` is the last member.

### 1. Family shape and the seven member paths

The family's declared invocation paths, each of which must reach its handler and resolve its own help:

| Member | Invocation | Evaluates a budget? | Needs a work-item ref? |
|---|---|---|---|
| resolve | `provider resolve [--chain <name>] [--profile <name>]` | yes (chain resolution) | yes, when an enabled budget is declared (TDR-0062) |
| quota | `provider quota [--provider <name>]` | no | no |
| parks | `provider parks list [--all] [--provider <name>]` | no | no |
| profile | `provider profile resolve [--agent <name>] [--for-spawn]` | no (budget joins chain resolution, not profile eligibility — TDR-0057) | no |
| watch | `provider watch status [--provider <name>]` | no | no |
| simulate | `provider simulate --fixture <path>` | yes (replays `resolve`) | yes, from the fixture (TDR-0062) |
| migrate | `provider migrate legacy [--profiles-dir <dir>] [--hook <path>] [--write]` | no | no |

`provider parks`, `provider profile`, `provider watch`, and `provider migrate` are grammar groups, not help entries: an intermediate path has no static help row, exactly as `install`'s family has none between `install` and `install status`. The declared help inventory is therefore **one family entry plus seven member entries = eight entries**, and `provider <group> --help` falls through to the classified composition failure as every unknown help path does.

### 2. Composition

- `provider` joins `PROMPT_REQUIRED_COMMANDS` **after** `install`, and the production composition gains the family's wiring. Membership alone is not enough and would in fact break worse than it fixes: the command definition exists (`createProviderCommandDefinition`) but `createConfigProgram` registers it only when it receives a `provider` seam (`edge.ts:4978`, inside `if (options.provider !== undefined)`), while production's `configured` object carries no `provider` key — so the composed program has 27 commands and no family, and a declared-but-uncomposed member makes the filter throw and every provider invocation answer `fallback.internal`. The change therefore adds **both** membership and the six `ProviderComposition` seams (`clock`, `credentialPort`, `transport`, `sleep`, `stateStore`, `newFenceToken`) in the production composition, registering the family **unconditionally**, in the same shape `install` is registered (spread the composed commands, then add the family), so a configuration failure produces a typed refusal from the handler rather than a missing family. Phases 3, 5, and 6 extend that composition as the budget ref, `simulate`, and `migrate` handlers land. Two failure classes stay distinct exactly as the entrypoint defines them: a **missing runtime** is a composition gap contained as `fallback.internal` at exit `2` (never answered by dropping the family), and a **data/configuration** condition is answered by the handler as a typed outcome.
- The filter is untouched. `selectPromptRequiredProgram` keeps copying exactly the declared set and keeps dropping extras. The mount adds a member; it does not add a bypass.

### 3. Help inventory and reference page

- `packages/cli/src/help.ts` gains the family entry and the seven member entries, each with the five declared sections, using the existing M1 page helper so `seeAlso` is `doc/planning/oss-tooling/milestones/m1/commands/provider.md` on all eight.
- **The M1 page is the served page; no `pageFor` branch and no M4 page are added.** The default `pageFor` root is the M1 commands directory and already contains `provider.md`; the family's own milestone is M1 (it shipped in M0-S13 and was extended in M1-S21). TDR-0044's rule — "the default M1 snapshot root must not serve a **new** family" — governs a family created in a later milestone, which provider is not. `retro`'s two-page fork exists because its M1 page is the shipped-in-M1 snapshot of a differently-scoped surface; forking provider now would create a second truth for one family with no milestone boundary to justify it.
- The page must gain the two strings the gate requires (`--help`, `--version`), the `--chain` flag the grammar already accepts, the two new members, the budget gate's ref rule (TDR-0062), and the `watch-stale` condition (TDR-0060). Its `ERRORS` list must name the three new rows (`provider.peak.zone-unknown`, `provider.budget.exceeded`, `provider.migrate.refused`) rather than the delivered set alone.

### 4. Coverage inventory

`tests/fixtures/help-guide/coverage.json` gains one `commands` row (`"provider"`, appended after `"install"`) and one `referencePages` row (`doc/planning/oss-tooling/milestones/m1/commands/provider.md`). The inventory's reverse direction — "an inventory row that names a non-prompt-required command fails" — becomes non-vacuous for this family, which is exactly the mutant the readiness review found vacuous.

### 5. Count-movement matrix (the priced cost of this decision)

Every row below must move in the same change or `pnpm check` fails. "Old → new" is the literal value on each site.

**A. Declaration, composition, gate, and inventory**

| # | File | Old | New |
|---|---|---|---|
| A1 | `packages/cli/src/help/prompt-required-commands.ts` | `[… "supervise", "install"]`, 26 names; comment "install … as the twenty-sixth and last" | `[… "supervise", "install", "provider"]`, 27 names; comment "`install` is the twenty-sixth; `provider` is the twenty-seventh and last" |
| A2 | `packages/cli/src/help.ts` | 0 provider entries | 1 family entry (`["provider"]`) + 7 member entries (`provider resolve`, `provider quota`, `provider parks list`, `provider profile resolve`, `provider watch status`, `provider simulate`, `provider migrate legacy`); `seeAlso` = the M1 page on all 8 |
| A3 | `packages/cli/src/production.ts` | `configured` carries **no** `provider` key, so `createConfigProgram(configured)` composes 27 commands with the family absent (executed 2026-11-19); the only non-declared command composed is `config` | `configured` gains the six `ProviderComposition` seams (`clock`, `credentialPort`, `transport`, `sleep`, `stateStore`, `newFenceToken`) and the composed program gains the family **unconditionally** in the same shape as `install` (spread + add), no conditional arm; phases 3/5/6 extend the seam as the budget-ref, `simulate`, and `migrate` handlers land |
| A4 | `scripts/checks/help-guide-coverage.ts` | no provider branch | **no change** — the default M1 root resolves the existing page; a branch would be a second mapping for no reason |
| A5 | `tests/fixtures/help-guide/coverage.json` | `commands` 26 rows, ends `… "install"`; `referencePages` ends `… m4/commands/install.md` | `commands` 27 rows, ends `… "install", "provider"`; `referencePages` gains `doc/planning/oss-tooling/milestones/m1/commands/provider.md` |
| A6 | `doc/planning/oss-tooling/milestones/m1/commands/provider.md` | no `--help`, no `--version`; synopsis without `--chain`, `simulate`, `migrate` | both strings present; synopsis and examples cover all seven members; budget ref rule and `watch-stale` documented |

**B. Pinned counts, tails, and fixtures (tests)**

| # | File | Old | New |
|---|---|---|---|
| B1 | `tests/fixtures/metrics/mounting.ts` | `MOUNTED_FAMILIES = [...SUPERVISE_MOUNTED_FAMILIES, "install"]` (26); header says 26 | `[… "install", "provider"]` (27); header says 27; `PINNING_FILES` gains `supervision-mounting.test.ts`, `install-conformance.test.ts`, `install-family-surface.test.ts`, `entrypoint-two-bins.test.ts` (11 → 15) so the pin set is itself pinned |
| B2 | `tests/fixtures/supervise/mounting.ts` | `[...BASE_FAMILIES, "metrics", "supervise", "install"]` (26) | `[…, "install", "provider"]` (27); comment "twenty-sixth and last" → "`install` twenty-sixth, `provider` twenty-seventh and last" |
| B3 | `tests/structure/entrypoint-bin.test.ts` | expected 26-element array ending `"install"`; rendered family-line count `26` | array ends `"install", "provider"`; rendered count `27` |
| B4 | `tests/structure/supervision-mounting.test.ts` | `MOUNTED_FAMILIES` literal ends `"install"`; `toHaveLength(26)`; `at(-3)`=metrics, `at(-2)`=supervise, `at(-1)`=install; root-help title "install as the last family line among 26 families"; `families.at(-1)` startsWith `install`; stale-class `2[345]`; pin `toHaveLength(26)`; sorted `families.at(-1)` = `"install"` | literal ends `"provider"`; `toHaveLength(27)`; `at(-4)`=metrics, `at(-3)`=supervise, `at(-2)`=install, `at(-1)`=provider; title "install at the penultimate family line … among 27 families, with `provider` last"; `families.at(-2)` install + `at(-1)` provider; stale-class `2[3456]`; pin `toHaveLength(27)`; sorted `families.at(-1)` = `"provider"` |
| B5 | `tests/structure/metrics-mounting.test.ts` | same shapes as B4 plus title "metrics mounts at 23 of 26" and "install last among 26 families"; `MOUNTED_FAMILIES` 26; `at(-3/-2/-1)` chain; `families.at(-1)` install | "23 of 27"; 27; `at(-4/-3/-2/-1)`; `families.at(-2)` install + `at(-1)` provider; `2[3456]`; pin 27 |
| B6 | `tests/structure/steer-mounting.test.ts` | same shapes as B5 (title "steer at index 22, metrics at 23, and install last among 26 family lines") | same movements; "… `install` at 25 and `provider` last among 27 family lines"; 27; `2[3456]` |
| B7 | `tests/structure/install-conformance.test.ts` | docstring/describe "exactly 26"; `toHaveLength(26)`; expected array ends `"install"`; `at(-1)`=install, `at(-2)`=supervise; comparator `!= 26`, `"tail is not install"`, `"supervise is not immediately before install"`; `slice(0, 25)` | "exactly 27"; 27; array ends `"install", "provider"`; `at(-1)`=provider, `at(-2)`=install, `at(-3)`=supervise; comparator `!= 27`, `"tail is not provider"`, `"install is not immediately before provider"`; `slice(0, 26)` |
| B8 | `tests/checks/install-conformance-mutants.test.ts` | `actual.length !== 26`; `at(-1) !== "install"`; `at(-2) !== "supervise"`; `slice(0, 25)`; "missing install" | `!== 27`; `at(-1) !== "provider"`; `at(-2) !== "install"`; `slice(0, 26)`; "missing provider" |
| B9 | `tests/structure/events-production-composition.test.ts` | `toHaveLength(26)` ×2; index chain `length-7`…`length-1` = events…install | 27 ×2; chain shifts one: `length-8`…`length-2` = events…install, `length-1` = provider |
| B10 | `tests/structure/daemon-production-composition.test.ts` | `toHaveLength(26)` ×2 | 27 ×2 (the `length - 1` mutation assertion is generic and stays) |
| B11 | `tests/structure/board-mounting.test.ts` | `toHaveLength(26)` ×2 (set and selected program) | 27 ×2 |
| B12 | `tests/structure/dispatch-attempts-composition.test.ts` | title "twenty-six families"; `toHaveLength(26)` | "twenty-seven families"; 27 |
| B13 | `tests/behaviour/repos-help.test.ts` | `toHaveLength(26)` | 27 |
| B14 | `tests/behaviour/board-help.test.ts` | `toHaveLength(26)` | 27 |
| B15 | `tests/behaviour/events-mount-help.test.ts` | `toHaveLength(26)` | 27 |
| B16 | `tests/behaviour/entrypoint-two-bins.test.ts` | title "twenty-six families"; `PROMPT_REQUIRED_COMMANDS.length).toBe(26)`; `familyRows(...).length).toBe(26)` | "twenty-seven families"; `27` at both sites |
| B17 | `tests/behaviour/install-family-surface.test.ts` | `families).toHaveLength(26)`; `families.at(-1)).toBe("install")` | 27; `at(-2)` = `"install"`, `at(-1)` = `"provider"` |
| B18 | `tests/fixtures/entrypoint/alias-baseline.json` | `cells.help.stdout` `Commands` list has no `provider` line; provenance note ends at GH-346 | one `provider  …` line appended to `Commands`; provenance note gains the GH-350 clause; `capturedFrom` unchanged (still an ancestor) and every other cell byte-unchanged |
| B19 | `tests/checks/help-guide-coverage-mutants.test.ts` | the base mutant drops `"merge"` from `coverage.commands`; the GH-346 block drops `"install"` | gains a `provider` mutant (dropping `"provider"` from `coverage.commands`) beside the `install` mutant, so the new row can fail by name |
| B20 | `tests/behaviour/entrypoint-help-coverage.test.ts` | derives `HELP_TUPLES` from `allHelpEntries()` | **no edit** — 8 tuples appear automatically; the readiness review's "declared provider tuple" finding named a file with no tuple table |
| B21 | `tests/fixtures/entrypoint/programs.ts` | `HELP_TUPLES` derived; `syntheticPromptProgram` derived from the set | **no edit** — both derive |
| B22 | `tests/checks/doc-conformance.test.ts` | `feature-cli-entrypoint.md` row: `required` contains `"twenty-six families"`, `stale` has none for the count; `feature-metrics.md` row: `stale ["…","family count (25)"]`, `required ["…","family count (26)"]` | entrypoint row: `stale` gains `"twenty-six families"`, `required` carries `"twenty-seven families"`; metrics row: `stale` gains `"family count (26)"`, `required` carries `"family count (27)"`; **the `feature-supervise.md` row is untouched** (`stale ["65-member allowlist","26th family"]`, `required ["66-member allowlist","25th family"]`) |
| B23 | `tests/structure/supervision-error-family.test.ts`, `tests/checks/install-error-domain.test.ts`, `tests/structure/error-table.test.ts` (`DOMAIN_KINDS.at(-1) === "install"`) | domain-kind tail | **no change** — `DOMAIN_KINDS` is the error-domain register, not the family set; conflating the two is the trap this row exists to name |

**C. Documentation pages stating the count (and the ones that must not move)**

| # | File | Old | New |
|---|---|---|---|
| C1 | `doc/spec/features/feature-cli-entrypoint.md` | "twenty-six families"; "the `install` family is the twenty-sixth **and last**"; "Other registered commands (`config`, `provider`, `db`, `watchdog`) are not prompt-required and are dropped" | "twenty-seven families"; "`install` is the twenty-sixth" + a new paragraph "`provider` is the twenty-seventh and last"; the non-prompt-required list becomes `(config, db, watchdog)`; the composition table gains a `provider` row; the quality-evidence table gains a Provider mount row |
| C2 | `doc/spec/features/feature-install-lifecycle.md` | "Prompt-required families: exactly 26"; "exactly 26 families"; (three sites say "the twenty-sixth prompt-required family") | 26 → **27** at the two count sites; the three "twenty-sixth" sites **stay** |
| C3 | `doc/spec/features/feature-metrics.md` | "the mounted family count (26)" | "(27)" |
| C4 | `doc/00-index.md` | "the twenty-six-family prompt-required set" (line 42); "the twenty-sixth prompt-required `install` family" (line 59) | line 42 → "twenty-seven-family"; line 59 **stays** |
| C5 | `doc/overview/glossary.md` | "twenty-six families: … `supervise`, and `install`" | "twenty-seven families: … `supervise`, `install`, and `provider`" |
| C6 | `.changeset/install-lifecycle-minor.md` | "twenty-six prompt-required families" | "twenty-seven" **iff the changeset is still pending**; if a release already consumed it, it is historical and stays (see the TO-CONFIRM evidence row) |
| C7 | `doc/planning/oss-tooling/milestones/m4/commands/install.md` | "`install` is the twenty-sixth prompt-required family" | **stays** |
| C8 | `doc/spec/features/feature-ceremony-runner.md` | no family count | **no change** |
| C9 | `doc/spec/features/feature-supervise.md` | "the 25th prompt-required family" (three sites, no count) | **no change** — this is an ordinal, and the phrase table's `"26th family"` stale guard exists to fail an over-correction here |
| C10 | `doc/spec/features/feature-provider-engine.md`, `feature-provider-profiles.md` | family described; CLI table lacks `simulate`/`migrate` and the budget condition | gain the two members, the budget condition and tie-order row, the `timezone` evidence field, the `watch-stale` condition, and a sentence that the family is prompt-required |

**D. The change's own artifacts (owned by `@spec-writer` / `@test-plan-writer` / `@plan-writer`)**

| # | File | Old | New |
|---|---|---|---|
| D1 | `chg-GH-350-spec.md` `AC-F8-4` | "the provider family … the family count unchanged at 26" | "the provider family at exactly 27 and last, both bins identical in content and order" + the reachability criterion of §6 |
| D2 | `chg-GH-350-spec.md` F-8 | "The provider family count is unchanged at 26" | "moves from 26 to 27; the family appends as the twenty-seventh and last" |
| D3 | `chg-GH-350-spec.md` §5 composition row, §16 | "the family count, parity, and page-root mapping are unchanged"; `feature-cli-entrypoint.md` absent from §16 | count moves 26 → 27; `feature-cli-entrypoint.md` joins §16's obligation table |
| D4 | `chg-GH-350-test-plan.md`, `chg-GH-350-plan.yaml` | no reachability case; mounting phase absent | the reachability + negative-control cases and the mounting phase with its file set |

### 6. Prose rule: what is an ordinal, what is a count, what is a tail

Three different statements have been written with the same words, and only two of them move:

1. **Ordinal prose stays.** "`supervise` is the twenty-fifth", "`install` is the twenty-sixth", "`steer` is the twenty-third", "`metrics` is the twenty-fourth" are positions in a delivered order. Appending a member does not move them. The phrase-table guard on `feature-supervise.md` (`stale: "26th family"`) is **left as delivered** precisely so an author who "fixes" an ordinal fails.
2. **Count prose moves.** "twenty-six families", "exactly 26", "family count (26)", "mounted family count (26)" are sizes and become 27.
3. **Tail prose moves.** "`install` … the twenty-sixth **and last**" loses "and last"; every assertion of the form `at(-1) === "install"`, `families.at(-1)` starts with `install`, "install is last", "install immediately follows supervise", "the last family line" moves one place: `provider` is last, `install` is immediately before it, and `supervise` is two before it. The one place where "install is last" is *derived* rather than stated — the `PINNING_FILES` stale-scan regex class `2[345]` — must widen to `2[3456]`, or a surviving 26 is invisible to the detector that exists to catch it.

### 7. Reachability acceptance criterion (one criterion, two arms)

Carry this as **one** acceptance criterion under the existing `F-8` capability (suggest `AC-F8-5`); the capability list stays at eight because reachability is conformance truth, not a new capability.

> **Given** the change branch, **when** each of `provider resolve`, `provider quota`, `provider parks list`, `provider profile resolve`, `provider watch status`, `provider simulate --fixture <fixture>`, and `provider migrate legacy` is driven through `runEntrypoint` with the **production composer**, **then** each reaches the family handler and answers that member's declared outcome — never `fallback.internal`, never `fallback.invocation` for a declared form — and `provider --help` plus each of the seven member `--help` paths resolves from the static inventory at exit `0` with the five declared sections (7/7 handler paths, 8/8 help surfaces); **and when** a case-local mutation removes `provider` from the declarative prompt-required set, **then** the same invocation answers `fallback.internal` at exit `2` with the containment summary naming the missing composition, **and when** a synthetic program registers an extra non-prompt-required family, **then** `selectPromptRequiredProgram` drops it and the selected program's keys equal the declared set exactly — so the positive arm cannot pass through the command layer, and the negative arm fails by name if the filter stops filtering.

Why this shape:

- **It drives the entrypoint, not the command layer.** The delivered defect survived because no case crossed the restriction step. A case that calls `createConfigProgram` or `runCli` reproduces the blind spot.
- **It asserts the tail explicitly.** "7/7 and 8/8" makes a partial mount fail, which is the ALT-3 rejection made executable.
- **The negative control is the non-vacuity proof.** Without it, a future change that mounts by bypassing the filter would pass the positive arm while breaking the composition contract.
- **It names the containment identity and the exit.** A refusal must be classified, not merely absent.

### 8. Consequences this record forces on the change's own specification

`AC-F8-4`'s "family count unchanged at 26" and F-8's same sentence are **falsified by this decision** and must be corrected by `@spec-writer` before readiness re-review; `feature-cli-entrypoint.md` must join §16's documentation-obligation table (the readiness review's B6 already found the drift window); and the plan must carry the mounting phase with the §5 file set. Nothing in the engine, budget, simulate, migrate, zone, or watch decisions changes.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies C-1 through C-6. No accepted-risk exceptions are taken. Two consequences are recorded rather than treated as exceptions: the conformance surface in §5 is the **priced cost** of reachability, stated before delivery so it cannot be discovered as breakage; and the alias help baseline is regenerated deliberately (one line, one cell), exactly as GH-346 did for `install`.

**Reversal.** Removing `provider` from `PROMPT_REQUIRED_COMMANDS`, its eight help entries, coverage rows and page edits, and the production `provider` seam restores the twenty-six-family surface with `install` last; the mount adds no code path, state, contract, or migration, so the reversal is one commit.

## Trade-offs & Consequences

### Positive Outcomes

- The ticket's "complete and document" and "offline verification" claims become true as operator statements rather than test-only claims.
- Reachability gains a proof that fails by name when the filter or the mount changes — the defect class (green suite, unreachable command) is closed for every future family.
- The family keeps one reference page, one help inventory, and one coverage row.
- Every delivered ordinal survives, so `install`'s GH-346 prose and `supervise`'s guard row stay exact.
- The conformance cost is enumerated: a reviewer can check the diff against the matrix instead of discovering omissions at CI.

### Negative Outcomes

- The composed set grows 26 → 27, one production composition seam is added, and roughly twenty pinned assertions, two fixtures, one byte baseline, and six documentation pages move. This is a real, enumerated diff, not a side effect.
- `install`'s "and last" statements must be reworded, and the alias help baseline is regenerated — a deliberate baseline edit on a byte-pinned artifact.
- The provider page becomes a gated page: from now on, editing the surface requires editing the page, and the page's `--help`/`--version` presence is load-bearing.
- Root help grows one line, so any operator tooling that parses the family list sees a new tail.

### Unresolved Questions

- [ ] Whether the changeset file is still pending at delivery time (owner: `@pm`; if consumed, C6 is historical and must not be rewritten).
- [ ] Whether the provider family's help summary should name the budget gate (owner: `@spec-writer`; recommendation: no — the family summary stays capability-level, and the budget rule lives in the member and the page).
- [ ] Whether `provider parks --help` and the other grammar-group paths should gain entries later (owner: `@spec-writer`; recommendation: no — the delivered `install` and `dispatch` precedents have none, and a group has no distinct behaviour to document).

## Implementation Plan

1. **Membership.** Append `provider` to `PROMPT_REQUIRED_COMMANDS`; correct its comment to "install twenty-sixth, provider twenty-seventh and last".
2. **Composition.** Supply the six `ProviderComposition` seams (`clock`, `credentialPort`, `transport`, `sleep`, `stateStore`, `newFenceToken`) in production's `configured`, and add the family to the composed program unconditionally in the same shape as `install` (the command definition is delivered at `edge.ts:4978`); no conditional arm. Phases 3, 5, and 6 extend the composition as the budget ref, `simulate`, and `migrate` handlers land.
3. **Help.** Add the family entry and the seven member entries with the five sections, `seeAlso` at the M1 page.
4. **Coverage.** Add the `commands` and `referencePages` rows; extend the mutants suite with the provider twin.
5. **Reference page.** Add `--help`/`--version`, the `--chain` flag, the two new members, the budget ref rule, the `watch-stale` condition, and the three new error rows.
6. **Count propagation.** Walk §5 A/B/C/D in order; widen the stale-scan class to `2[3456]`; add the four pinning suites to `PINNING_FILES`.
7. **Baseline.** Regenerate the alias baseline help cell and extend its provenance note; assert every other cell is byte-unchanged.
8. **Tests.** The §7 criterion (positive 7/7 + 8/8, negative mutation, extra-family drop) and the re-derived help tuples.
9. **Docs.** `feature-cli-entrypoint.md`, `feature-install-lifecycle.md` counts, `feature-metrics.md`, `00-index.md`, glossary, `.changeset` (if pending), provider-engine/profiles pages.

## Verification Criteria

- Metric: provider member invocations reaching a handler through the production composition — Target: 7/7 — Window: GH-350 CI.
- Metric: provider help surfaces resolving from the static inventory at exit 0 with five sections — Target: 8/8 — Window: GH-350 CI.
- Metric: reachability case outcomes when the declarative set omits `provider` — Target: `fallback.internal`, exit 2, by name — Window: GH-350 CI.
- Metric: surviving stale family-count pins (23/24/25/26 as a current value outside the declared residual) — Target: 0 — Window: `pnpm check` on GH-350.
- Metric: `PROMPT_REQUIRED_COMMANDS` length and the rendered root-help family lines — Target: exactly 27, both bins identical in content and order — Window: GH-350 CI.
- Metric: delivered ordinals falsified by the change (`supervise` 25th, `install` 26th, `steer` 23rd, `metrics` 24th) — Target: 0 — Window: doc conformance on GH-350.
- Metric: new error identities and new state record kinds introduced by the mount — Target: 0 each — Window: `error-table-sync` + record-kind inventory.

## Confidence Rating

**High.** The mount is a declarative membership plus the composition seam over a delivered command definition; the conformance surface is enumerated from the repository rather than assumed; and the defect class is proven (the artifact refuses today, and the composed program demonstrably lacks the family). The medium-confidence element is the reference-page home (M1 in place vs a new M4 page): the M1 default resolves today and no milestone boundary justifies a fork, but if the family's surface is later rewritten wholesale, the revisit trigger moves it.

## References

- [TDR-0044](TDR-0044-install-lifecycle-composed-command-family.md) — the mount precedent: membership, help, page root, count movement, and the declared conformance surface.
- [TDR-0058](TDR-0058-provider-simulate-fixture-and-zero-write-simulation.md) — `provider simulate`.
- [TDR-0059](TDR-0059-legacy-provider-profile-and-hook-migration.md) — `provider migrate`.
- [TDR-0060](TDR-0060-watch-observation-freshness-and-stale-condition.md) — the `watch-stale` condition the page must document.
- [TDR-0062](TDR-0062-provider-budget-work-item-ref-source.md) — the work-item ref source the mounted family consumes.
- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — the engine the family exposes.
- Feature specs: [CLI Entrypoint and Self-Description](../spec/features/feature-cli-entrypoint.md), [Provider Engine](../spec/features/feature-provider-engine.md), [Provider Profiles](../spec/features/feature-provider-profiles.md).
- Readiness evidence: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/readiness-review/readiness-iter-1.md` (B1, B6).
- Change: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/`.
