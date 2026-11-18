---
id: TDR-0031
decision_type: tdr
status: Proposed
created: 2026-11-17
decision_date: null
last_updated: 2026-11-18
summary: "Resolve GH-293's contract semantics in eleven clauses: per-repository handover-gate evaluation is read-time and hosted on additive `repos list` row fields (`reversible` plus a `handoverGate` block), never a new command, a new verb, or a daemon tick; one `{condition, status: met|open}` shape in the declared four-condition order is shared by `dispatch handover`, `dispatch dual-run summary`, and the row, with window-level `unverifiable` expressed by `verdict` plus the `truncation` object rather than a third status; clean accrual is `cleanDispatches` (declared identical to `corroboration.satisfied`) and a trailing-run `consecutiveCleanDispatches`, and SC-M2-S16-02's 'coverage grows by one per dispatch' is restated because coverage is an eleven-token exposure set; per-repository reversibility is projected on the engine surfaces as `reversible` and SC-M2-S16-03's shell assertion is re-pointed there instead of growing the five-key shell summary; provider windows and holds stay documented on already-delivered effect surfaces with no new read, and the `QueueLane.providerProfile` doc/code gap becomes a declared known limitation rather than silent scope; this repository is not flipped to engine-authoritative; and the merge read-failure domain-kind mismatch is restoration of the declared error table, not a new decision. Beyond the original seven, four binding clauses come from later spec amendments, all carried in spec v1.3-v1.5: spec v1.1 named the seams the test plan could not assert — the merge composition's owner principal as the provider-resolved repository owner with no new configuration key (D8), the composition's exported `MERGE_COMPOSITION_EMITTABLE_CODES` enumeration (D9), and the fleet row's read-only non-persisting binding to its own repository identity (D10) — with its fourth seam, the single evidence-read-free handover exemption (the idempotent revert noop), folded into D2, and spec v1.2 added the fleet row's `production` evidence-scope declaration as D11 (DEC-17)."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os per-repository handover evaluation, fleet read, and shell fallback surfaces"
decision_scope: repo
review_date: null
business_impact: "Day-to-day delivery can run through the engine while the operator can see, per repository, which handover condition is still open and whether authority is reversible — without a new command, a resident daemon, or a widening of the shell contract."
customer_impact: "An operator reads one fleet command (`repos list --json`) to see every repository's gate verdict, open conditions, accrual count, and reversibility; an existing consumer of the summary, handover, or shell output keeps every delivered key, value shape, and exit it already depends on."
classification:
  domains: [contracts, operations, tooling]
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
  driver: "@decision-advisor (GH-293: PM routed seven contract-semantics questions to one record before the specification phase)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-293 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-293 clarify-scope: in-scope merge-primitive defect; M2-S16 story text and AC)"
    - "@decision-advisor (read-only gap analysis of the delivered gate, summary, handover, repos, shell, and daemon surfaces; this record)"
    - "@spec-writer (GH-293 specification: the payload shapes this record fixes)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-293 PR review — this record fixes additively-extended machine contracts and restates two story scenarios)"
  performers:
    - "@spec-writer (encode the clauses and shapes; restate SC-M2-S16-02 and SC-M2-S16-03)"
    - "@test-plan-writer (re-derive the condition, accrual, reversibility, and row-shape oracles)"
    - "@plan-writer (phase the contract, composition, and shell-adjacent work)"
    - "@coder (delivery per spec and plan)"
    - "@doc-syncer (feature-dispatch-engine, feature-projects, feature-peak-pausing reconciliation)"
  informed:
    - "Bash fallback maintainers (four entry points and the pinned delivery-summary tail)"
    - "GH-294 owners (peak pausing: window and hold surfaces this record maps rather than extends)"
    - "M1-S9 handover-gate owners (TDR-0015 semantics are applied, not amended)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A fleet read over long-running evidence makes `repos list` pay an unacceptable per-repository evaluation cost (many repositories, or a pathological attempt count): reopen the hosting clause — a bounded per-row budget or a separate read verb — rather than silently caching or sampling."
  - "A consumer is found reading `conditions[].status` as eligibility while ignoring `verdict`/`truncation`: the status field is not carrying its declared weight; reopen the shape rather than adding a fourth status."
  - "The shell stack gains a machine-readable mode: the 'no shell reversibility key' clause loses its rationale; reconsider projecting `reversible` there as part of that change."
  - "An operator needs to see a declared peak window *before* it opens (not only the park it causes): add the smallest declared-window read at that time; this record's mapping clause deliberately adds none."
  - "A torn attempts ledger ever blocks a recorded revert on a real repository: the reversal's `conditions` snapshot is then over-required, and the reversal-record shape must be decided — do not delete authority state to route around it."
  - "A second handover outcome is proposed as evidence-read-free, or the exemption is cited to omit `conditions` anywhere else: D2's bound is exactly one outcome; reopen the promise as a decision instead of widening it."
  - "The `projects list --flat` alias retires at M3: the byte-compatibility constraint on the row field set lapses; re-derive the row contract then, not before."
  - "Real accrual plateaus because the engine path is not actually used for regular delivery: that is an operating question, not a contract one; do not relax the gate to make the number move."
links:
  related_changes: ["GH-293"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-projects.md"
    - "doc/spec/features/feature-peak-pausing.md"
    - "doc/planning/oss-tooling/milestones/m2/backlog.md"
    - "doc/planning/oss-tooling/milestones/m2/test-scenarios.md"
  contracts:
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/projects.ts"
    - "packages/core/src/contracts/queue.ts"
    - "packages/core/src/domain/dispatch-gate.ts"
  diagrams: []
  decisions: ["TDR-0015", "TDR-0020", "TDR-0024", "TDR-0026", "TDR-0029", "TDR-0030"]
  experiments: []
  metrics: []
  roadmap_items: ["M2-S16"]
---

# TDR-0031: Engine-First Delivery Operations — Evaluation Surfaces, Accrual, and Reversibility

## Context

M2-S16 ("Engine-first delivery operations") asks for four things: day-to-day delivery of this
repository runs primarily through the typed engine with the shell stack as documented fallback;
provider windows and holds are engine-visible data; the handover gate is evaluated periodically
on accrued evidence per repository while the shell path stays green; and shell entry points carry
deprecation pointers once a repository flips. Its ACs are: consecutive engine dispatches with
corroborated outcomes accrue in the summary; handover evaluation reports per-condition status;
the shell path remains usable and documented; any flip is per-repository and reversible
(`doc/planning/oss-tooling/milestones/m2/backlog.md` §M2-S16, lines 355-370).

- **FACT:** The handover predicate, its four conditions, evidence classes, window, floor, and
  reversal semantics are declared by [TDR-0015](TDR-0015-dispatch-handover-gate-operational-semantics.md)
  and applied by `evaluateHandoverGate` over `DISPATCH_HANDOVER_CONDITIONS`
  (`truth, coverage, floor, corroboration`) in `packages/core/src/domain/dispatch-gate.ts`.
- **FACT:** `dispatch dual-run summary` reports window facts, counted/excluded classes, incidents,
  the shared divergence block, coverage present/missing, corroboration counts, eligibility,
  `verdict`, `unmetConditions`, `floor`, and optional `truncation`. It carries no
  `cleanDispatches` and no per-condition `conditions[]`, and its key order is pinned by
  `tests/behaviour/dispatch-additive-stability.test.ts:52-85`.
- **FACT:** `coverage` is the eleven-token exposure **set** over `DELIVERY_RESULT_TOKENS`, so it
  cannot grow by one per dispatch; SC-M2-S16-02's "the repository's evidence coverage grows by one
  per dispatch" is not representable in the delivered payload
  (`packages/core/src/contracts/delivery-result.ts`, `packages/core/src/domain/dispatch-gate.ts`
  `foldEvidenceWindow`).
- **FACT:** `dispatch handover` data is `{repository, operation, recorded, noop, verdict, ...}`
  with `unmetConditions` only on refusal; its key order is pinned by
  `tests/behaviour/dispatch-additive-stability.test.ts:136-157`. It carries no `conditions[]` and
  no `reversible`. The authority document carries `reversalAvailable`
  (`packages/core/src/contracts/dispatch.ts` `DispatchAuthorityView`), and nothing projects it.
  The delivered revert answers the already-`dual-run` noop from the folded handover **before**
  `readDispatchGate` (`packages/core/src/app/dispatch-gate.ts` `revertDispatchHandoverEvidence`), so
  declaring that outcome evidence-read-free declares the delivered order rather than new behaviour.
- **FACT:** A truncated evidence read returns data at exit 1 with `verdict: "unverifiable"` and a
  `truncation` object; an unreadable attempts/divergences ledger fails the read with
  `dispatch.state-unverified` and returns no data (`packages/core/src/app/dispatch-gate.ts`
  `readDispatchGate`). Therefore `met | open` alone cannot express the window-level state.
- **FACT:** The counting rule has one scope parameter (`COUNTED_EVIDENCE_CLASS` in
  `packages/core/src/domain/dispatch-gate.ts`: `production → pilot`, `controlled →
  controlled-proof`), and the production composition evaluates the gate surfaces at
  `scope: "production"` (`packages/cli/src/production.ts`). A fleet row and
  `dispatch dual-run summary --repo` can only be required to agree when both fold the same scope,
  and the row declaration is currently implicit.
- **FACT:** No periodic or lazy per-repository gate evaluation exists. `repos list` folds only the
  latest handover record into `handoverState` and opens each project store read-only; its row
  contract is exactly five fields (`repoKey, root, stateLocation, daemonReachable, handoverState`)
  pinned by `tests/behaviour/repos-list-contract.test.ts:88-110` and
  `REPOS_ENTRY_FIELDS` in `packages/core/src/contracts/projects.ts`, and the
  `projects list --flat` alias is required to stay byte-identical. The production daemon
  composition is `supervise-only` and single-project scoped
  (`doc/spec/features/feature-dispatch-engine.md` §Harness and daemon composition).
- **FACT:** Owner hold is engine-visible (admission refusal, queue blocking, `status.ownerHold`,
  board `ownerHold`), and peak-window **effects** are engine-visible (`status.laneParks`, brief
  park fields, `lanes` `peakEnforcement`, window-scoped spend evidence, park events), while
  declared/current peak windows have no read surface and `QueueLane` carries no
  `providerProfile` (`doc/spec/features/feature-peak-pausing.md:34,94,96`;
  `packages/core/src/contracts/queue.ts` `QueueLane`).
- **FACT:** The shell path prints a bounded stderr deprecation pointer when the repository is
  authoritative and exits 0; its delivery summary is a five-key text tail (`result=`, `pr_url=`,
  `exit_code=`, `closeout_unverified=`, `last_message=`) whose order is pinned by
  `scripts/.tests/test-deliver-ticket.sh` (summary key-order case), so `data.reversible == true`
  in SC-M2-S16-03 has no producer.
- **FACT:** The production merge composition stubs `readWorkItem`, `readCheckRuns`, and
  `readRequestDetail` to a credential refusal carrying `config.credential.missing`, while
  `readFailure` in `packages/core/src/domain/merge-transaction.ts` hard-codes
  `domainKind: "provider"`; the CLI then classifies `(provider, config.credential.missing)`, the
  error-table lookup refuses the pair, and the failure is contained as `fallback.internal`
  (`packages/cli/src/classify.ts` `classifyThrown`). That contained class is
  `platform-provider` and projects exit `2`, whereas the code's declared row projects
  `user-validation` at exit `1` (`packages/cli/src/projection.ts` `projectExitCode`). The declared
  row for that code has `domainKind: "config"`
  (`packages/core/src/contracts/error-table.ts`). The owner scoped this defect to GH-293 in the
  ticket comment of 2026-11-15 (`chg-GH-293-pm-notes.yaml`).
- **Trigger:** GH-293's specification phase is blocked on seven contract questions (D1–D7 of the
  decision request): where per-repository evaluation lives, the per-condition contract, the
  accrual metric, the shell reversibility claim, window/hold visibility, flip scope, and whether
  the merge defect needs its own record. Each answer changes machine payloads or story scenarios
  that the spec and test plan must encode, so they are decided once, here, before the spec. Spec
  v1.1 then raised the seams the test plan could not assert as written (its OQ-5..OQ-8): three
  became D8–D10, and the fourth (OQ-5) amended D2's outcome promise; spec v1.2 added the fleet
  row's `production` evidence-scope declaration as D11 (DEC-17). Each is precedent-setting beyond
  this change and they are adopted here rather than left to delivery.

## Problem Framing (Clarified)

The story reads as one capability ("run delivery through the engine and accumulate evidence") but
it decomposes into one missing **read**, one missing **vocabulary**, one **metric restatement**,
one **surface mismatch**, one **visibility claim**, one **scope boundary**, and one **defect
classification**. Treating them as one blob produces the two failure modes this repository keeps
paying for: a new command that duplicates an existing read, or a scenario assertion quietly
restated to match whatever shipped.

The root cause of the first three is the same: **the gate's evidence is already computed, and its
per-condition result is discarded.** `evaluateHandoverGate` produces exactly the four condition
facts the story wants; `toSummaryData` keeps only the unmet list, and `repos list` never calls it.
So "handover evaluation reports per-condition status" is not a missing computation — it is a
missing projection and a missing host.

Three properties constrain any acceptable answer:

1. **Evaluation must be readable without becoming an act.** `dispatch handover` changes authority
   when the bar is met. A status read must not require a state-changing command, so the reporting
   surface cannot be the handover verb alone.
2. **One fact, one derivation.** The four condition statuses, the unmet list, and the accrual
   count already have a single home (`foldEvidenceWindow` + `evaluateHandoverGate`). Any second
   derivation lets a summary and a fleet row disagree about the same ledger.
3. **The shell contract is load-bearing by being boring.** Its five-key tail is parsed by
   fork-join callers and pinned by a test; its value is that it did not change while the engine
   grew. Adding a key to satisfy a JSON-shaped scenario assertion trades a real guarantee for a
   literal.

The failure mode to prevent is a gate that becomes easier to *read* by becoming easier to *pass*
— for example, a per-condition `unverifiable` status that a consumer can average into "fine", or a
`clean` counter that counts dispatches rather than corroborated ones.

## Constraints (Hard Requirements)

### C-1: Per-condition status is readable without a side effect and without a resident daemon

- **Statement:** At least one machine surface reports, for one repository, all four conditions with
  their individual status, in a single read, without appending any handover/reversal record and
  without requiring a running daemon.
- **Source:** AC (`M2-S16` AC2; SC-M2-S16-01); prior decision (TDR-0015 §7 fail-safe posture)
- **Verification:** test (read the surface on an ineligible, an eligible, and a truncated window;
  assert no ledger record appended and correct statuses)
- **Negotiable:** no

### C-2: Additive stability of delivered payloads

- **Statement:** No delivered key is removed, renamed, re-ordered, or re-typed; additive keys are
  appended in a declared order; `projects list --flat` remains byte-identical to the delivered
  `projects.v1` payload; the `dispatch` run envelope, resolve payload, and shell summary keep their
  pinned shapes.
- **Source:** internal standard (additive-stability suites); prior decision (TDR-0015 C-2 spirit);
  AC (`M2-S16` AC3)
- **Verification:** test (pinned key-order suites updated only by appending; flat-alias
  byte-equality case)
- **Negotiable:** no

### C-3: One derivation per fact

- **Statement:** `conditions[]`, `unmetConditions`, and the accrual counters all derive from the
  folded window and its single evaluation; no surface recomputes a condition from raw records, and
  no two surfaces can disagree about one ledger.
- **Source:** prior decision (TDR-0015 driver 6, "single declared home for each rule")
- **Verification:** test (invariant: open conditions = unmet conditions, in order; identity:
  `cleanDispatches = corroboration.satisfied`) + code review
- **Negotiable:** no

### C-4: Truth over convenience on degraded evidence

- **Statement:** A truncated evidence read is never reported as eligible and never produces a
  fabricated zero; window-level unverifiability is distinguishable from a per-condition fact
  without adding a condition status that means "unknown"; detail is not silently padded or invented.
- **Source:** prior decision (TDR-0015 §1 window-level unreadability); spec (evidence window,
  corroboration)
- **Verification:** test (truncated window: verdict unverifiable, conditions computed over the
  visible set, truncation carried; unreadable ledger: classified failure, no data)
- **Negotiable:** no

### C-5: The fleet read stays read-only and deterministic

- **Statement:** `repos list` performs no write (no maintenance, no prune, no project-root
  creation, no store-content write beyond the delivered temp-sibling removal) and two runs over
  unchanged state produce byte-identical payloads.
- **Source:** internal standard (`repos list` read-only contract, AC-F3-*); delivered test
  (determinism over unchanged state)
- **Verification:** test (byte-equality of two consecutive reads; no-mutation assertion)
- **Negotiable:** no

### C-6: No new command, verb, error identity, or exit code

- **Statement:** The work adds no command family, no verb, no error-table row, no `DOMAIN_KINDS`
  member, and no exit outside the declared `{0, 1, 2}` sets of the touched families.
- **Source:** internal standard (prompt-required help inventory and error-table row count are
  conformance-checked); AC (`M2-S16` AC3 lean-process posture)
- **Verification:** test (help inventory unchanged in command set; error-table row count unchanged)
- **Negotiable:** no

### C-7: The shell contract does not grow

- **Statement:** The shell entry points keep their five summary keys in the pinned order, their
  exit behaviour, and the pointer-only authoritative behaviour; nothing new is printed to stdout.
- **Source:** AC (`M2-S16` AC3); delivered test (summary key order pinned in
  `scripts/.tests/test-deliver-ticket.sh`)
- **Verification:** test (existing pinned key-order case unmodified and green) + audit
- **Negotiable:** no

### C-8: No real repository is flipped

- **Statement:** GH-293 delivers capability, evaluation, and documentation; it flips no
  repository, fabricates no pilot evidence, and does not insert records into any ledger.
- **Source:** prior decision (GH-239 NG-1; TDR-0015 C-4 provenance rules); AC (`M2-S16` AC1
  evidence is accrued, never manufactured)
- **Verification:** audit (no `dispatch.handover` authoritative record for this repository in the
  change) + test (provenance guard unchanged)
- **Negotiable:** no

> **Table stakes:** the closed eleven-token vocabulary and its projections (TDR-0005, TDR-0010);
> evidence-class counting, the incident-exclusive window, the floor, and the corroboration matrix
> (TDR-0015); zero model calls in evaluation; secret containment; the delivered `repos` error
> identities. Every eligible alternative below is assumed to satisfy them and they are not scored
> again.

## Decision Drivers

1. **AC completeness with the least new surface** — report per-condition status where a read
   already exists; a new verb costs a help page, a conformance entry, and a second place for the
   predicate to drift.
2. **One evaluation, many readers** — the fleet row, the summary, and the handover decision must
   read the same computed facts.
3. **Bounded, daemon-free cost** — the evaluation must be affordable on every fleet read in the
   shipped composition, which mounts no daemon.
4. **Shell stability** — the fallback's value is that it stayed simple and parseable while the
   engine grew; green means unchanged.
5. **Determinism and read-only conduct** — a fleet read must be repeatable and side-effect free,
   so an operator can trust a diff between two reads.
6. **Reversibility visible where authority lives** — a per-repository flip is only credible if a
   reader can see, per repository, that it can be undone.
7. **Honest accrual** — the number that grows must be the corroborated-success number, not a
   dispatch count or a coverage proxy.
8. **Least new vocabulary** — reuse the declared condition order and the declared verdict
   vocabulary rather than minting a third status or a second set of condition names.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor`, routed by `@pm` from GH-293 clarify-scope before the
  specification phase.
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-293 PR review. The AI
  does not accept this record; it stays `Proposed` until the owner accepts.
- **Contributors:** `@pm` (story scope and the owner-scoped merge defect), `@decision-advisor`
  (read-only gap analysis), `@spec-writer` (the payload shapes this record fixes).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the human owner at the GH-293 PR
  review.
- **Performers:** `@spec-writer`, `@test-plan-writer`, `@plan-writer`, `@coder`, `@doc-syncer`.
- **Informed:** bash fallback maintainers, GH-294 owners (peak-pausing surfaces), M1-S9 gate
  owners.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| `evaluateHandoverGate` already computes the exact four per-condition facts the story wants; only the projection is missing. | FACT | `packages/core/src/domain/dispatch-gate.ts` `evaluateHandoverGate`, `DISPATCH_HANDOVER_CONDITIONS` | The contract clause would under-specify a new computation | High |
| `coverage` is an eleven-token set, so SC-M2-S16-02's per-dispatch growth clause is unrepresentable. | FACT | `packages/core/src/domain/dispatch-gate.ts` `foldEvidenceWindow`; `packages/core/src/contracts/delivery-result.ts` | The scenario would be delivered as a contradiction | High |
| `repos list` already opens each project store read-only and folds the handover ledger, so evaluation adds a bounded read, not a new data path. | FACT | `packages/cli/src/production.ts` `readProjectHandover`; `doc/spec/features/feature-projects.md` §`repos list` contract | The chosen host would need a store-opening change with new side effects | High |
| `projects list --flat` must stay byte-identical to `projects.v1`, so new row fields cannot be added to the `projects` payload. | FACT | `doc/spec/features/feature-projects.md` §The `projects list --flat` alias; `tests/behaviour/repos-list-contract.test.ts` | New fields would leak into the retiring alias and break byte-compatibility | High |
| The production daemon composition mounts the daemon family without a lane composition (supervise-only) and is single-project scoped. | FACT | `doc/spec/features/feature-dispatch-engine.md` §Harness and daemon composition | A daemon-hosted evaluation would be invisible in the shipped build | High |
| A truncated read returns data with `verdict: "unverifiable"`; an unreadable read returns a classified failure with no data. | FACT | `packages/core/src/app/dispatch-gate.ts` `readDispatchGate`; `packages/core/src/domain/dispatch-gate.ts` | The `met \| open` representation clause would be wrong | High |
| The shell summary is a five-key stdout tail with no machine mode and a pinned key order. | FACT | `scripts/.tests/test-deliver-ticket.sh`; `scripts/lib/dispatch-authority.sh` | Adding a reversibility key could be justified despite the churn | High |
| `reversalAvailable` is already derived from the folded ledger (`authorityOf(operation) === "authoritative"`). | FACT | `packages/core/src/domain/dispatch-authority.ts` | Reversibility would need a second rule | High |
| Peak-window effects and owner holds already reach engine surfaces; only declared windows have no read. | FACT | `doc/spec/features/feature-peak-pausing.md:34,94,96`; `doc/spec/features/feature-board.md:83`; `packages/core/src/contracts/queue.ts` | The visibility clause would have to add a read | High |
| The merge read-failure mismatch resolves to a declared `config` row; the containment to `fallback.internal` is a consequence of the hard-coded kind. The declared row projects `user-validation` at exit `1`, the contained class projects `platform-provider` at exit `2`. | FACT | `packages/core/src/domain/merge-transaction.ts` `readFailure`; `packages/core/src/contracts/error-table.ts`; `packages/cli/src/classify.ts` `classifyThrown`; `packages/cli/src/projection.ts` `projectExitCode` | The "no new identity" answer would be wrong, or a test would assert the defect's exit | High |
| A real evaluation on this repository will still read `ineligible` (coverage and the 20-dispatch floor are unmet), so AC1's accrual is proven by controlled composition plus post-delivery observation, not by the PR. | ASSUMPTION | Backlog §M2-S16 dependency set; TDR-0015 §4 | The story's AC1 could be read as needing an eligible repository in the PR | Medium |
| The bounded attempts read (`DISPATCH_MAX_ATTEMPT_RECORDS = 5000`) is an acceptable per-repository cost on every fleet read for the expected repository count. | ASSUMPTION | `packages/core/src/contracts/dispatch.ts`; observed host with a handful of registered projects | A large fleet would make the row host the wrong place (revisit trigger 1) | Medium |
| `QueueLane.providerProfile` can be added truthfully only by reading daemon lane records, not the park fold alone (a parked-only field would misstate presence for running lanes). | TO-CONFIRM | `packages/core/src/domain/queue-lanes.ts` folds queue entries/leases/parks; `packages/core/src/contracts/daemon.ts` lane records carry the nomination | The declared limitation would be cheaper to fix in this change than assumed | Medium |
| The waiver authority already declares the owner principal as "the provider-resolved repository identity", and no typed `merge` configuration key names an owner principal. | FACT | `packages/core/src/domain/merge-waiver.ts`; `packages/core/src/contracts/merge.ts` `MergeTransactionConfig.ownerPrincipal` | A configuration key would become a second authority for a fact the provider already resolves | High |
| No enumeration of the merge composition's emittable failure codes exists today; its refusal branches are finite and each is expressible through a code the error table already declares. | TO-CONFIRM | `packages/cli/src/production.ts` merge composition; `packages/core/src/contracts/error-table.ts` | The totality test would pass vacuously, or a branch would need an identity this change may not invent | Medium |
| The lanes-read profile gap is resolved as an out-of-scope boundary plus a declared known limitation, with the over-claiming peak-pausing sentence corrected and no tracker defect opened by this change. | FACT | spec OQ-2 / DEC-5; `doc/spec/features/feature-peak-pausing.md:34,94,96` | The correction could be read as delivered capability instead of a limitation | High |

## Mental Models & Techniques Used

- **First principles:** separate "which fact exists" from "which surface reports it". The condition
  facts exist; only the projection is absent — so the cheapest correct change is a projection, not
  a new subsystem.
- **Inversion:** how would the fleet row become untrustworthy? By evaluating a second time from raw
  records, by caching, by sampling, by reporting a verdict without its truncation marker, or by
  letting one torn repository blind the fleet silently. Each inversion names a constraint or a
  stated failure behaviour.
- **Second-order thinking:** a new `dispatch gate` verb would be written once and read forever in
  help, conformance checks, and every consumer that must choose between two gate reads. A row field
  is read by the fleet read that already opens the store.
- **Systems thinking:** the gate, the fleet read, the summary, the handover decision, the authority
  document, and four bash entry points form one loop. Reversibility is a property of the loop, so it
  belongs on the loop's authority surfaces, not on a per-delivery text tail.
- **Opportunity cost:** every key added to the shell tail is a key every fork-join caller must
  tolerate and every future shell change must preserve; the engine JSON surfaces already carry
  structure.
- **KISS / least vocabulary:** one condition order, one verdict vocabulary, one status pair, one
  accrual identity — no new vocabulary item is minted where an existing one can be projected.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 | C-7 | C-8 |
|---|---|---|---|---|---|---|---|---|
| ALT-0 (do nothing / operating routine only) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 (new `dispatch gate <repo>` verb) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-2 (daemon supervision tick publishes evaluation) | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-3 (evaluation on `projects` rows as well, both surfaces) | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 (three-valued condition status `met\|open\|unverifiable`) | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 (shell gains `reversible=true` summary key) | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-6 (selected: read-time evaluation on the `repos` row, shared condition shape, engine-side `reversible`, documented window/hold mapping) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails. No accepted-risk exceptions are claimed; every ❌ is a
`Negotiable: no` violation.

### Alternative 0 — Do Nothing / Documented Operator Routine Only

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Document the ritual ("run the summary per repository before deciding to hand over")
  and add no surface.
- **Constraint compliance:** Fails C-1 — AC2 asks the evaluation to *report* per-condition status;
  a documented ritual leaves that report undefined, and no scenario can assert it.
- **Driver fit:** Fails driver 1 and 2 by construction.
- **Pros:** Zero contract change.
- **Cons:** The story's second AC has no oracle; the operator reads four separate summary fields and
  reconstructs the conjunction by hand — the exact re-derivation TDR-0015 forbids.
- **Why rejected:** An unevidenced AC is the failure this process exists to prevent.

### Alternative 1 — New `dispatch gate <repo>` Read Verb

- **Eligibility:** Not eligible (fails C-6).
- **Summary:** Add a read-only dispatch verb that evaluates one repository and prints the
  conditions, leaving `repos list` untouched.
- **Constraint compliance:** Fails C-6 — a new command family member costs a help page, a
  prompt-required inventory row, and a conformance-check surface that must stay accurate forever.
  Otherwise it is a clean design (no side effect, no daemon).
- **Driver fit:** Good on driver 1's readability, poor on driver 1's "least new surface" and on
  driver 3 (a per-repository verb is invoked once per repository by the operator, not once per
  fleet read).
- **Pros:** Clean separation; the fleet read keeps its five fields forever.
- **Cons:** Two gate reads to keep consistent (`summary` and `gate`); one more command to document
  and to keep out of the "no new command" conformance posture; the fleet view still has no verdict.
- **Why rejected:** The fleet read already opens every repository store; hosting the projection
  there is strictly cheaper. Kept as the declared fallback if the row cost ever becomes
  unacceptable (revisit trigger 1).

### Alternative 2 — Daemon Supervision Tick Publishes the Evaluation

- **Eligibility:** Not eligible (fails C-1, C-6).
- **Summary:** Have the resident daemon evaluate each repository on a supervision tick and publish
  the result on a read surface.
- **Constraint compliance:** Fails C-1 — the production composition is `supervise-only` and
  single-project scoped, so the evaluation would be invisible exactly where a fleet read is needed
  and absent without a daemon. Fails C-6 — publishing a new per-repository evaluation needs either
  a new read or a new payload section.
- **Driver fit:** Worst on drivers 3 and 5: cost and freshness would depend on a process the
  shipped build does not run.
- **Pros:** Would enable push-style notifications if a daemon ever existed.
- **Cons:** Evaluation would silently stop existing in the delivered build; "periodic" would become
  "whenever something that is not mounted runs".
- **Why rejected:** Ties a read-side truth to an uncomposed runtime.

### Alternative 3 — Evaluate on `projects` Rows as Well (Both Surfaces)

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Add the same additive fields to `ProjectsListEntry` so the flat alias also reports
  the gate.
- **Constraint compliance:** Fails C-2 — `projects list --flat` is required to remain
  byte-identical to the delivered `projects.v1` payload, so new row fields on the `projects` shape
  would either break byte-compatibility or be computed and dropped inconsistently.
- **Driver fit:** Satisfies a desire nobody has expressed: the alias retires at M3.
- **Pros:** One row shape for two tokens.
- **Cons:** Breaks a promised byte-compatibility for a surface that is already scheduled to
  disappear.
- **Why rejected:** The compatibility promise outlives the convenience.

### Alternative 4 — Three-Valued Condition Status (`met | open | unverifiable`)

- **Eligibility:** Not eligible (fails C-2, C-4).
- **Summary:** Let a condition's `status` also carry `unverifiable` for the truncated case.
- **Constraint compliance:** Fails C-2 — SC-M2-S16-01 asserts a status of `met` or `open`; a third
  value changes the asserted vocabulary. Fails C-4 — it conflates a window-level property (the
  read was truncated) with a per-condition fact, allowing a consumer to read "unknown" as a normal
  condition value and to average four statuses into a verdict that disagrees with `verdict`.
- **Driver fit:** Superficially simple, but it makes the gate's own verdict a second-class signal.
- **Pros:** One field to read.
- **Cons:** Two places now express unverifiability (`verdict` and four statuses); a consumer can
  easily read the wrong one.
- **Why rejected:** Unverifiability is a property of the evidence read, not of a condition.

### Alternative 5 — Shell Summary Gains `reversible=true`

- **Eligibility:** Not eligible (fails C-7).
- **Summary:** Append a sixth pinned key to the shell delivery summary so SC-M2-S16-03's literal
  `data.reversible == true` holds on the shell path.
- **Constraint compliance:** Fails C-7 — the five-key tail and its order are pinned by a delivered
  test and parsed by fork-join callers; a new key is a contract change to the fallback in the exact
  change whose AC says the fallback stays usable and unchanged.
- **Driver fit:** Satisfies a literal at the cost of the guarantee the literal was protecting.
- **Pros:** The scenario reads literally as written.
- **Cons:** Mixes per-repository authority metadata into a per-delivery result record; consumes the
  tail budget; changes shell output in `dual-run` and `authoritative` alike.
- **Why rejected:** The claim is about repository authority; it belongs on the authority surfaces
  that already derive it.

### Alternative 6 — Selected: Read-Time Evaluation on the Fleet Row, Shared Condition Shape, Engine-Side Reversibility, Documented Window/Hold Mapping

- **Eligibility:** Eligible (passes C-1 through C-8).
- **Summary:** `repos list` gains two additive row fields (`reversible`, `handoverGate`); one
  `{condition, status}` shape is produced once and read by the row, the summary, and the handover
  decision; the summary gains `cleanDispatches`, `consecutiveCleanDispatches`, and `conditions`;
  `dispatch handover` gains `conditions` and `reversible` (plus `verdict` on the recorded revert); SC-M2-S16-02 and SC-M2-S16-03 are
  restated to the truthful surfaces; provider windows and holds are documented on delivered effect
  surfaces with no new read; no repository is flipped; the merge defect is contract restoration.
- **Constraint compliance:** C-1 by the row and the summary (both side-effect free, daemon-free);
  C-2 by appending only, leaving `projects` rows and the flat alias untouched; C-3 by one producer;
  C-4 by verdict-level `unverifiable` plus `truncation`; C-5 by a pure read with no wall-clock in
  the row; C-6 by no new command, identity, or exit; C-7 by leaving the shell untouched; C-8 by
  scope.
- **Driver fit:** Best on all eight drivers.
- **Pros/Cons:** See Trade-offs.
- **Why chosen:** See Decision.

## Decision

- **Decision:** Adopt **ALT-6**, as eleven binding clauses — D1–D7 as originally decided (D2 carries
  the spec's v1.1 five-outcome/exemption amendment and D7 the spec's v1.2 exit-projection
  amendment), D8–D10 the seam declarations spec v1.1 had to name, and D11 the `production`
  evidence-scope declaration spec v1.2 added (DEC-17) — each precedent-setting beyond GH-293 and
  adopted here:

  1. **D1 — Evaluation host.** Per-repository handover-gate evaluation is **read-time**, hosted on
     the `repos list` row. The `repos` row (and only the `repos` row) gains exactly two additive
     fields, appended after `handoverState` in this order: `reversible`, then `handoverGate`. No new
     command, verb, flag, or daemon tick exists; `projects list --flat` stays byte-identical and
     carries neither field. The evaluation runs in the same pass that already opens each project
     store, for every row whose state location is `ready`; a `first-use` row reports the fold of an
     empty window without opening a store. Cost posture: one bounded attempts read
     (`DISPATCH_MAX_ATTEMPT_RECORDS = 5000`) plus one divergences read per ready row, and a pure
     fold over the visible records; no write, no network, no model call, no cache, no scheduler.
     Freshness is read time, so "periodic evaluation" means "every fleet read re-evaluates".
     Failure behaviour: an unreadable, torn, or malformed attempts/divergences ledger fails the
     whole read through the delivered `repos.state-unavailable` identity at exit `2` with no
     fabricated row — the same rule the row already applies to an unreadable handover ledger. A
     truncated attempt read is not a failure: the row reports the evaluation over the visible window
     with `verdict: "unverifiable"` and the `truncation` object. No evidence means the empty-window
     evaluation (`ineligible`; `truth` met, `corroboration` met vacuously, `coverage` and `floor`
     open; `countedDeliveries: 0`), never an absent block and never an "unknown" row. Each ready
     row's evaluation is bound to that row's own repository identity (D10) and folds the production
     evidence scope (D11), so the row and the summary read one ledger under one counting rule.
     A `first-use` row needs neither a store nor an identity, and reports `reversible: false`.
  2. **D2 — Per-condition status contract.** One shape, `DispatchConditionStatus =
     { condition: DispatchHandoverCondition; status: "met" | "open" }`, is produced once from the
     folded window and read on three surfaces: `dispatch handover` data, `dispatch dual-run summary`
     data, and the `repos` row's `handoverGate.conditions`. `conditions` is present with exactly four
     entries, in the declared `DISPATCH_HANDOVER_CONDITIONS` order
     (`truth, coverage, floor, corroboration`) — that declaration is the single order authority; the
     story's prose order is not a second one — on **every handover outcome that performs the gate
     evidence read**: the recorded flip, the idempotent flip noop, the clean refusal, and the
     recorded revert. The recorded revert also carries `verdict`, so populating an already-declared
     optional key (no new key, no reordering) makes `verdict == "unverifiable" ⟺ truncation present`
     expressible on that outcome. **Exactly one outcome is exempt:** the idempotent revert noop —
     `--revert` on a repository whose folded authority is already `dual-run`, or which has no
     handover record — is answered from the folded handover **before any gate evidence read** and
     returns `{repository, operation: "dual-run", recorded: false, noop: true, reversible: false}`
     carrying **no** `conditions`, **no** `verdict`, and **no** `truncation`, at exit `0`, and no
     attempts or divergences evidence read can refuse it. The exemption is safe in exactly the sense
     it claims and no wider: the handover-ledger fold that establishes the noop still refuses
     `dispatch.state-unverified` when that ledger itself is unreadable, so the noop is not a route
     past a corrupt handover history; what it skips is only the attempts/divergences evidence read,
     which it does not need, because it changes no authority and asserts nothing about eligibility.
     A *recorded* revert keeps its read and still refuses at exit `2` when the evidence ledger is
     unreadable (D4's residual). The bound is one outcome: a second evidence-read-free outcome is a
     new decision, never a quiet edit to this clause. The narrowing is part of what the human decider
     accepts at the GH-293 PR review; the AI does not accept it.
     The outcome table below states all five.
     The condition array carries **no** `detail`: the detail text stays
     where it already lives (`unmetConditions` on handover, the typed summary fields), so no new
     bounded-string vocabulary and no duplicated detail is introduced. `unverifiable` is a
     **window-level verdict**, never a condition status: `verdict: "unverifiable"` with the
     `truncation` object present, and the data-level invariant on every surface that returns data,
     `verdict == "unverifiable" ⟺ truncation present` (an unreadable ledger remains a classified
     failure with no data; an outcome carrying no `verdict` carries no `truncation`). Under truncation
     the statuses are explicitly "over the visible window" and `eligibility`/`verdict` remains the
     only eligibility signal. Invariant, test-pinned:
     `unmetConditions.map(c => c.condition)` equals `conditions.filter(s => s.status === "open").map(c => c.condition)`.
     The handover/reversal **records** keep their existing conditions snapshot unchanged.
  3. **D3 — Clean-dispatch accrual.** The summary gains two additive counters, computed on the
     window's counted attempts: `cleanDispatches` = the number of counted attempts whose token is a
     success claim and whose corroboration is satisfied — declared **identical** to
     `corroboration.satisfied`, with one derivation and an identity test, not a second counting
     rule; and `consecutiveCleanDispatches` = the length of the **trailing** run of clean counted
     attempts ending at the window's last counted attempt in ledger append order (the order
     `countedInWindow` carries), `0` when that attempt is not clean or the window is empty.
     Trailing-run semantics are chosen because the story's "consecutive … accrue"
     describes a streak that a non-clean dispatch breaks; a longest-run metric would not break.
     `cleanDispatches` also appears on the `repos` row; `consecutiveCleanDispatches` does not.
     **SC-M2-S16-02 is restated** at the spec: coverage is an eleven-token exposure **set**, so the
     truthful assertion is that `countedDeliveries` grows by one per counted dispatch,
     `coverage.present` gains a token only when a dispatch first produces that token (at most one
     per dispatch, at most eleven overall), and `cleanDispatches` grows by one per corroborated
     dispatch. No numeric coverage counter is added: it would be `coverage.present.length`, a
     derived duplicate, and would invite reading exposure as progress toward truth.
  4. **D4 — Reversibility claim.** `reversible: boolean` is projected on the engine surfaces:
     `dispatch handover` data and the `repos` row. Its one derivation is the folded authority after
     the operation — `true` iff the repository's latest folded handover operation is
     `authoritative` (so: a recorded flip `true`, an idempotent flip noop `true`, a clean refusal
     `false`, a revert `false`). This is the same rule the authority document already applies to
     `reversalAvailable`; no second reversible rule is invented. The **shell path is unchanged**: no
     new key, no new line, no new exit; on a flipped repository it exits `0` and prints its stderr
     deprecation pointer exactly as delivered. **SC-M2-S16-03 is restated**: the shell assertions
     are exit `0` plus the pointer; the reversibility assertion is read from the engine surface
     (handover data or the fleet row) before and after `--revert`, plus the per-repository isolation
     of the revert. Declared residual: a torn evidence ledger refuses a *recorded* revert with
     `dispatch.state-unverified` at exit `2` while the flip stands; the shell fallback remains
     executable, so delivery is never trapped — revisit trigger 5 governs if that ever bites.
  5. **D5 — Windows and holds.** S16 adds **no** window or hold read. Story task (b) is satisfied by
     documented, already-delivered effect surfaces, and the spec must carry the mapping explicitly:
     owner hold → admission refusal, queue blocking, `status.ownerHold`, board `ownerHold`; peak
     window → lane parks with `reason: "peak-window"`, `until`, `preservation`, `status.laneParks`,
     brief park fields, `lanes` `peakEnforcement`, window-scoped spend evidence, `stop`/`parked`
     events. Declared windows have no read surface and S16 adds none: a window is an *input* to
     admission and parking, and its effect is what an operator acts on; a declared-window read is a
     different question (revisit trigger 4). `QueueLane.providerProfile` is **out of scope** for
     GH-293: the lanes fold projects queue entries, leases, and parks, so a parked-only profile
     field would misstate presence for running lanes, and a truthful field needs daemon lane
     records. The change corrects the over-claiming sentence in `feature-peak-pausing.md` to name
     the surfaces that *do* carry the nomination (attempt history, daemon lane records,
     `status.laneParks`, board `PARKED`, spend window evidence) and records the lanes-read gap as a
     declared known limitation, not as delivered capability.
  6. **D6 — Flip scope.** GH-293 does **not** flip this repository (or any repository) to
     engine-authoritative; GH-239 NG-1 and the unmet floor/coverage conditions still govern.
     "Operate dispatch through the engine for regular delivery" means, concretely: the operator's
     regular delivery path is the engine — `dispatch <ref>` appends real `pilot` attempt records and
     the lifecycle merge/closeout run through the engine primitives — while authority stays
     `dual-run`, the shell entry points stay the documented fallback (no pointer in `dual-run`), and
     the flip remains a separate owner act executed with `dispatch handover <repo>` once the gate
     reads eligible. S16's contribution to that sentence is the evaluation that makes progress
     observable; AC1's accrual is proven by the controlled composition in the change and by
     post-delivery observation, never by fabricated evidence.
  7. **D7 — Merge read-failure classification.** The merge read-failure mismatch requires **no**
     separate decision record. It is restoration of the declared error-table contract: the row for
     `config.credential.missing` already declares `domainKind: "config"`, and the composition
     hard-codes `"provider"` instead of resolving the code's declared row, after which the
     classification step contains the pair as `fallback.internal`. Deriving the domain kind from the
     resolved entry adds no error identity, no row, no `DOMAIN_KINDS` member, and no new exit class,
     so it is in-change engineering with its rationale in the spec (and a conformance test asserting
     that every code a composition can produce is emitted with that code's declared `domainKind`).
     Replacing the credential-refusal stubs with real provider reads is a composition change within
     the declared seams — in scope because the owner scoped it to this ticket, declared in the
     spec's scope with its own risks, and still not a decision record, because it introduces no new
     contract, identity, or policy. One observable does move, and the record states it so no test
     re-encodes the defect: the credential-read path now reports its declared projection
     (`user-validation`) at exit `1` instead of the contained `fallback.internal` at exit `2`. No
     class, row, or exit vocabulary is added; asserting exit `2` for a missing credential asserts the
     defect's signature.
  8. **D8 — Merge owner principal.** The production merge composition's owner principal is the
     **provider-resolved repository owner**: the owner component of the checkout's normalized
     `host/owner/name` repository identity, resolved through the delivered identity policy, supplied
     to the composition's declared owner-principal input (`MergeTransactionConfig.ownerPrincipal`),
     whose meaning the delivered waiver authority already declares as "the provider-resolved
     repository identity". No new configuration key, no new `merge` configuration-branch member (the
     branch keeps exactly `gate-freshness`, `gates`, `deploy-expectations`), and no new identity
     source is introduced. The resolution is a read of the checkout and its identity binding, never
     an operator-maintained setting, and it is observable through the waiver effect: a declaration
     authored by that principal is authorized (and records no waiver on a dry run), while the same
     declaration authored by any other principal refuses `merge.waiver-unauthorized` at exit `1`.
     The composition's base reference is a declared input, not a second git-fact derivation: it is
     the declared integration base the closeout path uses (`CLOSEOUT_INTEGRATION_BASE`, default
     `main-tools`), and only the branch is read from the checkout's git facts.
     (Spec DEC-13, DEC-19, AC-F6-10.)
  9. **D9 — Emittable-code enumeration.** The production merge composition exports
     **`MERGE_COMPOSITION_EMITTABLE_CODES`**, its declared emittable failure-code set, **exhaustive
     by construction** over the composition's refusal branches: every branch that can refuse
     contributes its code, and the constant is the single declaration the conformance test ranges
     over. The enumeration is non-empty, duplicate-free, and carries at least one `config.*`,
     `provider.*`, and `merge.*` member — the three declared domains the composition actually
     emits — so the claim cannot pass vacuously; every member resolves to a declared error-table row
     whose `domainKind` equals the kind the composition emits for that code, and no member is absent
     from the table. **No `state.*` member exists, because the composition emits no `state.*` code:**
     the state-read refusal is the declared `merge.state-unverified` row, at its declared projection
     (`domainKind: "merge"`, projection `platform-provider`, exit `2`). A `state.*` member would
     either name a code nothing emits or force that branch onto a `state.*` identity, moving an error
     identity the criterion forbids this change to move. The anti-vacuity requirement is therefore
     carried by the three **emitted** domains and not by a fourth, invented one: it still forbids a
     one-branch enumeration, because no single refusal branch spans a `config`, a `provider`, and a
     `merge` code, and that is the property the clause exists to protect. Deriving the set from the
     table would test the table against itself, and a hand-picked example list cannot catch a branch
     added later; that is why the enumeration is by construction from the branches. The error-table
     row count, `DOMAIN_KINDS` membership, and exit classes stay unchanged, and a refusal branch
     without a declared identity of its own is expressed through a code the table already declares —
     this decision invents none. (Spec DEC-14 and DEC-18; code review iteration 1, finding F-1;
     AC-F7-11.)
  10. **D10 — Fleet row repository binding.** A `repos list` row's evaluation is bound to the
      normalized `host/owner/name` repository identity of **that row's own checkout**, resolved for
      the read through the delivered identity policy in its declared order — the persisted
      create-once binding recorded with that checkout's git common directory, otherwise the
      checkout's configured remote normalized to the same shape — **read-only and non-persisting**:
      the fleet read never creates, repairs, or rewrites a binding, so a read cannot bind an
      arbitrary repository and a later rename or remote change never re-keys history. The resolution
      opens no additional project store (it is checkout metadata on a project whose store the row has
      already opened, and none at all for a `first-use` row). Records whose `repository` differs from
      the row's resolved identity are excluded from `countedDeliveries`, `conditions`, and
      `cleanDispatches`; a whole-store fold is a defect, not a rendering choice. A `ready` row whose
      identity cannot be resolved fails the read through the delivered `repos.state-unavailable`
      identity at exit `2` with no fabricated row — the declared failure, never a new error class.
      (Spec DEC-15, AC-F3-5.)
  11. **D11 — Row evidence-class scope.** A row's evaluation folds the **`production`** scope — the
      scope that counts `pilot` attempts (`COUNTED_EVIDENCE_CLASS`) — the same scope the shipped
      `dispatch dual-run summary --repo` and the handover decision use. The declaration exists so the
      cross-surface equality is checkable: `handoverGate.cleanDispatches` and
      `handoverGate.conditions` must equal the summary's over the same ledger, which is only a
      meaningful requirement when both sides fold one scope. `controlled` (counting
      `controlled-proof`) stays available to controlled compositions and fixtures and is never the
      fleet row's scope; no scope key, flag, or configuration member is added. (Readiness review
      iteration 1, finding F-6; spec F-3/DM-4.)

  **Handover outcome table (D2) — five outcomes, one exemption:**

  | Outcome | `recorded` / `noop` | Gate evidence read | `conditions` | `verdict` | `reversible` | `truncation` | Unreadable or torn attempts/divergences ledger |
  |---|---|---|---|---|---|---|---|
  | Recorded flip (`operation: "authoritative"`) | `true` / `false` | yes | four entries, declared order | evaluated | `true` | iff `unverifiable` | `dispatch.state-unverified`, exit 2, no data |
  | Idempotent flip noop (`operation: "authoritative"`) | `false` / `true` | yes | four entries, declared order | evaluated | `true` | iff `unverifiable` | `dispatch.state-unverified`, exit 2, no data |
  | Clean refusal (`operation: "authoritative"`, `unmetConditions` present) | `false` / `false` | yes | four entries, open set equals `unmetConditions` | evaluated (`ineligible` or `unverifiable`) | `false` | iff `unverifiable` | `dispatch.state-unverified`, exit 2, no data |
  | Recorded revert (`operation: "dual-run"`) | `true` / `false` | yes | four entries, declared order | evaluated | `false` | iff `unverifiable` | `dispatch.state-unverified`, exit 2, no data; the prior flip stands (D4 residual) |
  | **Idempotent revert noop** (`operation: "dual-run"`; already `dual-run`, or no handover record) | `false` / `true` | **no** — answered from the folded handover before any gate read | **absent** | **absent** | `false` | **absent** | answers the noop at exit `0` |

  Every row above is a data-returning outcome. A handover-ledger read failure is not an outcome in
  this table: it fails `dispatch.state-unverified` at exit `2` with no data, including for the noop
  (the exemption skips the attempts/divergences read only).

  **Exact additive shapes the spec must encode:**

  ```text
  dispatch dual-run summary data (existing keys unchanged, order preserved; appended):
    ... existing keys through floor ...
    cleanDispatches: number                     // === corroboration.satisfied
    consecutiveCleanDispatches: number           // trailing run, 0 when none
    conditions: [{ condition, status } x4]       // declared order, status: "met" | "open"
    truncation?: { bound, omittedRecords }       // unchanged, stays last

  dispatch handover data (key order unchanged; the recorded revert now populates verdict):
    repository, operation, recorded, noop, verdict,
    unmetConditions? (unchanged, refusal only),
    conditions: [{ condition, status } x4],      // every outcome that performs the gate evidence read
    reversible: boolean,                         // folded authority === "authoritative"
    truncation?: { bound, omittedRecords }       // present iff verdict === "unverifiable"

  the single exempt outcome — idempotent revert noop (already dual-run, or no handover record):
    repository, operation: "dual-run", recorded: false, noop: true, reversible: false
    // no conditions, no verdict, no truncation; reversible follows the declared order of the keys
    // present; answered before any gate evidence read, exit 0

  repos list row (data.repos[], exactly these keys in this order):
    repoKey, root, stateLocation, daemonReachable, handoverState,
    reversible: boolean,
    handoverGate: {
      verdict: "eligible" | "ineligible" | "unverifiable",
      conditions: [{ condition, status } x4],
      countedDeliveries: number,
      cleanDispatches: number,
      truncation?: { bound, omittedRecords }
    }

  production merge composition (new export; no new row, kind, or exit):
    MERGE_COMPOSITION_EMITTABLE_CODES: readonly AppErrorCode[]
      // one member per refusal branch; non-empty, duplicate-free, carrying at least
      // one config.*, provider.*, and merge.* member — the three emitted domains; no
      // state.* member exists because the state-read branch is merge.state-unverified;
      // every member resolves to a declared row whose domainKind is the kind it emits

  unchanged: handover/reversal records, projects.v1 rows and `projects list --flat`
  byte-compatibility, the five-key shell summary, the error-table row count,
  DOMAIN_KINDS membership, exit classes (D7 explains the one 2 → 1 move), and every
  declared error identity
  ```

  **Text output:** the summary's `key=value` text gains `clean_dispatches=`,
  `consecutive_clean_dispatches=`, and `conditions=truth:met,coverage:open,floor:open,corroboration:met`
  after `unmet_conditions` and before the optional truncation line. The `repos list` text table is
  **unchanged**: no sixth column (the row's gate detail is a JSON read; the human per-condition view
  is the summary text).

- **Rationale (tied to drivers):** Driver 1 eliminates ALT-1 and ALT-2: the row adds a projection to
  a read that already opens every store, while a verb or a tick adds a permanent surface. Driver 2
  eliminates the "summary only" and "row only" variants: ALT-6 produces the condition array once and
  every reader consumes it, with the open-set invariant test closing the obvious drift. Driver 3 is
  why the daemon tick is disqualified outright — the shipped composition would report nothing.
  Driver 4 eliminates ALT-5: a shell the AC calls "usable" is best protected by not changing it, and
  the reversibility claim is about repository authority, which the engine already derives. Driver 5
  keeps `windowEnd` out of the row so two reads over unchanged state stay byte-identical. Driver 6 is
  served by projecting `reversible` from the existing fold rather than inventing a new state.
  Driver 7 is why the coverage clause was restated rather than satisfied with a counter: exposure is
  not corroboration, and the number that must grow is the corroborated one. Driver 8 eliminated
  ALT-4: the declared verdict vocabulary already says "unverifiable", and condition statuses say
  "met/open".
- **Decider:** Juliusz Ćwiąkalski (owner) — human acceptance at the GH-293 PR review; the AI does
  not accept this R2 record.
- **Conditions for revisit:** See `revisit_triggers`; principally fleet-scale evaluation cost
  (D1 host), a consumer misreading condition status as eligibility (D2 shape), a need to see a
  declared window before it opens (D5), or a torn ledger blocking a recorded revert (D4).

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-8 (see the ALT-6 row). No
accepted-risk exceptions are claimed. C-1 is satisfied twice over (fleet row and summary, both
side-effect free and daemon-free); C-2 by appending only, with `projects` rows untouched and the
recorded revert populating its already-declared `verdict` (no key added, no order changed); C-3 by a
single producer plus the open-set identity; C-4 by keeping unverifiability at verdict level and
never fabricating zeros; C-5 by a pure read with no wall-clock field in the row; C-6 by adding no
command, identity, row, kind, or exit class; C-7 by leaving the shell untouched; C-8 by scope.

## Trade-offs & Consequences

### Positive Outcomes

- An operator gets a fleet-wide gate view — verdict, open conditions, counted and clean dispatches,
  and reversibility per repository — from one read that nothing new has to run.
- Every consumer of a condition ("is coverage still open?") reads the same array over one declared
  evidence scope, so the summary and the fleet row can no longer disagree with the handover decision.
- The merge lifecycle becomes usable for regular engine delivery without introducing a single new
  error identity: its principal comes from the identity the provider already resolves, and its
  emittable codes are one declared enumeration a conformance test can range over.
- Accrual becomes honest and legible: `cleanDispatches` counts corroborated successes by
  construction, and the trailing streak shows whether the engine path is actually being used.
- Reversibility becomes visible on the surfaces that own authority, without touching a shell
  contract that four entry points and their callers depend on.
- Two story scenarios stop asserting things the payload cannot express, before the test plan
  encodes them as false oracles.

### Negative Outcomes

- The `repos` row grows from five fields to seven, and the row's contract test must be updated to
  the new declared set (a deliberate, declared additive change, not an accident).
- The fleet read pays one extra bounded ledger read per ready repository; the cost is invisible at
  the current scale but real at a large one.
- A corrupt attempts ledger now fails the whole fleet read rather than degrading one row — the
  existing strictness is inherited rather than improved, so one bad repository can blind the fleet
  view (it cannot stop delivery: the shell fallback and one-shot dispatch are unaffected).
- `consecutiveCleanDispatches` is a new metric with no history, so its first values are one data
  point each, not a trend.
- Restating two scenarios costs a test-plan rewrite and invites the (correct) question of whether
  other M2-S16 scenario text is similarly unrepresentable.
- The lanes read remains profile-blind, so an operator reading only `lanes list` still cannot
  attribute a running lane to a profile; the corrected documentation makes that limitation
  discoverable instead of denying it.
- The handover promise is narrower than "`conditions` is always present": exactly one outcome omits
  it, so a consumer must not assume the array unconditionally. The exemption is named once and
  pinned, but it is a narrowing of the promise, not a pure addition.

### Unresolved Questions

- **Resolved (spec OQ-1) — operator routine:** a new operator guide under `doc/guides/` (declaring
  `ados_distribution: redistributable`) covers daily engine-first operation, reading the gate and the
  fleet row, performing a flip and its reversal, and the shell fallback; the feature pages stay the
  contract reference and cross-link it.
- **Resolved (spec OQ-2) — lanes-read profile gap:** declared as an out-of-scope boundary plus a
  known limitation in the reconciled peak-pausing page, with the over-claiming sentence corrected and
  no lanes-read code change. No tracker defect is opened by this change; one may be opened later
  without changing this contract.
- **Resolved (spec OQ-3) — merge credential stubs:** the real provider reads replace them in this
  change on the authority of the owner-authored scope comment on issue #293, the classification is
  derived from the declared row, and the `verify deploy` stub stays a declared residual.
- **Open, non-blocking — out-of-repo summary consumers:** no such consumer is known to depend on the
  summary's key set beyond the additive rule (a spec assumption, not a verified inventory). Appended
  keys with preserved order remain the declared compatibility contract; owner: @pm.

## Implementation Plan

1. **Contract first** — declare `DispatchConditionStatus`, the appended summary keys, the handover
   `conditions`/`reversible` (with `verdict` populated on the recorded revert and the single exempt
   noop left bare), and the `repos` row `reversible`/`handoverGate` types in
   `packages/core/src/contracts/{dispatch,projects}.ts`, with `REPOS_ENTRY_FIELDS` extended in the
   declared order.
2. **One producer** — add the condition-status projection and the accrual counters to
   `packages/core/src/domain/dispatch-gate.ts` (trailing-run walk over `countedInWindow`), and make
   `toSummaryData` the only place that builds them; the handover result and the fleet row consume the
   same output, at the production scope.
3. **Fleet composition** — compute the gate facts in the same project-read pass and attach them only
   in `reposListDataOf`; resolve each ready row's own repository identity read-only and
   non-persisting through the delivered identity policy, exclude foreign records, and leave
   `projects.v1` rows and the flat alias untouched; keep the read-only guarantee and the
   byte-identical determinism of two runs over unchanged state.
4. **Text and shell-adjacent surfaces** — append the three summary text lines; change nothing in the
   shell scripts, help text, or the pinned summary key order.
5. **Merge restoration** — derive the read-failure `domainKind` from the resolved error-table entry
   instead of hard-coding `"provider"`, publish `MERGE_COMPOSITION_EMITTABLE_CODES` as the
   by-construction enumeration of the composition's refusal branches, resolve the owner principal
   from the checkout's identity, and add the totality conformance test over that constant.
6. **Stories and spec reconciliation** — restate SC-M2-S16-02 and SC-M2-S16-03 in the planning
   reference and carry the restatement into the change spec; correct the peak-pausing lanes-read
   sentence; document the window/hold mapping table and the no-flip scope.

## Verification Criteria

- Metric: surfaces reporting the four conditions from one producer over one scope — Target: row,
  summary, and handover all agree on every window, row and summary `cleanDispatches` agree on the same
  ledger, and `open` conditions equal `unmetConditions` — Window: every behaviour-suite run.
- Metric: handover data-returning outcomes carrying `conditions` — Target: exactly the four
  evidence-reading outcomes; the idempotent revert noop carries none and still answers under an
  unreadable attempts/divergences ledger — Window: behaviour suite.
- Metric: `cleanDispatches === corroboration.satisfied` across every fixture — Target: 0 mismatches —
  Window: behaviour and property suites.
- Metric: `verdict == "unverifiable" ⟺ truncation present` — Target: 0 violations — Window: contract
  suite.
- Metric: `repos list` payload byte-identity across two consecutive reads over unchanged state —
  Target: identical bytes — Window: determinism suite.
- Metric: shell summary key order and key set — Target: unchanged (five keys, pinned order) —
  Window: `scripts/.tests/test-deliver-ticket.sh`.
- Metric: emitted `(kind, code)` pairs whose kind differs from the code's declared `domainKind` —
  Target: 0 — Window: classification conformance suite.
- Metric: `MERGE_COMPOSITION_EMITTABLE_CODES` members with no declared row, or a declared kind that
  differs from the emitted kind — Target: 0, with a non-empty, duplicate-free set covering
  `config.*`, `provider.*`, and `merge.*` (no `state.*` member: the state-read refusal is the
  declared `merge.state-unverified` row) — Window: classification conformance suite.
- Metric: `merge <ref> --dry-run` under a missing credential — Target: the declared `config` identity
  at its projected exit `1`, never `fallback.internal` at exit `2` — Window: behaviour suite.
- Metric: `dispatch.handover` authoritative records attributable to this change for a real
  repository — Target: 0 — Window: post-delivery audit.

## Confidence Rating

High. Every clause is a projection or a scope statement over facts already computed and already
tested; the two scenario restatements are forced by the delivered payload shapes rather than chosen
for convenience; and the two scope answers (no new read for windows/holds, no flip) follow the
delivered composition and the standing NG-1 prohibition. The residual uncertainty is cost at fleet
scale and the lanes-read remedy (declared as a limitation, deliberately not solved here), both named
as revisit triggers or recorded as open rather than assumed away. Confidence here is about the
reasoning, not evidence of operational accrual — that is measured after delivery.

## References

- Story: `doc/planning/oss-tooling/milestones/m2/backlog.md` §M2-S16 (lines 355-370)
- Change spec: `doc/changes/2026-11/2026-11-17--GH-293--engine-first-operations/chg-GH-293-spec.md`
  v1.5 (DEC-12–DEC-15 adopted here as D2 and D8–D10, DEC-17 as D11, DEC-18 and DEC-19 amending D9's
  non-vacuity set and D8's base input; AC-F2-3, AC-F3-5, AC-F6-10, AC-F7-11)
- Scenarios: `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` SC-M2-S16-01/02/03
- Specs: `doc/spec/features/feature-dispatch-engine.md` (handover gate, bash fallback, daemon
  composition), `doc/spec/features/feature-projects.md` (`repos list` contract, handover projection),
  `doc/spec/features/feature-peak-pausing.md` (window and hold surfaces)
- Decisions: [TDR-0015](TDR-0015-dispatch-handover-gate-operational-semantics.md) (gate semantics,
  applied unchanged), [TDR-0020](TDR-0020-dispatch-divergence-recording-and-resolution.md)
  (delivered-evidence divergences), [TDR-0024](TDR-0024-dispatch-attempt-read-side-and-local-evidence-resolve.md)
  (attempt read side), [TDR-0026](TDR-0026-queue-lifecycle-removal-single-flight.md) (queue
  lifecycle), [TDR-0029](TDR-0029-event-taxonomy-v2-peak-pause-kinds.md) and
  [TDR-0030](TDR-0030-park-preservation-failure-classification.md) (park episode records and
  surfaces)
- Contracts and code: `packages/core/src/contracts/dispatch.ts`,
  `packages/core/src/contracts/projects.ts`, `packages/core/src/contracts/queue.ts`,
  `packages/core/src/contracts/error-table.ts`, `packages/core/src/domain/dispatch-gate.ts`,
  `packages/core/src/domain/dispatch-authority.ts`, `packages/core/src/domain/merge-transaction.ts`,
  `packages/cli/src/production.ts`, `packages/cli/src/classify.ts`
- Tests that pin the touched payloads: `tests/behaviour/dispatch-additive-stability.test.ts`,
  `tests/behaviour/repos-list-contract.test.ts`, `scripts/.tests/test-deliver-ticket.sh`
- Shell fallback: `scripts/lib/dispatch-authority.sh`, `deliver-ticket.sh`, `batch-deliver.sh`,
  `pm-liveness.sh`, `ceo-loop.sh`
