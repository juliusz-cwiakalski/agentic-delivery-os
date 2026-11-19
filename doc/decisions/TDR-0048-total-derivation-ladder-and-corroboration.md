---
id: TDR-0048
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-19
summary: "The dispatch result is derived by one total, ordered ladder in which the tracker-done arm precedes the blocking arm (so a done work item that also carries a blocking label resolves `merged`), the pull-request arms follow, and artifact completeness follows them (commits with complete pm-notes → `finished`, commits with incomplete or absent pm-notes → `partial`, no commits with a readable non-done non-blocked tracker → `noop-lane-nothing-to-do`), the shared classifier's token next, and `state-unverified` only when truth is undecidable; the delivered phase-ledger no-work arm is retired so one token has one derivation and `noop-lane-nothing-to-do` comes only from the shell arm, with the ledger narrowing to the resume position, the attempt-comparison `progressed` fact, and the delivered-evidence predicate while `ledger.workRemaining` no longer gates a token; the typed-only exit-0-no-artifact `failed` arm is subsumed by the parity arms while `failed` stays reachable from the classifier and the spawn-failure identity; the ladder is one implementation shared unchanged by the one-shot and daemon paths with no forked mode, and the daemon path inherits all three changes under a required regression observation; success corroboration becomes arm-aware for tracker-done `merged` and nothing-to-do, which are corroborated by the tracker fact that produced them, while the `pm-notes` source deliberately stays the phase ledger and a divergent-ledger `finished` is recorded as a delivered-evidence divergence by design — with the corroboration record's tri-state shape, the eleven tokens, the projections, and the exits unchanged."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os dispatch result derivation (total result ladder, success corroboration sufficiency)"
decision_scope: repo
review_date: null
customer_impact: "A tracker-done work item now reports `merged` even when a blocking label lingers, and commits with incomplete pm-notes now report `partial` instead of a false `finished` — while a genuine merge or no-op is no longer at risk of being recorded as a false-success incident for want of pm-notes or CI evidence."
classification:
  domains: [contracts, architecture, tooling]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: high
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-347: the specification routes the total order and the corroboration rule as DEC-6, covering ticket gaps 9 and 10; this record changes a delivered derivation contract)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-347 PR review; AI does not accept this R2 record"
  contributors:
    - "@spec-writer (chg-GH-347-spec §5.1 F-8, §8.3 DM-3/DM-4, §17.8 AC-F8-1…AC-F8-5, §25.6 Appendix F, DEC-6, and §15 DEC-11 for the corroboration boundary)"
    - "@decision-advisor (the delivered derivation, the corroboration sufficiency map, the shell's tracker order, and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-347 PR review — this record reorders delivered verdicts and changes which evidence a success claim requires)"
  performers:
    - "@coder (GH-347: the ordered ladder, the two new arms, the subsumed arm, the pm-notes completeness fact, arm-aware corroboration, the parity cases)"
    - "@doc-syncer (GH-347 documentation phase: dispatch-engine, result-contract, and glossary pages)"
  informed:
    - "The handover gate and false-success accounting (both consume the corroboration record and the false-success flag)"
    - "Downstream readers of the delivery result tokens (verdicts change for two inputs, vocabulary does not)"
    - "Any future change that adds a class arm (it adds a row to this ladder and a coverage row)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A twelfth token is proposed, or an existing token's projection or exit is proposed to move: the vocabulary is closed by this record and a change is a taxonomy decision with its own exit review."
  - "An arm's evidence source changes (a new read, a different read, or a new completeness rule): the arm's corroboration source is re-declared with it, and an arm must never inherit another arm's evidence requirement."
  - "A tracker-done work item is observed to be an untruthful merge signal (a closed-unmerged item that the provider can observe): the tracker-done arm's premise is re-decided before the arm is narrowed."
  - "The phase ledger is proposed to gate a token again: the no-work verdict is the shell arm (no commits, no PR, readable non-done non-blocked tracker) and the ledger retirement is a ruling (DM-4, §8.5); re-adding a ledger arm is a new arm with its own corroboration and its own parity row, not an implementation preference."
  - "pm-notes completeness is proposed to be read from a new probe, a new key, or a new file rule: the completeness fact derives from the delivered pm-notes read, and a second source is a contract change."
  - "Re-pointing the `\"pm-notes\"` corroboration source from the phase ledger (`phasesComplete`) to the `pmNotes` artifact fact, or relaxing `isDeliveredEvidence` for the artifact arms, is deferred (§7.3, DEC-11): when the artifact arms' corroboration is revisited as a whole, this record reopens with that decision rather than absorbing the change."
links:
  related_changes: ["GH-347"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-result-contract.md"
    - "doc/overview/glossary.md"
  contracts:
    - "packages/core/src/contracts/delivery-result.ts"
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/domain/dispatch-result.ts"
    - "packages/core/src/domain/dispatch-comparison.ts"
    - "packages/core/src/app/dispatch.ts"
    - "packages/core/src/app/dispatch-ledger.ts"
    - "packages/core/src/app/daemon-dispatch-result.ts"
    - "scripts/deliver-ticket.sh"
  diagrams: []
  decisions: ["TDR-0005", "TDR-0010", "TDR-0018", "TDR-0024", "TDR-0047"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S9"]
---

# TDR-0048: Total Derivation Ladder and Arm-Aware Corroboration

> **Traceability.** Spec §15 **DEC-6** and **DEC-11**; §15.1 maps DEC-6 to this record; §5.1 F-4/F-8; §6 Flow 4; §7.2 `[OUT]`; §7.3 (deferred corroboration re-point, not deferred arms); §8.3 DM-3/DM-4; §8.5 "Deliberate behaviour changes", "Phase-ledger no-work arm retired", "Stall truth is not completed-session truth", "One shared derivation, daemon path included", and "`pm-notes` corroboration remains ledger-sourced"; §17.8 AC-F8-1…AC-F8-5; §25.6 Appendix F(A–E); NFR-3. Sibling records: [TDR-0047](TDR-0047-in-process-bounded-restart-loop.md) (the stall ladder that consumes this one), [TDR-0044](TDR-0044-dispatch-owned-durable-lane-record.md) (record cardinality).

## Context

The eleven result tokens are closed and delivered, and the dispatch derives them from truth reads. Two class arms are unreachable, the order differs from the shell, and one success arm requires evidence that its own evidence source cannot supply.

- **FACT:** The delivered derivation is an ordered predicate chain: spawn failure → resume admission → restart budget → harness unreadable → spawn refusal → unreadable truth reads → **blocking** → **already-merged PR** → **open PR** → ledger no-work → exit-0-no-artifact failure → the shared classifier's token (`packages/core/src/domain/dispatch-result.ts:159-310`). *(read 2026-11-18)*
- **FACT:** Blocking is tested before every PR state and there is no tracker-done arm, so a done work item with no visible PR cannot resolve `merged`, and a done work item that also carries a blocking label resolves `blocked` (`dispatch-result.ts:247-252`). *(read 2026-11-18)*
- **FACT:** The ledger no-work arm (`ledger.total > 0 && completed === total && !workRemaining` → `noop-lane-nothing-to-do`) sits **before** the exit-0-no-artifact arm and after the PR arms (`dispatch-result.ts:279-284`). *(read 2026-11-18)*
- **FACT:** The exit-0-no-artifact arm resolves `failed` when the session completed with exit 0, no branch commit, no PR, and no ledger progress (`dispatch-result.ts:287-302`). *(read 2026-11-18)*
- **FACT:** No arm consults pm-notes completeness, so commits with incomplete pm-notes cannot resolve `partial` from artifacts; `partial` is reachable only from the shared classifier's tool-failure or premature-end outcomes (`packages/core/src/contracts/harness.ts:170-186`). *(read 2026-11-18)*
- **FACT:** The shell's tracker order is closed/done → `merged`, then a blocking label → `blocked`, then an open PR → `pr-open`, then a merged PR → `merged`, else `failed` (`scripts/deliver-ticket.sh:1308-1419`), and its artifact ladder is commits > 0 with complete pm-notes → `finished`, incomplete or absent → `partial`, none with a reachable tracker → the no-op arms (spec §2.1). *(read 2026-11-18)*
- **FACT:** Success corroboration is declared by token: `merged` requires `pm-notes`, `tracker`, and `ci`; `finished` requires `pm-notes`; `noop-lane-nothing-to-do` requires `pm-notes`; the rest require none (`packages/core/src/contracts/dispatch.ts:127-158`). The map's own documentation says `pm-notes` "covers the completed-phase ledger, including the ledger/queue fact that no work remains" (`dispatch.ts:142-148`). *(read 2026-11-18)*
- **FACT:** The false-success verdict is computed from the required sources for the token: a required source that is `unsatisfied` (and readable) makes the attempt a false success (`packages/core/src/domain/dispatch-comparison.ts:213-229`). *(read 2026-11-18)*
- **FACT:** The corroboration record is a fixed three-member object with a closed tri-state per source (`packages/core/src/contracts/dispatch.ts:116-135`), and the attempt record carries it plus a `falseSuccess` boolean (`dispatch.ts:224-267`). *(read 2026-11-18)*
- **FACT:** The expected-result read currently feeds corroboration from the phase-completion flag (`packages/core/src/app/dispatch.ts:588-592`), so "pm-notes" as a corroboration source is a phase-ledger fact, not a document-completeness fact — and it stays so in this change (DEC-11). *(read 2026-11-18)*
- **FACT:** The derivation is already shared, not per-path: the daemon result producer imports and calls the same `deriveDispatchResult` with the same input shape and no mode flag, supplying a zero restart bound (`packages/core/src/app/daemon-dispatch-result.ts:32,104-120`; `packages/core/src/domain/dispatch-result.ts:159`). *(read 2026-11-19)*
- **Why now:** Ticket gaps 9 and 10 are exactly these two unreachable arms, and the parity battery must replay all eleven classes through the real derivation. Pinning the order also settles the done-plus-blocked conflict that the delivered order resolves the other way, and the corroboration map must move with the arms or a true merge is recorded as a false success.

## Problem Framing (Clarified)

Three questions are tangled, and each has a different failure mode:

1. **Order.** Which evidence wins when several are true? The delivered order answers "blocked first"; the shell answers "done first". Only one can be the contract, and the choice changes a delivered verdict for a real input (done + blocking label).
2. **Coverage.** Two of the shell's arms do not exist, and one delivered arm (exit 0, no artifact → `failed`) is a typed-only invention that the shell does not have. Coverage and order are one table, not two.
3. **Corroboration.** A success claim is audited against required evidence sources. If a new arm's evidence source differs from the token's declared source, a *true* success becomes a false-success incident — the exact inversion of the property corroboration exists to protect.

Root cause versus symptom: the symptom is "two classes are unreachable and the order disagrees". The cause is that derivation grew arm by arm against a token-keyed corroboration map, so each new arm inherited requirements written for a different arm. The fix is to state one ordered ladder where each arm names its evidence, and to let corroboration select sources by the arm that produced the token.

Second-order consequence that drives the corroboration decision: a tracker-done `merged` has no visible PR, and a nothing-to-do has no commits and possibly no change folder at all. Requiring pm-notes and CI for them does not add safety; it manufactures incidents for outcomes the evidence cannot produce.

Deliberately out of scope: no new token, projection, exit, error row, or domain kind (NG-4, NFR-3); no change to the attempt-record schema identity or field set (DM-2); no new read, file-probe rule, or configuration key for pm-notes completeness (DM-3); no re-introduction of a log-signature permission arm (NG-10, deferred to GH-354); no change to the attempt-stage failure identities (they keep their places); no re-pointing of the `"pm-notes"` corroboration source at the new `pmNotes` fact and no relaxation of `isDeliveredEvidence` (DEC-11, deferred in §7.3). The ledger retirement is **not** out of scope: it is decided here.

## Constraints (Hard Requirements)

### C-1: The closed vocabulary, projections, and exits do not move

- **Statement:** The eleven tokens, each token's projection class, the exits those classes yield, the error table, and the domain kinds are unchanged; in particular `state-unverified` stays exit 2 and `partial` stays exit 1.
- **Source:** AC (NG-4; NFR-3; §8.5 "Closed vocabulary invariance"; AC-F8-5)
- **Verification:** test (taxonomy inventory equality; per-token exit assertion; error-row inventory equality) + code review
- **Negotiable:** no

### C-2: One total order, first match wins, no two arms for one input

- **Statement:** The ladder is a single ordered list over the attempt-stage failures, the pre-session arms, the session-truth arms, and the explicit undecidable arm, where exactly one arm matches any input and the order is normative; a clean completion with readable truth always lands on a declared arm.
- **Source:** AC (§5.1 F-8; AC-F8-5 "no two arms claim the same input"; §8.5 "Phase-ledger no-work arm retired"; §25.6 Appendix F "normative")
- **Verification:** test (per arm: the token; per non-matching input: the next arm; a totality assertion over the readable-truth combinations; a planted overlapping arm fails the case) + code review
- **Negotiable:** no

### C-3: A success claim is never derived from, or audited against, evidence the arm structurally cannot produce

- **Statement:** A tracker-done `merged` and a nothing-to-do result are corroborated by the tracker fact, and no arm requires a source whose absence is structural (no commits, no PR, no change folder). This is the **whole** extent of the corroboration change: every other token keeps its delivered token-keyed sufficiency, `"pm-notes"` stays the phase ledger (`phasesComplete`), and a `finished` reached with a ledger that disagrees with the artifacts remains a `finished` whose disagreement is recorded as a delivered-evidence divergence — a real evidence disagreement, not evidence the arm could not produce, and never grounds for re-pointing the source here (DEC-11).
- **Source:** AC (§5.1 F-8 arm-aware corroboration; AC-F8-1; AC-F8-3 divergent-ledger clause; AC-F8-4; §8.5 "`pm-notes` corroboration remains ledger-sourced"; DEC-11; §12)
- **Verification:** test (tracker-done merge and nothing-to-do with absent pm-notes and CI: `falseSuccess` false and the tracker source satisfied; a `finished` over a not-progressed, not-complete ledger: token `finished`, a delivered-evidence divergence with the delivered shape and dedupe, `falseSuccess` not suppressed) + code review
- **Negotiable:** no

### C-4: The corroboration record and the attempt record keep their shapes

- **Statement:** The corroboration record stays exactly three sources with a closed tri-state each; the attempt record's field set, schema identity, and evidence budget are unchanged; what changes is only the selection of required sources for the two arms whose evidence source changed.
- **Source:** AC (§8.3 DM-2/DM-4 "the corroboration record's tri-state shape is unchanged"; NFR-3 "0 attempt-schema-version changes"; NFR-7)
- **Verification:** test (corroboration key-set and vocabulary equality; attempt key-set equality; pre-change attempt round-trip) + code review
- **Negotiable:** no

### C-5: The two changed verdicts are named, deliberate, and proven

- **Statement:** A done work item that also carries a blocking label resolves `merged` (was `blocked`); commits with incomplete or absent pm-notes resolve `partial` (was reachable as `finished`). Both are asserted as named parity cases, and no other delivered verdict changes for the same input.
- **Source:** AC (§8.5 "Deliberate behaviour changes"; AC-F8-2, AC-F8-3; RSK-4)
- **Verification:** test (the two named inputs resolve the new tokens; every other arm's input resolves its delivered token) + code review
- **Negotiable:** no

### C-6: pm-notes completeness derives from the delivered read, adding no probe and no key

- **Statement:** The artifact read gains a required `pmNotes: complete | incomplete | absent` fact derived from the delivered pm-notes read/classification; `complete` requires a present document with a non-null delivery completion; `absent` means no document; `incomplete` covers present-but-incomplete, unparseable, or otherwise not complete, so the fallible direction is always "not finished". No new external read, file rule, or configuration key is added.
- **Source:** AC (§8.3 DM-3; AC-F8-3; RSK-10; NFR-11)
- **Verification:** test (per fact value: the arm; a malformed document reads `incomplete` and never `finished`; no additional read is issued) + code review
- **Negotiable:** no

### C-7: The subsumed arm leaves no gap and no duplicate

- **Statement:** The typed-only exit-0-no-artifact `failed` arm no longer exists in the ladder; `failed` remains reachable from the shared classifier's reported-failure/non-zero-exit outcome and from the spawn-failure identity, and no input that previously resolved `failed` now resolves a success token.
- **Source:** AC (§8.3 DM-4 "removed in favour of the parity arms"; §8.5; AC-F8-5)
- **Verification:** test (the old arm's input now resolves by the covering arm — `noop-lane-nothing-to-do` or `partial`/`failed` per its evidence; a reported failure still resolves `failed`; a spawn failure still resolves `failed` with its identity) + code review
- **Negotiable:** no

**Table stakes.** Every alternative below keeps the delivered truth reads, the delivered harness classifier, the delivered attempt record, the delivered projection classes, and the single shared derivation (`deriveDispatchResult` is called by both the one-shot and daemon paths with no mode flag, so none of them can fork behaviour); none of those eliminates an alternative.

## Decision Drivers

1. **Parity with the shell's tracker order.** The shell checked done first because a closed item is the canonical merge signal; the typed order checked blocked first. One of the two is the contract and the parity claim requires the shell's.
2. **Honesty of a success claim.** Corroboration exists to catch a success that the evidence does not support. A requirement that is structurally unsatisfiable inverts it into a false accusation.
3. **Totality and reviewability.** A single ordered table is checkable by reading; a predicate chain assembled arm by arm is not.
4. **One derivation, not two.** The parity battery's value collapses if the typed ladder approximates the shell's rather than encoding it.
5. **Vocabulary stability.** Two arms become reachable and one is subsumed without a new token, a new exit, or a new record — the closed taxonomy is the system's most expensive contract to change.
6. **Solo-maintainer cost.** One table, one arm-aware source selection, one new artifact fact derived from an existing read.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-347 routes the total order and corroboration rule here as spec DEC-6 (ticket gaps 9 and 10), and this record changes a delivered derivation contract.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-347 PR review. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (F-8, DM-3/DM-4, AC-F8-x, Appendix F, DEC-6), `@decision-advisor` (delivered derivation, corroboration map, shell order, this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the human owner (two delivered verdicts move).
- **Performers:** `@coder` (ladder, arms, subsumption, the pm-notes fact, arm-aware corroboration, parity cases); `@doc-syncer` (dispatch-engine, result-contract, glossary).
- **Informed:** the handover gate and false-success accounting; downstream token readers; any future arm author.

**Type note.** TDR. The taxonomy and exit projection were decided by TDR-0005/TDR-0010 and are not reopened; this record fixes the derivation order, the arm set, and the corroboration selection inside that decided vocabulary. It is `archetype: policy` because it is a rule set about which evidence wins and what a success claim requires, not a selection of technology. It is R2 because two delivered verdicts move and every downstream token reader is affected; it is not R3 because the vocabulary is closed, the change is offline-provable, and no data or record is migrated.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The delivered ladder tests blocking before every PR state, has no tracker-done arm, and has no artifact-completeness arm. | FACT | `packages/core/src/domain/dispatch-result.ts:159-310` (read 2026-11-18) | If the arms existed, only the order would be in question. | High |
| The ledger no-work arm precedes the exit-0-no-artifact arm and resolves `noop-lane-nothing-to-do`. | FACT | `dispatch-result.ts:279-302` (read 2026-11-18) | The no-work arm's evidence would already be tracker-based. | High |
| The exit-0-no-artifact arm resolves `failed` and is typed-only. | FACT | `dispatch-result.ts:287-302`; spec §2.1 (shell order has no such arm) (read 2026-11-18) | Subsumption would not be a behaviour change. | High |
| `partial` is reachable only from the classifier's tool-failure and premature-end outcomes. | FACT | `packages/core/src/contracts/harness.ts:170-186` (read 2026-11-18) | The unreachable-arm gap would not exist. | High |
| The shell's order is done → merged, blocking → blocked, open PR → pr-open, merged PR → merged, else failed. | FACT | `scripts/deliver-ticket.sh:1308-1419` (read 2026-11-18) | The ordering decision would have no parity reference. | High |
| Corroboration sufficiency is declared per token, `merged` requires pm-notes + tracker + ci, and `pm-notes` currently means the phase-completion flag. | FACT | `packages/core/src/contracts/dispatch.ts:127-158`; `packages/core/src/app/dispatch.ts:588-592` (read 2026-11-18) | An arm-aware selection would be unnecessary. | High |
| The false-success verdict is computed from the required sources for the token. | FACT | `packages/core/src/domain/dispatch-comparison.ts:213-229` (read 2026-11-18) | Changing the required sources would not change the incident count. | High |
| The corroboration record is a fixed three-source tri-state and the attempt record carries it with the schema unchanged. | FACT | `packages/core/src/contracts/dispatch.ts:116-135,224-267` (read 2026-11-18) | C-4 would over-constrain a needed shape change. | High |
| The one-shot and daemon result producers call the same `deriveDispatchResult`; the daemon path passes a zero restart bound and no mode flag. | FACT | `packages/core/src/app/daemon-dispatch-result.ts:32,104-120`; `packages/core/src/domain/dispatch-result.ts:159` (read 2026-11-19) | A forked daemon derivation would make DC-7 false and bound the ledger/arm changes to one path only. | High |
| The delivered `isDeliveredEvidence` requires a completed outcome and a readable ledger with progress or a complete total, so a divergent ledger raises a delivered-evidence divergence independently of the corroboration source. | FACT | `packages/core/src/app/dispatch.ts:429-447,1069-1091` (read 2026-11-19) | Re-pointing the corroboration source would look like a fix for the divergence; the deferral justification would be wrong. | High |
| The eleven tokens and their projections are closed, with `state-unverified` at exit 2 and `partial` at exit 1. | FACT | `packages/core/src/contracts/delivery-result.ts:26-95`; TDR-0005/TDR-0010 (read 2026-11-18) | C-1 would be vacuous. | High |
| A closed work item is a truthful merge signal even when no pull request is observable, because the provider client cannot observe a closed-unmerged request. | ASSUMPTION | Spec §12 (assumption 9); the shell's `closed → merged` arm | If a closed-unmerged item were observable, that input would report a merge that did not happen; the mitigation is that the tracker-done arm's premise is named as a revisit trigger. | Medium-High |
| A change with no commits has a pm-notes document absent or incomplete rather than complete. | ASSUMPTION | DM-3's definition; the change-folder convention | If a no-op nevertheless carried complete pm-notes, the nothing-to-do arm would still resolve correctly (it is reached by commit count and the tracker), so only the corroboration argument is affected. | Medium-High |
| A complete phase ledger can exist with commits present (the delivered `nn` arm precedes the artifact arms). | FACT | `dispatch-result.ts:279-284`; the retirement is normative in spec §8.3 DM-4, §8.5 "Phase-ledger no-work arm retired", and AC-F8-3 (read 2026-11-19) | Under this ladder that input resolves `finished` or `partial` by pm-notes completeness; DC-4's ruled retirement is what makes the outcome determined rather than incidental. | High |

## Mental Models & Techniques Used

- **First principles:** What must a derivation be to be trustworthy? Total (every input gets an answer), ordered (no ambiguity), and evidence-honest (a claim names the evidence that produced it). The three properties generate the ladder, the "no two arms" rule, and the arm-aware corroboration.
- **Inversion:** What makes a derivation dangerous? A success token from an arm that checked nothing; a false-success incident caused by missing evidence the arm could not produce; two arms matching one input (order-dependent answers); a removed arm that silently resolves to success. C-2, C-3, C-7 exclude exactly those.
- **Second-order thinking:** Making corroboration arm-aware turns the sufficiency declaration into "the arm's own evidence", which is what makes a future arm safe to add: it must name its source, and a source it cannot produce cannot be required. Token-keyed sufficiency cannot express that and will invert again the next time an arm is added.
- **Systems thinking:** derivation → corroboration → false-success flag → handover gate → operator trust. A wrong arm does not stay local: it becomes an incident count, then a gate verdict, then a decision about whether the typed lane is authoritative. That chain is why the order and the evidence requirement are decided together.
- **5 Whys (on "commits with incomplete pm-notes report `finished`"):** `finished` comes from the classifier's completed outcome → no artifact arm checks pm-notes → the artifact read carries commit count and PR state only → the completeness fact was never required by any arm. The fix is the fact plus the arm, and the corroboration source has to follow the fact.
- **Paved road / KISS:** Reuse the delivered reads, the delivered classifier, the delivered tokens, and the delivered corroboration record; add one artifact fact, two arms, one subsumption, and an arm-aware selection.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 vocabulary fixed | C-2 total, no overlap | C-3 honest success claims | C-4 record shapes fixed | C-5 two named verdicts | C-6 no probe, no key | C-7 no gap, no duplicate |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the delivered ladder | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| ALT-1 add the two arms, keep blocked-first | ✅ | ✅ | ❌ (map untouched) | ✅ | ❌ | ✅ | ✅ |
| ALT-2 full reorder, keep token-keyed corroboration | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 require an observable merged PR (refuse tracker-done) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-4 keep the exit-0-no-artifact `failed` arm beside the new arms | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-5 selected: full reorder, subsumed arm, arm-aware corroboration | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Keep the Delivered Ladder

- **Eligibility:** Not eligible (fails C-3, C-5).
- **Summary:** Ship the delivered predicate chain: blocking first, no tracker-done arm, no artifact-completeness arm, token-keyed corroboration.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-6, C-7. Fails C-5 (the two parity arms remain unreachable, so the shell's `partial` and tracker-done `merged` cannot be reproduced) and C-3 (a token-keyed corroboration map already asks `merged` for pm-notes and CI even where the merge came from the tracker alone).
- **Driver fit:** Fails drivers 1 and 4 outright; serves only driver 5.
- **Pros:** Zero change.
- **Cons:** The parity claim stays false for two classes and the done-plus-blocked conflict stays the other way.
- **Why rejected:** It is the gap the ticket names.

### Alternative 1 — Add the Two Arms but Keep the Blocked-First Order

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Insert tracker-done and artifact-completeness arms into the delivered order, leaving blocking first.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-6, C-7; C-3 only by exception because the corroboration map is untouched. Fails C-5: a done work item that carries a blocking label still resolves `blocked`, so the two ladders disagree on a real input and the order is not pinned as one table.
- **Driver fit:** Serves drivers 2 (partially) and 5; fails drivers 1 and 4.
- **Pros:** Smaller diff; the delivered ordering statement survives.
- **Cons:** The conflict the ticket raises is deliberately left in place, and the parity battery would have to encode a difference rather than a parity.
- **Why rejected:** Coverage without order is not one total ladder.

### Alternative 2 — Full Reorder but Token-Keyed Corroboration

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Adopt the shell order and the two new arms; keep `DISPATCH_CORROBORATION_SUFFICIENCY` keyed by token exactly as delivered.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-5, C-6, C-7. Fails C-3: a tracker-done `merged` would require pm-notes and CI, which a merged-and-closed item may not have, and a nothing-to-do would require pm-notes, which a no-op with no change folder cannot have — so genuine outcomes become false-success incidents, and the incident count rises exactly when the ladder starts reporting more true merges.
- **Driver fit:** Fails driver 2, which is the driver corroboration exists for.
- **Pros:** One map, unchanged; no arm-aware selection to reason about.
- **Cons:** The new arms are born reporting false successes; the handover gate would consume those incidents as evidence against the dispatch lane.
- **Why rejected:** An evidence requirement the arm cannot satisfy is a false accusation, not a safeguard.

### Alternative 3 — Require an Observable Merged PR and Refuse Tracker-Done `merged`

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Keep the delivered order and add only the artifact-completeness arm; never derive `merged` from the tracker, because a merge should require an observable merged pull request.
- **Constraint compliance:** Passes C-1…C-4, C-6, C-7. Fails C-5: the tracker-done arm is one of the two parity gaps, so the shell's canonical merged case stays unreachable.
- **Driver fit:** Strong on driver 2 (a `merged` with no merged PR is a weaker claim) and fails drivers 1 and 4.
- **Pros:** Every `merged` has an observable artifact.
- **Cons:** The dominant real case — an issue closed by a merge whose PR the provider client cannot see — would keep reporting something else, and the shell's behaviour could not be reproduced.
- **Why rejected:** It buys a stronger claim by refusing the reference behaviour; the honesty concern is addressed instead by corroborating the arm on the tracker fact that produced it.

### Alternative 4 — Keep the Exit-0-No-Artifact `failed` Arm Beside the New Arms

- **Eligibility:** Not eligible (fails C-2, C-7).
- **Summary:** Add the two arms and leave the typed-only arm in place, ordered after the artifact arms.
- **Constraint compliance:** Passes C-1, C-3 (with arm-aware corroboration), C-4, C-5, C-6. Fails C-2: with the new no-work arm and the pm-notes arms placed before it, the old arm's only remaining inputs are those the no-work arm already covers, so the two arms overlap and the answer depends on order rather than evidence. Fails C-7: it retains an arm the shell does not have, keeping a typed-only verdict in a parity table.
- **Driver fit:** Fails drivers 3 (no overlap) and 4 (one derivation).
- **Pros:** Preserves a delivered token path for zero-artifact completions.
- **Cons:** Ambiguous coverage, and a documented parity table with a row the reference does not have.
- **Why rejected:** Subsumption is what makes the ladder total and parity-honest at the same time.

### Alternative 5 — Selected: Full Reorder, Subsumed Arm, Arm-Aware Corroboration

- **Eligibility:** Eligible.
- **Summary:** The ladder of Appendix F, in order; the two arms reachable; the exit-0-no-artifact arm subsumed; corroboration selected by the arm for tracker-done `merged` and nothing-to-do; the vocabulary, projections, exits, and records unchanged.
- **Constraint compliance:** Passes C-1…C-7 (matrix above).
- **Driver fit:** Best on every driver: shell order encoded (1), arm-honest corroboration (2), one total table (3), one derivation (4), closed vocabulary (5), one fact and one selection (6).
- **Pros:** All eleven classes become reachable and testable; the two behaviour changes are named; the false-success inversion is fixed at its cause; the ladder is reviewable as a list.
- **Cons:** Two delivered verdicts change for named inputs; every future arm must declare its own corroboration source; the phase ledger stops being a derivation input (see below).
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint.

## Decision

- **Decision:** Adopt **ALT-5**.

  1. **DC-1 — One total, ordered ladder over completed-session truth.** In order: pre-session refusals (no token, no attempt, no lane) → attempt-stage failures (spawn failure → `failed`; resume refused as uneconomical → `failed`; resume admission facts unreadable → `state-unverified`; unreadable collected harness evidence → `state-unverified`) → harness spawn refusal → `noop-lane-permission` → tracker readable and done → `merged` → tracker readable and blocking → `blocked` → PR open → `pr-open` / `pr-open-unverified` → PR already merged → `merged` → commits > 0 with complete pm-notes → `finished` → commits > 0 with incomplete or absent pm-notes → `partial` → commits = 0 with a readable non-done non-blocked tracker → `noop-lane-nothing-to-do` → the shared classifier's token (`failed` for a reported failure or non-zero exit; `partial` for a tool failure or premature end) → truth undecidable → `state-unverified` at exit 2. This is the **completed-session** ladder: a stall does not consult it, and at a stall only a member of the terminal pre-restart verdict set short-circuits (TDR-0047 DC-4; Appendix F C versus D). (Spec §25.6 Appendix F is normative; DM-4 states the order.)
  2. **DC-2 — The tracker-done arm precedes the blocking arm.** A readable tracker whose native state is done resolves `merged`, corroborated by the tracker fact, with no visible pull request required; a done work item that also carries a blocking label therefore resolves `merged`, not `blocked`. (Spec AC-F8-1, AC-F8-2; shell `closed → merged`.)
  3. **DC-3 — Artifact completeness is a ladder arm.** `finished` and `partial` are distinguished by the new `pmNotes: complete | incomplete | absent` artifact fact, with `complete` requiring a present document with a non-null delivery completion and every other shape reading as not complete; malformed reads as incomplete, so the fallible direction is never "finished". (Spec DM-3, AC-F8-3.)
  4. **DC-4 — One token, one derivation: the no-work arm is the shell arm, and the phase-ledger no-work arm is retired.** With zero commits, no pull request, and a readable tracker that is neither done nor blocking, the result is `noop-lane-nothing-to-do`, corroborated by the tracker fact; an unreadable tracker never takes this arm. The delivered phase-ledger no-work arm is **retired, not merely unused**: a complete phase ledger alone does not produce the token, a complete ledger with commits resolves `finished` or `partial` by pm-notes completeness, and a complete ledger with no commits reaches `noop-lane-nothing-to-do` only under the shell condition above. The ledger's role narrows to the resume position, the attempt comparison's `progressed` fact, and the delivered-evidence predicate's `progressed` read; `ledger.workRemaining` remains carried for compatibility and reporting but **no rule reads it as a token gate**, and no code path may retain the retired arm behind a flag, a mode, or a preference. (Spec §8.3 DM-4; §8.5 "Phase-ledger no-work arm retired"; AC-F8-4; §25.6 Appendix F(C).)
  5. **DC-5 — The exit-0-no-artifact `failed` arm is subsumed.** The typed-only arm is removed; `failed` remains reachable from the shared classifier's reported-failure/non-zero-exit outcome and from the spawn-failure identity, and no input that previously resolved `failed` resolves a success token without an arm that actually observed one. (Spec DM-4, §8.5.)
  6. **DC-6 — Corroboration is arm-aware for exactly two arms, and the `"pm-notes"` source stays the phase ledger.** A tracker-done `merged` and a `noop-lane-nothing-to-do` require the tracker fact; every other token keeps its delivered token-keyed sufficiency. The `"pm-notes"` corroboration source remains the phase ledger (`phasesComplete`) and is **deliberately not re-pointed** at the new `pmNotes` artifact fact in this change: the two facts can disagree, a `finished` reached over a ledger that has not progressed and is not complete is still `finished`, and the disagreement is recorded as a delivered-evidence divergence with the delivered shape and dedupe — TDR-0024's honesty mechanism, not a false success claim about the session. `falseSuccess` is never silently suppressed by this decision and no new incident kind is added. Re-pointing the source or relaxing `isDeliveredEvidence` for the artifact arms is deferred to a separate decision (§7.3, DEC-11); a coder must not "fix" the mismatch inside this change. The corroboration record's three sources and tri-state vocabulary, the attempt-record shape, and the false-success predicate's shape are unchanged. (Spec §8.3 DM-4; §8.5 "`pm-notes` corroboration remains ledger-sourced"; AC-F8-1, AC-F8-3, AC-F8-4; DEC-11; §7.3.)
  7. **DC-7 — One derivation, shared with the daemon path, with no forked mode.** `deriveDispatchResult` remains the single derivation for both the one-shot path (`packages/core/src/app/dispatch.ts`) and the daemon result producer (`packages/core/src/app/daemon-dispatch-result.ts`), called with the same input shape and no mode, variant, or feature switch. The daemon path therefore inherits tracker-done `merged`, artifact `partial`, the subsumed exit-0-no-artifact arm, and the phase-ledger arm retirement; its attempt-record corroboration keeps the delivered ledger-sourced `"pm-notes"` (DC-6). The inheritance is a deliberate consequence, not an oversight, and it is bounded by a required daemon-path regression observation over the affected arms in this change's test plan. The daemon path supplies a zero restart bound, so the restart-budget arm stays inert there: it inherits the derivation, not the loop. (Spec §8.3 DM-4 first sentence; §8.5 "One shared derivation, daemon path included"; AC-F8-5.)

### Constraint Compliance Attestation

ALT-5 satisfies C-1 through C-7. C-1: no token, projection, exit, row, or domain kind moves; `state-unverified` stays exit 2 and `partial` stays exit 1. C-2: one ordered list, first match wins, and Appendix F's totality claim is asserted — the ledger-arm retirement is what removes the second input that used to claim the no-work verdict. C-3: the two arm-aware arms are corroborated by the tracker fact, no arm requires structurally absent evidence, and the `"pm-notes"` source keeps its delivered ledger meaning with a divergent-ledger `finished` explained as a delivered-evidence divergence rather than a corroboration change. C-4: the corroboration record and the attempt record keep their key sets and vocabularies. C-5: the two changed verdicts are named, asserted, and justified. C-6: pm-notes completeness derives from the delivered read with no new probe or key. C-7: the subsumed arm leaves no overlap and no input without an arm. The shared-derivation requirement (DC-7) is satisfied by construction and is table stakes: both paths call one function with no mode, and the daemon path's inheritance is proven by the required regression observation rather than assumed. No accepted-risk exception is claimed.

## Trade-offs & Consequences

### Positive Outcomes

- All eleven classes become reachable from the real derivation, so "11/11 parity" is a fixture count rather than an aspiration.
- One ordered table replaces a predicate chain whose order was an accumulation; a reviewer can read the ladder and the coverage matrix against each other.
- The done-plus-blocked conflict is settled explicitly and in the direction the reference implementation uses.
- `partial` stops being an accident of the classifier and becomes a statement about artifact completeness, which is what an operator needs after a session that stopped early.
- False-success incidents stop being generated by evidence that an arm structurally cannot produce, which protects the handover gate's input from a self-inflicted bias — and a genuine ledger-versus-artifact disagreement keeps its own, separate signal instead of being folded into the corroboration map.
- One token has one derivation: the ledger no longer competes with the tracker-and-commit-count arm, so "why did this resolve `noop-lane-nothing-to-do`?" has one answer with evidence behind it.
- The daemon path improves with the one-shot path because there is one function, not two: the parity claim is a property of the code, not of two synchronized implementations.

### Negative Outcomes

- Two delivered verdicts change for named inputs, so a dashboard, a script, or an operator habit that keyed on the old answer will see a different token. The vocabulary and exits do not change, so no consumer breaks structurally.
- Every future arm must declare its corroboration source, which is a small permanent obligation on arm authors.
- The ladder is longer than the chain it replaces, and its middle section (PR arms then artifact arms) depends on the order being read in sequence rather than as independent predicates.
- The phase ledger stops deciding a token, so a ref whose ledger says "no work remains" but which has commits reports `finished`/`partial`. This is the largest behaviour change in the decision; it is now a ruling (DM-4, §8.5) rather than a flagged omission, and DC-4 states it so it cannot be implemented as an accident.
- The daemon path changes behaviour it did not ask to change, because it shares the derivation. That is the correct trade (one derivation beats two), but it puts a regression obligation on this change: the test plan must observe the daemon path over tracker-done `merged`, artifact `partial`, and a complete-ledger-with-commits input.
- A `finished` over a divergent ledger still raises a delivered-evidence divergence, and a reader who expects the artifact arms' corroboration to be artifact-sourced will keep meeting that disagreement until the deferred re-point lands. It is honest but it is noise, and DEC-11 deliberately chooses the noise over a second evidence contract inside this change.
- `merged` accepts a tracker-only claim, which is a weaker evidentiary basis than a merged PR; the record bounds the weakness by requiring a readable tracker (the arm is unreachable on an unreadable one) and by naming the premise as a revisit trigger.

### Unresolved Questions

- [ ] Should `partial` carry the incompleteness reason (pm-notes absent versus incomplete) as bounded evidence? (owner: `@pm`; today the harness outcome and the arm are carried, and adding a reason is an additive evidence choice)

## Implementation Plan

1. **Artifact fact.** Add `pmNotes` (complete/incomplete/absent) to the artifact truth read, derived from the delivered pm-notes read/classification, with the fail-closed direction.
2. **Ladder.** Replace the predicate chain with the ordered ladder; keep the attempt-stage failures and the pre-session arms where they are; remove the exit-0-no-artifact arm.
3. **Corroboration.** Select the required sources by the producing arm for tracker-done `merged` and nothing-to-do; keep the record, the false-success predicate's shape, and the ledger-sourced `"pm-notes"` source unchanged, and do **not** touch `isDeliveredEvidence` or the divergence path.
4. **Shared derivation.** Change the one function both paths call; add no mode, flag, or per-path branch, and remove the retired ledger arm from the single implementation rather than disabling it. Add the daemon-path regression observation over the inherited arms to the test plan.
5. **Coverage.** Extend the derivation fixtures so every arm is asserted by token and exit, including done-plus-blocked, commits with complete pm-notes, commits with incomplete and absent pm-notes, the complete-ledger-with-commits input, the shell no-work arm, the classifier arms, and the undecidable arm; assert no two arms match one input, and assert a complete ledger alone never yields `noop-lane-nothing-to-do`.
6. **Documentation.** Record the order, the arm set, the arm-aware corroboration, the ledger-arm retirement, and the daemon-path inheritance on the dispatch-engine, resident-daemon, and result-contract pages, and add the ladder to the glossary entry for the dispatch lane in the documentation phase.

## Verification Criteria

- Each of the eleven tokens is produced by its declared arm with its delivered exit; a planted overlapping arm fails the totality case.
- Tracker done with no visible PR: `merged`, corroborated by the tracker fact, `falseSuccess` false even with absent pm-notes and CI.
- Tracker done **and** a blocking label: `merged` (the named change from `blocked`).
- Commits > 0 with complete pm-notes: `finished`; with incomplete pm-notes: `partial`; with absent pm-notes: `partial`; a malformed pm-notes document never yields `finished`.
- Commits = 0, no PR, readable non-done non-blocked tracker: `noop-lane-nothing-to-do`, `falseSuccess` false; the same input with an unreadable tracker: `state-unverified` at exit 2.
- A complete phase ledger with commits > 0 and complete pm-notes: `finished` (the ledger arm does not fire); the same with incomplete pm-notes: `partial`; a complete ledger with no commits and no PR and a readable non-done non-blocked tracker: `noop-lane-nothing-to-do` by the shell condition only; a complete ledger with no commits and an unreadable tracker: `state-unverified`. No configuration, flag, or mode restores the retired arm.
- Commits > 0, complete pm-notes, and a ledger that has not progressed and is not complete: token `finished`, a delivered-evidence divergence with the delivered shape and per-ref dedupe, `falseSuccess` not suppressed, no new incident kind; the `"pm-notes"` corroboration source still reports the ledger's state (not the `pmNotes` fact), and `isDeliveredEvidence` is unchanged.
- Daemon-path regression observation: the daemon result producer over tracker-done `merged`, over commits with incomplete pm-notes (`partial`), and over complete-ledger-with-commits (`finished`) yields the same tokens as the one-shot path, with no forked mode and with its attempt corroboration still ledger-sourced.
- Spawn refusal: `noop-lane-permission`; reported failure or non-zero exit: `failed`; tool failure or premature end: `partial`; spawn failure: `failed` with its identity and one attempt record.
- The delivered exit-0-no-artifact input resolves by the covering arm and never by a removed one; a superseded arm leaves no duplicate match.
- The taxonomy inventory, the corroboration key set and vocabulary, the attempt record key set, the error-row inventory, and the configuration key set are all unchanged.

## Confidence Rating

**High.** Every load-bearing fact is repo-local and read directly: the delivered predicate chain in order, the absence of the two arms, the position of the ledger arm, the exit-0-no-artifact arm, the token-keyed sufficiency map with its documented pm-notes meaning, the false-success predicate, the corroboration record's tri-state shape, the closed taxonomy and projections, the shell's tracker order, the shared `deriveDispatchResult` call from both paths with no mode, and the delivered `isDeliveredEvidence` predicate. The ledger retirement and the corroboration boundary are now normative rulings rather than inferences. The residual uncertainty is the tracker-done premise (a closed item is a truthful merge signal), which is external to the repository and is bounded by requiring a readable tracker and by naming the premise as a revisit trigger.

## References

- Change: `doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md` — §2.1 (delivered derivation order and shell order), §4.1, §5.1 F-4/F-8, §6 Flow 4, §7.3, §8.3 DM-3/DM-4, §8.5, §11 RSK-4/RSK-10, §12, §17.4, §17.8, §25.5 Appendix E, §25.6 Appendix F(A–E), §25.7 Appendix G.
- Prior decisions: TDR-0005 and TDR-0010 (result taxonomy, projection, and dispatch-session projection); TDR-0018 (artifact evidence and escalation); TDR-0024 (attempt read side); [TDR-0047](TDR-0047-in-process-bounded-restart-loop.md) (the stall ladder's terminal-verdict branch); [TDR-0044](TDR-0044-dispatch-owned-durable-lane-record.md) (record cardinality).
- Specs: `doc/spec/features/feature-dispatch-engine.md` (result-derivation bullets and failure-token mapping); `feature-result-contract.md`; `feature-session-lifecycle-economics.md`; `doc/overview/glossary.md`.
- Contracts and code (read 2026-11-18): `packages/core/src/domain/dispatch-result.ts`; `packages/core/src/domain/dispatch-comparison.ts`; `packages/core/src/contracts/dispatch.ts`; `packages/core/src/contracts/delivery-result.ts`; `packages/core/src/contracts/harness.ts`; `packages/core/src/app/dispatch.ts`; `packages/core/src/app/dispatch-ledger.ts`.
- Parity reference (read 2026-11-18): `scripts/deliver-ticket.sh` — `classify_result` (lines 1308-1419) and `decide_after_iteration` (lines 1648-1712).
