---
id: ODR-0005
decision_type: odr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "`closeout --apply` gains milestone synchronization as step 12 of 13 (before the terminal capsule step): it verifies the change's declared milestone against the provider-asserted attachment, evaluates the exit review over one bounded adapter-local milestone read, and closes the milestone only when every attached item is closed — through one new closed operation `close-milestone` that cannot express create, attach, detach, rename, or reopen; a withheld closure is a `skipped-noop` plus one additive `milestone-sync-withheld` residue item, a write failure is the delivered gating failure, dry-run stays zero-write, and GitLab/Jira declare gaps rather than silently skipping."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os closeout transaction and the provider adapter operation set"
decision_scope: repo
review_date: null
business_impact: "The flip's 'closeout leaves no leftovers' bar stops excluding the planning unit: a milestone record that is the tracker's statement of scope can now be closed by the transaction that closes its last ticket, with the exit review as the gate rather than an operator's memory."
customer_impact: "An operator sees, on every closeout, whether the ticket's milestone attachment matches the change's declaration and — when it does not hold — exactly why the milestone was not closed, instead of discovering an open milestone (or a wrongly closed one) later."
classification:
  domains: [operations, process, contracts, governance]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-349: @pm routed the milestone-sync question to a record during clarify_scope, and flagged the operation-set question as a doc-impact risk)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-349 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-349 clarify_scope: no milestone step exists anywhere in `packages/`, and the closed operation set must not widen silently)"
    - "@decision-advisor (repository analysis and this record)"
    - "@spec-writer (carry the step, the outcome table, and the two additive surfaces into the GH-349 change spec)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-349 PR review — this record widens a closed operation set and touches a PDR-0005 governance rule)"
    - "@decision-critic (optional independent challenge at R2)"
  performers:
    - "@coder (GH-349 delivery: step, exit-review evaluation, close-milestone operation, adapter read and write, conformance ripple, regression)"
    - "@doc-syncer (closeout spec thirteen-step inventory, adapter-ports/parity/result-contract reconciliation, milestone-management pointer)"
  informed:
    - "@pm and the coordinator — they now receive a milestone verdict from every closeout"
    - "M3-S3 GitLab adapter (GH-337) and M3-S2 Jira adapter (GH-336) — both take a declared position on the two surfaces"
    - "Owners of the milestone packs — closure now happens through the transaction, not by hand"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The owner reads PDR-0005 C-2's 'never a milestone write' as a global prohibition rather than a boundary on the attachment-check enforcement: withdraw the closure half and keep attachment verification plus a withheld-closure residue item, as a superseding record."
  - "A milestone is routinely unclosable through the tool because attached tickets were deliberately detached with a recorded reason: decide how a recorded detachment is represented to the exit review (an operator-declared input, not a tracker write) rather than weakening the all-closed rule."
  - "Milestone sync is wanted per member repository on a multi-repository change: that is a per-member planning unit with its own declaration source, and needs its own record — the member path is out of scope here."
  - "The entry review, planned-scope verification, or scope extension/reopening is wanted as an engine operation: those are scope commitments, and a `milestone` command family is the honest home — never this step."
  - "A milestone's attached set routinely exceeds one provider page, so it can never close through the transaction: decide a bounded multi-page or provider-side complete read as its own additive decision — the one-page, no-follow-up-pagination, truncation-withholds rule stays in force until that decision lands."
links:
  related_changes: ["GH-349"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-349--merge-closeout-queue-repair/chg-GH-349-pm-notes.yaml"
    - "doc/spec/features/feature-closeout.md"
    - "doc/spec/features/feature-adapter-ports.md"
    - "doc/spec/features/feature-adapter-conformance.md"
    - "doc/spec/features/feature-result-contract.md"
    - "doc/guides/milestone-management.md"
    - "doc/decisions/PDR-0005-milestone-first-planning-and-delivery.md"
  contracts:
    - "packages/core/src/contracts/closeout.ts"
    - "packages/core/src/contracts/adapter-capabilities.ts"
    - "packages/core/src/contracts/ports.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/domain/closeout.ts"
    - "packages/adapters/src/github/normalize.ts"
  diagrams: []
  decisions: ["PDR-0005", "TDR-0008", "TDR-0033", "TDR-0036", "ADR-0005", "TDR-0031"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S11", "GH-349"]
---

# ODR-0005: Milestone Synchronization in `closeout --apply` — Attachment Verification and Exit-Review-Gated Closure

## Context

GH-349 requires `closeout --apply` to leave "a closed issue, and a synced milestone". The transaction
delivers the first half and has no second half at all: the plan is a deterministic twelve-step
inventory (`packages/core/src/contracts/closeout.ts:44-57`, read 2026-11-18), and no milestone step,
operation, port method, or record exists anywhere in `packages/` (repository scan for `milestone`,
2026-11-18: only read-side normalization, status, and ceremony inputs appear).

The operating rule that governs milestones is written and unambiguous
(`doc/guides/milestone-management.md`, PDR-0005): a milestone title is `M<n>: <outcome phrase>`; the
tracker record is the source of truth for identity, attachment, and state; every `change` ticket is
attached at creation; **exit review precedes closure** — "every attached ticket must be closed, or
removed from the milestone with a recorded reason"; closure is not a licence to keep attaching work; and
"an agent never creates a milestone autonomously" (a missing milestone is *proposed* to the owner).

What the delivered code can and cannot see is the crux. The work-item read already carries the
provider-asserted milestone title as an optional field with absent-means-unknown semantics
(`packages/core/src/contracts/ports.ts:123-127`; GitHub normalization at
`packages/adapters/src/github/normalize.ts:366-380`). But the only work-item write is labels and
assignee (`packages/core/src/contracts/closeout.ts:676-678`;
`packages/adapters/src/github/client.ts:532-556`), the closed operation set has nine members and no
milestone surface (`packages/core/src/contracts/adapter-capabilities.ts:24-34`), and closeout's
`queueRemoval` shows the alternative shape: an additive non-step disclosure that explicitly "changes no
step outcome or exit code" (`packages/core/src/contracts/closeout.ts:571-604`;
`packages/core/src/domain/closeout.ts:1475-1487`).

GH-349's clarify-scope note names the open question precisely: the spec "must decide this explicitly
rather than silently widening the operation set" (`chg-GH-349-pm-notes.yaml`, doc-impact risks).

## Problem Framing (Clarified)

"What is a synced milestone?" has three candidate answers, and only one of them is checkable:

1. **The attachment matches.** The ticket carries the milestone the change declares. Observable today
   from two provider-asserted reads (work item milestone + the change's own declaration).
2. **The milestone record is in the right state.** It is open while work is in flight and closed once
   the exit review holds. Not observable today at all: no read surface exposes a milestone record or its
   attached set, and no write surface can change its state.
3. **The operator has done a bookkeeping pass.** Not a mechanical property.

Answer 1 alone cannot be "a synced milestone" — a milestone that stays open forever is the status quo
GH-349 names as a leftover. Answer 2 alone is unsafe — closing a milestone whose attached tickets are
still open is exactly the "implied completion" the guide forbids. So the mechanical meaning must be
**1 ∧ 2**: verify the attachment, then close only when the exit review holds, and say so when it does
not.

Two design questions follow.

- **Where does the effect live?** A step and a non-step disclosure are both delivered patterns with
  opposite purposes: the disclosure exists so a fail-open hook cannot change step outcomes or the exit
  code. A closure has a safety prerequisite and a destructive effect; hiding it in a fail-open block
  would make a withheld closure and a failed closure look alike.
- **How does the effect become expressible?** Not by widening the work-item write: a milestone is a
  different provider entity, and a widened write would let one operation mean "label an issue" and
  "close a scope commitment" — the capability-honesty failure TDR-0008 and TDR-0033 already rejected
  twice.

## Constraints (Hard Requirements)

### C-1: The transaction can never create, attach, detach, rename, or reopen a milestone

- **Statement:** No closeout effect creates a milestone record, changes any item's milestone
  attachment, renames a milestone, or returns a closed milestone to open; these acts are not merely
  forbidden by policy but unrepresentable in the operation vocabulary.
- **Source:** prior decision PDR-0005 (decisions 2 and 6) + guide "Creation", "Attachment",
  "Extension and reopening" (`doc/guides/milestone-management.md:37-57,95-104`).
- **Verification:** code review of the operation's argument and effect union + test (no argument shape
  can express them).
- **Negotiable:** no.

### C-2: Closure happens only after the exit review holds

- **Statement:** The milestone is closed only when the record is open and every attached item is closed
  (`done`/`canceled`); an open, unknown, unavailable, or truncated attached set withholds closure.
- **Source:** prior decision PDR-0005 (decision 6) + guide "Exit review" and "Closure"
  (`doc/guides/milestone-management.md:82-93`).
- **Verification:** test (open attached item, unavailable signal, and truncated set each withhold).
- **Negotiable:** no.

### C-3: The effect is idempotent and dry-run visible

- **Statement:** Plan mode performs the read and renders the verdict with zero writes, zero appends, and
  zero fence acquisitions; apply mode reuses a persisted terminal outcome for the same operation identity;
  an already-closed milestone is `satisfied` with zero writes.
- **Source:** AC (GH-349 "closeout is idempotent") + delivered closeout contract
  (`feature-closeout.md:70-74,98-104`).
- **Verification:** test (two consecutive applies: one write total; plan performs zero writes).
- **Negotiable:** no.

### C-4: Capability honesty and no silent widening of the closed operation set

- **Statement:** The milestone write is one new, distinctly named closed operation with narrow
  semantics; every adapter declares support or a valid gap reason; the flow registry, parity matrix,
  coverage gates, and expected projections move in the same change.
- **Source:** prior decisions TDR-0033 C-2/C-4, TDR-0008; adapter-ports capability rule.
- **Verification:** test (supported + gaps cover the closed set exactly; runtime coverage) + code review.
- **Negotiable:** no.

### C-5: Additive within the delivered closeout contract

- **Statement:** `delivery.closeout.v1` gains no required field; step ids are additive and consumers
  keep resolving by `stepId`; the `closeout.step.<id>.failed` family slot validates against the
  effective step set; one residue kind is added and none is renamed.
- **Source:** internal standard (`feature-closeout.md:382-388,427-442`).
- **Verification:** test (payload shape, step-id resolution, family-slot validation) + code review.
- **Negotiable:** no.

### C-6: No new credential, transport, or network location

- **Statement:** Both surfaces ride the existing injected transport and credential port; no secret-read
  allowlist entry is added.
- **Source:** prior decision ADR-0005 + adapter construction rules.
- **Verification:** test (secret-read invariant count unchanged) + boundary review.
- **Negotiable:** no.

### C-7: Bounded cost

- **Statement:** At most one milestone read and at most one milestone write per run; the read is exactly
  one bounded provider page at the declared page size with no follow-up pagination, no polling, and no
  retry; `CLOSEOUT_MAX_ATTACHED_ITEMS` (200) is a logical cap that the single page realizes only up to
  its own size, and a page whose truncation marker reports omitted items withholds closure.
- **Source:** internal standard (closeout bounded-operations rule; `feature-closeout.md:26-30`).
- **Verification:** test (per-run call-count assertions including zero follow-up page requests; truncation withholds) + code review.
- **Negotiable:** no.

### C-8: The declared milestone is the only target

- **Statement:** The target is the change's own declared milestone (pm-notes `milestone`, recorded at
  intake per PDR-0005 decision 3); an absent or non-conforming declaration never becomes a guessed,
  derived, or title-similar target.
- **Source:** prior decision PDR-0005 (decision 3) + ADR-0004 absence rule.
- **Verification:** test (absent declaration skips with a recorded reason; no title matching).
- **Negotiable:** no.

## Decision Drivers

1. **D-1 Unattended safety.** A withheld closure is always better than a wrong one; the transaction must
   fail toward "not closed, here is why".
2. **D-2 The AC must be literally satisfiable.** "A synced milestone" has to be a mechanical,
   checkable outcome of the transaction, not a documented intention.
3. **D-3 Legibility of a non-event.** The most common outcome is *not* closing (any ticket that is not
   the milestone's last): the operator must see why, once, without reading the tracker.
4. **D-4 Structural safety over discipline.** The forbidden acts should be unrepresentable, not
   documented prohibitions a future caller can violate.
5. **D-5 Honest classification.** Unsupported, unavailable, withheld, and failed are four different facts
   and must not collapse into one another or into a silent skip.
6. **D-6 Smallest additive surface on the paved road.** Reuse the step, outcome, ledger, and residue
   machinery that already exists rather than inventing a second disclosure plane.

Priority order: **D-1 > D-2 > D-4 > D-5 > D-3 > D-6.** D-6 yields to D-4: the narrowest surface is the
one that cannot express a forbidden act, even when a wider one would be cheaper.

*(Overlap check: boundedness, additivity, and never-guess are gates (C-5, C-7, C-8) and appear here only
as ranking values. The gate decides eligibility; the driver ranks survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-349 clarify_scope routed the milestone question here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-349 PR review. AI does not
  accept this R2 record, and AI does not decide that a milestone should close.
- **Contributors:** `@pm` (gap evidence, position, doc-impact constraint); `@decision-advisor` (analysis
  and record); `@spec-writer` (carry the step and its vocabulary into the change spec).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, the owner for acceptance, and an optional
  `@decision-critic` challenge — this record widens a closed set and interprets a PDR-0005 constraint.
- **Performers:** `@coder` (step, exit-review evaluation, operation, adapter read/write, conformance
  ripple, regression); `@doc-syncer` (closeout, adapter-ports, conformance, result-contract, guide
  pointer).
- **Informed:** `@pm`/coordinator; GitLab and Jira adapter owners; milestone-pack owners.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Closeout has exactly twelve steps and no milestone surface anywhere in `packages/` | FACT | `packages/core/src/contracts/closeout.ts:44-57`; repository scan (read 2026-11-18) | A partial implementation could be extended instead of built | High |
| The work-item read carries the provider-asserted milestone title, absent-means-unknown | FACT | `packages/core/src/contracts/ports.ts:123-127`; `packages/adapters/src/github/normalize.ts:366-380` | Attachment verification would need a new read | High |
| The only work-item write is labels plus assignee clear | FACT | `packages/core/src/contracts/closeout.ts:676-678`; `packages/adapters/src/github/client.ts:532-556` | Milestone closure could reuse it | High |
| The closed operation set has nine members, five provider-facing closeout operations among them | FACT | `packages/core/src/contracts/adapter-capabilities.ts:24-34`; `packages/core/src/contracts/closeout.ts:86-93` | The additive budget would differ | High |
| `queueRemoval` is the delivered non-step disclosure pattern and explicitly changes no step outcome or exit code | FACT | `packages/core/src/contracts/closeout.ts:571-604`; `packages/core/src/domain/closeout.ts:1475-1487,2333-2338` | The disclosure alternative would be cheaper than it is | High |
| Exit review requires every attached ticket closed or detached with a recorded reason | FACT | `doc/guides/milestone-management.md:82-93` | The closure gate would need a different predicate | High |
| Agents may never create a milestone autonomously | FACT | PDR-0005 decision 2; `milestone-management.md:37-43` | Creation would be a candidate effect | High |
| The step-id family slot is validated against the effective `CLOSEOUT_STEP_IDS` set | FACT | `feature-closeout.md:437-438`; `packages/core/src/contracts/error-table.ts` closeout family | A new step id would need no family rewording | High |
| Residue kinds are a closed set of eight today | FACT | `doc/spec/features/feature-closeout.md:251-255` | A withheld closure would be visible by another route | High |
| pm-notes records the milestone at intake and is the closeout-time declaration source | FACT (contract) / ASSUMPTION (this change reads it, not the spec front matter) | `packages/core/src/contracts/pm-notes.ts:59,119`; PDR-0005 decision 3 | The declaration source would need to be the change spec | Medium-High |
| GitHub exposes a milestone record with state and attached issues, writable to `closed` | ASSUMPTION (documented REST surface; proven by fixture) | provider documentation | The reference adapter would declare a gap and the step would degrade to attachment verification only | Medium-High |
| Jira has no milestone equivalent with this closure semantics (versions/fixVersions differ) | ASSUMPTION | provider model; adapter posture | A false gap would be declared | Medium |

## Mental Models & Techniques Used

- **Inversion.** "What makes this dangerous?" Closing a scope commitment that still has open work;
  creating or attaching scope without the owner; silently reporting a skip as a success. Each maps to
  C-2, C-1, and D-5 respectively.
- **Structural safety over policy.** The strongest guarantee is a vocabulary that cannot say "create",
  "attach", or "reopen". The operation name and its single effect do the work that a paragraph of
  prohibition would otherwise have to.
- **Second-order thinking.** Making it a step means a write failure is gating — which sounds worse than
  a fail-open block until you notice that a hidden failed closure is indistinguishable from a deliberate
  one, and that the capsule ceremony should not run past a failed effect in the same transaction.
- **Systems thinking.** The milestone is a join key across the tracker record, the planning pack, the
  change declaration, and the ticket attachment (PDR-0005's four-surface argument). The step verifies
  the join on the change it is closing and touches nothing else.
- **Opportunity cost.** A separate `milestone` command family would carry entry review, planned-scope
  verification, and extension as well — a scope-commitment surface owned by the owner. That is the right
  home for those acts and the wrong home for a post-merge closeout effect.
- **KISS.** Step, outcome, ledger identity, residue: four delivered mechanisms, no new plane.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 | C-7 | C-8 |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|
| ALT-0 no milestone handling (status quo) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 thirteenth step + `close-milestone` + bounded read (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 non-step disclosure on the `queueRemoval` pattern | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 widen `write-work-item` to carry milestone fields | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 attachment verification only, closure always reported as residue | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 separate `milestone close` command | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception. ALT-5's ⚠️ marks the one
accepted-risk consideration discussed below; it is not chosen.

### Alternative 0 — Do Nothing (baseline)

- **Eligibility:** Eligible.
- **Summary:** Leave the twelve-step inventory; a milestone is closed by hand after the last ticket.
- **Constraint compliance:** Passes every constraint vacuously.
- **Driver fit:** Fails D-2 outright and D-3 (no signal at all); best on D-6.
- **Pros:** Zero surface, zero risk.
- **Cons:** The AC's "synced milestone" remains an intention; the flip's closeout bar keeps an entirely
  manual step; operators learn about an open milestone only when they look.
- **Why rejected:** It leaves half of a stated acceptance criterion unimplemented, and GH-349's purpose is
  precisely to remove the manual closeout step.

### Alternative 1 — Thirteenth Step With an Exit-Review-Gated Closure Operation (chosen)

- **Eligibility:** Eligible.
- **Summary:** `milestone-sync` becomes step 12 of 13 (before the terminal `capsule`): verify the
  declared milestone against the provider-asserted attachment, read the milestone record and its bounded
  attached set through one adapter-local read, close through one new `close-milestone` operation when
  every attached item is closed, and report a withheld closure as `skipped-noop` plus one residue item.
- **Constraint compliance:** Passes all of C-1…C-8 (matrix row).
- **Driver fit:** Best on D-1, D-2, D-4, D-5; good on D-3; one step, one operation, one read, one residue
  kind on D-6.
- **Pros:** The AC becomes checkable; the forbidden acts are unrepresentable; the common outcome
  ("not the last ticket") is legible; the effect rides the delivered ledger, outcome, and residue
  machinery.
- **Cons:** The operation set grows and the conformance ripple is paid here; the milestone inventory
  statement changes from twelve to thirteen; the step is gating, so a failed closure stops the run before
  the capsule ceremony.
- **Why chosen:** It is the only eligible alternative that both satisfies the AC and makes the unsafe
  acts impossible rather than prohibited.

### Alternative 2 — Non-Step Disclosure on the `queueRemoval` Pattern

- **Eligibility:** Eligible.
- **Summary:** Add an additive `milestoneSync` data block computed after the steps, with no step id and no
  step outcome.
- **Constraint compliance:** Passes every constraint; the disclosure pattern is explicitly designed to
  change no step outcome and no exit code.
- **Driver fit:** Fails D-5: a withheld closure, an unsupported adapter, and a failed write would all be
  `skipped`-shaped data, and a failed write could not fail the transaction. Weak on D-2 (nothing in the
  plan/outcome vocabulary expresses "synced") and on D-3 (the block is machine data; the human digest does
  not render queue disclosures today).
- **Pros:** Smallest delta to the step inventory; fail-open by construction; no family-slot change.
- **Cons:** A destructive, safety-gated effect hidden in a fail-open hook; a failed closure cannot be
  distinguished from a legitimate skip; the plan cannot show it before apply.
- **Why rejected:** The disclosure pattern exists to protect a *non-gating* convenience. Reusing it for a
  gated write inverts its purpose.

### Alternative 3 — Widen `write-work-item` to Carry Milestone Fields

- **Eligibility:** Not eligible (fails C-1 and C-4).
- **Summary:** Add milestone arguments to the existing work-item write so the closeout step can close the
  milestone through it.
- **Constraint compliance:** C-1 fails because the same operation would then be able to attach and detach
  (the arguments exist), so the forbidden acts become representable; C-4 fails because a provider that can
  label an issue but not close a milestone could no longer express the difference.
- **Driver fit:** Attractive only on D-6.
- **Pros:** No closed-set change, no conformance ripple, one write path.
- **Cons:** One operation meaning "label an issue" and "close a scope commitment" on a different entity;
  the destructive effect loses its own guard, identity, and read-back story.
- **Why rejected:** It is the exact overload TDR-0008 and TDR-0033 rejected — twice — for weaker reasons.

### Alternative 4 — Attachment Verification Only, Closure Always Reported as Residue

- **Eligibility:** Eligible.
- **Summary:** Compare the declared milestone to the attached one, report the exit-review status, never
  write.
- **Constraint compliance:** Passes every constraint (it performs no write at all).
- **Driver fit:** Good on D-1 and D-6, fails D-2 (the milestone record is still never synced by the tool)
  and weak on D-3 (the operator still closes by hand with no in-transaction verdict).
- **Pros:** Zero destructive surface, zero operation-set change, zero conformance ripple.
- **Cons:** The last ticket of a milestone still ends with a manual step; "synced" keeps meaning "we
  looked".
- **Why rejected as the whole mechanism — and retained as its withheld branch.** Withholding is the
  correct behaviour when the exit review does not hold or the surface is unavailable; it is not the
  correct behaviour when the tool could safely close.

### Alternative 5 — A Separate `milestone close` Command

- **Eligibility:** Eligible-with-accepted-risk-exception candidate.
- **Summary:** Add a command family for milestone acts; closeout does nothing.
- **Constraint compliance:** C-5 is strained (a new command surface plus a step-less AC), which is the
  ⚠️; every other constraint passes. The strain is not accepted, so the alternative is not selected.
- **Driver fit:** Good on D-6's "one home for milestone acts", fails D-2 (the AC binds the effect to
  `closeout --apply`) and D-1 (an operator must remember to run it after the last ticket).
- **Pros:** A natural future home for entry review, planned-scope verification, and extension/reopening —
  the owner's scope acts.
- **Cons:** A new verb with its own lifecycle wiring; the closeout AC is not met; two commands would need
  the same read.
- **Why rejected:** Wrong trigger and wrong authority for a post-merge bookkeeping effect. The future
  command remains the named home for owner scope acts (revisit trigger).

## Decision

- **Decision:** Adopt **Alternative 1**, with Alternative 4's restraint as the default branch.

### 1. Position in the plan

`milestone-sync` is added as step **12** of a thirteen-step plan; `capsule` stays the terminal step at
13. Rationale: the change's own ticket closure (step 1) must already have landed for the exit review to
hold on the last ticket, and no effect may follow the terminal capsule close. Consumers keep resolving
steps by `stepId`, so the insertion is additive; the documented "twelve-step" inventory becomes
thirteen in the same change.

### 2. Attachment verification

The declared milestone is the change's pm-notes `milestone` (recorded at intake). The observed
attachment is the provider-asserted `WorkItem.milestone` on the change's own work item. Absent
declaration, a non-`M<n>:`-shaped declaration, or a declaration/observation mismatch never becomes a
target: the step is `skipped-noop` with a residue item naming the fact, and nothing is written.

### 3. Exit review

One bounded adapter-local milestone read returns the record (identity, title, state) and its attached
work items with their delivery states, read as **one bounded provider page at the declared page size** —
no follow-up pagination, no poll, no retry. `CLOSEOUT_MAX_ATTACHED_ITEMS` (200) remains the declared
logical cap, but the effective bound is that one page: a provider that pages smaller realizes only its
page, and the record states the bound as one page rather than as an unreachable ceiling. Closure holds
only when the record is open and **every** attached item in that page is `done` or `canceled`, and the
page's own truncation marker is the decisive fact that the full set was not observed. An unavailable
signal, an unknown state, or a truncated attached set withholds closure — a partial view never closes a
scope commitment — and the tool never paginates, never retries the read, and never guesses the
remainder. Detached-with-a-recorded-reason is an operator act the tool cannot observe; a milestone that
needs a detachment stays withheld until the owner detaches and re-runs.

### 4. The effect

One new closed operation, `close-milestone`, with canonical arguments
`{ milestone: ProviderQualifiedIdentity }` and one effect: set the milestone record to `closed`. The
operation vocabulary cannot express create, attach, detach, rename, or reopen (C-1 becomes structural).
It is read-back verified (the provider must assert the closed state), at most once per invocation,
never retried, and reports `alreadyApplied` when the record already reads closed. GitHub supports it;
GitLab declares `adapter-not-implemented`; Jira declares `provider-unsupported`.

### 5. Outcomes, residue, and failure posture

| Condition | Plan | Apply | Residue (`milestone-sync-withheld`) |
|---|---|---|---|
| Milestone declared, attached, exit review holds, record open | `would-apply` | `applied` | — |
| Record already closed | `satisfied` | `satisfied` | — |
| Declared milestone absent or malformed | `skipped-noop` | `skipped-noop` | `declared-milestone-missing` |
| Declared value `none` (project has no milestone construct) | `skipped-gap` | `skipped-gap` | — |
| Attachment mismatch | `skipped-noop` | `skipped-noop` | `attachment-mismatch` |
| Exit review does not hold (attached items open) | `skipped-noop` | `skipped-noop` | `closure-withheld` |
| Attached page truncated (the marker reports omitted items) | `skipped-noop` | `skipped-noop` | `attached-set-truncated` |
| Milestone read unavailable or invalid | `skipped-noop` | `skipped-noop` | `milestone-signal-unavailable` |
| Adapter/surface gap | `skipped-gap` | `skipped-gap` | — |
| Close write did not land, or read-back did not observe closed | `would-apply` | `failed` | — (`closeout.write.failed`, exit 2) |

Read defects follow closeout's delivered posture: an unavailable signal is never an empty set and never a
failure. A write defect follows the delivered write posture: it stops the run with a classified identity
and converges on retry. One residue kind is added to the closed eight
(`milestone-sync-withheld`); it carries the closed reason as its bounded item text and the work-item ref
as its location.

### 6. Idempotency and dry-run

The operation identity is the delivered SHA-256 over the workspace, the change ref, the `git`-free
provider engine, the capability context, the operation name, the canonical arguments (the milestone
identity), and the provider target. Plan mode performs the read and renders the table above with zero
writes, zero appends, and zero fence acquisitions; apply mode folds the ledger and reuses any terminal
outcome, so two consecutive applies perform at most one close and report `satisfied` on the second.

### 7. Scope boundaries

- The change-level work item only. A multi-repository change's member milestones are out of scope: a
  member's planning unit has its own declaration source and its own record (revisit trigger).
- No entry review, no planned-scope verification, no extension, no reopening: those are owner scope acts
  and belong to a future `milestone` command family, if ever.
- The change spec's `change.milestone` field is not read here; pm-notes is. Reconciling the two is a
  separate declaration question (recorded as an unresolved question, not silently decided).

### 8. PDR-0005 interpretation (flagged for the decider)

PDR-0005 constraint C-2 states that attachment enforcement "may write only a flag label and at most one
marked comment to an issue — never a state change, assignee, milestone write, or any other label". That
constraint is scoped to the *attachment check* (its source is the check's "explicitly absent" list and
its driver is precision on a non-blocking signal). An exit-review-gated closure executed by an
operator-invoked transaction is a different act: the guide assigns closure to the milestone lifecycle,
and it is not performed by the check, never autonomously, and never without the exit-review predicate.
This record reads C-2 that way and states the reading openly; if the owner reads C-2 as a global
prohibition on milestone writes, §4 is withdrawn and the step degrades to Alternative 4 (verification plus
a withheld-closure residue item) without touching the rest of this record.

- **Rationale (tied to drivers):** verifying attachment before writing and closing only on a complete
  view is the safety-first ordering (D-1); a mechanical "synced" verdict satisfies the AC literally
  (D-2); the narrow operation vocabulary makes the unsafe acts unrepresentable rather than prohibited
  (D-4); the four-way outcome split keeps unsupported, unavailable, withheld, and failed distinct (D-5);
  the step's plan/outcome/detail/residue makes the common non-event legible (D-3) using delivered
  machinery (D-6).
- **Decider:** Juliusz Ćwiąkalski — human acceptance at the GH-349 PR review; this record stays
  `Proposed` until then. AI does not decide that any milestone closes; the exit review does, and the
  owner accepts the rule.
- **Conditions for revisit:** see `revisit_triggers` — notably the C-2 interpretation, per-member
  milestones, and recorded detachments.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 … C-8. No accepted-risk exceptions are
taken. Four consequences are recorded rather than excused: the closed operation set grows from nine to ten
and the conformance ripple is paid in this change (C-4); one residue kind is added to a closed set (C-5);
the step is gating, so a failed closure stops the run before the capsule step (a deliberate ordering
consequence of C-2 and C-3, not a violation); and the milestone inventory statement changes from twelve
to thirteen steps, which every consumer survives because steps are resolved by id.

## Trade-offs & Consequences

### Positive Outcomes

- "A synced milestone" becomes a mechanical outcome: attachment verified, exit review evaluated, closure
  performed when it holds.
- The unsafe milestone acts are unrepresentable, so no future caller can create or attach scope through
  closeout.
- The common case — a ticket that is not its milestone's last — produces one legible residue item
  instead of silence or a wrong closure.
- The `M4` milestone can close through the transaction on its last ticket, ending a manual step in the
  flip's own operating loop.
- Re-runs and dry runs behave exactly like every other closeout step.

### Negative Outcomes

- **GH-349's own closeout will withhold closure.** M4 has other attached tickets open, so the AC's "synced
  milestone" is satisfied for this change by verified attachment plus a recorded exit-review verdict, not
  by closing M4. The spec and the report must say this; reading the AC as "GH-349 closes M4" would be
  both wrong and unsafe.
- The operation set, parity matrix, flow registry, coverage gates, and expected projections all move; the
  conformance suite is a real cost for a bookkeeping effect.
- The step is gating: a provider outage on the milestone surface stops the run before the capsule
  ceremony, and the operator must retry.
- A milestone that legitimately needs a detached ticket can never close through the tool until the owner
  detaches; the tool reports the withholding but cannot resolve it.
- The read is a second provider surface for a fact the work-item read partly exposes, and a milestone
  whose attached set exceeds one provider page can never close through the tool: the page truncation
  withholds closure and the remainder is never guessed or paged after.

### Unresolved Questions

- [ ] Does the owner read PDR-0005 C-2 as scoped to the attachment check (this record's reading) or as a
  global prohibition? (owner: Juliusz Ćwiąkalski, at the GH-349 PR review)
- [ ] Should pm-notes `milestone` and the change spec's `change.milestone` be reconciled by a lint row?
  (owner: a follow-up declaration decision; explicitly not decided here)
- [ ] What is GitHub's exact milestone write surface and read-back shape, and what is its attached-issue
  page size — hence the effective single-read bound? The no-pagination policy is decided (one bounded
  page at the declared page size, truncation withholds closure); only the measured page size is open and
  is settled by fixture at delivery. A paginated or provider-side complete read is a separate decision,
  not a pending option here. (owner: `@coder`, GH-349 fixture)
- [ ] Is a Jira "version" closure ever semantically the same act? (owner: M3-S2; today it is a declared
  `provider-unsupported` gap)

## Implementation Plan

1. **Step and plan.** Add `milestone-sync` to `CLOSEOUT_STEP_IDS` at position 12 with `capsule` last;
   extend the plan and outcome vocabularies only where the delivered sets already admit the values.
2. **Read surface.** Add the bounded milestone read as an optional method on the closeout provider
   runtime (the delivered `listBlockedByDependents` pattern) returning a closed, provider-neutral shape
   for the record plus **one** attached-item page at the declared page size, with a truncation marker;
   no follow-up page request, no poll, no retry; no closed operation and no capability flag for the read.
3. **Exit review.** Evaluate the predicate purely in core over the declared title, the observed
   attachment, and that single page; a truncated page or an unavailable set withholds.
4. **Write surface.** Add `close-milestone` to `ADAPTER_OPERATIONS` with its canonical arguments, effect,
   read-back verification, and `alreadyApplied` semantics; declare GitHub support and the GitLab/Jira
   gaps; update the flow registry, parity matrix, coverage gates, mock tenant routes, and expected
   projections in the same change.
5. **Composition.** Resolve the declared milestone from pm-notes, the attachment from the work-item read,
   and the milestone facts from the adapter; plan mode reads only.
6. **Residue and error surface.** Add the one residue kind with its closed reason vocabulary; keep the
   `closeout.step.<id>.failed` family slot validating against the effective step set; reconcile the
   documented and machine tables.
7. **Regressions.** Named suites: attachment mismatch withholds; open attached item withholds; a page
   whose truncation marker reports omitted items withholds (with zero follow-up page requests); a page at
   the page-size boundary does not paginate; already-closed is satisfied with zero writes; two applies
   perform one write; plan performs zero writes; a write failure returns `closeout.write.failed`; the gap
   posture on a provider without the surface; the operation vocabulary cannot express create/attach/reopen.
8. **Reversal path.** Reverting the step and the operation is a code revert plus a capability declaration
   revert; no milestone state is migrated, and a milestone closed by the step stays closed (the owner
   reopens it deliberately, which is an owner act outside this tool).

## Verification Criteria

- Metric: attachment verification — a declared/observed mismatch yields `skipped-noop` and exactly one
  `milestone-sync-withheld` residue item, with zero writes — Target: exact — Window: GH-349 CI.
- Metric: exit-review fidelity — an open attached item, an unavailable signal, an unknown record state, or
  a page whose truncation marker reports omitted items never produces a close — Target: 0 closes across
  those fixtures — Window: GH-349 CI.
- Metric: idempotency and dry-run — plan performs zero writes/fences; two applies perform one close and
  report `satisfied` on the second — Target: exact — Window: GH-349 CI.
- Metric: capability parity — supported operations plus declared gaps cover the ten-member closed set for
  all three adapters, and the new operation executes against the mock tenant — Target: 100% — Window:
  GH-349 CI.
- Metric: unrepresentable acts — no argument shape or effect expresses create/attach/detach/rename/
  reopen — Target: code review plus a structure test — Window: GH-349 CI.
- Metric: bounded cost — at most one milestone read and one write per apply, and the read issues exactly
  one page request with zero follow-up page requests, zero polls, and zero retries — Target: exact —
  Window: GH-349 CI.
- Metric: gating posture — a failed close returns `closeout.write.failed` at exit 2 and appends no
  capsule close — Target: exact — Window: GH-349 CI.

## Confidence Rating

**High** for the mechanism, the position in the plan, and the outcome split: the absent surface, the
read/write asymmetry of the work-item contract, the disclosure precedent's purpose, and the step-family
validation are verified in the delivered source. **Medium-High** for the provider surface (the GitHub
milestone record and its single-page attached set at a provider page size measured at fixture time are
assumptions proven by fixture) and for the C-2 interpretation (a governance reading the owner must
confirm); both degrade truthfully — a declared gap and a verification-only step — rather than closing a
milestone on a guess.

## References

- GH-349 clarify-scope facts, the milestone position, and the operation-set doc-impact risk:
  `doc/changes/2026-11/2026-11-18--GH-349--merge-closeout-queue-repair/chg-GH-349-pm-notes.yaml`
- M4 blueprint §M4-S11 (`doc/planning/oss-tooling/milestones/m4/backlog.md`), F4 bar
  (`doc/planning/oss-tooling/milestones/m4/flip-plan.md:114-121`)
- Operating rule: `doc/guides/milestone-management.md` (naming, creation, attachment, exit review,
  closure, extension/reopening), [PDR-0005](PDR-0005-milestone-first-planning-and-delivery.md)
- Current truth: `doc/spec/features/feature-closeout.md`,
  `doc/spec/features/feature-adapter-ports.md`,
  `doc/spec/features/feature-adapter-conformance.md`,
  `doc/spec/features/feature-result-contract.md`
- Delivered source: `packages/core/src/contracts/closeout.ts`,
  `packages/core/src/contracts/adapter-capabilities.ts`,
  `packages/core/src/contracts/ports.ts`,
  `packages/core/src/domain/closeout.ts`,
  `packages/adapters/src/github/{client,normalize,capabilities}.ts`,
  `packages/adapters/src/jira/capabilities.ts`, `packages/adapters/src/gitlab/capabilities.ts`
- Prior decisions: [PDR-0005](PDR-0005-milestone-first-planning-and-delivery.md),
  [TDR-0033](TDR-0033-github-adapter-completion-contract-extensions.md),
  [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md),
  [TDR-0036](TDR-0036-cross-adapter-parity-matrix-declared-difference-register.md),
  [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md)

## Revision

### 2026-11-18 — attached-set read is one provider page (GH-349 specification v1.3, finding M6)

- **Status:** unchanged — `Proposed`, `decision_date: null`. The owner accepts or rejects this record at the GH-349 PR review; this revision grants no authority and records no acceptance.
- **Trigger:** GH-349 readiness gate iteration 1, finding **M6** (`doc/changes/2026-11/2026-11-18--GH-349--merge-closeout-queue-repair/readiness-review/readiness-iter-1.md`), carried into specification v1.3 (`chg-GH-349-spec.md`, DOCUMENT HISTORY row 1.3; F-4, API-4, AC-F4-4, NFR-4, OQ-3, RSK-11, Appendix G-8): GitHub returns a milestone's attached issues one page at a time at a declared page size, so the declared logical cap of 200 is a ceiling no single read can reach, and this record's "capped at 200" phrasing described a bound the provider does not offer.
- **What this record had wrong, and what it now states.** §3 said the attached work items were "capped (`CLOSEOUT_MAX_ATTACHED_ITEMS`, 200)", and the open question asked whether the set is "stably bounded at 200". Both treated the logical cap as the effective read bound and left pagination as an available option. The read is now stated as **one bounded provider page at the declared page size**, with no follow-up pagination, no poll, and no retry; `CLOSEOUT_MAX_ATTACHED_ITEMS` (200) remains the declared logical cap but is realized only up to that single page, and the **page's own truncation marker** is the decisive fact that the full set was not observed. A truncated page withholds closure and produces `milestone-sync-withheld` with the closed reason `attached-set-truncated`; the tool never paginates, never retries the read, and never guesses the remainder — so a milestone larger than one provider page cannot close through the transaction, and that consequence is declared rather than discovered. The open question is restated as the measured page size (hence the effective single-read bound), settled by fixture at delivery; the no-pagination policy is decided, not pending.
- **Sections amended:** C-7 (statement and verification: one page, zero follow-up page requests); §3 (one bounded page, logical cap versus effective bound, the truncation marker as the decisive fact, no pagination/retry/guessing); §5 (the truncation row names the page marker); Trade-offs → Negative Outcomes (a milestone above one page can never close through the tool); Unresolved Questions (the "stably bounded at 200" question replaced by the measured page-size question with the no-pagination policy settled); Implementation Plan items 2, 3 and 7; Verification Criteria (exit-review fidelity and bounded cost now assert the single page and zero follow-up requests); Confidence Rating (single-page attached set at a fixture-measured page size); the front-matter revisit trigger (now the "milestone routinely exceeds one page → decide a complete read" item rather than an unproven pagination hazard). The decision, all six alternatives and their rejections, the other constraints, the drivers, the DACI assignment, the remaining evidence rows, the §5 outcome vocabulary, and the status are unchanged.
- **Follow-ups not made here:** the specification already carries the contract at v1.3 (F-4, API-4, AC-F4-4, NFR-4, OQ-3, RSK-11, Appendix G-8); the test plan's milestone cases and the plan's phase obligations must assert the single-page bound and the zero-follow-up-request count in the same DoR round. No spec, test plan, plan, code, or other decision record was changed by this revision.
