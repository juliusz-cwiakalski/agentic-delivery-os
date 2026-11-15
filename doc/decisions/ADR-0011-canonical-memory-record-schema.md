---
id: ADR-0011
decision_type: adr
status: Proposed
created: 2026-11-15
decision_date: null
last_updated: 2026-11-15
summary: "Agent memory has exactly one canonical record schema: a machine contract module is the authority, the memory index publishes its human rendering, the promotion writer and the curator skill render it, the memory lint enforces it, and the capsule candidate contract is a strict projection of it; the required spine is the ten keys resolving the backlog's seven conceptual fields, the optional key set is closed with a recorded disposition for every concept-document key (accepted, renamed, or rejected by design with its home named), the statement is bounded at 280 characters, and reconciliation runs one way only, so any divergence is a defect in the rendering and never a second schema."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os agent memory (GH-301 canonical record schema)"
decision_scope: repo
review_date: null
business_impact: "Ends the re-decide-what-a-record-is cost in every memory consumer: one published contract serves closeout promotion, the curator skill, bootstrap templates, and the future M3 memory command family and compiler."
customer_impact: "Adopters inherit one record format that is documented, enforced, and rendered by every writer, instead of four field sets that agree only by accident; a schema change after release is a cross-project migration, so the contract is fixed deliberately now."
classification:
  domains: [architecture, contracts, memory, documentation]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: high
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (subagent session, consulted by @pm for GH-301 after the readiness iteration-1 finding 20 escalated the schema out of change-local decisions)"
  decider: "Juliusz Ćwiąkalski — owner ratifies or vetoes at the GH-301 open-PR gate; per repo convention this R2 record stays Proposed with decision_date null until a human explicitly decides, and AI does not accept it"
  contributors:
    - "@pm (GH-301 clarify-scope and the DoR iteration-1 escalation)"
    - "@spec-writer (chg-GH-301-spec §5.1 F-2, §8.3 DM-1/DM-6, DEC-5, DEC-7, DEC-8, DEC-12, Appendix A)"
    - "@readiness-reviewer (readiness iteration-1 findings 11, 12, 17, 20)"
    - "@decision-advisor (repository analysis, option generation, and this record)"
  reviewers:
    - "Juliusz Ćwiąkalski (GH-301 PR review — ratify or veto)"
    - "@decision-critic (optional independent challenge; R2)"
  performers:
    - "@coder (GH-301 delivery — contract module, index rendering, promotion-writer alignment, capsule projection, lint areas, record backfill)"
    - "@doc-syncer (current-truth feature spec reconciliation in the GH-301 documentation phase)"
    - "@toolsmith (curator skill rules reconciled to the schema)"
  informed:
    - "Every agent that creates memory (the schema binds every record write)"
    - "M3-S8 (`ados memory` command family) and M3-S9 (memory compiler) — both consume the machine contract"
    - "Bootstrapped projects (the schema reaches them through the GH-302 template set)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A fifth consumer of the record model appears (a retrieval index, the memory compiler, an external tool) and cannot express its needs from the machine contract: extend the contract module and its rendering in one change, never a parallel field set."
  - "A required key proves to be dead weight — no consumer reads it and every record author duplicates boilerplate: remove it through this record's process (contract, rendering, writer, lint in one change), never by letting writers omit it."
  - "A legitimate record's statement cannot be expressed within 280 characters without truncating meaning: raise the bound in the contract module and the published rendering together; never allow a silent exception."
  - "The evaluation ladder lands and an authoritative behaviour-changing lesson becomes expected to carry confidence and evaluation evidence: making those keys required is a schema change decided there, composed with this record (GH-301 OQ-2)."
  - "Adopters' trees diverge from the published rendering because their bootstrap template set predates a schema change: decide a migration story for bootstrapped projects before the next schema revision."
  - "The promotion path needs a record the capsule cannot express (a scope or status with no candidate projection): resolve it by extending the candidate contract through its own decision, never by writing a record outside the schema."
links:
  related_changes: ["GH-301"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-15--GH-301--memory-records-layout-lint/chg-GH-301-spec.md"
    - "doc/changes/2026-11/2026-11-15--GH-301--memory-records-layout-lint/readiness-review/readiness-iter-1.md"
    - ".ai/memory/README.md"
    - "doc/planning/concepts/memory-architecture.md"
  contracts:
    - "packages/core/src/contracts/memory-record.ts (delivered by GH-301 — the authority)"
    - "packages/core/src/contracts/capsule.ts"
    - "packages/core/src/domain/capsule-candidates.ts"
    - "packages/adapters/src/file/memory-promotion.ts"
  decisions: ["PDR-0004", "ODR-0001"]
  diagrams: []
  experiments: []
  metrics: []
  roadmap_items: ["M2-S8", "M3-S8", "M3-S9"]
---

# ADR-0011: One Canonical Agent-Memory Record Schema — Required Spine, Closed Optional Set, Dispositions, and a One-Way Reconciliation Direction

## Context

The committed memory tree exists and is populated, and the learning loop is wired end to end. What does not exist is a single answer to "what is a memory record?". Four renderings of the same idea are in the repository today, and none of them is authoritative:

- **The published format** (`.ai/memory/README.md`, "Promoted record format"): `id`, `kind`, `scope`, `statement`, `evidence`, `source`, `created_by`, `created`, `status`, `supersedes`, optionally `applies_when`. No `trust`.
- **The promotion writer** (`recordContent` in `packages/core/src/domain/capsule-candidates.ts`): the same key set, also without `trust` or `basis`, with `status` hardcoded to `candidate` and `rationale` rendered into the body.
- **The capsule candidate contract** (`packages/core/src/contracts/capsule.ts`): `id`, `class`, `scope`, `statement`, `evidence`, `basis`, `source`, `trust`, `status`, `created_by`, `created`, plus optional `rationale`, `applies_when`, `supersedes`, `contradicts`, `hint` — with the closed class/scope/status/trust/basis vocabularies and the five evidence-link prefixes declared there and consumed nowhere else.
- **The capsule read projection** (`CapsuleMemoryRecord`): `{id, class, statement, status, path}`.

The divergence is not theoretical. `recordContent` emits `kind: ${candidate.class}`, so a tacit candidate is written with `kind: "tacit"` while the documented kind set (`lesson | tacit_fragment`) does not contain it, and the reader's own projection special-cases `kind === "tacit_fragment"` to recover the class. The same function derives the home directory as `${candidate.class}s/`, so a tacit candidate lands in `tacits/` while the delivered area is `tacit/` — the writer reads and supersedes the same invented directory (`packages/adapters/src/file/memory-promotion.ts` loops `lesson` and `tacit` and joins `${class}s`), so a tacit promotion today lands outside the tree's coverage universe and is invisible to the dedup population. The candidate `source` is validated only as non-empty, so the writer can emit a channel the schema's four-value set rejects. The candidate scope vocabulary offers `fleet`, which has no implemented home, while the record scope set cannot express it.

Two upstream artifacts constrain the shape of the answer. The architecture concept (`doc/planning/concepts/memory-architecture.md`, §Record model) carries the richer design model — `rationale`, `source: {type, ref}`, `valid_from`, `confidence`, `evaluation`, a list-valued `evidence`, `applies_when` as a list, and trust written as prose labels (`agent_verified`) — and a selection of its keys that a record author will reasonably copy verbatim. And the M2-S8 story line names exactly seven conceptual fields, which resolves to ten concrete record keys.

GH-301 is delivering the layout, the lint, and the write-path alignment, and it carried this contract as change-local decisions (DEC-5, DEC-7, DEC-8 and DM-1/DM-6) until the readiness gate escalated it. The escalation is correct: the curator skill, the bootstrap template set, the future `ados memory` command family, and the future memory compiler all consume this schema and none of them is GH-301. A change-local decision log is not a durable home for a contract that outlives the change, and a contract fixed only in prose inside a change folder cannot be cited by the next consumer.

## Problem Framing (Clarified)

The decision question: **which artifact is the authority for "a memory record", what exactly does it require and permit, and which direction does reconciliation run — such that every present and future consumer can be validated against it without any consumer becoming a second authority?**

The root cause is not four field lists; it is that no artifact was ever designated authoritative, so each writer independently decided which keys mattered. Field-by-field reconciliation would reproduce the same failure at a smaller scale. What has to be decided is the *precedence relation*, then the content that relation makes binding.

Three properties must hold in any acceptable answer:

1. **One authority, citable and machine-readable.** A consumer validates against one declaration; a human reads the same declaration rendered for humans. If a second artifact can disagree without failing something, the decision has not been made.
2. **Every closed set is closed for a reason, and the reasons are recorded.** The concept document's keys are not noise: `valid_from`, `source.ref`, the evidence list, and `confidence` each encode a real intent. A schema that silently drops them teaches record authors that the design document lies. Each concept key therefore gets an explicit disposition — accepted, renamed, or rejected by design *with the retained home named* — so the rejection is a decision a reader can audit rather than an omission.
3. **Enforcement is mechanical, which requires the bounds to be published.** A lint can only fail on what the contract declares: a statement bound that lives in a test fixture or an author's head is not a contract, and a hint bound that a writer derives by truncating a statement is not a read-when hint.

Scope boundary, stated up front: this decision fixes the record model, not the areas, the lint's finding register, the index-row coverage rule, or the enforcement surface. The tree layout, the eight lint areas, the finding identities, the budgets, and the gate wiring are GH-301's own specification (§5.1 F-1, DM-2–DM-5, Appendix A) and are consumed here as given. Distribution to bootstrapped projects stays deferred (GH-301 NG-7, OQ-1), and the memory compiler and command family remain M3.

## Constraints (Hard Requirements)

Table-stakes acknowledged once: every alternative below keeps the change's declared shape — one repository invariant as the enforcement surface, no CLI command, no doctor area, no error-table identity, no new domain kind, and no writes at gate time (GH-301 DEC-3, NFR-1, NFR-10).

### C-1: Exactly one schema authority, no fifth rendering

- **Statement:** After GH-301, every artifact that describes a memory record either *is* the machine contract, is its human rendering, or is a strict projection of it; no artifact declares a required key, a closed value, a key name, or a bound that the machine contract does not declare, and a divergence between any two of them fails a test.
- **Source:** AC (GH-301 AC-F2-1, AC-F2-3, DoD-2; spec §5.1 F-2, DM-1 precedence rule).
- **Verification:** test (schema parity test parses the published human format against the machine contract; whole-tree lint run reports zero schema findings).
- **Negotiable:** no

### C-2: The capsule candidate contract is not widened

- **Statement:** The capsule candidate model keeps its key names and its closed vocabularies; it changes only where the record schema demands (the `source` channel set is validated as declared, and no candidate value may home-write into a record field the schema's closed sets reject). No candidate field is added for a schema-only concept, and no schema key is dropped to accommodate the capsule.
- **Source:** AC (GH-301 DEC-5, DEC-8, §8.3 DM-6, NFR-10) and the delivered candidate contract (`packages/core/src/contracts/capsule.ts`).
- **Verification:** test (candidate declaration tests, promotion projection fixtures) + code review of the capsule diff.
- **Negotiable:** no

### C-3: Every write path renders the schema, and a rendered record validates

- **Statement:** A record produced by the promotion writer, by the curator pass, or by hand carries every required key, stays inside every closed vocabulary, and yields zero findings; the index row a writer appends carries a read-when hint rather than a duplicated statement.
- **Source:** AC (GH-301 AC-F3-1, AC-F3-2, DEC-7).
- **Verification:** test (promotion behaviour suite over the memory fixture; whole-tree lint run at the delivered HEAD).
- **Negotiable:** no

### C-4: The human rendering fits the published index budget

- **Statement:** The schema is publishable as the record format a reader copies, inside the memory index's 200-line and 25 KB caps, alongside the layout, the id rule, the routing table, and the index rows.
- **Source:** AC (GH-301 DM-2, DM-5, AC-F10-2; `.ai/memory/README.md` caps).
- **Verification:** audit (measured line and byte counts recorded as GH-301 delivery evidence).
- **Negotiable:** no

### C-5: No new identity or surface

- **Statement:** The decision introduces no CLI command, flag, doctor area, error-table row, domain kind, state record, or event topic; the lint's findings use the change's closed `memory.<area>.<condition>` register and nothing outside it.
- **Source:** AC (GH-301 NFR-10, F-4, F-14, DEC-6, Appendix A).
- **Verification:** test (command inventory, error-table, domain-kind, and doctor-check-set assertions).
- **Negotiable:** no

### C-6: The migration is additive and semantically inert

- **Statement:** Applying the schema to the three delivered records changes no statement, status, id, meaning, or body; only required keys are added, assigned from the record's recorded evidence channel.
- **Source:** AC (GH-301 DEC-12, AC-F7-2, §19) and the supersede-never-rewrite rule (`.ai/memory/README.md`).
- **Verification:** review of the migration diff against the pre-change records.
- **Negotiable:** no

## Decision Drivers

**Technical drivers (ranked):**

1. **Single source of truth (project priority 5).** One declared contract, imported by every consumer, is the only shape that survives a new consumer arriving; the repository already treats `.opencode/` as canonical and `.ados-claude/` as generated for exactly this reason.
2. **Enforcement leverage.** The lint is the reason the schema is worth fixing now: every value it must check has to be declared, published, and single-sourced, otherwise the gate fails on a number no author can look up.
3. **Paved road (project decision principle).** The trust vocabulary, the five evidence-link shapes, and the five capture-bar bases are delivered, tuned, and tested in the capsule contract. Reuse them; invent nothing.
4. **Permanent cost per key.** A required key is written by every record author and every writer forever, and a required key that nothing reads is pure tax. Optional keys cost one declaration each; that asymmetry drives the accepted-optional class.

**Operational drivers:**

5. **Human legibility.** The index is the contract a person copies. A schema that cannot be read and copied in one screen, inside the index cap, will be worked around.
6. **Migration and reversal cost.** Records are committed history: ids are never reused, supersession is preserved, and prune-with-reason is audited. A schema mistake is recoverable by additive backfill, but only if the mistake is a *field*, not a *meaning*.
7. **Adopter stability.** The schema reaches bootstrapped projects through the GH-302 template set, so a post-release change is a cross-project migration; the contract is worth getting right once.
8. **Reasoning transparency for the design document.** The concept must remain a usable design input without becoming a competing authority; recording a disposition per key is what lets a future reader reconcile the two without re-deriving the argument.

## Decision Rights (DACI)

Mirrors the `governance:` front matter. Driver: `@decision-advisor`. Decider: Juliusz Ćwiąkalski (human ratification at the GH-301 open-PR gate; AI does not accept this R2 record). Contributors: `@pm` (escalation and scope), `@spec-writer` (F-2, DM-1, DM-6, DEC-5/7/8/12), `@readiness-reviewer` (findings 11, 12, 17, 20), `@decision-advisor` (analysis and record). Reviewers: the human owner at the GH-301 PR review, with optional `@decision-critic` challenge. Performers: `@coder` (contract module, index rendering, writer alignment, capsule projection, lint areas, backfill), `@doc-syncer` (feature-spec reconciliation), `@toolsmith` (curator skill rules). Informed: every record-writing agent, M3-S8 and M3-S9, and adopters via the bootstrap template set.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Four renderings of "a memory record" exist and disagree on the key set (`trust` and `basis` absent from the README format and the writer; `class`/`hint` capsule-only; the read projection has five fields) | FACT | `.ai/memory/README.md` §Promoted record format; `packages/core/src/domain/capsule-candidates.ts` `recordContent`; `packages/core/src/contracts/capsule.ts` `CAPSULE_CANDIDATE_REQUIRED_KEYS`, `CAPSULE_CANDIDATE_OPTIONAL_KEYS`, `CapsuleMemoryRecord` | High — this is the problem the decision exists to solve | High |
| The writer emits `kind: "tacit"` for a tacit candidate and derives the home directory as `${class}s`, producing `tacits/` while the delivered area is `tacit/` | FACT | `capsule-candidates.ts:199-208` (kind from `candidate.class`), `:353` (`${candidate.class}s/${fileName}`); the reader repeats the join in `packages/adapters/src/file/memory-promotion.ts` | High — the "write path renders the schema" claim is false today for one of the three kinds | High |
| The candidate `source` is validated as non-empty only, so a writer can emit a channel outside the four declared values | FACT | `capsule-candidates.ts:108-111` | High — C-2's tightening is load-bearing, not cosmetic | High |
| The candidate scope vocabulary admits `fleet`, which no record home implements; the record scope set has three values | FACT | `capsule.ts` `CAPSULE_CANDIDATE_SCOPES` vs GH-301 spec DM-1 `scope` | Medium — the projection needs an explicit refusal rather than a coerced value | High |
| The three delivered records' statements are 245, 212, and 234 characters and must not be rewritten | FACT | `.ai/memory/lessons/lesson-2026-00{1,2,3}-*.md` (measured 2026-11-15) | High — the statement bound must exceed 245 or the migration violates C-6 | High |
| The T0–T5 trust vocabulary exists in two places (the capsule contract and the concept's trust table), not in one | FACT | `capsule.ts` `CAPSULE_CANDIDATE_TRUST`; `doc/planning/concepts/memory-architecture.md` §Trust levels | Low — it confirms the vocabulary; the "exists nowhere else" claim in the change spec §2.1 is inaccurate and this record does not rely on it | High |
| The memory index is 172 lines / 8.5 KB against a 200-line / 25 KB cap, so the published format must be compact | FACT | `.ai/memory/README.md` (measured 2026-11-15); GH-301 DM-5 | Medium — a prose schema would not fit the copyable-format obligation | High |
| The delivered records can be backfilled additively (trust from the recorded channel, a shaped evidence link) without touching statement, status, or meaning | FACT | `.ai/memory/lessons/*`; readiness iteration-1 verified-and-accepted notes; GH-301 §19 | High — C-6's feasibility | High |
| No consumer beyond the README, the writer, the capsule contract, the lint, and the curator skill exists today | ASSUMPTION | Repository scan of `packages/`, `scripts/`, `.ai/`, `doc/` on 2026-11-15 | Medium — a hidden consumer would surface as a parity failure, which is the designed outcome | Medium |
| The concept's optional depth (`confidence`, `evaluation`) will be needed by the evaluation ladder before it can be required | ASSUMPTION | GH-301 OQ-2; `doc/planning/concepts/memory-architecture.md` §Record model | Low — accepting them as optional costs one declaration each and forecloses nothing | Medium |
| The exact adopter surface of the schema (which GH-302 template carries the format) | TO-CONFIRM | GH-301 documentation phase; GH-302 template set | Low — the contract is the same either way; only the distribution route is unconfirmed | Low |

## Mental Models & Techniques Used

- **First principles** — asked what a durable record *is* before asking which keys it has: an identity, a claim, who claims it, on what evidence, with what authority, valid from when, in what lifecycle state. The ten-key spine falls out of that decomposition rather than from any existing field list.
- **Inversion** — asked what must never happen: a writer emitting a record the reader cannot read (already true), a schema change that silently rewrites history, and a fifth consumer inventing its own field set. Each constraint in C-1…C-6 is a guard against one of those.
- **Second-order thinking** — traced the "just document it in the README" option forward: the writer keeps its subset, the capsule keeps its superset, the next consumer copies whichever file it found first, and the lint either fails on a legitimate promotion or is disabled. That is the current state; the decision's cost is the *last* time this gets decided.
- **Opportunity cost** — every concept key accepted as required is a tax paid by every future record author; every key rejected without a named home is a design document that contradicts the schema. The disposition table prices both.
- **Chesterton's fence on the concept model** — `valid_from`, `source.ref`, the evidence list, and `confidence` were each kept because they encode an intent, and each was resolved to a home (rename, fold into evidence, body, optional depth) rather than deleted.
- **Systems thinking** — promotion, curation, enforcement, and documentation are one loop: a schema the writer cannot render and a lint that cannot check a bound it does not know are the same defect seen from two ends.
- **Evolutionary reversibility** — the contract is designed so that widening is additive (a new optional key, a raised bound in one constant) and narrowing is a reviewed migration, which is the cheap direction to be wrong in.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 |
|----------|-----|-----|-----|-----|-----|-----|
| ALT-0 (keep the current state; no schema decision) | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-1 (one machine authority + human rendering + strict capsule projection) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 (adopt the concept record model as the schema) | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| ALT-3 (publish two peer contracts: records and candidates) | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| ALT-4 (publish the ten-key spine and leave the key set open) | ⚠️ | ✅ | ❌ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails · ⚠️ = passes only via an accepted-risk exception (none claimed)

### Alternative 0 — Do Nothing / Keep the Current State

- **Eligibility:** Not eligible (fails C-1 and C-3).
- **Summary:** Ship GH-301's layout, lint, and writer fixes with the schema living only as change-local decisions (DEC-5, DM-1) plus the README prose, and let each consumer keep its field set.
- **Constraint compliance:** Fails C-1 — four renderings remain and no artifact is authoritative, so the next consumer re-decides again. Fails C-3 — the writer keeps emitting `kind: "tacit"` into `tacits/`, which no schema can validate, and the README's format still omits the `trust` level every record must carry. C-2, C-4, C-5, C-6 pass trivially (nothing changes).
- **Driver fit:** Fails drivers 1, 2, and 8 outright; "scores" on driver 4 only by paying no authoring cost, which is the debt the decision exists to retire.
- **Pros:** Zero effort; no new artifact; no chance of over-constraining the record model before the evaluation ladder lands.
- **Cons:** The schema remains un-citable by the curator skill, the bootstrap templates, and M3; the promoted-record defect survives; the gate fails on rules that no published document states.
- **Why rejected:** Fails two non-negotiable constraints; the readiness gate escalated exactly this absence.

### Alternative 1 — One Machine Authority, Human Rendering, Strict Capsule Projection

- **Eligibility:** Eligible (passes C-1 through C-6).
- **Summary:** Declare a data-only contract module as the authority; publish its human rendering as the format a reader copies; make the promotion writer and the curator render it; let the lint enforce it; and hold the capsule candidate contract to a strict projection of it, changing only `source` validation and the non-projectable `fleet` scope.
- **Constraint compliance:** C-1 — one authority, one rendering, one projection, and a parity test that makes divergence loud. C-2 — the candidate key names and vocabularies are untouched; only `source` is validated as declared and the non-projectable scope is refused. C-3 — the writer gains `trust`, `basis`, the kind mapping, and the hint row, so a promoted record validates. C-4 — the rendering is a compact table, not prose. C-5 — findings stay inside the change's closed register; no surface is added. C-6 — the backfill adds keys only.
- **Driver fit:** Best on drivers 1, 2, 3, 6, and 8; costs one declaration per optional key (driver 4) and a compact rendering (driver 5), both budgeted.
- **Pros:** Every consumer validates against one importable declaration; the concept keeps its depth as optional keys with recorded dispositions; the two delivered writer defects become impossible by construction (the kind mapping and the area derivation are declared, not string-built); the capsule contract changes in exactly two places and neither adds a field.
- **Cons:** A ten-key spine is real authoring overhead; a closed optional set means a future concept key is a schema change (deliberate friction); the capsule gains one refusal path (`fleet` scope on a promotable class).
- **Why chosen:** See Decision.

### Alternative 2 — Adopt the Concept Record Model as the Schema

- **Eligibility:** Not eligible (fails C-2, C-3, C-4).
- **Summary:** Publish `doc/planning/concepts/memory-architecture.md` §Record model verbatim as the canonical record format: `source` as a `{type, ref}` mapping, `evidence` as a list of mappings, `valid_from`, `rationale` in frontmatter, trust as prose labels, `applies_when` as a list.
- **Constraint compliance:** C-1 passes in form (the concept becomes the authority) but at the price of every other constraint. Fails C-2 — the candidate contract would have to be re-declared to carry the mapping and list shapes, widening it beyond its delivered vocabulary. Fails C-3 — the delivered writer and reader cannot render or parse those shapes without a rewrite of the promotion path, and the lint cannot classify "one evidence link" when the field is an unbounded list, so the finding register cannot be closed. Fails C-4 — the full model with its explanatory prose does not fit the index budget as a copyable format. C-5 and C-6 pass (no new surface; the backfill is additive in principle).
- **Driver fit:** Strong on driver 8 (the design document becomes literally true) and weak everywhere else; driver 2 is the decisive failure — an unvalidatable shape yields no enforceable finding.
- **Pros:** Zero divergence between design document and schema; the richest model; no dispositions to argue.
- **Cons:** Requires changes to the delivered capsule contract, the promotion writer, and the reader; the shapes are not single-valued, so dating, provenance, and id checks would each need shape-specific branches; the format would not be copyable inside the index cap.
- **Why rejected:** Fails three non-negotiable constraints; the design document's richer model survives instead as accepted-optional keys.

### Alternative 3 — Publish Two Peer Contracts (Records and Candidates)

- **Eligibility:** Not eligible (fails C-1, C-3, C-4).
- **Summary:** Publish a record schema *and* keep the capsule candidate contract as a second published contract, each authoritative for its own domain, with a documented mapping between them.
- **Constraint compliance:** Fails C-1 by construction — two published authorities, and the divergence class the decision exists to close is now policy. Fails C-3 — the mapping is prose, so nothing proves a rendered record validates (today's `kind` and `tacits/` defects would remain legal in the candidate contract). Fails C-4 — two published formats do not fit one index budget, so the second becomes a second document that readers must find. C-2, C-5, C-6 pass.
- **Driver fit:** Weak on drivers 1, 2, and 8; its one merit (it changes nothing in the capsule) is bought exactly with the drift risk RSK-1 names.
- **Pros:** No capsule change at all; each contract stays internally coherent; the mapping document can explain the intent behind each difference.
- **Cons:** "Documented mapping" is the current state renamed; a mapping table is not a check; the next consumer picks a side.
- **Why rejected:** Fails the central constraint; formalizing the divergence is the failure mode, not the remedy.

### Alternative 4 — Publish the Ten-Key Spine and Leave the Key Set Open

- **Eligibility:** Not eligible (fails C-3; C-1 only via an exception nobody claims).
- **Summary:** Declare only the required spine, and treat any additional frontmatter key as author freedom (reported as an advisory at most), so the disposition question never arises.
- **Constraint compliance:** Fails C-3 — with an open key set, a writer's extension and a defect are indistinguishable, so "the write path renders the schema" cannot be proven and the change's `key-unknown` finding loses its contract (GH-301 F-5, Appendix A). C-1 passes only in the weak sense that a spine is declared, while the effective contract stays open — recorded as ⚠️, not claimed. C-2, C-4, C-5, C-6 pass.
- **Driver fit:** Strong on drivers 4 and 5 (the cheapest authoring cost and the smallest format) and weak on drivers 2 and 8: an open set pushes the judgment back onto every reviewer.
- **Pros:** Smallest possible format; no dispositions to argue; maximum author freedom.
- **Cons:** Supersession, applicability, guild scoping, and revalidation would each be expressed as ad-hoc keys; the lint would have to advise rather than fail, and advisories do not prevent the drift this decision exists to stop.
- **Why rejected:** Fails C-3; an open key set is exactly the state the four renderings already demonstrate.

## Decision

- **Recommendation:** Adopt **ALT-1**. The authority/projection relation is the decision; the key content below is what that relation makes binding. Adopting the concept model verbatim (ALT-2) is the tempting option and it fails on enforceability: a shape the lint cannot classify produces no finding. Formalizing two contracts (ALT-3) reproduces the current defect at a higher level of ceremony, and an open key set (ALT-4) makes the enforcement claim vacuous.

- **Authorized Decision (Proposed — subject to human ratification at the GH-301 open-PR gate):** Adopt ALT-1 as seven binding clauses.

  1. **D1 — Authority and direction.** `packages/core/src/contracts/memory-record.ts` is the single schema authority: types plus `as const` data only (required set, closed optional set, closed vocabularies, id and file-name grammars, the statement bound, the hint bound). The memory index (`.ai/memory/README.md`) publishes its human rendering; the promotion writer and the curator skill render it; the memory lint enforces it; the capsule candidate contract is a strict projection of it. Reconciliation runs **one way**: authority → rendering and authority → projection. A divergence found anywhere is a defect in the rendering or the projection, never a second schema, and a parity test parses the published human format and compares it to the module so a drift fails the gate instead of being argued.
  2. **D2 — The required spine is exactly ten keys.** The backlog's seven conceptual fields resolve as follows, and no other key is required.

     | Key | Contract | Resolves |
     |---|---|---|
     | `id` | `lesson-<YYYY>-<NNN>`, `tacit-<YYYY>-<NNN>`, or `preference-<YYYY>-<NNN>`; monotonic next free per prefix and year; unique across the tree; never reused after supersession or pruning | identity (the field the backlog calls id) |
     | `kind` | `lesson` \| `tacit_fragment` \| `preference`; selects the home area and the lifecycle expectations | kind |
     | `scope` | `repo` \| `component` \| `change` | scope |
     | `statement` | The claim, non-empty, at most 280 characters (D6) | the record's content |
     | `source` | One channel: `review_verdict` \| `ci_verdict` \| `human_correction` \| `merged_pr` | provenance (channel) |
     | `created_by` | The named writer | provenance (writer) |
     | `evidence` | Exactly one evidence link in one of the five declared shapes: `review-verdict:`, `ci-verdict:`, `human-correction:`, `merged-pr:`, `test:` | provenance (evidence) |
     | `trust` | `T0`–`T5` | trust |
     | `created` | `YYYY-MM-DD`, the single validity start, never inferred, never in the future | validity |
     | `status` | `candidate` \| `validated` \| `authoritative` \| `superseded` \| `archived` | status |

  3. **D3 — The optional key set is closed, and every concept key has a recorded disposition.** An undeclared frontmatter key is a `memory.schema.key-unknown` finding. The optional set is exactly: `supersedes`, `superseded_by`, `contradicts`, `applies_when`, `basis`, `revalidate_after`, `invalid_from`, `confidence`, `evaluation`, `guild`. The concept document's model reconciles key by key:

     | Concept key (`memory-architecture.md` §Record model) | Disposition | Where the intent lives |
     |---|---|---|
     | `id`, `kind`, `scope`, `statement`, `created_by` | **Accepted** as declared | Required spine (D2) |
     | `source` as a `{type, ref}` mapping | **Accepted, shape narrowed** | `source` is the scalar channel (the concept's `type`); the concept's `ref` half is the record's `evidence` link |
     | `trust` written as prose labels (`agent_verified`) | **Accepted, vocabulary renamed** | Required `trust` uses the concept's own T0–T5 table, which is also the capsule's declared vocabulary |
     | `valid_from` | **Renamed by design** | `created` is the single validity start; a second start date could disagree with it |
     | `invalid_from` | **Accepted** as optional | Validity end for a record that stops being valid without a replacement |
     | `supersedes` | **Accepted** as optional | Record-id list; `superseded_by` is added for the symmetric replacement side, and is required when `status` is `superseded` |
     | `status` (five lifecycle states) | **Accepted, writers narrowed** | The five declared values are the schema set; the promotion writer emits only `candidate` and `superseded`, exactly as today |
     | `scope: fleet` | **Rejected by design for records** | The value has no implemented home; it stays candidate-only and a candidate carrying it for a promotable class is refused (D7) |
     | `applies_when` as a list | **Accepted, shape narrowed** | Optional scalar predicate; a single-element sequence is read as its scalar, a multi-clause list is rejected by design (a claim that needs several clauses is a statement problem). The index row's read-when hint derives from it |
     | `evidence` as a list of mappings | **Rejected as a shape by design** | One shaped link per record so provenance is single-valued and classifiable; additional evidence is cited in the body, which the record already owns |
     | `rationale` in frontmatter | **Rejected as a frontmatter key by design** | The record body carries it; the promotion writer already renders the candidate's rationale into the body, so nothing is lost and no field duplicates prose |
     | `confidence` | **Accepted** as optional, type-checked, never required | Optional depth; required-before-authoritative is GH-301 OQ-2 |
     | `evaluation` | **Accepted** as optional, type-checked, never required | Optional depth; same deferral (GH-301 OQ-2) |
     | `revalidate_after` | **Accepted**, conditionally required | Required for an authoritative behaviour-changing lesson, optional otherwise; malformed is an error, expired is an advisory |
     | `basis` (not in the concept; from the capsule) | **Accepted**, conditionally required | One of the five capture-bar bases: optional on a record, always rendered by the promotion writer because promotion already refuses an empty basis |
     | `contradicts` (not in the concept) | **Accepted** as optional | Record-id list for a declared contradiction that does not supersede |
     | `guild` (not in the concept) | **Accepted**, conditionally required | Exactly the guild folder's name when the record lives under one; forbidden outside one |
     | Free-text preference records and the lighter per-agent header tier | **Rejected for preference records, retained for per-agent memory** | Preference records are typed and owner-written with `source: human_correction`; per-agent entry points stay free text with dated capture lines (GH-301 DEC-11) |

     The concept document is upstream design input, not an authority: after GH-301 it is reconciled to describe the schema, and a record copied from it validates.
  4. **D4 — File name and validity.** A record file is `<id>.md` or `<id>-<slug>.md` with a lowercase kebab-case slug, so a file name always begins with its record id; the area is a function of `kind` (`lesson` → `lessons/`, `tacit_fragment` → `tacit/`, `preference` → `preferences/`), never of a class token pluralized at run time. `created` is the only validity start; no key may introduce a second one.
  5. **D5 — Conditional requirements are part of the schema, not writer folklore.** `basis` is required on every promotion-written record and optional on a hand-authored one; `revalidate_after` is required for an authoritative behaviour-changing lesson; `guild` is required exactly under a guild folder and forbidden outside one; `superseded_by` is required when `status` is `superseded`; a `preference` record's `source` is `human_correction`. These conditions are declared in the contract and checked by the lint's schema area, so a hand-authored record cannot be stricter or looser than a promoted one.
  6. **D6 — Published numeric bounds.** The statement is bounded at **280 characters** (measured floor: the longest delivered statement is 245, and the migration may not rewrite it) and the index row's read-when hint at **120 characters**. Both are single-sourced constants in the contract module, published in the human rendering, and imported by the lint and the boundary fixtures — never restated in a test or a document. The hint is derived from `applies_when` with the statement as fallback; it is a read-when hint, not a truncated statement.
  7. **D7 — The capsule candidate contract is a strict projection of the schema, and the projection is validated.** Key names are identical where the two overlap; every candidate closed vocabulary is equal to, or a subset of, the schema's (the candidate's three `status` values are a subset of the schema's five, and the writer emits `candidate` on creation and `superseded` on a declared supersession; `scope` is the schema set plus `fleet`; `trust`, `basis`, and the evidence shapes are identical). Two capsule fields are projection-only and are not record keys: `class` (mapped to `kind`, with `tacit` → `tacit_fragment`) and `hint` (mapped to the index row, sourced from `applies_when`). The memory-record read projection (`id`, `class`, `statement`, `status`, `path`) stays a projection, gains no field, and is not a schema. The candidate-to-record projection is validated rather than assumed: `source` is checked against the four channels at candidate-schema time (the tightening GH-301 DEC-8 records, refused through the existing capsule-invalid identity), and a candidate that cannot project into a valid record — a `lesson` or `tacit` candidate carrying `scope: fleet` — is refused through the same identity instead of being written with a coerced or out-of-vocabulary value. Nothing else in the capsule contract changes: no candidate field is added, no event, no file naming, no terminal close.

- **Rationale (tied to drivers):** Driver 1 eliminates ALT-3: a documented mapping between two published contracts is the current state renamed, and the drift risk RSK-1 names becomes policy. Driver 2 eliminates ALT-2 and ALT-4: the lint can only fail on a declared, single-valued contract, and neither an unbounded evidence list nor an open key set yields a classifiable finding, so the change's own acceptance criterion (zero schema findings on the delivered tree) would be untestable in the cases that matter. Driver 3 is why the trust vocabulary, the evidence shapes, and the capture-bar bases are reused verbatim from the delivered capsule contract instead of restated. Driver 4 shapes D3: the concept's richer keys are kept as optional because each costs one declaration, while every key that would be legal-but-unread in the required spine was kept out of it. Driver 5 is why D6 publishes both numbers and why D3's table is the rendering's content — the table is the copyable format. Driver 6 is why D7 changes the capsule in exactly two places and why the two delivered writer defects are fixed by declaration (kind mapping, area derivation) rather than by patching a string. Driver 7 is the reason for the strictness now: the contract reaches adopters through templates, so it is worth one deliberate pass.
- **Decider:** Juliusz Ćwiąkalski (owner) — human ratification at the GH-301 open-PR gate; AI does not accept this R2 record.
- **Conditions for revisit:** See `revisit_triggers`; principally a fifth consumer that cannot express itself from the contract, a required key that proves to be dead weight, or a legitimate statement that cannot fit 280 characters.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-6, as recorded in the ALT-1 row of the compliance matrix. C-1: one authority, one rendering, one projection, with a parity test. C-2: the candidate key names and vocabularies are unchanged; the only changes are `source` validation and the `fleet`-scope refusal, both within the existing capsule-invalid identity. C-3: the writer renders the spine plus its conditionals and the hint row, so a promoted record and its row validate. C-4: the rendering is the D2/D3 table set, measured against the index caps in the change's budget evidence. C-5: no command, doctor area, error-table row, domain kind, or finding outside GH-301's closed register. C-6: the backfill adds required keys and nothing else. No accepted-risk exceptions are claimed.

## Trade-offs & Consequences

### Positive Outcomes

- **One contract, citable by the next consumer.** The curator skill, the bootstrap template set, M3-S8, and M3-S9 validate against one importable declaration instead of re-deciding what a record is; a new consumer's disagreement becomes a failing test rather than a fifth rendering.
- **The writer's two latent defects become impossible by construction.** `kind: "tacit"` and the `tacits/` directory exist because the kind and the home area are derived from a class token at run time; D4/D7 declare both, so a tacit promotion lands in `tacit/` with a schema-valid kind — and the record stops escaping the coverage universe.
- **The gate's rules become checkable by an author.** Every bound (`280`, `120`), every closed set, and every conditional requirement is published in the file a human copies, so a schema finding is actionable without reading the check.
- **The design document stays useful without becoming an authority.** Each of the concept's richer keys keeps an explicit home, so a future reader can reconcile the two without re-deriving the argument, and a record copied from the concept now validates.
- **Reversal is additive.** Widening (a new optional key, a raised bound) is one constant plus its rendering; the records already written stay valid.

### Negative Outcomes

- **Ten required keys is real authoring cost.** A hand-authored record grows from a four-line header to a ten-line frontmatter block, and a promotion-written record carries every key whether or not the candidate said anything interesting about it.
- **The closed optional set creates deliberate friction.** A future concept key, or a consumer that wants one more field, must change the contract, the rendering, the writer, and the lint in one change. That is the point, and it will feel like ceremony the first time it is hit.
- **One evidence link per record loses the concept's evidence list from the frontmatter.** Additional links move into the body, so a tool cannot enumerate every piece of evidence from frontmatter alone; retrieval that needs the full set must read the body.
- **Rejecting `rationale` as a frontmatter key** means a consumer cannot index rationale structurally; it is prose in the body by design.
- **The capsule gains one refusal path.** A `lesson`/`tacit` candidate with `scope: fleet` is now refused through the capsule-invalid identity instead of producing a record with an unimplemented scope — a small behaviour change on a live promotion path (RSK-7's class, mitigated by the fact that the alternative is writing an invalid record).
- **The 280-character bound will bind.** Verbose authors will hit it, and the honest remedy is a statement rewrite, not a truncation.

### Unresolved Questions

- [ ] Whether a durable record's `trust` may ever be `T0`/`T1` (external, unquarantined content). The vocabulary admits them and the concept's write gate forbids the case, but no finding in GH-301's closed register expresses "trust floor violated" — deferred rather than invented (owner: @decision-advisor when the fleet/quarantine work is scheduled).
- [ ] Whether `confidence` and `evaluation` become required for behaviour-changing records once the evaluation ladder lands (owner: the evaluation work; GH-301 OQ-2).
- [ ] Whether an expired revalidation window ever becomes gating rather than advisory (owner: the lifecycle-state work; GH-301 OQ-4).
- [ ] Which GH-302 template carries the rendering to bootstrapped projects, and whether an adopter's pre-schema tree needs a migration note (owner: @doc-syncer / GH-301 documentation phase).

## Implementation Plan

1. **Declare the authority.** `packages/core/src/contracts/memory-record.ts`: required and optional key sets, the seven closed vocabularies, the id and file-name grammars, and the `280` / `120` bounds as `as const` data with no runtime API; the exported const surface is what the content-inventory allowance row pins.
2. **Render it once for humans.** Rewrite the memory index's "Promoted record format" section to the D2/D3 contract inside its 200-line and 25 KB caps, including the dispositions a record author needs (why `rationale` lives in the body, why one evidence link, why `fleet` is not a record scope).
3. **Bring the enforcement surface onto the contract.** The memory lint's schema, dating, provenance, reference, and index areas read every key name, closed value, grammar, and bound from the contract module; the derivable and secret areas are untouched by this decision.
4. **Align the write paths.** The promotion writer renders the full spine plus its conditionals, maps `tacit` → `tacit_fragment`, derives the home area from the kind, and emits the read-when hint; the curator skill's written rules name the same key set, id rule, budgets, and status transitions.
5. **Tighten the projection.** The capsule candidate `source` is validated against the four channels, and the non-projectable scope is refused; the candidate key set, the candidate file naming, the events, and the terminal close stay as delivered.
6. **Backfill and prove.** Add the required `trust` level and a shaped evidence link to the three delivered records without touching a statement, status, id, or body; run the whole-tree lint to zero schema findings; land the parity test that parses the published rendering against the contract before the invariant is enabled in the aggregate gate.
7. **Reconcile the surrounding documentation.** The kernel memory section gains its schema pointer inside budget; the concept document describes the schema rather than competing with it; the current-truth feature specs are reconciled in the GH-301 documentation phase.

## Verification Criteria

- Metric: required fields declared in the contract and absent from a rendered record — Target: 0 — Window: delivered HEAD and every subsequent run.
- Metric: schema-drift surface (a key, value, grammar, or bound declared in the human rendering, the writer, the projection, or the lint and absent from the contract) — Target: 0, proven by the parity test — Window: every gate run.
- Metric: findings on a promotion-written record and its index row — Target: 0 — Window: promotion behaviour suite.
- Metric: whole-tree schema findings at the delivered HEAD — Target: 0 (advisories disclosed in the summary) — Window: the change's gate run at delivery.
- Metric: schema constants restated outside the contract module (bounds, vocabularies) — Target: 0 — Window: code review plus the boundary fixture that imports the bound.
- Metric: merge conflicts caused by a record write — Target: 0 record-file conflicts (the shared index row resolves by the documented union rule) — Window: GH-301's concurrency exercise.
- Metric: memory lint cost added to the aggregate gate — Target: ≤1 s — Window: the change's measured gate evidence.

## Confidence Rating

Medium-high. The problem statement rests on measured repository facts (four renderings, the two writer defects, the statement lengths, the index headroom), and the chosen shape reuses three delivered, tested vocabularies rather than inventing them. Confidence is not high for two reasons that are recorded rather than hidden: the 280-character bound is a judgement call sized from three records, and the trust-floor question is left as a convention because the closed finding register has no identity for it. Neither threatens the authority/projection decision, which is the load-bearing part.

## References

- GH-301 specification: `doc/changes/2026-11/2026-11-15--GH-301--memory-records-layout-lint/chg-GH-301-spec.md` (§5.1 F-1/F-2/F-3/F-5/F-6/F-7, §8.3 DM-1, DM-3, DM-5, DM-6, §15 DEC-5, DEC-7, DEC-8, DEC-12, §17 AC-F2-1…AC-F3-2, Appendix A, Appendix C)
- GH-301 readiness iteration 1: `doc/changes/2026-11/2026-11-15--GH-301--memory-records-layout-lint/readiness-review/readiness-iter-1.md` (findings 11, 12, 17; finding 20 is the escalation this record answers)
- Published record format: `.ai/memory/README.md` (§Promoted record format, §Id allocation, §Curator operation set, §Promotion routing, §Conflict reality)
- Design model: `doc/planning/concepts/memory-architecture.md` (§Record model, §Trust levels, §Write gate)
- Capsule contract: `packages/core/src/contracts/capsule.ts` (`CAPSULE_CANDIDATE_REQUIRED_KEYS`, `CAPSULE_CANDIDATE_OPTIONAL_KEYS`, `CAPSULE_CANDIDATE_CLASSES`, `CAPSULE_CANDIDATE_SCOPES`, `CAPSULE_CANDIDATE_STATUSES`, `CAPSULE_CANDIDATE_TRUST`, `CAPSULE_CAPTURE_BAR_BASES`, `CAPSULE_EVIDENCE_PREFIXES`, `CapsuleMemoryRecord`)
- Promotion writer: `packages/core/src/domain/capsule-candidates.ts` (`recordContent`, `indexRowOf`, `nextRecordId`, `validateCandidate`)
- Promotion reader and home writes: `packages/adapters/src/file/memory-promotion.ts`
- Delivered records: `.ai/memory/lessons/lesson-2026-00{1,2,3}-*.md`
- Related decisions: PDR-0004 (the meta-learning reference stays repo-internal — the distribution boundary this schema is published inside), ODR-0001 (the `ados_distribution` marker as the install-set source of truth)
- Decision process: `doc/guides/decision-making.md` §7 (ADR/TDR routing and the blast-radius tie-breaker), §8 (constraints versus drivers)
