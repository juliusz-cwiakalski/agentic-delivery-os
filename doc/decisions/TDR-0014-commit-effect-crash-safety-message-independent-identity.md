---
ados_distribution: project-generated
id: TDR-0014
decision_type: tdr
status: Proposed
created: 2026-11-07
decision_date: null
last_updated: 2026-11-07
summary: "Commit external-effect crash safety rests on a message-independent identity — a pre-commit `outbox.effect` carrying `baselineHead`, `changeRef`, `phase`, and the sorted normalized staged path set, matched on recovery by exactly one new commit from a bounded `logSince(baselineHead)` read whose changed-path set equals the recorded set; the effect owner is the lane/one-shot process (the daemon only records a durable redrive request with the discovered SHA or `unknown`), and zero/multiple/ambiguous/unreadable matches resolve to `unknown` with no automatic re-apply."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os external-effect protocol and commit primitive integration
decision_scope: repo
review_date: null
business_impact: "Restores a truthful crash-safety claim for the only production external effect in the resident daemon change without degrading commit-message quality or letting the supervisor write history."
customer_impact: "A daemon kill between a landed commit and its phase record no longer duplicates commits or silently loses the phase's commit binding."
classification:
  domains: [architecture, tooling, reliability]
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
  driver: "@pm (GH-238 DoR iteration 2 routed N-01/N-02/N-07; delegated to @decision-advisor)"
  decider: "Juliusz Ćwiąkalski — acceptance pending at the GH-238 PR review; PM-fixed positions recorded here for delivery unblock (TDR-0012 precedent)"
  contributors:
    - "@readiness-reviewer (GH-238 readiness iteration 2, findings N-01, N-02, N-07)"
    - "@spec-writer (chg-GH-238-spec F-9/F-10, DEC-4, DEC-15)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-238 PR review)"
  performers:
    - "@spec-writer (fold the invariant into F-9/F-10 and the ACs)"
    - "@test-plan-writer (re-derive identity oracles from the production mechanism)"
    - "@plan-writer (declare the additive read, the wrapper, and the phase evidence contract)"
    - "@coder (delivery per spec)"
  informed:
    - "M1-S9 (GH-239 dispatch loop) — inherits the effect-owner boundary"
    - "Commit primitive owner (M1-S14 / GH-227)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The commit primitive gains a declared pre-commit resolution step or discloses its computed staging plan in its outcome: the recorded path set can then come from the primitive itself, and the wrapper's earlier tree read (and its TOCTOU residual) should be re-examined."
  - "Operators report false `unknown` outcomes from working-tree drift between the wrapper's pre-read and the act's read: revisit by sourcing the recorded set from the primitive instead of a wrapper read."
  - "A second external-effect write adapter (tracker write, VCS write) adopts this protocol with a different query shape: keep the intent/query/verdict rule general and do not fork a per-adapter identity rule."
  - "Branch movement around the crash window becomes routine (multiple writers, worktrees, rebases mid-phase): revisit the exactly-one-new-commit rule, the read cap, and the ancestry requirement."
  - "M1-S9 delivers the dispatch loop and changes which process owns a phase completion: re-confirm the owner rule against the delivered owner."
links:
  related_changes: ["GH-238", "GH-227"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-07--GH-238--resident-dispatch-daemon/chg-GH-238-spec.md"
    - "doc/spec/features/feature-commit-primitive.md"
    - "doc/spec/features/feature-state-layer.md"
  contracts:
    - "packages/core/src/contracts/commit.ts"
    - "packages/adapters/src/git/commit.ts"
  diagrams: []
  decisions: ["TDR-0008", "ADR-0003"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S18", "M1-S9"]
---

# TDR-0014: Commit External-Effect Crash Safety — Message-Independent Identity, Effect Owner, and Check-Before-Reapply

## Context

- **FACT:** GH-238 (M1-S18) delivers the external-effect protocol: `outbox.effect` intent records, `command.receipt` outcome records, a first-class `unknown` state, and query-based check-before-reapply over injected effect ports (`chg-GH-238-spec` F-10, DEC-4, DEC-15, EVT-7, DM-11). Commit is the only production effect kind in this change; tracker effects are exercised against injected adapters.
- **FACT:** The commit half invokes the delivered commit primitive unchanged (`feature-commit-primitive.md`; `packages/core/src/domain/commit-act.ts`). The act computes the staging set from a tree read, runs the deterministic safety pass, builds the model bundle, resolves the message, stages, creates the commit object, appends the transition record, then emits telemetry.
- **FACT:** Message resolution is not deterministic on the production path. The primitive tries core inference, then a harness one-shot, then a deterministic template; the model call is schema-constrained at `COMMIT_TEMPERATURE = 0.1` with one validation-feedback retry and sanitization (`packages/core/src/contracts/commit.ts:85`; `commit-act.ts` `resolveMessage`). The resulting subject and body cannot be known before the act returns.
- **FACT:** The act's landing order is commit object → transition append → telemetry append. A failed commit object or a failed transition append resets the checkout to `request.baselineHead`; a killed process performs no reset (`commit-act.ts` `runCommitAct`).
- **FACT:** The crash window is therefore structural: after `git commit` succeeds and before the transition append lands, the repository holds a real commit while the state layer holds neither a transition record nor a `commit.telemetry` event. Both durable evidence sources the delivered re-run convergence reads are absent in that window (`feature-commit-primitive.md` §Re-run convergence).
- **FACT:** In that window a re-run cannot classify `commit-without-record`. With a clean working tree it lands a record-only completion and the phase's commit binding is lost; with leftover pending work it creates a second commit for the same phase. Neither outcome is visible as a failure.
- **FACT:** `CommitGitPort` declares `readTree`, `stage`, `commit`, `head`, `resetTo`, and `commitExists` — no log read (`packages/core/src/contracts/commit.ts:316`). `createGitCommitSeam` is the only production implementor (`packages/adapters/src/git/commit.ts:153`), and no `logSince` implementation exists in the tree.
- **FACT:** The daemon is a supervisor, never a lane: it does not read repository code, run a phase, write a commit, or evaluate a gate (F-9, AC-F9-1, TC-LANE-002). Its reconciliation duty is detection and recording, not application.
- **FACT:** The GH-238 ticket pins, as a binding decision, that commits are "additionally protected structurally by M1-S14 atomicity and SHA idempotency". The delivered primitive supplies atomicity; it supplies no SHA idempotency, and no pre-commit deterministic identity exists on the model-message path.
- **FACT:** GH-238 readiness iteration 2 recorded N-01 (the identity is not derivable pre-commit), N-02 (undefined effect owner and no transition-recovery path), and N-07 (the ticket-pin divergence has no system decision record). The PM fixed the mechanism class in `chg-GH-238-pm-notes.yaml` (2026-11-08): message-independent identity for N-01, owner = lane/one-shot for N-02.

## Problem Framing (Clarified)

Two questions have to be answered together, because either alone leaves the crash window open:

1. **What durable pre-commit fact is sufficient to decide, after a crash, whether this specific commit landed?** The fact must exist before the commit object does, must survive an arbitrary kill, and must not depend on anything the primitive produces during resolution. The message is disqualified: on the model path it is decided inside the act, and a template-forced message is a different product decision.
2. **Which process is allowed to act on that fact?** The process that finds the crash residue is the daemon, but the daemon is a supervisor that must not write history. The process that owns the phase completion is gone. Recovery therefore splits into detection (daemon) and application (owner), and the transition binding has to be restorable from the detected commit rather than from a re-created one.

The failure modes to prevent are concrete. A recorded identity the landed commit cannot match makes recovery re-apply and duplicate the commit (the failure the original pin was meant to close). A recovery path that treats "no match" as "nothing landed" turns an unreadable or moved history into a duplicate commit or a lost binding. Letting the daemon apply turns the supervisor into an effect owner and breaks the F-9/import-boundary contract that M1-S9 will inherit. Silently degrading to record-only loses the phase's commit SHA, so the phase's durable evidence says the work landed without a commit.

Desired outcomes: the crash window is closed on the production message path; the delivered commit primitive and its message quality are unchanged; the daemon stays a supervisor; ambiguity is durable and visible instead of being resolved by a guess; and the rule is stated precisely enough that the spec, test plan, and plan can assert the same thing.

Out of scope: changing the commit primitive's message composition, ordering, or format; tracker/VCS write adapters; the M1-S9 dispatch loop; state-engine storage mechanics; and human-facing UI for resolving `unknown` beyond the existing status surfaces.

## Constraints (Hard Requirements)

### C-1: At most one commit object per commit effect

- **Statement:** For one commit-effect idempotency key, the protocol creates at most one commit object; a recovery that matches an already-landed commit creates none.
- **Source:** AC (GH-238 AC-F8-4 "zero duplicated commits"; NFR-15)
- **Verification:** test (crash-recovery and duplicate-path fixtures)
- **Negotiable:** no

### C-2: The identity is derivable before the commit is invoked, on every message path

- **Statement:** The recorded identity is computed from data the wrapper holds before it invokes the commit primitive, and the same rule applies whether the act resolves the message by model or by template.
- **Source:** AC (GH-238 AC-F10-2 under this record; readiness N-01)
- **Verification:** test (a model-path fixture whose message no template would produce) + code review
- **Negotiable:** no

### C-3: Ambiguity is fail-closed

- **Statement:** Any outcome other than exactly one matching commit — zero matches, multiple matches, a path-set mismatch, an unreadable or over-cap read, an unplaceable baseline — leaves the effect `unknown`; the protocol never re-applies and never records a guessed SHA on that outcome.
- **Source:** AC (GH-238 F-10 check-before-reapply; NFR-15) + PM decision on N-01
- **Verification:** test (four negative controls: zero, multiple, mismatch, unreadable)
- **Negotiable:** no

### C-4: The daemon is never the effect owner

- **Statement:** No daemon code path creates a commit, runs a phase, or appends a phase transition; the owning lane/one-shot process applies and restores the binding.
- **Source:** AC (GH-238 F-9, AC-F9-1) + internal standard (daemon import boundary)
- **Verification:** test (structure/import boundary) + code review
- **Negotiable:** no

### C-5: The delivered commit primitive and its message composition are unchanged

- **Statement:** The act's message composition (model path plus template fallback), commit format, and landing order (commit object → transition append → telemetry) are unchanged; the only contract addition is one bounded read on the git port.
- **Source:** prior decision (GH-238 PM decision on R-02: "does not change M1-S14's commit format or atomic record-plus-commit primitive") + ADR-0003 (contracts tier is types and `as const` data)
- **Verification:** code review + contract inventory + typecheck
- **Negotiable:** no

### C-6: Intent before effect, and no free-form content in the intent

- **Statement:** The `outbox.effect` intent is durable before the commit primitive is invoked, and it carries identity and a payload digest — never a message, subject, body, or message fingerprint.
- **Source:** AC (GH-238 F-10 ordering; DM-10 payload-digest rule)
- **Verification:** test (ordering assertion; record-shape assertion)
- **Negotiable:** no

### C-7: The recovery read is bounded

- **Statement:** The recovery read is capped at a declared maximum; exceeding the cap or failing to read yields `unknown`, never a blind retry.
- **Source:** AC (GH-238 NFR-4 bounded work; Appendix "Commit log window")
- **Verification:** test (over-cap and read-failure fixtures)
- **Negotiable:** no

> **Table stakes:** the `outbox.effect`/`command.receipt` record shapes, the effect state machine (`accepted` → `in-flight` → `applied` | `failed` | `unknown`), the state-layer fence, the delivered four-state convergence vocabulary, and the commit primitive's atomic pair are unchanged. Acknowledged once for all alternatives.

## Decision Drivers

1. **Truth on the production path** — the crash-safety claim must hold where commits are actually made, including the model message path, not only where the message is derivable.
2. **Preserve the delivered commit primitive** — no forked message path, no lost model message quality, no change to the atomic act that other callers rely on.
3. **Owner honesty** — the supervisor stays a supervisor; the process that owns the phase owns the effect; M1-S9 inherits a coherent boundary rather than an exception.
4. **Determinism and testability** — the identity is computed from durable data, and a test can break the derivation (not only the query) and observe the failure.
5. **Additive, reversible surface** — one bounded read, one record field set, no migration; reversal stays a data/shape edit.
6. **Fail-safe ambiguity** — when evidence is inconclusive the protocol stops and says so; a human decision is cheaper than unwinding a duplicated commit.
7. **Solo-maintainer cost** — one match rule, one read, no new daemon machinery, no per-adapter improvisation.

## Decision Rights (DACI)

- **Driver:** `@pm` — routed N-01/N-02/N-07 from the GH-238 readiness gate and delegated the record to `@decision-advisor`; `@decision-advisor` analyzed and authored it.
- **Decider / Approver:** Juliusz Ćwiąkalski — the one accountable human authority. The positions recorded here are PM-fixed under that delegation to unblock GH-238 delivery; **acceptance is pending at the GH-238 PR review.** The record stays `Proposed` with `decision_date: null` until the owner accepts.
- **Contributors:** `@readiness-reviewer` (the three findings and the delivered-code evidence), `@spec-writer` (F-9/F-10, DEC-4/DEC-15), `@decision-advisor` (analysis, record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` during delivery; the human owner at PR review.
- **Performers:** `@spec-writer` folds the invariant into F-9/F-10 and the ACs; `@test-plan-writer` re-derives the oracles from the production mechanism; `@plan-writer` declares the additive read, the wrapper, and the phase evidence contract in phase scope; `@coder` delivers.
- **Informed:** M1-S9 (GH-239) and the commit-primitive owner (GH-227).
- **Timing and escalation:** recorded during GH-238 DoR remediation, before delivery tasks execute; implementation may proceed with acceptance pending (TDR-0003/TDR-0004/TDR-0006 precedent). Disagreement about the identity rule or the owner boundary escalates to the owner; it is not resolved by a delivery-phase edit.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The commit act resolves the message through an ordered transport seam, with a schema-constrained model call at temperature `0.1` plus one validation-feedback retry and a template fallback. | FACT | `packages/core/src/domain/commit-act.ts` (`resolveMessage`); `packages/core/src/contracts/commit.ts:85`; `doc/spec/features/feature-commit-primitive.md` §Message generation | A message-derived identity would be viable and the message-independent rule would be unnecessary rigor | High |
| The landing order is commit object → transition append → telemetry append; a kill in between leaves no record and no telemetry event. | FACT | `commit-act.ts` `runCommitAct` (read 2026-11-07) | A re-run could classify `commit-without-record` from telemetry and the delivery-window argument weakens | High |
| The delivered re-run convergence is total over (transition record × commit evidence) and has a `commit-without-record` row that appends the transition carrying a known SHA. | FACT | `doc/spec/features/feature-commit-primitive.md` §Re-run convergence | The binding-restoration step would need a new convergence row rather than reuse | High |
| `CommitGitPort` has exactly six members and no log read; `createGitCommitSeam` is the only production implementor; no `logSince` exists. | FACT | `packages/core/src/contracts/commit.ts:316`; `packages/adapters/src/git/commit.ts:153`; repository search | The additive read would already exist or need a different owner | High |
| The wrapper can compute the staged path set pre-commit with the delivered pure staging computation over a tree read and the same scope request the act receives. | FACT | `computeStagingPlan` is pure over tree facts plus scope; `runCommitAct` computes it the same way | The path-set half of the identity would not be available pre-commit and ALT-3 would become necessary | High |
| The daemon must not read repository code, run a phase, write a commit, or evaluate a gate. | FACT | `chg-GH-238-spec` F-9, AC-F9-1; TC-LANE-002 | A daemon-owned re-apply would be permitted and the two-process split unnecessary | High |
| The GH-238 ticket pins "SHA idempotency" as a binding mechanism for commits. | FACT | Ticket GH-238 pinned decisions; `chg-GH-238-spec` Appendix G, §24 | The supersession section would overreach | High |
| `git log --no-renames --name-only <baseline>..HEAD` behind the existing local child-runner seam reports a deterministic changed-path set per commit. | TO-CONFIRM | Implementation detail; proven by recorded fixtures at delivery | The read shape (or rename representation) changes; the match rule stays the same | Medium-High |
| The read cap is large enough for real branch movement between a phase intent and its recovery. | ASSUMPTION | Phase completions land one commit on a locally owned branch | Over-cap becomes a frequent `unknown`; the cap is tuned without changing the rule | Medium |
| The working tree does not change between the wrapper's pre-read and the act's read (no concurrent writer, no hook writing files during the act). | ASSUMPTION | Single-writer local workflow; the state layer's fence does not cover the working tree | The match fails closed to `unknown`; false-`unknown` rate rises (residual below) | Medium |
| Commit effects are the only production external effect in GH-238; tracker effects are query-by-id over injected adapters. | FACT | `chg-GH-238-spec` DEC-4, AC-F10-3, RSK-9 | The owner/read rule would have to generalize immediately | High |

## Mental Models & Techniques Used

- **First principles:** what is the minimum durable fact that makes "did this commit land?" answerable after a kill? A baseline plus the exact set of paths the commit was about to change. Both exist before the message does.
- **Inversion:** how would this still duplicate a commit? Record an identity that cannot match (message-derived), treat absence as "not landed", or let an unsupervised process apply. Each is excluded by C-2, C-3, and C-4 respectively.
- **Second-order thinking:** declaring zero-match `unknown` converts a rare crash-only duplicate into an operator confirmation loop. That trade is deliberate: a durable, visible stop is recoverable; a rewritten history is not.
- **Fail-safe defaults:** the read's inability to prove anything is a verdict (`unknown`), not a permission to act.
- **Reversibility asymmetry:** the additive read is cheap to change; an automatic re-apply that lands a duplicate is socially and technically expensive to unwind. The cheap side gets the automation.
- **KISS / least mechanism:** paths and a baseline instead of a message, a digest, or a new primitive phase; one bounded read instead of a shadow index of commits.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 no duplicate | C-2 pre-commit derivable | C-3 fail-closed | C-4 daemon not owner | C-5 primitive unchanged | C-6 intent first | C-7 bounded read | Eligibility |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| ALT-0 do nothing (ticket pin as written) | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | Not eligible |
| ALT-1 template-only message | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Not eligible |
| ALT-2 message-independent path-set identity (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Eligible |
| ALT-3 deterministic pre-commit resolution in the primitive | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Not eligible |
| ALT-4 daemon-owned re-apply | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | Not eligible |

Legend: ✅ passes · ❌ fails. No alternative takes an accepted-risk exception, because every constraint is `negotiable: no`.

### Alternative 0 — Do Nothing / Keep the Ticket Pin's "SHA Idempotency" Claim

- **Eligibility:** Not eligible (fails C-1, C-2, C-3, C-6).
- **Summary:** Ship the external-effect records for tracker shapes, keep the commit half on the delivered atomic act plus the existing re-run convergence, and rely on the ticket's stated "SHA idempotency".
- **Constraint compliance:** No identity exists to record before the commit (C-2, C-6), so the crash window has no durable pre-commit fact and no query is possible (C-3). With a clean tree the re-run lands record-only and loses the binding; with leftover work it lands a second commit (C-1).
- **Driver fit:** Worst on driver 1 — the claim would be false exactly where commits are made.
- **Pros:** No new port member, no new record fields.
- **Cons:** The pin's mechanism claim remains untrue; the failure is silent in both directions; M1-S9 would inherit a convergence contract that does not cover the window.
- **Why rejected:** It preserves a claim the delivered code cannot honor. The pin's intent (no duplicate, no lost commit) is what matters, not its mechanism.

### Alternative 1 — Template-Only Message for Effect Commits

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Compose effect commits through the deterministic template only — no inference route — so the expected subject is computable before the commit and can be recorded and matched.
- **Constraint compliance:** The identity becomes derivable (C-2) and the query works (C-3), but forcing the template changes the primitive's message composition and silently removes model commit messages from every daemon/lane commit (C-5).
- **Driver fit:** Fails drivers 2 and 4; the commit history of the dogfooding repository degrades for a crash-safety property.
- **Pros:** Smallest conceptual change; the template path already exists and is deterministic.
- **Cons:** A product-visible regression in commit quality; the template's subject falls back to the first staged path when no plan summary is supplied, so the "deterministic" identity is only reproducible if the wrapper reproduces the same fallback inputs; the change is invisible to every other caller of the primitive.
- **Why rejected:** It pays for crash safety with the commit primitive's message quality and requires a primitive behavior change outside this decision's scope.

### Alternative 2 — Message-Independent Path-Set Identity (selected)

- **Eligibility:** Eligible (C-1…C-7).
- **Summary:** Record `baselineHead`, `changeRef`, `phase`, and the sorted normalized staged path set in the `outbox.effect` intent before the act runs. On recovery, read commits after the baseline once, bounded; resolve `applied` only for exactly one new commit whose changed-path set equals the recorded set; leave everything else `unknown`. The owner restores the transition binding from the discovered SHA.
- **Constraint compliance:** Passes all; see the attestation.
- **Driver fit:** Best on every driver: true on the model path (1), primitive untouched (2), daemon detects only (3), derivation testable from durable data (4, and a test can break the derivation), one additive read (5), ambiguity fail-closed (6), one rule (7).
- **Pros:** No message dependence; the identity exists before the effect; the daemon's role stays a query plus a record; `unknown` is durable and visible; the read is additive and reversible.
- **Cons:** The identity is coarser than a message fingerprint, so a commit that stages a different path set is indistinguishable from "not ours" (it resolves `unknown`, which is the safe answer); a pre-read/act-read race can produce a false `unknown`; operator confirmation is required for `unknown`.
- **Why chosen:** See Decision.

### Alternative 3 — Deterministic Pre-Commit Resolution Inside the Primitive

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Add a declared pre-commit step to the primitive that resolves and returns the message (or a stable fingerprint of it) before the commit object is created, so the wrapper can record and match it.
- **Constraint compliance:** The identity is derivable (C-2) and bounded (C-7), but the act's contract and ordering change: the primitive either holds a resolved message across a crash boundary or performs resolution twice (C-5).
- **Driver fit:** Good on driver 1, poor on 2 (primitive contract churn), 4 (a fingerprint still depends on model output bytes), and 5 (not additive).
- **Pros:** The strongest identity available; the message and the identity are known to refer to the same resolution.
- **Cons:** A primitive change that GH-238 explicitly excludes; a resolved message held in memory is lost on the kill that matters; re-resolution after a crash can produce a different message, so a recorded fingerprint would not match anyway.
- **Why rejected for now, recorded permanently:** It is the right shape only if the primitive ever needs a pre-commit resolution for its own reasons; the first revisit trigger names it. Deferral carries no cost because the path-set identity is already sufficient.

### Alternative 4 — Daemon-Owned Detection and Re-Apply

- **Eligibility:** Not eligible (fails C-4; C-3 fails disqualifyingly, C-1 in the duplicate path).
- **Summary:** Give reconciliation the re-apply: on a re-drive, the daemon queries and, on no match, invokes the commit path itself (or appends the transition directly).
- **Constraint compliance:** Fails C-4 outright — the daemon becomes an effect owner, reads repository state, and writes history. The zero-match re-apply also violates C-3 as decided.
- **Driver fit:** Fails driver 3 completely; the F-9 supervisor contract and the daemon import boundary both break.
- **Pros:** One process handles recovery; no owner handoff protocol.
- **Cons:** The supervisor writes commits, which is the exact boundary F-9 and the daemon's merge-absence/import rules exist to hold; the daemon would also need the commit primitive's staging semantics, duplicating the primitive's job in the daemon composition.
- **Why rejected:** It is the precedent failure this record exists to prevent.

## Decision

- **Decision:** **ALT-2, with the lane/one-shot process as the effect owner.** The commit-crash-safety contract is the following invariant set. The spec, test plan, and plan cite these identifiers verbatim (`TDR-0014 INV-n`); they are the contract, not implementation guidance.

  1. **INV-1 — Intent before effect, one intent per commit effect.** Before the commit primitive is invoked, exactly one `outbox.effect` record (`effectKind: commit`, `checkStrategy: query-by-log-since`) is durable. It carries `effectId`, `intentId`, `idempotencyKey`, `changeRef`, `phase`, `baselineHead`, and the sorted normalized staged path set, plus a payload digest. It carries no message, subject, body, or message fingerprint. `baselineHead` is the single HEAD read the wrapper uses for both the intent and the act's reset baseline; if HEAD cannot be read, no effect starts and the primitive is not invoked.
  2. **INV-2 — The identity is message-independent.** No recorded identity, match input, or match rule reads the commit message or any model output. The identity is (`baselineHead`, `changeRef`, `phase`, normalized staged path set). The idempotency key is derived deterministically from (`changeRef`, `phase`, `baselineHead`) with no clock, randomness, or model output; every re-drive of that effect reuses the recorded key verbatim, and no code path mints a second key for the same attempt.
  3. **INV-3 — The staged path set is a pre-commit computed fact.** The wrapper records the set the act is about to stage, computed with the delivered pure staging computation over a tree read and the same scope request the act receives. Normalization: repo-relative paths, `/` separators, no leading `./`, deduplicated, sorted. Only paths are recorded, never content.
  4. **INV-4 — One bounded read.** Recovery reads commits after the recorded baseline through exactly one additive `CommitGitPort.logSince(baselineHead)` read: capped at a declared maximum, ordered, returning each commit's SHA and normalized changed-path set with a deterministic rename representation (a rename contributes its delete and add paths, not a rename-detection heuristic). The read is a read; it changes no ref and writes nothing.
  5. **INV-5 — Match rule.** The effect resolves `applied` only when the read yields **exactly one** commit after the baseline **and** that commit's normalized changed-path set equals the recorded set. The receipt records `already-applied` with the discovered SHA. A matched effect creates no second commit.
  6. **INV-6 — No silent re-apply.** Zero new commits, more than one new commit, a path-set mismatch, an unreadable or over-cap read, or a baseline that cannot be placed in HEAD's ancestry leaves the effect `unknown`. `unknown` is durable and visible; the protocol neither re-applies nor records a guessed SHA, and no automatic path converts `unknown` into an apply. Resolution is an explicit owner decision.
  7. **INV-7 — Owner rule.** The daemon detects the effect, performs the bounded query, and records the durable redrive request — the discovered SHA or `unknown` — through the state layer. The daemon never creates a commit, runs a phase, or appends a transition. The lane/one-shot process that owns the phase completion applies and restores the binding.
  8. **INV-8 — Binding restoration uses the receipt, not a new commit.** The owner restores the phase-transition binding by re-running phase completion with the receipt's discovered SHA as commit evidence: the delivered convergence classifies `commit-without-record` with that SHA and appends the transition carrying it with durable intent `atomic`. No commit is created and no second effect is appended; a phase recovered this way reads `both`, never `record-only`.

  Restated as the single contract sentence: **intent before effect; one `outbox.effect` per commit effect with a stable idempotency key; a bounded `logSince(baselineHead)` read; `applied` only for exactly one new commit whose normalized changed-path set equals the recorded set; `unknown` for everything else with no automatic re-apply; and no daemon commit, phase run, or transition append — the lane/one-shot owner applies and restores the binding.**

- **Rationale (tied to drivers):** The identity must exist before the message does, and the only durable facts that satisfy that are the baseline and the path set. That makes the property true on the model path (driver 1) without touching the primitive (driver 2). Splitting detection from application is what keeps the supervisor a supervisor (driver 3), and it matches the delivered separation already coded in the daemon's F-9 boundary. The rule is assertable: a test can break the derivation by recording one path fewer and observe `unknown`, which a message-fingerprint design cannot do without a model (driver 4). The surface is one additive read on a port that already owns the child-runner seam (driver 5). Declaring zero-match `unknown` is the deliberate cost (driver 6): a duplicate commit is the one outcome the pin promised would never happen, so the protocol stops instead of guessing. And there is exactly one rule to maintain (driver 7).

- **Decider:** Juliusz Ćwiąkalski — acceptance pending at the GH-238 PR review; not claimed by this record. Positions PM-fixed under the delegated change-scoped authority for delivery unblocking.

- **Conditions for revisit:** See `revisit_triggers`; the primary ones are a primitive-level pre-commit resolution, measured false-`unknown` from working-tree drift, a second write adapter adopting the protocol, and M1-S9 defining the delivered owner.

### Supersession of the GH-238 Ticket Pin

This record **supersedes the GH-238 ticket's binding mechanism claim** that commits are "additionally protected structurally by M1-S14 atomicity and SHA idempotency":

- **What is preserved:** the pin's intent — a commit effect never duplicates a commit and never silently loses a landed commit's binding — is preserved and is what INV-1…INV-8 make true.
- **What is replaced:** "SHA idempotency" as a mechanism. The delivered primitive provides atomicity (commit object and transition record land together or the checkout resets) but no SHA idempotency, and no pre-commit commit identity exists on the model-message path. The mechanism is replaced by the message-independent path-set identity plus the bounded read.
- **What follows for the artifacts:** `chg-GH-238-spec` DEC-4/DEC-15, F-10, AC-F10-2, EVT-7, DM-10/DM-11, and Appendix I must state this contract rather than an "expected subject plus body fingerprint", and §24's claim that DEC-1..DEC-4 reproduce the ticket's binding decisions in intent must be corrected to name this record as the supersession. The GH-238 pm-notes carry the corresponding acknowledgement.

### Constraint Compliance Attestation

The chosen alternative satisfies every constraint and takes no accepted-risk exceptions:

- **C-1** — the match rule resolves an already-landed commit without creating one, and a fresh attempt is preceded by its own intent; the negative-control suite proves a duplicate requires breaking either the derivation or the query (INV-5, INV-6, INV-8).
- **C-2** — the identity is baseline plus path set, both computed before the act on both message paths (INV-2, INV-3).
- **C-3** — every inconclusive outcome is `unknown` with no automatic apply (INV-6).
- **C-4** — the daemon only queries and records; application and binding restoration belong to the lane/one-shot owner (INV-7, INV-8).
- **C-5** — the primitive's message composition, format, and landing order are untouched; the only addition is one read on the git port (INV-4).
- **C-6** — the intent is durable before the act and carries a digest, never message content (INV-1).
- **C-7** — the read is capped, and over-cap or unreadable is `unknown` (INV-4, INV-6).

## Trade-offs & Consequences

### Positive Outcomes

- The crash window is closed on the path the product actually uses; the claim no longer depends on the message being derivable.
- Model commit messages remain available to every commit, including daemon/lane commits, so the crash-safety property is not bought with commit-history quality.
- The daemon stays a supervisor with a single new duty (query and record), so F-9, AC-F9-1, and the daemon import boundary stay true without an exception.
- Ambiguity is durable, visible, and attributable: an `unknown` effect names the baseline and the expected path set, so an operator can inspect the branch and decide.
- The identity is testable by breaking the derivation, which is the negative control the previous design could not express.
- M1-S9 inherits a stated contract (identity, owner, restoration) instead of a change-local note.

### Negative Outcomes

- **False `unknown` from working-tree drift.** If the tree changes between the wrapper's pre-read and the act's read (a hook writing files, a formatter, a concurrent edit), the landed path set differs from the recorded set, the match fails, and the effect stays `unknown`. This is fail-safe but operator-visible; the remedy is inspection and an explicit decision, or the primitive-disclosed staging plan named in the revisit triggers.
- **A legitimate partial-stage commit is indistinguishable from "not ours".** The path-set rule is exact; a subset or superset resolves `unknown`. That is correct under INV-6 but means recovery cannot auto-resolve a commit that staged differently than planned.
- **Operator confirmation loop.** A crash at exactly the wrong moment now requires a human decision instead of an automatic apply. Accepted deliberately; the crash is rare and the alternative risks duplicated history.
- **Two-process recovery.** Detection (daemon) and application (owner) are separate, so an `unknown` or `applied` redrive request is only actionable when the owning process next runs. The state record makes the wait visible rather than silent.
- **A new port member widens a closed contract.** The additive read must be implemented by the one production seam and by every test double; that ripple is paid once.
- **Path normalization is a contract surface.** Separators, sorting, and rename representation must be stated and tested, or two implementations will disagree about equality.

### Unresolved Questions

- [ ] Pin the cap value and the read's exact argv/flags, and prove the rename representation with a recorded fixture (owner: `@spec-writer` + `@coder`, GH-238 delivery).
- [ ] Decide whether the receipt's SHA enters convergence through `readEvidence` as an additive evidence source or through an explicit owner-supplied value on the phase-completion path; either way INV-8 holds, but the artifacts must pick one (owner: `@spec-writer`, `@plan-writer`).
- [ ] Define how a durable redrive request with `unknown` is surfaced in `daemon status` / the status digest so the owner can find it without reading the ledger (owner: `@spec-writer`).
- [ ] Confirm the reopen case: a phase reopened and completed again is a distinct effect (different baseline) and must not collide with the earlier key (owner: `@test-plan-writer`).

## Implementation Plan

1. **Spec.** Fold INV-1…INV-8 into F-9/F-10, restate AC-F10-2 (identity and match rule; zero-match is `unknown`, not a re-apply), keep AC-F8-4's zero-duplicate claim, correct §13's determinism assumption, and record the ticket-pin supersession in §24 and Appendix G.
2. **Test plan.** Re-derive every identity oracle from the production mechanism rather than a fixture-supplied expectation; add a model-path crash fixture (a message no template would produce), the four negative controls (zero, multiple, mismatch, unreadable/over-cap), a derivation-break control distinct from the query-removal control, and a daemon-boundary control asserting no commit call is reachable from daemon paths.
3. **Plan.** Declare the additive read and its production implementor, the commit-effect wrapper, the phase-completion evidence contract, and `feature-commit-primitive.md` in phase scope and the doc-impact table (readiness N-02/N-04/N-06).
4. **Delivery.** Add the bounded `logSince` read over the existing child-runner seam; add the pre-commit intent and the message-independent matcher; add the daemon's redrive-request recording; restore the binding through the phase-completion evidence contract; keep the commit primitive's composition and ordering untouched.
5. **Doc sync.** Reconcile `feature-commit-primitive.md` (crash-window recovery, the additive read, the convergence evidence source) and the state-layer spec (the effect redrive request).

## Verification Criteria

- Metric: duplicated commits per commit-effect idempotency key — Target: 0 — Window: GH-238 recovery suite plus the duplicate-path control.
- Metric: automatic re-applies on an `unknown` verdict — Target: 0 — Window: the four negative controls (zero, multiple, mismatch, unreadable/over-cap).
- Metric: crash-window recovery on the model message path — Target: 100% resolve `applied` with the discovered SHA and a phase reading `both` — Window: the model-path crash fixture.
- Metric: negative controls that break the derivation and that remove the query — Target: both fail the convergence test — Window: GH-238 test suite.
- Metric: commit calls reachable from daemon code paths — Target: 0 — Window: structure/import-boundary test.
- Metric: effects resolved with a guessed or fabricated SHA — Target: 0 — Window: receipt-shape assertions plus review.
- Metric: contract surface — Target: typecheck and contract inventory green with one additive read and no primitive contract change — Window: CI.
- Process checkpoints: revisit confirmed when the commit primitive's contract changes and at M1-S9 delivery; the first retrospective after GH-238 implementation sets `review_date`.

## Confidence Rating

**High** for the mechanism: the crash window, the landing order, the message transport, and the absent log read were read directly in delivered source, and the binding-restoration path reuses a delivered convergence row. **Medium** for two implementation facts that do not change the rule: the exact `logSince` argv/rename representation and the cap value (`TO-CONFIRM` at delivery), and the false-`unknown` rate from working-tree drift (`ASSUMPTION`, bounded and fail-safe). AI-generated confidence is not evidence; the owner's acceptance at GH-238 PR review is the authoritative signal.

## References

- GH-238 change spec: `doc/changes/2026-11/2026-11-07--GH-238--resident-dispatch-daemon/chg-GH-238-spec.md` — F-9, F-10, AC-F8-4, AC-F9-1, AC-F10-1, AC-F10-2, DEC-4, DEC-15, EVT-7, DM-10, DM-11, §13, §24, Appendix G, Appendix I.
- GH-238 readiness iteration 2: `doc/changes/2026-11/2026-11-07--GH-238--resident-dispatch-daemon/readiness-review/readiness-iter-2.md` — N-01 (pre-commit identity), N-02 (effect owner and transition recovery), N-07 (decision capture and ticket-pin supersession).
- GH-238 PM decisions: `doc/changes/2026-11/2026-11-07--GH-238--resident-dispatch-daemon/chg-GH-238-pm-notes.yaml` — N-01 message-independent identity, N-02 owner = lane/one-shot (2026-11-08).
- Ticket GH-238 (M1-S18: Resident dispatch daemon) — pinned decisions, including the "M1-S14 atomicity and SHA idempotency" commit clause superseded here.
- Current-truth spec: `doc/spec/features/feature-commit-primitive.md` — message generation and transports, landing order, re-run convergence, telemetry.
- Delivered source: `packages/core/src/domain/commit-act.ts` (`resolveMessage`, `runCommitAct`); `packages/core/src/contracts/commit.ts` (`CommitGitPort`, `COMMIT_TEMPERATURE`); `packages/adapters/src/git/commit.ts` (`createGitCommitSeam`).
- [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) — additive-within-v1, record-governed contract extension discipline.
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — contracts tier is types plus `as const` data; port boundary rules.
- [TDR-0012](TDR-0012-blockers-credential-guard-pattern-deferral.md) — PM-fixed-positions/acceptance-pending governance precedent.
