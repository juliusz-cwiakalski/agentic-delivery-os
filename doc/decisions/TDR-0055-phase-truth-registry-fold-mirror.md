---
id: TDR-0055
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "One phase truth source: the delivery-registry ledger fold stays the only authority, the pm-notes document stays a derived mirror written from the post-transition fold (latest completion, never the earliest recorded one), divergence is detected — never repaired — as one additive `lint.phases.divergent` row on the existing `lint --pm-notes --registry` both-target, scoped to phases that have ledger history and comparing completion only, `verify change` is unchanged, and the regression is named after the F4 stale-timestamp defect."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os phase primitive, delivery registry, and pm-notes lint surface"
decision_scope: repo
review_date: null
business_impact: "Removes a class of silent disagreement between the two phase surfaces the coordinator, the readiness gate, and the closeout capsule cross-check all read, without moving truth into a document agents edit by hand."
customer_impact: "An operator sees one completion timestamp per phase after any reopen/re-complete, and a lint verdict that names the diverging phase instead of two documents that each look plausible."
classification:
  domains: [architecture, contracts, tooling, process]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-349: @pm routed the phase truth-source question to a record during clarify_scope)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-349 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-349 clarify_scope: the mirror write path takes the earliest recorded completion)"
    - "@decision-advisor (repository analysis and this record)"
    - "@spec-writer (carry the mirror rule, the additive lint row, and the scoped comparison into the GH-349 change spec)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-349 PR review — this record adds a lint identity to a pinned five-row family)"
  performers:
    - "@coder (GH-349 delivery: fold-written mirror, divergence rule, registry read field, regression)"
    - "@doc-syncer (pm-notes-lint-and-phase-transitions, result-contract, verify-change reconciliation)"
  informed:
    - "@reviewer and @readiness-reviewer — they read pm-notes as the human-facing phase record"
    - "Closeout's capsule cross-check, which derives expected capsule events from the same ledger records"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A second derived mirror appears (a plan progress view, a board projection, an exported phase table): it inherits this rule — written from the fold, never read for idempotency, never repaired from its own bytes."
  - "Divergence detection proves to miss real drift because the scoped comparison excludes document-only completions: decide a separate declaration-versus-ledger rule (it is `verify change`'s precedence question today) rather than widening this row."
  - "The legacy corpus (2026-10 onward) turns out to carry command-written documents that disagree with their ledgers: treat that as evidence of a second write path and fix the path; do not add a repair command."
  - "pm-notes phase timestamps stop being consumed by any human-facing surface: retire the mirror entirely in favour of a rendered view of the fold, as its own decision."
links:
  related_changes: ["GH-349"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-349--merge-closeout-queue-repair/chg-GH-349-pm-notes.yaml"
    - "doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md"
    - "doc/spec/features/feature-result-contract.md"
    - "doc/spec/features/feature-verify-change-and-exit-taxonomy.md"
    - "doc/spec/features/feature-capsule.md"
  contracts:
    - "packages/core/src/contracts/pm-notes.ts"
    - "packages/core/src/contracts/registry.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/state/registry.ts"
    - "packages/cli/src/commands/phase.ts"
    - "packages/cli/src/commands/lint.ts"
  diagrams: []
  decisions: ["TDR-0031", "TDR-0005", "ADR-0003"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S11", "GH-349"]
---

# TDR-0055: One Phase Truth Source — Ledger Fold Authority, Fold-Written Mirror, and Detected Divergence

## Context

The phase surface already declares who is in charge. Ledger records are the durable truth; the
per-change phase state is "a pure fold … the ledger is truth; the projection is disposable and
atomically replaced"; `phase list` derives state by folding the verified ledger and never reads a
stored projection as evidence
(`doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md:18,22,83-89`). The pm-notes
document carries the same phase map and is edited as a mirror by the same command.

The delivered write path breaks that declaration in one branch. When a completion re-run finds both a
record and a commit already present, the document is re-staged with

```
registry.transitions.find((record) => record.phaseId === phaseId && record.operation === "complete")?.timestamp
```

(`packages/cli/src/commands/phase.ts:481-494`, read 2026-11-18) — the **first** matching completion in
the full history. The fold that defines truth takes the **latest** completion
(`packages/core/src/state/registry.ts:377-397`: `started` is the first completion, `completed` is
reassigned by every completion). So a reopen followed by a re-complete leaves the document carrying the
pre-reopen timestamp while the ledger says otherwise, and the no-op envelope reports that same stale
`completedAt` to the caller. Nothing detects the disagreement: the five `lint` rows validate a document
against the schema and the registry against its own schema, but no surface compares them
(`packages/core/src/contracts/pm-notes.ts:76-84`; `packages/cli/src/commands/lint.ts:31-39,78-130`).

Two structural facts bound the answer. `stageEntry` on an existing entry writes **only** `completed`
and never rewrites `started` (`packages/adapters/src/file/pm-notes-parser.ts:243-256`), so the two
fields have different provenance: `started` in the document may legitimately predate the ledger's first
completion, while `completed` is command-written. And the both-target invocation already reads both
surfaces in one run (`lint.ts` both-target path; spec line 48) but its registry read returns only
counts and verification classes, not the fold.

## Problem Framing (Clarified)

The question is not "which document wins" — that is already decided — but **what makes the declared
ownership true on every write, and how a disagreement that predates the fix becomes visible without
turning bookkeeping into a delivery gate.**

- **Root cause.** The mirror is written from an *identity lookup over history* rather than from the
  *fold that defines state*. Every symptom follows: the stale timestamp, the stale `completedAt`
  evidence, and the absence of any comparison because each surface is only ever validated against
  itself.
- **Symptom scope.** The defect is reachable only through the reopen-then-re-complete sequence, which
  is exactly the sequence the idempotency matrix promises to converge (rows 3 and 4 of the delivered
  matrix).
- **Second question.** Once truth is unambiguous, a disagreement must be *reportable*. Detection and
  repair are different mechanisms: repair writes bytes, needs verified inputs, and can hide a second
  write path; detection is read-only and names the phase.

The reframed problem: **derive the mirror from the fold after every transition, and make divergence a
named read-only finding on the surface that already reads both sources.**

## Constraints (Hard Requirements)

### C-1: The ledger stays the only authority

- **Statement:** No decision, idempotency check, verification verdict, or write may treat the pm-notes
  document as truth over the ledger.
- **Source:** prior decision (delivered registry contract, spec lines 18, 79, 89) + AC (GH-349 "one phase truth source").
- **Verification:** code review of the write path + test (a document claiming a completion with no
  ledger record never changes `phase list`).
- **Negotiable:** no.

### C-2: The write path never decides from document bytes

- **Statement:** Idempotency, convergence, and commit-intent classification continue to derive from
  durable ledger and commit evidence only; the pre-write document snapshot exists solely to restore
  bytes after a failed act.
- **Source:** prior decision (`feature-pm-notes-lint-and-phase-transitions.md:79,137`: "refuses to decide
  idempotency from unverified bytes"; "never from the derived projection").
- **Verification:** test (a hand-cleared document does not produce a second transition or a duplicate
  commit) + code review.
- **Negotiable:** no.

### C-3: After every landing the mirror equals the fold

- **Statement:** For every phase the ledger has transitions for, the document's `completed` equals the
  fold's `completed` after each successful `complete`/`reopen` and after each convergence branch.
- **Source:** AC (GH-349 "both phase sources agree after every phase transition").
- **Verification:** test (property over the full transition matrix, including reopen → re-complete).
- **Negotiable:** no.

### C-4: Detection never repairs

- **Statement:** Divergence detection performs zero writes, acquires no fence, appends no record, and
  never rewrites a document or a projection from either source's bytes.
- **Source:** internal standard (lint is read-only; spec line 53).
- **Verification:** test (zero writes/fences on every divergence fixture) + code review.
- **Negotiable:** no.

### C-5: Additive closed-set discipline for the finding identity

- **Statement:** One new concrete `lint` row, documented and machine-declared together, in the declared
  rule order; no pattern widening; the existing five rows keep their codes and remediation semantics.
- **Source:** internal standard (`feature-result-contract.md` binding rule; `feature-pm-notes-lint-and-phase-transitions.md:99-103`).
- **Verification:** test (bidirectional table sync + row reachability) + code review.
- **Negotiable:** no.

### C-6: Determinism and offline behaviour are unchanged

- **Statement:** The rule performs no tracker read, no clock read, no network I/O, and returns the same
  verdict across replays.
- **Source:** internal standard ("deterministic" repository priority; spec line 136).
- **Verification:** test (replay determinism; zero tracker calls).
- **Negotiable:** no.

### C-7: No new command, subcommand, or write surface

- **Statement:** The rule rides the delivered `lint` both-target and the delivered `phase` write path;
  no `phase repair`, no `lint --fix`, no new state kind.
- **Source:** AC scope + repository priority ("no ceremony for routine work"; PM position on additive-only repair).
- **Verification:** code review of the command registry + prompt conformance scan.
- **Negotiable:** no.

## Decision Drivers

1. **D-1 Provenance.** One fact, one author: the fold authors state, the document renders it.
2. **D-2 Convergence after reopen.** The matrix's promise (rows 3–4) must hold in the document, not only
   in the ledger.
3. **D-3 Legibility under drift.** When the two surfaces do disagree, the operator learns which phase and
   which field, without reading two YAML files side by side.
4. **D-4 No false positives on the corpus.** A rule that flags historically hand-written documents
   destroys its own signal (PDR-0005 D2's precision argument, applied to bookkeeping).
5. **D-5 Never gate delivery on bookkeeping.** The detection surface must not convert a mirror mismatch
   into a finalization failure.
6. **D-6 Smallest additive surface.** One row, one read field, no new command, no new kind.

Priority order: **D-1 > D-3 > D-2 > D-4 > D-5 > D-6.** D-3 and D-4 pull against each other — the most
legible rule compares every phase entry, the most precise compares only what the command wrote — and
the decision resolves that by scoping the comparison to ledger-backed phases and the `completed` field.

*(Overlap check: read-only detection and additivity are gates (C-4, C-5, C-7) and appear here only as
ranking values. The gate decides eligibility; the driver ranks survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-349 clarify_scope routed the question here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-349 PR review. AI does not
  accept this R2 record.
- **Contributors:** `@pm` (defect evidence and position); `@decision-advisor` (analysis and record);
  `@spec-writer` (carry the rule and the row into the change spec).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the owner for final acceptance.
- **Performers:** `@coder` (mirror derivation, divergence rule, registry read field, regression);
  `@doc-syncer` (phase-transitions spec, result-contract, verify-change note).
- **Informed:** `@reviewer`/`@readiness-reviewer` (human readers of pm-notes); closeout's capsule
  cross-check; future projections that mirror phase state.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The fold defines `started` as the first completion and `completed` as the latest | FACT | `packages/core/src/state/registry.ts:377-397` (read 2026-11-18) | The mirror rule would have to reproduce a different fold | High |
| The convergence branch takes the **first** matching completion from the full history | FACT | `packages/cli/src/commands/phase.ts:481-494` (read 2026-11-18) | The named F4 defect would not exist | High |
| The no-op envelope reports that same value as `completedAt` | FACT | `packages/cli/src/commands/phase.ts:495-513` | The defect would be document-only | High |
| Existing entries receive only `completed` from `stageEntry`; `started` is written only at creation | FACT | `packages/adapters/src/file/pm-notes-parser.ts:243-256` | Comparing `started` would be lawful and the scope narrower | High |
| Idempotency is decided from durable ledger/commit evidence, never the document | FACT | `packages/cli/src/commands/phase.ts:389-400,773-805`; spec lines 79,137 | Truth could have drifted into the document already | High |
| The five `lint` rows validate one surface each; no cross-surface comparison exists | FACT | `packages/core/src/contracts/pm-notes.ts:76-84`; `packages/cli/src/commands/lint.ts:31-39,78-130` | Divergence would already be detected somewhere | High |
| The both-target invocation already reads both surfaces but its registry read exposes no fold | FACT | `packages/cli/src/commands/lint.ts:31-39` (`LintRegistryRead`) | A new read surface would be needed | High |
| `verify change` is read-only and applies registry-over-declaration precedence without writing | FACT | spec lines 24, 105-109 | Detection could live in verify without changing a verdict | High |
| `phase-state.<REF>.json` is a disposable, rebuildable projection | FACT | spec line 89; `packages/core/src/state/registry.ts:464-500` | The projection would also need mirror discipline | High |
| The legacy corpus (2026-10 onward) contains documents authored before the phase command wrote them | ASSUMPTION | corpus boundary statement, spec lines 115-117 | A wide comparison would flag historical documents | Medium-High |
| Every command-written completion carries the same timestamp in the ledger record and the document | FACT | `packages/cli/src/commands/phase.ts:759-819`; `pm-notes-parser.ts:243-256` | Comparison could not use timestamps as identity | High |

## Mental Models & Techniques Used

- **First principles.** Two surfaces, one fact. Either one authors it or neither does. The decision
  makes exactly one an author and derives the other at write time.
- **Inversion.** What makes this wrong? A document that disagrees and nobody notices (fixed by
  detection); a repair that hides a second writer (excluded by C-4); a lint rule that fails the corpus
  (bounded by the scope); truth quietly moving into the document (excluded by C-1/C-2).
- **Second-order thinking.** Auto-repair looks friendlier but destroys the evidence: after a repair you
  cannot tell whether the ledger or the document was wrong, and a second writer keeps producing drift.
  Detection preserves the evidence and costs one operator read.
- **Systems thinking.** pm-notes is read by humans, `@reviewer`, `@readiness-reviewer`, and agents;
  the ledger is read by `phase list`, `verify change`, and closeout's capsule cross-check. Making the
  mirror derived keeps every one of those readers on one provenance.
- **Opportunity cost.** A repair engine needs verified inputs, a fence, conflict semantics, and a new
  vocabulary; a read-only comparison needs one row.
- **KISS.** The paved road is the delivered `lint` both-target and the delivered fold; nothing new is
  invented.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 | C-7 |
|----------|-----|-----|-----|-----|-----|-----|-----|
| ALT-0 fix only the lookup, no detection | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 fold-written mirror + scoped `lint.phases.divergent` (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 make pm-notes (or last writer) the truth | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 detect and auto-repair on divergence | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| ALT-4 detect in `verify change` instead of (or as well as) lint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 stop writing phase timestamps into pm-notes | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none taken).

### Alternative 0 — Fix Only the Lookup (baseline)

- **Eligibility:** Eligible.
- **Summary:** Replace `.find(...)` with the fold's latest completion and ship no detection.
- **Constraint compliance:** Passes every constraint — it is a subset of the chosen option.
- **Driver fit:** Best on D-6, adequate on D-1 and D-2, fails D-3 entirely: drift created by the
  pre-fix code, or by any future second writer, stays invisible.
- **Pros:** One-line change, one regression test.
- **Cons:** GH-349's AC says the sources agree *after every phase transition*, but says nothing about
  the documents that already disagree; the fix cannot reach them without detection.
- **Why rejected:** It repairs the future and abandons the past; the AC's "agree" claim would be
  unverifiable for any existing change folder.

### Alternative 1 — Fold-Written Mirror Plus a Scoped Divergence Row (chosen)

- **Eligibility:** Eligible.
- **Summary:** Every convergence branch stages the document from the post-transition fold (completion
  only); `lint --pm-notes --registry` gains one comparison over ledger-backed phases reporting
  `lint.phases.divergent`; nothing repairs, nothing in `verify change` changes.
- **Constraint compliance:** Passes all of C-1…C-7.
- **Driver fit:** Best on D-1, D-2, D-3, D-4, D-5; one row and one read field on D-6.
- **Pros:** One provenance, converging writes, a drift signal with a named phase and field, no delivery
  gate, no false positives on hand-authored `started`.
- **Cons:** One additive lint identity and its error-table/binding ripple; a document-only completion
  stays out of scope by design.
- **Why chosen:** It is the only eligible alternative that satisfies both halves of the AC — always
  agree on write, and say so when they do not.

### Alternative 2 — Make the Document (or the Last Writer) the Truth

- **Eligibility:** Not eligible (fails C-1 and C-2).
- **Summary:** Treat pm-notes as the human-authored truth and reconcile the ledger from it, or accept
  whichever wrote last.
- **Constraint compliance:** C-1 fails (truth moves into a hand-edited document); C-2 fails (idempotency
  would then be decided from unverified bytes, which the delivered path explicitly refuses).
- **Driver fit:** Attractive only on D-6.
- **Pros:** No fold discipline needed; humans edit what they read.
- **Cons:** A hand-cleared or hand-set completion would fabricate ledger state; reopen reasons, commit
  intent, and evidence have no document representation, so the reconciliation is lossy in one direction.
- **Why rejected:** It inverts a decision the ledger contract already made, for no gain over deriving
  the document.

### Alternative 3 — Detect and Auto-Repair

- **Eligibility:** Not eligible (fails C-2, C-4, C-7).
- **Summary:** When the two surfaces disagree, rewrite the document from the fold (a `lint --fix`, a
  `phase repair`, or a closeout step).
- **Constraint compliance:** C-2 fails (repair must decide what to write from something other than
  verified durable evidence or it must re-read the document), C-4 fails (detection stops being
  read-only), C-7 fails (a new write surface).
- **Driver fit:** Strong on D-3's convenience, destructive on D-1 and D-4's evidence value.
- **Pros:** The operator does nothing.
- **Cons:** Loses the evidence of which surface was wrong; a second writer keeps drifting and is never
  found; a write path needs a fence, an identity, and a failure taxonomy.
- **Why rejected:** It optimizes away the diagnostic that justifies the feature.

### Alternative 4 — Detect in `verify change` (Instead of, or as Well as, Lint)

- **Eligibility:** Eligible.
- **Summary:** Make the finalization verdict refuse or flag when the document and the fold disagree.
- **Constraint compliance:** Passes every constraint; `verify change` is already read-only and already
  reads both surfaces.
- **Driver fit:** Good on D-3; fails D-5 — a mirror mismatch would become a delivery verdict and block
  finalization on a bookkeeping defect.
- **Pros:** Impossible to miss; no new lint identity.
- **Cons:** Converts a document defect into a delivery failure; changes the meaning of a read-only
  verdict that reviewers rely on; couples the fix to the delivery path.
- **Why rejected:** Bookkeeping must not gate delivery; lint is the declared conformance surface and the
  operator runs it before verification anyway.

### Alternative 5 — Stop Mirroring Timestamps Into pm-notes

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Keep phase state only in the ledger; render a view instead of writing the document.
- **Constraint compliance:** C-3 fails because the document is a delivered contract surface with
  required `phases` entries (`pm-notes.ts` required keys) — the two sources cannot "agree" if one stops
  carrying the fact.
- **Driver fit:** Best on D-1 and D-4, worst on the AC and on every human reader.
- **Pros:** No mirror, no drift.
- **Cons:** Breaks the delivered document schema, the corpus, and the human-facing record; a much larger
  change than the defect justifies.
- **Why rejected:** It answers a schema question with a migration.

## Decision

- **Decision:** Adopt **Alternative 1**, with Alternative 0 folded in as its first element.

### 1. Truth

The verified delivery-registry ledger remains the only authority. The pm-notes document and the derived
`phase-state.<REF>.json` are both derived surfaces; neither is ever read for idempotency, convergence,
or a verification verdict.

### 2. The mirror is written from the post-transition fold

Every branch that writes the document derives the target entry's `completed` from
`foldPhaseState(changeRef, transitions).phases[<phase>].completed`, where `transitions` is the ledger
history including the just-appended record (or the verified history on a convergence-only branch). This
replaces the history lookup in the `both` branch and is applied uniformly to `both`,
`record-atomic-without-commit`, `record-record-only`, and the landing branches, so no branch can hold a
different derivation. `started` is never rewritten for an existing entry. Reopen keeps its delivered
behaviour (the fold clears `completed`, the document writes `null`).

### 3. The no-op evidence reports the fold

An already-converged completion reports `evidence.completedAt` and `commitSkipped: "no-op"` from the
same fold value — the stale-timestamp defect is not allowed to survive in the envelope after the
document is fixed.

### 4. Divergence is detected, reported, never repaired

`lint <ref> --pm-notes --registry` gains one comparison, run after both conformance checks pass (so a
malformed document is still reported as malformed). For each canonical phase id that has at least one
ledger transition, the document's `completed` must equal the fold's `completed`; `null` and a timestamp
are different facts. The first divergence is
`lint.phases.divergent` — user category, non-retryable, `not_landed`, exit 1 — naming the phase id, both
values (bounded), and the remediation "re-derive the document from `phase list`, or record the missing
transition through `phase complete`". The rule performs no write, acquires no fence, appends nothing,
and is deterministic across replays. To implement it, the lint surface's registry read exposes the
verified fold additively (`LintRegistryRead` gains the transitions or the folded phases); no other read
changes.

### 5. Deliberate scope exclusion

A document completion with **no** ledger transition is out of scope for this row. It is a declaration
question, already handled by `verify change`'s registry-over-declaration precedence, and flagging it
would fail the legacy corpus for documents authored before the command wrote them — which would destroy
the signal (D-4). The exclusion is stated in the spec, not implied.

### 6. `verify change` is unchanged

Detection lives on the conformance surface, not on the delivery verdict. A mirror mismatch is a
bookkeeping defect; making it a finalization failure would couple delivery to document hygiene.

### 7. Regression, named after the defect

One suite named for F4 asserts the whole sequence: complete → reopen → complete. After the second
completion, `phase list`, the fold, and the document all report the **second** completion timestamp;
the pre-fix value (the first completion) appears nowhere; and the no-op re-run envelope reports the same
value. Companion cases assert that a hand-edited document produces `lint.phases.divergent` with the
phase named, that a document-only completion is not flagged by this row, and that detection performs
zero writes and zero fence acquisitions.

- **Rationale (tied to drivers):** deriving the mirror from the fold makes provenance single-valued
  (D-1) and makes reopen/re-complete converge in both surfaces (D-2); the scoped comparison makes drift
  legible where it is command-caused (D-3) without punishing history (D-4); keeping it read-only and out
  of `verify change` keeps delivery ungated (D-5); one row and one read field is the minimum surface
  (D-6).
- **Decider:** Juliusz Ćwiąkalski — human acceptance at the GH-349 PR review; this record stays
  `Proposed` until then.
- **Conditions for revisit:** see `revisit_triggers` — notably a second mirror, a corpus finding that
  contradicts the scope exclusion, and retiring the mirror entirely.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 … C-7. No accepted-risk exceptions are
taken. Two consequences are recorded rather than excused: the `lint` family grows from five to six rows,
which is an additive closed-set change paid in this change with the documented table and the binding
test updated together (C-5); and the scope exclusion leaves document-only completions undetected by this
row, which is a deliberate boundary reported to the reader rather than a silent gap (D-4).

## Trade-offs & Consequences

### Positive Outcomes

- One provenance for phase state: the ledger authors it, every other surface renders it.
- Reopen → re-complete converges in the document as well as in the ledger, and the envelope stops
  reporting a stale `completedAt`.
- Drift becomes nameable: phase id, both values, and the remediation, on the surface an operator already
  runs before verification.
- No repair engine, no new command, no new state kind, no delivery gate.

### Negative Outcomes

- A sixth `lint` row and a `LintRegistryRead` extension enter additive contract surface; the table
  binding and the documented table must move together.
- Divergence detection only covers phases the ledger knows about; a document-only completion stays
  invisible to it (by design, but a reader may expect otherwise).
- The corpus must be re-linted in the change to prove zero new findings; any hit is evidence of a second
  writer and must be investigated rather than suppressed.
- The mirror stays a write, so the write path is still the only place the two sources are kept in step;
  a future third surface inherits the same discipline by this record's revisit trigger.

### Unresolved Questions

- [ ] Whether any corpus document (2026-10 onward) already diverges under the scoped comparison (owner:
  `@coder`, GH-349 delivery; a hit is evidence, not noise).
- [ ] Whether the spec should also reconcile pm-notes `milestone` with `change.milestone` (owner: the
  closeout milestone decision, ODR-0005; kept out of this record).
- [ ] Whether a rendered view could replace the mirror entirely (owner: this record's revisit trigger).

## Implementation Plan

1. **Mirror derivation.** Replace the history lookup with the fold on every document-writing branch;
   keep `started` immutable for existing entries; report the fold value in no-op evidence.
2. **Divergence rule.** Add the comparison to the lint both-target after the two conformance checks;
   extend `LintRegistryRead` with the verified fold; add the identity to the closed lint code set, the
   machine table, and the documented table together.
3. **Regression suite.** One suite named for F4 over the full matrix, plus the divergence, exclusion,
   and zero-write cases.
4. **Corpus check.** Run the both-target lint across the acceptance corpus and record the result; any
   finding is triaged as a second-writer defect, never patched away.
5. **Docs.** Reconcile the phase-transitions spec (mirror rule, sixth row, scope exclusion), the
   result-contract lint-kind declaration, and the verify-change note that precedence is unchanged.
6. **Reversal path.** Reverting is a code revert: the new row becomes unreachable, no persisted state or
   document is migrated, and documents written by the new path remain valid because they encode the same
   fold value the old path would eventually have written.

## Verification Criteria

- Metric: mirror equality after every transition combination (complete, re-complete, reopen, reopen then
  re-complete, absent phase) — Target: 100% — Window: GH-349 CI.
- Metric: no-op evidence freshness — an already-converged completion reports the latest completion —
  Target: exact — Window: GH-349 CI.
- Metric: divergence detection — a hand-edited completion yields `lint.phases.divergent` naming the
  phase, and a document-only completion is not flagged — Target: ≥1 case each — Window: GH-349 CI.
- Metric: read-only detection — zero document writes, zero fence acquisitions, zero appends on every
  divergence fixture — Target: exact — Window: GH-349 CI.
- Metric: corpus stability — zero new findings across the acceptance corpus — Target: 0 — Window: GH-349
  CI (a non-zero count is investigated, not suppressed).
- Metric: binding integrity — machine and documented lint tables agree and every row is reachable —
  Target: exact — Window: GH-349 CI.

## Confidence Rating

**High** for the defect, the fold semantics, and the detection home: the earliest/latest mismatch, the
document's completion-only staging, the read-only lint contract, and the absent cross-surface check are
all verified in the delivered source. **Medium-High** for the corpus outcome (it is an assumption that
existing documents were command-written) and for whether a reader will accept the document-only
exclusion; both are handled by measuring first and recording the boundary rather than widening the rule.

## References

- GH-349 clarify-scope facts and the F4 position:
  `doc/changes/2026-11/2026-11-18--GH-349--merge-closeout-queue-repair/chg-GH-349-pm-notes.yaml`
- M4 blueprint §M4-S11 (`doc/planning/oss-tooling/milestones/m4/backlog.md`), F4 bar
  (`doc/planning/oss-tooling/milestones/m4/flip-plan.md:118`)
- Current truth: `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md`,
  `doc/spec/features/feature-result-contract.md`,
  `doc/spec/features/feature-verify-change-and-exit-taxonomy.md`,
  `doc/spec/features/feature-capsule.md`
- Delivered source: `packages/core/src/state/registry.ts`,
  `packages/cli/src/commands/phase.ts`, `packages/cli/src/commands/lint.ts`,
  `packages/core/src/contracts/pm-notes.ts`, `packages/adapters/src/file/pm-notes-parser.ts`
- Prior decisions: [TDR-0031](TDR-0031-engine-first-evaluation-surfaces.md),
  [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md),
  [PDR-0005](PDR-0005-milestone-first-planning-and-delivery.md) (signal-precision reasoning reused for
  the corpus bound)
