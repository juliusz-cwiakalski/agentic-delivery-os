---
ados_distribution: project-generated
id: TDR-0015
decision_type: tdr
status: Proposed
created: 2026-11-08
decision_date: null
last_updated: 2026-11-10
summary: "Fix the durable operational semantics of the M1-S9 handover gate: class exposure is separate from clean/corroborated success; every attempt carries a declared evidence class and only pilot evidence counts for production handover; the window is incident-exclusive with a reported start reason; the floor is 20 counted dispatches or 7 consecutive UTC dates and binds only the floor; comparison is family-wise with an explicit not-applicable marker; repository identity is the normalized host/owner/name remote key with a persisted first-use marker or a clean refusal; handovers are per-repository, append-only, idempotent, and read through a fail-safe dual-run authority view."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os dispatch engine and per-repository handover gate
decision_scope: repo
review_date: null
classification:
  domains: [tooling, architecture, operations]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (routed from GH-239 readiness iteration 1, finding F9)"
  decider: "Juliusz Ćwiąkalski (owner; acceptance pending at the GH-239 PR review)"
  contributors:
    - "@readiness-reviewer (GH-239 readiness iteration 1, findings F1, F2, F3, F8, F9, F11)"
    - "@spec-writer (chg-GH-239-spec F-4/F-5/F-8, DEC-3, DEC-10, DEC-11, DEC-12, DEC-13)"
    - "@test-plan-writer (TC-TRUTH-003/006, TC-GATE-007/008/009, TC-HAND-006, TC-E2E-001)"
    - "@plan-writer (GH-239 phases 3, 4, 10)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-239 PR review)"
  performers:
    - "@spec-writer (fold these semantics into F-4/F-5/F-8, DM-1/DM-6/EVT-1, §7.1 glossary, §12 assumptions)"
    - "@test-plan-writer (re-derive the gate, window, comparison, identity, and reversal oracles)"
    - "@plan-writer (align phases 3, 4, 10 with the evidence-class and identity mechanics)"
    - "@coder (delivery per spec and plan)"
  informed:
    - "M1-S9 operational owners (first real per-repository handover)"
    - "GH-266 (amended M1-S9 bar / CEO-D-073)"
    - "Bash fallback maintainers (four entry points and the authority view)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A TDR-0005 token is added, removed, or remapped, or a token's derivation class changes: the coverage set, the comparison-family mapping, and the not-applicable set must be re-derived in the same change."
  - "A consumer needs class coverage to mean corroborated success rather than exposure: that reopens finding F1 and the gate-reachability constraint, and requires an owner decision, not a consumer-local reinterpretation."
  - "A production handover is blocked by a class that cannot be produced on a pilot path without manufacturing the condition: revisit the class-coverage definition or add a declared safe-exercise rule for that class."
  - "The controlled-proof E2E can no longer reach eligibility under its own evidence class, or a real repository identity collides with a controlled one: revisit the evidence-class scoping rule."
  - "Repository identity resolution changes (a new remote form, checkout-scoped binding, or cross-host authority): revisit the resolution order, the persisted marker, and the refusal behavior together."
  - "The checkout's git common directory layout changes, or the delivered VCS-remote normalization changes: revisit the checkout-scoped identity marker. The state layer changes its fence or derived-document replacement semantics: revisit the atomic authority-view replacement."
  - "A handover or reversal replay ever appends a duplicate record or produces a non-dual-run default from an unreadable view: reopen the idempotency and fail-safe rules."
links:
  related_changes: ["GH-239", "GH-266", "GH-233", "GH-279"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-08--GH-239--dispatch-engine/chg-GH-239-spec.md"
    - "doc/planning/oss-tooling/backlog.md"
    - "doc/changes/2026-11/2026-11-07--GH-266--evidence-based-handover-gate/chg-GH-266-spec.md"
    - "doc/changes/2026-11/2026-11-10--GH-279--dispatch-credential-preflight/chg-GH-279-spec.md"
  contracts:
    - "packages/core/src/contracts/delivery-result.ts"
    - "packages/core/src/contracts/queue.ts"
    - "packages/core/src/contracts/state.ts"
    - "packages/core/src/domain/queue-graph.ts"
  diagrams: []
  decisions: ["TDR-0005", "TDR-0010", "TDR-0014", "TDR-0020"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S9"]
---

# TDR-0015: Dispatch Handover Gate — Durable Operational Semantics

## Context

- **FACT:** The canonical M1-S9 story entry defines `clean` as a four-condition conjunction: zero false-success incidents and zero unresolved divergences on pilot paths; every TDR-0005 result class exercised on real tickets; an exposure floor of at least 20 dispatches or at least 7 consecutive days, whichever comes first, with that either/or binding only the floor; and corroboration from completed pm-notes phases, tracker state, and CI on the pushed head (`doc/planning/oss-tooling/backlog.md` §M1-S9, amended by GH-266 under owner directive `CEO-D-073 (GH-266, 2026-11-07)`).
- **FACT:** GH-239 (M1-S9) is the change that delivers the dispatch loop and the handover gate. Its spec refines the four-condition bar in DEC-10 (incident-reset window), DEC-11 (class coverage over the closed eleven tokens), DEC-12 (UTC day floor), and DEC-13 (repository identity), and restates the gate predicate in §5.1 F-5, §8.3 DM-7, and Appendix B (`chg-GH-239-spec.md`, read 2026-11-08).
- **FACT:** The same spec confines the gate to the change folder. The change folder is archived after delivery, while the gate governs every real per-repository handover long after. No `doc/decisions/**` record owns these semantics today.
- **FACT:** GH-239 readiness iteration 1 returned `NOT_READY` and routed the semantics here as finding F9, with five definitional roots: F1 (the gate is unreachable because `state-unverified` and `pr-open-unverified` cannot be clean/corroborated by definition), F2 (the attempt record cannot distinguish pilot from fixture/controlled-proof evidence, so the E2E proof cannot count), F3 (the incident-reset window's inclusivity is undefined, so recovery is impossible), F8 (a checkout-path digest is not rename-stable, contradicting DEC-13's rationale), and F11 (the family-wise comparison is undefined for `pr-open-unverified` and for dispatch-session tokens) (`readiness/readiness-iter-1.yaml`, read 2026-11-08).
- **FACT:** TDR-0005 adopts the closed eleven-token delivery-result vocabulary with one projection class and one derivation class per token; token-level parity is the dual-run comparison unit, and `state-unverified` deliberately projects to exit 2 (`packages/core/src/contracts/delivery-result.ts`; TDR-0005). The eleven tokens and derivation classes are: `merged`/`blocked`/`pr-open`/`pr-open-unverified` (`tracker-pr`), `failed`/`finished`/`state-unverified`/`partial` (`verify`), and `max-restarts`/`noop-lane-permission`/`noop-lane-nothing-to-do` (`dispatch-session`) — Appendix A of the spec.
- **FACT:** TDR-0010 ratifies the six-row dispatch-session projection and binds two consumer rules: `outcome` must be read beside any `partial`, and harness-path `noop-lane-permission` means spawn-refused, never a lane-permission verdict (TDR-0010). `noop-lane-nothing-to-do` is derived by dispatch outside the shared classifier (spec DEC-14).
- **FACT:** The scheduling engine already owns a deterministic repository-key normalizer: `normalizeRepositoryKey(remote)` strips protocol, credentials, userinfo, and a `.git` suffix, reduces the remote to `host/owner/name`, and lowercases it (`packages/core/src/domain/queue-graph.ts`). Queue entries, leases, parks, and incidents carry that `repository` value as their contention-domain identity (`packages/core/src/contracts/queue.ts`).
- **FACT:** The state layer can persist a store-managed artifact once and refuse to regenerate it silently: `ensureStoreArtifact` takes runtime-edge random material and `guardKinds`, and returns `state.keys.missing` when the artifact is absent while guarded records exist (`packages/core/src/contracts/state.ts`). The delivered identity marker instead lives with the checkout inside its git common directory, where a create-once file gives the same never-regenerate guarantee without binding the shared state scope (§6).
- **Trigger:** GH-239 delivery is blocked at the Definition-of-Ready gate until these system-wide gate semantics have an owner-visible durable record (readiness finding F9). The record must also resolve the gate-reachability, evidence-class, window, floor, comparison, identity, and reversal findings so the spec and test plan can be made jointly satisfiable before delivery.

## Problem Framing (Clarified)

The handover gate is not a change-local implementation choice. It decides when one repository's delivery authority moves from the bash stack to the typed engine, and it must remain readable and reproducible after the GH-239 change folder is archived. The real problem is therefore a definition problem: what exactly the four conditions range over, which records count, what a disagreement means for each token family, what identity a repository has across renames, and how authority is reversed without losing history.

The findings reduce to one root: the spec conflates three distinct facts that must be kept apart.

1. **Class exposure** — the classifier has produced a token at least once on a counted dispatch. This is an observation about coverage, not a claim that the run succeeded.
2. **Comparison agreement** — an independently derived token (or an explicit not-applicable marker) agrees with the engine's token. This is an observation about dual-run parity, not a success claim.
3. **Corroborated success** — a token that claims success is supported by the independent evidence its outcome family requires. This is the only place where "clean" is asserted.

F1 exists because `state-unverified` was forced into (3) even though it is by construction a statement that truth could not be read: it has no independent comparison, so it cannot be a success claim, and treating it as one makes the gate unsatisfiable. F11 exists because `pr-open-unverified` was compared at URL resolution granularity instead of tracker-state granularity, creating a permanent divergence. F2 exists because (1) was not scoped to a declared evidence class, so the controlled proof could never count. F3 exists because the incident reset was not defined as an exclusive lower bound. F8 exists because the fallback identity was a path digest, which is not rename-invariant.

The failure mode to prevent is a gate that is semantically strict but operationally unreachable, or one that is made reachable by quietly dropping a condition. Both destroy trust in the handover. The resolution is to keep every condition strict while defining each over the right fact and the right evidence population.

## Constraints (Hard Requirements)

### C-1: The gate must be reachable

- **Statement:** A controlled repository with all eleven TDR-0005 classes present among counted dispatches, zero incidents, zero unresolved divergences, the floor met, and every success claim corroborated must evaluate eligible. No class may by construction make eligibility impossible.
- **Source:** AC (`chg-GH-239-spec` AC-F8-1, AC-F5-2); readiness finding F1
- **Verification:** test (positive controlled-proof gate case and E2E case, including `state-unverified` and `pr-open-unverified`)
- **Negotiable:** no

### C-2: Closed vocabulary and projection unchanged

- **Statement:** The eleven tokens, their order, projection classes, derivation classes, and exits are unchanged; the TDR-0010 dispatch-session projection and its two consumer rules are unchanged; no new token or second vocabulary is introduced.
- **Source:** prior decision (TDR-0005, TDR-0010)
- **Verification:** structure test (taxonomy equality) + code review
- **Negotiable:** no

### C-3: Durable, owner-visible semantics

- **Statement:** The gate window, floor, class-coverage, comparison, identity, and reversal semantics live in a durable decision record that outlives the change folder and is accepted by the owner; the change spec may reference and apply them but may not be their only home.
- **Source:** internal standard (decision-records management); readiness finding F9
- **Verification:** audit (this record + the GH-239 spec's `links.decisions`)
- **Negotiable:** no

### C-4: Evidence provenance and production-counting integrity

- **Statement:** Every attempt record carries a declared evidence class; production handover counts only pilot-path evidence; a controlled-proof run counts only inside its own controlled repository scope; smoke and fixture evidence never counts. No evidence is hand-inserted into a ledger; fixture ports may supply external facts, but the command must produce the record.
- **Source:** AC (`chg-GH-239-spec` F-4, F-8, AC-F8-1); readiness finding F2
- **Verification:** test (provenance guard, counting rule, class-escalation negatives) + audit
- **Negotiable:** no

### C-5: Rename-invariant repository identity with clean refusal

- **Statement:** A repository's identity is stable across a checkout-path rename and across restarts. A path digest may not be presented as the authoritative fallback. When identity cannot be resolved, the gate refuses cleanly; it never reports an empty success.
- **Source:** AC (`chg-GH-239-spec` AC-F6-2, AC-F5-4); readiness finding F8
- **Verification:** test (rename both directions, marker reuse, unresolvable-identity refusal)
- **Negotiable:** no

### C-6: Reversible, idempotent, isolated authority with a fail-safe default

- **Statement:** Authority flips and reversals are per repository, append-only, history-preserving, and idempotent on replay; the authority view is derived from the ledger and any absent, unreadable, or malformed view resolves to `dual-run`.
- **Source:** AC (`chg-GH-239-spec` AC-F6-2, AC-F6-3, AC-F6-4, AC-F7-3, NFR-6)
- **Verification:** test (isolation, replay, unreadable-view fallback)
- **Negotiable:** no

### C-7: The gate is the amended evidence-based bar, not a calendar window

- **Statement:** Eligibility is defined by incident/divergence truth, class coverage, the exposure floor, and corroboration; a rolling calendar window (or any elapsed-time-only proxy) does not define the gate.
- **Source:** prior decision (`CEO-D-073 (GH-266, 2026-11-07)`; backlog §M1-S9); AC (AC-F5-3)
- **Verification:** audit (predicate restatement) + test (calendar-only fixture is ineligible)
- **Negotiable:** no

### C-8: Incident-exclusive window with recovery

- **Statement:** The most recent false-success incident is an exclusive lower bound; the incident can never sit inside an eligible window, and sufficient post-incident evidence can make the repository eligible again.
- **Source:** AC (`chg-GH-239-spec` AC-F4-3, AC-F5-2); readiness finding F3
- **Verification:** test (incident reset, post-incident recovery, tie handling)
- **Negotiable:** no

### C-9: One declared comparison record shape

- **Statement:** Every counted attempt carries a comparison class, a comparison token or an explicit not-applicable marker, and a comparison outcome; `pr-open-unverified` compares to the independent tracker fact at PR-state granularity, and dispatch-session tokens carry a declared not-applicable comparison. Neither case creates a permanent divergence, and two consumers cannot re-derive the comparison differently.
- **Source:** AC (`chg-GH-239-spec` AC-F4-2, AC-F5-2, DEC-3); TDR-0010; readiness finding F11
- **Verification:** test (family matrix, equivalence, not-applicable negatives) + code review
- **Negotiable:** no

> **Table stakes:** the eleven-token closure and exit projection (TDR-0005), the `outcome`-beside-`partial` and spawn-refused rules (TDR-0010), the bounded summary read, zero model calls in evaluation, and secret containment are unchanged; every eligible alternative below is assumed to satisfy them and they are not scored again.

## Decision Drivers

1. **Gate reachability without weakening the bar** — every condition stays strict, but no condition is defined over a fact that a legitimate class cannot supply (F1).
2. **Truth-bound handover** — an engine token alone never grants authority; corroboration is required exactly where a success is claimed (CEO-D-073, backlog).
3. **Exposure over elapsed time** — the gate measures classifier exercise, not waiting (GH-266).
4. **Determinism and auditability** — the same ledger and inputs yield the same verdict; the window start, missing classes, divergences, and unmet conditions are reported, and every handover is recorded and reversible.
5. **Operational recovery** — an incident resets the evidence but never permanently bars a repository; a revert restores the bash fallback.
6. **Single declared home for each rule** — one predicate, one comparison shape, one identity resolution order, one authority fold; consumers read rather than re-derive.
7. **Provenance integrity** — production counting cannot be inflated by fixture, smoke, or controlled-proof evidence.
8. **Low ceremony and reversibility** — the semantics are data and declared rules; changing them is a record amendment plus a data/spec edit, not a refactor.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor`, routed from GH-239 readiness iteration 1 finding F9.
- **Decider / Approver:** Juliusz Ćwiąkalski — acceptance pending at the GH-239 PR review. The AI does not accept this record; it remains `Proposed` until the owner accepts.
- **Contributors:** `@readiness-reviewer` (findings F1, F2, F3, F8, F9, F11), `@spec-writer` (DEC-3, DEC-10…DEC-13), `@test-plan-writer` (the affected oracles), `@plan-writer` (phases 3, 4, 10).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the owner at the GH-239 PR review.
- **Performers:** `@spec-writer`, `@test-plan-writer`, `@plan-writer`, and `@coder` fold these semantics into the change artifacts and delivery.
- **Informed:** M1-S9 operational owners, GH-266 (amended bar), bash fallback maintainers.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The canonical M1-S9 `clean` bar is the four-condition conjunction, not a rolling two-week window. | FACT | `doc/planning/oss-tooling/backlog.md` §M1-S9; `chg-GH-266-spec` DEC-1/DEC-2; read 2026-11-08 | The gate would be re-derived from a superseded bar | High |
| The gate semantics currently live only in the GH-239 change spec (DEC-10, DEC-11, DEC-12, DEC-13, F-4/F-5, Appendix B). | FACT | `chg-GH-239-spec.md`; no `doc/decisions/**` record | The semantics would be archived with the change folder | High |
| Readiness iteration 1 found the gate jointly unsatisfiable and routed the semantics to a decision record. | FACT | `readiness/readiness-iter-1.yaml` F1/F2/F3/F8/F9/F11 | This record would address the wrong defects | High |
| The taxonomy is exactly eleven tokens with fixed projection and derivation classes. | FACT | `packages/core/src/contracts/delivery-result.ts`; TDR-0005 | Coverage, comparison, and not-applicable sets would be wrong | High |
| `normalizeRepositoryKey` produces a lowercased `host/owner/name` key, independent of the checkout path. | FACT | `packages/core/src/domain/queue-graph.ts:76` | The primary identity claim would be wrong | High |
| The state layer supports a one-time store-managed artifact with guard kinds and runtime-edge randomness. | FACT | `packages/core/src/contracts/state.ts` `ensureStoreArtifact` | A persisted first-use identity marker would need another mechanism | High |
| The controlled proof runs real state and command paths with injected harness/tracker/CI/VCS ports, and no real repository is flipped in the PR. | ASSUMPTION | `chg-GH-239-spec` F-8, AC-F8-1, NG-1, D2 | The E2E could not satisfy C-1/C-4 as scoped | Medium |
| The exact `--evidence-class` surface (flag vs. configured default) is not yet pinned by the spec. | TO-CONFIRM | `chg-GH-239-spec` F-4/DM-1/EVT-1; `chg-GH-239-plan` phase 3 | The counting rule could be implemented ambiguously | Medium |
| The window and UTC-day attribution use the attempt's completion/recorded timestamp, not the start timestamp. | TO-CONFIRM | `chg-GH-239-spec` DM-1; test plan TC-GATE-009 | A start-vs-finish choice changes day boundaries and incident ties | Medium |
| `merged` corroboration requires the pushed head, CI on that head, tracker state, and completed phases. | FACT | backlog §M1-S9; spec Appendix B; GH-266 F-3 | The corroboration matrix would be under-specified | High |

## Mental Models & Techniques Used

- **First principles:** separate the observable facts (class produced, comparison agreed, success corroborated) before composing a predicate; the reachability defect came from composing three different facts into one condition.
- **Inversion:** how would the gate be made passable without evidence? By counting fixtures as pilot runs, by treating a not-applicable comparison as agreement, by letting a path digest survive a rename, or by deleting the record that a reversal happened. Each inversion names a constraint.
- **Second-order thinking:** exposure-only coverage keeps the bar strict while making it reachable; making it "success-only" would force operators to manufacture rare failures on real tickets, which is worse than the risk it removes.
- **Systems thinking:** the gate, the attempt record, the derived authority view, and the four bash entry points form one loop; a fail-safe `dual-run` default is what keeps the loop safe when the view is missing.
- **Opportunity cost:** a single declared comparison shape costs one record field and removes per-consumer re-derivation; a permanent incident bar costs all future recovery.
- **KISS / least vocabulary:** reuse the closed token set and the scheduler's existing repository normalizer; do not mint a second identity or comparison vocabulary.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 reachable | C-2 closed vocab | C-3 durable | C-4 provenance | C-5 identity | C-6 reversible | C-7 evidence bar | C-8 recoverable | C-9 comparison | Eligibility |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| ALT-0 no durable record | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Not eligible |
| ALT-1 success-only coverage | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Not eligible |
| ALT-2 exposure coverage, unevaluable blocks window | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Not eligible |
| ALT-3 selected composite | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Eligible |
| ALT-4 calendar/rolling window | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Not eligible |
| ALT-5 checkout-path digest identity | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | Not eligible |
| ALT-6 inclusive incident window / permanent bar | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Not eligible |
| ALT-7 delete authority record on revert | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | Not eligible |
| ALT-8 tracker-exact comparison (`pr-open-unverified` vs `pr-open` is a divergence) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Not eligible |

Legend: ✅ passes · ❌ fails. No alternative relies on an accepted-risk exception.

### Alternative 0 — Do Nothing / Leave the Semantics in the Change Spec

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Keep DEC-10…DEC-13 and Appendix B only in `chg-GH-239-spec.md`; deliver the gate from the change folder.
- **Constraint compliance:** Satisfies C-1, C-2, C-4…C-9 in the delivered change; fails C-3 because the change folder is temporary and the owner has no durable record to accept.
- **Driver fit:** Worst — drivers 4 and 6 unserved; the semantics are archived with the change.
- **Pros:** No additional artifact.
- **Cons:** The first real handover reads a temporary spec; a later change can silently redefine the gate; readiness finding F9 remains open.
- **Why rejected:** The gate is system-wide operational policy, not a delivery detail.

### Alternative 1 — Success-Only Class Coverage

- **Eligibility:** Not eligible (fails C-1 and C-9).
- **Summary:** Require every token to appear among *clean, corroborated successes*. Because `state-unverified` exists only when truth could not be read and `pr-open-unverified` has, by definition, an unresolved URL, neither can ever be a clean corroborated success; the eleven-class condition becomes unsatisfiable.
- **Constraint compliance:** Fails C-1 outright; also fails C-9 because the comparison rules for the two excluded classes remain undefined.
- **Driver fit:** Superficially strongest on driver 2 (truth-bound) but destroys driver 1 (reachability).
- **Pros:** No class can be "covered" by a failure.
- **Cons:** The gate can never be met; operators would either waive the gate or manufacture false failures on real tickets.
- **Why rejected:** F1's exact defect. Coverage is an exposure fact, not a success claim.

### Alternative 2 — Exposure Coverage but an Unevaluable Record Blocks the Window

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Count non-success classes for coverage, but keep the rule that any unevaluable attempt blocks eligibility. A `state-unverified` record is by construction unevaluable, so it still blocks the window forever.
- **Constraint compliance:** Fails C-1; passes the rest as written.
- **Driver fit:** Good on driver 2, fatal on driver 1.
- **Pros:** Conservative; no unevaluable evidence is ever ignored.
- **Cons:** One unreadable read permanently blocks a repository; the failure mode F1 describes survives under a new name.
- **Why rejected:** A record-level degradation must degrade that record, not the whole window. Only an unreadable *evidence stream* makes the window unverifiable.

### Alternative 3 — Selected Composite (Exposure Coverage + Record-Level Degradation + Evidence Classes + Incident-Exclusive Window + UTC Floor + Rename-Invariant Identity + Append-Only Reversal + Declared Comparison Shape)

- **Eligibility:** Eligible (passes C-1…C-9).
- **Summary:** Define the predicate over four separated facts; count exposure for all eleven classes; require corroboration only for success-claimed tokens; carry a declared evidence class; make the incident an exclusive lower bound; count the floor in dispatches or UTC dates; resolve identity from the normalized remote with a persisted first-use marker or a clean refusal; flip and revert append-only and idempotently; publish one comparison record shape with an explicit not-applicable marker.
- **Constraint compliance:** Passes every constraint by construction; each rule is stated so its negative is testable.
- **Driver fit:** Best — strict and reachable (1), truth-bound where success is claimed (2), exposure-based (3), deterministic and auditable (4), recoverable (5), single-home (6), provenance-safe (7), reversible (8).
- **Pros:** The controlled proof can reach eligibility with all eleven classes; the first real handover has an auditable, recoverable bar; consumers read one comparison shape.
- **Cons:** More declared fields (evidence class, comparison shape, window reason, identity binding) and a stricter provenance obligation on the proof.
- **Why chosen:** See Decision.

### Alternative 4 — Calendar / Rolling Two-Week Window

- **Eligibility:** Not eligible (fails C-7).
- **Summary:** Keep the superseded rolling two-week window as the gate, optionally with the other conditions.
- **Constraint compliance:** Fails C-7 because the canonical bar was amended by `CEO-D-073 (GH-266, 2026-11-07)`; a calendar proxy measures waiting, not classifier exposure.
- **Driver fit:** Worst on driver 3; weak on driver 1 because it can pass with almost no evidence.
- **Pros:** Simple to explain.
- **Cons:** Two weeks of light traffic passes with no coverage; heavy, varied traffic is held back for no safety benefit; the amended backlog and status explicitly supersede it.
- **Why rejected:** Contradicts the canonical amended bar and the owner directive.

### Alternative 5 — Checkout-Path Digest as the Fallback Identity

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** When the scheduler `repository` value is absent, identify the repository by a stable digest of the declared checkout root.
- **Constraint compliance:** Fails C-5: a digest of a path changes when the path is renamed, so it is not rename-invariant; presenting it as "stable" contradicts DEC-13's own rationale (readiness F8).
- **Driver fit:** Weak on driver 4 (auditability across renames) and driver 5 (isolation after a move).
- **Pros:** No remote required; deterministic for an unchanged path.
- **Cons:** A rename or move re-keys history, splits the evidence window, and can make one repository look like two; a path digest silently grants or loses authority.
- **Why rejected:** The primary key is already rename-stable; the fallback must be rename-invariant too, or the gate must refuse.

### Alternative 6 — Inclusive Incident Window or a Permanent Incident Bar

- **Eligibility:** Not eligible (fails C-1 and C-8).
- **Summary:** Either include the resetting incident in the evaluated window, or never reset and require zero incidents forever.
- **Constraint compliance:** Inclusive reset fails C-8 because the incident sits inside every future window and "zero incidents in the window" can never hold; a permanent bar also fails C-1 because a single incident makes eligibility unreachable.
- **Driver fit:** Fails driver 5 (operational recovery).
- **Pros:** Maximally conservative.
- **Cons:** No repository can recover; the gate becomes a one-strike permanent bar that the backlog amendment explicitly rejected as making recovery impossible.
- **Why rejected:** The window must exclude the resetting incident and allow post-incident re-accrual.

### Alternative 7 — Delete the Authority Record on Revert

- **Eligibility:** Not eligible (fails C-6).
- **Summary:** Implement `--revert` by deleting the handover record (or rewriting the authority view directly), rather than appending a reversal.
- **Constraint compliance:** Fails C-6: history is not preserved, the audit trail is destroyed, and a crash mid-delete can leave the view inconsistent.
- **Driver fit:** Weak on driver 4 (auditability) and driver 5 (safe recovery).
- **Pros:** The view immediately reflects dual-run.
- **Cons:** No evidence that a handover ever happened; a replay cannot be distinguished from a first run; an operator cannot audit why authority moved.
- **Why rejected:** Append-only reversal preserves history and gives idempotent replay a well-defined fold.

### Alternative 8 — Tracker-Exact Comparison for `pr-open-unverified`

- **Eligibility:** Not eligible (fails C-1 and C-9).
- **Summary:** Compare the engine's `pr-open-unverified` token to independent tracker truth `pr-open` at exact-token granularity, so the URL-resolution difference is a permanent divergence.
- **Constraint compliance:** Fails C-9 (comparison unit is wrong) and C-1 (a permanent, unresolvable divergence blocks eligibility unless resolved without evidence).
- **Driver fit:** Appears strict on driver 2 but destroys driver 1.
- **Pros:** Exact token equality.
- **Cons:** The engine can never resolve the URL from the same failed read that produced the token, so the divergence is unresolvable by construction; resolving it without evidence would be worse.
- **Why rejected:** The tracker fact is "the PR is open"; URL resolution is an engine-side attribute, not part of the independent tracker truth.

## Decision

- **Recommendation:** Alternative 3.
- **Authorized Decision:** **Pending.** The owner accepts, adjusts, or rejects this record at the GH-239 PR review. Until then the record is `Proposed`, grants no authority, and does not itself change the change artifacts. The change spec/test-plan/plan must reference TDR-0015 and be amended to these semantics before delivery (see Implementation Plan).
- **Decider:** Juliusz Ćwiąkalski (owner). The AI does not accept this record.
- **Amendment (GH-279):** [TDR-0020](TDR-0020-dispatch-divergence-recording-and-resolution.md) amends **four assertions** of this record for the delivered-evidence case only — §1 `Truth(W)` (the not-applicable-comparison clause), §1 `Coverage(W)` ("creates no divergence"), §1 record-level degradation ("does not create a divergence"), and §5 ("a divergence record is appended iff `outcome = "mismatch"`"). Each affected assertion carries an additive note below. Every other clause here stands unchanged; this record's decision text and history are not rewritten, and no supersession is claimed. This record is itself `Proposed`: the additive amendment takes effect only if the owner accepts both this Proposed record and TDR-0020 at the GH-279 PR. **Spec pointer:** the GH-279 specification's F-4.9/DEC-3 sentence summarizes this as two changed gate behaviours; that sentence is a pointer, not the scope. The amendment is **four** TDR-0015 assertions — the three in §1 and the one in §5 — and **TDR-0020 is their durable home**.

### 1. Gate composition and reachability

Eligibility for a repository `R` is the conjunction of four conditions over the counted dispatches `W` in the evidence window, under the applicable evidence class:

```
Eligible(R) = Truth(W) ∧ Coverage(W) ∧ Floor(W) ∧ Corroborated(W)
```

- **`Truth(W)`:** `falseSuccessIncidents(W) = 0` and `unresolvedDivergences(W) = 0`. A false-success incident is a success-claimed result contradicted by artifact, tracker, or CI truth. A divergence exists only when a comparison outcome is `mismatch`; a not-applicable comparison is never a divergence.
  > **Amendment (GH-279, [TDR-0020](TDR-0020-dispatch-divergence-recording-and-resolution.md)):** for the delivered-evidence case only — a not-applicable comparison whose comparison source was unavailable **on an attempt that carries delivered evidence** — the attempt records at most one open, resolvable divergence per (repository, work-item ref), and that divergence counts in `unresolvedDivergences(W)` until resolved. All other not-applicable comparisons remain non-divergences. This note is additive; the decision text above is unchanged.
- **`Coverage(W)`:** the set of result tokens across `W` equals the eleven-token TDR-0005 set; every missing class is named. Coverage is **exposure**, not success. A `state-unverified` attempt counts for coverage, is not a success claim, creates no divergence, and does not by itself block eligibility.
  > **Amendment (GH-279, [TDR-0020](TDR-0020-dispatch-divergence-recording-and-resolution.md)):** for the delivered-evidence case only, a `state-unverified` attempt that carries delivered evidence **does** record the open divergence described above (or references the existing open one for the same work item); it remains a non-success token, remains exposure for coverage, and remains non-blocking **only on the corroboration condition** — it makes no success claim, so `Corroborated(W)` is satisfied vacuously. That non-blocking scope does **not** reach `Truth(W)`: the recorded delivered-evidence divergence counts in `unresolvedDivergences(W)` and therefore blocks eligibility until it is resolved, exactly as the `Truth(W)` amendment above states. This note is additive; the decision text above is unchanged.
- **`Floor(W)`:** see decision 4. The floor binds only itself; it never substitutes for `Truth`, `Coverage`, or `Corroborated`.
- **`Corroborated(W)`:** every counted dispatch whose token is a success claim (projection class `success`: `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `finished`, `noop-lane-nothing-to-do`) has the evidence its outcome family requires. Non-success tokens (`failed`, `partial`, `max-restarts`, `state-unverified`, `noop-lane-permission`) make no success claim and satisfy this condition vacuously.

Two failure scopes are distinct and must not be conflated:

- **Record-level degradation.** An attempt whose comparison source or corroboration source cannot be read is recorded as unevaluable with its classified identity. It does not make the summary "unverifiable". If it is a non-success token, it still counts for coverage and does not block. If it is a success-claimed token, its claim is uncorroborated, so `Corroborated(W)` fails as one named unmet condition — it does not create a divergence, does not become a false-success incident, and does not reset the window.
  > **Amendment (GH-279, [TDR-0020](TDR-0020-dispatch-divergence-recording-and-resolution.md)):** for the delivered-evidence case only — an attempt that carries delivered evidence and whose truth read is unreadable — such an attempt records the single open delivered-evidence divergence described above instead of remaining divergence-free; it still does not become a false-success incident and still does not reset the window. A success-claimed token's uncorroborated status is unchanged. This note is additive; the decision text above is unchanged.
- **Window-level unreadability.** An unreadable, torn, or truncated *ledger/evidence read* — the summary cannot see the evidence at all — makes eligibility `unverifiable` (neither eligible nor ineligible), with the degradation or truncation declared and no fabricated zeros.

`pr-open-unverified` is a success-claimed token whose corroboration is the tracker fact that the PR is open. The URL-resolution failure is recorded as an engine-side attribute (`urlResolved: false`); it is not an unresolved divergence and not a permanently unsatisfied corroboration. This is what makes the class simultaneously coverable, comparable, and corroborable.

### 2. Evidence class discriminator

Every attempt record carries a declared `evidenceClass` with the closed values `pilot | controlled-proof | smoke | fixture`.

- **Production handover counts only `pilot` evidence.** A production repository's window contains only pilot-class attempts.
- **The controlled-proof E2E counts only `controlled-proof` evidence within its own controlled repository scope.** The same predicate is evaluated; the counting class differs by repository scope. A controlled-proof attempt under a production repository identity does not count toward that production repository and is surfaced, never silently accepted.
- `smoke` and `fixture` evidence never counts toward any handover.

**Anti-gaming rules (binding):**

- The evidence class is attached by the command at record creation from a declared invocation/composition input or a declared configuration default; it is never inferred from the outcome and never read from externally supplied or user-editable record content.
- Evidence is never hand-inserted into a ledger. Fixture harness/tracker/CI/VCS ports may supply external facts, but the command itself must produce the attempt record (spec F-8, AC-F8-1, TC-E2E-003).
- A class cannot be escalated after the fact: a `controlled-proof`, `smoke`, or `fixture` record never counts as `pilot`, and an appended record is immutable.
- The controlled proof runs under a composition that declares `controlled-proof`; a provenance guard asserts that controlled runs never declare `pilot`.

### 3. Evidence window

- **Lower bound:** the most recent false-success incident's recorded timestamp, **exclusive**, when an incident exists; otherwise the first counted dispatch (inclusive).
- **Window:** counted dispatches whose completion/recorded timestamp is strictly after the lower bound when an incident exists; otherwise all counted dispatches in the repository scope.
- **Reporting:** the summary reports both `windowStart` and `windowStartReason`, with the closed reasons `first-counted-dispatch`, `false-success-incident-reset`, and `no-counted-dispatch`.
- **Recovery:** because the incident is excluded, it can never sit inside an eligible window, and sufficient post-incident evidence can restore `Truth`, `Coverage`, and `Floor`. Resolved divergences do **not** reset the window; only a false-success incident does (spec DEC-10).
- **Tie handling:** an attempt recorded at the exact incident timestamp is excluded (`>` comparison), so the incident and any same-instant record are outside the window deterministically.

### 4. Exposure floor

The floor is met when either alternative holds within the window:

```
Floor(W) = ( |W| >= 20 )
        ∨ ( maxConsecutiveUtcDateRun(W) >= 7 )
```

- `|W|` is the number of counted dispatches in the window.
- A UTC date is the UTC calendar date (`YYYY-MM-DD`) of a counted dispatch's completion/recorded timestamp.
- `maxConsecutiveUtcDateRun(W)` is the longest run of consecutive UTC dates, each carrying at least one counted dispatch, within the window; the floor is met at a run length of 7.
- **"Whichever comes first" binds only the floor.** Meeting either alternative satisfies the floor and nothing else; it never substitutes for `Truth`, `Coverage`, or `Corroborated` (spec AC-F5-3, GH-266 DEC-2).

### 5. Comparison baseline by token family

Every counted attempt carries one declared comparison record:

```
comparison: {
  class:   "verify-change" | "tracker-truth" | "not-applicable",
  token:   null | DeliveryResultToken,
  outcome: "match" | "mismatch" | "not-applicable",
  reason?: "dispatch-session-family" | "comparison-source-unavailable",
  urlResolved?: boolean
}
```

Invariants (declared once; no consumer may re-derive them):

- `token = null` iff `class = "not-applicable"`; `outcome = "not-applicable"` iff `class = "not-applicable"`.
- A divergence record is appended iff `outcome = "mismatch"`. `match` and `not-applicable` never create a divergence.
  > **Amendment (GH-279, [TDR-0020](TDR-0020-dispatch-divergence-recording-and-resolution.md)):** for the delivered-evidence case only, a `not-applicable` comparison with `reason = "comparison-source-unavailable"` on an attempt that carries delivered evidence may append the single open delivered-evidence divergence described in §1 (or reference the existing open one for the same work item). In that case the `state-unverified` bullet's "exposure-only" means "makes no success claim", not "records no obligation". All other `match` and `not-applicable` comparisons remain non-divergences. This note is additive; the decision text above is unchanged.
- **`verify-change` family** (`failed`, `finished`, `partial`, `state-unverified`): the comparison unit is the verify-change ledger outcome token for the same reference, compared by exact token equality. `state-unverified` is the declared exception: the same unreadable truth that produced it makes the independent ledger comparison unavailable, so it carries `class = "not-applicable"`, `token = null`, `outcome = "not-applicable"`, `reason = "comparison-source-unavailable"` and is exposure-only.
- **Dispatch-derived `failed` pairs**: a spawn failure (`dispatch.session.spawn-failed`) and a resume-economics refusal (`dispatch.resume-uneconomical`) produce no independently derived verify-change outcome for that attempt, so they carry `class = "not-applicable"`, `token = null`, `outcome = "not-applicable"`, `reason = "comparison-source-unavailable"`; they are exposure-only, create no divergence, and are not a new comparison family. `max-restarts` and harness-path `noop-lane-permission` remain dispatch-session tokens with reason `dispatch-session-family`.
- **`tracker-truth` family** (`merged`, `blocked`, `pr-open`, `pr-open-unverified`): the comparison unit is PR/tracker state, not URL text. `pr-open-unverified` compares to independent tracker truth `pr-open` (equivalence rule: `pr-open-unverified ≡ pr-open` at tracker-state granularity), with `urlResolved` recorded as an attribute. `merged` and `blocked` compare to their tracker facts. URL resolution is never part of the comparison and never produces a mismatch.
- **`dispatch-session` family** (`max-restarts`, `noop-lane-permission`, `noop-lane-nothing-to-do`): `class = "not-applicable"`, `token = null`, `outcome = "not-applicable"`, `reason = "dispatch-session-family"`; exposure-only. The mandatory `outcome` field is still carried beside the token (TDR-0010), and harness-path `noop-lane-permission` still means spawn-refused.
- `partial` always carries its `outcome` (TDR-0010).

Two consumers reading the same attempt therefore obtain the same comparison class, token, outcome, and divergence decision without re-deriving family membership.

### 6. Repository identity

**Resolution order** (first successful step wins; the result is persisted as the repository binding for that checkout, scoped to the checkout rather than to the shared per-user state root):

1. The scheduling engine's `repository` value on the queue entry/lease (already normalized `host/owner/name`).
2. The checkout's configured VCS remote normalized through `normalizeRepositoryKey` (strips protocol, credentials, userinfo, `.git`; lowercases; yields `host/owner/name`).
3. A persisted identity marker created on first use for that checkout: stored with the checkout in its git common directory (`<git-common-dir>/dispatch-identity.json`), created once and never overwritten, so it survives a working-directory rename, is shared by the checkout's linked worktrees, and is never shared with or overwritten by another repository in the same home. It is created only by a dispatch operating on the current checkout, never by a read-only summary, resolve, or handover read of an arbitrary `--repo` argument. It is never derived from the checkout path. Creation writes a synced sibling file and links it into place, so an interrupted write cannot leave a torn marker; a marker that nevertheless carries no binding is replaced by the next persisting dispatch rather than left permanently unreadable.
4. **Clean refusal.** If none of the above resolves, the summary/handover refuses at exit 1 with a classified identity error and appends no authority-changing record. It never reports an empty success and never falls back to a path digest.

**Stability:** once a binding is established for a checkout, it is reused, so a checkout rename, a remote change, or a restart does not re-key history. Bindings are per checkout: two repositories in one home keep separate markers and neither can rebind the other. If a later derived scheduler key or remote disagrees with the persisted binding, the binding governs silently: the attempt record carries only the governing normalized repository identity, the disagreement is not recorded as a separate attribute, and the checkout never gains a second identity.

A digest of the checkout path is explicitly **not** an acceptable identity: it changes on rename, so it cannot carry the rename-stability claim (readiness F8).

### 7. Reversal, duplicate handovers, and the authority view

- **Per-repository isolation:** authority is keyed by the resolved repository identity; a flip or reversal for one repository never affects another and never writes an aggregate/global authority record.
- **Recorded flip and revert:** every flip and reversal appends one `dispatch.handover` record carrying the repository identity, the operation (`authoritative` or `dual-run`), the conditions snapshot at decision time, bounded evidence references, the recording principal, and the timestamp. History is append-only; a reversal is a new record, never a deletion or an in-place rewrite.
- **Idempotent replay:** replaying `dispatch handover <repo>` for an already-authoritative repository appends nothing and reports `noop`; replaying `dispatch handover <repo> --revert` for a repository already in `dual-run` is a `noop` at exit 0. A replay after an interrupted append converges on the folded ledger truth because the ledger fold, not a mutable field, is authoritative.
- **Duplicate/conflicting records:** the fold is latest-per-repository in ledger sequence order; the highest-sequence handover record governs. A duplicate identical operation is a noop, not a second effect.
- **Authority view:** the derived per-repository authority document is rebuilt from the folded handover ledger and replaced atomically. The bash entry points read it as a plain file with no typed CLI invocation. Any absent, unreadable, or malformed view resolves to `dual-run`, so a missing typed installation can never break the bash stack.

### Constraint Compliance Attestation

The selected composite satisfies all constraints C-1…C-9. It keeps every class coverable while requiring corroboration only where a success is claimed, so the controlled proof reaches eligibility (C-1); it changes no token, projection, derivation class, or exit (C-2); it places the semantics in this durable, owner-visible record (C-3); it carries a declared evidence class and scopes counting to `pilot` for production and `controlled-proof` for the controlled repository, with no hand-inserted evidence (C-4); it resolves identity from the normalized remote and a persisted first-use marker or refuses cleanly, never from a path digest (C-5); it flips and reverts append-only, idempotently, per repository, with a fail-safe `dual-run` view (C-6); it implements the amended evidence bar rather than a calendar proxy (C-7); it makes the incident an exclusive lower bound and permits post-incident recovery (C-8); and it declares one comparison record shape with an explicit not-applicable marker for `state-unverified` and dispatch-session tokens (C-9). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The gate is strict and satisfiable: coverage, comparison, and corroboration are separate facts, so rare classes no longer make eligibility impossible.
- Production counting is provenance-safe: fixture, smoke, and controlled-proof evidence cannot inflate a real repository's window.
- The evidence window has one deterministic lower bound with a reported reason, so an incident resets the bar without permanently barring a repository.
- The comparison record is declared once, so two consumers cannot disagree about `pr-open-unverified`, `state-unverified`, or dispatch-session tokens.
- Repository identity survives renames and restarts, and an unresolvable identity is a safe refusal rather than a silent empty success.
- Handover and reversal are auditable and idempotent; a missing or malformed authority view never breaks the bash fallback.

### Negative Outcomes

- The attempt record gains declared fields (evidence class, comparison shape, window reason, identity binding), increasing the contract surface and the test matrix.
- The controlled proof must demonstrate the counting rule and the provenance guard, not just the happy path.
- A `pilot` run that cannot corroborate a success claim blocks eligibility as an unmet condition until it is re-run or resolved; this is deliberate but adds operational work.
- A repository with no remote must establish and preserve a persisted marker; losing the checkout's marker means a new binding rather than silent continuity.

### Unresolved Questions

- [ ] Pin the `--evidence-class` surface (explicit flag vs. configured default) and the controlled composition's declaration point (owner: `@spec-writer`, GH-239 spec F-4/DM-1/EVT-1).
- [x] Pin the persisted identity marker's storage name/location and the exact behavior when a persisted binding disagrees with a later derived key (owner: `@spec-writer` + `@plan-writer`, GH-239 phase 3). Pinned in §6: a checkout-scoped `<git-common-dir>/dispatch-identity.json` created once and never overwritten; the persisted binding governs a later disagreement.
- [ ] Pin the timestamp field used for the window lower bound and the UTC-date attribution (completion vs. recorded) and the incident-tie rule (owner: `@test-plan-writer`, TC-GATE-009).
- [ ] Confirm that `merged` corroboration always requires the pushed head, CI on that head, tracker state, and completed phases in the controlled fixture (owner: `@test-plan-writer`).

## Implementation Plan

1. **Record:** this TDR is authored as `Proposed` and rides the GH-239 PR. The owner accepts, adjusts, or rejects it at PR review; the AI does not accept it. On acceptance, `status` flips to `Accepted`, `decision_date` is set, and the first post-implementation `review_date` is set.
2. **Spec (`@spec-writer`):** add TDR-0015 to `links.decisions` and to the decision log; amend F-4/AC-F4-1/DM-1/EVT-1 with `evidenceClass`; amend F-4/AC-F4-4 with the record-level vs. window-level degradation distinction; amend F-5/AC-F5-2/AC-F5-3 and Appendix B with the exposure/coverage/corroboration separation and the floor-only rule; amend DEC-3 with the comparison record shape; amend DEC-10 with the exclusive lower bound and start reason; amend DEC-12 with the UTC-date run definition; amend DEC-13 with the resolution order, persisted marker, and clean refusal; amend §7.1 `Counted dispatch` and the §12 repository-identity assumption.
3. **Test plan (`@test-plan-writer`):** make TC-TRUTH-003 (`pr-open-unverified` corroborated by the tracker fact), TC-TRUTH-006 (record-level degradation vs. window-level unverifiability), TC-GATE-007 (all eleven classes including the two previously unreachable), TC-GATE-008 (the comparison record shape and equivalence), TC-GATE-009 (exclusive incident reset plus post-incident recovery), TC-HAND-006 (rename-invariant identity, marker reuse, clean refusal), and TC-E2E-001 (controlled-proof evidence class and provenance guard) match these semantics. Add a positive gate case proving eligibility with all eleven classes.
4. **Plan (`@plan-writer`):** align phase 3 (ledger fields and fold), phase 4 (predicate, comparison, floor), and phase 10 (controlled proof, counting class, provenance guard) with the amended spec; keep the implementation in the declared contracts/domain/app tiers.
5. **Delivery (`@coder`):** implement per the amended spec and plan. No source code is changed by this record.

## Verification Criteria

- **Gate reachability:** the controlled E2E reaches eligibility with all eleven classes, including `state-unverified` and `pr-open-unverified` — Target: 1 of 1 — Window: GH-239 conformance suite.
- **Production counting:** production `dual-run summary --repo` counts 0 non-`pilot` attempts; the controlled repository counts 0 non-`controlled-proof` attempts — Target: 0 cross-class counts — Window: gate and provenance tests.
- **Window:** every summary reports `windowStart` and `windowStartReason`; a post-incident recovery set reaches eligibility with 0 in-window incidents — Target: asserted in every window test — Window: TC-GATE-009.
- **Floor:** the 20-count and 7-consecutive-UTC-date alternatives each satisfy only the floor; neither rescues a missing class, an incident, or an uncorroborated success — Target: 0 false floor passes — Window: gate tests.
- **Comparison:** 100% of counted attempts carry a comparison class, token or not-applicable marker, and outcome; `pr-open-unverified` and dispatch-session tokens produce 0 permanent divergences — Target: 100% / 0 — Window: TC-GATE-008, TC-EVID-002.
- **Identity:** 0 re-keys across a checkout rename; 0 path-digest fallbacks; an unresolvable identity is a clean refusal at exit 1 — Target: 0 / 0 / 1-of-1 — Window: TC-HAND-006.
- **Reversal/idempotency:** a replayed handover or reversal appends 0 duplicate records and reports `noop`; an absent/unreadable authority view resolves to `dual-run` — Target: 0 duplicates / 100% fail-safe — Window: handover and bash fallback suites.

## Confidence Rating

**High.** Every load-bearing element is repo-local and read directly: the canonical backlog bar, the GH-239 spec and readiness findings, the closed taxonomy and TDR-0010 rules, the delivered repository-key normalizer, and the state layer's get-or-create artifact semantics. The residual uncertainty is narrow and bounded by the `TO-CONFIRM` items: the exact evidence-class invocation surface, the marker storage name, and the timestamp field used for window/day attribution. Those are specification-precision choices, not open questions about the decision. Per the AI-authority model, this confidence is a record property, not evidence of owner acceptance; the record remains `Proposed` until the human owner decides at the GH-239 PR review.

## References

- [GH-239 specification](../changes/2026-11/2026-11-08--GH-239--dispatch-engine/chg-GH-239-spec.md) — F-4/F-5/F-8, DEC-3, DEC-10…DEC-13, DM-1/DM-6/DM-7, Appendix A/B, §7.1 glossary.
- [GH-239 readiness iteration 1](../changes/2026-11/2026-11-08--GH-239--dispatch-engine/readiness/readiness-iter-1.yaml) — findings F1, F2, F3, F8, F9, F11 (routing: F9).
- [GH-239 test plan](../changes/2026-11/2026-11-08--GH-239--dispatch-engine/chg-GH-239-test-plan.md) — TC-TRUTH-003/006, TC-GATE-007/008/009, TC-HAND-006, TC-E2E-001/003.
- [GH-239 plan](../changes/2026-11/2026-11-08--GH-239--dispatch-engine/chg-GH-239-plan.yaml) — phases 3, 4, 10.
- [Amended M1-S9 backlog entry](../planning/oss-tooling/backlog.md) — the canonical four-condition `clean` bar.
- [GH-266 specification](../changes/2026-11/2026-11-07--GH-266--evidence-based-handover-gate/chg-GH-266-spec.md) — `CEO-D-073 (GH-266, 2026-11-07)`; DEC-1…DEC-4; the amended bar.
- [GH-279 specification](../changes/2026-11/2026-11-10--GH-279--dispatch-credential-preflight/chg-GH-279-spec.md) — F-4.9/DEC-3, the pointer to the amendment. Its "two changed behaviours" summary is a pointer only: the amendment is the four assertions noted above, whose durable home is [TDR-0020](TDR-0020-dispatch-divergence-recording-and-resolution.md).
- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — the closed eleven-token vocabulary, projection/derivation classes, and token-level parity.
- [TDR-0010](TDR-0010-dispatch-session-classification-token-projection.md) — the dispatch-session projection, `outcome`-beside-`partial`, and spawn-refused rules.
- [TDR-0014](TDR-0014-commit-effect-crash-safety-message-independent-identity.md) — additive-field, append-only, and fail-safe precedent for durable operational records.
- `packages/core/src/contracts/delivery-result.ts` — `DELIVERY_RESULT_TOKENS`, `DELIVERY_RESULT_TAXONOMY`.
- `packages/core/src/contracts/queue.ts` — the `repository` identity field on entries and leases.
- `packages/adapters/src/file/dispatch-identity.ts` — the checkout-scoped first-use identity marker inside `<git-common-dir>/dispatch-identity.json`, created once and never overwritten.
- `packages/adapters/src/repo/index.ts` — `resolveCheckoutGitDirectories`, which supplies the checkout's git common directory.
- `packages/core/src/domain/queue-graph.ts` — `normalizeRepositoryKey` (`host/owner/name`, rename-independent).
